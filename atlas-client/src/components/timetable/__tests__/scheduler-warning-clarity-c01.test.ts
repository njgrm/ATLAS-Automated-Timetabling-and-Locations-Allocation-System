import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

test('all selected-term warning entries remain visible beyond the active review set', () => {
	const grid = read('TimetableGrid.tsx');
	assert.match(grid, /const warnings = violationIndex\.get\(entry\.entryId\)/);
	assert.match(grid, /reviewEntryIds/); // filter may annotate review, but cannot hide other warnings
	assert.match(grid, /Schedule note/);
	assert.match(grid, /Must fix/);
});

test('warning affordance is keyboard discoverable and explains severity and publication blocking', () => {
	const grid = read('TimetableGrid.tsx');
	const indicator = read('TimetableGridConflictBadge.tsx');
	assert.match(grid, /warnings=\{warnings\}/);
	assert.match(indicator, /TooltipTrigger asChild/);
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): assert.match(indicator, /aria-label=\{accessibleName\}/);
	// The sign is named by its severity summary ("1 Must fix, 2 warnings").
	assert.match(indicator, /aria-label=\{warningSummary\}/);
	assert.match(indicator, /blocks saving and publishing|does not block saving or publishing/i);
	assert.doesNotMatch(grid, /violation\.code/);
});

test('warned simple-grid selection opens the read-only details with every warning', () => {
	const workspace = read('ScheduleReviewWorkspace.tsx');
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the details content moved to
	// `simple/SimpleSessionDetails` (dialog from 768 px, drawer below); the
	// workspace passes every warning of the selected entry and the canonical formatter.
	// assert.match(workspace, /timetable-simple-schedule-notes/);
	// assert.match(workspace, /formatConstraintMessage\?\.\(warning\.message\)/);
	assert.match(read('simple/SimpleSessionDetails.tsx'), /timetable-simple-schedule-notes/);
	assert.match(workspace, /violationIndex\.get\(state\.selectedEntry\.entryId\)/);
	assert.match(workspace, /setSimpleDetailsOpen\(true\)/);
	assert.match(workspace, /formatConstraintMessage\?\.\(message\)/);
	const body = read('ScheduleReviewWorkspaceBody.tsx');
	assert.equal((body.match(/formatWarningMessage=\{rightPanelContext\.formatConstraintMessage\}/g) ?? []).length, 2, 'Simple and Advanced workspace grids use the same canonical formatter');
});

test('More omits Prepare, hides unavailable placement and only offers pending room requests', () => {
	const menu = read('simple/SimpleMoreMenuContent.tsx');
	assert.doesNotMatch(menu, />\s*Prepare\s*</);
	assert.match(menu, /context\.summary\?\.unassignedCount/);
	assert.match(menu, /context\.requestPendingCount > 0 \?/);
	assert.match(menu, /Teacher leaving \/ Reassign load/);
	assert.match(menu, /Swap sessions/);
});

test('warning changes preserve selected term and run state and retain the no-global-overflow guard', () => {
	const workspace = read('ScheduleReviewWorkspace.tsx');
	const grid = read('TimetableGrid.tsx');
	assert.match(workspace, /buildScopeKey\([\s\S]*termFilter/);
	assert.match(grid, /termFilter=\{termFilter\}/);
	assert.match(read('../../lib/__tests__/global-scrollbars-c01.test.ts'), /global native scrollbars use thin token-driven styling/);
});

test('closed shared accordion content is hidden from assistive technology and keyboard focus', () => {
	const accordion = read('../../ui/accordion.tsx');
	assert.match(accordion, /aria-hidden=\{!isOpen\}/);
	assert.match(accordion, /inert=\{!isOpen\}/);
});
