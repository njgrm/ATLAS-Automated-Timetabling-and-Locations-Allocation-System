import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { PointerSensor, useSensor, useSensors, type DragCancelEvent, type DragEndEvent, type DragMoveEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { toast } from 'sonner';

import { parseDraftPlacementId } from '@/lib/timetable-utils';
import { resolveDraftPlacementFromEntry } from '@/lib/timetable-swap-routing';
import type { DraftPlacement, DraftQueueItem, ScheduledEntry, UnassignedItem, Violation } from '@/types';
import type { CenterViewMode, DragSource, PreGenDragSource } from '@/components/timetable/ScheduleReviewWorkspace.constants';

type DragPayload = {
	type?: 'draftPlacement' | 'entry' | 'unassigned' | 'draftQueue' | 'timetableGrid';
	placement?: DraftPlacement;
	placementId?: number;
	entry?: ScheduledEntry;
	item?: UnassignedItem | DraftQueueItem;
	day?: string;
	startTime?: string;
	endTime?: string;
};

type DragDropOptions = {
	centerView: CenterViewMode;
	draftPlacements: DraftPlacement[];
	preGenEntries: ScheduledEntry[];
	handleCellDrop: (day: string, startTime: string, endTime: string, source?: DragSource) => void;
	navToFaculty: (id: number) => void;
	navToSection: (id: number) => void;
	navToRoom: (id: number) => void;
	rightPanelRef: RefObject<ImperativePanelHandle | null>;
	setCenterView: Dispatch<SetStateAction<CenterViewMode>>;
	setLeftTab: Dispatch<SetStateAction<'violations' | 'unassigned' | 'pinned' | 'requests'>>;
	setSelectedViolation: Dispatch<SetStateAction<Violation | null>>;
	setSelectedEntry: Dispatch<SetStateAction<ScheduledEntry | null>>;
	setPreGenKbSource: Dispatch<SetStateAction<PreGenDragSource | null>>;
	setKbSelectedSource: Dispatch<SetStateAction<DragSource>>;
	setUnassignDropActive: Dispatch<SetStateAction<boolean>>;
	setPinnedRailDropActive: Dispatch<SetStateAction<boolean>>;
	setPendingUnassignId: Dispatch<SetStateAction<number | null>>;
	setShowUnassignConfirm: Dispatch<SetStateAction<boolean>>;
	setDragActive: (active: boolean) => void;
};

export function useTimetableDragDrop(options: DragDropOptions) {
	const {
		centerView,
		draftPlacements,
		preGenEntries,
		handleCellDrop,
		navToFaculty,
		navToSection,
		navToRoom,
		rightPanelRef,
		setCenterView,
		setLeftTab,
		setSelectedViolation,
		setSelectedEntry,
		setPreGenKbSource,
		setKbSelectedSource,
		setUnassignDropActive,
		setPinnedRailDropActive,
		setPendingUnassignId,
		setShowUnassignConfirm,
		setDragActive,
	} = options;
	const dragItemRef = useRef<DragSource>(null);
	const lastOverCellRef = useRef<{ day: string; startTime: string; endTime: string } | null>(null);
	const lastUnassignActiveRef = useRef(false);
	const lastPinnedActiveRef = useRef(false);
	const lastGridCellIdRef = useRef<string | null>(null);
	const dragClearTimerRef = useRef<number | null>(null);
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
	const clearDragVisualState = useCallback(() => {
		if (dragClearTimerRef.current != null) window.clearTimeout(dragClearTimerRef.current);
		dragClearTimerRef.current = window.setTimeout(() => {
			dragClearTimerRef.current = null;
			dragItemRef.current = null;
			window.dispatchEvent(new CustomEvent('atlas:timetable-drag-source', { detail: { source: null } }));
		}, 120);
	}, []);
	useEffect(() => () => {
		if (dragClearTimerRef.current != null) window.clearTimeout(dragClearTimerRef.current);
	}, []);

	const resolveCellFromTranslatedRect = useCallback((translated: { left: number; top: number; width: number; height: number } | null | undefined) => {
		if (!translated || typeof document === 'undefined') return null;
		const clientX = translated.left + translated.width / 2;
		const clientY = translated.top + translated.height / 2;
		const cell = document.elementFromPoint(clientX, clientY)?.closest<HTMLTableCellElement>('td[data-day][data-start-time][data-end-time]');
		if (!cell?.dataset.day || !cell.dataset.startTime || !cell.dataset.endTime) return null;
		return {
			cellId: `${cell.dataset.day}-${cell.dataset.startTime}-${cell.dataset.endTime}`,
			day: cell.dataset.day,
			startTime: cell.dataset.startTime,
			endTime: cell.dataset.endTime,
		};
	}, []);

	const handleGlobalDragStart = useCallback((event: DragStartEvent) => {
		if (dragClearTimerRef.current != null) {
			window.clearTimeout(dragClearTimerRef.current);
			dragClearTimerRef.current = null;
		}
		setDragActive(true);
		lastUnassignActiveRef.current = false;
		lastPinnedActiveRef.current = false;
		const data = event.active.data.current as DragPayload | undefined;
		if (!data?.type) return;
		if (data.type === 'draftPlacement') {
			const placement = data.placement ?? draftPlacements.find((candidate) => candidate.id === data.placementId) ?? null;
			if (placement) dragItemRef.current = { type: 'draftPlacement', placement };
			else if (data.entry) dragItemRef.current = { type: 'entry', entry: data.entry };
		} else if (data.type === 'entry' && data.entry) {
			const placement = centerView === 'pre-generation'
				? resolveDraftPlacementFromEntry(data.entry, draftPlacements)
				: null;
			dragItemRef.current = placement ? { type: 'draftPlacement', placement } : { type: 'entry', entry: data.entry };
		} else if (data.type === 'unassigned' && data.item) {
			dragItemRef.current = { type: 'unassigned', item: data.item as UnassignedItem };
		} else if (data.type === 'draftQueue' && data.item) {
			dragItemRef.current = { type: 'draftQueue', item: data.item as DraftQueueItem };
		}
		if (dragItemRef.current) {
			window.dispatchEvent(new CustomEvent('atlas:timetable-drag-source', { detail: { source: dragItemRef.current } }));
		} else {
			window.dispatchEvent(new CustomEvent('atlas:timetable-drag-source', { detail: { source: null } }));
			setDragActive(false);
		}
	}, [centerView, draftPlacements, setDragActive]);

	const handleGlobalDragOver = useCallback((event: DragOverEvent) => {
		const key = event.over?.id ? String(event.over.id) : null;
		const source = event.active.data.current as DragPayload | undefined;

		const isUnassignActive = key === 'unassign-zone' && (source?.type === 'draftPlacement' || source?.type === 'entry');
		if (isUnassignActive !== lastUnassignActiveRef.current) {
			lastUnassignActiveRef.current = isUnassignActive;
			setUnassignDropActive(isUnassignActive);
		}

		const isPinnedActive = key === 'pinned-rail-zone' && (
			source?.type === 'draftPlacement'
			|| (source?.type === 'entry' && parseDraftPlacementId(source.entry?.entryId ?? '') != null)
		);
		if (isPinnedActive !== lastPinnedActiveRef.current) {
			lastPinnedActiveRef.current = isPinnedActive;
			setPinnedRailDropActive(isPinnedActive);
		}
	}, [setPinnedRailDropActive, setUnassignDropActive]);

	const handleGlobalDragMove = useCallback((event: DragMoveEvent) => {
		const targetCell = resolveCellFromTranslatedRect(event.active.rect.current.translated);
		const cellId = targetCell?.cellId ?? null;
		if (cellId === lastGridCellIdRef.current) return;
		lastGridCellIdRef.current = cellId;
		if (targetCell) {
			lastOverCellRef.current = {
				day: targetCell.day,
				startTime: targetCell.startTime,
				endTime: targetCell.endTime,
			};
		}
		window.dispatchEvent(new CustomEvent('atlas:timetable-drag-cell', { detail: { cellId, source: dragItemRef.current } }));
	}, [resolveCellFromTranslatedRect]);

	const focusPinnedPlacement = useCallback((placement: DraftPlacement, mode: 'details' | 'faculty' | 'section' | 'room' = 'details') => {
		setCenterView('pre-generation');
		setLeftTab('pinned');
		setSelectedViolation(null);
		setPreGenKbSource(null);
		setKbSelectedSource(null);
		if (mode === 'faculty' && placement.facultyId) navToFaculty(placement.facultyId);
		if (mode === 'section') navToSection(placement.sectionId);
		if (mode === 'room' && placement.roomId) navToRoom(placement.roomId);
		setSelectedEntry(preGenEntries.find((entry) => entry.entryId === `draft-placement-${placement.id}`) ?? null);
		rightPanelRef.current?.expand();
	}, [navToFaculty, navToRoom, navToSection, preGenEntries, rightPanelRef, setCenterView, setKbSelectedSource, setLeftTab, setPreGenKbSource, setSelectedEntry, setSelectedViolation]);

	const handleGlobalDragEnd = useCallback((event: DragEndEvent) => {
		window.dispatchEvent(new CustomEvent('atlas:timetable-drag-ending'));
		setDragActive(false);
		const source = event.active.data.current as DragPayload | undefined;
		const target = event.over?.data.current as DragPayload | undefined;
		setUnassignDropActive(false);
		setPinnedRailDropActive(false);
		lastUnassignActiveRef.current = false;
		lastPinnedActiveRef.current = false;

		if (event.over?.id === 'unassign-zone') {
			const placementId = source?.type === 'draftPlacement'
				? source.placement?.id
				: source?.type === 'entry' ? parseDraftPlacementId(source.entry?.entryId ?? '') : null;
			if (placementId != null) {
				setPendingUnassignId(placementId);
				setShowUnassignConfirm(true);
			}
		} else if (event.over?.id === 'pinned-rail-zone') {
			const placementId = source?.type === 'entry' ? parseDraftPlacementId(source.entry?.entryId ?? '') : null;
			const placement = source?.type === 'draftPlacement'
				? source.placement ?? null
				: draftPlacements.find((candidate) => candidate.id === placementId) ?? null;
			if (placement) {
				focusPinnedPlacement(placement);
				toast.info('Pinned session focused in the left rail.');
			}
		} else {
			const targetEntry = target?.entry ?? target?.placement;
			const fallbackCell = lastOverCellRef.current ?? resolveCellFromTranslatedRect(event.active.rect.current.translated);
			const day = target?.day ?? targetEntry?.day ?? fallbackCell?.day;
			const startTime = target?.startTime ?? targetEntry?.startTime ?? fallbackCell?.startTime;
			const endTime = target?.endTime ?? targetEntry?.endTime ?? fallbackCell?.endTime;
			if (day && startTime && endTime) {
				// The visual drop must settle before preview validation mounts its
				// dialogs and fetches. Keeping that work out of the pointer-up frame
				// removes a perceptible hitch without changing the resulting action.
				const activeSource = dragItemRef.current;
				window.setTimeout(() => handleCellDrop(day, startTime, endTime, activeSource), 220);
			}
		}
		lastOverCellRef.current = null;
		lastGridCellIdRef.current = null;
		// Keep the final target feedback briefly while the DnD source settles;
		// clearing the whole grid in the pointer-up frame was the remaining
		// visible hitch on low-end devices.
		window.setTimeout(() => {
			window.dispatchEvent(new CustomEvent('atlas:timetable-drag-cell', { detail: { cellId: null, source: null } }));
		}, 250);
		window.setTimeout(() => {
			window.dispatchEvent(new CustomEvent('atlas:timetable-drag-source', { detail: { source: null } }));
		}, 250);
		window.setTimeout(clearDragVisualState, 240);
	}, [clearDragVisualState, draftPlacements, focusPinnedPlacement, handleCellDrop, resolveCellFromTranslatedRect, setDragActive, setPendingUnassignId, setPinnedRailDropActive, setShowUnassignConfirm, setUnassignDropActive]);

	const handleGlobalDragCancel = useCallback((_event: DragCancelEvent) => {
		window.dispatchEvent(new CustomEvent('atlas:timetable-drag-ending'));
		setDragActive(false);
		setUnassignDropActive(false);
		setPinnedRailDropActive(false);
		lastOverCellRef.current = null;
		lastGridCellIdRef.current = null;
		window.dispatchEvent(new CustomEvent('atlas:timetable-drag-cell', { detail: { cellId: null, source: null } }));
		window.dispatchEvent(new CustomEvent('atlas:timetable-drag-source', { detail: { source: null } }));
		clearDragVisualState();
	}, [clearDragVisualState, setDragActive, setPinnedRailDropActive, setUnassignDropActive]);

	return { sensors, handleGlobalDragStart, handleGlobalDragMove, handleGlobalDragOver, handleGlobalDragEnd, handleGlobalDragCancel, focusPinnedPlacement };
}
