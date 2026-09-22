import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

// --- R3 selected-class Swap is armed ---

test('R3 the selected-class Swap arms the same workflow as the task path', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const arming = source('src/components/timetable/timetableSwapArming.ts');
	assert.match(workspace, /createSwapArmHandler/);
	assert.match(workspace, /data-testid="timetable-simple-selected-swap-action"/);
	assert.match(workspace, /armSwapSessions\(\)/);
	assert.match(workspace, /data-testid="timetable-simple-details-swap"/);
	// The arming transition is the real production module, not a state-only no-op.
	assert.match(arming, /mode: 'select-first'/);
	assert.match(arming, /deps\.setTask\('swap-sessions'\)/);
});

// --- R9 A-15 re-publish of an already-published run ---

test('R9/A-15 the server replayed flag yields an informational message, not success', () => {
	const hook = source('src/hooks/useTimetableMutations.ts');
	assert.match(hook, /data\.replayed === true/);
	assert.match(hook, /already published\. No changes were made/);
	assert.match(hook, /toast\.info/);
});

test('R9/A-15 Advanced blocks publish for an already-published run', () => {
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.match(header, /isDraftPublishedStrict\(draft\)/);
	assert.match(header, /disabled=\{[^}]*isRunPublished[^}]*\}/);
	assert.match(header, /already published\. Create an effective-dated revision/);
});

// --- R9 A-16 policy-read failure is fail-closed ---

test('R9/A-16 policy state is null by default and cleared before refetch', () => {
	const hook = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.doesNotMatch(hook, /useState<[^>]*>\(\{ teacherMoveEnabled: true \}\)/);
	assert.match(hook, /const \[policy, setPolicy\] = useState<[^>]*\| null>\(null\)/);
	assert.match(hook, /setPolicy\(null\);\s*\n\s*const fetchPolicyAndWindows/);
});

test('R9/A-16 hidden-row warning survives a failed policy read', () => {
	const hook = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(hook, /The scheduling policy could not be loaded/);
});

// --- R9 A-18 readiness Teaching Load links keep identity ---

test('R9/A-18 the readiness sheet resolves section/subject/faculty identity', () => {
	const sheet = source('src/components/timetable/SimplePublishReadinessSheet.tsx');
	assert.match(sheet, /resolveRepairIdentity/);
	assert.match(sheet, /sectionId/);
	assert.match(sheet, /subjectId/);
	assert.match(sheet, /facultyId/);
});

test('R9/A-18 the Teaching Load repair link carries identity params', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /params\.set\('facultyId'/);
	assert.match(header, /params\.set\('sectionId'/);
	assert.match(header, /params\.set\('subjectId'/);
	assert.match(header, /task', 'missing-load'/);
});

// --- R9 A-09 / A-19 tutorial uses the authenticated role ---

test('R9/A-09 the workspace role comes from the authenticated token, not localStorage', () => {
	const hook = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(hook, /decodeJwtPayload\(getPreferredAccessToken\(\)/);
	assert.doesNotMatch(hook, /localStorage\.getItem\('userRole'\)/);
});

test('R9/A-19 the tutorial receives the authenticated role', () => {
	const overlays = source('src/components/timetable/ScheduleReviewWorkspaceOverlays.tsx');
	const contexts = source('src/components/timetable/buildScheduleReviewWorkspaceContexts.ts');
	assert.match(overlays, /userRole=\{userRole \?\? undefined\}/);
	assert.match(contexts, /userRole\?: string \| null/);
});

// --- R9 A-10 no-active-year state offers Year Setup ---

test('R9/A-10 the error state routes to the real Year Setup surface', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /data-testid="timetable-error-year-setup"/);
	assert.match(workspace, /YEAR_SETUP_HREF/);
});

// --- R9 A-06 clean placement now previews before saving (B1 contract change) ---

test('R9/A-06 drawer copy states the confirmation step before the click', () => {
	// The contract changed in TIMETABLE-RELAXED-MAIN-C01 (B1): a clean slot no
	// longer "saves immediately" — it shows an inline preview with one Confirm.
	// The drawer copy must disclose the confirm-before-save step, not the old
	// immediate-save behaviour.
	const drawer = source('src/components/timetable/TimetableTaskDrawer.tsx');
	assert.match(drawer, /shows the result before saving/);
	assert.match(drawer, /confirm/);
	assert.match(drawer, /Undo/);
	assert.doesNotMatch(drawer, /saves immediately/);
});
