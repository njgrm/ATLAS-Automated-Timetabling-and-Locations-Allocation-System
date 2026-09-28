// Guard tests for ops/staging/deploy-staging.ps1.
//
// Run with:  npm run test:staging-guards
//
// Every refusal row drives the REAL script in dry-run mode (no -Execute) through a
// child powershell.exe and asserts the STAGING_DEPLOY_STOP contract plus the guard's
// own stable token. The dry-run path is read-only -- this repo, the contract
// template, the live env file, machine scope, git -- and it is deliberately
// runnable UNELEVATED (deploy-staging.ps1 requires an elevated Administrator shell
// for -Execute only), so this gate needs no privilege and mutates nothing.
//
// Rows that must hold regardless of host state (case insensitivity, the redaction
// formatter, guard ordering in source) load ops/staging/staging-guards.ps1 as pure
// functions in a child powershell. That is the documented non-mutating entry point:
// it touches nothing on disk, in the task scheduler, or in a database.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const stagingDir = join(here, '..');
const script = join(stagingDir, 'deploy-staging.ps1');
const guards = join(stagingDir, 'staging-guards.ps1');

// Read tolerantly so a MISSING or pre-fix source produces a named per-row failure
// instead of a module-load crash that names nothing. The rows themselves still
// fail loudly; only the diagnosis gets worse, never the verdict.
function readSourceOrEmpty(path, label) {
	try {
		return readFileSync(path, 'utf8');
	} catch (error) {
		process.stderr.write(`# ${label} unreadable at ${path}: ${error.code ?? error.message}\n`);
		return '';
	}
}
const source = readSourceOrEmpty(script, 'deploy-staging.ps1');
const guardSource = readSourceOrEmpty(guards, 'staging-guards.ps1');

const liveEnvFile = 'D:\\ATLAS-runtime-config\\atlas-server.env';
const stagingEnvFile = 'D:\\ATLAS-runtime-config\\atlas-staging.env';
const liveReleaseRoot = 'E:\\ATLAS-worktrees\\lane-a4-release-20260928-1';
// A value that could only reach output by being interpolated. Never a real origin
// and never a credential: this is the canary for the guard-3 rows.
const canary = 'https://guard3-canary.invalid/guard3-canary-secret';

const ps = (literal) => `'${literal.replaceAll("'", "''")}'`;

// PowerShell comment removal, so a purity assertion reads CODE and is not fooled
// (or falsely failed) by prose that names the very tools being excluded.
function stripPowerShellComments(text) {
	return text
		.replace(/<#[\s\S]*?#>/g, '')
		.split('\n')
		.map((line) => line.replace(/(^|\s)#.*$/, '$1'))
		.join('\n');
}

function runPowerShell(command) {
	return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' });
}

// Drives the real script in dry-run. A refusal surfaces as RESULT=STOP|<message>;
// a clean dry-run exits 0 from inside the script and prints the plan JSON.
function dryRun(args) {
	const command = [
		"$ErrorActionPreference='Stop'",
		`try { & ${ps(script)} ${args} } catch { 'RESULT=STOP|' + $_.Exception.Message }`,
	].join('; ');
	const result = runPowerShell(command);
	return { result, output: `${result.stdout}\n${result.stderr}` };
}

function assertRefused(t, args, token, mustAlsoMention) {
	const { output } = dryRun(args);
	const match = output.match(/RESULT=STOP\|([\s\S]*)$/);
	assert.ok(match, `expected a STAGING_DEPLOY_STOP refusal, got:\n${output}`);
	const message = match[1].trim();
	assert.match(message, /^STAGING_DEPLOY_STOP: /, `refusal must use the STAGING_DEPLOY_STOP contract: ${message}`);
	assert.match(message, new RegExp(token), `refusal must carry the ${token} token: ${message}`);
	if (mustAlsoMention) {
		for (const pattern of mustAlsoMention) {
			assert.match(message, pattern, `the ${token} refusal must also match ${pattern}: ${message}`);
		}
	}
	// Never leak a value on the way out.
	assert.doesNotMatch(message, /guard3-canary-secret/, 'a refusal must never print a companion-origin value');
	t.diagnostic(`observed: ${message.split('\n')[0]}`);
	return message;
}

// HEAD of the repository the script lives in, so preflight's `git cat-file -t`
// resolves a real commit. Read live, never hardcoded; the env override exists so
// the failing-first run can bind a SHA without a writable checkout.
function headShaIn(dir) {
	const result = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
	return result.status === 0 ? result.stdout.trim() : '';
}
const headSha =
	process.env.ATLAS_STAGING_GUARD_TEST_SHA?.trim() || headShaIn(stagingDir) || headShaIn(process.cwd());
assert.ok(/^[0-9a-f]{40}$/.test(headSha), `a real 40-char commit SHA is required, got '${headSha}'`);
const shaArg = `-Sha ${headSha}`;

test('the two files under test exist and are non-empty', (t) => {
	assert.ok(source.length > 0, `ops/staging/deploy-staging.ps1 must exist at ${script}`);
	assert.ok(guardSource.length > 0, `ops/staging/staging-guards.ps1 must exist at ${guards}`);
});

// -------------------------------------------------------------- guard 1: task

test('guard 1: -TaskName ATLAS-Runtime-Supervisor is refused, and the refusal names the live task', (t) => {
	assertRefused(
		t,
		`${shaArg} -TaskName 'ATLAS-Runtime-Supervisor'`,
		'TASK_NAME_LIVE_DENYLIST',
		[/ATLAS-Runtime-Supervisor/, /never a participant/i],
	);
});

test('guard 1: the live task name with a leading backslash or different case is refused too', (t) => {
	assertRefused(t, `${shaArg} -TaskName '\\ATLAS-Runtime-Supervisor'`, 'TASK_NAME_LIVE_DENYLIST');
	assertRefused(t, `${shaArg} -TaskName 'atlas-runtime-supervisor'`, 'TASK_NAME_LIVE_DENYLIST');
});

test('guard 1: a name that is not a staging task name is refused (allow-rule)', (t) => {
	assertRefused(
		t,
		`${shaArg} -TaskName 'ATLAS-Staging-Supervisor-evil'`,
		'TASK_NAME_NOT_STAGING',
		[/ATLAS-Staging-Supervisor-evil/, /never a participant/i],
	);
	assertRefused(t, `${shaArg} -TaskName 'ATLAS-Runtime-Supervisor-2'`, 'TASK_NAME_NOT_STAGING');
	assertRefused(t, `${shaArg} -TaskName 'ATLAS-DevServer-Temp2'`, 'TASK_NAME_LIVE_DENYLIST');
});

test('guard 1: an empty or whitespace-only task name is refused', (t) => {
	assertRefused(t, `${shaArg} -TaskName '   '`, 'TASK_NAME_EMPTY', [/never a participant/i]);
});

test('guard 1: the allow-rule and deny-list are case-insensitive and the value is trimmed', (t) => {
	const command = [
		`. ${ps(guards)}`,
		`function Check($n) { try { return 'OK=' + (Assert-StagingTaskName -Name $n) } catch { return 'STOP=' + $_.Exception.Message } }`,
		`'lower=' + (Check 'atlas-staging-supervisor')`,
		`'mixed=' + (Check 'AtLaS-StAgInG-Supervisor')`,
		`'bare=' + (Check 'ATLAS-Staging')`,
		`'padded=' + (Check '  ATLAS-Staging-Supervisor  ')`,
		`'liveLower=' + (Check 'atlas-runtime-supervisor')`,
		`'empty=' + (Check '   ')`,
	].join('; ');
	const result = runPowerShell(command);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	const out = result.stdout;
	assert.match(out, /lower=OK=atlas-staging-supervisor/);
	assert.match(out, /mixed=OK=AtLaS-StAgInG-Supervisor/);
	assert.match(out, /bare=OK=ATLAS-Staging/);
	assert.match(out, /padded=OK=ATLAS-Staging-Supervisor/, 'a stray surrounding space must be trimmed off the task name');
	assert.match(out, /liveLower=STOP=TASK_NAME_LIVE_DENYLIST/);
	assert.match(out, /empty=STOP=TASK_NAME_EMPTY/);
});

// ---------------------------------------------------------- guard 2: paths

test('guard 2: a live release root is refused', (t) => {
	assertRefused(
		t,
		`${shaArg} -ReleaseRoot '${liveReleaseRoot}'`,
		'RELEASE_ROOT_OUTSIDE_STAGING',
		[/E:\\ATLAS-staging/, /not under the pinned staging root/i],
	);
});

test('guard 2: the sibling-prefix trap E:\\ATLAS-staging-evil is refused', (t) => {
	assertRefused(t, `${shaArg} -ReleaseRoot 'E:\\ATLAS-staging-evil'`, 'RELEASE_ROOT_OUTSIDE_STAGING');
});

test('guard 2: a .. traversal is refused on the RESOLVED path, not the literal one', (t) => {
	assertRefused(
		t,
		`${shaArg} -ReleaseRoot 'E:\\ATLAS-staging\\..\\ATLAS-worktrees\\lane-a4-release-20260928-1'`,
		'RELEASE_ROOT_OUTSIDE_STAGING',
		[/resolves to 'E:\\ATLAS-worktrees/],
	);
});

test('guard 2: the shared repo root and unsafe path shapes are refused', (t) => {
	assertRefused(t, `${shaArg} -ReleaseRoot 'D:\\ATLAS'`, 'RELEASE_ROOT_OUTSIDE_STAGING');
	assertRefused(t, `${shaArg} -ReleaseRoot 'relative-release-root'`, 'RELEASE_ROOT_NOT_ABSOLUTE', [/relative/i]);
	assertRefused(t, `${shaArg} -ReleaseRoot '\\\\server\\share'`, 'RELEASE_ROOT_NOT_ABSOLUTE', [/UNC/i]);
	assertRefused(t, `${shaArg} -ReleaseRoot 'E:\\ATLAS-staging\\*'`, 'RELEASE_ROOT_NOT_ABSOLUTE', [/wildcard/i]);
});

test('guard 2: the live env file is refused as -StagingEnvFile', (t) => {
	assertRefused(
		t,
		`${shaArg} -StagingEnvFile '${liveEnvFile}'`,
		'STAGING_ENV_LIVE_LEAF',
		[/atlas-server\.env/i, /atlas-staging\.env/i],
	);
	assertRefused(t, `${shaArg} -StagingEnvFile 'D:\\ATLAS-runtime-config\\ATLAS-SERVER.ENV'`, 'STAGING_ENV_LIVE_LEAF');
	assertRefused(t, `${shaArg} -StagingEnvFile 'D:\\ATLAS-runtime-config\\staging.env'`, 'STAGING_ENV_LEAF_MISMATCH');
	assertRefused(t, `${shaArg} -StagingEnvFile 'staging.env'`, 'STAGING_ENV_NOT_ABSOLUTE');
});

test('guard 2: the path helpers accept the pinned root with and without a trailing separator', (t) => {
	const command = [
		`. ${ps(guards)}`,
		`function Root($p) { try { return 'OK=' + (Assert-StagingReleaseRoot -Path $p) } catch { return 'STOP=' + $_.Exception.Message } }`,
		`function Env($p) { try { return 'OK=' + (Assert-StagingEnvFilePath -Path $p -LiveEnvFile '${liveEnvFile}') } catch { return 'STOP=' + $_.Exception.Message } }`,
		`'plain=' + (Root 'E:\\ATLAS-staging')`,
		`'trailing=' + (Root 'E:\\ATLAS-staging\\')`,
		`'upperDeep=' + (Root 'E:\\ATLAS-STAGING\\sub\\deep')`,
		`'envDefault=' + (Env '${stagingEnvFile}')`,
	].join('; ');
	const result = runPowerShell(command);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(result.stdout, /plain=OK=E:\\ATLAS-staging/);
	assert.match(result.stdout, /trailing=OK=E:\\ATLAS-staging/, 'a trailing separator must not change the resolved value');
	assert.match(result.stdout, /upperDeep=OK=E:\\ATLAS-STAGING\\sub\\deep/, 'the root comparison is case-insensitive');
	assert.ok(
		result.stdout.includes(`envDefault=OK=${stagingEnvFile}`),
		`the default staging env file must remain valid, got: ${result.stdout}`,
	);
});

test('guard 2: the guards run before the dry-run return, before any mutation, and before the mutex', (t) => {
	const firstGuard = source.indexOf('$TaskName       = Invoke-StagingGuard');
	assert.ok(firstGuard > -1, 'the task-name guard must be wired into preflight');
	// Compare against the MUTATION call sites, not the helper definitions above
	// preflight (Test-TaskExists/Stop-TaskIfPresent merely mention schtasks).
	const mutations = {
		'dry-run return': 'if (-not $Execute)',
		mutex: 'New-Object System.Threading.Mutex',
		'schtasks create/run': "Invoke-Native 'schtasks.exe'",
		'task stop call': 'Stop-TaskIfPresent -Name $TaskName',
		'worktree add': "'worktree', 'add'",
		'release root mkdir': 'New-Item -ItemType Directory',
		'env file write': 'Write-StagingEnvFile -Map',
		'database refresh': 'refresh-db.ps1',
	};
	for (const [what, needle] of Object.entries(mutations)) {
		const at = source.indexOf(needle, firstGuard);
		assert.ok(at > firstGuard, `the guards must precede the ${what} (${needle})`);
	}
	assert.match(source, /\. \(Join-Path \$PSScriptRoot 'staging-guards\.ps1'\)/);
});

// ------------------------------------------------- guard 3: no secret VALUES

test('guard 3: the client-build timeline line reports the key name and presence, never the origin value', (t) => {
	const command = [
		`. ${ps(guards)}`,
		`$set = Format-EnrollProClientBuildMark -Origin '${canary}'`,
		`$unset = Format-EnrollProClientBuildMark -Origin ''`,
		`'SET=' + $set`,
		`'UNSET=' + $unset`,
		`'LEAKS_SET=' + $set.Contains('${canary}')`,
		`'LEAKS_PARTIAL=' + $set.Contains('guard3-canary')`,
		`'LEAKS_UNSET=' + $unset.Contains('guard3-canary')`,
	].join('; ');
	const result = runPowerShell(command);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	const out = result.stdout;
	assert.match(out, /SET=client build \(vite, VITE_ENROLLPRO_URL key set: true\)/);
	assert.match(out, /UNSET=client build \(vite, VITE_ENROLLPRO_URL key set: false\)/);
	assert.match(out, /LEAKS_SET=False/, 'the origin value must not appear in the timeline line');
	assert.match(out, /LEAKS_PARTIAL=False/);
	assert.match(out, /LEAKS_UNSET=False/);
});

test('guard 3: the deploy script no longer interpolates the origin, and scrubs it out of build failures', (t) => {
	assert.doesNotMatch(source, /VITE_ENROLLPRO_URL=\$/, 'the timeline line must not interpolate the origin value');
	assert.match(source, /Mark \(Format-EnrollProClientBuildMark -Origin \$EnrollProOrigin\)/);
	// The origin is still EFFECTIVE: the build override itself is unchanged.
	assert.match(source, /\$env:VITE_ENROLLPRO_URL = \$EnrollProOrigin/);
	// And a failed build cannot echo it back through the refusal.
	assert.match(source, /\[string\[\]\] \$RedactValues = @\(\)/);
	assert.match(source, /-replace \[regex\]::Escape\(\$secret\), '\*\*\*'/);
	assert.match(source, /atlas-client'\) -RedactValues @\(\$EnrollProOrigin\)/);
});

test('guard 3: no line that reaches stdout interpolates a value out of an env map or a connection object', (t) => {
	// The risk is a VALUE interpolated into a message, not a key name compared
	// against a port. So scan only the double-quoted segments of every
	// stdout-reaching line for an env-map dereference or a secret property.
	const secretInterpolation = /\$\(?(?:liveMap|newMap|finalMap|existing|stagingMap|built)\[|\$\(\(?(?:liveConn|finalConn|stgConn|conn)\.(?:Password|Secret|Token)\b/;
	const offenders = [];
	for (const [index, line] of source.split('\n').entries()) {
		if (!/\bMark\b|\bFail\b|Write-Output|ConvertTo-Json/.test(line)) continue;
		for (const segment of line.match(/"[^"]*"/g) ?? []) {
			if (secretInterpolation.test(segment)) offenders.push(`${index + 1}: ${segment}`);
		}
	}
	assert.deepEqual(offenders, [], `these stdout-reaching strings interpolate a secret value: ${offenders.join(' | ')}`);
	// The deploy script must never even name the properties.
	assert.doesNotMatch(source, /\.Password\b/, 'deploy-staging.ps1 must not touch a credential property at all');
	assert.doesNotMatch(source, /\.Secret\b|\.Token\b/);
	// A key-NAME-only report is still allowed, and is what changed.
	assert.match(source, /Mark \(Format-EnrollProClientBuildMark/);
});

test('guard 3: a real dry-run prints no companion-origin value on stdout', (t) => {
	const { result, output } = dryRun(`${shaArg} -EnrollProOrigin '${canary}'`);
	assert.doesNotMatch(output, /RESULT=STOP/, 'the default parameters must still dry-run cleanly');
	assert.doesNotMatch(output, /guard3-canary/, 'no origin value may reach stdout');
	assert.equal(result.status, 0, output);
});

// ------------------------------------------------------ positive controls

test('positive control: the default parameters still produce a plan JSON and exit 0', (t) => {
	const { result, output } = dryRun(shaArg);
	assert.doesNotMatch(output, /RESULT=STOP/, `the default dry-run must not refuse:\n${output}`);
	assert.equal(result.status, 0, output);
	const plan = JSON.parse(result.stdout);
	assert.equal(plan.mode, 'dry-run');
	assert.equal(plan.mutates, false);
	assert.equal(plan.taskName, 'ATLAS-Staging-Supervisor');
	assert.equal(plan.releaseDir, `E:\\ATLAS-staging\\${headSha}`);
	assert.equal(plan.stagingEnvFile, stagingEnvFile);
	assert.equal(plan.secretsPrinted, false);
	assert.equal(plan.ports.server, 5101);
	assert.equal(plan.ports.client, 5274);
	assert.deepEqual(plan.livePorts, [5001, 5174]);
	assert.equal(plan.touchesLiveTask, false);
	assert.equal(plan.writesLiveDb, false);
});

test('positive control: -ReleaseRoot with a trailing separator is accepted', (t) => {
	const { result, output } = dryRun(`${shaArg} -ReleaseRoot 'E:\\ATLAS-staging\\'`);
	assert.doesNotMatch(output, /RESULT=STOP/, `a trailing separator must be accepted:\n${output}`);
	assert.equal(result.status, 0, output);
	const plan = JSON.parse(result.stdout);
	assert.equal(plan.releaseDir, `E:\\ATLAS-staging\\${headSha}`);
});

test('positive control: the guard module exists and is dot-sourceable without executing anything', (t) => {
	assert.match(guardSource, /^Set-StrictMode -Version Latest/m);
	// Purity is asserted over CODE, not prose: the comment blocks name these tools
	// while explaining what the guards protect against. Strip PowerShell comments
	// first, then require that no mutating or environment-reading command survives.
	const guardCode = stripPowerShellComments(guardSource);
	for (const command of [
		'Invoke-Native', 'Test-Path', 'Set-Item', 'Set-Acl', 'Remove-Item', 'New-Item',
		'Stop-Process', 'Start-Process', 'schtasks', 'robocopy', 'Set-Content', 'WriteAllText',
	]) {
		assert.doesNotMatch(
			guardCode,
			new RegExp(`^[ \\t]*(?:&\\s+)?(?:\\.\\s+)?${command}\\b`, 'm'),
			`the guard module must not invoke ${command}`,
		);
	}
	assert.doesNotMatch(guardCode, /\$env:[A-Z]|\[Environment\]::Set/);
	// Still the four guards, and still pure: dot-sourcing loads and calls them.
	for (const fn of [
		'Assert-StagingTaskName', 'Assert-StagingReleaseRoot',
		'Assert-StagingEnvFilePath', 'Format-EnrollProClientBuildMark',
	]) {
		assert.match(guardCode, new RegExp(`function ${fn}\\b`), `${fn} must remain in the module`);
	}
	const result = runPowerShell(`. ${ps(guards)}; 'LOADED=' + (Get-StagingGuardPolicy).ReleaseRoot`);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(result.stdout, /LOADED=E:\\ATLAS-staging/);
});
