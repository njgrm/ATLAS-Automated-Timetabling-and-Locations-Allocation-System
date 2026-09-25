import { useEffect, useState } from 'react';

export type TimetableState = {
	isDesktop: boolean;
};

export function useIsDesktop() {
	const [desktop, setDesktop] = useState(() => {
		if (typeof window === 'undefined') return true;
		return window.matchMedia('(min-width: 1024px)').matches;
	});

	useEffect(() => {
		const mq = window.matchMedia('(min-width: 1024px)');
		const handler = (event: MediaQueryListEvent) => setDesktop(event.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	}, []);

	return desktop;
}

/** DRAFT-UX-C01 (S4) — Tailwind `md`: session details open as a centred dialog from here up. */
export const SESSION_DETAILS_DIALOG_MIN_WIDTH = 768;

/**
 * DRAFT-UX-C01 (S4) — `useIsDesktop` with the viewport width as a parameter
 * (the same `matchMedia` pattern). `useIsDesktop` itself stays at 1024 px.
 */
export function useMediaMinWidth(minWidthPx: number) {
	const query = `(min-width: ${minWidthPx}px)`;
	const [matches, setMatches] = useState(() => {
		if (typeof window === 'undefined') return true;
		return window.matchMedia(query).matches;
	});

	useEffect(() => {
		const mq = window.matchMedia(query);
		setMatches(mq.matches);
		const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	}, [query]);

	return matches;
}

export function useTimetableState(): TimetableState {
	const isDesktop = useIsDesktop();
	return { isDesktop };
}
