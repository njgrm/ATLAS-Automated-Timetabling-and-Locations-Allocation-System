import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}
function physicalLines(path: string): number {
	return source(path).split(/\r?\n/).length - (source(path).endsWith('\n') ? 1 : 0);
}

const DOCK = 'src/components/timetable/TacticalSandboxDock.tsx';
const PARTS = 'src/components/timetable/TacticalSandboxDock.parts.tsx';
const HELPERS = 'src/components/timetable/TacticalSandboxDock.helpers.ts';
const HOOK = 'src/components/timetable/TacticalSandboxDock.useTeachingLoadModules.ts';
const SHEET = 'src/components/timetable/TeacherDepartureRecoverySheet.tsx';
const BANNER = 'src/components/timetable/simple/SimpleDriftBanner.tsx';
const HEADER = 'src/components/timetable/TimetableSimpleHeader.tsx';

/* ------------------------------------------------------------------ *
 * F3 — no client-side confirmation authority
 * ------------------------------------------------------------------ */

test('F3 the client declares no local confirmation phrase authority', () => {
	for (const path of [DOCK, PARTS, HOOK, HELPERS]) {
		assert.doesNotMatch(source(path), /DEPARTMENT_AUTHORITY_CONFIRMATION_PHRASE/);
	}
	// The server-issued value is the only source of the phrase.
	assert.match(source(HOOK), /data\?\.confirmationText/);
	assert.match(source(PARTS), /preview\?\.confirmationText/);
});

/* ------------------------------------------------------------------ *
 * F2 — capability override uses the safe preview/apply contract only
 * ------------------------------------------------------------------ */

test('F2 the client never calls the retired direct capability-override mutations', () => {
	for (const path of [DOCK, PARTS, HOOK]) {
		const text = source(path);
		assert.doesNotMatch(text, /capability-overrides['"`]\s*,\s*\{[\s\S]{0,80}method:\s*'(put|delete)'/i);
		assert.doesNotMatch(text, /atlasApi\.(put|delete)\(\s*['"`][^'"`]*capability-overrides/i);
	}
});

test('F2 the client uses the canonical capability-override preview and apply', () => {
	const hook = source(HOOK);
	assert.match(hook, /\/faculty-assignments\/capability-overrides\/preview/);
	assert.match(hook, /\/faculty-assignments\/capability-overrides\/apply/);
});

test('F2 capability apply is gated on the server fingerprint and server confirmation', () => {
	const hook = source(HOOK);
	assert.match(hook, /capabilityPreview\?\.fingerprint/);
	assert.match(hook, /capabilityConfirmation !== capabilityPreview\.confirmationText/);
});

test('F2 the capability module renders scope, effect, confirmation, and typed refusals', () => {
	const parts = source(PARTS);
	for (const testid of [
		'timetable-capability-override-module',
		'timetable-capability-scope-unresolved',
		'timetable-capability-effect',
		'timetable-capability-issued-confirmation',
		'timetable-capability-confirmation',
		'timetable-capability-error',
		'timetable-capability-preview',
		'timetable-capability-apply',
	]) {
		assert.match(parts, new RegExp(testid), `${testid} present`);
	}
	// The Teaching Load page stays the canonical home.
	assert.match(parts, /Teaching Load page stays the home/i);
});

/* ------------------------------------------------------------------ *
 * F1 — no ephemeral absence-window authority remains
 * ------------------------------------------------------------------ */

test('F1 no owned client file declares or uses an absence window', () => {
	for (const path of [SHEET, HELPERS]) {
		const text = source(path);
		assert.doesNotMatch(text, /AbsenceWindow|absenceWindow|validateAbsenceWindow|describeAbsenceWindow/);
		assert.doesNotMatch(text, /until further notice/i);
	}
});

test('F1 the sheet uses the truthful departure copy helper', () => {
	assert.match(source(HELPERS), /export function describeDepartureRepairTruth/);
	assert.match(source(SHEET), /describeDepartureRepairTruth/);
	assert.match(source(SHEET), /revisionDateError\(revisionEffectiveDate\)/);
});

/* ------------------------------------------------------------------ *
 * F4 — the published predicate flows into the drift banner
 * ------------------------------------------------------------------ */

test('F4 the header passes the strict published predicate to the drift banner', () => {
	assert.match(source(HEADER), /isRunPublishedStrict/);
	assert.match(source(HEADER), /isPublished=\{isRunPublished\}/);
});

test('F4 the banner gates sync on the published prop', () => {
	const banner = source(BANNER);
	assert.match(banner, /isPublished: boolean/);
	assert.match(banner, /timetable-simple-published-drift-guidance/);
	assert.match(banner, /if \(isPublished\) return;/);
	assert.match(banner, /showSyncConfirm && !isPublished/);
	assert.match(banner, /showImpactPreview && !isPublished/);
});

/* ------------------------------------------------------------------ *
 * F5 — physical line limit
 * ------------------------------------------------------------------ */

test('F5 the dock stays at or below 900 physical lines', () => {
	const lines = physicalLines(DOCK);
	assert.ok(lines <= 900, `TacticalSandboxDock.tsx is ${lines} physical lines (limit 900)`);
});

test('F5 no touched React component file exceeds 1000 physical lines', () => {
	for (const path of [DOCK, PARTS, HELPERS, HOOK, SHEET, BANNER, HEADER]) {
		const lines = physicalLines(path);
		assert.ok(lines <= 1000, `${path} is ${lines} physical lines (limit 1000)`);
	}
});
