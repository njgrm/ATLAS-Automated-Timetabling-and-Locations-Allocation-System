import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, runRelease } from './elevated-release-runner.mjs';
import { readFileSync } from 'node:fs';

const sha = '5a333c74de03df11e0d0bf9ec6839c1916798896';
const root = `D:\\ATLAS-runtime-supervised-${sha.slice(0, 12)}-20260922`;

test('accepts only the approved SHA-prefixed release root', () => {
	assert.equal(parseArgs(['--sha', sha, '--release-root', root]).mode, 'preflight');
	assert.throws(() => parseArgs(['--sha', sha, '--release-root', 'D:\\other']), /Release root/);
	assert.throws(() => parseArgs(['--sha', sha, '--release-root', `D:\\ATLAS-runtime-supervised-${sha.slice(0, 12)}-20260922\\..\\x`]), /Release root/);
});

test('preflight is read-only and captures rollback metadata', () => {
	const result = runRelease(['--sha', sha, '--release-root', root], {
		env: { ATLAS_RUNTIME_SOURCE_DIR: 'D:\\incumbent', ATLAS_RUNTIME_RELEASE_SHA: 'oldsha' },
		runner: () => 'Status: Running\nUser: SYSTEM',
		resolveHead: () => sha,
	});
	const value = JSON.parse(result.output);
	assert.equal(value.readOnly, true);
	assert.equal(value.cutoverExecuted, false);
	assert.equal(value.rollback.sha, 'oldsha');
});

test('forbidden operations and unapproved cutover fail closed', () => {
	assert.throws(() => runRelease(['--sha', sha, '--release-root', root, '--mode', 'cutover']), (error) => error.code === 'CUTOVER_APPROVAL_REQUIRED');
	assert.throws(() => runRelease(['--sha', sha, '--release-root', root, '--migrate']), (error) => error.code === 'ARGUMENT_REJECTED');
	assert.throws(() => runRelease(['--sha', sha, '--release-root', root, '--mode', 'preflight', 'prisma', 'db', 'push']), (error) => error.code === 'ARGUMENT_REJECTED');
});

test('registration source installs a protected fixed-path, fixed-name, preflight-only task', () => {
	const script = readFileSync(new URL('./Register-AtlasElevatedReleaseTask.ps1', import.meta.url), 'utf8');
	assert.match(script, /ProgramData.*ATLAS[\\/]release-runner/);
	assert.match(script, /Get-FileHash/);
	assert.match(script, /SYSTEM/);
	assert.match(script, /RunLevel Highest/);
	assert.match(script, /ATLAS-Approved-Release/);
	assert.match(script, /Register-ScheduledTask -TaskName \$TaskName -InputObject \$definition(?!.*-Force)/s);
	assert.doesNotMatch(script, /ATLAS-worktrees.*Register-ScheduledTask/s);
	assert.match(script, /\$trigger\.Enabled = \$false/);
});

test('preflight evidence includes XML export, authoritative identity, and listener lineage', () => {
	const result = runRelease(['--sha', sha, '--release-root', root], {
		env: { ATLAS_RUNTIME_SOURCE_DIR: 'D:\\incumbent', ATLAS_RUNTIME_RELEASE_SHA: sha },
		runner: (command, args) => {
			if (command === 'schtasks.exe' && args.includes('/xml')) return '<Task><Arguments>safe</Arguments></Task>';
			if (command === 'powershell.exe') return '{"LocalPort":5001,"OwningProcess":123,"ParentProcessId":456,"CommandLine":"node server.js"}';
			if (command === 'git.exe') return sha;
			return 'Status: Running';
		},
		resolveHead: () => sha,
	});
	const value = JSON.parse(result.output);
	assert.equal(value.incumbent.taskXmlExported, true);
	assert.equal(value.incumbent.authoritativeHead, sha);
	assert.deepEqual(value.incumbent.listeners[0], { localPort: 5001, pid: 123, parentPid: 456, commandLine: 'node server.js' });
});
