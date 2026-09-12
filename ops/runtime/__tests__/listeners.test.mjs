import test from 'node:test';
import assert from 'node:assert/strict';

import {
	assertSingleOwnedListener,
	parseNetstatListeners,
	stopOwnedProcesses,
} from '../lib/listeners.mjs';
import { CrashLoopGuard, computeBackoffMs } from '../lib/backoff.mjs';

const NETSTAT = [
	'  Proto  Local Address          Foreign Address        State           PID',
	'  TCP    0.0.0.0:5001           0.0.0.0:0              LISTENING       1111',
	'  TCP    127.0.0.1:5001         0.0.0.0:0              LISTENING       2222',
	'  TCP    0.0.0.0:5174           0.0.0.0:0              LISTENING       3333',
	'  TCP    127.0.0.1:5001         127.0.0.1:60000        ESTABLISHED     2222',
	'  TCP    [::]:15174             [::]:0                 LISTENING       4444',
].join('\r\n');

test('netstat parsing detects every listener PID on a port, ignoring connections', () => {
	assert.deepEqual(parseNetstatListeners(NETSTAT, 5001), [1111, 2222]);
	assert.deepEqual(parseNetstatListeners(NETSTAT, 5174), [3333]);
	assert.deepEqual(parseNetstatListeners(NETSTAT, 15174), [4444]);
	assert.deepEqual(parseNetstatListeners(NETSTAT, 19999), []);
});

test('unknown listener ownership fails closed instead of being adopted', () => {
	assert.throws(
		() => assertSingleOwnedListener({ port: 5001, label: 'ATLAS server', owners: [1111], expectedPid: 9999 }),
		(error) => error.code === 'UNKNOWN_LISTENER',
	);
});

test('duplicate listeners on one port are rejected', () => {
	assert.throws(
		() => assertSingleOwnedListener({ port: 5001, label: 'ATLAS server', owners: [1111, 2222], expectedPid: 1111 }),
		(error) => error.code === 'DUPLICATE_LISTENER',
	);
});

test('a missing required listener is reported, while an allowed absence is permitted', () => {
	assert.throws(
		() => assertSingleOwnedListener({ port: 5001, label: 'ATLAS server', owners: [], expectedPid: 1111 }),
		(error) => error.code === 'NO_LISTENER',
	);
	assert.deepEqual(
		assertSingleOwnedListener({ port: 5001, label: 'ATLAS server', owners: [], expectedPid: 1111, allowAbsent: true }),
		{ port: 5001, pid: null, owners: [] },
	);
});

test('termination is scoped to owned child PIDs and refuses a process-wide kill', () => {
	const killed = [];
	assert.throws(
		() => stopOwnedProcesses({ ownedPids: [1111], pids: [1111, 9999], terminate: (pid) => killed.push(pid) }),
		(error) => error.code === 'BROAD_KILL_REFUSED',
	);
	assert.deepEqual(killed, []);
	const terminated = stopOwnedProcesses({ ownedPids: [1111, 2222], pids: [1111, 2222], terminate: (pid) => killed.push(pid) });
	assert.deepEqual(terminated, [1111, 2222]);
	assert.deepEqual(killed, [1111, 2222]);
});

test('bounded exponential backoff is capped and monotonic', () => {
	assert.equal(computeBackoffMs(1, { baseMs: 2000, maxMs: 60000 }), 2000);
	assert.equal(computeBackoffMs(2, { baseMs: 2000, maxMs: 60000 }), 4000);
	assert.equal(computeBackoffMs(10, { baseMs: 2000, maxMs: 60000 }), 60000);
});

test('crash-loop guard restarts within the bound then gives up', () => {
	const guard = new CrashLoopGuard({ maxRestarts: 2, backoffBaseMs: 100, backoffMaxMs: 400, survivalWindowMs: 1000 });
	assert.deepEqual(guard.recordUnexpectedExit(), { action: 'restart', attempt: 1, delayMs: 100 });
	assert.deepEqual(guard.recordUnexpectedExit(), { action: 'restart', attempt: 2, delayMs: 200 });
	assert.equal(guard.recordUnexpectedExit().action, 'give_up');
});

test('a child that survives the healthy window resets the crash counter', () => {
	const guard = new CrashLoopGuard({ maxRestarts: 2, backoffBaseMs: 100, backoffMaxMs: 400, survivalWindowMs: 1000 });
	guard.recordHealthy(0);
	guard.recordUnexpectedExit();
	assert.equal(guard.consecutiveFailures, 1);
	guard.recordHealthy(500);
	assert.equal(guard.consecutiveFailures, 1, 'within the survival window the failure is retained');
	guard.recordHealthy(1500);
	assert.equal(guard.consecutiveFailures, 0, 'surviving the window clears accumulated failures');
});
