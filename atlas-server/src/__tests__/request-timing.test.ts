/**
 * LANE-C SERVER-TIMING-C01 — slow-request and event-loop-stall diagnostics.
 *
 * The 2026-09-25 class-schedule audit measured 6–7 unrelated requests finishing
 * within ~10 ms of each other ~8 s after page start: a shared server stall whose
 * cause the browser cannot see. These rows pin the diagnostics that name it:
 *
 *   T1 a request slower than the threshold logs one line with its path, numeric
 *      ids masked as `:n` (never ids or query strings), status and duration
 *   T2 a fast request logs nothing
 *   T3 a synchronous block longer than the stall threshold logs one stall line
 *      naming the request that was active during the block (by route pattern)
 *   T4 a stall with no request in flight is reported as background work
 *   T5 the monitor's timer never keeps the process alive, and stop() is idempotent
 *
 * LANE-C SERVER-STALL-C01 — the live e8553752/89295c27 logs (2026-09-25) showed
 * every stall line filled by open notification SSE streams (running for hours),
 * with the request that actually blocked hidden behind "+7 more", and
 * `inFlight=18` counting those streams as pending work:
 *
 *   T7 open event streams never crowd the active list: the short-lived request
 *      active during the block is named, streams are reported as a count
 *   T8 streams are excluded from a slow-request line's inFlight, and a stream
 *      closing after hours never logs itself as a slow request
 *   T9 a stall line carries the V8 heap in use and its limit, so a GC pause is
 *      distinguishable from handler CPU work
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';

import express from 'express';

import { createRequestTiming } from '../lib/request-timing.js';

function busyWait(ms: number) {
	const end = performance.now() + ms;
	while (performance.now() < end) {
		// deliberate synchronous block
	}
}

async function withServer(app: express.Express, run: (base: string) => Promise<void>) {
	const server = app.listen(0);
	await new Promise<void>((resolve) => server.once('listening', () => resolve()));
	const { port } = server.address() as AddressInfo;
	try {
		await run(`http://127.0.0.1:${port}`);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}

test('T1/T2 slow requests log their masked path; fast requests log nothing', async () => {
	const lines: string[] = [];
	const timing = createRequestTiming({ slowRequestMs: 50, log: (line) => lines.push(line) });
	const app = express();
	app.use(timing.middleware);
	const router = express.Router();
	router.get('/runs/:runId/flags', async (_req, res) => {
		await new Promise((resolve) => setTimeout(resolve, 80));
		res.json({ ok: true });
	});
	router.get('/fast', (_req, res) => {
		res.json({ ok: true });
	});
	app.use('/api/v1/demo', router);

	await withServer(app, async (base) => {
		await fetch(`${base}/api/v1/demo/fast`);
		await fetch(`${base}/api/v1/demo/runs/317/flags?token=secret-value`);
	});

	assert.equal(lines.length, 1, `expected exactly one slow-request line, got ${JSON.stringify(lines)}`);
	const [line] = lines;
	assert.match(line, /^\[slow-request\] GET \/api\/v1\/demo\/runs\/:n\/flags 200 \d+ms/);
	assert.doesNotMatch(line, /317|secret-value|token=/, 'must not log ids or query strings');
	assert.equal(timing.inFlightCount(), 0);
});

test('T3 a synchronous block names the request active during it', async () => {
	const lines: string[] = [];
	const timing = createRequestTiming({ stallMs: 150, sampleIntervalMs: 20, log: (line) => lines.push(line) });
	const app = express();
	app.use(timing.middleware);
	app.get('/api/v1/sections/summary/:schoolYearId', async (_req, res) => {
		await new Promise((resolve) => setTimeout(resolve, 20));
		busyWait(300);
		res.json({ ok: true });
	});
	timing.start();
	try {
		await withServer(app, async (base) => {
			await fetch(`${base}/api/v1/sections/summary/10?schoolId=1`);
			await new Promise((resolve) => setTimeout(resolve, 60));
		});
	} finally {
		timing.stop();
	}

	const stalls = lines.filter((line) => line.startsWith('[event-loop-stall]'));
	assert.equal(stalls.length, 1, `expected one stall line, got ${JSON.stringify(lines)}`);
	assert.match(stalls[0], /blocked ~\d+ms/);
	assert.match(stalls[0], /active: GET \/api\/v1\/sections\/summary\/:n \(done, \d+ms\)/);
	assert.doesNotMatch(stalls[0], /schoolId=|\/10\b/, 'must not log ids or query strings');
});

test('T4 a stall with nothing in flight is reported as background work', async () => {
	const lines: string[] = [];
	const timing = createRequestTiming({ stallMs: 150, sampleIntervalMs: 20, log: (line) => lines.push(line) });
	timing.start();
	try {
		await new Promise((resolve) => setTimeout(resolve, 30));
		busyWait(300);
		await new Promise((resolve) => setTimeout(resolve, 60));
	} finally {
		timing.stop();
	}
	const stalls = lines.filter((line) => line.startsWith('[event-loop-stall]'));
	assert.equal(stalls.length, 1, `expected one stall line, got ${JSON.stringify(lines)}`);
	assert.match(stalls[0], /active: none \(background work\)/);
});

test('T6 a request that fails through the error handler keeps its full path label', async () => {
	// Found by the real-server start check: Express resets req.baseUrl once a
	// router hands an error to the app-level handler, so a pattern built from
	// baseUrl + route.path collapsed to "GET /".
	const lines: string[] = [];
	const timing = createRequestTiming({ slowRequestMs: 30, log: (line) => lines.push(line) });
	const app = express();
	app.use(timing.middleware);
	const router = express.Router();
	router.get('/', async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
		throw new Error('database unreachable');
	});
	app.use('/api/v1/subjects', router);
	app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(500).json({ code: 'INTERNAL' });
	});

	await withServer(app, async (base) => {
		await fetch(`${base}/api/v1/subjects?schoolId=1`);
	});

	assert.equal(lines.length, 1, JSON.stringify(lines));
	assert.match(lines[0], /^\[slow-request\] GET \/api\/v1\/subjects 500 \d+ms/);
});

test('T5 the monitor timer is unref-ed and stop() is idempotent', () => {
	const timing = createRequestTiming({ log: () => {} });
	const timer = timing.start();
	assert.equal(timer.hasRef(), false, 'the stall monitor must not keep the process alive');
	assert.equal(timing.start(), timer, 'a second start() reuses the running monitor');
	timing.stop();
	timing.stop();
});

function openStream(res: express.Response) {
	res.setHeader('Content-Type', 'text/event-stream');
	res.flushHeaders();
	res.write('retry: 2000\n\n');
}

test('T7/T8/T9 open event streams do not hide the blocking request or inflate inFlight', async () => {
	const lines: string[] = [];
	const timing = createRequestTiming({ slowRequestMs: 50, stallMs: 150, sampleIntervalMs: 20, log: (line) => lines.push(line) });
	const app = express();
	app.use(timing.middleware);
	app.get('/api/v1/notifications/:schoolId/:schoolYearId/events', (_req, res) => {
		openStream(res);
	});
	app.get('/api/v1/generation/:schoolId/:schoolYearId/readiness/diagnostic', async (_req, res) => {
		await new Promise((resolve) => setTimeout(resolve, 20));
		busyWait(300);
		res.json({ ok: true });
	});
	timing.start();
	const controllers: AbortController[] = [];
	try {
		await withServer(app, async (base) => {
			// Nine streams: more than the eight entries a stall line lists.
			for (let i = 0; i < 9; i += 1) {
				const controller = new AbortController();
				controllers.push(controller);
				await fetch(`${base}/api/v1/notifications/1/10/events`, { signal: controller.signal });
			}
			await new Promise((resolve) => setTimeout(resolve, 80));
			await fetch(`${base}/api/v1/generation/1/10/readiness/diagnostic`);
			await new Promise((resolve) => setTimeout(resolve, 60));
			for (const controller of controllers) controller.abort();
			await new Promise((resolve) => setTimeout(resolve, 60));
		});
	} finally {
		timing.stop();
	}

	const stalls = lines.filter((line) => line.startsWith('[event-loop-stall]'));
	assert.equal(stalls.length, 1, `expected one stall line, got ${JSON.stringify(lines)}`);
	assert.match(stalls[0], /active: GET \/api\/v1\/generation\/:n\/:n\/readiness\/diagnostic \(done, \d+ms\)/);
	assert.doesNotMatch(stalls[0], /notifications/, 'streams must be counted, not listed');
	assert.doesNotMatch(stalls[0], /more/, 'nothing may be elided when only one request was active');
	assert.match(stalls[0], /; streams=9$/);
	assert.match(stalls[0], /^\[event-loop-stall\] blocked ~\d+ms heap=\d+\/\d+MB; active: /);

	const slow = lines.filter((line) => line.startsWith('[slow-request]'));
	assert.equal(slow.length, 1, `streams must never log as slow requests, got ${JSON.stringify(slow)}`);
	assert.match(slow[0], /^\[slow-request\] GET \/api\/v1\/generation\/:n\/:n\/readiness\/diagnostic 200 \d+ms inFlight=0 streams=9$/);
	assert.equal(timing.inFlightCount(), 0, 'closed streams leave nothing in flight');
});
