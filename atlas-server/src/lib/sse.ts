import type { Response } from 'express';

/**
 * SSE write safety (RR-08).
 *
 * The 2026-09-01 crash diagnosis identified unguarded `res.write()` calls in
 * SSE heartbeat timers and event-subscriber sends as the prime
 * uncaught-exception candidates: writing to a Response that a client has
 * already aborted emits an `error` event on the stream, and Express attaches
 * no `error` listener — an unhandled `error` event throws and, with Node's
 * default policy, kills the process. These helpers make every SSE write
 * abort-safe.
 */

/** Attach a no-op error listener so post-abort write errors cannot become uncaught exceptions. */
export function attachSseErrorGuard(res: Response): void {
	res.on('error', () => {
		// Client went away between cleanup and write. Nothing to do; the
		// close handler below owns teardown.
	});
}

/**
 * Safe SSE write. Returns false when the response is already ended or
 * destroyed (subscriber should be dropped), true when the write was issued.
 */
export function sseWrite(res: Response, payload: string): boolean {
	if (res.writableEnded || res.destroyed) {
		return false;
	}
	try {
		res.write(payload);
		return true;
	} catch {
		return false;
	}
}

/** Combined SSE teardown: clear the heartbeat on either req or res close. */
export function registerSseCleanup(
	req: { on: (event: 'close', listener: () => void) => void },
	res: { on: (event: 'close', listener: () => void) => void },
	cleanup: () => void,
): void {
	let done = false;
	const run = () => {
		if (done) return;
		done = true;
		cleanup();
	};
	req.on('close', run);
	res.on('close', run);
}
