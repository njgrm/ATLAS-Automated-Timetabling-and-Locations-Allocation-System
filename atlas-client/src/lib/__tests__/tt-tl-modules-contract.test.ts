import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

const DOCK = 'src/components/timetable/TacticalSandboxDock.tsx';
const PARTS = 'src/components/timetable/TacticalSandboxDock.parts.tsx';
const HELPERS = 'src/components/timetable/TacticalSandboxDock.helpers.ts';
// C04R1 (F5) extracted the focused mini-module state/handlers into this hook, so
// the canonical request/endpoint contract now lives here rather than in DOCK.
const HOOK = 'src/components/timetable/TacticalSandboxDock.useTeachingLoadModules.ts';
const DEPARTURE = 'src/components/timetable/TeacherDepartureRecoverySheet.tsx';
const HEADER = 'src/components/timetable/TimetableSimpleHeader.tsx';

/* ------------------------------------------------------------------ *
 * R3 — the redistribution summary is read-only by construction
 * ------------------------------------------------------------------ */

test('R3 redistribution card can only send previewOnly:true (no apply variant)', () => {
	const helpers = source(HELPERS);
	assert.match(helpers, /previewOnly:\s*true/);
	assert.doesNotMatch(helpers, /previewOnly:\s*false/);
	assert.doesNotMatch(helpers, /confirmApply/);
	// The single builder is the only way the card constructs its request.
	const builder = helpers.slice(
		helpers.indexOf('export function buildRedistributionRequest'),
		helpers.indexOf('export function summarizeRedistribution'),
	);
	assert.match(builder, /previewOnly:\s*true/);
	assert.doesNotMatch(builder, /previewOnly:\s*false|confirmApply/);
});

test('R3 redistribution card dispatches zero requests while school or year is unresolved', () => {
	const hook = source(HOOK);
	assert.match(hook, /buildRedistributionRequest\(\{ schoolId, schoolYearId \}\)/);
	assert.match(hook, /if \(!request\) \{/);
	const parts = source(PARTS);
	assert.match(parts, /timetable-redistribution-scope-unresolved/);
	assert.match(parts, /No request is sent while the scope is unresolved/);
});

test('R3 redistribution card consumes only the canonical read-only endpoints', () => {
	const hook = source(HOOK);
	assert.match(hook, /\/faculty-assignments\/coverage\/rebalance-over-cap/);
	assert.match(hook, /\/faculty-assignments\/reconciliation\/readiness/);
	assert.doesNotMatch(hook, /\/coverage\/rebalance-over-cap[\s\S]{0,120}confirmApply/);
});

test('R3 redistribution routes the operator to /teaching-load as the canonical home', () => {
	const helpers = source(HELPERS);
	assert.match(helpers, /REDISTRIBUTION_HOME_HREF = '\/teaching-load'/);
	const parts = source(PARTS);
	assert.match(parts, /timetable-redistribution-open-home/);
	assert.match(parts, /Open Teaching Load/);
});

/* ------------------------------------------------------------------ *
 * R4 — qualification module never becomes a second editor
 * ------------------------------------------------------------------ */

test('R4 qualification module calls only the canonical department-authority preview/apply', () => {
	const hook = source(HOOK);
	assert.match(hook, /\/faculty-assignments\/department-authority\/preview/);
	assert.match(hook, /\/faculty-assignments\/department-authority\/apply/);
	// The dock itself never calls the retired capability-override mutation, and
	// the hook never issues a direct PUT/DELETE mutation.
	assert.doesNotMatch(source(DOCK), /capability-overrides/);
	assert.doesNotMatch(hook, /atlasApi\.(put|delete)\(/);
});

test('R4 apply is gated on the server-issued fingerprint and confirmation', () => {
	const helpers = source(HELPERS);
	// F3: the confirmation phrase is server-issued; the client holds no local
	// phrase authority. Require the exact server value to enable apply.
	assert.doesNotMatch(helpers, /DEPARTMENT_AUTHORITY_CONFIRMATION_PHRASE/);
	assert.match(helpers, /if \(!preview\?\.fingerprint\) return null;/);
	assert.match(helpers, /if \(!preview\.confirmationText\) return null;/);
	assert.match(helpers, /confirmationText !== preview\.confirmationText\) return null;/);
	const hook = source(HOOK);
	assert.match(hook, /data\?\.confirmationText/);
	assert.match(hook, /if \(!payload\) \{[\s\S]{0,200}setQualificationError/);
});

/* ------------------------------------------------------------------ *
 * R6 / platform — no retired mutation path from any owned client file
 * ------------------------------------------------------------------ */

test('R6 owned client files never call the retired mutation paths', () => {
	for (const path of [DOCK, PARTS, HELPERS, DEPARTURE, HEADER]) {
		const text = source(path);
		assert.doesNotMatch(text, /reconciliation\/apply/);
		assert.doesNotMatch(text, /annual-teaching-load\/apply/);
		assert.doesNotMatch(text, /capability-overrides/);
	}
});

test('R6 owned client files never decide publication from loose markers', () => {
	for (const path of [DOCK, DEPARTURE, HEADER]) {
		const text = source(path);
		// Only the decision sites matter; the explanatory comments that name the
		// legacy markers are not a publication decision.
		assert.doesNotMatch(text, /publishedAt\s*[:=]|publishedBy\s*[:=]|\?*\.publishedAt|\?*\.publishedBy/);
	}
	const header = source(HEADER);
	assert.match(header, /isRunPublishedStrict\(/);
});

/* ------------------------------------------------------------------ *
 * R2 — published mode routes to revisions; direct save is not reachable
 * ------------------------------------------------------------------ */

test('R2 published mode never reaches the direct Teaching Load save', () => {
	const departure = source(DEPARTURE);
	// The canonical commit is only reachable when the run is unpublished.
	assert.match(departure, /const handleSave = async \(\) => \{[\s\S]*?commitTeachingLoadRepair\(/);
	assert.match(departure, /if \(saveDisabledReason\) \{[\s\S]{0,120}return;/);
	// SUPERSEDED by LANE-C POST-PUBLISH-C01 (audit B5 jargon): assert.match(departure, /isPublished[\s\S]{0,120}effective-date revision/);
	// Replacement — published mode's save reason is the plain published note:
	assert.match(departure, /const saveDisabledReason = isPublished\s*\?\s*PUBLISHED_CHANGE_NOTE/);
	// Published mode exposes the revision review instead of the save button.
	assert.match(departure, /teacher-departure-review-revision-button/);
	assert.match(departure, /PublishedRevisionDialog/);
});

test('R2 the published path posts only the revision endpoint', () => {
	const departure = source(DEPARTURE);
	assert.match(departure, /published-revisions/);
	// F1: the revision effective date is the sole temporal authority and there is
	// no absence window to validate against.
	assert.match(departure, /revisionDateError\(revisionEffectiveDate\)/);
	assert.doesNotMatch(departure, /absenceWindow|validateAbsenceWindow|absenceWindowRevisionDateError/);
});

test('R2 the departure sheet states the truthful temporal contract before commit', () => {
	const departure = source(DEPARTURE);
	// F1: truthful copy is the only temporal statement; no absence-window capture.
	assert.match(departure, /describeDepartureRepairTruth/);
	assert.match(departure, /teacher-departure-truth/);
	assert.match(departure, /teacher-departure-window-confirmation/);
	assert.doesNotMatch(departure, /teacher-departure-window-start/);
	assert.doesNotMatch(departure, /teacher-departure-window-end/);
	assert.doesNotMatch(departure, /teacher-departure-window-indefinite/);
	assert.doesNotMatch(departure, /absenceWindowError/);
});

/* ------------------------------------------------------------------ *
 * R3/R4/R7 — new surfaces and their truthful deferred state
 * ------------------------------------------------------------------ */

test('R3/R4/R7 new surfaces expose their testids', () => {
	const parts = source(PARTS);
	for (const testid of [
		'timetable-redistribution-summary',
		'timetable-redistribution-preview',
		'timetable-qualification-module',
		'timetable-qualification-preview',
		'timetable-qualification-apply',
		'timetable-qualification-confirmation',
		'timetable-availability-deferred',
	]) {
		assert.match(parts, new RegExp(testid), `${testid} present`);
	}
});

test('R7 availability is an explicit deferred state, never a fake authority', () => {
	const helpers = source(HELPERS);
	assert.match(helpers, /AVAILABILITY_MODULE_DEFERRED_COPY/);
	assert.match(helpers, /no persisted faculty availability authority/i);
	const parts = source(PARTS);
	assert.match(parts, /AvailabilityDeferredNotice/);
});

test('R8 the dock clears scope-bound module state on scope change', () => {
	const dock = source(DOCK);
	assert.match(dock, /workspaceScopeKey\(\{ schoolId, schoolYearId, runId \}\)/);
	assert.match(dock, /\[stagedProposalKey, workspaceScope\]/);
	// F5: the mini-module state is scope-bound inside the extracted hook.
	const hook = source(HOOK);
	assert.match(hook, /\[scopeKey\]/);
	assert.match(hook, /setQualificationPreview\(null\)/);
	assert.match(hook, /setRedistributionSummary\(null\)/);
});
