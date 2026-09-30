import assert from 'node:assert/strict';
import test from 'node:test';

import { pivotDraftToView } from '../schedule-pivot';
import type { DraftReport, ScheduledEntry } from '@/types';

/**
 * ROOM-SCHEDULE-CONFLICT-PARITY-C01 — Print Reports and Class Schedule must
 * agree on the same conflict rule.
 *
 * THE DEFECT THIS EXISTS TO PROVE ABSENT. The live Print Reports page flagged
 * conflicts the generated draft (Class Schedule) did not have. The display grid
 * carries overlapping staggered slots (e.g. 09:15-10:00 and 09:45-10:30), so two
 * back-to-back classes both overlap one cell. The pivot scored `mapped.length > 1`
 * as a conflict, so it flagged classes that never overlap each other. The
 * generator's validator checks the two entries directly and reported none.
 *
 * THE ADVERSARIAL FIXTURE: the SAME room, SAME term, two classes that are
 * back-to-back (09:45-10:30 then 10:30-11:15) and share the display slot
 * 10:00-10:45. A correct rule reports no conflict; the old rule reported one.
 */

const ROOM_ID = 601;
const ENTITY = { id: ROOM_ID, name: 'Room 103' };
const SUBJECTS = new Map([[11, 'AP'], [12, 'Math']]);

function entry(overrides: Partial<ScheduledEntry>): ScheduledEntry {
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
const BACK_TO_BACK: DraftReport = {
	runId: 349,
	status: 'COMPLETED',
	createdAt: '2031-01-01T00:00:00.000Z',
	finishedAt: '2031-01-01T00:01:00.000Z',
	entries: [
		entry({ entryId: 'e1', subjectId: 11, startTime: '09:45', endTime: '10:30' }),
		entry({ entryId: 'e2', subjectId: 12, startTime: '10:30', endTime: '11:15' }),
	],
	summary: {
		timetableDisplaySlots: [
			{ startTime: '09:15', endTime: '10:00' },
			{ startTime: '09:45', endTime: '10:30' },
			{ startTime: '10:00', endTime: '10:45' },
			{ startTime: '10:30', endTime: '11:15' },
		],
	},
} as DraftReport;

/** Two classes that genuinely overlap (09:45-10:30 and 10:00-10:45). */
const REAL_OVERLAP: DraftReport = {
	...BACK_TO_BACK,
	entries: [
		entry({ entryId: 'e1', subjectId: 11, startTime: '09:45', endTime: '10:30' }),
		entry({ entryId: 'e2', subjectId: 12, startTime: '10:00', endTime: '10:45' }),
	],
} as DraftReport;

function conflictCount(report: DraftReport): number {
	const result = pivotDraftToView(report, 'rooms', ROOM_ID, ENTITY, 1, SUBJECTS);
	assert.equal(result.ok, true, 'a fully identified single-term draft must build a view');
	if (!result.ok) return -1;
	return result.view.summary.conflictCount;
}

test('back-to-back classes sharing a staggered slot are NOT a conflict', () => {
	// The load-bearing assertion. On the pre-fix rule this was 1 (or more, once
	// per shared slot); the generator's validator reports 0 for the same shape.
	assert.equal(conflictCount(BACK_TO_BACK), 0, 'two classes that never overlap must not be flagged');
});

test('POSITIVE CONTROL: two classes that genuinely overlap ARE a conflict', () => {
	// Proves the rule still detects a real double-booking, so the row above
	// cannot pass by disabling conflict detection entirely.
	assert.equal(conflictCount(REAL_OVERLAP), 1, 'a real room double-booking must still be flagged');
});

test('the same cohort group sharing a room/slot is NOT a conflict', () => {
	const cohort: DraftReport = {
		...REAL_OVERLAP,
		entries: [
			entry({ entryId: 'e1', subjectId: 11, startTime: '09:45', endTime: '10:30', cohortCode: 'COHORT-A' }),
			entry({ entryId: 'e2', subjectId: 12, startTime: '10:00', endTime: '10:45', cohortCode: 'COHORT-A' }),
		],
	} as DraftReport;
	assert.equal(conflictCount(cohort), 0, 'one cohort group sharing a room is intentional, not a conflict');
});

test('MUTANT: the old `mapped.length > 1` rule flags the back-to-back fixture', () => {
	// A control that proves the suite would catch a regression. It reproduces the
	// pre-fix rule against the same fixture: both entries overlap the 10:00-10:45
	// slot, so `length > 1` is true and the old code reported a conflict.
	const slot = { startTime: '10:00', endTime: '10:45' };
	const inSlot = BACK_TO_BACK.entries.filter((e) => e.startTime < slot.endTime && slot.startTime < e.endTime);
	assert.equal(inSlot.length, 2, 'the fixture must hold two entries in one slot for this control to mean anything');
	assert.equal(inSlot.length > 1, true, 'the pre-fix rule flagged a conflict that does not exist');
	assert.equal(
		inSlot[0].endTime <= inSlot[1].startTime || inSlot[1].endTime <= inSlot[0].startTime,
		true,
		'the two entries are back-to-back and never overlap each other',
	);
});
