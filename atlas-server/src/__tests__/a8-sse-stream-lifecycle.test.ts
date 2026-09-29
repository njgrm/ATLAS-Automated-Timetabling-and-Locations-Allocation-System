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
import { describe, it } from 'node:test';

import { SseStreamRegistry, ssePrincipalKey } from '../lib/sse.js';

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
			const streamId = registry.admit(key);
			if (streamId === null) continue;
			registry.manage({ req, res, principalKey: key, streamId, unsubscribe: () => {}, heartbeatPayload: () => ': hb\n\n' });
			handles += 1;
		}

		assert.equal(handles, cap, `only the capped number of streams opened (got ${handles})`);
		assert.equal(registry.activeHeartbeatCount, cap, 'live heartbeat timers equal the cap, not the request count');

		await within(wait(50), 2000, 'capped heartbeats');
		assert.equal(registry.openCount, cap, 'the admitted streams are still open and healthy');
		assert.equal(res.written.length >= cap, true, 'every admitted stream is being heartbeated');

		req.emit('close');
		assert.equal(registry.activeHeartbeatCount, 0, 'closing the request drops every timer');
	});
});
