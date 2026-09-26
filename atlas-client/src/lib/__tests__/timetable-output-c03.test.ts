import assert from 'node:assert/strict';
import test from 'node:test';

import { pivotDraftToView } from '../schedule-pivot';
import type { DraftReport } from '@/types';

const report = {
	runId: 42,
	status: 'COMPLETED',
	createdAt: '2031-01-01T00:00:00.000Z',
	finishedAt: '2031-01-01T00:01:00.000Z',
	entries: [
		{ entryId: 'section-teacher-room-1', sectionId: 701, facultyId: 501, roomId: 601, subjectId: 11, day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1 },
		{ entryId: 'section-teacher-room-2', sectionId: 702, facultyId: 502, roomId: 602, subjectId: 12, day: 'TUESDAY', startTime: '13:00', endTime: '13:45', durationMinutes: 45, termIndex: 2 },
	],
	summary: {
		timetableDisplaySlots: [
			{ startTime: '13:00', endTime: '13:45' },
			{ startTime: '06:00', endTime: '06:45' },
			{ startTime: '06:00', endTime: '06:30', isSpecialEvent: true, eventName: 'FLAG CEREMONY', dayOfWeek: 'MONDAY' },
		],
	},
} as DraftReport;

// ROOM-SCHEDULES-TERM-C01 — the pivot now takes ONE required selected term and
// returns a result that can refuse. These rows assert entry identity binding and
// slot order, which are unchanged by term scoping, so the assertions below are
// kept verbatim and only the call shape is updated: each call passes the term its
// own fixture entry carries (entry-1 is term 1, entry-2 is term 2).
function ok(result: ReturnType<typeof pivotDraftToView>) {
	assert.equal(result.ok, true, 'the pivot must build a view for a fully identified single-term fixture');
	if (!result.ok) throw new Error('unreachable: refused above');
	return result.view;
}

test('production pivot keeps section, teacher, and room projections bound to distinct entry identities', () => {
	const subjectMap = new Map([[11, 'Mathematics'], [12, 'Science']]);
	const section = ok(pivotDraftToView(report, 'sections', 701, { id: 701, name: '7-Rizal' }, 1, subjectMap));
	const teacher = ok(pivotDraftToView(report, 'teachers', 502, { id: 502, name: 'Teacher B' }, 2, subjectMap));
	const room = ok(pivotDraftToView(report, 'rooms', 601, { id: 601, name: 'Room 601' }, 1, subjectMap));

	assert.deepEqual(section.grid.flatMap((row) => row.cells.flatMap((cell) => cell.entries.map((entry) => entry.entryId))), ['section-teacher-room-1']);
	assert.deepEqual(teacher.grid.flatMap((row) => row.cells.flatMap((cell) => cell.entries.map((entry) => entry.entryId))), ['section-teacher-room-2']);
	assert.deepEqual(room.grid.flatMap((row) => row.cells.flatMap((cell) => cell.entries.map((entry) => entry.entryId))), ['section-teacher-room-1']);
});

test('production pivot preserves ordered cross-shift slots and Monday-only special-event scope', () => {
	const view = ok(pivotDraftToView(report, 'sections', 701, { id: 701, name: '7-Rizal' }, 1, new Map([[11, 'Mathematics']])));
	assert.deepEqual(view.timeSlots.map((slot) => `${slot.startTime}-${slot.endTime}`), ['06:00-06:30', '06:00-06:45', '13:00-13:45']);
	const flag = view.grid.find((row) => row.timeSlot.eventLabel === 'FLAG CEREMONY');
	assert.equal(flag?.timeSlot.dayOfWeek, 'MONDAY');
	assert.ok(flag?.cells.every((cell) => cell.entries.length === 0), 'special-event rows must never become timetable entries');
});
