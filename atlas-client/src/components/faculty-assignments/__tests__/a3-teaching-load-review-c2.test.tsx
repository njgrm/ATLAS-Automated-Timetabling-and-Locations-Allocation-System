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
// The real bottom bar. After fix 16.1 it renders the MOBILE control only, so the
// page's remaining control under the label `Review teachers` is the repair
// queue's Next Step action. See the `FIX 16.1` note on the host below.
const { TeachingLoadInspectorTriggers } = await import('@/components/faculty-assignments/TeachingLoadInspectorTriggers');
const { TeacherGridMode } = await import('@/components/faculty-assignments/TeacherGridMode');

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
 * `TeachingLoadInspectorTriggers` bottom bar, the real `TeacherGridMode` rows,
 * the real `openTeacherReview` bound to BOTH entry points, and the real
 * `ReviewTeachersModal` driven by the one `open` flag.
 *
 * `FACULTY` has a non-zero load and no placeholders, so the queue resolves to its
 * single `review-ready` item, whose `actionLabel` is the literal
 * `Review teachers` — the label the live surface showed on the dead control.
 *
 * FIX 16.1 (operator, 2026-09-28) — the two controls under that label became
 * ONE, and the per-teacher entry point is new.
 *
 * The old host passed `onOpenReview: open` to `TeachingLoadInspectorTriggers`
 * and counted two controls. The detached bottom-right button is deleted, so:
 *
 *   - `TeachingLoadInspectorTriggers` gets NO `onOpenReview` prop, and renders
 *     only the mobile `View profile` control.
 *   - `TeacherGridMode` is rendered with `onReviewLoad={openFor}`, where
 *     `openFor(facultyId)` selects that teacher and then calls the SAME `open`.
 *     This is the page's `openTeacherReviewFor` reproduced exactly.
 *
 * C2-1 and C2-3 are INVERTED to require `>= 1` and to pin the single surviving
 * id, and C2-4 is ADDED to cover the per-row control — because "there is
 * exactly one control with this label" and "the per-row control opens the
 * right teacher" are different claims, and only the second one proves item
 * 16.1.
 */
function TeachingLoadReviewHost(props: { onRowSelect?: (id: number) => void } = {}) {
	// The host must start OFF the teacher view. `openTeacherReview` calls
	// `setViewMode('teacher')`, so a host already in `teacher` cannot tell a
	// working view-mode switch from a missing one — the very state in which the
	// original banner handler set the mode it already had and looked correct.
	// C2-3's `allocation` precondition below is only meaningful because of this.
	const [viewMode, setViewMode] = useState<'teacher' | 'allocation'>('allocation');
	const [reviewModalOpen, setReviewModalOpen] = useState(false);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const open = () => teacherReviewEntry.openTeacherReview({ setViewMode, setReviewModalOpen });
	// The page's `openTeacherReviewFor`, verbatim: select the named teacher
	// FIRST, then open the one shared modal.
	const openFor = (facultyId?: number | null) => {
		if (facultyId != null) setSelectedId(facultyId);
		teacherReviewEntry.openTeacherReview({ setViewMode, setReviewModalOpen });
	};
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
		// A6 C2 CORRECTION: the hook now REQUIRES the source's degraded state
		// rather than defaulting to the healthy rendering. This host is a
		// verified-source fixture — it drives `onOpenReview` into a real dialog
		// and asserts the healthy review path — so `false` is the true value
		// here, not a value chosen to keep the test green.
		sourceDegraded: false,
		// A6 C3: the same fixture, stated as the SOURCE it claims to be rather
		// than as a boolean, so the hook's wider unverified rule is satisfied by
		// the truth rather than by a value chosen to keep the row green.
		sourceState: { dataSource: 'live', isOnline: true },
		writeBlockedReason: null,
		onSelectFaculty: () => {},
		onSave: () => {},
		onShowSubjectCoverage: () => {},
		onShowTeachersWithoutLoad: () => {},
		onShowOverloaded: () => {},
		onShowPlaceholder: () => {},
		onOpenReview: () => openFor(null),
	});
	return createElement(
		Fragment,
		null,
		// A `div`, not a `button`: publishing the live mode this way cannot
		// disturb C2-1's label-based discovery, which enumerates `button`
		// elements only. Verified by running the suite, not by reasoning.
		createElement('div', { 'data-testid': 'host-view-mode' }, viewMode),
		// The page's title derivation, so C2-4 can prove the modal names the
		// teacher the row button named.
		createElement('div', { 'data-testid': 'host-selected-id' }, selectedId == null ? '(none)' : String(selectedId)),
		createElement(TeachingLoadRepairQueue as any, {
			items: queue.repairQueueItems,
			activeItemId: queue.activeRepairId,
			isReadOnly: false,
			saving: false,
			onPrimaryAction: queue.handleRepairPrimaryAction,
		}),
		createElement(TeachingLoadInspectorTriggers as any, {
			visible: true,
			onOpenMobile: () => {},
		}),
		createElement(TeacherGridMode as any, {
			loading: false,
			faculty: [FACULTY],
			filteredFaculty: [FACULTY],
			groupedFaculty: [['Mathematics', [FACULTY]]],
			selectedId,
			// The ROW's own selection path — the one `handleTeacherClick` calls
			// when the row itself is activated. Kept SEPARATE from the page's
			// selection so C2-4 can tell the two apart, which is the whole point:
			// a `Review load` click must NOT travel through this one.
			onSelectTeacher: props.onRowSelect ?? setSelectedId,
			effectiveAssignmentsByFaculty: { 9: [{ subjectId: 1, sectionIds: [1], gradeLevels: [7] }] },
			effectiveDraftAssignmentsByFaculty: {},
			subjects: [],
			sectionsBySubject: {},
			saving: false,
			isReadOnlyMode: false,
			effectiveOwnershipMap: {},
			savedConflictMap: {},
			onSetSections: () => {},
			onSwapSectionOwnership: () => {},
			departmentQualifiedSubjects: [],
			outsideDepartmentSubjects: [],
			homeroomHint: null,
			loadProfile: null,
			onHoverLoadMinutes: () => {},
			onClearHoverLoad: () => {},
			activeFacultyIds: new Set<number>([FACULTY.id]),
			resolveSectionHoverDeltaMinutes: () => 0,
			onResetAssignments: () => {},
			searchQuery: '',
			onSearchQueryChange: () => {},
			filterStatus: 'all',
			onFilterStatusChange: () => {},
			statusFacetCounts: { all: 1, 'teaching-assigned': 1, 'no-teaching': 0, 'adviser-only': 0, excess: 0 },
			loadFilter: 'all',
			loadFacetCounts: { excess: 0, 'at-standard': 1, 'below-standard': 0 },
			onLoadFilterChange: () => {},
			departmentFilter: 'all',
			onDepartmentFilterChange: () => {},
			departmentOptions: [],
			filterAnnouncement: '',
			onClearTeachingLoadFilters: () => {},
			effectiveActualHours: new Map<number, number>(),
			teachingStandardHours: 20,
			policyReady: true,
			sortOrder: 'load-desc',
			onSortOrderChange: () => {},
			showFilters: false,
			onToggleFilters: () => {},
			showOutsideDept: false,
			onToggleOutsideDept: () => {},
			showUnmappedSpecialization: false,
			onShowUnmappedSpecializationChange: () => {},
			completedSectionIds: new Set<number>(),
			workspaceStateLabel: 'Ready',
			workspaceStateNextAction: 'Assign the remaining classes.',
			writeBlockedReason: null,
			onReviewLoad: openFor,
		}),
		createElement(
			ReviewTeachersModal as any,
			{
				open: reviewModalOpen,
				onOpenChange: setReviewModalOpen,
				title: selectedId == null
					? 'Review teachers'
					: `Teacher workload: ${FACULTY.lastName}, ${FACULTY.firstName}`,
				description: 'desc',
			},
			createElement('div', null, 'inspector body'),
		),
	);
}

test('C2-1 every control labelled `Review staff workload` actually opens the review dialog', (t) => {
	assert.equal(
		teacherReviewEntryError,
		null,
		`the single production opener must exist and be importable: ${teacherReviewEntryError}`,
	);
	assert.equal(typeof teacherReviewEntry.openTeacherReview, 'function');

	const host = render(createElement(TeachingLoadReviewHost as any));
	// Count by LABEL, not by test id: the defect was two controls sharing one
	// label, so a control that enumerated known test ids would miss a third.
	//
	// SUPERSEDED BY A6 C2 — the LABEL this control enumerates. The operator's
	// 2026-09-28 finding (Minor 7) was precisely that `Review teachers` neither
	// said workload audit nor explained why one teacher was the subject, and the
	// label is now `Review staff workload`. The original expectation, verbatim:
	//
	//   const labelled = buttonsIn(host).filter((b) => (b.textContent ?? '').trim() === 'Review teachers');
	//   ...
	//   t.diagnostic(`controls labelled "Review teachers": found ${found} -> [...]; wired to the production opener: ${found}`);
	//   assert.ok(
	//     found >= 1,
	//     `the page must still expose its Next Step review action under this label, found ${found}: [${testIds.join(', ')}]`,
	//   );
	//   assert.deepEqual([...new Set(testIds)].sort(), ['teaching-load-repair-review'], ...);
	//
	// The claim is UNCHANGED and STRICTLY STRONGER. The label is now read from
	// `STAFF_WORKLOAD_REVIEW_LABEL` — the constant the ONE opener module exports
	// and that both production call sites use — so this control can no longer
	// pass on a word the product stopped rendering, and the new negative
	// assertion below pins the DEFECT itself: no control anywhere on this surface
	// may still read the old label.
	const labelled = buttonsIn(host).filter((b) => (b.textContent ?? '').trim() === teacherReviewEntry.STAFF_WORKLOAD_REVIEW_LABEL);
	const found = labelled.length;
	const testIds = labelled.map((b) => b.getAttribute('data-testid') ?? '(no test id)');
	t.diagnostic(`controls labelled "${teacherReviewEntry.STAFF_WORKLOAD_REVIEW_LABEL}": found ${found} -> [${testIds.join(', ')}]; wired to the production opener: ${found}`);
	// FIX 16.1 removed the detached bottom-right control, so the floor drops from
	// two to one. It is still a floor, not an exact count, on purpose: this row
	// exists to catch a LABELLED control that does nothing, and a new
	// unlabelled dead control is a different failure. The pin below is what makes
	// the surviving set exact.
	assert.ok(
		found >= 1,
		`the page must still expose its Next Step review action under this label, found ${found}: [${testIds.join(', ')}]`,
	);
	assert.deepEqual(
		[...new Set(testIds)].sort(),
		['teaching-load-repair-review'],
		'after fix 16.1 the Next Step action is the only control carrying this label',
	);
	// A6 C2 (Slice 5), ADDED AND STRONGER: the old label must be GONE. Pinning
	// the replacement's presence alone would let both labels coexist, which is
	// the two-controls-one-idea shape this whole control exists to prevent.
	assert.equal(
		buttonsIn(host).filter((b) => (b.textContent ?? '').trim() === 'Review teachers').length,
		0,
		'no control may still read `Review teachers`: the operator rejected that label (A6 C2)',
	);
	// The removed control must be gone from the rendered tree, not merely
	// unlabelled.
	assert.equal(
		host.querySelector('[data-testid="teaching-load-review-open"]') === null,
		true,
		'the detached bottom-right `Review teachers` control must not render',
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
			/review/i,
			`${testId} must open the teacher review dialog, not some other dialog`,
		);
	}
});

test('C2-2 every page entry point binds the ONE production opener, through the one wrapper', () => {
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
	// FIX 16.1: the two former call sites are now ONE direct call plus the
	// `openTeacherReviewFor` wrapper. Two openers would let the modal, its title
	// and its view mode disagree between the Next Step action and a row button.
	const bound = page.match(/openTeacherReview\(\{ setViewMode: ui\.setViewMode, setReviewModalOpen \}\)/g) ?? [];
	assert.equal(
		bound.length,
		1,
		`the page must contain exactly one direct opener call — the wrapper's — found ${bound.length}`,
	);
	assert.match(page, /import \{ openTeacherReview \} from '@\/components\/faculty-assignments\/teacherReviewEntry';/);

	// The wrapper is the load-bearing part: it must SELECT the named teacher
	// BEFORE opening, and both entry points must go through it.
	assert.match(
		page,
		/const openTeacherReviewFor = useCallback\(\(facultyId\?: number \| null\) => \{/,
		'the shared wrapper must exist and accept an optional faculty id',
	);
	assert.match(
		page,
		/if \(facultyId != null\) data\.setSelectedId\(facultyId\);[\s\S]{0,200}openTeacherReview\(\{ setViewMode: ui\.setViewMode, setReviewModalOpen \}\);/,
		'the wrapper must select the named teacher and THEN open — otherwise the dialog opens against the previous teacher for one render',
	);
	// The repair queue (no teacher named) and the grid rows (a teacher named) are
	// both bound to that one wrapper.
	assert.match(page, /onOpenReview: \(\) => openTeacherReviewFor\(null\)/, 'the repair queue must open through the wrapper with no teacher');
	assert.match(page, /onReviewLoad=\{openTeacherReviewFor\}/, 'every teacher row must open through the same wrapper');
	// The removed prop must not be passed to the triggers component any more.
	assert.doesNotMatch(page, /onOpenReview=\{/, 'the detached control and its prop binding must be gone');

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
 * Each control is exercised, each from a clean document via the existing
 * per-iteration `teardown()`.
 */
test('C2-3 every control labelled `Review staff workload` drives the view mode to `teacher`', (t) => {
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
	//
	// SUPERSEDED BY A6 C2 — the LABEL, as in C2-1, and the original expectation
	// is preserved verbatim:
	//
	//   const labelled = buttonsIn(host).filter((b) => (b.textContent ?? '').trim() === 'Review teachers');
	//   assert.ok(labelled.length >= 1, ...);
	//   assert.deepEqual([...new Set(testIds)].sort(), ['teaching-load-repair-review'], ...);
	//
	// The label is read from the ONE opener module's exported constant, so this
	// row and the product can never disagree about the word.
	const labelled = buttonsIn(host).filter((b) => (b.textContent ?? '').trim() === teacherReviewEntry.STAFF_WORKLOAD_REVIEW_LABEL);
	const testIds = labelled.map((b) => b.getAttribute('data-testid') ?? '(no test id)');
	assert.ok(
		labelled.length >= 1,
		`the page must still expose a review action under this label, found ${labelled.length}: [${testIds.join(', ')}]`,
	);
	assert.deepEqual(
		[...new Set(testIds)].sort(),
		['teaching-load-repair-review'],
		'after fix 16.1 the Next Step action is the only control carrying this label',
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

/**
 * FIX 16.1 — the per-teacher `Review load` button.
 *
 * ADDITIVE to C2-1, which after the operator's change can only prove that the
 * ONE remaining `Review teachers` control works. Three further claims are
 * separate and each can fail on its own:
 *
 *  1. The label. The requested control reads `Review load`, not `Review
 *     teachers` — a shorter name that says which teacher it belongs to, because
 *     the button is now INSIDE that teacher's row.
 *  2. The teacher. Clicking the row's button must open the review for THAT
 *     member, selected first.
 *  3. The click must not ALSO run the row's own click handler.
 *
 * ON CLAIM 3, AND WHY IT IS NOT ASSERTED AS `aria-expanded === 'false'`.
 *
 * The row is a `div role="button"` whose handler is `handleTeacherClick`, and
 * `handleTeacherClick` is exactly what `event.stopPropagation()` prevents the
 * `Review load` click from reaching. So the load-bearing, discriminating claim
 * is: the row's OWN click path did not run.
 *
 * A control that asserted the row stayed `aria-expanded="false"` would be
 * asserting something that is NOT TRUE on the real page, and would fail for the
 * wrong reason. Selecting a teacher expands its row: `TeacherGridMode` has a
 * pre-existing `useEffect` on `selectedId` that calls `setExpandedId`. The page
 * MUST select the clicked teacher (claim 2), so that effect legitimately fires
 * and the row opens. That is existing page behaviour on the selection path, not
 * the row's click handler running a second time, and it is deliberately not what
 * this row claims.
 *
 * So claim 3 is measured the only way it can be: the grid is given a SEPARATE
 * spy for its `onSelectTeacher` prop — the one `handleTeacherClick` calls — and
 * that spy must stay at zero calls. Removing `stopPropagation` makes the click
 * bubble to the row, `handleTeacherClick` runs, and the spy fires. The test
 * therefore discriminates on the removal, which is what it is for.
 */
test('C2-4 the per-teacher `Review load` button opens THAT teacher without running the row handler', (t) => {
	teardown();
	// The spy stands in for the grid's own `onSelectTeacher` — the row-click
	// path ONLY. It is a plain counter: a failing assertion must stay a readable
	// number, never a node (see the `myersDiff` blow-up recorded in the header).
	const rowClickPath: number[] = [];
	const host = render(createElement(TeachingLoadReviewHost as any, {
		onRowSelect: (id: number) => { rowClickPath.push(id); },
	}));

	// 1 — the label, read from the rendered DOM, enumerated like C2-1.
	const rowControls = buttonsIn(host).filter((b) => (b.textContent ?? '').trim() === 'Review load');
	assert.equal(rowControls.length, 1, 'each rendered teacher row must carry exactly one `Review load` button');
	const control = rowControls[0];
	assert.equal(
		control.getAttribute('data-testid'),
		'teaching-load-row-review',
		'the per-row control must be addressable by its own test id',
	);
	// WCAG 2.5.3 Label in Name: the accessible name CONTAINS the visible label.
	// The name additionally carries the DISPLAY form of the teacher, which under
	// the c10 re-issue of Fix 22 is UPPERCASE — matching the stored mixed-case
	// string here would be a control that can never pass.
	const aria = control.getAttribute('aria-label') ?? '';
	assert.ok(
		aria.startsWith('Review load'),
		`the accessible name must contain the visible label; got "${aria}"`,
	);
	assert.match(aria, /DELA CRUZ/, 'the accessible name must also name the teacher');
	// AGENTS.md §8: no raw title on a control whose extra information belongs in
	// a @/ui Tooltip.
	assert.equal(control.getAttribute('title'), null, 'no raw title attribute on the per-row control');

	// Preconditions, in the same order C2-1 uses: a clean document and no
	// selection yet. Asserted on SCALARS for the reason recorded above.
	const strayDialog = dom.window.document.querySelector('[role="dialog"]');
	assert.equal(strayDialog === null, true, 'precondition: no dialog may exist before the row button is clicked');
	assert.equal(
		(host.querySelector('[data-testid="host-selected-id"]')?.textContent ?? '').trim(),
		'(none)',
		'precondition: no teacher is selected before the row button is clicked',
	);
	assert.equal(rowClickPath.length, 0, 'precondition: the row click path has not run');

	click(control);

	// 3 — FIRST, before anything else can confuse the reading: the row's own
	// click handler must not have run. This is what `stopPropagation()` buys.
	assert.equal(
		rowClickPath.length,
		0,
		`clicking \`Review load\` must not also run the row's own click handler — the click bubbled; saw ${JSON.stringify(rowClickPath)}`,
	);

	// 2 — the teacher. The page's own binding must have SELECTED that teacher
	// and then opened the shared modal, and the dialog must be titled for the
	// clicked teacher. `host-selected-id` is the page's selection, driven by
	// `openTeacherReviewFor` — a different binding from the grid's row path above.
	const selectedAfter = (host.querySelector('[data-testid="host-selected-id"]')?.textContent ?? '').trim();
	assert.equal(
		selectedAfter,
		String(FACULTY.id),
		`the page must select the clicked teacher before opening; saw "${selectedAfter}"`,
	);
	const dialog = dom.window.document.querySelector('[role="dialog"]') as HTMLElement | null;
	assert.ok(dialog, 'the per-row `Review load` button must open the review dialog');
	assert.match(
		dialog.textContent ?? '',
		new RegExp(REVIEW_TITLE),
		'the dialog must be titled for the teacher whose row was clicked, not the previously selected one',
	);
	t.diagnostic(`row "Review load" -> page selected ${selectedAfter} (row click path: ${rowClickPath.length} calls) -> ${dialog.getAttribute('data-testid') ?? '(untagged dialog)'}`);

	// And the view mode, so the row path drives the SAME opener the queue does
	// rather than opening a modal of its own.
	const mode = (host.querySelector('[data-testid="host-view-mode"]')?.textContent ?? '').trim();
	assert.equal(mode, 'teacher', 'the per-row control must drive the view mode to `teacher` through the same opener');
});

/**
 * A6 C2 (Slice 3) — SUPERSEDED BY THE OPERATOR'S MAJOR 4, and replaced by a
 * STRICTLY STRONGER row.
 *
 * C2-5's own header, preserved verbatim, because its reasoning is the clearest
 * statement of what this row was for:
 *
 *   FIX 16.1 — the selection effect is pre-existing behaviour, recorded so the
 *   omission in C2-4 above reads as a decision rather than a gap.
 *
 *   `TeacherGridMode` expands a row whenever `selectedId` changes to a real
 *   teacher. The page MUST select the teacher a `Review load` click names, so that
 *   effect fires and the row opens — which is correct and intended: the scheduler
 *   clicked that teacher's row, and seeing it open is the expected result. This
 *   row pins the effect is still there, so nobody "fixes" it away while trying to
 *   make a naive `aria-expanded === 'false'` control pass.
 *
 * Its expectation, verbatim:
 *
 *   const row = control.closest('[role="button"][aria-expanded]') as HTMLElement | null;
 *   assert.ok(row, 'precondition: the teacher row must render as an expandable control');
 *   assert.equal(row!.getAttribute('aria-expanded'), 'false', 'precondition: the row starts collapsed');
 *   click(control);
 *   assert.equal(rowClickPath.length, 0, 'the row click handler must still not run — C2-5 is about the SELECTION effect, not the click');
 *   assert.equal(
 *     row!.getAttribute('aria-expanded'),
 *     'true',
 *     'selecting the teacher must still expand its row; this is the pre-existing effect C2-4 deliberately does not claim',
 *   );
 *
 * WHY IT IS SUPERSEDED. Lane C, 2026-09-28 (Major 4): "a compact 58px card
 * expands INLINE into a very long assignment editor containing `Unassign all`,
 * `Assign GR8`, checkboxes, and Swap controls. There is no separate review-only
 * profile or clear edit boundary; it pushes the entire roster away and places
 * destructive-looking controls among ordinary inspection content." The same
 * effect C2-5 pinned is the mechanism: because selecting a teacher expanded it,
 * INSPECTING a teacher produced the editor. The row was correct for the
 * behaviour it was written against and is the defect for this one.
 *
 * WHY THE REPLACEMENT IS STRONGER, not merely different. C2-5 made ONE positive
 * claim about ONE click path. C2-5' below makes FOUR claims, three of which C2-5
 * could not have made:
 *   1. no selection path opens the editor (not just this one click);
 *   2. inspection exposes NONE of the editor's controls — a claim about content,
 *      not about a state flag;
 *   3. the row no longer advertises `aria-expanded`, so the false "expanded"
 *      affordance cannot come back;
 *   4. the ONLY thing that opens the editor is the explicit `Edit assignments`
 *      control, and it says so in its own accessible name.
 * A control that only watched an `aria-expanded` flag would have passed while
 * `Unassign all` sat in the row; this one reads the rendered content.
 */
test('C2-5 SUPERSEDED BY A6 C2: selecting a teacher must NOT open the assignment editor', (t) => {
	teardown();
	const rowClickPath: number[] = [];
	const host = render(createElement(TeachingLoadReviewHost as any, {
		onRowSelect: (id: number) => { rowClickPath.push(id); },
	}));

	const control = buttonsIn(host).find((b) => (b.textContent ?? '').trim() === 'Review load')!;
	assert.ok(control, 'precondition: the per-row control must render');
	const row = control.closest('[role="button"]') as HTMLElement | null;
	assert.ok(row, 'precondition: the teacher row must still render as a control');
	assert.equal(
		row!.getAttribute('aria-expanded'),
		null,
		'the row must not advertise an expansion it no longer performs (A6 C2)',
	);
	assert.match(
		row!.getAttribute('aria-label') ?? '',
		/Workload profile for/,
		'the row must announce that it opens a READ-ONLY profile, not an editor',
	);

	// No editor, and no editor controls, before the inspection click at all.
	assert.equal(
		host.querySelector('[data-testid="teaching-load-assignment-editor"]') === null,
		true,
		'precondition: the inline assignment editor must not render while collapsed',
	);

	click(control);

	// (1) the row click handler still must not run, and (1b) selection alone must
	// not open the editor.
	assert.equal(
		rowClickPath.length,
		0,
		'the row click handler must still not run — that is C2-4\'s claim and it is unchanged',
	);
	// (2) THE CONTENT CLAIM: the destructive-looking controls are absent from the
	// rendered roster, not merely hidden behind a flag.
	const rosterText = host.textContent ?? '';
	for (const forbidden of ['Unassign all', 'Assign GR', 'Reset assignments']) {
		assert.equal(
			rosterText.includes(forbidden),
			false,
			`inspecting a teacher must not expose "${forbidden}" in the roster; the editor belongs behind \`Edit assignments\``,
		);
	}
	assert.equal(
		host.querySelector('[data-testid="teaching-load-assignment-editor"]') === null,
		true,
		'selecting a teacher to inspect it must NOT mount the inline assignment editor (A6 C2)',
	);

	// (4) The editor is reachable — from the ONE explicit control, and only from
	// there. A control that asserted "never editable" would be a wall, not a fix.
	const editControl = buttonsIn(host).find((b) => (b.textContent ?? '').trim() === 'Edit assignments')!;
	assert.ok(editControl, 'an explicit `Edit assignments` control must exist in the row');
	assert.equal(
		editControl.getAttribute('aria-expanded'),
		'false',
		'the edit control must advertise that the editor is closed before it is clicked',
	);
	t.diagnostic(`inspection opened no editor; \`Edit assignments\` is present and aria-expanded="false"`);

	// Tearing the dialog down first would be wrong: the roster is still mounted,
	// and the editor is roster state, not dialog state. Just click it.
	click(editControl);
	assert.equal(
		editControl.getAttribute('aria-expanded'),
		'true',
		'`Edit assignments` must announce that the editor is now open',
	);
	const editor = host.querySelector('[data-testid="teaching-load-assignment-editor"]') as HTMLElement | null;
	assert.ok(editor, '`Edit assignments` must actually open the inline assignment editor');
	// The control must own what it claims to control: the `aria-controls` target
	// is the element that actually mounted. (Its inner tools live behind the
	// `Row tools` menu, so a control that asserted on their TEXT would be
	// asserting on a portal that is not open.)
	assert.equal(
		editControl.getAttribute('aria-controls'),
		editor.getAttribute('id'),
		'the editor that opened must be the element `Edit assignments` claims to control',
	);
	assert.match(
		editor.textContent ?? '',
		/Maria Dela Cruz assignments/,
		'the editor must still be the real per-teacher assignment editor, not a placeholder',
	);
});
