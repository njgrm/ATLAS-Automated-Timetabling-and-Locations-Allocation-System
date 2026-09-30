/**
 * ROOM-SCHEDULE-CONFLICT-PARITY-C01 — the server half.
 *
 * THE DEFECT THIS EXISTS TO PROVE ABSENT. Print Reports (`getRoomScheduleView`)
 * flagged conflicts the generated draft (Class Schedule) did not have. The
 * display grid carries overlapping staggered slots (e.g. 09:15-10:00 and
 * 09:45-10:30), so two back-to-back classes both overlap one cell. The old rule
 * scored "both entries overlap the same slot" as a conflict, so it flagged
 * classes that never overlap each other. The generator's validator checks the
 * two entries directly and reported none.
 *
 * This file exercises the REAL `getRoomScheduleView` with a mocked Prisma and a
 * mocked generation service, so the production conflict path runs end to end
 * without a database. It also proves the generator's validator and the room
 * projection now share ONE rule (`roomEntriesConflict`).
 *
 * Run with `--experimental-test-module-mocks` (see `test:room-schedule-conflict-parity-c01`).
 */

import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

const SCHOOL_ID = 1;
const SCHOOL_YEAR_ID = 5;
const ROOM_ID = 601;

const ROOM = { id: ROOM_ID, name: 'Room 103', type: 'CLASSROOM', floor: 1, building: { id: 9, name: 'Main' } };

function entry(overrides: Record<string, unknown>) {
	return {
		entryId: 'e',
		sectionId: 701,
		facultyId: 501,
		roomId: ROOM_ID,
		subjectId: 11,
		durationMinutes: 45,
		day: 'MONDAY',
		startTime: '09:45',
		endTime: '10:30',
		termIndex: 1,
		...overrides,
	};
}

/** Two back-to-back classes in one room/term, sharing the 10:00-10:45 slot. */
const BACK_TO_BACK_ENTRIES = [
	entry({ entryId: 'e1', subjectId: 11, startTime: '09:45', endTime: '10:30' }),
	entry({ entryId: 'e2', subjectId: 12, startTime: '10:30', endTime: '11:15' }),
];

/** Two classes that genuinely overlap (09:45-10:30 and 10:00-10:45). */
const REAL_OVERLAP_ENTRIES = [
	entry({ entryId: 'e1', subjectId: 11, startTime: '09:45', endTime: '10:30' }),
	entry({ entryId: 'e2', subjectId: 12, startTime: '10:00', endTime: '10:45' }),
];

const DISPLAY_SLOTS = [
	{ startTime: '09:15', endTime: '10:00' },
	{ startTime: '09:45', endTime: '10:30' },
	{ startTime: '10:00', endTime: '10:45' },
	{ startTime: '10:30', endTime: '11:15' },
];

let currentEntries: unknown[] = BACK_TO_BACK_ENTRIES;

const FAKE_PRISMA = {
	room: { findFirst: async () => ROOM },
	policySpecialEvent: { findMany: async () => [] },
	classProgramSlot: { findMany: async () => [] },
	schedulingPolicy: { findUnique: async () => null },
	subject: {
		findMany: async () => [
			{ id: 11, code: 'AP', name: 'AP', modularGroupId: null },
			{ id: 12, code: 'MATH', name: 'Math', modularGroupId: null },
		],
	},
};

mock.module(import.meta.resolve('../lib/prisma.js'), {
	namedExports: { prisma: FAKE_PRISMA, createTestPrismaClient: () => FAKE_PRISMA },
});

mock.module(import.meta.resolve('../services/generation.service.js'), {
	namedExports: {
		getLatestRunDraft: async () => ({
			runId: 349,
			status: 'COMPLETED',
			entries: currentEntries,
			unassignedItems: [],
			summary: { timetableDisplaySlots: DISPLAY_SLOTS },
			version: 1,
			finishedAt: '2031-01-01T00:01:00.000Z',
			createdAt: '2031-01-01T00:00:00.000Z',
		}),
		getRunDraft: async () => {
			throw new Error('not used');
		},
	},
});

const { getRoomScheduleView } = await import('../services/room-schedule.service.js');
const { roomEntriesConflict } = await import('../services/effective-scheduled-resources.js');
const { validateHardConstraints } = await import('../services/constraint-validator.js');

async function conflictCount(entries: unknown[]): Promise<number> {
	currentEntries = entries;
	const view = await getRoomScheduleView(SCHOOL_ID, SCHOOL_YEAR_ID, ROOM_ID, { mode: 'LATEST' }, 1);
	return view.summary.conflictCount;
}

test('back-to-back classes sharing a staggered slot are NOT a conflict', async () => {
	// The load-bearing assertion. On the pre-fix rule this was 1; the generator's
	// validator reports 0 for the same shape.
	assert.equal(await conflictCount(BACK_TO_BACK_ENTRIES), 0, 'two classes that never overlap must not be flagged');
});

test('POSITIVE CONTROL: two classes that genuinely overlap ARE a conflict', async () => {
	assert.equal(await conflictCount(REAL_OVERLAP_ENTRIES), 1, 'a real room double-booking must still be flagged');
});

test('the generator validator and the room projection share ONE rule', () => {
	const backToBack = BACK_TO_BACK_ENTRIES as Array<{ startTime: string; endTime: string; termIndex: number }>;
	assert.equal(roomEntriesConflict(backToBack[0], backToBack[1]), false, 'back-to-back must not conflict');
	const realOverlap = REAL_OVERLAP_ENTRIES as Array<{ startTime: string; endTime: string; termIndex: number }>;
	assert.equal(roomEntriesConflict(realOverlap[0], realOverlap[1]), true, 'a real overlap must conflict');
});

test('the generator validator reports no ROOM_TIME_CONFLICT for the back-to-back fixture', () => {
	const result = validateHardConstraints({
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		runId: 349,
		entries: BACK_TO_BACK_ENTRIES as never,
		faculty: [],
		facultySubjects: [],
		rooms: [{ id: ROOM_ID, name: 'Room 103' } as never],
		subjects: [],
	});
	const roomConflicts = result.violations.filter((v) => v.code === 'ROOM_TIME_CONFLICT');
	assert.equal(roomConflicts.length, 0, 'the generator must not flag back-to-back classes');
});

test('the generator validator DOES report a ROOM_TIME_CONFLICT for a real overlap', () => {
	const result = validateHardConstraints({
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		runId: 349,
		entries: REAL_OVERLAP_ENTRIES as never,
		faculty: [],
		facultySubjects: [],
		rooms: [{ id: ROOM_ID, name: 'Room 103' } as never],
		subjects: [],
	});
	const roomConflicts = result.violations.filter((v) => v.code === 'ROOM_TIME_CONFLICT');
	assert.equal(roomConflicts.length, 1, 'the generator must still flag a real double-booking');
});
