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

export function useTimetableState(): TimetableState {
	const isDesktop = useIsDesktop();
	return { isDesktop };
}
