import { prisma } from '../lib/prisma.js';
import { syncFacultyFromExternal } from './faculty.service.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';
import { syncSectionsFromExternal } from './section.service.js';
import { fetchEnrollProActiveSchoolYear } from './section-adapter.js';
const ENROLLPRO_BASE_URL = process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
const SCHOOL_YEAR_ENDPOINT = '/integration/v1/school-year';
const SECTION_ENDPOINT = '/integration/v1/sections';
const FACULTY_ENDPOINTS = ['/integration/v1/faculty', '/integration/v1/default/faculty'];
const PUBLIC_SETTINGS_ENDPOINT = '/settings/public';
function serviceError(statusCode, code, message, options) {
    return Object.assign(new Error(message), {
        statusCode,
        code,
        actionHint: options?.actionHint,
        details: options?.details,
    });
}
function authHeaders(authToken) {
    const token = authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
    return token ? { Authorization: `Bearer ${token}` } : undefined;
}
async function fetchJson(path, authToken) {
    const res = await fetch(`${ENROLLPRO_BASE_URL}${path}`, {
        headers: authHeaders(authToken),
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
        throw serviceError(res.status, 'UPSTREAM_ERROR', `EnrollPro ${path} returned ${res.status}.`, {
            details: { path, status: res.status, statusText: res.statusText },
        });
    }
    return res.json();
}
function extractRows(payload) {
    if (!payload || typeof payload !== 'object')
        return [];
    const candidate = payload;
    if (Array.isArray(candidate.data))
        return candidate.data;
    if (Array.isArray(candidate.gradeLevels)) {
        return candidate.gradeLevels.flatMap((grade) => Array.isArray(grade.sections) ? grade.sections : []);
    }
    return [];
}
function extractTotalPages(payload) {
    if (!payload || typeof payload !== 'object')
        return null;
    const meta = payload.meta;
    const totalPages = Number(meta?.totalPages);
    return Number.isInteger(totalPages) && totalPages > 0 ? totalPages : null;
}
async function fetchPaginatedRows(paths, authToken) {
    let lastError = null;
    for (const path of paths) {
        try {
            const rows = [];
            const pageSize = 200;
            let page = 1;
            let totalPages = 1;
            while (page <= totalPages) {
                const separator = path.includes('?') ? '&' : '?';
                const payload = await fetchJson(`${path}${separator}page=${page}&limit=${pageSize}`, authToken);
                const pageRows = extractRows(payload);
                rows.push(...pageRows);
                const reportedTotalPages = extractTotalPages(payload);
                totalPages = reportedTotalPages ?? (pageRows.length < pageSize ? page : page + 1);
                page += 1;
            }
            return { rows, sourcePath: path };
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError instanceof Error ? lastError : serviceError(502, 'UPSTREAM_ERROR', 'EnrollPro feed could not be read.');
}
function rowExternalIds(rows) {
    const ids = new Set();
    for (const row of rows) {
        if (!row || typeof row !== 'object')
            continue;
        const candidate = row;
        const id = Number(candidate.id ?? candidate.teacherId);
        if (Number.isInteger(id) && id > 0)
            ids.add(id);
    }
    return ids;
}
async function fetchRolloverCounts(authToken) {
    const [sections, faculty, settings] = await Promise.allSettled([
        fetchPaginatedRows([SECTION_ENDPOINT], authToken),
        fetchPaginatedRows(FACULTY_ENDPOINTS, authToken),
        fetchJson(PUBLIC_SETTINGS_ENDPOINT, authToken),
    ]);
    if (sections.status === 'rejected')
        throw sections.reason;
    if (faculty.status === 'rejected')
        throw faculty.reason;
    return {
        sectionCount: sections.value.rows.length,
        facultyCount: faculty.value.rows.length,
        settingsReachable: settings.status === 'fulfilled',
        sectionExternalIds: rowExternalIds(sections.value.rows),
        sources: {
            sections: sections.value.sourcePath,
            faculty: faculty.value.sourcePath,
            settings: PUBLIC_SETTINGS_ENDPOINT,
        },
    };
}
function buildDriftState(input) {
    if (!input.upstreamReachable || !input.upstreamYear) {
        return {
            status: 'enrollpro-unreachable',
            message: 'EnrollPro active school year could not be verified. ATLAS will keep using saved setup data until the source is reachable.',
            recommendedAction: 'RETRY_ENROLLPRO',
            atlasSchoolYearId: input.atlasSchoolYearId,
            enrollProSchoolYearId: null,
            enrollProSchoolYearLabel: null,
            mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
        };
    }
    if (input.hasMappingConflict) {
        return {
            status: 'mapping-conflict',
            message: `EnrollPro active school year ${input.upstreamYear.yearLabel} conflicts with existing ATLAS year data. Review migration before syncing.`,
            recommendedAction: 'REVIEW_MAPPING_CONFLICT',
            atlasSchoolYearId: input.atlasSchoolYearId,
            enrollProSchoolYearId: input.upstreamYear.id,
            enrollProSchoolYearLabel: input.upstreamYear.yearLabel,
            mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
        };
    }
    if (input.atlasSchoolYearId !== input.upstreamYear.id) {
        return {
            status: 'atlas-stale',
            message: `EnrollPro is now on ${input.upstreamYear.yearLabel}. Sync the new school year before creating a timetable.`,
            recommendedAction: 'RUN_ROLLOVER_SYNC',
            atlasSchoolYearId: input.atlasSchoolYearId,
            enrollProSchoolYearId: input.upstreamYear.id,
            enrollProSchoolYearLabel: input.upstreamYear.yearLabel,
            mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
        };
    }
    return {
        status: 'aligned',
        message: `ATLAS is aligned with EnrollPro ${input.upstreamYear.yearLabel}.`,
        recommendedAction: 'NONE',
        atlasSchoolYearId: input.atlasSchoolYearId,
        enrollProSchoolYearId: input.upstreamYear.id,
        enrollProSchoolYearLabel: input.upstreamYear.yearLabel,
        mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
    };
}
async function findMappingConflicts(schoolId, upstreamYear, sectionExternalIds) {
    const conflicts = [];
    const mirror = await prisma.enrollProSchoolYearMirror.findUnique({
        where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: upstreamYear.id } },
        select: { yearLabel: true },
    });
    if (mirror && mirror.yearLabel !== upstreamYear.yearLabel) {
        conflicts.push({
            code: 'YEAR_LABEL_MISMATCH',
            message: `ATLAS already mirrors EnrollPro year ${upstreamYear.id} as ${mirror.yearLabel}, not ${upstreamYear.yearLabel}.`,
            details: { existingYearLabel: mirror.yearLabel, enrollProYearLabel: upstreamYear.yearLabel },
        });
    }
    if (sectionExternalIds && sectionExternalIds.size > 0) {
        const existingSections = await prisma.sectionMirror.findMany({
            where: { schoolId, schoolYearId: upstreamYear.id },
            select: { externalId: true },
            take: 500,
        });
        if (existingSections.length > 0) {
            const overlap = existingSections.filter((section) => sectionExternalIds.has(section.externalId)).length;
            if (overlap === 0) {
                conflicts.push({
                    code: 'SECTION_ID_COLLISION',
                    message: `ATLAS already has section data for school year #${upstreamYear.id}, but it does not match EnrollPro ${upstreamYear.yearLabel}.`,
                    details: { existingSectionCount: existingSections.length, enrollProSectionCount: sectionExternalIds.size },
                });
            }
        }
    }
    return conflicts;
}
async function getLatestAtlasSchoolYearId(schoolId) {
    const [mirror, sectionSnapshot, generationRun] = await Promise.all([
        prisma.enrollProSchoolYearMirror.findFirst({
            where: { schoolId, isActive: true },
            orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
            select: { enrollProSchoolYearId: true },
        }),
        prisma.sectionSnapshot.findFirst({
            where: { schoolId },
            orderBy: { fetchedAt: 'desc' },
            select: { schoolYearId: true },
        }),
        prisma.generationRun.findFirst({
            where: { schoolId },
            orderBy: { createdAt: 'desc' },
            select: { schoolYearId: true },
        }),
    ]);
    return mirror?.enrollProSchoolYearId ?? sectionSnapshot?.schoolYearId ?? generationRun?.schoolYearId ?? null;
}
export async function getRolloverStatus(schoolId, authToken, options) {
    const atlasSchoolYearId = options?.atlasSchoolYearId ?? await getLatestAtlasSchoolYearId(schoolId);
    const upstreamYear = await fetchEnrollProActiveSchoolYear(authToken);
    const mirror = upstreamYear
        ? await prisma.enrollProSchoolYearMirror.findUnique({
            where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: upstreamYear.id } },
        })
        : null;
    let counts;
    let conflicts = [];
    if (upstreamYear && options?.includeCounts) {
        const feedCounts = await fetchRolloverCounts(authToken);
        counts = {
            facultyCount: feedCounts.facultyCount,
            sectionCount: feedCounts.sectionCount,
            settingsReachable: feedCounts.settingsReachable,
        };
        conflicts = await findMappingConflicts(schoolId, upstreamYear, feedCounts.sectionExternalIds);
    }
    else if (upstreamYear) {
        conflicts = await findMappingConflicts(schoolId, upstreamYear);
    }
    const drift = buildDriftState({
        atlasSchoolYearId,
        upstreamYear,
        upstreamReachable: !!upstreamYear,
        hasMappingConflict: conflicts.length > 0,
        mirrorSyncedAt: mirror?.lastSyncedAt ?? null,
    });
    return {
        schoolId,
        atlasSchoolYearId,
        enrollProActiveYear: upstreamYear,
        drift,
        mirror: mirror ? {
            enrollProSchoolYearId: mirror.enrollProSchoolYearId,
            yearLabel: mirror.yearLabel,
            isActive: mirror.isActive,
            lastVerifiedAt: mirror.lastVerifiedAt?.toISOString() ?? null,
            lastSyncedAt: mirror.lastSyncedAt?.toISOString() ?? null,
            facultyCount: mirror.facultyCount,
            sectionCount: mirror.sectionCount,
            syncStatus: mirror.syncStatus,
            lastFailureSummary: mirror.lastFailureSummary,
        } : null,
        ...(counts ? { counts } : {}),
        conflicts,
    };
}
export async function previewRolloverSync(schoolId, authToken) {
    return getRolloverStatus(schoolId, authToken, { includeCounts: true });
}
export async function applyRolloverSync(schoolId, authToken) {
    const preview = await previewRolloverSync(schoolId, authToken);
    if (!preview.enrollProActiveYear) {
        throw serviceError(503, 'ENROLLPRO_UNAVAILABLE', 'EnrollPro active school year could not be verified. Try again when EnrollPro is reachable.', {
            actionHint: 'Check EnrollPro connection, then run rollover sync again.',
        });
    }
    if (preview.conflicts.length > 0) {
        throw serviceError(409, 'SCHOOL_YEAR_MAPPING_CONFLICT', 'ATLAS found existing data that conflicts with the EnrollPro active school year.', {
            actionHint: 'Review the migration conflict before syncing EnrollPro into ATLAS.',
            details: { conflicts: preview.conflicts },
        });
    }
    const activeYear = preview.enrollProActiveYear;
    let facultySync = null;
    let sectionSync = null;
    try {
        facultySync = await syncFacultyFromExternal(schoolId, activeYear.id, authToken, {
            mode: 'reconcile',
            pruneSectionAssignments: false,
            invalidateRuns: false,
        });
        sectionSync = await syncSectionsFromExternal(schoolId, activeYear.id, authToken);
        const completedFacultySync = facultySync;
        const completedSectionSync = sectionSync;
        await getOrCreatePolicy(schoolId, activeYear.id);
        const syncedAt = new Date();
        await prisma.$transaction(async (tx) => {
            await tx.enrollProSchoolYearMirror.updateMany({
                where: { schoolId, isActive: true, enrollProSchoolYearId: { not: activeYear.id } },
                data: { isActive: false },
            });
            await tx.enrollProSchoolYearMirror.upsert({
                where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: activeYear.id } },
                update: {
                    yearLabel: activeYear.yearLabel,
                    isActive: true,
                    lastVerifiedAt: syncedAt,
                    lastSyncedAt: syncedAt,
                    sourceEndpoint: SCHOOL_YEAR_ENDPOINT,
                    facultyCount: completedFacultySync.activeCount,
                    sectionCount: completedSectionSync.count,
                    syncStatus: 'setup-review-required',
                    lastFailureSummary: null,
                    lastSyncMetadata: {
                        sectionsRemovedForSameYear: completedSectionSync.removed,
                        facultyStaleCount: completedFacultySync.staleCount,
                        facultyDeactivatedCount: completedFacultySync.deactivatedCount,
                        settingsReachable: preview.counts?.settingsReachable ?? null,
                        teachingLoadAutoCopied: false,
                    },
                },
                create: {
                    schoolId,
                    enrollProSchoolYearId: activeYear.id,
                    yearLabel: activeYear.yearLabel,
                    isActive: true,
                    lastVerifiedAt: syncedAt,
                    lastSyncedAt: syncedAt,
                    sourceEndpoint: SCHOOL_YEAR_ENDPOINT,
                    facultyCount: completedFacultySync.activeCount,
                    sectionCount: completedSectionSync.count,
                    syncStatus: 'setup-review-required',
                    lastSyncMetadata: {
                        sectionsRemovedForSameYear: completedSectionSync.removed,
                        facultyStaleCount: completedFacultySync.staleCount,
                        facultyDeactivatedCount: completedFacultySync.deactivatedCount,
                        settingsReachable: preview.counts?.settingsReachable ?? null,
                        teachingLoadAutoCopied: false,
                    },
                },
            });
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.enrollProSchoolYearMirror.upsert({
            where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: activeYear.id } },
            update: {
                yearLabel: activeYear.yearLabel,
                isActive: false,
                lastVerifiedAt: new Date(),
                sourceEndpoint: SCHOOL_YEAR_ENDPOINT,
                syncStatus: 'failed',
                lastFailureSummary: message.slice(0, 500),
            },
            create: {
                schoolId,
                enrollProSchoolYearId: activeYear.id,
                yearLabel: activeYear.yearLabel,
                isActive: false,
                lastVerifiedAt: new Date(),
                sourceEndpoint: SCHOOL_YEAR_ENDPOINT,
                syncStatus: 'failed',
                lastFailureSummary: message.slice(0, 500),
            },
        });
        throw error;
    }
    const status = await getRolloverStatus(schoolId, authToken, {
        includeCounts: true,
        atlasSchoolYearId: activeYear.id,
    });
    return {
        ...status,
        applied: true,
        sync: {
            faculty: facultySync,
            sections: sectionSync,
            policyReady: true,
        },
    };
}
