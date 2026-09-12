import { fail } from './errors.mjs';

/**
 * Bounded exponential restart/backoff policy.
 *
 * Pure and deterministic so the supervisor-level crash/restart/backoff proof
 * can run without real timers. `attempt` is 1-based.
 */
export function computeBackoffMs(attempt, options) {
	const baseMs = options?.baseMs;
	const maxMs = options?.maxMs;
	if (!Number.isInteger(attempt) || attempt < 1) throw fail('BACKOFF_ATTEMPT_INVALID', 'attempt must be a positive integer.');
	if (!Number.isInteger(baseMs) || baseMs <= 0) throw fail('BACKOFF_BASE_INVALID', 'baseMs must be a positive integer.');
	if (!Number.isInteger(maxMs) || maxMs < baseMs) throw fail('BACKOFF_MAX_INVALID', 'maxMs must be an integer >= baseMs.');
	const raw = baseMs * 2 ** (attempt - 1);
	return Math.min(raw, maxMs);
}

/**
 * Track consecutive unexpected child exits inside a crash-loop window.
 *
 * - A child that survives past `survivalWindowMs` of healthy liveness and
 *   dependency readiness resets the failure counter, so isolated crashes never
 *   accumulate into a permanent give-up.
 * - Once `maxRestarts` consecutive failures accumulate, the guard refuses
 *   further restarts and the supervisor reports a fail-closed `FAILED` state
 *   instead of restarting forever.
 */
export class CrashLoopGuard {
	constructor(options) {
		this.maxRestarts = options.maxRestarts;
		this.baseMs = options.backoffBaseMs;
		this.maxMs = options.backoffMaxMs;
		this.survivalWindowMs = options.survivalWindowMs;
		if (!Number.isInteger(this.maxRestarts) || this.maxRestarts < 1) throw fail('CRASH_GUARD_INVALID', 'maxRestarts must be a positive integer.');
		this.consecutiveFailures = 0;
		this.lastHealthyAt = null;
	}

	/** Record a child that reached and held healthy liveness+readiness. */
	recordHealthy(now) {
		const at = now ?? Date.now();
		if (this.lastHealthyAt === null || at - this.lastHealthyAt >= this.survivalWindowMs) {
			this.consecutiveFailures = 0;
		}
		this.lastHealthyAt = at;
	}

	/**
	 * Record an unexpected exit and decide the bounded recovery action.
	 * @returns {{ action: 'restart', attempt: number, delayMs: number } | { action: 'give_up', reason: string }}
	 */
	recordUnexpectedExit() {
		this.consecutiveFailures += 1;
		if (this.consecutiveFailures > this.maxRestarts) {
			return { action: 'give_up', reason: `exceeded maxRestarts=${this.maxRestarts}` };
		}
		return {
			action: 'restart',
			attempt: this.consecutiveFailures,
			delayMs: computeBackoffMs(this.consecutiveFailures, { baseMs: this.baseMs, maxMs: this.maxMs }),
		};
	}
}

/** Sleep helper that is injectable so tests avoid real wall-clock delays. */
export function sleep(ms) {
	return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
