import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { decideAutoSavePlacement } from '@/lib/simple-timetable-state';
import {
	buildInlinePlacementPreviewData,
	type InlinePlacementPreviewData,
	type InlinePlacementTeachingSpaces,
} from '@/lib/timetable-inline-placement';
import { buildAcademicTermOptions, isVerifiedOrderedActiveTerm, repairTermFilter, type OrderedAcademicTerm } from '@/lib/academic-term';
import { isTargetSlotOccupiedForTerm } from '@/lib/timetable-term-scope';
import { formatTime } from '@/lib/utils';
import { buildEditReceipt, receiptClassLabel, receiptProblemSentence } from '@/lib/timetable-edit-receipt';
import { plainConflictDetail } from '@/lib/manual-edit-conflict-summary';
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
	SchedulingPolicy,
	SectionSummaryResponse,
	Subject,
	UnassignedExplanation,
	UnassignedItem,
	UnassignedReason,
	Violation,
	ViolationReport,
} from '@/types';
import {
	resolveGenerateTrigger,
	type TimetableGenerationStopper,
} from '@/lib/timetable-capabilities';
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
import { findRegularSwapCandidate, isSameTimetableSlot, resolveDraftPlacementFromEntry } from '@/lib/timetable-swap-routing';
import { VIOLATION_EXPLANATIONS } from '@/components/ExplainabilityDrawer';
import { useTutorial } from '@/components/TutorialOverlay';
import { useTimetableCollaboration } from '@/hooks/useTimetableCollaboration';
import { useTimetableLookupHelpers } from '@/hooks/useTimetableLookupHelpers';
import { useTimetableDragDrop } from '@/hooks/useTimetableDragDrop';
import { useTimetableViewNavigation } from '@/hooks/useTimetableViewNavigation';
import { isDraftPublishedStrict } from '@/components/timetable/timetableWorkspaceTruth';
import { deriveRunWideReadiness } from '@/components/timetable/timetableWorkspaceTruth';
import { restorePublishedTimetableContext } from '@/lib/timetable-published-return';
import { usePublishedTimetableReturnState } from '@/hooks/usePublishedTimetableReturnState';
import { getPreferredAccessToken } from '@/lib/auth';
import { decodeJwtPayload } from '@/lib/jwt-payload';
import { SWAP_ARMED_FROM_SELECTION_MESSAGE, SWAP_ARMED_MESSAGE, resetSwapClassTimes } from '@/components/timetable/timetableSwapArming';
import {
	describeConcurrentCommit,
	evaluateArmedSwapSelection,
	isOwnTimetableCommit,
	readConflictingEntryIds,
	subscribeConcurrentCommitEvents,
	type ArmedSwapSelection,
	type ConcurrentCommitNotice,
	type SwapAnchor,
} from '@/lib/timetable-concurrent-commit';

import type { PublishedEntryChangeRequest } from '@/lib/published-entry-change';

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

const SWAP_CLASS_A_SELECTED = 'Class A selected. Choose the second class to swap times with.';
const SWAP_CLASS_B_SAME = 'Choose a different occupied class than Class A.';
/** Inline prompts that only make sense while swap mode is active. */
// LANE-C C03 — the two arming prompts are swap-mode prompts too; they stayed
// on screen after Cancel.
export const SWAP_MODE_STATUS_MESSAGES = new Set([SWAP_CLASS_A_SELECTED, SWAP_CLASS_B_SAME, SWAP_ARMED_MESSAGE, SWAP_ARMED_FROM_SELECTION_MESSAGE]);

export function useScheduleReviewWorkspaceState() {
	const navigate = useNavigate();
	/* -- Data state -- */
	const [tacticalSandboxOpen, setTacticalSandboxOpen] = useState(false);
	const [schoolYearId, setSchoolYearId] = useState<number | null>(null);


	const [runs, setRuns] = useState<GenerationRun[]>([]);
	const [selectedRunId, setSelectedRunId] = useState<string>('latest');
	const [draft, setDraft] = useState<any | null>(null);
	const [violationReport, setViolationReport] = useState<ViolationReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	// A-16: fail closed. A permissive `{teacherMoveEnabled:true}` default masked a
	// failed policy read and suppressed the hidden-row warning.
	const [policy, setPolicy] = useState<{ teacherMoveEnabled: boolean; earliestStartTime?: string; latestEndTime?: string } | null>(null);
	// UX-R03c — the workspace owns the policy read. `policy` above stays the
	// narrow projection (typed fixtures build partial policy objects, so its
	// type must not widen); `policyRecord` is the separate full record the
	// policy pane hydrates from instead of issuing its own GET.
	const [policyRecord, setPolicyRecord] = useState<SchedulingPolicy | null>(null);
	// UX-R03c — dedicated policy refetch trigger. `onPolicySaved={handleRefresh}`
	// routes to `loadAll`, which does not re-run the policy effect below (its
	// deps are `[schoolId, schoolYearId]`), so a save would otherwise leave the
	// two consumers converged on nothing. Threaded to the pane; a save
	// converges both consumers on the saved value through one path.
	const [policyRefreshToken, setPolicyRefreshToken] = useState(0);
	const refreshPolicy = useCallback(() => {
		setPolicyRefreshToken((token) => token + 1);
	}, []);
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
	const [pendingFacultyIssuePivot, setPendingFacultyIssuePivot] = useState<{
		facultyId: number;
		teacherLabel: string;
		violation: Violation;
		entry: ScheduledEntry | null;
	} | null>(null);
	const [selectedEntry, setSelectedEntry] = useState<ScheduledEntry | null>(null);
	const [selectedUnassignedForRepair, setSelectedUnassignedForRepair] = useState<UnassignedItem | null>(null);
	const [swapClassTimesMode, setSwapClassTimesMode] = useState<'select-first' | 'select-second' | null>(null);
	const [swapClassAEntryId, setSwapClassAEntryId] = useState<string | null>(null);
	const [swapClassBEntryId, setSwapClassBEntryId] = useState<string | null>(null);
	/**
	 * C11 M4 — the ONE reset for the armed swap, and the only definition of
	 * "fully disarmed". Every exit path runs this: the header banner's Cancel,
	 * the review dialog's X / backdrop / Escape / both Cancel buttons, the
	 * view-change effect and the concurrent-commit release. Before C11 the reset
	 * was open-coded at four sites and the review dialog's close was not one of
	 * them, which is the recorded "needs a reload to clear" defect.
	 */
	const resetSwapClassTimesState = useCallback(() => {
		resetSwapClassTimes({ setMode: setSwapClassTimesMode, setEntryIdA: setSwapClassAEntryId, setEntryIdB: setSwapClassBEntryId });
		swapAnchorRef.current = null;
	}, []);
	// A2-TIMETABLE-CUSTODY (#61) — where Class A sat at the moment it was armed.
	// Captured in ONE place (the effect below) so whichever arm site set the id —
	// the grid click or the selected-class affordance — the guard has an anchor to
	// compare against. A ref, so a re-render can never silently re-anchor it onto
	// the class's NEW position and thereby defeat the comparison.
	const swapAnchorRef = useRef<SwapAnchor>(null);
	// The named concurrent-commit notice. State, not a toast, so it survives a
	// re-render and stays dismissible.
	const [concurrentCommitNotice, setConcurrentCommitNotice] = useState<ConcurrentCommitNotice | null>(null);
	const dismissConcurrentCommit = useCallback(() => setConcurrentCommitNotice(null), []);

	const [followUps, setFollowUps] = useState<Set<string>>(new Set());
	const [entityFilter, setEntityFilter] = useState<string>('');
	const [viewMode, setViewMode] = useState<ViewMode>('section');
	const [sectionFocusId, setSectionFocusId] = useState<number | null>(null);
	const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');
	const [entryKindFilter, setEntryKindFilter] = useState<EntryKindFilter>('all');
	const [termFilter, setTermFilter] = useState<'all' | number>('all');
	const [userOverrodeTermFilter, setUserOverrodeTermFilter] = useState(false);
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
	// One decode, two claims.
	const sessionClaims = decodeJwtPayload(getPreferredAccessToken() ?? '');
	const userRole = sessionClaims?.role ?? null;
	// A2-TIMETABLE-CUSTODY (#61) — the operator's own `userId` claim. This is the
	// same claim the server stamps onto the commit event as `actorId`
	// (`manual-edit.router.ts:247` takes `req.user?.userId`), so comparing the two
	// is an exact identity test in one id space — not a heuristic.
	const actorUserId = sessionClaims?.userId ?? null;
	const isPrivilegedUser = userRole != null && ['admin', 'officer', 'SYSTEM_ADMIN'].includes(userRole);
	const isDesktop = useIsDesktop();

	/* -- Generate / Publish workflow state -- */
	const [generating, setGenerating] = useState(false);
	const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
	/**
	 * A8-C5 S2.3 — the causes the Generate dialog explains, captured at the moment
	 * the operator clicked Generate by `handleTriggerGenerate`. It is dialog state,
	 * not a derivation of render state, because the click site is the only reader
	 * of the complete capability input (see `handleTriggerGenerate`).
	 */
	const [generationStoppers, setGenerationStoppers] = useState<TimetableGenerationStopper[]>([]);
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
	const publishedReturnState = usePublishedTimetableReturnState({
			centerView,
			isPublished: isDraftPublishedStrict(draft),
			runId: draft?.runId != null ? String(draft.runId) : selectedRunId,
			termFilter,
			viewMode,
			entityFilter,
	});
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
		/** A2 place-one-action — the term a fail-closed dialog commit was dropped into. */
		termIndex?: number | null;
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
	// LANE-C POST-PUBLISH-C01: the swap-picking prompts belong to swap mode only.
	// The 2026-09-25 audit saw "Class A selected…" survive Cancel, closing the
	// panel, and a route change to Manual Edit.
	useEffect(() => {
		if (swapClassTimesMode != null) return;
		setInlineActionStatus((current) => (current && SWAP_MODE_STATUS_MESSAGES.has(current.message) ? null : current));
	}, [swapClassTimesMode]);
	/** LANE-C C03 (B3) — one class being moved or re-roomed on a published run. */
	const [publishedEntryChange, setPublishedEntryChange] = useState<PublishedEntryChangeRequest | null>(null);
	const draftPublishedRef = useRef(false);
	draftPublishedRef.current = Boolean(draft) && isDraftPublishedStrict(draft);
	const [lastAutoSaveUndo, setLastAutoSaveUndo] = useState<{
		/** C11 — which ledger owns this Undo target (`draft` or run manual edits). */
		ledger: 'run' | 'draft';
		editId: number;
		newVersion: number;
		subjectLabel: string;
		day: string;
		startTime: string;
		endTime: string;
		roomLabel: string;
	} | null>(null);
	/**
	 * B1 — the inline preview-before-save for ordinary placement. A clean slot
	 * no longer commits on its own; it becomes this pending state until the
	 * operator presses the single Confirm (or Cancel). The room stays choosable
	 * inline, so no modal is needed to change it.
	 */
	const [inlinePlacementPending, setInlinePlacementPending] = useState<{
		proposal: ManualEditProposal;
		roomId: number | null;
		preview: InlinePlacementPreviewData;
	} | null>(null);
	const [inlinePlacementSaving, setInlinePlacementSaving] = useState(false);
	const [inlinePlacementRoomChanging, setInlinePlacementRoomChanging] = useState(false);
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

	const {
		enterPolicyView,
		exitPolicyView,
		enterManualEditView,
		exitManualEditView,
		switchCenterViewWithGuard,
		returnToGeneratedRun: returnToGeneratedRunBase,
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
		reviewEntryIds,
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
		effectiveTermFilter,
		schoolId,
		curriculumReadiness,
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
		sectionFocusId,
		viewMode,
		setViewMode,
		programFilter,
		entryKindFilter,
		termFilter,
		userOverrodeTermFilter,
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

	/**
	 * The re-read, held in a ref so the concurrent-commit subscription does not
	 * have to re-subscribe every time the data layer hands back a new closure.
	 */
	const handleRefreshRef = useRef(handleRefresh);
	handleRefreshRef.current = handleRefresh;

	/**
	 * A2-TIMETABLE-CUSTODY (#61) — anchor the armed Class A, in one place.
	 *
	 * The anchor is recorded only when a NEW class is armed. If the grid later
	 * re-reads and the same class sits somewhere else, the effect sees the same
	 * `entryId` and leaves the ORIGINAL anchor alone — so the guard below has a
	 * true "where it was when you picked it" to compare against, and a refresh
	 * cannot quietly re-anchor onto the new position.
	 */
	useEffect(() => {
		if (swapClassTimesMode !== 'select-second' || !swapClassAEntryId) {
			swapAnchorRef.current = null;
			return;
		}
		if (swapAnchorRef.current?.entryId === swapClassAEntryId) return;
		const entry = (gridEntries ?? []).find((candidate) => candidate.entryId === swapClassAEntryId);
		swapAnchorRef.current = entry
			? { entryId: entry.entryId, day: entry.day, startTime: entry.startTime, endTime: entry.endTime }
			: null;
	}, [swapClassTimesMode, swapClassAEntryId, gridEntries]);

	/** The live armed selection, read fresh — never a captured copy. */
	const readArmedSelection = useCallback((): ArmedSwapSelection => ({
		mode: swapClassTimesMode,
		entryIdA: swapClassAEntryId,
		entryIdB: swapClassBEntryId,
	}), [swapClassTimesMode, swapClassAEntryId, swapClassBEntryId]);

	/** Names a class the way the grid names it, for the concurrent-commit copy. */
	const resolveEntryLabel = useCallback((entryId: string): string | null => {
		const entry = (gridEntries ?? []).find((candidate) => candidate.entryId === entryId);
		if (!entry) return null;
		const subject = subjectLabel ? subjectLabel(entry.subjectId) : '';
		const section = sectionLabel ? sectionLabel(entry.sectionId) : '';
		const label = [subject, section].filter(Boolean).join(' · ');
		return label.length > 0 ? label : null;
	}, [gridEntries, subjectLabel, sectionLabel]);

	/** Apply a verdict to real state. Cancel releases the banner; keep is a no-op. */
	const applyArmedVerdict = useCallback((verdict: ReturnType<typeof evaluateArmedSwapSelection>) => {
		if (verdict.disposition !== 'cancel') return;
		setSwapClassTimesMode(verdict.armed.mode);
		setSwapClassAEntryId(verdict.armed.entryIdA);
		setSwapClassBEntryId(verdict.armed.entryIdB);
		swapAnchorRef.current = null;
		setInlineActionStatus({ tone: 'warning', message: verdict.messages[0] });
	}, []);

	/**
	 * A concurrent commit from another scheduler: name what changed, release a
	 * stale armed swap, and re-read the run so the grid stops being a lie.
	 *
	 * The re-read is what closes defect #2 (the grid changed underneath the
	 * operator with no acknowledgement). The notice deliberately does NOT claim
	 * the grid is already current — the read is in flight when it is written.
	 */
	useEffect(() => subscribeConcurrentCommitEvents((event) => {
		if (isOwnTimetableCommit(event, actorUserId)) return;
		const notice = describeConcurrentCommit(event, {
			entries: gridEntries ?? [],
			subjectLabel: (id) => (subjectLabel ? subjectLabel(id) : ''),
			sectionLabel: (id) => (sectionLabel ? sectionLabel(id) : ''),
			formatTime,
			actorId: actorUserId,
		});
		const verdict = evaluateArmedSwapSelection(readArmedSelection(), {
			entries: gridEntries ?? [],
			anchor: swapAnchorRef.current,
			movedEntryIds: readConflictingEntryIds(event),
			actorId: actorUserId,
			classLabel: resolveEntryLabel,
		});
		if (!notice) return;
		applyArmedVerdict(verdict);
		setConcurrentCommitNotice(
			verdict.messages.length > 0
				? { ...notice, notes: [...notice.notes, ...verdict.messages] }
				: notice,
		);
		void handleRefreshRef.current?.();
	}), [actorUserId, gridEntries, subjectLabel, sectionLabel, readArmedSelection, applyArmedVerdict, resolveEntryLabel]);

	// A1 — the verified ordered-term authority is one canonical predicate; the
	// policy/grade-window reads and the term filter both consume it.
	const activeTermContext = schoolYearContext?.activeTerm ?? null;
	const orderedTerms: OrderedAcademicTerm[] | null = activeTermContext?.orderedTerms ?? null;
	const orderedTermsKey = orderedTerms?.map((term) => `${term.identity}:${term.displayLabel}:${term.order}`).join('|') ?? '';
	const hasVerifiedTermAuthority = isVerifiedOrderedActiveTerm(activeTermContext);

	// Policy and grade-window reads use the same authenticated school scope as
	// the timetable data. Missing scope leaves the page in its bounded error state.
	// UX-R03c — this effect is the single owner of the scheduling-policy GET.
	useEffect(() => {
		if (!schoolId || !schoolYearId || !hasVerifiedTermAuthority) {
			setPolicy(null);
			setPolicyRecord(null);
			setGradeWindows([]);
			return;
		}
		// A-16: clear the previous scope's policy before refetch so a failed read
		// can never leave stale or permissive policy across school/year changes.
		// UX-R03c: the workspace-owned full record clears with the narrow value.
		setPolicyRecord(null);
		setPolicy(null);
		const fetchPolicyAndWindows = async () => {
			try {
				const [policyRes, windowsRes] = await Promise.all([
					atlasApi.get<{ policy: SchedulingPolicy }>(
						`/policies/scheduling/${schoolId}/${schoolYearId}`,
					),
					atlasApi.get<{ windows: Array<{ gradeLevel: number; programType?: string | null; startTime: string; endTime: string }> }>(
						`/generation/${schoolId}/${schoolYearId}/grade-windows`,
					).catch(() => ({ data: { windows: [] } })),
				]);
				setPolicy(policyRes.data.policy);
				setPolicyRecord(policyRes.data.policy);
				setGradeWindows(windowsRes.data.windows);
			} catch (err) {
				setPolicy(null);
				setPolicyRecord(null);
				setGradeWindows([]);
				console.error('Failed to fetch policy:', err);
			}
		};
		void fetchPolicyAndWindows();
	}, [policyRefreshToken, schoolId, schoolYearId, hasVerifiedTermAuthority, orderedTermsKey]);

	useEffect(() => {
		if (!isPreGenerationWorkspace || !schoolYearId || roomMap.size > 0) return;
		void fetchReferenceData(schoolYearId).catch((error) => {
			const message = error instanceof Error ? error.message : 'Reference data could not be loaded.';
			toast.error(`Room and owner references are still loading. ${message}`);
		});
	}, [fetchReferenceData, isPreGenerationWorkspace, roomMap.size, schoolYearId]);

	// The verified ordered EnrollPro term contract drives the term filter. A
	// missing or unverified contract is setup-required, not permission to guess
	// Term 1 (or to expose fabricated term options).
	const termOptions = useMemo(() => {
		if (hasVerifiedTermAuthority) return buildAcademicTermOptions(orderedTerms, activeTermContext?.termIndex ?? null);
		const fallback = effectiveTermFilter;
		if (typeof fallback !== 'number') return [{ value: 'all' as const, label: 'Term setup required' }];
		const activeOrderedTerm = activeTermContext?.orderedTerms?.find((term) => term.order === fallback);
		return [{ value: String(fallback), label: activeOrderedTerm?.displayLabel ?? `Term ${fallback}` }];
	}, [activeTermContext?.orderedTerms, activeTermContext?.termIndex, effectiveTermFilter, hasVerifiedTermAuthority, orderedTerms]);

	// Default term filter to active term when available (unless user manually overrode)
	useEffect(() => {
		if (userOverrodeTermFilter) return;
		const activeTermIndex = activeTermContext?.termIndex;
		const contractTerms = orderedTerms;
		const withinContract = activeTermIndex != null
			&& hasVerifiedTermAuthority
			&& Boolean(contractTerms?.some((term) => term.order === activeTermIndex));
		if (withinContract) {
			setTermFilter(activeTermIndex);
		}
	}, [activeTermContext?.termIndex, hasVerifiedTermAuthority, orderedTerms, userOverrodeTermFilter]);

	// Reset user override and repair an invalid selection when the school year or
	// the ordered contract changes; never dispatch a request for a term absent
	// from the current contract.
	useEffect(() => {
		setUserOverrodeTermFilter(false);
		setTermFilter((current) => hasVerifiedTermAuthority
			? repairTermFilter(current, orderedTerms)
			: 'all');
	}, [hasVerifiedTermAuthority, orderedTermsKey, schoolYearId]);

	const resetTermScopedUiRef = useRef<() => void>(() => {});
	// A2-C6-TRUTH (T1a): the run-scoped ledger re-read, bound after the
	// `useTimetableMutations` result exists. Same ref pattern as the reset above,
	// for the same declaration-order reason.
	const refillEditHistoryRef = useRef<() => void>(() => {});
	const handleTermFilterChange = useCallback((value: 'all' | number) => {
		const safeValue = hasVerifiedTermAuthority
			? value
			: (typeof effectiveTermFilter === 'number' ? effectiveTermFilter : null);
		if (safeValue == null) return;
		setUserOverrodeTermFilter(true);
		setTermFilter(safeValue);
		// TT-OUTPUT-C03R3: selecting another ordered term invalidates every
		// term-scoped actionable object from the previous term. Preserve the
		// generated run and the chosen layout (viewMode/presentationMode/entity
		// filter); clear selection, previews, assignment dialogs, swap state,
		// repair drawers, pending confirmations, inline action status, and the
		// term-scoped Undo affordance so a stale object can never dispatch.
		resetTermScopedUiRef.current();
		// A2-C6-TRUTH (T1a): the reset above does `setEditHistory([])`, and
		// `fetchEditHistory` is memoised on the RUN, so nothing refilled it —
		// the ledger stayed empty for the rest of the session and the menu
		// claimed a run with four recorded changes had none. The ledger is
		// RUN-scoped, so it is re-read here; the term-scoped Undo affordance the
		// reset deliberately clears is NOT resurrected.
		//
		// A ref, not the binding: `handleTermFilterChange` is declared above the
		// `useTimetableMutations` result, exactly like the reset it calls.
		refillEditHistoryRef.current();
	}, [effectiveTermFilter, hasVerifiedTermAuthority]);

	const focusSection = useCallback((sectionId: number) => {
		if (!Number.isFinite(sectionId)) return;
		setSectionFocusId(sectionId);
		setViewMode('section');
		setEntityFilter(String(sectionId));
	}, []);

	useEffect(() => {
		if (sectionFocusId == null || viewMode !== 'section' || !pivotEntityIds.includes(sectionFocusId)) return;
		setSectionFocusId(null);
	}, [pivotEntityIds, sectionFocusId, viewMode]);

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
		handleSessionContextPivot,
		handleEntryClick: handleEntrySelect,
		toggleFollowUp,
		triggerGeneration,
		handleTriggerGenerate: handleTriggerGenerateUnsafe,
		confirmGenerate,
		openPreGenerationWorkspace: openPreGenerationWorkspaceBase,
		handlePublishConfirm,
		runIdNumeric,
		runVersion,
		apiBase,
		fetchEditHistory,
		// A2-C6-TRUTH (T1b/T1c): the ledger read state, so a surface can tell a
		// run with no recorded changes from a read that failed.
		editHistoryReadState,
		previewEdit,
		commitEdit,
		commitEditWithMeta,
		previewTeachingLoadRepair,
		commitTeachingLoadRepair,
		revertLastEdit,
		revertEditById,
		revertDraftEditById,
		redoState,
		redoVersionStale,
		// A2-TIMETABLE-CUSTODY-R2 — the plain statement rendered when a revert left
		// nothing the server can redo, and the reason the header Undo is unavailable.
		undoNotice,
		undoBlockedReason,
		lastEditUndoable,
		redoLastEdit,
		clearRedo,
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
		commitRegularSwapNow,
		openRegularSwapPrompt,
		regularSwapPreview,
		regularSwapStrategy,
		setRegularSwapStrategy,
		unassignDraftPlacement,
		getDraggedDraftPlacementId,
		commitPreGenPending,
		swapPreview,
	} = useTimetableMutations({
		actorRole: userRole,
		schoolYearId,
		schoolYearContext,
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
		editHistory,
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
		// A2-C6-TRUTH (T4): the live run-wide figure, so the publish
		// acknowledgement gate and the header chip cannot disagree.
		violationReport,
		viewMode,
		entityFilter,
		facultyMap,
		roomMap,
		sectionMap,
		setPendingFacultyIssuePivot,
	});
	const openPreGenerationWorkspace = useCallback(async (resetExisting: boolean) => {
		if (draft && isDraftPublishedStrict(draft)) publishedReturnState.capture('schedule');
		await openPreGenerationWorkspaceBase(resetExisting);
	}, [draft, publishedReturnState.capture, openPreGenerationWorkspaceBase]);
	const handleStartNewPreGenerationDraft = useCallback(async () => {
		if (!schoolYearId) return;
		await openPreGenerationWorkspace(false);
	}, [schoolYearId, openPreGenerationWorkspace]);
	const returnToGeneratedRun = useCallback(() => {
		returnToGeneratedRunBase(() => {
			const restored = restorePublishedTimetableContext(publishedReturnState.snapshot, {
				setRunId: setSelectedRunId,
				setTermFilter,
				setViewMode,
				setEntityFilter,
			});
			if (!restored) return;
			publishedReturnState.clear();
			navigate('/timetable');
		});
	}, [returnToGeneratedRunBase, publishedReturnState.snapshot, publishedReturnState.clear, setViewMode, setEntityFilter, navigate]);
	const confirmFacultyIssuePivot = useCallback(() => {
		const pending = pendingFacultyIssuePivot;
		if (!pending) return;
		setViewMode('faculty');
		setEntityFilter(String(pending.facultyId));
		setSelectedViolation(pending.violation);
		setSelectedEntry(pending.entry);
		setKbSelectedSource(null);
		setPreGenKbSource(null);
		setPendingFacultyIssuePivot(null);
	}, [pendingFacultyIssuePivot, setViewMode, setEntityFilter, setSelectedViolation, setSelectedEntry, setKbSelectedSource, setPreGenKbSource]);

	/*
	 * A8-C5 S2.3 — CLICKING GENERATE ALWAYS REACHES THE DIALOG.
	 *
	 * This used to be a dead end: `if (curriculumReadiness.state !== 'ready') {
	 * toast.error(...); return; }` — so the moment S2.3 made the Generate control
	 * enabled in every state, every blocked year produced a TOAST and no dialog. The
	 * operator was told the button was clickable, clicked it, and was told nothing,
	 * with no way forward. The dialog is now the explanation, so this opens the
	 * dialog and lets it say why.
	 *
	 * `stoppers` is passed IN by the click site, because the headers are the only
	 * readers of the complete capability input (school-year drift lives in the
	 * rollover status each header already fetches).
	 *
	 * A8-C5 CORRECTION (2026-09-30): this hook used to derive a FALLBACK list here
	 * for a caller that passed nothing, and that list could not see drift — so a
	 * caller that forgot the argument silently lost the "school year out of sync"
	 * cause, one of the four the operator named, with nothing on screen saying the
	 * list was short. A partial list presented as complete is worse than no list, so
	 * the fallback is GONE. `resolveGenerateTrigger` now answers a caller with no
	 * stoppers with one honest cause that says not every reason could be checked,
	 * and this hook no longer computes a list it cannot complete.
	 */
	const handleTriggerGenerate = useCallback((stoppers?: TimetableGenerationStopper[]) => {
		const outcome = resolveGenerateTrigger({
			readinessState: curriculumReadiness.state,
			clickSiteStoppers: stoppers,
		});
		setGenerationStoppers(outcome.stoppers);
		// A8-C5 S2.3: a year that cannot generate OPENS THE DIALOG, which now names
		// every cause with a count and a fix button. It is not a toast, and it is not
		// a button that cannot be pressed.
		if (outcome.opensDialog) {
			setShowGenerateConfirm(true);
			return;
		}
		handleTriggerGenerateUnsafe();
	}, [curriculumReadiness, handleTriggerGenerateUnsafe]);

	// Wrap commitPreGenPending to capture operation ID/version for contextual Undo
	const wrappedCommitPreGenPending = useCallback(async () => {
		const result = await commitPreGenPending();
		if (result && preGenPending) {
			setLastAutoSaveUndo({
				// C11 — the draft commit authors the draft ledger, so Undo must
				// revert the draft ledger, not the run manual-edits ledger.
				ledger: 'draft',
				editId: result.operationId,
				newVersion: result.resultingVersion,
				subjectLabel: subjectLabel ? subjectLabel(preGenPending.subjectId) : 'Draft placement',
				day: preGenPending.day,
				startTime: preGenPending.startTime,
				endTime: preGenPending.endTime,
				roomLabel: preGenPending.roomId != null && roomMap.has(preGenPending.roomId)
					? `${roomMap.get(preGenPending.roomId)!.name} - ${roomMap.get(preGenPending.roomId)!.buildingShortCode || roomMap.get(preGenPending.roomId)!.buildingName}`
					: '',
			});
		}
	}, [commitPreGenPending, preGenPending, subjectLabel, roomMap, setLastAutoSaveUndo]);

	// C10 — the review-dialog commit (used to repair a blocked drop, e.g. by
	// choosing another room) must register the same contextual Undo the inline
	// anchor registers. Without this the placement saved through the dialog left
	// no Undo target, so it could not be reverted. The pre-await context is
	// captured because the commit clears it on success.
	const wrappedCommitConfirmPlacement = useCallback(async () => {
		const ctx = preGenConfirmCtx;
		const roomId = Number(confirmRoomId);
		const result = await commitConfirmPlacement();
		if (!result || !ctx) return;
		const draftSubjectId = ctx.source.type === 'draftQueue' ? ctx.source.item.subjectId : ctx.source.placement.subjectId;
		setLastAutoSaveUndo({
			// C11 — the dialog commits the same pre-generation draft ledger.
			ledger: 'draft',
			editId: result.operationId,
			newVersion: result.resultingVersion,
			subjectLabel: subjectLabel ? subjectLabel(draftSubjectId) : 'Draft placement',
			day: ctx.day,
			startTime: ctx.startTime,
			endTime: ctx.endTime,
			roomLabel: roomMap.has(roomId)
				? `${roomMap.get(roomId)!.name} - ${roomMap.get(roomId)!.buildingShortCode || roomMap.get(roomId)!.buildingName}`
				: '',
		});
	}, [commitConfirmPlacement, preGenConfirmCtx, confirmRoomId, subjectLabel, roomMap, setLastAutoSaveUndo]);

	/**
	 * A2 move-swap — ONE ACTION. The operator's second pick, or an accepted swap
	 * offer, commits here with no dialog commit button in between. The bounded
	 * preview+commit lives in `useTimetableMutations`; this registers the SAME
	 * contextual Undo the move path registers (ledger 'run', the commit's own edit
	 * id), so a mis-picked swap is one Undo away.
	 *
	 * On a refusal or an elapsed bound the mutations hook has already written
	 * plain words to the status, and this registers nothing — because nothing
	 * committed.
	 */
	const commitRegularSwapOneAction = useCallback(async (entryA: ScheduledEntry, entryB: ScheduledEntry) => {
		const outcome = await commitRegularSwapNow(entryA, entryB);
		if (!outcome.ok) return null;
		const { result } = outcome;
		const section = entryA.sectionId != null ? sectionMap.get(entryA.sectionId) : undefined;
		setLastAutoSaveUndo({
			ledger: 'run',
			editId: result.editId,
			newVersion: result.newVersion,
			subjectLabel: section?.name ?? (subjectLabel ? subjectLabel(entryA.subjectId) : 'Session'),
			day: String(entryB.day),
			startTime: String(entryB.startTime),
			endTime: String(entryB.endTime),
			roomLabel: entryB.roomId != null && roomMap.has(entryB.roomId)
				? `${roomMap.get(entryB.roomId)!.name} - ${roomMap.get(entryB.roomId)!.buildingShortCode || roomMap.get(entryB.roomId)!.buildingName}`
				: '',
		});
		return result;
	}, [commitRegularSwapNow, sectionMap, subjectLabel, roomMap, setLastAutoSaveUndo]);

	const handleEntryClick = useCallback((entry: ScheduledEntry) => {
		if (swapClassTimesMode != null && centerView === 'schedule') {
			// Explicit Swap class times mode: arm Class A first, then Class B.
			if (swapClassTimesMode === 'select-first') {
				setSwapClassAEntryId(entry.entryId);
				setSwapClassBEntryId(null);
				setSwapClassTimesMode('select-second');
				setSelectedEntry(null);
				setSelectedViolation(null);
				setInlineActionStatus({ tone: 'loading', message: SWAP_CLASS_A_SELECTED });
				return;
			}
			if (swapClassTimesMode === 'select-second') {
				// A2-TIMETABLE-CUSTODY (#61) — the USE-time re-check. The
				// concurrent-commit listener may never have fired (a change can
				// land through a refresh alone), and a re-render or a stale
				// closure must not be able to open a swap on a class that has
				// moved. This reads the LIVE grid and the arming anchor at click
				// time, so the answer is recomputed per click rather than
				// remembered from when the swap was armed.
				const staleCheck = evaluateArmedSwapSelection(
					{ mode: swapClassTimesMode, entryIdA: swapClassAEntryId, entryIdB: swapClassBEntryId },
					{
						entries: gridEntries ?? [],
						anchor: swapAnchorRef.current,
						movedEntryIds: [],
						actorId: actorUserId,
						classLabel: resolveEntryLabel,
					},
				);
				if (staleCheck.disposition === 'cancel') {
					applyArmedVerdict(staleCheck);
					return;
				}
				const classA = (gridEntries ?? []).find((candidate: ScheduledEntry) => candidate.entryId === swapClassAEntryId);
				if (!classA || classA.entryId === entry.entryId) {
					setInlineActionStatus({ tone: 'warning', message: SWAP_CLASS_B_SAME });
					return;
				}
				setSwapClassBEntryId(entry.entryId);
				captureReviewFocusReturn(timetableEntryFocusSelector(entry.entryId));
				// A2 move-swap — the pick IS the decision. A draft swap commits on this
				// one action (bounded, with receipt + Undo); only a PUBLISHED run keeps
				// the dated-revision dialog, because that flow is a different contract.
				if (draftPublishedRef.current) {
					openRegularSwapPrompt(classA, entry);
				} else {
					void commitRegularSwapOneAction(classA, entry);
				}
				setSwapClassTimesMode(null);
				setSwapClassAEntryId(null);
				setSwapClassBEntryId(null);
				return;
			}
		}
		// Ordinary browsing: a second occupied class opens details, never an implicit swap.
		handleEntrySelect(entry);
	}, [captureReviewFocusReturn, centerView, handleEntrySelect, openRegularSwapPrompt, commitRegularSwapOneAction, selectedEntry, setSelectedEntry, setSelectedViolation, swapClassTimesMode, swapClassAEntryId, swapClassBEntryId, gridEntries, setSwapClassTimesMode, setSwapClassAEntryId, setSwapClassBEntryId, setInlineActionStatus, applyArmedVerdict, actorUserId, resolveEntryLabel]);

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
		schoolId,
		schoolYearId,
		runId: runIdNumeric,
		selectedEntry,
		onTimetableEvent: handleCollaborativeTimetableEvent,
	});

	const openTacticalSandbox = useCallback(() => setTacticalSandboxOpen(true), [setTacticalSandboxOpen]);

	/**
	 * C1-c — the one canonical teaching-space list, shared by the placement
	 * room resolver and the inline room chooser. Previously each derived its own
	 * filter, so the chooser and the resolver could disagree about how many
	 * rooms were available.
	 */
	const teachingSpaces = useMemo(
		() => Array.from(roomMap.values()).filter((room) => room.isTeachingSpace),
		[roomMap],
	);

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

		// C1-c — with exactly one teaching space there is nothing to choose, so
		// that space IS the destination. Without this the screen said "Choose a
		// room first" while rendering no chooser at all, and Confirm stayed
		// disabled: an unfollowable instruction and a dead end. Two or more
		// spaces still require a real choice, and zero still fails closed.
		if (teachingSpaces.length === 1) return teachingSpaces[0].id;

		return null;
	}, [draft?.entries, entityFilter, roomMap, sectionMap, teachingSpaces, viewMode]);

	/** B1 — the inline room chooser's options (teaching spaces, grouped by building). */
	const inlinePlacementRoomOptions = useMemo(() => (
		teachingSpaces
			.slice()
			.sort((a, b) => {
				const buildingCompare = (a.buildingShortCode || a.buildingName || '').localeCompare(b.buildingShortCode || b.buildingName || '');
				if (buildingCompare !== 0) return buildingCompare;
				return a.name.localeCompare(b.name);
			})
			.map((room) => ({
				value: String(room.id),
				label: `${room.name} - ${room.buildingShortCode || room.buildingName}`,
			}))
	), [teachingSpaces]);

	/** B1 — one plain-language room label shared by the consequence and the chooser. */
	const roomDisplayLabel = useCallback((roomId: number | null): string | null => {
		if (roomId == null) return null;
		const room = roomMap.get(roomId);
		if (!room) return null;
		return `${room.name} - ${room.buildingShortCode || room.buildingName}`;
	}, [roomMap]);

	/**
	 * C1-c R1 — what the inline consequence is entitled to claim about teaching
	 * spaces, and the discriminator that makes the claim provable.
	 *
	 * `referenceLookupStatus.state` is the only thing on this path that can tell
	 * "the school configured none" from "ATLAS could not read them": it stays
	 * `loading` while the room map is empty — which is also the end state of the
	 * deliberately supported degraded read, where `runTimetableLoad` swallows a
	 * reference-data failure so the grid stays usable (`timetableLoadOrchestration`)
	 * — and it reaches `ready` only once all four reference maps are populated.
	 * A `needs-refresh` list is partial, so it is not enough to claim that no
	 * space exists either. The count is therefore attached on `ready` alone.
	 */
	const inlinePlacementTeachingSpaces = useMemo((): InlinePlacementTeachingSpaces => (
		referenceLookupStatus.state === 'ready'
			? { state: 'ready', count: inlinePlacementRoomOptions.length }
			: { state: 'unread' }
	), [inlinePlacementRoomOptions.length, referenceLookupStatus.state]);

	/** TT-C04: clear generated-run-scoped UI whenever the actor school, school
	 * year, or selected run changes. Collaboration resubscribes through its own
	 * schoolId/schoolYearId/runId keys; everything here is reset explicitly so
	 * stale selection, preview, inline status, undo, and dialogs can never
	 * present another scope's timetable as actionable. Draft-board ownership
	 * (preGenPending/preGenPreview) is year-scoped and cleared on
	 * school/year change only, so switching runs never discards draft work. */
	const resetRunScopedUi = useCallback(() => {
		setSelectedEntry(null);
		setSelectedViolation(null);
		setSelectedUnassignedForRepair(null);
		setPreviewResult(null);
		setAssignPickerTarget(null);
		setAssignPickerFacultyId('');
		setAssignPickerRoomId('');
		setAssignPickerPreview(null);
		setAssignPickerPreviewError(null);
		setShowAssignmentPicker(false);
		setInlineActionStatus(null);
		setLastAutoSaveUndo(null);
		setShowPublishDialog(false);
		setPublishAcknowledged(false);
		setShowSwapConfirm(false);
		setSwapAction(null);
		setShowSoftConfirm(false);
		setSoftConfirmWarnings([]);
		setPendingCommitProposal(null);
		setShowPreGenConfirm(false);
		setPreGenConfirmCtx(null);
		setConfirmPreview(null);
		setConfirmRawPreview(null);
		setConfirmPreviewError(null);
		setConfirmFacultyId('');
		setConfirmRoomId('');
		setConfirmAllowSoftOverride(false);
		setConfirmAllowDailyOverride(false);
		setShowUnassignConfirm(false);
		setPendingUnassignId(null);
		setShowGenerateConfirm(false);
		setShowResetDraftDialog(false);
		setShowLeavePreGenDialog(false);
		setPendingCenterSwitch(null);
		setTacticalSandboxOpen(false);
		setBlockerModalData(null);
		setDrawerViolation(null);
		setDrawerUnassigned(null);
		setSwapClassTimesMode(null);
		setSwapClassAEntryId(null);
		setSwapClassBEntryId(null);
		setDragItem(null);
		setPreGenKbSource(null);
		setKbSelectedSource(null);
		setFollowUps(new Set());
		setEditHistory([]);
		setShowEditHistory(false);
	}, []);

	// Bind the term-change reset to the run-scoped reset without creating a
	// use-before-declaration cycle; the callback only runs on user interaction.
	resetTermScopedUiRef.current = resetRunScopedUi;

	// A2-C6-TRUTH (T1a): same binding for the ledger re-read. Deliberately NOT
	// folded into `resetRunScopedUi`, which also runs on the actor school/year
	// transition — refilling there would put the PREVIOUS year's rows back on a
	// workspace that was just cleared precisely so they could not be actionable.
	refillEditHistoryRef.current = () => { void fetchEditHistory(); };

	const prevScopeRef = useRef<{ schoolId: number | null; schoolYearId: number | null }>({ schoolId: null, schoolYearId: null });

	/** TT-C04: actor school/year transitions rebind the whole workspace. Clear
	 * run-scoped UI plus year-scoped draft transients and re-pin run selection
	 * to latest so the previous scope can never linger as actionable state. */
	useEffect(() => {
		const prev = prevScopeRef.current;
		if (prev.schoolId === schoolId && prev.schoolYearId === schoolYearId) return;
		prevScopeRef.current = { schoolId, schoolYearId };
		resetRunScopedUi();
		setSelectedRunId('latest');
		setPreGenPending(null);
		setPreGenPreview(null);
		setPreGenPreviewError(null);
		setPreGenAllowSoftOverride(false);
	}, [schoolId, schoolYearId, resetRunScopedUi]);

	const handleRunChange = useCallback(async (runId: string) => {
		setSelectedRunId(runId);
		resetRunScopedUi();
		// A2-C6-TRUTH (T1d): same shape, same reason as the term change. The
		// `useEffect([fetchEditHistory])` refill only covers a run whose
		// `apiBase` actually CHANGES; re-selecting the run already on screen
		// left `apiBase` identical, so the reset's `setEditHistory([])` was
		// never undone and the ledger went empty for good.
		void fetchEditHistory();
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
	}, [schoolYearId, fetchRunData, resetRunScopedUi, fetchEditHistory]);

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
		// TT-OUTPUT-C03R3: the fast-path occupancy check is term-aware. Another
		// ordered term occupying the same slot is longitudinal repetition, not a
		// collision; only same-term (or unscoped) occupancy blocks this placement.
		const targetSlotOccupied = isTargetSlotOccupiedForTerm(draft?.entries ?? [], {
			day,
			startTime,
			endTime,
			termIndex: item.termIndex ?? null,
		});

		// B1 — every ordinary placement (clean, warned, or still needing a room)
		// now previews inline with one Confirm. Only a failed authoritative check
		// or an occupied slot falls through to the source-resolution dialog.
		const proposal: ManualEditProposal = {
			editType: 'PLACE_UNASSIGNED',
			sectionId: item.sectionId,
			subjectId: item.subjectId,
			session: item.session,
			// TT-OUTPUT-C03R3: keep the placement in the item's ordered term.
			termIndex: item.termIndex,
			entryKind: item.entryKind,
			cohortCode: item.cohortCode,
			targetDay: day,
			targetStartTime: startTime,
			targetEndTime: endTime,
			targetFacultyId: item.facultyId,
			targetRoomId: defaultRoomId ?? undefined,
		};
		const basePreviewInput = {
			subjectLabel: subjectLabel ? subjectLabel(item.subjectId) : 'Session',
			sectionLabel: sectionLabel ? sectionLabel(item.sectionId) : 'Section',
			session: item.session,
			day,
			startTime,
			endTime,
			// C1-c — the chooser renders only above one option, so the
			// consequence needs the same list to avoid naming an action the
			// screen does not offer, and R1 needs its provenance so the copy
			// never claims a space does not exist on an unread reference read.
			availableTeachingSpaces: inlinePlacementTeachingSpaces,
		};
		if (!targetSlotOccupied) {
			setDragItem(null);
			if (defaultRoomId == null) {
				// No room resolved: the inline chooser carries the honest consequence
				// and picking a room re-runs the authoritative preview below.
				setInlineActionStatus(null);
				setInlinePlacementPending({
					proposal,
					roomId: null,
					preview: buildInlinePlacementPreviewData({
						...basePreviewInput,
						roomLabel: null,
						softCount: 0,
						hardTitle: null,
					}),
				});
				return;
			}
			setInlineActionStatus({
				tone: 'loading',
				message: 'Checking placement before saving…',
			});
			const preview = await previewEdit(proposal);
			const decision = decideAutoSavePlacement({
				hasFacultyOwner: item.facultyId != null,
				resolvedRoomId: defaultRoomId,
				targetSlotOccupied,
				preview: preview
					? { allowed: preview.allowed, hardViolations: preview.hardViolations, softViolations: preview.softViolations }
					: null,
			});
			if (decision.kind === 'preview-confirm' || decision.kind === 'review-soft') {
				// B1 — a clean slot no longer commits on its own. The consequence is
				// stated in the inline preview and only the single Confirm commits it.
				// A soft-warned slot uses the same inline path, so no modal opens per
				// placement; the warning count is carried into the consequence.
				setInlineActionStatus(null);
				setInlinePlacementPending({
					proposal,
					roomId: defaultRoomId,
					preview: buildInlinePlacementPreviewData({
						...basePreviewInput,
						roomLabel: roomDisplayLabel(defaultRoomId),
						softCount: decision.softCount,
						hardTitle: null,
					}),
				});
				return;
			}
		if (decision.kind === 'review-blocked') {
			/* A2 mc R2, item 8 — PLACE SESSION SAYS SOMETHING.
			 *
			 * The recorded defect: placing an unplaced class offered no candidate and
			 * no words, and the one message that did exist named a CATEGORY
			 * (`Teacher double-booked`) instead of the teacher. The packet's words are
			 * `No free time: every time double-books <teacher> or <room>`.
			 *
			 * So the sentence is composed from the item's OWN resolved teacher and
			 * room — never an id — and then names the first obstruction in the words
			 * `buildHumanConflicts` already produced, put through the ONE scrubber
			 * (`plainConflictDetail`) the preview path uses. No new vocabulary and no
			 * second scrubber. */
			const room = defaultRoomId != null && roomMap.has(defaultRoomId) ? roomMap.get(defaultRoomId) : undefined;
			const teacher = item.facultyId != null ? facultyLabel(item.facultyId) : 'a teacher who is not assigned yet';
			const roomPart = room ? room.name : 'a room';
			const obstruction = preview?.humanConflicts.find((hc) => hc.severity === 'HARD');
			const detail = obstruction ? plainConflictDetail(obstruction.code, obstruction.humanDetail) : '';
			setInlineActionStatus({
				tone: 'error',
				message: detail
					? `No free time: this slot double-books ${teacher} or ${roomPart}. ${detail}`
					: `No free time: this slot double-books ${teacher} or ${roomPart}.`,
			});
			return;
		}
			setInlineActionStatus(null);
		}

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
		previewEdit,
		commitEdit,
		commitEditWithMeta,
		subjectLabel,
		sectionLabel,
		roomDisplayLabel,
		roomMap,
		// C1-c/R1 — the consequence text reads the same canonical list the chooser
		// renders from, with the read provenance that makes its claim provable, so
		// a stale list can never contradict the rendered control.
		inlinePlacementTeachingSpaces,
		toast,
	]);

	/** B1 — the single Confirm that commits the inline pending placement. */
	const confirmInlinePlacement = useCallback(async () => {
		const pending = inlinePlacementPending;
		if (!pending) return;
		setInlinePlacementSaving(true);
		try {
			const commitResult = await commitEditWithMeta(
				pending.proposal,
				// A warned destination is confirmed with its soft warnings acknowledged.
				pending.preview.softCount > 0,
			);
			if (!commitResult) {
				setInlineActionStatus({ tone: 'error', message: 'Placement was not saved. Review the error and try again.' });
				return;
			}
			const { preview } = pending;
			setLastAutoSaveUndo({
				// C11 — a genuine run manual edit keeps the run manual-edits revert.
				ledger: 'run',
				editId: commitResult.editId,
				newVersion: commitResult.newVersion,
				subjectLabel: preview.subjectLabel,
				day: preview.day,
				startTime: preview.startTime,
				endTime: preview.endTime,
				roomLabel: preview.roomLabel ?? 'Room saved',
			});
		/* A2 mc S5 — the PLACE path speaks the SAME receipt as move and swap. It
		 * previously built its own sentence from raw `preview.day`/`startTime` and,
		 * on a soft run, printed a count rather than a sentence. */
		const placeReceipt = buildEditReceipt({
			editType: pending.proposal.editType,
			classLabel: receiptClassLabel({
				subjectLabel: preview.subjectLabel,
				sectionLabel: preview.sectionLabel,
			}),
			from: null,
			to: { day: String(preview.day), startTime: String(preview.startTime) },
			problems: {
				now: commitResult.violationDelta.hardAfter + commitResult.violationDelta.softAfter,
				before: commitResult.violationDelta.hardBefore + commitResult.violationDelta.softBefore,
			},
		});
		setInlineActionStatus({
			tone: placeReceipt.tone,
			message: `${placeReceipt.sentence} Undo below.`,
		});
			setInlinePlacementPending(null);
		} finally {
			setInlinePlacementSaving(false);
		}
	}, [inlinePlacementPending, commitEditWithMeta, setInlineActionStatus, setLastAutoSaveUndo]);

	/** B1 — discard the inline preview without saving anything. */
	const cancelInlinePlacement = useCallback(() => {
		setInlinePlacementPending(null);
		setInlineActionStatus(null);
	}, [setInlineActionStatus]);

	/**
	 * B1 — choose a different room without a modal. The authoritative preview is
	 * re-run for the new room before the Confirm stays enabled, so the stated
	 * consequence always matches the room that would actually be saved.
	 */
	const changeInlinePlacementRoom = useCallback(async (roomIdValue: string) => {
		const pending = inlinePlacementPending;
		const roomId = Number(roomIdValue);
		if (!pending || !Number.isFinite(roomId) || roomId <= 0) return;
		const nextProposal: ManualEditProposal = { ...pending.proposal, targetRoomId: roomId };
		setInlinePlacementRoomChanging(true);
		setInlineActionStatus(null);
		try {
			const preview = await previewEdit(nextProposal);
			const roomLabel = roomDisplayLabel(roomId);
			const nextInput = {
				subjectLabel: pending.preview.subjectLabel,
				sectionLabel: pending.preview.sectionLabel,
				session: pending.preview.session,
				day: pending.preview.day,
				startTime: pending.preview.startTime,
				endTime: pending.preview.endTime,
				roomLabel,
				// C1-c — the chooser is reachable from this state, so the list
				// is re-derived from the same canonical teaching-space source,
				// carrying the same read provenance (R1).
				availableTeachingSpaces: inlinePlacementTeachingSpaces,
			};
			if (!preview) {
				setInlinePlacementPending({
					proposal: nextProposal,
					roomId,
					preview: buildInlinePlacementPreviewData({
						...nextInput,
						softCount: 0,
						hardTitle: 'ATLAS could not check this room yet. Try again or pick another room.',
					}),
				});
				return;
			}
			const blockedTitle = preview.allowed
				? null
				: preview.humanConflicts.find((conflict) => conflict.severity === 'HARD')?.humanTitle ?? 'This room blocks the placement.';
			setInlinePlacementPending({
				proposal: nextProposal,
				roomId,
				preview: buildInlinePlacementPreviewData({
					...nextInput,
					softCount: blockedTitle ? 0 : preview.softViolations.length,
					hardTitle: blockedTitle,
				}),
			});
		} finally {
			setInlinePlacementRoomChanging(false);
		}
	}, [inlinePlacementPending, previewEdit, roomDisplayLabel, setInlineActionStatus, inlinePlacementTeachingSpaces]);

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
			// TT-OUTPUT-C03R3: keep the placement in the item's ordered term.
			termIndex: item.termIndex,
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
			// TT-OUTPUT-C03R3: keep the placement in the item's ordered term.
			termIndex: item.termIndex,
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
			const commitResult = await commitEditWithMeta(proposal, scopedPreview.softViolations.length > 0);
			if (!commitResult) {
				setInlineActionStatus({ tone: 'error', message: 'Placement was not saved. Review the error message and try again.' });
				return;
			}
			setLastAutoSaveUndo({
				// C11 — a genuine run manual edit keeps the run manual-edits revert.
				ledger: 'run',
				editId: commitResult.editId,
				newVersion: commitResult.newVersion,
				subjectLabel: subjectLabel ? subjectLabel(item.subjectId) : `Session ${item.session}`,
				day,
				startTime,
				endTime,
				roomLabel: roomMap.has(targetRoomId)
					? `${roomMap.get(targetRoomId)!.name} - ${roomMap.get(targetRoomId)!.buildingShortCode || roomMap.get(targetRoomId)!.buildingName}`
					: 'Room saved',
			});
			setInlineActionStatus({
				tone: scopedPreview.softViolations.length > 0 ? 'warning' : 'success',
				message: scopedPreview.softViolations.length > 0
					? `Placement applied with ${scopedPreview.softViolations.length} soft warning(s).`
					: `Saved ${subjectLabel ? subjectLabel(item.subjectId) : 'session'} to ${day} ${startTime}–${endTime}. Undo below.`,
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
		commitEditWithMeta,
		runGeneratedPlacementPreview,
		setKbSelectedSource,
		subjectLabel,
		roomMap,
		setLastAutoSaveUndo,
		toast,
	]);

	/** Handle drop of item onto a timetable cell */
	// A2 place-one-action — the ONE drag/keyboard entry to a pre-generation drop.
	// `stagePreGenDrop` now COMMITS a clean or soft-warned drop itself; this wrapper
	// registers the existing contextual Undo from the operation identity it returns
	// and carries the term the operator is viewing, so the placement is persisted
	// and filtered into that term. A fail-closed drop returns `null` and keeps its
	// single recovery surface.
	const runPreGenDrop = useCallback(async (
		source: PreGenDragSource,
		day: string,
		startTime: string,
		endTime: string,
	) => {
		const outcome = await stagePreGenDrop(source, day, startTime, endTime, {
			termIndex: typeof effectiveTermFilter === 'number' ? effectiveTermFilter : null,
		});
		if (!outcome) return;
		const { result, pending } = outcome;
		setLastAutoSaveUndo({
			// C11 — the draft commit authors the draft ledger, so Undo must revert
			// the draft ledger, not the run manual-edits ledger.
			ledger: 'draft',
			editId: result.operationId,
			newVersion: result.resultingVersion,
			subjectLabel: subjectLabel ? subjectLabel(pending.subjectId) : 'Draft placement',
			day: pending.day,
			startTime: pending.startTime,
			endTime: pending.endTime,
			roomLabel: pending.roomId != null && roomMap.has(pending.roomId)
				? `${roomMap.get(pending.roomId)!.name} - ${roomMap.get(pending.roomId)!.buildingShortCode || roomMap.get(pending.roomId)!.buildingName}`
				: '',
		});
	}, [stagePreGenDrop, effectiveTermFilter, setLastAutoSaveUndo, subjectLabel, roomMap]);

	const handleCellDrop = useCallback(
		async (day: string, startTime: string, endTime: string, dragSource?: DragSource) => {
			const activeDragItem = dragSource ?? dragItem;
			if (!activeDragItem) return;

			if (activeDragItem.type === 'draftPlacement') {
				if (isSameTimetableSlot(activeDragItem.placement, { day, startTime, endTime })) {
					setDragItem(null);
					setInlineActionStatus({ tone: 'success', message: 'Session is already in this slot.' });
					return;
				}
				captureReviewFocusReturn(timetableCellFocusSelector(day, startTime, endTime));
				await runPreGenDrop(activeDragItem, day, startTime, endTime);
				setDragItem(null);
				return;
			}

			if (activeDragItem.type === 'draftQueue') {
				captureReviewFocusReturn(timetableCellFocusSelector(day, startTime, endTime));
				await runPreGenDrop(activeDragItem, day, startTime, endTime);
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
					if (isSameTimetableSlot(placement, { day, startTime, endTime })) {
						setDragItem(null);
						setInlineActionStatus({ tone: 'success', message: 'Session is already in this slot.' });
						return;
					}
					captureReviewFocusReturn(timetableCellFocusSelector(day, startTime, endTime));
					await runPreGenDrop({ type: 'draftPlacement', placement }, day, startTime, endTime);
					setDragItem(null);
					return;
				}
				toast.error('Swap-safe draft placement could not be resolved. Refresh the pre-generation workspace and retry.');
				setDragItem(null);
				return;
			}
			const entry = activeDragItem.entry;
			if (isSameTimetableSlot(entry, { day, startTime, endTime })) {
				setDragItem(null);
				setInlineActionStatus({ tone: 'success', message: 'Session is already in this slot.' });
				return;
			}
			const slotEntries = (draft?.entries ?? []).filter((candidate: ScheduledEntry) => (
				candidate.day === day
				&& candidate.startTime === startTime
				&& candidate.endTime === endTime
			));
			const swapCandidate = findRegularSwapCandidate(entry, slotEntries);
			if (swapCandidate) {
				captureReviewFocusReturn(timetableEntryFocusSelector(swapCandidate.entryId));
				// A2 move-swap — the drop IS the decision on a draft run: the swap
				// commits on this one action. A published run keeps the dated-revision
				// dialog.
				if (draftPublishedRef.current) {
					setInlineActionStatus({ tone: 'warning', message: 'Review swap before saving. This occupied slot will exchange the two sessions.' });
					openRegularSwapPrompt(entry, swapCandidate);
				} else {
					void commitRegularSwapOneAction(entry, swapCandidate);
				}
				setDragItem(null);
				return;
			}
			// LANE-C C03 (B3) — dragging a class on a published run schedules a
			// dated change instead of calling the refused direct edit.
			if (draftPublishedRef.current) {
				setDragItem(null);
				setInlineActionStatus(null);
				setPublishedEntryChange({ entry, target: { day, startTime, endTime }, mode: 'move' });
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
			const commitResult = await commitEditWithMeta(proposal, scopedPreview.softViolations.length > 0);
			if (!commitResult) {
				setInlineActionStatus({ tone: 'error', message: 'Move was not saved. Review the error message and try again.' });
				return;
			}
			setLastAutoSaveUndo({
				// C11 — a genuine run manual edit keeps the run manual-edits revert.
				ledger: 'run',
				editId: commitResult.editId,
				newVersion: commitResult.newVersion,
				subjectLabel: proposal.subjectId != null ? subjectLabel(proposal.subjectId) : 'Session',
				day: proposal.targetDay ?? '',
				startTime: proposal.targetStartTime ?? '',
				endTime: proposal.targetEndTime ?? '',
				roomLabel: proposal.targetRoomId != null && roomMap.has(proposal.targetRoomId)
					? `${roomMap.get(proposal.targetRoomId)!.name} - ${roomMap.get(proposal.targetRoomId)!.buildingShortCode || roomMap.get(proposal.targetRoomId)!.buildingName}`
					: '',
			});
		/* A2 mc S5 — the ONE receipt derivation (`lib/timetable-edit-receipt.ts`),
		 * derived from the COMMITTED delta, never the optimistic proposal. Replaces
		 * `Moved to MONDAY 07:00–08:00. Undo below.` / `Move applied with N soft
		 * warning(s).`, which named neither the class nor where it came from. */
		const moveReceipt = buildEditReceipt({
			editType: proposal.editType,
			classLabel: receiptClassLabel({
				subjectLabel: subjectLabel ? subjectLabel(entry.subjectId) : null,
				sectionLabel: sectionLabel ? sectionLabel(entry.sectionId) : null,
			}),
			from: { day: String(entry.day), startTime: String(entry.startTime) },
			to: { day: String(proposal.targetDay ?? ''), startTime: String(proposal.targetStartTime ?? '') },
			problems: {
				now: commitResult.violationDelta.hardAfter + commitResult.violationDelta.softAfter,
				before: commitResult.violationDelta.hardBefore + commitResult.violationDelta.softBefore,
				/* A2 mc R2 (B2) - the DETAIL, not the TITLE. humanTitle for a teacher
				 * conflict is the category (Teacher double-booked); the packet's own
				 * example sentence is Mr Cruz already teaches 8-Luna at that time.,
				 * which is humanDetail, and uildHumanConflicts already produces it.
				 * It goes through the ONE scrubber the preview path uses, so no engine
				 * token can reach a receipt either. */
					firstNewSentence: receiptProblemSentence(scopedPreview.humanConflicts),
			},
		});
		setInlineActionStatus({
			tone: moveReceipt.tone,
			message: `${moveReceipt.sentence} Undo below.`,
		});
	},
		[captureReviewFocusReturn, dragItem, previewEdit, commitEditWithMeta, runPreGenDrop, centerView, draftBoard?.placements, draft?.entries, openRegularSwapPrompt, commitRegularSwapOneAction, placeGeneratedUnassigned, subjectLabel, sectionLabel, roomMap, setLastAutoSaveUndo],
	);

	/** Keyboard-accessible placement confirm */
	const handleKbPlace = useCallback(
		async (day: string, startTime: string, endTime: string) => {
			const activeKbSource = kbSelectedSource ?? (centerView === 'pre-generation' ? preGenKbSource : null);
			if (!activeKbSource) return;
			const fakeItem = activeKbSource;

			if (fakeItem.type === 'draftPlacement') {
				if (isSameTimetableSlot(fakeItem.placement, { day, startTime, endTime })) {
					setInlineActionStatus({ tone: 'success', message: 'Already in this slot. Choose another highlighted slot or cancel.' });
					return;
				}
				captureReviewFocusReturn(timetableCellFocusSelector(day, startTime, endTime));
				await runPreGenDrop(fakeItem, day, startTime, endTime);
				return;
			}

			if (fakeItem.type === 'draftQueue') {
				captureReviewFocusReturn(timetableCellFocusSelector(day, startTime, endTime));
				await runPreGenDrop(fakeItem, day, startTime, endTime);
				return;
			}

			if (fakeItem.type === 'entry' && centerView === 'pre-generation') {
				const placement = resolveDraftPlacementFromEntry(fakeItem.entry, draftBoard?.placements ?? []);
				if (placement) {
					if (isSameTimetableSlot(placement, { day, startTime, endTime })) {
						setInlineActionStatus({ tone: 'success', message: 'Already in this slot. Choose another highlighted slot or cancel.' });
						return;
					}
					captureReviewFocusReturn(timetableCellFocusSelector(day, startTime, endTime));
					await runPreGenDrop({ type: 'draftPlacement', placement }, day, startTime, endTime);
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
				if (isSameTimetableSlot(fakeItem.entry, { day, startTime, endTime })) {
					setInlineActionStatus({ tone: 'success', message: 'Already in this slot. Choose another highlighted slot or cancel.' });
					return;
				}
				flushSync(() => {
					setInlineActionStatus({ tone: 'loading', message: 'Moving this class…' });
				});
				const slotEntries = (draft?.entries ?? []).filter((candidate: ScheduledEntry) => (
					candidate.day === day
					&& candidate.startTime === startTime
					&& candidate.endTime === endTime
				));
				const swapCandidate = findRegularSwapCandidate(fakeItem.entry, slotEntries);
				if (swapCandidate) {
					captureReviewFocusReturn(timetableEntryFocusSelector(swapCandidate.entryId));
					// A2 move-swap — the pick IS the decision on a draft run. Published
					// runs keep the dated-revision dialog.
					if (draftPublishedRef.current) {
						setInlineActionStatus({ tone: 'warning', message: 'Review swap before saving. This occupied slot will exchange the two sessions.' });
						openRegularSwapPrompt(fakeItem.entry, swapCandidate);
					} else {
						void commitRegularSwapOneAction(fakeItem.entry, swapCandidate);
					}
					return;
				}
				// LANE-C C03 (B3) — a published run refuses direct edits; the move
				// becomes a dated change, checked before it is scheduled.
				if (draftPublishedRef.current) {
					setInlineActionStatus(null);
					setKbSelectedSource(null);
					setPublishedEntryChange({ entry: fakeItem.entry, target: { day, startTime, endTime }, mode: 'move' });
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
			const commitResult = await commitEditWithMeta(proposal, scopedPreview.softViolations.length > 0);
			if (!commitResult) {
				setInlineActionStatus({ tone: 'error', message: 'Move was not saved. Review the error message and try again.' });
				return;
			}
			setLastAutoSaveUndo({
				// C11 — a genuine run manual edit keeps the run manual-edits revert.
				ledger: 'run',
				editId: commitResult.editId,
				newVersion: commitResult.newVersion,
				subjectLabel: proposal.subjectId != null ? subjectLabel(proposal.subjectId) : 'Session',
				day: proposal.targetDay ?? '',
				startTime: proposal.targetStartTime ?? '',
				endTime: proposal.targetEndTime ?? '',
				roomLabel: proposal.targetRoomId != null && roomMap.has(proposal.targetRoomId)
					? `${roomMap.get(proposal.targetRoomId)!.name} - ${roomMap.get(proposal.targetRoomId)!.buildingShortCode || roomMap.get(proposal.targetRoomId)!.buildingName}`
					: '',
			});
		/* A2 mc S5 — the SAME derivation as the drag path above. Two move entry
		 * points produced two sentences before this slice; they now produce one. */
		const kbReceipt = buildEditReceipt({
			editType: proposal.editType,
			classLabel: receiptClassLabel({
				subjectLabel: subjectLabel ? subjectLabel(fakeItem.entry.subjectId) : null,
				sectionLabel: sectionLabel ? sectionLabel(fakeItem.entry.sectionId) : null,
			}),
			from: { day: String(fakeItem.entry.day), startTime: String(fakeItem.entry.startTime) },
			to: { day: String(proposal.targetDay ?? ''), startTime: String(proposal.targetStartTime ?? '') },
			problems: {
				now: commitResult.violationDelta.hardAfter + commitResult.violationDelta.softAfter,
				before: commitResult.violationDelta.hardBefore + commitResult.violationDelta.softBefore,
				/* A2 mc R2 (B2) - the DETAIL, not the TITLE. humanTitle for a teacher
				 * conflict is the category (Teacher double-booked); the packet's own
				 * example sentence is Mr Cruz already teaches 8-Luna at that time.,
				 * which is humanDetail, and uildHumanConflicts already produces it.
				 * It goes through the ONE scrubber the preview path uses, so no engine
				 * token can reach a receipt either. */
					firstNewSentence: receiptProblemSentence(scopedPreview.humanConflicts),
			},
		});
		setInlineActionStatus({
			tone: kbReceipt.tone,
			message: `${kbReceipt.sentence} Undo below.`,
		});
		setKbSelectedSource(null);
	},
		[captureReviewFocusReturn, kbSelectedSource, preGenKbSource, previewEdit, commitEditWithMeta, runPreGenDrop, centerView, draftBoard?.placements, draft?.entries, openRegularSwapPrompt, commitRegularSwapOneAction, placeGeneratedUnassigned, subjectLabel, sectionLabel, roomMap, setLastAutoSaveUndo],
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
		onSessionContextPivot: handleSessionContextPivot,
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
	// R1 (CP-1): the publish gate and soft-acknowledgement contract consume the
	// run-wide summary truth. The interactive `violations` array stays
	// selected-term scoped for display only (ordered-term invariant 5).
	// A2-C6-TRUTH (T4): the violation report for THIS run is the live
	// run-wide recomputation; `summary` is the run row's stored copy. Passing
	// the report makes the header figure the number the run actually stores
	// instead of a snapshot that can lag it.
	const runWideReadiness = deriveRunWideReadiness(summary, violations, violationReport?.counts?.runWide ?? null);
	const hardCount = runWideReadiness.hardCount;
	const blockingHardCount = runWideReadiness.blockingHardCount;
	const softCount = runWideReadiness.softCount;
	const selectedMapBuilding = buildings.find((b) => b.id === mapBuildingId) ?? null;
	const selectedMapBuildingFloors = useMemo(() => {
		return selectedMapBuilding ? Array.from({ length: selectedMapBuilding.floorCount }, (_, i) => selectedMapBuilding.floorCount - i) : [];
	}, [selectedMapBuilding]);

	const gridKbSelectedSource = kbSelectedSource ?? (centerView === 'pre-generation' ? preGenKbSource : null);
	const handleKbPlaceStart = useCallback(() => {
		flushSync(() => {
			setInlineActionStatus({ tone: 'loading', message: 'Moving this class…' });
		});
	}, []);

	// Context-aware window warning: only warn when rows are actually hidden
	const policyAlignmentWarning = useMemo(() => {
		if (showFullDay) return null;
		if (hiddenRowCount <= 0) return null;

		const selectedId = Number(entityFilter);
		if (!selectedId) return null;
		// Teacher/Room view: no single window; skip.
		if (viewMode !== 'section') return null;

		const section = sectionMap.get(selectedId);
		if (!section) return null;
		const gradeNumber = resolveSectionGradeNumber(section);
		if (gradeNumber == null) return null;

		// A-16: a failed/unavailable policy read must not suppress the warning.
		if (!policy?.earliestStartTime || gradeWindows.length === 0) {
			return `${hiddenRowCount} earlier row${hiddenRowCount === 1 ? '' : 's'} hidden. The scheduling policy could not be loaded, so the school day window is unconfirmed. Review the scheduling policy, or use Show full day.`;
		}

		const matchingWindow = findGradeWindow(gradeNumber, section.programType, gradeWindows);
		if (!matchingWindow) return null;
		const windowLabel = `this section's grade/program window (${matchingWindow.startTime})`;

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
		if (!schoolId) return {};
		// C07B/B2 — the interactive `violations` array is selected-term scoped.
		// Label that scope explicitly instead of letting it read as run-wide.
		const violationScopeLabel = typeof effectiveTermFilter === 'number'
			? (termOptions.find((option) => String(option.value) === String(effectiveTermFilter))?.label ?? `Term ${effectiveTermFilter}`)
			: 'All terms';
		const leftRailContentContext = buildLeftRailContext({ schoolId, leftTab, isPreGenerationWorkspace, hardViolationCount, runWideBlockingHardCount: blockingHardCount, violationScopeLabel, topBlockers, violations, handleViolationSelect, setSeverityFilter, severityFilter, VIOLATION_LABELS, violationSearch, setViolationSearch, filteredViolations, violationsByCode, violationsGroupPage, setViolationsGroupPage, selectedViolation, setDrawerViolation, formatConstraintMessage, draftBoard, isDesktop, setDragItem, toast, summary, filteredUnassignedItems, programKindFilteredUnassignedItems, unassignedPageSize, setUnassignedPageSize, unassignedReasonFilter, setUnassignedReasonFilter, resolveEntryProgramType, resolveEntryProgramCode, sectionLabel, subjectLabel, kbSelectedSource, followUps, expandedUnassigned, setExpandedUnassigned, unassignedFixSuggestions, fixLoading, schoolYearId, runs, selectedRunId, setFixLoading, setUnassignedFixSuggestions, entryContextLabel, previewEdit, setDrawerUnassigned, setFollowUps, showSoftConfirm, unassignDropActive, setUnassignDropActive, pinnedRailDropActive, fetchDraftBoardSummary, preGenPending, pinsSearch, setPinsSearch, pinsGradeFilter, setPinsGradeFilter, pinsSectionFilter, setPinsSectionFilter, pinsSubjectFilter, setPinsSubjectFilter, getDraggedDraftPlacementId, setPendingUnassignId, setShowUnassignConfirm, pinsQueuePage, setPinsQueuePage, preGenKbSource, setPreGenKbSource, setKbSelectedSource, leftPanelRef, rightPanelRef, selectedEntry, setSelectedEntry, selectedUnassignedForRepair, setSelectedUnassignedForRepair, setSelectedViolation, preGenEntries, gradeForSection, formatFacultyInitials, roomLabelShort, roomMap, roomRequestSummary, requestSearch, setRequestSearch, requestStatusFilter, setRequestStatusFilter, requestDecisionFilter, setRequestDecisionFilter, roomRequestError, roomRequestLoading, filteredRoomRequests, selectedRequestId, focusRequestInGrid, openRequestPreview, isPrivilegedUser, focusPinnedPlacement, openTacticalSandbox, viewMode, setViewMode, entityFilter, setEntityFilter, focusSection });
		const centerWorkspaceContext = buildCenterWorkspaceContext({ schoolId, centerView, selectedEntry, selectedUnassigned: selectedUnassignedForRepair, setSelectedUnassigned: setSelectedUnassignedForRepair, violationIndex, followUps, toggleFollowUp, exitPolicyView, handleRefresh, policyRecord, policyRefreshToken, refreshPolicy, schoolYearId, pendingAction, roomMap, facultyMap, subjectMap, draft, previewEdit, commitEdit, previewTeachingLoadRepair, commitTeachingLoadRepair, previewLoading, commitLoading, subjectLabel, facultyLabel, sectionLabel, gradeForSection, roomLabel, isStaleRoom, timeSlots: displayTimeSlots, preGenOnboarding, setCenterView, buildings, mapBuildingId, setMapBuildingId, openBuildingWorkspace, selectedMapBuilding, selectedMapBuildingFloors, mapRoomId, openRoomGridWorkspace, presentationMode, draftBoard, runs, generating, newDraftLoading, handleStartNewPreGenerationDraft, handleTriggerGenerate, entityFilter, pivotLabel, viewMode, termFilter, termOptions, reviewEntryIds, setPreGenOnboarding, gridEntries, highlightedEntryIds, swapClassAEntryId, swapClassBEntryId, handleEntryClick, entryContextLabel, formatFacultyInitials, roomLabelShort, kbSelectedSource: gridKbSelectedSource, handleKbPlace, handleKbPlaceStart, getCellConflict, getLiveCellConflict, navToFaculty, navToSection, navToRoom, tacticalSandboxOpen, setTacticalSandboxOpen, preGenPending, preGenPreviewLoading, preGenPreviewError, preGenPreview, commitPreGenPending: wrappedCommitPreGenPending, preGenSaving, setPreGenPending, setPreGenPreview, setPreGenPreviewError, setPreGenAllowSoftOverride, runsSelectedId: selectedRunId, onRunsSelect: handleRunChange, formatRunTimestamp: formatTimestamp, formatRunDuration: formatDuration, runsPending: loading, runsUnavailableReason: error, setupInputs: { schoolId, schoolYearId, activeGeneratedRunId, onStartRevision: handleTriggerGenerate, draft, isPreGenerationWorkspace, loading, generating, onRefresh: handleRefresh, onRefreshSetupNames: refreshReferenceLabels, curriculumReadiness, hasSelectedEntry: !!selectedEntry, requestPendingCount: roomRequestSummary?.counts?.pending ?? 0, blockingHardCount, softCount, summary, violations, schoolYearContext, latestRunStatus: runs[0]?.status ?? null, setLeftTab, setPresentationMode: handlePresentationModeChange, setUnassignedReasonFilter, setSelectedViolation, setSeverityFilter } });
		centerWorkspaceContext.termFilter = effectiveTermFilter;
		const rightPanelContext = buildRightPanelContext({ rightPanelRef, setIsRightCollapsed, isRightCollapsed, isPreGenerationWorkspace, preGenKbSource, selectedEntry, setPreGenKbSource, setKbSelectedSource, initials, facultyMap, formatFacultyInitials, isDesktop, subjectLabel, toggleFollowUp, followUps, setSelectedEntry, gradeForSection, violationIndex, sectionLabel, facultyLabel, roomLabel, roomRequestSummary, previewResult, formatConstraintMessage, violationLabels: VIOLATION_LABELS, violationExplanations: VIOLATION_EXPLANATIONS, setSelectedViolation, toast, draftBoard, parseDraftPlacementId, deletingPlacementId, setPendingUnassignId, setShowUnassignConfirm, enterManualEditView, openTacticalSandbox });
		const headerContext = buildHeaderContext({ isPreGenerationWorkspace, activeGeneratedRunId, leftTab, leftPanelRef, selectedRunId, handleRunChange, runs, schoolYearContext, schoolId, centerView, newDraftLoading, schoolYearId, handleStartNewPreGenerationDraft, draftPlacementCount: draftBoardSummary?.draft ?? 0, openPreGenerationWorkspace, returnToGeneratedRun, generating, loading, handleTriggerGenerate, draft, hardCount, blockingHardCount, setPublishAcknowledged, setShowPublishDialog, exitPolicyView, switchCenterViewWithGuard, enterPolicyView, openMapWorkspace, handleRefresh, refreshReferenceLabels, referenceLookupStatus, revertLoading, editHistoryCount: editHistory.length, editHistoryReadState, revertLastEdit, undoBlockedReason, lastEditUndoable, setShowEditHistory, tutorial, summary, sectionLabel, subjectLabel, facultyLabel, setUnassignedReasonFilter, requestPendingCount: roomRequestSummary?.counts?.pending ?? 0, statusColor, formatDuration, formatTimestamp, viewMode, setViewMode, setEntityFilter, focusSection, sectionFocusId, hasSelectedEntry: !!selectedEntry, setSelectedEntry, setSelectedViolation, enterManualEditView, setPreGenKbSource, setKbSelectedSource, entityFilter, groupedPivotEntities, pivotLabel, programFilter, setProgramFilter, 			entryKindFilter, setEntryKindFilter, termFilter, onTermFilterChange: handleTermFilterChange,
			termOptions,
			activeTermIndex: schoolYearContext?.activeTerm?.termIndex ?? null, violations, severityFilter, setSeverityFilter, setLeftTab, softCount, presentationMode, setPresentationMode: handlePresentationModeChange, policy, policyAlignmentWarning, showFullDay, setShowFullDay, hiddenRowCount, collaborationConnected, presence, remoteSelections });
		headerContext.termFilter = effectiveTermFilter;
		headerContext.hasPublishedReturnState = publishedReturnState.snapshot != null;
		headerContext.curriculumReadiness = curriculumReadiness;
		const dialogContext = buildDialogContext({ showUnassignConfirm, setShowUnassignConfirm, setPendingUnassignId, pendingUnassignId, unassignDraftPlacement, showGenerateConfirm, setShowGenerateConfirm, generationStoppers, generationReadinessDiagnostic: curriculumReadiness.state === 'blocked' || curriculumReadiness.state === 'ready' ? curriculumReadiness.diagnostic : null, onCheckScheduleAgain: () => { void handleRefresh(); }, enforceShiftWindows, setEnforceShiftWindows, draftBoardSummary, followUps, confirmGenerate, activeSchoolYearLabel: schoolYearContext?.activeSchoolYearLabel ?? null, schoolYearSource: schoolYearContext?.source ?? null, showResetDraftDialog, setShowResetDraftDialog, openPreGenerationWorkspace, showLeavePreGenDialog, setShowLeavePreGenDialog, pendingCenterSwitch, setPendingCenterSwitch, requestPreview, requestPreviewLoading, setRequestPreview, setSelectedRequestId, setRequestAppeals, setAppealReason, requestPreviewHardConflicts, requestPreviewSoftWarnings, requestAppeals, appealsLoading, isPrivilegedUser, updateAppealStatus, appealReason, appealSubmitting, submitAppeal, requestReviewerNotes, setRequestReviewerNotes, requestReviewSaving, reviewRoomRequest, generating, generationElapsed, showPublishDialog, setShowPublishDialog, publishAcknowledged, setPublishAcknowledged, softCount, publishUnassignedCount: summary?.unassignedCount ?? 0, publishPlaceholderOwnedCount: draft?.summary?.placeholderOwnedClasses ?? null, policy, handlePublishConfirm, captureReviewFocusReturn, restoreReviewFocus, showPreGenConfirm, setShowPreGenConfirm, setPreGenConfirmCtx, setConfirmPreview, setConfirmRawPreview, setConfirmPreviewError, setConfirmAllowSoftOverride, setConfirmAllowDailyOverride, preGenConfirmCtx, confirmFacultyId, setConfirmFacultyId, confirmPreview, confirmRoomId, setConfirmRoomId, facultyMap, roomMap, confirmPreviewLoading, confirmPreviewError, confirmDisplacedPlacement, toast, openSwapPrompt, confirmAllowDailyOverride, confirmSaving, commitConfirmPlacement: wrappedCommitConfirmPlacement, showSwapConfirm, setShowSwapConfirm, setSwapAction, swapAction, formatFacultyInitials, roomLabelShort, subjectLabel, sectionLabel, swapSaving, executeSwapAction, swapPreview, regularSwapPreview, regularSwapPending, setRegularSwapPending, resetSwapClassTimesState, regularSwapSaving, regularSwapStrategy, setRegularSwapStrategy, executeRegularSwap, showSoftConfirm, setShowSoftConfirm, softConfirmWarnings, commitLoading, formatConstraintMessage, setPendingCommitProposal, setPreviewResult, setSoftConfirmWarnings, setDragItem, pendingCommitProposal, commitEdit, showAssignmentPicker, setShowAssignmentPicker, setAssignPickerTarget, assignPickerTarget, assignPickerFacultyId, setAssignPickerFacultyId, assignPickerRoomId, setAssignPickerRoomId, assignPickerPreview, assignPickerPreviewLoading, assignPickerPreviewError, assignPickerSaving, confirmAssignmentPicker, showEditHistory, setShowEditHistory, editHistory, editHistoryReadState,
		/* C11 S2 (T2) — the class name behind a recorded entry id, so a corrective
		 * auto-fix row can name the class that moved instead of the dialog handle
		 * "Class A". Derived from the run on screen and the same `sectionLabel` the
		 * grid prints, and it returns null for an entry the run no longer holds. */
		editHistoryEntryClassName: (entryId: string) => {
			const entry = draft?.entries?.find((candidate: { entryId: string }) => candidate.entryId === entryId);
			if (!entry) return null;
			const label = sectionLabel(entry.sectionId).trim();
			return label.length > 0 ? label : null;
		}, revertEditById, revertLoading, currentRunVersion: draft?.version ?? null, publishedSwapScope: draft && isDraftPublishedStrict(draft) && schoolYearId && runIdNumeric ? { schoolId, schoolYearId, runId: runIdNumeric } : null, onPublishedSwapScheduled: () => { void handleRefresh(); } });
		dialogContext.canRequestPublication = userRole === 'scheduler';
		dialogContext.canApprovePublication = userRole === 'scheduler';
		dialogContext.approvalSchoolId = schoolYearContext?.schoolId ?? null;
		dialogContext.approvalSchoolYearId = schoolYearId;
		dialogContext.approvalActorId = decodeJwtPayload(getPreferredAccessToken() ?? '')?.userId ?? null;
		const overlaysContext = buildOverlaysContext({ dialogContext, tutorial, userRole, blockerModalData, setBlockerModalData, showExplainDrawer, setDrawerViolation, setDrawerUnassigned, drawerViolation, drawerUnassigned, formatDrawerMessage: formatConstraintMessage });
		return { leftRailContentContext, centerWorkspaceContext, rightPanelContext, headerContext, overlaysContext, dialogContext, lastAutoSaveUndo, setLastAutoSaveUndo, inlinePlacementPending, inlinePlacementSaving, inlinePlacementRoomChanging, inlinePlacementRoomOptions, confirmInlinePlacement, changeInlinePlacementRoom, cancelInlinePlacement, revertEditById, revertDraftEditById, redoState, redoVersionStale, undoNotice, undoBlockedReason, lastEditUndoable, redoLastEdit, clearRedo, swapClassTimesMode, setSwapClassTimesMode, swapClassAEntryId, swapClassBEntryId, setSwapClassAEntryId, setSwapClassBEntryId, resetSwapClassTimesState };
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
		pendingFacultyIssuePivot,
		setPendingFacultyIssuePivot,
		confirmFacultyIssuePivot,
		loading,
		draft,
		error,
		loadAll,
		/**
		 * A2 C13 (item 1b) — "a published run is ALREADY derivable from data on
		 * screen, with no new fetch".
		 *
		 * `publishedReturnState.snapshot` is populated ONLY by
		 * `capturePublishedReturnState`, which stores nothing unless the run on
		 * screen was published (`context.isPublished`, a strict
		 * `isDraftPublishedStrict` read) and carried a real run id. So a non-null
		 * snapshot IS the truth that a published run has been seen — no request
		 * is fired to discover whether the loading skeleton may offer a link, which
		 * would be a second stall on the slowest screen in the product.
		 *
		 * It is exposed at the TOP level, beside `draft`, because the loading early
		 * return in `ScheduleReviewWorkspace` runs before `headerContext` is known
		 * to exist; reading it off the header context would make the answer
		 * `undefined` on exactly the render that needs it.
		 */
		hasPublishedReturnState: publishedReturnState.snapshot != null,
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
		// A2-TIMETABLE-CUSTODY (#61) — the named concurrent-commit notice.
		concurrentCommitNotice,
		dismissConcurrentCommit,
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
		policyRecord,
		policyRefreshToken,
		refreshPolicy,
		entryContextLabel,
		roomLabelShort,
		formatFacultyInitials,
		subjectLabel,
		sectionLabel,
		showTopLoadingStrip,
		policyAlignmentWarning,
		publishedEntryChange,
		setPublishedEntryChange,
		publishedChangeScope: draft && isDraftPublishedStrict(draft) && schoolId && schoolYearId && runIdNumeric ? { schoolId, schoolYearId, runId: runIdNumeric } : null,
		...workspaceContexts,
	};
}
