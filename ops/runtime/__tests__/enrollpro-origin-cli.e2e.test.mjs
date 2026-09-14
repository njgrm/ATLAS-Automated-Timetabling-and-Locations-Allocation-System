import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadContract, validateContract } from '../lib/contract.mjs';
import { runCli, statePathFor } from '../cli.mjs';
import { inspectPortOwners } from '../lib/listeners.mjs';
import { isPidAlive } from '../lib/state.mjs';

const CONTRACT = loadContract();
const CLI_URL = new URL('../cli.mjs', import.meta.url).href;
const RELEASE_SHA = 'abcdef0123456789abcdef0123456789abcdef01';
const DURABLE = 'https://dev-jegs.buru-degree.ts.net';

/**
 * The workspace doubles as `ATLAS_RUNTIME_SOURCE_DIR`, so `buildTargets`
 * spawns these fixture entries exactly as production would spawn the real
 * server and `ops/runtime/host.mjs`.
 */
const FIXTURE_SERVER = `
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
const port = Number(process.env.PORT);
if (process.env.MARKER_FILE) appendFileSync(process.env.MARKER_FILE, 'server\\n');
const server = createServer((req, res) => {
  if (req.url === '/api/v1/health') { res.writeHead(200, {'content-type':'application/json'}); res.end('{"status":"ok"}'); return; }
  if (req.url === '/api/v1/health/ready') { res.writeHead(200, {'content-type':'application/json'}); res.end('{"status":"ready"}'); return; }
  res.writeHead(404, {'content-type':'application/json'}); res.end('{}');
});
server.listen(port, '0.0.0.0', () => console.log('[fixture-server] listening ' + port));
`;

const FIXTURE_HOST = `
import { createServer } from 'node:http';
import { appendFileSync, writeFileSync } from 'node:fs';
const port = Number(process.env.ATLAS_HOST_PORT);
if (process.env.MARKER_FILE) appendFileSync(process.env.MARKER_FILE, 'host\\n');
if (process.env.RECORD_FILE) {
  writeFileSync(process.env.RECORD_FILE, JSON.stringify({
    enrollProTarget: process.env.ATLAS_HOST_ENROLLPRO_TARGET ?? null,
    apiTarget: process.env.ATLAS_HOST_API_TARGET ?? null,
  }));
}
const server = createServer((req, res) => {
  if (req.url === '/__host/live') { res.writeHead(200, {'content-type':'application/json'}); res.end('{"status":"live"}'); return; }
  if (req.url === '/__host/ready') { res.writeHead(200, {'content-type':'application/json'}); res.end('{"status":"ready"}'); return; }
  res.writeHead(200, {'content-type':'text/html'}); res.end('<html></html>');
});
server.listen(port, '0.0.0.0', () => console.log('[fixture-host] listening ' + port));
`;

/** Drives the real `runCli` entry point inside its own OS process. */
const DRIVER = `
import { readFileSync } from 'node:fs';
import { runCli } from ${JSON.stringify(CLI_URL)};
const contract = JSON.parse(readFileSync(process.env.CONTRACT_FILE, 'utf8'));
const result = await runCli([process.argv[2]], {
  contract,
  env: process.env,
  resolveHead: () => process.env.ATLAS_RUNTIME_RELEASE_SHA,
  isAncestor: () => true,
});
process.stdout.write(result.output + '\\n');
process.exitCode = result.exitCode;
`;

function getFreePort() {
	return new Promise((resolvePromise) => {
		const probe = createServer();
		probe.listen(0, '127.0.0.1', () => {
			const port = probe.address().port;
			probe.close(() => resolvePromise(port));
		});
	});
}

async function makeWorkspace(durableOrigin) {
	const base = mkdtempSync(join(tmpdir(), 'atlas-rrtc-'));
	const workspace = join(base, 'release');
	const operator = join(base, 'operator');
	mkdirSync(workspace, { recursive: true });
	mkdirSync(operator, { recursive: true });
	mkdirSync(join(workspace, 'ops', 'runtime'), { recursive: true });
	writeFileSync(join(workspace, 'fixture-server.mjs'), FIXTURE_SERVER);
	writeFileSync(join(workspace, 'ops', 'runtime', 'host.mjs'), FIXTURE_HOST);
	writeFileSync(join(workspace, 'driver.mjs'), DRIVER);

	const markerFile = join(base, 'spawn-marker.txt');
	const recordFile = join(base, 'host-record.json');
	const envFile = join(operator, 'durable.env');
	const lines = [
		'DATABASE_URL=postgresql://user:pass@localhost:5432/atlas',
		'JWT_SECRET=durable-test-secret-value',
		`MARKER_FILE=${markerFile}`,
		`RECORD_FILE=${recordFile}`,
	];
	if (durableOrigin !== undefined) lines.push(`ENROLLPRO_PROXY_ORIGIN=${durableOrigin}`);
	writeFileSync(envFile, `${lines.join('\n')}\n`);

	const contract = JSON.parse(JSON.stringify(CONTRACT));
	contract.ports = { server: await getFreePort(), client: await getFreePort() };
	contract.serverEntry = 'fixture-server.mjs';
	contract.supervision.maxRestarts = 2;
	// A long backoff keeps the resident start supervisor from respawning its
	// children inside the window between a separate `stop` process and the
	// test's own termination of that supervisor process.
	contract.supervision.backoffBaseMs = 5000;
	contract.supervision.backoffMaxMs = 10000;
	contract.supervision.survivalWindowMs = 1000;
	contract.supervision.readinessTimeoutMs = 20000;
	contract.supervision.livenessTimeoutMs = 2000;
	contract.supervision.shutdownGraceMs = 10000;
	validateContract(contract);
	writeFileSync(join(base, 'contract.json'), JSON.stringify(contract));

	const env = {
		...process.env,
		ATLAS_RUNTIME_ENV_FILE: envFile,
		ATLAS_RUNTIME_SOURCE_DIR: workspace,
		ATLAS_RUNTIME_RELEASE_SHA: RELEASE_SHA,
		ATLAS_RUNTIME_LOG_DIR: join(base, 'logs'),
		CONTRACT_FILE: join(base, 'contract.json'),
	};
	delete env.ENROLLPRO_PROXY_ORIGIN;

	const deps = { contract, env, resolveHead: () => RELEASE_SHA, isAncestor: () => true };
	return {
		base,
		workspace,
		contract,
		env,
		deps,
		markerFile,
		recordFile,
		envFile,
		driverPath: join(workspace, 'driver.mjs'),
		cleanup: () => rmSync(base, { recursive: true, force: true }),
	};
}

/** Let any final child stdout drain before the temporary tree is removed. */
async function settle() {
	await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
}

function killTree(pid) {
	if (!Number.isInteger(pid) || pid <= 0) return;
	try {
		execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
	} catch {
		/* already gone */
	}
}

function forceKillOwned(workspace, contract) {
	const statePath = statePathFor(workspace, contract);
	if (!existsSync(statePath)) return;
	try {
		const state = JSON.parse(readFileSync(statePath, 'utf8'));
		for (const pid of Object.values(state.ownedPids ?? {})) killTree(pid);
	} catch {
		/* best effort */
	}
}

async function waitFor(predicate, timeoutMs, label) {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		if (await predicate()) return;
		if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
	}
}

test('CLI start fails closed with a missing durable EnrollPro origin and spawns nothing', async () => {
	const fx = await makeWorkspace(undefined);
	try {
		const result = await runCli(['start'], fx.deps);
		assert.equal(result.exitCode, 1, result.output);
		assert.equal(JSON.parse(result.output).code, 'ENROLLPRO_PROXY_ORIGIN_MISSING');
		assert.equal(existsSync(fx.markerFile), false, 'no fixture entry may execute');
		assert.equal(existsSync(fx.recordFile), false, 'no production host may run');

		// stop/status remain usable even when the launch origin is missing.
		assert.equal((await runCli(['status'], fx.deps)).exitCode, 0);
		assert.equal((await runCli(['stop'], fx.deps)).exitCode, 0);
	} finally {
		forceKillOwned(fx.workspace, fx.contract);
		await settle();
		fx.cleanup();
	}
});

test('CLI start fails closed with a malformed durable EnrollPro origin and spawns nothing', async () => {
	const fx = await makeWorkspace(`${DURABLE}/personnel/login`);
	try {
		const result = await runCli(['start'], fx.deps);
		assert.equal(result.exitCode, 1, result.output);
		assert.equal(JSON.parse(result.output).code, 'ENROLLPRO_PROXY_ORIGIN_INVALID');
		assert.equal(existsSync(fx.markerFile), false, 'no fixture entry may execute');
		assert.equal(existsSync(fx.recordFile), false, 'no production host may run');
	} finally {
		forceKillOwned(fx.workspace, fx.contract);
		await settle();
		fx.cleanup();
	}
});

test('CLI start propagates the durable normalized origin to the production host and stop cleans up', { timeout: 90000 }, async () => {
	const fx = await makeWorkspace(`${DURABLE}/`);
	let supervisorProcess = null;
	let supervisorOutput = '';
	try {
		supervisorProcess = spawn(process.execPath, [fx.driverPath, 'start'], { env: fx.env, stdio: ['ignore', 'pipe', 'pipe'] });
		supervisorProcess.stdout.on('data', (chunk) => { supervisorOutput += chunk.toString(); });
		supervisorProcess.stderr.on('data', (chunk) => { supervisorOutput += chunk.toString(); });

		const statePath = statePathFor(fx.workspace, fx.contract);
		const readStateOrNull = () => {
			try {
				return JSON.parse(readFileSync(statePath, 'utf8'));
			} catch {
				return null;
			}
		};
		await waitFor(
			() => supervisorProcess.exitCode !== null || readStateOrNull()?.state === 'running',
			30000,
			'the supervised runtime to become running',
		);
		assert.equal(supervisorProcess.exitCode, null, `start supervisor exited early: ${supervisorOutput}`);

		const state = readStateOrNull();
		assert.equal(state.state, 'running');
		const pids = Object.values(state.ownedPids);
		assert.equal(pids.length, 2);

		const record = JSON.parse(readFileSync(fx.recordFile, 'utf8'));
		assert.equal(record.enrollProTarget, DURABLE, 'the production host received the normalized durable origin');
		assert.equal(record.apiTarget, `http://127.0.0.1:${fx.contract.ports.server}`);
		assert.equal(existsSync(fx.markerFile), true, 'a fixture entry executed');

		const stopped = spawnSync(process.execPath, [fx.driverPath, 'stop'], { env: fx.env, encoding: 'utf8', windowsHide: true });
		assert.equal(stopped.status, 0, `${stopped.stdout}\n${stopped.stderr}`);

		// A real operator stop would end the resident supervisor process too; do
		// that here before asserting the terminal cleanup state.
		killTree(supervisorProcess.pid);
		await new Promise((resolvePromise) => supervisorProcess.once('exit', resolvePromise));
		killTree(supervisorProcess.pid);
		await settle();

		assert.deepEqual(inspectPortOwners(fx.contract.ports.server), [], 'server port released');
		assert.deepEqual(inspectPortOwners(fx.contract.ports.client), [], 'client port released');
		for (const pid of pids) assert.equal(isPidAlive(pid), false, `child ${pid} terminated`);
		assert.equal(readStateOrNull().state, 'stopped');
	} finally {
		if (supervisorProcess) killTree(supervisorProcess.pid);
		forceKillOwned(fx.workspace, fx.contract);
		await settle();
		fx.cleanup();
	}
});
