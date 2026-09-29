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
 * heartbeat timers, and it returns the slot on every path out of the handler.
 *
 * This is NOT an SSE contract change. Event names, the `retry:` frame, replay
 * semantics and authentication are all untouched, and a client whose stream is
 * torn down here re-establishes it the way it already did — by its own timer.
 * (The notification stream does not read the `retry:` value: it hardcodes
 * `INITIAL_BACKOFF_MS` in `useNotificationStream.ts`. The `retry:` frame is
 * still emitted unchanged, but do not credit this teardown with it.)
 */

export const DEFAULT_SSE_HEARTBEAT_MS = 15_000;
/**
 * Concurrent live streams one principal may hold before new ones are refused.
 *
 * Deliberately generous, because refusing a legitimate stream is a visible
 * product failure and the demo is the worst possible place to discover that.
 * Measured legitimate ceiling from the client: `useNotificationStream`
 * (`useNotificationStream.ts:213-214`) opens 2 connections per authenticated
 * tab — the school-year stream plus the school stream, which is conditional on
 * `schoolEventsEnabled`. `OfficerPreferences.tsx:171` and
 * `OfficerRoomPreferences.tsx:118` each add 1, but they are sibling routes, so
 * an officer has at most one of them mounted at a time: **3 per tab**, not 4.
 * Four tabs is therefore ~12, and 20 leaves headroom.
 *
 * Two honest limits of this cap, both NON_BLOCKING and both about the refusal
 * rather than the bound:
 *  - **20 is a per-key ceiling, not a per-account one.** The key is
 *    `user:school:schoolYearId`, so one account streaming two different school
 *    years, or a year-less school stream alongside a year stream, holds one
 *    independent budget per key. QA measured 40 concurrent streams for a single
 *    account (20 in `8500:1:1` plus 20 in the year-less `8500:1:0` bucket).
 *    The account-wide bound is therefore ~20 x (number of distinct keys), and
 *    the real client ceiling of 3 per tab still sits far below it;
 *  - a client refused here gets a 429, which a browser `EventSource` treats as
 *    fatal and will not retry. That is acceptable only because the cap is set
 *    far above any legitimate ceiling; lowering it turns a bounded resource
 *    into a silent live-update outage.
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
	openedAt: number;
	heartbeatsWritten: number;
	/** True once manage() has attached the heartbeat and teardown. */
	live: boolean;
}

export class SseStreamRegistry {
	private readonly heartbeatMs: number;
	private readonly streamsPerPrincipal: number;
	private readonly onCapRejected: (principalKey: string) => void;
	private readonly now: () => number;
	/**
	 * Every admitted slot, including one whose handler has not reached
	 * `manage()` yet. A8 QA BLOCKING-2: counting only managed streams made the
	 * observability blind to exactly the leak that mattered — 20 slots consumed,
	 * `openCount` reporting 0.
	 */
	private readonly byId = new Map<number, RegistryEntry>();
	private readonly byPrincipal = new Map<string, Set<number>>();
	/** Admission slots currently held. */
	private admitted = 0;
	/** Managed streams whose heartbeat timer is live. */
	private liveTimers = 0;
	/** One stderr line per principal, so a capped auto-reconnecting client cannot flood the log. */
	private readonly capWarned = new Set<string>();
	private nextId = 1;

	constructor(options: SseStreamRegistryOptions = {}) {
		this.heartbeatMs = options.heartbeatMs ?? DEFAULT_SSE_HEARTBEAT_MS;
		this.streamsPerPrincipal = options.streamsPerPrincipal ?? DEFAULT_SSE_STREAMS_PER_PRINCIPAL;
		this.onCapRejected =
			options.onCapRejected ??
			((key) => {
				if (this.capWarned.has(key)) return;
				this.capWarned.add(key);
				console.warn(`[sse] refused stream: principal ${key} is at the concurrent-stream cap (${this.streamsPerPrincipal}); further refusals for this principal are not logged`);
			});
		this.now = options.now ?? (() => Date.now());
	}

	/** Open streams for one principal. */
	countFor(principalKey: string): number {
		return this.byPrincipal.get(principalKey)?.size ?? 0;
	}

	/** Admission slots held across every principal. */
	get openCount(): number {
		return this.admitted;
	}

	/**
	 * Live heartbeat timers, for observability: one per managed stream, bounded
	 * because managed streams are bounded per principal.
	 *
	 * This counter is NOT the proof that a timer cannot outlive its stream.
	 * QA showed it survives reverting to `byId.size` with the suite still 10/10,
	 * so a reader must not treat it as a control. The row that actually catches
	 * a surviving timer is behavioural: the committed test asserts that no
	 * further write reaches the response after teardown.
	 */
	get activeHeartbeatCount(): number {
		return this.liveTimers;
	}

	/**
	 * Take a stream slot for `principalKey`, or return null when the principal
	 * is at its cap. The caller is responsible for the HTTP rejection; this only
	 * governs admission.
	 *
	 * The slot carries its own safety release: if the handler throws between
	 * admission and `manage()`, Express's error handler ends the response,
	 * `close` fires, and the slot returns. A8 QA BLOCKING-2: without this a
	 * single throw locked a principal out until process restart.
	 */
	admit(principalKey: string, res?: SseWritableResponse): number | null {
		if (this.countFor(principalKey) >= this.streamsPerPrincipal) {
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
		this.admitted += 1;
		if (res) {
			// Idempotent: manage()'s teardown also releases, and release() tolerates
			// a stream that is already gone.
			res.on('close', () => this.release(principalKey, streamId));
		}
		return streamId;
	}

	release(principalKey: string, streamId: number): void {
		if (this.byPrincipal.get(principalKey)?.delete(streamId)) this.admitted -= 1;
		const set = this.byPrincipal.get(principalKey);
		if (!set) return;
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

		const entry: RegistryEntry = this.byId.get(streamId) ?? {
			streamId,
			principalKey,
			res,
			openedAt: this.now(),
			heartbeatsWritten: 0,
			live: false,
		};
		entry.live = true;
		this.byId.set(streamId, entry);

		let heartbeat: NodeJS.Timeout | null = null;
		let done = false;
		const release = (reason: 'peer-gone' | 'closed' | 'capped') => {
			if (done) return;
			done = true;
			if (heartbeat) {
				clearInterval(heartbeat);
				this.liveTimers -= 1;
			}
			heartbeat = null;
			entry.live = false;
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
			this.byId.delete(streamId);
			this.release(principalKey, streamId);
			settle(reason);
		};

		heartbeat = setInterval(() => {
			// A8: the write result is authoritative. A false result means the
			// peer is gone; previously this was discarded and the stream, its
			// timer and its subscriber were retained indefinitely.
			if (!sseWrite(res, heartbeatPayload())) {
				release('peer-gone');
				return;
			}
			entry.heartbeatsWritten += 1;
		}, this.heartbeatMs);
		// A heartbeat must never be the reason the process stays alive; the
		// HTTP server and its sockets hold the loop open on their own.
		heartbeat.unref?.();
		this.liveTimers += 1;

		registerSseCleanup(req, res, () => release('closed'));
		return { close: () => release('closed'), closedByPeer, streamId };
	}
}

/**
 * Stable key for stream admission.
 *
 * It must be built from the identity the handler actually verified. A8 QA
 * BLOCKING-1: two handlers verified the JWT into a local `decoded` and never
 * assigned it to `req.user`, so `req.user?.userId` was undefined and every
 * authenticated user in the school collapsed into one `anon:<school>:<year>`
 * bucket — turning a per-user cap into a school-wide refusal. Unidentified
 * readers (the unauthenticated public published-schedule stream) deliberately
 * share the `anon:` bucket rather than inheriting a user's.
 */
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
