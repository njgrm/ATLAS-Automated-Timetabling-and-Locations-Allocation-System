import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import express from 'express';
import { createServer } from 'node:http';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'scheduler-c01-actor-school-http';

test('cross-school scheduler requests stop before every scoped workspace service', async () => {
	const [generation, policy, preGeneration, manualEdit, locked, quickPlace, unassigned, publication] = await Promise.all([
		import('../routes/generation.router.js'),
		import('../routes/scheduling-policy.router.js'),
		import('../routes/pre-generation-draft.router.js'),
		import('../routes/manual-edit.router.js'),
		import('../routes/locked-session.router.js'),
		import('../routes/timetable-quick-place.router.js'),
		import('../routes/timetable-unassigned.router.js'),
		import('../routes/publication-approval.router.js'),
	]);
	const app = express();
	app.use(express.json());
	app.use('/generation', generation.default);
	app.use('/policy', policy.default);
	app.use('/pre-generation', preGeneration.default);
	app.use('/manual', manualEdit.default);
	app.use('/locked', locked.default);
	app.use('/quick-place', quickPlace.default);
	app.use('/unassigned', unassigned.default);
	app.use('/publication-approval', publication.default);
	const server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object');
	const token = jwt.sign({ userId: 41, schoolId: 7, role: 'scheduler' }, process.env.JWT_SECRET as string, { expiresIn: '5m' });
	const origin = `http://127.0.0.1:${address.port}`;
	try {
		const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
		const responses = await Promise.all([
			fetch(`${origin}/generation/8/1/runs/gate`, { headers }),
			fetch(`${origin}/policy/8/1`, { headers }),
			fetch(`${origin}/policy/8/1`, { method: 'PUT', headers, body: '{}' }),
			fetch(`${origin}/pre-generation/8/1/pre-generation-drafts`, { headers }),
			fetch(`${origin}/pre-generation/8/1/pre-generation-drafts/commit`, { method: 'POST', headers, body: '{}' }),
			fetch(`${origin}/manual/8/1/runs/1/manual-edits`, { headers }),
			fetch(`${origin}/manual/8/1/runs/1/manual-edits/commit`, { method: 'POST', headers, body: '{}' }),
			fetch(`${origin}/locked/8/1/locks`, { headers }),
			fetch(`${origin}/locked/8/1/locks`, { method: 'POST', headers, body: '{}' }),
			fetch(`${origin}/locked/8/1/locks/1`, { method: 'DELETE', headers }),
			fetch(`${origin}/quick-place/8/1/runs/1/quick-place/preview`, { method: 'POST', headers }),
			fetch(`${origin}/quick-place/8/1/runs/1/quick-place/apply`, { method: 'POST', headers, body: '{}' }),
			fetch(`${origin}/unassigned/8/1/unassigned-workflow/summary`, { headers }),
			fetch(`${origin}/publication-approval/8/1/runs/1/requests`, { method: 'POST', headers, body: '{}' }),
		]);
		assert.deepEqual(responses.map((response) => response.status), Array(responses.length).fill(403));
		for (const response of responses.slice(0, -1)) assert.equal((await response.json() as { code: string }).code, 'CROSS_SCHOOL_DENIED');
		assert.equal((await responses[responses.length - 1].json() as { code: string }).code, 'APPROVAL_SCOPE_MISMATCH');
	} finally {
		await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});
