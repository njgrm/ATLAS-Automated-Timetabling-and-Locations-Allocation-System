import assert from 'node:assert/strict';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import { buildEntryGrid, exportClassProgramWorkbook } from '../services/workbook-export.service.js';
import { generateClassProgramMatrix } from '../services/class-program-matrix.service.js';
import { buildTimetableShapeContract, constructBaseline } from '../services/schedule-constructor.js';
import { getExpectedCanonicalSlots } from '../services/class-program-slot.service.js';

// ─── Shared in-memory fixtures (zero writes) ───

const SCHOOL_ID = 71;
const SCHOOL_YEAR_ID = 11;
const RUN_ID = 42;

type Entry = {
	entryId: string;
	sectionId: number;
	subjectId: number;
	facultyId: number | null;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	termIndex?: number;
};

const SECTIONS = [
	{ id: 1, externalId: 701, name: '7-Rizal', gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
];
const FACULTY = [
	{ id: 501, firstName: 'Juan', lastName: 'Dela Cruz', advisedSectionId: 701 },
	{ id: 502, firstName: 'Maria', lastName: 'Santos', advisedSectionId: null },
];
const SUBJECTS = [
	{ id: 11, name: 'Mathematics', code: 'MATH' },
	{ id: 12, name: 'Science', code: 'SCI' },
	{ id: 13, name: 'Araling Panlipunan', code: 'AP' },
	{ id: 99, name: 'Homeroom Guidance', code: 'HG' },
	{ id: 98, name: 'ARAL Program', code: 'ARAL' },
];
const ROOMS = [
	{ id: 601, name: 'Room 101', type: 'CLASSROOM', floor: 1, building: { id: 1, name: 'Building A' } },
	{ id: 602, name: 'Room 102', type: 'CLASSROOM', floor: 1, building: { id: 1, name: 'Building A' } },
];

const CLASS_PROGRAM_SLOTS = [
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '06:45', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null, isActive: true },
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:45', endTime: '07:30', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null, isActive: true },
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '07:30', endTime: '08:15', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null, isActive: true },
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '09:00', endTime: '09:15', rowKind: 'BREAK', subjectLabel: 'Health Break', dayOfWeek: null, isActive: true },
];

function makeClient(entries: Entry[], options: { runId?: number; summary?: Record<string, unknown> } = {}) {
	return {
		generationRun: {
			findFirst: async (args: any) => {
				const id = args?.where?.id ?? options.runId ?? RUN_ID;
				if (id !== (options.runId ?? RUN_ID)) return null;
				return {
					id,
					status: 'COMPLETED',
					summary: options.summary ?? { timetableDisplaySlots: [] },
					draftEntries: entries,
				};
			},
			findMany: async () => [{ id: options.runId ?? RUN_ID }],
		},
		school: { findUnique: async () => ({ name: 'ATLAS School' }) },
		enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: '2026-2027' }) },
		sectionMirror: { findMany: async () => SECTIONS },
		facultyMirror: { findMany: async () => FACULTY },
		subject: { findMany: async () => SUBJECTS },
		room: { findMany: async () => ROOMS },
		classProgramSlot: {
			findMany: async (args: any) => {
				const where = args?.where ?? {};
				return CLASS_PROGRAM_SLOTS.filter((slot) =>
					(slot.gradeLevel === where.gradeLevel)
					&& (where.programType == null ? true : slot.programType === where.programType),
				);
			},
		},
	};
}

async function readWorkbook(buffer: Buffer) {
	const ExcelJS = (await import('exceljs')).default as any;
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(buffer);
	return workbook;
}

// The worktree `node_modules/exceljs` must be able to round-trip a workbook;
// when the dependency tree is incomplete the XLSX-cell evidence is BLOCKED and
// is reported explicitly rather than silently failing.
let exceljsUsable = false;
try {
	const ExcelJSProbe = (await import('exceljs')).default as any;
	const probe = new ExcelJSProbe.Workbook();
	probe.addWorksheet('probe');
	await probe.xlsx.writeBuffer();
	exceljsUsable = typeof ExcelJSProbe?.Workbook === 'function';
} catch {
	exceljsUsable = false;
}
const exceljsSkip = exceljsUsable ? false : 'EXTERNALLY_BLOCKED: worktree exceljs dependency tree is incomplete';

function cellText(sheet: any, row: number, col: number): string {
	const value = sheet.getRow(row).getCell(col).value;
	return typeof value === 'string' ? value : (value == null ? '' : String(value));
}

// ─── 1. buildEntryGrid keeps weekday in the key ───

test('buildEntryGrid separates same-interval Monday and Tuesday sessions and retires the day-agnostic key', () => {
	const entries: Entry[] = [
		{ entryId: 'mon-math', sectionId: 701, subjectId: 11, facultyId: 501, roomId: 601, day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45 },
		{ entryId: 'tue-sci', sectionId: 701, subjectId: 12, facultyId: 502, roomId: 602, day: 'TUESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45 },
	];
	const subjectMap = new Map(SUBJECTS.map((s) => [s.id, s]));
	const facultyMap = new Map(FACULTY.map((f) => [f.id, f]));
	const roomMap = new Map(ROOMS.map((r) => [r.id, { id: r.id, name: r.name, type: r.type, floor: r.floor, buildingId: 1, buildingName: 'Building A' }]));

	const grid = buildEntryGrid(entries, subjectMap, facultyMap, roomMap);
	assert.equal(grid.get('701-MONDAY-06:00-06:45')?.subject, 'Mathematics');
	assert.equal(grid.get('701-TUESDAY-06:00-06:45')?.subject, 'Science');
	assert.equal(grid.has('701-06:00-06:45'), false, 'day-agnostic key must no longer exist');
});

// ─── 2. Class program workbook is a per-section five-weekday beneficiary view ───

test('class-program workbook emits per-section weekday columns with exact per-day subject and teacher cells', { skip: exceljsSkip }, async () => {
	const entries: Entry[] = [
		{ entryId: 'mon-math', sectionId: 701, subjectId: 11, facultyId: 501, roomId: 601, day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45 },
		{ entryId: 'tue-sci', sectionId: 701, subjectId: 12, facultyId: 502, roomId: 602, day: 'TUESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45 },
		{ entryId: 'wed-ap', sectionId: 701, subjectId: 13, facultyId: 501, roomId: 601, day: 'WEDNESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45 },
	];
	const client = makeClient(entries);
	const buffer = await withDataContext(client, () => exportClassProgramWorkbook({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, client,
	}));
	const workbook = await readWorkbook(buffer);
	const sheet = workbook.getWorksheet('Grade 7');
	assert.ok(sheet, 'Grade 7 sheet exists');

	assert.deepEqual(
		[1, 2, 3, 4, 5, 6, 7].map((col) => cellText(sheet, 5, col)),
		['TIME', 'MINUTES', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
		'header carries a weekday column per day',
	);
	// Data row 6 is the 06:00-06:45 canonical class slot.
	assert.equal(cellText(sheet, 6, 1), '6:00 AM-6:45 AM');
	assert.equal(sheet.getRow(6).getCell(2).value, 45);
	assert.match(cellText(sheet, 6, 3), /^Mathematics\nDela Cruz, Juan$/);
	assert.match(cellText(sheet, 6, 4), /^Science\nSantos, Maria$/);
	assert.match(cellText(sheet, 6, 5), /^Araling Panlipunan\nDela Cruz, Juan$/);
	assert.equal(cellText(sheet, 6, 6), '');
	assert.equal(cellText(sheet, 6, 7), '');
});

// ─── 3. Monday-only Flag/HGP appears only in Monday ───

test('class-program workbook renders a Monday-only flag event only in Monday and keeps Tuesday first period teachable', { skip: exceljsSkip }, async () => {
	const entries: Entry[] = [
		{ entryId: 'tue-math', sectionId: 701, subjectId: 11, facultyId: 501, roomId: 601, day: 'TUESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45 },
	];
	const client = makeClient(entries, {
		summary: {
			timetableDisplaySlots: [
				{ startTime: '06:00', endTime: '06:45', isSpecialEvent: true, eventName: 'FLAG CEREMONY', dayOfWeek: 'MONDAY' },
				{ startTime: '06:00', endTime: '06:45' },
			],
		},
	});
	const buffer = await withDataContext(client, () => exportClassProgramWorkbook({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, client,
	}));
	const sheet = (await readWorkbook(buffer)).getWorksheet('Grade 7');
	assert.equal(cellText(sheet, 6, 3), 'FLAG CEREMONY', 'Monday shows the flag event');
	assert.match(cellText(sheet, 6, 4), /^Mathematics\nDela Cruz, Juan$/, 'Tuesday first period stays a teaching cell');
	assert.equal(cellText(sheet, 6, 5), '');
});

// ─── 4. Term-selected export never mixes terms ───

test('class-program workbook selects the matching term subject and teacher without mixing terms', { skip: exceljsSkip }, async () => {
	const entries: Entry[] = [
		{ entryId: 't1-math', sectionId: 701, subjectId: 11, facultyId: 501, roomId: 601, day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1 },
		{ entryId: 't2-sci', sectionId: 701, subjectId: 12, facultyId: 502, roomId: 602, day: 'MONDAY', startTime: '06:45', endTime: '07:30', durationMinutes: 45, termIndex: 2 },
	];
	const client = makeClient(entries);
	const termTwo = await withDataContext(client, () => exportClassProgramWorkbook({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, termIndex: 2, client,
	}));
	const sheet = (await readWorkbook(termTwo)).getWorksheet('Grade 7');
	assert.equal(cellText(sheet, 6, 3), '', 'term 1 class is absent from a term 2 export');
	assert.match(cellText(sheet, 7, 3), /^Science\nSantos, Maria$/, 'term 2 class is present');

	// Negative: a run without persisted term identity fails closed.
	await assert.rejects(
		() => withDataContext(client, () => exportClassProgramWorkbook({
			schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, termIndex: 2,
			client: makeClient(entries.map((entry) => ({ ...entry, termIndex: undefined }))),
		})),
		(error: unknown) => error instanceof Error && error.message === 'TERM_FILTER_NOT_READY',
	);
});

// ─── 5. HG/ARAL excluded; AP remains ───

test('class-program workbook excludes HG and ARAL cells while keeping AP', { skip: exceljsSkip }, async () => {
	const entries: Entry[] = [
		{ entryId: 'hg', sectionId: 701, subjectId: 99, facultyId: 501, roomId: 601, day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45 },
		{ entryId: 'aral', sectionId: 701, subjectId: 98, facultyId: 501, roomId: 601, day: 'TUESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45 },
		{ entryId: 'ap', sectionId: 701, subjectId: 13, facultyId: 501, roomId: 601, day: 'WEDNESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45 },
	];
	const client = makeClient(entries);
	const buffer = await withDataContext(client, () => exportClassProgramWorkbook({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, client,
	}));
	const sheet = (await readWorkbook(buffer)).getWorksheet('Grade 7');
	assert.equal(cellText(sheet, 6, 3), '', 'HG never becomes a cell');
	assert.equal(cellText(sheet, 6, 4), '', 'ARAL never becomes a cell');
	assert.match(cellText(sheet, 6, 5), /^Araling Panlipunan\n/, 'AP remains an ordinary subject');
});

// ─── 6. Real constructBaseline control for the day-scope gap ───

function baselineInput(overrides: Record<string, unknown> = {}) {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		sectionsByGrade: [{
			gradeLevelId: 1,
			gradeLevelName: 'Grade 7',
			displayOrder: 7,
			sections: [{
				id: 701, name: '7-Rizal', maxCapacity: 40, enrolledCount: 35,
				gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7,
				programType: 'REGULAR' as const,
			}],
		}],
		subjects: [{ id: 11, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 120, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7] }],
		faculty: [{ id: 501, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 501, subjectId: 11, gradeLevels: [7], sectionIds: [701] }],
		rooms: [{ id: 601, type: 'CLASSROOM' as const, isTeachingSpace: true, capacity: 40 }],
		preferences: [],
		policy: {
			periodLengthMinutes: 60,
			earliestStartTime: '06:00',
			latestEndTime: '08:00',
			maxConsecutiveTeachingMinutesBeforeBreak: 180,
			minBreakMinutesAfterConsecutiveBreak: 20,
			maxTeachingMinutesPerDay: 480,
			specialEvents: [{ eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony', startTime: '06:00', endTime: '07:00', enabled: true }],
		},
		...overrides,
	} as any;
}

test('constructBaseline rejects the Monday Flag interval while the identical Tuesday slot stays eligible', () => {
	const result = constructBaseline(baselineInput());
	const mondayFlag = result.entries.find((entry) => entry.day === 'MONDAY' && entry.startTime === '06:00' && entry.endTime === '07:00');
	assert.equal(mondayFlag, undefined, 'no class may be placed in the Monday flag interval');
	const tuesdayFirst = result.entries.find((entry) => entry.day === 'TUESDAY' && entry.startTime === '06:00' && entry.endTime === '07:00');
	assert.ok(tuesdayFirst, 'the identical Tuesday first-period slot remains eligible');
	// Failing-first control: without the day scope this same input placed Monday 06:00.
	const dayAgnostic = constructBaseline(baselineInput({ policy: { ...baselineInput().policy, specialEvents: [] } }));
	assert.ok(
		dayAgnostic.entries.some((entry) => entry.day === 'MONDAY' && entry.startTime === '06:00' && entry.endTime === '07:00'),
		'the old day-agnostic behavior would have used Monday 06:00',
	);
});

// ─── 7. Matrix preserves weekday cells and run/term binding ───

test('class-program matrix preserves weekday cells, binds the requested run/term, and has no stale-faculty fallback', async () => {
	const entries: Entry[] = [
		{ entryId: 'mon', sectionId: 701, subjectId: 11, facultyId: 501, roomId: 601, day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1 },
		{ entryId: 'tue', sectionId: 701, subjectId: 12, facultyId: 999, roomId: 602, day: 'TUESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1 },
	];
	const client = makeClient(entries, { runId: RUN_ID });
	const matrix = await withDataContext(client, () => generateClassProgramMatrix({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, gradeLevel: 7, runId: RUN_ID, termIndex: 1, client,
	}));
	assert.equal(matrix.sourceRunId, RUN_ID);
	const cells = matrix.columns[0].entries.filter((cell) => cell.timeSlot === '06:00-06:45');
	assert.deepEqual(cells.map((cell) => cell.day), ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
	assert.equal(cells[0].subject, 'Mathematics');
	assert.equal(cells[1].subject, 'Science');
	// A stale faculty reference (999) is shown as an unresolvable label, never a
	// silent fallback to another run.
	assert.equal(cells[1].teacher, null);

	await assert.rejects(
		() => withDataContext(client, () => generateClassProgramMatrix({
			schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, gradeLevel: 7, runId: 999, client,
		})),
		(error: unknown) => error instanceof Error && error.message === 'RUN_NOT_FOUND',
	);
});

// ─── 8. Persisted shift shapes drive morning/afternoon windows ───

test('persisted G7/G8 morning and G9/G10 afternoon shapes are consumed without cross-shift leakage', () => {
	const grade7Shape = buildTimetableShapeContract({
		gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '13:00',
		periodLengthMinutes: 45, periodsPerDay: 10,
		canonicalSlots: getExpectedCanonicalSlots(7, 'REGULAR').map((slot) => ({
			startTime: slot.startTime, endTime: slot.endTime, subjectFamily: slot.subjectFamily, subjectLabel: slot.subjectLabel, rowKind: slot.rowKind,
		})),
	});
	const grade9Shape = buildTimetableShapeContract({
		gradeLevel: 9, programType: 'REGULAR', startTime: '13:00', endTime: '18:30',
		periodLengthMinutes: 45, periodsPerDay: 8,
		canonicalSlots: getExpectedCanonicalSlots(9, 'REGULAR').map((slot) => ({
			startTime: slot.startTime, endTime: slot.endTime, subjectFamily: slot.subjectFamily, subjectLabel: slot.subjectLabel, rowKind: slot.rowKind,
		})),
	});

	const grade7ClassStarts = grade7Shape.periodSlots.map((slot) => slot.startTime);
	const grade9ClassStarts = grade9Shape.periodSlots.map((slot) => slot.startTime);
	assert.ok(grade7ClassStarts.includes('06:00'));
	assert.ok(grade9ClassStarts.includes('13:00'));
	assert.ok(grade7ClassStarts.every((time) => time < '12:15'), 'G7/G8 shape stays in the morning window');
	assert.ok(grade9ClassStarts.every((time) => time >= '13:00'), 'G9/G10 shape stays in the afternoon window');

	const result = constructBaseline(baselineInput({
		sectionsByGrade: [
			{
				gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7,
				sections: [{ id: 701, name: '7-A', maxCapacity: 40, enrolledCount: 35, gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' }],
			},
			{
				gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9,
				sections: [{ id: 901, name: '9-A', maxCapacity: 40, enrolledCount: 35, gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9, programType: 'REGULAR' }],
			},
		],
		subjects: [
			{ id: 11, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 9] },
		],
		facultySubjects: [{ facultyId: 501, subjectId: 11, gradeLevels: [7, 9], sectionIds: [701, 901] }],
		rooms: [{ id: 601, type: 'CLASSROOM', isTeachingSpace: true, capacity: 40 }],
		timetableShapes: [grade7Shape, grade9Shape],
		policy: { ...baselineInput().policy, specialEvents: [], earliestStartTime: '06:00', latestEndTime: '18:30' },
	}));

	const grade7Entries = result.entries.filter((entry) => entry.sectionId === 701);
	const grade9Entries = result.entries.filter((entry) => entry.sectionId === 901);
	assert.ok(grade7Entries.length > 0 && grade9Entries.length > 0, 'both shifts are placed');
	assert.ok(grade7Entries.every((entry) => entry.startTime < '12:15'), 'grade 7 never leaks into the afternoon shift');
	assert.ok(grade9Entries.every((entry) => entry.startTime >= '13:00'), 'grade 9 never leaks into the morning shift');
});
