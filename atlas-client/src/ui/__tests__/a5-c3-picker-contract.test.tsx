/**
 * A5 C3 (2026-09-29) — the contract of the shared filter picker itself.
 *
 * THIS FILE IS DELIBERATELY ITS OWN FILE, and that is a finding worth keeping.
 * `a5-c3-subjects-calm-surface.test.tsx` opens no popover; this one does. Radix `Popover` is
 * modal, so while one is open `aria-hidden` is applied to every sibling in `document.body` —
 * including the container the NEXT test renders into. In a shared file that silently emptied
 * the following rows' DOM and turned four real assertions into "the element is gone" failures
 * that had nothing to do with the code under test. A contract test that opens a picker and a
 * render test that asserts on row text do not belong in one process.
 *
 * WHAT IS DECIDED HERE
 *
 *  1. **R2-5 — the search box is a property of the list's LENGTH, and the rule lives in `@/ui`.**
 *     A search box in a popover listing five grades costs a scheduler a second thing to aim at
 *     and gives them nothing: the whole list is already visible. So `FilterPicker` shows the box
 *     only above `SEARCHABLE_OPTION_THRESHOLD`. Both sides of the boundary are asserted, from
 *     the exported constant, so moving the constant moves this test with it.
 *
 *  2. **The wrapper cannot be told to look different.** A `className` prop on `FilterPicker`
 *     would be an invitation to reintroduce exactly the page-local override `AGENTS.md` §8
 *     forbids — the defect this cycle exists to remove. The prop is absent, and a source row
 *     says so, because a component's API is not observable from a render.
 *
 *  3. **`SearchableSelect`'s own default is unchanged**, which is what keeps `/timetable`'s
 *     entity picker — a long list that must keep its search box — exactly as it was (R2-5).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable' });
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
const { FilterPicker } = await import('@/ui/filter-picker');
const { SearchableSelect } = await import('@/ui/searchable-select');
const { SEARCHABLE_OPTION_THRESHOLD, pickerTriggerClass } = await import('@/ui/picker-trigger');

const uiSource = (name: string) => readFileSync(resolve(import.meta.dirname, `../${name}`), 'utf8');
const options = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }));

/**
 * Render, OPEN the picker, read the OPEN list into plain data, close it, unmount.
 *
 * Closing before returning matters for the same reason this file is separate: an open modal
 * popover leaves `aria-hidden` on its siblings and, if the tree is still mounted when an
 * assertion throws, leaves the runner unable to reach an idle event loop — the child then exits
 * `-1` and the harness reports a bare `test failed` with no message at all.
 */
async function openAndRead(count: number): Promise<{ expanded: string | null; optionsRendered: number; searchInputs: number; visibleLabel: string }> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	await act(async () => { root.render(<FilterPicker name="Grade" value="v0" onValueChange={() => {}} options={options(count)} />); });
	let read: { expanded: string | null; optionsRendered: number; searchInputs: number; visibleLabel: string };
	try {
		const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
		await act(async () => { trigger.click(); });
		read = {
			expanded: trigger.getAttribute('aria-expanded'),
			optionsRendered: document.body.querySelectorAll('[role="option"]').length,
			searchInputs: document.body.querySelectorAll('input[placeholder="Search…"]').length,
			visibleLabel: (trigger.textContent ?? '').replace(/\s+/g, ' ').trim(),
		};		await act(async () => {
			document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		});
	} finally {
		await act(async () => { root.unmount(); });
		host.remove();
	}
	return read;
}

test('A5-C3-R2-5a: an OPEN list at the threshold shows no search box, and one item over it does', async () => {
	/* Asserted from the exported constant, so moving the constant moves this test with it
	 * rather than letting it pass vacuously. */
	assert.equal(SEARCHABLE_OPTION_THRESHOLD, 8, 'the threshold constant moved; re-read R2-5');

	const at = await openAndRead(SEARCHABLE_OPTION_THRESHOLD);
	assert.equal(at.expanded, 'true', 'the picker did not open, so the boundary row would be vacuous');
	assert.equal(at.optionsRendered, SEARCHABLE_OPTION_THRESHOLD, 'not every option rendered');
	assert.equal(at.searchInputs, 0, `a ${SEARCHABLE_OPTION_THRESHOLD}-option list must not earn a search box — aiming at a search field before ${SEARCHABLE_OPTION_THRESHOLD} visible options is one more thing to miss`);
	/* The filter still names itself with the box or without it (R3 §1: `Grade: Option 0`). */
	assert.equal(at.visibleLabel, 'Grade: Option 0');

	const over = await openAndRead(SEARCHABLE_OPTION_THRESHOLD + 1);
	assert.equal(over.expanded, 'true', 'the picker did not open');
	assert.equal(over.optionsRendered, SEARCHABLE_OPTION_THRESHOLD + 1, 'not every option rendered');
	assert.equal(over.searchInputs, 1, `a ${SEARCHABLE_OPTION_THRESHOLD + 1}-option list must earn its search box`);
});

test('A5-C3-R2-5b: SearchableSelect keeps its search box by default, so /timetable\'s entity picker is unchanged', () => {
	/* R2-5 forbids changing this primitive's own default. The default is the whole reason a
	 * long-list picker elsewhere in the app still opens onto a search field. */
	const source = uiSource('searchable-select.tsx');
	assert.match(source, /showSearch = true/, 'SearchableSelect no longer defaults to showing its search box');
	assert.doesNotMatch(source, /SEARCHABLE_OPTION_THRESHOLD/, 'the threshold leaked into the primitive; it belongs to the wrapper');
	/* And the `/timetable` call site is untouched by this cycle. */
	const timetable = readFileSync(
		resolve(import.meta.dirname, '../../components/timetable/simple/SimpleHeaderHelpers.tsx'),
		'utf8',
	);
	assert.doesNotMatch(timetable, /showSearch|FilterPicker/, '/timetable\'s entity picker was changed; R1 J1 and R2-5 forbid it');
});

test('A5-C3-PICKERa: FilterPicker has no className prop, so a page cannot restate the trigger chrome', () => {
	/* A source-level row on purpose: the claim is about the component CONTRACT, which no
	 * render can observe. A page that could pass a className could reintroduce the exact
	 * page-local override §8 forbids. */
	const source = uiSource('filter-picker.tsx');
	assert.doesNotMatch(source, /\bclassName\?:\s*string/, 'FilterPicker exposes a className prop');
	assert.doesNotMatch(source, /triggerClassName=\{(?!pickerTriggerClass)/, 'a trigger class is passed as something other than the shared builder');
});

test('A5-C3-PICKERb: the shared variant is one composed string from @/ui, and every width is a named variant', () => {
	const source = uiSource('picker-trigger.ts');
	// RE-PINNED BY A7 C8 SLICE 1 (2026-09-29). The shared height token moved `h-9` ->
	// `h-10` (36px -> 40px), the floor for a control that acts, for older mouse-first
	// schedulers. The CLAIM is unchanged and in fact stronger: there is still exactly
	// ONE height literal, it still lives in `@/ui/picker-trigger.ts`, and a page still
	// cannot restate it. Only the number it names moved. Re-pinned, not deleted (§16).
	for (const token of ['h-10', 'shrink-0 px-3 text-xs', 'font-normal normal-case tracking-normal']) {
		assert.ok(source.includes(`'${token}'`), `the shared variant no longer states ${token}`);
	}
	// A7 C8: the height must not drift back DOWN, which is the direction that hurts.
	assert.equal(
		source.includes(`'h-9'`),
		false,
		'the shared picker height token is back to h-9 (36px). A7 C8 raised it to h-10 ' +
			'(40px) as the floor for a control that acts; shrinking it again puts the ' +
			'control below the target size the operator asked to be locked in.',
	);
	/* `normal-case tracking-normal` is what makes the `uppercase tracking-tight` override
	 * structurally impossible to reintroduce (R1 B4). */
	assert.match(pickerTriggerClass('md'), /normal-case/, 'the shared trigger class lost its case normalisation');
	/* Widths are variants, not per-page strings. */
	for (const width of ['sm', 'md', 'fill']) {
		assert.ok(source.includes(`${width}:`), `the '${width}' width variant is gone`);
	}
	assert.equal(pickerTriggerClass('sm'), pickerTriggerClass('sm'), 'the builder is not deterministic');
	assert.notEqual(pickerTriggerClass('sm'), pickerTriggerClass('fill'), 'width variants collapse to one');
});

/**
 * B5, FAILING-FIRST (correction round 1). `min-w-*` and `w-*` are different
 * tailwind-merge groups, so a `min-w-[160px]` declared in the shared primitive
 * coexisted with the caller's `w-32` — and CSS `min-width` beats `width`. Every
 * trigger rendered at 160px whatever variant the page asked for: the width
 * variants were inert, the Subjects suites were asserting a class the browser
 * ignored, and the cluster's real content width was 160px per trigger rather
 * than the 128px the ledger claimed.
 *
 * A class-list assertion cannot see this, which is the whole lesson. The old
 * `A5-C3-A1b` row checked that all five triggers carry the SAME width class and
 * was green while every one of them rendered wider than that class. These rows
 * assert the property that actually decides the rendered box: that no hard
 * `min-w-[…]` floor survives anywhere on the trigger, and that the neutral floor
 * is the one the shared variant declares.
 */
test('A5-C3-B5a: no min-width floor survives on a filter trigger, so the width variant actually governs', async () => {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	await act(async () => {
		root.render(
			<FilterPicker name="Grade" value="all" onValueChange={() => {}} options={[{ value: 'all', label: 'All grades' }]} />,
		);
	});
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
	const classes = trigger.className;
	await act(async () => { root.unmount(); });
	host.remove();

	/* The defect, stated as the thing that must never come back. */
	assert.doesNotMatch(
		classes,
		/min-w-\[[^\]]*\]/,
		`a min-width floor is on the trigger again and will override the width variant: ${classes}`,
	);
	/* The neutral floor the shared variant declares, and the width it governs with. */
	assert.match(classes, /(^|\s)min-w-0(\s|$)/, 'the shared variant no longer states its neutral min-width floor');
	assert.match(classes, /(^|\s)w-32(\s|$)/, 'the md width variant is not on the trigger');
	/* And the primitive itself no longer composes a hard-coded floor. Scoped to the
	 * `cn(...)` call rather than the whole file, because this comment block has to be
	 * able to NAME the class it removed — a whole-file scan would forbid the fix from
	 * being documented, which is how evidence quietly disappears. */
	assert.doesNotMatch(
		uiSource('searchable-select.tsx'),
		/cn\([^)]*min-w-\[/,
		'SearchableSelect re-declared its own min-width floor, which silently overrode every width variant',
	);
});

test('A5-C3-B5b: two different width variants produce two different classes, and neither carries a hard floor', () => {
	assert.match(pickerTriggerClass('sm'), /(^|\s)w-28(\s|$)/, 'the sm variant lost its width');
	assert.match(pickerTriggerClass('md'), /(^|\s)w-32(\s|$)/, 'the md variant lost its width');
	assert.match(pickerTriggerClass('fill'), /(^|\s)w-full(\s|$)/, 'the fill variant lost its width');
	for (const width of ['sm', 'md', 'fill'] as const) {
		assert.doesNotMatch(
			pickerTriggerClass(width),
			/min-w-\[[^\]]*\]/,
			`the ${width} variant still declares a hard floor, so its width cannot govern`,
		);
	}
	/* /timetable is the counter-example that proves the change is safe there: its call
	 * site supplies its OWN min-w, and `min-w-*` is one merge group, so its floor has
	 * always won and removing the primitive's floor changes nothing it governed. */
	const timetable = readFileSync(
		resolve(import.meta.dirname, '../../components/timetable/simple/SimpleHeaderHelpers.tsx'),
		'utf8',
	);
	assert.match(timetable, /min-w-\[9rem\]/, '/timetable no longer declares its own min-width floor');
	assert.doesNotMatch(timetable, /triggerClassName="[^"]*w-\d/, '/timetable no longer supplies its own width; it is the reference, not a consumer of the variants');
});

/**
 * B3, FAILING-FIRST (correction round 1). The planner's loopback render of `/subjects`
 * produced an error boundary reading "Cannot read properties of undefined (reading
 * 'length')" — the exact text of `options.length` in the wrapper. Every current call
 * site passes an array, so this row does not prove that was the cause; it proves the
 * component must not be able to throw a PAGE away when a list is missing during a
 * partial load. A thrown render becomes "Reload page" for a scheduler, which is a far
 * worse outcome than an empty filter.
 */
test('A5-C3-B3a: a filter handed no options degrades to an empty control instead of throwing', async () => {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	let threw: unknown = null;
	await act(async () => {
		try {
			root.render(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				<FilterPicker {...({ name: 'Grade', value: 'all', onValueChange: () => {} } as any)} />,
			);
		} catch (error) {
			threw = error;
		}
	});
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement | null;
	await act(async () => { root.unmount(); });
	host.remove();
	assert.equal(threw, null, `FilterPicker threw on a missing options list: ${String(threw)}`);
	assert.ok(trigger, 'the filter vanished rather than rendering an empty control');
	assert.equal(
		(trigger.textContent ?? '').replace(/\s+/g, ' ').trim(),
		'Grade: All',
		'the empty filter does not still read as "Grade: All"',
	);
	assert.equal(trigger.getAttribute('aria-label'), 'Grade: All', 'the empty filter lost its accessible name');
});

/**
 * B1, FAILING-FIRST (slice B correction round 1). On `54eeb4f2` the primitive guarded the MOUSE
 * path only: `disabled={item.disabled}` on the option button, but Enter still called
 * `choose(option.value)` unconditionally and the arrow walk still stepped onto disabled rows.
 *
 * The regression is exactly what the file's own `disabled` comment said it was preventing —
 * Radix `SelectItem disabled` made the keyboard path unreachable, and migrating to this
 * primitive brought it back. It is live in two of the thirteen swept controls, both of which
 * earn R2-5's search box above eight options and therefore have a keyboard at all:
 * `/teaching-load`'s Department filter (a school with nine or more departments) and the
 * Teaching Load history's archived-year picker (nine or more archived years).
 */
test('A5-C3-B1a: a disabled option is neither highlighted by the arrow walk nor chosen by Enter', async () => {
	const chosen: string[] = [];
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	await act(async () => {
		root.render(
			<FilterPicker
				name="Department"
				ariaLabel="Filter by department"
				value="all"
				onValueChange={(v) => chosen.push(v)}
				/* 9 items crosses R2-5's threshold, so the list HAS a search box and
				 * therefore a keyboard path — the shape the swept pages reach. */
				searchable
				options={[
					{ value: 'all', label: 'All departments' },
					{ value: 'AP', label: 'Araling Panlipunan (4)' },
					{ value: 'empty', label: 'Science (0)', disabled: true },
					{ value: 'MAPEH', label: 'MAPEH (2)' },
				]}
			/>,
		);
	});
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
	await act(async () => { trigger.click(); });
	const input = document.body.querySelector('input[placeholder="Search…"]') as HTMLInputElement;
	assert.ok(input, 'the list must have a search box for the keyboard path to exist');

	/* (1) ArrowDown twice from the initial highlight: `all` -> AP -> the DISABLED row. The
	 * walk must skip it and land on MAPEH. */
	await act(async () => {
		input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
	});
	await act(async () => {
		input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
	});
	const highlighted = Array.from(document.body.querySelectorAll('[role="option"]')) as HTMLElement[];
	const active = highlighted.find((o) => o.getAttribute('data-active') === 'true');
	assert.equal(
		active?.textContent?.trim(),
		'MAPEH (2)',
		'the arrow walk landed the highlight on a disabled option instead of skipping it',
	);

	/* (2) Enter must not choose a disabled option even if the highlight somehow sits there. */
	await act(async () => {
		input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	});
	assert.deepEqual(chosen, ['MAPEH'], `Enter chose the wrong option: ${chosen.join(',') || 'nothing'}`);

	await act(async () => { root.unmount(); });
	host.remove();
});

test('A5-C3-B1b: a disabled option is still READABLE — a zero count is information a scheduler wants', async () => {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	await act(async () => {
		root.render(
			<FilterPicker
				name="Department"
				ariaLabel="Filter by department"
				value="all"
				onValueChange={() => {}}
				searchable
				options={[
					{ value: 'all', label: 'All departments' },
					{ value: 'empty', label: 'Science (0)', disabled: true },
				]}
			/>,
		);
	});
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
	await act(async () => { trigger.click(); });
	const option = Array.from(document.body.querySelectorAll('[role="option"]')) as HTMLElement[];
	const zero = option.find((o) => o.textContent?.trim() === 'Science (0)');
	assert.ok(zero, 'a zero-count option was hidden rather than dimmed');
	assert.equal(zero.getAttribute('aria-disabled'), 'true', 'the disabled option is not announced as disabled');
	await act(async () => { root.unmount(); });
	host.remove();
});

/**
 * B2, FAILING-FIRST (slice B correction round 1). `FilterPicker` always passed
 * `triggerLabelValue={shortValue}` and `shortValue` was the literal `'All'` for the unset state,
 * so a filter whose list has NO `all` member — `TeachingLoadHistoryView`'s archived year, with
 * `allValue=""` — showed `Archived year: All`, a state it cannot deliver, and the
 * `placeholder` that caller passed (`Choose an archived year`, `Loading archived years…`) could
 * never render. A trigger that lies about its own state is a one-status-per-fact failure, and
 * it is provable from source without a browser.
 */
test('A5-C3-B2a: a filter with no "all" member shows its PLACEHOLDER when nothing is chosen, never a hard-coded "All"', async () => {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	const withPlaceholder = (placeholder: string) => (
		<FilterPicker
			name="Archived year"
			ariaLabel="Archived school year"
			allValue=""
			value=""
			onValueChange={() => {}}
			placeholder={placeholder}
			options={[
				{ value: '4', label: '2025-2026' },
				{ value: '3', label: '2024-2025 — no annual Teaching Load', disabled: true },
			]}
		/>
	);
	await act(async () => { root.render(withPlaceholder('Choose an archived year')); });
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
	const visible = (trigger.textContent ?? '').replace(/\s+/g, ' ').trim();
	assert.equal(
		visible,
		'Archived year: Choose an archived year',
		'the unset face claims "All" on a control that offers no such choice, so the placeholder can never render',
	);
	await act(async () => { root.unmount(); });
	host.remove();
});

test('A5-C3-B2b: the unset face of a filter that DOES have an "all" member is unchanged by the B2 fix', async () => {
	/* The rule is stated once in `@/ui`; these thirteen swept controls all have an `all`
	 * option, so their visible face must be exactly what it was. If this row goes red, the
	 * fix for one picker has broken twelve. */
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	await act(async () => {
		root.render(
			<FilterPicker
				name="Grade"
				ariaLabel="Filter by grade level"
				value="all"
				onValueChange={() => {}}
				options={[
					{ value: 'all', label: 'All grades' },
					{ value: '7', label: 'GR7' },
				]}
			/>,
		);
	});
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
	assert.equal(
		(trigger.textContent ?? '').replace(/\s+/g, ' ').trim(),
		'Grade: All',
		'a swept filter with an "all" option no longer reads "Name: All"',
	);
	await act(async () => { root.unmount(); });
	host.remove();
});

test('A5-C3-B2c: a DISABLED filter\'s visible face and its accessible name say the same thing', async () => {
	/* One status per fact. The primitive's accessible name already reports `disabledReason`;
	 * before this fix the visible face still read `All` while the control was disabled and
	 * offering nothing. */
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	await act(async () => {
		root.render(
			<FilterPicker
				name="Archived year"
				ariaLabel="Archived school year"
				allValue=""
				value=""
				onValueChange={() => {}}
				placeholder="Choose an archived year"
				disabled
				disabledReason="Loading archived years…"
				options={[]}
			/>,
		);
	});
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
	const visible = (trigger.textContent ?? '').replace(/\s+/g, ' ').trim();
	const accessible = trigger.getAttribute('aria-label');
	await act(async () => { root.unmount(); });
	host.remove();
	assert.equal(accessible, 'Loading archived years…', 'the accessible name lost the disabled reason');
	assert.equal(visible, 'Archived year: Loading archived years…', 'the visible face disagrees with the accessible name while disabled');
});

test('A5-C3-PICKERc: the short trigger and the long accessible name are the same control, so a picker is never unnamed', async () => {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	/* The LANE-C C03 (B11) defect: a picker that renders an empty accessible name. A5 C3
	 * R3 §1 splits the two faces — the visible trigger is compact (`Room: All`), the
	 * accessible name is long (`Filter by room type: All room types`) — and the control
	 * exists to keep them from ever being either empty or the same by accident. */
	await act(async () => {
		root.render(
			<FilterPicker
				name="Room"
				ariaLabel="Filter by room type"
				value="all"
				onValueChange={() => {}}
				options={[{ value: 'all', label: 'All room types' }]}
			/>,
		);
	});
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
	const aria = trigger.getAttribute('aria-label');
	const visible = (trigger.textContent ?? '').replace(/\s+/g, ' ').trim();
	await act(async () => { root.unmount(); });
	host.remove();
	assert.equal(visible, 'Room: All', 'the visible trigger is not the operator\'s compact form');
	assert.equal(aria, 'Filter by room type: All room types', 'the accessible name is empty or is not the long form');
	/* A chosen option shows a SHORT value on the trigger and the FULL label to a reader. */
	assert.ok(uiSource('searchable-select.tsx').includes('triggerLabelPrefix'), 'the prefix prop is gone from the primitive');
	assert.ok(uiSource('searchable-select.tsx').includes('triggerLabelValue'), 'the short-value prop is gone from the primitive');
});
