/**
 * A5 C4 ITEM 2 (2026-09-29) — `/subjects` filters: Grade and Program stay visible,
 * Status / Room / Term move under ONE `More filters` disclosure.
 *
 * THE FINDING, VERBATIM (Lane C, Codex staging walk, train 6):
 *   "Keep Grade and Program visible and put the other filters under 'More filters'."
 *
 * WHY THIS IS NOT A WIDTH PROBLEM. Codex confirmed no truncation on this page and
 * the row already holds one line at 1366. The finding is about COMPETING
 * CONTROLS: a scheduler has to read five pickers to know the page is filtered, and
 * three of them are refinements rather than the two axes a scheduler actually works
 * by. Grade and Program are what a scheduler filters BY. Status, Room and Term
 * narrow an answer that is already in hand.
 *
 * `AGENTS.md` §11's Design judgement gate, applied as four checks:
 *   1 ONE PRIMARY ACTION — the row now offers one disclosure, not three more
 *     competing rectangles; the two filters a scheduler filters by are still
 *     one click from the box.
 *   2 NOTHING TRUNCATED — asserted directly: no visible trigger carries an
 *     ellipsis, and a long option label in the LIST is still allowed.
 *   3 NO JARGON — `More filters` names itself and, when filters are set, COUNTS
 *     them, so a hidden active filter is never invisible. The count is of SET
 *     filters, never of options.
 *   4 CONTROLS MATCH OTHER PAGES (§8) — the disclosure is the repo's own
 *     `@/ui/popover`, the same primitive every `@/ui/filter-picker` is built on.
 *     Nothing here is hand-rolled.
 *
 * THE TWO c3 SLICE-B REGRESSIONS THIS MUST NOT REINTRODUCE. Both are in here
 * because both are now reachable through a path that did not exist before:
 *   - B1 `Enter` must not be able to select a `disabled` option. With the
 *     pickers behind a disclosure, a keypress that used to land on nothing now
 *     lands on a listbox, so the guard has to still hold there.
 *   - B2 no control may claim `All` for a filter that offers no such choice.
 *
 * EVERY ROW STATES WHICH ASSERTION IS RED ON THE BASE (`d2be382d`), because a row
 * that passes on base proves nothing (`AGENTS.md` §11).
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

let root: Root | null = null;
let hostEl: HTMLElement | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	hostEl?.remove();
	dom.window.close();
});

async function render(node: React.ReactNode): Promise<void> {
	await unmount();
	hostEl = document.createElement('div');
	document.body.appendChild(hostEl);
	root = createRoot(hostEl);
	await act(async () => { root?.render(node); });
}

async function unmount(): Promise<void> {
	if (root) await act(async () => { root?.unmount(); });
	root = null;
	hostEl?.remove();
	hostEl = null;
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

function byTestId(id: string): HTMLElement | null {
	return document.body.querySelector(`[data-testid="${id}"]`);
}
function cluster(): HTMLElement | null {
	return byTestId('subjects-filter-cluster');
}
function triggerText(el: Element | null): string {
	return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}
/** The disclosure's own button, found by the label the packet names. */
function moreFiltersButton(): HTMLElement | null {
	const buttons = Array.from(document.body.querySelectorAll('button')) as HTMLElement[];
	return buttons.find((b) => /^More filters/.test(triggerText(b))) ?? null;
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

test('A5-C4-2a: Grade and Program are visible with no interaction; Status, Room and Term are NOT in the row', async () => {
	// RED ON BASE at the second half: Status, Room and Term render as three more
	// rectangles in the same row, so the disclosure does not exist at all.
	await render(toolbarFor());

	assert.ok(
		cluster()?.textContent?.includes('Grade'),
		'Grade is not in the visible row with no interaction',
	);
	assert.ok(
		cluster()?.textContent?.includes('Program'),
		'Program is not in the visible row with no interaction',
	);

	// THE ROW'S OWN SUBTRACTION: three controls leave the visible row. Asserted as
	// "not in the document before the disclosure is opened", which is the honest
	// reading — a control that is merely visually hidden would still be a control
	// a keyboard tab lands on.
	for (const id of ['subjects-status-filter', 'subjects-room-type-filter']) {
		assert.equal(
			byTestId(id) === null,
			true,
			`${id} is still rendered in the visible row; it was supposed to move under the disclosure`,
		);
	}
	assert.doesNotMatch(
		triggerText(cluster()),
		/^Status:|^Room:|^Term:/,
		`the visible row still reads one of the refinement filters: "${triggerText(cluster())}"`,
	);

	// The two that stayed are still real comboboxes, not decoration.
	const visibleComboboxes = Array.from(cluster()?.querySelectorAll('[role="combobox"]') ?? []) as HTMLElement[];
	assert.equal(visibleComboboxes.length, 2, `expected 2 visible filters, found ${visibleComboboxes.length}`);
	await unmount();
});

test('A5-C4-2b: ONE disclosure named `More filters`, and opening it reveals all three operable filters', async () => {
	// RED ON BASE: no control reads `More filters`, so the first assertion is red.
	await render(toolbarFor());

	const disclosure = moreFiltersButton();
	assert.ok(disclosure, 'there is no `More filters` disclosure in the row');
	// ONE disclosure, not three: a scheduler has one thing to open, not a set.
	const disclosures = (Array.from(document.body.querySelectorAll('button')) as HTMLElement[]).filter((b) =>
		/^More filters/.test(triggerText(b)),
	);
	assert.equal(disclosures.length, 1, `the row carries ${disclosures.length} disclosures, not one`);

	await press(disclosure);

	assert.ok(byTestId('subjects-status-filter'), 'Status is not present once the disclosure is open');
	assert.ok(byTestId('subjects-room-type-filter'), 'Room is not present once the disclosure is open');
	const termPresent = Array.from(document.body.querySelectorAll('[role="combobox"]')).some((c) =>
		triggerText(c).startsWith('Term:'),
	);
	assert.ok(termPresent, 'Term is not present once the disclosure is open');

	// INDIVIDUALLY OPERABLE, not merely present: a room type chosen inside the
	// disclosure must reach the page. This is the row that fails an implementation
	// which renders the three but leaves them inert.
	const fired: string[] = [];
	await unmount();
	await render(toolbarFor({ onRoomTypeFilterChange: (v: string) => fired.push(`room:${v}`) }));
	await press(moreFiltersButton());
	await press(byTestId('subjects-room-type-filter'));
	const listbox = document.body.querySelector('[role="listbox"]');
	assert.ok(listbox, 'the Room picker inside the disclosure did not open its own listbox');
	const option = (Array.from(listbox.querySelectorAll('[role="option"]')) as HTMLElement[]).find(
		(o) => o.textContent?.trim() === 'Science Laboratory',
	);
	assert.ok(option, 'the room catalogue is not offered inside the disclosure');
	await press(option);
	assert.deepEqual(fired, ['room:LABORATORY'], `a choice inside the disclosure did not reach the page (got ${fired.join(',')})`);
	await unmount();
});

test('A5-C4-2c: the disclosure NAMES the state — `More filters (1)` — and a hidden filter still reads its own value', async () => {
	// RED ON BASE: the label does not exist, and `Room: Laboratory` is a row trigger
	// that the packet moves behind the disclosure.
	await render(toolbarFor({ roomTypeFilter: 'LABORATORY', hasActiveFilters: true }));

	assert.equal(
		triggerText(moreFiltersButton()),
		'More filters (1)',
		`the disclosure does not count the one set filter: "${triggerText(moreFiltersButton())}"`,
	);
	await press(moreFiltersButton());
	assert.equal(
		triggerText(byTestId('subjects-room-type-filter')),
		'Room: Laboratory',
		'the hidden Room filter does not still name its own value, so a set filter is invisible',
	);

	// TWO set filters read (2) — the count is of SET filters, never of options. A
	// disclosure that counted options would read (3) here with nothing set.
	await unmount();
	await render(toolbarFor({ roomTypeFilter: 'LABORATORY', gradeLevelFilter: 9, hasActiveFilters: true }));
	assert.equal(
		triggerText(moreFiltersButton()),
		'More filters (1)',
		`a filter that is NOT behind the disclosure is counted in it: "${triggerText(moreFiltersButton())}"`,
	);
	await unmount();
	await render(toolbarFor({ roomTypeFilter: 'LABORATORY', termFilter: '1', hasActiveFilters: true }));
	assert.equal(
		triggerText(moreFiltersButton()),
		'More filters (2)',
		`the disclosure does not count both set refinement filters: "${triggerText(moreFiltersButton())}"`,
	);
	await unmount();
});

test('A5-C4-2d: opening the disclosure changes NO filter — it is a disclosure, not a second value', async () => {
	// RED ON BASE is vacuous here (there is no disclosure); the row exists so a
	// future disclosure that defaults a filter is caught.
	const fired: string[] = [];
	await render(toolbarFor({
		onSubjectStatusFilterChange: (v: string) => fired.push(`status:${v}`),
		onRoomTypeFilterChange: (v: string) => fired.push(`room:${v}`),
		onTermFilterChange: (v: string) => fired.push(`term:${v}`),
		onResetFilters: () => fired.push('reset'),
	}));
	await press(moreFiltersButton());
	assert.deepEqual(fired, [], `opening the disclosure changed a filter (got ${fired.join(',')})`);
	await press(moreFiltersButton());
	assert.deepEqual(fired, [], `closing the disclosure changed a filter (got ${fired.join(',')})`);
	await unmount();
});

test('A5-C4-2e: Reset appears when any filter is set and clears all five', async () => {
	// RED ON BASE only in the second half: with Room behind the disclosure, a
	// filter that is set but hidden must still be clearable from the row.
	await render(toolbarFor({ roomTypeFilter: 'LABORATORY', hasActiveFilters: true }));
	assert.ok(byTestId('subjects-reset-filters'), 'Reset is not offered while a hidden filter is active');

	const fired: string[] = [];
	await unmount();
	await render(toolbarFor({
		roomTypeFilter: 'LABORATORY',
		hasActiveFilters: true,
		onResetFilters: () => fired.push('reset'),
	}));
	await press(byTestId('subjects-reset-filters'));
	assert.deepEqual(fired, ['reset'], 'Reset did not reach the page');

	await unmount();
	await render(toolbarFor({ hasActiveFilters: false }));
	assert.equal(byTestId('subjects-reset-filters') === null, true, 'Reset is offered with no filter active');
	await unmount();
});

test('A5-C4-2f: nothing in the visible row or the disclosure is truncated, and Escape closes the disclosure', async () => {
	// RED ON BASE: there is no disclosure to close. The truncation half is a
	// preservation row - the packet calls an ellipsis a defect everywhere.
	await render(toolbarFor());
	await press(moreFiltersButton());
	await press(byTestId('subjects-room-type-filter'));
	const optionTexts = (Array.from(document.body.querySelectorAll('[role="option"]')) as HTMLElement[]).map((o) =>
		(o.textContent ?? '').trim(),
	);
	// A LONG option label in the LIST is fine - the list has the room.
	assert.ok(
		optionTexts.includes('Science Laboratory'),
		`a long option label was shortened in the list: ${optionTexts.join(' | ')}`,
	);
	for (const el of Array.from(document.body.querySelectorAll('[role="combobox"]')) as HTMLElement[]) {
		const cls = el.className;
		assert.doesNotMatch(cls, /(^|\s)truncate(\s|$)/, `a visible filter trigger is truncated: ${el.getAttribute('aria-label')}`);
		assert.doesNotMatch(triggerText(el), /…|\.\.\./, `a visible filter label is cut off: "${triggerText(el)}"`);
	}

	await unmount();
	await render(toolbarFor());
	await press(moreFiltersButton());
	assert.ok(byTestId('subjects-status-filter'), 'the disclosure did not open');
	await act(async () => {
		document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});
	await act(async () => { await Promise.resolve(); });
	assert.equal(
		byTestId('subjects-status-filter') === null,
		true,
		'Escape did not close the disclosure; a keyboard user is trapped in it',
	);
	await unmount();
});

test('A5-C4-2g c3-slice-B B1: the disclosure adds NO selection path of its own, so the disabled-option guard is still the only one', async () => {
	// WHAT THIS ROW REALLY DECIDES, stated because an earlier draft of it claimed
	// more than the page can decide.
	//
	// The draft fed the Term picker a fixture carrying `disabled: true`. That
	// fixture was INVENTED: `TermFilterOption` (`subject-term-filter.ts:45`) has
	// exactly three fields — `value`, `label`, `kind` — and no `/subjects` filter
	// is ever given a disabled option by real data. An invented fixture that
	// already contains the shape under test is the exact mistake `AGENTS.md` §11
	// warns about, so that draft is replaced rather than kept.
	//
	// What IS decidable here, and is genuinely new to this path: the disclosure
	// renders NO selectable option of its own. Every option on this page is
	// produced by `@/ui/filter-picker`, whose listbox is the ONE guarded path —
	// c3 slice B's B1 (`Enter` cannot select a `disabled` option) lives in
	// `searchable-select.tsx:225` and is re-asserted by `a5-c3-picker-contract`,
	// which this packet runs green. A disclosure that rendered its own list, or
	// forwarded a keydown of its own, would be a second unguarded path; this row
	// is what makes that visible if a later edit introduces one.
	const fired: string[] = [];
	await render(toolbarFor({
		onTermFilterChange: (v: string) => fired.push(v),
		onSubjectStatusFilterChange: (v: string) => fired.push(v),
	}));
	const disclosure = moreFiltersButton();
	await press(disclosure);
	assert.equal(
		document.body.querySelectorAll('[role="option"]').length,
		0,
		'the disclosure itself rendered options; it must delegate selection to @/ui/filter-picker',
	);
	// Enter on the disclosure with no listbox open must not select anything.
	await act(async () => {
		document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		disclosure!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	});
	await act(async () => { await Promise.resolve(); });
	// A5 C4 NOTE ON THE SPREAD: `assert.deepEqual` is declared as an ASSERTION
	// function, so `assert.deepEqual(fired, [])` narrows `fired` to `never[]` for
	// the rest of the scope — and the `fired.push(v)` calls further down then fail
	// to type-check. Asserting on a COPY keeps the comparison identical and leaves
	// the real array writable.
	assert.deepEqual([...fired], [], `Enter on the closed disclosure selected a value (got ${fired.join(',')})`);

	// And the guarded path is still the one that runs: a term chosen from inside
	// the disclosure reaches the page through `@/ui`'s own listbox.
	await unmount();
	await render(toolbarFor({ onTermFilterChange: (v: string) => fired.push(v) }));
	await press(moreFiltersButton());
	const termTrigger = (Array.from(document.body.querySelectorAll('[role="combobox"]')) as HTMLElement[]).find((c) =>
		triggerText(c).startsWith('Term:'),
	);
	assert.ok(termTrigger, 'the Term picker is not inside the disclosure');
	await press(termTrigger);
	const term1 = (Array.from(document.body.querySelectorAll('[role="option"]')) as HTMLElement[]).find(
		(o) => o.textContent?.trim() === 'Term 1',
	);
	assert.ok(term1, 'the term options are not offered through the @/ui listbox');
	await press(term1);
	assert.deepEqual(fired, ['1'], `a term chosen inside the disclosure did not reach the page (got ${fired.join(',')})`);
	await unmount();
});

test('A5-C4-2h c3-slice-B B2: no control behind the disclosure claims `All` for a list that offers no such choice', async () => {
	// The Term picker is given a list with NO `all` member — the shape that made
	// c3 slice B's B2 defect ("Archived year: all" on a control offering no All).
	await render(toolbarFor({ termFilter: '', termOptions: [{ value: '7', label: 'Term 7', kind: 'term' as const }] }));
	await press(moreFiltersButton());
	const termTrigger = (Array.from(document.body.querySelectorAll('[role="combobox"]')) as HTMLElement[]).find((c) =>
		triggerText(c).startsWith('Term:'),
	);
	assert.ok(termTrigger, 'the Term picker is not inside the disclosure');
	assert.doesNotMatch(
		triggerText(termTrigger),
		/: All$/,
		`a control with no \`all\` choice still claims it: "${triggerText(termTrigger)}"`,
	);
	await unmount();
});
