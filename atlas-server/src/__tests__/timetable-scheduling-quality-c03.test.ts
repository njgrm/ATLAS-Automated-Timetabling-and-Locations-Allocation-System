import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

import { withDataContext } from '../lib/data-context.js';

const SECRET = 'timetable-scheduling-quality-c03-secret';
const RUN_PATH = '/api/v1/generation/1/10/runs/316/violation-repair-options';

async function withRepairServer<T>(fn: (request: (body: unknown, actor?: Record<string, unknown>) => Promise<Response>, dispatches: () => number, writes: () => number) => Promise<T>, runValue: unknown = null): Promise<T> {
	process.env.JWT_SECRET = SECRET;
	let dbDispatches = 0;
	let writeAttempts = 0;
	const read = async () => { dbDispatches += 1; return runValue; };
	const write = async () => { writeAttempts += 1; throw new Error('read-only repair route attempted a write'); };
	const client = {
		generationRun: { findFirst: read, findMany: read, findUnique: read, update: write, updateMany: write, create: write, delete: write, deleteMany: write },
	};
	const generationRouter = (await import('../routes/generation.router.js')).default;
	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => { void withDataContext(client as never, async () => next()); });
	app.use('/api/v1/generation', generationRouter);
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	try {
		const address = server.address();
		assert.ok(address && typeof address === 'object');
		const baseUrl = `http://127.0.0.1:${address.port}${RUN_PATH}`;
		const request = (body: unknown, actor: Record<string, unknown> = { userId: 46, role: 'officer', schoolId: 1 }) => fetch(baseUrl, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${jwt.sign(actor, SECRET, { expiresIn: '5m' })}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify(body),
		});
		return await fn(request, () => dbDispatches, () => writeAttempts);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}

const locator = {
	code: 'FACULTY_TIME_CONFLICT',
	termIndex: 1,
	entryIds: ['entry-a', 'entry-b'],
	facultyId: 12,
	day: 'MONDAY',
	startTime: '08:00',
	endTime: '08:45',
};

test('C03 route rejects malformed/coerced locator identities and cross-school actors before dispatch', async () => {
	await withRepairServer(async (request, dispatches) => {
		for (const body of [null, [], 'locator', { ...locator, termIndex: '1' }, { ...locator, entryIds: [1, 2] }]) {
			const response = await request(body);
			assert.equal(response.status, 400, `rejected locator ${JSON.stringify(body)}`);
		}
		const crossSchool = await request(locator, { userId: 46, role: 'officer', schoolId: 2 });
		assert.equal(crossSchool.status, 403);
		const missingSchool = await request(locator, { userId: 46, role: 'officer' });
		assert.equal(missingSchool.status, 403);
		assert.equal(dispatches(), 0, 'invalid body and actor scope must dispatch no database work');
	}, null);
});

test('C03 route reloads canonical run state and rejects a missing run without writes', async () => {
	await withRepairServer(async (request, dispatches, writes) => {
		const response = await request(locator);
		assert.equal(response.status, 404);
		assert.ok(dispatches() > 0, 'a scoped canonical run lookup is required');
		assert.equal(writes(), 0);
	}, null);
});
