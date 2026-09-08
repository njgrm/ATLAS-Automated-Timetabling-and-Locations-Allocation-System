/**
 * SCA-01.1 negative control — Subjects catalog read scope.
 *
 * The pre-SCA-01 page resolved its read scope as `actorSchoolId ?? 1`, so the
 * very first catalog request always went to school 1 while the actor scope
 * was still resolving, and the fetch callback never re-ran once the actor
 * school arrived (stale closure over the fallback value).
 *
 * Every assertion below FAILS against that old behavior and PASSES against
 * `resolveSubjectsReadScope`, which the page now uses as its only scope
 * source and effect dependency.
 *
 * Run with: npx tsx --test src/lib/__tests__/subject-school-scope.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSubjectsReadScope } from '../subject-school-scope';

test('unresolved actor scope is not ready and yields no school id', () => {
	for (const unresolved of [null, undefined]) {
		const scope = resolveSubjectsReadScope(unresolved);
		assert.equal(scope.ready, false, `scope must not be ready for ${String(unresolved)}`);
		assert.equal(scope.schoolId, null, `no school id may leak for ${String(unresolved)}`);
	}
	// The old `?? 1` fallback returned school 1 here — this assertion fails on it.
	assert.notEqual(resolveSubjectsReadScope(null).schoolId, 1, 'must never fall back to school 1');
});

test('non-positive or non-integer actor values stay not-ready', () => {
	for (const bad of [0, -3, 1.5, Number.NaN]) {
		const scope = resolveSubjectsReadScope(bad);
		assert.equal(scope.ready, false, `scope must not be ready for ${String(bad)}`);
		assert.equal(scope.schoolId, null, `no school id may leak for ${String(bad)}`);
	}
});

test('resolved actor school yields a ready scope for exactly that school', () => {
	const scope = resolveSubjectsReadScope(7);
	assert.equal(scope.ready, true);
	assert.equal(scope.schoolId, 7);
	if (scope.ready) {
		assert.equal(scope.schoolId, 7, 'ready scope must carry the actor school, not a constant');
	}
});
