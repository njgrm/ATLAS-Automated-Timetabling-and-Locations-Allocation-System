import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	BookOpen,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Map,
	Pencil,
	Plus,
	Search,
	Trash2,
	Users,
	X,
} from 'lucide-react';

import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { gradeLabel, GRADE_COLORS } from '@/lib/grade-labels';
import type { RoomType, SessionPattern, Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50];

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
	CLASSROOM: 'Classroom',
	LABORATORY: 'Science Laboratory',
	COMPUTER_LAB: 'ICT / Computer Lab',
	TLE_WORKSHOP: 'TLE Workshop',
	LIBRARY: 'Library',
	GYMNASIUM: 'Gymnasium',
	FACULTY_ROOM: 'Faculty Room',
	OFFICE: 'Office',
	OTHER: 'Other',
};

const ALL_ROOM_TYPES = Object.keys(ROOM_TYPE_LABELS) as RoomType[];
const GRADE_OPTIONS = [7, 8, 9, 10];

const SESSION_PATTERN_LABELS: Record<SessionPattern, string> = {
	ANY: 'Any Day',
	MWF: 'Mon / Wed / Fri',
	TTH: 'Tue / Thu',
};

const SESSION_PATTERN_BADGE: Record<SessionPattern, string> = {
	ANY: 'bg-gray-100 text-gray-600 border-gray-300',
	MWF: 'bg-indigo-50 text-indigo-700 border-indigo-200',
	TTH: 'bg-amber-50 text-amber-700 border-amber-200',
};

type SortField = 'code' | 'name' | 'minMinutesPerWeek' | 'preferredRoomType' | 'gradeLevels';
type SortDir = 'asc' | 'desc';

type EditState = {
	id: number;
	name: string;
	minMinutesPerWeek: number;
	sessionPattern: SessionPattern;
	gradeLevels: number[];
	interSectionEnabled: boolean;
	interSectionGradeLevels: number[];
};

type NewSubjectForm = {
	code: string;
	name: string;
	minMinutesPerWeek: number;
	preferredRoomType: RoomType;
	sessionPattern: SessionPattern;
	gradeLevels: number[];
	interSectionEnabled: boolean;
	interSectionGradeLevels: number[];
};

const emptyForm: NewSubjectForm = {
	code: '',
	name: '',
	minMinutesPerWeek: 45,
	preferredRoomType: 'CLASSROOM',
	sessionPattern: 'ANY',
	gradeLevels: [7, 8, 9, 10],
	interSectionEnabled: false,
	interSectionGradeLevels: [],
};

export default function Subjects() {
	const [subjects, setSubjects] = useState<Subject[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [editState, setEditState] = useState<EditState | null>(null);
	const [showAdd, setShowAdd] = useState(false);
	const [newSubject, setNewSubject] = useState<NewSubjectForm>(emptyForm);
	const [saving, setSaving] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
	const [timeMode, setTimeMode] = useState<'minutes' | 'hours'>('minutes');

	// Teacher coverage drilldown
	const [expandedSubjectId, setExpandedSubjectId] = useState<number | null>(null);
	const [teacherCoverage, setTeacherCoverage] = useState<Record<number, { name: string; grades: number[] }[]>>({});
	const [coverageLoading, setCoverageLoading] = useState(false);

	// Sorting
	const [sortField, setSortField] = useState<SortField>('code');
	const [sortDir, setSortDir] = useState<SortDir>('asc');

	// Pagination
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	// Filters
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
	const [roomTypeFilter, setRoomTypeFilter] = useState<RoomType | 'all'>('all');
	const [gradeLevelFilter, setGradeLevelFilter] = useState<number | 'all'>('all');

	const fetchSubjects = useCallback(async () => {
		setLoading(true);
		try {
			await atlasApi.post('/subjects/seed', { schoolId: DEFAULT_SCHOOL_ID });
			const { data } = await atlasApi.get<{ subjects: Subject[] }>('/subjects', {
				params: { schoolId: DEFAULT_SCHOOL_ID },
			});
			setSubjects(data.subjects);
			setError(null);
		} catch {
			setError('Failed to load subjects.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchSubjects();
	}, [fetchSubjects]);

	const toggleTeacherCoverage = useCallback(async (subjectId: number) => {
		if (expandedSubjectId === subjectId) {
			setExpandedSubjectId(null);
			return;
		}
		setExpandedSubjectId(subjectId);
		if (teacherCoverage[subjectId]) return; // already fetched
		setCoverageLoading(true);
		try {
			const { data } = await atlasApi.get<{ summary: { faculty: { id: number; firstName: string; lastName: string; gradeLevels: number[] }[] } }>('/faculty-assignments/summary', {
				params: { schoolId: DEFAULT_SCHOOL_ID },
			});
			// Build coverage: for each subject, find all faculty assigned to it
			const coverageMap: Record<number, { name: string; grades: number[] }[]> = {};
			for (const f of data.summary.faculty ?? []) {
				for (const a of (f as any).subjects ?? []) {
					const sid = a.subjectId as number;
					if (!coverageMap[sid]) coverageMap[sid] = [];
					coverageMap[sid].push({ name: `${f.lastName}, ${f.firstName}`, grades: a.gradeLevels ?? [] });
				}
			}
			setTeacherCoverage((prev) => ({ ...prev, ...coverageMap }));
		} catch {
			toast.error('Failed to load teacher coverage');
		} finally {
			setCoverageLoading(false);
		}
	}, [expandedSubjectId, teacherCoverage]);

	// Filtered, sorted, paginated
	const { paged, totalFiltered, totalPages } = useMemo(() => {
		let list = subjects;

		// Search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
			);
		}

		// Status filter
		if (statusFilter === 'active') list = list.filter((s) => s.isActive);
		else if (statusFilter === 'inactive') list = list.filter((s) => !s.isActive);

		// Room type filter
		if (roomTypeFilter !== 'all') list = list.filter((s) => s.preferredRoomType === roomTypeFilter);

		// Grade level filter
		if (gradeLevelFilter !== 'all') list = list.filter((s) => s.gradeLevels.includes(gradeLevelFilter));

		// Sort
		const sorted = [...list].sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case 'code': cmp = a.code.localeCompare(b.code); break;
				case 'name': cmp = a.name.localeCompare(b.name); break;
				case 'minMinutesPerWeek': cmp = a.minMinutesPerWeek - b.minMinutesPerWeek; break;
				case 'preferredRoomType': cmp = a.preferredRoomType.localeCompare(b.preferredRoomType); break;
				case 'gradeLevels': cmp = a.gradeLevels.length - b.gradeLevels.length; break;
			}
			return sortDir === 'desc' ? -cmp : cmp;
		});

		const tf = sorted.length;
		const tp = Math.max(1, Math.ceil(tf / pageSize));
		const start = (page - 1) * pageSize;
		return { paged: sorted.slice(start, start + pageSize), totalFiltered: tf, totalPages: tp };
	}, [subjects, searchQuery, statusFilter, roomTypeFilter, gradeLevelFilter, sortField, sortDir, page, pageSize]);

	// Reset page when filters change
	useEffect(() => { setPage(1); }, [searchQuery, statusFilter, roomTypeFilter, gradeLevelFilter, pageSize]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortField(field);
			setSortDir('asc');
		}
	};

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) return <ArrowUpDown className="size-3 text-muted-foreground/50" />;
		return sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
	};

	const handleEditSave = async () => {
		if (!editState) return;
		setSaving(true);
		try {
				await atlasApi.patch(`/subjects/${editState.id}`, {
				name: editState.name,
				minMinutesPerWeek: editState.minMinutesPerWeek,
				sessionPattern: editState.sessionPattern,
				gradeLevels: editState.gradeLevels,
				interSectionEnabled: editState.interSectionEnabled,
				interSectionGradeLevels: editState.interSectionGradeLevels,
			});
			setEditState(null);
			toast.success('Subject updated successfully.');
			await fetchSubjects();
		} catch {
			toast.error('Failed to save changes.');
		} finally {
			setSaving(false);
		}
	};

	const handleCreate = async () => {
		if (!newSubject.code.trim() || !newSubject.name.trim()) return;
		setSaving(true);
		try {
			await atlasApi.post('/subjects', {
				schoolId: DEFAULT_SCHOOL_ID,
				...newSubject,
			});
			setShowAdd(false);
			setNewSubject(emptyForm);
			toast.success('Subject created successfully.');
			await fetchSubjects();
		} catch (err: any) {
			const msg = err?.response?.data?.message ?? 'Failed to create subject.';
			toast.error(msg);
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id: number) => {
		try {
			await atlasApi.delete(`/subjects/${id}`);
			setDeleteTarget(null);
			toast.success('Subject deleted.');
			await fetchSubjects();
		} catch (err: any) {
			const msg = err?.response?.data?.message ?? 'Failed to delete subject.';
			toast.error(msg);
		}
	};

	const toggleGradeLevel = (grade: number) => {
		setNewSubject((prev) => ({
			...prev,
			gradeLevels: prev.gradeLevels.includes(grade)
				? prev.gradeLevels.filter((g) => g !== grade)
				: [...prev.gradeLevels, grade].sort(),
		}));
	};

	const toggleEditGrade = (grade: number) => {
		setEditState((prev) => {
			if (!prev) return prev;
			const has = prev.gradeLevels.includes(grade);
			const newGrades = has
				? prev.gradeLevels.filter((g) => g !== grade)
				: [...prev.gradeLevels, grade].sort();
			if (newGrades.length === 0) return prev;
			return { ...prev, gradeLevels: newGrades };
		});
	};

	const hasActiveFilters = statusFilter !== 'all' || roomTypeFilter !== 'all' || gradeLevelFilter !== 'all';

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)]">
			{/* Compact toolbar */}
			<div className="shrink-0 px-6 pt-3 pb-2">
				<div className="flex items-center gap-2">
					<div className="relative flex-1 max-w-sm">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
						<Input
							placeholder="Search subjects..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 h-8 text-sm"
						/>
					</div>
					<Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
						<SelectTrigger className="h-8 w-[120px] text-xs">
							<SelectValue placeholder="All Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="inactive">Inactive</SelectItem>
						</SelectContent>
					</Select>
					<Select value={roomTypeFilter} onValueChange={(v) => setRoomTypeFilter(v as typeof roomTypeFilter)}>
						<SelectTrigger className="h-8 w-[150px] text-xs">
							<SelectValue placeholder="All Room Types" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Room Types</SelectItem>
							{ALL_ROOM_TYPES.map((t) => (
								<SelectItem key={t} value={t}>{ROOM_TYPE_LABELS[t]}</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={String(gradeLevelFilter)} onValueChange={(v) => setGradeLevelFilter(v === 'all' ? 'all' : Number(v))}>
						<SelectTrigger className="h-8 w-[110px] text-xs">
							<SelectValue placeholder="All Grades" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Grades</SelectItem>
							{GRADE_OPTIONS.map((g) => (
								<SelectItem key={g} value={String(g)}>G{g}</SelectItem>
							))}
						</SelectContent>
					</Select>
					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							className="h-8 px-2 text-xs"
							onClick={() => { setStatusFilter('all'); setRoomTypeFilter('all'); setGradeLevelFilter('all'); }}
						>
							<X className="size-3 mr-1" /> Clear
						</Button>
					)}
					<div className="flex-1" />
					<Button onClick={() => setShowAdd(true)} disabled={showAdd} size="sm" className="h-8">
						<Plus className="mr-1 size-3.5" /> Add Subject
					</Button>
				</div>
			</div>

			{error && (
				<div className="shrink-0 mx-6 mb-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
					{error}
					<button className="ml-2 font-semibold" onClick={() => setError(null)}>Dismiss</button>
				</div>
			)}

			{/* Add subject form */}
			{showAdd && (
				<div className="shrink-0 px-6 pb-2">
					<Card className="shadow-sm border-primary/30">
						<CardContent className="pt-4">
							<p className="text-sm font-semibold mb-3">New Custom Subject</p>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
								<div>
									<label className="text-xs font-medium text-muted-foreground">Code</label>
									<Input
										placeholder="e.g. ELEC1"
										value={newSubject.code}
										onChange={(e) => setNewSubject((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
									/>
								</div>
								<div>
									<label className="text-xs font-medium text-muted-foreground">Name</label>
									<Input
										placeholder="Subject name"
										value={newSubject.name}
										onChange={(e) => setNewSubject((p) => ({ ...p, name: e.target.value }))}
									/>
								</div>
								<div>
									<div className="flex justify-between items-center mb-1">
										<label className="text-xs font-medium text-muted-foreground">Duration ({timeMode === 'minutes' ? 'min' : 'hr'}/wk)</label>
										<div className="flex gap-1 text-[0.625rem]">
											<button type="button" onClick={() => setTimeMode('minutes')} className={`px-1 rounded ${timeMode==='minutes' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}>Min</button>
											<button type="button" onClick={() => setTimeMode('hours')} className={`px-1 rounded ${timeMode==='hours' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}>Hr</button>
										</div>
									</div>
									<Input
										type="number"
										min={0}
										step={timeMode === 'minutes' ? 45 : 0.5}
										value={timeMode === 'minutes' ? newSubject.minMinutesPerWeek : Math.round((newSubject.minMinutesPerWeek / 60) * 10) / 10}
										onChange={(e) => {
											const val = Number(e.target.value);
											setNewSubject((p) => ({ ...p, minMinutesPerWeek: timeMode === 'minutes' ? val : Math.round(val * 60) }));
										}}
									/>
									<div className="flex gap-1 mt-1">
										{[200, 225, 240, 250].map(val => (
											<button type="button" key={val} onClick={() => setNewSubject(p => ({ ...p, minMinutesPerWeek: val}))} className="rounded border bg-accent/5 px-1.5 py-0.5 text-[0.5625rem] text-muted-foreground hover:bg-accent hover:text-accent-foreground">{val}m</button>
										))}
									</div>
								</div>
								<div>
									<label className="text-xs font-medium text-muted-foreground mb-1 block">Preferred Room Type</label>
									<Select value={newSubject.preferredRoomType} onValueChange={(v) => setNewSubject(p => ({ ...p, preferredRoomType: v as RoomType }))}>
										<SelectTrigger className="flex h-9 w-full bg-background text-sm shadow-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{ALL_ROOM_TYPES.map((t) => (
												<SelectItem key={t} value={t}>{ROOM_TYPE_LABELS[t]}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div>
									<label className="text-xs font-medium text-muted-foreground mb-1 block">Session Pattern</label>
									<Select value={newSubject.sessionPattern} onValueChange={(v) => setNewSubject(p => ({ ...p, sessionPattern: v as SessionPattern }))}>
										<SelectTrigger className="flex h-9 w-full bg-background text-sm shadow-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{(Object.keys(SESSION_PATTERN_LABELS) as SessionPattern[]).map((p) => (
												<SelectItem key={p} value={p}>{SESSION_PATTERN_LABELS[p]}</SelectItem>
											))}
										</SelectContent>
									</Select>
									<p className="text-[0.6rem] text-muted-foreground mt-1">MWF = Mon/Wed/Fri only · TTH = Tue/Thu only · Any = all days</p>
								</div>
							</div>
							<div className="mt-3">
								<label className="text-xs font-medium text-muted-foreground">Grade Levels</label>
								<div className="mt-1 flex gap-2">
									{GRADE_OPTIONS.map((g) => (
										<button
											key={g}
											type="button"
											onClick={() => toggleGradeLevel(g)}
											className={`inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
												newSubject.gradeLevels.includes(g)
													? 'border-primary bg-primary text-primary-foreground'
													: 'border-border bg-background text-muted-foreground hover:bg-accent/10'
											}`}
										>
												G{g}
										</button>
									))}
								</div>
							</div>
							<div className="mt-4 flex gap-2">
								<Button size="sm" onClick={handleCreate} disabled={saving || !newSubject.code.trim() || !newSubject.name.trim()}>
									{saving ? 'Creating...' : 'Create Subject'}
								</Button>
								<Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setNewSubject(emptyForm); }}>
									Cancel
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Table — component-level scrolling */}
			<div className="flex-1 min-h-0 px-6 pb-3">
				<Card className="h-full flex flex-col shadow-sm overflow-hidden">
					<div className="flex-1 min-h-0 overflow-auto">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
								<tr className="border-b">
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('code')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Code <SortIcon field="code" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('name')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Subject Name <SortIcon field="name" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-left">
										<div className="flex items-center gap-2">
											<button onClick={() => toggleSort('minMinutesPerWeek')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
												Duration <SortIcon field="minMinutesPerWeek" />
											</button>
											<div className="flex gap-0.5 text-[0.625rem] bg-muted/50 p-0.5 rounded-md border border-border/50">
												<button type="button" onClick={() => setTimeMode('minutes')} className={`px-1.5 rounded-sm transition-colors ${timeMode==='minutes' ? 'bg-background shadow-xs text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>min</button>
												<button type="button" onClick={() => setTimeMode('hours')} className={`px-1.5 rounded-sm transition-colors ${timeMode==='hours' ? 'bg-background shadow-xs text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>hr</button>
											</div>
										</div>
									</th>
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('preferredRoomType')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Room Pref. <SortIcon field="preferredRoomType" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Pattern</th>
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('gradeLevels')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Grades <SortIcon field="gradeLevels" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-left">
										<TooltipProvider delayDuration={200}>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="font-semibold text-muted-foreground cursor-help border-b border-dotted border-muted-foreground/50">
														Inter-Section
													</span>
												</TooltipTrigger>
												<TooltipContent side="bottom" className="max-w-[240px] text-xs">
													Enable cross-section scheduling (manual only in v1). When enabled, select which grade levels can pool sections for this subject.
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</th>
									<th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Status</th>
									<th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Actions</th>
								</tr>
							</thead>
							<tbody>
								{loading ? (
									Array.from({ length: 6 }).map((_, i) => (
										<tr key={i} className="border-b last:border-0">
											<td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
											<td className="px-4 py-3"><Skeleton className="h-5 w-40" /></td>
											<td className="px-4 py-3"><Skeleton className="h-5 w-14" /></td>
											<td className="px-4 py-3"><Skeleton className="h-5 w-24" /></td>									<td className="px-4 py-3"><Skeleton className="h-5 w-12" /></td>											<td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
											<td className="px-4 py-3"><Skeleton className="h-5 w-14" /></td>
											<td className="px-4 py-3"><Skeleton className="h-5 w-14" /></td>
											<td className="px-4 py-3"><Skeleton className="h-5 w-16 ml-auto" /></td>
										</tr>
									))
								) : paged.length === 0 ? (
									<tr>
										<td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
											{searchQuery || hasActiveFilters ? 'No subjects match your filters.' : 'No subjects configured.'}
										</td>
									</tr>
								) : (
									paged.map((s) => {
										const isEditing = editState?.id === s.id;
										return (
											<Fragment key={s.id}>
											<tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
												<td className="px-4 py-3">
													<code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{s.code}</code>
												</td>
												<td className="px-4 py-3">
													{isEditing ? (
														<Input
															value={editState.name}
															onChange={(e) => setEditState((p) => p && { ...p, name: e.target.value })}
															className="h-8 text-sm"
														/>
													) : (
														<span className="font-medium">{s.name}</span>
													)}
													{s.isSeedable && <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">DepEd Core</Badge>}
												</td>
												<td className="px-4 py-3">
													{isEditing ? (
														<div className="flex items-center gap-1.5">
															<Input
																type="number"
																value={timeMode === 'minutes' ? editState.minMinutesPerWeek : Math.round((editState.minMinutesPerWeek / 60) * 10) / 10}
																onChange={(e) => {
																	const val = Number(e.target.value);
																	setEditState((p) => p && { ...p, minMinutesPerWeek: timeMode === 'minutes' ? val : Math.round(val * 60) });
																}}
																className="h-8 w-[4.5rem] text-sm tabular-nums"
																min={0}
																step={timeMode === 'minutes' ? 45 : 0.5}
															/>
															<span className="text-xs text-muted-foreground shrink-0">{timeMode === 'minutes' ? 'min' : 'hr'}</span>
														</div>
													) : (
														<span className="tabular-nums">
															{timeMode === 'minutes' ? `${s.minMinutesPerWeek} min` : `${Math.round((s.minMinutesPerWeek / 60) * 10) / 10} h`}
														</span>
													)}
												</td>
												<td className="px-4 py-3 text-muted-foreground">
													{ROOM_TYPE_LABELS[s.preferredRoomType] ?? s.preferredRoomType}
												</td>
												<td className="px-4 py-3">
													{isEditing ? (
														<Select value={editState.sessionPattern} onValueChange={(v) => setEditState((p) => p && { ...p, sessionPattern: v as SessionPattern })}>
															<SelectTrigger className="h-8 w-[110px] text-xs">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{(Object.keys(SESSION_PATTERN_LABELS) as SessionPattern[]).map((p) => (
																	<SelectItem key={p} value={p}>{SESSION_PATTERN_LABELS[p]}</SelectItem>
																))}
															</SelectContent>
														</Select>
													) : (
														<Badge variant="outline" className={`text-[0.6rem] px-1.5 py-0 ${SESSION_PATTERN_BADGE[s.sessionPattern ?? 'ANY']}`}>
															{s.sessionPattern ?? 'ANY'}
														</Badge>
													)}
												</td>
												<td className="px-4 py-3">
													{isEditing ? (
														<div className="flex gap-1">
															{GRADE_OPTIONS.map((g) => (
																<button
																	key={g}
																	type="button"
																	onClick={() => toggleEditGrade(g)}
																	className={`rounded border px-1.5 py-0.5 text-[0.6875rem] font-medium transition-colors ${
																		editState.gradeLevels.includes(g)
																			? 'border-primary bg-primary text-primary-foreground'
																			: 'border-border text-muted-foreground hover:bg-accent/10'
																	}`}
																>
																	{gradeLabel(g)}
																</button>
															))}
														</div>
													) : (
														<div className="flex gap-1">
															{s.gradeLevels.map((g) => (
																<Badge key={g} variant="outline" className="text-[0.6rem] px-1.5 py-0">
																	G{g}
																</Badge>
															))}
														</div>
													)}
												</td>
												<td className="px-4 py-3">
													{isEditing ? (
														<div className="flex items-center gap-2">
															<Switch
																checked={editState.interSectionEnabled}
																onCheckedChange={(v) => setEditState((p) => p && {
																	...p,
																	interSectionEnabled: v,
																	interSectionGradeLevels: v ? p.interSectionGradeLevels : [],
																})}
																aria-label="Enable inter-section scheduling"
															/>
															{editState.interSectionEnabled && (
																<div className="flex gap-1">
																	{editState.gradeLevels.map((g) => (
																		<button
																			key={g}
																			type="button"
																			onClick={() => setEditState((p) => {
																				if (!p) return p;
																				const has = p.interSectionGradeLevels.includes(g);
																				return {
																					...p,
																					interSectionGradeLevels: has
																						? p.interSectionGradeLevels.filter((x) => x !== g)
																						: [...p.interSectionGradeLevels, g].sort((a, b) => a - b),
																				};
																			})}
																			className={`rounded border px-1.5 py-0.5 text-[0.6rem] font-medium transition-colors ${
																				editState.interSectionGradeLevels.includes(g)
																					? 'border-primary bg-primary text-primary-foreground'
																					: 'border-border text-muted-foreground hover:bg-accent/10'
																			}`}
																		>
																			{gradeLabel(g)}
																		</button>
																	))}
																</div>
															)}
														</div>
													) : (
														<div className="flex items-center gap-1.5">
															{s.interSectionEnabled ? (
																<>
																	<Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[0.6rem]">
																		On
																	</Badge>
																	{(s.interSectionGradeLevels ?? []).length > 0 && (
																		<div className="flex gap-0.5">
																			{s.interSectionGradeLevels.map((g) => (
																				<span 
																					key={g} 
																					className={`text-[0.55rem] font-bold px-1.5 py-0.5 rounded border ${GRADE_COLORS[String(g)] ?? 'bg-muted text-muted-foreground'}`}
																				>
																					G{g}
																				</span>
																			))}
																		</div>
																	)}
																</>
															) : (
																<span className="text-[0.65rem] text-muted-foreground">—</span>
															)}
														</div>
													)}
												</td>
												<td className="px-4 py-3">
													{s.isActive ? (
														<Badge className="bg-emerald-100 text-emerald-700 text-[0.6rem]">Active</Badge>
													) : (
														<Badge variant="secondary" className="text-[0.6rem]">Inactive</Badge>
													)}
												</td>
												<td className="px-4 py-3 text-right">
													{isEditing ? (
														<div className="flex justify-end gap-1">
															<Button variant="outline" size="sm" onClick={handleEditSave} disabled={saving}>
																<Check className="size-3.5" />
															</Button>
															<Button variant="outline" size="sm" onClick={() => setEditState(null)}>
																<X className="size-3.5" />
															</Button>
														</div>
													) : (
														<div className="flex justify-end gap-1">
															<TooltipProvider delayDuration={200}>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="outline"
																			size="sm"
																			onClick={() => toggleTeacherCoverage(s.id)}
																			className={expandedSubjectId === s.id ? 'border-primary text-primary' : ''}
																		>
																			<Users className="size-3.5" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>Teacher coverage</TooltipContent>
																</Tooltip>
															</TooltipProvider>
															<Button
																variant="outline"
																size="sm"
																onClick={() => setEditState({
																	id: s.id,
																	name: s.name,
																	minMinutesPerWeek: s.minMinutesPerWeek,
																	sessionPattern: s.sessionPattern ?? 'ANY',
																	gradeLevels: [...s.gradeLevels],
																	interSectionEnabled: s.interSectionEnabled ?? false,
																	interSectionGradeLevels: [...(s.interSectionGradeLevels ?? [])],
																})}
															>
																<Pencil className="size-3.5" />
															</Button>
															{!s.isSeedable && (
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() => setDeleteTarget(s)}
																	className="text-red-500 hover:text-red-700"
																>
																	<Trash2 className="size-3.5" />
																</Button>
															)}
														</div>
													)}
												</td>
											</tr>
											{/* Teacher coverage drilldown row */}
											{expandedSubjectId === s.id && (
												<tr className="bg-muted/20">
													<td colSpan={9} className="px-4 py-3">
														{coverageLoading ? (
															<div className="text-xs text-muted-foreground">Loading teacher coverage...</div>
														) : (teacherCoverage[s.id] ?? []).length > 0 ? (
															<div className="space-y-1.5">
																<div className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
																	<Users className="size-3" /> Teachers assigned to {s.name}
																</div>
																{(teacherCoverage[s.id] ?? []).map((t, i) => (
																	<div key={i} className="flex items-center gap-2 text-sm">
																		<span className="font-medium min-w-[10rem]">{t.name}</span>
																		<div className="flex gap-1">
																			{t.grades.map((g) => (
																				<Badge key={g} variant="outline" className={`text-[0.55rem] px-1.5 py-0 ${GRADE_COLORS[String(g)] ?? ''}`}>
																					{gradeLabel(g)}
																				</Badge>
																			))}
																		</div>
																	</div>
																))}
																{s.preferredRoomType !== 'CLASSROOM' && (
																	<div className="mt-2 pt-2 border-t border-border">
																		<div className="text-[0.6875rem] text-muted-foreground flex items-center gap-1.5">
																			<Map className="size-3" />
																			Room type: {ROOM_TYPE_LABELS[s.preferredRoomType]}
																			<Link to="/map" className="text-primary hover:underline text-[0.625rem] ml-1">
																				View on map →
																			</Link>
																		</div>
																	</div>
																)}
															</div>
														) : (
															<div className="text-xs text-muted-foreground">No teachers assigned to this subject yet.</div>
														)}
													</td>
												</tr>
											)}
											</Fragment>
										);
									})
								)}
							</tbody>
						</table>
					</div>

					{/* Pagination footer */}
					{!loading && subjects.length > 0 && (
						<div className="shrink-0 flex items-center justify-between border-t border-border px-4 py-2 text-sm">
							<div className="flex items-center gap-2 text-muted-foreground text-xs">
								<span>{totalFiltered} result{totalFiltered !== 1 ? 's' : ''}</span>
								<span>·</span>
								<Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
									<SelectTrigger className="h-7 w-[90px] text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>)}
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-center gap-1">
								<Button
									variant="outline"
									size="sm"
									className="h-7 w-7 p-0"
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									disabled={page <= 1}
								>
									<ChevronLeft className="size-3.5" />
								</Button>
								<span className="px-2 text-xs tabular-nums">{page} / {totalPages}</span>
								<Button
									variant="outline"
									size="sm"
									className="h-7 w-7 p-0"
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
									disabled={page >= totalPages}
								>
									<ChevronRight className="size-3.5" />
								</Button>
							</div>
						</div>
					)}
				</Card>
			</div>

			{/* Delete confirmation */}
			<ConfirmationModal
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
				variant="danger"
				title="Delete Subject"
				description={`Are you sure you want to delete "${deleteTarget?.name}" (${deleteTarget?.code})? This action cannot be undone.`}
				confirmText="Delete"
				onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
			/>
		</div>
	);
}
