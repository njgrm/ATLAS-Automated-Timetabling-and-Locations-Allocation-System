/**
 * SECTION-ROUTE-AUTHORITY-C01 — actor-school scope on sibling section routes.
 *
 * Hermetic test: no live database is contacted.  DATABASE_URL is forced to an
 * unreachable placeholder; every data access is injected through withDataContext
 * using a recording client that tracks all Prisma operations.  Any accidental
 * dispatch against the real database would fail closed.
 *
 * Run (server workspace): npx tsx src/__tests__/section-route-authority-c01.test.ts
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import test from 'node:test';

import express from 'express';

import { withDataContext } from '../lib/data-context.js';
import sectionRouter from '../routes/section.router.js';

const JWT_SECRET = 'section-route-authority-c01-test-secret';

process.env.JWT_SECRET = JWT_SECRET;
// Fail closed: every data access below is injected.  Point the singleton at an
// unreachable host so an accidental dispatch can never touch the real database.
process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';

const OTHER_SCHOOL_ID = 999999;

// ── Recording client ─────────────────────────────────────────────────────────
// Tracks every Prisma model operation and every write so we can prove zero
// dispatch on rejections and observe which operations succeed on positive paths.

type RecordingClient = {
	client: any;
	ops: string[];
	writes: Array<{ where: any; data: any }>;
};

function makeRecordingClient(): RecordingClient {
	const ops: string[] = [];
	const writes: Array<{ where: any; data: any }> = [];
	const client: any = {
		sectionMirror: {
			findMany: async (_args: any) => {
				ops.push('sectionMirror.findMany');
				return [];
			},
			findFirst: async (_args: any) => {
				ops.push('sectionMirror.findFirst');
				return null;
			},
			findUnique: async (_args: any) => {
				ops.push('sectionMirror.findUnique');
				return null;
			},
			update: async (args: any) => {
				ops.push('sectionMirror.update');
				writes.push(args);
				return args.data;
			},
			upsert: async (args: any) => {
				ops.push('sectionMirror.upsert');
				writes.push(args);
				return args.create ?? args.update;
			},
		},
		room: {
			findMany: async (_args: any) => {
				ops.push('room.findMany');
				return [];
			},
			findUnique: async (_args: any) => {
				ops.push('room.findUnique');
				return null;
			},
		},
		$transaction: async (fn: any) => {
			ops.push('$transaction');
			return fn(client);
		},
	};
	return { client, ops, writes };
}

// ── Mini Express app with injected context ───────────────────────────────────

function makeApp(recording: RecordingClient) {
	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => {
		void withDataContext(recording.client, async () => next());
	});
	app.use('/api/v1/sections', sectionRouter);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	return app;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function signOfficer(schoolId: number | null): string {
	const payload: Record<string, unknown> = { userId: 9001, role: 'officer', authSource: 'local' };
	if (schoolId != null) payload.schoolId = schoolId;
	return jwt.sign(payload, JWT_SECRET, { expiresIn: '5m' });
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

async function callRoute(
	baseUrl: string,
	method: string,
	path: string,
	token: string | null,
	body: unknown,
): Promise<CallResult> {
	const res = await fetch(`${baseUrl}${path}`, {
		method,
		headers: {
			'content-type': 'application/json',
			...(token ? { authorization: `Bearer ${token}` } : {}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const json = await res.json().catch(() => ({}));
	return { status: res.status, json };
}

// ── Mounted-route authority matrix (rejection rows) ──────────────────────────

test('E1: cross-school GET /home-rooms/:schoolYearId rejected with zero DB dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/home-rooms/1?schoolId=1', signOfficer(OTHER_SCHOOL_ID), undefined);
		assert.equal(result.status, 403, `E1-a -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'E1-a dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'E1-a performs zero writes');
	} finally {
		server.close();
	}
});

test('E2: cross-school PUT /home-rooms/:schoolYearId rejected with zero DB dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'PUT', '/api/v1/sections/home-rooms/1', signOfficer(OTHER_SCHOOL_ID), { schoolId: 1, assignments: [{ sectionId: 1, homeRoomId: null }] });
		assert.equal(result.status, 403, `E2-a -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'E2-a dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'E2-a performs zero writes');
	} finally {
		server.close();
	}
});

test('E3: cross-school POST /sync rejected with zero DB dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/sync', signOfficer(OTHER_SCHOOL_ID), { schoolId: 1 });
		assert.equal(result.status, 403, `E3-a -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'E3-a dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'E3-a performs zero writes');
	} finally {
		server.close();
	}
});

test('E4: missing actor school rejected with zero DB dispatch on all three routes', async () => {
	const noSchoolToken = signOfficer(null);

	const r1 = makeRecordingClient();
	const s1 = await startServer(r1);
	try {
		const getResult = await callRoute(s1.baseUrl, 'GET', '/api/v1/sections/home-rooms/1?schoolId=1', noSchoolToken, undefined);
		assert.equal(getResult.status, 403, `E4-a -> ${getResult.status}/${getResult.json.code}`);
		assert.equal(getResult.json.code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal(r1.ops.length, 0, 'E4-a dispatches zero DB operations');
	} finally { s1.server.close(); }

	const r2 = makeRecordingClient();
	const s2 = await startServer(r2);
	try {
		const putResult = await callRoute(s2.baseUrl, 'PUT', '/api/v1/sections/home-rooms/1', noSchoolToken, { schoolId: 1, assignments: [{ sectionId: 1, homeRoomId: null }] });
		assert.equal(putResult.status, 403, `E4-b -> ${putResult.status}/${putResult.json.code}`);
		assert.equal(putResult.json.code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal(r2.ops.length, 0, 'E4-b dispatches zero DB operations');
	} finally { s2.server.close(); }

	const r3 = makeRecordingClient();
	const s3 = await startServer(r3);
	try {
		const syncResult = await callRoute(s3.baseUrl, 'POST', '/api/v1/sections/sync', noSchoolToken, { schoolId: 1 });
		assert.equal(syncResult.status, 403, `E4-c -> ${syncResult.status}/${syncResult.json.code}`);
		assert.equal(syncResult.json.code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal(r3.ops.length, 0, 'E4-c dispatches zero DB operations');
	} finally { s3.server.close(); }
});

test('E4d: cross-school POST /home-rooms/:schoolYearId/auto-assign still rejected', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/home-rooms/1/auto-assign', signOfficer(OTHER_SCHOOL_ID), { schoolId: 1, mode: 'preview' });
		assert.equal(result.status, 403, `E4d -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'E4d dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'E4d performs zero writes');
	} finally {
		server.close();
	}
});

test('E5: missing-school auto-assign rejected with zero DB dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/home-rooms/1/auto-assign', signOfficer(null), { schoolId: 1, mode: 'preview' });
		assert.equal(result.status, 403, `E5 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal(recording.ops.length, 0, 'E5 dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'E5 performs zero writes');
	} finally {
		server.close();
	}
});

// ── Positive success paths (same-school privileged actor) ────────────────────

test('F2-PUT: same-school PUT /home-rooms/:schoolYearId reaches the service', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(
			baseUrl,
			'PUT',
			'/api/v1/sections/home-rooms/1',
			signOfficer(1),
			{ schoolId: 1, assignments: [{ sectionId: 999999, homeRoomId: null }] },
		);
		// The request passes the authority gate and reaches updateSectionHomeRooms.
		// Since no section with externalId 999999 exists in the recording client,
		// the service returns updated: 0 — the point is it was NOT rejected at 403.
		assert.notEqual(result.status, 403, `PUT same-school passes authority gate (got ${result.status})`);
		assert.ok(recording.ops.length > 0, 'PUT same-school reached the service (ops: ' + recording.ops.join(', ') + ')');
		assert.equal(result.json.updated, 0, 'PUT same-school returns updated: 0 when no matching sections');
	} finally {
		server.close();
	}
});

test('F2-SYNC: same-school POST /sync reaches the service', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(
			baseUrl,
			'POST',
			'/api/v1/sections/sync',
			signOfficer(1),
			{ schoolId: 1 },
		);
		// The request passes the authority gate.  The sync service calls the
		// EnrollPro adapter (HTTP upstream), which will fail in hermetic mode.
		// The point is it was NOT rejected at 403 — the handler reached the
		// service dispatch.
		assert.notEqual(result.status, 403, `POST /sync same-school passes authority gate (got ${result.status})`);
	} finally {
		server.close();
	}
});

test('F2-GET: same-school GET /home-rooms/:schoolYearId reaches the service and returns valid shape', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(
			baseUrl,
			'GET',
			'/api/v1/sections/home-rooms/1?schoolId=1',
			signOfficer(1),
			undefined,
		);
		assert.equal(result.status, 200, `GET same-school succeeds (got ${result.status})`);
		assert.ok(recording.ops.length > 0, 'GET same-school reached the service (ops: ' + recording.ops.join(', ') + ')');
		assert.ok(Array.isArray(result.json.sections), 'GET same-school returns sections array');
		assert.ok(Array.isArray(result.json.rooms), 'GET same-school returns rooms array');
	} finally {
		server.close();
	}
});
