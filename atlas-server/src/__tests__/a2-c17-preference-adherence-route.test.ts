/**
 * A2 C17 — the preference-adherence READ route (R8).
 *
 * WHAT IS REAL HERE: the express app, the real `generationRouter`, the real
 * `authenticate` middleware and JWT verification, the real capability gate, the
 * real `assertRequestSchoolScope` actor-school gate, the real service and the real
 * `computePreferenceAdherence` derivation. Every assertion below is decided by
 * production code.
 *
 * WHAT IS FAKED, AND WHY IT IS DISCLOSED: only STORAGE. This worktree has no
 * `psql` and no `.env`, so the repository's disposable-PostgreSQL harness
 * (`isDisposableHarnessAvailable()`) is false and a suite built on it would SKIP.
 * A skip is not evidence, so the data-access client is an in-memory recorder
 * injected through the repository's OWN seam — `withDataContext` from
 * `lib/data-context.ts` — rather than by replacing a module. That seam exists
 * precisely so a test can observe the exact production data-access path.
 *
 * The zero-write row does NOT rest on that fake alone. `zeroWriteTokens` also
 * greps the committed service and route source for any create/update/delete
 * verb, so a future edit that adds a write fails this suite even if the fake were
 * made permissive. The residual — that Prisma's own query shape is not exercised
 * here — is recorded in the handoff as NON_BLOCKING.
 *
 * Run: `npm run test:a2-c17-preference-adherence`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import express from 'express';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'a2-c17-preference-adherence-route-secret';
process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';

const { withDataContext } = await import('../lib/data-context.js');
const { errorHandler } = await import('../middleware/errorHandler.js');
const { default: generationRouter } = await import('../routes/generation.router.js');

const SCHOOL_ID = 1;
const YEAR_ID = 7;
const RUN_ID = 321;
const OTHER_YEAR_ID = 8;
const TERM = 1;

function token(payload: Record<string, unknown>): string {
	return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '5m' });
}

const PRIVILEGED = token({ userId: 46, role: 'officer', schoolId: SCHOOL_ID, capabilities: ['timetable:read', 'timetable:review', 'timetable:edit'] });
const CROSS_SCHOOL = token({ userId: 47, role: 'officer', schoolId: 99, capabilities: ['timetable:read'] });
const NO_SCHOOL = token({ userId: 48, role: 'officer', capabilities: ['timetable:read'] });
const NO_CAPABILITY = token({ userId: 49, role: 'teacher', schoolId: SCHOOL_ID });

// ─── The recording data-access client ───

type Call = { model: string; method: string };

const WRITE_METHODS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);

type Recorder = { calls: Call[]; state: 'ok' };

function availabilityRows() {
	return [
		{
			schoolId: SCHOOL_ID, schoolYearId: YEAR_ID, termIndex: TERM, facultyId: 10, status: 'REVIEWED',
			slots: [
				// Friday afternoon, painted the way the picker actually stores it.
				{ day: 'FRIDAY', startTime: '13:00', endTime: '14:00', state: 'UNAVAILABLE' },
				{ day: 'FRIDAY', startTime: '14:00', endTime: '15:00', state: 'UNAVAILABLE' },
				{ day: 'MONDAY', startTime: '08:00', endTime: '09:00', state: 'UNAVAILABLE' },
				{ day: 'TUESDAY', startTime: '08:00', endTime: '09:00', state: 'PREFERRED' },
			],
		},
		// Another year entirely: must never be counted.
		{
			schoolId: SCHOOL_ID, schoolYearId: OTHER_YEAR_ID, termIndex: TERM, facultyId: 10, status: 'REVIEWED',
			slots: [{ day: 'MONDAY', startTime: '08:00', endTime: '09:00', state: 'UNAVAILABLE' }],
		},
		{
			schoolId: SCHOOL_ID, schoolYearId: YEAR_ID, termIndex: TERM, facultyId: 11, status: 'DRAFT',
			slots: [{ day: 'MONDAY', startTime: '10:00', endTime: '11:00', state: 'PREFERRED' }],
		},
	];
}

const RUN = {
	id: RUN_ID,
	// One class INSIDE the Monday 08:00-09:00 unavailable window (so it is not
	// kept), and one class inside the Friday 13:00-15:00 block (also not kept).
	// One class in the Tuesday preferred window (met).
	draftEntries: [
		{ entryId: 'e1', facultyId: 10, day: 'MONDAY', startTime: '08:30', endTime: '09:00', termIndex: TERM },
		{ entryId: 'e2', facultyId: 10, day: 'FRIDAY', startTime: '13:00', endTime: '14:00', termIndex: TERM },
		{ entryId: 'e3', facultyId: 10, day: 'TUESDAY', startTime: '08:00', endTime: '09:00', termIndex: TERM },
		{ entryId: 'e4', facultyId: 10, day: 'WEDNESDAY', startTime: '08:00', endTime: '09:00', termIndex: 2 },
	],
};

function makeClient(recorder: Recorder, options: { runVisible: boolean }) {
	const record = (model: string, method: string) => { recorder.calls.push({ model, method }); };
	return {
		generationRun: {
			async findFirst(args: any) {
				record('generationRun', 'findFirst');
				if (!options.runVisible) return null;
				const { id, schoolId, schoolYearId } = args.where;
				return id === RUN_ID && schoolId === SCHOOL_ID && schoolYearId === YEAR_ID ? RUN : null;
			},
		},
		facultyAvailability: {
			async findMany(args: any) {
				record('facultyAvailability', 'findMany');
				const { schoolId, schoolYearId } = args.where;
				return availabilityRows().filter((row) => row.schoolId === schoolId && row.schoolYearId === schoolYearId);
			},
		},
		facultyMirror: {
			async findMany() {
				record('facultyMirror', 'findMany');
				return [
					{ id: 10, firstName: 'Ana', lastName: 'Dela Cruz' },
					{ id: 11, firstName: 'Ben', lastName: 'Reyes' },
				];
			},
		},
		enrollProSchoolYearMirror: {
			async findUnique(args: any) {
				record('enrollProSchoolYearMirror', 'findUnique');
				// The production where-clause is the COMPOUND key
				// `schoolId_enrollProSchoolYearId: { … }`, not two flat fields.
				const { schoolId, enrollProSchoolYearId } = args.where.schoolId_enrollProSchoolYearId ?? {};
				return {
					isActive: true,
					isArchived: false,
					// The shape `normalizePersistedTermStructure` accepts: a
					// `schoolYear.id`, a supported format, and exactly one term per
					// format slot, each with an identity and a display label.
					termContractCache: {
						schoolId,
						schoolYear: { id: enrollProSchoolYearId },
						format: 'TRIMESTER',
						terms: [
							{ order: 1, identity: 'T1', displayLabel: 'Term 1' },
							{ order: 2, identity: 'T2', displayLabel: 'Term 2' },
							{ order: 3, identity: 'T3', displayLabel: 'Term 3' },
						],
						activeTerm: { order: 1 },
					},
					termContractCachedAt: new Date('2026-09-01T00:00:00Z'),
				};
			},
		},
		termContractCache: {
			async findFirst() { record('termContractCache', 'findFirst'); return null; },
		},
	};
}

// ─── Driving the real app without a network ───

const app = express();
app.use(express.json());
app.use('/api/v1/generation', generationRouter);
app.use(errorHandler);

type Captured = { status: number; body: any };

async function call(path: string, bearer: string | null): Promise<Captured> {
	const captured: Captured = { status: 0, body: undefined };
	const req: any = {
		method: 'GET',
		url: path,
		originalUrl: path,
		path,
		headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
		query: Object.fromEntries(new URL(path, 'http://localhost').searchParams),
		params: {},
		body: undefined,
		socket: { remoteAddress: '127.0.0.1' },
		connection: { remoteAddress: '127.0.0.1' },
		get(name: string) { return this.headers[name.toLowerCase()]; },
	};
	const res: any = {
		statusCode: 200,
		headersSent: false,
		locals: {},
		app,
		setHeader() { return res; },
		getHeader() { return undefined; },
		removeHeader() {},
		write() { return true; },
		end(chunk?: any) {
			res.headersSent = true;
			if (chunk !== undefined && chunk !== null && chunk !== '') {
				try { captured.body = JSON.parse(String(chunk)); } catch { captured.body = String(chunk); }
			}
			captured.status = res.statusCode;
		},
		writeHead(code: number) { res.statusCode = code; return res; },
		on() { return res; },
		once() { return res; },
		emit() { return false; },
	};
	await new Promise<void>((done) => {
		let settled = false;
		const finish = () => { if (!settled) { settled = true; done(); } };
		const originalEnd = res.end.bind(res);
		res.end = (chunk?: any, ...rest: any[]) => {
			originalEnd(chunk, ...rest);
			// The response is complete only when express has actually ended it. A
			// microtask drain is NOT enough here: the route awaits the injected
			// client, so a fixed tick count would report the untouched default
			// statusCode of 200 and hide a real rejection.
			finish();
			return res;
		};
		// A bounded macrotask drain covers a rejection path that never calls end().
		let ticks = 0;
		const pump = () => {
			if (settled || ticks > 200) { finish(); return; }
			ticks += 1;
			setImmediate(pump);
		};
		pump();
		app(req, res);
	});
	if (captured.status === 0) captured.status = res.statusCode;
	return captured;
}

async function withRecorder<T>(options: { runVisible?: boolean } | undefined, fn: (recorder: Recorder) => Promise<T>): Promise<{ result: T; recorder: Recorder }> {
	const recorder: Recorder = { calls: [], state: 'ok' };
	const client = makeClient(recorder, { runVisible: options?.runVisible ?? true });
	const result = await withDataContext(client, () => fn(recorder));
	return { result, recorder };
}

const BASE = `/api/v1/generation/${SCHOOL_ID}/${YEAR_ID}/runs/${RUN_ID}/preference-adherence`;

// ─── R8: the route ───

test('R8a: a visible run returns 200 with a computed report, and the two unavailable times are counted as groups', async () => {
	const { result, recorder } = await withRecorder({}, async () => {
		const captured = await call(`${BASE}?termIndex=1`, PRIVILEGED);
		assert.equal(captured.status, 200, JSON.stringify(captured.body));
		return captured.body;
	});

	assert.equal(result.runId, RUN_ID);
	assert.equal(result.schoolYearId, YEAR_ID);
	assert.equal(result.termIndex, TERM);
	// Friday 13:00-15:00 collapses to ONE block; Monday 08:00-09:00 is the second.
	assert.equal(result.totals.unavailableSlots, 2, 'two painted things, not three painted rows');
	assert.equal(result.totals.unavailableKept, 0, 'both windows carry a class');
	assert.equal(result.totals.preferredSlots, 1);
	assert.equal(result.totals.preferredMet, 1);
	assert.equal(result.hasAny, true);
	assert.equal(result.notReviewedTeacherCount, 1);
	assert.deepEqual(result.notReviewedTeacherNames, ['Reyes, Ben'], 'the name is never a bare id');
	assert.deepEqual(
		result.teachers.map((teacher: any) => teacher.name),
		['Dela Cruz, Ana'],
	);
	assert.deepEqual(
		result.teachers[0].groups.map((group: any) => group.label),
		['Unavailable Monday morning', 'Unavailable Friday afternoon', 'Prefers Tuesday morning'],
		'labels read in week order and never carry a raw enum',
	);
	// A Term-2 class must not have been counted against the Term-1 report.
	assert.equal(result.teachers[0].groups[2].metCount, 1);

	assert.ok(recorder.calls.length > 0, 'the real data-access path was exercised');
});

test('R8b [ZERO WRITE]: no create/update/delete/upsert reaches the data-access client, on any outcome', async () => {
	const { recorder } = await withRecorder({}, async () => {
		await call(`${BASE}?termIndex=1`, PRIVILEGED);
		await call(`${BASE}?termIndex=99`, PRIVILEGED);
		await call(`${BASE}?termIndex=1`, CROSS_SCHOOL);
		await call(`${BASE}?termIndex=1`, NO_CAPABILITY);
		await call(`${BASE}?termIndex=1`, null);
		return null;
	});

	const writes = recorder.calls.filter((call) => WRITE_METHODS.has(call.method));
	assert.deepEqual(writes, [], `zero-write row failed: ${JSON.stringify(writes)}`);
	assert.ok(
		recorder.calls.every((call) => ['findFirst', 'findMany', 'findUnique'].includes(call.method)),
		`only reads are reachable: ${JSON.stringify([...new Set(recorder.calls.map((c) => c.method))])}`,
	);
});

test('R8c [ZERO WRITE, source level]: the committed service and route contain no write verb at all', () => {
	// The test file lives in `src/__tests__/`, so `import.meta.dirname` IS `src`.
	const sources = [
		'services/preference-adherence.service.ts',
		'routes/generation.router.ts',
	].map((relative) => readFileSync(resolve(import.meta.dirname, '..', relative), 'utf8'));

	// The route file is shared with every other generation endpoint, so the write
	// check is scoped to THIS route's own block plus the whole service file.
	const service = sources[0];
	const routeBlock = sources[1].slice(
		sources[1].indexOf('runs/:runId/preference-adherence'),
		sources[1].indexOf('// ─── GET /:schoolId/:schoolYearId/runs — run history'),
	);
	assert.ok(routeBlock.length > 200, 'the route block was located, so this check is not vacuous');

	const forbidden = /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;
	assert.doesNotMatch(service, forbidden, 'the service reaches no write verb');
	assert.doesNotMatch(routeBlock, forbidden, 'the route reaches no write verb');
});

test('R8d: a malformed run id is a typed 400, and a bad or missing term is a typed 4xx — never a default Term 1', async () => {
	await withRecorder({}, async () => {
		const badRun = await call(`/api/v1/generation/${SCHOOL_ID}/${YEAR_ID}/runs/not-a-number/preference-adherence?termIndex=1`, PRIVILEGED);
		assert.equal(badRun.status, 400);
		assert.equal(badRun.body.code, 'INVALID_PARAM');

		const zeroRun = await call(`/api/v1/generation/${SCHOOL_ID}/${YEAR_ID}/runs/0/preference-adherence?termIndex=1`, PRIVILEGED);
		assert.equal(zeroRun.status, 400);

		const noTerm = await call(BASE, PRIVILEGED);
		assert.equal(noTerm.status, 400);
		assert.equal(noTerm.body.code, 'TERM_INDEX_REQUIRED', 'a missing term is refused, never assumed');

		const badTerm = await call(`${BASE}?termIndex=abc`, PRIVILEGED);
		assert.equal(badTerm.status, 400);
		assert.equal(badTerm.body.code, 'INVALID_TERM_INDEX');

		// Two DISTINCT failures, deliberately not collapsed into one: a term that
		// is not a well-formed index is a transport error, and a well-formed index
		// that this year has no verified term for is an authority error.
		const outOfContract = await call(`${BASE}?termIndex=4`, PRIVILEGED);
		assert.equal(outOfContract.status, 400, 'a term outside this year’s contract is refused, not clamped');
		assert.equal(outOfContract.body.code, 'TERM_INDEX_OUTSIDE_CONTRACT');

		// `active` resolves through the verified contract, so it is an explicit
		// choice and not a silent Term 1.
		const active = await call(`${BASE}?termIndex=active`, PRIVILEGED);
		assert.equal(active.status, 200);
		assert.equal(active.body.termIndex, 1, 'active resolved to the contract’s active term');
	});
});

test('R8e: a run outside the actor school is a typed 404 and no availability data is read at all', async () => {
	const { recorder } = await withRecorder({ runVisible: false }, async () => {
		const captured = await call(`${BASE}?termIndex=1`, PRIVILEGED);
		assert.equal(captured.status, 404);
		assert.equal(captured.body.code, 'RUN_NOT_FOUND');
		return captured;
	});

	assert.ok(
		!recorder.calls.some((call) => call.model === 'facultyAvailability' || call.model === 'facultyMirror'),
		`an invisible run reads no availability or faculty data: ${JSON.stringify(recorder.calls)}`,
	);
});

test('R8f: the actor-school and capability gates fail closed before any data read at all', async () => {
	await withRecorder({}, async () => {
		// The actor's school is 99 and the path asks for school 1.
		const crossSchool = await call(BASE, CROSS_SCHOOL);
		assert.equal(crossSchool.status, 403, `cross school got ${crossSchool.status}`);
		assert.equal(crossSchool.body.code, 'CROSS_SCHOOL_DENIED');

		const noSchool = await call(BASE, NO_SCHOOL);
		assert.equal(noSchool.status, 403, `no actor school got ${noSchool.status}`);
		assert.equal(noSchool.body.code, 'SCHOOL_SCOPE_REQUIRED');

		const noCapability = await call(BASE, NO_CAPABILITY);
		assert.equal(noCapability.status, 403, `no capability got ${noCapability.status}`);
		assert.equal(noCapability.body.code, 'FORBIDDEN');

		const anonymous = await call(BASE, null);
		assert.ok(anonymous.status === 401 || anonymous.status === 403, `anonymous is refused, got ${anonymous.status}`);
	});
});

test('R8g: a rejected gate performs ZERO data reads, not merely zero writes', async () => {
	const { recorder } = await withRecorder({}, async () => {
		await call(BASE, CROSS_SCHOOL);
		await call(BASE, NO_SCHOOL);
		await call(BASE, NO_CAPABILITY);
		await call(BASE, null);
		return null;
	});
	assert.deepEqual(recorder.calls, [], `a refused request must not read: ${JSON.stringify(recorder.calls)}`);
});
