/**
 * TIMETABLE-TERM-GATE-C01 — make the term-authority gate satisfiable.
 *
 * `5a0a8788` gated timetable reads on `termAuthorityReadyRef`, which is set
 * only from a verified active term — but the timetable never sent
 * `verifyUpstream`, so `/runtime/context` always answered `atlas-unverified`
 * and the page dead-ended. This suite proves the forward fix on the real
 * production path (REAL `/runtime/context` dispatches through the stubbed
 * transport, and the REAL gate decision the hook executes):
 *
 *  D1 — a fast unverified read is followed by exactly one verifyUpstream:true
 *       call, and the resolved authority is verified.
 *  D2 — a gate blocked while unresolved becomes an authoritative load once
 *       verified authority lands (recovery re-run decision + notice cleared).
 *  D3 — never-verifiable authority still loads with one explicit term scope
 *       (persisted active term, else Term 1) plus the unverified notice.
 *  D4 — the implicit-scope protection still holds: no unresolved state can
 *       authorize an all-term fetch, and a verified-but-unpicked scope still
 *       waits for term selection.
 *
 * Run (client workspace):
 *   `npx tsx --test src/lib/__tests__/timetable-term-gate-c01.test.ts`
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
	buildTermAuthorityUnverifiedNotice,
	isTermAuthorityVerified,
	resolveTimetableFallbackTermIndex,
	resolveTimetableLoadGate,
	resolveTimetableTermAuthority,
	resolveTimetableTermScopeState,
	resolveTermAuthorityNotice,
} from '@/hooks/useTimetableData';
import {
	invalidateActiveSchoolYearContext,
	resolveActiveSchoolYearContext,
} from '@/lib/enrollpro-public-settings';

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

// The transport uses raw axios for the EnrollPro settings fallback. These tests
// always pass `allowEnrollProFallback:false`, so that path is never taken.
(atlasApi as unknown as { post: (url: string, body?: unknown) => Promise<{ data: unknown }> }).post =
	async () => ({ data: {} });

const ORDERED_TERMS = [
	{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
	{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
	{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
];

// The live outage shape: the ordered contract is present but the timetable's
// request omitted verifyUpstream, so the term is unverified.
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

// The live proof shape: the same call with verifyUpstream=true is verified.
function verifiedContextPayload() {
	return {
		activeSchoolYearId: 9,
		activeSchoolYearLabel: 'SY 2030-2031',
		schoolId: 1,
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

beforeEach(() => {
	runtimeContextCalls = [];
	runtimeContextResponder = null;
	sessionStorageShim.clear();
	localStorageShim.clear();
});

// ── D1: one verified call after the fast unverified read ────────────────────

test('D1 after a fast unverified read the timetable requests exactly one verifyUpstream:true call and resolves verified authority', async () => {
	invalidateActiveSchoolYearContext(101);
	runtimeContextResponder = async (params) => (
		params?.verifyUpstream === 'true' ? verifiedContextPayload() : unverifiedContextPayload()
	);

	const resolution = await resolveTimetableTermAuthority(101, () => false);

	assert.ok(resolution, 'resolution must be returned for a current actor school');
	assert.equal(resolution.authorityReady, true, 'authority resolves verified after the D1 call');
	assert.equal(resolution.context.activeTerm?.termIndex, 2, 'verified active term T2 is carried');
	assert.equal(resolution.verifyUpstreamRequested, true, 'the verified call was issued');
	const verifiedCalls = runtimeContextCalls.filter((call) => call.params?.verifyUpstream === 'true');
	assert.equal(verifiedCalls.length, 1, 'exactly one verifyUpstream:true call follows the fast read');
	assert.equal(runtimeContextCalls.length, 2, 'fast read plus the single verified call');
});

test('D1 control — the fast read alone never verifies, so the pre-fix wiring could never satisfy the gate', async () => {
	invalidateActiveSchoolYearContext(102);
	runtimeContextResponder = async (params) => (
		params?.verifyUpstream === 'true' ? verifiedContextPayload() : unverifiedContextPayload()
	);

	// The exact options the pre-fix timetable sent: no verifyUpstream.
	const fast = await resolveActiveSchoolYearContext({
		schoolId: 102,
		preferCache: true,
		backgroundRefresh: true,
		allowStaleOnError: true,
		allowEnrollProFallback: false,
	});

	assert.equal(fast.activeTerm?.verified, false, 'the fast read answers atlas-unverified');
	assert.equal(isTermAuthorityVerified(fast.activeTerm), false, 'the gate predicate stays unsatisfied');
	assert.equal(
		runtimeContextCalls.filter((call) => call.params?.verifyUpstream === 'true').length,
		0,
		'no verified call exists without D1 — the old behaviour dead-ends here',
	);
});

test('D1 a failed verification keeps the fast-read state so the load can fall back to an explicit scope', async () => {
	invalidateActiveSchoolYearContext(103);
	runtimeContextResponder = async (params) => {
		if (params?.verifyUpstream === 'true') throw new Error('ENROLLPRO_UNREACHABLE');
		return unverifiedContextPayload();
	};

	const resolution = await resolveTimetableTermAuthority(103, () => false);

	assert.ok(resolution, 'a failed verification must not reject the bootstrap');
	assert.equal(resolution.authorityReady, false, 'authority stays unresolved');
	assert.equal(resolution.verifyUpstreamRequested, true, 'the verified call was still attempted once');
	assert.equal(resolution.context.activeSchoolYearId, 9, 'the fast-read school year is kept for D3');
});

test('D1 a late actor-school response is discarded without binding', async () => {
	invalidateActiveSchoolYearContext(104);
	runtimeContextResponder = async () => unverifiedContextPayload();

	const resolution = await resolveTimetableTermAuthority(104, () => true);

	assert.equal(resolution, null, 'an obsolete actor school must not resolve');
	assert.equal(
		runtimeContextCalls.filter((call) => call.params?.verifyUpstream === 'true').length,
		0,
		'no verified call follows a discarded fast read',
	);
});

// ── D2: a blocked page self-heals when verified authority lands ─────────────

test('D2 an unresolved-then-verified gate loads the fallback first and the authoritative scope after recovery', () => {
	// While unresolved with no explicit choice, the gate loads Term 1
	// explicitly instead of blocking (the state a dead page used to keep).
	const blocked = resolveTimetableLoadGate({
		authorityReady: false,
		termFilter: 'all',
		userOverrodeTermFilter: false,
		fallbackTermIndex: 1,
	});
	assert.deepEqual(blocked, { kind: 'load', termIndex: 1, fallback: true });

	// When the verified context lands and the workspace selects the active
	// term, the same gate loads the authoritative scope with no fallback.
	const recovered = resolveTimetableLoadGate({
		authorityReady: true,
		termFilter: 2,
		userOverrodeTermFilter: false,
		fallbackTermIndex: 1,
	});
	assert.deepEqual(recovered, { kind: 'load', termIndex: 2, fallback: false });
});

test('D2 the unverified notice shows with data on screen and clears once authority verifies', () => {
	const unverified = unverifiedContextPayload().activeTerm as never;
	const verified = verifiedContextPayload().activeTerm as never;

	const notice = resolveTermAuthorityNotice({ activeTerm: unverified } as never, true);
	assert.ok(notice, 'fallback state carries a visible notice');
	assert.match(notice!, /term authority unverified/, 'notice names the unverified authority');
	assert.match(notice!, /Term 1/, 'notice names the explicit fallback scope');

	assert.equal(resolveTermAuthorityNotice({ activeTerm: verified } as never, true), null, 'notice clears on recovery');
	assert.equal(resolveTermAuthorityNotice({ activeTerm: unverified } as never, false), null, 'blocked page keeps the setup message, not the notice');
	assert.equal(resolveTermAuthorityNotice(null, true), null, 'checking state shows no notice');
});

// ── D3: never-verifiable authority still loads ───────────────────────────────

test('D3 never-verifiable authority loads with an explicit scope plus the notice', () => {
	const fallback = resolveTimetableFallbackTermIndex(null);
	assert.equal(fallback, 1, 'no persisted term falls back to Term 1');

	const persisted = resolveTimetableFallbackTermIndex({ termIndex: 2 } as never);
	assert.equal(persisted, 2, 'a persisted active term wins over Term 1');

	const gate = resolveTimetableLoadGate({
		authorityReady: false,
		termFilter: 'all',
		userOverrodeTermFilter: false,
		fallbackTermIndex: fallback,
	});
	assert.equal(gate.kind, 'load', 'the page loads instead of dead-ending');
	assert.equal(gate.kind === 'load' && gate.termIndex, 1, 'the scope is explicit Term 1');
	assert.equal(gate.kind === 'load' && gate.fallback, true, 'the load is marked as fallback scope');

	const notice = buildTermAuthorityUnverifiedNotice(1);
	assert.match(notice, /term authority unverified/);
	assert.match(notice, /Term 1/);
});

// ── D4: the implicit-scope protection still holds ────────────────────────────

test('D4 no unresolved state can authorize an implicit all-term fetch', () => {
	const unverified = unverifiedContextPayload().activeTerm as never;

	// The route-level scope gate still refuses every unresolved shape.
	assert.equal(resolveTimetableTermScopeState(unverified, 'all', false).queryEnabled, false);
	assert.equal(resolveTimetableTermScopeState(unverified, 2, false).queryEnabled, false);
	assert.equal(resolveTimetableTermScopeState(null, 'all', false).queryEnabled, false);

	// Even an explicit All terms choice cannot authorize an all-term fetch
	// while authority is unresolved — it degrades to the explicit fallback.
	const explicitAll = resolveTimetableLoadGate({
		authorityReady: false,
		termFilter: 'all',
		userOverrodeTermFilter: true,
		fallbackTermIndex: 1,
	});
	assert.deepEqual(explicitAll, { kind: 'load', termIndex: 1, fallback: true });

	// An explicit numeric choice is honored while unresolved (explicit scope).
	const explicitTerm = resolveTimetableLoadGate({
		authorityReady: false,
		termFilter: 3,
		userOverrodeTermFilter: false,
		fallbackTermIndex: 1,
	});
	assert.deepEqual(explicitTerm, { kind: 'load', termIndex: 3, fallback: true });

	// Verified authority with no explicit choice still waits for selection.
	const unpicked = resolveTimetableLoadGate({
		authorityReady: true,
		termFilter: 'all',
		userOverrodeTermFilter: false,
		fallbackTermIndex: 1,
	});
	assert.deepEqual(unpicked, { kind: 'blocked-setup' });

	// Verified authority with an explicit All choice loads all terms.
	const verifiedAll = resolveTimetableLoadGate({
		authorityReady: true,
		termFilter: 'all',
		userOverrodeTermFilter: true,
		fallbackTermIndex: 1,
	});
	assert.deepEqual(verifiedAll, { kind: 'load', termIndex: 'all', fallback: false });

	// Verified authority with the active term loads it with no fallback.
	const verified = verifiedContextPayload().activeTerm as never;
	assert.equal(isTermAuthorityVerified(verified), true);
	const verifiedTerm = resolveTimetableLoadGate({
		authorityReady: true,
		termFilter: 2,
		userOverrodeTermFilter: false,
		fallbackTermIndex: 1,
	});
	assert.deepEqual(verifiedTerm, { kind: 'load', termIndex: 2, fallback: false });
});
