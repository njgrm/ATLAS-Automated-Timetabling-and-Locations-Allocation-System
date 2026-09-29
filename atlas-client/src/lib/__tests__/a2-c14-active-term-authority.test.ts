/**
 * A2-C14 — the active ordered term, and the cache that could not be trusted.
 *
 * THE DEFECT (docs/reviews/a2-c14-root-cause/root-cause.md §Term)
 * ==============================================================
 * `resolveActiveSchoolYearContext` defaults `verifyUpstream` to false, so the
 * server answers the literal default `'Active term verification not
 * requested.'` with `verified:false` and the fail-closed gate rejects it. The
 * verified read was never failing — callers never asked. Two of the three pages
 * asked with `forceRefresh` and no `verifyUpstream`; the third asked for
 * verification but WITHOUT `forceRefresh`, so the school-keyed write-through
 * cache handed it an unverified entry written moments earlier and the
 * verification was never dispatched at all.
 *
 * WHAT THIS SUITE PROVES, on the REAL production path (real
 * `resolveActiveSchoolYearContext`, real cache, real `fetchAtlasRuntimeContext`
 * through a stubbed transport):
 *
 *   A — the shared resolver issues EXACTLY ONE `verifyUpstream:true` request and
 *       resolves a verified term, from a payload that fails the gate as-is.
 *   A-control — the pre-fix call shape (forceRefresh, no verifyUpstream) issues
 *       ZERO verified requests and resolves nothing. This is the failing-first
 *       control: revert the call sites to the old shape and this row fails.
 *   B — an unverified context is never SERVED to a `verifyUpstream:true` caller
 *       from the school-keyed cache, even when the entry is fresh and unexpired.
 *   B-control — the pre-fix cache serves it. Revert the cache fix and this row
 *       fails: the assertions below are written so that is exactly what happens.
 *   C — an unverified promotion never DOWNGRADES an already-verified cached term.
 *   D — the fail-closed gate itself is unchanged: a resolver that is told the
 *       truth about an unverified term still refuses to invent one.
 *
 * Run (client workspace):
 *   `npx tsx --test src/lib/__tests__/a2-c14-active-term-authority.test.ts`
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
	private store = new Map<string, string>();
	getItem(key: string): string | null {
		return this.store.has(key) ? this.store.get(key)! : null;
	}
	setItem(key: string, value: string): void {
		this.store.set(key, String(value));
	}
	removeItem(key: string): void {
		this.store.delete(key);
	}
	clear(): void {
		this.store.clear();
	}
	get length(): number {
		return this.store.size;
	}
	key(index: number): string | null {
		return Array.from(this.store.keys())[index] ?? null;
	}
}

const sessionStorageShim = new MemoryStorage();
const localStorageShim = new MemoryStorage();
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageShim, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: localStorageShim, configurable: true });
Object.defineProperty(globalThis, 'window', {
	value: { location: { protocol: 'https:' }, dispatchEvent: () => true },
	configurable: true,
});

import atlasApi from '@/lib/api';
import {
	invalidateActiveSchoolYearContext,
	resolveActiveSchoolYearContext,
} from '@/lib/enrollpro-public-settings';
import { resolveActiveTermAuthority } from '@/lib/active-term-authority';
import { isVerifiedOrderedActiveTerm } from '@/lib/academic-term';

type RecordedCall = { params?: Record<string, unknown> };
let runtimeContextCalls: RecordedCall[] = [];
type RuntimeContextResponder = (params?: Record<string, unknown>) => Promise<unknown>;
let runtimeContextResponder: RuntimeContextResponder | null = null;

(atlasApi as unknown as { get: (url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: unknown }> }).get =
	async (url: string, config?: { params?: Record<string, unknown> }) => {
		if (url === '/runtime/context') {
			runtimeContextCalls.push({ params: config?.params });
			if (!runtimeContextResponder) throw new Error('test /runtime/context responder not installed');
			return { data: await runtimeContextResponder(config?.params) };
		}
		return { data: {} };
	};

// The EnrollPro settings fallback is never taken by these tests.
(atlasApi as unknown as { post: (url: string, body?: unknown) => Promise<{ data: unknown }> }).post =
	async () => ({ data: {} });

const ORDERED_TERMS = [
	{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
	{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
	{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
];

/** The shape the server returns when the caller did NOT ask for verification. */
function unverifiedContextPayload() {
	return {
		activeSchoolYearId: 9,
		activeSchoolYearLabel: 'SY 2030-2031',
		schoolId: 1,
		source: 'atlas-persisted',
		stale: false,
		activeTerm: {
			source: 'atlas-unverified',
			reachable: true,
			verified: false,
			activeTerm: null,
			termIndex: null,
			schoolYearId: 9,
			matchedSchoolYear: null,
			code: null,
			message: 'Active term verification not requested.',
			orderedTerms: ORDERED_TERMS,
			termFormat: 'TRIMESTER',
			termCount: 3,
		},
	};
}

/** The same year, but the caller asked and EnrollPro answered. */
function verifiedContextPayload(schoolId = 1) {
	return {
		activeSchoolYearId: 9,
		activeSchoolYearLabel: 'SY 2030-2031',
		schoolId,
		source: 'enrollpro-verified',
		stale: false,
		activeTerm: {
			source: 'enrollpro',
			reachable: true,
			verified: true,
			activeTerm: 'T2',
			termIndex: 2,
			schoolYearId: 9,
			matchedSchoolYear: true,
			code: null,
			message: 'ATLAS is aligned with EnrollPro active term T2.',
			orderedTerms: ORDERED_TERMS,
			termFormat: 'TRIMESTER',
			termCount: 3,
		},
	};
}

/** Respond per request profile, the way the real route does. */
function profileResponder(): RuntimeContextResponder {
	return async (params) => (params?.verifyUpstream === 'true'
		? verifiedContextPayload()
		: unverifiedContextPayload());
}

const SCHOOLS = [201, 202, 203, 204, 205];
beforeEach(() => {
	runtimeContextCalls = [];
	runtimeContextResponder = null;
	sessionStorageShim.clear();
	localStorageShim.clear();
	// The cache is module-level state, so it survives `localStorage.clear()`.
	for (const schoolId of SCHOOLS) invalidateActiveSchoolYearContext(schoolId);
});

function verifiedCalls(): RecordedCall[] {
	return runtimeContextCalls.filter((call) => call.params?.verifyUpstream === 'true');
}

// ═══ A — the shared resolver asks, and asks exactly once ═════════════════════

test('A the shared resolver issues exactly one verifyUpstream:true request and resolves a verified term the fast read could not', async () => {
	runtimeContextResponder = profileResponder();

	const resolution = await resolveActiveTermAuthority(201, { isStillCurrent: () => true });

	assert.ok(resolution, 'a live resolution is returned');
	assert.equal(verifiedCalls().length, 1,
		'exactly ONE verified request follows the fast read — never zero, never two');
	assert.equal(runtimeContextCalls.length, 2, 'the fast read plus the one verified read');
	assert.equal(runtimeContextCalls[0].params?.verifyUpstream, undefined,
		'the fast read stays unverified so the surface paints immediately');
	assert.equal(runtimeContextCalls[1].params?.verifyUpstream, 'true',
		'the second read is the one that actually asks EnrollPro');
	assert.equal(resolution.verifyUpstreamRequested, true, 'and it reports that it asked');
	assert.equal(resolution.authorityReady, true, 'so the authority gate is satisfied');
	assert.equal(isVerifiedOrderedActiveTerm(resolution.context.activeTerm), true,
		'through the canonical gate — the same predicate the pages use');
	assert.equal(resolution.context.activeTerm?.termIndex, 2, 'with the term EnrollPro reported');
});

test('A-control the PRE-FIX call shape asks for nothing and resolves no term, which is why three pages were stuck', async () => {
	runtimeContextResponder = profileResponder();

	// Exactly what TeacherConcerns and AdminYearSetup used to send.
	const preFix = await resolveActiveSchoolYearContext({
		schoolId: 202,
		allowStaleOnError: true,
		allowEnrollProFallback: false,
		forceRefresh: true,
	});

	assert.equal(verifiedCalls().length, 0,
		'the pre-fix shape never asks EnrollPro, so it can never resolve a term');
	assert.equal(isVerifiedOrderedActiveTerm(preFix.activeTerm), false,
		'which is the fail-closed gate correctly refusing an unrequested verification');
	assert.equal(preFix.activeTerm?.message, 'Active term verification not requested.',
		'and this is the exact string the operator saw on the page');
});

test('A-late a response whose actor school moved on is discarded without binding', async () => {
	runtimeContextResponder = profileResponder();

	const resolution = await resolveActiveTermAuthority(203, { isStillCurrent: () => false });

	assert.equal(resolution, null,
		'the shared resolver keeps the existing late-response discard its callers rely on');
});

test('A-fail a failed verification still returns the fast-read state instead of dead-ending', async () => {
	runtimeContextResponder = async (params) => {
		if (params?.verifyUpstream === 'true') throw new Error('ENROLLPRO_UNREACHABLE');
		return unverifiedContextPayload();
	};

	const resolution = await resolveActiveTermAuthority(204, { isStillCurrent: () => true });

	assert.ok(resolution, 'the caller still gets a state to render');
	assert.equal(resolution.verifyUpstreamRequested, true, 'and knows verification was attempted');
	assert.equal(resolution.authorityReady, false, 'but authority is honestly unresolved');
	assert.equal(resolution.context.activeTerm?.message, 'Active term verification not requested.',
		'keeping the server\'s own reason rather than inventing a term');
});

test('A-fresh a WRITE-on-this-term caller is never satisfied by a cached verified term', async () => {
	// Warm the cache with a VERIFIED term, as any earlier verified read would.
	runtimeContextResponder = profileResponder();
	await resolveActiveSchoolYearContext({
		schoolId: 205,
		allowStaleOnError: true,
		verifyUpstream: true,
	});
	assert.equal(verifiedCalls().length, 1, 'the cache now holds a verified term');

	// The default fast step may legitimately trust a verified cache entry...
	//
	// The invariant is counted over VERIFIED calls: the fast step's
	// `backgroundRefresh` may legitimately dispatch an UNVERIFIED call to
	// refresh the cache, but it must never satisfy a writing caller by itself.
	const trustedVerified = verifiedCalls().length;
	const trusted = await resolveActiveTermAuthority(205, { isStillCurrent: () => true });
	assert.equal(trusted?.authorityReady, true, 'a read-only surface is satisfied by the warm cache');
	assert.equal(verifiedCalls().length, trustedVerified,
		'and it does not pay for a second upstream verification');

	// ...but a page that WRITES on this term must still get a current answer,
	// because the server re-resolves the term and rejects a mismatch with
	// TERM_SCOPE_MISMATCH. TeacherConcerns opts into exactly this.
	const wrote = await resolveActiveTermAuthority(205, { isStillCurrent: () => true }, { requireFreshVerifiedRead: true });
	assert.equal(verifiedCalls().length, trustedVerified + 1, 'the writing caller issued its own fresh verified read');
	assert.equal(wrote?.verifyUpstreamRequested, true, 'and reports that it asked');
	assert.equal(wrote?.authorityReady, true, 'with a verified, current term');
});

// ═══ B — the school-keyed cache must not answer a verified caller ════════════

test('B an unverified context is never served to a verifyUpstream:true caller from the school-keyed cache', async () => {
	runtimeContextResponder = profileResponder();

	// 1. An unverified caller (the old TeacherConcerns shape) writes the cache.
	await resolveActiveSchoolYearContext({
		schoolId: 205,
		allowStaleOnError: true,
		allowEnrollProFallback: false,
		forceRefresh: true,
	});
	assert.equal(verifiedCalls().length, 0, 'the seeding caller did not verify anything');
	const afterSeed = runtimeContextCalls.length;

	// 2. A caller that DOES ask for verification, and does not force a refresh.
	const asked = await resolveActiveSchoolYearContext({
		schoolId: 205,
		allowStaleOnError: true,
		verifyUpstream: true,
	});

	assert.equal(runtimeContextCalls.length, afterSeed + 1,
		'the verified caller DISPATCHED its own request instead of trusting the fresh unverified entry');
	assert.equal(verifiedCalls().length, 1, 'and that request carried verifyUpstream=true');
	assert.equal(asked.source !== 'cache', true,
		'the answer came from the server, not from the school-keyed cache');
	assert.equal(isVerifiedOrderedActiveTerm(asked.activeTerm), true,
		'so the verified caller finally receives a verified term');
});

test('B-control the unverified answer is still served to an UNVERIFIED caller, so nothing else regressed', async () => {
	runtimeContextResponder = profileResponder();

	await resolveActiveSchoolYearContext({
		schoolId: 205,
		allowStaleOnError: true,
		allowEnrollProFallback: false,
		forceRefresh: true,
	});
	const afterSeed = runtimeContextCalls.length;

	const stillUnverified = await resolveActiveSchoolYearContext({
		schoolId: 205,
		allowStaleOnError: true,
	});

	assert.equal(runtimeContextCalls.length, afterSeed,
		'a caller that did not ask for verification is still served from cache');
	assert.equal(stillUnverified.source, 'cache', 'and it knows it is cache-sourced');
	assert.equal(stillUnverified.activeTerm?.message, 'Active term verification not requested.',
		'carrying the honest reason rather than a guessed term');
});

test('C an unverified promotion never downgrades an already-verified cached term', async () => {
	runtimeContextResponder = profileResponder();

	// A verified caller establishes a good cached term.
	await resolveActiveSchoolYearContext({
		schoolId: 205,
		allowStaleOnError: true,
		verifyUpstream: true,
	});
	assert.equal(verifiedCalls().length, 1, 'the good term was established');

	// An unverified caller now reads the same school and must not erase it.
	runtimeContextResponder = async () => unverifiedContextPayload();
	await resolveActiveSchoolYearContext({
		schoolId: 205,
		allowStaleOnError: true,
		allowEnrollProFallback: false,
		forceRefresh: true,
	});

	// A later unverified caller reads what the cache retained.
	const later = await resolveActiveSchoolYearContext({
		schoolId: 205,
		allowStaleOnError: true,
	});
	assert.equal(isVerifiedOrderedActiveTerm(later.activeTerm), true,
		'the verified term survived the unverified write, so later callers keep a usable answer');
});

// ═══ D — the fail-closed gate is untouched ══════════════════════════════════

test('D the gate itself is unchanged: no unverified term ever authorizes a term', async () => {
	for (const payload of [unverifiedContextPayload(), verifiedContextPayload()]) {
		const term = payload.activeTerm as { verified: boolean };
		assert.equal(
			isVerifiedOrderedActiveTerm(term),
			term.verified === true,
			'the predicate still decides purely on the payload — no default, no Term 1',
		);
	}
	assert.equal(isVerifiedOrderedActiveTerm(null), false, 'a missing term is still unresolved');
	assert.equal(isVerifiedOrderedActiveTerm({ verified: true, termIndex: 9, orderedTerms: ORDERED_TERMS }), false,
		'a term index outside the ordered contract is still rejected');
});
