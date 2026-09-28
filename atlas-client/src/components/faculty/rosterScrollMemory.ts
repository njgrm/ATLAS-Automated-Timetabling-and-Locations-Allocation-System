/**
 * Fix 25, acceptance criterion 3 — "Closing returns to the unchanged
 * roster/filter/scroll state."
 *
 * WHY THIS IS A DOM LOOKUP AND NOT A React REF.
 *
 * The roster's scroll container is `<div className="flex-1 min-h-0 overflow-auto">`
 * inside `AdminWorkspaceFrame` (`components/admin-workspace/AdminWorkspace.tsx`,
 * the children wrapper). That file is NOT in this lane's fence, and threading a
 * ref through it would be a cross-lane edit. So the container is identified the
 * only way available from inside the fence: it is the nearest scrollable
 * ancestor of the control the user actually clicked. That is precisely the
 * region the user was scrolled in when they opened the modal, so it is the
 * right one to restore.
 *
 * FILTER AND SORT STATE NEED NO RESTORE AT ALL, and that is a structural
 * property rather than a happy accident: the modal is rendered as a SIBLING of
 * the roster inside the same `pages/Faculty.tsx` component, so opening it never
 * unmounts the roster and never touches the filter/sort/page state. The
 * navigation that used to destroy all of that is gone; what is left is only the
 * scroll offset, which this module captures and restores.
 */
import { useCallback, useRef } from 'react';

function isScrollable(el: Element): boolean {
	const style = window.getComputedStyle(el);
	const overflowY = style.overflowY;
	const overflowX = style.overflowX;
	return overflowY === 'auto' || overflowY === 'scroll' || overflowX === 'auto' || overflowX === 'scroll';
}

/**
 * The nearest scrollable ancestor of `el`, or null when there is none.
 *
 * Returns null rather than a guessed container: a wrong region would restore
 * an offset onto an element the user never scrolled.
 */
export function findScrollableAncestor(el: Element | null): HTMLElement | null {
	let node: Element | null = el;
	while (node) {
		if (node instanceof HTMLElement && isScrollable(node)) return node;
		node = node.parentElement;
	}
	return null;
}

/**
 * Holds the roster's scroll offset across a modal round trip.
 *
 * `captureFrom` runs on the click that opens the modal, BEFORE the dialog takes
 * over, so the offset read is the one the user was actually looking at.
 * `restore` runs on every dismissal path, because they all converge on one
 * close handler.
 */
export function useRosterScrollMemory() {
	const regionRef = useRef<HTMLElement | null>(null);
	const savedScrollTop = useRef<number | null>(null);

	const captureFrom = useCallback((eventTarget: Element | null) => {
		const region = findScrollableAncestor(eventTarget);
		regionRef.current = region;
		savedScrollTop.current = region ? region.scrollTop : null;
	}, []);

	const restore = useCallback(() => {
		const region = regionRef.current;
		if (region && savedScrollTop.current != null) {
			region.scrollTop = savedScrollTop.current;
		}
		savedScrollTop.current = null;
	}, []);

	return { regionRef, captureFrom, restore };
}
