/**
 * A3 c11 — fix 10.1, RENDERED: the Building Explorer list is 14px, medium or
 * stronger, dark, and a solid row.
 *
 * THE OPERATOR'S OWN REQUEST (fix-1.1.docx, fix 10.1), in its own terms: "Increase
 * the building item font size from `text-xs` (or `text-[11px]`) to `text-sm`
 * (14px). Upgrade the font weight from normal to `font-medium` or
 * `font-semibold`. Strengthen the font color for higher legibility (e.g. change
 * from light muted gray to `text-slate-800` or `text-slate-900`)." Plus
 * "Optimize the row height and padding (e.g. `py-2.5 px-3`) so each building
 * trigger feels like a solid, well-proportioned clickable item rather than
 * floating loose text", "Ensure the right chevron arrow (`>`) aligns vertically
 * centered with the larger text label", and "When a building is selected/expanded
 * … ensure the parent title retains this stronger weight and size".
 *
 * FAILING-FIRST, recorded rather than assumed. On the base revision the rendered
 * trigger was
 *   <button class="… w-full justify-between px-3 py-2 rounded-lg text-left
 *                transition-all hover:bg-muted text-muted-foreground font-medium">
 *     <span class="text-xs">Grade 9 Academic Wing</span>
 *     <svg class="size-3.5 …"/>
 *   </button>
 * — 12px (`NAMED_SIZE.text-xs` in Tailwind v4 is 0.75rem = 12px), a
 * `text-muted-foreground` idle colour, `py-2`, a 14px chevron and NO
 * `items-center`, so the chevron could not be centred against a 14px label.
 * Every row below names the base value it differs from, and the last row proves
 * the assertions reject a base-shaped trigger.
 */
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import test from 'node:test';

import { JSDOM } from 'jsdom';

import { installCanvasShim } from '../../__tests__/konva-dom-render-harness';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'https://njgrm.buru-degree.ts.net/sections',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	localStorage: dom.window.localStorage,
	sessionStorage: dom.window.sessionStorage,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	Node: dom.window.Node,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	SVGElement: dom.window.SVGElement,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
	matches: false, media: q, onchange: null,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});

// The modal loads its buildings through `@/lib/api`, so the module is stubbed
// BEFORE the component is imported. The stub answers the ONE call this control
// depends on (`/map/schools/1/buildings`) and fails loudly on anything else, so a
// silent empty list cannot make a control pass vacuously.
mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async (url: string) => {
			if (url.includes('/map/schools/1/buildings')) return { data: { buildings: EXPLORER_BUILDINGS } };
			throw new Error(`unexpected GET in the Building Explorer control: ${url}`);
		},
		post: async () => ({ data: {} }),
		patch: async () => ({ data: {} }),
		put: async () => ({ data: {} }),
		delete: async () => ({ data: {} }),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

// The dialog mounts a react-konva stage for the campus view, and jsdom has no
// 2D context, so the stage throws and takes the whole tree — including the DOM
// sidebar this item is about — down with it. The 2D sink from the shared Konva
// harness is therefore attached to THIS test's own jsdom, so the real stage
// mounts and draws. The canvas is made able to draw here, never inspected: the
// Konva surfaces this cycle changed are decided by
// `a3-c11-room-card-pill-and-meter.test.tsx` and
// `a3-c11-campus-editor-canvas.test.tsx`, which assert on what was painted.
installCanvasShim(dom.window as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } });

const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
type Root = import('react-dom/client').Root;
const { SectionRoomMapModal } = await import('../SectionRoomMapModal');
type Building = import('@/types').Building;
type Room = import('@/types').Room;

/** The two grades of name the operator named, plus a deliberately long one. */
const EXPLORER_BUILDINGS: Building[] = [
	{
		id: 1, name: 'Grade 9 Academic Wing', floorCount: 2, x: 0, y: 0, width: 100, height: 80,
		color: '#e11d48', rotation: 0, gradeScope: [], isTeachingBuilding: true,
		rooms: [
			{ id: 401, name: 'G9 Room 401', type: 'CLASSROOM', capacity: 40, isTeachingSpace: true, floor: 1, floorPosition: 1 } as Room,
			{ id: 402, name: 'G9 Room 402', type: 'CLASSROOM', capacity: 40, isTeachingSpace: true, floor: 1, floorPosition: 2 } as Room,
		],
	},
	{
		id: 2, name: 'MAPEH and Wellness Hub', floorCount: 1, x: 0, y: 0, width: 100, height: 60,
		color: '#0ea5e9', rotation: 0, gradeScope: [], isTeachingBuilding: true, rooms: [],
	},
	{
		id: 3, name: 'Admin and Learning Commons', floorCount: 1, x: 0, y: 0, width: 100, height: 60,
		color: '#f59e0b', rotation: 0, gradeScope: [], isTeachingBuilding: true, rooms: [],
	},
] as unknown as Building[];

let root: Root | null = null;
let host: HTMLElement | null = null;

/** The modal is opened with a pre-selected building, so a test can read BOTH the
 *  expanded and the collapsed treatment from one real render. */
async function renderModal(currentRoomId: number | null) {
	const container = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(container);
	host = container;
	root = createRoot(container);
	function Harness() {
		return createElement(SectionRoomMapModal, {
			open: true,
			onOpenChange: () => {},
			sectionName: 'Grade 9 - Sampaguita',
			sectionId: 11,
			currentRoomId,
			onSelect: () => {},
			schoolId: 1,
			roomOccupancy: new Map([[401, 'Grade 9 - Sampaguita']]),
		});
	}
	await act(async () => {
		root!.render(createElement(Harness));
		await new Promise((r) => setTimeout(r, 0));
		await new Promise((r) => setTimeout(r, 0));
	});
	// The dialog is a Radix portal, so its content lands on `document.body`, not
	// inside the container. Everything below therefore reads the DOCUMENT, which
	// is also what an operator's screen contains.
	return dom.window.document as unknown as HTMLElement;
}

/** Every Building Explorer trigger, by building name. */
function explorerTriggers(container: HTMLElement): Map<string, HTMLButtonElement> {
	const found = new Map<string, HTMLButtonElement>();
	for (const label of Array.from(container.querySelectorAll('span'))) {
		const name = (label.textContent ?? '').trim();
		if (found.has(name)) continue;
		const trigger = label.closest('button');
		if (trigger) found.set(name, trigger as HTMLButtonElement);
	}
	return found;
}

/** The Building Explorer trigger for a named building. */
function explorerTrigger(container: HTMLElement, name: string): HTMLButtonElement {
	const trigger = explorerTriggers(container).get(name);
	assert.ok(trigger, `the Building Explorer must list "${name}"; found ${[...explorerTriggers(container).keys()].join(', ')}`);
	return trigger!;
}

/** The label span inside a trigger. */
function triggerLabel(trigger: HTMLButtonElement, name: string): HTMLElement {
	const label = Array.from(trigger.querySelectorAll('span'))
		.find((s) => (s.textContent ?? '').trim() === name);
	assert.ok(label, `"${name}" must be the trigger's own label`);
	return label as HTMLElement;
}

const NAMED_SIZE: Record<string, number> = { 'text-xs': 12, 'text-sm': 14, 'text-base': 16 };

/** The authored px size of an element, resolved from its own class list. */
function authoredPx(classList: string): number {
	const rem = /text-\[(\d+(?:\.\d+)?)rem\]/.exec(classList);
	if (rem) return Number(rem[1]) * 16;
	const px = /text-\[(\d+(?:\.\d+)?)px\]/.exec(classList);
	if (px) return Number(px[1]);
	for (const token of classList.split(/\s+/)) {
		if (token in NAMED_SIZE) return NAMED_SIZE[token];
	}
	throw new Error(`no authored font size in: ${classList}`);
}

test('10.1 RENDERED: every Building Explorer label is 14px, medium-or-stronger, and dark', async () => {
	const container = await renderModal(null);
	try {
		const names = ['Grade 9 Academic Wing', 'MAPEH and Wellness Hub', 'Admin and Learning Commons'];
		const rows: string[] = [];
		for (const name of names) {
			const trigger = explorerTrigger(container, name);
			const label = triggerLabel(trigger, name);

			assert.equal(
				authoredPx(label.className), 14,
				`"${name}" must be authored at 14px (text-sm), got "${label.className}"`,
			);
			assert.match(label.className, /\bfont-medium\b|\bfont-semibold\b/, `"${name}" must carry font-medium or font-semibold`);
			assert.doesNotMatch(label.className, /\bfont-normal\b|\bfont-light\b/, `"${name}" must not be normal or light weight`);
			// Dark, not the washed-out muted grey. `text-muted-foreground` is
			// forbidden on the LABEL in either state — the base put it there.
			assert.doesNotMatch(label.className, /text-muted-foreground/, `"${name}" must not be the washed-out muted grey`);
			assert.match(
				`${trigger.className} ${label.className}`,
				/text-slate-800|text-slate-900/,
				`"${name}" must be text-slate-800 or text-slate-900`,
			);
			rows.push(`${name}: ${label.className.replace(/\s+/g, ' ')}`);
		}
		assert.ok(rows.length === 3, `all three named buildings must be measured; measured ${rows.length}`);
	} finally {
		await act(async () => { root!.unmount(); });
		host!.remove();
	}
});

test('10.1 RENDERED: the trigger is a solid, centred row, not floating loose text', async () => {
	const container = await renderModal(null);
	try {
		// The collapsed treatment is the one the operator asked for as the
		// resting state, so this row reads whichever building the modal did NOT
		// auto-expand. The dialog sorts buildings by their leading number and then
		// by name, and two of the three fixtures carry no number at all, so which
		// one opens is not something a control should hard-code.
		const collapsed = [...explorerTriggers(container).values()]
			.find((t) => t.getAttribute('aria-expanded') === 'false');
		assert.ok(collapsed, 'at least one building row must be collapsed in this render');
		const trigger = collapsed!;
		const classList = trigger.className;
		assert.match(classList, /\bpy-2\.5\b/, `the row must use py-2.5, got ${classList}`);
		assert.match(classList, /\bpx-3\b/, `the row must use px-3, got ${classList}`);
		assert.match(classList, /\brounded-lg\b/, 'the row must stay a rounded-lg trigger');
		assert.match(classList, /\bitems-center\b/, 'the chevron can only be centred against the label with items-center');
		assert.match(classList, /\btransition-colors\b/, 'the requested hover treatment is a colour transition');
		assert.match(classList, /hover:bg-slate-100\/70/, `the hover state must be the requested slate tint, got ${classList}`);
		assert.match(classList, /hover:text-slate-900/, 'and the hover text must be slate-900');
		assert.doesNotMatch(classList, /transition-all/, 'transition-all is what the request replaced');
		// The chevron is an icon, and §8 forbids a raw unstyled control: it must
		// stay a lucide glyph, sized no smaller than the label it sits beside.
		const chevron = trigger.querySelector('svg');
		assert.ok(chevron, 'the chevron must be present');
		assert.match(chevron!.getAttribute('class') ?? '', /\bsize-4\b/, 'the chevron must be size-4 beside a 14px label');
		assert.match(chevron!.getAttribute('class') ?? '', /\bshrink-0\b/, 'and must not be squeezed by a long name');
	} finally {
		await act(async () => { root!.unmount(); });
		host!.remove();
	}
});

test('10.1 RENDERED: the EXPANDED parent keeps the same 14px and gains the stronger weight', async () => {
	// Rendered WITH a current room, so the modal opens on that building's
	// interior view and its explorer row is in the expanded state.
	const container = await renderModal(401);
	try {
		const triggers = explorerTriggers(container);
		const expanded = [...triggers.entries()].find(([, t]) => t.getAttribute('aria-expanded') === 'true');
		const collapsed = [...triggers.entries()].find(([, t]) => t.getAttribute('aria-expanded') === 'false');
		assert.ok(expanded, 'a building row must be expanded in this render');
		assert.ok(collapsed, 'and at least one must be collapsed');
		const [expandedName, expandedTrigger] = expanded!;
		const [collapsedName, collapsedTrigger] = collapsed!;

		const expandedLabel = triggerLabel(expandedTrigger, expandedName);
		const collapsedLabel = triggerLabel(collapsedTrigger, collapsedName);
		assert.equal(authoredPx(expandedLabel.className), 14, 'the expanded parent must stay 14px, not shrink back');
		assert.equal(authoredPx(collapsedLabel.className), 14, 'the collapsed parent is 14px too — the two must agree');
		assert.match(
			`${expandedLabel.className} ${expandedTrigger.className}`,
			/\bfont-semibold\b/,
			`the expanded parent must carry the stronger weight; label="${expandedLabel.className}" trigger="${expandedTrigger.className}"`,
		);
		assert.match(
			collapsedLabel.className,
			/\bfont-medium\b/,
			`and the collapsed parent keeps the medium floor the request asked for; got "${collapsedLabel.className}"`,
		);
		assert.match(expandedTrigger.className, /text-slate-900/, 'the expanded parent must be the darkest text');
		assert.match(collapsedTrigger.className, /text-slate-800/, 'and the collapsed parent text-slate-800, not the muted grey');
		// The rotation is the visual cue that the row is open; the base kept it.
		assert.match(expandedTrigger.querySelector('svg')!.getAttribute('class') ?? '', /rotate-90/, 'the expanded chevron must show it is open');
	} finally {
		await act(async () => { root!.unmount(); });
		host!.remove();
	}
});

test('10.1 RENDERED: the list is tightened, and the controls reject a base-shaped trigger', async () => {
	const container = await renderModal(null);
	try {
		// The operator named "excessive vertical padding and empty white space
		// around each row" as part of the defect, so the gap between building
		// rows must be the tight one.
		assert.ok(
			container.querySelector('.space-y-1'),
			'the explorer list container must be present',
		);
		assert.doesNotMatch(
			(explorerTrigger(container, 'MAPEH and Wellness Hub').parentElement?.parentElement?.className ?? ''),
			/space-y-4/,
			'the base gap of space-y-4 is the recorded defect',
		);
	} finally {
		await act(async () => { root!.unmount(); });
		host!.remove();
	}

	// Load-bearing: prove the assertions discriminate instead of passing on any
	// element. These are the BASE class strings, verbatim, run through the same
	// checks the rows above use.
	const base = 'w-full justify-between px-3 py-2 rounded-lg text-left transition-all hover:bg-muted text-muted-foreground font-medium';
	const baseLabel = 'text-xs';
	assert.equal(authoredPx(baseLabel), 12, 'precondition: the base label was 12px, not 14px');
	assert.doesNotMatch(`${base} ${baseLabel}`, /text-slate-800|text-slate-900/, 'precondition: the base had no dark colour');
	assert.doesNotMatch(base, /\bitems-center\b/, 'precondition: the base could not centre its chevron');
	assert.doesNotMatch(base, /hover:bg-slate-100\/70/, 'precondition: the base hover was the muted fill');
});
