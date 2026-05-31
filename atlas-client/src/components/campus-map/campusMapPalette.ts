/**
 * Calm, named building palette for the campus map editor.
 * Replaces the rainbow palette with neutral defaults so the map reads as a
 * map of buildings, not a color demo.
 */
export type BuildingSwatch = {
	id: string;
	label: string;
	value: string;
};

export const CALM_BUILDING_SWATCHES: BuildingSwatch[] = [
	{ id: 'neutral', label: 'Neutral', value: '#64748b' },
	{ id: 'stone', label: 'Stone', value: '#78716c' },
	{ id: 'academic', label: 'Academic', value: '#38bdf8' },
	{ id: 'laboratory', label: 'Laboratory', value: '#14b8a6' },
	{ id: 'workshop', label: 'Workshop', value: '#f59e0b' },
	{ id: 'admin', label: 'Admin', value: '#8b5cf6' },
];

export const CALM_BUILDING_COLORS = CALM_BUILDING_SWATCHES.map((s) => s.value);

export function getPrimaryCanvasColor(fallback = '#7f1d1d'): string {
	if (typeof window === 'undefined') return fallback;
	const primary = window.getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
	return primary ? `hsl(${primary})` : fallback;
}

/** Fallback canvas stroke for selected elements before school tokens resolve. */
export const MAP_SELECTED_STROKE = '#7f1d1d';
export const MAP_DEFAULT_STROKE = '#ffffff';
export const MAP_TRANSFORMER_STROKE = '#7f1d1d';

/** Calm background fallback when no campus photo is uploaded. */
export const MAP_CANVAS_BG = '#f1f5f9';
