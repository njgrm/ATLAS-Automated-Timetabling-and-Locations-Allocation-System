import { execFileSync } from 'node:child_process';

import { fail } from './errors.mjs';

/**
 * Parse `netstat -ano -p tcp` output and return the PIDs listening on a port.
 * Pure and platform-agnostic over the raw text so tests use fixed fixtures.
 */
export function parseNetstatListeners(output, port) {
	const pids = new Set();
	for (const rawLine of String(output).split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line === '' || !/^TCP/i.test(line)) continue;
		const columns = line.split(/\s+/);
		// Proto LocalAddress ForeignAddress State PID
		if (colonLocalPort(columns[1]) !== port) continue;
		const state = (columns[3] ?? '').toUpperCase();
		if (state !== 'LISTENING' && state !== 'LISTEN') continue;
		const pid = Number(columns[4]);
		if (Number.isInteger(pid) && pid > 0) pids.add(pid);
	}
	return [...pids].sort((a, b) => a - b);
}

function colonLocalPort(localAddress) {
	if (typeof localAddress !== 'string' || localAddress === '') return null;
	// Handles `0.0.0.0:5001`, `[::]:5001`, `127.0.0.1:5001`.
	const match = localAddress.match(/:(\d+)$/);
	return match ? Number(match[1]) : null;
}

/** Default read-only Windows port listener probe. Never mutates. */
export function defaultNetstatRunner() {
	return execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true });
}

export function inspectPortOwners(port, options = {}) {
	const runner = options.runner ?? defaultNetstatRunner;
	let output;
	try {
		output = runner(port);
	} catch (error) {
		throw fail('LISTENER_PROBE_FAILED', `Cannot enumerate listeners for port ${port}: ${error instanceof Error ? error.message : String(error)}`);
	}
	return parseNetstatListeners(output, port);
}

/**
 * Fail-closed single-owner assertion for a port.
 *
 * - no listener when one is required -> `NO_LISTENER`;
 * - more than one listener -> `DUPLICATE_LISTENER`;
 * - the listener PID is not the supervisor-owned child PID -> `UNKNOWN_LISTENER`.
 *
 * The supervisor must never terminate an unknown listener. This function only
 * reports; the caller decides recovery (start, or fail closed).
 */
export function assertSingleOwnedListener(options) {
	const { port, label, owners, expectedPid } = options;
	if (!Array.isArray(owners) || owners.length === 0) {
		if (options.allowAbsent === true) return { port, pid: null, owners: [] };
		throw fail('NO_LISTENER', `No listener owns ${label} port ${port}.`);
	}
	if (owners.length > 1) {
		throw fail('DUPLICATE_LISTENER', `Multiple listeners own ${label} port ${port}: ${owners.join(', ')}.`);
	}
	if (expectedPid !== undefined && expectedPid !== null && owners[0] !== expectedPid) {
		throw fail('UNKNOWN_LISTENER', `An unknown process (PID ${owners[0]}) owns ${label} port ${port}; expected owned PID ${expectedPid}. Refusing to act.`);
	}
	return { port, pid: owners[0], owners };
}

/**
 * Terminate only explicitly owned child PIDs. This is the sole kill path in the
 * supervisor: it never issues image-wide kills (`taskkill /IM node.exe`) and
 * refuses if asked to terminate a PID that is not in the owned set.
 */
export function stopOwnedProcesses(options) {
	const { ownedPids, pids, terminate } = options;
	const owned = new Set(ownedPids ?? []);
	const targets = [...new Set(pids ?? [])];
	for (const pid of targets) {
		if (!owned.has(pid)) {
			throw fail('BROAD_KILL_REFUSED', `Refusing to terminate PID ${pid}: it is not an owned supervisor child.`);
		}
	}
	for (const pid of targets) {
		terminate(pid);
	}
	return targets;
}

/** Default terminate function: kills the exact PID and its own tree only. */
export function defaultTerminateTree(pid) {
	try {
		execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
	} catch {
		// The process may already be gone; callers verify zero surviving listeners.
	}
}
