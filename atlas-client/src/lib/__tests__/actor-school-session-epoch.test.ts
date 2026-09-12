/**
 * RR-TERM-CACHE-C01R2 — session-bound actor-school authority.
 *
 * The actor school resolved from `/auth/me` must be bound to the authenticated
 * token epoch. Logout, same-tab re-login, bridge-token replacement, session
 * expiry, and actor-school switching must all invalidate re-use; an obsolete
 * `/auth/me` response must never return, seed, or overwrite the current scope;
 * and an unresolved authority must dispatch zero scoped requests.
 *
 * This suite exercises the REAL production modules (no source scans, no
 * network): the real `resolveActorSchoolId` and the real scoped fetchers from
 * `@/lib/settings`, the real token/epoch functions from `@/lib/auth`, and the
 * real `isResolvedActorSchoolId` guard from `@/lib/term-authority-repair-scope`.
 * The default `atlasApi` instance is monkey-patched with a recording stub.
 *
 * Run (client workspace):
 *   `npx tsx --test src/lib/__tests__/actor-school-session-epoch.test.ts`
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Storage / DOM shims ─────────────────────────────────────────────────────
// Installed before the first resolution call. No imported module touches these
// globals at evaluation time, so static imports below remain safe.

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

const dispatchedEvents: string[] = [];
Object.defineProperty(globalThis, 'window', {
	value: {
		location: { protocol: 'https:' },
		dispatchEvent: (event: { type?: string }) => {
			dispatchedEvents.push(String(event?.type));
			return true;
		},
	},
	configurable: true,
});

import atlasApi from '@/lib/api';
import {
	resolveActorSchoolId,
	fetchRolloverStatus,
	previewTermCacheSync,
	applyTermCacheSync,
} from '@/lib/settings';
import {
	ATLAS_SESSION_EXPIRED_EVENT,
	clearAtlasAuthStorage,
	clearBridgeToken,
	clearLocalToken,
	expireAtlasSession,
	getPreferredAccessToken,
	setBridgeToken,
	setLocalToken,
} from '@/lib/auth';
import { isResolvedActorSchoolId } from '@/lib/term-authority-repair-scope';

// ── Recording API stub (no network) ─────────────────────────────────────────

type RecordedCall = {
	method: 'get' | 'post';
	url: string;
	params?: Record<string, unknown>;
	body?: Record<string, unknown>;
	token: string | null;
};

let recorded: RecordedCall[] = [];
let authMeResponder: (() => Promise<unknown>) | null = null;

(atlasApi as unknown as { get: (url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: unknown }> }).get =
	async (url: string, config?: { params?: Record<string, unknown> }) => {
		recorded.push({ method: 'get', url, params: config?.params, token: getPreferredAccessToken() });
		if (url === '/auth/me') {
			if (!authMeResponder) throw new Error('test /auth/me responder not installed');
			return { data: await authMeResponder() };
		}
		return { data: {} };
	};

(atlasApi as unknown as { post: (url: string, body?: Record<string, unknown>) => Promise<{ data: unknown }> }).post =
	async (url: string, body?: Record<string, unknown>) => {
		recorded.push({ method: 'post', url, body, token: getPreferredAccessToken() });
		return { data: {} };
	};

function authMe(schoolId: unknown): () => Promise<unknown> {
	return async () => ({ user: { schoolId } });
}

function authMeCalls(): RecordedCall[] {
	return recorded.filter((call) => call.url === '/auth/me');
}

function scopedCalls(): RecordedCall[] {
	return recorded.filter((call) => call.url.startsWith('/runtime/'));
}

function scopedSchoolId(call: RecordedCall): unknown {
	return call.method === 'get' ? call.params?.schoolId : call.body?.schoolId;
}

beforeEach(() => {
	recorded = [];
	authMeResponder = null;
	sessionStorageShim.clear();
	localStorageShim.clear();
	dispatchedEvents.length = 0;
});

// ── Scenario 1: no token ────────────────────────────────────────────────────

test('S1 no token: resolver fails closed with zero /auth/me dispatch', async () => {
	clearAtlasAuthStorage();
	const id = await resolveActorSchoolId();
	assert.equal(id, null, 'no authenticated session must resolve to null');
	assert.equal(authMeCalls().length, 0, 'no /auth/me dispatch without a token');
});

// ── Scenario 2: bounded per-token cache ─────────────────────────────────────

test('S2 one token epoch caches one resolved school without re-dispatch', async () => {
	setLocalToken('epoch-s2-a');
	authMeResponder = authMe(1);

	assert.equal(await resolveActorSchoolId(), 1);
	assert.equal(authMeCalls().length, 1, 'first resolve dispatches /auth/me once');

	assert.equal(await resolveActorSchoolId(), 1);
	assert.equal(authMeCalls().length, 1, 'second resolve reuses the per-token cache');
});

// ── Scenario 3: logout without reload ───────────────────────────────────────

test('S3 logout without reload invalidates the cached school and never dispatches stale scope', async () => {
	setLocalToken('epoch-s3-local');
	authMeResponder = authMe(1);
	assert.equal(await resolveActorSchoolId(), 1);

	clearLocalToken();
	const afterClear = await resolveActorSchoolId();
	assert.equal(afterClear, null, 'cleared session must not return the cached school');
	assert.equal(scopedCalls().length, 0, 'zero scoped dispatch while unresolved');
	assert.equal(authMeCalls().length, 1, 'no /auth/me dispatch after token removal');

	// expireAtlasSession() path raises the canonical event and clears storage.
	setLocalToken('epoch-s3-expire');
	authMeResponder = authMe(4);
	assert.equal(await resolveActorSchoolId(), 4);
	expireAtlasSession();
	assert.deepEqual(dispatchedEvents, [ATLAS_SESSION_EXPIRED_EVENT], 'session-expired event is raised once');
	assert.equal(await resolveActorSchoolId(), null, 'expired session must not return the cached school');
	assert.equal(authMeCalls().length, 2, 'no /auth/me dispatch after session expiry');
});

// ── Scenario 4: same-tab re-login as school 2 ───────────────────────────────

test('S4 same-tab re-login revalidates and every scoped request carries the new school', async () => {
	setLocalToken('epoch-s4-a');
	authMeResponder = authMe(1);
	assert.equal(await resolveActorSchoolId(), 1);

	setLocalToken('epoch-s4-b');
	authMeResponder = authMe(2);
	const id = await resolveActorSchoolId();
	assert.equal(id, 2, 're-login must revalidate, not reuse school 1');
	assert.equal(authMeCalls().length, 2, 'the new epoch forces exactly one revalidation');
	if (!isResolvedActorSchoolId(id)) throw new Error('expected a resolved actor school');

	// Production-style consumer calls with the resolved id.
	await fetchRolloverStatus(id);
	await previewTermCacheSync(id);
	await applyTermCacheSync(id, { confirmationText: 'SAVE_TERM_AUTHORITY_2_7001', fingerprint: 'f'.repeat(64) });

	const scoped = scopedCalls();
	assert.equal(scoped.length, 3, 'status + preview + apply dispatched');
	for (const call of scoped) {
		assert.equal(scopedSchoolId(call), 2, `${call.method} ${call.url} must carry school 2`);
		assert.equal(call.token, 'epoch-s4-b', `${call.method} ${call.url} must use the current session token`);
	}
	assert.equal(
		scoped.some((call) => scopedSchoolId(call) === 1),
		false,
		'no scoped request may carry the previous school 1',
	);
});

// ── Scenario 5a: obsolete response lands after the new session resolved ─────

test('S5a a late /auth/me response from an obsolete session is discarded without overwriting', async () => {
	let resolveDeferredA: (value: unknown) => void = () => {};
	const deferredA = new Promise((resolve) => {
		resolveDeferredA = resolve;
	});

	setLocalToken('epoch-s5a-a');
	authMeResponder = () => deferredA;
	const pendingA = resolveActorSchoolId();

	setLocalToken('epoch-s5a-b');
	authMeResponder = authMe(2);
	assert.equal(await resolveActorSchoolId(), 2, 'session B resolves its own school');
	assert.equal(authMeCalls().length, 2);

	// The obsolete school-1 response now arrives.
	resolveDeferredA({ user: { schoolId: 1 } });
	assert.equal(await pendingA, null, 'obsolete response must not return school 1');

	const dispatchesBefore = authMeCalls().length;
	assert.equal(await resolveActorSchoolId(), 2, 'cache still holds session B school after the late response');
	assert.equal(authMeCalls().length, dispatchesBefore, 'no extra dispatch after the late response');
});

// ── Scenario 5b: obsolete response lands before the new session resolves ────

test('S5b an obsolete response that lands before the new session resolves does not seed', async () => {
	let resolveDeferredA: (value: unknown) => void = () => {};
	const deferredA = new Promise((resolve) => {
		resolveDeferredA = resolve;
	});

	setLocalToken('epoch-s5b-a');
	authMeResponder = () => deferredA;
	const pendingA = resolveActorSchoolId();

	setLocalToken('epoch-s5b-b');
	authMeResponder = authMe(2);

	// A's response lands while the current token is already B and B is unresolved.
	resolveDeferredA({ user: { schoolId: 1 } });
	assert.equal(await pendingA, null, 'obsolete A response must not seed school 1');

	assert.equal(await resolveActorSchoolId(), 2, 'session B still resolves its own school');
	assert.equal(authMeCalls().length, 2, 'B dispatched exactly once for its own epoch');
	assert.equal(await resolveActorSchoolId(), 2);
	assert.equal(authMeCalls().length, 2, 'B school remains cached');
});

// ── Scenario 6: bridge-token replacement ────────────────────────────────────

test('S6 bridge-token replacement revalidates and never returns the previous school', async () => {
	clearAtlasAuthStorage();
	setBridgeToken('bridge-s6-a');
	authMeResponder = authMe(1);
	assert.equal(await resolveActorSchoolId(), 1);

	setBridgeToken('bridge-s6-b');
	authMeResponder = authMe(2);
	assert.equal(await resolveActorSchoolId(), 2, 'bridge replacement must revalidate');
	assert.equal(authMeCalls().length, 2);

	clearBridgeToken();
	assert.equal(await resolveActorSchoolId(), null, 'no bridge token resolves to null');
	assert.equal(authMeCalls().length, 2, 'no /auth/me dispatch without a bridge token');
});

// ── Scenario 7: invalid /auth/me school ids ─────────────────────────────────

test('S7 invalid /auth/me school ids fail closed and are never cached', async () => {
	const invalidIds: unknown[] = [0, -4, 1.5, '2', null, undefined];
	let expectedDispatches = 0;

	for (const [index, raw] of invalidIds.entries()) {
		setLocalToken(`epoch-s7-${index}`);
		authMeResponder = authMe(raw);

		expectedDispatches += 1;
		assert.equal(await resolveActorSchoolId(), null, `school id ${String(raw)} must fail closed`);

		expectedDispatches += 1;
		assert.equal(await resolveActorSchoolId(), null, `school id ${String(raw)} must still fail closed`);
		assert.equal(
			authMeCalls().length,
			expectedDispatches,
			`school id ${String(raw)} must not be cached (second call re-dispatches)`,
		);
	}
});

// ── Scenario 8: unresolved authority dispatches zero scoped requests ─────────

test('S8 unresolved authority dispatches zero scoped requests through the real guard', async () => {
	clearAtlasAuthStorage();
	const id = await resolveActorSchoolId();
	assert.equal(id, null);

	// Consumer harness: exactly how production callers gate on the actor school.
	if (isResolvedActorSchoolId(id)) {
		await fetchRolloverStatus(id);
		await previewTermCacheSync(id);
		await applyTermCacheSync(id, { confirmationText: 'SAVE_TERM_AUTHORITY_1_7001', fingerprint: 'f'.repeat(64) });
	}

	assert.equal(isResolvedActorSchoolId(id), false);
	assert.equal(scopedCalls().length, 0, 'no rollover-status/preview/apply dispatch while unresolved');
	assert.equal(authMeCalls().length, 0, 'no /auth/me dispatch while unauthenticated');
});
