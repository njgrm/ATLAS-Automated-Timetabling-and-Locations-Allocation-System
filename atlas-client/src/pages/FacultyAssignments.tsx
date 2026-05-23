import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
AlertTriangle,
CheckCircle2,
ChevronRight,
Filter,
Info,
Redo2,
RotateCcw,
Save,
Search,
Undo2,
UserCog,
Star,
MoreHorizontal,
Settings2,
Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import atlasApi from '@/lib/api';
import {
buildAssignmentSignature,
buildMultiOwnerSavedMap,
buildOwnershipMap,
buildOwnershipMapFromIndex,
buildPendingOwnershipMap,
buildSectionMap,
buildTeachingLoadProfile,
CLASS_ADVISER_EQUIVALENT_HOURS,
getAssignmentOwnershipKey,
normalizeDraftAssignments,
type FacultyAssignmentDraft,
type LoadStatus,
type SubjectSectionOwnershipIndexEntry,
} from '@/lib/faculty-assignment-helpers';
import { isDepartmentMatch } from '@/lib/grade-labels';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import {
	getCachedFacultyAssignmentsSummary,
	getCachedSectionSummary,
	getCachedSubjects,
	normalizeFacultySummarySnapshot,
	requestWithRetry,
	setCachedFacultyAssignmentsSummary,
	setCachedSectionSummary,
	setCachedSubjects,
} from '@/lib/faculty-teaching-load-cache';
import { OverviewHeader } from '@/components/faculty-assignments/OverviewHeader';
import { SubjectRow } from '@/components/faculty-assignments/SubjectRow';
import { useAssignmentHistory } from '@/hooks/useAssignmentHistory';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Checkbox } from '@/ui/checkbox';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { SearchableSelect } from '@/ui/searchable-select';
import { Skeleton } from '@/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import {
	AutoFillSummaryModal,
	type AutoFillSummaryResult,
} from '@/components/faculty-assignments/AutoFillSummaryModal';
import type {
	ExternalSection,
	HomeroomHintResponse,
	SectionSummaryResponse,
	Subject,
	FacultyAssignmentRecord,
	FacultySummary,
	TeachingLoadCoverageTotals,
	TeachingLoadIntegrityDiagnostics,
	RotationFamilyLoadDetail,
} from '@/types';

const DEFAULT_SCHOOL_ID = 1;

const STATUS_COLORS: Record<LoadStatus, { bg: string; text: string; border: string }> = {
	'below-standard': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
	compliant: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
	'overload-allowed': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
	'over-cap': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

type TeachingLoadResetPreview = {
	applied: boolean;
	scope: 'GLOBAL' | 'SUBJECT';
	schoolId: number;
	schoolYearId: number;
	subjectId: number | null;
	ownershipRowsToRemove: number;
	facultySubjectRowsAffected: number;
	facultySubjectRowsDeleted: number;
	facultySubjectRowsUpdated: number;
	affectedFacultyCount: number;
	affectedSubjectCount: number;
	subjectCodes: string[];
};
function cloneAssignments(assignments: FacultyAssignmentDraft[]): FacultyAssignmentDraft[] {
return assignments.map((assignment) => ({
subjectId: assignment.subjectId,
sectionIds: [...assignment.sectionIds],
gradeLevels: [...assignment.gradeLevels],
}));
}
function toDraftAssignments(
assignments: FacultyAssignmentRecord[],
sectionMap: Map<number, ExternalSection>,
): FacultyAssignmentDraft[] {
return normalizeDraftAssignments(
assignments.map((assignment) => ({
subjectId: assignment.subjectId,
sectionIds: assignment.sectionIds,
gradeLevels: assignment.gradeLevels,
})),
sectionMap,
);
}
export default function FacultyAssignments() {
const [searchParams, setSearchParams] = useSearchParams();
const [faculty, setFaculty] = useState<FacultySummary[]>([]);
const [subjects, setSubjects] = useState<Subject[]>([]);
const [sectionSummary, setSectionSummary] = useState<SectionSummaryResponse | null>(null);
const [savedOwnershipIndex, setSavedOwnershipIndex] = useState<SubjectSectionOwnershipIndexEntry[]>([]);
const [coverageTotals, setCoverageTotals] = useState<TeachingLoadCoverageTotals | null>(null);
const [integrityDiagnostics, setIntegrityDiagnostics] = useState<TeachingLoadIntegrityDiagnostics | null>(null);
const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
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
const [searchQuery, setSearchQuery] = useState('');
const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned'>('all');
const [departmentFilter, setDepartmentFilter] = useState<string>('all');
const [subjectSearch, setSubjectSearch] = useState('');
	const [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
	const [staffingNeedsLoading, setStaffingNeedsLoading] = useState(false);
	const [summaryModalOpen, setSummaryModalOpen] = useState(false);
	const [summaryModalResult, setSummaryModalResult] = useState<AutoFillSummaryResult | null>(null);
	const [gradeLevelFilter, setGradeLevelFilter] = useState<string>('all');
	const [sortOrder, setSortOrder] = useState<'load-asc' | 'load-desc'>('load-asc');
	const [loadFilter, setLoadFilter] = useState<'all' | 'overloaded' | 'optimal' | 'underloaded'>('all');
	const [showSyntheticCoverageRows, setShowSyntheticCoverageRows] = useState(false);
	const [hoveredIncomingMinutes, setHoveredIncomingMinutes] = useState(0);
	const [swapCandidate, setSwapCandidate] = useState<{ subjectId: number; sectionId: number; fromFacultyId: number } | null>(null);
const [resetDialogOpen, setResetDialogOpen] = useState(false);
const [resetPreview, setResetPreview] = useState<TeachingLoadResetPreview | null>(null);
const [resetLoading, setResetLoading] = useState(false);
const [resetConfirmText, setResetConfirmText] = useState('');
const [error, setError] = useState<string | null>(null);
const [dataSource, setDataSource] = useState<'live' | 'cached' | 'none'>('none');
const [degradedNotice, setDegradedNotice] = useState<string | null>(null);
const [isOnline, setIsOnline] = useState(() => navigator.onLine);
const [homeroomHint, setHomeroomHint] = useState<HomeroomHintResponse | null>(null);
const [draftAssignmentsByFaculty, setDraftAssignmentsByFaculty] = useState<Record<number, FacultyAssignmentDraft[]>>({});

const hasActiveFilters = filterStatus !== 'all' || departmentFilter !== 'all' || sortOrder !== 'load-asc' || loadFilter !== 'all' || showSyntheticCoverageRows;

const [autoFillLoading, setAutoFillLoading] = useState(false);
const [autoFillDialogOpen, setAutoFillDialogOpen] = useState(false);
const [showFilters, setShowFilters] = useState(false);
const [showJumpList, setShowJumpList] = useState(false);

const activeFacultyIds = useMemo(() => new Set(faculty.map((f) => f.id)), [faculty]);

const fetchData = useCallback(async (options?: { forceRefresh?: boolean }) => {
	const forceRefresh = options?.forceRefresh === true;
	setLoading(true);
	setError(null);

	let schoolYearId: number | null = null;

	try {
		const schoolYearContext = await resolveActiveSchoolYearContext({ forceRefresh });
		schoolYearId = schoolYearContext.activeSchoolYearId;

		if (!forceRefresh) {
			const cachedSummary = getCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId, {
				maxAgeMs: 3 * 60 * 1000,
			});
			const cachedSubjects = getCachedSubjects(DEFAULT_SCHOOL_ID, { maxAgeMs: 3 * 60 * 1000 });
			const cachedSections = getCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId, { maxAgeMs: 3 * 60 * 1000 });

			if (cachedSummary && cachedSubjects && cachedSections) {
				setActiveSchoolYearId(schoolYearId);
				setFaculty(cachedSummary.data.faculty);
				setSavedOwnershipIndex(cachedSummary.data.ownershipIndex ?? []);
				setCoverageTotals(cachedSummary.data.coverageTotals ?? null);
				setIntegrityDiagnostics(cachedSummary.data.integrityDiagnostics ?? null);
				setSubjects(cachedSubjects.data);
				setSectionSummary(cachedSections.data);
				setDataSource('cached');
				setDegradedNotice('Refreshing live teaching load data. Showing your last saved snapshot in the meantime.');
				setLoading(false);
			}
		}

		const [facultyRes, subjectsRes, sectionsRes] = await Promise.all([
			requestWithRetry(
				() =>
					atlasApi.get<{
						faculty: FacultySummary[];
						ownershipIndex?: SubjectSectionOwnershipIndexEntry[];
						coverageTotals?: TeachingLoadCoverageTotals;
						integrityDiagnostics?: TeachingLoadIntegrityDiagnostics;
						fetchedAt?: string | null;
					}>(
						'/faculty-assignments/summary',
						{ params: { schoolId: DEFAULT_SCHOOL_ID, schoolYearId } },
					),
				{ attempts: 2, delayMs: 400 },
			),
			requestWithRetry(
				() => atlasApi.get<{ subjects: Subject[] }>('/subjects', { params: { schoolId: DEFAULT_SCHOOL_ID } }),
				{ attempts: 2, delayMs: 300 },
			),
			requestWithRetry(
				() => atlasApi.get<SectionSummaryResponse>(`/sections/summary/${schoolYearId}`, { params: { schoolId: DEFAULT_SCHOOL_ID } }),
				{ attempts: 2, delayMs: 400 },
			),
		]);

		const normalizedSummary = normalizeFacultySummarySnapshot({
			faculty: facultyRes.data.faculty,
			ownershipIndex: facultyRes.data.ownershipIndex ?? [],
			coverageTotals: facultyRes.data.coverageTotals,
			integrityDiagnostics: facultyRes.data.integrityDiagnostics,
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
		setSubjects(normalizedSubjects);
		setSectionSummary(normalizedSectionSummary as SectionSummaryResponse);
		setCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId, normalizedSummary);
		setCachedSubjects(DEFAULT_SCHOOL_ID, normalizedSubjects);
		setCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId, normalizedSectionSummary as SectionSummaryResponse);
		setDataSource('live');
		setDegradedNotice(null);
		setError(null);
	} catch (requestError: any) {
		const cachedSummary = schoolYearId ? getCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId) : null;
		const cachedSubjects = getCachedSubjects(DEFAULT_SCHOOL_ID);
		const cachedSections = schoolYearId ? getCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId) : null;

		if (schoolYearId && cachedSummary && cachedSubjects && cachedSections) {
			setActiveSchoolYearId(schoolYearId);
			setFaculty(cachedSummary.data.faculty);
			setSavedOwnershipIndex(cachedSummary.data.ownershipIndex ?? []);
			setCoverageTotals(cachedSummary.data.coverageTotals ?? null);
			setIntegrityDiagnostics(cachedSummary.data.integrityDiagnostics ?? null);
			setSubjects(cachedSubjects.data);
			setSectionSummary(cachedSections.data);
			setDataSource('cached');
			setDegradedNotice('Live teaching load data is unavailable. You are viewing your last saved snapshot in read-only mode.');
			setError(null);
		} else {
			setDataSource('none');
			setCoverageTotals(null);
			setIntegrityDiagnostics(null);
			setDegradedNotice(null);
			setError(requestError?.response?.data?.message ?? requestError?.message ?? 'Failed to load teaching load data.');
		}
	} finally {
		setLoading(false);
	}
}, []);
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

const isReadOnlyMode = !isOnline || dataSource !== 'live';
const readOnlyNotice = !isOnline
	? 'You are offline. Teaching Load is available in read-only mode until connection returns.'
	: dataSource === 'cached'
	? (degradedNotice ?? 'Live teaching load data is unavailable. Showing your last saved snapshot in read-only mode.')
	: null;

useEffect(() => {
	const queryValue = searchParams.get('facultyId');
	if (queryValue) {
		const parsed = Number(queryValue);
		if (!Number.isNaN(parsed) && faculty.some(m => m.id === parsed)) {
			setSelectedId(parsed);
			return;
		}
	}
	if (faculty.length === 0) {
		setSelectedId(null);
		return;
	}
	if (selectedId == null || !faculty.some((member) => member.id === selectedId)) {
		setSelectedId(faculty[0].id);
	}
}, [faculty, searchParams, selectedId]);

useEffect(() => {
	const queryValue = searchParams.get('subjectId');
	if (!queryValue) {
		setSubjectFocusId(null);
		return;
	}
	const parsed = Number(queryValue);
	setSubjectFocusId(Number.isNaN(parsed) ? null : parsed);
}, [searchParams]);

useEffect(() => {
	if (!subjectFocusId) return;
	const focusedSubject = subjects.find((subject) => subject.id === subjectFocusId);
	if (!focusedSubject) return;
	setSubjectSearch(focusedSubject.code);
}, [subjectFocusId, subjects]);
const allKnownSections = useMemo(() => {
	return [...(sectionSummary?.sections ?? [])].sort(
		(left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id - right.id,
	);
}, [sectionSummary]);
const sectionMap = useMemo(() => buildSectionMap(allKnownSections), [allKnownSections]);
const savedAssignmentsByFaculty = useMemo(() => {
const result: Record<number, FacultyAssignmentDraft[]> = {};
for (const member of faculty) {
result[member.id] = toDraftAssignments(member.assignments, sectionMap);
}
return result;
}, [faculty, sectionMap]);
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
const selected = useMemo(
() => faculty.find((member) => member.id === selectedId) ?? null,
[faculty, selectedId],
);
const focusedSubject = useMemo(
	() => (subjectFocusId ? subjects.find((subject) => subject.id === subjectFocusId) ?? null : null),
	[subjectFocusId, subjects],
);
const currentAssignments = useMemo(
() => (selected ? effectiveAssignmentsByFaculty[selected.id] ?? [] : []),
[effectiveAssignmentsByFaculty, selected],
);

const savedAssignmentsForSelected = useMemo(
() => (selected ? savedAssignmentsByFaculty[selected.id] ?? [] : []),
[savedAssignmentsByFaculty, selected],
);

const dirty = Boolean(
selected
&& buildAssignmentSignature(currentAssignments) !== buildAssignmentSignature(savedAssignmentsForSelected),
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

const updateSelectedAssignments = useCallback(
(updater: (current: FacultyAssignmentDraft[]) => FacultyAssignmentDraft[]) => {
if (!selected) {
return;
}
	pushHistory();
setDraftAssignmentsByFaculty((previousDrafts) => {
const current = cloneAssignments(previousDrafts[selected.id] ?? savedAssignmentsByFaculty[selected.id] ?? []);
const nextAssignments = normalizeDraftAssignments(updater(current), sectionMap);
const savedSignature = buildAssignmentSignature(savedAssignmentsByFaculty[selected.id] ?? []);
if (buildAssignmentSignature(nextAssignments) === savedSignature) {
const nextDrafts = { ...previousDrafts };
delete nextDrafts[selected.id];
return nextDrafts;
}
return {
...previousDrafts,
[selected.id]: nextAssignments,
};
});
},
[pushHistory, sectionMap, selected, savedAssignmentsByFaculty],
);

const setSubjectSections = useCallback(
(subjectId: number, sectionIds: number[]) => {
updateSelectedAssignments((current) => {
const nextAssignments = current.filter((assignment) => assignment.subjectId !== subjectId);
if (sectionIds.length === 0) {
return nextAssignments;
}
return [
...nextAssignments,
{ subjectId, sectionIds, gradeLevels: [] },
];
});
},
[updateSelectedAssignments],
);

const discardSelectedDraft = useCallback(() => {
if (!selected) {
return;
}
	pushHistory();
setDraftAssignmentsByFaculty((previousDrafts) => {
const nextDrafts = { ...previousDrafts };
delete nextDrafts[selected.id];
return nextDrafts;
});
}, [pushHistory, selected]);

const handleSave = useCallback(async () => {
if (!selected || !activeSchoolYearId) {
return;
}
	if (isReadOnlyMode) {
		toast.error('Teaching Load is in read-only mode. Reconnect and refresh live data before saving.');
		return;
	}

setSaving(true);
setError(null);
try {
await atlasApi.put(`/faculty-assignments/${selected.id}`, {
schoolId: DEFAULT_SCHOOL_ID,
schoolYearId: activeSchoolYearId,
version: selected.version,
assignments: currentAssignments.map((assignment) => ({
subjectId: assignment.subjectId,
sectionIds: assignment.sectionIds,
gradeLevels: assignment.gradeLevels,
})),
});
await fetchData({ forceRefresh: true });
setDraftAssignmentsByFaculty((previousDrafts) => {
const nextDrafts = { ...previousDrafts };
delete nextDrafts[selected.id];
return nextDrafts;
});
toast.success('Teaching load saved successfully.');
} catch (requestError: any) {
const responseCode = requestError?.response?.data?.code as string | undefined;
const responseMessage = requestError?.response?.data?.message ?? 'Failed to save teaching load.';
if (responseCode === 'VERSION_CONFLICT') {
await fetchData({ forceRefresh: true });
toast.error(`${responseMessage} Latest saved data was reloaded; your local draft remains visible.`);
} else {
toast.error(responseMessage);
}
} finally {
setSaving(false);
}
}, [activeSchoolYearId, currentAssignments, fetchData, isReadOnlyMode, selected]);

const handleAutoFill = useCallback(async () => {
	if (!activeSchoolYearId) return;
	if (isReadOnlyMode) {
		toast.error('Teaching Load is in read-only mode. Reconnect and refresh live data before running Auto-Fill.');
		return;
	}
	pushHistory();
	setAutoFillDialogOpen(false);
	setAutoFillLoading(true);
	try {
		const result = await atlasApi.post<{
			preserved: number;
			created: number;
			assignmentsCreated: number;
			uniqueTeachersAffected: number;
			unresolved: number;
			warnings: string[];
			staffingReport: AutoFillSummaryResult['staffingReport'];
		}>(
			'/faculty-assignments/auto-fill',
			{ schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId },
		);
		await fetchData({ forceRefresh: true });
		const { assignmentsCreated, uniqueTeachersAffected, unresolved } = result.data;
		setSummaryModalResult(result.data as AutoFillSummaryResult);
		setSummaryModalOpen(true);
		if (assignmentsCreated > 0) {
			toast.success(
				`Assigned ${assignmentsCreated} subject${assignmentsCreated !== 1 ? 's' : ''} across ${uniqueTeachersAffected} teacher${uniqueTeachersAffected !== 1 ? 's' : ''}.`,
			);
		} else if (unresolved > 0) {
			toast.warning(`Auto-Fill: no new assignments made. ${unresolved} pair${unresolved !== 1 ? 's' : ''} remain unresolved.`);
		} else {
			toast.info('Auto-Fill: all subject-section pairs are already assigned.');
		}
		if (activeDraftCount > 0) {
			toast.warning('Auto-Fill used saved assignments only. Unsaved drafts were not included.');
		}
	} catch {
		toast.error('Auto-Fill failed. Please try again.');
	} finally {
		setAutoFillLoading(false);
	}
}, [activeDraftCount, activeSchoolYearId, fetchData, isReadOnlyMode, pushHistory]);

const handleViewStaffingNeeds = useCallback(async () => {
	if (!activeSchoolYearId) return;
	if (isReadOnlyMode) {
		toast.error('Teaching Load is in read-only mode. Refresh live data before requesting staffing needs.');
		return;
	}
	setStaffingNeedsLoading(true);
	try {
		const result = await atlasApi.post<AutoFillSummaryResult>(
			'/faculty-assignments/report/staffing-needs',
			{ schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId },
		);
		setSummaryModalResult(result.data);
		setSummaryModalOpen(true);
	} catch {
		toast.error('Unable to load staffing needs right now.');
	} finally {
		setStaffingNeedsLoading(false);
	}
}, [activeSchoolYearId, isReadOnlyMode]);

const openGlobalResetPreview = useCallback(async () => {
	if (!activeSchoolYearId) return;
	if (isReadOnlyMode) {
		toast.error('Teaching Load is in read-only mode. Reconnect and refresh live data before resetting.');
		return;
	}
	setResetLoading(true);
	try {
		const { data } = await atlasApi.post<TeachingLoadResetPreview>(
			'/faculty-assignments/reset',
			{ schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId, previewOnly: true },
		);
		setResetPreview(data);
		setResetConfirmText('');
		setResetDialogOpen(true);
	} catch (requestError: any) {
		toast.error(requestError?.response?.data?.message ?? 'Failed to preview global teaching-load reset.');
	} finally {
		setResetLoading(false);
	}
}, [activeSchoolYearId, isReadOnlyMode]);

const applyGlobalReset = useCallback(async () => {
	if (!activeSchoolYearId) return;
	if (isReadOnlyMode) {
		toast.error('Teaching Load is in read-only mode. Reconnect and refresh live data before resetting.');
		return;
	}
	if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
		toast.error('Type RESET to confirm global teaching-load reset.');
		return;
	}

	setResetLoading(true);
	try {
		const { data } = await atlasApi.post<TeachingLoadResetPreview>(
			'/faculty-assignments/reset',
			{ schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId, previewOnly: false, confirmReset: true },
		);
		toast.success(`Global teaching-load reset removed ${data.ownershipRowsToRemove} ownership rows.`);
		setResetDialogOpen(false);
		setResetConfirmText('');
		await fetchData({ forceRefresh: true });
	} catch (requestError: any) {
		toast.error(requestError?.response?.data?.message ?? 'Failed to apply global teaching-load reset.');
	} finally {
		setResetLoading(false);
	}
}, [activeSchoolYearId, fetchData, isReadOnlyMode, resetConfirmText]);

const getComparableLoadHours = useCallback((member: FacultySummary) => {
	if (member.isPlaceholder) {
		return member.gradeTeachingHours ?? member.syntheticCoverageHours ?? 0;
	}
	return member.policyCreditedHours ?? member.subjectHours ?? 0;
}, []);

const filteredFaculty = useMemo(() => {
let nextFaculty = faculty;
	if (!showSyntheticCoverageRows) {
		nextFaculty = nextFaculty.filter((member) => !member.isPlaceholder);
	}
if (searchQuery.trim()) {
const normalizedQuery = searchQuery.toLowerCase();
nextFaculty = nextFaculty.filter(
(member) =>
member.firstName.toLowerCase().includes(normalizedQuery)
|| member.lastName.toLowerCase().includes(normalizedQuery)
|| (member.department ?? '').toLowerCase().includes(normalizedQuery),
);
}
if (filterStatus === 'assigned') {
nextFaculty = nextFaculty.filter((member) => (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) > 0);
} else if (filterStatus === 'unassigned') {
nextFaculty = nextFaculty.filter((member) => (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) === 0);
}
if (departmentFilter !== 'all') {
nextFaculty = nextFaculty.filter((member) => member.department === departmentFilter);
}

	nextFaculty = nextFaculty.filter((member) => {
		if (member.isPlaceholder) {
			return showSyntheticCoverageRows && loadFilter === 'all';
		}
		const load = getComparableLoadHours(member);
		if (loadFilter === 'overloaded') return load > 30;
		if (loadFilter === 'optimal') return load >= 25 && load <= 30;
		if (loadFilter === 'underloaded') return load < 25;
		return true;
	});

	nextFaculty = [...nextFaculty].sort((left, right) => {
		const leftLoad = getComparableLoadHours(left);
		const rightLoad = getComparableLoadHours(right);
		if (sortOrder === 'load-asc') {
			if (leftLoad !== rightLoad) return leftLoad - rightLoad;
		} else if (leftLoad !== rightLoad) {
			return rightLoad - leftLoad;
		}
		return `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`);
	});

return nextFaculty;
}, [departmentFilter, faculty, filterStatus, getComparableLoadHours, loadFilter, searchQuery, showSyntheticCoverageRows, sortOrder]);

const groupedFaculty = useMemo(() => {
	const grouped = new Map<string, FacultySummary[]>();
	for (const member of filteredFaculty) {
		const department = member.isPlaceholder
			? 'SYNTHETIC PLACEHOLDER COVERAGE'
			: member.department?.trim() || 'UNASSIGNED DEPARTMENT';
		const bucket = grouped.get(department) ?? [];
		bucket.push(member);
		grouped.set(department, bucket);
	}
	return Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right));
}, [filteredFaculty]);

const subjectsLackingFaculty = useMemo(() => {
const assignedSubjectIds = new Set<number>();
for (const assignments of Object.values(effectiveAssignmentsByFaculty)) {
for (const assignment of assignments) {
assignedSubjectIds.add(assignment.subjectId);
}
}
return subjects.filter((subject) => subject.isActive && !assignedSubjectIds.has(subject.id));
}, [effectiveAssignmentsByFaculty, subjects]);

const { departmentQualifiedSubjects, outsideDepartmentSubjects } = useMemo(() => {
	const normalizeDepartmentCode = (value: string | null | undefined): string => {
		const normalized = (value ?? '').trim().toUpperCase();
		if (!normalized) return '';
		const table: Record<string, string> = {
			SCIENCE: 'SCI',
			SCI: 'SCI',
			MATHEMATICS: 'MATH',
			MATH: 'MATH',
			ENGLISH: 'ENG',
			ENG: 'ENG',
			FILIPINO: 'FIL',
			FIL: 'FIL',
			MAPEH: 'MAPEH',
			ESP: 'ESP',
			VALUES: 'ESP',
			'VALUES EDUCATION': 'ESP',
			AP: 'AP',
			'SOCIAL STUDIES': 'AP',
			'ARALING PANLIPUNAN': 'AP',
			TLE: 'TLE',
			LANGUAGES: 'ENG',
			SPA: 'SPA',
			SPS: 'SPS',
		};
		return table[normalized] ?? normalized;
	};

	const matchesOwnershipDepartment = (facultyDepartment: string | null | undefined, subject: Subject): boolean => {
		const ownerDepartments = [
			...(subject.ownerDepartment ? [subject.ownerDepartment] : []),
			...(subject.allowedOwnerDepartments ?? []),
		]
			.map((value) => normalizeDepartmentCode(value))
			.filter((value): value is string => Boolean(value));

		if (ownerDepartments.length > 0) {
			const normalizedFaculty = normalizeDepartmentCode(facultyDepartment);
			if (!normalizedFaculty) return false;
			if (ownerDepartments.includes(normalizedFaculty)) return true;
			if ((ownerDepartments.includes('ENG') || ownerDepartments.includes('FIL')) && normalizedFaculty === 'ENG') return true;
			return false;
		}

		return isDepartmentMatch(facultyDepartment ?? null, subject.code, subject.name);
	};

	const qualified: Subject[] = [];
	const outside: Subject[] = [];

	for (const subject of subjects) {
		const isHgSubject = subject.code === 'HG' || subject.name.toLowerCase().includes('homeroom');
		const departmentQualified = matchesOwnershipDepartment(selected?.department ?? null, subject);
		if ((isHgSubject && selected?.isClassAdviser) || departmentQualified) {
			qualified.push(subject);
		} else {
			outside.push(subject);
		}
	}

	const sortByHR = (a: Subject, b: Subject) => {
		const aIsHR = a.name.toLowerCase().includes('homeroom') || a.code.toLowerCase().includes('homeroom');
		const bIsHR = b.name.toLowerCase().includes('homeroom') || b.code.toLowerCase().includes('homeroom');
		if (aIsHR && !bIsHR) return 1;
		if (!aIsHR && bIsHR) return -1;
		return a.name.localeCompare(b.name);
	};

	qualified.sort(sortByHR);
	outside.sort(sortByHR);

	return {
		departmentQualifiedSubjects: qualified,
		outsideDepartmentSubjects: outside,
	};
}, [selected, subjects]);


const loadProfile = useMemo(
() =>
buildTeachingLoadProfile(
currentAssignments,
subjects,
sectionMap,
(selected?.isClassAdviser
? selected.advisoryEquivalentHours || CLASS_ADVISER_EQUIVALENT_HOURS
: 0) + ((selected?.ancillaryMinutesPerWeek || 0) / 60),
),
[currentAssignments, sectionMap, selected, subjects],
);

const rotationFamilyDetails = useMemo(() => {
	if (Array.isArray(selected?.rotationFamilyLoadDetails) && selected.rotationFamilyLoadDetails.length > 0 && !dirty) {
		return selected.rotationFamilyLoadDetails;
	}
	const computedFamilies = Array.isArray((loadProfile as any).rotationFamilies)
		? (loadProfile as any).rotationFamilies
		: [];
	return computedFamilies.map((family: any) => ({
		family: family.family,
		rawHours: family.rawHours,
		creditedHours: family.creditedHours,
		overcountHours: family.overcountHours,
		unitCount: family.unitCount,
		subjectCodes: family.subjectCodes,
		subjectIds: [],
	}));
}, [dirty, loadProfile.rotationFamilies, selected?.rotationFamilyLoadDetails]);

const loadBreakdownRows = useMemo(
	() => (Array.isArray((loadProfile as any).breakdown) ? (loadProfile as any).breakdown : []),
	[loadProfile],
);

const rotationOvercountHours = useMemo(() => {
	if (selected?.rotationFamilyOvercountHours != null && !dirty) {
		return selected.rotationFamilyOvercountHours;
	}
	return loadProfile.rotationOvercountHours;
}, [dirty, loadProfile.rotationOvercountHours, selected?.rotationFamilyOvercountHours]);

const loadCapMinutes = useMemo(() => {
	if (!selected) return 0;
	return Math.min(selected.maxHoursPerWeek * 60, 2400);
}, [selected]);

const remainingCapacityMinutes = useMemo(
	() => Math.max(0, loadCapMinutes - Math.round(loadProfile.actualTeachingHours * 60)),
	[loadCapMinutes, loadProfile.actualTeachingHours],
);

const previewLoadHours = useMemo(() => {
	if (hoveredIncomingMinutes <= 0) return loadProfile.actualTeachingHours;
	return Math.round(((loadProfile.actualTeachingHours * 60 + hoveredIncomingMinutes) / 60) * 10) / 10;
}, [hoveredIncomingMinutes, loadProfile.actualTeachingHours]);

const departmentOptions = useMemo(
() => Array.from(new Set(faculty.map((member) => member.department).filter(Boolean) as string[])).sort(),
[faculty],
);

const advisedSectionMeta = useMemo(() => {
	if (!homeroomHint?.advisedSectionId) {
		return null;
	}
	const section = sectionMap.get(homeroomHint.advisedSectionId);
	if (!section) {
		return null;
	}
	return {
		gradeLevel: section.displayOrder,
		sectionName: section.name,
	};
}, [homeroomHint?.advisedSectionId, sectionMap]);

const coverageHeadline = useMemo(() => {
	if (coverageTotals) {
		const activeAssigned = Number.isFinite(coverageTotals.activeAssignedPairs)
			? Math.max(0, coverageTotals.activeAssignedPairs ?? 0)
			: Math.max(0, coverageTotals.assignedPairs);
		const realAssigned = Number.isFinite(coverageTotals.realFacultyAssignedPairs)
			? coverageTotals.realFacultyAssignedPairs
			: Math.max(0, coverageTotals.assignedPairs - (coverageTotals.syntheticPlaceholderPairs ?? 0));
		const syntheticAssigned = Number.isFinite(coverageTotals.syntheticPlaceholderPairs)
			? coverageTotals.syntheticPlaceholderPairs
			: Math.max(0, coverageTotals.assignedPairs - realAssigned);
		const assigned = Math.max(0, activeAssigned);
		const total = Math.max(0, coverageTotals.totalPairs);
		const unassigned = Number.isFinite(coverageTotals.unassignedPairs)
			? Math.max(0, coverageTotals.unassignedPairs)
			: Math.max(0, total - assigned);
		const rawAssigned = Number.isFinite(coverageTotals.rawAssignedPairs)
			? Math.max(0, coverageTotals.rawAssignedPairs ?? 0)
			: assigned;
		const rawUnassigned = Number.isFinite(coverageTotals.rawUnassignedPairs)
			? Math.max(0, coverageTotals.rawUnassignedPairs ?? 0)
			: Math.max(0, total - rawAssigned);
		return {
			total,
			assigned,
			realAssigned,
			syntheticAssigned,
			unassigned,
			rawAssigned,
			rawUnassigned,
		};
	}

	const activeAcademicSubjects = subjects.filter((subject) => (subject.isActive || subject.id === subjectFocusId) && subject.code !== 'HG');
	const teachablePairs = new Set<string>();
	for (const subject of activeAcademicSubjects) {
		const relevantSections = allKnownSections.filter((section) => {
			const gradeCompatible = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(section.displayOrder);
			if (!gradeCompatible) return false;
			const programType = (section.programType ?? 'REGULAR').toUpperCase();
			return subject.programScopes.length === 0 || subject.programScopes.some((scope) => scope.toUpperCase() === programType);
		});
		for (const section of relevantSections) {
			teachablePairs.add(`${subject.id}:${section.id}`);
		}
	}

	const placeholderFacultyIdSet = new Set(faculty.filter((member) => member.isPlaceholder).map((member) => member.id));
	const realAssignedPairs = new Set<string>();
	const syntheticAssignedPairs = new Set<string>();
	const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
	for (const [facultyIdRaw, assignments] of Object.entries(effectiveAssignmentsByFaculty)) {
		const facultyId = Number(facultyIdRaw);
		const isPlaceholder = placeholderFacultyIdSet.has(facultyId);
		for (const assignment of assignments) {
			const subject = subjectMap.get(assignment.subjectId);
			if (!subject || subject.code === 'HG') {
				continue;
			}
			for (const sectionId of assignment.sectionIds) {
				const key = `${assignment.subjectId}:${sectionId}`;
				if (!teachablePairs.has(key)) continue;
				if (isPlaceholder) {
					syntheticAssignedPairs.add(key);
				} else {
					realAssignedPairs.add(key);
				}
			}
		}
	}

	const syntheticOnly = Array.from(syntheticAssignedPairs).filter((key) => !realAssignedPairs.has(key)).length;
	const realAssigned = realAssignedPairs.size;
	const assigned = realAssigned + syntheticOnly;
	const total = teachablePairs.size;
	return {
		total,
		assigned,
		realAssigned,
		syntheticAssigned: syntheticOnly,
		unassigned: Math.max(0, total - assigned),
		rawAssigned: assigned,
		rawUnassigned: Math.max(0, total - assigned),
	};
}, [allKnownSections, coverageTotals, effectiveAssignmentsByFaculty, faculty, subjectFocusId, subjects]);

const assignedFacultyCount = faculty.filter((member) => !member.isPlaceholder && (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) > 0).length;
const realFacultyCount = faculty.filter((member) => !member.isPlaceholder).length;
const syntheticCoverageTeachers = useMemo(
	() => faculty.filter((member) => member.isPlaceholder && (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) > 0),
	[effectiveAssignmentsByFaculty, faculty],
);
const syntheticCoverageHours = useMemo(
	() => syntheticCoverageTeachers.reduce((sum, member) => sum + (member.syntheticCoverageHours ?? member.sectionTeachingHours ?? 0), 0),
	[syntheticCoverageTeachers],
);
const sectionsAvailable = Boolean(sectionSummary && sectionSummary.sections.length > 0);

const departmentStats = useMemo(() => {
	const statsMap = new Map<string, { total: number; assigned: number }>();
	
	subjects.forEach(subject => {
		if (!subject.isActive || subject.code === 'HG') return;
		const dept = subject.ownerDepartment || 'General';
		const current = statsMap.get(dept) ?? { total: 0, assigned: 0 };
		
		const relevantSections = allKnownSections.filter(sec => {
			const gradeCompatible = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(sec.displayOrder);
			if (!gradeCompatible) return false;
			const programType = (sec.programType ?? 'REGULAR').toUpperCase();
			return subject.programScopes.length === 0 || subject.programScopes.some(s => s.toUpperCase() === programType);
		});

		current.total += relevantSections.length;
		relevantSections.forEach(sec => {
			const key = getAssignmentOwnershipKey(subject.id, sec.id);
			const owner = savedOwnershipMap[key] || pendingOwnershipMap[key];
			if (owner && activeFacultyIds.has(owner.facultyId)) {
				current.assigned += 1;
			}
		});
		statsMap.set(dept, current);
	});

	return Array.from(statsMap.entries())
		.map(([name, { total, assigned }]) => ({
			name,
			percent: total > 0 ? Math.round((assigned / total) * 100) : 0
		}))
		.sort((a, b) => b.percent - a.percent);
}, [subjects, allKnownSections, savedOwnershipMap, pendingOwnershipMap, activeFacultyIds]);

const pendingChangeLedger = useMemo(() => {
	const changes: { facultyName: string; count: number; type: 'add' | 'remove' | 'mix' }[] = [];
	
	for (const [facultyIdRaw, draft] of Object.entries(effectiveDraftAssignmentsByFaculty)) {
		const facultyId = Number(facultyIdRaw);
		const facultyName = facultyNames[facultyId] ?? `Teacher ${facultyId}`;
		const savedCount = (savedAssignmentsByFaculty[facultyId] ?? []).reduce((sum, a) => sum + a.sectionIds.length, 0);
		const draftCount = draft.reduce((sum, a) => sum + a.sectionIds.length, 0);
		
		changes.push({
			facultyName,
			count: Math.abs(draftCount - savedCount),
			type: draftCount > savedCount ? 'add' : draftCount < savedCount ? 'remove' : 'mix'
		});
	}
	return changes;
}, [effectiveDraftAssignmentsByFaculty, facultyNames, savedAssignmentsByFaculty]);

const jumpListItems = useMemo(() => {
	return [
		...departmentQualifiedSubjects.map(s => ({ id: s.id, code: s.code, type: 'qualified' })),
		...outsideDepartmentSubjects.map(s => ({ id: s.id, code: s.code, type: 'outside' }))
	];
}, [departmentQualifiedSubjects, outsideDepartmentSubjects]);

const executeSwap = useCallback(() => {
	if (isReadOnlyMode) {
		toast.error('Teaching Load is in read-only mode. Reconnect and refresh live data before swapping ownership.');
		return;
	}
	if (!selected || !swapCandidate) return;

	const { subjectId, sectionId, fromFacultyId } = swapCandidate;
	pushHistory();
	setDraftAssignmentsByFaculty((previousDrafts) => {
		const nextDrafts = { ...previousDrafts };

		const fromCurrent = cloneAssignments(previousDrafts[fromFacultyId] ?? savedAssignmentsByFaculty[fromFacultyId] ?? []);
		const fromNext = normalizeDraftAssignments(
			fromCurrent
				.map((assignment) =>
					assignment.subjectId === subjectId
						? { ...assignment, sectionIds: assignment.sectionIds.filter((id) => id !== sectionId) }
						: assignment,
				)
				.filter((assignment) => assignment.sectionIds.length > 0),
			sectionMap,
		);
		const fromSavedSignature = buildAssignmentSignature(savedAssignmentsByFaculty[fromFacultyId] ?? []);
		if (buildAssignmentSignature(fromNext) === fromSavedSignature) {
			delete nextDrafts[fromFacultyId];
		} else {
			nextDrafts[fromFacultyId] = fromNext;
		}

		const selectedCurrent = cloneAssignments(previousDrafts[selected.id] ?? savedAssignmentsByFaculty[selected.id] ?? []);
		const selectedMap = new Map(selectedCurrent.map((assignment) => [assignment.subjectId, assignment]));
		const existing = selectedMap.get(subjectId);
		if (existing) {
			if (!existing.sectionIds.includes(sectionId)) {
				existing.sectionIds = [...existing.sectionIds, sectionId];
			}
		} else {
			selectedMap.set(subjectId, { subjectId, sectionIds: [sectionId], gradeLevels: [] });
		}
		const selectedNext = normalizeDraftAssignments(Array.from(selectedMap.values()), sectionMap);
		const selectedSavedSignature = buildAssignmentSignature(savedAssignmentsByFaculty[selected.id] ?? []);
		if (buildAssignmentSignature(selectedNext) === selectedSavedSignature) {
			delete nextDrafts[selected.id];
		} else {
			nextDrafts[selected.id] = selectedNext;
		}

		return nextDrafts;
	});

	setSwapCandidate(null);
	toast.success('Ownership swapped to the selected teacher in draft mode. Save to persist changes.');
}, [isReadOnlyMode, pushHistory, savedAssignmentsByFaculty, sectionMap, selected, swapCandidate]);

	return (
<TooltipProvider delayDuration={200}>
<div className="flex h-[calc(100svh-3.5rem)] flex-col px-6">
{error && (
<div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
<span>{error}</span>
<Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-7 px-2 text-red-700 hover:bg-red-100 hover:text-red-800 font-bold">
Dismiss
</Button>
</div>
)}

<div className="flex items-center justify-between gap-4">
	<OverviewHeader
		realAssignedPairs={coverageHeadline.realAssigned}
		syntheticPlaceholderPairs={coverageHeadline.syntheticAssigned}
		unassignedPairs={coverageHeadline.unassigned}
		rawUnassignedPairs={coverageHeadline.rawUnassigned}
		totalPairs={coverageHeadline.total}
		assignedFacultyCount={assignedFacultyCount}
		totalFacultyCount={realFacultyCount}
		activeDraftCount={activeDraftCount}
		autoFillLoading={autoFillLoading}
		staffingNeedsLoading={staffingNeedsLoading}
		autoFillEnabled={Boolean(activeSchoolYearId) && !isReadOnlyMode}
		onAutoFillClick={() => {
			if (isReadOnlyMode) {
				toast.error('Teaching Load is in read-only mode. Reconnect and refresh live data before running Auto-Fill.');
				return;
			}
			setAutoFillDialogOpen(true);
		}}
		onViewStaffingNeedsClick={handleViewStaffingNeeds}
		departmentStats={departmentStats}
	/>

	<div className="mt-4 shrink-0 flex items-center gap-2">
		<Button 
			variant={showJumpList ? "secondary" : "outline"} 
			size="sm" 
			className="h-10 px-3 gap-2 font-bold"
			onClick={() => setShowJumpList(!showJumpList)}
		>
			<Activity className="size-4" />
			Jump List
		</Button>
		
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-10 px-3 gap-2 font-bold text-muted-foreground hover:text-foreground">
					<Settings2 className="size-4" />
					System Tools
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground/60">Data Health</DropdownMenuLabel>
				{integrityDiagnostics && (
					<Dialog>
						<DialogTrigger asChild>
							<DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 cursor-pointer">
								<Activity className="size-4 text-blue-600" />
								<div className="flex flex-col">
									<span className="font-bold text-xs">Integrity Diagnostics</span>
									<span className="text-[0.65rem] text-muted-foreground">
										{integrityDiagnostics.currentYearMissingOwnershipPairs > 0 
											? `${integrityDiagnostics.currentYearMissingOwnershipPairs} issues found` 
											: 'Healthy'}
									</span>
								</div>
							</DropdownMenuItem>
						</DialogTrigger>
						<DialogContent className="max-w-2xl">
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<AlertTriangle className="size-5 text-blue-700" />
									Teaching Load Integrity Diagnostics
								</DialogTitle>
								<DialogDescription>
									Technical reconciliation between the subject-section contract and current ownership rows.
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-3 py-4">
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									<div className="rounded-xl border p-3 bg-muted/20">
										<p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Empty seeded rows</p>
										<p className="text-xl font-bold mt-1">{integrityDiagnostics.emptySectionRows}</p>
									</div>
									<div className="rounded-xl border p-3 bg-muted/20">
										<p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Missing ownership</p>
										<p className="text-xl font-bold mt-1 text-blue-700">{integrityDiagnostics.currentYearRowsMissingOwnership}</p>
									</div>
									<div className="rounded-xl border p-3 bg-muted/20">
										<p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Outside scope</p>
										<p className="text-xl font-bold mt-1">{integrityDiagnostics.currentYearOwnershipWithoutMatchingScope}</p>
									</div>
								</div>
								
								{integrityDiagnostics.missingOwnershipSamples.length > 0 && (
									<div className="mt-2 p-3 rounded-xl border border-blue-100 bg-blue-50/30">
										<p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-2">Affected Examples</p>
										<div className="flex flex-wrap gap-2">
											{integrityDiagnostics.missingOwnershipSamples.slice(0, 10).map((row, idx) => (
												<Badge key={idx} variant="outline" className="bg-white/80 border-blue-200 text-blue-700 font-semibold">
													{row.subjectCode} ({row.facultyName})
												</Badge>
											))}
										</div>
									</div>
								)}
							</div>
							<DialogFooter>
								<Button variant="secondary" onClick={() => {}} className="font-bold">Close Diagnostics</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuLabel className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground/60">Maintenance</DropdownMenuLabel>
				<DropdownMenuItem 
					className="text-destructive focus:text-destructive gap-2 cursor-pointer"
					disabled={resetLoading || !activeSchoolYearId || isReadOnlyMode}
					onSelect={openGlobalResetPreview}
				>
					<RotateCcw className="size-4" />
					<span className="font-bold text-xs uppercase">Reset Global Load</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	</div>
</div>

{readOnlyNotice && (
	<div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 shadow-sm animate-in fade-in duration-300">
		<div className="flex items-center gap-2">
			<AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
			<span className="font-semibold">{readOnlyNotice}</span>
		</div>
		<Button
			variant="ghost"
			size="sm"
			className="h-6 px-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
			onClick={() => fetchData({ forceRefresh: true })}
			disabled={loading}
		>
			Refresh
		</Button>
	</div>
)}

{syntheticCoverageTeachers.length > 0 && (
	<div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50/40 px-3 py-1.5 text-xs text-violet-900 shadow-sm animate-in fade-in duration-300">
		<div className="flex items-center gap-2">
			<Info className="size-3.5 shrink-0 text-violet-700 opacity-60" />
			<span className="font-medium">
				Synthetic coverage: <span className="font-bold text-violet-800">{coverageHeadline.syntheticAssigned} pairs</span> across {syntheticCoverageTeachers.length} placeholder rows ({Math.round(syntheticCoverageHours * 10) / 10}h).
			</span>
		</div>
		<Button
			variant="ghost"
			size="sm"
			className="h-6 px-2 text-xs font-bold text-violet-800 hover:bg-violet-100"
			onClick={() => setShowSyntheticCoverageRows((value) => !value)}
		>
			{showSyntheticCoverageRows ? 'Hide Placeholder Rows' : 'Show Placeholder Rows'}
		</Button>
	</div>
)}

<div className="mt-2 flex min-h-0 flex-1 gap-4 pb-3">
<div className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
<div className="border-b border-border p-2 space-y-2 bg-muted/10">
<div className="flex items-center gap-2">
	<div className="relative flex-1">
		<Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
		<Input
			placeholder="Search roster..."
			value={searchQuery}
			onChange={(event) => setSearchQuery(event.target.value)}
			className="h-7 pl-8 text-xs bg-background"
		/>
	</div>
	<Button
		variant={showFilters ? 'secondary' : 'outline'}
		size="icon-sm"
		className="h-7 w-7"
		onClick={() => setShowFilters(!showFilters)}
	>
		<Filter className="size-3" />
	</Button>
</div>

{showFilters && (
	<div className="space-y-1.5 pt-1 animate-in slide-in-from-top-2 duration-200">
		<div className="flex gap-1">
			{(['all', 'assigned', 'unassigned'] as const).map((status) => (
				<Button
					key={status}
					type="button"
					variant={filterStatus === status ? 'default' : 'outline'}
					size="sm"
					onClick={() => setFilterStatus(status)}
					className="h-5 flex-1 px-0 text-[0.6rem] font-bold uppercase tracking-tight"
				>
					{status === 'all' ? 'Any' : status.charAt(0).toUpperCase() + status.slice(1)}
				</Button>
			))}
		</div>
		
		<div className="grid grid-cols-1 gap-1">
			<SearchableSelect
				value={departmentFilter}
				onValueChange={setDepartmentFilter}
				placeholder="All Departments"
				triggerClassName="h-6 w-full justify-between text-[0.7rem] font-semibold bg-background"
				className="w-full"
				items={[
					{ value: 'all', label: 'All Departments' },
					...departmentOptions.map((department) => ({ value: department, label: department })),
				]}
			/>
		</div>
		
		<div className="grid grid-cols-1 gap-1">
			<Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'load-asc' | 'load-desc')}>
				<SelectTrigger className="h-6 w-full text-[0.7rem] font-semibold bg-background">
					<SelectValue placeholder="Sort by load" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="load-asc" className="text-xs">Load: Low to High</SelectItem>
					<SelectItem value="load-desc" className="text-xs">Load: High to Low</SelectItem>
				</SelectContent>
			</Select>
		</div>

		<div className="flex flex-wrap gap-1">
			{([
				{ value: 'all', label: 'All' },
				{ value: 'overloaded', label: 'Over' },
				{ value: 'optimal', label: 'Opt' },
				{ value: 'underloaded', label: 'Under' },
			] as const).map((item) => (
				<Button
					key={item.value}
					type="button"
					variant={loadFilter === item.value ? 'default' : 'outline'}
					size="sm"
					onClick={() => setLoadFilter(item.value)}
					className="h-5 flex-1 px-0 text-[0.6rem] font-bold uppercase tracking-tight"
				>
					{item.label}
				</Button>
			))}
		</div>
	</div>
)}
</div>

<div className="flex-1 overflow-auto">
{loading ? (
Array.from({ length: 12 }).map((_, index) => (
<div key={index} className="flex items-center gap-3 border-b border-border px-4 py-3">
<Skeleton className="size-8 shrink-0 rounded-full" />
<div className="flex-1 space-y-1.5">
<Skeleton className="h-4 w-28" />
<Skeleton className="h-3 w-20" />
</div>
<Skeleton className="h-5 w-12 shrink-0" />
</div>
))
) : filteredFaculty.length === 0 ? (
						<p className="p-8 text-center text-xs text-muted-foreground italic">
							{faculty.length === 0 ? 'No teachers synced.' : 'No matches found.'}
						</p>
) : (
groupedFaculty.map(([departmentName, members]) => (
	<div key={departmentName} className="border-b border-border/80">
		<div className="bg-muted/40 px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
			<span className="truncate">{departmentName}</span>
			<span className="shrink-0 ml-2 opacity-60">{members.length}</span>
		</div>
		{members.map((member) => {
const effectiveSubjectCount = effectiveAssignmentsByFaculty[member.id]?.length ?? 0;
const hasDraft = Boolean(effectiveDraftAssignmentsByFaculty[member.id]);
					const displayHours = getComparableLoadHours(member);
					const actualLoadPercentage = member.isPlaceholder
						? 0
						: member.maxHoursPerWeek > 0
						? Math.round((displayHours / member.maxHoursPerWeek) * 100)
						: (member as any).loadPercentage ?? 0;
					const loadColorClass = member.isPlaceholder
						? 'text-violet-600'
						: actualLoadPercentage > 150
						? 'text-red-600'
						: actualLoadPercentage > 100
							? 'text-amber-600'
							: 'text-emerald-600';
					const loadBarClass = member.isPlaceholder
						? 'bg-violet-500'
						: actualLoadPercentage > 150
						? 'bg-red-500'
						: actualLoadPercentage > 100
							? 'bg-amber-500'
							: 'bg-emerald-500';
return (
<Button
key={member.id}
type="button"
variant="ghost"
onClick={() => setSelectedId(member.id)}
className={`h-auto w-full justify-start rounded-none border-b border-border/50 px-3 py-2 text-left transition-all ${
selectedId === member.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-muted/50 border-l-4 border-l-transparent'
}`}
>
<div className="flex w-full items-center gap-2.5">
<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.65rem] font-bold text-primary shadow-sm border border-primary/5">
{member.firstName[0]}
{member.lastName[0]}
</div>
<div className="flex-1 min-w-0">
	<p className={`truncate text-xs ${selectedId === member.id ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground'}`}>
		{member.lastName}, {member.firstName}
	</p>
	<div className="flex items-center gap-2 mt-0.5">
		<span className="truncate text-[0.65rem] text-muted-foreground/80 font-medium flex-1">
			{member.specialization || member.department || 'General'}
		</span>
		<div className="flex flex-col items-end shrink-0">
			<span className={`text-[0.6rem] font-bold tabular-nums ${loadColorClass}`}>
				{member.isPlaceholder ? `${Math.round(displayHours * 10) / 10}h` : `${actualLoadPercentage}%`}
			</span>
		</div>
	</div>
</div>
<div className="flex items-center gap-1 shrink-0">
{hasDraft && <div className="size-1.5 rounded-full bg-sky-500 animate-pulse" />}
{effectiveSubjectCount === 0 ? (
<AlertTriangle className="size-3 text-amber-500 opacity-60" />
) : (
<CheckCircle2 className="size-3 text-emerald-500 opacity-60" />
)}
</div>
</div>
</Button>
);
})}
	</div>
))
)}
</div>
<div className="border-t border-border bg-muted/20 px-3 py-1.5 text-[0.6rem] font-bold text-muted-foreground flex items-center justify-between uppercase tracking-tight">
	<span>{coverageHeadline.realAssigned}R / {coverageHeadline.syntheticAssigned}S</span>
	<span className={coverageHeadline.unassigned > 0 ? 'text-amber-600' : 'text-emerald-600'}>
		{coverageHeadline.unassigned} Uncovered
	</span>
</div>
</div>

{showJumpList && (
	<div className="w-16 shrink-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden py-2 animate-in slide-in-from-left-2 duration-300">
		<div className="px-2 mb-2">
			<h5 className="text-[0.55rem] font-black text-center uppercase tracking-tighter text-muted-foreground opacity-60">Jump</h5>
		</div>
		<div className="flex-1 overflow-auto scrollbar-none px-1 space-y-1">
			{jumpListItems.map((item) => (
				<Tooltip key={item.id}>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-xs"
							className={`w-full h-8 font-black text-[0.65rem] ${item.type === 'qualified' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-muted-foreground hover:bg-muted'}`}
							onClick={() => {
								document.getElementById(`subject-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
							}}
						>
							{item.code.slice(0, 3)}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right" className="text-xs font-bold">
						{item.code} {item.type === 'qualified' ? '(Qualified)' : '(Outside Dept)'}
					</TooltipContent>
				</Tooltip>
			))}
		</div>
	</div>
)}

<div className="flex-1 overflow-auto">
{!selected ? (
<div className="flex h-full items-center justify-center text-muted-foreground">
<div className="text-center">
<UserCog className="mx-auto size-10 text-muted-foreground/30" />
<p className="mt-2 text-sm font-semibold">Select a teacher to manage assignments</p>
</div>
</div>
) : (
<div className="flex h-full flex-col space-y-3">
	{/* Identity Bar - Materially Slimmer */}
	<div className="shrink-0 flex items-center justify-between gap-4 p-3 bg-card border border-border/50 rounded-xl shadow-sm">
		<div className="flex items-center gap-3 flex-1 min-w-0">
			<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary border border-primary/10 shadow-inner">
				{selected.firstName[0]}{selected.lastName[0]}
			</div>
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<p className="truncate text-sm font-bold leading-none">
						{selected.firstName} {selected.lastName}
					</p>
					{selected.isClassAdviser && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Star className="size-3.5 fill-amber-500 text-amber-600 cursor-help" />
							</TooltipTrigger>
							<TooltipContent className="text-xs font-bold">
								{advisedSectionMeta ? `Adviser: GR${advisedSectionMeta.gradeLevel} - ${advisedSectionMeta.sectionName}` : 'Class Adviser'}
							</TooltipContent>
						</Tooltip>
					)}
					{!selected.isActiveForScheduling && (
						<Badge variant="outline" className="h-4 border-red-200 bg-red-50 text-red-700 text-[0.6rem] font-bold uppercase px-1.5">Excluded</Badge>
					)}
				</div>
				<p className="truncate text-[0.65rem] text-muted-foreground font-bold mt-1 uppercase tracking-widest flex items-center gap-2">
					<span className="text-foreground/80">{selected.specialization || 'General'}</span>
					<span className="opacity-30">•</span>
					<span>{selected.department || 'No Dept'}</span>
					<span className="opacity-30">•</span>
					<code className="text-[0.6rem] font-mono opacity-50">#{selected.employeeId || 'TBD'}</code>
				</p>
			</div>
		</div>

		<div className="flex items-center gap-4">
			<div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/40 shadow-inner">
				<div className="flex flex-col">
					<span className="text-[0.6rem] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-0.5">Current Load</span>
					<div className="flex items-baseline gap-1.5">
						<span className="text-lg font-black tracking-tight">{loadProfile.actualTeachingHours}h</span>
						<Badge className={`${STATUS_COLORS[loadProfile.status].bg} ${STATUS_COLORS[loadProfile.status].text} h-4 border-none text-[0.55rem] font-black uppercase tracking-tighter px-1 shadow-none`}>
							{loadProfile.statusLabel}
						</Badge>
					</div>
				</div>

				<div className="w-24 space-y-1 pt-1">
					<div className="h-1.5 w-full bg-muted rounded-full overflow-hidden shadow-inner border border-muted/50">
						<div
							className="h-full bg-emerald-500 transition-all shadow-[0_0_8px_rgba(16,185,129,0.3)]"
							style={{ width: `${Math.min((loadProfile.actualTeachingHours * 60 / Math.max(loadCapMinutes, 1)) * 100, 100)}%` }}
						/>
						{hoveredIncomingMinutes > 0 && (
							<div
								className={`h-full -mt-1.5 transition-all ${previewLoadHours * 60 > 2400 ? 'bg-red-500/80' : previewLoadHours * 60 > 1800 ? 'bg-amber-400/80' : 'bg-emerald-300/80'}`}
								style={{ width: `${Math.min((previewLoadHours * 60 / Math.max(loadCapMinutes, 1)) * 100, 100)}%` }}
							/>
						)}
					</div>
					<div className="flex justify-between text-[0.55rem] font-black uppercase tracking-tighter tabular-nums opacity-60">
						<span>{loadProfile.actualTeachingHours}h</span>
						<span>Max {selected.maxHoursPerWeek}h</span>
					</div>
				</div>

				<Popover>
					<PopoverTrigger asChild>
						<Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-md hover:bg-primary/5 text-primary">
							<Info className="size-4" />
						</Button>
					</PopoverTrigger>
					<PopoverContent side="bottom" align="end" className="w-80 p-0 overflow-hidden shadow-xl border-border/50">
						<div className="bg-blue-600 p-3 text-white">
							<h5 className="text-[0.65rem] font-black uppercase tracking-[0.15em] opacity-80 mb-0.5">Load Calculation Details</h5>
							<p className="text-lg font-black leading-tight">{loadProfile.actualTeachingHours}h <span className="text-xs font-medium opacity-70 italic">Concurrent Weekly</span></p>
						</div>
						<div className="p-4 space-y-4">
							<div className="space-y-2">
								<p className="text-xs text-muted-foreground font-medium leading-relaxed">
									ATLAS removes <span className="font-bold text-foreground">{rotationOvercountHours}h</span> of overlapping rotation-family sections to reflect true concurrent weekly demand.
								</p>
								<div className="p-2 rounded-lg bg-blue-50/50 border border-blue-100 text-[0.65rem] italic text-blue-700 leading-tight">
									Rotation families (e.g. Science/TLE) often overlap terms. ATLAS ensures teachers aren't penalized for these non-simultaneous hours.
								</div>
							</div>
							<div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
								<div className="flex flex-col">
									<span className="text-[0.55rem] font-bold uppercase tracking-tighter text-muted-foreground/70">Raw Rows</span>
									<span className="text-xs font-black text-foreground">{loadProfile.rawTeachingHours}h</span>
								</div>
								<div className="flex flex-col border-l border-border/40 pl-3">
									<span className="text-[0.55rem] font-bold uppercase tracking-tighter text-muted-foreground/70">Credits</span>
									<span className="text-xs font-black text-emerald-600">+{loadProfile.equivalentHours}h</span>
								</div>
								<div className="flex flex-col border-l border-border/40 pl-3">
									<span className="text-[0.55rem] font-bold uppercase tracking-tighter text-muted-foreground/70">Load %</span>
									<span className="text-xs font-black text-foreground">{selected.policyLoadPercentage}%</span>
								</div>
							</div>
							{rotationFamilyDetails.length > 0 && (
								<div className="border-t border-border/40 pt-3 space-y-2">
									<span className="text-[0.55rem] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Concurrent Families</span>
									<div className="flex flex-wrap gap-1">
										{rotationFamilyDetails.map((f: RotationFamilyLoadDetail) => (
											<Badge key={f.family} variant="outline" className="text-[0.55rem] font-black uppercase px-1.5 py-0 h-4 bg-muted/30 border-muted">
												{f.family}: {f.creditedHours}h
											</Badge>
										))}
									</div>
								</div>
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	</div>

	{/* Workspace Card */}
	<Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-sm border-border/40">
<div className="flex items-center justify-between border-b border-border/60 bg-muted/10 px-4 py-2">
<div className="flex items-center gap-3">
<h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.15em]">Subject Assignments</h3>
{selected.department && <Badge variant="outline" className="border-border/40 bg-white/80 text-muted-foreground font-black text-[0.6rem] px-2 py-0 h-5 shadow-none uppercase">{selected.department}</Badge>}
</div>
<div className="flex items-center gap-2">
	{dirty && (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-[0.65rem] font-black text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-100 shadow-none uppercase tracking-tighter mr-2">
					{pendingChangeLedger.length} Pending Changes
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-64 p-3 shadow-xl">
				<h6 className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground mb-2">Draft Ledger</h6>
				<div className="space-y-1 max-h-48 overflow-auto">
					{pendingChangeLedger.map((change, idx) => (
						<div key={idx} className="flex items-center justify-between text-[0.7rem] border-b border-border/40 py-1 last:border-0">
							<span className="truncate font-bold mr-2">{change.facultyName.split(',')[0]}</span>
							<Badge variant="outline" className={`h-4 text-[0.55rem] px-1 font-black ${change.type === 'add' ? 'text-emerald-600' : 'text-amber-600'}`}>
								{change.type === 'add' ? '+' : '-'}{change.count} sections
							</Badge>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	)}

	<div className="flex items-center bg-background rounded-lg border border-border/60 p-0.5 shadow-inner mr-2">
		<Button type="button" variant="ghost" size="icon-xs" onClick={handleUndo} disabled={!canUndo || saving || isReadOnlyMode} className="h-7 w-8 font-bold text-xs">
			<Undo2 className="size-3.5" />
		</Button>
		<Button type="button" variant="ghost" size="icon-xs" onClick={handleRedo} disabled={!canRedo || saving || isReadOnlyMode} className="h-7 w-8 font-bold text-xs">
			<Redo2 className="size-3.5" />
		</Button>
	</div>
	
	<DropdownMenu>
		<DropdownMenuTrigger asChild>
			<Button variant="outline" size="sm" className="h-8 px-2 gap-2 text-xs font-bold text-muted-foreground">
				<MoreHorizontal className="size-3.5" />
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end" className="w-48">
			<DropdownMenuItem onSelect={handleResetAssignments} disabled={saving || !selected.isActiveForScheduling || !sectionsAvailable || isReadOnlyMode} className="gap-2 cursor-pointer">
				<RotateCcw className="size-3.5" />
				<span className="text-xs font-bold uppercase">Reset Draft</span>
			</DropdownMenuItem>
			{dirty && (
				<DropdownMenuItem onSelect={discardSelectedDraft} disabled={saving || isReadOnlyMode} className="gap-2 cursor-pointer text-amber-600">
					<RotateCcw className="size-3.5" />
					<span className="text-xs font-bold uppercase">Discard Changes</span>
				</DropdownMenuItem>
			)}
		</DropdownMenuContent>
	</DropdownMenu>

<Button type="button" size="sm" onClick={handleSave} disabled={!dirty || saving || !selected.isActiveForScheduling || !sectionsAvailable || isReadOnlyMode} className="h-8 font-bold text-xs gap-1.5 shadow-md shadow-primary/10">
<Save className="size-3.5" />
{saving ? 'Saving...' : 'Save Assignments'}
</Button>
</div>
</div>
<div className="flex items-center gap-4 border-b border-border bg-muted/5 px-5 py-3">
				<div className="relative w-64 shrink-0">
					<Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search subjects or sections..."
						value={subjectSearch}
						onChange={(event) => setSubjectSearch(event.target.value)}
						className="h-8 pl-9 text-xs bg-background shadow-sm"
					/>
				</div>
				<Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as 'all' | 'unassigned' | 'assigned')}>
					<SelectTrigger className="h-8 w-40 text-xs font-semibold bg-background shadow-sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-xs">All Sections</SelectItem>
						<SelectItem value="unassigned" className="text-xs">Unassigned Only</SelectItem>
						<SelectItem value="assigned" className="text-xs">Assigned Only</SelectItem>
					</SelectContent>
				</Select>
								<Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
									<SelectTrigger className="h-8 w-36 text-xs font-semibold bg-background shadow-sm">
										<SelectValue placeholder="Grade Level" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all" className="text-xs">All Grades</SelectItem>
										<SelectItem value="7" className="text-xs">Grade 7</SelectItem>
										<SelectItem value="8" className="text-xs">Grade 8</SelectItem>
										<SelectItem value="9" className="text-xs">Grade 9</SelectItem>
										<SelectItem value="10" className="text-xs">Grade 10</SelectItem>
									</SelectContent>
								</Select>
			</div>

			<CardContent className="flex-1 overflow-auto pt-4 space-y-4">
{!selected.isActiveForScheduling && (
<div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm animate-in slide-in-from-left-2 duration-300">
<AlertTriangle className="size-4 shrink-0" />
<span className="font-semibold uppercase tracking-tight text-xs">Exclusion Notice:</span>
<span>This teacher is excluded from scheduling. Enable them in EnrollPro to assign classes.</span>
</div>
)}

{!sectionsAvailable && (
<div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
<AlertTriangle className="mt-0.5 size-4 shrink-0" />
<div>
<p className="font-bold uppercase tracking-tight text-xs">Roster synchronization required</p>
<p className="text-[0.75rem] opacity-90">Precision scheduling requires an active section roster. Please verify connection to the EnrollPro bridge.</p>
</div>
</div>
)}

{(() => {
	const renderTier = (subjects: Subject[], title: string, badge?: string) => {
		if (subjects.length === 0) return null;
		return (
			<div className="mb-6 last:mb-0">
				<div className="mb-3 flex items-center gap-3">
					<h4 className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">{title}</h4>
						{badge && <Badge variant="outline" className="text-[0.6rem] font-bold bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-0 h-5 shadow-none">{badge}</Badge>}
						<div className="flex-1 h-px bg-border/40" />
				</div>
				<div className="space-y-3">
					{subjects.map((subject) => (
						<SubjectRow
							key={subject.id}
							subject={subject}
							assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
								sections={allKnownSections.filter((sec) => {
									const gradeCompatible = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(sec.displayOrder);
									if (!gradeCompatible) return false;
									const programType = (sec.programType ?? 'REGULAR').toUpperCase();
									return subject.programScopes.length === 0 || subject.programScopes.some((scope) => scope.toUpperCase() === programType);
								})}
							disabled={!selected.isActiveForScheduling || !sectionsAvailable || isReadOnlyMode}
							selectedFacultyId={selected.id}
							savedOwnershipMap={savedOwnershipMap}
							pendingOwnershipMap={pendingOwnershipMap}
							savedConflictMap={savedConflictMap}
							onSetSections={setSubjectSections}
							searchTerm={subjectSearch}
							gradeLevelFilter={gradeLevelFilter}
							sectionFilter={sectionFilter}
							advisedSectionId={homeroomHint?.advisedSectionId ?? null}
							remainingCapacityMinutes={remainingCapacityMinutes}
							onHoverLoadMinutes={setHoveredIncomingMinutes}
							onClearHoverLoad={() => setHoveredIncomingMinutes(0)}
							activeFacultyIds={activeFacultyIds}
							onSwapSectionOwnership={(subjectId, sectionId, fromFacultyId) =>
								setSwapCandidate({ subjectId, sectionId, fromFacultyId })
							}
						/>
					))}
				</div>
			</div>
		);
	};

	return (
		<>
			{renderTier(
				departmentQualifiedSubjects,
				'Department Qualified',
				selected.department ?? 'Qualified',
			)}
			{outsideDepartmentSubjects.length > 0 && (
				<div className="pt-2">
					<div className="mb-3 flex items-center gap-3">
						<h4 className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Outside Department</h4>
						<Badge variant="outline" className={`text-[0.6rem] font-bold px-2 py-0 h-5 shadow-none ${selected.canTeachOutsideDepartment ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
							{selected.canTeachOutsideDepartment ? 'ASSIGNMENT ENABLED' : 'LOCKED BY POLICY'}
						</Badge>
						<div className="flex-1 h-px bg-border/40" />
					</div>
					<div className={`space-y-3 ${selected.canTeachOutsideDepartment ? '' : 'opacity-60'}`}>
						{outsideDepartmentSubjects.map((subject) => (
							<SubjectRow
								key={subject.id}
								subject={subject}
								assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
								sections={allKnownSections.filter((sec) => {
									const gradeCompatible = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(sec.displayOrder);
									if (!gradeCompatible) return false;
									const programType = (sec.programType ?? 'REGULAR').toUpperCase();
									return subject.programScopes.length === 0 || subject.programScopes.some((scope) => scope.toUpperCase() === programType);
								})}
								disabled={!selected.canTeachOutsideDepartment || !selected.isActiveForScheduling || !sectionsAvailable || isReadOnlyMode}
								selectedFacultyId={selected.id}
								savedOwnershipMap={savedOwnershipMap}
								pendingOwnershipMap={pendingOwnershipMap}
								savedConflictMap={savedConflictMap}
								onSetSections={setSubjectSections}
								isOutsideDepartment
								searchTerm={subjectSearch}
								gradeLevelFilter={gradeLevelFilter}
								sectionFilter={sectionFilter}
								advisedSectionId={homeroomHint?.advisedSectionId ?? null}
								remainingCapacityMinutes={remainingCapacityMinutes}
								onHoverLoadMinutes={setHoveredIncomingMinutes}
								onClearHoverLoad={() => setHoveredIncomingMinutes(0)}
								activeFacultyIds={activeFacultyIds}
								onSwapSectionOwnership={(subjectId, sectionId, fromFacultyId) =>
									setSwapCandidate({ subjectId, sectionId, fromFacultyId })
								}
							/>
						))}
					</div>
				</div>
			)}
		</>
	);
})()}
</CardContent>
</Card>
</div>
)}
</div>
</div>
</div>
<ConfirmationModal
	open={autoFillDialogOpen}
	onOpenChange={setAutoFillDialogOpen}
	title="Auto-Fill Remaining Assignments?"
	description={activeDraftCount > 0
		? `This will assign teachers to currently unassigned subject-sections using saved data only. ${activeDraftCount} unsaved draft${activeDraftCount === 1 ? '' : 's'} will be ignored.`
		: 'This will assign teachers to currently unassigned subject-sections using department alignment and current teaching load. Existing manual assignments will not be overwritten.'}
	onConfirm={handleAutoFill}
	confirmText="Run Auto-Fill"
	variant="primary"
	loading={autoFillLoading}
/>

<ConfirmationModal
	open={Boolean(swapCandidate)}
	onOpenChange={(open) => {
		if (!open) setSwapCandidate(null);
	}}
	title="Swap Section Ownership?"
	description="This will move the selected subject-section from the current owner to the selected teacher in draft mode."
	onConfirm={executeSwap}
	confirmText="Swap"
	variant="primary"
/>

<AutoFillSummaryModal
	open={summaryModalOpen}
	onOpenChange={setSummaryModalOpen}
	result={summaryModalResult}
/>

<Dialog open={resetDialogOpen} onOpenChange={(open) => { if (!open) { setResetDialogOpen(false); setResetConfirmText(''); } }}>
	<DialogContent className="max-w-md">
		<DialogHeader>
			<DialogTitle className="flex items-center gap-2 text-destructive">
				<AlertTriangle className="size-5 shrink-0" />
				Reset Global Teaching Load
			</DialogTitle>
			<DialogDescription asChild>
				<div className="space-y-3 pt-1">
					<p className="text-sm text-foreground">
						This removes all active subject-section ownership rows for the current school year. Run this only when you intend to rebuild assignments.
					</p>
					{resetPreview && (
						<div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-xs font-medium">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Ownership rows removed</span>
								<span className="font-bold text-destructive">{resetPreview.ownershipRowsToRemove}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Faculty affected</span>
								<span>{resetPreview.affectedFacultyCount}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Subjects affected</span>
								<span>{resetPreview.affectedSubjectCount}</span>
							</div>
						</div>
					)}
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Type <span className="font-bold font-mono text-foreground">RESET</span> to confirm:</p>
						<Input
							value={resetConfirmText}
							onChange={(event) => setResetConfirmText(event.target.value)}
							placeholder="RESET"
							className="font-mono"
							autoComplete="off"
						/>
					</div>
				</div>
			</DialogDescription>
		</DialogHeader>
		<DialogFooter className="gap-2 pt-2">
			<Button variant="ghost" size="sm" onClick={() => { setResetDialogOpen(false); setResetConfirmText(''); }}>
				Cancel
			</Button>
			<Button
				variant="destructive"
				size="sm"
				disabled={isReadOnlyMode || resetLoading || resetConfirmText.trim().toUpperCase() !== 'RESET'}
				onClick={applyGlobalReset}
			>
				{resetLoading ? 'Resetting...' : 'Confirm Reset'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
</TooltipProvider>
);
}

