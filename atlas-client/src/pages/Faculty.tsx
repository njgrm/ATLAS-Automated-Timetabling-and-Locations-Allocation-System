import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	ArrowRight,
	BookOpenCheck,
	Eye,
	ListChecks,
	Pencil,
	Plus,
	RefreshCw,
	Trash2,
	Users,
} from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { CreatePlaceholderDialog } from '@/components/faculty/CreatePlaceholderDialog';

import atlasApi from '@/lib/api';
import type { FacultySummary } from '@/types';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import {
	AdminSearchFilterToolbar,
	AdminWorkspaceFrame,
	type AdminSourceState,
} from '@/components/admin-workspace/AdminWorkspace';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin-workspace/AdminDataTable';
import {
	FacultyAssignedClassesCell,
	getFacultyLoadPresentation,
	FacultyIdentityCell,
	FacultyLoadStateBadge,
	FacultyMobileCard,
	FacultyWeeklyLoadCell,
} from '@/components/faculty/FacultyRow';
import { FacultyProfileSheet } from '@/components/faculty/FacultyProfileSheet';
import { toast } from 'sonner';
import { departmentLabel } from '@/lib/deped-glossary';
import {
	promoteActiveSchoolYearContext,
	resolveActiveSchoolYearContext,
	type ActiveSchoolYearContextSource,
	isUpstreamBackedSchoolYearSource,
} from '@/lib/enrollpro-public-settings';
import {
	getFacultyLoadSortRank,
	type SubjectSectionOwnershipIndexEntry,
} from '@/lib/faculty-assignment-helpers';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import {
	getCachedFacultyAssignmentsSummary,
	requestWithRetry,
	setCachedFacultyAssignmentsSummary,
} from '@/lib/faculty-teaching-load-cache';

const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50, 100];

type SortField = 'name' | 'subjects' | 'weeklyLoad' | 'status';
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

type TeacherAttentionFilter = 'all' | 'needs-load' | 'over-cap' | 'no-active-load' | 'placeholders';

function getTeacherRepairIntent(teacher: FacultySummary) {
	const loadHours = teacher.policyCreditedHours ?? 0;
	if (teacher.isPlaceholder) {
		return {
			task: 'review-placeholders',
			label: 'Review temporary',
			helper: 'This is a temporary record for a teacher who has not been hired yet. Replace it before publishing.',
		};
	}
	if (!teacher.isActiveForScheduling) {
		return {
			task: 'review',
			label: 'View details',
			helper: 'This teacher is excluded from scheduling. Review before assigning load.',
		};
	}
	if ((teacher.subjectCount ?? 0) === 0) {
		return {
			task: 'missing-load',
			label: 'Assign teaching load',
			helper: 'This active teacher has no Teaching Load yet.',
		};
	}
	if (loadHours > teacher.maxHoursPerWeek) {
		return {
			task: 'over-cap',
			label: 'Move classes',
			helper: 'This teacher is over the weekly maximum. Move classes before generating the timetable.',
		};
	}
	return {
		task: 'review',
		label: 'Review load',
		helper: getFacultyLoadPresentation(teacher).help,
	};
}

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

	// Placeholder dialog and confirm deletion states
	const [placeholderDialogOpen, setPlaceholderDialogOpen] = useState(false);
	const [placeholderEditTarget, setPlaceholderEditTarget] = useState<FacultySummary | null>(null);
	const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<FacultySummary | null>(null);
	const [deleting, setDeleting] = useState(false);

	const handleDeletePlaceholder = async () => {
		if (!confirmDeleteTarget) return;
		setDeleting(true);
		try {
			await atlasApi.delete(`/faculty/${confirmDeleteTarget.id}`, {
				params: { schoolId: DEFAULT_SCHOOL_ID }
			});
			toast.success('Temporary teacher deleted successfully.');
			setConfirmDeleteTarget(null);
			void fetchFaculty({ forceRefresh: true });
		} catch (err: any) {
			const errMsg = err?.response?.data?.message ?? 'Failed to delete placeholder.';
			toast.error(errMsg);
		} finally {
			setDeleting(false);
		}
	};

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
	const [attentionFilter, setAttentionFilter] = useState<TeacherAttentionFilter>('all');

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
		if (serverPagination && attentionFilter === 'all') {
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
		if (attentionFilter === 'needs-load') list = list.filter((f) => f.isActiveForScheduling && !f.isPlaceholder && (f.subjectCount ?? 0) === 0);
		if (attentionFilter === 'over-cap') list = list.filter((f) => f.isActiveForScheduling && !f.isPlaceholder && (f.policyCreditedHours ?? 0) > f.maxHoursPerWeek);
		if (attentionFilter === 'no-active-load') list = list.filter((f) => f.isActiveForScheduling && !f.isPlaceholder && (f.sectionCount ?? 0) === 0);
		if (attentionFilter === 'placeholders') list = list.filter((f) => f.isPlaceholder);

		// Sort
		const sorted = [...list].sort((left, right) => {
			let cmp = 0;
			switch (sortField) {
				case 'name': cmp = compareTeacherName(left, right); break;
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
	}, [faculty, serverPagination, searchQuery, schedulingFilter, assignmentFilter, departmentFilter, attentionFilter, sortField, sortDir, page, pageSize]);

	// Reset page when filters change
	useEffect(() => { setPage(1); }, [searchQuery, schedulingFilter, assignmentFilter, departmentFilter, attentionFilter, pageSize, sortField, sortDir]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else { setSortField(field); setSortDir('asc'); }
	};

	const tablePage = serverPagination?.page ?? page;
	const tablePageSize = serverPagination?.pageSize ?? pageSize;
	const hasActiveFilters = schedulingFilter !== 'all' || assignmentFilter !== 'all' || departmentFilter !== 'all' || attentionFilter !== 'all';

	const teacherColumns = useMemo<AdminDataTableColumn<FacultySummary, SortField>[]>(() => [
		{
			id: 'teacher',
			label: 'Teacher',
			cellRole: 'identity',
			sortKey: 'name',
			cellClassName: 'min-w-52',
			render: (teacher) => <FacultyIdentityCell faculty={teacher} />,
		},
		{
			id: 'loadState',
			label: 'Load status',
			cellRole: 'status',
			sortKey: 'status',
			render: (teacher) => <FacultyLoadStateBadge faculty={teacher} />,
		},
		{
			id: 'weeklyHours',
			label: 'Weekly load',
			cellRole: 'numeric',
			sortKey: 'weeklyLoad',
			headerClassName: 'text-center',
			cellClassName: 'text-center min-w-28',
			render: (teacher) => <FacultyWeeklyLoadCell faculty={teacher} />,
		},
		{
			id: 'teachingLoad',
			label: 'Assigned classes',
			cellRole: 'text',
			sortKey: 'subjects',
			cellClassName: 'min-w-28',
			render: (teacher) => (
				<FacultyAssignedClassesCell
					faculty={teacher}
					onClick={() => setProfileTarget(teacher)}
				/>
			),
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
		const overCapCount = rosterStats?.overCapCount ?? faculty.filter((teacher) => teacher.isActiveForScheduling && (teacher.policyCreditedHours ?? 0) > teacher.maxHoursPerWeek).length;
		return [
			{ label: 'Active teachers', value: activeCount, tone: activeCount > 0 ? 'success' as const : 'warning' as const, helpText: 'Teachers currently available for scheduling.' },
			{ label: 'With load', value: `${assignedCount}/${activeCount}`, tone: assignedCount > 0 ? 'info' as const : 'warning' as const, helpText: `${unassignedCount} of ${activeCount} active teachers still need a teaching load.` },
			{ label: 'Above weekly max', value: overCapCount, tone: overCapCount > 0 ? 'warning' as const : 'success' as const, helpText: 'Active teachers above the weekly maximum. Move classes before generating.' },
		];
	}, [faculty, rosterStats]);

	const profileSourceLabel = useMemo(() => {
		if (teacherSourceState === 'verified-live') return timeSince ? `Verified live - ${timeSince}` : 'Verified live';
		if (teacherSourceState === 'checking-source') return 'Checking source';
		if (teacherSourceState === 'saved-data') return timeSince ? `Using saved data - ${timeSince}` : 'Using saved data';
		return 'No saved data';
	}, [teacherSourceState, timeSince]);

	const nextTeacherToFix = useMemo(() => {
		const activeRoster = faculty.filter((teacher) => teacher.isActiveForScheduling);
		return activeRoster.find((teacher) => !teacher.isPlaceholder && (teacher.subjectCount ?? 0) === 0)
			?? activeRoster.find((teacher) => !teacher.isPlaceholder && (teacher.policyCreditedHours ?? 0) > teacher.maxHoursPerWeek)
			?? faculty.find((teacher) => teacher.isPlaceholder)
			?? activeRoster[0]
			?? faculty[0]
			?? null;
	}, [faculty]);

	const nextTeacherIntent = nextTeacherToFix ? getTeacherRepairIntent(nextTeacherToFix) : null;

	const applyAttentionFilter = useCallback((filter: TeacherAttentionFilter) => {
		setAttentionFilter(filter);
		// Phase 3.3: "All teachers" only clears the attention filter. It no
		// longer silently resets the department filter the scheduler may have
		// set intentionally (audit T-6).
		if (filter === 'all') {
			return;
		}
		if (filter === 'needs-load') {
			setSchedulingFilter('active');
			setAssignmentFilter('unassigned');
			setSortField('status');
			setSortDir('asc');
			return;
		}
		if (filter === 'over-cap') {
			setSchedulingFilter('active');
			setAssignmentFilter('all');
			setSortField('status');
			setSortDir('asc');
			return;
		}
		if (filter === 'no-active-load') {
			setSchedulingFilter('active');
			setAssignmentFilter('all');
			setSortField('subjects');
			setSortDir('asc');
			return;
		}
		if (filter === 'placeholders') {
			setSchedulingFilter('all');
			setAssignmentFilter('all');
			setSortField('name');
			setSortDir('asc');
			return;
		}
	}, []);

	const attentionChips = [
		{ id: 'needs-load' as const, label: 'No subjects assigned', helper: 'Active teachers with no subject assigned in Teaching Load.', count: rosterStats?.unassignedCount ?? faculty.filter((teacher) => teacher.isActiveForScheduling && (teacher.subjectCount ?? 0) === 0).length },
		{ id: 'over-cap' as const, label: 'Above weekly max', helper: 'Active teachers above the 40h weekly maximum. Move classes before generating.', count: rosterStats?.overCapCount ?? faculty.filter((teacher) => teacher.isActiveForScheduling && (teacher.policyCreditedHours ?? 0) > teacher.maxHoursPerWeek).length },
		{ id: 'no-active-load' as const, label: 'No sections assigned', helper: 'Active teachers with no section assigned yet.', count: faculty.filter((teacher) => teacher.isActiveForScheduling && !teacher.isPlaceholder && (teacher.sectionCount ?? 0) === 0).length },
		{ id: 'placeholders' as const, label: 'Temporary teachers', helper: 'Placeholder records for teachers who have not been hired yet. Replace before publishing.', count: faculty.filter((teacher) => teacher.isPlaceholder).length },
		{ id: 'all' as const, label: 'All teachers', helper: 'Clear the attention filter and show every teacher.', count: rosterStats?.totalCount ?? faculty.length },
	];

return (
		<AdminWorkspaceFrame
			title = "Teachers"
			description="Review the teacher roster and scheduling load before assigning classes."
			sourceState={teacherSourceState}
			lastVerified={timeSince ?? undefined}
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
				<Button asChild size="sm" className="hidden gap-2 font-semibold shadow-sm sm:inline-flex">
					<Link to="/teaching-load">
						<BookOpenCheck className="size-4" />
						Review load
					</Link>
				</Button>
			)}
			secondaryActions={(
				<>
					<Button asChild size="sm" className="gap-2 font-semibold shadow-sm sm:hidden">
						<Link to="/teaching-load">
							<BookOpenCheck className="size-4" />
							Review load
						</Link>
					</Button>
					<Button
						onClick={() => {
							setPlaceholderEditTarget(null);
							setPlaceholderDialogOpen(true);
						}}
						size="sm"
						className="gap-2 font-semibold shadow-sm"
					>
						<Plus className="size-4" />
						Create Temporary
					</Button>
					<Button variant="outline" onClick={handleSync} disabled={syncing || !isOnline} size="sm" className="gap-2 font-semibold">
						<RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
						{syncing ? 'Refreshing...' : !isOnline ? 'Offline' : refreshing ? 'Checking...' : 'Refresh teacher roster'}
					</Button>
				</>
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
							<SelectTrigger className="h-10 w-44 text-sm bg-background">
								<SelectValue placeholder="All roster states" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All roster states</SelectItem>
								<SelectItem value="active">Active teachers</SelectItem>
								<SelectItem value="excluded">Excluded teachers</SelectItem>
							</SelectContent>
						</Select>
						<Select value={assignmentFilter} onValueChange={(v) => setAssignmentFilter(v as typeof assignmentFilter)}>
							<SelectTrigger className="h-10 w-44 text-sm bg-background">
								<SelectValue placeholder="All load states" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All load states</SelectItem>
								<SelectItem value="assigned">With teaching load</SelectItem>
								<SelectItem value="unassigned">Needs teaching load</SelectItem>
							</SelectContent>
						</Select>
						{departments.length > 0 && (
							<Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v)}>
								<SelectTrigger className="h-10 w-44 text-sm bg-background">
									<SelectValue placeholder="All Departments" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Departments</SelectItem>
									{departments.map((d) => <SelectItem key={d} value={d}>{departmentLabel(d)}</SelectItem>)}
								</SelectContent>
							</Select>
						)}
						{hasActiveFilters && (
							<Button
								variant="ghost"
								size="sm"
								className="px-3 text-sm text-muted-foreground hover:text-foreground font-semibold"
								onClick={() => { setSchedulingFilter('all'); setAssignmentFilter('all'); setDepartmentFilter('all'); setAttentionFilter('all'); }}
							>
								Reset filters
							</Button>
						)}
				</AdminSearchFilterToolbar>
			)}
		>

			<div className="shrink-0 px-4 pt-1 lg:px-5">
				<RolloverGuidanceCard compact />
			</div>

			{/* Status Banners */}
			{syncError && (
				<div className="shrink-0 mx-4 mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm animate-in fade-in duration-300 lg:mx-5">
					<AlertTriangle className="size-4 shrink-0 text-amber-600" />
					<span className="flex-1 font-semibold">{cacheNotice ?? 'ATLAS could not refresh the teacher roster. The last saved roster is still shown.'}</span>
					<Button size="sm" variant="outline" onClick={() => fetchFaculty({ forceRefresh: true })} disabled={syncing} className="shrink-0 border-amber-300 hover:bg-amber-100 text-amber-900 font-bold">
						<RefreshCw className={`mr-1.5 size-3 ${syncing ? 'animate-spin' : ''}`} /> Retry refresh
					</Button>
				</div>
			)}

			{cacheNotice && !syncError && (dataSource === 'cached' || dataSource === 'refreshing') && (
				<p className="sr-only" aria-live="polite">
					{dataSource === 'refreshing' ? 'Checking source.' : 'Using saved data.'} {cacheNotice}
				</p>
			)}

			{error && !syncError && (
				<div className="shrink-0 mx-4 mt-2 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 shadow-sm lg:mx-5">
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
				leadingContent={(
					<section
						data-testid="teachers-next-action-strip"
						className="rounded-t-xl bg-primary/[0.03] px-2.5 py-1"
						aria-label="Teacher load guidance"
					>
						<div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex min-w-0 shrink-0 items-center gap-2">
								<div className="min-w-0 shrink-0">
								{/* Phase 3.4 + "fix" language rule: the heading and empty-state
									copy no longer use "fix" and no longer say "Load data is
									still loading" forever after load completes. */}
									<p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
										<span aria-hidden="true">Next teacher</span>
										<span className="sr-only">Next teacher to review</span>
									</p>
									{nextTeacherToFix && nextTeacherIntent ? (
										<div className="mt-0.5 flex min-w-0 items-center gap-2">
											<p className="max-w-32 truncate text-sm font-bold text-foreground sm:max-w-48">{nextTeacherToFix.lastName}, {nextTeacherToFix.firstName}</p>
											<span className="sr-only">{nextTeacherIntent.helper}</span>
										</div>
									) : loading || refreshing ? (
										<p className="mt-0.5 text-sm font-semibold text-muted-foreground">Checking the teacher roster...</p>
									) : faculty.length === 0 ? (
										<p className="mt-0.5 text-sm font-semibold text-muted-foreground">No active teachers to review. Sync the roster first.</p>
									) : (
										<p className="mt-0.5 text-sm font-semibold text-muted-foreground">Every teacher looks ready to review.</p>
									)}
								</div>
								{nextTeacherToFix && nextTeacherIntent && (
									<Button asChild size="sm" className="h-8 shrink-0 gap-1.5 px-2 text-xs font-bold" data-testid="teacher-repair-card">
										<Link to={`/teaching-load?facultyId=${nextTeacherToFix.id}&task=${nextTeacherIntent.task}`}>
											<ListChecks className="size-4" />
											{nextTeacherIntent.label}
											<ArrowRight className="size-4" />
										</Link>
									</Button>
								)}
							</div>
							<div className="flex min-w-0 flex-1 flex-nowrap items-center justify-start gap-2 overflow-x-auto pb-0.5 sm:justify-end">
								<div className="flex max-w-full shrink-0 flex-nowrap items-center gap-1.5 sm:max-w-[22rem] lg:max-w-full">
									{attentionChips.map((chip) => (
										<TooltipProvider key={chip.id} delayDuration={200}>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														type="button"
														variant={attentionFilter === chip.id ? 'secondary' : 'outline'}
														size="sm"
														aria-pressed={attentionFilter === chip.id}
														className="h-8 shrink-0 rounded-full px-2.5 text-xs font-bold"
														onClick={() => applyAttentionFilter(chip.id)}
													>
														{chip.label}
														<span className="ml-1 tabular-nums text-muted-foreground">{chip.count}</span>
													</Button>
												</TooltipTrigger>
												<TooltipContent side="bottom" className="max-w-60 text-xs">{chip.helper}</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									))}
								</div>
							</div>
						</div>
					</section>
				)}
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
					menuTestId: 'teacher-row-more-actions',
					primary: (teacher) => {
						const repairIntent = getTeacherRepairIntent(teacher);
						return (
							<Button asChild size="sm" className="h-8 gap-2 px-3 text-xs font-bold" data-testid="teacher-row-primary-action">
								<Link to={`/teaching-load?facultyId=${teacher.id}&task=${repairIntent.task}`} aria-label={`${repairIntent.label} for ${teacher.lastName}, ${teacher.firstName}`}>
									<BookOpenCheck className="size-3.5" />
									{repairIntent.label}
								</Link>
							</Button>
						);
					},
					inlineSecondary: (teacher) => (
						<Button
							variant="outline"
							size="sm"
							className="h-8 gap-1.5 px-2.5 text-xs font-bold"
							onClick={() => setProfileTarget(teacher)}
							aria-label={`View profile for ${teacher.lastName}, ${teacher.firstName}`}
							data-testid="teacher-row-profile-action"
						>
							<Eye className="size-3.5" />
							Profile
						</Button>
					),
					secondary: (teacher) => {
						const actions = [];
						if (teacher.isPlaceholder) {
							actions.push({
									label: 'Edit temporary teacher details',
									icon: <Pencil className="size-4" />,
									onSelect: () => {
										setPlaceholderEditTarget(teacher);
										setPlaceholderDialogOpen(true);
									},
								});
						}
						return actions;
					},
					destructive: (teacher) => teacher.isPlaceholder ? [{
						label: 'Delete temporary teacher',
						icon: <Trash2 className="size-4" />,
						onSelect: () => setConfirmDeleteTarget(teacher),
					}] : [],
				}}
				renderMobileCard={(teacher, context) => (
					<FacultyMobileCard
						faculty={teacher}
						primaryAction={context.primaryAction}
						secondaryActionMenu={context.secondaryActionMenu}
						onAssignedClassesClick={() => setProfileTarget(teacher)}
						onProfileClick={() => setProfileTarget(teacher)}
					/>
				)}
			/>

			{/* Roster profile side drawer */}
			<FacultyProfileSheet 
				faculty={profileTarget}
				open={profileTarget !== null}
				onOpenChange={(open) => !open && setProfileTarget(null)}
				sourceFreshness={profileSourceLabel}
			/>

			{/* Create/Edit Placeholder Modal */}
			<CreatePlaceholderDialog
				open={placeholderDialogOpen}
				onOpenChange={setPlaceholderDialogOpen}
				onSuccess={() => void fetchFaculty({ forceRefresh: true })}
				facultyToEdit={placeholderEditTarget}
				departments={departments}
			/>

			{/* Delete Confirmation Dialog */}
			<Dialog open={confirmDeleteTarget !== null} onOpenChange={(open) => !open && setConfirmDeleteTarget(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-red-600">Delete Temporary Teacher</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete <span className="font-semibold text-foreground">{confirmDeleteTarget?.firstName} {confirmDeleteTarget?.lastName}</span>? This action is permanent and will remove all their assigned teaching load sections.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" onClick={() => setConfirmDeleteTarget(null)} disabled={deleting} className="h-9">
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeletePlaceholder} disabled={deleting} className="h-9 font-semibold">
							{deleting ? 'Deleting...' : 'Delete Permanently'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</AdminWorkspaceFrame>
	);
}
