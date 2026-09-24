import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { resolveOutletKey } from '../AppShell';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
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

test('UX-R03d row 1: both outlet sites in AppShell use the helper', () => {
	const shell = source('src/components/AppShell.tsx');
	const usages = shell.match(/resolveOutletKey\(location\.pathname, routeEpoch\)/g) ?? [];
	assert.equal(usages.length, 2, 'both outlet key sites (motion.div and cloneElement) must use resolveOutletKey');
	assert.doesNotMatch(shell, /\$\{location\.pathname\}:\$\{routeEpoch\}/, 'no raw pathname:epoch template may remain');
});
