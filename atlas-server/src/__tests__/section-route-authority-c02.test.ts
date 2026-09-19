/**
 * SECTION-ROUTE-AUTHORITY-C02 -- close the remaining ungated section routes.
 *
 * Hermetic test: no live database is contacted.  DATABASE_URL is forced to an
 * unreachable placeholder; every data access is injected through withDataContext
 * using a recording client that tracks all Prisma operations.  Any accidental
 * dispatch against the real database would fail closed.
 *
 * Covers (packet docs/prompts/section-route-authority-c02-2026-09-19.md):
 *  R1 POST /special-program-placement/overlay (actor write, caller schoolId)
 *  R2 GET /summary/:schoolYearId (actor read, caller schoolId query)
 *  R3 GET /assigned-classes (machine route, explicit schoolId required;
 *     JWT actors cross-checked, system tokens declare explicitly -- C01 Option A)
 *  R4 consumer enumeration is reported in the handoff (no client caller of the
 *     overlay exists; summary/assigned-classes clients pass the actor school).
 *  GET /:sectionId/assigned-classes is section-scoped (school resolved
 *  server-side from the mirror) and is intentionally unchanged; its current
 *  behaviour is locked here so no scope widening can hide.
 *
 * Run (server workspace): npx tsx src/__tests__/section-route-authority-c02.test.ts
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import test from 'node:test';

import express from 'express';

// ---- Env setup BEFORE dynamic imports ----------------------------------------
const JWT_SECRET = 'section-route-authority-c02-test-secret';
const SYSTEM_TOKEN = 'test-system-token-for-section-route-authority-c02';

process.env.JWT_SECRET = JWT_SECRET;
process.env.ATLAS_SYSTEM_TOKEN = SYSTEM_TOKEN;
process.env.SECTION_SOURCE_MODE = 'stub';
// Fail closed: every data access below is injected.  Point the singleton at an
// unreachable host so an accidental dispatch can never touch the real database.
process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';

// Dynamic imports AFTER env setup so section-adapter resolves stub mode.
const { withDataContext } = await import('../lib/data-context.js');
const { default: sectionRouter } = await import('../routes/section.router.js');

const OTHER_SCHOOL_ID = 999999;

// ---- Recording client --------------------------------------------------------
type RecordingClient = {
	client: any;
	ops: string[];
	writes: Array<{ where: any; data: any }>;
};

function makeRecordingClient(): RecordingClient {
	const ops: string[] = [];
	const writes: Array<{ where: any; data: any }> = [];
	const findFirstNull = async (_args: any) => { ops.push('findFirst'); return null; };
	const findManyEmpty = async (_args: any) => { ops.push('findMany'); return []; };
	const client: any = {
		sectionMirror: {
			findMany: async (_args: any) => { ops.push('sectionMirror.findMany'); return []; },
			findFirst: async (_args: any) => { ops.push('sectionMirror.findFirst'); return null; },
			findUnique: async (_args: any) => { ops.push('sectionMirror.findUnique'); return null; },
			deleteMany: async (args: any) => { ops.push('sectionMirror.deleteMany'); writes.push(args); return { count: 0 }; },
			update: async (args: any) => { ops.push('sectionMirror.update'); writes.push(args); return args.data; },
			upsert: async (args: any) => { ops.push('sectionMirror.upsert'); writes.push(args); return args.create ?? args.update; },
		},
		sectionSnapshot: {
			findFirst: findFirstNull,
			findUnique: async (_args: any) => { ops.push('sectionSnapshot.findUnique'); return null; },
			findMany: async (_args: any) => { ops.push('sectionSnapshot.findMany'); return []; },
		},
		room: {
			findMany: async (_args: any) => { ops.push('room.findMany'); return []; },
			findUnique: async (_args: any) => { ops.push('room.findUnique'); return null; },
		},
		subject: {
			findMany: async (_args: any) => { ops.push('subject.findMany'); return []; },
		},
		subjectSectionOwnership: {
			findMany: async (_args: any) => { ops.push('subjectSectionOwnership.findMany'); return []; },
		},
		facultyMirror: {
			findMany: async (_args: any) => { ops.push('facultyMirror.findMany'); return []; },
		},
		enrollProSchoolYearMirror: { findFirst: findFirstNull, findMany: findManyEmpty },
		schedulingPolicy: { findFirst: findFirstNull, findMany: findManyEmpty },
		facultySnapshot: { findFirst: findFirstNull, findMany: findManyEmpty },
		generationRun: { findFirst: findFirstNull, findMany: findManyEmpty },
		publishedScheduleRevision: { count: async (_args: any) => { ops.push('publishedScheduleRevision.count'); return 0; } },
		$transaction: async (fn: any) => { ops.push('$transaction'); return fn(client); },
	};
	return { client, ops, writes };
}

// ---- Mini Express app with injected context ----------------------------------
function makeApp(recording: RecordingClient) {
	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => { void withDataContext(recording.client, async () => next()); });
	app.use('/api/v1/sections', sectionRouter);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	return app;
}

// ---- Helpers -----------------------------------------------------------------
function signOfficer(schoolId: number | null): string {
	const payload: Record<string, unknown> = { userId: 9001, role: 'officer', authSource: 'local' };
	if (schoolId != null) payload.schoolId = schoolId;
	return jwt.sign(payload, JWT_SECRET, { expiresIn: '5m' });
}

function signInvalidToken(): string {
	return jwt.sign({ userId: 9999, role: 'officer' }, 'wrong-secret', { expiresIn: '5m' });
}

async function startServer(recording: RecordingClient) {
	const app = makeApp(recording);
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	return { server, port, baseUrl: `http://127.0.0.1:${port}` };
}

type CallResult = { status: number; json: any };

async function callRoute(baseUrl: string, method: string, path: string, token: string | null, body: unknown): Promise<CallResult> {
	const res = await fetch(`${baseUrl}${path}`, {
		method,
		headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const json = await res.json().catch(() => ({}));
	return { status: res.status, json };
}

// ==== R1: POST /special-program-placement/overlay (actor write) ===============

test('C02-T1: cross-school POST overlay rejected with zero DB dispatch (failing-first)', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', signOfficer(OTHER_SCHOOL_ID), { schoolId: 1, schoolYearId: 2 });
		assert.equal(result.status, 403, `C02-T1 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'C02-T1 dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'C02-T1 performs zero writes');
	} finally { server.close(); }
});

test('C02-T2: cross-school POST overlay without schoolYearId rejected before upstream resolution', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', signOfficer(OTHER_SCHOOL_ID), { schoolId: 1 });
		assert.equal(result.status, 403, `C02-T2 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'C02-T2 dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'C02-T2 performs zero writes');
	} finally { server.close(); }
});

test('C02-T3: same-school POST overlay succeeds and proves the recorder records', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', signOfficer(1), { schoolId: 1, schoolYearId: 2 });
		assert.equal(result.status, 200, `C02-T3 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.schoolId, 1, 'C02-T3 echoes the requested school');
		assert.equal(result.json.schoolYearId, 2, 'C02-T3 echoes the requested school year');
		assert.equal(typeof result.json.updated, 'number', 'C02-T3 returns an updated count');
		assert.ok(typeof result.json.contract === 'string', 'C02-T3 keeps the response contract field');
		assert.ok(recording.ops.length > 0, 'C02-T3 recorder observed service dispatch (ops: ' + recording.ops.join(', ') + ')');
	} finally { server.close(); }
});

test('C02-T4: overlay without bound actor school rejected with zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', signOfficer(null), { schoolId: 1, schoolYearId: 2 });
		assert.equal(result.status, 403, `C02-T4 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal(recording.ops.length, 0, 'C02-T4 dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'C02-T4 performs zero writes');
	} finally { server.close(); }
});

test('C02-T5: overlay with missing schoolId is a typed 400 with zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', signOfficer(1), { schoolYearId: 2 });
		assert.equal(result.status, 400, `C02-T5 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_BODY');
		assert.equal(recording.ops.length, 0, 'C02-T5 dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'C02-T5 performs zero writes');
	} finally { server.close(); }
});

test('C02-T6: overlay with missing/invalid JWT is 401 with zero dispatch', async () => {
	const r1 = makeRecordingClient();
	const s1 = await startServer(r1);
	try {
		const result = await callRoute(s1.baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', null, { schoolId: 1, schoolYearId: 2 });
		assert.equal(result.status, 401, `C02-T6a -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'NO_TOKEN');
		assert.equal(r1.ops.length, 0, 'C02-T6a dispatches zero DB operations');
	} finally { s1.server.close(); }

	const r2 = makeRecordingClient();
	const s2 = await startServer(r2);
	try {
		const result = await callRoute(s2.baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', signInvalidToken(), { schoolId: 1, schoolYearId: 2 });
		assert.equal(result.status, 401, `C02-T6b -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_TOKEN');
		assert.equal(r2.ops.length, 0, 'C02-T6b dispatches zero DB operations');
	} finally { s2.server.close(); }
});

// ==== R2: GET /summary/:schoolYearId (actor read) =============================

test('C02-T7: cross-school GET summary rejected with zero DB dispatch (failing-first)', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/summary/1?schoolId=1', signOfficer(OTHER_SCHOOL_ID), undefined);
		assert.equal(result.status, 403, `C02-T7 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'C02-T7 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-T8: summary without bound actor school rejected with zero dispatch (failing-first)', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/summary/1?schoolId=1', signOfficer(null), undefined);
		assert.equal(result.status, 403, `C02-T8 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal(recording.ops.length, 0, 'C02-T8 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-T9: same-school GET summary succeeds and proves the recorder records', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/summary/1?schoolId=1', signOfficer(1), undefined);
		assert.equal(result.status, 200, `C02-T9 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.schoolId, 1, 'C02-T9 echoes the requested school');
		assert.ok(Array.isArray(result.json.sections), 'C02-T9 returns a sections array');
		assert.equal(typeof result.json.totalSections, 'number', 'C02-T9 returns totalSections');
		assert.ok(recording.ops.length > 0, 'C02-T9 recorder observed service dispatch (ops: ' + recording.ops.join(', ') + ')');
	} finally { server.close(); }
});

test('C02-T10: summary with missing schoolId is a typed 400 with zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/summary/1', signOfficer(1), undefined);
		assert.equal(result.status, 400, `C02-T10 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_PARAM');
		assert.equal(recording.ops.length, 0, 'C02-T10 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-T11: summary with missing/invalid JWT is 401 with zero dispatch', async () => {
	const r1 = makeRecordingClient();
	const s1 = await startServer(r1);
	try {
		const result = await callRoute(s1.baseUrl, 'GET', '/api/v1/sections/summary/1?schoolId=1', null, undefined);
		assert.equal(result.status, 401, `C02-T11a -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'NO_TOKEN');
		assert.equal(r1.ops.length, 0, 'C02-T11a dispatches zero DB operations');
	} finally { s1.server.close(); }

	const r2 = makeRecordingClient();
	const s2 = await startServer(r2);
	try {
		const result = await callRoute(s2.baseUrl, 'GET', '/api/v1/sections/summary/1?schoolId=1', signInvalidToken(), undefined);
		assert.equal(result.status, 401, `C02-T11b -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_TOKEN');
		assert.equal(r2.ops.length, 0, 'C02-T11b dispatches zero DB operations');
	} finally { s2.server.close(); }
});

// ==== R3: GET /assigned-classes (machine route, C01 Option A) =================

test('C02-T12: system token with explicit schoolId still succeeds (machine caller preserved)', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/assigned-classes?schoolId=1&schoolYearId=1', SYSTEM_TOKEN, undefined);
		assert.equal(result.status, 200, `C02-T12 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.schoolId, 1, 'C02-T12 echoes the declared school');
		assert.ok(Array.isArray(result.json.sections), 'C02-T12 returns a sections array');
		assert.ok(recording.ops.length > 0, 'C02-T12 recorder observed service dispatch (ops: ' + recording.ops.join(', ') + ')');
	} finally { server.close(); }
});

test('C02-T13: same-school JWT on assigned-classes succeeds', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/assigned-classes?schoolId=1&schoolYearId=1', signOfficer(1), undefined);
		assert.equal(result.status, 200, `C02-T13 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.schoolId, 1, 'C02-T13 echoes the requested school');
		assert.ok(Array.isArray(result.json.sections), 'C02-T13 returns a sections array');
	} finally { server.close(); }
});

test('C02-T14: cross-school JWT on assigned-classes rejected with zero dispatch (failing-first)', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/assigned-classes?schoolId=1&schoolYearId=1', signOfficer(OTHER_SCHOOL_ID), undefined);
		assert.equal(result.status, 403, `C02-T14 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'C02-T14 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-T15: assigned-classes JWT without bound school rejected with zero dispatch (failing-first)', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/assigned-classes?schoolId=1&schoolYearId=1', signOfficer(null), undefined);
		assert.equal(result.status, 403, `C02-T15 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal(recording.ops.length, 0, 'C02-T15 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-T16: assigned-classes with missing/non-numeric schoolId is a typed 400 with zero dispatch', async () => {
	const r1 = makeRecordingClient();
	const s1 = await startServer(r1);
	try {
		const result = await callRoute(s1.baseUrl, 'GET', '/api/v1/sections/assigned-classes?schoolYearId=1', SYSTEM_TOKEN, undefined);
		assert.equal(result.status, 400, `C02-T16a -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_PARAM');
		assert.equal(r1.ops.length, 0, 'C02-T16a dispatches zero DB operations');
	} finally { s1.server.close(); }

	const r2 = makeRecordingClient();
	const s2 = await startServer(r2);
	try {
		const result = await callRoute(s2.baseUrl, 'GET', '/api/v1/sections/assigned-classes?schoolId=abc&schoolYearId=1', SYSTEM_TOKEN, undefined);
		assert.equal(result.status, 400, `C02-T16b -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_PARAM');
		assert.equal(r2.ops.length, 0, 'C02-T16b dispatches zero DB operations');
	} finally { s2.server.close(); }
});

test('C02-T17: assigned-classes with missing/invalid token is 401 with zero dispatch', async () => {
	const r1 = makeRecordingClient();
	const s1 = await startServer(r1);
	try {
		const result = await callRoute(s1.baseUrl, 'GET', '/api/v1/sections/assigned-classes?schoolId=1&schoolYearId=1', null, undefined);
		assert.equal(result.status, 401, `C02-T17a -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'NO_TOKEN');
		assert.equal(r1.ops.length, 0, 'C02-T17a dispatches zero DB operations');
	} finally { s1.server.close(); }

	const r2 = makeRecordingClient();
	const s2 = await startServer(r2);
	try {
		const result = await callRoute(s2.baseUrl, 'GET', '/api/v1/sections/assigned-classes?schoolId=1&schoolYearId=1', signInvalidToken(), undefined);
		assert.equal(result.status, 401, `C02-T17b -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_TOKEN');
		assert.equal(r2.ops.length, 0, 'C02-T17b dispatches zero DB operations');
	} finally { s2.server.close(); }
});

// ==== Unchanged route: GET /:sectionId/assigned-classes (no scope widening) ===

test('C02-T18: section-scoped assigned-classes behaviour is unchanged (404 on empty mirror, 401 without token)', async () => {
	const r1 = makeRecordingClient();
	const s1 = await startServer(r1);
	try {
		const result = await callRoute(s1.baseUrl, 'GET', '/api/v1/sections/777/assigned-classes?schoolYearId=1', signOfficer(1), undefined);
		assert.equal(result.status, 404, `C02-T18a -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'NOT_FOUND');
	} finally { s1.server.close(); }

	const r2 = makeRecordingClient();
	const s2 = await startServer(r2);
	try {
		const result = await callRoute(s2.baseUrl, 'GET', '/api/v1/sections/777/assigned-classes?schoolYearId=1', null, undefined);
		assert.equal(result.status, 401, `C02-T18b -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'NO_TOKEN');
		assert.equal(r2.ops.length, 0, 'C02-T18b dispatches zero DB operations');
	} finally { s2.server.close(); }
});
