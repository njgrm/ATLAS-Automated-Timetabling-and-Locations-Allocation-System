import { AlertTriangle, CheckCircle2, ClipboardCheck } from 'lucide-react';

import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';

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
	advancedGridVisible: boolean;
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
	description: 'No urgent item is visible. Review the teacher list before generating a new timetable.',
	status: 'Ready for review',
	actionLabel: 'Review teachers',
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
 * `disabledReason` is a SAFETY state, so it is NOT behind a hover at all: it
 * renders as its own visible warning chip naming the reason.
 */
export function TeachingLoadRepairQueue({
	items,
	activeItemId,
	isReadOnly,
	saving,
	advancedGridVisible,
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
			aria-label="Teaching Load guided next-step queue"
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
						className={cn('flex h-7 min-w-0 items-center gap-1.5 rounded-full border px-2 text-xs font-semibold shadow-sm', taskTone(currentItem.kind))}
					>
						<CurrentIcon className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="shrink-0 text-xs font-bold uppercase tracking-wide">Next step</span>
						{currentItem.countLabel && (
							/* A <span>, not a @/ui Badge: the badge primitive is a
							 * <div>, and this chip is a <span> so it can sit inside the
							 * state line without an invalid nested block element. */
							<span className="h-5 shrink-0 rounded-full border border-current/30 bg-background/70 px-1.5 text-[11px] font-bold leading-5 text-foreground">
								{currentItem.countLabel}
							</span>
						)}
						<span className="min-w-0 truncate font-bold text-foreground">{currentItem.title}</span>
						{/* Announced, and visible: the status is never a hover-only fact. */}
						<span className="hidden shrink-0 font-semibold sm:inline" aria-live="polite" data-testid="teaching-load-repair-status">
							{currentItem.status}
						</span>
					</span>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-80 text-xs font-medium leading-relaxed">
					{/* The one thing that moved behind a hover. On the guided
						placeholder the advanced grid is not up yet, so the queue
						still explains itself in full. */}
					{advancedGridVisible ? currentItem.description : `${currentItem.description} ${currentItem.status}`}
				</TooltipContent>
			</Tooltip>

			{/* A safety state, so it stays visible rather than becoming a hover. */}
			{currentItem.disabledReason && (
				<span
					data-testid="teaching-load-repair-disabled-reason"
					className="flex h-7 shrink-0 max-w-64 items-center truncate rounded-full border border-warning-border bg-warning-muted px-2 text-xs font-semibold text-warning-foreground"
				>
					{currentItem.disabledReason}
				</span>
			)}

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
				<span className="max-w-32 truncate">{actionLabel}</span>
			</Button>
		</section>
	);
}
