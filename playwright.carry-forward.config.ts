import { defineConfig, devices } from '@playwright/test';

/**
 * Isolated TL-RR01 carry-forward UI QA.
 *
 * Serves the built client on a local port and mocks every /api/v1 request
 * inside the spec, so these tests need no live ATLAS/Tailnet runtime and can
 * never reach a real database or perform a live apply.
 */
const PORT = Number(process.env.TL_RR01_PORT ?? 5199);

export default defineConfig({
	testDir: './qa-artifacts/playwright/specs',
	testMatch: /teaching-load-carry-forward\.spec\.ts/,
	timeout: 120_000,
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [['list']],
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		ignoreHTTPSErrors: true,
		trace: 'off',
		screenshot: 'off',
		video: 'off',
		// The built app registers a service worker; block it so every mocked
		// /api/v1 request is deterministically intercepted by the spec.
		serviceWorkers: 'block',
		...devices['Desktop Chrome'],
	},
	webServer: {
		command: `npm --prefix atlas-client run build && npm --prefix atlas-client exec vite preview -- atlas-client --port ${PORT} --strictPort --host 127.0.0.1`,
		url: `http://127.0.0.1:${PORT}`,
		reuseExistingServer: false,
		timeout: 180_000,
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
