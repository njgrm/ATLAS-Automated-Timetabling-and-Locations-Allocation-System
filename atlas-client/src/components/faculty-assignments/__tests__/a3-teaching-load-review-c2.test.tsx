/**
 * A3-TEACHING-LOAD-REVIEW-C2 — the dead `Review teachers` control.
 *
 * Split out of `a3-teachers-load-c3.test.tsx`, where these two `test()`
 * registrations crash the whole module at load with a `RangeError` before any
 * test runs (0 tests complete, exit 1). That module-load crash is real and it
 * is why this file exists, but it is NOT the fault described below — the two
 * were separate, and conflating them sent one diagnosis down a dead end.
 *
 * There were two faults, and isolating the registrations only exposed the second:
 *
 * 1. MODULE LOAD. Registering these two tests alongside the sibling file's 33
 *    crashes the module before any test runs. Isolating them into this file
 *    removes it, so the sibling's 33 controls now actually execute. The
 *    registration collision is a genuine, self-contained reason for the split.
 *
 * 2. THE C2-1 PRECONDITION (fixed in `52b8da25`). The isolation did not make
 *    C2-1 pass. `render()` appends to the shared `document.body` and unmounted
 *    only in `afterEach`, so iteration 2's "no dialog may exist" precondition
 *    correctly FAILED on iteration 1's still-mounted dialog. `assert.equal` from
 *    `node:assert/strict` is `strictEqual`, whose failure path runs `myersDiff`
 *    over `util.inspect` of both operands; handed a live attached Radix dialog
 *    subtree instead of `null`, that diff is unbounded. Measured here: RSS
 *    320 MiB -> 9.4 GiB, `heapUsed` flat at 133 MiB, `arrayBuffers` flat at
 *    12 MiB, ending in `RangeError: Array buffer allocation failed` — which
 *    reads exactly like a product defect and is not one. Composition bisect
 *    cleared every candidate component (worst case 342 MiB with three roots and
 *    two clicks, both dialogs opening correctly), and a V8 tick profile put
 *    75% of `node.exe` samples in `ArrayPrototypeSort` under `util.inspect` and
 *    28% of all samples in `myersDiff`. Production components are correct.
 *
 * The fix realises the isolation the loop comment already claimed: a per-
 * iteration `teardown()`, and a precondition asserted on a boolean so it can
 * only fail with a readable `false !== true` that NAMES the stray element.
 * The control's meaning is unchanged. See the `SUPERSEDED IN BEHAVIOUR` note in
 * F26-2 for why the shape-only control there let a labelled button ship dead.
 *
 * 3. THE HARNESS INITIAL STATE (fixed here). C2-1 proved each control OPENS a
 *    dialog. Nothing proved a control changes the VIEW MODE, and the host made
 *    that unobservable rather than merely unpinned: it started at
 *    `useState('teacher')` — precisely the state that hid the original defect.
 *    `openTeacherReview` calls `setViewMode('teacher')`, so a host already in
 *    `teacher` cannot distinguish a working view-mode switch from a missing
 *    one, and the banner's dead `setViewMode('teacher')` looked correct under
 *    it. The harness reproduced the very trap it exists to catch.
 *    Independent QA of `d9575e83..c4a9960e` recorded the added
 *    `setViewMode('teacher')` as an accepted NON_BLOCKING residual precisely
 *    because no control pinned it; this fault is why none could.
 *
 *    The host now starts at `allocation` and publishes its live mode as
 *    `[data-testid="host-view-mode"]`, so C2-3's `allocation` precondition is
 *    itself the guard: had the host kept the old initial state, C2-3 would fail
 *    on its precondition instead of passing vacuously.
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

/**
 * Unmount every root this module mounted and empty the shared JSDOM body.
 *
 * Called from `afterEach` AND from the top of each C2-1 iteration. `render()`
 * appends a NEW host div to the SAME `document.body`, so a fresh render is not
 * a fresh document: without a per-iteration teardown the previous iteration's
 * dialog is still mounted when the next one asserts its precondition, the
 * precondition correctly fails, and the failure is then reported by handing a
 * live Radix dialog subtree to `assert.equal` — see the `C2-1 ISOLATION` note
 * in the loop below for what that costs.
 */
function teardown() {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
	dom.window.document.body.removeAttribute('style');
}
afterEach(teardown);

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
	// The host must start OFF the teacher view. `openTeacherReview` calls
	// `setViewMode('teacher')`, so a host already in `teacher` cannot tell a
	// working view-mode switch from a missing one — the very state in which the
	// original banner handler set the mode it already had and looked correct.
	// C2-3's `allocation` precondition below is only meaningful because of this.
	const [viewMode, setViewMode] = useState<'teacher' | 'allocation'>('allocation');
	const [reviewModalOpen, setReviewModalOpen] = useState(false);
	const [advancedGridVisible, setAdvancedGridVisible] = useState(true);
	const open = () => teacherReviewEntry.openTeacherReview({ setViewMode, setReviewModalOpen });
	const queue = useTeachingLoadRepairQueue({
		searchParams: new URLSearchParams(),
		setSearchParams: () => {},
		faculty: [FACULTY],
		effectiveAssignmentsByFaculty: { 9: [{ subjectId: 1, sectionIds: [1], gradeLevels: [7] }] },
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
		// A `div`, not a `button`: publishing the live mode this way cannot
		// disturb C2-1's label-based discovery, which enumerates `button`
		// elements only. Verified by running the suite, not by reasoning.
		createElement('div', { 'data-testid': 'host-view-mode' }, viewMode),
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
	//
	// C2-1 ISOLATION: "its OWN render" was not enough, and the two halves below
	// are what make the claim true. `render()` appends to the shared
	// `document.body`, so without the teardown the previous root stays mounted
	// and its dialog stays in the document.
	for (const testId of testIds) {
		teardown();
		const fresh = render(createElement(TeachingLoadReviewHost as any));
		const control = fresh.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement | null;
		assert.ok(control, `control ${testId} must render`);

		// Assert on a SCALAR, never on the node. `assert.equal` from
		// `node:assert/strict` is `strictEqual`, and a failing `strictEqual`
		// builds its `AssertionError` by running `myersDiff` over
		// `util.inspect` of BOTH operands. Handing it an attached Radix dialog
		// subtree rather than `null` makes that diff unbounded: measured on this
		// host it drove RSS 320 MiB -> 9.4 GiB with `heapUsed` flat at 133 MiB
		// and `arrayBuffers` flat at 12 MiB, ending in `RangeError: Array buffer
		// allocation failed` — which reads as a product defect and is not one.
		// A V8 tick profile put 75% of `node.exe` samples in
		// `ArrayPrototypeSort` under `util.inspect` and 28% of all samples in
		// `myersDiff`. The control keeps its exact meaning — "no dialog may
		// exist before this control is clicked" — and can now only fail with a
		// readable `false !== true`.
		const strayDialog = dom.window.document.querySelector('[role="dialog"]');
		assert.equal(
			strayDialog === null,
			true,
			`precondition: no dialog may exist before ${testId} is clicked; found ${strayDialog?.getAttribute('data-testid') ?? '(untagged dialog)'}`,
		);
		t.diagnostic(`${testId}: precondition clean — no [role="dialog"] in the document before the click`);

		click(control);
		const dialog = dom.window.document.querySelector('[role="dialog"]');
		assert.ok(
			dialog,
			`the control labelled "Review teachers" at ${testId} opened NO dialog — a labelled control that does nothing`,
		);
		t.diagnostic(`${testId}: opened ${dialog.getAttribute('data-testid') ?? '(untagged dialog)'}`);
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

/* ───────────────── A3 correction 3 — the unpinned view-mode effect ────── */

/**
 * Each `Review teachers` control must ALSO drive the view mode to `teacher`.
 *
 * Independent QA of `d9575e83..c4a9960e` accepted the bottom bar's added
 * `setViewMode('teacher')` as a NON_BLOCKING residual: it is a behaviour change
 * beyond the minimum fix and no control pinned it. C2-1 could not, because the
 * host started in `teacher` — the mode the original dead banner handler
 * redundantly re-set, which is exactly why that handler looked fine. The host
 * now starts in `allocation` (see fault 3 in the file header) and publishes its
 * live mode, so a click's view-mode effect is observable.
 *
 * Additive to C2-1 and C2-2, which are unchanged: this asserts the view-mode
 * half of the same opener, not a replacement for the dialog assertion.
 *
 * Both controls are exercised, each from a clean document via the existing
 * per-iteration `teardown()`.
 */
test('C2-3 every control labelled `Review teachers` drives the view mode to `teacher`', (t) => {
	assert.equal(
		teacherReviewEntryError,
		null,
		`the single production opener must exist and be importable: ${teacherReviewEntryError}`,
	);
	assert.equal(typeof teacherReviewEntry.openTeacherReview, 'function');

	const host = render(createElement(TeachingLoadReviewHost as any));
	// Enumerated by LABEL, for the same reason as C2-1: the defect was two
	// controls sharing one label, so a control keyed on known test ids would
	// miss a third.
	const labelled = buttonsIn(host).filter((b) => (b.textContent ?? '').trim() === 'Review teachers');
	const testIds = labelled.map((b) => b.getAttribute('data-testid') ?? '(no test id)');
	assert.ok(
		labelled.length >= 2,
		`the page must expose both the Next Step banner and the bottom bar under this label, found ${labelled.length}: [${testIds.join(', ')}]`,
	);
	assert.deepEqual(
		[...new Set(testIds)].sort(),
		['teaching-load-repair-review', 'teaching-load-review-open'],
		'the two controls found must be the banner and the bottom bar',
	);

	for (const testId of testIds) {
		teardown();
		const fresh = render(createElement(TeachingLoadReviewHost as any));
		const control = fresh.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement | null;
		assert.ok(control, `control ${testId} must render`);

		// Preconditions, in the same order C2-1 uses: a clean document, and the
		// host demonstrably NOT already in the teacher view. The second is the
		// load-bearing one — without it this control would pass vacuously.
		const strayDialog = dom.window.document.querySelector('[role="dialog"]');
		assert.equal(
			strayDialog === null,
			true,
			`precondition: no dialog may exist before ${testId} is clicked; found ${strayDialog?.getAttribute('data-testid') ?? '(untagged dialog)'}`,
		);
		const probe = fresh.querySelector('[data-testid="host-view-mode"]');
		assert.ok(probe, `the host must publish its live view mode for ${testId}`);
		const before = (probe.textContent ?? '').trim();
		assert.equal(
			before,
			'allocation',
			`precondition: the host must start OFF the teacher view before ${testId} is clicked, otherwise a view-mode effect is unobservable; found "${before}"`,
		);
		t.diagnostic(`${testId}: precondition clean — no [role="dialog"], and view mode starts "${before}"`);

		click(control);

		// Read the SCALAR, never the node, for the same reason C2-1 does: a
		// failing `assert.equal` (`strictEqual`) runs `myersDiff` over
		// `util.inspect` of both operands, which is unbounded if one operand is
		// a live attached DOM subtree. `textContent` yields a short string.
		const after = fresh.querySelector('[data-testid="host-view-mode"]');
		assert.ok(after, `the host must still publish its live view mode after ${testId} is clicked`);
		const mode = (after.textContent ?? '').trim();
		assert.equal(
			mode,
			'teacher',
			`the control labelled "Review teachers" at ${testId} did NOT drive the view mode to "teacher" — it left it at "${mode}"`,
		);
		t.diagnostic(`${testId}: view mode "${before}" -> "${mode}"`);
	}
});
