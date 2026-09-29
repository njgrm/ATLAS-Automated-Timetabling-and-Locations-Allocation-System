/**
 * A3 teacher-one (2026-09-30) — "Teacher Profile" and "Review load" are ONE
 * dialog, per `docs/plans/operator-decisions.md` rows 9, 10 and 6 and the packet
 * `docs/prompts/a3-teacher-one-2026-09-30.md`.
 *
 * WHAT THIS FILE DECIDES, AND WHY IT RENDERS.
 *
 * Rows T1–T5 are things a scheduler SEES: which figures appear in which dialog,
 * how many action buttons a row carries, how wide the dialog opens, what the
 * footer offers, and whether the cross-department permission panel is still
 * reachable. A source-text assertion cannot decide them — it would pass if the
 * component kept the old markup in a branch no test mounted. So every row mounts
 * the real component and reads the real DOM.
 *
 * JSDOM performs NO LAYOUT and applies NO Tailwind. T3 is therefore asserted as
 * a CLASS CONTRACT (`w-[min(42rem,95vw)]`, no `w-full`, `data-resizable="true"`),
 * never as a pixel measurement. The drag proof belongs to the browser lane
 * (AGENTS.md "Done means seen").
 *
 * FAILING-FIRST. On base `5444c445` this file is RED: the survivor had no
 * `teacher-load-summary` block (T1, T5), the row still rendered a separate
 * Profile button and `inlineSecondary` (T2), the dialog opened at
 * `w-[min(56rem,95vw)]` (T3), and there was no `faculty-profile-deep-link`
 * footer control carrying the intent's `task` (T4). The migration of the rows
 * that named the deleted `FacultyWorkloadModal` is T6 and lives in the sibling
 * suites it edits (`a3-c17-teacher-profile`, `a3-c10-teacher-surface`,
 * `a5-c6-shared-dialog-tooltip`).
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, createElement, useState } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/teachers',
	pretendToBeVisual: true,
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
	SVGElement: dom.window.SVGElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	HTMLCollection: dom.window.HTMLCollection,
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
	localStorage: dom.window.localStorage,
	sessionStorage: dom.window.sessionStorage,
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
const { FacultyProfileSheet } = await import('@/components/faculty/FacultyProfileSheet');
const { FacultyMobileCard } = await import('@/components/faculty/FacultyRow');
const { useFacultyRowActions, getTeacherRepairIntent } = await import('@/components/faculty/FacultyRowActions');

const roots: any[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
});

function render(node: any): HTMLElement {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => {
		root.render(
			createElement(
				MemoryRouter as any,
				{ initialEntries: ['/teachers'] },
				createElement(TooltipProvider as any, { delayDuration: 200 }, node),
			),
		);
	});
	return host;
}

function click(el: Element) {
	act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

function textOf(scope: ParentNode): string {
	return (scope.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * A teacher with a REAL, COHERENT load: 20h taught against a 30h standard is
 * 66.67% utilised with 600 minutes (10h) of room left, and 24h credited means
 * 4h of adviser/other-duty credit. Every figure is consistent, so a projection
 * error shows up as a wrong number rather than as a fixture that happened to
 * satisfy the assertion (AGENTS.md §11 — the fixture comes from the real
 * surface, and it is the same shape the accepted `a3-c10-teacher-surface` rows
 * use).
 */
const TEACHER: any = {
	id: 46,
	firstName: 'Roberto',
	lastName: 'Alcantara',
	department: 'MATH',
	employmentStatus: 'Permanent',
	employeeId: 'T-0046',
	isActiveForScheduling: true,
	isClassAdviser: true,
	isPlaceholder: false,
	advisedSectionName: 'Rizal',
	advisoryEquivalentHours: 3,
	ancillaryMinutesPerWeek: 0,
	sectionTeachingHours: 20,
	actualTeachingHours: 20,
	policyCreditedHours: 24,
	maxHoursPerWeek: 40,
	subjectCount: 1,
	sectionCount: 1,
	teachingUtilizationPercent: 66.67,
	teachingCapacityRemainingMinutes: 600,
	excessTeachingMinutes: 0,
	rotationFamilyOvercountHours: 0,
	version: 1,
	assignments: [
		{
			id: 100,
			subjectId: 5,
			gradeLevels: [7],
			sectionIds: [11],
			sections: [
				{ id: 11, name: 'Rizal', gradeLevelId: 7, gradeLevelName: 'Grade 7', maxCapacity: 40, enrolledCount: 38, displayOrder: 7 },
			],
			subject: { id: 5, name: 'MAPEH', code: 'MAPEH', minMinutesPerWeek: 225 },
		},
	],
};

const REVIEW_INTENT = { task: 'review', label: 'Review load', helper: 'This teacher is under the weekly standard.' };

/**
 * Mount the real merged dialog and return its card.
 *
 * The dialog is queried from `document.body`, NOT from the render host: Radix
 * `DialogContent` renders through a PORTAL, so a host-scoped query finds an
 * empty container while the dialog is plainly on the page.
 */
function renderMergedDialog(summary: any, intent: any = null): HTMLElement {
	// Unmount anything already on the page FIRST. Radix portals the dialog into
	// `document.body`, so a second render leaves TWO dialogs there and a
	// `querySelector` silently returns the FIRST one — the previous test's
	// teacher.
	for (const root of roots.splice(0)) act(() => root.unmount());
	dom.window.document.body.innerHTML = '';

	render(
		createElement(FacultyProfileSheet as any, {
			faculty: summary,
			open: true,
			onOpenChange: () => {},
			sourceFreshness: 'Verified live',
			intent,
		}),
	);
	const dialog = dom.window.document.body.querySelector('[data-testid="faculty-profile-dialog"]');
	assert.ok(dialog, 'the merged teacher dialog did not mount');
	return dialog as unknown as HTMLElement;
}

// ═══════════════════════════════════════════════════════════════════════════
// T1 — the load figures AND the classes-taught boxes live in the SAME dialog.
// ═══════════════════════════════════════════════════════════════════════════

test('T1 the load figures and the A3 c17 subject boxes render inside ONE dialog', () => {
	const dialog = renderMergedDialog(TEACHER);

	// ONE dialog element, and it is the merged survivor.
	assert.equal(
		dom.window.document.querySelectorAll('[data-testid="faculty-profile-dialog"]').length,
		1,
		'there must be exactly one teacher dialog',
	);
	assert.equal(
		dom.window.document.querySelector('[data-testid="faculty-workload-modal"]'),
		null,
		'the deleted Review-load modal must not render anywhere',
	);

	// TOP: the Review-load figures, from `buildTeacherWorkloadView`.
	const load = dialog.querySelector('[data-testid="teacher-load-summary"]');
	assert.ok(load, 'the Review-load block must be in the merged dialog');
	const loadText = textOf(load!);
	assert.match(loadText, /20h a week/, "the selected teacher's teaching hours must be shown");
	assert.match(loadText, /30h standard/, 'the effective standard must be shown beside the hours');
	assert.match(loadText, /Adviser and other duties \(credit\)/, 'the adviser/other-duty credit line must be shown');
	assert.match(loadText, /\+4\.0h/, 'the credit figure must be the projection\'s equivalentHours');
	assert.match(loadText, /Room for more classes/, 'the remaining-room figure must be shown');
	assert.match(loadText, /10\.0h/, 'the remaining-room figure must match the selected teacher');
	assert.match(loadText, /can take more classes \(up to the 30h standard\)/, 'the ONE what-to-do line must state the status sentence');
	// The advisor star and the advisory section stay in the header.
	assert.match(textOf(dialog), /Adviser: Rizal/, 'a class adviser keeps the star and the advisory section');

	// BELOW: the A3 c17 classes-taught layout, unchanged.
	const body = textOf(dialog);
	assert.match(body, /MAPEH/, 'the subject box must still render');
	assert.match(body, /1 class · 3\.8h a week/, 'the C3-FIX total line must be untouched');
	assert.match(body, /Grade 7/, 'the resolved grade group must still render');
	const badges = dialog.querySelectorAll('[data-testid="grade-badge"]');
	assert.equal(badges.length, 1, 'one grade badge per resolved grade, from the shared GradeBadge');

	// Both facts are inside the ONE dialog element, which is the whole point of
	// the merge: on base the load figures lived in a different component.
	assert.ok(load!.closest('[data-testid="faculty-profile-dialog"]'), 'the load block is inside the merged dialog');
});

// ═══════════════════════════════════════════════════════════════════════════
// T2 — one action button per row, and no Profile control.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The row-actions object is captured on render so the structural half of T2 can
 * assert what `useFacultyRowActions` RETURNS, not merely what one call renders.
 * Rendering a base `inlineSecondary` is deliberately avoided: on base it mounts
 * a second Profile control, and the point of T2 is that the slot is gone.
 */
let capturedRowActions: any = null;

function RowHarness() {
	const rowActions = useFacultyRowActions({
		onReviewLoad: () => {},
		onEditTemporary: () => {},
		onDeleteTemporary: () => {},
	});
	capturedRowActions = rowActions;
	return createElement(
		'div',
		null,
		createElement(FacultyMobileCard as any, {
			faculty: TEACHER,
			primaryAction: rowActions.primary(TEACHER),
		}),
	);
}

test('T2 a row renders exactly ONE action button and no Profile control', () => {
	const host = render(createElement(RowHarness as any, {}));

	const card = host.querySelector('[data-testid="teacher-mobile-card"]');
	assert.ok(card, 'the mobile roster card must render');

	// The primary action survives, once, and opens the merged dialog.
	assert.equal(
		card!.querySelectorAll('[data-testid="teacher-row-primary-action"]').length,
		1,
		'the row must keep exactly one primary action button',
	);
	// The separate Profile control is GONE from the mobile card, even for a
	// caller that still passes the removed `onProfileClick`.
	assert.equal(
		card!.querySelector('[data-testid="teacher-row-profile-action"]'),
		null,
		'the Profile button must be removed from the mobile card',
	);
	// …and the desktop row's secondary slot is gone from the hook entirely.
	assert.ok(capturedRowActions, 'precondition: the row-actions object was captured');
	assert.equal(
		'inlineSecondary' in capturedRowActions,
		false,
		'inlineSecondary must be gone from useFacultyRowActions, so no row can render a Profile control',
	);
	// Exactly ONE action control remains on the card's action row.
	const actionRow = card!.querySelector('[data-testid="teacher-row-primary-action"]')!.parentElement;
	assert.equal(
		Array.from(actionRow!.querySelectorAll('button')).length,
		1,
		`the action row must hold exactly one button, found ${Array.from(actionRow!.querySelectorAll('button')).length}`,
	);
});

// ═══════════════════════════════════════════════════════════════════════════
// T3 — the default width, as a class contract (JSDOM performs no layout).
// ═══════════════════════════════════════════════════════════════════════════

test('T3 the merged dialog opens at w-[min(42rem,95vw)] and keeps the shared resize contract', () => {
	const dialog = renderMergedDialog(TEACHER);
	const cls = dialog.getAttribute('class') ?? '';

	// A CLASS CONTRACT, not a pixel measurement: JSDOM applies no Tailwind and
	// reports every rect as 0, so a width claim here would be a fiction. The
	// declared class is what a reviewer and the browser both read.
	assert.match(cls, /\bw-\[min\(42rem,95vw\)\]/, 'the default width must be about 42rem, viewport-guarded');
	assert.doesNotMatch(cls, /\bw-full\b/, 'the dialog must not be full width by default');
	assert.doesNotMatch(cls, /\bw-\[min\(56rem/, 'the old near-full-screen default must be gone');
	assert.equal(dialog.getAttribute('data-resizable'), 'true', 'resizing must still be offered');
	// The shared bounds are still the ONLY width authority, so the drag handler's
	// inline `style.width` is not clamped back by a page-local `max-width`.
	assert.match(cls, /\bmax-w-\[95vw\]/, 'the shared ceiling must govern the drag');
	assert.doesNotMatch(cls, /\bmax-w-(?!\[95vw\])\S/, 'no page-local max-width may cap the default width');
});

// ═══════════════════════════════════════════════════════════════════════════
// T4 — the footer: Edit in Teaching Load + Close, and no "More detail".
// ═══════════════════════════════════════════════════════════════════════════

test('T4 the footer carries the teacher deep link and Close, and no "More detail"', () => {
	const dialog = renderMergedDialog(TEACHER, REVIEW_INTENT);

	const deep = dialog.querySelector('[data-testid="faculty-profile-deep-link"]') as HTMLAnchorElement | null;
	assert.ok(deep, 'the Edit in Teaching Load link must render in the footer');
	assert.equal(deep!.tagName, 'A', 'the deep link is an anchor');
	assert.equal(
		deep!.getAttribute('href'),
		'/teaching-load?facultyId=46&task=review',
		'the link must carry THIS teacher and the intent task, unchanged',
	);
	assert.match(textOf(deep!), /Edit in Teaching Load/, 'the label is unchanged');

	const close = Array.from(dialog.querySelectorAll('button'))
		.find((b) => (b.textContent ?? '').trim() === 'Close');
	assert.ok(close, 'the footer must carry a Close control');

	assert.doesNotMatch(textOf(dialog), /More detail/i, 'no "More detail" control or expander may exist');
});

test('T4B with no intent the deep link carries only the facultyId', () => {
	const dialog = renderMergedDialog(TEACHER, null);
	const deep = dialog.querySelector('[data-testid="faculty-profile-deep-link"]') as HTMLAnchorElement | null;
	assert.ok(deep, 'the deep link must render even when no intent was supplied');
	assert.equal(deep!.getAttribute('href'), '/teaching-load?facultyId=46', 'no intent means no task parameter');
});

// ═══════════════════════════════════════════════════════════════════════════
// T5 — the cross-department permission panel is reachable from the merged
//      dialog, through the row's ONE action button (the real entry path).
// ═══════════════════════════════════════════════════════════════════════════

function RowDialogHarness() {
	const [target, setTarget] = useState<any>(null);
	const rowActions = useFacultyRowActions({
		onReviewLoad: (teacher: any) => setTarget(teacher),
		onEditTemporary: () => {},
		onDeleteTemporary: () => {},
	});
	return createElement(
		'div',
		null,
		rowActions.primary(TEACHER),
		createElement(FacultyProfileSheet as any, {
			faculty: target,
			open: target !== null,
			onOpenChange: (open: boolean) => { if (!open) setTarget(null); },
			sourceFreshness: 'Verified live',
			intent: target ? getTeacherRepairIntent(target) : null,
			permissions: null,
			schoolId: 1,
		}),
	);
}

test('T5 the row action opens the merged dialog with the permission panel reachable', () => {
	const host = render(createElement(RowDialogHarness as any, {}));
	assert.equal(dom.window.document.querySelector('[role="dialog"]'), null, 'precondition: no dialog before the click');

	click(host.querySelector('[data-testid="teacher-row-primary-action"]')!);

	const dialog = dom.window.document.querySelector('[data-testid="faculty-profile-dialog"]');
	assert.ok(dialog, 'the row action must open the merged teacher dialog');
	// The load figures and the permission front door are in the SAME dialog —
	// which is what makes this row discriminate: on base the row's primary
	// action opened a load-only modal with no permission surface.
	assert.ok(dialog!.querySelector('[data-testid="teacher-load-summary"]'), 'the load figures are in the opened dialog');
	assert.ok(
		dialog!.querySelector('[data-testid="teacher-subject-permissions"]'),
		'TeacherSubjectPermissions must remain reachable from the merged dialog',
	);
	assert.match(
		textOf(dialog!),
		/Teaching permissions/,
		'the permission panel heading must render for the teacher the row opened',
	);
});
