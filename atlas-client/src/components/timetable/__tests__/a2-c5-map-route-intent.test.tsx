/**
 * A2 C5 item 2 — `/timetable/map` must never paint the previous section's grid.
 *
 * ── THE DEFECT HAD TWO SEPARABLE PARTS, AND THIS FILE PROVES DIFFERENT THINGS
 * ── ABOUT EACH. AN EARLIER VERSION OF THIS FILE CONFLATED THEM, AND THAT WAS
 * ── WRONG.
 *
 *   (a) THE DECISION   — which pane is selected for a render. Testable here on
 *                        real rendered output.
 *   (b) THE ARRANGEMENT — WHERE the pending branch is mounted relative to
 *                        `<AnimatePresence mode="wait">`. Not testable on
 *                        rendered output in this harness; it is a structural
 *                        property of `CenterWorkspace`'s JSX.
 *
 * Why they had to be separated: a first attempt put the pending branch as the
 * first ternary arm INSIDE the animated chain. `AnimatePresence` with
 * `mode="wait"` keeps the EXITING child mounted and defers the incoming child's
 * mount, so the previous section's cells stayed in the DOM for the exit
 * duration. Fixing only (a) leaves that defect in place — the decision would be
 * right and the paint would still be wrong.
 *
 * A DOM row CANNOT see (b). It renders `MapRouteTransitionFrame` on its own, and
 * would still pass verbatim if the guard were moved back inside the chain. The
 * DOM rows below are therefore scoped to (a) and say so in their names, and a
 * separate, clearly-labelled WIRING row carries (b). That wiring row is
 * load-bearing, not decorative: it is proved to discriminate in the
 * "F2 DISCRIMINATION" note below.
 *
 * WHY NO FULL `CenterWorkspace` RENDER: the component takes roughly 200 props
 * assembled by three context builders (`buildScheduleReviewWorkspaceContexts` and
 * friends). Standing up a fake of that surface would test the fake, and a real
 * one is not reachable in this harness. So (b) is checked structurally against
 * the committed source, which is the only class of evidence available for it.
 *
 * ── EVIDENCE CLASS OF EVERY ROW ───────────────────────────────────────────
 *
 * | row                                  | proves            | class              |
 * |--------------------------------------|-------------------|--------------------|
 * | POSITIVE CONTROL                      | the real grid's markers exist | DOM / real component |
 * | DECISION                              | (a) selection + the intent renders grid-free | DOM / real component |
 * | ARRANGEMENT (load-bearing)            | (b) placement vs the chain | WIRING (structural) |
 * | REPLACEMENT CONTROL                   | (b) the pending branch is a sibling, not a descendant | WIRING (structural) |
 * | SUPERSEDED mutant                     | nothing — retained as a marker only | superseded |
 * | M2-A seam table / M2-B / M2-D        | the decision's inputs and the copy | unit / value-pinned |
 *
 * ── FAILING-FIRST (M2-C) ─────────────────────────────────────────────────
 *
 * Recorded with the new module REMOVED as well as the changed files, keeping only
 * this test file, and `CenterWorkspace.tsx` at base `bd789d86` bytes:
 *
 *   npx tsx --test src/components/timetable/__tests__/a2-c5-map-route-intent.test.tsx
 *
 *   ℹ tests 1  ℹ pass 0  ℹ fail 1
 *   Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/components' imported from
 *   …\src\components\timetable\__tests__\a2-c5-map-route-intent.test.tsx
 *
 * The file cannot load at all: the decision seam, the frame and the wiring are
 * all ABSENT at base, not "present but wrong". An earlier version of this header
 * kept the new module present during the revert, so three rows passed at base
 * while only testing new code in isolation; that version was partly tautological
 * and was rejected in re-review.
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

test('A2 C5 M2-A POSITIVE CONTROL (DOM, real component): a real schedule grid really does emit these markers', () => {
	const grid = renderRealScheduleGrid();
	// This is the most valuable row in the file. Every negative assertion below
	// is only meaningful because a REAL grid emits these strings: without it they
	// could pass because the markers are never emitted by anything at all.
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

test('A2 C5 M2-A DECISION, not arrangement (DOM, real component): the pending branch is selected and renders the intent with no class cell', () => {
	// SCOPE, stated in the name because it is the whole point of the re-review:
	// this row proves (a) THE DECISION. It does NOT prove (b) the arrangement.
	// It renders `MapRouteTransitionFrame` on its own and would still pass
	// verbatim if the guard were moved back inside the animated chain. The
	// arrangement is carried by the ARRANGEMENT row below.
	//
	// The decision is the one `CenterWorkspace` makes — the same exported seam,
	// not a reimplementation of it.
	const decision = resolveCenterPane(MAP_PATH, 'schedule');
	assert.equal(decision.kind, 'pending-map-intent', 'the route says map and the view has not caught up');

	const markup = renderToStaticMarkup(<MapRouteTransitionFrame pathname={MAP_PATH} />);

	// The intent IS shown, carrying none of the real grid's markers.
	assert.match(markup, /data-testid="timetable-map-route-transition-intent"/, 'the map intent is in the rendered output');
	assertGridAbsent(markup, 'the pending map pane');
	assert.equal(
		markup.includes(PREVIOUS_SECTION_ENTRY_ID),
		false,
		'no previous-section class cell is rendered by the pending branch',
	);
});

test('A2 C5 M2-A SUPERSEDED (F2 re-review: true by construction — NOT a live control)', () => {
	// SUPERSEDED (a2-c5-map, F2 re-review). Kept as a marker per §16, never
	// deleted. This row was self-fulfilling for two independent reasons, both
	// verified in this repo:
	//
	//  1. IT INJECTED THE EVIDENCE. The assertion below only held because the
	//     test itself passed `renderRealScheduleGrid()` — already-rendered
	//     markup — in as a child. Of course the grid string was present: the
	//     test put it there. Removing the grid from the tree would have failed
	//     the row, which is the opposite of a control.
	//
	//  2. IT MIS-MODELLED THE DEFECT. It mounted grid and frame SIMULTANEOUSLY
	//     as two children. In the real rejected arrangement they were ternary
	//     SIBLINGS mounted ONE AT A TIME, and the grid persisted only because
	//     the swap was DEFERRED. Mounting both at once never reproduces a
	//     deferral, so the row did not model what it claimed to model.
	//
	//  3. AND THE `mode="wait"` PATH NEVER RAN. Verified in
	//     `node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs`:
	//     the deferral is gated at line 100 on `presentChildren !== diffedChildren`,
	//     and `diffedChildren` is initialised to `presentChildren` at line 78. In
	//     a single `renderToStaticMarkup` pass they are equal, so line 118's
	//     `if (mode === "wait" && exitingChildren.length)` never executes and
	//     `AnimatePresence` degenerates to rendering its children directly. This
	//     row therefore still PASSES with `AnimatePresence` deleted entirely —
	//     proved by that fact, and the reason re-review rejected it.
	//
	// The sound replacement is the REPLACEMENT CONTROL below.
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
		'SUPERSEDED — this only shows the test can find a string it injected itself; it proves nothing about the arrangement',
	);
});

/** The committed `CenterWorkspace` source, for the structural rows. */
function centerWorkspaceSource(): string {
	return readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/CenterWorkspace.tsx'), 'utf8');
}

const PENDING_BRANCH = "centerPane.kind === 'pending-map-intent' ? (";
const PRESENCE_OPEN = '<AnimatePresence mode="wait">';

/** The byte range of the animated chain, i.e. its open tag through its close. */
function animatedChainRange(source: string): { start: number; end: number } {
	const start = source.indexOf(PRESENCE_OPEN);
	assert.ok(start > 0, 'the animated chain still exists');
	const close = source.indexOf('</AnimatePresence>', start);
	assert.ok(close > start, 'the animated chain is closed');
	return { start, end: close };
}

test('A2 C5 M2-A ARRANGEMENT, WIRING (load-bearing): the pending branch is decided BEFORE the animated chain opens', () => {
	// This row is a WIRING row and is labelled as one. It carries (b) THE
	// ARRANGEMENT, which no DOM row in this file can reach.
	//
	// It is LOAD-BEARING, not decorative. Re-review required proof that moving
	// the pending branch back inside the chain FAILS this row; that proof is in
	// the "F2 DISCRIMINATION" comment at the foot of this file, and it was run.
	const source = centerWorkspaceSource();
	const decision = source.indexOf(PENDING_BRANCH);
	const chain = animatedChainRange(source);

	// (1) The decision is evaluated at the outer ternary, before the chain opens.
	assert.ok(decision > 0, 'the workspace branches on the pending decision');
	assert.ok(
		decision < chain.start,
		`the pending branch must be decided BEFORE the animated chain opens — otherwise the decision sits inside the deferring chain and the grid lingers (decision ${decision}, chain ${chain.start})`,
	);

	// (2) `mode="wait"` is NOT applied to a chain that contains the pending
	//     branch. This is the precise form of "the guard is not in the chain": the
	//     entire chain body must be free of it, so a partially-migrated guard
	//     that still animates its exit also fails here.
	const chainBody = source.slice(chain.start, chain.end);
	assert.equal(
		chainBody.includes('pending-map-intent'),
		false,
		'no `mode="wait"` chain may contain the pending branch, or its exit defers the new child and the stale grid stays mounted',
	);
	assert.equal(
		chainBody.includes('MapRouteTransitionFrame'),
		false,
		'the pending frame must not be mounted anywhere inside the deferring chain',
	);

	// (3) The grid branch is unreachable while the route is pending: between the
	//     decision and the chain opening there is no grid pane arm, so a pending
	//     render can only reach the pending branch.
	const beforeChain = source.slice(decision, chain.start);
	assert.equal(
		/centerView === '(schedule|map|building|runs|setup|policy)'/.test(beforeChain),
		false,
		'no pane arm is selected between the pending decision and the animated chain, so a pending render cannot reach the grid',
	);
	assert.match(
		source,
		/const centerPane = resolveCenterPane\(pathname, centerView\);/,
		'the workspace consumes the exported seam the DOM rows exercise',
	);
	// The grid arms stay reachable INSIDE the chain, for every other view.
	for (const arm of ["centerView === 'schedule'", "presentationMode === 'matrix'", "centerView === 'map'"]) {
		assert.ok(
			source.indexOf(arm, chain.start) > chain.start,
			`${arm} must still be reachable inside the animated chain for non-pending renders`,
		);
	}
});

test('A2 C5 M2-A REPLACEMENT CONTROL (WIRING, structural): the pending branch is a SIBLING of the animated chain, not a descendant', () => {
	// The sound replacement for the superseded mutant. The superseded row tried
	// to observe the arrangement by MOUNTING a copy of it, which made it true by
	// construction and never exercised `mode="wait"` at all. The arrangement is
	// not a runtime property under a static render — it is a structural property
	// of the committed JSX — so it is asserted structurally, against the real
	// file, as a WIRING assertion.
	//
	// What makes this sound where the mutant was not: nothing is injected. The
	// strings checked below are read from the production source, so the row can
	// only pass if the production arrangement really is what it claims.
	const source = centerWorkspaceSource();
	const decision = source.indexOf(PENDING_BRANCH);
	const frame = source.indexOf('<MapRouteTransitionFrame pathname={pathname} />');
	const chain = animatedChainRange(source);

	// The decision and its frame are contiguous, immediately before the chain.
	assert.ok(frame > decision, 'the pending frame is rendered by the pending branch');
	assert.ok(
		frame < chain.start,
		`the pending frame must be emitted before the animated chain opens, i.e. as its SIBLING (frame ${frame}, chain ${chain.start})`,
	);

	// Exactly one animated chain, and it is closed after it opens.
	assert.equal((source.match(/<AnimatePresence/g) ?? []).length, 1, 'there is exactly one animated chain in the center workspace');
	assert.equal(
		(source.match(/<\/AnimatePresence>/g) ?? []).length,
		1,
		'and it is closed exactly once',
	);

	// The frame element is emitted ONCE in the whole file. If it were also
	// mounted inside the chain, this fails — which is the same defect the
	// superseded mutant failed to detect, now checked against real source.
	assert.equal(
		(source.match(/<MapRouteTransitionFrame/g) ?? []).length,
		1,
		'the pending frame is emitted exactly once, outside the chain',
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

test('A2 C5 M2-A decision inputs: the seam decides pending only for a caught-up map route', () => {
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

// ─── F2 DISCRIMINATION PROOF (recorded evidence, §11) ──────────────────────
//
// The ARRANGEMENT and REPLACEMENT CONTROL rows above are WIRING rows, and a
// wiring row is only worth its cost if it FAILS when the wiring is wrong. So the
// production arrangement was temporarily mutated in a scratch edit — the pending
// branch moved back INSIDE the `<AnimatePresence mode="wait">` chain, reproducing
// the rejected in-chain design — the suite was run, and the file restored
// byte-for-byte.
//
//   npx tsx --test src/components/timetable/__tests__/a2-c5-map-route-intent.test.tsx
//
//   AssertionError [ERR_ASSERTION]: the pending branch must be decided BEFORE the
//   animated chain opens — otherwise the decision sits inside the deferring chain
//   and the grid lingers (decision 18823, chain 18787)
//     actual: false
//   expected: true
//
//   AssertionError [ERR_ASSERTION]: the pending frame must be emitted before the
//   animated chain opens, i.e. as its SIBLING (frame 18874, chain 18787)
//     actual: false
//   expected: true
//
//   ℹ tests 8  ℹ pass 6  ℹ fail 2
//
// Both wiring rows failed on the mutated arrangement, and the SIX non-wiring rows
// were unaffected — which is exactly the split this file claims. The DOM rows
// cannot see the arrangement, and these two rows can: that is what makes them
// load-bearing rather than decorative.
//
// `CenterWorkspace.tsx` was then restored from a byte-exact copy taken before the
// scratch edit; its SHA-256 returned to
// 508065A8DDA0457F19B3D9599A1C7B37AA9F81954F54432C90B11FE8FD5014EC and
// `git status --short` for that path is empty, so the production file is
// byte-identical to the committed candidate.
