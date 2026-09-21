/**
 * DUP-READ-CALLERS-C01 — A3 in-flight registry for `runtime/rollover-status`.
 *
 * `fetchRolloverStatus` was raw per-call axios with zero dedup, and the
 * Timetable route can mount two `RolloverGuidanceCard`s at once. The card
 * mounts with `includeCounts=false` but reloads with `includeCounts=true`, so
 * the registry must be keyed by `schoolId` **and** `includeCounts` — a
 * school-only key could serve a count-less payload to a counts caller.
 *
 * This suite counts REAL `/runtime/rollover-status` dispatches. Run:
 *   `npx tsx --test src/lib/__tests__/dup-read-rollover-status-dedup.test.ts`
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
import { fetchRolloverStatus, type RolloverStatus } from '@/lib/settings';

type RecordedCall = { params?: Record<string, unknown> };
let rolloverCalls: RecordedCall[] = [];
let rolloverResponder: (() => Promise<unknown>) | null = null;

(atlasApi as unknown as { get: (url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: unknown }> }).get =
	async (url: string, config?: { params?: Record<string, unknown> }) => {
		if (url === '/runtime/rollover-status') {
			rolloverCalls.push({ params: config?.params });
			if (!rolloverResponder) throw new Error('test rollover responder not installed');
			return { data: await rolloverResponder() };
		}
		return { data: {} };
	};

(atlasApi as unknown as { post: (url: string, body?: unknown) => Promise<{ data: unknown }> }).post =
	async () => ({ data: {} });

function statusFor(schoolId: number, includeCounts: boolean): RolloverStatus {
	return {
		schoolId,
		atlasSchoolYearId: 7001,
		enrollProActiveYear: null,
		drift: 'aligned',
		mirror: null,
		...(includeCounts
			? { counts: { facultyCount: 12, sectionCount: 7, settingsReachable: true } }
			: {}),
		conflicts: [],
		reconfiguredSections: [],
	} as unknown as RolloverStatus;
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
	rolloverCalls = [];
	rolloverResponder = null;
	sessionStorageShim.clear();
	localStorageShim.clear();
});

// ── S3-a: two concurrent callers for one (school, includeCounts) ────────────

test('S3-a two concurrent callers for one (schoolId, includeCounts) dispatch exactly one request', async () => {
	const gate = deferred<unknown>();
	rolloverResponder = () => gate.promise;

	const a = fetchRolloverStatus(21, false);
	const b = fetchRolloverStatus(21, false);
	await tick();
	assert.equal(rolloverCalls.length, 1, 'the concurrent pair shares one rollover-status request');
	assert.deepEqual(rolloverCalls[0].params, { schoolId: 21, includeCounts: false });

	gate.resolve(statusFor(21, false));
	const [ra, rb] = await Promise.all([a, b]);
	assert.equal(ra.schoolId, 21);
	assert.equal(rb.schoolId, 21);
	assert.equal(rolloverCalls.length, 1, 'no duplicate dispatch after both settle');
});

// ── S3-b: differing includeCounts stay independent ──────────────────────────

test('S3-b differing includeCounts stay independent and keep their own query parameters', async () => {
	const gateNoCounts = deferred<unknown>();
	rolloverResponder = () => gateNoCounts.promise;
	const withoutCounts = fetchRolloverStatus(22, false);
	await tick();

	const gateCounts = deferred<unknown>();
	rolloverResponder = () => gateCounts.promise;
	const withCounts = fetchRolloverStatus(22, true);
	await tick();

	assert.equal(rolloverCalls.length, 2, 'the includeCounts axis is part of the key');
	assert.deepEqual(rolloverCalls[0].params, { schoolId: 22, includeCounts: false });
	assert.deepEqual(rolloverCalls[1].params, { schoolId: 22, includeCounts: true });

	gateNoCounts.resolve(statusFor(22, false));
	gateCounts.resolve(statusFor(22, true));
	const noCountsResult = await withoutCounts;
	const countsResult = await withCounts;
	assert.equal(noCountsResult.counts, undefined, 'the count-less caller never receives a counts payload');
	assert.equal(countsResult.counts?.facultyCount, 12, 'the counts caller receives its own counts payload');
});

// ── S3-c: a rejection clears the entry ──────────────────────────────────────

test('S3-c a rejected rollover-status request clears the in-flight entry', async () => {
	rolloverResponder = () => Promise.reject(new Error('rollover-status unavailable'));
	const failed = fetchRolloverStatus(23, false);
	const failedSettled = failed.then(() => 'resolved', () => 'rejected');
	await tick();
	assert.equal(rolloverCalls.length, 1);
	assert.equal(await failedSettled, 'rejected');

	rolloverResponder = async () => statusFor(23, false);
	const recovered = await fetchRolloverStatus(23, false);
	assert.equal(recovered.schoolId, 23, 'the cleared entry permits a fresh dispatch');
	assert.equal(rolloverCalls.length, 2);
});

// ── S3-d: an omitted includeCounts equals its explicit default ──────────────

test('S3-d an omitted includeCounts shares with an explicit includeCounts:false caller', async () => {
	const gate = deferred<unknown>();
	rolloverResponder = () => gate.promise;

	const implied = fetchRolloverStatus(24);
	const explicit = fetchRolloverStatus(24, false);
	await tick();
	assert.equal(rolloverCalls.length, 1, 'the absent default normalizes to includeCounts:false');

	gate.resolve(statusFor(24, false));
	assert.equal((await implied).schoolId, 24);
	assert.equal((await explicit).schoolId, 24);
});

// ── S3-e: preservation — sequential calls are not served stale in-flight ────

test('S3-e a settled request is not reused by a later caller in the same scope', async () => {
	rolloverResponder = async () => statusFor(25, false);
	const first = await fetchRolloverStatus(25, false);
	assert.equal(first.schoolId, 25);
	assert.equal(rolloverCalls.length, 1);

	const second = await fetchRolloverStatus(25, false);
	assert.equal(second.schoolId, 25);
	assert.equal(rolloverCalls.length, 2, 'a settled entry is cleared, so a later caller re-dispatches');
});
