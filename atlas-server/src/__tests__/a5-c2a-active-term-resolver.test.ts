/**
 * A5-C2A — the canonical active-term resolver.
 *
 * WHAT THIS SERVES: proof that the ONE resolver every consumer reads
 * (the client runtime context, the availability authority, generation
 * preflight) degrades a reachable, truthful EnrollPro
 * `ACTIVE_TERM_UNRESOLVED` into LABELLED saved data, and that every
 * fail-closed invariant survives that change.
 *
 * The recorded defect: ATLAS hard-failed ("Active ordered term unresolved",
 * writes disabled) on a reachable typed 409 while the app shell displayed the
 * saved term for the same school year — two sources of truth for one fact.
 *
 * LOAD-BEARING CASES, each paired with a mutant that must fail:
 *  1. live resolved  → live term, NOT degraded            (mutant: fall back to saved anyway)
 *  2. live reachable unresolved + revision MATCH  → saved term, degraded, cachedAt
 *                                                     (mutant: return null — the old policy)
 *  3. live reachable unresolved + revision MISMATCH → null (mutant: use it anyway)
 *  4. live reachable unresolved + NO snapshot       → null, never Term 1
 *  5. live contract-invalid (reachable)            → null, no saved fallback
 *  6. live unreachable + snapshot                  → saved term, degraded, cachedAt
 *  7. live unreachable + no snapshot               → null, never Term 1
 *
 * Run: `npm --prefix atlas-server run test:a5-c2a-term-truth`
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
	CACHED_TERM_MAX_AGE_MS,
	resolveCanonicalActiveTerm,
	type CanonicalActiveTermProvider,
	type PersistedActiveTermSnapshot,
} from '../services/active-term-resolver.service.js';
import type { TermContractFetchResult } from '../services/enrollpro-term-contract.service.js';
import { resolveActiveOrderedTermIndexLive, type ActiveOrderedTermProvider } from '../services/academic-term.service.js';

const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;
const LIVE_REVISION = 'live-semantic-revision';
const SAVED_REVISION = 'live-semantic-revision'; // same by default; mutated per case
/** Host clock sits BEFORE the active school year: no term contains today. */
const NOW = new Date('2026-09-28T12:00:00');
/** A recent capture: inside the canonical cache TTL. */
const CAPTURED_AT = '2026-09-25T08:00:00.000Z';
/** A capture older than {@link CACHED_TERM_MAX_AGE_MS} (7 days). */
const STALE_CAPTURED_AT = '2026-09-14T08:00:00.000Z';

const TERMS = [
	{ identity: 'T1', displayLabel: 'Term 1', order: 1, startDate: '2031-08-04', endDate: '2031-11-28' },
	{ identity: 'T2', displayLabel: 'Term 2', order: 2, startDate: '2031-12-01', endDate: '2032-03-20' },
	{ identity: 'T3', displayLabel: 'Term 3', order: 3, startDate: '2032-04-06', endDate: '2032-07-03' },
];

function liveContract(options: {
	activeOrder?: number | null;
	availability?: 'RESOLVED' | 'UNRESOLVED' | 'CONTRACT_INVALID' | 'UNAVAILABLE';
	reachable?: boolean;
	revision?: string;
} = {}): TermContractFetchResult {
	const activeOrder = options.activeOrder === undefined ? null : options.activeOrder;
	const availability = options.availability ?? (activeOrder == null ? 'UNRESOLVED' : 'RESOLVED');
	return {
		ok: true,
		contract: {
			schoolId: SCHOOL_ID,
			schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2031-2032' },
			format: 'TRIMESTER',
			terms: TERMS,
			semanticRevision: options.revision ?? LIVE_REVISION,
			activeTerm: activeOrder == null ? null : { identity: `T${activeOrder}`, displayLabel: `Term ${activeOrder}`, order: activeOrder },
			activeTermState: {
				availability,
				code: availability === 'UNRESOLVED' ? 'ACTIVE_TERM_UNRESOLVED' : availability === 'CONTRACT_INVALID' ? 'ACTIVE_TERM_CONFLICT' : null,
				message: 'fixture',
				reachable: options.reachable ?? true,
				identity: activeOrder == null ? null : `T${activeOrder}`,
			},
		},
	};
}

const UNREACHABLE: TermContractFetchResult = { ok: false, error: { code: 'ENROLLPRO_UNREACHABLE', message: 'offline fixture' } };

function snapshot(overrides: Partial<PersistedActiveTermSnapshot> = {}): PersistedActiveTermSnapshot {
	return {
		terms: TERMS.map((t) => ({ identity: t.identity, order: t.order, startDate: t.startDate, endDate: t.endDate })),
		snapshotOrder: 2,
		cachedAt: CAPTURED_AT,
		semanticRevision: SAVED_REVISION,
		...overrides,
	};
}

function resolve(
	live: TermContractFetchResult,
	saved: PersistedActiveTermSnapshot | null,
) {
	const provider: CanonicalActiveTermProvider = async () => live;
	return resolveCanonicalActiveTerm(
		{ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID },
		{ provider, now: NOW, loadSnapshot: async () => saved },
	);
}

// ─── 1. Live resolved wins, and is never labelled as saved ───

test('A5-C2A 1: a live resolved active term is used and is not degraded', async () => {
	const result = await resolve(liveContract({ activeOrder: 2 }), snapshot());
	assert.equal(result.termIndex, 2, 'the live term is used');
	assert.equal(result.termIdentity, 'T2');
	assert.equal(result.source, 'enrollpro-verified');
	assert.equal(result.degraded, false, 'a live answer is never labelled as saved data');
	assert.equal(result.cachedAt, null);
});

test('A5-C2A 1-mutant: the saved snapshot must NOT override a live resolved term', async () => {
	// The saved snapshot names T1; the live authority names T3. Live must win.
	const result = await resolve(liveContract({ activeOrder: 3 }), snapshot({ snapshotOrder: 1 }));
	assert.equal(result.termIndex, 3, 'live beats saved');
	assert.notEqual(result.termIndex, 1);
});

// ─── 2. The recorded defect: reachable unresolved degrades to LABELLED saved data ───

test('A5-C2A 2: a reachable ACTIVE_TERM_UNRESOLVED degrades to the revision-matched saved term', async () => {
	const result = await resolve(liveContract({ activeOrder: null, availability: 'UNRESOLVED' }), snapshot());
	assert.equal(result.termIndex, 2, 'the saved term resolves instead of dead-ending');
	assert.equal(result.termIdentity, 'T2');
	assert.equal(result.source, 'atlas-cache-verified');
	assert.equal(result.degraded, true, 'saved data is explicitly labelled degraded');
	assert.equal(result.cachedAt, CAPTURED_AT, 'the REAL capture time is carried to the client');
	assert.equal(result.semanticRevisionMatched, true, 'the cached term was re-verified against the live revision');
	assert.equal(result.cachedBeyondTtl, false);
	assert.match(result.message, /saved ordered term T2/, 'the message names the saved term');
	assert.match(result.message, /re-verified against the live EnrollPro term structure/);
});

test('A5-C2A 2-mutant: the OLD policy (return null on a reachable unresolved) is the defect this removes', async () => {
	// This is the base behaviour: authoritative null, termIndex null, so the page
	// showed "Active ordered term unresolved" and disabled every write.
	const oldPolicyTermIndex = null;
	const newPolicy = await resolve(liveContract({ activeOrder: null, availability: 'UNRESOLVED' }), snapshot());
	assert.equal(newPolicy.termIndex, 2, 'the new policy resolves the term');
	assert.notEqual(newPolicy.termIndex, oldPolicyTermIndex, 'the new policy is NOT the old null policy');
});

test('A5-C2A 2-ttl: a saved answer older than the TTL is still usable but says so', async () => {
	const result = await resolve(
		liveContract({ activeOrder: null, availability: 'UNRESOLVED' }),
		snapshot({ cachedAt: STALE_CAPTURED_AT }),
	);
	assert.equal(result.termIndex, 2, 'an old but revision-matched snapshot does not dead-end the page');
	assert.equal(result.cachedBeyondTtl, true, 'and it is reported as beyond the TTL so the client can say so');
	assert.equal(result.cachedAt, STALE_CAPTURED_AT);
});

// ─── 3. INVARIANT 2: a cached term must be re-verified against the LIVE semantic revision ───

test('A5-C2A 3: a revision MISMATCH fails closed with TERM_AUTHORITY_STALE', async () => {
	const result = await resolve(
		liveContract({ activeOrder: null, availability: 'UNRESOLVED' }),
		snapshot({ semanticRevision: 'a-different-revision' }),
	);
	assert.equal(result.termIndex, null, 'a stale saved structure must NOT be treated as current');
	assert.equal(result.code, 'TERM_AUTHORITY_STALE');
	assert.equal(result.degraded, false);
});

test('A5-C2A 3-mutant: the revision comparison is load-bearing', async () => {
	const matched = await resolve(liveContract({ activeOrder: null, availability: 'UNRESOLVED' }), snapshot());
	const mismatched = await resolve(liveContract({ activeOrder: null, availability: 'UNRESOLVED' }), snapshot({ semanticRevision: 'other' }));
	assert.equal(matched.termIndex, 2);
	assert.equal(mismatched.termIndex, null, 'dropping the comparison would return 2 here and silently serve stale terms');
});

// ─── 4/5/7. INVARIANT 1: a missing term identity NEVER becomes Term 1 ───

test('A5-C2A 4: a reachable unresolved with NO saved snapshot fails closed (never Term 1)', async () => {
	const result = await resolve(liveContract({ activeOrder: null, availability: 'UNRESOLVED' }), null);
	assert.equal(result.termIndex, null);
	assert.notEqual(result.termIndex, 1, 'never defaults to Term 1');
	assert.equal(result.source, 'enrollpro-unresolved');
	assert.equal(result.code, 'ACTIVE_TERM_UNRESOLVED');
});

test('A5-C2A 5: a reachable CONTRACT_INVALID stays fail-closed and is NOT papered over with saved data', async () => {
	const result = await resolve(liveContract({ activeOrder: null, availability: 'CONTRACT_INVALID' }), snapshot());
	assert.equal(result.termIndex, null, 'a contradictory live identity is never masked by saved data');
	assert.equal(result.source, 'enrollpro-contract-drift');
	assert.equal(result.degraded, false);
});

test('A5-C2A 7: unreachable with no snapshot fails closed (never Term 1)', async () => {
	const result = await resolve(UNREACHABLE, null);
	assert.equal(result.termIndex, null);
	assert.notEqual(result.termIndex, 1);
	assert.equal(result.source, 'enrollpro-unreachable');
});

test('A5-C2A 7b: a snapshot whose terms name no active term at all still fails closed', async () => {
	// No snapshot order and no date-derived entry: `derivePersistedActiveTerm`
	// returns null, and so must the resolver. It must not fall back to order 1.
	const result = await resolve(UNREACHABLE, snapshot({ snapshotOrder: null, terms: [] }));
	assert.equal(result.termIndex, null);
	assert.notEqual(result.termIndex, 1);
});

// ─── 6. Pre-existing offline resilience is preserved, now labelled ───

test('A5-C2A 6: an unreachable EnrollPro still resolves the date-derived saved term, now labelled', async () => {
	const result = await resolve(UNREACHABLE, snapshot());
	assert.equal(result.termIndex, 2);
	assert.equal(result.source, 'atlas-cache-offline');
	assert.equal(result.degraded, true);
	assert.equal(result.cachedAt, CAPTURED_AT);
	assert.equal(result.semanticRevisionMatched, null, 'no live structure existed to compare against');
});

// ─── One resolver, one answer: the availability authority agrees with the runtime context ───

test('A5-C2A 10: the availability authority and the runtime context resolve the SAME term', async () => {
	// The availability WRITE path re-resolves the term live and rejects a
	// mismatched termIndex with TERM_SCOPE_MISMATCH. If the two resolvers
	// disagreed, the page would show a term the write path refuses — the exact
	// "read and write disagree" defect. Both now go through one policy.
	const client: any = {
		enrollProSchoolYearMirror: {
			findUnique: async () => ({
				isActive: true,
				isArchived: false,
				termContractCachedAt: new Date(CAPTURED_AT),
				termContractCache: {
					schoolId: SCHOOL_ID,
					schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2031-2032' },
					format: 'TRIMESTER',
					terms: TERMS,
					semanticRevision: SAVED_REVISION,
					activeTerm: { identity: 'T2', displayLabel: 'Term 2', order: 2 },
					activeTermState: { availability: 'UNRESOLVED', code: 'ACTIVE_TERM_UNRESOLVED', message: 'fixture', reachable: true, identity: null },
				},
			}),
		},
	};
	const provider: ActiveOrderedTermProvider = async () => liveContract({ activeOrder: null, availability: 'UNRESOLVED' });

	const authorityTermIndex = await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider, now: NOW, client });
	const contextTermIndex = (await resolve(liveContract({ activeOrder: null, availability: 'UNRESOLVED' }), snapshot())).termIndex;

	assert.equal(authorityTermIndex, 2, 'the availability write path resolves T2');
	assert.equal(contextTermIndex, 2, 'the client runtime context resolves T2');
	assert.equal(authorityTermIndex, contextTermIndex, 'one source of truth: read and write cannot disagree');
});
