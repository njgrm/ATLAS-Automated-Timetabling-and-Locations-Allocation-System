/**
 * A3-CANONICAL-PAGE-TITLE-C1 (stream S-a) — one canonical page-title pattern.
 *
 * The repo already owned the contract; this stream adopts it. `PageHeader`
 * (src/components/app-shell/PageHeader.tsx) renders the single `<h1>`, an
 * optional eyebrow/subtitle, and at most one `data-page-primary-action`. The
 * committed suite `ux-r01-shared-chrome.test.tsx` pins the component's own
 * contract; this file pins that the A3 non-timetable pages actually USE it.
 *
 * WHY RENDERING IS SPLIT — read this before trusting a count here.
 *
 * The packet's before-table ("Sections 0, Subjects 0, Faculty 0,
 * TeachingLoad 0 h1") was measured PER FILE with a source grep, not per
 * rendered page. Rendering shows four of those pages already emit exactly one
 * `<h1>` — through a shared wrapper the grep could not see:
 *
 *   Sections / Subjects / Faculty -> AdminWorkspaceFrame   (its own <h1>)
 *   TeachingLoad                  -> WorkspaceToolbar      (its own <h1>)
 *
 * Both wrappers render inside the page body, so those pages are NOT affected
 * by the desktop-title gap this stream exists to close, and both have exactly
 * one h1 before and after. Converting them to the card-style PageHeader would
 * add real vertical space to `/teachers` and `/teaching-load` — the two pages
 * protected by accepted browser rows 14 and 16 — and no harness available to
 * this stream can measure 1366x768 density. They are therefore left alone and
 * pinned as unchanged, not silently skipped. See the two "wrapper-owned"
 * tests below.
 *
 * RENDERED here (JSDOM + react-dom/client, effects run, so loading gates
 * clear): MapEditor(overview), Audit, OfficerPreferences,
 * OfficerRoomPreferences, HowItWorks, TeachingLoadHistoryView; plus Dashboard
 * via renderToStaticMarkup. Each asserts a real DOM: exactly one <h1>, its
 * text, and at most one primary action.
 *
 * SOURCE-PINNED, with the specific reason (not "hard to render"):
 *   - MapEditor EDITOR mode: react-konva needs a real canvas; JSDOM has none
 *     (measured: "Cannot read properties of null (reading 'scale')").
 *   - AdminYearSetup: gated on `verifySessionToken()` returning an admin user,
 *     else it renders <Navigate to="/login"> and nothing at all. Stubbing the
 *     auth adapter was attempted and is not sound evidence for a title.
 *   - Sections / Subjects / Faculty / TeachingLoad: the wrapper-owned h1.
 *
 * A note on the `<h1>` in Audit: it was a transient "Checking readiness..."
 * splash, so the LOADED page had no title at all. The splash is now a <p> and
 * the loaded branch owns the single h1 — a page never shows two.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

import { PageHeader } from '@/components/app-shell/PageHeader';
import { resolveRouteChrome } from '@/components/app-shell/navigation';
import Audit from '@/pages/Audit';
import Dashboard from '@/pages/Dashboard';
import HowItWorks from '@/pages/HowItWorks';
import MapEditor from '@/pages/MapEditor';
import OfficerPreferences from '@/pages/OfficerPreferences';
import OfficerRoomPreferences from '@/pages/OfficerRoomPreferences';
import TeachingLoadHistoryView from '@/components/faculty-assignments/TeachingLoadHistoryView';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../..');

function source(path: string): string {
	return readFileSync(resolve(CLIENT_ROOT, path), 'utf8');
}

// --- JSDOM harness -----------------------------------------------------------
// DocumentFragment/NodeFilter/SVGElement are required by Radix + framer-motion
// on this surface; without them OfficerRoomPreferences throws a bare
// AggregateError("") whose cause is invisible. Pinning them keeps the failure
// readable if a future page needs another.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'http://localhost/a3-page-title',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	localStorage: dom.window.localStorage,
	sessionStorage: dom.window.sessionStorage,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	NodeFilter: dom.window.NodeFilter,
	SVGElement: dom.window.SVGElement,
	HTMLImageElement: dom.window.HTMLImageElement,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	getComputedStyle: dom.window.getComputedStyle,
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
	scrollTo: () => {},
	IS_REACT_ACT_ENVIRONMENT: true,
});

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { MemoryRouter, Route, Routes } = await import('react-router-dom');

async function renderInJsdom(path: string, Component: () => unknown): Promise<string> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	try {
		await act(async () => {
			root.render(
				createElement(
					MemoryRouter,
					{ initialEntries: [path] },
					createElement(
						Routes,
						null,
						createElement(Route, { path: path.split('?')[0], element: createElement(Component as never) }),
					),
				),
			);
		});
		// Effects dispatch real requests that fail against no server; the
		// loading gates settle on their own error path.
		await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
		return host.innerHTML;
	} finally {
		await act(async () => { root.unmount(); });
		dom.window.document.body.removeChild(host);
	}
}

function renderStatic(path: string, Component: () => unknown): string {
	return renderToStaticMarkup(
		createElement(
			MemoryRouter,
			{ initialEntries: [path] },
			createElement(
				Routes,
				null,
				createElement(Route, { path: path.split('?')[0], element: createElement(Component as never) }),
			),
		),
	);
}

const h1Text = (html: string): string | null => {
	const raw = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1];
	if (raw === undefined) return null;
	// JSDOM innerHTML and renderToStaticMarkup both hand back escaped text.
	return raw
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
};
const h1Count = (html: string): number => (html.match(/<h1/g) ?? []).length;
const primaryActionCount = (html: string): number => (html.match(/data-page-primary-action/g) ?? []).length;

/** The one assertion every surface must satisfy, whatever its render strategy. */
function assertCanonicalTitle(html: string, label: string, title: string, maxPrimaryActions: number): void {
	assert.equal(h1Count(html), 1, `${label} must render exactly one h1, saw ${h1Count(html)}`);
	assert.equal(h1Text(html), title, `${label} h1 text`);
	assert.ok(
		primaryActionCount(html) <= maxPrimaryActions,
		`${label} must render at most ${maxPrimaryActions} data-page-primary-action, saw ${primaryActionCount(html)}`,
	);
	assert.ok(
		!/<h1[^>]*aria-hidden=/.test(html),
		`${label} must not hide its title from assistive tech`,
	);
}

// --- 1. Rendered surfaces ----------------------------------------------------

test('rendered A3 surfaces each emit exactly one canonical h1 and at most one primary action', async () => {
	const jsdomSurfaces: [string, string, () => unknown, string, number][] = [
		['/map (overview)', '/map', MapEditor, 'Campus & Rooms', 1],
		['/audit', '/audit', Audit, 'Audit', 1],
		['/faculty/preferences', '/faculty/preferences', OfficerPreferences, 'Faculty Preferences', 0],
		['/faculty/room-preferences', '/faculty/room-preferences', OfficerRoomPreferences, 'Room Preferences', 0],
		['/timetabling/how-it-works', '/timetabling/how-it-works', HowItWorks, 'How Scheduling Works', 0],
		['/teaching-load/history', '/teaching-load/history', TeachingLoadHistoryView, 'Archived Teaching Load', 1],
	];
	for (const [label, path, Component, title, max] of jsdomSurfaces) {
		assertCanonicalTitle(await renderInJsdom(path, Component), label, title, max);
	}
	// Dashboard mounts a chart that needs layout JSDOM does not perform
	// (measured: null.scale). renderToStaticMarkup runs the component body
	// without effects and reaches the real header, so the h1 below is the
	// shipped one, not a fallback.
	assertCanonicalTitle(renderStatic('/', Dashboard), '/ (Dashboard)', 'Dashboard', 0);
});

// --- 2. The three previously ad-hoc pages no longer own a raw h1 -------------

const pageFilesWithNoRawH1 = [
	'src/pages/Dashboard.tsx',
	'src/pages/MapEditor.tsx',
	'src/pages/Audit.tsx',
	'src/pages/OfficerPreferences.tsx',
	'src/pages/OfficerRoomPreferences.tsx',
	'src/pages/HowItWorks.tsx',
	'src/pages/AdminYearSetup.tsx',
	'src/components/campus-map/CampusMapOverview.tsx',
	'src/components/faculty-assignments/TeachingLoadHistoryView.tsx',
];

test('no in-scope page file emits a raw page-level h1 outside the canonical component', () => {
	for (const path of pageFilesWithNoRawH1) {
		assert.equal(
			(source(path).match(/<h1/g) ?? []).length,
			0,
			`${path} must not emit its own h1; the canonical PageHeader owns it`,
		);
	}
});

test('each in-scope page file routes its title through PageHeader', () => {
	for (const path of pageFilesWithNoRawH1) {
		assert.match(source(path), /<PageHeader/, `${path} must render the canonical PageHeader`);
		assert.match(source(path), /app-shell\/PageHeader/, `${path} must import the canonical PageHeader`);
	}
});

test('the previously ad-hoc titles now equal their breadcrumb leaf', () => {
	// Rule 3 of the packet: where the ad-hoc wording duplicated the breadcrumb
	// leaf, use the leaf so page and breadcrumb agree. Audit had no loaded
	// title at all (its h1 was a loading splash).
	const expectations: [string, string][] = [
		['/', 'Dashboard'],
		['/map', 'Campus & Rooms'],
		['/audit', 'Audit'],
		['/faculty/preferences', 'Faculty Preferences'],
		['/faculty/room-preferences', 'Room Preferences'],
		['/timetabling/how-it-works', 'How Scheduling Works'],
		['/teaching-load/history', 'Archived Teaching Load'],
		['/admin/year-setup', 'School Year Setup'],
	];
	for (const [route, title] of expectations) {
		assert.equal(resolveRouteChrome(route).title, title, `${route} authoritative title`);
	}
	assert.equal(source('src/pages/AdminYearSetup.tsx').includes("title='School Year Setup'"), true);
	assert.equal(source('src/components/campus-map/CampusMapOverview.tsx').includes("title='Campus & Rooms'"), true);
});

// --- 3. Source-pinned surfaces, each with its reason recorded ----------------

test('the /map editor sub-view is source-pinned because react-konva needs a canvas JSDOM lacks', () => {
	const mapEditor = source('src/pages/MapEditor.tsx');
	assert.match(mapEditor, /<PageHeader title='Campus map editor'/, 'editor sub-view keeps a canonical title');
	assert.match(mapEditor, /eyebrow='Scheduling Portal'/, 'the pre-existing portal label is preserved, not dropped');
	// The overview sub-view is NOT given a second PageHeader here — its title
	// comes from CampusMapOverview. Two would mean two h1s on one page.
	assert.equal(
		(mapEditor.match(/<PageHeader/g) ?? []).length,
		1,
		'MapEditor must add exactly one PageHeader; the overview title belongs to CampusMapOverview',
	);
});

test('AdminYearSetup is source-pinned because it renders nothing without an admin session', () => {
	const page = source('src/pages/AdminYearSetup.tsx');
	assert.match(page, /<PageHeader title='School Year Setup'/, '/admin/year-setup gets a canonical title');
	// Measured: without verifySessionToken() resolving an admin user this page
	// returns <Navigate to="/login"> and renders an empty host.
	assert.match(page, /<Navigate to="\/login"/, 'the auth gate this pin works around is still present');
});

test('the four wrapper-owned pages are unchanged and still emit one h1 through their own frame', () => {
	// These already had exactly one h1 before this stream and still do. They
	// are pinned as unchanged so a later stream cannot quietly add a second.
	const frame = source('src/components/admin-workspace/AdminWorkspace.tsx');
	assert.equal((frame.match(/<h1/g) ?? []).length, 1, 'AdminWorkspaceFrame owns exactly one h1');
	const toolbar = source('src/components/faculty-assignments/WorkspaceToolbar.tsx');
	assert.equal((toolbar.match(/<h1/g) ?? []).length, 1, 'WorkspaceToolbar owns exactly one h1');

	for (const path of ['src/pages/Sections.tsx', 'src/pages/Subjects.tsx', 'src/pages/Faculty.tsx']) {
		assert.equal((source(path).match(/<h1/g) ?? []).length, 0, `${path} adds no h1 of its own`);
		assert.match(source(path), /<AdminWorkspaceFrame/, `${path} still renders the shared frame`);
	}
	assert.equal((source('src/pages/TeachingLoad.tsx').match(/<h1/g) ?? []).length, 0);
	assert.match(source('src/pages/TeachingLoad.tsx'), /<WorkspaceToolbar/);
});

// --- 4. The boundary this stream was told not to cross -----------------------

test('AppShell still renders currentPageTitle on mobile only, and breadcrumbs on desktop', () => {
	// The packet forbids editing AppShell.tsx: the desktop branch renders only
	// <AppBreadcrumbs>, which is WHY these pages need their own title. This is
	// the regression guard against a future stream moving the title across.
	const appShell = source('src/components/AppShell.tsx');
	assert.equal(
		(appShell.match(/\{currentPageTitle\}/g) ?? []).length,
		1,
		'AppShell must keep exactly one currentPageTitle usage',
	);

	const mobileStart = appShell.indexOf('{isMobile ? (');
	const desktopStart = appShell.indexOf(') : (', mobileStart);
	assert.ok(mobileStart > 0 && desktopStart > mobileStart, 'AppShell must still branch on isMobile');

	const mobileBranch = appShell.slice(mobileStart, desktopStart);
	assert.match(mobileBranch, /\{currentPageTitle\}/, 'the page title must stay in the mobile branch');

	const desktopHeader = appShell.slice(desktopStart, appShell.indexOf('</header>', desktopStart));
	assert.doesNotMatch(desktopHeader, /currentPageTitle/, 'the desktop header must not gain a second title');
	assert.match(desktopHeader, /<AppBreadcrumbs breadcrumbs=\{routeChrome\.breadcrumbs\}/);
});

// --- 5. Load-bearing controls ------------------------------------------------

test('the h1/primary-action assertion rejects a duplicate h1 and an over-full action row', () => {
	// A page that rendered two PageHeaders would emit two h1s. Prove the
	// assertion above actually discriminates rather than passing vacuously.
	const doubled =
		'<header><h1>One</h1></header><header data-page-primary-action><h1>Two</h1></header>';
	assert.throws(
		() => assertCanonicalTitle(doubled, 'mutant', 'One', 1),
		/must render exactly one h1/,
	);
	// A page with two primary actions must fail an at-most-one budget.
	const twoActions = '<h1>T</h1><div data-page-primary-action></div><div data-page-primary-action></div>';
	assert.throws(
		() => assertCanonicalTitle(twoActions, 'mutant', 'T', 1),
		/at most 1 data-page-primary-action/,
	);
	// And a hidden title is not an acceptable substitute for a real heading.
	assert.throws(
		() => assertCanonicalTitle('<h1 aria-hidden="true">T</h1>', 'mutant', 'T', 1),
		/must not hide its title/,
	);
});

test('the AppShell mobile-only pin rejects a title moved into the desktop branch', () => {
	const appShell = source('src/components/AppShell.tsx');
	const check = (text: string): void => {
		const mobileStart = text.indexOf('{isMobile ? (');
		const desktopStart = text.indexOf(') : (', mobileStart);
		assert.equal((text.match(/\{currentPageTitle\}/g) ?? []).length, 1);
		assert.match(text.slice(mobileStart, desktopStart), /\{currentPageTitle\}/);
		assert.doesNotMatch(
			text.slice(desktopStart, text.indexOf('</header>', desktopStart)),
			/currentPageTitle/,
		);
	};
	assert.doesNotThrow(() => check(appShell));
	// The exact regression this stream is forbidden to introduce.
	assert.throws(
		() => check(appShell.replace('{isMobile ? (', '{isMobile ? (} DesktopTitleProbe = <>{currentPageTitle}')),
	);
});

test('the canonical PageHeader still owns one h1 and one primary-action slot', () => {
	// Guards the component against being edited to suit these pages.
	const html = renderToStaticMarkup(createElement(PageHeader, {
		title: 'Subjects',
		eyebrow: 'School setup',
		subtitle: 'Maintain the teaching catalog.',
		primaryAction: createElement('button', { type: 'button' }, 'Add subject'),
	}));
	assert.equal(h1Count(html), 1);
	assert.equal(primaryActionCount(html), 1);
});
