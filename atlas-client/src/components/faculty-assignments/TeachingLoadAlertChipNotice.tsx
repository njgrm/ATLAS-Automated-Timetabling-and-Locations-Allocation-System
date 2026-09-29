/**
 * A6 c11 — the header's alert chip, as ONE node, in a file of its own.
 *
 * WHY IT MOVED OUT. `WorkspaceToolbar.tsx` was at 976 physical lines and §8 caps a
 * component file at 1000, with `R3 component files stay under the 1000 physical
 * line cap` in `test:client-quality` measuring it. Rendering the chip as a real
 * `@/ui` Tooltip — which is what makes its model's `tooltip` reachable now that
 * the chip is no longer a control — added the lines that pushed it to 1032. So
 * the chip is extracted rather than trimmed, and its rationale lives in
 * `workspaceToolbarHeaderFacts.ts` beside the model it renders, which is where
 * the decision about it was actually made.
 *
 * IT IS A FIGURE, NOT A CONTROL. The model used to carry an `onClick` that no
 * render ever took — the defect the cover-class packet names verbatim — and the
 * two honest shapes were a real button or plain text. A button was ruled out
 * because row 2 holds exactly ONE action (the repair queue's `Review staff
 * workload`) and `a6-teaching-load-surface` `A6-C2-2` asserts it; adding a second
 * would undo the header budget A6 C2 (Major 1) was written to establish. So the
 * chip is plain text and the model no longer claims an action.
 *
 * Its explanation still reaches a reader, through the SAME `cursor-help` +
 * `@/ui` Tooltip the degraded pill and the source badge on this header already
 * use — that is this header's one established way to explain a figure it will not
 * make clickable. A model field no surface renders is the quiet truncation this
 * stream has been removing since c5.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

import type { TeachingLoadAlertChip } from '@/components/faculty-assignments/workspaceToolbarHeaderFacts';

export function TeachingLoadAlertChipNotice({ chip }: { chip: TeachingLoadAlertChip }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					data-testid={chip.testId}
					data-alert-key={chip.key}
					className="shrink-0 cursor-help font-bold text-destructive"
				>
					· {chip.label}
				</span>
			</TooltipTrigger>
			<TooltipContent side="bottom" className="max-w-80 text-xs font-semibold">
				{chip.tooltip}
			</TooltipContent>
		</Tooltip>
	);
}
