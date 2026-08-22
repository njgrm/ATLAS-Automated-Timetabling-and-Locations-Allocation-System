import { prisma } from '../lib/prisma.js';
import { findMappingConflicts, fetchSectionExternalIds, resolveMappingConflictAction } from './enrollpro-rollover.service.js';
import { fetchEnrollProActiveSchoolYear } from './section-adapter.js';
import { fetchEnrollProActiveTerm, type ActiveTermResult } from './active-term-adapter.service.js';

type RuntimeContextEvidenceType =
	| 'school-year-mirror'
	| 'scheduling-policy'
	| 'section-mirror'
	| 'section-snapshot'
	| 'faculty-snapshot'
	| 'generation-run';

type RuntimeContextSource = 'atlas-persisted' | 'enrollpro-verified';
type RuntimeDriftStatus = 'aligned' | 'atlas-stale' | 'enrollpro-unreachable' | 'mapping-conflict';
type RuntimeDriftAction = 'NONE' | 'RUN_ROLLOVER_SYNC' | 'REVIEW_MAPPING_CONFLICT' | 'RETRY_ENROLLPRO' | 'RESET_DUMMY_YEAR';

export type RuntimeContextEvidence = {
	type: RuntimeContextEvidenceType;
	schoolYearId: number;
	timestamp: string;
	source: string;
};

export type RuntimeYearEvidence = {
	yearId: number;
	timestamp: Date;
	type: RuntimeContextEvidenceType;
	source: string;
};

export type RuntimeContextResult = {
	schoolId: number;
	activeSchoolYearId: number;
	activeSchoolYearLabel: string | null;
	source: RuntimeContextSource;
	stale: boolean;
	resolvedAt: string;
	evidence: RuntimeContextEvidence[];
	upstream: {
		reachable: boolean;
		verified: boolean;
		matched: boolean | null;
		activeSchoolYearId: number | null;
		activeSchoolYearLabel: string | null;
	};
	activeYearDrift: {
		status: RuntimeDriftStatus;
		message: string;
		recommendedAction: RuntimeDriftAction;
		atlasSchoolYearId: number | null;
		enrollProSchoolYearId: number | null;
		enrollProSchoolYearLabel: string | null;
		mirrorSyncedAt: string | null;
	};
	rollover: {
		mirror: {
			enrollProSchoolYearId: number;
			yearLabel: string;
			isActive: boolean;
			lastVerifiedAt: string | null;
			lastSyncedAt: string | null;
			facultyCount: number;
			sectionCount: number;
			syncStatus: string;
			lastFailureSummary: string | null;
		} | null;
	};
	activeTerm: ActiveTermResult;
};

type ResolveRuntimeContextOptions = {
	verifyUpstream?: boolean;
};

const CONTEXT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const EVIDENCE_FRESHNESS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const EVIDENCE_TYPE_WEIGHT: Record<RuntimeContextEvidenceType, number> = {
	'school-year-mirror': 120,
	'section-mirror': 100,
	'section-snapshot': 90,
	'faculty-snapshot': 75,
	'generation-run': 60,
	'scheduling-policy': 40,
};

type YearScore = {
	yearId: number;
	score: number;
	strongestWeight: number;
	evidenceCount: number;
	latestTimestamp: Date;
	representative: RuntimeYearEvidence;
};

function calculateEvidenceScore(evidence: RuntimeYearEvidence, nowMs: number): number {
	const baseWeight = EVIDENCE_TYPE_WEIGHT[evidence.type];
	const ageMs = Math.max(0, nowMs - evidence.timestamp.getTime());
	const freshnessRatio = Math.max(0, 1 - ageMs / EVIDENCE_FRESHNESS_WINDOW_MS);
	const freshnessMultiplier = 0.5 + freshnessRatio;
	return baseWeight * freshnessMultiplier;
}

function rankRuntimeYears(evidence: RuntimeYearEvidence[]): YearScore[] {
	if (evidence.length === 0) return [];

	const nowMs = Date.now();
	const grouped = new Map<number, RuntimeYearEvidence[]>();
	for (const item of evidence) {
		const entries = grouped.get(item.yearId);
		if (entries) {
			entries.push(item);
		} else {
			grouped.set(item.yearId, [item]);
		}
	}

	const ranked: YearScore[] = [];
	for (const [yearId, entries] of grouped) {
		const latest = entries.reduce((current, candidate) => (
			candidate.timestamp.getTime() > current.timestamp.getTime() ? candidate : current
		));
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
		if (right.score !== left.score) return right.score - left.score;
		if (right.strongestWeight !== left.strongestWeight) return right.strongestWeight - left.strongestWeight;
		if (right.evidenceCount !== left.evidenceCount) return right.evidenceCount - left.evidenceCount;
		return right.latestTimestamp.getTime() - left.latestTimestamp.getTime();
	});

	return ranked;
}

export function pickBestRuntimeYear(evidence: RuntimeYearEvidence[]): RuntimeYearEvidence | null {
	return rankRuntimeYears(evidence)[0]?.representative ?? null;
}

function buildActiveYearDrift(input: {
	selectedYearId: number | null;
	upstreamYearId: number | null;
	upstreamYearLabel: string | null;
	upstreamReachable: boolean;
	mappingConflict: boolean;
	publishedResetBlocked?: boolean;
	mirrorSyncedAt?: Date | null;
	verifyUpstream: boolean;
}) {
	if (input.mappingConflict) {
		const action = resolveMappingConflictAction(input.publishedResetBlocked ?? false);
		return {
			status: 'mapping-conflict' as const,
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
			status: 'enrollpro-unreachable' as const,
			message: 'EnrollPro active school year could not be verified. ATLAS is using saved setup data for now.',
			recommendedAction: 'RETRY_ENROLLPRO' as const,
			atlasSchoolYearId: input.selectedYearId,
			enrollProSchoolYearId: null,
			enrollProSchoolYearLabel: null,
			mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
		};
	}

	if (!input.upstreamYearId) {
		return {
			status: input.verifyUpstream ? 'enrollpro-unreachable' as const : 'aligned' as const,
			message: input.verifyUpstream
				? 'EnrollPro active school year could not be verified. ATLAS is using saved setup data for now.'
				: 'ATLAS is using saved setup data. Verify EnrollPro when preparing a new school year.',
			recommendedAction: input.verifyUpstream ? 'RETRY_ENROLLPRO' as const : 'NONE' as const,
			atlasSchoolYearId: input.selectedYearId,
			enrollProSchoolYearId: null,
			enrollProSchoolYearLabel: null,
			mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
		};
	}

	if (input.selectedYearId !== input.upstreamYearId) {
		return {
			status: 'atlas-stale' as const,
			message: `EnrollPro is now on ${input.upstreamYearLabel ?? `school year #${input.upstreamYearId}`}. Sync the new school year before creating a timetable.`,
			recommendedAction: 'RUN_ROLLOVER_SYNC' as const,
			atlasSchoolYearId: input.selectedYearId,
			enrollProSchoolYearId: input.upstreamYearId,
			enrollProSchoolYearLabel: input.upstreamYearLabel,
			mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
		};
	}

	return {
		status: 'aligned' as const,
		message: `ATLAS is aligned with ${input.upstreamYearLabel ?? `school year #${input.upstreamYearId}`}.`,
		recommendedAction: 'NONE' as const,
		atlasSchoolYearId: input.selectedYearId,
		enrollProSchoolYearId: input.upstreamYearId,
		enrollProSchoolYearLabel: input.upstreamYearLabel,
		mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
	};
}

export async function resolveRuntimeContext(
	schoolId: number,
	authToken?: string,
	options?: ResolveRuntimeContextOptions,
): Promise<RuntimeContextResult | null> {
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

	const evidence: RuntimeYearEvidence[] = [];
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
	if (!selectedRank) return null;
	let selected = selectedRank.representative;

	let source: RuntimeContextSource = 'atlas-persisted';
	let activeSchoolYearLabel: string | null = null;
	let upstreamReachable = false;
	let upstreamVerified = false;
	let upstreamMatched: boolean | null = null;
	let upstreamActiveSchoolYearId: number | null = schoolYearMirror?.enrollProSchoolYearId ?? null;
	let upstreamActiveSchoolYearLabel: string | null = schoolYearMirror?.yearLabel ?? null;
	let mappingConflict = false;

	const verifyUpstream = options?.verifyUpstream !== false;
	let activeTermResult: ActiveTermResult = {
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
		} else {
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
			let sectionExternalIds: Set<number> | undefined;
			try {
				sectionExternalIds = await fetchSectionExternalIds(authToken);
			} catch {
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
				} else if (activeTermResult.matchedSchoolYear === false) {
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
			if (!summary || typeof summary !== 'object') return false;
			const candidate = summary as { isPublished?: unknown; publishedAt?: unknown; publishedBy?: unknown };
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
