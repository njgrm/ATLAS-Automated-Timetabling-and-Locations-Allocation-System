/**
 * A2 HEADER-BUDGET (operator, 2026-09-29) — the Simple header's TASK DISPATCHER,
 * extracted from `TimetableSimpleHeader.tsx`.
 *
 * WHY: that file stood at exactly 1000 physical lines, the AGENTS.md §8 cap,
 * before this change took on the two-row header, and §8's answer for that is to
 * EXTRACT a sub-component rather than delete a record comment to make room. This
 * block is the natural unit: it is one named function, it owns no state, and every
 * value it closes over is already computed one layer up. Verified before moving:
 * no committed row reads any token from inside it out of the header's source text.
 *
 * IT IS A MOVE, NOT A CHANGE. The same guards, the same order, the same branches
 * and the same handlers, including the DRAFT-UX-C01 (S5) rule that the unassigned
 * list opens the rail's own panel rather than a second list. The caller keeps the
 * name `startTask`, so `onStartTask={startTask}` in the `More` menu and every
 * `void startTask('…')` call site are byte-identical.
 */
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { TimetableCapabilities } from '@/lib/timetable-capabilities';

export type SimpleTaskStarterDeps = {
	context: ScheduleReviewWorkspaceHeaderContext;
	capabilities: TimetableCapabilities;
	onTaskChange: (task: TimetableSimpleTask | null) => void;
	onSwapClassTimesStart?: () => void;
	/** The ONE publication dispatch, owned by the header (C11 D / C07B F2). */
	handlePublishClick: () => void;
};

export function createSimpleTaskStarter({
	context,
	capabilities,
	onTaskChange,
	onSwapClassTimesStart,
	handlePublishClick,
}: SimpleTaskStarterDeps): (task: TimetableSimpleTask) => Promise<void> {
	return async (task: TimetableSimpleTask) => {
		// DRAFT-UX-C01 (S5) — the unassigned list (the rail's own panel) in the
		// Simple task drawer; same left-tab state the Advanced rail uses.
		if (task === 'place-unresolved' || task === 'unassigned-sessions') {
			context.setLeftTab('unassigned');
			context.setPresentationMode('workflow');
			onTaskChange(task);
			return;
		}
		if (task === 'review-issues') {
			if (!capabilities.gates.issueReview.enabled) return;
			context.setLeftTab('violations');
			context.setPresentationMode('workflow');
			onTaskChange(task);
			return;
		}
		if (task === 'swap-sessions') {
			if (!capabilities.gates.swap.enabled) return;
			context.setPresentationMode('workflow');
			onTaskChange(task);
			onSwapClassTimesStart?.();
			return;
		}
		if (task === 'plan-draft') {
			if (!context.isPreGenerationWorkspace) {
				await context.handleStartNewPreGenerationDraft();
			}
			context.setLeftTab('unassigned');
			context.setPresentationMode('workflow');
			onTaskChange(task);
			return;
		}
		if (task === 'publish') {
			// R7 — one shared publication gate for the task action too.
			// C07B/F2 — one dispatcher: the task and the lifecycle action land on the
			// same readiness surface.
			handlePublishClick();
		}
	};
}
