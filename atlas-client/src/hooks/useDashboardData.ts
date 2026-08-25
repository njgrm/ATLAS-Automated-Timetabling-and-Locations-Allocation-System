import { useCallback, useEffect, useMemo, useState } from 'react';

import atlasApi from '@/lib/api';
import { isUpstreamBackedSchoolYearSource, resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { fetchSubjectCoverageSummary, countSubjectsWithMissingCoverage } from '@/lib/coverage';
import type { Building } from '@/types';

const DEFAULT_SCHOOL_ID = 1;

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
		violationCount: number | null;
		isPublished: boolean;
		createdAt: string | null;
		finishedAt: string | null;
	};
	lifecyclePhase: LifecyclePhase;
};

export type DashboardData = {
	loading: boolean;
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
	lifecyclePhase: LifecyclePhase;
	readinessSourceState: DashboardReadinessSourceState;
	readinessSourceMessage: string;
	readinessResolvedAt: string | null;
	refreshDashboard: () => void;
};

function toDataSource(sourceState: DashboardReadinessSourceState): DashboardData['dataSource'] {
	if (sourceState === 'verified_live') return 'live';
	if (sourceState === 'using_saved_data' || sourceState === 'partial_degraded') return 'cached';
	return 'none';
}

export function useDashboardData(): DashboardData {
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
	const [summaryTeachingRoomCount, setSummaryTeachingRoomCount] = useState<number | null>(null);
	const [summaryTotalRoomCount, setSummaryTotalRoomCount] = useState<number | null>(null);
	const [summaryBuildingSetupStatus, setSummaryBuildingSetupStatus] = useState<BuildingSetupStatus | null>(null);
	const [summaryLifecyclePhase, setSummaryLifecyclePhase] = useState<LifecyclePhase | null>(null);
	const [readinessSourceState, setReadinessSourceState] = useState<DashboardReadinessSourceState>('checking_source');
	const [readinessSourceMessage, setReadinessSourceMessage] = useState('Checking readiness source.');
	const [readinessResolvedAt, setReadinessResolvedAt] = useState<string | null>(null);
	const [refreshNonce, setRefreshNonce] = useState(0);

	const refreshDashboard = useCallback(() => {
		setRefreshNonce((current) => current + 1);
	}, []);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setReadinessSourceState('checking_source');
		setReadinessSourceMessage('Checking readiness source.');

		const loadLegacyDashboardData = () => Promise.all([
			atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
			atlasApi.get<{ campusImageUrl: string | null }>(`/map/schools/${DEFAULT_SCHOOL_ID}/campus-image`).catch(() => ({ data: { campusImageUrl: null } })),
			atlasApi.get<{ count: number; unassignedCount: number }>(`/subjects/stats/${DEFAULT_SCHOOL_ID}`).catch(() => ({ data: { count: 0, unassignedCount: 0 } })),
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
				atlasApi.get<{ faculty: unknown[] }>(`/faculty?schoolId=${DEFAULT_SCHOOL_ID}`)
					.then((fRes) => { if (!cancelled) setFacultyCount(fRes.data.faculty.length); })
					.catch(() => { if (!cancelled) setFacultyCount(null); });
				resolveActiveSchoolYearContext({ allowStaleOnError: true, allowEnrollProFallback: false })
					.then(async (context) => {
						if (cancelled) return;
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
								atlasApi.get<{ source?: { termScope?: string } }>(`/schools/${DEFAULT_SCHOOL_ID}/schedules/published`, { params: { termIndex: termIdx } })
									.then((r) => {
										if (!cancelled) setActiveTermPublished(r.data?.source?.termScope === 'explicit' || r.data?.source?.termScope === 'active');
									})
									.catch(() => { if (!cancelled) setActiveTermPublished(false); });
								// Fetch current-term violations
								atlasApi.get<{ violations?: unknown[]; totalCount?: number }>(`/generation/${DEFAULT_SCHOOL_ID}/${syIdForTerm}/runs/latest/violations`, { params: { termIndex: termIdx } })
									.then((r) => {
										if (cancelled) return;
										const total = typeof r.data.totalCount === 'number'
											? r.data.totalCount
											: Array.isArray(r.data.violations) ? r.data.violations.length : null;
										setActiveTermHardViolationCount(total);
									})
									.catch(() => { if (!cancelled) setActiveTermHardViolationCount(null); });
							}
						}
						// Override unassignedSubjectCount with subject-section coverage truth
						if (context.activeSchoolYearId) {
							fetchSubjectCoverageSummary(context.activeSchoolYearId)
								.then((coverage) => {
									if (!cancelled) {
										const missingIds = coverage.rows.filter((r) => r.uncoveredSectionCount > 0).map((r) => r.subjectId);
										setUnassignedSubjectCount(missingIds.length);
										setMissingCoverageSubjectIds(missingIds);
									}
								})
								.catch(() => { /* keep legacy stats value as degraded fallback */ });
						}
						if (!context.activeSchoolYearId) { setSectionCount(null); return; }
						const syId = context.activeSchoolYearId;
						// Sections summary
						atlasApi.get<{ totalSections: number }>(`/sections/summary/${syId}?schoolId=${DEFAULT_SCHOOL_ID}`)
							.then((r) => { if (!cancelled) setSectionCount(r.data.totalSections); })
							.catch(() => { if (!cancelled) setSectionCount(null); });
						// Latest generation run
						atlasApi.get<{ run: { id: number; status: string } | null }>(`/generation/${DEFAULT_SCHOOL_ID}/${syId}/runs/latest`)
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
							})
							.catch(() => { if (!cancelled) { setLatestRunStatus('NONE'); setLatestRunId(null); } });
						// Latest violations
						atlasApi.get<{ violations?: unknown[]; totalCount?: number }>(`/generation/${DEFAULT_SCHOOL_ID}/${syId}/runs/latest/violations`)
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

		atlasApi.get<DashboardReadinessSummary>('/dashboard/readiness-summary', { params: { schoolId: DEFAULT_SCHOOL_ID } })
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
				// Override unassignedSubjectCount with subject-section coverage truth
				if (summary.activeSchoolYearId) {
					fetchSubjectCoverageSummary(summary.activeSchoolYearId)
						.then((coverage) => {
							if (!cancelled) {
								const missingIds = coverage.rows.filter((r) => r.uncoveredSectionCount > 0).map((r) => r.subjectId);
								setUnassignedSubjectCount(missingIds.length);
								setMissingCoverageSubjectIds(missingIds);
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
			.catch(() => {
				void loadLegacyDashboardData();
			});

		return () => {
			cancelled = true;
		};
	}, [refreshNonce]);

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
		summaryLifecyclePhase,
	]);

	return {
		loading,
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
		lifecyclePhase,
		readinessSourceState,
		readinessSourceMessage,
		readinessResolvedAt,
		refreshDashboard,
	};
}
