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

function renderRow(handlers: Handlers) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
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
				}),
			),
		);
	});
	return host;
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
	act(() => { clickText(dom.window.document as unknown as Document, 'Move class').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });

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
