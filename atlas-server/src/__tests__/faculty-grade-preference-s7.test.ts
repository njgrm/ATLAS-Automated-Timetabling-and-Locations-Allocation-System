/**
 * FACULTY-GRADE-PREFERENCE-C01 (decision D10) — server proof.
 *
 * Covers the four production contracts:
 *  1. The soft preference is keyed `(schoolId, facultyId)` with NO school-year
 *     scope, so it survives rollover (service + schema + migration proof).
 *  2. Ranking prefers a candidate whose preference includes the section's
 *     numeric grade, and advisory always overrides preference.
 *  3. An empty/unset preference reproduces the base ordering exactly (negative
 *     control), and preference never outranks qualification tier.
 *  4. `OUTSIDE_PREFERRED_GRADE` is a SOFT advisory that never blocks a candidate.
 *
 * Plus a mounted-router authority matrix: `authenticate` + `timetable:edit` +
 * actor-school scope, with numeric 7-10 validation rejecting EnrollPro IDs.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

import {
	__testRankCoverageCandidates,
	evaluateGradePreferenceMatch,
} from '../services/teaching-load-automation.service.js';
import {
	FacultyGradePreferenceError,
	getFacultyGradePreference,
	listFacultyGradePreferences,
	normalizePreferredGradeLevels,
	preferenceIncludesGrade,
	setFacultyGradePreference,
} from '../services/faculty-grade-preference.service.js';

const here = dirname(fileURLToPath(import.meta.url));

// ─── 1. Ranking: soft preference tier + advisory override ───────────────────

test('ranking: an unset/empty preference reproduces the base ordering exactly', () => {
	const base = [
		{ facultyId: 3, tier: 1, subjectAssignedCount: 2, projectedUsedMinutes: 300 },
		{ facultyId: 1, tier: 1, subjectAssignedCount: 0, projectedUsedMinutes: 100 },
		{ facultyId: 2, tier: 1, subjectAssignedCount: 0, projectedUsedMinutes: 200 },
	];
	const expected = [1, 2, 3];
	assert.deepEqual(__testRankCoverageCandidates(base), expected, 'base ordering');

	// Negative control: explicit neutral preference fields must be byte-identical
	// to the unset case. This is the mutant that proves preference is inert when
	// no teacher has a preference.
	const explicitNeutral = base.map((row) => ({ ...row, advisoryMatch: false, preferredGradeMatch: false }));
	assert.deepEqual(__testRankCoverageCandidates(explicitNeutral), expected, 'explicit neutral preference');
});

test('ranking: a candidate whose preference matches the section grade is preferred', () => {
	const ranked = __testRankCoverageCandidates([
		{ facultyId: 3, tier: 1, subjectAssignedCount: 2, projectedUsedMinutes: 300, preferredGradeMatch: true },
		{ facultyId: 1, tier: 1, subjectAssignedCount: 0, projectedUsedMinutes: 100, preferredGradeMatch: false },
	]);
	assert.deepEqual(ranked, [3, 1], 'matching candidate wins over a lighter non-matching candidate');
	// Never blocks: the non-preferred candidate is still ranked (present), not dropped.
	assert.equal(ranked.includes(1), true, 'non-preferred candidate remains in the ranked set');
});

test('ranking: advisory override wins over a non-matching preference', () => {
	const ranked = __testRankCoverageCandidates([
		{ facultyId: 6, tier: 1, subjectAssignedCount: 0, projectedUsedMinutes: 60, advisoryMatch: false, preferredGradeMatch: true },
		{ facultyId: 5, tier: 1, subjectAssignedCount: 4, projectedUsedMinutes: 500, advisoryMatch: true, preferredGradeMatch: false },
	]);
	assert.deepEqual(ranked, [5, 6], 'the section adviser is preferred for their own section regardless of preference');
	assert.equal(ranked.includes(6), true, 'the preferred non-adviser is still assignable (not blocked)');
});

test('ranking: preference never outranks qualification tier', () => {
	const ranked = __testRankCoverageCandidates([
		{ facultyId: 8, tier: 2, subjectAssignedCount: 0, projectedUsedMinutes: 10, preferredGradeMatch: true },
		{ facultyId: 7, tier: 1, subjectAssignedCount: 0, projectedUsedMinutes: 900, preferredGradeMatch: false },
	]);
	assert.deepEqual(ranked, [7, 8], 'a better-qualified candidate still wins');
});

test('OUTSIDE_PREFERRED_GRADE is a soft advisory that never blocks a candidate', () => {
	// Non-adviser with a non-matching preference: the advisory is emitted, but
	// the evaluation exposes no blocking outcome — the candidate stays valid.
	const outside = evaluateGradePreferenceMatch({
		isClassAdviser: false,
		advisedSectionId: null,
		sectionId: 5,
		sectionGradeLevel: 9,
		preferredGradeLevels: [7, 8],
	});
	assert.equal(outside.hasPreference, true);
	assert.equal(outside.outsidePreferredGrade, true, 'advisory emitted');
	assert.equal('blocked' in outside, false, 'no blocking outcome exists');

	// Advisory override: the section's own adviser always matches, so no advisory.
	const adviser = evaluateGradePreferenceMatch({
		isClassAdviser: true,
		advisedSectionId: 5,
		sectionId: 5,
		sectionGradeLevel: 9,
		preferredGradeLevels: [7, 8],
	});
	assert.equal(adviser.advisoryMatch, true);
	assert.equal(adviser.outsidePreferredGrade, false, 'advisory override suppresses the advisory');

	const match = evaluateGradePreferenceMatch({
		isClassAdviser: false,
		advisedSectionId: null,
		sectionId: 5,
		sectionGradeLevel: 8,
		preferredGradeLevels: [7, 8],
	});
	assert.equal(match.preferredGradeMatch, true);
	assert.equal(match.outsidePreferredGrade, false);

	// Empty preference changes nothing (negative control).
	const empty = evaluateGradePreferenceMatch({
		isClassAdviser: false,
		advisedSectionId: null,
		sectionId: 5,
		sectionGradeLevel: 8,
		preferredGradeLevels: [],
	});
	assert.equal(empty.hasPreference, false);
	assert.equal(empty.outsidePreferredGrade, false);
});

// ─── 2. Service: persistence without school-year scope + validation ─────────

type FakeRow = { schoolId: number; facultyId: number; gradeLevels: number[]; updatedAt: Date };

function createFakePreferenceClient(options?: { facultyExists?: boolean }) {
	const facultyExists = options?.facultyExists !== false;
	const store = new Map<string, FakeRow>();
	const calls: Array<{ op: string; args: any }> = [];
	const client = {
		facultyMirror: {
			findFirst: async (args: any) => {
				calls.push({ op: 'facultyMirror.findFirst', args });
				return facultyExists ? { id: args.where.id } : null;
			},
		},
		facultyGradePreference: {
			findMany: async (args: any) => {
				calls.push({ op: 'findMany', args });
				return [...store.values()]
					.filter((row) => row.schoolId === args.where.schoolId)
					.map((row) => ({ facultyId: row.facultyId, gradeLevels: row.gradeLevels, updatedAt: row.updatedAt }));
			},
			findUnique: async (args: any) => {
				calls.push({ op: 'findUnique', args });
				const key = `${args.where.schoolId_facultyId.schoolId}:${args.where.schoolId_facultyId.facultyId}`;
				const row = store.get(key);
				return row ? { facultyId: row.facultyId, gradeLevels: row.gradeLevels, updatedAt: row.updatedAt } : null;
			},
			upsert: async (args: any) => {
				calls.push({ op: 'upsert', args });
				const key = `${args.where.schoolId_facultyId.schoolId}:${args.where.schoolId_facultyId.facultyId}`;
				const row: FakeRow = {
					schoolId: args.where.schoolId_facultyId.schoolId,
					facultyId: args.where.schoolId_facultyId.facultyId,
					gradeLevels: [...(args.create?.gradeLevels ?? args.update?.gradeLevels ?? [])],
					updatedAt: new Date('2026-09-25T00:00:00.000Z'),
				};
				store.set(key, row);
				return { facultyId: row.facultyId, gradeLevels: row.gradeLevels, updatedAt: row.updatedAt };
			},
		},
	};
	return { client, calls, store };
}

test('preference validation accepts numeric grades 7-10 and rejects EnrollPro grade-level IDs', () => {
	assert.deepEqual(normalizePreferredGradeLevels([9, 7, 7, 10]), [7, 9, 10], 'dedupe + sort');
	assert.deepEqual(normalizePreferredGradeLevels([]), [], 'empty = no preference');
	for (const invalid of [[1], [2, 3], [7, 11], [0], ['7'], [7.5], '7', 7, undefined, null]) {
		assert.throws(
			() => normalizePreferredGradeLevels(invalid),
			(err: unknown) => err instanceof FacultyGradePreferenceError && err.code === 'INVALID_GRADE_LEVELS' && err.statusCode === 400,
			`expected INVALID_GRADE_LEVELS for ${JSON.stringify(invalid)}`,
		);
	}
});

test('preference persists keyed (schoolId, facultyId) with no school-year dependency and survives rollover', async () => {
	const { client, calls, store } = createFakePreferenceClient();
	const saved = await setFacultyGradePreference(41, 9, [8, 7], client);
	assert.deepEqual(saved.gradeLevels, [7, 8]);

	const upsert = calls.find((entry) => entry.op === 'upsert');
	assert.ok(upsert, 'upsert dispatched');
	assert.deepEqual(upsert.args.where, { schoolId_facultyId: { schoolId: 41, facultyId: 9 } }, 'identity is school+faculty only');
	assert.equal(JSON.stringify(upsert.args).includes('schoolYearId'), false, 'no school-year in the write');

	const list = await listFacultyGradePreferences(41, client);
	const findMany = calls.find((entry) => entry.op === 'findMany');
	assert.ok(findMany, 'findMany dispatched');
	assert.deepEqual(findMany.args.where, { schoolId: 41 }, 'read is school-scoped only');
	assert.equal(JSON.stringify(findMany.args).includes('schoolYearId'), false, 'no school-year in the read');
	assert.equal(list.length, 1);

	// Simulate a rollover: the service has no school-year input at all, so the
	// row read back is identical before and after a (hypothetical) new year.
	const beforeRollover = await getFacultyGradePreference(41, 9, client);
	const simulatedActiveSchoolYearId = 10; // deliberately not passed to the service
	void simulatedActiveSchoolYearId;
	const afterRollover = await getFacultyGradePreference(41, 9, client);
	assert.deepEqual(afterRollover, beforeRollover, 'preference survives rollover');
	assert.equal(store.size, 1, 'still exactly one persisted row');
});

test('preference write fails closed when the faculty is not in the actor school', async () => {
	const { client, calls } = createFakePreferenceClient({ facultyExists: false });
	await assert.rejects(
		() => setFacultyGradePreference(41, 999, [7], client),
		(err: unknown) => err instanceof FacultyGradePreferenceError && err.code === 'FACULTY_NOT_FOUND' && err.statusCode === 404,
	);
	assert.equal(calls.some((entry) => entry.op === 'upsert'), false, 'no write on a rejected faculty');
});

test('preferenceIncludesGrade treats empty as no opinion', () => {
	assert.equal(preferenceIncludesGrade([], 7), false);
	assert.equal(preferenceIncludesGrade(undefined, 7), false);
	assert.equal(preferenceIncludesGrade([7, 8], 8), true);
	assert.equal(preferenceIncludesGrade([7, 8], 9), false);
});

// ─── 3. Schema + migration: no school-year, additive only ───────────────────

test('FacultyGradePreference model has no schoolYearId and is uniquely keyed by school+faculty', () => {
	const schema = readFileSync(resolve(here, '..', '..', '..', 'prisma', 'schema.prisma'), 'utf8');
	const start = schema.indexOf('model FacultyGradePreference {');
	assert.notEqual(start, -1, 'model present');
	const end = schema.indexOf('\n}', start);
	const block = schema.slice(start, end + 2);
	assert.equal(block.includes('schoolYearId'), false, 'no schoolYearId field');
	assert.ok(block.includes('@@unique([schoolId, facultyId]'), 'unique identity is school+faculty');
	assert.ok(block.includes('@@map("faculty_grade_preferences")'));
});

test('the migration is additive and never applied by this candidate', () => {
	const sql = readFileSync(
		resolve(here, '..', '..', '..', 'prisma', 'migrations', '20260925000000_faculty_grade_preference', 'migration.sql'),
		'utf8',
	);
	assert.ok(sql.includes('CREATE TABLE "faculty_grade_preferences"'));
	assert.ok(sql.includes('"school_id" INTEGER NOT NULL'));
	assert.ok(sql.includes('"faculty_id" INTEGER NOT NULL'));
	assert.ok(sql.includes('"grade_levels" INTEGER[]'));
	assert.equal(/\bDROP\b/i.test(sql), false, 'no destructive statement');
	assert.equal(/"school_year_id"/.test(sql), false, 'no school-year column');
});

// ─── 4. Mounted router: authenticate + timetable:edit + actor-school scope ──

const JWT_SECRET = 'faculty-grade-preference-s7-disposable-proof-secret';
const SCHOOL_ID = 41;

function token(payload: Record<string, unknown>): string {
	return jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
}

async function request(
	baseUrl: string,
	path: string,
	method: 'GET' | 'PUT',
	jwtToken?: string,
	body?: unknown,
): Promise<{ status: number; payload: any }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 2_000);
	try {
		const response = await fetch(`${baseUrl}${path}`, {
			method,
			headers: { ...(jwtToken === undefined ? {} : { authorization: `Bearer ${jwtToken}` }), 'content-type': 'application/json' },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: controller.signal,
		});
		return { status: response.status, payload: await response.json() };
	} finally {
		clearTimeout(timeout);
	}
}

test('mounted grade-preference routes enforce authenticate + timetable:edit + actor-school scope', async () => {
	process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';
	process.env.JWT_SECRET = JWT_SECRET;
	process.env.ATLAS_SYSTEM_TOKEN = 'faculty-grade-preference-s7-system-token';

	const { prisma } = await import('../lib/prisma.js');
	const facultyRouter = (await import('../routes/faculty.router.js')).default;

	const dispatches = { findMany: 0, findFirst: 0, upsert: 0 };
	const originals = {
		findMany: prisma.facultyGradePreference.findMany,
		upsert: prisma.facultyGradePreference.upsert,
		findFirst: prisma.facultyMirror.findFirst,
	};
	prisma.facultyGradePreference.findMany = (async () => {
		dispatches.findMany += 1;
		return [{ facultyId: 9, gradeLevels: [7, 8], updatedAt: new Date('2026-09-25T00:00:00.000Z') }];
	}) as unknown as typeof prisma.facultyGradePreference.findMany;
	prisma.facultyMirror.findFirst = (async () => {
		dispatches.findFirst += 1;
		return { id: 9 };
	}) as unknown as typeof prisma.facultyMirror.findFirst;
	prisma.facultyGradePreference.upsert = (async (args: any) => {
		dispatches.upsert += 1;
		return { facultyId: args.where.schoolId_facultyId.facultyId, gradeLevels: args.create.gradeLevels, updatedAt: new Date('2026-09-25T00:00:00.000Z') };
	}) as unknown as typeof prisma.facultyGradePreference.upsert;

	const app = express();
	app.use(express.json());
	app.use('/api/v1/faculty', facultyRouter);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	const baseUrl = `http://127.0.0.1:${port}/api/v1/faculty`;

	const scheduler = token({ userId: 1, role: 'scheduler', authSource: 'local', schoolId: SCHOOL_ID });
	const crossSchool = token({ userId: 2, role: 'scheduler', authSource: 'local', schoolId: SCHOOL_ID + 1 });
	const noSchool = token({ userId: 3, role: 'scheduler', authSource: 'local' });
	const faculty = token({ userId: 4, role: 'faculty', authSource: 'local', schoolId: SCHOOL_ID });
	const reset = () => { dispatches.findMany = 0; dispatches.findFirst = 0; dispatches.upsert = 0; };
	const assertNoDispatch = () => assert.deepEqual(dispatches, { findMany: 0, findFirst: 0, upsert: 0 });

	try {
		reset();
		const noToken = await request(baseUrl, `/grade-preferences?schoolId=${SCHOOL_ID}`, 'GET');
		assert.equal(noToken.status, 401, 'no token');
		assert.equal(noToken.payload.code, 'NO_TOKEN');
		assertNoDispatch();

		reset();
		const teacherRead = await request(baseUrl, `/grade-preferences?schoolId=${SCHOOL_ID}`, 'GET', faculty);
		assert.equal(teacherRead.status, 403, 'faculty lacks timetable:edit');
		assert.equal(teacherRead.payload.code, 'FORBIDDEN');
		assertNoDispatch();

		reset();
		const crossRead = await request(baseUrl, `/grade-preferences?schoolId=${SCHOOL_ID}`, 'GET', crossSchool);
		assert.equal(crossRead.status, 403, 'cross-school read');
		assert.equal(crossRead.payload.code, 'CROSS_SCHOOL_DENIED');
		assertNoDispatch();

		reset();
		const noSchoolRead = await request(baseUrl, `/grade-preferences?schoolId=${SCHOOL_ID}`, 'GET', noSchool);
		assert.equal(noSchoolRead.status, 403, 'missing actor school');
		assert.equal(noSchoolRead.payload.code, 'SCHOOL_SCOPE_REQUIRED');
		assertNoDispatch();

		reset();
		const okRead = await request(baseUrl, `/grade-preferences?schoolId=${SCHOOL_ID}`, 'GET', scheduler);
		assert.equal(okRead.status, 200, `scheduler read: ${okRead.status}/${okRead.payload.code}`);
		assert.equal(Array.isArray(okRead.payload.preferences), true);
		assert.deepEqual(dispatches, { findMany: 1, findFirst: 0, upsert: 0 });

		reset();
		const invalidWrite = await request(baseUrl, `/9/grade-preference`, 'PUT', scheduler, { schoolId: SCHOOL_ID, gradeLevels: [1, 2] });
		assert.equal(invalidWrite.status, 400, 'EnrollPro grade-level IDs rejected');
		assert.equal(invalidWrite.payload.code, 'INVALID_GRADE_LEVELS');
		assertNoDispatch();

		reset();
		const crossWrite = await request(baseUrl, `/9/grade-preference`, 'PUT', scheduler, { schoolId: SCHOOL_ID + 1, gradeLevels: [7] });
		assert.equal(crossWrite.status, 403, 'cross-school write');
		assert.equal(crossWrite.payload.code, 'CROSS_SCHOOL_DENIED');
		assertNoDispatch();

		reset();
		const teacherWrite = await request(baseUrl, `/9/grade-preference`, 'PUT', faculty, { schoolId: SCHOOL_ID, gradeLevels: [7] });
		assert.equal(teacherWrite.status, 403, 'faculty lacks timetable:edit');
		assert.equal(teacherWrite.payload.code, 'FORBIDDEN');
		assertNoDispatch();

		reset();
		const okWrite = await request(baseUrl, `/9/grade-preference`, 'PUT', scheduler, { schoolId: SCHOOL_ID, gradeLevels: [8, 7, 7] });
		assert.equal(okWrite.status, 200, `scheduler write: ${okWrite.status}/${okWrite.payload.code}`);
		assert.deepEqual(okWrite.payload.preference.gradeLevels, [7, 8], 'validated + deduped + sorted');
		assert.deepEqual(dispatches, { findMany: 0, findFirst: 1, upsert: 1 });
	} finally {
		prisma.facultyGradePreference.findMany = originals.findMany;
		prisma.facultyGradePreference.upsert = originals.upsert;
		prisma.facultyMirror.findFirst = originals.findFirst;
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await prisma.$disconnect();
	}
});
