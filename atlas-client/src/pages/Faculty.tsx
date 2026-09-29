import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	RefreshCw,
	Users,
} from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { CreatePlaceholderDialog } from '@/components/faculty/CreatePlaceholderDialog';

import atlasApi from '@/lib/api';
import type { FacultySummary } from '@/types';
import { Button } from '@/ui/button';
// A5 C3 slice B: `@/ui/select`, `departmentLabel` and `GRADE_OPTIONS` left this file with the
// four roster filters. The page builds no Radix filter of its own any more, and the option
// vocabulary it needs now lives with the controls that offer it.
import {
	AdminSearchFilterToolbar,
	AdminWorkspaceFrame,
	type AdminSourceState,
} from '@/components/admin-workspace/AdminWorkspace';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin-workspace/AdminDataTable';
import {
	FacultyAssignedClassesCell,
	FacultyAssignedGradeChips,
	FacultyPreferredGradesControl,
	FacultyIdentityCell,
	FacultyLoadStateBadge,
	FacultyMobileCard,
	FacultyWeeklyLoadCell,
} from '@/components/faculty/FacultyRow';
import { FacultyProfileSheet } from '@/components/faculty/FacultyProfileSheet';
import { FacultyRosterActions } from '@/components/faculty/FacultyRosterActions';
import { FacultyWorkloadModal } from '@/components/faculty/FacultyWorkloadModal';
import {
	getTeacherRepairIntent,
	useFacultyRowActions,
	type FacultyRowRepairIntent,
} from '@/components/faculty/FacultyRowActions';
import { useRosterScrollMemory } from '@/components/faculty/rosterScrollMemory';
import { formatFacultyDisplayName, teacherNameSortKey } from '@/components/faculty/teacherNameDisplay';
import { buildDuplicateNameCue, duplicateTeacherNameKey } from '@/components/faculty/duplicateTeacherNames';
import { TeacherAttentionFilters } from '@/components/faculty/TeacherAttentionFilters';
// A5 C3 slice B / B3: the four roster filters, extracted so this file stays under §8's
// 1000-line cap and so the one shared picker is the only way a filter is built here.
import { FacultyFilterRow } from '@/components/faculty/FacultyFilterRow';
import { toast } from 'sonner';
import {
	promoteActiveSchoolYearContext,
	resolveActiveSchoolYearContext,
	type ActiveSchoolYearContextSource,
	isUpstreamBackedSchoolYearSource,
} from '@/lib/enrollpro-public-settings';
import { useActorSchoolScope } from '@/lib/actor-scope-session';
import {
	getFacultyLoadSortRank,
	type SubjectSectionOwnershipIndexEntry,
} from '@/lib/faculty-assignment-helpers';
import { ActorScopedRolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import {
	getCachedFacultyAssignmentsSummary,
	requestWithRetry,
	setCachedFacultyAssignmentsSummary,
} from '@/lib/faculty-teaching-load-cache';

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

	/**
	 * Fix 25 — the in-page workload modal's selection.
	 *
	 * Both the teacher and the intent it was opened with are held, so the modal's
	 * optional deep link can reproduce the exact `facultyId` + `task=` pair the
	 * old row link used to produce. Opening sets this; closing clears it, which
	 * is the ONLY state this feature touches — the roster's search, attention
	 * filter, department/grade filters, sort, page and page size are untouched
	 * and are never unmounted, because the modal is a sibling of the table.
	 */
	const [workloadTarget, setWorkloadTarget] = useState<{
		faculty: FacultySummary;
		intent: FacultyRowRepairIntent;
	} | null>(null);

	const rosterScroll = useRosterScrollMemory();

	// Placeholder dialog and confirm deletion states
	const [placeholderDialogOpen, setPlaceholderDialogOpen] = useState(false);
	const [placeholderEditTarget, setPlaceholderEditTarget] = useState<FacultySummary | null>(null);
	const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<FacultySummary | null>(null);
	const [deleting, setDeleting] = useState(false);

	const handleDeletePlaceholder = async () => {
		if (!confirmDeleteTarget || actorSchoolId == null) return;
		setDeleting(true);
		try {
			await atlasApi.delete(`/faculty/${confirmDeleteTarget.id}`, {
				params: { schoolId: actorSchoolId }
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
	const [gradeLevelFilter, setGradeLevelFilter] = useState<number | 'all'>('all');
	const [attentionFilter, setAttentionFilter] = useState<TeacherAttentionFilter>('all');
	const { actorSchoolId } = useActorSchoolScope();

	const fetchFaculty = useCallback(async (options?: { forceRefresh?: boolean }) => {
		if (actorSchoolId == null) {
			setFaculty([]);
			setDataSource('none');
			setSyncError(false);
			setError(null);
			setLoading(false);
			setRefreshing(false);
			return;
		}
		const scopedSchoolId = actorSchoolId;
		const forceRefresh = options?.forceRefresh === true;
		setLoading(true);
		setRefreshing(true);
		setError(null);

		let schoolYearId: number | null = null;
		let yearContextSource: ActiveSchoolYearContextSource = 'cache';
		try {
			const yearContext = await resolveActiveSchoolYearContext({
				schoolId: scopedSchoolId,
				// SWR: always return cached school-year immediately if available;
				// background re-verification happens automatically when stale.
				preferCache: !forceRefresh,
				backgroundRefresh: !forceRefresh,
				allowEnrollProFallback: false,
			});
			schoolYearId = yearContext.activeSchoolYearId;
			yearContextSource = yearContext.source;

			if (!forceRefresh) {
				const cachedPreview = getCachedFacultyAssignmentsSummary(scopedSchoolId, schoolYearId, {
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
							schoolId: scopedSchoolId,
							schoolYearId,
							page,
							pageSize,
						query: searchQuery.trim() || undefined,
						scheduling: schedulingFilter,
						assignment: assignmentFilter,
						department: departmentFilter !== 'all' ? departmentFilter : undefined,
						gradeLevel: gradeLevelFilter !== 'all' ? gradeLevelFilter : undefined,
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
				setCachedFacultyAssignmentsSummary(scopedSchoolId, schoolYearId, {
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
				void promoteActiveSchoolYearContext({ schoolId: scopedSchoolId, allowEnrollProFallback: false, allowStaleOnError: true })
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
				? getCachedFacultyAssignmentsSummary(scopedSchoolId, schoolYearId)
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
	}, [actorSchoolId, assignmentFilter, departmentFilter, gradeLevelFilter, isOnline, page, pageSize, schedulingFilter, searchQuery, sortDir, sortField]);

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
		if (actorSchoolId == null) {
			toast.error('Your school scope could not be verified. Sign in again, then retry.');
			return;
		}
		setSyncing(true);
		setSyncError(false);
		try {
			const { data } = await atlasApi.post<{ synced: boolean; activeCount: number }>('/faculty/sync', {
				schoolId: actorSchoolId,
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

	/**
	 * A6 C3 (Lane C item #6) — the same-name CUE, computed ONCE over the whole
	 * roster and looked up per row.
	 *
	 * It is a census, not a filter: no record is merged, hidden, reordered or
	 * paged by it, and the lookup returns nothing for a unique name, so a roster
	 * with no duplicates renders byte-for-byte as it did before. It is computed
	 * from `faculty` (the full roster), not from `paged`, so a name that is
	 * duplicated across two pages still shows its cue on both of them instead of
	 * only on the page that happens to hold both records.
	 */
	const duplicateNameCue = useMemo(() => buildDuplicateNameCue(faculty), [faculty]);

	/** The cue for ONE teacher, or nothing at all when the name is unique. */
	const cueFor = useCallback((teacher: FacultySummary) => {
		const cue = duplicateNameCue.get(duplicateTeacherNameKey(teacher));
		return cue ? { count: cue.count, sameLoad: cue.sameLoad } : undefined;
	}, [duplicateNameCue]);

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
		/**
		 * Fix 22: sorting compares the STORED name, never the displayed one.
		 * `teacherNameSortKey` uppercases only so casing cannot influence the
		 * comparison, and it is derived from the stored `firstName`/`lastName`.
		 * A visible-uppercase / stored-original split therefore cannot reorder
		 * the roster.
		 */
		const compareTeacherName = (left: FacultySummary, right: FacultySummary) =>
			teacherNameSortKey(left).localeCompare(teacherNameSortKey(right));

		// Search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			// Fix 22: matching runs against the STORED first/last name, so a
			// search for "alcantara" still finds a teacher whose row displays
			// "ALCANTARA, ROBERTO". The display transform is presentation only.
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
		if (gradeLevelFilter !== 'all') list = list.filter((f) => (f.assignedGradeLevels ?? []).includes(gradeLevelFilter));
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
	}, [faculty, serverPagination, searchQuery, schedulingFilter, assignmentFilter, departmentFilter, gradeLevelFilter, attentionFilter, sortField, sortDir, page, pageSize]);

	// Reset page when filters change
	useEffect(() => { setPage(1); }, [searchQuery, schedulingFilter, assignmentFilter, departmentFilter, gradeLevelFilter, attentionFilter, pageSize, sortField, sortDir]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else { setSortField(field); setSortDir('asc'); }
	};

	const tablePage = serverPagination?.page ?? page;
	const tablePageSize = serverPagination?.pageSize ?? pageSize;
	const hasActiveFilters = schedulingFilter !== 'all' || assignmentFilter !== 'all' || departmentFilter !== 'all' || gradeLevelFilter !== 'all' || attentionFilter !== 'all';

	const clearAllFilters = useCallback(() => {
		setSchedulingFilter('all');
		setAssignmentFilter('all');
		setDepartmentFilter('all');
		setGradeLevelFilter('all');
		setAttentionFilter('all');
	}, []);

	/**
	 * The roster's column definitions.
	 *
	 * A6 C3 (QA finding B1, 2026-09-29) — THE DEPENDENCY ARRAY HERE IS
	 * LOAD-BEARING, and it was not before.
	 *
	 * The `render` closures used to be per-teacher PURE: each one took a teacher
	 * and read only that teacher, so freezing the column array for the life of the
	 * page changed nothing a reader could see. A6 C3's same-name cue broke that
	 * assumption. `render` now calls `cueFor(teacher)`, which closes over
	 * `duplicateNameCue` — state derived from the whole roster — and this memo
	 * still declared `[]`. The page renders the table on its first pass, while
	 * the roster is still empty and the cue map is therefore empty, so the
	 * closures froze permanently against an empty map and the cue was
	 * `undefined` on the REAL `/teachers` route for the whole session. The cue
	 * was correct in the unit rows and absent in production, which is exactly
	 * the gap between a passing control and a working feature.
	 *
	 * `duplicateNameCue` is the ONE thing these closures read beyond their own
	 * teacher, so it is the one dependency added — not `faculty` wholesale, which
	 * would rebuild the array on every roster refetch for a cue that has not
	 * changed. The map's identity is a `useMemo` over `faculty`, so it changes
	 * exactly when the roster does.
	 *
	 * `A6-C3-6f` in `src/components/faculty/__tests__/a6-teachers-header-profile.test.tsx`
	 * mounts this real page and is the row that can see this defect: reverted to
	 * this file's base state, that row reports zero cues.
	 */
	const teacherColumns = useMemo<AdminDataTableColumn<FacultySummary, SortField>[]>(() => [
		{
			id: 'teacher',
			label: 'Teacher',
			cellRole: 'identity',
			sortKey: 'name',
			cellClassName: 'min-w-52',
			render: (teacher) => (
				<FacultyIdentityCell
					faculty={teacher}
					duplicateRecordCount={cueFor(teacher)?.count}
					duplicateRecordsShareLoad={cueFor(teacher)?.sameLoad}
				/>
			),
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
				<div className="flex flex-col gap-1">
					<FacultyAssignedClassesCell
						faculty={teacher}
						onClick={() => setProfileTarget(teacher)}
					/>
					<FacultyAssignedGradeChips faculty={teacher} />
					<FacultyPreferredGradesControl faculty={teacher} />
				</div>
			),
		},
	], [duplicateNameCue]);

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

	/**
	 * FIX 24.1. The header's `Review teachers` button and its `... More` popover
	 * are both gone, so the `openRosterReview` opener that fed them is gone with
	 * them. The repair LOGIC is not lost: `nextTeacherToFix` /
	 * `nextTeacherIntent` still compute and still seed the profile sheet's
	 * primary action through `reviewLabel` on the per-row `Profile` control
	 * below. Only the one dead header entry point is removed.
	 */

	const openCreateTemporary = useCallback(() => {
		setPlaceholderEditTarget(null);
		setPlaceholderDialogOpen(true);
	}, []);

	/**
	 * Fix 25. The row's primary action opens the modal IN PLACE. The roster's
	 * scroll offset is captured HERE, on the click, before the dialog exists —
	 * that is the offset the user was actually looking at, and it is restored by
	 * `closeWorkloadModal` on every dismissal path.
	 */
	const openWorkloadModal = useCallback(
		(teacher: FacultySummary, event: React.MouseEvent<HTMLElement>) => {
			rosterScroll.captureFrom(event.currentTarget);
			setWorkloadTarget({ faculty: teacher, intent: getTeacherRepairIntent(teacher) });
		},
		[rosterScroll],
	);

	const closeWorkloadModal = useCallback(() => {
		rosterScroll.restore();
		setWorkloadTarget(null);
	}, [rosterScroll]);

	const rowActions = useFacultyRowActions({
		onReviewLoad: openWorkloadModal,
		onOpenProfile: setProfileTarget,
		onEditTemporary: (teacher) => {
			setPlaceholderEditTarget(teacher);
			setPlaceholderDialogOpen(true);
		},
		onDeleteTemporary: setConfirmDeleteTarget,
	});

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
				<FacultyRosterActions
					onCreateTemporary={openCreateTemporary}
					onRefreshRoster={handleSync}
					syncing={syncing}
					isOnline={isOnline}
					refreshing={refreshing}
				/>
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
					{/* A5 C3 slice B: the four roster filters moved to
					    `components/faculty/FacultyFilterRow.tsx` and onto the one shared
					    `@/ui` picker. Two reasons, in order: the file is at §8's 1000-line cap
					    (981 physical at 419277e4) and the conversion had to land with the
					    extraction; and the four triggers were `h-10 w-44 text-sm
					    bg-background` — a control that existed in no other form anywhere in the
					    product. The `More filters` disclosure around them is untouched. */}
					<FacultyFilterRow
						schedulingFilter={schedulingFilter}
						onSchedulingFilterChange={(v) => setSchedulingFilter(v as typeof schedulingFilter)}
						assignmentFilter={assignmentFilter}
						onAssignmentFilterChange={(v) => setAssignmentFilter(v as typeof assignmentFilter)}
						departments={departments}
						departmentFilter={departmentFilter}
						onDepartmentFilterChange={setDepartmentFilter}
						gradeLevelFilter={gradeLevelFilter}
						onGradeLevelFilterChange={setGradeLevelFilter}
						hasActiveFilters={hasActiveFilters}
						onClearAllFilters={clearAllFilters}
					/>
				</AdminSearchFilterToolbar>
			)}
		>

			<div className="shrink-0 px-4 pt-1 lg:px-5">
				<ActorScopedRolloverGuidanceCard compact />
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
				/* Fix 21: the "Next teacher" strip is removed. It duplicated the
					roster's own state, carried a redundant `Review load` link out to
					/teaching-load, and consumed vertical space the roster needs at
					1366x768. Its repair-intent logic is NOT lost: `nextTeacherToFix`
					and `nextTeacherIntent` still compute, and they still seed the
					per-row profile's primary action through `reviewLabel`. The
					attention chips, which lived inside the same wrapper and are a
					real filter control, are preserved and are now the whole leading
					row. */
				<TeacherAttentionFilters
					chips={attentionChips}
					activeChipId={attentionFilter}
					onApplyFilter={(id) => applyAttentionFilter(id as TeacherAttentionFilter)}
				/>
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
					description: gradeLevelFilter !== 'all'
						? `No teachers with assigned classes in Grade ${gradeLevelFilter}. Clear a filter or search another teacher name or department.`
						: 'Clear a filter or search another teacher name or department.',
					action: hasActiveFilters ? (
						<Button size="sm" onClick={clearAllFilters} className="font-bold shadow-sm" data-testid="teachers-clear-filters">
							Reset filters
						</Button>
					) : undefined,
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
			rowActions={rowActions}
				renderMobileCard={(teacher, context) => (
				<FacultyMobileCard
					faculty={teacher}
					primaryAction={context.primaryAction}
					secondaryActionMenu={context.secondaryActionMenu}
					duplicateRecordCount={cueFor(teacher)?.count}
					duplicateRecordsShareLoad={cueFor(teacher)?.sameLoad}
					onAssignedClassesClick={() => setProfileTarget(teacher)}
					onProfileClick={() => setProfileTarget(teacher)}
				/>
				)}
			/>

			{/*
			 * Fix 25 — the in-page workload modal. A SIBLING of the roster, not a
			 * route, so opening it cannot unmount the table and cannot discard
			 * the search, filters, sort or page. The one piece of state the
			 * navigation used to destroy that is not React state at all — the
			 * scroll offset — is captured on the click and restored by
			 * `closeWorkloadModal` on every dismissal path.
			 */}
			<FacultyWorkloadModal
				faculty={workloadTarget?.faculty ?? null}
				open={workloadTarget !== null}
				intent={workloadTarget?.intent ?? null}
				scrollRegionRef={rosterScroll.regionRef}
				onClose={closeWorkloadModal}
			/>

			{/* Roster review / profile — Fix 23: a centred Dialog, opened in place.
			    A6 c10: it also carries `Teaching permissions` — the switch and the
			    `Subjects they may also teach` list, which are the only controls in the
			    product that can create a `CrossDepartmentPermission` outside the moment
			    a class needs one (Codex audit finding 6; Lane C's "nothing can create
			    or delete one"). `schoolId` is the ACTOR's, and the sheet takes no
			    default for it. */}
			<FacultyProfileSheet
				faculty={profileTarget}
				open={profileTarget !== null}
				onOpenChange={(open) => !open && setProfileTarget(null)}
				sourceFreshness={profileSourceLabel}
				reviewLabel={nextTeacherIntent?.label ?? 'Review teaching load'}
				permissions={null}
				schoolId={actorSchoolId}
				onPermissionsChanged={() => { void fetchFaculty({ forceRefresh: true }); }}
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
				{/* A5 item 23.2: a destructive CONFIRMATION — forced compact. */}
				<DialogContent resizable={false} className="sm:max-w-md">
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
