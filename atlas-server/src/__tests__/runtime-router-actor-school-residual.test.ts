/**
 * ACTOR-SCHOOL-RESIDUAL-AUTHORITY-C01 — mounted route proof for the residual
 * rollover preview and strict term-authority school parsing.
 *
 * Run: `npm run test:actor-school-residual`
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'actor-school-residual-authority-c01-secret';
const SYSTEM_TOKEN = 'actor-school-residual-authority-c01-system-token';

function instrumentPrismaDispatches(prisma: any, recorded: Array<unknown>): () => void {
	const originals: Array<{ target: any; operation: string; original: (...args: any[]) => unknown }> = [];
	const block = (model: string, operation: string, target: any) => {
		const original = target[operation];
		if (typeof original !== 'function') return;
		originals.push({ target, operation, original });
		target[operation] = () => {
			recorded.push({ model, operation });
			return new Promise<never>(() => undefined);
		};
	};
	for (const [model, delegate] of Object.entries(prisma)) {
		if (!model.startsWith('$') && delegate && typeof delegate === 'object') {
			for (const operation of Object.keys(delegate)) block(model, operation, delegate);
		}
	}
	for (const operation of ['$transaction', '$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe']) block('prisma', operation, prisma);
	return () => { for (const { target, operation, original } of originals) target[operation] = original; };
}

test('rollover preview and term authority reject residual school-id forms before dispatch', async () => {
	process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';
	process.env.JWT_SECRET = JWT_SECRET;
	process.env.ATLAS_SYSTEM_TOKEN = SYSTEM_TOKEN;
	(globalThis as any).__actorSchoolResidualQueries = [];

	const { prisma } = await import('../lib/prisma.js');
	const dataContext = await import('../lib/data-context.js');
	const runtimeRouter = (await import('../routes/runtime.router.js')).default;
	const recorded = (globalThis as any).__actorSchoolResidualQueries as Array<unknown>;
	const restorePrisma = instrumentPrismaDispatches(prisma, recorded);
	let upstreamRequests = 0;
	const upstream = http.createServer((_req, res) => {
		upstreamRequests += 1;
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify({ data: null }));
	});
	await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
	const upstreamAddress = upstream.address();
	if (upstreamAddress && typeof upstreamAddress === 'object') process.env.ENROLLPRO_API = `http://127.0.0.1:${upstreamAddress.port}`;

	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => { void (dataContext as any).withDataContext(prisma, async () => { next(); }); });
	app.use('/api/v1/runtime', runtimeRouter);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	const baseUrl = `http://127.0.0.1:${port}/api/v1/runtime`;
	const privileged = jwt.sign({ userId: 1, role: 'officer', schoolId: 1, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
	const noSchool = jwt.sign({ userId: 2, role: 'officer', authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });

	const request = (path: string, token: string, init?: RequestInit) => {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 750);
		return fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal, headers: { authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } }).catch(() => new Response(JSON.stringify({ code: 'REQUEST_TIMEOUT' }), { status: 598 })).finally(() => clearTimeout(timeout));
	};
	const get = (path: string, token: string) => request(path, token);
	const post = (path: string, body: Record<string, unknown>, token: string) => request(path, token, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});

	try {
		const previewCases: Array<[string, string, number, string]> = [
			['missing actor school', '/rollover-recovery/preview?schoolId=1', 403, 'SCHOOL_SCOPE_REQUIRED'],
			['missing school query', '/rollover-recovery/preview', 400, 'INVALID_PARAM'],
			['hex query', '/rollover-recovery/preview?schoolId=0x10', 400, 'INVALID_PARAM'],
			['exponent query', '/rollover-recovery/preview?schoolId=1e2', 400, 'INVALID_PARAM'],
			['leading zero query', '/rollover-recovery/preview?schoolId=01', 400, 'INVALID_PARAM'],
			['space query', '/rollover-recovery/preview?schoolId=%201%20', 400, 'INVALID_PARAM'],
			['plus query', '/rollover-recovery/preview?schoolId=%2B1', 400, 'INVALID_PARAM'],
		];
		for (const [label, path, status, code] of previewCases) {
			recorded.length = 0;
			const beforeUpstream = upstreamRequests;
			const response = await get(path, label === 'missing actor school' ? noSchool : SYSTEM_TOKEN);
			const payload = await response.json() as any;
			assert.equal(response.status, status, `${label}: expected ${status}, got ${response.status}/${payload.code}`);
			assert.equal(payload.code, code, `${label}: expected ${code}`);
			assert.equal(recorded.length, 0, `${label}: dispatched Prisma work`);
			assert.equal(upstreamRequests, beforeUpstream, `${label}: dispatched upstream work`);
		}

		const strictValues: unknown[] = [true, [1], '0x10', '1e2', '01', ' 1 ', '+1'];
		for (const schoolId of strictValues) {
			recorded.length = 0;
			const beforeUpstream = upstreamRequests;
			const response = await post('/term-authority/preview?schoolId=1', { schoolId }, privileged);
			const payload = await response.json() as any;
			assert.equal(response.status, 400, `term schoolId ${JSON.stringify(schoolId)} must be rejected, got ${response.status}/${payload.code}`);
			assert.equal(payload.code, 'INVALID_PARAM');
			assert.equal(recorded.length, 0, `term schoolId ${JSON.stringify(schoolId)} dispatched Prisma work`);
			assert.equal(upstreamRequests, beforeUpstream, `term schoolId ${JSON.stringify(schoolId)} dispatched upstream work`);
		}

		// An invalid body must win deterministically over a valid query value.
		recorded.length = 0;
		const precedence = await post('/term-authority/preview?schoolId=1', { schoolId: '01' }, privileged);
		assert.equal(precedence.status, 400);
		assert.equal((await precedence.json() as any).code, 'INVALID_PARAM');
		assert.equal(recorded.length, 0);

		// Canonical values and same-school actor authority remain reachable.
		const valid = await post('/term-authority/preview', { schoolId: 1 }, privileged);
		assert.notEqual(valid.status, 400, `canonical same-school value unexpectedly rejected: ${valid.status}`);
		const validString = await post('/term-authority/preview', { schoolId: '1' }, privileged);
		assert.notEqual(validString.status, 400, `canonical string value unexpectedly rejected: ${validString.status}`);
		const actorPreview = await get('/rollover-recovery/preview?schoolId=1', privileged);
		assert.notEqual(actorPreview.status, 403, `matched actor school unexpectedly rejected: ${actorPreview.status}`);
	} finally {
		server.closeAllConnections();
		upstream.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await new Promise<void>((resolve) => upstream.close(() => resolve()));
		restorePrisma();
		await prisma.$disconnect();
	}
});
