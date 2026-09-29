/**
 * A5 cycle c6 — the two NEW shared-primitive contracts, as CLASS CONTRACTS.
 *
 * ============================ WHAT THIS IS NOT =============================
 *
 * This file is NOT acceptance evidence. It asserts CLASS LISTS and a PURE
 * CLAMP FUNCTION. A green run here proves the primitives were written the way
 * this cycle specified them; it does NOT prove the operator can see a wrapped
 * tooltip or drag a dialog wider. Those are rendered measurements and they
 * belong to the planner's screenshots against real staging data (AGENTS.md
 * "Done means seen"). A class-contract control is a floor, never a substitute.
 *
 * ============================== WHY IT IS HERE =============================
 *
 * Two new contracts landed on shared primitives — the tooltip WRAP contract
 * (item 35.1) and the dialog `resizable` prop with its clamps (item 23.2). Both
 * are load-bearing for every consumer, both are invisible in a diff review of
 * any single page, and both were previously duplicated as per-call-site class
 * lists. That is the combination this file closes: the promise lives in ONE
 * place, so the promise is asserted in ONE place.
 *
 * ============================== THE CONTROLS ===============================
 *
 * A5-35.1-C1  the shared tooltip WRAPS (and no longer forces `nowrap`).
 * A5-35.1-C2  MUTANT: a `whitespace-nowrap` bubble is REJECTED, so C1 is not
 *             vacuous — this is the control that makes C1 discriminate.
 * A5-35.1-C3  the `/teachers` quick-filter helpers are the real sentences that
 *             were being clipped, and each is longer than the narrow cap, so
 *             wrapping is the only way to read them.
 * A7C10-C1     the shared tooltip is a WHITE bubble: white surface token, dark
 *             text token, a border and a shadow for the edge, 15px type, and no
 *             dark surface by any spelling (operator, 2026-09-29: "Why on earth
 *             are the tooltips black? Why is it not just white with a shadowed
 *             background?").
 * A7C10-C2     the width cap is the operator's ~22rem, and the previous 24rem
 *             desktop cap is rejected as too wide.
 * A5-23.2-C1  `clampDialogResizeWidthPx` — the pure width decision, at 1366
 *             and on a phone.
 * A5-23.2-C2  MUTANT: a mutated clamp (no 95vw ceiling) is caught, so C1 is
 *             load-bearing.
 * A5-23.2-C3  the `resizable` DEFAULT is true for a data/form dialog and
 *             FORCED false for a confirm, rendered.
 * A5-23.2-C4  the two drag handles are visible, pointer-driven and OUT of the
 *             tab order; the close button survives them.
 * A5-23.2-C5  centring is the flex parent, not the translate anchor.
 * A5-23.2-C6  the AUDIT ROW: every confirm/alert `DialogContent` in the app
 *             says `resizable={false}`, so none of them can silently become a
 *             draggable 95vw panel.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { JSDOM } from 'jsdom';

// --- jsdom bootstrap (the accepted pattern in this repo) --------------------
const require = createRequire(import.meta.url);
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://127.0.0.1/' });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
// `navigator` is a getter-only global on modern Node, so it must be defined
// rather than assigned (the accepted pattern in the sibling faculty suites).
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement;
g.SVGElement = dom.window.SVGElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.Event = dom.window.Event;
// Radix's dismissable layer and focus scope synthesise `CustomEvent`s. Without
// this the global Node `CustomEvent` is used, which JSDOM's `dispatchEvent`
// rejects — a harness error that would look like a product error.
g.CustomEvent = dom.window.CustomEvent;
g.NodeFilter = dom.window.NodeFilter;
g.HTMLCollection = dom.window.HTMLCollection;
g.getComputedStyle = dom.window.getComputedStyle;
// Radix's focus scope observes the content subtree for a focus trap, so a dialog
// cannot mount in JSDOM without it. No-op: the controls below assert class
// contracts, attributes and the pointer path, never focus movement.
g.MutationObserver = class {
	observe() {}
	disconnect() {}
	takeRecords() { return []; }
};
dom.window.MutationObserver = g.MutationObserver as never;
g.DOMRect = dom.window.DOMRect;

/**
 * Pass every JSDOM window global that Node does not already define.
 *
 * Radix's focus scope reaches for `MutationObserver`, `NodeFilter`,
 * `HTMLInputElement` and friends by bare global name, so each missing one is a
 * hard `ReferenceError` at mount — a harness fault that reads exactly like a
 * product fault. Copying the constructors in one place is the honest fix: the
 * controls below then fail for a real reason or not at all.
 */
for (const key of Object.getOwnPropertyNames(dom.window)) {
	if (key in globalThis) continue;
	if (!/^(HTML|SVG|CSS|Node|Element|Event|Keyboard|Mouse|Pointer|Focus|Selection|Abort|Composition|Drag|Touch|Input|Range|Text|Custom)/.test(key)) continue;
	try {
		Object.defineProperty(globalThis, key, {
			value: (dom.window as unknown as Record<string, unknown>)[key],
			configurable: true,
			writable: true,
		});
	} catch {
		// A non-configurable Node global: leave it alone rather than crash the harness.
	}
}
g.requestAnimationFrame = (cb: FrameRequestCallback) => dom.window.setTimeout(() => cb(0), 0);
g.cancelAnimationFrame = (id: number) => dom.window.clearTimeout(id);
g.IS_REACT_ACT_ENVIRONMENT = true;
class RO {
	observe() {}
	unobserve() {}
	disconnect() {}
}
g.ResizeObserver = RO;
dom.window.matchMedia = ((q: string) => ({
	matches: false, media: q, onchange: null,
	addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
	dispatchEvent: () => false,
})) as unknown as typeof dom.window.matchMedia;
// JSDOM has no layout, so `getBoundingClientRect` is all zeros. The clamp tests
// below are PURE and need no layout; the handle tests need only the event path.

const { act } = await import('react');
const React = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
void require; // keep the require binding for tooling parity with sibling suites

const SRC = (rel: string) =>
	readFileSync(new URL(rel, `file:///${process.cwd().replace(/\\/g, '/')}/src/`), 'utf8');

/**
 * Source with comments removed.
 *
 * The audit below reads source TEXT, and these files carry long explanatory
 * comments that NAME the patterns they removed (`style={{ resize: 'both' }}`).
 * Counting a comment as code would make the audit report a defect that was
 * deliberately deleted — and would train a reader to distrust it. So the
 * audit reads code, and the comments stay in the file.
 */
function SRC_CODE(rel: string): string {
	return SRC(rel)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function hasClass(el: Element, token: string): boolean {
	return (el.getAttribute('class') ?? '').split(/\s+/).includes(token);
}

// ===========================================================================
// A5 item 35.1 — the shared tooltip WRAPS.
// ===========================================================================

const tooltipSource = SRC('ui/tooltip.tsx');

test('A5-35.1-C1 the shared tooltip carries the WRAP contract, and no longer forces nowrap', () => {
	// The wrap contract the operator asked for, verbatim.
	// SUPERSEDED 2026-09-29 (A7 c10): the cap token moved from
	// `max-w-xs md:max-w-sm` (20rem / 24rem) to `max-w-[22rem]`, the operator's
	// "about 22rem". The old tokens are NOT re-added below; A7C10-C2 is the
	// replacement assertion, and A5-35.1-C2 below now proves the previous
	// desktop value (24rem) is rejected as too wide.
	for (const token of ['w-max', 'max-w-[22rem]', 'whitespace-normal', 'break-words', 'leading-normal']) {
		assert.ok(
			tooltipSource.includes(token),
			`src/ui/tooltip.tsx is missing the wrap token "${token}"`,
		);
	}
	// The class list itself must not still force a single line. This is the
	// assertion that distinguishes item 35.1 from the list it replaced.
	const classList = /className=\{cn\(\s*'([^']*)'/.exec(tooltipSource)?.[1] ?? '';
	assert.ok(classList.length > 0, 'could not read the shared TooltipContent class list');
	assert.equal(
		/(?:^|\s)whitespace-nowrap(?:\s|$)/.test(classList),
		false,
		'the shared tooltip class list still forces whitespace-nowrap, so a long sentence is clipped again',
	);
	assert.match(classList, /\bwhitespace-normal\b/);
	// The portal and z-50 stay: they are the fix for items 34/35 clipping inside
	// `AdminTableShell`, and the file's own header says so. Losing them here
	// would bring item 34 straight back.
	assert.match(tooltipSource, /TooltipPrimitive\.Portal/, 'the tooltip portal was removed; item 34 comes straight back');
	assert.match(classList, /\bz-50\b/, 'the tooltip must keep z-50');
	// The collision padding the packet named.
	assert.match(tooltipSource, /sideOffset = 8/, 'the shared tooltip collision padding must default to 8');
});

// ===========================================================================
// A7 C10 (operator, 2026-09-29) — "Why on earth are the tooltips black? Why is
// it not just white with a shadowed background?" The primitive is WHITE now.
// ===========================================================================

test('A7C10-C1 the shared tooltip renders a WHITE bubble with a dark text, an edge, and 15px type', () => {
	const classList = /className=\{cn\(\s*'([^']*)'/.exec(tooltipSource)?.[1] ?? '';
	assert.ok(classList.length > 0, 'could not read the shared TooltipContent class list');

	// The surface and its text, on the app's own tokens (index.css: `--popover:
	// 0 0% 100%`, `--popover-foreground: 222 47% 11%`).
	assert.match(classList, /\bbg-popover\b/, 'the tooltip surface is not the white app token');
	assert.match(classList, /\btext-popover-foreground\b/, 'the tooltip text is not the app dark-foreground token');

	// THE EDGE IS WHAT MAKES WHITE SAFE. The 2026-09-28 "blank white pill" report
	// was an edge problem, not a lightness problem, and the fix for an edge is a
	// border and a shadow — see the file's own history paragraph.
	assert.match(classList, /\bborder\b/, 'the white bubble has no border, so it is invisible on a white surface again');
	assert.match(classList, /\bborder-border\b/, 'the tooltip border is not the app border token');
	assert.match(classList, /\bshadow-md\b/, 'the white bubble has no shadow to lift it off the surface');

	// The size. `text-sm` is `0.9375rem` (15px) in this design system; the
	// operator's floor is "nothing under 14px".
	assert.match(classList, /\btext-sm\b/, 'the tooltip is not on the app 15px step');
	assert.equal(
		/(?:^|\s)text-xs(?:\s|$)/.test(classList),
		false,
		'the primitive still sets its own text-xs; size belongs on the one primitive',
	);

	// NO dark surface may come back on the primitive, by any spelling.
	for (const forbidden of ['bg-slate-900', 'bg-slate-8', 'bg-slate-950', 'text-white', 'text-slate-100', 'dark:bg', 'dark:text', 'shadow-none']) {
		assert.equal(
			classList.includes(forbidden),
			false,
			`the shared tooltip re-introduces "${forbidden}", so the bubble goes black or loses its edge again`,
		);
	}

	// The file's doc comment must not still claim the dark palette is standard.
	assert.equal(
		/application standard dark tooltip style/.test(tooltipSource),
		false,
		'the doc comment still claims the dark palette is the application standard; the operator has ruled white correct',
	);
});

test('A7C10-C2 the width cap is the operator\'s ~22rem, and the previous 24rem desktop cap is rejected', () => {
	const classList = /className=\{cn\(\s*'([^']*)'/.exec(tooltipSource)?.[1] ?? '';
	assert.ok(classList.includes('max-w-[22rem]'), 'the tooltip width cap is not 22rem');
	for (const tooWide of ['md:max-w-sm', 'md:max-w-md', 'max-w-lg', 'max-w-xl']) {
		assert.equal(
			classList.includes(tooWide),
			false,
			`the tooltip cap still carries "${tooWide}", which is wider than the ~22rem the operator asked for`,
		);
	}
});

// ===========================================================================
// A5-35.1 — MUTANT CONTROL. Without this row, C1 asserts nothing.
// ===========================================================================

test('A5-35.1-C2 MUTANT: a whitespace-nowrap tooltip is REJECTED by C1\'s predicate, so C1 is not vacuous', () => {
	// Two mutants, both real historical class lists for this primitive.
	//
	// SUPERSEDED 2026-09-29 (A7 c10). These two lists used to be the REQUIRED
	// set, which meant the dark palette was asserted as load-bearing by two
	// mutant controls. The operator ruled white correct, so the required set is
	// now the white contract below. The two historical strings are KEPT, and
	// their role is INVERTED: they are now the mutants that must be REJECTED.
	// Nothing here was deleted to make a test pass — the old lists are still in
	// this file, asserted from the other direction.
	const MUTANTS = [
		// The pre-item-35.1 dark list: correct geometry, forced onto one line.
		'z-50 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-md whitespace-nowrap pointer-events-none animate-in',
		// The pre-item-34 list: the white pill on a white card, with no edge.
		'z-[9999] overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in',
	];
	// The A7 c10 contract: white surface, dark text, a visible edge, 15px type,
	// and the operator's ~22rem cap.
	const REQUIRED = ['z-50', 'bg-popover', 'text-popover-foreground', 'border', 'border-border', 'font-medium', 'text-sm', 'px-2.5', 'py-1', 'rounded-md', 'shadow-md', 'pointer-events-none', 'w-max', 'max-w-[22rem]', 'whitespace-normal', 'break-words', 'leading-normal'];
	const missing = (className: string) => {
		const tokens = className.split(/\s+/).filter(Boolean);
		return REQUIRED.filter((token) => !tokens.includes(token));
	};
	const nowrapMutant = missing(MUTANTS[0]!);
	assert.ok(
		nowrapMutant.includes('whitespace-normal'),
		'MUTANT CONTROL DID NOT FIRE: re-adding whitespace-nowrap still passes, so the wrap contract is decoration',
	);
	// INVERTED ROW: the list that was "the standard" until 2026-09-29 is now a
	// REJECTED mutant. This is the control that proves the white contract
	// discriminates and is not a rename of the dark one.
	for (const token of ['bg-popover', 'text-popover-foreground', 'border-border', 'text-sm', 'max-w-[22rem]']) {
		assert.ok(
			missing(MUTANTS[0]!).includes(token),
			`MUTANT CONTROL DID NOT FIRE: the superseded dark list still passes for "${token}", so the white contract is not load-bearing`,
		);
	}
	// And the pre-item-34 white pill is still rejected — and it is rejected for
	// the reason that matters now: no edge, not "it is too light".
	assert.ok(missing(MUTANTS[1]!).length > 0, 'the white-pill list passes, so the style check is not load-bearing');
	for (const token of ['border-border', 'shadow-md', 'z-50', 'w-max', 'max-w-[22rem]', 'whitespace-normal', 'break-words', 'leading-normal']) {
		assert.ok(
			missing(MUTANTS[1]!).includes(token),
			`MUTANT CONTROL DID NOT FIRE: the white-pill list must be rejected for "${token}", not merely for cosmetics`,
		);
	}

	// And the LIVE class list passes the same predicate — same predicate,
	// opposite outcome. A predicate that rejects everything is not a control.
	const live = /className=\{cn\(\s*'([^']*)'/.exec(tooltipSource)?.[1] ?? '';
	assert.deepEqual(missing(live), [], 'the live tooltip class list does not carry the full contract');
});

// ===========================================================================
// A5-35.1 — the sentences that were actually being clipped.
// ===========================================================================

test('A5-35.1-C3 the five /teachers quick-filter helpers are real sentences, each wider than the narrow cap', () => {
	const page = SRC('pages/Faculty.tsx');
	const helpers = [
		'Active teachers with no subject assigned in Teaching Load.',
		'Active teachers above the 40h weekly maximum. Move classes before generating.',
		'Active teachers with no section assigned yet.',
		'Placeholder records for teachers who have not been hired yet. Replace before publishing.',
		'Clear the attention filter and show every teacher.',
	];
	const labels = [
		'No subjects assigned',
		'Above weekly max',
		'No sections assigned',
		'Temporary teachers',
		'All teachers',
	];
	for (const helper of helpers) {
		assert.ok(page.includes(helper), `the helper sentence is gone from pages/Faculty.tsx: ${helper}`);
		assert.ok(
			helper.length > 24,
			`"${helper}" is too short to be the sentence that was clipped; the fixture would not discriminate`,
		);
	}
	for (const label of labels) {
		assert.ok(page.includes(label), `the quick-filter pill label is gone from pages/Faculty.tsx: ${label}`);
	}
	// All five helpers are attached to those five pills, so "the pill the operator
	// hovers" and "the sentence the operator cannot read" are the same surface.
	assert.equal(
		(page.match(/helper: '/g) ?? []).length >= 5,
		true,
		'the quick-filter chips no longer carry helper sentences for the tooltips to show',
	);
});

// ===========================================================================
// A5 item 23.2 — the resizable data/form dialog contract.
// ===========================================================================

const dialog = await import('@/ui/dialog');
const {
	DIALOG_RESIZE_MIN_WIDTH_PX,
	DIALOG_RESIZE_MAX_WIDTH_VW,
	DIALOG_RESIZE_MAX_HEIGHT_VH,
	DIALOG_CONFIRM_MAX_WIDTH_CLASS,
	DIALOG_RESIZABLE_CLASSES,
	DIALOG_COMPACT_CLASSES,
	DIALOG_RESIZE_HANDLE_TESTID,
	clampDialogResizeWidthPx,
	dialogResizeMinWidthPx,
} = dialog;

test('A5-23.2-C1 the width clamp is the operator\'s bound, and it is pure', () => {
	assert.equal(DIALOG_RESIZE_MIN_WIDTH_PX, 480, 'the requested minimum width is 480px');
	assert.equal(DIALOG_RESIZE_MAX_WIDTH_VW, 95, 'the requested maximum width is 95vw');
	assert.equal(DIALOG_RESIZE_MAX_HEIGHT_VH, 85, 'the requested maximum height is 85vh');
	assert.equal(DIALOG_CONFIRM_MAX_WIDTH_CLASS, 'max-w-md', 'a confirm dialog stays compact at max-w-md');

	// 1366, the width the operator reported at. `95vw` of 1366 is 1297.7px, and
	// a CSS pixel width must be a whole number, so the expected ceiling is
	// rounded — the control pins the ROUNDING too, because an unrounded width
	// written straight to `style.width` is silently dropped by the browser.
	const ceilingAt1366 = Math.round((1366 * 95) / 100);
	assert.equal(clampDialogResizeWidthPx(400, 1366), 480, 'a drag below the floor must clamp up to 480');
	assert.equal(clampDialogResizeWidthPx(900, 1366), 900, 'an in-range drag must pass through untouched');
	assert.equal(clampDialogResizeWidthPx(2000, 1366), ceilingAt1366, 'a drag past 95vw must clamp to the ceiling');
	assert.equal(clampDialogResizeWidthPx(Number.POSITIVE_INFINITY, 1366), 480, 'a non-finite width must not become NaN');
	assert.equal(clampDialogResizeWidthPx(Number.NaN, 1366), 480, 'a NaN width must not collapse the dialog');
	assert.equal(clampDialogResizeWidthPx(2000, 1366) % 1, 0, 'the clamped width must be a whole number of CSS pixels');

	// The class contract carries the same numbers, so the CSS and the drag
	// handler cannot disagree about what "480" means.
	for (const token of ['min-w-[min(480px,95vw)]', 'max-w-[95vw]', 'max-h-[85vh]']) {
		assert.ok(DIALOG_RESIZABLE_CLASSES.includes(token), `the resizable class contract is missing "${token}"`);
	}
	assert.ok(DIALOG_COMPACT_CLASSES.includes('max-w-md'), 'the compact class contract must hold a confirm at max-w-md');

	// A phone: the 480px floor DEGRADES to the viewport rather than forcing a
	// horizontal scrollbar, which is the AGENTS.md §8 no-scroll rule. This is
	// the documented, deliberate deviation from the literal `min-w-[480px]`.
	const ceilingAt390 = Math.round((390 * 95) / 100);
	assert.equal(dialogResizeMinWidthPx(390), ceilingAt390, 'a 390px viewport must not be forced to a 480px dialog');
	assert.equal(dialogResizeMinWidthPx(1366), 480, 'a desktop viewport keeps the requested 480px floor');
	assert.ok(
		DIALOG_RESIZABLE_CLASSES.includes('min-w-[min(480px,95vw)]'),
		'the class contract must carry the viewport-guarded floor, not a bare min-w-[480px]',
	);
});

test('A5-23.2-C2 MUTANT: an unclamped width is caught, so C1 is not vacuous', () => {
	// The mutant is the naive implementation the packet wording invites: honour
	// the 480px floor and ignore the viewport. On a 390px phone it produces a
	// 480px dialog and a 90px horizontal scrollbar.
	const naive = (requested: number, viewport: number) => Math.max(480, requested);
	assert.equal(naive(400, 1366), 480, 'precondition: the naive clamp agrees on desktop');
	assert.equal(naive(480, 390), 480, 'MUTANT CONTROL DID NOT FIRE: the naive clamp already behaved');
	const real = clampDialogResizeWidthPx(480, 390);
	assert.ok(
		real < 480,
		`MUTANT CONTROL DID NOT FIRE: the real clamp returned ${real}px on a 390px viewport, the same as the mutant`,
	);
	assert.equal(real, Math.round((390 * 95) / 100));

	// The second mutant: no 95vw ceiling.
	const noCeiling = (requested: number) => Math.max(480, requested);
	assert.equal(noCeiling(2000), 2000, 'precondition: without a ceiling an over-wide drag passes through');
	assert.equal(clampDialogResizeWidthPx(2000, 1366), Math.round((1366 * 95) / 100), 'a 2000px drag at 1366 must be clamped to 95vw');
});

// ===========================================================================
// A5-23.2 — the prop, rendered.
// ===========================================================================

/**
 * Render one `DialogContent` and return its element plus the wrapper.
 *
 * Radix portals the content onto `document.body`, so the element is NOT inside
 * the returned container — reading the container and finding nothing is a wrong
 * lookup, not a missing dialog. The PREVIOUS root is unmounted first, or a
 * query for `[role="dialog"]` would find the dialog an earlier test left open
 * and every assertion after it would be about the wrong element.
 */
let currentRoot: { unmount: () => void; render: (node: React.ReactNode) => void } | null = null;

function renderDialogContent(props: Record<string, unknown>): { el: HTMLElement; wrapper: HTMLElement } {
	if (currentRoot) {
		act(() => currentRoot!.unmount());
		currentRoot = null;
	}
	const { createRoot } = require('react-dom/client');
	const container = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(container);
	currentRoot = createRoot(container);
	const { Dialog, DialogContent } = dialog as unknown as {
		Dialog: React.ComponentType<Record<string, unknown>>;
		DialogContent: React.ComponentType<Record<string, unknown>>;
	};
	act(() => {
		currentRoot!.render(
			createElement(
				Dialog,
				{ open: true, onOpenChange: () => {} },
				createElement(DialogContent, props, createElement('p', null, 'body copy')),
			),
		);
	});
	const el = dom.window.document.querySelector('[role="dialog"]') as HTMLElement | null;
	assert.ok(el, 'precondition: the dialog must portal a content element into the document');
	return { el: el!, wrapper: el!.parentElement! };
}

test('A5-23.2-C3 resizable DEFAULTS TRUE for a data dialog and is FORCED false for a confirm', () => {
	// DEFAULT (no prop): a data/form dialog is resizable, and carries the clamps.
	const data = renderDialogContent({ 'data-testid': 'a5-data-dialog' });
	assert.equal(data.el.getAttribute('data-resizable'), 'true', 'a data dialog must default to resizable');
	assert.ok(hasClass(data.el, 'min-w-[min(480px,95vw)]'), 'the data dialog is missing the width floor');
	assert.ok(hasClass(data.el, 'max-w-[95vw]'), 'the data dialog can grow past the viewport');
	assert.ok(hasClass(data.el, 'max-h-[85vh]'), 'the data dialog can grow past the viewport height');

	// FORCED FALSE: a confirm is compact, whatever the page asks for.
	const confirm = renderDialogContent({ resizable: false, 'data-testid': 'a5-confirm-dialog' });
	assert.equal(confirm.el.getAttribute('data-resizable'), 'false', 'a confirm dialog must be forced non-resizable');
	assert.ok(hasClass(confirm.el, 'max-w-md'), 'a confirm dialog must stay compact at max-w-md');
	assert.equal(
		hasClass(confirm.el, 'min-w-[min(480px,95vw)]'),
		false,
		'a confirm dialog must not inherit the data-dialog 480px floor; it would outgrow its own max-w-md',
	);
	// And the audit property: a confirm renders NO drag handles at all.
	assert.equal(
		confirm.el.querySelectorAll(`[data-testid="${DIALOG_RESIZE_HANDLE_TESTID}"]`).length,
		0,
		'a confirm dialog renders resize handles; it must never become a draggable panel',
	);
	assert.doesNotMatch(confirm.el.getAttribute('class') ?? '', /max-w-\[95vw\]/, 'a confirm dialog is 95vw wide');
});

test('A5-23.2-C4 the handles look draggable, drag the width, and stay out of the tab order', () => {
	const { el } = renderDialogContent({ 'data-testid': 'a5-handle-dialog' });
	const handles = Array.from(el.querySelectorAll(`[data-testid="${DIALOG_RESIZE_HANDLE_TESTID}"]`)) as HTMLElement[];
	assert.equal(handles.length, 2, 'the dialog must render a left and a right handle');

	for (const handle of handles) {
		const cls = handle.getAttribute('class') ?? '';
		// Clickable must LOOK clickable (AGENTS.md §8): a visible shape, a
		// sideways cursor, and a hover state. Never an invisible 2px line.
		assert.match(cls, /\bbg-border\b/, 'the handle has no visible shape');
		assert.match(cls, /\bcursor-ew-resize\b/, 'the handle does not advertise a sideways drag');
		assert.match(cls, /\bhover:bg-primary\/\d+\b/, 'the handle has no hover state');
		assert.match(cls, /\bw-[\d.]+\b/, 'the handle has no width, so it cannot be aimed at');
		// A pointer drag is not a keyboard control.
		assert.equal(handle.getAttribute('aria-hidden'), 'true', 'the handle is exposed to assistive tech');
		assert.equal(handle.getAttribute('tabindex'), '-1', 'the handle is in the tab order');
		assert.equal(handle.getAttribute('role'), 'presentation', 'the handle must not be announced as a control');
		// Inset from the top-right corner the close button owns.
		assert.match(cls, /\btop-10\b/, 'the handle must start below the close button');
	}
	assert.deepEqual(
		handles.map((h) => h.getAttribute('data-resize-side')),
		['left', 'right'],
		'the two handles must be the left and the right edge, in that order',
	);

	// The drag is WIRED: a pointerdown on the right handle puts the dialog into
	// its resizing state. JSDOM has no layout, so the reported width is the
	// clamp floor rather than a measured delta — the clamp itself is driven by
	// C1. What this row proves is that the pointer path is connected at all.
	act(() => {
		handles[1]!.dispatchEvent(
			new dom.window.Event('pointerdown', { bubbles: true, cancelable: true }) as never,
		);
	});
	assert.equal(
		dom.window.document.querySelector('[data-resizing="true"]'),
		el,
		'a pointerdown on the handle must enter the resizing state',
	);
	act(() => {
		dom.window.dispatchEvent(new dom.window.Event('pointerup', { bubbles: true }) as never);
	});
	assert.equal(el.getAttribute('data-resizing'), null, 'pointerup must end the resizing state');

	// The close button still works: the handles must not have displaced it.
	assert.ok(el.querySelector('button'), 'the dialog lost its close button');
});

test('A5-23.2-C5 centring is the flex parent, not the translate anchor', () => {
	const { el, wrapper } = renderDialogContent({ 'data-testid': 'a5-centring-dialog' });
	assert.equal(wrapper.getAttribute('data-dialog-centering'), 'flex');
	for (const token of ['fixed', 'inset-0', 'flex', 'items-center', 'justify-center']) {
		assert.ok(hasClass(wrapper, token), `the centring wrapper is missing "${token}"`);
	}
	// The translate anchor is gone from the primitive's own class list. A
	// transform re-anchors the box for the size it was animated at, which is
	// exactly what made a width drag fight the cursor.
	const cls = el.getAttribute('class') ?? '';
	assert.equal(hasClass(el, 'left-[50%]'), false, 'the translate centring anchor is back on the primitive');
	assert.equal(hasClass(el, 'top-[50%]'), false, 'the translate centring anchor is back on the primitive');
	// And the new animation is the non-translating pair, so the box does not
	// shift by half its own size on open.
	assert.match(cls, /animate-modal-center-in/, 'the primitive must use the non-translating open animation');
	assert.doesNotMatch(cls, /animate-modal-in\b/, 'the translating open animation is back on the dialog');
	const css = SRC('index.css');
	assert.match(css, /--animate-modal-center-in:/, 'the non-translating keyframe pair is missing from index.css');
	assert.match(css, /@keyframes modal-center-in \{/, 'the modal-center-in keyframes are missing from index.css');
	const modalCenterIn = /@keyframes modal-center-in \{([\s\S]*?)\n\t\}/.exec(css)?.[1] ?? '';
	assert.ok(modalCenterIn.length > 0, 'could not read the modal-center-in keyframes');
	assert.doesNotMatch(
		modalCenterIn,
		/translate/,
		'modal-center-in still translates, so the centred box opens off-centre',
	);
	assert.match(modalCenterIn, /scale\(/, 'the modal-center-in keyframes must still scale, so the open animation is not a plain fade');
	// The OLD keyframes are additive, not replaced: anything still using them works.
	assert.match(css, /@keyframes modal-in \{/, 'the pre-existing modal-in keyframes were removed instead of kept additively');
});

// ===========================================================================
// A5-23.2-C6 — THE AUDIT ROW. No confirm dialog may become a 95vw panel.
// ===========================================================================

/** Every `DialogContent` open tag in the app, as source text. */
function allDialogContentOpenTags(): Array<{ file: string; tag: string }> {
	const files = [
		...walk('components'), ...walk('pages'), ...walk('ui'),
	];
	return files.flatMap((file) =>
		Array.from(SRC_CODE(file).matchAll(/<DialogContent\b([\s\S]*?)>/g)).map((m) => ({
			file,
			tag: m[0]!,
		})),
	);
}

function walk(dir: string): string[] {
	const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
	const out: string[] = [];
	const base = `${process.cwd().replace(/\\/g, '/')}/src/${dir}`;
	for (const entry of readdirSync(base)) {
		const full = `${base}/${entry}`;
		if (statSync(full).isDirectory()) out.push(...walk(`${dir}/${entry}`));
		else if (entry.endsWith('.tsx') && !entry.includes('__tests__')) out.push(`${dir}/${entry}`);
	}
	return out;
}

/**
 * The confirm/alert surfaces the packet named, plus every other
 * confirmation-shaped dialog found in the audit.
 *
 * The list is explicit on purpose: an audit that discovers its own targets from
 * a keyword scan can quietly shrink to zero targets and still pass. Each entry
 * declares how many of that file's `DialogContent` tags MUST opt out. Two files
 * mix a confirmation with a real form — `SchedulingPolicyDialogs` also renders
 * "Add a schedule window", and `SpecializationMapping` also renders "Map N
 * Specialization(s)" — so they declare one opt-out each rather than blanket
 * rules that would force a data form to be compact.
 */
const CONFIRM_DIALOG_FILES: Record<string, { why: string; minOptOuts: number }> = {
	'ui/confirmation-modal.tsx': { why: 'the app-wide shared ConfirmationModal', minOptOuts: 1 },
	'components/subjects/DeleteSubjectDialog.tsx': { why: 'Delete subject', minOptOuts: 1 },
	'components/timetable/modals/HardBlockerDialog.tsx': { why: 'Hard-blocker ALERT', minOptOuts: 1 },
	'components/timetable/modals/SoftViolationConfirmDialog.tsx': { why: 'Soft-violation confirm', minOptOuts: 1 },
	'components/sections/SectionHomeRoomModals.tsx': { why: 'Move / Remove home room', minOptOuts: 2 },
	'components/timetable/modals/TimetableWorkflowDialogs.tsx': { why: 'unassign / reset / leave / publish / generate', minOptOuts: 6 },
	'components/timetable/modals/TimetablePlacementDialogs.tsx': { why: 'Place / review placement / Swap', minOptOuts: 3 },
	'components/timetable/TimetableFacultyIssuePivotDialog.tsx': { why: "Open a teacher's schedule", minOptOuts: 1 },
	'components/timetable/simple/SimpleDriftBanner.tsx': { why: 'Update this schedule', minOptOuts: 1 },
	'components/timetable/ScheduleReviewWorkspaceDialogs.tsx': { why: 'Setup drift ALERT / Sync with Setup', minOptOuts: 2 },
	'components/runtime/RolloverConfirmationDialogs.tsx': { why: 'Rollover term repair / recovery / test data', minOptOuts: 3 },
	'components/runtime/SchoolYearListCard.tsx': { why: 'Year Setup keep/start', minOptOuts: 1 },
	'components/runtime/RolloverResetPanel.tsx': { why: 'Erase ATLAS test data', minOptOuts: 1 },
	'components/scheduling-policy/SchedulingPolicyDialogs.tsx': { why: 'Policy reconciliation confirm (not the "Add a schedule window" form)', minOptOuts: 1 },
	'pages/SpecializationMapping.tsx': { why: 'Unsaved mapping changes (not the "Map N Specialization(s)" form)', minOptOuts: 1 },
	'pages/Faculty.tsx': { why: 'Delete temporary teacher', minOptOuts: 1 },
};

test('A5-23.2-C6 AUDIT: every confirm/alert dialog opts out, so none can become a 95vw panel', () => {
	const tags = allDialogContentOpenTags();
	assert.ok(tags.length > 20, `the sweep found only ${tags.length} DialogContent tags; the file walk is broken`);

	for (const [file, { why, minOptOuts }] of Object.entries(CONFIRM_DIALOG_FILES)) {
		const fileTags = tags.filter((t) => t.file === file);
		assert.ok(fileTags.length >= minOptOuts, `precondition: ${file} (${why}) renders too few DialogContent tags`);
		const optOuts = fileTags.filter((t) => /resizable=\{false\}/.test(t.tag));
		assert.ok(
			optOuts.length >= minOptOuts,
			`${file} (${why}) renders ${fileTags.length} dialog(s) but only ${optOuts.length} opted out of resizing; it can silently become a draggable panel`,
		);
	}

	// The reciprocal, on the files the packet names as DATA/FORM targets: each
	// takes the resizable default, and none carries its own `style={{ resize }}`.
	const DATA_DIALOG_FILES: Record<string, string> = {
		'components/subjects/SubjectCoverageSheet.tsx': 'Subject coverage',
		'components/faculty/FacultyWorkloadModal.tsx': 'Assign teaching load',
		'components/faculty/FacultyProfileSheet.tsx': 'Teacher profile',
		'components/sections/SectionRoomMapModal.tsx': 'Assign Home Room',
		'components/faculty/CreatePlaceholderDialog.tsx': 'Create temporary teacher',
	};
	for (const [file, why] of Object.entries(DATA_DIALOG_FILES)) {
		const code = SRC_CODE(file);
		assert.ok(
			/<DialogContent\b[\s\S]{0,200}?\bresizable\b/.test(code),
			`${file} (${why}) does not take the shared resizable contract`,
		);
		assert.doesNotMatch(
			code,
			/style=\{\{[^}]*resize/,
			`${file} (${why}) still carries a page-local style resize; the shared primitive owns this now`,
		);
	}

	// The whole-app invariant: no page may hand-roll a `resize` class onto a
	// dialog any more. That is what produced four different "resizable" dialogs
	// with four different bounds, four different grips and no shared clamp.
	for (const { file, tag } of tags) {
		assert.doesNotMatch(
			tag,
			/(?:^|\s)resize(?:\s|$)/,
			`${file} passes a bare \`resize\` class to DialogContent; the shared primitive's handles replace it`,
		);
	}
	// And the opt-out is not free: a compact dialog must not also carry the
	// resizable ceiling, which would put the two contracts in conflict.
	for (const { file, tag } of tags.filter((t) => /resizable=\{false\}/.test(t.tag))) {
		assert.doesNotMatch(
			tag,
			/max-w-\[95vw\]/,
			`${file} opts out of resizing but still asks for 95vw; the confirm would be a wide panel with no way to size it`,
		);
	}
});

// Keep the bundler honest about the unused import surface.
void renderToStaticMarkup;
void g;

// ===========================================================================
// A5-23.2-C7 — QA F1 (2026-09-29, BLOCKING): a resizable dialog keeps its
// scrollbar.
// ===========================================================================

test('A5-23.2-C7 a RESIZABLE dialog still scrolls, and a page-owned scroller still wins', () => {
	// The regression, stated as the operator would meet it: `CoverShortageDialog`
	// has no `overflow` token anywhere in its file and a body up to ten class
	// names long; `CreatePlaceholderDialog` is one of the five targets this cycle
	// was asked to make resizable. With `overflow-y-auto` confined to the
	// confirm branch, Radix locks the page behind the dialog and the content
	// below the 85vh cap is unreachable — no scrollbar, no footer.
	const data = renderDialogContent({ 'data-testid': 'a5-scroll-data-dialog' });
	assert.ok(
		hasClass(data.el, 'overflow-y-auto'),
		'a RESIZABLE data dialog must keep `overflow-y-auto`; content taller than the 85vh cap would otherwise be unreachable',
	);

	// Same for a confirm: it is capped at `max-h-[85vh]` too, so it needs the
	// scroll just as much.
	const confirm = renderDialogContent({ resizable: false, 'data-testid': 'a5-scroll-confirm-dialog' });
	assert.ok(hasClass(confirm.el, 'overflow-y-auto'), 'a compact confirm must keep `overflow-y-auto` under its height cap');

	// AND the page-owned scroller must still win, or the five targets that own
	// their internal scroll region would gain a second, outer scrollbar
	// (AGENTS.md §8 — one scroll region, none of them global). `className` is
	// merged LAST, so `overflow-hidden` overrides the base default.
	const owned = renderDialogContent({ 'data-testid': 'a5-own-scroller-dialog', className: 'overflow-hidden' });
	assert.ok(
		hasClass(owned.el, 'overflow-hidden'),
		'a surface that owns its own scroll region must keep `overflow-hidden`; the base default must not fight it',
	);
	assert.equal(
		hasClass(owned.el, 'overflow-y-auto'),
		false,
		'the base `overflow-y-auto` and the page-owned `overflow-hidden` are both live; tailwind-merge must collapse them to the page-owned one',
	);
});
