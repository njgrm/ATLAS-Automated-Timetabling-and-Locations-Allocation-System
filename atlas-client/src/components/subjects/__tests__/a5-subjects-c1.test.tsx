/**
 * A5 — operator fixes 2026-09-28, lane `a5-subjects-c1`.
 *
 * Source of the requirements, graded against the operator's own words:
 *   - item 34 / 35  clipped + illegible sortable column-header tooltips
 *                   (`Sections`, `Subjects`, `Teachers`, shared headers)
 *   - item 9.1 / 41 Subjects filter row: one compact row, one `All Status`
 *   - item 17.1    Subject coverage dialog: resizable, and a section chip that
 *                   carries the grade in a colour pill instead of repeating
 *                   `GRx Name` text
 *
 * HARNESS NOTE (AGENTS.md §11, "a proof artefact must actually discriminate"):
 * every control below renders the REAL production component through jsdom and
 * asserts the REAL DOM. jsdom has no layout engine, so no row here claims a
 * measured pixel result — the rows that concern the clipped bubble assert the
 * thing that actually causes the clip (where the bubble is mounted, and which
 * ancestors can clip it), which is a structural property jsdom can decide.
 * Controls whose name says MUTANT carry a simulated pre-fix shape so the
 * assertion is shown not to be vacuous.
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
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	SVGElement: dom.window.SVGElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLLabelElement: dom.window.HTMLLabelElement,
	HTMLFormElement: dom.window.HTMLFormElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	HTMLOListElement: dom.window.HTMLOListElement,
	DOMParser: dom.window.DOMParser,
	NodeList: dom.window.NodeList,
	AbortController: dom.window.AbortController,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window as unknown as { innerWidth: number }).innerWidth = 1366;
(dom.window as unknown as { innerHeight: number }).innerHeight = 768;
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
(dom.window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = dom.window.MouseEvent;

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { SortableHeader } = await import('../SortableHeader');
const {
	sortableColumnAriaLabel,
	sortableColumnDirection,
	sortableColumnTooltipText,
} = await import('../../table/SortableColumnHeader');
const { SortableSectionHeader } = await import('../../sections/SectionsSortableHeader');
const { AdminDataTable } = await import('../../admin-workspace/AdminDataTable');
const { SubjectFilterToolbar } = await import('../SubjectFilterToolbar');
type SubjectStatusFilter = import('../SubjectFilterToolbar').SubjectStatusFilter;
const { AdminSearchFilterToolbar } = await import('../../admin-workspace/AdminWorkspace');
const constants = await import('../../../lib/subject-constants');

let root: Root | null = null;
let hostEl: HTMLElement | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	hostEl?.remove();
	dom.window.close();
});

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
 * The one VISIBLE Radix tooltip bubble.
 *
 * Radix renders TWO nodes for one open tooltip: the styled bubble, and inside
 * it a visually hidden accessible copy carrying `role="tooltip"` (inline
 * `clip: rect(0,0,0,0)`). `document.querySelector('[role="tooltip"]')` returns
 * that 1px accessibility span, so a control written that way asserts against a
 * node that is NOT the bubble. The bubble is its PARENT — a structural
 * relationship, deliberately not a class filter, because a class filter would
 * make "the bubble carries the dark class" vacuous.
 */
function bubble(): HTMLElement {
	const hidden = Array.from(document.body.querySelectorAll('[role="tooltip"]'))
		.find((el) => (el as HTMLElement).style.clip);
	assert.ok(hidden, 'no tooltip is open — the trigger was not activated');
	const content = hidden.parentElement as HTMLElement;
	assert.ok(content && content !== document.body && content !== hidden, 'the tooltip content is not a real bubble element');
	return content;
}

/** Focus is the operator's keyboard path AND the established open gesture. */
async function openTooltip(trigger: HTMLElement): Promise<void> {
	await act(async () => { trigger.focus(); });
}

/** Any ancestor that can cut a bubble off. This is the clip predicate. */
const CLIPPING = /(^|\s)overflow-(hidden|auto|scroll|x-auto|x-scroll|y-auto|y-scroll)(\s|$)/;

/**
 * The bubble's VISIBLE text.
 *
 * `textContent` includes Radix's visually hidden `role="tooltip"` span, so the
 * raw value reads the sentence twice. The a11y span is stripped from a clone
 * (the live node is never mutated) and the operator-visible words are what is
 * asserted.
 */
function visibleText(node: Element): string {
	const clone = node.cloneNode(true) as Element;
	for (const hidden of Array.from(clone.querySelectorAll('[style*="clip"]'))) hidden.remove();
	return (clone.textContent ?? '').trim();
}

/**
 * Exact class membership.
 *
 * A substring test would call `py-1.5` a `py-1` and the pre-fix white pill a
 * `z-50`-free bubble in a way that hides which token actually changed, so the
 * style checks compare whole class tokens.
 */
function hasClass(node: Element, token: string): boolean {
	return (node.className || '').split(/\s+/).filter(Boolean).includes(token);
}

/** Ancestors from `node` up to (not including) `document.body`. */
function ancestorsToBody(node: Element): Element[] {
	const chain: Element[] = [];
	let current = node.parentElement;
	while (current && current !== document.body) {
		chain.push(current);
		current = current.parentElement;
	}
	return chain;
}

/** The first clipping ancestor's class list, or null when nothing can clip. */
function clippingAncestorClass(node: Element): string | null {
	for (const ancestor of ancestorsToBody(node)) {
		if (CLIPPING.test(ancestor.className)) return ancestor.className;
	}
	return null;
}

test('A5-34/35: the Subjects column-header bubble renders on document.body, outside the header cell, in the dark readable style', async () => {
	const host = await render(
		<table>
			<thead>
				<tr>
					<SortableHeader
						field="code"
						label="Code"
						sortField="name"
						sortDir="asc"
						onToggleSort={() => {}}
					/>
				</tr>
			</thead>
		</table>,
	);
	const cell = document.body.querySelector('th[aria-sort]') as HTMLElement;
	assert.ok(cell, 'no sortable header cell rendered');
	await openTooltip(cell.querySelector('button') as HTMLElement);
	const node = bubble();

	// WHERE IT IS MOUNTED. The pre-fix bubble rendered inside the header, so the
	// table's scroll box cut it at the top edge. Asserted as: not inside the
	// cell, not inside the table, not inside this render's container, and some
	// ancestor sits directly on `document.body` (Radix's portal container).
	assert.equal(cell.contains(node), false, 'the bubble is still mounted inside the header cell, so the container clips it');
	assert.equal(cell.closest('table')!.contains(node), false, 'the bubble is still mounted inside the table');
	assert.equal(host.contains(node), false, 'the bubble is still mounted inside the React render container');
	const portalRoot = ancestorsToBody(node).reverse().find((el) => el.parentElement === document.body);
	assert.ok(portalRoot, 'the bubble is not mounted on a document.body portal container');
	assert.notEqual(portalRoot, host, 'the "portal container" is just the render root, which clips exactly like the table did');

	// NOT CLIPPABLE. Every ancestor between the bubble and body is overflow-free.
	assert.equal(
		clippingAncestorClass(node),
		null,
		'a clipping ancestor still sits between the bubble and document.body',
	);

	// THE DARK, READABLE STYLE (operator item 34: the previous
	// `bg-popover text-popover-foreground` was a white pill on a white card).
	for (const token of ['z-50', 'bg-slate-900', 'text-white', 'font-medium', 'text-xs', 'px-2.5', 'py-1', 'rounded-md', 'shadow-md', 'pointer-events-none', 'whitespace-nowrap']) {
		assert.ok(hasClass(node, token), `the bubble is missing the standard tooltip token "${token}"`);
	}
	// It still carries a real pair of background/foreground classes, i.e. the
	// content is not white-on-white whatever the theme.
	assert.match(node.className, /bg-slate-900/);
	assert.match(node.className, /text-white/);
	assert.ok(!/bg-popover/.test(node.className), 'the white popover surface is back, so the text is unreadable again');
});

test('A5-34/35: the bubble names the column AND the sort action, and is not a restatement of the accessible name', async () => {
	// Exact strings, pinned here and produced by the exported pure helpers.
	assert.equal(sortableColumnTooltipText('Section', 'none'), 'Sort by Section');
	assert.equal(sortableColumnTooltipText('Section', 'ascending'), 'Sort ascending by Section');
	assert.equal(sortableColumnTooltipText('Section', 'descending'), 'Sort descending by Section');
	// The accessible name keeps the established plain-language contract.
	assert.equal(sortableColumnAriaLabel('Section', 'none'), 'Sort by Section, currently none');
	assert.equal(sortableColumnAriaLabel('Section', 'ascending'), 'Sort by Section, currently ascending');

	// And the same strings are what actually RENDER, in the inactive state and
	// in the ascending state.
	const inactive = await render(
		<table><thead><tr>
			<SortableHeader field="code" label="Code" sortField="name" sortDir="asc" onToggleSort={() => {}} />
		</tr></thead></table>,
	);
	await openTooltip(document.body.querySelector('th[aria-sort] button') as HTMLElement);
	assert.equal(visibleText(bubble()), 'Sort by Code', 'the rendered bubble does not name the column');
	const inactiveAria = (document.body.querySelector('th[aria-sort] button') as HTMLElement).getAttribute('aria-label');
	assert.equal(inactiveAria, 'Sort by Code, currently none');
	assert.notEqual(visibleText(bubble()), inactiveAria, 'the bubble is the aria-label restated, not an action sentence');
	void inactive;

	const ascending = await render(
		<table><thead><tr>
			<SortableHeader field="code" label="Code" sortField="code" sortDir="asc" onToggleSort={() => {}} />
		</tr></thead></table>,
	);
	await openTooltip(document.body.querySelector('th[aria-sort] button') as HTMLElement);
	assert.equal(visibleText(bubble()), 'Sort ascending by Code', 'the rendered bubble does not name the active sort action');
	assert.equal(
		(document.body.querySelector('th[aria-sort] button') as HTMLElement).getAttribute('aria-label'),
		'Sort by Code, currently ascending',
	);
	void ascending;
});

test('A5-34/35: aria-sort and the button accessible name carry the sort state in all three states', async () => {
	assert.equal(sortableColumnDirection('code', 'name', 'asc'), 'none');
	assert.equal(sortableColumnDirection('code', 'code', 'asc'), 'ascending');
	assert.equal(sortableColumnDirection('code', 'code', 'desc'), 'descending');

	const states: Array<[SortFieldish, 'asc' | 'desc', string]> = [
		[{ field: 'name', sortField: 'code' } as SortFieldish, 'asc', 'none'],
		[{ field: 'code', sortField: 'code' } as SortFieldish, 'asc', 'ascending'],
		[{ field: 'code', sortField: 'code' } as SortFieldish, 'desc', 'descending'],
	];
	for (const [state, dir, expected] of states) {
		await render(
			<table><thead><tr>
				<SortableHeader
					field={state.field}
					label="Subject"
					sortField={state.sortField}
					sortDir={dir}
					onToggleSort={() => {}}
				/>
			</tr></thead></table>,
		);
		const cell = document.body.querySelector('th[aria-sort]') as HTMLElement;
		assert.equal(cell.getAttribute('aria-sort'), expected, `aria-sort is wrong for ${JSON.stringify(state)}/${dir}`);
		const trigger = cell.querySelector('button') as HTMLElement;
		assert.equal(trigger.tagName, 'BUTTON', 'the header trigger is not a real <button> (AGENTS.md §8)');
		assert.equal(
			trigger.getAttribute('aria-label'),
			`Sort by Subject, currently ${expected}`,
			'the accessible name no longer carries the column and the direction',
		);
		assert.equal(trigger.getAttribute('title'), null, 'the header carries a title= attribute (AGENTS.md §8)');
		assert.equal(cell.querySelector('details'), null, 'the header uses a raw <details> (AGENTS.md §8)');
	}
});

test('A5-34/35 PRESERVATION: the Sections table header — a file this lane did not edit — now gets the same portalled dark bubble', async () => {
	// `sections/SectionsSortableHeader.tsx` is NOT in this lane's owned paths and
	// was not touched. This row is the rendered proof that the shared primitive
	// fixed the operator's `/sections` report anyway.
	const host = await render(
		<table><thead><tr>
			<SortableSectionHeader
				field="name"
				label="Section"
				sortField="enrolledCount"
				sortDir="desc"
				onToggleSort={() => {}}
			/>
		</tr></thead></table>,
	);
	const cell = document.body.querySelector('th[aria-sort]') as HTMLElement;
	await openTooltip(cell.querySelector('button') as HTMLElement);
	const node = bubble();
	assert.equal(cell.contains(node), false, 'the Sections bubble is still inside the header cell');
	assert.equal(host.contains(node), false, 'the Sections bubble is still inside the render container');
	assert.equal(clippingAncestorClass(node), null, 'a clipping ancestor still sits above the Sections bubble');
	for (const token of ['z-50', 'bg-slate-900', 'text-white', 'font-medium']) {
		assert.ok(hasClass(node, token), `the Sections bubble is missing "${token}"`);
	}
});

test('A5-34/35 PRESERVATION + MUTANT CONTROL: the shared AdminDataTable header path is fixed, and the pre-fix placement is provably clipped', async () => {
	// `AdminDataTable` is the shell every admin table renders inside, including
	// Teachers. This row renders the REAL `AdminTableShell` — the `Card
	// overflow-hidden` + `flex-1 min-h-0 overflow-auto` scroll box that caused
	// items 34 and 35 — and proves two things:
	//   1. the real bubble is portalled out of that scroll box, and
	//   2. the clip predicate is not vacuous: the SAME bubble, cloned back into
	//      the header cell inside that shell, IS inside a clipping ancestor.
	// Row 2 is the mutant control — it fails the moment the fix is reverted,
	// and it fails loudly if the predicate were trivially true.
	await render(
		<AdminDataTable
			data={[{ id: 1, name: 'Bonifacio' }]}
			columns={[
				{ id: 'name', label: 'Section', cellRole: 'identity', sortKey: 'name', render: (row) => row.name },
			]}
			getRowKey={(row) => String(row.id)}
			sort={{ key: 'name', direction: 'asc' }}
			onSortChange={() => {}}
			emptyState={{ icon: null, title: 'No sections', description: 'Nothing yet.' }}
			noResultsState={{ icon: null, title: 'No matches', description: 'Nothing matched.' }}
		/>,
	);
	const cell = document.body.querySelector('th[data-column-id="name"]') as HTMLElement;
	assert.ok(cell, 'the AdminDataTable header did not render');
	await openTooltip(cell.querySelector('button') as HTMLElement);
	const node = bubble();
	assert.equal(cell.contains(node), false, 'the AdminDataTable bubble is still inside the header cell');
	assert.equal(clippingAncestorClass(node), null, 'a clipping ancestor still sits above the AdminDataTable bubble');
	for (const token of ['z-50', 'bg-slate-900', 'text-white']) {
		assert.ok(hasClass(node, token), `the AdminDataTable bubble is missing "${token}"`);
	}

	// MUTANT: the pre-fix shape. The bubble lives where it used to live.
	const preFix = node.cloneNode(true) as HTMLElement;
	cell.appendChild(preFix);
	const shell = document.body.querySelector('.overflow-hidden') as HTMLElement;
	assert.ok(shell, 'the real AdminTableShell overflow-hidden card is not in the DOM, so this row proves nothing');
	assert.ok(
		clippingAncestorClass(preFix) !== null,
		'MUTANT CONTROL DID NOT FIRE: cloning the bubble back into the header cell is not detected as clipped, so the "no clipping ancestor" assertion is vacuous',
	);
	preFix.remove();
});

/** The Subjects `SortField` union, as the two-state table above indexes it. */
type SortFieldish = { field: 'code' | 'name'; sortField: 'code' | 'name' };

test('A5-34/35 MUTANT CONTROL: the PRE-FIX bubble class list is rejected by the rendered-style check, so that check is not vacuous', async () => {
	// The base `TooltipContent` class list, verbatim. Item 34 asked for `z-50`
	// and the standard dark style; the base was `z-[9999]` with a
	// `bg-popover text-popover-foreground` white pill.
	const PRE_FIX = 'z-[9999] overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in';
	const REQUIRED = ['z-50', 'bg-slate-900', 'text-white', 'font-medium', 'text-xs', 'px-2.5', 'py-1', 'rounded-md', 'shadow-md', 'pointer-events-none', 'whitespace-nowrap'];

	// The same predicate row 1 applies to the rendered bubble.
	const missing = (className: string) => {
		const tokens = className.split(/\s+/).filter(Boolean);
		return REQUIRED.filter((token) => !tokens.includes(token));
	};
	assert.deepEqual(
		missing(PRE_FIX),
		['z-50', 'bg-slate-900', 'text-white', 'font-medium', 'px-2.5', 'py-1', 'pointer-events-none', 'whitespace-nowrap'],
		'MUTANT CONTROL DID NOT FIRE: the pre-fix class list no longer fails the style check, so row 1 is asserting nothing',
	);

	// And the LIVE bubble passes it — the same predicate, opposite outcome.
	await render(
		<table><thead><tr>
			<SortableHeader field="code" label="Code" sortField="name" sortDir="asc" onToggleSort={() => {}} />
		</tr></thead></table>,
	);
	await openTooltip(document.body.querySelector('th[aria-sort] button') as HTMLElement);
	assert.deepEqual(missing(bubble().className), [], 'the live bubble does not carry the required tooltip style');
	assert.ok(hasClass(bubble(), 'py-1'), 'the live bubble is not the compact `py-1` inset');
});

// ---------------------------------------------------------------------------
// A5 slice 2 — items 9.1 + 41: the Subjects filter row.
// ---------------------------------------------------------------------------

/** Radix Select opens on pointerdown, not on click. */
async function click(el: Element | null): Promise<void> {
	await act(async () => {
		const target = el as HTMLElement;
		const init = { bubbles: true, cancelable: true, button: 0, ctrlKey: false };
		target.dispatchEvent(new dom.window.MouseEvent('pointerdown', { ...init, pointerType: 'mouse' } as never));
		target.dispatchEvent(new dom.window.MouseEvent('mousedown', init));
		target.dispatchEvent(new dom.window.MouseEvent('pointerup', { ...init, pointerType: 'mouse' } as never));
		target.dispatchEvent(new dom.window.MouseEvent('mouseup', init));
		target.dispatchEvent(new dom.window.MouseEvent('click', init));
	});
}

const TERM_OPTIONS = [
	{ value: 'all', label: 'All terms', kind: 'all' as const },
	{ value: 'rank:1', label: 'Term 1', kind: 'term' as const },
];

type ToolbarProps = React.ComponentProps<typeof SubjectFilterToolbar>;

const TOOLBAR: ToolbarProps = {
	searchQuery: '',
	onSearchChange: () => {},
	hasActiveFilters: false,
	subjectStatusFilter: 'all',
	onSubjectStatusFilterChange: () => {},
	roomTypeFilter: 'all',
	onRoomTypeFilterChange: () => {},
	gradeLevelFilter: 'all',
	onGradeLevelFilterChange: () => {},
	programScopeFilter: 'all',
	onProgramScopeFilterChange: () => {},
	termFilter: 'all',
	onTermFilterChange: () => {},
	termOptions: TERM_OPTIONS,
	onResetFilters: () => {},
};

/** Open a select and return its rendered options, in order. */
async function openSelect(trigger: Element | null, options: { skipPreClose?: boolean } = {}): Promise<Element[]> {
	// A5: the filters are Radix POPOVER pickers now, not Radix `Select`. A popover is
	// modal, so a popover left open by an earlier row makes the rest of the document
	// `pointer-events: none` and the next click lands on an inert body. Closing first is
	// what a real user gets by clicking away, and it keeps this row testing the filter
	// rather than the previous row's cleanup.
	//
	// `skipPreClose` (A5 C4) is for the rows that reach a filter THROUGH the
	// `More filters` disclosure. There the pre-close would tear down the DISCLOSURE
	// and unmount the very trigger the caller already resolved and passed in, so the
	// subsequent click lands on a detached node. Those rows open the disclosure
	// themselves and have no stale popover to clear. It is opt-in: every existing
	// caller keeps the default, so no other row's cleanup changes.
	if (!options.skipPreClose) {
		await act(async () => {
			document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		});
	}
	await click(trigger);
	const listbox = document.body.querySelector('[role="listbox"]');
	assert.ok(listbox, 'the select did not open its listbox');
	return Array.from(listbox.querySelectorAll('[role="option"]'));
}

async function chooseOption(options: Element[], label: string): Promise<void> {
	const option = options.find((o) => (o.textContent ?? '').trim() === label);
	assert.ok(option, `option "${label}" is not offered`);
	await click(option);
}

/** Every `role=combobox` trigger inside the one wrapping cluster, in order. */
function clusterTriggers(): HTMLElement[] {
	const cluster = document.body.querySelector('[data-testid="subjects-filter-cluster"]');
	assert.ok(cluster, 'the wrapping filter cluster is gone');
	return Array.from(cluster.querySelectorAll('[role="combobox"]'));
}

/**
 * A5 C7 ITEM 43 (2026-09-29) — THE DISCLOSURE IS GONE.
 *
 * A5 C4 (2026-09-29) moved `Status`, `Room` and `Term` under ONE `More filters`
 * disclosure ("Keep Grade and Program visible and put the other filters under 'More
 * filters'"). Item 43 supersedes it: all five are in the row permanently.
 *
 * `moreFiltersTrigger()` and `ensureMoreFiltersOpen()` are KEPT, not deleted, and both
 * now ASSERT THEIR OWN ABSENCE. They are the seam every row in this file that used to
 * say "reach a filter through the disclosure" already calls, so keeping them means
 * those rows needed no restructuring at all — their helper call became a stronger
 * assertion instead of a removed line. A C4-shaped accommodation that quietly stayed
 * behind would let a reintroduced disclosure pass this whole suite; these two helpers
 * are what make that impossible (`AGENTS.md` §16).
 */
function moreFiltersTrigger(): never {
	const button = document.body.querySelector<HTMLElement>('[data-testid="subjects-more-filters"]');
	assert.equal(
		button === null,
		true,
		'the `More filters` disclosure is back in the row; item 43 put all five filters in the row permanently',
	);
	throw new Error('unreachable: `subjects-more-filters` is absent, which is what this helper asserts');
}

/** Every `role=combobox` currently rendered, wherever it lives (cluster or disclosure). */
function allVisibleTriggers(): HTMLElement[] {
	return Array.from(document.body.querySelectorAll('[role="combobox"]')) as HTMLElement[];
}

/**
 * A5 C7: assert all five filters are in the row with NO interaction — the replacement
 * for A5 C4's idempotent "open the disclosure" step.
 *
 * It keeps A5 C4's shape (a single helper every caller already invokes) and changes
 * what it decides: on A5 C4 this clicked a toggle, which meant a filter could only be
 * checked from inside the disclosure. Here it checks the CLOSED row, so a filter that
 * had been re-hidden would be red here by name.
 */
async function ensureMoreFiltersOpen(): Promise<void> {
	const inRow = Array.from(
		document.body.querySelectorAll('[data-testid="subjects-filter-cluster"] [role="combobox"]'),
	);
	assert.equal(
		inRow.length,
		5,
		`the row carries ${inRow.length} filters with no interaction; item 43 requires all five, and ` +
			'a filter reachable only through a disclosure is a filter a scheduler has to hunt for',
	);
	assert.equal(
		document.body.querySelector('[data-testid="subjects-more-filters"]') === null,
		true,
		'a `More filters` disclosure is back in the row',
	);
}

test('A5-9.1/41: the filter row is ONE cluster with exactly one All Status control, and ALL FIVE filters are in it', async () => {
	await render(<MemoryRouter><SubjectFilterToolbar {...TOOLBAR} hasActiveFilters /></MemoryRouter>);

	// One row: the shared inline row, with no second always-visible row beside it.
	assert.ok(document.body.querySelector('[data-testid="admin-inline-filter-row"]'), 'the single filter row is gone');
	assert.equal(document.body.querySelector('[data-testid="admin-primary-filter-row"]') === null, true, 'a second always-visible filter row is back');

	// One wrapping cluster carrying the whole row, at the operator's spacing.
	//
	// A5 C7 ITEM 43: `gap-2.5` becomes `gap-2`. This is the spacing BETWEEN SIBLINGS
	// of a flex row, not chrome on a control, so §8's "one look per control" does not
	// apply to it — and §8 in fact requires the one change, because the row now holds
	// five pickers plus Reset where A5 C4 held two plus a disclosure, and `gap-2` is
	// what keeps all of them inside one line at 1366. The width budget that depends on
	// it is asserted in `a5-c4-subjects-filter-disclosure.test.tsx` (`A5-C7-2k`) and,
	// as a rendered no-wrap result, in the 1366x768 browser capture.
	const cluster = document.body.querySelector('[data-testid="subjects-filter-cluster"]') as HTMLElement;
	for (const token of ['flex', 'flex-wrap', 'items-center', 'gap-2']) {
		assert.ok(hasClass(cluster, token), `the cluster is missing "${token}"`);
	}
	// `gap-2.5` must not survive as a competing declaration alongside `gap-2`; the
	// tailwind-merge rule that governs the pickers' widths is the same one, and two
	// gap classes would make the budget undecidable from source.
	assert.equal(hasClass(cluster, 'gap-2.5'), false, 'the cluster still carries `gap-2.5` alongside `gap-2`');

	// EXACTLY ONE status-looking trigger, and its resting label is the
	// operator's own `Status: All` — the duplicate `All statuses` dropdown is
	// gone.
	//
	// A5 C3 R3 §1, update not delete: BEFORE this read `All Status` (and before
	// that, in R1 A1's wording, `Status: All statuses`). The operator's words are
	// `Grade: All`, `Program: All` — short name, one-word value — so the trigger
	// now reads `Status: All` while the POPOVER keeps the full option labels and
	// the ACCESSIBLE NAME keeps the long form. The property this row exists for
	// is unchanged: exactly one status-looking control, and no second status
	// dropdown anywhere.
	//
	// A5 C4, RE-POINTED, AND NOW SUPERSEDED BY A5 C7 ITEM 43 — the trigger used to be
	// reached by opening ONE disclosure. It is now reached from the row itself, and the
	// count is taken over the whole document, so a SECOND status control hidden
	// anywhere would still be caught.
	await ensureMoreFiltersOpen();
	const statusish = allVisibleTriggers().filter((t) => /status/i.test(`${t.getAttribute('aria-label') ?? ''} ${t.textContent ?? ''}`));
	assert.equal(statusish.length, 1, `expected exactly one status control, found ${statusish.length}: ${statusish.map((t) => t.getAttribute('aria-label')).join(', ')}`);
	assert.equal((statusish[0].textContent ?? '').trim(), 'Status: All', 'the merged status control does not read the operator\'s "Status: All"');

	// Every filter the operator had is still present and still names itself in its
	// own words. `Trigger: All` for all five, and the FULL labels still available in
	// the popovers and the accessible names.
	//
	// A5 C7 ITEM 43, RE-POINTED — this was `assert.equal(triggers.length, 5, …)` and
	// a loop over five `[aria-label]` lookups. The count of FILTERS is still five and
	// the loop is unchanged; what changed is that all five are now read from the
	// CLOSED row, so the loop no longer proves anything about a control that was only
	// reachable after a click. A5 C4's accommodation — read two visible, then open the
	// disclosure to read three more — is recorded verbatim above and superseded here.
	assert.equal(allVisibleTriggers().length, 5, `expected 5 offered filters (Status, Grade, Program, Room, Term), found ${allVisibleTriggers().length}`);
	for (const label of [
		'Filter by subject status: All statuses',
		'Filter by grade level: All grades',
		'Filter by program scope: All programs',
		'Filter by room type: All room types',
		'Filter by rotation term: All terms',
	]) {
		assert.ok(document.body.querySelector(`[aria-label="${label}"]`), `filter "${label}" is not offered`);
	}
	// A5 C3 R3 §1, update not delete: the operator's RESTING labels are now
	// `{ShortName}: All` — `Status: All`, `Grade: All`, `Program: All`, `Room: All`.
	// BEFORE this row pinned the long forms as the trigger's resting text
	// (`All Status`, `All Grades`, `All Programs`, `All Room Types`), which is
	// the defect the operator screenshotted: a rectangle that says only "All…"
	// and never says which filter it is. The FULL labels are still what the
	// popover offers, asserted below and in `subjects-ux-a3.test.tsx`.
	for (const label of ['Status: All', 'Grade: All', 'Program: All', 'Room: All', 'Term: All']) {
		assert.ok(allVisibleTriggers().some((t) => (t.textContent ?? '').trim() === label), `no trigger reads "${label}"`);
	}

	// A5 C4, SUPERSEDED BY A5 C7 ITEM 43 — what this used to assert, recorded verbatim:
	//   assert.equal(<buttons matching /more filters/i>.length, 0,
	//     'a "More filters" disclosure is back');
	// A5 C4 replaced that absence check with a count and a name, because A5 C4 HAD a
	// disclosure. Item 43 removes the disclosure, so the ORIGINAL absence assertion is
	// restored — and this is a case where restoring it is the strengthening, not the
	// weakening: on A5 C4 a scheduler read two filters and had to open a button to
	// discover the page was filtered at all; on A5 C7 all five are on screen and
	// nothing has to be opened. A count badge on a grouping button was the thing the
	// operator could not read.
	const disclosures = Array.from(document.body.querySelectorAll('button')).filter((b) =>
		/^More filters/.test((b.textContent ?? '').trim()),
	);
	assert.equal(disclosures.length, 0, `a \`More filters\` disclosure is back in the row (found ${disclosures.length})`);
	// And ALL FIVE are directly visible with no interaction — the inverse of the A5 C4
	// subtraction, and the assertion that makes the disclosure's return red.
	assert.equal(clusterTriggers().length, 5, `expected all 5 filters directly in the row, found ${clusterTriggers().length}`);
	assert.equal(/EnrollPro year and terms verified live/.test(document.body.textContent ?? ''), false, 'the green EnrollPro notice strip is back');

	// The handles A3-C10 introduced are preserved. The Room handle is now inside
	// the disclosure, which is opened above, so it resolves.
	assert.ok(document.body.querySelector('[data-testid="subjects-room-type-filter"]'), 'the Room Type handle is gone');
	assert.ok(document.body.querySelector('[data-testid="subjects-program-filter"]'), 'the Program handle is gone');
	assert.ok(document.body.querySelector('[data-testid="subjects-reset-filters"]'), 'Reset is not offered while a filter is active');
});

test('A5-9.1/41: the search box is the fixed compact width, and every select carries the same compact dimensions', async () => {
	await render(<MemoryRouter><SubjectFilterToolbar {...TOOLBAR} /></MemoryRouter>);

	const search = document.body.querySelector('input[placeholder="Search name or code..."]') as HTMLInputElement | null;
	assert.ok(search, 'the search box is gone');
	assert.equal(search.placeholder, 'Search name or code...', 'the search placeholder is not the operator text');
	const wrapper = search.parentElement as HTMLElement;
	assert.ok(hasClass(wrapper, 'w-[240px]'), `the search wrapper is not w-[240px]: ${wrapper.className}`);
	assert.ok(hasClass(wrapper, 'max-w-[240px]'), 'the search box can still grow past the compact width');
	for (const token of ['h-9', 'text-xs']) {
		assert.ok(hasClass(search, token), `the search input is missing "${token}"`);
	}

	// A5 C3: the trigger dimensions moved OUT of this page and into
	// `@/ui/picker-trigger`, because `AGENTS.md` §8 "One look per control" says a
	// control's size is a variant and a variant belongs in `@/ui` so every page gets
	// it. BEFORE, every select had to carry this page's own string verbatim:
	//   ['h-9', 'text-xs', 'px-3', 'rounded-xl', 'border', 'border-slate-200',
	//    'bg-white', 'hover:bg-slate-50', 'transition-colors']
	// AFTER, each trigger carries the shared variant — `h-9` (the one height token,
	// also on the search box), `w-32` (the one even width), `text-xs`, `px-3`, and
	// the case normalisation — and the radius/border/background come from
	// `@/ui/button variant="outline"`, which is the Section and Teacher pickers'
	 // look, the reference the operator named. The assertion is still per-trigger,
	 // still on the RENDERED class list, and a page that restated any of these
	 // would fail here.
	//
	// A5 C4, RE-POINTED AND STRENGTHENED. This used to read the two or more
	// triggers in the cluster and `assert.ok(triggers.length >= 4)`. Three of the
	// five now sit behind the disclosure, so the row's own length check could only
	// ever see two — and §8's "one look per control" is decided by the look, not by
	// the row a control happens to sit in. So the same per-trigger assertions now
	// run over ALL FIVE, with the disclosure open: the shared height, width, type
	// size, padding and case are proven identical for the visible two AND the
	// hidden three. That is a stronger gate than the one it replaces, not a weaker
	// one.
	const rowTriggers = clusterTriggers();

	// Grades use the shared compact DepEd form, not `Grade 7`.
	//
	// A5 C4 ORDER NOTE — this check runs BEFORE the disclosure is opened, and that
	// ordering is load-bearing rather than cosmetic. `openSelect` begins by
	// dispatching `Escape` to close whatever is open; with a disclosure mounted
	// that also tears down its `DismissableLayer` and `hideOthers`, and whether the
	// next `pointerdown` lands before or after that teardown is the exact race this
	// file already documented for `openFilter` (see the A3-C10 Room/Program
	// comment). Grade is a row control that needs no disclosure, so it is read
	// from the untouched toolbar and the row stays deterministic.
	const options = await openSelect(document.body.querySelector('[aria-label="Filter by grade level: All grades"]'));
	const labels = options.map((o) => (o.textContent ?? '').trim());
	assert.equal(labels[0], 'All grades', 'the grade filter has no "All grades" reset option');
	for (const grade of constants.GRADE_OPTIONS) {
		assert.ok(labels.includes(`GR${grade}`), `the grade option is not the shared compact GR${grade} form`);
	}
	assert.equal(labels.includes('Grade 7'), false, 'the grade options use a second spelling');
	assert.equal(labels.length, constants.GRADE_OPTIONS.length + 1, 'the grade list lost an option');

	// A5 C7 ITEM 43: NO disclosure is opened here, and none is needed. A5 C4's line
	// was `await click(moreFiltersTrigger());` — the call site that turned a genuine
	// reachability question into "press the button this page told you to press". It
	// is kept as `ensureMoreFiltersOpen()`, which now asserts all five are already
	// in the row, so the row is still checked from the same place in the sequence.
	await ensureMoreFiltersOpen();
	const triggers = allVisibleTriggers();
	assert.equal(triggers.length, 5, `expected 5 offered filters, found ${triggers.length}`);
	for (const trigger of triggers) {
		for (const token of ['h-9', 'w-32', 'text-xs', 'px-3', 'normal-case']) {
			assert.ok(hasClass(trigger, token), `a select trigger is missing the shared "${token}": ${trigger.getAttribute('aria-label')}`);
		}
		// The page-local chrome string is gone, not renamed: `rounded-xl` +
		// `border-slate-200` + `bg-white` were this page's own look, and §8 forbids it.
		for (const gone of ['rounded-xl', 'border-slate-200', 'bg-white']) {
			assert.equal(hasClass(trigger, gone), false, `a select trigger still carries the page-local override "${gone}"`);
		}
	}
	// All five share ONE width, which is what R1 J3 asks for and what makes the
	// 1366 width budget decidable from source.
	const widths = new Set(triggers.map((t) => (t.className.match(/(?:^|\s)w-[\w-]+/) ?? ['NONE'])[0].trim()));
	assert.equal(widths.size, 1, `the five filters carry ${widths.size} different widths: ${[...widths].join(' | ')}`);
	// A5 C7: all five are in the row with no interaction. A5 C4's `assert.equal(
	// rowTriggers.length, 2, …)` is recorded verbatim in this file's A5 C7 notes and
	// superseded — under item 43 the count is five, and a filter that needed a
	// disclosure to appear would fail `ensureMoreFiltersOpen()` above.
	assert.equal(rowTriggers.length, 5, `expected all 5 filters directly in the row, found ${rowTriggers.length}`);
});

test('A5-9.1/41 LOAD-BEARING: the one status control reaches BOTH axes — lifecycle and coverage attention', async () => {
	// The merge must not have dropped the coverage-attention axis. Every option
	// the two old dropdowns offered is offered by the one control, and each
	// choice reaches the page with the value the existing predicates read.
	const fired: string[] = [];
	const reset = () => { fired.push('reset'); };
	await render(
		<MemoryRouter>
			<SubjectFilterToolbar
				{...TOOLBAR}
				hasActiveFilters
				onSubjectStatusFilterChange={(v: SubjectStatusFilter) => { fired.push(`status:${v}`); }}
				onResetFilters={reset}
			/>
		</MemoryRouter>,
	);
	// A5 C4, RE-POINTED: the status control now sits behind the one `More filters`
	// disclosure, so the disclosure is opened first. NOTHING else in this row is
	// weakened — the union of options below, and the exact value each choice
	// delivers, are asserted exactly as before. `openSelect` already closes any
	// popover left open before clicking, so this does not race the picker.
	await ensureMoreFiltersOpen();
	const options = await openSelect(document.body.querySelector('[aria-label="Filter by subject status: All statuses"]'), { skipPreClose: true });
	const labels = options.map((o) => (o.textContent ?? '').trim());
	assert.deepEqual(
		labels,
		['All statuses', 'Active', 'Archived', 'Missing teacher coverage', 'Room-constrained subjects'],
		'the merged status control does not offer the full union of the two old dropdowns',
	);

	// Lifecycle axis, then the coverage-attention axis the duplicate control
	// used to carry — the whole point of merging rather than deleting. Each
	// choice re-opens the control, because picking closes the listbox.
	//
	// A5 C4, RE-POINTED: the status control now sits behind the one `More filters`
	// disclosure, so it is opened on each pass. Each pass also re-renders, which is
	// this file's OWN documented remedy for the nested-popover teardown race (see
	// the A3-C10 Room/Program comment: "Unmounting removes the teardown instead of
	// racing it"). `fired` is carried across, so the first pass's evidence is still
	// asserted by the deepEqual below. Nothing here is weakened: the union of
	// options above, and the exact value each choice delivers, are asserted exactly
	// as before.
	for (const label of ['Active', 'Missing teacher coverage', 'Room-constrained subjects', 'Archived']) {
		await render(
			<MemoryRouter>
				<SubjectFilterToolbar
					{...TOOLBAR}
					hasActiveFilters
					onSubjectStatusFilterChange={(v: SubjectStatusFilter) => { fired.push(`status:${v}`); }}
					onResetFilters={reset}
				/>
			</MemoryRouter>,
		);
		await ensureMoreFiltersOpen();
		const options = await openSelect(document.body.querySelector('[aria-label="Filter by subject status: All statuses"]'), { skipPreClose: true });
		await chooseOption(options, label);
	}
	assert.deepEqual(
		fired,
		['status:active', 'status:missing-coverage', 'status:room-constrained', 'status:inactive'],
		`a chosen status did not reach the page, or an axis was lost (got ${fired.join(',')})`,
	);

	// Reset still reaches the page, and is offered only while a filter is active
	// (A3-C10's rule, unchanged).
	await render(
		<MemoryRouter><SubjectFilterToolbar {...TOOLBAR} hasActiveFilters onResetFilters={reset} /></MemoryRouter>,
	);
	await click(document.body.querySelector('[data-testid="subjects-reset-filters"]'));
	assert.equal(fired[fired.length - 1], 'reset', 'Reset did not reach the page');
	await render(<MemoryRouter><SubjectFilterToolbar {...TOOLBAR} hasActiveFilters={false} /></MemoryRouter>);
	assert.equal(
		document.body.querySelector('[data-testid="subjects-reset-filters"]') === null,
		true,
		'Reset is offered with no filter active',
	);
});

test('A5-9.1/41 PRESERVATION: a consumer that passes no search override still renders the shared h-8 input', async () => {
	// `AdminSearchFilterToolbar` is shared by Sections and Faculty, which pass
	// neither `searchMaxWidthClassName` nor `searchInputClassName`. The new prop
	// is default-off, so their toolbar must render what it rendered before.
	await render(
		<AdminSearchFilterToolbar
			searchValue=""
			onSearchChange={() => {}}
			searchPlaceholder="Search sections..."
			filtersOpen={false}
			onToggleFilters={() => {}}
			hasActiveFilters={false}
		/>,
	);
	const search = document.body.querySelector('input[placeholder="Search sections..."]') as HTMLInputElement | null;
	assert.ok(search, 'the default search input did not render');
	assert.ok(hasClass(search, 'h-8'), `the default input lost h-8: ${search.className}`);
	assert.ok(hasClass(search, 'pl-9'), 'the default input lost the icon inset');
	assert.equal(hasClass(search, 'h-9'), false, 'the Subjects compact height leaked into the shared default');
	const wrapper = search.parentElement as HTMLElement;
	assert.ok(hasClass(wrapper, 'sm:max-w-sm'), `the default search width changed: ${wrapper.className}`);
});

// ---------------------------------------------------------------------------
// A5 slice 3 — item 17.1: the Subject coverage dialog.
// ---------------------------------------------------------------------------

const { SubjectCoverageSheet } = await import('../SubjectCoverageSheet');
const { GRADE_COLORS, gradeLabel } = await import('../../../lib/grade-labels');

type CoverageDetail = import('../SubjectCoverageSheet').SubjectCoverageDetail;

function coverageDetail(overrides: Partial<CoverageDetail> = {}): CoverageDetail {
	return {
		assigned: [
			{
				facultyId: 7,
				name: 'FERNANDEZ, JANELLA MARIE',
				// The teacher's FULL grade set — deliberately wider than the two
				// sections below, so a control cannot pass by the badge row and the
				// chips agreeing by accident.
				grades: [7, 9, 10],
				load: 79,
				sections: [
					{ id: 1, grade: 7, name: 'Bonifacio' },
					{ id: 2, grade: 9, name: 'Tulip' },
				],
			},
		],
		uncoveredGrades: [10],
		programScopes: ['REGULAR'],
		...overrides,
	};
}

async function renderCoverage(detail: CoverageDetail): Promise<void> {
	await render(
		<MemoryRouter>
			<SubjectCoverageSheet
				subject={COVERAGE_SUBJECT}
				loading={false}
				detail={detail}
				errorBySubjectId={new Map()}
				onRetry={() => {}}
				onClose={() => {}}
			/>
		</MemoryRouter>,
	);
}

const COVERAGE_SUBJECT = {
	id: 41,
	code: 'SCI10',
	name: 'Earth Science',
	displayCode: 'SCI10',
	outputLabel: null,
	ownerDepartment: 'SCI',
	allowedOwnerDepartments: [] as string[],
	qualificationPriority: 'DEPARTMENT_FIRST' as const,
	rotationFamily: null,
	minMinutesPerWeek: 225,
	preferredRoomType: 'CLASSROOM' as const,
	isActive: true,
	isSeedable: false,
	isSystemManaged: false,
	gradeLevels: [7, 9, 10],
	interSectionEnabled: false,
	interSectionGradeLevels: [] as number[],
	modularGroupId: null,
	modularOrder: null,
	programScopes: ['REGULAR'],
	allowedSpecializations: [] as string[],
	requiredFeatures: [] as string[],
	rotationTermLabel: null,
	rotationTermRank: null,
	rotationTermGroupId: null,
	rotationTermCount: null,
	updatedAt: '2026-09-27T00:00:00.000Z',
} as never;

test('A5-17.1(1): the coverage dialog is resizable at the operator bounds, and is still centered by the primitive', async () => {
	await renderCoverage(coverageDetail());
	const dialog = document.body.querySelector('[data-testid="subject-coverage-dialog"]') as HTMLElement | null;
	assert.ok(dialog, 'the coverage dialog did not render');

	// RESIZABLE, at the four bounds the operator specified.
	assert.equal(dialog.style.resize, 'both', 'the dialog is not resizable (CSS `resize: both`)');
	for (const bound of ['min-w-[500px]', 'max-w-[95vw]', 'min-h-[420px]', 'max-h-[90vh]']) {
		assert.ok(hasClass(dialog, bound), `the dialog is missing the bound ${bound}`);
	}
	// It still owns its own scroll: a resize must not turn the card into a page
	// scroll region.
	assert.ok(hasClass(dialog, 'overflow-hidden'), 'the dialog lost overflow-hidden');
	const scroller = document.body.querySelector('[data-testid="subject-coverage-scroll"]') as HTMLElement | null;
	assert.ok(scroller, 'no internal scroll region');
	for (const token of ['overflow-y-auto', 'min-h-0', 'flex-1']) {
		assert.ok(hasClass(scroller, token), `the dialog body lost "${token}"`);
	}

	// STILL CENTERED. The primitive's own `left-[50%] top-[50%]` positioning is
	// what the `animate-modal-in` translate keys re-centre at any size, which is
	// why no JS re-centring was added.
	assert.ok(hasClass(dialog, 'left-[50%]'), 'the dialog lost its horizontal centring anchor');
	assert.ok(hasClass(dialog, 'top-[50%]'), 'the dialog lost its vertical centring anchor');

	// The resize affordance is VISIBLE, not just available.
	const grip = document.body.querySelector('[data-testid="subject-coverage-resize-grip"]') as HTMLElement | null;
	assert.ok(grip, 'there is no visible resize grip');
	assert.equal(grip.getAttribute('aria-hidden'), 'true', 'the decorative grip is exposed to assistive tech');
	assert.ok(hasClass(grip, 'pointer-events-none'), 'the grip swallows the drag instead of the card receiving it');
	assert.ok(dialog.contains(grip), 'the grip is not inside the resizable card');
	assert.ok(grip.querySelector('svg'), 'the grip renders no icon');
});

test('A5-17.1(2): the teacher card shows the name and the load badge, and no duplicate grade row and no ASSIGNED SECTIONS subheader', async () => {
	await renderCoverage(coverageDetail());
	const text = document.body.textContent ?? '';

	// Essentials kept.
	assert.match(text, /FERNANDEZ, JANELLA MARIE/, 'the teacher name is gone');
	assert.match(text, /79% Load/, 'the workload badge is gone');

	// The header grade-badge row is gone. The teacher carries grades 7, 9 and 10
	// and only TWO sections, so if the header row were still rendering there
	// would be five `GRx` pills on screen instead of the section count.
	const pills = Array.from(document.body.querySelectorAll('span')).filter((s) => /^GR\d+$/.test((s.textContent ?? '').trim()));
	assert.equal(pills.length, 2, `expected exactly one grade pill per section (2), found ${pills.length}: ${pills.map((p) => p.textContent).join(', ')}`);

	// The subheader text is gone.
	assert.equal(/Assigned Sections/i.test(text), false, 'the "Assigned Sections" subheader is back');
	assert.equal(/assigned sections/i.test(text), false, 'an "assigned sections" label is still rendered');
});

test('A5-17.1(3): each section renders a colour-coded grade pill beside the section NAME ONLY, at the shared DepEd colour', async () => {
	await renderCoverage(coverageDetail());
	// Selected by the operator's own chip class (`border-slate-200/80`), which
	// no other element in the dialog carries.
	const chips = Array.from(document.body.querySelectorAll('div.border-slate-200\\/80')) as HTMLElement[];
	assert.equal(chips.length, 2, `expected one chip per section, found ${chips.length}`);

	const expected = [
		{ name: 'Bonifacio', grade: 7 },
		{ name: 'Tulip', grade: 9 },
	];
	// The chip container is the operator's shape, verbatim.
	const wrap = chips[0].parentElement as HTMLElement;
	for (const token of ['flex', 'flex-wrap', 'gap-2', 'pt-2']) {
		assert.ok(hasClass(wrap, token), `the section wrap is missing "${token}"`);
	}
	for (const token of ['px-2.5', 'py-1', 'rounded-lg', 'bg-slate-50', 'border-slate-200/80']) {
		assert.ok(hasClass(chips[0], token), `the section chip is missing "${token}"`);
	}

	for (const [index, want] of expected.entries()) {
		const chip = chips[index];
		const pill = chip.querySelector('span') as HTMLElement;
		const name = chip.querySelectorAll('span')[1] as HTMLElement;
		// The grade pill text is the SHARED compact form, and its colour comes
		// from the ONE shared palette — GR7 green, GR9 red.
		assert.equal((pill.textContent ?? '').trim(), gradeLabel(want.grade), `the grade pill is not the shared ${gradeLabel(want.grade)}`);
		const palette = GRADE_COLORS[String(want.grade)];
		assert.ok(palette, 'the shared palette has no entry for this grade');
		for (const token of palette.split(' ')) {
			assert.ok(hasClass(pill, token), `the grade pill colour is not the shared palette token "${token}"`);
		}
		// THE DISCRIMINATING ROW: the name is the NAME. Before the fix the chip
		// held the whole display string `GR7 Bonifacio`, so the grade was
		// printed a second time as text.
		assert.equal((name.textContent ?? '').trim(), want.name, 'the section name is not the bare section name');
		assert.equal(/^GR\d/.test((name.textContent ?? '').trim()), false, 'the section name still carries a GRx prefix');
		assert.ok(hasClass(name, 'text-xs') && hasClass(name, 'font-medium'), 'the section name lost its type classes');
	}

	// ITEM 17.1(4): the SAME layout for every assigned teacher, not just the
	// first. Two teachers, different grades, and both cards must render the
	// identical chip shape with a bare name.
	await renderCoverage(
		coverageDetail({
			assigned: [
				{
					facultyId: 7,
					name: 'FERNANDEZ, JANELLA MARIE',
					grades: [7, 9],
					load: 79,
					sections: [{ id: 1, grade: 7, name: 'Bonifacio' }],
				},
				{
					facultyId: 8,
					name: 'SANTOS, MIGUEL',
					grades: [10],
					load: 55,
					sections: [{ id: 2, grade: 10, name: 'Gold' }],
				},
			],
		}),
	);
	const allChips = Array.from(document.body.querySelectorAll('div.border-slate-200\\/80')) as HTMLElement[];
	assert.equal(allChips.length, 2, 'the second teacher card did not get the same section layout');
	assert.deepEqual(
		allChips.map((chip) => (chip.querySelectorAll('span')[1].textContent ?? '').trim()),
		['Bonifacio', 'Gold'],
		'a teacher card renders the section differently from the other',
	);
	assert.deepEqual(
		allChips.map((chip) => (chip.querySelector('span.rounded-full')?.textContent ?? '').trim()),
		[gradeLabel(7), gradeLabel(10)],
		'a teacher card is missing the shared grade pill',
	);
	for (const token of GRADE_COLORS['10'].split(' ')) {
		assert.ok(hasClass(allChips[1].querySelector('span.rounded-full') as HTMLElement, token), `the GR10 pill lost the shared palette token "${token}"`);
	}
	assert.match(document.body.textContent ?? '', /SANTOS, MIGUEL/);
	assert.match(document.body.textContent ?? '', /55% Load/);
});

test('A5-17.1(3) EDGE + MUTANT CONTROL: a section with no usable grade shows no pill, and the palette cannot be bypassed', async () => {
	// `grade: null` must render the name alone — a missing grade is not guessed
	// and not rendered as a blank pill.
	await renderCoverage(
		coverageDetail({
			assigned: [
				{
					facultyId: 9,
					name: 'SANTOS, MIGUEL',
					grades: [10],
					load: 40,
					sections: [{ id: null, grade: null, name: 'Ungraded Wing' }],
				},
			],
		}),
	);
	const chip = document.body.querySelector('div.border-slate-200\\/80') as HTMLElement;
	assert.ok(chip, 'the chip for the gradeless section did not render');
	assert.equal(chip.querySelector('span.rounded-full'), null, 'a grade pill was invented for a section with no grade');
	assert.equal((chip.textContent ?? '').trim(), 'Ungraded Wing');

	// MUTANT CONTROL: the shared palette is the only source of the grade
	// colour. Hard-coding a grade fill (the defect the AR2 watch item named)
	// would render `bg-green-100` where the palette says `bg-green-100/80`, and
	// the token check below is what catches it.
	const withPalette = coverageDetail();
	await renderCoverage(withPalette);
	const pill = document.body.querySelector('span.rounded-full') as HTMLElement;
	const grade = 7;
	const palette = GRADE_COLORS[String(grade)];
	for (const token of palette.split(' ')) {
		assert.ok(hasClass(pill, token), `MUTANT CONTROL DID NOT FIRE: the pill does not carry the shared palette token "${token}"`);
	}
	// No grade fill is hard-coded anywhere in the dialog's rendered classes: the
	// only grade-coloured classes in the surface come from the palette strings.
	const gradeColours = Array.from(document.body.querySelectorAll('span.rounded-full'))
		.flatMap((el) => (el.className || '').split(/\s+/).filter((c) => /^(bg|text)-(green|yellow|red|blue)-\d+/.test(c)));
	for (const token of gradeColours) {
		assert.ok(
			Object.values(GRADE_COLORS).some((entry) => entry.split(' ').includes(token)),
			`MUTANT CONTROL DID NOT FIRE: "${token}" is a hard-coded grade colour, not the shared palette's`,
		);
	}
	assert.ok(gradeColours.length > 0, 'no grade colour rendered, so the palette control proved nothing');
});
