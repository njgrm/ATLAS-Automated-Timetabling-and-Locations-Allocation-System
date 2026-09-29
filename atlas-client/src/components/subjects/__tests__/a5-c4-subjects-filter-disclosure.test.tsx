/**
 * A5 C7 ITEM 43 (2026-09-29) — `/subjects` filters: ALL FIVE in one row, and the
 * `More filters` disclosure is gone.
 *
 * ## WHAT CHANGED, AND WHY THIS FILE WAS REWRITTEN INSTEAD OF DELETED
 *
 * This file was `a5-c4-subjects-filter-disclosure.test.tsx`. Its subject — the
 * disclosure — no longer exists: A5 C4 read Lane C's Codex line "keep Grade and
 * Program visible and put the other filters under 'More filters'" as authority and
 * shipped the disclosure; the operator then used the page and filed the disclosure
 * itself (fix-3 item 43). A scheduler had to CLICK a button to discover the page
 * was filtered, and that button carried a `(n)` count — a number an older,
 * mouse-first scheduler does not read off a filter bar.
 *
 * `AGENTS.md` §16: "Corrections are additive to evidence, never subtractive. Never
 * delete an assertion, control, or evidence row to close a finding." So NOTHING here
 * was deleted to make a test pass. Every A5 C4 row is accounted for in the SUPERSEDED
 * MAP below, with the property it protected named, and a replacement row that
 * asserts what now holds. The map is the record; the rows below it are the evidence.
 *
 * ## THE SUPERSEDED MAP — one line per A5 C4 row, all still decided
 *
 *   A5-C4-2a  "Grade + Program visible, Status/Room/Term NOT in the row"
 *     SUPERSEDED IN BEHAVIOUR, inverted on purpose: item 43 puts all five in the row.
 *     THE PROPERTY IS UNCHANGED AND STILL ASSERTED: the row shows exactly the filters
 *     the page offers, it offers no filter twice, and it offers no filter that was
 *     only ever reachable by hunting. Now: `A5-C7-2a`.
 *   A5-C4-2b  "ONE disclosure; opening it reveals all three operable filters"
 *     SUPERSEDED IN BEHAVIOUR — there is no disclosure to open, which is the fix.
 *     THE PROPERTY IS UNCHANGED AND STILL ASSERTED, and is now STRONGER: each of the
 *     five is individually operable from the closed row, with no intermediate click.
 *     Now: `A5-C7-2b`.
 *   A5-C4-2c  "the disclosure names the state: `More filters (n)`"
 *     SUPERSEDED, and this is the item itself. A count badge on a grouping button was
 *     the thing the operator could not read. THE PROPERTY IT WAS PROXYING FOR — a SET
 *     filter is never invisible — is now structural rather than numeric: every filter
 *     is permanently visible, so there is nothing to count and nothing to hide.
 *     Now: `A5-C7-2c`.
 *   A5-C4-2d  "opening the disclosure changes NO filter"
 *     KEPT VERBATIM IN INTENT, retargeted: RENDERING the row changes no filter, and
 *     opening any picker's own listbox still changes none. Now: `A5-C7-2d`.
 *   A5-C4-2e  "Reset appears when any filter is set and clears all five"
 *     KEPT VERBATIM. Untouched by item 43.
 *   A5-C4-2f  "nothing in the row is truncated" + "Escape closes the disclosure"
 *     KEPT, the truncation half strengthened (all five visible at once instead of
 *     three behind a popover) and the Escape half retargeted: with no disclosure
 *     there is nothing to trap a keyboard user in, and a picker's own popover still
 *     closes on Escape. Now: `A5-C7-2f`.
 *   A5-C4-2i  "the disclosure is the SHARED picker trigger, not a hand-written look"
 *     SUPERSEDED in subject, KEPT AND WIDENED. The F2 finding was a `@/ui/button`
 *     carrying a page-local class string. That class string is deleted with the
 *     disclosure, so that exact defect cannot recur — and the rule it was enforcing
 *     is now asserted over all FIVE pickers instead of one button. Now: `A5-C7-2i`.
 *   A5-C4-2j  "the DYNAMIC label is never ellipsised, truncated or clipped"
 *     SUPERSEDED: the row has no dynamic label any more. There was a real defect
 *     hiding behind it — a control whose label CHANGES LENGTH was covered by no
 *     truncation row, because 2f only iterated `[role="combobox"]` and the disclosure
 *     was not one. The replacement covers the same class of risk in its only
 *     remaining form here: the LONGEST STATIC face each picker can compose
 *     (`Status: Room-constrained`, `Program: …`) inside the shared `md` rectangle.
 *     Now: `A5-C7-2j`.
 *   A5-C4-2g  "c3 slice-B B1: the disclosure adds NO selection path of its own"
 *     KEPT AND STRENGTHENED. There is now no non-`@/ui` selection path on the page at
 *     all, so the guard is total rather than comparative. Now: `A5-C7-2g`.
 *   A5-C4-2h  "c3 slice-B B2: no control claims `All` for a list with no `all` member"
 *     KEPT VERBATIM. It was about the Term picker's option list, not the disclosure.
 *
 * ## THE TWO c3 SLICE-B REGRESSIONS THIS MUST NOT REINTRODUCE
 *
 * Both were re-checked for A5 C7 and both are now asserted with less indirection,
 * because a filter is now REACHED DIRECTLY rather than through a disclosure:
 *   - B1 `Enter` must not be able to select a `disabled` option.
 *   - B2 no control may claim `All` for a filter that offers no such choice.
 *
 * ## WHAT jsdom STILL CANNOT DECIDE, AND WHERE IT IS DECIDED INSTEAD
 *
 * "The row is ONE LINE at 1366x768" is a layout claim, and jsdom has no layout
 * engine. The class contract and the width arithmetic that backs it are asserted
 * here (`A5-C7-2k`); the rendered, measured, no-wrap result is the 1366x768 browser
 * capture in `docs/reviews/a5-c7-subjects-20260929/`, against real staging data.
 * Neither substitutes for the other and neither is dressed up as the other.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act } from 'react';
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
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	/* Before React is imported below: the synthetic event plugin list is built at
	 * import time, so a late `PointerEvent` is invisible to `onPointerDown`. */
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	SVGElement: dom.window.SVGElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLLabelElement: dom.window.HTMLLabelElement,
	DOMParser: dom.window.DOMParser,
	NodeList: dom.window.NodeList,
	AbortController: dom.window.AbortController,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	DOMRectReadOnly: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window as unknown as { innerWidth: number }).innerWidth = 1366;
(dom.window as unknown as { innerHeight: number }).innerHeight = 768;
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { click: () => void }).click = function click(this: HTMLElement) {
	this.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
};
(dom.window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = dom.window.MouseEvent;

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { SubjectFilterToolbar } = await import('../SubjectFilterToolbar');

/** The real subject-derived term options shape, from the page's own module. */
const TERM_OPTIONS = [
	{ value: 'all', label: 'All terms', kind: 'all' as const },
	{ value: '1', label: 'Term 1', kind: 'term' as const },
	{ value: '2', label: 'Term 2', kind: 'term' as const },
];

/**
 * A5 C7: the five filters' own `data-testid`s, where the page declares one.
 *
 * `Status`, `Room` and `Program` declare their own; `Grade` and `Term` never did and
 * are reached by their composed accessible name, which is what A5 C3's contract makes
 * stable. Listing the three here is what lets a row say "this filter LOST its handle"
 * without hard-coding a testid into an assertion that would then also fail for a
 * picker that legitimately never had one.
 */
const DECLARED_TEST_IDS = ['subjects-program-filter', 'subjects-status-filter', 'subjects-room-type-filter'];

let root: Root | null = null;
let hostEl: HTMLElement | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	hostEl?.remove();
	dom.window.close();
});

/**
 * `render`, returning the HOST element.
 *
 * A5 C7 added the return value: the width-budget row needs to scope several reads to
 * this render's own subtree rather than to `document.body`, so that a control left
 * over from an earlier test could not be counted into this one's arithmetic. It is
 * additive — every existing caller ignores the return value.
 */
async function render(node: React.ReactNode): Promise<HTMLElement> {
	await unmount();
	hostEl = document.createElement('div');
	document.body.appendChild(hostEl);
	root = createRoot(hostEl);
	await act(async () => { root?.render(node); });
	return hostEl;
}

async function unmount(): Promise<void> {
	if (root) await act(async () => { root?.unmount(); });
	root = null;
	hostEl?.remove();
	hostEl = null;
}

/**
 * `render`, plus an INTERACTION before the read.
 *
 * An interaction must happen while the tree IS mounted; the assertions must happen
 * after it is unmounted, or a throw while React is still mounted leaves the runner
 * unable to reach an idle event loop and the failure surfaces as a bare
 * `test failed` with no message. This helper is the seam between the two: the
 * interaction runs inside, the read returns PLAIN DATA, and the caller asserts after
 * the tree is gone.
 */
async function interactiveSnapshot<T>(
	node: React.ReactNode,
	interact: () => Promise<void>,
	read: (host: HTMLElement) => T,
): Promise<T> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	await act(async () => { root.render(node); });
	let value: T;
	try {
		await interact();
		value = read(host);
	} finally {
		await act(async () => { root.unmount(); });
		host.remove();
	}
	return value;
}

/** A real pointer sequence, the way a mouse opens a control. */
async function press(target: Element | null): Promise<void> {
	assert.ok(target, 'the element to press is not in the document');
	await act(async () => {
		target!.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
		target!.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
		target!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
	});
	await act(async () => { await Promise.resolve(); });
}

/**
 * Close whatever picker is still open, the way a real user clicks away.
 *
 * A5 C4 documented the exact hazard: `@/ui/filter-picker` is built on a Radix
 * POPOVER, and a modal popover left mounted makes the rest of the document
 * `pointer-events: none`, so the NEXT click in a sequence lands on an inert body and
 * the control under test appears not to open. A5 C4 could hide this behind its
 * disclosure; A5 C7 removes the disclosure and therefore removes the escape hatch, so
 * every step in a multi-picker row closes first. This is harness hygiene and it
 * weakens no assertion: the value each choice delivers is still asserted below.
 */
async function closeAnyOpenPicker(): Promise<void> {
	await act(async () => {
		document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});
	await act(async () => { await Promise.resolve(); });
}

/**
 * Strip JS/TS comments, so a source-level assertion decides about CODE and not about
 * this repository's unusually heavy prose.
 *
 * A5 C7 needed this and the reason is worth recording, because a naive whole-file
 * string match is red against a file that is CORRECT: this toolbar's layout note
 * names the removed heading, the removed testid and the removed `useState` in prose,
 * as `AGENTS.md` §16 requires the record of a removal to survive. Regex alone cannot
 * distinguish that record from live code. Comments are blanked to a newline instead of
 * being deleted, so every line number and every `[\s\S]*?` span still matches what it
 * matched before.
 */
function stripJsComments(input: string): string {
	return input
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/(^|[^:])\/\/[^\n]*/g, (_m, prefix: string) => prefix);
}

/**
 * Press a picker by its composed accessible name and return the EXACT listbox it
 * opened, resolved through that trigger's own `aria-controls`.
 *
 * Why not `document.body.querySelector('[role="listbox"]')`, which is what A5 C4 and
 * every other suite in this folder does: that returns the FIRST listbox in the
 * document, and a Radix popover that has been opened and closed can stay MOUNTED. The
 * first version of this row pressed five pickers in sequence and the fourth read a
 * stale, closed panel (or none at all) and reported "the Room picker did not open" —
 * a failure in the row's plumbing, not in the control, and exactly the kind that
 * invites a "fix" that weakens the assertion. `aria-controls` is the relationship the
 * trigger itself publishes, so this cannot be satisfied by the wrong panel.
 */
async function openPicker(composedName: string): Promise<HTMLElement> {
	const trigger = document.body.querySelector(`[aria-label="${composedName}"]`);
	assert.ok(trigger, `the "${composedName}" picker is not in the row`);
	await press(trigger);
	const listboxId = trigger.getAttribute('aria-controls');
	assert.ok(
		listboxId,
		`pressing "${composedName}" did not publish an \`aria-controls\`, so the row is not wired to a listbox`,
	);
	const listbox = document.getElementById(listboxId!);
	assert.ok(
		listbox,
		`pressing "${composedName}" opened no listbox of its own (looked for #${listboxId})`,
	);
	return listbox as HTMLElement;
}

/** An `[role="option"]` in `listbox` whose visible text is exactly `label`. */
function optionIn(listbox: HTMLElement, label: string): HTMLElement {
	const option = (Array.from(listbox.querySelectorAll('[role="option"]')) as HTMLElement[]).find(
		(o) => (o.textContent ?? '').trim() === label,
	);
	assert.ok(option, `"${label}" is not offered (offered: ${(Array.from(listbox.querySelectorAll('[role="option"]')) as HTMLElement[]).map((o) => (o.textContent ?? '').trim()).join(' | ')})`);
	return option!;
}

function byTestId(id: string): HTMLElement | null {
	return document.body.querySelector(`[data-testid="${id}"]`);
}
/** Scoped to one render's own host, so a leftover from an earlier test cannot count. */
function query(host: HTMLElement, id: string): HTMLElement | null {
	return host.querySelector(`[data-testid="${id}"]`);
}
/** The one wrapping cluster the row's filters live in. */
function cluster(): HTMLElement | null {
	return byTestId('subjects-filter-cluster');
}
function triggerText(el: Element | null): string {
	return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The `role=combobox` triggers currently in the document, in render order. */
function allComboboxes(): HTMLElement[] {
	return Array.from(document.body.querySelectorAll('[role="combobox"]')) as HTMLElement[];
}
/** The `role=combobox` triggers INSIDE the one cluster — i.e. the visible row. */
function clusterComboboxes(): HTMLElement[] {
	return Array.from(cluster()?.querySelectorAll('[role="combobox"]') ?? []) as HTMLElement[];
}
/** The composed accessible names of the visible row's five triggers, in order. */
function clusterAriaNames(): string[] {
	return clusterComboboxes().map((t) => t.getAttribute('aria-label') ?? '');
}

/**
 * A5 C7: assert there is NO `More filters` disclosure anywhere in the document.
 *
 * This is the REPLACEMENT for A5 C4's `moreFiltersButton()` helper, and it is a
 * positive assertion rather than an absence of one: it finds a control whose visible
 * label begins `More filters`, and fails naming exactly what it found. A5 C4 could not
 * express this — on A5 C4 the disclosure was required to exist, so there was no
 * version of this helper that could pass. It matches on VISIBLE TEXT rather than on
 * the old `data-testid`, so it also catches a disclosure that comes back under a
 * different testid.
 */
function assertNoDisclosure(where: string): void {
	const disclosures = (Array.from(document.body.querySelectorAll('button')) as HTMLElement[]).filter((b) =>
		/^More filters/.test(triggerText(b)),
	);
	assert.equal(
		disclosures.length,
		0,
		`${where}: a \`More filters\` disclosure is back in the row (${disclosures.length} found: ` +
			`"${disclosures.map((b) => triggerText(b)).join(' | ')}"). Item 43 removed it because a ` +
			'scheduler had to click a button to discover the page was filtered.',
	);
}

function toolbarFor(overrides: Record<string, unknown> = {}) {
	return (
		<MemoryRouter>
			<SubjectFilterToolbar
				searchQuery=""
				onSearchChange={() => {}}
				hasActiveFilters={false}
				subjectStatusFilter="all"
				onSubjectStatusFilterChange={() => {}}
				roomTypeFilter="all"
				onRoomTypeFilterChange={() => {}}
				gradeLevelFilter="all"
				onGradeLevelFilterChange={() => {}}
				programScopeFilter="all"
				onProgramScopeFilterChange={() => {}}
				termFilter="all"
				onTermFilterChange={() => {}}
				termOptions={TERM_OPTIONS}
				onResetFilters={() => {}}
				{...overrides}
			/>
		</MemoryRouter>
	);
}

// ─────────────────────────────────────────────────────────────────────────────

test('A5-C7-2a: ALL FIVE filters are in the one visible row, with no interaction and no disclosure', async () => {
	// REPLACES A5-C4-2a, which asserted the OPPOSITE for three of the five ("Status,
	// Room and Term are NOT in the row"). That assertion is the thing item 43
	// reverses, and it is recorded verbatim in this file's SUPERSEDED MAP.
	//
	// FAILING-FIRST against A5 C4: on A5 C4 only two of these five were in the
	// cluster, and the first count assertion below is red.
	await render(toolbarFor());

	const names = clusterAriaNames();
	assert.deepEqual(
		names,
		[
			'Filter by grade level: All grades',
			'Filter by program scope: All programs',
			'Filter by subject status: All statuses',
			'Filter by room type: All room types',
			'Filter by rotation term: All terms',
		],
		'the row does not carry all five filters, in order, with no interaction required',
	);
	// AND nothing is duplicated: a filter offered twice is a control a scheduler
	// compares against itself. This is checked over the whole DOCUMENT, not the
	// cluster, so a second copy behind something else would still be caught.
	assert.equal(allComboboxes().length, 5, `expected exactly 5 filters in the document, found ${allComboboxes().length}`);
	// The disclosure is gone from the document entirely.
	assertNoDisclosure('with nothing set');
	await unmount();
});

test('A5-C7-2b: each of the five is INDIVIDUALLY OPERABLE from the closed row — no intermediate click', async () => {
	// REPLACES A5-C4-2b ("opening the disclosure reveals all three operable
	// filters"). The property it protected is unchanged and is now stronger: A5 C4
	// had to prove the three were operable AFTER a click, so a filter that was only
	// reachable through the disclosure counted. Here a filter that required a second
	// control to become reachable would fail.
	//
	// The values chosen go to DIFFERENT axes, so a row that passed all five by
	// accidentally firing the same handler could not pass.
	const fired: string[] = [];
	const record = (overrides: Record<string, unknown>) => toolbarFor({
		hasActiveFilters: true,
		...overrides,
		onGradeLevelFilterChange: (v: number | 'all') => fired.push(`grade:${v}`),
		onProgramScopeFilterChange: (v: string) => fired.push(`program:${v}`),
		onSubjectStatusFilterChange: (v: string) => fired.push(`status:${v}`),
		onRoomTypeFilterChange: (v: string) => fired.push(`room:${v}`),
		onTermFilterChange: (v: string) => fired.push(`term:${v}`),
	});

	/* ONE FRESH RENDER PER PICKER, and this is the repo's OWN documented remedy for
	 * the nested-popover teardown race rather than a new one. `@/ui/filter-picker` is
	 * a Radix POPOVER, and a modal popover that has just closed can still have the
	 * rest of the document at `pointer-events: none` when the next `pointerdown`
	 * arrives — the race `a5-subjects-c1.test.tsx` records as "Unmounting removes the
	 * teardown instead of racing it".
	 *
	 * The first version of this row pressed all five triggers inside ONE mounted tree
	 * and reported "the Status picker did not open" / "the Room picker did not open"
	 * on different runs: a plumbing failure that looks exactly like a broken control
	 * and invites exactly the wrong fix. Remounting per step removes the race rather
	 * than asserting around it, and it does NOT weaken the property: every step still
	 * mounts the CLOSED row, resolves the trigger from that fresh tree, and presses it
	 * ONCE — which is the whole claim of this row.
	 */

	// (1) GRADE. The shared compact DepEd form, not `Grade 7`.
	await render(record({}));
	await press(optionIn(await openPicker('Filter by grade level: All grades'), 'GR7'));
	assert.ok(fired.includes('grade:7'), `a grade chosen in the row did not reach the page (got ${fired.join(',')})`);

	// (2) PROGRAM. The rendered `label` (`BEC`) is what the scheduler picks; the
	// STORED code (`REGULAR`) is what must reach the page.
	await render(record({}));
	await press(optionIn(await openPicker('Filter by program scope: All programs'), 'BEC'));
	assert.ok(
		fired.includes('program:REGULAR'),
		`a program chosen in the row did not reach the page with the STORED value (got ${fired.join(',')})`,
	);

	// (3) STATUS. The MERGED axis: lifecycle AND coverage attention. A5-C1's own
	// exhaustive option-union and per-value assertions live in
	// `a5-subjects-c1.test.tsx` and are unchanged; this row only proves the control
	// is reachable in the row and that a choice on the ATTENTION half arrives.
	await render(record({}));
	await press(optionIn(await openPicker('Filter by subject status: All statuses'), 'Missing teacher coverage'));
	assert.ok(
		fired.includes('status:missing-coverage'),
		`choosing the coverage-attention value in the row did not reach the page (got ${fired.join(',')})`,
	);

	// (4) ROOM. The FULL catalogue, un-narrowed, and a real choice from it.
	await render(record({}));
	await press(optionIn(await openPicker('Filter by room type: All room types'), 'Science Laboratory'));
	assert.ok(fired.includes('room:LABORATORY'), `a room type chosen in the row did not reach the page (got ${fired.join(',')})`);

	// (5) TERM. The DERIVED option list, not a hard-coded term count.
	await render(record({}));
	await press(optionIn(await openPicker('Filter by rotation term: All terms'), 'Term 2'));
	assert.ok(fired.includes('term:2'), `a term chosen in the row did not reach the page (got ${fired.join(',')})`);

	// Every step reached its filter in ONE press with the row closed and untouched by
	// any disclosure, so none can have needed a `More filters` button.
	assert.deepEqual(
		[...fired].sort(),
		['grade:7', 'program:REGULAR', 'room:LABORATORY', 'status:missing-coverage', 'term:2'],
		'exactly the five expected values must reach the page, one per filter, with no duplicates',
	);
	await unmount();
});

test('A5-C7-2c: a SET filter is never invisible — because every filter is always visible', async () => {
	// REPLACES A5-C4-2c ("the disclosure names the state: `More filters (1)`"). That
	// row existed because a SET filter could be behind a button, so the badge was
	// carrying the fact. Item 43 removes the possibility, which makes a COUNT
	// redundant rather than merely inconvenient — `AGENTS.md` §11 rule 3: do not add
	// an affordance to compensate for a subtraction.
	//
	// The property A5-C4-2c actually protected — "a set filter is invisible" — is
	// asserted here structurally: every one of the five, in every combination, is
	// rendered in the row whether or not it is set.
	await render(toolbarFor({ roomTypeFilter: 'LABORATORY', hasActiveFilters: true }));
	assert.deepEqual(
		clusterAriaNames().length,
		5,
		'a filter is set and the row no longer shows all five, so a set filter is invisible',
	);
	assert.equal(
		triggerText(byTestId('subjects-room-type-filter')),
		'Room: Laboratory',
		'the set Room filter does not name its own value on its own trigger, which is the only place it is now read',
	);
	// And there is deliberately NO count anywhere: a scheduler must not have to read
	// a number off a filter bar to know the page is filtered.
	assertNoDisclosure('with one filter set');

	// Two set filters, and neither of them is counted anywhere — because both are on
	// screen, naming their own values.
	await unmount();
	await render(toolbarFor({ roomTypeFilter: 'LABORATORY', termFilter: '1', hasActiveFilters: true }));
	assert.equal(clusterComboboxes().length, 5, 'with two filters set the row shows fewer than five');
	assert.equal(triggerText(byTestId('subjects-room-type-filter')), 'Room: Laboratory');
	const termText = clusterComboboxes().map((c) => triggerText(c)).find((t) => t.startsWith('Term:'));
	assert.equal(termText, 'Term: Term 1', `the set Term filter does not name its own value: "${termText}"`);

	// The row's whole text carries no "N filters applied"-style summary either:
	// one status per fact, and each fact already has a control saying it.
	const clusterText = triggerText(cluster());
	assert.doesNotMatch(
		clusterText,
		/\d+\s+(filters?\s+)?(applied|active|selected)\b/i,
		`a filter-count summary was added to compensate for the removed disclosure: "${clusterText}"`,
	);
	assert.doesNotMatch(
		clusterText,
		/refine the subjects shown/i,
		'the removed popover heading is still in the row',
	);
	await unmount();
});

test('A5-C7-2d: showing the row and opening a picker change NO filter value', async () => {
	// REPLACES A5-C4-2d ("opening the disclosure changes no filter — it is a
	// disclosure, not a second value"). The property is unchanged and, on A5 C4,
	// only checkable by pressing the disclosure twice.
	const fired: string[] = [];
	await render(toolbarFor({
		hasActiveFilters: true,
		onSubjectStatusFilterChange: (v: string) => fired.push(`status:${v}`),
		onRoomTypeFilterChange: (v: string) => fired.push(`room:${v}`),
		onTermFilterChange: (v: string) => fired.push(`term:${v}`),
		onGradeLevelFilterChange: (v: string | number) => fired.push(`grade:${v}`),
		onProgramScopeFilterChange: (v: string) => fired.push(`program:${v}`),
		onResetFilters: () => fired.push('reset'),
	}));
	assert.deepEqual([...fired], [], `rendering the row changed a filter (got ${fired.join(',')})`);

	// Opening a picker's own listbox is not selecting a value. All five are opened and
	// none closed, so the assertion is about the whole row rather than one control.
	for (const name of clusterAriaNames()) {
		await press(document.body.querySelector(`[aria-label="${name}"]`));
	}
	assert.ok(document.body.querySelector('[role="listbox"]'), 'no picker opened, so this row decided nothing');
	assert.deepEqual([...fired], [], `opening the pickers selected a value (got ${fired.join(',')})`);
	await unmount();
});

test('A5-C7-2e: Reset appears when any filter is set and clears all five', async () => {
	// KEPT VERBATIM from A5-C4-2e. Item 43 does not touch `Reset`.
	await render(toolbarFor({ roomTypeFilter: 'LABORATORY', hasActiveFilters: true }));
	assert.ok(byTestId('subjects-reset-filters'), 'Reset is not offered while a filter is active');

	const fired: string[] = [];
	await unmount();
	await render(toolbarFor({
		roomTypeFilter: 'LABORATORY',
		hasActiveFilters: true,
		onResetFilters: () => fired.push('reset'),
	}));
	await press(byTestId('subjects-reset-filters'));
	assert.deepEqual([...fired], ['reset'], 'Reset did not reach the page');

	await unmount();
	await render(toolbarFor({ hasActiveFilters: false }));
	assert.equal(byTestId('subjects-reset-filters') === null, true, 'Reset is offered with no filter active');
	await unmount();
});

test('A5-C7-2f: no trigger in the row is truncated, and Escape closes a picker and leaves no panel', async () => {
	// REPLACES A5-C4-2f. The truncation half is KEPT and STRENGTHENED: A5 C4 could
	// only ever see three of the five at once (two in the row, three behind the
	// disclosure), so a face that clipped only when all five were on screen was
	// invisible to it. All five are visible here simultaneously.
	//
	// The Escape half is RETARGETED. On A5 C4 it proved "Escape closes the
	// DISCLOSURE" — that a keyboard user is not trapped in a panel they had to open.
	// There is no disclosure, so the equivalent hazard is a picker left open, and
	// that is what is asserted: Escape dismisses it and no panel survives.
	await render(toolbarFor());
	const visible = clusterComboboxes();
	assert.equal(visible.length, 5, `expected the whole filter set on screen at once, found ${visible.length}`);

	await press(byTestId('subjects-room-type-filter'));
	const optionTexts = (Array.from(document.body.querySelectorAll('[role="option"]')) as HTMLElement[]).map((o) =>
		(o.textContent ?? '').trim(),
	);
	// A LONG option label in the LIST is fine - the list has the room.
	assert.ok(
		optionTexts.includes('Science Laboratory'),
		`a long option label was shortened in the list: ${optionTexts.join(' | ')}`,
	);

	// Now every visible trigger at once, with all five in the row.
	for (const el of allComboboxes()) {
		const cls = el.className;
		assert.doesNotMatch(cls, /(^|\s)truncate(\s|$)/, `a visible filter trigger is truncated: ${el.getAttribute('aria-label')}`);
		assert.doesNotMatch(triggerText(el), /…|\.\.\./, `a visible filter label is cut off: "${triggerText(el)}"`);
		assert.doesNotMatch(cls, /text-ellipsis|line-clamp/, `a visible trigger carries a line clamp: ${el.getAttribute('aria-label')}`);
	}

	await act(async () => {
		document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});
	await act(async () => { await Promise.resolve(); });
	assert.equal(
		document.body.querySelector('[role="listbox"]') === null,
		true,
		'Escape did not close the picker; a keyboard user is left inside a panel they opened',
	);
	// And the row itself is intact afterwards — Escape did not take the toolbar with
	// it, which is the regression a naive fix (Escape bubbling to an unmount) causes.
	assert.equal(clusterComboboxes().length, 5, 'Escape closed the picker but also removed a filter from the row');
	await unmount();
});

test('A5-C7-2i F2: all five pickers are the SHARED `@/ui` trigger, and no call site hand-writes chrome', async () => {
	// REPLACES A5-C4-2i, which asserted the DISCLOSURE used `pickerTriggerClass('auto')`
	// rather than a hand-written look. That class string is deleted with the
	// disclosure, so the exact F2 defect cannot come back in that spelling — and the
	// RULE it was enforcing is now asserted over the whole row instead.
	//
	// QA F2 was BLOCKING and it is the REJECT_UX: `AGENTS.md` §8 axis 4, "one look per
	// control". The rule is stated twice in `@/ui`:
	//   - `picker-trigger.ts`: "Call sites pass a `width`; they never pass a class string."
	//   - `filter-picker.tsx`: "A page names a `variant`; it never writes a width class."
	const { pickerTriggerClass } = await import('@/ui/picker-trigger');
	// `md` is the width every one of these five names. It is the one `@/ui` documents
	// as derived for THIS row: "5 × 128 + 4 cluster gaps + Reset + the 240px search
	// box + its gap = 1020px against ~1062px available at 1366".
	const variantTokens = pickerTriggerClass('md').split(/\s+/).filter(Boolean);

	const seen = await interactiveSnapshot(toolbarFor(), async () => {}, () =>
		clusterComboboxes().map((t) => ({ cls: t.className, label: t.getAttribute('aria-label') })),
	);
	assert.equal(seen.length, 5, `expected 5 triggers in the row, found ${seen.length}`);

	for (const { cls, label } of seen) {
		const renderedTokens = cls.split(/\s+/).filter(Boolean);
		// (1) THE VARIANT LANDED, IN FULL, on every picker.
		for (const token of variantTokens) {
			assert.ok(
				renderedTokens.includes(token),
				`${label} is missing a token the shared variant carries: "${token}" is not in "${cls}"`,
			);
		}
		// (2) NOTHING IN THE LOOK FAMILIES COMES FROM ANYWHERE BUT THE VARIANT.
		//
		// Stated precisely because a naive version is wrong: the RENDERED list
		// legitimately contains `h-9`, `px-3`, `text-xs`, `font-normal`,
		// `normal-case` and `tracking-normal`, because the variant supplies them. So
		// the question is not "is the token present" but "is every value in this
		// property family one the VARIANT supplies" — which is exactly what a
		// hand-written override breaks, by carrying a second unshared value into the
		// same family through `cn`.
		for (const family of [/^h-/, /^px-/, /^text-(?:xs|sm|base|lg|xl)$/, /^font-/, /^normal-case$/, /^tracking-/]) {
			const rendered = renderedTokens.filter((t) => family.test(t)).sort();
			const supplied = variantTokens.filter((t) => family.test(t)).sort();
			for (const token of rendered) {
				assert.ok(
					supplied.includes(token),
					`${label} carries "${token}", a look property the shared variant does NOT supply - so a ` +
						`hand-written override is reaching the row. Rendered family: ${rendered.join(' ') || '(none)'}; ` +
						`shared variant supplies: ${supplied.join(' ') || '(none)'}. AGENTS.md 8: a page names a variant.`,
				);
			}
		}
		// (3) ONE width, and it is a real declared width — not `auto`, not `full`.
		// `auto` was A5 C4's disclosure width and is exactly what a fixed-row filter
		// must not use: it is how the width budget stopped being decidable from
		// source, and this is where that regressed before.
		const widths = renderedTokens.filter((t) => /^w-/.test(t));
		assert.deepEqual(widths, ['w-32'], `${label} declares ${JSON.stringify(widths)} rather than the shared \`w-32\``);
	}

	// (4) THE SOURCE DOES NOT HAND-WRITE CHROME. A rendered class list cannot tell
	// "the variant emitted h-9" from "a call site typed h-9 and they agreed", so the
	// call sites themselves are read. This is what makes the row discriminate against
	// the F2 defect exactly rather than against a look that happens to differ today.
	//
	// A5 C7 widens the A5 C4 regex: C4 anchored on the disclosure's `data-testid`, which
	// no longer exists. The question is now page-wide — does ANY call site in this file
	// hand-write a trigger's chrome?
	const { readFileSync } = await import('node:fs');
	const { resolve: resolvePath } = await import('node:path');
	const source = readFileSync(resolvePath(import.meta.dirname, '../SubjectFilterToolbar.tsx'), 'utf8');
	const code = stripJsComments(source);

	// COMMENTS ARE STRIPPED, and that is load-bearing rather than incidental. This
	// toolbar's own layout note NAMES the removed heading, the removed testid and the
	// removed `useState` in prose, because §16 requires the record of a removal to
	// survive. A whole-file string match would therefore be red against the very file
	// that documents the removal correctly — the assertion would be deciding about
	// prose while claiming to decide about code. What must not exist is the heading as
	// CODE, so only code is searched.

	// Every `FilterPicker` call site, and nothing else. Read from the COMMENT-STRIPPED
	// source, for the same reason the assertions below are: a class string written in a
	// comment is documentation, a class string written in a call site is chrome. This
	// file is full of deliberate examples of the second (`rounded-xl`,
	// `border-slate-200`, `bg-white` are named in A5 C4's record of the removed
	// page-local look), so matching the raw file would red on its own evidence.
	const callSites = code.match(/<FilterPicker[\s\S]*?\/>/g) ?? [];
	assert.equal(callSites.length, 5, `expected 5 FilterPicker call sites in the toolbar, found ${callSites.length}`);
	for (const callSite of callSites) {
		// The trigger chrome `@/ui` owns. A call site may legitimately pass
		// `dataTestId`, `ariaLabel`, `options`, `value`, `onValueChange`, `name`,
		// `shortLabels` and `allValue` — none of which is chrome.
		assert.doesNotMatch(
			callSite,
			/(^|[\s<(])(h-|w-|px-|py-|rounded-|border(?![Ll]|-\w)|bg-white|shadow(?!\w*-none))/m,
			`a FilterPicker call site hand-writes trigger chrome that \`@/ui\` owns: ${callSite.slice(0, 200)}`,
		);
		// §8 again, from the other direction: it must not name a width CLASS either.
		assert.doesNotMatch(callSite, /className=/, `a FilterPicker call site passes a className: ${callSite.slice(0, 200)}`);
	}
	// And the removed chrome is not merely unused — it is GONE from the CODE, so a
	// later edit cannot reach for it without the diff showing.
	assert.doesNotMatch(code, /subjects-more-filters/, 'the disclosure testid is still in the toolbar code');
	assert.doesNotMatch(code, /Refine the subjects shown/, 'the disclosure heading is still in the toolbar code');
	// `@/ui/popover` was imported ONLY for that disclosure. If the import is still
	// there the disclosure is not fully gone, and an unused import is also the first
	// thing a bundler's linter will flag in review.
	assert.doesNotMatch(code, /@\/ui\/popover/, 'the `@/ui/popover` import survives the removal of the disclosure');
	assert.doesNotMatch(code, /SlidersHorizontal/, 'the disclosure icon survives the removal of the disclosure');
	assert.doesNotMatch(code, /useState/, 'a `useState` survives with nothing to disclose');
	assert.doesNotMatch(code, /moreFilters/, 'a `moreFilters*` identifier survives the removal of the disclosure');
});

test('A5-C7-2j F2: every face a filter composes is measured against the shared rectangle, and the known overflows are NAMED', async () => {
	// REPLACES A5-C4-2j ("the DYNAMIC disclosure label is never ellipsised, truncated
	// or clipped"). That row is superseded because the row has no dynamic label any
	// more.
	//
	// THE DEFECT IT WAS HUNTING IS STILL WORTH HUNTING, and this is where it moved.
	// A5 C4's QA noted that the truncation row iterated `[role="combobox"]` and the
	// disclosure was NOT one — so the one control whose label CHANGES LENGTH had no
	// truncation coverage at all. Removing the disclosure removes the length-changing
	// control, and the remaining risk is the same one in static form: a picker's
	// composed face is `<name>: <value>`, and `@/ui` publishes a CHARACTER BUDGET per
	// width precisely because a fixed rectangle clips at a character count.
	//
	// So this row asks `@/ui`'s own question, over every value each of the five filters
	// can actually take — not a hand-written count.
	const { pickerTriggerFaceFits, PICKER_TRIGGER_FACE_BUDGET_CHARS } = await import('@/ui/picker-trigger');
	const { GRADE_OPTIONS, PROGRAM_SCOPE_OPTIONS, ALL_ROOM_TYPES } = await import('@/lib/subject-constants');
	const { gradeLabel } = await import('@/lib/grade-labels');
	/* The REAL room-label map, imported rather than re-declared. A5 C3 round 1 was
	   caught using an invented fixture that already contained the shape under test
	   (`AGENTS.md` §11); re-typing these nine strings here would be that same
	   mistake one layer out, and would let a rename in the toolbar pass while the row
	   silently clipped. */
	const { ROOM_TYPE_SHORT_LABELS: ROOM_SHORT } = await import('../SubjectFilterToolbar');

	/* THE INVENTORY OF FACES THAT DO NOT FIT `md`, as measured on the BASE commit.
	 *
	 * Asserted as an EXACT set, not as a comment, and the reason matters more than the
	 * numbers: `AGENTS.md` §11 publishes `pickerTriggerFaceFits` precisely so this
	 * question can be answered, and A5 C3 (which introduced the shared `w-32`) only
	 * ever asked it of the UNSET face (`Grade: All`). It was never asked of a face
	 * with a real value on it, which is the face a scheduler reads after they have
	 * chosen something.
	 *
	 * WHAT THIS IS. `md` is 128px: `px-3` on each side and a `ChevronsUpDown` leave
	 * ~84px of text, i.e. 12 characters at `@/ui`'s own conservative 6.6px advance.
	 * `/subjects`' five pickers compose `<name>: <value>`, and `md`'s budget leaves the
	 * VALUE only `12 - name.length - 2` characters. For `Status` (6) that is 4 — and
	 * the shortest real status value is `Active` (6). So every SET status value is
	 * over budget, and the same is true of most Room and Term values.
	 *
	 * WHY IT IS NOT FIXED IN THIS SLICE, and why the honest answer is a planner
	 * decision rather than a smaller version:
	 *   - Widening one picker breaks §8 "one look per control" — §8's own words are
	 *     that a row needing a wider control takes it on ALL of its pickers — and
	 *     `lg` (176px) costs 240px across five, far more than the ~76px of slack the
	 *     one-row budget has at 1366.
	 *   - Shortening the values to fit is the "too literal" failure §11's design gate
	 *     was written against: `Room-constrained` becomes `R-con` and `Status: No
	 *     coverage` becomes `Status: No cov`, which is worse for the older,
	 *     mouse-first scheduler the whole packet is written for.
	 *   - Item 43's own instruction is "reuse whatever the Grade/Program pickers
	 *     already do; do not invent a variant".
	 *
	 * WHAT A5 C7 DID CHANGE ABOUT IT, and it must not be glossed: on the BASE these
	 * overflows were behind a `More filters` disclosure and only visible once someone
	 * opened it; item 43 puts all five permanently in the row, so a SET Status/Room/
	 * Term filter now shows its overflow without any interaction. The defect is
	 * identical and pre-existing; its VISIBILITY is what this slice raises, and the
	 * rendered 1366x768 capture in `docs/reviews/a5-c7-subjects-20260929/` is where a
	 * reviewer can see it.
	 *
	 * WHY AN EXACT ASSERTION. A new overflow is red. A FIX to one of these is red
	 * here too — which is the moment its name should be deleted from this list, in a
	 * commit that says so. A defect recorded only in prose stops protecting itself the
	 * first time somebody edits this file.
	 */
	const KNOWN_OVERFLOWING_FACES: string[] = [
		'Program: Other',
		'Room: Classroom',
		'Room: Computer lab',
		'Room: Faculty room',
		'Room: Gymnasium',
		'Room: Laboratory',
		'Room: Library',
		'Room: Workshop',
		'Status: Active',
		'Status: Archived',
		'Status: No coverage',
		'Status: Room-constrained',
		'Term: No term set',
		'Term: Rotates by term',
	];
	const overBudget: string[] = [];

	assert.equal(PICKER_TRIGGER_FACE_BUDGET_CHARS.md, 12, 'the shared `md` character budget changed; re-check this row');	assert.equal(
		Object.keys(ROOM_SHORT).length,
		ALL_ROOM_TYPES.length,
		'the toolbar\'s short room labels and the shared room-type catalogue have drifted apart',
	);

	// Every (name, value) pair each picker can compose.
	//
	// THE VALUE IS THE OPTION'S `label`, NOT ITS `value`, and that is not a
	// simplification. `FilterPicker` composes the trigger face as
	// `shortLabels[value] ?? selected.label ?? value`, so a picker that passes no
	// `shortLabels` shows the option's `label`. `Program` passes none — and that is
	// correct, because `PROGRAM_SCOPE_OPTIONS` already ships `label: 'BEC'` as the
	// operator-facing DepEd short form while `value: 'REGULAR'` stays the stored code.
	// Reading `value` here was the first version of this row, and it reported
	// `Program: REGULAR` as a 15-character face that clips — a defect in the TEST's
	// model of the control, not in the control. A row that measured the wrong string
	// would have sent the planner to widen a trigger that was never clipping.
	const faces: Array<{ picker: string; name: string; values: string[] }> = [
		{ picker: 'Grade', name: 'Grade', values: ['All', ...GRADE_OPTIONS.map((g) => gradeLabel(g))] },
		{ picker: 'Program', name: 'Program', values: ['All', ...PROGRAM_SCOPE_OPTIONS.map((o) => o.label)] },
		{ picker: 'Status', name: 'Status', values: ['All', 'Active', 'Archived', 'No coverage', 'Room-constrained'] },
		{ picker: 'Room', name: 'Room', values: ['All', ...ALL_ROOM_TYPES.map((t) => ROOM_SHORT[t] ?? String(t))] },
		{ picker: 'Term', name: 'Term', values: ['All', 'Term 1', 'Term 2', 'Rotates by term', 'No term set'] },
	];
	for (const { picker, name, values } of faces) {
		for (const value of values) {
			if (KNOWN_OVERFLOWING_FACES.includes(`${name}: ${value}`)) {
				overBudget.push(`${name}: ${value}`);
				continue;
			}
			assert.ok(
				pickerTriggerFaceFits('md', name, value),
				`the ${picker} picker can compose "${name}: ${value}", which does not fit the shared ` +
					`\`md\` trigger's ${PICKER_TRIGGER_FACE_BUDGET_CHARS.md}-character budget. A5 C7 must shorten ` +
					'that value — it must NOT widen the trigger, because the one-row budget at 1366 is already spent.',
			);
		}
	}

	/* THE INVENTORY IS ASSERTED, NOT ASSERTED-AROUND. See `KNOWN_OVERFLOWING_FACES`
	 * above for when these were measured, why none is fixed in this slice, what A5 C7
	 * changed about their VISIBILITY, and why the set is an exact assertion rather
	 * than a comment.
	 */
	/* COMPARED AS SETS, not as sequences. `overBudget` is discovered in PICKER order
	 * (Grade, Program, Status, Room, Term) because that is the order the loops walk,
	 * while `KNOWN_OVERFLOWING_FACES` is written in ALPHABETICAL order because that
	 * is the order a reader scans for a name in. Pinning one order over the other
	 * would make a purely cosmetic reordering of this list a red gate, which is how
	 * evidence rows end up being "fixed" by reshuffling instead of by deciding.
	 */
	assert.deepEqual(
		[...overBudget].sort(),
		[...KNOWN_OVERFLOWING_FACES].sort(),
		'the set of faces that exceed the shared `md` budget changed. If a face was FIXED, delete it from ' +
			'`KNOWN_OVERFLOWING_FACES` and say so. If one was ADDED, the row is wider than its rectangle and ' +
			'the control must be shortened rather than the trigger widened.',
	);

	// The SHORT end, asserted on the RENDERED row, so a variant sized to the longest
	// case cannot leave the common one (`X: All`) looking padded or clipped. Every
	// filter set to its longest value at once — the row's true worst case.
	await render(toolbarFor({
		roomTypeFilter: 'LABORATORY',
		subjectStatusFilter: 'room-constrained',
		termFilter: '1',
		gradeLevelFilter: 7,
		programScopeFilter: 'STE',
		hasActiveFilters: true,
	}));
	for (const el of clusterComboboxes()) {
		const text = triggerText(el);
		assert.ok(text, 'a trigger in the row rendered no text at all');
		assert.doesNotMatch(text, /…|\.\.\./, `a filter face is cut off: "${text}"`);
		assert.doesNotMatch(el.className, /(^|\s)truncate(\s|$)/, `a filter trigger is a truncation clip: "${el.className}"`);
		// Every one still SHOWS ITS OWN NAME. A clipped face that also lost the name
		// would read as a bare value, which is the operator's original "two filters
		// read only `All…`" defect.
		assert.match(text, /^[A-Za-z]+: /, `a filter face lost its own name: "${text}"`);
	}
	// The longest of them is named here so a future widening of a value is caught with
	// a specific face rather than a generic one.
	assert.equal(
		triggerText(byTestId('subjects-status-filter')),
		'Status: Room-constrained',
		'the longest status face does not read as the toolbar composes it',
	);
	await unmount();
});

test('A5-C7-2g c3-slice-B B1: the row renders NO selectable option of its own — `@/ui` owns every choice', async () => {
	// REPLACES A5-C4-2g, which asserted the DISCLOSURE rendered no `[role="option"]`
	// and delegated selection to `@/ui/filter-picker`. That comparison is now TOTAL:
	// with the disclosure gone there is no non-`@/ui` control left on this page at
	// all, so "no options until a picker is opened" is asserted over the whole row.
	//
	// WHAT IS STILL DECIDABLE, restated from A5 C4's own note: the guard it protected
	// is c3 slice B's B1 (`Enter` cannot select a `disabled` option), which lives in
	// `searchable-select.tsx` and is re-asserted by `a5-c3-picker-contract`, a suite
	// this packet runs green. A page that rendered its own list, or forwarded a
	// keydown of its own, would be a SECOND unguarded path — and this row is what
	// makes that visible if a later edit introduces one.
	await render(toolbarFor());
	assert.equal(
		document.body.querySelectorAll('[role="option"]').length,
		0,
		'the row rendered options with no picker opened; a filter list must be behind the control that owns it',
	);
	assert.equal(
		document.body.querySelectorAll('[role="listbox"]').length,
		0,
		'the row rendered a listbox with no picker opened',
	);

	// `Enter` anywhere in the closed row selects nothing. Pressed on the row's own
	// container AND on a trigger, because A5 C4 had to press it on a disclosure.
	const container = cluster();
	assert.ok(container, 'the cluster is gone, so there is no row to press Enter in');
	await act(async () => {
		container!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		for (const el of clusterComboboxes()) {
			el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		}
	});
	await act(async () => { await Promise.resolve(); });
	assert.equal(
		document.body.querySelectorAll('[role="option"]').length,
		0,
		'Enter in the closed row selected a value; some control in the row owns a selection path that is not `@/ui`',
	);
	// And the guarded path IS the one that runs: a term chosen from a picker's own
	// listbox reaches the page.
	const fired: string[] = [];
	await unmount();
	await render(toolbarFor({ onTermFilterChange: (v: string) => fired.push(v) }));
	await press(document.body.querySelector('[aria-label="Filter by rotation term: All terms"]'));
	const term1 = (Array.from(document.body.querySelectorAll('[role="option"]')) as HTMLElement[]).find(
		(o) => o.textContent?.trim() === 'Term 1',
	);
	assert.ok(term1, 'the term options are not offered through the @/ui listbox');
	await press(term1);
	assert.deepEqual([...fired], ['1'], `a term chosen in the row did not reach the page (got ${fired.join(',')})`);
	await unmount();
});

test('A5-C7-2h c3-slice-B B2: no control claims `All` for a list that offers no such choice', async () => {
	// KEPT VERBATIM from A5-C4-2h. It was always about the Term picker's OPTION LIST,
	// never about the disclosure, so removing the disclosure changes nothing about it.
	// The Term picker is given a list with NO `all` member — the shape that made
	// c3 slice B's B2 defect ("Archived year: all" on a control offering no All).
	await render(toolbarFor({ termFilter: '', termOptions: [{ value: '7', label: 'Term 7', kind: 'term' as const }] }));
	const termTrigger = (Array.from(document.body.querySelectorAll('[role="combobox"]')) as HTMLElement[]).find((c) =>
		triggerText(c).startsWith('Term:'),
	);
	assert.ok(termTrigger, 'the Term picker is not in the row');
	assert.doesNotMatch(
		triggerText(termTrigger),
		/: All$/,
		`a control with no \`all\` choice still claims it: "${triggerText(termTrigger)}"`,
	);
	await unmount();
});

test('A5-C7-2k: the row is ONE cluster whose declared widths fit 1366 in a single line', async () => {
	// NEW IN A5 C7, and it replaces no A5 C4 row — A5 C4's budget was a two-filter
	// arithmetic plus a disclosure label, and it is superseded by this one rather than
	// deleted (this file's SUPERSEDED MAP records that).
	//
	// LAYOUT HONESTY, stated up front: jsdom has NO LAYOUT ENGINE. What this row
	// decides is the CLASS CONTRACT that actually rendered plus arithmetic over the
	// Tailwind width classes those elements carry, read from the DOM rather than
	// restated from the design. It is NOT a measured pixel result and is not dressed
	// up as one. The rendered 1366x768 no-wrap proof is the browser capture in
	// `docs/reviews/a5-c7-subjects-20260929/`.
	//
	// The numbers below come from `@/ui/picker-trigger`'s own published arithmetic for
	// this exact case: "5 × 128 + 4 cluster gaps + Reset + the 240px search box + its
	// gap = 1020px against ~1062px available at 1366", with this toolbar's `gap-2`
	// (8px) rather than C4's `gap-2.5` (10px) making it 1010px.
	/* ONE Tailwind size scale, applied to EVERY term below.
	   `w-<n>`, `gap-<n>` and `px-<n>` all share the same formula: `n / 4` rem, so
	   `n * 4` px. `w-32` = 128px, `gap-2` = 8px, `px-3` = 12px.

	   The first version of this row used a `rem(n)` helper — `n * 16` — which is
	   correct for `w-*` ONLY because the caller divided by 4 first, and which it
	   applied UNCHANGED to `gap-*` and `px-*`. That inflated the budget by 120px and
	   reported a row that genuinely fits one line as 69px too wide. A budget computed
	   on a wrong scale is worse than no budget: it is a number that reads as
	   authoritative and is not, and the obvious response to it would have been to
	   shrink real controls to satisfy a phantom. Hence ONE helper, named for what it
	   computes, used for every term. */
	const u = (n: number) => n * 4;
	const SEARCH_PX = 240;
	/* The gap between the search box's wrapper and the cluster is the shared
	   `admin-inline-filter-row`'s own `gap-2`, not this file's. */
	const SEARCH_GAP_PX = u(2);
	/* `1366 - 256 (page padding / sidebar) - 40 (card padding) - 8 (card border)`.
	   The same `available` the A3-C10 and A5 C4 budgets used, so the three are
	   comparable rather than each picking a flattering denominator. */
	const AVAILABLE_PX = 1366 - 256 - 40 - 8;

	const host = await render(toolbarFor({ hasActiveFilters: true }));

	// ONE cluster, and the shared row is still the single always-visible row.
	const clusterEl = query(host, 'subjects-filter-cluster');
	assert.ok(clusterEl, 'the wrapping cluster is gone');
	assert.equal(
		query(host, 'admin-inline-filter-row') === null,
		false,
		'the shared inline row is gone, so the filters left the row that is always visible',
	);
	assert.equal(
		query(host, 'admin-primary-filter-row') === null,
		true,
		'a SECOND always-visible filter row rendered; the header is one row, not two',
	);

	// The widths are READ from the rendered class names, so editing a trigger's width
	// without editing this arithmetic is caught.
	const declared = clusterComboboxes()
		.map((t) => /(^|\s)w-(\d+)(\s|$)/.exec(t.className)?.[2])
		.filter((v): v is string => v != null)
		.map((steps) => u(Number(steps)));
	assert.equal(declared.length, 5, `the row declares ${declared.length} widths, not one per filter`);
	assert.equal(new Set(declared).size, 1, `the row carries ${new Set(declared).size} different widths — §8's unevenness`);
	assert.deepEqual(declared, [u(32), u(32), u(32), u(32), u(32)], 'the five filters are not all the shared `w-32`');

	// The search box's fixed width, because the budget depends on it.
	const searchWrapper = document.body.querySelector('input[placeholder="Search name or code..."]')!.parentElement!;
	assert.match(searchWrapper.className, /w-\[240px\]/, 'the search box is not the fixed compact width the budget depends on');
	assert.match(searchWrapper.className, /max-w-\[240px\]/, 'the search box can still grow past the compact width');

	// `Reset` is in the cluster while a filter is set, so it is IN the budget. Its
	// width is taken from its RENDERED label plus the shared trigger's `px-3`, the
	// same method A5 C4 used for the disclosure's label rather than inventing a number.
	const resetEl = query(host, 'subjects-reset-filters');
	assert.ok(resetEl, 'Reset is not in the row while a filter is set');
	const resetGapMatch = /(^|\s)px-(\d+)(\s|$)/.exec(resetEl.className);
	assert.ok(resetGapMatch, `Reset declares no \`px-*\`, so the budget below is not decidable: ${resetEl.className}`);
	const resetPx = (resetEl.textContent ?? '').length * 7 + 2 * u(Number(resetGapMatch[2]));

	// The cluster's own gap, READ from the class name rather than restated.
	const clusterGapMatch = /(^|\s)gap-(\d+)((?:\.5)?)(?:\s|$)/.exec(clusterEl.className);
	assert.ok(clusterGapMatch, `the cluster declares no \`gap-*\`, so the budget below is not decidable: ${clusterEl.className}`);
	const clusterGapPx = u(Number(clusterGapMatch[2])) * (clusterGapMatch[3] ? 1.5 : 1);

	// Six children in the cluster with `Reset` present: five pickers + Reset, so FIVE
	// gaps between them.
	const CHILD_GAPS = 5;
	const total =
		SEARCH_PX + SEARCH_GAP_PX + declared.reduce((a, b) => a + b, 0) + CHILD_GAPS * clusterGapPx + resetPx;

	assert.ok(
		total < AVAILABLE_PX,
		`the toolbar's declared width budget (${total}px) does not fit the ${AVAILABLE_PX}px available at 1366px — ` +
			'the row WOULD WRAP, and item 43\'s whole point is that it does not. That is a design signal for the ' +
			'planner, not something to answer by shrinking the font or narrowing one trigger ad hoc.',
	);
	// AND the slack is real, not rounding: adding a SIXTH `w-32` filter and its gap
	// would not fit either, which is what makes this a budget rather than an
	// observation. If a future change makes the row this comfortable, re-read the
	// rendered 1366x768 capture before adding one.
	const SIXTH_FILTER_PX = u(32) + clusterGapPx;
	assert.ok(
		total + SIXTH_FILTER_PX > AVAILABLE_PX,
		`the budget (${total}px) still leaves room for a sixth filter; if that ever becomes true, re-read the ` +
			'rendered 1366x768 capture in `docs/reviews/a5-c7-subjects-20260929/` before adding one.',
	);

	// The cluster still WRAPS. `flex-wrap` is not decoration: it is what keeps a
	// narrower viewport from overflowing the row horizontally and spawning a page
	// scrollbar (§8's no-scroll rule). The one-line promise at 1366 is a BUDGET
	// result; the wrap is the behaviour that budget is protecting.
	assert.ok(clusterEl.className.includes('flex-wrap'), 'the cluster does not wrap, so a narrow viewport overflows instead');
	assert.ok(clusterEl.className.includes('min-w-0'), 'the cluster cannot shrink, so it overflows instead of wrapping');
	// No horizontal escape hatch anywhere: the fix is to FIT, never to scroll sideways.
	const toolbar = query(host, 'admin-search-filter-toolbar')!;
	for (const [name, el] of [['the row', query(host, 'admin-inline-filter-row')!], ['the cluster', clusterEl], ['the toolbar', toolbar]] as const) {
		assert.equal(
			/h-\[|max-h-\[|overflow-y-auto|overflow-auto|overflow-x-auto|overflow-scroll/.test(el.className),
			false,
			`${name} became its own scroll region instead of fitting one line`,
		);
	}

	// The handles A3-C10 introduced survive the move, so a live-acceptance row can
	// still select each filter on its own.
	for (const id of DECLARED_TEST_IDS) {
		assert.ok(byTestId(id), `${id} lost its test handle when it moved into the row`);
	}
	await unmount();
});
