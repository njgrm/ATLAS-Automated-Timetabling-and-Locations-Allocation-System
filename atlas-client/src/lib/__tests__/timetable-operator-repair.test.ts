import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

// --- R3 selected-class repair is accurately named and complete ---

test('R3 Simple selected-class menu exposes Change room', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /openSelectedChangeRoom/);
	assert.match(workspace, /enterManualEditView\('CHANGE_ROOM'\)/);
	assert.match(workspace, /timetable-simple-selected-change-room-action/);
	assert.match(workspace, /Change room/);
});

test('R3 bulk teacher leaving is not labelled as a one-class teacher change', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.doesNotMatch(workspace, />\s*Change teacher\s*</);
	assert.doesNotMatch(workspace, /Reassign teacher/);
	assert.match(workspace, /Teacher leaving \(all classes\)/);
});

test('R3 owner repair deep-links to Teaching Load with exact context', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /openSelectedOwnerRepair/);
	assert.match(workspace, /teaching-load\?/);
	assert.match(workspace, /facultyId/);
	assert.match(workspace, /sectionId/);
	assert.match(workspace, /subjectId/);
	assert.match(workspace, /missing-load/);
});

// --- R4 placement cells label with icon + text, not color alone ---

test('R4 placement candidate cells render semantic text labels', () => {
	const grid = source('src/components/timetable/TimetableGrid.tsx');
	assert.match(grid, /placement-target-label/);
	assert.match(grid, /data-placement-state/);
	assert.match(grid, /'Swap'/);
	assert.match(grid, /'Place'/);
	assert.match(grid, /ArrowRightLeft/);
});

test('R4 Simple header keeps a persistent status legend', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /<TimetableStatusLegend compact \/>/);
});

// --- R5 swap outcomes list decisive blockers and gate commit ---

test('R5 swap dialogs render human conflict details, not counts alone', () => {
	const dialogs = source('src/components/timetable/modals/TimetablePlacementDialogs.tsx');
	assert.match(dialogs, /function ConflictDetails/);
	assert.match(dialogs, /conflictTitle/);
	assert.match(dialogs, /humanTitle|humanDetail/);
	assert.match(dialogs, /Decisive blockers/);
	assert.match(dialogs, /Show \$\{list\.length - initial\} more/);
});

test('R5 draft swap commit is disabled while any hard blocker exists', () => {
	const dialogs = source('src/components/timetable/modals/TimetablePlacementDialogs.tsx');
	assert.match(dialogs, /draftSwapBlocked/);
	assert.match(dialogs, /draftSwapHardViolations\.length > 0/);
	assert.match(dialogs, /disabled=\{draftSwapBlocked\}/);
	assert.match(dialogs, /data-testid="draft-swap-commit"/);
});

test('R5 generated swap blocked state lists blockers and hides commit', () => {
	const dialogs = source('src/components/timetable/modals/TimetablePlacementDialogs.tsx');
	assert.match(dialogs, /generated-swap-blocked-cancel/);
	assert.match(dialogs, /This swap cannot proceed/);
	assert.match(dialogs, /Decisive blockers/);
});

// --- R7 state-aware tutorial ---

test('R7 tutorial content is state-aware and honest about write behavior', () => {
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(helpers, /export function simpleTutorialSteps/);
	assert.match(helpers, /NO_RUN_STEPS/);
	assert.match(helpers, /GENERATED_STEPS/);
	assert.match(helpers, /PUBLISHED_STEPS/);
	// No-run help must not teach placement steps that are impossible.
	assert.match(helpers, /generate a timetable, or open Year Setup/);
	// Generated help must describe the real one-click + Undo contract.
	assert.match(helpers, /one-click action and shows a prominent Undo/);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /lifecycle=\{capabilities\.lifecycle\}/);
});

test('R7 tutorial never references the superseded requirements page', () => {
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.doesNotMatch(helpers, /curriculum-requirements/);
});
