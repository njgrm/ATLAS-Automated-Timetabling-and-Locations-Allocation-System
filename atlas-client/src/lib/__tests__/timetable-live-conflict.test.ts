import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import {
	buildLiveConflictIndex,
	createLiveConflictInspector,
	intervalsOverlap,
	type TimetableConflictSlot,
} from '@/lib/timetable-live-conflict';
import type { ScheduledEntry } from '@/types';

const maps = {
	facultyName: (id: number) => `Faculty ${id}`,
	sectionName: (id: number) => `Section ${id}`,
	roomName: (id: number) => `Room ${id}`,
	subjectName: (id: number) => `Subject ${id}`,
};

function slot(startTime: string, endTime: string, overrides: Partial<TimetableConflictSlot> = {}): TimetableConflictSlot {
	return { startTime, endTime, ...overrides };
}

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

test('intervalsOverlap uses half-open intervals so adjacent sessions do not conflict', () => {
	assert.equal(intervalsOverlap('08:00', '08:45', '08:30', '09:15'), true);
	assert.equal(intervalsOverlap('08:00', '09:30', '08:15', '08:45'), true);
	assert.equal(intervalsOverlap('08:00', '08:45', '08:45', '09:30'), false);
	assert.equal(intervalsOverlap('08:45', '09:30', '08:00', '08:45'), false);
});

test('live conflict inspector catches partial section, room, and faculty overlaps', () => {
	const slots = [slot('08:15', '09:00')];
	const entries = [
		entry({ entryId: 'section-overlap', sectionId: 1, roomId: 101, facultyId: 11, startTime: '08:00', endTime: '08:30' }),
		entry({ entryId: 'room-overlap', sectionId: 2, roomId: 100, facultyId: 12, startTime: '08:45', endTime: '09:30' }),
		entry({ entryId: 'faculty-overlap', sectionId: 3, roomId: 102, facultyId: 10, startTime: '08:30', endTime: '08:45' }),
		entry({ entryId: 'adjacent-safe', sectionId: 1, roomId: 100, facultyId: 10, startTime: '09:00', endTime: '09:45' }),
	];
	const index = buildLiveConflictIndex(entries, slots);
	const inspector = createLiveConflictInspector(entries, slots, { sectionId: 1, facultyId: 10, roomId: 100 }, maps, index);
	assert.ok(inspector);

	const compact = inspector.getCompact('MONDAY-08:15-09:00');
	assert.equal(compact?.kind, 'blocked');
	assert.deepEqual(compact?.codes.sort(), ['FACULTY_OVERLAP', 'ROOM_OVERLAP', 'SECTION_OVERLAP']);
	assert.equal(compact?.displacedEntryIds.includes('adjacent-safe'), false);

	const detail = inspector.getDetail('MONDAY-08:15-09:00');
	assert.equal(detail?.kind, 'hard');
	assert.match(detail?.reasons.join(' | ') ?? '', /Section occupied/);
	assert.match(detail?.reasons.join(' | ') ?? '', /Room occupied/);
	assert.match(detail?.reasons.join(' | ') ?? '', /Faculty overlap/);
});

test('source entry is excluded from conflict checks and reported as self in its current interval', () => {
	const slots = [slot('09:00', '09:45'), slot('09:45', '10:30')];
	const entries = [
		entry({ entryId: 'source', sectionId: 1, roomId: 100, facultyId: 10, startTime: '09:00', endTime: '09:45' }),
	];
	const inspector = createLiveConflictInspector(entries, slots, { sectionId: 1, facultyId: 10, roomId: 100, sourceEntryId: 'source' }, maps);
	assert.ok(inspector);

	assert.equal(inspector.getCompact('MONDAY-09:00-09:45')?.kind, 'self');
	assert.equal(inspector.getCompact('MONDAY-09:45-10:30')?.kind, 'clean');
});

test('special event cells are blocked without requiring decorated detail work', () => {
	const slots = [slot('10:00', '10:45', { isSpecialEvent: true, eventName: 'Flag ceremony' })];
	const inspector = createLiveConflictInspector([], slots, { sectionId: 1, facultyId: 10, roomId: 100 }, maps);
	assert.ok(inspector);

	const compact = inspector.getCompact('MONDAY-10:00-10:45');
	assert.equal(compact?.kind, 'blocked');
	assert.deepEqual(compact?.codes, ['SPECIAL_EVENT']);

	const detail = inspector.getDetail('MONDAY-10:00-10:45');
	assert.equal(detail?.kind, 'hard');
	assert.match(detail?.reasons.join(''), /Flag ceremony/);
});

test('faculty alternatives warn when one option is busy and block when all options are busy', () => {
	const slots = [slot('11:00', '11:45')];
	const entries = [
		entry({ entryId: 'faculty-10-busy', sectionId: 2, roomId: 101, facultyId: 10, startTime: '11:00', endTime: '11:45' }),
		entry({ entryId: 'faculty-11-busy', sectionId: 3, roomId: 102, facultyId: 11, startTime: '11:15', endTime: '11:30' }),
	];

	const warningInspector = createLiveConflictInspector(entries.slice(0, 1), slots, { sectionId: 1, roomId: 100, allFacultyOptions: [10, 11] }, maps);
	assert.equal(warningInspector?.getCompact('MONDAY-11:00-11:45')?.kind, 'warning');
	assert.deepEqual(warningInspector?.getCompact('MONDAY-11:00-11:45')?.codes, ['FACULTY_OPTION_BUSY']);

	const blockedInspector = createLiveConflictInspector(entries, slots, { sectionId: 1, roomId: 100, allFacultyOptions: [10, 11] }, maps);
	assert.equal(blockedInspector?.getCompact('MONDAY-11:00-11:45')?.kind, 'blocked');
	assert.deepEqual(blockedInspector?.getCompact('MONDAY-11:00-11:45')?.codes, ['FACULTY_OPTIONS_ALL_BUSY']);
});

test('faculty daily workload thresholds warn above 6h and block above 8h after source subtraction', () => {
	const slots = [slot('15:00', '15:45')];
	const sixHours = Array.from({ length: 8 }, (_, index) => (
		entry({
			entryId: `load-soft-${index}`,
			facultyId: 10,
			sectionId: 20 + index,
			roomId: 200 + index,
			startTime: `${String(7 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '45'}`,
			endTime: `${String(7 + Math.floor((index + 1) / 2)).padStart(2, '0')}:${index % 2 === 0 ? '45' : '30'}`,
		})
	));
	const warningInspector = createLiveConflictInspector(sixHours, slots, { sectionId: 1, facultyId: 10, roomId: 100 }, maps);
	assert.equal(warningInspector?.getCompact('MONDAY-15:00-15:45')?.kind, 'warning');
	assert.equal(warningInspector?.getCompact('MONDAY-15:00-15:45')?.codes.includes('DAILY_LOAD_SOFT'), true);

	const eightHours = Array.from({ length: 12 }, (_, index) => (
		entry({
			entryId: `load-hard-${index}`,
			facultyId: 10,
			sectionId: 40 + index,
			roomId: 400 + index,
			startTime: `${String(7 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '45'}`,
			endTime: `${String(7 + Math.floor((index + 1) / 2)).padStart(2, '0')}:${index % 2 === 0 ? '45' : '30'}`,
		})
	));
	const blockedInspector = createLiveConflictInspector(eightHours, slots, { sectionId: 1, facultyId: 10, roomId: 100 }, maps);
	assert.equal(blockedInspector?.getCompact('MONDAY-15:00-15:45')?.kind, 'blocked');
	assert.equal(blockedInspector?.getCompact('MONDAY-15:00-15:45')?.codes.includes('DAILY_LOAD_HARD'), true);

	const sourceInspector = createLiveConflictInspector(
		[
			...sixHours,
			entry({ entryId: 'source', facultyId: 10, startTime: '15:00', endTime: '15:45' }),
		],
		slots,
		{ sectionId: 1, facultyId: 10, roomId: 100, sourceEntryId: 'source' },
		maps,
	);
	assert.equal(sourceInspector?.getCompact('MONDAY-15:00-15:45')?.kind, 'self');
});

test('live conflict engine stays bounded on a 1000-entry synthetic timetable', () => {
	const slots = Array.from({ length: 60 }, (_, index) => {
		const hour = 7 + Math.floor(index / 4);
		const minute = (index % 4) * 15;
		const nextMinute = minute + 15;
		return slot(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, `${String(hour + Math.floor(nextMinute / 60)).padStart(2, '0')}:${String(nextMinute % 60).padStart(2, '0')}`);
	});
	const entries = Array.from({ length: 1000 }, (_, index) => {
		const baseSlot = slots[index % slots.length];
		return entry({
			entryId: `scale-${index}`,
			day: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'][index % 5],
			sectionId: 1 + (index % 80),
			facultyId: 10 + (index % 120),
			roomId: 100 + (index % 50),
			subjectId: 1000 + (index % 20),
			startTime: baseSlot.startTime,
			endTime: baseSlot.endTime,
		});
	});

	const buildStart = performance.now();
	const index = buildLiveConflictIndex(entries, slots);
	const buildMs = performance.now() - buildStart;
	const inspector = createLiveConflictInspector(entries, slots, { sectionId: 1, facultyId: 10, roomId: 100 }, maps, index);
	assert.ok(inspector);

	const compactDurations: number[] = [];
	for (const candidate of slots) {
		const started = performance.now();
		inspector.getCompact(`MONDAY-${candidate.startTime}-${candidate.endTime}`);
		compactDurations.push(performance.now() - started);
	}
	const detailDurations: number[] = [];
	for (let index = 0; index < 50; index += 1) {
		const candidate = slots[index % slots.length];
		const started = performance.now();
		inspector.getDetail(`MONDAY-${candidate.startTime}-${candidate.endTime}`);
		detailDurations.push(performance.now() - started);
	}

	compactDurations.sort((a, b) => a - b);
	detailDurations.sort((a, b) => a - b);
	const compactP95 = compactDurations[Math.floor(compactDurations.length * 0.95)];
	const detailP95 = detailDurations[Math.floor(detailDurations.length * 0.95)];
	assert.ok(buildMs < 20, `index build took ${buildMs.toFixed(2)}ms`);
	assert.ok(compactP95 < 1, `compact p95 took ${compactP95.toFixed(2)}ms`);
	assert.ok(detailP95 < 2, `detail p95 took ${detailP95.toFixed(2)}ms`);
});
