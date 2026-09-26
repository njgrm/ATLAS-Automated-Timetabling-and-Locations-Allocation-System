import { History, Redo2, Undo2 } from 'lucide-react';

import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { UNDO_CONFLICT_MESSAGE, UNDO_CANNOT_BE_REDONE } from '@/components/timetable/timetableUndoRedoState';

export type UndoRedoControlState = {
	editHistoryCount: number;
	revertLoading: boolean;
	revertLastEdit: () => Promise<void>;
	redoState: { operationId: number; expectedVersion: number; label: string } | null;
	/**
	 * RETAINED NAME, CORRECTED MEANING (A2-TIMETABLE-CUSTODY-R2). It is raised by a
	 * refused `UNDO_CONFLICT`, which is not only ever a version change: three of the
	 * five causes `assertUndoHead` raises move no version. The prop and its
	 * `timetable-version-stale` testid are kept so the accepted assertions in
	 * `timetable-dynamic-workspace-undo-redo.test.ts:115,124` are not deleted to close
	 * this finding (AGENTS.md §16); what it RENDERS is now `UNDO_CONFLICT_MESSAGE`,
	 * which asserts no version.
	 */
	redoVersionStale: boolean;
	redoLastEdit: () => Promise<void>;
	clearRedo: () => void;
	setShowEditHistory: (value: boolean) => void;
	/**
	 * A2-TIMETABLE-CUSTODY-R2 — the plain fact to SHOW when the last revert left
	 * nothing the server can redo. Optional so an older caller that omits it renders
	 * no Redo and no claim rather than a dangling one.
	 */
	undoNotice?: string | null;
	/** A2-TIMETABLE-CUSTODY-R2 — why the Undo button is disabled, or `null` when it is live. */
	undoBlockedReason?: string | null;
};

/**
 * R4 — one visible, truthful Undo / Redo / History control shared by the
 * workspace shell. Undo targets the latest edit id with a version CAS; Redo
 * re-dispatches the same server endpoint with a fresh CAS and shows a
 * `Version-stale` state (dispatching nothing) when the CAS no longer matches.
 *
 * A2-TIMETABLE-CUSTODY-R2 corrects the Redo half. A Redo is armed ONLY when the
 * ledger row the target names is one the server can revert
 * (`assessRedoAfterRevert`); the row a revert itself creates is a `REVERT` row, and
 * the route selects targets with `editType: { not: 'REVERT' }`
 * (`manual-edit.service.ts:1675`), so re-dispatching it is a guaranteed 409. The Redo
 * button is therefore inert after a revert, and `undoNotice` states in plain words
 * why. It is not removed: the accepted `timetable-visible-redo` assertion is retained
 * (AGENTS.md §16), and an inert button that carries its reason is neither a control
 * that fails nor a silent absence.
 */
export function TimetableUndoRedoControl({
	editHistoryCount,
	revertLoading,
	revertLastEdit,
	redoState,
	redoVersionStale,
	redoLastEdit,
	clearRedo,
	setShowEditHistory,
	undoNotice = null,
	undoBlockedReason = null,
}: UndoRedoControlState) {
	return (
		<div className="flex items-center gap-1.5" data-testid="timetable-undo-redo-control">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						{/* The span keeps the tooltip reachable on the DISABLED button, which
						 * Radix will not fire from. AGENTS.md §8: no raw `title`. */}
						<span className="inline-flex">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
								disabled={revertLoading || editHistoryCount === 0 || undoBlockedReason !== null}
								onClick={() => void revertLastEdit()}
								data-testid="timetable-visible-undo"
								aria-label="Undo last manual timetable change"
							>
								<Undo2 className="size-3.5" aria-hidden="true" />
								<span className="hidden sm:inline">Undo</span>
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent>{undoBlockedReason ?? 'Undo the last manual timetable change'}</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="inline-flex">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
								disabled={revertLoading || !redoState}
								onClick={() => void redoLastEdit()}
								data-testid="timetable-visible-redo"
								// The accessible name carries the reason too, so the claim does
								// not depend on a hover being available.
								aria-label={redoState ? 'Redo the last reverted change' : 'Redo is unavailable: this undo cannot be undone'}
							>
								<Redo2 className="size-3.5" aria-hidden="true" />
								<span className="hidden sm:inline">Redo</span>
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent>{redoState ? 'Redo the last reverted change' : `${UNDO_CANNOT_BE_REDONE} This control is inert until an undoable change is the latest one.`}</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			{undoBlockedReason ? (
				/* A2-TIMETABLE-CUSTODY-R2: the reason is RENDERED, not only placed in a
				 * tooltip. A disabled control whose explanation needs a hover is silence
				 * for a keyboard or touch operator, and the accepted history-row precedent
				 * (`TimetableAssignmentDialogs.tsx:160-162`) states its absence visibly. */
				<span
					role="status"
					data-testid="timetable-undo-blocked-reason"
					className="max-w-[24rem] rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground"
				>
					{undoBlockedReason}
				</span>
			) : null}
			{undoNotice ? (
				<span
					role="status"
					data-testid="timetable-cannot-redo"
					className="max-w-[24rem] rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground"
				>
					{undoNotice}
				</span>
			) : null}
			{redoVersionStale ? (
				/* The full shared sentence is the visible text, not a two-word label: the
				 * operator's only durable record of a refused undo has to say what
				 * happened, and a bare "Undo conflict" does not. `max-w` + wrapping keeps
				 * the header bar bounded; the no-scroll shell is untouched. */
				<span
					role="status"
					data-testid="timetable-version-stale"
					className="max-w-[24rem] rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive"
				>
					{UNDO_CONFLICT_MESSAGE}
				</span>
			) : null}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-8 gap-1.5"
				disabled={editHistoryCount === 0}
				onClick={() => setShowEditHistory(true)}
				data-testid="timetable-visible-history"
			>
				<History className="size-3.5" aria-hidden="true" />
				<span className="hidden sm:inline">History</span>
				{editHistoryCount > 0 ? <span className="text-xs text-muted-foreground">{editHistoryCount}</span> : null}
			</Button>
			{redoVersionStale || undoNotice ? (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearRedo} data-testid="timetable-version-stale-dismiss">
								Dismiss
							</Button>
						</TooltipTrigger>
						<TooltipContent>{UNDO_CONFLICT_MESSAGE}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			) : null}
		</div>
	);
}
