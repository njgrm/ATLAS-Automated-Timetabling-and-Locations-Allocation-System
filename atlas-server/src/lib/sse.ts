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
export function sseWrite(res: SseWritableResponse, payload: string): boolean {
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

/**
 * A8 — managed SSE stream lifecycle (leak fix).
 *
 * A8 measured `streams=` climbing 8 → 26 on the live server and never falling,
 * while a healthy loopback instance released 26 verified streams to 0 within
 * 12 s of a client abort. The difference is the *unclean* close: `req`/`res`
 * only emit `close` when the peer sends FIN or RST. A half-open connection (a
 * sleeping laptop, a silently dropped Tailnet path) emits neither, so the
 * stream, its heartbeat timer and its event subscriber were retained forever.
 *
 * All four SSE routes had the same hole, and each one already *detected* it and
 * threw the answer away:
 *
 *     setInterval(() => sseWrite(res, ': heartbeat\n\n'), 15_000)
 *
 * `sseWrite` returns false when the response is ended or destroyed, but every
 * call site discarded the result. The `ws` collaboration socket in
 * `room-preference-collaboration.service.ts` already had the right shape
 * (`DEFAULT_HEARTBEAT_TIMEOUT_MS` + a prune timer); the SSE path had neither.
 *
 * This helper makes the failed write authoritative: it ends the response,
 * clears the heartbeat and releases the subscription. It also caps concurrent
 * streams per principal, so one client cannot pin an unbounded number of
 * heartbeat timers, and it keeps the open-stream count observable.
 *
 * This is NOT an SSE contract change. Event names, the `retry:` frame, replay
 * semantics and authentication are all untouched, and a client that loses a
 * dead stream reconnects through the `retry:` directive it already honours.
 */

export const DEFAULT_SSE_HEARTBEAT_MS = 15_000;
/**
 * Concurrent live streams one principal may hold before new ones are refused.
 *
 * Deliberately generous, because refusing a legitimate stream is a visible
 * product failure (a screen silently stops receiving live updates) and the demo
 * is the worst possible place to discover that. Measured legitimate ceiling from
 * the client: `useNotificationStream` opens 2 connections per authenticated tab
 * (`useNotificationStream.ts:213-214` — the school-year stream plus the
 * conditional school stream), and `OfficerPreferences.tsx:171` and
 * `OfficerRoomPreferences.tsx:118` each add 1 on their own pages. That is 4 for
 * an officer with both pages open in one tab, so ~16 across four tabs. 20 leaves
 * headroom while still bounding the heartbeat timer count, which is the point of
 * the cap; the leak fix, not the cap, is what actually reclaims a dead stream.
 */
export const DEFAULT_SSE_STREAMS_PER_PRINCIPAL = 20;

export interface SseStreamRegistryOptions {
	heartbeatMs?: number;
	streamsPerPrincipal?: number;
	/** Observability hook; defaults to a single stderr line on cap rejection. */
	onCapRejected?: (principalKey: string) => void;
	now?: () => number;
}

/** The minimum a managed stream needs from an Express response. */
export interface SseWritableResponse {
	writableEnded: boolean;
	destroyed: boolean;
	write(payload: string): boolean;
	end(): void;
	on(event: 'close', listener: () => void): unknown;
}

export interface SseStreamHandle {
	/** Clears the heartbeat and releases the subscription. Idempotent. */
	close: () => void;
	/** Resolves on the first heartbeat write that reports the peer is gone. */
	readonly closedByPeer: Promise<'peer-gone' | 'closed' | 'capped'>;
	readonly streamId: number;
}

interface RegistryEntry {
	streamId: number;
	principalKey: string;
	res: SseWritableResponse;
	close: () => void;
	openedAt: number;
	heartbeatsWritten: number;
}

export class SseStreamRegistry {
	private readonly heartbeatMs: number;
	private readonly streamsPerPrincipal: number;
	private readonly onCapRejected: (principalKey: string) => void;
	private readonly now: () => number;
	private readonly byId = new Map<number, RegistryEntry>();
	private readonly byPrincipal = new Map<string, Set<number>>();
	private nextId = 1;
	private lastCloseReasonValue: 'peer-gone' | 'closed' | 'capped' = 'closed';

	constructor(options: SseStreamRegistryOptions = {}) {
		this.heartbeatMs = options.heartbeatMs ?? DEFAULT_SSE_HEARTBEAT_MS;
		this.streamsPerPrincipal = options.streamsPerPrincipal ?? DEFAULT_SSE_STREAMS_PER_PRINCIPAL;
		this.onCapRejected = options.onCapRejected ?? ((key) => {
			console.warn(`[sse] refused stream: principal ${key} is at the concurrent-stream cap (${this.streamsPerPrincipal})`);
		});
		this.now = options.now ?? (() => Date.now());
	}

	/** Open streams for one principal. */
	countFor(principalKey: string): number {
		return this.byPrincipal.get(principalKey)?.size ?? 0;
	}

	/** Open streams across every principal. */
	get openCount(): number {
		return this.byId.size;
	}

	/**
	 * Live heartbeat timers, which is the per-tick background work this class
	 * exists to bound: one timer per open stream, capped per principal.
	 */
	get activeHeartbeatCount(): number {
		return this.byId.size;
	}

	/**
	 * Take a stream slot for `principalKey`, or return null when the principal
	 * is at its cap. The caller is responsible for the HTTP rejection; this only
	 * governs admission.
	 */
	admit(principalKey: string): number | null {
		if (this.countFor(principalKey) >= this.streamsPerPrincipal) {
			this.lastCloseReasonValue = 'capped';
			this.onCapRejected(principalKey);
			return null;
		}
		const streamId = this.nextId++;
		let set = this.byPrincipal.get(principalKey);
		if (!set) {
			set = new Set<number>();
			this.byPrincipal.set(principalKey, set);
		}
		set.add(streamId);
		return streamId;
	}

	release(principalKey: string, streamId: number): void {
		this.byId.delete(streamId);
		const set = this.byPrincipal.get(principalKey);
		if (!set) return;
		set.delete(streamId);
		if (set.size === 0) this.byPrincipal.delete(principalKey);
	}

	/**
	 * Register an admitted stream: attach a heartbeat that tears the stream down
	 * when a write reports the peer is gone, and return its handle.
	 */
	manage(options: {
		req: { on: (event: 'close', listener: () => void) => void };
		res: SseWritableResponse;
		principalKey: string;
		streamId: number;
		unsubscribe: () => void;
		heartbeatPayload: () => string;
	}): SseStreamHandle {
		const { req, res, principalKey, streamId, unsubscribe, heartbeatPayload } = options;
		let settle: (reason: 'peer-gone' | 'closed' | 'capped') => void = () => {};
		const closedByPeer = new Promise<'peer-gone' | 'closed' | 'capped'>((resolvePromise) => {
			settle = resolvePromise;
		});

		const entry: RegistryEntry = {
			streamId,
			principalKey,
			res,
			close: () => {},
			openedAt: this.now(),
			heartbeatsWritten: 0,
		};
		this.byId.set(streamId, entry);

		let heartbeat: NodeJS.Timeout | null = null;
		let done = false;
		const release = (reason: 'peer-gone' | 'closed' | 'capped') => {
			if (done) return;
			done = true;
			if (heartbeat) clearInterval(heartbeat);
			heartbeat = null;
			try {
				unsubscribe();
			} catch {
				// A dead subscriber must never break teardown (RR-08).
			}
			if (reason === 'peer-gone') {
				// The peer is gone but the socket never closed; end our side so
				// the handle, the timer and the subscriber are all released.
				try {
					res.end();
				} catch {
					// Already destroyed.
				}
			}
			this.release(principalKey, streamId);
			settle(reason);
		};

		entry.close = () => release('closed');
		heartbeat = setInterval(() => {
			// A8: the write result is authoritative. A false result means the
			// peer is gone; previously this was discarded and the stream, its
			// timer and its subscriber were retained indefinitely.
			if (!sseWrite(res, heartbeatPayload())) {
				release('peer-gone');
				return;
			}
			const live = this.byId.get(streamId);
			if (live) live.heartbeatsWritten += 1;
		}, this.heartbeatMs);
		heartbeat.unref?.();

		registerSseCleanup(req, res, () => release('closed'));
		return { close: () => release('closed'), closedByPeer, streamId };
	}

	/** Test/observability affordance: why the most recent stream went away. */
	get lastCloseReason(): 'peer-gone' | 'closed' | 'capped' {
		return this.lastCloseReasonValue;
	}
}

/** Stable key for stream admission. Anonymous public readers share one bucket. */
export function ssePrincipalKey(input: {
	userId?: number | null;
	schoolId?: number | null;
	schoolYearId?: number | null;
}): string {
	const user = typeof input.userId === 'number' && Number.isInteger(input.userId) ? input.userId : null;
	const school = typeof input.schoolId === 'number' && Number.isInteger(input.schoolId) ? input.schoolId : 0;
	const year = typeof input.schoolYearId === 'number' && Number.isInteger(input.schoolYearId) ? input.schoolYearId : 0;
	return `${user ?? 'anon'}:${school}:${year}`;
}

/** Process-wide registry used by the SSE routes. */
export const sseStreams = new SseStreamRegistry();
