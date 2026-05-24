import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
	GraduationCap,
	RefreshCw,
	Search,
	ServerOff,
	Users,
	X,
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

/* ─── Constants ─── */
const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50];

const GRADE_COLORS: Record<string, string> = {
	'7':  'bg-green-100/80 text-green-700',
	'8':  'bg-yellow-100/80 text-yellow-700',
	'9':  'bg-red-100/80 text-red-700',
	'10': 'bg-blue-100/80 text-blue-700',
};

const PROGRAM_BADGE: Record<string, string> = {
	STE:   'bg-emerald-50 text-emerald-700 border-emerald-200',
	SPA:   'bg-purple-50 text-purple-700 border-purple-200',
	SPS:   'bg-orange-50 text-orange-700 border-orange-200',
	SPJ:   'bg-sky-50 text-sky-700 border-sky-200',
	SPFL:  'bg-indigo-50 text-indigo-700 border-indigo-200',
	SPTVE: 'bg-amber-50 text-amber-700 border-amber-200',
	OTHER: 'bg-gray-50 text-gray-600 border-gray-200',
};

/* ─── Types ─── */
type SortField = 'name' | 'gradeLevelId' | 'enrolledCount' | 'maxCapacity' | 'fill';
type SortDir   = 'asc' | 'desc';

type SectionDetail = {
	mirrorId?:     number;
	id:            number;
	name:          string;
	maxCapacity:   number;
	enrolledCount: number;
	gradeLevelId:  number;
	gradeLevelName: string;
	homeRoomId?:   number | null;
	buildingZoneId?: string | null;
	// Special program fields (Wave 3.5)
	programType?:    string;
	programCode?:    string;
	programName?:    string;
	isSpecialProgram?: boolean;
};

type HomeRoomOption = {
	id: number;
	name: string;
	type: string;
	buildingName: string;
};

type SectionSummary = {
	schoolId:              number;
	schoolYearId:          number;
	totalSections:         number;
	totalEnrolled:         number;
	byGradeLevel:          Record<number, number>;
	enrolledByGradeLevel:  Record<number, number>;
	sections:              SectionDetail[];
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

function fillColor(pct: number) {
	if (pct >= 95) return 'bg-red-600 text-white';
	if (pct >= 85) return 'bg-amber-500 text-white';
	if (pct >= 70) return 'bg-emerald-600 text-white';
	return 'bg-muted text-muted-foreground';
}

/* ─── Component ─── */
export default function Sections() {
	const [state, setState]           = useState<FetchState>({ status: 'loading' });
	const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [syncing, setSyncing]       = useState(false);
	const [syncError, setSyncError]   = useState(false);
	const [dataSource, setDataSource] = useState<'live' | 'cached' | 'none'>('none');
	const [cacheNotice, setCacheNotice] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(() => navigator.onLine);
	const [sortField, setSortField]   = useState<SortField>('name');
	const [sortDir, setSortDir]       = useState<SortDir>('asc');
	const [page, setPage]             = useState(1);
	const [pageSize, setPageSize]     = useState(25);
	const [searchQuery, setSearchQuery] = useState('');
	const [gradeFilter, setGradeFilter] = useState<string>('all');
	const [programFilter, setProgramFilter] = useState<string>('all');
	const [homeRoomOptions, setHomeRoomOptions] = useState<HomeRoomOption[]>([]);
	const [savingMirrorId, setSavingMirrorId] = useState<number | null>(null);

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
					setDataSource('cached');
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
			const isUpstreamBacked = yearContextSource === 'enrollpro' && res.data.source === 'enrollpro';
			setDataSource(isUpstreamBacked ? 'live' : 'cached');
			setCacheNotice(
				isUpstreamBacked
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
				setDataSource('cached');
				setSyncError(true);
				setCacheNotice('Live section data is unavailable. Showing your last saved section snapshot in read-only mode.');
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
	}, []);

	const handleHomeRoomChange = useCallback(async (section: SectionDetail, selectedValue: string) => {
		if (!section.mirrorId || !activeSchoolYearId || dataSource !== 'live' || !isOnline) return;
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
			else if (sortField === 'gradeLevelId')  cmp = a.gradeLevelId - b.gradeLevelId;
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
	const isReadOnlyMode = !isOnline || dataSource !== 'live';

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

			{/* ── Compact toolbar (matches Faculty pattern) ── */}
			<div className="shrink-0 px-6 pt-3 pb-2">
				<div className="flex items-center gap-2">
					{/* Search */}
					<div className="relative flex-1 max-w-sm">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
						<Input
							placeholder="Search sections…"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 h-8 text-sm"
						/>
					</div>

					{/* Grade filter */}
					{availableGrades.length > 0 && (
						<Select value={gradeFilter} onValueChange={setGradeFilter}>
							<SelectTrigger className="h-8 w-32.5 text-xs">
								<SelectValue placeholder="All Grades" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Grades</SelectItem>
								{availableGrades.map((g) => (
									<SelectItem key={g} value={g}>G{g}</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}

					{/* Program filter */}
					{availablePrograms.length > 0 && (
						<Select value={programFilter} onValueChange={setProgramFilter}>
							<SelectTrigger className="h-8 w-32 text-xs">
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

					{/* Clear filters */}
					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							className="h-8 px-2 text-xs"
							onClick={() => { setSearchQuery(''); setGradeFilter('all'); setProgramFilter('all'); }}
						>
							<X className="size-3 mr-1" /> Clear
						</Button>
					)}

					<div className="flex-1" />

					<Badge
						variant={dataSource === 'live' ? 'secondary' : 'outline'}
						className="h-6 px-2 text-[0.7rem] uppercase tracking-wide font-bold"
					>
						{dataSource === 'live' ? 'Live data' : dataSource === 'cached' ? 'Cached snapshot' : 'No cache'}
					</Badge>

					{/* Inline stat banner — prominent, not muted */}
					{state.status === 'ok' && (
						<div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-1.5 shadow-sm shrink-0">
							<div className="flex items-center gap-1">
								<span className="text-sm font-bold text-foreground tabular-nums">{state.data.totalSections}</span>
								<span className="text-xs text-muted-foreground">sections</span>
							</div>
							<span className="text-border">·</span>
							<div className="flex items-center gap-1">
								<span className="text-sm font-bold text-foreground tabular-nums">{state.data.totalEnrolled}</span>
								<span className="text-xs text-muted-foreground">enrolled</span>
							</div>
							<span className="text-border">·</span>
							<div className="flex items-center gap-1.5">
								{Object.entries(state.data.byGradeLevel)
									.sort(([a], [b]) => Number(a) - Number(b))
									.map(([grade, count]) => (
										<Badge
											key={grade}
											variant="secondary"
											className={`h-6 px-2 text-xs font-bold border-0 ${GRADE_COLORS[grade] ?? 'bg-muted/50 text-muted-foreground'}`}
										>
											G{grade}: {count}
										</Badge>
									))}
							</div>
						</div>
					)}

					{timeSince && (
						<span className="text-[0.6875rem] text-muted-foreground shrink-0 ml-2">
							Synced: {timeSince}
						</span>
					)}

					<Button
						variant="outline"
						size="sm"
						onClick={handleSync}
						disabled={syncing || state.status === 'loading' || !isOnline}
						className="h-8 shrink-0 ml-2"
					>
						<RefreshCw className={`mr-1 size-3.5 ${syncing ? 'animate-spin' : ''}`} />
						{syncing ? 'Syncing...' : !isOnline ? 'Offline' : 'Sync'}
					</Button>
				</div>
			</div>

			{/* ── Inline error banners (slim, like Faculty) ── */}
			{state.status === 'no-year' && (
				<div className="shrink-0 mx-6 mb-2 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
					<AlertTriangle className="size-4 shrink-0" />
					<span className="flex-1">No active school year. {state.message}</span>
				</div>
			)}
			{(state.status === 'unavailable' || syncError) && (
				<div className="shrink-0 mx-6 mb-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
					<AlertTriangle className="size-4 shrink-0" />
					<span className="flex-1">
						{cacheNotice ?? (syncError ? 'Live section sync is unavailable. Showing cached data when available.' : 'Enrollment service unavailable. Showing cached data when available.')}
					</span>
					<Button size="sm" variant="outline" onClick={handleSync} disabled={syncing || !isOnline} className="shrink-0 h-7">
						<RefreshCw className={`mr-1 size-3 ${syncing ? 'animate-spin' : ''}`} /> Retry Sync
					</Button>
				</div>
			)}

			{isReadOnlyMode && state.status === 'ok' && (
				<div className="shrink-0 mx-6 mb-2 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
					<ServerOff className="size-4 shrink-0" />
					<span className="flex-1">
						{!isOnline
							? 'You are offline. Sections are available in read-only mode until connection returns.'
							: 'You are viewing a cached section snapshot in read-only mode.'}
					</span>
				</div>
			)}

			{/* ── Table (same Card shell as Faculty) ── */}
			<div className="flex-1 min-h-0 px-6 pb-4">
				<Card className="h-full flex flex-col shadow-sm overflow-hidden">
					<div className="flex-1 min-h-0 overflow-auto">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
								<tr className="border-b">
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('name')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Section <SortIcon field="name" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-left">
										<button onClick={() => toggleSort('gradeLevelId')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
											Grade <SortIcon field="gradeLevelId" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-right">
										<button onClick={() => toggleSort('enrolledCount')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground ml-auto">
											Enrolled <SortIcon field="enrolledCount" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-right">
										<button onClick={() => toggleSort('maxCapacity')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground ml-auto">
											Capacity <SortIcon field="maxCapacity" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-right">
										<button onClick={() => toggleSort('fill')} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground ml-auto">
											Fill <SortIcon field="fill" />
										</button>
									</th>
									<th className="px-4 py-2.5 text-left">
										<span className="font-semibold text-muted-foreground">Home Room</span>
									</th>
								</tr>
							</thead>

							<tbody>
								{state.status === 'loading' ? (
									/* Skeleton rows — same pattern as Faculty's tbody loading row */
									Array.from({ length: 8 }).map((_, i) => (
										<tr key={i} className="border-b last:border-0">
											<td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
											<td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
											<td className="px-4 py-3 text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
											<td className="px-4 py-3 text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
											<td className="px-4 py-3 text-right"><Skeleton className="h-5 w-12 rounded-full ml-auto" /></td>
											<td className="px-4 py-3"><Skeleton className="h-8 w-44" /></td>
										</tr>
									))
								) : paged.length === 0 ? (
									<tr>
										<td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
											<div className="flex flex-col items-center gap-2">
												{state.status === 'ok' ? (
													<>
														<Users className="size-8 text-muted-foreground/40" />
														<p>{hasActiveFilters ? 'No sections match your filters.' : 'No sections found.'}</p>
													</>
												) : (
													<>
														<GraduationCap className="size-8 text-muted-foreground/40" />
														<p>Sections data unavailable.</p>
													</>
												)}
											</div>
										</td>
									</tr>
								) : (
									paged.map((s) => {
										const fill    = s.maxCapacity > 0 ? Math.round((s.enrolledCount / s.maxCapacity) * 100) : 0;
										const gKey    = gradeKey(s.gradeLevelName);
										const gColor  = GRADE_COLORS[gKey] ?? 'bg-muted text-muted-foreground';
										const gradeLabel = `G${s.gradeLevelName.replace(/^Grade\s+/i, '')}`;

										return (
											<tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
												{/* Name cell with avatar-style initial + program badge */}
												<td className="px-4 py-3">
													<div className="flex items-center gap-3">
														<div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${GRADE_COLORS[gKey] ?? 'bg-primary/10 text-primary'}`}>
															{gKey || s.name[0]}
														</div>
														<div>
															<span className="font-medium">{s.name}</span>
															{s.isSpecialProgram && s.programCode && (
																<Badge
																	variant="outline"
																	className={`ml-2 text-[0.55rem] px-1.5 py-0 ${PROGRAM_BADGE[s.programCode] ?? PROGRAM_BADGE.OTHER}`}
																>
																	{s.programCode}
																</Badge>
															)}
														</div>
													</div>
												</td>

												{/* Grade badge */}
												<td className="px-4 py-3">
													<Badge
														variant="secondary"
														className={`px-2 font-semibold text-[0.6875rem] border-0 ${gColor}`}
													>
														{gradeLabel}
													</Badge>
												</td>

												{/* Enrolled */}
												<td className="px-4 py-3 text-right font-medium">{s.enrolledCount}</td>

												{/* Capacity */}
												<td className="px-4 py-3 text-right text-muted-foreground">{s.maxCapacity}</td>

												{/* Fill pill */}
												<td className="px-4 py-3 text-right">
													<span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${fillColor(fill)}`}>
														{fill}%
													</span>
												</td>

												<td className="px-4 py-3 min-w-56">
													<Select
														value={s.homeRoomId == null ? 'none' : String(s.homeRoomId)}
														onValueChange={(value) => {
															void handleHomeRoomChange(s, value);
														}}
														disabled={savingMirrorId === s.mirrorId || isReadOnlyMode}
													>
														<SelectTrigger className="h-8 text-xs">
															<SelectValue placeholder="Unassigned" />
														</SelectTrigger>
														<SelectContent className="max-h-72">
															<SelectItem value="none">Unassigned</SelectItem>
															{homeRoomOptions.map((room) => (
																<SelectItem key={room.id} value={String(room.id)}>
																	{room.name} • {room.buildingName}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>

					{/* ── Pagination footer (identical structure to Faculty) ── */}
					{state.status === 'ok' && state.data.sections.length > 0 && (
						<div className="shrink-0 flex items-center justify-between border-t border-border px-4 py-2 text-sm">
							<div className="flex items-center gap-2 text-muted-foreground text-xs">
								<span>{totalFiltered} result{totalFiltered !== 1 ? 's' : ''}</span>
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
		</div>
	);
}
