import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';

import app, { requestTiming } from '../app.js';

function requestStatus(port: number, host: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const request = httpRequest({ host: '127.0.0.1', port, path: '/api/v1/health/activity', headers: { host } }, (response) => {
			response.resume();
			response.on('end', () => resolve(response.statusCode ?? 0));
		});
		request.on('error', reject);
		request.end();
	});
}

test('live-use activity route is loopback-only and records ordinary API requests', async () => {
	const server = app.listen(0, '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const { port } = server.address() as AddressInfo;
	try {
		const before = await fetch(`http://127.0.0.1:${port}/api/v1/health/activity`);
		assert.equal(before.status, 200);
		const beforeBody = await before.json() as { observationStartedAt: string; lastInteractiveAt: string | null };
		assert.match(beforeBody.observationStartedAt, /^\d{4}-\d\d-\d\dT/);
		assert.equal(beforeBody.lastInteractiveAt, null, 'the manager probe must not count as user activity');

		const ordinaryApiResponse = await fetch(`http://127.0.0.1:${port}/api/v1/not-a-real-route`);
		assert.equal(ordinaryApiResponse.status, 404, 'an ordinary API request must reach the mounted app without a database');
		assert.match(requestTiming.liveUseActivity().lastInteractiveAt ?? '', /^\d{4}-\d\d-\d\dT/);

		assert.equal(await requestStatus(port, 'example.invalid'), 404, 'a non-loopback Host header must not obtain operational activity');
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
