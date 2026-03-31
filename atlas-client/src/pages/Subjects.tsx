import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	BookOpen,
	Check,
	ChevronLeft,
	ChevronRight,
	Pencil,
	Plus,
	Search,
	Trash2,
	X,
} from 'lucide-react';

import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type { RoomType, Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';

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

type SortField = 'code' | 'name' | 'minMinutesPerWeek' | 'preferredRoomType' | 'gradeLevels';
type SortDir = 'asc' | 'desc';

type EditState = {
	id: number;
	name: string;
	minMinutesPerWeek: number;
	gradeLevels: number[];
};

type NewSubjectForm = {
	code: string;
	name: string;
	minMinutesPerWeek: number;
	preferredRoomType: RoomType;
	gradeLevels: number[];
};

const emptyForm: NewSubjectForm = {
	code: '',
	name: '',
	minMinutesPerWeek: 45,
	preferredRoomType: 'CLASSROOM',
	gradeLevels: [7, 8, 9, 10],
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
				gradeLevels: editState.gradeLevels,
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
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
						className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
					>
						<option value="all">All Status</option>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
					</select>
					<select
						value={roomTypeFilter}
						onChange={(e) => setRoomTypeFilter(e.target.value as typeof roomTypeFilter)}
						className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
					>
						<option value="all">All Room Types</option>
						{ALL_ROOM_TYPES.map((t) => (
							<option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>
						))}
					</select>
					<select
						value={gradeLevelFilter}
						onChange={(e) => setGradeLevelFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
						className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
					>
						<option value="all">All Grades</option>
						{GRADE_OPTIONS.map((g) => (
							<option key={g} value={g}>Grade {g}</option>
						))}
					</select>
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
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
									<label className="text-xs font-medium text-muted-foreground">Min Minutes/Week</label>
									<Input
										type="number"
										min={45}
										step={45}
										value={newSubject.minMinutesPerWeek}
										onChange={(e) => setNewSubject((p) => ({ ...p, minMinutesPerWeek: Number(e.target.value) }))}
									/>
								</div>
								<div>
									<label className="text-xs font-medium text-muted-foreground">Preferred Room Type</label>
									<select
										className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
										value={newSubject.preferredRoomType}
										onChange={(e) => setNewSubject((p) => ({ ...p, preferredRoomType: e.target.value as RoomType }))}
									>
										{ALL_ROOM_TYPES.map((t) => (
											<option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>
										))}
									</select>
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
											Grade {g}
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
										<button onClick={() => toggleSort('minMinutesPerWeek')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Min/Week <SortIcon field="minMinutesPerWeek" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('preferredRoomType')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Room Pref. <SortIcon field="preferredRoomType" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('gradeLevels')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Grades <SortIcon field="gradeLevels" />
										</button>
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
											<td className="px-4 py-3"><Skeleton className="h-5 w-24" /></td>
											<td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
											<td className="px-4 py-3"><Skeleton className="h-5 w-14" /></td>
											<td className="px-4 py-3"><Skeleton className="h-5 w-16 ml-auto" /></td>
										</tr>
									))
								) : paged.length === 0 ? (
									<tr>
										<td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
											{searchQuery || hasActiveFilters ? 'No subjects match your filters.' : 'No subjects configured.'}
										</td>
									</tr>
								) : (
									paged.map((s) => {
										const isEditing = editState?.id === s.id;
										return (
											<tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
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
												</td>
												<td className="px-4 py-3">
													{isEditing ? (
														<Input
															type="number"
															value={editState.minMinutesPerWeek}
															onChange={(e) => setEditState((p) => p && { ...p, minMinutesPerWeek: Number(e.target.value) })}
															className="h-8 w-20 text-sm"
															min={45}
															step={45}
														/>
													) : (
														<span>{s.minMinutesPerWeek} min</span>
													)}
												</td>
												<td className="px-4 py-3 text-muted-foreground">
													{ROOM_TYPE_LABELS[s.preferredRoomType] ?? s.preferredRoomType}
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
																	{g}
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
															<Button
																variant="outline"
																size="sm"
																onClick={() => setEditState({
																	id: s.id,
																	name: s.name,
																	minMinutesPerWeek: s.minMinutesPerWeek,
																	gradeLevels: [...s.gradeLevels],
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
								<select
									value={pageSize}
									onChange={(e) => setPageSize(Number(e.target.value))}
									className="h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
								>
									{PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
								</select>
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
