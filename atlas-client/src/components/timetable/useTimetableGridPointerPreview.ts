/**
 * A2-C7 / C11 slice 1 — the grid's pointer-drag preview decorations, extracted
 * VERBATIM from `TimetableGrid.tsx`.
 *
 * C11 F3 added the move-target cue to the cell, which pushed `TimetableGrid.tsx`
 * to 1001 physical lines — one over the AGENTS.md §8 cap. This effect is a
 * self-contained ~100-line block about a *global* event listener, not about the
 * grid's render, so it moved out whole rather than the render being fragmented.
 *
 * Nothing about the behaviour changed: the same `atlas:timetable-drag-source`
 * window event, the same 120 ms deferral for pointer drags, the same batched
 * 14-cells-per-frame decoration, the same class names, and the same cleanup. The
 * DOM it decorates is still the grid's own cells, selected by
 * `td[data-day][data-start-time][data-end-time]`.
 */
import { useEffect, useRef } from 'react';

import type { CellConflictInfo } from '@/types';
import type { GridDragSource } from '@/components/timetable/TimetableGrid';

const POINTER_PREVIEW_DECORATION_DELAY_MS = 120;
const CELLS_PER_FRAME = 14;

export function useTimetableGridPointerPreview(input: {
	kbSelectedSource: GridDragSource;
	onKbPlaceStart?: () => void;
	getCellConflict: ((cellId: string) => CellConflictInfo | null) | null;
	getLiveCellConflict: (source: any, cellId: string) => CellConflictInfo | null;
}) {
	const { kbSelectedSource, onKbPlaceStart, getCellConflict, getLiveCellConflict } = input;
	const dragPreviewTimerRef = useRef<number | null>(null);

	useEffect(() => {
		if (!kbSelectedSource || !onKbPlaceStart || typeof window === 'undefined') return;
		const announcePlacementTouch = () => onKbPlaceStart();
		window.addEventListener('touchstart', announcePlacementTouch, { capture: true, passive: true });
		return () => window.removeEventListener('touchstart', announcePlacementTouch, { capture: true });
	}, [kbSelectedSource, onKbPlaceStart]);

	useEffect(() => {
		const cleanupPointerPreview = () => {
			const labels = document.querySelectorAll('[data-pointer-preview-label="true"]');
			labels.forEach((label) => label.remove());
			const decoratedCells = document.querySelectorAll<HTMLElement>('[data-pointer-preview-status]');
			decoratedCells.forEach((cell) => {
				cell.removeAttribute('data-pointer-preview-status');
				cell.classList.remove(
					'ring-1',
					'ring-dashed',
					'ring-red-400/50',
					'ring-amber-300/50',
					'ring-emerald-300/50',
					'bg-red-50/25',
					'bg-amber-50/20',
					'bg-emerald-50/10',
				);
			});
		};
		const decoratePointerPreview = (source: NonNullable<GridDragSource>) => {
			cleanupPointerPreview();
			let cancelled = false;
			const cells = Array.from(
				document.querySelectorAll<HTMLElement>('td[data-day][data-start-time][data-end-time]'),
			);
			let cursor = 0;

			const decorateBatch = () => {
				if (cancelled) return;
				const end = Math.min(cursor + CELLS_PER_FRAME, cells.length);
				for (; cursor < end; cursor += 1) {
					const cell = cells[cursor];
					const day = cell.dataset.day;
					const startTime = cell.dataset.startTime;
					const endTime = cell.dataset.endTime;
					if (!day || !startTime || !endTime) continue;

					const cellId = `${day}-${startTime}-${endTime}`;
					const info = getLiveCellConflict(source, cellId) ?? getCellConflict?.(cellId) ?? null;
					const occupiedCount = cell.querySelectorAll('[data-timetable-entry="true"]').length;
					const mode = occupiedCount > 0 ? 'swap' : 'place';
					const status = info?.kind === 'hard'
						? 'blocked'
						: info?.kind === 'soft'
							? 'warning'
							: mode;

					cell.dataset.pointerPreviewStatus = status;
					cell.classList.add('ring-1');
					if (status === 'blocked') {
						cell.classList.add('ring-red-400/50', 'bg-red-50/25');
					} else if (status === 'warning' || mode === 'swap') {
						cell.classList.add('ring-amber-300/50', 'bg-amber-50/20');
					} else {
						cell.classList.add('ring-dashed', 'ring-emerald-300/50', 'bg-emerald-50/10');
					}
				}
				if (cursor < cells.length) {
					window.requestAnimationFrame(decorateBatch);
				}
			};

			window.requestAnimationFrame(decorateBatch);
			return () => {
				cancelled = true;
				cleanupPointerPreview();
			};
		};
		let cancelPreviewDecorations: (() => void) | null = null;
		const clearPreviewTimer = () => {
			if (dragPreviewTimerRef.current !== null) {
				window.clearTimeout(dragPreviewTimerRef.current);
				dragPreviewTimerRef.current = null;
			}
		};
		const clearPointerPreview = () => {
			clearPreviewTimer();
			cancelPreviewDecorations?.();
			cancelPreviewDecorations = null;
			cleanupPointerPreview();
		};
		const handlePreviewSource = (event: Event) => {
			const detail = (event as CustomEvent<{ source?: GridDragSource }>).detail;
			const nextSource = detail.source ?? null;
			clearPointerPreview();
			if (!nextSource) {
				return;
			}
			// Grid-wide guidance is useful, but calculating every visible cell in the
			// pointer activation frame creates a visible hitch on lower-end devices.
			// Defer pointer-drag guidance slightly; click/keyboard guidance remains immediate.
			dragPreviewTimerRef.current = window.setTimeout(() => {
				dragPreviewTimerRef.current = null;
				cancelPreviewDecorations = decoratePointerPreview(nextSource);
			}, POINTER_PREVIEW_DECORATION_DELAY_MS);
		};
		window.addEventListener('atlas:timetable-drag-source', handlePreviewSource);
		return () => {
			clearPointerPreview();
			window.removeEventListener('atlas:timetable-drag-source', handlePreviewSource);
		};
	}, [getCellConflict, getLiveCellConflict]);
}
