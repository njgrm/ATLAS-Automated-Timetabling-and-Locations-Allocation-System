/**
 * ACTOR-SCOPE-C01 correction — late session-A response discard for the
 * MyDashboard and MySchedule scope-gated loaders.
 *
 * Drives the REAL production functions `loadMyDashboardScoped` and
 * `loadMyScheduleScoped`, through the shared `runActorScoped` mechanism, with a
 * recording `atlasApi` and a deferred scoped response. Both orderings are
 * covered: (a) A's response lands AFTER B is authoritative, (b) A's response
 * lands while B is still unresolved. In both, A's payload must be discarded.
 *
 * Run: `npx tsx --test src/lib/__tests__/session-scope-late-discard.test.ts`
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
	private store = new Map<string, string>();
	getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
	setItem(key: string, value: string): void { this.store.set(key, String(value)); }
	removeItem(key: string): void { this.store.delete(key); }
	clear(): void { this.store.clear(); }
	get length(): number { return this.store.size; }
	key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
}
const sessionStorageShim = new MemoryStorage();
const localStorageShim = new MemoryStorage();
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageShim, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: localStorageShim, configurable: true });
Object.defineProperty(globalThis, 'window', { value: { location: { protocol: 'https:' }, dispatchEvent: () => true }, configurable: true });

import atlasApi from '@/lib/api';
import { setLocalToken, clearAtlasAuthStorage, getPreferredAccessToken } from '@/lib/auth';
import { resolveActorSchoolId } from '@/lib/settings';
import { loadMyDashboardScoped } from '@/pages/MyDashboard';
import { loadMyScheduleScoped } from '@/pages/MySchedule';

type RecordedCall = { method: 'get' | 'post'; url: string; params?: Record<string, unknown>; token: string | null };
let recorded: RecordedCall[] = [];
let authMeResponder: (() => Promise<unknown>) | null = null;
let dashboardResponder: (() => Promise<unknown>) | null = null;
let scheduleResponder: (() => Promise<unknown>) | null = null;

(atlasApi as unknown as { get: (url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: unknown }> }).get =
	async (url: string, config?: { params?: Record<string, unknown> }) => {
		recorded.push({ method: 'get', url, params: config?.params, token: getPreferredAccessToken() });
		if (url === '/auth/me') {
			if (!authMeResponder) throw new Error('test /auth/me responder not installed');
			return { data: await authMeResponder() };
		}
		if (url === '/runtime/context') {
			return { data: { activeSchoolYearId: 7001, activeSchoolYearLabel: '2030-2031', schoolId: Number(config?.params?.schoolId), source: 'atlas-persisted', stale: false, activeTerm: null } };
		}
		if (url === '/faculty/me') return { data: { faculty: { id: 55 } } };
		if (url.includes('/dashboard')) {
			if (!dashboardResponder) throw new Error('test dashboard responder not installed');
			return { data: await dashboardResponder() };
		}
		if (url.includes('/schedules/published/faculty/')) {
			if (!scheduleResponder) throw new Error('test schedule responder not installed');
			return { data: await scheduleResponder() };
		}
		return { data: {} };
	};

(atlasApi as unknown as { post: (url: string) => Promise<{ data: unknown }> }).post = async (url: string) => {
	recorded.push({ method: 'post', url, token: getPreferredAccessToken() });
	return { data: {} };
};

function authMe(schoolId: unknown): () => Promise<unknown> { return async () => ({ user: { schoolId } }); }
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => { resolve = r; });
	return { promise, resolve };
}
async function waitFor(selector: (call: RecordedCall) => boolean): Promise<void> {
	for (let i = 0; i < 200; i += 1) {
		if (recorded.some(selector)) return;
		await new Promise((r) => setTimeout(r, 0));
	}
	throw new Error('timeout waiting for recorded call');
}

beforeEach(() => {
	recorded = [];
	authMeResponder = null;
	dashboardResponder = null;
	scheduleResponder = null;
	sessionStorageShim.clear();
	localStorageShim.clear();
});

test('MyDashboard: late A response is discarded in ordering (a) A lands after B is authoritative', async () => {
	const deferredA = deferred<unknown>();
	dashboardResponder = () => deferredA.promise;
	setLocalToken('md-a');
	authMeResponder = authMe(1);
	const pendingA = loadMyDashboardScoped(1, 7001);
	await waitFor((c) => c.url.includes('/dashboard'));

	// B becomes authoritative before A's payload lands.
	setLocalToken('md-b');
	authMeResponder = authMe(2);
	assert.equal(await resolveActorSchoolId(), 2);

	deferredA.resolve({ faculty: 'A-data', phaseMessage: 'A', schedulePreview: {}, objectiveState: {} });
	const result = await pendingA;
	assert.equal(result.status, 'discarded', 'A payload must be discarded after B is authoritative');
});

test('MyDashboard: late A response is discarded in ordering (b) A lands while B is unresolved', async () => {
	const deferredA = deferred<unknown>();
	dashboardResponder = () => deferredA.promise;
	setLocalToken('md-a2');
	authMeResponder = authMe(1);
	const pendingA = loadMyDashboardScoped(1, 7001);
	await waitFor((c) => c.url.includes('/dashboard'));

	setLocalToken('md-b2');
	authMeResponder = authMe(2);
	// B is NOT resolved yet when A's payload lands.
	deferredA.resolve({ faculty: 'A2-data' });
	const result = await pendingA;
	assert.equal(result.status, 'discarded', 'A payload must be discarded while B is unresolved');
});

test('MySchedule: late A response is discarded in ordering (a) A lands after B is authoritative', async () => {
	const deferredA = deferred<unknown>();
	scheduleResponder = () => deferredA.promise;
	setLocalToken('ms-a');
	authMeResponder = authMe(1);
	const pendingA = loadMyScheduleScoped(1, 7001, 55, '2026-09-12');
	await waitFor((c) => c.url.includes('/schedules/published/faculty/'));

	setLocalToken('ms-b');
	authMeResponder = authMe(2);
	assert.equal(await resolveActorSchoolId(), 2);

	deferredA.resolve({ entries: [{ entryId: 'A' }], source: {} });
	const result = await pendingA;
	assert.equal(result, null, 'A schedule payload must be discarded after B is authoritative');
});

test('MySchedule: late A response is discarded in ordering (b) A lands while B is unresolved', async () => {
	const deferredA = deferred<unknown>();
	scheduleResponder = () => deferredA.promise;
	setLocalToken('ms-a2');
	authMeResponder = authMe(1);
	const pendingA = loadMyScheduleScoped(1, 7001, 55, '2026-09-12');
	await waitFor((c) => c.url.includes('/schedules/published/faculty/'));

	setLocalToken('ms-b2');
	authMeResponder = authMe(2);
	deferredA.resolve({ entries: [{ entryId: 'A2' }] });
	const result = await pendingA;
	assert.equal(result, null, 'A schedule payload must be discarded while B is unresolved');
});

test('sanity: a current-session dashboard/schedule response is returned (not discarded)', async () => {
	setLocalToken('md-current');
	authMeResponder = authMe(5);
	dashboardResponder = async () => ({ faculty: 'current' });
	const dash = await loadMyDashboardScoped(5, 7001);
	assert.equal(dash.status, 'ok');

	setLocalToken('ms-current');
	authMeResponder = authMe(5);
	scheduleResponder = async () => ({ entries: [] });
	clearAtlasAuthStorage();
	setLocalToken('ms-current');
	authMeResponder = authMe(5);
	const schedule = await loadMyScheduleScoped(5, 7001, 55, '2026-09-12');
	assert.ok(schedule != null, 'current-session schedule loads');
});
