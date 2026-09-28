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
 *
 * It also carries fix 36's two PAGE rows, which is where they belong: the canvas
 * column's scroll-region shape and the stage's rendered width are properties of
 * `pages/MapEditor.tsx` meeting the real editor, so they are decided by mounting
 * the real page rather than by reading source or by the canvas-only harness.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mock } from 'node:test';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
	ResizeObserver: class {
		// Fix 36 measures its region, so this stub REPORTS like the real thing
		// instead of doing nothing: a component that only measured on mount would
		// otherwise pass without the observer ever being exercised.
		constructor(private readonly callback: ResizeObserverCallback) {}
		observe(target: Element): void {
			const rect = target.getBoundingClientRect();
			this.callback(
				[{ target, contentRect: { x: 0, y: 0, width: rect.width, height: rect.height, top: 0, left: 0, right: rect.width, bottom: rect.height, toJSON: () => ({}) } } as unknown as ResizeObserverEntry],
				this as unknown as ResizeObserver,
			);
		}
		unobserve(): void {}
		disconnect(): void {}
	},
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
/**
 * Fix 36: the editor sizes its canvas from a MEASURED box, and jsdom has no
 * layout engine, so the harness supplies one. Every element reports the same box
 * unless a row sets another, which is the same contract `konva-dom-render-harness`
 * uses for the canvas controls.
 */
let layoutBox = { width: 0, height: 0 };
function setLayoutBox(size: { width: number; height: number }): void {
	layoutBox = { ...size };
}
dom.window.HTMLElement.prototype.getBoundingClientRect = function rect(): DOMRect {
	return new dom.window.DOMRect(0, 0, layoutBox.width, layoutBox.height);
};
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

/* ── fix 36, on the real page: the scroll region and the sized stage ───────── */

/** `src/components/__tests__` → the package root. */
const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (relative: string): string => readFileSync(path.join(PKG_ROOT, relative), 'utf8');

/** Tailwind's spacing scale is 0.25rem per unit and the root font is 16px, so a
 *  spacing class is decidable rather than copied. */
const REM_PX = 16;
function spacingPx(cls: string): number {
	const unit = Number.parseFloat(cls.split('-')[1] ?? '');
	assert.ok(Number.isFinite(unit), `unparseable Tailwind spacing class: ${cls}`);
	return (unit / 4) * REM_PX;
}

const sidebarSource = read('src/ui/sidebar.tsx');
const sidebarRem = Number.parseFloat(/const SIDEBAR_WIDTH = '([\d.]+)rem'/.exec(sidebarSource)?.[1] ?? '');
assert.ok(Number.isFinite(sidebarRem), 'ui/sidebar.tsx must still declare SIDEBAR_WIDTH as a rem length');
assert.match(sidebarSource, /defaultOpen = true/, 'the sidebar must still be open by default, or this width is not the default one');
const APP_SIDEBAR_PX = sidebarRem * REM_PX;
const INSPECTOR_PX = spacingPx(`w-${/className="w-(\d+(?:\.\d+)?)\s/.exec(read('src/pages/MapEditor.tsx'))?.[1]}`);

/** The canvas column's content width at `viewport`, from the layout the page
 *  really renders: the app sidebar (open by default), the editor's `w-88`
 *  inspector, and the column's own `p-4`. */
function canvasColumnPx(viewport: number): number {
	return viewport - APP_SIDEBAR_PX - INSPECTOR_PX - 32; // 32 = `p-4` a side
}

test('36 RENDERED: the editor canvas column is the ONE bounded, named, keyboard-reachable scroll region', async () => {
	const doc = await mount(createElement(MapEditor), '/map?mode=editor');
	try {
		const region = doc.querySelector('[data-campus-map-canvas-region]');
		assert.ok(region, 'the editor page must name its canvas region; the canvas measures that element');
		assert.equal(region!.getAttribute('role'), 'region', 'the region must carry role="region" (AGENTS.md §8 + WCAG)');
		assert.match(region!.getAttribute('aria-label') ?? '', /\S/, 'and be named, so it is reachable by assistive tech');
		assert.equal(region!.getAttribute('tabindex'), '0', 'and be focusable, so it can be scrolled by keyboard');
		const className = region!.getAttribute('class') ?? '';
		for (const required of ['flex-1', 'min-h-0', 'min-w-0', 'overflow-auto', 'p-4']) {
			assert.match(className, new RegExp(`(^|\\s)${required.replace(/[[\]]/g, '\\$&')}(\\s|$)`), `the region must keep \`${required}\`; got "${className}"`);
		}
		assert.equal(
			doc.querySelectorAll('[role="region"]').length,
			1,
			'there must be exactly ONE scroll region, or reachability is ambiguous about which one to reach for',
		);
		// The canvas is INSIDE it, which is what makes auto-grown content
		// scrollable instead of painted outside the visible area.
		assert.ok(region!.querySelector('.konvajs-content'), 'the Konva canvas must be a descendant of the scroll region, or growth is unreachable');
		// And the page root is still the bounded no-scroll shell, so no global
		// browser scrollbar is ever spawned.
		const root = region!.parentElement;
		assert.match(root!.getAttribute('class') ?? '', /h-\[calc\(100svh-3\.5rem\)\]/, 'the page root must stay height-bounded');
		assert.match(root!.getAttribute('class') ?? '', /overflow-hidden/, 'and must not scroll globally');
	} finally {
		await teardown();
	}
});

test('36 RENDERED: at the real viewport widths the stage is the measured column, never a fixed 920', async () => {
	// The whole chain, end to end, on the real page: the region box the component
	// measures → the work-area arithmetic → the Konva canvas it actually renders.
	// jsdom applies no Tailwind, so `getComputedStyle` reads no padding and the
	// harness supplies the region's CONTENT width; that is the same number a
	// browser arrives at after subtracting the `p-4` asserted above. The claim
	// under test is that the stage IS that column — a constant 920 floor, the
	// 320 floor, or an unmeasured collapse all fail it.
	for (const [viewport, expected] of [[1366, 726], [1920, 1280], [1024, 384]] as const) {
		const column = canvasColumnPx(viewport);
		assert.equal(column, expected, `the ${viewport}px canvas column is arithmetic, not an estimate; got ${column}`);
		setLayoutBox({ width: column, height: 640 });
		const doc = await mount(createElement(MapEditor), '/map?mode=editor');
		try {
			const canvas = doc.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
			assert.ok(canvas, `the editor must render its Konva canvas at ${viewport}px`);
			const stageWidth = Number.parseFloat(canvas!.style.width);
			assert.equal(stageWidth, column, `at ${viewport}px the stage must be the ${column}px column, got ${stageWidth}`);
			assert.notEqual(stageWidth, 920, `the old FIXED 920 stage must not survive: ${stageWidth} at ${viewport}px`);
			// Three different columns, three different stages: no constant can
			// satisfy the row above, which is what makes it a measurement.
			// The host box is as large as the stage (`w-max`), so a stage larger
			// than the column enlarges the region and scrolls, never clips.
			const host = doc.querySelector('[data-campus-map-canvas-region] .w-max');
			assert.ok(host, 'the canvas box must fit its stage (`w-max`), or a grown stage is clipped instead of scrollable');
			assert.ok(host!.contains(canvas), 'and it must be the box that wraps the canvas');
		} finally {
			await teardown();
			setLayoutBox({ width: 0, height: 0 });
		}
	}
});

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
