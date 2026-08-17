import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, ChevronDown, ListChecks, Search, Sparkles, Undo2 } from 'lucide-react';

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
	// Phase 4.2: "Show next items" disclosure is CLOSED by default so the
	// scheduler focuses on one decision at a time.
	const [showNextItems, setShowNextItems] = useState(false);
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
			description: 'No urgent item is visible. Review the teacher list before generating a new timetable.',
			status: 'Ready for review',
			actionLabel: 'Review teachers',
		};
	const nextItems = orderedItems.filter((item) => item.id !== currentItem.id).slice(0, 3);
	const CurrentIcon = currentItem.kind === 'review-ready' ? CheckCircle2 : AlertTriangle;
	const actionDisabled = saving || Boolean(currentItem.disabledReason);
	const skippedCount = skippedItemIds.size;

	return (
		<section
			data-testid="teaching-load-repair-queue"
			className="shrink-0 border-b border-border/40 bg-background px-2 py-1"
			aria-label="Teaching Load guided next-step queue"
		>
			<div className="min-w-0">
				<div
					data-testid="teaching-load-current-repair"
					className={cn(
						'min-w-0 rounded-xl border p-1.5 shadow-sm',
						taskTone(currentItem.kind),
					)}
				>
					<div className="flex min-w-0 items-center gap-2">
						<div className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-background/80">
							<CurrentIcon className="size-4" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex min-w-0 flex-nowrap items-center gap-1.5">
								{/* Phase 4.2 + fix-language rule: "Next fix" -> "Next step". */}
								<Badge variant="outline" className="h-6 shrink-0 bg-background/70 px-2 text-[0.65rem] font-bold uppercase tracking-wide">
									<span className="sm:hidden">Next</span>
									<span className="hidden sm:inline">Next step</span>
									<span className="sr-only">Next step</span>
								</Badge>
								{currentItem.countLabel && (
									<Badge variant="outline" className="hidden h-6 shrink-0 bg-background/70 text-xs font-bold sm:inline-flex">
										{currentItem.countLabel}
									</Badge>
								)}
								<p className="min-w-0 truncate text-sm font-bold text-foreground">{currentItem.title}</p>
							</div>
							{/* Phase 4.2: description and status stay visible at every
								viewport height (the old max-height:800px hide removed). */}
						<div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
							<p className={cn("min-w-0 max-w-2xl truncate font-medium leading-5 text-muted-foreground", advancedGridVisible ? "hidden" : "hidden sm:block")}>{currentItem.description}</p>
							<p className="shrink-0 font-semibold text-foreground" aria-live="polite">{currentItem.status}</p>
						</div>
							{currentItem.disabledReason && (
								<p data-testid="teaching-load-repair-disabled-reason" className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
									{currentItem.disabledReason}
								</p>
							)}
						</div>
						<div className="flex shrink-0 flex-nowrap justify-end gap-1.5 overflow-x-auto">
							<Button
								type="button"
								size="sm"
								className="h-8 gap-1.5 px-2 font-bold"
								disabled={actionDisabled}
								onClick={() => onPrimaryAction(currentItem)}
								data-testid="teaching-load-repair-review"
							>
								<ClipboardCheck className="size-4" />
								<span className="max-w-24 truncate sm:max-w-none">{saving ? 'Saving...' : currentItem.actionLabel}</span>
							</Button>
							<Button type="button" variant="outline" size="sm" className="hidden h-8 px-2 font-semibold sm:inline-flex" onClick={() => setDetailsItem(currentItem)}>
								Details
							</Button>
						{/* Phase 4.2: Skip is visible at sm+ breakpoints. Hidden on mobile to prevent crowding. */}
						{!advancedGridVisible && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="hidden h-8 px-2 text-xs font-bold sm:inline-flex"
								onClick={() => onSkipItem(currentItem)}
							>
								Skip
							</Button>
						)}
						{!advancedGridVisible && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="hidden h-8 px-2 text-xs font-bold sm:inline-flex"
								data-testid="teaching-load-advanced-grid-toggle"
								onClick={onToggleAdvancedGrid}
							>
								Advanced grid
							</Button>
						)}
						</div>
					</div>
					{/* Phase 4.2: skipped items still need attention before generation. */}
					{skippedCount > 0 ? (
						<p className="mt-1.5 rounded-lg border border-border/50 bg-background/70 px-2 py-1 text-xs font-medium text-muted-foreground" data-testid="teaching-load-skipped-note">
							Skipped items still need action before generation. You can open them again from the list below.
						</p>
					) : null}
				</div>

				{!advancedGridVisible && (
			<div className="mt-3 border-t border-border/50 pt-3">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<ListChecks className="size-4 text-muted-foreground" />
						<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Next items</p>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<Button type="button" variant="ghost" size="sm" className="hidden h-8 gap-1.5 px-2 text-xs font-bold sm:inline-flex" onClick={() => setFindOpen(true)}>
							<Search className="size-3.5" />
							Find
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="hidden h-8 gap-1.5 px-2 text-xs font-bold sm:inline-flex"
							data-testid="teaching-load-next-items-grid-toggle"
							onClick={onToggleAdvancedGrid}
						>
							Advanced grid
						</Button>
						<Button type="button" variant="ghost" size="icon-sm" className="size-8" onClick={onUndo} disabled={!canUndo || saving || isReadOnly} aria-label="Undo last Teaching Load draft change">
							<Undo2 className="size-4" />
						</Button>
					</div>
				</div>
				{/* Phase 4.2: disclosure closed by default so only the current
					item is shown until the scheduler asks for more. */}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="mt-1 h-8 w-full justify-between gap-2 px-2 text-xs font-bold text-muted-foreground hover:text-foreground"
					onClick={() => setShowNextItems((show) => !show)}
					aria-expanded={showNextItems}
					aria-controls="teaching-load-next-items"
					data-testid="teaching-load-next-items-toggle"
				>
					<span>{showNextItems ? 'Hide next items' : 'Show next items'}</span>
					<ChevronDown className={cn('size-3.5 transition-transform', showNextItems && 'rotate-180')} />
				</Button>
				{/* Phase 4.2 audit fix: the container is always in the DOM so the
					aria-controls relationship stays valid; it is hidden with the
					`hidden` class while collapsed. */}
				<div id="teaching-load-next-items" className={cn('mt-1 grid gap-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3', !showNextItems && 'hidden')}>
					{nextItems.length > 0 ? nextItems.map((item) => (
						<Button
							key={item.id}
							type="button"
							variant="outline"
							data-testid="teaching-load-next-repair"
							className="h-auto min-h-10 min-w-0 justify-start rounded-lg border-border/50 bg-background px-2 py-1.5 text-left shadow-sm transition hover:border-primary/30 hover:bg-primary/5"
							onClick={() => onSelectItem(item)}
						>
							<span className="block min-w-0">
								<span className="block truncate text-xs font-bold text-foreground">{item.title}</span>
								<span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground">{item.status}</span>
							</span>
						</Button>
					)) : (
							<div className="col-span-full flex min-h-11 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
								<Sparkles className="size-4" />
								Nothing else needs review.
							</div>
						)}
				</div>
			</div>
			)}
			</div>

			<Dialog open={detailsItem !== null} onOpenChange={(open) => !open && setDetailsItem(null)}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{detailsItem?.title ?? 'Teaching Load next step'}</DialogTitle>
						<DialogDescription>{detailsItem?.description}</DialogDescription>
					</DialogHeader>
					<div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-sm">
						<p className="font-semibold text-foreground">{detailsItem?.status}</p>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							Use the primary action to open the exact view for this step. Use the advanced grid only when you need to inspect every subject and section manually.
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
							Start with the guided next-step queue. If the queue does not show the class you need, open the advanced grid, then search by teacher or section.
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
