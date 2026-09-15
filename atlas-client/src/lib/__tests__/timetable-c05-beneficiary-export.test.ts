/**
 * BENEFICIARY-EXPORT-PARITY-C05 — client official-download identity and room
 * program control (M11/M17/M18).
 *
 * Production-path proof against the real `resolveSimpleExportRequest`,
 * `resolveRoomProgramExportRequest`, `dispatchSimpleExport`, and `SimpleExportMenu`
 * code paths. The client filename tokens must be byte-identical to the server
 * `exportFileStem` identity (`<type>[-<entity>]-SY<year>-term<N>.<ext>`).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
	SimpleExportMenu,
} from '../../components/timetable/simple/SimpleBeneficiaryControls';
import {
	dispatchSimpleExport,
	resolveSimpleExportRequest,
	type SimpleExportDescriptor,
	type SimpleExportKind,
} from '../../components/timetable/simple/simpleExportRequests';
import { resolveRoomProgramExportRequest } from '../../components/room-schedules/schedule-export';

const clientRoot = resolve(import.meta.dirname, '../../..');

function source(relativePath: string): string {
	return readFileSync(resolve(clientRoot, relativePath), 'utf8');
}

// ─── M18 — client filename identity mirrors the server `exportFileStem` ───

test('M18: every official client filename matches the server <type>[-<entity>]-SY<year>-term<N> identity', () => {
	const target = { schoolId: 7, schoolYearId: 9, runId: 42, termFilter: 2 as const, facultyId: 501, yearLabel: '2026-2027' };
	const expected: Record<SimpleExportKind, string> = {
		'summary-teacher-schedule': 'summary-teacher-schedule-SY2026-2027-term2.xlsx',
		'class-program': 'class-program-SY2026-2027-term2.xlsx',
		'teacher-program': 'teacher-program-501-SY2026-2027-term2.docx',
	};
	for (const kind of Object.keys(expected) as SimpleExportKind[]) {
		const descriptor = resolveSimpleExportRequest(kind, target);
		assert.ok(descriptor, `${kind} resolves with a selected term`);
		assert.equal(descriptor.filename, expected[kind], `${kind} client filename must equal the server identity`);
		assert.ok(!/-run-\d+/.test(descriptor.filename), `${kind} must not carry the retired run-id filename shape`);
	}

	// No persisted school-year label degrades to the same stable token the server
	// uses instead of fabricating a year.
	const unlabeled = resolveSimpleExportRequest('class-program', { ...target, yearLabel: null });
	assert.equal(unlabeled?.filename, 'class-program-SY-UNLABELED-term2.xlsx');
});

// ─── M11 — room program official download request ───

test('M11: the room program request is scoped, identity-bound, and dispatches zero requests while unresolved', async () => {
	const resolved = resolveRoomProgramExportRequest({
		schoolId: 7, schoolYearId: 9, runId: 42, termFilter: 2, roomId: 601, yearLabel: '2026-2027',
	});
	assert.deepEqual(resolved, {
		url: '/api/v1/generation/7/9/runs/42/export/room-program.xlsx?termIndex=2&roomId=601',
		filename: 'room-program-601-SY2026-2027-term2.xlsx',
		termIndex: 2,
	});

	// Omitting the room scopes every room with entries.
	const allRooms = resolveRoomProgramExportRequest({ schoolId: 7, schoolYearId: 9, runId: 42, termFilter: 3, yearLabel: '2026-2027' });
	assert.equal(allRooms?.filename, 'room-program-ALL-SY2026-2027-term3.xlsx');
	assert.ok(allRooms?.url.endsWith('?termIndex=3'), 'an unscoped request carries no roomId parameter');

	// Unresolved scope (no run, no term, bad school) => zero dispatch.
	const unresolved = [
		{ schoolId: 7, schoolYearId: 9, runId: null, termFilter: 2 as const },
		{ schoolId: 7, schoolYearId: 9, runId: 42, termFilter: 'all' as const },
		{ schoolId: 7, schoolYearId: null, runId: 42, termFilter: 2 as const },
		{ schoolId: null, schoolYearId: 9, runId: 42, termFilter: 2 as const },
		{ schoolId: 7, schoolYearId: 9, runId: 42, termFilter: 0 as unknown as number },
	];
	for (const target of unresolved) {
		assert.equal(resolveRoomProgramExportRequest(target), null, `unresolved scope ${JSON.stringify(target)} must not resolve a request`);
	}

	let calls = 0;
	const outcome = await dispatchSimpleExport(null, {
		fetchImpl: (async () => { calls += 1; return new Response(''); }) as unknown as typeof fetch,
		getAccessToken: () => 'token',
	});
	assert.equal(outcome, 'skipped');
	assert.equal(calls, 0, 'an unresolved room program must dispatch zero requests');
});

// ─── M17 — the single-flight guard blocks a second concurrent dispatch ───

test('M17: while one official export is in flight every export control is disabled and the handler refuses re-entry', () => {
	const descriptor: SimpleExportDescriptor = { kind: 'class-program', url: '/u2', filename: 'class-program-SY2026-2027-term2.xlsx', termIndex: 2 };
	const busy = renderToStaticMarkup(createElement(SimpleExportMenu, {
		summary: descriptor,
		classProgram: descriptor,
		teacherProgram: { ...descriptor, kind: 'teacher-program', url: '/u3' },
		showTeacherProgram: true,
		needsTerm: false,
		exportingKind: 'class-program',
		onExport: () => {},
	}));
	const trigger = busy.match(/<[^>]*data-testid="timetable-simple-export-trigger"[^>]*>/)?.[0] ?? '';
	assert.match(trigger, /data-export-busy="true"/, 'a pending download marks the trigger busy');

	// The busy flag is the production disable gate for every menu item.
	const controls = source('src/components/timetable/simple/SimpleBeneficiaryControls.tsx');
	const disabledGates = controls.match(/disabled=\{[^}]*exporting[^}]*\}/g) ?? [];
	assert.ok(disabledGates.length >= 3, 'every official export item is disabled by the in-flight flag');

	// The header handler is the single-flight gate that refuses a second dispatch.
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /if \(exportingKind !== null\) return;/, 'the handler refuses re-entry while a download is in flight');
});

// ─── M11 wiring — RoomSchedules binds the official server-generated control ───

test('M11: the RoomSchedules page binds the official room-program control to a resolved run and term', () => {
	const page = source('src/pages/RoomSchedules.tsx');
	assert.match(page, /resolveRoomProgramExportRequest/, 'the page uses the official request resolver');
	assert.match(page, /roomProgramRequest/, 'the resolved request drives the control');
	assert.match(page, /termFilter:\s*exportTerm/, 'the request is bound to the selected term');
	// The legacy client CSV remains a view export only and is not the official output.
	const scheduleExport = source('src/components/room-schedules/schedule-export.ts');
	assert.match(scheduleExport, /resolveRoomProgramExportRequest/, 'the official request lives beside the view CSV export');
});
