/**
 * SECTION-ROUTE-AUTHORITY-C02 -- close the remaining ungated section routes.
 *
 * Covers, on the real production router:
 *   R1  POST /sections/special-program-placement/overlay  (actor write route)
 *   R2  GET  /sections/summary/:schoolYearId              (actor read route)
 *   R3  GET  /sections/assigned-classes                   (machine route, C01 Option A)
 *   R3' GET  /sections/:sectionId/assigned-classes        (section-scoped: unchanged)
 *
 * Hermetic: no live database is contacted. DATABASE_URL is forced to an
 * unreachable placeholder; every data access is injected through
 * withDataContext with a recording client that tracks all Prisma operations and
 * writes (the same instrumented-context pattern as the C01 suite). Any accidental
 * dispatch against the real database fails closed.
 *
 * Run (server workspace): npx tsx src/__tests__/section-route-authority-c02.test.ts
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import test from 'node:test';

import express from 'express';

// ---- Env setup BEFORE dynamic imports ----------------------------------------
// sectionSourceMode and sectionAdapter are computed at module load time in
// section-adapter.ts. Set env vars first, then dynamically import the router.
const JWT_SECRET = 'section-route-authority-c02-test-secret';
const SYSTEM_TOKEN = 'test-system-token-for-section-route-authority-c02';

process.env.JWT_SECRET = JWT_SECRET;
process.env.ATLAS_SYSTEM_TOKEN = SYSTEM_TOKEN;
process.env.SECTION_SOURCE_MODE = 'stub';
// Fail closed: every data access below is injected. Point the singleton at an
// unreachable host so an accidental dispatch can never touch the real database.
process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';

// Dynamic imports AFTER env setup so section-adapter resolves stub mode.
const { withDataContext } = await import('../lib/data-context.js');
const { default: sectionRouter } = await import('../routes/section.router.js');

const ACTOR_SCHOOL_ID = 1;
const OTHER_SCHOOL_ID = 999999;

// A full section-mirror row: enough shape for section summary + roster index.
const ROSTER_ROW = {
	id: 501,
	externalId: 9001,
	name: 'Section 9001',
	maxCapacity: 45,
	enrolledCount: 40,
	gradeLevelId: 7,
	gradeLevelName: 'Grade 7',
	displayOrder: 7,
	programType: 'REGULAR',
	programCode: 'REGULAR',
	programName: 'Regular',
	isSpecialProgram: false,
	tleProgramId: null,
	tleSpecialization: null,
	tleProgramCategory: null,
	homeRoomId: null,
	buildingZoneId: null,
	isStale: false,
	schoolId: ACTOR_SCHOOL_ID,
	schoolYearId: 1,
	lastSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
};

// An SPA section with no home room: the overlay write route targets it.
const SPA_SECTION = {
	id: 601,
	externalId: 9002,
	name: 'SPA 9002',
	gradeLevelId: 7,
	programType: 'SPA',
	homeRoomId: null,
	buildingZoneId: null,
};

const SPA_ROOM = {
	id: 555,
	name: 'SPA Room 1',
	type: 'CLASSROOM',
	buildingZoneId: 'SPA-Z',
	building: { shortCode: 'SPA' },
};

// ---- Recording client --------------------------------------------------------
type WriteRecord = { model: string; args: any };

type RecordingOptions = {
	rosterRows?: any[];
	programSections?: any[];
	rooms?: any[];
	sectionFindFirst?: any;
};

type RecordingClient = {
	client: any;
	ops: string[];
	writes: WriteRecord[];
};

function makeRecordingClient(options: RecordingOptions = {}): RecordingClient {
	const ops: string[] = [];
	const writes: WriteRecord[] = [];
	const rosterRows = options.rosterRows ?? [];
	const programSections = options.programSections ?? [];
	const rooms = options.rooms ?? [];
	let overlayWritten = false;

	const client: any = {
		sectionMirror: {
			findMany: async (args: any) => {
				ops.push('sectionMirror.findMany');
				// Overlay target read and post-write read carry `programType`.
				if (args?.where?.programType) {
					return programSections.map((section) =>
						overlayWritten && section.homeRoomId == null
							? { ...section, homeRoomId: 555, buildingZoneId: 'SPA-Z' }
							: { ...section },
					);
				}
				// Overlay "currently assigned" read.
				if (args?.where?.homeRoomId) {
					return [];
				}
				return rosterRows;
			},
			findFirst: async (_args: any) => {
				ops.push('sectionMirror.findFirst');
				return options.sectionFindFirst ?? null;
			},
			update: async (args: any) => {
				ops.push('sectionMirror.update');
				writes.push({ model: 'sectionMirror.update', args });
				overlayWritten = true;
				return { id: args?.where?.id ?? 0 };
			},
		},
		room: {
			findMany: async (_args: any) => {
				ops.push('room.findMany');
				return rooms;
			},
		},
		// resolveRuntimeContext() reads these; all null/empty => no live evidence,
		// so it returns null without contacting EnrollPro.
		enrollProSchoolYearMirror: {
			findFirst: async (_a: any) => { ops.push('enrollProSchoolYearMirror.findFirst'); return null; },
			findMany: async (_a: any) => { ops.push('enrollProSchoolYearMirror.findMany'); return []; },
		},
		schedulingPolicy: {
			findFirst: async (_a: any) => { ops.push('schedulingPolicy.findFirst'); return null; },
		},
		sectionSnapshot: {
			findFirst: async (_a: any) => { ops.push('sectionSnapshot.findFirst'); return null; },
		},
		facultySnapshot: {
			findFirst: async (_a: any) => { ops.push('facultySnapshot.findFirst'); return null; },
		},
		generationRun: {
			findFirst: async (_a: any) => { ops.push('generationRun.findFirst'); return null; },
		},
		subject: {
			findMany: async (_a: any) => { ops.push('subject.findMany'); return []; },
		},
		subjectSectionOwnership: {
			findMany: async (_a: any) => { ops.push('subjectSectionOwnership.findMany'); return []; },
		},
		facultyMirror: {
			findMany: async (_a: any) => { ops.push('facultyMirror.findMany'); return []; },
			findFirst: async (_a: any) => { ops.push('facultyMirror.findFirst'); return null; },
		},
		$transaction: async (arg: any) => {
			ops.push('$transaction');
			if (Array.isArray(arg)) return Promise.all(arg);
			return arg(client);
		},
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

function systemTokenValue(): string {
	return SYSTEM_TOKEN;
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

// ==== R1: POST /special-program-placement/overlay (actor write route) =========

test('C02-OV1: cross-school actor on POST overlay rejected 403 with zero dispatch and zero writes', async () => {
	const recording = makeRecordingClient({ programSections: [SPA_SECTION], rooms: [SPA_ROOM] });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', signOfficer(OTHER_SCHOOL_ID), { schoolId: ACTOR_SCHOOL_ID, schoolYearId: 1 });
		assert.equal(result.status, 403, `C02-OV1 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'C02-OV1 dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'C02-OV1 performs zero writes');
	} finally { server.close(); }
});

test('C02-OV2: actor without bound school on overlay rejected SCHOOL_SCOPE_REQUIRED, zero dispatch', async () => {
	const recording = makeRecordingClient({ programSections: [SPA_SECTION], rooms: [SPA_ROOM] });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', signOfficer(null), { schoolId: ACTOR_SCHOOL_ID, schoolYearId: 1 });
		assert.equal(result.status, 403, `C02-OV2 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal(recording.ops.length, 0, 'C02-OV2 dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'C02-OV2 performs zero writes');
	} finally { server.close(); }
});

test('C02-OV3: no token on overlay returns 401 NO_TOKEN with zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', null, { schoolId: ACTOR_SCHOOL_ID, schoolYearId: 1 });
		assert.equal(result.status, 401, `C02-OV3 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'NO_TOKEN');
		assert.equal(recording.ops.length, 0, 'C02-OV3 dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'C02-OV3 performs zero writes');
	} finally { server.close(); }
});

test('C02-OV4: invalid JWT on overlay returns 401 INVALID_TOKEN with zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', signInvalidToken(), { schoolId: ACTOR_SCHOOL_ID, schoolYearId: 1 });
		assert.equal(result.status, 401, `C02-OV4 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_TOKEN');
		assert.equal(recording.ops.length, 0, 'C02-OV4 dispatches zero DB operations');
		assert.equal(recording.writes.length, 0, 'C02-OV4 performs zero writes');
	} finally { server.close(); }
});

test('C02-OV5: same-school privileged actor on overlay succeeds; recorder proves writes are recorded', async () => {
	const recording = makeRecordingClient({ programSections: [SPA_SECTION], rooms: [SPA_ROOM] });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', signOfficer(ACTOR_SCHOOL_ID), { schoolId: ACTOR_SCHOOL_ID, schoolYearId: 1 });
		assert.equal(result.status, 200, `C02-OV5 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.updated, 1, 'C02-OV5 writes exactly one overlay assignment');
		assert.equal(result.json.schoolId, ACTOR_SCHOOL_ID, 'C02-OV5 response echoes the actor school');
		assert.ok(recording.ops.length > 0, 'C02-OV5 reached the service (ops: ' + recording.ops.join(', ') + ')');
		assert.ok(recording.writes.length > 0, 'C02-OV5 recorder proves writes are recorded on the positive row');
		assert.equal(recording.writes[0].model, 'sectionMirror.update');
	} finally { server.close(); }
});

test('C02-OV6: overlay with no eligible SPA/SPS sections returns 200 updated:0 and preserves shape', async () => {
	const recording = makeRecordingClient({ programSections: [] });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'POST', '/api/v1/sections/special-program-placement/overlay', signOfficer(ACTOR_SCHOOL_ID), { schoolId: ACTOR_SCHOOL_ID, schoolYearId: 1 });
		assert.equal(result.status, 200, `C02-OV6 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.updated, 0);
		assert.ok(Array.isArray(result.json.assignments), 'C02-OV6 assignments array preserved');
		assert.ok(Array.isArray(result.json.issues), 'C02-OV6 issues array preserved');
		assert.equal(typeof result.json.contract, 'string', 'C02-OV6 contract string preserved');
		assert.equal(recording.writes.length, 0, 'C02-OV6 performs zero writes when nothing is eligible');
	} finally { server.close(); }
});

// ==== R2: GET /summary/:schoolYearId (actor read route) =======================

test('C02-SM1: cross-school actor on GET /summary rejected 403 with zero dispatch', async () => {
	const recording = makeRecordingClient({ rosterRows: [ROSTER_ROW] });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/summary/1?schoolId=${ACTOR_SCHOOL_ID}`, signOfficer(OTHER_SCHOOL_ID), undefined);
		assert.equal(result.status, 403, `C02-SM1 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'C02-SM1 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-SM2: actor without bound school on summary rejected SCHOOL_SCOPE_REQUIRED, zero dispatch', async () => {
	const recording = makeRecordingClient({ rosterRows: [ROSTER_ROW] });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/summary/1?schoolId=${ACTOR_SCHOOL_ID}`, signOfficer(null), undefined);
		assert.equal(result.status, 403, `C02-SM2 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal(recording.ops.length, 0, 'C02-SM2 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-SM3: no token on summary returns 401 NO_TOKEN with zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/summary/1?schoolId=${ACTOR_SCHOOL_ID}`, null, undefined);
		assert.equal(result.status, 401, `C02-SM3 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'NO_TOKEN');
		assert.equal(recording.ops.length, 0, 'C02-SM3 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-SM4: invalid JWT on summary returns 401 INVALID_TOKEN with zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/summary/1?schoolId=${ACTOR_SCHOOL_ID}`, signInvalidToken(), undefined);
		assert.equal(result.status, 401, `C02-SM4 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_TOKEN');
		assert.equal(recording.ops.length, 0, 'C02-SM4 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-SM5: same-school actor on summary reaches the service and returns the summary shape', async () => {
	const recording = makeRecordingClient({ rosterRows: [ROSTER_ROW] });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/summary/1?schoolId=${ACTOR_SCHOOL_ID}`, signOfficer(ACTOR_SCHOOL_ID), undefined);
		assert.equal(result.status, 200, `C02-SM5 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.schoolId, ACTOR_SCHOOL_ID, 'C02-SM5 returns the actor school summary');
		assert.ok(Array.isArray(result.json.sections), 'C02-SM5 sections array preserved');
		assert.equal(result.json.sections.length, 1, 'C02-SM5 returns the scoped section');
		assert.ok(recording.ops.length > 0, 'C02-SM5 reached the service (ops: ' + recording.ops.join(', ') + ')');
	} finally { server.close(); }
});

// ==== R3: GET /assigned-classes (machine route, C01 Option A) =================

test('C02-AC1: cross-school JWT actor on GET /assigned-classes rejected 403 with zero dispatch', async () => {
	const recording = makeRecordingClient({ rosterRows: [ROSTER_ROW] });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/assigned-classes?schoolId=${ACTOR_SCHOOL_ID}&schoolYearId=1`, signOfficer(OTHER_SCHOOL_ID), undefined);
		assert.equal(result.status, 403, `C02-AC1 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'C02-AC1 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-AC2: JWT actor without bound school on assigned-classes rejected SCHOOL_SCOPE_REQUIRED, zero dispatch', async () => {
	const recording = makeRecordingClient({ rosterRows: [ROSTER_ROW] });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/assigned-classes?schoolId=${ACTOR_SCHOOL_ID}&schoolYearId=1`, signOfficer(null), undefined);
		assert.equal(result.status, 403, `C02-AC2 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal(recording.ops.length, 0, 'C02-AC2 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-AC3: system token missing schoolId on assigned-classes -> 400 INVALID_PARAM, zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/assigned-classes?schoolYearId=1', systemTokenValue(), undefined);
		assert.equal(result.status, 400, `C02-AC3 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_PARAM');
		assert.equal(recording.ops.length, 0, 'C02-AC3 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-AC4: system token non-numeric schoolId on assigned-classes -> 400 INVALID_PARAM, zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/assigned-classes?schoolId=not-a-number&schoolYearId=1', systemTokenValue(), undefined);
		assert.equal(result.status, 400, `C02-AC4 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_PARAM');
		assert.equal(recording.ops.length, 0, 'C02-AC4 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-AC5: system token non-numeric schoolYearId on assigned-classes -> 400 INVALID_PARAM, zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/assigned-classes?schoolId=${ACTOR_SCHOOL_ID}&schoolYearId=abc`, systemTokenValue(), undefined);
		assert.equal(result.status, 400, `C02-AC5 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_PARAM');
		assert.equal(recording.ops.length, 0, 'C02-AC5 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-AC6: no token on assigned-classes returns 401 NO_TOKEN with zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/assigned-classes?schoolId=${ACTOR_SCHOOL_ID}&schoolYearId=1`, null, undefined);
		assert.equal(result.status, 401, `C02-AC6 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'NO_TOKEN');
		assert.equal(recording.ops.length, 0, 'C02-AC6 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-AC7: invalid JWT on assigned-classes returns 401 INVALID_TOKEN with zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/assigned-classes?schoolId=${ACTOR_SCHOOL_ID}&schoolYearId=1`, signInvalidToken(), undefined);
		assert.equal(result.status, 401, `C02-AC7 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_TOKEN');
		assert.equal(recording.ops.length, 0, 'C02-AC7 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C02-AC8: system token with explicit schoolId on assigned-classes reaches the service (200)', async () => {
	const recording = makeRecordingClient({ rosterRows: [ROSTER_ROW] });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/assigned-classes?schoolId=${ACTOR_SCHOOL_ID}&schoolYearId=1`, systemTokenValue(), undefined);
		assert.equal(result.status, 200, `C02-AC8 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.schoolId, ACTOR_SCHOOL_ID, 'C02-AC8 machine declaration preserved');
		assert.equal(result.json.schoolYearId, 1);
		assert.ok(recording.ops.length > 0, 'C02-AC8 reached the service (ops: ' + recording.ops.join(', ') + ')');
	} finally { server.close(); }
});

test('C02-AC9: same-school JWT actor on assigned-classes reaches the service (200)', async () => {
	const recording = makeRecordingClient({ rosterRows: [ROSTER_ROW] });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/assigned-classes?schoolId=${ACTOR_SCHOOL_ID}&schoolYearId=1`, signOfficer(ACTOR_SCHOOL_ID), undefined);
		assert.equal(result.status, 200, `C02-AC9 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.ok(recording.ops.length > 0, 'C02-AC9 reached the service (ops: ' + recording.ops.join(', ') + ')');
	} finally { server.close(); }
});

// ==== R3': GET /:sectionId/assigned-classes (section-scoped, unchanged) =======

test('C02-SC1: section-scoped GET /:sectionId/assigned-classes still dispatches (no caller-supplied schoolId)', async () => {
	const recording = makeRecordingClient({ rosterRows: [ROSTER_ROW], sectionFindFirst: { schoolId: ACTOR_SCHOOL_ID } });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', '/api/v1/sections/9001/assigned-classes?schoolYearId=1', systemTokenValue(), undefined);
		assert.equal(result.status, 200, `C02-SC1 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.ok(recording.ops.length > 0, 'C02-SC1 reached the service (ops: ' + recording.ops.join(', ') + ')');
	} finally { server.close(); }
});
