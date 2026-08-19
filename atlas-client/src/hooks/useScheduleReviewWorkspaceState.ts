import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { toast } from 'sonner';
import {
	findGradeWindow,
	getDefaultUnassignedReasonDetail,
	matchesEntryKindFilter,
	matchesProgramFilter,
	resolveSectionGradeNumber,
	type EntryKindFilter,
	type ProgramFilter,
} from '@/lib/schedule-review-helpers';
import { formatTime } from '@/lib/utils';
import atlasApi from '@/lib/api';
import type {
	Building,
	DraftBoardState,
	ExternalSection,
	FacultyMirror,
	GenerationRun,
	ManualEditProposal,
	ManualEditRecord,
	PreviewResult,
	RoomPreferenceDecisionStatus,
	RoomPreferencePreviewResponse,
	RoomPreferenceStatus,
	RoomPreferenceSummaryResponse,
	RoomRequestAppeal,
	ScheduledEntry,
	SectionSummaryResponse,
	Subject,
	UnassignedExplanation,
	UnassignedItem,
	UnassignedReason,
	Violation,
	ViolationReport,
} from '@/types';
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
	DAYS,
	DAY_SHORT,
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
	type SeverityFilter,
	UNASSIGNED_REASON_LABELS,
	VIEW_MODE_LABELS,
	type ViewMode,
	WELLBEING_CODES,
	VIOLATION_LABELS,
	type RoomInfo,
} from '@/components/timetable/ScheduleReviewWorkspace.constants';
import { useTimetableData } from '@/hooks/useTimetableData';
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
import { findRegularSwapCandidate, resolveDraftPlacementFromEntry } from '@/lib/timetable-swap-routing';
import { VIOLATION_EXPLANATIONS } from '@/components/ExplainabilityDrawer';
import { useTutorial } from '@/components/TutorialOverlay';
import { useTimetableCollaboration } from '@/hooks/useTimetableCollaboration';
import { useTimetableLookupHelpers } from '@/hooks/useTimetableLookupHelpers';
import { useTimetableDragDrop } from '@/hooks/useTimetableDragDrop';
import { useTimetableViewNavigation } from '@/hooks/useTimetableViewNavigation';

function escapeCssAttributeValue(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function timetableCellFocusSelector(day: string, startTime: string, endTime: string): string {
	return `td[data-day="${escapeCssAttributeValue(day)}"][data-start-time="${escapeCssAttributeValue(startTime)}"][data-end-time="${escapeCssAttributeValue(endTime)}"]`;
}

function timetableEntryFocusSelector(entryId: string): string {
	return `[data-timetable-entry-id="${escapeCssAttributeValue(entryId)}"]`;
}

function isFocusableElement(element: HTMLElement): boolean {
	return element.matches('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="menuitem"]');
}

export function useScheduleReviewWorkspaceState() {
	/* -- Data state -- */
	const [tacticalSandboxOpen, setTacticalSandboxOpen] = useState(false);
	const [schoolYearId, setSchoolYearId] = useState<number | null>(null);


	const [runs, setRuns] = useState<GenerationRun[]>([]);
	const [selectedRunId, setSelectedRunId] = useState<string>('latest');
	const [draft, setDraft] = useState<any | null>(null);
	const [violationReport, setViolationReport] = useState<ViolationReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [policy, setPolicy] = useState<{ teacherMoveEnabled: boolean; earliestStartTime?: string; latestEndTime?: string } | null>({ teacherMoveEnabled: true });
	const [gradeWindows, setGradeWindows] = useState<Array<{ gradeLevel: number; programType?: string | null; startTime: string; endTime: string }>>([]);
	const [showFullDay, setShowFullDay] = useState(false);
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
	const [selectedUnassignedForRepair, setSelectedUnassignedForRepair] = useState<UnassignedItem | null>(null);
	const [followUps, setFollowUps] = useState<Set<string>>(new Set());
	const [entityFilter, setEntityFilter] = useState<string>('');
	const [viewMode, setViewMode] = useState<ViewMode>('section');
	const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');
	const [entryKindFilter, setEntryKindFilter] = useState<EntryKindFilter>('all');
	const [presentationMode, setPresentationMode] = useState<'workflow' | 'matrix'>('workflow');
	const [leftTab, setLeftTab] = useState<'violations' | 'unassigned' | 'pinned' | 'requests'>('violations');
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
	const [enforceShiftWindows, setEnforceShiftWindows] = useState(true);
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
	const [isLeftCollapsed, setIsLeftCollapsed] = useState(() => !isDesktop);
	const [isRightCollapsed, setIsRightCollapsed] = useState(true);
	const [centerView, setCenterView] = useState<CenterViewMode>('schedule');
	// Panel refs for imperative collapse/expand
	const leftPanelRef = useRef<ImperativePanelHandle>(null);
	const rightPanelRef = useRef<ImperativePanelHandle>(null);
	// Which action the officer triggered from the right panel
	const [pendingAction, setPendingAction] = useState<'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY' | null>(null);

	/* -- Manual edit / DnD state -- */
	const [dragItem, setDragItem] = useState<DragSource>(null);
	const dragActiveRef = useRef(false);
	const reviewFocusReturnRef = useRef<HTMLElement | null>(null);

	const captureReviewFocusReturn = useCallback((fallbackSelector?: string) => {
		if (typeof document === 'undefined') return;
		const taggedSource = document.querySelector<HTMLElement>('[data-phase-0-focus-id]');
		const active = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
			? document.activeElement
			: null;
		const fallback = fallbackSelector ? document.querySelector<HTMLElement>(fallbackSelector) : null;
		reviewFocusReturnRef.current = taggedSource ?? active ?? fallback ?? null;
	}, []);

	const restoreReviewFocus = useCallback(() => {
		if (typeof window === 'undefined' || typeof document === 'undefined') return;
		const target = reviewFocusReturnRef.current;
		reviewFocusReturnRef.current = null;
		window.setTimeout(() => {
			if (!target || !document.contains(target)) return;
			if (!isFocusableElement(target)) {
				target.setAttribute('tabindex', '-1');
				target.setAttribute('data-review-focus-temporary', 'true');
				const cleanup = () => {
					if (target.getAttribute('data-review-focus-temporary') === 'true') {
						target.removeAttribute('tabindex');
						target.removeAttribute('data-review-focus-temporary');
					}
					target.removeEventListener('blur', cleanup);
				};
				target.addEventListener('blur', cleanup, { once: true });
			}
			target.focus({ preventScroll: true });
		}, 0);
	}, []);
	const [blockerModalData, setBlockerModalData] = useState<any[] | null>(null);
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
	const [pinnedRailDropActive, setPinnedRailDropActive] = useState(false);

	// No drag debug state in runtime hot path.
	const [pinsSearch, setPinsSearch] = useState('');
	const [pinsGradeFilter, setPinsGradeFilter] = useState<number | 'all'>('all');
	/** Wave 4.5b: additional Pins panel filters */
	const [pinsSubjectFilter, setPinsSubjectFilter] = useState<number | 'all'>('all');
	const [pinsSectionFilter, setPinsSectionFilter] = useState<number | 'all'>('all');
	const [pinsQueuePage, setPinsQueuePage] = useState(30);
	const [violationsGroupPage, setViolationsGroupPage] = useState(10);
	const [unassignedPageSize, setUnassignedPageSize] = useState(40);
	/** Ref for auto-preview debounce in PreGenConfirmSheet */
	const autoPreviewRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	/** Assignment picker modal for unassigned placements */
	const [showAssignmentPicker, setShowAssignmentPicker] = useState(false);
	const [assignPickerTarget, setAssignPickerTarget] = useState<{ day: string; startTime: string; endTime: string; item: UnassignedItem } | null>(null);
	const [assignPickerFacultyId, setAssignPickerFacultyId] = useState<string>('');
	const [assignPickerRoomId, setAssignPickerRoomId] = useState<string>('');
	const [assignPickerPreview, setAssignPickerPreview] = useState<PreviewResult | null>(null);
	const [assignPickerPreviewLoading, setAssignPickerPreviewLoading] = useState(false);
	const [assignPickerPreviewError, setAssignPickerPreviewError] = useState<string | null>(null);
	const [assignPickerSaving, setAssignPickerSaving] = useState(false);
	const [inlineActionStatus, setInlineActionStatus] = useState<{ tone: 'loading' | 'success' | 'warning' | 'error'; message: string } | null>(null);
	const pivotTransitionLoading = false;

	/* -- Tutorial + Explainability -- */
	const tutorial = useTutorial('atlas_timetable_tour', { autoStart: false });
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

	useEffect(() => {
		if (!isDesktop) {
			const collapseCompactPanels = () => {
				leftPanelRef.current?.collapse();
				rightPanelRef.current?.collapse();
				setIsLeftCollapsed(true);
				setIsRightCollapsed(true);
			};
			collapseCompactPanels();
			const frame = window.requestAnimationFrame(collapseCompactPanels);
			const timeout = window.setTimeout(collapseCompactPanels, 50);
			return () => {
				window.cancelAnimationFrame(frame);
				window.clearTimeout(timeout);
			};
		}
		return undefined;
	}, [isDesktop, draft?.runId]);

	useEffect(() => {
		if (!isDesktop && isLeftCollapsed) {
			leftPanelRef.current?.collapse();
		}
		if (!isDesktop && isRightCollapsed) {
			rightPanelRef.current?.collapse();
		}
	}, [isDesktop, isLeftCollapsed, isRightCollapsed]);

	// Fetch scheduling policy and grade windows when schoolYearId is available
	useEffect(() => {
		if (!schoolYearId) return;
		const fetchPolicyAndWindows = async () => {
			try {
				const schoolId = DEFAULT_SCHOOL_ID;
				const [policyRes, windowsRes] = await Promise.all([
					atlasApi.get<{ policy: { teacherMoveEnabled: boolean; earliestStartTime: string; latestEndTime: string; enableFlagCeremony: boolean; flagCeremonyStartTime: string; flagCeremonyEndTime: string; enableRecess: boolean; recessStartTime: string; recessEndTime: string; enableLunchWindow: boolean; lunchStartTime: string; lunchEndTime: string } }>(
						`/policies/scheduling/${schoolId}/${schoolYearId}`,
					),
					atlasApi.get<{ windows: Array<{ gradeLevel: number; programType?: string | null; startTime: string; endTime: string }> }>(
						`/generation/${schoolId}/${schoolYearId}/grade-windows`,
					).catch(() => ({ data: { windows: [] } })),
				]);
				setPolicy(policyRes.data.policy);
				setGradeWindows(windowsRes.data.windows);
			} catch (err) {
				console.error('Failed to fetch policy:', err);
			}
		};
		void fetchPolicyAndWindows();
	}, [schoolYearId]);

	const {
		enterPolicyView,
		exitPolicyView,
		enterManualEditView,
		exitManualEditView,
		switchCenterViewWithGuard,
		returnToGeneratedRun,
		handlePresentationModeChange,
	} = useTimetableViewNavigation({
		centerView,
		setCenterView,
		isLeftCollapsed,
		isRightCollapsed,
		leftPanelRef,
		rightPanelRef,
		preGenPending,
		draftPlacementCount: draftBoard?.counts.draft ?? 0,
		preGenMapContext,
		preGenOnboarding,
		setPreGenOnboarding,
		setPendingAction,
		setPendingCenterSwitch,
		setShowLeavePreGenDialog,
		setPresentationMode,
	});

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
		displayTimeSlots,
		hiddenRowCount,
		getCellConflict,
		getLiveCellConflict,
		releaseDeferredDragUpdates,
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
		refreshReferenceLabels,
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
		schoolYearContext,
		referenceLookupStatus,
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
		dragActiveRef,
		preGenKbSource,
		kbSelectedSource,
		setPreGenKbSource,
		setKbSelectedSource,
		showFullDay,
		gradeWindows,
	});

	useEffect(() => {
		if (!isPreGenerationWorkspace || !schoolYearId || roomMap.size > 0) return;
		void fetchReferenceData(schoolYearId).catch((error) => {
			const message = error instanceof Error ? error.message : 'Reference data could not be loaded.';
			toast.error(`Room and owner references are still loading. ${message}`);
		});
	}, [fetchReferenceData, isPreGenerationWorkspace, roomMap.size, schoolYearId]);

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
		handleEntryClick: handleEntrySelect,
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
		previewTeachingLoadRepair,
		commitTeachingLoadRepair,
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
		openRegularSwapPrompt,
		regularSwapPreview,
		regularSwapStrategy,
		setRegularSwapStrategy,
		unassignDraftPlacement,
		getDraggedDraftPlacementId,
		commitPreGenPending,
		swapPreview,
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
		isDesktop,
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
		setInlineActionStatus,
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

	const handleEntryClick = useCallback((entry: ScheduledEntry) => {
		if (
			centerView === 'schedule'
			&& selectedEntry
			&& selectedEntry.entryId !== entry.entryId
		) {
			captureReviewFocusReturn(timetableEntryFocusSelector(entry.entryId));
			openRegularSwapPrompt(selectedEntry, entry);
			setSelectedEntry(null);
			setSelectedViolation(null);
			return;
		}
		handleEntrySelect(entry);
	}, [captureReviewFocusReturn, centerView, handleEntrySelect, openRegularSwapPrompt, selectedEntry, setSelectedEntry, setSelectedViolation]);

	const handleCollaborativeTimetableEvent = useCallback(() => {
		toast.info('Timetable updated by another scheduler. Refreshing data...', { id: 'collab-edit-alert' });
		void handleRefresh();
	}, [handleRefresh]);
	const {
		connected: collaborationConnected,
		presence,
		remoteSelections,
		lastError: collaborationLastError,
	} = useTimetableCollaboration({
		schoolId: DEFAULT_SCHOOL_ID,
		schoolYearId,
		runId: runIdNumeric,
		selectedEntry,
		onTimetableEvent: handleCollaborativeTimetableEvent,
	});

	const openTacticalSandbox = useCallback(() => setTacticalSandboxOpen(true), [setTacticalSandboxOpen]);

	const resolveGeneratedPlacementRoomId = useCallback((item: UnassignedItem, day: string, startTime: string, endTime: string): number | null => {
		const itemRoomId = item.homeRoomId ?? null;
		if (itemRoomId && roomMap.has(itemRoomId)) return itemRoomId;

		const sectionRoomId = sectionMap.get(item.sectionId)?.homeRoomId ?? null;
		if (sectionRoomId && roomMap.has(sectionRoomId)) return sectionRoomId;

		const occupiedSlotRoomId = (draft?.entries ?? []).find((entry: ScheduledEntry) => (
			entry.day === day
			&& entry.startTime === startTime
			&& entry.endTime === endTime
			&& entry.roomId != null
		))?.roomId ?? null;
		if (occupiedSlotRoomId && roomMap.has(occupiedSlotRoomId)) return occupiedSlotRoomId;

		const currentRoomViewId = viewMode === 'room' ? Number(entityFilter) : NaN;
		if (Number.isFinite(currentRoomViewId) && roomMap.has(currentRoomViewId)) return currentRoomViewId;

		return null;
	}, [draft?.entries, entityFilter, roomMap, sectionMap, viewMode]);

	const handleRunChange = useCallback(async (runId: string) => {
		setSelectedRunId(runId);
		setSelectedViolation(null);
		setSelectedEntry(null);
		setSelectedUnassignedForRepair(null);
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
	const placeGeneratedUnassigned = useCallback(async (
		item: UnassignedItem,
		day: string,
		startTime: string,
		endTime: string,
	) => {
		if (!item.facultyId) {
			setSelectedEntry(null);
			setSelectedViolation(null);
			setSelectedUnassignedForRepair(item);
			openTacticalSandbox();
			setInlineActionStatus({
				tone: 'error',
				message: 'This session has no Teaching Load owner yet. Fix the teacher in Teaching Load before placing it on the timetable.',
			});
			toast.info('Teaching Load repair opened. Choose the correct owner there, then place the session.');
			return;
		}
		const defaultRoomId = resolveGeneratedPlacementRoomId(item, day, startTime, endTime);
		captureReviewFocusReturn(timetableCellFocusSelector(day, startTime, endTime));
		setSelectedEntry(null);
		setSelectedViolation(null);
		setSelectedUnassignedForRepair(null);
		setAssignPickerTarget({ item, day, startTime, endTime });
		setAssignPickerFacultyId(String(item.facultyId));
		setAssignPickerRoomId(defaultRoomId ? String(defaultRoomId) : '');
		setAssignPickerPreview(null);
		setAssignPickerPreviewError(null);
		setAssignPickerPreviewLoading(false);
		setShowAssignmentPicker(true);
		setInlineActionStatus({
			tone: 'loading',
			message: defaultRoomId
				? 'Placement review opened. Check conflicts before saving.'
				: 'Placement review opened. Pick a room, then check conflicts before saving.',
		});
		setDragItem(null);
	}, [
		openTacticalSandbox,
		captureReviewFocusReturn,
		resolveGeneratedPlacementRoomId,
		setSelectedEntry,
		setSelectedUnassignedForRepair,
		setSelectedViolation,
		toast,
	]);

	const runGeneratedPlacementPreview = useCallback(async (
		target = assignPickerTarget,
		roomIdValue = assignPickerRoomId,
	): Promise<PreviewResult | null> => {
		if (!target) return null;
		const { day, startTime, endTime, item } = target;
		const targetFacultyId = item.facultyId ?? Number(assignPickerFacultyId);
		const targetRoomId = Number(roomIdValue);
		if (!targetFacultyId || !targetRoomId) {
			setAssignPickerPreview(null);
			setAssignPickerPreviewError('Select a room source before previewing this placement.');
			return null;
		}

		const proposal: ManualEditProposal = {
			editType: 'PLACE_UNASSIGNED',
			sectionId: item.sectionId,
			subjectId: item.subjectId,
			session: item.session,
			entryKind: item.entryKind,
			cohortCode: item.cohortCode,
			targetDay: day,
			targetStartTime: startTime,
			targetEndTime: endTime,
			targetFacultyId,
			targetRoomId,
		};

		setAssignPickerPreviewLoading(true);
		setAssignPickerPreviewError(null);
		const preview = await previewEdit(proposal);
		setAssignPickerPreviewLoading(false);
		if (!preview) {
			setAssignPickerPreview(null);
			setAssignPickerPreviewError('Unable to preview this generated placement.');
			return null;
		}
		const scopedPreview = scopePreviewToCandidate(preview, { day, startTime, endTime });
		setAssignPickerPreview(scopedPreview);
		setAssignPickerPreviewError(scopedPreview.allowed ? null : 'This placement is blocked. Pick another slot or room.');
		return scopedPreview;
	}, [assignPickerFacultyId, assignPickerRoomId, assignPickerTarget, previewEdit]);

	useEffect(() => {
		if (!showAssignmentPicker || !assignPickerTarget || !assignPickerRoomId) {
			setAssignPickerPreview(null);
			setAssignPickerPreviewError(null);
			return;
		}
		const timer = setTimeout(() => {
			void runGeneratedPlacementPreview(assignPickerTarget, assignPickerRoomId);
		}, 350);
		return () => clearTimeout(timer);
	}, [assignPickerRoomId, assignPickerTarget, runGeneratedPlacementPreview, showAssignmentPicker]);

	/** Confirm generated unassigned placement after room/slot review. */
	const confirmAssignmentPicker = useCallback(async () => {
		if (!assignPickerTarget) return;
		const { day, startTime, endTime, item } = assignPickerTarget;
		const targetFacultyId = item.facultyId ?? Number(assignPickerFacultyId);
		const targetRoomId = Number(assignPickerRoomId);
		if (!targetFacultyId || !targetRoomId) {
			toast.error('Select a room source before saving this placement.');
			return;
		}

		const proposal: ManualEditProposal = {
			editType: 'PLACE_UNASSIGNED',
			sectionId: item.sectionId,
			subjectId: item.subjectId,
			session: item.session,
			entryKind: item.entryKind,
			cohortCode: item.cohortCode,
			targetDay: day,
			targetStartTime: startTime,
			targetEndTime: endTime,
			targetFacultyId,
			targetRoomId,
		};

		setAssignPickerSaving(true);
		const scopedPreview = assignPickerPreview ?? await runGeneratedPlacementPreview(assignPickerTarget, assignPickerRoomId);
		if (!scopedPreview) {
			setAssignPickerSaving(false);
			return;
		}
		if (!scopedPreview.allowed) {
			const firstHard = scopedPreview.humanConflicts.find((hc) => hc.severity === 'HARD');
			setInlineActionStatus({ tone: 'error', message: firstHard?.humanTitle ?? 'Placement blocked by hard conflicts.' });
			setAssignPickerSaving(false);
			return;
		}
		try {
			setInlineActionStatus({
				tone: scopedPreview.softViolations.length > 0 ? 'warning' : 'loading',
				message: scopedPreview.softViolations.length > 0
					? `Preview: ${scopedPreview.softViolations.length} soft warning(s). Placing session...`
					: 'Placing session...',
			});
			const committed = await commitEdit(proposal, scopedPreview.softViolations.length > 0);
			if (!committed) {
				setInlineActionStatus({ tone: 'error', message: 'Placement was not saved. Review the error message and try again.' });
				return;
			}
			setInlineActionStatus({
				tone: scopedPreview.softViolations.length > 0 ? 'warning' : 'success',
				message: scopedPreview.softViolations.length > 0
					? `Placement applied with ${scopedPreview.softViolations.length} soft warning(s).`
					: 'Placement applied using the Teaching Load owner and selected room.',
			});
			setShowAssignmentPicker(false);
			setAssignPickerTarget(null);
			setAssignPickerFacultyId('');
			setAssignPickerRoomId('');
			setAssignPickerPreview(null);
			setAssignPickerPreviewError(null);
			setKbSelectedSource(null);
			setDragItem(null);
		} finally {
			setAssignPickerSaving(false);
		}
	}, [
		assignPickerFacultyId,
		assignPickerPreview,
		assignPickerRoomId,
		assignPickerTarget,
		commitEdit,
		runGeneratedPlacementPreview,
		setKbSelectedSource,
		toast,
	]);

	/** Handle drop of item onto a timetable cell */
	const handleCellDrop = useCallback(
		async (day: string, startTime: string, endTime: string, dragSource?: DragSource) => {
			const activeDragItem = dragSource ?? dragItem;
			if (!activeDragItem) return;

			if (activeDragItem.type === 'draftQueue' || activeDragItem.type === 'draftPlacement') {
				captureReviewFocusReturn(timetableCellFocusSelector(day, startTime, endTime));
				await stagePreGenDrop(activeDragItem, day, startTime, endTime);
				setDragItem(null);
				return;
			}

			if (activeDragItem.type === 'unassigned') {
				await placeGeneratedUnassigned(activeDragItem.item, day, startTime, endTime);
				return;
			}
			if (activeDragItem.type === 'entry' && centerView === 'pre-generation') {
				const placement = resolveDraftPlacementFromEntry(activeDragItem.entry, draftBoard?.placements ?? []);
				if (placement) {
					captureReviewFocusReturn(timetableCellFocusSelector(day, startTime, endTime));
					await stagePreGenDrop({ type: 'draftPlacement', placement }, day, startTime, endTime);
					setDragItem(null);
					return;
				}
				toast.error('Swap-safe draft placement could not be resolved. Refresh the pre-generation workspace and retry.');
				setDragItem(null);
				return;
			}
			const entry = activeDragItem.entry;
			const slotEntries = (draft?.entries ?? []).filter((candidate: ScheduledEntry) => (
				candidate.day === day
				&& candidate.startTime === startTime
				&& candidate.endTime === endTime
			));
			const swapCandidate = findRegularSwapCandidate(entry, slotEntries);
			if (swapCandidate) {
				captureReviewFocusReturn(timetableEntryFocusSelector(swapCandidate.entryId));
				setInlineActionStatus({ tone: 'warning', message: 'Review swap before saving. This occupied slot will exchange the two sessions.' });
				openRegularSwapPrompt(entry, swapCandidate);
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

			setInlineActionStatus({ tone: 'loading', message: 'Checking move impact...' });
			const preview = await previewEdit(proposal);
			if (!preview) return;
			const scopedPreview = scopePreviewToCandidate(preview, { day, startTime, endTime });

			if (!scopedPreview.allowed) {
				const firstHard = scopedPreview.humanConflicts.find((hc) => hc.severity === 'HARD');
				setInlineActionStatus({ tone: 'error', message: firstHard?.humanTitle ?? 'Move blocked by hard conflicts.' });
				setDragItem(null);
				return;
			}

			setInlineActionStatus({
				tone: scopedPreview.softViolations.length > 0 ? 'warning' : 'loading',
				message: scopedPreview.softViolations.length > 0
					? `Preview: ${scopedPreview.softViolations.length} soft warning(s). Applying move...`
					: 'Applying move...',
			});
			const committed = await commitEdit(proposal, scopedPreview.softViolations.length > 0);
			if (!committed) {
				setInlineActionStatus({ tone: 'error', message: 'Move was not saved. Review the error message and try again.' });
				return;
			}
			setInlineActionStatus({
				tone: scopedPreview.softViolations.length > 0 ? 'warning' : 'success',
				message: scopedPreview.softViolations.length > 0
					? `Move applied with ${scopedPreview.softViolations.length} soft warning(s).`
					: 'Move applied.',
			});
		},
		[captureReviewFocusReturn, dragItem, previewEdit, commitEdit, stagePreGenDrop, centerView, draftBoard?.placements, draft?.entries, openRegularSwapPrompt, placeGeneratedUnassigned],
	);

	/** Keyboard-accessible placement confirm */
	const handleKbPlace = useCallback(
		async (day: string, startTime: string, endTime: string) => {
			const activeKbSource = kbSelectedSource ?? (centerView === 'pre-generation' ? preGenKbSource : null);
			if (!activeKbSource) return;
			const fakeItem = activeKbSource;
			setKbSelectedSource(null);

			if (fakeItem.type === 'draftQueue' || fakeItem.type === 'draftPlacement') {
				setPreGenKbSource(null);
				captureReviewFocusReturn(timetableCellFocusSelector(day, startTime, endTime));
				await stagePreGenDrop(fakeItem, day, startTime, endTime);
				return;
			}

			if (fakeItem.type === 'entry' && centerView === 'pre-generation') {
				const placement = resolveDraftPlacementFromEntry(fakeItem.entry, draftBoard?.placements ?? []);
				if (placement) {
					setPreGenKbSource(null);
					captureReviewFocusReturn(timetableCellFocusSelector(day, startTime, endTime));
					await stagePreGenDrop({ type: 'draftPlacement', placement }, day, startTime, endTime);
					return;
				}
				toast.error('Swap-safe draft placement could not be resolved. Refresh the pre-generation workspace and retry.');
				return;
			}

			if (fakeItem.type === 'unassigned') {
				await placeGeneratedUnassigned(fakeItem.item, day, startTime, endTime);
				return;
			}

			if (fakeItem.type === 'entry') {
				flushSync(() => {
					setInlineActionStatus({ tone: 'loading', message: 'Reviewing selected slot before saving this move.' });
				});
				const slotEntries = (draft?.entries ?? []).filter((candidate: ScheduledEntry) => (
					candidate.day === day
					&& candidate.startTime === startTime
					&& candidate.endTime === endTime
				));
				const swapCandidate = findRegularSwapCandidate(fakeItem.entry, slotEntries);
				if (swapCandidate) {
					captureReviewFocusReturn(timetableEntryFocusSelector(swapCandidate.entryId));
					setInlineActionStatus({ tone: 'warning', message: 'Review swap before saving. This occupied slot will exchange the two sessions.' });
					openRegularSwapPrompt(fakeItem.entry, swapCandidate);
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
			setInlineActionStatus({ tone: 'loading', message: 'Checking move impact...' });
			const preview = await previewEdit(proposal);
			if (!preview) { setDragItem(null); return; }
			const scopedPreview = scopePreviewToCandidate(preview, { day, startTime, endTime });
			if (!scopedPreview.allowed) {
				const firstHard = scopedPreview.humanConflicts.find((hc) => hc.severity === 'HARD');
				setInlineActionStatus({ tone: 'error', message: firstHard?.humanTitle ?? 'Move blocked by hard conflicts.' });
				setDragItem(null);
				return;
			}
			setInlineActionStatus({
				tone: scopedPreview.softViolations.length > 0 ? 'warning' : 'loading',
				message: scopedPreview.softViolations.length > 0
					? `Preview: ${scopedPreview.softViolations.length} soft warning(s). Applying move...`
					: 'Applying move...',
			});
			const committed = await commitEdit(proposal, scopedPreview.softViolations.length > 0);
			if (!committed) {
				setInlineActionStatus({ tone: 'error', message: 'Move was not saved. Review the error message and try again.' });
				return;
			}
			setInlineActionStatus({
				tone: scopedPreview.softViolations.length > 0 ? 'warning' : 'success',
				message: scopedPreview.softViolations.length > 0
					? `Move applied with ${scopedPreview.softViolations.length} soft warning(s).`
					: 'Move applied.',
			});
		},
		[captureReviewFocusReturn, kbSelectedSource, preGenKbSource, previewEdit, commitEdit, stagePreGenDrop, centerView, draftBoard?.placements, draft?.entries, openRegularSwapPrompt, placeGeneratedUnassigned],
	);

	/** Load edit history on mount / run change */
	useEffect(() => {
		fetchEditHistory();
	}, [fetchEditHistory]);

	useEffect(() => {
		if (!inlineActionStatus) return;
		if (inlineActionStatus.tone === 'loading' || inlineActionStatus.tone === 'error') return;
		const timer = setTimeout(() => setInlineActionStatus(null), 6000);
		return () => clearTimeout(timer);
	}, [inlineActionStatus]);

	/* -- Lookup helpers -- */

	const emptyDraftEntries = useMemo(() => [], []);
	const lookupHelpers = useTimetableLookupHelpers({
		viewMode,
		pivotEntityIds,
		roomMap,
		facultyMap,
		sectionMap,
		subjectMap,
		draftEntries: draft?.entries ?? emptyDraftEntries,
		sectionLabel,
		roomLabelShort,
	});
	const { resolveEntryProgramType, resolveEntryProgramCode, entryContextLabel, formatConstraintMessage } = lookupHelpers;

	const { gradeForSection, groupedPivotEntities } = lookupHelpers;

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


	const setDragActive = useCallback((active: boolean) => {
		dragActiveRef.current = active;
		if (!active) releaseDeferredDragUpdates();
	}, [releaseDeferredDragUpdates]);
	const emptyDraftPlacements = useMemo(() => [], []);
	const { sensors, handleGlobalDragStart, handleGlobalDragMove, handleGlobalDragOver, handleGlobalDragEnd, handleGlobalDragCancel, focusPinnedPlacement } = useTimetableDragDrop({
		centerView,
		draftPlacements: draftBoard?.placements ?? emptyDraftPlacements,
		preGenEntries,
		handleCellDrop,
		navToFaculty,
		navToSection,
		navToRoom,
		rightPanelRef,
		setCenterView,
		setLeftTab,
		setSelectedViolation,
		setSelectedEntry,
		setPreGenKbSource,
		setKbSelectedSource,
		setUnassignDropActive,
		setPinnedRailDropActive,
		setPendingUnassignId,
		setShowUnassignConfirm,
		setInlineActionStatus,
		setDragActive,
	});

	/* -- Render contexts -- */
	const hardCount = violations.filter((v) => v.severity === 'HARD').length;
	const softCount = violations.filter((v) => v.severity === 'SOFT').length;
	const selectedMapBuilding = buildings.find((b) => b.id === mapBuildingId) ?? null;
	const selectedMapBuildingFloors = useMemo(() => {
		return selectedMapBuilding ? Array.from({ length: selectedMapBuilding.floorCount }, (_, i) => selectedMapBuilding.floorCount - i) : [];
	}, [selectedMapBuilding]);

	const gridKbSelectedSource = kbSelectedSource ?? (centerView === 'pre-generation' ? preGenKbSource : null);
	const handleKbPlaceStart = useCallback(() => {
		flushSync(() => {
			setInlineActionStatus({ tone: 'loading', message: 'Reviewing selected slot before saving this move.' });
		});
	}, []);

	// Context-aware window warning: only warn when rows are actually hidden
	const policyAlignmentWarning = useMemo(() => {
		if (showFullDay) return null;
		if (hiddenRowCount <= 0) return null;
		if (!policy?.earliestStartTime || gradeWindows.length === 0) return null;

		const selectedId = Number(entityFilter);
		if (!selectedId) return null;

		// Determine the relevant window based on view mode
		let windowLabel = '';
		if (viewMode === 'section') {
			const section = sectionMap.get(selectedId);
			if (!section) return null;
			const gradeNumber = resolveSectionGradeNumber(section);
			if (gradeNumber == null) return null;
			const matchingWindow = findGradeWindow(gradeNumber, section.programType, gradeWindows);
			if (!matchingWindow) return null;
			windowLabel = `this section's grade/program window (${matchingWindow.startTime})`;
		} else {
			// Teacher/Room view: no single window, describe based on occupied entries
			return null;
		}

		const fmtTime = (t: string) => {
			const [h, m] = t.split(':').map(Number);
			const period = h >= 12 ? 'PM' : 'AM';
			const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
			return `${h12}:${String(m).padStart(2, '0')} ${period}`;
		};

		return `${hiddenRowCount} earlier row${hiddenRowCount === 1 ? '' : 's'} hidden. The school day starts at ${fmtTime(policy.earliestStartTime)}, but ${windowLabel}. Use Show full day to review all rows.`;
	}, [showFullDay, hiddenRowCount, policy?.earliestStartTime, gradeWindows, entityFilter, viewMode, sectionMap]);

	const rawWorkspaceContexts = (() => {
		if ((loading && !draft) || error) {
			return {};
		}
		const leftRailContentContext = buildLeftRailContext({ leftTab, isPreGenerationWorkspace, hardViolationCount, topBlockers, violations, handleViolationSelect, setSeverityFilter, severityFilter, VIOLATION_LABELS, violationSearch, setViolationSearch, filteredViolations, violationsByCode, violationsGroupPage, setViolationsGroupPage, selectedViolation, setDrawerViolation, formatConstraintMessage, draftBoard, isDesktop, setDragItem, toast, summary, filteredUnassignedItems, programKindFilteredUnassignedItems, unassignedPageSize, setUnassignedPageSize, unassignedReasonFilter, setUnassignedReasonFilter, resolveEntryProgramType, resolveEntryProgramCode, sectionLabel, subjectLabel, kbSelectedSource, followUps, expandedUnassigned, setExpandedUnassigned, unassignedFixSuggestions, fixLoading, schoolYearId, runs, selectedRunId, setFixLoading, setUnassignedFixSuggestions, entryContextLabel, previewEdit, setDrawerUnassigned, setFollowUps, showSoftConfirm, unassignDropActive, setUnassignDropActive, pinnedRailDropActive, fetchDraftBoardSummary, preGenPending, pinsSearch, setPinsSearch, pinsGradeFilter, setPinsGradeFilter, pinsSectionFilter, setPinsSectionFilter, pinsSubjectFilter, setPinsSubjectFilter, getDraggedDraftPlacementId, setPendingUnassignId, setShowUnassignConfirm, pinsQueuePage, setPinsQueuePage, preGenKbSource, setPreGenKbSource, setKbSelectedSource, leftPanelRef, rightPanelRef, selectedEntry, setSelectedEntry, selectedUnassignedForRepair, setSelectedUnassignedForRepair, setSelectedViolation, preGenEntries, gradeForSection, formatFacultyInitials, roomLabelShort, roomMap, roomRequestSummary, requestSearch, setRequestSearch, requestStatusFilter, setRequestStatusFilter, requestDecisionFilter, setRequestDecisionFilter, roomRequestError, roomRequestLoading, filteredRoomRequests, selectedRequestId, focusRequestInGrid, openRequestPreview, isPrivilegedUser, focusPinnedPlacement, openTacticalSandbox });
		const centerWorkspaceContext = buildCenterWorkspaceContext({ centerView, selectedEntry, selectedUnassigned: selectedUnassignedForRepair, setSelectedUnassigned: setSelectedUnassignedForRepair, violationIndex, followUps, toggleFollowUp, exitPolicyView, handleRefresh, schoolYearId, pendingAction, roomMap, facultyMap, subjectMap, draft, previewEdit, commitEdit, previewTeachingLoadRepair, commitTeachingLoadRepair, previewLoading, commitLoading, subjectLabel, facultyLabel, sectionLabel, gradeForSection, roomLabel, isStaleRoom, timeSlots: displayTimeSlots, preGenOnboarding, setCenterView, buildings, mapBuildingId, setMapBuildingId, openBuildingWorkspace, selectedMapBuilding, selectedMapBuildingFloors, mapRoomId, openRoomGridWorkspace, presentationMode, draftBoard, runs, generating, newDraftLoading, handleStartNewPreGenerationDraft, handleTriggerGenerate, entityFilter, pivotLabel, viewMode, setPreGenOnboarding, gridEntries, highlightedEntryIds, handleEntryClick, entryContextLabel, formatFacultyInitials, roomLabelShort, kbSelectedSource: gridKbSelectedSource, handleKbPlace, handleKbPlaceStart, getCellConflict, getLiveCellConflict, navToFaculty, navToSection, navToRoom, tacticalSandboxOpen, setTacticalSandboxOpen, preGenPending, preGenPreviewLoading, preGenPreviewError, preGenPreview, commitPreGenPending, preGenSaving, setPreGenPending, setPreGenPreview, setPreGenPreviewError, setPreGenAllowSoftOverride });
		const rightPanelContext = buildRightPanelContext({ rightPanelRef, setIsRightCollapsed, isRightCollapsed, isPreGenerationWorkspace, preGenKbSource, selectedEntry, setPreGenKbSource, setKbSelectedSource, initials, facultyMap, formatFacultyInitials, isDesktop, subjectLabel, toggleFollowUp, followUps, setSelectedEntry, gradeForSection, violationIndex, sectionLabel, facultyLabel, roomLabel, roomRequestSummary, previewResult, formatConstraintMessage, violationLabels: VIOLATION_LABELS, violationExplanations: VIOLATION_EXPLANATIONS, setSelectedViolation, toast, draftBoard, parseDraftPlacementId, deletingPlacementId, setPendingUnassignId, setShowUnassignConfirm, enterManualEditView, openTacticalSandbox });
		const headerContext = buildHeaderContext({ isPreGenerationWorkspace, activeGeneratedRunId, leftTab, leftPanelRef, selectedRunId, handleRunChange, runs, schoolYearContext, centerView, newDraftLoading, schoolYearId, handleStartNewPreGenerationDraft, draftPlacementCount: draftBoardSummary?.draft ?? 0, openPreGenerationWorkspace, returnToGeneratedRun, generating, loading, handleTriggerGenerate, draft, hardCount, setPublishAcknowledged, setShowPublishDialog, exitPolicyView, switchCenterViewWithGuard, enterPolicyView, openMapWorkspace, handleRefresh, refreshReferenceLabels, referenceLookupStatus, revertLoading, editHistoryCount: editHistory.length, revertLastEdit, setShowEditHistory, tutorial, summary, sectionLabel, subjectLabel, facultyLabel, setUnassignedReasonFilter, requestPendingCount: roomRequestSummary?.counts?.pending ?? 0, statusColor, formatDuration, formatTimestamp, viewMode, setViewMode, setEntityFilter, hasSelectedEntry: !!selectedEntry, setSelectedEntry, setSelectedViolation, enterManualEditView, setPreGenKbSource, setKbSelectedSource, entityFilter, groupedPivotEntities, pivotLabel, programFilter, setProgramFilter, entryKindFilter, setEntryKindFilter, violations, severityFilter, setSeverityFilter, setLeftTab, softCount, presentationMode, setPresentationMode: handlePresentationModeChange, policy, policyAlignmentWarning, showFullDay, setShowFullDay, hiddenRowCount, collaborationConnected, presence, remoteSelections });
		const dialogContext = buildDialogContext({ showUnassignConfirm, setShowUnassignConfirm, setPendingUnassignId, pendingUnassignId, unassignDraftPlacement, showGenerateConfirm, setShowGenerateConfirm, enforceShiftWindows, setEnforceShiftWindows, draftBoardSummary, followUps, confirmGenerate, showResetDraftDialog, setShowResetDraftDialog, openPreGenerationWorkspace, showLeavePreGenDialog, setShowLeavePreGenDialog, pendingCenterSwitch, setPendingCenterSwitch, requestPreview, requestPreviewLoading, setRequestPreview, setSelectedRequestId, setRequestAppeals, setAppealReason, requestPreviewHardConflicts, requestPreviewSoftWarnings, requestAppeals, appealsLoading, isPrivilegedUser, updateAppealStatus, appealReason, appealSubmitting, submitAppeal, requestReviewerNotes, setRequestReviewerNotes, requestReviewSaving, reviewRoomRequest, generating, generationElapsed, showPublishDialog, setShowPublishDialog, publishAcknowledged, setPublishAcknowledged, softCount, policy, handlePublishConfirm, captureReviewFocusReturn, restoreReviewFocus, showPreGenConfirm, setShowPreGenConfirm, setPreGenConfirmCtx, setConfirmPreview, setConfirmRawPreview, setConfirmPreviewError, setConfirmAllowSoftOverride, setConfirmAllowDailyOverride, preGenConfirmCtx, confirmFacultyId, setConfirmFacultyId, confirmPreview, confirmRoomId, setConfirmRoomId, facultyMap, roomMap, confirmPreviewLoading, confirmPreviewError, confirmDisplacedPlacement, toast, openSwapPrompt, confirmAllowDailyOverride, confirmSaving, commitConfirmPlacement, showSwapConfirm, setShowSwapConfirm, setSwapAction, swapAction, formatFacultyInitials, roomLabelShort, subjectLabel, sectionLabel, swapSaving, executeSwapAction, swapPreview, regularSwapPreview, regularSwapPending, setRegularSwapPending, regularSwapSaving, regularSwapStrategy, setRegularSwapStrategy, executeRegularSwap, showSoftConfirm, setShowSoftConfirm, softConfirmWarnings, commitLoading, formatConstraintMessage, setPendingCommitProposal, setPreviewResult, setSoftConfirmWarnings, setDragItem, pendingCommitProposal, commitEdit, showAssignmentPicker, setShowAssignmentPicker, setAssignPickerTarget, assignPickerTarget, assignPickerFacultyId, setAssignPickerFacultyId, assignPickerRoomId, setAssignPickerRoomId, assignPickerPreview, assignPickerPreviewLoading, assignPickerPreviewError, assignPickerSaving, confirmAssignmentPicker, showEditHistory, setShowEditHistory, editHistory });
		const overlaysContext = buildOverlaysContext({ dialogContext, tutorial, blockerModalData, setBlockerModalData, showExplainDrawer, setDrawerViolation, setDrawerUnassigned, drawerViolation, drawerUnassigned });
		return { leftRailContentContext, centerWorkspaceContext, rightPanelContext, headerContext, overlaysContext, dialogContext };
	})();

	const prevContextsRef = useRef<typeof rawWorkspaceContexts | null>(null);
	const workspaceContexts = useMemo(() => {
		if (!prevContextsRef.current) {
			prevContextsRef.current = rawWorkspaceContexts;
			return rawWorkspaceContexts;
		}

		const isShallowEqual = (objA: any, objB: any) => {
			if (Object.is(objA, objB)) return true;
			if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) return false;
			const keysA = Object.keys(objA);
			if (keysA.length !== Object.keys(objB).length) return false;
			for (const key of keysA) {
				if (!Object.is(objA[key], objB[key])) return false;
			}
			return true;
		};

		let hasChanges = false;
		const nextContexts: any = {};
		for (const key of Object.keys(rawWorkspaceContexts) as (keyof typeof rawWorkspaceContexts)[]) {
			if (!isShallowEqual(rawWorkspaceContexts[key], prevContextsRef.current![key])) {
				hasChanges = true;
				nextContexts[key] = rawWorkspaceContexts[key];
			} else {
				nextContexts[key] = prevContextsRef.current[key];
			}
		}

		if (hasChanges) {
			prevContextsRef.current = nextContexts;
			return nextContexts as typeof rawWorkspaceContexts;
		}
		return prevContextsRef.current;
	}, [rawWorkspaceContexts]);

	const showTopLoadingStrip = loading
		|| generating
		|| previewLoading
		|| commitLoading
		|| revertLoading
		|| requestPreviewLoading
		|| requestReviewSaving
		|| roomRequestLoading
		|| newDraftLoading
		|| preGenPreviewLoading
		|| preGenSaving
		|| confirmPreviewLoading
		|| confirmSaving
		|| swapSaving
		|| regularSwapSaving
		|| (regularSwapPreview?.loading ?? false)
		|| appealsLoading
		|| appealSubmitting
		|| pivotTransitionLoading;

	return {
		loading,
		draft,
		error,
		loadAll,
		generating,
		previewLoading,
		commitLoading,
		revertLoading,
		requestPreviewLoading,
		requestReviewSaving,
		roomRequestLoading,
		newDraftLoading,
		preGenPreviewLoading,
		preGenSaving,
		confirmPreviewLoading,
		confirmSaving,
		swapSaving,
		regularSwapSaving,
		regularSwapPreview,
		appealsLoading,
		appealSubmitting,
		pivotTransitionLoading,
		inlineActionStatus,
		setInlineActionStatus,
		sensors,
		handleGlobalDragStart,
		handleGlobalDragMove,
		handleGlobalDragOver,
		handleGlobalDragEnd,
		handleGlobalDragCancel,
		leftPanelRef,
		setIsLeftCollapsed,
		isLeftCollapsed,
		isDesktop,
		isPreGenerationWorkspace,
		leftTab,
		setLeftTab,
		violations,
		summary,
		roomRequestSummary,
		dragItem,
		selectedEntry,
		facultyMap,
		previewTeachingLoadRepair,
		commitTeachingLoadRepair,
		handleRefresh,
		entryContextLabel,
		roomLabelShort,
		formatFacultyInitials,
		subjectLabel,
		sectionLabel,
		showTopLoadingStrip,
		policyAlignmentWarning,
		...workspaceContexts,
	};
}
