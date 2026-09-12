import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

/**
 * Requirement 8: once supervision is active, an uncaught exception must fail the
 * server process so the supervisor can perform a bounded clean restart, while
 * the legacy log-and-continue policy remains the default without supervision.
 *
 * This exercises the real built handler. It skips only when the server has not
 * been built yet (`atlas-server/dist` absent), which the release gate always
 * builds first.
 */
const HANDLER = fileURLToPath(new URL('../../../atlas-server/dist/services/crash-handler.service.js', import.meta.url));
const HANDLER_URL = new URL(`file:///${HANDLER.replace(/\\/g, '/')}`).href;

function writeCrashScript(dir) {
	const script = join(dir, 'crash-probe.mjs');
	writeFileSync(
		script,
		[
			`import { registerProcessCrashHandlers } from ${JSON.stringify(HANDLER_URL)};`,
			'registerProcessCrashHandlers();',
			'setInterval(() => {}, 1000);',
			"setTimeout(() => { throw new Error('supervised-boom'); }, 100);",
		].join('\n'),
	);
	return script;
}

function waitForExit(child, timeoutMs) {
	return new Promise((resolvePromise) => {
		const timer = setTimeout(() => resolvePromise({ timedOut: true }), timeoutMs);
		child.on('exit', (code, signal) => {
			clearTimeout(timer);
			resolvePromise({ timedOut: false, code, signal });
		});
	});
}

test('uncaught exception exits the process under supervision', { skip: !existsSync(HANDLER) && 'atlas-server/dist not built' }, async () => {
	const dir = mkdtempSync(join(tmpdir(), 'atlas-crash-'));
	const script = writeCrashScript(dir);
	let stderr = '';
	try {
		const child = spawn(process.execPath, [script], { env: { ...process.env, ATLAS_SUPERVISED: 'true' }, stdio: ['ignore', 'ignore', 'pipe'] });
		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});
		const outcome = await waitForExit(child, 8000);
		assert.equal(outcome.timedOut, false, 'supervised process must exit');
		assert.equal(outcome.code, 1);
		assert.match(stderr, /\[FATAL\] \[uncaughtException\]/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('without supervision the legacy log-and-continue policy is preserved', { skip: !existsSync(HANDLER) && 'atlas-server/dist not built' }, async () => {
	const dir = mkdtempSync(join(tmpdir(), 'atlas-crash-'));
	const script = writeCrashScript(dir);
	try {
		const env = { ...process.env };
		delete env.ATLAS_SUPERVISED;
		delete env.ATLAS_EXIT_ON_UNCAUGHT;
		const child = spawn(process.execPath, [script], { env, stdio: ['ignore', 'ignore', 'pipe'] });
		const outcome = await waitForExit(child, 1500);
		assert.equal(outcome.timedOut, true, 'unsupervised process must keep serving after an uncaught exception');
		child.kill();
		await waitForExit(child, 4000);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
