/**
 * A2 C11 S2 (items 1 and 2) — the ONE place a header decides whether the change
 * notice is on screen, and what it says.
 *
 * Lane C's spec, twice: "one sentence, one primary action, one secondary", and
 * "the Expert header gets the same one-sentence banner shape. Do not let the two
 * layouts drift onto two different banners." Both are satisfied by having ONE
 * gate and ONE banner, rendered here and mounted by both headers. The Expert
 * header had no change notice at all before this, so the two layouts were not
 * merely different — one of them was silent about a change it had the data for.
 *
 * ── T3c, AND IT IS THE SAME BUG IN BOTH LAYOUTS ────────────────────────────
 * The gate passes the RUN'S OWN TIMING into `describeRunInputDrift`. It used to
 * pass nothing, which made `deriveRunFreshness` keep the server's verdict
 * untouched and report `trustworthy: true` for ANY comparison row — so a notice
 * appeared on a published run that had not changed since it was made. The rule
 * is unchanged: the notice shows when something the run depends on has changed
 * since that run was made, and not otherwise.
 *
 * No data request, no dispatch of its own: the `onRegenerate` the caller passes
 * is the workspace's own generation trigger, and the banner's apply action only
 * opens the existing confirmation dialog.
 */
import { useMemo, type ReactNode } from 'react';

import { SimpleDriftBanner } from '@/components/timetable/simple/SimpleDriftBanner';
import { describeRunInputDrift } from '@/components/timetable/timetableDriftRouting';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableCapabilities } from '@/lib/timetable-capabilities';

export type RunChangeNotice = {
	/** True when a comparison this run can be told apart from says something moved. */
	show: boolean;
	/** The notice node, or `null` when `show` is false. Never a dead control. */
	node: ReactNode;
	/** The drift status, for callers that label a menu entry from it. */
	status: 'FRESH' | 'STALE' | 'UNKNOWN';
};

export function useRunChangeNotice(input: {
	context: ScheduleReviewWorkspaceHeaderContext;
	capabilities: TimetableCapabilities;
	isPublished: boolean;
	/** The shared generation capability; false disables the apply action with a visible reason. */
	generationEnabled: boolean;
	/** The workspace's own generation trigger. Omit it and the apply action is not mounted. */
	onRegenerate?: () => void;
}): RunChangeNotice {
	const { context, capabilities, isPublished, generationEnabled, onRegenerate } = input;
	// The run's OWN end time, exactly as `SimpleDriftBanner` reads it. Both
	// callers now go through here, so the two layouts cannot disagree about
	// whether a comparison is trustworthy about the run on screen.
	const drift = useMemo(
		() => describeRunInputDrift(
			context.draft?.inputState ?? null,
			context.draft != null
				? { finishedAt: context.draft.finishedAt, createdAt: context.draft.createdAt }
				: null,
		),
		[context.draft?.inputState, context.draft?.finishedAt, context.draft?.createdAt, context.draft],
	);
	const show = !context.isPreGenerationWorkspace && context.draft != null && drift.status !== 'FRESH';
	return {
		show,
		status: drift.status,
		node: show ? (
			<SimpleDriftBanner
				schoolId={context.schoolId}
				schoolYearId={context.schoolYearId}
				activeGeneratedRunId={context.draft?.runId ?? context.activeGeneratedRunId ?? null}
				draft={context.draft ?? null}
				isPreGenerationWorkspace={context.isPreGenerationWorkspace}
				loading={context.loading}
				onRefresh={context.handleRefresh}
				capabilities={capabilities}
				isPublished={isPublished}
				layout="inline"
				showActions={false}
				showRolloverGuidance={false}
				onRegenerate={onRegenerate}
				regenerationEnabled={generationEnabled}
				regenerating={context.generating}
			/>
		) : null,
	};
}
