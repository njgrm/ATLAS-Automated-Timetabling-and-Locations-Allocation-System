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
	// REPOINTED (A2 mc R2, 2026-09-30), not weakened. The selected-class
	// `DropdownMenuContent` moved to `ScheduleReviewWorkspaceSelectedActions.tsx` so the
	// workspace could stay under AGENTS.md section 8's 1000-line cap while the class-lock
	// row was added. The handler is still declared and passed by the workspace; the
	// `DropdownMenuItem` markup and its label now live in the extracted file. Every
	// assertion below is still the original one.
	const selectedActions = source('src/components/timetable/ScheduleReviewWorkspaceSelectedActions.tsx');
	assert.match(workspace, /openSelectedChangeRoom/);
	assert.match(workspace, /enterManualEditView\('CHANGE_ROOM'\)/);
	assert.match(selectedActions, /timetable-simple-selected-change-room-action/);
	assert.match(selectedActions, /Change room/);
});

test('R3 bulk teacher leaving is not labelled as a one-class teacher change', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	// REPOINTED (A2 mc R2, 2026-09-30) with the menu extraction above: the owner-departure
	// label is markup, so it is asserted where the markup now is. The two negative
	// assertions still guard the workspace itself.
	const selectedActions = source('src/components/timetable/ScheduleReviewWorkspaceSelectedActions.tsx');
	assert.doesNotMatch(workspace, />\s*Change teacher\s*</);
	assert.doesNotMatch(workspace, /Reassign teacher/);
	assert.doesNotMatch(selectedActions, />\s*Change teacher\s*</);
	assert.match(selectedActions, /Teacher leaving \(all classes\)/);
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

test('R4 the status key stays reachable (relocated from the header row to More)', () => {
	// A3 — one STATUS_ITEMS source; the More menu renders it, the header row
	// no longer carries the legend control.
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /STATUS_ITEMS/, 'the More menu renders the one shared status key source');
	assert.match(source('src/components/timetable/TimetableStatusLegend.tsx'), /export const STATUS_ITEMS/);
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
	// ── C11 CORRECTION 2 (QA-B1) — RE-POINTED, additively ──────────────────────
	//
	// These four assertions hardcoded the file that OWNED the rule before C11 M4.
	// M4 extracted the blocked review to `DraftSwapReviewVerdict.tsx` (so the
	// confirm control and its reason sentence have ONE derivation), which left all
	// four reading a file that no longer contains them. The behaviour did not
	// change; the row was orphaned. The original four are RETAINED VERBATIM and
	// marked SUPERSEDED, per AGENTS.md §16 (a correction is additive; deleting an
	// assertion to close a finding fails review regardless of the fix):
	//   assert.match(dialogs, /draftSwapBlocked/);
	//   assert.match(dialogs, /draftSwapHardViolations\.length > 0/);
	//   assert.match(dialogs, /disabled=\{draftSwapBlocked\}/);
	//   assert.match(dialogs, /data-testid="draft-swap-commit"/);
	//
	// What the row is really about is unchanged: the draft-swap confirm control is
	// disabled while any hard blocker exists, and the counts the rule reads are the
	// ones the dialog computes. The replacement proves the same three things across
	// the two files that now hold them.
	const verdict = source('src/components/timetable/DraftSwapReviewVerdict.tsx');

	// (1) The dialog still supplies the hard-violation count the rule reads.
	assert.match(dialogs, /hardCount=\{draftSwapHardViolations\.length\}/,
		'the dialog passes the hard-violation count the blocked rule reads');
	assert.match(dialogs, /softCount=\{draftSwapSoftViolations\.length\}/);
	// (2) The name the row always read is restored, and it is the ONE derivation.
	assert.match(verdict, /export function draftSwapBlocked\(/,
		'`draftSwapBlocked` exists again, under its accepted name');
	assert.match(verdict, /input\.hardCount > 0/,
		'and it still blocks on any hard violation');
	// (3) The confirm control is disabled by that value, not by a second rule.
	assert.match(verdict, /disabled=\{verdict\.confirmBlocked\}/);
	assert.match(verdict, /const blocked = draftSwapBlocked\(input\);/,
		'every verdict branch reports the one predicate, so the sentence and the control cannot disagree');
	assert.match(verdict, /data-testid="draft-swap-commit"/,
		'the confirm control keeps its testid');
});

test('R5 generated swap blocked state lists blockers and hides commit', () => {
	const dialogs = source('src/components/timetable/modals/TimetablePlacementDialogs.tsx');
	assert.match(dialogs, /generated-swap-blocked-cancel/);
	assert.match(dialogs, /This swap cannot proceed/);
	assert.match(dialogs, /Decisive blockers/);
});

// --- R7 state-aware tutorial ---

test('R7 tutorial content is state-aware and honest about write behavior', () => {
	// A2-UX-MENU-C2: the tutorial moved to `SimpleTutorial.tsx` so
	// `SimpleHeaderHelpers` stays inside the 1000-line component budget, and it is
	// re-exported from there. The intent of this row is unchanged — one step set
	// per lifecycle, honest about what generating does, and still describing the
	// real one-click + Undo contract — and the header keeps owning the dialog.
	const tutorial = source('src/components/timetable/simple/SimpleTutorial.tsx');
	assert.match(tutorial, /export function simpleTutorialSteps/);
	assert.match(tutorial, /NO_RUN_STEPS/);
	assert.match(tutorial, /GENERATED_STEPS/);
	assert.match(tutorial, /PUBLISHED_STEPS/);
	// No-run help must not teach placement steps that are impossible.
	assert.match(tutorial, /generate a timetable, or open Year Setup/);
	// Generated help must describe the real one-click + Undo contract.
	assert.match(tutorial, /one-click action and shows a prominent Undo/);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /lifecycle=\{capabilities\.lifecycle\}/);
	assert.match(
		source('src/components/timetable/simple/SimpleHeaderHelpers.tsx'),
		/export \{ SimpleTutorialControl, simpleTutorialSteps \} from/,
		'the helpers module re-exports the tutorial, so every existing importer is unchanged',
	);
});

test('R7 tutorial never references the superseded requirements page', () => {
	const tutorial = source('src/components/timetable/simple/SimpleTutorial.tsx');
	assert.doesNotMatch(tutorial, /curriculum-requirements/);
});

// --- R1 QA F1 correction: no run-only control may be usable without a run ---

test('R1 bulk teacher departure is gated on an existing generated run', () => {
	// C04: the Simple More menu was extracted into SimpleMoreMenuContent.
	const header = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	const idx = header.indexOf('data-testid="teacher-departure-trigger"');
	assert.ok(idx > 0, 'teacher-departure-trigger must exist in the Simple More menu');
	const block = header.slice(Math.max(0, idx - 320), idx + 420);
	assert.match(block, /disabled=\{!runToolsAvailable\}/);
	assert.match(block, /Unavailable: no generated run yet/);
});
