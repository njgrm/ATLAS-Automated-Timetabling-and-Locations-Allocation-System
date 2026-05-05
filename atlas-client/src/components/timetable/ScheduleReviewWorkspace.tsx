import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { fetchPublicSettings } from '@/lib/settings';
import {
	getDefaultUnassignedReasonDetail,
	getProgramBadgeLabel,
	matchesEntryKindFilter,
	matchesProgramFilter,
	type EntryKindFilter,
	type ProgramFilter,
} from '@/lib/schedule-review-helpers';
import { formatTime } from '@/lib/utils';
import type {
	Building,
	DraftReport,
	ExternalSection,
	GenerationRun,
	ManualEditProposal,
	ManualEditRecord,
	PreviewResult,
	RoomPreferenceDecisionStatus,
	RoomPreferencePreviewResponse,
	RoomRequestAppeal,
	RoomPreferenceStatus,
	RoomPreferenceSummaryResponse,
	ScheduledEntry,
	SectionSummaryResponse,
	Subject,
	FacultyMirror,
	DraftBoardState,
	DraftPlacement,
	DraftQueueItem,
	UnassignedExplanation,
	UnassignedItem,
	UnassignedReason,
	Violation,
	ViolationReport,
} from '@/types';
import { Button } from '@/ui/button';
import { useTutorial } from '@/components/TutorialOverlay';
import { VIOLATION_EXPLANATIONS } from '@/components/ExplainabilityDrawer';
import { ScheduleReviewWorkspaceBody } from '@/components/timetable/ScheduleReviewWorkspaceBody';
import { ScheduleReviewWorkspaceHeader } from '@/components/timetable/ScheduleReviewWorkspaceHeader';
import { ScheduleReviewWorkspaceOverlays } from '@/components/timetable/ScheduleReviewWorkspaceOverlays';
import { TimetableSkeleton } from '@/components/timetable/TimetableSkeleton';
import {
	buildCenterWorkspaceContext,
	buildDialogContext,
	buildHeaderContext,
	buildLeftRailContext,
	buildOverlaysContext,
	buildRightPanelContext,
} from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import {
	CONFLICT_CODES,
	DAY_SHORT,
	DAYS,
	DEFAULT_SCHOOL_ID,
	ENTRY_KIND_FILTER_OPTIONS,
	GRADE_BADGE,
	GRADE_CARD_BG,
	isDraftPlacementSource,
	PROGRAM_FILTER_OPTIONS,
	TUTORIAL_STEPS,
	type CenterViewMode,
	type DragSource,
	type PendingSwapAction,
	type PreGenDragSource,
	type PreGenPendingPlacement,
	type RoomInfo,
	type SeverityFilter,
	UNASSIGNED_REASON_LABELS,
	VIEW_MODE_LABELS,
	type ViewMode,
	WELLBEING_CODES,
	VIOLATION_LABELS,
} from '@/components/timetable/ScheduleReviewWorkspace.constants';
import { useTimetableData } from '@/hooks/useTimetableData';
import { useTimetableDragDrop } from '@/hooks/useTimetableDragDrop';
import { useTimetableMutations } from '@/hooks/useTimetableMutations';
import { useIsDesktop } from '@/hooks/useTimetableState';
import {
	buildUnassignedKey,
	formatDuration,
	formatTimestamp,
	initials,
	parseDraftPlacementId,
	scopePreviewToCandidate,
	statusColor,
} from '@/lib/timetable-utils';
export default function ScheduleReviewWorkspace() {
	/* -- Data state -- */
	const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
	const [runs, setRuns] = useState<GenerationRun[]>([]);
	const [selectedRunId, setSelectedRunId] = useState<string>('latest');
	const [draft, setDraft] = useState<DraftReport | null>(null);
	const [violationReport, setViolationReport] = useState<ViolationReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	/* -- Reference data lookups -- */
	const [subjectMap, setSubjectMap] = useState<Map<number, Subject>>(new Map());
	const [facultyMap, setFacultyMap] = useState<Map<number, FacultyMirror>>(new Map());
	const [sectionMap, setSectionMap] = useState<Map<number, ExternalSection>>(new Map());
	const [sectionSummary, setSectionSummary] = useState<SectionSummaryResponse | null>(null);

	/* -- Filter / selection state -- */
	const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
	const [violationSearch, setViolationSearch] = useState('');
	const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
	const [selectedEntry, setSelectedEntry] = useState<ScheduledEntry | null>(null);
	const [followUps, setFollowUps] = useState<Set<string>>(new Set());
	const [entityFilter, setEntityFilter] = useState<string>('');
	const [viewMode, setViewMode] = useState<ViewMode>('section');
	const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');
	const [entryKindFilter, setEntryKindFilter] = useState<EntryKindFilter>('all');
	const [leftTab, setLeftTab] = useState<'violations' | 'unassigned' | 'locks' | 'requests'>('violations');
	const [draftBoard, setDraftBoard] = useState<DraftBoardState | null>(null);
	const [draftBoardSummary, setDraftBoardSummary] = useState<DraftBoardState['counts'] | null>(null);
	const [showResetDraftDialog, setShowResetDraftDialog] = useState(false);
	const [showLeavePreGenDialog, setShowLeavePreGenDialog] = useState(false);
	const [pendingCenterSwitch, setPendingCenterSwitch] = useState<(() => void) | null>(null);

	const [requestStatusFilter, setRequestStatusFilter] = useState<'ALL' | RoomPreferenceStatus>('SUBMITTED');
	const [requestDecisionFilter, setRequestDecisionFilter] = useState<'ALL' | RoomPreferenceDecisionStatus>('PENDING');
	const [requestSearch, setRequestSearch] = useState('');
	const [roomRequestSummary, setRoomRequestSummary] = useState<RoomPreferenceSummaryResponse | null>(null);
	const [roomRequestLoading, setRoomRequestLoading] = useState(false);
	const [roomRequestError, setRoomRequestError] = useState<string | null>(null);
	const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
	const [requestPreview, setRequestPreview] = useState<RoomPreferencePreviewResponse | null>(null);
	const [requestPreviewLoading, setRequestPreviewLoading] = useState(false);
	const [requestReviewSaving, setRequestReviewSaving] = useState(false);
	const [requestReviewerNotes, setRequestReviewerNotes] = useState('');
	const [newDraftLoading, setNewDraftLoading] = useState(false);
	const userRole = localStorage.getItem('userRole'); // Get role from session/auth context
	const isPrivilegedUser = userRole != null && ['admin', 'officer', 'SYSTEM_ADMIN'].includes(userRole);
	const isDesktop = useIsDesktop();

	/* -- Generate / Publish workflow state -- */
	const [generating, setGenerating] = useState(false);
	const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
	const [showPublishDialog, setShowPublishDialog] = useState(false);
	const [publishAcknowledged, setPublishAcknowledged] = useState(false);
	const [generationElapsed, setGenerationElapsed] = useState(0);

	// Elapsed-time counter while generating
	useEffect(() => {
		if (!generating) { setGenerationElapsed(0); return; }
		const t0 = Date.now();
		const iv = setInterval(() => setGenerationElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
		return () => clearInterval(iv);
	}, [generating]);

	/* -- Room reference data -- */
	const [roomMap, setRoomMap] = useState<Map<number, RoomInfo>>(new Map());
	const [buildings, setBuildings] = useState<Building[]>([]);
	const [mapBuildingId, setMapBuildingId] = useState<number | null>(null);
	const [mapRoomId, setMapRoomId] = useState<number | null>(null);
	const [requestAppeals, setRequestAppeals] = useState<RoomRequestAppeal[]>([]);
	const [appealsLoading, setAppealsLoading] = useState(false);
	const [appealReason, setAppealReason] = useState('');
	const [appealSubmitting, setAppealSubmitting] = useState(false);

	/* -- Layout state -- */
	const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
	const [isRightCollapsed, setIsRightCollapsed] = useState(true);
	const [centerView, setCenterView] = useState<CenterViewMode>('schedule');
	// Panel refs for imperative collapse/expand
	const leftPanelRef = useRef<ImperativePanelHandle>(null);
	const rightPanelRef = useRef<ImperativePanelHandle>(null);
	// Snapshot of panel state before entering a swap view so we can restore on exit
	const panelSnapshot = useRef<{ left: boolean; right: boolean } | null>(null);
	// Which action the officer triggered from the right panel
	const [pendingAction, setPendingAction] = useState<'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY' | null>(null);

	/* -- Manual edit / DnD state -- */
	const [dragItem, setDragItem] = useState<DragSource>(null);
	const [blockerModalData, setBlockerModalData] = useState<import('@/types').HumanConflict[] | null>(null);
	const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
	const [softConfirmWarnings, setSoftConfirmWarnings] = useState<Violation[]>([]);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [showSoftConfirm, setShowSoftConfirm] = useState(false);
	const [pendingCommitProposal, setPendingCommitProposal] = useState<ManualEditProposal | null>(null);
	const [editHistory, setEditHistory] = useState<ManualEditRecord[]>([]);
	const [showEditHistory, setShowEditHistory] = useState(false);
	const [commitLoading, setCommitLoading] = useState(false);
	const [revertLoading, setRevertLoading] = useState(false);
	/** Keyboard-accessible DnD: selected source for placement */
	const [kbSelectedSource, setKbSelectedSource] = useState<DragSource>(null);
	const [preGenKbSource, setPreGenKbSource] = useState<PreGenDragSource | null>(null);
	const [preGenPending, setPreGenPending] = useState<PreGenPendingPlacement | null>(null);
	const [preGenPreview, setPreGenPreview] = useState<PreviewResult | null>(null);
	const [preGenPreviewLoading, setPreGenPreviewLoading] = useState(false);
	const [preGenSaving, setPreGenSaving] = useState(false);
	const [preGenAllowSoftOverride, setPreGenAllowSoftOverride] = useState(false);
	const [preGenPreviewError, setPreGenPreviewError] = useState<string | null>(null);

	/** Wave 4.5: map-first onboarding banner active state */
	const [preGenOnboarding, setPreGenOnboarding] = useState(false);
	/** Wave 4.5c Pass 3 F: tracks whether map/building was entered from pre-gen context */
	const [preGenMapContext, setPreGenMapContext] = useState(false);

	/** Wave 4.5: mandatory faculty + room confirm sheet */
	const [showPreGenConfirm, setShowPreGenConfirm] = useState(false);
	const [preGenConfirmCtx, setPreGenConfirmCtx] = useState<{
		source: PreGenDragSource;
		day: string;
		startTime: string;
		endTime: string;
	} | null>(null);
	const [confirmFacultyId, setConfirmFacultyId] = useState<string>('');
	const [confirmRoomId, setConfirmRoomId] = useState<string>('');
	const [confirmPreviewLoading, setConfirmPreviewLoading] = useState(false);
	const [confirmPreview, setConfirmPreview] = useState<PreviewResult | null>(null);
	const [confirmRawPreview, setConfirmRawPreview] = useState<PreviewResult | null>(null);
	const [confirmPreviewError, setConfirmPreviewError] = useState<string | null>(null);
	const [confirmAllowSoftOverride, setConfirmAllowSoftOverride] = useState(false);
	const [confirmAllowDailyOverride, setConfirmAllowDailyOverride] = useState(false);
	const [confirmSaving, setConfirmSaving] = useState(false);
	const [showSwapConfirm, setShowSwapConfirm] = useState(false);
	const [swapAction, setSwapAction] = useState<PendingSwapAction | null>(null);
	const [swapSaving, setSwapSaving] = useState(false);
	const [regularSwapPending, setRegularSwapPending] = useState<{ entryA: ScheduledEntry; entryB: ScheduledEntry } | null>(null);
	const [regularSwapSaving, setRegularSwapSaving] = useState(false);
	/** Wave 4.5c C: ID of a placement being deleted (unassign) */
	const [deletingPlacementId, setDeletingPlacementId] = useState<number | null>(null);
	/** Wave 4.5c Pass 3 E: Unassign confirmation dialog state */
	const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
	const [pendingUnassignId, setPendingUnassignId] = useState<number | null>(null);
	const [unassignDropActive, setUnassignDropActive] = useState(false);

	/** Wave 4.5: Pins panel search + grade filter */
	const [pinsSearch, setPinsSearch] = useState('');
	const [pinsGradeFilter, setPinsGradeFilter] = useState<number | 'all'>('all');
	/** Wave 4.5b: additional Pins panel filters */
	const [pinsSubjectFilter, setPinsSubjectFilter] = useState<number | 'all'>('all');
	const [pinsSectionFilter, setPinsSectionFilter] = useState<number | 'all'>('all');
	const [pinsQueuePage, setPinsQueuePage] = useState(30);
	const [violationsGroupPage, setViolationsGroupPage] = useState(10);
	/** Ref for auto-preview debounce in PreGenConfirmSheet */
	const autoPreviewRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	/** Assignment picker modal for unassigned placements */
	const [showAssignmentPicker, setShowAssignmentPicker] = useState(false);
	const [assignPickerTarget, setAssignPickerTarget] = useState<{ day: string; startTime: string; endTime: string; item: UnassignedItem } | null>(null);
	const [assignPickerFacultyId, setAssignPickerFacultyId] = useState<string>('');
	const [assignPickerRoomId, setAssignPickerRoomId] = useState<string>('');

	/* -- Tutorial + Explainability -- */
	const tutorial = useTutorial('atlas_timetable_tour');
	const [drawerViolation, setDrawerViolation] = useState<Violation | null>(null);
	const [drawerUnassigned, setDrawerUnassigned] = useState<UnassignedItem | null>(null);
	const showExplainDrawer = !!drawerViolation || !!drawerUnassigned;
	const [fixLoading, setFixLoading] = useState<string | null>(null);

	/* -- Unassigned triage state -- */
	const [expandedUnassigned, setExpandedUnassigned] = useState<Set<string>>(new Set());
	const [unassignedFixSuggestions, setUnassignedFixSuggestions] = useState<Record<string, UnassignedExplanation | null>>({});
	const [unassignedReasonFilter, setUnassignedReasonFilter] = useState<UnassignedReason | 'all'>('all');

	useEffect(() => {
		rightPanelRef.current?.collapse();
	}, []);

	const enterPolicyView = useCallback(() => {
		panelSnapshot.current = { left: isLeftCollapsed, right: isRightCollapsed };
		leftPanelRef.current?.collapse();
		rightPanelRef.current?.collapse();
		setCenterView('policy');
	}, [isLeftCollapsed, isRightCollapsed]);

	const exitPolicyView = useCallback(() => {
		if (panelSnapshot.current) {
			if (!panelSnapshot.current.left) leftPanelRef.current?.expand();
			if (!panelSnapshot.current.right) rightPanelRef.current?.expand();
			panelSnapshot.current = null;
		}
		setCenterView('schedule');
	}, []);

	const enterManualEditView = useCallback((action: 'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY') => {
		panelSnapshot.current = { left: isLeftCollapsed, right: isRightCollapsed };
		leftPanelRef.current?.collapse();
		rightPanelRef.current?.collapse();
		setPendingAction(action);
		setCenterView('manual-edit');
	}, [isLeftCollapsed, isRightCollapsed]);

	const exitManualEditView = useCallback(() => {
		if (panelSnapshot.current) {
			if (!panelSnapshot.current.left) leftPanelRef.current?.expand();
			if (!panelSnapshot.current.right) rightPanelRef.current?.expand();
			panelSnapshot.current = null;
		}
		setPendingAction(null);
		setCenterView('schedule');
	}, []);

	const switchCenterViewWithGuard = useCallback((action: () => void) => {
		const hasUnsavedPreGen = centerView === 'pre-generation' && (preGenPending != null || (draftBoard?.counts.draft ?? 0) > 0);
		if (hasUnsavedPreGen) {
			setPendingCenterSwitch(() => action);
			setShowLeavePreGenDialog(true);
			return;
		}
		action();
	}, [centerView, draftBoard?.counts.draft, preGenPending]);


	const {
		violations,
		violationIndex,
		highlightedEntryIds,
		filteredViolations,
		violationsByCode,
		hardViolationCount,
		topBlockers,
		preGenEntries,
		isPreGenerationWorkspace,
		activeGridEntriesBase,
		timeSlots,
		cellConflictMap,
		filteredDraftEntries,
		programKindFilteredUnassignedItems,
		filteredUnassignedItems,
		sectionIds,
		pivotEntityIds,
		gridEntries,
		gridIndex,
		pivotKeyOf,
		summary,
		navToFaculty,
		navToSection,
		navToRoom,
		activeGeneratedRunId,
		fetchSchoolYear,
		fetchRuns,
		fetchRunData,
		fetchDraftBoardSummary,
		loadRoomRequestSummary,
		fetchReferenceData,
		openMapWorkspace,
		openBuildingWorkspace,
		openRoomGridWorkspace,
		loadAll,
		handleRefresh,
		subjectLabel,
		facultyLabel,
		formatFacultyInitials,
		sectionLabel,
		roomLabel,
		roomLabelShort,
		isStaleRoom,
		pivotLabel,
	} = useTimetableData({
		schoolYearId,
		setSchoolYearId,
		runs,
		setRuns,
		selectedRunId,
		setSelectedRunId,
		draft,
		setDraft,
		violationReport,
		setViolationReport,
		setLoading,
		setError,
		severityFilter,
		setSeverityFilter,
		violationSearch,
		selectedViolation,
		setSelectedViolation,
		selectedEntry,
		setSelectedEntry,
		setFollowUps,
		entityFilter,
		setEntityFilter,
		viewMode,
		setViewMode,
		programFilter,
		entryKindFilter,
		leftTab,
		setLeftTab,
		unassignedReasonFilter,
		draftBoard,
		setDraftBoard,
		setDraftBoardSummary,
		requestStatusFilter,
		requestDecisionFilter,
		setRoomRequestSummary,
		setRoomRequestLoading,
		setRoomRequestError,
		setSubjectMap,
		setFacultyMap,
		setSectionMap,
		setSectionSummary,
		setRoomMap,
		setBuildings,
		isLeftCollapsed,
		leftPanelRef,
		centerView,
		preGenOnboarding,
		preGenMapContext,
		setPreGenMapContext,
		setCenterView,
		setMapBuildingId,
		setMapRoomId,
		switchCenterViewWithGuard,
		facultyMap,
		sectionMap,
		roomMap,
		subjectMap,
		dragItem,
		preGenKbSource,
		kbSelectedSource,
		setPreGenKbSource,
		setKbSelectedSource,
	});

	const {
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
	} = useTimetableMutations({
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
		setDraft,
		setPreviewLoading,
		setPreviewResult,
		setCommitLoading,
		setSoftConfirmWarnings,
		setShowSoftConfirm,
		setPendingCommitProposal,
		setDragItem,
		setRevertLoading,
		setViolationReport,
		viewMode,
		entityFilter,
		facultyMap,
		roomMap,
	});

	const handleRunChange = useCallback(async (runId: string) => {
		setSelectedRunId(runId);
		setSelectedViolation(null);
		setSelectedEntry(null);
		setEditHistory([]);
		if (!schoolYearId) return;
		setLoading(true);
		try {
			await fetchRunData(schoolYearId, runId);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to load run.';
			toast.error(msg);
		} finally {
			setLoading(false);
		}
	}, [schoolYearId, fetchRunData]);

	/** Handle drop of item onto a timetable cell */
	const handleCellDrop = useCallback(
		async (day: string, startTime: string, endTime: string) => {
			if (!dragItem) return;
			if (dragItem.type === 'draftQueue' || dragItem.type === 'draftPlacement') {
				await stagePreGenDrop(dragItem, day, startTime, endTime);
				setDragItem(null);
				return;
			}

			if (dragItem.type === 'unassigned') {
				// Show assignment picker modal instead of auto-selecting
				setAssignPickerTarget({ day, startTime, endTime, item: dragItem.item });
				// Pre-select from current view context if possible
				const firstEntity = Number(entityFilter);
				if (viewMode === 'faculty') {
					setAssignPickerFacultyId(String(firstEntity));
					setAssignPickerRoomId('');
				} else if (viewMode === 'room') {
					setAssignPickerRoomId(String(firstEntity));
					setAssignPickerFacultyId('');
				} else {
					setAssignPickerFacultyId('');
					setAssignPickerRoomId('');
				}
				setShowAssignmentPicker(true);
				return;
			}
			if (dragItem.type === 'entry' && centerView === 'pre-generation') {
				const placementId = parseDraftPlacementId(dragItem.entry.entryId);
				if (placementId != null) {
					const placement = draftBoard?.placements.find((candidate) => candidate.id === placementId);
					if (placement) {
						await stagePreGenDrop({ type: 'draftPlacement', placement }, day, startTime, endTime, { suppressConfirm: true });
						setDragItem(null);
						return;
					}
				}
			}
			const entry = dragItem.entry;
			// Detect if target slot is occupied � scope to same pivot entity for current viewMode
			const targetKey = `${day}-${startTime}`;
			const pivotId = viewMode === 'section' ? entry.sectionId : viewMode === 'faculty' ? entry.facultyId : entry.roomId;
			const cellOccupants = (gridIndex.get(targetKey) ?? []).filter((occ) => {
				if (occ.entryId === entry.entryId) return false;
				if (viewMode === 'section') return occ.sectionId === pivotId;
				if (viewMode === 'faculty') return occ.facultyId === pivotId;
				return occ.roomId === pivotId;
			});
			if (cellOccupants.length > 0) {
				setRegularSwapPending({ entryA: entry, entryB: cellOccupants[0] });
				setDragItem(null);
				return;
			}
			const proposal: ManualEditProposal = {
				editType: 'MOVE_ENTRY',
				entryId: entry.entryId,
				targetDay: day,
				targetStartTime: startTime,
				targetEndTime: endTime,
			};

			// Preview first
			const preview = await previewEdit(proposal);
			if (!preview) return;
			const scopedPreview = scopePreviewToCandidate(preview, { day, startTime, endTime });

			if (!scopedPreview.allowed) {
				setBlockerModalData(scopedPreview.humanConflicts.filter((hc) => hc.severity === 'HARD'));
				setDragItem(null);
				return;
			}

			// Soft violations are informational only � proceed without blocking
			await commitEdit(proposal, scopedPreview.softViolations.length > 0);
		},
		[dragItem, entityFilter, viewMode, previewEdit, commitEdit, stagePreGenDrop, centerView, draftBoard?.placements, gridIndex],
	);

	/** Keyboard-accessible placement confirm */
	const handleKbPlace = useCallback(
		async (day: string, startTime: string, endTime: string) => {
			if (!kbSelectedSource) return;
			const fakeItem = kbSelectedSource;
			setKbSelectedSource(null);

			if (fakeItem.type === 'draftQueue' || fakeItem.type === 'draftPlacement') {
				setPreGenKbSource(null);
				await stagePreGenDrop(fakeItem, day, startTime, endTime);
				return;
			}

			// Fix 1: draft placement entry KB-placed in pre-gen mode ? route to pre-gen commit path
			if (fakeItem.type === 'entry' && centerView === 'pre-generation' && fakeItem.entry.entryId.startsWith('draft-placement-')) {
				const pid = Number(fakeItem.entry.entryId.replace('draft-placement-', ''));
				const placement = draftBoard?.placements.find((p) => p.id === pid);
				if (placement) {
					setPreGenKbSource(null);
					await stagePreGenDrop({ type: 'draftPlacement', placement }, day, startTime, endTime, { suppressConfirm: true });
					return;
				}
			}

			if (fakeItem.type === 'unassigned') {
				// Route to assignment picker
				setAssignPickerTarget({ day, startTime, endTime, item: fakeItem.item });
				const firstEntity = Number(entityFilter);
				if (viewMode === 'faculty') {
					setAssignPickerFacultyId(String(firstEntity));
					setAssignPickerRoomId('');
				} else if (viewMode === 'room') {
					setAssignPickerRoomId(String(firstEntity));
					setAssignPickerFacultyId('');
				} else {
					setAssignPickerFacultyId('');
					setAssignPickerRoomId('');
				}
				setShowAssignmentPicker(true);
				return;
			}

			// Detect occupied slot ? scope to same pivot entity for current viewMode
			if (fakeItem.type === 'entry') {
				const targetKey = `${day}-${startTime}`;
				const kbPivotId = viewMode === 'section' ? fakeItem.entry.sectionId : viewMode === 'faculty' ? fakeItem.entry.facultyId : fakeItem.entry.roomId;
				const kbOccupants = (gridIndex.get(targetKey) ?? []).filter((occ) => {
					if (occ.entryId === fakeItem.entry.entryId) return false;
					if (viewMode === 'section') return occ.sectionId === kbPivotId;
					if (viewMode === 'faculty') return occ.facultyId === kbPivotId;
					return occ.roomId === kbPivotId;
				});
				if (kbOccupants.length > 0) {
					setRegularSwapPending({ entryA: fakeItem.entry, entryB: kbOccupants[0] });
					return;
				}
			}

			const proposal: ManualEditProposal = {
				editType: 'MOVE_ENTRY',
				entryId: fakeItem.entry.entryId,
				targetDay: day,
				targetStartTime: startTime,
				targetEndTime: endTime,
			};

			setDragItem(fakeItem);
			const preview = await previewEdit(proposal);
			if (!preview) { setDragItem(null); return; }
			const scopedPreview = scopePreviewToCandidate(preview, { day, startTime, endTime });
			if (!scopedPreview.allowed) {
				setBlockerModalData(scopedPreview.humanConflicts.filter((hc) => hc.severity === 'HARD'));
				setDragItem(null);
				return;
			}
			// Soft violations are informational only � proceed without blocking
			await commitEdit(proposal, scopedPreview.softViolations.length > 0);
		},
		[kbSelectedSource, entityFilter, viewMode, previewEdit, commitEdit, stagePreGenDrop, centerView, draftBoard?.placements, gridIndex],
	);

	/** Confirm assignment picker and submit the unassigned placement */
	const confirmAssignmentPicker = useCallback(async () => {
		if (!assignPickerTarget) return;
		const { day, startTime, endTime, item } = assignPickerTarget;
		const targetFacultyId = Number(assignPickerFacultyId);
		const targetRoomId = Number(assignPickerRoomId);
		if (!targetFacultyId || !targetRoomId) {
			toast.error('Please select both a faculty member and a room.');
			return;
		}
		setShowAssignmentPicker(false);

		const proposal: ManualEditProposal = {
			editType: 'PLACE_UNASSIGNED',
			sectionId: item.sectionId,
			subjectId: item.subjectId,
			session: item.session,
			targetDay: day,
			targetStartTime: startTime,
			targetEndTime: endTime,
			targetFacultyId,
			targetRoomId,
		};

		const preview = await previewEdit(proposal);
		if (!preview) { setDragItem(null); return; }
		const scopedPreview = scopePreviewToCandidate(preview, { day, startTime, endTime });
		if (!scopedPreview.allowed) {
			setBlockerModalData(scopedPreview.humanConflicts.filter((hc) => hc.severity === 'HARD'));
			setDragItem(null);
			return;
		}
		// Soft violations are informational only � proceed without blocking
		await commitEdit(proposal, scopedPreview.softViolations.length > 0);
	}, [assignPickerTarget, assignPickerFacultyId, assignPickerRoomId, previewEdit, commitEdit]);

	/** Load edit history on mount / run change */
	useEffect(() => {
		fetchEditHistory();
	}, [fetchEditHistory]);

	/* -- Lookup helpers -- */


	const resolveEntryProgramType = useCallback(
		(entry: ScheduledEntry | UnassignedItem): string | null => {
			return entry.programType ?? sectionMap.get(entry.sectionId)?.programType ?? null;
		},
		[sectionMap],
	);

	const resolveEntryProgramCode = useCallback(
		(entry: ScheduledEntry | UnassignedItem): string | null => {
			return entry.programCode ?? sectionMap.get(entry.sectionId)?.programCode ?? null;
		},
		[sectionMap],
	);

	const entryContextLabel = useCallback(
		(entry: ScheduledEntry | UnassignedItem): string => {
			if (entry.entryKind === 'COHORT' && entry.cohortCode) {
				const memberCount = entry.cohortMemberSectionIds?.length ?? 0;
				return `${entry.cohortCode}${memberCount > 0 ? ` � ${memberCount} section${memberCount === 1 ? '' : 's'}` : ''}`;
			}
			const adviser = entry.adviserName ?? sectionMap.get(entry.sectionId)?.adviserName;
			return adviser ? `${sectionLabel(entry.sectionId)} � Adviser ${adviser}` : sectionLabel(entry.sectionId);
		},
		[sectionLabel, sectionMap],
	);

	/** Human-readable room label and compact variants are provided by useTimetableData. */

	const formatConstraintMessage = useCallback(
		(message: string): string => {
			const roomFormatted = message.replace(/\broom\s+#?(\d+)\b/gi, (_match, rawId: string) => {
				const id = Number(rawId);
				if (!Number.isFinite(id)) return _match;
				const room = roomMap.get(id);
				return room ? roomLabelShort(id) : _match;
			});

			const facultyFormatted = roomFormatted.replace(/\bfaculty\s+#?(\d+)\b/gi, (_match, rawId: string) => {
				const id = Number(rawId);
				if (!Number.isFinite(id)) return _match;
				const faculty = facultyMap.get(id);
				return faculty ? `${faculty.lastName}, ${faculty.firstName}` : _match;
			});

			return facultyFormatted.replace(/\bsection\s+#?(\d+)\b/gi, (_match, rawId: string) => {
				const id = Number(rawId);
				if (!Number.isFinite(id)) return _match;
				const section = sectionMap.get(id);
				return section ? section.name : _match;
			});
		},
		[facultyMap, roomLabelShort, roomMap, sectionMap],
	);

	/** isStaleRoom and pivotLabel are provided by useTimetableData. */

	const gradeForSection = useCallback(
		(sectionId: number): number | null => {
			// Prefer grade from section adapter data
			const sec = sectionMap.get(sectionId);
			if (sec) {
				// displayOrder is the grade level (7, 8, 9, 10)
				const match = sec.gradeLevelName.match(/(\d+)/);
				if (match) return Number(match[1]);
			}
			// Fallback: infer grade from the entry's subject
			const entry = draft?.entries.find((e) => e.sectionId === sectionId);
			if (!entry) return null;
			const subj = subjectMap.get(entry.subjectId);
			return subj?.gradeLevels?.[0] ?? null;
		},
		[sectionMap, draft, subjectMap],
	);

	/** Hierarchical grouping for entity filter dropdown: Building?Room, Grade?Section, Department?Faculty */
	const groupedPivotEntities = useMemo(() => {
		const groups: { label: string; ids: number[] }[] = [];
		if (viewMode === 'room') {
			// Group rooms by building
			const byBuilding = new Map<string, number[]>();
			for (const id of pivotEntityIds) {
				const room = roomMap.get(id);
				const bldg = room ? (room.buildingShortCode || room.buildingName) : 'Unknown';
				const list = byBuilding.get(bldg) ?? [];
				list.push(id);
				byBuilding.set(bldg, list);
			}
			for (const [bldg, ids] of Array.from(byBuilding.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
				groups.push({ label: bldg, ids });
			}
		} else if (viewMode === 'section') {
			// Group sections by grade level and program bucket
			const byGrade = new Map<string, number[]>();
			for (const id of pivotEntityIds) {
				const grade = gradeForSection(id);
				const section = sectionMap.get(id);
				const programLabel = section?.programType && section.programType !== 'REGULAR'
					? getProgramBadgeLabel(section.programType, section.programCode)
					: 'Regular';
				const key = grade ? `G${grade} � ${programLabel}` : programLabel;
				const list = byGrade.get(key) ?? [];
				list.push(id);
				byGrade.set(key, list);
			}
			for (const [grade, ids] of Array.from(byGrade.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
				groups.push({ label: grade, ids });
			}
		} else {
			// Faculty � group by department if available, else flat
			const byDept = new Map<string, number[]>();
			for (const id of pivotEntityIds) {
				const f = facultyMap.get(id);
				const dept = f?.department || 'Unassigned';
				const list = byDept.get(dept) ?? [];
				list.push(id);
				byDept.set(dept, list);
			}
			for (const [dept, ids] of Array.from(byDept.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
				groups.push({ label: dept, ids });
			}
		}
		return groups;
	}, [viewMode, pivotEntityIds, roomMap, gradeForSection, facultyMap, sectionMap]);

	const confirmDisplacedPlacement = useMemo(() => {
		if (!preGenConfirmCtx) return null;
		const source = preGenConfirmCtx.source;
		const atTarget = (draftBoard?.placements ?? []).filter((placement) =>
			placement.status === 'DRAFT'
			&& placement.day === preGenConfirmCtx.day
			&& placement.startTime === preGenConfirmCtx.startTime
			&& placement.endTime === preGenConfirmCtx.endTime,
		);
		if (isDraftPlacementSource(source)) {
			return atTarget.find((placement) => placement.id !== source.placement.id) ?? null;
		}
		return atTarget[0] ?? null;
	}, [draftBoard?.placements, preGenConfirmCtx]);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
	const { dropTarget, setDropTarget } = useTimetableDragDrop();

	const handleGlobalDragStart = useCallback((event: DragStartEvent) => {
		const data = event.active.data.current as
			| { type?: string; entry?: ScheduledEntry; item?: UnassignedItem | DraftQueueItem; placement?: DraftPlacement }
			| undefined;
		if (!data?.type) return;

		if (data.type === 'entry' && data.entry) {
			setDragItem({ type: 'entry', entry: data.entry });
			return;
		}
		if (data.type === 'unassigned' && data.item) {
			setDragItem({ type: 'unassigned', item: data.item as UnassignedItem });
			return;
		}
		if (data.type === 'draftQueue' && data.item) {
			setDragItem({ type: 'draftQueue', item: data.item as DraftQueueItem });
			return;
		}
		if (data.type === 'draftPlacement' && data.placement) {
			setDragItem({ type: 'draftPlacement', placement: data.placement });
		}
	}, []);

	const handleGlobalDragOver = useCallback((event: DragOverEvent) => {
		const key = event.over?.id ? String(event.over.id) : null;
		setDropTarget(key);
	}, [setDropTarget]);

	const handleGlobalDragEnd = useCallback((event: DragEndEvent) => {
		const overData = event.over?.data.current as { day?: string; startTime?: string; endTime?: string } | undefined;
		setUnassignDropActive(false);
		setDropTarget(null);

		if (overData?.day && overData.startTime && overData.endTime) {
			handleCellDrop(overData.day, overData.startTime, overData.endTime);
		}
		setDragItem(null);
	}, [handleCellDrop, setDropTarget]);

	/* -- Render -- */

	if (loading && !draft) {
		return <TimetableSkeleton />;
	}

	if (error) {
		return (
			<div className="flex flex-col h-[calc(100svh-3.5rem)] items-center justify-center gap-4">
				<div className="flex items-center gap-2 text-destructive"><AlertCircle className="size-5" /><span className="text-sm font-medium">{error}</span></div>
				<Button variant="outline" size="sm" onClick={() => loadAll()}><RefreshCw className="size-3.5 mr-1.5" />Retry</Button>
			</div>
		);
	}

	const hardCount = violations.filter((v) => v.severity === 'HARD').length;
	const softCount = violations.filter((v) => v.severity === 'SOFT').length;
	const selectedMapBuilding = buildings.find((b) => b.id === mapBuildingId) ?? null;
	const selectedMapBuildingFloors = selectedMapBuilding ? Array.from({ length: selectedMapBuilding.floorCount }, (_, i) => selectedMapBuilding.floorCount - i) : [];
	const contractWarnings = Array.from(new Set([...(summary?.contractWarnings ?? []), ...(sectionSummary?.contractWarnings ?? [])]));
	const { leftRailContentContext, centerWorkspaceContext, rightPanelContext, headerContext, overlaysContext } = (() => {
		const leftRailContentContext = buildLeftRailContext({ leftTab, isPreGenerationWorkspace, hardViolationCount, topBlockers, violations, handleViolationSelect, setSeverityFilter, VIOLATION_LABELS, violationSearch, setViolationSearch, filteredViolations, violationsByCode, selectedViolation, setDrawerViolation, formatConstraintMessage, draftBoard, isDesktop, setDragItem, toast, summary, filteredUnassignedItems, programKindFilteredUnassignedItems, unassignedReasonFilter, setUnassignedReasonFilter, resolveEntryProgramType, resolveEntryProgramCode, sectionLabel, subjectLabel, kbSelectedSource, followUps, expandedUnassigned, setExpandedUnassigned, unassignedFixSuggestions, fixLoading, schoolYearId, runs, selectedRunId, setFixLoading, setUnassignedFixSuggestions, entryContextLabel, previewEdit, setDrawerUnassigned, setFollowUps, showSoftConfirm, unassignDropActive, setUnassignDropActive, fetchDraftBoardSummary, preGenPending, pinsSearch, setPinsSearch, pinsGradeFilter, setPinsGradeFilter, pinsSectionFilter, setPinsSectionFilter, pinsSubjectFilter, setPinsSubjectFilter, getDraggedDraftPlacementId, dragItem, setPendingUnassignId, setShowUnassignConfirm, pinsQueuePage, setPinsQueuePage, preGenKbSource, setPreGenKbSource, setKbSelectedSource, rightPanelRef, selectedEntry, setSelectedEntry, setSelectedViolation, preGenEntries, gradeForSection, formatFacultyInitials, roomLabelShort, roomRequestSummary, requestSearch, setRequestSearch, requestStatusFilter, setRequestStatusFilter, requestDecisionFilter, setRequestDecisionFilter, roomRequestError, roomRequestLoading, filteredRoomRequests, selectedRequestId, focusRequestInGrid, openRequestPreview, isPrivilegedUser });
		const centerWorkspaceContext = buildCenterWorkspaceContext({ centerView, selectedEntry, violationIndex, followUps, toggleFollowUp, exitPolicyView, handleRefresh, schoolYearId, pendingAction, roomMap, facultyMap, draft, previewEdit, commitEdit, previewLoading, commitLoading, subjectLabel, facultyLabel, sectionLabel, gradeForSection, roomLabel, isStaleRoom, timeSlots, preGenOnboarding, setCenterView, buildings, mapBuildingId, setMapBuildingId, openBuildingWorkspace, selectedMapBuilding, selectedMapBuildingFloors, mapRoomId, openRoomGridWorkspace, draftBoard, runs, entityFilter, pivotLabel, viewMode, setPreGenOnboarding, gridEntries, highlightedEntryIds, handleEntryClick, entryContextLabel, formatFacultyInitials, roomLabelShort, dragItem, kbSelectedSource, handleKbPlace, cellConflictMap, navToFaculty, navToSection, navToRoom, dropTarget, setDropTarget, preGenPending, preGenPreviewLoading, preGenPreviewError, preGenPreview, commitPreGenPending, preGenSaving, setPreGenPending, setPreGenPreview, setPreGenPreviewError, setPreGenAllowSoftOverride });
		const rightPanelContext = buildRightPanelContext({ rightPanelRef, setIsRightCollapsed, isRightCollapsed, isPreGenerationWorkspace, preGenKbSource, selectedEntry, setPreGenKbSource, setKbSelectedSource, initials, facultyMap, formatFacultyInitials, isDesktop, subjectLabel, toggleFollowUp, followUps, setSelectedEntry, gradeForSection, violationIndex, sectionLabel, facultyLabel, roomLabel, roomRequestSummary, previewResult, formatConstraintMessage, violationLabels: VIOLATION_LABELS, violationExplanations: VIOLATION_EXPLANATIONS, setSelectedViolation, toast, draftBoard, parseDraftPlacementId, deletingPlacementId, setPendingUnassignId, setShowUnassignConfirm, enterManualEditView });
		const headerContext = buildHeaderContext({ isPreGenerationWorkspace, activeGeneratedRunId, selectedRunId, handleRunChange, runs, centerView, newDraftLoading, schoolYearId, handleStartNewPreGenerationDraft, draftBoard, openPreGenerationWorkspace, generating, loading, handleTriggerGenerate, draft, hardCount, setPublishAcknowledged, setShowPublishDialog, exitPolicyView, switchCenterViewWithGuard, enterPolicyView, openMapWorkspace, handleRefresh, revertLoading, editHistory, revertLastEdit, setShowEditHistory, tutorial, summary, statusColor, formatDuration, formatTimestamp, contractWarnings, viewMode, setViewMode, setEntityFilter, setSelectedEntry, setSelectedViolation, setPreGenKbSource, setKbSelectedSource, entityFilter, groupedPivotEntities, pivotLabel, programFilter, setProgramFilter, entryKindFilter, setEntryKindFilter, violations, severityFilter, setSeverityFilter, softCount });
		const dialogContext = buildDialogContext({ showUnassignConfirm, setShowUnassignConfirm, setPendingUnassignId, pendingUnassignId, unassignDraftPlacement, showGenerateConfirm, setShowGenerateConfirm, draftBoardSummary, followUps, confirmGenerate, showResetDraftDialog, setShowResetDraftDialog, openPreGenerationWorkspace, showLeavePreGenDialog, setShowLeavePreGenDialog, pendingCenterSwitch, setPendingCenterSwitch, requestPreview, requestPreviewLoading, setRequestPreview, setSelectedRequestId, setRequestAppeals, setAppealReason, requestPreviewHardConflicts, requestPreviewSoftWarnings, requestAppeals, appealsLoading, isPrivilegedUser, updateAppealStatus, appealReason, appealSubmitting, submitAppeal, requestReviewerNotes, setRequestReviewerNotes, requestReviewSaving, reviewRoomRequest, generating, generationElapsed, showPublishDialog, setShowPublishDialog, softCount, handlePublishConfirm, showPreGenConfirm, setShowPreGenConfirm, setPreGenConfirmCtx, setConfirmPreview, setConfirmRawPreview, setConfirmPreviewError, setConfirmAllowSoftOverride, setConfirmAllowDailyOverride, preGenConfirmCtx, confirmFacultyId, setConfirmFacultyId, confirmPreview, confirmRoomId, setConfirmRoomId, facultyMap, roomMap, confirmPreviewLoading, confirmPreviewError, confirmDisplacedPlacement, toast, openSwapPrompt, confirmAllowDailyOverride, confirmSaving, commitConfirmPlacement, showSwapConfirm, setShowSwapConfirm, setSwapAction, swapAction, formatFacultyInitials, roomLabelShort, subjectLabel, sectionLabel, swapSaving, executeSwapAction, regularSwapPending, setRegularSwapPending, regularSwapSaving, executeRegularSwap, showSoftConfirm, setShowSoftConfirm, softConfirmWarnings, commitLoading, formatConstraintMessage, setPendingCommitProposal, setPreviewResult, setSoftConfirmWarnings, setDragItem, pendingCommitProposal, commitEdit, showAssignmentPicker, setShowAssignmentPicker, setAssignPickerTarget, assignPickerTarget, assignPickerFacultyId, setAssignPickerFacultyId, assignPickerRoomId, setAssignPickerRoomId, confirmAssignmentPicker, showEditHistory, setShowEditHistory, editHistory });
		const overlaysContext = buildOverlaysContext({ dialogContext, tutorial, blockerModalData, setBlockerModalData, showExplainDrawer, setDrawerViolation, setDrawerUnassigned, drawerViolation, drawerUnassigned });
		return { leftRailContentContext, centerWorkspaceContext, rightPanelContext, headerContext, overlaysContext };
	})();

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)]">
			<DndContext sensors={sensors} onDragStart={handleGlobalDragStart} onDragOver={handleGlobalDragOver} onDragEnd={handleGlobalDragEnd}>
				<ScheduleReviewWorkspaceHeader context={headerContext} />
				<ScheduleReviewWorkspaceBody context={{ leftPanelRef, setIsLeftCollapsed, isLeftCollapsed, isPreGenerationWorkspace, leftTab, setLeftTab, violations, summary, roomRequestSummary, leftRailContentContext, centerWorkspaceContext, rightPanelContext }} />
			</DndContext>
			<ScheduleReviewWorkspaceOverlays context={overlaysContext} />
		</div>
	);
}
