import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ChevronLeft,
	ChevronRight,
	Users,
	ChevronsLeft,
	ChevronsRight,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import { compareSections } from '@/lib/sections-sort';
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
	AdminStatePanel,
	AdminTableShell,
	AdminWorkspaceFrame,
	type AdminSourceState,
} from '@/components/admin-workspace/AdminWorkspace';
import { FilterBar } from '@/ui/filter-bar';
import { SectionRow, type SectionDetail } from '@/components/sections/SectionRow';
import { SectionRoomPicker, type RoomOption as HomeRoomOption } from '@/components/sections/SectionRoomPicker';
import { SectionDetailsSheet } from '@/components/sections/SectionDetailsSheet';
import { HomeRoomAutoAssignDialog } from '@/components/sections/HomeRoomAutoAssignDialog';
import { SectionsHomeRoomActions } from '@/components/sections/SectionsHomeRoomActions';
import { SectionsHomeRoomMapModals } from '@/components/sections/SectionsHomeRoomMapModals';
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
import { HomeRoomConfirmDialogs, homeRoomResultCopy, type PendingAssignment } from '@/components/sections/HomeRoomConfirmDialogs';
import { deriveHomeRoomEditStatus } from '@/components/sections/homeRoomEditStatus';
import { homeRoomWriteAvailability } from '@/components/sections/homeRoomWriteAvailability';
import { toast } from 'sonner';
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
	/* A9 c6 (2026-09-30): the plain-words receipt of the last rooms action, on THIS page — the
	 * page whose data changed (operator decision #5). Distinct from `cacheNotice`, which is the
	 * source/sync banner; a receipt must be visible while the source is healthy. */
	const [homeRoomReceipt, setHomeRoomReceipt] = useState<string | null>(null);
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
	/* A5 c8 (2026-09-29): `showFilters` / `setShowFilters` are GONE. They existed only
	   for the disclosure the shared toolbar rendered, and this page's three filters now
	   sit in the one always-visible `FilterBar` row — so no value would read them. */
	const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null);
	// A9 c3 (2026-09-30): the school-wide map control and its open/close state are GONE —
	// the operator asked for it (section.docx item 5: "should we just remove browser room
	// map because each section has button directing to the map but dedicated to specific
	// section") and the per-section map below covers every real read. Each row carries a
	// visible, labelled control that opens the SAME `SectionRoomMapModal` for that row's
	// section. `null` means closed; a section means "open for this section".
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
		setMapTarget(null);
		setAutoAssignOpen(false);
		setHomeRoomReceipt(null);
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

	/**
	 * A3 c11 FIX-12 — the ONE writability gate for a home-room change, plus the
	 * sentence the operator reads when the change cannot be written. Before this,
	 * `handleHomeRoomChange` returned on this condition with no user-visible
	 * outcome: the room map's Confirm click closed the dialog and nothing
	 * happened, so an unwritable click and a successful save were identical.
	 *
	 * `canWrite` travels to the map modal, where the Confirm control is disabled
	 * AND states the reason (a disabled primary action is never inert), and
	 * `notSavedNotice` is what the handler reports if a pick still arrives from
	 * another surface. `isReadOnlyMode` below is derived from it, so the row's
	 * own gate and this one cannot drift apart.
	 */
	const homeRoomWrite = useMemo(
		() => homeRoomWriteAvailability({
			hasActiveSchoolYear: Boolean(activeSchoolYearId),
			rosterStatus: state.status,
			dataSource,
			isOnline,
		}),
		[activeSchoolYearId, dataSource, isOnline, state.status],
	);

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
		// A3 c11 FIX-12 — the blocked case used to `return` here with nothing at
		// all: no write, no notice, no toast, and the room map had already closed.
		// It now reports the same not-saved sentence the disabled control shows,
		// through BOTH channels, so no path can end in silence.
		if (!homeRoomWrite.canWrite) {
			const notice = homeRoomWrite.notSavedNotice ?? 'Home-room change not saved. Nothing was changed.';
			setCacheNotice(notice);
			toast.error('Home-room change not saved', { description: notice });
			return;
		}
		if (!section.id || !activeSchoolYearId || state.status !== 'ok' || dataSource === 'none' || dataSource === 'refreshing') {
			// The residual per-section guard (a section without an id cannot be
			// written either), reported rather than dropped.
			const notice = 'Home-room change not saved. This section has no writable identity yet, so nothing was changed.';
			setCacheNotice(notice);
			toast.error('Home-room change not saved', { description: notice });
			return;
		}

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
		// FIX-12 addition: this path has no confirmation dialog, so the toast is
		// the ONLY place the operator learns the result. It uses the same
		// three-way wording the confirmation surface uses, so a persisted change
		// reads as saved and NOTHING else ever does.
		const result = await performHomeRoomUpdate(section, nextHomeRoomId);
		const roomName = nextHomeRoomId === null
			? 'no home room'
			: (homeRoomOptions.find((r) => r.id === nextHomeRoomId)?.name ?? 'the selected room');
		if (result.status === 'saved') {
			// The page notice is NOT cleared here: it may be carrying a truthful
			// "N changes are waiting to sync" line, and one success does not make
			// that untrue.
			toast.success('Home room saved', { description: `${section.name} now uses ${roomName}.` });
		} else if (result.status === 'queued') {
			// A queued edit is an INFORMATIONAL disposition, not a failure. The
			// reviewer's own words: "Queued locally for sync — informational/
			// queued message, not a false server-success claim." Painting it in
			// the error tone told a mouse-first operator the change was refused
			// when it is safely held and will sync.
			setCacheNotice(result.detail);
			toast.info(homeRoomResultCopy(result).headline, { description: `${section.name} — ${result.detail}` });
		} else {
			toast.error(homeRoomResultCopy(result).headline, { description: result.detail });
		}
	}, [activeSchoolYearId, dataSource, homeRoomOptions, homeRoomWrite, roomOccupancyMap, state.status, performHomeRoomUpdate]);

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

		// A2 c15 (B2): the comparator lives in `@/lib/sections-sort` so the "Grade"
		// column can order by the resolved grade from the one client authority
		// rather than by the raw EnrollPro `gradeLevelId`, and so this page stays
		// under the AGENTS §8 1000-line ceiling.
		const sorted = [...list].sort((a, b) => compareSections(a, b, sortField, sortDir));

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

	const isReadOnlyMode = !homeRoomWrite.canWrite;

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
				/* A9 C3: the home-room EDIT clause is gone from both sentences. It was a
				 * THIRD, differently-worded statement of the writability fact, which now has
				 * one home — the save-state line below. Full rationale in
				 * `homeRoomEditStatus.ts`; ledger in `SectionsHomeRoomActions.tsx`. */
				description:
					sectionSourceState === 'verified-live' ? 'These sections were checked against the live roster for this school year.'
					: sectionSourceState === 'checking-source' ? 'ATLAS is checking the roster source while the saved section list stays visible.'
					: sectionSourceState === 'saved-data' ? (isOnline ? 'ATLAS is showing your last saved section list because the live source is not fully verified.' : 'You are offline, so ATLAS is showing your last saved section list.')
					: 'ATLAS has no safe section roster to show yet.',
				nextAction:
					sectionSourceState === 'verified-live' ? 'Sync if the roster changed, then give the sections that need one a home room.'
					: sectionSourceState === 'checking-source' ? 'Review the list now, then save room changes once the source settles.'
					: sectionSourceState === 'saved-data' ? 'Reconnect or sync before treating this as the final roster.'
					: 'Reconnect and sync sections before this page can be used.',
			}}
			stats={sectionStats}
			/* A9 c3 (2026-09-30): the school-wide `Browse room map` control is REMOVED.
			   The operator's section.docx item 5 asked for it, and every row already opens
			   a map scoped to its own section, so the header slot is not left with a
			   second, lesser map entry point. The header keeps its tabs, one status chip
			   and `More` (AGENTS.md §8). */
			toolbar={(
				/* A5 c8 (2026-09-29): `AdminSearchFilterToolbar` is deleted from
				   `AdminWorkspace.tsx` — it was the last consumer, so there is no second
				   filter-bar implementation left. This page renders the ONE shared row. */
				<FilterBar
					dataTestId="sections-filter-bar"
					search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search sections...', ariaLabel: 'Search sections' }}
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
				</FilterBar>
			)}
		>

			{/* A9 C3: the one action band, in the body rather than the frame's action slot
				(§8's header budget is two calm rows). Ledger: SectionsHomeRoomActions.tsx. */}
			<SectionsHomeRoomActions
				canAutoAssign={!!activeSchoolYearId && state.status === 'ok' && sectionsNeedingRooms > 0}
				syncing={syncing}
				syncingQueuedEdits={syncingQueuedEdits}
				stateStatus={state.status}
				isOnline={isOnline}
				sectionsNeedingRooms={sectionsNeedingRooms}
				onAutoAssign={() => setAutoAssignOpen(true)}
				onSync={handleSync}
				editStatus={homeRoomEditStatus}
				receipt={homeRoomReceipt}
			/>

			<div className="shrink-0 px-4 pt-1 lg:px-5">
				<ActorScopedRolloverGuidanceCard compact />
			</div>

			{/* Status Banners — extracted to components/sections/SectionsStatusBanners.tsx
				(A3 C4 B1) to bring this page back under the 1000-line §8 cap. Only the
				'unavailable' and 'no-year' states carry a message; the other two are
				narrowed off at the call site so the prop is always a string. A9 C3:
				`editStatus` is no longer passed — that banner duplicated the save-state
				line's fact (see `SectionsStatusBanners.tsx`). */}
			<SectionsStatusBanners
				stateStatus={state.status}
				stateMessage={state.status === 'unavailable' || state.status === 'no-year' ? state.message : ''}
				syncError={syncError}
				cacheNotice={cacheNotice}
				syncing={syncing}
				isOnline={isOnline}
				onSync={handleSync}
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
									{/* A9 c2 R2 (2026-09-30): the Section column is pinned to 300px so the
									 * seven committed column widths sum to 979 <= the 984px panel at
									 * 1280x720 (see the Home room cell below). Its title is a two-line
									 * clamp (`line-clamp-2` + `min-w-0 break-words`), so it wraps inside
									 * this track rather than forcing the table wider. */}
									<SortableSectionHeader field="name" label="Section" className="w-[300px]" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} />
									<SortableSectionHeader field="gradeLevelId" label="Grade" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} />
									<SortableSectionHeader field="enrolledCount" label="Enrolled" align="right" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} />
									<SortableSectionHeader field="maxCapacity" label="Capacity" align="right" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} />
									<SortableSectionHeader field="fill" label="% Full" align="right" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} />

									{/* A9 c2 R2 (2026-09-30): back to the A9 C7 200px cap, and the room
									 * text WRAPS. R1's widening to 330 made the room text whole on one
									 * line but pushed the table past its scroll panel — measured at the
									 * R1 tip: `scrollWidth 1124` against `clientWidth 1070` at 1366x768
									 * (984 at 1280x720), with the row's Details actions outside the
									 * visible panel on EVERY row. The cap and the wrap together keep the
									 * table inside the panel and the room text whole. The width here is
									 * the SAME number the cell in `SectionRow.tsx` declares, so the two
									 * cannot drift. */}
									<th className="w-[200px] min-w-0 px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">Home room</th>
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
										/* A9 C7: the row picker is back, on Lane C's binding addendum of
										 * 2026-09-29 15:55 (item 46) — so the row again takes the four
										 * props it needs to write: the actor-school scope, the occupancy
										 * map, this row's saving flag and the page's ONE home-room write.
										 * Ledger in `SectionRow.tsx`. */
										<SectionRow key={s.id} section={s} homeRoomOptions={homeRoomOptions} isReadOnly={isReadOnlyMode} schoolId={scopedSchoolId} roomOccupancy={roomOccupancyMap} isSaving={savingMirrorId === s.id} onHomeRoomChange={handleHomeRoomChange} onShowDetails={(section) => setDetailTarget(section)} onShowRoomMap={(section) => setMapTarget(section)} />
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

		{/* A3 c11 §8 extraction: the two `SectionRoomMapModal` mounts and their
			guards moved verbatim into `components/sections/SectionsHomeRoomMapModals.tsx`
			because this page crossed the mandatory 1000-physical-line ceiling. The
			read-only browse reason, the write-gate report and the identical
			`handleHomeRoomChange` path all travel with them. */}
		<SectionsHomeRoomMapModals
			scopedSchoolId={scopedSchoolId}
			mapTarget={mapTarget}
			onMapTargetChange={setMapTarget}
			roomOccupancy={roomOccupancyMap}
			roomSectionData={roomSectionDataMap}
			buildingOccupancy={buildingOccupancy}
			homeRoomWrite={homeRoomWrite}
			onNotSaved={setCacheNotice}
			onHomeRoomChange={(target, roomId) => handleHomeRoomChange(target, roomId)}
		/>

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
			<>
			{/* A9 C3: the step takes the page's room list, its occupancy map and its ONE
			 * writability gate, so the review rows offer the same picker the rows used to
			 * and the apply action is gated exactly as every other write here. */}
			<HomeRoomAutoAssignDialog
				open={autoAssignOpen}
				onOpenChange={setAutoAssignOpen}
				schoolId={scopedSchoolId}
				schoolYearId={activeSchoolYearId}
				homeRoomOptions={homeRoomOptions}
				roomOccupancy={roomOccupancyMap}
				canWrite={homeRoomWrite.canWrite}
				notSavedNotice={homeRoomWrite.notSavedNotice}
				onNotice={setHomeRoomReceipt}
				onApplied={() => void fetchSections({ forceRefresh: true })}
			/>
			</>
		)}
		</AdminWorkspaceFrame>
	);
}
