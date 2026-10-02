/**
 * D6 (2026-10-03, `forReview/miss-jo-1.docx`) — THE TEACHER-LIST FILTER REDESIGN, as behaviour.
 *
 * WHAT THESE ROWS ASSERT, and what they deliberately do not. They read the RENDERED control set —
 * roles, `data-testid`s, option counts and which state a colour reports — because the packet's claims
 * are structural ("the `Load` filter is gone", "the renamed filter exists with these options"), not
 * about any particular string. Labels are imported from `facultyFilterCopy` rather than pasted, so a
 * wording change is a one-file edit here instead of a four-file edit across the suite. No row asserts
 * a hex value or a `bg-amber-*` class: the colour is asserted as the STATE it reports, which is the
 * thing that must be true, and the class is `@/ui`'s to change.
 *
 * THE THREE CLAIMS THIS FILE EXISTS TO KEEP TRUE:
 *   1. `Teacher List` exists, with `Permanent` and `Others`, and NOT the removed `Load` filter.
 *   2. The load state is a COLOUR on the row, derived from the real `subjectCount`.
 *   3. The bar carries no reset control — the search box replaced it.
 *
 * The jsdom bootstrap below is `a5-c8-filter-bar-contract.test.tsx`'s, copied because a test file that
 * imports another test file's globals is a test file that breaks when that one is edited. The
 * assertions themselves are this packet's.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
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
(dom.window.HTMLElement.prototype as unknown as { click: () => void }).click = function click(this: HTMLElement) {
	this.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
};
(dom.window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = dom.window.MouseEvent;

const { createRoot } = await import('react-dom/client');
const { FilterBar } = await import('@/ui/filter-bar');
const { FacultyFilterRow } = await import('@/components/faculty/FacultyFilterRow');
const { FacultyLoadStateBadge, getFacultyLoadPresentation } = await import('@/components/faculty/FacultyRow');
const {
	TEACHER_LIST_FILTER_NAME,
	TEACHER_LIST_FILTER_OPTIONS,
	TEACHER_SEARCH_PLACEHOLDER,
} = await import('@/components/faculty/facultyFilterCopy');
const {
	isOtherTeacher,
	isPermanentTeacher,
	teacherListFilterMatches,
	TEACHER_LIST_FILTER_VALUES,
} = await import('@/components/faculty/teacherListFilter');
const {
	teacherHasTeachingLoad,
	teacherLoadColour,
	TEACHER_LOAD_COLOUR_TONE,
} = await import('@/components/faculty/teacherLoadColour');

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
	if (!root) return;
	await act(async () => { root.unmount(); });
	host.remove();
}

/**
 * Open a Radix popover.
 *
 * Radix opens popovers/selects on `pointerdown`, and this jsdom window's `PointerEvent` is an alias
 * of `MouseEvent` — so a bare `click()` reaches the trigger's own handler without the open, and the
 * option list silently renders nothing. The full sequence is the platform's own ordering and is
 * `a5-docx1-placeholder-dialog.test.tsx`'s recipe, copied rather than reinvented.
 */
async function openPopover(el: Element | null): Promise<void> {
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

/** The roster row the Teachers page renders. Real shape; the badge reads none of the absent fields. */
function rosterRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 1, externalId: 1, employeeId: null, firstName: 'Ana', lastName: 'Reyes',
		department: 'MATH', specialization: null, employmentStatus: 'PERMANENT',
		isActiveForScheduling: true, isPlaceholder: false, isClassAdviser: false,
		advisedSectionId: null, advisedSectionName: null, advisoryEquivalentHours: 0,
		ancillaryMinutesPerWeek: 0, canTeachOutsideDepartment: false, maxHoursPerWeek: 40,
		departmentCode: 'MATH', departmentLabel: 'Mathematics', version: 1,
		subjectCount: 2, sectionCount: 2, assignedGradeLevels: [8],
		subjectHours: 20, sectionTeachingHours: 20, gradeTeachingHours: 20,
		advisoryHours: 0, ancillaryHours: 0, policyCreditedHours: 20, policyLoadPercentage: 50,
		actualTeachingHours: 20, teachingUtilizationPercent: null,
		teachingCapacityRemainingMinutes: null, excessTeachingMinutes: null,
		creditedWorkloadMinutes: 1200, syntheticCoverageHours: 0,
		loadSignalMode: 'STANDARD', assignments: [],
		...overrides,
	} as never;
}

// ===========================================================================
// 1. THE FILTER SET — what the bar offers, read off a real render.
// ===========================================================================

test('D6-FILTER-1: the bar offers Teacher list, Department and Grade level — and NO Load filter', async () => {
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
	const faces = triggers.map((t) => (t.textContent ?? '').replace(/\s+/g, ' ').trim());

	// THREE controls, named by the same string the page's copy module holds.
	assert.deepEqual(
		faces,
		[`${TEACHER_LIST_FILTER_NAME}: All`, 'Department: All', 'Grade level: All'],
		'the filter row is not exactly the three filters D6 specifies, in order',
	);

	// THE REMOVAL, asserted as absence of the CONTROL and not of a word: a renamed Load filter would
	// leave a trigger here and the four-filter row would come back.
	assert.equal(
		triggers.some((t) => /(^|: )Load\b/.test((t.textContent ?? '').trim())),
		false,
		'the standalone Load filter is back on the Teachers bar — D6 removed it in favour of the row colour',
	);
	assert.equal(triggers.length, 3, 'a control was added to this row; D6 is a subtraction, not an addition');
	assert.ok(
		host.querySelector('[data-testid="teachers-list-filter"]'),
		'the renamed filter lost its `teachers-list-filter` hook',
	);

	await unmount(host);
});

test('D6-FILTER-2: the renamed filter offers Permanent and Others, and no Substitute ATLAS cannot answer', async () => {
	const host = await render(
		<FacultyFilterRow
			teacherListFilter="all"
			onTeacherListFilterChange={() => {}}
			departments={['MATH']}
			departmentFilter="all"
			onDepartmentFilterChange={() => {}}
			gradeLevelFilter="all"
			onGradeLevelFilterChange={() => {}}
		/>,
	);

	/* Radix opens the list on `pointerdown`; a click-only helper renders no options and a test
	   that reads no options is a test that proves nothing. */
	await openPopover(host.querySelector('[data-testid="teachers-list-filter"]'));
	const labels = Array.from(document.querySelectorAll('[role="option"]')).map((o) => (o.textContent ?? '').trim());

	// THE THREE HONEST OPTIONS: unset, plus the two the data supports.
	assert.deepEqual(
		labels,
		TEACHER_LIST_FILTER_OPTIONS.map((o) => o.label),
		"the option list is not the copy module's list",
	);
	assert.ok(labels.includes('Permanent'), 'the member asked for Permanent and it is not offered');
	assert.ok(labels.includes('Others'), 'the member asked for Others and it is not offered');

	// `Substitute` IS NEEDS_DECISION, and this row is what keeps it from being faked: ATLAS holds no
	// field for it (see `teacherListFilter.ts`), so a control offering it could only ever answer
	// "nobody". If a field ever lands, this row fails and the option has to be built deliberately.
	assert.equal(
		labels.filter((l) => /substitute/i.test(l)).length,
		0,
		'a Substitute option was added with no backing field — see NEEDS_DECISION in teacherListFilter.ts',
	);

	await unmount(host);
});

test('D6-FILTER-3: the bar carries no reset control — the search box replaced it, and its placeholder fits', async () => {
	const host = await render(
		/* The exact bar the page builds after D6: `onReset` is deliberately NOT passed. */
		<FilterBar
			dataTestId="teachers-filter-bar"
			search={{ value: '', onChange: () => {}, placeholder: TEACHER_SEARCH_PLACEHOLDER }}
		>
			<FacultyFilterRow
				teacherListFilter="permanent"
				onTeacherListFilterChange={() => {}}
				departments={['MATH']}
				departmentFilter="all"
				onDepartmentFilterChange={() => {}}
				gradeLevelFilter="all"
				onGradeLevelFilterChange={() => {}}
			/>
		</FilterBar>,
	);

	assert.equal(
		Array.from(host.querySelectorAll('button')).filter((b) => /reset/i.test(b.textContent ?? '')).length,
		0,
		'a Reset control is on the Teachers bar; the member put the search box there instead',
	);

	const search = host.querySelector('input') as HTMLInputElement;
	assert.ok(search, 'the search box is gone from the Teachers bar');
	assert.equal(search.getAttribute('placeholder'), TEACHER_SEARCH_PLACEHOLDER);
	// The search box is the bar's shared FIXED width, so its fit is a shared fact and the placeholder
	// has to live inside it. This is the truncation the member's screenshot showed.
	assert.match(
		(search.parentElement as HTMLElement).className,
		/w-\[240px\]/,
		'the search box is no longer the shared fixed width, so its fit is no longer a shared fact',
	);
	/* 240px minus a 16px leading icon and roughly 16px of padding on each side leaves about 190px of
	   text at the bar's own type size — around 22 characters. A placeholder that merely *almost*
	   fits is what truncated, so the budget is asserted with room to spare. */
	const BUDGET_CHARS = 22;
	assert.ok(
		TEACHER_SEARCH_PLACEHOLDER.length <= BUDGET_CHARS,
		`the placeholder is ${TEACHER_SEARCH_PLACEHOLDER.length} characters; over ${BUDGET_CHARS} it will be cut off inside the fixed 240px search box`,
	);

	await unmount(host);
});

// ===========================================================================
// 2. THE LOAD COLOUR — what "has a teaching load" means, against real roster values.
// ===========================================================================

test('D6-COLOUR-1: the load colour reports the real load state — loaded vs no load — from subjectCount', () => {
	// The two roster shapes the Teachers page actually renders: a hired teacher holding subjects, and
	// one holding none. The decision is `subjectCount > 0`, the same predicate the removed `Load`
	// filter used and `teacherLoadTruth.hasLoad` uses.
	const loaded = teacherLoadColour({ subjectCount: 3 });
	const notLoaded = teacherLoadColour({ subjectCount: 0 });

	assert.equal(loaded.hasLoad, true, 'a teacher holding 3 subjects must read as loaded');
	assert.equal(loaded.tone, TEACHER_LOAD_COLOUR_TONE.withLoad, 'a loaded teacher must take the positive tone');
	assert.equal(loaded.testId, 'teacher-load-colour-with');

	assert.equal(notLoaded.hasLoad, false, 'a teacher holding no subjects must read as no load');
	assert.equal(notLoaded.tone, TEACHER_LOAD_COLOUR_TONE.withoutLoad, 'a teacher with no load must take the attention tone');
	assert.equal(notLoaded.testId, 'teacher-load-colour-without');

	// The two states must never be reported by the same testid: a row that asserts "the colour is
	// there" without saying which one is a row that passes when the mapping is inverted.
	assert.notEqual(loaded.testId, notLoaded.testId);
	assert.notEqual(loaded.tone, notLoaded.tone);

	// A missing count is no load — not a crash, and not "loaded by default".
	assert.equal(teacherHasTeachingLoad({ subjectCount: null }), false);
	assert.equal(teacherHasTeachingLoad({ subjectCount: undefined as unknown as number }), false);
});

test('D6-COLOUR-2: the colour is rendered on the row and agrees with the row\'s own load word', async () => {
	const loadedFaculty = rosterRow();
	const noLoadFaculty = rosterRow({
		subjectCount: 0, sectionCount: 0, subjectHours: 0, sectionTeachingHours: 0,
		gradeTeachingHours: 0, policyCreditedHours: 0, policyLoadPercentage: 0,
		actualTeachingHours: 0, creditedWorkloadMinutes: 0, assignedGradeLevels: [],
	});

	const hostLoaded = await render(<FacultyLoadStateBadge faculty={loadedFaculty} />);
	const loadedBadge = hostLoaded.querySelector('[data-testid="teacher-load-colour-with"]');
	assert.ok(loadedBadge, 'a teacher WITH a teaching load carries no load colour on the row');
	// The colour sits INSIDE the badge beside the word, so the two can never describe different
	// teachers — and the word is still there, because colour alone is not a signal (DESIGN.md §3).
	assert.ok(
		loadedBadge?.querySelector('[data-testid="teacher-load-colour-dot"]'),
		'the colour cue has no element carrying it',
	);
	assert.match(
		loadedBadge?.textContent ?? '',
		new RegExp(getFacultyLoadPresentation(loadedFaculty).label),
		'the load word is gone from the badge that now also carries the colour',
	);
	await unmount(hostLoaded);

	const hostNoLoad = await render(<FacultyLoadStateBadge faculty={noLoadFaculty} />);
	assert.ok(
		hostNoLoad.querySelector('[data-testid="teacher-load-colour-without"]'),
		'a teacher WITHOUT a teaching load must take the other colour state',
	);
	assert.equal(
		hostNoLoad.querySelector('[data-testid="teacher-load-colour-with"]'),
		null,
		'a teacher with no load is showing the loaded colour — the mapping is inverted',
	);
	assert.match(
		hostNoLoad.textContent ?? '',
		new RegExp(getFacultyLoadPresentation(noLoadFaculty).label),
		'the load word is gone from the no-load badge',
	);
	await unmount(hostNoLoad);
});

// ===========================================================================
// 3. THE FILTER'S MEANING — Permanent and Others against real roster flags.
// ===========================================================================

test('D6-LIST-3: Permanent is a hired schedulable teacher and Others is its exact complement', () => {
	const hired = { isActiveForScheduling: true, isPlaceholder: false };
	const toBeHired = { isActiveForScheduling: true, isPlaceholder: true };
	const excluded = { isActiveForScheduling: false, isPlaceholder: false };

	assert.equal(isPermanentTeacher(hired), true, 'a hired, schedulable teacher must be Permanent');
	assert.equal(isPermanentTeacher(toBeHired), false, 'a to-be-hired record is not a person');
	assert.equal(isPermanentTeacher(excluded), false, 'a teacher excluded from scheduling is not Permanent');

	// `Others` is the COMPLEMENT, and this is the assertion that matters: two options that can both
	// contain the same teacher (or neither) are not a pair of filters.
	for (const row of [hired, toBeHired, excluded]) {
		assert.equal(
			isOtherTeacher(row),
			!isPermanentTeacher(row),
			'Others must be exactly the complement of Permanent for every roster state',
		);
	}

	assert.equal(teacherListFilterMatches(toBeHired, 'all'), true);
	assert.equal(teacherListFilterMatches(toBeHired, 'others'), true);
	assert.equal(teacherListFilterMatches(toBeHired, 'permanent'), false);
	assert.equal(teacherListFilterMatches(hired, 'permanent'), true);
	assert.equal(teacherListFilterMatches(hired, 'others'), false);

	// Every value the type admits is exercised, so a new slice cannot be added without a row.
	assert.deepEqual(TEACHER_LIST_FILTER_VALUES, ['all', 'permanent', 'others']);
});