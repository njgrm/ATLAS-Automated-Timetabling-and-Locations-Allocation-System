/**
 * ROLLOVER-YEAR-IDENTITY-C01 — mounted production router proof.
 *
 * The read-only preview resolver is exercised against a disposable upstream
 * server and a zero-row Prisma surface. Mutation and post-result delegates are
 * instrumented only through the approved router factory seam.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'rollover-year-identity-c01-test-secret';
const SYSTEM_TOKEN = 'rollover-year-identity-c01-system-token';
const SCHOOL_ID = 7;
const ACTIVE_YEAR_ID = 600;

function zeroRowPrismaSurface(prisma: any): () => void {
	const originals: Array<{ target: any; name: string; value: unknown }> = [];
	for (const [key, delegate] of Object.entries(prisma)) {
		if (key.startsWith('$') || !delegate || typeof delegate !== 'object') continue;
		for (const name of Object.keys(delegate)) {
			const original = (delegate as any)[name];
			if (typeof original !== 'function') continue;
			originals.push({ target: delegate, name, value: original });
			(delegate as any)[name] = async () => {
				if (name === 'findMany') return [];
				if (name === 'findFirst' || name === 'findUnique') return null;
				if (name === 'count') return 0;
				return null;
			};
		}
	}
	return () => {
		for (const original of originals) (original.target as any)[original.name] = original.value;
	};
}

function upstreamResponse(path: string, resolveActiveYear: boolean): unknown {
	if (path === '/integration/v1/school-year') return resolveActiveYear ? { data: { id: ACTIVE_YEAR_ID, yearLabel: '2099-2100' } } : { data: null };
	if (path === '/integration/v1/health') return { ok: true };
	if (path === '/settings/public') return { data: {} };
	return { data: [] };
}

async function startServer(app: http.RequestListener): Promise<{ server: http.Server; url: string }> {
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object');
	return { server, url: `http://127.0.0.1:${address.port}` };
}

test('mounted rollover routes gate identity, suppress invalid follow-ons, preserve valid counts, and enforce actor school', async () => {
	process.env.JWT_SECRET = JWT_SECRET;
	process.env.ATLAS_SYSTEM_TOKEN = SYSTEM_TOKEN;
	let resolveActiveYear = true;
	const upstream = await startServer((_req, res) => {
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify(upstreamResponse(new URL(_req.url ?? '/', 'http://localhost').pathname, resolveActiveYear)));
	});
	process.env.ENROLLPRO_API = upstream.url;

	const { prisma } = await import('../lib/prisma.js');
	const restorePrisma = zeroRowPrismaSurface(prisma);
	const { createRuntimeRouter } = await import('../routes/runtime.router.js');

	let applyCalls = 0;
	let resetCalls = 0;
	let cycleCalls = 0;
	const events: Array<{ type: string; schoolYearId: number }> = [];
	const apply = async () => {
		applyCalls += 1;
		return {
			enrollProActiveYear: null,
			sync: { faculty: null, sections: null, policyReady: true, canonicalTemplatesSeeded: 0 },
		} as any;
	};
	const reset = async () => {
		resetCalls += 1;
		return { enrollProActiveYear: null, resetApplied: true } as any;
	};
	const publish = (event: any) => {
		events.push({ type: event.type, schoolYearId: event.schoolYearId });
		return event;
	};
	const cycle = async (_schoolId: number, schoolYearId: number) => {
		cycleCalls += 1;
		return { state: 'EMPTY', version: 1, updatedAt: '2099-01-01T00:00:00.000Z', schoolYearId } as any;
	};

	const app = express();
	app.use(express.json());
	app.use('/api/v1/runtime', createRuntimeRouter({
		applyRolloverSync: apply as any,
		resetDummyYearAndApplyRollover: reset as any,
		publishNotificationEvent: publish as any,
		getOrCreateTeachingLoadCycleSource: cycle as any,
	}));
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	const mounted = await startServer(app);
	const base = `${mounted.url}/api/v1/runtime`;
	const post = async (path: string, body: Record<string, unknown>, token: string) => {
		const response = await fetch(`${base}${path}`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
			body: JSON.stringify(body),
		});
		return { status: response.status, body: await response.json() as any };
	};

	try {
		const system = SYSTEM_TOKEN;
		resolveActiveYear = false;
		const unresolved = await post('/rollover-sync/apply', { schoolId: SCHOOL_ID }, system);
		assert.equal(unresolved.status, 409);
		assert.equal(unresolved.body.code, 'ACTIVE_YEAR_UNRESOLVED');
		assert.equal(unresolved.body.mutationStarted, false);
		assert.equal(applyCalls, 0);
		resolveActiveYear = true;
		const invalidApply = await post('/rollover-sync/apply', { schoolId: SCHOOL_ID }, system);
		assert.equal(invalidApply.status, 409);
		assert.equal(invalidApply.body.code, 'ROLLOVER_ACTIVE_YEAR_IDENTITY_INVALID');
		assert.equal(invalidApply.body.followOnsWithheld, true);
		assert.equal(applyCalls, 1);
		assert.equal(cycleCalls, 0);
		assert.equal(events.length, 0);

		const invalidReset = await post('/rollover-sync/reset-dummy-year', { schoolId: SCHOOL_ID, confirmReset: true }, system);
		assert.equal(invalidReset.status, 409);
		assert.equal(invalidReset.body.code, 'ROLLOVER_ACTIVE_YEAR_IDENTITY_INVALID');
		assert.equal(resetCalls, 1);
		assert.equal(events.length, 0);

		const validApply = async () => ({
			enrollProActiveYear: { id: ACTIVE_YEAR_ID, yearLabel: '2099-2100' },
			sync: { faculty: { activeCount: 2 }, sections: { count: 3 }, policyReady: true },
		} as any);
		const validRouter = createRuntimeRouter({
			applyRolloverSync: validApply as any,
			publishNotificationEvent: publish as any,
			getOrCreateTeachingLoadCycleSource: cycle as any,
		});
		const validApp = express();
		validApp.use(express.json());
		validApp.use('/api/v1/runtime', validRouter);
		const validMounted = await startServer(validApp);
		const validResponse = await fetch(`${validMounted.url}/api/v1/runtime/rollover-sync/apply`, {
			method: 'POST',
			headers: { authorization: `Bearer ${system}`, 'content-type': 'application/json' },
			body: JSON.stringify({ schoolId: SCHOOL_ID }),
		});
		assert.equal(validResponse.status, 200);
		assert.equal(cycleCalls, 1);
		assert.deepEqual(events.slice(-2).map((event) => event.schoolYearId), [ACTIVE_YEAR_ID, ACTIVE_YEAR_ID]);
		validMounted.server?.close?.();

		const actorToken = jwt.sign({ userId: 99, role: 'officer', schoolId: SCHOOL_ID + 1, authSource: 'local' }, JWT_SECRET);
		const crossSchool = await post('/rollover-sync/apply', { schoolId: SCHOOL_ID }, actorToken);
		assert.equal(crossSchool.status, 403);
		assert.equal(crossSchool.body.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(applyCalls, 1);
	} finally {
		mounted.server.closeAllConnections();
		await new Promise<void>((resolve) => mounted.server.close(() => resolve()));
		upstream.server.closeAllConnections();
		await new Promise<void>((resolve) => upstream.server.close(() => resolve()));
		restorePrisma();
		await prisma.$disconnect();
	}
});
