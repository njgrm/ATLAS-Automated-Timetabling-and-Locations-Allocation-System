/**
 * A9 c5 R1 (2026-09-30) — RENDERED: the section-details dialog's *Unassigned Classes* list.
 *
 * Operator (section.docx item 5): *"show a term-rotating family (Science, TLE) as ONE row with its
 * per-term subjects inline (e.g. 'Science (rotates): Chemistry T2, Earth Science T3'), no raw codes
 * (SCI_CHEM, TLE_AFA_EXP, TLE_ROTATION) on screen."* The first cut grouped BY TERM and still printed
 * the raw `rotationFamily` token as a violet chip and the subject code as a mono token.
 *
 * `AGENTS.md` §11: a source-text assertion is not acceptance evidence, so this mounts the REAL
 * component and reads the rendered DOM — the operator's form on screen, and no raw code token
 * anywhere in the list. The planner's loopback row is the other half.
 */
import assert from 'node:assert/strict';
import { test, mock } from 'node:test';

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'https://njgrm.buru-degree.ts.net/sections',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	localStorage: dom.window.localStorage,
	sessionStorage: dom.window.sessionStorage,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	Node: dom.window.Node,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	SVGElement: dom.window.SVGElement,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
dom.window.HTMLElement.prototype.releasePointerCapture = () => {};
dom.window.HTMLElement.prototype.setPointerCapture = () => {};
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
	matches: false, media: q,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});

/**
 * The real server shape (`GET /sections/:id/assigned-classes`). The assigned class's code is
 * underscore-free (`MAPEH`), so the whole-dialog scan below is decided by the UNASSIGNED list.
 * `subjectName` is the human name the server sends (`Science Chemistry`).
 */
const DETAILS = {
	sectionId: 42,
	sectionName: 'G7 - Aguinaldo',
	gradeLevel: 7,
	programType: 'REGULAR',
	schoolYearId: 9,
	classes: [
		{
			subjectId: 1, subjectCode: 'MAPEH', subjectName: 'MAPEH', subjectDisplayLabel: 'MAPEH',
			minMinutesPerWeek: 225, rotationFamily: null, rotationTermRank: null, rotationTermLabel: null,
			rotationTermGroupId: null, rotationTermCount: null, facultyId: 7, facultyName: 'Teacher A',
			facultyDepartment: 'MAPEH', facultySpecialization: null, assignmentKind: 'REAL_OWNERSHIP' as const,
			specializationCode: null, specializationLabel: null,
		},
	],
	totals: { assignedClassCount: 1, rotationFamilyClassCount: 4, unassignedClassCount: 5 },
	unassignedExpectedClasses: [
		{ subjectId: 11, subjectCode: 'SCI_CHEM', subjectName: 'Science Chemistry', subjectDisplayLabel: 'SCIENCE', minMinutesPerWeek: 225, rotationFamily: 'SCIENCE', rotationTermRank: 2, rotationTermLabel: 'TERM 2', rotationTermGroupId: 'sci', rotationTermCount: 2 },
		{ subjectId: 12, subjectCode: 'SCI_EARTH', subjectName: 'Science Earth Science', subjectDisplayLabel: 'SCIENCE', minMinutesPerWeek: 225, rotationFamily: 'SCIENCE', rotationTermRank: 3, rotationTermLabel: 'TERM 3', rotationTermGroupId: 'sci', rotationTermCount: 2 },
		{ subjectId: 13, subjectCode: 'TLE_BREAD', subjectName: 'TLE Bread and Pastry', subjectDisplayLabel: 'TLE', minMinutesPerWeek: 300, rotationFamily: 'TLE_ROTATION', rotationTermRank: 2, rotationTermLabel: 'TERM 2', rotationTermGroupId: 'tle', rotationTermCount: 2 },
		{ subjectId: 14, subjectCode: 'TLE_NAIL', subjectName: 'TLE Nail Care', subjectDisplayLabel: 'TLE', minMinutesPerWeek: 300, rotationFamily: 'TLE_ROTATION', rotationTermRank: 3, rotationTermLabel: 'TERM 3', rotationTermGroupId: 'tle', rotationTermCount: 2 },
		{ subjectId: 15, subjectCode: 'MAPEH', subjectName: 'MAPEH', subjectDisplayLabel: 'MAPEH', minMinutesPerWeek: 225, rotationFamily: null, rotationTermRank: null, rotationTermLabel: null, rotationTermGroupId: null, rotationTermCount: null },
	],
};

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async () => ({ data: DETAILS }),
		post: async () => ({ data: {} }),
		put: async () => ({ data: {} }),
		patch: async () => ({ data: {} }),
		delete: async () => ({ data: {} }),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { SectionDetailsSheet } = await import('../SectionDetailsSheet');

let root: import('react-dom/client').Root | null = null;
let host: HTMLElement | null = null;

async function open() {
	await act(async () => {
		const container = dom.window.document.createElement('div');
		host = container;
		dom.window.document.body.appendChild(container);
		root = createRoot(container);
		root.render(createElement(MemoryRouter, null,
			createElement(SectionDetailsSheet, {
				sectionId: 42,
				sectionName: 'G7 - Aguinaldo',
				section: { id: 42, name: 'G7 - Aguinaldo', gradeLevelName: 'GRADE 7', isSpecialProgram: false, programCode: 'REGULAR', homeRoomId: 501 } as never,
				homeRoom: { id: 501, name: 'Room 501', buildingName: 'Building A', type: 'CLASSROOM' },
				schoolYearId: 9,
				open: true,
				onOpenChange: () => {},
			} as never),
		));
	});
	await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

async function close() {
	await act(async () => { root?.unmount(); });
	host?.remove();
	host = null;
	root = null;
}

test.afterEach(async () => { await close(); });

/** The rendered *Unassigned Classes* region's text, scoped by its own heading. */
function unassignedText(): string {
	const heading = Array.from(dom.window.document.querySelectorAll('h4')).find(
		(el) => /Unassigned Classes/.test(el.textContent ?? ''),
	);
	assert.ok(heading, 'the Unassigned Classes section must render');
	return heading!.parentElement?.textContent ?? '';
}

test('A9-C5-R1: a rotating family renders as ONE row with its per-term subjects inline, no raw codes', async () => {
	await open();
	const text = unassignedText();

	// The operator's own form: one row per family, members inline.
	assert.match(text, /Science \(rotates\)/, 'the Science family must read as one row');
	assert.match(text, /Chemistry T2, Earth Science T3/, 'the per-term subjects must read inline');
	assert.match(text, /TLE \(rotates\)/, 'the TLE family must read as one row');
	assert.match(text, /Bread and Pastry T2, Nail Care T3/, 'the TLE members must read inline');
	// A non-rotating class keeps a plain row and no invented term.
	assert.match(text, /MAPEH/, 'the all-year class must still render');
	assert.doesNotMatch(text, /MAPEH T\d/, 'a non-rotating class must not gain a term');

	// No raw code token anywhere in the list (the packet's regex plus its three literals).
	assert.doesNotMatch(text, /[A-Z0-9]+_[A-Z0-9_]+/, 'no raw code token may reach the screen');
	assert.doesNotMatch(text, /SCI_CHEM|TLE_AFA_EXP|TLE_ROTATION/, 'the forbidden tokens must be gone');
	// The minutes figure is still shown.
	assert.match(text, /225 min/, 'the group minutes figure must survive');
	await close();
});
