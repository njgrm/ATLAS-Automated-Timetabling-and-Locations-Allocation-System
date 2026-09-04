import { publishNotificationEvent } from './notification-events.service.js';

/**
 * Process-level crash hardening (RR-08).
 *
 * Crash policy (documented per RR-08):
 * - `unhandledRejection`: LOG AND CONTINUE. A rejected promise that nothing
 *   awaited is a bug, but killing the process takes down every SSE connection
 *   and the whole Tailnet surface for what is usually one lost async branch.
 *   The `[FATAL]` log plus an in-app notification makes it visible instead.
 * - `uncaughtException`: LOG AND CONTINUE. ATLAS runs as a single unattended
 *   dev/tailnet deployment with no external process manager; exiting leaves a
 *   502 until a human restarts it. We log the full stack with a `[FATAL]`
 *   prefix and publish a `SERVER_FATAL_ERROR` privileged notification so
 *   operators see the failure in-app, and keep serving.
 *
 * Known risk accepted: after an uncaught exception the process may be in a
 * partially corrupted state. The alternative (silent death with no stack, as
 * in the 2026-09-01 incident) is strictly worse for this deployment. If ATLAS
 * later gains a process manager (systemd, PM2, containers), flip
 * EXIT_ON_UNCAUGHT to true so the manager restores a clean state.
 */

const EXIT_ON_UNCAUGHT = false;

/** Rate-limit for fatal notifications so a crash loop cannot spam the buffer. */
const FATAL_NOTIFICATION_MIN_INTERVAL_MS = 30_000;

let lastFatalNotificationAt = 0;

export type FatalErrorKind = 'uncaughtException' | 'unhandledRejection' | 'sseWriteFailure';

type FatalNotification = {
	type: string;
	domain: 'integration';
	severity: 'error';
	audience: 'PRIVILEGED';
	schoolId: number;
	schoolYearId: number;
	facultyId: null;
	message: string;
	metadata?: Record<string, unknown>;
};

type FatalPublisher = (event: FatalNotification) => unknown;

function describeError(error: unknown): { message: string; stack: string } {
	if (error instanceof Error) {
		return {
			message: error.message,
			stack: error.stack ?? String(error),
		};
	}
	return {
		message: String(error),
		stack: String(error),
	};
}

/**
 * Handle a crash-level error: log with `[FATAL]` prefix + timestamp, then
 * publish a `SERVER_FATAL_ERROR` privileged notification. Never throws —
 * the crash handler itself must not become a crash source.
 */
export function handleFatalError(
	kind: FatalErrorKind,
	error: unknown,
	deps?: { publish?: FatalPublisher },
): void {
	const timestamp = new Date().toISOString();
	const { message, stack } = describeError(error);

	console.error(`[FATAL] [${kind}] ${timestamp}`);
	console.error(stack);

	const publish = deps?.publish ?? ((event: FatalNotification) => {
		publishNotificationEvent(event);
	});

	try {
		const now = Date.now();
		if (now - lastFatalNotificationAt >= FATAL_NOTIFICATION_MIN_INTERVAL_MS) {
			lastFatalNotificationAt = now;
			publish({
				type: 'SERVER_FATAL_ERROR',
				domain: 'integration',
				severity: 'error',
				audience: 'PRIVILEGED',
				// Single-school deployment today; see RR-08 limitations note.
				schoolId: 1,
				schoolYearId: 0,
				facultyId: null,
				message: `ATLAS server recovered from a ${kind === 'unhandledRejection' ? 'rejected background task' : 'internal error'}: ${message.slice(0, 180)}`,
				metadata: {
					kind,
					timestamp,
					stack: stack.slice(0, 2000),
				},
			});
		}
	} catch {
		// A failing notification publish must never escalate a fatal handler
		// into a recursive crash. Swallow and rely on the console log.
	}
}

/** Register the process-level crash handlers. Idempotent. */
export function registerProcessCrashHandlers(): void {
	if (process.listenerCount('uncaughtException') > 0) {
		return;
	}

	process.on('uncaughtException', (error) => {
		handleFatalError('uncaughtException', error);
		if (EXIT_ON_UNCAUGHT) {
			process.exit(1);
		}
	});

	process.on('unhandledRejection', (reason) => {
		handleFatalError('unhandledRejection', reason);
	});
}
