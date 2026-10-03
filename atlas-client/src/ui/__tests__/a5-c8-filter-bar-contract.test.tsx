/**
 * A5 c8 (2026-09-29) — THE GATE ON THE ONE FILTER BAR.
 *
 * `AGENTS.md` §11: *"A test no gate runs is not evidence."* This file is wired to
 * `test:ux-filter-bar` in `atlas-client/package.json` in the SAME commit, and that
 * script is listed inside `test:a6-c8-more-filters` (the suite the previous rounds of
 * this work already ran) so a run of the existing suite cannot miss it.
 *
 * WHAT IT IS A GATE ON, and WHY EACH ROW IS A ROW AND NOT A DESCRIPTION
 *
 *  - The Codex live sweep (`docs/reviews/codex-live-ux-sweep-e75d6b8f.md`) filed four
 *    MAJORs and two MINORs that all reduce to two defects: a filter the user had to
 *    CLICK to find, and a face that was CUT OFF. Both are invisible to a unit test
 *    that only checks a component renders — so this file checks the SOURCE for the
 *    shapes that produced them, and the DOM for the reachability they destroyed.
 *  - `AGENTS.md` §11: *"a control's fixture must come from the real surface."* Every
 *    behaviour row below renders the page's OWN component with the page's OWN option
 *    list, and reads the page's OWN exported label map where one exists
 *    (`ROOM_TYPE_SHORT_LABELS`). No row re-types a fixture that already exists in the
 *    product, because that is exactly how A5 C3 round 1 shipped a control whose
 *    fixture already contained the correct text.
 *  - `AGENTS.md` §16: corrections are ADDITIVE. Nothing here weakens a claim made
 *    elsewhere; the rows that had to move when `AdminSearchFilterToolbar` was deleted
 *    were RE-POINTED in their own files, with the reason in their own comments, and
 *    they are still present and still green.
 *
 * A NOTE ON THE SOURCE-SCAN ROWS AND COMMENTS, because it decides whether they can
 * fail at all. A row that banned the literal `More filters` from every byte of
 * `atlas-client/src/` could never pass: a dozen committed suites assert the string's
 * ABSENCE (`/^More filters/.test(triggerText(b))`), and a guard that must delete the
 * evidence of its own subject is a guard that gets deleted. So the scan strips
 * COMMENTS and skips test files, and asks the question a user can actually be asked:
 * can the product RENDER those words? On the base commit the answer is yes —
 * `AdminWorkspace.tsx` printed `More filters` as live JSX text — and on this candidate
 * it is no, at any render. That is recorded per row.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
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
(dom.window.HTMLElement.prototype as unknown as { click: () => void }).click = function click(this: HTMLElement) {
	this.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
};
(dom.window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = dom.window.MouseEvent;

const { createRoot } = await import('react-dom/client');
const { FilterBar } = await import('@/ui/filter-bar');
const { FilterPicker } = await import('@/ui/filter-picker');
const { PICKER_TRIGGER_WIDTH_CLASS, pickerTriggerClass } = await import('@/ui/picker-trigger');
const { PICKER_CONTROL_HEIGHT_CLASS, PICKER_CONTROL_MIN_HEIGHT_CLASS } = await import('@/ui/picker-trigger');
const { SubjectFilterToolbar, ROOM_TYPE_SHORT_LABELS } = await import('@/components/subjects/SubjectFilterToolbar');
const { SectionsFilterToolbar } = await import('@/components/sections/SectionsFilterToolbar');
const { FacultyFilterRow } = await import('@/components/faculty/FacultyFilterRow');
const { TeachingLoadFilterBar } = await import('@/components/faculty-assignments/TeachingLoadFilterBar');

const clientSrc = resolve(import.meta.dirname, '../../..');
const srcRoot = join(clientSrc, 'src');

/** Read a file under `atlas-client/src`, failing loudly if a path moved. */
function source(relativePath: string): string {
	return readFileSync(join(srcRoot, relativePath), 'utf8');
}

/**
 * Strip COMMENTS, so a rule cannot be satisfied — or broken — by a sentence in a
 * comment. A comment that NAMES a removed class is evidence, not a defect, and
 * `a5-p3-picker-guard` already established this technique for the same reason.
 */
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

/** Render into a fresh host and remember the root, so unmount disposes of THAT root. */
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
	/* The root is looked up rather than re-created. `createRoot(host).unmount()` on a
	 * container that already has a root throws in React 19, and `render(host, …)`
	 * re-uses a root that a previous row left mounted — either way the next row would
	 * be asserting against a tree nobody disposed of. A contract file that leaks roots
	 * between rows produces failures that look like product defects. */
	if (root) {
		await act(async () => { root.unmount(); });
		roots.delete(host);
	}
	host.remove();
}

const visible = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const byTestId = (host: ParentNode, id: string) => host.querySelector(`[data-testid="${id}"]`);

// ===========================================================================
// 1. SOURCE SCANS — the four shapes that produced the sweep's findings.
// ===========================================================================

test('A5-C8-SCAN-1: no production file can RENDER a `More filters` control', () => {
	/* The base commit's live finding: `AdminSearchFilterToolbar` printed
	   `More filters` as JSX text, and `/sections`, `/subjects` and `/teachers` all
	   rendered it. Comments are stripped and tests are excluded — see the file header
	   for why a whole-tree literal ban could never pass and would have to delete the
	   suites that prove the absence. */
	const offenders: string[] = [];
	for (const file of productionFiles()) {
		const src = code(relative(srcRoot, file));
		if (/\bMore filters\b/.test(src)) offenders.push(relative(srcRoot, file));
	}
	assert.deepEqual(
		offenders,
		[],
		'a production file can still render `More filters`; a filter the user must click to find is the defect A5 c8 removes',
	);
	/* And the retired component itself is gone, so a future page cannot reach for it. */
	assert.doesNotMatch(
		code('components/admin-workspace/AdminWorkspace.tsx'),
		/AdminSearchFilterToolbar|admin-primary-filter-row|admin-inline-filter-row|admin-search-filter-toolbar/,
		'the second filter-bar implementation is still in AdminWorkspace.tsx; there must be exactly one bar in the product',
	);
	/* The help step that told a user to go looking for it is gone with it. */
	assert.doesNotMatch(
		code('components/admin-workspace/AdminWorkspace.tsx'),
		/Narrow long lists/,
		'the `Narrow long lists` help step still points a user at a control that no longer exists',
	);
});

test('A5-C8-SCAN-2: no option row in the shared combobox TRUNCATES its label', () => {
	/* `AGENTS.md` §8 forbids a cut-off sentence, and the operator reported "a bunch of
	   ellipses in dropdowns because of the contained dropdown items". The base commit
	   carried `<span className="truncate">{item.label}</span>` on every option row. */
	const src = code('ui/searchable-select.tsx');
	assert.doesNotMatch(src, /truncate/, 'an option row truncates its label again');
	assert.match(src, /whitespace-normal/, 'the option label does not wrap inside the menu');
	assert.match(src, /min-w-72/, 'the menu is not at least 18rem wide, so a wrapped label still has nowhere to go');
	assert.match(src, /max-w-\[min\(28rem,calc\(100vw-2rem\)\)\]/, 'the menu has no viewport cap');
	assert.match(src, /side="bottom"/, 'the menu no longer opens downward');
	assert.match(src, /avoidCollisions/, 'the menu can escape the viewport instead of shifting inside it');
});

test('A5-C8-SCAN-3: the Radix picker trigger no longer CLAMPS its value', () => {
	/* This is the ellipsis Lane C measured on `/teaching-load/history`:
	   `Archived year: 2029-2030`, 128px of box, 186px of scroll width, tail not
	   painted. The clamp is `[&>span]:line-clamp-1` on `SelectTrigger`, and the same
	   two rules (`whitespace-normal break-words`, a capped viewport) are asserted
	   here so the Radix path and the combobox path cannot drift apart again. */
	const src = code('ui/select.tsx');
	assert.doesNotMatch(src, /line-clamp-1/, 'SelectTrigger clamps its value again, which is an ellipsis');
	assert.match(src, /whitespace-normal break-words/, 'the Radix value does not wrap inside its own box');
	assert.match(src, /max-w-\[min\(28rem,calc\(100vw-2rem\)\)\]/, 'the Radix menu has no viewport cap');
});

test('A5-C8-SCAN-4: no filter row is a horizontal SCROLL CONTAINER', () => {
	/* `AGENTS.md` §8's no-global-scrollbar rule is load-bearing, and a filter bar
	   that scrolls sideways hides controls with no cue. The base commit's
	   `/timetable` toolbar was `overflow-x-auto … scrollbar-thin`. */
	const FILTER_BARS = [
		'ui/filter-bar.tsx',
		'components/timetable/TimetableToolbar.tsx',
		'components/subjects/SubjectFilterToolbar.tsx',
		'components/sections/SectionsFilterToolbar.tsx',
		'components/faculty/FacultyFilterRow.tsx',
		'components/faculty-assignments/TeachingLoadFilterBar.tsx',
		'components/faculty-assignments/TeachingLoadHistoryView.tsx',
		'pages/RoomSchedules.tsx',
		'pages/TeacherConcerns.tsx',
		'pages/Sections.tsx',
		'pages/Faculty.tsx',
	] as const;
	const offenders = FILTER_BARS.filter((f) => /overflow-x-auto/.test(code(f)));
	assert.deepEqual([...offenders], [], 'a filter row scrolls sideways instead of wrapping');
	/* `AdminWorkspace.tsx` is deliberately NOT in that list, and the reason is worth
	   stating rather than left as an omission: its one `overflow-x-auto` is the
	   `setup-readiness-strip`, a horizontal run of READINESS items, not a filter. A
	   whole-file ban on the class would have to delete or redesign an unrelated
	   control to go green, and a guard that has to be satisfied by changing something
	   unrelated is a guard that gets deleted. What this row actually claims is
	   therefore checked positively below: the file that USED to hold a filter bar now
	   holds no row of controls at all. */
	assert.match(
		code('components/admin-workspace/AdminWorkspace.tsx'),
		/setup-readiness-strip/,
		'the readiness strip is what the one remaining `overflow-x-auto` belongs to; if that moved, re-read this row',
	);
	/* And the shared bar is the one that defines the geometry, so the row class is
	   declared once rather than restated by a page. */
	assert.match(source('ui/filter-bar.tsx'), /flex flex-wrap items-center gap-2/, 'the shared row is not `flex flex-wrap items-center gap-2`');
});

// ===========================================================================
// 2. STRUCTURE — the bar's own contract, read off a real render.
// ===========================================================================

test('A5-C8-BAR-1: the bar is ONE wrapping row: search first, then every child, then the reset', async () => {
	const host = await render(
		<FilterBar
			search={{ value: '', onChange: () => {}, placeholder: 'Search teachers' }}
			onReset={() => {}}
		>
			<FilterPicker name="Teacher list" value="all" onValueChange={() => {}} options={[{ value: 'all', label: 'All teachers' }]} />
			<FilterPicker name="Grade level" value="all" onValueChange={() => {}} options={[{ value: 'all', label: 'All grades' }]} />
		</FilterBar>,
	);
	const bar = host.firstElementChild as HTMLElement;
	assert.match(bar.className, /flex-wrap/, 'the bar does not wrap');
	assert.match(bar.className, /items-center/, 'the bar does not centre its children');
	assert.match(bar.className, /gap-2/, 'the bar gap is not 8px');
	assert.doesNotMatch(bar.className, /justify-(between|center|end)/, 'the bar is not left-aligned');
	assert.doesNotMatch(bar.className, /overflow/, 'the bar is a scroll container');
	/* Order: search, then the two pickers, then the reset — asserted on the DOM, not
	   on the source, because "search then filters" is a reading-order claim. The first
	   child is checked as the SEARCH BOX (an input inside a wrapper), not merely as a
	   `div`, so a future edit that puts a helper element in front of the search would
	   fail here rather than pass on a tag name. */
	assert.equal(bar.children.length, 4, `the bar rendered ${bar.children.length} children, not search + 2 filters + reset`);
	assert.match(bar.children[0].className, /w-\[240px\]/, 'the first thing in the row is not the shared 240px search box');
	assert.equal(bar.children[0].querySelector('input')?.getAttribute('placeholder'), 'Search teachers');
	assert.deepEqual(
		/* No `.slice(...)` here any more, and that is the correction. D6 (2026-10-03) made two
		   filter names longer than the 12-character budget the row carried — `Teacher list` is 12 and
		   `Grade level` is 11, so `: All` was being cut off and the assertion was comparing two
		   TRUNCATED strings that happened to be equal. Truncating a label before comparing it is the
		   same defect as truncating one on screen, which is what this whole file exists to catch, so
		   the full text is compared instead. It costs nothing: the strings are literal here, and the
		   D6 suite asserts them from the copy module. */
		Array.from(bar.children).slice(1).map((child) => child.tagName.toLowerCase() + ':' + visible(child)),
		['button:Teacher list: All', 'button:Grade level: All', 'button:Reset'],
		'the bar did not render the filters, then the reset, in that order',
	);
	await unmount(host);
});

test('A5-C8-BAR-2: the search box is the shared 240px, the shared height, and the shared type pairing', async () => {
	/* A5 c7 measured 14px in a browser on this exact trap while its class-list
	   assertion was green: `@/ui` `Input` ends with `text-base … sm:text-sm`, and
	   tailwind-merge keeps a differently-VARIANT class, so a bare `text-xs` loses at
	   every viewport ≥640px. Both halves are required. */
	const host = await render(
		<FilterBar search={{ value: '', onChange: () => {}, placeholder: 'Search teachers' }} />,
	);
	const input = host.querySelector('input') as HTMLInputElement;
	const wrapper = input.parentElement as HTMLElement;
	assert.match(wrapper.className, /w-\[240px\]/, 'the search wrapper is not the shared 240px');
	assert.match(wrapper.className, /shrink-0/, 'the search box can be squeezed by a filter beside it');
	assert.ok(
		input.className.includes(PICKER_CONTROL_HEIGHT_CLASS),
		`the search box does not take its height from @/ui's token: ${input.className}`,
	);
	assert.match(input.className, /\btext-xs\b/, 'the search box lost its compact type size');
	assert.match(input.className, /sm:text-xs/, 'the search box lost the `sm:` override that actually wins at 1366');
	assert.match(input.className, /pl-9/, 'the search box lost the icon inset');
	await unmount(host);
});

test('A5-C8-BAR-3: the reset control exists only while a filter is set, and it is the LAST child', async () => {
	const withFilter = await render(
		<FilterBar
			search={{ value: '', onChange: () => {}, placeholder: 'Search' }}
			onReset={() => {}}
		>
			<FilterPicker name="Grade" value="all" onValueChange={() => {}} options={[{ value: 'all', label: 'All grades' }]} />
		</FilterBar>,
	);
	const bar = withFilter.firstElementChild as HTMLElement;
	assert.equal(visible(bar.lastElementChild), 'Reset', 'the reset is not the last thing in the row');
	assert.equal(
		Array.from(bar.querySelectorAll('button')).filter((b) => (b.textContent ?? '').includes('More')).length,
		0,
		'the bar rendered a "More" control; a second click to discover a filter is the defect this change removes',
	);
	await unmount(withFilter);

	const withoutFilter = await render(
		<FilterBar search={{ value: '', onChange: () => {}, placeholder: 'Search' }}>
			<FilterPicker name="Grade" value="all" onValueChange={() => {}} options={[{ value: 'all', label: 'All grades' }]} />
		</FilterBar>,
	);
	assert.equal(
		Array.from(withoutFilter.querySelectorAll('button')).filter((b) => visible(b) === 'Reset').length,
		0,
		'Reset is offered with no filter set',
	);
	await unmount(withoutFilter);
});

test('A5-C8-B5: the `auto` variant is BOUNDED, and the neutral floor does not beat it', () => {
	/* The bug this guards is the one B5 was written to close, seen from the other
	   side: `min-w-*` and `w-*` are different tailwind-merge groups, so if the
	   neutral `min-w-0` were composed AFTER the width variant it would silently win
	   and `auto` would have no floor at all — the same class of failure as the retired
	   `min-w-[160px]`, and equally invisible to a rendered-width assertion. */
	const auto = PICKER_TRIGGER_WIDTH_CLASS.auto;
	assert.ok(auto.includes('min-w-32'), `the auto variant has no 8rem floor: ${auto}`);
	assert.ok(auto.includes('max-w-[22rem]'), `the auto variant has no 22rem ceiling: ${auto}`);
	assert.doesNotMatch(auto, /whitespace-nowrap/, 'auto still forbids its face from wrapping, which is how a face escapes its border');
	const composed = pickerTriggerClass('auto');
	assert.ok(
		composed.lastIndexOf('min-w-32') > composed.lastIndexOf('min-w-0'),
		'min-w-0 is composed after the variant floor, so the floor is inert',
	);
	/* A face WRAPS rather than being cut, so the trigger grows instead of clipping.
	   `min-h-9` is asserted against the SAME token the search input takes, read from
	   the composed class rather than retyped, so moving the token moves this row. */
	assert.match(composed, /h-auto/, 'the trigger cannot grow for a wrapped face');
	assert.ok(
		composed.split(/\s+/).includes(`min-${PICKER_CONTROL_HEIGHT_CLASS}`),
		`the grown trigger lost its 36px floor, so the row stopped being one height: ${composed}`,
	);
	/* A fixed width still has no arbitrary floor, which is the retired B5 defect. */
	for (const width of ['sm', 'md', 'lg', 'xl', 'fill'] as const) {
		assert.doesNotMatch(
			pickerTriggerClass(width),
			/min-w-\[[^\]]*\]/,
			`the ${width} variant declares a hard floor, so its width cannot govern`,
		);
	}
});

test('A5-C8-B5b: the `auto` variant\'s MINIMUM height is the same rendered height as the shared token', () => {
	/* This row exists because of a real merge, not a hypothetical. A7 c8 moved
	   PICKER_CONTROL_HEIGHT_CLASS `h-9` -> `h-10` (36px -> 40px) on `main` while this
	   change's `auto` variant carried a hand-typed `min-h-9`. The two landed
	   together, and the result was a filter row whose triggers rendered 4px shorter
	   than every other control on the page - the "one look per control" defect
	   (AGENTS.md section 8) manufactured by two individually-correct changes.

	   Tailwind class names are literals, so the floor cannot be computed from the
	   token. What CAN be held is that the two numbers AGREE, and that is this row. */
	const heightNumber = /^h-(\d+(?:\.\d+)?)$/.exec(PICKER_CONTROL_HEIGHT_CLASS)?.[1];
	const minNumber = /^min-h-(\d+(?:\.\d+)?)$/.exec(PICKER_CONTROL_MIN_HEIGHT_CLASS)?.[1];
	assert.ok(heightNumber, `the shared height token is not a plain h-<n> class: ${PICKER_CONTROL_HEIGHT_CLASS}`);
	assert.ok(minNumber, `the min-height token is not a plain min-h-<n> class: ${PICKER_CONTROL_MIN_HEIGHT_CLASS}`);
	assert.equal(
		minNumber,
		heightNumber,
		`the content-sized trigger's floor (${PICKER_CONTROL_MIN_HEIGHT_CLASS}) and the shared height `
			+ `(${PICKER_CONTROL_HEIGHT_CLASS}) render at different heights, so a filter row mixes two `
			+ `control heights. Update BOTH tokens together.`,
	);
	/* And the composed trigger must actually carry that floor, not merely declare it. */
	const composed = pickerTriggerClass('auto');
	assert.ok(
		composed.split(/\s+/).includes(PICKER_CONTROL_MIN_HEIGHT_CLASS),
		`the grown trigger does not carry the shared minimum height: ${composed}`,
	);
});

// ===========================================================================
// 3. BEHAVIOUR — the real surface, no retyped fixtures. §11: "a control's
//    fixture must come from the real surface."
// ===========================================================================

test('A5-C8-REACH-1: /subjects — all five filters are in the DOM on first render, and the longest REAL room face is readable in full', async () => {
	/* The base commit passed `filtersOpen={false}` and `onToggleFilters={() => {}}` to
	   keep its own disclosure from rendering, so the concealment was a lie told to a
	   shared component. Here the row has no disclosure to lie to. */
	const host = await render(
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
			termOptions={[
				{ value: 'all', label: 'All terms', kind: 'all' },
				{ value: 'term-1', label: 'Term 1', kind: 'term' },
			]}
			onResetFilters={() => {}}
		/>,
	);
	const bar = byTestId(host, 'subjects-filter-cluster');
	assert.ok(bar, 'the shared bar did not keep the `subjects-filter-cluster` hook');
	const triggers = Array.from(bar.querySelectorAll('[role="combobox"]')) as HTMLElement[];
	assert.deepEqual(
		triggers.map(visible),
		['Grade: All', 'Program: All', 'Status: All', 'Room: All', 'Term: All'],
		'the five subject filters are not all present, in the operator\'s order, with no disclosure',
	);
	/* The preservation hooks, all of which committed suites address by name. */
	for (const id of ['subjects-status-filter', 'subjects-room-type-filter', 'subjects-program-filter']) {
		assert.ok(byTestId(host, id), `the \`${id}\` hook is gone`);
	}
	assert.equal(byTestId(host, 'subjects-reset-filters'), null, 'Reset is offered with no filter set');

	/* The FIXTURE IS THE PAGE'S OWN MAP, not a retyped list. `ROOM_TYPE_SHORT_LABELS`
	   is exported from the toolbar for exactly this reason — A5 C3 round 1 was caught
	   inventing a fixture that already contained the right text, and the export is the
	   fix. The longest real face is what the `auto` variant has to hold. */
	const longestRoom = Object.entries(ROOM_TYPE_SHORT_LABELS)
		.map(([value, label]) => `Room: ${label}`)
		.sort((a, b) => b.length - a.length)[0];
	const longestStatus = 'Status: Room-constrained';
	assert.ok(longestRoom.length > 0, 'the page\'s own room short-label map is empty, so this row would be vacuous');
	for (const face of [longestRoom, longestStatus]) {
		assert.ok(
			face.length > 12,
			`fixture row: "${face}" is ${face.length} characters, under md's published 12-char budget, so it would not prove the auto variant is needed`,
		);
	}
	await unmount(host);
});

test('A5-C8-REACH-2: /sections — Grade, Program and Home room are present with no click, and the legend reached the Program picker', async () => {
	const host = await render(
		<SectionsFilterToolbar
			gradeFilter="all"
			onGradeFilterChange={() => {}}
			availableGrades={['7', '8', '9']}
			programFilter="all"
			onProgramFilterChange={() => {}}
			availablePrograms={['STEM', 'TVL']}
			homeRoomFilter="all"
			onHomeRoomFilterChange={() => {}}
		/>,
	);
	const triggers = Array.from(host.querySelectorAll('[role="combobox"]')) as HTMLElement[];
	assert.deepEqual(
		triggers.map(visible),
		['Grade: All', 'Program: All', 'Home room: All'],
		'the three section filters are not all present with no disclosure',
	);
	/* `Program: All` is 12 characters and `Home room: All` is 15 — the second is
	   already over md's published 12-character budget, which is why all three take
	   `auto` rather than a fixed rectangle. Asserted from the page's own faces. */
	assert.ok('Home room: All'.length > 12, 'fixture row: `Home room: All` no longer exceeds the md budget, so the auto choice is untested');
	/* The legend is gone as a LINE and reachable on the control it explains, with its
	   `data-testid` following it, so the committed rows that read it still read it. */
	assert.equal(host.querySelector('p'), null, 'the program-code legend is still a line under the bar');
	const hint = byTestId(host, 'program-code-legend');
	assert.ok(hint, 'the `program-code-legend` hook did not follow the sentence onto the Program picker');
	assert.equal(host.querySelector('details'), null, 'the legend came back as a raw <details>, which §8 forbids');
	assert.equal(host.querySelector('[title]'), null, 'the legend came back as a title attribute, which §8 forbids');
	await unmount(host);
});

/*
 * D6 (2026-10-03, `forReview/miss-jo-1.docx`) — this row's CLAIM CHANGED, not just its wording.
 *
 * It used to pin four filters including a standalone `Load`, and to pin that the row carried no
 * reset of its own because the BAR supplied one. Both facts are now false, and this row is
 * re-pointed rather than deleted (`AGENTS.md` §16: corrections are additive, never subtractive):
 *
 *  - `Roster` -> `Teacher list`, and the `Load` filter is GONE because the load state became a colour
 *    on each row (`teacherLoadColour.ts`). The claim that survives is the one this file exists to
 *    protect: every filter is present with no click, and none of them is behind a disclosure.
 *  - The reset row now asserts the OPPOSITE of what it asserted — there is no reset control on this
 *    bar AT ALL, because the search box replaced it. `FacultyFilterRow` still renders none of its
 *    own, so that half is unchanged and is kept.
 *
 * The removed filter's behaviour is asserted where it now lives, in
 * `components/faculty/__tests__/d6-teacher-list-filters.test.tsx`.
 */
test('A5-C8-REACH-3: /teachers — the roster filters are present with no click, and there is NO reset control', async () => {
	const host = await render(
		<FacultyFilterRow
			teacherListFilter="all"
			onTeacherListFilterChange={() => {}}
			departments={['MATH', 'FIL']}
			departmentFilter="all"
			onDepartmentFilterChange={() => {}}
			gradeLevelFilter="all"
			onGradeLevelFilterChange={() => {}}
		/>,
	);
	const triggers = Array.from(host.querySelectorAll('[role="combobox"]')) as HTMLElement[];
	assert.deepEqual(
		triggers.map(visible),
		['Teacher list: All', 'Department: All', 'Grade level: All'],
		'the roster filters are not all present; on the base commit they sat behind a disclosure',
	);
	/* The removed `Load` filter, asserted as the ABSENCE OF A CONTROL — a renamed one would leave a
	   fourth trigger here and put this row back to four. */
	assert.equal(
		triggers.some((t) => /(^|: )Load\b/.test(visible(t))),
		false,
		'the standalone Load filter is back on the Teachers bar; D6 replaced it with the row colour',
	);
	assert.ok(byTestId(host, 'teachers-grade-filter'), 'the `teachers-grade-filter` hook is gone');
	/* D6: the search box replaced the reset affordance, so this row carries NO reset control — not
	   one of its own beside the bar's, and not the bar's either. This assertion is therefore
	   STRONGER than the one it replaces, which only banned a second reset on the row. */
	assert.equal(
		Array.from(host.querySelectorAll('button')).filter((b) => (b.textContent ?? '').includes('Reset')).length,
		0,
		'a Reset control is back on the Teachers filter row; the member put the search box there instead',
	);
	await unmount(host);
});

test('A5-C8-REACH-4: /teaching-load — the row is ONE wrapping bar, both switches keep their ids, and the chip row is gone', async () => {
	/* The base commit had five controls plus two switches on one row AND a second
	   row of `text-[11px] uppercase` `Badge` chips whose every chip restated the
	   trigger three inches to its left. §8 forbids "two chips that say the same
	   thing" and §11's design gate rule 3 is subtraction first. */
	const host = await render(
		<TeachingLoadFilterBar
			searchQuery="Dela Cruz"
			onSearchQueryChange={() => {}}
			filterStatus="teaching-assigned"
			onFilterStatusChange={() => {}}
			statusFacetCounts={{ 'teaching-assigned': 4, 'no-teaching': 1, 'adviser-only': 0, 'below-standard': 0, 'at-standard': 0, excess: 0, unmapped: 0 }}
			loadFilter="all"
			loadFacetCounts={{ 'below-standard': 1, 'at-standard': 2, excess: 1 }}
			onLoadFilterChange={() => {}}
			departmentFilter="MATH"
			onDepartmentFilterChange={() => {}}
			departmentOptions={[{ value: 'MATH', label: 'Mathematics', count: 4 }, { value: 'FIL', label: 'Filipino', count: 2 }]}
			filterAnnouncement="Filters cleared."
			onClearTeachingLoadFilters={() => {}}
			sortOrder="load-asc"
			onSortOrderChange={() => {}}
			showFilters={false}
			onToggleFilters={() => {}}
			showOutsideDept
			onToggleOutsideDept={() => {}}
			showUnmappedSpecialization={false}
			onShowUnmappedSpecializationChange={() => {}}
			policyReady
		/>,
	);
	const bar = byTestId(host, 'teaching-load-primary-filters');
	assert.ok(bar, 'the shared bar did not keep the `teaching-load-primary-filters` hook');
	const triggers = Array.from(bar.querySelectorAll('[role="combobox"]')) as HTMLElement[];
	assert.deepEqual(
		triggers.map(visible),
		['Status: Teaching', 'Department: Mathematics', 'Load: All', 'Sort: Load, low'],
		'the four Teaching Load pickers are not in the operator\'s order with no disclosure',
	);
	/* Preservation: the two switch ids, their wrapper, and the announcement. */
	for (const id of [] as string[]) { // Operator hotfix 29 Sep: inclusion switches removed from Teaching Load
		assert.ok(host.querySelector(`#${id}`), `the \`${id}\` switch is gone`);
	}
	assert.equal(byTestId(host, 'teaching-load-inclusion-switches'), null, 'operator hotfix 29 Sep: the inclusion switches must stay removed');
	assert.ok(byTestId(host, 'teaching-load-filter-announcement'), 'the sr-only filter announcement is gone');
	/* Subtraction: the chip row, its heading and its second `Clear all` are gone, and
	   the ONE reset the bar renders says the page's own words. */
	assert.equal(byTestId(host, 'teaching-load-active-filters'), null, 'the active-filter Badge row is still rendering');
	assert.equal(
		Array.from(host.querySelectorAll('button')).filter((b) => visible(b) === 'Clear all').length,
		1,
		'there is not exactly ONE `Clear all` control on this row',
	);
	assert.doesNotMatch(code('components/faculty-assignments/TeachingLoadFilterBar.tsx'), /text-\[11px\]/, 'a text-[11px] row survived in the Teaching Load bar');
	await unmount(host);
});

test('A5-C8-REACH-5: no page builds a second filter bar — every one of them renders @/ui/filter-bar', () => {
	/* The packet's closing line: "No page may end up with two filter-bar
	   implementations." This is the row that holds it.

	   TWO LISTS, because the pages split honestly. Six surfaces OWN the bar and
	   render it. Two (`SectionsFilterToolbar`, `FacultyFilterRow`) are PICKER SETS —
	   a fragment of sibling `FilterPicker`s that the page drops into its own bar, which
	   is what the packet's §3 rows for `/sections` and `/teachers` describe. Neither
	   may build a row, and the page beside each one must.
	*/
	const BAR_OWNERS = [
		'components/subjects/SubjectFilterToolbar.tsx',
		'components/faculty-assignments/TeachingLoadFilterBar.tsx',
		'components/faculty-assignments/TeachingLoadHistoryView.tsx',
		'components/timetable/TimetableToolbar.tsx',
		'pages/RoomSchedules.tsx',
		'pages/TeacherConcerns.tsx',
		'pages/Sections.tsx',
		'pages/Faculty.tsx',
	] as const;
	for (const file of BAR_OWNERS) {
		assert.ok(
			code(file).includes('@/ui/filter-bar'),
			`${file} does not render @/ui/filter-bar; a second bar implementation is how the four-page drift started`,
		);
		assert.match(code(file), /<FilterBar/, `${file} imports the shared bar but does not render it`);
	}
	/* The two picker sets: no row of their own, and the page beside each one owns
	   the bar. Before this change both were handed a `grid sm:grid-cols-3` / a
	   fragment that the deleted toolbar then collapsed behind a disclosure. */
	for (const file of ['components/sections/SectionsFilterToolbar.tsx', 'components/faculty/FacultyFilterRow.tsx'] as const) {
		assert.doesNotMatch(
			code(file),
			/<FilterBar|grid-cols-3|overflow-x-auto|More filters/,
			`${file} builds a filter row of its own instead of being a set of pickers inside the one shared bar`,
		);
	}
});

// ===========================================================================
// 4. PRESERVATION — the hooks committed suites address by name. Packet §5.
// ===========================================================================

test('A5-C8-KEEP-1: the reserved data-testids and ids are still declared where the committed suites read them', () => {
	/* A source row, because a `data-testid` on a control behind a conditional is not
	   observable in a JSDOM render that would need every page's data fixture. The rows
	   that DO render read the same names; this one makes the rename impossible to do
	   silently. */
	const REQUIRED: Array<[string, string[]]> = [
		['components/faculty/FacultyFilterRow.tsx', ['teachers-grade-filter']],
		['components/subjects/SubjectFilterToolbar.tsx', ['subjects-status-filter', 'subjects-room-type-filter', 'subjects-program-filter', 'subjects-reset-filters']],
		['components/faculty-assignments/TeachingLoadFilterBar.tsx', ['teaching-load-primary-filters', 'teaching-load-filter-announcement']],
		['components/timetable/TimetableToolbar.tsx', ['timetable-term-filter', 'timetable-filters-trigger']],
		['components/faculty-assignments/TeachingLoadHistoryView.tsx', ['teaching-load-history-year-picker', 'teaching-load-history-search']],
		['components/sections/SectionsFilterToolbar.tsx', ['program-code-legend']],
	];
	for (const [file, ids] of REQUIRED) {
		for (const id of ids) {
			assert.ok(source(file).includes(id), `${file} no longer declares \`${id}\`, which a committed suite addresses by name`);
		}
	}
	/* The two hooks the packet named for RE-POINTING, checked at their new homes: the
	   timetable's `timetable-filters-trigger` named a disclosure button that is gone,
	   so it now names the bar's container, and the guided walk's
	   `data-tutorial="grid-controls"` still has to land on the schedule controls. */
	const toolbar = code('components/timetable/TimetableToolbar.tsx');
	assert.match(toolbar, /dataTestId="timetable-filters-trigger"/, 'the re-pointed `timetable-filters-trigger` hook is not on the bar');
	assert.match(toolbar, /dataTestId="timetable-term-filter"/, 'the term picker lost its own hook');
	assert.match(toolbar, /dataTutorial="grid-controls"/, 'the guided walk lost its `grid-controls` target');
});
