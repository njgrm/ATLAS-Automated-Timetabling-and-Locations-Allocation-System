/**
 * A3-C4-COPY (stream A3, Planner A3 copy/UX lane) — Top-10 walkthrough items #1
 * ("one page name") and #2 ("no page-level scroll at 1366x768").
 *
 * ITEM 1 — ONE PAGE NAME FOR "/"
 *
 * Lane C's graded demo walkthrough (live `d31bfacb`, 1366x768, step 1.4) found
 * the Dashboard hero reading "Scheduling Dashboard" while the sidebar entry
 * (`navigation.ts:25`) and the breadcrumb leaf (`resolveRouteChrome('/')`, which
 * resolves the same `navigationNav` item) both read "Dashboard". Two names for
 * one page is a navigation problem for older, mouse-first users.
 *
 * The hero h1 is aligned to the sidebar/breadcrumb name, so all three now read
 * "Dashboard". NOTE WHAT IS *NOT* EXEMPT ANYMORE: A3-C1 exempted `/` from the
 * `PageHeader` CARD, and that exemption is untouched and still load-bearing
 * (it is re-proved below). A3-C1's separate claim that the h1 "deliberately does
 * NOT equal its breadcrumb leaf" is what this stream reverses, because that
 * disagreement WAS the defect, not a design decision. The exemption's stated
 * reason was vertical space and placement, never the name.
 *
 * ITEM 2 — THE 1366x768 PIXEL ROW IS **OWED TO A BROWSER HOLDER** AND IS NOT
 * DECIDED HERE. Read this before treating anything below as proof.
 *
 * No browser runs in this stream, so NOTHING in section 3 measures a pixel. The
 * assertions there are STRUCTURAL: they read the class chain and the rendered
 * markup, which is a real regression guard (it fails if the chain is broken)
 * but is NOT a substitute for the pixel row. The recorded precedent is the Fix
 * 24 / `test:visual:faculty` lesson in the c1 handoff: a jsdom "pixel"
 * assertion is structurally meaningless because jsdom has no layout engine.
 * A browser holder must still measure `documentElement.scrollHeight` vs
 * `clientHeight` at 1366x768 on `https://njgrm.buru-degree.ts.net`; the exact
 * steps are in the stream handoff, and that row remains open.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

import { navigationNav, resolveRouteChrome } from '@/components/app-shell/navigation';
import Dashboard from '@/pages/Dashboard';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../..');

function source(path: string): string {
	return readFileSync(resolve(CLIENT_ROOT, path), 'utf8');
}

/** Remove `//` line comments and block comments, leaving executable text. */
function stripComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

// JSDOM harness — required by Radix + framer-motion on this surface. Mirrors
// the harness in a3-canonical-page-title-c1.test.tsx so a failure here reads
// the same way a failure there does.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'http://localhost/a3-c4-copy',
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

const { MemoryRouter, Route, Routes } = await import('react-router-dom');

/** `/` renders through renderToStaticMarkup (A3-C1's chosen strategy). */
function renderDashboard(): string {
	return renderToStaticMarkup(
		createElement(
			MemoryRouter,
			{ initialEntries: ['/'] },
			createElement(Routes, null, createElement(Route, { path: '/', element: createElement(Dashboard) })),
		),
	);
}

const h1Text = (html: string): string | null => {
	const raw = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1];
	if (raw === undefined) return null;
	return raw
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
};
const h1Count = (html: string): number => (html.match(/<h1/g) ?? []).length;
const sidebarLabelFor = (path: string): string => {
	const item = navigationNav.find((candidate) => candidate.to === path);
	assert.ok(item, `the sidebar registry must carry an entry for ${path}`);
	return item.label;
};

/** The single assertion item 1 is about: hero h1 === sidebar label === breadcrumb leaf. */
function assertOneName(html: string, label: string): void {
	const title = h1Text(html);
	assert.equal(title, sidebarLabelFor('/'), `${label}: the hero h1 must equal the sidebar label for "/"`);
	assert.equal(title, resolveRouteChrome('/').title, `${label}: the hero h1 must equal the breadcrumb leaf for "/"`);
}

// --- 1. Item 1: one page name, on the RENDERED surface -----------------------

test('the "/" hero h1, the sidebar label and the breadcrumb leaf are ONE name', () => {
	// FAILING-FIRST for walkthrough item 1: on the base revision the hero read
	// "Scheduling Dashboard" while the sidebar and breadcrumb read "Dashboard",
	// so this control fails there and passes only after the hero is aligned.
	const html = renderDashboard();
	assert.equal(h1Count(html), 1, `"/" must still render exactly one h1, saw ${h1Count(html)}`);
	assertOneName(html, '/ (Dashboard hero)');
	assert.equal(h1Text(html), 'Dashboard', 'the hero now carries the page name the rest of the chrome uses');
});

test('the retired two-name string is gone from the rendered hero AND from Dashboard source', () => {
	// Guards the rename from creeping back via either the render or a re-added
	// literal. The "Scheduling Dashboard" prose still legitimately appears in
	// (a) an UNRELATED historical comment in
	// src/lib/__tests__/dashboard-truth-c01.test.ts (not owned here), and (b) the
	// A3-C4 rationale comment in Dashboard.tsx itself — which is why the source
	// check strips comments and asserts on EXECUTABLE text only. Comments are
	// recorded prose; only a live expression can leak the retired name.
	assert.doesNotMatch(renderDashboard(), /Scheduling Dashboard/, 'the rendered hero must not read "Scheduling Dashboard"');
	assert.doesNotMatch(
		stripComments(source('src/pages/Dashboard.tsx')),
		/Scheduling Dashboard/,
		'no executable line in Dashboard.tsx may carry the retired second name',
	);
});

test('stripComments removes line and block comments, so the source check above is not satisfied by prose', () => {
	// Load-bearing: prove the stripper discriminates, so "the name is gone" is a
	// statement about executable code and not a comment-reading artefact.
	const commented = stripComments(`const a = 1; // Scheduling Dashboard\n/* Scheduling Dashboard */\nconst b = 2;`);
	assert.doesNotMatch(commented, /Scheduling Dashboard/, 'both comment forms must be removed');
	assert.match(commented, /const a = 1;/, 'executable statements must survive');
	assert.match(commented, /const b = 2;/);
	assert.match(
		stripComments(`const t = 'Scheduling Dashboard';`),
		/Scheduling Dashboard/,
		'a string LITERAL is not a comment and must still be caught',
	);
});

test('the sidebar and breadcrumb registry already agree, and were NOT changed to match the hero', () => {
	// Proves the hero moved to the chrome, not the reverse. If someone "fixes"
	// this by renaming the sidebar to "Scheduling Dashboard", this goes red.
	assert.equal(sidebarLabelFor('/'), 'Dashboard', 'the sidebar entry for "/" is the canonical name');
	assert.deepEqual(resolveRouteChrome('/').breadcrumbs, ['Dashboard'], 'the breadcrumb trail for "/" is the canonical name');
	assert.equal(resolveRouteChrome('/').title, 'Dashboard');
	assert.doesNotMatch(
		source('src/components/app-shell/navigation.ts'),
		/Scheduling Dashboard/,
		'navigation.ts (not owned by this stream) must still say "Dashboard"',
	);
});

test('the one-name assertion rejects a hero that disagrees with the chrome', () => {
	// Load-bearing: prove assertOneName actually discriminates instead of
	// passing vacuously against a null/garbled h1.
	assert.throws(() => assertOneName('<h1>Scheduling Dashboard</h1>', 'mutant'), /must equal the sidebar label/);
	assert.throws(() => assertOneName('<h1></h1>', 'mutant'), /must equal the sidebar label/);
	assert.doesNotThrow(() => assertOneName('<h1>Dashboard</h1>', 'control'));
});

// --- 2. The A3-C1 PageHeader exemption survives the rename --------------------

test('"/" is STILL exempt from the PageHeader card: the rename did not undo the exemption', () => {
	// A3-C1's exemption reason was vertical space and the h1's placement INSIDE
	// the branded hero, never the name. The rename changes the text only, so the
	// whole exemption must survive it. Re-proved here so a future stream cannot
	// argue the rename dissolved it and quietly insert the ~90px card.
	const dashboard = source('src/pages/Dashboard.tsx');
	assert.doesNotMatch(dashboard, /<PageHeader/, '"/" is still exempt: Dashboard.tsx must not render the PageHeader card');
	assert.doesNotMatch(dashboard, /app-shell\/PageHeader/, 'and must not even import it');
	const heroAt = dashboard.indexOf('bg-[linear-gradient(145deg');
	const h1At = dashboard.indexOf('<h1');
	assert.ok(heroAt > 0, 'the gradient hero must still exist');
	assert.ok(h1At > heroAt, 'the h1 must sit inside the hero, below its gradient wrapper');
	assert.equal(h1Count(renderDashboard()), 1, 'and the page still has exactly one h1');
});

// --- 3. Item 2: STRUCTURAL ONLY — the pixel row is OWED, not decided here -----

/**
 * STRUCTURAL ONLY. This is NOT the 1366x768 measurement and must never be
 * reported as one. jsdom has no layout engine, so nothing here can observe a
 * scrollbar. What it CAN decide is whether the class chain that is supposed to
 * prevent page-level overflow is still intact — a real regression guard, and a
 * failing-first control for the fixed-height root.
 */
test('STRUCTURAL ONLY (not the 1366x768 pixel row): the Dashboard root inherits the shell height instead of hard-coding one', () => {
	// FAILING-FIRST for walkthrough item 2's structural half: on the base
	// revision the root carried `h-[calc(100svh-3.5rem)]`, a fixed height that
	// merely GUESSES the shell's available space. It happens to equal the
	// available height only while the AppShell header is exactly 3.5rem and no
	// `rolloverNotice` is mounted; when the shell adds chrome (e.g. the
	// rollover-awareness notice at AppShell.tsx:529) the fixed root is taller
	// than its `overflow-hidden` parent, so content below the fold is clipped
	// and unreachable rather than scrollable. The root now fills what the shell
	// hands it and cannot disagree with it.
	const html = renderDashboard();
	const root = /<div class="([^"]*)" data-testid="dashboard-root"/.exec(html);
	assert.ok(root, 'the Dashboard root must be addressable (data-testid="dashboard-root")');
	const rootClasses = root![1];

	assert.match(rootClasses, /\bflex\b/, 'the root is the §8 flex column');
	assert.match(rootClasses, /\bflex-col\b/);
	assert.match(rootClasses, /\bmin-h-0\b/, 'the root must be allowed to shrink below its content');
	assert.match(rootClasses, /\boverflow-hidden\b/, 'the root must never itself become a scrollbar');
	assert.match(rootClasses, /\bh-full\b/, 'the root inherits the shell height');
	assert.doesNotMatch(
		rootClasses,
		/100svh|100vh|100dvh|100lvh|h-screen|min-h-screen|max-h-screen/,
		'the Dashboard must not hard-code a viewport-derived height; the shell sizes the outlet',
	);
});

test('STRUCTURAL ONLY (not the 1366x768 pixel row): exactly one bounded, named, keyboard-reachable scroll region', () => {
	const dashboard = source('src/pages/Dashboard.tsx');
	const html = renderDashboard();

	// One scroll region, and it is the §8 shape: `flex-1 min-h-0 overflow-auto`
	// inside the no-scroll root. Two would mean nested page scrolling.
	assert.equal(
		(dashboard.match(/overflow-auto/g) ?? []).length,
		1,
		'Dashboard.tsx must declare exactly one overflow-auto region',
	);
	const region = /<div class="([^"]*)" data-testid="dashboard-scroll-region"/.exec(html);
	assert.ok(region, 'the scroll region must be addressable (data-testid="dashboard-scroll-region")');
	const regionClasses = region![1];
	assert.match(regionClasses, /\bflex-1\b/);
	assert.match(regionClasses, /\bmin-h-0\b/);
	assert.match(regionClasses, /\boverflow-auto\b/);
	// §8 + WCAG 2.1.1: a region that scrolls must be discoverable by name and
	// reachable by keyboard, or the content below the fold is mouse-only.
	assert.match(html, /data-testid="dashboard-scroll-region" role="region"/, 'the scroll region must be a labelled landmark');
	assert.match(html, /aria-label="Dashboard content"/, 'and carry an operator-facing name');
	assert.match(html, /tabindex="0"/, 'and be focusable so the keyboard can scroll it');
});

test('STRUCTURAL ONLY (not the 1366x768 pixel row): the shell outlet the Dashboard inherits really is bounded', () => {
	// The Dashboard fix is only correct because AppShell hands the outlet a
	// bounded, already-sized box. If a future shell change makes the outlet
	// unbounded, `h-full` silently becomes auto and the page WOULD scroll — so
	// this dependency is pinned rather than assumed.
	const appShell = source('src/components/AppShell.tsx');
	assert.match(
		appShell,
		/className=\{`flex-1 min-h-0 overflow-hidden/,
		'AppShell must keep sizing the outlet as flex-1 min-h-0 overflow-hidden',
	);
	assert.match(appShell, /<header className='flex h-14 shrink-0/, 'the shell header stays h-14 shrink-0');
});

test('STRUCTURAL ONLY (not the 1366x768 pixel row): no Dashboard-level element forces vertical overflow by a fixed pixel height', () => {
	// The other candidate sources named in the packet: a fixed pixel header
	// that does not shrink, or an element whose own fixed height exceeds the
	// viewport at 1366x768. Neither exists in Dashboard.tsx.
	const dashboard = source('src/pages/Dashboard.tsx');
	assert.doesNotMatch(dashboard, /\bh-\[\d{3,4}px\]/, 'no hard-coded pixel height may be introduced on this page');
	assert.doesNotMatch(dashboard, /\bmin-h-\[\d{3,4}px\]/, 'no hard-coded pixel min-height may be introduced on this page');
	// The change is presentation-only: no content, fetch or measurement moved.
	assert.match(dashboard, /Building, review, and publish the school timetable\.|Build, review, and publish the school timetable\./,
		'the hero subtitle is unchanged — no content was dropped to win the layout');
});
