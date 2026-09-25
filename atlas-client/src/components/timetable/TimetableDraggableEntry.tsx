import { forwardRef, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { HTMLAttributes, KeyboardEvent, MouseEvent, PointerEvent, TouchEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import type { ScheduledEntry } from '@/types';

/**
 * UX-AUDIT-FINDINGS-C01 (F6) — one publication signal from the workspace header
 * to every grid entry. The published run is read-only; a draft keeps its edit
 * affordances. A module store is used because the Simple header and the grid
 * are sibling surfaces (the grid is rendered by `CenterWorkspace`): the header
 * owns the authoritative `isRunPublished` value and publishes it here, and each
 * entry subscribes. The contract is driven by publication state, never by CSS.
 */
let entryReadOnlyState = false;
const entryReadOnlyListeners = new Set<() => void>();

export function setTimetableEntryReadOnly(value: boolean): void {
	if (entryReadOnlyState === value) return;
	entryReadOnlyState = value;
	for (const listener of entryReadOnlyListeners) listener();
}

export function useTimetableEntryReadOnly(): boolean {
	return useSyncExternalStore(
		(listener) => {
			entryReadOnlyListeners.add(listener);
			return () => entryReadOnlyListeners.delete(listener);
		},
		() => entryReadOnlyState,
		() => false,
	);
}

interface DraggableEntryProps extends HTMLAttributes<HTMLDivElement> {
	entryId: string;
	entryData:
		| { type: 'entry'; entry: ScheduledEntry }
		| { type: 'draftPlacement'; entry: ScheduledEntry; placementId: number };
	/**
	 * F6 — when true the entry renders as read-only presentation: no draggable
	 * listeners, no grab/pointer affordance. The draft path is unchanged.
	 */
	readOnly?: boolean;
}

export const DraggableEntry = forwardRef<HTMLDivElement, DraggableEntryProps>(function DraggableEntry(
	{ entryId, entryData, children, style, onClick, onKeyDown, readOnly = false, ...rest },
	forwardedRef,
) {
	const { attributes, listeners, setNodeRef, isDragging: draggingThis, transform } = useDraggable({
		id: entryId,
		data: entryData,
		disabled: readOnly,
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

	// F6 — a published run renders as read-only presentation. No drag listeners,
	// no pointer/keyboard edit affordances; the draft branch below is unchanged.
	if (readOnly) {
		return (
			<div
				ref={handleNodeRef}
				{...rest}
				data-dnd-source-type={entryData.type}
				data-dnd-entry-id={entryId}
				data-read-only="true"
				tabIndex={0}
				onClick={onClick}
				onKeyDown={onKeyDown}
				style={{ ...style }}
			>
				{children}
			</div>
		);
	}

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
