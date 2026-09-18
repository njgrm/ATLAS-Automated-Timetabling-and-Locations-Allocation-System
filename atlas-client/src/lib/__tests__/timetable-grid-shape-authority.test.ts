import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
	buildGridRows,
	resolveEntityDisplaySlots,
	resolveSectionShapeContract,
	type GridDisplaySlot,
	type TimetableShapeContractLike,
} from '../timetable-grid-slots';
import { resolveSectionGradeNumber } from '../schedule-review-helpers';
import { createLiveConflictLookup } from '../timetable-live-conflict';
import { TimetableGrid } from '../../components/timetable/TimetableGrid';
import type { ExternalSection, ScheduledEntry } from '@/types';

const MAPS = {
	facultyName: (id: number) => `Faculty ${id}`,
	sectionName: (id: number) => `Section ${id}`,
	roomName: (id: number) => `Room ${id}`,
	subjectName: (id: number) => `Subject ${id}`,
};

/**
 * GRID-SHAPE-AUTHORITY regression.
 *
 * Reproduces the live run-#314 shape: a 16-contract summary (4 grades × 4
 * programs) whose run-wide `timetableDisplaySlots` union merges the G7/G8
 * morning grid with the G9/G10 afternoon grid. A Grade 7 section must render
 * exactly its own shape, with the Monday Flag/HGP sharing the 06:45–07:30
 * period row instead of becoming a second row at that time.
 */

const GRADES = [7, 8, 9, 10] as const;
const PROGRAMS = ['REGULAR', 'STE', 'SPA', 'SPS'] as const;

const slotKey = (slot: Pick<GridDisplaySlot, 'startTime' | 'endTime'>) => `${slot.startTime}-${slot.endTime}`;

function classSlot(startTime: string, endTime: string): GridDisplaySlot {
	return { startTime, endTime };
}

function eventSlot(startTime: string, endTime: string, eventName: string, dayOfWeek?: string): GridDisplaySlot {
	return { startTime, endTime, isSpecialEvent: true, eventName, dayOfWeek };
}

const MORNING_CLASS: Array<[string, string]> = [
	['06:00', '06:45'],
	['06:45', '07:30'],
	['07:30', '08:15'],
	['08:15', '09:00'],
	['09:15', '10:00'],
	['10:00', '10:45'],
	['10:45', '11:30'],
	['11:30', '12:15'],
];

const AFTERNOON_CLASS: Array<[string, string]> = [
	['12:15', '13:00'],
	['13:00', '13:45'],
	['13:45', '14:30'],
	['14:30', '15:15'],
	['15:15', '16:00'],
	['16:00', '16:45'],
	['16:45', '17:30'],
	['17:30', '18:15'],
	['18:15', '18:30'],
];

/** A grade-level display shape with its day-scoped flag overlay. */
function shapeForGrade(grade: number, programType: string): TimetableShapeContractLike {
	const isMorning = grade === 7 || grade === 8;
	const classBlocks = isMorning ? MORNING_CLASS : AFTERNOON_CLASS;
	const flagStart = isMorning ? '06:45' : '12:15';
	const flagEnd = isMorning ? '07:30' : '13:00';
	const displaySlots: GridDisplaySlot[] = [
		...classBlocks.map(([startTime, endTime]) => classSlot(startTime, endTime)),
		eventSlot(flagStart, flagEnd, 'FLAG CEREMONY', 'MONDAY'),
		eventSlot(isMorning ? '09:00' : '15:15', isMorning ? '09:15' : '15:30', 'HEALTH BREAK'),
		eventSlot(isMorning ? '12:15' : '11:30', isMorning ? '13:00' : '12:15', 'LUNCH BREAK'),
	];
	if (grade === 8) displaySlots.push(classSlot('11:45', '12:30'));
	if (grade === 10) displaySlots.push(classSlot('18:30', '19:15'));
	return { gradeLevel: grade, programType, displaySlots };
}

const CONTRACTS: TimetableShapeContractLike[] = GRADES.flatMap((grade) =>
	PROGRAMS.map((programType) => shapeForGrade(grade, programType)),
);

/** Mirrors the server's `buildUnionDisplaySlots` (key includes event identity). */
function buildUnionForTest(contracts: TimetableShapeContractLike[]): GridDisplaySlot[] {
	const dedupe = new Map<string, GridDisplaySlot>();
	for (const contract of contracts) {
		for (const slot of contract.displaySlots) {
			const key = `${slot.startTime}-${slot.endTime}-${slot.eventName ?? ''}-${slot.isSpecialEvent ? '1' : '0'}`;
			if (!dedupe.has(key)) dedupe.set(key, { ...slot });
		}
	}
	return [...dedupe.values()].sort(
		(left, right) => left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime),
	);
}

/** The pre-fix resolver: literal 7–10 only, no internal-ID normalization. */
function legacyResolveSectionGradeNumber(section: ExternalSection): number | null {
	const valid = new Set([7, 8, 9, 10]);
	const nameMatch = (section.gradeLevelName ?? '').match(/(\d+)/);
	if (nameMatch) {
		const n = Number(nameMatch[1]);
		if (valid.has(n)) return n;
	}
	if (valid.has(section.displayOrder)) return section.displayOrder;
	if (valid.has(section.gradeLevelId)) return section.gradeLevelId;
	return null;
}

function duplicateKeys(slots: GridDisplaySlot[]): string[] {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const slot of slots) {
		const key = slotKey(slot);
		if (seen.has(key)) duplicates.add(key);
		seen.add(key);
	}
	return [...duplicates];
}

// Live-shaped Grade 7 REGULAR section: the EnrollPro internal grade ID (17)
// leaked into displayOrder/gradeLevelName, so the old literal resolver failed.
const LUNA: ExternalSection = {
	id: 141,
	name: 'Luna',
	maxCapacity: 40,
	enrolledCount: 38,
	gradeLevelId: 17,
	gradeLevelName: '',
	displayOrder: 17,
	programType: 'REGULAR',
};

test('resolves the G7 REGULAR shape from a 16-contract summary despite the EnrollPro internal grade ID', () => {
	assert.equal(resolveSectionGradeNumber(LUNA), 7, 'internal grade ID 17 normalizes to Grade 7');
	const contract = resolveSectionShapeContract(LUNA, CONTRACTS);
	assert.ok(contract, 'section contract resolves');
	assert.equal(contract.gradeLevel, 7);
	assert.equal(contract.programType, 'REGULAR');
	assert.equal(contract.displaySlots.length, 11, "the section's own shape has 11 display slots");

	const sectionSlots = resolveEntityDisplaySlots({
		viewMode: 'section',
		entityFilter: '141',
		sectionMap: new Map([[LUNA.id, LUNA]]),
		entries: [],
		contracts: CONTRACTS,
	});
	assert.ok(sectionSlots, 'section view resolves its own slots');
	assert.equal(sectionSlots.length, 11, "section view uses its own shape's 11 slots, not the 24-row union");
});

test('grid rows collapse a shape to one row per interval and fold the Monday flag into 06:45-07:30', () => {
	const sectionSlots = resolveEntityDisplaySlots({
		viewMode: 'section',
		entityFilter: '141',
		sectionMap: new Map([[LUNA.id, LUNA]]),
		entries: [],
		contracts: CONTRACTS,
	});
	assert.ok(sectionSlots);

	const rows = buildGridRows(sectionSlots);
	assert.equal(rows.length, 10, 'the shape\'s 11 display slots collapse to 10 unique time ranges');
	const keys = rows.map(slotKey);
	assert.equal(new Set(keys).size, keys.length, 'no duplicate (startTime, endTime) rows');
	assert.deepEqual(duplicateKeys(rows), [], 'duplicate ranges are eliminated');

	const firstPeriod = rows.filter((row) => row.startTime === '06:45' && row.endTime === '07:30');
	assert.equal(firstPeriod.length, 1, 'exactly one 06:45-07:30 row');
	assert.equal(firstPeriod[0].isSpecialEvent, false, 'the period row stays a class period');
	assert.equal(firstPeriod[0].eventName, 'FLAG CEREMONY', 'the Monday flag is carried inside the period row');
	assert.equal(firstPeriod[0].dayOfWeek, 'MONDAY', 'the flag is day-scoped to Monday');

	const healthBreak = rows.find((row) => row.startTime === '09:00' && row.endTime === '09:15');
	assert.equal(healthBreak?.isSpecialEvent, true, 'Health Break keeps its own row');
	const lunch = rows.find((row) => row.startTime === '12:15' && row.endTime === '13:00');
	assert.equal(lunch?.isSpecialEvent, true, 'Lunch keeps its own row');
});

test('negative control: the pre-fix resolver fails and the raw union duplicates 06:45-07:30', () => {
	// The old resolver returned null for the live-shaped section, so the grid
	// fell back to the run-wide union.
	assert.equal(legacyResolveSectionGradeNumber(LUNA), null, 'pre-fix resolver cannot read internal grade ID 17');

	const union = buildUnionForTest(CONTRACTS);
	assert.ok(union.length > 20, `union merges every shape (got ${union.length} rows)`);
	const unionDuplicates = duplicateKeys(union);
	assert.ok(unionDuplicates.includes('06:45-07:30'), 'union has two 06:45-07:30 rows (class + flag)');
	assert.ok(unionDuplicates.includes('12:15-13:00'), 'union has duplicate 12:15-13:00 rows (class + flag + lunch)');

	// The last-resort union projection is still deduplicated.
	assert.deepEqual(duplicateKeys(buildGridRows(union)), [], 'buildGridRows eliminates union duplicates');
});

test('teacher/room views union only the shapes the entity actually consumes', () => {
	const g9: ExternalSection = {
		id: 191,
		name: '9-Mabini',
		maxCapacity: 40,
		enrolledCount: 36,
		gradeLevelId: 19,
		gradeLevelName: '',
		displayOrder: 19,
		programType: 'REGULAR',
	};
	const sectionMap = new Map<number, ExternalSection>([[LUNA.id, LUNA], [g9.id, g9]]);
	const entries: ScheduledEntry[] = [
		{ entryId: 'e1', facultyId: 501, roomId: 601, subjectId: 11, sectionId: LUNA.id, day: 'TUESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45 },
		{ entryId: 'e2', facultyId: 501, roomId: 601, subjectId: 11, sectionId: g9.id, day: 'TUESDAY', startTime: '12:15', endTime: '13:00', durationMinutes: 45 },
	];

	const teacherSlots = resolveEntityDisplaySlots({
		viewMode: 'faculty',
		entityFilter: '501',
		sectionMap,
		entries,
		contracts: CONTRACTS,
	});
	assert.ok(teacherSlots, 'teacher view resolves the shapes it teaches');
	const teacherRows = buildGridRows(teacherSlots);
	assert.ok(teacherRows.some((row) => row.startTime === '06:00'), 'teacher sees the G7 morning shape');
	assert.ok(teacherRows.some((row) => row.startTime === '12:15'), 'teacher sees the G9 afternoon shape');
	assert.ok(!teacherRows.some((row) => row.startTime === '18:30'), 'teacher does not see the untaught G10-only interval');
	assert.ok(!teacherRows.some((row) => row.startTime === '11:45'), 'teacher does not see the untaught G8-only interval');

	const roomSlots = resolveEntityDisplaySlots({
		viewMode: 'room',
		entityFilter: '601',
		sectionMap,
		entries,
		contracts: CONTRACTS,
	});
	assert.ok(roomSlots, 'room view resolves the shapes it hosts');
	const roomRows = buildGridRows(roomSlots);
	assert.ok(!roomRows.some((row) => row.startTime === '18:30'), 'room does not union unhosted G10 intervals');
});

test('live conflict index blocks a merged day-scoped overlay on Monday only', () => {
	const sectionSlots = resolveEntityDisplaySlots({
		viewMode: 'section',
		entityFilter: '141',
		sectionMap: new Map([[LUNA.id, LUNA]]),
		entries: [],
		contracts: CONTRACTS,
	});
	assert.ok(sectionSlots);
	const mergedRows = buildGridRows(sectionSlots);
	const lookup = createLiveConflictLookup([], mergedRows, { sectionId: LUNA.id }, MAPS);
	assert.ok(lookup);
	assert.equal(lookup('MONDAY-06:45-07:30')?.kind, 'hard', 'Monday flag interval is blocked');
	assert.equal(lookup('TUESDAY-06:45-07:30')?.kind, 'clean', 'Tuesday first period stays available');
	assert.equal(lookup('FRIDAY-06:45-07:30')?.kind, 'clean', 'Friday first period stays available');
});

test('rendered grid presents the Monday flag inside the 06:45-07:30 period row, not as a second row', () => {
	const sectionSlots = resolveEntityDisplaySlots({
		viewMode: 'section',
		entityFilter: '141',
		sectionMap: new Map([[LUNA.id, LUNA]]),
		entries: [],
		contracts: CONTRACTS,
	});
	assert.ok(sectionSlots);
	const timeSlots = buildGridRows(sectionSlots);

	const tuesdayClass: ScheduledEntry = {
		entryId: 'tue-math',
		sectionId: LUNA.id,
		facultyId: 501,
		roomId: 601,
		subjectId: 11,
		day: 'TUESDAY',
		startTime: '06:45',
		endTime: '07:30',
		durationMinutes: 45,
	};

	const markup = renderToStaticMarkup(createElement(TimetableGrid, {
		entries: [tuesdayClass],
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

	assert.equal(markup.split('FLAG CEREMONY').length - 1, 1, 'the Monday flag renders exactly once');
	assert.ok(markup.includes('Mathematics'), 'the Tuesday class still renders');
	assert.equal(
		(markup.match(/data-start-time="06:45"/g) ?? []).length,
		5,
		'the 06:45-07:30 interval renders five day cells for one row, not two rows',
	);
});
