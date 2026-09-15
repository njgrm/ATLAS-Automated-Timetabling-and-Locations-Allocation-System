import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { createScopeEpoch } from '@/lib/scope-request-epoch';
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

	const inFlight = loadAuthorityDiagnosticsForScope({
		epoch,
		scopeRef,
		scopeId: SCOPE_A,
		request: inflight.request,
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
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

	const inFlight = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: inflight.request,
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
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

	const inFlight = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: inflight.request,
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
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
	const run = () => loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: async () => ({ data: diagnostics() }),
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
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

	const staleLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: stale.request,
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
	});

	// A real scope change: the new scope resolves and opens a new epoch.
	const current = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_B,
		request: () => new Promise(() => {}),
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
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

	const staleLoad = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_A,
		request: stale.request,
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
	});
	const current = loadAuthorityDiagnosticsForScope({
		epoch, scopeRef, scopeId: SCOPE_B,
		request: () => new Promise(() => {}),
		setPayload: (next: TeachingLoadAuthorityDiagnosticsPayload | null) => { payload = next; },
		setLoading: (next: boolean) => { loading = next; },
	});

	stale.reject(new Error('obsolete scope failed'));
	assert.equal(await staleLoad, 'discarded');
	assert.equal(payload, 'CURRENT_SCOPE_STATE');
	assert.equal(loading, true, 'an obsolete failure must not clear the new scope loading flag');
	void current;
});
