import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { createScopeEpoch } from '@/lib/scope-request-epoch';
import {
	createDiagnosticsLoadingOwnership,
	createDispatchPrecedence,
	terminateDiagnosticsLoadingForLatestDispatch,
} from '@/hooks/useTeachingLoadData';
import { TooltipProvider } from '@/ui/tooltip';
import { TeachingLoadTruthPanel } from '@/components/faculty-assignments/TeachingLoadTruthPanel';
import {
	buildTeachingLoadTruthModel,
	isKnown,
	type TeachingLoadAuthorityDiagnosticsPayload,
} from '@/lib/teaching-load-authority-truth';

/**
 * C-5 / F2-COLD-LOAD — the authority-diagnostics read must survive a COLD-CACHE
 * first load.
 *
 * Defect (post-integration Wave Completion Auditor): the epoch was opened by a
 * render-time scope effect that ran AFTER `fetchData` captured its token, so the
 * scope-resolving first reply was discarded and the loading flag never cleared —
 * the R3 truth panel stayed on "Checking source" with every metric unknown on the
 * first load.
 *
 * This control drives the real production seams (`openDiagnosticsScope` /
 * `loadAuthorityDiagnosticsForScope`, which `useTeachingLoadData.fetchData`
 * calls) and renders the real `TeachingLoadTruthPanel` through the established
 * `renderToStaticMarkup` harness (the r3-truth pattern).
 *
 * Harness note: this repository has no DOM implementation (no jsdom /
 * react-test-renderer / happy-dom / @testing-library/react) and dependencies are
 * frozen, so a DOM-mounted hook render is not available. The production loader is
 * therefore driven directly and the rendered assertions exercise the real panel
 * component.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
function source(relativePath: string): string {
	return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

const SCOPE_A = '1:9';
const SCOPE_B = '1:10';

function installEmptyLocalStorage(): Map<string, string> {
	const store = new Map<string, string>();
	(globalThis as unknown as { localStorage: unknown }).localStorage = {
		getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
		setItem: (key: string, value: string) => { store.set(key, String(value)); },
		removeItem: (key: string) => { store.delete(key); },
		clear: () => store.clear(),
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		get length() { return store.size; },
	};
	return store;
}

function diagnostics(): TeachingLoadAuthorityDiagnosticsPayload {
	return {
		schoolId: 1,
		schoolYearId: 9,
		sourceRevision: 'rev-cold-load',
		fingerprint: 'fp-cold-load',
		generatedAt: '2031-01-01T00:00:00.000Z',
		demandedSubjectSectionPairs: [
			{ key: '21:1001', subjectId: 21, subjectCode: 'FIL', sectionId: 1001, gradeLevel: 7, programType: 'REGULAR', weeklyMinutes: 240 },
			{ key: '22:1001', subjectId: 22, subjectCode: 'ESP', sectionId: 1001, gradeLevel: 7, programType: 'REGULAR', weeklyMinutes: 240 },
		],
		ownedSubjectSectionPairs: [
			{ ownershipId: 1, pairKey: '21:1001', subjectId: 21, subjectCode: 'FIL', sectionId: 1001, facultyId: 101 },
		],
		unownedActiveFaculty: [{ facultyId: 103, name: 'Zero Load Filipino', department: 'FIL', specialization: null }],
		validAdviserMappings: [{ facultyId: 101, name: 'Adviser One', sectionId: 1001 }],
		legacyHgOwnershipRows: [],
		advisoryCreditEligibility: [{ facultyId: 101, name: 'Adviser One', sectionId: 1001, eligible: true, creditMinutes: 300, reason: 'ELIGIBLE' }],
		overloadCapacityTotals: {
			policyStatus: 'CONFIGURED',
			teachingStandardMinutes: 1800,
			hardCapMinutes: 2400,
			beforeTeachingMinutes: 3600,
			afterTeachingMinutes: 3600,
			beforeOverStandardCount: 1,
			afterOverStandardCount: 1,
			beforeOverHardCapCount: 1,
			afterOverHardCapCount: 1,
			capacityMinutes: 7200,
			beforeExcessMinutes: 1800,
		},
		candidateCountsByDepartment: [],
		unresolvedReasons: [],
	};
}

/** A controllable in-flight request for the diagnostics read. */
function deferredRequest() {
	let resolve!: (value: { data: TeachingLoadAuthorityDiagnosticsPayload }) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<{ data: TeachingLoadAuthorityDiagnosticsPayload }>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { request: (): Promise<{ data: TeachingLoadAuthorityDiagnosticsPayload }> => promise, resolve, reject };
}

/* ================================================================== *
 * 1-2, 6 — cold load persists, clears loading, and never writes
 * ================================================================== */

test('C-5 cold load: an empty-cache scope resolution persists diagnostics and clears loading', async () => {
	const store = installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');
	assert.equal(store.size, 0, 'the faculty-teaching-load cache must start empty (cold load)');

	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	let payload: TeachingLoadAuthorityDiagnosticsPayload | null = null;
	let loading = false;
	const inflight = deferredRequest();
	const loadingOwnership = createDiagnosticsLoadingOwnership();

	const inFlight = loadAuthorityDiagnosticsForScope({
		epoch,
		scopeRef,
		scopeId: SCOPE_A,
		request: inflight.request,
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
		loadingOwnership,
		loadingOwnerId: 1,
		isLatestDispatch: () => true,
	});
	assert.equal(loading, true, 'the read must mark itself loading');

	// Modelled scope-reset effect while the request is in flight. In the fixed
	// code it clears the panel state only; it MUST NOT open an epoch, because that
	// ordering is exactly what killed the cold-cache first load.
	payload = null;

	inflight.resolve({ data: diagnostics() });
	const outcome = await inFlight;

	assert.equal(outcome, 'persisted', 'the scope-resolving reply must be persisted');
	assert.notEqual(payload, null, 'the diagnostics payload must reach hook state');
	assert.equal(loading, false, 'the loading flag must clear after the scope resolves');
	assert.equal(store.size, 0, 'the diagnostics read must not write to the faculty-teaching-load cache');
});

test('C-5 zero-write: the diagnostics read stays a read-only GET', () => {
	const hook = source('src/hooks/useTeachingLoadData.ts');
	// Read-only GET only.
	assert.match(hook, /'\/faculty-assignments\/authority-diagnostics'/);
	assert.doesNotMatch(hook, /atlasApi\.post\(/);
	assert.doesNotMatch(hook, /atlasApi\.put\(/);
	assert.doesNotMatch(hook, /atlasApi\.patch\(/);
	assert.doesNotMatch(hook, /atlasApi\.delete\(/);
	// It must never call the auto-creating policy endpoint.
	assert.doesNotMatch(hook, /policies\/scheduling/);
	// The loader itself has no transport at all.
	const start = hook.indexOf('export async function loadAuthorityDiagnosticsForScope(');
	const end = hook.indexOf('export function useTeachingLoadData()');
	assert.ok(start >= 0 && end > start, 'the loader must be exported');
	const loader = hook.slice(start, end);
	assert.doesNotMatch(loader, /atlasApi|localStorage|setCached/);
});

/* ================================================================== *
 * 7 — the rendered panel leaves "Checking source"
 * ================================================================== */

test('C-5 cold load renders the truth panel with known metrics, never "Checking source"', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');

	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	let payload: TeachingLoadAuthorityDiagnosticsPayload | null = null;
	let loading = false;
	const inflight = deferredRequest();
	const loadingOwnership = createDiagnosticsLoadingOwnership();

	const inFlight = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: inflight.request,
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
		loadingOwnership,
		loadingOwnerId: 1,
		isLatestDispatch: () => true,
	});
	inflight.resolve({ data: diagnostics() });
	await inFlight;

	const resolved = payload as TeachingLoadAuthorityDiagnosticsPayload | null;
	const model = buildTeachingLoadTruthModel({
		diagnostics: resolved,
		placeholderFacultyIds: new Set<number>(),
		workloadPolicyStatus: 'CONFIGURED',
	});
	const markup = renderToStaticMarkup(
		createElement(TooltipProvider, null,
			createElement(TeachingLoadTruthPanel, {
				model,
				loading,
				sourceRevision: resolved?.sourceRevision ?? null,
				unresolvedReasons: [],
			}),
		),
	);

	assert.doesNotMatch(markup, /Checking source/, 'the panel must not be stuck on the loading badge');
	assert.match(markup, /Source verified/);
	assert.ok(isKnown(model.requiredPairs));
	assert.equal(model.requiredPairs.value, 2);
	assert.match(markup, /data-testid="teaching-load-truth-required-pairs" data-metric-state="known"/);
	assert.match(markup, />2</);
});

/* ================================================================== *
 * 2 — failure still clears loading
 * ================================================================== */

test('C-5 an in-flight read that fails still clears loading and renders the typed unknown state', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');

	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	let payload: TeachingLoadAuthorityDiagnosticsPayload | null = null;
	let loading = false;
	const inflight = deferredRequest();
	const loadingOwnership = createDiagnosticsLoadingOwnership();

	const inFlight = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: inflight.request,
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
		loadingOwnership,
		loadingOwnerId: 1,
		isLatestDispatch: () => true,
	});
	inflight.reject(new Error('diagnostics unavailable'));
	const outcome = await inFlight;

	assert.equal(outcome, 'cleared');
	assert.equal(payload, null);
	assert.equal(loading, false, 'a failed read must not leave the panel loading forever');

	const model = buildTeachingLoadTruthModel({ diagnostics: payload, workloadPolicyStatus: 'CONFIGURED' });
	const markup = renderToStaticMarkup(
		createElement(TooltipProvider, null, createElement(TeachingLoadTruthPanel, { model, loading, sourceRevision: null, unresolvedReasons: [] })),
	);
	assert.match(markup, /teaching-load-truth-policy-unknown/);
	assert.doesNotMatch(markup, /Checking source/);
});

/* ================================================================== *
 * 3 — resolving the SAME scope again does not self-invalidate
 * ================================================================== */

test('C-5 the same scope resolving twice does not open a new epoch and still persists', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };

	let payload: TeachingLoadAuthorityDiagnosticsPayload | null = null;
	let loading = false;
	const loadingOwnership = createDiagnosticsLoadingOwnership();
	const run = () => loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: async () => ({ data: diagnostics() }),
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
		loadingOwnership,
		loadingOwnerId: 1,
		isLatestDispatch: () => true,
	});

	assert.equal(await run(), 'persisted');
	const afterFirst = epoch.current;
	assert.equal(afterFirst, 1, 'the first resolution opens exactly one epoch');
	payload = null;
	loading = false;

	// Re-resolving the SAME scope must not invalidate the second read.
	assert.equal(await run(), 'persisted', 'a repeated identical scope must still persist');
	assert.equal(epoch.current, afterFirst, 'a repeated identical scope must not advance the epoch');
	assert.notEqual(payload, null);
	assert.equal(loading, false);
});

test('C-5 openDiagnosticsScope only opens an epoch on a real scope change', async () => {
	const { openDiagnosticsScope } = await import('@/hooks/useTeachingLoadData');
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };

	assert.equal(openDiagnosticsScope(scopeRef, epoch, SCOPE_A), true, 'the first resolution opens an epoch');
	const afterFirst = epoch.current;
	assert.equal(openDiagnosticsScope(scopeRef, epoch, SCOPE_A), false, 'the same scope must not re-open');
	assert.equal(epoch.current, afterFirst, 'a repeated identical scope must not advance the epoch');
	assert.equal(openDiagnosticsScope(scopeRef, epoch, SCOPE_B), true, 'a real scope change opens an epoch');
	assert.equal(epoch.current, afterFirst + 1);
});

/* ================================================================== *
 * 4-5 — a genuinely superseded scope is still discarded
 * ================================================================== */

test('C-5 adversarial: a reply from a superseded scope is discarded and never touches new-scope state', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');

	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	let payload: TeachingLoadAuthorityDiagnosticsPayload | null | string = 'CURRENT_SCOPE_STATE';
	let loading = false;
	const stale = deferredRequest();
	const loadingOwnership = createDiagnosticsLoadingOwnership();

	const staleLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: stale.request,
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
		loadingOwnership,
		loadingOwnerId: 1,
		isLatestDispatch: () => true,
	});

	// A real scope change: the new scope resolves and opens a new epoch.
	const current = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_B,
		request: () => new Promise(() => {}),
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
		loadingOwnership,
		loadingOwnerId: 2,
		isLatestDispatch: () => true,
	});

	// The obsolete reply lands LAST.
	stale.resolve({ data: diagnostics() });
	assert.equal(await staleLoad, 'discarded', 'a superseded-scope reply must be discarded');
	assert.equal(payload, 'CURRENT_SCOPE_STATE', 'a superseded reply must not overwrite the new scope payload');
	assert.equal(loading, true, 'a superseded reply must not clear the new scope loading flag');

	// Verified by scope identity AND by epoch advancement, not by counter alone.
	assert.equal(epoch.current > 0, true);
	assert.equal(scopeRef.current, SCOPE_B);
	void current;
});

test('C-5 a superseded failure cannot clear the current scope loading flag either', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');

	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	let payload: TeachingLoadAuthorityDiagnosticsPayload | null | string = 'CURRENT_SCOPE_STATE';
	let loading = false;
	const stale = deferredRequest();
	const loadingOwnership = createDiagnosticsLoadingOwnership();

	const staleLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: stale.request,
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
		loadingOwnership,
		loadingOwnerId: 1,
		isLatestDispatch: () => true,
	});
	const current = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_B,
		request: () => new Promise(() => {}),
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
		loadingOwnership,
		loadingOwnerId: 2,
		isLatestDispatch: () => true,
	});

	stale.reject(new Error('obsolete scope failed'));
	assert.equal(await staleLoad, 'discarded');
	assert.equal(payload, 'CURRENT_SCOPE_STATE');
	assert.equal(loading, true, 'an obsolete failure must not clear the new scope loading flag');
	void current;
});

/* ================================================================== *
 * C-6R2 — a superseded SAME-scope dispatch must be discarded
 * ================================================================== */

test('C-6R2 a superseded same-scope reply is discarded (the newer payload survives)', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');

	const precedence = createDispatchPrecedence();
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	let payload: TeachingLoadAuthorityDiagnosticsPayload | null = null;
	let loading = false;
	const inflight = deferredRequest();
	const loadingOwnership = createDiagnosticsLoadingOwnership();

	// The OLDER dispatch starts first, for SCOPE_A.
	const olderId = precedence.begin();
	const olderLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: inflight.request,
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
		loadingOwnership,
		loadingOwnerId: olderId,
		isLatestDispatch: () => precedence.isLatest(olderId),
	});
	assert.equal(loading, true, 'the older read marks itself loading');

	// The NEWER dispatch starts for the SAME scope and resolves FIRST.
	const newerId = precedence.begin();
	const newerPayload: TeachingLoadAuthorityDiagnosticsPayload = { ...diagnostics(), sourceRevision: 'rev-newer' };
	const newerLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: async () => ({ data: newerPayload }),
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
		loadingOwnership,
		loadingOwnerId: newerId,
		isLatestDispatch: () => precedence.isLatest(newerId),
	});
	assert.equal(await newerLoad, 'persisted', 'the newest dispatch persists');
	assert.equal((payload as TeachingLoadAuthorityDiagnosticsPayload | null)?.sourceRevision, 'rev-newer');
	assert.equal(loading, false);

	// The older reply lands LAST. Scope identity and epoch are UNCHANGED (same
	// scope, and `openDiagnosticsScope` is a no-op for it), so only dispatch
	// precedence can reject it.
	assert.equal(scopeRef.current, SCOPE_A, 'the fixture must keep one scope');
	inflight.resolve({ data: { ...diagnostics(), sourceRevision: 'rev-older' } });
	assert.equal(await olderLoad, 'discarded', 'a superseded same-scope reply must be discarded');
	assert.equal(
		(payload as TeachingLoadAuthorityDiagnosticsPayload | null)?.sourceRevision,
		'rev-newer',
		'the newer payload must survive the older reply',
	);
	assert.equal(loading, false, 'the older reply must not flip the loading flag');
});

/* ================================================================== *
 * C-6R3 — dispatch-scoped loading ownership
 *
 * Defect: `loadAuthorityDiagnosticsForScope` set loading true unconditionally and
 * only cleared it on its terminal path. `fetchData` engaged the loader only while
 * `isLatestDispatch()`, so when a newer dispatch superseded an older one and then
 * aborted BEFORE the diagnostics read (unresolved actor school or active year),
 * nothing owned the clear: the older reply was correctly discarded and the panel
 * stayed on "Checking source" forever.
 *
 * These controls drive the real production loader and the real production
 * ownership primitive (`createDiagnosticsLoadingOwnership` /
 * `terminateDiagnosticsLoadingForLatestDispatch`) that `fetchData` uses.
 * ================================================================== */

test('C-6R3 defect: a newest dispatch that aborts before the diagnostics read terminates the inherited claim', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');

	const precedence = createDispatchPrecedence();
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	const loadingOwnership = createDiagnosticsLoadingOwnership();
	let loading = false;
	const commit = (next: boolean) => { loading = next; };

	// D1 (older) resolves its scope and engages the diagnostics read.
	const d1 = precedence.begin();
	const inflight = deferredRequest();
	const olderLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: inflight.request,
		setPayload: () => {},
		setLoading: commit,
		loadingOwnership,
		loadingOwnerId: d1,
		isLatestDispatch: () => precedence.isLatest(d1),
	});
	assert.equal(loading, true, 'the older dispatch owns the loading flag');
	assert.equal(loadingOwnership.ownerId, d1);

	// D2 (newest) supersedes D1 and aborts BEFORE reaching the diagnostics read — it
	// never claims the flag, exactly like a fetch that throws while resolving actor
	// school or active year. This is the hook's `finally` handoff.
	const d2 = precedence.begin();
	assert.equal(
		terminateDiagnosticsLoadingForLatestDispatch(loadingOwnership, () => precedence.isLatest(d2), commit),
		true,
		'the newest dispatch terminates the inherited claim',
	);
	assert.equal(loadingOwnership.ownerId, null);
	assert.equal(loading, false, 'the panel must not stay stuck on "Checking source"');

	// D1's late reply is discarded and cannot re-own or clear anything.
	inflight.resolve({ data: diagnostics() });
	assert.equal(await olderLoad, 'discarded', 'the superseded reply is still discarded');
	assert.equal(loading, false);
});

test('C-6R3 the discarded older reply releases its own claim when the newest never reaches the loader', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');

	const precedence = createDispatchPrecedence();
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	const loadingOwnership = createDiagnosticsLoadingOwnership();
	const commits: boolean[] = [];

	const d1 = precedence.begin();
	const inflight = deferredRequest();
	const olderLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: inflight.request,
		setPayload: () => {},
		setLoading: (next) => { commits.push(next); },
		loadingOwnership,
		loadingOwnerId: d1,
		isLatestDispatch: () => precedence.isLatest(d1),
	});
	assert.deepEqual(commits, [true], 'the older dispatch claims the loading flag');
	assert.equal(loadingOwnership.ownerId, d1);

	// The newest dispatch supersedes D1 for the SAME scope but never reaches the
	// loader, so only D1's own release can clear the flag.
	precedence.begin();

	inflight.resolve({ data: diagnostics() });
	assert.equal(await olderLoad, 'discarded', 'the superseded same-scope reply is discarded');
	assert.equal(loadingOwnership.ownerId, null, 'the discarded reply drops its own claim');
	assert.deepEqual(commits, [true, false], 'the discarded reply clears exactly once');
});

test('C-6R3 an older completion cannot clear a newer active request loading', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');

	const precedence = createDispatchPrecedence();
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	const loadingOwnership = createDiagnosticsLoadingOwnership();
	const commits: boolean[] = [];
	const commit = (next: boolean) => { commits.push(next); };

	const d1 = precedence.begin();
	const olderInflight = deferredRequest();
	const olderLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: olderInflight.request,
		setPayload: () => {},
		setLoading: commit,
		loadingOwnership,
		loadingOwnerId: d1,
		isLatestDispatch: () => precedence.isLatest(d1),
	});

	// The NEWER dispatch engages and is still in flight.
	const d2 = precedence.begin();
	const newerInflight = deferredRequest();
	const newerLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: newerInflight.request,
		setPayload: () => {},
		setLoading: commit,
		loadingOwnership,
		loadingOwnerId: d2,
		isLatestDispatch: () => precedence.isLatest(d2),
	});
	assert.deepEqual(commits, [true, true], 'the newer active dispatch owns the flag');

	// The older reply lands first and must not clear the newer active claim.
	olderInflight.resolve({ data: diagnostics() });
	assert.equal(await olderLoad, 'discarded');
	assert.equal(loadingOwnership.ownerId, d2, 'ownership stays with the newer active dispatch');
	assert.deepEqual(commits, [true, true], 'the older completion commits nothing');

	// The newer reply then clears exactly once.
	newerInflight.resolve({ data: diagnostics() });
	assert.equal(await newerLoad, 'persisted');
	assert.equal(loadingOwnership.ownerId, null);
	assert.deepEqual(commits, [true, true, false], 'the newest success clears exactly once');
});

test('C-6R3 a newest success and a newest typed failure each clear loading exactly once', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');

	// Newest success.
	const successOwnership = createDiagnosticsLoadingOwnership();
	const successCommits: boolean[] = [];
	const successOutcome = await loadAuthorityDiagnosticsForScope({
		epoch: createScopeEpoch(),
		scopeRef: { current: null },
		scopeId: SCOPE_A,
		request: async () => ({ data: diagnostics() }),
		setPayload: () => {},
		setLoading: (next) => { successCommits.push(next); },
		loadingOwnership: successOwnership,
		loadingOwnerId: 1,
		isLatestDispatch: () => true,
	});
	assert.equal(successOutcome, 'persisted');
	assert.deepEqual(successCommits, [true, false], 'one claim and one clear — no double clear');
	assert.equal(successOwnership.ownerId, null);

	// Newest typed failure (the loader's catch path clears the typed unknown state).
	const failureOwnership = createDiagnosticsLoadingOwnership();
	const failureCommits: boolean[] = [];
	const failureOutcome = await loadAuthorityDiagnosticsForScope({
		epoch: createScopeEpoch(),
		scopeRef: { current: null },
		scopeId: SCOPE_A,
		request: async () => { throw new Error('diagnostics unavailable'); },
		setPayload: () => {},
		setLoading: (next) => { failureCommits.push(next); },
		loadingOwnership: failureOwnership,
		loadingOwnerId: 1,
		isLatestDispatch: () => true,
	});
	assert.equal(failureOutcome, 'cleared');
	assert.deepEqual(failureCommits, [true, false], 'a typed failure also clears exactly once');
	assert.equal(failureOwnership.ownerId, null);
});

test('C-6R3 three dispatches: the middle abort does not orphan and the newest owns the clear', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');

	const precedence = createDispatchPrecedence();
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	const loadingOwnership = createDiagnosticsLoadingOwnership();
	const commits: boolean[] = [];
	const commit = (next: boolean) => { commits.push(next); };

	// D1 engages and stays in flight.
	const d1 = precedence.begin();
	const d1Inflight = deferredRequest();
	const d1Load = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: d1Inflight.request,
		setPayload: () => {},
		setLoading: commit,
		loadingOwnership,
		loadingOwnerId: d1,
		isLatestDispatch: () => precedence.isLatest(d1),
	});

	// D2 supersedes and aborts before the loader; it terminates D1's inherited claim.
	const d2 = precedence.begin();
	assert.equal(
		terminateDiagnosticsLoadingForLatestDispatch(loadingOwnership, () => precedence.isLatest(d2), commit),
		true,
		'the middle abort terminates the inherited claim',
	);
	assert.deepEqual(commits, [true, false]);

	// D3 engages and completes; it owns the clear.
	const d3 = precedence.begin();
	const d3Outcome = await loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: async () => ({ data: diagnostics() }),
		setPayload: () => {},
		setLoading: commit,
		loadingOwnership,
		loadingOwnerId: d3,
		isLatestDispatch: () => precedence.isLatest(d3),
	});
	assert.equal(d3Outcome, 'persisted');
	assert.deepEqual(commits, [true, false, true, false], 'no dispatch double-clears');

	// D1's late reply is discarded and commits nothing.
	d1Inflight.resolve({ data: diagnostics() });
	assert.equal(await d1Load, 'discarded');
	assert.equal(loadingOwnership.ownerId, null);
	assert.deepEqual(commits, [true, false, true, false]);
});

test('C-6R3 cross-scope replacement leaks no state across the ownership boundary', async () => {
	installEmptyLocalStorage();
	const { loadAuthorityDiagnosticsForScope } = await import('@/hooks/useTeachingLoadData');

	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	const loadingOwnership = createDiagnosticsLoadingOwnership();
	const commits: boolean[] = [];
	let payload: TeachingLoadAuthorityDiagnosticsPayload | null = null;

	// Scope A claims first.
	const stale = deferredRequest();
	const staleLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: stale.request,
		setPayload: (next) => { payload = next; },
		setLoading: (next) => { commits.push(next); },
		loadingOwnership,
		loadingOwnerId: 1,
		isLatestDispatch: () => true,
	});

	// Scope B replaces it and claims the flag.
	const newer = deferredRequest();
	const newerLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_B,
		request: newer.request,
		setPayload: (next) => { payload = next; },
		setLoading: (next) => { commits.push(next); },
		loadingOwnership,
		loadingOwnerId: 2,
		isLatestDispatch: () => true,
	});
	assert.equal(scopeRef.current, SCOPE_B);
	assert.deepEqual(commits, [true, true]);

	// A's obsolete reply is discarded and cannot clear B's loading claim or payload.
	stale.resolve({ data: { ...diagnostics(), sourceRevision: 'rev-A' } });
	assert.equal(await staleLoad, 'discarded');
	assert.equal(loadingOwnership.ownerId, 2, 'the newer scope keeps its claim');
	assert.deepEqual(commits, [true, true], 'the obsolete scope commits nothing');

	// B persists and clears exactly once.
	newer.resolve({ data: { ...diagnostics(), sourceRevision: 'rev-B' } });
	assert.equal(await newerLoad, 'persisted');
	assert.equal(
		(payload as TeachingLoadAuthorityDiagnosticsPayload | null)?.sourceRevision,
		'rev-B',
		'only the replacement scope payload survives',
	);
	assert.deepEqual(commits, [true, true, false]);
});

test('C-6R3 scope reset and unmount terminate the outstanding claim (flag returns to false)', () => {
	const loadingOwnership = createDiagnosticsLoadingOwnership();
	const commits: boolean[] = [];
	const commit = (next: boolean) => { commits.push(next); };
	// The hook's scope-reset effect and unmount cleanup both run exactly this.
	const releaseOwnership = () => { if (loadingOwnership.releaseAll()) commit(false); };

	loadingOwnership.claim(7);
	commit(true);
	assert.equal(loadingOwnership.ownerId, 7);

	releaseOwnership();
	assert.equal(loadingOwnership.ownerId, null);
	assert.deepEqual(commits, [true, false]);

	// Idempotent: no claim left to terminate, so no extra commit.
	releaseOwnership();
	assert.deepEqual(commits, [true, false], 'a second reset must not clear again');

	// A late reply from the released dispatch can neither re-own nor clear again.
	assert.equal(loadingOwnership.release(7), false);
	assert.equal(loadingOwnership.ownerId, null);
	assert.deepEqual(commits, [true, false]);
});

test('C-6R3 the hook threads dispatch-scoped loading ownership through the diagnostics read', () => {
	const hook = source('src/hooks/useTeachingLoadData.ts');

	// One ownership registry per hook instance; the loader claims and releases it.
	assert.match(hook, /const diagnosticsLoadingOwnershipRef = useRef\(createDiagnosticsLoadingOwnership\(\)\);/);
	assert.match(hook, /loadingOwnership: diagnosticsLoadingOwnershipRef\.current,/);
	assert.match(hook, /loadingOwnerId: dispatchScope\.dispatchId,/);
	assert.match(hook, /if \(loadingOwnership\.release\(loadingOwnerId\)\) setLoading\(false\);/);
	// The newest dispatch terminates an inherited claim in its finally.
	assert.match(hook, /terminateDiagnosticsLoadingForLatestDispatch\(/);
	assert.match(
		hook,
		/diagnosticsLoadingOwnershipRef\.current,\s*isLatestDispatch,\s*setAuthorityDiagnosticsLoading,/,
	);
	// Scope reset and unmount release too, so the flag cannot outlive its scope.
	assert.match(hook, /const releaseDiagnosticsLoadingOwnership = useCallback\(\(\) => \{/);
	assert.match(hook, /setAuthorityDiagnostics\(null\);[\s\S]{0,400}releaseDiagnosticsLoadingOwnership\(\);/);
	assert.match(hook, /return \(\) => \{\s*releaseDiagnosticsLoadingOwnership\(\);\s*\};/);
});
