import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { defineConfig, devices } from '@playwright/test';

/**
 * A5-C2B / SLICE B — ISOLATED rendered-UI evidence for
 * `docs/reviews/codex-demo-walk-20260928` items 4, 5, 6 and 7.
 *
 * WHAT THIS SERVES: a **loopback preview of the candidate's own production
 * build** at `http://127.0.0.1:5205` (slice A used 5204), with the built client
 * only. Every `/api/v1/**` request is mocked IN-PROCESS by the spec, so these
 * rows can never reach a live database, the shared 5001/5174 runtime, or any
 * write path.
 *
 * THIS IS **NOT** ATLAS ACCEPTANCE (AGENTS.md §12). The ATLAS origin is
 * `https://njgrm.buru-degree.ts.net`; a loopback origin is a different origin
 * (no ATLAS session cookie is sent to it) and proves nothing about that origin.
 *
 * Port 5205 is asserted distinct from every port any other lane or the shared
 * runtime owns (5001/5174 live, 5101/5274 staging, 5203 A5-subjects, 5204
 * A5-C2A) precisely so two lanes cannot collide on a `webServer` that Playwright
 * starts as a child process.
 *
 * Modelled on `playwright.a5-subjects.config.ts` (the established repo pattern).
 */
const PORT = Number(process.env.A5_C2B_PORT ?? 5205);

/**
 * Optional browser-binary override, with the same rationale as the A5-subjects
 * config: the `@playwright/test` package version and the installed browser build
 * resolve independently on this machine, so a runner whose expected Chromium
 * revision differs from the one in the shared cache would otherwise fail to
 * launch before running a single row. A LOCAL environment accommodation, not a
 * behaviour of these rows: the assertions are about the candidate's own computed
 * paint and geometry.
 */
function resolveChromium(): string | undefined {
	if (process.env.A5_C2B_CHROMIUM_EXECUTABLE) return process.env.A5_C2B_CHROMIUM_EXECUTABLE;
	const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || `${homedir()}\\AppData\\Local\\ms-playwright`;
	if (!existsSync(cache)) return undefined;
	const builds = readdirSync(cache)
		.filter((entry) => entry.startsWith('chromium-'))
		.sort()
		.reverse();
	for (const build of builds) {
		for (const relative of ['chrome-win64\\chrome.exe', 'chrome-win\\chrome.exe', 'chrome-linux\\chrome']) {
			const candidate = `${cache}\\${build}\\${relative}`;
			if (existsSync(candidate)) return candidate;
		}
	}
	return undefined;
}

const executablePath = resolveChromium();

export default defineConfig({
	testDir: './qa-artifacts/playwright/specs',
	testMatch: /a5-c2b-surface-truth\.spec\.ts/,
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
		launchOptions: executablePath ? { executablePath } : undefined,
	},
	webServer: {
		// `atlas-client/vite.config.ts` fails a production build closed without
		// `VITE_ENROLLPRO_URL` (a non-secret origin URL), exactly as it does for
		// `npm --prefix atlas-client run build`. Set in `env` so the committed gate
		// runs literally with no pre-exported environment. It is never contacted
		// here: every `/api/v1/**` request is mocked in-process and only the built
		// static assets are served.
		command: `npm --prefix atlas-client run build && npm --prefix atlas-client exec vite preview -- atlas-client --port ${PORT} --strictPort --host 127.0.0.1`,
		url: `http://127.0.0.1:${PORT}`,
		reuseExistingServer: false,
		timeout: 240_000,
		env: { VITE_ENROLLPRO_URL: process.env.VITE_ENROLLPRO_URL || 'https://dev-jegs.buru-degree.ts.net' },
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
