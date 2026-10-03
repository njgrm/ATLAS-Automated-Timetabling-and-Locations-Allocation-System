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
	/**
	 * A7 c14 (operator, 2026-09-30 08:15) — `true` when there is a REAL, trustworthy
	 * drift this run can be regenerated against: the change notice is up, the run is
	 * not published, and the comparison is claimed (`driftClaim !== null`). The
	 * header uses it to mount the ONE `Update schedule` entry in its `More` menu —
	 * the same predicate `SimpleDriftBanner` uses for its own apply action, so the
	 * two can never disagree about whether regeneration is offered.
	 */
	regenerateAvailable: boolean;
};

export function useRunChangeNotice(input: {
	context: ScheduleReviewWorkspaceHeaderContext;
	capabilities: TimetableCapabilities;
	isPublished: boolean;
	/** The shared generation capability; false disables the apply action with a visible reason. */
	generationEnabled: boolean;
	/** The workspace's own generation trigger. Omit it and the apply action is not mounted. */
	onRegenerate?: () => void;
	/**
	 * A7 c14 (operator, 2026-09-30 08:15) — when `false`, the returned notice node
	 * renders ONLY the sentence and `See what changed`; the `Update schedule` action
	 * is NOT in it. The Simple header passes `false`, because its `Update schedule`
	 * now lives in the `More` menu, and mounts that entry off `regenerateAvailable`.
	 * Defaults to `true`, so every pre-existing caller (the Expert header) is
	 * unchanged.
	 */
	includeApplyAction?: boolean;
}): RunChangeNotice {
	const { context, capabilities, isPublished, generationEnabled, onRegenerate, includeApplyAction = true } = input;
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
	// A7 c14 — the SAME `!isPublished && driftClaim` guard `SimpleDriftBanner` uses
	// for its apply action. `node` deliberately does NOT receive `onRegenerate`: the
	// status line shows the sentence and `See what changed`, and `Update schedule`
	// is mounted by the header's `More` menu off this flag.
	const regenerateAvailable = show && !isPublished && drift.driftClaim !== null;
	return {
		show,
		status: drift.status,
		regenerateAvailable,
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
				onRegenerate={includeApplyAction ? onRegenerate : undefined}
				regenerationEnabled={generationEnabled}
				regenerating={context.generating}
			/>
		) : null,
	};
}
