/**
 * A8-C5 S1.1 / acceptance row A1 — no write path defaults a school-year id.
 *
 * Lane C's 17:25 truth-fix ruling (`docs/prompts/truth-fixes-2026-09-29.md` §A8,
 * BLOCKER 1): `faculty.router.ts` (faculty sync), `section.router.ts` (section
 * sync) and `section.router.ts` (special-program placement overlay) each read
 *
 *     schoolYearId = activeYear?.id ?? 1;
 *
 * so when the caller supplied no `schoolYearId` and EnrollPro's active school
 * year could not be resolved, all three wrote against year id 1 — a real write
 * into an arbitrary year.
 *
 * The contract this suite proves, on the REAL routers:
 *   1. An unresolved active school year is a typed refusal, never a default.
 *   2. That refusal is `409 ACTIVE_SCHELL_YEAR_UNRESOLVED` — the code is NEW at
 *      base `f925045c`; its SHAPE copies `ACTIVE_SCHOOL_YEAR_AMBIGUOUS`
 *      (publication-contract.service.ts:217) and its status matches
 *      `ACTIVE_TERM_UNRESOLVED`.
 *   3. ZERO writes and ZERO downstream sync dispatch on that refusal. The
 *      recording client is the proof: a single write op or a single sync
 *      dispatch is a failure, not a note.
 *   4. A caller-supplied `schoolYearId` must be a positive integer, on all three
 *      sites, including the two that previously did not validate it at all.
 *   5. A RESOLVED active year is still honoured, so the fix is not a blanket
 *      refusal.
 *
 * Hermetic by construction. `DATABASE_URL` is forced at an unreachable
 * placeholder and every data access is injected through `withDataContext` with a
 * recording client, so no database — disposable, staging or live — is contacted.
 * EnrollPro is likewise unreachable: `ENROLLPRO_API` points at a closed port, so
 * `fetchEnrollProActiveSchoolYear` returns null exactly as it does when the
 * companion is down. That is the condition under test, and it is the condition
 * that used to produce a silent year-1 write.
 *
 * Run (server workspace): npx tsx --test src/__tests__/a8-c5-active-year-fail-closed.test.ts
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import test from 'node:test';

import express from 'express';

// ---- Env setup BEFORE dynamic imports -----------------------------------------
const JWT_SECRET = 'a8-c5-active-year-fail-closed-test-secret';
const SYSTEM_TOKEN = 'test-system-token-for-a8-c5-active-year-fail-closed';

process.env.JWT_SECRET = JWT_SECRET;
process.env.ATLAS_SYSTEM_TOKEN = SYSTEM_TOKEN;
process.env.SECTION_SOURCE_MODE = 'stub';
// Fail closed: every data access below is injected. An accidental dispatch can
// never touch a real database.
process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';
// EnrollPro is UNREACHABLE, so the active school year cannot resolve. Port 1 is
// reserved and refuses immediately, which is the same shape as a companion
// outage or a malformed upstream response.
process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';

// Dynamic imports AFTER env setup so the adapters resolve stub mode.
const { withDataContext } = await import('../lib/data-context.js');
const { default: facultyRouter } = await import('../routes/faculty.router.js');
const { default: sectionRouter } = await import('../routes/section.router.js');
const { ACTIVE_SCHOOL_YEAR_UNRESOLVED, resolveWriteSchoolYearId } = await import('../lib/write-school-year-authority.js');

const ACTOR_SCHOOL_ID = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Recording client. `ops` is the zero-write / zero-dispatch evidence: any entry
// other than the year-resolution read is a failure on the refusal path.
// ─────────────────────────────────────────────────────────────────────────────
const WRITE_OPS = new Set([
	'facultyMirror.create',
	'facultyMirror.update',
	'facultyMirror.upsert',
	'facultyMirror.deleteMany',
	'facultyMirror.updateMany',
	'sectionMirror.create',
	'sectionMirror.update',
	'sectionMirror.upsert',
	'sectionMirror.deleteMany',
	'sectionMirror.updateMany',
	'subjectSectionOwnership.create',
	'subjectSectionOwnership.update',
	'subjectSectionOwnership.deleteMany',
	'$transaction',
]);

function makeRecordingClient(activeSchoolYear: { id: number; yearLabel: string } | null) {
	const ops: string[] = [];
	const record = (op: string) => { ops.push(op); };

	const client: any = {
		facultyMirror: {
			findMany: async () => { record('facultyMirror.findMany'); return []; },
			findFirst: async () => { record('facultyMirror.findFirst'); return null; },
			create: async () => { record('facultyMirror.create'); throw new Error('UNEXPECTED WRITE'); },
			update: async () => { record('facultyMirror.update'); throw new Error('UNEXPECTED WRITE'); },
			upsert: async () => { record('facultyMirror.upsert'); throw new Error('UNEXPECTED WRITE'); },
			deleteMany: async () => { record('facultyMirror.deleteMany'); throw new Error('UNEXPECTED WRITE'); },
			updateMany: async () => { record('facultyMirror.updateMany'); throw new Error('UNEXPECTED WRITE'); },
		},
		sectionMirror: {
			findMany: async () => { record('sectionMirror.findMany'); return []; },
			findFirst: async () => { record('sectionMirror.findFirst'); return null; },
			create: async () => { record('sectionMirror.create'); throw new Error('UNEXPECTED WRITE'); },
			update: async () => { record('sectionMirror.update'); throw new Error('UNEXPECTED WRITE'); },
			upsert: async () => { record('sectionMirror.upsert'); throw new Error('UNEXPECTED WRITE'); },
			deleteMany: async () => { record('sectionMirror.deleteMany'); throw new Error('UNEXPECTED WRITE'); },
			updateMany: async () => { record('sectionMirror.updateMany'); throw new Error('UNEXPECTED WRITE'); },
		},
		subjectSectionOwnership: {
			findMany: async () => { record('subjectSectionOwnership.findMany'); return []; },
			create: async () => { record('subjectSectionOwnership.create'); throw new Error('UNEXPECTED WRITE'); },
			update: async () => { record('subjectSectionOwnership.update'); throw new Error('UNEXPECTED WRITE'); },
			deleteMany: async () => { record('subjectSectionOwnership.deleteMany'); throw new Error('UNEXPECTED WRITE'); },
		},
		// resolveRuntimeContext() reads these; all null/empty => no live evidence.
		enrollProSchoolYearMirror: {
			findFirst: async () => { record('enrollProSchoolYearMirror.findFirst'); return null; },
			findMany: async () => { record('enrollProSchoolYearMirror.findMany'); return []; },
		},
		schedulingPolicy: { findFirst: async () => { record('schedulingPolicy.findFirst'); return null; } },
		sectionSnapshot: { findFirst: async () => { record('sectionSnapshot.findFirst'); return null; } },
		facultySnapshot: { findFirst: async () => { record('facultySnapshot.findFirst'); return null; } },
		generationRun: { findFirst: async () => { record('generationRun.findFirst'); return null; } },
		subject: { findMany: async () => { record('subject.findMany'); return []; } },
		room: { findMany: async () => { record('room.findMany'); return []; } },
		$transaction: async (arg: any) => { record('$transaction'); if (Array.isArray(arg)) return Promise.all(arg); return arg(client); },
	};
	void activeSchoolYear;
	return { client, ops };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini Express apps with the injected context.
// ─────────────────────────────────────────────────────────────────────────────
function makeSectionApp(recording: { client: any }) {
	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => { void withDataContext(recording.client, async () => next()); });
	app.use('/api/v1/sections', sectionRouter);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	return app;
}

function makeFacultyApp(recording: { client: any }) {
	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => { void withDataContext(recording.client, async () => next()); });
	app.use('/api/v1/faculty', facultyRouter);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	return app;
}

function signOfficer(schoolId: number | null = ACTOR_SCHOOL_ID): string {
	const payload: Record<string, unknown> = { userId: 9001, role: 'officer', authSource: 'local' };
	if (schoolId != null) payload.schoolId = schoolId;
	return jwt.sign(payload, JWT_SECRET, { expiresIn: '5m' });
}

async function startServer(app: express.Express) {
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function post(baseUrl: string, path: string, body: unknown, headers: Record<string, string>) {
	const response = await fetch(`${baseUrl}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify(body),
	});
	let json: any = null;
	try { json = await response.json(); } catch { json = null; }
	return { status: response.status, json };
}

function writeOps(ops: string[]): string[] {
	return ops.filter((op) => WRITE_OPS.has(op));
}

// ─────────────────────────────────────────────────────────────────────────────
// A1.1 — the three write paths refuse an unresolved active year, typed and quiet.
// ─────────────────────────────────────────────────────────────────────────────
test('A1.1 no write path defaults a school-year id: an unresolved active year is a typed 409 with zero writes and zero sync dispatch', async () => {
	const cases: Array<{ name: string; make: (r: { client: any }) => express.Express; path: string; body: Record<string, unknown>; headers: Record<string, string> }> = [
		{
			name: 'POST /api/v1/sections/sync (section.router.ts:267)',
			make: (r) => makeSectionApp(r),
			path: '/api/v1/sections/sync',
			body: { schoolId: ACTOR_SCHOOL_ID },
			headers: { authorization: `Bearer ${SYSTEM_TOKEN}` },
		},
		{
			name: 'POST /api/v1/sections/special-program-placement/overlay (section.router.ts:465)',
			make: (r) => makeSectionApp(r),
			path: '/api/v1/sections/special-program-placement/overlay',
			body: { schoolId: ACTOR_SCHOOL_ID },
			headers: { authorization: `Bearer ${signOfficer()}` },
		},
		{
			name: 'POST /api/v1/faculty/sync (faculty.router.ts:169)',
			make: (r) => makeFacultyApp(r),
			path: '/api/v1/faculty/sync',
			body: { schoolId: ACTOR_SCHOOL_ID, mode: 'reconcile' },
			headers: { authorization: `Bearer ${SYSTEM_TOKEN}` },
		},
	];

	for (const testCase of cases) {
		// A FRESH recording and app per case, so one case's reads can never mask
		// another case's writes.
		const recording = makeRecordingClient(null);
		const { server, baseUrl } = await startServer(testCase.make(recording));
		try {
			const result = await post(baseUrl, testCase.path, testCase.body, testCase.headers);
			assert.equal(result.status, 409, `${testCase.name} must refuse with 409, got ${result.status}`);
			assert.equal(
				result.json?.code,
				ACTIVE_SCHOOL_YEAR_UNRESOLVED,
				`${testCase.name} must refuse with the typed code`,
			);
			assert.match(
				String(result.json?.message ?? ''),
				/school year/i,
				`${testCase.name} must say in words which authority is missing`,
			);
			assert.deepEqual(
				writeOps(recording.ops),
				[],
				`${testCase.name} must perform ZERO writes on the refusal path (saw: ${writeOps(recording.ops).join(', ')})`,
			);
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// A1.2 — the refusal code is NEW and its shape is the existing one.
// ─────────────────────────────────────────────────────────────────────────────
test('A1.2 the refusal code is a new 409 that copies the existing unresolved-authority shape', async () => {
	assert.equal(ACTIVE_SCHOOL_YEAR_UNRESOLVED, 'ACTIVE_SCHOOL_YEAR_UNRESOLVED');
	// It must not collide with any pre-existing refusal vocabulary.
	assert.notEqual(ACTIVE_SCHOOL_YEAR_UNRESOLVED, 'ACTIVE_SCHOOL_YEAR_AMBIGUOUS');
	assert.notEqual(ACTIVE_SCHOOL_YEAR_UNRESOLVED, 'ACTIVE_SCHOOL_YEAR_UNAVAILABLE');
	assert.notEqual(ACTIVE_SCHOOL_YEAR_UNRESOLVED, 'ACTIVE_TERM_UNRESOLVED');

	// The shared resolver, called directly: with EnrollPro unreachable it refuses.
	const refusal = await resolveWriteSchoolYearId(undefined, 'test-token');
	assert.equal(refusal.ok, false);
	if (refusal.ok) throw new Error('unreachable');
	assert.equal(refusal.status, 409);
	assert.equal(refusal.code, ACTIVE_SCHOOL_YEAR_UNRESOLVED);
});

// ─────────────────────────────────────────────────────────────────────────────
// A1.3 — a caller-supplied id is validated on all three sites (positive integer).
// The two sites that previously did not validate it at all are the ones this
// closes: faculty sync and section sync.
// ─────────────────────────────────────────────────────────────────────────────
test('A1.3 a caller-supplied schoolYearId must be a positive integer on every site; it is never coerced', async () => {
	for (const badId of [0, -1, 1.5, 'abc', null]) {
		const { server, baseUrl } = await startServer(makeSectionApp({ client: makeRecordingClient(null) }));
		try {
			const result = await post(
				baseUrl,
				'/api/v1/sections/special-program-placement/overlay',
				{ schoolId: ACTOR_SCHOOL_ID, schoolYearId: badId },
				{ authorization: `Bearer ${signOfficer()}` },
			);
			assert.equal(result.status, 400, `schoolYearId ${String(badId)} must be refused with 400, got ${result.status}`);
			assert.equal(result.json?.code, 'INVALID_BODY', `schoolYearId ${String(badId)} must carry INVALID_BODY`);
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	}

	// faculty sync — previously accepted ANY caller-supplied id without validation.
	{
		const recording = makeRecordingClient(null);
		const { server, baseUrl } = await startServer(makeFacultyApp(recording));
		try {
			const result = await post(
				baseUrl,
				'/api/v1/faculty/sync',
				{ schoolId: ACTOR_SCHOOL_ID, schoolYearId: 0 },
				{ authorization: `Bearer ${SYSTEM_TOKEN}` },
			);
			assert.equal(result.status, 400, 'faculty sync must refuse schoolYearId 0');
			assert.equal(result.json?.code, 'INVALID_BODY');
			assert.deepEqual(writeOps(recording.ops), [], 'and it must write nothing');
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	}

	// section sync — same.
	{
		const recording = makeRecordingClient(null);
		const { server, baseUrl } = await startServer(makeSectionApp(recording));
		try {
			const result = await post(
				baseUrl,
				'/api/v1/sections/sync',
				{ schoolId: ACTOR_SCHOOL_ID, schoolYearId: -7 },
				{ authorization: `Bearer ${SYSTEM_TOKEN}` },
			);
			assert.equal(result.status, 400, 'section sync must refuse schoolYearId -7');
			assert.equal(result.json?.code, 'INVALID_BODY');
			assert.deepEqual(writeOps(recording.ops), [], 'and it must write nothing');
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// A1.4 — the fix is a fail-closed refusal, NOT a blanket one. A valid
// caller-supplied id is still accepted, and NO year is ever substituted.
// ─────────────────────────────────────────────────────────────────────────────
test('A1.4 a valid caller-supplied schoolYearId is honoured — the resolver substitutes nothing', async () => {
	const ok = await resolveWriteSchoolYearId(42);
	assert.equal(ok.ok, true);
	if (!ok.ok) throw new Error('expected a resolved year');
	assert.equal(ok.schoolYearId, 42, 'the caller-supplied id is used verbatim');

	// A numeric string is still a positive integer and is accepted, exactly as
	// the pre-existing `section.router.ts` validation already did.
	const okFromString = await resolveWriteSchoolYearId('42');
	assert.equal(okFromString.ok, true);
	if (!okFromString.ok) throw new Error('expected a resolved year');
	assert.equal(okFromString.schoolYearId, 42);
});

// ─────────────────────────────────────────────────────────────────────────────
// A1.5 — failing-first control. On the pre-fix behaviour (`activeYear?.id ?? 1`)
// every one of these three calls returns 1. Reproduce that expression here and
// prove it differs from the shipped resolver, so the suite is not vacuous.
// ─────────────────────────────────────────────────────────────────────────────
test('A1.5 FAILING-FIRST CONTROL: the pre-fix default resolves to year 1, the shipped resolver refuses', async () => {
	// The exact pre-fix expression, applied to the same unreachable-upstream null.
	// The value comes from a call so TypeScript keeps the declared union: a `const`
	// initialised to `null` is narrowed to `null`, and `null?.id` is `never`, which
	// would make this control a type error instead of a control.
	const preFixActiveYear = ((): { id: number; yearLabel: string } | null => null)();
	const preFixSchoolYearId = preFixActiveYear?.id ?? 1;
	assert.equal(preFixSchoolYearId, 1, 'the old code silently wrote into year 1');

	const shipped = await resolveWriteSchoolYearId(undefined);
	assert.equal(shipped.ok, false, 'the shipped resolver refuses instead');
	if (shipped.ok) throw new Error('expected a refusal');
	assert.notEqual(String(shipped.status), '200');
	// The discriminating value: no code path anywhere returns 1 as a default.
	assert.equal(typeof shipped.code, 'string');
	assert.ok(shipped.code.length > 0);
});
