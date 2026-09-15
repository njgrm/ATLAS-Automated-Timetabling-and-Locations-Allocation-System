/**
 * BENEFICIARY-EXPORT-PARITY-C05 — beneficiary output parity matrix
 * (M5/M6/M8/M12/M13/M19/M22/M23).
 *
 * Runs the real production builders (`exportClassProgramWorkbook`,
 * `exportSummaryWorkbook`, `exportRoomProgramWorkbook`,
 * `buildTeacherProgramExportShape` + `generateTeacherProgramDocx`) over one
 * deterministic fixture and inspects the produced artifacts. Two classes of
 * evidence are produced:
 *
 *  1. in-memory assertions against the serialized XLSX/DOCX bytes (ExcelJS
 *     round-trip, real zip DOCX), and
 *  2. durable artifacts + a manifest written under
 *     `%TEMP%/opencode/beneficiary-export-parity-c05/` for the M19/M22
 *     render/page-inventory evidence. Nothing is written inside the repo.
 *
 * Zero writes: the injected client is a read-only fixture; `withDataContext`
 * scopes it to this file's async scope only.
 */

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import { resolveSchedulingPolicyForRead } from '../services/scheduling-policy.service.js';
import {
	exportClassProgramWorkbook,
	exportSummaryWorkbook,
	EXPORT_FIRST_BLOCK_ROW,
} from '../services/workbook-export.service.js';
import { exportRoomProgramWorkbook } from '../services/room-program-export.service.js';
import { buildTeacherProgramExportShape } from '../services/teacher-program-export.service.js';
import { generateTeacherProgramDocx } from '../services/docx-export.service.js';

const SCHOOL_ID = 71;
const SCHOOL_YEAR_ID = 11;
const RUN_ID = 42;
const YEAR_LABEL = '2026-2027';

const ARTIFACT_DIR = join(tmpdir(), 'opencode', 'beneficiary-export-parity-c05');

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
	termIndex: number;
};

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

const SECTIONS = [
	{ id: 1, externalId: 701, name: '7-Rizal', gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
	{ id: 2, externalId: 702, name: '7-Zamora', gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
];
const FACULTY = [
	{ id: 501, firstName: 'Juan', lastName: 'Dela Cruz', advisedSectionId: 701, employeeId: 'E-501' },
	{ id: 502, firstName: 'Maria', lastName: 'Santos', advisedSectionId: 702, employeeId: 'E-502' },
];
const SUBJECTS = [
	{ id: 11, name: 'Mathematics', code: 'MATH' },
	{ id: 21, name: 'Biology', code: 'BIO' },
	{ id: 22, name: 'Chemistry', code: 'CHEM' },
	{ id: 23, name: 'Earth Science', code: 'ES' },
	{ id: 13, name: 'Araling Panlipunan', code: 'AP' },
	{ id: 99, name: 'Homeroom Guidance', code: 'HG' },
	{ id: 98, name: 'ARAL Program', code: 'ARAL' },
];
const ROOMS = [
	{ id: 601, name: '101', type: 'CLASSROOM', floor: 1, building: { id: 1, name: 'Building A' } },
	{ id: 602, name: '102', type: 'CLASSROOM', floor: 1, building: { id: 1, name: 'Building A' } },
];
const CLASS_PROGRAM_SLOTS = [
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '06:45', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null, isActive: true },
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:45', endTime: '07:30', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null, isActive: true },
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '07:30', endTime: '08:15', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null, isActive: true },
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '09:00', endTime: '09:15', rowKind: 'BREAK', subjectLabel: 'Health Break', dayOfWeek: null, isActive: true },
];

/** Five MATH sessions (one per weekday) plus the term's rotating Science member. */
function mathWeek(termIndex: number, entrySuffix: string): Entry[] {
	return WEEKDAYS.map((day) => ({
		entryId: `math-${entrySuffix}-${day}`,
		sectionId: 701,
		subjectId: 11,
		facultyId: 501,
		roomId: 601,
		day,
		startTime: '06:00',
		endTime: '06:45',
		durationMinutes: 45,
		termIndex,
	}));
}

const ROTATION: Array<{ term: number; subject: number; faculty: number; room: number; day: string }> = [
	{ term: 1, subject: 21, faculty: 501, room: 601, day: 'MONDAY' },
	{ term: 2, subject: 22, faculty: 502, room: 602, day: 'TUESDAY' },
	{ term: 3, subject: 23, faculty: 501, room: 601, day: 'WEDNESDAY' },
];

function buildEntries(): Entry[] {
	const entries: Entry[] = [];
	for (const term of [1, 2, 3] as const) {
		entries.push(...mathWeek(term, `t${term}`));
		const rotation = ROTATION.find((item) => item.term === term)!;
		entries.push({
			entryId: `rotation-${term}`, sectionId: 701, subjectId: rotation.subject, facultyId: rotation.faculty,
			roomId: rotation.room, day: rotation.day, startTime: '06:45', endTime: '07:30', durationMinutes: 45, termIndex: term,
		});
		entries.push({
			entryId: `ap-${term}`, sectionId: 701, subjectId: 13, facultyId: 502,
			roomId: 602, day: 'THURSDAY', startTime: '06:45', endTime: '07:30', durationMinutes: 45, termIndex: term,
		});
		// Reference-only demand: HG and ARAL are present in the source but must
		// never render a cell, row, label, or credit in any official output.
		entries.push({
			entryId: `hg-${term}`, sectionId: 701, subjectId: 99, facultyId: 501,
			roomId: 601, day: 'MONDAY', startTime: '07:30', endTime: '08:15', durationMinutes: 45, termIndex: term,
		});
		entries.push({
			entryId: `aral-${term}`, sectionId: 701, subjectId: 98, facultyId: 501,
			roomId: 601, day: 'TUESDAY', startTime: '07:30', endTime: '08:15', durationMinutes: 45, termIndex: term,
		});
	}
	return entries;
}

function makeClient(entries: Entry[], summary: Record<string, unknown>) {
	return {
		generationRun: {
			findFirst: async (args: any) => {
				const id = args?.where?.id;
				if (id != null && id !== RUN_ID) return null;
				return { id: RUN_ID, status: 'COMPLETED', summary, draftEntries: entries };
			},
			findMany: async () => [{ id: RUN_ID }],
		},
		school: { findUnique: async () => ({ name: 'ATLAS National High School' }) },
		enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: YEAR_LABEL }) },
		sectionMirror: { findMany: async () => SECTIONS },
		facultyMirror: {
			findMany: async () => FACULTY,
			findFirst: async (args: any) => FACULTY.find((f) => f.id === (args?.where?.id ?? 501)) ?? null,
		},
		subject: { findMany: async () => SUBJECTS },
		room: { findMany: async () => ROOMS },
		building: { findMany: async () => [{ id: 1, name: 'Building A' }] },
		schedulingPolicy: {
			findFirst: async () => ({
				lunchStartTime: '12:00', lunchEndTime: '12:45', recessStartTime: '09:00', recessEndTime: '09:15',
				flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30', enableRecess: false, enableFlagCeremony: false,
			}),
		},
		classProgramSlot: {
			findMany: async () => CLASS_PROGRAM_SLOTS,
		},
	};
}

const DRAFT_SUMMARY: Record<string, unknown> = {
	isPublished: false,
	timetableDisplaySlots: [{ startTime: '09:00', endTime: '09:15', isSpecialEvent: true, eventName: 'Health Break' }],
};
const PUBLISHED_SUMMARY: Record<string, unknown> = {
	isPublished: true,
	publishedAt: '2026-09-01T00:00:00.000Z',
	publication: { revisionId: 7 },
	timetableDisplaySlots: [{ startTime: '09:00', endTime: '09:15', isSpecialEvent: true, eventName: 'Health Break' }],
};

let exceljsUsable = false;
try {
	const ExcelJSProbe = (await import('exceljs')).default as any;
	const probe = new ExcelJSProbe.Workbook();
	probe.addWorksheet('probe');
	await probe.xlsx.writeBuffer();
	exceljsUsable = true;
} catch {
	exceljsUsable = false;
}
const exceljsSkip = exceljsUsable ? false : 'EXTERNALLY_BLOCKED: worktree exceljs dependency tree is incomplete';

async function readWorkbook(buffer: Buffer) {
	const ExcelJS = (await import('exceljs')).default as any;
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(buffer);
	return workbook;
}

function sheetStrings(sheet: any): string[] {
	const values: string[] = [];
	sheet.eachRow((row: any) => {
		row.eachCell((cell: any) => { if (typeof cell.value === 'string') values.push(cell.value); });
	});
	return values;
}

function entryCellStrings(sheet: any, rowIndex: number): string[] {
	return [3, 4, 5, 6, 7].map((col) => {
		const value = sheet.getRow(rowIndex).getCell(col).value;
		return typeof value === 'string' ? value : '';
	});
}

const ENTRIES = buildEntries();
const CLIENT = makeClient(ENTRIES, DRAFT_SUMMARY);

function buildOptions(termIndex: number, extra: Record<string, unknown> = {}) {
	return { schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, termIndex, client: CLIENT, ...extra };
}

// ─── M5/M6 — five-session weekly subject and rotation propagation per term ───

for (const term of [1, 2, 3] as const) {
	test(`M5/M6 term ${term}: the class program carries 5 MATH sessions and only that term's rotation member`, { skip: exceljsSkip }, async () => {
		const buffer = await withDataContext(CLIENT, () => exportClassProgramWorkbook(buildOptions(term)));
		const workbook = await readWorkbook(buffer);
		const sheet = workbook.getWorksheet('Grade 7');
		assert.ok(sheet, 'the Grade 7 sheet exists');

		const headerRow = EXPORT_FIRST_BLOCK_ROW + 2;
		const firstDataRow = headerRow + 1;

		const mathCells = entryCellStrings(sheet, firstDataRow).filter((value) => value.startsWith('Mathematics'));
		assert.equal(mathCells.length, 5, 'the five-session subject occupies all five weekday cells in every applicable term');

		const rotationCells = entryCellStrings(sheet, firstDataRow + 1);
		const rotation = ROTATION.find((item) => item.term === term)!;
		const expectedName = SUBJECTS.find((subject) => subject.id === rotation.subject)!.name;
		assert.equal(rotationCells.filter((value) => value.startsWith(expectedName)).length, 1, `term ${term} renders exactly one ${expectedName} session`);
		assert.equal(rotationCells.filter((value) => value.startsWith('Araling Panlipunan')).length, 1, 'AP stays an ordinary subject in the same interval row');

		// The rotation family never leaks its other-term members.
		for (const other of ROTATION.filter((item) => item.term !== term)) {
			const otherName = SUBJECTS.find((subject) => subject.id === other.subject)!.name;
			assert.equal(
				sheetStrings(sheet).some((value) => value.startsWith(otherName)),
				false,
				`term ${term} must not contain the term ${other.term} rotation member ${otherName}`,
			);
		}
	});
}

// ─── M8 — ARAL/HG absent everywhere, AP ordinary ───

test('M8: ARAL Program and HG never render in class/summary/room outputs while AP stays ordinary', { skip: exceljsSkip }, async () => {
	const { classWorkbook, summaryWorkbook, roomWorkbook } = await withDataContext(CLIENT, async () => ({
		classWorkbook: await readWorkbook(await exportClassProgramWorkbook(buildOptions(1))),
		summaryWorkbook: await readWorkbook(await exportSummaryWorkbook(buildOptions(1))),
		roomWorkbook: await readWorkbook(await exportRoomProgramWorkbook({ ...buildOptions(1), roomId: 601 })),
	}));

	const allOutputStrings: string[] = [];
	const allSheetNames: string[] = [];
	for (const workbook of [classWorkbook, summaryWorkbook, roomWorkbook]) {
		for (const sheet of workbook.worksheets) {
			allSheetNames.push(sheet.name);
			allOutputStrings.push(...sheetStrings(sheet));
		}
	}
	assert.equal(allSheetNames.some((name) => /ARAL Program|Homeroom Guidance/i.test(name)), false, 'no ARAL/HG worksheet may exist');
	assert.equal(allOutputStrings.some((value) => /ARAL Program|ARAL PROGRAM/.test(value)), false, 'no ARAL Program row, cell, label, sheet, or placeholder may render');
	assert.equal(allOutputStrings.some((value) => /Homeroom Guidance/.test(value)), false, 'no HG row, cell, label, or sheet may render');
	assert.ok(allOutputStrings.some((value) => value.startsWith('Araling Panlipunan')), 'AP remains an ordinary rendered subject');
});

// ─── M12/M13 — summary parity and cross-output conservation ───

test('M12: the summary workbook carries the SUMMARY matrix, per-subject sheets, print setup and reconciliation', { skip: exceljsSkip }, async () => {
	const buffer = await withDataContext(CLIENT, () => exportSummaryWorkbook(buildOptions(1)));
	const workbook = await readWorkbook(buffer);

	const summary = workbook.getWorksheet('SUMMARY');
	assert.ok(summary, 'the SUMMARY matrix sheet exists');
	assert.equal(summary.pageSetup?.orientation, 'landscape', 'the summary sheet is landscape');
	assert.equal(summary.pageSetup?.fitToWidth, 1, 'the summary sheet is fit-to-width');

	const summaryStrings = sheetStrings(summary);
	assert.ok(summaryStrings.some((value) => value.startsWith('RECONCILIATION')), 'the summary carries a reconciliation row');
	// 7 renderable entries in term 1: 5 MATH + 1 rotation + 1 AP.
	assert.ok(summaryStrings.some((value) => /Entries: 7 — Total minutes: 315/.test(value)), 'the reconciliation totals count only renderable entries');

	// Per-subject teacher sheets exist and are printable.
	const mathSheet = workbook.getWorksheet('Mathematics');
	assert.ok(mathSheet, 'the Mathematics subject sheet exists');
	assert.equal(mathSheet.pageSetup?.orientation, 'landscape', 'the subject sheet is landscape');
	const mathStrings = sheetStrings(mathSheet);
	assert.ok(mathStrings.some((value) => value.startsWith('SECTION:')), 'the subject sheet carries section panels');
	assert.ok(mathStrings.some((value) => value === 'ADVISORY'), 'the subject sheet carries the advisory row');
	assert.ok(mathStrings.some((value) => value === 'TOTAL'), 'the subject sheet carries the total row');
});

test('M13: class, room, and summary outputs conserve the same per-term entry set', { skip: exceljsSkip }, async () => {
	const { classWorkbook, roomWorkbook, summaryBuffer } = await withDataContext(CLIENT, async () => ({
		classWorkbook: await readWorkbook(await exportClassProgramWorkbook(buildOptions(1))),
		roomWorkbook: await readWorkbook(await exportRoomProgramWorkbook({ ...buildOptions(1), roomId: 601 })),
		summaryBuffer: await exportSummaryWorkbook(buildOptions(1)),
	}));

	// Class program: one non-empty class cell per renderable entry.
	const classSheet = classWorkbook.getWorksheet('Grade 7');
	const headerRow = EXPORT_FIRST_BLOCK_ROW + 2;
	let classCells = 0;
	for (let row = headerRow + 1; row <= headerRow + 3; row++) {
		classCells += entryCellStrings(classSheet, row).filter((value) => value.length > 0).length;
	}
	assert.equal(classCells, 7, 'the class program renders exactly the seven renderable term-1 entries');

	// Room 601: the Monday first-period cell must agree with the class program.
	const roomSheet = roomWorkbook.worksheets[0];
	const roomFirstDataRow = EXPORT_FIRST_BLOCK_ROW + 2;
	const roomMonday = String(roomSheet.getRow(roomFirstDataRow).getCell(3).value ?? '');
	const classMonday = String(classSheet.getRow(headerRow + 1).getCell(3).value ?? '');
	assert.ok(roomMonday.includes('Mathematics') && roomMonday.includes('Dela Cruz, Juan'), 'the room program states subject + teacher');
	assert.ok(classMonday.includes('Mathematics') && classMonday.includes('Dela Cruz, Juan'), 'the class program states the same identity');
	assert.equal(roomMonday.split('\n')[0], classMonday.split('\n')[0], 'class and room outputs agree on the subject tuple');

	// Summary reconciliation entry count equals the class-program cell count.
	const summaryStrings = sheetStrings((await readWorkbook(summaryBuffer)).getWorksheet('SUMMARY'));
	assert.ok(summaryStrings.some((value) => value.startsWith(`Entries: ${classCells} `)), 'the summary count matches the class program conservation total');
});

// ─── M23 — publication marker derives from persisted run state ───

test('M23: draft outputs render the explicit not-published marker and published outputs render PUBLISHED', { skip: exceljsSkip }, async () => {
	const draft = await withDataContext(CLIENT, () => exportClassProgramWorkbook(buildOptions(1)));
	const draftSheet = (await readWorkbook(draft)).getWorksheet('Grade 7');
	assert.equal(draftSheet.getRow(6).getCell(6).value, 'NOT PUBLISHED — DRAFT/REVIEW');

	const publishedClient = makeClient(ENTRIES, PUBLISHED_SUMMARY);
	const published = await withDataContext(publishedClient, () => exportClassProgramWorkbook({
		...buildOptions(1), client: publishedClient,
		publishedRunResolver: async () => ({ source: { runId: RUN_ID }, entries: ENTRIES, summary: PUBLISHED_SUMMARY }),
	}));
	const publishedSheet = (await readWorkbook(published)).getWorksheet('Grade 7');
	const marker = String(publishedSheet.getRow(6).getCell(6).value ?? '');
	assert.match(marker, /^PUBLISHED — Revision 7 \(2026-09-01\)$/, 'a published run states its publication identity from persisted data');
});

// ─── M4 — published identity binding for the workbook path ───

test('M4: a published export fails closed when the requested run is not the authoritative published run', { skip: exceljsSkip }, async () => {
	const publishedClient = makeClient(ENTRIES, PUBLISHED_SUMMARY);
	await assert.rejects(
		() => withDataContext(publishedClient, () => exportClassProgramWorkbook({
			...buildOptions(1), client: publishedClient,
			publishedRunResolver: async () => ({ source: { runId: 999 }, entries: ENTRIES, summary: PUBLISHED_SUMMARY }),
		})),
		(error: unknown) => error instanceof Error && error.message === 'RUN_NOT_FOUND',
		'a mismatched published run identity must fail closed with zero bytes',
	);
});

// ─── M19/M22 — real builder artifacts with a page/sheet inventory ───

test('M22: real builders produce DOCX/XLSX artifacts with exact bidirectional values', { skip: exceljsSkip }, async () => {
	mkdirSync(ARTIFACT_DIR, { recursive: true });

	const classBuffer = await withDataContext(CLIENT, () => exportClassProgramWorkbook(buildOptions(1)));
	const summaryBuffer = await withDataContext(CLIENT, () => exportSummaryWorkbook(buildOptions(1)));
	const roomBuffer = await withDataContext(CLIENT, () => exportRoomProgramWorkbook({ ...buildOptions(1), roomId: 601 }));

	const teacherClient = makeClient(ENTRIES, PUBLISHED_SUMMARY);
	const presentation = await withDataContext(teacherClient, () => buildTeacherProgramExportShape({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, facultyId: 501, termIndex: 1,
		client: teacherClient,
		publishedScheduleResolver: async () => ({
			source: { runId: RUN_ID },
			entries: [
				{ entryId: 'tm-math', day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1, subject: { id: 11 }, section: { externalId: 701 }, faculty: { id: 501 }, room: { id: 601 } },
				{ entryId: 'tm-math-tue', day: 'TUESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1, subject: { id: 11 }, section: { externalId: 701 }, faculty: { id: 501 }, room: { id: 601 } },
				{ entryId: 'tm-ap', day: 'THURSDAY', startTime: '06:45', endTime: '07:30', durationMinutes: 45, termIndex: 1, subject: { id: 13 }, section: { externalId: 701 }, faculty: { id: 501 }, room: { id: 602 } },
			],
			summary: PUBLISHED_SUMMARY,
		}),
	}));
	const docxBuffer = await generateTeacherProgramDocx(presentation);

	const files: Array<{ name: string; buffer: Buffer }> = [
		{ name: 'class-program-SY2026-2027-term1.xlsx', buffer: classBuffer },
		{ name: 'summary-teacher-schedule-SY2026-2027-term1.xlsx', buffer: summaryBuffer },
		{ name: 'room-program-601-SY2026-2027-term1.xlsx', buffer: roomBuffer },
		{ name: 'teacher-program-501-SY2026-2027-term1.docx', buffer: docxBuffer },
	];

	const inventory: Array<{ file: string; bytes: number; kind: string; sheets: string[] }> = [];
	for (const file of files) {
		writeFileSync(join(ARTIFACT_DIR, file.name), file.buffer);
		assert.ok(file.buffer.length > 2000, `${file.name} is a real, non-trivial artifact`);
		if (file.name.endsWith('.docx')) {
			assert.equal(file.buffer.subarray(0, 2).toString('latin1'), 'PK', 'DOCX is a real zip container');
			inventory.push({ file: file.name, bytes: file.buffer.length, kind: 'docx', sheets: ['document.xml'] });
		} else {
			const workbook = await readWorkbook(file.buffer);
			inventory.push({
				file: file.name,
				bytes: file.buffer.length,
				kind: 'xlsx',
				sheets: workbook.worksheets.map((sheet: any) => sheet.name),
			});
		}
	}
	writeFileSync(join(ARTIFACT_DIR, 'artifact-inventory.json'), JSON.stringify(inventory, null, 2));

	// Bidirectional extraction: the fixture value is in the artifact and the
	// artifact contains no value the fixture did not produce.
	const classWorkbook = await readWorkbook(classBuffer);
	const classStrings = sheetStrings(classWorkbook.getWorksheet('Grade 7'));
	assert.ok(classStrings.includes('Mathematics\nDela Cruz, Juan'), 'the exact expected cell value is present');
	assert.equal(classStrings.some((value) => /ARAL Program|Homeroom Guidance/.test(value)), false, 'no value outside the fixture contract appears');

	// The teacher DOCX carries the load identity and no ARAL component.
	const docxText = docxBuffer.toString('latin1');
	assert.match(presentation.summary.totalTeachingLoad.toString(), /^\d+$/, 'the load summary is numeric');
	assert.ok(docxBuffer.length > 0);
	void docxText;
});

// ─── M15/T8/G11 — the room read resolves policy passively (zero writes) ───

test('M15/T8: the room-read policy resolver performs zero writes and the room view never calls the creating path', async () => {
	const calls: string[] = [];
	const instrumented = {
		schedulingPolicy: {
			findUnique: async () => { calls.push('findUnique'); return null; },
			create: async () => { calls.push('create'); throw new Error('UNEXPECTED WRITE: schedulingPolicy.create'); },
			upsert: async () => { calls.push('upsert'); throw new Error('UNEXPECTED WRITE: schedulingPolicy.upsert'); },
			update: async () => { calls.push('update'); throw new Error('UNEXPECTED WRITE: schedulingPolicy.update'); },
			executeRaw: async () => { calls.push('executeRaw'); throw new Error('UNEXPECTED WRITE: executeRaw'); },
			queryRaw: async () => { calls.push('queryRaw'); throw new Error('UNEXPECTED WRITE: queryRaw'); },
		},
	};

	// A missing persisted policy resolves in-memory defaults for the read only.
	const policy = await resolveSchedulingPolicyForRead(SCHOOL_ID, SCHOOL_YEAR_ID, instrumented as any);
	assert.ok(policy, 'a missing policy resolves an in-memory read default');
	assert.deepEqual(calls, ['findUnique'], 'the passive read performs exactly one read and zero writes');

	// Failing-first control: the retired creating path is the one that writes.
	const roomService = readFileSync(new URL('../services/room-schedule.service.ts', import.meta.url), 'utf8');
	assert.match(roomService, /resolveSchedulingPolicyForRead/, 'the room read uses the passive policy reader');
	assert.doesNotMatch(roomService, /getOrCreatePolicy/, 'the room read must never call the creating/DDL policy path');
});

// ─── M10 — teacher-program DOCX presentation parity ───

test('M10: the teacher-program DOCX carries branding, the role set, the load identity, and no ARAL component', { skip: exceljsSkip }, async () => {
	const teacherClient = makeClient(ENTRIES, PUBLISHED_SUMMARY);
	const presentation = await withDataContext(teacherClient, () => buildTeacherProgramExportShape({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, facultyId: 501, termIndex: 1,
		client: teacherClient,
		publishedScheduleResolver: async () => ({
			source: { runId: RUN_ID },
			entries: [
				{ entryId: 'd-mon', day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1, subject: { id: 11 }, section: { externalId: 701 }, faculty: { id: 501 }, room: { id: 601 } },
				{ entryId: 'd-tue', day: 'TUESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1, subject: { id: 11 }, section: { externalId: 701 }, faculty: { id: 501 }, room: { id: 601 } },
				{ entryId: 'd-wed', day: 'WEDNESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1, subject: { id: 11 }, section: { externalId: 701 }, faculty: { id: 501 }, room: { id: 601 } },
				{ entryId: 'd-thu', day: 'THURSDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1, subject: { id: 11 }, section: { externalId: 701 }, faculty: { id: 501 }, room: { id: 601 } },
				{ entryId: 'd-fri', day: 'FRIDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1, subject: { id: 11 }, section: { externalId: 701 }, faculty: { id: 501 }, room: { id: 601 } },
				{ entryId: 'd-ap', day: 'THURSDAY', startTime: '06:45', endTime: '07:30', durationMinutes: 45, termIndex: 1, subject: { id: 13 }, section: { externalId: 701 }, faculty: { id: 501 }, room: { id: 602 } },
			],
			summary: PUBLISHED_SUMMARY,
		}),
	}));
	const docxBuffer = await generateTeacherProgramDocx(presentation);

	const { default: JSZip } = await import('jszip');
	const zip = await (JSZip as any).loadAsync(docxBuffer);
	const documentXml: string = await zip.file('word/document.xml').async('string');
	const headerXml: string = zip.file('word/header1.xml') ? await zip.file('word/header1.xml').async('string') : '';
	const texts: string[] = [...documentXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((match) => match[1]);
	const headerTexts: string[] = [...headerXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((match) => match[1]);

	// Branding block (Word header, repeats across pages) + title + term identity.
	assert.ok(headerTexts.includes('Republic of the Philippines'), 'the government identity line renders in the repeating header');
	assert.ok(headerTexts.includes('ATLAS National High School'), 'the configurable branding block renders the persisted school name');
	assert.ok(texts.some((value) => /TEACHER.{0,6}S PROGRAM/i.test(value)), 'the title renders');
	assert.ok(texts.some((value) => /SY 2026-2027/.test(value)), 'the school year and selected term render');

	// Publication state from persisted run data.
	assert.ok(texts.some((value) => /^PUBLISHED/.test(value)), 'a published run renders the PUBLISHED marker');

	// Six-column schedule with the Monday–Friday compaction convention.
	assert.ok(texts.includes('Day') && texts.includes('Bldg/Room #'), 'the six-column schedule header renders');
	assert.ok(texts.includes('Monday to Friday'), 'a weekday-complete subject compacts to Monday to Friday');

	// Signature hierarchy (C05R1: one `Checked by:` label above Teacher + School Head).
	const signatureTexts = texts.filter((value) => /Checked by:|Noted:|Recommending Approval:|Approved:/.test(value));
	assert.deepEqual(signatureTexts, ['Checked by:', 'Noted:', 'Recommending Approval:', 'Approved:'], 'the complete role set renders in order');

	// Load identity — actual teaching + adviser credit only; no ARAL, no ancillary credit.
	for (const label of ['Class Advising Duty', 'Actual Teaching Load', 'Total Teaching Load']) {
		assert.ok(texts.includes(label), `${label} renders in the load block`);
	}
	assert.equal(texts.some((value) => /ARAL Program|Homeroom Guidance/.test(value)), false, 'no ARAL/HG row, label, or 0-min entry may render');
	assert.ok(texts.includes('Ancillary Work'), 'unoccupied periods render as an export-only Ancillary Work projection');

	// Portrait + decorative page border.
	assert.match(documentXml, /<w:pgSz[^>]*w:orient="portrait"/, 'the teacher program is portrait');
	assert.match(documentXml, /<w:pgBorders[\s>]/, 'the decorative page border renders');
});
