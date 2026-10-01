import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareDiagnosticsToBaseline, findBaselineAdditions, loadOriginMainBaseline, normalizeDiagnostics } from './typecheck-baseline.mjs';

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

test('rejects an otherwise-valid baseline with a different SHA before running typechecks', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'atlas-tsc-baseline-'));
  try {
    const baselinePath = path.join(root, 'ops/lane-c/tsc-baseline.json');
    mkdirSync(path.dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, JSON.stringify({ sha: '0'.repeat(40), commands: [], errors: [] }));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./typecheck-baseline.mjs', import.meta.url)), root], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /sha must be the pinned initial baseline/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reads the reference baseline from origin/main even if the worktree file differs', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'atlas-tsc-baseline-'));
  try {
    execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'baseline-test@example.invalid'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Baseline Test'], { cwd: root });
    const baselinePath = path.join(root, 'ops/lane-c/tsc-baseline.json');
    mkdirSync(path.dirname(baselinePath), { recursive: true });
    const committed = { sha: 'fdae67ec64a4713d7c5c2446e03c25c29ddf704f', errors: [] };
    writeFileSync(baselinePath, JSON.stringify(committed));
    execFileSync('git', ['add', 'ops/lane-c/tsc-baseline.json'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'pin baseline'], { cwd: root, stdio: 'ignore' });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', head], { cwd: root });
    const staleWorkingCopy = { ...committed, errors: [{ file: 'new.ts', line: 1, code: 'TS9999', message: 'new' }] };
    writeFileSync(baselinePath, JSON.stringify(staleWorkingCopy));
    assert.deepEqual(loadOriginMainBaseline(root, staleWorkingCopy), committed);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('allows a missing origin/main baseline only for the pinned initial baseline SHA', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'atlas-tsc-baseline-'));
  try {
    execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'baseline-test@example.invalid'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Baseline Test'], { cwd: root });
    writeFileSync(path.join(root, 'README.md'), 'baseline bootstrap\n');
    execFileSync('git', ['add', 'README.md'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'initialize repository'], { cwd: root, stdio: 'ignore' });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', head], { cwd: root });
    const initial = { sha: 'fdae67ec64a4713d7c5c2446e03c25c29ddf704f', errors: [] };
    assert.equal(loadOriginMainBaseline(root, initial), initial);
    assert.throws(() => loadOriginMainBaseline(root, { sha: '0'.repeat(40), errors: [] }), /baseline is missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
