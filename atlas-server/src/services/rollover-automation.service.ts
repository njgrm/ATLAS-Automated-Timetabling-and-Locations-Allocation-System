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
	serviceError,
	fetchEnrollProIntegrationHealth,
	findPendingArchiveRecoveryMarker,
	getTestDataRecoveryConfirmation,
	isArchiveResolvableConflict,
	previewRolloverSync,
	previewTestYearRecovery,
	type RolloverStatusResult,
	type TestYearRecoveryResult,
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
	lastResult: 'success' | 'failure' | 'skipped' | 'unreachable' | 'conflict' | 'reconfigure-pending' | 'partial-success' | null;
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
	action: 'applied' | 'skipped' | 'unreachable' | 'conflict' | 'reconfigure-pending' | 'archive-pending' | 'error';
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

		// RR-15A: pending archive completion. A recovery whose synchronization
		// already committed (marker cleared=true, syncApplied=true) but whose
		// superseded-year archival is still pending (archivesApplied=false)
		// must be completed even though the drift is now ALIGNED. This branch
		// runs before the aligned-skip check and before any new destructive
		// test-mode recovery. The retry executes archival ONLY — never
		// destructive cleanup and never rollover synchronization. Markers for
		// any other school or year, and markers whose sync never committed,
		// never qualify (findPendingArchiveRecoveryMarker enforces this).
		const pendingArchive = preview.enrollProActiveYear?.id != null
			? await findPendingArchiveRecoveryMarker(schoolId, preview.enrollProActiveYear.id)
			: null;
		if (pendingArchive) {
			try {
				const recoveryResult = await applyTestRecovery({
					schoolId,
					actorId: 0,
					confirmClear: true,
					confirmationText: getTestDataRecoveryConfirmation(pendingArchive.schoolYearId),
					acknowledgePublished: false,
				});
				const partialSuccess = (recoveryResult as Partial<TestYearRecoveryResult> | undefined)?.partialSuccess === true;
				if (partialSuccess) {
					state.lastResult = 'partial-success';
					state.consecutiveFailures += 1;
					state.nextAttemptAt = new Date(Date.now() + computeNextBackoff(state.consecutiveFailures));
					// The recovery service already emitted the partial-success
					// notification; do not claim completion and keep the
					// marker retryable.
					return { action: 'archive-pending', detail: 'Archival still pending after automated retry', state };
				}
				state.lastResult = 'success';
				state.consecutiveFailures = 0;
				state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
				state.lastNotifiedState = null;
				const resumedResult = recoveryResult as Partial<TestYearRecoveryResult> | undefined;
				const archivedYears = (resumedResult?.archivedYears ?? []).map((year) => ({
					schoolYearId: year.schoolYearId,
					yearLabel: year.yearLabel,
				}));
				publishNotification({
					type: 'ROLLOVER_AUTO_SYNC_COMPLETED',
					domain: 'integration',
					severity: 'success',
					audience: 'PRIVILEGED',
					schoolId,
					schoolYearId: preview.enrollProActiveYear?.id ?? 0,
					facultyId: null,
					message: `Automated retry completed pending archival for ${preview.enrollProActiveYear?.yearLabel ?? 'active year'}.`,
					metadata: {
						schoolYearId: preview.enrollProActiveYear?.id,
						yearLabel: preview.enrollProActiveYear?.yearLabel,
						archivedYears,
						initiatedBy: 'system',
						archiveRetry: true,
					},
				});
				return { action: 'applied', detail: 'Completed pending archival', state };
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				state.consecutiveFailures += 1;
				state.lastResult = 'failure';
				state.nextAttemptAt = new Date(Date.now() + computeNextBackoff(state.consecutiveFailures));
				notifyOnce(schoolId, state, 'ROLLOVER_ATTENTION_REQUIRED', `Automated archival retry failed (marker remains pending): ${msg.slice(0, 200)}`, 'error');
				return { action: 'error', detail: msg.slice(0, 200), state };
			}
		}

		// A section ID collision always produces mapping-conflict, so this must
		// happen before the clean atlas-stale-only rollover path below.
		if (canAutoRecoverMarkedTestCollision(preview, testModeEnabled)) {
			const classification = await classifyRecovery(schoolId, preview);
			if (classification.classification === 'TEST_DATA_RECOVERY_AVAILABLE') {
				state.lastResult = 'conflict';
				state.consecutiveFailures = 0;
				state.nextAttemptAt = new Date(Date.now() + TICK_INTERVAL_MS);
				try {
					const recoveryResult = await applyTestRecovery({
						schoolId,
						actorId: 0,
						confirmClear: true,
						confirmationText: classification.confirmationText,
						acknowledgePublished: false,
					});
					const partialSuccess = (recoveryResult as Partial<TestYearRecoveryResult> | undefined)?.partialSuccess === true;
					if (partialSuccess) {
						// RR-15A: synchronization committed but archival is
						// pending. Do NOT record complete success and do NOT
						// emit a completion notification — the recovery
						// service emitted the partial-success notification and
						// the durable marker stays retryable. Backoff governs
						// when the pending-marker branch retries archival.
						state.lastResult = 'partial-success';
						state.consecutiveFailures += 1;
						state.nextAttemptAt = new Date(Date.now() + computeNextBackoff(state.consecutiveFailures));
						return {
							action: 'archive-pending',
							detail: 'Test-mode auto-cleared conflicting data; superseded-year archival pending',
							state,
						};
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
