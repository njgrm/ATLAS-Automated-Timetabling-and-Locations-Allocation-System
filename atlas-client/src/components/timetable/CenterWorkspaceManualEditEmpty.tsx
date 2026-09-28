/**
 * C11 M1 — the manual-edit empty state, extracted from `CenterWorkspace.tsx`.
 *
 * `CenterWorkspace` was at 981 physical lines against the 1000-line component cap
 * (AGENTS.md §8) and had to take this change, so the block was extracted rather
 * than appended. Nothing about the rendered result changed except the added hint.
 *
 * The recorded defect (`docs/reviews/codex-timetable-walk-20260928/report.md`,
 * defect 1): `More ▸ Manual edit` opens this pane with nothing selected, and
 * `Back to Schedule` used to return the operator to this same panel instead of the
 * grid. The pane is honest about needing a selection — that is not the defect — so
 * the fix is the one-line way out below plus the route-wins decision in
 * `resolveCenterPane`, which is what actually stops the stale panel painting.
 */
import { ChevronLeft, MousePointerClick } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/ui/button';

/**
 * The one line that says what to do, shown whenever this pane is reached without
 * a selection — by direct URL, by the More menu, or by a back navigation.
 *
 * It names the next action and nothing else. The longer existing paragraph below
 * is kept intact: the accepted assertions for that copy still decide on it.
 */
export const MANUAL_EDIT_NO_SELECTION_HINT =
	'Pick a class on the grid, then choose Move, Change room or Swap.';

/**
 * The same fact as a reason ON the More-menu entry, so the two surfaces cannot
 * drift. One sentence, and it states the action rather than the absence.
 */
export const MANUAL_EDIT_NEEDS_SELECTION_REASON =
	'Pick a class on the grid first, then choose this.';

export function CenterWorkspaceManualEditEmpty({
	isDraftPublished,
}: {
	isDraftPublished: boolean;
}) {
	return (
		<div className="flex min-h-0 flex-1 items-center justify-center p-4">
			<div className="max-w-md space-y-3 text-center" data-testid="timetable-manual-edit-empty-state">
				<MousePointerClick className="mx-auto size-10 text-muted-foreground/30" />
				<p className="text-sm font-medium">No class selected for manual edit</p>
				<p className="text-xs text-muted-foreground">
					Select a class on the schedule grid first, then open Move, Change room, or Swap from the selection actions to edit it here.
				</p>
				{/* C11 M1 — the one-line way out. Rendered ABOVE the back control so the
				    operator who arrived here from the More menu reads what to do next
				    rather than only where the button is. */}
				<p className="text-sm text-foreground" data-testid="timetable-manual-edit-no-selection-hint">
					{MANUAL_EDIT_NO_SELECTION_HINT}
				</p>
				{/* LANE-C C03 (B3) — a published schedule is changed from a date, not here. */}
				{isDraftPublished ? (
					<p className="text-sm text-foreground" data-testid="timetable-manual-edit-published-note">
						This schedule is published. Go back to the schedule, click a class, then choose “Choose a new time”, “Change room” or “Swap with another class”. ATLAS checks the change and you pick the date it starts.
					</p>
				) : null}
				{/* UX-R03b correction: navigate instead of setting view state,
				    so the URL always matches the shown view; the route→view
				    sync then drives the guarded transition. C11 M1: `resolveCenterPane`
				    now also resolves any disagreeing render to this grid, so this link
				    always lands on the grid. */}
				<Button asChild variant="outline" size="sm" className="h-7 text-xs">
					<Link to="/timetable" data-testid="timetable-manual-edit-back-to-schedule">
						<ChevronLeft className="size-3.5" />
						Back to Schedule
					</Link>
				</Button>
			</div>
		</div>
	);
}
