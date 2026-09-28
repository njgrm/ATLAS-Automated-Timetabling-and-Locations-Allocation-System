/**
 * A3 c11 FIX-12 - the truthfulness of a home-room confirmation.
 *
 * THE OPERATOR'S WORDS: "The success message must reflect the actual
 * persistence result." Planner A3's decided contract: the only honest
 * dispositions are PERSISTED, FAILED and NOT ATTEMPTED, and none of the last two
 * may ever read as saved. No new offline queue is invented here; the device
 * queue the code already owns keeps reporting its own distinct disposition.
 *
 * The recorded staging evidence this control closes:
 *  1. the in-flight saving state and the single-PUT double-click guard already
 *     worked (retained here, so they cannot regress), and
 *  2. going Offline made the room picker report "No buildings found" - a false
 *     claim about the school, produced by a request that never reached the
 *     server. Unreachable is a different fact from empty, and both are asserted
 *     here so neither can pass vacuously.
 *
 * Also closed: the silent path. `handleHomeRoomChange` used to return with no
 * outcome when the roster could not be written, so a Confirm click closed the
 * dialog and did nothing at all. The gate and its not-saved sentence are now the
 * exported pure `homeRoomWriteAvailability`; the map modal disables Confirm and
 * shows that sentence; the page's own notice channel carries it too.
 *
 * RENDERED vs SCANNED: the load-failure pane, the disabled confirm and its
 * reason, the three dispositions and the toast's stacking are read from the
 * rendered document through the real components. Only the transport is injected.
 * The page's own wiring is a source ratchet, because the house rule is not to
 * mount `pages/Sections.tsx`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mock } from 'node:test';
import test from 'node:test';

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
	matches: false, media: q, onchange: null,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});

/** The buildings request is scripted per case, so each state is decided by the
 *  request's real outcome rather than by a prop. */
const server = {
	getCalls: 0,
	mode: 'empty' as 'empty' | 'reject' | 'buildings',
	writes: [] as Array<{ verb: string; url: string; body: unknown }>,
};
const BUILDINGS = [{
	id: 1, name: 'Grade 9 Academic Wing', floorCount: 2, x: 0, y: 0, width: 100, height: 80,
	color: '#e11d48', rotation: 0, gradeScope: [], isTeachingBuilding: true,
	rooms: [
		{ id: 401, name: 'G9 Room 401', type: 'CLASSROOM', capacity: 40, isTeachingSpace: true, floor: 1, floorPosition: 1 },
	],
}];

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async (url: string) => {
			if (url.includes('/map/schools/1/buildings')) {
				server.getCalls += 1;
				if (server.mode === 'reject') throw new Error('Network Error');
				return { data: { buildings: server.mode === 'buildings' ? BUILDINGS : [] } };
			}
			throw new Error(`unexpected GET in the truthful-confirm control: ${url}`);
		},
		put: async (url: string, body: unknown) => { server.writes.push({ verb: 'put', url, body }); return { data: {} }; },
		post: async (url: string, body: unknown) => { server.writes.push({ verb: 'post', url, body }); return { data: {} }; },
		patch: async () => ({ data: {} }),
		delete: async () => ({ data: {} }),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

installCanvasShim(dom.window as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } });

const { act, createElement, Fragment, useState } = await import('react');
const { createRoot } = await import('react-dom/client');
type Root = import('react-dom/client').Root;
const { Toaster } = await import('sonner');
const { SectionRoomMapModal, ROOM_MAP_EMPTY_TITLE, ROOM_MAP_OFFLINE_MESSAGE } = await import('../SectionRoomMapModal');
const { HomeRoomConfirmDialogs, homeRoomResultCopy } = await import('../HomeRoomConfirmDialogs');
const { persistHomeRoomAssignment } = await import('../homeRoomPersistence');
const { homeRoomWriteAvailability, HOME_ROOM_NOT_SAVED } = await import('../homeRoomWriteAvailability');
import type { HomeRoomUpdateResult } from '../homeRoomPersistence';
import type { PendingAssignment } from '../HomeRoomConfirmDialogs';

const doc = () => dom.window.document as unknown as HTMLElement;
const bodyText = () => dom.window.document.body.textContent ?? '';
const byTestId = (id: string) => doc().querySelector<HTMLElement>(`[data-testid="${id}"]`);
function click(el: HTMLElement | null, label: string) {
	assert.ok(el, `control tried to click a missing control: ${label}`);
	act(() => { el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}
/** Source with comments removed, so a scan judges code and not prose. */
function codeOf(path: string): string {
	return readFileSync(resolve(import.meta.dirname, path), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^[ \t]*\/\/.*$/gm, '');
}

const SECTION = { id: 11, name: 'Grade 9 - Sampaguita', homeRoomId: 401 } as unknown as PendingAssignment['section'];
const QUEUE_KEY = 'atlas:sections-home-room-queue:v1:1:7';

let root: Root | null = null;
let toasterRoot: Root | null = null;
let renderSeq = 0;

function ensureRoot(): Root {
	if (!root) {
		const container = dom.window.document.createElement('div');
		dom.window.document.body.appendChild(container);
		root = createRoot(container);
	}
	return root;
}

/**
 * A fresh sonner Toaster per case. Reused, its toasts outlive the case that
 * raised them, so "no part of the surface may claim the change was saved" could
 * be failed by the PREVIOUS case's success toast.
 */
function freshToaster() {
	if (toasterRoot) act(() => { toasterRoot!.unmount(); });
	toasterRoot = createRoot(dom.window.document.body.appendChild(dom.window.document.createElement('div')));
	act(() => { toasterRoot!.render(createElement(Toaster)); });
}

function MapHarness(props: { canWrite?: boolean; writeBlockedReason?: string | null }) {
	return createElement(SectionRoomMapModal, {
		open: true,
		onOpenChange: () => {},
		sectionName: 'Grade 9 - Sampaguita',
		sectionId: 11,
		currentRoomId: 401,
		onSelect: () => {},
		schoolId: 1,
		canWrite: props.canWrite ?? true,
		writeBlockedReason: props.writeBlockedReason ?? null,
	});
}

async function renderMap(props: { canWrite?: boolean; writeBlockedReason?: string | null } = {}) {
	const r = ensureRoot();
	freshToaster();
	renderSeq += 1;
	await act(async () => {
		r.render(createElement(MapHarness, { ...props, key: renderSeq } as never));
		await new Promise((r) => setTimeout(r, 0));
		await new Promise((r) => setTimeout(r, 0));
	});
	return doc();
}

/* ============ item 1: "we could not reach the server" is not "no buildings" === */

test('FIX-12 (1) RENDERED: an unreachable server says so, and never claims the campus is empty', async () => {
	server.mode = 'reject';
	server.getCalls = 0;
	await renderMap();

	const failure = byTestId('room-map-load-failure');
	assert.ok(failure, 'the pane must render a distinct unreachable state');
	assert.equal(failure!.getAttribute('role'), 'alert', 'and announce it');
	assert.match(failure!.textContent ?? '', /could not reach the server/i, 'naming the connection problem');
	assert.match(failure!.textContent ?? '', /connection problem/i, 'and calling it one, in the operator\'s words');
	assert.ok(byTestId('room-map-retry'), 'with a retry that can actually clear it');
	// The decisive assertion: the false claim is gone from the whole surface.
	assert.doesNotMatch(bodyText(), /No buildings found/, 'an unreachable server must never read as an empty campus');
	assert.equal(byTestId('room-map-empty'), null, 'and the empty-state node must not be rendered at all');
	// The sidebar says the same thing, with its own retry.
	assert.ok(byTestId('room-map-sidebar-load-failure'), 'the explorer list must not silently render as empty either');
	assert.ok(byTestId('room-map-sidebar-retry'));
	assert.equal(server.getCalls, 1);
});

test('FIX-12 (1) RENDERED: the retry re-asks the server and then shows the genuine empty state', async () => {
	server.mode = 'reject';
	server.getCalls = 0;
	await renderMap();
	assert.ok(byTestId('room-map-load-failure'));
	// The retry is a real second request, and this time the server answers.
	server.mode = 'empty';
	click(byTestId('room-map-retry'), 'pane retry');
	await act(async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); });
	assert.equal(server.getCalls, 2, 'the retry must dispatch a second request');
	assert.equal(byTestId('room-map-load-failure'), null, 'the unreachable state must clear once the server answers');
	const empty = byTestId('room-map-empty');
	assert.ok(empty, 'and the GENUINE empty state must still be what an empty campus shows');
	assert.equal(empty!.textContent, ROOM_MAP_EMPTY_TITLE, 'unchanged copy, unchanged meaning');
	assert.doesNotMatch(bodyText(), /could not reach the server/i, 'no connection wording survives a real empty result');
});

test('FIX-12 (1) RENDERED: a campus that answers with buildings renders the list, so neither branch is vacuous', async () => {
	server.mode = 'buildings';
	await renderMap();
	assert.equal(byTestId('room-map-load-failure'), null);
	assert.equal(byTestId('room-map-empty'), null);
	assert.match(bodyText(), /Grade 9 Academic Wing/, 'the building list is rendered when the server answers with buildings');
	server.mode = 'empty';
});

/* ============ item 2: a click that cannot be written says so ================= */

test('FIX-12 (2) the write gate is one derivation, and every blocked state has its own not-saved sentence', () => {
	const writable = homeRoomWriteAvailability({ hasActiveSchoolYear: true, rosterStatus: 'ok', dataSource: 'live', isOnline: true });
	assert.equal(writable.canWrite, true);
	assert.equal(writable.notSavedNotice, null, 'a writable page has no not-saved sentence to show');

	const blocked = [
		homeRoomWriteAvailability({ hasActiveSchoolYear: false, rosterStatus: 'ok', dataSource: 'live', isOnline: true }),
		homeRoomWriteAvailability({ hasActiveSchoolYear: true, rosterStatus: 'unavailable', dataSource: 'live', isOnline: true }),
		homeRoomWriteAvailability({ hasActiveSchoolYear: true, rosterStatus: 'ok', dataSource: 'none', isOnline: true }),
		homeRoomWriteAvailability({ hasActiveSchoolYear: true, rosterStatus: 'ok', dataSource: 'refreshing', isOnline: true }),
	];
	for (const state of blocked) {
		assert.equal(state.canWrite, false, 'every blocked state must be unwritable');
		const notice = state.notSavedNotice ?? '';
		assert.ok(notice.startsWith(HOME_ROOM_NOT_SAVED), `the notice must lead with the not-saved words: ${notice}`);
		assert.doesNotMatch(notice, /\bqueued\b/i, 'and must not claim the change is queued: ' + notice);
		assert.doesNotMatch(notice, /has been saved|was saved|change saved/i, 'nor that it was saved: ' + notice);
	}
	// Offline is NOT a block: the device queue accepts the write and reports its
	// own disposition, so calling it blocked would be the opposite lie.
	const offline = homeRoomWriteAvailability({ hasActiveSchoolYear: true, rosterStatus: 'ok', dataSource: 'cached', isOnline: false });
	assert.equal(offline.canWrite, true, 'an offline cached roster still accepts a write into the device queue');
	// The four sentences are distinguishable, so the operator is told which one
	// applies instead of reading a generic refusal.
	assert.equal(new Set(blocked.map((b) => b.notSavedNotice)).size, 4, 'each blocked state has its own sentence');
});

test('FIX-12 (2) RENDERED: the modal shows the owner\'s not-saved sentence on the disabled Confirm', async () => {
	const reason = 'Home-room change not saved. ATLAS is not connected to a section source, so nothing was written.';
	await renderMap({ canWrite: false, writeBlockedReason: reason });
	const confirm = byTestId('room-map-confirm') as HTMLButtonElement;
	assert.equal(confirm.disabled, true, 'a Confirm that cannot write must be unavailable');
	const shown = byTestId('room-map-confirm-reason');
	assert.equal(shown?.textContent, reason, 'and it must carry the owner\'s own sentence');
	assert.match(bodyText(), /not saved/i, 'the operator reads that the change was not saved');
	assert.doesNotMatch(bodyText(), /Home room saved/, 'and no part of the surface may imply a save');
	assert.equal(server.writes.length, 0, 'and nothing was written to produce it');
});

/* ============ item 3: the three dispositions, truthfully reported ============ */

/**
 * The page-shaped owner: it builds the assignment payload, calls the REAL
 * `persistHomeRoomAssignment`, and reports the result. Only the transport and
 * the queue writer are injected.
 */
function makeRunner(isOnline: boolean, put: () => Promise<void>) {
	return async (pending: PendingAssignment): Promise<HomeRoomUpdateResult> =>
		persistHomeRoomAssignment({
			isOnline,
			assignments: [{ sectionId: pending.section.id as number, homeRoomId: pending.roomId }],
			put: async () => { await put(); },
			applyOptimistic: () => {},
			enqueue: () => {
				const raw = dom.window.localStorage.getItem(QUEUE_KEY);
				const current = raw ? JSON.parse(raw) as unknown[] : [];
				dom.window.localStorage.setItem(QUEUE_KEY, JSON.stringify([
					...current, { sectionId: pending.section.id, homeRoomId: pending.roomId },
				]));
			},
		});
}

const UNASSIGN_PENDING: PendingAssignment = {
	section: SECTION,
	roomId: null,
	type: 'unassign',
	currentRoomName: 'G9 Room 401',
};

function ConfirmHarness(props: { isOnline: boolean; put: () => Promise<void> }) {
	const [pending, setPending] = useState<PendingAssignment | null>(UNASSIGN_PENDING);
	if (!pending) return createElement('p', { 'data-testid': 'flow-closed' }, 'closed');
	return createElement(HomeRoomConfirmDialogs, {
		pending,
		sections: [SECTION],
		onRun: makeRunner(props.isOnline, props.put),
		onClose: () => setPending(null),
	});
}

async function renderConfirm(props: { isOnline: boolean; put: () => Promise<void> }) {
	const r = ensureRoot();
	freshToaster();
	renderSeq += 1;
	await act(async () => {
		r.render(createElement(ConfirmHarness, { ...props, key: renderSeq } as never));
		await new Promise((x) => setTimeout(x, 0));
	});
	return doc();
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 40)); });

test('FIX-12 (3) RENDERED: a persisted change says saved, closes, and paints above the dialog', async () => {
	dom.window.localStorage.clear();
	let puts = 0;
	await renderConfirm({ isOnline: true, put: async () => { puts += 1; } });
	click(byTestId('unassign-modal-confirm'), 'confirm');
	await settle();

	assert.equal(puts, 1, 'exactly one write for one confirm');
	assert.equal(byTestId('home-room-result'), null, 'a saved write needs no in-modal recovery panel');
	assert.match(bodyText(), /Home room saved/, 'the persisted outcome is reported');
	assert.ok(byTestId('flow-closed'), 'and only the persisted outcome closes the surface');
	assert.equal(dom.window.localStorage.getItem(QUEUE_KEY), null, 'a saved change is never queued');
	// The toast is asserted where it actually paints: outside the dialog, above
	// its z-index.
	const toastNode = Array.from(dom.window.document.querySelectorAll('li, div'))
		.find((n) => (n.textContent ?? '').includes('Home room saved'));
	assert.ok(toastNode, 'the toast must be in the document');
	assert.equal(
		(toastNode as HTMLElement).closest('[role="dialog"]'),
		null,
		'the toast must not be inside the dialog, or it can be clipped or stacked under it',
	);
	const toaster = dom.window.document.querySelector('[data-sonner-toaster]');
	assert.ok(toaster, 'sonner Toaster must be mounted');
	const injected = Array.from(dom.window.document.head.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n');
	const rule = injected.match(/\[data-sonner-toaster\][^{]*\{[^}]*z-index:\s*(\d+)/);
	assert.ok(rule, 'sonner must inject a z-index for its toaster');
	assert.ok(Number(rule![1]) > 50, `toaster z-index ${rule![1]} must exceed Radix's dialog 50`);
});

test('FIX-12 (3) RENDERED: an offline change is not saved, and says so in its own words', async () => {
	dom.window.localStorage.clear();
	let puts = 0;
	await renderConfirm({ isOnline: false, put: async () => { puts += 1; } });
	click(byTestId('unassign-modal-confirm'), 'confirm');
	await settle();

	assert.equal(puts, 0, 'offline must dispatch no write at all');
	assert.equal(byTestId('flow-closed'), null, 'an unpersisted change keeps its surface open');
	const result = byTestId('home-room-result');
	assert.ok(result, 'and must report a disposition');
	assert.equal(result!.getAttribute('data-result-status'), 'queued');
	const headline = byTestId('home-room-result-headline')?.textContent ?? '';
	assert.match(headline, /not on the server|queued/i, `the headline must name the real disposition: ${headline}`);
	assert.doesNotMatch(headline, /\bsaved\b/i, 'an unpersisted change must never read as saved');
	assert.doesNotMatch(bodyText(), /Home room saved/, 'no part of the surface may claim the change was saved');
	assert.ok(dom.window.localStorage.getItem(QUEUE_KEY), 'and the device queue really does hold it, so the wording is true');
	assert.equal(server.writes.filter((w) => w.verb === 'post').length, 0, 'no sync is dispatched on an unpersisted write');
});

test('FIX-12 (3) RENDERED: a refused change is not saved either, and offers the recovery path', async () => {
	dom.window.localStorage.clear();
	await renderConfirm({ isOnline: true, put: async () => { throw new Error('ATLAS 503'); } });
	click(byTestId('unassign-modal-confirm'), 'confirm');
	await settle();

	const result = byTestId('home-room-result');
	assert.ok(result, 'a refused change must surface an outcome');
	assert.equal(result!.getAttribute('role'), 'alert');
	assert.equal(byTestId('flow-closed'), null, 'and must not close as though it had saved');
	assert.doesNotMatch(bodyText(), /Home room saved/, 'no part of the surface may claim the change was saved');
	assert.ok(byTestId('home-room-result-retry'), 'a recovery path must be offered');
	assert.equal(homeRoomResultCopy({ status: 'failed', reason: 'blocked', detail: 'x' }).headline, 'Change rejected - nothing was changed'.replace('-', '—'), 'the refusal headline names its disposition');
});

/* ============ item 4: the properties that already worked, retained ========= */

test('FIX-12 (4) RENDERED: a rapid double click sends exactly one write and the control locks in flight', async () => {
	dom.window.localStorage.clear();
	let release!: () => void;
	const gate = new Promise<void>((resolve) => { release = resolve; });
	let puts = 0;
	await renderConfirm({ isOnline: true, put: async () => { puts += 1; await gate; } });

	const confirm = byTestId('unassign-modal-confirm') as HTMLButtonElement;
	assert.ok(confirm, 'precondition: the confirm control exists');
	click(confirm, 'first click');
	assert.equal(puts, 1, 'the first click dispatches exactly one write');
	const locked = byTestId('unassign-modal-confirm') as HTMLButtonElement;
	assert.equal(locked.disabled, true, 'the control must be disabled while the write is in flight');
	assert.match(locked.textContent ?? '', /Processing/i, 'and must show a real in-flight state, not a silent wait');
	// Two more clicks, one dispatched and one programmatic, add nothing.
	click(byTestId('unassign-modal-confirm'), 'second click');
	act(() => { (byTestId('unassign-modal-confirm') as HTMLButtonElement).click(); });
	assert.equal(puts, 1, 'a duplicate click must not create a duplicate write');

	await act(async () => { release(); await gate; await new Promise((r) => setTimeout(r, 10)); });
	assert.equal(puts, 1, 'and the write count never doubles after it settles');
});

/* ============ the page wiring this control transcribes ====================== */

test('FIX-12 wiring ratchet: the page reports a blocked pick through the notice channel and a toast', () => {
	const page = codeOf('../../../pages/Sections.tsx');
	assert.match(page, /const isReadOnlyMode = !homeRoomWrite\.canWrite;/, 'the row gate and the map gate must be one derivation');
	assert.match(
		page,
		/if \(!homeRoomWrite\.canWrite\) \{[\s\S]{0,400}?setCacheNotice\(notice\);[\s\S]{0,200}?toast\.error\('Home-room change not saved'/,
		'the blocked path must set the page notice AND raise a toast, never return silently',
	);
	assert.match(
		page,
		/const result = await performHomeRoomUpdate\(section, nextHomeRoomId\);[\s\S]{0,600}?if \(result\.status === 'saved'\) \{[\s\S]{0,200}?toast\.success\('Home room saved'/,
		'the direct path must report its own outcome, and only a saved result may say saved',
	);
	const modal = codeOf('../SectionRoomMapModal.tsx');
	assert.match(modal, /if \(!canWrite \|\| !isStagedChange\) return;/, 'the confirm guard must be in the handler, not only in the attribute');
	assert.match(modal, /catch \(err\) \{[\s\S]{0,400}?setLoadFailure\(ROOM_MAP_OFFLINE_MESSAGE\);/, 'a failed load must be recorded as a failure, not as an empty campus');
});
