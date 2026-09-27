/**
 * A3-TEACHING-LOAD-REVIEW-C2 — the dead `Review teachers` control.
 *
 * Split out of `a3-teachers-load-c3.test.tsx`. The two `test()` registrations
 * in this block CANNOT coexist with that file's 33 in one `tsx --test` module:
 * registered together they crash the whole module at load with a `RangeError`
 * before any test runs (0 tests complete, exit 1). The fault is in the
 * REGISTRATIONS, not in these assertions, and it is already isolated — guarding
 * both behind an env flag made the module exit 0 with no RangeError, while the
 * assertion bodies themselves are sound. So isolation is the fix, and the
 * JSDOM harness below is reproduced self-contained rather than imported from
 * the sibling file.
 *
 * The control bodies are byte-identical to the block they came from. Nothing
 * was reworded, weakened, or dropped; the C2-2 source assertions still read
 * the real page and the real opener. See the `SUPERSEDED IN BEHAVIOUR` note in
 * F26-2 for why the shape-only control there let a labelled button ship dead.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { Fragment, act, createElement, useState } from 'react';
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
// The real bottom bar. C2-1 renders it beside the real repair-queue banner so
// the page's two controls sharing the label `Review teachers` are in one tree.
const { TeachingLoadInspectorTriggers } = await import('@/components/faculty-assignments/TeachingLoadInspectorTriggers');

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

/* ───────────────── A3 correction 2 — the dead `Review teachers` control ────── */

/**
 * The single production opener behind every control labelled `Review teachers`.
 *
 * Imported defensively so this control RUNS (and fails on an assertion) on a
 * revision that does not have it, rather than dying on a module-load error: a
 * control that cannot run is not a control.
 */
let teacherReviewEntry: any = null;
let teacherReviewEntryError: string | null = null;
try {
	teacherReviewEntry = await import('@/components/faculty-assignments/teacherReviewEntry');
} catch (error) {
	teacherReviewEntryError = String(error);
}
const { TeachingLoadRepairQueue } = await import('@/components/faculty-assignments/TeachingLoadRepairQueue');
const { ReviewTeachersModal } = await import('@/components/faculty-assignments/ReviewTeachersModal');
const { useTeachingLoadRepairQueue } = await import('@/hooks/useTeachingLoadRepairQueue');

const REVIEW_TITLE = 'Teacher workload: Dela Cruz, Maria';

/**
 * The real page wiring, minus the page's data layer: the real
 * `useTeachingLoadRepairQueue` (so the banner's primary action is production
 * code), the real `TeachingLoadRepairQueue` banner, the real
 * `TeachingLoadInspectorTriggers` bottom bar, the real `openTeacherReview` bound
 * to BOTH, and the real `ReviewTeachersModal` driven by the one `open` flag.
 *
 * `FACULTY` has a non-zero load and no placeholders, so the queue resolves to its
 * single `review-ready` item, whose `actionLabel` is the literal
 * `Review teachers` — the label the live surface showed on the dead control.
 */
function TeachingLoadReviewHost() {
	const [viewMode, setViewMode] = useState<'teacher' | 'allocation'>('teacher');
	const [reviewModalOpen, setReviewModalOpen] = useState(false);
	const [advancedGridVisible, setAdvancedGridVisible] = useState(true);
	const open = () => teacherReviewEntry.openTeacherReview({ setViewMode, setReviewModalOpen });
	const queue = useTeachingLoadRepairQueue({
		searchParams: new URLSearchParams(),
		setSearchParams: () => {},
		faculty: [FACULTY],
		effectiveAssignmentsByFaculty: { 9: [{ subjectId: 1, weeklyHours: 4 }] },
		activeDraftCount: 0,
		isReadOnlyMode: false,
		selectedId: 9,
		coverageAssigned: 1,
		coverageTotal: 1,
		coverageUnassigned: 0,
		writeBlockedReason: null,
		onSelectFaculty: () => {},
		onSave: () => {},
		onShowSubjectCoverage: () => {},
		onShowTeachersWithoutLoad: () => {},
		onShowOverloaded: () => {},
		onShowPlaceholder: () => {},
		onOpenReview: open,
		setAdvancedGridVisible,
	});
	return createElement(
		Fragment,
		null,
		createElement(TeachingLoadRepairQueue as any, {
			items: queue.repairQueueItems,
			activeItemId: queue.activeRepairId,
			isReadOnly: false,
			saving: false,
			advancedGridVisible: true,
			onPrimaryAction: queue.handleRepairPrimaryAction,
		}),
		createElement(TeachingLoadInspectorTriggers as any, {
			visible: true,
			onOpenMobile: () => {},
			onOpenReview: open,
		}),
		createElement(
			ReviewTeachersModal as any,
			{ open: reviewModalOpen, onOpenChange: setReviewModalOpen, title: REVIEW_TITLE, description: 'desc' },
			createElement('div', null, 'inspector body'),
		),
	);
}

test('C2-1 every control labelled `Review teachers` actually opens the review dialog', (t) => {
	assert.equal(
		teacherReviewEntryError,
		null,
		`the single production opener must exist and be importable: ${teacherReviewEntryError}`,
	);
	assert.equal(typeof teacherReviewEntry.openTeacherReview, 'function');

	const host = render(createElement(TeachingLoadReviewHost as any));
	// Count by LABEL, not by test id: the defect was two controls sharing one
	// label, so a control that enumerated known test ids would miss a third.
	const labelled = buttonsIn(host).filter((b) => (b.textContent ?? '').trim() === 'Review teachers');
	const found = labelled.length;
	const testIds = labelled.map((b) => b.getAttribute('data-testid') ?? '(no test id)');
	t.diagnostic(`controls labelled "Review teachers": found ${found} -> [${testIds.join(', ')}]; wired to the production opener: ${found}`);
	assert.ok(
		found >= 2,
		`the page must expose both the Next Step banner and the bottom bar under this label, found ${found}: [${testIds.join(', ')}]`,
	);
	assert.deepEqual(
		[...new Set(testIds)].sort(),
		['teaching-load-repair-review', 'teaching-load-review-open'],
		'the two controls found must be the banner and the bottom bar',
	);

	// Each control is exercised in its OWN render, so a dialog opened by the
	// previous iteration can never be mistaken for this one.
	for (const testId of testIds) {
		const fresh = render(createElement(TeachingLoadReviewHost as any));
		const control = fresh.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement | null;
		assert.ok(control, `control ${testId} must render`);
		assert.equal(
			dom.window.document.querySelector('[role="dialog"]'),
			null,
			`precondition: no dialog may exist before ${testId} is clicked`,
		);
		click(control);
		const dialog = dom.window.document.querySelector('[role="dialog"]');
		assert.ok(
			dialog,
			`the control labelled "Review teachers" at ${testId} opened NO dialog — a labelled control that does nothing`,
		);
		assert.match(
			(dialog as HTMLElement).textContent ?? '',
			new RegExp(REVIEW_TITLE),
			`${testId} must open the teacher review dialog, not some other dialog`,
		);
	}
});

test('C2-2 both `onOpenReview` sites in the page bind the one production opener', () => {
	const page = read('src/pages/TeachingLoad.tsx');
	// The pre-fix banner binding: it set a view mode that was already `teacher`,
	// so the click took focus and opened nothing.
	assert.doesNotMatch(
		page,
		/onOpenReview: \(\) => ui\.setViewMode\('teacher'\)/,
		'the dead banner binding must be gone',
	);
	assert.doesNotMatch(
		page,
		/onOpenReview=\{\(\) => setReviewModalOpen\(true\)\}/,
		'the bottom bar must share the same opener rather than keeping a private one',
	);
	const bound = page.match(/openTeacherReview\(\{ setViewMode: ui\.setViewMode, setReviewModalOpen \}\)/g) ?? [];
	assert.equal(
		bound.length,
		2,
		`both onOpenReview sites must bind the one opener, found ${bound.length}`,
	);
	assert.match(page, /import \{ openTeacherReview \} from '@\/components\/faculty-assignments\/teacherReviewEntry';/);

	// And the opener itself must open the dialog, not merely switch a view.
	const opener = read('src/components/faculty-assignments/teacherReviewEntry.ts');
	assert.match(opener, /setViewMode\('teacher'\)/);
	assert.match(opener, /setReviewModalOpen\(true\)/);

	// The hook half of the chain: the banner's primary action must reach the opener.
	const hook = read('src/hooks/useTeachingLoadRepairQueue.ts');
	assert.match(
		hook,
		/else onOpenReview\(\);/,
		'the review-ready primary action must call the shared opener',
	);
});
