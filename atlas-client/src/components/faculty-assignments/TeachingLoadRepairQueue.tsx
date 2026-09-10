import { AlertTriangle, CheckCircle2, ClipboardCheck } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
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
	onToggleAdvancedGrid: () => void;
};

function taskTone(kind: TeachingLoadRepairTaskKind) {
	if (kind === 'save-draft') return 'border-sky-200 bg-sky-50 text-sky-700';
	if (kind === 'over-cap') return 'border-rose-200 bg-rose-50 text-rose-700';
	if (kind === 'missing-load' || kind === 'teacher-missing-load') return 'border-amber-200 bg-amber-50 text-amber-700';
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
 */
export function TeachingLoadRepairQueue({
	items,
	activeItemId,
	isReadOnly,
	saving,
	advancedGridVisible,
	onPrimaryAction,
	onToggleAdvancedGrid,
}: TeachingLoadRepairQueueProps) {
	const currentItem = items.find((item) => item.id === activeItemId) ?? items[0] ?? FALLBACK_ITEM;
	const CurrentIcon = currentItem.kind === 'review-ready' ? CheckCircle2 : AlertTriangle;
	const actionDisabled = saving || isReadOnly || Boolean(currentItem.disabledReason);

	return (
		<section
			data-testid="teaching-load-repair-queue"
			className="shrink-0 border-b border-border/40 bg-background px-2 py-1"
			aria-label="Teaching Load guided next-step queue"
		>
			<div
				data-testid="teaching-load-current-repair"
				className={cn('min-w-0 rounded-xl border p-1.5 shadow-sm', taskTone(currentItem.kind))}
			>
				<div className="flex min-w-0 items-center gap-2">
					<div className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-background/80">
						<CurrentIcon className="size-4" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex min-w-0 flex-nowrap items-center gap-1.5">
							<Badge variant="outline" className="h-6 shrink-0 bg-background/70 px-2 text-xs font-bold uppercase tracking-wide">
								Next step
							</Badge>
							{currentItem.countLabel && (
								<Badge variant="outline" className="hidden h-6 shrink-0 bg-background/70 text-xs font-bold sm:inline-flex">
									{currentItem.countLabel}
								</Badge>
							)}
							<p className="min-w-0 truncate text-sm font-bold text-foreground">{currentItem.title}</p>
						</div>
						<div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
							<p className={cn('min-w-0 max-w-2xl truncate font-medium leading-5 text-muted-foreground', advancedGridVisible ? 'hidden' : 'hidden sm:block')}>
								{currentItem.description}
							</p>
							<p className="shrink-0 font-semibold text-foreground" aria-live="polite">{currentItem.status}</p>
						</div>
						{currentItem.disabledReason && (
							<p data-testid="teaching-load-repair-disabled-reason" className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
								{currentItem.disabledReason}
							</p>
						)}
					</div>
					<div className="flex shrink-0 flex-nowrap justify-end gap-1.5">
						<Button
							type="button"
							size="sm"
							className="h-9 gap-1.5 px-3 font-bold"
							disabled={actionDisabled}
							onClick={() => onPrimaryAction(currentItem)}
							data-testid="teaching-load-repair-review"
						>
							<ClipboardCheck className="size-4" />
							<span className="max-w-32 truncate">{saving ? 'Saving...' : currentItem.actionLabel}</span>
						</Button>
						{!advancedGridVisible && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="hidden h-9 px-3 text-xs font-bold sm:inline-flex"
								data-testid="teaching-load-advanced-grid-toggle"
								onClick={onToggleAdvancedGrid}
							>
								Browse all
							</Button>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
