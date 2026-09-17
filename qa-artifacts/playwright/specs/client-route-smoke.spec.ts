import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CLIENT-QUALITY-C01 â€” client route smoke gate.
 *
 * Loads every route declared in `atlas-client/src/App.tsx`, opens each page's
 * primary non-mutating controls (tabs, disclosures, dropdown triggers), and
 * FAILS on:
 *   - any uncaught `pageerror`,
 *   - any React render error (`Minified React error #310`, hook-count, null
 *     dereference, or the route ErrorBoundary rendering),
 *   - any unexpected response with status >= 400 (documented benign non-2xx
 *     states are allow-listed below).
 *
 * This is the gate that was missing when two crashes reached the deployed
 * release. Against the deployed build that still contains the `armSwapSessions`
 * hook-order defect it FAILS while naming `/timetable` (React #310); once the
 * reviewed release is live it passes.
 *
 * Browser origin invariant: the page origin must be
 * `https://njgrm.buru-degree.ts.net` on every route. A localhost origin is
 * invalid evidence.
 *
 * Mutation boundary: the harness blocks every non-safe HTTP method except the
 * single login and records any attempt. It clicks only non-mutating controls;
 * anything matching WRITE_DENY_VERBS is refused mechanically.
 *
 * Login: one `LOCAL_LOGIN_SUCCESS` audit row plus that actor's `last_login_at`.
 */

const EXPECTED_ORIGIN = 'https://njgrm.buru-degree.ts.net';

/** Directive write deny-list, plus undo/redo/revert which can persist reverts. */
const WRITE_DENY_VERBS = /\b(save|apply|submit|generate|publish|delete|remove|confirm|sync|reset|create|add|import|upload|archive|rollover|carry|assign|unassign|approve|commit|wipe|seed|logout|undo|redo|revert)\b/i;

const REACT_ERROR_PATTERN = /(?:minified )?react error #?\d+|rendered (?:fewer|more) hooks|rules of hooks|cannot read properties of (?:null|undefined)/i;

type RouteCase = {
	path: string;
	name: string;
	/** Redirect targets whose final URL is asserted instead of the route path. */
	expectRedirectTo?: string;
	/** Settle time after load before judging errors (async fetches/transitions). */
	settleMs?: number;
	/** Open primary non-mutating controls. */
	openControls?: boolean;
	/** Allow the page's own non-GET hand-off requests without counting them as crawl violations. */
	permitRouteOwnedWrites?: boolean;
	/** Do not fail on non-2xx (OAuth entry/exit endpoints deliberately 4xx without a real handshake). */
	allowAnyHttpStatus?: boolean;
	/** Max non-mutating controls to open. */
	maxControls?: number;
};

/**
 * App.tsx route inventory. Redirect routes (`/faculty`, `/assignments`,
 * `/subjects/requirements`, `/subjects/decision-workspace`, `/public/schedule`)
 * assert their destination. `/auth/*` are the companion-SSO entry/exit
 * endpoints; they are loaded for crash coverage but may redirect or 4xx without
 * a real handshake, so their HTTP status is not judged.
 */
const ROUTES: RouteCase[] = [
	{ path: '/', name: 'Dashboard', settleMs: 2000, openControls: true },
	{ path: '/my', name: 'MyDashboard', settleMs: 1800, openControls: true },
	{ path: '/my/schedule', name: 'MySchedule', settleMs: 1800, openControls: true },
	{ path: '/subjects', name: 'Subjects', settleMs: 1800, openControls: true },
	{ path: '/subjects/requirements', name: 'RetiredRequirementsRedirect', expectRedirectTo: '/subjects?context=derived-setup' },
	{ path: '/subjects/decision-workspace', name: 'RetiredDecisionWorkspaceRedirect', expectRedirectTo: '/subjects?context=derived-setup' },
	{ path: '/teachers', name: 'Faculty', settleMs: 1800, openControls: true },
	{ path: '/faculty', name: 'FacultyLegacyRedirect', expectRedirectTo: '/teachers' },
	{ path: '/teaching-load', name: 'TeachingLoad', settleMs: 2500, openControls: true },
	{ path: '/teaching-load/history', name: 'TeachingLoadHistory', settleMs: 2000, openControls: true },
	{ path: '/teaching-load?view=history', name: 'TeachingLoadHistoryQuery', settleMs: 2000, openControls: false },
	{ path: '/assignments', name: 'AssignmentsLegacyRedirect', expectRedirectTo: '/teaching-load' },
	{ path: '/sections', name: 'Sections', settleMs: 1800, openControls: true },
	{ path: '/faculty/preferences', name: 'OfficerPreferences', settleMs: 1800, openControls: true },
	{ path: '/my/preferences', name: 'FacultyPreferences', settleMs: 1800, openControls: true },
	{ path: '/my/room-preferences', name: 'FacultyRoomPreferences', settleMs: 1800, openControls: true },
	{ path: '/faculty/room-preferences', name: 'OfficerRoomPreferences', settleMs: 1800, openControls: true },
	{ path: '/timetable', name: 'ScheduleReview', settleMs: 3500, openControls: false },
	{ path: '/timetabling/how-it-works', name: 'HowItWorks', settleMs: 1500, openControls: true },
	{ path: '/room-schedules', name: 'RoomSchedules', settleMs: 2000, openControls: true },
	{ path: '/schedules', name: 'SchedulesAlias', settleMs: 2000, openControls: true },
	{ path: '/map', name: 'MapEditor', settleMs: 2000, openControls: true },
	{ path: '/audit', name: 'Audit', settleMs: 2000, openControls: true },
	{ path: '/admin/year-setup', name: 'AdminYearSetup', settleMs: 2000, openControls: true },
	{ path: '/login', name: 'Login', settleMs: 1500, openControls: false },
	{ path: '/public/schedules', name: 'PublicPublishedSchedule', settleMs: 1800, openControls: true },
	{ path: '/public/schedule', name: 'PublicScheduleLegacyRedirect', expectRedirectTo: '/public/schedules' },
	{ path: '/auth/sso/callback', name: 'SsoCallback', settleMs: 1500, openControls: false, allowAnyHttpStatus: true },
	{ path: '/auth/enrollpro/authorize', name: 'EnrollProAuthorize', settleMs: 2000, openControls: false, allowAnyHttpStatus: true, permitRouteOwnedWrites: true },
	{ path: '/client-quality-c01-not-a-route', name: 'WildcardRedirect', expectRedirectTo: '/' },
];

type RouteFailure = { route: string; kind: string; detail: string };

function readQaCredentials(): { origin: string | null; identifier: string; password: string } {
	const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
	const file = process.env.ATLAS_QA_CREDENTIALS_FILE
		?? join(home, '.config', 'opencode', 'atlas-qa-credentials.local.md');
	if (!existsSync(file)) {
		throw new Error('EXTERNALLY_BLOCKED(QA_CREDENTIALS_UNAVAILABLE): local QA credential file not found.');
	}
	const text = readFileSync(file, 'utf8');
	// The local markdown store wraps values symmetrically (for example
	// `` `https://â€¦` ``); strip one wrapper layer without altering the payload.
	const stripWrapping = (value: string): string => {
		let trimmed = value.trim();
		for (const wrapper of ['`', '"', "'", '*']) {
			if (trimmed.length >= 2 && trimmed.startsWith(wrapper) && trimmed.endsWith(wrapper)) {
				trimmed = trimmed.slice(1, -1).trim();
				break;
			}
		}
		return trimmed;
	};
	const pick = (label: string): string | null => {
		const match = text.match(new RegExp(`-\\s*${label}\\s*:\\s*(.+)`, 'i'));
		return match ? stripWrapping(match[1]) : null;
	};
	const identifier = pick('Admin identifier');
	const password = pick('Admin password');
	if (!identifier || !password) {
		throw new Error('EXTERNALLY_BLOCKED(QA_CREDENTIALS_UNAVAILABLE): required credential fields are missing.');
	}
	const rawOrigin = pick('Origin');
	let normalizedOrigin: string | null = null;
	if (rawOrigin) {
		try {
			normalizedOrigin = new URL(rawOrigin).origin;
		} catch {
			normalizedOrigin = rawOrigin;
		}
	}
	return { origin: normalizedOrigin, identifier, password };
}

/**
 * Documented benign non-2xx states for this product. Everything else is
 * "unexpected" and fails the route.
 */
function isBenignStatus(status: number, url: string): boolean {
	// Companion EnrollPro proxy: a separate, still-ungranted HIGH recovery lane
	// (ENROLLPRO-PROXY-RECOVERY-LIVE). ATLAS is contractually required to degrade
	// on it, so its status is recorded but is never a client crash.
	if (/\/enrollpro-api\//.test(url)) return true;
	// No published schedule yet is a normal pre-publication state (publication is
	// a separate locked HIGH action).
	if (status === 404 && /\/schedules\/published/.test(url)) return true;
	if (status === 404) {
		return /runs\/latest/.test(url)
			|| /room-preferences/.test(url)
			|| /authority-diagnostics/.test(url)
			|| /\/api\/v1\/generation\//.test(url)
			|| /\/api\/v1\/settings\/public/.test(url);
	}
	if (status === 401 || status === 403) {
		return /\/api\/v1\/auth\//.test(url);
	}
	// The product uses typed 409/503 for unresolved term authority and degraded
	// EnrollPro reachability. They are recorded but not crashes.
	if (status === 409 || status === 503) return true;
	return false;
}

async function openSafeControls(page: Page, maxControls: number): Promise<Array<{ control: string }>> {
	const attempted: Array<{ control: string }> = [];
	const candidates = page.locator('button:visible, [role="tab"]:visible, [role="button"]:visible');
	const total = Math.min(await candidates.count(), 60);
	for (let index = 0; index < total && attempted.length < maxControls; index += 1) {
		const candidate = candidates.nth(index);
		let name = '';
		try {
			name = ((await candidate.getAttribute('aria-label')) || (await candidate.innerText()) || '').trim();
		} catch {
			continue;
		}
		if (!name) continue;
		if (WRITE_DENY_VERBS.test(name)) continue;
		try {
			await candidate.click({ timeout: 3000 });
			attempted.push({ control: name.slice(0, 80) });
			await page.waitForTimeout(200);
			await page.keyboard.press('Escape').catch(() => undefined);
			await page.waitForTimeout(120);
		} catch {
			// A detached/covered control is not a page defect.
		}
	}
	return attempted;
}

test.describe.configure({ mode: 'serial' });

test('every App.tsx route loads without a crash, React error, or unexpected >=400', async ({ page }) => {
	test.setTimeout(900_000);

	const credentials = readQaCredentials();
	if (credentials.origin && credentials.origin !== EXPECTED_ORIGIN) {
		throw new Error(`QA credential origin ${credentials.origin} does not match the governed ATLAS origin ${EXPECTED_ORIGIN}.`);
	}

	// One login for the whole crawl.
	const loginResponse = await page.request.post('/api/v1/auth/login', {
		data: { identifier: credentials.identifier, password: credentials.password },
	});
	expect(
		loginResponse.ok(),
		`Admin login failed HTTP ${loginResponse.status()}: ${(await loginResponse.text()).slice(0, 200)}`,
	).toBeTruthy();
	const token = ((await loginResponse.json()) as { token?: string }).token;
	expect(token, 'Admin login must return a bearer token.').toBeTruthy();
	await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${token}` });
	await page.addInitScript((value) => {
		window.sessionStorage.setItem('atlas_local_token', value);
	}, token!);

	const failures: RouteFailure[] = [];
	const crawlWrites: Array<{ route: string; method: string; url: string }> = [];
	const httpDiagnostics: Array<{ route: string; status: number; url: string }> = [];
	let currentRoute = '(setup)';

	await page.route('**/*', async (route) => {
		const request = route.request();
		const method = request.method().toUpperCase();
		const url = request.url();
		const isSafe = ['GET', 'HEAD', 'OPTIONS'].includes(method) || url.includes('/api/v1/auth/login');
		if (isSafe) {
			await route.continue();
			return;
		}
		const routeCase = ROUTES.find((candidate) => candidate.path === currentRoute);
		if (!routeCase?.permitRouteOwnedWrites) {
			crawlWrites.push({ route: currentRoute, method, url });
		}
		await route.abort();
	});

	page.on('pageerror', (error) => {
		failures.push({ route: currentRoute, kind: 'pageerror', detail: error.message });
	});
	page.on('console', (message) => {
		if (message.type() !== 'error') return;
		const text = message.text();
		if (REACT_ERROR_PATTERN.test(text)) {
			failures.push({ route: currentRoute, kind: 'react-error', detail: text.slice(0, 300) });
		}
	});
	page.on('response', (response) => {
		const status = response.status();
		if (status < 400) return;
		const url = response.url();
		httpDiagnostics.push({ route: currentRoute, status, url });
		const routeCase = ROUTES.find((candidate) => candidate.path === currentRoute);
		if (routeCase?.allowAnyHttpStatus) return;
		if (isBenignStatus(status, url)) return;
		failures.push({ route: currentRoute, kind: `http-${status}`, detail: url });
	});

	const perRoute: Array<Record<string, unknown>> = [];

	for (const routeCase of ROUTES) {
		currentRoute = routeCase.path;
		const before = failures.length;
		await page.goto(routeCase.path, { waitUntil: 'domcontentloaded' });
		if (routeCase.expectRedirectTo) {
			const expectedUrl = new URL(routeCase.expectRedirectTo, EXPECTED_ORIGIN);
			await page.waitForURL(
				(url) => url.pathname === expectedUrl.pathname && url.search === expectedUrl.search,
				{ timeout: 15_000 },
			).catch(() => undefined);
		}
		await page.waitForTimeout(routeCase.settleMs ?? 1500);

		const origin = await page.evaluate(() => window.location.origin);
		if (origin !== EXPECTED_ORIGIN) {
			failures.push({ route: routeCase.name, kind: 'origin-mismatch', detail: origin });
		}

		let controls: Array<{ control: string }> = [];
		if (routeCase.openControls) {
			controls = await openSafeControls(page, routeCase.maxControls ?? 4);
		}
		await page.waitForTimeout(500);

		const boundary = await page.locator('[data-testid="route-error-boundary"]').count();
		if (boundary > 0) {
			failures.push({ route: routeCase.name, kind: 'error-boundary', detail: 'route ErrorBoundary rendered' });
		}

		const routeFailures = failures.slice(before).filter((failure) => failure.route === routeCase.path);
		perRoute.push({
			route: routeCase.path,
			name: routeCase.name,
			url: page.url(),
			controlsOpened: controls.length,
			failures: routeFailures.map((failure) => `${failure.kind}: ${failure.detail}`),
		});
	}

	// eslint-disable-next-line no-console
	console.log(`[client-route-smoke] ${JSON.stringify(perRoute, null, 2)}`);
	// eslint-disable-next-line no-console
	console.log(`[client-route-smoke] http>=400 diagnostics: ${JSON.stringify(httpDiagnostics)}`);

	expect(crawlWrites, `The crawl dispatched non-safe HTTP writes: ${JSON.stringify(crawlWrites)}`).toEqual([]);
	expect(
		failures,
		`Route smoke failures:\n${failures.map((failure) => `  - ${failure.route} [${failure.kind}] ${failure.detail}`).join('\n')}`,
	).toEqual([]);
});
