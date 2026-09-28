import { getDataContext } from '../lib/data-context.js';
import { findMappingConflicts, fetchSectionExternalIds, resolveMappingConflictAction } from './enrollpro-rollover.service.js';
import { fetchEnrollProActiveSchoolYear } from './section-adapter.js';
// A5-C2A: the runtime context resolves the active term through the ONE canonical
// resolver. `fetchEnrollProActiveTerm` is used for exactly one field — the
// reachability / typed-code DIAGNOSTIC when the live ORDERED STRUCTURE cannot be
// verified. It is NOT authority for the term itself: a term named outside a
// verified structure is discarded so this surface can never report a term the
// availability write authority refuses. See `resolveRuntimeActiveTerm`.
import { fetchEnrollProActiveTerm, type ActiveTermResult } from './active-term-adapter.service.js';
import { normalizePersistedTermStructure } from './derived-demand.service.js';
// A5-C2A — the ONE canonical active-term resolver, shared with the availability
// authority and the generation preflight. A reachable, truthful
// `ACTIVE_TERM_UNRESOLVED` degrades to LABELLED saved data re-verified against
// the live semantic revision instead of hard-failing while the app shell shows
// the saved term for the same school year.
import { resolveCanonicalActiveTerm, type CanonicalActiveTermResolution } from './active-term-resolver.service.js';
import { fetchEnrollProTermContract } from './enrollpro-term-contract.service.js';
// ACTIVE-TERM-LIVE-RESOLUTION-C01: the date-derived persisted active term lives
// in the shared academic-term authority. Re-exported here so existing importers
// (incl. `offline-term-fallback-rrtc02.test.ts`) keep working.
import { derivePersistedActiveTerm, type PersistedTermBoundary } from './academic-term.service.js';

export { derivePersistedActiveTerm };
export type { PersistedTermBoundary };

const db = () => getDataContext();

/**
 * A5-C2A — call the canonical active-term resolver for the runtime context.
 * Returns `null` only when the school has no mirrored EnrollPro school year to
 * resolve a term against; every other outcome (including a fail-closed `null`
 * term) is a typed {@link CanonicalActiveTermResolution}.
 */
async function resolveRuntimeActiveTerm(
	schoolId: number,
	schoolYearId: number | null,
	authToken: string | undefined,
): Promise<CanonicalActiveTermResolution | null> {
	if (!Number.isInteger(schoolYearId) || (schoolYearId as number) <= 0) return null;
	const resolvedYearId = schoolYearId as number;
	const resolution = await resolveCanonicalActiveTerm(
		{ schoolId, schoolYearId: resolvedYearId },
		{
			// The canonical verified live read. The resolver reads the persisted
			// verified snapshot itself and re-verifies it against this live
			// structure's semantic revision before it is treated as current.
			provider: ({ schoolId: id, schoolYearId: yearId }) =>
				fetchEnrollProTermContract({ schoolId: id, schoolYearId: yearId, authToken }),
		},
	);

	// A structural failure is not a verdict about which term is active — but it
	// IS the verdict for the term FIELD here, because the availability/generation
	// write authority never consults the active-term-only adapter. It resolves
	// through this same canonical resolver and, on `liveStructureVerified ===
	// false`, returns `termIndex: null` and rejects the write with 409
	// `TERM_AUTHORITY_UNRESOLVED` (faculty-availability.service.ts ->
	// resolveActiveAvailabilityTermIndex -> resolveActiveOrderedTermIndexLive).
	//
	// B1: this branch used to SUBSTITUTE the non-canonical
	// `fetchEnrollProActiveTerm` answer, so a legacy adapter that named a term
	// made this surface report `verified: true` + `degraded: false` for a term
	// the write path refuses — the page painted a term as live with no
	// saved-data label while every write was rejected. The read/write
	// disagreement this module exists to remove, on the one branch the existing
	// control did not cover.
	//
	// Option (a) is applied: the canonical structural-failure verdict is
	// AUTHORITATIVE for the term field, so the term is WITHHELD
	// (`termIndex: null`). The legacy adapter is still consulted for exactly one
	// thing — the reachability and typed-code DIAGNOSTIC — which is preserved
	// deliberately: `dashboard-stale-readiness` pins a school-year 200 +
	// active-term 409 reporting exactly `ACTIVE_TERM_UNRESOLVED`, and a
	// structural failure that swallowed a reachable upstream answer would report
	// the healthy upstream as an outage. Its term is discarded because a term
	// named outside a verified ordered structure cannot be scoped to one, and
	// the write authority would refuse it in any case.
	if (resolution.liveStructureVerified) return resolution;

	const legacy = await fetchEnrollProActiveTerm(authToken, resolvedYearId);
	return {
		// Canonical term field: withheld, never taken from the legacy adapter.
		termIndex: null,
		termIdentity: null,
		source:
			legacy.source === 'enrollpro-verified' ? 'enrollpro-verified'
				: legacy.source === 'enrollpro-unresolved' ? 'enrollpro-unresolved'
					: legacy.source === 'enrollpro-contract-drift' ? 'enrollpro-contract-drift'
						: 'enrollpro-unreachable',
		// No term is served, so nothing here comes from saved data and the
		// client owes the operator no saved-data label.
		degraded: false,
		cachedAt: null,
		cachedBeyondTtl: false,
		semanticRevisionMatched: null,
		liveStructureVerified: false,
		code: legacy.code,
		message: legacy.message,
	};
}

type RuntimeContextEvidenceType =
	| 'school-year-mirror'
	| 'scheduling-policy'
	| 'section-mirror'
	| 'section-snapshot'
	| 'faculty-snapshot'
	| 'generation-run';

type RuntimeContextSource = 'atlas-persisted' | 'enrollpro-verified';
type RuntimeDriftStatus = 'aligned' | 'atlas-stale' | 'enrollpro-unreachable' | 'mapping-conflict';
type RuntimeDriftAction = 'NONE' | 'RUN_ROLLOVER_SYNC' | 'REVIEW_MAPPING_CONFLICT' | 'RETRY_ENROLLPRO' | 'RESET_DUMMY_YEAR' | 'RUN_ARCHIVE_AND_SYNC';

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

export function pickBestRuntimeYear(
	evidence: RuntimeYearEvidence[],
	excludedYearIds?: Set<number>,
): RuntimeYearEvidence | null {
	const eligible = excludedYearIds && excludedYearIds.size > 0
		? evidence.filter((item) => !excludedYearIds.has(item.yearId))
		: evidence;
	return rankRuntimeYears(eligible)[0]?.representative ?? null;
}

function buildActiveYearDrift(input: {
	selectedYearId: number | null;
	upstreamYearId: number | null;
	upstreamYearLabel: string | null;
	upstreamReachable: boolean;
	mappingConflict: boolean;
	conflictCodes?: string[];
	publishedResetBlocked?: boolean;
	mirrorSyncedAt?: Date | null;
	verifyUpstream: boolean;
}) {
	if (input.mappingConflict) {
		const action = resolveMappingConflictAction(input.publishedResetBlocked ?? false, input.conflictCodes ?? []);
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
		db().enrollProSchoolYearMirror.findFirst({
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
				termContractCache: true,
				termContractCachedAt: true,
			},
		}),
		db().schedulingPolicy.findFirst({
			where: { schoolId },
			orderBy: [{ updatedAt: 'desc' }],
			select: { schoolYearId: true, updatedAt: true },
		}),
		db().sectionMirror.findFirst({
			where: { schoolId, isStale: false },
			orderBy: [{ lastSyncedAt: 'desc' }],
			select: { schoolYearId: true, lastSyncedAt: true },
		}),
		db().sectionSnapshot.findFirst({
			where: { schoolId },
			orderBy: [{ fetchedAt: 'desc' }],
			select: { schoolYearId: true, fetchedAt: true, source: true },
		}),
		db().facultySnapshot.findFirst({
			where: { schoolId },
			orderBy: [{ fetchedAt: 'desc' }],
			select: { schoolYearId: true, fetchedAt: true, source: true },
		}),
		db().generationRun.findFirst({
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

	// RR-09A: archived years are historical scope — weaker than any live
	// evidence. They never participate in the active-year election, even when
	// their artifacts are newer than the live year's.
	const archivedYearIds = new Set(
		(await db().enrollProSchoolYearMirror.findMany({
			where: { schoolId, isArchived: true },
			select: { enrollProSchoolYearId: true },
		})).map((mirror) => mirror.enrollProSchoolYearId),
	);
	if (archivedYearIds.size > 0) {
		for (let i = evidence.length - 1; i >= 0; i -= 1) {
			if (archivedYearIds.has(evidence[i].yearId)) {
				evidence.splice(i, 1);
			}
		}
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
	let conflictCodes: string[] = [];

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
		// A5-C2A — the live active term is resolved by the ONE canonical resolver,
		// which reads the persisted verified ordered snapshot itself (and
		// re-verifies it against the live semantic revision) when EnrollPro
		// truthfully reports that no term contains today. This context therefore
		// no longer carries its own active-term policy.
		//
		// RR-TERM-CACHE offline resilience: the persisted verified contract carries
		// its own active term. It is the fallback when the live active-term endpoint
		// is unreachable, so the timetable still resolves one ordered term instead of
		// dead-ending on "Term setup is required".
		let persistedActiveTerm: { identity: string; termIndex: number } | null = null;
		if (schoolYearMirror?.termContractCache && schoolYearMirror.termContractCachedAt) {
			const persisted = normalizePersistedTermStructure(
				schoolYearMirror.termContractCache,
				schoolId,
				schoolYearMirror.enrollProSchoolYearId,
			);
			if (persisted.ok) {
				const rawActive = (schoolYearMirror.termContractCache as { activeTerm?: { order?: unknown } }).activeTerm;
				const activeOrder = rawActive && Number.isInteger(rawActive.order) ? Number(rawActive.order) : null;
				persistedActiveTerm = derivePersistedActiveTerm(persisted.structure.terms, activeOrder, new Date());
			}
		}

		// Fetch school year and active term in parallel — each is independent
		const [upstreamYear, canonicalActiveTerm] = await Promise.all([
			fetchEnrollProActiveSchoolYear(authToken).catch(() => null),
			resolveRuntimeActiveTerm(schoolId, schoolYearMirror?.enrollProSchoolYearId ?? null, authToken),
		]);

		// A5-C2A — the active term now comes from the ONE canonical resolver, so
		// this client-facing context and the availability/generation authority can
		// never disagree. The previous local policy treated a reachable, truthful
		// `ACTIVE_TERM_UNRESOLVED` (host clock outside every term of the active
		// year) as an authoritative null and discarded the saved term the app shell
		// was already showing — the two-sources-of-truth defect.
		if (canonicalActiveTerm) {
			activeTermResult = {
				source: canonicalActiveTerm.source === 'enrollpro-verified' ? 'enrollpro-verified' : 'atlas-unverified',
				reachable: !canonicalActiveTerm.source.startsWith('enrollpro-unreachable') && canonicalActiveTerm.source !== 'atlas-unverified',
				verified: canonicalActiveTerm.termIndex != null,
				activeTerm: canonicalActiveTerm.termIdentity,
				termIndex: canonicalActiveTerm.termIndex,
				schoolYearId: schoolYearMirror?.enrollProSchoolYearId ?? null,
				matchedSchoolYear: null,
				code: canonicalActiveTerm.code,
				message: canonicalActiveTerm.message,
				degraded: canonicalActiveTerm.degraded,
				cachedAt: canonicalActiveTerm.cachedAt,
				cachedBeyondTtl: canonicalActiveTerm.cachedBeyondTtl,
				semanticRevisionMatched: canonicalActiveTerm.semanticRevisionMatched,
			};
		} else if (persistedActiveTerm) {
			// No canonical answer (no live structure and no usable snapshot) but the
			// persisted verified ordered contract still carries a resolved active term.
			// Surface it so the client resolves one explicit ordered term instead of
			// dead-ending. Labelled with the snapshot capture time by the caller.
			activeTermResult = {
				source: 'enrollpro-unreachable',
				reachable: false,
				verified: true,
				activeTerm: persistedActiveTerm.identity,
				termIndex: persistedActiveTerm.termIndex,
				schoolYearId: schoolYearMirror?.enrollProSchoolYearId ?? null,
				matchedSchoolYear: null,
				code: null,
				message: 'EnrollPro active-term endpoint is unreachable; using the persisted verified ordered term contract.',
			};
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
			conflictCodes = conflicts.map((conflict) => conflict.code);

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

			// Update matchedSchoolYear only when active term is verified (not drift/unreachable)
			if (
				activeTermResult.verified === true &&
				activeTermResult.schoolYearId !== null &&
				upstreamYear
			) {
				activeTermResult.matchedSchoolYear = activeTermResult.schoolYearId === upstreamYear.id;
				activeTermResult.message = activeTermResult.matchedSchoolYear
					? `ATLAS is aligned with EnrollPro active term ${activeTermResult.activeTerm}.`
					: `EnrollPro active term ${activeTermResult.activeTerm} is from a different school year (expected ${upstreamYear.id}, got ${activeTermResult.schoolYearId}).`;
			}
		}
	}

	// DEMAND-C01R2: expose the exact ordered labels from the persisted verified
	// EnrollPro term contract so client academic-term surfaces never invent or
	// truncate labels. This is a read-only projection of already-verified data.
	if (schoolYearMirror?.termContractCache && schoolYearMirror.termContractCachedAt) {
		const persisted = normalizePersistedTermStructure(
			schoolYearMirror.termContractCache,
			schoolId,
			schoolYearMirror.enrollProSchoolYearId,
		);
		if (persisted.ok) {
			const orderedTerms = persisted.structure.terms.map((term) => ({ identity: term.identity, displayLabel: term.displayLabel, order: term.order }));
			const activeTermIndexWithinContract = activeTermResult.termIndex != null
				&& orderedTerms.some((term) => term.order === activeTermResult.termIndex);
			activeTermResult = {
				...activeTermResult,
				orderedTerms,
				termFormat: persisted.structure.format,
				termCount: orderedTerms.length,
				...(activeTermResult.termIndex != null && !activeTermIndexWithinContract
					? {
						verified: false,
						termIndex: null,
						code: activeTermResult.code ?? 'ACTIVE_TERM_OUTSIDE_CONTRACT',
						message: 'EnrollPro active term is outside the persisted ordered term contract.',
					}
					: {}),
			};
		}
	}

	const stale = Date.now() - selected.timestamp.getTime() > CONTEXT_STALE_THRESHOLD_MS;
	if (!activeSchoolYearLabel && schoolYearMirror?.enrollProSchoolYearId === selected.yearId) {
		activeSchoolYearLabel = schoolYearMirror.yearLabel;
	}

	let publishedResetBlocked = false;
	if (mappingConflict && upstreamActiveSchoolYearId) {
		const [generationRuns, publishedRevisions] = await Promise.all([
			db().generationRun.findMany({
				where: { schoolId, schoolYearId: upstreamActiveSchoolYearId },
				select: { summary: true },
			}),
			db().publishedScheduleRevision.count({
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
		conflictCodes,
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
