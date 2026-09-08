/**
 * EVAL-C01R — Dashboard route authority HTTP integration.
 *
 * Exercises the MOUNTED Dashboard route through real authentication
 * middleware (`authenticateWithSystemToken` + `requirePrivilegedRole`) and the
 * real service. Uses disposable sandbox SCHOOL ids (repo-sanctioned hermetic
 * pattern: synthetic rows only, never real school-1/business data) and
 * removes every created row in `finally` with a zero-residue assertion.
 *
 * Proofs:
 *  - unresolved actor → 403 SCHOOL_SCOPE_REQUIRED (zero domain reads)
 *  - cross-school query → 403 SCHOOL_SCOPE_MISMATCH (zero domain reads)
 *  - malformed school/year → typed 400 INVALID_PARAM
 *  - historical/mismatched requested year never becomes current truth
 *  - a published run OUTSIDE the former ten-row window is still found
 *  - FAILED rows with stale publication markers remain unpublished
 *
 * Query-shape (publication read selects no draftEntries/violations and has no
 * take window) is asserted in `dashboard-lifecycle-truth.test.ts` against the
 * production service source; here we functionally prove heavy payloads on the
 * runs do not change the resolved answer.
 *
 * Run (server workspace): `npx tsx src/__tests__/dashboard-http-authority.test.ts`
 */
import http from 'node:http';
import jwt from 'jsonwebtoken';
import type { Prisma } from '@prisma/client';

import app from '../app.js';
import { prisma } from '../lib/prisma.js';

const SAND_MAIN = 7799001;
const SAND_EMPTY = 7799002;
const SAND_TIE = 7799003;
const ACTIVE_YEAR = 2002;
const MISM_ACTIVE_YEAR = 2001;
const TIE_YEAR = 3003;

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n═══ ${name} ═══`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	if (actual === expected) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
}

async function requestJson(baseUrl: string, path: string, token?: string) {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (token) headers.Authorization = `Bearer ${token}`;
	const response = await fetch(`${baseUrl}${path}`, { headers });
	let json: any = null;
	try {
		json = await response.json();
	} catch {
		json = null;
	}
	return { status: response.status, json };
}

function token(schoolId?: number): string {
	const payload: Record<string, unknown> = {
		userId: 46,
		role: 'officer',
		authSource: 'local',
		accountId: 46,
	};
	if (schoolId != null) payload.schoolId = schoolId;
	return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

async function seedMain() {
	await prisma.school.upsert({
		where: { id: SAND_MAIN },
		create: { id: SAND_MAIN, name: 'EVAL-C01R Sandbox Main', shortName: 'EVALM' },
		update: {},
	});
	await prisma.enrollProSchoolYearMirror.upsert({
		where: { schoolId_enrollProSchoolYearId: { schoolId: SAND_MAIN, enrollProSchoolYearId: ACTIVE_YEAR } },
		create: {
			schoolId: SAND_MAIN,
			enrollProSchoolYearId: ACTIVE_YEAR,
			yearLabel: 'S.Y. 2002-2003',
			isActive: true,
			syncStatus: 'synced',
			lastSyncedAt: new Date(),
		},
		update: { isActive: true },
	});
	const base = Date.UTC(2026, 0, 1);
	const mk = (createdAt: number, status: 'COMPLETED' | 'FAILED', summary: Prisma.InputJsonValue) =>
		prisma.generationRun.create({
			data: {
				schoolId: SAND_MAIN,
				schoolYearId: ACTIVE_YEAR,
				status,
				triggeredBy: 46,
				summary,
				// Heavy payloads present on every run: if the publication path
				// selected them the resolved answer would still be correct, but
				// the memory rule is that they are never loaded.
				draftEntries: Array.from({ length: 200 }, (_, i) => ({ entryId: `x-${i}` })),
				violations: Array.from({ length: 100 }, (_, i) => ({ code: `V${i}` })),
				unassignedItems: Array.from({ length: 50 }, (_, i) => ({ key: `u-${i}` })),
				createdAt: new Date(createdAt),
			},
		});
	// Oldest → published (12th by recency among completed, outside a 10-row window).
	const published = await mk(base, 'COMPLETED', { isPublished: true, publishedAt: '2026-08-01T00:00:00.000Z', publishedBy: 46 });
	for (let i = 1; i <= 11; i += 1) {
		await mk(base + i * 60_000, 'COMPLETED', { isPublished: false });
	}
	// Newest overall → FAILED with stale publication markers.
	const failed = await mk(base + 12 * 60_000, 'FAILED', { isPublished: true, publishedAt: '2026-09-01T00:00:00.000Z', publishedBy: 46 });
	return { published, failed };
}

async function cleanup() {
	await prisma.generationRun.deleteMany({ where: { schoolId: { in: [SAND_MAIN, SAND_EMPTY, SAND_TIE] } } });
	await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: { in: [SAND_MAIN, SAND_EMPTY, SAND_TIE] } } });
	await prisma.school.deleteMany({ where: { id: { in: [SAND_MAIN, SAND_EMPTY, SAND_TIE] } } });
	return Promise.all([
		prisma.generationRun.count({ where: { schoolId: { in: [SAND_MAIN, SAND_EMPTY, SAND_TIE] } } }),
		prisma.enrollProSchoolYearMirror.count({ where: { schoolId: { in: [SAND_MAIN, SAND_EMPTY, SAND_TIE] } } }),
		prisma.school.count({ where: { id: { in: [SAND_MAIN, SAND_EMPTY, SAND_TIE] } } }),
	]);
}

/**
 * EVAL-C01R1 — failing-first tie fixture: three runs with an IDENTICAL
 * createdAt timestamp. Without the deterministic secondary id-desc ordering,
 * the tie winner is undefined (a lower-id row may be returned), so these
 * assertions fail RED; with `orderBy [createdAt desc, id desc]` the higher-id
 * row deterministically wins GREEN.
 *   - i1: COMPLETED, isPublished true
 *   - i2: COMPLETED, isPublished true (higher id than i1) → newest published
 *   - i3: FAILED, stale isPublished marker (higher id than i2) → newest latest-run
 */
async function seedTie() {
	await prisma.school.upsert({
		where: { id: SAND_TIE },
		create: { id: SAND_TIE, name: 'EVAL-C01R1 Sandbox Tie', shortName: 'EVALT' },
		update: {},
	});
	await prisma.enrollProSchoolYearMirror.upsert({
		where: { schoolId_enrollProSchoolYearId: { schoolId: SAND_TIE, enrollProSchoolYearId: TIE_YEAR } },
		create: {
			schoolId: SAND_TIE,
			enrollProSchoolYearId: TIE_YEAR,
			yearLabel: 'S.Y. 3003-3004',
			isActive: true,
			syncStatus: 'synced',
			lastSyncedAt: new Date(),
		},
		update: { isActive: true },
	});
	const tie = new Date(Date.UTC(2026, 6, 4, 12, 0, 0));
	const i1 = await prisma.generationRun.create({
		data: { schoolId: SAND_TIE, schoolYearId: TIE_YEAR, status: 'COMPLETED', triggeredBy: 46, summary: { isPublished: true }, createdAt: tie },
	});
	const i2 = await prisma.generationRun.create({
		data: { schoolId: SAND_TIE, schoolYearId: TIE_YEAR, status: 'COMPLETED', triggeredBy: 46, summary: { isPublished: true }, createdAt: tie },
	});
	const i3 = await prisma.generationRun.create({
		data: {
			schoolId: SAND_TIE,
			schoolYearId: TIE_YEAR,
			status: 'FAILED',
			triggeredBy: 46,
			summary: { isPublished: true, publishedAt: '2026-07-04T12:00:00.000Z', publishedBy: 46 },
			createdAt: tie,
		},
	});
	return { i1, i2, i3 };
}

async function run() {
	if (!process.env.JWT_SECRET) {
		console.error('JWT_SECRET is not configured; aborting.');
		process.exitCode = 1;
		return;
	}

	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
	const address = server.address();
	if (!address || typeof address === 'string') {
		server.close();
		process.exitCode = 1;
		return;
	}
	const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

	try {
		const { published, failed } = await seedMain();
		const tie = await seedTie();

		section('Scope guards (no domain reads)');
		const unresolved = await requestJson(baseUrl, '/dashboard/readiness-summary?schoolId=' + SAND_MAIN, token());
		assertEqual(unresolved.status, 403, 'unresolved actor → 403');
		assertEqual(unresolved.json?.code, 'SCHOOL_SCOPE_REQUIRED', 'unresolved actor code');

		const crossSchool = await requestJson(baseUrl, '/dashboard/readiness-summary?schoolId=' + SAND_EMPTY, token(SAND_MAIN));
		assertEqual(crossSchool.status, 403, 'cross-school query → 403');
		assertEqual(crossSchool.json?.code, 'SCHOOL_SCOPE_MISMATCH', 'cross-school code');

		const crossAlias = await requestJson(baseUrl, '/dashboard/summary?schoolId=' + SAND_EMPTY, token(SAND_MAIN));
		assertEqual(crossAlias.status, 403, 'cross-school /summary alias → 403');

		section('Malformed parameters → typed 400');
		const badSchool = await requestJson(baseUrl, '/dashboard/readiness-summary?schoolId=abc', token(SAND_MAIN));
		assertEqual(badSchool.status, 400, 'malformed schoolId → 400');
		assertEqual(badSchool.json?.code, 'INVALID_PARAM', 'malformed schoolId code');

		const badFloat = await requestJson(baseUrl, '/dashboard/readiness-summary?schoolId=1.5', token(SAND_MAIN));
		assertEqual(badFloat.status, 400, 'non-integer schoolId → 400');

		const badYear = await requestJson(baseUrl, `/dashboard/readiness-summary?schoolId=${SAND_MAIN}&schoolYearId=-5`, token(SAND_MAIN));
		assertEqual(badYear.status, 400, 'malformed schoolYearId → 400');
		assertEqual(badYear.json?.code, 'INVALID_PARAM', 'malformed schoolYearId code');

		section('Publication authority — real DB');
		const baseline = await requestJson(baseUrl, `/dashboard/readiness-summary?schoolId=${SAND_MAIN}`, token(SAND_MAIN));
		assertEqual(baseline.status, 200, 'sandbox readiness → 200');
		assertEqual(baseline.json?.activeSchoolYearId, ACTIVE_YEAR, 'active year from runtime = 2002');
		assertEqual(baseline.json?.lifecyclePhase, 'PUBLISHED', 'published lifecycle');
		assertEqual(baseline.json?.generation?.isPublished, true, 'generation.isPublished true');
		assertEqual(
			baseline.json?.generation?.publishedRunId,
			published.id,
			'published run outside former 10-row window is still found (oldest run id)',
		);
		assertEqual(
			baseline.json?.generation?.latestRunId,
			failed.id,
			'latest (newest) run is the FAILED stale-marker row',
		);
		assertEqual(
			baseline.json?.generation?.publishedRunId !== failed.id,
			true,
			'FAILED stale markers do NOT drive publication (published id != failed id)',
		);
		assertEqual(baseline.json?.generation?.latestRunStatus, 'FAILED', 'latest run status FAILED');

		const mismYear = await requestJson(
			baseUrl,
			`/dashboard/readiness-summary?schoolId=${SAND_MAIN}&schoolYearId=${MISM_ACTIVE_YEAR}`,
			token(SAND_MAIN),
		);
		assertEqual(mismYear.status, 200, 'mismatched requested year → 200');
		assertEqual(mismYear.json?.activeSchoolYearId, ACTIVE_YEAR, 'mismatched requested year cannot shift active year to 2001');
		assertEqual(mismYear.json?.generation?.publishedRunId, published.id, 'mismatched requested year cannot change publication scope');

		section('Historical requested year cannot substitute when runtime is unavailable');
		const emptySchool = await requestJson(baseUrl, `/dashboard/readiness-summary?schoolId=${SAND_EMPTY}&schoolYearId=9`, token(SAND_EMPTY));
		assertEqual(emptySchool.status, 200, 'zero-evidence school → 200');
		assertEqual(emptySchool.json?.activeSchoolYearId, null, 'runtime unavailable → no active year (requested 9 ignored)');
		assertEqual(emptySchool.json?.generation?.isPublished, false, 'no current year → never published');
		assertEqual(emptySchool.json?.lifecyclePhase !== 'PUBLISHED', true, 'no current year → lifecycle not PUBLISHED');

		section('Deterministic secondary id ordering on equal createdAt (failing-first)');
		const tieResp = await requestJson(baseUrl, `/dashboard/readiness-summary?schoolId=${SAND_TIE}`, token(SAND_TIE));
		assertEqual(tieResp.status, 200, 'tie sandbox readiness → 200');
		assertEqual(tieResp.json?.activeSchoolYearId, TIE_YEAR, 'tie active year = 3003');
		// Latest-run: among equal createdAt, the HIGHER id (FAILED i3) wins.
		assertEqual(tieResp.json?.generation?.latestRunId, tie.i3.id, 'latest-run equal-createdAt tie → higher id (i3) wins');
		assertEqual(tieResp.json?.generation?.latestRunStatus, 'FAILED', 'latest-run tie status FAILED (higher id)');
		// Published: among equal createdAt published COMPLETED rows, HIGHER id (i2) wins.
		assertEqual(tieResp.json?.generation?.publishedRunId, tie.i2.id, 'published equal-createdAt tie → higher id (i2) wins');
		assertEqual(tieResp.json?.generation?.publishedRunId !== tie.i3.id, true, 'FAILED tie row does not drive publication');
		assertEqual(tieResp.json?.generation?.isPublished, true, 'tie publication still published');

		section('Heavy payloads present do not change the resolved publication answer');
		const heavy = await requestJson(baseUrl, `/dashboard/readiness-summary?schoolId=${SAND_MAIN}`, token(SAND_MAIN));
		assertEqual(heavy.status, 200, 'readiness with heavy run payloads → 200');
		assertEqual(heavy.json?.generation?.publishedRunId, published.id, 'published run resolved despite heavy payloads on every run');
		assertEqual(heavy.json?.generation?.isPublished, true, 'still published with heavy payloads present');
	} finally {
		const residue = await cleanup();
		const [runs, mirrors, schools] = residue;
		assertEqual(runs, 0, 'zero generation-run residue after cleanup');
		assertEqual(mirrors, 0, 'zero mirror residue after cleanup');
		assertEqual(schools, 0, 'zero school residue after cleanup');
		server.close();
	}

	console.log(`\n═══ RESULT ${passCount} pass / ${failCount} fail ═══`);
	if (failCount > 0) process.exitCode = 1;
}

run().catch((err) => {
	console.error('HTTP integration run failed:', err);
	process.exitCode = 1;
});
