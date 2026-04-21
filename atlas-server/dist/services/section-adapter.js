/**
 * Section adapter interface and implementations.
 * Wave 3.5: Special program support + durable cache.
 *
 * Source metadata is always returned so callers can surface live vs fallback state.
 */
import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';
const PROGRAM_METADATA_BY_UPSTREAM_TYPE = {
    REGULAR: {
        programType: 'REGULAR',
        programCode: 'REGULAR',
        programName: 'Regular',
        admissionMode: 'REGULAR',
        isSpecialProgram: false,
    },
    SCIENCE_TECHNOLOGY_AND_ENGINEERING: {
        programType: 'STE',
        programCode: 'STE',
        programName: 'Science, Technology & Engineering',
        admissionMode: 'SCP',
        isSpecialProgram: true,
    },
    SPECIAL_PROGRAM_IN_THE_ARTS: {
        programType: 'SPA',
        programCode: 'SPA',
        programName: 'Special Program in the Arts',
        admissionMode: 'SCP',
        isSpecialProgram: true,
    },
    SPECIAL_PROGRAM_IN_SPORTS: {
        programType: 'SPS',
        programCode: 'SPS',
        programName: 'Special Program in Sports',
        admissionMode: 'SCP',
        isSpecialProgram: true,
    },
    SPECIAL_PROGRAM_IN_JOURNALISM: {
        programType: 'SPJ',
        programCode: 'SPJ',
        programName: 'Special Program in Journalism',
        admissionMode: 'SCP',
        isSpecialProgram: true,
    },
    SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: {
        programType: 'SPFL',
        programCode: 'SPFL',
        programName: 'Special Program in Foreign Language',
        admissionMode: 'SCP',
        isSpecialProgram: true,
    },
    SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: {
        programType: 'SPTVE',
        programCode: 'SPTVE',
        programName: 'Special Program in Tech-Voc Education',
        admissionMode: 'SCP',
        isSpecialProgram: true,
    },
};
function humanizeProgramType(rawProgramType) {
    return rawProgramType
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
export function normalizeProgramMetadata(rawProgramType, warnings) {
    const upstreamProgramType = typeof rawProgramType === 'string' && rawProgramType.trim().length > 0
        ? rawProgramType.trim().toUpperCase()
        : 'REGULAR';
    const known = PROGRAM_METADATA_BY_UPSTREAM_TYPE[upstreamProgramType];
    if (known) {
        return { ...known, upstreamProgramType };
    }
    warnings?.push(`Unknown section programType "${String(rawProgramType)}" received from EnrollPro; normalizing as OTHER.`);
    return {
        programType: 'OTHER',
        programCode: upstreamProgramType,
        programName: humanizeProgramType(upstreamProgramType),
        admissionMode: upstreamProgramType === 'REGULAR' ? 'REGULAR' : 'SCP',
        isSpecialProgram: upstreamProgramType !== 'REGULAR',
        upstreamProgramType,
    };
}
function normalizeAdviser(advisingTeacher, sectionName, warnings) {
    if (advisingTeacher == null) {
        return { adviserId: null, adviserName: null };
    }
    if (typeof advisingTeacher !== 'object') {
        warnings?.push(`Section "${sectionName}" returned a non-object advisingTeacher payload; adviser mapping skipped.`);
        return { adviserId: null, adviserName: null };
    }
    const teacher = advisingTeacher;
    const adviserId = typeof teacher.id === 'number' ? teacher.id : null;
    const adviserName = typeof teacher.name === 'string' && teacher.name.trim().length > 0 ? teacher.name.trim() : null;
    if (adviserId == null && adviserName != null) {
        warnings?.push(`Section "${sectionName}" included adviser name without adviser id; adviser linkage is informational only.`);
    }
    return { adviserId, adviserName };
}
export function normalizeEnrollProSectionsResponse(body) {
    const warnings = [];
    if (!body || typeof body !== 'object') {
        warnings.push('EnrollPro sections response was not an object; returning an empty section payload.');
        return { gradeLevels: [], warnings };
    }
    const payload = body;
    if (!Array.isArray(payload.gradeLevels)) {
        warnings.push('EnrollPro sections response did not include a gradeLevels array; returning an empty section payload.');
        return { gradeLevels: [], warnings };
    }
    const gradeLevels = payload.gradeLevels
        .filter((gradeLevel) => gradeLevel && typeof gradeLevel === 'object')
        .map((gradeLevel) => {
        const gradeLevelId = typeof gradeLevel.gradeLevelId === 'number' ? gradeLevel.gradeLevelId : 0;
        const gradeLevelName = typeof gradeLevel.gradeLevelName === 'string' && gradeLevel.gradeLevelName.trim().length > 0
            ? gradeLevel.gradeLevelName.trim()
            : `Grade ${gradeLevel.displayOrder ?? gradeLevelId}`;
        const displayOrder = typeof gradeLevel.displayOrder === 'number' ? gradeLevel.displayOrder : gradeLevelId;
        if (!Array.isArray(gradeLevel.sections)) {
            warnings.push(`Grade level "${gradeLevelName}" did not include a sections array; treating it as empty.`);
        }
        const sections = (gradeLevel.sections ?? [])
            .filter((section) => section && typeof section === 'object')
            .map((section) => {
            const sectionId = typeof section.id === 'number' ? section.id : 0;
            const sectionName = typeof section.name === 'string' && section.name.trim().length > 0
                ? section.name.trim()
                : `Section ${sectionId}`;
            const program = normalizeProgramMetadata(section.programType, warnings);
            const adviser = normalizeAdviser(section.advisingTeacher, sectionName, warnings);
            return {
                id: sectionId,
                name: sectionName,
                maxCapacity: typeof section.maxCapacity === 'number' ? section.maxCapacity : 0,
                enrolledCount: typeof section.enrolledCount === 'number' ? section.enrolledCount : 0,
                gradeLevelId,
                gradeLevelName,
                displayOrder,
                programType: program.programType,
                programCode: program.programCode,
                programName: program.programName,
                admissionMode: program.admissionMode,
                adviserId: adviser.adviserId,
                adviserName: adviser.adviserName,
                upstreamProgramType: program.upstreamProgramType,
                isSpecialProgram: program.isSpecialProgram,
            };
        });
        return {
            gradeLevelId,
            gradeLevelName,
            displayOrder,
            sections,
        };
    });
    return { gradeLevels, warnings };
}
// ─── Cache helpers ───
function computeChecksum(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
async function saveSectionSnapshot(schoolId, schoolYearId, data) {
    const checksum = computeChecksum(data.gradeLevels);
    await prisma.sectionSnapshot.upsert({
        where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
        update: {
            payload: data.gradeLevels,
            source: data.source,
            fetchedAt: data.fetchedAt,
            checksum,
        },
        create: {
            schoolId,
            schoolYearId,
            payload: data.gradeLevels,
            source: data.source,
            fetchedAt: data.fetchedAt,
            checksum,
        },
    });
}
async function loadSectionSnapshot(schoolId, schoolYearId) {
    const snapshot = await prisma.sectionSnapshot.findUnique({
        where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
    });
    if (!snapshot)
        return null;
    return {
        gradeLevels: snapshot.payload,
        fetchedAt: snapshot.fetchedAt,
    };
}
/* ─── Stub adapter ─── */
const STUB_SECTIONS = [
    {
        gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7,
        sections: [
            { id: 1, name: '7-Rizal', maxCapacity: 40, enrolledCount: 35, gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' },
            { id: 2, name: '7-Bonifacio', maxCapacity: 40, enrolledCount: 32, gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' },
            { id: 3, name: '7-STE', maxCapacity: 40, enrolledCount: 38, gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'STE', programCode: 'STE', programName: 'Science, Technology, and Engineering' },
        ],
    },
    {
        gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8,
        sections: [
            { id: 4, name: '8-Aquino', maxCapacity: 40, enrolledCount: 30, gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8, programType: 'REGULAR' },
            { id: 5, name: '8-Quezon', maxCapacity: 40, enrolledCount: 36, gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8, programType: 'REGULAR' },
            { id: 6, name: '8-STE', maxCapacity: 40, enrolledCount: 33, gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8, programType: 'STE', programCode: 'STE', programName: 'Science, Technology, and Engineering' },
        ],
    },
    {
        gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9,
        sections: [
            { id: 7, name: '9-Luna', maxCapacity: 40, enrolledCount: 28, gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9, programType: 'REGULAR' },
            { id: 8, name: '9-SPS', maxCapacity: 40, enrolledCount: 37, gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9, programType: 'SPS', programCode: 'SPS', programName: 'Special Program in Sports' },
        ],
    },
    {
        gradeLevelId: 4, gradeLevelName: 'Grade 10', displayOrder: 10,
        sections: [
            { id: 9, name: '10-Recto', maxCapacity: 40, enrolledCount: 34, gradeLevelId: 4, gradeLevelName: 'Grade 10', displayOrder: 10, programType: 'REGULAR' },
            { id: 10, name: '10-SPA', maxCapacity: 40, enrolledCount: 31, gradeLevelId: 4, gradeLevelName: 'Grade 10', displayOrder: 10, programType: 'SPA', programCode: 'SPA', programName: 'Special Program in the Arts' },
        ],
    },
];
export class StubSectionAdapter {
    async fetchSectionsBySchoolYear(_schoolYearId, _schoolId) {
        await new Promise((r) => setTimeout(r, 80));
        return { gradeLevels: STUB_SECTIONS, source: 'stub', fetchedAt: new Date() };
    }
}
/* ─── EnrollPro adapter ─── */
export class EnrollProSectionAdapter {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl ?? process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
    }
    async fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken) {
        const url = `${this.baseUrl}/sections/${schoolYearId}?level=JHS`;
        const token = authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
        const headers = { 'Content-Type': 'application/json' };
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw Object.assign(new Error(`EnrollPro sections API returned ${response.status}`), {
                statusCode: response.status,
                code: 'UPSTREAM_ERROR',
            });
        }
        const body = await response.json();
        const normalized = normalizeEnrollProSectionsResponse(body);
        const fetchedAt = new Date();
        const result = {
            gradeLevels: normalized.gradeLevels,
            source: 'enrollpro',
            fetchedAt,
            ...(normalized.warnings.length > 0 ? { contractWarnings: normalized.warnings } : {}),
        };
        // Auto-save snapshot for durable cache
        await saveSectionSnapshot(schoolId, schoolYearId, result);
        return result;
    }
}
function resolveSectionSourceMode() {
    const explicit = process.env.SECTION_SOURCE_MODE?.toLowerCase();
    if (explicit === 'stub' || explicit === 'enrollpro' || explicit === 'auto')
        return explicit;
    // Legacy compat
    const legacy = process.env.SECTION_ADAPTER ?? process.env.FACULTY_ADAPTER;
    if (legacy === 'stub')
        return 'stub';
    return 'auto'; // default
}
export const sectionSourceMode = resolveSectionSourceMode();
const strictUpstream = process.env.SECTION_STRICT_UPSTREAM?.toLowerCase() === 'true';
class AutoSectionAdapter {
    enrollpro = new EnrollProSectionAdapter();
    async fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken) {
        try {
            return await this.enrollpro.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            const errClass = error instanceof Error ? error.constructor.name : 'Unknown';
            // Structured warning log
            console.warn(JSON.stringify({
                level: 'WARN',
                event: 'section_adapter_fallback',
                schoolYearId,
                schoolId,
                errorClass: errClass,
                errorMessage: msg,
                ts: new Date().toISOString(),
            }));
            if (strictUpstream) {
                // In strict mode, do not silently fall back
                throw error;
            }
            // Wave 3.5: Try durable cache first before stub
            const cached = await loadSectionSnapshot(schoolId, schoolYearId);
            if (cached) {
                return {
                    gradeLevels: cached.gradeLevels,
                    source: 'cached-enrollpro',
                    fetchedAt: cached.fetchedAt,
                    fallbackReason: msg,
                    isStale: true,
                    contractWarnings: [
                        `EnrollPro sections source failed (${msg}); using cached section snapshot instead.`,
                    ],
                };
            }
            throw Object.assign(new Error(`UPSTREAM_UNAVAILABLE: EnrollPro sections source failed (${msg}) and no cached section snapshot exists.`), {
                code: 'UPSTREAM_UNAVAILABLE',
            });
        }
    }
}
function buildSectionAdapter(mode) {
    switch (mode) {
        case 'stub': return new StubSectionAdapter();
        case 'enrollpro': return new EnrollProSectionAdapter();
        case 'auto': return new AutoSectionAdapter();
    }
}
export const sectionAdapter = buildSectionAdapter(sectionSourceMode);
//# sourceMappingURL=section-adapter.js.map