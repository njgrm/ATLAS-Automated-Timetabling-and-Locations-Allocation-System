import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildFacultyTeachingMinuteIndex,
	projectedTeachingHoursForFaculty,
} from '@/components/timetable/TacticalSandboxDock.helpers';
import type { ScheduledEntry } from '@/types';

function entry(overrides: Partial<ScheduledEntry>): ScheduledEntry {
	return {
		entryId: 'entry-1',
		facultyId: 10,
		roomId: 100,
		subjectId: 1000,
		sectionId: 1,
		day: 'MONDAY',
		startTime: '08:00',
		endTime: '08:45',
		durationMinutes: 45,
		entryKind: 'SECTION',
		...overrides,
	};
}

test('buildFacultyTeachingMinuteIndex applies sandbox overrides without cloning the draft', () => {
	const entries = [
		entry({ entryId: 'a', facultyId: 10, durationMinutes: 45 }),
		entry({ entryId: 'b', facultyId: 11, durationMinutes: 60 }),
	];
	const overrides = new Map([['a', 11]]);

	const index = buildFacultyTeachingMinuteIndex(entries, overrides);

	assert.equal(index.get(10), undefined);
	assert.equal(index.get(11), 105);
});

test('projectedTeachingHoursForFaculty applies only selected-entry deltas', () => {
	const entries = [
		entry({ entryId: 'a', facultyId: 10, durationMinutes: 45 }),
		entry({ entryId: 'b', facultyId: 10, durationMinutes: 60 }),
		entry({ entryId: 'c', facultyId: 11, durationMinutes: 30 }),
	];
	const entriesById = new Map(entries.map((item) => [item.entryId, item]));
	const baseMinutes = buildFacultyTeachingMinuteIndex(entries, new Map());

	assert.equal(projectedTeachingHoursForFaculty(10, baseMinutes, entriesById, ['a'], 11, new Map()), 1);
	assert.equal(projectedTeachingHoursForFaculty(11, baseMinutes, entriesById, ['a'], 11, new Map()), 1.3);
});

test('projectedTeachingHoursForFaculty returns indexed current load when no candidate delta exists', () => {
	const entries = [
		entry({ entryId: 'a', facultyId: 10, durationMinutes: 90 }),
		entry({ entryId: 'b', facultyId: 10, durationMinutes: 45 }),
	];
	const baseMinutes = buildFacultyTeachingMinuteIndex(entries, new Map());

	assert.equal(projectedTeachingHoursForFaculty(10, baseMinutes, new Map(), [], 10, new Map()), 2.3);
});
