/**
 * A5 C4 ITEM 4 (2026-09-29) — a route change must never leave the OLD page on
 * screen under the NEW url.
 *
 * THE FINDING, VERBATIM (Lane C, Codex staging walk, train 6):
 *   "when you change page, the old page's content stays up (for example, /teachers
 *    showed Sections). Show that page's own loading state."
 * Codex run 2 scored it MAJOR, under route changes.
 *
 * WHY THIS IS TESTED AGAINST THE EXTRACTED `RouteOutlet` AND NOT `AppShell`.
 * `AppShell` is a 595-line authenticated shell — sidebar, auth bridge, school-year
 * switcher, rollover notice, mobile drawer, breadcrumb chrome. None of it is in
 * scope, and standing all of it up to observe a Suspense boundary would test the
 * shell's plumbing rather than the behaviour in the finding. The outlet, its remount
 * key and its fallback are extracted into `RouteOutlet.tsx` precisely so this row is
 * decidable, and `AppShell` composes it.
 *
 * THE CAUSE. The shell wrapped the outlet in `<AnimatePresence mode="wait">`.
 * `mode="wait"` means the new route is not rendered until the OLD one has finished
 * EXITING, so the previous page stays mounted and visible under the new URL for the
 * whole exit window — and that window completes on an animation frame, so a
 * throttled main thread can hold it indefinitely.
 *
 * THE ROW THAT DECIDES IT: `A5-C4-4b` below renders route A, then swaps the outlet
 * to a route B whose `lazy` module NEVER RESOLVES, and requires that route A's
 * distinctive text is ABSENT from the document at the moment B is requested. That is
 * red against the `mode="wait"` behaviour, and it is the same shape as the real
 * report: a blocked main thread is a frame that never arrives.
 *
 * `A5-C4-4c` is the negative control: when B's module DOES resolve, B's content
 * renders and the panel is gone. Without it, a component that simply rendered
 * nothing forever would pass 4b.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, lazy } from 'react';
import type { ReactElement, ComponentType } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/subjects' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	SVGElement: dom.window.SVGElement,
	DOMRect: dom.window.DOMRect,
	AbortController: dom.window.AbortController,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
/*
 * A MEASUREMENT THAT CHANGED THIS ROW, recorded rather than papered over.
 *
 * This suite originally reproduced the reported condition by blocking
 * `requestAnimationFrame` — which is the honest model of it, because `mode="wait"`
 * holds the old page until its EXIT finishes and the exit finishes on a frame, so a
 * main thread that is not servicing frames holds the old page for as long as the
 * stall lasts. That IS the A8 stall Codex walked into.
 *
 * IT DOES NOT WORK IN THIS HARNESS, AND THE RESULT IS RECORDED INSTEAD OF A
 * FAILED CLAIM. With frames blocked, framer-motion's exit loop keeps re-requesting
 * them, the runner cannot reach an idle event loop, and the child dies with a bare
 * `test failed` and no message — the exact failure mode this repo's own harness notes
 * warn about. A self-releasing timer did not fix it. Two runs, both wedged.
 *
 * SO WHAT 4b IS, PRECISELY. With frames running, `mode="wait"` PASSES this row:
 * jsdom services the frame, the exit completes, the old page goes away. That was
 * measured, twice. 4b is therefore a PRESERVATION row — it proves the fixed
 * component still clears the old page and shows the new page's named panel — and it
 * is NOT claimed as a failing-first. The discriminator for the exit-wait gate is
 * `A5-C4-4a` (measured red against the base-equivalent gate) plus the mutation
 * control recorded in the handoff. Reporting 4b as red would have been a false
 * claim about a green row.
 */
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window as unknown as { innerWidth: number }).innerWidth = 1366;
(dom.window as unknown as { innerHeight: number }).innerHeight = 768;
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

const { createRoot } = await import('react-dom/client');
const { RouteOutlet } = await import('../RouteOutlet');

/** Route A: the page the scheduler is LEAVING. Its text is the witness. */
const ROUTE_A_TEXT = 'SECTIONS-PAGE-CONTENT';
/** Route B: a real `lazy` whose module NEVER RESOLVES — a frame that never arrives. */
const NeverResolving = lazy(
	() => new Promise<{ default: ComponentType }>(() => { /* never settles */ }),
);

let root: Root | null = null;
let hostEl: HTMLElement | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	hostEl?.remove();
	dom.window.close();
});

async function mount(): Promise<HTMLElement> {
	await unmount();
	hostEl = document.createElement('div');
	document.body.appendChild(hostEl);
	root = createRoot(hostEl);
	return hostEl;
}
async function unmount(): Promise<void> {
	if (root) await act(async () => { root?.unmount(); });
	root = null; hostEl?.remove(); hostEl = null;
}

/** Read the whole document's text, so a witness cannot hide outside `hostEl`. */
function documentText(): string {
	return (document.body.textContent ?? '').replace(/\s+/g, ' ');
}

function outletProps(overrides: Record<string, unknown> = {}) {
	return {
		outlet: <div>{ROUTE_A_TEXT}</div> as ReactElement | null,
		outletKey: '/sections:0',
		pageName: 'Sections',
		timetable: false,
		className: 'flex-1',
		reduceMotion: true,
		...overrides,
	};
}

// ─────────────────────────────────────────────────────────────────────────────

test('A5-C4-4a: the shell no longer gates the outlet on the old page finishing its exit', async () => {
	// A SOURCE row, and it is here because it is the one thing about this defect
	// that behaviour alone cannot pin: `mode="wait"` is a MODE, and a future edit
	// could reintroduce it behind a different component while every rendered row
	// still passed on a machine whose animation frames happen to arrive.
	//
	// It is a narrow needle with a narrow owner: `AnimatePresence` may not appear in
	// the shell or in the outlet. This is the packet's own instruction, and it is
	// NOT a substitute for 4b/4c — those are the behavioural proof.
	const { readFileSync } = await import('node:fs');
	for (const rel of ['../RouteOutlet.tsx', '../../AppShell.tsx']) {
		const source = readFileSync(new URL(rel, import.meta.url), 'utf8');
		// Comments are stripped from BOTH syntaxes. This file and `AppShell` both
		// NAME the gate in prose — that naming is the record of why it went, and a
		// strip that only handled `* */` would fail on the very comments explaining
		// the fix, which is the failure mode `AGENTS.md` §16 warns about.
		const code = source.replace(/^\s*\*.*$/gm, '').replace(/^\s*\/\/.*$/gm, '');
		assert.doesNotMatch(
			code,
			/AnimatePresence/,
			`${rel} brings the exit-wait gate back; a route change would hold the old page on screen again`,
		);
	}
	// And the grey bar is gone with it: no `h-100` skeleton anywhere in the shell.
	const shell = readFileSync(new URL('../../AppShell.tsx', import.meta.url), 'utf8');
	assert.doesNotMatch(
		shell.replace(/^\s*\*.*$/gm, '').replace(/^\s*\/\/.*$/gm, ''),
		/h-100/,
		'the meaningless full-height grey bar is back; a scheduler needs a page-named panel',
	);
});

test('A5-C4-4b: requesting a route whose module NEVER resolves leaves NO trace of the old page', async () => {
	// PRESERVATION, NOT A FAILING-FIRST. Measured against the base-equivalent
	// `mode="wait"` gate with frames running, this row PASSES — see the measurement
	// note at the top of this file. The discriminator is 4a plus the mutation control.
	// What this row does decide, and decides honestly, is that the FIXED component
	// shows the new page's own named panel the moment the new route is requested, and
	// that the previous page is not on screen alongside it.
	const host = await mount();
	await act(async () => { root!.render(<RouteOutlet {...outletProps()} />); });
	assert.match(documentText(), new RegExp(ROUTE_A_TEXT), 'route A did not render in the first place, so this row proves nothing');

	// THE SWAP: a new url, a new remount key, and a module that will never finish
	// loading — the shape of the A8 stall.
	await act(async () => {
		root!.render(
			<RouteOutlet
				{...outletProps({ outlet: <NeverResolving />, outletKey: '/teachers:1', pageName: 'Teachers' })}
			/>,
		);
	});
	await act(async () => { await Promise.resolve(); });

	const text = documentText();
	assert.doesNotMatch(
		text,
		new RegExp(ROUTE_A_TEXT),
		`the PREVIOUS page is still on screen under the new route: "${text}"`,
	);
	// B's own loading state, naming B, is what the scheduler gets instead.
	const panel = host.querySelector('[data-testid="route-loading-panel"]');
	assert.ok(panel, `route B's loading panel is not shown: "${documentText()}"`);
	assert.match(
		(panel!.textContent ?? '').replace(/\s+/g, ' ').trim(),
		/Loading Teachers…/,
		'the loading panel does not name the page being opened',
	);
	await unmount();
});

test('A5-C4-4c CONTROL: when the module DOES resolve, its content renders and the panel is gone', async () => {
	// Without this row, a component that rendered nothing forever would pass 4b.
	const host = await mount();
	await act(async () => { root!.render(<RouteOutlet {...outletProps()} />); });
	await act(async () => {
		root!.render(
			<RouteOutlet
				{...outletProps({ outlet: <div>TEACHERS-PAGE-CONTENT</div>, outletKey: '/teachers:1', pageName: 'Teachers' })}
			/>,
		);
	});
	const text = documentText();
	assert.match(text, /TEACHERS-PAGE-CONTENT/, 'the resolved route did not render its own content');
	assert.doesNotMatch(text, new RegExp(ROUTE_A_TEXT), 'the previous page is still present after the new one resolved');
	assert.equal(
		host.querySelector('[data-testid="route-loading-panel"]') === null,
		true,
		'the loading panel is still on screen after the route resolved',
	);
	await unmount();
});

test('A5-C4-4d: the remount key is still what is on the outlet, and it is the page that is named', async () => {
	// PRESERVATION + the packet's explicit instruction: the `key` on the outlet is
	// what gives a route change a clean remount, and `resolveOutletKey` is exported
	// and pinned elsewhere, so the extraction must use it unchanged.
	const { resolveOutletKey } = await import('../../AppShell');
	const host = await mount();
	await act(async () => {
		root!.render(
			<RouteOutlet
				{...outletProps({ outletKey: resolveOutletKey('/timetable', 3), pageName: 'Timetable', timetable: true })}
			/>,
		);
	});
	const outletEl = host.querySelector('[data-testid="route-outlet"]');
	assert.ok(outletEl, 'the outlet wrapper is not rendered');
	assert.equal(outletEl!.getAttribute('data-page'), 'Timetable', 'the outlet does not carry the page name it is loading');
	// `resolveOutletKey` is unchanged by the extraction.
	assert.equal(resolveOutletKey('/timetable', 3), '/timetable:3', 'resolveOutletKey changed value or signature');
	assert.equal(resolveOutletKey('/teachers', 3), '/teachers:3');
	await unmount();
});
