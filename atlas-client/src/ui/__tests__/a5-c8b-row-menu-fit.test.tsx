/**
 * A5 c8b (2026-09-29) — THE GATE ON THE ROSTER ROW MENU.
 *
 * `AGENTS.md` §11: *"A test no gate runs is not evidence."* This file is wired to
 * `test:ux-row-menu-fit` in `atlas-client/package.json` in the SAME commit, and
 * that script is listed inside `test:a6-c8-more-filters`, the suite the previous
 * rounds of this work already ran, so a run of the existing suite cannot miss it.
 *
 * WHAT DEFECT THIS IS A GATE ON
 *
 * The operator's teachers.docx round, item 6: *"Row 3-dots menu items wrap to two
 * lines. NOT STARTED: `AdminDataTable.tsx:176` fixes the menu at `w-52` (208px) for
 * every roster."* On the Teachers roster that fixed 208px box wrapped "Edit
 * temporary teacher details" onto two lines. A row action is a VERB PHRASE the
 * scheduler has to read before clicking it, and a phrase broken after "temporary"
 * is what makes a menu look broken.
 *
 * §11 also says *"a control's fixture must come from the real surface."* So the
 * rows below open the REAL `AdminDataTable` row menu through the REAL
 * `useFacultyRowActions`, and the label they assert on is the label the product
 * renders — `FacultyRowActions.tsx`'s own 'Edit temporary teacher details'. No row
 * here re-types a width or invents a label.
 *
 * THIS IS A CLASS CONTRACT, NOT ACCEPTANCE EVIDENCE. It cannot measure a pixel:
 * JSDOM has no layout, so "one line" and "not spilling off the right edge" are
 * properties of the CSS contract these classes express, and only a rendered
 * screenshot at 1366x768 shows the sentence on one line. The planner runs that.
 * What this file can do, and does, is stop the contract from being undone by the
 * next page that picks its own width — which is how five rosters ended up with
 * five different answers to the same question.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/teachers' });
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
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	SVGElement: dom.window.SVGElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	DOMParser: dom.window.DOMParser,
	NodeList: dom.window.NodeList,
	AbortController: dom.window.AbortController,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
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

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { AdminDataTable } = await import('@/components/admin-workspace/AdminDataTable');
const { useFacultyRowActions } = await import('@/components/faculty/FacultyRowActions');
const { rowMenuContentClassName, rowMenuItemClassName } = await import('@/ui/dropdown-menu');

const srcRoot = resolve(import.meta.dirname, '../../..', 'src');

function source(relativePath: string): string {
	return readFileSync(join(srcRoot, relativePath), 'utf8');
}

/** Strip comments, so a rule cannot be satisfied — or broken — by prose. */
function code(relativePath: string): string {
	return source(relativePath)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

/** Every production file under `src/`, tests excluded. */
function productionFiles(dir = srcRoot, found: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry === '__tests__' || entry === 'node_modules') continue;
			productionFiles(full, found);
			continue;
		}
		if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry)) continue;
		found.push(full);
	}
	return found;
}

const roots = new WeakMap<HTMLElement, Root>();
async function render(node: React.ReactNode): Promise<HTMLElement> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	roots.set(host, root);
	await act(async () => { root.render(node); });
	return host;
}

async function unmount(host: HTMLElement): Promise<void> {
	const root = roots.get(host);
	if (root) {
		await act(async () => { root.unmount(); });
		roots.delete(host);
	}
	host.remove();
}

/** Radix opens a DropdownMenu on `pointerdown`, not on `click`. */
function openMenu(trigger: Element | null): Promise<void> {
	return act(async () => {
		const target = trigger as HTMLElement;
		const init = { bubbles: true, cancelable: true, button: 0, ctrlKey: false };
		target.dispatchEvent(new dom.window.MouseEvent('pointerdown', { ...init, pointerType: 'mouse' } as never));
		target.dispatchEvent(new dom.window.MouseEvent('mousedown', init));
		target.dispatchEvent(new dom.window.MouseEvent('pointerup', { ...init, pointerType: 'mouse' } as never));
		target.dispatchEvent(new dom.window.MouseEvent('mouseup', init));
		target.dispatchEvent(new dom.window.MouseEvent('click', init));
	});
}

const byTestId = (id: string) => document.body.querySelector(`[data-testid="${id}"]`);

/**
 * A TEMPORARY teacher, on the shape `a3-c10-teacher-surface.test.tsx` uses.
 *
 * `isPlaceholder: true` is the branch that produces the defect: it is the only
 * branch that puts 'Edit temporary teacher details' — the widest label in the
 * roster's row menu — into the menu at all, so a fixture with
 * `isPlaceholder: false` would render a menu with nothing in it and this file
 * would pass without ever exercising the sentence that wrapped.
 */
const TEMPORARY_TEACHER: any = {
	id: 77, firstName: 'JUN', lastName: 'DELA CRUZ', department: 'Mathematics',
	employmentStatus: 'REGULAR', employeeId: 'EMP-0077', isActiveForScheduling: true,
	isClassAdviser: false, isPlaceholder: true, maxHoursPerWeek: 40,
	policyCreditedHours: 0, sectionTeachingHours: 0, actualTeachingHours: 0,
	subjectCount: 0, sectionCount: 0, advisoryEquivalentHours: 0, ancillaryMinutesPerWeek: 0,
	advisedSectionName: null, version: 1, assignments: [],
};

/** The Teachers roster row, wired exactly as `pages/Faculty.tsx:669` wires it. */
function RosterHarness({ faculty }: { faculty: any }) {
	const rowActions = useFacultyRowActions({
		onReviewLoad: () => {},
		onOpenProfile: () => {},
		onEditTemporary: () => {},
		onDeleteTemporary: () => {},
	});
	return (
		<MemoryRouter>
			<AdminDataTable<any>
				data={[faculty]}
				columns={[{ id: 'name', label: 'Teacher', render: (row: any) => `${row.firstName} ${row.lastName}` }]}
				getRowKey={(row: any) => row.id}
				rowActions={rowActions as any}
				emptyState={{ icon: <span />, title: 'No teachers' }}
				noResultsState={{ icon: <span />, title: 'No matches' }}
			/>
		</MemoryRouter>
	);
}

// ===========================================================================
// 1. THE RECIPE — one definition, and it is the one §8 says lives in @/ui.
// ===========================================================================

test('A5-C8B-RECIPE-1: the recipe is declared once, in @/ui, and the primitive base is untouched', () => {
	const src = code('ui/dropdown-menu.tsx');
	/* The file exports everything from one block at the bottom, so a name has to
	   be declared once AND listed there. Asserting only the declaration would pass
	   on a constant no call site can import. */
	assert.match(
		src,
		/const rowMenuContentClassName = 'w-max min-w-52 max-w-\[min\(28rem,90vw\)\]'/,
		'the row-menu content recipe is not the published one; it must be exactly `w-max min-w-52 max-w-[min(28rem,90vw)]`',
	);
	assert.match(
		src,
		/const rowMenuItemClassName = 'gap-2 whitespace-nowrap'/,
		'the row-menu item recipe is not the published one; it must be exactly `gap-2 whitespace-nowrap`',
	);
	for (const name of ['rowMenuContentClassName', 'rowMenuItemClassName'] as const) {
		const exported = new RegExp(`export \\{([\\s\\S]*?)\\};`).exec(src)?.[1] ?? '';
		assert.ok(
			exported.split(',').map((s) => s.trim()).includes(name),
			`${name} is declared but not exported, so no call site can import it`,
		);
	}

	/* The opt-in boundary, asserted on the SOURCE for every consumer. A recipe
	   applied to the primitive would reach `ScheduleReviewWorkspaceHeader`,
	   `WorkspaceToolbar` and `TimetableSimpleHeader`, whose items are sentences
	   meant to wrap; it would push them off the viewport instead of fixing a
	   roster row. `subjects-ux-a3` A3-19b proves the same boundary in the DOM. */
	for (const component of ['DropdownMenuContent', 'DropdownMenuItem'] as const) {
		const start = src.indexOf(`const ${component} = React.forwardRef<`);
		assert.ok(start >= 0, `the shared primitive ${component} moved; re-read this row`);
		const body = src.slice(start, src.indexOf(`${component}.displayName`, start));
		assert.doesNotMatch(body, /rowMenu(Content|Item)ClassName/, `${component} consumes the recipe, so it stopped being opt-in`);
		assert.doesNotMatch(body, /whitespace-nowrap/, `whitespace-nowrap leaked into the shared ${component} base`);
	}
	/* The primitive's own floor and padding are unchanged, so the menus that
	   deliberately share it render exactly as they did before this change. */
	assert.match(src, /min-w-\[8rem\]/, 'the shared primitive min-width was changed');
	assert.match(src, /px-2 py-1\.5 text-sm font-medium/, 'the shared item padding or type size was changed');
});

test('A5-C8B-RECIPE-2: the recipe fits its widest REAL label under the 28rem cap', () => {
	/* §11: *"a computed artifact is valid only for the revision and moment that
	   produced it"* — so the cap is checked against the labels this revision
	   actually renders, taken from the product's own source, not retyped here.

	   `max-w-[min(28rem,90vw)]` is 448px. The worst case is a single menu item's
	   text plus its icon at the shared `text-sm`, and the real risk is not the
	   28rem but the `90vw`: at 1366px, 90vw is 1229px, so 28rem is the binding
	   side; below ~498px viewport width, 90vw takes over and a long label could
	   exceed it. Both facts are asserted rather than assumed. */
	const WIDEST: Array<[string, string]> = [
		['components/faculty/FacultyRowActions.tsx', 'Edit temporary teacher details'],
		['components/subjects/SubjectRow.tsx', 'Archive for new schedules'],
		['components/subjects/SubjectMobileCard.tsx', 'Make schedulable again'],
		['components/sections/SectionRow.tsx', 'Open teaching load'],
		['components/faculty-assignments/TeacherGridMode.tsx', 'Reset assignments'],
	];
	for (const [file, label] of WIDEST) {
		assert.ok(
			source(file).includes(label),
			`${file} no longer renders the widest label this row measured (${label}); re-measure the cap against the real roster`,
		);
		/* 448px at the shared `text-sm` (14px) holds roughly 60 average-width
		   characters. Every real label here is far inside that; the assertion is
		   on the character count so a future label cannot grow past the cap
		   without this row failing. A label that DID exceed it would have to be
		   shortened, not the cap raised — the cap is what keeps the menu off the
		   right edge of the window. */
		assert.ok(
			label.length <= 55,
			`"${label}" is ${label.length} characters, which no longer fits the 28rem cap at text-sm; shorten the label rather than exceeding the recipe`,
		);
	}
	assert.ok(
		rowMenuContentClassName.includes('max-w-[min(28rem,90vw)]'),
		'the recipe lost its viewport cap, so a long label can spill off the right edge of the window',
	);
	assert.ok(rowMenuItemClassName.includes('whitespace-nowrap'), 'the recipe lost the nowrap that stops the two-line wrap');
});

// ===========================================================================
// 2. THE REAL SURFACE — the Teachers roster row menu, opened by its own test-id.
// ===========================================================================

test('A5-C8B-ROW-1: the Teachers row menu carries the recipe and its items carry nowrap', async () => {
	const host = await render(<RosterHarness faculty={TEMPORARY_TEACHER} />);

	const trigger = byTestId('teacher-row-more-actions');
	assert.ok(trigger, 'the Teachers roster row menu trigger did not render');

	/* The BASE-STATE check, which is the defect in one assertion: on the base
	   commit this rendered at a fixed `w-52` (208px) with items carrying only
	   `gap-2 font-semibold`, and 'Edit temporary teacher details' wrapped inside
	   it. The item here is the product's OWN label, reached through the product's
	   OWN `useFacultyRowActions`, not a retyped fixture. */
	await openMenu(trigger);

	const menu = document.querySelector('[role="menu"]') as HTMLElement | null;
	assert.ok(menu, 'the row menu did not open');

	/* Content: the recipe, and specifically NOT a fixed width. */
	for (const token of rowMenuContentClassName.split(/\s+/)) {
		assert.ok(
			menu.className.split(/\s+/).includes(token),
			`the row menu does not carry \`${token}\`: ${menu.className}`,
		);
	}
	assert.doesNotMatch(
		menu.className,
		/(^|\s)w-(52|48|44|56)(\s|$)/,
		`a fixed width is back on the row menu, so a long action wraps again: ${menu.className}`,
	);
	assert.match(menu.className, /\bw-max\b/, 'the menu is not sized to its longest item');
	assert.match(menu.className, /max-w-\[min\(28rem,90vw\)\]/, 'the menu has no viewport cap');

	/* Items: the recipe on EVERY item, both the normal and the destructive map —
	   a fix applied to only one of the two maps is the half-fix this file exists to
	   prevent, and the destructive item is the widest on some rosters. */
	const items = Array.from(menu.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
	assert.ok(items.length >= 2, `the row menu rendered ${items.length} items; the temporary-teacher branch should render both`);
	const labels = items.map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim());
	assert.ok(
		labels.includes('Edit temporary teacher details'),
		`the label that wrapped on the base commit is missing from the menu: ${JSON.stringify(labels)}`,
	);
	for (const item of items) {
		const text = (item.textContent ?? '').replace(/\s+/g, ' ').trim();
		assert.match(item.className, /whitespace-nowrap/, `menu item "${text}" can still wrap onto two lines`);
		assert.match(item.className, /gap-2/, `menu item "${text}" has no icon-to-label gap, so this menu is not the one look`);
	}

	/* The destructive item keeps its own semantics, and the normal item keeps its
	   weight. The recipe is ADDITIVE at the call site, never a replacement for the
	   colours and weights a destructive row action is supposed to carry. */
	const destructive = items.find((i) => (i.textContent ?? '').includes('Delete temporary teacher'));
	assert.ok(destructive, 'the destructive row action is missing from the menu');
	assert.match(destructive.className, /text-destructive/, 'the destructive row action lost its destructive colour');

	/* `align="end"` and the existing side offset are preserved, because the whole
	   point is a menu that opens beside the row and collides inward rather than
	   off-screen. */
	assert.equal(menu.getAttribute('data-align'), 'end', 'the row menu no longer aligns to its trigger');

	await unmount(host);
});

test('A5-C8B-ROW-2: every roster row menu is ON the recipe — five rosters, one answer', () => {
	/* The packet's actual finding: the same one-line-wrap defect fixed with five
	   different widths. If a page is added to this list it must be on the recipe,
	   and if a call site drifts off the recipe this row fails — which is the only
	   thing that stops the drift coming back.

	   Each entry is (file, the line's own marker), so the row reports WHICH roster
	   drifted rather than just that one did. */
	const ROW_MENUS = [
		'components/admin-workspace/AdminDataTable.tsx',
		'components/sections/SectionRow.tsx',
		'components/subjects/SubjectRow.tsx',
		'components/subjects/SubjectMobileCard.tsx',
		'components/faculty-assignments/TeacherGridMode.tsx',
	] as const;
	for (const file of ROW_MENUS) {
		const src = code(file);
		assert.ok(
			src.includes('rowMenuContentClassName'),
			`${file} is a roster row menu and does not use the shared recipe; a sixth hand-picked width is how the five that exist got there`,
		);
		assert.ok(
			src.includes('rowMenuItemClassName'),
			`${file} uses the shared content recipe but not the shared item recipe, so its items can still wrap`,
		);
		assert.doesNotMatch(
			src,
			/<DropdownMenuContent[^>]*className="[^"]*\bw-\d{2}\b/,
			`${file} still sizes its row menu with a hand-picked fixed width`,
		);
	}

	/* And the converse, so the recipe cannot quietly become the primitive's
	   default: no menu OUTSIDE the five rosters may have taken it. A picker or
	   toolbar menu that adopts `whitespace-nowrap` stops wrapping its sentences
	   and pushes them off the viewport.

	   `ui/dropdown-menu.tsx` is excluded because it is where the recipe is
	   DECLARED — scanning it would make the row fail on the definition of the
	   thing it is checking for. What matters there is the opt-in boundary, and
	   RECIPE-1 asserts it directly: neither primitive component may reference the
	   recipe. */
	const DEFINITION_SITE = 'ui/dropdown-menu.tsx';
	const others = productionFiles().filter((f) => {
		const rel = relative(srcRoot, f).replace(/\\/g, '/');
		return !ROW_MENUS.includes(rel as never) && rel !== DEFINITION_SITE;
	});
	const leaked: string[] = [];
	for (const file of others) {
		if (/rowMenu(Content|Item)ClassName/.test(code(relative(srcRoot, file)))) {
			leaked.push(relative(srcRoot, file));
		}
	}
	assert.deepEqual(
		leaked,
		[],
		'a menu outside the five roster row menus adopted the row recipe; sentence-length menus (toolbars, pickers, the app sidebar, the timetable) must keep wrapping',
	);
});
