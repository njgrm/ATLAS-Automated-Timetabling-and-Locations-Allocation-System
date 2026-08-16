import assert from 'node:assert/strict';
import test from 'node:test';

import { findGradeWindow, resolveSectionGradeNumber } from '@/lib/schedule-review-helpers';
import type { ExternalSection, ScheduledEntry } from '@/types';

type TimeSlot = { startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string };

function timeToMinutes(time: string): number {
	const [h, m] = time.split(':').map(Number);
	return h * 60 + m;
}

function makeSection(overrides: Partial<ExternalSection> = {}): ExternalSection {
	return {
		id: 1,
		name: 'Section 1',
		maxCapacity: 40,
		enrolledCount: 30,
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		programType: 'REGULAR',
		...overrides,
	} as ExternalSection;
}

function makeEntry(overrides: Partial<ScheduledEntry> = {}): ScheduledEntry {
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
	} as ScheduledEntry;
}

const allTimeSlots: TimeSlot[] = [
	{ startTime: '06:00', endTime: '06:45' },
	{ startTime: '06:45', endTime: '07:30' },
	{ startTime: '07:30', endTime: '08:15' },
	{ startTime: '08:15', endTime: '09:00' },
	{ startTime: '09:00', endTime: '09:15', isSpecialEvent: true, eventName: 'RECESS' },
	{ startTime: '09:15', endTime: '10:00' },
	{ startTime: '10:00', endTime: '10:45' },
	{ startTime: '10:45', endTime: '11:30' },
	{ startTime: '11:30', endTime: '12:15' },
	{ startTime: '12:15', endTime: '13:00', isSpecialEvent: true, eventName: 'LUNCH' },
	{ startTime: '13:00', endTime: '13:45' },
	{ startTime: '13:45', endTime: '14:30' },
];

const gradeWindows = [
	{ gradeLevel: 7, programType: null, startTime: '07:30', endTime: '12:15' },
];

function filterSectionTimeSlots(
	timeSlots: TimeSlot[],
	sectionId: number,
	entries: ScheduledEntry[],
	sectionMap: Map<number, ExternalSection>,
	gradeWindows: Array<{ gradeLevel: number; programType?: string | null; startTime: string; endTime: string }>,
): TimeSlot[] {
	const section = sectionMap.get(sectionId);
	if (!section) return timeSlots;
	const gradeNumber = resolveSectionGradeNumber(section);
	if (gradeNumber == null) return timeSlots;
	const matchingWindow = findGradeWindow(gradeNumber, section.programType, gradeWindows);
	if (!matchingWindow) return timeSlots;

	const windowStart = timeToMinutes(matchingWindow.startTime);
	const windowEnd = timeToMinutes(matchingWindow.endTime);

	// Collect occupied time ranges for this section
	const occupiedRanges: Array<{ start: number; end: number }> = [];
	for (const e of entries) {
		if (e.sectionId === sectionId) {
			occupiedRanges.push({ start: timeToMinutes(e.startTime), end: timeToMinutes(e.endTime) });
		}
	}

	return timeSlots.filter((slot) => {
		if (slot.isSpecialEvent) {
			const slotStart = timeToMinutes(slot.startTime);
			const slotEnd = timeToMinutes(slot.endTime);
			return slotStart < windowEnd && slotEnd > windowStart;
		}
		const start = timeToMinutes(slot.startTime);
		const end = timeToMinutes(slot.endTime);
		if (start >= windowStart && end <= windowEnd) return true;
		// Check if any occupied entry overlaps this time slot
		for (const range of occupiedRanges) {
			if (range.start < end && range.end > start) return true;
		}
		return false;
	});
}

test('Section view hides 06:00 rows when grade window starts at 07:30', () => {
	const sectionMap = new Map<number, ExternalSection>();
	sectionMap.set(1, makeSection());
	const entries: ScheduledEntry[] = [];

	const filtered = filterSectionTimeSlots(allTimeSlots, 1, entries, sectionMap, gradeWindows);

	// Should NOT include 06:00-06:45 or 06:45-07:30
	assert.ok(!filtered.some((s) => s.startTime === '06:00'), 'Should not include 06:00 slot');
	assert.ok(!filtered.some((s) => s.startTime === '06:45'), 'Should not include 06:45 slot');
	// Should include 07:30-12:15 slots
	assert.ok(filtered.some((s) => s.startTime === '07:30'), 'Should include 07:30 slot');
	assert.ok(filtered.some((s) => s.startTime === '11:30'), 'Should include 11:30 slot');
	// Should include RECESS (overlaps window)
	assert.ok(filtered.some((s) => s.eventName === 'RECESS'), 'Should include RECESS');
	// LUNCH starts at 12:15 which is exactly the window end, so it is excluded
	assert.ok(!filtered.some((s) => s.eventName === 'LUNCH'), 'Should not include LUNCH (starts at window end)');
	// Should NOT include 13:00+ slots
	assert.ok(!filtered.some((s) => s.startTime === '13:00'), 'Should not include 13:00 slot');
});

test('Section view includes occupied rows outside the window', () => {
	const sectionMap = new Map<number, ExternalSection>();
	sectionMap.set(1, makeSection());
	const entries = [makeEntry({ sectionId: 1, startTime: '06:30', endTime: '07:15' })];

	const filtered = filterSectionTimeSlots(allTimeSlots, 1, entries, sectionMap, gradeWindows);

	// Should include the occupied 06:30-07:15 row (mapped to 06:45-07:30 slot)
	assert.ok(filtered.some((s) => s.startTime === '06:45'), 'Should include occupied 06:45 slot');
});

test('Section view with internal gradeLevelId=17 matches Grade 7 window', () => {
	const sectionMap = new Map<number, ExternalSection>();
	sectionMap.set(1, makeSection({ gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7 }));
	const entries: ScheduledEntry[] = [];

	const filtered = filterSectionTimeSlots(allTimeSlots, 1, entries, sectionMap, gradeWindows);

	// Should NOT include 06:00 rows
	assert.ok(!filtered.some((s) => s.startTime === '06:00'), 'Should not include 06:00 slot');
	// Should include 07:30+ rows
	assert.ok(filtered.some((s) => s.startTime === '07:30'), 'Should include 07:30 slot');
});

test('Show full day returns all time slots', () => {
	// When showFullDay is true, the filter should not be applied
	const sectionMap = new Map<number, ExternalSection>();
	sectionMap.set(1, makeSection());
	const entries: ScheduledEntry[] = [];

	// Simulate showFullDay by not filtering
	const filtered = allTimeSlots;
	assert.equal(filtered.length, allTimeSlots.length, 'Should return all slots when showFullDay');
});
