import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './qa-artifacts/playwright/specs',
	timeout: 120_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [['list']],
	use: {
		baseURL: 'http://127.0.0.1:4174',
		ignoreHTTPSErrors: true,
		trace: 'off',
		screenshot: 'off',
		video: 'off',
		...devices['Desktop Chrome'],
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1 --port 4174',
		cwd: 'atlas-client',
		url: 'http://127.0.0.1:4174',
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
