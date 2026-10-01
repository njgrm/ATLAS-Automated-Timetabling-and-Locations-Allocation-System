import test from 'node:test';
import assert from 'node:assert/strict';
import { compareDiagnosticsToBaseline, findBaselineAdditions, loadReferenceBaseline, normalizeDiagnostics } from './typecheck-baseline.mjs';

test('normalizes Windows paths and sorts diagnostics into stable records', () => {
  const result = normalizeDiagnostics([
    'src\\z.test.ts(8,2): error TS2345: Later issue',
    'src\\a.test.ts(3,4): error TS2367: First issue',
  ].join('\n'), 'atlas-client');
  assert.deepEqual(result, [
    { file: 'atlas-client/src/a.test.ts', line: 3, code: 'TS2367', message: 'First issue' },
    { file: 'atlas-client/src/z.test.ts', line: 8, code: 'TS2345', message: 'Later issue' },
  ]);
});

test('normalizes compiler-wide diagnostics that do not name a source file', () => {
  assert.deepEqual(normalizeDiagnostics('error TS5058: The specified path does not exist.', 'atlas-client'), [
    { file: 'atlas-client/<compiler>', line: 0, code: 'TS5058', message: 'The specified path does not exist.' },
  ]);
});

test('allows exact baseline errors and rejects any new normalized error', () => {
  const baseline = [{ file: 'atlas-client/src/a.test.ts', line: 3, code: 'TS2367', message: 'First issue' }];
  const actual = [...baseline, { file: 'atlas-server/src/new.ts', line: 9, code: 'TS9999', message: 'New issue' }];
  assert.deepEqual(compareDiagnosticsToBaseline(actual, baseline), [actual[1]]);
});

test('rejects added baseline entries while permitting removals', () => {
  const reference = [{ file: 'atlas-client/src/a.test.ts', line: 3, code: 'TS2367', message: 'First issue' }];
  const candidate = [...reference, { file: 'atlas-server/src/new.ts', line: 9, code: 'TS9999', message: 'New issue' }];
  assert.deepEqual(findBaselineAdditions(candidate, reference), [candidate[1]]);
  assert.deepEqual(findBaselineAdditions([], reference), []);
});

test('uses the candidate baseline only when the reference baseline is absent during initial bootstrap', () => {
  const candidate = { sha: 'fdae67ec64a4713d7c5c2446e03c25c29ddf704f', errors: [] };
  assert.equal(loadReferenceBaseline('ops/lane-c/no-baseline-yet.json', candidate), candidate);
});
