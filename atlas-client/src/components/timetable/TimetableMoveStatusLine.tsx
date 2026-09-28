/**
 * C11 M3 — the move status line and its ONE Cancel.
 *
 * ── WHY THIS IS ITS OWN COMPONENT ────────────────────────────────────────────
 *
 * Two reasons, and the second is QA finding F3.
 *
 * 1. `ScheduleReviewWorkspace.tsx` was at 876 physical lines and this block plus
 *    its copy is the M3 slice's whole operator-facing surface; keeping it inline
 *    put the next increment straight into the AGENTS.md §8 cap.
 *
 * 2. F3: `timetable-move-no-target-cancel` was RENDERED BY NO TEST. It is
 *    reachable only through the fully composed workspace (a data hook, a context
 *    builder and three sibling panels), so a control the walk recorded as
 *    "the operator is left in an armed move with no exit" shipped unexercised.
 *    Extracting the line makes the exact production surface renderable, so the
 *    acceptance row clicks the real control.
 *
 * The rendered output is unchanged: same testids, same tones, same message, same
 * single Cancel that clears the armed source and the status together.
 */
import { Button } from '@/ui/button';

import type { MoveTargetNotice } from '@/components/timetable/timetableMoveTargets';

export function TimetableMoveStatusLine({
	tone,
	message,
	moveTargetNotice,
	onDisarm,
}: {
	tone: 'error' | 'warning' | 'success' | 'loading';
	message: string;
	/** The one `describeMoveTargets` derivation for the current view. */
	moveTargetNotice: MoveTargetNotice;
	/** Clears the armed move source AND the status, so no exit path can strand it. */
	onDisarm: () => void;
}) {
	return (
		<div className="relative z-30 h-0" data-testid="timetable-inline-status-anchor">
			<div
				role="status"
				aria-live="polite"
				data-testid="timetable-inline-status"
				className={`absolute inset-x-3 top-1 rounded-md border px-3 py-1.5 text-sm shadow-sm ${
					tone === 'error'
						? 'border-red-300 bg-red-50 text-red-800'
						: tone === 'warning'
							? 'border-amber-300 bg-amber-50 text-amber-800'
							: tone === 'success'
								? 'border-emerald-300 bg-emerald-50 text-emerald-800'
								: 'border-border bg-background text-foreground'
				}`}
			>
				<div className="flex items-center gap-2">
					<span className="min-w-0" data-testid="timetable-move-status-message">{message}</span>
					{/* C11 M3 — ONE Cancel for the move. It clears the armed source and the
					    status together, so the operator is never left in an armed move with
					    no exit — the defect the walk recorded. */}
					{moveTargetNotice.kind === 'none' ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-7 shrink-0 px-2 text-xs"
							data-testid="timetable-move-no-target-cancel"
							onClick={onDisarm}
						>
							Cancel
						</Button>
					) : null}
				</div>
			</div>
		</div>
	);
}
