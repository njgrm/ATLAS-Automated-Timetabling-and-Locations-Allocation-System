/**
 * A9 c5 — EVERY past school year is offered and a past year that is not yet
 * "kept as history" is READABLE.
 *
 * Hermetic and zero-write, in the same style as `rr-ux01-rollover-history.test.ts`:
 * the real `teaching-load-history.router` is mounted on a real ephemeral Express
 * server against an injected fake data context whose every write method throws and
 * counts, so GET-only behaviour is proved rather than asserted.
 *
 * THE DEFECT THIS FIXES, stated so a reader can tell whether the suite still
 * decides it: before A9 c5 the list filtered `isArchived: true`, so 2022-2023 —
 * genuinely past, not yet kept — had no row, and opening it answered
 * `409 HISTORY_YEAR_NOT_ARCHIVED`. Row 1 below is a PAST, NOT-ARCHIVED year that
 * must be listed and must open with 200.
 *
 * The fixture mirrors the REAL staging shape measured on 2026-09-29:
 *   id 1  2022-2023  past, not archived, POPULATED cycle, 82 assignments
 *   id 2  2023-2024  ACTIVE
 *   id 8  2029-2030  future drill year, archived
 *   id 9  2030-2031  future drill year
 *   id 10 2031-2032  future drill year
 */

import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';

import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

import teachingLoadHistoryRouter from '../routes/teaching-load-history.router.js';
import { teachingLoadHistorySubjectLabel } from '../services/teaching-load-history.service.js';
import { withDataContext } from '../lib/data-context.js';

const SECRET = 'a9c5-tl-history-hermetic-secret';

const officer7 = () => jwt.sign({ userId: 70, role: 'officer', authSource: 'local', schoolId: 7 }, SECRET);
const officer8 = () => jwt.sign({ userId: 80, role: 'officer', authSource: 'local', schoolId: 8 }, SECRET);
const faculty7 = () => jwt.sign({ userId: 30, role: 'faculty', authSource: 'local', schoolId: 7 }, SECRET);

const NOW = new Date('2026-09-29T00:00:00.000Z');

type MirrorRow = {
	schoolId: number;
	enrollProSchoolYearId: number;
	yearLabel: string;
	isActive: boolean;
	isArchived: boolean;
	archivedAt: Date | null;
	archiveReason: string | null;
};

type CycleRow = {
	schoolId: number;
	schoolYearId: number;
	state: 'EMPTY' | 'POPULATED';
	version: number;
	initializedAt: Date;
	updatedAt: Date;
};

function fixture() {
	const mirrors: MirrorRow[] = [
		{ schoolId: 7, enrollProSchoolYearId: 1, yearLabel: '2022-2023', isActive: false, isArchived: false, archivedAt: null, archiveReason: null },
		{ schoolId: 7, enrollProSchoolYearId: 2, yearLabel: '2023-2024', isActive: true, isArchived: false, archivedAt: null, archiveReason: null },
		{ schoolId: 7, enrollProSchoolYearId: 8, yearLabel: '2029-2030', isActive: false, isArchived: true, archivedAt: NOW, archiveReason: 'drill' },
		{ schoolId: 7, enrollProSchoolYearId: 9, yearLabel: '2030-2031', isActive: false, isArchived: false, archivedAt: null, archiveReason: null },
		{ schoolId: 7, enrollProSchoolYearId: 10, yearLabel: '2031-2032', isActive: false, isArchived: false, archivedAt: null, archiveReason: null },
		// A label with no year in it: it cannot be ordered against another label, so
		// it is NEVER offered as history (fail closed).
		{ schoolId: 7, enrollProSchoolYearId: 11, yearLabel: 'TBA', isActive: false, isArchived: false, archivedAt: null, archiveReason: null },
		{ schoolId: 8, enrollProSchoolYearId: 30, yearLabel: '2021-2022', isActive: true, isArchived: false, archivedAt: null, archiveReason: null },
	];
	const cycles: CycleRow[] = [
		{ schoolId: 7, schoolYearId: 1, state: 'POPULATED', version: 4, initializedAt: NOW, updatedAt: NOW },
		{ schoolId: 7, schoolYearId: 2, state: 'EMPTY', version: 1, initializedAt: NOW, updatedAt: NOW },
		{ schoolId: 7, schoolYearId: 8, state: 'POPULATED', version: 6, initializedAt: NOW, updatedAt: NOW },
		{ schoolId: 8, schoolYearId: 30, state: 'POPULATED', version: 2, initializedAt: NOW, updatedAt: NOW },
	];
	const assignments = [
		{
			schoolId: 7, schoolYearId: 1, id: 501, sectionIds: [101, 102], assignedAt: NOW,
			faculty: { id: 11, firstName: 'Roberto', lastName: 'Alcantara', department: 'Science' },
			subject: { id: 21, code: 'SCI_BIO', name: 'Science - Biology', outputLabel: 'SCIENCE', minMinutesPerWeek: 225 },
		},
		{
			// One more section on the same subject: the weekly minutes must be
			// `minMinutesPerWeek x sections`, not `minMinutesPerWeek`.
			schoolId: 7, schoolYearId: 1, id: 502, sectionIds: [103], assignedAt: NOW,
			faculty: { id: 11, firstName: 'Roberto', lastName: 'Alcantara', department: 'Science' },
			subject: { id: 22, code: 'MAPEH', name: 'MAPEH', outputLabel: 'MAPEH', minMinutesPerWeek: 225 },
		},
		{
			schoolId: 7, schoolYearId: 1, id: 503, sectionIds: [104], assignedAt: NOW,
			faculty: { id: 12, firstName: 'Maria', lastName: 'Diaz', department: null },
			subject: { id: 23, code: 'FIL', name: 'Filipino', outputLabel: 'FILIPINO', minMinutesPerWeek: 225 },
		},
	];
	const sections = [
		{ schoolId: 7, schoolYearId: 1, externalId: 101, name: 'Luna', gradeLevelName: 'Grade 8', displayOrder: 8 },
		{ schoolId: 7, schoolYearId: 1, externalId: 102, name: 'Rose', gradeLevelName: 'Grade 8', displayOrder: 8 },
		{ schoolId: 7, schoolYearId: 1, externalId: 103, name: 'Sampaguita', gradeLevelName: 'Grade 7', displayOrder: 7 },
		{ schoolId: 7, schoolYearId: 1, externalId: 104, name: 'Luna', gradeLevelName: 'Grade 8', displayOrder: 8 },
	];
	return { mirrors, cycles, assignments, sections };
}

/**
 * The fake client. `findMany` on the mirror model reads EVERY row for the school —
 * that is the whole change — and `groupBy` counts the assignments per year in one
 * call, which the counting row below also proves.
 */
function fakeClient(data: ReturnType<typeof fixture>, writes: { count: number }, groupByCalls: { count: number }) {
	const unsupported = (model: string) => async () => {
		writes.count += 1;
		throw new Error(`unexpected write on ${model}`);
	};
	const writeMethods = (model: string) => ({
		create: unsupported(model), createMany: unsupported(model), update: unsupported(model),
		updateMany: unsupported(model), upsert: unsupported(model), delete: unsupported(model), deleteMany: unsupported(model),
	});
	const mirror = (row: MirrorRow) => ({ ...row });
	return {
		enrollProSchoolYearMirror: {
			// A9 c5 QA (BLOCKING, row 10a): this fake used to honour ONLY
			// `where.schoolId` and silently drop `where.isArchived`. Reverting the
			// service to its pre-A9-c5 `where: { schoolId, isArchived: true }` filter
			// therefore still passed row 1 - the fake ignored the very clause the
			// defect lived in, so the suite asserted the ANSWER instead of deciding
			// it (AGENTS.md 11, "a proof artefact must actually discriminate").
			// `isArchived` is honoured here, exactly as `rr-ux01-rollover-history`'s
			// fake does, so the filter is load-bearing again.
			findMany: async ({ where }: any) => data.mirrors
				.filter((row) => row.schoolId === where.schoolId)
				.filter((row) => (where.isArchived === undefined ? true : row.isArchived === where.isArchived))
				.map(mirror),
			findUnique: async ({ where }: any) => {
				const key = where.schoolId_enrollProSchoolYearId;
				const row = data.mirrors.find((item) => item.schoolId === key.schoolId && item.enrollProSchoolYearId === key.enrollProSchoolYearId);
				return row ? mirror(row) : null;
			},
			findFirst: async ({ where }: any) => {
				const rows = data.mirrors
					.filter((row) => row.schoolId === where.schoolId && row.isActive === where.isActive)
					.sort((a, b) => b.enrollProSchoolYearId - a.enrollProSchoolYearId);
				return rows[0] ? mirror(rows[0]) : null;
			},
			...writeMethods('enrollProSchoolYearMirror'),
		},
		teachingLoadCycle: {
			findMany: async ({ where }: any) => data.cycles
				.filter((row) => row.schoolId === where.schoolId && where.schoolYearId.in.includes(row.schoolYearId))
				.map((row) => ({ ...row })),
			findUnique: async ({ where }: any) => {
				const key = where.schoolId_schoolYearId;
				const row = data.cycles.find((item) => item.schoolId === key.schoolId && item.schoolYearId === key.schoolYearId);
				return row ? { ...row } : null;
			},
			...writeMethods('teachingLoadCycle'),
		},
		facultySubject: {
			groupBy: async ({ where }: any) => {
				groupByCalls.count += 1;
				const wanted = where.schoolYearId.in as number[];
				const rows = data.assignments
					.filter((row) => row.schoolId === where.schoolId && wanted.includes(row.schoolYearId));
				return wanted.map((schoolYearId) => ({
					schoolYearId,
					_count: { _all: rows.filter((row) => row.schoolYearId === schoolYearId).length },
				}));
			},
			findMany: async ({ where }: any) => data.assignments
				.filter((row) => row.schoolId === where.schoolId && row.schoolYearId === where.schoolYearId)
				.map((row) => structuredClone(row)),
			...writeMethods('facultySubject'),
		},
		sectionMirror: {
			findMany: async ({ where }: any) => data.sections
				.filter((row) => row.schoolId === where.schoolId && row.schoolYearId === where.schoolYearId)
				.map((row) => ({ ...row })),
			...writeMethods('sectionMirror'),
		},
	};
}

function jsonErrorHandler(error: Error & { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction): void {
	res.status(error.statusCode ?? 500).json({ code: error.code ?? 'SERVER_ERROR', message: error.message });
}

async function main(): Promise<void> {
	const previousSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = SECRET;
	const writes = { count: 0 };
	const groupByCalls = { count: 0 };
	const client = fakeClient(fixture(), writes, groupByCalls);
	let server: Server | undefined;
	let baseUrl = '';
	try {
		await withDataContext(client, async () => {
			const app = express();
			app.use(express.json());
			app.use('/api/v1/teaching-load', teachingLoadHistoryRouter);
			app.use(jsonErrorHandler);
			server = createServer(app);
			await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
			const address = server.address();
			assert(address && typeof address !== 'string');
			baseUrl = `http://127.0.0.1:${address.port}`;
			const get = (path: string, token?: string) => fetch(`${baseUrl}${path}`, {
				headers: token ? { authorization: `Bearer ${token}` } : {},
			});

			/* ── auth and actor scope are UNCHANGED by this cycle ───────────────── */
			assert.equal((await get('/api/v1/teaching-load/history-years')).status, 401, 'the year list still requires a token');
			assert.equal((await get('/api/v1/teaching-load/history-years', faculty7())).status, 403, 'the year list is still privileged-only');

			/* ── ROW 1: the defect. A past year that is NOT kept is LISTED ──────── */
			const list = await get('/api/v1/teaching-load/history-years', officer7());
			assert.equal(list.status, 200);
			const body = await list.json() as {
				schoolId: number;
				activeSchoolYearId: number | null;
				activeYearLabel: string | null;
				years: Array<{ schoolYearId: number; yearLabel: string; state: string; isArchived: boolean; assignmentCount: number; cycle: unknown }>;
				futureYears: Array<{ schoolYearId: number; yearLabel: string }>;
			};
			assert.equal(body.schoolId, 7, 'the list is scoped to the authenticated actor school');
			assert.equal(body.activeSchoolYearId, 2);
			assert.equal(body.activeYearLabel, '2023-2024');

			assert.deepEqual(
				body.years.map((row) => row.schoolYearId),
				[1],
				'2022-2023 (past, NOT archived) is offered; the ACTIVE year and the future drill years are not',
			);
			assert.equal(body.years[0].yearLabel, '2022-2023');
			assert.equal(body.years[0].state, 'past', 'a past year that has not been kept reads `past`');
			assert.equal(body.years[0].isArchived, false, 'it is offered BEFORE it is kept as history — that is the defect being fixed');
			assert.equal(body.years[0].assignmentCount, 3, 'the assignment count comes from the data, not from the cycle state');
			assert.equal((body.years[0].cycle as { state: string }).state, 'POPULATED');
			assert.equal(groupByCalls.count, 1, 'every offered year is counted in ONE groupBy call, not one per year');

			/* ── ROW 2: the active year is not listed and fails closed ───────────── */
			assert.equal(
				body.years.some((row) => row.schoolYearId === body.activeSchoolYearId),
				false,
				'the active year is never offered as history',
			);
			const current = await get('/api/v1/teaching-load/history-years/2', officer7());
			assert.equal(current.status, 409, 'the current year cannot be opened as history');
			assert.equal(((await current.json()) as { code: string }).code, 'HISTORY_YEAR_IS_CURRENT');
			assert.equal(
				((await (await get('/api/v1/teaching-load/history-years/2', officer7())).json()) as { message: string }).message,
				'This is the current Teaching Load. Open Teaching Load to work on it.',
				'the failure tells the scheduler where to go instead of only refusing',
			);

			/* ── ROW 3: future years are NOT offered, and are DISCLOSED ──────────── */
			assert.deepEqual(
				body.futureYears.map((row) => row.schoolYearId),
				[8, 9, 10, 11],
				'the three drill years come back in the disclosure list, oldest first',
			);
			assert.deepEqual(
				body.futureYears.slice(0, 3).map((row) => row.yearLabel),
				['2029-2030', '2030-2031', '2031-2032'],
			);
			// The label with no year in it cannot be ORDERED against another label, so
			// it is never offered as history — it joins the not-listed group and sorts
			// last, and it is named rather than silently dropped.
			assert.deepEqual(
				body.futureYears[3],
				{ schoolYearId: 11, yearLabel: 'TBA' },
				'an unparseable label is never offered as history (fail closed) and is disclosed last',
			);
			assert.equal(
				body.years.some((row) => row.schoolYearId === 11),
				false,
			);
			const future = await get('/api/v1/teaching-load/history-years/9', officer7());
			assert.equal(future.status, 409, 'a future year cannot be opened as history');
			assert.equal(((await future.json()) as { code: string }).code, 'HISTORY_YEAR_NOT_PAST');

			/* ── ROW 4: the past, not-yet-kept year is READABLE, with a real load ── */
			const detail = await get('/api/v1/teaching-load/history-years/1', officer7());
			assert.equal(detail.status, 200, 'a past year that has not been kept opens read-only — this used to be 409 HISTORY_YEAR_NOT_ARCHIVED');
			const payload = await detail.json() as any;
			assert.equal(payload.yearLabel, '2022-2023');
			assert.equal(payload.state, 'past');
			assert.equal(payload.isArchived, false, 'the factual archived flag stays exactly as stored');
			assert.equal(payload.activeSchoolYearId, 2);
			assert.equal(payload.activeYearLabel, '2023-2024', 'the page can say which year it thinks you should be working in');
			assert.equal(payload.cycle.state, 'POPULATED');

			const byName = new Map<string, any>(payload.teachers.map((row: any) => [row.facultyName, row]));
			const alacantara = byName.get('Alcantara, Roberto');
			assert.ok(alacantara, 'the teacher row survives');
			assert.equal(alacantara.weeklyMinutes, 675, '225 x 2 sections + 225 x 1 section = 675 minutes a week (7.5 + 3.8 hours)');
			assert.equal(alacantara.classCount, 3);
			assert.equal(alacantara.assignments.length, 2);
			assert.equal(alacantara.department, 'Science');
			assert.equal(byName.get('Diaz, Maria').weeklyMinutes, 225, 'one subject in one section is one subject\'s weekly demand');
			assert.equal(byName.get('Diaz, Maria').classCount, 1);
			assert.equal(byName.get('Diaz, Maria').department, null, 'a missing department is reported as null, never as a sentence on the page');
			// Plain subject name plus the code, both still available to the page.
			assert.equal(alacantara.assignments[0].subjectName, 'SCIENCE', 'outputLabel is the plain label the page leads with');
			assert.equal(alacantara.assignments[0].subjectCode, 'SCI_BIO');

			/* ── ROW 5 (A9 c5 r1, D2): the PLAIN name is its OWN field ─────────────
			 * `subjectName` and `subjectCode` are unchanged, so a client filtering on
			 * `subjectName` cannot be moved under a saved bookmark by this addition. */
			assert.equal(
				alacantara.assignments[0].subjectLabel,
				'Science - Biology',
				'step 1: the plain name, which carries no colon, is used as it stands',
			);
			assert.equal(
				byName.get('Diaz, Maria').assignments[0].subjectLabel,
				'Filipino',
				'the plain name wins over an outputLabel that is the code',
			);
			assert.equal(
				byName.get('Diaz, Maria').assignments[0].subjectName,
				'FILIPINO',
				'the filter identity is untouched by the new field',
			);
			// A subject whose name, outputLabel and code are all the same code has no plain
			// name to show; it falls through to the code rather than rendering an empty cell.
			assert.equal(
				alacantara.assignments[1].subjectLabel,
				'MAPEH',
				'step 2 then step 3: name === code, so outputLabel, then the code itself',
			);
			// Every assignment carries the field, so no row can be missing it.
			for (const teacher of payload.teachers as any[]) {
				for (const assignment of teacher.assignments) {
					assert.equal(
						typeof assignment.subjectLabel,
						'string',
						`${teacher.facultyName} has an assignment with no subjectLabel`,
					);
					assert.notEqual(assignment.subjectLabel.length, 0, 'a label is never empty');
				}
			}
			assert.equal(alacantara.assignments[0].sections[0].gradeLevelName, 'Grade 8');
			assert.equal(payload.totals.teachers, 2);
			assert.equal(payload.totals.assignments, 3);
			assert.equal(payload.totals.sections, 4, 'four distinct section ids across the three assignments');

			/* ── the label rule itself, on the cases the fixture does not contain ──── */
			assert.equal(
				teachingLoadHistorySubjectLabel({ name: 'Special Program in the Arts: Specialization', code: 'SPA', outputLabel: 'SPA' }),
				'Special Program in the Arts',
				'step 1: everything after the first colon is dropped, so a specialization is not shown as a code with a suffix',
			);
			assert.equal(
				teachingLoadHistorySubjectLabel({ name: '  Filipino  ', code: 'FIL', outputLabel: 'FILIPINO' }),
				'Filipino',
				'the name is trimmed before it is compared',
			);
			assert.equal(
				teachingLoadHistorySubjectLabel({ name: 'fil', code: 'FIL', outputLabel: 'FILIPINO' }),
				'FILIPINO',
				'step 2: a name that is only the code, in any case, is not a plain name',
			);
			assert.equal(
				teachingLoadHistorySubjectLabel({ name: ': Biology', code: 'SCI_BIO', outputLabel: 'SCIENCE' }),
				'SCIENCE',
				'a name that is nothing before its colon is empty, so it falls through',
			);
			assert.equal(
				teachingLoadHistorySubjectLabel({ name: '', code: 'X', outputLabel: '' }),
				'X',
				'step 3: with no name and no outputLabel the code is better than an empty cell',
			);
			assert.equal(
				teachingLoadHistorySubjectLabel({ name: 'MAPEH', code: 'MAPEH', outputLabel: null }),
				'MAPEH',
				'a null outputLabel is handled like an empty one',
			);

			/* ── unchanged guards: actor school, missing year, bad parameter ─────── */
			const otherList = await get('/api/v1/teaching-load/history-years', officer8());
			const otherBody = await otherList.json() as { schoolId: number; years: Array<{ schoolYearId: number }>; futureYears: unknown[] };
			assert.equal(otherBody.schoolId, 8);
			assert.deepEqual(otherBody.years, [], 'school 8 has only an active year, so it is offered nothing');
			assert.deepEqual(otherBody.futureYears, [], 'and the active year is never disclosed as a future year either');

			const crossSchool = await get('/api/v1/teaching-load/history-years/1', officer8());
			assert.equal(crossSchool.status, 404, 'another school cannot open this school\'s past year');
			assert.equal(((await crossSchool.json()) as { code: string }).code, 'HISTORY_YEAR_NOT_FOUND');

			const missing = await get('/api/v1/teaching-load/history-years/999', officer7());
			assert.equal(missing.status, 404);
			assert.equal(((await missing.json()) as { code: string }).code, 'HISTORY_YEAR_NOT_FOUND');
			assert.equal((await get('/api/v1/teaching-load/history-years/not-a-number', officer7())).status, 400);
		});
		assert.equal(writes.count, 0, 'browsing past years performed ZERO writes');
		console.log('PASS: every past year offered, past-not-kept readable, current and future years fail closed, zero writes');
	} finally {
		if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
		if (previousSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = previousSecret;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
