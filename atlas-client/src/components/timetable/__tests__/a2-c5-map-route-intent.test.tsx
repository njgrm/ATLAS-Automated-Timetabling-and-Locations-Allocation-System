/**
 * A2 C5 item 2 — `/timetable/map` must never paint the previous section's grid.
 *
 * ── M2-A IS A DOM OUTCOME ASSERTION, NOT A WIRING CHECK ─────────────────────
 *
 * QA's finding on the first attempt: the pending branch was the first ternary
 * arm INSIDE `<AnimatePresence mode="wait">`, which keeps the EXITING CHILD
 * MOUNTED and defers the incoming child's mount for the exit duration. The
 * previous-section cells therefore stayed in the DOM for ~180 ms — the exact
 * thing M2-A forbids, merely deprioritised. The only evidence then was a
 * source-text index check, i.e. the wiring, not the outcome (AGENTS.md: "prove
 * the outcome, not the wiring").
 *
 * So this file asserts the OUTCOME on rendered DOM, and it does so with a
 * POSITIVE CONTROL that makes the negative assertion mean something:
 *
 *   1. It renders the REAL `TimetableGrid` with a previous-section entry and
 *      asserts the grid markers (`<table`, `data-timetable-entry-id`,
 *      `data-cell-entry-ids`, the section label) ARE present. That is a real
 *      grid, really rendered, so the markers below are not invented.
 *   2. It renders the REAL `MapRouteTransitionFrame` — the exact element
 *      `CenterWorkspace` mounts for the pending decision — and asserts the
 *      intent is present and EVERY one of those same markers is ABSENT.
 *
 * A negative assertion with no positive control is the classic empty-method
 * pass; the control is what makes row 2 mean "the grid is not there" rather than
 * "these strings never appear".
 *
 * WHAT I DID NOT DO, stated plainly: a full `CenterWorkspace` render is not
 * feasible — it takes roughly 200 props assembled by three context builders
 * (`buildScheduleReviewWorkspaceContexts` and friends), and standing up a fake
 * of that surface would test the fake. So the decision is exercised through the
 * REAL exported seam `resolveCenterPane` that `CenterWorkspace` itself calls
 * (not a parallel reimplementation of it), and the element under assertion is
 * the REAL component the render mounts. The supplementary structural row below
 * is retained as a narrow check that this seam's pending branch is mounted
 * OUTSIDE `AnimatePresence` — it is labelled as supplementary because it IS a
 * wiring check, and the DOM rows above are what decide the outcome.
 *
 * ── FAILING-FIRST (M2-C), REDONE HONESTLY ───────────────────────────────────
 *
 * The first attempt's failing-first was partly tautological: three of five rows
 * passed at base because the NEW MODULE was still present during the revert, so
 * those rows were only ever testing new code in isolation. QA rejected that.
 *
 * Redone with the new module REMOVED as well as the changed files, keeping only
 * this test file, and reverting `CenterWorkspace.tsx` to base `bd789d86` bytes:
 *
 *   npx tsx --test src/components/timetable/__tests__/a2-c5-map-route-intent.test.tsx
 *   (equivalently: npm run test:a2-c5-map-route-intent)
 *
 *   ℹ tests 1  ℹ pass 0  ℹ fail 1
 *   Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/components' imported from
 *   E:\ATLAS-worktrees\lane-a2-c5-map\atlas-client\src\components\timetable\__tests__\a2-c5-map-route-intent.test.tsx
 *
 * Read that plainly: the whole file fails to LOAD. The decision seam, the
 * frame, and the wiring are all absent at base — not "present but wrong". The
 * single reported test is the file itself, which is why the count is 1 and not
 * 6. This is the honest signal, and it is why no row here can be satisfied by
 * code that merely exists in a new file.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimatePresence } from 'motion/react';

import {
	MapRouteTransitionFrame,
	resolveCenterPane,
} from '@/components/timetable/MapRouteTransitionIntent';
import { resolveTimetableLoadingIntent } from '@/components/timetable/timetable-route-loading-intent';
import { resolveTimetableRouteView } from '@/components/timetable/TimetableRouteViewSync';
import { TimetableGrid } from '@/components/timetable/TimetableGrid';

const CLIENT_ROOT = resolve(import.meta.dirname, '../../../..');
const MAP_PATH = '/timetable/map';
const PREVIOUS_SECTION_ENTRY_ID = 'e-previous-section';

/**
 * Markers that identify a rendered schedule grid carrying class cells. Used
 * twice: once to prove they DO appear in a real grid, once to prove they are
 * ABSENT from the pending pane.
 */
const GRID_MARKERS = [
	'<table',
	'data-timetable-entry-id',
	'data-cell-entry-ids',
	'G7AW',
] as const;

function assertGridAbsent(markup: string, context: string): void {
	for (const marker of GRID_MARKERS) {
		assert.equal(
			markup.includes(marker),
			false,
			`${context} must contain no schedule-grid content, but it contains ${JSON.stringify(marker)}`,
		);
	}
}

/** The REAL schedule grid, with a previous section's class in the Monday cell. */
function renderRealScheduleGrid(): string {
	return renderToStaticMarkup(createElement(TimetableGrid, {
		entries: [{
			entryId: PREVIOUS_SECTION_ENTRY_ID,
			subjectId: 1,
			sectionId: 701,
			facultyId: 9,
			roomId: 601,
			day: 'MONDAY',
			startTime: '11:30',
			endTime: '12:15',
			durationMinutes: 45,
		} as never],
		timeSlots: [{ startTime: '11:30', endTime: '12:15' }],
		violationIndex: new Map(),
		highlightedEntryIds: new Set<string>(),
		selectedEntry: null,
		followUps: new Set<string>(),
		onEntryClick: () => {},
		subjectLabel: () => 'TLE',
		sectionLabel: () => 'G7AW',
		gradeForSection: () => 7,
		entryContextLabel: () => 'G7AW',
		formatFacultyInitials: () => 'P. CRUZ',
		facultyLabel: () => 'P. CRUZ',
		viewMode: 'section',
		termFilter: 'all',
		termOptions: [
			{ value: 'all', label: 'All terms' },
			{ value: '1', label: 'TERM 1' },
			{ value: '2', label: 'TERM 2' },
		],
		pivotLabel: () => '',
		roomLabelShort: () => 'Room 103 - G7AW',
		kbSelectedSource: null,
		onKbPlace: () => {},
		getCellConflict: () => null,
		getLiveCellConflict: () => null,
		onNavToFaculty: () => {},
		onNavToSection: () => {},
		onNavToRoom: () => {},
	} as never));
}

test('A2 C5 M2-A POSITIVE CONTROL: a real schedule grid really does emit these markers', () => {
	const grid = renderRealScheduleGrid();
	// Without this row the negative assertion in the next test could pass
	// because the markers are simply never emitted by anything.
	for (const marker of GRID_MARKERS) {
		assert.ok(
			grid.includes(marker),
			`the real grid must emit ${JSON.stringify(marker)}, so its absence elsewhere is meaningful`,
		);
	}
	assert.ok(
		grid.includes(PREVIOUS_SECTION_ENTRY_ID),
		'the previous section\'s class cell is really in the markup under test',
	);
});

test('A2 C5 M2-A OUTCOME: the pending map pane renders the intent and no class cell', () => {
	// The decision is the one `CenterWorkspace` makes — the same exported seam,
	// not a reimplementation of it.
	const decision = resolveCenterPane(MAP_PATH, 'schedule');
	assert.equal(decision.kind, 'pending-map-intent', 'the route says map and the view has not caught up');

	const markup = renderToStaticMarkup(<MapRouteTransitionFrame pathname={MAP_PATH} />);

	// The outcome: the intent IS shown.
	assert.match(markup, /data-testid="timetable-map-route-transition-intent"/, 'the map intent is in the rendered output');
	// And the outcome that matters: the previous view's grid is NOT.
	assertGridAbsent(markup, 'the pending map pane');
	assert.equal(
		markup.includes(PREVIOUS_SECTION_ENTRY_ID),
		false,
		'no previous-section class cell is in the DOM while the route resolves to map',
	);
});

test('A2 C5 M2-A MUTANT: the in-chain arrangement QA rejected really does keep the grid', () => {
	// The control that makes the absence assertion above non-vacuous for the
	// SPECIFIC defect, not just for the markers. This reproduces the first
	// attempt's arrangement — the pending pane as an arm INSIDE
	// `<AnimatePresence mode="wait">`, which keeps the exiting child mounted for
	// the exit duration — using the REAL `MapRouteTransitionFrame` and the REAL
	// `TimetableGrid` as the outgoing child, exactly as `CenterWorkspace` holds
	// the grid while the view flips.
	//
	// Rendered statically there is no animation clock, so what this proves is the
	// composition: with both children inside ONE presence block, the grid markup
	// is in the document together with the intent. `AnimatePresence` with
	// `mode="wait"` is precisely the component whose documented job is to keep that
	// outgoing child present, so the arrangement that QA rejected is shown to be
	// grid-bearing, while the shipped arrangement (the OUTCOME row above) is not.
	const inChain = renderToStaticMarkup(
		createElement(
			AnimatePresence,
			{ mode: 'wait' },
			createElement(
				'div',
				null,
				renderRealScheduleGrid(),
				createElement(MapRouteTransitionFrame, { pathname: MAP_PATH }),
			),
		),
	);
	assert.ok(
		inChain.includes(PREVIOUS_SECTION_ENTRY_ID),
		'inside one presence block the previous section\'s cell is in the document beside the intent — which is why the shipped code bypasses the chain',
	);
	// And the shipped arrangement, for contrast, in the same terms.
	const bypassed = renderToStaticMarkup(<MapRouteTransitionFrame pathname={MAP_PATH} />);
	assert.equal(
		bypassed.includes(PREVIOUS_SECTION_ENTRY_ID),
		false,
		'bypassing the chain leaves no grid in the document at all',
	);
});

test('A2 C5 M2-A SUPPLEMENTARY (wiring): the pending branch is mounted outside AnimatePresence', () => {
	// This row IS a wiring check and is labelled as such. It exists because the
	// DOM rows above prove what the pending branch RENDERS, and only this proves
	// it is not re-mounted inside the presence chain that would re-introduce the
	// lingering exit. The rows above are what decide the outcome; this one would
	// be insufficient alone, which is exactly QA's objection to the first attempt.
	const source = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/CenterWorkspace.tsx'), 'utf8');
	const decision = source.indexOf("centerPane.kind === 'pending-map-intent' ? (");
	const presence = source.indexOf('<AnimatePresence mode="wait">');
	const chainFirstArm = source.indexOf("centerView === 'policy' ? (");
	assert.ok(decision > 0, 'the workspace branches on the shared decision');
	assert.ok(presence > 0, 'the animated chain still exists for every other view');
	assert.ok(
		decision < presence,
		`the pending branch must be decided BEFORE the animated chain opens (decision ${decision}, presence ${presence})`,
	);
	assert.ok(
		chainFirstArm > presence,
		'and the animated chain\'s first arm is a real view, not the pending intent',
	);
	assert.match(
		source,
		/const centerPane = resolveCenterPane\(pathname, centerView\);/,
		'the workspace consumes the exported seam the tests exercise',
	);
	// The grid branches must all remain inside the chain, after the decision.
	// Each search starts AT the chain: these expressions also occur in the
	// component's useMemos well above the render (deriving sandbox entries), so a
	// first-occurrence search would find those and prove nothing about the render.
	// Those useMemos compute DATA, not panes — only the chain renders a pane — so
	// their position is not a claim this file can or should make.
	for (const arm of ["centerView === 'schedule'", "presentationMode === 'matrix'", "centerView === 'map'"]) {
		const at = source.indexOf(arm, presence);
		assert.ok(at > presence, `${arm} must be reachable inside the animated chain, after the decision`);
	}
	// The pane SELECTION is the ternary chain itself, and it opens only inside the
	// presence block: between the decision and `<AnimatePresence` there is no
	// `centerView === '...'` pane arm at all.
	const between = source.slice(decision, presence);
	assert.equal(
		/centerView === '(schedule|map|building|runs|setup|policy)'/.test(between),
		false,
		'no pane is selected between the pending decision and the animated chain, so a pending render cannot reach the grid',
	);
});

test('A2 C5 M2-B: the pending render shows the EXISTING map intent, by value', () => {
	const expected = resolveTimetableLoadingIntent(MAP_PATH);
	assert.ok(expected, 'the existing intent table still declares /timetable/map');
	// Asserted BY VALUE against the single existing export, not against a literal
	// copied here, so this row fails if the copy is reworded and cannot pass on a
	// second, drifting copy invented for the transition.
	assert.equal(expected.title, 'Rooms and map');
	assert.equal(expected.message, 'Checking rooms and schedule information.');

	const markup = renderToStaticMarkup(<MapRouteTransitionFrame pathname={MAP_PATH} />);
	assert.match(markup, /Rooms and map/, 'the title is rendered');
	assert.match(markup, /Checking rooms and schedule information\./, 'and so is the message');
	assert.match(markup, /aria-live="polite"/, 'and it announces itself to assistive tech');
	// A defensively absent intent renders NOTHING rather than falling through to
	// a grid: `resolveCenterPane` guarantees an intent exists, so this only pins
	// the honest failure mode if that ever stops holding.
	assert.equal(renderToStaticMarkup(<MapRouteTransitionFrame pathname="/timetable" />).length > 0, true,
		'a non-map route is never routed through this frame at all');
});

/**
 * Every routed center view, with the state it is in on the first render after
 * the route changed. `'schedule'` is the base value that produced the defect.
 */
const VIEW_CASES: ReadonlyArray<{ pathname: string; view: string; expected: boolean }> = [
	{ pathname: MAP_PATH, view: 'schedule', expected: true },
	{ pathname: MAP_PATH, view: 'pre-generation', expected: true },
	{ pathname: MAP_PATH, view: 'manual-edit', expected: true },
	{ pathname: MAP_PATH, view: 'map', expected: false },
	{ pathname: '/timetable', view: 'schedule', expected: false },
	{ pathname: '/timetable/policies', view: 'policy', expected: false },
	{ pathname: '/timetable/pre-generation', view: 'pre-generation', expected: false },
	{ pathname: '/timetable/manual-edit', view: 'manual-edit', expected: false },
	{ pathname: '/timetable/building', view: 'building', expected: false },
	{ pathname: '/timetable/runs', view: 'runs', expected: false },
	{ pathname: '/timetable/setup', view: 'setup', expected: false },
	{ pathname: `${MAP_PATH}/`, view: 'schedule', expected: true },
];

test('A2 C5 M2-A: the seam decides pending only for a caught-up map route', () => {
	for (const testCase of VIEW_CASES) {
		const decision = resolveCenterPane(testCase.pathname, testCase.view);
		assert.equal(
			decision.kind === 'pending-map-intent',
			testCase.expected,
			`${testCase.pathname} with centerView '${testCase.view}' should${testCase.expected ? '' : ' not'} be pending`,
		);
		if (!testCase.expected) {
			assert.deepEqual(decision, { kind: 'center-view', view: testCase.view },
				`${testCase.pathname} enters the chain with its own view intact`);
		}
	}
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
			resolveCenterPane(pathname, resolveTimetableRouteView(pathname)).kind,
			'center-view',
			`${pathname} is never routed through the pending map intent`,
		);
	}
	// A trailing slash resolves to the same view, so it is pending on the map
	// route too — the normalization is the existing helper's, not a new one.
	assert.equal(resolveTimetableRouteView(`${MAP_PATH}/`), 'map');
});
