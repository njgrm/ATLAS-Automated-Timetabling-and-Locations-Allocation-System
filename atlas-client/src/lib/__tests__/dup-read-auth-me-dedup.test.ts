/**
 * DUP-READ-CALLERS-C01 — A1 instrumented dispatch counter for `/auth/me`.
 *
 * The diagnosis (`docs/reviews/dup-read-diagnosis-c01/findings.md` §1) measured
 * two distinct `/auth/me` dispatchers racing on one load: `resolveActorSchoolId`
 * and `verifySessionToken`. A1 requires ONE in-flight `/auth/me` promise per
 * authenticated token epoch shared by both.
 *
 * This suite counts REAL dispatches through the `atlasApi` transport (never
 * "was this function called") so the failing-first control over-counts on the
 * unfixed source. Run (client workspace):
 *   `npx tsx --test src/lib/__tests__/dup-read-auth-me-dedup.test.ts`
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
import { clearAtlasAuthStorage, setBridgeToken, setLocalToken } from '@/lib/auth';

type RecordedCall = { method: 'get' | 'post'; url: string };
let recorded: RecordedCall[] = [];
let authMeResponder: (() => Promise<unknown>) | null = null;

(atlasApi as unknown as { get: (url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: unknown }> }).get =
	async (url: string) => {
		recorded.push({ method: 'get', url });
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
	recorded = [];
	authMeResponder = null;
	sessionStorageShim.clear();
	localStorageShim.clear();
});

// ── S1-a: both dispatchers on one cold-cache epoch ──────────────────────────

test('S1-a concurrent resolveActorSchoolId + verifySessionToken dispatch exactly one /auth/me per token epoch', async () => {
	setLocalToken('dup-s1a');
	const gate = deferred<unknown>();
	authMeResponder = () => gate.promise;

	const resolvePromise = resolveActorSchoolId();
	const verifyPromise = verifySessionToken();
	await tick();
	assert.equal(authMeCalls().length, 1, 'exactly one /auth/me dispatched for one token epoch');

	gate.resolve({ user: { schoolId: 4, role: 'admin' } });
	assert.equal(await resolvePromise, 4, 'the resolver returns the actor school');
	const user = await verifyPromise;
	assert.equal(user?.schoolId, 4, 'the session verifier returns the same actor');
	assert.equal(authMeCalls().length, 1, 'no second dispatch after both settle');
});

// ── S1-b: a new token epoch dispatches exactly one new /auth/me ─────────────

test('S1-b a token-epoch change dispatches exactly one new /auth/me', async () => {
	setLocalToken('dup-s1b-a');
	const gateA = deferred<unknown>();
	authMeResponder = () => gateA.promise;
	const a1 = resolveActorSchoolId();
	const a2 = verifySessionToken();
	await tick();
	assert.equal(authMeCalls().length, 1, 'epoch A dispatches one /auth/me');
	gateA.resolve({ user: { schoolId: 1, role: 'admin' } });
	await Promise.all([a1, a2]);

	setLocalToken('dup-s1b-b');
	const gateB = deferred<unknown>();
	authMeResponder = () => gateB.promise;
	const b1 = resolveActorSchoolId();
	const b2 = verifySessionToken();
	await tick();
	assert.equal(authMeCalls().length, 2, 'epoch B dispatches exactly one new /auth/me');
	gateB.resolve({ user: { schoolId: 2, role: 'admin' } });
	assert.equal(await b1, 2);
	assert.equal((await b2)?.schoolId, 2);
	assert.equal(authMeCalls().length, 2, 'no further dispatch after epoch B settles');
});

// ── S1-c: a rejected request clears the in-flight entry ─────────────────────

test('S1-c a rejected /auth/me clears the in-flight entry so the next caller re-dispatches', async () => {
	setLocalToken('dup-s1c');
	authMeResponder = () => Promise.reject(new Error('auth/me unavailable'));

	const r1 = resolveActorSchoolId();
	const r2 = verifySessionToken();
	await tick();
	assert.equal(authMeCalls().length, 1, 'the concurrent pair shares one rejected request');

	assert.equal(await r1, null, 'a failed resolution is fail-closed');
	assert.equal(await r2, null, 'a failed verification is fail-closed');

	authMeResponder = async () => ({ user: { schoolId: 6, role: 'admin' } });
	assert.equal(await resolveActorSchoolId(), 6, 'the cleared entry permits a fresh dispatch');
	assert.equal(authMeCalls().length, 2, 'the rejected in-flight entry was cleared');
});

// ── S1-d: many concurrent resolvers ─────────────────────────────────────────

test('S1-d many concurrent resolveActorSchoolId callers dispatch one request', async () => {
	setLocalToken('dup-s1d');
	const gate = deferred<unknown>();
	authMeResponder = () => gate.promise;

	const pending = [resolveActorSchoolId(), resolveActorSchoolId(), resolveActorSchoolId()];
	await tick();
	assert.equal(authMeCalls().length, 1, 'three concurrent resolvers share one /auth/me');

	gate.resolve({ user: { schoolId: 3, role: 'admin' } });
	assert.deepEqual(await Promise.all(pending), [3, 3, 3]);
	assert.equal(authMeCalls().length, 1, 'all three settle from the one shared request');
});

// ── S1-e: a bridge-only epoch is shared too ─────────────────────────────────

test('S1-e a bridge-token epoch shares one /auth/me across both dispatchers', async () => {
	clearAtlasAuthStorage();
	setBridgeToken('dup-s1e');
	const gate = deferred<unknown>();
	authMeResponder = () => gate.promise;

	const resolvePromise = resolveActorSchoolId();
	const verifyPromise = verifySessionToken();
	await tick();
	assert.equal(authMeCalls().length, 1, 'bridge epoch shares one /auth/me');

	gate.resolve({ user: { schoolId: 8, role: 'officer' } });
	assert.equal(await resolvePromise, 8);
	assert.equal((await verifyPromise)?.schoolId, 8);
	assert.equal(authMeCalls().length, 1);
});

// ── S1-f: no cross-epoch sharing ────────────────────────────────────────────

test('S1-f two concurrent epochs never share an in-flight /auth/me', async () => {
	setLocalToken('dup-s1f-a');
	const gateA = deferred<unknown>();
	authMeResponder = () => gateA.promise;
	const a = resolveActorSchoolId();
	await tick();

	setLocalToken('dup-s1f-b');
	const gateB = deferred<unknown>();
	authMeResponder = () => gateB.promise;
	const b = resolveActorSchoolId();
	await tick();
	assert.equal(authMeCalls().length, 2, 'a different token epoch dispatches its own request');

	gateA.resolve({ user: { schoolId: 1, role: 'admin' } });
	assert.equal(await a, null, 'the obsolete epoch response is discarded');
	gateB.resolve({ user: { schoolId: 2, role: 'admin' } });
	assert.equal(await b, 2);
});
