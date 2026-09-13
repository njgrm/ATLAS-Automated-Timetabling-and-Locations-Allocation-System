import { History, Redo2, Undo2 } from 'lucide-react';

import { Button } from '@/ui/button';

export type UndoRedoControlState = {
	editHistoryCount: number;
	revertLoading: boolean;
	revertLastEdit: () => Promise<void>;
	redoState: { operationId: number; expectedVersion: number; label: string } | null;
	redoVersionStale: boolean;
	redoLastEdit: () => Promise<void>;
	clearRedo: () => void;
	setShowEditHistory: (value: boolean) => void;
};

/**
 * R4 — one visible, truthful Undo / Redo / History control shared by the
 * workspace shell. Undo targets the latest edit id with a version CAS; Redo
 * re-dispatches the same server endpoint with a fresh CAS and shows a
 * `Version-stale` state (dispatching nothing) when the CAS no longer matches.
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
}: UndoRedoControlState) {
	return (
		<div className="flex items-center gap-1.5" data-testid="timetable-undo-redo-control">
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-8 gap-1.5"
				disabled={revertLoading || editHistoryCount === 0}
				onClick={() => void revertLastEdit()}
				data-testid="timetable-visible-undo"
				aria-label="Undo last manual timetable change"
			>
				<Undo2 className="size-3.5" aria-hidden="true" />
				<span className="hidden sm:inline">Undo</span>
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-8 gap-1.5"
				disabled={revertLoading || !redoState}
				onClick={() => void redoLastEdit()}
				data-testid="timetable-visible-redo"
				aria-label="Redo the last reverted change"
			>
				<Redo2 className="size-3.5" aria-hidden="true" />
				<span className="hidden sm:inline">Redo</span>
			</Button>
			{redoVersionStale ? (
				<span
					role="status"
					data-testid="timetable-version-stale"
					className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive"
					title="The schedule changed; refresh and re-preview before redoing."
				>
					Version-stale
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
			{redoVersionStale ? (
				<Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearRedo} data-testid="timetable-version-stale-dismiss">
					Dismiss
				</Button>
			) : null}
		</div>
	);
}
