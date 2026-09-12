import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadContract } from '../lib/contract.mjs';
import { Supervisor, buildTargets } from '../lib/supervisor.mjs';
import { writeState } from '../lib/state.mjs';
import { formatStatus } from '../lib/status.mjs';

const CONTRACT = loadContract();
const OTHER_SHA = '0123456789abcdef0123456789abcdef01234567';
const PORTS = { server: 15001, client: 15174 };

function testContract() {
	const contract = JSON.parse(JSON.stringify(CONTRACT));
	contract.ports = { ...PORTS };
	contract.supervision.maxRestarts = 2;
	contract.supervision.backoffBaseMs = 100;
	contract.supervision.backoffMaxMs = 400;
	contract.supervision.survivalWindowMs = 1000;
	contract.supervision.readinessTimeoutMs = 100;
	contract.supervision.livenessTimeoutMs = 10;
	contract.supervision.shutdownGraceMs = 50;
	return contract;
}

function makeHarness(options = {}) {
	const clock = { now: options.now0 ?? 0 };
	const sleeps = [];
	const spawned = [];
	const terminated = [];
	const alivePids = options.alivePids ?? new Set();
	let nextPid = 900001;
	const healthyFn = options.healthy ?? (() => true);
	const spawnChild = (spec) => {
		const handle = {
			pid: nextPid++,
			exited: false,
			spec,
			onExitCb: null,
			onExit(cb) {
				this.onExitCb = cb;
			},
			kill() {
				this.exited = true;
			},
			emitExit(code = 1) {
				this.exited = true;
				return this.onExitCb?.(code, null);
			},
		};
		spawned.push(handle);
		return handle;
	};
	const probeHttp = async ({ port, path }) => (healthyFn({ port, path }) ? { ok: true, status: 200 } : { ok: false, status: 503 });
	const inspectListeners = (port) => (options.listeners?.get(port) ?? []);
	const contract = testContract();
	const stateDir = mkdtempSync(join(tmpdir(), 'atlas-supervisor-'));
	const statePath = join(stateDir, 'state.json');
	const deps = {
		contract,
		sourceDir: options.sourceDir ?? 'C:/deploy/atlas',
		logger: null,
		targets: [
			{ name: 'server', label: 'ATLAS server', entry: 'C:/deploy/atlas/atlas-server/dist/server.js', args: [], cwd: 'C:/deploy/atlas', port: PORTS.server, env: {}, livenessPath: '/api/v1/health', readinessPath: '/api/v1/health/ready' },
			{ name: 'client', label: 'ATLAS production host', entry: 'C:/deploy/atlas/ops/runtime/host.mjs', args: [], cwd: 'C:/deploy/atlas', port: PORTS.client, env: {}, livenessPath: '/__host/live', readinessPath: '/__host/ready' },
		],
		statePath,
		spawnChild,
		probeHttp,
		inspectListeners,
		terminateTree: (pid) => terminated.push(pid),
		sleepFn: async (ms) => {
			sleeps.push(ms);
			clock.now += ms;
		},
		now: () => clock.now,
		isPidAlive: (pid) => alivePids.has(pid),
		pollIntervalMs: 10,
	};
	return {
		supervisor: new Supervisor(deps),
		spawned,
		sleeps,
		terminated,
		statePath,
		stateDir,
		cleanup: () => rmSync(stateDir, { recursive: true, force: true }),
	};
}

test('buildTargets pins ports, rollover-disabled, and supervised invariants', () => {
	const targets = buildTargets({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', envValues: {} });
	const server = targets.find((target) => target.name === 'server');
	const client = targets.find((target) => target.name === 'client');
	assert.equal(server.env.ROLLOVER_AUTO_SYNC_ENABLED, 'false');
	assert.equal(server.env.ATLAS_SUPERVISED, 'true');
	assert.equal(server.env.PORT, String(CONTRACT.ports.server));
	assert.equal(client.env.ATLAS_HOST_PORT, String(CONTRACT.ports.client));
	assert.equal(client.env.ATLAS_HOST_API_TARGET, `http://127.0.0.1:${CONTRACT.ports.server}`);
});

test('duplicate-instance prevention refuses to start over a live recorded instance', async () => {
	const harness = makeHarness({ alivePids: new Set([900001, 900002]) });
	try {
		writeState(harness.statePath, { state: 'running', ownedPids: { server: 900001, client: 900002 }, productPin: CONTRACT.productPin, releaseLabel: CONTRACT.releaseLabel });
		await assert.rejects(harness.supervisor.start(), (error) => error.code === 'ALREADY_RUNNING');
		assert.equal(harness.spawned.length, 0);
	} finally {
		harness.cleanup();
	}
});

test('unknown listener on a required port fails closed without spawning or killing', async () => {
	const listeners = new Map([[PORTS.server, [50000]]]);
	const harness = makeHarness({ listeners });
	try {
		await assert.rejects(harness.supervisor.start(), (error) => error.code === 'UNKNOWN_LISTENER');
		assert.equal(harness.spawned.length, 0);
		assert.equal(harness.terminated.length, 0);
	} finally {
		harness.cleanup();
	}
});

test('healthy start records one owned PID per port and a deterministic running status', async () => {
	const harness = makeHarness();
	try {
		const status = await harness.supervisor.start();
		assert.equal(status.state, 'running');
		assert.equal(harness.spawned.length, 2);
		assert.equal(status.targets.length, 2);
		assert.ok(status.targets.every((target) => target.owned && target.live));
		assert.notEqual(status.targets[0].pid, status.targets[1].pid);
		assert.equal(formatStatus(status), formatStatus(status));
	} finally {
		harness.cleanup();
	}
});

test('failed dependency readiness retries with bounded backoff then gives up', async () => {
	// Liveness succeeds; the distinct readiness probe never does.
	const harness = makeHarness({ healthy: ({ path }) => path.endsWith('/health') || path.endsWith('/live') });
	try {
		await assert.rejects(harness.supervisor.start(), (error) => error.code === 'RUNTIME_START_FAILED');
		const backoffs = harness.sleeps.filter((ms) => ms !== 10);
		assert.deepEqual(backoffs, [100, 200]);
		assert.ok(harness.spawned.length > 2, 'children are re-spawned across bounded attempts');
	} finally {
		harness.cleanup();
	}
});

test('unexpected child exit terminates only owned PIDs and restarts to a healthy running state', async () => {
	const harness = makeHarness();
	try {
		await harness.supervisor.start();
		const firstServerPid = harness.spawned[0].pid;
		await harness.spawned[0].emitExit(1);
		assert.equal(harness.supervisor.state, 'running');
		assert.ok(harness.terminated.includes(firstServerPid), 'the crashed owned PID was terminated');
		assert.equal(harness.spawned.length, 4, 'both targets were relaunched');
		assert.ok(harness.sleeps.includes(100), 'bounded backoff was applied');
	} finally {
		harness.cleanup();
	}
});

test('rollback is unavailable without a recorded previous release', async () => {
	const harness = makeHarness();
	try {
		await assert.rejects(harness.supervisor.rollback(), (error) => error.code === 'ROLLBACK_UNAVAILABLE');
	} finally {
		harness.cleanup();
	}
});

test('rollback stops the current release and restores the recorded previous release', async () => {
	const harness = makeHarness({ sourceDir: 'C:/deploy/atlas-new' });
	try {
		writeState(harness.statePath, {
			state: 'stopped',
			ownedPids: {},
			productPin: CONTRACT.productPin,
			releaseLabel: 'atlas-new',
			sourceDir: 'C:/deploy/atlas-new',
			previous: { state: 'stopped', productPin: OTHER_SHA, releaseLabel: 'atlas-old', sourceDir: 'C:/deploy/atlas-old', ownedPids: {}, updatedAt: '2026-09-11T00:00:00.000Z' },
		});
		const status = await harness.supervisor.rollback();
		assert.equal(status.state, 'running');
		assert.equal(status.releaseLabel, 'atlas-old');
		assert.equal(status.productPin, OTHER_SHA);
		assert.equal(status.sourceDir, 'C:/deploy/atlas-old');
	} finally {
		harness.cleanup();
	}
});
