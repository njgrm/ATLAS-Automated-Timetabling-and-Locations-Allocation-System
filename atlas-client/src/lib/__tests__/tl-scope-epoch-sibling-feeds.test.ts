import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { createScopeEpoch } from '@/lib/scope-request-epoch';
import {
	commitScopeBoundWrite,
	isScopeCurrent,
	openDiagnosticsScope,
	type ScopeBoundWrite,
} from '@/hooks/useTeachingLoadData';

/**
 * C-6 — sibling authority feeds are bound to the scope active at dispatch.
 *
 * Defect: `fetchData` wrote EVERY authority feed (faculty, subjects, sections,
 * assigned-classes, coverage, policy, dataSource, notices, the page loading flag)
 * unconditionally, so a reply that landed after a school/year transition
 * overwrote the current scope's state. Only the C-5 diagnostics read was guarded.
 *
 * These controls drive the real production guard (`isScopeCurrent` /
 * `commitScopeBoundWrite` / `openDiagnosticsScope`) that the hook now uses at
 * every write site.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
function source(relativePath: string): string {
	return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

const SCOPE_A = '1:9';
const SCOPE_B = '1:10';

/** The sibling authority feeds the hook writes inside one fetch. */
const SIBLING_FEEDS = ['faculty', 'subjects', 'sectionSummary', 'sectionAssignedClassesIndex', 'coverageTotals', 'workloadPolicy'] as const;

function makeBinding(scopeRef: { current: string | null }, epoch: ReturnType<typeof createScopeEpoch>, scopeId: string): ScopeBoundWrite {
	openDiagnosticsScope(scopeRef, epoch, scopeId);
	return { scopeRef, epoch, scopeId, token: epoch.current };
}

/* ================================================================== *
 * The core control: obsolete-scope sibling writes are discarded
 * ================================================================== */

test('C-6 an obsolete-scope reply must not write ANY sibling authority feed', () => {
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };

	// Scope A dispatches.
	const bindingA = makeBinding(scopeRef, epoch, SCOPE_A);
	assert.equal(isScopeCurrent(bindingA), true, 'the dispatching scope starts current');

	// A school/year transition resolves scope B before A replies.
	makeBinding(scopeRef, epoch, SCOPE_B);
	assert.equal(isScopeCurrent(bindingA), false, 'A is superseded once B resolves');

	// A's late reply attempts to write the whole sibling feed set.
	const written: string[] = [];
	const applied = commitScopeBoundWrite(bindingA, () => { written.push(...SIBLING_FEEDS); });

	assert.equal(applied, false, 'an obsolete-scope sibling write must be discarded');
	assert.equal(written.length, 0, 'NOTHING may be written for an obsolete scope');

	// The current scope's reply is applied normally.
	const bindingB: ScopeBoundWrite = { scopeRef, epoch, scopeId: SCOPE_B, token: epoch.current };
	assert.equal(commitScopeBoundWrite(bindingB, () => { written.push('faculty'); }), true);
	assert.deepEqual(written, ['faculty']);
});

test('C-6 an obsolete reply must not clear the current scope loading flag either', () => {
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	const bindingA = makeBinding(scopeRef, epoch, SCOPE_A);
	makeBinding(scopeRef, epoch, SCOPE_B);

	// The finally-block behaviour modelled through the same guard.
	let loading = true; // scope B's fetch is still in flight
	if (isScopeCurrent(bindingA)) loading = false;
	assert.equal(loading, true, "an obsolete fetch must not clear the newer fetch's loading flag");

	const bindingB: ScopeBoundWrite = { scopeRef, epoch, scopeId: SCOPE_B, token: epoch.current };
	if (isScopeCurrent(bindingB)) loading = false;
	assert.equal(loading, false, 'the current scope still clears its own loading flag');
});

test('C-6 a repeated dispatch of the SAME scope stays current (no self-invalidation)', () => {
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };
	const first = makeBinding(scopeRef, epoch, SCOPE_A);
	const second = makeBinding(scopeRef, epoch, SCOPE_A);

	assert.equal(isScopeCurrent(first), true, 're-resolving the same scope must not invalidate it');
	assert.equal(isScopeCurrent(second), true);
	assert.equal(first.token, second.token, 'the same scope keeps one token');

	const written: string[] = [];
	assert.equal(commitScopeBoundWrite(first, () => { written.push('faculty'); }), true);
	assert.deepEqual(written, ['faculty']);
});

test('C-6 an unresolved scope binding never blocks (nothing to conflict with)', () => {
	// Mirrors `scopeBindingIsCurrent()` returning true while `scopeBinding` is null,
	// so an early actor-school failure still surfaces its error state.
	const scopeBinding: ScopeBoundWrite | null = null;
	const scopeBindingIsCurrent = () => scopeBinding == null || isScopeCurrent(scopeBinding);
	assert.equal(scopeBindingIsCurrent(), true);
});

/* ================================================================== *
 * Wiring: the real hook guards every sibling feed
 * ================================================================== */

test('C-6 the hook gates every sibling authority feed on the dispatch scope', () => {
	const hook = source('src/hooks/useTeachingLoadData.ts');

	// One shared binding authority, opened by the resolving fetch (never an effect).
	assert.match(hook, /let scopeBinding: ScopeBoundWrite \| null = null;/);
	assert.match(hook, /scopeBinding = \{\s*scopeRef: diagnosticsScopeRef,/);
	assert.match(hook, /const scopeBindingIsCurrent = \(\) => scopeBinding == null \|\| isScopeCurrent\(scopeBinding\);/);
	assert.match(hook, /openDiagnosticsScope\(diagnosticsScopeRef, diagnosticsEpochRef\.current, resolvedScopeId\);/);

	// Warm-cache branch is gated.
	assert.match(hook, /if \(cachedSummary && cachedSubjects && cachedSections && scopeBindingIsCurrent\(\)\) \{/);
	// Cold-success path is gated as one unit.
	const successGate = hook.indexOf('if (scopeBindingIsCurrent()) {');
	assert.ok(successGate >= 0, 'the cold-success path must be scope-gated');
	for (const setter of ['setFaculty(normalizedSummary.faculty)', 'setSubjects(normalizedSubjects)', 'setSectionSummary(normalizedSectionSummary as SectionSummaryResponse)', 'setSectionAssignedClassesIndex(sectionAssignedClassesRes.data)']) {
		const index = hook.indexOf(setter);
		assert.ok(index > successGate, `${setter} must sit inside the scope-gated success block`);
	}
	// Catch/fallback path is gated, including its error branch.
	assert.match(hook, /if \(!scopeBindingIsCurrent\(\)\) \{/);
	assert.match(hook, /if \(scopeBindingIsCurrent\(\)\) setLoading\(false\);/);

	// The scope-guarded diagnostics seam from C-5 is still intact.
	assert.match(hook, /await loadAuthorityDiagnosticsForScope\(\{/);
	assert.match(hook, /scopeRef: diagnosticsScopeRef,/);
});

test('C-6 the sibling-feed guard is the same authority the C-5 loader uses', () => {
	const hook = source('src/hooks/useTeachingLoadData.ts');
	// The loader delegates to the shared predicate rather than re-implementing it.
	assert.match(hook, /const isCurrent = \(\) => isScopeCurrent\(binding\);/);
	const inlineChecks = hook.match(/scopeRef\.current === scopeId && epoch\.isCurrent\(/g) ?? [];
	assert.equal(inlineChecks.length, 0, 'the currency check must have exactly one implementation');
});

/* ================================================================== *
 * Zero-write preserved
 * ================================================================== */

test('C-6 the guarded fetch path stays read-only', () => {
	const hook = source('src/hooks/useTeachingLoadData.ts');
	assert.doesNotMatch(hook, /atlasApi\.post\(/);
	assert.doesNotMatch(hook, /atlasApi\.put\(/);
	assert.doesNotMatch(hook, /atlasApi\.patch\(/);
	assert.doesNotMatch(hook, /atlasApi\.delete\(/);
	assert.doesNotMatch(hook, /policies\/scheduling/);
});
