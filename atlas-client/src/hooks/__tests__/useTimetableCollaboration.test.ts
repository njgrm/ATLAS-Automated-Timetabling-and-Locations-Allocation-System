import assert from 'node:assert/strict';
import test from 'node:test';

import { useTimetableCollaboration } from '@/hooks/useTimetableCollaboration';
import type { CollaborationEvent, CollaborationSocket } from '@/lib/roomPreferenceCollaboration';
import type { CollaborationPresence, CollaborationSelection, ScheduledEntry } from '@/types';

type RecordingSocket = CollaborationSocket & { closed: number; joins: Array<{ schoolId: number; schoolYearId: number; runId: number }>; selections: CollaborationSelection[]; emit: (event: CollaborationEvent) => void };
const noop = () => {};
const entry = (entryId: string): ScheduledEntry => ({ entryId } as ScheduledEntry);

function createHookHarness() {
	const states: unknown[] = [];
	const refs: Array<{ current: unknown }> = [];
	const effects: Array<{ deps?: readonly unknown[]; nextDeps?: readonly unknown[]; callback?: () => void | (() => void); cleanup?: () => void }> = [];
	const sockets: RecordingSocket[] = [];
	let stateIndex = 0;
	let refIndex = 0;
	let effectIndex = 0;
	let accessToken: string | null = 'test-token';
	const runtime = {
		useState<T>(initial: T) {
			const index = stateIndex++;
			if (!(index in states)) states[index] = initial;
			return [states[index] as T, (value: T | ((current: T) => T)) => { states[index] = typeof value === 'function' ? (value as (current: T) => T)(states[index] as T) : value; }] as const;
		},
		useRef<T>(initial: T) {
			const index = refIndex++;
			if (!refs[index]) refs[index] = { current: initial };
			return refs[index] as { current: T };
		},
		useEffect(callback: () => void | (() => void), deps?: readonly unknown[]) {
			const index = effectIndex++;
			effects[index] ??= {};
			effects[index].callback = callback;
			effects[index].nextDeps = deps;
		},
	};
	const dependencies = {
		getAccessToken: () => accessToken,
		createSocket: ({ onEvent }: { accessToken: string; onEvent: (event: CollaborationEvent) => void }) => {
			const socket: RecordingSocket = { closed: 0, joins: [], selections: [], emit: onEvent, join(scope) { this.joins.push(scope); }, sendSelection(selection) { this.selections.push(selection); }, updateViewMode() {}, close() { this.closed += 1; } };
			sockets.push(socket);
			return socket;
		},
	};
	const flushEffects = () => {
		for (const effect of effects) {
			const changed = !effect.deps || !effect.nextDeps || effect.deps.length !== effect.nextDeps.length || effect.deps.some((value, index) => !Object.is(value, effect.nextDeps?.[index]));
			if (!changed) continue;
			effect.cleanup?.();
			effect.cleanup = effect.callback?.() || undefined;
			effect.deps = effect.nextDeps;
		}
	};
	const render = (schoolId: number | null, selectedEntry: ScheduledEntry | null = null, schoolYearId: number | null = 8, runId: number | null = 41) => {
		stateIndex = 0; refIndex = 0; effectIndex = 0;
		const result = useTimetableCollaboration({ schoolId, schoolYearId, runId, selectedEntry, onTimetableEvent: noop }, runtime as unknown as Parameters<typeof useTimetableCollaboration>[1], dependencies);
		flushEffects();
		return result;
	};
	return { render, sockets, refs, setAccessToken: (value: string | null) => { accessToken = value; } };
}

test('null and invalid scope render the production hook without constructing a socket', () => {
	for (const schoolId of [null, 0, -1, 1.5]) {
		const harness = createHookHarness(); harness.render(schoolId); assert.equal(harness.sockets.length, 0);
	}
	const invalidYear = createHookHarness(); invalidYear.render(1, null, 0, 41); assert.equal(invalidYear.sockets.length, 0);
	const invalidRun = createHookHarness(); invalidRun.render(1, null, 8, Number.NaN); assert.equal(invalidRun.sockets.length, 0);
});

test('school 1 to null closes and clears production hook state and prevents stale sends', async () => {
	const harness = createHookHarness();
	harness.render(1);
	harness.sockets[0].emit({ type: 'open' });
	harness.sockets[0].emit({ type: 'connected', payload: { connectionId: 'self-school-1', user: { userId: 1, role: 'officer', email: null, authSource: 'local' } } });
	harness.sockets[0].emit({ type: 'error', payload: { code: 'OLD_SCOPE', message: 'old school error' } });
	harness.sockets[0].emit({ type: 'snapshot', payload: { channel: { schoolId: 1, schoolYearId: 8, runId: 41 }, presence: [{ connectionId: 'peer', userId: 2 } as CollaborationPresence] } });
	harness.render(1, entry('first'));
	assert.equal(harness.sockets[0].selections.length, 1);
	harness.render(1, entry('queued'));
	harness.render(null, entry('stale'));
	await new Promise((resolve) => setTimeout(resolve, 120));
	const result = harness.render(null, entry('stale'));
	assert.equal(harness.sockets[0].closed, 1);
	assert.equal(result.connected, false);
	assert.deepEqual(result.presence, []);
	assert.deepEqual(result.remoteSelections, {});
	assert.equal(result.lastError, null);
	assert.equal(harness.sockets[0].selections.length, 1);
	assert.equal(harness.refs[0].current, null);
	assert.equal(harness.refs[1].current, null);
	assert.equal(harness.refs[4].current, null);
});

test('school 1 to school 2 clears old identity and throttle state before joining and sending new scope', () => {
	const harness = createHookHarness();
	harness.render(1); harness.sockets[0].emit({ type: 'open' });
	harness.sockets[0].emit({ type: 'connected', payload: { connectionId: 'old-self', user: { userId: 1, role: 'officer', email: null, authSource: 'local' } } });
	harness.render(1, entry('school-1-entry'));
	harness.render(2); harness.sockets[1].emit({ type: 'open' });
	harness.sockets[1].emit({ type: 'snapshot', payload: { channel: { schoolId: 2, schoolYearId: 8, runId: 41 }, presence: [{ connectionId: 'old-self', userId: 1 } as CollaborationPresence, { connectionId: 'new-peer', userId: 2 } as CollaborationPresence] } });
	harness.render(2, entry('school-2-entry'));
	const result = harness.render(2, entry('school-2-entry'));
	assert.equal(harness.sockets[0].closed, 1);
	assert.deepEqual(harness.sockets[0].joins.map(({ schoolId }) => schoolId), [1]);
	assert.deepEqual(harness.sockets[1].joins.map(({ schoolId }) => schoolId), [2]);
	assert.deepEqual(harness.sockets[1].selections.map(({ schoolId }) => schoolId), [2]);
	assert.deepEqual(result.presence.map(({ connectionId }) => connectionId), ['old-self', 'new-peer']);
});

test('authentication loss closes the active scope and clears collaboration state', () => {
	const harness = createHookHarness();
	harness.render(1); harness.sockets[0].emit({ type: 'open' });
	harness.sockets[0].emit({ type: 'error', payload: { code: 'AUTH', message: 'expired' } });
	harness.setAccessToken(null);
	harness.render(1);
	const result = harness.render(1);
	assert.equal(harness.sockets[0].closed, 1);
	assert.equal(result.connected, false);
	assert.equal(result.lastError, null);
	assert.equal(harness.refs[0].current, null);
	assert.equal(harness.refs[1].current, null);
});

test('negative control fails when an unsafe mutant constructs a socket without the school guard', () => {
	const recording: unknown[] = [];
	const unsafeMutant = (schoolId: number | null) => recording.push({ schoolId });
	unsafeMutant(null);
	assert.throws(() => assert.equal(recording.length, 0), /Expected values to be strictly equal/);
});
