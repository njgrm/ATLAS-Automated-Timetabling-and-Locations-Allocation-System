/**
 * SECTION-ROUTE-AUTHORITY-C03 -- actor scope on the section-scoped read route.
 *
 * Covers, on the real production router:
 *   GET /api/v1/sections/:sectionId/assigned-classes  (section.router.ts:139)
 *
 * The route previously resolved the school server-side from the section with no
 * actor-school check: any privileged JWT actor (or system token) could read the
 * assigned classes of any section in the active school-year, including sections
 * belonging to another school.
 *
 * Fix shape (reuses requireActorSchool / actorSchoolIdOf; no second mechanism):
 *   - JWT/bridge actor  -> scoped to the actor school via the service's existing
 *     `options.schoolId` (the roster index is built for the actor school only,
 *     so a foreign section is simply absent -> the identical 404 NOT_FOUND).
 *   - System token      -> explicit `schoolId` query scopes the read (C01 Option A);
 *     absent `schoolId` preserves the legacy server-side resolution (C02-SC1).
 *   - An explicitly declared `schoolId` that disagrees with the actor school is
 *     rejected 403 CROSS_SCHOOL_DENIED before any dispatch (sibling semantics).
 *   - Cross-school and missing sections are indistinguishable: both return the
 *     byte-identical 404 NOT_FOUND body (R2: no existence oracle; no 403 leak).
 *
 * Hermetic: no live database is contacted. DATABASE_URL is forced to an
 * unreachable placeholder; every data access is injected through
 * withDataContext with a recording client. Any accidental dispatch against the
 * real database fails closed.
 *
 * Run (server workspace): npx tsx src/__tests__/section-route-authority-c03.test.ts
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import test from 'node:test';

import express from 'express';

// ---- Env setup BEFORE dynamic imports ----------------------------------------
const JWT_SECRET = 'section-route-authority-c03-test-secret';
const SYSTEM_TOKEN = 'test-system-token-for-section-route-authority-c03';

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
const OTHER_SCHOOL_ID = 2;
const SECTION_IN_ACTOR_SCHOOL = 9001;
const SECTION_IN_OTHER_SCHOOL = 9002;
const MISSING_SECTION = 999998;

// A full section-mirror row: enough shape for the roster index.
function makeRosterRow(externalId: number, schoolId: number, name: string) {
	return {
		id: 500 + externalId,
		externalId,
		name,
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
		schoolId,
		schoolYearId: 1,
		lastSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
	};
}

const ROSTER_ROWS = [
	makeRosterRow(SECTION_IN_ACTOR_SCHOOL, ACTOR_SCHOOL_ID, 'Section 9001'),
	makeRosterRow(SECTION_IN_OTHER_SCHOOL, OTHER_SCHOOL_ID, 'Section 9002'),
];

// ---- Recording client --------------------------------------------------------
type RecordingOptions = {
	sectionFindFirst?: any;
};

type RecordingClient = {
	client: any;
	ops: string[];
};

function makeRecordingClient(options: RecordingOptions = {}): RecordingClient {
	const ops: string[] = [];

	const client: any = {
		sectionMirror: {
			findMany: async (args: any) => {
				ops.push('sectionMirror.findMany');
				// Faithful where-clause simulation: the database filters by the
				// requested schoolId. The route fix scopes the roster read to
				// the actor (or declared) school, so a foreign section is
				// absent from scope exactly as in production.
				const wanted = args?.where?.schoolId;
				if (typeof wanted === 'number') {
					return ROSTER_ROWS.filter((row) => row.schoolId === wanted).map((row) => ({ ...row }));
				}
				return ROSTER_ROWS.map((row) => ({ ...row }));
			},
			findFirst: async (args: any) => {
				ops.push('sectionMirror.findFirst');
				if (options.sectionFindFirst !== undefined) return options.sectionFindFirst;
				// Faithful mirror simulation for the legacy server-side
				// resolution path: section 9001 lives in school 1, section
				// 9002 in school 2, anything else is absent.
				const row = ROSTER_ROWS.find((entry) => entry.externalId === args?.where?.externalId);
				return row ? { schoolId: row.schoolId } : null;
			},
		},
		room: {
			findMany: async (_args: any) => {
				ops.push('room.findMany');
				return [];
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

	return { client, ops };
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

// ==== Evidence #1: cross-school read rejected =================================

test('C03-X1: JWT actor of school 2 reading section 9001 (school 1) is rejected with NOT_FOUND', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_ACTOR_SCHOOL}/assigned-classes?schoolYearId=1`, signOfficer(OTHER_SCHOOL_ID), undefined);
		assert.equal(result.status, 404, `C03-X1 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'NOT_FOUND');
	} finally { server.close(); }
});

// ==== Evidence #2: no existence leak ==========================================

test('C03-X2: missing section and other-school section are indistinguishable (identical 404 bodies)', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const token = signOfficer(ACTOR_SCHOOL_ID);
		const missing = await callRoute(baseUrl, 'GET', `/api/v1/sections/${MISSING_SECTION}/assigned-classes?schoolYearId=1`, token, undefined);
		const foreign = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_OTHER_SCHOOL}/assigned-classes?schoolYearId=1`, token, undefined);
		assert.equal(missing.status, 404, `C03-X2/missing -> ${missing.status}/${missing.json.code}`);
		assert.equal(foreign.status, 404, `C03-X2/foreign -> ${foreign.status}/${foreign.json.code}`);
		assert.deepEqual(foreign.json, missing.json, 'C03-X2 cross-school caller cannot distinguish missing from foreign');
	} finally { server.close(); }
});

// ==== Evidence #3: zero dispatch on pre-resolution rejections =================

test('C03-Z1: no token returns 401 NO_TOKEN with zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_ACTOR_SCHOOL}/assigned-classes?schoolYearId=1`, null, undefined);
		assert.equal(result.status, 401, `C03-Z1 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'NO_TOKEN');
		assert.equal(recording.ops.length, 0, 'C03-Z1 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C03-Z2: invalid JWT returns 401 INVALID_TOKEN with zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_ACTOR_SCHOOL}/assigned-classes?schoolYearId=1`, signInvalidToken(), undefined);
		assert.equal(result.status, 401, `C03-Z2 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_TOKEN');
		assert.equal(recording.ops.length, 0, 'C03-Z2 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C03-Z3: JWT actor without bound school rejected SCHOOL_SCOPE_REQUIRED, zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_ACTOR_SCHOOL}/assigned-classes?schoolYearId=1`, signOfficer(null), undefined);
		assert.equal(result.status, 403, `C03-Z3 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal(recording.ops.length, 0, 'C03-Z3 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C03-Z4: non-numeric schoolYearId rejected INVALID_PARAM, zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_ACTOR_SCHOOL}/assigned-classes?schoolYearId=abc`, signOfficer(ACTOR_SCHOOL_ID), undefined);
		assert.equal(result.status, 400, `C03-Z4 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_PARAM');
		assert.equal(recording.ops.length, 0, 'C03-Z4 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C03-Z5: non-numeric explicit schoolId rejected INVALID_PARAM, zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_ACTOR_SCHOOL}/assigned-classes?schoolYearId=1&schoolId=not-a-number`, systemTokenValue(), undefined);
		assert.equal(result.status, 400, `C03-Z5 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'INVALID_PARAM');
		assert.equal(recording.ops.length, 0, 'C03-Z5 dispatches zero DB operations');
	} finally { server.close(); }
});

test('C03-Z6: JWT actor declaring a schoolId that disagrees with its bound school is rejected CROSS_SCHOOL_DENIED, zero dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_ACTOR_SCHOOL}/assigned-classes?schoolYearId=1&schoolId=${ACTOR_SCHOOL_ID}`, signOfficer(OTHER_SCHOOL_ID), undefined);
		assert.equal(result.status, 403, `C03-Z6 -> ${result.status}/${result.json.code}`);
		assert.equal(result.json.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(recording.ops.length, 0, 'C03-Z6 dispatches zero DB operations');
	} finally { server.close(); }
});

// ==== Evidence #4: legitimate same-school path preserved ======================

test('C03-P1: same-school JWT actor succeeds with the unchanged payload shape; recorder proves dispatch', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_ACTOR_SCHOOL}/assigned-classes?schoolYearId=1`, signOfficer(ACTOR_SCHOOL_ID), undefined);
		assert.equal(result.status, 200, `C03-P1 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.sectionId, SECTION_IN_ACTOR_SCHOOL, 'C03-P1 returns the requested section');
		assert.equal(typeof result.json.sectionName, 'string', 'C03-P1 preserves sectionName');
		assert.ok(Array.isArray(result.json.classes), 'C03-P1 preserves the classes array');
		assert.equal(typeof result.json.totals, 'object', 'C03-P1 preserves totals');
		assert.equal(result.json.schoolYearId, 1, 'C03-P1 preserves schoolYearId');
		assert.ok(recording.ops.length > 0, 'C03-P1 reached the service (ops: ' + recording.ops.join(', ') + ')');
	} finally { server.close(); }
});

test('C03-P2: same-school JWT actor of school 2 reads section 9002 (bidirectional)', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_OTHER_SCHOOL}/assigned-classes?schoolYearId=1`, signOfficer(OTHER_SCHOOL_ID), undefined);
		assert.equal(result.status, 200, `C03-P2 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.sectionId, SECTION_IN_OTHER_SCHOOL, 'C03-P2 returns the requested section');
		assert.ok(Array.isArray(result.json.classes), 'C03-P2 preserves the classes array');
		assert.ok(recording.ops.length > 0, 'C03-P2 reached the service (ops: ' + recording.ops.join(', ') + ')');
	} finally { server.close(); }
});

// ==== Evidence #5: system token + explicit schoolId (C01 Option A) ============

test('C03-M1: system token with matching explicit schoolId reaches the service (200)', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_ACTOR_SCHOOL}/assigned-classes?schoolYearId=1&schoolId=${ACTOR_SCHOOL_ID}`, systemTokenValue(), undefined);
		assert.equal(result.status, 200, `C03-M1 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.sectionId, SECTION_IN_ACTOR_SCHOOL, 'C03-M1 machine declaration preserved');
		assert.ok(recording.ops.length > 0, 'C03-M1 reached the service (ops: ' + recording.ops.join(', ') + ')');
	} finally { server.close(); }
});

test('C03-M2: system token declaring another school sees the identical 404 (scoped, no leak)', async () => {
	const recording = makeRecordingClient();
	const { server, baseUrl } = await startServer(recording);
	try {
		const foreign = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_ACTOR_SCHOOL}/assigned-classes?schoolYearId=1&schoolId=${OTHER_SCHOOL_ID}`, systemTokenValue(), undefined);
		const missing = await callRoute(baseUrl, 'GET', `/api/v1/sections/${MISSING_SECTION}/assigned-classes?schoolYearId=1&schoolId=${OTHER_SCHOOL_ID}`, systemTokenValue(), undefined);
		assert.equal(foreign.status, 404, `C03-M2/foreign -> ${foreign.status}/${foreign.json.code}`);
		assert.equal(foreign.json.code, 'NOT_FOUND');
		assert.deepEqual(foreign.json, missing.json, 'C03-M2 machine caller cannot distinguish missing from foreign');
	} finally { server.close(); }
});

test('C03-M3: system token without schoolId preserves the legacy server-side resolution (200, C02-SC1 semantics)', async () => {
	const recording = makeRecordingClient({ sectionFindFirst: { schoolId: ACTOR_SCHOOL_ID } });
	const { server, baseUrl } = await startServer(recording);
	try {
		const result = await callRoute(baseUrl, 'GET', `/api/v1/sections/${SECTION_IN_ACTOR_SCHOOL}/assigned-classes?schoolYearId=1`, systemTokenValue(), undefined);
		assert.equal(result.status, 200, `C03-M3 -> ${result.status}/${result.json.code ?? result.json.message}`);
		assert.equal(result.json.sectionId, SECTION_IN_ACTOR_SCHOOL, 'C03-M3 resolves the section school server-side');
		assert.ok(recording.ops.length > 0, 'C03-M3 reached the service (ops: ' + recording.ops.join(', ') + ')');
	} finally { server.close(); }
});
