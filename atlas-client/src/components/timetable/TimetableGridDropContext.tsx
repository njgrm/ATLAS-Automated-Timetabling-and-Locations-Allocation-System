/**
 * A2-C7 item 3(a) — extracted verbatim from `TimetableGrid.tsx`, which was at
 * exactly 995 physical lines and could not take the blocked-window fix without
 * breaching the 1000-line component cap (AGENTS.md §8). Nothing here changed
 * behaviour: the drag-cell store, its subscription, and the drop wrapper are the
 * same objects, the same module-scope singletons, and the same render output.
 *
 * Why the store is module-scope and not context: it exists so a drag over ONE
 * cell can repaint that cell at pointer frequency without re-rendering the
 * complete timetable, and so the release path is guaranteed to run even if the
 * component that published the state unmounts first. Moving it to a provider
 * would have changed the subscription count and the release timing.
 */
import { memo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { CellConflictInfo } from '@/types';

export type ActiveDragCellState = {
	cellId: string;
	isOver: true;
	info: CellConflictInfo | null;
};

export const inactiveDragCellState = { isOver: false, info: null } as const;
let activeDragCellState: ActiveDragCellState | null = null;
const dragCellListeners = new Set<() => void>();
export const POINTER_ACTIVE_CELL_VISUAL_DELAY_MS = 40;

export function publishActiveDragCell(cellId: string | null, info: CellConflictInfo | null) {
	if (cellId === null) {
		if (activeDragCellState === null) return;
		activeDragCellState = null;
	} else if (activeDragCellState?.cellId === cellId && activeDragCellState.info === info) {
		return;
	} else {
		activeDragCellState = { cellId, isOver: true, info };
	}
	for (const listener of dragCellListeners) listener();
}

export function useGridCellDragState(cellId: string) {
	return useSyncExternalStore(
		(listener) => {
			dragCellListeners.add(listener);
			return () => dragCellListeners.delete(listener);
		},
		() => activeDragCellState?.cellId === cellId ? activeDragCellState : inactiveDragCellState,
		() => inactiveDragCellState,
	);
}

// DnD context updates at pointer frequency. Keep its subscription in this
// wrapper so activation and release do not re-render the complete timetable.
export const GridDropContainer = memo(function GridDropContainer({ children }: { children: ReactNode }) {
	const { setNodeRef } = useDroppable({
		id: 'timetable-grid-drop-zone',
		data: { type: 'timetableGrid' },
	});

	return <div ref={setNodeRef} className="overflow-auto scrollbar-thin">{children}</div>;
});
