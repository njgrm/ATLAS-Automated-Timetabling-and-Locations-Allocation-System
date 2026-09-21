/**
 * DUP-READ-CALLERS-C01R — Part A (Lane A, client-only) epoch memo for `/auth/me`.
 *
 * Measured defect (packet §1): a clean load issued 2 SEQUENTIAL same-epoch
 * `/auth/me` requests (~147 ms apart). The C01 in-flight promise map cannot
 * coalesce a serial duplicate — the first request has resolved and cleared its
 * entry before the second starts. The fix is a short-lived per-token-epoch
 * resolved-value memo in `requestAuthMe`, shared by `resolveActorSchoolId` and
 * `verifySessionToken`.
 *
 * This suite counts REAL dispatches through the `atlasApi` transport (never
 * "was this function called"). M1 is the failing-first control: it fails on
 * the pre-fix source with a behavioural over-count (`2 !== 1`). M2–M4 are
 * invalidation / no-drift invariants.
 *
 * Run (client workspace):
 *   `npx tsx --test src/lib/__tests__/dup-read-auth-me-epoch-memo.test.ts`
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
import { resolveActorSchoolId, verifySessionToken } from '@/lib/settings';
import {
	clearAtlasAuthStorage,
	getPreferredAccessToken,
	setLocalToken,
} from '@/lib/auth';

type RecordedCall = {
	method: 'get' | 'post';
	url: string;
	headers?: Record<string, string>;
	params?: Record<string, unknown>;
};
let recorded: RecordedCall[] = [];
let authMeResponder: (() => Promise<unknown>) | null = null;

(atlasApi as unknown as { get: (url: string, config?: { headers?: Record<string, string>; params?: Record<string, unknown> }) => Promise<{ data: unknown }> }).get =
	async (url: string, config?: { headers?: Record<string, string>; params?: Record<string, unknown> }) => {
		recorded.push({ method: 'get', url, headers: config?.headers, params: config?.params });
		if (url === '/auth/me') {
			if (!authMeResponder) throw new Error('test /auth/me responder not installed');
			return { data: await authMeResponder() };
		}
		return { data: {} };
	};

(atlasApi as unknown as { post: (url: string, body?: unknown) => Promise<{ data: unknown }> }).post =
	async (url: string) => {
		recorded.push({ method: 'post', url });
		return { data: {} };
	};

function authMeCalls(): RecordedCall[] {
	return recorded.filter((call) => call.url === '/auth/me');
}

function authMeUser(schoolId: number, role = 'admin'): () => Promise<unknown> {
	return async () => ({ user: { schoolId, role } });
}

function axiosFailure(status: number): { isAxiosError: boolean; message: string; response: { status: number } } {
	return { isAxiosError: true, message: `Request failed with status code ${status}`, response: { status } };
}

beforeEach(() => {
	recorded = [];
	authMeResponder = null;
	sessionStorageShim.clear();
	localStorageShim.clear();
	clearAtlasAuthStorage();
	recorded = [];
});

// ── M1 (S1 failing-first): serial cross-caller duplicates ────────────────────
// These fail on the pre-fix source: the second SEQUENTIAL caller finds no
// in-flight entry to join and dispatches again (2 !== 1).

test('M1-a sequential resolveActorSchoolId then verifySessionToken dispatch one /auth/me', async () => {
	setLocalToken('memo-m1a');
	authMeResponder = authMeUser(7);

	assert.equal(await resolveActorSchoolId(), 7, 'the resolver returns the actor school');
	assert.equal((await verifySessionToken())?.schoolId, 7, 'the verifier returns the same actor');
	assert.equal(authMeCalls().length, 1, 'the serial second caller is served the epoch memo');
});

test('M1-b sequential verifySessionToken then resolveActorSchoolId dispatch one /auth/me', async () => {
	setLocalToken('memo-m1b');
	authMeResponder = authMeUser(7);

	assert.equal((await verifySessionToken())?.schoolId, 7, 'the verifier returns the actor');
	assert.equal(await resolveActorSchoolId(), 7, 'the resolver returns the same actor school');
	assert.equal(authMeCalls().length, 1, 'the serial second caller is served the epoch memo');
});

test('M1-c two sequential verifySessionToken calls dispatch one /auth/me', async () => {
	setLocalToken('memo-m1c');
	authMeResponder = authMeUser(7);

	assert.equal((await verifySessionToken())?.schoolId, 7);
	assert.equal((await verifySessionToken())?.schoolId, 7);
	assert.equal(authMeCalls().length, 1, 'a settled request is reused within the epoch');
});

// ── M2 (S2): epoch change + logout invalidation ──────────────────────────────

test('M2 a token-epoch change dispatches anew and never serves the previous value', async () => {
	setLocalToken('memo-m2-a');
	authMeResponder = authMeUser(1);
	assert.equal(await resolveActorSchoolId(), 1);
	assert.equal(authMeCalls().length, 1);

	setLocalToken('memo-m2-b');
	authMeResponder = authMeUser(2);
	assert.equal(await resolveActorSchoolId(), 2, 'the new epoch revalidates, never reuses school 1');
	assert.equal((await verifySessionToken())?.schoolId, 2, 'the verifier sees the new epoch value');
	assert.equal(authMeCalls().length, 2, 'exactly one new dispatch for the new epoch');

	clearAtlasAuthStorage();
	assert.equal(await resolveActorSchoolId(), null, 'logout resolves fail-closed');
	assert.equal(authMeCalls().length, 2, 'logout dispatches nothing and drops the memo');

	setLocalToken('memo-m2-c');
	authMeResponder = authMeUser(3);
	assert.equal(await resolveActorSchoolId(), 3, 're-login revalidates after the drop');
	assert.equal(authMeCalls().length, 3, 'the dropped memo forces a fresh dispatch');
});

// ── M3 (S3): 401/403 + rejection invalidation ────────────────────────────────

test('M3-a an authoritative 401 drops the memo and is never memoized', async () => {
	setLocalToken('memo-m3a-a');
	authMeResponder = authMeUser(9);
	assert.equal(await resolveActorSchoolId(), 9);
	assert.equal(authMeCalls().length, 1);

	setLocalToken('memo-m3a-b');
	authMeResponder = () => Promise.reject(axiosFailure(401));
	assert.equal(await verifySessionToken(), null, 'a 401 verification is fail-closed');
	assert.equal(authMeCalls().length, 2, 'the 401 epoch dispatched exactly once');
	assert.equal(getPreferredAccessToken(), null, 'the 401 cleared the local session');

	// Same-string re-login with a healthy upstream must re-dispatch: the 401
	// was never memoized and the drop is observable as a fresh request.
	setLocalToken('memo-m3a-b');
	authMeResponder = authMeUser(5);
	assert.equal((await verifySessionToken())?.schoolId, 5);
	assert.equal(authMeCalls().length, 3, 'no memoized 401 is served to the re-login');
});

test('M3-b an authoritative 403 drops the memo and is never memoized', async () => {
	setLocalToken('memo-m3b-a');
	authMeResponder = authMeUser(9);
	assert.equal((await verifySessionToken())?.schoolId, 9);
	assert.equal(authMeCalls().length, 1);

	setLocalToken('memo-m3b-c');
	authMeResponder = () => Promise.reject(axiosFailure(403));
	assert.equal(await resolveActorSchoolId(), null, 'a 403 resolution is fail-closed');
	assert.equal(authMeCalls().length, 2, 'the 403 epoch dispatched exactly once');

	setLocalToken('memo-m3b-d');
	authMeResponder = authMeUser(6);
	assert.equal(await resolveActorSchoolId(), 6);
	assert.equal(authMeCalls().length, 3, 'the next epoch revalidates after the 403 drop');
});

test('M3-c a rejected request is never memoized', async () => {
	setLocalToken('memo-m3c');
	authMeResponder = () => Promise.reject(new Error('auth/me unavailable'));

	assert.equal(await resolveActorSchoolId(), null, 'a failed resolution is fail-closed');
	assert.equal(await verifySessionToken(), null, 'a failed verification is fail-closed');

	authMeResponder = authMeUser(6);
	assert.equal(await resolveActorSchoolId(), 6, 'the next caller re-dispatches after a rejection');
	assert.equal(authMeCalls().length, 3, 'the rejection left no memo behind — every caller dispatched');
});

// ── M4 (S4): no behaviour drift ─────────────────────────────────────────────

test('M4 the memoized path changes only the dispatch count', async () => {
	setLocalToken('memo-m4');
	authMeResponder = authMeUser(7);

	assert.equal(await resolveActorSchoolId(), 7);
	const verifierUser = await verifySessionToken();
	assert.equal(verifierUser?.schoolId, 7);
	assert.equal(verifierUser?.authSource, 'local', 'the verifier still defaults the auth source');

	const calls = authMeCalls();
	assert.equal(calls.length, 1, 'exactly one dispatch for the epoch');
	assert.equal(
		calls[0]?.headers?.authorization,
		'Bearer memo-m4',
		'the single request carries the unchanged bearer',
	);
	assert.equal(calls[0]?.params, undefined, 'the single request carries unchanged parameters');
	assert.deepEqual(
		recorded.map((call) => call.url),
		['/auth/me'],
		'no new request on any path',
	);
});
