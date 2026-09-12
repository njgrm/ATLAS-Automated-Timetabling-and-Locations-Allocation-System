/**
 * TT-OUTPUT-C03R2 — Selected-term export request and grid authority controls.
 *
 * These exercise the same production functions the Simple header and the
 * timetable grid use:
 *  - `resolveSimpleExportRequest` / `dispatchSimpleExport` are the only path the
 *    official downloads take, so "All terms" can never send a mixed-term export.
 *  - `matchesTermScope` is the predicate `useTimetableData` applies to grid
 *    entries, so one selected term yields one non-overlapping rotation set.
 *
 * Against the pre-correction behavior the summary request had no `termIndex`,
 * there was no class-program request, and an "All terms" selection still exported
 * a summary workbook, so these controls fail on the base commit.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	dispatchSimpleExport,
	resolveSimpleExportRequest,
	type SimpleExportDispatchDeps,
	type SimpleExportKind,
	type SimpleExportTarget,
} from '../../components/timetable/simple/simpleExportRequests';
import { filterEntriesByTermScope, matchesTermScope } from '../timetable-term-scope';
import type { ScheduledEntry } from '@/types';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function target(overrides: Partial<SimpleExportTarget> = {}): SimpleExportTarget {
	return {
		schoolId: 7,
		schoolYearId: 9,
		runId: 42,
		termFilter: 2,
		facultyId: 502,
		...overrides,
	};
}

function capturingDeps() {
	const calls: string[] = [];
	const deps: SimpleExportDispatchDeps = {
		fetchImpl: (async (url: string | URL | Request) => {
			calls.push(String(url));
			return { ok: true, blob: async () => ({ size: 1 }) } as unknown as Response;
		}) as unknown as typeof fetch,
		getAccessToken: () => 'test-token',
		createObjectUrl: () => 'blob:test',
		revokeObjectUrl: () => {},
		triggerDownload: () => {},
	};
	return { calls, deps };
}

const ALL_EXPORT_KINDS: SimpleExportKind[] = ['summary-teacher-schedule', 'class-program', 'teacher-program'];

test('every official beneficiary export sends one numeric selected termIndex', async () => {
	for (const term of [1, 2, 3]) {
		for (const kind of ALL_EXPORT_KINDS) {
			const descriptor = resolveSimpleExportRequest(kind, target({ termFilter: term }));
			assert.ok(descriptor, `${kind} resolves for term ${term}`);
			assert.equal(descriptor.termIndex, term);
			assert.ok(descriptor.url.includes(`termIndex=${term}`), `${kind} URL carries termIndex=${term}: ${descriptor.url}`);
			assert.ok(descriptor.filename.includes(`-term${term}`), `${kind} filename carries the term: ${descriptor.filename}`);
			if (kind === 'teacher-program') {
				assert.ok(descriptor.url.includes('facultyId=502'), 'teacher program keeps the faculty scope');
			}

			const { calls, deps } = capturingDeps();
			const result = await dispatchSimpleExport(descriptor, deps);
			assert.equal(result, 'downloaded');
			assert.deepEqual(calls, [descriptor.url], `${kind} dispatches exactly its resolved term URL`);
		}
	}
});

test('"All terms" dispatches zero official export requests for every kind', async () => {
	for (const kind of ALL_EXPORT_KINDS) {
		const descriptor = resolveSimpleExportRequest(kind, target({ termFilter: 'all' }));
		assert.equal(descriptor, null, `${kind} must not resolve an all-term request`);
		const { calls, deps } = capturingDeps();
		const result = await dispatchSimpleExport(descriptor, deps);
		assert.equal(result, 'skipped');
		assert.equal(calls.length, 0, `${kind} must send no request while "All terms" is selected`);
	}
});

test('official exports fail closed for out-of-contract terms and missing faculty', () => {
	for (const kind of ALL_EXPORT_KINDS) {
		assert.equal(resolveSimpleExportRequest(kind, target({ termFilter: 0 })), null);
		assert.equal(resolveSimpleExportRequest(kind, target({ termFilter: 5 })), null);
		assert.equal(resolveSimpleExportRequest(kind, target({ termFilter: Number.NaN as unknown as number })), null);
	}
	assert.equal(resolveSimpleExportRequest('teacher-program', target({ facultyId: null })), null);
});

function entry(overrides: Partial<ScheduledEntry> & { entryId: string; termIndex?: number }): ScheduledEntry {
	return {
		sectionId: 701,
		facultyId: 501,
		roomId: 601,
		subjectId: 11,
		day: 'MONDAY',
		startTime: '06:00',
		endTime: '06:45',
		durationMinutes: 45,
		...overrides,
	} as ScheduledEntry;
}

const ROTATION: ScheduledEntry[] = [
	entry({ entryId: 't1', termIndex: 1, subjectId: 11, facultyId: 501, roomId: 601 }),
	entry({ entryId: 't2', termIndex: 2, subjectId: 12, facultyId: 502, roomId: 602 }),
	entry({ entryId: 't3', termIndex: 3, subjectId: 13, facultyId: 503, roomId: 603 }),
	entry({ entryId: 'unscoped', subjectId: 14, facultyId: 504, roomId: 604 }),
];

test('one selected term yields exactly its own rotating subject, teacher, and room set', () => {
	const expected = {
		1: { subjectId: 11, facultyId: 501, roomId: 601 },
		2: { subjectId: 12, facultyId: 502, roomId: 602 },
		3: { subjectId: 13, facultyId: 503, roomId: 603 },
	} as const;

	for (const term of [1, 2, 3] as const) {
		const scoped = filterEntriesByTermScope(ROTATION, term);
		assert.deepEqual(
			scoped.map((e) => ({ subjectId: e.subjectId, facultyId: e.facultyId, roomId: e.roomId })),
			[expected[term]],
			`term ${term} resolves exactly one rotation set`,
		);
		for (const other of [1, 2, 3].filter((value) => value !== term)) {
			assert.ok(!scoped.some((e) => e.termIndex === other), `term ${term} never mixes term ${other}`);
		}
	}
});

test('all-term review keeps every term and never treats an unscoped entry as a term', () => {
	const all = filterEntriesByTermScope(ROTATION, 'all');
	assert.equal(all.length, 4);
	assert.deepEqual(all.map((e) => e.entryId), ['t1', 't2', 't3', 'unscoped']);
	assert.equal(matchesTermScope({ termIndex: undefined }, 'all'), true);
	assert.equal(matchesTermScope({ termIndex: undefined }, 2), false, 'an entry without a termIndex is never shown inside a single-term view');
});

test('the production grid and Simple header consume these exact term/export controls', () => {
	const hook = source('src/hooks/useTimetableData.ts');
	assert.match(hook, /import \{ matchesTermScope \} from '@\/lib\/timetable-term-scope'/);
	assert.match(hook, /matchesTermScope\(entry, termFilter\)/);

	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /resolveSimpleExportRequest\('summary-teacher-schedule'/);
	assert.match(header, /resolveSimpleExportRequest\('class-program'/);
	assert.match(header, /resolveSimpleExportRequest\('teacher-program'/);
	assert.match(header, /await dispatchSimpleExport\(descriptor\)/);
	assert.match(header, /<SimpleTermSwitcher context=\{context\} \/>/);
	assert.doesNotMatch(header, /export\/summary-teacher-schedule\.xlsx`/);
});
