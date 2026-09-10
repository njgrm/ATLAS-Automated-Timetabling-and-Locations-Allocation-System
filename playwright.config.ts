import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://njgrm.buru-degree.ts.net';

export default defineConfig({
	testDir: './qa-artifacts/playwright/specs',
	timeout: 120_000,
	expect: { timeout: 25_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [['list']],
	use: {
		baseURL,
		ignoreHTTPSErrors: true,
		trace: 'off',
		screenshot: 'off',
		video: 'off',
		...devices['Desktop Chrome'],
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
