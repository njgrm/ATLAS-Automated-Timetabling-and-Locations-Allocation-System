import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	BookOpenCheck,
	Eye,
	RefreshCw,
	Users,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import type { FacultySummary } from '@/types';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import {
	AdminSearchFilterToolbar,
	AdminWorkspaceFrame,
	type AdminSourceState,
} from '@/components/admin-workspace/AdminWorkspace';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin-workspace/AdminDataTable';
import {
	FacultyDepartmentCell,
	FacultyIdentityCell,
	FacultyLoadStateBadge,
	FacultyMobileCard,
	FacultyTeachingLoadCell,
	FacultyWeeklyLoadCell,
} from '@/components/faculty/FacultyRow';
import { FacultyProfileSheet } from '@/components/faculty/FacultyProfileSheet';
import { toast } from 'sonner';
import {
	promoteActiveSchoolYearContext,
	resolveActiveSchoolYearContext,
	type ActiveSchoolYearContextSource,
	isUpstreamBackedSchoolYearSource,
} from '@/lib/enrollpro-public-settings';
import {
	getFacultyLoadSortRank,
	STANDARD_WEEKLY_TEACHING_HOURS,
	type SubjectSectionOwnershipIndexEntry,
} from '@/lib/faculty-assignment-helpers';
import {
	getCachedFacultyAssignmentsSummary,
	requestWithRetry,
	setCachedFacultyAssignmentsSummary,
} from '@/lib/faculty-teaching-load-cache';

const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50, 100];

type SortField = 'name' | 'specialization' | 'subjects' | 'weeklyLoad' | 'status';
type SortDir = 'asc' | 'desc';
type TeacherRosterStats = {
	totalCount: number;
	activeCount: number;
	assignedCount: number;
	unassignedCount: number;
	reviewCount: number;
	overCapCount: number;
};
type TeacherSummaryPage = {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
	query: string;
};
type TeacherSummaryResponse = {
	faculty: FacultySummary[];
	items?: FacultySummary[];
	page?: number;
	pageSize?: number;
	total?: number;
	totalPages?: number;
	query?: string;
	pagination?: TeacherSummaryPage;
	departments?: string[];
	rosterStats?: TeacherRosterStats;
	ownershipIndex?: SubjectSectionOwnershipIndexEntry[];
	fetchedAt: string | null;
};

export default function Faculty() {
	const [faculty, setFaculty] = useState<FacultySummary[]>([]);
	const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const [syncError, setSyncError] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [dataSource, setDataSource] = useState<'live' | 'cached' | 'refreshing' | 'none'>('none');
	const [cacheNotice, setCacheNotice] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(() => navigator.onLine);
	const [serverPagination, setServerPagination] = useState<TeacherSummaryPage | null>(null);
	const [serverDepartments, setServerDepartments] = useState<string[]>([]);
	const [rosterStats, setRosterStats] = useState<TeacherRosterStats | null>(null);
	
	// Roster profile drawer
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
		let yearContextSource: ActiveSchoolYearContextSource = 'cache';
		try {
			const yearContext = await resolveActiveSchoolYearContext({
				// SWR: always return cached school-year immediately if available;
				// background re-verification happens automatically when stale.
				preferCache: !forceRefresh,
				backgroundRefresh: !forceRefresh,
				allowEnrollProFallback: false,
			});
			schoolYearId = yearContext.activeSchoolYearId;
			yearContextSource = yearContext.source;

			if (!forceRefresh) {
				const cachedPreview = getCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId, {
					maxAgeMs: 3 * 60 * 1000,
				});
				if (cachedPreview) {
					setFaculty(cachedPreview.data.faculty);
					setLastSyncedAt(cachedPreview.data.fetchedAt);
					setServerPagination(null);
					setServerDepartments([]);
					setRosterStats(null);
					setDataSource(isOnline ? 'refreshing' : 'cached');
					setCacheNotice(
						isOnline
							? 'Checking the live teacher roster. The last saved roster stays visible while ATLAS verifies it.'
							: 'Offline mode: showing the last saved teacher roster.',
					);
					setLoading(false);
				}
			}

			const { data } = await requestWithRetry(
				() =>
					atlasApi.get<TeacherSummaryResponse>('/faculty-assignments/summary', {
						params: {
							schoolId: DEFAULT_SCHOOL_ID,
							schoolYearId,
							page,
							pageSize,
							query: searchQuery.trim() || undefined,
							scheduling: schedulingFilter,
							assignment: assignmentFilter,
							department: departmentFilter !== 'all' ? departmentFilter : undefined,
							sortField,
							sortDir,
						},
					}),
				{ attempts: 2, delayMs: 400 },
			);

			const liveRows = data.items ?? data.faculty;
			const pagination = data.pagination ?? (
				typeof data.page === 'number' && typeof data.pageSize === 'number' && typeof data.total === 'number' && typeof data.totalPages === 'number'
					? {
						page: data.page,
						pageSize: data.pageSize,
						total: data.total,
						totalPages: data.totalPages,
						query: data.query ?? searchQuery.trim(),
					}
					: null
			);

			setFaculty(liveRows);
			setLastSyncedAt(data.fetchedAt);
			setServerPagination(pagination);
			setServerDepartments(data.departments ?? []);
			setRosterStats(data.rosterStats ?? null);
			if (!data.items) {
				setCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId, {
					faculty: data.faculty,
					ownershipIndex: data.ownershipIndex ?? [],
					fetchedAt: data.fetchedAt,
					schoolYearId,
				});
			}
			const isUpstreamBacked = isUpstreamBackedSchoolYearSource(yearContextSource);
			if (isUpstreamBacked) {
				setDataSource('live');
				setCacheNotice(null);
			} else if (!isOnline) {
				setDataSource('cached');
				setCacheNotice('Teacher roster is available from the last saved ATLAS snapshot while upstream verification is unavailable.');
			} else {
				setDataSource('refreshing');
				setCacheNotice('Checking EnrollPro before finalizing teacher roster status.');
				void promoteActiveSchoolYearContext({ allowEnrollProFallback: false, allowStaleOnError: true })
					.then((promotedContext) => {
						if (isUpstreamBackedSchoolYearSource(promotedContext.source)) {
							setDataSource('live');
							setCacheNotice(null);
							return;
						}
						setDataSource('cached');
						setCacheNotice('Teacher roster is available from the last saved ATLAS snapshot while upstream verification is unavailable.');
					})
					.catch(() => {
						setDataSource('cached');
						setCacheNotice('Teacher roster is available from the last saved ATLAS snapshot while upstream verification is unavailable.');
					});
			}
			setSyncError(false);
			setError(null);
		} catch {
			const cachedFallback = schoolYearId
				? getCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId)
				: null;

			if (cachedFallback) {
				setFaculty(cachedFallback.data.faculty);
				setLastSyncedAt(cachedFallback.data.fetchedAt);
				setServerPagination(null);
				setServerDepartments([]);
				setRosterStats(null);
				setDataSource('cached');
				setSyncError(true);
				setError(null);
				setCacheNotice('Live teacher data is unavailable. Showing your last saved roster snapshot.');
			} else {
				setSyncError(true);
				setDataSource('none');
				setCacheNotice(null);
				setError('ATLAS could not load the teacher roster. Reconnect, then sync from EnrollPro.');
			}
		} finally {
			setRefreshing(false);
			setLoading(false);
		}
	}, [assignmentFilter, departmentFilter, isOnline, page, pageSize, schedulingFilter, searchQuery, sortDir, sortField]);

	useEffect(() => {
		void fetchFaculty({});
	}, [fetchFaculty]);

	useEffect(() => {
		const handleOnline = () => {
			setIsOnline(true);
			void fetchFaculty({ forceRefresh: true });
		};
		const handleOffline = () => setIsOnline(false);

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, [fetchFaculty]);

	const handleSync = async () => {
		if (!isOnline) {
			toast.error('You are offline. Reconnect before refreshing the teacher roster.');
			return;
		}
		setSyncing(true);
		setSyncError(false);
		try {
			const { data } = await atlasApi.post<{ synced: boolean; activeCount: number }>('/faculty/sync', {
				schoolId: DEFAULT_SCHOOL_ID,
			});
			if (data.synced) {
				toast.success(`Teacher roster refreshed (${data.activeCount} active teachers).`);
				await fetchFaculty({ forceRefresh: true });
			} else {
				setSyncError(true);
				toast.error('Teacher roster refresh finished without a confirmed update.');
			}
		} catch {
			setSyncError(true);
			toast.error('ATLAS could not reach EnrollPro. Try refreshing the roster again.');
		} finally {
			setSyncing(false);
		}
	};

	// Unique departments for filter
	const departments = useMemo(() => {
		if (serverDepartments.length > 0) return serverDepartments;
		const set = new Set<string>();
		faculty.forEach((f) => { if (f.department) set.add(f.department); });
		return Array.from(set).sort();
	}, [faculty, serverDepartments]);

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
		if (serverPagination) {
			return {
				paged: faculty,
				totalFiltered: serverPagination.total,
				totalPages: serverPagination.totalPages,
			};
		}

		let list = faculty;
		const compareTeacherName = (left: FacultySummary, right: FacultySummary) => `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`);

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
		const sorted = [...list].sort((left, right) => {
			let cmp = 0;
			switch (sortField) {
				case 'name': cmp = compareTeacherName(left, right); break;
				case 'specialization': cmp = (left.specialization ?? left.department ?? '').localeCompare(right.specialization ?? right.department ?? ''); break;
				case 'subjects': cmp = (left.subjectCount ?? 0) - (right.subjectCount ?? 0); break;
				case 'weeklyLoad': cmp = (left.policyCreditedHours ?? 0) - (right.policyCreditedHours ?? 0); break;
				case 'status': cmp = getFacultyLoadSortRank(left) - getFacultyLoadSortRank(right); break;
			}
			if (cmp === 0 && sortField !== 'name') cmp = compareTeacherName(left, right);
			return sortDir === 'desc' ? -cmp : cmp;
		});

		const tf = sorted.length;
		const tp = Math.max(1, Math.ceil(tf / pageSize));
		const start = (page - 1) * pageSize;
		return { paged: sorted.slice(start, start + pageSize), totalFiltered: tf, totalPages: tp };
	}, [faculty, serverPagination, searchQuery, schedulingFilter, assignmentFilter, departmentFilter, sortField, sortDir, page, pageSize]);

	// Reset page when filters change
	useEffect(() => { setPage(1); }, [searchQuery, schedulingFilter, assignmentFilter, departmentFilter, pageSize, sortField, sortDir]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else { setSortField(field); setSortDir('asc'); }
	};

	const tablePage = serverPagination?.page ?? page;
	const tablePageSize = serverPagination?.pageSize ?? pageSize;
	const hasActiveFilters = schedulingFilter !== 'all' || assignmentFilter !== 'all' || departmentFilter !== 'all';

	const teacherColumns = useMemo<AdminDataTableColumn<FacultySummary, SortField>[]>(() => [
		{
			id: 'teacher',
			label: 'Teacher',
			description: 'Name, adviser role, and roster ID.',
			sortKey: 'name',
			cellClassName: 'min-w-60',
			render: (teacher) => <FacultyIdentityCell faculty={teacher} />,
		},
		{
			id: 'department',
			label: 'Department',
			description: 'Department, specialization, and source state.',
			sortKey: 'specialization',
			cellClassName: 'min-w-52',
			render: (teacher) => <FacultyDepartmentCell faculty={teacher} />,
		},
		{
			id: 'teachingLoad',
			label: 'Teaching Load',
			description: 'Subjects and section coverage.',
			sortKey: 'subjects',
			headerClassName: 'text-center',
			cellClassName: 'text-center',
			render: (teacher) => <FacultyTeachingLoadCell faculty={teacher} />,
		},
		{
			id: 'weeklyLoad',
			label: 'Credited Workload',
			description: 'Teaching plus approved credits.',
			sortKey: 'weeklyLoad',
			headerClassName: 'text-center',
			cellClassName: 'text-center',
			render: (teacher) => <FacultyWeeklyLoadCell faculty={teacher} />,
		},
		{
			id: 'loadState',
			label: 'Load State',
			description: 'Readiness against the 30h standard and cap.',
			sortKey: 'status',
			headerClassName: 'text-center',
			cellClassName: 'text-center',
			render: (teacher) => <FacultyLoadStateBadge faculty={teacher} />,
		},
	], []);

	const teacherSourceState = useMemo<AdminSourceState>(() => {
		if (dataSource === 'live') return 'verified-live';
		if (dataSource === 'refreshing' || loading || refreshing) return 'checking-source';
		if (dataSource === 'cached') return 'saved-data';
		return 'no-saved-data';
	}, [dataSource, loading, refreshing]);

	const teacherStats = useMemo(() => {
		const activeCount = rosterStats?.activeCount ?? faculty.filter((teacher) => teacher.isActiveForScheduling).length;
		const assignedCount = rosterStats?.assignedCount ?? faculty.filter((teacher) => (teacher.subjectCount ?? 0) > 0).length;
		const unassignedCount = rosterStats?.unassignedCount ?? faculty.filter((teacher) => teacher.isActiveForScheduling && (teacher.subjectCount ?? 0) === 0).length;
		const reviewCount = rosterStats?.reviewCount ?? faculty.filter((teacher) => {
			const creditedHours = teacher.policyCreditedHours ?? 0;
			return teacher.isActiveForScheduling && creditedHours > STANDARD_WEEKLY_TEACHING_HOURS && creditedHours <= teacher.maxHoursPerWeek;
		}).length;
		const overCapCount = rosterStats?.overCapCount ?? faculty.filter((teacher) => teacher.isActiveForScheduling && (teacher.policyCreditedHours ?? 0) > teacher.maxHoursPerWeek).length;
		return [
			{ label: 'Active teachers', value: activeCount, tone: activeCount > 0 ? 'success' as const : 'warning' as const, helpText: 'Teachers currently available for scheduling.' },
			{ label: 'With load', value: assignedCount, tone: assignedCount > 0 ? 'info' as const : 'warning' as const, helpText: 'Teachers with at least one subject or section in Teaching Load.' },
			{ label: 'Without load', value: unassignedCount, tone: unassignedCount > 0 ? 'warning' as const : 'success' as const, helpText: 'Active teachers with no teaching load yet.' },
			{ label: 'Approval review', value: reviewCount, tone: reviewCount > 0 ? 'warning' as const : 'success' as const, helpText: `Active teachers above the ${STANDARD_WEEKLY_TEACHING_HOURS}h standard and still within their cap.` },
			{ label: 'Over cap', value: overCapCount, tone: overCapCount > 0 ? 'warning' as const : 'success' as const, helpText: 'Active teachers above the weekly cap. Repair these before generation.' },
			{ label: 'Last sync', value: timeSince ?? 'Not synced', tone: timeSince ? 'neutral' as const : 'warning' as const, helpText: 'When ATLAS last refreshed the teacher load summary.' },
		];
	}, [faculty, rosterStats, timeSince]);

	const profileSourceLabel = useMemo(() => {
		if (teacherSourceState === 'verified-live') return timeSince ? `Verified live - ${timeSince}` : 'Verified live';
		if (teacherSourceState === 'checking-source') return 'Checking source';
		if (teacherSourceState === 'saved-data') return timeSince ? `Using saved data - ${timeSince}` : 'Using saved data';
		return 'No saved data';
	}, [teacherSourceState, timeSince]);

	return (
		<AdminWorkspaceFrame
			title = "Teachers"
			description="Review the teacher roster and scheduling load before assigning classes."
			sourceState={teacherSourceState}
			sourceCopy={{
				description:
					teacherSourceState === 'verified-live'
						? 'Teacher roster and load summary were checked against EnrollPro for the current school year.'
						: teacherSourceState === 'checking-source'
						? 'ATLAS is checking EnrollPro while the saved teacher roster stays visible.'
						: teacherSourceState === 'saved-data'
						? 'ATLAS is showing the last safe teacher roster snapshot.'
						: 'ATLAS has no safe teacher roster snapshot to show yet.',
				nextAction:
					teacherSourceState === 'verified-live'
						? 'Review load readiness or sync if you expect roster changes.'
						: teacherSourceState === 'checking-source'
						? 'Keep reviewing the list, but wait before treating the status as final.'
						: teacherSourceState === 'saved-data'
						? 'Reconnect or sync before relying on this roster for final setup.'
						: 'Reconnect and sync teachers before this page can be used.',
			}}
			stats={teacherStats}
			primaryActions={(
				<Button onClick={handleSync} disabled={syncing || !isOnline} size="sm" className="h-9 gap-2 bg-primary text-primary-foreground shadow-primary-glow hover:bg-primary/90 font-bold">
					<RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
					{syncing ? 'Refreshing...' : !isOnline ? 'Offline' : refreshing ? 'Checking...' : 'Refresh teacher roster'}
				</Button>
			)}
			toolbar={(
				<AdminSearchFilterToolbar
					searchValue={searchQuery}
					onSearchChange={setSearchQuery}
					searchPlaceholder="Search teacher, department, or specialization..."
					filtersOpen={showFilters}
					onToggleFilters={() => setShowFilters(!showFilters)}
					hasActiveFilters={hasActiveFilters}
				>
						<Select value={schedulingFilter} onValueChange={(v) => setSchedulingFilter(v as typeof schedulingFilter)}>
							<SelectTrigger className="h-8 w-40 text-xs bg-background">
								<SelectValue placeholder="All roster states" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All roster states</SelectItem>
								<SelectItem value="active">Active teachers</SelectItem>
								<SelectItem value="excluded">Excluded teachers</SelectItem>
							</SelectContent>
						</Select>
						<Select value={assignmentFilter} onValueChange={(v) => setAssignmentFilter(v as typeof assignmentFilter)}>
							<SelectTrigger className="h-8 w-36 text-xs bg-background">
								<SelectValue placeholder="All load states" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All load states</SelectItem>
								<SelectItem value="assigned">With teaching load</SelectItem>
								<SelectItem value="unassigned">No teaching load</SelectItem>
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
				</AdminSearchFilterToolbar>
			)}
		>

			{/* Status Banners */}
			{syncError && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-sm animate-in fade-in duration-300">
					<AlertTriangle className="size-4 shrink-0 text-amber-600" />
					<span className="flex-1 font-semibold">{cacheNotice ?? 'ATLAS could not refresh the teacher roster. The last saved roster is still shown.'}</span>
					<Button size="sm" variant="outline" onClick={() => fetchFaculty({ forceRefresh: true })} disabled={syncing} className="shrink-0 h-7 border-amber-300 hover:bg-amber-100 text-amber-900 font-bold">
						<RefreshCw className={`mr-1.5 size-3 ${syncing ? 'animate-spin' : ''}`} /> Retry refresh
					</Button>
				</div>
			)}

			{cacheNotice && !syncError && (dataSource === 'cached' || dataSource === 'refreshing') && (
				<div className={`shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm shadow-sm animate-in fade-in duration-300 ${
					dataSource === 'refreshing'
						? 'border border-blue-200 bg-blue-50 text-blue-900'
						: 'border border-amber-200 bg-amber-50 text-amber-900'
				}`}>
					<AlertTriangle className={`size-4 shrink-0 ${dataSource === 'refreshing' ? 'text-blue-600' : 'text-amber-600'}`} />
					<span className={`flex-1 font-semibold ${dataSource === 'refreshing' ? 'text-blue-900' : 'text-amber-900'}`}>
						<span className="font-bold uppercase tracking-tight mr-1">
							{dataSource === 'refreshing' ? 'Checking source.' : 'Using saved data.'}
						</span>
						{cacheNotice}
					</span>
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

			<AdminDataTable
				data={paged}
				columns={teacherColumns}
				getRowKey={(teacher) => teacher.id}
				loading={loading}
				isFiltered={searchQuery.trim().length > 0 || hasActiveFilters}
				sort={{ key: sortField, direction: sortDir }}
				onSortChange={toggleSort}
				pagination={{
					page: tablePage,
					pageSize: tablePageSize,
					total: totalFiltered,
					totalPages,
					pageSizeOptions: PAGE_SIZES,
					onPageChange: setPage,
					onPageSizeChange: (nextPageSize) => {
						setPageSize(nextPageSize);
						setPage(1);
					},
				}}
				emptyState={{
					icon: <Users className="size-8" />,
					title: 'No teachers found.',
					description: 'ATLAS needs the teacher roster before officers can review load readiness or assign classes.',
					action: (
						<Button size="sm" onClick={handleSync} disabled={syncing} className="font-bold shadow-sm">
							<RefreshCw className={`mr-2 size-4 ${syncing ? 'animate-spin' : ''}`} />
							Sync from EnrollPro
						</Button>
					),
				}}
				noResultsState={{
					icon: <Users className="size-8" />,
					title: 'No matches found.',
					description: 'Clear a filter or search another teacher name or department.',
				}}
				errorState={error && faculty.length === 0 ? {
					icon: <AlertTriangle className="size-8" />,
					title: 'Teacher roster is unavailable.',
					description: error,
					action: (
						<Button size="sm" onClick={() => fetchFaculty({ forceRefresh: true })} disabled={syncing} className="font-bold shadow-sm">
							<RefreshCw className={`mr-2 size-4 ${syncing ? 'animate-spin' : ''}`} />
							Retry refresh
						</Button>
					),
				} : null}
				rowActions={{
					label: 'Teacher actions',
					primary: (teacher) => (
						<Button asChild size="sm" className="h-8 gap-2 px-3 text-xs font-bold">
							<Link to={`/teaching-load?facultyId=${teacher.id}`}>
								<BookOpenCheck className="size-3.5" />
								Review teaching load
							</Link>
						</Button>
					),
					secondary: (teacher) => [{
						label: 'View teacher profile',
						icon: <Eye className="size-4" />,
						onSelect: () => setProfileTarget(teacher),
					}],
				}}
				renderMobileCard={(teacher, context) => (
					<FacultyMobileCard faculty={teacher} primaryAction={context.primaryAction} secondaryActionMenu={context.secondaryActionMenu} />
				)}
			/>

			{/* Roster profile side drawer */}
			<FacultyProfileSheet 
				faculty={profileTarget}
				open={profileTarget !== null}
				onOpenChange={(open) => !open && setProfileTarget(null)}
				sourceFreshness={profileSourceLabel}
			/>
		</AdminWorkspaceFrame>
	);
}
