import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import {
	buildAssignmentSignature,
	buildMultiOwnerSavedMap,
	buildOwnershipMap,
	buildOwnershipMapFromIndex,
	buildPendingOwnershipMap,
	buildEffectiveOwnershipMap,
	buildSectionMap,
	normalizeDraftAssignments,
	type FacultyAssignmentDraft,
	type SubjectSectionOwnershipIndexEntry,
} from '@/lib/faculty-assignment-helpers';
import {
	resolveActiveSchoolYearContext,
	type ActiveSchoolYearContextSource,
	isUpstreamBackedSchoolYearSource,
} from '@/lib/enrollpro-public-settings';
import { resolveActorSchoolId } from '@/lib/settings';
import { teachingLoadScopeParams } from '@/lib/faculty-assignment-helpers';
import {
	getCachedFacultyAssignmentsSummary,
	getCachedSectionSummary,
	getCachedSubjects,
	normalizeFacultySummarySnapshot,
	requestWithRetry,
	setCachedFacultyAssignmentsSummary,
	setCachedSectionSummary,
	setCachedSubjects,
	type FacultySummarySnapshot,
	type EffectiveWorkloadPolicyState,
	type WorkloadPolicyReadiness,
} from '@/lib/faculty-teaching-load-cache';
import { useAssignmentHistory } from '@/hooks/useAssignmentHistory';
import type {
	ExternalSection,
	HomeroomHintResponse,
	SectionAssignedClassesIndexResult,
	SectionSummaryResponse,
	Subject,
	FacultyAssignmentRecord,
	FacultySummary,
	TeachingLoadCoverageTotals,
	TeachingLoadIntegrityDiagnostics,
	TeachingLoadSplitBrainReconcileResult,
} from '@/types';

export function useTeachingLoadData() {
	const [searchParams, setSearchParams] = useSearchParams();
	const [faculty, setFaculty] = useState<FacultySummary[]>([]);
	const [schoolId, setSchoolId] = useState<number | null>(null);
	const [activeSchoolYearLabel, setActiveSchoolYearLabel] = useState<string | null>(null);
	const [subjects, setSubjects] = useState<Subject[]>([]);
	const [sectionSummary, setSectionSummary] = useState<SectionSummaryResponse | null>(null);
	const [sectionAssignedClassesIndex, setSectionAssignedClassesIndex] = useState<SectionAssignedClassesIndexResult | null>(null);
	const [savedOwnershipIndex, setSavedOwnershipIndex] = useState<SubjectSectionOwnershipIndexEntry[]>([]);
	const [coverageTotals, setCoverageTotals] = useState<TeachingLoadCoverageTotals | null>(null);
	const [workloadPolicy, setWorkloadPolicy] = useState<EffectiveWorkloadPolicyState | null>(null);
	const [workloadPolicyStatus, setWorkloadPolicyStatus] = useState<WorkloadPolicyReadiness>('UNCONFIGURED');
	const [integrityDiagnostics, setIntegrityDiagnostics] = useState<TeachingLoadIntegrityDiagnostics | null>(null);
	const [splitBrainIncident, setSplitBrainIncident] = useState<TeachingLoadSplitBrainReconcileResult | null>(null);
	const [splitBrainLoading, setSplitBrainLoading] = useState(false);
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [activeTermIndex, setActiveTermIndex] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [selectedId, setSelectedId] = useState<number | null>(() => {
		const queryValue = searchParams.get('facultyId');
		return queryValue ? Number(queryValue) : null;
	});
	const [subjectFocusId, setSubjectFocusId] = useState<number | null>(() => {
		const queryValue = searchParams.get('subjectId');
		if (!queryValue) return null;
		const parsed = Number(queryValue);
		return Number.isNaN(parsed) ? null : parsed;
	});
	const [sectionFocusId, setSectionFocusId] = useState<number | null>(() => {
		const queryValue = searchParams.get('sectionId');
		if (!queryValue) return null;
		const parsed = Number(queryValue);
		return Number.isNaN(parsed) ? null : parsed;
	});
	const [dataSource, setDataSource] = useState<'live' | 'cached' | 'refreshing' | 'none'>('none');
	const [degradedNotice, setDegradedNotice] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(() => navigator.onLine);
	const [homeroomHint, setHomeroomHint] = useState<HomeroomHintResponse | null>(null);
	const [draftAssignmentsByFaculty, setDraftAssignmentsByFaculty] = useState<Record<number, FacultyAssignmentDraft[]>>({});
	const [error, setError] = useState<string | null>(null);

	const hasSectionWorkspaceEvidence =
		(sectionAssignedClassesIndex?.sections?.length ?? 0) > 0
		|| (sectionSummary?.sections?.length ?? 0) > 0;

	const hasLocalWriteEvidence = Boolean(
		activeSchoolYearId
		&& hasSectionWorkspaceEvidence
		&& subjects.length > 0
		&& faculty.length > 0,
	);
	const hasSettledRuntimeSource = dataSource === 'live' || dataSource === 'cached';
	const degradedWriteEnabled = isOnline && dataSource === 'cached' && hasLocalWriteEvidence;
	// Integrity diagnostics remain review guidance; they never freeze the whole
	// workspace because editing is the operator's path to resolve affected rows.
	const canPersistAssignments = isOnline && Boolean(activeSchoolYearId) && (dataSource === 'live' || hasLocalWriteEvidence);
	const canRunStaffingNeeds = isOnline && hasSettledRuntimeSource && Boolean(activeSchoolYearId);
	const canRunGlobalReset = isOnline && dataSource === 'live' && Boolean(activeSchoolYearId);
	const isReadOnlyMode = !canPersistAssignments;

	const activeFacultyIds = useMemo(() => new Set(faculty.map((f) => f.id)), [faculty]);

	const fetchSplitBrainIncident = useCallback(async (splitBrainSchoolId: number, schoolYearId: number) => {
		setSplitBrainLoading(true);
		try {
			const { data } = await atlasApi.post<TeachingLoadSplitBrainReconcileResult>(
				'/faculty-assignments/integrity/reconcile-split-brain',
				{
					schoolId: splitBrainSchoolId,
					schoolYearId,
					previewOnly: true,
				},
			);
			setSplitBrainIncident(data);
		} catch {
			setSplitBrainIncident(null);
		} finally {
			setSplitBrainLoading(false);
		}
	}, []);

	const fetchData = useCallback(async (options?: { forceRefresh?: boolean }) => {
		const forceRefresh = options?.forceRefresh === true;
		setLoading(true);
		setError(null);

		let schoolYearId: number | null = null;
		let resolvedSchoolId: number | null = null;
		let yearContextSource: ActiveSchoolYearContextSource = 'cache';

		try {
			// Actor school first: the authenticated session owns the school scope.
			// No fallback to a hardcoded school literal — unresolved stays an error.
			const actorSchoolId = await resolveActorSchoolId();
			if (actorSchoolId == null) {
				throw Object.assign(new Error('Teaching Load needs a signed-in scheduler account with a school assignment.'), {
					code: 'SCHOOL_UNRESOLVED',
				});
			}
			const schoolYearContext = await resolveActiveSchoolYearContext({
				schoolId: actorSchoolId,
				forceRefresh,
				allowEnrollProFallback: false,
			});
			const scope = teachingLoadScopeParams(actorSchoolId, schoolYearContext.activeSchoolYearId);
			resolvedSchoolId = scope.schoolId;
			// Local const: non-null inside this try block (also safe inside closures below).
			const school = scope.schoolId;
			setSchoolId(school);
			setActiveSchoolYearLabel(schoolYearContext.activeSchoolYearLabel ?? null);
			schoolYearId = scope.schoolYearId;
			yearContextSource = schoolYearContext.source;
			setActiveTermIndex(schoolYearContext.activeTerm?.termIndex ?? null);

			if (!forceRefresh) {
				const cachedSummary = getCachedFacultyAssignmentsSummary(school, schoolYearId, {
					maxAgeMs: 3 * 60 * 1000,
				});
				const cachedSubjects = getCachedSubjects(school, { maxAgeMs: 3 * 60 * 1000 });
				const cachedSections = getCachedSectionSummary(school, schoolYearId, { maxAgeMs: 3 * 60 * 1000 });

				if (cachedSummary && cachedSubjects && cachedSections) {
					setActiveSchoolYearId(schoolYearId);
					setFaculty(cachedSummary.data.faculty);
					setSavedOwnershipIndex(cachedSummary.data.ownershipIndex ?? []);
					setCoverageTotals(cachedSummary.data.coverageTotals ?? null);
					setIntegrityDiagnostics(cachedSummary.data.integrityDiagnostics ?? null);
					setWorkloadPolicy(cachedSummary.data.workloadPolicy ?? null);
					setWorkloadPolicyStatus(cachedSummary.data.workloadPolicyStatus ?? 'UNCONFIGURED');
					setSubjects(cachedSubjects.data);
					setSectionSummary(cachedSections.data);
					setDataSource(isOnline ? 'refreshing' : 'cached');
					setDegradedNotice(
						isOnline
							? 'Verifying live teaching load data before enabling edits. Showing your last saved snapshot in the meantime.'
							: 'Offline mode: showing your last saved teaching load snapshot in read-only mode.',
					);
					setLoading(false);
				}
			}

			const [facultyRes, subjectsRes, sectionsRes, sectionAssignedClassesRes] = await Promise.all([
				requestWithRetry(
					() =>
						atlasApi.get<{
							faculty: FacultySummary[];
							ownershipIndex?: SubjectSectionOwnershipIndexEntry[];
							coverageTotals?: TeachingLoadCoverageTotals;
							integrityDiagnostics?: TeachingLoadIntegrityDiagnostics;
							workloadPolicy?: EffectiveWorkloadPolicyState | null;
							workloadPolicyStatus?: WorkloadPolicyReadiness;
							fetchedAt?: string | null;
						}>						(
							'/faculty-assignments/summary',
							{ params: { schoolId: school, schoolYearId } },
						),
					{ attempts: 2, delayMs: 400 },
				),
				requestWithRetry(
					() => atlasApi.get<{ subjects: Subject[] }>('/subjects', { params: { schoolId: school } }),
					{ attempts: 2, delayMs: 300 },
				),
				requestWithRetry(
					() => atlasApi.get<SectionSummaryResponse>(`/sections/summary/${schoolYearId}`, { params: { schoolId: school } }),
					{ attempts: 2, delayMs: 400 },
				),
				requestWithRetry(
					() => atlasApi.get<SectionAssignedClassesIndexResult>('/sections/assigned-classes', {
						params: { schoolId: school, schoolYearId, includeDiagnostics: true },
					}),
					{ attempts: 2, delayMs: 400 },
				),
			]);

			const normalizedSummary = normalizeFacultySummarySnapshot({
				faculty: facultyRes.data.faculty,
				ownershipIndex: facultyRes.data.ownershipIndex ?? [],
				coverageTotals: facultyRes.data.coverageTotals,
				integrityDiagnostics: facultyRes.data.integrityDiagnostics,
				workloadPolicy: facultyRes.data.workloadPolicy ?? null,
				workloadPolicyStatus: facultyRes.data.workloadPolicyStatus ?? 'UNCONFIGURED',
				fetchedAt: facultyRes.data.fetchedAt ?? null,
				schoolYearId,
			});
			if (!normalizedSummary) {
				throw new Error('Teaching Load summary payload is incompatible with the current client contract.');
			}
			const normalizedSubjects = Array.isArray(subjectsRes.data.subjects) ? subjectsRes.data.subjects : [];
			const normalizedSectionSummary = {
				...sectionsRes.data,
				sections: Array.isArray((sectionsRes.data as any)?.sections) ? (sectionsRes.data as any).sections : [],
				gradeLevels: Array.isArray((sectionsRes.data as any)?.gradeLevels) ? (sectionsRes.data as any).gradeLevels : [],
				contractWarnings: Array.isArray((sectionsRes.data as any)?.contractWarnings) ? (sectionsRes.data as any).contractWarnings : [],
			};

			setActiveSchoolYearId(schoolYearId);
			setFaculty(normalizedSummary.faculty);
			setSavedOwnershipIndex(normalizedSummary.ownershipIndex);
			setCoverageTotals(normalizedSummary.coverageTotals ?? null);
			setIntegrityDiagnostics(normalizedSummary.integrityDiagnostics ?? null);
			setWorkloadPolicy(normalizedSummary.workloadPolicy ?? null);
			setWorkloadPolicyStatus(normalizedSummary.workloadPolicyStatus ?? 'UNCONFIGURED');
			setSubjects(normalizedSubjects);
			setSectionSummary(normalizedSectionSummary as SectionSummaryResponse);
			setSectionAssignedClassesIndex(sectionAssignedClassesRes.data);
			setCachedFacultyAssignmentsSummary(school, schoolYearId, normalizedSummary);
			setCachedSubjects(school, normalizedSubjects);
			setCachedSectionSummary(school, schoolYearId, normalizedSectionSummary as SectionSummaryResponse);
			const isUpstreamContext = isUpstreamBackedSchoolYearSource(yearContextSource);
			const isUpstreamBacked = isUpstreamContext && normalizedSectionSummary.source === 'enrollpro';
			setDataSource(isUpstreamBacked ? 'live' : 'cached');
			setDegradedNotice(
				isUpstreamBacked
					? null
					: isUpstreamContext
					? 'Teaching load context is sourced from ATLAS mirror. EnrollPro connection is active.'
					: 'Teaching load data is available from ATLAS runtime cache while upstream verification is unavailable.',
			);
			setError(null);
			if (schoolYearId) {
				void fetchSplitBrainIncident(school, schoolYearId);
			}
		} catch (requestError: any) {
			const cachedSummary = schoolYearId && resolvedSchoolId ? getCachedFacultyAssignmentsSummary(resolvedSchoolId, schoolYearId) : null;
			const cachedSubjects = resolvedSchoolId ? getCachedSubjects(resolvedSchoolId) : null;
			const cachedSections = schoolYearId && resolvedSchoolId ? getCachedSectionSummary(resolvedSchoolId, schoolYearId) : null;

			if (schoolYearId && cachedSummary && cachedSubjects && cachedSections) {
				setActiveSchoolYearId(schoolYearId);
				setFaculty(cachedSummary.data.faculty);
				setSavedOwnershipIndex(cachedSummary.data.ownershipIndex ?? []);
				setCoverageTotals(cachedSummary.data.coverageTotals ?? null);
				setIntegrityDiagnostics(cachedSummary.data.integrityDiagnostics ?? null);
				setWorkloadPolicy(cachedSummary.data.workloadPolicy ?? null);
				setWorkloadPolicyStatus(cachedSummary.data.workloadPolicyStatus ?? 'UNCONFIGURED');
				setSubjects(cachedSubjects.data);
				setSectionSummary(cachedSections.data);
				setSectionAssignedClassesIndex(null);
				setDataSource('cached');
				setDegradedNotice('Live teaching load data is unavailable. You are viewing your last saved snapshot in read-only mode.');
				setError(null);
				if (resolvedSchoolId) void fetchSplitBrainIncident(resolvedSchoolId, schoolYearId);
			} else {
				setDataSource('none');
				setCoverageTotals(null);
				setIntegrityDiagnostics(null);
				setWorkloadPolicy(null);
				setWorkloadPolicyStatus('UNCONFIGURED');
				setSplitBrainIncident(null);
				setSectionAssignedClassesIndex(null);
				setDegradedNotice(null);
				setError(requestError?.response?.data?.message ?? requestError?.message ?? 'Failed to load teaching load data.');
			}
		} finally {
			setLoading(false);
		}
	}, [fetchSplitBrainIncident, isOnline]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, []);

	// NOTE: URL intent (facultyId, sectionId, subjectId) is now applied once
	// per navigation entry by useTeachingLoadRouteIntent in TeachingLoad.tsx.
	// This hook only initializes from URL on first mount and falls back to
	// the first faculty member when no valid selection exists.

	// Initialize selectedId from URL on first mount only
	useEffect(() => {
		const queryValue = searchParams.get('facultyId');
		if (queryValue) {
			const parsed = Number(queryValue);
			if (!Number.isNaN(parsed)) {
				setSelectedId(parsed);
				return;
			}
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Fall back to first faculty when selection is invalid and faculty list is loaded
	useEffect(() => {
		if (faculty.length === 0) {
			setSelectedId(null);
			return;
		}
		if (selectedId == null || !faculty.some((member) => member.id === selectedId)) {
			setSelectedId(faculty[0].id);
		}
	}, [faculty, selectedId]);

	const allKnownSections = useMemo(() => {
		return [...(sectionSummary?.sections ?? [])].sort(
			(left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id - right.id,
		);
	}, [sectionSummary]);

	const sectionMap = useMemo(() => buildSectionMap(allKnownSections), [allKnownSections]);

	const toDraftAssignmentsLocal = useCallback((
		assignments: FacultyAssignmentRecord[],
	): FacultyAssignmentDraft[] => {
		return normalizeDraftAssignments(
			assignments.map((assignment) => ({
				subjectId: assignment.subjectId,
				sectionIds: assignment.sectionIds,
				gradeLevels: assignment.gradeLevels,
			})),
			sectionMap,
		);
	}, [sectionMap]);

	const savedAssignmentsByFaculty = useMemo(() => {
		const result: Record<number, FacultyAssignmentDraft[]> = {};
		for (const member of faculty) {
			result[member.id] = toDraftAssignmentsLocal(member.assignments);
		}
		return result;
	}, [faculty, toDraftAssignmentsLocal]);

	const effectiveDraftAssignmentsByFaculty = useMemo(() => {
		const result: Record<number, FacultyAssignmentDraft[]> = {};
		for (const [facultyIdRaw, assignments] of Object.entries(draftAssignmentsByFaculty)) {
			const facultyId = Number(facultyIdRaw);
			const normalized = normalizeDraftAssignments(assignments, sectionMap);
			const savedSignature = buildAssignmentSignature(savedAssignmentsByFaculty[facultyId] ?? []);
			if (buildAssignmentSignature(normalized) !== savedSignature) {
				result[facultyId] = normalized;
			}
		}
		return result;
	}, [draftAssignmentsByFaculty, savedAssignmentsByFaculty, sectionMap]);

	const effectiveAssignmentsByFaculty = useMemo(() => {
		const result: Record<number, FacultyAssignmentDraft[]> = {};
		for (const member of faculty) {
			result[member.id] = effectiveDraftAssignmentsByFaculty[member.id] ?? savedAssignmentsByFaculty[member.id] ?? [];
		}
		return result;
	}, [faculty, effectiveDraftAssignmentsByFaculty, savedAssignmentsByFaculty]);

	const activeDraftCount = useMemo(() => Object.keys(effectiveDraftAssignmentsByFaculty).length, [effectiveDraftAssignmentsByFaculty]);

	const facultyNames = useMemo(
		() => Object.fromEntries(faculty.map((member) => [member.id, `${member.lastName}, ${member.firstName}`])),
		[faculty],
	);

	const savedOwnershipMap = useMemo(
		() => (savedOwnershipIndex.length > 0
			? buildOwnershipMapFromIndex(savedOwnershipIndex)
			: buildOwnershipMap(savedAssignmentsByFaculty, facultyNames, 'saved')),
		[facultyNames, savedAssignmentsByFaculty, savedOwnershipIndex],
	);

	const savedConflictMap = useMemo(
		() => buildMultiOwnerSavedMap(savedAssignmentsByFaculty, facultyNames),
		[facultyNames, savedAssignmentsByFaculty],
	);

	const pendingOwnershipMap = useMemo(
		() => buildPendingOwnershipMap(savedAssignmentsByFaculty, effectiveDraftAssignmentsByFaculty, facultyNames),
		[effectiveDraftAssignmentsByFaculty, facultyNames, savedAssignmentsByFaculty],
	);

	const effectiveOwnershipMap = useMemo(
		() => buildEffectiveOwnershipMap(effectiveAssignmentsByFaculty, facultyNames, pendingOwnershipMap),
		[effectiveAssignmentsByFaculty, facultyNames, pendingOwnershipMap],
	);

	const selected = useMemo(
		() => faculty.find((member) => member.id === selectedId) ?? null,
		[faculty, selectedId],
	);

	const { canUndo, canRedo, pushHistory, handleUndo, handleRedo, handleResetAssignments } = useAssignmentHistory({
		selectedId: selected?.id ?? null,
		subjects,
		effectiveAssignmentsByFaculty,
		savedAssignmentsByFaculty,
		sectionMap,
		setDraftAssignmentsByFaculty,
	});

	useEffect(() => {
		if (!selected) {
			setHomeroomHint(null);
			return;
		}

		let cancelled = false;
		atlasApi
			.get<HomeroomHintResponse>(`/faculty/${selected.id}/homeroom-hint`)
			.then(({ data }) => {
				if (!cancelled) {
					setHomeroomHint(data);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setHomeroomHint(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [selected]);

	return {
		faculty,
		schoolId,
		activeSchoolYearLabel,
		subjects,
		sectionSummary,
		sectionAssignedClassesIndex,
		coverageTotals,
		workloadPolicy,
		workloadPolicyStatus,
		integrityDiagnostics,
		splitBrainIncident,
		splitBrainLoading,
		activeSchoolYearId,
		activeTermIndex,
		loading,
		saving,
		setSaving,
		selectedId,
		setSelectedId,
		subjectFocusId,
		setSubjectFocusId,
		sectionFocusId,
		setSectionFocusId,
		dataSource,
		degradedNotice,
		degradedWriteEnabled,
		isOnline,
		homeroomHint,
		draftAssignmentsByFaculty,
		setDraftAssignmentsByFaculty,
		error,
		setError,
		fetchData,
		fetchSplitBrainIncident,
		canPersistAssignments,
		canRunStaffingNeeds,
		canRunGlobalReset,
		isReadOnlyMode,
		activeFacultyIds,
		allKnownSections,
		sectionMap,
		savedAssignmentsByFaculty,
		effectiveDraftAssignmentsByFaculty,
		effectiveAssignmentsByFaculty,
		activeDraftCount,
		facultyNames,
		savedOwnershipMap,
		savedConflictMap,
		pendingOwnershipMap,
		effectiveOwnershipMap,
		selected,
		canUndo,
		canRedo,
		pushHistory,
		handleUndo,
		handleRedo,
		handleResetAssignments,
	};
}
