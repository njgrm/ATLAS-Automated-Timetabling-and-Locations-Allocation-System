import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import atlasApi from '@/lib/api';
import { expireAtlasSession } from '@/lib/auth';
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
		violationCount: null as number | null,
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
		violationCount: number | null;
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
	teachingRoomCount: number;
	totalRoomCount: number;
	buildingSetupStatus: BuildingSetupStatus;
	dataSource: 'live' | 'cached' | 'none';
	activeSchoolYearId: number | null;
	activeSchoolYearLabel: string | null;
	activeTerm: { activeTerm: string | null; termIndex: number | null } | null;
	activeTermPublished: boolean | null;
	activeTermUnassignedCount: number | null;
	activeTermHardViolationCount: number | null;
	latestRunStatus: LatestRunStatus | null;
	latestRunId: number | null;
	violationCount: number | null;
	assignedCount: number | null;
	unassignedCount: number | null;
	hardViolationCount: number | null;
	derivedDemand: DashboardDerivedDemandState | null;
	lifecyclePhase: LifecyclePhase;
	readinessSourceState: DashboardReadinessSourceState;
	readinessSourceMessage: string;
	readinessResolvedAt: string | null;
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
	const [activeTermHardViolationCount, setActiveTermHardViolationCount] = useState<number | null>(null);
	const [latestRunStatus, setLatestRunStatus] = useState<LatestRunStatus | null>(null);
	const [latestRunId, setLatestRunId] = useState<number | null>(null);
	const [violationCount, setViolationCount] = useState<number | null>(null);
	const [assignedCount, setAssignedCount] = useState<number | null>(null);
	const [unassignedCount, setUnassignedCount] = useState<number | null>(null);
	const [hardViolationCount, setHardViolationCount] = useState<number | null>(null);
	const [derivedDemand, setDerivedDemand] = useState<DashboardDerivedDemandState | null>(null);
	const [summaryTeachingRoomCount, setSummaryTeachingRoomCount] = useState<number | null>(null);
	const [summaryTotalRoomCount, setSummaryTotalRoomCount] = useState<number | null>(null);
	const [summaryBuildingSetupStatus, setSummaryBuildingSetupStatus] = useState<BuildingSetupStatus | null>(null);
	const [summaryLifecyclePhase, setSummaryLifecyclePhase] = useState<LifecyclePhase | null>(null);
	const [readinessSourceState, setReadinessSourceState] = useState<DashboardReadinessSourceState>('checking_source');
	const [readinessSourceMessage, setReadinessSourceMessage] = useState('Checking readiness source.');
	const [readinessResolvedAt, setReadinessResolvedAt] = useState<string | null>(null);
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
		setViolationCount(cleared.violationCount);
		setAssignedCount(cleared.assignedCount);
		setUnassignedCount(cleared.unassignedCount);
		setHardViolationCount(cleared.hardViolationCount);
		setDerivedDemand(cleared.derivedDemand);
		setActiveSchoolYearId(cleared.activeSchoolYearId);
		setActiveSchoolYearLabel(cleared.activeSchoolYearLabel);
		setDomainAvailability(cleared.domainAvailability);
		setActiveTerm(null);
		setActiveTermPublished(null);
		setActiveTermUnassignedCount(null);
		setActiveTermHardViolationCount(null);
		setSummaryTeachingRoomCount(null);
		setSummaryTotalRoomCount(null);
		setSummaryBuildingSetupStatus(null);
		setSummaryLifecyclePhase(null);
	}, []);

	const refreshDashboard = useCallback(() => {
		setRefreshNonce((current) => current + 1);
	}, []);

	const retryActorScope = useCallback(() => {
		setActorScopeResolved(false);
		setActorScopeBlocked(null);
		resolveActorSchoolId().then((id) => {
			if (id != null) setActorSchoolId(id);
			setActorScopeResolved(true);
		});
	}, []);

	useEffect(() => {
		let cancelled = false;
		resolveActorSchoolId().then((id) => {
			if (cancelled) return;
			if (id != null) setActorSchoolId(id);
			setActorScopeResolved(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

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
				setViolationCount(summary.generation.violationCount);
				setSummaryTeachingRoomCount(summary.campus.teachingRoomCount);
				setSummaryTotalRoomCount(summary.campus.totalRoomCount);
				setSummaryBuildingSetupStatus(summary.campus.buildingSetupStatus);
				setSummaryLifecyclePhase(summary.lifecyclePhase);
				setReadinessSourceState(summary.sourceState);
				setReadinessSourceMessage(summary.sourceMessage);
				setReadinessResolvedAt(summary.resolvedAt);
				setDomainAvailability(availabilityFromSummary(summary));
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
					atlasApi.get<{ violations?: unknown[]; totalCount?: number }>(`/generation/${schoolId}/${syIdForTerm}/runs/latest/violations`, { params: { termIndex } })
						.then((r) => {
							if (cancelled) return;
							const total = typeof r.data.totalCount === 'number'
								? r.data.totalCount
								: Array.isArray(r.data.violations) ? r.data.violations.length : null;
							setActiveTermHardViolationCount(total);
						})
						.catch(() => { if (!cancelled) setActiveTermHardViolationCount(null); });
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
					setActiveTermHardViolationCount(null);
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

	const totalRoomCount = useMemo(() => summaryTotalRoomCount ?? buildings.reduce((sum, b) => sum + b.rooms.length, 0), [buildings, summaryTotalRoomCount]);
	const teachingRoomCount = useMemo(
		() => summaryTeachingRoomCount ?? buildings.reduce(
			(sum, b) => sum + (b.isTeachingBuilding !== false ? b.rooms.filter((r) => r.isTeachingSpace).length : 0),
			0,
		),
		[buildings, summaryTeachingRoomCount],
	);

	const buildingSetupStatus = useMemo<BuildingSetupStatus>(() => {
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
				subMessage = `${teachingBuildingsWithoutRooms.length} building${teachingBuildingsWithoutRooms.length !== 1 ? 's' : ''} have no rooms`;
			} else if (placeholderNamedBuildings.length > 0) {
				subMessage = `${placeholderNamedBuildings.length} building${placeholderNamedBuildings.length !== 1 ? 's' : ''} need a name`;
			}
		}
		return { done, subMessage };
	}, [buildings, summaryBuildingSetupStatus, domainAvailability.campus]);

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
		teachingRoomCount,
		totalRoomCount,
		buildingSetupStatus,
		dataSource,
		activeSchoolYearId,
		activeSchoolYearLabel,
		activeTerm,
		activeTermPublished,
		activeTermUnassignedCount,
		activeTermHardViolationCount,
		latestRunStatus,
		latestRunId,
		violationCount,
		assignedCount,
		unassignedCount,
		hardViolationCount,
		derivedDemand,
		lifecyclePhase,
		readinessSourceState,
		readinessSourceMessage,
		readinessResolvedAt,
		domainAvailability,
		refreshDashboard,
		retryActorScope,
	};
}
