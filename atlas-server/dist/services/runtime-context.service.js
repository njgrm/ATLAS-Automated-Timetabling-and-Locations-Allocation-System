import { prisma } from '../lib/prisma.js';
import { findMappingConflicts, fetchSectionExternalIds, resolveMappingConflictAction } from './enrollpro-rollover.service.js';
import { fetchEnrollProActiveSchoolYear } from './section-adapter.js';
import { fetchEnrollProActiveTerm } from './active-term-adapter.service.js';
const CONTEXT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const EVIDENCE_FRESHNESS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const EVIDENCE_TYPE_WEIGHT = {
    'school-year-mirror': 120,
    'section-mirror': 100,
    'section-snapshot': 90,
    'faculty-snapshot': 75,
    'generation-run': 60,
    'scheduling-policy': 40,
};
function calculateEvidenceScore(evidence, nowMs) {
    const baseWeight = EVIDENCE_TYPE_WEIGHT[evidence.type];
    const ageMs = Math.max(0, nowMs - evidence.timestamp.getTime());
    const freshnessRatio = Math.max(0, 1 - ageMs / EVIDENCE_FRESHNESS_WINDOW_MS);
    const freshnessMultiplier = 0.5 + freshnessRatio;
    return baseWeight * freshnessMultiplier;
}
function rankRuntimeYears(evidence) {
    if (evidence.length === 0)
        return [];
    const nowMs = Date.now();
    const grouped = new Map();
    for (const item of evidence) {
        const entries = grouped.get(item.yearId);
        if (entries) {
            entries.push(item);
        }
        else {
            grouped.set(item.yearId, [item]);
        }
    }
    const ranked = [];
    for (const [yearId, entries] of grouped) {
        const latest = entries.reduce((current, candidate) => (candidate.timestamp.getTime() > current.timestamp.getTime() ? candidate : current));
        const strongestWeight = entries.reduce((current, candidate) => {
            const candidateWeight = EVIDENCE_TYPE_WEIGHT[candidate.type];
            return candidateWeight > current ? candidateWeight : current;
        }, 0);
        const scoreFromSignals = entries.reduce((total, item) => total + calculateEvidenceScore(item, nowMs), 0);
        const consensusBonus = Math.max(0, entries.length - 1) * 10;
        ranked.push({
            yearId,
            score: scoreFromSignals + consensusBonus,
            strongestWeight,
            evidenceCount: entries.length,
            latestTimestamp: latest.timestamp,
            representative: latest,
        });
    }
    ranked.sort((left, right) => {
        if (right.score !== left.score)
            return right.score - left.score;
        if (right.strongestWeight !== left.strongestWeight)
            return right.strongestWeight - left.strongestWeight;
        if (right.evidenceCount !== left.evidenceCount)
            return right.evidenceCount - left.evidenceCount;
        return right.latestTimestamp.getTime() - left.latestTimestamp.getTime();
    });
    return ranked;
}
export function pickBestRuntimeYear(evidence) {
    return rankRuntimeYears(evidence)[0]?.representative ?? null;
}
function buildActiveYearDrift(input) {
    if (input.mappingConflict) {
        const action = resolveMappingConflictAction(input.publishedResetBlocked ?? false);
        return {
            status: 'mapping-conflict',
            message: action.message,
            recommendedAction: action.recommendedAction,
            atlasSchoolYearId: input.selectedYearId,
            enrollProSchoolYearId: input.upstreamYearId,
            enrollProSchoolYearLabel: input.upstreamYearLabel,
            mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
        };
    }
    if (!input.upstreamReachable && input.verifyUpstream) {
        return {
            status: 'enrollpro-unreachable',
            message: 'EnrollPro active school year could not be verified. ATLAS is using saved setup data for now.',
            recommendedAction: 'RETRY_ENROLLPRO',
            atlasSchoolYearId: input.selectedYearId,
            enrollProSchoolYearId: null,
            enrollProSchoolYearLabel: null,
            mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
        };
    }
    if (!input.upstreamYearId) {
        return {
            status: input.verifyUpstream ? 'enrollpro-unreachable' : 'aligned',
            message: input.verifyUpstream
                ? 'EnrollPro active school year could not be verified. ATLAS is using saved setup data for now.'
                : 'ATLAS is using saved setup data. Verify EnrollPro when preparing a new school year.',
            recommendedAction: input.verifyUpstream ? 'RETRY_ENROLLPRO' : 'NONE',
            atlasSchoolYearId: input.selectedYearId,
            enrollProSchoolYearId: null,
            enrollProSchoolYearLabel: null,
            mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
        };
    }
    if (input.selectedYearId !== input.upstreamYearId) {
        return {
            status: 'atlas-stale',
            message: `EnrollPro is now on ${input.upstreamYearLabel ?? `school year #${input.upstreamYearId}`}. Sync the new school year before creating a timetable.`,
            recommendedAction: 'RUN_ROLLOVER_SYNC',
            atlasSchoolYearId: input.selectedYearId,
            enrollProSchoolYearId: input.upstreamYearId,
            enrollProSchoolYearLabel: input.upstreamYearLabel,
            mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
        };
    }
    return {
        status: 'aligned',
        message: `ATLAS is aligned with ${input.upstreamYearLabel ?? `school year #${input.upstreamYearId}`}.`,
        recommendedAction: 'NONE',
        atlasSchoolYearId: input.selectedYearId,
        enrollProSchoolYearId: input.upstreamYearId,
        enrollProSchoolYearLabel: input.upstreamYearLabel,
        mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
    };
}
export async function resolveRuntimeContext(schoolId, authToken, options) {
    const [schoolYearMirror, policy, mirror, sectionSnapshot, facultySnapshot, generationRun] = await Promise.all([
        prisma.enrollProSchoolYearMirror.findFirst({
            where: { schoolId, isActive: true },
            orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
            select: {
                enrollProSchoolYearId: true,
                yearLabel: true,
                lastVerifiedAt: true,
                lastSyncedAt: true,
                isActive: true,
                facultyCount: true,
                sectionCount: true,
                syncStatus: true,
                lastFailureSummary: true,
            },
        }),
        prisma.schedulingPolicy.findFirst({
            where: { schoolId },
            orderBy: [{ updatedAt: 'desc' }],
            select: { schoolYearId: true, updatedAt: true },
        }),
        prisma.sectionMirror.findFirst({
            where: { schoolId, isStale: false },
            orderBy: [{ lastSyncedAt: 'desc' }],
            select: { schoolYearId: true, lastSyncedAt: true },
        }),
        prisma.sectionSnapshot.findFirst({
            where: { schoolId },
            orderBy: [{ fetchedAt: 'desc' }],
            select: { schoolYearId: true, fetchedAt: true, source: true },
        }),
        prisma.facultySnapshot.findFirst({
            where: { schoolId },
            orderBy: [{ fetchedAt: 'desc' }],
            select: { schoolYearId: true, fetchedAt: true, source: true },
        }),
        prisma.generationRun.findFirst({
            where: { schoolId },
            orderBy: [{ createdAt: 'desc' }],
            select: { schoolYearId: true, createdAt: true },
        }),
    ]);
    const evidence = [];
    if (schoolYearMirror) {
        evidence.push({
            yearId: schoolYearMirror.enrollProSchoolYearId,
            timestamp: schoolYearMirror.lastSyncedAt ?? schoolYearMirror.lastVerifiedAt ?? new Date(0),
            type: 'school-year-mirror',
            source: 'atlas.enrollpro_school_year_mirror',
        });
    }
    if (policy) {
        evidence.push({
            yearId: policy.schoolYearId,
            timestamp: policy.updatedAt,
            type: 'scheduling-policy',
            source: 'atlas.scheduling_policy',
        });
    }
    if (mirror) {
        evidence.push({
            yearId: mirror.schoolYearId,
            timestamp: mirror.lastSyncedAt,
            type: 'section-mirror',
            source: 'atlas.section_mirror',
        });
    }
    if (sectionSnapshot) {
        evidence.push({
            yearId: sectionSnapshot.schoolYearId,
            timestamp: sectionSnapshot.fetchedAt,
            type: 'section-snapshot',
            source: `atlas.section_snapshot:${sectionSnapshot.source}`,
        });
    }
    if (facultySnapshot) {
        evidence.push({
            yearId: facultySnapshot.schoolYearId,
            timestamp: facultySnapshot.fetchedAt,
            type: 'faculty-snapshot',
            source: `atlas.faculty_snapshot:${facultySnapshot.source}`,
        });
    }
    if (generationRun) {
        evidence.push({
            yearId: generationRun.schoolYearId,
            timestamp: generationRun.createdAt,
            type: 'generation-run',
            source: 'atlas.generation_run',
        });
    }
    const rankedYears = rankRuntimeYears(evidence);
    let selectedRank = rankedYears[0] ?? null;
    if (!selectedRank)
        return null;
    let selected = selectedRank.representative;
    let source = 'atlas-persisted';
    let activeSchoolYearLabel = null;
    let upstreamReachable = false;
    let upstreamVerified = false;
    let upstreamMatched = null;
    let upstreamActiveSchoolYearId = schoolYearMirror?.enrollProSchoolYearId ?? null;
    let upstreamActiveSchoolYearLabel = schoolYearMirror?.yearLabel ?? null;
    let mappingConflict = false;
    const verifyUpstream = options?.verifyUpstream !== false;
    let activeTermResult = {
        source: 'atlas-unverified',
        reachable: false,
        verified: false,
        activeTerm: null,
        termIndex: null,
        schoolYearId: null,
        matchedSchoolYear: null,
        code: null,
        message: 'Active term verification not requested.',
    };
    if (verifyUpstream) {
        // Fetch school year and active term in parallel — each is independent
        const [upstreamYear, activeTermResponse] = await Promise.all([
            fetchEnrollProActiveSchoolYear(authToken).catch(() => null),
            fetchEnrollProActiveTerm(authToken).catch(() => null),
        ]);
        // Process active term result (independent of school year)
        if (activeTermResponse) {
            activeTermResult = activeTermResponse;
        }
        else {
            activeTermResult = {
                source: 'enrollpro-unreachable',
                reachable: false,
                verified: false,
                activeTerm: null,
                termIndex: null,
                schoolYearId: null,
                matchedSchoolYear: null,
                code: null,
                message: 'EnrollPro active-term endpoint is unreachable.',
            };
        }
        // Process school year result
        if (upstreamYear) {
            upstreamReachable = true;
            upstreamActiveSchoolYearId = upstreamYear.id;
            upstreamActiveSchoolYearLabel = upstreamYear.yearLabel;
            // Use shared conflict detection that checks both YEAR_LABEL_MISMATCH
            // and SECTION_ID_COLLISION (consistent with rollover-status endpoint)
            let sectionExternalIds;
            try {
                sectionExternalIds = await fetchSectionExternalIds(authToken);
            }
            catch {
                // If we can't fetch section IDs, skip the collision check
                // (the YEAR_LABEL_MISMATCH check still runs)
            }
            const conflicts = await findMappingConflicts(schoolId, upstreamYear, sectionExternalIds);
            mappingConflict = conflicts.length > 0;
            const upstreamRank = rankedYears.find((entry) => entry.yearId === upstreamYear.id) ?? null;
            if (upstreamRank && selectedRank) {
                const strongerSignal = upstreamRank.strongestWeight > selectedRank.strongestWeight;
                const competitiveScore = upstreamRank.score >= selectedRank.score * 0.9;
                if (strongerSignal || competitiveScore) {
                    selectedRank = upstreamRank;
                    selected = upstreamRank.representative;
                }
            }
            upstreamMatched = upstreamYear.id === selected.yearId;
            if (upstreamMatched) {
                source = 'enrollpro-verified';
                upstreamVerified = true;
                activeSchoolYearLabel = upstreamYear.yearLabel;
            }
            // Update matchedSchoolYear now that we have both school year and active term
            if (activeTermResult.source !== 'atlas-unverified' && activeTermResult.schoolYearId !== null) {
                activeTermResult.matchedSchoolYear = activeTermResult.schoolYearId === upstreamYear.id;
                if (activeTermResult.matchedSchoolYear === true) {
                    activeTermResult.message = `ATLAS is aligned with EnrollPro active term ${activeTermResult.activeTerm}.`;
                }
                else if (activeTermResult.matchedSchoolYear === false) {
                    activeTermResult.message = `EnrollPro active term ${activeTermResult.activeTerm} is from a different school year (expected ${upstreamYear.id}, got ${activeTermResult.schoolYearId}).`;
                }
            }
        }
    }
    const stale = Date.now() - selected.timestamp.getTime() > CONTEXT_STALE_THRESHOLD_MS;
    if (!activeSchoolYearLabel && schoolYearMirror?.enrollProSchoolYearId === selected.yearId) {
        activeSchoolYearLabel = schoolYearMirror.yearLabel;
    }
    let publishedResetBlocked = false;
    if (mappingConflict && upstreamActiveSchoolYearId) {
        const [generationRuns, publishedRevisions] = await Promise.all([
            prisma.generationRun.findMany({
                where: { schoolId, schoolYearId: upstreamActiveSchoolYearId },
                select: { summary: true },
            }),
            prisma.publishedScheduleRevision.count({
                where: { schoolId, schoolYearId: upstreamActiveSchoolYearId },
            }),
        ]);
        const publishedRuns = generationRuns.filter((run) => {
            const summary = run.summary;
            if (!summary || typeof summary !== 'object')
                return false;
            const candidate = summary;
            return candidate.isPublished === true
                || (typeof candidate.publishedAt === 'string' && candidate.publishedAt.length > 0)
                || typeof candidate.publishedBy === 'number';
        }).length;
        publishedResetBlocked = publishedRuns > 0 || publishedRevisions > 0;
    }
    const activeYearDrift = buildActiveYearDrift({
        selectedYearId: selected.yearId,
        upstreamYearId: upstreamActiveSchoolYearId,
        upstreamYearLabel: upstreamActiveSchoolYearLabel,
        upstreamReachable,
        mappingConflict,
        publishedResetBlocked,
        mirrorSyncedAt: schoolYearMirror?.lastSyncedAt ?? null,
        verifyUpstream,
    });
    return {
        schoolId,
        activeSchoolYearId: selected.yearId,
        activeSchoolYearLabel,
        source,
        stale,
        resolvedAt: new Date().toISOString(),
        evidence: evidence
            .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
            .map((item) => ({
            type: item.type,
            schoolYearId: item.yearId,
            timestamp: item.timestamp.toISOString(),
            source: item.source,
        })),
        upstream: {
            reachable: upstreamReachable,
            verified: upstreamVerified,
            matched: upstreamMatched,
            activeSchoolYearId: upstreamActiveSchoolYearId,
            activeSchoolYearLabel: upstreamActiveSchoolYearLabel,
        },
        activeYearDrift,
        rollover: {
            mirror: schoolYearMirror ? {
                enrollProSchoolYearId: schoolYearMirror.enrollProSchoolYearId,
                yearLabel: schoolYearMirror.yearLabel,
                isActive: schoolYearMirror.isActive,
                lastVerifiedAt: schoolYearMirror.lastVerifiedAt?.toISOString() ?? null,
                lastSyncedAt: schoolYearMirror.lastSyncedAt?.toISOString() ?? null,
                facultyCount: schoolYearMirror.facultyCount,
                sectionCount: schoolYearMirror.sectionCount,
                syncStatus: schoolYearMirror.syncStatus,
                lastFailureSummary: schoolYearMirror.lastFailureSummary,
            } : null,
        },
        activeTerm: activeTermResult,
    };
}
//# sourceMappingURL=runtime-context.service.js.map