/**
 * A9 c4 (2026-09-30) — RENDERED: the section-details surface is a CENTRED DIALOG, not a
 * right-side drawer.
 *
 * Operator (`section.docx` item 1): *"currently it is a drawer. Make this as a modal at the
 * center of the page."* Operator decision #10 (locked): dialogs open at a normal centred
 * width of about 42rem, never near full screen; resizing is optional.
 *
 * `AGENTS.md` §11: a user-facing fix is done when it is SEEN, and a source-text assertion is
 * not acceptance evidence — so this mounts the REAL component and reads the rendered DOM:
 * the Radix dialog role, the primitive's flex-centring wrapper, the committed width class,
 * and every fact the operator sees. The planner's loopback screenshot is the other half.
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

/** The real server shape (`GET /sections/:id/assigned-classes`). */
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
	totals: { assignedClassCount: 1, rotationFamilyClassCount: 0, unassignedClassCount: 2 },
	unassignedExpectedClasses: [
		{ subjectId: 2, subjectCode: 'SCIENCE', subjectName: 'SCIENCE', subjectDisplayLabel: 'SCIENCE', minMinutesPerWeek: 225, rotationFamily: null, rotationTermRank: null, rotationTermLabel: 'Term 2', rotationTermGroupId: 'g1', rotationTermCount: 2 },
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

test('A9-C4-1: the details surface renders as a CENTRED dialog at a normal width, not a drawer', async () => {
	await open();
	const dialog = dom.window.document.querySelector<HTMLElement>('[role="dialog"]');
	assert.ok(dialog, 'the section details must render a dialog (role="dialog")');
	// Operator decision #10: about 42rem (`max-w-2xl`), never near full screen.
	const classes = dialog.className;
	assert.match(classes, /\bmax-w-2xl\b/, `the dialog must open at the normal 42rem width: ${classes}`);
	assert.doesNotMatch(classes, /\bsm:max-w-xl\b/, 'the old right-drawer width must be gone');
	// The primitive centres it with a flex parent, not a translate.
	const centering = dom.window.document.querySelector('[data-dialog-centering="flex"]');
	assert.ok(centering, 'the shared primitive must centre the dialog with its flex parent');
	// Decision #10 makes resizing optional; a fixed-width dialog must not show dead handles.
	assert.equal(dialog.getAttribute('data-resizable'), 'false', 'a fixed normal-width dialog must not offer dead resize handles');
	await close();
});

test('A9-C4-2: every fact the operator reads is still on screen', async () => {
	await open();
	const text = dom.window.document.body.textContent ?? '';
	for (const fact of ['G7 - Aguinaldo', 'Grade 7', 'Room 501', 'Building A', 'Manage Section Teaching Load', 'Unassigned']) {
		assert.ok(text.includes(fact), `the dialog must still show "${fact}"`);
	}
	// The Radix title/description pair the drawer had is preserved.
	assert.ok(dom.window.document.querySelector('[role="dialog"]'), 'the dialog stays a real dialog');
	assert.match(text, /Class coverage, teacher assignments, and home-room context/, 'the description must survive');
	await close();
});
