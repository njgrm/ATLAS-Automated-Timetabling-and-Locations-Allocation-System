import type { NextFunction, Request, Response } from 'express';
import { getHeapStatistics } from 'node:v8';

/**
 * LANE-C SERVER-TIMING-C01 — slow-request and event-loop-stall diagnostics.
 *
 * Browser timing on the live `/timetable` load (2026-09-25) showed unrelated
 * requests finishing together ~8 s after page start: a shared server stall the
 * client cannot attribute. Two log lines name it from the supervisor log:
 *
 *   [slow-request] GET /api/v1/sections/summary/:n 200 7285ms inFlight=6
 *   [event-loop-stall] blocked ~6700ms heap=412/4144MB; active: GET /api/v1/... (done, 6912ms), GET /api/v1/... (running 812ms); streams=15
 *
 * A stall line lists every request active during the blocked window (a block is
 * only observable after it ends, so the culprit usually shows as "done");
 * "active: none (background work)" points at timers such as rollover automation.
 * Lines carry the request path with numeric ids and long opaque segments masked —
 * never query strings, bodies, headers or tokens.
 *
 * SERVER-STALL-C01: open `text/event-stream` responses (notification SSE) stay
 * "running" for hours by design. They are counted as `streams=N`, never listed
 * as active work, counted in `inFlight`, or logged as slow requests — on the
 * live logs they filled every stall line and hid the request that blocked. A
 * stall line also carries `heap=<used>/<limit>MB` so a GC pause can be told
 * apart from handler CPU work.
 */

export type TimingLogger = (line: string) => void;

export interface RequestTimingOptions {
	/** Requests at or above this duration log a `[slow-request]` line. */
	slowRequestMs?: number;
	/** Event-loop lag at or above this duration logs an `[event-loop-stall]` line. */
	stallMs?: number;
	/** How often the stall monitor samples the event loop. */
	sampleIntervalMs?: number;
	log?: TimingLogger;
}

interface InFlightRequest {
	method: string;
	path: string;
	startedAt: number;
	res: Response;
}

interface FinishedRequest {
	method: string;
	path: string;
	startedAt: number;
	finishedAt: number;
}

const MAX_LISTED_ACTIVE = 8;
const MB = 1024 * 1024;

function isEventStream(res: Response): boolean {
	const type = res.getHeader('content-type');
	return typeof type === 'string' && type.startsWith('text/event-stream');
}

function heapSummary(): string {
	const { used_heap_size: used, heap_size_limit: limit } = getHeapStatistics();
	return `heap=${Math.round(used / MB)}/${Math.round(limit / MB)}MB`;
}
const RECENT_FINISHED_CAPACITY = 64;

/**
 * The request path without its query string, with numeric ids (`:n`) and long
 * opaque segments (`:opaque`) masked. Captured from `originalUrl` on entry: a
 * pattern built from `req.baseUrl` + `req.route.path` is unreliable because
 * Express resets `baseUrl` when a router hands an error to the app handler.
 */
function maskedPath(req: Request): string {
	const raw = (req.originalUrl || req.url || '').split('?')[0];
	return raw
		.split('/')
		.map((segment) => {
			if (/^\d+$/.test(segment)) return ':n';
			if (segment.length > 32) return ':opaque';
			return segment;
		})
		.join('/');
}

export function createRequestTiming(options: RequestTimingOptions = {}) {
	const slowRequestMs = options.slowRequestMs ?? 1000;
	const stallMs = options.stallMs ?? 200;
	const sampleIntervalMs = options.sampleIntervalMs ?? 100;
	const log = options.log ?? ((line: string) => console.warn(line));

	const inFlight = new Map<number, InFlightRequest>();
	// The monitor only observes a block after it ends, by which time the request
	// that caused it has usually finished, so recent completions are kept too.
	const recentFinished: FinishedRequest[] = [];
	let nextId = 0;
	let monitor: NodeJS.Timeout | null = null;

	function middleware(req: Request, res: Response, next: NextFunction) {
		const id = nextId++;
		const startedAt = performance.now();
		const path = maskedPath(req);
		inFlight.set(id, { method: req.method, path, startedAt, res });
		let settled = false;
		const settle = () => {
			if (settled) return;
			settled = true;
			inFlight.delete(id);
			if (isEventStream(res)) return;
			const finishedAt = performance.now();
			const elapsed = finishedAt - startedAt;
			recentFinished.push({ method: req.method, path, startedAt, finishedAt });
			if (recentFinished.length > RECENT_FINISHED_CAPACITY) recentFinished.shift();
			if (elapsed >= slowRequestMs) {
				const { requests, streams } = partitionInFlight();
				const streamSuffix = streams > 0 ? ` streams=${streams}` : '';
				log(`[slow-request] ${req.method} ${path} ${res.statusCode} ${Math.round(elapsed)}ms inFlight=${requests.length}${streamSuffix}`);
			}
		};
		res.on('finish', settle);
		res.on('close', settle);
		next();
	}

	/** In-flight requests, with open event streams split out as a count. */
	function partitionInFlight(): { requests: InFlightRequest[]; streams: number } {
		const requests: InFlightRequest[] = [];
		let streams = 0;
		for (const entry of inFlight.values()) {
			if (isEventStream(entry.res)) streams += 1;
			else requests.push(entry);
		}
		return { requests, streams };
	}

	/** Requests running at any point in `[windowStart, at]`: still in flight, or finished inside the window. */
	function describeActive(windowStart: number, at: number): string {
		const { requests, streams } = partitionInFlight();
		const active = [
			...recentFinished
				.filter((entry) => entry.finishedAt >= windowStart)
				.map((entry) => `${entry.method} ${entry.path} (done, ${Math.round(entry.finishedAt - entry.startedAt)}ms)`),
			...requests.map((entry) => `${entry.method} ${entry.path} (running ${Math.round(at - entry.startedAt)}ms)`),
		];
		const streamSuffix = streams > 0 ? `; streams=${streams}` : '';
		if (active.length === 0) return `none (background work)${streamSuffix}`;
		const more = active.length > MAX_LISTED_ACTIVE ? `, +${active.length - MAX_LISTED_ACTIVE} more` : '';
		return `${active.slice(0, MAX_LISTED_ACTIVE).join(', ')}${more}${streamSuffix}`;
	}

	/** Starts the stall monitor. Its timer never keeps the process alive. */
	function start(): NodeJS.Timeout {
		if (monitor) return monitor;
		let expected = performance.now() + sampleIntervalMs;
		monitor = setInterval(() => {
			const now = performance.now();
			const lag = now - expected;
			expected = now + sampleIntervalMs;
			if (lag >= stallMs) {
				const windowStart = now - lag - sampleIntervalMs;
				log(`[event-loop-stall] blocked ~${Math.round(lag)}ms ${heapSummary()}; active: ${describeActive(windowStart, now)}`);
			}
		}, sampleIntervalMs);
		monitor.unref();
		return monitor;
	}

	function stop() {
		if (!monitor) return;
		clearInterval(monitor);
		monitor = null;
	}

	return { middleware, start, stop, inFlightCount: () => inFlight.size };
}
