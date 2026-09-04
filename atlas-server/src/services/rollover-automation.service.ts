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
	applyTestYearRecovery,
	archiveAndSyncActiveYear,
	archiveSchoolYear,
	classifyRecoveryState,
	fetchEnrollProIntegrationHealth,
	isArchiveResolvableConflict,
	previewRolloverSync,
	previewTestYearRecovery,
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
	applyTestRecovery?: typeof applyTestYearRecovery;
	/** RR-09B: seam for the archive-resolvable self-heal path. */
	applyArchiveAndSync?: typeof archiveAndSyncActiveYear;
	/** RR-09B: seam for the post-sync superseded-year archive. */
	archiveYear?: typeof archiveSchoolYear;
	publishNotification?: typeof publishNotificationEvent;
};

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

export async function tickRolloverAutomation(
	schoolId: number,
	dependencies: RolloverAutomationDependencies = {},
): Promise<{
	action: 'applied' | 'skipped' | 'unreachable' | 'conflict' | 'reconfigure-pending' | 'error';
	detail?: string;
	state: SchoolAutomationState;
}> {
	const state = getSchoolState(schoolId);
	const fetchIntegrationHealth = dependencies.fetchIntegrationHealth ?? fetchEnrollProIntegrationHealth;
	const previewRollover = dependencies.previewRollover ?? previewRolloverSync;
	const classifyRecovery = dependencies.classifyRecovery ?? classifyRecoveryState;
	const applyTestRecovery = dependencies.applyTestRecovery ?? applyTestYearRecovery;
	const applyArchiveAndSync = dependencies.applyArchiveAndSync ?? archiveAndSyncActiveYear;
	const archiveYear = dependencies.archiveYear ?? archiveSchoolYear;
	const publishNotification = dependencies.publishNotification ?? publishNotificationEvent;
	const testModeEnabled = dependencies.testModeEnabled ?? TEST_MODE_ENABLED;

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
			notifyOnce(schoolId, state, 'ROLLOVER_ATTENTION_REQUIRED', `EnrollPro is unreachable. Automation will retry in ${Math.round((state.nextAttemptAt.getTime() - Date.now()) / 1000)}s.`, 'warning');
			return { action: 'unreachable', detail: health.message, state };
		}

		const preview = await previewRollover(schoolId);

		// A section ID collision always produces mapping-conflict, so this must
		// happen before the clean atlas-stale-only rollover path below.
		if (canAutoRecoverMarkedTestCollision(preview, testModeEnabled)) {
			const classification = await classifyRecovery(schoolId, preview);
			if (classification.classification === 'TEST_DATA_RECOVERY_AVAILABLE') {
				state.lastResult = 'conflict';
				state.consecutiveFailures = 0;
				state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
				try {
					await applyTestRecovery({
						schoolId,
						actorId: 0,
						confirmClear: true,
						confirmationText: classification.confirmationText,
						acknowledgePublished: false,
					});
					state.lastResult = 'success';
					state.lastNotifiedState = null;
					publishNotification({
						type: 'ROLLOVER_AUTO_SYNC_COMPLETED',
						domain: 'integration',
						severity: 'success',
						audience: 'PRIVILEGED',
						schoolId,
						schoolYearId: preview.enrollProActiveYear?.id ?? 0,
						facultyId: null,
						message: `Test-mode auto-cleared conflicting data and synced EnrollPro for ${preview.enrollProActiveYear?.yearLabel ?? 'active year'}.`,
						metadata: {
							schoolYearId: preview.enrollProActiveYear?.id,
							yearLabel: preview.enrollProActiveYear?.yearLabel,
							initiatedBy: 'system',
							testMode: true,
						},
					});
					return { action: 'applied', detail: 'Test-mode auto-cleared conflicting data', state };
				} catch (recoveryError) {
					const msg = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
					notifyOnce(schoolId, state, 'ROLLOVER_ATTENTION_REQUIRED', `Test-mode auto-clear failed: ${msg.slice(0, 200)}`, 'error');
					return { action: 'error', detail: msg.slice(0, 200), state };
				}
			}
		}

		if (preview.conflicts.length > 0) {
			// RR-09B: archive-resolvable conflicts (label-mismatch wedges)
			// self-heal via the non-destructive archive+sync flow — zero
			// operator action, no ROLLOVER_ATTENTION_REQUIRED noise. The
			// flow publishes ROLLOVER_ARCHIVE_SYNC_COMPLETED itself.
			if (isArchiveResolvableStatus(preview)) {
				try {
					const archiveResult = await applyArchiveAndSync({
						schoolId,
						actorId: 0,
						initiatedBy: 'system',
					});
					state.lastResult = 'success';
					state.consecutiveFailures = 0;
					state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
					state.lastNotifiedState = null;
					return {
						action: 'applied',
						detail: `Archive-and-sync archived ${archiveResult.archivedYears.length} superseded year(s) and synced ${archiveResult.enrollProActiveYear.yearLabel}`,
						state,
					};
				} catch (error) {
					// Same backoff/error handling as the clean path.
					state.consecutiveFailures += 1;
					state.lastResult = 'failure';
					state.nextAttemptAt = new Date(Date.now() + computeNextBackoff(state.consecutiveFailures));
					const message = error instanceof Error ? error.message : String(error);
					notifyOnce(schoolId, state, 'ROLLOVER_ATTENTION_REQUIRED', `Automated archive-and-sync failed: ${message.slice(0, 200)}`, 'error');
					return { action: 'error', detail: message.slice(0, 200), state };
				}
			}

			state.lastResult = 'conflict';
			state.consecutiveFailures = 0;
			state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
			notifyOnce(schoolId, state, 'ROLLOVER_ATTENTION_REQUIRED', `Rollover has ${preview.conflicts.length} conflict(s) requiring manual review.`, 'warning');
			return { action: 'conflict', detail: preview.conflicts[0]?.message, state };
		}

		if (preview.drift.status !== 'atlas-stale') {
			state.lastResult = 'skipped';
			state.consecutiveFailures = 0;
			state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
			return { action: 'skipped', detail: `Drift is ${preview.drift.status}`, state };
		}

		if (preview.reconfiguredSections.length > 0) {
			state.lastResult = 'reconfigure-pending';
			state.consecutiveFailures = 0;
			state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
			notifyOnce(schoolId, state, 'ROLLOVER_ATTENTION_REQUIRED', `${preview.reconfiguredSections.length} section(s) were reconfigured and need officer acknowledgment.`, 'warning');
			return { action: 'reconfigure-pending', detail: `${preview.reconfiguredSections.length} unacknowledged reconfigures`, state };
		}

		await applyRolloverSync(schoolId, undefined, { initiatedBy: 'system' });

		// RR-09B: after a successful sync, archive the superseded year(s) —
		// non-destructive, so this is automation-safe. A failed archive must
		// not fail the rollover itself (the sync already committed); the
		// superseded year simply stays unarchived until a manual archive.
		const archivedAfterSync: Array<{ schoolYearId: number; yearLabel: string }> = [];
		try {
			const activeYearId = preview.enrollProActiveYear?.id ?? 0;
			const superseded = await prisma.enrollProSchoolYearMirror.findMany({
				where: { schoolId, isArchived: false, ...(activeYearId > 0 ? { enrollProSchoolYearId: { not: activeYearId } } : {}) },
				orderBy: { enrollProSchoolYearId: 'asc' },
				select: { enrollProSchoolYearId: true },
			});
			for (const candidate of superseded) {
				const archived = await archiveYear({
					schoolId,
					schoolYearId: candidate.enrollProSchoolYearId,
					actorId: 0,
					reason: preview.enrollProActiveYear
						? `Superseded by EnrollPro rollover to ${preview.enrollProActiveYear.yearLabel}`
						: 'Superseded by EnrollPro rollover',
					initiatedBy: 'system',
					suppressNotification: true,
				});
				archivedAfterSync.push({ schoolYearId: archived.schoolYearId, yearLabel: archived.yearLabel });
			}
		} catch (archiveError) {
			console.error(`[rollover-automation] Post-sync archive failed for school ${schoolId} (sync already committed):`, archiveError);
		}

		state.lastResult = 'success';
		state.consecutiveFailures = 0;
		state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
		state.lastNotifiedState = null;

		publishNotification({
			type: 'ROLLOVER_AUTO_SYNC_COMPLETED',
			domain: 'integration',
			severity: 'success',
			audience: 'PRIVILEGED',
			schoolId,
			schoolYearId: preview.enrollProActiveYear?.id ?? 0,
			facultyId: null,
			message: `Automated rollover sync completed for ${preview.enrollProActiveYear?.yearLabel ?? 'active year'}${archivedAfterSync.length > 0 ? `; archived ${archivedAfterSync.length} superseded school year(s) as read-only history` : ''}.`,
			metadata: {
				schoolYearId: preview.enrollProActiveYear?.id,
				yearLabel: preview.enrollProActiveYear?.yearLabel,
				archivedYears: archivedAfterSync,
				initiatedBy: 'system',
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

export async function markSchoolYearAsTestData(
	schoolId: number,
	schoolYearId: number,
	actorId: number,
): Promise<void> {
	await prisma.enrollProSchoolYearMirror.updateMany({
		where: { schoolId, enrollProSchoolYearId: schoolYearId },
		data: {
			lastSyncMetadata: {
				...(await prisma.enrollProSchoolYearMirror.findUnique({
					where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
					select: { lastSyncMetadata: true },
				}))?.lastSyncMetadata as Record<string, unknown> ?? {},
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
			},
		},
	});
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
