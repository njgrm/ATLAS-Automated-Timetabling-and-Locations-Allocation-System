import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	BookOpen,
	Check,
	Pencil,
	Plus,
	Search,
	ShieldCheck,
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

type EditState = {
	id: number;
	name: string;
	minMinutesPerWeek: number;
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

	const fetchSubjects = useCallback(async () => {
		setLoading(true);
		try {
			// First ensure defaults are seeded
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

	const filtered = useMemo(() => {
		if (!searchQuery.trim()) return subjects;
		const q = searchQuery.toLowerCase();
		return subjects.filter(
			(s) =>
				s.name.toLowerCase().includes(q) ||
				s.code.toLowerCase().includes(q),
		);
	}, [subjects, searchQuery]);

	const handleEditSave = async () => {
		if (!editState) return;
		setSaving(true);
		try {
			await atlasApi.patch(`/subjects/${editState.id}`, {
				name: editState.name,
				minMinutesPerWeek: editState.minMinutesPerWeek,
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

	return (
		<div className="px-6 py-4">
			{/* Page header */}
			<div className="mb-1 flex items-center justify-between">
				<div>
					<h1 className="text-lg font-bold text-foreground">Subjects</h1>
					<p className="text-sm text-muted-foreground">
						Manage learning areas and elective subjects for scheduling.
					</p>
				</div>
				<Button onClick={() => setShowAdd(true)} disabled={showAdd} size="sm">
					<Plus className="mr-1.5 size-4" /> Add Subject
				</Button>
			</div>

			{error && (
				<div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
					{error}
					<button className="ml-2 font-semibold" onClick={() => setError(null)}>
						Dismiss
					</button>
				</div>
			)}

			{/* Search */}
			<div className="mt-4 relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
				<Input
					placeholder="Search subjects..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pl-9"
				/>
			</div>

			{/* Add subject form */}
			{showAdd && (
				<Card className="mt-4 shadow-sm border-primary/30">
					<CardContent className="pt-5">
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
								<label className="text-xs font-medium text-muted-foreground">
									Min Minutes/Week
								</label>
								<Input
									type="number"
									min={45}
									step={45}
									value={newSubject.minMinutesPerWeek}
									onChange={(e) =>
										setNewSubject((p) => ({ ...p, minMinutesPerWeek: Number(e.target.value) }))
									}
								/>
							</div>
							<div>
								<label className="text-xs font-medium text-muted-foreground">
									Preferred Room Type
								</label>
								<select
									className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
									value={newSubject.preferredRoomType}
									onChange={(e) =>
										setNewSubject((p) => ({ ...p, preferredRoomType: e.target.value as RoomType }))
									}
								>
									{ALL_ROOM_TYPES.map((t) => (
										<option key={t} value={t}>
											{ROOM_TYPE_LABELS[t]}
										</option>
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
			)}

			{/* Subjects table */}
			<Card className="mt-4 shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50">
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">Code</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">Subject Name</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">Min/Week</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">Room Pref.</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">Grades</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
								<th className="px-4 py-3 text-right font-semibold text-muted-foreground">Actions</th>
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
							) : filtered.length === 0 ? (
								<tr>
									<td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
										{searchQuery ? 'No subjects match your search.' : 'No subjects configured.'}
									</td>
								</tr>
							) : (
								filtered.map((s) => {
									const isEditing = editState?.id === s.id;
									return (
										<tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
											<td className="px-4 py-3">
												<code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
													{s.code}
												</code>
											</td>
											<td className="px-4 py-3">
												{isEditing ? (
													<Input
														value={editState.name}
														onChange={(e) => setEditState((p) => p && { ...p, name: e.target.value })}
														className="h-8 text-sm"
													/>
												) : (
													<div className="flex items-center gap-2">
														<span className="font-medium">{s.name}</span>
														{s.isSeedable && (
															<Badge variant="secondary" className="text-[0.6rem] gap-1 px-1.5 py-0">
																<ShieldCheck className="size-3" /> DepEd Standard
															</Badge>
														)}
													</div>
												)}
											</td>
											<td className="px-4 py-3">
												{isEditing ? (
													<Input
														type="number"
														value={editState.minMinutesPerWeek}
														onChange={(e) =>
															setEditState((p) => p && { ...p, minMinutesPerWeek: Number(e.target.value) })
														}
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
												<div className="flex gap-1">
													{s.gradeLevels.map((g) => (
														<Badge
															key={g}
															variant="outline"
															className="text-[0.6rem] px-1.5 py-0"
														>
															G{g}
														</Badge>
													))}
												</div>
											</td>
											<td className="px-4 py-3">
												{s.isActive ? (
													<Badge className="bg-emerald-100 text-emerald-700 text-[0.6rem]">
														Active
													</Badge>
												) : (
													<Badge variant="secondary" className="text-[0.6rem]">
														Inactive
													</Badge>
												)}
											</td>
											<td className="px-4 py-3 text-right">
												{isEditing ? (
													<div className="flex justify-end gap-1">
														<Button
															variant="outline"
															size="sm"
															onClick={handleEditSave}
															disabled={saving}
														>
															<Check className="size-3.5" />
														</Button>
														<Button
															variant="outline"
															size="sm"
															onClick={() => setEditState(null)}
														>
															<X className="size-3.5" />
														</Button>
													</div>
												) : (
													<div className="flex justify-end gap-1">
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																setEditState({
																	id: s.id,
																	name: s.name,
																	minMinutesPerWeek: s.minMinutesPerWeek,
																})
															}
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
			</Card>

			{/* Summary */}
			{!loading && subjects.length > 0 && (
				<div className="mt-3 flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
					<BookOpen className="size-4" />
					<span>
						{searchQuery && filtered.length !== subjects.length
							? `Showing ${filtered.length} of ${subjects.length} subjects · `
							: ''}
						{subjects.filter((s) => s.isActive).length} active subject{subjects.filter((s) => s.isActive).length !== 1 ? 's' : ''} configured
						{' · '}
						{subjects.filter((s) => s.isSeedable).length} DepEd standards
					</span>
				</div>
			)}

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
