/**
 * GEN-C02R Correction 3 — actor-school authority on the mounted generation
 * entry points.
 *
 * Run: `npx tsx src/__tests__/generation-readiness-actor-scope-genc02r.test.ts`
 *
 * Hermetic: the rejection paths are asserted to halt BEFORE any service
 * invocation, so no database or service write/read is required.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'genc02r-actor-scope-test-secret-value';

// Import after the secret is set (module reads env at call time, but keep order explicit).
const { default: generationRouter } = await import('../routes/generation.router.js');

const SECRET = process.env.JWT_SECRET as string;

function token(payload: Record<string, unknown>): string {
	return jwt.sign(payload, SECRET, { expiresIn: '5m' });
}

async function withServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
	const app = express();
	app.use(express.json());
	app.use('/api/v1/generation', generationRouter);
	app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(500).json({ code: 'UNHANDLED', message: err instanceof Error ? err.message : String(err) });
	});
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	try {
		return await fn(`http://127.0.0.1:${port}`);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}

async function get(base: string, path: string, bearer: string | null): Promise<{ status: number; body: any }> {
	const res = await fetch(`${base}${path}`, { method: 'GET', headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });
	const text = await res.text();
	return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function post(base: string, path: string, bearer: string | null, body: unknown): Promise<{ status: number; body: any }> {
	const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body ?? {}) });
	const text = await res.text();
	return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('C3. readiness diagnostic rejects a cross-school actor with a typed 403', async () => {
	await withServer(async (base) => {
		const crossSchool = token({ userId: 1, role: 'officer', schoolId: 41 });
		const readiness = await get(base, '/api/v1/generation/99/8/readiness/diagnostic', crossSchool);
		assert.equal(readiness.status, 403);
		assert.equal(readiness.body.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(readiness.body.readiness, undefined);
	});
});

test('C3. readiness diagnostic rejects an unresolved actor school with a typed 403', async () => {
	await withServer(async (base) => {
		const noSchool = token({ userId: 1, role: 'officer' });
		const readiness = await get(base, '/api/v1/generation/41/8/readiness/diagnostic', noSchool);
		assert.equal(readiness.status, 403);
		assert.equal(readiness.body.code, 'SCHOOL_SCOPE_REQUIRED');
	});
});

test('C3. generation trigger rejects a cross-school actor before any service invocation', async () => {
	await withServer(async (base) => {
		const crossSchool = token({ userId: 1, role: 'officer', schoolId: 41 });
		const run = await post(base, '/api/v1/generation/99/8/runs', crossSchool, {});
		assert.equal(run.status, 403);
		assert.equal(run.body.code, 'CROSS_SCHOOL_DENIED');
		assert.equal(run.body.run, undefined, 'no run may be produced for rejected scope');
	});
});

test('C3. SYSTEM_ADMIN without a bound school is not a cross-school bypass', async () => {
	await withServer(async (base) => {
		const systemAdmin = token({ userId: 0, role: 'SYSTEM_ADMIN' });
		const readiness = await get(base, '/api/v1/generation/41/8/readiness/diagnostic', systemAdmin);
		assert.equal(readiness.status, 403);
		assert.equal(readiness.body.code, 'SCHOOL_SCOPE_REQUIRED');
	});
});

test('UX-C01 dependency. The mounted readiness diagnostic stays exposed with its contract', () => {
	const source = readFileSync(fileURLToPath(new URL('../routes/generation.router.ts', import.meta.url)), 'utf8');
	assert.match(source, /readiness\/diagnostic/, 'the mounted route path must remain');
	assert.match(source, /buildGenerationReadiness/, 'the route must consume the canonical readiness service');
	assert.match(source, /assertActorSchoolScope/, 'the route must bind the actor school');
});

