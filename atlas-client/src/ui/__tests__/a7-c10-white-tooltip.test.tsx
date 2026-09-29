/**
 * A7 c10 (operator, 2026-09-29) — the shared tooltip is WHITE, app-wide.
 *
 * "Why on earth are the tooltips black? Why is it not just white with a shadowed
 * background?"
 *
 * ============================ WHAT THIS IS NOT =============================
 *
 * A7C10-1 renders the REAL primitive and reads the REAL class list off the DOM
 * node, so it is a rendered measurement of the bubble's own surface, text colour
 * and type size — not a grep of the source string. A7C10-3 and A7C10-4 are
 * SOURCE SWEEPS over every call site in the tree, and they are labelled as such:
 * they prove no call site re-darkens or re-shrinks the primitive, and that ten
 * named bubbles still carry their own text. They do NOT prove any of those ten
 * pages looks right. That is a rendered screenshot against real data, and it
 * belongs to the planner (AGENTS.md "Done means seen" — a class contract is a
 * floor, never a substitute).
 *
 * ============================== WHY IT IS HERE =============================
 *
 * The palette change is app-wide, so it is invisible in a diff review of any one
 * page and it is trivially undone by a single call site that still passes
 * `bg-slate-900`. The promise therefore lives in ONE file: one primitive, one
 * contract, and one row per way it can be broken.
 *
 * ============================== THE CONTROLS ===============================
 *
 * A7C10-1  RENDERED: the mounted bubble has no dark surface and no type under
 *          14px. The 14px floor is COMPUTED from `index.css` `@theme`, not
 *          assumed — in this design system `--text-xs` is 0.875rem (14px) and
 *          `--text-sm` is 0.9375rem (15px), so a source grep for the token
 *          "text-xs" would have been the wrong check.
 * A7C10-2  MUTANT CONTROL: a dark bubble and a 12px bubble are both REJECTED by
 *          A7C10-1's predicate, so that predicate is not vacuous.
 * A7C10-3  SWEEP: no `<TooltipContent>` call site in the tree re-darkens the
 *          primitive (`bg-slate-8/9xx`, `text-white`, `text-slate-100`, `dark:`,
 *          `shadow-none`) or overrides its type size.
 * A7C10-4  SWEEP: ten named call sites across ten pages still pass their own
 *          non-empty text, so a white bubble can never render as an empty pill.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

// --- jsdom bootstrap (the accepted pattern in the sibling shared-UI suite) ---
const require = createRequire(import.meta.url);
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://127.0.0.1/' });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement;
g.SVGElement = dom.window.SVGElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.NodeFilter = dom.window.NodeFilter;
g.HTMLCollection = dom.window.HTMLCollection;
g.getComputedStyle = dom.window.getComputedStyle;
g.MutationObserver = class {
	observe() {}
	disconnect() {}
	takeRecords() { return []; }
};
dom.window.MutationObserver = g.MutationObserver as never;
g.DOMRect = dom.window.DOMRect;
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
void require; // keep the require binding for tooling parity with the sibling suite

const { act } = await import('react');
const React = await import('react');
const { createRoot } = await import('react-dom/client');

const SRC_ROOT = `file:///${process.cwd().replace(/\\/g, '/')}/src/`;
const SRC = (rel: string) => readFileSync(new URL(rel, SRC_ROOT), 'utf8');

/**
 * Every production `.tsx` under `src/`, test directories EXCLUDED.
 *
 * A sweep that counted its own fixture would report a defect on the row that
 * names the forbidden tokens, so the walk stops at `__tests__`.
 */
function productionFiles(dir = SRC_ROOT.replace('file:///', ''), out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === '__tests__' || entry === 'node_modules') continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) productionFiles(full, out);
		else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(full);
	}
	return out;
}

/** Every `<TooltipContent …>` open tag in the tree, with its file and inner text. */
function everyTooltipCallSite() {
	const sites: { file: string; tag: string; inner: string }[] = [];
	for (const file of productionFiles()) {
		const text = readFileSync(file, 'utf8');
		for (const open of text.matchAll(/<TooltipContent\b[^>]*>/g)) {
			const from = (open.index ?? 0) + open[0].length;
			const close = text.indexOf('</TooltipContent>', from);
			sites.push({
				file: file.replace(SRC_ROOT.replace(/\\/g, '/'), ''),
				tag: open[0],
				inner: close === -1 ? '' : text.slice(from, close),
			});
		}
	}
	return sites;
}

// ---------------------------------------------------------------------------
// The 14px floor, COMPUTED from the design system rather than assumed.
// ---------------------------------------------------------------------------
/** `rem` -> `px` for the type-size tokens this repo declares in `index.css`. */
function typeStepPx(): Record<string, number> {
	const css = SRC('index.css');
	const out: Record<string, number> = {};
	for (const [, token, rem] of css.matchAll(/--text-(xs|sm|base|lg|xl):\s*([\d.]+)rem;/g)) {
		out[`text-${token}`] = Math.round(Number(rem) * 16 * 100) / 100;
	}
	return out;
}

const STEPS = typeStepPx();
/** The smallest px a size token on a bubble is allowed to compute to. */
const FLOOR_PX = 14;

// ===========================================================================
// A7C10-1 — RENDERED. The mounted bubble.
// ===========================================================================

async function mountBubble(children: React.ReactNode) {
	const { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } = await import('@/ui/tooltip');
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(TooltipProvider, {
				delayDuration: 0,
				children: React.createElement(
					Tooltip,
					{ open: true },
					React.createElement(TooltipTrigger, null, 'trigger'),
					React.createElement(TooltipContent, null, children),
				),
			}),
		);
	});
	// Radix puts a VISUALLY-HIDDEN `role="tooltip"` span on the trigger itself
	// (the `aria-describedby` target) and mounts the real bubble into a popper
	// wrapper on `document.body`. Asserting on the first `role="tooltip"` would
	// measure the hidden span, so the bubble is the wrapper's only child.
	const node = (dom.window.document.body.querySelector('[data-radix-popper-content-wrapper]')?.firstElementChild
		?? dom.window.document.body.querySelector('[data-radix-popper-content-wrapper]')) as HTMLElement | null;
	return { node, host, root };
}

test('A7C10-1 RENDERED: the mounted bubble has no dark surface and no type under 14px', async () => {
	assert.ok(STEPS['text-sm'] && STEPS['text-sm'] >= FLOOR_PX, `index.css @theme no longer declares a text-sm at or above ${FLOOR_PX}px (got ${STEPS['text-sm']})`);

	const { node, host, root } = await mountBubble('Hide this status.');
	assert.ok(node, 'the shared TooltipContent did not mount a popper-wrapped bubble, so this row measures nothing');
	const classes = (node.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
	const shown = `[role=tooltip] class="${classes.join(' ')}" outerHTML=${node.outerHTML.slice(0, 200)}`;

	// (1) NO DARK BACKGROUND, by any spelling. This is the operator's complaint.
	for (const dark of ['bg-slate-900', 'bg-slate-800', 'bg-slate-950', 'bg-slate-700', 'text-white', 'text-slate-100', 'dark:bg-slate-900', 'shadow-none']) {
		assert.equal(classes.includes(dark), false, `the rendered bubble carries "${dark}", so it is still black`);
	}
	assert.ok(classes.includes('bg-popover'), `the rendered bubble is not on the app white-surface token: ${shown}`);
	assert.ok(classes.includes('text-popover-foreground'), 'the rendered bubble is not on the app dark-text token');
	// The edge is what makes a white bubble safe on a white surface. Without it
	// this is the 2026-09-28 "blank white pill" report all over again.
	assert.ok(classes.includes('border'), 'the rendered white bubble has no border, so it has no edge on a white card');
	assert.ok(classes.includes('border-border'), 'the rendered bubble border is not the app border token');
	assert.ok(classes.some((c) => c.startsWith('shadow-') && c !== 'shadow-none'), 'the rendered white bubble has no shadow to lift it off the surface');

	// (2) NO TYPE UNDER 14px. Computed, because `--text-xs` is 14px in this
	// design system and a token-name grep would have called it small.
	const sizeTokens = classes.filter((c) => /^text-(xs|sm|base|lg|xl)$/.test(c));
	assert.equal(sizeTokens.length, 1, `the bubble must carry exactly one named type size, found ${JSON.stringify(sizeTokens)}`);
	const px = STEPS[sizeTokens[0]!]!;
	assert.ok(px >= FLOOR_PX, `the bubble renders at ${sizeTokens[0]} = ${px}px, under the operator's ${FLOOR_PX}px floor`);

	// (3) The primitive did not lose its geometry on the way to white. The
	// portal is the fix for A5 item 34 (an ancestor's `overflow` clipping the
	// bubble in half) and the wrap contract is the fix for item 35.
	assert.ok(classes.includes('z-50'), 'the bubble lost z-50');
	assert.ok(classes.includes('rounded-md'), 'the bubble lost rounded-md');
	assert.ok(classes.includes('pointer-events-none'), 'the bubble lost pointer-events-none');
	assert.ok(classes.includes('animate-in'), 'the bubble lost animate-in');
	assert.ok(classes.includes('w-max'), 'the bubble lost w-max, so it stretches instead of hugging its text');
	assert.ok(classes.includes('whitespace-normal') && classes.includes('break-words') && classes.includes('leading-normal'), 'the bubble lost the wrap contract, so a long sentence is clipped again');
	assert.equal(classes.includes('max-w-[22rem]'), true, 'the bubble lost the operator\'s ~22rem cap');
	assert.equal(host.contains(node), false, 'the bubble mounted inside the React container, so an ancestor overflow can clip it (A5 item 34)');
	// Radix mirrors the content into a visually-hidden `aria` copy inside the
	// bubble for screen readers, so `textContent` is the sentence twice. What
	// matters is the property this slice is protecting: the bubble carries its
	// own words. A white bubble with no words is a blank white pill.
	assert.ok((node.textContent ?? '').trim().length > 0, 'the rendered bubble is empty, so a white bubble is a blank white pill');
	assert.ok((node.textContent ?? '').includes('Hide this status.'), `the rendered bubble did not carry its own children: ${shown}`);

	await act(async () => { root.unmount(); });
	host.remove();
});

// ===========================================================================
// A7C10-2 — MUTANT CONTROL for A7C10-1's predicate.
// ===========================================================================

test('A7C10-2 MUTANT CONTROL: a dark bubble and a 12px bubble are both rejected by A7C10-1', async () => {
	// The two real shapes this slice exists to remove, verbatim from history.
	const DARK = 'z-50 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-md pointer-events-none animate-in w-max max-w-xs md:max-w-sm whitespace-normal break-words leading-normal';
	const TWELVE_PX = 'z-50 rounded-md border border-border bg-popover px-2.5 py-1 text-[12px] font-medium text-popover-foreground shadow-md pointer-events-none animate-in w-max max-w-[22rem] whitespace-normal break-words leading-normal';

	const reject = (className: string) => {
		const classes = className.split(/\s+/).filter(Boolean);
		const dark = ['bg-slate-900', 'text-white'].filter((t) => classes.includes(t));
		// A size is either a NAMED step (`text-sm`, resolved through the
		// `index.css` theme) or an arbitrary px/rem value. `text-[12px]` is the
		// shape the operator is objecting to, so it has to resolve, not match.
		const sizes = classes
			.filter((c) => /^text-(xs|sm|base|lg|xl)$/.test(c) || /^text-\[/.test(c))
			.map((c) => {
				const arbitrary = /^text-\[([\d.]+)(px|rem)\]$/.exec(c);
				if (!arbitrary) return STEPS[c]!;
				return arbitrary[2] === 'rem' ? Number(arbitrary[1]) * 16 : Number(arbitrary[1]);
			});
		return { dark, subFloor: sizes.filter((v) => v < FLOOR_PX) };
	};

	const darkVerdict = reject(DARK);
	assert.ok(darkVerdict.dark.length >= 2, 'MUTANT CONTROL DID NOT FIRE: the dark bubble is not rejected for a dark surface');
	const twelveVerdict = reject(TWELVE_PX);
	assert.ok(
		twelveVerdict.subFloor.length === 1 && twelveVerdict.subFloor[0] === 12,
		'MUTANT CONTROL DID NOT FIRE: a 12px bubble is not rejected by the 14px floor',
	);
	// The same predicate, opposite outcome, on the LIVE class list.
	const live = /className=\{cn\(\s*'([^']*)'/.exec(SRC('ui/tooltip.tsx'))?.[1] ?? '';
	assert.ok(live.length > 0, 'could not read the shared TooltipContent class list');
	const liveVerdict = reject(live);
	assert.deepEqual(liveVerdict.dark, [], 'the live primitive still carries a dark surface');
	assert.deepEqual(liveVerdict.subFloor, [], 'the live primitive still renders under the 14px floor');
});

// ===========================================================================
// A7C10-3 — SWEEP: no call site re-darkens or re-shrinks the primitive.
// ===========================================================================

test('A7C10-3 SWEEP: no TooltipContent call site re-darkens the primitive or overrides its type size', () => {
	const sites = everyTooltipCallSite();
	assert.ok(sites.length > 100, `the walk only found ${sites.length} call sites, so the sweep cannot be trusted`);

	const DARK_FRAGMENTS = ['bg-slate-900', 'bg-slate-950', 'bg-slate-800', 'bg-slate-700', 'text-white', 'text-slate-100', 'text-slate-200', 'dark:bg-slate-9', 'dark:bg-black', 'dark:text-white', 'shadow-none'];
	const SIZE_TOKENS = ['text-xs', 'text-[12px]', 'text-[0.75rem]', 'text-[11pt]'];

	const offenders: string[] = [];
	for (const site of sites) {
		for (const fragment of [...DARK_FRAGMENTS, ...SIZE_TOKENS]) {
			if (site.tag.includes(fragment)) offenders.push(`${site.file}: "${fragment}" in ${site.tag.replace(/\s+/g, ' ')}`);
		}
	}
	assert.deepEqual(offenders, [], `call sites re-darken or re-shrink the shared bubble:\n  ${offenders.join('\n  ')}`);

	// A residue check the sweep itself can create: removing a call site's last
	// size token can leave `className=""`, which is noise, not intent.
	const empties = sites.filter((s) => /className=(["'])\1/.test(s.tag)).map((s) => s.file);
	assert.deepEqual(empties, [], `call sites carry an empty className:\n  ${empties.join('\n  ')}`);
});

// ===========================================================================
// A7C10-4 — SWEEP: ten named bubbles still carry their own text.
// ===========================================================================

/**
 * Ten real call sites, one per page the operator named, with the text each one
 * passes. The text is quoted from the file, so a call site that swaps its copy
 * for `null`/empty fails here instead of shipping a blank white pill.
 */
const NAMED_SITES: { page: string; file: string; text: string }[] = [
	{ page: 'Class Schedule grid cell', file: 'components/timetable/TimetableGrid.tsx', text: 'fullDetailsText' },
	{ page: 'Class Schedule header', file: 'components/timetable/simple/SimpleHeaderActions.tsx', text: 'diagnostic' },
	{ page: 'Class Schedule conflict chip', file: 'components/timetable/TimetableGridConflictBadge.tsx', text: 'warning' },
	{ page: 'Subjects row', file: 'components/subjects/SubjectRow.tsx', text: 'coverageHelp' },
	{ page: 'Faculty row', file: 'components/faculty/FacultyRow.tsx', text: 'explanation' },
	{ page: 'Teaching Load filter bar', file: 'components/faculty-assignments/TeachingLoadFilterBar.tsx', text: 'OUTSIDE_DEPT_FILTER_EXPLANATION' },
	{ page: 'Sections column header', file: 'components/sections/SectionsSortableHeader.tsx', text: 'ariaLabel' },
	{ page: 'Room Schedules source band', file: 'components/room-schedules/ScheduleSourceBand.tsx', text: 'One term at a time.' },
	{ page: 'Dashboard (RolloverGuidanceCard)', file: 'components/runtime/RolloverGuidanceCard.tsx', text: 'Hide this status' },
	{ page: 'App shell sidebar', file: 'components/app-shell/AppSidebar.tsx', text: 'Unable to reach EnrollPro' },
];

test('A7C10-4 SWEEP: ten named call sites still pass their own non-empty text, so no white bubble renders empty', () => {
	assert.equal(NAMED_SITES.length, 10, 'the packet asks for ten call sites; the list drifted');
	assert.ok(new Set(NAMED_SITES.map((s) => s.file)).size === 10, 'the ten call sites must be ten DIFFERENT files, not one file ten times');

	for (const site of NAMED_SITES) {
		const text = SRC(site.file);
		const open = text.match(/<TooltipContent\b[^>]*>/g) ?? [];
		assert.ok(open.length > 0, `${site.page} (${site.file}) no longer renders a TooltipContent at all`);
		const matched = open.some((tag) => {
			const from = text.indexOf(tag) + tag.length;
			const close = text.indexOf('</TooltipContent>', from);
			return close !== -1 && text.slice(from, close).includes(site.text);
		});
		assert.ok(
			matched,
			`${site.page} (${site.file}) no longer passes "${site.text}" to a TooltipContent, so that bubble would render as an empty white pill`,
		);
	}
});
