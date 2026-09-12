import { spawn } from 'node:child_process';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { resolve } from 'node:path';

import { CrashLoopGuard, sleep as defaultSleep } from './backoff.mjs';
import { fail } from './errors.mjs';
import { assertSingleOwnedListener, inspectPortOwners, stopOwnedProcesses, defaultTerminateTree } from './listeners.mjs';
import { clearState, isPidAlive as defaultIsPidAlive, newState, readState, writeState } from './state.mjs';
import { resolveInvariantEnv } from './contract.mjs';

const POLL_INTERVAL_MS = 200;

/** Default child-process launcher. Streams stdout/stderr to injected sinks. */
export function defaultSpawnChild(spec) {
	const child = spawn(process.execPath, [spec.entry, ...(spec.args ?? [])], {
		cwd: spec.cwd,
		env: spec.env,
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
	});
	child.stdout?.on('data', (chunk) => spec.onStdout?.(chunk.toString()));
	child.stderr?.on('data', (chunk) => spec.onStderr?.(chunk.toString()));
	return {
		pid: child.pid,
		kill: () => child.kill(),
		onExit: (callback) => child.on('exit', (code, signal) => callback(code, signal)),
	};
}

/** Default HTTP liveness/readiness probe against localhost. */
export function defaultProbeHttp({ port, path, host = '127.0.0.1', timeoutMs = 3000, https = false }) {
	return new Promise((resolvePromise) => {
		const get = https ? httpsGet : httpGet;
		const request = get({ host, port, path, timeout: timeoutMs }, (response) => {
			response.resume();
			resolvePromise({ ok: response.statusCode === 200, status: response.statusCode ?? 0 });
		});
		request.on('timeout', () => request.destroy(new Error('probe timeout')));
		request.on('error', (error) => resolvePromise({ ok: false, status: 0, error: error.message }));
	});
}

/**
 * Build the production targets from the contract. `envValues` are the
 * operator-owned secrets propagated to children; they are never logged.
 */
export function buildTargets(options) {
	const { contract, sourceDir, envValues = {}, env = process.env } = options;
	const invariantEnv = resolveInvariantEnv(contract);
	const baseEnv = { ...env, ...envValues, ...invariantEnv };
	const enrollProTarget = env[contract.upstream?.enrollProOriginVariable] || contract.upstream?.defaultEnrollProOrigin || `http://127.0.0.1:5000`;
	return [
		{
			name: 'server',
			label: 'ATLAS server',
			entry: resolve(sourceDir, contract.serverEntry),
			args: [],
			cwd: sourceDir,
			port: contract.ports.server,
			env: { ...baseEnv, PORT: String(contract.ports.server) },
			livenessPath: contract.supervision.healthLivenessPath,
			readinessPath: contract.supervision.healthReadinessPath,
		},
		{
			name: 'client',
			label: 'ATLAS production host',
			entry: resolve(sourceDir, 'ops/runtime/host.mjs'),
			args: [],
			cwd: sourceDir,
			port: contract.ports.client,
			env: {
				...baseEnv,
				ATLAS_HOST_STATIC_ROOT: resolve(sourceDir, contract.clientDist),
				ATLAS_HOST_API_TARGET: `http://127.0.0.1:${contract.ports.server}`,
				ATLAS_HOST_ENROLLPRO_TARGET: enrollProTarget,
				ATLAS_HOST_PORT: String(contract.ports.client),
			},
			livenessPath: '/__host/live',
			readinessPath: '/__host/ready',
		},
	];
}

/**
 * Supervised runtime owner.
 *
 * Owns exactly one child per configured port. It refuses unknown listeners,
 * never issues image-wide kills, applies bounded restart/backoff after
 * unexpected child exit, verifies distinct liveness and dependency readiness,
 * pins `ROLLOVER_AUTO_SYNC_ENABLED=false`, writes bounded durable logs, and
 * exposes reversible start/stop/status/rollback operations.
 */
export class Supervisor {
	constructor(deps) {
		this.contract = deps.contract;
		this.sourceDir = deps.sourceDir;
		this.releaseSha = deps.releaseSha ?? null;
		this.logger = deps.logger;
		this.targetFactory = deps.targetFactory ?? null;
		this.targets = deps.targets ?? (this.targetFactory ? this.targetFactory(this.sourceDir) : []);
		this.statePath = deps.statePath;
		this.spawnChild = deps.spawnChild ?? defaultSpawnChild;
		this.probeHttp = deps.probeHttp ?? defaultProbeHttp;
		this.inspectListeners = deps.inspectListeners ?? inspectPortOwners;
		this.terminateTree = deps.terminateTree ?? defaultTerminateTree;
		this.stopOwnedProcesses = deps.stopOwnedProcesses ?? stopOwnedProcesses;
		this.sleepFn = deps.sleepFn ?? defaultSleep;
		this.nowFn = deps.now ?? (() => Date.now());
		this.isPidAlive = deps.isPidAlive ?? defaultIsPidAlive;
		this.fsImpl = deps.fsImpl ?? {};
		this.pollIntervalMs = deps.pollIntervalMs ?? POLL_INTERVAL_MS;

		this.guard = new CrashLoopGuard(this.contract.supervision);
		this.children = new Map();
		this.ownedPids = {};
		this.state = 'stopped';
		this.shuttingDown = false;
		this.nextRestartAt = null;
		// True while `launchAndAwaitHealthy` owns the lifecycle (startup or a
		// coordinated restart). Child-exit events during this window are the
		// supervisor's own doing and must not trigger a nested restart.
		this.managing = false;
		// PIDs the supervisor is deliberately terminating as part of a
		// coordinated restart/stop. Their exit events are not crashes.
		this.intentionalExitPids = new Set();
	}

	/** Rebuild the target descriptions for a (possibly restored) source dir. */
	resolveTargets(sourceDir) {
		if (this.targetFactory) return this.targetFactory(sourceDir);
		return this.targets;
	}

	get portList() {
		return this.targets.map((target) => target.port);
	}

	read() {
		return readState(this.statePath, this.fsImpl);
	}

	persist(state, extra = {}) {
		const prior = this.read();
		const record = newState({
			contract: this.contract,
			sourceDir: this.sourceDir,
			releaseSha: this.releaseSha,
			ownedPids: this.ownedPids,
			prior,
			state,
			now: new Date(this.nowFn()).toISOString(),
		});
		Object.assign(record, extra);
		writeState(this.statePath, record, this.fsImpl);
		this.state = state;
		return record;
	}

	/** Fail closed if another supervisor instance or unknown listener owns a port. */
	assertNotDuplicateOrUnknown() {
		const prior = this.read();
		if (prior?.state === 'running' || prior?.state === 'degraded') {
			const alivePids = Object.values(prior.ownedPids ?? {}).filter((pid) => this.isPidAlive(pid));
			if (alivePids.length > 0) {
				throw fail('ALREADY_RUNNING', `A supervised instance is already running (owned PIDs: ${alivePids.join(', ')}).`);
			}
		}
		for (const target of this.targets) {
			const owners = this.inspectListeners(target.port);
			if (owners.length === 0) continue;
			const priorOwned = new Set(Object.values(prior?.ownedPids ?? {}));
			if (owners.every((pid) => priorOwned.has(pid))) {
				throw fail('ALREADY_RUNNING', `Port ${target.port} is already owned by recorded supervised PIDs: ${owners.join(', ')}.`);
			}
			throw fail('UNKNOWN_LISTENER', `Port ${target.port} is owned by an unknown process (PID ${owners.join(', ')}); refusing to start.`);
		}
	}

	async probeTarget(target) {
		const liveness = await this.probeHttp({ port: target.port, path: target.livenessPath, timeoutMs: this.contract.supervision.livenessTimeoutMs });
		if (!liveness.ok) return { liveness, readiness: { ok: false, status: 0 } };
		const readiness = await this.probeHttp({ port: target.port, path: target.readinessPath, timeoutMs: this.contract.supervision.livenessTimeoutMs });
		return { liveness, readiness };
	}

	async waitForHealthy(timeoutMs) {
		const deadline = this.nowFn() + timeoutMs;
		for (;;) {
			let crashed = null;
			for (const [name, handle] of this.children) {
				if (handle.exited) crashed = name;
			}
			if (crashed) return { healthy: false, reason: `${crashed} exited during startup` };
			const results = await Promise.all(this.targets.map((target) => this.probeTarget(target)));
			const healthy = results.every((result) => result.liveness.ok && result.readiness.ok);
			if (healthy) return { healthy: true };
			if (this.nowFn() >= deadline) {
				const states = this.targets.map((target, index) => `${target.name}:live=${results[index].liveness.ok},ready=${results[index].readiness.ok}`).join(' ');
				return { healthy: false, reason: `dependency readiness timeout (${states})` };
			}
			await this.sleepFn(this.pollIntervalMs);
		}
	}

	spawnTargets() {
		this.children.clear();
		this.ownedPids = {};
		for (const target of this.targets) {
			const handle = this.spawnChild({
				entry: target.entry,
				args: target.args,
				cwd: target.cwd,
				env: target.env,
				onStdout: (chunk) => this.logger?.info(`[${target.name}] ${chunk.trimEnd()}`),
				onStderr: (chunk) => this.logger?.warn(`[${target.name}] ${chunk.trimEnd()}`),
			});
			handle.exited = false;
			handle.name = target.name;
			handle.onExit((code, signal) => {
				handle.exited = true;
				return this.onChildExit(target.name, handle.pid, code, signal);
			});
			this.children.set(target.name, handle);
			this.ownedPids[target.name] = handle.pid;
		}
	}

	async terminateOwned() {
		const pids = Object.values(this.ownedPids).filter((pid) => Number.isInteger(pid));
		if (pids.length === 0) return [];
		// Mark every still-running owned child as an intentional termination
		// BEFORE killing, so the sibling exit events generated by the kill do
		// not enter crash accounting.
		for (const handle of this.children.values()) {
			if (!handle.exited) this.intentionalExitPids.add(handle.pid);
		}
		try {
			return this.stopOwnedProcesses({ ownedPids: pids, pids, terminate: this.terminateTree });
		} catch (error) {
			this.logger?.error(`Owned termination refused: ${error instanceof Error ? error.message : String(error)}`);
			return [];
		}
	}

	async waitForPortsReleased(timeoutMs) {
		const deadline = this.nowFn() + timeoutMs;
		for (;;) {
			const busy = [];
			for (const target of this.targets) {
				const owners = this.inspectListeners(target.port);
				if (owners.length > 0) busy.push(`${target.port}:${owners.join(',')}`);
			}
			if (busy.length === 0) return true;
			if (this.nowFn() >= deadline) {
				this.logger?.warn(`Ports still busy after stop: ${busy.join(' ')}`);
				return false;
			}
			await this.sleepFn(this.pollIntervalMs);
		}
	}

	async launchAndAwaitHealthy() {
		this.managing = true;
		try {
			for (;;) {
				this.assertNotDuplicateOrUnknown();
				this.spawnTargets();
				this.logger?.info(`Launched targets: ${this.targets.map((target) => `${target.name}=${this.ownedPids[target.name]}`).join(' ')}`);
				const outcome = await this.waitForHealthy(this.contract.supervision.readinessTimeoutMs);
				if (outcome.healthy) {
					this.guard.recordHealthy(this.nowFn());
					this.persist('running');
					this.logger?.info('All targets healthy (liveness and dependency readiness).');
					return this.getStatus();
				}
				this.logger?.warn(`Startup unhealthy: ${outcome.reason}`);
				await this.terminateOwned();
				await this.waitForPortsReleased(this.contract.supervision.shutdownGraceMs);
				this.children.clear();
				const decision = this.guard.recordUnexpectedExit();
				if (decision.action === 'give_up') {
					this.ownedPids = {};
					this.persist('failed', { failureReason: outcome.reason, giveUpReason: decision.reason });
					throw fail('RUNTIME_START_FAILED', `Supervised runtime failed to become healthy: ${outcome.reason} (${decision.reason}).`);
				}
				this.persist('degraded', { failureReason: outcome.reason });
				this.logger?.warn(`Restart attempt ${decision.attempt} in ${decision.delayMs}ms (bounded exponential backoff).`);
				await this.sleepFn(decision.delayMs);
			}
		} finally {
			this.managing = false;
		}
	}

	async start() {
		this.shuttingDown = false;
		return this.launchAndAwaitHealthy();
	}

	async onChildExit(name, pid, code, signal) {
		if (this.shuttingDown || this.managing) return;
		if (this.intentionalExitPids.has(pid)) {
			this.intentionalExitPids.delete(pid);
			this.logger?.info(`Intentional child termination acknowledged: ${name} (PID ${pid}).`);
			return;
		}
		this.logger?.error(`Unexpected child exit: ${name} (code=${code} signal=${signal}).`);
		this.persist('degraded', { lastExit: { name, code, signal } });
		const decision = this.guard.recordUnexpectedExit();
		if (decision.action === 'give_up') {
			await this.terminateOwned();
			await this.waitForPortsReleased(this.contract.supervision.shutdownGraceMs);
			this.ownedPids = {};
			this.persist('failed', { giveUpReason: decision.reason });
			this.logger?.error(`Giving up after ${decision.reason}.`);
			return;
		}
		this.logger?.warn(`Restarting after unexpected exit in ${decision.delayMs}ms (attempt ${decision.attempt}).`);
		await this.sleepFn(decision.delayMs);
		if (this.shuttingDown) return;
		await this.terminateOwned();
		await this.waitForPortsReleased(this.contract.supervision.shutdownGraceMs);
		this.children.clear();
		try {
			await this.launchAndAwaitHealthy();
		} catch (error) {
			this.logger?.error(`Restart failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async stop() {
		this.shuttingDown = true;
		const prior = this.read();
		const pids = Object.values(prior?.ownedPids ?? this.ownedPids).filter((pid) => Number.isInteger(pid));
		if (pids.length > 0) {
			this.stopOwnedProcesses({ ownedPids: pids, pids, terminate: this.terminateTree });
		}
		const released = await this.waitForPortsReleased(this.contract.supervision.shutdownGraceMs);
		this.children.clear();
		this.ownedPids = {};
		this.persist('stopped');
		this.logger?.info(`Stopped (portsReleased=${released}).`);
		return this.getStatus();
	}

	async rollback() {
		const current = this.read();
		const previous = current?.previous;
		if (!previous) {
			throw fail('ROLLBACK_UNAVAILABLE', 'No previous supervised release is recorded; rollback is unavailable.');
		}
		if (this.shuttingDown) this.shuttingDown = false;
		await this.stop();
		// `stop()` sets shuttingDown again; clear it before relaunching so
		// subsequent unexpected child exits are handled normally.
		this.shuttingDown = false;
		this.sourceDir = previous.sourceDir ?? this.sourceDir;
		this.releaseSha = previous.releaseSha ?? this.releaseSha;
		// Rebuild targets from the restored source directory so the release
		// actually spawned (entry, cwd, env, static root) is the previous
		// release — never the stale current-release target map.
		this.targets = this.resolveTargets(this.sourceDir);
		this.logger?.info(`Rolling back to release=${previous.releaseLabel} releaseSha=${this.releaseSha} pin=${previous.productPin} sourceDir=${this.sourceDir}`);
		this.persist('degraded', { rollbackTo: previous.releaseLabel, rollbackPin: previous.productPin, rollbackReleaseSha: this.releaseSha });
		await this.launchAndAwaitHealthy();
		this.persist('running', { releaseLabel: previous.releaseLabel, productPin: previous.productPin, sourceDir: this.sourceDir, releaseSha: this.releaseSha });
		return this.getStatus();
	}

	getStatus() {
		const prior = this.read();
		const liveChildren = {};
		for (const [name, handle] of this.children) {
			liveChildren[name] = { pid: handle.pid, exited: Boolean(handle.exited) };
		}
		const startedAt = prior?.startedAt ?? null;
		return {
			stream: this.contract.stream,
			state: this.state,
			releaseLabel: prior?.releaseLabel ?? this.contract.releaseLabel,
			productPin: prior?.productPin ?? this.contract.productPin,
			releaseSha: prior?.releaseSha ?? this.releaseSha,
			sourceDir: prior?.sourceDir ?? this.sourceDir,
			startedAt,
			updatedAt: prior?.updatedAt ?? null,
			uptimeMs: startedAt ? Math.max(0, this.nowFn() - Date.parse(startedAt)) : 0,
			restartFailures: this.guard.consecutiveFailures,
			nextRestartAt: this.nextRestartAt,
			invariants: { ...this.contract.invariants },
			targets: this.targets.map((target) => ({
				name: target.name,
				label: target.label,
				port: target.port,
				pid: this.ownedPids[target.name] ?? null,
				owned: this.ownedPids[target.name] !== undefined,
				live: liveChildren[target.name] ? !liveChildren[target.name].exited : false,
				livenessPath: target.livenessPath,
				readinessPath: target.readinessPath,
			})),
		};
	}
}

export { clearState };
