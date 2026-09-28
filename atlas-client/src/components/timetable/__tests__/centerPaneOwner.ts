/**
 * C11 slice 1 (F4) — where the centre-pane chain lives, and the proof it is live.
 *
 * The chain was extracted from `CenterWorkspace.tsx` into
 * `CenterWorkspacePaneSurface.tsx`: the first extraction was forced by the
 * AGENTS.md §8 1000-line cap, and the second reason is a QA finding — F4 requires
 * an acceptance row that renders the REAL production surface rather than a
 * test-local `PaneUnderTest` fixture, which was structurally incapable of
 * detecting the M1 regression.
 *
 * Several pre-existing source-reading rows decided a property of the chain and
 * read `CenterWorkspace.tsx` to find it. Their property is unchanged; only the
 * owning module moved. Rather than delete or weaken any of them (AGENTS.md §16),
 * this helper is the single place the move is recorded, and every re-pointed row
 * calls `assertCenterPaneOwnerIsRendered()` so the row keeps its teeth: it fails if
 * the chain is ever duplicated away from the surface, or if the surface stops
 * taking the M1 decision itself.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CLIENT_ROOT = resolve(import.meta.dirname, '../../../..');

/** The module that now OWNS the centre-pane chain. */
export const CENTER_PANE_OWNER = 'src/components/timetable/CenterWorkspacePaneSurface.tsx';

export function centerPaneSource(path: string): string {
	return readFileSync(resolve(CLIENT_ROOT, path), 'utf8');
}

/**
 * The chain module is real and live: `CenterWorkspace` renders it, and it takes the
 * centre-pane decision itself with the route-applied signal.
 */
export function assertCenterPaneOwnerIsRendered(): void {
	const workspace = centerPaneSource('src/components/timetable/CenterWorkspace.tsx');
	assert.match(workspace, /<CenterWorkspacePaneSurface/,
		'the centre-pane chain must still be rendered by CenterWorkspace, not duplicated elsewhere');
	assert.match(centerPaneSource(CENTER_PANE_OWNER), /resolveCenterPane\(pathname, centerView, routeAppliedPathname\)/,
		'the extracted surface must take the M1 decision itself, with the route-applied signal');
}
