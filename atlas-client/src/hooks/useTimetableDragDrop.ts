import { useCallback, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { PointerSensor, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { toast } from 'sonner';

import { parseDraftPlacementId } from '@/lib/timetable-utils';
import { resolveDraftPlacementFromEntry } from '@/lib/timetable-swap-routing';
import type { DraftPlacement, DraftQueueItem, ScheduledEntry, UnassignedItem, Violation } from '@/types';
import type { CenterViewMode, DragSource, PreGenDragSource } from '@/components/timetable/ScheduleReviewWorkspace.constants';

type DragPayload = {
	type?: 'draftPlacement' | 'entry' | 'unassigned' | 'draftQueue';
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
	handleCellDrop: (day: string, startTime: string, endTime: string) => void;
	navToFaculty: (id: number) => void;
	navToSection: (id: number) => void;
	navToRoom: (id: number) => void;
	rightPanelRef: RefObject<ImperativePanelHandle | null>;
	setDragItem: Dispatch<SetStateAction<DragSource>>;
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
		setDragItem,
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
	} = options;
	const dragItemRef = useRef<DragSource>(null);
	const lastOverCellRef = useRef<{ day: string; startTime: string; endTime: string } | null>(null);
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

	const handleGlobalDragStart = useCallback((event: DragStartEvent) => {
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
		if (dragItemRef.current) setDragItem(dragItemRef.current);
	}, [centerView, draftPlacements, setDragItem]);

	const handleGlobalDragOver = useCallback((event: DragOverEvent) => {
		const key = event.over?.id ? String(event.over.id) : null;
		const source = event.active.data.current as DragPayload | undefined;
		const target = event.over?.data.current as DragPayload | undefined;
		if (target?.day && target.startTime && target.endTime) {
			lastOverCellRef.current = { day: target.day, startTime: target.startTime, endTime: target.endTime };
		}
		setUnassignDropActive(key === 'unassign-zone' && (source?.type === 'draftPlacement' || source?.type === 'entry'));
		setPinnedRailDropActive(key === 'pinned-rail-zone' && (
			source?.type === 'draftPlacement'
			|| (source?.type === 'entry' && parseDraftPlacementId(source.entry?.entryId ?? '') != null)
		));
	}, [setPinnedRailDropActive, setUnassignDropActive]);

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
		const source = event.active.data.current as DragPayload | undefined;
		const target = event.over?.data.current as DragPayload | undefined;
		setUnassignDropActive(false);
		setPinnedRailDropActive(false);

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
			const day = target?.day ?? targetEntry?.day ?? lastOverCellRef.current?.day;
			const startTime = target?.startTime ?? targetEntry?.startTime ?? lastOverCellRef.current?.startTime;
			const endTime = target?.endTime ?? targetEntry?.endTime ?? lastOverCellRef.current?.endTime;
			if (day && startTime && endTime) handleCellDrop(day, startTime, endTime);
		}
		lastOverCellRef.current = null;
		dragItemRef.current = null;
		setDragItem(null);
	}, [draftPlacements, focusPinnedPlacement, handleCellDrop, setDragItem, setPendingUnassignId, setPinnedRailDropActive, setShowUnassignConfirm, setUnassignDropActive]);

	return { sensors, handleGlobalDragStart, handleGlobalDragOver, handleGlobalDragEnd, focusPinnedPlacement };
}
