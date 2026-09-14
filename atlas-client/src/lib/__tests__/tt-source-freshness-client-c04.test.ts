/**
 * TT-SOURCE-FRESHNESS-C04 — client corrections (audit F1 and F2).
 *
 * F1: the readiness repair destinations must resolve to a MOUNTED route. The
 * real consumer `deriveSimplePublishReadiness` produces the `actionHref` that
 * `SimplePublishReadinessSheet` forwards to `onNavigateToRepair`; this test
 * derives the href from that real function and asserts it is mounted in
 * `App.tsx`, not merely a string literal.
 *
 * F2: the client publication-blocking set must match the server-owned
 * `PROMOTABLE_CONSTRAINT_CODES` allowlist. The expected set is derived
 * mechanically from the single server authority, then every code is exercised
 * through the REAL client consumers `isBlockingHardViolation` /
 * `isInformationalHardViolation`, so behavioral drift fails.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	deriveSimplePublishReadiness,
	isBlockingHardViolation,
	isInformationalHardViolation,
} from '../../components/timetable/simplePublishReadiness';
import {
	classifySyncSetupError,
	createSyncSetupInFlightGuard,
	runSyncSetup,
} from '@/lib/timetable-sync-setup';
import type { DraftReport, Violation } from '../../types';

const clientRoot = resolve(import.meta.dirname, '../../..');
const repoRoot = resolve(clientRoot, '..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}
function serverSource(path: string): string {
	return readFileSync(resolve(repoRoot, path), 'utf8');
}

function mountedPaths(): Set<string> {
	const app = source('src/App.tsx');
	return new Set(Array.from(app.matchAll(/path:\s*'([^']+)'/g)).map((match) => `/${match[1].replace(/^\//, '')}`));
}

function hardViolation(code: string): Violation {
	return { code, severity: 'HARD', message: code, schoolId: 1, schoolYearId: 1, runId: 1, entities: {} } as unknown as Violation;
}

function blockingHrefs(): string[] {
	const draft = {
		runId: 1,
		status: 'COMPLETED',
		entries: [],
		unassignedItems: [
			{ sectionId: 1, subjectId: 1, gradeLevel: 7, session: 1, reason: 'NO_COMPATIBLE_ROOM', facultyId: 1 },
			{ sectionId: 2, subjectId: 2, gradeLevel: 7, session: 1, reason: 'ROOM_CAPACITY_EXCEEDED', facultyId: 1 },
		],
		summary: {},
		version: 1,
	} as unknown as DraftReport;
	const readiness = deriveSimplePublishReadiness(draft, [], (id) => `S${id}`, (id) => `U${id}`, (id) => `F${id}`);
	return readiness.blockerGroups.map((group) => group.actionHref);
}

test('F1 readiness repair destinations resolve to mounted routes', () => {
	const mounted = mountedPaths();
	const hrefs = blockingHrefs();
	assert.ok(hrefs.length >= 2, 'the real consumer produced blocker groups with repair destinations');
	for (const href of hrefs) {
		assert.ok(mounted.has(href), `every readiness repair href must be a mounted route: ${href}`);
	}
	assert.ok(!hrefs.includes('/campus-rooms'), 'the dead `/campus-rooms` route must not be produced');
});

test('F1 the readiness sheet forwards the resolved href to onNavigateToRepair', () => {
	const sheet = source('src/components/timetable/SimplePublishReadinessSheet.tsx');
	assert.match(sheet, /onNavigateToRepair/, 'the sheet must call onNavigateToRepair');
	assert.match(sheet, /group\.actionHref/, 'the sheet must forward the resolved group.actionHref');
	assert.match(sheet, /onNavigate\(group\.actionHref/, 'the rendered row must pass the resolved href into the navigate handler');
});

/** Extract a `new Set([...])` string-literal allowlist from source text. */
function extractStringSet(text: string, declaration: string): string[] {
	const start = text.indexOf(declaration);
	assert.ok(start >= 0, `declaration not found: ${declaration}`);
	const open = text.indexOf('[', start);
	const close = text.indexOf(']', open);
	const body = text.slice(open + 1, close);
	return Array.from(body.matchAll(/'([^']+)'/g)).map((match) => match[1]);
}

test('F2 the client blocking behavior matches the server promotable allowlist', () => {
	const serverCodes = extractStringSet(serverSource('atlas-server/src/services/scheduling-policy.service.ts'), 'PROMOTABLE_CONSTRAINT_CODES');
	assert.equal(serverCodes.length, 11, `server allowlist must have 11 codes (got ${serverCodes.length})`);

	// Direction 1 (behavioral): every server authority code blocks publication.
	for (const code of serverCodes) {
		assert.equal(isBlockingHardViolation(hardViolation(code)), true, `server allowlisted code must block: ${code}`);
	}

	// Direction 2 (behavioral): the client's own declared set — parsed
	// mechanically from the single client consumer — must equal the server set.
	const clientCodes = extractStringSet(source('src/components/timetable/simplePublishReadiness.ts'), 'PUBLICATION_BLOCKING_CODES');
	assert.deepEqual([...clientCodes].sort(), [...serverCodes].sort(), 'client blocking set must equal the server promotable allowlist');

	// Direction 3 (behavioral): representative non-promotable HARD codes stay
	// informational — never publication blockers.
	for (const code of ['FACULTY_EXCESSIVE_TRAVEL_DISTANCE', 'ROOM_CAPACITY_EXCEEDED', 'FACULTY_DAILY_STANDARD_EXCEEDED', 'SECTION_OVERCOMPRESSED', 'FACULTY_FLOOR_TRANSITION']) {
		assert.equal(isBlockingHardViolation(hardViolation(code)), false, `non-promotable code must not block: ${code}`);
		assert.equal(isInformationalHardViolation(hardViolation(code)), true, `non-promotable code stays informational: ${code}`);
	}
	for (const code of serverCodes) {
		assert.equal(isInformationalHardViolation(hardViolation(code)), false, `allowlisted code is not informational: ${code}`);
	}
});

// --- §3.5 teacher-pin conflict totals surface in sync copy ---

test('C04 the sync success contract carries both exact reviewed-pin totals', async () => {
	const guard = createSyncSetupInFlightGuard();
	const outcome = await runSyncSetup({
		schoolId: 2,
		schoolYearId: 9,
		runId: 42,
		draftVersion: 7,
		guard,
		post: async () => ({
			data: { runId: 42, version: 8, replayed: false, retainedFacultyPinCount: 3, conflictedFacultyPinCount: 0 },
		}),
	});
	assert.equal(outcome.status, 'COMMITTED');
	if (outcome.status === 'COMMITTED') {
		assert.equal(outcome.data.retainedFacultyPinCount, 3, 'the retained total is carried through the outcome');
		assert.equal(outcome.data.conflictedFacultyPinCount, 0, 'the conflicted total is carried through the outcome');
	}
});

test('C04 TEACHER_PIN_CONFLICT is a non-retryable review-required failure with the server message intact', () => {
	const serverMessage =
		'2 reviewed teacher assignment(s) are no longer valid under current ownership, qualification, section, and term authority; 1 valid reviewed assignment(s) will be retained. ATLAS will not silently rebind them; review them before syncing.';
	const classification = classifySyncSetupError({ response: { data: { code: 'TEACHER_PIN_CONFLICT', message: serverMessage } } });
	assert.equal(classification.code, 'TEACHER_PIN_CONFLICT');
	assert.equal(classification.kind, 'BLOCKED', 'a teacher-pin conflict is classified, not UNKNOWN');
	assert.equal(classification.retryable, false, 'a teacher-pin conflict must never auto-retry');
	assert.equal(classification.message, serverMessage, 'the server conflict message is preserved verbatim');
});

test('C04 the sync confirm dialog states preservation, the review stop, and exact totals', () => {
	const dialogs = source('src/components/timetable/ScheduleReviewWorkspaceDialogs.tsx');
	for (const fragment of [
		'Valid manually reviewed teacher assignments and slot swaps are preserved.',
		'the sync stops with a conflict list for operator review.',
		'The result reports the exact retained and conflicted totals.',
	]) {
		assert.ok(dialogs.includes(fragment), `the dialog must state: ${fragment}`);
	}
});

test('C04 both sync success toasts state the exact retained reviewed-assignment count', () => {
	const advanced = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	const simple = source('src/components/timetable/simple/SimpleDriftBanner.tsx');
	const retainedCopy = 'retained ${retainedReviewedCount} reviewed teacher assignment(s)';
	assert.ok(advanced.includes('retainedFacultyPinCount'), 'Advanced consumes the retained total from the sync result');
	assert.ok(advanced.includes(retainedCopy), 'Advanced success toast states the exact retained reviewed-assignment count');
	assert.ok(simple.includes('retainedFacultyPinCount'), 'Simple consumes the retained total from the sync result');
	assert.ok(simple.includes(retainedCopy), 'Simple success toast states the exact retained reviewed-assignment count');
});
