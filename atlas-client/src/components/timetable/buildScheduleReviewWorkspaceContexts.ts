import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { formatTime } from '@/lib/utils';
import { buildUnassignedKey } from '@/lib/timetable-utils';
import type { EntryKindFilter, ProgramFilter } from '@/lib/schedule-review-helpers';
import type { TutorialStep } from '@/components/TutorialOverlay';
import type { TimetableToolbarGroup } from '@/components/timetable/TimetableToolbar';
import type { DraftBoardState, DraftReport, HumanConflict, ScheduledEntry, UnassignedItem, UnassignedReason, Violation } from '@/types';
import type { ActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import type { DragSource, PreGenDragSource } from '@/components/timetable/ScheduleReviewWorkspace.constants';
import type { LeftRailContentContext, ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';

import {
	CONFLICT_CODES,
	DAYS,
	DAY_SHORT,
	DEFAULT_SCHOOL_ID,
	ENTRY_KIND_FILTER_OPTIONS,
	GRADE_BADGE,
	GRADE_CARD_BG,
	PROGRAM_FILTER_OPTIONS,
	TUTORIAL_STEPS,
	UNASSIGNED_REASON_LABELS,
	VIEW_MODE_LABELS,
	WELLBEING_CODES,
} from '@/components/timetable/ScheduleReviewWorkspace.constants';

type AnyRecord = Record<string, unknown>;

export type CenterWorkspaceContext = ComponentProps<typeof import('@/components/timetable/CenterWorkspace').CenterWorkspace> & { tacticalSandboxOpen: boolean, setTacticalSandboxOpen: (v: boolean) => void };
export type RightPanelContext = ComponentProps<typeof import('@/components/timetable/RightPanel').RightPanel> & { openTacticalSandbox: () => void };
export type DialogContext = ScheduleReviewDialogsContext;

export type ScheduleReviewWorkspaceHeaderContext = {
	isPreGenerationWorkspace: boolean;
	activeGeneratedRunId: number | null;
	leftTab: 'violations' | 'unassigned' | 'pinned' | 'requests';
	leftPanelRef: import('react').RefObject<ImperativePanelHandle | null>;
	presentationMode: 'workflow' | 'matrix';
	setPresentationMode: (value: 'workflow' | 'matrix') => void;
	viewMode: 'section' | 'faculty' | 'room';
	setViewMode: (value: 'section' | 'faculty' | 'room') => void;
	entityFilter: string;
	setEntityFilter: (value: string) => void;
	focusSection: (sectionId: number) => void;
	sectionFocusId: number | null;
	programFilter: ProgramFilter;
	entryKindFilter: EntryKindFilter;
	violations: Violation[];
	hardCount: number;
	softCount: number;
	selectedRunId: string;
	handleRunChange: (value: string) => void;
	runs: Array<{ id: number; createdAt: string; durationMs?: number | null; status?: string }>;
	schoolYearContext: ActiveSchoolYearContext | null;
	schoolId: number;
	centerView: string;
	newDraftLoading: boolean;
	schoolYearId: number | null;
	handleStartNewPreGenerationDraft: () => Promise<void>;
	draftPlacementCount: number;
	openPreGenerationWorkspace: (showConfirm: boolean) => Promise<void>;
	returnToGeneratedRun: () => void;
	generating: boolean;
	loading: boolean;
	handleTriggerGenerate: () => void;
	draft: DraftReport | null;
	setPublishAcknowledged: (value: boolean) => void;
	setShowPublishDialog: (value: boolean) => void;
	exitPolicyView: () => void;
	switchCenterViewWithGuard: (action: () => void) => void;
	enterPolicyView: () => void;
	openMapWorkspace: () => Promise<void>;
	handleRefresh: () => void;
	refreshReferenceLabels: () => void;
	referenceLookupStatus: { state: 'loading' | 'ready' | 'needs-refresh'; label: string };
	revertLoading: boolean;
	editHistoryCount: number;
	revertLastEdit: () => Promise<void>;
	setShowEditHistory: (value: boolean) => void;
	tutorial: { start: () => void };
	sectionLabel: (id: number) => string;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	setUnassignedReasonFilter: Dispatch<SetStateAction<'all' | UnassignedReason>>;
	summary: {
		assignedCount: number;
		classesProcessed: number;
		hardViolationCount: number;
		unassignedCount?: number;
	} | null;
	requestPendingCount: number;
	statusColor: (value: string) => string;
	formatDuration: (value: number | null) => string;
	groupedPivotEntities: TimetableToolbarGroup[];
	pivotLabel: (id: number) => string;
	setSelectedEntry: Dispatch<SetStateAction<ScheduledEntry | null>>;
	hasSelectedEntry: boolean;
	setSelectedViolation: (violation: Violation | null) => void;
	enterManualEditView: (action: 'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY') => void;
	setPreGenKbSource: Dispatch<SetStateAction<PreGenDragSource | null>>;
	setKbSelectedSource: Dispatch<SetStateAction<DragSource>>;
	severityFilter: 'all' | 'hard' | 'soft' | 'conflicts' | 'wellbeing';
	setSeverityFilter: (value: 'all' | 'hard' | 'soft' | 'conflicts' | 'wellbeing') => void;
	setLeftTab: (value: 'violations' | 'unassigned' | 'pinned' | 'requests') => void;
	VIEW_MODE_LABELS: Record<string, string>;
	PROGRAM_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }>;
	ENTRY_KIND_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }>;
	WELLBEING_CODES: Set<string>;
	CONFLICT_CODES: Set<string>;
	formatTimestamp: (value: string | null) => string;
	setProgramFilter: (value: ProgramFilter) => void;
	setEntryKindFilter: (value: EntryKindFilter) => void;
	policy: { teacherMoveEnabled: boolean } | null;
	policyAlignmentWarning: string | null;
	showFullDay: boolean;
	setShowFullDay: (value: boolean) => void;
	hiddenRowCount: number;
	termFilter: 'all' | 1 | 2 | 3;
	onTermFilterChange: (value: 'all' | 1 | 2 | 3) => void;
	activeTermIndex: number | null;
	collaborationConnected?: boolean;
	presence?: any[];
	remoteSelections?: Record<string, any>;
};

export type ScheduleReviewWorkspaceBodyContext = {
	leftPanelRef: import('react').RefObject<import('react-resizable-panels').ImperativePanelHandle | null>;
	setIsLeftCollapsed: Dispatch<SetStateAction<boolean>>;
	isLeftCollapsed: boolean;
	isDesktop: boolean;
	isPreGenerationWorkspace: boolean;
	leftTab: 'violations' | 'unassigned' | 'pinned' | 'requests';
	setLeftTab: (value: 'violations' | 'unassigned' | 'pinned' | 'requests') => void;
	violations: unknown[];
	hardCount: number;
	softCount: number;
	summary: { unassignedCount?: number; assignedCount?: number } | null;
	roomRequestSummary: { counts?: { pending?: number } } | null;
	openPublishDialog: () => void;
	activeGeneratedRunId: number | null;
	sectionLabel: (id: number) => string;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	leftRailContentContext: LeftRailContentContext;
	centerWorkspaceContext: CenterWorkspaceContext;
	rightPanelContext: RightPanelContext;
};

export type ScheduleReviewWorkspaceOverlaysContext = {
	dialogContext: DialogContext;
	TUTORIAL_STEPS: TutorialStep[];
	tutorial: {
		active: boolean;
		complete: () => void;
	};
	blockerModalData: HumanConflict[] | null;
	setBlockerModalData: Dispatch<SetStateAction<HumanConflict[] | null>>;
	showExplainDrawer: boolean;
	setDrawerViolation: (value: Violation | null) => void;
	setDrawerUnassigned: (value: UnassignedItem | null) => void;
	drawerViolation: Violation | null;
	drawerUnassigned: UnassignedItem | null;
};

type BuildLeftRailContextArgs = Omit<
	LeftRailContentContext,
	| 'UNASSIGNED_REASON_LABELS'
	| 'buildUnassignedKey'
	| 'defaultSchoolId'
	| 'formatTime'
	| 'DAY_SHORT'
	| 'GRADE_BADGE'
	| 'GRADE_CARD_BG'
>;
type BuildCenterWorkspaceContextArgs = Omit<CenterWorkspaceContext, 'defaultSchoolId' | 'draftEntries' | 'dayShort'> & {
	draft?: { entries?: unknown[] } | null;
	tacticalSandboxOpen: boolean;
	setTacticalSandboxOpen: (v: boolean) => void;
};
type BuildRightPanelContextArgs = Omit<RightPanelContext, 'gradeBadge' | 'dayShort'> & {
	openTacticalSandbox: () => void;
};
type BuildHeaderContextArgs = Omit<
	ScheduleReviewWorkspaceHeaderContext,
	| 'VIEW_MODE_LABELS'
	| 'PROGRAM_FILTER_OPTIONS'
	| 'ENTRY_KIND_FILTER_OPTIONS'
	| 'WELLBEING_CODES'
	| 'CONFLICT_CODES'
> & {
	setProgramFilter: (value: ProgramFilter) => void;
	setEntryKindFilter: (value: EntryKindFilter) => void;
};
type BuildOverlaysContextArgs = Omit<ScheduleReviewWorkspaceOverlaysContext, 'dialogContext' | 'TUTORIAL_STEPS'> & {
	dialogContext: DialogContext;
};

export function buildLeftRailContext(args: BuildLeftRailContextArgs): LeftRailContentContext {
	return {
		...args,
		UNASSIGNED_REASON_LABELS,
		buildUnassignedKey,
		defaultSchoolId: DEFAULT_SCHOOL_ID,
		formatTime,
		DAY_SHORT,
		GRADE_BADGE,
		GRADE_CARD_BG,
	};
}

export function buildCenterWorkspaceContext(args: BuildCenterWorkspaceContextArgs): CenterWorkspaceContext {
	return {
		...args,
		defaultSchoolId: DEFAULT_SCHOOL_ID,
		draftEntries: args.draft?.entries ?? [],
		dayShort: DAY_SHORT,
	};
}

export function buildRightPanelContext(args: BuildRightPanelContextArgs): RightPanelContext {
	return {
		...args,
		gradeBadge: GRADE_BADGE,
		dayShort: DAY_SHORT,
	};
}

export function buildHeaderContext(args: BuildHeaderContextArgs): ScheduleReviewWorkspaceHeaderContext {
	return {
		...args,
		VIEW_MODE_LABELS,
		PROGRAM_FILTER_OPTIONS,
		ENTRY_KIND_FILTER_OPTIONS,
		WELLBEING_CODES,
		CONFLICT_CODES,
		setProgramFilter: args.setProgramFilter,
		setEntryKindFilter: args.setEntryKindFilter,
	};
}

export function buildOverlaysContext(args: BuildOverlaysContextArgs): ScheduleReviewWorkspaceOverlaysContext {
	return {
		...args,
		TUTORIAL_STEPS,
	};
}

export function buildDialogContext(args: Omit<DialogContext, 'DAYS' | 'DAY_SHORT'>): DialogContext {
	return {
		...args,
		DAYS,
		DAY_SHORT,
	};
}
