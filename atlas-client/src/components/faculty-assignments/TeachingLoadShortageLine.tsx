/**
 * A6 c5 §1 — the shortage line: header row 2, one sentence, one button.
 *
 * WHAT IT REPLACES, and why it replaces rather than joins. Row 2 used to carry
 * three vocabularies for one fact — `89% staffed`, `12 classes need a teacher`,
 * `Temporary substitutes: 25` — plus a repair-queue item that routed the
 * scheduler to another tab to learn which subject was short. AGENTS.md §8 is
 * explicit that two chips saying the same thing is a violation, and the packet
 * is explicit that this line replaces the alert chip and the "Assign teachers to
 * open classes" item. The subtraction is done in `WorkspaceToolbar` and
 * `useTeachingLoadRepairQueue`; this component is what is left.
 *
 * WHY IT LIVES HERE AND NOT IN THE TOOLBAR. The toolbar already renders one
 * status sentence, and the line must BE that sentence rather than sit beside
 * it — but the line's content is derived from the page's ownership index, which
 * the toolbar has no access to. So the page builds the node and hands it to the
 * toolbar as a SLOT, exactly as it already does for the repair queue's
 * `stateLineSlot` and the `Load summary` control. The toolbar owns the POSITION
 * and the suppression rule; the page owns the figures; neither owns both.
 *
 * THE SUPPRESSION RULE IS THE INTERESTING PART, and it is a judgement the
 * packet's own words forced. The line replaces the ALERT CHIP. Read literally
 * that would delete `Above weekly max: N`, which is the one count that blocks
 * generation outright — so it does not. The `teacherx` clause (the placeholder
 * chip) is the one that is the SAME FACT restated in a second vocabulary, and it
 * is dropped whenever the line is showing. Over-cap and excess survive in the
 * no-shortage state, where they are the only thing on the row saying anything.
 *
 * ONE LOOK PER CONTROL (§8). `Cover these classes` is a `@/ui/button`, `size="sm"`,
 * with the same `h-7 … text-xs` chrome as every other row-2 action, so it is
 * the same control as `Review staff workload` beside it. The `+N more` link is
 * a `@/ui/button` in `variant="link"`, the same primitive the rest of ATLAS uses
 * for a detail affordance — not a second bespoke look.
 *
 * A6 c5 CORRECTION ROUND 1 (B2) — THE OVERFLOW IS STATED ONCE. This component
 * used to render a `+2 more` control while the sentence beside it ended
 * `· 2 more subjects ·`, so one fact appeared on one row twice, in two
 * vocabularies. The sentence no longer mentions the overflow; this control is
 * the whole statement of it, and its hover now says what it OPENS rather than
 * repeating how many subjects it hides. The count was not lost — the control
 * still carries it, and the detail it opens names the subjects by name.
 */
import { UserRoundPlus } from 'lucide-react';

import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

import {
	buildShortageLineModel,
	type ShortageLineModel,
	type SubjectShortageEntry,
} from '@/components/faculty-assignments/teachingLoadOutage';

/** The control the packet names. Not reworded: two surfaces must not drift. */
export const COVER_CLASSES_LABEL = 'Cover these classes';

export type TeachingLoadShortageLineProps = {
	line: ShortageLineModel;
	/** Total classes with no real teacher, so the button's tooltip can name it. */
	totalShortClasses: number;
	/** The first named subject, which is what the dialog opens on. */
	primarySubject: SubjectShortageEntry | null;
	/** Disabled when the workspace cannot be written to, with the reason. */
	writeBlockedReason: string | null;
	onCover: (entry: SubjectShortageEntry) => void;
	/** The existing coverage detail, for `+N more`. */
	onShowCoverageDetail: () => void;
};

export function TeachingLoadShortageLine({
	line,
	totalShortClasses,
	primarySubject,
	writeBlockedReason,
	onCover,
	onShowCoverageDetail,
}: TeachingLoadShortageLineProps) {
	if (line.visible.length === 0) return null;

	return (
		<span
			data-testid="teaching-load-shortage-line"
			className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full border border-border/60 bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground"
		>
			<span data-testid="teaching-load-shortage-text">{line.text}</span>

			{line.moreLabel && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto shrink-0 p-0 text-xs font-semibold"
							data-testid="teaching-load-shortage-more"
							// The visible label is the count, so the accessible name
							// STARTS with it and adds the destination. A name of
							// `+1 more` alone told a screen-reader user nothing about
							// what pressing it does.
							aria-label={`+${line.moreSubjectCount} more short ${line.moreSubjectCount === 1 ? 'subject' : 'subjects'} — ${line.moreLabel}`}
							onClick={onShowCoverageDetail}
						>
							{`+${line.moreSubjectCount} more`}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-72 text-xs font-medium">
						{line.moreLabel}
					</TooltipContent>
				</Tooltip>
			)}

			{primarySubject && (
				<Tooltip>
					<TooltipTrigger asChild>
						<span>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
								disabled={Boolean(writeBlockedReason)}
								data-testid="teaching-load-cover-open"
								data-subject-id={primarySubject.subjectId}
								onClick={() => onCover(primarySubject)}
							>
								<UserRoundPlus className="size-3.5" aria-hidden="true" />
								{COVER_CLASSES_LABEL}
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-72 text-xs font-semibold">
						{writeBlockedReason
							? writeBlockedReason
							: `${COVER_CLASSES_LABEL} in ${primarySubject.subjectName}, the subject with the most classes missing a teacher. ${totalShortClasses} in total need one.`}
					</TooltipContent>
				</Tooltip>
			)}
		</span>
	);
}

/**
 * The model the page hands the line, re-exported so the page does not import
 * two modules for one decision. The `dataDateLabel` argument is the page's real
 * `sectionSummary.fetchedAt`; `null` drops the clause rather than inventing a
 * date.
 */
export { buildShortageLineModel };
