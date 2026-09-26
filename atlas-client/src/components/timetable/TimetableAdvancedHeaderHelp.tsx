import { Loader2, Undo2 } from 'lucide-react';

import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { TimetableStatusLegend } from '@/components/timetable/TimetableStatusLegend';

/**
 * B2 — the Advanced header's plain-language placement guidance.
 *
 * The same good copy already visible in Simple, kept to one short line so
 * sighted operators see it without opening the 7-step tutorial. It is
 * deliberately NOT `sr-only`: the `#timetable-foolproof-help` id stays on the
 * visible element so every task button's `aria-describedby` still resolves.
 */
export type AdvancedHeaderHelpMode = 'schedule' | 'draft';

const GUIDANCE: Record<AdvancedHeaderHelpMode, string> = {
	// One sentence each: the action, the object, and the preview-before-save promise.
	schedule: 'Place or switch: choose a session, then click a slot. ATLAS previews the result before anything is saved.',
	draft: 'Draft: choose a queue item, then click a slot. The draft review opens before anything is saved.',
};

export function resolveAdvancedHeaderGuidance(mode: AdvancedHeaderHelpMode): string {
	return GUIDANCE[mode];
}

export type TimetableAdvancedHeaderHelpProps = {
	mode: AdvancedHeaderHelpMode;
	/** The currently active task's helper line, shown on small screens. */
	activeTaskHelper: string;
	editHistoryCount: number;
	revertLoading: boolean;
	onRevertLastEdit: () => void;
	/**
	 * A2-TIMETABLE-CUSTODY-R2 — the shared Undo decision, read not re-derived. With a
	 * `REVERT` at the head of the ledger this button used to stay enabled and dispatch
	 * an id the server cannot select as a target
	 * (`editType: { not: 'REVERT' }`, `manual-edit.service.ts:1675`), so it could
	 * only 409. It now disables, and `undoBlockedReason` is the reason shown.
	 *
	 * Both are OPTIONAL and default FAIL-CLOSED (`false` / `null`): a caller that
	 * omits the shared decision gets a disabled Undo, never a button that can only
	 * fail. Every production call site passes both.
	 */
	lastEditUndoable?: boolean;
	undoBlockedReason?: string | null;
};

export function TimetableAdvancedHeaderHelp({
	mode,
	activeTaskHelper,
	editHistoryCount,
	revertLoading,
	onRevertLastEdit,
	lastEditUndoable = false,
	undoBlockedReason = null,
}: TimetableAdvancedHeaderHelpProps) {
	const guidance = resolveAdvancedHeaderGuidance(mode);
	return (
		<div
			id="timetable-foolproof-help"
			data-testid="timetable-foolproof-help"
			className="flex min-w-0 items-center justify-between gap-3 border-b border-border/60 bg-background px-4 pb-1.5 text-xs text-muted-foreground"
		>
			<p className="min-w-0 line-clamp-1" data-testid="timetable-foolproof-help-text">
				<span className="font-semibold text-foreground">No precision dragging required.</span>{' '}
				<span className="hidden md:inline">{guidance}</span>
				<span className="md:hidden">{activeTaskHelper}</span>
			</p>
			<div className="flex shrink-0 items-center gap-2">
				<TimetableStatusLegend />
				{editHistoryCount > 0 && mode === 'schedule' && (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="inline-flex">
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="hidden h-8 gap-1.5 border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 md:inline-flex"
										onClick={onRevertLastEdit}
										disabled={revertLoading || !lastEditUndoable}
										data-testid="timetable-visible-undo"
										aria-label="Undo last manual timetable change"
									>
										{revertLoading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Undo2 className="size-3.5" aria-hidden="true" />}
										<span className="hidden sm:inline">Undo last change</span>
										<span className="sm:hidden">Undo</span>
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>{undoBlockedReason ?? 'Undo the last manual timetable change'}</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}
			</div>
		</div>
	);
}
