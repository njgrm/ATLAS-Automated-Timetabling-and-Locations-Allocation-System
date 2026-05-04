import { useCallback, useState } from 'react';
import type { DragEvent } from 'react';

export type TimetableDropCell = {
	day: string;
	startTime: string;
	endTime: string;
	key: string;
};

function readCellDataset(element: Element | null): TimetableDropCell | null {
	if (!element) return null;
	const cell = element.closest('td[data-day][data-start-time][data-end-time]');
	if (!(cell instanceof HTMLElement)) return null;
	const day = cell.dataset.day;
	const startTime = cell.dataset.startTime;
	const endTime = cell.dataset.endTime;
	if (!day || !startTime || !endTime) return null;
	return {
		day,
		startTime,
		endTime,
		key: `${day}-${startTime}`,
	};
}

export function useTimetableDragDrop() {
	const [dropTarget, setDropTarget] = useState<string | null>(null);

	const resolveDropCell = useCallback(
		(event: DragEvent<HTMLElement>, fallback: Omit<TimetableDropCell, 'key'>): TimetableDropCell => {
			const fromTarget = readCellDataset(event.target as Element | null);
			if (fromTarget) return fromTarget;

			const fromPoint = readCellDataset(document.elementFromPoint(event.clientX, event.clientY));
			if (fromPoint) return fromPoint;

			return {
				...fallback,
				key: `${fallback.day}-${fallback.startTime}`,
			};
		},
		[],
	);

	return {
		dropTarget,
		setDropTarget,
		resolveDropCell,
	};
}
