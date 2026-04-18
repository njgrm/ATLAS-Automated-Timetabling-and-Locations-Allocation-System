import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	ClipboardList,
	RefreshCw,
	Search,
	Users,
	X,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import type { FacultyMirror } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50];

type SortField = 'name' | 'department' | 'subjects' | 'weeklyLoad' | 'status';
type SortDir = 'asc' | 'desc';

export default function Faculty() {
	const [faculty, setFaculty] = useState<FacultyMirror[]>([]);
	const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [syncing, setSyncing] = useState(false);
	const [syncError, setSyncError] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [error, setError] = useState<string | null>(null);

	// Sorting
	const [sortField, setSortField] = useState<SortField>('name');
	const [sortDir, setSortDir] = useState<SortDir>('asc');

	// Pagination
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	// Filters
	const [schedulingFilter, setSchedulingFilter] = useState<'all' | 'active' | 'excluded'>('all');
	const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
	const [departmentFilter, setDepartmentFilter] = useState<string>('all');

	const fetchFaculty = useCallback(async () => {
		setLoading(true);
		try {
			const { data } = await atlasApi.get<{ faculty: FacultyMirror[]; lastSyncedAt: string | null }>('/faculty', {
				params: { schoolId: DEFAULT_SCHOOL_ID },
			});
			setFaculty(data.faculty);
			setLastSyncedAt(data.lastSyncedAt);
			setSyncError(false);
			setError(null);
		} catch {
			setSyncError(true);
			setError('Failed to load faculty data.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchFaculty();
	}, [fetchFaculty]);

	const handleSync = async () => {
		setSyncing(true);
		setSyncError(false);
		try {
			const { data } = await atlasApi.post<{ synced: boolean; count: number }>('/faculty/sync', {
				schoolId: DEFAULT_SCHOOL_ID,
			});
			if (data.synced) {
				await fetchFaculty();
			} else {
				setSyncError(true);
			}
		} catch {
			setSyncError(true);
		} finally {
			setSyncing(false);
		}
	};

	// Unique departments for filter
	const departments = useMemo(() => {
		const set = new Set<string>();
		faculty.forEach((f) => { if (f.department) set.add(f.department); });
		return Array.from(set).sort();
	}, [faculty]);

	const timeSince = useMemo(() => {
		if (!lastSyncedAt) return null;
		const diff = Date.now() - new Date(lastSyncedAt).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
		const hours = Math.floor(mins / 60);
		return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
	}, [lastSyncedAt]);

	// Filtered, sorted, paginated
	const { paged, totalFiltered, totalPages } = useMemo(() => {
		let list = faculty;

		// Search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(f) =>
					f.firstName.toLowerCase().includes(q) ||
					f.lastName.toLowerCase().includes(q) ||
					(f.department ?? '').toLowerCase().includes(q),
			);
		}

		// Filters
		if (schedulingFilter === 'active') list = list.filter((f) => f.isActiveForScheduling);
		else if (schedulingFilter === 'excluded') list = list.filter((f) => !f.isActiveForScheduling);

		if (assignmentFilter === 'assigned') list = list.filter((f) => (f.facultySubjects?.length ?? 0) > 0);
		else if (assignmentFilter === 'unassigned') list = list.filter((f) => (f.facultySubjects?.length ?? 0) === 0);

		if (departmentFilter !== 'all') list = list.filter((f) => f.department === departmentFilter);

		// Sort
		const sorted = [...list].sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case 'name': cmp = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`); break;
				case 'department': cmp = (a.department ?? '').localeCompare(b.department ?? ''); break;
				case 'subjects': cmp = (a.facultySubjects?.length ?? 0) - (b.facultySubjects?.length ?? 0); break;
				case 'weeklyLoad': {
					const aMin = (a.facultySubjects ?? []).reduce((s, fs) => s + (fs.subject?.minMinutesPerWeek ?? 0) * fs.gradeLevels.length, 0);
					const bMin = (b.facultySubjects ?? []).reduce((s, fs) => s + (fs.subject?.minMinutesPerWeek ?? 0) * fs.gradeLevels.length, 0);
					cmp = aMin - bMin;
					break;
				}
				case 'status': cmp = Number(a.isActiveForScheduling) - Number(b.isActiveForScheduling); break;
			}
			return sortDir === 'desc' ? -cmp : cmp;
		});

		const tf = sorted.length;
		const tp = Math.max(1, Math.ceil(tf / pageSize));
		const start = (page - 1) * pageSize;
		return { paged: sorted.slice(start, start + pageSize), totalFiltered: tf, totalPages: tp };
	}, [faculty, searchQuery, schedulingFilter, assignmentFilter, departmentFilter, sortField, sortDir, page, pageSize]);

	// Reset page when filters change
	useEffect(() => { setPage(1); }, [searchQuery, schedulingFilter, assignmentFilter, departmentFilter, pageSize]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else { setSortField(field); setSortDir('asc'); }
	};

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) return <ArrowUpDown className="size-3 text-muted-foreground/50" />;
		return sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
	};

	const hasActiveFilters = schedulingFilter !== 'all' || assignmentFilter !== 'all' || departmentFilter !== 'all';

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)]">
			{/* Compact toolbar */}
			<div className="shrink-0 px-6 pt-3 pb-2">
				<div className="flex items-center gap-2">
					<div className="relative flex-1 max-w-sm">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
						<Input
							placeholder="Search by name or department..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 h-8 text-sm"
						/>
					</div>
					<Select value={schedulingFilter} onValueChange={(v) => setSchedulingFilter(v as typeof schedulingFilter)}>
						<SelectTrigger className="h-8 w-32.5 text-xs">
							<SelectValue placeholder="All Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="excluded">Excluded</SelectItem>
						</SelectContent>
					</Select>
					<Select value={assignmentFilter} onValueChange={(v) => setAssignmentFilter(v as typeof assignmentFilter)}>
						<SelectTrigger className="h-8 w-35 text-xs">
							<SelectValue placeholder="All Assignments" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Assignments</SelectItem>
							<SelectItem value="assigned">Has Subjects</SelectItem>
							<SelectItem value="unassigned">No Subjects</SelectItem>
						</SelectContent>
					</Select>
					{departments.length > 0 && (
						<Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v)}>
							<SelectTrigger className="h-8 w-35 text-xs">
								<SelectValue placeholder="All Depts" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Depts</SelectItem>
								{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
							</SelectContent>
						</Select>
					)}
					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							className="h-8 px-2 text-xs"
							onClick={() => { setSchedulingFilter('all'); setAssignmentFilter('all'); setDepartmentFilter('all'); }}
						>
							<X className="size-3 mr-1" /> Clear
						</Button>
					)}
					<div className="flex-1" />
					{timeSince && (
						<span className="text-[0.6875rem] text-muted-foreground shrink-0">
							Synced: {timeSince}
						</span>
					)}
					<Button onClick={handleSync} disabled={syncing} size="sm" variant="outline" className="h-8">
						<RefreshCw className={`mr-1 size-3.5 ${syncing ? 'animate-spin' : ''}`} />
						{syncing ? 'Syncing...' : 'Sync'}
					</Button>
				</div>
			</div>

			{/* Banners */}
			{syncError && (
				<div className="shrink-0 mx-6 mb-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
					<AlertTriangle className="size-4 shrink-0" />
					<span className="flex-1">EnrollPro bridge unreachable. Showing cached data.</span>
					<Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="shrink-0 h-7">
						<RefreshCw className={`mr-1 size-3 ${syncing ? 'animate-spin' : ''}`} /> Retry
					</Button>
				</div>
			)}

			{error && !syncError && (
				<div className="shrink-0 mx-6 mb-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
					{error}
					<button className="ml-2 font-semibold" onClick={() => setError(null)}>Dismiss</button>
				</div>
			)}

			{/* Table — component-level scrolling */}
			<div className="flex-1 min-h-0 px-6 pb-4">
				<Card className="h-full flex flex-col shadow-sm overflow-hidden">
					<div className="flex-1 min-h-0 overflow-auto">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
								<tr className="border-b">
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('name')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Name <SortIcon field="name" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('department')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Department <SortIcon field="department" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Contact</th>
									<th className="px-4 py-2.5 text-center">
										<button onClick={() => toggleSort('subjects')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground mx-auto">
											Subjects <SortIcon field="subjects" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-center">
										<button onClick={() => toggleSort('weeklyLoad')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground mx-auto">
											Weekly Load <SortIcon field="weeklyLoad" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-center font-semibold text-muted-foreground">Preferences</th>
									<th className="px-4 py-2.5 text-center">
										<button onClick={() => toggleSort('status')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground mx-auto">
											Status <SortIcon field="status" />
										</button>
									</th>										<th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Actions</th>								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr>
											<td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
											Loading faculty...
										</td>
									</tr>
								) : paged.length === 0 ? (
									<tr>
											<td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
											{faculty.length === 0 ? (
												<div className="flex flex-col items-center gap-2">
													<Users className="size-8 text-muted-foreground/50" />
													<p>No faculty synced yet.</p>
													<Button size="sm" onClick={handleSync} disabled={syncing}>
														<RefreshCw className="mr-1.5 size-3.5" /> Sync from EnrollPro
													</Button>
												</div>
											) : (
												'No faculty match your filters.'
											)}
										</td>
									</tr>
								) : (
									paged.map((f) => {
										const subjectCount = f.facultySubjects?.length ?? 0;
										const weeklyMinutes = (f.facultySubjects ?? []).reduce(
											(sum, fs) => sum + (fs.subject?.minMinutesPerWeek ?? 0) * fs.gradeLevels.length, 0,
										);
										const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;
										const maxHours = f.maxHoursPerWeek;
										const loadColor =
											weeklyHours === 0 ? 'text-muted-foreground'
											: weeklyHours > maxHours ? 'text-red-600'
											: weeklyHours >= maxHours * 0.85 ? 'text-amber-600'
											: 'text-emerald-600';

										return (
											<tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
												<td className="px-4 py-3">
													<div className="flex items-center gap-3">
														<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
															{f.firstName[0]}{f.lastName[0]}
														</div>
														<div>
															<p className="font-medium">{f.lastName}, {f.firstName}</p>
															<p className="text-[0.6875rem] text-muted-foreground">ID: {f.externalId}</p>
														</div>
													</div>
												</td>
												<td className="px-4 py-3 text-muted-foreground">{f.department ?? '—'}</td>
												<td className="px-4 py-3 text-muted-foreground text-[0.8125rem]">{f.contactInfo ?? '—'}</td>
												<td className="px-4 py-3 text-center">
													{subjectCount > 0 ? (
														<Badge className="bg-blue-100 text-blue-700 text-[0.6rem]">{subjectCount}</Badge>
													) : (
														<Badge variant="secondary" className="text-[0.6rem]">0</Badge>
													)}
												</td>
												<td className="px-4 py-3 text-center">
													<span className={`font-medium ${loadColor}`}>
														{weeklyHours > 0 ? `${weeklyHours}h` : '—'}
													</span>
													<span className="text-muted-foreground text-[0.6875rem]"> / {maxHours}h</span>
												</td>
												<td className="px-4 py-3 text-center">
													<span className="text-muted-foreground">—</span>
												</td>
												<td className="px-4 py-3 text-center">
													{f.isActiveForScheduling ? (
														<CheckCircle2 className="mx-auto size-4 text-emerald-500" />
													) : (
														<Badge variant="secondary" className="text-[0.6rem]">Excluded</Badge>
													)}
												</td>													<td className="px-4 py-3 text-right">
														<Link to={`/assignments?facultyId=${f.id}`}>
															<Button variant="outline" size="sm" className="h-7 text-xs gap-1">
																<ClipboardList className="size-3" />
																Teaching Load
															</Button>
														</Link>
													</td>											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>

					{/* Pagination */}
					{!loading && faculty.length > 0 && (
						<div className="shrink-0 flex items-center justify-between border-t border-border px-4 py-2 text-sm">
							<div className="flex items-center gap-2 text-muted-foreground text-xs">
								<span>{totalFiltered} result{totalFiltered !== 1 ? 's' : ''}</span>
								<span>·</span>
								<span>{faculty.filter((f) => f.isActiveForScheduling).length} active</span>
								<span>·</span>
								<Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
									<SelectTrigger className="h-7 w-22.5 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>)}
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-center gap-1">
								<Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
									<ChevronLeft className="size-3.5" />
								</Button>
								<span className="px-2 text-xs tabular-nums">{page} / {totalPages}</span>
								<Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
									<ChevronRight className="size-3.5" />
								</Button>
							</div>
						</div>
					)}
				</Card>
			</div>
		</div>
	);
}
