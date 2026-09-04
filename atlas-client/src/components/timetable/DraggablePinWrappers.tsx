/**
 * DraggablePinWrappers.tsx
 * Small reusable dnd-kit drag source wrappers for left-rail pin items.
 * These replace native HTML5 draggable usage so all drag events route
 * through the global DndContext in ScheduleReviewWorkspace.
 */
import { useEffect, useRef, useState, type KeyboardEventHandler, type MouseEventHandler, type ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

import type { DraftPlacement, DraftQueueItem, UnassignedItem } from '@/types';

// ---------------------------------------------------------------------------
// DraggableQueuePin
// Wraps a pre-gen queue (unscheduled demand) card. Uses stable ID built from
// assignmentKey + sessionNumber.
// ---------------------------------------------------------------------------
export function DraggableQueuePin({
	item,
	disabled,
	children,
	className,
	onClick,
	onKeyDown,
	onDragStart,
}: {
	item: DraftQueueItem;
	disabled: boolean;
	children: ReactNode;
	className?: string;
	onClick?: MouseEventHandler<HTMLDivElement>;
	onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
	onDragStart?: () => void;
}) {
	const [coarsePointer, setCoarsePointer] = useState(false);
	const dragStartNotifiedRef = useRef(false);
	useEffect(() => {
		const query = window.matchMedia('(pointer: coarse)');
		const update = () => setCoarsePointer(query.matches);
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	}, []);
	const id = `queue-pin-${item.assignmentKey}-${item.sessionNumber}`;
	const dragDisabled = disabled || coarsePointer;
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id,
		disabled: dragDisabled,
		data: { type: 'draftQueue', item },
	});
	const dragAttributes = dragDisabled ? {} : attributes;
	const dragListeners = dragDisabled ? {} : listeners;
	useEffect(() => {
		if (isDragging && !dragStartNotifiedRef.current) onDragStart?.();
		dragStartNotifiedRef.current = isDragging;
	}, [isDragging, onDragStart]);

	return (
		<div
			ref={setNodeRef}
			{...dragListeners}
			{...dragAttributes}
			role={disabled ? 'button' : attributes.role}
			tabIndex={disabled ? 0 : attributes.tabIndex}
			className={className}
			onClick={onClick}
			onKeyDown={onKeyDown}
			style={{
				touchAction: 'none',
				opacity: isDragging ? 0.45 : 1,
			}}
		>
			{children}
		</div>
	);
}

// ---------------------------------------------------------------------------
// DraggablePlacementPin
// Wraps a pinned draft placement card in the Locks panel.
// ID format: placement-pin-${placement.id}
// ---------------------------------------------------------------------------
export function DraggablePlacementPin({
	placement,
	disabled,
	children,
	className,
}: {
	placement: DraftPlacement;
	disabled: boolean;
	children: ReactNode;
	className?: string;
}) {
	const id = `placement-pin-${placement.id}`;
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id,
		disabled,
		data: { type: 'draftPlacement', placement },
	});
	const dragAttributes = disabled ? {} : attributes;
	const dragListeners = disabled ? {} : listeners;

	return (
		<div
			ref={setNodeRef}
			{...dragListeners}
			{...dragAttributes}
			className={className}
			style={{
				touchAction: 'none',
				opacity: isDragging ? 0.45 : 1,
			}}
		>
			{children}
		</div>
	);
}

// ---------------------------------------------------------------------------
// DraggableUnassignedPin
// Wraps a post-gen unassigned item card. itemKey must be stable across renders.
// ---------------------------------------------------------------------------
export function DraggableUnassignedPin({
	itemKey,
	item,
	disabled,
	children,
	className,
	onDragStart,
}: {
	itemKey: string;
	item: UnassignedItem;
	disabled: boolean;
	children: ReactNode;
	className?: string;
	onDragStart?: () => void;
}) {
	const [coarsePointer, setCoarsePointer] = useState(false);
	const dragStartNotifiedRef = useRef(false);
	useEffect(() => {
		const query = window.matchMedia('(pointer: coarse)');
		const update = () => setCoarsePointer(query.matches);
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	}, []);

	const id = `unassigned-pin-${itemKey}`;
	const dragDisabled = disabled || coarsePointer;
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id,
		disabled: dragDisabled,
		data: { type: 'unassigned', item },
	});
	const dragAttributes = dragDisabled ? {} : attributes;
	const dragListeners = dragDisabled ? {} : listeners;
	useEffect(() => {
		if (isDragging && !dragStartNotifiedRef.current) onDragStart?.();
		dragStartNotifiedRef.current = isDragging;
	}, [isDragging, onDragStart]);

	return (
		<div
			ref={setNodeRef}
			{...dragListeners}
			{...dragAttributes}
			role="group"
			aria-label={`Unassigned session ${itemKey}`}
			className={className}
			style={{
				touchAction: 'pan-y',
				opacity: isDragging ? 0.45 : 1,
			}}
		>
			{children}
		</div>
	);
}

// ---------------------------------------------------------------------------
// UnassignDropZone
// A droppable target that receives draftPlacement drags for unassign flows.
// The actual unassign logic lives in handleGlobalDragEnd in the workspace.
// ---------------------------------------------------------------------------
export function UnassignDropZone({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const { setNodeRef } = useDroppable({ id: 'unassign-zone' });
	return (
		<div ref={setNodeRef} className={className}>
			{children}
		</div>
	);
}

export function PinnedRailDropZone({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const { setNodeRef } = useDroppable({ id: 'pinned-rail-zone' });
	return (
		<div ref={setNodeRef} className={className}>
			{children}
		</div>
	);
}
