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
 *
 * THE RULE, STATED HONESTLY (A3-C1 correction 2 — QA findings F1 and F4)
 *
 * A non-timetable page must have exactly ONE real, page-level `<h1>`. It adopts
 * the canonical `PageHeader` card when it had no title of its own, and it KEEPS
 * a title that is already properly placed inside a branded hero or a compact
 * workspace strip. Two surfaces are exempt on that second branch, and each is
 * pinned as exempt-with-reason below rather than merely left alone:
 *
 *   `/`                     -> the gradient hero already owned `<h1>Scheduling
 *                             Dashboard</h1>`. The PageHeader card was reverted:
 *                             it added ~66px of card plus a 24px space-y-6 gap at
 *                             the very top of a SCROLLING region, pushing the
 *                             rollover chips, source-decision chip and hero
 *                             actions ~90px down the screen the demo opens on.
 *   Sections/Subjects/      -> AdminWorkspaceFrame and WorkspaceToolbar each own
 *   Faculty/TeachingLoad       one h1 inside a compact strip.
 *
 * A3-C4 (walkthrough 1.4) REVERSED one sentence of the paragraph above, and only
 * that sentence. `/` is exempt from the `PageHeader` CARD and still keeps its
 * hero `<h1>`, because that exemption was granted for vertical space and
 * placement. But A3-C1 also recorded here that the rendered h1 "deliberately
 * does NOT equal its breadcrumb leaf", and THAT was the defect: the hero read
 * "Scheduling Dashboard" while the sidebar and breadcrumb read "Dashboard", so
 * one page had two names. The hero is now aligned to the chrome and `/` obeys
 * leaf-agreement like every other route; the exemption test asserts the
 * equality instead of tolerating the disagreement, and says so out loud.
 *
 * F1 (this correction): the test that used to be named "the previously ad-hoc
 * titles now equal their breadcrumb leaf" compared hardcoded literals against
 * `resolveRouteChrome(...)` — the REGISTRY, not the rendered DOM. QA proved it by
 * mutating a page title to 'Room Preferences MUTANT': the rendered-DOM test went
 * red, that one stayed green. Its registry control is preserved below under a
 * name that says what it checks, and the leaf-agreement claim now runs against
 * the RENDERED h1, per route.
 *
 * F3 (recorded, not changed): PageHeader renders `primaryAction` before
 * `secondaryActions`, so `/map` reads `Edit rooms` then `Open/Hide map`. That is
 * the canonical contract and is pinned below rather than left silent.
 *
 * F6 (recorded, not reverted): the old "How Timetabling Works" string is gone.
 * `/timetabling/how-it-works` now titles itself from the canonical component with
 * its breadcrumb leaf, replacing a `text-[0.65rem]` label (10.4px, below the 12px
 * chrome floor the committed ux-r01-shared-chrome suite enforces). Do not
 * restore it.
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

/**
 * In-scope routes this file renders, the component that serves them, and the
 * title the page is REQUIRED to show. The literal is what catches a rename; the
 * rendered-vs-registry agreement in section 2 is what catches registry drift.
 * Neither control subsumes the other, so neither carries a hardcoded-only
 * comparison dressed up as the other.
 */
const renderedSurfaces: [string, string, () => unknown, string, number][] = [
	['/map (overview)', '/map', MapEditor, 'Campus & Rooms', 1],
	['/audit', '/audit', Audit, 'Audit', 1],
	['/faculty/preferences', '/faculty/preferences', OfficerPreferences, 'Faculty Preferences', 0],
	['/faculty/room-preferences', '/faculty/room-preferences', OfficerRoomPreferences, 'Room Preferences', 0],
	['/timetabling/how-it-works', '/timetabling/how-it-works', HowItWorks, 'How Scheduling Works', 0],
	['/teaching-load/history', '/teaching-load/history', TeachingLoadHistoryView, 'Archived Teaching Load', 1],
];

test('rendered A3 surfaces each emit exactly one canonical h1 and at most one primary action', async () => {
	for (const [label, path, Component, title, max] of renderedSurfaces) {
		assertCanonicalTitle(await renderInJsdom(path, Component), label, title, max);
	}
	// SUPERSEDED (A3-C1 correction 2, QA F4): this test used to end with
	//   assertCanonicalTitle(renderStatic('/', Dashboard), '/ (Dashboard)', 'Dashboard', 0)
	// `/` is now EXEMPT from the PageHeader card — its hero already owned a real
	// page-level <h1> and the card cost ~90px on the demo's first screen. The
	// Dashboard assertions were NOT deleted; they are re-anchored to the hero's
	// own title in the "/ is exempt" test below, which also pins that
	// Dashboard.tsx renders no PageHeader at all.
});

// --- 2. The three previously ad-hoc pages no longer own a raw h1 -------------

/**
 * SUPERSEDED (A3-C1 correction 2, QA F4): this array was
 *   'src/pages/Dashboard.tsx'  ... 'src/components/faculty-assignments/TeachingLoadHistoryView.tsx'
 * `/` is EXEMPT from the PageHeader card and legitimately owns a raw hero <h1>,
 * so it is no longer a member. The row was not deleted silently: the "/ is
 * exempt" test in section 3 now pins Dashboard's single h1, pins that it is the
 * hero's, and pins that Dashboard.tsx contains no PageHeader.
 */
const pageFilesWithNoRawH1 = [
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

test('the navigation registry still carries the intended title for each converted route', () => {
	// PRESERVED verbatim from the test this correction split (A3-C1 correction 2,
	// QA F1). What it checks: the registry, against a hardcoded intent. It never
	// rendered anything, so it is renamed to say so — it is NOT the leaf-agreement
	// control, which is the rendered test immediately below.
	//
	// `/` stays in this list: the registry title for `/` is 'Dashboard' and the
	// revert did not touch the registry. The *page* is exempt, not the registry.
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
	// F6, recorded not reverted: the pre-candidate "How Timetabling Works" label
	// was a `text-[0.65rem]` span (10.4px, under the 12px chrome floor) that also
	// disagreed with its breadcrumb leaf. It must not come back.
	assert.equal(
		(source('src/pages/HowItWorks.tsx').match(/How Timetabling Works/g) ?? []).length,
		0,
		'the sub-12px "How Timetabling Works" label must stay retired',
	);
});

test('every RENDERED in-scope page h1 equals resolveRouteChrome(route).title', async () => {
	// A3-C1 correction 2, QA F1. This is the control the old test only claimed to
	// be: it reads the h1 out of the RENDERED DOM, per route, and compares it to
	// the registry. Mutating a page's title so it no longer matches its breadcrumb
	// leaf therefore turns THIS test red — the old registry-only comparison stayed
	// green through exactly that mutation.
	//
	// Routes not in `renderedSurfaces`, and why (no pretending they rendered):
	//   `/`                  EXEMPT by decision — hero already owns the h1, and the
	//                         PageHeader card cost ~90px on the demo's first
	//                         screen. Pinned in the "/ is exempt" test below. Its
	//                         h1 is intentionally NOT the breadcrumb leaf.
	//   `/map?mode=editor`   react-konva needs a real canvas; JSDOM has none
	//                         (measured: "Cannot read properties of null (reading
	//                         'scale')"). Source-pinned in section 3.
	//   `/admin/year-setup`  gated on `verifySessionToken()` returning an admin
	//                         user, else it renders <Navigate to="/login"> and
	//                         nothing at all. Source-pinned in section 3.
	for (const [label, path, Component] of renderedSurfaces) {
		const html = await renderInJsdom(path, Component);
		assert.equal(
			h1Text(html),
			resolveRouteChrome(path).title,
			`${label} rendered h1 must equal its breadcrumb leaf (${resolveRouteChrome(path).title})`,
		);
	}
});

// --- 3. Source-pinned surfaces, each with its reason recorded ----------------

test('"/" is EXEMPT from the PageHeader card: one h1, it is the hero h1, and no PageHeader exists', () => {
	// A3-C1 correction 2, QA F4. This is the control that replaced the
	// Dashboard-in-PageHeader assertions. All three parts are load-bearing:
	// re-inserting the card breaks the h1 count, the source pins AND the position
	// check, so the exemption cannot be undone silently.
	const html = renderStatic('/', Dashboard);
	assert.equal(h1Count(html), 1, `"/" must render exactly one h1, saw ${h1Count(html)}`);
	// A3-C4 (walkthrough 1.4), DELIBERATE PINNED-VALUE EDIT.
	//
	// This literal was 'Scheduling Dashboard'. It is now 'Dashboard' because the
	// hero was ALIGNED TO THE SIDEBAR/BREADCRUMB name, so the page has one name:
	// the sidebar entry (navigation.ts) and the breadcrumb leaf
	// (resolveRouteChrome('/')) both read 'Dashboard', and Lane C's graded demo
	// walkthrough recorded two names for one page as a navigation problem for
	// older, mouse-first users (step 1.4).
	//
	// What this edit does NOT do, deliberately (AGENTS.md §16 — corrections are
	// additive; never delete or weaken an assertion to get green):
	//   - it does not relax the assertion. It is still an exact equality, so a
	//     rename of the hero in EITHER direction still goes red.
	//   - it does not touch the exemption. The `/` exemption is from the
	//     `PageHeader` CARD, and its stated reason was vertical space (~66px of
	//     card + a 24px gap at the very top of a scrolling region) and the h1's
	//     placement inside the branded hero — never the name. Every load-bearing
	//     part of that exemption (h1 count, no `<PageHeader` element, no
	//     PageHeader import, h1 position below the gradient wrapper, the hero
	//     subtitle pin) is unchanged and still asserted below.
	//   - it does not drop a test. This file still runs 14 tests.
	//   - it does not remove coverage. The assertion it reverses — that the h1
	//     "deliberately does NOT equal its breadcrumb leaf" — was the DEFECT
	//     being fixed, not a design decision, and it is now replaced by a
	//     STRONGER control: the leaf-agreement assertion directly below, which
	//     makes the rendered h1 equal resolveRouteChrome('/').title. A3-C1
	//     previously exempted `/` from leaf-agreement; it no longer needs to.
	assert.equal(h1Text(html), 'Dashboard', 'the single h1 on "/" must be the hero h1, and must now equal its breadcrumb leaf');
	// Leaf-agreement for `/`, rendered. This is the positive control the old
	// exemption lacked: the hero and the chrome can no longer drift apart.
	assert.equal(
		h1Text(html),
		resolveRouteChrome('/').title,
		'the hero h1 on "/" must equal its breadcrumb leaf, so the page has ONE name',
	);
	assert.equal(
		resolveRouteChrome('/').title,
		'Dashboard',
		'the sidebar/breadcrumb name for "/" is unchanged — the hero moved to it, not the reverse',
	);
	assert.equal(primaryActionCount(html), 0, 'the exemption must not smuggle a primary-action slot back in');

	const dashboard = source('src/pages/Dashboard.tsx');
	assert.doesNotMatch(
		dashboard,
		/<PageHeader/,
		'Dashboard.tsx must not render the PageHeader card: "/" is exempt (QA F4)',
	);
	assert.doesNotMatch(
		dashboard,
		/app-shell\/PageHeader/,
		'Dashboard.tsx must not even import the PageHeader while it is exempt',
	);
	// And the h1 must live INSIDE the branded hero, not above it — that placement
	// is the whole reason the card is unwanted here.
	const heroAt = dashboard.indexOf('bg-[linear-gradient(145deg');
	const h1At = dashboard.indexOf('<h1');
	assert.ok(heroAt > 0, 'the gradient hero must still exist');
	assert.ok(h1At > heroAt, 'the h1 must sit inside the hero, below its gradient wrapper');
	assert.match(dashboard, /<p className='mt-1 text-sm text-white\/80'>Build, review, and publish the school timetable\.<\/p>/);
});

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

test('the four wrapper-owned pages are EXEMPT (they already own one h1 in a compact strip) and still emit exactly one', () => {
	// EXEMPT WITH REASON, not merely "unchanged" (A3-C1 correction 2, QA F4).
	// Sections/Subjects/Faculty own their h1 inside AdminWorkspaceFrame and
	// TeachingLoad owns it inside WorkspaceToolbar. Both wrappers render in the
	// page body, so these pages were never affected by the desktop-title gap, and
	// the card-style PageHeader would add real vertical space to /teachers and
	// /teaching-load — the pages protected by accepted browser rows 14 and 16,
	// which no harness in this stream can measure.
	const frame = source('src/components/admin-workspace/AdminWorkspace.tsx');
	assert.equal((frame.match(/<h1/g) ?? []).length, 1, 'AdminWorkspaceFrame owns exactly one h1');
	assert.doesNotMatch(frame, /<PageHeader/, 'the frame is the strip owner; it must not grow a PageHeader card');
	const toolbar = source('src/components/faculty-assignments/WorkspaceToolbar.tsx');
	assert.equal((toolbar.match(/<h1/g) ?? []).length, 1, 'WorkspaceToolbar owns exactly one h1');
	assert.doesNotMatch(toolbar, /<PageHeader/, 'the toolbar is the strip owner; it must not grow a PageHeader card');

	for (const path of ['src/pages/Sections.tsx', 'src/pages/Subjects.tsx', 'src/pages/Faculty.tsx']) {
		assert.equal((source(path).match(/<h1/g) ?? []).length, 0, `${path} adds no h1 of its own`);
		assert.doesNotMatch(source(path), /<PageHeader/, `${path} is exempt: it must not adopt the PageHeader card`);
		assert.match(source(path), /<AdminWorkspaceFrame/, `${path} still renders the shared frame`);
	}
	assert.equal((source('src/pages/TeachingLoad.tsx').match(/<h1/g) ?? []).length, 0);
	assert.doesNotMatch(source('src/pages/TeachingLoad.tsx'), /<PageHeader/, 'TeachingLoad is exempt for the same reason');
	assert.match(source('src/pages/TeachingLoad.tsx'), /<WorkspaceToolbar/);
});

test('PageHeader renders primaryAction before secondaryActions, and /map depends on that order', () => {
	// A3-C1 correction 2, QA F3 — RECORDED, NOT CHANGED. PageHeader.tsx renders
	// `primaryAction` first and `secondaryActions` second, which is the canonical
	// contract (it is not editable by this stream). On /map that means the
	// tab/reading order is `Edit rooms` then `Open map` / `Hide map`, changed from
	// the pre-candidate `Open/Hide map` then `Edit rooms`. Reviewed and accepted:
	// `Edit rooms` is the primary-styled action and primary-first is the contract.
	// This assertion exists so the order is captured rather than silent — if a
	// future stream edits PageHeader, this goes red instead of the order shifting
	// again without a record.
	const overview = source('src/components/campus-map/CampusMapOverview.tsx');
	const primaryAt = overview.indexOf('primaryAction={(');
	const secondaryAt = overview.indexOf('secondaryActions={(');
	assert.ok(primaryAt > 0 && secondaryAt > primaryAt, '/map must pass the room editor as primaryAction and the map toggle as secondaryActions');
	assert.match(overview.slice(primaryAt, secondaryAt), /Edit rooms/);
	assert.match(overview.slice(secondaryAt), /showExplorer \? 'Hide map' : 'Open map'/);

	const html = renderToStaticMarkup(createElement(PageHeader, {
		title: 'Campus & Rooms',
		primaryAction: createElement('button', { type: 'button' }, 'Edit rooms'),
		secondaryActions: createElement('button', { type: 'button' }, 'Open map'),
	}));
	assert.equal(h1Count(html), 1);
	assert.equal(primaryActionCount(html), 1);
	assert.ok(
		html.indexOf('Edit rooms') < html.indexOf('Open map'),
		'the primary action must render before the secondary actions',
	);
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
