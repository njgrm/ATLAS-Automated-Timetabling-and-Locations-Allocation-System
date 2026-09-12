import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { loadContract } from '../lib/contract.mjs';
import { BoundedLogger } from '../lib/logs.mjs';
import { Supervisor } from '../lib/supervisor.mjs';
import { inspectPortOwners } from '../lib/listeners.mjs';
import { isPidAlive } from '../lib/state.mjs';

const CONTRACT = loadContract();
const REAL_HOST_ENTRY = fileURLToPath(new URL('../host.mjs', import.meta.url));

function getFreePort() {
	return new Promise((resolvePromise) => {
		const probe = createServer();
		probe.listen(0, '127.0.0.1', () => {
			const port = probe.address().port;
			probe.close(() => resolvePromise(port));
		});
	});
}

const FIXTURE_API = `
import { createServer } from 'node:http';
const port = Number(process.env.PORT);
const server = createServer((req, res) => {
  if (req.url === '/api/v1/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'fixture' }));
    return;
  }
  if (req.url === '/api/v1/health/ready') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ready',
      rolloverAutoSyncEnabled: process.env.ROLLOVER_AUTO_SYNC_ENABLED,
      supervised: process.env.ATLAS_SUPERVISED,
    }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end('{}');
});
server.listen(port, '0.0.0.0', () => console.log('[fixture] listening on ' + port));
`;

test('isolated end-to-end lifecycle owns both ports, verifies dependency readiness, and cleans up', { timeout: 90000 }, async () => {
	const workspace = mkdtempSync(join(tmpdir(), 'atlas-e2e-'));
	const staticRoot = join(workspace, 'dist');
	mkdirSync(join(staticRoot, 'assets'), { recursive: true });
	writeFileSync(join(staticRoot, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/index-abc12345.js"></script></body></html>');
	writeFileSync(join(staticRoot, 'assets', 'index-abc12345.js'), 'console.log("built")');
	const fixtureEntry = join(workspace, 'fixture-api.mjs');
	writeFileSync(fixtureEntry, FIXTURE_API);

	const serverPort = await getFreePort();
	const clientPort = await getFreePort();
	const contract = JSON.parse(JSON.stringify(CONTRACT));
	contract.ports = { server: serverPort, client: clientPort };
	contract.supervision.maxRestarts = 2;
	contract.supervision.backoffBaseMs = 200;
	contract.supervision.backoffMaxMs = 800;
	contract.supervision.survivalWindowMs = 1000;
	contract.supervision.readinessTimeoutMs = 20000;
	contract.supervision.livenessTimeoutMs = 2000;
	contract.supervision.shutdownGraceMs = 10000;

	const invariant = { ROLLOVER_AUTO_SYNC_ENABLED: 'false', ATLAS_SUPERVISED: 'true' };
	const targets = [
		{
			name: 'server',
			label: 'fixture ATLAS server',
			entry: fixtureEntry,
			args: [],
			cwd: workspace,
			port: serverPort,
			env: { ...process.env, PORT: String(serverPort), ...invariant },
			livenessPath: '/api/v1/health',
			readinessPath: '/api/v1/health/ready',
		},
		{
			name: 'client',
			label: 'ATLAS production host',
			entry: REAL_HOST_ENTRY,
			args: [],
			cwd: process.cwd(),
			port: clientPort,
			env: {
				...process.env,
				...invariant,
				ATLAS_HOST_STATIC_ROOT: staticRoot,
				ATLAS_HOST_API_TARGET: `http://127.0.0.1:${serverPort}`,
				ATLAS_HOST_ENROLLPRO_TARGET: `http://127.0.0.1:${serverPort}`,
				ATLAS_HOST_PORT: String(clientPort),
			},
			livenessPath: '/__host/live',
			readinessPath: '/__host/ready',
		},
	];

	const logger = new BoundedLogger({ directory: join(workspace, 'logs'), fileBaseName: 'e2e', maxBytes: 200000, maxFiles: 3 });
	const supervisor = new Supervisor({
		contract,
		sourceDir: workspace,
		logger,
		targets,
		statePath: join(workspace, 'state.json'),
	});
	let status = null;
	try {
		status = await supervisor.start();
		assert.equal(status.state, 'running');

		const serverOwners = inspectPortOwners(serverPort);
		const clientOwners = inspectPortOwners(clientPort);
		assert.deepEqual(serverOwners, [status.targets[0].pid], 'exactly one owner on the server port (our child)');
		assert.deepEqual(clientOwners, [status.targets[1].pid], 'exactly one owner on the client port (our child)');
		assert.notEqual(status.targets[0].pid, status.targets[1].pid);

		const deepLink = await fetch(`http://127.0.0.1:${clientPort}/dashboard`);
		assert.equal(deepLink.status, 200);
		assert.match(await deepLink.text(), /id="root"/);

		const readiness = await fetch(`http://127.0.0.1:${clientPort}/api/v1/health/ready`);
		assert.equal(readiness.status, 200);
		const body = await readiness.json();
		assert.equal(body.rolloverAutoSyncEnabled, 'false', 'rollover automation is pinned disabled through the live proxy path');
		assert.equal(body.supervised, 'true', 'supervised opt-in is propagated to the server child');

		await supervisor.stop();
		assert.deepEqual(inspectPortOwners(serverPort), [], 'server port released after stop');
		assert.deepEqual(inspectPortOwners(clientPort), [], 'client port released after stop');
		assert.equal(isPidAlive(status.targets[0].pid), false, 'server child terminated');
		assert.equal(isPidAlive(status.targets[1].pid), false, 'client child terminated');
	} finally {
		for (const handle of supervisor.children.values()) {
			try {
				execFileSync('taskkill', ['/PID', String(handle.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
			} catch {
				/* already gone */
			}
		}
		for (const port of [serverPort, clientPort]) {
			for (const pid of inspectPortOwners(port)) {
				try {
					execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
				} catch {
					/* already gone */
				}
			}
		}
		rmSync(workspace, { recursive: true, force: true });
	}
});
