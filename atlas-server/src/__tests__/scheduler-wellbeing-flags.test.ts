import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import test from 'node:test';

const secret = 'scheduler-wellbeing-test-secret';
process.env.JWT_SECRET = secret;
const { withDataContext } = await import('../lib/data-context.js');
const { default: preferenceRouter } = await import('../routes/preference.router.js');

const path = '/api/v1/preferences/1/7/faculty/11/wellbeing';
const flags = { avoidUpperFloors: true, pregnancySupport: false, physicalAilmentSupport: true };
const sentinel = {
	id: 9, schoolId: 1, schoolYearId: 7, facultyId: 11, ...flags,
	minimizeTravelTime: true, notes: 'keep this note', status: 'SUBMITTED',
	submittedAt: new Date('2026-09-01T00:00:00.000Z'), version: 8,
	timeSlots: [{ id: 44, day: 'MONDAY', startTime: '08:00', endTime: '09:00', preference: 'AVAILABLE' }],
};

async function withServer<T>(run: (url: string) => Promise<T>) {
	const app = express();
	app.use(express.json());
	app.use('/api/v1/preferences', preferenceRouter);
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
	try { return await run(url); } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

function token(role: string, schoolId = 1) {
	return jwt.sign({ userId: 5, role, authSource: 'local', schoolId }, secret, { expiresIn: '5m' });
}

async function request(url: string, bearer: string | null, body: unknown) {
	const response = await fetch(`${url}${path}`, {
		method: 'PATCH',
		headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
	return { status: response.status, body: await response.json() as any };
}

test('scheduler wellbeing PATCH rejects faculty and cross-school callers before service dispatch', async () => {
	let calls = 0;
	const db = { facultyPreference: { async upsert() { calls += 1; return sentinel; } } };
	await withDataContext(db, () => withServer(async (url) => {
		const faculty = await request(url, token('faculty'), flags);
		assert.equal(faculty.status, 403);
		const foreign = await request(url, token('officer', 2), flags);
		assert.equal(foreign.status, 403);
		assert.equal(calls, 0);
	}));
});

test('scheduler wellbeing PATCH accepts only three booleans and preserves all other preference data', async () => {
	const updates: unknown[] = [];
	const db = { facultyPreference: { async upsert(args: any) { updates.push(args); return sentinel; } } };
	await withDataContext(db, () => withServer(async (url) => {
		const officer = token('officer');
		for (const invalid of [{ ...flags, notes: 'forbidden' }, { ...flags, pregnancySupport: undefined }, { ...flags, avoidUpperFloors: 'yes' }]) {
			const result = await request(url, officer, invalid);
			assert.equal(result.status, 400);
		}
		const result = await request(url, officer, flags);
		assert.equal(result.status, 200);
		assert.equal(updates.length, 1);
		const args = updates[0] as any;
		assert.deepEqual(args.update, flags);
		assert.deepEqual(args.where, { schoolId_schoolYearId_facultyId: { schoolId: 1, schoolYearId: 7, facultyId: 11 } });
		assert.equal(result.body.preference.notes, sentinel.notes);
		assert.equal(result.body.preference.status, sentinel.status);
		assert.equal(result.body.preference.submittedAt, sentinel.submittedAt.toISOString());
		assert.equal(result.body.preference.version, sentinel.version);
		assert.equal(result.body.preference.minimizeTravelTime, true);
		assert.deepEqual(result.body.preference.timeSlots, sentinel.timeSlots);
	}));
});

test('missing preference creation uses minimal legacy defaults without a migration', async () => {
	let captured: any;
	const db = { facultyPreference: { async upsert(args: any) { captured = args; return { ...args.create, timeSlots: [] }; } } };
	const { updateSchedulerWellbeing } = await import('../services/preference.service.js');
	await withDataContext(db, async () => {
		await updateSchedulerWellbeing(1, 7, 11, flags);
	});
	assert.deepEqual(captured.create, {
		schoolId: 1, schoolYearId: 7, facultyId: 11,
		status: 'DRAFT', notes: null, submittedAt: null, version: 1, ...flags,
	});
	assert.deepEqual(captured.update, flags);
});
