import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { buildLiveConflictIndex, createLiveConflictLookup } from '../timetable-live-conflict';
import { pivotDraftToView } from '../schedule-pivot';
import { TimetableGrid } from '../../components/timetable/TimetableGrid';
import type { DraftReport, ScheduledEntry } from '@/types';

const MAPS = {
	facultyName: (id: number) => `Faculty ${id}`,
	sectionName: (id: number) => `Section ${id}`,
	roomName: (id: number) => `Room ${id}`,
	subjectName: (id: number) => `Subject ${id}`,
};

const TUESDAY_CLASS: ScheduledEntry = {
	entryId: 'tue-math',
	sectionId: 701,
	facultyId: 501,
	roomId: 601,
	subjectId: 11,
	day: 'TUESDAY',
	startTime: '06:00',
	endTime: '06:45',
	durationMinutes: 45,
};

test('live conflict map blocks a Monday-only event only on Monday and leaves the interval clean elsewhere', () => {
	const flagSlot = { startTime: '06:00', endTime: '06:45', isSpecialEvent: true, eventName: 'FLAG CEREMONY', dayOfWeek: 'MONDAY' };
	const context = { sectionId: 702 };
	const lookup = createLiveConflictLookup([TUESDAY_CLASS], [flagSlot], context, MAPS);
	assert.ok(lookup);
	assert.equal(lookup('MONDAY-06:00-06:45')?.kind, 'hard', 'Monday flag interval is blocked');
	assert.equal(lookup('TUESDAY-06:00-06:45')?.kind, 'clean', 'Tuesday first period stays available');
	assert.equal(lookup('FRIDAY-06:00-06:45')?.kind, 'clean', 'Friday first period stays available');

	// An all-week event (no dayOfWeek) still blocks every weekday.
	const allWeekLookup = createLiveConflictLookup([], [{ ...flagSlot, dayOfWeek: undefined }], context, MAPS);
	assert.equal(allWeekLookup?.('TUESDAY-06:00-06:45')?.kind, 'hard');
});

test('live conflict index normalizes day-scoped events without leaking them to other weekdays', () => {
	const flagSlot = { startTime: '06:00', endTime: '06:45', isSpecialEvent: true, eventName: 'FLAG CEREMONY', dayOfWeek: 'MONDAY' };
	const index = buildLiveConflictIndex([], [flagSlot]);
	assert.equal(index.slotByKey.get('MONDAY-06:00-06:45')?.isSpecialEvent, true);
	assert.equal(index.slotByKey.get('TUESDAY-06:00-06:45')?.isSpecialEvent, false);
});

test('section pivot renders a Monday-only event only on Monday and keeps Tuesday classes', () => {
	const report = {
		runId: 42,
		status: 'COMPLETED',
		createdAt: '2031-01-01T00:00:00.000Z',
		finishedAt: '2031-01-01T00:01:00.000Z',
		entries: [TUESDAY_CLASS],
		summary: {
			timetableDisplaySlots: [
				{ startTime: '06:00', endTime: '06:45', isSpecialEvent: true, eventName: 'FLAG CEREMONY', dayOfWeek: 'MONDAY' },
				{ startTime: '06:00', endTime: '06:45' },
			],
		},
	} as DraftReport;
	const view = pivotDraftToView(report, 'sections', 701, { id: 701, name: '7-Rizal' }, new Map([[11, 'Mathematics']]));
	const flagRow = view.grid.find((row) => row.timeSlot.eventLabel === 'FLAG CEREMONY');
	assert.ok(flagRow);
	const monday = flagRow.cells.find((cell) => cell.day === 'MONDAY');
	const tuesday = flagRow.cells.find((cell) => cell.day === 'TUESDAY');
	assert.equal(monday?.entries.length, 0);
	assert.deepEqual(tuesday?.entries.map((entry) => entry.entryId), ['tue-math']);
});

test('main TimetableGrid renders the Monday-only event once and keeps the Tuesday class cell', () => {
	const timeSlots = [
		{ startTime: '06:00', endTime: '06:45', isSpecialEvent: true, eventName: 'FLAG CEREMONY', dayOfWeek: 'MONDAY' },
		{ startTime: '06:00', endTime: '06:45' },
	];
	const markup = renderToStaticMarkup(createElement(TimetableGrid, {
		entries: [TUESDAY_CLASS],
		timeSlots,
		violationIndex: new Map(),
		highlightedEntryIds: new Set<string>(),
		selectedEntry: null,
		followUps: new Set<string>(),
		onEntryClick: () => {},
		subjectLabel: (id: number) => (id === 11 ? 'Mathematics' : `Subject ${id}`),
		sectionLabel: (id: number) => `Section ${id}`,
		gradeForSection: () => 7,
		entryContextLabel: () => '',
		formatFacultyInitials: () => 'JD',
		facultyLabel: () => 'Dela Cruz',
		viewMode: 'section',
		pivotLabel: () => '',
		roomLabelShort: () => 'Room 101',
		kbSelectedSource: null,
		onKbPlace: () => {},
		getCellConflict: () => null,
		getLiveCellConflict: () => null,
		onNavToFaculty: () => {},
		onNavToSection: () => {},
		onNavToRoom: () => {},
	}));
	assert.equal(markup.split('FLAG CEREMONY').length - 1, 1, 'the Monday-only event renders exactly once, not on all five days');
	assert.ok(markup.includes('Mathematics'), 'the Tuesday class still renders in the main workspace');
	assert.match(markup, /data-day="MONDAY" data-start-time="06:00" data-end-time="06:45"[^>]*>FLAG CEREMONY/);
});
