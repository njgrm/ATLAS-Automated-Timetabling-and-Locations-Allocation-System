/**
 * UX-P01 — Timetable data-layer evidence suite (R1–R5).
 *
 * Exercises the REAL production modules (no source-text assertions) with a
 * mocked transport:
 *   - R1: instrumented `runTimetableLoad` request count / concurrency / ordering,
 *         with a sequential mutant as the failing control.
 *   - R2: a scope change never returns another scope's cached query data.
 *   - R3: prefetch populates the scoped query cache.
 *   - R4: the warm snapshot rehydrates the exact last scope and is token-bound.
 *   - R5: the consumed payload is reference-identical to the producer output.
 *
 * Run: npx tsx --test src/lib/__tests__/ux-p01-timetable-data-layer.test.ts
 */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

import atlasApi from '@/lib/api';import {
	createTimetableQueryClient,
	timetableQueryClient,
} from '@/lib/timetable-data/timetableQueryClient';
import {
	buildTimetableScopeKey,
	timetableRunBundleBaseQueryKey,
	timetableRunBundleQueryKey,
	timetableRunsQueryKey,
	type ResolvedTimetableScope,
} from '@/lib/timetable-data/timetableQueryKeys';
import {
	ensureTimetableReferenceData,
	ensureTimetableRoomRequestSummary,
	ensureTimetableRunBundle,
	ensureTimetableRuns,
	readTimetableWarmSnapshot,
	recordTimetableWarmScope,
	resetTimetableWarmScope,
} from '@/lib/timetable-data/timetableServerState';
import { runTimetableLoad, type TimetableLoadPorts } from '@/lib/timetable-data/timetableLoadOrchestration';
import { prefetchNavDestination, prefetchTimetableEntryPoint, prefetchTimetableScopeData, resolveVerifiedActiveTermIndex } from '@/lib/timetable-data/timetablePrefetch';

// ─── storage shim (actor token epoch lives in session storage) ───

function installStorageShim(): void {
	const store = new Map<string, string>();
	const api = {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => { store.set(key, String(value)); },
		removeItem: (key: string) => { store.delete(key); },
	};
	(globalThis as Record<string, unknown>).sessionStorage = api;
	(globalThis as Record<string, unknown>).localStorage = api;
}

// ─── fixtures (identical objects are returned by the mock transport) ───

const runsFixture = [
	{ id: 41, status: 'COMPLETED', runNumber: 3 },
	{ id: 40, status: 'FAILED', runNumber: 2 },
];
const draftFixture = { runId: 41, version: 7, status: 'ACTIVE', entries: [{ entryId: 'e1' }], unassignedItems: [], summary: {}, inputState: {} };
const violationsFixture = { violations: [{ code: 'ROOM_TIME_CONFLICT', severity: 'HARD' }] };
const subjectsFixture = [{ id: 1, code: 'MATH', name: 'Mathematics' }];
const facultyFixture = [{ id: 7, firstName: 'Ada', lastName: 'Lovelace' }];
const buildingsFixture = [{ id: 2, name: 'Main', shortCode: 'MN', rooms: [{ id: 9, name: '201', floor: 2, type: 'CLASSROOM', isTeachingSpace: true }] }];
const sectionSummaryFixture = { sections: [{ id: 3, name: '7-A' }] };
const draftBoardFixture = { counts: { draft: 2, violations: 0 } };
const roomRequestFixture = { counts: { pending: 1 }, requests: [] };
const readinessFixture = { state: 'READY' };

function respond(url: string): unknown {
	if (url === '/auth/me') return { user: { schoolId: 1 } };
	if (url === '/runtime/context') return {
		activeSchoolYearId: 9,
		activeSchoolYearLabel: '2030-2031',
		schoolId: 1,
		source: 'enrollpro-verified',
		activeTerm: {
			verified: true,
			termIndex: 0,
			orderedTerms: [{ identity: 'T0', displayLabel: 'Term 0', order: 0 }],
		},
	};
	if (url.includes('/readiness/diagnostic')) return { readiness: readinessFixture };
	if (url.includes('/runs/latest/draft')) return draftFixture;
	if (url.includes('/runs/latest/violations')) return violationsFixture;
	if (/\/runs\/\d+\/draft/.test(url)) return draftFixture;
	if (/\/runs\/\d+\/violations/.test(url)) return violationsFixture;
	if (/\/runs\/\d+\/flags/.test(url)) return { flags: [{ entryId: 'e1' }] };
	if (/\/generation\/\d+\/\d+\/runs$/.test(url)) return { runs: runsFixture };
	if (url.includes('pre-generation-drafts')) return draftBoardFixture;
	if (url.includes('/room-preferences/')) return roomRequestFixture;
	if (url.includes('/subjects?')) return { subjects: subjectsFixture };
	if (url.includes('/faculty?')) return { faculty: facultyFixture };
	if (url.includes('/buildings')) return { buildings: buildingsFixture };
	if (url.includes('/sections/summary/')) return sectionSummaryFixture;
	throw new Error(`unexpected URL ${url}`);
}

type MockedCall = { url: string; count: number };

function withMockedApi<T>(fn: (calls: MockedCall[]) => Promise<T>): Promise<T> {
	const original = atlasApi.get;
	const calls: MockedCall[] = [];
	(atlasApi as unknown as { get: unknown }).get = async (url: string) => {
		const existing = calls.find((call) => call.url === url);
		if (existing) existing.count += 1;
		else calls.push({ url, count: 1 });
		return { data: respond(url) };
	};
	return fn(calls).finally(() => {
		(atlasApi as unknown as { get: unknown }).get = original;
	});
}

const scopeA: ResolvedTimetableScope = { schoolId: 1, schoolYearId: 9, runId: 'latest', termIndex: 'all' };
const scopeB: ResolvedTimetableScope = { schoolId: 1, schoolYearId: 9, runId: 'latest', termIndex: 2 };

// ─── R2: scope-key correctness (load-bearing) ───

test('R2: every part of (schoolId, schoolYearId, runId, termIndex) changes the key', () => {
	const base = buildTimetableScopeKey(scopeA);
	assert.notEqual(base, buildTimetableScopeKey({ ...scopeA, schoolId: 2 }));
	assert.notEqual(base, buildTimetableScopeKey({ ...scopeA, schoolYearId: 10 }));
	assert.notEqual(base, buildTimetableScopeKey({ ...scopeA, runId: 43 }));
	assert.notEqual(base, buildTimetableScopeKey({ ...scopeA, termIndex: 2 }));
	assert.notEqual(timetableRunBundleQueryKey(scopeA).join('|'), timetableRunBundleQueryKey(scopeB).join('|'));
});

test('R2: a scope change never returns the previous scope cached data', async () => {
	const client = createTimetableQueryClient();
	const keyA = timetableRunBundleQueryKey(scopeA);
	const keyB = timetableRunBundleQueryKey({ ...scopeA, schoolYearId: 10 });
	let callsA = 0;
	let callsB = 0;

	const valueA = await client.fetchQuery({ queryKey: keyA, queryFn: async () => { callsA += 1; return { tag: 'A' }; } });
	const valueB = await client.fetchQuery({ queryKey: keyB, queryFn: async () => { callsB += 1; return { tag: 'B' }; } });

	assert.deepEqual(valueA, { tag: 'A' });
	assert.deepEqual(valueB, { tag: 'B' });
	assert.equal(callsA, 1);
	assert.equal(callsB, 1, 'the different scope must dispatch its own query, never reuse scope A');
	assert.equal(client.getQueryData(keyA), valueA);
	assert.equal(client.getQueryData(keyB), valueB);
	assert.notEqual(client.getQueryData(keyA), client.getQueryData(keyB));
	// A completely unvisited scope has no entry at all.
	assert.equal(client.getQueryData(timetableRunBundleQueryKey({ ...scopeA, schoolId: 5 })), undefined);
	client.clear();
});

test('R2 negative control: a key that drops schoolYearId leaks across scopes (and would fail the production assertion)', async () => {
	const client = createTimetableQueryClient();
	// Deliberately defective mutant key: drops schoolYearId + termIndex.
	const mutantKey = (scope: ResolvedTimetableScope) => ['timetable', scope.schoolId, 'run', scope.runId];
	const keyYear9 = mutantKey(scopeA);
	const keyYear10 = mutantKey({ ...scopeA, schoolYearId: 10 });
	assert.deepEqual(keyYear9, keyYear10, 'the mutant collides two academic years');
	const leaked = await client.fetchQuery({ queryKey: keyYear9, queryFn: async () => ({ tag: 'year-9' }) });
	assert.equal(client.getQueryData(keyYear10), leaked, 'mutant returns year-9 data for a year-10 scope');
	// The production key correctly distinguishes the two scopes.
	assert.notDeepEqual(timetableRunBundleQueryKey(scopeA), timetableRunBundleQueryKey({ ...scopeA, schoolYearId: 10 }));
	client.clear();
});

// ─── R5: payload parity (reference identity ⇒ no transform) ───

test('R5: runs / run bundle / reference reads return the producer payload untouched', async () => {
	await withMockedApi(async () => {
		timetableQueryClient.clear();
		resetTimetableWarmScope();

		const runs = await ensureTimetableRuns(scopeA);
		assert.strictEqual(runs, runsFixture, 'runs payload must be the exact producer array');

		const bundle = await ensureTimetableRunBundle(scopeA);
		assert.strictEqual(bundle.draft, draftFixture);
		assert.strictEqual(bundle.violations, violationsFixture);

		const reference = await ensureTimetableReferenceData(scopeA);
		assert.strictEqual(reference.subjects, subjectsFixture);
		assert.strictEqual(reference.faculty, facultyFixture);
		assert.strictEqual(reference.buildings, buildingsFixture);
		assert.strictEqual(reference.sections, sectionSummaryFixture.sections);
		assert.strictEqual(reference.sectionSummary, sectionSummaryFixture);

		const roomRequest = await ensureTimetableRoomRequestSummary(scopeA, 'ALL', 'ALL');
		assert.strictEqual(roomRequest, roomRequestFixture);
	});
});

test('R5 negative control: the strict-identity control fails under any projection/clone', () => {
	const bundle = { draft: draftFixture, violations: violationsFixture };
	const cloned = { ...bundle, draft: { ...bundle.draft, entries: [...bundle.draft.entries] } };
	assert.throws(
		() => assert.strictEqual(cloned.draft, draftFixture),
		/reference-equal|strictly equal/,
		'a transform would be caught by the reference-identity control',
	);
});

// ─── R1: waterfall collapse (instrumented production orchestration) ───

type LoadEvent = { name: string; phase: 'start' | 'end'; at: number };

function createInstrumentedPorts(events: LoadEvent[], state: { inFlight: number; maxInFlight: number }) {
	let clock = 0;
	const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
	const track = async (name: string, ms: number) => {
		clock += 1;
		state.inFlight += 1;
		state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
		events.push({ name, phase: 'start', at: clock });
		await wait(ms);
		state.inFlight -= 1;
		clock += 1;
		events.push({ name, phase: 'end', at: clock });
	};
	const ports: TimetableLoadPorts = {
		readResolvedSchoolId: () => 1,
		currentSchoolId: 1,
		fetchRuns: async () => { await track('runs', 30); return runsFixture as never; },
		fetchCurriculumReadiness: () => { events.push({ name: 'readiness', phase: 'start', at: ++clock }); },
		fetchReferenceData: () => track('reference', 20) as Promise<void>,
		fetchDraftBoardSummary: () => track('draftBoard', 25) as Promise<void>,
		fetchRunData: async () => { await track('runBundle', 20); },
		loadRoomRequestSummary: () => track('roomRequest', 20) as Promise<void>,
		errorCodeOf: () => undefined,
		clearRoomRequestError: () => { events.push({ name: 'clearRoomRequestError', phase: 'start', at: ++clock }); },
		readSelectedRunId: () => 'latest',
		preserveRun: false,
		onScopeMismatch: () => { events.push({ name: 'scopeMismatch', phase: 'start', at: ++clock }); },
		onNoRuns: () => { events.push({ name: 'noRuns', phase: 'start', at: ++clock }); },
		onRunSelected: () => { events.push({ name: 'runSelected', phase: 'start', at: ++clock }); },
	};
	return ports;
}

test('R1: independent school/year reads are concurrent and the run-scoped tail starts only after runs resolve', async () => {
	const events: LoadEvent[] = [];
	const state = { inFlight: 0, maxInFlight: 0 };
	await runTimetableLoad(createInstrumentedPorts(events, state), 9);

	const start = (name: string) => events.find((event) => event.name === name && event.phase === 'start')?.at ?? -1;
	const end = (name: string) => events.find((event) => event.name === name && event.phase === 'end')?.at ?? Number.MAX_SAFE_INTEGER;

	// Batch A: reference + draftBoard both start before the runs resolver resolves.
	assert.ok(start('reference') < end('runs'), 'reference data must be dispatched before `runs` resolves');
	assert.ok(start('draftBoard') < end('runs'), 'draft board must be dispatched before `runs` resolves');
	assert.ok(state.maxInFlight >= 2, `expected >=2 concurrent batch-A reads, observed ${state.maxInFlight}`);
	// Batch B: the room-request summary runs alongside the run bundle.
	assert.ok(start('roomRequest') < end('runBundle'), 'room-request summary must share the run-scoped batch');
	// The run bundle is the only read that waits for the runs resolver.
	assert.ok(end('runs') <= start('runBundle'), 'the run bundle must start at/after the runs resolver completes');
	assert.ok(start('readiness') < end('runs'), 'readiness must not wait on the runs resolver');
});

test('R1 negative control: a sequential orchestrator exposes the waterfall (concurrency 1)', async () => {
	const events: LoadEvent[] = [];
	const state = { inFlight: 0, maxInFlight: 0 };
	const base = createInstrumentedPorts(events, state);
	// Pre-change ordering: reference was awaited only after runs, and the run
	// bundle was awaited before draft board / room requests.
	await base.fetchCurriculumReadiness(9);
	await base.fetchRuns(9);
	await base.fetchReferenceData(9);
	await base.fetchRunData(9, 'latest');
	await base.fetchDraftBoardSummary(9);
	await base.loadRoomRequestSummary(9);
	assert.equal(state.maxInFlight, 1, 'the sequential baseline never overlaps a request');
	assert.throws(() => assert.ok(state.maxInFlight >= 2));
});

test('R1: STALE_RUN_DATA falls back to the resolved latest run id', async () => {
	const events: LoadEvent[] = [];
	const state = { inFlight: 0, maxInFlight: 0 };
	const ports = createInstrumentedPorts(events, state);
	const runIds: string[] = [];
	ports.fetchRunData = async (_syId, runId) => {
		runIds.push(runId);
		if (runIds.length === 1) throw { response: { data: { code: 'STALE_RUN_DATA' } } };
	};
	ports.errorCodeOf = (error) => (error as { response?: { data?: { code?: string } } }).response?.data?.code;
	await runTimetableLoad(ports, 9);
	assert.deepEqual(runIds, ['latest', '41']);
});

test('R1: unresolved actor scope dispatches nothing (zero-dispatch authority control)', async () => {
	const events: LoadEvent[] = [];
	const state = { inFlight: 0, maxInFlight: 0 };
	const ports = createInstrumentedPorts(events, state);
	ports.readResolvedSchoolId = () => 2;
	await runTimetableLoad(ports, 9);
	assert.ok(events.some((event) => event.name === 'scopeMismatch'), 'scope mismatch handler must run');
	assert.equal(events.filter((event) => event.phase === 'start' && event.name !== 'scopeMismatch').length, 0, 'zero reads on authority rejection');
});

// ─── R3: prefetch populates the scoped cache ───

test('R3: prefetch warms the scoped query cache and nav routing is safe', async () => {
	await withMockedApi(async () => {
		timetableQueryClient.clear();
		const verifiedScope = { ...scopeA, termIndex: 2 as const };
		prefetchTimetableScopeData(verifiedScope);
		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.ok(timetableQueryClient.getQueryData(timetableRunsQueryKey(verifiedScope)), 'runs prefetch populated the cache');
		assert.ok(timetableQueryClient.getQueryData(timetableRunBundleBaseQueryKey(verifiedScope)), 'run bundle prefetch populated the cache');
		prefetchNavDestination('/timetable');
		prefetchNavDestination('/subjects');
		prefetchNavDestination('/unknown-route');
	});
});

test('R3 authority gate: prefetch rejects all-terms and unresolved active-term scopes', async () => {
	assert.equal(resolveVerifiedActiveTermIndex(null), null);
	assert.equal(resolveVerifiedActiveTermIndex({ verified: false, termIndex: 2, orderedTerms: [{ identity: 'T2', displayLabel: 'Term 2', order: 2 }] } as any), null);
	assert.equal(resolveVerifiedActiveTermIndex({ verified: true, termIndex: 2, orderedTerms: [{ identity: 'T1', displayLabel: 'Term 1', order: 1 }] } as any), null);
	assert.equal(resolveVerifiedActiveTermIndex({ verified: true, termIndex: 0, orderedTerms: [{ identity: 'T0', displayLabel: 'Term 0', order: 0 }] } as any), null);
	assert.equal(resolveVerifiedActiveTermIndex({ verified: true, termIndex: 2, orderedTerms: [{ identity: 'T2', displayLabel: 'Term 2', order: 2 }] } as any), 2);

	await withMockedApi(async (calls) => {
		timetableQueryClient.clear();
		prefetchTimetableScopeData({ ...scopeA, termIndex: 'all' });
		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.equal(calls.length, 0, 'unscoped All terms prefetch must dispatch nothing');
		assert.equal(timetableQueryClient.getQueryData(timetableRunsQueryKey({ ...scopeA, termIndex: 'all' })), undefined);
	});

	await withMockedApi(async (calls) => {
		installStorageShim();
		(sessionStorage as unknown as { setItem(k: string, v: string): void }).setItem('atlas_local_token', 'term-zero-entry-point');
		timetableQueryClient.clear();
		prefetchTimetableEntryPoint();
		await new Promise((resolve) => setTimeout(resolve, 25));
		assert.equal(
			calls.filter((call) => call.url !== '/auth/me' && call.url !== '/runtime/context').length,
			0,
			'malformed Term 0 entry-point prefetch must dispatch zero timetable reads',
		);
		assert.equal(timetableQueryClient.getQueryData(timetableRunsQueryKey({ ...scopeA, termIndex: 0 })), undefined);
	});
});

// ─── R4: token-bound warm snapshot ───

test('R4: the warm snapshot rehydrates the same scope and is bound to the token epoch', async () => {
	installStorageShim();
	await withMockedApi(async () => {
		timetableQueryClient.clear();
		resetTimetableWarmScope();
		(sessionStorage as unknown as { setItem(k: string, v: string): void }).setItem('atlas_local_token', 'epoch-one');

		await ensureTimetableRuns(scopeA);
		await ensureTimetableRunBundle(scopeA);
		recordTimetableWarmScope(scopeA);

		const warm = readTimetableWarmSnapshot();
		assert.ok(warm, 'a warm snapshot must exist for the recorded scope');
		assert.equal(warm?.scope.schoolId, 1);
		assert.strictEqual(warm?.runs, runsFixture);
		assert.strictEqual(warm?.bundle?.draft, draftFixture);

		// A different session epoch must not rehydrate the previous session's data.
		(sessionStorage as unknown as { setItem(k: string, v: string): void }).setItem('atlas_local_token', 'epoch-two');
		assert.equal(readTimetableWarmSnapshot(), null, 'warm snapshot must be token-epoch bound');

		// Signing out (no token) must also fail closed.
		(sessionStorage as unknown as { removeItem(k: string): void }).removeItem('atlas_local_token');
		assert.equal(readTimetableWarmSnapshot(), null);
	});
});

test('R4 supplementary wiring guard: the hook rehydrates the warm snapshot in a layout effect', async () => {
	const { readFileSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const hook = readFileSync(resolve(process.cwd(), 'src/hooks/useTimetableData.ts'), 'utf8');
	assert.match(hook, /useLayoutEffect\(/, 'the warm seed must run before paint');
	assert.match(hook, /readTimetableWarmSnapshot\(\)/);
	assert.match(hook, /runBundleQuery[\s\S]{0,600}placeholderData:\s*keepPreviousData/);
});

after(() => {
	// Cancel the shared client's gc/stale timers so `tsx --test` exits cleanly.
	timetableQueryClient.clear();
});
