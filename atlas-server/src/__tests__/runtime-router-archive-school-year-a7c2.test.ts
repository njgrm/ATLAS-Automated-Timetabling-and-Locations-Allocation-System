/**
 * A7-C2 — the per-year "Keep as history" routes (R3) and the `schoolYears`
 * field carried by every status site (R4).
 *
 *   POST /runtime/rollover-archive/year/preview
 *   POST /runtime/rollover-archive/year/apply
 *
 * ── WHY THIS FILE CANNOT HANG (A7-C2 hangfix addendum, 2026-09-29) ──────────
 * The previous executor ran out of this worktree for ~5 hours on a draft of
 * this file. Four things combined, and all four are fixed here:
 *
 *   1. NO REAL PRISMA CLIENT IS EVER CONSTRUCTED. `../lib/prisma.ts` does
 *      `new PrismaClient()` at module scope, which spawns a Prisma query-engine
 *      child process. This file replaces the module with `mock.module` BEFORE
 *      the router is dynamically imported, so there is no pool, no engine
 *      child, and nothing for a stuck run to leak. The old draft's
 *      `await import('../lib/prisma.js')` + `$disconnect()` in a `finally` is
 *      gone: `$disconnect()` only runs if control REACHES the `finally`, and an
 *      unsettled subtest means it never does.
 *   2. ALL CLEANUP IS IN `t.after(...)`, NEVER IN A PARENT `finally`. `t.after`
 *      runs when the test finishes HOWEVER it finishes — including when a
 *      subtest fails or throws — so the handles are released on every path.
 *   3. BOTH HTTP SERVERS ARE `unref()`-ed IMMEDIATELY AFTER `listen` and are
 *      closed with `closeAllConnections()` then `close()` in the same `t.after`.
 *      A surviving socket can therefore never hold the event loop open.
 *   4. EVERY `fetch` IS BOUNDED by a 10 s race that rejects with the request
 *      path. A hanging route becomes a RED TEST, not a stuck file.
 *
 * ── WHY A MOUNTED ROUTER AND NOT A SERVICE CALL ─────────────────────────────
 * The two load-bearing authority rows are ROUTE rows:
 *   1. the route refuses the EnrollPro ACTIVE year, and
 *   2. the route refuses a year belonging to ANOTHER SCHOOL.
 * Row 2 can only be decided at the route gate, because the route is what
 * decides WHICH school a `schoolYearId` is resolved against. Calling
 * `archiveSchoolYear()` directly cannot see a forged `schoolId` at all. So the
 * REAL router, the REAL `authenticateWithSystemToken` / `authenticate`
 * middleware and the REAL `authorizeRuntimeMutation` gate are mounted, exactly
 * as `rollover-year-identity-c01.test.ts` does it.
 *
 * ── "ZERO DISPATCH" IS OBSERVED, NOT ASSUMED (AGENTS.md §11) ────────────────
 * The two archive entry points are wrapped in counting delegates and injected
 * through the router's EXISTING `createRuntimeRouter` override seam — the same
 * seam `rollover-year-identity-c01` uses for `applyRolloverSync`. Those wrappers
 * call the REAL service, so the behaviour under test is production behaviour.
 * The idempotence subtest is the POSITIVE CONTROL: it proves the counters
 * actually move, so a `0` in a refusal row means "refused before the service",
 * not "the counter is dead".
 *
 * Run: `npm run test:archive-school-year-a7c2`
 *   = node --experimental-test-module-mocks --import tsx --test <this file>
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import test, { mock } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'a7-c2-archive-school-year-test-secret';
const SYSTEM_TOKEN = 'a7-c2-archive-school-year-system-token';
const SCHOOL_ID = 7;
const OTHER_SCHOOL_ID = 8;
const ACTIVE_YEAR_ID = 600;
const ACTIVE_YEAR_LABEL = '2099-2100';
const KEEPABLE_YEAR_ID = 500;
const KEEPABLE_YEAR_LABEL = '2098-2099';
const KEEPABLE_YEAR_2_ID = 501;
const KEEPABLE_YEAR_2_LABEL = '2097-2098';
/**
 * A second not-yet-kept year that NO subtest writes to. The idempotence row
 * really archives `KEEPABLE_YEAR_ID`, so the R4 row must classify a year the
 * suite never touched — otherwise the ordering of two subtests would decide
 * whether a fixture is "past, not yet kept" or "kept as history".
 */
const UNTOUCHED_YEAR_ID = 502;
const UNTOUCHED_YEAR_LABEL = '2096-2097';
const OTHER_SCHOOL_YEAR_ID = 700;

/** Every mutating Prisma call this suite observed. */
type MutationLog = { model: string; op: string }[];

type MirrorRow = {
	id: number;
	schoolId: number;
	enrollProSchoolYearId: number;
	yearLabel: string;
	isActive: boolean;
	isArchived: boolean;
	archivedAt: Date | null;
	archivedBy: number | null;
	archiveReason: string | null;
	lastSyncedAt: Date | null;
	lastVerifiedAt: Date | null;
	facultyCount: number;
	sectionCount: number;
	syncStatus: string;
	lastFailureSummary: string | null;
	lastSyncMetadata: unknown;
	updatedAt: Date;
};

function mirror(overrides: Partial<MirrorRow> & Pick<MirrorRow, 'schoolId' | 'enrollProSchoolYearId' | 'yearLabel'>): MirrorRow {
	// `id` is applied AFTER the spread so an explicit `id` override wins instead
	// of being silently overwritten by the default (TS2783). The cast is honest:
	// the parameter type already requires schoolId, enrollProSchoolYearId and
	// yearLabel, which the spread supplies.
	return {
		isActive: false,
		isArchived: false,
		archivedAt: null,
		archivedBy: null,
		archiveReason: null,
		lastSyncedAt: new Date('2098-01-01T00:00:00.000Z'),
		lastVerifiedAt: new Date('2098-01-01T00:00:00.000Z'),
		facultyCount: 0,
		sectionCount: 0,
		syncStatus: 'IDLE',
		lastFailureSummary: null,
		lastSyncMetadata: null,
		updatedAt: new Date('2098-01-01T00:00:00.000Z'),
		...overrides,
		id: overrides.id ?? overrides.enrollProSchoolYearId,
	} as MirrorRow;
}

function matchUnique(row: MirrorRow, args: any): boolean {
	const where = args?.where ?? {};
	if (where.schoolId_enrollProSchoolYearId) {
		return row.schoolId === where.schoolId_enrollProSchoolYearId.schoolId
			&& row.enrollProSchoolYearId === where.schoolId_enrollProSchoolYearId.enrollProSchoolYearId;
	}
	if (where.enrollProSchoolYearId != null) return row.enrollProSchoolYearId === where.enrollProSchoolYearId;
	return false;
}

const MUTATIONS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);

/**
 * A per-model delegate. `prefix` distinguishes a write inside the archive
 * transaction (`tx.`) from a write on the root client, so a write cannot hide
 * from the count by changing transaction shape.
 */
function delegate(model: string, prefix: string, log: MutationLog, rows?: MirrorRow[]) {
	const record = (op: string) => log.push({ model: `${prefix}${model}`, op });
	return {
		findMany: async (args: any) => {
			if (!rows) return [];
			// The real Prisma honours these filters, and BOTH production queries
			// depend on them: `listArchivedYears` filters `isArchived: true` and
			// A7-C2's `listSchoolYears` filters on `schoolId` only. A fake that
			// ignored `isArchived` would make the "archivedYears is unchanged"
			// assertion pass for the wrong reason.
			return rows.filter((r) => {
				const where = args?.where ?? {};
				if (where.schoolId != null && r.schoolId !== where.schoolId) return false;
				if (where.isArchived != null && r.isArchived !== where.isArchived) return false;
				if (where.isActive != null && r.isActive !== where.isActive) return false;
				return true;
			});
		},
		findFirst: async (args: any) => {
			if (!rows) return null;
			const pool = rows.filter((r) => !args?.where?.schoolId || r.schoolId === args.where.schoolId);
			if (args?.where?.isActive === true) return pool.find((r) => r.isActive) ?? null;
			if (args?.where?.isArchived === true) return pool.find((r) => r.isArchived) ?? null;
			return pool[0] ?? null;
		},
		findUnique: async (args: any) => (rows ? rows.find((r) => matchUnique(r, args)) ?? null : null),
		count: async () => 0,
		aggregate: async () => ({}),
		create: async (args: any) => {
			record('create');
			const created = mirror({ schoolId: SCHOOL_ID, enrollProSchoolYearId: 0, yearLabel: '', ...(args?.data ?? {}) });
			if (rows) rows.push(created);
			return { ...created, id: created.id };
		},
		update: async (args: any) => {
			record('update');
			if (!rows) return null;
			const row = rows.find((r) => r.id === args?.where?.id);
			if (row) Object.assign(row, args.data ?? {});
			return row ?? null;
		},
		updateMany: async (args: any) => { record('updateMany'); return { count: 0 }; },
		upsert: async (args: any) => {
			record('upsert');
			if (!rows) return null;
			const row = rows.find((r) => matchUnique(r, args ?? {}));
			if (row) return row;
			const created = mirror({ schoolId: SCHOOL_ID, enrollProSchoolYearId: 0, yearLabel: '', ...(args?.create ?? {}) });
			rows.push(created);
			return created;
		},
		delete: async () => { record('delete'); return null; },
		deleteMany: async () => { record('deleteMany'); return { count: 0 }; },
	};
}

/**
 * The replacement `prisma` export. A Proxy so every model the service touches
 * (the mirror, auditLog, and the ~20 models `countDummyYearRecords` reads) is
 * served from one instrumented factory, with no real connection anywhere.
 */
function instrumentedPrisma(rows: MirrorRow[], log: MutationLog) {
	const rootDelegates = new Map<string, any>();
	const txDelegates = new Map<string, any>();
	const pick = (cache: Map<string, any>, model: string) => {
		if (!cache.has(model)) cache.set(model, delegate(model, '', log, model === 'enrollProSchoolYearMirror' ? rows : undefined));
		return cache.get(model);
	};
	const surface = (cache: Map<string, any>, prefix: string) => new Proxy({}, {
		get(_t, prop) {
			if (typeof prop !== 'string') return undefined;
			if (prop === 'then') return undefined;
			if (prop === '$transaction') {
				return async (arg: any) => {
					log.push({ model: `${prefix}prisma`, op: '$transaction' });
					return typeof arg === 'function' ? arg(surface(txDelegates, 'tx.')) : arg;
				};
			}
			if (prop.startsWith('$')) return async () => {};
			if (!cache.has(prop)) {
				const d = delegate(prop, prefix, log, prop === 'enrollProSchoolYearMirror' ? rows : undefined);
				cache.set(prop, d);
			}
			return cache.get(prop);
		},
	});
	// `pick` exists only so the map/`prefix` shape reads clearly above; the Proxy
	// bodies are the implementation.
	void pick;
	return surface(rootDelegates, '');
}

function upstreamResponse(pathname: string): unknown {
	if (pathname === '/integration/v1/school-year') return { data: { id: ACTIVE_YEAR_ID, yearLabel: ACTIVE_YEAR_LABEL } };
	if (pathname === '/integration/v1/health') return { ok: true };
	return { data: {} };
}

type Mounted = { server: http.Server; url: string };

/**
 * Start a server and UNREF it immediately, so even a leaked handle can never
 * hold the event loop open. Cleanup lives in the caller's `t.after`.
 */
async function startServer(app: http.RequestListener): Promise<Mounted> {
	const server = http.createServer(app);
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	server.unref();
	const address = server.address();
	assert.ok(address && typeof address === 'object');
	return { server, url: `http://127.0.0.1:${address.port}` };
}

async function closeServer(mounted: Mounted): Promise<void> {
	mounted.server.closeAllConnections();
	await new Promise<void>((resolve) => {
		mounted.server.close(() => resolve());
		// A second tick so `closeAllConnections` above is observed before the
		// callback; the timer is unref'd so it cannot itself hold the loop.
		const t = setTimeout(resolve, 2000);
		t.unref();
	});
}

/** Bound every request. A hanging route must be a red test, never a stuck file. */
const REQUEST_BOUND_MS = 10_000;
async function boundedFetch(url: string, init: RequestInit, label: string): Promise<Response> {
	let timer: NodeJS.Timeout | undefined;
	try {
		return await Promise.race([
			fetch(url, init),
			new Promise<Response>((_resolve, reject) => {
				timer = setTimeout(() => reject(new Error(`A7-C2 REQUEST_BOUND: ${label} did not answer within ${REQUEST_BOUND_MS}ms`)), REQUEST_BOUND_MS);
				timer.unref();
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

const ROWS: MirrorRow[] = [
	mirror({ schoolId: SCHOOL_ID, enrollProSchoolYearId: ACTIVE_YEAR_ID, yearLabel: ACTIVE_YEAR_LABEL, isActive: true }),
	mirror({ schoolId: SCHOOL_ID, enrollProSchoolYearId: KEEPABLE_YEAR_ID, yearLabel: KEEPABLE_YEAR_LABEL }),
	mirror({ schoolId: SCHOOL_ID, enrollProSchoolYearId: KEEPABLE_YEAR_2_ID, yearLabel: KEEPABLE_YEAR_2_LABEL, isArchived: true, archivedAt: new Date('2097-06-01T00:00:00.000Z'), archivedBy: 1, archiveReason: 'ROLLOVER' }),
	mirror({ schoolId: SCHOOL_ID, enrollProSchoolYearId: UNTOUCHED_YEAR_ID, yearLabel: UNTOUCHED_YEAR_LABEL }),
	mirror({ schoolId: OTHER_SCHOOL_ID, enrollProSchoolYearId: OTHER_SCHOOL_YEAR_ID, yearLabel: '2096-2097' }),
];
const LOG: MutationLog = [];
const FAKE_PRISMA = instrumentedPrisma(ROWS, LOG);

// ── The module mock: the ONLY reason this file cannot leak a Prisma engine ──
mock.module(import.meta.resolve('../lib/prisma.js'), {
	namedExports: {
		prisma: FAKE_PRISMA,
		createTestPrismaClient: () => FAKE_PRISMA,
	},
});

const service = await import('../services/enrollpro-rollover.service.js');
const { createRuntimeRouter } = await import('../routes/runtime.router.js');

test('A7-C2 R3/R4: the per-year archive routes are school-scoped, refuse the active year, preview zero-write, are idempotent, and every status site carries schoolYears', async (t) => {
	process.env.JWT_SECRET = JWT_SECRET;
	process.env.ATLAS_SYSTEM_TOKEN = SYSTEM_TOKEN;
	// A dead port: nothing real can reach it, and no real client exists anyway.
	process.env.DATABASE_URL = 'postgresql://poison:poison@127.0.0.1:1/never_used';

	const upstream = await startServer((req, res) => {
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify(upstreamResponse(new URL(req.url ?? '/', 'http://localhost').pathname)));
	});
	process.env.ENROLLPRO_API = upstream.url;

	// Dispatch counters, injected through the router's own override seam. They
	// call the REAL service, so this is production behaviour with a probe.
	let previewDispatch = 0;
	let applyDispatch = 0;
	const app = express();
	app.use(express.json());
	app.use('/api/v1/runtime', createRuntimeRouter({
		previewArchiveSchoolYear: (input: any) => { previewDispatch += 1; return service.previewArchiveSchoolYear(input); },
		archiveSchoolYear: (input: any) => { applyDispatch += 1; return service.archiveSchoolYear(input); },
	} as any));
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	const mounted = await startServer(app);
	const base = `${mounted.url}/api/v1/runtime`;

	// ALL cleanup here, and here ONLY. It runs however this test ends.
	t.after(async () => {
		await closeServer(mounted);
		await closeServer(upstream);
	});

	const post = async (path: string, body: Record<string, unknown>, token = SYSTEM_TOKEN): Promise<{ status: number; body: any }> => {
		const response = await boundedFetch(`${base}${path}`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
			body: JSON.stringify(body),
		}, `POST ${path}`);
		// A route that does not exist answers Express's HTML 404 page. Parsing it
		// as JSON would replace the useful failure ("404, the route is missing")
		// with a parse error, so the raw text is carried when it is not JSON.
		const text = await response.text();
		let parsed: any = text;
		try { parsed = JSON.parse(text); } catch { /* keep the raw body */ }
		return { status: response.status, body: parsed };
	};
	const mutations = (): number => LOG.length;
	const mirrorWrites = (): number => LOG.filter((e) => e.model.includes('enrollProSchoolYearMirror')).length;

	await t.test('refuses the EnrollPro active year with 409 and writes nothing', async () => {
		const before = mutations();
		const result = await post('/rollover-archive/year/apply', { schoolId: SCHOOL_ID, schoolYearId: ACTIVE_YEAR_ID });
		assert.equal(result.status, 409, `expected 409 for the active year, got ${result.status}: ${JSON.stringify(result.body)}`);
		assert.equal(result.body.code, 'CANNOT_ARCHIVE_ACTIVE_YEAR');
		assert.equal(mutations() - before, 0, `the active-year refusal must write nothing; observed: ${JSON.stringify(LOG.slice(before))}`);
		assert.equal(ROWS.find((r) => r.enrollProSchoolYearId === ACTIVE_YEAR_ID)!.isArchived, false, 'the active year was archived anyway');
	});

	await t.test('refuses a forged cross-school schoolId with zero dispatch and zero writes', async () => {
		const officer = jwt.sign({ userId: 99, role: 'officer', schoolId: SCHOOL_ID, authSource: 'local' }, JWT_SECRET);
		const dispatchesBefore = applyDispatch;
		const before = mutations();
		const forged = await post('/rollover-archive/year/apply', { schoolId: OTHER_SCHOOL_ID, schoolYearId: OTHER_SCHOOL_YEAR_ID }, officer);
		assert.equal(forged.status, 403, `expected 403 for a cross-school body schoolId, got ${forged.status}: ${JSON.stringify(forged.body)}`);
		assert.equal(forged.body.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(applyDispatch, dispatchesBefore, 'the archive service was dispatched before the cross-school refusal');
		assert.equal(mutations() - before, 0, `the cross-school refusal must write nothing; observed: ${JSON.stringify(LOG.slice(before))}`);
	});

	await t.test('refuses a year that belongs to another school, with zero writes', async () => {
		const before = mutations();
		const foreign = await post('/rollover-archive/year/apply', { schoolId: SCHOOL_ID, schoolYearId: OTHER_SCHOOL_YEAR_ID });
		assert.equal(foreign.status, 404, `expected 404 for another school's year, got ${foreign.status}: ${JSON.stringify(foreign.body)}`);
		assert.equal(foreign.body.code, 'SCHOOL_YEAR_MIRROR_NOT_FOUND');
		assert.equal(mutations() - before, 0, `another school's year must not be written; observed: ${JSON.stringify(LOG.slice(before))}`);
		assert.equal(ROWS.find((r) => r.enrollProSchoolYearId === OTHER_SCHOOL_YEAR_ID)!.isArchived, false, "another school's year was archived");
	});

	await t.test('preview writes nothing and reports the preserved-counts shape', async () => {
		const before = mutations();
		const result = await post('/rollover-archive/year/preview', { schoolId: SCHOOL_ID, schoolYearId: KEEPABLE_YEAR_ID });
		assert.equal(result.status, 200, `expected 200 from the preview, got ${result.status}: ${JSON.stringify(result.body)}`);
		assert.equal(mutations() - before, 0, `the preview must be zero-write; observed: ${JSON.stringify(LOG.slice(before))}`);
		assert.equal(result.body.schoolYearId, KEEPABLE_YEAR_ID);
		assert.equal(result.body.yearLabel, KEEPABLE_YEAR_LABEL);
		assert.ok(result.body.preservedCounts && typeof result.body.preservedCounts === 'object', 'the preview must report preservedCounts');
		for (const key of ['sectionMirrors', 'generationRuns', 'publishedGenerationRuns', 'teachingLoadOwnerships']) {
			assert.equal(typeof result.body.preservedCounts[key], 'number', `preservedCounts.${key} must be a number`);
		}
		assert.equal(ROWS.find((r) => r.enrollProSchoolYearId === KEEPABLE_YEAR_ID)!.isArchived, false, 'the preview archived the year');
	});

	await t.test('preview refuses the active year too, and writes nothing', async () => {
		const before = mutations();
		const result = await post('/rollover-archive/year/preview', { schoolId: SCHOOL_ID, schoolYearId: ACTIVE_YEAR_ID });
		assert.equal(result.status, 409, `expected 409, got ${result.status}: ${JSON.stringify(result.body)}`);
		assert.equal(result.body.code, 'CANNOT_ARCHIVE_ACTIVE_YEAR');
		assert.equal(mutations() - before, 0, 'the active-year preview refusal must write nothing');
	});

	await t.test('a non-privileged caller is refused before any service call', async () => {
		const teacher = jwt.sign({ userId: 77, role: 'teacher', schoolId: SCHOOL_ID, authSource: 'local' }, JWT_SECRET);
		for (const path of ['/rollover-archive/year/preview', '/rollover-archive/year/apply']) {
			const previews = previewDispatch;
			const applies = applyDispatch;
			const before = mutations();
			const result = await post(path, { schoolId: SCHOOL_ID, schoolYearId: KEEPABLE_YEAR_ID }, teacher);
			assert.equal(result.status, 403, `${path} must refuse a teacher, got ${result.status}`);
			assert.equal(result.body.code, 'FORBIDDEN');
			assert.equal(previewDispatch, previews, `${path} dispatched the preview service for a non-privileged caller`);
			assert.equal(applyDispatch, applies, `${path} dispatched the archive service for a non-privileged caller`);
			assert.equal(mutations() - before, 0, `${path} wrote for a non-privileged caller`);
		}
	});

	await t.test('apply is idempotent, and it proves the dispatch counters are live', async () => {
		const appliesBefore = applyDispatch;
		const previewsBefore = previewDispatch;
		const first = await post('/rollover-archive/year/apply', { schoolId: SCHOOL_ID, schoolYearId: KEEPABLE_YEAR_ID, reason: 'A7-C2' });
		assert.equal(first.status, 200, `the first apply must succeed, got ${first.status}: ${JSON.stringify(first.body)}`);
		assert.equal(first.body.alreadyArchived, false, 'the first apply must not claim it was already archived');
		assert.equal(applyDispatch, appliesBefore + 1, 'a legitimate apply must move the dispatch counter, or every refusal row above is vacuous');
		assert.equal(previewDispatch, previewsBefore, 'apply must not dispatch the preview service');

		const writesAfterFirst = mirrorWrites();
		assert.ok(writesAfterFirst > 0, 'the first apply must actually have written, or idempotence proves nothing');

		const second = await post('/rollover-archive/year/apply', { schoolId: SCHOOL_ID, schoolYearId: KEEPABLE_YEAR_ID, reason: 'A7-C2 again' });
		assert.equal(second.status, 200, `the second apply must succeed, got ${second.status}: ${JSON.stringify(second.body)}`);
		assert.equal(second.body.alreadyArchived, true, 'the second apply must report alreadyArchived');
		assert.equal(mirrorWrites(), writesAfterFirst, `the second apply wrote again: ${JSON.stringify(LOG.slice(-6))}`);
	});

	await t.test('neither year route reaches sync, rollover, term-authority or reset', async () => {
		const before = LOG.length;
		await post('/rollover-archive/year/preview', { schoolId: SCHOOL_ID, schoolYearId: KEEPABLE_YEAR_2_ID });
		await post('/rollover-archive/year/apply', { schoolId: SCHOOL_ID, schoolYearId: KEEPABLE_YEAR_2_ID });
		const touched = LOG.slice(before);
		assert.deepEqual(
			touched.filter((entry) => /term|cycle|reset|sync/i.test(`${entry.model}.${entry.op}`)),
			[],
			`a year route touched sync/term/cycle/reset: ${JSON.stringify(touched)}`,
		);
	});

	// ── R4: the `schoolYears` list. `archivedYears` must stay byte-identical.
	await t.test('R4: schoolYears lists current, kept and past-not-yet-kept, and archivedYears is unchanged', async () => {
		const status = await service.getRolloverStatus(SCHOOL_ID);
		assert.ok(Array.isArray(status.schoolYears), 'getRolloverStatus did not carry schoolYears');
		const byState = new Map(status.schoolYears!.map((y) => [y.enrollProSchoolYearId, y.state]));
		assert.equal(byState.get(ACTIVE_YEAR_ID), 'current', `the active year must be classified current: ${JSON.stringify(status.schoolYears)}`);
		assert.equal(byState.get(UNTOUCHED_YEAR_ID), 'past, not yet kept', `a not-yet-kept year must be listed: ${JSON.stringify(status.schoolYears)}`);
		assert.equal(byState.get(KEEPABLE_YEAR_2_ID), 'kept as history', `an archived year must be listed as kept: ${JSON.stringify(status.schoolYears)}`);
		assert.equal(
			status.schoolYears!.some((y) => y.enrollProSchoolYearId === OTHER_SCHOOL_YEAR_ID),
			false,
			"another school's year leaked into the list",
		);
		// R4 is EXPLICIT that archivedYears stays byte-identical for its two
		// existing consumers. Stated as the invariant rather than a literal list,
		// because the idempotence subtest above really does archive a year, and a
		// hard-coded array would make the assertion depend on subtest ORDER
		// instead of on the contract.
		const expectedArchived = ROWS
			.filter((r) => r.schoolId === SCHOOL_ID && r.isArchived)
			.map((r) => r.enrollProSchoolYearId)
			.sort((a, b) => b - a);
		assert.deepEqual(
			(status.archivedYears ?? []).map((y) => y.enrollProSchoolYearId).sort((a, b) => b - a),
			expectedArchived,
			'archivedYears is not exactly the archived mirrors; RolloverResetPanel and CarryForwardReviewPanel consume it unchanged',
		);
		assert.equal(
			(status.archivedYears ?? []).some((y) => y.enrollProSchoolYearId === OTHER_SCHOOL_YEAR_ID),
			false,
			"another school's year leaked into archivedYears",
		);
		assert.equal(
			(status.archivedYears ?? []).some((y) => y.enrollProSchoolYearId === ACTIVE_YEAR_ID),
			false,
			'the active year must never be reported as archived history',
		);
	});

	await t.test('R4: previewRolloverSync carries schoolYears with counts requested', async () => {
		const preview = await service.previewRolloverSync(SCHOOL_ID);
		assert.ok(Array.isArray(preview.schoolYears), 'previewRolloverSync did not carry schoolYears');
		for (const year of preview.schoolYears!) {
			assert.ok(year.preservedCounts, `includeCounts must populate preservedCounts for ${year.yearLabel}`);
		}
	});

	await t.test('R4: the EnrollPro-unreachable status site also carries schoolYears', async () => {
		// Drive the SECOND return site of getRolloverStatus (the `!health.reachable`
		// branch) by pointing ENROLLPRO_API at a closed port for one call.
		const saved = process.env.ENROLLPRO_API;
		process.env.ENROLLPRO_API = 'http://127.0.0.1:1';
		try {
			const status = await service.getRolloverStatus(SCHOOL_ID);
			assert.equal(status.enrollProActiveYear, null, 'the unreachable branch was not taken, so this row is vacuous');
			assert.ok(Array.isArray(status.schoolYears), 'the EnrollPro-unreachable status site did not carry schoolYears');
			assert.equal(
				status.schoolYears!.some((y) => y.enrollProSchoolYearId === ACTIVE_YEAR_ID),
				true,
				'the ATLAS-active year must still be listed when EnrollPro is unreachable',
			);
		} finally {
			process.env.ENROLLPRO_API = saved;
		}
	});
});
