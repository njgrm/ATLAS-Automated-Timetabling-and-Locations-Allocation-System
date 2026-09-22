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
		`([BitConverter]::ToString($out[0..1]) + '|' + [Text.UnicodeEncoding]::new($false, $true).GetString($out))`,
	].join('; ');
	const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' });
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.equal(result.stdout.trim(), 'FF-FE|\ufeff<?xml version="1.0" encoding="UTF-16"?><A>C:/new/pathxx C:/new/pathxx</A>');
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

	const relative = valid.replace("-TargetSourceDir 'C:\\valid-target'", "-TargetSourceDir 'relative-target'");
	const relativeResult = spawnSync('powershell.exe', [
		'-NoProfile', '-NonInteractive', '-Command', relative,
	], { encoding: 'utf8' });
	const relativeOutput = `${relativeResult.stdout}\n${relativeResult.stderr}`;
	assert.notEqual(relativeResult.status, 0);
	assert.match(relativeOutput, /Cannot validate argument|parameter.*TargetSourceDir/i);
	assert.doesNotMatch(relativeOutput, /DEPLOY_RUNNER_STOP:/);
});
