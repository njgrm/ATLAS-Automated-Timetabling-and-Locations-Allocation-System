import { expect, test } from '@playwright/test';

const localClientUrl = process.env.ATLAS_LOCAL_CLIENT_URL ?? 'http://127.0.0.1:5174';
const localServerHealthUrl = process.env.ATLAS_LOCAL_SERVER_HEALTH_URL ?? 'http://127.0.0.1:5001/api/v1/health';
const tailnetHealthUrl = process.env.ATLAS_TAILNET_HEALTH_URL ?? 'https://njgrm.buru-degree.ts.net/api/v1/health';

test.describe('ATLAS Tailnet runtime preflight', () => {
	test('local client, local API, and Tailnet health are reachable before timetable QA', async ({ request }) => {
		const [client, server, tailnet] = await Promise.all([
			request.get(localClientUrl, { timeout: 10_000 }),
			request.get(localServerHealthUrl, { timeout: 10_000 }),
			request.get(tailnetHealthUrl, { timeout: 20_000 }),
		]);

		expect(client.status(), `Local Vite client must be reachable at ${localClientUrl}.`).toBeLessThan(500);
		expect(server.ok(), `Local ATLAS API health must return 2xx at ${localServerHealthUrl}.`).toBeTruthy();
		expect(tailnet.ok(), `Tailnet health must return 2xx at ${tailnetHealthUrl}.`).toBeTruthy();
	});
});
