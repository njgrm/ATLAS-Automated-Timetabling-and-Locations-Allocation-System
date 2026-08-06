import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, ListChecks, MoreHorizontal, Search, Sparkles, Undo2 } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
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
	skippedItemIds: Set<string>;
	activeItemId?: string | null;
	isReadOnly: boolean;
	canUndo: boolean;
	saving: boolean;
	advancedGridVisible: boolean;
	onPrimaryAction: (item: TeachingLoadRepairQueueItem) => void;
	onSelectItem: (item: TeachingLoadRepairQueueItem) => void;
	onSkipItem: (item: TeachingLoadRepairQueueItem) => void;
	onUndo: () => void;
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

export function TeachingLoadRepairQueue({
	items,
	skippedItemIds,
	activeItemId,
	isReadOnly,
	canUndo,
	saving,
	advancedGridVisible,
	onPrimaryAction,
	onSelectItem,
	onSkipItem,
	onUndo,
	onToggleAdvancedGrid,
}: TeachingLoadRepairQueueProps) {
	const [detailsItem, setDetailsItem] = useState<TeachingLoadRepairQueueItem | null>(null);
	const [findOpen, setFindOpen] = useState(false);
	const orderedItems = useMemo(
		() => [
			...items.filter((item) => !skippedItemIds.has(item.id)),
			...items.filter((item) => skippedItemIds.has(item.id)),
		],
		[items, skippedItemIds],
	);
	const currentItem =
		orderedItems.find((item) => item.id === activeItemId)
		?? orderedItems[0]
		?? {
			id: 'review-ready',
			kind: 'review-ready' as const,
			title: 'Teaching Load looks ready',
			description: 'No urgent repair item is visible. Review the teacher list before generating a new timetable.',
			status: 'Ready for review',
			actionLabel: 'Review teachers',
		};
	const nextItems = orderedItems.filter((item) => item.id !== currentItem.id).slice(0, 3);
	const CurrentIcon = currentItem.kind === 'review-ready' ? CheckCircle2 : AlertTriangle;
	const actionDisabled = saving || Boolean(currentItem.disabledReason);

	return (
		<section
			data-testid="teaching-load-repair-queue"
			className="shrink-0 border-b border-border/40 bg-background px-2.5 py-1 lg:px-4"
			aria-label="Guided Teaching Load repair queue"
		>
			<div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
				<div
					data-testid="teaching-load-current-repair"
					className={cn(
						'min-w-0 rounded-xl border p-2 shadow-sm',
						taskTone(currentItem.kind),
					)}
				>
					<div className="flex min-w-0 items-start gap-2">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background/80">
							<CurrentIcon className="size-4" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								<Badge variant="outline" className="h-6 bg-background/70 text-[0.65rem] font-bold uppercase tracking-wide">
									Next fix
								</Badge>
								{currentItem.countLabel && (
									<Badge variant="outline" className="h-6 bg-background/70 text-[0.65rem] font-bold">
										{currentItem.countLabel}
									</Badge>
								)}
								<p className="min-w-0 truncate text-sm font-bold text-foreground">{currentItem.title}</p>
							</div>
							<p className="mt-0.5 line-clamp-1 text-xs font-medium leading-5 text-muted-foreground">{currentItem.description}</p>
							<p className="mt-0.5 text-xs font-semibold text-foreground [@media(max-height:500px)]:hidden" aria-live="polite">{currentItem.status}</p>
							{currentItem.disabledReason && (
								<p data-testid="teaching-load-repair-disabled-reason" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
									{currentItem.disabledReason}
								</p>
							)}
						</div>
						<div className="flex shrink-0 flex-wrap justify-end gap-2">
							<Button
								type="button"
								size="sm"
								className="h-8 gap-2 font-bold"
								disabled={actionDisabled}
								onClick={() => onPrimaryAction(currentItem)}
								data-testid="teaching-load-repair-review"
							>
								<ClipboardCheck className="size-4" />
								{saving ? 'Saving...' : currentItem.actionLabel}
							</Button>
							<Button type="button" variant="outline" size="sm" className="h-8 font-semibold [@media(max-height:500px)]:hidden" onClick={() => setDetailsItem(currentItem)}>
								Details
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-8 px-2 text-xs font-bold sm:hidden"
								onClick={() => onSkipItem(currentItem)}
							>
								Skip
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-8 px-2 text-xs font-bold"
								data-testid="teaching-load-advanced-grid-toggle"
								onClick={onToggleAdvancedGrid}
							>
								{advancedGridVisible ? 'Hide grid' : 'Advanced grid'}
							</Button>
						</div>
					</div>
				</div>

				<div className="min-w-0 rounded-xl border border-border/50 bg-muted/20 p-1.5 [@media(max-width:640px)]:hidden [@media(max-height:500px)]:hidden">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<ListChecks className="size-4 text-muted-foreground" />
							<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Next items</p>
						</div>
						<div className="flex shrink-0 items-center gap-1.5">
							<Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs font-bold" onClick={() => setFindOpen(true)}>
								<Search className="size-3.5" />
								Find
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 gap-1.5 px-2 text-xs font-bold"
								data-testid="teaching-load-advanced-grid-toggle"
								onClick={onToggleAdvancedGrid}
							>
								<MoreHorizontal className="size-3.5" />
								{advancedGridVisible ? 'Hide grid' : 'Advanced grid'}
							</Button>
							<Button type="button" variant="ghost" size="icon-sm" className="size-8" onClick={onUndo} disabled={!canUndo || saving || isReadOnly} aria-label="Undo last Teaching Load draft change">
								<Undo2 className="size-4" />
							</Button>
						</div>
					</div>
					<div className="mt-1.5 grid gap-1.5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
						{nextItems.length > 0 ? nextItems.map((item) => (
							<Button
								key={item.id}
								type="button"
								variant="outline"
								data-testid="teaching-load-next-repair"
								className="h-auto min-h-11 min-w-0 justify-start rounded-lg border-border/50 bg-background px-2.5 py-2 text-left shadow-sm transition hover:border-primary/30 hover:bg-primary/5"
								onClick={() => onSelectItem(item)}
							>
								<span className="block min-w-0">
									<span className="block truncate text-xs font-bold text-foreground">{item.title}</span>
									<span className="mt-0.5 block truncate text-[0.68rem] font-medium text-muted-foreground">{item.status}</span>
								</span>
							</Button>
						)) : (
							<div className="col-span-full flex min-h-11 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
								<Sparkles className="size-4" />
								No urgent repair queued.
							</div>
						)}
					</div>
					<div className="mt-1.5 flex flex-wrap items-center gap-2">
						<Button type="button" variant="ghost" size="sm" className="h-8 text-xs font-bold" onClick={() => onSkipItem(currentItem)}>
							Skip this one
						</Button>
						<p className="text-xs font-medium text-muted-foreground">Skipping only changes this local queue order.</p>
					</div>
				</div>
			</div>

			<Dialog open={detailsItem !== null} onOpenChange={(open) => !open && setDetailsItem(null)}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{detailsItem?.title ?? 'Teaching Load repair'}</DialogTitle>
						<DialogDescription>{detailsItem?.description}</DialogDescription>
					</DialogHeader>
					<div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-sm">
						<p className="font-semibold text-foreground">{detailsItem?.status}</p>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							Use the primary action to open the exact repair view. Use the advanced grid only when you need to inspect every subject and section manually.
						</p>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setDetailsItem(null)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={findOpen} onOpenChange={setFindOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Find a teacher or section</DialogTitle>
						<DialogDescription>
							Use the search and More filters controls in the grid below when you know the teacher, department, section, or subject to inspect.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-2 rounded-xl border border-border/50 bg-muted/30 p-3 text-sm">
						<p className="font-semibold text-foreground">Recommended path</p>
						<p className="text-xs leading-5 text-muted-foreground">
							Start with the guided repair queue. If the queue does not show the class you need, open the advanced grid, then search by teacher or section.
						</p>
					</div>
					<DialogFooter>
						<Button type="button" onClick={() => {
							if (!advancedGridVisible) onToggleAdvancedGrid();
							setFindOpen(false);
						}}>
							Open advanced grid
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
