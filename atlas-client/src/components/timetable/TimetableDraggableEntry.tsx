import { forwardRef, useCallback, useEffect, useRef } from 'react';
import type { HTMLAttributes, KeyboardEvent, MouseEvent, PointerEvent, TouchEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import type { ScheduledEntry } from '@/types';

interface DraggableEntryProps extends HTMLAttributes<HTMLDivElement> {
	entryId: string;
	entryData:
		| { type: 'entry'; entry: ScheduledEntry }
		| { type: 'draftPlacement'; entry: ScheduledEntry; placementId: number };
}

export const DraggableEntry = forwardRef<HTMLDivElement, DraggableEntryProps>(function DraggableEntry(
	{ entryId, entryData, children, style, onClick, onKeyDown, ...rest },
	forwardedRef,
) {
	const { attributes, listeners, setNodeRef, isDragging: draggingThis, transform } = useDraggable({
		id: entryId,
		data: entryData,
	});

	const didDragRef = useRef(false);
	const touchActivatedRef = useRef(false);
	const touchStartRef = useRef<{ x: number; y: number } | null>(null);
	const touchActivationTimerRef = useRef<number | null>(null);
	const clearTouchActivationTimer = useCallback(() => {
		if (touchActivationTimerRef.current != null) {
			window.clearTimeout(touchActivationTimerRef.current);
			touchActivationTimerRef.current = null;
		}
	}, []);

	useEffect(() => {
		if (draggingThis) {
			didDragRef.current = true;
			clearTouchActivationTimer();
		}
	}, [clearTouchActivationTimer, draggingThis]);
	useEffect(() => clearTouchActivationTimer, [clearTouchActivationTimer]);

	const handleNodeRef = useCallback((node: HTMLDivElement | null) => {
		setNodeRef(node);
		if (typeof forwardedRef === 'function') {
			forwardedRef(node);
		} else if (forwardedRef) {
			forwardedRef.current = node;
		}
	}, [forwardedRef, setNodeRef]);

	const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
		if (touchActivatedRef.current) {
			touchActivatedRef.current = false;
			return;
		}
		if (didDragRef.current) {
			didDragRef.current = false;
			return;
		}
		onClick?.(event);
	}, [onClick]);

	const handleTouchEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
		if (didDragRef.current) {
			return;
		}
		touchActivatedRef.current = true;
		onClick?.(event as unknown as MouseEvent<HTMLDivElement>);
	}, [onClick]);

	const handlePointerDownCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType === 'touch') {
			touchStartRef.current = { x: event.clientX, y: event.clientY };
			clearTouchActivationTimer();
			const activationEvent = event as unknown as MouseEvent<HTMLDivElement>;
			touchActivationTimerRef.current = window.setTimeout(() => {
				touchActivationTimerRef.current = null;
				if (didDragRef.current) return;
				touchActivatedRef.current = true;
				onClick?.(activationEvent);
			}, 80);
		}
	}, [clearTouchActivationTimer, onClick]);

	const handlePointerMoveCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType !== 'touch') return;
		const start = touchStartRef.current;
		if (!start) return;
		const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
		if (moved > 6) clearTouchActivationTimer();
	}, [clearTouchActivationTimer]);

	const handlePointerUpCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType !== 'touch') return;
		const start = touchStartRef.current;
		touchStartRef.current = null;
		if (!start) return;
		const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
		if (moved > 6) return;
		touchActivatedRef.current = true;
		didDragRef.current = false;
		onClick?.(event as unknown as MouseEvent<HTMLDivElement>);
	}, [onClick]);

	const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(event);
		if (!event.defaultPrevented) {
			listeners?.onKeyDown?.(event as never);
		}
	}, [listeners, onKeyDown]);

	return (
		<div
			ref={handleNodeRef}
			{...rest}
			{...attributes}
			{...listeners}
			onPointerDownCapture={handlePointerDownCapture}
			onPointerMoveCapture={handlePointerMoveCapture}
			onPointerUpCapture={handlePointerUpCapture}
			onClick={handleClick}
			onTouchEnd={handleTouchEnd}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			style={{
				...style,
				transform: CSS.Translate.toString(transform),
				zIndex: draggingThis ? 50 : undefined,
				opacity: draggingThis ? 0 : 1,
				touchAction: 'none',
				willChange: draggingThis ? 'transform' : undefined,
			}}
			data-dnd-source-type={entryData.type}
			data-dnd-entry-id={entryId}
		>
			{children}
		</div>
	);
});
