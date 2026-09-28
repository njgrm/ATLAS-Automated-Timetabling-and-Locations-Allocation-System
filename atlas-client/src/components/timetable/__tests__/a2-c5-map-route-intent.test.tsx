/**
 * A2 C5 item 2 — `/timetable/map` must never paint the previous section's grid.
 *
 * FAILING-FIRST (M2-C), recorded at base `bd789d86` by reverting
 * `CenterWorkspace.tsx` to its base bytes with this file and the new
 * `MapRouteTransitionIntent.tsx` both in place, then running:
 *
 *   npx tsx --test src/components/timetable/__tests__/a2-c5-map-route-intent.test.tsx
 *
 *   ✔ A2 C5 M2-A: the map route is pending before the view catches up (0.6384ms)
 *   ✔ A2 C5 M2-B: the pending render shows the EXISTING map intent, by value (5.7115ms)
 *   ✔ A2 C5 M2-A: the pending pane carries no schedule-grid content (0.7108ms)
 *   ✖ A2 C5 M2-A: the intent branch is FIRST in the center workspace, ahead of the grid
 *   ✔ A2 C5 M2-D: the other six route intents are unchanged (0.1339ms)
 *   ℹ tests 5  ℹ pass 4  ℹ fail 1
 *
 *   AssertionError [ERR_ASSERTION]: the pending-intent branch is inside the render chain
 *       actual: false
 *     expected: true
 *
 * READ THIS HONESTLY: three rows pass at base, and that is not a false green. The
 * predicate and the intent markup are NEW code in a new module, so at base they
 * are exercised in isolation and pass. The DEFECT is the wiring — the branch that
 * makes the center workspace consult them — and that is exactly the one row that
 * fails, with `actual: false` meaning the base render chain contains no
 * pending-intent branch at all, so the map route falls through to the schedule
 * and matrix branches and paints the previous section's cells. A failing-first
 * that only failed rows of brand-new code would prove nothing about the defect.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import {
	MapRouteTransitionIntent,
	isMapRouteTransitionPending,
} from '@/components/timetable/MapRouteTransitionIntent';
import { resolveTimetableLoadingIntent } from '@/components/timetable/timetable-route-loading-intent';
import { resolveTimetableRouteView } from '@/components/timetable/TimetableRouteViewSync';

const CLIENT_ROOT = resolve(import.meta.dirname, '../../../..');
const MAP_PATH = '/timetable/map';

/**
 * Every routed center view, with the state it is in on the first render after
 * the route changed. `'schedule'` is the base value that produced the defect.
 */
const VIEW_CASES: ReadonlyArray<{ pathname: string; view: string; expected: boolean }> = [
	// The defect: the route already resolves to map, the view has not moved.
	{ pathname: MAP_PATH, view: 'schedule', expected: true },
	{ pathname: MAP_PATH, view: 'pre-generation', expected: true },
	{ pathname: MAP_PATH, view: 'manual-edit', expected: true },
	// Settled: the view is map, so the real map pane owns the panel.
	{ pathname: MAP_PATH, view: 'map', expected: false },
	// Every other route must be untouched by this fix.
	{ pathname: '/timetable', view: 'schedule', expected: false },
	{ pathname: '/timetable/policies', view: 'policy', expected: false },
	{ pathname: '/timetable/pre-generation', view: 'pre-generation', expected: false },
	{ pathname: '/timetable/manual-edit', view: 'manual-edit', expected: false },
	{ pathname: '/timetable/building', view: 'building', expected: false },
	{ pathname: '/timetable/runs', view: 'runs', expected: false },
	{ pathname: '/timetable/setup', view: 'setup', expected: false },
	// The map route reached by direct URL, with a trailing slash.
	{ pathname: `${MAP_PATH}/`, view: 'schedule', expected: true },
];

test('A2 C5 M2-A: the map route is pending before the view catches up', () => {
	for (const testCase of VIEW_CASES) {
		assert.equal(
			isMapRouteTransitionPending(testCase.pathname, testCase.view),
			testCase.expected,
			`${testCase.pathname} with centerView '${testCase.view}' should${testCase.expected ? '' : ' not'} be pending`,
		);
	}
});

test('A2 C5 M2-B: the pending render shows the EXISTING map intent, by value', () => {
	const expected = resolveTimetableLoadingIntent(MAP_PATH);
	assert.ok(expected, 'the existing intent table still declares /timetable/map');
	// Asserted BY VALUE against the single existing export, not against a literal
	// copied here, so this row fails if the copy is ever reworded and cannot pass
	// on a second, drifting copy invented for the transition.
	assert.equal(expected.title, 'Rooms and map');
	assert.equal(expected.message, 'Checking rooms and schedule information.');

	const markup = renderToStaticMarkup(<MapRouteTransitionIntent pathname={MAP_PATH} />);
	assert.match(markup, /Rooms and map/, 'the title is rendered');
	assert.match(markup, /Checking rooms and schedule information\./, 'and so is the message');
	assert.match(
		markup,
		new RegExp(`data-testid="timetable-map-route-transition-intent"`),
		'the intent is identifiable in the DOM',
	);
	assert.match(markup, /aria-live="polite"/, 'and it announces itself to assistive tech');
});

test('A2 C5 M2-A: the pending pane carries no schedule-grid content', () => {
	// The grid is the thing that must be absent. This asserts the intent markup
	// carries none of the grid's structural vocabulary, so a re-introduction of a
	// class-cell table inside the pending pane fails here.
	const markup = renderToStaticMarkup(<MapRouteTransitionIntent pathname={MAP_PATH} />);
	for (const gridMarker of ['<table', '<td', 'role="grid"', 'data-testid="timetable-grid"']) {
		assert.doesNotMatch(markup, new RegExp(gridMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `no ${gridMarker} in the pending pane`);
	}
	// A defensively absent intent renders NOTHING rather than falling through to
	// a grid: `isMapRouteTransitionPending` guarantees an intent exists, so this
	// only pins the honest failure mode if that ever stops holding.
	assert.equal(renderToStaticMarkup(<MapRouteTransitionIntent pathname="/timetable" />), '');
});

test('A2 C5 M2-A: the intent branch is FIRST in the center workspace, ahead of the grid', () => {
	// A CenterWorkspace render needs its entire ~200-prop surface, so the ORDER
	// that decides M2-A — intent before grid — is pinned on the source instead.
	// The ternary chain is the render decision; a branch that appears after the
	// schedule/matrix branches would be dead code for this defect.
	const source = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/CenterWorkspace.tsx'), 'utf8');
	const chain = source.indexOf('<AnimatePresence mode="wait">');
	assert.ok(chain > 0, 'the center workspace still renders an AnimatePresence chain');
	const intentAt = source.indexOf('mapRoutePending ? (', chain);
	const scheduleAt = source.indexOf("centerView === 'schedule'", chain);
	const matrixAt = source.indexOf("presentationMode === 'matrix'", chain);
	assert.ok(intentAt > chain, 'the pending-intent branch is inside the render chain');
	assert.ok(
		intentAt < scheduleAt && intentAt < matrixAt,
		`the intent branch must precede the grid branches (intent ${intentAt}, schedule ${scheduleAt}, matrix ${matrixAt})`,
	);
	// It is gated on the shared predicate, not on a second path comparison.
	assert.match(source, /const mapRoutePending = isMapRouteTransitionPending\(pathname, centerView\);/);
});

test('A2 C5 M2-D: the other six route intents are unchanged', () => {
	// Pinned by value, so a reworded or dropped intent fails here. These are the
	// same six the two existing route-intent suites assert; this row is the
	// no-regression guard for the fix that added a seventh consumer.
	const expected: ReadonlyArray<[string, string]> = [
		['/timetable/pre-generation', 'Draft queue'],
		['/timetable/policies', 'Scheduling policies'],
		['/timetable/manual-edit', 'Manual edit'],
		['/timetable/building', 'Building'],
		['/timetable/runs', 'Generation history'],
		['/timetable/setup', 'Check schedule information'],
	];
	for (const [pathname, title] of expected) {
		assert.equal(resolveTimetableLoadingIntent(pathname)?.title, title, `${pathname} keeps its intent title`);
		assert.equal(
			isMapRouteTransitionPending(pathname, resolveTimetableRouteView(pathname)),
			false,
			`${pathname} is never treated as a pending map route`,
		);
	}
	// A trailing slash resolves to the same view, so it is pending on the map
	// route too — the normalization is the existing helper's, not a new one.
	assert.equal(resolveTimetableRouteView(`${MAP_PATH}/`), 'map');
});
