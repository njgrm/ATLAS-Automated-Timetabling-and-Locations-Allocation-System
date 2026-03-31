import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'atlas-font-size';

/**
 * Manages font-size accessibility setting.
 * Persists to localStorage and applies to <html> root so all rem-based values scale.
 */
export function useAccessibility() {
	const [fontSize, setFontSizeState] = useState(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored ? parseInt(stored, 10) : 100;
	});

	const setFontSize = useCallback((size: number) => {
		setFontSizeState(size);
		localStorage.setItem(STORAGE_KEY, String(size));
	}, []);

	useEffect(() => {
		document.documentElement.style.fontSize = `${(fontSize / 100) * 16}px`;
	}, [fontSize]);

	return { fontSize, setFontSize };
}
