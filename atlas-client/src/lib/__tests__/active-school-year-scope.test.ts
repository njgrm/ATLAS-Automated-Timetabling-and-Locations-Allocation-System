import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import {
	activeSchoolYearCacheKey,
	cacheActiveSchoolYearContext,
	invalidateActiveSchoolYearContext,
	resolveActiveSchoolYearContext,
} from '@/lib/enrollpro-public-settings';

function installMemoryStorage(): Map<string, string> {
	const store = new Map<string, string>();
	const storage = {
		get length() { return store.size; },
		clear: () => store.clear(),
		getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
		key: (index: number) => [...store.keys()][index] ?? null,
		removeItem: (key: string) => { store.delete(key); },
		setItem: (key: string, value: string) => { store.set(key, String(value)); },
	};
	(globalThis as unknown as { localStorage: typeof storage }).localStorage = storage;
	return store;
}

let store: Map<string, string>;

beforeEach(() => {
	store = installMemoryStorage();
});

afterEach(() => {
	store.clear();
});

test('runtime year cache is keyed by actor school and no school-1 fallback key exists', async () => {
	cacheActiveSchoolYearContext(7, 19, 'SY 2025-2026');
	cacheActiveSchoolYearContext(8, 20, 'SY 2026-2027');
	assert.ok(store.has(activeSchoolYearCacheKey(7)));
	assert.ok(store.has(activeSchoolYearCacheKey(8)));
	assert.ok(!store.has('atlas:active-school-year-context:v3:1'), 'no cross-school default cache entry is written');

	const schoolSeven = await resolveActiveSchoolYearContext({ schoolId: 7, preferCache: true });
	assert.equal(schoolSeven.schoolId, 7);
	assert.equal(schoolSeven.activeSchoolYearId, 19, 'school 7 reads its own year');

	const schoolEight = await resolveActiveSchoolYearContext({ schoolId: 8, preferCache: true });
	assert.equal(schoolEight.schoolId, 8);
	assert.equal(schoolEight.activeSchoolYearId, 20, 'school 8 reads its own year');
});

test('invalidating one school leaves other school caches untouched', () => {
	cacheActiveSchoolYearContext(7, 19, 'SY 2025-2026');
	cacheActiveSchoolYearContext(8, 20, 'SY 2026-2027');
	invalidateActiveSchoolYearContext(7);
	assert.equal(store.get(activeSchoolYearCacheKey(7)), undefined, 'affected school cache is dropped');
	assert.ok(store.get(activeSchoolYearCacheKey(8)), 'unaffected school cache is preserved');
});

test('sensitivity: a stale cached session is served until the school cache is invalidated', async () => {
	cacheActiveSchoolYearContext(7, 19, 'SY 2025-2026');
	const stale = await resolveActiveSchoolYearContext({ schoolId: 7, preferCache: true });
	assert.equal(stale.activeSchoolYearId, 19, 'prior behavior keeps serving the stale year without invalidation');

	invalidateActiveSchoolYearContext(7);
	assert.equal(store.get(activeSchoolYearCacheKey(7)), undefined, 'verified rollover invalidation removes the stale source');
});
