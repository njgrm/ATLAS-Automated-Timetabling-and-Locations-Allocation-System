/**
 * TT-OUTPUT-C03R3 — term-aware client conflict identity.
 *
 * Production-path proof through `createLiveConflictInspector`. A resolved
 * schedule repeats the same section/room/teacher/day/interval in every ordered
 * term; those entries must NOT be reported as collisions. The former inspector
 * compared entries without any term scope, so a different-term entry was a hard
 * room/section/faculty conflict and every assertion below fails on the base.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createLiveConflictInspector, type TimetableConflictContext } from '../timetable-live-conflict';
import type { ScheduledEntry } from '@/types';

const TIME_SLOTS = [{ startTime: '06:00', endTime: '06:45' }];
const MAPS = {
	facultyName: (id: number) => `Faculty ${id}`,
	sectionName: (id: number) => `Section ${id}`,
	roomName: (id: number) => `Room ${id}`,
	subjectName: (id: number) => `Subject ${id}`,
};

function entry(overrides: Partial<ScheduledEntry> & Pick<ScheduledEntry, 'entryId' | 'termIndex'>): ScheduledEntry {
	return {
		facultyId: 501,
		roomId: 601,
		subjectId: 11,
		sectionId: 701,
		day: 'MONDAY',
		startTime: '06:00',
		endTime: '06:45',
		durationMinutes: 45,
		...overrides,
	};
}

const ENTRIES: ScheduledEntry[] = [
	entry({ entryId: 'mon-t1', termIndex: 1 }),
	entry({ entryId: 'mon-t2', termIndex: 2 }),
	entry({ entryId: 'tue-t1', termIndex: 1, day: 'TUESDAY' }),
];

function inspectorFor(termIndex: number) {
	const context: TimetableConflictContext = {
		sectionId: 701,
		facultyId: 501,
		roomId: 601,
		sourceEntryId: 'external-source',
		termIndex,
	};
	const inspector = createLiveConflictInspector(ENTRIES, TIME_SLOTS, context, MAPS);
	assert.ok(inspector, 'inspector must exist for an active edit context');
	return inspector!;
}

test('C03R3: an entry in another ordered term is not a client conflict', () => {
	const inspector = inspectorFor(3);
	assert.equal(inspector.getCompact('MONDAY-06:00-06:45')?.kind, 'clean', 'term 1 and term 2 placements do not conflict with a term 3 edit');
	assert.equal(inspector.getCompact('TUESDAY-06:00-06:45')?.kind, 'clean', 'a term 1 placement does not conflict with a term 3 edit');
});

test('C03R3: the same ordered term still reports a hard client conflict', () => {
	const inspector = inspectorFor(1);
	assert.equal(inspector.getCompact('MONDAY-06:00-06:45')?.kind, 'blocked', 'a same-term room/section/faculty overlap stays blocking');
	assert.equal(inspector.getCompact('TUESDAY-06:00-06:45')?.kind, 'blocked', 'a same-term overlap on another weekday stays blocking');
	assert.ok(
		inspector.getCompact('MONDAY-06:00-06:45')?.codes.some((code) => code === 'ROOM_OVERLAP' || code === 'SECTION_OVERLAP' || code === 'FACULTY_OVERLAP'),
		'the blocking code names the colliding resource',
	);
});

test('C03R3: an unscoped edit context keeps every term visible (fail-safe)', () => {
	const context: TimetableConflictContext = {
		sectionId: 701,
		facultyId: 501,
		roomId: 601,
		sourceEntryId: 'external-source',
	};
	const inspector = createLiveConflictInspector(ENTRIES, TIME_SLOTS, context, MAPS)!;
	assert.equal(inspector.getCompact('MONDAY-06:00-06:45')?.kind, 'blocked', 'an unscoped edit still sees same-slot occupancy');
});
