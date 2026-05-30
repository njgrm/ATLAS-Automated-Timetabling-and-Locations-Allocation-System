/**
 * Calm, named building palette for the campus map editor.
 * Replaces the rainbow palette with neutral defaults so the map reads as a
 * map of buildings, not a color demo.
 *
 * `selected` and `ready` slots intentionally pull the SMART/ATLAS emerald
 * identity so chosen and approved buildings feel grounded in the same
 * theme as the rest of the portal.
 */
export type BuildingSwatch = {
	id: string;
	label: string;
	value: string;
};

export const CALM_BUILDING_SWATCHES: BuildingSwatch[] = [
	{ id: 'slate', label: 'Slate', value: '#64748b' },
	{ id: 'stone', label: 'Stone', value: '#78716c' },
	{ id: 'sky', label: 'Sky', value: '#38bdf8' },
	{ id: 'emerald', label: 'Emerald', value: '#10b981' },
	{ id: 'amber', label: 'Amber', value: '#f59e0b' },
	{ id: 'rose', label: 'Rose', value: '#f43f5e' },
	{ id: 'violet', label: 'Violet', value: '#8b5cf6' },
];

export const CALM_BUILDING_COLORS = CALM_BUILDING_SWATCHES.map((s) => s.value);

/** Stroke for the currently-selected building. Emerald-600 to match identity. */
export const MAP_SELECTED_STROKE = '#059669';
export const MAP_DEFAULT_STROKE = '#ffffff';
export const MAP_TRANSFORMER_STROKE = '#059669';

/** Calm background fallback when no campus photo is uploaded. */
export const MAP_CANVAS_BG = '#f1f5f9';
