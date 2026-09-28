/**
 * A3-TEACHERS-LOAD-C3 · Fix 29 — an ownership transfer is a WRITE and must be
 * dedicated-control-only and confirmation-gated.
 *
 * The recorded defect: in `components/faculty-assignments/SubjectRow.tsx` the
 * whole section-cell body performed the transfer with no confirmation —
 *
 *   const handleClick = () => {
 *     if (!isClickable) return;
 *     if (isOwnedByOther) { onSwapSectionOwnership?.(subject.id, section.id, owner.facultyId, selectedFacultyId); }
 *     else { toggleSection(section.id); }
 *   };
 *
 * and the dedicated `ArrowLeftRight` button (which already called
 * `e.stopPropagation()`) also dispatched immediately. One stray click on a class
 * card moved a class between two teachers with no undo prompt.
 *
 * Rows (rendered into a real JSDOM document, not source-matched):
 *   C1 a body click on a section owned by ANOTHER teacher changes nothing: zero
 *      draft writes and zero swap dispatches.
 *   C2 the dedicated control opens a confirmation and STILL changes nothing.
 *   C3 Cancel changes nothing; the roster is byte-intact.
 *   C4 Confirm dispatches exactly ONE swap, with the exact pair and owner.
 *   C5 MUTANT / FAILING-FIRST: run against the pre-fix `SubjectRow` (where the
 *      body click swapped) C1, C2 and C4 all fail, so these assertions
 *      discriminate the defect rather than passing vacuously.
 *   C6 a section the teacher already owns still toggles from the body — the fix
 *      removed the *transfer* path, not assignment.
 *
 * FIX-29 (operator, 2026-09-28), the four acceptance criteria the committed
 * confirmation did not yet meet. ADDITIVE — C1-C6 above are unchanged in claim:
 *   C7  the dialog is titled `Confirm Assignment Swap` and names the source
 *       teacher, the TARGET teacher and the section.
 *   C8  the weekly-load impact is shown for BOTH teachers, in hours, read from
 *       the EXISTING `resolveSectionHoverDeltaMinutes` prop.
 *   C9  with no figure available the dialog says so; it never prints a bare `0`.
 *   C10 IN-FLIGHT: two confirms in one tick dispatch exactly ONE swap, and the
 *       in-flight state is rendered and published. This is the row Lane C could
 *       not perform.
 *   C11 ORDERING: nothing claims success before the dispatch, and the row's owner
 *       comes from the committed draft rather than local optimism.
 *
 * C7-C11 are NOT vacuous against the pre-fix component: it had no
 * `Confirm Assignment Swap` title, never named the target, carried no impact
 * figure, passed no `loading`, and its card body performed the transfer outright.
 */
import assert from 'node:assert/strict';
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
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	DOMRect: dom.window.DOMRect,
	PointerEvent: dom.window.MouseEvent,
	// Radix `react-focus-scope` probes these when the Dialog takes focus.
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	SVGSVGElement: dom.window.SVGSVGElement,
	IS_REACT_ACT_ENVIRONMENT: true,
});
// Radix (Tooltip/Dialog) and framer-motion both probe this.
(dom.window as any).matchMedia ??= (query: string) => ({
	matches: false,
	media: query,
	onchange: null,
	addListener: () => {},
	removeListener: () => {},
	addEventListener: () => {},
	removeEventListener: () => {},
	dispatchEvent: () => false,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView ??= () => {};
dom.window.HTMLElement.prototype.hasPointerCapture ??= () => false;
dom.window.HTMLElement.prototype.setPointerCapture ??= () => {};
dom.window.HTMLElement.prototype.releasePointerCapture ??= () => {};

const { createRoot } = await import('react-dom/client');
const { TooltipProvider } = await import('@/ui/tooltip');
const { SubjectRow } = await import('../SubjectRow');

const SUBJECT_ID = 41;
const OWNED_SECTION_ID = 700;
const FREE_SECTION_ID = 701;
const CURRENT_FACULTY_ID = 9;
const OTHER_FACULTY_ID = 4;

const subject: any = {
	id: SUBJECT_ID,
	code: 'TLE',
	name: 'Technology and Livelihood Education',
	minMinutesPerWeek: 120,
	programScopes: [],
	gradeLevels: [],
	isActive: true,
};

const sections: any[] = [
	{
		id: OWNED_SECTION_ID,
		name: '7-Rizal',
		displayOrder: 7,
		gradeLevelId: 7,
		gradeLevelName: 'Grade 7',
		maxCapacity: 40,
		enrolledCount: 30,
		programType: 'REGULAR',
	},
	{
		id: FREE_SECTION_ID,
		name: '7-Bonifacio',
		displayOrder: 7,
		gradeLevelId: 7,
		gradeLevelName: 'Grade 7',
		maxCapacity: 40,
		enrolledCount: 28,
		programType: 'REGULAR',
	},
];

/** Section 700 belongs to faculty 4, who is an active scheduling candidate. */
const effectiveOwnershipMap: any = {
	[`${SUBJECT_ID}:${OWNED_SECTION_ID}`]: {
		facultyId: OTHER_FACULTY_ID,
		facultyName: 'Dela Cruz, Juan',
		isPending: false,
	},
};

const roots: any[] = [];
const hosts: HTMLElement[] = [];

/**
 * Radix portals into `document.body`, and a `SubjectRow` Dialog renders nothing
 * while closed. Without tearing the host down between cases, one case's dialog
 * can satisfy the next case's assertion. Every case gets a fresh tree.
 */
afterEach(() => {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.querySelectorAll('[data-radix-portal]').forEach((n) => n.remove());
	dom.window.document.body.innerHTML = '';
});

/** Write-path recorder: the swap and set-sections callbacks are spied, not mocked. */
type Handlers = {
	swaps: [number, number, number, number | undefined][];
	setSections: [number, number[]][];
};

/** Host element -> its React root, so a case can re-render the SAME tree. */
const rootOfHost = new Map<HTMLElement, any>();

function renderRow(handlers: Handlers, props: Record<string, unknown> = {}) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	rootOfHost.set(host, root);
	act(() => {
		root.render(
			// The page renders SubjectRow inside `TooltipProvider`; mirror that so
			// the control under test is the real production tree.
			createElement(
				TooltipProvider as any,
				{ delayDuration: 200 },
				createElement(SubjectRow as any, {
					subject,
					sections,
					disabled: false,
					selectedFacultyId: CURRENT_FACULTY_ID,
					effectiveOwnershipMap,
					activeFacultyIds: new Set([CURRENT_FACULTY_ID, OTHER_FACULTY_ID]),
					onSetSections: (subjectId: number, sectionIds: number[]) => handlers.setSections.push([subjectId, sectionIds]),
					onSwapSectionOwnership: (a: number, b: number, c: number, d?: number) => handlers.swaps.push([a, b, c, d]),
					...props,
				}),
			),
		);
	});
	return host;
}

/** Re-render an already-mounted row with different props, as a parent would. */
function rerenderRow(host: HTMLElement, handlers: Handlers, props: Record<string, unknown>) {
	const root = rootOfHost.get(host);
	assert.ok(root, 'expected a mounted row');
	act(() => {
		root.render(
			createElement(
				TooltipProvider as any,
				{ delayDuration: 200 },
				createElement(SubjectRow as any, {
					subject,
					sections,
					disabled: false,
					selectedFacultyId: CURRENT_FACULTY_ID,
					effectiveOwnershipMap,
					activeFacultyIds: new Set([CURRENT_FACULTY_ID, OTHER_FACULTY_ID]),
					onSetSections: (subjectId: number, sectionIds: number[]) => handlers.setSections.push([subjectId, sectionIds]),
					onSwapSectionOwnership: (a: number, b: number, c: number, d?: number) => handlers.swaps.push([a, b, c, d]),
					...props,
				}),
			),
		);
	});
}

function buttons(host: HTMLElement): HTMLButtonElement[] {
	return Array.from(host.querySelectorAll('button'));
}

/**
 * The dedicated control, located WITHOUT relying on a `data-testid` so the same
 * lookup works against the pre-fix and post-fix `SubjectRow`. The decorative
 * Checkbox also renders a `<button role="checkbox">`, so it is excluded; the
 * remaining action button in the card is the swap control in both revisions.
 */
function swapControl(cell: HTMLElement): HTMLButtonElement {
	const actions = Array.from(cell.querySelectorAll('button'))
		.filter((b) => b.getAttribute('role') !== 'checkbox');
	assert.equal(actions.length, 1, `expected exactly one dedicated action control, found ${actions.length}`);
	return actions[0] as HTMLButtonElement;
}

/** Locate the card for `sectionName` in a way that works on BOTH revisions. */
function sectionCell(host: HTMLElement, sectionName: string): HTMLElement {
	const label = Array.from(host.querySelectorAll('span')).find((node) => node.textContent?.trim() === sectionName);
	assert.ok(label, `expected to find the label for ${sectionName}`);
	let node: HTMLElement | null = label as HTMLElement;
	while (node) {
		const cls = node.getAttribute('class') ?? '';
		if (cls.includes('rounded-xl') && cls.includes('border')) return node;
		node = node.parentElement;
	}
	throw new Error(`could not locate the section card for ${sectionName}`);
}

/** Grade groups are collapsed pre-fix and open post-fix; open them either way. */
function ensureGradeOpen(host: HTMLElement) {
	const expand = buttons(host).find((b) => /^Expand GR7 sections$/.test(b.getAttribute('aria-label') ?? ''));
	if (expand) act(() => { expand.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
}

function clickText(doc: Document, text: string): HTMLButtonElement {
	const found = Array.from(doc.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === text);
	assert.ok(found, `expected a button labelled "${text}"`);
	return found as HTMLButtonElement;
}

function dialogText(): string {
	const dialog = dom.window.document.querySelector('[role="dialog"]');
	return dialog?.textContent ?? '';
}

test('C1 a body click on a section owned by another teacher changes nothing', () => {
	const handlers: Handlers = { setSections: [], swaps: [] };
	const host = renderRow(handlers);
	ensureGradeOpen(host);

	const cell = sectionCell(host, '7-Rizal');
	act(() => { cell.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });

	assert.deepEqual(handlers.swaps, [], 'a body click must NOT dispatch an ownership transfer');
	assert.deepEqual(handlers.setSections, [], 'a body click must NOT write to the draft');
	assert.equal(dialogText(), '', 'a body click must not open a confirmation either');
});

test('C2 the dedicated control opens a confirmation and still changes nothing', () => {
	const handlers: Handlers = { setSections: [], swaps: [] };
	const host = renderRow(handlers);
	ensureGradeOpen(host);

	const cell = sectionCell(host, '7-Rizal');
	const control = swapControl(cell);

	act(() => { control.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });

	assert.deepEqual(handlers.swaps, [], 'opening the confirmation must NOT dispatch the swap');
	assert.deepEqual(handlers.setSections, [], 'opening the confirmation must NOT write to the draft');
	assert.match(dialogText(), /7-Rizal/, 'the confirmation must name the class being moved');
	assert.match(dialogText(), /Dela Cruz, Juan/, 'the confirmation must name the teacher losing it');
});

test('C3 Cancel leaves the roster byte-intact', () => {
	const handlers: Handlers = { setSections: [], swaps: [] };
	const host = renderRow(handlers);
	ensureGradeOpen(host);

	const cell = sectionCell(host, '7-Rizal');
	act(() => { swapControl(cell).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
	assert.notEqual(dialogText(), '', 'precondition: the confirmation is open');

	act(() => { clickText(dom.window.document as unknown as Document, 'Cancel').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });

	assert.deepEqual(handlers.swaps, [], 'Cancel must NOT dispatch the swap');
	assert.deepEqual(handlers.setSections, [], 'Cancel must NOT write to the draft');
	assert.equal(dialogText(), '', 'Cancel must close the confirmation');
});

test('C4 Confirm dispatches exactly one swap for the exact pair', () => {
	const handlers: Handlers = { setSections: [], swaps: [] };
	const host = renderRow(handlers);
	ensureGradeOpen(host);

	const cell = sectionCell(host, '7-Rizal');
	act(() => { swapControl(cell).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
	// LOCATOR UPDATE, NOT A WEAKENED CLAIM. FIX-29 renames this button
	// `Move class` -> `Swap assignment` so it agrees with the dialog title the
	// operator asked for (`Confirm Assignment Swap`). The assertions below are
	// byte-identical to the accepted C4 row and still decide exactly-one dispatch
	// with the exact pair.
	act(() => { clickText(dom.window.document as unknown as Document, 'Swap assignment').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });

	assert.equal(handlers.swaps.length, 1, `expected exactly one swap, got ${handlers.swaps.length}`);
	assert.deepEqual(handlers.swaps[0], [SUBJECT_ID, OWNED_SECTION_ID, OTHER_FACULTY_ID, CURRENT_FACULTY_ID]);
});

test('C6 a section this teacher does not own still toggles from the card body', () => {
	const handlers: Handlers = { setSections: [], swaps: [] };
	const host = renderRow(handlers);
	ensureGradeOpen(host);

	const cell = sectionCell(host, '7-Bonifacio');
	act(() => { cell.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });

	assert.deepEqual(handlers.swaps, [], 'assigning your own section is not a transfer');
	assert.deepEqual(handlers.setSections, [[SUBJECT_ID, [FREE_SECTION_ID]]], 'the body must still assign an unowned section');
});

// =============================================================================
// FIX-29 (operator, 2026-09-28) — the four acceptance criteria the committed
// confirmation did not yet meet. ADDITIVE: C1-C6 above are unchanged in claim.
//
// The recorded gaps, quoted from the finding:
//   - "Open `Confirm Assignment Swap` before mutation"  -> the title was
//     `Move {section} to this teacher?`.
//   - "Show source/target teacher and section, plus resulting weekly-load impact
//     where available" -> the TARGET was described only as "the teacher you are
//     editing", so its name was never shown, and there was NO load impact.
//   - "Confirm button has in-flight protection" -> `loading` was never passed and
//     the dispatch was synchronous, so a rapid second click could dispatch twice.
//   - "Success feedback occurs only after draft mutation succeeds" -> ordering
//     was unproven.
//
// C7  the dialog is titled `Confirm Assignment Swap` and names SOURCE teacher,
//     TARGET teacher and SECTION.
// C8  the weekly-load impact is stated for BOTH teachers, in hours, derived from
//     the existing hover prop rather than a second calculation.
// C9  with no figure available the dialog says so; it never prints a bare `0`
//     that would read as "this swap is free".
// C10 IN-FLIGHT: two confirms in one tick dispatch exactly ONE swap, and the
//     in-flight state is rendered and published on the dialog body.
// C11 ORDERING: nothing claims success before the dispatch, and the row's owner
//     comes from the committed draft, not from local optimism.
//
// C10 is the row Lane C could not perform. It is FAILING-FIRST by construction:
// neutering the `swapDispatchedRef` guard in `confirmSectionSwap` so the
// re-entrancy check never fires makes the two clicks dispatch TWO swaps and this
// row fails with `got 2`. Verified by direct edit and restored byte-exact; the
// guard is asserted by BEHAVIOUR, never by source text.
// =============================================================================

const TARGET_DISPLAY_NAME = 'ALCANANTARA, ROBERTO';
/** 180 minutes -> the `3 h / week` form the subject header already renders. */
const IMPACT_MINUTES = 180;

const withImpact = {
	targetFacultyName: TARGET_DISPLAY_NAME,
	resolveSectionHoverDeltaMinutes: (_s: unknown, _id: unknown) => IMPACT_MINUTES,
};

function openSwapDialog(host: HTMLElement, sectionName = '7-Rizal') {
	const cell = sectionCell(host, sectionName);
	act(() => { swapControl(cell).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
	assert.notEqual(dialogText(), '', 'precondition: the confirmation is open');
}

function dialogBody(): HTMLElement {
	const body = dom.window.document.querySelector('[data-testid="swap-confirmation-body"]');
	assert.ok(body, 'the confirmation must render its own body to publish aria-busy and the two degradation verdicts');
	return body as HTMLElement;
}

test('C7 the confirmation presents itself as the assignment swap and names BOTH teachers and the section', () => {
	const handlers: Handlers = { setSections: [], swaps: [] };
	const host = renderRow(handlers, withImpact);
	ensureGradeOpen(host);

	openSwapDialog(host);

	const dialog = dom.window.document.querySelector('[role="dialog"]') as HTMLElement;
	assert.ok(dialog, 'a dialog is open');
	// Resolve the title the way an assistive technology does: the dialog names
	// it with `aria-labelledby`, so the assertion is on the accessible name
	// rather than on some private id shape.
	const labelledBy = dialog.getAttribute('aria-labelledby');
	const titleNode = labelledBy ? dom.window.document.getElementById(labelledBy) : null;
	assert.ok(titleNode, `the dialog must expose an accessible name (aria-labelledby=${labelledBy})`);
	assert.equal(titleNode?.textContent?.trim(), 'Confirm Assignment Swap', 'the dialog must present itself as the assignment-swap confirmation');

	const text = dialogText();
	assert.match(text, /7-Rizal/, 'it must name the section being moved');
	assert.match(text, /Dela Cruz, Juan/, 'it must name the SOURCE teacher losing the class');
	assert.match(
		text,
		new RegExp(TARGET_DISPLAY_NAME),
		'the TARGET teacher must be NAMED, not described as "the teacher you are editing"',
	);
	assert.equal(
		dialogBody().getAttribute('data-swap-target-name'),
		'resolved',
		'a real-browser pass must be able to read that the target name resolved',
	);
});

test('C8 the weekly-load impact is shown for BOTH teachers, in hours, from the existing hover prop', () => {
	const handlers: Handlers = { setSections: [], swaps: [] };
	// A NON-round delta, so a control that prints the subject header's
	// `subject.minMinutesPerWeek` (120) instead of the hover prop's figure fails.
	const host = renderRow(handlers, { ...withImpact, resolveSectionHoverDeltaMinutes: () => 90 });
	ensureGradeOpen(host);

	openSwapDialog(host);

	const text = dialogText();
	assert.match(text, /Weekly load impact/i, 'the dialog must carry an impact block');
	assert.match(text, /1\.5 h \/ week/, 'the section contribution must be formatted from the hover prop minutes, not from minMinutesPerWeek');
	assert.match(text, new RegExp(`Dela Cruz, Juan.*loses 1\\.5 h / week`), 'the SOURCE teacher must be shown losing the load');
	assert.match(text, new RegExp(`${TARGET_DISPLAY_NAME}.*gains 1\\.5 h / week`), 'the TARGET teacher must be shown gaining the load');
	assert.equal(dialogBody().getAttribute('data-swap-impact'), 'available');
});

test('C9 with no figure available the dialog says so instead of printing a bare 0', () => {
	const handlers: Handlers = { setSections: [], swaps: [] };
	// No `resolveSectionHoverDeltaMinutes` at all: the surface has no figure.
	const host = renderRow(handlers, { targetFacultyName: TARGET_DISPLAY_NAME });
	ensureGradeOpen(host);

	openSwapDialog(host);

	const text = dialogText();
	assert.match(text, /Weekly load impact/i, 'the block is still present, so the gap is visible');
	assert.match(text, /Not available for this class/i, 'it must state the figure is unavailable');
	assert.doesNotMatch(text, /\b0(\.0)? h \/ week/, 'a missing figure must never render as 0 h / week, which reads as "this swap is free"');
	assert.equal(dialogBody().getAttribute('data-swap-impact'), 'unavailable');
});

test('C10 IN-FLIGHT: two rapid confirms dispatch exactly ONE swap, and the in-flight state is published', async () => {
	const handlers: Handlers = { setSections: [], swaps: [] };
	const host = renderRow(handlers, withImpact);
	ensureGradeOpen(host);

	openSwapDialog(host);

	const doc = dom.window.document as unknown as Document;
	// ONE button node, clicked twice in a single tick — the real double-click.
	// Re-querying between clicks would hide the bug: the first click replaces
	// the label with the in-flight spinner, so a second lookup would find
	// nothing and the double dispatch could never happen.
	const confirm = clickText(doc, 'Swap assignment');
	act(() => {
		confirm.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
		confirm.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
	});

	assert.equal(handlers.swaps.length, 1, `a rapid double confirm must dispatch ONE swap, got ${handlers.swaps.length}`);
	assert.deepEqual(handlers.swaps[0], [SUBJECT_ID, OWNED_SECTION_ID, OTHER_FACULTY_ID, CURRENT_FACULTY_ID]);

	// The in-flight state is VISIBLE, not just a ref: both buttons are disabled,
	// the confirm shows its spinner, and the body publishes aria-busy so a
	// real-browser pass can read it.
	const body = dialogBody();
	assert.equal(body.getAttribute('aria-busy'), 'true', 'the dialog body must be aria-busy while the swap is in flight');
	assert.equal(body.getAttribute('data-swap-in-flight'), 'true');
	// The SAME node captured before the clicks: while in flight the primitive
	// replaces its label with the spinner, so it is asserted by identity, not by
	// the pre-click text.
	assert.equal((confirm as HTMLButtonElement).disabled, true, 'the confirm must be disabled while in flight');
	assert.match(confirm.textContent ?? '', /Processing/, 'the confirm must show its in-flight spinner state');
	assert.equal((clickText(doc, 'Cancel') as HTMLButtonElement).disabled, true, 'cancel must be disabled while in flight');

	// The deferred close runs the guard armed; after it the dialog is gone and
	// the in-flight verdict is no longer published anywhere.
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
	assert.equal(dialogText(), '', 'the confirmation must close once the swap is dispatched');
	assert.equal(handlers.swaps.length, 1, 'closing must not dispatch a second swap');
	assert.equal(dom.window.document.querySelectorAll('[aria-busy="true"]').length, 0, 'no node may still claim to be in flight');
});

test('C11 ORDERING: nothing claims success before the dispatch, and the row follows the COMMITTED draft', async () => {
	const handlers: Handlers = { setSections: [], swaps: [] };
	const host = renderRow(handlers, withImpact);
	ensureGradeOpen(host);

	// Before the dispatch: no swap, and no success text anywhere in the document.
	openSwapDialog(host);
	assert.deepEqual(handlers.swaps, [], 'precondition: opening the gate dispatched nothing');
	assertNoSuccessText('before the dispatch');
	assert.equal(
		dom.window.document.querySelectorAll('[role="status"], [role="alert"], [aria-live]').length,
		0,
		'no live region may announce the swap before the draft mutation',
	);

	// Still not optimistic: the card keeps showing the PRE-SWAP owner, because
	// the row reads `effectiveOwnershipMap` and the parent has not committed.
	assert.match(
		sectionCell(host, '7-Rizal').textContent ?? '',
		/Dela Cruz, Juan/,
		'the card must still show the committed owner before the parent re-renders',
	);

	act(() => {
		clickText(dom.window.document as unknown as Document, 'Swap assignment').dispatchEvent(
			new dom.window.MouseEvent('click', { bubbles: true }),
		);
	});
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
	assert.equal(handlers.swaps.length, 1, 'precondition: the swap dispatched');
	assert.equal(dialogText(), '', 'precondition: the confirmation closed');

	// After the dispatch but BEFORE the parent commits, the row must NOT flip on
	// its own. A local-optimism implementation shows the new owner here.
	assert.match(
		sectionCell(host, '7-Rizal').textContent ?? '',
		/Dela Cruz, Juan/,
		'the row must NOT optimistically claim the new owner before the draft commits',
	);

	// The parent then commits, and the row follows the committed draft.
	rerenderRow(host, handlers, {
		...withImpact,
		assignment: { subjectId: SUBJECT_ID, sectionIds: [OWNED_SECTION_ID] },
		effectiveOwnershipMap: {
			[`${SUBJECT_ID}:${OWNED_SECTION_ID}`]: {
				facultyId: CURRENT_FACULTY_ID,
				facultyName: TARGET_DISPLAY_NAME,
				isPending: true,
			},
		},
	});

	// The parent then commits, and the row follows the committed draft. The
	// committed shape is a section this teacher now OWNS: the owner chip is
	// gone (there is no other teacher to name) and the card reports itself
	// assigned to this teacher.
	const committed = sectionCell(host, '7-Rizal');
	assert.equal(committed.querySelector('[data-testid="section-swap-control"]'), null, 'a section this teacher now owns offers no swap control');
	assert.match(
		committed.getAttribute('aria-label') ?? '',
		/assigned to this teacher/,
		'the row must read the owner the parent committed, not a local guess',
	);
	assert.equal(committed.getAttribute('aria-pressed'), 'true', 'the committed section must render as assigned');
});

/**
 * No toast, no live region and no success wording may exist yet.
 *
 * The patterns are SUCCESS STATES, not the imperative in the dialog's own
 * question ("Move it to X?"), so this cannot pass vacuously by matching the
 * prompt the operator is looking at.
 */
function assertNoSuccessText(when: string) {
	const doc = dom.window.document;
	for (const root of [doc.querySelector('[role="dialog"]'), doc.body]) {
		if (!root) continue;
		const text = root.textContent ?? '';
		assert.doesNotMatch(
			text,
			/\b(swapped|success(ful)?|done|complete[ds]?|now assigned|has been moved|was moved|has been saved)\b/i,
			`no success wording may exist ${when}, but found: ${text.slice(0, 160)}`,
		);
	}
	assert.equal(doc.querySelectorAll('[data-swap-committed], [data-swap-succeeded]').length, 0, `no success marker may exist ${when}`);
}
