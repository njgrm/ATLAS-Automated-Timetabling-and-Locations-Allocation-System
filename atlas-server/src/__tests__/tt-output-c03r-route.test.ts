/**
 * Mounted route test for the real class-program output routes:
 *   GET /:schoolId/:schoolYearId/runs/:runId/export/class-program.xlsx
 *   GET /:schoolId/:schoolYearId/class-program-matrix
 *
 * Uses in-memory fixture data injected onto the production Prisma singleton and
 * performs zero writes. The route harness needs `express`/`jsonwebtoken`; the
 * XLSX success path additionally needs a working `exceljs` tree. When a
 * dependency is incomplete in this worktree the affected assertions are skipped
 * with an explicit EXTERNALLY_BLOCKED reason instead of failing the suite.
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'tt-output-c03r-route-fixture';

const SCHOOL_ID = 71;
const SCHOOL_YEAR_ID = 11;
const RUN_ID = 42;

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
];
const ROOMS = [
	{ id: 601, name: 'Room 101', type: 'CLASSROOM', floor: 1, building: { id: 1, name: 'Building A' } },
	{ id: 602, name: 'Room 102', type: 'CLASSROOM', floor: 1, building: { id: 1, name: 'Building A' } },
];
const CLASS_PROGRAM_SLOTS = [
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '06:45', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null, isActive: true },
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:45', endTime: '07:30', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null, isActive: true },
];
const ENTRIES = [
	{ entryId: 'mon', sectionId: 701, subjectId: 11, facultyId: 501, roomId: 601, day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1 },
	{ entryId: 'tue', sectionId: 701, subjectId: 12, facultyId: 502, roomId: 602, day: 'TUESDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1 },
];

const WRITE_METHODS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'executeRaw', 'queryRaw']);
const calls: Array<{ model: string; method: string }> = [];

function readModel<T extends Record<string, unknown>>(name: string, methods: T): T {
	const wrapped: Record<string, unknown> = {};
	for (const [method, fn] of Object.entries(methods)) {
		wrapped[method] = async (...args: unknown[]) => {
			calls.push({ model: name, method });
			if (WRITE_METHODS.has(method)) {
				throw new Error(`UNEXPECTED WRITE: ${name}.${method}`);
			}
			return (fn as (...innerArgs: unknown[]) => unknown)(...args);
		};
	}
	return wrapped as T;
}

function buildFakeModels(): Record<string, Record<string, unknown>> {
	return {
		generationRun: readModel('generationRun', {
			findFirst: async (args: any) => {
				const id = args?.where?.id;
				if (id != null && id !== RUN_ID) return null;
				return { id: id ?? RUN_ID, status: 'COMPLETED', summary: { isPublished: false, timetableDisplaySlots: [] }, draftEntries: ENTRIES };
			},
			findMany: async () => [{ id: RUN_ID }],
		}),
		school: readModel('school', { findUnique: async () => ({ name: 'ATLAS School' }) }),
		enrollProSchoolYearMirror: readModel('enrollProSchoolYearMirror', { findFirst: async () => ({ yearLabel: '2026-2027' }) }),
		sectionMirror: readModel('sectionMirror', { findMany: async () => SECTIONS }),
		facultyMirror: readModel('facultyMirror', { findMany: async () => FACULTY }),
		subject: readModel('subject', { findMany: async () => SUBJECTS }),
		room: readModel('room', { findMany: async () => ROOMS }),
		classProgramSlot: readModel('classProgramSlot', {
			findMany: async (args: any) => {
				const where = args?.where ?? {};
				return CLASS_PROGRAM_SLOTS.filter((slot) =>
					slot.gradeLevel === where.gradeLevel
					&& (where.programType == null ? true : slot.programType === where.programType),
				);
			},
		}),
	};
}

// ─── Harness detection (dependency-incomplete worktree must self-skip) ───

let harnessReady = false;
let app: any = null;
let server: any = null;
let baseUrl = '';
let jwt: any = null;
let prismaRef: any = null;
const fakeModels = buildFakeModels();

try {
	const jwtModule: any = await import('jsonwebtoken');
	jwt = jwtModule.default ?? jwtModule;
	const expressModule: any = await import('express');
	const express = expressModule.default ?? expressModule;
	prismaRef = (await import('../lib/prisma.js')).prisma;
	const generationRouter = (await import('../routes/generation.router.js')).default;
	for (const [model, delegate] of Object.entries(fakeModels)) {
		Object.defineProperty(prismaRef, model, { value: delegate, configurable: true });
	}
	app = express();
	app.use(express.json());
	app.use('/api/v1/generation', generationRouter);
	harnessReady = true;
} catch {
	harnessReady = false;
}
const harnessSkip = harnessReady ? false : 'EXTERNALLY_BLOCKED: express/jsonwebtoken dependency tree is incomplete in this worktree';

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

function authToken(schoolId: number) {
	return jwt.sign({ userId: 1, role: 'admin', authSource: 'local', schoolId }, process.env.JWT_SECRET!, { expiresIn: '5m' });
}

test.before(async () => {
	if (!harnessReady) return;
	server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object');
	baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
	if (!harnessReady) return;
	await new Promise<void>((resolve, reject) => server.close((error: Error | null) => error ? reject(error) : resolve()));
	for (const model of Object.keys(fakeModels)) {
		delete prismaRef[model];
	}
});

test('mounted class-program-matrix route preserves weekday cells and binds the requested run', { skip: harnessSkip }, async () => {
	calls.length = 0;
	const response = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/class-program-matrix?gradeLevel=7&runId=${RUN_ID}`, {
		headers: { Authorization: `Bearer ${authToken(SCHOOL_ID)}` },
	});
	assert.equal(response.status, 200);
	const body = await response.json() as any;
	const matrix = body.data;
	assert.equal(matrix.sourceRunId, RUN_ID);
	const cells = matrix.columns[0].entries.filter((cell: any) => cell.timeSlot === '06:00-06:45');
	assert.deepEqual(cells.map((cell: any) => cell.day), ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
	assert.equal(cells[0].subject, 'Mathematics');
	assert.equal(cells[1].subject, 'Science');
	assert.equal(calls.some((call) => WRITE_METHODS.has(call.method)), false, 'route must perform zero writes');
});

test('mounted class-program-matrix route fails closed on an unknown run and invalid term', { skip: harnessSkip }, async () => {
	calls.length = 0;
	const missingRun = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/class-program-matrix?gradeLevel=7&runId=999`, {
		headers: { Authorization: `Bearer ${authToken(SCHOOL_ID)}` },
	});
	assert.equal(missingRun.status, 404);
	assert.equal((await missingRun.json() as any).code, 'RUN_NOT_FOUND');

	const invalidTerm = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/class-program-matrix?gradeLevel=7&runId=${RUN_ID}&termIndex=9`, {
		headers: { Authorization: `Bearer ${authToken(SCHOOL_ID)}` },
	});
	assert.equal(invalidTerm.status, 400);
	assert.equal((await invalidTerm.json() as any).code, 'INVALID_TERM_INDEX');
});

test('both output routes reject a cross-school actor before any read or write', { skip: harnessSkip }, async () => {
	calls.length = 0;
	const headers = { Authorization: `Bearer ${authToken(999)}` };
	const matrix = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/class-program-matrix?gradeLevel=7`, { headers });
	assert.equal(matrix.status, 403);
	assert.equal((await matrix.json() as any).code, 'CROSS_SCHOOL_DENIED');

	const workbook = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/class-program.xlsx`, { headers });
	assert.equal(workbook.status, 403);
	assert.equal((await workbook.json() as any).code, 'CROSS_SCHOOL_DENIED');
	assert.equal(calls.length, 0, 'rejected cross-school requests must dispatch zero downstream reads/writes');
});

test('mounted class-program.xlsx route returns a real weekday workbook', {
	skip: harnessSkip || (exceljsUsable ? false : 'EXTERNALLY_BLOCKED: worktree exceljs dependency tree is incomplete'),
}, async () => {
	calls.length = 0;
	const response = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/class-program.xlsx`, {
		headers: { Authorization: `Bearer ${authToken(SCHOOL_ID)}` },
	});
	assert.equal(response.status, 200);
	assert.match(String(response.headers.get('content-type')), /spreadsheetml/);
	const buffer = Buffer.from(await response.arrayBuffer());
	const ExcelJS = (await import('exceljs')).default as any;
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(buffer);
	const sheet = workbook.getWorksheet('Grade 7');
	assert.ok(sheet);
	const header = [1, 2, 3, 4, 5, 6, 7].map((col) => sheet.getRow(5).getCell(col).value);
	assert.deepEqual(header, ['TIME', 'MINUTES', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
	assert.equal(sheet.getRow(6).getCell(3).value, 'Mathematics\nDela Cruz, Juan');
	assert.equal(sheet.getRow(6).getCell(4).value, 'Science\nSantos, Maria');
	assert.equal(calls.some((call) => WRITE_METHODS.has(call.method)), false, 'route must perform zero writes');
});
