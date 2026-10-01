import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const INITIAL_BASELINE_SHA = 'fdae67ec64a4713d7c5c2446e03c25c29ddf704f';
export const TYPECHECK_COMMANDS = [
  { package: 'atlas-client', command: 'npm run typecheck' },
  { package: 'atlas-server', command: 'npm run build -- --pretty false' },
];

export function normalizeDiagnostics(output, packageName) {
  const diagnostics = [];
  const pattern = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;
  for (const match of output.matchAll(pattern)) {
    diagnostics.push({
      file: `${packageName}/${match[1].replaceAll('\\', '/')}`,
      line: Number(match[2]),
      code: match[4],
      message: match[5].trim(),
    });
  }
  const globalPattern = /^error (TS\d+): (.+)$/gm;
  for (const match of output.matchAll(globalPattern)) {
    diagnostics.push({ file: `${packageName}/<compiler>`, line: 0, code: match[1], message: match[2].trim() });
  }
  return diagnostics.sort(compareDiagnostics);
}

function compareDiagnostics(a, b) {
  return a.file.localeCompare(b.file) || a.line - b.line || a.code.localeCompare(b.code) || a.message.localeCompare(b.message);
}

export function compareDiagnosticsToBaseline(errors, baselineErrors) {
  const allowance = new Map();
  for (const error of baselineErrors) {
    const key = JSON.stringify(error);
    allowance.set(key, (allowance.get(key) ?? 0) + 1);
  }
  const unexpected = [];
  for (const error of errors) {
    const key = JSON.stringify(error);
    const count = allowance.get(key) ?? 0;
    if (count === 0) unexpected.push(error);
    else allowance.set(key, count - 1);
  }
  return unexpected.sort(compareDiagnostics);
}

export function findBaselineAdditions(candidateErrors, referenceErrors) {
  return compareDiagnosticsToBaseline(candidateErrors, referenceErrors);
}

export function loadOriginMainBaseline(root, candidateBaseline) {
  const revision = spawnSync('git', ['-C', root, 'rev-parse', '--verify', 'origin/main^{commit}'], { encoding: 'utf8' });
  if (revision.status !== 0) throw new Error(`Cannot resolve origin/main: ${revision.stderr.trim()}`);
  const baselineSpec = 'origin/main:ops/lane-c/tsc-baseline.json';
  const exists = spawnSync('git', ['-C', root, 'cat-file', '-e', baselineSpec], { encoding: 'utf8' });
  if (exists.status !== 0) {
    if (candidateBaseline.sha === INITIAL_BASELINE_SHA) return candidateBaseline;
    throw new Error(`Typecheck baseline is missing at ${baselineSpec}`);
  }
  const baseline = spawnSync('git', ['-C', root, 'show', baselineSpec], { encoding: 'utf8' });
  if (baseline.status !== 0) throw new Error(`Cannot read ${baselineSpec}: ${baseline.stderr.trim()}`);
  return JSON.parse(baseline.stdout);
}

export function runTypechecks(root = repoRoot) {
  const errors = [];
  const commandResults = [];
  for (const entry of TYPECHECK_COMMANDS) {
    const args = entry.package === 'atlas-client'
      ? ['run', 'typecheck']
      : ['run', 'build', '--', '--pretty', 'false'];
    const executable = process.platform === 'win32'
      ? process.execPath
      : 'npm';
    const executableArgs = process.platform === 'win32'
      ? [path.resolve(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), ...args]
      : args;
    const result = spawnSync(executable, executableArgs, { cwd: path.join(root, entry.package), encoding: 'utf8' });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    commandResults.push({ package: entry.package, command: entry.command, exitCode: result.status ?? 1 });
    errors.push(...normalizeDiagnostics(output, entry.package));
    if (result.error) {
      errors.push({ file: `${entry.package}/<command>`, line: 0, code: 'TSC_COMMAND', message: result.error.message });
    } else if (result.status !== 0 && !output.includes('error TS')) {
      errors.push({ file: `${entry.package}/<command>`, line: 0, code: 'TSC_EXIT', message: `Typecheck exited ${result.status ?? 1} without parseable diagnostics.` });
    }
  }
  return { commandResults, errors: errors.sort(compareDiagnostics) };
}

export function checkBaseline(root = repoRoot, useOriginMain = false) {
  const candidateBaselinePath = path.join(root, 'ops/lane-c/tsc-baseline.json');
  const baseline = JSON.parse(readFileSync(candidateBaselinePath, 'utf8'));
  if (typeof baseline.sha !== 'string' || !/^[0-9a-f]{40}$/.test(baseline.sha) || baseline.sha !== INITIAL_BASELINE_SHA) {
    throw new Error(`Typecheck baseline sha must be the pinned initial baseline ${INITIAL_BASELINE_SHA}.`);
  }
  const referenceBaseline = useOriginMain
    ? loadOriginMainBaseline(root, baseline)
    : baseline;
  const actual = runTypechecks(root);
  return {
    sha: baseline.sha,
    commands: actual.commandResults,
    errors: actual.errors,
    unexpected: compareDiagnosticsToBaseline(actual.errors, baseline.errors),
    baselineAdditions: findBaselineAdditions(baseline.errors, referenceBaseline.errors),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkBaseline(
      process.argv[2] ? path.resolve(process.argv[2]) : repoRoot,
      process.argv[3] === '--origin-main',
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.unexpected.length || result.baselineAdditions.length ? 2 : 0;
  } catch (error) {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  }
}
