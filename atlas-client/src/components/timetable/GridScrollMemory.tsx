import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

import { ScrollArea } from '@/ui/scroll-area';

/**
 * A7 — the schedule grid is the only sanctioned inner scroll region, and it
 * unmounts when the operator opens a timetable sub-page (Setup, Runs, …). This
 * wrapper keeps the grid's `scrollTop` across `/timetable` → sub-page →
 * `/timetable` without introducing a global scroll surface: the position is
 * captured from the real Radix viewport while mounted and restored on the next
 * mount. No new document scrollbar is created — the root stays
 * `flex-1 min-h-0` and the Radix viewport remains the only scroller.
 */
export function GridScrollMemory({
	scrollTopRef,
	children,
	className,
}: {
	/** Owned by the always-mounted center panel, so it survives sub-page swaps. */
	scrollTopRef: RefObject<number>;
	children: ReactNode;
	className?: string;
}) {
	const rootRef = useRef<HTMLDivElement | null>(null);

	const viewportOf = (): HTMLElement | null => {
		const root = rootRef.current;
		if (!root) return null;
		return root.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')
			?? (root.firstElementChild as HTMLElement | null);
	};

	// Restore on mount: this wrapper mounts exactly when the grid view re-enters.
	useLayoutEffect(() => {
		const viewport = viewportOf();
		if (viewport) viewport.scrollTop = scrollTopRef.current ?? 0;
		// Mount-only by design.
	}, []);

	// Capture while mounted so the position is current before the next swap.
	useEffect(() => {
		const viewport = viewportOf();
		if (!viewport) return;
		const onScroll = () => {
			scrollTopRef.current = viewport.scrollTop;
		};
		viewport.addEventListener('scroll', onScroll, { passive: true });
		return () => viewport.removeEventListener('scroll', onScroll);
		// Mount-only by design.
	}, []);

	return (
		<ScrollArea ref={rootRef} className={className}>
			{children}
		</ScrollArea>
	);
}
