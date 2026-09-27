/**
 * A3-C6 — no dead control, no duplicate control, no silent redirect.
 *
 * This is the executor's evidence for four findings, two of which are DELETIONS.
 * A deletion is the one change no reviewer can re-derive from a rendered screen, so
 * every deletion here is proven by a recorded scan, not an assertion.
 *
 * Proven against the REAL production route table (`appRoutes` from `@/App`) and the
 * REAL production components:
 *
 *  - D1  The AppShell catch-all must render an honest "page not found" surface and
 *       must NOT silently redirect. The negative half matters more: an unknown
 *       `/timetable/*` child must STILL resolve to `/timetable`, so a future edit
 *       that points the timetable child at this panel turns this file red.
 *  - D2  `AdminYearSetup`'s header must carry exactly ONE back-to-dashboard
 *       affordance, and the survivor must be labelled.
 *  - D3  The `ComingSoon` dead module must be gone: no identifier, no path.
 *  - D4  The `WeeklyScheduleGrid` dead module must be gone: no identifier, no path.
 *
 * The reference scan excludes THIS file, which necessarily names the deleted
 * identifiers as the strings it searches for. It excludes nothing else, and the
 * scanner is proved discriminating by the self-test below, which feeds it a
 * planted reference and requires it to report.
 *
 * Run: `npm run test:a3-c6-route-hygiene`
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { afterEach, mock, test } from 'node:test';
import { createElement, Fragment, type ReactElement, type ReactNode } from 'react';
import { JSDOM } from 'jsdom';

const CLIENT_ROOT = resolve(import.meta.dirname, '../../..');
const SRC_ROOT = resolve(CLIENT_ROOT, 'src');
/** This file, relative to the client root, in the same shape the scan reports. */
const SELF = relative(CLIENT_ROOT, import.meta.filename).replace(/\\/g, '/');

const COMING_SOON_MODULE = 'src/pages/ComingSoon.tsx';
const WEEKLY_GRID_MODULE = 'src/components/faculty-shared/WeeklyScheduleGrid.tsx';

/** The needles of D3 + D4. A bare identifier catches a renamed import; a path
 *  fragment catches a re-added file or a direct specifier that skips the symbol. */
const DEAD_MODULE_NEEDLES = ['ComingSoon', 'WeeklyScheduleGrid'];

// ── DOM ────────────────────────────────────────────────────────────────────────

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	// `lib/auth` reads the BARE globals `sessionStorage` / `localStorage`, so
	// installing `window` alone leaves the production auth gate failing closed.
	sessionStorage: dom.window.sessionStorage,
	localStorage: dom.window.localStorage,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	MutationObserver: dom.window.MutationObserver,
	Node: dom.window.Node,
	getComputedStyle: dom.window.getComputedStyle,
	requestAnimationFrame:
		dom.window.requestAnimationFrame?.bind(dom.window) ??
		((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number),
	cancelAnimationFrame: dom.window.cancelAnimationFrame?.bind(dom.window) ?? ((h: number) => clearTimeout(h)),
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

// ── AdminYearSetup collaborators (D2) ─────────────────────────────────────────
// The page renders its header strip only after the REAL auth gate passes
// (`hasAnyAuthToken()` -> `verifySessionToken()` -> admin role). Mocking the auth
// or settings module would replace that gate wholesale, so instead this stubs the
// single TRANSPORT call the real gate makes (`GET /auth/me`) and lets the real
// `@/lib/auth` + `@/lib/settings` decide. The three runtime panels below the
// header are separate network surfaces, stubbed so the control measures the
// header strip rather than the panels. AdminYearSetup itself is unmocked.

const ADMIN_SESSION_USER = {
	id: 46,
	name: 'QA Operator',
	email: 'qa@example.invalid',
	role: 'admin',
	schoolId: 1,
};

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async (url: string) => {
			if (url.includes('/auth/me')) return { data: { user: ADMIN_SESSION_USER } };
			return { data: {} };
		},
		post: async () => ({ data: {} }),
		patch: async () => ({ data: {} }),
		put: async () => ({ data: {} }),
		delete: async () => ({ data: {} }),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});
for (const panel of [
	['@/components/runtime/RolloverGuidanceCard', 'RolloverGuidanceCard'],
	['@/components/runtime/CarryForwardReviewPanel', 'CarryForwardReviewPanel'],
	['@/components/runtime/RolloverResetPanel', 'RolloverResetPanel'],
] as const) {
	mock.module(import.meta.resolve(panel[0]), {
		namedExports: {
			[panel[1]]: () => createElement('div', { 'data-stubbed-panel': 'true' }),
		},
	});
}

const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { MemoryRouter, Navigate, matchRoutes, useLocation } = await import('react-router-dom');

// Real modules, imported AFTER the DOM globals and mocks exist.
const { setLocalToken } = await import('@/lib/auth');
// A real local session token, so the production gate runs for real.
setLocalToken('a3-c6-route-hygiene-session', false);

const { appRoutes, RouteNotFound } = await import('@/App');
const { default: AdminYearSetup } = await import('@/pages/AdminYearSetup');

// ── mount helpers ─────────────────────────────────────────────────────────────

type Mount = { host: HTMLElement; root: ReturnType<typeof createRoot> };
const mounts: Mount[] = [];
let observedPathname = '';

function LocationProbe() {
	observedPathname = useLocation().pathname;
	return null;
}

async function renderAt(path: string, node: ReactNode): Promise<HTMLElement> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	mounts.push({ host, root });
	observedPathname = path;
	await act(async () => {
		root.render(
			createElement(
				MemoryRouter,
				{ initialEntries: [path] },
				createElement(Fragment, null, node, createElement(LocationProbe)),
			),
		);
	});
	await act(async () => {
		await new Promise((tick) => setTimeout(tick, 0));
	});
	return host;
}

afterEach(async () => {
	for (const mount of mounts.splice(0)) {
		await act(async () => {
			mount.root.unmount();
		});
		mount.host.remove();
	}
});

// ── route-table navigation ────────────────────────────────────────────────────

type RouteObject = { path?: string; index?: boolean; element?: ReactNode; children?: RouteObject[] };

function childrenOf(parentPath: string): RouteObject[] {
	const parent = (appRoutes as RouteObject[]).find((route) => route.path === parentPath);
	assert.ok(parent, `route ${parentPath} must exist`);
	return parent.children ?? [];
}

function findChild(parentPath: string, path: string): RouteObject {
	const route = childrenOf(parentPath).find((child) => child.path === path);
	assert.ok(route, `${parentPath} must keep a "${path}" child`);
	return route;
}

/** The leaf route object React Router actually resolves a URL to. */
function resolvedLeaf(pathname: string): RouteObject {
	const matches = matchRoutes(appRoutes as never, pathname);
	assert.ok(matches, `no route matched ${pathname}`);
	const leaf = matches[matches.length - 1].route as RouteObject;
	return leaf;
}

const APP_SHELL_STAR = findChild('/', '*');
const TIMETABLE = findChild('/', 'timetable');
const TIMETABLE_STAR = (TIMETABLE.children ?? []).find((child) => child.path === '*');
assert.ok(TIMETABLE_STAR, '/timetable must keep its own catch-all child');

/** Flattened, ordered route identity — pins that nothing was added, removed or reordered. */
function flattenPaths(routes: RouteObject[], parent = ''): string[] {
	const out: string[] = [];
	for (const route of routes) {
		const segment = route.index ? '(index)' : route.path ?? '(none)';
		// The root route's own segment is "/", so the join is collapsed.
		const joined = `${parent}/${segment}`.replace(/\/{2,}/g, '/');
		out.push(joined);
		if (route.children) out.push(...flattenPaths(route.children, joined));
	}
	return out;
}

const EXPECTED_ROUTE_SHAPE = [
	'/login',
	'/auth/sso/callback',
	'/auth/enrollpro/authorize',
	'/auth/smart/authorize',
	'/auth/aims/authorize',
	'/public/schedules',
	'/public/schedule',
	'/',
	'/(index)',
	'/my',
	'/subjects',
	'/subjects/requirements',
	'/subjects/decision-workspace',
	'/teachers',
	'/teaching-load/history',
	'/teaching-load',
	'/faculty',
	'/assignments',
	'/sections',
	'/faculty/preferences',
	'/faculty/concerns',
	'/timetable',
	'/timetable/(index)',
	'/timetable/policies',
	'/timetable/pre-generation',
	'/timetable/map',
	'/timetable/manual-edit',
	'/timetable/building',
	'/timetable/exports',
	'/timetable/runs',
	'/timetable/setup',
	'/timetable/*',
	'/timetabling/how-it-works',
	'/room-schedules',
	'/schedules',
	'/faculty/room-preferences',
	'/map',
	'/audit',
	'/admin/year-setup',
	'/*',
];

// ── reference scan (D3 + D4) ──────────────────────────────────────────────────

type Hit = { file: string; needle: string };

/** Pure scanner: takes a file map, returns every (file, needle) occurrence. */
function scanForNeedles(files: Map<string, string>, needles: string[]): Hit[] {
	const hits: Hit[] = [];
	for (const [file, text] of files) {
		for (const needle of needles) {
			if (text.includes(needle)) hits.push({ file, needle });
		}
	}
	return hits;
}

/** The real tree: every .ts/.tsx under src, excluding this file only. */
function readSourceTree(): Map<string, string> {
	const files = new Map<string, string>();
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const absolute = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(absolute);
				continue;
			}
			if (!/\.tsx?$/.test(entry.name)) continue;
			const reported = relative(CLIENT_ROOT, absolute).replace(/\\/g, '/');
			if (reported === SELF) continue;
			files.set(reported, readFileSync(absolute, 'utf8'));
		}
	};
	walk(SRC_ROOT);
	return files;
}

// ── D1: the catch-all is honest ───────────────────────────────────────────────

const MISSING_PATH = '/definitely-not-a-real-page';

test('D1: an unmatched path under / resolves to the not-found surface, not a redirect', () => {
	const leaf = resolvedLeaf(MISSING_PATH);
	assert.equal(
		leaf,
		APP_SHELL_STAR,
		'an unknown path under / must resolve to the AppShell catch-all child',
	);
	assert.equal(
		(leaf.element as ReactElement).type,
		RouteNotFound,
		'the AppShell catch-all element must be the not-found surface',
	);
	assert.notEqual(
		(leaf.element as ReactElement).type,
		Navigate,
		'the AppShell catch-all must no longer be a silent <Navigate> to the Dashboard',
	);
});

test('D1: the not-found surface states the address does not exist and does NOT redirect', async () => {
	const host = await renderAt(MISSING_PATH, APP_SHELL_STAR.element as ReactElement);
	const html = host.innerHTML;

	assert.match(html, /data-testid="route-not-found"/, 'the not-found surface must render');
	assert.match(html, /does not exist/i, 'the surface must state the address does not exist');
	assert.doesNotMatch(
		html,
		/coming soon/i,
		'a wrong URL must not be answered with a placeholder promise',
	);
	assert.equal(
		observedPathname,
		MISSING_PATH,
		`the not-found surface must NOT navigate away; landed on ${observedPathname}`,
	);
	assert.equal(
		host.querySelectorAll('[data-testid="route-not-found-dashboard-action"]').length,
		1,
		'exactly one Dashboard action is offered',
	);
});

test('D1: the Dashboard action is live, not a dead control — clicking it reaches /', async () => {
	const host = await renderAt(MISSING_PATH, APP_SHELL_STAR.element as ReactElement);
	const action = host.querySelector('[data-testid="route-not-found-dashboard-action"]');
	assert.ok(action, 'the Dashboard action must exist');

	await act(async () => {
		action.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
	});
	await act(async () => {
		await new Promise((tick) => setTimeout(tick, 0));
	});

	assert.equal(observedPathname, '/', `the Dashboard action must reach "/", landed on ${observedPathname}`);
});

// ── D1 negative half: the timetable child catch-all is untouched ──────────────

test('D1 NEGATIVE: an unknown /timetable child still resolves to the timetable catch-all, not the panel', () => {
	const leaf = resolvedLeaf('/timetable/xyz');
	assert.equal(
		leaf,
		TIMETABLE_STAR,
		'/timetable/xyz must resolve to the timetable catch-all child',
	);
	assert.notEqual(
		leaf,
		APP_SHELL_STAR,
		'the timetable catch-all must not have been replaced by the AppShell catch-all',
	);
	assert.notEqual(
		(leaf.element as ReactElement).type,
		RouteNotFound,
		'the timetable catch-all must not point at the not-found surface',
	);
});

test('D1 NEGATIVE: an unknown /timetable child still redirects to /timetable', async () => {
	const host = await renderAt('/timetable/xyz', TIMETABLE_STAR!.element as ReactElement);

	assert.equal(
		observedPathname,
		'/timetable',
		`an unknown timetable child must land on /timetable, landed on ${observedPathname}`,
	);
	assert.doesNotMatch(
		host.innerHTML,
		/data-testid="route-not-found"/,
		'an unknown timetable child must not show the not-found surface',
	);
});

test('D1: no route was added, removed, reordered or renumbered', () => {
	assert.deepEqual(flattenPaths(appRoutes as RouteObject[]), EXPECTED_ROUTE_SHAPE);
});

// ── D2: one back-to-dashboard control ─────────────────────────────────────────

type Affordance = { name: string; text: string };

function backAffordances(scope: Element): Affordance[] {
	return Array.from(scope.querySelectorAll('a, button'))
		.map((node) => {
			const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
			return { name: (node.getAttribute('aria-label') ?? text).trim(), text };
		})
		.filter((entry) => /back to dashboard/i.test(entry.name));
}

test('D2: the AdminYearSetup header carries exactly one back-to-dashboard affordance', async () => {
	const host = await renderAt('/admin/year-setup', createElement(AdminYearSetup));
	const header = host.querySelector('[data-testid="admin-year-setup-header"]');
	assert.ok(header, 'the Year Setup header strip must render for an admin session');

	const affordances = backAffordances(header);
	assert.equal(
		affordances.length,
		1,
		`expected one back-to-dashboard control, found ${affordances.length}: ${JSON.stringify(affordances)}`,
	);

	const [survivor] = affordances;
	assert.notEqual(
		survivor.text,
		'',
		'the surviving control must be labelled, not icon-only',
	);
	assert.equal(
		(survivor.name.match(/back to dashboard/gi) ?? []).length,
		1,
		`the accessible name must not repeat the phrase: "${survivor.name}"`,
	);
});

// ── D3 + D4: the dead modules are gone ────────────────────────────────────────

test('the reference scanner is discriminating, not a tautology', () => {
	const planted = new Map<string, string>([
		['src/pages/AlreadyGone.tsx', 'export default function AlreadyGone() { return null; }'],
		['src/components/faculty-shared/WeeklyScheduleGrid.tsx', 'export default function WeeklyScheduleGrid() {}'],
	]);
	assert.deepEqual(
		scanForNeedles(planted, DEAD_MODULE_NEEDLES),
		[{ file: 'src/components/faculty-shared/WeeklyScheduleGrid.tsx', needle: 'WeeklyScheduleGrid' }],
		'the scanner must flag a planted reference',
	);

	const clean = new Map<string, string>([['src/pages/Dashboard.tsx', 'export default function Dashboard() {}']]);
	assert.deepEqual(
		scanForNeedles(clean, DEAD_MODULE_NEEDLES),
		[],
		'the scanner must report nothing for a clean tree',
	);
});

test('D3: the dead ComingSoon module is deleted and referenced nowhere under src', () => {
	assert.equal(
		existsSync(resolve(CLIENT_ROOT, COMING_SOON_MODULE)),
		false,
		'pages/ComingSoon.tsx must be deleted',
	);
	const hits = scanForNeedles(readSourceTree(), DEAD_MODULE_NEEDLES);
	assert.deepEqual(
		hits,
		[],
		`a deleted module is referenced again:\n  ${hits.map((h) => `${h.file} -> ${h.needle}`).join('\n  ')}`,
	);
});

test('D4: the dead WeeklyScheduleGrid module is deleted and referenced nowhere under src', () => {
	assert.equal(
		existsSync(resolve(CLIENT_ROOT, WEEKLY_GRID_MODULE)),
		false,
		'components/faculty-shared/WeeklyScheduleGrid.tsx must be deleted',
	);
	const hits = scanForNeedles(readSourceTree(), DEAD_MODULE_NEEDLES);
	assert.deepEqual(
		hits,
		[],
		`a deleted module is referenced again:\n  ${hits.map((h) => `${h.file} -> ${h.needle}`).join('\n  ')}`,
	);
});
