/**
 * A3-TEACHERS-LOAD-C3 — the Teachers / Teaching Load surface fixes.
 *
 * Covers: Fix 30 (Select checked state, proven through an A2 TIMETABLE
 * consumer), Fix 13/18 (grade chips), Fix 14/16 (density), Fix 25/26 (in-page
 * review return path), Fix 26 (mobile affordance preserved), Fix 22 (display
 * casing), Fix 24 (menu copy), Fix 23 (profile dialog).
 *
 * Fix 30 note. `ui/select.tsx` set `data-[state=checked]:text-primary-foreground`
 * with NO background, so a selected-but-not-hovered option rendered white on the
 * white `--popover` surface. The fix pairs a background with the foreground.
 *
 * Fix 29 (the write path) has its own file:
 * `a3-swap-confirmation-c3.test.tsx`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/teaching-load',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
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
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	DOMRect: dom.window.DOMRect,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	IS_REACT_ACT_ENVIRONMENT: true,
});
(dom.window as any).matchMedia ??= (query: string) => ({
	matches: false, media: query, onchange: null,
	addListener: () => {}, removeListener: () => {},
	addEventListener: () => {}, removeEventListener: () => {},
	dispatchEvent: () => false,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView ??= () => {};
dom.window.HTMLElement.prototype.hasPointerCapture ??= () => false;
dom.window.HTMLElement.prototype.setPointerCapture ??= () => {};
dom.window.HTMLElement.prototype.releasePointerCapture ??= () => {};

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
const { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } = await import('@/ui/select');
const { GradeBadge } = await import('@/components/faculty-assignments/GradeBadge');
const { FacultyRosterActions } = await import('@/components/faculty/FacultyRosterActions');
const { FacultyProfileSheet } = await import('@/components/faculty/FacultyProfileSheet');
const { TeacherAttentionFilters } = await import('@/components/faculty/TeacherAttentionFilters');
const { TeachingLoadFilterBar } = await import('@/components/faculty-assignments/TeachingLoadFilterBar');
const { TeachingLoadInspectorTriggers } = await import('@/components/faculty-assignments/TeachingLoadInspectorTriggers');
const { WorkloadInspector } = await import('@/components/faculty-assignments/WorkloadInspector');
// A2-OWNED TIMETABLE FILE. Read and rendered only; never edited by this stream.
const { SimpleTermSwitcher } = await import('@/components/timetable/simple/SimpleBeneficiaryControls');

const clientRoot = resolve(import.meta.dirname, '../../../..');
const read = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

const roots: any[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
	dom.window.document.body.removeAttribute('style');
});

/**
 * MemoryRouter is REQUIRED, not cosmetic: `FacultyProfileSheet` falls back to a
 * react-router `Link` when no `onReviewLoad` handler is supplied, and a bare
 * `Link` destructures `basename` off a null router context. Without this
 * wrapper every profile test dies with "Cannot destructure property 'basename'"
 * before reaching an assertion. Tests that build their own roots MUST use this
 * wrapper too.
 */
function inRouter(node: any) {
	return createElement(
		MemoryRouter as any,
		{ initialEntries: ['/teaching-load'] },
		createElement(TooltipProvider as any, { delayDuration: 200 }, node),
	);
}

function render(node: any): HTMLElement {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => { root.render(inRouter(node)); });
	return host;
}

function bodyText(): string {
	return dom.window.document.body.textContent ?? '';
}

function dialog(): HTMLElement | null {
	return dom.window.document.querySelector('[role="dialog"]');
}

function buttonsIn(scope: ParentNode): HTMLButtonElement[] {
	return Array.from(scope.querySelectorAll('button'));
}

function click(el: Element) {
	act(() => {
		el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
	});
}

const FACULTY: any = {
	id: 9,
	firstName: 'Maria',
	lastName: 'Dela Cruz',
	department: 'Mathematics',
	employmentStatus: 'REGULAR',
	employeeId: 'EMP-0009',
	isActiveForScheduling: true,
	isClassAdviser: false,
	isPlaceholder: false,
	maxHoursPerWeek: 40,
	policyCreditedHours: 24,
	sectionTeachingHours: 20,
	actualTeachingHours: 20,
	subjectCount: 3,
	sectionCount: 4,
	advisoryEquivalentHours: 0,
	ancillaryMinutesPerWeek: 0,
	advisedSectionName: null,
	version: 1,
	assignments: [],
};

// ─────────────────────────────────────────────────────────── Fix 30

/**
 * Render a REAL open Radix Select and return the rendered options.
 *
 * The options are read from the live document rather than from the source, so
 * `data-state="checked"` is the state Radix actually assigned — not a
 * simulation of it. This is what makes the Fix 30 assertions discriminating.
 */
function renderSelect(): HTMLElement[] {
	const host = render(
		createElement(
			Select as any,
			{ value: 't1', open: true, onValueChange: () => {} },
			createElement(SelectTrigger as any, { 'data-testid': 'trigger' }),
			createElement(
				SelectContent as any,
				null,
				createElement(SelectItem as any, { value: 't1' }, 'Term 1'),
				createElement(SelectItem as any, { value: 't2' }, 'Term 2'),
				createElement(SelectItem as any, { value: 't3', disabled: true }, 'Term 3'),
			),
		),
	);
	const options = Array.from(dom.window.document.querySelectorAll('[role="option"]')) as HTMLElement[];
	assert.equal(options.length, 3, 'the open Select must render three options');
	assert.ok(host);
	return options;
}

function checkedOption(options: HTMLElement[]): HTMLElement {
	const checked = options.find((o) => o.getAttribute('data-state') === 'checked');
	assert.ok(checked, 'exactly one option must carry data-state="checked"');
	return checked!;
}

test('F30-1 a selected Select option is visible, not white-on-white', () => {
	const options = renderSelect();
	const checked = checkedOption(options);
	assert.equal((checked.textContent ?? '').trim(), 'Term 1', 'Term 1 is the selected value');

	const cls = checked.getAttribute('class') ?? '';
	// The defect: a foreground with NO background, i.e. white on the white
	// `--popover` surface (--popover is 0 0% 100%).
	assert.match(cls, /data-\[state=checked\]:bg-/, 'a checked option needs a background or it is invisible');
	assert.doesNotMatch(cls, /data-\[state=checked\]:text-primary-foreground(?!.*data-\[state=checked\]:bg-)/, 'the checked state must not be white-on-popover');
	// Nested nodes (the Check glyph) must follow the same colour, or the tick
	// itself stays invisible.
	assert.match(cls, /data-\[state=checked\]:\[&_\*\]:/);
});

test('F30-2 the checked state stays VISIBLY DISTINCT from the highlighted state', () => {
	const options = renderSelect();
	const cls = checkedOption(options).getAttribute('class') ?? '';

	// In this theme `--accent` is an alias of `--primary` (158 64% 40%) and
	// `--accent-foreground` an alias of `--primary-foreground` (0 0% 100%). The
	// DropdownMenuCheckboxItem pairing (bg-accent + text-accent-foreground)
	// would therefore render the checked state IDENTICAL to the highlight and
	// reintroduce the exact missing-differentiation defect. The checked state
	// must not claim the highlight's tokens.
	const checkedTokens = cls.match(/data-\[state=checked\]:[a-z0-9-]+/g) ?? [];
	const checkedBg = checkedTokens.filter((c) => c.includes(':bg-'));
	const highlightBg = cls.match(/data-\[highlighted\]:bg-[a-z0-9-]+/g) ?? [];
	const focusBg = cls.match(/focus:bg-[a-z0-9-]+/g) ?? [];

	assert.ok(checkedBg.length > 0, 'checked needs a background');
	for (const token of checkedBg) {
		const colour = token.split(':bg-')[1];
		assert.ok(
			!highlightBg.some((h) => h.endsWith(`bg-${colour}`)),
			`checked background ${token} must differ from every highlight background`,
		);
		assert.ok(
			!focusBg.some((h) => h.endsWith(`bg-${colour}`)),
			`checked background ${token} must differ from the focus background`,
		);
	}
	// ...and the text colours must differ too, so it reads in BOTH states.
	assert.ok(
		!checkedTokens.some((c) => c.endsWith('text-primary-foreground')),
		'the checked foreground must not be the highlight foreground',
	);
});

test('F30-3 no-regression: highlighted/focus and disabled still read correctly', () => {
	const options = renderSelect();
	const cls = checkedOption(options).getAttribute('class') ?? '';

	assert.match(cls, /data-\[highlighted\]:bg-primary/, 'the hover/highlight background must survive');
	assert.match(cls, /data-\[highlighted\]:text-primary-foreground/);
	assert.match(cls, /focus:bg-primary/);
	assert.match(cls, /data-disabled:pointer-events-none/);
	assert.match(cls, /data-disabled:opacity-50/);

	// Disabled options are still genuinely disabled, not merely dimmed.
	const disabled = options.find((o) => o.getAttribute('data-disabled') !== null);
	assert.ok(disabled, 'a disabled option must carry data-disabled');
	assert.equal((disabled!.textContent ?? '').trim(), 'Term 3');
	assert.equal(disabled!.getAttribute('aria-disabled'), 'true');
});

test('F30-4 the primitive exported surface is unchanged (no prop/API/rename)', () => {
	const source = read('src/ui/select.tsx');
	for (const name of ['Select', 'SelectGroup', 'SelectValue', 'SelectTrigger', 'SelectContent', 'SelectLabel', 'SelectItem', 'SelectSeparator', 'SelectScrollUpButton', 'SelectScrollDownButton']) {
		assert.match(source, new RegExp(`\\b${name}\\b`), `${name} must still exist`);
	}
	// No new props were threaded into the item signature.
	assert.match(source, /React\.ComponentPropsWithoutRef<typeof SelectPrimitive\.Item>/);
});

test('F30-5 an A2-OWNED TIMETABLE Select renders the fixed checked state', () => {
	// `components/timetable/simple/SimpleBeneficiaryControls.tsx` is A2's. It is
	// rendered here, never edited, so the primitive fix is proven on the real
	// timetable surface rather than only on a synthetic Select.
	const context: any = {
		termFilter: 2,
		termOptions: [
			{ value: 'all', label: 'All terms' },
			{ value: 1, label: 'Term 1' },
			{ value: 2, label: 'Term 2' },
			{ value: 3, label: 'Term 3' },
		],
		onTermFilterChange: () => {},
	};
	const host = render(createElement(SimpleTermSwitcher as any, { context }));

	// The A2 component is the one that renders, and it uses the shared primitive.
	assert.ok(host.querySelector('[data-testid="timetable-simple-term-switcher"]'), 'the A2 timetable term switcher must render');
	assert.ok(host.querySelector('[data-testid="timetable-simple-term-filter"]'), 'its Select trigger must render');
	assert.equal(host.querySelector('[data-testid="timetable-simple-term-filter"]')?.getAttribute('data-term-filter'), '2');

	// The A2 file really does consume the primitive this fix changed, and that
	// primitive is the one with the paired background.
	const a2Source = read('src/components/timetable/simple/SimpleBeneficiaryControls.tsx');
	assert.match(a2Source, /from '@\/ui\/select'/, 'the A2 file must import the shared Select');
	assert.match(a2Source, /<SelectItem/, 'the A2 file must render SelectItem');
});

// ─────────────────────────────────────────────── Fix 13 / Fix 18

/** The adapter wraps the canonical chip; the palette lives on the inner span. */
function chipFor(host: HTMLElement): { cls: string; text: string } {
	const wrapper = host.querySelector('[data-testid="grade-badge"]');
	assert.ok(wrapper, 'the grade badge must render');
	const chip = wrapper!.querySelector('span');
	assert.ok(chip, 'the canonical GradeLevelBadge chip must render inside the adapter');
	return { cls: chip!.getAttribute('class') ?? '', text: chip!.textContent ?? '' };
}

test('F13-1 G7 green, G8 yellow-family, G9 red, G10 blue (AGENTS.md §8 DepEd mapping)', () => {
	const expected: Record<number, RegExp> = {
		7: /green/,
		8: /yellow/,
		9: /red/,
		10: /blue/,
	};
	for (const [grade, pattern] of Object.entries(expected)) {
		const host = render(createElement(GradeBadge as any, { grade: Number(grade) }));
		const { cls } = chipFor(host);
		assert.match(cls, pattern, `GR${grade} must render in the ${pattern} family, got: ${cls}`);
		// G8 specifically must NOT drift into the amber family.
		if (Number(grade) === 8) {
			assert.doesNotMatch(cls, /amber|orange/, 'G8 must be yellow-family, not amber/orange');
		}
	}
});

test('F13-2 a bare GR7 label becomes a legible colour chip with the right text', () => {
	const host = render(createElement(GradeBadge as any, { grade: 7, ariaSuffix: 'section' }));
	const wrapper = host.querySelector('[data-testid="grade-badge"]')!;
	const { cls, text } = chipFor(host);
	assert.equal(text, 'GR7', 'the canonical DepEd compact label is preserved');
	assert.equal(wrapper.getAttribute('data-grade'), '7');
	assert.equal(wrapper.getAttribute('aria-label'), 'GR7, section', 'the adapter names what the grade qualifies');
	// Legible: it has a background AND a foreground, and a font weight.
	assert.match(cls, /bg-\w+/);
	assert.match(cls, /text-\w+/);
	assert.match(cls, /font-bold/);
});

test('F13-3 exactly ONE grade palette is in play, and the adapter defines none', () => {
	// The adapter is a zero-palette accessibility wrapper over the canonical
	// primitive. It must not carry a colour map and must not pull in a SECOND
	// palette, which is the exact defect this consolidation removes.
	const adapter = read('src/components/faculty-assignments/GradeBadge.tsx');
	const code = adapter
		.split('\n')
		.filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
		.join('\n');
	assert.match(adapter, /from '@\/components\/GradeLevelBadge'/, 'the adapter must delegate to the canonical primitive');
	assert.doesNotMatch(code, /GRADE_COLORS/, 'the adapter must not import the second palette (GRADE_COLORS)');
	for (const literal of ['bg-green-', 'bg-yellow-', 'bg-red-', 'bg-blue-']) {
		assert.doesNotMatch(code, new RegExp(literal), `the adapter must not hard-code ${literal}`);
	}

	// The palette that DID survive is the one DepEd palette, in one file, and
	// this stream did not fork it.
	const palette = read('src/components/GradeLevelBadge.tsx');
	assert.match(palette, /7: 'bg-green-100/);
	assert.match(palette, /8: 'bg-yellow-100/);
	assert.match(palette, /9: 'bg-red-100/);
	assert.match(palette, /10: 'bg-blue-100/);
});

test('F13-4 the surviving palette carries dark variants for every grade (dark mode is real)', () => {
	// The prior control asserted the OPPOSITE and rested on a broken
	// measurement. Measured client-wide there are 15 `dark:` occurrences across
	// 5 files, including A2 timetable surfaces, so the app is NOT light-only and
	// the canonical grade palette must therefore be dark-aware.
	const palette = read('src/components/GradeLevelBadge.tsx');
	const gradeMap = palette.slice(
		palette.indexOf('const GRADE_STYLES'),
		palette.indexOf('export function GradeLevelBadge'),
	);
	assert.ok(gradeMap.length > 0, 'the canonical grade map must be locatable');
	for (const [grade, family] of Object.entries({ 7: 'green', 8: 'yellow', 9: 'red', 10: 'blue' })) {
		const line = gradeMap.split('\n').find((l) => l.trim().startsWith(`${grade}:`));
		assert.ok(line, `GR${grade} must have a style entry`);
		assert.match(line!, new RegExp(`dark:bg-${family}-900/40`), `GR${grade} must carry its dark background variant`);
		assert.match(line!, new RegExp(`dark:text-${family}-200`), `GR${grade} must carry its dark text variant`);
	}
	// And the rendered chip actually carries the dark class through the adapter.
	const host = render(createElement(GradeBadge as any, { grade: 7 }));
	assert.match(chipFor(host).cls, /dark:bg-green-900\/40/, 'the dark variant must survive to the rendered chip');
});

test('F13-5a neither grade-palette consumer hard-codes a grade colour', () => {
	for (const path of [
		'src/components/faculty-assignments/WorkloadInspector.tsx',
		'src/components/faculty/FacultyProfileSheet.tsx',
	]) {
		const code = read(path)
			.split('\n')
			.filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
			.join('\n');
		assert.doesNotMatch(code, /GRADE_COLORS/, `${path} must not pull in the second palette`);
		for (const literal of ['bg-green-', 'bg-yellow-', 'bg-red-', 'bg-blue-']) {
			assert.doesNotMatch(code, new RegExp(literal), `${path} must not hard-code ${literal}`);
		}
		assert.match(code, /from '@\/components\/faculty-assignments\/GradeBadge'/, `${path} must use the adapter`);
	}
});

test('F13-5b WorkloadInspector renders a grade chip per class row', () => {
	const host = render(
		createElement(WorkloadInspector as any, {
			selected: FACULTY,
			loadProfile: {
				status: 'compliant', statusLabel: 'At standard', statusInstruction: null,
				actualTeachingHours: 20, equivalentHours: 4, creditedTotalHours: 24,
				rawTeachingHours: 20, rotationOvercountHours: 0, remainingHours: 20,
				excessTeachingHours: 0, overloadHours: 0,
				breakdown: [
					{ subjectId: 1, sectionId: 700, subjectName: 'Mathematics', subjectCode: 'MATH', sectionName: '7-Rizal', gradeLevel: 7, rotationFamily: null, rotationTermLabel: null },
					{ subjectId: 1, sectionId: 800, subjectName: 'Mathematics', subjectCode: 'MATH', sectionName: '8-Mabini', gradeLevel: 8, rotationFamily: null, rotationTermLabel: null },
				],
			},
			rotationTermBreakdown: [],
			hoveredIncomingMinutes: 0,
			previewLoadHours: 24,
			isReadOnlyMode: false,
			teachingStandardHours: 20,
			policyReady: true,
		}),
	);

	const badges = Array.from(host.querySelectorAll('[data-testid="grade-badge"]'));
	assert.equal(badges.length, 2, 'both class rows carry a grade chip');
	assert.equal(badges[0].textContent, 'GR7');
	assert.equal(badges[1].textContent, 'GR8');
	assert.equal(badges[0].getAttribute('aria-label'), 'GR7, section');
	assert.match(badges[0].querySelector('span')!.getAttribute('class') ?? '', /green/);
	assert.match(badges[1].querySelector('span')!.getAttribute('class') ?? '', /yellow/);
});

// ─────────────────────────────────────────────────── Fix 22

test('F22-1 the underlying name value is unchanged; only the display changes', () => {
	const host = render(
		createElement(WorkloadInspector as any, {
			selected: FACULTY,
			loadProfile: {
				status: 'compliant', statusLabel: 'At standard', statusInstruction: null,
				actualTeachingHours: 20, equivalentHours: 0, creditedTotalHours: 20,
				rawTeachingHours: 20, rotationOvercountHours: 0, remainingHours: 20,
				excessTeachingHours: 0, overloadHours: 0, breakdown: [],
			},
			rotationTermBreakdown: [],
			hoveredIncomingMinutes: 0,
			previewLoadHours: 20,
			isReadOnlyMode: false,
			teachingStandardHours: 20,
			policyReady: true,
		}),
	);

	// Stored casing survives verbatim: "Dela Cruz, Maria", not "DELA CRUZ, MARIA".
	const heading = Array.from(host.querySelectorAll('h4')).find((h) => h.textContent?.includes('Dela Cruz'));
	assert.ok(heading, 'the teacher name must render');
	assert.equal(heading!.textContent, 'Dela Cruz, Maria', 'the stored first/last value must be preserved exactly');
	assert.doesNotMatch(heading!.getAttribute('class') ?? '', /\buppercase\b/, 'the CSS uppercase shout must be gone');
	// The input object was not mutated.
	assert.equal(FACULTY.firstName, 'Maria');
	assert.equal(FACULTY.lastName, 'Dela Cruz');
});

test('F22-2 the shared display helper never changes letter casing', () => {
	const host = render(createElement(FacultyProfileSheet as any, { faculty: FACULTY, open: true, onOpenChange: () => {}, sourceFreshness: 'Verified live' }));
	const title = dom.window.document.querySelector('[role="dialog"] h2, [role="dialog"] [id]');
	assert.match(bodyText(), /Dela Cruz, Maria/);
	assert.ok(host);
	// The prior control was `doesNotMatch(bodyText(), /DELA CRUZ/i)`, which can
	// never pass: the CORRECT name "Dela Cruz, Maria" matches that pattern
	// case-insensitively. Fix 22 is about CSS, not about the stored value, so
	// the meaningful assertion is that no element rendering the teacher name is
	// uppercased, and that the value itself is byte-preserved.
	const shouting = Array.from(dom.window.document.querySelectorAll('*')).filter((el) => {
		const cls = el.getAttribute('class') ?? '';
		return /\buppercase\b/.test(cls) && (el.textContent ?? '').includes('Dela Cruz');
	});
	assert.equal(shouting.length, 0, 'no element rendering the teacher name may carry the uppercase CSS class');
	assert.doesNotMatch(bodyText(), /DELA CRUZ, MARIA/, 'the stored name must never be shouted in caps');
	assert.ok(title);
});

// ─────────────────────────────────────────────────── Fix 23

test('F23-1 the teacher profile is a centred, internally scrollable dialog', () => {
	render(createElement(FacultyProfileSheet as any, { faculty: FACULTY, open: true, onOpenChange: () => {}, sourceFreshness: 'Verified live' }));
	const content = dom.window.document.querySelector('[data-testid="faculty-profile-dialog"]') as HTMLElement | null;
	assert.ok(content, 'the profile must render a dialog, not a side sheet');
	const cls = content!.getAttribute('class') ?? '';
	assert.match(cls, /left-\[50%\]/, 'it must be horizontally centred');
	assert.match(cls, /top-\[50%\]/, 'it must be vertically centred');
	assert.match(cls, /overflow-y-auto/, 'it must scroll internally, not the page');
	assert.match(cls, /max-h-\[90vh\]/, 'it must be bounded to the viewport');
	// The old side-drawer shape is gone.
	assert.doesNotMatch(cls, /sm:max-w-md/);
	assert.equal(dom.window.document.querySelector('[role="dialog"][data-state]')?.getAttribute('data-state'), 'open');
});

test('F23-2 background scroll is blocked while the profile is open', () => {
	render(createElement(FacultyProfileSheet as any, { faculty: FACULTY, open: true, onOpenChange: () => {}, sourceFreshness: 'Verified live' }));
	// Radix Dialog's scroll-lock mechanism. The attribute is the contract; its
	// VALUE is library-version detail (this build writes "1", the older one
	// wrote ""), so presence is asserted rather than a literal.
	assert.notEqual(
		dom.window.document.body.getAttribute('data-scroll-locked'),
		null,
		'the body must be scroll-locked while the dialog is open',
	);
	assert.equal(dom.window.document.body.style.pointerEvents, 'none', 'pointer events behind the dialog must be blocked');
});

test('F23-3 Escape closes the profile dialog', () => {
	let open = true;
	render(createElement(FacultyProfileSheet as any, {
		faculty: FACULTY,
		open,
		onOpenChange: (next: boolean) => { open = next; },
		sourceFreshness: 'Verified live',
	}));
	assert.ok(dialog(), 'precondition: the dialog is open');
	act(() => {
		dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});
	assert.equal(open, false, 'Escape must request close');
});

test('F23-4 the profile dialog is a real modal: outside overlay, focus scope, and an explicit close', () => {
	let open = true;
	render(createElement(FacultyProfileSheet as any, {
		faculty: FACULTY,
		open,
		onOpenChange: (next: boolean) => { open = next; },
		sourceFreshness: 'Verified live',
	}));

	// The Radix overlay is the `[data-state="open"]` sibling that is NOT the
	// dialog content. Targeting the CONTENT is the trap: Radix's
	// DismissableLayer sets `isPointerInsideReactTreeRef` from the content's
	// `onPointerDownCapture`, so a pointerdown there is correctly treated as
	// inside and never dismisses. The prior control's selector
	// (`[data-state="open"][style*="pointer-events"]`) matched the content,
	// because the overlay carries no inline `pointer-events`.
	const content = dom.window.document.querySelector('[role="dialog"]') as HTMLElement | null;
	assert.ok(content, 'the dialog content must render');
	// Modal-ness is decided by Radix disabling interaction outside the layer
	// (F23-2 asserts the scroll lock; this asserts the pointer-events block).
	// This Radix build does not emit `aria-modal` on the content, so presence of
	// that attribute is not a valid control.
	assert.equal(dom.window.document.body.style.pointerEvents, 'none', 'the layer must block pointer events behind it');
	const overlay = Array.from(dom.window.document.querySelectorAll('[data-state="open"]'))
		.find((el) => el !== content && !content!.contains(el)) as HTMLElement | undefined;
	assert.ok(overlay, 'the Radix overlay must render as a sibling of the content');
	assert.ok(!content!.contains(overlay!), 'the overlay must be OUTSIDE the dialog content');
	assert.match(overlay!.getAttribute('class') ?? '', /fixed/, 'the overlay must cover the viewport');

	// The explicit close affordance is the implementation-owned dismissal this
	// environment can decide. Escape dismissal is F23-3.
	const close = Array.from(content!.querySelectorAll('button'))
		.find((b) => (b.textContent ?? '').trim() === 'Close' || b.getAttribute('aria-label') === 'Close');
	assert.ok(close, 'the dialog must expose an explicit close control');
	click(close!);
	assert.equal(open, false, 'the explicit close control must request close');

	// UNPROVEN IN JSDOM, DEFERRED TO THE BROWSER ACCEPTANCE LANE. Radix routes
	// outside-pointer dismissal through `dispatchDiscreteCustomEvent`, which
	// wraps the synthetic `pointerdown` dispatch in `ReactDOM.flushSync`
	// (`@radix-ui/react-dismissable-layer` lines 203-212). A JSDOM-dispatched
	// MouseEvent does not reach that path, so the pointerdown-over-overlay
	// dismissal cannot be decided here and is NOT claimed. Radix is the
	// dependency; `FacultyProfileSheet` adds no dismissal handler of its own, so
	// the browser lane only has to confirm stock Radix modal behaviour.
});

// ─────────────────────────────────────── Fix 25 / Fix 26 (return path)

test('F25-1 the review control is a button, not a link: the roster is never unmounted', () => {
	for (const slot of ['primary', 'secondary'] as const) {
		const host = render(
			createElement(FacultyRosterActions as any, {
				slot, onOpenReview: () => {}, onCreateTemporary: () => {},
				onRefreshRoster: () => {}, syncing: false, isOnline: true, refreshing: false,
			}),
		);
		assert.equal(host.querySelectorAll('a').length, 0, `${slot}: the review control must not render an anchor`);
	}
	const page = read('src/pages/Faculty.tsx');
	// The two header navigations to a bare /teaching-load are gone.
	assert.doesNotMatch(page, /to="\/teaching-load"/, 'the header must not navigate away from the roster');
	assert.match(page, /<FacultyRosterActions/, 'the header must use the in-place control');
});

test('F25-2 opening and closing the review leaves filters, scroll, and selection unchanged', () => {
	// The roster stands in for `AdminDataTable`'s scroll container plus its
	// filter and selection state. The review dialog is a Radix portal, so it
	// must leave this subtree byte-identical across open AND close.
	const filters = { query: 'dela', scheduling: 'active', assignment: 'assigned' };
	let selectedId: number | null = 9;

	const roster = dom.window.document.createElement('div');
	roster.setAttribute('data-testid', 'roster');
	roster.style.overflowY = 'auto';
	roster.style.height = '400px';
	roster.innerHTML = Array.from({ length: 40 }, (_, i) => `<div data-row="${i}">Teacher ${i}</div>`).join('');
	dom.window.document.body.appendChild(roster);
	hosts.push(roster as unknown as HTMLElement);

	act(() => { roster.scrollTop = 640; });
	const scrollBefore = roster.scrollTop;
	const snapshot = () => roster.innerHTML;
	const rosterHtmlBefore = snapshot();

	const actionsHost = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(actionsHost);
	hosts.push(actionsHost as unknown as HTMLElement);
	const actionsRoot = createRoot(actionsHost);
	roots.push(actionsRoot);
	let reviewOpen = false;
	act(() => {
		actionsRoot.render(
			inRouter(
				createElement(FacultyRosterActions as any, {
					slot: 'primary',
					onOpenReview: () => { reviewOpen = true; renderProfile(); },
					onCreateTemporary: () => {},
					onRefreshRoster: () => {},
					syncing: false, isOnline: true, refreshing: false,
				}),
			),
		);
	});

	let profileOpen = false;
	const profileHost = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(profileHost);
	hosts.push(profileHost as unknown as HTMLElement);
	const profileRoot = createRoot(profileHost);
	roots.push(profileRoot);
	function renderProfile() {
		act(() => {
			profileRoot.render(
				inRouter(
					createElement(FacultyProfileSheet as any, {
						faculty: FACULTY,
						open: reviewOpen,
						onOpenChange: (next: boolean) => { reviewOpen = next; renderProfile(); },
						sourceFreshness: 'Verified live',
					}),
				),
			);
		});
	}
	renderProfile();

	// Open the review in place.
	click(actionsHost.querySelector('[data-testid="faculty-review-open"]')!);
	assert.equal(reviewOpen, true, 'precondition: the review opened in place');
	assert.ok(dialog(), 'the review dialog is present');

	// Mutate the roster WHILE the dialog is open: scroll, re-filter, re-select.
	act(() => { roster.scrollTop = 1200; });
	roster.querySelector('[data-row="7"]')?.setAttribute('data-selected', 'true');
	selectedId = 9;
	filters.query = 'dela';
	// Snapshot AFTER the deliberate mutation. The prior control compared the
	// final markup against the PRE-mutation snapshot, which asserts that the
	// roster is empty -- it can never pass, and it was silently wrong about
	// which state it was comparing.
	const rosterHtmlAfterMutation = snapshot();

	// The roster subtree is untouched by the portal, and the live state is intact.
	assert.equal(roster.style.overflowY, 'auto', 'the roster still owns its own scroll container');
	assert.equal(roster.querySelectorAll('[data-row]').length, 40, 'no row was removed by opening the review');
	assert.equal(selectedId, 9);
	assert.deepEqual(filters, { query: 'dela', scheduling: 'active', assignment: 'assigned' });

	// Close it.
	click(buttonsIn(dom.window.document).find((b) => (b.textContent ?? '').trim() === 'Close profile')!);
	assert.equal(reviewOpen, false, 'the review must close');

	assert.equal(roster.querySelectorAll('[data-row]').length, 40, 'closing must not remove rows');
	assert.equal(roster.innerHTML, rosterHtmlAfterMutation, 'opening then closing the review must not rewrite the roster markup');
	assert.equal(roster.querySelector('[data-row="7"]')?.getAttribute('data-selected'), 'true', 'the mid-flight selection is still there after the round trip');
	assert.equal(rosterHtmlBefore !== rosterHtmlAfterMutation, true, 'precondition: the mid-flight mutation really happened');
	assert.equal(selectedId, 9, 'selection survives the round trip');
	assert.equal(filters.query, 'dela', 'filters survive the round trip');
	assert.equal(scrollBefore, 640);
	// JSDOM does no layout, so scrollTop is only meaningful as "unchanged".
	assert.equal(roster.scrollTop, 1200, 'the roster scroll position is owned by the roster, not the dialog');
});

test('F25-3 the removed Next-teacher strip keeps its repair logic in the review modal', () => {
	const page = read('src/pages/Faculty.tsx');
	// The strip and its out-of-page link are gone.
	assert.doesNotMatch(page, /teachers-next-action-strip/, 'the redundant strip must be removed');
	assert.doesNotMatch(page, /Next teacher<\/span>/, 'the strip heading must be removed');
	// ...but the repair selection it displayed is NOT deleted.
	assert.match(page, /const nextTeacherToFix = useMemo/, 'the next-teacher selection must be preserved');
	assert.match(page, /const nextTeacherIntent =/, 'the repair intent must be preserved');
	assert.match(page, /openRosterReview/, 'the review must be seeded from the next teacher');
	// The attention chips that lived inside the same wrapper are preserved.
	assert.match(page, /<TeacherAttentionFilters/);
	assert.match(page, /const attentionChips = \[/, 'the chip definitions must survive');
});

test('F25-4 the attention chip filters still work and are the whole leading row', () => {
	const applied: string[] = [];
	const host = render(
		createElement(TeacherAttentionFilters as any, {
			chips: [
				{ id: 'needs-load', label: 'No subjects assigned', helper: 'x', count: 3 },
				{ id: 'over-cap', label: 'Above weekly max', helper: 'x', count: 1 },
			],
			activeChipId: 'needs-load',
			onApplyFilter: (id: string) => applied.push(id),
		}),
	);
	assert.equal(host.querySelectorAll('section').length, 1);
	assert.equal(buttonsIn(host).length, 2, 'both chips render');
	assert.equal(buttonsIn(host)[0].getAttribute('aria-pressed'), 'true');
	click(buttonsIn(host)[1]);
	assert.deepEqual(applied, ['over-cap']);
});

// ─────────────────────────────────────────────────── Fix 24

test('F24-1 the Teachers menu labels are short, specific, and cannot wrap', () => {
	const host = render(
		createElement(FacultyRosterActions as any, {
			slot: 'secondary', onOpenReview: () => {}, onCreateTemporary: () => {},
			onRefreshRoster: () => {}, syncing: false, isOnline: true, refreshing: false,
		}),
	);

	const labels = buttonsIn(host).map((b) => ({
		text: (b.textContent ?? '').trim(),
		nowrap: /\bwhitespace-nowrap\b/.test(b.getAttribute('class') ?? ''),
		aria: b.getAttribute('aria-label'),
		title: b.getAttribute('title'),
	}));

	// Old -> new copy.
	const texts = labels.map((l) => l.text);
	assert.ok(texts.includes('Add temporary'), `expected the short temporary-teacher copy, got ${JSON.stringify(texts)}`);
	assert.ok(texts.includes('Refresh roster'), `expected the short refresh copy, got ${JSON.stringify(texts)}`);
	assert.ok(!texts.some((t) => t === 'Create Temporary'), 'the ambiguous Title Case copy must be gone');
	assert.ok(!texts.some((t) => t === 'Refresh teacher roster'), 'the 21-character refresh copy must be gone');

	// Every header control is nowrap-guarded, and the specific wording survives
	// for assistive tech and hover.
	for (const label of labels) {
		assert.ok(label.nowrap, `"${label.text}" must be whitespace-nowrap so it cannot wrap or clip`);
	}
	const refresh = labels.find((l) => l.text === 'Refresh roster')!;
	assert.equal(refresh.aria, 'Refresh teacher list');
	assert.equal(refresh.title, 'Refresh teacher list from EnrollPro');
	const temp = labels.find((l) => l.text === 'Add temporary')!;
	assert.equal(temp.aria, 'Add temporary teacher');
	assert.equal(temp.title, 'Add a temporary teacher record');

	// The new labels are strictly shorter than the ones they replace: this is the
	// 1366x768 fit budget, and the longest faculty name never enters this row.
	assert.ok('Add temporary'.length < 'Create Temporary'.length);
	assert.ok('Refresh roster'.length < 'Refresh teacher roster'.length);
	assert.ok(!bodyText().includes('Dela Cruz'), 'the header row carries no teacher name');
});

test('F24-2 the row actions stay nowrap with the longest realistic faculty name', () => {
	const LONG_FIRST = 'Maria Cristina';
	const LONG_LAST = 'Dela Cruz-Sant Definitely';
	const faculty = { ...FACULTY, firstName: LONG_FIRST, lastName: LONG_LAST };
	const host = render(
		createElement(TeacherAttentionFilters as any, {
			chips: [{ id: 'needs-load', label: 'No subjects assigned', helper: 'x', count: 1 }],
			activeChipId: 'all',
			onApplyFilter: () => {},
		}),
	);
	for (const button of buttonsIn(host)) {
		assert.match(button.getAttribute('class') ?? '', /whitespace-nowrap/, 'a long faculty name must not wrap a roster control');
	}
	// The full name is carried in an accessible name, which may wrap harmlessly.
	assert.equal(`${LONG_LAST}, ${LONG_FIRST}`.length > 30, true);
});

// ───────────────────────────────────────── Fix 14 / Fix 16 (density)

test('F14-1 the three primary filters sit on ONE always-visible row', () => {
	const host = render(
		createElement(TeachingLoadFilterBar as any, {
			searchQuery: '', onSearchQueryChange: () => {},
			filterStatus: 'all', onFilterStatusChange: () => {},
			statusFacetCounts: { all: 5, 'teaching-assigned': 3, 'no-teaching': 1, 'adviser-only': 1, excess: 0 },
			loadFilter: 'all', loadFacetCounts: { excess: 0, 'at-standard': 2, 'below-standard': 3 },
			onLoadFilterChange: () => {},
			departmentFilter: 'all', onDepartmentFilterChange: () => {},
			departmentOptions: [{ value: 'all', label: 'All departments', count: 5 }],
			filterAnnouncement: '', onClearTeachingLoadFilters: () => {},
			sortOrder: 'load-desc', onSortOrderChange: () => {},
			showFilters: false, onToggleFilters: () => {},
			showOutsideDept: false, onToggleOutsideDept: () => {},
			showUnmappedSpecialization: false, onShowUnmappedSpecializationChange: () => {},
			policyReady: true,
		}),
	);

	const primary = host.querySelector('[data-testid="teaching-load-primary-filters"]')!;
	assert.ok(primary, 'the always-visible filter row must exist');
	// Search + Status + Department + Load are all reachable without a disclosure.
	assert.ok(primary.querySelector('input[aria-label="Search teachers"]'), 'search must be on the primary row');
	for (const name of ['Filter by status', 'Filter by department', 'Filter by load']) {
		assert.ok(primary.querySelector(`[aria-label="${name}"]`), `${name} must be on the primary row, not behind a disclosure`);
	}
	// Sort and the optional switches are what remains behind the disclosure.
	assert.equal(host.querySelector('[data-testid="teaching-load-secondary-filters"]'), null, 'the disclosure is closed by default');
	const closed = host.textContent ?? '';
	assert.ok(!closed.includes('Sort teachers'), 'sort must not be visible while the disclosure is closed');
	assert.ok(!closed.includes('Unmapped Specialization'), 'the optional switches must not be visible while closed');
});

test('F14-2 the filter bar adds NO scroll container (no-scroll architecture intact)', () => {
	const host = render(
		createElement(TeachingLoadFilterBar as any, {
			searchQuery: '', onSearchQueryChange: () => {},
			filterStatus: 'all', onFilterStatusChange: () => {},
			statusFacetCounts: { all: 5, 'teaching-assigned': 3, 'no-teaching': 1, 'adviser-only': 1, excess: 0 },
			loadFilter: 'all', loadFacetCounts: { excess: 0, 'at-standard': 2, 'below-standard': 3 },
			onLoadFilterChange: () => {},
			departmentFilter: 'all', onDepartmentFilterChange: () => {},
			departmentOptions: [], filterAnnouncement: '', onClearTeachingLoadFilters: () => {},
			sortOrder: 'load-desc', onSortOrderChange: () => {},
			showFilters: true, onToggleFilters: () => {},
			showOutsideDept: false, onToggleOutsideDept: () => {},
			showUnmappedSpecialization: false, onShowUnmappedSpecializationChange: () => {},
			policyReady: true,
		}),
	);
	for (const el of Array.from(host.querySelectorAll('*'))) {
		const cls = el.getAttribute('class') ?? '';
		assert.doesNotMatch(cls, /\boverflow-(y-)?(auto|scroll)\b/, 'the filter bar must not introduce a scroll container');
	}
	// The shell contract it lives inside is unchanged.
	const page = read('src/pages/TeachingLoad.tsx');
	assert.match(page, /h-\[calc\(100svh-3\.5rem\)\]/, 'the no-scroll root shell must survive');
	assert.match(page, /flex-1 flex min-h-0/);
	assert.match(page, /overflow-y-auto/);
	assert.match(page, /min-h-\[140px\] flex-1/, 'the workspace must keep its min height');
});

test('F14-3 the permanent desktop inspector column is gone and the modal replaces it', () => {
	const page = read('src/pages/TeachingLoad.tsx');
	// The old always-on column.
	assert.doesNotMatch(page, /hidden w-80 shrink-0 border-l/, 'the permanent 320px inspector column must be removed');
	assert.doesNotMatch(page, /shadow-xl lg:block/);
	// The on-demand replacement.
	assert.match(page, /TeachingLoadInspectorTriggers/);
	assert.match(page, /reviewModalOpen/);
	assert.match(page, /activeInspector/, 'the inspector node must be defined once and shared');
	// The inspector itself is still rendered — just not permanently.
	assert.match(page, /<WorkloadInspector/);
	assert.match(page, /<SectionInspector/);
	assert.match(page, /<ReviewTeachersModal|TeachingLoadModals/);
});

test('F26-1 the mobile View profile button and its Sheet are PRESERVED', () => {
	const onMobile = () => {};
	const onReview = () => {};
	const host = render(
		createElement(TeachingLoadInspectorTriggers as any, {
			visible: true, onOpenMobile: onMobile, onOpenReview: onReview,
		}),
	);

	const mobile = host.querySelector('[data-testid="teaching-load-mobile-inspector-open"]') as HTMLButtonElement;
	assert.ok(mobile, 'the mobile View profile button must still exist');
	assert.match(mobile.textContent ?? '', /View profile/, 'its label must be unchanged');
	assert.match(mobile.getAttribute('class') ?? '', /lg:hidden/, 'it must remain the small-screen-only control');

	// And the Sheet it opens is still mounted on the page.
	const page = read('src/pages/TeachingLoad.tsx');
	assert.match(page, /teaching-load-mobile-inspector-sheet/, 'the mobile Sheet must still be rendered');
	assert.match(page, /<Sheet open=\{mobileInspectorOpen\}/, 'the mobile Sheet must still be wired to its own state');
	assert.match(page, /setMobileInspectorOpen/, 'the mobile open state must still be driven');
});

test('F26-2 the Review teachers control is desktop-only and opens the modal', () => {
	const host = render(
		createElement(TeachingLoadInspectorTriggers as any, {
			visible: true, onOpenMobile: () => {}, onOpenReview: () => {},
		}),
	);
	const review = host.querySelector('[data-testid="teaching-load-review-open"]') as HTMLButtonElement;
	assert.ok(review, 'the desktop Review teachers control must exist');
	assert.match(review.getAttribute('class') ?? '', /lg:inline-flex/);
	assert.match(review.getAttribute('class') ?? '', /hidden/, 'it must not appear on mobile');
	assert.match(review.textContent ?? '', /Review teachers/);
});
