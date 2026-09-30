/**
 * A3 TERM-FALLBACK — persist the last EnrollPro-VERIFIED active term and prefer
 * it over a date-derived guess when EnrollPro is unreachable.
 *
 * Recorded defect (live, 2026-09-30): when EnrollPro was unreachable the app
 * flipped to Term 2, because the offline fallback derived the term from the
 * persisted snapshot's DATE RANGES (today 2026-09-30 falls inside T2) while the
 * last EnrollPro-verified active term was T1. The verified active term was never
 * persisted — the ordered snapshot is frozen by `semanticRevision`, which
 * deliberately excludes active-term resolution.
 *
 * LOAD-BEARING CASES:
 *  1. unreachable + a persisted `verifiedActiveTerm` (T1) while the dates put
 *     today in T2 → the resolver returns the VERIFIED T1, degraded, labelled
 *     with the verification time.               (base/failing-first: returns T2)
 *  2. unreachable + NO persisted verified term → the pre-existing date-derived
 *     T2 is preserved unchanged.
 *  3. `persistVerifiedActiveTerm` writes the new key with an atomic `jsonb_set`
 *     (never a whole-cache overwrite) and is idempotent for an unchanged term.
 *  4. the runtime-context read persists the verified active term; an instrumented
 *     client records exactly one write, and a repeat read of the same term
 *     writes nothing.
 *  5. the availability read path stays zero-write (preservation).
 *
 * Run: `npm run test:a3-term-fallback`
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import {
	persistVerifiedActiveTerm,
	resolveCanonicalActiveTerm,
	type CanonicalActiveTermProvider,
	type PersistedActiveTermSnapshot,
	type VerifiedActiveTerm,
} from '../services/active-term-resolver.service.js';
import type { TermContractFetchResult } from '../services/enrollpro-term-contract.service.js';
import { resolveActiveOrderedTermIndexLive, type ActiveOrderedTermProvider } from '../services/academic-term.service.js';
import { resolveRuntimeActiveTerm } from '../services/runtime-context.service.js';
import { withDataContext } from '../lib/data-context.js';

const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;
/** 2026-09-30 sits inside T2 (2026-09-16..2026-12-18). */
const NOW = new Date('2026-09-30T12:00:00');
const VERIFIED_AT = '2026-09-30T05:27:00.000Z';
const SNAPSHOT_CAPTURED_AT = '2026-09-29T16:05:37.197Z';

const TERMS = [
	{ identity: 'T1', displayLabel: 'Term 1', order: 1, startDate: '2026-06-08', endDate: '2026-09-15' },
	{ identity: 'T2', displayLabel: 'Term 2', order: 2, startDate: '2026-09-16', endDate: '2026-12-18' },
	{ identity: 'T3', displayLabel: 'Term 3', order: 3, startDate: '2027-01-04', endDate: '2027-04-08' },
];

const UNREACHABLE: TermContractFetchResult = {
	ok: false,
	error: { code: 'ENROLLPRO_UNREACHABLE', message: 'offline fixture' },
};

function snapshot(overrides: Partial<PersistedActiveTermSnapshot> = {}): PersistedActiveTermSnapshot {
	return {
		terms: TERMS.map((term) => ({ identity: term.identity, order: term.order, startDate: term.startDate, endDate: term.endDate })),
		snapshotOrder: null,
		cachedAt: SNAPSHOT_CAPTURED_AT,
		semanticRevision: 'revision-1',
		...overrides,
	};
}

function resolveUnreachable(saved: PersistedActiveTermSnapshot | null) {
	const provider: CanonicalActiveTermProvider = async () => UNREACHABLE;
	return resolveCanonicalActiveTerm(
		{ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID },
		{ provider, now: NOW, loadSnapshot: async () => saved },
	);
}

type RecordedWrite = { query: string; values: unknown[] };

function recordingClient(): { client: { $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number> }; calls: RecordedWrite[] } {
	const calls: RecordedWrite[] = [];
	return {
		calls,
		client: {
			$executeRawUnsafe: async (query: string, ...values: unknown[]) => {
				calls.push({ query, values });
				return 1;
			},
		},
	};
}

function termPayload() {
	return {
		data: {
			id: SCHOOL_YEAR_ID,
			yearLabel: '2026-2027',
			termFormat: 'TRIMESTER',
			terms: TERMS.map((term) => ({
				identity: term.identity,
				displayLabel: term.displayLabel,
				startDate: term.startDate,
				endDate: term.endDate,
			})),
		},
	};
}

async function withEnrollProFixture(run: (baseUrl: string) => Promise<void>): Promise<void> {
	const server = createServer((req, res) => {
		const path = req.url?.split('?')[0] ?? '';
		res.setHeader('content-type', 'application/json');
		if (path === '/integration/v1/school-year') {
			res.statusCode = 200;
			res.end(JSON.stringify(termPayload()));
			return;
		}
		if (path === '/integration/v1/active-term') {
			res.statusCode = 200;
			res.end(JSON.stringify({ data: { schoolYearId: SCHOOL_YEAR_ID, activeTerm: 'T1' } }));
			return;
		}
		res.statusCode = 404;
		res.end(JSON.stringify({ error: 'not found' }));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object', 'the fixture server is listening');
	try {
		await run(`http://127.0.0.1:${address.port}`);
	} finally {
		await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	}
}

// ─── Row 1: the failing-first defect ───

test('A3 row 1: unreachable EnrollPro prefers the persisted VERIFIED active term T1 over the date-derived T2', async () => {
	const result = await resolveUnreachable(snapshot({ verifiedActiveTerm: { order: 1, identity: 'T1', verifiedAt: VERIFIED_AT } }));

	assert.equal(result.termIndex, 1, 'the last verified active term wins over the date-derived term (base returned T2)');
	assert.equal(result.termIdentity, 'T1');
	assert.equal(result.source, 'atlas-cache-offline');
	assert.equal(result.degraded, true, 'saved data is labelled degraded, never presented as a verified term change');
	assert.equal(result.cachedAt, VERIFIED_AT, 'the verification time is carried so the client note shows a real time');
	assert.equal(result.cachedBeyondTtl, false, 'a fresh verification is not reported as stale');
});

// ─── Row 2: preservation of the date-derived fallback ───

test('A3 row 2: with no persisted verified term the pre-existing date-derived T2 is preserved', async () => {
	const result = await resolveUnreachable(snapshot());

	assert.equal(result.termIndex, 2, 'the date-derived fallback is unchanged when nothing was verified');
	assert.equal(result.termIdentity, 'T2');
	assert.equal(result.source, 'atlas-cache-offline');
	assert.equal(result.degraded, true);
	assert.equal(result.cachedAt, SNAPSHOT_CAPTURED_AT);
});

test('A3 row 2-guard: a persisted verified term outside the snapshot structure is discarded', async () => {
	// A foreign term identity must never be served, even if present in the cache.
	const result = await resolveUnreachable(snapshot({ verifiedActiveTerm: { order: 9, identity: 'T9', verifiedAt: VERIFIED_AT } }));
	assert.equal(result.termIndex, 2, 'an out-of-structure verified term falls back to the date-derived term');
	assert.notEqual(result.termIndex, 9);
});

// ─── Row 3: the atomic, idempotent writer ───

test('A3 row 3: persistVerifiedActiveTerm writes via jsonb_set and is idempotent for an unchanged term', async () => {
	const { client, calls } = recordingClient();

	const changed = await persistVerifiedActiveTerm({
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		term: { order: 1, identity: 'T1', verifiedAt: VERIFIED_AT },
		currentCache: { verifiedActiveTerm: { order: 2, identity: 'T2', verifiedAt: '2026-09-16T00:00:00.000Z' } },
		client,
	});
	assert.equal(changed, true, 'a changed verified term is written');
	assert.equal(calls.length, 1, 'exactly one atomic write');
	assert.match(calls[0].query, /jsonb_set/, 'the write uses jsonb_set (never a whole-cache overwrite)');
	assert.match(calls[0].query, /verifiedActiveTerm/, 'the write targets the verifiedActiveTerm key');
	assert.match(calls[0].query, /IS DISTINCT FROM/, 'the SQL carries the identity guard');
	assert.equal(calls[0].values[1], SCHOOL_ID);
	assert.equal(calls[0].values[2], SCHOOL_YEAR_ID);
	assert.equal(calls[0].values[3], 'T1');
	assert.deepEqual(JSON.parse(calls[0].values[0] as string), { order: 1, identity: 'T1', verifiedAt: VERIFIED_AT });

	// Idempotence: the SAME verified term identity already persisted writes nothing.
	const unchanged = await persistVerifiedActiveTerm({
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		term: { order: 1, identity: 'T1', verifiedAt: '2026-09-30T09:00:00.000Z' },
		currentCache: { verifiedActiveTerm: { order: 1, identity: 'T1', verifiedAt: VERIFIED_AT } },
		client,
	});
	assert.equal(unchanged, false, 'an unchanged verified term writes nothing');
	assert.equal(calls.length, 1, 'no second write was dispatched');

	// A malformed term is never written.
	const malformed = await persistVerifiedActiveTerm({
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		term: { order: 0, identity: '', verifiedAt: '' },
		client,
	});
	assert.equal(malformed, false, 'a malformed term is rejected');
	assert.equal(calls.length, 1, 'a malformed term dispatches no write');
});

// ─── Row 4: the runtime-context read is the writer ───

test('A3 row 4: the runtime-context read persists the verified active term (instrumented client records the write)', async () => {
	const { client, calls } = recordingClient();
	const previousApi = process.env.ENROLLPRO_API;
	const previousToken = process.env.ENROLLPRO_SERVICE_TOKEN;
	try {
		await withEnrollProFixture(async (baseUrl) => {
			process.env.ENROLLPRO_API = baseUrl;
			process.env.ENROLLPRO_SERVICE_TOKEN = 'fixture-token';

			const resolution = await withDataContext(client, () =>
				resolveRuntimeActiveTerm(SCHOOL_ID, SCHOOL_YEAR_ID, 'fixture-token', null));
			assert.equal(resolution?.source, 'enrollpro-verified', 'the live verified active term is resolved');
			assert.equal(resolution?.termIndex, 1);
			assert.equal(calls.length, 1, 'the runtime-context read persisted exactly one verified active term');
			const payload = JSON.parse(calls[0].values[0] as string) as VerifiedActiveTerm;
			assert.equal(payload.order, 1);
			assert.equal(payload.identity, 'T1');
			assert.match(payload.verifiedAt, /^\d{4}-\d{2}-\d{2}T/);
			assert.match(calls[0].query, /jsonb_set/);

			// A repeat read of the SAME verified term (the caller already holds the
			// cache) must not churn the row.
			const repeat = await withDataContext(client, () =>
				resolveRuntimeActiveTerm(SCHOOL_ID, SCHOOL_YEAR_ID, 'fixture-token', {
					verifiedActiveTerm: { order: 1, identity: 'T1', verifiedAt: VERIFIED_AT },
				}));
			assert.equal(repeat?.termIndex, 1);
			assert.equal(calls.length, 1, 'repeating the same verified term dispatches no second write');
		});
	} finally {
		if (previousApi === undefined) delete process.env.ENROLLPRO_API; else process.env.ENROLLPRO_API = previousApi;
		if (previousToken === undefined) delete process.env.ENROLLPRO_SERVICE_TOKEN; else process.env.ENROLLPRO_SERVICE_TOKEN = previousToken;
	}
});

// ─── Row 5: the availability read path stays zero-write ───

test('A3 row 5: the availability read path performs zero writes (preservation)', async () => {
	const writes: string[] = [];
	const client = {
		enrollProSchoolYearMirror: {
			findUnique: async () => ({
				isActive: true,
				isArchived: false,
				termContractCachedAt: new Date(SNAPSHOT_CAPTURED_AT),
				termContractCache: {
					schoolId: SCHOOL_ID,
					schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2026-2027' },
					format: 'TRIMESTER',
					terms: TERMS.map((term) => ({ identity: term.identity, displayLabel: term.displayLabel, order: term.order, startDate: term.startDate, endDate: term.endDate })),
					semanticRevision: 'revision-1',
					verifiedActiveTerm: { order: 1, identity: 'T1', verifiedAt: VERIFIED_AT },
				},
			}),
		},
		$executeRawUnsafe: async () => { writes.push('$executeRawUnsafe'); return 1; },
		$executeRaw: async () => { writes.push('$executeRaw'); return 1; },
		update: async () => { writes.push('update'); return {}; },
		$transaction: async () => { writes.push('$transaction'); return undefined; },
	};
	const offline: ActiveOrderedTermProvider = async () => UNREACHABLE;

	// The availability authority reads the SAME verified term from the snapshot,
	// live-first then the verified offline preference — and writes nothing.
	assert.equal(
		await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: offline, now: NOW, client }),
		1,
		'the availability read resolves the verified active term',
	);
	assert.deepEqual(writes, [], 'the availability read dispatches zero writes');

	const live: ActiveOrderedTermProvider = async () => ({
		ok: true,
		contract: {
			schoolId: SCHOOL_ID,
			schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2026-2027' },
			format: 'TRIMESTER',
			terms: TERMS.map((term) => ({ identity: term.identity, displayLabel: term.displayLabel, order: term.order, startDate: term.startDate, endDate: term.endDate })),
			semanticRevision: 'revision-1',
			activeTerm: { identity: 'T1', displayLabel: 'Term 1', order: 1 },
			activeTermState: { availability: 'RESOLVED', code: null, message: 'fixture', reachable: true, identity: 'T1' },
		},
	});
	assert.equal(
		await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: live, now: NOW, client }),
		1,
	);
	assert.deepEqual(writes, [], 'a live availability read also dispatches zero writes');
});
