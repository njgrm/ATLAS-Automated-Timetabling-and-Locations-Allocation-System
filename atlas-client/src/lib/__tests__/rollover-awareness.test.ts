import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import {
	createRolloverAwarenessNotice,
	evaluateRolloverTransition,
	persistRolloverAwarenessNotice,
	readRolloverAwarenessNotice,
	rolloverNoticeCacheKey,
} from '@/lib/rollover-awareness';

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

test('rollover awareness notice round-trips through durable storage', () => {
	const notice = createRolloverAwarenessNotice({
		schoolId: 7,
		activeSchoolYearId: 20,
		activeSchoolYearLabel: 'SY 2026-2027',
		previousSchoolYearId: 19,
		previousSchoolYearLabel: 'SY 2025-2026',
	});
	persistRolloverAwarenessNotice(notice);

	const restored = readRolloverAwarenessNotice(7);
	assert.ok(restored, 'notice restores after reload/reconnect');
	assert.equal(restored!.activeSchoolYearId, 20);
	assert.equal(restored!.activeSchoolYearLabel, 'SY 2026-2027');
	assert.equal(restored!.previousSchoolYearId, 19);
	assert.equal(restored!.previousSchoolYearLabel, 'SY 2025-2026');
	assert.match(restored!.changedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('rollover notices are school-scoped with no cross-school leakage', () => {
	persistRolloverAwarenessNotice(createRolloverAwarenessNotice({
		schoolId: 7, activeSchoolYearId: 20, activeSchoolYearLabel: 'A',
		previousSchoolYearId: 19, previousSchoolYearLabel: 'B',
	}));
	assert.notEqual(rolloverNoticeCacheKey(7), rolloverNoticeCacheKey(8));
	assert.ok(rolloverNoticeCacheKey(7).includes(':7'));
	assert.equal(readRolloverAwarenessNotice(7)?.schoolId, 7);
	assert.equal(readRolloverAwarenessNotice(8), null, 'a different school sees no notice');
});

test('malformed or mismatched stored notices are rejected', () => {
	store.set(rolloverNoticeCacheKey(7), '{not json');
	assert.equal(readRolloverAwarenessNotice(7), null);
	store.set(rolloverNoticeCacheKey(7), JSON.stringify({
		schoolId: 8, activeSchoolYearId: 20, activeSchoolYearLabel: 'A',
		previousSchoolYearId: 19, previousSchoolYearLabel: 'B', changedAt: '2026-09-10T00:00:00.000Z',
	}));
	assert.equal(readRolloverAwarenessNotice(7), null, 'payload scoped to another school is rejected');
});

test('a verified transition only fires when an earlier year existed and changed', () => {
	const first = evaluateRolloverTransition({
		schoolId: 7,
		previous: { id: null, label: null },
		next: { id: 20, label: 'SY 2026-2027' },
	});
	assert.equal(first.changed, false, 'first verified read must not show a false rollover notice');
	assert.equal(first.notice, null);

	const duplicate = evaluateRolloverTransition({
		schoolId: 7,
		previous: { id: 20, label: 'SY 2026-2027' },
		next: { id: 20, label: 'SY 2026-2027' },
	});
	assert.equal(duplicate.changed, false, 'a duplicate event does not rebind the route');
});

test('a real year change produces a school-scoped notice naming both years', () => {
	const transition = evaluateRolloverTransition({
		schoolId: 9,
		previous: { id: 19, label: 'SY 2025-2026' },
		next: { id: 20, label: 'SY 2026-2027' },
	});
	assert.equal(transition.changed, true);
	assert.ok(transition.notice);
	assert.equal(transition.notice!.schoolId, 9);
	assert.equal(transition.notice!.activeSchoolYearLabel, 'SY 2026-2027');
	assert.equal(transition.notice!.previousSchoolYearLabel, 'SY 2025-2026');
	assert.equal(transition.notice!.previousSchoolYearId, 19);
});

test('sensitivity: without recording the verified year, a stale duplicate looks like another change', () => {
	// Prior stale-session behavior resolved the school-year context but never
	// advanced an in-memory "verified year" ref, so a repeated event could be
	// mistaken for a fresh transition and trigger another refresh/remount.
	const stalePrevious = { id: null, label: null };
	const first = evaluateRolloverTransition({ schoolId: 7, previous: stalePrevious, next: { id: 20, label: 'A' } });
	const second = evaluateRolloverTransition({ schoolId: 7, previous: stalePrevious, next: { id: 20, label: 'A' } });
	assert.equal(first.changed, false);
	assert.equal(second.changed, false, 'no fabricated transition when no prior verified year exists');
	// Once the ref advances, the same duplicate is correctly a no-op.
	const advanced = { id: 20, label: 'A' };
	assert.equal(
		evaluateRolloverTransition({ schoolId: 7, previous: advanced, next: { id: 20, label: 'A' } }).changed,
		false,
	);
	// And a genuinely new year does fire exactly once.
	assert.equal(
		evaluateRolloverTransition({ schoolId: 7, previous: advanced, next: { id: 21, label: 'B' } }).changed,
		true,
	);
});
