import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import express from 'express';
import { createServer } from 'node:http';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'scheduler-route-authority-c01';

const secret = process.env.JWT_SECRET;

function token(role: string, capabilities: string[] = []): string {
	return jwt.sign({ userId: 41, schoolId: 7, role, capabilities }, secret as string, { expiresIn: '5m' });
}

test('scheduler can reach generation workspace routes but cannot directly publish', async () => {
	const generationRouter = (await import('../routes/generation.router.js')).default;
	const app = express();
	app.use('/api/v1/generation', generationRouter);
	const server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object');
	const base = `http://127.0.0.1:${address.port}/api/v1/generation`;
	try {
		const generation = await fetch(`${base}/invalid/1/runs`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token('scheduler')}`, 'content-type': 'application/json' },
			body: '{}',
		});
		assert.equal(generation.status, 400, 'scheduler capability passes before malformed school scope is rejected');

		const teacher = await fetch(`${base}/invalid/1/runs`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token('faculty')}`, 'content-type': 'application/json' },
			body: '{}',
		});
		assert.equal(teacher.status, 403, 'faculty without scheduler capability is denied before service dispatch');

		const schedulerPublish = await fetch(`${base}/1/1/runs/1/publish`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token('scheduler')}`, 'content-type': 'application/json' },
			body: '{}',
		});
		assert.equal(schedulerPublish.status, 403, 'scheduler cannot directly publish');

		const officerPublish = await fetch(`${base}/invalid/1/runs/1/publish`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token('officer')}`, 'content-type': 'application/json' },
			body: '{}',
		});
		assert.equal(officerPublish.status, 400, 'legacy direct publication remains available to officers');
	} finally {
		await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});
