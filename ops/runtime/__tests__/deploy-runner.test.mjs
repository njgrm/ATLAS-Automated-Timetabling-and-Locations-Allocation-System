import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const runner = join(here, '..', 'deploy-runner.ps1');
const source = readFileSync(runner, 'utf8');

test('deployment runner is dry-run by default and has an explicit execute switch', () => {
	assert.match(source, /\[switch\]\s*\$Execute/);
	assert.match(source, /if \(-not \$Execute\)/);
	assert.match(source, /mutates = \[bool\]\$Execute/);
	assert.doesNotMatch(source, /encoding="UTF-8"/i, 'task XML declaration must never be rewritten');
	assert.match(source, /ReadAllBytes/);
	assert.match(source, /WriteAllBytes/);
});

test('byte-preserving task path replacement keeps the XML declaration and requires two references', () => {
	const command = [
		`\. '${runner.replaceAll("'", "''")}'`,
		`$bytes = [Text.Encoding]::ASCII.GetBytes('<?xml version="1.0" encoding="UTF-16"?><A>C:/old/pathxx C:/old/pathxx</A>')`,
		`$out = Replace-TaskSourceBytes $bytes 'C:/old/pathxx' 'C:/new/pathxx'`,
		`[Text.Encoding]::ASCII.GetString($out)`,
	].join('; ');
	const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' });
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.equal(result.stdout.trim(), '<?xml version="1.0" encoding="UTF-16"?><A>C:/new/pathxx C:/new/pathxx</A>');
});

test('task path replacement supports a BOM-marked UTF-16LE task export', () => {
	const command = [
		`\. '${runner.replaceAll("'", "''")}'`,
		`$xml = '<?xml version="1.0" encoding="UTF-16"?><A>C:/old/pathxx C:/old/pathxx</A>'`,
		`$encoding = [Text.UnicodeEncoding]::new($false, $true)`,
		`$bytes = $encoding.GetPreamble() + $encoding.GetBytes($xml)`,
		`$out = Replace-TaskSourceBytes $bytes 'C:/old/pathxx' 'C:/new/pathxx'`,
		// Assert the BOM bytes and decode the payload past them: the console
		// cannot reliably round-trip a leading U+FEFF through stdout, so the
		// previous whole-string comparison was encoding-dependent.
		`([BitConverter]::ToString($out[0..1]) + '|' + [Text.Encoding]::Unicode.GetString($out, 2, $out.Length - 2))`,
	].join('; ');
	const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' });
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.equal(result.stdout.trim(), 'FF-FE|<?xml version="1.0" encoding="UTF-16"?><A>C:/new/pathxx C:/new/pathxx</A>');
});

test('runner narrows process termination to the resolved supervisor PID tree', () => {
	assert.match(source, /taskkill.*\/PID.*\/T.*\/F/);
	assert.doesNotMatch(source, /taskkill.*\/IM/i);
	assert.match(source, /CommandLine -notlike.*ops\\runtime\\cli\.mjs/);
	assert.match(source, /remainingListeners/);
	assert.match(source, /portsCleared/);
	assert.match(source, /remainingListeners.*Count -ne 0/);
});

test('runner cannot turn into a build, install, migration, or database operation', () => {
	assert.doesNotMatch(source, /npm\s+(ci|install|run\s+build)/i);
	assert.doesNotMatch(source, /prisma|DATABASE_URL|db\s+push|migrate/i);
	assert.match(source, /secretsPrinted = \$false/);
});

test('Windows PowerShell 5.1 accepts rooted paths and rejects relative paths before runner preflight', () => {
	const valid = [
		`& '${runner.replaceAll("'", "''")}'`,
		`-TargetSha ${'a'.repeat(40)}`,
		`-TargetSourceDir 'C:\\valid-target'`,
		`-IncumbentSha ${'b'.repeat(40)}`,
		`-IncumbentSourceDir 'C:\\valid-incumbent'`,
		`-EnvFile 'C:\\valid.env'`,
	].join(' ');
	const validResult = spawnSync('powershell.exe', [
		'-NoProfile', '-NonInteractive', '-Command', valid,
	], { encoding: 'utf8' });
	const validOutput = `${validResult.stdout}\n${validResult.stderr}`;
	assert.notEqual(validResult.status, 0, 'the missing fixture target must stop preflight');
	assert.doesNotMatch(validOutput, /IsPathFullyQualified/);
	assert.match(validOutput, /DEPLOY_RUNNER_STOP:|git failed with exit code/);

	const validUnc = valid.replace("-TargetSourceDir 'C:\\valid-target'", "-TargetSourceDir '\\\\server\\share'");
	const validUncResult = spawnSync('powershell.exe', [
		'-NoProfile', '-NonInteractive', '-Command', validUnc,
	], { encoding: 'utf8' });
	const validUncOutput = `${validUncResult.stdout}\n${validUncResult.stderr}`;
	assert.notEqual(validUncResult.status, 0);
	assert.doesNotMatch(validUncOutput, /IsPathFullyQualified/);
	assert.match(validUncOutput, /DEPLOY_RUNNER_STOP:|git failed with exit code/);

	const relative = valid.replace("-TargetSourceDir 'C:\\valid-target'", "-TargetSourceDir 'relative-target'");
	const relativeResult = spawnSync('powershell.exe', [
		'-NoProfile', '-NonInteractive', '-Command', relative,
	], { encoding: 'utf8' });
	const relativeOutput = `${relativeResult.stdout}\n${relativeResult.stderr}`;
	assert.notEqual(relativeResult.status, 0);
	assert.match(relativeOutput, /Cannot validate argument|parameter.*TargetSourceDir/i);
	assert.doesNotMatch(relativeOutput, /DEPLOY_RUNNER_STOP:/);

	const bareUnc = valid.replace("-TargetSourceDir 'C:\\valid-target'", "-TargetSourceDir '\\\\'");
	const bareUncResult = spawnSync('powershell.exe', [
		'-NoProfile', '-NonInteractive', '-Command', bareUnc,
	], { encoding: 'utf8' });
	const bareUncOutput = `${bareUncResult.stdout}\n${bareUncResult.stderr}`;
	assert.notEqual(bareUncResult.status, 0);
	assert.match(bareUncOutput, /Cannot validate argument|parameter.*TargetSourceDir/i);
	assert.doesNotMatch(bareUncOutput, /DEPLOY_RUNNER_STOP:/);
});

// --- DEPLOY-RUNNER-LIVE-STATE-GATE-C01 acceptance rows (A1-A7) ---

const gateTargetPrefix = 'abcdef12';
const gateTarget = gateTargetPrefix + '0'.repeat(32);
const gateIncumbentPrefix = 'c0ffee11';
const gateIncumbent = gateIncumbentPrefix + '0'.repeat(32);
const repoTargetDir = join(here, '..', '..', '..');
const repoTargetDirEsc = repoTargetDir.replaceAll("'", "''");

function runPowerShell(command) {
	return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' });
}

function gateCommand(body) {
	return [`\. '${runner.replaceAll("'", "''")}'`, ...body].join('; ');
}

test('A1: live-release gate passes when the 8-char target prefix appears in the Live release section', () => {
	const command = gateCommand([
		`$text = [string]::Join([char]10, @('## Live release', '- Release SHA: ${gateTargetPrefix} current; rollback basis ${gateIncumbentPrefix}', '', '## Objective', '- unrelated'))`,
		`try { Assert-LiveReleaseRecorded $text '${gateTarget}' '${gateIncumbent}' 'origin/main'; 'RESULT=PASS' } catch { 'RESULT=STOP:' + $_.Exception.Message }`,
	]);
	const result = runPowerShell(command);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.equal(result.stdout.trim(), 'RESULT=PASS');
});

test('A2: live-release gate throws DEPLOY_RUNNER_STOP naming the missing target prefix when the section omits it', () => {
	const command = gateCommand([
		`$text = [string]::Join([char]10, @('## Live release', '- Release SHA: deadbeef current', '', '## Objective', '- unrelated'))`,
		`try { Assert-LiveReleaseRecorded $text '${gateTarget}' '${gateIncumbent}' 'origin/main'; 'RESULT=PASS' } catch { 'RESULT=STOP:' + $_.Exception.Message }`,
	]);
	const result = runPowerShell(command);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	const out = result.stdout.trim();
	assert.match(out, /^RESULT=STOP:/);
	assert.match(out, /DEPLOY_RUNNER_STOP/);
	assert.match(out, new RegExp(gateTargetPrefix));
	assert.match(out, /live-state\.md/);
	assert.match(out, /origin\/main/);
});

test('A3: live-release gate throws when the target prefix appears only outside the Live release section (decisive control)', () => {
	const command = gateCommand([
		`$text = [string]::Join([char]10, @('## Live release', '- Release SHA: deadbeef current', '', '## Historical', '- retired release ${gateTargetPrefix} elsewhere'))`,
		`$real = 'PASS'`,
		`try { Assert-LiveReleaseRecorded $text '${gateTarget}' '${gateIncumbent}' 'origin/main' } catch { $real = 'STOP:' + $_.Exception.Message }`,
		`$naiveThrows = [bool]($text -notmatch [regex]::Escape('${gateTargetPrefix}'))`,
		`'REAL=' + $real + '|NAIVE_THROWS=' + $naiveThrows`,
	]);
	const result = runPowerShell(command);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	const out = result.stdout.trim();
	assert.match(out, /REAL=STOP:/);
	assert.match(out, /DEPLOY_RUNNER_STOP/);
	assert.match(out, new RegExp(gateTargetPrefix));
	assert.match(out, /NAIVE_THROWS=False/, 'a naive whole-file check would wrongly pass A3');
});

test('decisive control: the 2026-09-23 drift timeline is refused — a section naming only the incumbent does not satisfy the target-keyed gate', () => {
	const timelineTargetPrefix = '0232bf9c';
	const timelineTarget = timelineTargetPrefix + 'b'.repeat(32);
	const timelineIncumbentPrefix = '89012430';
	const timelineIncumbent = timelineIncumbentPrefix + 'c'.repeat(32);
	const command = gateCommand([
		`$text = [string]::Join([char]10, @('## Live release', '- Release SHA: ${timelineIncumbentPrefix} (rollback basis)', '', '## Objective', '- unrelated'))`,
		`try { Assert-LiveReleaseRecorded $text '${timelineTarget}' '${timelineIncumbent}' 'origin/main'; 'RESULT=PASS' } catch { 'RESULT=STOP:' + $_.Exception.Message }`,
	]);
	const result = runPowerShell(command);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	const out = result.stdout.trim();
	assert.match(out, /^RESULT=STOP:/, 'a section naming only the incumbent must not satisfy the gate');
	assert.match(out, /DEPLOY_RUNNER_STOP/);
	assert.match(out, new RegExp(timelineTargetPrefix), 'the refusal must name the unrecorded target prefix');
	assert.match(out, new RegExp(timelineIncumbentPrefix), 'the refusal guidance must name the rollback basis (incumbent)');
	assert.match(out, /live-state\.md/);
});

test('live-release gate fails closed when the Live release section is absent', () => {
	const command = gateCommand([
		`$text = [string]::Join([char]10, @('# ATLAS Live State', '', '## Objective', '- mentions ${gateTargetPrefix}'))`,
		`try { Assert-LiveReleaseRecorded $text '${gateTarget}' '${gateIncumbent}' 'origin/main'; 'RESULT=PASS' } catch { 'RESULT=STOP:' + $_.Exception.Message }`,
	]);
	const result = runPowerShell(command);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(result.stdout.trim(), /^RESULT=STOP:/);
	assert.match(result.stdout, new RegExp(gateTargetPrefix));
});

test('A4: the live-release gate runs before the dry-run return and before any mutation or audit write', () => {
	const callIndex = source.indexOf('Assert-LiveReleaseRecorded $liveStateText');
	assert.ok(callIndex > -1, 'the gate must be invoked with resolved live-state text');
	assert.ok(callIndex > source.indexOf('$machine = Get-MachineIdentity'), 'gate must follow target/machine identity checks');
	assert.ok(callIndex < source.indexOf('if (-not $Execute)'), 'gate must precede the dry-run return');
	assert.ok(callIndex < source.indexOf('taskkill'), 'gate must precede the mutation block');
	assert.ok(callIndex < source.indexOf('New-Item -ItemType Directory'), 'gate must precede audit directory creation');
});

test('A4b: the gate call site passes the target as the gate key and the incumbent only as recovery context', () => {
	assert.match(
		source,
		/Assert-LiveReleaseRecorded \$liveStateText \$TargetSha \$IncumbentSha \$LiveStateRef/,
		'the call site must pass the target first and the incumbent as recovery context',
	);
	assert.doesNotMatch(
		source,
		/Assert-LiveReleaseRecorded \$liveStateText \$IncumbentSha \$LiveStateRef/,
		'the incumbent must never occupy the target slot',
	);
});

test('A5: the gate reads a committed ref and fails closed against a non-existent ref', () => {
	assert.match(source, /'show'/);
	assert.match(source, /\$\(\$Ref\):docs\/plans\/live-state\.md/);
	assert.match(source, /is empty at ref/);
	assert.doesNotMatch(source, /ReadAllText\([^)]*live-state/, 'must not read the working tree');
	const command = gateCommand([
		`try { Get-LiveStateText '${repoTargetDirEsc}' 'atlas-live-state-no-such-ref'; 'RESULT=PASS' } catch { 'RESULT=STOP:' + $_.Exception.Message }`,
	]);
	const result = runPowerShell(command);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(result.stdout.trim(), /^RESULT=STOP:/);
	assert.doesNotMatch(result.stdout, /RESULT=PASS/);
	assert.match(result.stdout, /atlas-live-state-no-such-ref|DEPLOY_RUNNER_STOP|git/i, 'the failure must name the ref or the runner stop form');
});

test('A7: -LiveStateRef is documented in the parameter block and defaults to origin/main', () => {
	assert.match(source, /\[string\]\s*\$LiveStateRef\s*=\s*'origin\/main'/);
	assert.match(source, /#\s*-LiveStateRef:[^\n]*origin\/main/);
	assert.match(source, /#\s*-LiveStateRef:[^\n]*live-state\.md/);
});
