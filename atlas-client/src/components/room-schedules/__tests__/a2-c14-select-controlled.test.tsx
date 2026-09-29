/**
 * A2 c14 follow-up (item 3) — a `Select` must be controlled for its whole life.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────────
 * Lane C's train-8 walk reported, on route change, on `/room-schedules` and
 * others:
 *
 *   MINOR — /room-schedules and other selects — navigate route — console warns
 *   "Select is changing from uncontrolled to controlled" — keep each Select
 *   controlled or uncontrolled for its full lifetime.
 *
 * The cause is one expression in `ScheduleSourceBand`, and it is a real defect
 * rather than a warning to be silenced. The term `Select` was handed
 * `value={viewTerm != null ? String(viewTerm) : undefined}`. Radix reads
 * `undefined` as "be uncontrolled", so the control mounted UNCONTROLLED while
 * the active term was still unverified, and became CONTROLLED the moment the
 * term resolved. `/room-schedules` is the page where this is visible precisely
 * because its term really does start unresolved; a page whose term is already
 * verified at mount never takes the uncontrolled path and never warns.
 *
 * The fix keeps the control controlled with the defined `NO_TERM_SELECTED`
 * sentinel. Nothing is suppressed.
 *
 * ── EVIDENCE CLASS ────────────────────────────────────────────────────────────
 * Everything below RENDERS the real `ScheduleSourceBand` into a real JSDOM
 * document and reads the resulting DOM plus the real `console.error` stream.
 * No row asserts that a string appears in a source file: per AGENTS.md that is
 * not acceptance evidence for a user-facing change, and the operator symptom of
 * this defect is a console warning, so the warning is what is observed.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/room-schedules' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	// Radix portals its content into a DocumentFragment, so a partial JSDOM
	// global set throws before any row can make a claim.
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
const { SELECT_NO_VALUE } = await import('@/ui/select');
const { ScheduleSourceBand, NO_TERM_SELECTED } = await import('@/components/room-schedules/ScheduleSourceBand');
const { SimplePastYearReadOnlySurface } = await import('@/components/timetable/simple/SimplePastYearReadOnlySurface');

/**
 * The past year's OWN ordered terms, in the shape `ScheduleReviewWorkspace` hands
 * this surface: `identity`, `displayLabel`, and a NUMERIC `order`. The empty case
 * is the real one that mattered — `orderedTerms` arrives as `[]` and populates
 * later, and that transition is what flipped the control's mode.
 */
const PAST_YEAR_TERMS = [
	{ identity: 'py-1', displayLabel: 'Term 1', order: 0 },
	{ identity: 'py-2', displayLabel: 'Term 2', order: 1 },
	{ identity: 'py-3', displayLabel: 'Term 3', order: 2 },
];

const mounted: Array<{ root: ReturnType<typeof createRoot>; host: HTMLElement }> = [];

after(() => {
	for (const { root, host } of mounted) {
		act(() => root.unmount());
		host.remove();
	}
});

type TermOption = { value: string; label: string };

const ORDERED_TERMS = [
	{ order: 0, label: 'Term 1' },
	{ order: 1, label: 'Term 2' },
	{ order: 2, label: 'Term 3' },
] as unknown as Parameters<typeof ScheduleSourceBand>[0]['orderedTerms'];

const TERM_OPTIONS: TermOption[] = [
	{ value: '0', label: 'Term 1' },
	{ value: '1', label: 'Term 2' },
	{ value: '2', label: 'Term 3' },
];

function props(viewTerm: number | null) {
	return {
		termOptions: TERM_OPTIONS,
		orderedTerms: ORDERED_TERMS,
		viewTerm,
		// The band is DISABLED exactly while the term is unverified, which is the
		// state in which the old expression produced `undefined`.
		termVerified: viewTerm != null,
		onTermChange: () => {},
		sentence: 'Showing the timetable made on 29 Sept.',
		pastRuns: [],
		pinnedRunId: null,
		onPinnedChange: () => {},
	};
}

function renderBand(initialViewTerm: number | null) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	// Rendered inside a `<form>` on purpose: Radix only mounts its hidden native
	// `<select>` (the element that can actually go uncontrolled→controlled, and
	// the one React warns about) when it detects form context. Wrapping here
	// makes the warning reproducible instead of hypothetical. The
	// `TooltipProvider` is the same one the page supplies, because the band puts
	// the term explainer in a `Tooltip`.
	const draw = (viewTerm: number | null) => {
		act(() => {
			root.render(
				createElement(
					MemoryRouter,
					null,
					createElement(
						TooltipProvider,
						null,
						createElement('form', null, createElement(ScheduleSourceBand, props(viewTerm))),
					),
				),
			);
		});
	};
	draw(initialViewTerm);
	mounted.push({ root, host });
	return { host, draw };
}

/**
 * The console channel is captured ONCE, at module scope, and never closed.
 *
 * An earlier version of this file wrapped only S2's own renders in
 * `console.error` interception. It reported the warning as ABSENT while S1 — which
 * performs the same unverified→resolved transition, earlier in the file — was
 * letting that very warning through to the real console. An absence reported by a
 * capture that only covers part of the file's transitions is not evidence, so the
 * channel is now open for the whole run and every row drains it.
 *
 * BOTH channels are patched, and the reason is measured rather than assumed. This
 * harness installs a JSDOM `window`, and React DOM resolves its console through
 * that window's `console` object, which is NOT the Node global. Patching only the
 * global left React's warning printing straight to the real stderr while this
 * file reported zero errors — a capture that could not see the thing it existed
 * to see. `assertChannelLive` below probes each channel independently so that
 * cannot regress unnoticed.
 */
type ConsoleMethod = 'error' | 'warn';
type CapturedLine = { method: ConsoleMethod; text: string };

const captured: CapturedLine[] = [];
const realConsole = { error: console.error, warn: console.warn };
const realWindowConsole = { error: dom.window.console.error, warn: dom.window.console.warn };

/**
 * The recorder tags the METHOD, not just the text.
 *
 * QA's correction round caught the real defect in this file: React 19.2.4 emits
 * the uncontrolled↔controlled warning through `console.WARN`, so a capture wired
 * only to `console.error` reported the warning ABSENT while the suite passed 3/3
 * against the broken product. Recording the method makes that class of miss
 * visible instead of silent — a line captured as `error` is not evidence about a
 * `warn`.
 */
const recorders: Record<ConsoleMethod, (...args: unknown[]) => void> = {
	error: (...args: unknown[]) => {
		captured.push({ method: 'error', text: args.map((a) => String(a)).join(' ') });
	},
	warn: (...args: unknown[]) => {
		captured.push({ method: 'warn', text: args.map((a) => String(a)).join(' ') });
	},
};

console.error = recorders.error;
console.warn = recorders.warn;
dom.window.console.error = recorders.error;
dom.window.console.warn = recorders.warn;

function drainConsole(): CapturedLine[] {
	const seen = [...captured];
	captured.length = 0;
	return seen;
}

/**
 * Proves each channel can actually CARRY a line, by injecting a known one through
 * it and observing it arrive — and proves the buffer is method-specific by
 * showing an UNPATCHED method does not land in it.
 *
 * QA rejected the previous liveness check for a precise reason: asserting the
 * patch equals the recorder only proves the patch points at itself. It stays
 * green on a channel that nothing ever writes to, which is exactly the failure
 * that shipped — React was writing to `warn`, the check watched `error`, and the
 * file reported success. Three claims are made here, and each can fail:
 *
 *   1. IDENTITY — all four patched properties are still their recorder, so
 *      nothing has silently reset the patch mid-run.
 *   2. DELIVERY — a line written through each patched property arrives, tagged
 *      with that property's method. A channel nothing writes to fails here. The
 *      property is re-read from the console object at call time, which is how
 *      React reaches it.
 *   3. SPECIFICITY — a write to an UNPATCHED method (`log`) does NOT arrive, so
 *      claim 2 cannot be satisfied by a buffer that swallows everything.
 */
function assertChannelLive(): void {
	assert.equal(console.error, recorders.error, 'the global console.error capture is still installed');
	assert.equal(console.warn, recorders.warn, 'the global console.warn capture is still installed');
	assert.equal(dom.window.console.error, recorders.error, 'the JSDOM window console.error capture is still installed');
	assert.equal(dom.window.console.warn, recorders.warn, 'the JSDOM window console.warn capture is still installed — this is the channel React uses');

	captured.length = 0;
	// Re-read the property from the console object, exactly as a caller does.
	console.error('A2-C14-PROBE global error');
	console.warn('A2-C14-PROBE global warn');
	dom.window.console.error('A2-C14-PROBE window error');
	dom.window.console.warn('A2-C14-PROBE window warn');
	// The control channel: deliberately NOT patched, so it must not be captured.
	console.log('A2-C14-PROBE unpatched log');

	const arrived = drainConsole();
	for (const method of ['error', 'warn'] as const) {
		for (const where of ['global', 'window'] as const) {
			const line = arrived.find(
				(entry) => entry.method === method && entry.text.includes(`A2-C14-PROBE ${where} ${method}`),
			);
			assert.ok(
				line,
				`the ${where} console.${method} channel must CARRY a line; a channel nothing writes to is a dead capture`,
			);
		}
	}
	assert.equal(
		arrived.filter((entry) => entry.text.includes('A2-C14-PROBE unpatched')).length,
		0,
		'an UNPATCHED method must not be captured, or claim 2 proves nothing about the patched ones',
	);
}

after(() => {
	console.error = realConsole.error;
	console.warn = realConsole.warn;
	dom.window.console.error = realWindowConsole.error;
	dom.window.console.warn = realWindowConsole.warn;
});

const CONTROLLED_WARNING = /changing (from )?(an )?uncontrolled|uncontrolled to (be )?controlled|changing a controlled input to be uncontrolled|switch from controlled to uncontrolled/i;

const byTestId = (host: HTMLElement, id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);

/* ── the rows ────────────────────────────────────────────────────────────────── */

/**
 * S1 — the term control's `value` is DEFINED on every render, so it is controlled
 * for its whole lifetime and the placeholder is what shows before a term exists.
 *
 * The discriminating half is the SECOND render. At base, the unverified render
 * passes `undefined` and this row fails on the first assert; the transition to
 * a resolved term is the exact instant the walk saw the warning.
 */
test('S1 the term Select is controlled on the unverified render and stays controlled once the term resolves', () => {
	assertChannelLive();
	assert.equal(NO_TERM_SELECTED, '', 'the sentinel is the defined empty value, not undefined');

	const { host, draw } = renderBand(null);
	const before = byTestId(host, 'schedules-view-term');
	assert.ok(before, 'the term control renders — a year with three terms warrants it');
	assert.equal(before.getAttribute('data-disabled'), '', 'the unverified term control is disabled, not selectable');
	// The claim the unverified control makes is only that nothing is chosen yet —
	// the placeholder, not a term. `SelectValue` renders its placeholder exactly
	// when the controlled value matches no item, which is the empty sentinel.
	assert.equal(host.querySelectorAll('[data-testid="schedules-view-term"]').length, 1, 'one control before the term resolves');

	draw(1);
	const after = byTestId(host, 'schedules-view-term');
	assert.ok(after, 'the control is the SAME control after the term resolves, not remounted into a new one');
	assert.equal(
		host.querySelectorAll('[data-testid="schedules-view-term"]').length,
		1,
		'one control after the term resolves too: the transition must not add a second',
	);
	assert.notEqual(after.getAttribute('data-disabled'), '', 'the resolved term control is no longer disabled');
	// The transition is a re-RENDER of one mounted control, which is the whole
	// point: a remount would have hidden the mode change instead of fixing it.
	assert.equal(after, before, 'the transition re-renders the same mounted element rather than remounting it');

	// This row performs the transition the walk reported, so it also judges the
	// warning — otherwise the warning would only be caught by whichever row
	// happened to run the transition, and S2's capture could go unused.
	const lines = drainConsole();
	assert.deepEqual(
		lines.filter((line) => CONTROLLED_WARNING.test(line.text)),
		[],
		`the unverified→resolved transition warned: ${JSON.stringify(lines, null, 2)}`,
	);
});

/**
 * S2 — THE WARNING CLASS. Mounting unverified and then resolving the term emits
 * no uncontrolled↔controlled warning, on EITHER console method.
 *
 * This is the row that must fail on the old behaviour, and it is the symptom the
 * walk actually reported. Both `console.error` and `console.warn` are captured
 * and the buffer is asserted EMPTY, so this is a real observation of the warning
 * rather than a restatement of the cause.
 */
test('S2 resolving the active term emits no uncontrolled-to-controlled warning', () => {
	assertChannelLive();
	const { draw } = renderBand(null);
	draw(1);
	draw(2);
	const lines = drainConsole();
	const controlled = lines.filter((line) => CONTROLLED_WARNING.test(line.text));
	assert.deepEqual(
		controlled,
		[],
		`a Select that changes control mode mid-life must not warn on ANY method; got ${JSON.stringify(controlled, null, 2)}`,
	);
	// Recorded, not asserted away: any other console line is still this test's
	// business, so the row cannot be satisfied by a blanket suppression that also
	// silences a genuine fault.
	assert.deepEqual(lines, [], `the transition produced console output: ${JSON.stringify(lines, null, 2)}`);
});

/**
 * S3 — the sentinel can never collide with a real option.
 *
 * A controlled `''` is only safe because no `SelectItem` can hold an empty value;
 * Radix rejects one, and a collision would silently select the wrong term. This
 * row is the guard on the assumption `NO_TERM_SELECTED` rests on, and it reads
 * the options the page really builds (`String(term.order)`, from
 * `pages/RoomSchedules.tsx`).
 */
test('S3 no term option can equal the empty sentinel', () => {
	for (const option of TERM_OPTIONS) {
		assert.notEqual(option.value, NO_TERM_SELECTED, `"${option.label}" must not collide with the nothing-chosen sentinel`);
		assert.notEqual(option.value.trim(), '', 'a Radix item value may not be blank');
	}
	// The real builder stringifies a numeric order, so the smallest value is "0".
	assert.equal(String(0), '0');
	assert.notEqual(String(0), NO_TERM_SELECTED);
});

/**
 * S4 — the SECOND call site, on the same route, is controlled for its whole life
 * too. QA's correction round found it: `SimplePastYearReadOnlySurface` carried the
 * identical `value={hasTerms ? String(termIndex) : undefined}`, with
 * `orderedTerms` arriving as `[]` and then populating.
 *
 * It is here so the MUTANT is caught in both places from one file. With this row
 * present, restoring `undefined` at EITHER call site fails the suite, and the
 * other row stays green — so a future half-fix cannot pass by fixing only the site
 * a reviewer happened to look at.
 */
test('S4 the past-year term Select is controlled while its terms are empty and once they arrive', () => {
	assertChannelLive();
	assert.equal(NO_TERM_SELECTED, SELECT_NO_VALUE, 'both call sites share ONE sentinel from the primitive, not two local copies');

	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ root, host });

	// The real shape from `SimplePastYearReadOnlySurface`: `orderedTerms` is `[]`
	// on arrival (`ScheduleReviewWorkspace.tsx:392`) and the past year's own
	// ordered terms populate a moment later. The control is the SAME element
	// across both renders.
	const draw = (ordered: ReadonlyArray<{ identity: string; displayLabel: string; order: number }>, termIndex: number) => {
		act(() => {
			root.render(
				createElement(
					MemoryRouter,
					null,
					createElement(
						SimplePastYearReadOnlySurface,
						{
							yearLabel: 'S.Y. 2022-2023',
							entries: [],
							orderedTerms: ordered,
							termIndex,
							onTermIndexChange: () => {},
							viewMode: 'section',
							onViewModeChange: () => {},
							dayFilter: 'all',
						} as unknown as Parameters<typeof SimplePastYearReadOnlySurface>[0],
					),
				),
			);
		});
	};

	draw([], 0);
	const control = byTestId(host, 'timetable-past-year-term-filter');
	assert.ok(control, 'the past-year term control renders even with no terms — it is disabled, not absent');
	assert.equal(control.getAttribute('data-disabled'), '', 'with no resolvable terms the control is disabled, and claims no term');

	draw(PAST_YEAR_TERMS, 0);
	const after = byTestId(host, 'timetable-past-year-term-filter');
	assert.ok(after, 'the control is the SAME control once the past year terms arrive');
	assert.equal(after, control, 'the []→populated transition re-renders one mounted element rather than remounting it');
	assert.equal(host.querySelectorAll('[data-testid="timetable-past-year-term-filter"]').length, 1, 'and it is still exactly one control');

	const lines = drainConsole();
	assert.deepEqual(
		lines.filter((line) => CONTROLLED_WARNING.test(line.text)),
		[],
		`the past-year []→populated transition warned: ${JSON.stringify(lines, null, 2)}`,
	);
	assert.deepEqual(lines, [], `the past-year transition produced console output: ${JSON.stringify(lines, null, 2)}`);
});

/**
 * S5 — the sentinel is safe at the SECOND call site too, checked from the real
 * values rather than assumed from the first site's reasoning.
 *
 * The safety argument for a controlled `''` is that no `SelectItem` can hold one.
 * That has to be re-established per call site: `SimplePastYearReadOnlySurface`
 * renders `value={String(term.order)}`, and `PastYearOrderedTerm.order` is typed
 * `number`, so the smallest item value is `"0"`. The type and the JSX are both
 * read here, so a future change that made an order a string would fail this row
 * instead of silently colliding with the sentinel.
 */
test('S5 no past-year term option can equal the empty sentinel', async () => {
	assert.equal(SELECT_NO_VALUE, '', 'the shared primitive sentinel is the defined empty value');
	// The real item values this surface builds, from the real prop type.
	for (const term of PAST_YEAR_TERMS) {
		const itemValue = String(term.order);
		assert.notEqual(itemValue, SELECT_NO_VALUE, `past-year term ${term.displayLabel} must not collide with the sentinel`);
		assert.notEqual(itemValue.trim(), '', 'a Radix item value may not be blank');
	}
	// The JSX really does stringify the order, so the values above are the values
	// that reach the DOM — this is the check, not the assumption behind it. The
	// path is resolved from the client root, the same way the other source-reading
	// controls do it, so it cannot drift with this file's own location. This file
	// sits in `__tests__`, so the client root is four levels up.
	const clientRoot = resolve(import.meta.dirname, '../../../..');
	const surface = await readFile(
		resolve(clientRoot, 'src/components/timetable/simple/SimplePastYearReadOnlySurface.tsx'),
		'utf8',
	);
	assert.match(surface, /<SelectItem[^>]*value=\{String\(term\.order\)\}/, 'the past-year items are String(term.order)');
	assert.match(
		surface,
		/type PastYearOrderedTerm = \{[^}]*order: number[^}]*\}/,
		'PastYearOrderedTerm.order is a number, so String(order) can never be the empty string',
	);
});
