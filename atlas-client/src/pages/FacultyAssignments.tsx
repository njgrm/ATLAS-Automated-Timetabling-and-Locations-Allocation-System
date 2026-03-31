import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	CheckCircle2,
	ChevronRight,
	Save,
	Search,
	UserCog,
} from 'lucide-react';

import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type { Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';

const DEFAULT_SCHOOL_ID = 1;
const GRADE_OPTIONS = [7, 8, 9, 10];

type FacultySummary = {
	id: number;
	externalId: number;
	firstName: string;
	lastName: string;
	department: string | null;
	isActiveForScheduling: boolean;
	maxHoursPerWeek: number;
	subjectCount: number;
	weeklyHours: number;
	assignments: {
		id: number;
		subjectId: number;
		gradeLevels: number[];
		subject: { id: number; name: string; code: string; minMinutesPerWeek: number };
	}[];
};

type LocalAssignment = {
	subjectId: number;
	gradeLevels: number[];
};

export default function FacultyAssignments() {
	const [faculty, setFaculty] = useState<FacultySummary[]>([]);
	const [subjects, setSubjects] = useState<Subject[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [localAssignments, setLocalAssignments] = useState<LocalAssignment[]>([]);
	const [saving, setSaving] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned'>('all');
	const [departmentFilter, setDepartmentFilter] = useState<string>('all');
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setLoading(true);
		try {
			const [facRes, subRes] = await Promise.all([
				atlasApi.get<{ faculty: FacultySummary[] }>('/faculty-assignments/summary', {
					params: { schoolId: DEFAULT_SCHOOL_ID },
				}),
				atlasApi.get<{ subjects: Subject[] }>('/subjects', {
					params: { schoolId: DEFAULT_SCHOOL_ID },
				}),
			]);
			setFaculty(facRes.data.faculty);
			setSubjects(subRes.data.subjects.filter((s) => s.isActive));
			setError(null);
		} catch {
			setError('Failed to load assignment data.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const selected = useMemo(
		() => faculty.find((f) => f.id === selectedId) ?? null,
		[faculty, selectedId],
	);

	// When selection changes, load local assignments from the selected faculty
	useEffect(() => {
		if (!selected) {
			setLocalAssignments([]);
			setDirty(false);
			return;
		}
		setLocalAssignments(
			selected.assignments.map((a) => ({
				subjectId: a.subjectId,
				gradeLevels: [...a.gradeLevels],
			})),
		);
		setDirty(false);
	}, [selected]);

	// Filter faculty list
	const filteredFaculty = useMemo(() => {
		let list = faculty;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(f) =>
					f.firstName.toLowerCase().includes(q) ||
					f.lastName.toLowerCase().includes(q) ||
					(f.department ?? '').toLowerCase().includes(q),
			);
		}
		if (filterStatus === 'assigned') {
			list = list.filter((f) => f.subjectCount > 0);
		} else if (filterStatus === 'unassigned') {
			list = list.filter((f) => f.subjectCount === 0);
		}
		if (departmentFilter !== 'all') list = list.filter((f) => f.department === departmentFilter);
		return list;
	}, [faculty, searchQuery, filterStatus, departmentFilter]);

	const toggleSubject = (subjectId: number) => {
		setDirty(true);
		setLocalAssignments((prev) => {
			const existing = prev.find((a) => a.subjectId === subjectId);
			if (existing) {
				return prev.filter((a) => a.subjectId !== subjectId);
			}
			return [...prev, { subjectId, gradeLevels: [...GRADE_OPTIONS] }];
		});
	};

	const toggleGradeLevel = (subjectId: number, grade: number) => {
		setDirty(true);
		setLocalAssignments((prev) =>
			prev.map((a) => {
				if (a.subjectId !== subjectId) return a;
				const has = a.gradeLevels.includes(grade);
				const newGrades = has
					? a.gradeLevels.filter((g) => g !== grade)
					: [...a.gradeLevels, grade].sort();
				// If no grades remain, remove the assignment
				if (newGrades.length === 0) return a; // Keep at least one
				return { ...a, gradeLevels: newGrades };
			}),
		);
	};

	const handleSave = async () => {
		if (!selected) return;
		setSaving(true);
		setError(null);
		try {
			await atlasApi.put(`/faculty-assignments/${selected.id}`, {
				schoolId: DEFAULT_SCHOOL_ID,
				assignments: localAssignments,
			});
			setDirty(false);
			toast.success('Assignments saved successfully.');
			await fetchData();
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? 'Failed to save assignments.');
		} finally {
			setSaving(false);
		}
	};

	// Compute teaching load from local assignments
	const computedLoad = useMemo(() => {
		let totalMinutes = 0;
		for (const a of localAssignments) {
			const sub = subjects.find((s) => s.id === a.subjectId);
			if (sub) {
				totalMinutes += sub.minMinutesPerWeek * a.gradeLevels.length;
			}
		}
		return Math.round((totalMinutes / 60) * 10) / 10;
	}, [localAssignments, subjects]);

	const maxHours = selected?.maxHoursPerWeek ?? 30;
	const loadStatus =
		computedLoad === 0
			? 'none'
			: computedLoad > maxHours
				? 'over'
				: computedLoad >= maxHours * 0.85
					? 'at'
					: 'under';

	return (
		<div className="px-6 py-1">

			{error && (
				<div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
					{error}
					<button className="ml-2 font-semibold" onClick={() => setError(null)}>Dismiss</button>
				</div>
			)}

					<div className="mt-4 flex gap-4 h-[calc(100vh-8rem)]">
				{/* LEFT PANEL — Faculty list */}
				<div className="w-80 shrink-0 flex flex-col rounded-lg border border-border bg-card shadow-sm">
					<div className="border-b border-border p-3">
						<div className="relative">
							<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
							<Input
								placeholder="Search faculty..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-8 h-8 text-sm"
							/>
						</div>
						<div className="mt-2 flex gap-1">
							{(['all', 'assigned', 'unassigned'] as const).map((status) => (
								<button
									key={status}
									onClick={() => setFilterStatus(status)}
									className={`rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-colors ${
										filterStatus === status
											? 'bg-primary text-primary-foreground'
											: 'bg-muted text-muted-foreground hover:bg-muted/80'
									}`}
								>
									{status.charAt(0).toUpperCase() + status.slice(1)}
								</button>
							))}
						</div>
						{(() => {
							const depts = Array.from(new Set(faculty.map((f) => f.department).filter(Boolean) as string[])).sort();
							if (depts.length === 0) return null;
							return (
								<select
									value={departmentFilter}
									onChange={(e) => setDepartmentFilter(e.target.value)}
									className="mt-2 h-7 w-full rounded-md border border-input bg-background px-2 text-[0.6875rem] focus:outline-none focus:ring-1 focus:ring-ring"
								>
									<option value="all">All Departments</option>
									{depts.map((d) => <option key={d} value={d}>{d}</option>)}
								</select>
							);
						})()}
					</div>

					<div className="flex-1 overflow-auto">
						{loading ? (
						Array.from({ length: 8 }).map((_, i) => (
							<div key={i} className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5">
								<Skeleton className="size-8 rounded-full shrink-0" />
								<div className="flex-1 space-y-1.5">
									<Skeleton className="h-4 w-28" />
									<Skeleton className="h-3 w-20" />
								</div>
								<Skeleton className="size-4 shrink-0" />
							</div>
						))
						) : filteredFaculty.length === 0 ? (
							<p className="p-4 text-center text-sm text-muted-foreground">
								{faculty.length === 0
									? 'No faculty synced. Visit the Faculty page first.'
									: 'No results.'}
							</p>
						) : (
							filteredFaculty.map((f) => (
								<button
									key={f.id}
									onClick={() => setSelectedId(f.id)}
									className={`flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors ${
										selectedId === f.id
											? 'bg-primary/5 border-l-2 border-l-primary'
											: 'hover:bg-muted/50'
									}`}
								>
									<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
										{f.firstName[0]}
										{f.lastName[0]}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">
											{f.lastName}, {f.firstName}
										</p>
										<p className="truncate text-[0.6875rem] text-muted-foreground">
											{f.department ?? 'No department'}
										</p>
									</div>
									{f.subjectCount === 0 ? (
										<AlertTriangle className="size-4 shrink-0 text-amber-500" />
									) : (
										<CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
									)}
									<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
								</button>
							))
						)}
					</div>

					{/* Summary stats */}
					<div className="border-t border-border px-3 py-2 text-[0.6875rem] text-muted-foreground">
						{faculty.filter((f) => f.subjectCount > 0).length} / {faculty.length} assigned
					</div>
				</div>

				{/* RIGHT PANEL — Assignment profile */}
				<div className="flex-1 overflow-auto">
					{!selected ? (
						<div className="flex h-full items-center justify-center text-muted-foreground">
							<div className="text-center">
								<UserCog className="mx-auto size-10 text-muted-foreground/30" />
								<p className="mt-2 text-sm">Select a faculty member to manage assignments.</p>
							</div>
						</div>
					) : (
						<div className="flex flex-col h-full">
							{/* Sticky faculty identity + teaching load */}
							<Card className="shadow-sm sticky top-0 z-10 shrink-0">
								<CardContent className="pt-5">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
												{selected.firstName[0]}
												{selected.lastName[0]}
											</div>
											<div>
												<h2 className="text-base font-bold">
													{selected.firstName} {selected.lastName}
												</h2>
												<p className="text-sm text-muted-foreground">
													{selected.department ?? 'No department'} · ID: {selected.externalId}
												</p>
											</div>
										</div>
										{!selected.isActiveForScheduling && (
											<Badge variant="secondary" className="text-xs">
												Excluded from scheduling
											</Badge>
										)}
									</div>

									<div className="mt-4 pt-3 border-t border-border">
										<h3 className="text-sm font-semibold text-muted-foreground mb-3">
											Teaching Load Summary
										</h3>
										<div className="grid grid-cols-3 gap-4 text-center">
											<div>
												<p className="text-2xl font-black">{computedLoad}h</p>
												<p className="text-[0.6875rem] text-muted-foreground">Weekly hours</p>
											</div>
											<div>
												<p className="text-2xl font-black">{maxHours}h</p>
												<p className="text-[0.6875rem] text-muted-foreground">Max (RA 4670)</p>
											</div>
											<div>
												<Badge
													className={`text-xs ${
														loadStatus === 'over'
															? 'bg-red-100 text-red-700'
															: loadStatus === 'at'
																? 'bg-amber-100 text-amber-700'
																: loadStatus === 'under'
																	? 'bg-emerald-100 text-emerald-700'
																	: 'bg-muted text-muted-foreground'
													}`}
												>
													{loadStatus === 'over'
														? 'Over capacity'
														: loadStatus === 'at'
															? 'At capacity'
															: loadStatus === 'under'
																? 'Under capacity'
																: 'No load'}
												</Badge>
												<p className="mt-1 text-[0.6875rem] text-muted-foreground">Status</p>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Scrollable subject assignments */}
							<Card className="shadow-sm mt-4 flex-1 min-h-0 flex flex-col">
								<CardContent className="pt-5 flex-1 overflow-auto">
									<div className="flex items-center justify-between mb-3">
										<h3 className="text-sm font-semibold text-muted-foreground">
											Qualified Subjects
										</h3>
										{dirty && (
											<Button size="sm" onClick={handleSave} disabled={saving || !selected.isActiveForScheduling}>
												<Save className="mr-1.5 size-3.5" />
												{saving ? 'Saving...' : 'Save Assignments'}
											</Button>
										)}
									</div>

									{!selected.isActiveForScheduling && (
										<div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
											<AlertTriangle className="size-4" />
											This faculty member is excluded from scheduling. Enable them first.
										</div>
									)}

									<div className="space-y-2">
										{subjects.map((sub) => {
											const assignment = localAssignments.find((a) => a.subjectId === sub.id);
											const isAssigned = !!assignment;

											return (
												<div
													key={sub.id}
													className={`rounded-lg border p-3 transition-colors ${
														isAssigned ? 'border-primary/30 bg-primary/5' : 'border-border'
													}`}
												>
													<div className="flex items-center gap-3">
														<input
															type="checkbox"
															checked={isAssigned}
															onChange={() => toggleSubject(sub.id)}
															disabled={!selected.isActiveForScheduling}
															className="size-4 rounded border-border accent-[hsl(var(--primary))]"
														/>
														<div className="min-w-0 flex-1">
															<div className="flex items-center gap-2">
																<span className="text-sm font-medium">{sub.name}</span>
																<code className="rounded bg-muted px-1 py-0.5 text-[0.6rem] font-mono">
																	{sub.code}
																</code>

															</div>
															<p className="text-[0.6875rem] text-muted-foreground">
																{sub.minMinutesPerWeek} min/week
															</p>
														</div>
													</div>

													{/* Grade level scope per subject */}
													{isAssigned && (
														<div className="ml-7 mt-2 flex items-center gap-1.5">
															<span className="text-[0.6875rem] text-muted-foreground mr-1">Grades:</span>
															{GRADE_OPTIONS.map((g) => (
																<button
																	key={g}
																	type="button"
																	onClick={() => toggleGradeLevel(sub.id, g)}
																	disabled={!selected.isActiveForScheduling}
																	className={`rounded border px-2 py-0.5 text-[0.6875rem] font-medium transition-colors ${
																		assignment!.gradeLevels.includes(g)
																			? 'border-primary bg-primary text-primary-foreground'
																			: 'border-border text-muted-foreground hover:bg-accent/10'
																	}`}
																>
																	{g}
																</button>
															))}
														</div>
													)}
												</div>
											);
										})}
									</div>
								</CardContent>
							</Card>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
