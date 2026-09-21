/**
 * DUP-READ-CALLERS-C01 — A2 request-profile key for the `runtime/context`
 * in-flight registry.
 *
 * `resolveActiveSchoolYearContext` deliberately bypassed its in-flight registry
 * for `forceRefresh:true` (`enrollpro-public-settings.ts:231-241`), but its
 * callers are NOT equivalent: AppShell's year verification sends
 * `forceRefresh` + `verifyUpstream:true`, while the Timetable background
 * refresh is `verifyUpstream:false`. `verifyUpstream` is load-bearing
 * (`runtime-context.service.ts`), so joining a weaker in-flight request would
 * be a user-visible drift/term regression.
 *
 * A2 keys the registry by the full request profile
 * `schoolId:verifyUpstream:allowEnrollProFallback:allowStaleOnError`
 * (absent options normalized to their effective defaults), gives
 * `promoteActiveSchoolYearContext` the same key, and keeps the
 * `useTimetableData` follow-up. This suite counts REAL `/runtime/context`
 * dispatches and asserts the returned state.
 *
 * Run (client workspace):
 *   `npx tsx --test src/lib/__tests__/dup-read-runtime-context-profile.test.ts`
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
	activeSchoolYearCacheKey,
	cacheActiveSchoolYearContext,
	invalidateActiveSchoolYearContext,
	promoteActiveSchoolYearContext,
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

function runtimeContextFor(activeSchoolYearId: number, params?: Record<string, unknown>) {
	return {
		activeSchoolYearId,
		activeSchoolYearLabel: `SY-${activeSchoolYearId}`,
		schoolId: Number(params?.schoolId),
		source: 'enrollpro-verified',
		stale: false,
		activeTerm: {
			source: 'enrollpro',
			reachable: true,
			verified: true,
			activeTerm: `Term-${activeSchoolYearId}`,
			termIndex: 1,
			schoolYearId: activeSchoolYearId,
			matchedSchoolYear: true,
			code: null,
			message: 'aligned',
		},
	};
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function tick(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
	runtimeContextCalls = [];
	runtimeContextResponder = null;
	sessionStorageShim.clear();
	localStorageShim.clear();
});

// ── S2-a: same profile, forceRefresh joins (failing-first over-count) ───────

test('S2-a a forceRefresh caller with an equal profile joins the in-flight request', async () => {
	invalidateActiveSchoolYearContext(11);
	const gate = deferred<unknown>();
	runtimeContextResponder = () => gate.promise;

	const first = resolveActiveSchoolYearContext({ schoolId: 11, verifyUpstream: true, allowStaleOnError: false, allowEnrollProFallback: false });
	const forced = resolveActiveSchoolYearContext({ schoolId: 11, forceRefresh: true, verifyUpstream: true, allowStaleOnError: false, allowEnrollProFallback: false });
	await tick();
	assert.equal(runtimeContextCalls.length, 1, 'an equal-profile forceRefresh caller shares the one in-flight request');

	gate.resolve(runtimeContextFor(101, { schoolId: 11 }));
	const [a, b] = await Promise.all([first, forced]);
	assert.equal(a.activeSchoolYearId, 101);
	assert.equal(b.activeSchoolYearId, 101, 'the joining caller receives the same fresh context');
	assert.equal(b.source, 'enrollpro-verified', 'the joined result is a live upstream result, never cache');
	assert.deepEqual(b.activeTerm, runtimeContextFor(101, { schoolId: 11 }).activeTerm, 'the returned activeTerm state is unchanged');
	assert.equal(runtimeContextCalls.length, 1, 'no duplicate dispatch');
});

// ── S2-b: a verifyUpstream:true caller never joins a weaker profile ─────────

test('S2-b a forceRefresh+verifyUpstream caller never joins a verifyUpstream:false in-flight request', async () => {
	invalidateActiveSchoolYearContext(12);
	const gateA = deferred<unknown>();
	runtimeContextResponder = () => gateA.promise;
	const weak = resolveActiveSchoolYearContext({ schoolId: 12, verifyUpstream: false, allowStaleOnError: true, allowEnrollProFallback: false });
	await tick();

	runtimeContextResponder = async (params) => runtimeContextFor(202, params);
	const strong = resolveActiveSchoolYearContext({ schoolId: 12, forceRefresh: true, verifyUpstream: true, allowStaleOnError: false, allowEnrollProFallback: false });
	await tick();
	assert.equal(runtimeContextCalls.length, 2, 'a verifyUpstream:true caller dispatches its own request');
	assert.equal(runtimeContextCalls[0].params?.verifyUpstream, undefined, 'the weak request omits verifyUpstream');
	assert.equal(runtimeContextCalls[1].params?.verifyUpstream, 'true', 'the strong request carries verifyUpstream=true');

	gateA.resolve(runtimeContextFor(201, { schoolId: 12 }));
	assert.equal((await weak).activeSchoolYearId, 201);
	assert.equal((await strong).activeSchoolYearId, 202, 'the strong caller receives its own verified context');
});

// ── S2-c: allowStaleOnError axis on the success path ────────────────────────

test('S2-c a caller that passed allowStaleOnError:false never joins an in-flight allowStaleOnError:true request (success)', async () => {
	invalidateActiveSchoolYearContext(13);
	const gateLax = deferred<unknown>();
	runtimeContextResponder = () => gateLax.promise;
	const lax = resolveActiveSchoolYearContext({ schoolId: 13, verifyUpstream: true, allowStaleOnError: true, allowEnrollProFallback: false });
	await tick();

	const gateStrict = deferred<unknown>();
	runtimeContextResponder = () => gateStrict.promise;
	const strict = resolveActiveSchoolYearContext({ schoolId: 13, forceRefresh: true, verifyUpstream: true, allowStaleOnError: false, allowEnrollProFallback: false });
	await tick();
	assert.equal(runtimeContextCalls.length, 2, 'the allowStaleOnError axis is part of the profile key');

	gateLax.resolve(runtimeContextFor(301, { schoolId: 13 }));
	gateStrict.resolve(runtimeContextFor(302, { schoolId: 13 }));
	assert.equal((await lax).activeSchoolYearId, 301);
	assert.equal((await strict).activeSchoolYearId, 302, 'each caller receives its own response');
});

// ── S2-d: allowStaleOnError axis on the failure path ────────────────────────

test('S2-d a caller that passed allowStaleOnError:false never adopts the stale cache a lax caller falls back to', async () => {
	invalidateActiveSchoolYearContext(14);
	localStorageShim.setItem(
		activeSchoolYearCacheKey(14),
		JSON.stringify({ activeSchoolYearId: 401, activeSchoolYearLabel: 'SY-stale', activeTerm: null, cachedAt: new Date(Date.now() - 3600_000).toISOString() }),
	);

	const gateLax = deferred<unknown>();
	runtimeContextResponder = () => gateLax.promise;
	const lax = resolveActiveSchoolYearContext({ schoolId: 14, verifyUpstream: true, allowStaleOnError: true, allowEnrollProFallback: false });
	await tick();

	const gateStrict = deferred<unknown>();
	runtimeContextResponder = () => gateStrict.promise;
	const strict = resolveActiveSchoolYearContext({ schoolId: 14, forceRefresh: true, verifyUpstream: true, allowStaleOnError: false, allowEnrollProFallback: false });
	await tick();
	assert.equal(runtimeContextCalls.length, 2, 'the axes differ, so the two callers dispatch independently');

	const laxSettled = lax.then((value) => ({ ok: true as const, value }), (error) => ({ ok: false as const, error }));
	const strictSettled = strict.then((value) => ({ ok: true as const, value }), (error) => ({ ok: false as const, error }));

	gateLax.reject(new Error('enrollpro unreachable'));
	gateStrict.reject(new Error('enrollpro unreachable'));

	const laxOutcome = await laxSettled;
	assert.equal(laxOutcome.ok, true, 'the lax caller falls back to the stale cache');
	if (laxOutcome.ok) {
		assert.equal(laxOutcome.value.source, 'cache');
		assert.equal(laxOutcome.value.stale, true);
		assert.equal(laxOutcome.value.activeSchoolYearId, 401);
	}

	const strictOutcome = await strictSettled;
	assert.equal(strictOutcome.ok, false, 'the strict caller throws instead of adopting stale data');
});

// ── S2-e: promoteActiveSchoolYearContext uses the same profile key ──────────

test('S2-e promoteActiveSchoolYearContext dispatches its own request instead of joining a weaker profile', async () => {
	invalidateActiveSchoolYearContext(15);
	cacheActiveSchoolYearContext(15, 501, 'SY-15');
	const gateBackground = deferred<unknown>();
	runtimeContextResponder = () => gateBackground.promise;
	const background = resolveActiveSchoolYearContext({
		schoolId: 15,
		preferCache: true,
		backgroundRefresh: true,
		allowStaleOnError: true,
		allowEnrollProFallback: false,
	});
	await tick();
	assert.equal(runtimeContextCalls.length, 1, 'the background refresh dispatches once');
	assert.equal((await background).source, 'cache', 'preferCache returns the cached context immediately');

	runtimeContextResponder = async (params) => runtimeContextFor(502, params);
	const promoted = promoteActiveSchoolYearContext({ schoolId: 15, verifyUpstream: true, allowStaleOnError: false, allowEnrollProFallback: false });
	await tick();
	assert.equal(runtimeContextCalls.length, 2, 'promote does not join the background refresh under a different profile');
	assert.equal(runtimeContextCalls[1].params?.verifyUpstream, 'true', 'promote preserves its verifyUpstream option');

	gateBackground.resolve(runtimeContextFor(501, { schoolId: 15 }));
	assert.equal((await promoted).activeSchoolYearId, 502);
});

// ── S2-f: preservation — fresh cache still short-circuits ──────────────────

test('S2-f a fresh cache is still served without any dispatch', async () => {
	invalidateActiveSchoolYearContext(16);
	cacheActiveSchoolYearContext(16, 601, 'SY-16');
	const fresh = await resolveActiveSchoolYearContext({ schoolId: 16 });
	assert.equal(fresh.activeSchoolYearId, 601);
	assert.equal(fresh.source, 'cache');
	assert.equal(runtimeContextCalls.length, 0, 'no /runtime/context dispatch when the cache is fresh');
});
