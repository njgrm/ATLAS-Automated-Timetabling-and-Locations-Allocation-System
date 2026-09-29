/**
 * TeachingLoadDraftActionBar — the draft Undo / Redo / Discard / Save group.
 *
 * FIX 40 (operator, 2026-09-28). This was a bottom STICKY FOOTER: a
 * `border-t bg-background px-3 py-2` bar pinned under the roster carrying a
 * `DRAFT STATUS` heading, a status sentence, and a helper paragraph, then
 * `Undo last` / `Discard draft` / `Save`.
 *
 * All of that chrome is DELETED and the three actions move into the primary
 * filter toolbar row (`TeachingLoadFilterBar`'s `draftControls` slot), right
 * side. Two reasons, both from the criterion rather than taste:
 *
 *  1. The footer was a permanent fourth band in a workspace whose header
 *     budget is already measured to single-digit pixels of headroom, and it
 *     pushed the LAST teacher row below the fold on a 768px viewport. The
 *     controls it carried were needed only when a draft existed.
 *  2. `DRAFT STATUS` was a heading, not information. The real status already
 *     reaches the operator through the save toast, the page's
 *     `draftStatusMessage`, and the `Save changes` button's own disabled state
 *     — a duplicate sentence in a footer bar is a second place to be wrong.
 *
 * THE SAVE IS NO LONGER A DIRECT COMMIT. `onSave` opens a confirmation; the
 * page decides what the confirmation says. That is the third clause of the same
 * item: saving rewrites faculty workloads and syncs with the scheduling
 * engine, which is not a click a scheduler should be able to make by reaching
 * for the nearest button.
 */
import { Redo2, Save, Undo2 } from 'lucide-react';

import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';

type TeachingLoadDraftActionBarProps = {
	activeDraftCount: number;
	canUndo: boolean;
	/** FIX 40: Redo was unreachable in the footer; the stack behind it is real. */
	canRedo: boolean;
	isReadOnlyMode: boolean;
	saving: boolean;
	onUndo: () => void;
	onRedo: () => void;
	onDiscard: () => void;
	onSave: () => void;
};

export function TeachingLoadDraftActionBar({
	activeDraftCount,
	canUndo,
	canRedo,
	isReadOnlyMode,
	saving,
	onUndo,
	onRedo,
	onDiscard,
	onSave,
}: TeachingLoadDraftActionBarProps) {
	const saveDisabled = activeDraftCount === 0 || saving || isReadOnlyMode;
	const undoDisabled = !canUndo || saving || isReadOnlyMode;
	const redoDisabled = !canRedo || saving || isReadOnlyMode;

	/*
	 * `size="icon-xs"` is NOT used for the two icon buttons. The
	 * `A3-C10-S3` note on `WorkspaceToolbar.tsx` records why: the `icon-*`
	 * variants contribute a `size-*` token that tailwind-merge does not treat
	 * as the same group as `h-*`, so a call site that declares both ships two
	 * competing heights and stylesheet order decides the winner. The
	 * `h-8 w-8` prefix here is declared once, on purpose.
	 */
	return (
		<div
			className="flex shrink-0 items-center gap-2"
			data-testid="teaching-load-draft-action-bar"
		>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						aria-label="Undo change"
						className="h-8 w-8 shrink-0 rounded-[min(var(--radius-md),12px)] p-0"
						onClick={onUndo}
						disabled={undoDisabled}
					>
						<Undo2 className="size-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="font-semibold">Undo change</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						aria-label="Redo change"
						className="h-8 w-8 shrink-0 rounded-[min(var(--radius-md),12px)] p-0"
						onClick={onRedo}
						disabled={redoDisabled}
					>
						<Redo2 className="size-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="font-semibold">Redo change</TooltipContent>
			</Tooltip>

			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-8 shrink-0 gap-1.5 px-2.5 text-xs font-semibold"
				onClick={onDiscard}
				disabled={saveDisabled}
			>
				Discard
			</Button>

			{/*
			 * The label is EXACTLY `Save changes` — the operator's words, and
			 * deliberately not the old `Save 3` count form. A count in the
			 * label changes what the button SAYS every time a draft changes,
			 * which is how a control stops being recognisable. The pending
			 * count is stated in the confirmation this opens.
			 *
			 * `opacity-60` only while disabled, so the button RECEDES at rest
			 * and comes forward the moment a draft exists — the "highlighted
			 * once a draft change exists" half of the criterion.
			 */}
			<Button
				type="button"
				size="sm"
				className={cn(
					'h-8 shrink-0 gap-1.5 px-3 text-xs font-bold uppercase tracking-tight',
					saveDisabled ? 'opacity-60' : 'shadow-sm',
				)}
				onClick={onSave}
				disabled={saveDisabled}
			>
				<Save className="size-4" />
				{saving ? 'Saving...' : 'Save changes'}
			</Button>
		</div>
	);
}
