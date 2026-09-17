/**
 * Automated rollover sync scheduler.
 *
 * When enabled, this service periodically checks each school's rollover drift
 * state and automatically applies `applyRolloverSync` ONLY when the codebase's
 * own safety verdict holds: `drift.status === 'atlas-stale'` with
 * `drift.recommendedAction === 'RUN_ROLLOVER_SYNC'`, zero hard conflicts, and
 * zero unacknowledged reconfigured sections. Every other preview is
 * notification-only. Transient failures use bounded exponential backoff.
 *
 * ROLLOVER-GRADED-AUTONOMY-C01: the unattended tick NEVER archives and never
 * clears test data. Superseding the previous school year, resetting a dummy
 * year, and completing a pending recovery are explicit operator actions on the
 * existing Year Setup surfaces; the archive-producing dependency seams remain
 * injectable so the never-archive control can prove zero invocations.
 *
 * Single-instance deployment assumption: the in-process mutex prevents
 * overlapping applies for the same school, but does not coordinate across
 * multiple server instances. Deploy only one ATLAS server per school database.
 */

import { prisma } from '../lib/prisma.js';
import {
	applyRolloverSync,
	applyTestYearRecovery,
	archiveAndSyncActiveYear,
	archiveSchoolYear,
	classifyRecoveryState,
	serviceError,
	fetchEnrollProIntegrationHealth,
	isArchiveResolvableConflict,
	previewRolloverSync,
	type RolloverStatusResult,
} from './enrollpro-rollover.service.js';
import { publishNotificationEvent } from './notification-events.service.js';

// ─── Configuration ───

const ENABLED = process.env.ROLLOVER_AUTO_SYNC_ENABLED !== 'false';
const TEST_MODE_ENABLED = process.env.ROLLOVER_TEST_MODE_ENABLED === 'true';
const TICK_INTERVAL_MS = Math.max(60_000, Number(process.env.ROLLOVER_AUTO_SYNC_INTERVAL_MS ?? 300_000));
const MAX_BACKOFF_MS = Math.max(TICK_INTERVAL_MS, Number(process.env.ROLLOVER_AUTO_SYNC_MAX_BACKOFF_MS ?? 1_800_000));

type RolloverAutomationDependencies = {
	testModeEnabled?: boolean;
	fetchIntegrationHealth?: typeof fetchEnrollProIntegrationHealth;
	previewRollover?: typeof previewRolloverSync;
	classifyRecovery?: typeof classifyRecoveryState;
	/**
	 * Archive-producing seams. ROLLOVER-GRADED-AUTONOMY-C01 retired every
	 * unattended caller, but the fields stay declared so the never-archive
	 * control can inject throwing spies and prove zero invocations.
	 */
	applyTestRecovery?: typeof applyTestYearRecovery;
	/** RR-09B: seam for the archive-resolvable self-heal path. */
	applyArchiveAndSync?: typeof archiveAndSyncActiveYear;
	/** RR-09B: seam for the post-sync superseded-year archive. */
	archiveYear?: typeof archiveSchoolYear;
	/** ROLLOVER-GRADED-AUTONOMY-C01: seam for the graded auto-apply path. */
	applyRollover?: typeof applyRolloverSync;
	publishNotification?: typeof publishNotificationEvent;
};

// ─── Per-school automation state ───

export type SchoolAutomationState = {
	schoolId: number;
	lastAttemptAt: Date | null;
	lastResult: 'success' | 'failure' | 'skipped' | 'unreachable' | 'conflict' | 'reconfigure-pending' | 'partial-success' | null;
	nextAttemptAt: Date;
	consecutiveFailures: number;
	currentlyApplying: boolean;
	lastNotifiedState: string | null;
	/**
	 * ROLLOVER-GRADED-AUTONOMY-C01: last observed drift status. The detection
	 * notification is emitted at most once per observed status change, so this
	 * records the observed status even when no notification is emitted.
	 */
	lastNotifiedDriftStatus: string | null;
};

// ─── Module-level state ───

let tickTimer: ReturnType<typeof setInterval> | null = null;
const schoolStates = new Map<number, SchoolAutomationState>();
const schoolLocks = new Map<number, Promise<unknown>>();

export function canAutoRecoverMarkedTestCollision(preview: RolloverStatusResult, testModeEnabled = TEST_MODE_ENABLED): boolean {
	return testModeEnabled
		&& preview.drift.status === 'mapping-conflict'
		&& preview.conflicts.some((conflict) => conflict.code === 'SECTION_ID_COLLISION')
		&& preview.testDataMarked === true
		&& preview.publishedResetBlocked === false;
}

/**
 * RR-09B: an archive-resolvable conflict (label-mismatch wedge whose only
 * conflict is YEAR_LABEL_MISMATCH) self-heals through the non-destructive
 * archive+sync flow. Section collisions and mixed conflicts are NOT
 * archive-resolvable and stay on the manual path.
 */
export function isArchiveResolvableStatus(preview: RolloverStatusResult): boolean {
	return preview.drift.status === 'mapping-conflict'
		&& preview.drift.recommendedAction === 'RUN_ARCHIVE_AND_SYNC'
		&& isArchiveResolvableConflict(preview.conflicts.map((conflict) => conflict.code));
}

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
			lastNotifiedDriftStatus: null,
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

type DriftNotificationSummary = {
	driftStatus: string;
	recommendedAction: string;
	driftMessage: string;
	conflictCount: number;
	schoolYearId: number;
	fromYearLabel: string | null;
	toYearLabel: string | null;
};

/** Plain-language next step for the notification message. */
function nextActionHint(recommendedAction: string): string {
	switch (recommendedAction) {
		case 'RUN_ROLLOVER_SYNC':
			return 'Open Year Setup and run the rollover sync.';
		case 'RUN_ARCHIVE_AND_SYNC':
			return 'Open Year Setup, review the year-label mismatch, then archive and sync.';
		case 'RESET_DUMMY_YEAR':
			return 'Open Year Setup and reset the dummy year before syncing.';
		case 'REVIEW_MAPPING_CONFLICT':
			return 'Review the mapping conflict in Year Setup before syncing.';
		case 'RETRY_ENROLLPRO':
			return 'ATLAS will retry EnrollPro automatically with bounded backoff.';
		default:
			return 'No action required.';
	}
}

/**
 * ROLLOVER-GRADED-AUTONOMY-C01 (R2.4): emit at most one detection notification
 * per observed drift-status change. The dedupe axis here is the drift STATUS,
 * deliberately NOT `notifyOnce`'s `type:lastResult` axis, so this never routes
 * through `notifyOnce`. The observed status is always recorded; `aligned` never
 * notifies.
 */
function notifyDriftTransition(
	schoolId: number,
	state: SchoolAutomationState,
	summary: DriftNotificationSummary,
	publishNotification: typeof publishNotificationEvent,
): void {
	const statusChanged = summary.driftStatus !== state.lastNotifiedDriftStatus;
	state.lastNotifiedDriftStatus = summary.driftStatus;
	if (!statusChanged || summary.driftStatus === 'aligned') return;

	publishNotification({
		type: 'ROLLOVER_DETECTED',
		domain: 'integration',
		severity: 'warning',
		audience: 'PRIVILEGED',
		schoolId,
		schoolYearId: summary.schoolYearId,
		facultyId: null,
		message: `Rollover drift detected (${summary.driftStatus}). ${summary.driftMessage} Next action: ${summary.recommendedAction} — ${nextActionHint(summary.recommendedAction)}`,
		metadata: {
			driftStatus: summary.driftStatus,
			recommendedAction: summary.recommendedAction,
			driftMessage: summary.driftMessage,
			conflictCount: summary.conflictCount,
			fromYearLabel: summary.fromYearLabel,
			toYearLabel: summary.toYearLabel,
		},
	});
}

function driftSummaryFromPreview(preview: RolloverStatusResult): DriftNotificationSummary {
	return {
		driftStatus: preview.drift.status,
		recommendedAction: preview.drift.recommendedAction,
		driftMessage: preview.drift.message,
		conflictCount: preview.conflicts.length,
		schoolYearId: preview.enrollProActiveYear?.id ?? 0,
		fromYearLabel: preview.mirror?.yearLabel ?? null,
		toYearLabel: preview.enrollProActiveYear?.yearLabel ?? preview.drift.enrollProSchoolYearLabel,
	};
}

// ─── Single-tick function (exported for testing) ───

export async function tickRolloverAutomation(
	schoolId: number,
	dependencies: RolloverAutomationDependencies = {},
): Promise<{
	action: 'applied' | 'skipped' | 'unreachable' | 'conflict' | 'reconfigure-pending' | 'archive-pending' | 'error';
	detail?: string;
	state: SchoolAutomationState;
}> {
	const state = getSchoolState(schoolId);
	const fetchIntegrationHealth = dependencies.fetchIntegrationHealth ?? fetchEnrollProIntegrationHealth;
	const previewRollover = dependencies.previewRollover ?? previewRolloverSync;
	const applyRollover = dependencies.applyRollover ?? applyRolloverSync;
	const publishNotification = dependencies.publishNotification ?? publishNotificationEvent;

	if (state.currentlyApplying) {
		return { action: 'skipped', detail: 'Already applying', state };
	}

	if (Date.now() < state.nextAttemptAt.getTime()) {
		return { action: 'skipped', detail: 'Backoff not elapsed', state };
	}

	state.currentlyApplying = true;
	state.lastAttemptAt = new Date();

	try {
		const health = await fetchIntegrationHealth();
		if (!health.reachable) {
			state.consecutiveFailures += 1;
			state.lastResult = 'unreachable';
			state.nextAttemptAt = new Date(Date.now() + computeNextBackoff(state.consecutiveFailures));
			notifyDriftTransition(schoolId, state, {
				driftStatus: 'enrollpro-unreachable',
				recommendedAction: 'RETRY_ENROLLPRO',
				driftMessage: health.message ?? 'EnrollPro is unreachable.',
				conflictCount: 0,
				schoolYearId: 0,
				fromYearLabel: null,
				toYearLabel: null,
			}, publishNotification);
			return { action: 'unreachable', detail: health.message, state };
		}

		const preview = await previewRollover(schoolId);

		// ROLLOVER-GRADED-AUTONOMY-C01 (R2.2): auto-apply ONLY when the
		// codebase's own safety verdict holds — atlas-stale + RUN_ROLLOVER_SYNC
		// + zero conflicts + zero unacknowledged reconfigured sections. The
		// reconfigured-section term is load-bearing: applyRolloverSync rejects
		// unacknowledged reconfigures with 409
		// SECTION_RECONFIGURATION_REVIEW_REQUIRED, so dropping it would convert
		// a clean notification into a 409-driven backoff loop.
		const autoApplyGate = preview.drift.status === 'atlas-stale'
			&& preview.drift.recommendedAction === 'RUN_ROLLOVER_SYNC'
			&& preview.conflicts.length === 0
			&& preview.reconfiguredSections.length === 0;

		if (autoApplyGate) {
			try {
				await applyRollover(schoolId, undefined, { initiatedBy: 'system' });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				state.consecutiveFailures += 1;
				state.lastResult = 'failure';
				state.nextAttemptAt = new Date(Date.now() + computeNextBackoff(state.consecutiveFailures));
				notifyOnce(schoolId, state, 'ROLLOVER_ATTENTION_REQUIRED', `Automated rollover sync failed: ${message.slice(0, 200)}`, 'error');
				return { action: 'error', detail: message.slice(0, 200), state };
			}

			state.lastResult = 'success';
			state.consecutiveFailures = 0;
			state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
			state.lastNotifiedState = null;
			state.lastNotifiedDriftStatus = null;

			publishNotification({
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
					initiatedBy: 'system',
				},
			});

			return { action: 'applied', state };
		}

		// R2.3/R2.4: every other preview is notification-only. Superseding the
		// previous year, resetting a dummy year, clearing test data, and
		// completing a pending recovery are explicit operator actions on the
		// existing Year Setup surfaces — the unattended tick never archives.
		notifyDriftTransition(schoolId, state, driftSummaryFromPreview(preview), publishNotification);

		if (preview.drift.status === 'aligned') {
			state.lastResult = 'skipped';
			state.consecutiveFailures = 0;
			state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
			return { action: 'skipped', detail: `Drift is ${preview.drift.status}`, state };
		}

		if (preview.conflicts.length > 0) {
			state.lastResult = 'conflict';
			state.consecutiveFailures = 0;
			state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
			return { action: 'conflict', detail: preview.conflicts[0]?.message, state };
		}

		if (preview.reconfiguredSections.length > 0) {
			state.lastResult = 'reconfigure-pending';
			state.consecutiveFailures = 0;
			state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
			return { action: 'reconfigure-pending', detail: `${preview.reconfiguredSections.length} unacknowledged reconfigures`, state };
		}

		state.lastResult = 'skipped';
		state.consecutiveFailures = 0;
		state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
		return { action: 'skipped', detail: `Drift is ${preview.drift.status}`, state };
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

/**
 * Serialize same-school rollover operations.
 *
 * RR-08 root-cause fix: the previous implementation stored
 * `chain.then(() => schoolLocks.delete(schoolId))` without a rejection
 * handler. When the locked operation rejected (e.g. `applyRolloverSync`
 * throwing mid-apply — the 2026-09-01 incident), that derived cleanup
 * promise became an unhandled rejection, which kills the process under
 * Node's default policy. The rejected entry also stayed in the map,
 * poisoning the school's lock so every later call failed instantly with a
 * stale error. This version awaits the chain directly (caller-owned
 * rejection handling) and removes the entry on BOTH success and failure.
 */
export async function withSchoolLock<T>(schoolId: number, fn: () => Promise<T>): Promise<T> {
	const existing = schoolLocks.get(schoolId);
	const chain: Promise<T> = existing ? existing.then(() => run(), () => run()) : run();
	schoolLocks.set(schoolId, chain);

	async function run(): Promise<T> {
		return fn();
	}

	try {
		return await chain;
	} finally {
		// Remove the lock entry only when this call is still the newest
		// chain for the school — a later caller may have chained onto it.
		if (schoolLocks.get(schoolId) === chain) {
			schoolLocks.delete(schoolId);
		}
	}
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

export function isTestModeEnabled(): boolean {
	return TEST_MODE_ENABLED;
}

/**
 * RR-15C: mark a school year as test data.
 *
 * Truthful marking: the exact (schoolId, enrollProSchoolYearId) mirror must
 * exist. When it does not, a typed `404 SCHOOL_YEAR_MIRROR_NOT_FOUND` is
 * returned and NO `TEST_DATA_MARKED` audit is written — the operation can no
 * longer silently succeed. Legacy fixtures without a mirror must use the
 * separate privileged recovery-scaffold operation first. Repeated marking of
 * an already marked year is idempotent and never duplicates the audit row.
 */
export async function markSchoolYearAsTestData(
	schoolId: number,
	schoolYearId: number,
	actorId: number,
): Promise<{ marked: boolean; alreadyMarked: boolean }> {
	const mirror = await prisma.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
		select: { id: true, yearLabel: true, lastSyncMetadata: true },
	});
	if (!mirror) {
		throw serviceError(404, 'SCHOOL_YEAR_MIRROR_NOT_FOUND', `No ATLAS mirror exists for school year #${schoolYearId}. Test-data marking requires an existing year mirror.`, {
			actionHint: 'If this is a legacy fixture with target-year artifacts but no mirror, run the privileged recovery-scaffold operation first, then mark again.',
		});
	}

	const metadata = mirror.lastSyncMetadata as Record<string, unknown> | null;
	if (metadata?.testDataMarked === true) {
		// Idempotent re-mark: end state is already marked; no duplicate audit.
		return { marked: true, alreadyMarked: true };
	}

	await prisma.enrollProSchoolYearMirror.update({
		where: { id: mirror.id },
		data: {
			lastSyncMetadata: {
				...(metadata ?? {}),
				testDataMarked: true,
				testDataMarkedAt: new Date().toISOString(),
				testDataMarkedBy: actorId,
			},
		},
	});
	await prisma.auditLog.create({
		data: {
			schoolId,
			schoolYearId,
			action: 'TEST_DATA_MARKED',
			actorId,
			targetIds: [schoolYearId],
			metadata: {
				source: 'enrollpro-rollover',
				initiatedBy: 'user',
				actorId,
				yearLabel: mirror.yearLabel,
			},
		},
	});
	publishNotificationEvent({
		type: 'TEST_DATA_YEAR_MARKED',
		domain: 'integration',
		severity: 'warning',
		audience: 'PRIVILEGED',
		schoolId,
		schoolYearId,
		facultyId: null,
		message: `School year ${mirror.yearLabel} (#${schoolYearId}) was marked as test data.`,
		metadata: {
			initiatedBy: 'user',
			actorId,
			yearLabel: mirror.yearLabel,
		},
	});
	return { marked: true, alreadyMarked: false };
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
