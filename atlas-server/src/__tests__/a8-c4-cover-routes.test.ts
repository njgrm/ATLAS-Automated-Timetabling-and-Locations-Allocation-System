/**
 * A8 c4 — the MOUNTED router surface: auth, actor-school scope, the strict
 * parameter contract, and the missing proof that `canTeachOutsideDepartment`
 * works for a REAL (non-placeholder) teacher.
 *
 * Hermetic: the REAL routers are mounted on a real `express` app and driven over
 * a real loopback socket with a real JWT, exactly as
 * `faculty-grade-preference-s7.test.ts` does. Data access is replaced on the
 * singleton Prisma client, so no database is contacted — `DATABASE_URL` points at
 * an unreachable port and every row served is a fixture.
 *
 * CONTRACT NOTE (recorded, not silently "fixed"): the fixed contract §5 names
 * `PUT /api/v1/faculty/:facultyId`. That route DOES NOT EXIST. The existing
 * endpoint that accepts `canTeachOutsideDepartment` for an existing teacher is
 * `PATCH /api/v1/faculty/:id`, which also requires `version` (optimistic
 * locking). The contract explicitly says "Do not build a new toggle endpoint",
 * so this suite proves the EXISTING route and the test records the exact request
 * a client must send. See the handoff.
 *
 * Run: npx tsx --test src/__tests__/a8-c4-cover-routes.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'a8-c4-cover-candidates-disposable-proof-secret';
const SCHOOL_ID = 41;
const OTHER_SCHOOL_ID = 42;
const YEAR_ID = 77;

process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';
process.env.JWT_SECRET = JWT_SECRET;
process.env.ATLAS_SYSTEM_TOKEN = 'a8-c4-cover-candidates-system-token';

const { prisma } = await import('../lib/prisma.js');
const coverRouter = (await import('../routes/teaching-load-cover.router.js')).default;
const permissionRouter = (await import('../routes/faculty-subject-permission.router.js')).default;
const facultyRouter = (await import('../routes/faculty.router.js')).default;

type Dispatch = { model: string; op: string };

/**
 * The REAL singleton methods, captured once, so this file restores them instead
 * of leaving the shared Prisma client nulled for whatever runs next.
 */
const REAL_PRISMA: Record<string, Record<string, unknown>> = (() => {
	const anyPrisma = prisma as unknown as Record<string, Record<string, unknown>>;
	const captured: Record<string, Record<string, unknown>> = {};
	for (const model of ['facultyMirror', 'facultySubject', 'crossDepartmentPermission']) {
		captured[model] = {};
		for (const op of ['findFirst', 'findMany', 'findUnique', 'update', 'updateMany']) {
			captured[model][op] = anyPrisma[model]?.[op];
		}
	}
	return captured;
})();

function restorePrisma(): void {
	const anyPrisma = prisma as unknown as Record<string, Record<string, unknown>>;
	for (const [model, ops] of Object.entries(REAL_PRISMA)) {
		for (const [op, original] of Object.entries(ops)) {
			anyPrisma[model][op] = original;
		}
	}
}

const dispatch: Dispatch[] = [];
let facultyRow: Record<string, unknown> = {};

/**
 * Serve fixtures for the three models the mounted routes touch, recording every
 * dispatch so a rejected request can be proven to have read nothing.
 */
function installFixtures(): void {
	const anyPrisma = prisma as unknown as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;
	const record = (model: string, op: string) => dispatch.push({ model, op });

	anyPrisma.facultyMirror.findFirst = async (args: any) => {
		record('facultyMirror', 'findFirst');
		const where = args?.where ?? {};
		if (where.id !== facultyRow.id) return null;
		if (where.schoolId !== undefined && where.schoolId !== facultyRow.schoolId) return null;
		return { ...facultyRow };
	};
	anyPrisma.facultyMirror.findMany = async () => {
		record('facultyMirror', 'findMany');
		return [{ ...facultyRow }];
	};
	anyPrisma.facultyMirror.findUnique = async (args: any) => {
		record('facultyMirror', 'findUnique');
		const where = args?.where ?? {};
		if (where.id !== undefined && where.id !== facultyRow.id) return null;
		return { ...facultyRow };
	};
	anyPrisma.facultyMirror.update = async (args: any) => {
		record('facultyMirror', 'update');
		facultyRow = { ...facultyRow, ...(args?.data ?? {}), version: ((facultyRow.version as number) ?? 1) + 1 };
		return { ...facultyRow };
	};
	anyPrisma.facultySubject.findMany = async () => {
		record('facultySubject', 'findMany');
		return [];
	};
	anyPrisma.facultySubject.findUnique = async () => {
		record('facultySubject', 'findUnique');
		return null;
	};
	anyPrisma.crossDepartmentPermission.findMany = async () => {
		record('crossDepartmentPermission', 'findMany');
		return [];
	};
	anyPrisma.crossDepartmentPermission.findUnique = async () => {
		record('crossDepartmentPermission', 'findUnique');
		// No permission rows exist in this world, so an absent delete is the
		// `removed: false` path the contract fixes.
		return null;
	};
}

async function startServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
	const app = express();
	app.use(express.json());
	app.use('/api/v1/teaching-load', coverRouter);
	app.use('/api/v1/faculty', permissionRouter);
	app.use('/api/v1/faculty', facultyRouter);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	return {
		baseUrl: `http://127.0.0.1:${port}`,
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
	};
}

function token(payload: Record<string, unknown>): string {
	return jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
}

const officer = token({ userId: 1, role: 'officer', authSource: 'local', schoolId: SCHOOL_ID });
const officerNoSchool = token({ userId: 3, role: 'officer', authSource: 'local' });
const teacher = token({ userId: 4, role: 'faculty', authSource: 'local', schoolId: SCHOOL_ID });

async function call(
	baseUrl: string,
	path: string,
	method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT',
	jwtToken?: string,
	body?: unknown,
): Promise<{ status: number; payload: any }> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 5_000);
	try {
		const response = await fetch(`${baseUrl}${path}`, {
			method,
			headers: {
				...(jwtToken === undefined ? {} : { authorization: `Bearer ${jwtToken}` }),
				'content-type': 'application/json',
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: controller.signal,
		});
		return { status: response.status, payload: await response.text().then((raw) => {
			try { return JSON.parse(raw); } catch { return { raw }; }
		}) };
	} catch (error) {
		return { status: 0, payload: { transportError: String(error) } };
	}
}

test('A8 c4 mounted cover + permission routes: auth, actor-school scope, strict params', async (t) => {
	dispatch.length = 0;
	facultyRow = {
		id: 46, schoolId: SCHOOL_ID, firstName: 'Maria', lastName: 'Reyes',
		department: 'SCI', canTeachOutsideDepartment: false, isPlaceholder: false,
		version: 3, maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false,
	};
	installFixtures();
	const { baseUrl, close } = await startServer();
	t.after(async () => {
		await close();
		restorePrisma();
	});

	const base = `/api/v1/teaching-load/${SCHOOL_ID}/${YEAR_ID}`;

	// 1. No token at all.
	const noToken = await call(baseUrl, `${base}/cover-open-classes`, 'GET');
	assert.equal(noToken.status, 401, `expected 401, got ${JSON.stringify(noToken.payload)}`);
	assert.equal(noToken.payload.code, 'NO_TOKEN');

	// 2. A non-privileged role is refused before any dispatch.
	dispatch.length = 0;
	const asTeacher = await call(baseUrl, `${base}/cover-open-classes`, 'GET', teacher);
	assert.equal(asTeacher.status, 403);
	assert.equal(asTeacher.payload.code, 'FORBIDDEN');
	assert.deepEqual(dispatch, [], 'a forbidden request performs zero reads');

	// 3. Cross-school actor is refused before any dispatch: the ACTOR is school 41
	// and the PATH asks for school 42.
	dispatch.length = 0;
	const crossSchool = await call(baseUrl, `/api/v1/teaching-load/${OTHER_SCHOOL_ID}/${YEAR_ID}/cover-open-classes`, 'GET', officer);
	assert.equal(crossSchool.status, 403, JSON.stringify(crossSchool.payload));
	assert.equal(crossSchool.payload.code, 'CROSS_SCHOOL_DENIED');
	assert.deepEqual(dispatch, [], 'a cross-school request performs zero reads');

	// 3b. The same rejection on the permission routes.
	dispatch.length = 0;
	const crossSchoolPermission = await call(
		baseUrl,
		`/api/v1/faculty/46/subject-permissions?schoolId=${OTHER_SCHOOL_ID}`,
		'GET',
		officer,
	);
	assert.equal(crossSchoolPermission.status, 403, JSON.stringify(crossSchoolPermission.payload));
	assert.equal(crossSchoolPermission.payload.code, 'CROSS_SCHOOL_DENIED');
	assert.deepEqual(dispatch, [], 'and again before any read');

	// 4. An actor with no school scope fails closed.
	dispatch.length = 0;
	const noSchool = await call(baseUrl, `${base}/cover-open-classes`, 'GET', officerNoSchool);
	assert.equal(noSchool.status, 403);
	assert.equal(noSchool.payload.code, 'SCHOOL_SCOPE_REQUIRED');
	assert.deepEqual(dispatch, []);

	// 5. cover-candidates refuses a missing subjectId/sectionId with 400 INVALID_PARAM.
	const missingSubject = await call(baseUrl, `${base}/cover-candidates?sectionId=305`, 'GET', officer);
	assert.equal(missingSubject.status, 400);
	assert.equal(missingSubject.payload.code, 'INVALID_PARAM');
	const missingSection = await call(baseUrl, `${base}/cover-candidates?subjectId=11`, 'GET', officer);
	assert.equal(missingSection.status, 400);
	assert.equal(missingSection.payload.code, 'INVALID_PARAM');
	const nonNumeric = await call(baseUrl, `${base}/cover-candidates?subjectId=abc&sectionId=305`, 'GET', officer);
	assert.equal(nonNumeric.status, 400);
	assert.equal(nonNumeric.payload.code, 'INVALID_PARAM');

	// 6. The permission routes carry schoolId on all three shapes.
	const missingSchool = await call(baseUrl, `/api/v1/faculty/46/subject-permissions`, 'GET', officer);
	assert.equal(missingSchool.status, 400);
	assert.equal(missingSchool.payload.code, 'INVALID_PARAM');

	const deleteMissingSchool = await call(baseUrl, `/api/v1/faculty/46/subject-permissions/11`, 'DELETE', officer);
	assert.equal(deleteMissingSchool.status, 400);
	assert.equal(deleteMissingSchool.payload.code, 'INVALID_PARAM');

	// 7. A teacher of ANOTHER school is refused at the service boundary.
	dispatch.length = 0;
	const foreignTeacher = await call(baseUrl, `/api/v1/faculty/${OTHER_SCHOOL_ID + 1000}/subject-permissions?schoolId=${SCHOOL_ID}`, 'GET', officer);
	assert.equal(foreignTeacher.status, 400);
	assert.equal(foreignTeacher.payload.code, 'SCHOOL_SCOPE_MISMATCH');

	// 8. The permission LIST for this school reads through and answers 200.
	dispatch.length = 0;
	const ownTeacher = await call(baseUrl, `/api/v1/faculty/46/subject-permissions?schoolId=${SCHOOL_ID}`, 'GET', officer);
	assert.equal(ownTeacher.status, 200, JSON.stringify(ownTeacher.payload));
	assert.equal(ownTeacher.payload.schoolId, SCHOOL_ID);
	assert.equal(ownTeacher.payload.facultyId, 46);
	assert.equal(ownTeacher.payload.canTeachOutsideDepartment, false);
	assert.ok(Array.isArray(ownTeacher.payload.subjects));
	assert.equal(ownTeacher.payload.subjects.length, 0);
	assert.ok(dispatch.some((entry: Dispatch) => entry.model === 'crossDepartmentPermission'), 'the list really read the permission table');

	// 9. The DELETE shape is path subjectId + query schoolId + NO body.
	dispatch.length = 0;
	const deleteAbsent = await call(baseUrl, `/api/v1/faculty/46/subject-permissions/11?schoolId=${SCHOOL_ID}`, 'DELETE', officer);
	assert.equal(deleteAbsent.status, 200, JSON.stringify(deleteAbsent.payload));
	assert.deepEqual(deleteAbsent.payload, { removed: false }, 'deleting an absent permission is 200 {removed:false}, never 404');
});

test('A8 c4: canTeachOutsideDepartment works for a REAL teacher through the existing PATCH /faculty/:id', async (t) => {	dispatch.length = 0;
	facultyRow = {
		id: 46, schoolId: SCHOOL_ID, firstName: 'Maria', lastName: 'Reyes',
		department: 'SCI', canTeachOutsideDepartment: false, isPlaceholder: false,
		version: 3, maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false,
	};
	installFixtures();
	const { baseUrl, close } = await startServer();
	t.after(async () => {
		await close();
		restorePrisma();
	});

	// The FIXED CONTRACT §5 names `PUT /api/v1/faculty/:facultyId`. That route does
	// not exist and this candidate adds no new endpoint, so the proof runs on the
	// route that DOES accept the field for an existing teacher.
	const putAttempt = await call(baseUrl, `/api/v1/faculty/46`, 'PUT', officer, { canTeachOutsideDepartment: true });
	assert.equal(putAttempt.status, 404, 'documented for the handoff: PUT /faculty/:id does not exist');

	const before = await call(baseUrl, `/api/v1/faculty/46?schoolId=${SCHOOL_ID}`, 'GET', officer);
	assert.equal(before.status, 200, JSON.stringify(before.payload));
	assert.equal(before.payload.faculty.canTeachOutsideDepartment, false, 'starts OFF');

	// `version` is mandatory: this route uses optimistic locking.
	const withoutVersion = await call(baseUrl, `/api/v1/faculty/46`, 'PATCH', officer, { canTeachOutsideDepartment: true });
	assert.equal(withoutVersion.status, 400);
	assert.equal(withoutVersion.payload.code, 'MISSING_FIELDS');

	const toggled = await call(baseUrl, `/api/v1/faculty/46`, 'PATCH', officer, {
		version: 3,
		canTeachOutsideDepartment: true,
	});
	assert.equal(toggled.status, 200, JSON.stringify(toggled.payload));
	assert.equal(facultyRow.canTeachOutsideDepartment, true, 'the REAL (non-placeholder) teacher was persisted with the blanket flag');
	assert.equal(facultyRow.isPlaceholder, false, 'and she is a real teacher, not a placeholder');
	assert.ok(dispatch.some((entry: Dispatch) => entry.model === 'facultyMirror' && entry.op === 'update'),
		'the toggle is a real write through the production route');

	const after = await call(baseUrl, `/api/v1/faculty/46?schoolId=${SCHOOL_ID}`, 'GET', officer);
	assert.equal(after.payload.faculty.canTeachOutsideDepartment, true, 'the flag reads back true');
});
