import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	Search,
	ServerOff,
	Users,
	X,
	Filter,
	ChevronsLeft,
	ChevronsRight,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import {
	getCachedSectionHomeRooms,
	getCachedSectionSummary,
	requestWithRetry,
	setCachedSectionHomeRooms,
	setCachedSectionSummary,
} from '@/lib/faculty-teaching-load-cache';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { SectionRow, type SectionDetail, type HomeRoomOption } from '@/components/sections/SectionRow';
import { SectionDetailsSheet } from '@/components/sections/SectionDetailsSheet';

/* ─── Constants ─── */
const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50, 100];

const GRADE_COLORS: Record<string, string> = {
	'7':  'bg-green-100/80 text-green-700',
	'8':  'bg-yellow-100/80 text-yellow-700',
	'9':  'bg-red-100/80 text-red-700',
	'10': 'bg-blue-100/80 text-blue-700',
};

/* ─── Types ─── */
type SortField = 'name' | 'gradeLevelId' | 'enrolledCount' | 'maxCapacity' | 'fill';
type SortDir   = 'asc' | 'desc';

type SectionSummary = {
	schoolId:              number;
	schoolYearId:          number;
	totalSections:         number;
	totalEnrolled:         number;
	byGradeLevel:          Record<number, number>;
	enrolledByGradeLevel:  Record<number, number>;
	sections:              SectionDetail[];
	fetchedAt?:            string;
	source?:               string;
};

type FetchState =
	| { status: 'loading' }
	| { status: 'ok'; data: SectionSummary }
	| { status: 'unavailable'; message: string }
	| { status: 'no-year'; message: string };

/* ─── Helpers ─── */
function gradeKey(name: string) {
	const m = name.match(/\d+/);
	return m ? m[0] : '';
}

/* ─── Component ─── */
export default function Sections() {
	const [state, setState]           = useState<FetchState>({ status: 'loading' });
	const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [syncing, setSyncing]       = useState(false);
	const [syncError, setSyncError]   = useState(false);
	const [dataSource, setDataSource] = useState<'live' | 'atlas-mirror' | 'cached' | 'none'>('none');
	const [cacheNotice, setCacheNotice] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(() => navigator.onLine);
	const [sortField, setSortField]   = useState<SortField>('gradeLevelId');
	const [sortDir, setSortDir]       = useState<SortDir>('asc');
	const [page, setPage]             = useState(1);
	const [pageSize, setPageSize]     = useState(25);
	const [searchQuery, setSearchQuery] = useState('');
	const [gradeFilter, setGradeFilter] = useState<string>('all');
	const [programFilter, setProgramFilter] = useState<string>('all');
	const [homeRoomOptions, setHomeRoomOptions] = useState<HomeRoomOption[]>([]);
	const [savingMirrorId, setSavingMirrorId] = useState<number | null>(null);
	const [showFilters, setShowFilters] = useState(false);

	// Drilldown
	const [detailTarget, setDetailTarget] = useState<SectionDetail | null>(null);

	const fetchSections = useCallback(async (options?: { forceRefresh?: boolean }) => {
		const forceRefresh = options?.forceRefresh === true;
		setState({ status: 'loading' });
		setSyncError(false);

		let schoolYearId: number | null = null;
		let yearContextSource: 'atlas' | 'enrollpro' | 'cache' = 'cache';
		try {
			const schoolYearContext = await resolveActiveSchoolYearContext({
				forceRefresh,
				allowStaleOnError: true,
			});
			schoolYearId = schoolYearContext.activeSchoolYearId;
			yearContextSource = schoolYearContext.source;
			setActiveSchoolYearId(schoolYearId);

			if (!forceRefresh) {
				const cachedSummary = getCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId, {
					maxAgeMs: 3 * 60 * 1000,
				});
				const cachedHomeRooms = getCachedSectionHomeRooms<HomeRoomOption>(DEFAULT_SCHOOL_ID, schoolYearId, {
					maxAgeMs: 3 * 60 * 1000,
				});

				if (cachedSummary && cachedHomeRooms) {
					setState({ status: 'ok', data: cachedSummary.data });
					setHomeRoomOptions(cachedHomeRooms.data);
					setLastSyncedAt(cachedSummary.data.fetchedAt ? String(cachedSummary.data.fetchedAt) : null);
					setDataSource(isOnline ? 'atlas-mirror' : 'cached');
					setCacheNotice('Refreshing live section data. Showing your last saved section snapshot in the meantime.');
				}
			}

			if (!schoolYearId) {
				setState({
					status: 'no-year',
					message: 'No active school year is available. Run at least one successful sync, then retry.',
				});
				setDataSource('none');
				return;
			}

			const [summaryRes, homeRoomRes] = await Promise.all([
				requestWithRetry(
					() => atlasApi.get<SectionSummary & { code?: string }>(`/sections/summary/${schoolYearId}?schoolId=${DEFAULT_SCHOOL_ID}`),
					{ attempts: 2, delayMs: 400 },
				),
				requestWithRetry(
					() => atlasApi.get<{ rooms: HomeRoomOption[] }>(`/sections/home-rooms/${schoolYearId}?schoolId=${DEFAULT_SCHOOL_ID}`),
					{ attempts: 2, delayMs: 350 },
				),
			]);
			const res = summaryRes;
			setHomeRoomOptions(homeRoomRes.data.rooms ?? []);
			setCachedSectionHomeRooms(DEFAULT_SCHOOL_ID, schoolYearId, homeRoomRes.data.rooms ?? []);
			if (res.data.code === 'UPSTREAM_UNAVAILABLE' && res.data.totalSections === 0) {
				setState({
					status: 'unavailable',
					message: 'Section data source is currently unavailable. Sections are sourced from the enrollment service and will appear here once the upstream API is connected.',
				});
				setDataSource('none');
				setCacheNotice(null);
				return;
			}
			setState({ status: 'ok', data: res.data });
			setCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId, res.data);
			setLastSyncedAt(res.data.fetchedAt ? String(res.data.fetchedAt) : null);
			
			// Source logic: 
			// - 'live' only if both context and data are verified enrollpro
			// - 'atlas-mirror' if context or data is from atlas/mirror but we are online
			// - 'cached' if we are offline
			if (!isOnline) {
				setDataSource('cached');
			} else {
				const isUpstreamBacked = yearContextSource === 'enrollpro' && res.data.source === 'enrollpro';
				setDataSource(isUpstreamBacked ? 'live' : 'atlas-mirror');
			}
			
			setCacheNotice(
				dataSource === 'live'
					? null
					: 'Section data is available from ATLAS runtime cache while upstream verification is unavailable.',
			);
		} catch {
			const cachedSummary = schoolYearId ? getCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId) : null;
			const cachedHomeRooms = schoolYearId ? getCachedSectionHomeRooms<HomeRoomOption>(DEFAULT_SCHOOL_ID, schoolYearId) : null;

			if (cachedSummary && cachedHomeRooms) {
				setState({ status: 'ok', data: cachedSummary.data });
				setHomeRoomOptions(cachedHomeRooms.data);
				setLastSyncedAt(cachedSummary.data.fetchedAt ? String(cachedSummary.data.fetchedAt) : null);
				setDataSource(isOnline ? 'atlas-mirror' : 'cached');
				setSyncError(true);
				setCacheNotice(isOnline 
					? 'Live section data is unavailable. Showing your last saved section snapshot in degraded writable mode.'
					: 'Live section data is unavailable. Showing your last saved section snapshot in read-only mode.');
			} else {
				setHomeRoomOptions([]);
				setState({
					status: 'unavailable',
					message: 'Section data is not yet available. Run a successful sync once, then retry in degraded mode if upstream is unavailable.',
				});
				setDataSource('none');
				setCacheNotice(null);
				setSyncError(true);
			}
		}
	}, [isOnline]);

	const handleHomeRoomChange = useCallback(async (section: SectionDetail, selectedValue: string) => {
		if (!section.mirrorId || !activeSchoolYearId || (dataSource !== 'live' && dataSource !== 'atlas-mirror') || !isOnline) return;
		setSavingMirrorId(section.mirrorId);
		const nextHomeRoomId = selectedValue === 'none' ? null : Number(selectedValue);
		try {
			await atlasApi.put(`/sections/home-rooms/${activeSchoolYearId}`, {
				schoolId: DEFAULT_SCHOOL_ID,
				assignments: [{ sectionId: section.mirrorId, homeRoomId: nextHomeRoomId }],
			});

			setState((prev) => {
				if (prev.status !== 'ok') return prev;
				return {
					status: 'ok',
					data: {
						...prev.data,
						sections: prev.data.sections.map((item) =>
							item.id === section.id ? { ...item, homeRoomId: nextHomeRoomId } : item,
						),
					},
				};
			});
		} finally {
			setSavingMirrorId(null);
		}
	}, [activeSchoolYearId, dataSource, isOnline]);

	const handleSync = async () => {
		if (!isOnline) {
			setSyncError(true);
			setCacheNotice('You are offline. Reconnect before syncing Sections.');
			return;
		}
		setSyncing(true);
		setSyncError(false);
		try {
			const { data } = await atlasApi.post('/sections/sync', {
				schoolId: DEFAULT_SCHOOL_ID,
			});
			if (data.synced) {
				await fetchSections({ forceRefresh: true });
			} else {
				setSyncError(true);
			}
		} catch {
			setSyncError(true);
		} finally {
			setSyncing(false);
		}
	};

	const timeSince = useMemo(() => {
		if (!lastSyncedAt) return null;
		const diff = Date.now() - new Date(lastSyncedAt).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
		const hours = Math.floor(mins / 60);
		return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
	}, [lastSyncedAt]);

	useEffect(() => { void fetchSections(); }, [fetchSections]);

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

	// Reset page when filters change
	useEffect(() => { setPage(1); }, [searchQuery, gradeFilter, programFilter, pageSize]);

	const { paged, totalFiltered, totalPages } = useMemo(() => {
		if (state.status !== 'ok') return { paged: [], totalFiltered: 0, totalPages: 1 };
		let list = state.data.sections;

		// Search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter((s) => s.name.toLowerCase().includes(q) || s.gradeLevelName.toLowerCase().includes(q));
		}
		// Grade filter
		if (gradeFilter !== 'all') {
			list = list.filter((s) => gradeKey(s.gradeLevelName) === gradeFilter);
		}
		// Program filter
		if (programFilter !== 'all') {
			if (programFilter === 'REGULAR') {
				list = list.filter((s) => !s.isSpecialProgram);
			} else {
				list = list.filter((s) => s.programType === programFilter);
			}
		}

		// Sort
		const sorted = [...list].sort((a, b) => {
			let cmp = 0;
			if      (sortField === 'name')          cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
			else if (sortField === 'gradeLevelId') {
				cmp = a.gradeLevelId - b.gradeLevelId;
				// Secondary sort by name
				if (cmp === 0) cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
			}
			else if (sortField === 'enrolledCount') cmp = a.enrolledCount - b.enrolledCount;
			else if (sortField === 'maxCapacity')   cmp = a.maxCapacity - b.maxCapacity;
			else if (sortField === 'fill') {
				const fA = a.maxCapacity > 0 ? a.enrolledCount / a.maxCapacity : 0;
				const fB = b.maxCapacity > 0 ? b.enrolledCount / b.maxCapacity : 0;
				cmp = fA - fB;
			}
			return sortDir === 'desc' ? -cmp : cmp;
		});

		const tf = sorted.length;
		const tp = Math.max(1, Math.ceil(tf / pageSize));
		const start = (page - 1) * pageSize;
		return { paged: sorted.slice(start, start + pageSize), totalFiltered: tf, totalPages: tp };
	}, [state, searchQuery, gradeFilter, programFilter, sortField, sortDir, page, pageSize]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else { setSortField(field); setSortDir('asc'); }
	};

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) return <ArrowUpDown className="size-3 text-muted-foreground/50" />;
		return sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
	};

	const hasActiveFilters = gradeFilter !== 'all' || searchQuery.trim() !== '' || programFilter !== 'all';
	const isReadOnlyMode = !isOnline || (dataSource !== 'live' && dataSource !== 'atlas-mirror');

	// Distinct grade levels present in data
	const availableGrades = useMemo(() => {
		if (state.status !== 'ok') return [];
		const keys = new Set<string>();
		state.data.sections.forEach((s) => { const k = gradeKey(s.gradeLevelName); if (k) keys.add(k); });
		return Array.from(keys).sort((a, b) => Number(a) - Number(b));
	}, [state]);

	// Distinct special programs in data
	const availablePrograms = useMemo(() => {
		if (state.status !== 'ok') return [];
		const types = new Set<string>();
		state.data.sections.forEach((s) => { if (s.isSpecialProgram && s.programType) types.add(s.programType); });
		return Array.from(types).sort();
	}, [state]);

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)]">

			{/* ── Primary Header & Toolbar ── */}
			<div className="shrink-0 px-6 py-4 border-b bg-background/50 backdrop-blur-md">
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="relative w-64">
							<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
							<Input
								placeholder="Search sections…"
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
								className={`h-6 px-2 text-[0.7rem] uppercase tracking-wide font-bold ${
									dataSource === 'atlas-mirror' ? 'bg-amber-100 text-amber-700 border-amber-200' : ''
								}`}
							>
								{dataSource === 'live'
									? 'Live data'
									: dataSource === 'atlas-mirror'
									? 'ATLAS Mirror'
									: dataSource === 'cached'
									? 'Cached snapshot'
									: 'No cache'}
							</Badge>

							{/* Inline stat banner — prominent, not muted */}
							{state.status === 'ok' && (
								<div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-1 shadow-sm shrink-0">
									<div className="flex items-center gap-1">
										<span className="text-sm font-bold text-foreground tabular-nums">{state.data.totalSections}</span>
										<span className="text-[0.65rem] text-muted-foreground uppercase font-bold tracking-tighter">sections</span>
									</div>
									<span className="text-border">·</span>
									<div className="flex items-center gap-1.5">
										{Object.entries(state.data.byGradeLevel)
											.sort(([a], [b]) => Number(a) - Number(b))
											.map(([grade, count]) => (
												<Badge
													key={grade}
													variant="secondary"
													className={`h-5 px-1.5 text-[0.65rem] font-bold border-0 ${GRADE_COLORS[grade] ?? 'bg-muted/50 text-muted-foreground'}`}
												>
													G{grade}: {count}
												</Badge>
											))}
									</div>
								</div>
							)}

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

						<Button
							variant="outline"
							size="sm"
							onClick={handleSync}
							disabled={syncing || state.status === 'loading' || !isOnline}
							className="h-9 gap-2 shadow-sm font-bold"
						>
							<RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
							{syncing ? 'Syncing...' : !isOnline ? 'Offline' : 'Sync Sections'}
						</Button>
					</div>
				</div>

				{/* Expanded Filters */}
				{showFilters && (
					<div className="flex flex-wrap items-center gap-3 pt-4 animate-in slide-in-from-top-2 duration-200">
						{availableGrades.length > 0 && (
							<Select value={gradeFilter} onValueChange={setGradeFilter}>
								<SelectTrigger className="h-8 w-32 text-xs bg-background">
									<SelectValue placeholder="All Grades" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Grades</SelectItem>
									{availableGrades.map((g) => (
										<SelectItem key={g} value={g}>Grade {g}</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}

						{availablePrograms.length > 0 && (
							<Select value={programFilter} onValueChange={setProgramFilter}>
								<SelectTrigger className="h-8 w-40 text-xs bg-background">
									<SelectValue placeholder="All Programs" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Programs</SelectItem>
									<SelectItem value="REGULAR">Regular</SelectItem>
									{availablePrograms.map((p) => (
										<SelectItem key={p} value={p}>{p}</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}

						{hasActiveFilters && (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground font-semibold"
								onClick={() => { setSearchQuery(''); setGradeFilter('all'); setProgramFilter('all'); }}
							>
								Reset all
							</Button>
						)}
					</div>
				)}
			</div>

			{/* ── Status Banners (slim, like Faculty) ── */}
			{state.status === 'no-year' && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 shadow-sm animate-in fade-in duration-300">
					<AlertTriangle className="size-4 shrink-0 text-blue-600" />
					<span className="flex-1 font-semibold">No active school year. {state.message}</span>
				</div>
			)}
			{(state.status === 'unavailable' || syncError) && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-sm animate-in fade-in duration-300">
					<AlertTriangle className="size-4 shrink-0 text-amber-600" />
					<span className="flex-1 font-semibold">
						{cacheNotice ?? (syncError ? 'Live section sync is unavailable. Showing cached data when available.' : 'Enrollment service unavailable. Showing cached data when available.')}
					</span>
					<Button size="sm" variant="outline" onClick={handleSync} disabled={syncing || !isOnline} className="shrink-0 h-7 border-amber-300 hover:bg-amber-100 text-amber-900 font-bold">
						<RefreshCw className={`mr-1.5 size-3 ${syncing ? 'animate-spin' : ''}`} /> Retry Sync
					</Button>
				</div>
			)}

			{isReadOnlyMode && state.status === 'ok' && !syncError && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 shadow-sm animate-in fade-in duration-300">
					<ServerOff className="size-4 shrink-0 text-blue-600" />
					<span className="flex-1 font-semibold">
						{!isOnline
							? 'You are offline. Sections are available in read-only mode until connection returns.'
							: 'You are viewing a cached section snapshot in read-only mode.'}
					</span>
				</div>
			)}

			{dataSource === 'atlas-mirror' && !syncError && isOnline && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-sm animate-in fade-in duration-300">
					<AlertTriangle className="size-4 shrink-0 text-amber-600" />
					<span className="flex-1 font-semibold">
						EnrollPro is unreachable. You are working with ATLAS mirrored data. Home-room assignments will persist locally.
					</span>
				</div>
			)}

			{/* ── Table Container ── */}
			<div className="flex-1 min-h-0 px-6 py-4">
				<Card className="h-full flex flex-col shadow-sm border-border/50 overflow-hidden">
					<div className="flex-1 min-h-0 overflow-auto">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
								<tr className="border-b">
									<th className="px-4 py-3 text-left">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('name')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground">
											Section <SortIcon field="name" />
										</Button>
									</th>
									<th className="px-4 py-3 text-left">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('gradeLevelId')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground">
											Grade <SortIcon field="gradeLevelId" />
										</Button>
									</th>
									<th className="px-4 py-3 text-right">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('enrolledCount')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground ml-auto">
											Enrolled <SortIcon field="enrolledCount" />
										</Button>
									</th>
									<th className="px-4 py-3 text-right">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('maxCapacity')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground ml-auto">
											Capacity <SortIcon field="maxCapacity" />
										</Button>
									</th>
									<th className="px-4 py-3 text-right">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('fill')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground ml-auto">
											Fill <SortIcon field="fill" />
										</Button>
									</th>
									<th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[0.7rem]">Home Room</th>
									<th className="px-4 py-3 text-right font-semibold text-muted-foreground uppercase tracking-wider text-[0.7rem]">Actions</th>
								</tr>
							</thead>

							<tbody className="divide-y divide-border/40">
								{state.status === 'loading' ? (
									Array.from({ length: 8 }).map((_, i) => (
										<tr key={i}>
											<td className="px-4 py-4"><Skeleton className="h-5 w-48" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-16" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-12 ml-auto" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-12 ml-auto" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-14 ml-auto" /></td>
											<td className="px-4 py-4"><Skeleton className="h-8 w-44" /></td>
											<td className="px-4 py-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
										</tr>
									))
								) : paged.length === 0 ? (
									<tr>
										<td colSpan={7} className="px-4 py-20 text-center">
											<div className="flex flex-col items-center gap-4 text-muted-foreground max-w-xs mx-auto">
												<Users className="size-12 opacity-20" />
												<div className="space-y-1">
													<p className="font-bold text-foreground">
														{state.status === 'ok' ? (hasActiveFilters ? 'No sections match your filters.' : 'No sections found.') : 'Sections data unavailable.'}
													</p>
													<p className="text-xs">
														{state.status === 'ok' && !hasActiveFilters && 'Ensure the section roster is synced from the enrollment service.'}
													</p>
												</div>
											</div>
										</td>
									</tr>
								) : (
									paged.map((s) => (
										<SectionRow
											key={s.id}
											section={s}
											homeRoomOptions={homeRoomOptions}
											isReadOnly={isReadOnlyMode}
											isSaving={savingMirrorId === s.mirrorId}
											onHomeRoomChange={handleHomeRoomChange}
											onShowDetails={(section) => setDetailTarget(section)}
										/>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* ── Pagination footer ── */}
					{state.status === 'ok' && state.data.sections.length > 0 && (
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

			{/* Section Detail Drilldown */}
			<SectionDetailsSheet
				sectionId={detailTarget?.id ?? null}
				sectionName={detailTarget?.name ?? null}
				schoolYearId={activeSchoolYearId}
				open={detailTarget !== null}
				onOpenChange={(open) => !open && setDetailTarget(null)}
			/>
		</div>
	);
}
