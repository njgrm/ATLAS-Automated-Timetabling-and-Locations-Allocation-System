/**
 * ACTOR-SCHOOL-MUTATIONS-C01 — mounted mutation-route authority proof.
 *
 * The test mounts the real runtime router and real mixed system/JWT middleware.
 * Every rejected request instruments every Prisma delegate/raw operation and a
 * local upstream server. A rejection is valid only when both counters stay at
 * zero; assertions never merely claim zero dispatch.
 *
 * Run: `npm run test:actor-school-mutations`
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'actor-school-mutations-c01-disposable-proof-secret';
const SYSTEM_TOKEN = 'actor-school-mutations-c01-system-token-not-a-jwt';
const REQUEST_TIMEOUT_MS = 1_000;

const routes = [
	{ path: '/rollover-recovery/mark-test-data', requiresPrivileged: true },
	{ path: '/rollover-recovery/scaffold', requiresPrivileged: true },
	{ path: '/rollover-recovery/apply', requiresPrivileged: true },
	{ path: '/rollover-sync/preview', requiresPrivileged: false },
	{ path: '/rollover-sync/apply', requiresPrivileged: true },
	{ path: '/rollover-sync/reset-dummy-year', requiresPrivileged: true },
	{ path: '/rollover-archive/preview', requiresPrivileged: true },
	{ path: '/rollover-archive/apply', requiresPrivileged: true },
] as const;

type Case = {
	label: string;
	body: Record<string, unknown>;
	token: string;
	status: number;
	code: string;
	route: (typeof routes)[number];
};

function instrumentPrismaDispatches(prisma: any, recorded: Array<{ model: string; operation: string }>): () => void {
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
	for (const operation of ['$transaction', '$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe']) {
		block('prisma', operation, prisma);
	}
	return () => {
		for (const { target, operation, original } of originals) target[operation] = original;
	};
}

test('runtime mutation routes fail closed before every downstream dispatch', async () => {
	process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';
	process.env.JWT_SECRET = JWT_SECRET;
	process.env.ATLAS_SYSTEM_TOKEN = SYSTEM_TOKEN;
	(globalThis as any).__actorSchoolMutationQueries = [];

	const { prisma } = await import('../lib/prisma.js');
	const dataContext = await import('../lib/data-context.js');
	const runtimeRouter = (await import('../routes/runtime.router.js')).default;
	const instrumented = prisma;
	const restorePrisma = instrumentPrismaDispatches(prisma, (globalThis as any).__actorSchoolMutationQueries);

	let upstreamRequests = 0;
	const upstream = http.createServer((_req, res) => {
		upstreamRequests += 1;
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify({ data: null }));
	});
	await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
	const upstreamAddress = upstream.address();
	if (upstreamAddress && typeof upstreamAddress === 'object') {
		process.env.ENROLLPRO_API = `http://127.0.0.1:${upstreamAddress.port}`;
	}

	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => {
		void (dataContext as any).withDataContext(instrumented, async () => { next(); });
	});
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
	const crossSchool = jwt.sign({ userId: 3, role: 'officer', schoolId: 99, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
	const faculty = jwt.sign({ userId: 4, role: 'faculty', schoolId: 1, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });

	const post = async (path: string, body: Record<string, unknown>, token: string) => {
		const controller = new AbortController();
		// Allow cold local middleware/module setup to settle without weakening the
		// downstream-dispatch assertions below.
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		try {
			const response = await fetch(`${baseUrl}${path}`, {
				method: 'POST',
				headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
				body: JSON.stringify(body),
				signal: controller.signal,
			});
			return { status: response.status, payload: await response.json() as any };
		} catch (error) {
			return { status: 598, payload: { code: error instanceof Error ? error.name : 'REQUEST_FAILED' } };
		} finally {
			clearTimeout(timeout);
		}
	};
	const routeBody = (schoolId?: unknown) => ({ schoolYearId: 77, ...(schoolId === undefined ? {} : { schoolId }) });

	const cases: Case[] = [];
	for (const route of routes) {
		for (const [label, schoolId] of [
			['missing', undefined],
			['empty', ''],
			['text', 'abc'],
			['boolean', true],
			['array', [1]],
			['object', {}],
			['zero', 0],
			['negative', -1],
			['fractional', 1.5],
		] as const) {
			cases.push({ label: `${route.path} system ${label} school`, route, body: routeBody(schoolId), token: SYSTEM_TOKEN, status: 400, code: 'INVALID_PARAM' });
		}
		cases.push({ label: `${route.path} JWT missing actor school`, route, body: routeBody(1), token: noSchool, status: 403, code: 'SCHOOL_SCOPE_REQUIRED' });
		cases.push({ label: `${route.path} JWT cross-school`, route, body: routeBody(1), token: crossSchool, status: 403, code: 'CROSS_SCHOOL_DENIED' });
		if (route.requiresPrivileged) {
			cases.push({ label: `${route.path} JWT non-privileged`, route, body: routeBody(1), token: faculty, status: 403, code: 'FORBIDDEN' });
		}
	}

	try {
		for (const testCase of cases) {
			(globalThis as any).__actorSchoolMutationQueries.length = 0;
			const beforeUpstream = upstreamRequests;
			const response = await post(testCase.route.path, testCase.body, testCase.token);
			assert.equal(response.status, testCase.status, `${testCase.label}: expected ${testCase.status}, got ${response.status}/${response.payload.code}`);
			assert.equal(response.payload.code, testCase.code, `${testCase.label}: expected ${testCase.code}, got ${response.payload.code}`);
			assert.equal((globalThis as any).__actorSchoolMutationQueries.length, 0, `${testCase.label}: dispatched Prisma work`);
			assert.equal(upstreamRequests, beforeUpstream, `${testCase.label}: dispatched upstream work`);
		}

		const systemResponse = await post('/rollover-recovery/mark-test-data', routeBody(1), SYSTEM_TOKEN);
		assert.notEqual(systemResponse.status, 400, 'system caller with explicit school passes target-school validation');
		assert.notEqual(systemResponse.status, 403, 'system caller with explicit school passes actor-school validation');
		assert.ok(upstreamRequests > 0 || (globalThis as any).__actorSchoolMutationQueries.length > 0, 'system caller reaches real route work after authorization');
		const sameSchoolResponse = await post('/rollover-recovery/mark-test-data', routeBody(1), privileged);
		assert.notEqual(sameSchoolResponse.status, 400, 'same-school JWT passes target-school validation');
		assert.notEqual(sameSchoolResponse.status, 403, 'same-school JWT passes actor-school validation');
	} finally {
		server.closeAllConnections();
		upstream.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await new Promise<void>((resolve) => upstream.close(() => resolve()));
		restorePrisma();
		await instrumented.$disconnect();
	}
});
