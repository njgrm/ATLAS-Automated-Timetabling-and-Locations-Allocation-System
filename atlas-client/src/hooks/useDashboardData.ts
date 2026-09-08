import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import atlasApi from '@/lib/api';
import { isUpstreamBackedSchoolYearSource, resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
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

export type DashboardCurriculumState = {
	ready: boolean;
	termConfigPresent: boolean;
	requirementCount: number;
	blockerCode: string | null;
	blockerMessage: string | null;
} | null;

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
		latestRunStatus: 'NONE' as LatestRunStatus,
		latestRunId: null as number | null,
		violationCount: null as number | null,
		assignedCount: null as number | null,
		unassignedCount: null as number | null,
		hardViolationCount: null as number | null,
		curriculum: null as DashboardCurriculumState,
		activeSchoolYearId: null as number | null,
		activeSchoolYearLabel: null as string | null,
	};
}

type DashboardReadinessSummary = {
	schoolId: number;
	activeSchoolYearId: number | null;
	activeSchoolYearLabel: string | null;
	resolvedAt: string;
	sourceState: DashboardReadinessSourceState;
	sourceMessage: string;
	campus: {
		buildings: Building[];
		campusImageUrl: string | null;
		teachingRoomCount: number;
		totalRoomCount: number;
		buildingSetupStatus: BuildingSetupStatus;
	};
	subjects: {
		subjectCount: number;
		unassignedSubjectCount: number;
	};
	faculty: {
		facultyCount: number;
		lastSyncedAt: string | null;
	};
	sections: {
		sectionCount: number | null;
		lastSyncedAt: string | null;
	};
	generation: {
		latestRunStatus: LatestRunStatus;
		latestRunId: number | null;
		publishedRunId: number | null;
		violationCount: number | null;
		isPublished: boolean;
		createdAt: string | null;
		finishedAt: string | null;
	};
	curriculum: DashboardCurriculumState;
	lifecyclePhase: LifecyclePhase;
};

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
	latestRunStatus: LatestRunStatus;
	latestRunId: number | null;
	violationCount: number | null;
	assignedCount: number | null;
	unassignedCount: number | null;
	hardViolationCount: number | null;
	curriculum: DashboardCurriculumState;
	lifecyclePhase: LifecyclePhase;
	readinessSourceState: DashboardReadinessSourceState;
	readinessSourceMessage: string;
	readinessResolvedAt: string | null;
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
	const [latestRunStatus, setLatestRunStatus] = useState<LatestRunStatus>('NONE');
	const [latestRunId, setLatestRunId] = useState<number | null>(null);
	const [violationCount, setViolationCount] = useState<number | null>(null);
	const [assignedCount, setAssignedCount] = useState<number | null>(null);
	const [unassignedCount, setUnassignedCount] = useState<number | null>(null);
	const [hardViolationCount, setHardViolationCount] = useState<number | null>(null);
	const [curriculum, setCurriculum] = useState<DashboardCurriculumState>(null);
	const [summaryTeachingRoomCount, setSummaryTeachingRoomCount] = useState<number | null>(null);
	const [summaryTotalRoomCount, setSummaryTotalRoomCount] = useState<number | null>(null);
	const [summaryBuildingSetupStatus, setSummaryBuildingSetupStatus] = useState<BuildingSetupStatus | null>(null);
	const [summaryLifecyclePhase, setSummaryLifecyclePhase] = useState<LifecyclePhase | null>(null);
	const [readinessSourceState, setReadinessSourceState] = useState<DashboardReadinessSourceState>('checking_source');
	const [readinessSourceMessage, setReadinessSourceMessage] = useState('Checking readiness source.');
	const [readinessResolvedAt, setReadinessResolvedAt] = useState<string | null>(null);
	const [refreshNonce, setRefreshNonce] = useState(0);
	const boundActorRef = useRef<number | null>(null);

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
		setCurriculum(cleared.curriculum);
		setActiveSchoolYearId(cleared.activeSchoolYearId);
		setActiveSchoolYearLabel(cleared.activeSchoolYearLabel);
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
		// rebind every request to the new school.
		if (boundActorRef.current !== scope.schoolId) {
			boundActorRef.current = scope.schoolId;
			resetDomainState();
		}
		setActorScopeBlocked(null);

		const schoolId = scope.schoolId;
		setLoading(true);
		setReadinessSourceState('checking_source');
		setReadinessSourceMessage('Checking readiness source.');

		const loadLegacyDashboardData = () => Promise.all([
			atlasApi.get<{ buildings: Building[] }>(`/map/schools/${schoolId}/buildings`),
			atlasApi.get<{ campusImageUrl: string | null }>(`/map/schools/${schoolId}/campus-image`).catch(() => ({ data: { campusImageUrl: null } })),
			atlasApi.get<{ count: number; unassignedCount: number }>(`/subjects/stats/${schoolId}`).catch(() => ({ data: { count: 0, unassignedCount: 0 } })),
		])
			.then(([bRes, campusImageRes, statsRes]) => {
				if (cancelled) return;
				setBuildings(bRes.data.buildings);
				setCampusImageUrl(campusImageRes.data.campusImageUrl ?? null);
				setSubjectCount(statsRes.data.count);
				setUnassignedSubjectCount(statsRes.data.unassignedCount ?? 0);
				setSummaryTeachingRoomCount(null);
				setSummaryTotalRoomCount(null);
				setSummaryBuildingSetupStatus(null);
				setSummaryLifecyclePhase(null);
				atlasApi.get<{ faculty: unknown[] }>(`/faculty?schoolId=${schoolId}`)
					.then((fRes) => { if (!cancelled) setFacultyCount(fRes.data.faculty.length); })
					.catch(() => { if (!cancelled) setFacultyCount(null); });
				resolveActiveSchoolYearContext({ allowStaleOnError: true, allowEnrollProFallback: false })
					.then(async (initialContext) => {
						if (cancelled) return;
						let context = initialContext;
						// EVAL-C01: never inherit another school's cached year
						// context. Refresh once; a persisting mismatch blocks
						// every year-scoped request below.
						if (context.schoolId != null && context.schoolId !== schoolId) {
							try {
								const refreshed = await resolveActiveSchoolYearContext({ forceRefresh: true, allowStaleOnError: true, allowEnrollProFallback: false });
								if (cancelled) return;
								context = refreshed;
							} catch {
								if (!cancelled) {
									setActorScopeBlocked('The active-year context belongs to a different school. No dashboard data was loaded.');
									setLoading(false);
								}
								return;
							}
							if (context.schoolId != null && context.schoolId !== schoolId) {
								if (!cancelled) {
									setActorScopeBlocked('The active-year context belongs to a different school. No dashboard data was loaded.');
									setSectionCount(null);
									setLoading(false);
								}
								return;
							}
						}
						setDataSource(isUpstreamBackedSchoolYearSource(context.source) ? 'live' : 'cached');
						setReadinessSourceState(isUpstreamBackedSchoolYearSource(context.source) ? 'verified_live' : 'using_saved_data');
						setReadinessSourceMessage(isUpstreamBackedSchoolYearSource(context.source) ? 'Verified live readiness data.' : 'Using saved readiness data.');
						setReadinessResolvedAt(context.cachedAt);
						setActiveSchoolYearId(context.activeSchoolYearId ?? null);
						setActiveSchoolYearLabel(context.activeSchoolYearLabel ?? null);
						if (context.activeTerm?.activeTerm) {
							setActiveTerm({ activeTerm: context.activeTerm.activeTerm, termIndex: context.activeTerm.termIndex });
							// Fetch current-term readiness data
							const termIdx = context.activeTerm.termIndex;
							const syIdForTerm = context.activeSchoolYearId;
							if (termIdx && syIdForTerm) {
								// Check if current term has published schedule
								atlasApi.get<{ source?: { termScope?: string } }>(`/schools/${schoolId}/schedules/published`, { params: { termIndex: termIdx } })
									.then((r) => {
										if (!cancelled) setActiveTermPublished(r.data?.source?.termScope === 'explicit' || r.data?.source?.termScope === 'active');
									})
									.catch(() => { if (!cancelled) setActiveTermPublished(false); });
								// Fetch current-term violations
								atlasApi.get<{ violations?: unknown[]; totalCount?: number }>(`/generation/${schoolId}/${syIdForTerm}/runs/latest/violations`, { params: { termIndex: termIdx } })
									.then((r) => {
										if (cancelled) return;
										const total = typeof r.data.totalCount === 'number'
											? r.data.totalCount
											: Array.isArray(r.data.violations) ? r.data.violations.length : null;
										setActiveTermHardViolationCount(total);
									})
									.catch(() => { if (!cancelled) setActiveTermHardViolationCount(null); });
								// Fetch current-term unassigned count from latest run
								atlasApi.get<{ run?: { unassignedItems?: Array<{ termIndex?: number }> } }>(`/generation/${schoolId}/${syIdForTerm}/runs/latest`)
									.then((r) => {
										if (cancelled) return;
										const unassigned = r.data.run?.unassignedItems;
										if (Array.isArray(unassigned)) {
											const termUnassigned = unassigned.filter((item) => item.termIndex === termIdx);
											setActiveTermUnassignedCount(termUnassigned.length);
										} else {
											setActiveTermUnassignedCount(null);
										}
									})
									.catch(() => { if (!cancelled) setActiveTermUnassignedCount(null); });
							}
						}
						// Override unassignedSubjectCount with subject-section coverage truth (actor-scoped)
						if (context.activeSchoolYearId) {
							fetchActorCoverageSummary(schoolId, context.activeSchoolYearId)
								.then((coverage) => {
									if (!cancelled) {
										setUnassignedSubjectCount(countSubjectsWithMissingCoverage(coverage));
										setMissingCoverageSubjectIds(coverage.rows.filter((r) => r.uncoveredSectionCount > 0).map((r) => r.subjectId));
									}
								})
								.catch(() => { /* keep legacy stats value as degraded fallback */ });
						}
						if (!context.activeSchoolYearId) { setSectionCount(null); return; }
						const syId = context.activeSchoolYearId;
						// Curriculum Requirements readiness (existing read contract only)
						atlasApi.get<{ readiness: { ready: boolean; termConfigPresent: boolean; requirementCount: number; blockers: Array<{ code: string; message: string }> } }>(`/curriculum-requirements/${syId}/readiness`)
							.then((r) => {
								if (cancelled) return;
								const readiness = r.data.readiness;
								const blocker = readiness.blockers[0] ?? null;
								setCurriculum({
									ready: readiness.ready,
									termConfigPresent: readiness.termConfigPresent,
									requirementCount: readiness.requirementCount,
									blockerCode: blocker?.code ?? null,
									blockerMessage: blocker?.message ?? null,
								});
							})
							.catch(() => { if (!cancelled) setCurriculum(null); });
						// Sections summary
						atlasApi.get<{ totalSections: number }>(`/sections/summary/${syId}?schoolId=${schoolId}`)
							.then((r) => { if (!cancelled) setSectionCount(r.data.totalSections); })
							.catch(() => { if (!cancelled) setSectionCount(null); });
						// Latest generation run
						atlasApi.get<{ run: { id: number; status: string; summary?: { assignedCount?: number; unassignedCount?: number; hardViolationCount?: number } } | null }>(`/generation/${schoolId}/${syId}/runs/latest`)
							.then((r) => {
								if (cancelled) return;
								const run = r.data.run;
								if (!run) { setLatestRunStatus('NONE'); setLatestRunId(null); return; }
								setLatestRunId(run.id);
								const s = (run.status || '').toUpperCase();
								if (s === 'COMPLETED' || s === 'SUCCESS') setLatestRunStatus('COMPLETED');
								else if (s === 'IN_PROGRESS' || s === 'RUNNING' || s === 'PENDING') setLatestRunStatus('IN_PROGRESS');
								else if (s === 'FAILED' || s === 'ERROR') setLatestRunStatus('FAILED');
								else setLatestRunStatus('NONE');
								// Extract summary fields for run health donut
								if (run.summary) {
									setAssignedCount(run.summary.assignedCount ?? null);
									setUnassignedCount(run.summary.unassignedCount ?? null);
									setHardViolationCount(run.summary.hardViolationCount ?? null);
								}
							})
							.catch(() => { if (!cancelled) { setLatestRunStatus('NONE'); setLatestRunId(null); } });
						// Latest violations
						atlasApi.get<{ violations?: unknown[]; totalCount?: number }>(`/generation/${schoolId}/${syId}/runs/latest/violations`)
							.then((r) => {
								if (cancelled) return;
								const total = typeof r.data.totalCount === 'number'
									? r.data.totalCount
									: Array.isArray(r.data.violations) ? r.data.violations.length : null;
								setViolationCount(total);
							})
							.catch(() => { if (!cancelled) setViolationCount(null); });
					})
					.catch(() => {
						if (!cancelled) {
							setSectionCount(null);
							setReadinessSourceState('partial_degraded');
							setReadinessSourceMessage('Some readiness sources are unavailable.');
						}
					});
			})
			.catch(() => {
				if (!cancelled) {
					setBuildings([]);
					setDataSource('none');
					setReadinessSourceState('no_saved_data');
					setReadinessSourceMessage('No saved readiness data is available yet.');
				}
			})
			.finally(() => { if (!cancelled) setLoading(false); });

		atlasApi.get<DashboardReadinessSummary>('/dashboard/readiness-summary', { params: { schoolId } })
			.then((response) => {
				if (cancelled) return;
				const summary = response.data;
				setBuildings(summary.campus.buildings ?? []);
				setCampusImageUrl(summary.campus.campusImageUrl ?? null);
				setSubjectCount(summary.subjects.subjectCount);
				setUnassignedSubjectCount(summary.subjects.unassignedSubjectCount);
				setFacultyCount(summary.faculty.facultyCount);
				setSectionCount(summary.sections.sectionCount);
				setDataSource(toDataSource(summary.sourceState));
				setActiveSchoolYearId(summary.activeSchoolYearId);
				setActiveSchoolYearLabel(summary.activeSchoolYearLabel);
				setCurriculum(summary.curriculum ?? null);
				// Override unassignedSubjectCount with subject-section coverage truth (actor-scoped)
				if (summary.activeSchoolYearId) {
					fetchActorCoverageSummary(schoolId, summary.activeSchoolYearId)
						.then((coverage) => {
							if (!cancelled) {
								setUnassignedSubjectCount(countSubjectsWithMissingCoverage(coverage));
								setMissingCoverageSubjectIds(coverage.rows.filter((r) => r.uncoveredSectionCount > 0).map((r) => r.subjectId));
							}
						})
						.catch(() => { /* keep readiness-summary value as degraded fallback */ });
				}
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
				setLoading(false);
			})
			.catch((error) => {
				// EVAL-C01: a scope rejection is authoritative — never fall
				// through to legacy requests for another (or no) school.
				if (error?.response?.status === 403) {
					if (!cancelled) {
						resetDomainState();
						setDataSource('none');
						setReadinessSourceState('no_saved_data');
						setReadinessSourceMessage('We could not confirm your school. Sign in again before reviewing setup.');
						setActorScopeBlocked('ATLAS rejected this school request. No dashboard data was loaded.');
						setLoading(false);
					}
					return;
				}
				void loadLegacyDashboardData();
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
	}, [buildings, summaryBuildingSetupStatus]);

	const lifecyclePhase = useMemo<LifecyclePhase>(() => {
		if (summaryLifecyclePhase) return summaryLifecyclePhase;
		// EVAL-C01: the local fallback derives from the same coherent
		// snapshot, and it never claims PUBLISHED — only the guarded server
		// snapshot may report a published schedule.
		if (curriculum !== null && !curriculum.ready) return 'SETUP';
		const setupReady =
			(subjectCount ?? 0) > 0 &&
			(facultyCount ?? 0) > 0 &&
			(unassignedSubjectCount ?? 1) === 0 &&
			(sectionCount ?? 0) > 0 &&
			buildingSetupStatus.done;
		if (!setupReady) return 'SETUP';
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
		curriculum,
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
		curriculum,
		lifecyclePhase,
		readinessSourceState,
		readinessSourceMessage,
		readinessResolvedAt,
		refreshDashboard,
		retryActorScope,
	};
}
