import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { parseDraftPlacementId, scopePreviewToCandidate } from '@/lib/timetable-utils';
import type { PendingSwapAction } from '@/components/timetable/ScheduleReviewWorkspace.constants';
import type {
	CommitResult,
	DraftBoardState,
	DraftPlacement,
	DraftPlacementCommitResult,
	DraftPlacementSwapPreview,
	DraftPlacementSwapResult,
	DraftQueueItem,
	DraftReport,
	ManualEditProposal,
	ManualEditRecord,
	PreviewResult,
	RoomPreferenceDecisionStatus,
	RoomPreferencePreviewResponse,
	RoomPreferenceStatus,
	RoomPreferenceSummaryResponse,
	RoomRequestAppeal,
	RoomRequestAppealStatus,
	RunSummary,
	ScheduledEntry,
	UnassignedItem,
	HumanConflict,
	Violation,
	ViolationReport,
} from '@/types';

const DEFAULT_SCHOOL_ID = 1;

// ---------------------------------------------------------------------------
// Debug toggle — flip to false OR delete this block after diagnosis is done
// ---------------------------------------------------------------------------
const DEBUG_PREGEN_DND = true;
const dbg = (...args: unknown[]) => { if (DEBUG_PREGEN_DND) console.log('[PREGEN_DND]', ...args); };

type RoomInfo = {
	id: number;
	name: string;
	buildingId: number;
	buildingName: string;
	buildingShortCode: string | null;
	floor: number;
	type: string;
	isTeachingSpace: boolean;
};

type PreGenDragSource =
	| { type: 'draftQueue'; item: DraftQueueItem }
	| { type: 'draftPlacement'; placement: DraftPlacement };

type SwapPreviewState = {
	atomicPreview: DraftPlacementSwapPreview | null;
	sourcePreview: PreviewResult | null;
	loading: boolean;
	error: string | null;
};

export type PreGenPendingPlacement = {
	placementId?: number;
	entryKind: 'SECTION' | 'COHORT';
	sectionId: number;
	subjectId: number;
	facultyId: number;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
	cohortCode?: string | null;
	notes?: string | null;
	expectedVersion?: number;
	sourceLabel: string;
};

type UseTimetableMutationsInput = {
	schoolYearId: number | null;
	roomRequestSummary: RoomPreferenceSummaryResponse | null;
	requestStatusFilter: 'ALL' | RoomPreferenceStatus;
	requestDecisionFilter: 'ALL' | RoomPreferenceDecisionStatus;
	requestSearch: string;
	setViewMode: React.Dispatch<React.SetStateAction<'section' | 'faculty' | 'room'>>;
	setEntityFilter: React.Dispatch<React.SetStateAction<string>>;
	draft: DraftReport | null;
	setSelectedEntry: React.Dispatch<React.SetStateAction<ScheduledEntry | null>>;
	rightPanelRef: React.RefObject<ImperativePanelHandle | null>;
	openRoomGridWorkspace: (roomId: number) => void;
	setSelectedRequestId: React.Dispatch<React.SetStateAction<number | null>>;
	setRequestPreviewLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setRequestPreview: React.Dispatch<React.SetStateAction<RoomPreferencePreviewResponse | null>>;
	setRequestReviewerNotes: React.Dispatch<React.SetStateAction<string>>;
	setAppealsLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setRequestAppeals: React.Dispatch<React.SetStateAction<RoomRequestAppeal[]>>;
	loadRoomRequestSummary: (
		syId: number,
		statusFilter: 'ALL' | RoomPreferenceStatus,
		decisionFilter: 'ALL' | RoomPreferenceDecisionStatus,
	) => Promise<void>;
	requestPreview: RoomPreferencePreviewResponse | null;
	appealReason: string;
	setAppealSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
	setAppealReason: React.Dispatch<React.SetStateAction<string>>;
	setRequestReviewSaving: React.Dispatch<React.SetStateAction<boolean>>;
	requestReviewerNotes: string;

	setKbSelectedSource: React.Dispatch<React.SetStateAction<any>>;
	setPreGenKbSource: React.Dispatch<React.SetStateAction<any>>;
	setSelectedViolation: React.Dispatch<React.SetStateAction<Violation | null>>;
	setFollowUps: React.Dispatch<React.SetStateAction<Set<string>>>;

	setGenerating: React.Dispatch<React.SetStateAction<boolean>>;
	setShowGenerateConfirm: React.Dispatch<React.SetStateAction<boolean>>;
	draftBoardSummary: DraftBoardState['counts'] | null;
	fetchDraftBoardSummary: (syId: number) => Promise<DraftBoardState['counts'] | null>;
	loadAll: (preserveRun?: boolean) => Promise<void>;
	setNewDraftLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setDraftBoard: React.Dispatch<React.SetStateAction<DraftBoardState | null>>;
	setDraftBoardSummary: React.Dispatch<React.SetStateAction<DraftBoardState['counts'] | null>>;
	setLeftTab: React.Dispatch<React.SetStateAction<'violations' | 'unassigned' | 'locks' | 'requests'>>;
	setCenterView: React.Dispatch<React.SetStateAction<'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building'>>;
	setPreGenOnboarding: React.Dispatch<React.SetStateAction<boolean>>;
	setPreGenPending: React.Dispatch<React.SetStateAction<PreGenPendingPlacement | null>>;
	setPreGenPreview: React.Dispatch<React.SetStateAction<PreviewResult | null>>;
	setPreGenPreviewLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setPreGenPreviewError: React.Dispatch<React.SetStateAction<string | null>>;
	setPreGenAllowSoftOverride: React.Dispatch<React.SetStateAction<boolean>>;
	preGenPending: PreGenPendingPlacement | null;
	preGenAllowSoftOverride: boolean;
	setPreGenSaving: React.Dispatch<React.SetStateAction<boolean>>;
	setShowResetDraftDialog: React.Dispatch<React.SetStateAction<boolean>>;
	draftBoard: DraftBoardState | null;
	setShowPublishDialog: React.Dispatch<React.SetStateAction<boolean>>;
	setSwapAction: React.Dispatch<React.SetStateAction<PendingSwapAction | null>>;
	setShowSwapConfirm: React.Dispatch<React.SetStateAction<boolean>>;
	setSwapSaving: React.Dispatch<React.SetStateAction<boolean>>;
	swapAction: PendingSwapAction | null;
	setRegularSwapSaving: React.Dispatch<React.SetStateAction<boolean>>;
	setRegularSwapPending: React.Dispatch<React.SetStateAction<{ entryA: ScheduledEntry; entryB: ScheduledEntry } | null>>;
	regularSwapPending: { entryA: ScheduledEntry; entryB: ScheduledEntry } | null;
	setDeletingPlacementId: React.Dispatch<React.SetStateAction<number | null>>;
	setBlockerModalData: React.Dispatch<React.SetStateAction<HumanConflict[] | null>>;

	setShowPreGenConfirm: React.Dispatch<React.SetStateAction<boolean>>;
	preGenConfirmCtx: {
		source: PreGenDragSource;
		day: string;
		startTime: string;
		endTime: string;
	} | null;
	setPreGenConfirmCtx: React.Dispatch<React.SetStateAction<{
		source: PreGenDragSource;
		day: string;
		startTime: string;
		endTime: string;
	} | null>>;
	confirmFacultyId: string;
	setConfirmFacultyId: React.Dispatch<React.SetStateAction<string>>;
	confirmRoomId: string;
	setConfirmRoomId: React.Dispatch<React.SetStateAction<string>>;
	setConfirmPreviewLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setConfirmPreview: React.Dispatch<React.SetStateAction<PreviewResult | null>>;
	setConfirmRawPreview: React.Dispatch<React.SetStateAction<PreviewResult | null>>;
	setConfirmPreviewError: React.Dispatch<React.SetStateAction<string | null>>;
	setConfirmAllowSoftOverride: React.Dispatch<React.SetStateAction<boolean>>;
	setConfirmAllowDailyOverride: React.Dispatch<React.SetStateAction<boolean>>;
	setConfirmSaving: React.Dispatch<React.SetStateAction<boolean>>;
	autoPreviewRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;

	setEditHistory: React.Dispatch<React.SetStateAction<ManualEditRecord[]>>;
	setDraft: React.Dispatch<React.SetStateAction<DraftReport | null>>;
	setPreviewLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setPreviewResult: React.Dispatch<React.SetStateAction<PreviewResult | null>>;
	setCommitLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setSoftConfirmWarnings: React.Dispatch<React.SetStateAction<Violation[]>>;
	setShowSoftConfirm: React.Dispatch<React.SetStateAction<boolean>>;
	setPendingCommitProposal: React.Dispatch<React.SetStateAction<ManualEditProposal | null>>;
	setDragItem: React.Dispatch<React.SetStateAction<any>>;
	setRevertLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setViolationReport: React.Dispatch<React.SetStateAction<ViolationReport | null>>;

	viewMode: 'section' | 'faculty' | 'room';
	entityFilter: string;
	facultyMap: Map<number, { id: number }>;
	roomMap: Map<number, RoomInfo>;
};

export type TimetableMutationState = {
	filteredRoomRequests: RoomPreferenceSummaryResponse['requests'];
	focusRequestInGrid: (requestId: number) => Promise<void>;
	openRequestPreview: (requestId: number) => Promise<void>;
	submitAppeal: () => Promise<void>;
	updateAppealStatus: (appealId: number, status: RoomRequestAppealStatus) => Promise<void>;
	reviewRoomRequest: (decisionStatus: 'APPROVED' | 'REJECTED') => Promise<void>;
	requestPreviewConflicts: NonNullable<RoomPreferencePreviewResponse['preview']>['humanConflicts'];
	requestPreviewHardConflicts: NonNullable<RoomPreferencePreviewResponse['preview']>['humanConflicts'];
	requestPreviewSoftWarnings: NonNullable<RoomPreferencePreviewResponse['preview']>['humanConflicts'];
	handleViolationSelect: (v: Violation) => void;
	handleEntryClick: (entry: ScheduledEntry) => void;
	toggleFollowUp: (entryId: string) => Promise<void>;
	triggerGeneration: () => Promise<void>;
	handleTriggerGenerate: () => Promise<void>;
	confirmGenerate: () => void;
	openPreGenerationWorkspace: (resetExisting: boolean) => Promise<void>;
	handleStartNewPreGenerationDraft: () => Promise<void>;
	handlePublishConfirm: () => void;
	runIdNumeric: number | null;
	runVersion: number;
	apiBase: string | null;
	fetchEditHistory: () => Promise<void>;
	previewEdit: (proposal: ManualEditProposal) => Promise<PreviewResult | null>;
	commitEdit: (proposal: ManualEditProposal, allowSoftOverride?: boolean) => Promise<void>;
	revertLastEdit: () => Promise<void>;
	choosePreGenFaculty: (item: DraftQueueItem) => number;
	choosePreGenRoom: (item: DraftQueueItem) => number;
	buildPreGenPendingPlacement: (
		source: PreGenDragSource,
		day: string,
		startTime: string,
		endTime: string,
		facultyId: number,
		roomId: number,
	) => PreGenPendingPlacement;
	openSwapPrompt: (
		source: PreGenDragSource,
		target: { day: string; startTime: string; endTime: string; facultyId: number; roomId: number },
		displaced: DraftPlacement,
		sourceLabel: string,
	) => void;
	runPreGenPreview: (pending: PreGenPendingPlacement) => Promise<void>;
	stagePreGenDrop: (
		source: PreGenDragSource,
		day: string,
		startTime: string,
		endTime: string,
		options?: { suppressConfirm?: boolean },
	) => Promise<void>;
	runConfirmPreview: () => Promise<void>;
	commitConfirmPlacement: () => Promise<void>;
	executeSwapAction: () => Promise<void>;
	executeRegularSwap: () => Promise<void>;
	unassignDraftPlacement: (placementId: number) => Promise<void>;
	getDraggedDraftPlacementId: (source: any) => number | null;
	commitPreGenPending: () => Promise<void>;
	/** Swap preview results loaded when swap confirm dialog opens (Fix C) */
	swapPreview: SwapPreviewState | null;
};

export function useTimetableMutations(input: UseTimetableMutationsInput): TimetableMutationState {
	const {
		schoolYearId,
		roomRequestSummary,
		requestStatusFilter,
		requestDecisionFilter,
		requestSearch,
		setViewMode,
		setEntityFilter,
		draft,
		setSelectedEntry,
		rightPanelRef,
		openRoomGridWorkspace,
		setSelectedRequestId,
		setRequestPreviewLoading,
		setRequestPreview,
		setRequestReviewerNotes,
		setAppealsLoading,
		setRequestAppeals,
		loadRoomRequestSummary,
		requestPreview,
		appealReason,
		setAppealSubmitting,
		setAppealReason,
		setRequestReviewSaving,
		requestReviewerNotes,
		setKbSelectedSource,
		setPreGenKbSource,
		setSelectedViolation,
		setFollowUps,
		setGenerating,
		setShowGenerateConfirm,
		draftBoardSummary,
		fetchDraftBoardSummary,
		loadAll,
		setNewDraftLoading,
		setDraftBoard,
		setDraftBoardSummary,
		setLeftTab,
		setCenterView,
		setPreGenOnboarding,
		setPreGenPending,
		setPreGenPreview,
		setPreGenPreviewLoading,
		setPreGenPreviewError,
		setPreGenAllowSoftOverride,
		preGenPending,
		preGenAllowSoftOverride,
		setPreGenSaving,
		setShowResetDraftDialog,
		draftBoard,
		setShowPublishDialog,
		setSwapAction,
		setShowSwapConfirm,
		setSwapSaving,
		swapAction,
		setRegularSwapSaving,
		setRegularSwapPending,
		regularSwapPending,
		setDeletingPlacementId,
		setBlockerModalData,
		setShowPreGenConfirm,
		preGenConfirmCtx,
		setPreGenConfirmCtx,
		confirmFacultyId,
		setConfirmFacultyId,
		confirmRoomId,
		setConfirmRoomId,
		setConfirmPreviewLoading,
		setConfirmPreview,
		setConfirmRawPreview,
		setConfirmPreviewError,
		setConfirmAllowSoftOverride,
		setConfirmAllowDailyOverride,
		setConfirmSaving,
		autoPreviewRef,
		setEditHistory,
		setPreviewLoading,
		setPreviewResult,
		setCommitLoading,
		setSoftConfirmWarnings,
		setShowSoftConfirm,
		setPendingCommitProposal,
		setDragItem,
		setRevertLoading,
		setViolationReport,
		setDraft,
		viewMode,
		entityFilter,
		facultyMap,
		roomMap,
	} = input;

	// Fix C: internal swap preview state — loaded when swap confirm dialog opens
	const [swapPreview, setSwapPreview] = useState<SwapPreviewState | null>(null);

	// Clear swap preview when swap action is dismissed (cancel path)
	useEffect(() => {
		if (!swapAction) setSwapPreview(null);
	}, [swapAction]);

	const filteredRoomRequests = useMemo(() => {
		const requests = roomRequestSummary?.requests ?? [];
		if (!requestSearch.trim()) return requests;
		const query = requestSearch.toLowerCase();
		return requests.filter((request) =>
			`${request.facultyName} ${request.subjectCode} ${request.sectionName} ${request.requestedRoomName}`.toLowerCase().includes(query),
		);
	}, [requestSearch, roomRequestSummary?.requests]);

	const focusRequestInGrid = useCallback(async (requestId: number) => {
		const request = (roomRequestSummary?.requests ?? []).find((item) => item.id === requestId);
		if (!request) return;
		setViewMode('room');
		setEntityFilter(String(request.requestedRoomId));
		const matchedEntry = draft?.entries.find((entry) => entry.entryId === request.entryId) ?? null;
		if (matchedEntry) {
			setSelectedEntry(matchedEntry);
			rightPanelRef.current?.expand();
		}
		openRoomGridWorkspace(request.requestedRoomId);
	}, [roomRequestSummary?.requests, draft?.entries, setViewMode, setEntityFilter, setSelectedEntry, rightPanelRef, openRoomGridWorkspace]);

	const openRequestPreview = useCallback(async (requestId: number) => {
		if (!schoolYearId) return;
		const request = (roomRequestSummary?.requests ?? []).find((item) => item.id === requestId);
		if (!request) return;
		setSelectedRequestId(request.id);
		setRequestPreviewLoading(true);
		try {
			const { data } = await atlasApi.post<RoomPreferencePreviewResponse>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${request.runId}/requests/${request.id}/preview`);
			setRequestPreview(data);
			setRequestReviewerNotes(data.request.reviewerNotes ?? '');
			setAppealsLoading(true);
			try {
				const appealsRes = await atlasApi.get<{ requestId: number; appeals: RoomRequestAppeal[] }>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${request.runId}/requests/${request.id}/appeals`);
				setRequestAppeals(appealsRes.data.appeals);
			} catch {
				setRequestAppeals([]);
			} finally {
				setAppealsLoading(false);
			}
			await focusRequestInGrid(request.id);
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to load room request preview.');
			setSelectedRequestId(null);
			setRequestPreview(null);
			setRequestAppeals([]);
		} finally {
			setRequestPreviewLoading(false);
		}
	}, [schoolYearId, roomRequestSummary?.requests, setSelectedRequestId, setRequestPreviewLoading, setRequestPreview, setRequestReviewerNotes, setAppealsLoading, setRequestAppeals, focusRequestInGrid]);

	const submitAppeal = useCallback(async () => {
		if (!schoolYearId || !requestPreview) return;
		if (!appealReason.trim()) {
			toast.error('Appeal reason is required.');
			return;
		}
		setAppealSubmitting(true);
		try {
			await atlasApi.post(`/room-preferences/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${requestPreview.request.runId}/requests/${requestPreview.request.id}/appeals`, { reason: appealReason.trim() });
			const appealsRes = await atlasApi.get<{ requestId: number; appeals: RoomRequestAppeal[] }>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${requestPreview.request.runId}/requests/${requestPreview.request.id}/appeals`);
			setRequestAppeals(appealsRes.data.appeals);
			setAppealReason('');
			toast.success('Appeal submitted.');
			await loadRoomRequestSummary(schoolYearId, requestStatusFilter, requestDecisionFilter);
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to submit appeal.');
		} finally {
			setAppealSubmitting(false);
		}
	}, [schoolYearId, requestPreview, appealReason, setAppealSubmitting, setRequestAppeals, setAppealReason, loadRoomRequestSummary, requestStatusFilter, requestDecisionFilter]);

	const updateAppealStatus = useCallback(async (appealId: number, status: RoomRequestAppealStatus) => {
		if (!schoolYearId || !requestPreview) return;
		try {
			await atlasApi.patch(`/room-preferences/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${requestPreview.request.runId}/requests/${requestPreview.request.id}/appeals/${appealId}/status`, { status });
			const appealsRes = await atlasApi.get<{ requestId: number; appeals: RoomRequestAppeal[] }>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${requestPreview.request.runId}/requests/${requestPreview.request.id}/appeals`);
			setRequestAppeals(appealsRes.data.appeals);
			await loadRoomRequestSummary(schoolYearId, requestStatusFilter, requestDecisionFilter);
			toast.success('Appeal status updated.');
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to update appeal status.');
		}
	}, [schoolYearId, requestPreview, setRequestAppeals, loadRoomRequestSummary, requestStatusFilter, requestDecisionFilter]);

	const reviewRoomRequest = useCallback(async (decisionStatus: 'APPROVED' | 'REJECTED') => {
		if (!schoolYearId || !roomRequestSummary || !requestPreview) return;
		if (decisionStatus === 'APPROVED' && !requestPreview.preview.allowed) {
			toast.error('Preview blocked this room request. Reject it or resolve the listed hard conflicts first.');
			return;
		}
		setRequestReviewSaving(true);
		try {
			await atlasApi.patch(`/room-preferences/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${requestPreview.request.runId}/requests/${requestPreview.request.id}/review`, {
				decisionStatus,
				reviewerNotes: requestReviewerNotes || null,
				expectedRunVersion: roomRequestSummary.runVersion,
				requestVersion: requestPreview.request.version,
				allowSoftOverride: decisionStatus === 'APPROVED' && requestPreview.preview.softViolations.length > 0,
			});
			toast.success(decisionStatus === 'APPROVED' ? 'Room request approved.' : 'Room request rejected.');
			await loadRoomRequestSummary(schoolYearId, requestStatusFilter, requestDecisionFilter);
			setRequestPreview(null);
			setSelectedRequestId(null);
			setRequestAppeals([]);
			setAppealReason('');
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to review room request.');
		} finally {
			setRequestReviewSaving(false);
		}
	}, [schoolYearId, roomRequestSummary, requestPreview, requestReviewerNotes, setRequestReviewSaving, loadRoomRequestSummary, requestStatusFilter, requestDecisionFilter, setRequestPreview, setSelectedRequestId, setRequestAppeals, setAppealReason]);

	const requestPreviewConflicts = requestPreview?.preview.humanConflicts ?? [];
	const requestPreviewHardConflicts = requestPreviewConflicts.filter((conflict) => conflict.severity === 'HARD');
	const requestPreviewSoftWarnings = requestPreviewConflicts.filter((conflict) => conflict.severity === 'SOFT');

	const handleViolationSelect = useCallback((v: Violation) => {
		setKbSelectedSource(null);
		setPreGenKbSource(null);
		setSelectedViolation((prev) => (prev === v ? null : v));
		const firstId = v.entities.entryIds?.[0];
		if (firstId && draft?.entries) {
			const entry = draft.entries.find((e) => e.entryId === firstId);
			if (entry) setSelectedEntry(entry);
		}
	}, [draft?.entries, setKbSelectedSource, setPreGenKbSource, setSelectedViolation, setSelectedEntry]);

	const handleEntryClick = useCallback((entry: ScheduledEntry) => {
		setSelectedViolation(null);
		setKbSelectedSource(null);
		setPreGenKbSource(null);
		setSelectedEntry((prev) => {
			const next = prev?.entryId === entry.entryId ? null : entry;
			if (next) rightPanelRef.current?.expand();
			return next;
		});
	}, [setSelectedViolation, setKbSelectedSource, setPreGenKbSource, setSelectedEntry, rightPanelRef]);

	const toggleFollowUp = useCallback(async (entryId: string) => {
		if (!draft || !schoolYearId) return;
		setFollowUps((prev) => {
			const next = new Set(prev);
			if (next.has(entryId)) next.delete(entryId);
			else next.add(entryId);
			return next;
		});
		try {
			await atlasApi.put(`/follow-up-flags/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${draft.runId}/flags/${entryId}`);
		} catch {
			setFollowUps((prev) => {
				const next = new Set(prev);
				if (next.has(entryId)) next.delete(entryId);
				else next.add(entryId);
				return next;
			});
			toast.error('Failed to update follow-up flag.');
		}
	}, [draft, schoolYearId, setFollowUps]);

	const triggerGeneration = useCallback(async () => {
		if (!schoolYearId) return;
		setGenerating(true);
		const lockedAnchorCount = draftBoardSummary?.draft ?? 0;
		try {
			const { data: run } = await atlasApi.post<import('@/types').GenerationRun>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs`);
			if (run.status === 'FAILED') {
				toast.error(`Generation failed: ${run.error ?? 'Unknown error'}`);
			} else {
				const summary = run.summary as RunSummary | null;
				const assigned = summary?.assignedCount ?? 0;
				const unassigned = summary?.unassignedCount ?? 0;
				const hardViolations = summary?.hardViolationCount ?? 0;
				setCenterView('schedule');
				setPreGenOnboarding(false);
				setSelectedEntry(null);
				setPreGenPending(null);
				setPreGenPreview(null);
				setPreGenPreviewError(null);
				setPreGenAllowSoftOverride(false);
				try { localStorage.removeItem('atlas_pregen_active'); } catch { /* ignore */ }
				toast.success(`Schedule generated - ${assigned} assigned, ${unassigned} unassigned, ${hardViolations} hard violations`);
				if (lockedAnchorCount > 0) {
					toast.info(`${lockedAnchorCount} draft anchor${lockedAnchorCount === 1 ? '' : 's'} locked into the new generated run. Review them from Generated Run view.`);
				}
			}
			await loadAll(false);
			await fetchDraftBoardSummary(schoolYearId);
		} catch (e: unknown) {
			const axiosErr = e as { response?: { data?: { message?: string } } };
			const msg = axiosErr?.response?.data?.message ?? (e instanceof Error ? e.message : 'Generation request failed.');
			toast.error(msg);
		} finally {
			setGenerating(false);
		}
	}, [
		schoolYearId,
		setGenerating,
		draftBoardSummary?.draft,
		setCenterView,
		setPreGenOnboarding,
		setSelectedEntry,
		setPreGenPending,
		setPreGenPreview,
		setPreGenPreviewError,
		setPreGenAllowSoftOverride,
		loadAll,
		fetchDraftBoardSummary,
	]);

	const handleTriggerGenerate = useCallback(async () => {
		if (!schoolYearId) return;
		if (!draftBoardSummary) await fetchDraftBoardSummary(schoolYearId);
		setShowGenerateConfirm(true);
	}, [schoolYearId, draftBoardSummary, fetchDraftBoardSummary, setShowGenerateConfirm]);

	const confirmGenerate = useCallback(() => {
		setShowGenerateConfirm(false);
		void triggerGeneration();
	}, [setShowGenerateConfirm, triggerGeneration]);

	const openPreGenerationWorkspace = useCallback(async (resetExisting: boolean) => {
		if (!schoolYearId) return;
		setNewDraftLoading(true);
		try {
			const { data } = resetExisting
				? await atlasApi.post<DraftBoardState>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/clear`)
				: await atlasApi.get<DraftBoardState>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts`);
			setDraftBoard(data);
			setDraftBoardSummary(data.counts);
			setLeftTab('locks');
			setCenterView('map');
			setPreGenOnboarding(true);
			try { localStorage.setItem('atlas_pregen_active', '1'); } catch { /* ignore */ }
			setSelectedViolation(null);
			setSelectedEntry(null);
			setPreGenPending(null);
			setPreGenPreview(null);
			setPreGenPreviewError(null);
			setPreGenAllowSoftOverride(false);
			toast.success('Pre-generation draft workspace is ready. Choose a room or faculty to begin drafting.');
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to start a new pre-generation draft.');
		} finally {
			setNewDraftLoading(false);
		}
	}, [schoolYearId, setNewDraftLoading, setDraftBoard, setDraftBoardSummary, setLeftTab, setCenterView, setPreGenOnboarding, setSelectedViolation, setSelectedEntry, setPreGenPending, setPreGenPreview, setPreGenPreviewError, setPreGenAllowSoftOverride]);

	const handleStartNewPreGenerationDraft = useCallback(async () => {
		if (!schoolYearId) return;
		const counts = draftBoard?.counts ?? await fetchDraftBoardSummary(schoolYearId);
		if ((counts?.draft ?? 0) > 0 || preGenPending) {
			setShowResetDraftDialog(true);
			return;
		}
		await openPreGenerationWorkspace(false);
	}, [schoolYearId, draftBoard?.counts, fetchDraftBoardSummary, preGenPending, setShowResetDraftDialog, openPreGenerationWorkspace]);

	const handlePublishConfirm = useCallback(() => {
		setShowPublishDialog(false);
		toast.info('Publish API is Phase 5 scope - no action taken.');
	}, [setShowPublishDialog]);

	const runIdNumeric = draft?.runId ?? null;
	const runVersion = draft?.version ?? 0;

	const apiBase = useMemo(() => {
		if (!schoolYearId || !runIdNumeric) return null;
		return `/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${runIdNumeric}/manual-edits`;
	}, [schoolYearId, runIdNumeric]);

	const fetchEditHistory = useCallback(async () => {
		if (!apiBase) return;
		try {
			const { data } = await atlasApi.get<{ edits: ManualEditRecord[] }>(apiBase);
			setEditHistory(data.edits);
		} catch {
			// ignore
		}
	}, [apiBase, setEditHistory]);

	const previewEdit = useCallback(async (proposal: ManualEditProposal): Promise<PreviewResult | null> => {
		if (!apiBase) return null;
		setPreviewLoading(true);
		try {
			const { data } = await atlasApi.post<PreviewResult>(`${apiBase}/preview`, proposal);
			setPreviewResult(data);
			return data;
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Preview failed.';
			toast.error(msg);
			return null;
		} finally {
			setPreviewLoading(false);
		}
	}, [apiBase, setPreviewLoading, setPreviewResult]);

	const commitEdit = useCallback(async (proposal: ManualEditProposal, _allowSoftOverride = false) => {
		if (!apiBase) return;
		setCommitLoading(true);
		try {
			const { data } = await atlasApi.post<CommitResult>(`${apiBase}/commit`, {
				proposal,
				expectedVersion: runVersion,
				allowSoftOverride: true,
			});
			setDraft(data.draft);
			if (schoolYearId && runIdNumeric) {
				const violRes = await atlasApi.get<ViolationReport>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${runIdNumeric}/violations`);
				setViolationReport(violRes.data);
			}
			await fetchEditHistory();
			if (data.warnings.length > 0) toast.warning(`Edit applied with ${data.warnings.length} soft warning(s).`);
			else toast.success('Edit applied successfully.');
		} catch (e: unknown) {
			const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (e instanceof Error ? e.message : 'Commit failed.');
			if (msg.includes('VERSION_CONFLICT') || msg.includes('version conflict')) toast.error('Version conflict - someone else edited this run. Please refresh.');
			else toast.error(msg);
		} finally {
			setCommitLoading(false);
			setPreviewResult(null);
			setSoftConfirmWarnings([]);
			setShowSoftConfirm(false);
			setPendingCommitProposal(null);
			setDragItem(null);
		}
	}, [apiBase, runVersion, schoolYearId, runIdNumeric, setCommitLoading, setViolationReport, fetchEditHistory, setPreviewResult, setSoftConfirmWarnings, setShowSoftConfirm, setPendingCommitProposal, setDragItem, setDraft]);

	const revertLastEdit = useCallback(async () => {
		if (!apiBase) return;
		setRevertLoading(true);
		try {
			const { data } = await atlasApi.post<CommitResult>(`${apiBase}/revert`);
			setDraft(data.draft);
			if (schoolYearId && runIdNumeric) {
				const violRes = await atlasApi.get<ViolationReport>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${runIdNumeric}/violations`);
				setViolationReport(violRes.data);
			}
			await fetchEditHistory();
			toast.success('Last edit reverted.');
		} catch (e: unknown) {
			const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (e instanceof Error ? e.message : 'Revert failed.');
			toast.error(msg);
		} finally {
			setRevertLoading(false);
		}
	}, [apiBase, schoolYearId, runIdNumeric, setRevertLoading, setViolationReport, fetchEditHistory, setDraft]);

	const choosePreGenFaculty = useCallback((item: DraftQueueItem) => {
		const contextFacultyId = viewMode === 'faculty' ? Number(entityFilter) : 0;
		if (contextFacultyId && item.facultyOptions.includes(contextFacultyId)) return contextFacultyId;
		return item.facultyOptions[0] ?? Array.from(facultyMap.keys())[0] ?? 0;
	}, [entityFilter, facultyMap, viewMode]);

	const choosePreGenRoom = useCallback((item: DraftQueueItem) => {
		const contextRoomId = viewMode === 'room' ? Number(entityFilter) : 0;
		if (contextRoomId && roomMap.get(contextRoomId)?.isTeachingSpace) return contextRoomId;
		const preferred = Array.from(roomMap.values()).find((room) => room.isTeachingSpace && room.type === item.preferredRoomType);
		return preferred?.id ?? Array.from(roomMap.values()).find((room) => room.isTeachingSpace)?.id ?? 0;
	}, [entityFilter, roomMap, viewMode]);

	const buildPreGenPendingPlacement = useCallback((
		source: PreGenDragSource,
		day: string,
		startTime: string,
		endTime: string,
		facultyId: number,
		roomId: number,
	): PreGenPendingPlacement => {
		if (source.type === 'draftQueue') {
			return {
				entryKind: source.item.entryKind,
				sectionId: source.item.sectionId,
				subjectId: source.item.subjectId,
				facultyId,
				roomId,
				day,
				startTime,
				endTime,
				cohortCode: source.item.cohortCode,
				sourceLabel: `${source.item.subjectCode} - ${source.item.sectionName} - session ${source.item.sessionNumber}/${source.item.sessionsPerWeek}`,
			};
		}
		return {
			placementId: source.placement.id,
			entryKind: source.placement.entryKind,
			sectionId: source.placement.sectionId,
			subjectId: source.placement.subjectId,
			facultyId,
			roomId,
			day,
			startTime,
			endTime,
			cohortCode: source.placement.cohortCode,
			notes: source.placement.notes,
			expectedVersion: source.placement.version,
			sourceLabel: `Draft placement #${source.placement.id}`,
		};
	}, []);

	const openSwapPrompt = useCallback((
		source: PreGenDragSource,
		target: { day: string; startTime: string; endTime: string; facultyId: number; roomId: number },
		displaced: DraftPlacement,
		sourceLabel: string,
	) => {
		const displacementMode: PendingSwapAction['displacementMode'] =
			source.type === 'draftPlacement' ? 'to-source-slot' : 'to-queue';
		setSwapAction({ source, target, displaced, displacementMode, sourceLabel });
		setShowSwapConfirm(true);

		// Load the exact server-side swap preview so dialog blocking matches commit behavior.
		if (!schoolYearId) return;
		setSwapPreview({ atomicPreview: null, sourcePreview: null, loading: true, error: null });
		void (async () => {
			try {
				if (source.type === 'draftPlacement') {
					const { data } = await atlasApi.post<DraftPlacementSwapPreview>(
						`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/swap/preview`,
						{
							sourcePlacementId: source.placement.id,
							targetPlacementId: displaced.id,
							sourceExpectedVersion: source.placement.version,
							targetExpectedVersion: displaced.version,
						},
					);
					setSwapPreview({ atomicPreview: data, sourcePreview: null, loading: false, error: null });
					return;
				}
				const sourcePending = buildPreGenPendingPlacement(source, target.day, target.startTime, target.endTime, target.facultyId, target.roomId);
				const { data } = await atlasApi.post<PreviewResult>(
					`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/preview`,
					sourcePending,
				);
				setSwapPreview({
					atomicPreview: null,
					sourcePreview: data,
					loading: false,
					error: null,
				});
			} catch {
				setSwapPreview({ atomicPreview: null, sourcePreview: null, loading: false, error: 'Preview unavailable.' });
			}
		})();
	}, [setSwapAction, setShowSwapConfirm, schoolYearId, buildPreGenPendingPlacement, setSwapPreview]);

	const runPreGenPreview = useCallback(async (pending: PreGenPendingPlacement) => {
		if (!schoolYearId) return;
		setPreGenPreviewLoading(true);
		setPreGenPreviewError(null);
		try {
			const { data } = await atlasApi.post<PreviewResult>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/preview`, pending);
			setPreGenPreview(scopePreviewToCandidate(data, { day: pending.day, startTime: pending.startTime, endTime: pending.endTime }));
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			setPreGenPreview(null);
			setPreGenPreviewError(message ?? 'Unable to preview this pre-generation placement.');
		} finally {
			setPreGenPreviewLoading(false);
		}
	}, [schoolYearId, setPreGenPreviewLoading, setPreGenPreviewError, setPreGenPreview]);

	const stagePreGenDrop = useCallback(async (
		source: PreGenDragSource,
		day: string,
		startTime: string,
		endTime: string,
		options?: { suppressConfirm?: boolean },
	) => {
		if (!schoolYearId) return;
		const suppressConfirm = options?.suppressConfirm === true;
		const candidateFacultyId = source.type === 'draftQueue' ? choosePreGenFaculty(source.item) : (source.placement.facultyId ?? 0);
		const candidateRoomId = source.type === 'draftQueue' ? choosePreGenRoom(source.item) : (source.placement.roomId ?? 0);

		dbg('stage:start', { sourceType: source.type, suppressConfirm, candidateFacultyId, candidateRoomId, day, startTime, endTime });

		if (!candidateFacultyId || !candidateRoomId) {
			toast.error('Cannot place this session yet. Select a faculty and room from a compatible context first.');
			return;
		}

		const pending = buildPreGenPendingPlacement(source, day, startTime, endTime, candidateFacultyId, candidateRoomId);
		dbg('pendingLabel', pending.sourceLabel);

		if (source.type === 'draftPlacement') {
			// ALWAYS check for slot conflicts first, regardless of suppressConfirm.
			// This ensures grid-drag of a pinned entry routes to the swap modal just
			// like a left-rail pin drag does.
			const conflictsAtTarget = (draftBoard?.placements ?? []).filter(
				(p) => p.status === 'DRAFT' && p.day === day && p.startTime === startTime && p.endTime === endTime && p.id !== source.placement.id,
			);
			dbg('targetConflicts', { count: conflictsAtTarget.length, ids: conflictsAtTarget.map((c) => c.id) });
			if (conflictsAtTarget.length === 1) {
				dbg('action:openSwapPrompt', { displaced: conflictsAtTarget[0]!.id });
				openSwapPrompt(source, { day, startTime, endTime, facultyId: candidateFacultyId, roomId: candidateRoomId }, conflictsAtTarget[0]!, pending.sourceLabel);
				return;
			}
			if (!suppressConfirm) {
				// Left-rail pin drag: open confirm sheet so faculty/room can be reviewed
				dbg('action:openConfirmSheet');
				setConfirmFacultyId(String(candidateFacultyId));
				setConfirmRoomId(String(candidateRoomId));
				setConfirmPreview(null);
				setConfirmRawPreview(null);
				setConfirmPreviewError(null);
				setConfirmAllowSoftOverride(false);
				setConfirmAllowDailyOverride(false);
				setPreGenConfirmCtx({ source, day, startTime, endTime });
				setShowPreGenConfirm(true);
				return;
			}
			// suppressConfirm=true (grid drag): placement already has faculty/room,
			// target slot is empty — fall through to preview + commit below.
		}

		setPreGenPreviewLoading(true);
		setPreGenPreviewError(null);
		try {
			const { data } = await atlasApi.post<PreviewResult>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/preview`, pending);
			const scoped = scopePreviewToCandidate(data, { day, startTime, endTime });

			if (scoped.hardViolations.length > 0 || scoped.dailyLoadBand === 'hard') {
				const displaced = (draftBoard?.placements ?? []).filter((placement) =>
					placement.status === 'DRAFT' && placement.day === day && placement.startTime === startTime && placement.endTime === endTime,
				);
				if (displaced.length === 1) {
					dbg('action:openSwapPrompt (hard-block displaced)', { displaced: displaced[0].id });
					openSwapPrompt(source, { day, startTime, endTime, facultyId: candidateFacultyId, roomId: candidateRoomId }, displaced[0], pending.sourceLabel);
					return;
				}
				dbg('action:hardBlock', { hardViolations: scoped.hardViolations.length, dailyLoadBand: scoped.dailyLoadBand, displacedCount: displaced.length });
				setPreviewResult(scoped);
				setBlockerModalData(scoped.humanConflicts.filter((conflict) => conflict.severity === 'HARD'));
				toast.info('Target slot has a blocking conflict. Move the conflicting session or choose another slot.');
				return;
			}

			const hasSoftWarnings = scoped.dailyLoadBand === 'soft' || scoped.softViolations.length > 0;
			dbg('action:commit', { hasSoftWarnings, softViolations: scoped.softViolations.length, suppressConfirm });
			const { data: commitResult } = await atlasApi.post<DraftPlacementCommitResult>(
				`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/commit`,
				pending,
			);
			setPreviewResult(scoped);
			setDraftBoard(commitResult.board);
			setDraftBoardSummary(commitResult.board.counts);
			setSelectedEntry(null);
			setPreGenKbSource(null);
			setKbSelectedSource(null);
			if (suppressConfirm && hasSoftWarnings) toast.warning('Session moved with soft warnings. Review details in the right panel.');
			else if (hasSoftWarnings) toast.warning('Pinned session placed with soft warnings for this slot.');
			else toast.success(source.type === 'draftPlacement' ? 'Pinned session moved.' : 'Pinned session placed.');
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Unable to place this session.');
		} finally {
			setPreGenPreviewLoading(false);
		}
	}, [
		schoolYearId,
		choosePreGenFaculty,
		choosePreGenRoom,
		buildPreGenPendingPlacement,
		draftBoard?.placements,
		openSwapPrompt,
		setConfirmFacultyId,
		setConfirmRoomId,
		setConfirmPreview,
		setConfirmRawPreview,
		setConfirmPreviewError,
		setConfirmAllowSoftOverride,
		setConfirmAllowDailyOverride,
		setPreGenConfirmCtx,
		setShowPreGenConfirm,
		setPreGenPreviewLoading,
		setPreGenPreviewError,
		setPreviewResult,
		setBlockerModalData,
		setDraftBoard,
		setDraftBoardSummary,
		setSelectedEntry,
		setPreGenKbSource,
		setKbSelectedSource,
	]);

	const runConfirmPreview = useCallback(async () => {
		if (!schoolYearId || !preGenConfirmCtx) return;
		const fId = Number(confirmFacultyId);
		const rId = Number(confirmRoomId);
		if (!fId || !rId) {
			setConfirmPreviewError('Select a faculty member and a room before previewing.');
			return;
		}
		setConfirmPreviewLoading(true);
		setConfirmPreviewError(null);
		setConfirmPreview(null);
		setConfirmRawPreview(null);
		const { source, day, startTime, endTime } = preGenConfirmCtx;
		const body = buildPreGenPendingPlacement(source, day, startTime, endTime, fId, rId);
		try {
			const { data } = await atlasApi.post<PreviewResult>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/preview`, body);
			setConfirmRawPreview(data);
			setConfirmPreview(scopePreviewToCandidate(data, { day, startTime, endTime }));
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			setConfirmPreviewError(message ?? 'Unable to preview this placement.');
		} finally {
			setConfirmPreviewLoading(false);
		}
	}, [
		schoolYearId,
		preGenConfirmCtx,
		confirmFacultyId,
		confirmRoomId,
		setConfirmPreviewError,
		setConfirmPreviewLoading,
		setConfirmPreview,
		setConfirmRawPreview,
		buildPreGenPendingPlacement,
	]);

	useEffect(() => {
		if (autoPreviewRef.current) clearTimeout(autoPreviewRef.current);
		if (!confirmFacultyId || !confirmRoomId || !preGenConfirmCtx) {
			setConfirmPreview(null);
			setConfirmPreviewError(null);
			return;
		}
		autoPreviewRef.current = setTimeout(() => void runConfirmPreview(), 600);
		return () => {
			if (autoPreviewRef.current) clearTimeout(autoPreviewRef.current);
		};
	}, [confirmFacultyId, confirmRoomId, preGenConfirmCtx, runConfirmPreview, autoPreviewRef, setConfirmPreview, setConfirmPreviewError]);

	const commitConfirmPlacement = useCallback(async () => {
		if (!schoolYearId || !preGenConfirmCtx) return;
		const fId = Number(confirmFacultyId);
		const rId = Number(confirmRoomId);
		if (!fId || !rId) {
			toast.error('Select a faculty member and a room first.');
			return;
		}
		setConfirmSaving(true);
		const { source, day, startTime, endTime } = preGenConfirmCtx;
		const baseBody = buildPreGenPendingPlacement(source, day, startTime, endTime, fId, rId);
		try {
			const { data } = await atlasApi.post<DraftPlacementCommitResult>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/commit`, baseBody);
			setDraftBoard(data.board);
			setDraftBoardSummary(data.board.counts);
			setShowPreGenConfirm(false);
			setPreGenConfirmCtx(null);
			setConfirmPreview(null);
			setConfirmRawPreview(null);
			setConfirmFacultyId('');
			setConfirmRoomId('');
			setSelectedEntry(null);
			setPreGenKbSource(null);
			setKbSelectedSource(null);
			toast.success('Draft placement saved.');
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to save placement.');
		} finally {
			setConfirmSaving(false);
		}
	}, [
		schoolYearId,
		preGenConfirmCtx,
		confirmFacultyId,
		confirmRoomId,
		setConfirmSaving,
		buildPreGenPendingPlacement,
		setDraftBoard,
		setDraftBoardSummary,
		setShowPreGenConfirm,
		setPreGenConfirmCtx,
		setConfirmPreview,
		setConfirmRawPreview,
		setConfirmFacultyId,
		setConfirmRoomId,
		setSelectedEntry,
		setPreGenKbSource,
		setKbSelectedSource,
	]);

	const executeSwapAction = useCallback(async () => {
		if (!schoolYearId || !swapAction) return;
		setSwapSaving(true);
		try {
			if (swapAction.displacementMode === 'to-source-slot' && swapAction.source.type === 'draftPlacement') {
				const { data } = await atlasApi.post<DraftPlacementSwapResult>(
					`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/swap`,
					{
						sourcePlacementId: swapAction.source.placement.id,
						targetPlacementId: swapAction.displaced.id,
						sourceExpectedVersion: swapAction.source.placement.version,
						targetExpectedVersion: swapAction.displaced.version,
					},
				);
				setDraftBoard(data.board);
				setDraftBoardSummary(data.board.counts);
				setSelectedEntry(null);
				setPreGenKbSource(null);
				setKbSelectedSource(null);
				setShowSwapConfirm(false);
				setSwapAction(null);
				setSwapPreview(null);
				const hasSoftWarnings = data.preview.softViolations.length > 0
					|| data.preview.dailyLoads.source.dailyLoadBand === 'soft'
					|| data.preview.dailyLoads.target.dailyLoadBand === 'soft';
				if (hasSoftWarnings) toast.warning('Sessions switched slots with soft warnings. Review details in the right panel.');
				else toast.success('Sessions switched slots.');
			} else {
				// 'to-queue': source is a queue item — displaced returns to unassigned
				await atlasApi.delete<DraftBoardState>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/${swapAction.displaced.id}`);
				const sourceBody = buildPreGenPendingPlacement(
					swapAction.source,
					swapAction.target.day,
					swapAction.target.startTime,
					swapAction.target.endTime,
					swapAction.target.facultyId,
					swapAction.target.roomId,
				);
				const { data } = await atlasApi.post<DraftPlacementCommitResult>(
					`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/commit`,
					sourceBody,
				);
				setDraftBoard(data.board);
				setDraftBoardSummary(data.board.counts);
				setSelectedEntry(null);
				setPreGenKbSource(null);
				setKbSelectedSource(null);
				setShowSwapConfirm(false);
				setSwapAction(null);
				setSwapPreview(null);
				toast.success('Swap completed. Conflicting session returned to unassigned and the new session was placed.');
			}
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Unable to complete swap.');
		} finally {
			setSwapSaving(false);
		}
	}, [schoolYearId, swapAction, setSwapSaving, buildPreGenPendingPlacement, setDraftBoard, setDraftBoardSummary, setSelectedEntry, setPreGenKbSource, setKbSelectedSource, setShowSwapConfirm, setSwapAction, setSwapPreview]);

	const executeRegularSwap = useCallback(async () => {
		if (!regularSwapPending || !apiBase) return;
		const { entryA, entryB } = regularSwapPending;
		setRegularSwapSaving(true);
		try {
			const { data } = await atlasApi.post<CommitResult>(`${apiBase}/swap`, { entryIdA: entryA.entryId, entryIdB: entryB.entryId, expectedVersion: runVersion });
			setDraft(data.draft);
			if (schoolYearId && runIdNumeric) {
				const violRes = await atlasApi.get<ViolationReport>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${runIdNumeric}/violations`);
				setViolationReport(violRes.data);
			}
			await fetchEditHistory();
			setRegularSwapPending(null);
			setSelectedEntry(null);
			toast.success('Sessions swapped.');
		} catch (e: unknown) {
			const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Swap failed.';
			toast.error(msg);
		} finally {
			setRegularSwapSaving(false);
		}
	}, [regularSwapPending, apiBase, runVersion, setRegularSwapSaving, setDraft, schoolYearId, runIdNumeric, setViolationReport, fetchEditHistory, setRegularSwapPending, setSelectedEntry]);

	const unassignDraftPlacement = useCallback(async (placementId: number) => {
		if (!schoolYearId) return;
		setDeletingPlacementId(placementId);
		try {
			const { data } = await atlasApi.delete<DraftBoardState>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/${placementId}`);
			setDraftBoard(data);
			setDraftBoardSummary(data.counts);
			setSelectedEntry(null);
			setPreGenKbSource(null);
			setKbSelectedSource(null);
			toast.success('Placement removed and returned to queue.');
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to remove placement.');
		} finally {
			setDeletingPlacementId(null);
		}
	}, [schoolYearId, setDeletingPlacementId, setDraftBoard, setDraftBoardSummary, setSelectedEntry, setPreGenKbSource, setKbSelectedSource]);

	const getDraggedDraftPlacementId = useCallback((source: any): number | null => {
		if (!source) return null;
		if (source.type === 'draftPlacement') return source.placement.id;
		if (source.type === 'entry') return parseDraftPlacementId(source.entry.entryId);
		return null;
	}, []);

	const commitPreGenPending = useCallback(async () => {
		if (!schoolYearId || !preGenPending) return;
		setPreGenSaving(true);
		try {
			const { data } = await atlasApi.post<DraftPlacementCommitResult>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/commit`, preGenPending);
			setDraftBoard(data.board);
			setDraftBoardSummary(data.board.counts);
			setPreGenPreview(data.preview);
			setPreGenPending(null);
			setPreGenAllowSoftOverride(false);
			setPreGenPreviewError(null);
			toast.success(preGenPending.placementId ? 'Draft placement updated.' : 'Draft placement saved.');
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Unable to save pre-generation placement.');
		} finally {
			setPreGenSaving(false);
		}
	}, [schoolYearId, preGenPending, setPreGenSaving, setDraftBoard, setDraftBoardSummary, setPreGenPreview, setPreGenPending, setPreGenAllowSoftOverride, setPreGenPreviewError]);

	return {
		filteredRoomRequests,
		focusRequestInGrid,
		openRequestPreview,
		submitAppeal,
		updateAppealStatus,
		reviewRoomRequest,
		requestPreviewConflicts,
		requestPreviewHardConflicts,
		requestPreviewSoftWarnings,
		handleViolationSelect,
		handleEntryClick,
		toggleFollowUp,
		triggerGeneration,
		handleTriggerGenerate,
		confirmGenerate,
		openPreGenerationWorkspace,
		handleStartNewPreGenerationDraft,
		handlePublishConfirm,
		runIdNumeric,
		runVersion,
		apiBase,
		fetchEditHistory,
		previewEdit,
		commitEdit,
		revertLastEdit,
		choosePreGenFaculty,
		choosePreGenRoom,
		buildPreGenPendingPlacement,
		openSwapPrompt,
		runPreGenPreview,
		stagePreGenDrop,
		runConfirmPreview,
		commitConfirmPlacement,
		executeSwapAction,
		executeRegularSwap,
		unassignDraftPlacement,
		getDraggedDraftPlacementId,
		commitPreGenPending,
		swapPreview,
	};
}
