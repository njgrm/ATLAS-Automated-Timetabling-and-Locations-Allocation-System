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
	{
		id: 501, firstName: 'Juan', lastName: 'Dela Cruz', advisedSectionId: 701, employeeId: 'E-501',
		plantillaPosition: 'Teacher I', designationTitle: null, undergraduateDegree: 'BSED', postgraduateDegree: null,
		ancillaryRoles: [], ancillaryMinutesPerWeek: 0, ancillaryLoadSource: 'NONE', advisoryEquivalentHours: 0,
		isClassAdviser: true, advisedSectionName: '7-Rizal', isStale: false,
	},
	{
		id: 502, firstName: 'Maria', lastName: 'Santos', advisedSectionId: null, employeeId: 'E-502',
		plantillaPosition: 'Teacher II', designationTitle: null, undergraduateDegree: null, postgraduateDegree: null,
		ancillaryRoles: [], ancillaryMinutesPerWeek: 0, ancillaryLoadSource: 'NONE', advisoryEquivalentHours: 0,
		isClassAdviser: false, advisedSectionName: null, isStale: false,
	},
];
const SUBJECTS = [
	{ id: 11, name: 'Mathematics', code: 'MATH' },
	{ id: 12, name: 'Science', code: 'SCI' },
	// C05 M16 — a reference-only subject so the zero-renderable-set control can
	// prove HG-only runs fail closed instead of emitting a header-only file.
	{ id: 99, name: 'Homeroom Guidance', code: 'HG' },
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

/**
 * C05 T1/M1 — verified ordered-term authority fixture. Official export routes
 * now require an explicit/resolved selected term; this is the cached EnrollPro
 * contract the resolver validates `termIndex` against.
 */
const TERM_CONTRACT = {
	schoolId: SCHOOL_ID,
	schoolYear: { id: SCHOOL_YEAR_ID },
	format: 'TRIMESTER',
	terms: [
		{ identity: 'T1', displayLabel: 'First Term', order: 1 },
		{ identity: 'T2', displayLabel: 'Second Term', order: 2 },
		{ identity: 'T3', displayLabel: 'Third Term', order: 3 },
	],
	activeTerm: { order: 1 },
};

const WRITE_METHODS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'executeRaw', 'queryRaw']);
const calls: Array<{ model: string; method: string }> = [];

/**
 * C05 M16 — the harness source always runs a completed run for the requested
 * scope; individual controls swap the persisted entry set to exercise the
 * zero-entry and reference-only-only cases against the production guard.
 */
let activeExportEntries: Array<Record<string, unknown>> = ENTRIES;

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
				return { id: id ?? RUN_ID, status: 'COMPLETED', summary: { isPublished: false, timetableDisplaySlots: [] }, draftEntries: activeExportEntries };
			},
			findMany: async () => [{ id: RUN_ID }],
		}),
		school: readModel('school', { findUnique: async () => ({ name: 'ATLAS School' }) }),
		enrollProSchoolYearMirror: readModel('enrollProSchoolYearMirror', {
			findFirst: async () => ({ yearLabel: '2026-2027' }),
			// C05 T1 — the verified ordered-term authority the export routes resolve
			// an explicit `termIndex` against.
			findUnique: async () => ({
				isActive: true,
				isArchived: false,
				termContractCache: TERM_CONTRACT,
				termContractCachedAt: new Date('2026-09-14T00:00:00Z'),
			}),
		}),
		sectionMirror: readModel('sectionMirror', { findMany: async () => SECTIONS }),
		facultyMirror: readModel('facultyMirror', {
			findFirst: async (args: any) => {
				const id = args?.where?.id;
				return FACULTY.find((f) => id == null || f.id === id) ?? null;
			},
			findMany: async () => FACULTY,
		}),
		subject: readModel('subject', { findMany: async () => SUBJECTS }),
		room: readModel('room', { findMany: async () => ROOMS }),
		building: readModel('building', { findMany: async () => [{ id: 1, name: 'Building A' }] }),
		schedulingPolicy: readModel('schedulingPolicy', {
			findFirst: async () => ({
				lunchStartTime: '12:00', lunchEndTime: '12:45', recessStartTime: '09:00', recessEndTime: '09:15',
				flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30', enableRecess: false, enableFlagCeremony: false,
			}),
		}),
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
	const response = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/class-program-matrix?gradeLevel=7&runId=${RUN_ID}&termIndex=1`, {
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
	const missingRun = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/class-program-matrix?gradeLevel=7&runId=999&termIndex=1`, {
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

test('all output routes reject a cross-school actor before any read or write', { skip: harnessSkip }, async () => {
	calls.length = 0;
	const headers = { Authorization: `Bearer ${authToken(999)}` };
	const matrix = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/class-program-matrix?gradeLevel=7`, { headers });
	assert.equal(matrix.status, 403);
	assert.equal((await matrix.json() as any).code, 'CROSS_SCHOOL_DENIED');

	const workbook = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/class-program.xlsx`, { headers });
	assert.equal(workbook.status, 403);
	assert.equal((await workbook.json() as any).code, 'CROSS_SCHOOL_DENIED');

	const summary = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/summary-teacher-schedule.xlsx`, { headers });
	assert.equal(summary.status, 403);
	assert.equal((await summary.json() as any).code, 'CROSS_SCHOOL_DENIED');
	assert.equal(calls.length, 0, 'rejected cross-school requests must dispatch zero downstream reads/writes');
});

test('summary-teacher-schedule route admits a same-school actor and completes with zero writes', { skip: harnessSkip }, async () => {
	calls.length = 0;
	const response = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/summary-teacher-schedule.xlsx?termIndex=1`, {
		headers: { Authorization: `Bearer ${authToken(SCHOOL_ID)}` },
	});
	assert.equal(response.status, 200, 'same-school scope must not be rejected by the guard');
	assert.match(String(response.headers.get('content-type')), /spreadsheetml/);
	assert.ok(Buffer.from(await response.arrayBuffer()).length > 0, 'summary workbook is non-empty');
	assert.equal(calls.some((call) => WRITE_METHODS.has(call.method)), false, 'route must perform zero writes');
});

test('mounted class-program.xlsx route returns a real weekday workbook', {
	skip: harnessSkip || (exceljsUsable ? false : 'EXTERNALLY_BLOCKED: worktree exceljs dependency tree is incomplete'),
}, async () => {
	calls.length = 0;
	const response = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/class-program.xlsx?termIndex=1`, {
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
	// C05 T4/M9 — the branding block (rows 1-4) sits above the title (row 5) and
	// the identity/meta row (row 6); block rows follow at 8, so the weekday header
	// is row 10 and the first data row is 11.
	const header = [1, 2, 3, 4, 5, 6, 7, 8].map((col) => sheet.getRow(10).getCell(col).value);
	assert.deepEqual(header, ['TIME', 'MINUTES', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'TEACHER']);
	assert.equal(sheet.getRow(11).getCell(3).value, 'Mathematics\nDela Cruz, Juan');
	assert.equal(sheet.getRow(11).getCell(4).value, 'Science\nSantos, Maria');
	assert.equal(sheet.getRow(11).getCell(8).value, 'MON: Dela Cruz, Juan / TUE: Santos, Maria');
	assert.equal(calls.some((call) => WRITE_METHODS.has(call.method)), false, 'route must perform zero writes');
});

// ─── C05 M1 — official exports require a resolved selected term ───

test('every official export route rejects an absent termIndex with a typed 4xx and zero bytes', { skip: harnessSkip }, async () => {
	// Failing-first control (G1): on the base revision each of these requests
	// returned 200 with a mixed all-term document. The requirement is a typed
	// 4xx and zero file bytes, so an omitted term can never be exported.
	calls.length = 0;
	const headers = { Authorization: `Bearer ${authToken(SCHOOL_ID)}` };
	const targets = [
		`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/summary-teacher-schedule.xlsx`,
		`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/class-program.xlsx`,
		`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/teacher-program.docx?facultyId=501`,
		`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/room-program.xlsx`,
		`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/class-program-matrix?gradeLevel=7&runId=${RUN_ID}`,
	];
	for (const url of targets) {
		const response = await fetch(url, { headers });
		assert.equal(response.status, 400, `${url} must reject an absent termIndex`);
		assert.equal((await response.json() as any).code, 'TERM_INDEX_REQUIRED');
		assert.equal(response.headers.get('content-disposition'), null, 'a rejected export must not attach a file');
		assert.doesNotMatch(String(response.headers.get('content-type')), /spreadsheetml|wordprocessingml/, 'a rejected export must not emit a document content type');
	}
	assert.equal(calls.length, 0, 'an absent term must be rejected before any downstream read/write');
});

test('official export routes accept an explicit in-contract term and reject an out-of-contract one', { skip: harnessSkip }, async () => {
	const headers = { Authorization: `Bearer ${authToken(SCHOOL_ID)}` };
	const accepted = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/summary-teacher-schedule.xlsx?termIndex=active`, { headers });
	// `active` resolves to order 1 in the verified fixture contract.
	assert.equal(accepted.status, 200);
	assert.match(String(accepted.headers.get('content-disposition')), /term1/, 'resolved term identity is part of the filename');

	const outsideContract = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/class-program.xlsx?termIndex=4`, { headers });
	assert.equal(outsideContract.status, 400);
	assert.equal((await outsideContract.json() as any).code, 'TERM_INDEX_OUTSIDE_CONTRACT');
});

// ─── C05 M3/M14 — mounted published teacher-program DOCX requires a term and scope ───

test('mounted teacher-program.docx returns a real DOCX for a same-school actor with a selected term', { skip: harnessSkip }, async () => {
	calls.length = 0;
	const headers = { Authorization: `Bearer ${authToken(SCHOOL_ID)}` };
	const response = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/teacher-program.docx?facultyId=501&termIndex=1`, { headers });
	assert.equal(response.status, 200);
	assert.match(String(response.headers.get('content-type')), /wordprocessingml/);
	const buffer = Buffer.from(await response.arrayBuffer());
	assert.ok(buffer.length > 0, 'teacher program DOCX is non-empty');
	assert.equal(buffer.subarray(0, 2).toString('latin1'), 'PK', 'DOCX is a real zip container');
	assert.equal(calls.some((call) => WRITE_METHODS.has(call.method)), false, 'route must perform zero writes');
});

test('mounted teacher-program.docx fails closed without a term and across schools', { skip: harnessSkip }, async () => {
	calls.length = 0;
	const noTerm = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/teacher-program.docx?facultyId=501`, {
		headers: { Authorization: `Bearer ${authToken(SCHOOL_ID)}` },
	});
	assert.equal(noTerm.status, 400);
	assert.equal((await noTerm.json() as any).code, 'TERM_INDEX_REQUIRED');

	const crossSchool = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/teacher-program.docx?facultyId=501&termIndex=1`, {
		headers: { Authorization: `Bearer ${authToken(999)}` },
	});
	assert.equal(crossSchool.status, 403);
	assert.equal((await crossSchool.json() as any).code, 'CROSS_SCHOOL_DENIED');
	assert.equal(calls.length, 0, 'rejected teacher-program requests must dispatch zero downstream reads/writes');
});

// ─── C05 M16 — unknown faculty on an official export fails closed with zero bytes ───

test('teacher-program.docx fails closed for a faculty member outside the run scope', { skip: harnessSkip }, async () => {
	calls.length = 0;
	const response = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/teacher-program.docx?facultyId=999&termIndex=1`, {
		headers: { Authorization: `Bearer ${authToken(SCHOOL_ID)}` },
	});
	assert.equal(response.status, 404);
	assert.equal((await response.json() as any).code, 'FACULTY_NOT_FOUND');
	assert.equal(response.headers.get('content-disposition'), null, 'a rejected export must not attach a file');
	assert.equal(calls.some((call) => WRITE_METHODS.has(call.method)), false, 'a rejected export must not write');
});

// ─── C05 M11/M15/M18 — mounted room-program.xlsx route ───

test('mounted room-program.xlsx returns a scoped workbook with identity, zero writes, and no reference-only subject', {
	skip: harnessSkip || (exceljsUsable ? false : 'EXTERNALLY_BLOCKED: worktree exceljs dependency tree is incomplete'),
}, async () => {
	calls.length = 0;
	const headers = { Authorization: `Bearer ${authToken(SCHOOL_ID)}` };

	const scoped = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/room-program.xlsx?termIndex=1&roomId=601`, { headers });
	assert.equal(scoped.status, 200);
	assert.match(String(scoped.headers.get('content-type')), /spreadsheetml/);
	// M18 — the server identity is `<type>-<entity>-SY<year>-term<N>.xlsx`; the
	// client resolver mirrors the exact same token, including the room id.
	assert.equal(scoped.headers.get('content-disposition'), 'attachment; filename="room-program-601-SY2026-2027-term1.xlsx"');

	const ExcelJS = (await import('exceljs')).default as any;
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(Buffer.from(await scoped.arrayBuffer()));
	const sheet = workbook.worksheets[0];
	assert.ok(sheet, 'the scoped room sheet exists');
	const flat: string[] = [];
	sheet.eachRow((row: any) => {
		row.eachCell((cell: any) => { if (typeof cell.value === 'string') flat.push(cell.value); });
	});
	assert.ok(flat.some((value) => value === 'TIME'), 'the weekday header is present');
	assert.ok(flat.some((value) => value.includes('Mathematics') && value.includes('7-Rizal') && value.includes('Dela Cruz, Juan')), 'the Monday cell carries Subject+Section+Teacher unambiguously');
	// M8 — ARAL Program and HG never appear in the official room program.
	assert.equal(flat.some((value) => /ARAL|ARAL PROGRAM|Homeroom Guidance/i.test(value)), false, 'no ARAL/HG row, cell, or label may render');
	// M15 — the room export path performs zero writes.
	assert.equal(calls.some((call) => WRITE_METHODS.has(call.method)), false, 'room export must perform zero writes');

	// Omitting roomId scopes every room with entries and uses the ALL token.
	calls.length = 0;
	const all = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/room-program.xlsx?termIndex=1`, { headers });
	assert.equal(all.status, 200);
	assert.equal(all.headers.get('content-disposition'), 'attachment; filename="room-program-ALL-SY2026-2027-term1.xlsx"');

	// A room outside the school fails closed with zero bytes and zero writes.
	calls.length = 0;
	const unknown = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/room-program.xlsx?termIndex=1&roomId=999`, { headers });
	assert.equal(unknown.status, 404);
	assert.equal((await unknown.json() as any).code, 'ROOM_NOT_FOUND');
	assert.equal(unknown.headers.get('content-disposition'), null);
	assert.equal(calls.some((call) => WRITE_METHODS.has(call.method)), false, 'a rejected room export must not write');
});

// ─── C05 M14 — mounted authentication and role matrix across official exports ───

test('official export routes fail closed on missing, invalid, non-privileged, and raw system-token callers', { skip: harnessSkip }, async () => {
	const exportPaths = [
		`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/summary-teacher-schedule.xlsx?termIndex=1`,
		`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/class-program.xlsx?termIndex=1`,
		`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/teacher-program.docx?facultyId=501&termIndex=1`,
		`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/room-program.xlsx?termIndex=1`,
	];
	const cases: Array<{ label: string; headers: Record<string, string>; status: number; code: string }> = [
		{ label: 'missing JWT', headers: {}, status: 401, code: 'NO_TOKEN' },
		{ label: 'invalid JWT', headers: { Authorization: 'Bearer not-a-real-jwt' }, status: 401, code: 'INVALID_TOKEN' },
		{ label: 'non-privileged role', headers: { Authorization: `Bearer ${jwt.sign({ userId: 9, role: 'faculty', authSource: 'local', schoolId: SCHOOL_ID }, process.env.JWT_SECRET!, { expiresIn: '5m' })}` }, status: 403, code: 'FORBIDDEN' },
		{ label: 'raw system token', headers: { Authorization: 'Bearer atlas-system-raw-token' }, status: 401, code: 'INVALID_TOKEN' },
	];

	for (const target of exportPaths) {
		for (const testCase of cases) {
			calls.length = 0;
			const response = await fetch(target, { headers: testCase.headers });
			assert.equal(response.status, testCase.status, `${testCase.label} must be rejected on ${target}`);
			assert.equal((await response.json() as any).code, testCase.code, `${testCase.label} must return the typed code on ${target}`);
			assert.equal(response.headers.get('content-disposition'), null, `${testCase.label} must not receive a file`);
			assert.equal(calls.length, 0, `${testCase.label} must dispatch zero downstream reads/writes on ${target}`);
		}
	}
});

// ─── C05 M16 — a zero-entry selected term never emits a header-only file ───

test('every official export fails closed with zero file bytes when the completed run has no selected-term entries', { skip: harnessSkip }, async () => {
	const headers = { Authorization: `Bearer ${authToken(SCHOOL_ID)}` };
	const routes = [
		'summary-teacher-schedule.xlsx?termIndex=1',
		'class-program.xlsx?termIndex=1',
		'teacher-program.docx?facultyId=501&termIndex=1',
	];

	// Positive control: the populated fixture still produces a real file.
	activeExportEntries = ENTRIES;
	for (const suffix of routes) {
		const ok = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/${suffix}`, { headers });
		assert.equal(ok.status, 200, `${suffix} must still succeed when the selected term has entries`);
		assert.ok(Buffer.from(await ok.arrayBuffer()).length > 2000, `${suffix} must produce a real file`);
	}

	// Failing-first control: before the guard these returned 200 with a
	// header-only document (QA observed 7141 / 6815 / DOCX-with-teaching=0).
	// The second case is all-reference-only (HG): the renderable set is still
	// empty, so it must fail closed rather than emit a header-only file.
	for (const emptyEntries of [[], ENTRIES.map((entry) => ({ ...entry, subjectId: 99 }))]) {
		activeExportEntries = emptyEntries;
		try {
			for (const suffix of routes) {
				calls.length = 0;
				const response = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/${suffix}`, { headers });
				assert.equal(response.status, 422, `${suffix} must fail closed for an empty renderable set`);
				assert.equal(response.headers.get('content-disposition'), null, `${suffix} must not attach a file`);
				assert.match(String(response.headers.get('content-type')), /application\/json/, `${suffix} must return a typed error body, not a document`);
				const body = Buffer.from(await response.arrayBuffer());
				assert.ok(body.length < 500, `${suffix} must emit an error body, not a ${body.length}-byte header-only document`);
				let parsed: { code?: string } = {};
				try { parsed = JSON.parse(body.toString('utf8')); } catch { parsed = {}; }
				assert.equal(parsed.code, 'EMPTY_SELECTED_TERM', `${suffix} must return the typed code`);
				assert.equal(calls.some((call) => WRITE_METHODS.has(call.method)), false, `${suffix} must not write`);
			}
		} finally {
			activeExportEntries = ENTRIES;
		}
	}
	activeExportEntries = ENTRIES;
});

// ─── C05 M16 non-regression — room/matrix keep their own distinct typed errors ───

test('the zero-entry guard does not replace the room or matrix failure contracts', { skip: harnessSkip }, async () => {
	const headers = { Authorization: `Bearer ${authToken(SCHOOL_ID)}` };
	activeExportEntries = [];
	try {
		const room = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/room-program.xlsx?termIndex=1&roomId=601`, { headers });
		assert.notEqual(room.status, 422, 'the room route owns its own failure contract');
		const roomBody = await room.json() as any;
		assert.notEqual(roomBody.code, 'EMPTY_SELECTED_TERM', 'the room route must not be rewritten by the shared guard');

		const matrix = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/class-program-matrix?gradeLevel=7&runId=${RUN_ID}&termIndex=1`, { headers });
		assert.equal(matrix.status, 422);
		assert.equal((await matrix.json() as any).code, 'EMPTY_SOURCE_RUN', 'the matrix route keeps its distinct typed error');
	} finally {
		activeExportEntries = ENTRIES;
	}
});

// ─── C05 M18/M23 — server filename identity and publication marker ───

test('mounted official exports emit year+term+entity filename identity and the draft publication marker', {
	skip: harnessSkip || (exceljsUsable ? false : 'EXTERNALLY_BLOCKED: worktree exceljs dependency tree is incomplete'),
}, async () => {
	const headers = { Authorization: `Bearer ${authToken(SCHOOL_ID)}` };
	const dispositions: Array<[string, string]> = [
		[`summary-teacher-schedule.xlsx?termIndex=1`, 'summary-teacher-schedule-SY2026-2027-term1.xlsx'],
		[`class-program.xlsx?termIndex=1`, 'class-program-SY2026-2027-term1.xlsx'],
		[`teacher-program.docx?facultyId=501&termIndex=1`, 'teacher-program-501-SY2026-2027-term1.docx'],
		[`room-program.xlsx?termIndex=1&roomId=602`, 'room-program-602-SY2026-2027-term1.xlsx'],
	];
	for (const [suffix, expected] of dispositions) {
		const response = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/${suffix}`, { headers });
		assert.equal(response.status, 200, `${suffix} must succeed`);
		assert.equal(response.headers.get('content-disposition'), `attachment; filename="${expected}"`, `${suffix} must emit the exact identity`);
	}

	// M23 — an unpublished run is explicitly marked in the workbook header area.
	const classProgram = await fetch(`${baseUrl}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/export/class-program.xlsx?termIndex=1`, { headers });
	const ExcelJS = (await import('exceljs')).default as any;
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(Buffer.from(await classProgram.arrayBuffer()));
	const sheet = workbook.getWorksheet('Grade 7');
	assert.equal(sheet.getRow(6).getCell(6).value, 'NOT PUBLISHED — DRAFT/REVIEW', 'a draft export states its publication state');
});
