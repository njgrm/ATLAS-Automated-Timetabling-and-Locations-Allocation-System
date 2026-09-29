import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { resolveOutletKey } from '../AppShell';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

/**
 * A5 C4 ITEM 4 CORRECTION: strip `/* *\/` and `//` comments from a source string.
 *
 * A structural check that reads prose fails on prose. Both files in this row NAME
 * `resolveOutletKey` in their comments — that naming is the record of where the key
 * comes from, and a gate that forbade the explanation of the change it gates would
 * push the explanation out of the source. Both syntaxes are handled because a wrapped
 * `//` line does not start with `*`.
 */
function stripComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// The seven canonical timetable child routes (App.tsx `timetable` children:
// index + policies + pre-generation + map + manual-edit + building + exports).
const TIMETABLE_CANONICAL = [
	'/timetable',
	'/timetable/policies',
	'/timetable/pre-generation',
	'/timetable/map',
	'/timetable/manual-edit',
	'/timetable/building',
	'/timetable/exports',
];

const TIMETABLE_EDGE_CASES = [
	'/timetable/',
	'/timetable/policies/',
	'/timetable/unknown-child',
];

const NON_TIMETABLE_PATHS = [
	'/subjects',
	'/subjects/requirements',
	'/teaching-load',
	'/teaching-load/history',
	'/faculty/preferences',
	'/faculty/room-preferences',
	// S2 — the scheduler concern workspace is another non-timetable surface.
	'/faculty/concerns',
	'/timetabling/how-it-works',
];

test('UX-R03d row 3: the seven canonical paths and the edge cases share one key', () => {
	const epoch = 0;
	const expected = `/timetable:${epoch}`;
	for (const pathname of [...TIMETABLE_CANONICAL, ...TIMETABLE_EDGE_CASES]) {
		assert.equal(resolveOutletKey(pathname, epoch), expected, `${pathname} must collapse to the shared timetable key`);
	}
});

test('UX-R03d row 3: non-timetable paths keep the exact legacy key', () => {
	const epoch = 0;
	for (const pathname of NON_TIMETABLE_PATHS) {
		assert.equal(resolveOutletKey(pathname, epoch), `${pathname}:${epoch}`, `${pathname} must keep its exact legacy key`);
	}
	// Nested pairs on other pages must still differ from each other (remount as today).
	assert.notEqual(resolveOutletKey('/subjects', epoch), resolveOutletKey('/subjects/requirements', epoch));
	assert.notEqual(resolveOutletKey('/teaching-load', epoch), resolveOutletKey('/teaching-load/history', epoch));
	assert.notEqual(resolveOutletKey('/faculty/preferences', epoch), resolveOutletKey('/faculty/room-preferences', epoch));
});

test('UX-R03d row 2: changing routeEpoch changes the key (remount preserved)', () => {
	for (const pathname of [...TIMETABLE_CANONICAL, '/timetable/unknown-child', '/subjects', '/']) {
		assert.notEqual(resolveOutletKey(pathname, 0), resolveOutletKey(pathname, 1), `${pathname} must remount when the rollover epoch advances`);
	}
});

test('UX-R03d row 1: the outlet key is DERIVED by the helper, in both the shell and the outlet it feeds', () => {
	const shell = source('src/components/AppShell.tsx');
	// A5 C4 ITEM 4, RE-POINTED — NOT DELETED, and not lowered to `1` and stopped.
	//
	// Superseded verbatim, with the measured reason:
	//   const usages = shell.match(/resolveOutletKey\(location\.pathname, routeEpoch\)/g) ?? [];
	//   assert.equal(usages.length, 2,
	//     'both outlet key sites (motion.div and cloneElement) must use resolveOutletKey');
	//
	// It counted 2 because the outlet's remount key was applied TWICE inside
	// `AppShell` — once on the `motion.div` and again on the `cloneElement`. The
	// A5 C4 item-4 change EXTRACTED the outlet, its key and its fallback into
	// `components/app-shell/RouteOutlet.tsx` to remove `AnimatePresence mode="wait"`,
	// and the two applications collapsed into one: the `motion.div` and the
	// `cloneElement` are now the same element, so the key is passed down as a single
	// `outletKey` prop and applied once inside the outlet. Measured: base 2, candidate
	// 1.
	//
	// THE INTENT IS UNCHANGED AND IS NOW CHECKED IN BOTH PLACES, which is stronger
	// than the count it replaces. What this row exists to forbid is a hand-built
	// `pathname:epoch` key, because that string is the remount contract: get it wrong
	// and a route change silently fails to remount. So:
	//   1. the shell still derives the key from the helper, exactly once, and
	//   2. the outlet RECEIVES it as a prop and does not recompute or re-derive it.
	// A future edit that moved the derivation into the outlet, or inlined a template
	// anywhere in either file, is red.
	const usages = shell.match(/resolveOutletKey\(location\.pathname, routeEpoch\)/g) ?? [];
	assert.equal(
		usages.length,
		1,
		`the shell must derive the outlet key from the helper exactly once, and hand it to the outlet; found ${usages.length}`,
	);
	assert.doesNotMatch(shell, /\$\{location\.pathname\}:\$\{routeEpoch\}/, 'no raw pathname:epoch template may remain in the shell');

	// The half this range added: the outlet must NOT derive the key itself. If it
	// computed `resolveOutletKey(...)` or built the template locally, the two files
	// could disagree about what a remount key is — which is the failure mode the
	// single derivation exists to prevent.
	//
	// COMMENTS ARE STRIPPED before this check, from BOTH syntaxes. `RouteOutlet`
	// NAMES `resolveOutletKey` in prose — it is the record of where the key comes
	// from, and a check that failed on that record would be a gate forbidding the
	// explanation of the change it gates.
	const outletCode = stripComments(source('src/components/app-shell/RouteOutlet.tsx'));
	assert.doesNotMatch(
		outletCode,
		/resolveOutletKey/,
		'RouteOutlet must receive the outlet key as a prop, not recompute it: two derivations can drift',
	);
	assert.doesNotMatch(
		outletCode,
		/\$\{[^}]*pathname[^}]*\}:\$\{[^}]*epoch[^}]*\}/,
		'no raw pathname:epoch template may exist in RouteOutlet either',
	);
	// And it really is a prop, applied to the element the shell used to key twice.
	assert.match(outletCode, /outletKey: string;/, 'RouteOutlet does not take the outlet key as a prop');
	assert.match(outletCode, /key=\{outletKey\}/, 'RouteOutlet does not apply the outlet key it was given');
	// The shell passes the helper's result straight through, unedited.
	assert.match(
		stripComments(shell),
		/outletKey=\{resolveOutletKey\(location\.pathname, routeEpoch\)\}/,
		'the shell no longer passes the helper result straight through as outletKey',
	);
});
