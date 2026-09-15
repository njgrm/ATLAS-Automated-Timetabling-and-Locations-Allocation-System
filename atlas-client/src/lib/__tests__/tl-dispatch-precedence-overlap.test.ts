import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { createScopeEpoch } from '@/lib/scope-request-epoch';
import {
	commitScopeBoundWrite,
	createDispatchPrecedence,
	createFetchDispatchScope,
	isScopeCurrent,
	type ScopeBoundWrite,
} from '@/hooks/useTeachingLoadData';

/**
 * C-6R — dispatch precedence and overlap safety.
 *
 * C-6 gated feeds on the bound scope, but `scopeBindingIsCurrent()` was
 * supersession-blind while `scopeBinding` was still null, and `openDiagnosticsScope`
 * only compares scope-id strings. Two reachable defects followed:
 *
 *  F-1  a superseded older invocation whose scope never resolved still ran the
 *       catch/finally writes, clearing the current scope's feeds and loading flag
 *       and rendering a spurious error over a newer successful fetch;
 *  F-2  a late-resolving OLDER invocation re-opened the epoch for its own scope,
 *       making the NEWER binding look stale (precedence inversion).
 *
 * These controls compose the same exported production primitives the hook uses.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
function source(relativePath: string): string {
	return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

const SCOPE_A = '1:9';
const SCOPE_B = '1:10';

/**
 * Drives the REAL production factory the hook uses
 * (`createFetchDispatchScope`), so a production mutation to the precedence or
 * binding gate makes these controls fail behaviourally.
 */
function makeInvocation(precedence: ReturnType<typeof createDispatchPrecedence>, scopeRef: { current: string | null }, epoch: ReturnType<typeof createScopeEpoch>) {
	return createFetchDispatchScope(precedence, scopeRef, epoch);
}

/* ================================================================== *
 * The overlapping-fetch control the auditor named
 * ================================================================== */

test('C-6R overlapping fetches: a superseded failure writes nothing over the newer scope', () => {
	const precedence = createDispatchPrecedence();
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };

	const writes: string[] = [];
	let loading = true;

	// The OLDER invocation dispatches first.
	const older = makeInvocation(precedence, scopeRef, epoch);
	// The NEWER invocation overlaps it and wins.
	const newer = makeInvocation(precedence, scopeRef, epoch);

	assert.equal(newer.bind(SCOPE_B), true, 'the newest dispatch binds its scope');
	assert.equal(newer.canWrite(), true);
	commitScopeBoundWrite(newer.binding!, () => {
		writes.push('faculty:B', 'subjects:B', 'sections:B');
		loading = false;
	});
	assert.equal(loading, false, 'the newer fetch cleared its own loading flag');

	// The older invocation is now superseded.
	assert.equal(older.isLatestDispatch(), false, 'the older invocation is superseded');

	// F-1: the older invocation fails BEFORE resolving a scope (null binding).
	// Pre-C-6R this branch was considered "current" and clobbered the newer state.
	assert.equal(older.canWrite(), false, 'a superseded invocation may not write, even unbound');
	if (older.canWrite()) {
		writes.push('error:older', 'dataSource:none', 'authorityDiagnostics:null');
		loading = true;
	}
	assert.equal(writes.includes('error:older'), false, 'no spurious error may be rendered');
	assert.equal(writes.includes('dataSource:none'), false, 'the older failure must not reset dataSource');
	assert.equal(loading, false, "the older failure must not clear (or set) the newer fetch's loading flag");

	// The newer scope's state survives untouched.
	assert.deepEqual(writes, ['faculty:B', 'subjects:B', 'sections:B']);
	assert.equal(scopeRef.current, SCOPE_B);
	assert.equal(isScopeCurrent(newer.binding!), true);
});

test('C-6R precedence inversion: a late-resolving older invocation cannot steal currency', () => {
	const precedence = createDispatchPrecedence();
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };

	const older = makeInvocation(precedence, scopeRef, epoch);
	const newer = makeInvocation(precedence, scopeRef, epoch);

	assert.equal(newer.bind(SCOPE_B), true);
	const newerBinding = newer.binding!;
	assert.equal(isScopeCurrent(newerBinding), true);

	// The older invocation resolves LATE and asks to bind its own (older) scope.
	// Pre-C-6R `openDiagnosticsScope` would flip scopeRef to SCOPE_A here, making
	// the newer binding look stale and discarding the newer reply.
	assert.equal(older.bind(SCOPE_A), false, 'an older dispatch must never bind');
	assert.equal(scopeRef.current, SCOPE_B, 'the older dispatch must not re-point the scope');
	assert.equal(isScopeCurrent(newerBinding), true, "the newer binding must stay current");
	assert.equal(older.canWrite(), false);

	// The newer scope still writes normally.
	const written: string[] = [];
	assert.equal(commitScopeBoundWrite(newerBinding, () => { written.push('faculty:B'); }), true);
	assert.deepEqual(written, ['faculty:B']);
});

test('C-6R only the newest dispatch may write the pre-binding actor identity', () => {
	const precedence = createDispatchPrecedence();
	const identityWrites: string[] = [];

	const older = makeInvocation(precedence, { current: null }, createScopeEpoch());
	const newer = makeInvocation(precedence, { current: null }, createScopeEpoch());

	// `isLatestDispatch()` is the exact gate the hook applies to
	// setSchoolId / setActiveSchoolYearLabel / setActiveTermIndex.
	if (older.isLatestDispatch()) identityWrites.push('older:identity');
	if (newer.isLatestDispatch()) identityWrites.push('newer:identity');

	assert.deepEqual(identityWrites, ['newer:identity'], 'only the newest dispatch may publish actor identity');
	assert.equal(older.isLatestDispatch(), false);
	assert.equal(newer.isLatestDispatch(), true);
});

test('C-6R the newest dispatch still resolves and binds normally (no self-blocking)', () => {
	const precedence = createDispatchPrecedence();
	const epoch = createScopeEpoch();
	const scopeRef: { current: string | null } = { current: null };

	const only = makeInvocation(precedence, scopeRef, epoch);
	assert.equal(only.isLatestDispatch(), true);
	assert.equal(only.bind(SCOPE_A), true);
	assert.equal(only.canWrite(), true);
	assert.equal(isScopeCurrent(only.binding!), true);

	// Re-dispatching the SAME scope keeps the newest dispatch writable.
	const second = makeInvocation(precedence, scopeRef, epoch);
	assert.equal(second.bind(SCOPE_A), true, 're-resolving the same scope must still bind');
	assert.equal(second.canWrite(), true);
});

/* ================================================================== *
 * Wiring: the real hook composes these gates
 * ================================================================== */

test('C-6R the hook gates identity setters, binding, and the diagnostics read on the newest dispatch', () => {
	const hook = source('src/hooks/useTeachingLoadData.ts');

	// Monotonic dispatch id taken before the first await.
	assert.match(hook, /const dispatchPrecedenceRef = useRef\(createDispatchPrecedence\(\)\);/);
	assert.match(hook, /const dispatchScope = createFetchDispatchScope\(/);
	assert.match(hook, /const isLatestDispatch = \(\) => dispatchScope\.isLatestDispatch\(\);/);
	// The supersession-blind null branch is gone; the production factory owns it.
	assert.match(hook, /const scopeBindingIsCurrent = \(\) => dispatchScope\.canWrite\(\);/);
	assert.match(hook, /return isLatestDispatch\(\) && \(binding == null \|\| isScopeCurrent\(binding\)\);/);

	// F-3: pre-binding identity setters sit inside an isLatestDispatch() gate.
	const bindGate = hook.indexOf('setSchoolId(school);');
	assert.ok(bindGate >= 0, 'setSchoolId must be present');
	assert.match(
		hook.slice(Math.max(0, bindGate - 240), bindGate),
		/if \(isLatestDispatch\(\)\) \{/,
		'setSchoolId must be behind the newest-dispatch gate',
	);
	for (const setter of ['setActiveSchoolYearLabel(', 'setActiveTermIndex(']) {
		const index = hook.indexOf(setter);
		assert.ok(index > bindGate, `${setter} must sit inside the newest-dispatch gate`);
	}
	// F-2: binding is inside the same gate.
	const openIndex = hook.indexOf('dispatchScope.bind(`');
	assert.ok(openIndex > bindGate, 'the scope binding must be gated on the newest dispatch');
	// The diagnostics read is gated too.
	assert.match(hook, /if \(isLatestDispatch\(\)\) \{\s*await loadAuthorityDiagnosticsForScope\(\{/);
});

test('C-6R the guarded fetch path stays read-only', () => {
	const hook = source('src/hooks/useTeachingLoadData.ts');
	assert.doesNotMatch(hook, /atlasApi\.post\(/);
	assert.doesNotMatch(hook, /atlasApi\.put\(/);
	assert.doesNotMatch(hook, /atlasApi\.patch\(/);
	assert.doesNotMatch(hook, /atlasApi\.delete\(/);
	assert.doesNotMatch(hook, /policies\/scheduling/);
});
