import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

// --- R5 scope hygiene: all component-local state clears on scope change ---

test('R5 the workspace derives a scope key from school, year, run, and term', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /buildScopeKey\(/);
	assert.match(workspace, /shouldClearForScopeChange/);
	assert.match(workspace, /clearScopeState/);
	assert.match(workspace, /schoolId/);
	assert.match(workspace, /schoolYearId/);
	assert.match(workspace, /runId/);
	assert.match(workspace, /termFilter/);
});

test('R5 a scope change clears sheets, task, selection, and swap state', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /setActiveSimpleTask\(null\)/);
	assert.match(workspace, /setRepairOrigin\(null\)/);
	assert.match(workspace, /setReadinessSheetOpen\(false\)/);
	assert.match(workspace, /setTeacherDepartureOpen\(false\)/);
	assert.match(workspace, /setSimpleDetailsOpen\(false\)/);
	assert.match(workspace, /setSwapClassTimesMode\?\.\(null\)/);
	assert.match(workspace, /setLastAutoSaveUndo\?\.\(null\)/);
});

// --- R8 no dead repair navigation ---

test('R8 S1-owned repair links no longer target the dead /campus-rooms route', () => {
	assert.doesNotMatch(source('src/components/timetable/TimetableSimpleHeader.tsx'), /campus-rooms/);
	assert.doesNotMatch(source('src/components/timetable/simple/SimpleTaskDrawerHelpers.tsx'), /campus-rooms/);
	assert.match(source('src/components/timetable/TimetableSimpleHeader.tsx'), /navigate\('\/map'\)/);
});

test('R8 every S1-owned repair href resolves to a mounted route', () => {
	const app = source('src/App.tsx');
	const mountedPaths = new Set(
		Array.from(app.matchAll(/path:\s*'([^']+)'/g)).map((match) => `/${match[1].replace(/^\//, '')}`),
	);
	// Routes owned by the S1 repair set.
	for (const href of ['/map', '/teaching-load', '/admin/year-setup', '/subjects', '/sections']) {
		assert.ok(mountedPaths.has(href), `expected a mounted route for ${href}`);
	}
	assert.ok(!mountedPaths.has('/campus-rooms'), '/campus-rooms must remain unmounted');
});

// --- R10 honest archived/read-only exclusion ---

test('R10 the workspace keeps the runtime-active-year binding explicit', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /data-timetable-year-binding="runtime-active-only"/);
});

test('R10 no archived-year mutation affordance is introduced in S1-owned surfaces', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.doesNotMatch(workspace, /archived/i);
	assert.doesNotMatch(header, /Bind archived year|Switch to archived year/);
});
