import { AlertTriangle, CheckCircle2, ClipboardCheck } from 'lucide-react';

import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import { STAFF_WORKLOAD_REVIEW_LABEL } from '@/components/faculty-assignments/teacherReviewEntry';

export type TeachingLoadRepairTaskKind =
	| 'save-draft'
	| 'missing-load'
	| 'teacher-missing-load'
	| 'over-cap'
	| 'placeholder'
	| 'review-ready'
	| 'read-only';

export type TeachingLoadRepairQueueItem = {
	id: string;
	kind: TeachingLoadRepairTaskKind;
	title: string;
	description: string;
	status: string;
	actionLabel: string;
	facultyId?: number;
	disabledReason?: string | null;
	countLabel?: string;
};

type TeachingLoadRepairQueueProps = {
	items: TeachingLoadRepairQueueItem[];
	activeItemId?: string | null;
	isReadOnly: boolean;
	saving: boolean;
	onPrimaryAction: (item: TeachingLoadRepairQueueItem) => void;
};

function taskTone(kind: TeachingLoadRepairTaskKind) {
	if (kind === 'save-draft') return 'border-sky-200 bg-sky-50 text-sky-700';
	if (kind === 'over-cap') return 'border-rose-200 bg-rose-50 text-rose-700';
	if (kind === 'missing-load' || kind === 'teacher-missing-load') return 'border-warning-border bg-warning-muted text-warning';
	if (kind === 'placeholder') return 'border-violet-200 bg-violet-50 text-violet-700';
	if (kind === 'read-only') return 'border-slate-200 bg-slate-50 text-slate-700';
	return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

const FALLBACK_ITEM: TeachingLoadRepairQueueItem = {
	id: 'review-ready',
	kind: 'review-ready',
	title: 'Teaching Load looks ready',
	description: 'No urgent item is visible. Review the staff workload once before generating.',
	status: 'Ready for review',
	// A6 C2 (Slice 5): imported from the ONE opener module, so this label and the
	// hook's `review-ready` item cannot drift into two different words.
	actionLabel: STAFF_WORKLOAD_REVIEW_LABEL,
};

/**
 * One compact, task-first next-step surface. The repair queue owns the single
 * page-level primary action; all secondary navigation lives in the workspace
 * tabs and filters, so there are no competing Details/Skip/Find controls.
 *
 * A3-C10-S3 — this is the "Next Step" surface the header compaction folded
 * into the workspace's single state line (row 2 of the command strip), so it
 * renders as ONE `h-7` horizontal band instead of a `h-9` two-line card.
 * Before: `py-1` band + `border`/`p-1.5` card + a 24px "Next step" badge row
 * + a 16px description row; the committed control derives 58px for the whole
 * banner, because its tallest member is the 36px `h-9` action button. After:
 * 28px, the same height as every other chip on that line.
 *
 * TRUTH IS NOT DECORATION — what moved and how it stays announced:
 *
 *   state          before                          after
 *   -------------  ------------------------------  ---------------------------
 *   what to do     `Next step` badge + title        same, on the chip
 *   how many       `countLabel` badge               same, on the chip
 *   item status    second line, `aria-live`         same, on the chip, `aria-live`
 *   description    second line, truncate            Tooltip on the chip
 *   why disabled   own warning line below          own warning CHIP on the line
 *   the action     `h-9` primary button             `h-7` primary button, same
 *                  data-testid                      label, same data-testid
 *
 * The description is the ONLY thing that moved behind a hover, and the trigger
 * already states the task, its count and its status without it. The
 * `disabledReason` is a SAFETY state, so it is NOT behind a hover at all: it is
 * visible text on the chip itself (see the A6 c4 note at its render site).
 *
 * A6 c4 (G1) — the `advancedGridVisible` prop is GONE. It existed so the chip
 * could restate the item's status in its tooltip only while the grid was hidden,
 * because the placeholder in front of the grid was where a scheduler read the
 * status from. Guided mode is removed, so the grid is always up and the status is
 * always on the chip; the "grid was closed" branch has no remaining state, and
 * reviving the gate to express it is exactly what this slice deletes.
 *
 * A6 c4 (G2) — two further changes, both from the operator's Header budget:
 *   1. ONE amber line. `disabledReason` used to render as its OWN amber pill
 *      beside the header's amber degraded notice, which is the "two amber lines
 *      when EnrollPro is unreachable" Lane C measured on train 3. It is now
 *      visible text INSIDE this chip, in the warning colour but with no fill and
 *      no border of its own, so row 2 can only ever carry one filled warning
 *      surface — and the reason is still readable, which a hover would not be.
 *   2. NO truncated sentence. The title, the status, the reason and the action
 *      label all lost `truncate`. The chip wraps (`min-h-7` + `flex-wrap`) rather
 *      than cutting a claim off mid-word, and `a6-tl-header-budget` measures the
 *      declared row content against the 1366px row so the wrap is a fallback and
 *      not the normal case.
 */
export function TeachingLoadRepairQueue({
	items,
	activeItemId,
	isReadOnly,
	saving,
	onPrimaryAction,
}: TeachingLoadRepairQueueProps) {
	const currentItem = items.find((item) => item.id === activeItemId) ?? items[0] ?? FALLBACK_ITEM;
	const CurrentIcon = currentItem.kind === 'review-ready' ? CheckCircle2 : AlertTriangle;
	const actionDisabled = saving || isReadOnly || Boolean(currentItem.disabledReason);
	const actionLabel = saving ? 'Saving...' : currentItem.actionLabel;

	return (
		<section
			data-testid="teaching-load-repair-queue"
			className="flex min-w-0 shrink items-center"
			aria-label="Teaching Load next-step queue"
		>
			<Tooltip>
				<TooltipTrigger asChild>
					{/*
					 * The chip is the announcement: the kind, the count, the task
					 * and the live status are all its own text, so an operator can
					 * see that work is queued without opening anything.
					 */}
					<span
						data-testid="teaching-load-current-repair"
						data-repair-kind={currentItem.kind}
						className={cn('flex min-h-7 min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm', taskTone(currentItem.kind))}
					>
						<CurrentIcon className="size-3.5 shrink-0" aria-hidden="true" />
						{/* A6 C2 (Slice 2): `Next step` is a LABEL on the header's one
					    status line. It was `uppercase tracking-wide`, one of the
					    letter-spaced ALL-CAPS labels the operator rejected across the
					    Teaching Load header; sentence case, no tracking. */}
					<span className="shrink-0 text-xs font-bold">Next step</span>
						{currentItem.countLabel && (
							/* A <span>, not a @/ui Badge: the badge primitive is a
							 * <div>, and this chip is a <span> so it can sit inside the
							 * state line without an invalid nested block element. */
							<span className="h-5 shrink-0 rounded-full border border-current/30 bg-background/70 px-1.5 text-[11px] font-bold leading-5 text-foreground">
								{currentItem.countLabel}
							</span>
						)}
						<span className="font-bold text-foreground">{currentItem.title}</span>
						{/* Announced, and visible: the status is never a hover-only fact. */}
						<span className="font-semibold" aria-live="polite" data-testid="teaching-load-repair-status">
							{currentItem.status}
						</span>
						{/*
						 * A6 c4 (G2.1): the safety reason, on the chip. Visible text
						 * (so a scheduler who cannot use the action can still read
						 * why), warning-coloured, and deliberately NOT a second filled
						 * amber pill beside the header's degraded notice. `·` separates
						 * it from the item's own status so the two claims are not read
						 * as one sentence.
						 */}
						{currentItem.disabledReason && (
							<span
								data-testid="teaching-load-repair-disabled-reason"
								className="font-semibold text-warning-foreground"
							>
								· {currentItem.disabledReason}
							</span>
						)}
					</span>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-80 text-xs font-medium leading-relaxed">
					{/* The one thing that moved behind a hover. A6 c4 (G1): the
					 * status is no longer restated here, because the grid behind
					 * this chip is always rendered, so the status the trigger
					 * states is never a hover away. */}
					{currentItem.description}
				</TooltipContent>
			</Tooltip>

			<Button
				type="button"
				size="sm"
				className="h-7 shrink-0 gap-1.5 px-2.5 font-bold"
				disabled={actionDisabled}
				onClick={() => onPrimaryAction(currentItem)}
				aria-label={actionLabel}
				data-testid="teaching-load-repair-review"
			>
				<ClipboardCheck className="size-3.5" />
				<span>{actionLabel}</span>
			</Button>
		</section>
	);
}
