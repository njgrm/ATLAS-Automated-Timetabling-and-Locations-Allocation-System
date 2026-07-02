import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	Users,
	X,
	ChevronsLeft,
	ChevronsRight,
	Map as MapIcon,
	WifiOff,
	CheckCircle2,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import {
	promoteActiveSchoolYearContext,
	resolveActiveSchoolYearContext,
	type ActiveSchoolYearContextSource,
	isUpstreamBackedSchoolYearSource,
} from '@/lib/enrollpro-public-settings';
import {
	getCachedSectionHomeRooms,
	getCachedSectionSummary,
	requestWithRetry,
	setCachedSectionHomeRooms,
	setCachedSectionSummary,
} from '@/lib/faculty-teaching-load-cache';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';
import {
	AdminSearchFilterToolbar,
	AdminStatePanel,
	AdminTableShell,
	AdminWorkspaceFrame,
	type AdminSourceState,
} from '@/components/admin-workspace/AdminWorkspace';
import { SectionRow, type SectionDetail } from '@/components/sections/SectionRow';
import { type RoomOption as HomeRoomOption } from '@/components/sections/SectionRoomPicker';
import { SectionDetailsSheet } from '@/components/sections/SectionDetailsSheet';
import { SwapConfirmationModal, UnassignConfirmationModal } from '@/components/sections/SectionHomeRoomModals';
import { SectionRoomMapModal } from '@/components/sections/SectionRoomMapModal';
import { cn } from '@/lib/utils';
import type { Building, RoomSectionMetadata } from '@/components/BuildingView';

/* ─── Constants ─── */
const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50, 100];
const HOME_ROOM_QUEUE_CACHE_PREFIX = 'atlas:sections-home-room-queue:v1';

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

type HomeRoomQueueEntry = {
	sectionId: number;
	homeRoomId: number | null;
	queuedAt: string;
};

type PendingAssignment = {
	section: SectionDetail;
	roomId: number | null;
	type: 'unassign' | 'swap' | 'direct';
	displacedSection?: string;
	currentRoomName?: string | null;
	targetRoomName?: string;
};

/* ─── Helpers ─── */
function gradeKey(name: string) {
	const m = name.match(/\d+/);
	return m ? m[0] : '';
}

function homeRoomQueueKey(schoolId: number, schoolYearId: number): string {
	return `${HOME_ROOM_QUEUE_CACHE_PREFIX}:${schoolId}:${schoolYearId}`;
}

function readQueuedHomeRoomEdits(schoolId: number, schoolYearId: number): HomeRoomQueueEntry[] {
	try {
		const raw = localStorage.getItem(homeRoomQueueKey(schoolId, schoolYearId));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as HomeRoomQueueEntry[];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((item) => typeof item.sectionId === 'number');
	} catch {
		return [];
	}
}

function writeQueuedHomeRoomEdits(schoolId: number, schoolYearId: number, entries: HomeRoomQueueEntry[]): void {
	try {
		if (entries.length === 0) {
			localStorage.removeItem(homeRoomQueueKey(schoolId, schoolYearId));
			return;
		}
		localStorage.setItem(homeRoomQueueKey(schoolId, schoolYearId), JSON.stringify(entries));
	} catch {
		// Ignore storage restrictions.
	}
}

function mergeQueuedHomeRoomEdit(
	current: HomeRoomQueueEntry[],
	sectionId: number,
	homeRoomId: number | null,
): HomeRoomQueueEntry[] {
	const next = current.filter((entry) => entry.sectionId !== sectionId);
	next.push({ sectionId, homeRoomId, queuedAt: new Date().toISOString() });
	return next;
}

function applyQueuedHomeRoomEdits(sections: SectionDetail[], queued: HomeRoomQueueEntry[]): SectionDetail[] {
	if (queued.length === 0) return sections;
	const homeRoomBySection = new Map<number, number | null>(queued.map((entry) => [entry.sectionId, entry.homeRoomId]));
	return sections.map((section) => {
		if (!section.id) return section;
		if (!homeRoomBySection.has(section.id)) return section;
		return {
			...section,
			homeRoomId: homeRoomBySection.get(section.id) ?? null,
		};
	});
}

/* ─── Component ─── */
export default function Sections() {
	const [state, setState]           = useState<FetchState>({ status: 'loading' });
	const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [syncing, setSyncing]       = useState(false);
	const [syncError, setSyncError]   = useState(false);
	const [dataSource, setDataSource] = useState<'live' | 'atlas-mirror' | 'cached' | 'refreshing' | 'none'>('none');
	const [cacheNotice, setCacheNotice] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(() => navigator.onLine);
	const [queuedHomeRoomEdits, setQueuedHomeRoomEdits] = useState<HomeRoomQueueEntry[]>([]);
	const [syncingQueuedEdits, setSyncingQueuedEdits] = useState(false);
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
	const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null);
	const [globalBrowseModalOpen, setGlobalBrowseModalOpen] = useState(false);
	const [buildings, setBuildings] = useState<Building[]>([]);

	// Drilldown
	const [detailTarget, setDetailTarget] = useState<SectionDetail | null>(null);

	const fetchSections = useCallback(async (options?: { forceRefresh?: boolean }) => {
		const forceRefresh = options?.forceRefresh === true;
		setState({ status: 'loading' });
		setSyncError(false);

		let schoolYearId: number | null = null;
		let yearContextSource: ActiveSchoolYearContextSource = 'cache';
		try {
			const schoolYearContext = await resolveActiveSchoolYearContext({
				// SWR: return cached school-year immediately; background re-verify when stale.
				preferCache: !forceRefresh,
				backgroundRefresh: !forceRefresh,
				allowStaleOnError: true,
				allowEnrollProFallback: false,
			});
			schoolYearId = schoolYearContext.activeSchoolYearId;
			yearContextSource = schoolYearContext.source;
			setActiveSchoolYearId(schoolYearId);
			const queuedEditsForYear = readQueuedHomeRoomEdits(DEFAULT_SCHOOL_ID, schoolYearId);
			setQueuedHomeRoomEdits(queuedEditsForYear);

			if (!forceRefresh) {
				const cachedSummary = getCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId, {
					maxAgeMs: 3 * 60 * 1000,
				});
				const cachedHomeRooms = getCachedSectionHomeRooms<HomeRoomOption>(DEFAULT_SCHOOL_ID, schoolYearId, {
					maxAgeMs: 3 * 60 * 1000,
				});

				if (cachedSummary && cachedHomeRooms) {
					setState({
						status: 'ok',
						data: {
							...cachedSummary.data,
							sections: applyQueuedHomeRoomEdits(cachedSummary.data.sections, queuedEditsForYear),
						},
					});
					setHomeRoomOptions(cachedHomeRooms.data);
					setLastSyncedAt(cachedSummary.data.fetchedAt ? String(cachedSummary.data.fetchedAt) : null);
					setDataSource(isOnline ? 'refreshing' : 'cached');
					setCacheNotice(
						queuedEditsForYear.length > 0
							? `Showing saved section data with ${queuedEditsForYear.length} queued home-room change${queuedEditsForYear.length === 1 ? '' : 's'}.`
							: 'Refreshing live section data. Showing your last saved section snapshot in the meantime.',
					);
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

			const [summaryRes, homeRoomRes, bRes] = await Promise.all([
				requestWithRetry(
					() => atlasApi.get<SectionSummary & { code?: string }>(`/sections/summary/${schoolYearId}?schoolId=${DEFAULT_SCHOOL_ID}`),
					{ attempts: 2, delayMs: 400 },
				),
				requestWithRetry(
					() => atlasApi.get<{ rooms: HomeRoomOption[] }>(`/sections/home-rooms/${schoolYearId}?schoolId=${DEFAULT_SCHOOL_ID}`),
					{ attempts: 2, delayMs: 350 },
				),
				atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
			]);
			
			setBuildings(bRes.data.buildings);
			setHomeRoomOptions(homeRoomRes.data.rooms ?? []);
			setCachedSectionHomeRooms(DEFAULT_SCHOOL_ID, schoolYearId, homeRoomRes.data.rooms ?? []);
			if (summaryRes.data.code === 'UPSTREAM_UNAVAILABLE' && summaryRes.data.totalSections === 0) {
				setState({
					status: 'unavailable',
					message: 'Section data source is currently unavailable. Sections are sourced from the enrollment service and will appear here once the upstream API is connected.',
				});
				setDataSource('none');
				setCacheNotice(null);
				return;
			}

			const summaryWithQueuedEdits: SectionSummary = {
				...summaryRes.data,
				sections: applyQueuedHomeRoomEdits(summaryRes.data.sections, queuedEditsForYear),
			};

			setState({ status: 'ok', data: summaryWithQueuedEdits });
			setCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId, summaryWithQueuedEdits);
			setLastSyncedAt(summaryRes.data.fetchedAt ? String(summaryRes.data.fetchedAt) : null);
			
			const summaryIsLive = summaryRes.data.source === 'enrollpro';
			let nextSource: 'live' | 'atlas-mirror' | 'cached' | 'refreshing';
			if (!isOnline) {
				nextSource = 'cached';
			} else {
				const isUpstreamContext = isUpstreamBackedSchoolYearSource(yearContextSource);
				if (isUpstreamContext && summaryIsLive) {
					nextSource = 'live';
				} else if (summaryIsLive) {
					nextSource = 'refreshing';
				} else {
					nextSource = 'atlas-mirror';
				}
			}
			setDataSource(nextSource);
			
			setCacheNotice(
				queuedEditsForYear.length > 0
					? `${queuedEditsForYear.length} home-room change${queuedEditsForYear.length === 1 ? '' : 's'} queued for sync.`
					: nextSource === 'refreshing'
						? 'Checking source before finalizing live section status.'
					: nextSource === 'live'
					? null
					: isUpstreamBackedSchoolYearSource(yearContextSource)
					? 'Section data is sourced from ATLAS mirror. EnrollPro connection is active.'
					: 'Section data is available from ATLAS runtime cache while upstream verification is unavailable.',
			);

			if (nextSource === 'refreshing') {
				void promoteActiveSchoolYearContext({ allowEnrollProFallback: false, allowStaleOnError: true })
					.then((promotedContext) => {
						if (isUpstreamBackedSchoolYearSource(promotedContext.source) && summaryIsLive) {
							setDataSource('live');
							setCacheNotice(
								queuedEditsForYear.length > 0
									? `${queuedEditsForYear.length} home-room change${queuedEditsForYear.length === 1 ? '' : 's'} queued for sync.`
									: null,
							);
							return;
						}
						setDataSource('atlas-mirror');
						setCacheNotice(
							queuedEditsForYear.length > 0
								? `${queuedEditsForYear.length} home-room change${queuedEditsForYear.length === 1 ? '' : 's'} queued for sync.`
								: 'Section data is available from ATLAS runtime cache while upstream verification is unavailable.',
						);
					})
					.catch(() => {
						setDataSource('atlas-mirror');
						setCacheNotice(
							queuedEditsForYear.length > 0
								? `${queuedEditsForYear.length} home-room change${queuedEditsForYear.length === 1 ? '' : 's'} queued for sync.`
								: 'Section data is available from ATLAS runtime cache while upstream verification is unavailable.',
						);
					});
			}
		} catch {
			const cachedSummary = schoolYearId ? getCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId) : null;
			const cachedHomeRooms = schoolYearId ? getCachedSectionHomeRooms<HomeRoomOption>(DEFAULT_SCHOOL_ID, schoolYearId) : null;
			const queuedEditsForYear = schoolYearId ? readQueuedHomeRoomEdits(DEFAULT_SCHOOL_ID, schoolYearId) : [];
			setQueuedHomeRoomEdits(queuedEditsForYear);

			if (cachedSummary && cachedHomeRooms) {
				setState({
					status: 'ok',
					data: {
						...cachedSummary.data,
						sections: applyQueuedHomeRoomEdits(cachedSummary.data.sections, queuedEditsForYear),
					},
				});
				setHomeRoomOptions(cachedHomeRooms.data);
				setLastSyncedAt(cachedSummary.data.fetchedAt ? String(cachedSummary.data.fetchedAt) : null);
				setDataSource(isOnline ? 'atlas-mirror' : 'cached');
				setSyncError(true);
				setCacheNotice(isOnline 
					? queuedEditsForYear.length > 0
						? `Live section data is unavailable. Using saved data with ${queuedEditsForYear.length} queued home-room change${queuedEditsForYear.length === 1 ? '' : 's'}.`
						: 'Live section data is unavailable. Showing your last saved section snapshot in degraded writable mode.'
					: queuedEditsForYear.length > 0
					? `Offline mode: ${queuedEditsForYear.length} queued home-room change${queuedEditsForYear.length === 1 ? '' : 's'} will sync after reconnect.`
					: 'Live section data is unavailable. Showing your last saved section snapshot in offline mode.');
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

	const performHomeRoomUpdate = useCallback(async (section: SectionDetail, nextHomeRoomId: number | null, swapTarget?: { sectionId: number, homeRoomId: number | null }) => {
		if (!section.id || !activeSchoolYearId || state.status !== 'ok' || dataSource === 'refreshing') return;
		setSavingMirrorId(section.id);

		const applyOptimisticHomeRoom = () => {
			setState((prev) => {
				if (prev.status !== 'ok') return prev;
				const nextData = {
					...prev.data,
					sections: prev.data.sections.map((item) => {
						if (item.id === section.id) return { ...item, homeRoomId: nextHomeRoomId };
						if (swapTarget && item.id === swapTarget.sectionId) return { ...item, homeRoomId: swapTarget.homeRoomId };
						return item;
					}),
				};
				setCachedSectionSummary(DEFAULT_SCHOOL_ID, activeSchoolYearId, nextData);
				return { status: 'ok', data: nextData };
			});
		};

		if (!isOnline) {
			applyOptimisticHomeRoom();
			setQueuedHomeRoomEdits((current) => {
				let next = mergeQueuedHomeRoomEdit(current, section.id, nextHomeRoomId);
				if (swapTarget) next = mergeQueuedHomeRoomEdit(next, swapTarget.sectionId, swapTarget.homeRoomId);
				writeQueuedHomeRoomEdits(DEFAULT_SCHOOL_ID, activeSchoolYearId, next);
				return next;
			});
			setCacheNotice('Home-room change saved locally and queued for sync when your connection is restored.');
			setSavingMirrorId(null);
			return;
		}

		try {
			const assignments = [{ sectionId: section.id, homeRoomId: nextHomeRoomId }];
			if (swapTarget) assignments.push({ sectionId: swapTarget.sectionId, homeRoomId: swapTarget.homeRoomId });

			await atlasApi.put(`/sections/home-rooms/${activeSchoolYearId}`, {
				schoolId: DEFAULT_SCHOOL_ID,
				assignments,
			});
			applyOptimisticHomeRoom();
		} catch (error) {
			console.error('Failed to update home room:', error);
			applyOptimisticHomeRoom();
			setQueuedHomeRoomEdits((current) => {
				let next = mergeQueuedHomeRoomEdit(current, section.id, nextHomeRoomId);
				if (swapTarget) next = mergeQueuedHomeRoomEdit(next, swapTarget.sectionId, swapTarget.homeRoomId);
				writeQueuedHomeRoomEdits(DEFAULT_SCHOOL_ID, activeSchoolYearId, next);
				return next;
			});
			setCacheNotice('Home-room change saved locally. It will sync after the section service is reachable.');
		} finally {
			setSavingMirrorId(null);
		}
	}, [activeSchoolYearId, dataSource, isOnline, state.status]);

	const roomOccupancyMap = useMemo(() => {
		const map = new Map<number, string>();
		if (state.status !== 'ok') return map;
		state.data.sections.forEach((s) => {
			if (s.homeRoomId) map.set(s.homeRoomId, s.name);
		});
		return map;
	}, [state]);

	const roomSectionDataMap = useMemo(() => {
		const map = new Map<number, RoomSectionMetadata>();
		if (state.status !== 'ok') return map;
		state.data.sections.forEach((s) => {
			if (s.homeRoomId) {
				map.set(s.homeRoomId, {
					sectionName: s.name,
					gradeKey: gradeKey(s.gradeLevelName),
					programCode: s.programCode,
				});
			}
		});
		return map;
	}, [state]);

	const handleHomeRoomChange = useCallback(async (section: SectionDetail, nextHomeRoomId: number | null) => {
		if (!section.id || !activeSchoolYearId || state.status !== 'ok' || dataSource === 'none' || dataSource === 'refreshing') return;
		
		if (nextHomeRoomId === null && section.homeRoomId) {
			setPendingAssignment({
				section,
				roomId: null,
				type: 'unassign',
				currentRoomName: homeRoomOptions.find(r => r.id === section.homeRoomId)?.name ?? 'Unknown Room'
			});
			return;
		}
		
		if (nextHomeRoomId !== null && roomOccupancyMap.has(nextHomeRoomId) && section.homeRoomId !== nextHomeRoomId) {
			const displacedSectionName = roomOccupancyMap.get(nextHomeRoomId)!;
			const targetRoomName = homeRoomOptions.find(r => r.id === nextHomeRoomId)?.name ?? 'Unknown Room';
			setPendingAssignment({
				section,
				roomId: nextHomeRoomId,
				type: 'swap',
				displacedSection: displacedSectionName,
				currentRoomName: section.homeRoomId ? (homeRoomOptions.find(r => r.id === section.homeRoomId)?.name ?? 'Unknown Room') : null,
				targetRoomName
			});
			return;
		}

		void performHomeRoomUpdate(section, nextHomeRoomId);
	}, [activeSchoolYearId, dataSource, homeRoomOptions, roomOccupancyMap, state.status, performHomeRoomUpdate]);

	const handleSync = async () => {
		if (!isOnline) {
			setSyncError(true);
			setCacheNotice('You are offline. Reconnect before syncing Sections.');
			return;
		}
		setSyncing(true);
		setSyncError(false);
		try {
			const { data } = await atlasApi.post('/sections/sync', { schoolId: DEFAULT_SCHOOL_ID });
			if (data.synced) await fetchSections({ forceRefresh: true });
			else setSyncError(true);
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

	useEffect(() => { 
		void fetchSections({}); 
	}, [fetchSections]);

	useEffect(() => {
		const handleOnline = () => { setIsOnline(true); void fetchSections({ forceRefresh: true }); };
		const handleOffline = () => setIsOnline(false);
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, [fetchSections]);

	const flushQueuedHomeRoomEdits = useCallback(async () => {
		if (!activeSchoolYearId || !isOnline || syncingQueuedEdits || queuedHomeRoomEdits.length === 0) return;

		const dedupedAssignments = Array.from(
			queuedHomeRoomEdits.reduce((map, item) => {
				map.set(item.sectionId, item.homeRoomId);
				return map;
			}, new Map<number, number | null>()).entries(),
		).map(([sectionId, homeRoomId]) => ({ sectionId, homeRoomId }));

		setSyncingQueuedEdits(true);
		try {
			await atlasApi.put(`/sections/home-rooms/${activeSchoolYearId}`, {
				schoolId: DEFAULT_SCHOOL_ID,
				assignments: dedupedAssignments,
			});
			writeQueuedHomeRoomEdits(DEFAULT_SCHOOL_ID, activeSchoolYearId, []);
			setQueuedHomeRoomEdits([]);
			setSyncError(false);
			await fetchSections({ forceRefresh: true });
		} catch {
			setSyncError(true);
		} finally {
			setSyncingQueuedEdits(false);
		}
	}, [activeSchoolYearId, fetchSections, isOnline, queuedHomeRoomEdits, syncingQueuedEdits]);

	useEffect(() => { void flushQueuedHomeRoomEdits(); }, [flushQueuedHomeRoomEdits]);

	useEffect(() => { setPage(1); }, [searchQuery, gradeFilter, programFilter, pageSize]);

	const { paged, totalFiltered, totalPages, assignedCount } = useMemo(() => {
		if (state.status !== 'ok') return { paged: [], totalFiltered: 0, totalPages: 1, assignedCount: 0 };
		let list = state.data.sections;
		const ac = list.filter(s => !!s.homeRoomId).length;

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter((s) => s.name.toLowerCase().includes(q) || s.gradeLevelName.toLowerCase().includes(q));
		}
		if (gradeFilter !== 'all') list = list.filter((s) => gradeKey(s.gradeLevelName) === gradeFilter);
		if (programFilter !== 'all') {
			if (programFilter === 'REGULAR') list = list.filter((s) => !s.isSpecialProgram);
			else list = list.filter((s) => s.programType === programFilter);
		}

		const sorted = [...list].sort((a, b) => {
			let cmp = 0;
			if (sortField === 'name') cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
			else if (sortField === 'gradeLevelId') {
				cmp = a.gradeLevelId - b.gradeLevelId;
				if (cmp === 0) cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
			}
			else if (sortField === 'enrolledCount') cmp = a.enrolledCount - b.enrolledCount;
			else if (sortField === 'maxCapacity') cmp = a.maxCapacity - b.maxCapacity;
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
		return { paged: sorted.slice(start, start + pageSize), totalFiltered: tf, totalPages: tp, assignedCount: ac };
	}, [state, searchQuery, gradeFilter, programFilter, sortField, sortDir, page, pageSize]);

	const hasActiveFilters = gradeFilter !== 'all' || searchQuery.trim() !== '' || programFilter !== 'all';

	const buildingOccupancy = useMemo(() => {
		const map = new Map<number, number>();
		buildings.forEach(b => {
			if (!b.rooms || b.rooms.length === 0) {
				map.set(b.id, 0);
				return;
			}
			// Be robust: treat as teaching space if explicitly true or if type is a standard teaching type
			const teachingRooms = b.rooms.filter((r: import('@/types').Room) => 
				r.isTeachingSpace === true || 
				(!['LIBRARY', 'FACULTY_ROOM', 'OFFICE', 'OTHER'].includes(r.type))
			);
			
			if (teachingRooms.length === 0) { 
				map.set(b.id, 0); 
				return; 
			}
			
			const occupiedCount = teachingRooms.filter((r: import('@/types').Room) => roomOccupancyMap.has(r.id)).length;
			const pct = (occupiedCount / teachingRooms.length) * 100;
			map.set(b.id, pct);
		});
		return map;
	}, [buildings, roomOccupancyMap]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else { setSortField(field); setSortDir('asc'); }
	};

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) return <ArrowUpDown className="size-3 text-muted-foreground/50" />;
		return sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
	};

	const availableGrades = useMemo(() => {
		if (state.status !== 'ok') return [];
		const keys = new Set<string>();
		state.data.sections.forEach((s) => { const k = gradeKey(s.gradeLevelName); if (k) keys.add(k); });
		return Array.from(keys).sort((a, b) => Number(a) - Number(b));
	}, [state]);

	const availablePrograms = useMemo(() => {
		if (state.status !== 'ok') return [];
		const types = new Set<string>();
		state.data.sections.forEach((s) => { if (s.isSpecialProgram && s.programType) types.add(s.programType); });
		return Array.from(types).sort();
	}, [state]);

	const isReadOnlyMode = state.status !== 'ok' || dataSource === 'none' || dataSource === 'refreshing' || !activeSchoolYearId;

	const sectionSourceState = useMemo<AdminSourceState>(() => {
		if (dataSource === 'live') return 'verified-live';
		if (dataSource === 'refreshing' || state.status === 'loading') return 'checking-source';
		if (dataSource === 'cached' || dataSource === 'atlas-mirror') return 'saved-data';
		return 'no-saved-data';
	}, [dataSource, state.status]);

	const sectionStats = useMemo(() => {
		if (state.status !== 'ok') {
			return [
				{ label: 'Sections', value: state.status === 'loading' ? '...' : 0, tone: state.status === 'loading' ? 'info' as const : 'warning' as const },
			];
		}

		const assignmentPct = state.data.totalSections > 0 ? Math.round((assignedCount / state.data.totalSections) * 100) : 0;
		const sectionsNeedingRooms = Math.max(0, state.data.totalSections - assignedCount);
		return [
			{ label: 'Sections', value: state.data.totalSections, tone: 'brand' as const, helpText: 'Total section rosters available for the active school year.' },
			{ label: 'Home rooms assigned', value: `${assignedCount}/${state.data.totalSections}`, tone: assignmentPct === 100 ? 'success' as const : 'warning' as const, helpText: `${assignmentPct}% of sections already have a home room.` },
			{ label: 'Need rooms', value: sectionsNeedingRooms, tone: sectionsNeedingRooms === 0 ? 'success' as const : 'warning' as const, helpText: sectionsNeedingRooms === 0 ? 'Every visible section has a home room.' : 'Assign these sections before schedule generation.' },
			...(queuedHomeRoomEdits.length > 0 ? [{ label: 'Queued', value: queuedHomeRoomEdits.length, tone: 'info' as const, helpText: 'Home-room changes saved locally and waiting to sync.' }] : []),
		];
	}, [assignedCount, queuedHomeRoomEdits.length, state]);

	const homeRoomEditStatus = useMemo(() => {
		if (!activeSchoolYearId || state.status !== 'ok' || dataSource === 'none') {
			return {
				tone: 'blocked' as const,
				message: 'Home-room edits are blocked until ATLAS has a section roster for the active school year.',
			};
		}
		if (dataSource === 'refreshing') {
			return {
				tone: 'checking' as const,
				message: 'Home-room edits are paused while ATLAS checks the roster source. Review the list now, then save room changes when the source settles.',
			};
		}
		if (!isOnline) {
			return {
				tone: 'queued' as const,
				message: 'You are offline. Home-room changes save on this device and sync when the connection returns.',
			};
		}
		if (queuedHomeRoomEdits.length > 0) {
			return {
				tone: 'queued' as const,
				message: `${queuedHomeRoomEdits.length} home-room change${queuedHomeRoomEdits.length === 1 ? '' : 's'} will sync before the page is final.`,
			};
		}
		return {
			tone: 'ready' as const,
			message: 'Home-room edits are writable. Pick a room from the row or review the room map before changing assignments.',
		};
	}, [activeSchoolYearId, dataSource, isOnline, queuedHomeRoomEdits.length, state.status]);

	const PROGRAM_FILTER_COLORS: Record<string, string> = {
		STE:   'bg-emerald-100/80 text-emerald-700',
		SPA:   'bg-purple-100/80 text-purple-700',
		SPS:   'bg-orange-100/80 text-orange-700',
		SPJ:   'bg-sky-100/80 text-sky-700',
		SPFL:  'bg-indigo-100/80 text-indigo-700',
		SPTVE: 'bg-amber-100/80 text-amber-700',
		REGULAR: 'bg-slate-100/80 text-slate-700',
	};

	return (
		<AdminWorkspaceFrame
			title = "Sections"
			description="Verify section roster data and home-room readiness before schedule generation. Start by syncing sections, then assign a home room to every section that still needs one."
			sourceState={sectionSourceState}
			sourceCopy={{
				description:
					sectionSourceState === 'verified-live'
						? 'Sections were checked against the live roster source for the current school year, and home-room edits can be saved when you are online.'
						: sectionSourceState === 'checking-source'
						? 'ATLAS is verifying the roster source while the saved section list stays visible, so room edits are paused for now.'
						: sectionSourceState === 'saved-data'
						? isOnline ? 'ATLAS is showing the last safe section mirror because the live source is not fully verified. Home-room edits can be queued if saving fails.' : 'ATLAS is showing the last saved section mirror. Home-room edits will be queued on this device until you reconnect.'
						: 'ATLAS has no safe section roster to show yet.',
				nextAction:
					sectionSourceState === 'verified-live'
						? 'Sync if the roster changed, then assign rooms for sections that still need one.'
						: sectionSourceState === 'checking-source'
						? 'Review roster readiness now, then wait before final home-room changes.'
						: sectionSourceState === 'saved-data'
						? 'Reconnect or sync before treating this as final roster truth.'
						: 'Reconnect and sync sections before this page can be used.',
			}}
			stats={sectionStats}
			secondaryActions={(
				<Button
					variant="outline"
					size="sm"
					className="h-9 gap-2 border-primary/20 bg-primary/5 font-bold text-primary hover:bg-primary/10"
					onClick={() => setGlobalBrowseModalOpen(true)}
				>
					<MapIcon className="size-4" />
					<span className="hidden sm:inline">Browse room map</span>
					<span className="sm:hidden">Rooms</span>
				</Button>
			)}
			primaryActions={(
				<Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || syncingQueuedEdits || state.status === 'loading' || !isOnline} className="h-9 gap-2 shadow-sm font-bold">
					<RefreshCw className={`size-4 ${syncing || syncingQueuedEdits ? 'animate-spin' : ''}`} />
					<span className="hidden sm:inline">{syncing || syncingQueuedEdits ? 'Syncing...' : !isOnline ? 'Offline' : 'Sync sections'}</span>
					<span className="sm:hidden">{syncing || syncingQueuedEdits ? '' : 'Sync'}</span>
				</Button>
			)}
			toolbar={(
				<AdminSearchFilterToolbar
					searchValue={searchQuery}
					onSearchChange={setSearchQuery}
					searchPlaceholder="Search sections..."
					filtersOpen={showFilters}
					onToggleFilters={() => setShowFilters(!showFilters)}
					hasActiveFilters={hasActiveFilters}
				>
					<div className="flex md:hidden items-center gap-2">
							<Select value={gradeFilter} onValueChange={setGradeFilter}>
								<SelectTrigger className="h-8 flex-1 text-xs">
									<SelectValue placeholder="All Grades" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Grades</SelectItem>
									{availableGrades.map(g => (
										<SelectItem key={g} value={g}>Grade {g}</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select value={programFilter} onValueChange={setProgramFilter}>
								<SelectTrigger className="h-8 flex-1 text-xs">
									<SelectValue placeholder="All Programs" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Programs</SelectItem>
									<SelectItem value="REGULAR">Regular Program</SelectItem>
									{availablePrograms.map(p => (
										<SelectItem key={p} value={p}>{p}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="hidden md:flex flex-wrap items-center gap-6">
							<div className="flex items-center gap-2">
								<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Grade Level:</span>
								<div className="flex bg-muted/30 p-0.5 rounded-lg border border-border/50">
									<Button 
										variant={gradeFilter === 'all' ? 'secondary' : 'ghost'} 
										size="sm" 
										className="h-8 px-3 text-xs font-bold" 
										onClick={() => setGradeFilter('all')}
									>
										All
									</Button>
									{availableGrades.map(g => (
										<Button 
											key={g} 
											variant={gradeFilter === g ? 'secondary' : 'ghost'} 
											size="sm" 
											className={cn("h-8 px-3 text-xs font-bold", gradeFilter === g && GRADE_COLORS[g])} 
											onClick={() => setGradeFilter(g)}
										>
											G{g}
										</Button>
									))}
								</div>
							</div>

							<div className="flex items-center gap-2">
								<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Program Type:</span>
								<div className="flex bg-muted/30 p-0.5 rounded-lg border border-border/50 flex-wrap">
									<Button 
										variant={programFilter === 'all' ? 'secondary' : 'ghost'} 
										size="sm" 
										className="h-8 px-3 text-xs font-bold" 
										onClick={() => setProgramFilter('all')}
									>
										All
									</Button>
									<Button 
										variant={programFilter === 'REGULAR' ? 'secondary' : 'ghost'} 
										size="sm" 
										className={cn("h-8 px-3 text-xs font-bold", programFilter === 'REGULAR' && PROGRAM_FILTER_COLORS.REGULAR)} 
										onClick={() => setProgramFilter('REGULAR')}
									>
										Regular
									</Button>
									{availablePrograms.map(p => (
										<Button 
											key={p} 
											variant={programFilter === p ? 'secondary' : 'ghost'} 
											size="sm" 
											className={cn("h-8 px-3 text-xs font-bold", programFilter === p && (PROGRAM_FILTER_COLORS[p] || 'bg-blue-50 text-blue-700'))} 
											onClick={() => setProgramFilter(p)}
										>
											{p}
										</Button>
									))}
								</div>
							</div>

							{hasActiveFilters && (
								<Button
									variant="ghost"
									size="sm"
									className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground font-bold"
									onClick={() => { 
										setGradeFilter('all'); 
										setProgramFilter('all'); 
										setSearchQuery('');
									}}
								>
									<X className="size-3 mr-1" />
									Reset Filters
								</Button>
							)}
						</div>
				</AdminSearchFilterToolbar>
			)}
		>

			{/* Status Banners */}
			{state.status === 'no-year' && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 shadow-sm animate-in fade-in duration-300">
					<AlertTriangle className="size-4 shrink-0 text-blue-600" />
					<span className="flex-1 font-semibold">No active school year. {state.message}</span>
				</div>
			)}
			{(state.status === 'unavailable' || syncError) && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-sm animate-in fade-in duration-300">
					<AlertTriangle className="size-4 shrink-0 text-amber-600" />
					<span className="flex-1 font-semibold text-amber-900">{cacheNotice ?? (syncError ? 'EnrollPro is temporarily unavailable.' : 'Enrollment service unavailable.')}</span>
					<Button size="sm" variant="outline" onClick={handleSync} disabled={syncing || !isOnline} className="shrink-0 h-7 border-amber-300 hover:bg-amber-100 text-amber-900 font-bold"><RefreshCw className={`mr-1.5 size-3 ${syncing ? 'animate-spin' : ''}`} /> Retry Sync</Button>
				</div>
			)}
			{state.status === 'ok' && (
				<div className={cn(
					"pointer-events-none shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-sm animate-in fade-in duration-300",
					homeRoomEditStatus.tone === 'ready' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
					homeRoomEditStatus.tone === 'queued' && 'border-sky-200 bg-sky-50 text-sky-900',
					homeRoomEditStatus.tone === 'checking' && 'border-amber-200 bg-amber-50 text-amber-900',
					homeRoomEditStatus.tone === 'blocked' && 'border-red-200 bg-red-50 text-red-900',
				)}>
					{homeRoomEditStatus.tone === 'ready' ? <CheckCircle2 className="size-4 shrink-0" /> : homeRoomEditStatus.tone === 'queued' ? <WifiOff className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
					<span className="flex-1 font-semibold">{homeRoomEditStatus.message}</span>
				</div>
			)}

			<AdminTableShell
				footer={state.status === 'ok' && state.data.sections.length > 0 ? (
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
							<span>{totalFiltered === 0 ? 'No results' : `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalFiltered)} of ${totalFiltered} results`}</span>
							<div className="flex items-center gap-2 border-l pl-4 border-border/50">
								<span>Rows per page:</span>
								<Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}><SelectTrigger className="h-7 w-20 text-xs bg-background"><SelectValue /></SelectTrigger><SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent></Select>
							</div>
						</div>
						<div className="flex items-center gap-1.5"><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={page <= 1}><ChevronsLeft className="size-4" /></Button><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft className="size-4" /></Button><div className="flex items-center gap-1.5 px-3 h-8 rounded-md border bg-background text-xs font-bold tabular-nums"><span>{page}</span><span className="text-muted-foreground/50 font-normal">/</span><span className="text-muted-foreground font-normal">{totalPages}</span></div><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><ChevronRight className="size-4" /></Button><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={page >= totalPages}><ChevronsRight className="size-4" /></Button></div>
					</div>
				) : undefined}
			>
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
								<tr className="border-b">
									<th className="px-4 py-3 text-left">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('name')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground">Section <SortIcon field="name" /></Button>
									</th>
									<th className="px-4 py-3 text-left">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('gradeLevelId')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground">Grade <SortIcon field="gradeLevelId" /></Button>
									</th>
									<th className="px-4 py-3 text-right">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('enrolledCount')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground ml-auto">Enrolled <SortIcon field="enrolledCount" /></Button>
									</th>
									<th className="px-4 py-3 text-right">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('maxCapacity')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground ml-auto">Capacity <SortIcon field="maxCapacity" /></Button>
									</th>
									<th className="px-4 py-3 text-right">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('fill')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground ml-auto">Status <SortIcon field="fill" /></Button>
									</th>
									<th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">Home-room readiness</th>
									<th className="px-4 py-3 text-right font-semibold text-muted-foreground uppercase tracking-wider text-xs">Details</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/40">
								{state.status === 'loading' ? (
									Array.from({ length: 8 }).map((_, i) => (
										<tr key={i}><td className="px-4 py-4"><Skeleton className="h-5 w-48" /></td><td className="px-4 py-4"><Skeleton className="h-5 w-16" /></td><td className="px-4 py-4"><Skeleton className="h-5 w-12 ml-auto" /></td><td className="px-4 py-4"><Skeleton className="h-5 w-12 ml-auto" /></td><td className="px-4 py-4"><Skeleton className="h-5 w-14 ml-auto" /></td><td className="px-4 py-4"><Skeleton className="h-8 w-44" /></td><td className="px-4 py-4"><Skeleton className="h-8 w-24 ml-auto" /></td></tr>
									))
								) : paged.length === 0 ? (
									<tr><td colSpan={7} className="px-4 py-20 text-center"><AdminStatePanel icon={<Users className="size-8" />} title = {state.status === 'ok' ? 'No sections match your filters.' : 'Sections data unavailable.'} description={state.status === 'ok' ? 'Clear a filter or search another section name to continue.' : 'Reconnect or sync sections before assigning home rooms.'} /></td></tr>
								) : (
									paged.map((s) => (
										<SectionRow key={s.id} section={s} homeRoomOptions={homeRoomOptions} isReadOnly={isReadOnlyMode} isSaving={savingMirrorId === s.id} onHomeRoomChange={handleHomeRoomChange} onShowDetails={(section) => setDetailTarget(section)} schoolId={DEFAULT_SCHOOL_ID} roomOccupancy={roomOccupancyMap} />
									))
								)}
							</tbody>
						</table>
			</AdminTableShell>

			<SectionDetailsSheet
				sectionId={detailTarget?.id ?? null}
				sectionName={detailTarget?.name ?? null}
				section={detailTarget}
				homeRoom={detailTarget?.homeRoomId ? homeRoomOptions.find((room) => room.id === detailTarget.homeRoomId) ?? null : null}
				schoolYearId={activeSchoolYearId}
				open={detailTarget !== null}
				onOpenChange={(open) => !open && setDetailTarget(null)}
			/>

			<SectionRoomMapModal 
				open={globalBrowseModalOpen} 
				onOpenChange={setGlobalBrowseModalOpen} 
				sectionName="Global Browse" 
				sectionId={0} 
				currentRoomId={null} 
				onSelect={() => {}} 
				schoolId={DEFAULT_SCHOOL_ID} 
				roomOccupancy={roomOccupancyMap}
				roomSectionData={roomSectionDataMap}
				buildingOccupancy={buildingOccupancy}
			/>

			{pendingAssignment && (
				<>
					<SwapConfirmationModal open={pendingAssignment.type === 'swap'} onOpenChange={(open) => !open && setPendingAssignment(null)} onConfirm={() => { const { section, roomId } = pendingAssignment; if (state.status !== 'ok') return; const displaced = state.data.sections.find(s => s.homeRoomId === roomId); void performHomeRoomUpdate(section, roomId, displaced ? { sectionId: displaced.id, homeRoomId: section.homeRoomId ?? null } : undefined); setPendingAssignment(null); }} sourceSectionName={pendingAssignment.section.name} targetRoomName={pendingAssignment.targetRoomName ?? ''} displacedSectionName={pendingAssignment.displacedSection ?? ''} currentRoomName={pendingAssignment.currentRoomName} isSaving={savingMirrorId !== null} />
					<UnassignConfirmationModal open={pendingAssignment.type === 'unassign'} onOpenChange={(open) => !open && setPendingAssignment(null)} onConfirm={() => { void performHomeRoomUpdate(pendingAssignment.section, null); setPendingAssignment(null); }} sectionName={pendingAssignment.section.name} currentRoomName={pendingAssignment.currentRoomName ?? ''} isSaving={savingMirrorId !== null} />
				</>
			)}
		</AdminWorkspaceFrame>
	);
}
