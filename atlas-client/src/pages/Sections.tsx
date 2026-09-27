import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ChevronLeft,
	ChevronRight,
	Users,
	ChevronsLeft,
	ChevronsRight,
	Map as MapIcon,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import {
	promoteActiveSchoolYearContext,
	resolveActiveSchoolYearContext,
	type ActiveSchoolYearContextSource,
	isUpstreamBackedSchoolYearSource,
} from '@/lib/enrollpro-public-settings';
import { useActorSchoolScope } from '@/lib/actor-scope-session';
import { isResolvedActorSchoolId } from '@/lib/term-authority-repair-scope';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import {
	AdminSearchFilterToolbar,
	AdminStatePanel,
	AdminTableShell,
	AdminWorkspaceFrame,
	type AdminSourceState,
} from '@/components/admin-workspace/AdminWorkspace';
import { SectionRow, type SectionDetail } from '@/components/sections/SectionRow';
import { SectionRoomPicker, type RoomOption as HomeRoomOption } from '@/components/sections/SectionRoomPicker';
import { SectionDetailsSheet } from '@/components/sections/SectionDetailsSheet';
import { SectionRoomMapModal } from '@/components/sections/SectionRoomMapModal';
import { HomeRoomAutoAssignDialog } from '@/components/sections/HomeRoomAutoAssignDialog';
import { SectionsHomeRoomActions } from '@/components/sections/SectionsHomeRoomActions';
import { SectionMobileCard } from '@/components/sections/SectionMobileCard';
import {
	buildHomeRoomsStat,
	isHomeRoomResolved,
	resolveHomeRoom,
	summarizeHomeRoomReadiness,
} from '@/components/sections/home-room-readiness';
import { SectionsFilterToolbar } from '@/components/sections/SectionsFilterToolbar';
import { SortableSectionHeader, type SortDir, type SortField } from '@/components/sections/SectionsSortableHeader';
import { SectionsStatusBanners } from '@/components/sections/SectionsStatusBanners';
import { deriveBuildingOccupancy } from '@/components/sections/buildingOccupancy';
import {
	applyQueuedHomeRoomEdits,
	mergeQueuedHomeRoomEdit,
	readQueuedHomeRoomEdits,
	writeQueuedHomeRoomEdits,
	type HomeRoomQueueEntry,
} from '@/components/sections/homeRoomEditQueue';
import {
	persistHomeRoomAssignment,
	resolveHomeRoomIntent,
	type HomeRoomUpdateResult,
} from '@/components/sections/homeRoomPersistence';
import { HomeRoomConfirmDialogs, type PendingAssignment } from '@/components/sections/HomeRoomConfirmDialogs';
import { deriveHomeRoomEditStatus } from '@/components/sections/homeRoomEditStatus';
import type { RoomSectionMetadata } from '@/components/BuildingView';
import type { Building, SectionSummaryResponse } from '@/types';
import { ActorScopedRolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';

/* ─── Constants ─── */
const PAGE_SIZES = [10, 25, 50, 100];

/* ─── Types ─── */
type SectionSummary = SectionSummaryResponse;

type FetchState =
	| { status: 'loading' }
	| { status: 'ok'; data: SectionSummary }
	| { status: 'unavailable'; message: string }
	| { status: 'no-year'; message: string };

/* A3 fix 12 — PendingAssignment now lives with the confirmation surface that
 * owns it (components/sections/HomeRoomConfirmDialogs.tsx), so the escalation
 * and the write it performs cannot drift apart. A3 C4 (B1) — the offline edit
 * queue and the sortable column header likewise moved to
 * components/sections/homeRoomEditQueue.ts and SectionsSortableHeader.tsx, and
 * the status banners to SectionsStatusBanners.tsx; the page is a coordinator
 * again, and the explanatory notes moved with the code they describe. */

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
	const [homeRoomFilter, setHomeRoomFilter] = useState<'all' | 'missing' | 'assigned'>('all');
	const [homeRoomOptions, setHomeRoomOptions] = useState<HomeRoomOption[]>([]);
	const [savingMirrorId, setSavingMirrorId] = useState<number | null>(null);
	const [showFilters, setShowFilters] = useState(false);
	const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null);
	const [globalBrowseModalOpen, setGlobalBrowseModalOpen] = useState(false);
	// A3 C4 (top-10 #3): the room map was only reachable by opening a row's
	// home-room dropdown and choosing "Browse Interactive Map" — two clicks
	// deep, so the map read as absent. Each row now carries a visible,
	// labelled control that opens the SAME `SectionRoomMapModal` for that row's
	// section. `null` means closed; a section means "open for this section".
	// Distinct from `globalBrowseModalOpen`, which stays the school-wide
	// browse surface and keeps its own sectionId={0} / currentRoomId={null}.
	const [mapTarget, setMapTarget] = useState<SectionDetail | null>(null);
	const [autoAssignOpen, setAutoAssignOpen] = useState(false);
	const [buildings, setBuildings] = useState<Building[]>([]);

	// Drilldown
	const [detailTarget, setDetailTarget] = useState<SectionDetail | null>(null);
	const { actorSchoolId } = useActorSchoolScope();
	// ACTOR-SCOPE-C01: only a strict positive actor school may reach a scoped
	// child. `null` means unresolved — children are not mounted at all.
	const scopedSchoolId = isResolvedActorSchoolId(actorSchoolId) ? actorSchoolId : null;

	useEffect(() => {
		// An actor-school change (including unresolved) is authoritative: clear
		// the year/drilldown state and close the map/auto-assign surfaces so no
		// child survives across the change with the previous scope's school.
		setActiveSchoolYearId(null);
		setDetailTarget(null);
		setGlobalBrowseModalOpen(false);
		setMapTarget(null);
		setAutoAssignOpen(false);
	}, [actorSchoolId]);

	const fetchSections = useCallback(async (options?: { forceRefresh?: boolean }) => {
		if (actorSchoolId == null) {
			setState({ status: 'loading' });
			setSyncError(false);
			setDataSource('none');
			return;
		}
		const scopedSchoolId = actorSchoolId;
		const forceRefresh = options?.forceRefresh === true;
		setState({ status: 'loading' });
		setSyncError(false);

		let schoolYearId: number | null = null;
		let yearContextSource: ActiveSchoolYearContextSource = 'cache';
		try {
			const schoolYearContext = await resolveActiveSchoolYearContext({
				schoolId: scopedSchoolId,
				// SWR: return cached school-year immediately; background re-verify when stale.
				preferCache: !forceRefresh,
				backgroundRefresh: !forceRefresh,
				allowStaleOnError: true,
				allowEnrollProFallback: false,
			});
			schoolYearId = schoolYearContext.activeSchoolYearId;
			yearContextSource = schoolYearContext.source;
			setActiveSchoolYearId(schoolYearId);
			const queuedEditsForYear = readQueuedHomeRoomEdits(scopedSchoolId, schoolYearId);
			setQueuedHomeRoomEdits(queuedEditsForYear);

			if (!forceRefresh) {
				const cachedSummary = getCachedSectionSummary(scopedSchoolId, schoolYearId, {
					maxAgeMs: 3 * 60 * 1000,
				});
				const cachedHomeRooms = getCachedSectionHomeRooms<HomeRoomOption>(scopedSchoolId, schoolYearId, {
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
					() => atlasApi.get<SectionSummary & { code?: string }>(`/sections/summary/${schoolYearId}?schoolId=${scopedSchoolId}`),
					{ attempts: 2, delayMs: 400 },
				),
				requestWithRetry(
					() => atlasApi.get<{ rooms: HomeRoomOption[] }>(`/sections/home-rooms/${schoolYearId}?schoolId=${scopedSchoolId}`),
					{ attempts: 2, delayMs: 350 },
				),
				atlasApi.get<{ buildings: Building[] }>(`/map/schools/${scopedSchoolId}/buildings`),
			]);
			
			setBuildings(bRes.data.buildings);
			setHomeRoomOptions(homeRoomRes.data.rooms ?? []);
			setCachedSectionHomeRooms(scopedSchoolId, schoolYearId, homeRoomRes.data.rooms ?? []);
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
			setCachedSectionSummary(scopedSchoolId, schoolYearId, summaryWithQueuedEdits);
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
				void promoteActiveSchoolYearContext({ schoolId: scopedSchoolId, allowEnrollProFallback: false, allowStaleOnError: true })
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
			const cachedSummary = schoolYearId ? getCachedSectionSummary(scopedSchoolId, schoolYearId) : null;
			const cachedHomeRooms = schoolYearId ? getCachedSectionHomeRooms<HomeRoomOption>(scopedSchoolId, schoolYearId) : null;
			const queuedEditsForYear = schoolYearId ? readQueuedHomeRoomEdits(scopedSchoolId, schoolYearId) : [];
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
	}, [actorSchoolId, isOnline]);

	/* A3 fix 12 — the owner of the mutation reports the final result, so the
	 * confirmation surface can stay open and tell the truth about it. */
	const performHomeRoomUpdate = useCallback(async (
		section: SectionDetail,
		nextHomeRoomId: number | null,
		swapTarget?: { sectionId: number, homeRoomId: number | null },
	): Promise<HomeRoomUpdateResult> => {
		if (!section.id || !activeSchoolYearId || actorSchoolId == null || state.status !== 'ok' || dataSource === 'refreshing') {
			return { status: 'failed', reason: 'blocked', detail: 'Home-room edits are blocked while the roster source is being checked. Nothing was changed or queued.' };
		}
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
				setCachedSectionSummary(actorSchoolId, activeSchoolYearId, nextData);
				return { status: 'ok', data: nextData };
			});
		};

		try {
			const assignments = [{ sectionId: section.id, homeRoomId: nextHomeRoomId }];
			if (swapTarget) assignments.push({ sectionId: swapTarget.sectionId, homeRoomId: swapTarget.homeRoomId });

			const result = await persistHomeRoomAssignment({
				isOnline,
				assignments,
				put: async () => {
					await atlasApi.put(`/sections/home-rooms/${activeSchoolYearId}`, { schoolId: actorSchoolId, assignments });
				},
				applyOptimistic: applyOptimisticHomeRoom,
				onWriteError: (error) => console.error('Failed to update home room:', error),
				enqueue: () => {
					setQueuedHomeRoomEdits((current) => {
						let next = mergeQueuedHomeRoomEdit(current, section.id, nextHomeRoomId);
						if (swapTarget) next = mergeQueuedHomeRoomEdit(next, swapTarget.sectionId, swapTarget.homeRoomId);
						writeQueuedHomeRoomEdits(actorSchoolId, activeSchoolYearId, next);
						return next;
					});
				},
			});
			if (result.status === 'queued') setCacheNotice(result.detail);
			return result;
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
					programCode: s.programCode ?? undefined,
				});
			}
		});
		return map;
	}, [state]);

	const handleHomeRoomChange = useCallback(async (section: SectionDetail, nextHomeRoomId: number | null) => {
		if (!section.id || !activeSchoolYearId || state.status !== 'ok' || dataSource === 'none' || dataSource === 'refreshing') return;

		/* A3 fix 12 — the escalation decision is production code
		 * (homeRoomPersistence), so the confirm-and-cancel path is exercised
		 * end to end rather than re-implemented in a control. */
		const intent = resolveHomeRoomIntent(
			section,
			nextHomeRoomId,
			(roomId) => roomOccupancyMap.get(roomId),
			(roomId) => homeRoomOptions.find(r => r.id === roomId)?.name,
		);

		if (intent.kind === 'unassign') {
			setPendingAssignment({
				section,
				roomId: null,
				type: 'unassign',
				currentRoomName: intent.currentRoomName,
			});
			return;
		}

		if (intent.kind === 'swap') {
			setPendingAssignment({
				section,
				roomId: nextHomeRoomId,
				type: 'swap',
				displacedSection: intent.displacedSectionName,
				currentRoomName: intent.currentRoomName,
				targetRoomName: intent.targetRoomName,
			});
			return;
		}

		// A3 fix 12 — a plain write still reports its outcome through the same
		// typed result, so the row's saving state and the notice stay truthful.
		const result = await performHomeRoomUpdate(section, nextHomeRoomId);
		if (result.status === 'failed') setCacheNotice(result.detail);
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
			const { data } = await atlasApi.post('/sections/sync', { schoolId: actorSchoolId });
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
		if (!activeSchoolYearId || actorSchoolId == null || !isOnline || syncingQueuedEdits || queuedHomeRoomEdits.length === 0) return;

		const dedupedAssignments = Array.from(
			queuedHomeRoomEdits.reduce((map, item) => {
				map.set(item.sectionId, item.homeRoomId);
				return map;
			}, new Map<number, number | null>()).entries(),
		).map(([sectionId, homeRoomId]) => ({ sectionId, homeRoomId }));

		setSyncingQueuedEdits(true);
		try {
			await atlasApi.put(`/sections/home-rooms/${activeSchoolYearId}`, {
				schoolId: actorSchoolId,
				assignments: dedupedAssignments,
			});
			writeQueuedHomeRoomEdits(actorSchoolId, activeSchoolYearId, []);
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

	const { paged, totalFiltered, totalPages, homeRoomReadiness } = useMemo(() => {
		if (state.status !== 'ok') {
			return {
				paged: [] as SectionDetail[],
				totalFiltered: 0,
				totalPages: 1,
				homeRoomReadiness: summarizeHomeRoomReadiness([], []),
			};
		}
		// A3 C4 (defect A): the counter asks the SAME question the row asks, via
		// the one shared predicate. It used to ask only whether an id was present
		// (the section's homeRoomId coerced straight to a boolean), which counted
		// a stale/deleted id as assigned and so printed "HOME ROOMS 20/20" beside
		// five rows reading "Needs home room".
		//
		// It is computed over the UNFILTERED list, before any search/grade/
		// program/home-room filter runs, because the start-here banner and the
		// stat tile describe the whole roster. Narrowing the counter to the
		// visible page would have been the same class of fabrication one level
		// down: the banner would claim to cover 20 sections while counting 25.
		const ac = summarizeHomeRoomReadiness(state.data.sections, homeRoomOptions);
		let list = state.data.sections;

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter((s) => s.name.toLowerCase().includes(q) || s.gradeLevelName.toLowerCase().includes(q));
		}
		if (gradeFilter !== 'all') list = list.filter((s) => gradeKey(s.gradeLevelName) === gradeFilter);
		if (programFilter !== 'all') {
			if (programFilter === 'REGULAR') list = list.filter((s) => !s.isSpecialProgram);
			else list = list.filter((s) => s.programType === programFilter);
		}
		// The filter asks the shared question too, or "Assigned" would show a
		// row that the row below then calls unresolved — the toolbar's copy of
		// the same defect. `!isHomeRoomResolved` is a strict superset of
		// `!homeRoomId`, so "missing" only ever GAINS dangling-id rows and
		// never drops one it used to show.
		if (homeRoomFilter === 'missing') list = list.filter((section) => !isHomeRoomResolved(section, homeRoomOptions));
		if (homeRoomFilter === 'assigned') list = list.filter((section) => isHomeRoomResolved(section, homeRoomOptions));

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
		return { paged: sorted.slice(start, start + pageSize), totalFiltered: tf, totalPages: tp, homeRoomReadiness: ac };
	}, [state, searchQuery, gradeFilter, programFilter, homeRoomFilter, sortField, sortDir, page, pageSize, homeRoomOptions]);

	const hasActiveFilters = gradeFilter !== 'all' || searchQuery.trim() !== '' || programFilter !== 'all' || homeRoomFilter !== 'all';
	// Phase 1.1: top-level "sections needing rooms" count for the start-here
	// banner above the table. Same value, same predicate, same population as
	// the stat tile — one source, so the banner and the tile cannot disagree.
	const sectionsNeedingRooms = state.status === 'ok' ? homeRoomReadiness.needing : 0;

	const buildingOccupancy = useMemo(
		() => deriveBuildingOccupancy(buildings, roomOccupancyMap),
		[buildings, roomOccupancyMap],
	);

	const toggleSort = (field: SortField) => {
		if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else { setSortField(field); setSortDir('asc'); }
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

		// A3 C4 (defect A): BOTH ends of the fraction now come from the list
		// that is actually rendered. It used to divide a count computed over the
		// client array by the SERVER's declared section total. The two agree
		// today only because the server happens to derive one from the other
		// (atlas-server/src/services/section.service.ts:413 sets
		// `totalSections: sections.length`), which is another service's
		// implementation detail, not a client invariant. A fraction across two
		// populations is a fabrication the moment they diverge, and the sibling
		// "Sections" tile would have shown the server's number beside the
		// client's — e.g. "20" next to "18/19".
		//
		// REVIEW FINDING B2 (2026-09-28): the label/value/helpText triple used
		// to be inlined HERE, which left a source-shape scan as the only guard
		// on a HIGH truthfulness fix — and the scan was defeated by a mutation
		// that rebuilt the summary from a plain "is a homeRoomId present"
		// count. The printing now lives in `buildHomeRoomsStat`, which the
		// behavioural control calls directly with a controlled list, so the
		// claim is decided by what that function RETURNS rather than by how
		// this file spells anything. This array places that return value in
		// the tile verbatim, and the page no longer holds a local
		// re-derivation of the fraction that could override it.
		const sectionsTile = {
			label: 'Sections',
			value: homeRoomReadiness.total,
			tone: 'brand' as const,
			helpText: 'Total section rosters available for the active school year.',
		};
		const homeRoomsTile = buildHomeRoomsStat(state.data.sections, homeRoomOptions, homeRoomReadiness);
		return [
			sectionsTile,
			homeRoomsTile,
			...(queuedHomeRoomEdits.length > 0 ? [{ label: 'Queued', value: queuedHomeRoomEdits.length, tone: 'info' as const, helpText: 'Home-room changes saved locally and waiting to sync.' }] : []),
		];
	}, [homeRoomReadiness, homeRoomOptions, queuedHomeRoomEdits.length, state]);


	const homeRoomEditStatus = useMemo(
		() => deriveHomeRoomEditStatus({
			hasActiveSchoolYear: !!activeSchoolYearId,
			rosterStatus: state.status,
			dataSource,
			isOnline,
			queuedEditCount: queuedHomeRoomEdits.length,
		}),
		[activeSchoolYearId, dataSource, isOnline, queuedHomeRoomEdits.length, state.status],
	);

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
					className="gap-2 border-primary/20 bg-primary/5 font-bold text-primary hover:bg-primary/10"
					onClick={() => setGlobalBrowseModalOpen(true)}
				>
					<MapIcon className="size-4" />
					<span className="hidden sm:inline">Browse room map</span>
					<span className="sm:hidden">Rooms</span>
				</Button>
			)}
			primaryActions={
				<SectionsHomeRoomActions
					canAutoAssign={!!activeSchoolYearId && state.status === 'ok' && sectionsNeedingRooms > 0}
					syncing={syncing}
					syncingQueuedEdits={syncingQueuedEdits}
					stateStatus={state.status}
					isOnline={isOnline}
					sectionsNeedingRooms={sectionsNeedingRooms}
					onAutoAssign={() => setAutoAssignOpen(true)}
					onSync={handleSync}
				/>
			}
			toolbar={(
				<AdminSearchFilterToolbar
					searchValue={searchQuery}
					onSearchChange={setSearchQuery}
					searchPlaceholder="Search sections..."
					filtersOpen={showFilters}
					onToggleFilters={() => setShowFilters(!showFilters)}
					hasActiveFilters={hasActiveFilters}
				>
					<SectionsFilterToolbar
						gradeFilter={gradeFilter}
						onGradeFilterChange={setGradeFilter}
						availableGrades={availableGrades}
						programFilter={programFilter}
						onProgramFilterChange={setProgramFilter}
						availablePrograms={availablePrograms}
						homeRoomFilter={homeRoomFilter}
						onHomeRoomFilterChange={(value) => setHomeRoomFilter(value as typeof homeRoomFilter)}
					/>
			</AdminSearchFilterToolbar>
			)}
		>

			<div className="shrink-0 px-4 pt-1 lg:px-5">
				<ActorScopedRolloverGuidanceCard compact />
			</div>

			{/* Status Banners — extracted to components/sections/SectionsStatusBanners.tsx
				(A3 C4 B1) to bring this page back under the 1000-line §8 cap. The
				copy, the ordering, the pointer-events-none guard and the destructive
				token choice all moved with it. Only the 'unavailable' and 'no-year'
				states carry a message; the other two are narrowed off at the
				call site so the prop is always a string. */}
			<SectionsStatusBanners
				stateStatus={state.status}
				stateMessage={state.status === 'unavailable' || state.status === 'no-year' ? state.message : ''}
				syncError={syncError}
				cacheNotice={cacheNotice}
				syncing={syncing}
				isOnline={isOnline}
				onSync={handleSync}
				editStatus={homeRoomEditStatus}
			/>

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
						<div className="space-y-3 p-3 md:hidden">
							{state.status === 'loading' ? (
								Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)
							) : paged.length === 0 ? (
								<div className="flex min-h-80 items-center justify-center px-4 py-12 text-center">
									<AdminStatePanel
										icon={<Users className="size-8" />}
										title={state.status === 'ok' ? 'No sections match your filters.' : 'Sections data unavailable.'}
										description={state.status === 'ok' ? 'Clear a filter or search another section name to continue.' : 'Reconnect or sync sections before assigning home rooms.'}
									/>
								</div>
							) : scopedSchoolId == null ? null : (
								paged.map((section) => <SectionMobileCard key={section.id} section={section} homeRoomOptions={homeRoomOptions} isReadOnly={isReadOnlyMode} isSaving={savingMirrorId === section.id} schoolId={scopedSchoolId} roomOccupancy={roomOccupancyMap} onHomeRoomChange={handleHomeRoomChange} onShowDetails={(s) => setDetailTarget(s)} onShowRoomMap={(s) => setMapTarget(s)} />)
							)}
						</div>
						<table className="hidden w-full text-sm md:table">
							<thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
								<tr className="border-b">
								{/* Phase 1.5: each sortable column exposes aria-sort and a
									plain-language accessible name; the sort button has a
									visible Tooltip. aria-sort values: "ascending" /
									"descending" / "none". The header itself moved to
									components/sections/SectionsSortableHeader.tsx (A3 C4 B1);
									it no longer closes over the page's state and takes
									sortField/sortDir/onToggleSort as props. */}
									<SortableSectionHeader field="name" label="Section" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} />
									<SortableSectionHeader field="gradeLevelId" label="Grade" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} />
									<SortableSectionHeader field="enrolledCount" label="Enrolled" align="right" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} />
									<SortableSectionHeader field="maxCapacity" label="Capacity" align="right" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} />
									<SortableSectionHeader field="fill" label="% Full" align="right" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} />

									<th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">Home room</th>
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
								) : scopedSchoolId == null ? (
									<tr><td colSpan={7} className="px-4 py-20 text-center text-sm text-muted-foreground">Waiting for your school scope…</td></tr>
								) : (
									paged.map((s) => (
										<SectionRow key={s.id} section={s} homeRoomOptions={homeRoomOptions} isReadOnly={isReadOnlyMode} isSaving={savingMirrorId === s.id} onHomeRoomChange={handleHomeRoomChange} onShowDetails={(section) => setDetailTarget(section)} onShowRoomMap={(section) => setMapTarget(section)} schoolId={scopedSchoolId} roomOccupancy={roomOccupancyMap} />
									))
								)}
							</tbody>
						</table>
			</AdminTableShell>

			{/* A3 C4: routed through the shared resolver rather than a private
				optional-chain-then-lookup of its own. Same answer today — null
				when the id does not resolve — but now it cannot drift from the
				row if the definition of "resolves" ever changes. */}
			<SectionDetailsSheet
				sectionId={detailTarget?.id ?? null}
				sectionName={detailTarget?.name ?? null}
				section={detailTarget}
				homeRoom={detailTarget ? resolveHomeRoom(detailTarget, homeRoomOptions) : null}
				schoolYearId={activeSchoolYearId}
				open={detailTarget !== null}
				onOpenChange={(open) => !open && setDetailTarget(null)}
			/>

		{scopedSchoolId != null && (
			<SectionRoomMapModal
				open={globalBrowseModalOpen}
				onOpenChange={setGlobalBrowseModalOpen}
				sectionName="Global Browse"
				sectionId={0}
				currentRoomId={null}
				onSelect={() => {}}
				schoolId={scopedSchoolId}
				roomOccupancy={roomOccupancyMap}
				roomSectionData={roomSectionDataMap}
				buildingOccupancy={buildingOccupancy}
			/>
		)}

		{/* A3 C4 (top-10 #3): the row's "View room map" control lands here. It
			reuses the existing modal component and feeds its `onSelect` into the
			SAME `handleHomeRoomChange` the dropdown uses, so a room picked on the
			map goes through the identical confirm/queue/swap path and cannot
			bypass it. Mounted only under a resolved actor school, matching the
			ACTOR-SCOPE-C01 fail-closed rule the modal itself enforces.

			A3 C4 review finding N2: browsing the map is a legitimate READ, so the
			control stays enabled in read-only mode rather than being disabled like
			the sibling picker. The dead end that motivated the finding is closed
			here instead: in read-only, a room tap leaves the modal OPEN rather than
			closing it and silently doing nothing, because `handleHomeRoomChange`
			would return without writing. The row and the control both say the truth
			before the operator gets this far. */}
		{scopedSchoolId != null && mapTarget != null && (
			<SectionRoomMapModal
				open
				onOpenChange={(open) => { if (!open) setMapTarget(null); }}
				sectionName={mapTarget.name}
				sectionId={mapTarget.id}
				currentRoomId={mapTarget.homeRoomId ?? null}
				onSelect={(roomId) => {
					if (isReadOnlyMode) return;
					if (roomId === (mapTarget.homeRoomId ?? null)) {
						setMapTarget(null);
						return;
					}
					setMapTarget(null);
					handleHomeRoomChange(mapTarget, roomId);
				}}
				schoolId={scopedSchoolId}
				roomOccupancy={roomOccupancyMap}
				roomSectionData={roomSectionDataMap}
				buildingOccupancy={buildingOccupancy}
			/>
		)}

		{pendingAssignment && (
			<HomeRoomConfirmDialogs
				pending={pendingAssignment}
				sections={state.status === 'ok' ? state.data.sections : []}
				onRun={(pending, swapTarget) => {
					if (state.status !== 'ok') {
						return Promise.resolve({ status: 'failed', reason: 'blocked', detail: 'The section roster is no longer loaded. Nothing was changed or queued.' } as const);
					}
					return performHomeRoomUpdate(pending.section, pending.roomId, swapTarget);
				}}
				onClose={() => setPendingAssignment(null)}
			/>
		)}


			{scopedSchoolId != null && activeSchoolYearId && (
				<HomeRoomAutoAssignDialog
					open={autoAssignOpen}
					onOpenChange={setAutoAssignOpen}
					schoolId={scopedSchoolId}
					schoolYearId={activeSchoolYearId}
					onApplied={() => void fetchSections({ forceRefresh: true })}
				/>
			)}
		</AdminWorkspaceFrame>
	);
}
