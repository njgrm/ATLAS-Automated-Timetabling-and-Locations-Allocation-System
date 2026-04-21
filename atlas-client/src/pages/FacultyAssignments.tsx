import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
AlertTriangle,
CheckCircle2,
ChevronDown,
ChevronRight,
Info,
Pencil,
RotateCcw,
Save,
Search,
ShieldAlert,
Star,
UserCog,
} from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import {
buildAssignmentSignature,
buildOwnershipMap,
buildPendingOwnershipMap,
buildSectionMap,
buildTeachingLoadProfile,
CLASS_ADVISER_EQUIVALENT_HOURS,
normalizeDraftAssignments,
type FacultyAssignmentDraft,
type FacultyOwnershipState,
type LoadStatus,
} from '@/lib/faculty-assignment-helpers';
import { gradeLabel, matchesFacultyDepartment, GRADE_COLORS } from '@/lib/grade-labels';
import { fetchPublicSettings } from '@/lib/settings';
import type { ExternalSection, HomeroomHintResponse, SectionSummaryResponse, Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Checkbox } from '@/ui/checkbox';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

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
firstName: string;
lastName: string;
department: string | null;
employmentStatus: string;
isActiveForScheduling: boolean;
isClassAdviser: boolean;
advisoryEquivalentHours: number;
canTeachOutsideDepartment: boolean;
maxHoursPerWeek: number;
version: number;
subjectCount: number;
sectionCount: number;
subjectHours: number;
assignments: FacultyAssignmentRecord[];
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

function getOwnershipKey(subjectId: number, sectionId: number): string {
return `${subjectId}:${sectionId}`;
}

function buildPendingEntries(
pendingOwnershipMap: Record<string, FacultyOwnershipState>,
subjects: Subject[],
sectionMap: Map<number, ExternalSection>,
) {
const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
return Object.entries(pendingOwnershipMap)
.map(([key, ownership]) => {
const [subjectIdRaw, sectionIdRaw] = key.split(':');
const subjectId = Number(subjectIdRaw);
const sectionId = Number(sectionIdRaw);
const subject = subjectMap.get(subjectId);
const section = sectionMap.get(sectionId);
if (!subject || !section) {
return null;
}
return {
key,
facultyId: ownership.facultyId,
facultyName: ownership.facultyName,
subjectCode: subject.code,
subjectName: subject.name,
sectionName: section.name,
gradeLevel: section.displayOrder,
};
})
.filter((entry): entry is NonNullable<typeof entry> => entry != null)
.sort((left, right) =>
left.facultyName.localeCompare(right.facultyName)
|| left.gradeLevel - right.gradeLevel
|| left.sectionName.localeCompare(right.sectionName)
|| left.subjectCode.localeCompare(right.subjectCode),
);
}

export default function FacultyAssignments() {
const [searchParams] = useSearchParams();
const [faculty, setFaculty] = useState<FacultySummary[]>([]);
const [subjects, setSubjects] = useState<Subject[]>([]);
const [sectionSummary, setSectionSummary] = useState<SectionSummaryResponse | null>(null);
const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [selectedId, setSelectedId] = useState<number | null>(() => {
const queryValue = searchParams.get('facultyId');
return queryValue ? Number(queryValue) : null;
});
const [searchQuery, setSearchQuery] = useState('');
const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned'>('all');
const [departmentFilter, setDepartmentFilter] = useState<string>('all');
const [subjectSearch, setSubjectSearch] = useState('');
	const [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
	const [gradeLevelFilter, setGradeLevelFilter] = useState<string>('all');
const [allowOutsideDepartment, setAllowOutsideDepartment] = useState(false);
const [error, setError] = useState<string | null>(null);
const [homeroomHint, setHomeroomHint] = useState<HomeroomHintResponse | null>(null);
const [draftAssignmentsByFaculty, setDraftAssignmentsByFaculty] = useState<Record<number, FacultyAssignmentDraft[]>>({});

const fetchData = useCallback(async () => {
setLoading(true);
try {
const settings = await fetchPublicSettings();
const schoolYearId = settings.activeSchoolYearId;
if (!schoolYearId) {
throw new Error('Active school year is not configured.');
}

const [facultyRes, subjectsRes, sectionsRes] = await Promise.all([
atlasApi.get<{ faculty: FacultySummary[] }>('/faculty-assignments/summary', {
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
setSubjects(subjectsRes.data.subjects.filter((subject) => subject.isActive));
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

const facultyNames = useMemo(
() => Object.fromEntries(faculty.map((member) => [member.id, `${member.lastName}, ${member.firstName}`])),
[faculty],
);

const savedOwnershipMap = useMemo(
() => buildOwnershipMap(savedAssignmentsByFaculty, facultyNames, 'saved'),
[facultyNames, savedAssignmentsByFaculty],
);

const pendingOwnershipMap = useMemo(
() => buildPendingOwnershipMap(savedAssignmentsByFaculty, effectiveDraftAssignmentsByFaculty, facultyNames),
[effectiveDraftAssignmentsByFaculty, facultyNames, savedAssignmentsByFaculty],
);

const pendingEntries = useMemo(
() => buildPendingEntries(pendingOwnershipMap, subjects, sectionMap),
[pendingOwnershipMap, sectionMap, subjects],
);

const selected = useMemo(
() => faculty.find((member) => member.id === selectedId) ?? null,
[faculty, selectedId],
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
[sectionMap, selected, savedAssignmentsByFaculty],
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
setDraftAssignmentsByFaculty((previousDrafts) => {
const nextDrafts = { ...previousDrafts };
delete nextDrafts[selected.id];
return nextDrafts;
});
}, [selected]);

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
return nextFaculty;
}, [departmentFilter, effectiveAssignmentsByFaculty, faculty, filterStatus, searchQuery]);

const subjectsLackingFaculty = useMemo(() => {
const assignedSubjectIds = new Set<number>();
for (const assignments of Object.values(effectiveAssignmentsByFaculty)) {
for (const assignment of assignments) {
assignedSubjectIds.add(assignment.subjectId);
}
}
return subjects.filter((subject) => subject.isActive && !assignedSubjectIds.has(subject.id));
}, [effectiveAssignmentsByFaculty, subjects]);

const { primarySubjects, otherSubjects } = useMemo(() => {
const department = selected?.department ?? null;
const primary: Subject[] = [];
const other: Subject[] = [];
for (const subject of subjects) {
if (matchesFacultyDepartment(department, subject.code, subject.name)) {
primary.push(subject);
} else {
other.push(subject);
}
}
return { primarySubjects: primary, otherSubjects: other };
}, [selected, subjects]);

const filterBySubjectSearch = useCallback(
(subjectList: Subject[]) => {
if (!subjectSearch.trim()) {
return subjectList;
}
const normalizedQuery = subjectSearch.toLowerCase();
return subjectList.filter(
(subject) => subject.name.toLowerCase().includes(normalizedQuery) || subject.code.toLowerCase().includes(normalizedQuery),
);
},
[subjectSearch],
);

const loadProfile = useMemo(
() =>
buildTeachingLoadProfile(
currentAssignments,
subjects,
sectionMap,
selected?.isClassAdviser
? selected.advisoryEquivalentHours || CLASS_ADVISER_EQUIVALENT_HOURS
: 0,
),
[currentAssignments, sectionMap, selected, subjects],
);

const departmentOptions = useMemo(
() => Array.from(new Set(faculty.map((member) => member.department).filter(Boolean) as string[])).sort(),
[faculty],
);

const assignedFacultyCount = faculty.filter((member) => (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) > 0).length;
const activeDraftCount = Object.keys(effectiveDraftAssignmentsByFaculty).length;
const sectionsAvailable = Boolean(sectionSummary && sectionSummary.sections.length > 0);

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

<div className="mt-4 flex min-h-0 flex-1 gap-4 pb-3">
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
{departmentOptions.length > 0 && (
<Select value={departmentFilter} onValueChange={setDepartmentFilter}>
<SelectTrigger className="mt-2 h-7 w-full text-[0.6875rem]">
<SelectValue placeholder="All Departments" />
</SelectTrigger>
<SelectContent>
<SelectItem value="all">All Departments</SelectItem>
{departmentOptions.map((department) => (
<SelectItem key={department} value={department}>
{department}
</SelectItem>
))}
</SelectContent>
</Select>
)}
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
filteredFaculty.map((member) => {
const effectiveSubjectCount = effectiveAssignmentsByFaculty[member.id]?.length ?? 0;
const hasDraft = Boolean(effectiveDraftAssignmentsByFaculty[member.id]);
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
<div className="min-w-0 flex-1">
<p className="truncate flex items-center gap-1.5 text-sm font-medium">
{member.isClassAdviser && <Star className="size-3 shrink-0 flex-none fill-amber-400 text-amber-400" aria-label="Class Adviser" />}
{member.lastName}, {member.firstName}
</p>
<p className="truncate text-[0.6875rem] text-muted-foreground">
{member.department ?? 'No department'} | {effectiveSubjectCount} subj / {member.sectionCount} sec
</p>
</div>
<div className="flex items-center gap-1.5">
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
})
)}
</div>

<div className="border-t border-border px-3 py-2 text-[0.6875rem] text-muted-foreground">
{assignedFacultyCount} / {faculty.length} assigned | {activeDraftCount} draft{activeDraftCount === 1 ? '' : 's'}
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
<p className="truncate text-[0.6875rem] text-muted-foreground">
{selected.department ?? 'No department'} | ID: {selected.externalId}
</p>
</div>
{selected.isClassAdviser && (
<Badge variant="outline" className="border-amber-200 bg-amber-50 text-[0.5625rem] text-amber-700">
<Star className="mr-1 size-2.5 fill-amber-500 text-amber-500" /> Class Adviser
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
<Badge className={`${STATUS_COLORS[loadProfile.status].bg} ${STATUS_COLORS[loadProfile.status].text} ${STATUS_COLORS[loadProfile.status].border}`}>
{loadProfile.statusLabel}
</Badge>
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
{loadProfile.equivalentHours > 0 && <p>Adviser equivalent: +{loadProfile.equivalentHours}h</p>}
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
				<Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
					<SelectTrigger className="h-7 w-28 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-xs">All Grades</SelectItem>
						<SelectItem value="7" className="text-xs">Grade 7</SelectItem>
						<SelectItem value="8" className="text-xs">Grade 8</SelectItem>
						<SelectItem value="9" className="text-xs">Grade 9</SelectItem>
						<SelectItem value="10" className="text-xs">Grade 10</SelectItem>
					</SelectContent>
				</Select>
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
				<div className="ml-auto flex items-center gap-2">
					<ShieldAlert className={`size-3.5 ${allowOutsideDepartment ? 'text-amber-600' : 'text-muted-foreground'}`} />
					<span className="text-[0.625rem] text-muted-foreground">Outside dept.</span>
					<Switch
						checked={allowOutsideDepartment}
						onCheckedChange={setAllowOutsideDepartment}
						aria-label="Allow outside department assignments"
					/>
				</div>
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

{homeroomHint?.hasAdviserMapping && (
<div className="mb-3 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
<Info className="mt-0.5 size-4 shrink-0" />
<div className="min-w-0">
<p className="font-medium">Adviser Mapping: {homeroomHint.advisedSectionName}</p>
<p className="text-[0.75rem] leading-snug text-sky-700">
{homeroomHint.homeroomHint}. Prioritize Homeroom Guidance and adviser-facing load review for this section.
</p>
</div>
</div>
)}

{(() => {
const filteredPrimarySubjects = filterBySubjectSearch(primarySubjects);
if (filteredPrimarySubjects.length === 0) {
return null;
}
return (
<div className="mb-4">
<h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qualified by Department</h4>
<div className="space-y-2">
{filteredPrimarySubjects.map((subject) => (
<SubjectRow
key={subject.id}
subject={subject}
assignment={currentAssignments.find((assignment) => assignment.subjectId === subject.id)}
sections={allKnownSections.filter((section) => subject.gradeLevels.includes(section.displayOrder))}
disabled={!selected.isActiveForScheduling || !sectionsAvailable}
selectedFacultyId={selected.id}
savedOwnershipMap={savedOwnershipMap}
pendingOwnershipMap={pendingOwnershipMap}
onSetSections={setSubjectSections}
											searchTerm={subjectSearch}
											sectionFilter={sectionFilter}
/>
))}
</div>
</div>
);
})()}

{(() => {
const filteredOtherSubjects = filterBySubjectSearch(otherSubjects);
if (filteredOtherSubjects.length === 0) {
return null;
}
return (
<div>
<div className="mb-2 flex items-center gap-2">
<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outside Department (Emergency)</h4>
{!allowOutsideDepartment && <Badge variant="secondary" className="text-[0.5625rem]">Disabled</Badge>}
</div>
<div className={`space-y-2 ${allowOutsideDepartment ? '' : 'opacity-60'}`}>
{filteredOtherSubjects.map((subject) => (
<SubjectRow
key={subject.id}
subject={subject}
assignment={currentAssignments.find((assignment) => assignment.subjectId === subject.id)}
sections={allKnownSections.filter((section) => subject.gradeLevels.includes(section.displayOrder))}
disabled={!selected.isActiveForScheduling || !sectionsAvailable || !allowOutsideDepartment}
selectedFacultyId={selected.id}
savedOwnershipMap={savedOwnershipMap}
pendingOwnershipMap={pendingOwnershipMap}
onSetSections={setSubjectSections}
											searchTerm={subjectSearch}
											sectionFilter={sectionFilter}
isOutsideDepartment
/>
))}
</div>
</div>
);
})()}
</CardContent>
</Card>
</div>
)}
</div>
</div>
</div>
</TooltipProvider>
);
}

type SubjectRowProps = {
	subject: Subject;
	assignment?: FacultyAssignmentDraft;
	sections: ExternalSection[];
	disabled: boolean;
	selectedFacultyId: number;
	savedOwnershipMap: Record<string, FacultyOwnershipState>;
	pendingOwnershipMap: Record<string, FacultyOwnershipState>;
	onSetSections: (subjectId: number, sectionIds: number[]) => void;
	isOutsideDepartment?: boolean;
	searchTerm?: string;
	sectionFilter?: 'all' | 'unassigned' | 'assigned';
	gradeLevelFilter?: string;
	advisedSectionId?: number | null;
};

function SubjectRow({
	subject,
	assignment,
	sections,
	disabled,
	selectedFacultyId,
	savedOwnershipMap,
	pendingOwnershipMap,
	onSetSections,
	isOutsideDepartment,
	searchTerm = '',
	sectionFilter = 'all',
	gradeLevelFilter = 'all',
	advisedSectionId = null,
}: SubjectRowProps) {
	const [openGrades, setOpenGrades] = useState<Record<number, boolean>>({});

	// Compute filtered sections locally based on global searchTerm and sectionFilter
	const displaySections = useMemo(() => {
		let result = sections;
		
		if (sectionFilter !== 'all') {
			result = result.filter(sec => {
				const key = getOwnershipKey(subject.id, sec.id);
				const isAssigned = Boolean(savedOwnershipMap[key]) || Boolean(pendingOwnershipMap[key]);
				return sectionFilter === 'assigned' ? isAssigned : !isAssigned;
			});
		}

		if (gradeLevelFilter !== 'all') {
			result = result.filter(sec => String(sec.displayOrder) === gradeLevelFilter);
		}

		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			if (subject.name.toLowerCase().includes(term) || subject.code.toLowerCase().includes(term)) {
				// subject matches
			} else {
				// strict filter sections
				result = result.filter(sec => sec.name.toLowerCase().includes(term) || `g${sec.displayOrder}`.includes(term));
			}
		}

		return result;
	}, [sections, sectionFilter, gradeLevelFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);

	const groupedSections = useMemo(() => {
		const sectionGroups = new Map<number, ExternalSection[]>();
for (const section of displaySections) {
const nextSections = sectionGroups.get(section.displayOrder) ?? [];
nextSections.push(section);
sectionGroups.set(section.displayOrder, nextSections);
}
return Array.from(sectionGroups.entries())
.sort(([leftGrade], [rightGrade]) => leftGrade - rightGrade)
.map(([gradeLevel, gradeSections]) => ({
gradeLevel,
sections: [...gradeSections].sort((left, right) => left.name.localeCompare(right.name) || left.id - right.id),
}));
}, [displaySections]);
const selectedSectionIds = new Set(assignment?.sectionIds ?? []);
const selectedCount = selectedSectionIds.size;

const selectableSectionIds = sections
.filter((section) => {
if (selectedSectionIds.has(section.id)) {
return true;
}
const key = getOwnershipKey(subject.id, section.id);
const pendingOwner = pendingOwnershipMap[key];
if (pendingOwner && pendingOwner.facultyId !== selectedFacultyId) {
return false;
}
const savedOwner = savedOwnershipMap[key];
if (savedOwner && savedOwner.facultyId !== selectedFacultyId) {
return false;
}
return true;
})
.map((section) => section.id);

const blockedCount = sections.length - selectableSectionIds.length;

const handleToggleAll = () => {
if (selectedCount > 0) {
onSetSections(subject.id, []);
return;
}
if (selectableSectionIds.length === 0) {
toast.error('All eligible sections for this subject are already owned by another teacher.');
return;
}
if (selectableSectionIds.length < sections.length) {
toast.warning('Sections already owned by another teacher were skipped.');
}
onSetSections(subject.id, selectableSectionIds);
};

const toggleSection = (sectionId: number) => {
if (selectedSectionIds.has(sectionId)) {
onSetSections(
subject.id,
Array.from(selectedSectionIds).filter((value) => value !== sectionId),
);
return;
}
const key = getOwnershipKey(subject.id, sectionId);
const pendingOwner = pendingOwnershipMap[key];
if (pendingOwner && pendingOwner.facultyId !== selectedFacultyId) {
toast.error(`Pending session conflict: ${pendingOwner.facultyName} already selected this subject-section pair.`);
return;
}
const savedOwner = savedOwnershipMap[key];
if (savedOwner && savedOwner.facultyId !== selectedFacultyId) {
toast.error(`Saved ownership conflict: ${savedOwner.facultyName} already owns this subject-section pair.`);
return;
}
onSetSections(subject.id, [...selectedSectionIds, sectionId]);
};

return (
<div
			className={`rounded-lg border p-3 transition-colors ${
				selectedCount > 0 && isOutsideDepartment
					? 'border-amber-300/60 bg-amber-50/30'
					: 'border-border'
			}`}
		>
			<div className="flex items-start gap-3">
				<Checkbox checked={selectedCount > 0} onCheckedChange={handleToggleAll} disabled={disabled || sections.length === 0} />
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-sm font-medium">{subject.name === 'Technology and Livelihood Education' ? 'TLE' : subject.name}</span>
						<code className="rounded bg-muted px-1 py-0.5 text-[0.6rem] font-mono">{subject.code}</code>
						{isOutsideDepartment && <Badge variant="outline" className="border-amber-300 text-[0.5625rem] text-amber-700">Outside Dept.</Badge>}
						<Badge variant="secondary" className="text-[0.5625rem]">{selectedCount} / {sections.length || 0} sections</Badge>
						{blockedCount > 0 && <Badge variant="outline" className="border-red-200 text-[0.5625rem] text-red-700">{blockedCount} blocked</Badge>}
					</div>
					<p className="mt-1 text-[0.6875rem] text-muted-foreground">
						{Math.round((subject.minMinutesPerWeek / 60) * 10) / 10} hrs/week per section
					</p>
				</div>
			</div>

			{sections.length === 0 ? (
				<p className="ml-7 mt-3 text-[0.6875rem] text-muted-foreground">No active sections in the current school year for {subject.code}.</p>
			) : (
				<div className="ml-7 mt-3 space-y-2">
					{groupedSections.map(({ gradeLevel, sections: gradeSections }) => {
						const isOpen = openGrades[gradeLevel] ?? (searchTerm ? true : false);
						const selectedInGrade = gradeSections.filter((section) => selectedSectionIds.has(section.id)).length;
						return (
							<div key={gradeLevel} className={`overflow-hidden rounded-md border ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("/80", "/20").replace(" text-", " ") : "border-border/70 bg-background"}`}>
								<Button
									type="button"
									variant="ghost"
									onClick={() => setOpenGrades((current) => ({ ...current, [gradeLevel]: !(current[gradeLevel] ?? (searchTerm ? true : false)) }))}
									className={`h-auto w-full justify-between rounded-none px-3 py-2 ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("/80", "/10") : "bg-transparent"}`}
								>
									<span className="flex items-center gap-2 text-sm font-medium">
										{isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
										{gradeLabel(gradeLevel)}
									</span>
									<Badge variant="secondary" className="text-[0.5625rem]">{selectedInGrade} / {gradeSections.length}</Badge>
								</Button>
								{isOpen && (
									<div className="grid grid-cols-2 gap-1.5 border-t border-border/70 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
										{gradeSections.map((section) => {
											const key = getOwnershipKey(subject.id, section.id);
											const savedOwner = savedOwnershipMap[key];
											const pendingOwner = pendingOwnershipMap[key];
											const isSelected = selectedSectionIds.has(section.id);
											const isPendingCurrent = pendingOwner?.facultyId === selectedFacultyId;
											const isSavedCurrent = savedOwner?.facultyId === selectedFacultyId;
											const isPendingOther = Boolean(pendingOwner && pendingOwner.facultyId !== selectedFacultyId);
											const isSavedOther = Boolean(savedOwner && savedOwner.facultyId !== selectedFacultyId);
											const blocked = !isSelected && (isPendingOther || isSavedOther);
											const badgeProps = isPendingOther
												? { text: pendingOwner?.facultyName, mode: 'pending' }
												: isSavedOther
												? { text: savedOwner?.facultyName, mode: 'saved' }
												: isPendingCurrent
												? { text: 'Pending Request', mode: 'pending' }
												: isSavedCurrent
												? { text: 'Saved', mode: 'saved' }
												: null;
											
											const gradeTint = section.displayOrder === 7 ? 'bg-green-50/70 hover:bg-green-100/50' : section.displayOrder === 8 ? 'bg-yellow-50/70 hover:bg-yellow-100/50' : section.displayOrder === 9 ? 'bg-red-50/70 hover:bg-red-100/50' : section.displayOrder === 10 ? 'bg-blue-50/70 hover:bg-blue-100/50' : 'bg-muted/30 hover:bg-muted/50';
											const borderState = blocked ? 'cursor-not-allowed border-red-300 opacity-70' : isSelected ? 'border-primary ring-1 ring-primary/40 text-primary-foreground' : 'border-border/60 hover:border-foreground/20';

											return (
												<div
													key={section.id}
													className={`flex flex-col gap-1.5 rounded-md border p-2 transition-colors ${gradeTint} ${borderState}`}
												>
													<div className="flex items-start gap-1.5">
														<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} className={`mt-0.5 shrink-0 ${isSelected ? '' : 'bg-white'}`} />
														<div className="min-w-0 flex-1 flex flex-col gap-0.5">
															<div className="min-w-0">
																<p className="text-[0.6875rem] font-semibold leading-tight break-words flex items-center gap-1.5">
																	{advisedSectionId === section.id && (
																		<Star className="size-3.5 fill-amber-500 text-amber-500 shrink-0" aria-label="Adviser" />
																	)}
																	{section.name}
																</p>
																{section.programCode && section.programCode !== 'REGULAR' && (
																	<p className="text-[0.5625rem] text-muted-foreground break-words mt-[2px]">{section.programCode}</p>
																)}
															</div>
															
															{badgeProps && (
																<div className="flex flex-wrap items-center gap-1 mt-0.5">
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<Badge
																				variant="outline"
																				className={`px-1.5 py-0.5 text-[0.6875rem] font-medium tracking-tight leading-tight flex items-center gap-1.5 max-w-full truncate shadow-sm ${
																					badgeProps.mode === 'pending'
																						? 'border-amber-300 bg-amber-50 text-amber-800 ring-1 ring-amber-400/20'
																						: 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-400/20'
																				}`}
																			>
																				{badgeProps.mode === 'pending' ? <Pencil className="size-3 shrink-0" /> : <CheckCircle2 className="size-3 shrink-0" />}
																				<span className="truncate">{badgeProps.text}</span>
																			</Badge>
																		</TooltipTrigger>
																		<TooltipContent side="top" className="max-w-xs text-xs">
																			{isPendingOther && <p>{pendingOwner?.facultyName} has this subject-section pair in an unsaved session draft.</p>}
																			{isSavedOther && <p>{savedOwner?.facultyName} already owns this subject-section pair in saved data.</p>}
																			{isPendingCurrent && <p>This selection is pending in the current session and has not been saved yet.</p>}
																			{isSavedCurrent && !isPendingCurrent && <p>This subject-section pair is already saved for the selected teacher.</p>}
																		</TooltipContent>
																	</Tooltip>
																</div>
															)}
														</div>
													</div>
												</div>
											);
										})}
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
);
}
