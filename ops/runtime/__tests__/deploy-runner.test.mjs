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

test('runner narrows process termination to the resolved supervisor PID tree', () => {
	assert.match(source, /taskkill.*\/PID.*\/T.*\/F/);
	assert.doesNotMatch(source, /taskkill.*\/IM/i);
	assert.match(source, /CommandLine -notlike.*ops\\runtime\\cli\.mjs/);
});

test('runner cannot turn into a build, install, migration, or database operation', () => {
	assert.doesNotMatch(source, /npm\s+(ci|install|run\s+build)/i);
	assert.doesNotMatch(source, /prisma|DATABASE_URL|db\s+push|migrate/i);
	assert.match(source, /secretsPrinted = \$false/);
});
