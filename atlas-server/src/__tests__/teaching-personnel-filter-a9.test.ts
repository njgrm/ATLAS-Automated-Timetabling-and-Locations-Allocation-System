/**
 * A9 — ATLAS must ingest TEACHING personnel only from EnrollPro.
 *
 * Source of truth: docs/reference/enrollpro-teaching-personnel-api-2026-09-29.md.
 * Without `?personnelType=TEACHING` EnrollPro returns every personnel type and
 * ATLAS ingests non-teaching staff as teachers (live: faculty_mirrors 3
 * Melchora Aquino, 20 Apolinario Mabini, 33 Jose Rizal — no department, 0
 * ownerships in year 1, yet counted as active teachers in S.Y. 2022-2023,
 * giving 23 "teachers" where Faculty shows 20).
 *
 * Controls:
 *  1. adapter URL carries the param on EVERY page, and composes with `&`
 *     (a `?` here silently re-opens the query and reads the feed unfiltered);
 *  2. the adapter's ingested set is genuinely the teaching-only set — proven
 *     against a server that FILTERS on the param, so the assertion
 *     discriminates (1 teaching row vs 3 rows unfiltered);
 *  3. scheduler ancillary authority requests teaching personnel;
 *  4. rollover faculty endpoints request teaching personnel;
 *  5. MANDATORY EXCEPTION: the login-identity lookup is deliberately
 *     unfiltered and still resolves a non-teaching person;
 *  6. the existing reconcile path marks a now-absent mirror stale and does
 *     NOT delete it (years 8-10 history is preserved).
 *
 * Run: npx tsx --test src/__tests__/teaching-personnel-filter-a9.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { EnrollProFacultyAdapter } from '../services/faculty-adapter.js';
import { resolveSchedulerAncillaryAuthority } from '../services/scheduler-ancillary-authority.service.js';
import { buildFacultyReconciliationSummary } from '../services/faculty.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(here, '..', '..');

const TEACHING = {
	teacherId: 101,
	employeeId: '1000101',
	firstName: 'JUAN',
	lastName: 'DELA CRUZ',
	department: 'MATH',
	specialization: 'MATH',
	isActive: true,
	personnelType: 'TEACHING',
};
const NON_TEACHING_REGISTRAR = {
	teacherId: 201,
	employeeId: '1000201',
	firstName: 'MELCHORA',
	lastName: 'AQUINO',
	department: null,
	specialization: null,
	isActive: true,
	personnelType: 'NON_TEACHING',
};
const NON_TEACHING_MAINTENANCE = {
	teacherId: 202,
	employeeId: '1000202',
	firstName: 'APOLINARIO',
	lastName: 'MABINI',
	department: null,
	specialization: null,
	isActive: true,
	personnelType: 'NON_TEACHING',
};

type FeedRow = Record<string, unknown>;

/** Realistic EnrollPro behaviour: honour personnelType, else return everyone. */
function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function makeFilteredFetch(recorded: string[]): typeof fetch {
	return (async (input: RequestInfo | URL) => {
		const url = String(input);
		recorded.push(url);
		const parsed = new URL(url);
		const requested = (parsed.searchParams.get('personnelType') ?? '').toUpperCase();
		const all: FeedRow[] = [TEACHING, NON_TEACHING_REGISTRAR, NON_TEACHING_MAINTENANCE];
		const rows = requested ? all.filter((row) => row.personnelType === requested) : all;
		return jsonResponse({ data: rows, meta: { page: 1, limit: 200, totalPages: 1 } });
	}) as typeof fetch;
}

function withEnv<T>(vars: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
	const saved = new Map<string, string | undefined>();
	for (const [key, value] of Object.entries(vars)) {
		saved.set(key, process.env[key]);
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	const restore = () => {
		for (const [key, value] of saved) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	};
	return run().then(
		(value) => { restore(); return value; },
		(error) => { restore(); throw error; },
	);
}

test('faculty adapter requests personnelType=TEACHING and composes pagination with &', async () => {
	const recorded: string[] = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = makeFilteredFetch(recorded);
	try {
		await withEnv({ ENROLLPRO_API: 'https://enrollpro.test/api', ENROLLPRO_SERVICE_TOKEN: undefined }, async () => {
			const adapter = new EnrollProFacultyAdapter('https://enrollpro.test/api');
			await adapter.fetchFacultyBySchoolYear(1, 9);
		});
	} finally {
		globalThis.fetch = originalFetch;
	}

	assert.ok(recorded.length > 0, 'the adapter must actually call EnrollPro');
	for (const url of recorded) {
		assert.match(
			url,
			/personnelType=TEACHING/,
			`every faculty ingestion request must carry personnelType=TEACHING, got: ${url}`,
		);
		assert.doesNotMatch(
			url,
			/[?&][?&]/,
			`a double separator means the query was re-opened and the feed is unfiltered: ${url}`,
		);
		assert.match(url, /\/integration\/v1\/faculty\?/, `unexpected faculty path: ${url}`);
		assert.match(url, /[?&]page=1[?&]limit=200/, `pagination must join with &, got: ${url}`);
	}
});

test('faculty adapter ingests only the teaching rows the filtered feed returns', async () => {
	const recorded: string[] = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = makeFilteredFetch(recorded);
	let result: Awaited<ReturnType<EnrollProFacultyAdapter['fetchFacultyBySchoolYear']>> | undefined;
	try {
		await withEnv({ ENROLLPRO_API: 'https://enrollpro.test/api', ENROLLPRO_SERVICE_TOKEN: undefined }, async () => {
			const adapter = new EnrollProFacultyAdapter('https://enrollpro.test/api');
			result = await adapter.fetchFacultyBySchoolYear(1, 9);
		});
	} finally {
		globalThis.fetch = originalFetch;
	}

	assert.ok(result, 'the adapter must return a fetch result');
	const ingested = (result.teachers as Array<{ id: number }>)
		.map((teacher) => teacher.id)
		.sort((a: number, b: number) => a - b);
	assert.deepEqual(
		ingested,
		[TEACHING.teacherId],
		'ATLAS must ingest the teaching teacher only; the registrar and maintenance staff must not be ingested as teachers',
	);
	assert.equal(ingested.length, 1, 'unfiltered would be 3 — the 23-vs-20 discrepancy would remain');
	for (const teacher of (result.teachers as Array<{ id: number; department?: string | null }>)) {
		assert.equal(teacher.department, 'MATH', 'an ingested teaching row keeps its department');
	}
});

test('scheduler ancillary authority requests personnelType=TEACHING alongside the school year', async () => {
	const SCHOOL_YEAR_ID = 12;
	const NOW = Date.parse('2026-09-24T04:00:00.000Z');
	const calls: string[] = [];
	const fetchImpl: typeof fetch = async (input) => {
		const url = String(input);
		calls.push(url);
		if (url.endsWith('/integration/v1/school-year')) {
			return jsonResponse({ data: { id: SCHOOL_YEAR_ID, yearLabel: '2030-2031' } });
		}
		// Real feed shape: an eligible coordinator row scoped to the active year.
		return jsonResponse({
			data: [{
				teacherId: 101,
				employeeId: TEACHING.employeeId,
				isActive: true,
				personnelType: 'TEACHING',
				ancillaryRoles: ['GRADE 7 COORDINATOR'],
			}],
			meta: {
				sourceSystem: 'ENROLLPRO',
				generatedAt: new Date(NOW - 60_000).toISOString(),
				scopeSchoolYearId: SCHOOL_YEAR_ID,
				totalRows: 1,
			},
		});
	};

	const result = await resolveSchedulerAncillaryAuthority(TEACHING.employeeId, {
		baseUrl: 'https://enrollpro.test/api',
		serviceToken: 'test-only-secret',
		fetchImpl,
		now: () => NOW,
	}, SCHOOL_YEAR_ID);

	assert.equal(result.verified, true, 'the teaching row still resolves scheduler authority');
	assert.equal(result.eligible, true);

	const facultyCall = calls.find((url) => url.includes('/integration/v1/default/faculty'));
	assert.ok(facultyCall, `the faculty feed must be called, saw: ${calls.join(', ')}`);
	assert.match(facultyCall, /personnelType=TEACHING/, `ancillary authority must be teaching-only, got: ${facultyCall}`);
	assert.match(facultyCall, /schoolYearId=12/, `the school year scope must be preserved, got: ${facultyCall}`);
	assert.doesNotMatch(facultyCall, /[?&][?&]/, `double separator re-opens the query: ${facultyCall}`);
});

test('rollover faculty ingestion endpoints request personnelType=TEACHING', () => {
	// `FACULTY_ENDPOINTS` is module-private, so this is a source-level check on
	// the production constant. The `&`/`?` composition that consumes it is
	// exercised for real by control 1 above (identical branch, same adapter
	// contract) and by the committed rollover suites, which serve these
	// endpoints over real HTTP and fail if the composed URL stops matching.
	const source = readFileSync(
		resolve(serverRoot, 'src', 'services', 'enrollpro-rollover.service.ts'),
		'utf8',
	);
	const block = source.match(/const FACULTY_ENDPOINTS = \[[\s\S]*?\];/);
	assert.ok(block, 'FACULTY_ENDPOINTS constant must be present');
	assert.match(block![0], /'\/integration\/v1\/faculty\?personnelType=TEACHING'/, 'faculty endpoint must be teaching-filtered');
	assert.match(
		block![0],
		/'\/integration\/v1\/default\/faculty\?personnelType=TEACHING'/,
		'the fallback default/faculty endpoint must be teaching-filtered too, or a fallback silently re-ingests non-teaching staff',
	);
	assert.match(source, /const separator = path\.includes\('\?'\) \? '&' : '\?';/, 'paginated fetches must join with & when the path already has a query');
});

test('MANDATORY EXCEPTION: the login-identity lookup stays unfiltered and still resolves non-teaching staff', async () => {
	// This is an auth-boundary exception, not an oversight. Filtering it would
	// lock non-teaching staff (registrar, admin, maintenance) out of ATLAS
	// entirely. It is HIGH under AGENTS.md §13 and outside lane A9's authority.
	const source = readFileSync(resolve(serverRoot, 'src', 'services', 'local-auth.service.ts'), 'utf8');
	const authCall = source.match(/`\$\{enrollProApi\}\/integration\/v1\/faculty[^`]*`/);
	assert.ok(authCall, 'the login-identity faculty fetch must be present');
	assert.doesNotMatch(
		authCall![0],
		/personnelType/,
		`the login identity lookup must NOT be personnelType-filtered or non-teaching staff cannot authenticate: ${authCall![0]}`,
	);
	assert.match(source, /MANDATORY EXCEPTION/, 'the exception must be documented at the call site');

	// The real identity resolution used by that path must accept a non-teaching row.
	const { selectExactEnrollProFacultyMatch } = await import('../services/local-auth.service.js');
	const match = selectExactEnrollProFacultyMatch(
		[
			{ teacherId: 1, employeeId: '1000001', firstName: 'A', lastName: 'TEACHER', email: null, isActive: true },
			{
				teacherId: NON_TEACHING_REGISTRAR.teacherId,
				employeeId: NON_TEACHING_REGISTRAR.employeeId,
				firstName: NON_TEACHING_REGISTRAR.firstName,
				lastName: NON_TEACHING_REGISTRAR.lastName,
				email: null,
				isActive: true,
				personnelType: 'NON_TEACHING',
			},
		] as never,
		{ employeeId: NON_TEACHING_REGISTRAR.employeeId, email: '' },
	);
	assert.ok(match, 'a non-teaching staff member must still resolve a login identity');
	assert.equal(match!.teacherId, NON_TEACHING_REGISTRAR.teacherId);
});

test('a mirror dropped by the teaching filter is marked stale, not deleted (history preserved)', async () => {
	// The existing reconcile path (faculty.service.ts) is the deactivation
	// mechanism — no new one is introduced. A non-teaching mirror present
	// before the filtered sync is simply "missing from upstream", so reconcile
	// reports it deactivated (isStale=true, staleReason='Missing from upstream
	// during reconciliation') and prune would be the only deleting path.
	const nonTeachingMirror = {
		externalId: NON_TEACHING_REGISTRAR.teacherId,
		firstName: NON_TEACHING_REGISTRAR.firstName,
		lastName: NON_TEACHING_REGISTRAR.lastName,
		department: null,
		specialization: null,
		employmentStatus: 'PERMANENT',
		isClassAdviser: false,
		advisoryEquivalentHours: 0,
		ancillaryMinutesPerWeek: null,
		ancillaryLoadSource: 'NONE' as const,
		canTeachOutsideDepartment: false,
		contactInfo: null,
		advisedSectionId: null,
		advisedSectionName: null,
		employeeId: NON_TEACHING_REGISTRAR.employeeId,
	};
	const teachingRow = {
		id: TEACHING.teacherId,
		employeeId: TEACHING.employeeId,
		firstName: TEACHING.firstName,
		lastName: TEACHING.lastName,
		department: TEACHING.department,
		specialization: TEACHING.specialization,
	};

	const reconcile = buildFacultyReconciliationSummary(
		[teachingRow] as never,
		[nonTeachingMirror] as never,
		'reconcile',
	);
	assert.equal(reconcile.deactivated, 1, 'the non-teaching mirror leaves the active set via the existing stale path');
	assert.equal(reconcile.removed, 0, 'reconcile must never delete; years 8-10 history is preserved');

	const prune = buildFacultyReconciliationSummary([teachingRow] as never, [nonTeachingMirror] as never, 'prune');
	assert.equal(prune.removed, 1, 'prune is the only deleting mode, and the operator Sync now path uses reconcile');
	assert.equal(prune.deactivated, 0);

	// The Faculty list count the 23-vs-20 discrepancy comes from must exclude
	// stale mirrors — this is the predicate that makes it read 20 after a sync.
	const facultyService = readFileSync(resolve(serverRoot, 'src', 'services', 'faculty.service.ts'), 'utf8');
	assert.match(
		facultyService,
		/prisma\.facultyMirror\.count\(\{ where: \{ schoolId, isStale: false \} \}\)/,
		'the active faculty count must exclude stale mirrors or the 23-vs-20 discrepancy persists',
	);
	assert.match(
		facultyService,
		/whereClause\.isStale = false;/,
		'the Faculty list must exclude stale mirrors by default',
	);
});
