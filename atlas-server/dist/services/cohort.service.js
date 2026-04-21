/**
 * Cohort service — TLE inter-section cohort ingestion and management.
 * Wave 3.5: Supports specialized TLE groups (IA, HE, etc.) that span multiple sections.
 *
 * Cohorts are fetched from EnrollPro's SCP config endpoint and persisted locally
 * for scheduling reference.
 */
import { prisma } from '../lib/prisma.js';
import { sectionAdapter } from './section-adapter.js';
const TLE_SPECIALIZATION_BLUEPRINTS = [
    { specializationCode: 'IA', specializationName: 'Industrial Arts', preferredRoomType: 'TLE_WORKSHOP' },
    { specializationCode: 'HE', specializationName: 'Home Economics', preferredRoomType: 'LABORATORY' },
    { specializationCode: 'AFA', specializationName: 'Agri-Fishery Arts', preferredRoomType: 'LABORATORY' },
];
function normalizeExplicitCohort(rawCohort) {
    if (!rawCohort.cohortCode || !rawCohort.specializationCode || !rawCohort.specializationName || rawCohort.gradeLevel == null) {
        return null;
    }
    return {
        cohortCode: rawCohort.cohortCode,
        specializationCode: rawCohort.specializationCode,
        specializationName: rawCohort.specializationName,
        gradeLevel: rawCohort.gradeLevel,
        memberSectionIds: Array.isArray(rawCohort.memberSectionIds) ? rawCohort.memberSectionIds.filter((value) => typeof value === 'number') : [],
        expectedEnrollment: typeof rawCohort.expectedEnrollment === 'number' ? rawCohort.expectedEnrollment : 0,
        preferredRoomType: rawCohort.preferredRoomType ?? null,
        sourceRef: rawCohort.sourceRef ?? 'enrollpro:explicit-cohorts',
    };
}
export function deriveFallbackTleCohorts(gradeLevels) {
    return gradeLevels.flatMap((gradeLevel) => {
        const orderedSections = [...gradeLevel.sections].sort((left, right) => left.id - right.id);
        if (orderedSections.length === 0) {
            return [];
        }
        const baseSize = Math.floor(orderedSections.length / TLE_SPECIALIZATION_BLUEPRINTS.length);
        let remainder = orderedSections.length % TLE_SPECIALIZATION_BLUEPRINTS.length;
        let offset = 0;
        const cohorts = [];
        for (const template of TLE_SPECIALIZATION_BLUEPRINTS) {
            const bucketSize = baseSize + (remainder > 0 ? 1 : 0);
            remainder = Math.max(0, remainder - 1);
            const memberSections = orderedSections.slice(offset, offset + bucketSize);
            offset += bucketSize;
            if (memberSections.length === 0) {
                continue;
            }
            cohorts.push({
                cohortCode: `G${gradeLevel.displayOrder}-TLE-${template.specializationCode}`,
                specializationCode: template.specializationCode,
                specializationName: template.specializationName,
                gradeLevel: gradeLevel.displayOrder,
                memberSectionIds: memberSections.map((section) => section.id),
                expectedEnrollment: memberSections.reduce((total, section) => total + section.enrolledCount, 0),
                preferredRoomType: template.preferredRoomType,
                sourceRef: 'derived:section-roster',
            });
        }
        return cohorts;
    });
}
export function normalizeEnrollProCohortResponse(body, sectionsByGrade = []) {
    const warnings = [];
    if (!body || typeof body !== 'object') {
        warnings.push('EnrollPro SCP config response was not an object; returning an empty cohort payload.');
        return { cohorts: [], source: 'enrollpro', warnings };
    }
    const payload = body;
    if (Array.isArray(payload.cohorts) && payload.cohorts.length > 0) {
        const cohorts = payload.cohorts
            .map((rawCohort) => normalizeExplicitCohort(rawCohort))
            .filter((cohort) => cohort != null);
        return { cohorts, source: 'enrollpro', warnings };
    }
    if (Array.isArray(payload.scpProgramConfigs)) {
        warnings.push('EnrollPro SCP config returned scpProgramConfigs without an explicit cohorts array; deriving fallback TLE cohorts from the current section roster.');
        if (sectionsByGrade.length > 0) {
            return {
                cohorts: deriveFallbackTleCohorts(sectionsByGrade),
                source: 'derived-sections',
                warnings,
            };
        }
        warnings.push('No section roster was available to derive fallback TLE cohorts.');
    }
    return { cohorts: [], source: 'enrollpro', warnings };
}
// ─── Stub Adapter ───
const STUB_COHORTS = [
    {
        cohortCode: 'G7-TLE-IA',
        specializationCode: 'IA',
        specializationName: 'Industrial Arts',
        gradeLevel: 7,
        memberSectionIds: [1, 2],
        expectedEnrollment: 67,
        preferredRoomType: 'TLE_WORKSHOP',
    },
    {
        cohortCode: 'G7-TLE-HE',
        specializationCode: 'HE',
        specializationName: 'Home Economics',
        gradeLevel: 7,
        memberSectionIds: [3],
        expectedEnrollment: 38,
        preferredRoomType: 'LABORATORY',
    },
    {
        cohortCode: 'G8-TLE-IA',
        specializationCode: 'IA',
        specializationName: 'Industrial Arts',
        gradeLevel: 8,
        memberSectionIds: [4, 5],
        expectedEnrollment: 66,
        preferredRoomType: 'TLE_WORKSHOP',
    },
    {
        cohortCode: 'G8-TLE-HE',
        specializationCode: 'HE',
        specializationName: 'Home Economics',
        gradeLevel: 8,
        memberSectionIds: [6],
        expectedEnrollment: 33,
        preferredRoomType: 'LABORATORY',
    },
];
class StubCohortAdapter {
    async fetchCohorts(_schoolYearId, _schoolId) {
        await new Promise((r) => setTimeout(r, 50));
        return { cohorts: STUB_COHORTS, source: 'stub', fetchedAt: new Date() };
    }
}
// ─── EnrollPro Adapter ───
class EnrollProCohortAdapter {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl ?? process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
    }
    async fetchCohorts(schoolYearId, _schoolId, authToken, context) {
        const url = `${this.baseUrl}/curriculum/${schoolYearId}/scp-config`;
        const token = authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
        const headers = { 'Content-Type': 'application/json' };
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw Object.assign(new Error(`EnrollPro SCP config API returned ${response.status}`), {
                statusCode: response.status,
                code: 'UPSTREAM_ERROR',
            });
        }
        const body = await response.json();
        const normalized = normalizeEnrollProCohortResponse(body, context?.sectionsByGrade ?? []);
        return {
            cohorts: normalized.cohorts,
            source: normalized.source,
            fetchedAt: new Date(),
            ...(normalized.warnings.length > 0 ? { contractWarnings: normalized.warnings } : {}),
        };
    }
}
function resolveCohortSourceMode() {
    const explicit = process.env.COHORT_SOURCE_MODE?.toLowerCase();
    if (explicit === 'stub' || explicit === 'enrollpro' || explicit === 'auto')
        return explicit;
    const legacy = process.env.SECTION_SOURCE_MODE?.toLowerCase();
    if (legacy === 'stub')
        return 'stub';
    return 'auto';
}
const cohortSourceMode = resolveCohortSourceMode();
class AutoCohortAdapter {
    enrollpro = new EnrollProCohortAdapter();
    async fetchCohorts(schoolYearId, schoolId, authToken, context) {
        try {
            return await this.enrollpro.fetchCohorts(schoolYearId, schoolId, authToken, context);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(JSON.stringify({
                level: 'WARN',
                event: 'cohort_adapter_fallback',
                schoolYearId,
                schoolId,
                errorMessage: msg,
                ts: new Date().toISOString(),
            }));
            const existing = await prisma.instructionalCohort.findMany({
                where: { schoolId, schoolYearId },
                orderBy: [{ gradeLevel: 'asc' }, { specializationCode: 'asc' }],
            });
            if (existing.length > 0) {
                return {
                    cohorts: existing.map((cohort) => ({
                        cohortCode: cohort.cohortCode,
                        specializationCode: cohort.specializationCode,
                        specializationName: cohort.specializationName,
                        gradeLevel: cohort.gradeLevel,
                        memberSectionIds: cohort.memberSectionIds,
                        expectedEnrollment: cohort.expectedEnrollment,
                        preferredRoomType: cohort.preferredRoomType,
                        sourceRef: cohort.sourceRef,
                    })),
                    source: 'cached-enrollpro',
                    fetchedAt: new Date(),
                    contractWarnings: [`EnrollPro cohort source failed (${msg}); using cached cohort snapshot instead.`],
                };
            }
            throw Object.assign(new Error(`UPSTREAM_UNAVAILABLE: EnrollPro cohort source failed (${msg}) and no cached cohorts exist.`), {
                code: 'UPSTREAM_UNAVAILABLE',
            });
        }
    }
}
function buildCohortAdapter(mode) {
    switch (mode) {
        case 'stub': return new StubCohortAdapter();
        case 'enrollpro': return new EnrollProCohortAdapter();
        case 'auto': return new AutoCohortAdapter();
    }
}
const cohortAdapter = buildCohortAdapter(cohortSourceMode);
/**
 * Sync cohorts from external source and persist to InstructionalCohort table.
 */
export async function syncCohorts(schoolId, schoolYearId, authToken) {
    try {
        const sectionResult = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
        const result = await cohortAdapter.fetchCohorts(schoolYearId, schoolId, authToken, {
            sectionsByGrade: sectionResult.gradeLevels,
        });
        const warnings = [
            ...(sectionResult.contractWarnings ?? []),
            ...(result.contractWarnings ?? []),
        ];
        if (result.cohorts.length === 0) {
            const existingCount = await prisma.instructionalCohort.count({
                where: { schoolId, schoolYearId },
            });
            if (existingCount > 0) {
                return {
                    synced: true,
                    source: 'preserved-existing',
                    fetchedAt: result.fetchedAt,
                    count: existingCount,
                    warnings: [...warnings, 'No explicit cohorts were available from the live contract; existing local cohorts were preserved.'],
                };
            }
            return {
                synced: true,
                source: result.source,
                fetchedAt: result.fetchedAt,
                count: 0,
                ...(warnings.length > 0 ? { warnings } : {}),
            };
        }
        await prisma.$transaction([
            prisma.instructionalCohort.deleteMany({
                where: { schoolId, schoolYearId },
            }),
            prisma.instructionalCohort.createMany({
                data: result.cohorts.map((c) => ({
                    schoolId,
                    schoolYearId,
                    cohortCode: c.cohortCode,
                    specializationCode: c.specializationCode,
                    specializationName: c.specializationName,
                    gradeLevel: c.gradeLevel,
                    memberSectionIds: c.memberSectionIds,
                    expectedEnrollment: c.expectedEnrollment,
                    preferredRoomType: c.preferredRoomType,
                    sourceRef: c.sourceRef ?? null,
                })),
            }),
        ]);
        return {
            synced: true,
            source: result.source,
            fetchedAt: result.fetchedAt,
            count: result.cohorts.length,
            ...(warnings.length > 0 ? { warnings } : {}),
        };
    }
    catch (error) {
        return {
            synced: false,
            source: 'enrollpro',
            fetchedAt: new Date(),
            count: 0,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
/**
 * Get all cohorts for a school/year from local persistence.
 */
export async function getCohortsBySchoolYear(schoolId, schoolYearId) {
    return prisma.instructionalCohort.findMany({
        where: { schoolId, schoolYearId },
        orderBy: [{ gradeLevel: 'asc' }, { specializationCode: 'asc' }],
    });
}
/**
 * Get cohorts by grade level.
 */
export async function getCohortsByGrade(schoolId, schoolYearId, gradeLevel) {
    return prisma.instructionalCohort.findMany({
        where: { schoolId, schoolYearId, gradeLevel },
        orderBy: { specializationCode: 'asc' },
    });
}
/**
 * Get a single cohort by code.
 */
export async function getCohortByCode(schoolId, schoolYearId, cohortCode) {
    return prisma.instructionalCohort.findFirst({
        where: { schoolId, schoolYearId, cohortCode },
    });
}
//# sourceMappingURL=cohort.service.js.map