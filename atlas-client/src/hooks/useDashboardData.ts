import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import atlasApi from '@/lib/api';
import { expireAtlasSession, getAtlasTokenEpochVersion, getPreferredAccessToken, subscribeAtlasTokenEpoch } from '@/lib/auth';
import { countSubjectsWithMissingCoverage } from '@/lib/coverage';
import { resolveActorSchoolId } from '@/lib/settings';
import type { Building, SubjectCoverageSummary } from '@/types';

export type BuildingSetupStatus = {
	done: boolean;
	subMessage?: string;
};

export type LifecyclePhase = 'SETUP' | 'PREFERENCES' | 'GENERATION' | 'REVIEW' | 'PUBLISHED';

export type LatestRunStatus = 'NONE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type DashboardReadinessSourceState =
	| 'verified_live'
	| 'checking_source'
	| 'using_saved_data'
	| 'no_saved_data'
	| 'partial_degraded';

/**
 * UX-C01 — operator-facing derived-demand setup readiness. This is the SINGLE
 * current-year demand authority (active EnrollPro year + verified ordered terms
 * + ATLAS Subject scheduling metadata). Legacy Curriculum Requirements readiness
 * is never represented here.
 */
export type DashboardDerivedDemandBlocker = {
	code: string;
	message: string;
	subjectId?: number;
	subjectCode?: string;
	rotationFamily?: string;
	rotationOrder?: number;
	scopeGradeLevel?: number;
	scopeProgramType?: string;
};

export type DashboardDerivedDemandState = {
	available: boolean;
	ready: boolean;
	yearLabel: string | null;
	revision: string | null;
	termStructure: { format: 'TRIMESTER' | 'QUARTERS'; terms: Array<{ identity: string; displayLabel: string; order: number }> } | null;
	blockers: DashboardDerivedDemandBlocker[];
	subjectMetadataExceptions: DashboardDerivedDemandBlocker[];
	totals: { totalLines: number; totalPairs: number; byTerm: Record<string, number> } | null;
	blockerCode: string | null;
	blockerMessage: string | null;
	error: string | null;
};

/**
 * DASH-RESILIENCE-C01 — explicit per-domain availability. A failed domain read
 * is `false` and its values are `null`; a genuine persisted zero is `true` with
 * value `0`. Availability is what lets the UI distinguish "unavailable" from
 * "empty" without inventing business values.
 */
export type DashboardDomainAvailability = {
	campus: boolean;
	subjects: boolean;
	faculty: boolean;
	sections: boolean;
	generation: boolean;
	derivedDemand: boolean;
};

export function unavailableDomainAvailability(): DashboardDomainAvailability {
	return { campus: false, subjects: false, faculty: false, sections: false, generation: false, derivedDemand: false };
}

/**
 * EVAL-C01 — Dashboard catalog/read scope.
 *
 * The Dashboard may only read for the authenticated actor's school. While the
 * actor scope is unresolved there is NO valid school to read: callers must
 * render a bounded loading/unavailable state and must not issue a request. A
 * hard-coded school-1 fallback here would silently show one school's lifecycle
 * to another school's operator.
 */
export type DashboardRequestScope =
	| { ready: true; schoolId: number }
	| { ready: false; schoolId: null };

export function resolveDashboardRequestScope(actorSchoolId: number | null | undefined): DashboardRequestScope {
	if (typeof actorSchoolId === 'number' && Number.isInteger(actorSchoolId) && actorSchoolId > 0) {
		return { ready: true, schoolId: actorSchoolId };
	}
	return { ready: false, schoolId: null };
}

/**
 * DASHBOARD-TRUTH-C01 — the run-wide HARD blocker count from the latest run's
 * violation report (`GET /generation/:schoolId/:schoolYearId/runs/latest/violations`).
 *
 * Precedence mirrors `resolveHardViolationCount` (`useTimetableData.ts`): the
 * publication-allowlist-filtered `counts.runWide.blockingHard`, then the
 * unfiltered `counts.runWide.hard`. The report's top-level `violations`/`total`
 * are TERM-FILTERED and include SOFT, so they are never a HARD count and are
 * never used here. When no run-wide count exists the truthful answer is
 * `null` (unavailable) — never `0`, which would read as "clean".
 *
 * A9 c8 — THIS IS NO LONGER A PRODUCTION READ. The Dashboard drove its
 * "Timetable made and checked" row from a SECOND request for the same run's
 * report while the readiness summary it had already received carried the
 * canonical count, and the second read is the slower of the two: on the live
 * drill the row read "made and checked" beside a `/timetable` that said there
 * was no timetable for that year. `resolveRunWideCountsFromSummary` is what
 * the Dashboard uses now. These two remain the client-side statement of what
 * the server's `canonicalRunViolationCounts` computes, and
 * `a9-c8-dashboard-truth.test.ts` pins the two against one fixture so the
 * summary field and the report field cannot drift apart.
 */
export function resolveRunWideHardViolationCount(
	report: { counts?: { runWide?: { hard?: number; blockingHard?: number } } } | null | undefined,
): number | null {
	const blockingHard = report?.counts?.runWide?.blockingHard;
	if (typeof blockingHard === 'number') return blockingHard;
	const hard = report?.counts?.runWide?.hard;
	if (typeof hard === 'number') return hard;
	return null;
}

/**
 * DASHBOARD-TRUTH-C01 — the run-wide SOFT warning total from the same report.
 * Acknowledged warnings only; never blockers. `null` when unavailable.
 */
export function resolveRunWideSoftViolationCount(
	report: { counts?: { runWide?: { soft?: number } } } | null | undefined,
): number | null {
	return typeof report?.counts?.runWide?.soft === 'number' ? report.counts.runWide.soft : null;
}

/**
 * A9 c8 (F2) — the run-wide counts AS THE READINESS SUMMARY CARRIES THEM.
 *
 * `GET /dashboard/readiness-summary` already returns the canonical
 * publication-allowlist HARD count (`generation.blockingHardCount`) and the
 * run-wide SOFT advisory count (`generation.softViolationCount`) for the run it
 * selected for the ACTIVE school year — the same year `/timetable` reads. The
 * Dashboard used to re-request that run's report and re-derive both numbers, so
 * one fact had two reads and two chances to disagree, and the slower read
 * decided whether the row read "made and checked" or "could not check".
 *
 * One source, one definition, one number: the summary is the authority and this
 * is the only place the Dashboard takes those two figures from. `null` stays
 * `null` (unavailable) — never `0`, which would read as "clean".
 */
export function resolveRunWideCountsFromSummary(
	summary: { generation?: { blockingHardCount?: number | null; softViolationCount?: number | null } } | null | undefined,
): { hard: number | null; soft: number | null } {
	return {
		hard: typeof summary?.generation?.blockingHardCount === 'number' ? summary.generation.blockingHardCount : null,
		soft: typeof summary?.generation?.softViolationCount === 'number' ? summary.generation.softViolationCount : null,
	};
}

/**
 * EVAL-C01 — cleared domain state applied when the actor school changes (or
 * is unresolved). Every school-scoped value returns to empty so the previous
 * school's lifecycle, run identity, and publication state can never linger.
 * DASH-RESILIENCE-C01 — unknown values are `null`, never a synthetic `0`,
 * `[]`, or `NONE`.
 */
export function initialDashboardDomainState() {
	return {
		buildings: [] as Building[],
		campusImageUrl: null as string | null,
		subjectCount: null as number | null,
		facultyCount: null as number | null,
		sectionCount: null as number | null,
		unassignedSubjectCount: null as number | null,
		missingCoverageSubjectIds: null as number[] | null,
		latestRunStatus: null as LatestRunStatus | null,
		latestRunId: null as number | null,
		blockingHardCount: null as number | null,
		assignedCount: null as number | null,
		unassignedCount: null as number | null,
		hardViolationCount: null as number | null,
		derivedDemand: null as DashboardDerivedDemandState | null,
		activeSchoolYearId: null as number | null,
		activeSchoolYearLabel: null as string | null,
		domainAvailability: unavailableDomainAvailability(),
	};
}

/**
 * DASH-RESILIENCE-C01 — classify a failed readiness load.
 *
 * HTTP 401 is an authentication failure (the canonical expired-session UX owns
 * it); HTTP 403 is a scope rejection (the canonical blocked-scope UX owns it).
 * Every other status is a transient data-source failure that may be retried.
 */
export type DashboardLoadErrorKind = 'auth' | 'scope' | 'unavailable';

export function classifyDashboardLoadError(status: number | null | undefined): DashboardLoadErrorKind {
	if (status === 401) return 'auth';
	if (status === 403) return 'scope';
	return 'unavailable';
}

export type DashboardLoadFailureDecision = {
	/** Keep the last same-school snapshot visible. */
	retainSnapshot: boolean;
	/** Clear every school-scoped value back to unavailable (null). */
	resetDomainState: boolean;
	/** Render the blocked-scope card and dispatch no further requests. */
	blocked: boolean;
	/** Invoke the canonical expired-session path (clear storage + sign-in). */
	expireSession: boolean;
	sourceState: DashboardReadinessSourceState;
	sourceMessage: string;
	blockedMessage: string | null;
};

/**
 * DASH-RESILIENCE-C01 — pure failure policy for the single readiness pipeline.
 *
 * A transient failure preserves the last successful snapshot ONLY for the same
 * actor school. A 401/403 is authoritative: it clears the snapshot, dispatches
 * nothing further, and routes to the canonical auth/scope UX.
 */
export function resolveDashboardLoadFailure(args: {
	errorKind: DashboardLoadErrorKind;
	requestSchoolId: number;
	lastSuccessSchoolId: number | null;
}): DashboardLoadFailureDecision {
	if (args.errorKind === 'auth') {
		return {
			retainSnapshot: false,
			resetDomainState: true,
			blocked: true,
			expireSession: true,
			sourceState: 'no_saved_data',
			sourceMessage: 'Your session expired. Sign in again to load setup readiness.',
			blockedMessage: 'Your session expired. Sign in again to continue.',
		};
	}
	if (args.errorKind === 'scope') {
		return {
			retainSnapshot: false,
			resetDomainState: true,
			blocked: true,
			expireSession: false,
			sourceState: 'no_saved_data',
			sourceMessage: 'We could not confirm your school. Sign in again before reviewing setup.',
			blockedMessage: 'ATLAS rejected this school request. No dashboard data was loaded.',
		};
	}
	const retain = args.lastSuccessSchoolId != null && args.lastSuccessSchoolId === args.requestSchoolId;
	return {
		retainSnapshot: retain,
		resetDomainState: !retain,
		blocked: false,
		expireSession: false,
		sourceState: 'partial_degraded',
		sourceMessage: retain
			? 'Showing saved data. Some checks are unavailable.'
			: 'Readiness data is unavailable right now. Try again in a moment.',
		blockedMessage: null,
	};
}

type DashboardReadinessSummary = {
	schoolId: number;
	activeSchoolYearId: number | null;
	activeSchoolYearLabel: string | null;
	resolvedAt: string;
	sourceState: DashboardReadinessSourceState;
	sourceMessage: string;
	activeTerm: {
		source: string;
		reachable: boolean;
		verified: boolean;
		activeTerm: string | null;
		termIndex: number | null;
		schoolYearId: number | null;
		matchedSchoolYear: boolean | null;
		code: string | null;
		message: string;
	} | null;
	campus: {
		available: boolean;
		buildings: Building[];
		campusImageUrl: string | null;
		teachingRoomCount: number | null;
		totalRoomCount: number | null;
		buildingSetupStatus: BuildingSetupStatus;
	};
	subjects: {
		available: boolean;
		subjectCount: number | null;
		unassignedSubjectCount: number | null;
	};
	faculty: {
		available: boolean;
		facultyCount: number | null;
		lastSyncedAt: string | null;
	};
	sections: {
		available: boolean;
		sectionCount: number | null;
		lastSyncedAt: string | null;
	};
	generation: {
		available: boolean;
		latestRunStatus: LatestRunStatus | null;
		latestRunId: number | null;
		publishedRunId: number | null;
		/** D2 — canonical publication-allowlist HARD count (the gate), never a combined total. */
		blockingHardCount: number | null;
		/** D2 — canonical run-wide SOFT advisory count (warnings, not blockers). */
		softViolationCount: number | null;
		isPublished: boolean;
		createdAt: string | null;
		finishedAt: string | null;
	};
	derivedDemand: DashboardDerivedDemandState;
	lifecyclePhase: LifecyclePhase;
};

function availabilityFromSummary(summary: DashboardReadinessSummary): DashboardDomainAvailability {
	return {
		campus: summary.campus?.available === true,
		subjects: summary.subjects?.available === true,
		faculty: summary.faculty?.available === true,
		sections: summary.sections?.available === true,
		generation: summary.generation?.available === true,
		derivedDemand: summary.derivedDemand?.available === true,
	};
}

export type DashboardData = {
	loading: boolean;
	actorSchoolId: number | null;
	actorScopeResolved: boolean;
	actorScopeBlocked: string | null;
	buildings: Building[];
	campusImageUrl: string | null;
	subjectCount: number | null;
	facultyCount: number | null;
	sectionCount: number | null;
	unassignedSubjectCount: number | null;
	missingCoverageSubjectIds: number[] | null;
	/**
	 * A9 c8 (F3) — GONE: `teachingRoomCount` and `totalRoomCount`.
	 *
	 * They were the Dashboard's `Teaching Rooms 78/103` tile: 78 teaching rooms over 103 rooms
	 * in the school, printed as if it were a readiness fraction, beside the Campus page's
	 * `78 of 78 teaching rooms are ready to be used for classes.` for the same rooms. The
	 * school's total room count is a different population and is not a readiness number, so
	 * the Dashboard now derives the ONE honest pair itself, from the same room list, through
	 * `@/lib/teaching-room-readiness` — which `/map` and `/timetable` share.
	 */
	buildingSetupStatus: BuildingSetupStatus;
	dataSource: 'live' | 'cached' | 'none';
	activeSchoolYearId: number | null;
	activeSchoolYearLabel: string | null;
	activeTerm: { activeTerm: string | null; termIndex: number | null } | null;
	activeTermPublished: boolean | null;
	activeTermUnassignedCount: number | null;
	/** DASHBOARD-TRUTH-C01 — run-wide HARD blockers for the run the SUMMARY resolved; null = unavailable. */
	runWideHardViolationCount: number | null;
	/** DASHBOARD-TRUTH-C01 — run-wide SOFT warnings from that same summary; null = unavailable. */
	runWideSoftViolationCount: number | null;
	latestRunStatus: LatestRunStatus | null;
	latestRunId: number | null;
	/**
	 * D2 — the canonical publication-allowlist HARD count from the readiness
	 * summary. Renamed from the old combined `violationCount`: that raw total
	 * (334) was never a blocker count, and the canonical gate count is 0 HARD.
	 */
	blockingHardCount: number | null;
	assignedCount: number | null;
	unassignedCount: number | null;
	hardViolationCount: number | null;
	derivedDemand: DashboardDerivedDemandState | null;
	lifecyclePhase: LifecyclePhase;
	readinessSourceState: DashboardReadinessSourceState;
	readinessSourceMessage: string;
	readinessResolvedAt: string | null;
	/**
	 * A9 c8 (F1) — TRUE while the readiness summary for the CURRENT actor school has not
	 * answered yet. It is not an error state and it is not an empty state: nothing is known,
	 * so nothing may be claimed from it.
	 *
	 * This is the distinction the live screen got wrong. `domainAvailability` starts as all
	 * `false`, so a read that had not ARRIVED was indistinguishable from a read that had
	 * FAILED, and `ReadinessCard` published "9 ATLAS COULD NOT CHECK" beside a working
	 * system for as long as the request took (a 17.5 s event-loop stall on live). "Could not
	 * check" is now earned only by a read that answered and failed; until then the screen
	 * says it is reading, in the `checking_source` words it already owns.
	 *
	 * It is per-school, not per-request: a "Check for updates" refresh keeps the previous
	 * snapshot visible, so it must not blank the region back to a reading state.
	 */
	readinessPending: boolean;
	domainAvailability: DashboardDomainAvailability;
	refreshDashboard: () => void;
	retryActorScope: () => void;
};

function toDataSource(sourceState: DashboardReadinessSourceState): DashboardData['dataSource'] {
	if (sourceState === 'verified_live') return 'live';
	if (sourceState === 'using_saved_data' || sourceState === 'partial_degraded') return 'cached';
	return 'none';
}

async function fetchActorCoverageSummary(schoolId: number, schoolYearId: number): Promise<SubjectCoverageSummary> {
	const { data } = await atlasApi.get<SubjectCoverageSummary>('/faculty-assignments/coverage/summary', {
		params: { schoolId, schoolYearId },
	});
	return data;
}

export function useDashboardData(): DashboardData {
	const [actorSchoolId, setActorSchoolId] = useState<number | null>(null);
	const [actorScopeResolved, setActorScopeResolved] = useState(false);
	const [actorScopeBlocked, setActorScopeBlocked] = useState<string | null>(null);
	const [buildings, setBuildings] = useState<Building[]>([]);
	const [campusImageUrl, setCampusImageUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [subjectCount, setSubjectCount] = useState<number | null>(null);
	const [facultyCount, setFacultyCount] = useState<number | null>(null);
	const [sectionCount, setSectionCount] = useState<number | null>(null);
	const [unassignedSubjectCount, setUnassignedSubjectCount] = useState<number | null>(null);
	const [missingCoverageSubjectIds, setMissingCoverageSubjectIds] = useState<number[] | null>(null);
	const [dataSource, setDataSource] = useState<'live' | 'cached' | 'none'>('none');
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [activeSchoolYearLabel, setActiveSchoolYearLabel] = useState<string | null>(null);
	const [activeTerm, setActiveTerm] = useState<{ activeTerm: string | null; termIndex: number | null } | null>(null);
	const [activeTermPublished, setActiveTermPublished] = useState<boolean | null>(null);
	const [activeTermUnassignedCount, setActiveTermUnassignedCount] = useState<number | null>(null);
	const [runWideHardViolationCount, setRunWideHardViolationCount] = useState<number | null>(null);
	const [runWideSoftViolationCount, setRunWideSoftViolationCount] = useState<number | null>(null);
	const [latestRunStatus, setLatestRunStatus] = useState<LatestRunStatus | null>(null);
	const [latestRunId, setLatestRunId] = useState<number | null>(null);
	const [blockingHardCount, setBlockingHardCount] = useState<number | null>(null);
	const [assignedCount, setAssignedCount] = useState<number | null>(null);
	const [unassignedCount, setUnassignedCount] = useState<number | null>(null);
	const [hardViolationCount, setHardViolationCount] = useState<number | null>(null);
	const [derivedDemand, setDerivedDemand] = useState<DashboardDerivedDemandState | null>(null);
	const [summaryBuildingSetupStatus, setSummaryBuildingSetupStatus] = useState<BuildingSetupStatus | null>(null);
	const [summaryLifecyclePhase, setSummaryLifecyclePhase] = useState<LifecyclePhase | null>(null);
	const [readinessSourceState, setReadinessSourceState] = useState<DashboardReadinessSourceState>('checking_source');
	const [readinessSourceMessage, setReadinessSourceMessage] = useState('Checking readiness source.');
	const [readinessResolvedAt, setReadinessResolvedAt] = useState<string | null>(null);
	const [readinessPending, setReadinessPending] = useState(true);
	const [domainAvailability, setDomainAvailability] = useState<DashboardDomainAvailability>(unavailableDomainAvailability());
	const [refreshNonce, setRefreshNonce] = useState(0);
	const boundActorRef = useRef<number | null>(null);
	const lastSuccessSchoolIdRef = useRef<number | null>(null);

	const resetDomainState = useCallback(() => {
		const cleared = initialDashboardDomainState();
		setBuildings(cleared.buildings);
		setCampusImageUrl(cleared.campusImageUrl);
		setSubjectCount(cleared.subjectCount);
		setFacultyCount(cleared.facultyCount);
		setSectionCount(cleared.sectionCount);
		setUnassignedSubjectCount(cleared.unassignedSubjectCount);
		setMissingCoverageSubjectIds(cleared.missingCoverageSubjectIds);
		setLatestRunStatus(cleared.latestRunStatus);
		setLatestRunId(cleared.latestRunId);
		setBlockingHardCount(cleared.blockingHardCount);
		setAssignedCount(cleared.assignedCount);
		setUnassignedCount(cleared.unassignedCount);
		setHardViolationCount(cleared.hardViolationCount);
		setDerivedDemand(cleared.derivedDemand);
		setActiveSchoolYearId(cleared.activeSchoolYearId);
		setActiveSchoolYearLabel(cleared.activeSchoolYearLabel);
		setDomainAvailability(cleared.domainAvailability);
		// A9 c8 (F1) — a cleared domain state has no answer behind it, so the screen must
		// return to "reading" rather than keep publishing a previous school's failures.
		setReadinessPending(true);
		setActiveTerm(null);
		setActiveTermPublished(null);
		setActiveTermUnassignedCount(null);
		setRunWideHardViolationCount(null);
		setRunWideSoftViolationCount(null);
		setSummaryBuildingSetupStatus(null);
		setSummaryLifecyclePhase(null);
	}, []);

	const refreshDashboard = useCallback(() => {
		setRefreshNonce((current) => current + 1);
	}, []);

	const retryActorScope = useCallback(() => {
		// ACTOR-SCOPE-C01: drop any previously bound school and its data BEFORE
		// re-resolving so a retry can never keep rendering a stale scope.
		boundActorRef.current = null;
		lastSuccessSchoolIdRef.current = null;
		setActorSchoolId(null);
		setActorScopeResolved(false);
		setActorScopeBlocked(null);
		resetDomainState();
		resolveActorSchoolId().then((id) => {
			if (id != null) setActorSchoolId(id);
			setActorScopeResolved(true);
		});
	}, [resetDomainState]);

	useEffect(() => {
		let disposed = false;
		let sequence = 0;

		const resolveNow = async () => {
			const requestSequence = ++sequence;
			const token = getPreferredAccessToken();
			const epoch = getAtlasTokenEpochVersion();
			if (!token) {
				if (disposed || requestSequence !== sequence) return;
				setActorSchoolId(null);
				setActorScopeResolved(true);
				return;
			}
			const id = await resolveActorSchoolId();
			if (disposed || requestSequence !== sequence) return;
			// Discard a late resolution whose token/epoch is no longer current.
			if (getPreferredAccessToken() !== token || getAtlasTokenEpochVersion() !== epoch) return;
			setActorSchoolId(id != null ? id : null);
			setActorScopeResolved(true);
		};

		// ACTOR-SCOPE-C01: on EVERY token mutation, synchronously clear the bound
		// school and all domain state, then re-resolve and rebind in place.
		const unsubscribe = subscribeAtlasTokenEpoch(() => {
			sequence += 1;
			setActorSchoolId(null);
			setActorScopeResolved(false);
			boundActorRef.current = null;
			lastSuccessSchoolIdRef.current = null;
			resetDomainState();
			void resolveNow();
		});

		void resolveNow();
		return () => {
			disposed = true;
			unsubscribe();
		};
	}, [resetDomainState]);

	useEffect(() => {
		let cancelled = false;

		// EVAL-C01: no actor scope yet — zero domain requests.
		if (!actorScopeResolved) {
			setLoading(true);
			setReadinessSourceState('checking_source');
			setReadinessSourceMessage('Checking readiness source.');
			return () => {
				cancelled = true;
			};
		}

		const scope = resolveDashboardRequestScope(actorSchoolId);
		if (!scope.ready) {
			resetDomainState();
			lastSuccessSchoolIdRef.current = null;
			setDataSource('none');
			setReadinessSourceState('no_saved_data');
			setReadinessSourceMessage('We could not confirm your school. Sign in again before reviewing setup.');
			setActorScopeBlocked('ATLAS could not determine the authenticated school. No dashboard data was loaded.');
			setLoading(false);
			return () => {
				cancelled = true;
			};
		}

		// EVAL-C01: actor school changed — clear the old school's state and
		// rebind every request to the new school. DASH-RESILIENCE-C01: a
		// retained snapshot is NEVER carried across an actor-school change.
		if (boundActorRef.current !== scope.schoolId) {
			boundActorRef.current = scope.schoolId;
			lastSuccessSchoolIdRef.current = null;
			resetDomainState();
		}
		setActorScopeBlocked(null);

		const schoolId = scope.schoolId;
		setLoading(true);

		// DASH-RESILIENCE-C01 — the readiness summary is the SINGLE
		// authoritative load pipeline. There is no legacy fan-out fallback.
		atlasApi.get<DashboardReadinessSummary>('/dashboard/readiness-summary', { params: { schoolId } })
			.then((response) => {
				if (cancelled) return;
				const summary = response.data;
				lastSuccessSchoolIdRef.current = schoolId;
				setBuildings(summary.campus.buildings ?? []);
				setCampusImageUrl(summary.campus.campusImageUrl ?? null);
				setSubjectCount(summary.subjects.subjectCount);
				setUnassignedSubjectCount(summary.subjects.unassignedSubjectCount);
				setFacultyCount(summary.faculty.facultyCount);
				setSectionCount(summary.sections.sectionCount);
				setDataSource(toDataSource(summary.sourceState));
				setActiveSchoolYearId(summary.activeSchoolYearId);
				setActiveSchoolYearLabel(summary.activeSchoolYearLabel);
				setDerivedDemand(summary.derivedDemand ?? null);
				setLatestRunStatus(summary.generation.latestRunStatus);
				setLatestRunId(summary.generation.latestRunId);
				setBlockingHardCount(summary.generation.blockingHardCount);
				// A9 c8 (F2) — the summary IS the authority for the run's counts. The
				// second `runs/latest/violations` request is gone: one fact, one read, one
				// number, and the row can no longer be decided by the slower of two reads.
				const runCounts = resolveRunWideCountsFromSummary(summary);
				setRunWideHardViolationCount(runCounts.hard);
				setRunWideSoftViolationCount(runCounts.soft);
				setSummaryBuildingSetupStatus(summary.campus.buildingSetupStatus);
				setSummaryLifecyclePhase(summary.lifecyclePhase);
				setReadinessSourceState(summary.sourceState);
				setReadinessSourceMessage(summary.sourceMessage);
				setReadinessResolvedAt(summary.resolvedAt);
				setDomainAvailability(availabilityFromSummary(summary));
				// A9 c8 (F1) — the read ANSWERED. Whether it failed is now a fact the
				// screen may report; until this line runs there was nothing to report.
				setReadinessPending(false);
				setActiveTerm(
					summary.activeTerm && summary.activeTerm.activeTerm
						? { activeTerm: summary.activeTerm.activeTerm, termIndex: summary.activeTerm.termIndex }
						: null,
				);
				setLoading(false);

				// Actor-scoped, non-authoritative enrichment. Failures keep the
				// summary values (including null) — they never substitute zero.
				if (summary.activeSchoolYearId) {
					fetchActorCoverageSummary(schoolId, summary.activeSchoolYearId)
						.then((coverage) => {
							if (!cancelled) {
								setUnassignedSubjectCount(countSubjectsWithMissingCoverage(coverage));
								setMissingCoverageSubjectIds(coverage.rows.filter((r) => r.uncoveredSectionCount > 0).map((r) => r.subjectId));
							}
						})
						.catch(() => { /* keep the summary value */ });
				}

				const termIndex = summary.activeTerm?.termIndex ?? null;
				const syIdForTerm = summary.activeSchoolYearId;
				if (termIndex && syIdForTerm) {
					atlasApi.get<{ source?: { termScope?: string } }>(`/schools/${schoolId}/schedules/published`, { params: { termIndex } })
						.then((r) => {
							if (!cancelled) setActiveTermPublished(r.data?.source?.termScope === 'explicit' || r.data?.source?.termScope === 'active');
						})
						.catch(() => { if (!cancelled) setActiveTermPublished(null); });
					// A9 c8 (F2) — the `runs/latest/violations` request that used to sit here
					// is REMOVED, and nothing replaces it. Its two counts are already on the
					// summary this screen received (`resolveRunWideCountsFromSummary`, above),
					// computed server-side by the same `canonicalRunViolationCounts` predicate
					// for the same run and the same active year that `/timetable` reads. A
					// second read of one fact is a second chance to disagree with the page the
					// row links to, and it was the slower of the two, so it decided the row
					// while the summary was still in flight.
					atlasApi.get<{ run?: { unassignedItems?: Array<{ termIndex?: number }> } }>(`/generation/${schoolId}/${syIdForTerm}/runs/latest`)
						.then((r) => {
							if (cancelled) return;
							const unassigned = r.data.run?.unassignedItems;
							if (Array.isArray(unassigned)) {
								setActiveTermUnassignedCount(unassigned.filter((item) => item.termIndex === termIndex).length);
							} else {
								setActiveTermUnassignedCount(null);
							}
						})
						.catch(() => { if (!cancelled) setActiveTermUnassignedCount(null); });
				} else {
					setActiveTermPublished(null);
					setActiveTermUnassignedCount(null);
					// A9 c8 (F2) — the run counts are deliberately NOT cleared here. They come
					// from the summary, which answered: "there is no verified active term" is a
					// fact about the TERM, and blanking the run's figures because of it is how
					// an answered fact used to turn into "could not check".
				}
			})
			.catch((error) => {
				if (cancelled) return;
				// DASH-RESILIENCE-C01 — classify the failure and dispatch
				// NOTHING else. A transient failure retains the same-school
				// snapshot; 401/403 are authoritative and clear it.
				const kind = classifyDashboardLoadError(error?.response?.status);
				const decision = resolveDashboardLoadFailure({
					errorKind: kind,
					requestSchoolId: schoolId,
					lastSuccessSchoolId: lastSuccessSchoolIdRef.current,
				});
				if (decision.expireSession) {
					lastSuccessSchoolIdRef.current = null;
					expireAtlasSession();
				}
				if (decision.resetDomainState) {
					lastSuccessSchoolIdRef.current = null;
					resetDomainState();
				}
				// A9 c8 (F1) — the read ANSWERED, and the answer was a failure. THIS is the
				// only state that earns "could not check", so the region must stop reading.
				// It is set after `resetDomainState()` on purpose: a retained same-school
				// snapshot is a settled screen, not a reading one.
				setReadinessPending(false);
				setDataSource(decision.retainSnapshot ? 'cached' : 'none');
				setReadinessSourceState(decision.sourceState);
				setReadinessSourceMessage(decision.sourceMessage);
				setActorScopeBlocked(decision.blockedMessage);
				setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [refreshNonce, actorSchoolId, actorScopeResolved, resetDomainState]);

	// A9 c8 (F3) — the `totalRoomCount` / `teachingRoomCount` memos that fed the Dashboard's
	// `78/103` tile are removed. The one honest pair now comes from
	// `@/lib/teaching-room-readiness`, which `/map` renders from, so the two pages cannot
	// print different room answers from the same room list.

	const buildingSetupStatus = useMemo<BuildingSetupStatus>(() => {
		// A9 c8 (F1) — nothing has been read yet, so nothing may be called unavailable.
		// Without this the panel and the readiness hint would print "Campus readiness is
		// unavailable" over a request that is still in flight — the same lie as "could not
		// check", one region over.
		if (readinessPending) return { done: false };
		if (!domainAvailability.campus) return { done: false, subMessage: 'Campus readiness is unavailable.' };
		if (summaryBuildingSetupStatus) return summaryBuildingSetupStatus;
		const teachingBuildings = buildings.filter((b) => b.isTeachingBuilding !== false);
		const teachingBuildingsWithoutRooms = teachingBuildings.filter((b) => b.rooms.length === 0);
		const placeholderNamedBuildings = teachingBuildings.filter((b) => /^Building \d+$/.test(b.name));
		const invalidTeachingBuildings = teachingBuildings.filter(
			(b) => /^Building \d+$/.test(b.name) || b.rooms.length === 0,
		);
		const done = teachingBuildings.length > 0 && invalidTeachingBuildings.length === 0;
		let subMessage: string | undefined;
		if (!done) {
			if (teachingBuildings.length === 0) subMessage = 'No teaching buildings set up yet';
			else if (teachingBuildingsWithoutRooms.length > 0 && placeholderNamedBuildings.length > 0) {
				subMessage = `${teachingBuildingsWithoutRooms.length} without rooms, ${placeholderNamedBuildings.length} need a name`;
			} else if (teachingBuildingsWithoutRooms.length > 0) {
				// A9 c8 (F3) — GRAMMAR. The live screen read "1 building have no rooms".
				// `subMessage` is the string the Dashboard prints, the readiness row hints
				// with, and the campus panel badges with, so the verb has to agree with the
				// number. The server builds the same sentence in `summarizeCampus`; both are
				// corrected, and the plural branch still reads "buildings have no rooms".
				subMessage = `${teachingBuildingsWithoutRooms.length} building${teachingBuildingsWithoutRooms.length === 1 ? ' has' : 's have'} no rooms`;
			} else if (placeholderNamedBuildings.length > 0) {
				subMessage = `${placeholderNamedBuildings.length} building${placeholderNamedBuildings.length !== 1 ? 's' : ''} need a name`;
			}
		}
		return { done, subMessage };
	}, [buildings, summaryBuildingSetupStatus, domainAvailability.campus, readinessPending]);

	const lifecyclePhase = useMemo<LifecyclePhase>(() => {
		if (summaryLifecyclePhase) return summaryLifecyclePhase;
		// EVAL-C01: the local fallback derives from the same coherent
		// snapshot, and it never claims PUBLISHED — only the guarded server
		// snapshot may report a published schedule.
		if (derivedDemand !== null && derivedDemand.available && !derivedDemand.ready) return 'SETUP';
		const setupReady =
			(subjectCount ?? 0) > 0 &&
			(facultyCount ?? 0) > 0 &&
			(unassignedSubjectCount ?? 1) === 0 &&
			(sectionCount ?? 0) > 0 &&
			buildingSetupStatus.done;
		if (!setupReady) return 'SETUP';
		if (latestRunStatus === null) return 'SETUP';
		if (latestRunStatus === 'NONE') return 'PREFERENCES';
		if (latestRunStatus === 'IN_PROGRESS') return 'GENERATION';
		if (latestRunStatus === 'FAILED') return 'GENERATION';
		// COMPLETED: review until violations resolved (publish lifecycle handled separately when published API lands)
		return 'REVIEW';
	}, [
		subjectCount,
		facultyCount,
		unassignedSubjectCount,
		sectionCount,
		buildingSetupStatus.done,
		latestRunStatus,
		derivedDemand,
		summaryLifecyclePhase,
	]);

	return {
		loading,
		actorSchoolId,
		actorScopeResolved,
		actorScopeBlocked,
		buildings,
		campusImageUrl,
		subjectCount,
		facultyCount,
		sectionCount,
		unassignedSubjectCount,
		missingCoverageSubjectIds,
		buildingSetupStatus,
		dataSource,
		activeSchoolYearId,
		activeSchoolYearLabel,
		activeTerm,
		activeTermPublished,
		activeTermUnassignedCount,
		runWideHardViolationCount,
		runWideSoftViolationCount,
		latestRunStatus,
		latestRunId,
		blockingHardCount,
		assignedCount,
		unassignedCount,
		hardViolationCount,
		derivedDemand,
		lifecyclePhase,
		readinessSourceState,
		readinessSourceMessage,
		readinessResolvedAt,
		readinessPending,
		domainAvailability,
		refreshDashboard,
		retryActorScope,
	};
}
