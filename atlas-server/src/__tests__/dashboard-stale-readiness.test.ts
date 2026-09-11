/**
 * DASH-RESILIENCE-C01 — Dashboard stale-readiness negative controls.
 *
 * Hermetic: `aggregateDashboardSummary` must never substitute `0`, `[]`, or
 * `NONE` for a failed domain read, and the lifecycle must fail closed.
 * Integration: a reachable typed active-term 409 and an unreachable EnrollPro
 * must both keep the actor school's saved ATLAS counts available, isolated to
 * disposable sandbox school IDs.
 *
 * Run: `npx tsx src/__tests__/dashboard-stale-readiness.test.ts`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http, { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import {
	aggregateDashboardSummary,
	getDashboardReadinessSummary,
	type DashboardReadinessAggregateInput,
} from '../services/dashboard-readiness.service.js';
import { resolveRuntimeContext, type RuntimeContextResult } from '../services/runtime-context.service.js';

const SAND = 7799101;
const YEAR = 9001;

async function withEnrollProFixture(
	responses: Record<string, { status?: number; body: unknown }>,
	run: (baseUrl: string) => Promise<void>,
): Promise<void> {
	const server = createServer((req: IncomingMessage, res: ServerResponse) => {
		const response = responses[req.url?.split('?')[0] ?? ''] ?? { status: 404, body: { error: 'not found' } };
		res.statusCode = response.status ?? 200;
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify(response.body));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object');
	try {
		await run(`http://127.0.0.1:${address.port}`);
	} finally {
		await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	}
}

async function cleanupSandbox(): Promise<void> {
	await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: SAND } });
	await prisma.sectionMirror.deleteMany({ where: { schoolId: SAND } });
	await prisma.facultyMirror.deleteMany({ where: { schoolId: SAND } });
	await prisma.subject.deleteMany({ where: { schoolId: SAND } });
	await prisma.room.deleteMany({ where: { building: { schoolId: SAND } } });
	await prisma.building.deleteMany({ where: { schoolId: SAND } });
	await prisma.school.deleteMany({ where: { id: SAND } });
}

async function seedSandbox(): Promise<void> {
	const existing = await prisma.school.findUnique({ where: { id: SAND } });
	if (existing) {
		throw new Error(`Sandbox school id ${SAND} already exists (${existing.name}); refusing to clobber.`);
	}
	await cleanupSandbox();
	await prisma.school.create({ data: { id: SAND, name: 'DASH-RESILIENCE Sandbox', shortName: 'DR-SAND' } });
	await prisma.enrollProSchoolYearMirror.create({
		data: {
			schoolId: SAND,
			enrollProSchoolYearId: YEAR,
			yearLabel: '2030-2031',
			isActive: true,
			lastSyncedAt: new Date(),
			syncStatus: 'OK',
		},
	});
	const building = await prisma.building.create({
		data: { schoolId: SAND, name: 'Main Building', isTeachingBuilding: true },
	});
	await prisma.room.create({
		data: { buildingId: building.id, name: 'Room 101', type: 'CLASSROOM', isTeachingSpace: true, floor: 1, floorPosition: 0 },
	});
	await prisma.subject.create({
		data: { schoolId: SAND, code: 'DR-S1', name: 'Sandbox Subject', minMinutesPerWeek: 40, gradeLevels: [7], isActive: true },
	});
	await prisma.facultyMirror.create({
		data: { externalId: 900001, schoolId: SAND, firstName: 'Sand', lastName: 'Teacher', isStale: false, lastSyncedAt: new Date() },
	});
	await prisma.sectionMirror.create({
		data: {
			externalId: 900101,
			schoolId: SAND,
			schoolYearId: YEAR,
			name: '7-Sand',
			gradeLevelId: 1,
			gradeLevelName: 'Grade 7',
			displayOrder: 7,
			maxCapacity: 40,
			enrolledCount: 30,
			isStale: false,
			lastSyncedAt: new Date(),
		},
	});
}

function fakeRuntimeContext(): RuntimeContextResult {
	return {
		schoolId: SAND,
		activeSchoolYearId: YEAR,
		activeSchoolYearLabel: '2030-2031',
		source: 'enrollpro-verified',
		stale: false,
		resolvedAt: new Date().toISOString(),
		evidence: [],
		upstream: { reachable: true, verified: true, matched: true, activeSchoolYearId: YEAR, activeSchoolYearLabel: '2030-2031' },
		activeYearDrift: {
			status: 'aligned',
			message: 'aligned',
			recommendedAction: 'NONE',
			atlasSchoolYearId: YEAR,
			enrollProSchoolYearId: YEAR,
			enrollProSchoolYearLabel: '2030-2031',
			mirrorSyncedAt: null,
		},
		rollover: { mirror: null },
		activeTerm: {
			source: 'enrollpro-verified',
			reachable: true,
			verified: true,
			activeTerm: 'T1',
			termIndex: 1,
			schoolYearId: YEAR,
			matchedSchoolYear: true,
			code: null,
			message: 'aligned',
		},
	};
}

const readyCampus = {
	campusImageUrl: null,
	updatedAt: null,
	buildings: [{
		id: 1,
		name: 'Main Building',
		shortCode: null,
		x: 0,
		y: 0,
		width: 200,
		height: 120,
		rotation: 0,
		color: '#2563eb',
		floorCount: 1,
		isTeachingBuilding: true,
		rooms: [{
			id: 1,
			name: 'Room 101',
			floor: 1,
			type: 'CLASSROOM',
			capacity: 40,
			isTeachingSpace: true,
			floorPosition: 0,
			buildingId: 1,
			features: [],
		}],
	}],
};

function aggregateInput(overrides: Partial<DashboardReadinessAggregateInput> = {}): DashboardReadinessAggregateInput {
	const runtimeContext = fakeRuntimeContext();
	return {
		schoolId: SAND,
		resolvedAt: new Date().toISOString(),
		activeSchoolYearId: YEAR,
		activeSchoolYearLabel: '2030-2031',
		runtimeContext,
		runtimeResult: { ok: true, data: runtimeContext },
		campusResult: { ok: true, data: readyCampus },
		subjectResult: { ok: true, data: { subjectCount: 22, unassignedSubjectCount: 0 } },
		facultyResult: { ok: true, data: { facultyCount: 42, lastSyncedAt: null } },
		sectionResult: { ok: true, data: { sectionCount: 20, lastSyncedAt: null } },
		generationResult: { ok: true, data: { latestRunStatus: 'NONE', latestRunId: null, violationCount: null, createdAt: null, finishedAt: null } },
		publicationResult: { ok: true, data: { isPublished: false, publishedRunId: null } },
		derivedDemandResult: {
			ok: true,
			data: {
				available: true,
				ready: true,
				yearLabel: '2030-2031',
				revision: 'DERIVED-REV',
				termStructure: { format: 'QUARTERS', terms: [{ identity: 'Q1', displayLabel: 'Quarter 1', order: 1 }] },
				blockers: [],
				subjectMetadataExceptions: [],
				totals: { totalLines: 20, totalPairs: 20, byTerm: { Q1: 20 } },
				blockerCode: null,
				blockerMessage: null,
				error: null,
			},
		},
		...overrides,
	};
}

test('DASH-RESILIENCE-C01 control: an all-available setup-ready snapshot advances to PREFERENCES', () => {
	const summary = aggregateDashboardSummary(aggregateInput());
	assert.equal(summary.lifecyclePhase, 'PREFERENCES');
	assert.equal(summary.sourceState, 'verified_live');
	assert.equal(summary.subjects.available, true);
	assert.equal(summary.generation.available, true);
	assert.equal(summary.generation.latestRunStatus, 'NONE');
});

test('DASH-RESILIENCE-C01: a failed domain read is unavailable (null), never a synthetic zero', () => {
	const summary = aggregateDashboardSummary(aggregateInput({
		subjectResult: { ok: false, data: null, error: 'subject read failed' },
	}));

	assert.equal(summary.subjects.available, false);
	assert.equal(summary.subjects.subjectCount, null);
	assert.equal(summary.subjects.unassignedSubjectCount, null);
	assert.notEqual(summary.subjects.subjectCount, 0);
	assert.equal(summary.sourceState, 'partial_degraded');
	assert.equal(summary.sources.subjects.state, 'partial_degraded');
	assert.match(summary.sources.subjects.error ?? '', /subject read failed/);
	// The lifecycle cannot advance from the synthetic value.
	assert.equal(summary.lifecyclePhase, 'SETUP');
});

test('DASH-RESILIENCE-C01: a genuine persisted zero stays zero and is not "unavailable"', () => {
	const summary = aggregateDashboardSummary(aggregateInput({
		subjectResult: { ok: true, data: { subjectCount: 0, unassignedSubjectCount: 0 } },
	}));

	assert.equal(summary.subjects.available, true);
	assert.equal(summary.subjects.subjectCount, 0);
	assert.equal(summary.subjects.unassignedSubjectCount, 0);
	assert.equal(summary.sources.subjects.state, 'no_saved_data');
	// A real zero is a valid value, not a degraded read.
	assert.notEqual(summary.sourceState, 'partial_degraded');
});

test('DASH-RESILIENCE-C01: an unavailable generation read is null, not NONE, and holds at SETUP', () => {
	const summary = aggregateDashboardSummary(aggregateInput({
		generationResult: { ok: false, data: null, error: 'run read failed' },
	}));

	assert.equal(summary.generation.available, false);
	assert.equal(summary.generation.latestRunStatus, null);
	assert.notEqual(summary.generation.latestRunStatus, 'NONE');
	assert.equal(summary.sourceState, 'partial_degraded');
	// Unknown generation state must not read as "no run yet" (PREFERENCES).
	assert.equal(summary.lifecyclePhase, 'SETUP');
});

test('DASH-RESILIENCE-C01: readiness service is read-only (no writer calls)', () => {
	const servicePath = fileURLToPath(new URL('../services/dashboard-readiness.service.ts', import.meta.url));
	const source = readFileSync(servicePath, 'utf8');
	assert(
		!/prisma\.\w+\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/.test(source),
		'dashboard readiness service must not perform writes',
	);
	assert(!/\$executeRaw|\$queryRawUnsafe/.test(source), 'dashboard readiness service must not run raw writes');
});

test('DASH-RESILIENCE-C01: verified school year + typed active-term 409 keeps saved counts and term state', async () => {
	await seedSandbox();
	const previousApi = process.env.ENROLLPRO_API;
	const previousToken = process.env.ENROLLPRO_SERVICE_TOKEN;
	try {
		await withEnrollProFixture({
			'/integration/v1/school-year': { body: { data: { id: YEAR, yearLabel: '2030-2031' } } },
			'/integration/v1/active-term': { status: 409, body: { code: 'ACTIVE_TERM_UNRESOLVED', message: 'No term contains the current date.' } },
		}, async (baseUrl) => {
			process.env.ENROLLPRO_API = baseUrl;
			process.env.ENROLLPRO_SERVICE_TOKEN = 'fixture-token';

			const runtime = await resolveRuntimeContext(SAND, 'fixture-token');
			assert.ok(runtime, 'runtime context resolves from the saved mirror');
			assert.equal(runtime!.activeSchoolYearId, YEAR);
			assert.equal(runtime!.upstream.verified, true, 'the school-year contract is independently verified');
			assert.equal(runtime!.activeTerm.reachable, true, 'a reachable 409 is not unreachable');
			assert.equal(runtime!.activeTerm.code, 'ACTIVE_TERM_UNRESOLVED');
			assert.notEqual(runtime!.activeTerm.source, 'enrollpro-unreachable');

			const summary = await getDashboardReadinessSummary({ schoolId: SAND, authToken: 'fixture-token' });
			assert.equal(summary.activeSchoolYearId, YEAR);
			assert.equal(summary.sources.runtimeContext.state, 'verified_live');
			assert.equal(summary.campus.available, true);
			assert.equal(summary.campus.teachingRoomCount, 1);
			assert.equal(summary.subjects.available, true);
			assert.equal(summary.subjects.subjectCount, 1);
			assert.equal(summary.faculty.available, true);
			assert.equal(summary.faculty.facultyCount, 1);
		});
	} finally {
		if (previousApi === undefined) delete process.env.ENROLLPRO_API; else process.env.ENROLLPRO_API = previousApi;
		if (previousToken === undefined) delete process.env.ENROLLPRO_SERVICE_TOKEN; else process.env.ENROLLPRO_SERVICE_TOKEN = previousToken;
		await cleanupSandbox();
	}
});

test('DASH-RESILIENCE-C01: unreachable EnrollPro with valid ATLAS mirrors keeps saved counts and reports saved data', async () => {
	await seedSandbox();
	const previousApi = process.env.ENROLLPRO_API;
	const previousToken = process.env.ENROLLPRO_SERVICE_TOKEN;
	// Reserved TEST-NET port with no listener: deterministic connection refusal.
	process.env.ENROLLPRO_API = 'http://127.0.0.1:1';
	process.env.ENROLLPRO_SERVICE_TOKEN = 'fixture-token';
	try {
		const summary = await getDashboardReadinessSummary({ schoolId: SAND, authToken: 'fixture-token' });
		assert.equal(summary.activeSchoolYearId, YEAR);
		assert.equal(summary.sourceState, 'using_saved_data');
		assert.equal(summary.campus.available, true);
		assert.equal(summary.campus.teachingRoomCount, 1);
		assert.equal(summary.subjects.available, true);
		assert.equal(summary.subjects.subjectCount, 1);
		assert.equal(summary.faculty.available, true);
		assert.equal(summary.faculty.facultyCount, 1);
	} finally {
		if (previousApi === undefined) delete process.env.ENROLLPRO_API; else process.env.ENROLLPRO_API = previousApi;
		if (previousToken === undefined) delete process.env.ENROLLPRO_SERVICE_TOKEN; else process.env.ENROLLPRO_SERVICE_TOKEN = previousToken;
		await cleanupSandbox();
	}
});

test('DASH-RESILIENCE-C01 mounted route: typed active-term 409 is 200 with reachable term and saved counts; missing token is 401', async () => {
	await seedSandbox();
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object');
	const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
	const previousApi = process.env.ENROLLPRO_API;
	const previousToken = process.env.ENROLLPRO_SERVICE_TOKEN;
	try {
		await withEnrollProFixture({
			'/integration/v1/school-year': { body: { data: { id: YEAR, yearLabel: '2030-2031' } } },
			'/integration/v1/active-term': { status: 409, body: { code: 'ACTIVE_TERM_UNRESOLVED', message: 'No term contains the current date.' } },
		}, async (fixtureUrl) => {
			process.env.ENROLLPRO_API = fixtureUrl;
			process.env.ENROLLPRO_SERVICE_TOKEN = 'fixture-token';

			const authToken = jwt.sign(
				{ userId: 46, role: 'officer', authSource: 'local', accountId: 46, schoolId: SAND },
				process.env.JWT_SECRET!,
				{ expiresIn: '1h' },
			);
			const response = await fetch(`${baseUrl}/dashboard/readiness-summary?schoolId=${SAND}`, {
				headers: { Authorization: `Bearer ${authToken}` },
			});
			assert.equal(response.status, 200);
			const json = await response.json() as any;
			assert.equal(json.activeSchoolYearId, YEAR);
			assert.equal(json.activeTerm?.reachable, true);
			assert.equal(json.activeTerm?.code, 'ACTIVE_TERM_UNRESOLVED');
			assert.notEqual(json.activeTerm?.source, 'enrollpro-unreachable');
			assert.equal(json.campus?.available, true);
			assert.equal(json.campus?.teachingRoomCount, 1);
			assert.equal(json.subjects?.available, true);
			assert.equal(json.subjects?.subjectCount, 1);

			// Expired/invalid session: the mounted middleware rejects before any
			// domain read, so no summary body is produced.
			const unauthenticated = await fetch(`${baseUrl}/dashboard/readiness-summary?schoolId=${SAND}`);
			assert.equal(unauthenticated.status, 401);
			const unauthenticatedBody = await unauthenticated.json() as any;
			assert.equal(unauthenticatedBody?.sourceState, undefined);
		});
	} finally {
		if (previousApi === undefined) delete process.env.ENROLLPRO_API; else process.env.ENROLLPRO_API = previousApi;
		if (previousToken === undefined) delete process.env.ENROLLPRO_SERVICE_TOKEN; else process.env.ENROLLPRO_SERVICE_TOKEN = previousToken;
		await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
		await cleanupSandbox();
	}
});

test('DASH-RESILIENCE-C01: sandbox fixtures leave zero residue', async () => {
	const [schools, mirrors, subjects, buildings] = await Promise.all([
		prisma.school.count({ where: { id: SAND } }),
		prisma.enrollProSchoolYearMirror.count({ where: { schoolId: SAND } }),
		prisma.subject.count({ where: { schoolId: SAND } }),
		prisma.building.count({ where: { schoolId: SAND } }),
	]);
	assert.equal(schools + mirrors + subjects + buildings, 0, 'sandbox fixtures must be fully cleaned up');
});
