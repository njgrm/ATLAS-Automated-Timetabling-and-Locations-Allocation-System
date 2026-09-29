import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import { PLACEHOLDER_TRUTH_LABEL } from '@/components/faculty-assignments/teachingLoadOutage';

/**
 * A3 A1 — the one number on a Teaching Load roster row that had no label.
 *
 * The recorded defect, measured live at 1366x768 by the planner: the roster
 * card rendered `15.0h · 50%`, `18.0h · 60%`, `22.5h · 75%` in a single 85x16px
 * `<p>` whose ONLY explanation was a `cursor-help` Tooltip. Three things were
 * wrong with that:
 *
 *  1. The percentage was bare. `15.0/30 = 50%` — it is teaching hours against
 *     the school's 30 h standard — and nothing beside it said so.
 *  2. A hover Tooltip is invisible to exactly the mouse-first, older scheduler
 *     this surface is graded for, and it is not a keyboard or touch path
 *     either. A visual cue beside the figure is required, not a hover one.
 *  3. ATLAS labels the SAME metric `% staffed` on the dashboard readiness card,
 *     so the roster was the bare one of two disagreeing screens.
 *
 * The label therefore lives in the rendered text, in the card's own visual
 * language (a small uppercase micro-label, like the `Hours / week` caption
 * beneath it) and stays terse — this is a dense row, not a paragraph. The
 * existing Tooltip is KEPT as the long-form explanation and still routes
 * through the `@/ui` primitive; it is an addition to the visible label, never a
 * replacement for it.
 *
 * The `utilization == null` case used to collapse to a bare `15.0h`, which read
 * as though the figure were simply absent rather than deliberately withheld.
 * It now has its own honest state, and the two reasons are distinguished:
 *
 *  - a placeholder (temporary) row has no standard to be a percentage OF, and
 *    ATLAS's house word for such a row is now the packet's own sentence —
 *    `to be hired — not a real person yet` (A6 c5 §3). It used to be a bare
 *    one-word `temporary` footnote, which named the mechanism and not the
 *    consequence, and it now states it.
 *  - otherwise the standard itself is unset for the year, which is what the
 *    pre-existing tooltip already said in prose.
 */
export type TeacherLoadReadoutProps = {
	/** Resolved teaching hours for the week (the figure already on the card). */
	displayHours: number;
	/** Utilisation against the standard, or null when no honest percentage exists. */
	utilization: number | null;
	/** A placeholder/temporary faculty row, which has no standard to measure against. */
	isPlaceholder: boolean;
	/** The effective standard in hours, or null when the year has none set. */
	standardHours: number | null;
	/** Whether the workload policy is resolved enough to judge against the standard. */
	policyReady: boolean;
	/** The faculty member's cap, used only for the over/under colour treatment. */
	maxHoursPerWeek: number;
};

export function TeacherLoadReadout({
	displayHours,
	utilization,
	isPlaceholder,
	standardHours,
	policyReady,
	maxHoursPerWeek,
}: TeacherLoadReadoutProps) {
	const hours = `${displayHours.toFixed(1)}h`;
	// The pre-existing colour treatment for over/under standard is unchanged;
	// the two states with no honest percentage keep the muted treatment because
	// there is no figure to be over or under.
	const valueClass = cn(
		'text-xs font-semibold tabular-nums cursor-help',
		!policyReady || standardHours == null
			? 'text-muted-foreground'
			: displayHours > maxHoursPerWeek
				? 'text-rose-600'
				: displayHours > standardHours
					? 'text-amber-600'
					: 'text-emerald-600',
	);
	// 11px, not 10px: fix 10 raised every sub-11px site in this stream to 11px
	// and the floor is a house rule, not a per-file preference.
	const labelClass = 'ml-1 text-xs font-bold uppercase tracking-tight opacity-80';

	const explanation = !policyReady || standardHours == null
		? 'The standard load is not set for this school year, so the percentage cannot be shown.'
		: utilization == null
			? PLACEHOLDER_TRUTH_LABEL
			: `Teaching hours a week in this teacher's busiest term, compared with the ${standardHours}h standard. Adviser and other-duty credit is counted separately.`;

	/*
	 * A6 c5 §3 — THE PLACEHOLDER LABEL IS ITS OWN LINE, not a token inside the
	 * hours. `to be hired — not a real person yet` is seven words; squeezing it
	 * into `15.0h · to be hired — not a real person yet` is exactly the cramming
	 * the operator rejected on the header, and the row is a dense number strip
	 * with three columns of figures beside it. A scheduler reads the sentence on
	 * its own line and the hours above it, and the row loses nothing.
	 *
	 * The `no standard set` state stays INLINE, because it is three words and it
	 * qualifies the figure directly beneath it. The two are different problems:
	 * one is about the year's policy, the other is about whether the person on
	 * this row exists yet.
	 */
	return (
		<>
			<Tooltip>
				<TooltipTrigger asChild>
					<p className={valueClass} data-testid="teacher-load-readout">
						<span data-testid="teacher-load-hours">{hours}</span>
						{utilization != null ? (
							<>
								<span aria-hidden="true"> · </span>
								<span data-testid="teacher-load-utilization">{utilization}%</span>
								{/* The visible label. Without it the percentage is a bare
								 * number, which is the whole defect. */}
								<span data-testid="teacher-load-utilization-label" className={labelClass}>
									of standard
								</span>
							</>
						) : !isPlaceholder ? (
							<>
								<span aria-hidden="true"> · </span>
								{/* A third state, stated rather than dropped: the figure is
								 * withheld on purpose, and the text says which reason. */}
								<span data-testid="teacher-load-no-percentage" className={cn(labelClass, 'italic')}>
									no standard set
								</span>
							</>
						) : null}
					</p>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-64 p-3">
					<p className="text-xs font-medium">{explanation}</p>
				</TooltipContent>
			</Tooltip>
			{isPlaceholder && (
				<p
					data-testid="teaching-load-placeholder-note"
					className="mt-0.5 text-xs font-bold leading-tight text-muted-foreground"
				>
					{PLACEHOLDER_TRUTH_LABEL}
				</p>
			)}
		</>
	);
}
