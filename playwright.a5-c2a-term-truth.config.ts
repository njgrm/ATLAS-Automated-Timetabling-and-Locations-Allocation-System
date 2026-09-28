import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { defineConfig, devices } from '@playwright/test';

/**
 * A5 / `a5-c2a-term-truth` — ISOLATED rendered-UI evidence for the two
 * blocked surfaces, `/faculty/concerns` (Blocker 1) and `/admin/year-setup`
 * (Blocker 2).
 *
 * WHAT THIS SERVES: a **loopback preview of the candidate's own production
 * build** at `http://127.0.0.1:<port>` (default 5204), with the built client
 * only. Every `/api/v1/**` request is mocked IN-PROCESS by the spec, so these
 * rows can never reach a live database, the shared 5001/5174 runtime,
 * EnrollPro, or any write path.
 *
 * THIS IS **NOT** ATLAS ACCEPTANCE (AGENTS.md §12). The ATLAS origin is
 * `https://njgrm.buru-degree.ts.net`; a loopback origin is a different origin
 * (no ATLAS session cookie is sent to it) and proves nothing about that origin.
 * These rows exist to supply the one thing a jsdom or source-text test cannot —
 * real layout, real paint, and the real route path end to end.
 *
 * Modelled on `playwright.a5-subjects.config.ts` (the established repo
 * pattern), with a distinct port so it can never collide with another lane's
 * isolated run.
 */
const PORT = Number(process.env.A5_C2A_PORT ?? 5204);

/**
 * Optional browser-binary override.
 *
 * The Playwright PACKAGE version and the installed browser build are resolved
 * independently on this machine, so a runner whose `@playwright/test` expects a
 * different Chromium revision than the one present in the shared browser cache
 * would otherwise fail to launch before running a single row.
 * `A5_C2A_CHROMIUM_EXECUTABLE` wins when it is set; otherwise an already-installed
 * `chromium-*` build in the shared cache is used, so the committed gate is
 * runnable as-is rather than only with a bespoke environment. This is a LOCAL
 * environment accommodation, not a behaviour of these rows: the assertions are
 * about the candidate's own rendered text and computed paint, which the
 * Chromium build does not change.
 */
function resolveChromium(): string | undefined {
	if (process.env.A5_C2A_CHROMIUM_EXECUTABLE) return process.env.A5_C2A_CHROMIUM_EXECUTABLE;
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
	testMatch: /a5-c2a-term-truth\.spec\.ts/,
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
		// `npm --prefix atlas-client run build`. The value below is the
		// EnrollPro OWNED dev origin the repo's own build error message names; it
		// is not contacted here, because every `/api/v1/**` request is mocked
		// in-process and only the built static assets are served. It is set in
		// `env` so the committed gate runs literally as
		// `npm --prefix atlas-client run test:visual:a5-c2a-term-truth` with no
		// pre-exported environment.
		command: `npm --prefix atlas-client run build && npm --prefix atlas-client exec vite preview -- atlas-client --port ${PORT} --strictPort --host 127.0.0.1`,
		url: `http://127.0.0.1:${PORT}`,
		reuseExistingServer: false,
		timeout: 240_000,
		env: { VITE_ENROLLPRO_URL: process.env.VITE_ENROLLPRO_URL || 'https://dev-jegs.buru-degree.ts.net' },
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
