/**
 * A2 HEADER-BUDGET (operator, 2026-09-29) — the readiness-repair INPUT SHAPE,
 * extracted from `TimetableSimpleHeader.tsx` so that file fits under §8's
 * 1000-line cap while taking on the two-row header.
 *
 * §8's rule is to EXTRACT a sub-component, never to delete a comment to make
 * room, and this is the one block in that file that no committed contract reads
 * from its source text: `dispatchSimpleReadinessRepair` itself STAYS in
 * `TimetableSimpleHeader.tsx` (three accepted source-regex rows and the
 * `/timetable/setup` pane's canonical import path both pin it there), and only the
 * two type declarations — pure data, no behaviour — moved.
 *
 * BOTH TYPES ARE RE-EXPORTED from `TimetableSimpleHeader.tsx`, so every existing
 * importer and every committed type import keeps its exact path.
 */
import type { SeverityFilter } from '@/components/timetable/ScheduleReviewWorkspace.constants';
import type { UnassignedReason, Violation } from '@/types';
import type { RepairOrigin } from '@/components/timetable/TimetableTaskDrawer';
import type { ReactNode } from 'react';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableLayoutMode, TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';

export type SimpleReadinessRepairIdentity = {
	sectionId: number | null;
	subjectId: number | null;
	facultyId: number | null;
};

export type SimpleReadinessRepairDeps = {
	href: string;
	reason?: string;
	identity?: SimpleReadinessRepairIdentity | null;
	/**
	 * C1-a — the affected-session count of the blocker group the operator
	 * followed, read from `BlockerGroupRow`. Optional: the `/timetable/setup`
	 * caller of this shared dispatcher has no group, and an absent count makes
	 * the banner omit the clause instead of printing a zero.
	 */
	groupCount?: number | null;
	navigate: (to: string) => void;
	violations: Violation[];
	setUnassignedReasonFilter: (value: 'all' | UnassignedReason) => void;
	setBlockerReasonFilter: (value: string | null) => void;
	startPlaceUnresolvedTask: () => void;
	startReviewIssuesTask: () => void;
	setSelectedViolation: (violation: Violation | null) => void;
	setSeverityFilter: (value: SeverityFilter) => void;
	issueReviewEnabled: boolean;
	onSetRepairOrigin?: ((origin: RepairOrigin | null) => void) | null;
};

/**
 * A2 C13 — the header's PROP SHAPE, moved out for the same reason and by the same
 * rule as the two types above: `TimetableSimpleHeader.tsx` sits at 999 physical
 * lines, so the two added `gateShortReason` lines had nowhere to go, and §8 says
 * to EXTRACT a block, never to delete a comment to make room.
 *
 * This is again pure data with no behaviour, and again nothing reads it from the
 * header's source text. It is RE-EXPORTED from `TimetableSimpleHeader.tsx`, so the
 * component's own signature is unchanged and every importer keeps its exact path.
 */
export type TimetableSimpleHeaderProps = {
	context: ScheduleReviewWorkspaceHeaderContext;
	layoutMode: TimetableLayoutMode;
	onLayoutModeChange: (mode: TimetableLayoutMode) => void;
	activeTask: TimetableSimpleTask | null;
	onTaskChange: (task: TimetableSimpleTask | null) => void;
	onOpenTeacherDeparture?: () => void;
	onSetRepairOrigin?: (origin: RepairOrigin | null) => void;
	readinessSheetOpen?: boolean;
	onReadinessSheetOpenChange?: (open: boolean) => void;
	swapClassTimesMode?: 'select-first' | 'select-second' | null;
	onSwapClassTimesStart?: () => void;
	onSwapClassTimesCancel?: () => void;
	/**
	 * C11 M5 — the single existing Undo / Redo / History control, rendered by the
	 * caller into the draft strip. It is passed IN rather than built here so there
	 * is exactly one Undo surface in the app: the Expert toolbar copy that used
	 * to own it was removed in the same commit (A2-TIMETABLE-CUSTODY's rule).
	 */
	undoRedoControl?: React.ReactNode;
	/**
	 * C11 D — the workspace's EXISTING reset-draft confirmation, so `Discard
	 * draft` opens that dialog and never a second discard path.
	 */
	onDiscardDraft?: () => void;
};
