import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { exportPrintableProgramWorkbook } from '../services/workbook-export.service.js';
import { createSchedulerPrintZip, renderSchedulerPrintFiles } from '../services/scheduler-print.service.js';

const sections = Array.from({ length: 5 }, (_, index) => ({ id: 701 + index, externalId: 701 + index, name: `7-Section-${index + 1}`, gradeLevelId: 7, gradeLevelName: 'Grade 7' }));
const entries = sections.map((section, index) => ({
	entryId: `entry-${index}`, facultyId: index === 0 ? 501 : 502, roomId: index === 0 ? 601 : 602,
	subjectId: 11, sectionId: section.externalId, day: 'MONDAY', startTime: '07:30', endTime: '08:15', durationMinutes: 45, termIndex: 2,
}));
let writes = 0;
let roomScopeFilter: unknown;
const client = {
	generationRun: { findFirst: async () => ({ id: 42, status: 'COMPLETED', summary: { timetableDisplaySlots: [] }, draftEntries: entries }) },
	school: { findUnique: async () => ({ name: 'ATLAS School' }) },
	enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: '2026-2027' }) },
	sectionMirror: { findMany: async () => sections },
	facultyMirror: { findMany: async () => [
		{ id: 501, firstName: 'Ari', lastName: 'Teacher', advisedSectionId: null },
		{ id: 502, firstName: 'Bea', lastName: 'Teacher', advisedSectionId: null },
	] },
	subject: { findMany: async () => [{ id: 11, name: 'Mathematics', code: 'MATH' }] },
	room: { findMany: async (query: any) => {
		roomScopeFilter = query.where.building;
		return [
		{ id: 601, name: 'Room 1', type: 'CLASSROOM', floor: null, building: { id: 1, name: 'Building A' } },
		{ id: 602, name: 'Room 2', type: 'CLASSROOM', floor: null, building: { id: 1, name: 'Building A' } },
		];
	} },
	create: async () => { writes += 1; throw new Error('export must not write'); },
	update: async () => { writes += 1; throw new Error('export must not write'); },
	delete: async () => { writes += 1; throw new Error('export must not write'); },
};
const base = { schoolId: 71, schoolYearId: 11, runId: 42, termIndex: 2, client };

async function saveFixtureForVisualQA(filename: string, bytes: Buffer) {
	const renderDir = process.env.ATLAS_EXPORT_RENDER_DIR;
	if (!renderDir) return;
	if (!isAbsolute(renderDir)) throw new Error('ATLAS_EXPORT_RENDER_DIR must be an absolute directory path.');
	await mkdir(renderDir, { recursive: true });
	await writeFile(join(renderDir, filename), bytes);
}

test('editable grade workbook pages contain at most four section columns and one selected-term grade', async () => {
	const bytes = await exportPrintableProgramWorkbook(base, 'grade', 7);
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(bytes as any);
	assert.equal(workbook.worksheets.length, 2, 'five sections require two sheets');
	assert.deepEqual(workbook.worksheets.map((sheet) => sheet.getRow(9).cellCount), [5, 2], 'each sheet has TIME plus at most four section columns');
	assert.equal(workbook.worksheets[0].pageSetup.orientation, 'landscape');
	assert.match(String(workbook.worksheets[0].getRow(9).getCell(2).value), /7-Section-1/);
	assert.match(String(workbook.worksheets[0].getRow(10).getCell(2).value), /Mathematics/);
	assert.match(String(workbook.worksheets[0].getRow(6).getCell(1).value), /Term: T2.*NOT PUBLISHED/);
	assert.deepEqual(roomScopeFilter, { schoolId: 71 }, 'room identity resolution is school-scoped');
});

test('teacher and room Excel programs are individual weekday forms, not consolidated monitoring sheets', async () => {
	const teacher = new ExcelJS.Workbook();
	const teacherBytes = await exportPrintableProgramWorkbook(base, 'teacher', 501);
	await teacher.xlsx.load(teacherBytes as any);
	const teacherText = teacher.worksheets[0].getSheetValues().flat().filter(Boolean).join(' ');
	assert.match(teacherText, /7-Section-1/);
	assert.doesNotMatch(teacherText, /7-Section-2/);
	assert.match(teacherText, /Building A \/ Room 1/);
	assert.match(teacherText, /MONDAY/);

	const room = new ExcelJS.Workbook();
	const roomBytes = await exportPrintableProgramWorkbook(base, 'room', 601);
	await room.xlsx.load(roomBytes as any);
	const roomText = room.worksheets[0].getSheetValues().flat().filter(Boolean).join(' ');
	assert.match(roomText, /7-Section-1/);
	assert.doesNotMatch(roomText, /7-Section-2/);
	assert.match(roomText, /Ari Teacher/);
	assert.match(roomText, /FRIDAY/);
	const sectionBytes = await exportPrintableProgramWorkbook(base, 'section', 701);
	const section = new ExcelJS.Workbook();
	await section.xlsx.load(sectionBytes as any);
	assert.equal(section.worksheets[0].getRow(6).getCell(1).alignment?.wrapText, true);
});

test('multi-file Excel ZIP names the editable workbook files and invalid scopes render zero entries and write nothing', async () => {
	const files = await renderSchedulerPrintFiles(base, 'room', [601, 602], 'xlsx');
	assert.deepEqual(files.map((file) => file.filename), [
		'room-program-601-SY2026-2027-term2.xlsx',
		'room-program-602-SY2026-2027-term2.xlsx',
	]);
	const archive = await JSZip.loadAsync(await createSchedulerPrintZip(files));
	assert.deepEqual(Object.keys(archive.files).filter((name) => !archive.files[name].dir).sort(), files.map((file) => file.filename).sort());
	const first = await archive.file(files[0].filename)!.async('nodebuffer');
	const firstBook = new ExcelJS.Workbook();
	await firstBook.xlsx.load(first as any);
	assert.match(firstBook.worksheets[0].name, /room/i, 'ZIP entry is an actual editable Excel workbook');
	const invalid = { ...base, workbookFactory: () => { writes += 100; return new ExcelJS.Workbook(); } };
	await assert.rejects(() => renderSchedulerPrintFiles(invalid, 'room', [601, 999], 'xlsx'), /PRINT_ENTITY_NOT_FOUND/);
	await assert.rejects(() => renderSchedulerPrintFiles(invalid, 'room', [601, 601], 'xlsx'), /DUPLICATE_PRINT_ENTITY/);
	assert.equal(writes, 0, 'render validation and package generation dispatch no writes');
});

test('explicit fixture render hook emits all four deterministic production-service workbooks', async () => {
	const fixtures = [
		['grade-g7-5-sections.xlsx', await exportPrintableProgramWorkbook(base, 'grade', 7)],
		['section-701.xlsx', await exportPrintableProgramWorkbook(base, 'section', 701)],
		['teacher-501.xlsx', await exportPrintableProgramWorkbook(base, 'teacher', 501)],
		['room-601.xlsx', await exportPrintableProgramWorkbook(base, 'room', 601)],
	] as const;
	for (const [filename, bytes] of fixtures) await saveFixtureForVisualQA(filename, bytes);

	const renderDir = process.env.ATLAS_EXPORT_RENDER_DIR;
	if (renderDir) {
		assert.ok(isAbsolute(renderDir), 'visual QA output directory is explicit and absolute');
		const filenames = await readdir(renderDir);
		for (const [filename] of fixtures) assert.ok(filenames.includes(filename), `render hook emits ${filename}`);
	}
});
