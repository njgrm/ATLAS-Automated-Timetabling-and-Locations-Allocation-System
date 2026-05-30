import { useEffect, useMemo, useState } from 'react';

import atlasApi from '@/lib/api';
import { isUpstreamBackedSchoolYearSource, resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import type { Building } from '@/types';

const DEFAULT_SCHOOL_ID = 1;

export type BuildingSetupStatus = {
	done: boolean;
	subMessage?: string;
};

export type LifecyclePhase = 'SETUP' | 'PREFERENCES' | 'GENERATION' | 'REVIEW' | 'PUBLISHED';

export type LatestRunStatus = 'NONE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type DashboardData = {
	loading: boolean;
	buildings: Building[];
	campusImageUrl: string | null;
	subjectCount: number | null;
	facultyCount: number | null;
	sectionCount: number | null;
	unassignedSubjectCount: number | null;
	teachingRoomCount: number;
	totalRoomCount: number;
	buildingSetupStatus: BuildingSetupStatus;
	dataSource: 'live' | 'cached' | 'none';
	activeSchoolYearId: number | null;
	activeSchoolYearLabel: string | null;
	latestRunStatus: LatestRunStatus;
	latestRunId: number | null;
	violationCount: number | null;
	lifecyclePhase: LifecyclePhase;
};

export function useDashboardData(): DashboardData {
	const [buildings, setBuildings] = useState<Building[]>([]);
	const [campusImageUrl, setCampusImageUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [subjectCount, setSubjectCount] = useState<number | null>(null);
	const [facultyCount, setFacultyCount] = useState<number | null>(null);
	const [sectionCount, setSectionCount] = useState<number | null>(null);
	const [unassignedSubjectCount, setUnassignedSubjectCount] = useState<number | null>(null);
	const [dataSource, setDataSource] = useState<'live' | 'cached' | 'none'>('none');
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [activeSchoolYearLabel, setActiveSchoolYearLabel] = useState<string | null>(null);
	const [latestRunStatus, setLatestRunStatus] = useState<LatestRunStatus>('NONE');
	const [latestRunId, setLatestRunId] = useState<number | null>(null);
	const [violationCount, setViolationCount] = useState<number | null>(null);

	useEffect(() => {
		setLoading(true);
		Promise.all([
			atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
			atlasApi.get<{ campusImageUrl: string | null }>(`/map/schools/${DEFAULT_SCHOOL_ID}/campus-image`).catch(() => ({ data: { campusImageUrl: null } })),
			atlasApi.get<{ count: number; unassignedCount: number }>(`/subjects/stats/${DEFAULT_SCHOOL_ID}`).catch(() => ({ data: { count: 0, unassignedCount: 0 } })),
		])
			.then(([bRes, campusImageRes, statsRes]) => {
				setBuildings(bRes.data.buildings);
				setCampusImageUrl(campusImageRes.data.campusImageUrl ?? null);
				setSubjectCount(statsRes.data.count);
				setUnassignedSubjectCount(statsRes.data.unassignedCount ?? 0);
				atlasApi.get<{ faculty: unknown[] }>(`/faculty?schoolId=${DEFAULT_SCHOOL_ID}`)
					.then((fRes) => setFacultyCount(fRes.data.faculty.length))
					.catch(() => setFacultyCount(null));
				resolveActiveSchoolYearContext({ allowStaleOnError: true, allowEnrollProFallback: false })
					.then(async (context) => {
						setDataSource(isUpstreamBackedSchoolYearSource(context.source) ? 'live' : 'cached');
						setActiveSchoolYearId(context.activeSchoolYearId ?? null);
						setActiveSchoolYearLabel(context.activeSchoolYearLabel ?? null);
						if (!context.activeSchoolYearId) { setSectionCount(null); return; }
						const syId = context.activeSchoolYearId;
						// Sections summary
						atlasApi.get<{ totalSections: number }>(`/sections/summary/${syId}?schoolId=${DEFAULT_SCHOOL_ID}`)
							.then((r) => setSectionCount(r.data.totalSections))
							.catch(() => setSectionCount(null));
						// Latest generation run
						atlasApi.get<{ run: { id: number; status: string } | null }>(`/generation/${DEFAULT_SCHOOL_ID}/${syId}/runs/latest`)
							.then((r) => {
								const run = r.data.run;
								if (!run) { setLatestRunStatus('NONE'); setLatestRunId(null); return; }
								setLatestRunId(run.id);
								const s = (run.status || '').toUpperCase();
								if (s === 'COMPLETED' || s === 'SUCCESS') setLatestRunStatus('COMPLETED');
								else if (s === 'IN_PROGRESS' || s === 'RUNNING' || s === 'PENDING') setLatestRunStatus('IN_PROGRESS');
								else if (s === 'FAILED' || s === 'ERROR') setLatestRunStatus('FAILED');
								else setLatestRunStatus('NONE');
							})
							.catch(() => { setLatestRunStatus('NONE'); setLatestRunId(null); });
						// Latest violations
						atlasApi.get<{ violations?: unknown[]; totalCount?: number }>(`/generation/${DEFAULT_SCHOOL_ID}/${syId}/runs/latest/violations`)
							.then((r) => {
								const total = typeof r.data.totalCount === 'number'
									? r.data.totalCount
									: Array.isArray(r.data.violations) ? r.data.violations.length : null;
								setViolationCount(total);
							})
							.catch(() => setViolationCount(null));
					})
					.catch(() => setSectionCount(null));
			})
			.catch(() => setBuildings([]))
			.finally(() => setLoading(false));
	}, []);

	const totalRoomCount = useMemo(() => buildings.reduce((sum, b) => sum + b.rooms.length, 0), [buildings]);
	const teachingRoomCount = useMemo(
		() => buildings.reduce(
			(sum, b) => sum + (b.isTeachingBuilding !== false ? b.rooms.filter((r) => r.isTeachingSpace).length : 0),
			0,
		),
		[buildings],
	);

	const buildingSetupStatus = useMemo<BuildingSetupStatus>(() => {
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
	}, [buildings]);

	const lifecyclePhase = useMemo<LifecyclePhase>(() => {
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
	]);

	return {
		loading,
		buildings,
		campusImageUrl,
		subjectCount,
		facultyCount,
		sectionCount,
		unassignedSubjectCount,
		teachingRoomCount,
		totalRoomCount,
		buildingSetupStatus,
		dataSource,
		activeSchoolYearId,
		activeSchoolYearLabel,
		latestRunStatus,
		latestRunId,
		violationCount,
		lifecyclePhase,
	};
}
