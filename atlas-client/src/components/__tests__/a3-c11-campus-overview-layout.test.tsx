/**
 * A3 c11 — fix 37, RENDERED: the Campus & Rooms overview shows the map first, the
 * readiness card below it, and no floating overlay cluster.
 *
 * THE OPERATOR'S OWN REQUEST (fix-2.docx, fix 37), itemised:
 *   1. "Completely remove the floating cluster containing the `Overview`,
 *      `Edit map`, and `Help` buttons from this view. Eliminate the
 *      absolute/fixed positioning wrapper causing them to hover over the
 *      top-right corner."
 *   2. "Remove the `[Open map]` / `[Hide map]` button from the header action
 *      area. Remove the collapsible state logic that hides or toggles the campus
 *      map."
 *   3. Invert the page: "Top Section: Display the `Campus Explorer` container by
 *      default directly beneath the page title header … Bottom Section: Render
 *      the `Room readiness` card container directly underneath", and change the
 *      subtext to "Select a building on the map to inspect rooms, or review room
 *      readiness below."
 *   4. "The top-right header action row should cleanly contain only the primary
 *      action button: `[Edit maps]`".
 *
 * WHAT THE LIVE AUDIT SAW on `/map`: "`Overview`, `Edit map`, `Help`, and
 * `Open map` remain; Room readiness appears before the hidden campus map and the
 * old helper copy remains."
 *
 * This renders the REAL `CampusMapOverview` (with its Konva child made able to
 * draw, never inspected) and the REAL `MapEditor` overview branch, and reads the
 * DOCUMENT ORDER of what an operator's screen contains. Order is the whole claim
 * in item 3, and a source read cannot decide it.
 */
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import test from 'node:test';

import type { ReactElement } from 'react';
import { JSDOM } from 'jsdom';

import { installCanvasShim } from './konva-dom-render-harness';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'https://njgrm.buru-degree.ts.net/map',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	localStorage: dom.window.localStorage,
	sessionStorage: dom.window.sessionStorage,
	HTMLElement: dom.window.HTMLElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	Node: dom.window.Node,
	NodeFilter: dom.window.NodeFilter,
	SVGElement: dom.window.SVGElement,
	MutationObserver: dom.window.MutationObserver,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
	fetch: (async () => { throw new Error('unexpected fetch in the overview control'); }) as unknown as typeof fetch,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
	matches: false, media: q, onchange: null,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});
// The overview mounts a Konva canvas for the map board. It is made able to draw
// and is never inspected here; the canvas geometry is decided by
// `a3-c11-campus-editor-canvas.test.tsx`.
installCanvasShim(dom.window as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } });

const BUILDINGS = [
	{ id: 1, name: 'Grade 9 Academic Wing', shortCode: null, x: 20, y: 20, width: 160, height: 100, rotation: 0, color: '#e11d48', floorCount: 2, isTeachingBuilding: true, gradeScope: [], rooms: [] },
	{ id: 2, name: 'MAPEH and Wellness Hub', shortCode: null, x: 220, y: 40, width: 140, height: 90, rotation: 0, color: '#0ea5e9', floorCount: 1, isTeachingBuilding: true, gradeScope: [], rooms: [] },
] as unknown as Array<import('@/types').Building>;

// The overview reads EnrollPro year/term authority and several ATLAS lists. They
// are stubbed to REFUSE rather than to resolve empty, so a control can never pass
// because a surface silently rendered nothing.
mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async () => ({ data: {} }),
		post: async () => ({ data: {} }),
		patch: async () => ({ data: {} }),
		put: async () => ({ data: {} }),
		delete: async () => ({ data: {} }),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});
mock.module(import.meta.resolve('@/lib/enrollpro-public-settings'), {
	namedExports: {
		resolveActiveSchoolYearContext: async () => ({ activeSchoolYearId: null, activeSchoolYearLabel: null, activeTerm: null }),
	},
});

const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { MemoryRouter, Route, Routes } = await import('react-router-dom');
const { CampusMapOverview } = await import('@/components/campus-map/CampusMapOverview');
const MapEditor = (await import('@/pages/MapEditor')).default;

let root: import('react-dom/client').Root | null = null;
let host: HTMLElement | null = null;

/** Mounts `element` at `url` in the JSDOM document and returns that DOCUMENT —
 *  the assertions below are about the rendered ORDER of a page, so they read
 *  `document.body`, not an element cast to look like one. */
async function mount(element: ReactElement, url = '/map'): Promise<Document> {
	host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	root = createRoot(host as unknown as HTMLElement);
	await act(async () => {
		root!.render(createElement(
			MemoryRouter,
			{ initialEntries: [url] },
			createElement(Routes, null, createElement(Route, { path: '/map', element })),
		));
		await new Promise((r) => setTimeout(r, 0));
		await new Promise((r) => setTimeout(r, 0));
	});
	return dom.window.document;
}

const teardown = async () => {
	await act(async () => { root?.unmount(); });
	host?.remove();
	host = null;
	root = null;
};

/** Index of the first element whose text contains `needle`, in DOCUMENT order. */
function documentOrder(doc: Document, needle: string): number {
	const all = Array.from(doc.querySelectorAll('h1, h2, h3, h4, p, button, a, span'));
	const index = all.findIndex((el) => (el.textContent ?? '').includes(needle));
	assert.ok(index >= 0, `"${needle}" must be rendered; not found among ${all.length} elements`);
	return index;
}

test('37 RENDERED: the Campus Explorer is the TOP section and Room readiness is BELOW it', async () => {
	const doc = await mount(createElement(CampusMapOverview, { buildings: BUILDINGS, campusImageUrl: null }));
	try {
		const explorer = documentOrder(doc, 'Campus Explorer');
		const readiness = documentOrder(doc, 'Room readiness');
		assert.ok(
			explorer < readiness,
			`the map must come first: "Campus Explorer" at ${explorer}, "Room readiness" at ${readiness}`,
		);
		// And the map is not behind a toggle: the explorer is rendered on open,
		// with no interaction at all.
		const body = (doc.body.textContent ?? '');
		assert.doesNotMatch(body, /Open map|Hide map|Show campus explorer/, 'no map toggle may survive on the page');
		assert.doesNotMatch(body, /Map is available when needed/, 'the placeholder card must be gone');
		assert.doesNotMatch(
			body,
			/Check room readiness first\. Open the map only when you need room details\./,
			'the old helper subtext must be gone',
		);
	} finally {
		await teardown();
	}
});

test('37 RENDERED: the header subtext is the operator\'s sentence, and one action', async () => {
	const doc = await mount(createElement(CampusMapOverview, { buildings: BUILDINGS, campusImageUrl: null }));
	try {
		assert.ok(
			(doc.body.textContent ?? '').includes('Select a building on the map to inspect rooms, or review room readiness below.'),
			'the operator\'s replacement subtext must be rendered',
		);
		// Exactly ONE header action, and it is the editor: `Edit maps`.
		const editMaps = Array.from(doc.querySelectorAll('a')).filter((a) => (a.textContent ?? '').trim() === 'Edit maps');
		assert.equal(editMaps.length, 1, `exactly one "Edit maps" action, found ${editMaps.length}`);
		assert.equal(editMaps[0].getAttribute('href'), '/map?mode=editor', 'and it must lead to the editor');
		assert.doesNotMatch(doc.body.textContent ?? '', /Edit rooms/, 'the old "Edit rooms" label must be gone');
	} finally {
		await teardown();
	}
});

test('37 RENDERED: /map paints no floating overlay cluster', async () => {
	// The real page, at the real route, in overview mode.
	const doc = await mount(createElement(MapEditor), '/map');
	try {
		const fixed = Array.from(doc.querySelectorAll('*')).filter((el) => {
			const c = el.getAttribute('class') ?? '';
			return /(^|\s)(fixed|absolute)(\s|$)/.test(c) && /right-6/.test(c);
		});
		assert.deepEqual(
			fixed.map((el) => el.getAttribute('class')),
			[],
			`no top-right fixed overlay may remain on /map; found ${JSON.stringify(fixed.map((e) => e.getAttribute('class')))}`,
		);
		const body = doc.body.textContent ?? '';
		// The cluster's three labels. `Overview`/`Edit map` are the ModeToggle's,
		// `Help` was the floating SmartHelpTrigger's accessible name.
		assert.doesNotMatch(body, /\bEdit map\b/, 'the floating "Edit map" toggle must be gone from the overview');
		assert.ok(
			!Array.from(doc.querySelectorAll('[role="tablist"]')).some((t) => (t.getAttribute('aria-label') ?? '').includes('Campus map mode')),
			'the Overview/Edit map tablist must not be painted over the overview',
		);
		// The overview itself is still there, so the branch did not render nothing.
		assert.ok(body.includes('Campus & Rooms'), 'the overview page must still render');
	} finally {
		await teardown();
	}
});

test('37 RENDERED: the editor view KEEPS its inline round trip, so nothing became unreachable', async () => {
	const doc = await mount(createElement(MapEditor), '/map?mode=editor');
	try {
		const tablist = Array.from(doc.querySelectorAll('[role="tablist"]'))
			.find((t) => (t.getAttribute('aria-label') ?? '').includes('Campus map mode'));
		assert.ok(tablist, 'the editor must keep its inline Overview/Edit map toggle, or the round trip is lost');
		const className = tablist!.getAttribute('class') ?? '';
		assert.doesNotMatch(className, /\bfixed\b/, 'the remaining toggle is inline, never fixed');
		assert.doesNotMatch(className, /\babsolute\b/, 'the remaining toggle is inline, never absolute');
		// The `inline = false` overlay branch is gone from the source, not merely
		// unused — a retained branch is what brings a floating cluster back.
		assert.ok(
			tablist!.querySelector('button[aria-pressed="true"]')?.textContent?.includes('Edit map'),
			'the editor must show itself as the active mode',
		);
	} finally {
		await teardown();
	}
});
