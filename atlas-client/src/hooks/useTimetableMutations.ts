import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { parseDraftPlacementId, scopePreviewToCandidate } from '@/lib/timetable-utils';
import { resolvePreGenSlotDisplacement } from '@/lib/timetable-swap-routing';
import type { PendingSwapAction } from '@/components/timetable/ScheduleReviewWorkspace.constants';
import type {
	CommitResult,
	DraftBoardState,
	DraftPlacement,
	DraftPlacementCommitResult,
	DraftPlacementSwapResult,
	DraftQueueItem,
	DraftReport,
	ManualEditBatchPreviewResult,
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
	TeachingLoadRepairApplyResult,
	TeachingLoadRepairChange,
	TeachingLoadRepairPreviewResult,
	UnassignedItem,
	HumanConflict,
	Violation,
	ViolationReport,
} from '@/types';

const DEFAULT_SCHOOL_ID = 1;

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
	sourcePreview: PreviewResult | null;
	displacedPreview: PreviewResult | null;
	loading: boolean;
	error: string | null;
};

type RegularSwapPreviewState = {
	directPreview: PreviewResult | null;
	autoFixBlockingPreview: PreviewResult | null;
	autoFixBlockingTarget: { day: string; startTime: string; endTime: string } | null;
	autoFixSourcePreview: PreviewResult | null;
	autoFixSourceTarget: { day: string; startTime: string; endTime: string } | null;
	recommendedStrategy: 'DIRECT_SWAP' | 'AUTO_FIX_MOVE_BLOCKING' | 'AUTO_FIX_MOVE_SOURCE' | 'BLOCKED' | null;
	loading: boolean;
	error: string | null;
};

function buildTeachingLoadRepairChangesFromProposals(
	proposals: ManualEditProposal[],
	entries: ScheduledEntry[],
): TeachingLoadRepairChange[] {
	const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
	return proposals.flatMap((proposal) => {
		if (proposal.editType !== 'CHANGE_FACULTY' || !proposal.entryId || typeof proposal.targetFacultyId !== 'number') return [];
		const entry = entriesById.get(proposal.entryId);
		if (!entry) return [];
		return [{
			kind: 'ENTRY',
			entryId: entry.entryId,
			subjectId: entry.subjectId,
			sectionId: entry.sectionId,
			fromFacultyId: entry.facultyId,
			toFacultyId: proposal.targetFacultyId,
		}];
	});
}

function buildExpectedFacultyVersions(
	changes: TeachingLoadRepairChange[],
	facultyMap: Map<number, { id: number; version?: number }>,
): Record<string, number> {
	const expectedFacultyVersions: Record<string, number> = {};
	for (const change of changes) {
		const fromFaculty = change.fromFacultyId ? facultyMap.get(change.fromFacultyId) : null;
		const toFaculty = facultyMap.get(change.toFacultyId);
		if (fromFaculty && typeof fromFaculty.version === 'number') expectedFacultyVersions[String(change.fromFacultyId)] = fromFaculty.version;
		if (toFaculty && typeof toFaculty.version === 'number') expectedFacultyVersions[String(change.toFacultyId)] = toFaculty.version;
	}
	return expectedFacultyVersions;
}

export type PreGenPendingPlacement = {
	placementId?: number;
	excludePlacementIds?: number[];
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
	enforceShiftWindows: boolean;
	setEnforceShiftWindows: React.Dispatch<React.SetStateAction<boolean>>;
	draftBoardSummary: DraftBoardState['counts'] | null;
	fetchDraftBoardSummary: (syId: number) => Promise<DraftBoardState['counts'] | null>;
	loadAll: (preserveRun?: boolean) => Promise<void>;
	setNewDraftLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setDraftBoard: React.Dispatch<React.SetStateAction<DraftBoardState | null>>;
	setDraftBoardSummary: React.Dispatch<React.SetStateAction<DraftBoardState['counts'] | null>>;
	setLeftTab: React.Dispatch<React.SetStateAction<'violations' | 'unassigned' | 'pinned' | 'requests'>>;
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
	violations: Violation[];
	setShowPublishDialog: React.Dispatch<React.SetStateAction<boolean>>;
	publishAcknowledged: boolean;
	setPublishAcknowledged: React.Dispatch<React.SetStateAction<boolean>>;
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
	facultyMap: Map<number, { id: number; version?: number }>;
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
	confirmGenerate: (enforceShiftWindowsOverride?: boolean) => void;
	openPreGenerationWorkspace: (resetExisting: boolean) => Promise<void>;
	handleStartNewPreGenerationDraft: () => Promise<void>;
	handlePublishConfirm: () => void;
	runIdNumeric: number | null;
	runVersion: number;
	apiBase: string | null;
	fetchEditHistory: () => Promise<void>;
	previewEdit: (proposal: ManualEditProposal) => Promise<PreviewResult | null>;
	commitEdit: (proposal: ManualEditProposal, allowSoftOverride?: boolean) => Promise<void>;
	previewEditBatch: (proposals: ManualEditProposal[]) => Promise<TeachingLoadRepairPreviewResult | null>;
	commitEditBatch: (proposals: ManualEditProposal[], allowSoftOverride?: boolean) => Promise<CommitResult | null>;
	previewTeachingLoadRepair: (changes: TeachingLoadRepairChange[], placementProposal?: ManualEditProposal) => Promise<TeachingLoadRepairPreviewResult | null>;
	commitTeachingLoadRepair: (changes: TeachingLoadRepairChange[], allowSoftOverride?: boolean, placementProposal?: ManualEditProposal) => Promise<CommitResult | null>;
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
	regularSwapStrategy: 'DIRECT_SWAP' | 'AUTO_FIX_MOVE_BLOCKING' | 'AUTO_FIX_MOVE_SOURCE' | null;
	setRegularSwapStrategy: React.Dispatch<React.SetStateAction<'DIRECT_SWAP' | 'AUTO_FIX_MOVE_BLOCKING' | 'AUTO_FIX_MOVE_SOURCE' | null>>;
	unassignDraftPlacement: (placementId: number) => Promise<void>;
	getDraggedDraftPlacementId: (source: any) => number | null;
	commitPreGenPending: () => Promise<void>;
	/** Swap preview results loaded when swap confirm dialog opens (Fix C) */
	swapPreview: SwapPreviewState | null;
	regularSwapPreview: RegularSwapPreviewState | null;
	openRegularSwapPrompt: (entryA: ScheduledEntry, entryB: ScheduledEntry) => void;
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
		enforceShiftWindows,
		setEnforceShiftWindows,
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
		violations,
		setShowPublishDialog,
		publishAcknowledged,
		setPublishAcknowledged,
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
	const [regularSwapPreview, setRegularSwapPreview] = useState<RegularSwapPreviewState | null>(null);
	const [regularSwapStrategy, setRegularSwapStrategy] = useState<'DIRECT_SWAP' | 'AUTO_FIX_MOVE_BLOCKING' | 'AUTO_FIX_MOVE_SOURCE' | null>(null);
	const previewCacheRef = useRef<Map<string, PreviewResult>>(new Map());
	const regularSwapPreviewCacheRef = useRef<Map<string, RegularSwapPreviewState>>(new Map());

	// Clear swap preview when swap action is dismissed (cancel path)
	useEffect(() => {
		if (!swapAction) setSwapPreview(null);
	}, [swapAction]);

	useEffect(() => {
		if (!regularSwapPending) {
			setRegularSwapPreview(null);
			setRegularSwapStrategy(null);
		}
	}, [regularSwapPending]);

	useEffect(() => {
		previewCacheRef.current.clear();
		regularSwapPreviewCacheRef.current.clear();
	}, [draft?.version, draft?.runId]);

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
			setRequestPreview({
				...data,
				preview: scopePreviewToCandidate(data.preview, {
					day: request.day,
					startTime: request.startTime,
					endTime: request.endTime,
				}),
			});
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

	const triggerGeneration = useCallback(async (
		ignoreRoomRequestGate: boolean = false,
		enforceShiftWindowsFlag: boolean = enforceShiftWindows,
	) => {
		if (!schoolYearId) return;
		setGenerating(true);
		const lockedAnchorCount = draftBoardSummary?.draft ?? 0;
		try {
			const { data: run } = await atlasApi.post<import('@/types').GenerationRun>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs`, {
				ignoreRoomRequestGate,
				enforceShiftWindows: enforceShiftWindowsFlag,
			});
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
		enforceShiftWindows,
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
		setEnforceShiftWindows(true);
		setShowGenerateConfirm(true);
	}, [schoolYearId, draftBoardSummary, fetchDraftBoardSummary, setEnforceShiftWindows, setShowGenerateConfirm]);

	const confirmGenerate = useCallback((enforceShiftWindowsOverride?: boolean) => {
		if (typeof enforceShiftWindowsOverride === 'boolean') {
			setEnforceShiftWindows(enforceShiftWindowsOverride);
		}
		setShowGenerateConfirm(false);
		void triggerGeneration(true, enforceShiftWindowsOverride ?? enforceShiftWindows);
	}, [enforceShiftWindows, setEnforceShiftWindows, setShowGenerateConfirm, triggerGeneration]);

	const openPreGenerationWorkspace = useCallback(async (resetExisting: boolean) => {
		if (!schoolYearId) return;
		setNewDraftLoading(true);
		try {
			const { data } = resetExisting
				? await atlasApi.post<DraftBoardState>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/clear`)
				: await atlasApi.get<DraftBoardState>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts`);
			setDraftBoard(data);
			setDraftBoardSummary(data.counts);
			setLeftTab('pinned');
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

	const handlePublishConfirm = useCallback(async () => {
		if (!schoolYearId || !draft?.runId) {
			toast.error('No active run selected for publish.');
			return;
		}

		const softViolationCount = violations.filter((violation) => violation.severity === 'SOFT').length;
		if (softViolationCount > 0 && !publishAcknowledged) {
			toast.error('Review and acknowledge soft warnings before publishing.');
			return;
		}

		try {
			const { data } = await atlasApi.post<{ run: import('@/types').GenerationRun }>(
				`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${draft.runId}/publish`,
				{
					acknowledgeSoftViolations: softViolationCount > 0 && publishAcknowledged,
				},
			);
			setPublishAcknowledged(false);
			setShowPublishDialog(false);
			toast.success(`Run #${data.run.id} published. Final schedule is now viewable.`);
			await loadAll(false);
		} catch (e: unknown) {
			const axiosErr = e as {
				response?: {
					data?: {
						code?: string;
						message?: string;
						details?: {
							hardViolationCount?: number;
							softViolationCount?: number;
						};
					};
				};
			};
			const code = axiosErr?.response?.data?.code;
			if (code === 'PUBLISH_BLOCKED_HARD_VIOLATIONS') {
				const hardViolationCount = axiosErr?.response?.data?.details?.hardViolationCount;
				toast.error(
					typeof hardViolationCount === 'number'
						? `Publish blocked: ${hardViolationCount} hard violation(s) remain.`
						: 'Publish blocked: hard violations remain unresolved.',
				);
				return;
			}
			if (code === 'PUBLISH_ACK_REQUIRED_SOFT_VIOLATIONS') {
				const softViolationCount = axiosErr?.response?.data?.details?.softViolationCount;
				toast.error(
					typeof softViolationCount === 'number'
						? `Publish requires acknowledgment of ${softViolationCount} soft warning(s).`
						: 'Publish requires acknowledgment of soft warnings.',
				);
				return;
			}
			const msg = axiosErr?.response?.data?.message ?? (e instanceof Error ? e.message : 'Publish request failed.');
			toast.error(msg);
		}
	}, [schoolYearId, draft?.runId, violations, publishAcknowledged, setPublishAcknowledged, setShowPublishDialog, loadAll]);

	const runIdNumeric = draft?.runId ?? null;
	const runVersion = draft?.version ?? 0;

	const apiBase = useMemo(() => {
		if (!schoolYearId || !runIdNumeric) return null;
		return `/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${runIdNumeric}/manual-edits`;
	}, [schoolYearId, runIdNumeric]);
	const teachingLoadRepairBase = useMemo(() => {
		if (!schoolYearId || !runIdNumeric) return null;
		return `/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${runIdNumeric}/teaching-load-repairs`;
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
		const cacheKey = `${runVersion}:${JSON.stringify(proposal)}`;
		const cached = previewCacheRef.current.get(cacheKey);
		if (cached) {
			setPreviewResult(cached);
			return cached;
		}
		setPreviewLoading(true);
		try {
			const { data } = await atlasApi.post<PreviewResult>(`${apiBase}/preview`, proposal);
			previewCacheRef.current.set(cacheKey, data);
			setPreviewResult(data);
			return data;
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Preview failed.';
			toast.error(msg);
			return null;
		} finally {
			setPreviewLoading(false);
		}
	}, [apiBase, runVersion, setPreviewLoading, setPreviewResult]);

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
			const suppressVerboseToasts = proposal.editType === 'MOVE_ENTRY' || proposal.editType === 'PLACE_UNASSIGNED';
			if (!suppressVerboseToasts) {
				if (data.warnings.length > 0) toast.warning(`Edit applied with ${data.warnings.length} soft warning(s).`);
				else toast.success('Edit applied successfully.');
			}
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

	const previewTeachingLoadRepair = useCallback(async (changes: TeachingLoadRepairChange[], placementProposal?: ManualEditProposal): Promise<TeachingLoadRepairPreviewResult | null> => {
		if (!teachingLoadRepairBase || changes.length === 0) return null;
		if (changes.length === 0) return null;
		setPreviewLoading(true);
		try {
			const { data } = await atlasApi.post<TeachingLoadRepairPreviewResult>(`${teachingLoadRepairBase}/preview`, {
				changes,
				placementProposal,
				expectedRunVersion: runVersion,
				expectedFacultyVersions: buildExpectedFacultyVersions(changes, facultyMap),
			});
			return data;
		} catch (e: unknown) {
			const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code;
			const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (e instanceof Error ? e.message : 'Preview failed.');
			if (code === 'RUN_ALREADY_PUBLISHED') toast.error('This schedule is already published. Create a revision instead of rewriting Teaching Load.');
			else if (code === 'FACULTY_VERSION_CONFLICT') toast.error('Teaching Load changed while this panel was open. Reload and try again.');
			else if (code !== 'COHORT_REPAIR_UNSUPPORTED') toast.error(msg);
			throw e;
		} finally {
			setPreviewLoading(false);
		}
	}, [facultyMap, runVersion, setPreviewLoading, teachingLoadRepairBase]);

	const commitTeachingLoadRepair = useCallback(async (changes: TeachingLoadRepairChange[], allowSoftOverride = false, placementProposal?: ManualEditProposal): Promise<CommitResult | null> => {
		if (!teachingLoadRepairBase || changes.length === 0) return null;
		if (changes.length === 0) return null;
		setCommitLoading(true);
		try {
			const { data } = await atlasApi.post<TeachingLoadRepairApplyResult>(`${teachingLoadRepairBase}/apply`, {
				changes,
				placementProposal,
				expectedRunVersion: runVersion,
				expectedFacultyVersions: buildExpectedFacultyVersions(changes, facultyMap),
				allowSoftOverride,
			});
			setDraft(data.draft);
			setSelectedEntry((current) => current ? data.draft.entries.find((entry) => entry.entryId === current.entryId) ?? current : current);
			if (schoolYearId && runIdNumeric) {
				const violRes = await atlasApi.get<ViolationReport>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${runIdNumeric}/violations`);
				setViolationReport(violRes.data);
			}
			await fetchEditHistory();
			const unassignedCount = changes.filter((change) => change.kind === 'UNASSIGNED').length;
			const placedCount = data.unassignedReadiness?.filter((item) => item.canPlaceNow).length ?? 0;
			if (data.warnings.length > 0) toast.warning(`Saved Teaching Load with ${data.warnings.length} warning${data.warnings.length === 1 ? '' : 's'}.`);
			else if (placedCount > 0) toast.success('Saved Teaching Load and placed the unassigned session.');
			else if (unassignedCount > 0) toast.success('Saved Teaching Load. This session stays in Needs attention until you choose a valid slot.');
			else toast.success(`Saved Teaching Load and updated ${changes.length} timetable block${changes.length === 1 ? '' : 's'}.`);
			setPreviewResult(null);
			setSoftConfirmWarnings([]);
			setShowSoftConfirm(false);
			setPendingCommitProposal(null);
			setDragItem(null);
			return data;
		} catch (e: unknown) {
			const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code;
			const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (e instanceof Error ? e.message : 'Commit failed.');
			if (code === 'VERSION_CONFLICT' || msg.includes('VERSION_CONFLICT') || msg.includes('version conflict')) {
				toast.error('Someone changed this schedule. Reload, review the dock, and try again.');
			} else if (code === 'HARD_VIOLATION_BLOCK') {
				toast.error('These changes would create a schedule conflict. Review the dock details, choose a different teacher, and try again.');
			} else if (code === 'RUN_ALREADY_PUBLISHED') {
				toast.error('This schedule is already published. Create a revision instead of rewriting Teaching Load.');
			} else if (code === 'FACULTY_VERSION_CONFLICT') {
				toast.error('Teaching Load changed while this panel was open. Reload and try again.');
			} else {
				toast.error(msg);
			}
			return null;
		} finally {
			setCommitLoading(false);
		}
	}, [facultyMap, fetchEditHistory, runIdNumeric, runVersion, schoolYearId, setCommitLoading, setDraft, setDragItem, setPendingCommitProposal, setPreviewResult, setSelectedEntry, setShowSoftConfirm, setSoftConfirmWarnings, setViolationReport, teachingLoadRepairBase]);

	const previewEditBatch = useCallback(async (proposals: ManualEditProposal[]): Promise<TeachingLoadRepairPreviewResult | null> => {
		const changes = buildTeachingLoadRepairChangesFromProposals(proposals, draft?.entries ?? []);
		return previewTeachingLoadRepair(changes);
	}, [draft?.entries, previewTeachingLoadRepair]);

	const commitEditBatch = useCallback(async (proposals: ManualEditProposal[], allowSoftOverride = false): Promise<CommitResult | null> => {
		const changes = buildTeachingLoadRepairChangesFromProposals(proposals, draft?.entries ?? []);
		return commitTeachingLoadRepair(changes, allowSoftOverride);
	}, [commitTeachingLoadRepair, draft?.entries]);

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

		// Preview each affected leg separately so warnings are scoped to the source move
		// and, when applicable, the displaced pinned session's return leg.
		if (!schoolYearId) return;
		setSwapPreview({ sourcePreview: null, displacedPreview: null, loading: true, error: null });
		void (async () => {
			try {
				const sourcePending = buildPreGenPendingPlacement(
					source,
					target.day,
					target.startTime,
					target.endTime,
					target.facultyId,
					target.roomId,
				);
				if (source.type === 'draftPlacement') {
					const displacedPending = buildPreGenPendingPlacement(
						{ type: 'draftPlacement', placement: displaced },
						source.placement.day,
						source.placement.startTime,
						source.placement.endTime,
						source.placement.facultyId ?? target.facultyId,
						source.placement.roomId ?? target.roomId,
					);
					const [{ data: sourcePreviewRaw }, { data: displacedPreviewRaw }] = await Promise.all([
						atlasApi.post<PreviewResult>(
							`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/preview`,
							{ ...sourcePending, excludePlacementIds: [displaced.id] },
						),
						atlasApi.post<PreviewResult>(
							`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/preview`,
							{ ...displacedPending, excludePlacementIds: [source.placement.id] },
						),
					]);
					setSwapPreview({
						sourcePreview: scopePreviewToCandidate(sourcePreviewRaw, target),
						displacedPreview: scopePreviewToCandidate(displacedPreviewRaw, {
							day: source.placement.day,
							startTime: source.placement.startTime,
							endTime: source.placement.endTime,
						}),
						loading: false,
						error: null,
					});
					return;
				}
				const { data } = await atlasApi.post<PreviewResult>(
					`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/preview`,
					{ ...sourcePending, excludePlacementIds: [displaced.id] },
				);
				setSwapPreview({
					sourcePreview: scopePreviewToCandidate(data, target),
					displacedPreview: null,
					loading: false,
					error: null,
				});
			} catch {
				setSwapPreview({ sourcePreview: null, displacedPreview: null, loading: false, error: 'Preview unavailable.' });
			}
		})();
	}, [setSwapAction, setShowSwapConfirm, schoolYearId, buildPreGenPendingPlacement, setSwapPreview]);

	const openRegularSwapPrompt = useCallback((entryA: ScheduledEntry, entryB: ScheduledEntry) => {
		setRegularSwapPending({ entryA, entryB });
		const cacheKey = `${runVersion}:${entryA.entryId}:${entryB.entryId}`;
		const cached = regularSwapPreviewCacheRef.current.get(cacheKey);
		if (cached) {
			setRegularSwapPreview(cached);
			setRegularSwapStrategy(cached.recommendedStrategy === 'BLOCKED' ? null : cached.recommendedStrategy);
			return;
		}
		if (!schoolYearId || !runIdNumeric) {
			setRegularSwapPreview({
				directPreview: null,
				autoFixBlockingPreview: null,
				autoFixBlockingTarget: null,
				autoFixSourcePreview: null,
				autoFixSourceTarget: null,
				recommendedStrategy: null,
				loading: false,
				error: 'Missing active run context.',
			});
			return;
		}

		setRegularSwapPreview({
			directPreview: null,
			autoFixBlockingPreview: null,
			autoFixBlockingTarget: null,
			autoFixSourcePreview: null,
			autoFixSourceTarget: null,
			recommendedStrategy: null,
			loading: true,
			error: null,
		});

		void (async () => {
			try {
				const { data } = await atlasApi.post<{
					direct: PreviewResult;
					autoFixBlockingPreview: PreviewResult | null;
					autoFixBlockingTarget: { day: string; startTime: string; endTime: string } | null;
					autoFixSourcePreview: PreviewResult | null;
					autoFixSourceTarget: { day: string; startTime: string; endTime: string } | null;
					recommendedStrategy: 'DIRECT_SWAP' | 'AUTO_FIX_MOVE_BLOCKING' | 'AUTO_FIX_MOVE_SOURCE' | 'BLOCKED';
				}>(`${apiBase}/swap/preview`, {
					entryIdA: entryA.entryId,
					entryIdB: entryB.entryId,
				});

				const previewState: RegularSwapPreviewState = {
					directPreview: data.direct,
					autoFixBlockingPreview: data.autoFixBlockingPreview,
					autoFixBlockingTarget: data.autoFixBlockingTarget,
					autoFixSourcePreview: data.autoFixSourcePreview,
					autoFixSourceTarget: data.autoFixSourceTarget,
					recommendedStrategy: data.recommendedStrategy,
					loading: false,
					error: null,
				};
				regularSwapPreviewCacheRef.current.set(cacheKey, previewState);
				setRegularSwapPreview(previewState);
				setRegularSwapStrategy(data.recommendedStrategy === 'BLOCKED' ? null : data.recommendedStrategy);
			} catch (error) {
				const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
				setRegularSwapPreview({
					directPreview: null,
					autoFixBlockingPreview: null,
					autoFixBlockingTarget: null,
					autoFixSourcePreview: null,
					autoFixSourceTarget: null,
					recommendedStrategy: null,
					loading: false,
					error: message ?? 'Unable to preview swap.',
				});
				setRegularSwapStrategy(null);
			}
		})();
	}, [apiBase, runIdNumeric, runVersion, schoolYearId, setRegularSwapPending]);

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
	) => {
		if (!schoolYearId) return;
		const sourcePlacementId = source.type === 'draftPlacement' ? source.placement.id : undefined;
		const slotDisplacement = resolvePreGenSlotDisplacement(
			draftBoard?.placements ?? [],
			{ day, startTime, endTime },
			sourcePlacementId,
		);
		if (slotDisplacement.kind === 'single' && slotDisplacement.placement) {
			const candidateFacultyId = source.type === 'draftQueue' ? choosePreGenFaculty(source.item) : (source.placement.facultyId ?? 0);
			const candidateRoomId = source.type === 'draftQueue' ? choosePreGenRoom(source.item) : (source.placement.roomId ?? 0);
			if (!candidateFacultyId || !candidateRoomId) {
				toast.error('Cannot place this session yet. Select a faculty and room from a compatible context first.');
				return;
			}
			const pendingForLabel = buildPreGenPendingPlacement(source, day, startTime, endTime, candidateFacultyId, candidateRoomId);
			openSwapPrompt(
				source,
				{ day, startTime, endTime, facultyId: candidateFacultyId, roomId: candidateRoomId },
				slotDisplacement.placement,
				pendingForLabel.sourceLabel,
			);
			return;
		}
		if (slotDisplacement.kind === 'multiple') {
			toast.error('Swap could not start because multiple sessions already occupy this slot. Choose a clean slot or resolve one conflict first.');
			return;
		}

		const candidateFacultyId = source.type === 'draftQueue' ? choosePreGenFaculty(source.item) : (source.placement.facultyId ?? 0);
		const candidateRoomId = source.type === 'draftQueue' ? choosePreGenRoom(source.item) : (source.placement.roomId ?? 0);

		if (!candidateFacultyId || !candidateRoomId) {
			toast.error('Cannot place this session yet. Select a faculty and room from a compatible context first.');
			return;
		}

		const pending = buildPreGenPendingPlacement(source, day, startTime, endTime, candidateFacultyId, candidateRoomId);

		setPreGenPending(pending);
		setPreGenPreview(null);
		setPreGenPreviewError(null);
		setPreGenAllowSoftOverride(false);
		setPreGenPreviewLoading(true);
		try {
			const { data: previewRaw } = await atlasApi.post<PreviewResult>(
				`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/preview`,
				pending,
			);
			const preview = scopePreviewToCandidate(previewRaw, { day, startTime, endTime });
			setPreGenPreview(preview);
			if (!preview.allowed) {
				setPreGenPreviewError('This placement has hard conflicts. Resolve conflicts or use a different slot.');
				return;
			}
			const { data: commitResult } = await atlasApi.post<DraftPlacementCommitResult>(
				`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/pre-generation-drafts/commit`,
				pending,
			);
			setDraftBoard(commitResult.board);
			setDraftBoardSummary(commitResult.board.counts);
			setPreGenPending(null);
			setSelectedEntry(null);
			setPreGenKbSource(null);
			setKbSelectedSource(null);
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			setPreGenPreviewError(message ?? 'Unable to place this session.');
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
		setPreGenPending,
		setPreGenPreview,
		setPreGenPreviewError,
		setPreGenAllowSoftOverride,
		setPreGenPreviewLoading,
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
			const strategy = regularSwapStrategy ?? regularSwapPreview?.recommendedStrategy ?? 'DIRECT_SWAP';
			if (regularSwapPreview?.recommendedStrategy === 'BLOCKED') {
				toast.error('No safe swap strategy is available for this occupied slot.');
				return;
			}
			if (strategy === 'AUTO_FIX_MOVE_BLOCKING' && !regularSwapPreview?.autoFixBlockingTarget) {
				toast.error('Blocking-session auto-fix target is unavailable for this slot.');
				return;
			}
			if (strategy === 'AUTO_FIX_MOVE_SOURCE' && !regularSwapPreview?.autoFixSourceTarget) {
				toast.error('Source-session auto-fix target is unavailable for this slot.');
				return;
			}
			const autoFixTarget = strategy === 'AUTO_FIX_MOVE_BLOCKING'
				? regularSwapPreview?.autoFixBlockingTarget
				: strategy === 'AUTO_FIX_MOVE_SOURCE'
					? regularSwapPreview?.autoFixSourceTarget
					: null;
			const { data } = await atlasApi.post<CommitResult>(`${apiBase}/swap`, {
				entryIdA: entryA.entryId,
				entryIdB: entryB.entryId,
				expectedVersion: runVersion,
				strategy,
				autoFixTarget,
			});
			setDraft(data.draft);
			if (schoolYearId && runIdNumeric) {
				const violRes = await atlasApi.get<ViolationReport>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${runIdNumeric}/violations`);
				setViolationReport(violRes.data);
			}
			await fetchEditHistory();
			setRegularSwapPending(null);
			setSelectedEntry(null);
			if (strategy === 'AUTO_FIX_MOVE_SOURCE') toast.success('Source session auto-fixed to the nearest valid slot.');
			else if (strategy === 'AUTO_FIX_MOVE_BLOCKING') toast.success('Swap applied with blocking-session auto-fix relocation.');
			else toast.success('Sessions swapped.');
		} catch (e: unknown) {
			const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Swap failed.';
			toast.error(msg);
		} finally {
			setRegularSwapSaving(false);
		}
	}, [regularSwapPending, apiBase, runVersion, regularSwapPreview, regularSwapStrategy, setRegularSwapSaving, setDraft, schoolYearId, runIdNumeric, setViolationReport, fetchEditHistory, setRegularSwapPending, setSelectedEntry]);

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
		previewEditBatch,
		commitEditBatch,
		previewTeachingLoadRepair,
		commitTeachingLoadRepair,
		revertLastEdit,
		choosePreGenFaculty,
		choosePreGenRoom,
		buildPreGenPendingPlacement,
		openSwapPrompt,
		openRegularSwapPrompt,
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
		regularSwapPreview,
		regularSwapStrategy,
		setRegularSwapStrategy,
	};
}
