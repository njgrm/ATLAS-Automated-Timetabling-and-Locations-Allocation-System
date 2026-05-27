import { prisma } from '../lib/prisma.js';
import { fetchEnrollProActiveSchoolYear } from './section-adapter.js';
const CONTEXT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const EVIDENCE_FRESHNESS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const EVIDENCE_TYPE_WEIGHT = {
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
export async function resolveRuntimeContext(schoolId, authToken) {
    const [policy, mirror, sectionSnapshot, facultySnapshot, generationRun] = await Promise.all([
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
    try {
        const upstreamYear = await fetchEnrollProActiveSchoolYear(authToken);
        if (upstreamYear) {
            upstreamReachable = true;
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
        }
    }
    catch {
        // Keep atlas-persisted context when upstream is unavailable.
    }
    const stale = Date.now() - selected.timestamp.getTime() > CONTEXT_STALE_THRESHOLD_MS;
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
        },
    };
}
//# sourceMappingURL=runtime-context.service.js.map