/**
 * A6 c5 — ROWS THAT RUN AGAINST SURFACE THAT EXISTED AT THE BASE.
 *
 * This file imports NOTHING that A6 c5 created. Every row below mounts a
 * component that was already on `main` at `316534f2` and asserts the c5
 * behaviour, which is what makes these rows genuinely RED at the base: the
 * failure is the defect the packet names, not an import error. The rows whose
 * only control is a new module live in `a6-c5-outage-derivation.test.tsx` and
 * are proved by MUTATION, because base-red is impossible for them.
 *
 * HARNESS COPIED VERBATIM from the accepted sibling
 * `a6-teaching-load-surface.test.tsx` (its JSDOM / act / click helpers), so
 * these rows behave exactly as the controls beside them.
 *
 * WHAT IS *NOT* CLAIMED HERE: nothing in this file measures a pixel. JSDOM
 * performs no layout, so the width and the 1366x768 fit stay with the visual
 * lane; what these rows turn on is the real element tree and real React state.
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
	addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
});

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
const { WorkspaceToolbar } = await import('@/components/faculty-assignments/WorkspaceToolbar');
const { TeachingLoadRepairQueue } = await import('@/components/faculty-assignments/TeachingLoadRepairQueue');
const { useTeachingLoadRepairQueue } = await import('@/hooks/useTeachingLoadRepairQueue');
const { TeacherLoadReadout } = await import('@/components/faculty-assignments/TeacherLoadReadout');
const { SectionGridMode } = await import('@/components/faculty-assignments/SectionGridMode');
const { teachingLoadShortageNote } = await import('@/lib/teaching-load-suggestion-presentation');

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

function render(node: any): HTMLElement {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => {
		root.render(createElement(
			MemoryRouter as any,
			{ initialEntries: ['/teaching-load'] },
			createElement(TooltipProvider as any, { delayDuration: 200 }, node),
		));
	});
	return host;
}

function click(el: Element) {
	act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

/** The ONE placeholder sentence, asserted as the packet words it (em dash). */
const TRUTH = 'to be hired — not a real person yet';

/**
 * Source text with COMMENTS removed.
 *
 * Every §8 row below is a claim about code, not about prose, and several of
 * these files discuss the very tokens the rules forbid (`<button>`, `HoverCard`,
 * `teach outside department`) inside a header comment that explains why they are
 * absent. Scanning the raw file would read the explanation and call it a
 * violation, so the comment is stripped first and the row decides about code.
 */
function code(relative: string): string {
	return read(relative)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const TEACHER: any = {
	id: 9, firstName: 'Maria', lastName: 'Dela Cruz', department: 'Mathematics',
	employmentStatus: 'REGULAR', employeeId: 'EMP-0009', isActiveForScheduling: true,
	isClassAdviser: false, isPlaceholder: false, maxHoursPerWeek: 30,
	policyCreditedHours: 30, sectionTeachingHours: 30, actualTeachingHours: 30,
	subjectCount: 3, sectionCount: 9, advisoryEquivalentHours: 0, ancillaryMinutesPerWeek: 0,
	advisedSectionName: null, version: 1, assignments: [],
};
/** A real teacher who is genuinely over the weekly max: the generation blocker. */
const OVER_CAP: any = {
	...TEACHER, id: 14, firstName: 'Roberto', lastName: 'Alcantara',
	actualTeachingHours: 32, sectionTeachingHours: 32,
};
const PLACEHOLDER: any = {
	...TEACHER, id: 42, firstName: 'TBA', lastName: 'Placeholder',
	isPlaceholder: true, actualTeachingHours: 20, sectionTeachingHours: 20,
	policyCreditedHours: 0, subjectCount: 0, sectionCount: 0,
};

function toolbarProps(overrides: Record<string, any> = {}) {
	return {
		realAssignedPairs: 75,
		syntheticPlaceholderPairs: 25,
		unassignedPairs: 12,
		totalPairs: 112,
		overCapCount: 0,
		excessTeachingCount: 0,
		policyReady: true,
		onShowExcessTeachingLoad: () => {},
		onShowTemporarySubstitutes: () => {},
		autoFillLoading: false,
		autoFillEnabled: true,
		onAutoFillClick: () => {},
		viewMode: 'teacher',
		onViewModeChange: () => {},
		dataSource: 'live',
		degradedWriteEnabled: false,
		isWorkspaceWritable: true,
		isOnline: true,
		dataSourceNotice: null,
		coverageMode: 'balanced',
		onCoverageModeChange: () => {},
		coverageModeConfig: { balanced: { label: 'Balanced', description: 'desc' } },
		workspaceStateLabel: 'Ready',
		workspaceStateDescription: 'Live roster verified.',
		workspaceStateNextAction: 'Assign the remaining classes.',
		activeDraftCount: 0,
		saving: false,
		onSave: () => {},
		onRetrySource: () => {},
		...overrides,
	};
}

function row2(host: HTMLElement): HTMLElement {
	const row = host.querySelector('[data-testid="teaching-load-readiness-strip"]');
	assert.ok(row, 'row 2 must render');
	return row as HTMLElement;
}

// ─────────────────────────────────────────── S3 — `% staffed` counts a placeholder

test('A6C5-S3-1 a placeholder-held class is NOT staffed: the header never reads 100%', () => {
	// The packet's own outage numbers, verbatim: 75 real, 25 placeholder-held,
	// 12 unowned, 112 total. The base arithmetic is
	// (75 + 25) / 112 = 89%, and the base sentence can therefore also read
	// `100% staffed` the moment a roster is held ENTIRELY by to-be-hired
	// records. This row mounts the real toolbar twice: once with the packet's
	// figures and once with an all-placeholder roster, and both must refuse to
	// count a placeholder as a teacher.
	const outage = render(createElement(WorkspaceToolbar as any, toolbarProps()));
	assert.doesNotMatch(
		row2(outage).textContent ?? '',
		/89% staffed/,
		'(75 real + 25 placeholder) / 112 must NOT read 89% staffed — a to-be-hired record is not a teacher',
	);
	assert.match(
		row2(outage).textContent ?? '',
		/67% staffed/,
		'the truthful figure is 75 real / 112 total = 67% staffed',
	);

	const allPlaceholders = render(createElement(WorkspaceToolbar as any, toolbarProps({
		realAssignedPairs: 0,
		syntheticPlaceholderPairs: 100,
		unassignedPairs: 0,
		totalPairs: 100,
	})));
	assert.doesNotMatch(
		row2(allPlaceholders).textContent ?? '',
		/100% staffed/,
		'a roster held entirely by to-be-hired records must not read 100% staffed',
	);
	assert.match(
		row2(allPlaceholders).textContent ?? '',
		/0% staffed/,
		'the truthful figure is 0 real / 100 total = 0% staffed',
	);
});

test('A6C5-S3-2 the fix is the FIGURE only: the rest of the row is untouched', () => {
	// An over-correction that removed the sentence, or the classes-needing-a-
	// teacher clause, would pass S3-1 while deleting the row. This row pins the
	// two neighbours so the correction cannot be over-broad.
	const host = render(createElement(WorkspaceToolbar as any, toolbarProps()));
	const text = row2(host).textContent ?? '';
	assert.match(text, /12 classes need a teacher/, 'the classes-needing-a-teacher clause must survive');
	assert.ok(
		host.querySelector('[data-testid="teaching-load-status-sentence"]'),
		'the one status sentence must still render',
	);
	// The temporary-substitute alert chip keeps its own test id and its number.
	assert.ok(
		host.querySelector('[data-testid="teaching-load-alert-teacher-x"]'),
		'the placeholder alert chip keeps its test id when the row has no shortage line',
	);
	assert.match(text, /Temporary substitutes: 25/, 'the alert still states its number');
});

// ─────────────────────────────────────────── the over-cap clause (shortage state)

/**
 * The repair queue mounted through the REAL hook, because the over-cap fact's
 * only remaining home in a shortage state IS the queue — the header's alert
 * clause is suppressed beside the shortage line.
 */
function RealQueue(props: { hasShortage: boolean; onItems?: (items: any[]) => void }) {
	const queue = useTeachingLoadRepairQueue({
		searchParams: new URLSearchParams(),
		setSearchParams: () => {},
		faculty: [TEACHER, OVER_CAP],
		// Both teachers hold load, so `teacher-missing-load` fires for neither and
		// the over-cap item is the ONLY thing on row 2 — which is the state the
		// row is about: one next step, and it is the generation blocker.
		effectiveAssignmentsByFaculty: {
			9: [{ subjectId: 11, sectionIds: [104] }],
			14: [{ subjectId: 12, sectionIds: [201] }],
		},
		activeDraftCount: 0,
		isReadOnlyMode: false,
		selectedId: null,
		coverageAssigned: 87,
		coverageTotal: 112,
		coverageUnassigned: 12,
		sourceDegraded: false,
		sourceState: { dataSource: 'live' as const, isOnline: true },
		hasShortage: props.hasShortage as any,
		writeBlockedReason: null,
		onSelectFaculty: () => {},
		onSave: () => {},
		onShowSubjectCoverage: () => {},
		onShowTeachersWithoutLoad: () => {},
		onShowOverloaded: () => {},
		onShowPlaceholder: () => {},
		onOpenReview: () => {},
	} as any);
	props.onItems?.(queue.repairQueueItems);
	return createElement(TeachingLoadRepairQueue as any, {
		items: queue.repairQueueItems,
		activeItemId: null,
		isReadOnly: false,
		saving: false,
		onPrimaryAction: () => {},
		hasShortageLine: props.hasShortage,
	});
}

test('A6C5-OVERCAP-1 with a shortage, the over-cap blocker is still named EXACTLY ONCE', () => {
	// A6 c5 removes the header's alert clause while the shortage line claims row
	// 2. `Above weekly max: N` is the one count that blocks generation outright,
	// so it must survive — but ONCE, in the queue, not twice in two vocabularies.
	const host = render(createElement(RealQueue, { hasShortage: true }));
	const text = host.textContent ?? '';

	assert.match(
		text,
		/is over the weekly max/,
		'the over-cap teacher must still be named while a shortage is showing',
	);
	assert.match(
		text,
		/32\.0h used \/ 30h max\./,
		'the over-cap item must still state the figure that blocks generation',
	);
	assert.doesNotMatch(
		text,
		/Above weekly max/,
		'the header chip is replaced by the queue item — the fact must be named once, not twice',
	);
	// And the queue item the shortage line replaces is genuinely gone, which is
	// what makes the over-cap item the ONLY next step on the row.
	assert.doesNotMatch(
		text,
		/Assign teachers to open classes/,
		'the shortage line replaces the `missing-load` row, so the queue must not offer it',
	);
	assert.doesNotMatch(
		text,
		/Teaching Load looks ready/,
		'the readiness fallback must be suppressed while a shortage is showing',
	);
});

test('A6C5-OVERCAP-2 without a shortage, the chip and the queue item coexist as before', () => {
	// The other half of "one status per fact": the no-shortage state is exactly
	// what it was, because the c4 `data-alert-key` / test-id contracts and the
	// a3-c10 T7 row that read them are untouched by this slice. Both items are
	// built again, and the header's own chip is the surface that reads the
	// over-cap count.
	let built: any[] = [];
	const host = render(createElement(RealQueue, { hasShortage: false, onItems: (items) => { built = items; } }));
	const text = host.textContent ?? '';

	assert.match(text, /Assign teachers to open classes/, 'the `missing-load` row returns without a shortage');
	assert.ok(
		built.some((item) => item.kind === 'over-cap'),
		'the over-cap item is still built without a shortage — nothing was deleted, only re-homed',
	);
	// And the header still owns the chip form of the same fact in this state.
	const toolbar = render(createElement(WorkspaceToolbar as any, toolbarProps({
		realAssignedPairs: 87,
		syntheticPlaceholderPairs: 0,
		unassignedPairs: 12,
		totalPairs: 112,
		overCapCount: 1,
	})));
	const chip = toolbar.querySelector('[data-testid="teaching-load-alert-over-cap"]');
	assert.ok(chip, 'the over-cap chip keeps its test id in the no-shortage state');
	assert.equal(chip!.getAttribute('data-alert-key'), 'overcap', 'and keeps its `data-alert-key` contract');
	assert.match(row2(toolbar).textContent ?? '', /Above weekly max: 1/, 'the chip still states its number');
});

// ─────────────────────────────────────────── S7 — placeholders say what they are

test('A6C5-S7-1 the roster row says a placeholder is not a real person yet', () => {
	const host = render(createElement(TeacherLoadReadout as any, {
		displayHours: 20,
		utilization: 67,
		isPlaceholder: true,
		standardHours: 30,
		policyReady: true,
		maxHoursPerWeek: 30,
	}));
	const note = host.querySelector('[data-testid="teaching-load-placeholder-note"]');
	assert.ok(
		note,
		'the roster row must carry the placeholder note — it used to read a bare one-word `temporary`',
	);
	assert.equal(
		(note as HTMLElement).textContent?.trim(),
		TRUTH,
		'the roster row must read the packet\'s own sentence',
	);
	// And the word it used to carry is gone from the rendered row.
	assert.doesNotMatch(host.textContent ?? '', /^\s*temporary\s*$/i, 'the bare `temporary` footnote must be gone');
});

test('A6C5-S7-2 the grid and the suggestion preview row name the placeholder from the SAME constant', () => {
	// The roster row is proved RENDERED above. The other two surfaces are proved
	// by WIRING here, and the row says so rather than claiming more: both must
	// render the identical `PLACEHOLDER_TRUTH_LABEL` the rendered roster row
	// printed verbatim, so the three surfaces cannot spell it three ways. The
	// rendered proof for these two belongs to the browser lane; see the handoff.
	for (const path of [
		'src/components/faculty-assignments/SectionGridMode.tsx',
		'src/components/faculty-assignments/AutoFillSummaryModal.tsx',
	]) {
		const source = code(path);
		assert.match(
			source,
			/import \{ PLACEHOLDER_TRUTH_LABEL \} from '@\/components\/faculty-assignments\/teachingLoadOutage'/,
			`${path} must take the placeholder sentence from the ONE constant`,
		);
		assert.ok(
			source.includes('{PLACEHOLDER_TRUTH_LABEL}'),
			`${path} must RENDER the constant, not merely import it`,
		);
	}
	// The sections grid used to SUPPRESS the percentage for a placeholder and put
	// nothing in its place, so the only signal was the absence of a number.
	assert.match(
		code('src/components/faculty-assignments/SectionGridMode.tsx'),
		/data-testid="teaching-load-owner-option-placeholder"/,
		'the grid must keep an addressable placeholder option to assert on',
	);
	assert.match(
		code('src/components/faculty-assignments/AutoFillSummaryModal.tsx'),
		/data-testid="teaching-load-suggestion-row-placeholder"/,
		'the suggestion preview row must keep an addressable placeholder row',
	);
});

// ─────────────────────────────────────────── S9 — the honest note, and no pre-hotfix toast

test('A6C5-S9-1 the pre-hotfix preview-toast wording is GONE from the page', () => {
	// The preview toast at `pages/TeachingLoad.tsx` used to read
	// `. but some classes still need scheduler review.`, which names neither a
	// number nor a subject. It is a toast — a side effect, not rendered DOM — so
	// the only honest control for a DELETION like this is the source itself. This
	// row is labelled as such and does not stand in for a rendered claim; the
	// rendered claim for the same sentence is S9-2.
	const page = code('src/pages/TeachingLoad.tsx');
	assert.doesNotMatch(
		page,
		/but some classes still need scheduler review/,
		'the pre-hotfix wording must be gone from the code, not only from the comment that names it',
	);
	assert.match(
		page,
		/teachingLoadShortageNote\(/,
		'the toast must now carry the shared `N classes still need a real teacher` sentence',
	);
	assert.match(
		page,
		/data-testid="teaching-load-still-need-real-teacher"/,
		'the honest note must be on the PAGE, not only inside the summary modal description',
	);
	// And the page is under the AGENTS.md §8 cap the packet names.
	const lines = read('src/pages/TeachingLoad.tsx').split('\n').length;
	assert.ok(lines <= 1000, `pages/TeachingLoad.tsx must stay at or under 1000 lines; it is ${lines}`);
});

test('A6C5-S9-2 the note itself counts a placeholder-held class as needing a teacher', () => {
	// `unresolved` on a PREVIEW counts temporary-substitute rows, which are never
	// saved, so it is exactly the count of classes still without a teacher.
	assert.equal(
		teachingLoadShortageNote(25, 0),
		'25 classes still need a real teacher.',
		'a roster held by 25 to-be-hired records must read as 25 classes needing a real teacher, not 0',
	);
	assert.equal(
		teachingLoadShortageNote(25, 12),
		'37 classes still need a real teacher.',
		'placeholder-held AND unowned classes are both classes without a real teacher',
	);
	assert.equal(
		teachingLoadShortageNote(0, 0),
		'Every class has a real teacher.',
		'nothing outstanding reads as the honest positive, not a number',
	);
});

// ─────────────────────────────────────────── S11 — no non-teaching personnel, no new affordance

test('A6C5-S11-1 no department-setting affordance was added to the outage surface', () => {
	// A9 removes non-teaching personnel at FETCH, so the roster reaching Teaching
	// Load already excludes them and c5 must not build a "Needs a department"
	// cue for records that must not exist.
	for (const path of [
		'src/components/faculty-assignments/teachingLoadOutage.ts',
		'src/components/faculty-assignments/TeachingLoadShortageLine.tsx',
		'src/components/faculty-assignments/TeachingLoadOutageSurface.tsx',
		'src/components/faculty-assignments/CoverShortageDialog.tsx',
		'src/hooks/useCoverShortage.ts',
		'src/hooks/useTeachingLoadOutage.ts',
	]) {
		const source = code(path);
		assert.doesNotMatch(
			source,
			/Needs a department|Set department|teach outside department|canTeachOutsideDepartment/i,
			`${path} must not add a department-setting or outside-department control`,
		);
	}
	// The `30 h / 40 h / leave open` options are the WHOLE decision the dialog
	// offers, and the outside-department one is a recorded follow-up row.
	const options = code('src/components/faculty-assignments/teachingLoadOutage.ts');
	assert.equal(
		(options.match(/id: '(standard-30|stretch-40|leave-open)'/g) ?? []).length,
		3,
		'the cover dialog offers exactly the three options the packet names, and no fourth',
	);
});

// ─────────────────────────────────────────── S10 — §8 primitives

test('A6C5-S10-1 the new outage controls are @/ui primitives, never raw HTML', () => {
	for (const path of [
		'src/components/faculty-assignments/TeachingLoadShortageLine.tsx',
		'src/components/faculty-assignments/TeachingLoadOutageSurface.tsx',
		'src/components/faculty-assignments/CoverShortageDialog.tsx',
	]) {
		const source = code(path);
		assert.doesNotMatch(source, /<button[\s>]/, `${path} must not use a raw <button> (AGENTS.md §8)`);
		assert.doesNotMatch(source, /<select[\s>]/, `${path} must not use a native <select> (AGENTS.md §8)`);
		assert.doesNotMatch(source, /<details[\s>]/, `${path} must not use a raw <details> (AGENTS.md §8)`);
		assert.doesNotMatch(source, /\stitle=/, `${path} must not use a title attribute (AGENTS.md §8)`);
		assert.doesNotMatch(source, /HoverCard/, `${path} must not import HoverCard — it does not exist`);
	}
	// The line's one action is the shared `@/ui` Button at the row-2 chrome, not a
	// local variant.
	const line = code('src/components/faculty-assignments/TeachingLoadShortageLine.tsx');
	assert.match(line, /from '@\/ui\/button'/, 'the shortage line\'s control is a @/ui primitive');
	assert.match(line, /h-7 shrink-0 gap-1\.5 px-2\.5 text-xs/, 'the control carries the shared row-2 chrome');
});

test('A6C5-S10-2 nothing reachable on the outage surface says `Guided`', () => {
	for (const path of [
		'src/components/faculty-assignments/WorkspaceToolbar.tsx',
		'src/components/faculty-assignments/TeachingLoadShortageLine.tsx',
		'src/components/faculty-assignments/CoverShortageDialog.tsx',
		'src/components/faculty-assignments/TeachingLoadOutageSurface.tsx',
	]) {
		assert.doesNotMatch(code(path), /Guided/, `${path} must carry no user-visible \`Guided\` string`);
	}
	// The page keeps the identifier (and the two accepted controls that import
	// it), and the only literal the page renders from it is the empty-year
	// message — so `Guided` reaches no rendered string on the route.
	assert.match(
		read('src/pages/TeachingLoad.tsx'),
		/setDraftStatusMessage\(buildGuidedEmptyTeachingLoadMessage\(/,
		'the page must keep calling the identifier the packet told us not to rename',
	);
	assert.doesNotMatch(
		code('src/pages/TeachingLoad.tsx').split('buildGuidedEmptyTeachingLoadMessage').join(''),
		/\bGuided\b/,
		'nothing on the page mentions `Guided` except the identifier the packet kept',
	);
	assert.match(
		read('src/lib/faculty-assignment-helpers.ts'),
		/export function buildGuidedEmptyTeachingLoadMessage/,
		'`buildGuidedEmptyTeachingLoadMessage` must survive — it is not user-visible',
	);
});
