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
