import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	CheckCircle2,
	ChevronRight,
	Info,
	Save,
	Search,
	UserCog,
} from 'lucide-react';

import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import type { Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

const DEFAULT_SCHOOL_ID = 1;
const GRADE_OPTIONS = [7, 8, 9, 10];

/* ── DepEd Load Policy Constants ─────────────────────────────── */
const STANDARD_WEEKLY_TEACHING_HOURS = 30;
const MAX_WEEKLY_TEACHING_HOURS = 40;
const CLASS_ADVISER_EQUIVALENT_HOURS = 5;

type LoadStatus = 'below-standard' | 'compliant' | 'overload-allowed' | 'over-cap';

type LoadProfile = {
	actualTeachingHours: number;
	equivalentHours: number;
	creditedTotalHours: number;
	overloadHours: number;
	overCapHours: number;
	status: LoadStatus;
	statusLabel: string;
	breakdown: { subjectName: string; subjectCode: string; grade: number; minutesPerWeek: number; sections: number; totalMinutes: number }[];
};

function deriveLoadStatus(actualTeaching: number): { status: LoadStatus; label: string } {
	if (actualTeaching > MAX_WEEKLY_TEACHING_HOURS) return { status: 'over-cap', label: 'Over Cap' };
	if (actualTeaching >= STANDARD_WEEKLY_TEACHING_HOURS) return { status: 'overload-allowed', label: actualTeaching > STANDARD_WEEKLY_TEACHING_HOURS ? 'Overload Allowed' : 'Compliant' };
	return { status: 'below-standard', label: 'Below Standard' };
}

const STATUS_COLORS: Record<LoadStatus, { text: string; bg: string; border: string }> = {
	'below-standard': { text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
	'compliant': { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
	'overload-allowed': { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
	'over-cap': { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

type FacultySummary = {
	id: number;
	externalId: number;
	firstName: string;
	lastName: string;
	department: string | null;
	isActiveForScheduling: boolean;
	maxHoursPerWeek: number;
	subjectCount: number;
	subjectHours: number;
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

	/* Section demand data */
	const [sectionsByGrade, setSectionsByGrade] = useState<Record<number, number>>({});
	const [sectionsAvailable, setSectionsAvailable] = useState<boolean | null>(null); // null = loading

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

			// Fetch section counts (non-blocking — assignment page still works without it)
			try {
				const settings = await fetchPublicSettings();
				const ayId = settings.activeSchoolYearId;
				if (ayId) {
					const secRes = await atlasApi.get<{ byGradeLevel: Record<number, number>; code?: string }>(
						`/sections/summary/${ayId}?schoolId=${DEFAULT_SCHOOL_ID}`,
					);
					if (secRes.data.code === 'UPSTREAM_UNAVAILABLE') {
						setSectionsAvailable(false);
					} else {
						setSectionsByGrade(secRes.data.byGradeLevel ?? {});
						setSectionsAvailable(true);
					}
				} else {
					setSectionsAvailable(false);
				}
			} catch {
				setSectionsAvailable(false);
			}
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

	// Section-aware load profile following DepEd policy semantics
	const loadProfile: LoadProfile = useMemo(() => {
		const breakdown: LoadProfile['breakdown'] = [];
		let totalMinutes = 0;

		for (const a of localAssignments) {
			const sub = subjects.find((s) => s.id === a.subjectId);
			if (!sub) continue;
			for (const g of a.gradeLevels) {
				const secCount = sectionsAvailable ? (sectionsByGrade[g] ?? 0) : 1;
				const demand = sub.minMinutesPerWeek * secCount;
				breakdown.push({
					subjectName: sub.name,
					subjectCode: sub.code,
					grade: g,
					minutesPerWeek: sub.minMinutesPerWeek,
					sections: secCount,
					totalMinutes: demand,
				});
				totalMinutes += demand;
			}
		}

		const actualTeachingHours = Math.round((totalMinutes / 60) * 10) / 10;

		// Equivalent hours — class adviser adds +5h; extend here as designation data becomes available
		// TODO: pull designation from faculty record when available
		const equivalentHours = 0;
		const creditedTotalHours = Math.round((actualTeachingHours + equivalentHours) * 10) / 10;
		const overloadHours = Math.round(Math.max(actualTeachingHours - STANDARD_WEEKLY_TEACHING_HOURS, 0) * 10) / 10;
		const overCapHours = Math.round(Math.max(actualTeachingHours - MAX_WEEKLY_TEACHING_HOURS, 0) * 10) / 10;
		const { status, label } = deriveLoadStatus(actualTeachingHours);

		return { actualTeachingHours, equivalentHours, creditedTotalHours, overloadHours, overCapHours, status, statusLabel: label, breakdown };
	}, [localAssignments, subjects, sectionsByGrade, sectionsAvailable]);

	const subjectsLackingFaculty = useMemo(() => {
		const assignedIds = new Set<number>();
		for (const fac of faculty) {
			for (const a of fac.assignments) {
				assignedIds.add(a.subjectId);
			}
		}
		return subjects.filter(s => s.isActive && !assignedIds.has(s.id));
	}, [faculty, subjects]);

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)] px-6">

			{error && (
				<div className="mt-3 shrink-0 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
					{error}
					<button className="ml-2 font-semibold" onClick={() => setError(null)}>Dismiss</button>
				</div>
			)}

					<div className="mt-4 flex gap-4 flex-1 min-h-0 pb-3">
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
								<Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v)}>
									<SelectTrigger className="mt-2 h-7 w-full text-[0.6875rem]">
										<SelectValue placeholder="All Departments" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Departments</SelectItem>
										{depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
									</SelectContent>
								</Select>
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
							{/* Compact faculty identity + teaching load bar */}
							<div className="shrink-0 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
								<div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
									{selected.firstName[0]}{selected.lastName[0]}
								</div>
								<div className="min-w-0">
									<p className="text-sm font-bold truncate">
										{selected.firstName} {selected.lastName}
									</p>
									<p className="text-[0.6875rem] text-muted-foreground truncate">
										{selected.department ?? 'No department'} · ID: {selected.externalId}
									</p>
								</div>

								{!selected.isActiveForScheduling && (
									<Badge variant="secondary" className="text-xs shrink-0">
										Excluded
									</Badge>
								)}

								<div className="ml-auto flex items-center gap-3 shrink-0">
									{/* Inline stat row: Actual | Equiv | Credited | Status */}
									{(() => {
										const { actualTeachingHours, equivalentHours, creditedTotalHours, overloadHours, overCapHours, status, statusLabel, breakdown } = loadProfile;
										const colors = STATUS_COLORS[status];

										return (
											<TooltipProvider delayDuration={200}>
												{/* Teaching metrics cluster */}
												<div className="flex items-center gap-3 text-right">
													<div className="flex flex-col items-end">
														<Tooltip>
															<TooltipTrigger asChild>
																<span tabIndex={0} className="text-[0.625rem] text-muted-foreground leading-tight border-b border-dotted border-muted-foreground/50 cursor-help outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm">Actual</span>
															</TooltipTrigger>
															<TooltipContent className="max-w-[250px] text-xs text-left" side="bottom">
																<p>Total weekly hours of direct classroom teaching from assigned class sessions.</p>
															</TooltipContent>
														</Tooltip>
														<span className={`text-sm font-black leading-none ${status === 'over-cap' ? 'text-red-600' : status === 'overload-allowed' ? 'text-amber-700' : ''}`}>
															{actualTeachingHours}<span className="text-[0.625rem] font-medium text-muted-foreground"> h</span>
														</span>
													</div>
													{equivalentHours > 0 && (
														<div className="flex flex-col items-end">
															<span className="text-[0.625rem] text-muted-foreground leading-tight">Equiv</span>
															<span className="text-sm font-bold leading-none text-sky-600">
																+{equivalentHours}<span className="text-[0.625rem] font-medium text-muted-foreground"> h</span>
															</span>
														</div>
													)}
													<div className="flex flex-col items-end">
														<Tooltip>
															<TooltipTrigger asChild>
																<span tabIndex={0} className="text-[0.625rem] text-muted-foreground leading-tight border-b border-dotted border-muted-foreground/50 cursor-help outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm">Credited</span>
															</TooltipTrigger>
															<TooltipContent className="max-w-[250px] text-xs text-left" side="bottom">
																<p>Actual Teaching Hours plus approved teaching-equivalent credits (e.g., class adviser equivalent load).</p>
															</TooltipContent>
														</Tooltip>
														<span className="text-sm font-bold leading-none">
															{creditedTotalHours}<span className="text-[0.625rem] font-medium text-muted-foreground"> h</span>
														</span>
													</div>
													{overloadHours > 0 && (
														<div className="flex flex-col items-end">
															<Tooltip>
																<TooltipTrigger asChild>
																	<span tabIndex={0} className="text-[0.625rem] text-muted-foreground leading-tight border-b border-dotted border-muted-foreground/50 cursor-help outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm">Overload</span>
																</TooltipTrigger>
																<TooltipContent className="max-w-[260px] text-xs text-left" side="bottom">
																	<p>Portion of Actual Teaching Hours beyond the 30-hour standard baseline. Overload is compensable up to policy limits.</p>
																	{overCapHours > 0 && (
																		<p className="mt-1.5 font-medium text-red-500">Values above 40 actual teaching hours are over-cap and should be flagged.</p>
																	)}
																</TooltipContent>
															</Tooltip>
															<span className={`text-sm font-bold leading-none ${overCapHours > 0 ? 'text-red-600' : 'text-amber-600'}`}>
																{overloadHours}<span className="text-[0.625rem] font-medium text-muted-foreground"> h</span>
															</span>
														</div>
													)}
												</div>

												{/* Status badge + info */}
												<div className="flex flex-col items-end gap-0.5">
													<Tooltip>
														<TooltipTrigger asChild>
															<Badge tabIndex={0} className={`text-[0.625rem] cursor-help outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 transition hover:bg-muted ${colors.bg} ${colors.text} ${colors.border}`}>
																{overCapHours > 0 && <AlertTriangle className="mr-1 size-3" />}
																{statusLabel}
															</Badge>
														</TooltipTrigger>
														<TooltipContent className="max-w-[220px] text-xs text-left" side="bottom">
															{status === 'below-standard' && <p>Below 30 credited hours; may be valid depending on designation and service needs.</p>}
															{(status === 'compliant' || status === 'overload-allowed') && <p>Within policy-compliant range.</p>}
															{status === 'over-cap' && <p>Exceeds maximum allowed actual teaching hours.</p>}
														</TooltipContent>
													</Tooltip>

													<Tooltip>
														<TooltipTrigger asChild>
																<span className="flex items-center gap-0.5 cursor-help">
																	<span className="text-[0.5625rem] text-muted-foreground">
																		{localAssignments.length} subj{sectionsAvailable === false ? ' · baseline' : ''}
																	</span>
																	<Info className="size-2.5 text-muted-foreground" />
																</span>
															</TooltipTrigger>
															<TooltipContent className="max-w-xs text-xs" side="bottom" align="end">
																<div className="space-y-1.5">
																	<div className="space-y-0.5">
																		<p className="font-semibold">DepEd Load Policy</p>
																		<p>Standard: {STANDARD_WEEKLY_TEACHING_HOURS}h/wk · Max: {MAX_WEEKLY_TEACHING_HOURS}h/wk</p>
																	</div>
																	{!sectionsAvailable && (
																		<p className="text-amber-600">Section demand unavailable — baseline estimate (1 section/grade).</p>
																	)}
																	{breakdown.length > 0 && (
																		<div className="space-y-0.5 border-t border-border pt-1">
																			<p className="font-semibold">Demand breakdown:</p>
																			{breakdown.map((b, i) => (
																				<p key={i} className="font-mono">
																					{b.subjectCode} G{b.grade}: {Math.round(b.minutesPerWeek / 60 * 10) / 10}h × {b.sections}s = {Math.round(b.totalMinutes / 60 * 10) / 10}h
																				</p>
																			))}
																		</div>
																	)}
																	{equivalentHours > 0 && (
																		<p className="border-t border-border pt-1">Class Adviser: +{CLASS_ADVISER_EQUIVALENT_HOURS}h equivalent</p>
																	)}
																</div>
															</TooltipContent>
														</Tooltip>
												</div>
											</TooltipProvider>
										);
									})()}
								</div>
							</div>

							{/* Subjects Lacking Faculty Warning */}
							{subjectsLackingFaculty.length > 0 && (
								<div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 shadow-sm">
									<div className="flex items-center gap-2 text-red-700">
										<AlertTriangle className="size-4" />
										<h4 className="text-xs font-semibold">Subjects Lacking Faculty</h4>
									</div>
									<p className="mt-1 text-[0.6875rem] text-red-700/80">
										{subjectsLackingFaculty.length} active subject(s) currently have no faculty assigned to them.
									</p>
									<div className="mt-2 flex flex-wrap gap-1">
										{subjectsLackingFaculty.map(s => (
											<Badge key={s.id} variant="outline" className="border-red-300 bg-white text-red-700 text-[0.625rem] px-1.5 py-0 hover:bg-red-50">
												{s.name}
											</Badge>
										))}
									</div>
								</div>
							)}

							{/* Scrollable subject assignments */}
							<Card className="shadow-sm mt-3 flex-1 min-h-0 flex flex-col overflow-hidden">
								<div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border bg-card shrink-0">
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
								<CardContent className="pt-3 flex-1 overflow-auto">
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
																{Math.round((sub.minMinutesPerWeek / 60) * 10) / 10} hrs/week
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
