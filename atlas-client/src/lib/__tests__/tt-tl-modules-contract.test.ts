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
	const dock = source(DOCK);
	assert.match(dock, /buildRedistributionRequest\(\{ schoolId, schoolYearId \}\)/);
	assert.match(dock, /if \(!request\) \{/);
	const parts = source(PARTS);
	assert.match(parts, /timetable-redistribution-scope-unresolved/);
	assert.match(parts, /No request is sent while the scope is unresolved/);
});

test('R3 redistribution card consumes only the canonical read-only endpoints', () => {
	const dock = source(DOCK);
	assert.match(dock, /\/faculty-assignments\/coverage\/rebalance-over-cap/);
	assert.match(dock, /\/faculty-assignments\/reconciliation\/readiness/);
	assert.doesNotMatch(dock, /\/coverage\/rebalance-over-cap[\s\S]{0,120}confirmApply/);
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
	const dock = source(DOCK);
	assert.match(dock, /\/faculty-assignments\/department-authority\/preview/);
	assert.match(dock, /\/faculty-assignments\/department-authority\/apply/);
	assert.doesNotMatch(dock, /capability-overrides/);
});

test('R4 apply is gated on the server fingerprint and the server confirmation phrase', () => {
	const helpers = source(HELPERS);
	assert.match(helpers, /DEPARTMENT_AUTHORITY_CONFIRMATION_PHRASE = 'APPLY DEPARTMENT AUTHORITY'/);
	assert.match(helpers, /if \(!preview\?\.fingerprint\) return null;/);
	assert.match(helpers, /confirmationText !== DEPARTMENT_AUTHORITY_CONFIRMATION_PHRASE\) return null;/);
	const dock = source(DOCK);
	assert.match(dock, /if \(!payload\) \{[\s\S]{0,200}setQualificationError/);
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
	assert.match(departure, /isPublished[\s\S]{0,120}effective-date revision/);
	// Published mode exposes the revision review instead of the save button.
	assert.match(departure, /teacher-departure-review-revision-button/);
	assert.match(departure, /PublishedRevisionDialog/);
});

test('R2 the published path posts only the revision endpoint', () => {
	const departure = source(DEPARTURE);
	assert.match(departure, /published-revisions/);
	// The absence window governs the revision effective date in published mode.
	assert.match(departure, /absenceWindowRevisionDateError\(absenceWindow, revisionEffectiveDate\)/);
	assert.match(departure, /validateAbsenceWindow\(absenceWindow\)/);
});

test('R2 the absence window is captured, validated, and shown before commit', () => {
	const departure = source(DEPARTURE);
	assert.match(departure, /teacher-departure-window-start/);
	assert.match(departure, /teacher-departure-window-end/);
	assert.match(departure, /teacher-departure-window-indefinite/);
	assert.match(departure, /teacher-departure-window-confirmation/);
	assert.match(departure, /absenceWindowError/);
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
	assert.match(dock, /\[workspaceScope\]/);
	assert.match(dock, /setQualificationPreview\(null\)/);
	assert.match(dock, /setRedistributionSummary\(null\)/);
});
