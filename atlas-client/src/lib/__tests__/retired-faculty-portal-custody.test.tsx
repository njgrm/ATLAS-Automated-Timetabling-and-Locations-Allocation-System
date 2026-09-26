/**
 * A2 TIMETABLE-CUSTODY — the retired `/my` faculty portal.
 *
 * Operator instruction 2026-09-26: `/my` must not be reachable and its
 * implementation must be commented out of code "until further notice". This is
 * the real-path proof of the load-bearing half of that instruction — the route
 * is still registered (five faculty landing references depend on it) but it must
 * NOT mount the dashboard and must NOT dispatch any faculty-portal request.
 *
 * What is proven here, against the REAL route table and the REAL production API
 * client, not wiring:
 *  - `/my` is registered in `appRoutes` and its element is the tombstone.
 *  - Mounting that exact route element at the deep link `/my` issues zero
 *    requests to `/faculty-portal/*` and renders no dashboard marker.
 *  - The request recorder is load-bearing: the same recorder, on the same
 *    axios client the parked dashboard uses, DOES observe a real
 *    `/faculty-portal/<school>/<year>/dashboard` request.
 *  - The tombstone satisfies the shared-chrome contract, and its rendered `h1`
 *    is exactly `resolveRouteChrome('/my').title`.
 *  - The parked implementation is preserved on disk, so the retirement is
 *    reversible rather than a deletion.
 *
 * Run: `npm run test:retired-faculty-portal`
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { act, createElement, useEffect, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, type RouteObject } from 'react-router-dom';
import { JSDOM } from 'jsdom';

import { resolveRouteChrome } from '@/components/app-shell/navigation';

const CLIENT_ROOT = resolve(import.meta.dirname, '../../..');
const APP_SOURCE = resolve(CLIENT_ROOT, 'src/App.tsx');
const PARKED_DASHBOARD = resolve(CLIENT_ROOT, 'src/pages/MyDashboard.tsx');

function source(path: string): string {
	return readFileSync(path, 'utf8');
}

// The one URL shape the retired portal used — the fixture for the load-bearing
// recorder control below is this exact production endpoint string, not a guess.
const RETIRED_DASHBOARD_PATH = '/faculty-portal/7/9/dashboard';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/my',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	MutationObserver: dom.window.MutationObserver,
	Node: dom.window.Node,
	getComputedStyle: dom.window.getComputedStyle,
	requestAnimationFrame: dom.window.requestAnimationFrame?.bind(dom.window) ?? ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number),
	cancelAnimationFrame: dom.window.cancelAnimationFrame?.bind(dom.window) ?? ((handle: number) => clearTimeout(handle)),
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.defineProperty(globalThis, 'XMLHttpRequest', { value: dom.window.XMLHttpRequest, configurable: true });

// ── request recorder ───────────────────────────────────────────────────────────
// axios in jsdom uses the XMLHttpRequest adapter, so the recorder observes both
// transports. The control below proves this instrument is live.
const observedUrls: string[] = [];
const originalFetch = globalThis.fetch;
const originalXhrOpen = dom.window.XMLHttpRequest.prototype.open;

function record(url: unknown): void {
	observedUrls.push(String(url));
}

globalThis.fetch = ((input: unknown, ...rest: unknown[]) => {
	record(typeof input === 'string' ? input : (input as { url?: string })?.url);
	return (originalFetch as (...args: unknown[]) => Promise<unknown>).call(globalThis, input, ...rest);
}) as typeof fetch;

dom.window.XMLHttpRequest.prototype.open = function patchedOpen(
	this: XMLHttpRequest,
	method: string,
	url: string | URL,
	...rest: unknown[]
) {
	record(url);
	return (originalXhrOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
} as typeof dom.window.XMLHttpRequest.prototype.open;

function facultyPortalRequests(): string[] {
	return observedUrls.filter((url) => url.includes('/faculty-portal/'));
}

// ── DOM mount helper ──────────────────────────────────────────────────────────
let root: Root | null = null;

async function mountAt(path: string, element: ReactNode): Promise<HTMLElement> {
	const container = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(container);
	root = createRoot(container);
	await act(async () => {
		root?.render(createElement(MemoryRouter, { initialEntries: [path] }, element));
	});
	// Let every mount effect and its microtask queue settle before observing.
	await act(async () => { await new Promise((resolveTick) => setTimeout(resolveTick, 0)); });
	return container;
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	dom.window.close();
});

// The real modules, imported AFTER the DOM globals exist. The dynamic import
// is load-bearing: a static `import atlasApi` would evaluate axios before
// `XMLHttpRequest` exists, so axios would pick its Node http adapter and the
// recorder below would never observe the parked dashboard's request.
const { default: atlasApi } = await import('@/lib/api');
const { appRoutes, RetiredFacultyPortalNotice } = await import('@/App');
const { default: ParkedMyDashboard } = await import('@/pages/MyDashboard');

function findRoute(routes: RouteObject[], path: string): RouteObject | null {
	for (const route of routes) {
		if (route.path === path) return route;
		const nested = route.children ? findRoute(route.children, path) : null;
		if (nested) return nested;
	}
	return null;
}

test('the real route table registers /my as the retirement tombstone, not the dashboard', () => {
	const route = findRoute(appRoutes, 'my');
	assert.ok(route, '/my must stay registered: five faculty landing references depend on it');
	assert.equal(
		(route.element as ReactElement).type,
		RetiredFacultyPortalNotice,
		'the /my element must be the retirement tombstone',
	);
	assert.notEqual((route.element as ReactElement).type, ParkedMyDashboard, '/my must not mount the dashboard');

	// Nothing anywhere in the route table may still reference the dashboard.
	const serialised = JSON.stringify(appRoutes, (_key, value) =>
		typeof value === 'function' ? (value as { name?: string }).name ?? 'fn' : value);
	assert.doesNotMatch(serialised, /MyDashboard/, 'no route element may resolve to MyDashboard');

	// App.tsx may still NAME the parked file in its doc comment (reversibility),
	// but it must not import it or mount it. Wiring, not prose, is the guard.
	const app = source(APP_SOURCE);
	assert.doesNotMatch(app, /import\([^)]*MyDashboard/, 'App.tsx must not import MyDashboard');
	assert.doesNotMatch(app, /<MyDashboard\s*\/>/, 'App.tsx must not mount MyDashboard');
});

test('visiting /my mounts the tombstone and issues no faculty-portal request', async () => {
	const route = findRoute(appRoutes, 'my');
	assert.ok(route);
	observedUrls.length = 0;

	const container = await mountAt('/my', route.element as ReactElement);
	const html = container.innerHTML;

	assert.ok(
		html.includes('data-testid="retired-faculty-portal-notice"'),
		'the tombstone notice must render',
	);
	assert.match(html, /This faculty portal is retired/);
	assert.deepEqual(
		facultyPortalRequests(),
		[],
		`/my must dispatch no faculty-portal request, saw: ${facultyPortalRequests().join(', ')}`,
	);
	// No dashboard surface mounted: none of the parked implementation's own
	// copy, controls or cache markers may appear.
	for (const marker of [
		'Dashboard unavailable',
		'Check for updates',
		'Retry Loading',
		'Showing latest saved dashboard',
		'Schedule preparing',
	]) {
		assert.ok(!html.includes(marker), `retired /my must not render the dashboard marker "${marker}"`);
	}
});

test('the recorder is load-bearing: the real client DOES observe the retired dashboard request', async () => {
	observedUrls.length = 0;
	// Same axios client, same request shape as `loadMyDashboardScoped` in the
	// parked implementation. This control fails if the recorder above went blind.
	function DashboardRequestProbe() {
		useEffect(() => {
			atlasApi.get(RETIRED_DASHBOARD_PATH).catch(() => undefined);
		}, []);
		return null;
	}

	await mountAt('/my', createElement(DashboardRequestProbe));

	assert.ok(
		facultyPortalRequests().some((url) => url.includes('faculty-portal/7/9/dashboard')),
		`the recorder must catch ${RETIRED_DASHBOARD_PATH}; saw: ${observedUrls.join(', ')}`,
	);
});

test('the tombstone satisfies the shared-chrome contract and agrees with resolveRouteChrome', async () => {
	const chrome = resolveRouteChrome('/my');
	assert.notEqual(chrome.title, 'ATLAS', '/my needs a specific page title');
	assert.equal(chrome.breadcrumbs.at(-1), chrome.title, '/my leaf must equal its title');
	assert.equal(new Set(chrome.breadcrumbs).size, chrome.breadcrumbs.length, '/my repeats a breadcrumb label');
	assert.match(chrome.title, /retired/i, 'the /my title must state the retirement truthfully');

	const route = findRoute(appRoutes, 'my');
	assert.ok(route);
	const container = await mountAt('/my', route.element as ReactElement);
	const heading = container.querySelector('h1');
	assert.ok(heading, 'the tombstone must render the canonical single page heading');
	assert.equal(heading.textContent, chrome.title, 'the tombstone heading must be the resolved chrome title');
});

test('the parked dashboard implementation is preserved, so the retirement is reversible', () => {
	assert.ok(existsSync(PARKED_DASHBOARD), 'pages/MyDashboard.tsx must stay on disk until further notice');
	const parked = source(PARKED_DASHBOARD);
	assert.match(parked, /export default function MyDashboard\(\)/, 'the parked default export stays intact');
	assert.match(parked, /export async function loadMyDashboardScoped/, 'the parked scoped loader stays exported');
	assert.match(
		parked,
		/\/faculty-portal\/\$\{schoolId\}\/\$\{schoolYearId\}\/dashboard/,
		'the parked implementation keeps its own dashboard read — it is parked, not gutted',
	);
});
