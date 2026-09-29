/**
 * A8 — SSE stream leak and per-tick work bounding.
 *
 * Packet `docs/prompts/a8-server-stalls-2026-09-29.md`, item 4:
 *   (a) a leaked stream is released;
 *   (b) background work per tick does not scale with the stream count.
 *
 * Both rows are written to FAIL on the pre-fix code and pass only because the
 * behaviour exists, not because a string matches. Row (a) in particular drives
 * `SseStreamRegistry.manage` with a response whose write path reports a gone
 * peer — the exact state the old `setInterval(() => sseWrite(...))` sites
 * detected and then discarded.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { SseStreamRegistry, ssePrincipalKey } from '../lib/sse.js';

/**
 * A8 QA NON_BLOCKING: the behavioural rows drive the registry directly, so
 * reverting any one of the four ROUTE call sites to a bare
 * `setInterval(() => sseWrite(...))` left the whole suite green — and the
 * original defect lived in the routes, not the registry. This is a wiring guard
 * over the real route files, not a substitute for the behavioural rows above:
 * it proves every SSE route goes through the managed lifecycle and takes its
 * admission key from a verified payload.
 */
const ROUTE_DIR = join(import.meta.dirname, '..', 'routes');
const SSE_ROUTES = [
	'notification.router.ts',
	'preference.router.ts',
	'published-schedule.router.ts',
	'room-preference.router.ts',
] as const;

/**
 * Comments are removed before any positional or literal check, so a comment that
 * merely *names* a construct cannot be mistaken for a call to it.
 *
 * Scoped honestly, because the first version of this guard overclaimed: on the
 * committed code, neutralising this strip alone leaves the suite 10/10, since no
 * route comment currently contains the full `res.flushHeaders()` token. The strip
 * is load-bearing for that class of edit — neutralising the strip AND adding such
 * a comment turns the suite red — and QA confirmed that with its own M12c. So it
 * is protection against a future comment, not a fix that is exercised today.
 */
function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Split a router into its `router.get(...)` / `router.post(...)` handlers, so an
 * ordering claim is made per handler rather than per file.
 * `notification.router.ts` is why this matters: it holds `flushHeaders()` once,
 * inside a shared `prepareSse()` helper, and two handlers call it. A whole-file
 * offset comparison would compare one handler's admission against the helper
 * that precedes both, and call a correct route broken.
 */
function handlerBlocks(src: string): string[] {
	const starts = [...src.matchAll(/\brouter\.(get|post|put|patch|delete)\s*\(/g)].map((m) => m.index ?? 0);
	if (starts.length === 0) return [src];
	return starts.map((at, i) => src.slice(at, starts[i + 1] ?? src.length));
}

/** The point at which the status line becomes unwritable for this handler. */
function flushOffsetIn(block: string): number {
	const direct = block.search(/res\.flushHeaders\(\)/);
	const viaHelper = block.search(/\bprepareSse\s*\(\s*res\s*\)/);
	if (direct === -1) return viaHelper;
	if (viaHelper === -1) return direct;
	return Math.min(direct, viaHelper);
}

describe('A8 SSE route wiring', () => {
	for (const file of SSE_ROUTES) {
		it(`${file} registers every stream through the managed lifecycle`, () => {
			const raw = readFileSync(join(ROUTE_DIR, file), 'utf8');
			const src = stripComments(raw);
			assert.match(src, /sseStreams\.manage\(/, `${file} must attach its heartbeat through sseStreams.manage`);

			// No route may hand-roll a heartbeat again: a bare interval that
			// writes without inspecting the result is the pre-A8 defect.
			assert.equal(
				/setInterval\(\s*\(\)\s*=>\s*sseWrite\(/.test(src),
				false,
				`${file} reintroduced a bare setInterval(sseWrite) heartbeat; the write result must be authoritative`,
			);

			// The admission key must be built from an identity the handler actually
			// verified. A8 QA BLOCKING-1: two handlers verified the JWT into a
			// local and never assigned it to `req.user`, so `req.user?.userId`
			// was undefined and every user in the school collapsed into one
			// `anon:` bucket. The shape differs per route — some pass a literal to
			// `ssePrincipalKey`, some funnel through a local `admitStream` helper —
			// so the row is stated as the property itself: a verified identity must
			// reach the key.
			assert.match(
				src,
				/userId:\s*(sseUser|req\.user|decoded)\b/,
				`${file} must feed a verified identity into stream admission`,
			);
			assert.match(src, /ssePrincipalKey\(/, `${file} must build an admission key`);

			// Per SSE handler: admission must precede the point at which the status
			// line becomes unwritable, and must carry the response so the slot is
			// returned when the handler throws before manage().
			//
			// Two shapes occur and both must hold. Some routes admit inline; some
			// (notification.router.ts) funnel admission through a local
			// `admitStream()` helper and flush through a shared `prepareSse()`.
			// Comparing whole-file offsets cannot express either: it would weigh
			// one handler's admission against a helper that precedes both.
			const sseHandlers = handlerBlocks(src).filter((b) => flushOffsetIn(b) > -1);
			assert.ok(sseHandlers.length > 0, `${file} has no recognisable SSE handler`);
			for (const [i, block] of sseHandlers.entries()) {
				const admitAt = block.search(/sseStreams\.admit\(|admitStream\s*\(/);
				assert.ok(
					admitAt > -1,
					`${file} SSE handler ${i + 1} flushes headers without admitting through the stream registry`,
				);
				assert.ok(
					admitAt < flushOffsetIn(block),
					`${file} SSE handler ${i + 1} admits at ${admitAt} but flushes at ${flushOffsetIn(block)}; a 429 cannot reach the client after the flush`,
				);
			}
			assert.match(
				src,
				/sseStreams\.admit\(principalKey, res\)/,
				`${file} must pass res to admit so the slot returns on the error path`,
			);
		});
	}
});

/** A minimal Express-like response whose write outcome we control. */
class FakeResponse extends EventEmitter {
	writableEnded = false;
	destroyed = false;
	written: string[] = [];
	ended = 0;
	/** When true, sseWrite() reports the peer is gone. */
	peerGone = false;

	getHeader(name: string): string | undefined {
		return name.toLowerCase() === 'content-type' ? 'text/event-stream' : undefined;
	}

	write(payload: string): boolean {
		if (this.peerGone) return false;
		this.written.push(payload);
		return true;
	}

	end(): void {
		this.ended += 1;
		this.writableEnded = true;
	}
}

class FakeRequest extends EventEmitter {}

const wait = (ms: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

/**
 * Bound every wait so a regression fails the test instead of hanging the gate.
 * A8's own measurement pass lost time to an unbounded await on exactly this
 * path, so the replacement is deliberate, not defensive decoration.
 */
function within<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return Promise.race([
		promise,
		wait(ms).then(() => {
			throw new Error(`TIMED OUT after ${ms}ms waiting for ${label}`);
		}),
	]);
}

/** How a gone peer actually presents to `sseWrite`: the socket is destroyed. */
function markPeerGone(res: FakeResponse): void {
	res.peerGone = true;
	res.destroyed = true;
}

describe('A8 SSE stream lifecycle', () => {
	it('releases a stream whose peer never sent FIN, on the first failed heartbeat write', async () => {
		const registry = new SseStreamRegistry({ heartbeatMs: 20 });
		const req = new FakeRequest();
		const res = new FakeResponse();
		let unsubscribed = 0;

		const key = ssePrincipalKey({ userId: 7, schoolId: 1, schoolYearId: 1 });
		const streamId = registry.admit(key);
		assert.ok(streamId !== null, 'admission must succeed below the cap');

		const handle = registry.manage({
			req,
			res,
			principalKey: key,
			streamId: streamId as number,
			unsubscribe: () => {
				unsubscribed += 1;
			},
			heartbeatPayload: () => ': heartbeat\n\n',
		});

		assert.equal(registry.openCount, 1, 'one stream is open');
		assert.equal(registry.activeHeartbeatCount, 1, 'exactly one heartbeat timer is live');

		// The half-open condition: the socket is gone but neither req nor res
		// emitted 'close'. This is the state the live server leaked in.
		markPeerGone(res);

		const reason = await within(handle.closedByPeer, 2000, 'the peer-gone release');

		assert.equal(reason, 'peer-gone', 'the stream is closed because the peer is gone');
		assert.equal(registry.openCount, 0, 'the leaked stream is released, not retained');
		assert.equal(registry.countFor(key), 0, 'the principal slot is returned');
		assert.equal(registry.activeHeartbeatCount, 0, 'no heartbeat timer survives the release');
		assert.equal(unsubscribed, 1, 'the event subscription is released exactly once');
		assert.equal(res.ended, 1, 'the server ends its side of a dead stream');
	});

	it('keeps a healthy stream open and only releases it on close', async () => {
		const registry = new SseStreamRegistry({ heartbeatMs: 15 });
		const req = new FakeRequest();
		const res = new FakeResponse();
		let unsubscribed = 0;
		const key = ssePrincipalKey({ userId: 9, schoolId: 1, schoolYearId: 1 });
		const streamId = registry.admit(key) as number;
		const handle = registry.manage({
			req,
			res,
			principalKey: key,
			streamId,
			unsubscribe: () => {
				unsubscribed += 1;
			},
			heartbeatPayload: () => ': heartbeat\n\n',
		});

		await within(wait(60), 2000, 'healthy heartbeats');
		assert.equal(registry.openCount, 1, 'a healthy stream is not torn down by its own heartbeat');
		assert.ok(res.written.length >= 2, `heartbeats are actually written (got ${res.written.length})`);
		assert.equal(unsubscribed, 0, 'a healthy stream stays subscribed');

		req.emit('close');
		assert.equal(registry.openCount, 0, 'a clean close releases the stream');
		assert.equal(unsubscribed, 1, 'a clean close unsubscribes exactly once');
		await within(handle.closedByPeer, 2000, 'the clean-close release');
	});

	it('refuses the stream past the per-principal cap instead of opening an unbounded timer', () => {
		const registry = new SseStreamRegistry({ streamsPerPrincipal: 3 });
		const key = ssePrincipalKey({ userId: 11, schoolId: 1, schoolYearId: 1 });
		const other = ssePrincipalKey({ userId: 12, schoolId: 1, schoolYearId: 1 });

		const admitted = [registry.admit(key), registry.admit(key), registry.admit(key)];
		assert.deepEqual(admitted.filter((id) => id !== null).length, 3, 'the cap is reachable');
		assert.equal(registry.admit(key), null, 'the 4th stream for one principal is refused');
		assert.ok(registry.admit(other) !== null, 'a different principal is unaffected');

		// Releasing one slot admits exactly one more: the cap is a bound, not a latch.
		registry.release(key, admitted[0] as number);
		assert.ok(registry.admit(key) !== null, 'a released slot is reusable');
		assert.equal(registry.admit(key), null, 'and the cap still holds');
	});

	it('bounds live heartbeat timers to the admitted stream count, not to the request count', async () => {
		// The packet's row (b): per-tick background work must be proportional to
		// open streams and bounded by the cap, so an unbounded request flood
		// cannot create unbounded timers.
		const cap = 4;
		const registry = new SseStreamRegistry({ heartbeatMs: 10, streamsPerPrincipal: cap });
		const key = ssePrincipalKey({ userId: 21, schoolId: 1, schoolYearId: 1 });
		const res = new FakeResponse();
		const req = new FakeRequest();

		// 50 connection attempts for one principal.
		let handles = 0;
		for (let i = 0; i < 50; i += 1) {
			const streamId = registry.admit(key, res);
			if (streamId === null) continue;
			registry.manage({ req, res, principalKey: key, streamId, unsubscribe: () => {}, heartbeatPayload: () => ': hb\n\n' });
			handles += 1;
		}

		assert.equal(handles, cap, `only the capped number of streams opened (got ${handles})`);
		assert.equal(registry.activeHeartbeatCount, cap, 'live heartbeat timers equal the cap, not the request count');

		await within(wait(50), 2000, 'capped heartbeats');
		assert.equal(registry.openCount, cap, 'the admitted streams are still open and healthy');
		assert.ok(res.written.length >= cap, 'every admitted stream is being heartbeated');
		assert.equal(registry.activeHeartbeatCount, cap, 'no extra timer was created per request attempt');

		// A8 QA R3: the assertion above is registry bookkeeping and cannot see a
		// timer that outlives its stream — deleting `clearInterval(heartbeat)`
		// from release() left this suite 4/4 green. So observe the timer
		// BEHAVIOUR: after teardown no further write may ever reach the response.
		req.emit('close');
		assert.equal(registry.activeHeartbeatCount, 0, 'closing the request drops every timer');
		const writesAtClose = res.written.length;
		await within(wait(80), 2000, 'post-close silence');
		assert.equal(
			res.written.length,
			writesAtClose,
			`no heartbeat may be written after teardown (a surviving timer wrote ${res.written.length - writesAtClose} more)`,
		);
	});

	it('returns an admitted slot when the handler throws before manage()', async () => {
		// A8 QA BLOCKING-2: admit() used to be fire-and-forget, so anything
		// throwing between admission and manage() burned a slot permanently and
		// locked the principal out until process restart — while openCount
		// reported 0, making the loss invisible.
		const registry = new SseStreamRegistry({ streamsPerPrincipal: 3 });
		const key = ssePrincipalKey({ userId: 31, schoolId: 1, schoolYearId: 1 });

		// Simulate a handler that admits, then throws: the error handler ends the
		// response, which is what releases the slot. Each failure is serial, so
		// the count returns to 0 between attempts — the property under test is
		// that three consecutive failures do not consume three slots.
		for (let i = 0; i < 3; i += 1) {
			const res = new FakeResponse();
			const streamId = registry.admit(key, res);
			assert.ok(streamId !== null, `admission ${i + 1} of 3 succeeds`);
			assert.equal(registry.openCount, 1, 'the admitted slot is visible in the open count');
			assert.equal(registry.countFor(key), 1, `the principal holds exactly one slot during attempt ${i + 1}`);
			res.emit('close');
			assert.equal(registry.openCount, 0, `slot returned after failed attempt ${i + 1}`);
		}
		assert.equal(registry.openCount, 0, 'every slot returned when its response closed');
		assert.ok(registry.admit(key) !== null, 'the principal is not locked out after three failures');

		// And the cap still holds once slots are genuinely held.
		const held: FakeResponse[] = [];		for (let i = 0; i < 3; i += 1) {
			const res = new FakeResponse();
			held.push(res);
			registry.admit(key, res);
		}
		assert.equal(registry.admit(key, held[0]), null, 'the cap still refuses the 4th held stream');
	});

	it('keying is per principal, so one user cannot consume another user\'s slots', () => {
		// A8 QA BLOCKING-1: two handlers verified the token into a local and
		// never wrote it back, so every authenticated user collapsed into
		// `anon:<school>:<year>` and the cap became a school-wide bucket.
		const registry = new SseStreamRegistry({ streamsPerPrincipal: 2 });
		const a = ssePrincipalKey({ userId: 1000, schoolId: 1, schoolYearId: 1 });
		const b = ssePrincipalKey({ userId: 1001, schoolId: 1, schoolYearId: 1 });
		assert.notEqual(a, b, 'two distinct users get distinct keys');

		assert.ok(registry.admit(a) !== null, 'user A stream 1');
		assert.ok(registry.admit(a) !== null, 'user A stream 2');
		assert.equal(registry.admit(a), null, 'user A is at their own cap');
		assert.ok(registry.admit(b) !== null, 'user B is unaffected by user A reaching their cap');
		assert.equal(registry.countFor(a), 2, "user A's count is theirs alone");
		assert.equal(registry.countFor(b), 1, "user B's count is theirs alone");

		// A key built without a userId is the shared anonymous bucket, and it is
		// deliberately distinct from any named principal.
		assert.notEqual(ssePrincipalKey({ schoolId: 1, schoolYearId: 1 }), a, 'an unidentified reader is not folded into a user');
	});
});
