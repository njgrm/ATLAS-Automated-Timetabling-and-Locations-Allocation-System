/**
 * A9 c6 (2026-09-30) — RENDERED: applying rooms saves at once with a plain receipt and ONE-click
 * Undo, and there is no second confirmation dialog.
 *
 * Operator docx item 4 asked for a confirmation modal; operator decision #11 (later the same night,
 * and it WINS) says the opposite: *"No second confirmation after a review dialog: applying saves at
 * once with a plain receipt and Undo (Apply rooms first)."* So this file asserts the DECISION, not
 * the docx wording — and it counts the transport calls, so "saves at once" is a measured fact, not
 * a claim about markup.
 *
 * The receipt must be on the action page (the dialog) AND the page whose data changed (the dialog's
 * `onNotice` channel, which `/sections` renders beside its one action) — operator decision #5 and
 * the receipts rule in `docs/plans/codex-walk-standard.md`. Undo writes through the SAME endpoint
 * with `homeRoomId: null`, states what it will do, cannot double-submit, and leaves its own receipt.
 */
import assert from 'node:assert/strict';
import { test, mock } from 'node:test';

import { JSDOM } from 'jsdom';
import { installCanvasShim } from '../../__tests__/konva-dom-render-harness';

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

const ROOM_OPTIONS = [
	{ id: 201, name: 'Room 201', buildingName: 'Building A', type: 'CLASSROOM' },
	{ id: 202, name: 'Room 202', buildingName: 'Building A', type: 'CLASSROOM' },
];

const PREVIEW = {
	schoolId: 1, schoolYearId: 9, mode: 'preview', overwriteExisting: false, allowCrossGradeFallback: false,
	assignments: [
		{ sectionId: 1001, sectionName: 'Grade 7 - Aguinaldo', gradeLevel: 7, homeRoomId: 201, roomName: 'Room 201', buildingId: 1, buildingName: 'Building A', reason: 'GRADE_SCOPE_MATCH' },
		{ sectionId: 1002, sectionName: 'Grade 7 - Bonifacio', gradeLevel: 7, homeRoomId: 202, roomName: 'Room 202', buildingId: 1, buildingName: 'Building A', reason: 'ANY_GRADE_FALLBACK' },
	],
	skipped: [
		{ sectionId: 1003, sectionName: 'Grade 7 - del Pilar', gradeLevel: 7, reason: 'ROOM_CAPACITY_TOO_SMALL' },
	],
	counts: { sectionsConsidered: 3, assigned: 2, skipped: 1, existingPreserved: 0, applied: 0 },
};

const transport = {
	puts: [] as Array<{ url: string; body: Record<string, unknown> }>,
	putResult: { updated: 2 } as { updated: number },
	putError: null as { response: { data: { message: string } } } | null,
	notices: [] as string[],
};

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async () => ({ data: {} }),
		post: async () => ({ data: PREVIEW }),
		put: async (url: string, body: Record<string, unknown>) => {
			transport.puts.push({ url, body });
			if (transport.putError) throw transport.putError;
			return { data: transport.putResult };
		},
		patch: async () => ({ data: {} }),
		delete: async () => ({ data: {} }),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

installCanvasShim(dom.window as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } });

const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
type Root = import('react-dom/client').Root;
const { MemoryRouter } = await import('react-router-dom');
// The shared picker renders a map inside a popover; it imports the room map modal, so the dialog's
// own module graph needs the canvas shim, which `installCanvasShim` above provides.
const { HomeRoomAutoAssignDialog } = await import('../HomeRoomAutoAssignDialog');

const byTestId = (id: string) => dom.window.document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const allDialogs = () => dom.window.document.querySelectorAll('[role="dialog"]');

let root: Root | null = null;
let host: HTMLElement | null = null;

async function open() {
	transport.puts.length = 0;
	transport.putResult = { updated: 2 };
	transport.putError = null;
	transport.notices.length = 0;
	await act(async () => {
		const container = dom.window.document.createElement('div');
		host = container;
		dom.window.document.body.appendChild(container);
		root = createRoot(container);
		root.render(createElement(MemoryRouter, null,
			createElement(HomeRoomAutoAssignDialog, {
				open: true,
				onOpenChange: () => {},
				schoolId: 1,
				schoolYearId: 9,
				homeRoomOptions: ROOM_OPTIONS as never,
				roomOccupancy: new Map<number, string>(),
				canWrite: true,
				onApplied: () => {},
				onNotice: (message: string) => { transport.notices.push(message); },
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

async function clickTestId(id: string) {
	const target = byTestId(id);
	assert.ok(target, `no control with data-testid "${id}"`);
	await act(async () => {
		target!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
		await Promise.resolve();
		await Promise.resolve();
	});
}

test.afterEach(async () => { await close(); });

test('A9-C6-1: Apply saves at once — ONE write, no second confirmation dialog', async () => {
	await open();
	assert.equal(allDialogs().length, 1, 'precondition: the review dialog is the only dialog');
	await clickTestId('guided-step-apply');
	assert.equal(transport.puts.length, 1, 'applying must NOT open a second confirmation before writing');
	assert.equal(allDialogs().length, 1, 'no second dialog may appear on Apply');
	assert.deepEqual(transport.puts[0].body.assignments, [
		{ sectionId: 1001, homeRoomId: 201 },
		{ sectionId: 1002, homeRoomId: 202 },
	]);
	await close();
});

test('A9-C6-2: the receipt says what saved, what was left out and why, and the next step', async () => {
	await open();
	await clickTestId('guided-step-apply');
	const receipt = byTestId('guided-step-outcome')?.textContent ?? '';
	assert.match(receipt, /Saved 2 rooms\./, 'the receipt must say how many saved');
	assert.match(receipt, /1 section was left without a room/, 'the receipt must say what was NOT done');
	assert.match(receipt, /every free room is too small for the class/, 'and why');
	assert.match(receipt, /Next: check the sections that still have no room/, 'and the next step');
	// The page whose data changed gets the SAME receipt through the onNotice channel.
	assert.ok(
		transport.notices.some((message) => /Saved 2 rooms\./.test(message)),
		'the affected page must receive the same receipt',
	);
	await close();
});

test('A9-C6-3: Undo states what it will do, writes homeRoomId null through the same endpoint, and leaves its own receipt', async () => {
	await open();
	await clickTestId('guided-step-apply');
	const undo = byTestId('guided-step-undo-action');
	assert.ok(undo, 'an Undo action must be offered while the receipt is on screen');
	assert.equal((undo!.textContent ?? '').trim(), 'Undo these 2 rooms', 'Undo must state what it will do before doing it');

	transport.putResult = { updated: 2 };
	await clickTestId('guided-step-undo-action');
	assert.equal(transport.puts.length, 2, 'Undo must write through the SAME endpoint');
	assert.match(String(transport.puts[1].url), /\/sections\/home-rooms\/9$/, 'Undo used a different route');
	assert.deepEqual(transport.puts[1].body.assignments, [
		{ sectionId: 1001, homeRoomId: null },
		{ sectionId: 1002, homeRoomId: null },
	], 'Undo must put exactly the applied sections back to no home room');
	const undoReceipt = byTestId('guided-step-undo-outcome')?.textContent ?? '';
	assert.match(undoReceipt, /Undid 2 rooms/, 'Undo must leave its OWN receipt');
	assert.ok(
		transport.notices.some((message) => /Undid 2 rooms/.test(message)),
		'the affected page must receive the undo receipt too',
	);
	// The apply receipt is cleared, so the two receipts cannot both claim to be current.
	assert.equal(byTestId('guided-step-outcome'), null, 'the apply receipt must not linger beside the undo receipt');
	await close();
});

test('A9-C6-4: a rejected Undo says nothing was undone, through its own alert', async () => {
	await open();
	await clickTestId('guided-step-apply');
	transport.putError = { response: { data: { message: 'ROOMS_LOCKED' } } };
	await clickTestId('guided-step-undo-action');
	const failure = byTestId('guided-step-undo-error');
	assert.ok(failure, 'a rejected Undo must report through its own alert');
	assert.match(failure!.textContent ?? '', /ROOMS_LOCKED/, 'the typed server reason must reach the operator');
	assert.match(failure!.textContent ?? '', /No rooms were saved/, 'a rejected batch must say that nothing changed');
	await close();
});

/* ═══════════════════ A9 c2 R2 (2026-09-30): ONE CLICK = ONE PUT ═══════════════════
 * QA measured a programmatic double dispatch of `apply` in ONE tick sending TWO
 * PUTs: the button's `disabled` is STATE, and two clicks in the same tick both
 * pass a state check that has not re-rendered yet. The sibling write surface
 * (`HomeRoomConfirmDialogs.tsx`) already solves this with a ref (`inFlightRef`).
 * These rows dispatch two clicks SYNCHRONOUSLY inside one `act`, so no re-render
 * can intervene — the only thing that can stop the second write is the ref. They
 * fail first at `c886a410`, which sends 2 PUTs on Apply. */

test('A9-C6-5 (R2): a double-click on Apply in ONE tick sends ONE write, not two', async () => {
	await open();
	const applyBtn = byTestId('guided-step-apply');
	assert.ok(applyBtn, 'precondition: the apply control exists');
	await act(async () => {
		applyBtn!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
		applyBtn!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
	assert.equal(
		transport.puts.length,
		1,
		'two clicks in one tick must not both pass a state check that has not re-rendered yet',
	);
	await close();
});

test('A9-C6-6 (R2): a double-click on Undo in ONE tick sends ONE write, not two', async () => {
	await open();
	await clickTestId('guided-step-apply');
	assert.equal(transport.puts.length, 1, 'precondition: the apply wrote once');
	const undoBtn = byTestId('guided-step-undo-action');
	assert.ok(undoBtn, 'precondition: the Undo control is offered beside the receipt');
	await act(async () => {
		undoBtn!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
		undoBtn!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
	assert.equal(
		transport.puts.length,
		2,
		'Undo must send exactly ONE more write (its own in-flight ref), not two',
	);
	await close();
});
