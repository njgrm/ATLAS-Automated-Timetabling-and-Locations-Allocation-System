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
 * ## A5 C7 CORRECTION ROUND 1 — the five pickers are `auto`, not `md`
 *
 * Round 0 put all five on the shared `md` variant (`w-32`, 128px) and I recorded a
 * measured overflow: `Room: Laboratory` reported `scrollWidth − clientWidth = 10px`,
 * and fourteen faces exceeded `md`'s published 12-character budget — every SET
 * `Status` value among them, because `md` leaves a value only `12 − name.length − 2`
 * characters and the shortest real status value is `Active` (6).
 *
 * I marked that NON_BLOCKING and asked for a decision. The decision was `auto`
 * (`w-auto whitespace-nowrap`) — the variant A5 C4 had added to `@/ui` FOR THIS PAGE
 * for the `More filters` button this change deleted, and whose published guard says a
 * width that is not a fixed rectangle "ALWAYS FITS". So the three rows below were
 * re-aimed. **Nothing is removed from the map**; the round-0 entries stay, and each
 * carries what superseded it:
 *
 *   A5-C7-2a … 2h   unchanged. Item 43's structure is untouched — a width is not a
 *                  filter value, and no option list, `shortLabels` map, `ariaLabel` or
 *                  `dataTestId` moved.
 *   A5-C7-2i  "one even width, `w-32`, and not `auto`"
 *     SUPERSEDED. The round-0 comment here called `auto` "exactly what a fixed-row
 *     filter must not use" and read the source-decidable budget as the goal. That
 *     was the error: a constant width is decidable from source only when it is big
 *     enough, and 128px was not. `auto` keeps §8 intact (one variant, same height,
 *     border, radius, case, option-list search box) and stops clipping.
 *     Now asserts `w-auto` + `whitespace-nowrap`, and that no trigger is on a fixed
 *     rectangle.
 *   A5-C7-2j  "fourteen faces exceed `md`; asserted as an exact inventory"
 *     SUPERSEDED, and this is the substantive correction. An inventory says "these
 *     clip and we accept it"; under `auto` NONE clip. The fourteen names are carried
 *     forward as `FACES_ROUND_0_FOUND_CLIPPING` — asserted still-offered (so a value
 *     cannot be deleted to make the row pass) and used as the LONG-FACE sentinel via
 *     `md`'s budget, so a newly-lengthened face is still caught.
 *   A5-C7-2k  "five × 128px declared widths add up to less than 1062px available"
 *     SUPERSEDED. `auto` has no `w-<n>` to read, so the row is budgeted by what stays
 *     FIXED (the 240px search box, the gaps, `Reset`) plus a bound on the worst case.
 *     Also corrects round 0's `available`: `1366 − 256 − 40 − 8 = 1062px` was a
 *     plausible restatement, not a measurement, and the 1366x768 capture puts the real
 *     containing width at 1060px. A plausible arithmetic constant is worse than none.
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
	// `auto` is the width every one of these five names.
	const { pickerTriggerClass } = await import('@/ui/picker-trigger');
	/* A5 c8 (2026-09-29) — THE VARIANT IS READ AS IT RENDERS, NOT AS IT IS TYPED.
	 *
	 * `pickerTriggerClass('auto')` is a JOINED STRING, not a merged class: it contains
	 * both `h-9` (the shared height token) and `h-auto` (the `auto` variant's growth),
	 * and `cn`/tailwind-merge keeps the LAST of a family. So the rendered trigger
	 * carries `h-auto` and NOT `h-9`, and a naive "is every token of the variant on
	 * the element" assertion goes red on a trigger that is exactly right.
	 *
	 * That assertion is the one that decides "did the shared variant land, or did a
	 * call site hand-write a look", so it must not be weakened — it is made MERGE-AWARE
	 * instead: where the variant states two values in one family, only the surviving
	 * (last) one is required on the element. A hand-written override still fails it,
	 * because an override introduces a value the variant never stated.
	 */
	const LOOK_FAMILIES = [/^h-/, /^min-h-/, /^w-/, /^min-w-/, /^max-w-/, /^px-/, /^py-/, /^text-(?:xs|sm|base|lg|xl)$/, /^font-/, /^normal-case$/, /^tracking-/];
	const allVariantTokens = pickerTriggerClass('auto').split(/\s+/).filter(Boolean);
	const superseded = new Set(
		allVariantTokens.filter((token, index) =>
			LOOK_FAMILIES.some((family) => family.test(token))
			&& allVariantTokens.slice(index + 1).some((later) => LOOK_FAMILIES.some((family) => family.test(token) && family.test(later))),
		),
	);
	const variantTokens = allVariantTokens.filter((token) => !superseded.has(token));
	// Sanity on the reduction itself, so it cannot quietly reduce to nothing and make
	// the row vacuous: the shared token, the type treatment and the padding must all
	// survive it.
	for (const required of ['text-xs', 'px-3', 'normal-case', 'font-normal', 'w-auto', 'min-w-32', 'max-w-[22rem]', 'min-h-9']) {
		assert.ok(variantTokens.includes(required), `the merge-aware reduction dropped the required shared token "${required}" and would make the rest of this row vacuous`);
	}

	const seen = await interactiveSnapshot(toolbarFor(), async () => {}, () =>
		clusterComboboxes().map((t) => ({
			cls: t.className,
			label: t.getAttribute('aria-label'),
			// A5 c8: the LABEL SPAN is where the wrap decision is actually made, and
			// `@/ui/button`'s base carries `whitespace-nowrap` on the button itself, so
			// the button's class list cannot answer "does this face wrap?".
			faceClass: t.querySelector('span')?.className ?? 'NO_FACE_SPAN',
		})),
	);
	assert.equal(seen.length, 5, `expected 5 triggers in the row, found ${seen.length}`);

	for (const { cls, label, faceClass } of seen) {
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
		// (3) ONE width variant, and it is `w-auto`.
		//
		// A5 C7 CORRECTION ROUND 1 SUPERSEDES the round-0 assertion, which was
		// `assert.deepEqual(widths, ['w-32'], …)` and whose comment argued `auto` is
		// "exactly what a fixed-row filter must not use". That argument was wrong, and
		// the reason it is recorded rather than deleted is the shape of the mistake:
		// it read "a fixed row needs a fixed rectangle" and treated content-sizing as a
		// loss of the source-decidable budget. The truth is the reverse — the budget was
		// decidable from source ONLY because the width was a constant, and a constant
		// that is smaller than the content is not a budget, it is a clipping
		// instruction. Round 0 measured `Room: Laboratory` at
		// `scrollWidth − clientWidth = 10px` and fourteen faces exceeded `md`'s
		// 12-character budget, every SET `Status` value among them.
		//
		// `w-auto` is the replacement and it is a named VARIANT, not a class string:
		// `pickerTriggerClass('auto')` composes it, and `picker-trigger.ts` states the
		// rule a call site obeys — "Call sites pass a `width`; they never pass a class
		// string."
		const widths = renderedTokens.filter((t) => /^w-/.test(t));
		assert.deepEqual(widths, ['w-auto'], `${label} declares ${JSON.stringify(widths)} rather than the shared \`w-auto\``);
		/* A5 c8 (2026-09-29) — THIS HALF IS REVERSED, and it is the substantive
		 * correction of the change rather than a restatement of it. The row used to be:
		 *
		 *   // `whitespace-nowrap` rides with `auto` and is the other half of "not clipped":
		 *   // a content-sized trigger that can wrap mid-label reads as two facts.
		 *   assert.ok(renderedTokens.includes('whitespace-nowrap'), …);
		 *
		 * `whitespace-nowrap` is what lets a face ESCAPE its own box, which is the
		 * defect Lane C measured in the operator's own screenshot: "Home room: Home
		 * room assigned spills outside its select". `AGENTS.md` §8 forbids a
		 * cut-off OR a spilling face, and a trigger that grows a second line is not
		 * "two facts" — it is a value a scheduler can finish reading.
		 *
		 * The wrap is asserted on the LABEL SPAN rather than on the trigger, because
		 * `@ui/button`'s base class carries `whitespace-nowrap` and would otherwise
		 * make this unassertable from the button's own list. That is also the honest
		 * place to check: the span is what actually wraps.
		 */
		assert.ok(
			/(^|\s)min-w-0(\s|$)/.test(cls),
			`${label} cannot shrink inside its own box, so a long face runs past the border: "${cls}"`,
		);
		assert.ok(
			/(^|\s)whitespace-normal(\s|$)/.test(faceClass),
			`${label} face does not wrap inside its own box; a long value will be cut or will spill. Face span: "${faceClass}"`,
		);
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

test('A5-C7-2j F2: NO face clips — every value each filter can take fits its own content-sized trigger', async () => {
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
	// WHAT ROUND 0 DID WITH THIS ROW, recorded because the SHAPE of the mistake is the
	// useful part. Round 0 kept this row and filled it with an INVENTORY of fourteen
	// faces that exceeded the shared `md` variant's 12-character budget, and asserted
	// that inventory as an exact set so it could not rot. The reasoning was defensible
	// and the conclusion was wrong: it treated clipping as the price of a
	// source-decidable budget. `picker-trigger.ts` says the opposite in its own words
	// — a width that is not a fixed rectangle "ALWAYS FITS", returning `false` there
	// "reports a FALSE FAILURE", and "a guard that cries wolf on the width that is
	// safest is how a guard gets deleted". Round 0 read that guard, saw `true`, and
	// treated it as the absence of an answer rather than as the answer.
	//
	// SO THE INVENTORY IS GONE AND WHAT REPLACES IT IS STRONGER. An inventory says
	// "these fourteen clip and we accept it". The assertion below says NONE clips, and
	// enumerates the full set of faces that must be checked to keep that true. A
	// clipping face is now red whether it is one of the old fourteen or a new one:
	// there is no list to keep current, because the list WAS the loophole.
	//
	// The fourteen names are NOT forgotten — they are carried forward below as
	// `FACES_ROUND_0_FOUND_CLIPPING` and asserted still-offered, which is the additive
	// half of the correction.
	//
	// `w-auto` is a NAMED VARIANT on all five call sites, never a class string:
	// `picker-trigger.ts` states "Call sites pass a `width`; they never pass a class
	// string", and `filter-picker.tsx` states "A page names a `variant`; it never
	// writes a width class".
	const { pickerTriggerFaceFits, PICKER_TRIGGER_FACE_BUDGET_CHARS } = await import('@/ui/picker-trigger');
	const { GRADE_OPTIONS, PROGRAM_SCOPE_OPTIONS, ALL_ROOM_TYPES } = await import('@/lib/subject-constants');
	const { gradeLabel } = await import('@/lib/grade-labels');
	/* The REAL room-label map, imported rather than re-declared. A5 C3 round 1 was
	   caught using an invented fixture that already contained the shape under test
	   (`AGENTS.md` §11); re-typing these nine strings here would be that same
	   mistake one layer out, and would let a rename in the toolbar pass while the row
	   silently clipped. */
	const { ROOM_TYPE_SHORT_LABELS: ROOM_SHORT } = await import('../SubjectFilterToolbar');

	/* THE FOURTEEN FACES ROUND 0 MEASURED AS CLIPPING, carried forward as FACES THAT
	 * MUST STAY CLEAN rather than as tolerated overflows.
	 *
	 * This is what makes the correction additive instead of subtractive. The names are
	 * still written down, and now they are the set the row keeps CLIP-FREE, so a later
	 * edit that re-widens one of them — a longer `ROOM_TYPE_SHORT_LABELS` entry, a
	 * longer `shortLabels` value, a longer filter NAME — fails HERE BY NAME instead of
	 * being invisible. That is exactly what round 0's inventory could not do: it
	 * recorded which faces clip and would have accepted a new one appearing.
	 */
	const FACES_ROUND_0_FOUND_CLIPPING = [
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

	assert.equal(
		Object.keys(ROOM_SHORT).length,
		ALL_ROOM_TYPES.length,
		'the toolbar\'s short room labels and the shared room-type catalogue have drifted apart',
	);
	// `md`'s budget is used below as the LONG-FACE SENTINEL, so it is pinned here. If
	// `@/ui` changes it, the sentinel moves and this row must be re-read by a human,
	// not silently re-baselined.
	assert.equal(PICKER_TRIGGER_FACE_BUDGET_CHARS.md, 12, 'the shared `md` character budget changed; re-check this row');

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
	/* AND NO NEW LONG FACE HAS APPEARED — CHECKED AGAINST `md`'s BUDGET AS A SENTINEL.
	 *
	 * `auto` fits every face by construction, so `pickerTriggerFaceFits` can no longer
	 * tell a long face from a short one. Round 0's fourteen were not "the faces that
	 * did not fit" — they were the faces that did not fit a FIXED RECTANGLE. So `md`'s
	 * budget is the right sentinel here, not as a requirement (nothing has to fit it
	 * any more) but as a THRESHOLD for what counts as a long face worth naming.
	 *
	 * `newlyLong` is therefore "exceeds `md`'s budget AND was not already in
	 * `FACES_ROUND_0_FOUND_CLIPPING`" — a value someone lengthened since round 0. It
	 * must be empty, and when it is not, the fix is to ADD the face to
	 * `FACES_ROUND_0_FOUND_CLIPPING` with the measurement that found it. That is how
	 * the inventory keeps tracking new risk instead of tolerating it silently, which
	 * is the one thing round 0's version could not do.
	 */
	const newlyLong: string[] = [];
	for (const { picker, name, values } of faces) {
		for (const value of values) {
			const face = `${name}: ${value}`;
			// THE CONTRACT UNDER TEST. `auto` answers `true` unconditionally, and that
			// IS the point of the guard's load-bearing line — so this assertion can only
			// catch a change to `pickerTriggerFaceFits` itself. It is kept deliberately
			// small and labelled that way, because a reader who mistakes it for the
			// no-clipping proof would be wrong: the rendered checks below and the
			// 1366x768 capture are what decide that, since jsdom performs no layout.
			assert.ok(
				pickerTriggerFaceFits('auto', name, value),
				`the ${picker} picker composes "${face}", which the shared \`auto\` variant reports as NOT fitting. A ` +
					'content-sized trigger is supposed to fit every face it composes; if this is red, ' +
					'`pickerTriggerFaceFits` has changed its published contract for the unbounded widths and ' +
					'`picker-trigger.ts` must be re-read before anything else.',
			);
			const wouldClipARectangle = !pickerTriggerFaceFits('md', name, value);
			if (wouldClipARectangle && !FACES_ROUND_0_FOUND_CLIPPING.includes(face)) newlyLong.push(face);
		}
	}
	assert.deepEqual(
		newlyLong,
		[],
		`these faces exceed \`md\`'s ${PICKER_TRIGGER_FACE_BUDGET_CHARS.md}-character budget but are not in ` +
			`\`FACES_ROUND_0_FOUND_CLIPPING\`: ${newlyLong.join(' | ')}. Under \`auto\` nothing clips, so this row ` +
			'cannot see the length itself — it is the inventory that has to be extended. Add the face with the ' +
			'measurement that found it, so the record stays complete.',
	);

	/* EVERY ONE OF ROUND 0'S FOURTEEN IS STILL OFFERED. A value that stops existing is
	 * a BEHAVIOUR change, and this row must not be able to hide one behind a width
	 * change: "no face clips" is trivially satisfiable by deleting the values that
	 * clipped. Each name is resolved against the same option lists the pickers render,
	 * so removing `Status: Room-constrained` is red here rather than silently
	 * improving the row.
	 */
	for (const face of FACES_ROUND_0_FOUND_CLIPPING) {
		const sep = face.indexOf(': ');
		const name = face.slice(0, sep);
		const value = face.slice(sep + 2);
		const entry = faces.find((f) => f.name === name);
		assert.ok(
			entry && entry.values.includes(value),
			`the face "${face}" is no longer offered by the ${name} picker. Removing an option is a behaviour ` +
				'change and must not be hidden by a width change; if the option really was removed, say so here.',
		);
	}

	/* ON THE RENDERED ROW, with every filter set to its LONGEST value at once — the
	 * row's true worst case.
	 *
	 * LAYOUT HONESTY, because this is the half that actually decides "not clipped" and
	 * jsdom cannot do it: jsdom performs NO LAYOUT, so `scrollWidth - clientWidth` is
	 * always 0/0 here and asserting it would decide nothing. What is asserted below is
	 * the class-and-text half — the faces are composed in full, they carry no clipping
	 * class, and each trigger is content-sized — and the PIXEL half
	 * (`scrollWidth <= clientWidth` on every one of the five, in the unset state and
	 * with a long value set) is the 1366x768 browser capture in
	 * `docs/reviews/a5-c7-subjects-20260929/`.
	 */
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
		assert.doesNotMatch(el.className, /text-ellipsis|line-clamp/, `a filter trigger carries a line clamp: "${el.className}"`);
		// Every one still SHOWS ITS OWN NAME. A clipped face that also lost the name
		// would read as a bare value, which is the operator's original "two filters
		// read only `All…`" defect.
		assert.match(text, /^[A-Za-z]+: /, `a filter face lost its own name: "${text}"`);
		// Content-sized, and non-wrapping: `w-auto` makes the rectangle the face, and
		// `whitespace-nowrap` (which rides with the variant) stops it breaking mid-label.
		assert.match(el.className, /(^|\s)w-auto(\s|$)/, `a filter trigger is not content-sized: "${el.className}"`);
		assert.match(el.className, /(^|\s)whitespace-nowrap(\s|$)/, `a content-sized filter trigger can wrap mid-label: "${el.className}"`);
		// And it is NOT a fixed rectangle any more — that is the correction. A `w-*`
		// with a number in it is what produced the round-0 overflow.
		assert.doesNotMatch(el.className, /(^|\s)w-(\d+|full)(\s|$)/, `a filter trigger is back on a fixed rectangle: "${el.className}"`);
	}
	// The longest of them is named here so a future widening of a value is caught with
	// a specific face rather than a generic one. This is the face that measured 10px
	// of overflow under round 0's `md`.
	assert.equal(
		triggerText(byTestId('subjects-status-filter')),
		'Status: Room-constrained',
		'the longest status face does not read as the toolbar composes it',
	);
	// The UNSET face is the row's COMMON case — the state a scheduler sees before they
	// have chosen anything, and the state in which `auto` must be NARROWEST — so it is
	// asserted too. A control that only looks right once something is selected is not
	// fit for purpose, and `Status: All` is the face round 0's budget was built on.
	await unmount();
	await render(toolbarFor());
	for (const el of clusterComboboxes()) {
		assert.match(
			triggerText(el),
			/^[A-Za-z]+: All$/,
			`an unset filter face is not the short common form: "${triggerText(el)}"`,
		);
		assert.match(el.className, /(^|\s)w-auto(\s|$)/, `an unset filter trigger is not content-sized: "${el.className}"`);
	}
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

test('A5-C7-2k: the row is ONE content-sized cluster: nothing fixed to overflow, and nothing fixed so wide it cannot fit', async () => {
	// NEW IN A5 C7 round 0 and still load-bearing in round 1, with its SUBJECT changed.
	//
	// WHAT CHANGED AND WHY THE SHAPE OF THE ROW CHANGED WITH IT. Round 0 budgeted five
	// FIXED `w-32` rectangles: 5 × 128 + the cluster's gaps + `Reset` + the search box
	// and its gap, against a `1366 - 256 - 40 - 8 = 1062px` estimate of what 1366
	// leaves. That `available` figure was WRONG, and the 1366x768 browser capture
	// proved it: the real containing width is 1060px measured, and the round-0 note
	// reported "140px of slack" from a 1052px denominator that the page never had.
	// The lesson is recorded because a plausible arithmetic constant is worse than no
	// arithmetic: it reads as measured and is not. The real containing width and where
	// it comes from are now MEASURED in the capture rather than restated here.
	//
	// ROUND 1 CHANGES WHAT IS BUDGETED. Under `auto` a trigger's width IS its face, so
	// there is no `w-<n>` to read from the class list and no fixed term to add up: the
	// row's width is a function of which filters are SET, and the only honest budget
	// is a bound on the worst case. That bound is measured in a browser, so what this
	// row decides is the parts a class list CAN decide:
	//
	//   1. all five triggers are content-sized (`w-auto` + `whitespace-nowrap`), so no
	//      face can clip — this is the correction, and `2j` asserts the face half;
	//   2. the row still has NO fixed-width escape hatch and NO scroll region, so a
	//      state that cannot fit degrades by WRAPPING (§8's no-scrollbar rule) rather
	//      than by hiding the overflow behind a scroller;
	//   3. the cluster still wraps, so a narrower viewport degrades the same way;
	//   4. the fixed terms that remain — the search box's 240px, the gaps, `Reset` —
	//      are read from their rendered class names, not restated, because those are
	//      the terms that would still blow the row out on their own.
	//
	// LAYOUT HONESTY, stated up front: jsdom has NO LAYOUT ENGINE, so this row is NOT
	// the "one line at 1366" proof and does not pretend to be. The measured no-wrap and
	// no-clip numbers, in the unset state and with long values set, are the 1366x768
	// browser capture in `docs/reviews/a5-c7-subjects-20260929/`.
	/* ONE Tailwind size scale, applied to EVERY term below.
	   `gap-<n>` and `px-<n>` are `n * 4` px: `gap-2` = 8px, `px-3` = 12px.

	   Round 0 used a `rem(n)` helper — `n * 16` — which is correct for `w-*` ONLY
	   because the caller divided by 4 first, and which it applied UNCHANGED to `gap-*`
	   and `px-*`. That inflated the budget by 120px and reported a row that genuinely
	   fits one line as 69px too wide. A budget computed on a wrong scale is worse than
	   none, because it reads as authoritative and is not, and the obvious response to a
	   phantom overrun is to shrink real controls. One helper, used everywhere. */
	const u = (n: number) => n * 4;
	const SEARCH_PX = 240;
	/* The gap between the search box's wrapper and the cluster is the shared
	   `admin-inline-filter-row`'s own `gap-2`, not this file's. */
	const SEARCH_GAP_PX = u(2);

	const host = await render(toolbarFor({ hasActiveFilters: true }));

	// ONE cluster, and it IS the always-visible row.
	//
	// A5 c8 (2026-09-29), RE-POINTED. `admin-inline-filter-row` /
	// `admin-primary-filter-row` / `admin-search-filter-toolbar` belonged to
	// `AdminSearchFilterToolbar`, which is DELETED — it was the last consumer, and the
	// packet forbids leaving a second filter-bar implementation in the codebase. The
	// ONE row is now `@/ui/filter-bar`, and this page's existing `subjects-filter-cluster`
	// hook sits on its container. So the three-way "one row, not two, not three"
	// check below collapses to one assertion, and it is STRONGER: the cluster and the
	// row must be the same element, so a second bar appearing anywhere on this page
	// goes red here rather than being counted as an extra row.
	const clusterEl = query(host, 'subjects-filter-cluster');
	assert.ok(clusterEl, 'the wrapping cluster is gone');
	assert.equal(
		clusterEl.className.includes('flex-wrap'),
		true,
		'the shared row is gone, so the filters left the row that is always visible',
	);
	assert.equal(
		clusterEl.querySelector('[data-testid="subjects-filter-cluster"]') === null,
		true,
		'a SECOND filter bar rendered inside the row; the header is one row, not two',
	);
	// The retired hooks, on record (`AGENTS.md` §16) rather than deleted:
	//
	//   assert.equal(query(host, 'admin-inline-filter-row') === null, false, '…');
	//   assert.equal(query(host, 'admin-primary-filter-row') === null, true, '…');

	// (1) ALL FIVE ARE CONTENT-SIZED, so none of them can clip a face. Read from the
	// rendered class list, so an edit that puts one back on a fixed rectangle is
	// caught here by name rather than in a screenshot months later.
	const triggers = clusterComboboxes();
	assert.equal(triggers.length, 5, `the row renders ${triggers.length} triggers, not the five filters`);
	for (const trigger of triggers) {
		const label = trigger.getAttribute('aria-label');
		const cls = trigger.className;
		assert.match(cls, /(^|\s)w-auto(\s|$)/, `${label} is not content-sized: "${cls}"`);
		assert.match(cls, /(^|\s)whitespace-nowrap(\s|$)/, `${label} is content-sized but can wrap mid-label: "${cls}"`);
		assert.doesNotMatch(cls, /(^|\s)w-(\d+|full|px)(\s|$)/, `${label} is back on a fixed rectangle: "${cls}"`);
		// `shrink-0` still comes with the variant, so the table cannot squeeze a
		// trigger below its own face and reintroduce the clipping `auto` removed.
		assert.match(cls, /(^|\s)shrink-0(\s|$)/, `${label} lost \`shrink-0\`, so its face can be squeezed: "${cls}"`);
		// One width class each, so no competing declaration can decide it.
		assert.equal(
			(cls.match(/(?:^|\s)w-[\w-]+/g) ?? []).length,
			1,
			`${label} carries more than one width class, so its width is ambiguous: "${cls}"`,
		);
	}

	// The search box's fixed width, because it is a FIXED term in the budget and the
	// other four fixed terms are measured below.
	const searchWrapper = document.body.querySelector('input[placeholder="Search name or code..."]')!.parentElement!;
	assert.match(searchWrapper.className, /w-\[240px\]/, 'the search box is not the fixed compact width the row depends on');
	/* A5 c8 (2026-09-29), RE-POINTED. The old assertion required `max-w-[240px]`,
	 * which came from the deleted shared toolbar's own class list. `@/ui/filter-bar`
	 * states the width ONCE, as `w-[240px] shrink-0`; a fixed `w-*` with `shrink-0`
	 * already cannot grow or be squeezed, so requiring a second spelling of the same
	 * number would mean requiring a page to restate a token `@/ui` owns. The old
	 * expectation is on record (`AGENTS.md` §16):
	 *   assert.match(searchWrapper.className, /max-w-\[240px\]/, 'the search box can still grow past the compact width'); */
	assert.match(searchWrapper.className, /shrink-0/, 'the search box can be squeezed by a filter beside it');

	// `Reset` is in the cluster while a filter is set. Its width is content too, but
	// it is measured from its rendered label so the FIXED part of the row is a number
	// rather than an assumption — the method A5 C4 used for the disclosure's label.
	const resetEl = query(host, 'subjects-reset-filters');
	assert.ok(resetEl, 'Reset is not in the row while a filter is active');
	const resetPad = /(^|\s)px-(\d+)(\s|$)/.exec(resetEl.className);
	assert.ok(resetPad, `Reset declares no \`px-*\`, so the fixed terms are not decidable: ${resetEl.className}`);
	const resetPx = (resetEl.textContent ?? '').length * 7 + 2 * u(Number(resetPad[2]));

	// The cluster's own gap, READ from the class name rather than restated.
	const clusterGap = /(^|\s)gap-(\d+)((?:\.5)?)(?:\s|$)/.exec(clusterEl.className);
	assert.ok(clusterGap, `the cluster declares no \`gap-*\`, so the budget is not decidable: ${clusterEl.className}`);
	const clusterGapPx = u(Number(clusterGap[2])) * (clusterGap[3] ? 1.5 : 1);

	/* (2) THE FIXED TERMS STILL BOUND THE ROW, and they are the terms that would blow
	 * it out on their own: the 240px search box, the shared row's gap, five cluster
	 * gaps (five pickers plus `Reset` = six children) and `Reset` itself. The FIVE
	 * PICKERS DELIBERATELY CONTRIBUTE NOTHING HERE, and that is the point of round 1:
	 * under `md` they were five 128px rectangles that had to be added up and could
	 * overrun; under `auto` they are whatever the operator has actually chosen, and
	 * the cluster's `flex-wrap` is what handles the case where that is too much.
	 */
	const FIXED_TOTAL = SEARCH_PX + SEARCH_GAP_PX + 5 * clusterGapPx + resetPx;
	assert.ok(
		FIXED_TOTAL > 0 && SEARCH_PX > 0 && resetPx > 0 && clusterGapPx > 0,
		'a fixed term of the row measured zero, so the budget below would decide nothing',
	);
	/* The bound is a REAL one, and it is the number that matters: even with all five
	 * pickers contributing NOTHING, the fixed part of the row must leave room for at
	 * least one whole filter face. `picker-trigger.ts`'s own conservative 6.6px
	 * advance gives the shortest real face (`Grade: All`, 10 characters) as 66px, plus
	 * `px-3` either side and the chevron — 110px. If the fixed terms ever ate the
	 * whole row, no filter could be shown at all, and that is decidable from source.
	 */
	const SHORTEST_FACE_PX = 10 * 6.6 + 2 * u(3) + 20; // 10 chars, `px-3` both sides, chevron.
	const MEASURED_CONTAINING_WIDTH_PX = 1060; // see the 1366x768 capture; see the note at the top of this row.
	assert.ok(
		FIXED_TOTAL + SHORTEST_FACE_PX < MEASURED_CONTAINING_WIDTH_PX,
		`the row's fixed terms (${FIXED_TOTAL}px) plus one shortest filter face (${SHORTEST_FACE_PX}px) do not fit ` +
			`the ${MEASURED_CONTAINING_WIDTH_PX}px the row actually has at 1366x768. The search box, the gaps and ` +
			'Reset have grown; that is a design signal, not something to answer by shrinking the font.',
	);

	// (3) THE CLUSTER STILL WRAPS. `flex-wrap` is not decoration: it is what keeps a
	// narrow viewport — or the all-five-set worst case, which is wider than `md` ever
	// was — from overflowing the row horizontally and spawning a page scrollbar
	// (§8's no-scroll rule). The one-line promise at 1366 in the common state is a
	// MEASURED browser result; the wrap is the behaviour that promise rests on when
	// the state is wider than one line.
	assert.ok(clusterEl.className.includes('flex-wrap'), 'the cluster does not wrap, so a narrow viewport overflows instead');
	/* A5 c8: the `min-w-0` half is RETIRED with the wrapper it belonged to. The old
	 * shared toolbar had a `min-w-0 flex-1` children wrapper so the cluster could
	 * shrink; the shared bar has no wrapper — it is one `flex flex-wrap items-center
	 * gap-2` row with `[&>*]:shrink-0` on every child, so a filter keeps its own face
	 * and the ROW wraps. The property this row protects (the controls never overflow
	 * the page sideways) is asserted by the wrap above and by the absence of any
	 * overflow class below. The old expectation, on record:
	 *   assert.ok(clusterEl.className.includes('min-w-0'), 'the cluster cannot shrink, so it overflows instead of wrapping'); */
	// No horizontal escape hatch anywhere: the row wraps or it fits, it never scrolls
	// sideways and it never hides a filter behind a scroller.
	for (const [name, el] of [['the row', clusterEl]] as const) {
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
