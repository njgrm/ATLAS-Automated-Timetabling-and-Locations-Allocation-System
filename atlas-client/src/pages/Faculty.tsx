import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Filter,
	RefreshCw,
	Search,
	Users,
	X,
	ArrowUpDown,
	ArrowUp,
	ArrowDown
} from 'lucide-react';

import atlasApi from '@/lib/api';
import type { FacultySummary } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { FacultyRow } from '@/components/faculty/FacultyRow';
import { FacultyProfileSheet } from '@/components/faculty/FacultyProfileSheet';
import { toast } from 'sonner';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import type { SubjectSectionOwnershipIndexEntry } from '@/lib/faculty-assignment-helpers';
import {
	getCachedFacultyAssignmentsSummary,
	requestWithRetry,
	setCachedFacultyAssignmentsSummary,
} from '@/lib/faculty-teaching-load-cache';

const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50, 100];

type SortField = 'name' | 'specialization' | 'subjects' | 'weeklyLoad' | 'status';
type SortDir = 'asc' | 'desc';

export default function Faculty() {
	const [faculty, setFaculty] = useState<FacultySummary[]>([]);
	const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const [syncError, setSyncError] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [dataSource, setDataSource] = useState<'live' | 'cached' | 'none'>('none');
	const [cacheNotice, setCacheNotice] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(() => navigator.onLine);
	
	// Quick Profile
	const [profileTarget, setProfileTarget] = useState<FacultySummary | null>(null);

	const [showFilters, setShowFilters] = useState(false);

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

	const fetchFaculty = useCallback(async (options?: { forceRefresh?: boolean }) => {
		const forceRefresh = options?.forceRefresh === true;
		setLoading(true);
		setRefreshing(true);
		setError(null);

		let schoolYearId: number | null = null;
		try {
			const yearContext = await resolveActiveSchoolYearContext({ forceRefresh });
			schoolYearId = yearContext.activeSchoolYearId;

			if (!forceRefresh) {
				const cachedPreview = getCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId, {
					maxAgeMs: 3 * 60 * 1000,
				});
				if (cachedPreview) {
					setFaculty(cachedPreview.data.faculty);
					setLastSyncedAt(cachedPreview.data.fetchedAt);
					setDataSource('cached');
					setCacheNotice('Loading live teacher data. Displaying your last saved roster snapshot in the meantime.');
					setLoading(false);
				}
			}

			const { data } = await requestWithRetry(
				() =>
					atlasApi.get<{
						faculty: FacultySummary[];
						ownershipIndex?: SubjectSectionOwnershipIndexEntry[];
						fetchedAt: string | null;
					}>('/faculty-assignments/summary', {
						params: { schoolId: DEFAULT_SCHOOL_ID, schoolYearId },
					}),
				{ attempts: 2, delayMs: 400 },
			);

			setFaculty(data.faculty);
			setLastSyncedAt(data.fetchedAt);
			setCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId, {
				faculty: data.faculty,
				ownershipIndex: data.ownershipIndex ?? [],
				fetchedAt: data.fetchedAt,
				schoolYearId,
			});
			setDataSource('live');
			setCacheNotice(null);
			setSyncError(false);
			setError(null);
		} catch {
			const cachedFallback = schoolYearId
				? getCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId)
				: null;

			if (cachedFallback) {
				setFaculty(cachedFallback.data.faculty);
				setLastSyncedAt(cachedFallback.data.fetchedAt);
				setDataSource('cached');
				setSyncError(true);
				setError(null);
				setCacheNotice('Live teacher data is unavailable. Showing your last saved roster snapshot.');
			} else {
				setSyncError(true);
				setDataSource('none');
				setCacheNotice(null);
				setError('Failed to load teachers. Check EnrollPro bridge availability, then retry.');
			}
		} finally {
			setRefreshing(false);
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchFaculty();
	}, [fetchFaculty]);

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

	const handleSync = async () => {
		if (!isOnline) {
			toast.error('You are offline. Reconnect before syncing Teachers.');
			return;
		}
		setSyncing(true);
		setSyncError(false);
		try {
			const { data } = await atlasApi.post<{ synced: boolean; activeCount: number }>('/faculty/sync', {
				schoolId: DEFAULT_SCHOOL_ID,
			});
			if (data.synced) {
				toast.success(`Successfully synced roster (${data.activeCount} active faculty).`);
				await fetchFaculty({ forceRefresh: true });
			} else {
				setSyncError(true);
				toast.error('Sync completed but reported no changes or an error.');
			}
		} catch {
			setSyncError(true);
			toast.error('EnrollPro sync service is currently unreachable.');
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
					(f.department ?? '').toLowerCase().includes(q) ||
					(f.specialization ?? '').toLowerCase().includes(q),
			);
		}

		// Filters
		if (schedulingFilter === 'active') list = list.filter((f) => f.isActiveForScheduling);
		else if (schedulingFilter === 'excluded') list = list.filter((f) => !f.isActiveForScheduling);

		if (assignmentFilter === 'assigned') list = list.filter((f) => (f.subjectCount ?? 0) > 0);
		else if (assignmentFilter === 'unassigned') list = list.filter((f) => (f.subjectCount ?? 0) === 0);

		if (departmentFilter !== 'all') list = list.filter((f) => f.department === departmentFilter);

		// Sort
		const sorted = [...list].sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case 'name': cmp = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`); break;
				case 'specialization': cmp = (a.specialization ?? a.department ?? '').localeCompare(b.specialization ?? b.department ?? ''); break;
				case 'subjects': cmp = (a.subjectCount ?? 0) - (b.subjectCount ?? 0); break;
				case 'weeklyLoad': cmp = (a.policyCreditedHours ?? 0) - (b.policyCreditedHours ?? 0); break;
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
			{/* Primary Header & Toolbar */}
			<div className="shrink-0 px-6 py-4 border-b bg-background/50 backdrop-blur-md">
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="relative w-64">
							<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
							<Input
								placeholder="Search name or specialization..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9 h-9"
							/>
						</div>
						
						<Button
							variant={showFilters ? 'secondary' : 'outline'}
							size="sm"
							className="h-9 gap-2"
							onClick={() => setShowFilters(!showFilters)}
						>
							<Filter className="size-4" />
							Filters
							{hasActiveFilters && (
								<Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-primary text-primary-foreground font-bold">
									Active
								</Badge>
							)}
						</Button>
					</div>

					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2 mr-2">
							<Badge
								variant={dataSource === 'live' ? 'secondary' : 'outline'}
								className="h-6 px-2 text-[0.7rem] uppercase tracking-wide font-bold"
							>
								{dataSource === 'live'
									? 'Live data'
									: dataSource === 'cached'
									? 'Cached snapshot'
									: 'No cache'}
							</Badge>
							{timeSince && (
								<TooltipProvider delayDuration={500}>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="text-[0.7rem] text-muted-foreground font-semibold bg-muted px-2 py-1 rounded-md hidden lg:inline-block uppercase tracking-tight">
												Last synced: {timeSince}
											</span>
										</TooltipTrigger>
										<TooltipContent>Synced at {new Date(lastSyncedAt!).toLocaleString()}</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
						</div>
						
						<Button onClick={handleSync} disabled={syncing || !isOnline} size="sm" className="h-9 gap-2 shadow-sm font-bold">
							<RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
							{syncing ? 'Syncing...' : !isOnline ? 'Offline' : refreshing ? 'Refreshing...' : 'Sync Teachers'}
						</Button>
					</div>
				</div>

				{/* Expanded Filters */}
				{showFilters && (
					<div className="flex flex-wrap items-center gap-3 pt-4 animate-in slide-in-from-top-2 duration-200">
						<Select value={schedulingFilter} onValueChange={(v) => setSchedulingFilter(v as typeof schedulingFilter)}>
							<SelectTrigger className="h-8 w-40 text-xs bg-background">
								<SelectValue placeholder="All Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="excluded">Excluded in EnrollPro</SelectItem>
							</SelectContent>
						</Select>
						<Select value={assignmentFilter} onValueChange={(v) => setAssignmentFilter(v as typeof assignmentFilter)}>
							<SelectTrigger className="h-8 w-36 text-xs bg-background">
								<SelectValue placeholder="All Load Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Load Status</SelectItem>
								<SelectItem value="assigned">Has Load</SelectItem>
								<SelectItem value="unassigned">No Load</SelectItem>
							</SelectContent>
						</Select>
						{departments.length > 0 && (
							<Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v)}>
								<SelectTrigger className="h-8 w-40 text-xs bg-background">
									<SelectValue placeholder="All Departments" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Departments</SelectItem>
									{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
								</SelectContent>
							</Select>
						)}
						{hasActiveFilters && (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground font-semibold"
								onClick={() => { setSchedulingFilter('all'); setAssignmentFilter('all'); setDepartmentFilter('all'); }}
							>
								Reset all
							</Button>
						)}
					</div>
				)}
			</div>

			{/* Status Banners */}
			{syncError && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-sm animate-in fade-in duration-300">
					<AlertTriangle className="size-4 shrink-0 text-amber-600" />
					<span className="flex-1 font-semibold">{cacheNotice ?? 'EnrollPro bridge is currently unreachable. Cached roster data is unavailable.'}</span>
					<Button size="sm" variant="outline" onClick={() => fetchFaculty({ forceRefresh: true })} disabled={syncing} className="shrink-0 h-7 border-amber-300 hover:bg-amber-100 text-amber-900 font-bold">
						<RefreshCw className={`mr-1.5 size-3 ${syncing ? 'animate-spin' : ''}`} /> Retry Sync
					</Button>
				</div>
			)}

			{cacheNotice && !syncError && dataSource === 'cached' && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 shadow-sm animate-in fade-in duration-300">
					<AlertTriangle className="size-4 shrink-0 text-blue-600" />
					<span className="flex-1 font-semibold">{cacheNotice}</span>
				</div>
			)}

			{error && !syncError && (
				<div className="shrink-0 mx-6 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-900 flex items-center justify-between shadow-sm">
					<div className="flex items-center gap-2">
						<AlertTriangle className="size-4 shrink-0 text-red-600" />
						<span className="font-semibold">{error}</span>
					</div>
					<Button variant="ghost" size="sm" className="h-7 px-2 font-bold" onClick={() => setError(null)}>Dismiss</Button>
				</div>
			)}

			{/* Roster Table Container */}
			<div className="flex-1 min-h-0 px-6 py-4">
				<Card className="h-full flex flex-col shadow-sm border-border/50 overflow-hidden">
					<div className="flex-1 min-h-0 overflow-auto">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
								<tr className="border-b">
									<th className="px-4 py-3 text-left">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('name')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground">
											Name & Identity <SortIcon field="name" />
										</Button>
									</th>
									<th className="px-4 py-3 text-left">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('specialization')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground">
											Department <SortIcon field="specialization" />
										</Button>
									</th>
									<th className="px-4 py-3 text-center">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('subjects')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground mx-auto">
											Subjects <SortIcon field="subjects" />
										</Button>
									</th>
									<th className="px-4 py-3 text-center">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('weeklyLoad')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground mx-auto">
											Credited Load <SortIcon field="weeklyLoad" />
										</Button>
									</th>
									<th className="px-4 py-3 text-center">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('status')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground mx-auto">
											Status <SortIcon field="status" />
										</Button>
									</th>
									<th className="px-4 py-3 text-right font-semibold text-muted-foreground uppercase tracking-wider text-[0.7rem]">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/40">
								{loading ? (
									Array.from({ length: 8 }).map((_, i) => (
										<tr key={i}>
											<td className="px-4 py-4"><Skeleton className="h-5 w-48" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-32" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-12 mx-auto" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-16 mx-auto" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-10 mx-auto" /></td>
											<td className="px-4 py-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
										</tr>
									))
								) : paged.length === 0 ? (
									<tr>
										<td colSpan={6} className="px-4 py-20 text-center">
											<div className="flex flex-col items-center gap-4 text-muted-foreground max-w-xs mx-auto">
												<Users className="size-12 opacity-20" />
												<div className="space-y-1">
													<p className="font-bold text-foreground">
														{faculty.length === 0 ? 'No teachers found.' : 'No matches found.'}
													</p>
													<p className="text-xs">
														{faculty.length === 0 
															? 'Ensure the EnrollPro bridge is active and sync your roster to begin scheduling.'
															: 'Try adjusting your filters or search query to find who you are looking for.'}
													</p>
												</div>
												{faculty.length === 0 && (
													<Button size="sm" onClick={handleSync} disabled={syncing} className="font-bold shadow-sm">
														<RefreshCw className={`mr-2 size-4 ${syncing ? 'animate-spin' : ''}`} />
														Sync from EnrollPro
													</Button>
												)}
											</div>
										</td>
									</tr>
								) : (
									paged.map((f) => (
										<FacultyRow 
											key={f.id} 
											faculty={f} 
											onViewProfile={(target) => setProfileTarget(target)}
										/>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* Pagination Footer */}
					{!loading && faculty.length > 0 && (
						<div className="shrink-0 flex items-center justify-between border-t border-border/50 px-4 py-3 bg-muted/20">
							<div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
								<span>
									{totalFiltered === 0
										? 'No results'
										: `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalFiltered)} of ${totalFiltered} results`}
								</span>
								
								<div className="flex items-center gap-2 border-l pl-4 border-border/50">
									<span>Rows per page:</span>
									<Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
										<SelectTrigger className="h-7 w-20 text-xs bg-background">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
										</SelectContent>
									</Select>
								</div>
							</div>
							
							<div className="flex items-center gap-1.5">
								<Button 
									variant="outline" 
									size="icon" 
									className="h-8 w-8" 
									onClick={() => setPage(1)} 
									disabled={page <= 1}
								>
									<ChevronsLeft className="size-4" />
								</Button>
								<Button 
									variant="outline" 
									size="icon" 
									className="h-8 w-8" 
									onClick={() => setPage((p) => Math.max(1, p - 1))} 
									disabled={page <= 1}
								>
									<ChevronLeft className="size-4" />
								</Button>
								<div className="flex items-center gap-1.5 px-3 h-8 rounded-md border bg-background text-[0.7rem] font-bold tabular-nums">
									<span>{page}</span>
									<span className="text-muted-foreground/50 font-normal">/</span>
									<span className="text-muted-foreground font-normal">{totalPages}</span>
								</div>
								<Button 
									variant="outline" 
									size="icon" 
									className="h-8 w-8" 
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
									disabled={page >= totalPages}
								>
									<ChevronRight className="size-4" />
								</Button>
								<Button 
									variant="outline" 
									size="icon" 
									className="h-8 w-8" 
									onClick={() => setPage(totalPages)} 
									disabled={page >= totalPages}
								>
									<ChevronsRight className="size-4" />
								</Button>
							</div>
						</div>
					)}
				</Card>
			</div>

			{/* Quick Profile Side Drawer */}
			<FacultyProfileSheet 
				faculty={profileTarget}
				open={profileTarget !== null}
				onOpenChange={(open) => !open && setProfileTarget(null)}
			/>
		</div>
	);
}
