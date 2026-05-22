import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
AlertTriangle,
CheckCircle2,
ChevronDown,
ChevronRight,
Info,
Redo2,
RotateCcw,
Save,
Search,
Undo2,
UserCog,
Star,
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
normalizeDraftAssignments,
type FacultyAssignmentDraft,
type LoadStatus,
type SubjectSectionOwnershipIndexEntry,
} from '@/lib/faculty-assignment-helpers';
import { getQualificationTier } from '@/lib/grade-labels';
import { fetchPublicSettings } from '@/lib/settings';
import type { ExternalSection, HomeroomHintResponse, SectionSummaryResponse, Subject } from '@/types';
import { OverviewHeader } from '@/components/faculty-assignments/OverviewHeader';
import { SubjectRow } from '@/components/faculty-assignments/SubjectRow';
import { useAssignmentHistory } from '@/hooks/useAssignmentHistory';
import { useSpecializationAliases } from '@/hooks/useSpecializationAliases';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Checkbox } from '@/ui/checkbox';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { SearchableSelect } from '@/ui/searchable-select';
import { Skeleton } from '@/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import {
	AutoFillSummaryModal,
	type AutoFillSummaryResult,
} from '@/components/faculty-assignments/AutoFillSummaryModal';
const DEFAULT_SCHOOL_ID = 1;
const STATUS_COLORS: Record<LoadStatus, { text: string; bg: string; border: string }> = {
'below-standard': { text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
'compliant': { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
'overload-allowed': { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
'over-cap': { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};
type FacultyAssignmentRecord = {
id: number;
subjectId: number;
gradeLevels: number[];
sectionIds: number[];
sections: ExternalSection[];
subject: { id: number; name: string; code: string; minMinutesPerWeek: number };
};
type FacultySummary = {
id: number;
externalId: number;
employeeId: string | null;
firstName: string;
lastName: string;
department: string | null;
specialization: string | null;
employmentStatus: string;
isActiveForScheduling: boolean;
isPlaceholder: boolean;
isClassAdviser: boolean;
advisoryEquivalentHours: number;
ancillaryMinutesPerWeek: number;
canTeachOutsideDepartment: boolean;
maxHoursPerWeek: number;
version: number;
subjectCount: number;
sectionCount: number;
subjectHours: number;
sectionTeachingHours: number;
gradeTeachingHours: number;
advisoryHours: number;
ancillaryHours: number;
policyCreditedHours: number;
policyLoadPercentage: number;
syntheticCoverageHours: number;
loadSignalMode: 'STANDARD' | 'SYNTHETIC_PLACEHOLDER';
assignments: FacultyAssignmentRecord[];
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
const [specializationFilter, setSpecializationFilter] = useState<string>('all');
const [subjectSearch, setSubjectSearch] = useState('');
	const [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
	const [staffingNeedsLoading, setStaffingNeedsLoading] = useState(false);
	const [summaryModalOpen, setSummaryModalOpen] = useState(false);
	const [summaryModalResult, setSummaryModalResult] = useState<AutoFillSummaryResult | null>(null);
	const [gradeLevelFilter, setGradeLevelFilter] = useState<string>('all');
	const [sortOrder, setSortOrder] = useState<'load-asc' | 'load-desc'>('load-asc');
	const [loadFilter, setLoadFilter] = useState<'all' | 'overloaded' | 'optimal' | 'underloaded'>('all');
	const [unmappedOnly, setUnmappedOnly] = useState(false);
	const [hoveredIncomingMinutes, setHoveredIncomingMinutes] = useState(0);
	const [swapCandidate, setSwapCandidate] = useState<{ subjectId: number; sectionId: number; fromFacultyId: number } | null>(null);
const [resetDialogOpen, setResetDialogOpen] = useState(false);
const [resetPreview, setResetPreview] = useState<TeachingLoadResetPreview | null>(null);
const [resetLoading, setResetLoading] = useState(false);
const [resetConfirmText, setResetConfirmText] = useState('');
const [error, setError] = useState<string | null>(null);
const [homeroomHint, setHomeroomHint] = useState<HomeroomHintResponse | null>(null);
const [draftAssignmentsByFaculty, setDraftAssignmentsByFaculty] = useState<Record<number, FacultyAssignmentDraft[]>>({});
const [autoFillLoading, setAutoFillLoading] = useState(false);
const [autoFillDialogOpen, setAutoFillDialogOpen] = useState(false);
const { aliases: specializationAliases, loading: aliasesLoading } = useSpecializationAliases(DEFAULT_SCHOOL_ID);
const fetchData = useCallback(async () => {
setLoading(true);
try {
const settings = await fetchPublicSettings();
const schoolYearId = settings.activeSchoolYearId;
if (!schoolYearId) {
throw new Error('Active school year is not configured.');
}
const [facultyRes, subjectsRes, sectionsRes] = await Promise.all([
atlasApi.get<{ faculty: FacultySummary[]; ownershipIndex?: SubjectSectionOwnershipIndexEntry[] }>('/faculty-assignments/summary', {
params: { schoolId: DEFAULT_SCHOOL_ID, schoolYearId },
}),
atlasApi.get<{ subjects: Subject[] }>('/subjects', {
params: { schoolId: DEFAULT_SCHOOL_ID },
}),
atlasApi.get<SectionSummaryResponse>(`/sections/summary/${schoolYearId}`, {
params: { schoolId: DEFAULT_SCHOOL_ID },
}),
]);
setActiveSchoolYearId(schoolYearId);
setFaculty(facultyRes.data.faculty);
setSavedOwnershipIndex(facultyRes.data.ownershipIndex ?? []);
setSubjects(subjectsRes.data.subjects);
setSectionSummary(sectionsRes.data);
setError(null);
} catch (requestError: any) {
setError(requestError?.response?.data?.message ?? requestError?.message ?? 'Failed to load teaching load data.');
} finally {
setLoading(false);
}
}, []);
useEffect(() => {
fetchData();
}, [fetchData]);
useEffect(() => {
if (faculty.length === 0) {
setSelectedId(null);
return;
}
if (selectedId == null || !faculty.some((member) => member.id === selectedId)) {
setSelectedId(faculty[0].id);
}
}, [faculty, selectedId]);

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
const mergedSections = new Map<number, ExternalSection>();
for (const section of sectionSummary?.sections ?? []) {
mergedSections.set(section.id, section);
}
for (const member of faculty) {
for (const assignment of member.assignments) {
for (const section of assignment.sections ?? []) {
if (!mergedSections.has(section.id)) {
mergedSections.set(section.id, section);
}
}
}
}
return Array.from(mergedSections.values()).sort(
(left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id - right.id,
);
}, [faculty, sectionSummary]);
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
await fetchData();
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
await fetchData();
toast.error(`${responseMessage} Latest saved data was reloaded; your local draft remains visible.`);
} else {
toast.error(responseMessage);
}
} finally {
setSaving(false);
}
}, [activeSchoolYearId, currentAssignments, fetchData, selected]);

const handleAutoFill = useCallback(async () => {
	if (!activeSchoolYearId) return;
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
		await fetchData();
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
			toast.info('Auto-Fill: all subject–section pairs are already assigned.');
		}
		if (activeDraftCount > 0) {
			toast.warning('Auto-Fill used saved assignments only. Unsaved drafts were not included.');
		}
	} catch {
		toast.error('Auto-Fill failed. Please try again.');
	} finally {
		setAutoFillLoading(false);
	}
}, [activeDraftCount, activeSchoolYearId, fetchData, pushHistory]);

const handleViewStaffingNeeds = useCallback(async () => {
	if (!activeSchoolYearId) return;
	setStaffingNeedsLoading(true);
	try {
		const result = await atlasApi.post<AutoFillSummaryResult>(
			'/faculty-assignments/auto-fill',
			{ schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId, previewOnly: true },
		);
		setSummaryModalResult(result.data);
		setSummaryModalOpen(true);
	} catch {
		toast.error('Unable to load staffing needs right now.');
	} finally {
		setStaffingNeedsLoading(false);
	}
}, [activeSchoolYearId]);

const openGlobalResetPreview = useCallback(async () => {
	if (!activeSchoolYearId) return;
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
}, [activeSchoolYearId]);

const applyGlobalReset = useCallback(async () => {
	if (!activeSchoolYearId) return;
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
		await fetchData();
	} catch (requestError: any) {
		toast.error(requestError?.response?.data?.message ?? 'Failed to apply global teaching-load reset.');
	} finally {
		setResetLoading(false);
	}
}, [activeSchoolYearId, fetchData, resetConfirmText]);

const getComparableLoadHours = useCallback((member: FacultySummary) => {
	if (member.isPlaceholder) {
		return member.gradeTeachingHours ?? member.syntheticCoverageHours ?? 0;
	}
	return member.policyCreditedHours ?? member.subjectHours ?? 0;
}, []);

const filteredFaculty = useMemo(() => {
let nextFaculty = faculty;
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
if (specializationFilter !== 'all') {
	nextFaculty = nextFaculty.filter((member) => (member.specialization ?? 'General') === specializationFilter);
}

	if (unmappedOnly) {
		nextFaculty = nextFaculty.filter((member) => {
			const specialization = (member.specialization ?? '').trim();
			if (!specialization) return false;
			return !specializationAliases.some((alias) => alias.alias === specialization);
		});
	}

	nextFaculty = nextFaculty.filter((member) => {
		if (member.isPlaceholder) {
			return loadFilter === 'all';
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
}, [departmentFilter, faculty, filterStatus, getComparableLoadHours, loadFilter, searchQuery, sortOrder, specializationAliases, specializationFilter, unmappedOnly]);

const groupedFaculty = useMemo(() => {
	const grouped = new Map<string, FacultySummary[]>();
	for (const member of filteredFaculty) {
		const department = member.department?.trim() || 'UNASSIGNED DEPARTMENT';
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

const { specializationQualifiedSubjects, outsideSpecializationSubjects } = useMemo(() => {
	const facultyInfo = {
		specialization: selected?.specialization ?? null,
		department: selected?.department ?? null,
	};
	const qualified: Subject[] = [];
	const outside: Subject[] = [];

	for (const subject of subjects) {
		const tier = getQualificationTier(facultyInfo, subject, specializationAliases);
		const isHgSubject = subject.code === 'HG' || subject.name.toLowerCase().includes('homeroom');
		const isQualifiedBySpecialization = tier === 1 || (!aliasesLoading && tier === 2);
		if ((isHgSubject && selected?.isClassAdviser) || isQualifiedBySpecialization) {
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
		specializationQualifiedSubjects: qualified,
		outsideSpecializationSubjects: outside,
	};
}, [aliasesLoading, selected, specializationAliases, subjects]);


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

const specializationOptions = useMemo(() => {
	const source = departmentFilter === 'all'
		? faculty
		: faculty.filter((member) => member.department === departmentFilter);
	const specs = Array.from(new Set(source.map((member) => member.specialization ?? 'General'))).sort();
	return specs;
}, [departmentFilter, faculty]);

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

const teachablePairTotals = useMemo(() => {
	const activeAcademicSubjects = subjects.filter((subject) => (subject.isActive || subject.id === subjectFocusId) && subject.code !== 'HG');
	const teachablePairs = new Set<string>();
	for (const subject of activeAcademicSubjects) {
		const relevantSections = allKnownSections.filter(
			(section) => subject.gradeLevels.length === 0 || subject.gradeLevels.includes(section.displayOrder),
		);
		for (const section of relevantSections) {
			teachablePairs.add(`${subject.id}:${section.id}`);
		}
	}

	const assignedPairs = new Set<string>();
	const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
	for (const assignments of Object.values(effectiveAssignmentsByFaculty)) {
		for (const assignment of assignments) {
			const subject = subjectMap.get(assignment.subjectId);
			if (!subject || subject.code === 'HG') {
				continue;
			}
			for (const sectionId of assignment.sectionIds) {
				const key = `${assignment.subjectId}:${sectionId}`;
				if (teachablePairs.has(key)) {
					assignedPairs.add(key);
				}
			}
		}
	}

	return {
		total: teachablePairs.size,
		assigned: assignedPairs.size,
	};
}, [allKnownSections, effectiveAssignmentsByFaculty, subjects]);

const assignedFacultyCount = faculty.filter((member) => (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) > 0).length;
const sectionsAvailable = Boolean(sectionSummary && sectionSummary.sections.length > 0);

const executeSwap = useCallback(() => {
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
}, [pushHistory, savedAssignmentsByFaculty, sectionMap, selected, swapCandidate]);

return (
<TooltipProvider delayDuration={200}>
<div className="flex h-[calc(100svh-3.5rem)] flex-col px-6">
{error && (
<div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
<span>{error}</span>
<Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-7 px-2 text-red-700 hover:bg-red-100 hover:text-red-800">
Dismiss
</Button>
</div>
)}

<OverviewHeader
	assignedPairs={teachablePairTotals.assigned}
	totalPairs={teachablePairTotals.total}
	assignedFacultyCount={assignedFacultyCount}
	totalFacultyCount={faculty.length}
	activeDraftCount={activeDraftCount}
	autoFillLoading={autoFillLoading}
	staffingNeedsLoading={staffingNeedsLoading}
	autoFillEnabled={Boolean(activeSchoolYearId)}
	resetLoading={resetLoading}
	onAutoFillClick={() => setAutoFillDialogOpen(true)}
	onViewStaffingNeedsClick={handleViewStaffingNeeds}
	onResetGlobalClick={openGlobalResetPreview}
/>

<div className="mt-3 flex min-h-0 flex-1 gap-4 pb-3">
<div className="flex w-80 shrink-0 flex-col rounded-lg border border-border bg-card shadow-sm">
<div className="border-b border-border p-3">
<div className="relative">
<Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
<Input
placeholder="Search faculty..."
value={searchQuery}
onChange={(event) => setSearchQuery(event.target.value)}
className="h-8 pl-8 text-sm"
/>
</div>
<div className="mt-2 flex gap-1">
{(['all', 'assigned', 'unassigned'] as const).map((status) => (
<Button
key={status}
type="button"
variant={filterStatus === status ? 'default' : 'secondary'}
size="sm"
onClick={() => setFilterStatus(status)}
className="h-7 px-2 text-[0.6875rem]"
>
{status.charAt(0).toUpperCase() + status.slice(1)}
</Button>
))}
</div>
<div className="mt-2 grid grid-cols-2 gap-2">
	<SearchableSelect
		value={departmentFilter}
		onValueChange={(value) => {
			setDepartmentFilter(value);
			setSpecializationFilter('all');
		}}
		placeholder="All Departments"
		triggerClassName="h-7 w-full justify-between text-[0.6875rem]"
		className="w-[18rem]"
		items={[
			{ value: 'all', label: 'All Departments' },
			...departmentOptions.map((department) => ({ value: department, label: department })),
		]}
	/>
	<SearchableSelect
		value={specializationFilter}
		onValueChange={setSpecializationFilter}
		placeholder="All Specializations"
		triggerClassName="h-7 w-full justify-between text-[0.6875rem]"
		className="w-[18rem]"
		items={[
			{ value: 'all', label: 'All Specializations' },
			...specializationOptions.map((specialization) => ({ value: specialization, label: specialization })),
		]}
	/>
</div>
				<div className="mt-2 grid grid-cols-2 gap-2">
					<Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'load-asc' | 'load-desc')}>
						<SelectTrigger className="h-7 w-full text-[0.6875rem]">
							<SelectValue placeholder="Sort by load" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="load-asc">Load: Lowest to Highest</SelectItem>
							<SelectItem value="load-desc">Load: Highest to Lowest</SelectItem>
						</SelectContent>
					</Select>
					<Button
						type="button"
						variant={unmappedOnly ? 'default' : 'secondary'}
						onClick={() => setUnmappedOnly((current) => !current)}
						className="h-7 px-2 text-[0.625rem]"
					>
						Unmapped Specs
					</Button>
				</div>
				<div className="mt-2 flex flex-wrap gap-1">
					{([
						{ value: 'all', label: 'All Loads' },
						{ value: 'overloaded', label: 'Overloaded' },
						{ value: 'optimal', label: 'Optimal' },
						{ value: 'underloaded', label: 'Under-loaded' },
					] as const).map((item) => (
						<Button
							key={item.value}
							type="button"
							variant={loadFilter === item.value ? 'default' : 'secondary'}
							size="sm"
							onClick={() => setLoadFilter(item.value)}
							className="h-6 px-2 text-[0.625rem]"
						>
							{item.label}
						</Button>
					))}
				</div>
</div>

<div className="flex-1 overflow-auto">
{loading ? (
Array.from({ length: 8 }).map((_, index) => (
<div key={index} className="flex items-center gap-3 border-b border-border px-3 py-2.5">
<Skeleton className="size-8 shrink-0 rounded-full" />
<div className="flex-1 space-y-1.5">
<Skeleton className="h-4 w-28" />
<Skeleton className="h-3 w-20" />
</div>
<Skeleton className="h-5 w-12 shrink-0" />
</div>
))
) : filteredFaculty.length === 0 ? (
<p className="p-4 text-center text-sm text-muted-foreground">
{faculty.length === 0 ? 'No faculty synced. Visit the Faculty page first.' : 'No results.'}
</p>
) : (
groupedFaculty.map(([departmentName, members]) => (
	<div key={departmentName} className="border-b border-border/80">
		<div className="bg-muted/40 px-3 py-1.5 text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
			{departmentName} ({members.length})
		</div>
		{members.map((member) => {
const effectiveSubjectCount = effectiveAssignmentsByFaculty[member.id]?.length ?? 0;
const hasDraft = Boolean(effectiveDraftAssignmentsByFaculty[member.id]);
					const displayHours = getComparableLoadHours(member);
					const actualLoadPercentage = member.maxHoursPerWeek > 0
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
className={`h-auto w-full justify-start rounded-none border-b border-border px-3 py-2.5 text-left ${
selectedId === member.id ? 'bg-primary/5' : 'hover:bg-muted/50'
}`}
>
<div className="flex w-full items-center gap-3">
<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
{member.firstName[0]}
{member.lastName[0]}
</div>
<div className="flex-1 min-w-0">
	<div className="flex items-center justify-between gap-2">
		<p className="truncate text-sm font-medium">
			{member.lastName}, {member.firstName}
		</p>
		<span className="text-[0.6rem] font-mono text-muted-foreground shrink-0 bg-muted/50 px-1 rounded">
			{member.employeeId || 'No ID'}
		</span>
	</div>
	<div className="flex items-center gap-1.5 mt-0.5 min-w-0">
		<div className="flex flex-col min-w-0 flex-1">
			{member.department && (
				<span className="truncate text-[0.55rem] font-bold uppercase tracking-wider text-muted-foreground/70">
					{member.department}
				</span>
			)}
			<span className="truncate text-[0.625rem] text-muted-foreground uppercase">
				{member.specialization || (member.department ? '' : 'General')}
			</span>
		</div>
		<div className="flex flex-col items-end gap-0.5 shrink-0">
			<span className={`text-[0.6rem] font-bold ${loadColorClass}`}>
				{member.isPlaceholder ? `${Math.round(displayHours * 10) / 10}h synth` : `${actualLoadPercentage}%`}
			</span>
			<div className="w-10 h-0.5 bg-muted rounded-full overflow-hidden">
				<div 
					className={`h-full transition-all ${loadBarClass}`}
					style={{ width: `${Math.min(actualLoadPercentage, 100)}%` }}
				/>
			</div>
		</div>
	</div>
</div>
<div className="flex items-center gap-1.5">
	{member.isPlaceholder && <Badge className="border-violet-200 bg-violet-50 text-[0.5625rem] text-violet-700">Placeholder</Badge>}
{hasDraft && <Badge className="border-sky-200 bg-sky-50 text-[0.5625rem] text-sky-700">Draft</Badge>}
{effectiveSubjectCount === 0 ? (
<AlertTriangle className="size-4 shrink-0 text-amber-500" />
) : (
<CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
)}
<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
</div>
</div>
</Button>
);
})}
	</div>
))
)}
</div>
<div className="border-t border-border px-3 py-2 text-[0.6875rem] text-muted-foreground">
{teachablePairTotals.assigned} / {teachablePairTotals.total} teachable subject-sections assigned
</div>
</div>
<div className="flex-1 overflow-auto">
{!selected ? (
<div className="flex h-full items-center justify-center text-muted-foreground">
<div className="text-center">
<UserCog className="mx-auto size-10 text-muted-foreground/30" />
<p className="mt-2 text-sm">Select a faculty member to manage assignments.</p>
</div>
</div>
) : (
<div className="flex h-full flex-col">
<div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
{selected.firstName[0]}
{selected.lastName[0]}
</div>
<div className="min-w-0">
<p className="truncate text-sm font-bold">
{selected.firstName} {selected.lastName}
</p>
<p className="truncate text-[0.6875rem] text-muted-foreground font-mono">
{selected.department ?? 'No department'} | ID: {selected.employeeId || 'No ID'}
</p>
</div>
{selected.isClassAdviser && (
				<Badge className="border-amber-300 bg-amber-50 text-amber-700 gap-1 flex items-center">
					<Star className="size-3 fill-amber-500 text-amber-500" />
					{advisedSectionMeta
						? `Adviser of GR${advisedSectionMeta.gradeLevel} - ${advisedSectionMeta.sectionName}`
						: 'Adviser'}
				</Badge>
			)}
			{!selected.isActiveForScheduling && <Badge variant="secondary">Excluded</Badge>}
<div className="ml-auto flex items-center gap-3">
<div className="text-right">
<p className="text-[0.625rem] text-muted-foreground">Actual</p>
<p className="text-sm font-black">
{loadProfile.actualTeachingHours}
<span className="text-[0.625rem] font-medium text-muted-foreground"> h</span>
</p>
</div>
<div className="text-right">
<p className="text-[0.625rem] text-muted-foreground">Credited</p>
<p className="text-sm font-bold">
{loadProfile.creditedTotalHours}
<span className="text-[0.625rem] font-medium text-muted-foreground"> h</span>
</p>
</div>
<div className="text-right">
<p className="text-[0.625rem] text-muted-foreground">Policy %</p>
<p className="text-sm font-bold">{selected.policyLoadPercentage}%</p>
</div>
{selected.isPlaceholder && (
	<Badge className="border-violet-200 bg-violet-50 text-violet-700">Synthetic Coverage</Badge>
)}
<Badge className={`${STATUS_COLORS[loadProfile.status].bg} ${STATUS_COLORS[loadProfile.status].text} ${STATUS_COLORS[loadProfile.status].border}`}>
{loadProfile.statusLabel}
</Badge>
					<div className="w-36">
						<p className="text-[0.625rem] text-muted-foreground">Load Preview</p>
						<div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full bg-emerald-500 transition-all"
								style={{ width: `${Math.min((loadProfile.actualTeachingHours * 60 / Math.max(loadCapMinutes, 1)) * 100, 100)}%` }}
							/>
							{hoveredIncomingMinutes > 0 && (
								<div
									className={`h-full -mt-2 transition-all ${previewLoadHours * 60 > 2400 ? 'bg-red-500/70' : previewLoadHours * 60 > 1800 ? 'bg-amber-400/70' : 'bg-emerald-300/80'}`}
									style={{ width: `${Math.min((previewLoadHours * 60 / Math.max(loadCapMinutes, 1)) * 100, 100)}%` }}
								/>
							)}
						</div>
						<p className="mt-1 text-[0.625rem] text-muted-foreground">
							{loadProfile.actualTeachingHours}h
							{hoveredIncomingMinutes > 0 ? ` -> ${previewLoadHours}h` : ''}
						</p>
					</div>
<Tooltip>
<TooltipTrigger asChild>
<Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
<Info className="mr-1.5 size-3.5" />
Breakdown
</Button>
</TooltipTrigger>
<TooltipContent side="bottom" align="end" className="max-w-sm text-xs">
<div className="space-y-1.5">
<p className="font-semibold">Section-based teaching load</p>
<p>Standard: 30h/wk | Max: 40h/wk</p>
{loadProfile.equivalentHours > 0 && <p>Policy credits (adviser + ancillary): +{loadProfile.equivalentHours}h</p>}
<p>Ancillary (policy): +{Math.round(((selected.ancillaryMinutesPerWeek || 0) / 60) * 10) / 10}h</p>
{selected.isPlaceholder && <p className="text-violet-700">Placeholder rows represent synthetic coverage and are not treated as standard operator overload signals.</p>}
<div className="max-h-44 space-y-1 overflow-auto border-t border-border pt-1">
{loadProfile.breakdown.length === 0 ? (
<p className="text-muted-foreground">No sections selected yet.</p>
) : (
loadProfile.breakdown.map((item) => (
<p key={`${item.subjectId}:${item.sectionId}`} className="font-mono">
{item.subjectCode} | G{item.gradeLevel} {item.sectionName}: {Math.round((item.totalMinutes / 60) * 10) / 10}h
</p>
))
)}
</div>
</div>
</TooltipContent>
</Tooltip>
</div>
</div>
{focusedSubject && (
				<div className="mt-2 flex items-center gap-2 rounded border border-blue-200 bg-blue-50/60 px-3 py-1.5">
					<Info className="size-3.5 shrink-0 text-blue-700" />
					<span className="text-xs text-blue-800">
						Remediation focus: <span className="font-semibold">{focusedSubject.code}</span> - {focusedSubject.name}
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="ml-auto h-6 px-2 text-[0.65rem]"
						onClick={() => {
							const next = new URLSearchParams(searchParams);
							next.delete('subjectId');
							next.delete('subjectCode');
							setSearchParams(next);
							setSubjectSearch('');
						}}
					>
						Clear Focus
					</Button>
				</div>
			)}
			{subjectsLackingFaculty.length > 0 && (
				<div className="mt-2 flex items-center gap-2 rounded border border-red-200 bg-red-50/60 px-3 py-1.5">
					<AlertTriangle className="size-3.5 shrink-0 text-red-600" />
					<span className="shrink-0 text-xs font-semibold text-red-700">{subjectsLackingFaculty.length} lacking faculty:</span>
					<div className="flex flex-1 items-center gap-1 overflow-x-auto">
						{subjectsLackingFaculty.map((s) => (
							<Badge key={s.id} variant="outline" className="shrink-0 border-red-300 bg-white px-1.5 py-0 text-[0.5625rem] text-red-700">{s.code}</Badge>
						))}
					</div>
				</div>
			)}
			<Card className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden shadow-sm">
<div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
<div className="flex items-center gap-3">
<h3 className="text-sm font-semibold text-muted-foreground">Subject Assignments</h3>
{selected.department && <Badge variant="secondary">{selected.department}</Badge>}
{!sectionsAvailable && <Badge variant="outline">Roster unavailable</Badge>}
</div>
<div className="flex items-center gap-2">
<Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo || saving}>
<Undo2 className="mr-1.5 size-3.5" />
Undo
</Button>
<Button type="button" variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo || saving}>
<Redo2 className="mr-1.5 size-3.5" />
Redo
</Button>
<Button type="button" variant="outline" size="sm" onClick={handleResetAssignments} disabled={saving || !selected.isActiveForScheduling || !sectionsAvailable}>
<RotateCcw className="mr-1.5 size-3.5" />
Reset Draft (Selected)
</Button>
{dirty && (
<Button type="button" variant="secondary" size="sm" onClick={discardSelectedDraft} disabled={saving}>
<RotateCcw className="mr-1.5 size-3.5" />
Discard Draft
</Button>
)}
<Button type="button" size="sm" onClick={handleSave} disabled={!dirty || saving || !selected.isActiveForScheduling || !sectionsAvailable}>
<Save className="mr-1.5 size-3.5" />
{saving ? 'Saving...' : 'Save Teaching Load'}
</Button>
</div>
</div>
<div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-2">
				<div className="relative w-52 shrink-0">
					<Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search subjects or sections..."
						value={subjectSearch}
						onChange={(event) => setSubjectSearch(event.target.value)}
						className="h-7 pl-8 text-xs"
					/>
				</div>
				<Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as 'all' | 'unassigned' | 'assigned')}>
					<SelectTrigger className="h-7 w-36 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-xs">All Sections</SelectItem>
						<SelectItem value="unassigned" className="text-xs">Unassigned Only</SelectItem>
						<SelectItem value="assigned" className="text-xs">Assigned Only</SelectItem>
					</SelectContent>
				</Select>
								<Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
									<SelectTrigger className="h-7 w-32 text-xs">
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

			<CardContent className="flex-1 overflow-auto pt-3">
{!selected.isActiveForScheduling && (
<div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
<AlertTriangle className="size-4" />
This faculty member is excluded from scheduling. Enable them first.
</div>
)}

{!sectionsAvailable && (
<div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
<AlertTriangle className="mt-0.5 size-4 shrink-0" />
<div>
<p className="font-medium">Section roster unavailable</p>
<p className="text-[0.75rem]">Teaching-load precision requires an active EnrollPro-backed section roster for the current school year.</p>
</div>
</div>
)}

{(() => {
	const renderTier = (subjects: Subject[], title: string, badge?: string) => {
		if (subjects.length === 0) return null;
		return (
			<div className="mb-4">
				<div className="mb-2 flex items-center gap-2">
					<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
						{badge && <Badge variant="outline" className="text-[0.5rem] bg-emerald-50 text-emerald-700 border-emerald-200">{badge}</Badge>}
				</div>
				<div className="space-y-2">
					{subjects.map((subject) => (
						<SubjectRow
							key={subject.id}
							subject={subject}
							assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
								sections={allKnownSections.filter((sec) => subject.gradeLevels.length === 0 || subject.gradeLevels.includes(sec.displayOrder))}
							disabled={!selected.isActiveForScheduling || !sectionsAvailable}
							selectedFacultyId={selected.id}
							savedOwnershipMap={savedOwnershipMap}
							pendingOwnershipMap={pendingOwnershipMap}
							savedConflictMap={savedConflictMap}
							onSetSections={setSubjectSections}
							facultyDepartment={selected.department}
							facultySpecialization={selected.specialization}
							searchTerm={subjectSearch}
							gradeLevelFilter={gradeLevelFilter}
							sectionFilter={sectionFilter}
							advisedSectionId={homeroomHint?.advisedSectionId ?? null}
							specializationAliases={specializationAliases}
							strictAliasOnly
							remainingCapacityMinutes={remainingCapacityMinutes}
							onHoverLoadMinutes={setHoveredIncomingMinutes}
							onClearHoverLoad={() => setHoveredIncomingMinutes(0)}
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
				specializationQualifiedSubjects,
				'Qualified Based On Specialization',
				selected.specialization ? selected.specialization : selected.department ?? 'Qualified Subjects',
			)}
			{outsideSpecializationSubjects.length > 0 && (
				<div>
					<div className="mb-2 flex items-center gap-2">
						<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outside Specialization</h4>
						<Badge variant="outline" className="text-[0.5625rem] border-amber-300 text-amber-700">
							{selected.canTeachOutsideDepartment ? 'Assignable (Override Enabled)' : 'Not Assignable'}
						</Badge>
					</div>
					<div className={`space-y-2 ${selected.canTeachOutsideDepartment ? '' : 'opacity-70'}`}>
						{outsideSpecializationSubjects.map((subject) => (
							<SubjectRow
								key={subject.id}
								subject={subject}
								assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
								sections={allKnownSections.filter((sec) => subject.gradeLevels.length === 0 || subject.gradeLevels.includes(sec.displayOrder))}
								disabled={!selected.canTeachOutsideDepartment || !selected.isActiveForScheduling || !sectionsAvailable}
								selectedFacultyId={selected.id}
								savedOwnershipMap={savedOwnershipMap}
								pendingOwnershipMap={pendingOwnershipMap}
								savedConflictMap={savedConflictMap}
								onSetSections={setSubjectSections}
								isOutsideDepartment
								facultyDepartment={selected.department}
								facultySpecialization={selected.specialization}
								searchTerm={subjectSearch}
								gradeLevelFilter={gradeLevelFilter}
								sectionFilter={sectionFilter}
								advisedSectionId={homeroomHint?.advisedSectionId ?? null}
								specializationAliases={specializationAliases}
								strictAliasOnly
								remainingCapacityMinutes={remainingCapacityMinutes}
								onHoverLoadMinutes={setHoveredIncomingMinutes}
								onClearHoverLoad={() => setHoveredIncomingMinutes(0)}
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
		: 'This will assign teachers to currently unassigned subject-sections using specialization aliases and current teaching load. Existing manual assignments will not be overwritten.'}
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
				disabled={resetLoading || resetConfirmText.trim().toUpperCase() !== 'RESET'}
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
