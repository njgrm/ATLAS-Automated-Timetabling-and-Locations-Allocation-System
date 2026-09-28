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
async function openSelect(trigger: Element | null): Promise<Element[]> {
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

test('A5-9.1/41: the filter row is ONE cluster with exactly one All Status control, and nothing left to disclose', async () => {
	await render(<MemoryRouter><SubjectFilterToolbar {...TOOLBAR} hasActiveFilters /></MemoryRouter>);

	// One row: the shared inline row, with no second always-visible row beside it.
	assert.ok(document.body.querySelector('[data-testid="admin-inline-filter-row"]'), 'the single filter row is gone');
	assert.equal(document.body.querySelector('[data-testid="admin-primary-filter-row"]') === null, true, 'a second always-visible filter row is back');

	// One wrapping cluster carrying the whole row, at the operator's spacing.
	const cluster = document.body.querySelector('[data-testid="subjects-filter-cluster"]') as HTMLElement;
	for (const token of ['flex', 'flex-wrap', 'items-center', 'gap-2.5']) {
		assert.ok(hasClass(cluster, token), `the cluster is missing "${token}"`);
	}

	// EXACTLY ONE status-looking trigger, and its resting label is the
	// operator's `All Status` — the duplicate `All statuses` dropdown is gone.
	const triggers = clusterTriggers();
	const statusish = triggers.filter((t) => /status/i.test(`${t.getAttribute('aria-label') ?? ''} ${t.textContent ?? ''}`));
	assert.equal(statusish.length, 1, `expected exactly one status control, found ${statusish.length}: ${statusish.map((t) => t.getAttribute('aria-label')).join(', ')}`);
	assert.equal((statusish[0].textContent ?? '').trim(), 'All Status', 'the merged status control does not read "All Status"');
	assert.equal(statusish[0].getAttribute('aria-label'), 'Filter by subject status');
	assert.equal(/All statuses/.test(document.body.textContent ?? ''), false, 'the lowercase-plural duplicate label is back');

	// The operator's four filters are all directly present, plus the retained
	// term filter. Nothing is behind a disclosure, and no second row exists.
	assert.equal(triggers.length, 5, `expected 5 direct filters (Status, Grades, Programs, Room Types, Term), found ${triggers.length}`);
	for (const label of [
		'Filter by subject status',
		'Filter by grade level',
		'Filter by program scope',
		'Filter by room type',
		'Filter by rotation term',
	]) {
		assert.ok(document.body.querySelector(`[aria-label="${label}"]`), `filter "${label}" is not directly visible`);
	}
	// The operator's resting labels, verbatim.
	for (const label of ['All Status', 'All Grades', 'All Programs', 'All Room Types']) {
		assert.ok(triggers.some((t) => (t.textContent ?? '').trim() === label), `no trigger reads "${label}"`);
	}

	// NOTHING to disclose: no "More filters" control, and the green EnrollPro
	// strip (item 9.1(1)) is not in the DOM.
	assert.equal(
		Array.from(document.body.querySelectorAll('button')).filter((b) => /more filters/i.test(b.textContent ?? '')).length,
		0,
		'a "More filters" disclosure is back',
	);
	assert.equal(/EnrollPro year and terms verified live/.test(document.body.textContent ?? ''), false, 'the green EnrollPro notice strip is back');

	// The handles A3-C10 introduced are preserved.
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

	// The operator's exact trigger dimensions, on EVERY select.
	const triggers = clusterTriggers();
	assert.ok(triggers.length >= 4, 'no select triggers rendered');
	for (const trigger of triggers) {
		for (const token of ['h-9', 'text-xs', 'px-3', 'rounded-xl', 'border', 'border-slate-200', 'bg-white', 'hover:bg-slate-50', 'transition-colors']) {
			assert.ok(hasClass(trigger, token), `a select trigger is missing "${token}": ${trigger.getAttribute('aria-label')}`);
		}
	}

	// Grades use the shared compact DepEd form, not `Grade 7`.
	const options = await openSelect(document.body.querySelector('[aria-label="Filter by grade level"]'));
	const labels = options.map((o) => (o.textContent ?? '').trim());
	assert.equal(labels[0], 'All Grades', 'the grade filter has no "All Grades" reset option');
	for (const grade of constants.GRADE_OPTIONS) {
		assert.ok(labels.includes(`GR${grade}`), `the grade option is not the shared compact GR${grade} form`);
	}
	assert.equal(labels.includes('Grade 7'), false, 'the grade options use a second spelling');
	assert.equal(labels.length, constants.GRADE_OPTIONS.length + 1, 'the grade list lost an option');
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
	const options = await openSelect(document.body.querySelector('[aria-label="Filter by subject status"]'));
	const labels = options.map((o) => (o.textContent ?? '').trim());
	assert.deepEqual(
		labels,
		['All Status', 'Active', 'Archived', 'Missing teacher coverage', 'Room-constrained subjects'],
		'the merged status control does not offer the full union of the two old dropdowns',
	);

	// Lifecycle axis, then the coverage-attention axis the duplicate control
	// used to carry — the whole point of merging rather than deleting. Each
	// choice re-opens the control, because picking closes the listbox.
	for (const label of ['Active', 'Missing teacher coverage', 'Room-constrained subjects', 'Archived']) {
		const options = await openSelect(document.body.querySelector('[aria-label="Filter by subject status"]'));
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
