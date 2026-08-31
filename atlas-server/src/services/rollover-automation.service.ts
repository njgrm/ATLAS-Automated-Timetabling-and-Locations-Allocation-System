/**
 * Automated rollover sync scheduler.
 *
 * When enabled, this service periodically checks each school's rollover drift
 * state and automatically applies `applyRolloverSync` when the drift is
 * `atlas-stale` with zero hard conflicts and zero unacknowledged reconfigured
 * sections. Transient failures use bounded exponential backoff.
 *
 * Single-instance deployment assumption: the in-process mutex prevents
 * overlapping applies for the same school, but does not coordinate across
 * multiple server instances. Deploy only one ATLAS server per school database.
 */

import { prisma } from '../lib/prisma.js';
import {
	applyRolloverSync,
	fetchEnrollProIntegrationHealth,
	previewRolloverSync,
	type RolloverStatusResult,
} from './enrollpro-rollover.service.js';
import { publishNotificationEvent } from './notification-events.service.js';

// ─── Configuration ───

const ENABLED = process.env.ROLLOVER_AUTO_SYNC_ENABLED !== 'false';
const TICK_INTERVAL_MS = Math.max(60_000, Number(process.env.ROLLOVER_AUTO_SYNC_INTERVAL_MS ?? 300_000));
const MAX_BACKOFF_MS = Math.max(TICK_INTERVAL_MS, Number(process.env.ROLLOVER_AUTO_SYNC_MAX_BACKOFF_MS ?? 1_800_000));

// ─── Per-school automation state ───

export type SchoolAutomationState = {
	schoolId: number;
	lastAttemptAt: Date | null;
	lastResult: 'success' | 'failure' | 'skipped' | 'unreachable' | 'conflict' | 'reconfigure-pending' | null;
	nextAttemptAt: Date;
	consecutiveFailures: number;
	currentlyApplying: boolean;
	lastNotifiedState: string | null;
};

// ─── Module-level state ───

let tickTimer: ReturnType<typeof setInterval> | null = null;
const schoolStates = new Map<number, SchoolAutomationState>();
const schoolLocks = new Map<number, Promise<void>>();

function getSchoolState(schoolId: number): SchoolAutomationState {
	let state = schoolStates.get(schoolId);
	if (!state) {
		state = {
			schoolId,
			lastAttemptAt: null,
			lastResult: null,
			nextAttemptAt: new Date(),
			consecutiveFailures: 0,
			currentlyApplying: false,
			lastNotifiedState: null,
		};
		schoolStates.set(schoolId, state);
	}
	return state;
}

function computeNextBackoff(consecutiveFailures: number): number {
	const base = TICK_INTERVAL_MS;
	const backoff = base * Math.pow(2, consecutiveFailures);
	return Math.min(backoff, MAX_BACKOFF_MS);
}

function notifyOnce(schoolId: number, state: SchoolAutomationState, notificationType: string, message: string, severity: 'info' | 'warning' | 'success' | 'error') {
	const stateKey = `${notificationType}:${state.lastResult}`;
	if (state.lastNotifiedState === stateKey) return;
	state.lastNotifiedState = stateKey;

	publishNotificationEvent({
		type: notificationType,
		domain: 'integration',
		severity,
		audience: 'PRIVILEGED',
		schoolId,
		schoolYearId: 0,
		facultyId: null,
		message,
		metadata: {
			lastResult: state.lastResult,
			consecutiveFailures: state.consecutiveFailures,
			nextAttemptAt: state.nextAttemptAt.toISOString(),
		},
	});
}

// ─── Single-tick function (exported for testing) ───

export async function tickRolloverAutomation(schoolId: number): Promise<{
	action: 'applied' | 'skipped' | 'unreachable' | 'conflict' | 'reconfigure-pending' | 'error';
	detail?: string;
	state: SchoolAutomationState;
}> {
	const state = getSchoolState(schoolId);

	if (state.currentlyApplying) {
		return { action: 'skipped', detail: 'Already applying', state };
	}

	if (Date.now() < state.nextAttemptAt.getTime()) {
		return { action: 'skipped', detail: 'Backoff not elapsed', state };
	}

	state.currentlyApplying = true;
	state.lastAttemptAt = new Date();

	try {
		const health = await fetchEnrollProIntegrationHealth();
		if (!health.reachable) {
			state.consecutiveFailures += 1;
			state.lastResult = 'unreachable';
			state.nextAttemptAt = new Date(Date.now() + computeNextBackoff(state.consecutiveFailures));
			notifyOnce(schoolId, state, 'ROLLOVER_ATTENTION_REQUIRED', `EnrollPro is unreachable. Automation will retry in ${Math.round((state.nextAttemptAt.getTime() - Date.now()) / 1000)}s.`, 'warning');
			return { action: 'unreachable', detail: health.message, state };
		}

		const preview = await previewRolloverSync(schoolId);

		if (preview.drift.status !== 'atlas-stale') {
			state.lastResult = 'skipped';
			state.consecutiveFailures = 0;
			state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
			return { action: 'skipped', detail: `Drift is ${preview.drift.status}`, state };
		}

		if (preview.conflicts.length > 0) {
			state.lastResult = 'conflict';
			state.consecutiveFailures = 0;
			state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
			notifyOnce(schoolId, state, 'ROLLOVER_ATTENTION_REQUIRED', `Rollover has ${preview.conflicts.length} conflict(s) requiring manual review.`, 'warning');
			return { action: 'conflict', detail: preview.conflicts[0]?.message, state };
		}

		if (preview.reconfiguredSections.length > 0) {
			state.lastResult = 'reconfigure-pending';
			state.consecutiveFailures = 0;
			state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
			notifyOnce(schoolId, state, 'ROLLOVER_ATTENTION_REQUIRED', `${preview.reconfiguredSections.length} section(s) were reconfigured and need officer acknowledgment.`, 'warning');
			return { action: 'reconfigure-pending', detail: `${preview.reconfiguredSections.length} unacknowledged reconfigures`, state };
		}

		await applyRolloverSync(schoolId, undefined, { initiatedBy: 'system' });

		state.lastResult = 'success';
		state.consecutiveFailures = 0;
		state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
		state.lastNotifiedState = null;

		publishNotificationEvent({
			type: 'ROLLOVER_AUTO_SYNC_COMPLETED',
			domain: 'integration',
			severity: 'success',
			audience: 'PRIVILEGED',
			schoolId,
			schoolYearId: preview.enrollProActiveYear?.id ?? 0,
			facultyId: null,
			message: `Automated rollover sync completed for ${preview.enrollProActiveYear?.yearLabel ?? 'active year'}.`,
			metadata: {
				schoolYearId: preview.enrollProActiveYear?.id,
				yearLabel: preview.enrollProActiveYear?.yearLabel,
			},
		});

		return { action: 'applied', state };
	} catch (error) {
		state.consecutiveFailures += 1;
		state.lastResult = 'failure';
		state.nextAttemptAt = new Date(Date.now() + computeNextBackoff(state.consecutiveFailures));
		const message = error instanceof Error ? error.message : String(error);
		notifyOnce(schoolId, state, 'ROLLOVER_ATTENTION_REQUIRED', `Automated rollover sync failed: ${message.slice(0, 200)}`, 'error');
		return { action: 'error', detail: message.slice(0, 200), state };
	} finally {
		state.currentlyApplying = false;
	}
}

// ─── Mutex for same-school concurrency ───

export async function withSchoolLock<T>(schoolId: number, fn: () => Promise<T>): Promise<T> {
	const existing = schoolLocks.get(schoolId);
	const chain = existing ? existing.then(() => run()) : run();
	schoolLocks.set(schoolId, chain.then(() => { schoolLocks.delete(schoolId); }));

	async function run(): Promise<T> {
		return fn();
	}

	return chain;
}

// ─── Timer lifecycle ───

async function runTick() {
	const schools = await prisma.enrollProSchoolYearMirror.findMany({
		select: { schoolId: true },
		distinct: ['schoolId'],
	});

	for (const { schoolId } of schools) {
		withSchoolLock(schoolId, () => tickRolloverAutomation(schoolId)).catch((error) => {
			console.error(`[rollover-automation] Unhandled error for school ${schoolId}:`, error);
		});
	}
}

export function startRolloverAutomation() {
	if (!ENABLED) {
		console.log('[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false');
		return;
	}

	if (tickTimer) return;

	console.log(`[rollover-automation] Starting (interval=${TICK_INTERVAL_MS}ms, maxBackoff=${MAX_BACKOFF_MS}ms)`);
	tickTimer = setInterval(() => {
		runTick().catch((error) => {
			console.error('[rollover-automation] Tick error:', error);
		});
	}, TICK_INTERVAL_MS);
	tickTimer.unref();
}

export function stopRolloverAutomation() {
	if (tickTimer) {
		clearInterval(tickTimer);
		tickTimer = null;
		console.log('[rollover-automation] Stopped');
	}
}

// ─── Status surface ───

export function resetAutomationState() {
	schoolStates.clear();
	schoolLocks.clear();
}

export function getAutomationStatus(): {
	enabled: boolean;
	schools: Array<{
		schoolId: number;
		lastAttemptAt: string | null;
		lastResult: string | null;
		nextAttemptAt: string;
		consecutiveFailures: number;
		currentlyApplying: boolean;
	}>;
} {
	return {
		enabled: ENABLED,
		schools: Array.from(schoolStates.values()).map((s) => ({
			schoolId: s.schoolId,
			lastAttemptAt: s.lastAttemptAt?.toISOString() ?? null,
			lastResult: s.lastResult,
			nextAttemptAt: s.nextAttemptAt.toISOString(),
			consecutiveFailures: s.consecutiveFailures,
			currentlyApplying: s.currentlyApplying,
		})),
	};
}
