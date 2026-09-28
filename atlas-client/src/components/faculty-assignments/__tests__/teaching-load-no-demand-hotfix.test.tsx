/**
 * Hotfix 2026-09-28 — Teaching Load suggestion with zero demand rows.
 *
 * Live: after the EnrollPro wipe, derived demand was empty and the preview
 * header read "Suggested Teaching Load covers all rows and is balanced" over
 * 0 rows. With nothing to fill, the header must say so plainly instead.
 *
 * Run: `npx tsx --test src/components/faculty-assignments/__tests__/teaching-load-no-demand-hotfix.test.tsx`
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
const { AutoFillSummaryModal } = await import('../AutoFillSummaryModal');

const roots: any[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) act(() => root.unmount());
	document.body.innerHTML = '<div id="root"></div>';
});

function result(coveredRows: number, extra: Record<string, number> = {}): any {
	return {
		preserved: coveredRows, created: 0, assignmentsCreated: 0, uniqueTeachersAffected: 0, unresolved: 0,
		coverageMode: 'REAL_FACULTY_STANDARD', warnings: [], sectionSource: 'atlas-mirror',
		staffingReport: {
			department: 'GENERAL', unassignedSections: 0, missingHoursPerWeek: 0, recommendedNewHires: 0,
			internalCrossTrainees: [], missingMinutesPerWeek: 0, shortages: [],
		},
		distribution: {
			retains: [], inserts: [], moves: [],
			summary: {
				coveredRows, uncoveredRows: 0, proposedMoves: 0, unresolvedImbalance: 0, aboveStandardFaculty: 0,
				hardCapBreaches: 0, distributionEvaluated: true, balanced: true, ...extra,
			},
		},
		suggestedRows: [],
	};
}

function renderModal(value: any): string {
	const host = document.getElementById('root')!;
	const root = createRoot(host);
	roots.push(root);
	act(() => root.render(createElement(AutoFillSummaryModal, { open: true, onOpenChange: () => {}, result: value })));
	const dialog = document.querySelector('[data-testid="teaching-load-suggestion-preview"]');
	assert.ok(dialog, 'preview dialog rendered');
	return `${dialog.getAttribute('data-preview-state')}|${dialog.textContent ?? ''}`;
}

test('zero demand rows: header says there is nothing to fill, never "balanced"', () => {
	const text = renderModal(result(0));
	assert.ok(text.startsWith('no-demand|'), text.slice(0, 80));
	assert.match(text, /No classes to fill for this school year/);
	assert.match(text, /Check that subjects are set up for its grades\./);
	assert.doesNotMatch(text, /covers all rows and is balanced/);
});

test('control: real balanced coverage still reads as balanced', () => {
	const text = renderModal(result(285));
	assert.ok(text.startsWith('balanced|'), text.slice(0, 80));
	assert.match(text, /covers all rows and is balanced/);
	assert.doesNotMatch(text, /No classes to fill/);
});

// Hotfix 2026-09-29 — live proposal 105 (school year 2022-2023): a brand-new
// year has no saved rows, so the plan's covered/uncovered rows were both 0
// while ATLAS proposed 239 real teachers + 25 temporary substitutes. The
// header read "No classes to fill" and the note said "0 rows remain
// unresolved", yet after apply 25 classes had no teacher. Fixture fields are
// copied from the stored live preview payload.
function liveNewYearProposal(): any {
	const suggestedRows = [
		...Array.from({ length: 239 }, (_, i) => ({ assignmentType: 'REAL_TEACHER', subjectId: 1, sectionId: i + 1, facultyId: 1 })),
		...Array.from({ length: 25 }, (_, i) => ({ assignmentType: 'TEMPORARY_SUBSTITUTE', subjectId: 6, sectionId: i + 1, facultyId: null })),
	];
	const value = result(0);
	value.coverageMode = 'REAL_FACULTY_THEN_TEACHER_X';
	value.created = 25;
	value.preserved = 0;
	value.unresolved = 0;
	value.suggestedRows = suggestedRows;
	value.distribution.inserts = Array.from({ length: 239 }, (_, i) => ({ subjectId: 1, sectionId: i + 1, facultyId: 1 }));
	return value;
}

test('new year with 264 proposed rows: never "No classes to fill"', () => {
	const text = renderModal(liveNewYearProposal());
	assert.doesNotMatch(text, /No classes to fill/);
	assert.ok(!text.startsWith('no-demand|'), text.slice(0, 80));
});

test('new year with 25 substitutes: header and note say 25 still need a real teacher', () => {
	const text = renderModal(liveNewYearProposal());
	assert.ok(text.startsWith('shortage|'), text.slice(0, 80));
	assert.doesNotMatch(text, /covers all rows and is balanced/);
	assert.doesNotMatch(text, /0 rows remain unresolved/);
	assert.match(text, /25 classes still need a real teacher/);
});

test('applied toast names the classes that still need a real teacher', async () => {
	const { appliedSuggestionMessage } = await import('@/lib/teaching-load-suggestion-presentation');
	assert.equal(appliedSuggestionMessage(25), 'Teaching Load saved. 25 classes still need a real teacher.');
	assert.equal(appliedSuggestionMessage(1), 'Teaching Load saved. 1 class still needs a real teacher.');
	assert.equal(appliedSuggestionMessage(0), 'Suggested Teaching Load applied. Review the saved load before creating the timetable.');
});
