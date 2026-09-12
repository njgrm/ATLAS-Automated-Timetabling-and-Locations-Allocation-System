import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { BoundedLogger, formatLogLine, measureLogFootprint, redactSecretValues } from '../lib/logs.mjs';

test('log lines carry an ISO timestamp, level, and component', () => {
	const line = formatLogLine({ level: 'warn', component: 'supervisor', message: 'hello', now: new Date('2026-09-12T00:00:00.000Z') });
	assert.equal(line, '2026-09-12T00:00:00.000Z [warn] [supervisor] hello\n');
});

test('secret values are redacted from log text', () => {
	const redacted = redactSecretValues('token=super-secret-value and db=postgresql://u:p@h/db', ['super-secret-value']);
	assert.ok(!redacted.includes('super-secret-value'));
	assert.ok(redacted.includes('***REDACTED***'));
});

test('logger bounds file count and size for unbounded writes', () => {
	const dir = mkdtempSync(join(tmpdir(), 'atlas-logs-'));
	try {
		const logger = new BoundedLogger({ directory: dir, fileBaseName: 'test', maxBytes: 500, maxFiles: 3, secretValues: ['leaky-secret-value'] });
		for (let i = 0; i < 200; i += 1) {
			logger.info(`line ${i} ${'x'.repeat(40)} leaky-secret-value`);
		}
		const files = readdirSync(dir);
		const footprint = measureLogFootprint(dir, 'test');
		assert.equal(footprint.fileCount, 3);
		assert.ok(footprint.bytes < 500 * 3 + 200, `footprint unexpectedly large: ${footprint.bytes}`);
		for (const file of files) {
			const content = readFileSync(join(dir, file), 'utf8');
			assert.ok(!content.includes('leaky-secret-value'), `secret leaked into ${file}`);
		}
		const active = readFileSync(join(dir, 'test.log'), 'utf8');
		assert.ok(active.includes('line 199'), 'active transcript retains the newest line');
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
