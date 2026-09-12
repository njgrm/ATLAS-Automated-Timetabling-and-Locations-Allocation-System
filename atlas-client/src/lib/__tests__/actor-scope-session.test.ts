/**
 * ACTOR-SCOPE-C01 — real-path session-bound actor-scope dispatch.
 *
 * Drives the REAL production modules (no source scans, no network): the shared
 * `runActorScoped` / `loadActor*` helpers from `@/lib/actor-scope-session`, the
 * real `resolveActorSchoolId` and scoped fetchers from `@/lib/settings`, the
 * real epoch mechanism from `@/lib/auth`, and the real `resolveActiveSchoolYearContext`.
 * The default `atlasApi` instance is monkey-patched with a recording stub.
 *
 * Run (client workspace):
 *   `npx tsx --test src/lib/__tests__/actor-scope-session.test.ts`
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
	runActorScoped,
	loadActorYearContext,
	loadActorRolloverStatus,
	loadActorArchivePreview,
	isActorScopeCurrent,
} from '@/lib/actor-scope-session';
import {
	getAtlasTokenEpochVersion,
	subscribeAtlasTokenEpoch,
	getPreferredAccessToken,
	setLocalToken,
	clearAtlasAuthStorage,
} from '@/lib/auth';

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
		if (url === '/runtime/context') {
			const requested = Number(config?.params?.schoolId);
			return {
				data: {
					activeSchoolYearId: 7001,
					activeSchoolYearLabel: '2030-2031',
					schoolId: requested,
					source: 'atlas-persisted',
					stale: false,
					activeTerm: null,
				},
			};
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
});

test('no token: runActorScoped is unresolved with zero scoped dispatch', async () => {
	clearAtlasAuthStorage();
	let loaderRan = false;
	const result = await runActorScoped(async () => { loaderRan = true; return 'x'; });
	assert.equal(result.status, 'unresolved');
	assert.equal(loaderRan, false, 'loader must not run without an authenticated session');
	assert.equal(recorded.length, 0, 'zero dispatch');
});

test('invalid /auth/me school ids fail closed with zero scoped dispatch', async () => {
	for (const [index, raw] of [0, -4, 1.5, '2', null, undefined].entries()) {
		setLocalToken(`epoch-invalid-${index}`);
		authMeResponder = authMe(raw);
		const result = await runActorScoped(async () => 'x');
		assert.equal(result.status, 'unresolved', `school ${String(raw)} must fail closed`);
	}
	assert.equal(scopedCalls().length, 0, 'no scoped request dispatched for invalid ids');
});

test('token A/school 1: the first scoped request carries school 1 and token A', async () => {
	setLocalToken('epoch-a');
	authMeResponder = authMe(1);
	const result = await loadActorRolloverStatus(true);
	assert.equal(result.status, 'ok');
	if (result.status !== 'ok') return;
	assert.equal(result.schoolId, 1);
	const statusCalls = scopedCalls().filter((c) => c.url === '/runtime/rollover-status');
	assert.equal(statusCalls.length, 1);
	assert.equal(scopedSchoolId(statusCalls[0]), 1);
	assert.equal(statusCalls[0].token, 'epoch-a');
});

test('same-tab A->B re-login: all subsequent scoped requests use school 2 and token B, none use school 1', async () => {
	setLocalToken('epoch-a');
	authMeResponder = authMe(1);
	assert.equal((await loadActorRolloverStatus()).status, 'ok');

	setLocalToken('epoch-b');
	authMeResponder = authMe(2);
	recorded = [];
	const status = await loadActorRolloverStatus(false);
	assert.equal(status.status, 'ok');
	if (status.status === 'ok') assert.equal(status.schoolId, 2);
	const archive = await loadActorArchivePreview();
	assert.equal(archive.status, 'ok');
	if (archive.status === 'ok') assert.equal(archive.schoolId, 2);

	const scoped = scopedCalls();
	assert.ok(scoped.length >= 2, 'both scoped requests dispatched');
	for (const call of scoped) {
		assert.equal(scopedSchoolId(call), 2, `${call.method} ${call.url} must carry school 2`);
		assert.equal(call.token, 'epoch-b', `${call.method} ${call.url} must use token B`);
	}
	assert.equal(scoped.some((call) => scopedSchoolId(call) === 1), false, 'no scoped request may carry school 1');
});

test('loadActorYearContext resolves the runtime context for the resolved actor school', async () => {
	setLocalToken('epoch-year');
	authMeResponder = authMe(7);
	const result = await loadActorYearContext({ forceRefresh: true, allowEnrollProFallback: false });
	assert.equal(result.status, 'ok');
	if (result.status !== 'ok') return;
	assert.equal(result.schoolId, 7);
	const contextCalls = scopedCalls().filter((c) => c.url === '/runtime/context');
	assert.equal(contextCalls.length, 1);
	assert.equal(scopedSchoolId(contextCalls[0]), 7);
	assert.equal(contextCalls[0].token, 'epoch-year');
});

test('a late actor-school response from session A is discarded in both orderings', async () => {
	// Ordering 1: A resolves AFTER B is already authoritative.
	let releaseA: (value: unknown) => void = () => {};
	const deferredA = new Promise((resolve) => { releaseA = resolve; });
	setLocalToken('epoch-a');
	authMeResponder = () => deferredA;
	const pendingA = runActorScoped(async () => 'A-value');

	setLocalToken('epoch-b');
	authMeResponder = authMe(2);
	assert.equal((await loadActorRolloverStatus()).status, 'ok');

	releaseA({ user: { schoolId: 1 } });
	assert.equal((await pendingA).status, 'unresolved', 'obsolete A response must not dispatch A work');

	// Ordering 2: A resolves BEFORE B is resolved.
	let releaseA2: (value: unknown) => void = () => {};
	const deferredA2 = new Promise((resolve) => { releaseA2 = resolve; });
	setLocalToken('epoch-a2');
	authMeResponder = () => deferredA2;
	const pendingA2 = runActorScoped(async () => 'A2-value');

	setLocalToken('epoch-b2');
	authMeResponder = authMe(2);
	releaseA2({ user: { schoolId: 1 } });
	const a2Result = await pendingA2;
	assert.equal(a2Result.status, 'unresolved', 'A2 must not seed or dispatch school 1');
	assert.equal((await loadActorRolloverStatus()).status, 'ok');

	assert.equal(scopedCalls().some((call) => scopedSchoolId(call) === 1), false, 'no scoped request carried school 1');
});

test('token epoch subscription fires synchronously on every mutation and unsubscribes cleanly', () => {
	const observed: number[] = [];
	const unsubscribe = subscribeAtlasTokenEpoch(() => observed.push(getAtlasTokenEpochVersion()));
	const before = getAtlasTokenEpochVersion();
	setLocalToken('epoch-sub-1');
	setLocalToken('epoch-sub-2');
	clearAtlasAuthStorage();
	// clearAtlasAuthStorage clears both token stores, so it notifies twice; every
	// notification is synchronous and strictly advances the monotonic version.
	assert.equal(observed.length, 4, 'set x2 + clear x2 notifications, all synchronous');
	assert.ok(observed[0] > before, 'first notification advances past the pre-subscription version');
	for (let i = 1; i < observed.length; i += 1) {
		assert.ok(observed[i] > observed[i - 1], 'version strictly advances on every mutation');
	}
	unsubscribe();
	const afterUnsubscribe = getAtlasTokenEpochVersion();
	clearAtlasAuthStorage();
	assert.equal(getAtlasTokenEpochVersion() > afterUnsubscribe, true, 'version still advances after unsubscribe');
	assert.equal(observed.length, 4, 'no notification after unsubscribe');
});

test('isActorScopeCurrent is false once the token epoch advances', () => {
	setLocalToken('epoch-current-a');
	const captured = { token: getPreferredAccessToken(), epochVersion: getAtlasTokenEpochVersion() };
	assert.equal(isActorScopeCurrent(captured), true);
	setLocalToken('epoch-current-b');
	assert.equal(isActorScopeCurrent(captured), false);
	clearAtlasAuthStorage();
	assert.equal(isActorScopeCurrent(captured), false);
});
