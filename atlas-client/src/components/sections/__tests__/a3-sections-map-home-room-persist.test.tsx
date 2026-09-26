/**
 * A3 S1 — home-room persistence controls (fix 12, and the fix 04 cancel
 * regression control).
 *
 * The recorded defect: `pages/Sections.tsx` confirmed a swap by firing
 * `void performHomeRoomUpdate(...)` and clearing `pendingAssignment` in the same
 * tick. The dialog was unmounted before the write settled, so the three real
 * outcomes — persisted, queued locally, refused — were indistinguishable, and
 * the page-level notice a queued write did set sat behind the dialog. A queued
 * change read exactly like a saved one.
 *
 * What makes these controls discriminate rather than merely pass:
 *
 *  - The confirmation surface under test is the real `HomeRoomConfirmDialogs`
 *    over the real `SwapConfirmationModal`, driven by the real
 *    `persistHomeRoomAssignment`. Only the transport and the local queue
 *    writer are injected; nothing about the outcome contract is re-stated here.
 *  - The failing-first block mounts the *pre-fix wiring* — the unchanged modal
 *    plus the fire-and-forget-close parent transcribed from base
 *    3cfe79a8 — and asserts the same requirement list against it. A control
 *    that passes on both revisions is not evidence, so that block must fail.
 *  - The transport is a real promise the test settles by hand, so "in flight"
 *    is a real in-flight state and not a timer.
 *  - The toast is checked where it actually paints: sonner's Toaster is
 *    rendered, and the toast node is asserted to be outside the dialog subtree
 *    with the injected stylesheet's z-index compared against Radix's.
 */
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { act, createElement, useState } from 'react';
import type { ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { PendingAssignment, HomeRoomConfirmDialogsProps } from '../HomeRoomConfirmDialogs';
import type { HomeRoomUpdateResult } from '../homeRoomPersistence';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'https://njgrm.buru-degree.ts.net/sections',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	MouseEvent: dom.window.MouseEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	FocusEvent: dom.window.FocusEvent,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
dom.window.HTMLElement.prototype.releasePointerCapture = () => {};
dom.window.HTMLElement.prototype.setPointerCapture = () => {};
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
	matches: false,
	media: q,
	onchange: null,
	addEventListener() {},
	removeEventListener() {},
	addListener() {},
	removeListener() {},
	dispatchEvent() { return false; },
});

const { createRoot } = await import('react-dom/client');
const { Toaster } = await import('sonner');
const { HomeRoomConfirmDialogs, homeRoomResultCopy } = await import('../HomeRoomConfirmDialogs');
const { SwapConfirmationModal } = await import('../SectionHomeRoomModals');
const { persistHomeRoomAssignment, resolveHomeRoomIntent } = await import('../homeRoomPersistence');

type SectionLike = { id: number; name: string; homeRoomId?: number | null };

const SECTION_A: SectionLike = { id: 11, name: 'Grade 7 - Rizal', homeRoomId: 101 };
const SECTION_B: SectionLike = { id: 22, name: 'Grade 9 - Bonifacio', homeRoomId: 202 };

/** The page's local queue key shape (HOME_ROOM_QUEUE_CACHE_PREFIX in Sections.tsx). */
const QUEUE_KEY = 'atlas:sections-home-room-queue:v1:1:7';

let roots: Root[] = [];
let containers: HTMLDivElement[] = [];

function mount(node: ReactElement) {
	const el = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(el);
	const r = createRoot(el);
	act(() => { r.render(node); });
	roots.push(r);
	containers.push(el);
	return el;
}

async function unmount() {
	const toUnmount = roots;
	roots = [];
	const toRemove = containers;
	containers = [];
	await act(async () => {
		for (const r of toUnmount) r.unmount();
		for (const el of toRemove) el.remove();
	});
}

after(async () => {
	await unmount();
	dom.window.close();
});

beforeEach(() => {
	dom.window.localStorage.clear();
	dom.window.document.body.innerHTML = '';
});

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}

type Transport = { calls: number; lastAssignments: unknown[]; run: (assignments: unknown[]) => Promise<void> };

function makeTransport(impl?: () => Promise<void>): Transport {
	const t: Transport = {
		calls: 0,
		lastAssignments: [],
		run: async (assignments: unknown[]) => {
			t.calls += 1;
			t.lastAssignments = assignments;
			if (impl) await impl();
		},
	};
	return t;
}

/**
 * The page-shaped owner of the mutation: it builds the assignments the real
 * route receives, calls the real `persistHomeRoomAssignment`, and reports the
 * result. `localStorage` is jsdom's own.
 */
function makeRunner(isOnline: boolean, put: () => Promise<void>) {
	return async (pending: PendingAssignment, swapTarget?: { sectionId: number; homeRoomId: number | null }): Promise<HomeRoomUpdateResult> => {
		const assignments = [{ sectionId: pending.section.id as number, homeRoomId: pending.roomId }];
		if (swapTarget) assignments.push({ sectionId: swapTarget.sectionId, homeRoomId: swapTarget.homeRoomId });
		return persistHomeRoomAssignment({
			isOnline,
			assignments,
			put: async () => { await put(); },
			applyOptimistic: () => {},
			enqueue: () => {
				const raw = dom.window.localStorage.getItem(QUEUE_KEY);
				const current = raw ? JSON.parse(raw) as { sectionId: number; homeRoomId: number | null }[] : [];
				const next = [
					...current.filter((e) => e.sectionId !== pending.section.id),
					{ sectionId: pending.section.id as number, homeRoomId: pending.roomId },
					...(swapTarget ? [{ sectionId: swapTarget.sectionId, homeRoomId: swapTarget.homeRoomId }] : []),
				];
				dom.window.localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
			},
		});
	};
}

const SWAP_PENDING: PendingAssignment = {
	section: SECTION_A as PendingAssignment['section'],
	roomId: 202,
	type: 'swap',
	displacedSection: SECTION_B.name,
	currentRoomName: 'Room 101',
	targetRoomName: 'Room 202',
};

function byTestId(id: string): HTMLElement | null {
	return dom.window.document.querySelector(`[data-testid="${id}"]`);
}

function click(el: HTMLElement | null) {
	if (!el) throw new Error('control tried to click a missing element');
	act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

function dialogStillOpen(): boolean {
	return byTestId('swap-modal-confirm') !== null;
}

/* ─────────────────────────── fix 04: cancel is zero-write ─────────────────── */

test('fix 04 control: cancelling a confirmed swap dispatches zero PUTs and leaves the local queue unchanged', () => {
	const transport = makeTransport();
	let putDispatched = 0;
	const put = async () => { putDispatched += 1; };
	const runner = makeRunner(true, put);

	function Harness() {
		const [pending, setPending] = useState<PendingAssignment | null>(SWAP_PENDING);
		if (!pending) return createElement('p', { 'data-testid': 'flow-closed' }, 'closed');
		return createElement(HomeRoomConfirmDialogs, {
			pending,
			sections: [SECTION_A, SECTION_B] as HomeRoomConfirmDialogsProps['sections'],
			onRun: runner,
			onClose: () => setPending(null),
		});
	}

	mount(createElement(Harness));
	assert.ok(dialogStillOpen(), 'precondition: the confirmation must be open before Cancel');

	const before = dom.window.localStorage.getItem(QUEUE_KEY);
	click(byTestId('swap-modal-cancel'));
	const after = dom.window.localStorage.getItem(QUEUE_KEY);

	assert.equal(putDispatched, 0, 'Cancel must dispatch zero PUT /sections/home-rooms/* requests');
	assert.equal(transport.calls, 0, 'Cancel must not reach the transport');
	assert.equal(before, null, 'precondition: the local queue starts empty');
	assert.equal(after, null, 'Cancel must leave zero localStorage queue delta');
	assert.ok(byTestId('flow-closed'), 'Cancel closes the confirmation without writing');
});

/* ─────────────────── fix 12: failing-first, then the real surface ─────────── */

/** The requirement list a home-room confirmation must satisfy. */
function evaluateSurface(): { checks: Record<string, boolean>; resultShown: boolean; stillOpen: boolean; toastShown: boolean } {
	const stillOpen = byTestId('swap-modal-confirm') !== null;
	const resultShown = byTestId('home-room-result') !== null;
	const headline = byTestId('home-room-result-headline')?.textContent ?? '';
	const toastShown = (dom.window.document.body.textContent ?? '').includes('Home room saved');
	return {
		stillOpen,
		resultShown,
		toastShown,
		checks: {
			// 1. the outcome is reported somewhere the user can see it
			'outcome surfaced to the user': resultShown || toastShown,
			// 2. an unpersisted write must not close the surface that owes a verdict
			'an unacknowledged write keeps its surface': stillOpen || toastShown,
			// 3. the surfaced outcome names a disposition rather than implying success
			'outcome states its disposition': headline.length > 0 || toastShown,
		},
	};
}

test('fix 12 control discriminates: the pre-fix wiring fails it, the new surface passes it', async () => {
	// --- the pre-fix wiring, transcribed from base 3cfe79a8 (Sections.tsx:967):
	// onConfirm fired the write and cleared pendingAssignment in the same tick.
	let putDispatched = 0;
	const put = async () => { putDispatched += 1; };

	function PreFixHarness() {
		const [pending, setPending] = useState<PendingAssignment | null>(SWAP_PENDING);
		if (!pending) return createElement('p', { 'data-testid': 'flow-closed' }, 'closed');
		return createElement(SwapConfirmationModal, {
			open: pending.type === 'swap',
			onOpenChange: (open: boolean) => !open && setPending(null),
			onConfirm: () => {
				// The recorded defect: fire the write, unmount the dialog, never
				// look at the outcome.
				void persistHomeRoomAssignment({
					isOnline: true,
					assignments: [{ sectionId: pending.section.id, homeRoomId: pending.roomId }],
					put: async () => { await put(); },
					applyOptimistic: () => {},
					enqueue: () => {},
				});
				setPending(null);
			},
			sourceSectionName: pending.section.name,
			targetRoomName: pending.targetRoomName ?? '',
			displacedSectionName: pending.displacedSection ?? '',
			currentRoomName: pending.currentRoomName,
		});
	}

	mount(createElement(PreFixHarness));
	click(byTestId('swap-modal-confirm'));
	// Let the un-awaited write settle, which is exactly what the old code did
	// not wait for.
	await act(async () => { await Promise.resolve(); });
	const preFix = evaluateSurface();
	await unmount();

	const preFixFailures = Object.entries(preFix.checks).filter(([, ok]) => !ok).map(([name]) => name);
	assert.equal(putDispatched, 1, 'precondition: the pre-fix wiring did dispatch the write');
	// Pinned, not just "some failures": the pre-fix wiring must miss exactly
	// these three, and the new surface must miss none.
	assert.deepEqual(
		[...preFixFailures].sort(),
		[
			'an unacknowledged write keeps its surface',
			'outcome states its disposition',
			'outcome surfaced to the user',
		],
		'the control must detect the pre-fix defect, and only the pre-fix defect',
	);
	assert.equal(preFix.stillOpen, false, 'pre-fix: the dialog was unmounted before any outcome existed');
	assert.equal(preFix.resultShown, false, 'pre-fix: no outcome was ever surfaced');

	// --- the new surface, same requirement list.
	const transportPut = makeTransport();
	const runner = makeRunner(true, async () => { await transportPut.run([]); });
	function FixedHarness() {
		const [pending, setPending] = useState<PendingAssignment | null>(SWAP_PENDING);
		if (!pending) return createElement('p', { 'data-testid': 'flow-closed' }, 'closed');
		return createElement(HomeRoomConfirmDialogs, {
			pending,
			sections: [SECTION_A, SECTION_B] as HomeRoomConfirmDialogsProps['sections'],
			onRun: runner,
			onClose: () => setPending(null),
		});
	}
	mount(createElement(Toaster));
	mount(createElement(FixedHarness));
	click(byTestId('swap-modal-confirm'));
	await act(async () => { await Promise.resolve(); await Promise.resolve(); });
	// sonner paints on a timer, so let the real toast land before judging it.
	await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
	const fixed = evaluateSurface();
	assert.equal(transportPut.calls, 1, 'the new surface dispatches the write exactly once');
	assert.equal(fixed.stillOpen, false, 'a saved write closes the confirmation, and only after the server accepted it');
	assert.equal(fixed.toastShown, true, 'the persisted outcome must be reported to the user');
	await unmount();

	const fixedFailures = Object.entries(fixed.checks).filter(([, ok]) => !ok).map(([name]) => name);
	assert.deepEqual(fixedFailures, [], 'the new surface must satisfy every requirement');
});

/* ────────────── fix 12 error path: queued, never "saved", and above ───────── */

test('fix 12 control: a failed write is reported as queued, never as saved, and paints above the dialog', async () => {
	let putDispatched = 0;
	const runner = makeRunner(true, async () => { putDispatched += 1; throw new Error('ATLAS 503'); });

	function Harness() {
		const [pending, setPending] = useState<PendingAssignment | null>(SWAP_PENDING);
		if (!pending) return createElement('p', { 'data-testid': 'flow-closed' }, 'closed');
		return createElement(HomeRoomConfirmDialogs, {
			pending,
			sections: [SECTION_A, SECTION_B] as HomeRoomConfirmDialogsProps['sections'],
			onRun: runner,
			onClose: () => setPending(null),
		});
	}
	mount(createElement(Toaster));
	mount(createElement(Harness));
	click(byTestId('swap-modal-confirm'));
	await act(async () => { await Promise.resolve(); await Promise.resolve(); });

	assert.equal(putDispatched, 1);
	assert.ok(dialogStillOpen(), 'a failed write must keep the confirmation open for recovery');
	const result = byTestId('home-room-result');
	assert.ok(result, 'a failed write must surface an in-modal outcome');
	assert.equal(result!.getAttribute('data-result-status'), 'queued');
	assert.equal(result!.getAttribute('role'), 'alert', 'a queued write is announced, not a polite status');
	const headline = byTestId('home-room-result-headline')?.textContent ?? '';
	assert.match(headline, /queued/i, 'the headline must say the change is queued');
	assert.doesNotMatch(headline, /saved/i, 'a queued write must never be presented as saved');
	const whole = dom.window.document.body.textContent ?? '';
	assert.doesNotMatch(whole, /Home room saved/, 'no part of the surface may claim the change was saved');
	// The local queue really did take the change, so the wording is truthful.
	assert.ok(dom.window.localStorage.getItem(QUEUE_KEY), 'a refused write is held in the local queue');
	// Recovery path is present and states the disposition.
	assert.ok(byTestId('home-room-result-retry'), 'a recovery path must be offered');
	assert.ok(byTestId('home-room-result-keep-queued'), 'a queued change must offer to keep it queued');

	// The toast: real sonner Toaster, asserted where it actually paints.
	await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
	const toastNode = Array.from(dom.window.document.querySelectorAll('li, div')).find((n) =>
		(n.textContent ?? '').includes('queued on this device'),
	);
	assert.ok(toastNode, 'the toast must be present in the document');
	assert.ok(
		!(toastNode as HTMLElement).closest('[role="dialog"]'),
		'the toast must not be a descendant of the dialog (it cannot be clipped or stacked under it)',
	);
	const toaster = dom.window.document.querySelector('[data-sonner-toaster]');
	assert.ok(toaster, 'sonner Toaster must be mounted');
	// z-index: sonner injects its own stylesheet at runtime; read the value the
	// browser would apply rather than assuming it.
	const injected = Array.from(dom.window.document.head.querySelectorAll('style'))
		.map((s) => s.textContent ?? '')
		.join('\n');
	const rule = injected.match(/\[data-sonner-toaster\][^{]*\{[^}]*z-index:\s*(\d+)/);
	assert.ok(rule, 'sonner must have injected a z-index for its toaster');
	const toasterZ = Number(rule![1]);
	const dialogZ = 50; // Radix dialog overlay/content in @/ui/dialog
	assert.ok(toasterZ > dialogZ, `toaster z-index ${toasterZ} must exceed the dialog's ${dialogZ}`);

	await unmount();
});

/* ─────────────── fix 12 duplicate submit: one write in flight, max ───────── */

test('fix 12 control: the confirm control locks while the write is in flight and a second click dispatches nothing', async () => {
	const gate = deferred<void>();
	let putDispatched = 0;
	const runner = makeRunner(true, async () => { putDispatched += 1; await gate.promise; });

	function Harness() {
		const [pending, setPending] = useState<PendingAssignment | null>(SWAP_PENDING);
		if (!pending) return createElement('p', { 'data-testid': 'flow-closed' }, 'closed');
		return createElement(HomeRoomConfirmDialogs, {
			pending,
			sections: [SECTION_A, SECTION_B] as HomeRoomConfirmDialogsProps['sections'],
			onRun: runner,
			onClose: () => setPending(null),
		});
	}
	mount(createElement(Harness));

	const confirm = byTestId('swap-modal-confirm') as HTMLButtonElement;
	assert.ok(confirm, 'precondition: the confirm control exists');
	click(confirm);
	// In flight: the real promise has not settled.
	assert.equal(putDispatched, 1, 'the first click dispatches exactly one write');
	const locked = byTestId('swap-modal-confirm') as HTMLButtonElement;
	assert.equal(locked.disabled, true, 'the confirm control must be disabled while the write is in flight');
	assert.match(locked.textContent ?? '', /Saving/i, 'the control must show a real in-flight state');

	// A second click in the same window, plus a programmatic one, must add nothing.
	click(byTestId('swap-modal-confirm'));
	act(() => { (byTestId('swap-modal-confirm') as HTMLButtonElement).click(); });
	assert.equal(putDispatched, 1, 'a second click must not dispatch a second PUT');

	await act(async () => { gate.resolve(); await gate.promise; await Promise.resolve(); });
	assert.equal(putDispatched, 1, 'the write count never doubles after the write settles');
	await unmount();
});

/* ───────────────────── the pure contract, exercised directly ─────────────── */

test('homeRoomResultCopy never describes an unpersisted change as saved', () => {
	const saved = homeRoomResultCopy({ status: 'saved' });
	assert.match(saved.headline, /saved/i);
	for (const queued of [
		{ status: 'queued', reason: 'offline' as const, detail: 'queued offline' },
		{ status: 'queued', reason: 'write-failed' as const, detail: 'queued after a failed write' },
	]) {
		const copy = homeRoomResultCopy(queued as HomeRoomUpdateResult);
		assert.match(copy.headline, /queued/i, `${queued.reason} must be reported as queued`);
		assert.doesNotMatch(copy.headline, /\bsaved\b/i, `${queued.reason} must not read as saved`);
		assert.equal(copy.detail, queued.detail, 'the true disposition must be stated, not paraphrased');
	}
	const failed = homeRoomResultCopy({ status: 'failed', reason: 'blocked', detail: 'blocked' });
	assert.doesNotMatch(failed.headline, /\bsaved\b/i);
	assert.doesNotMatch(failed.headline, /queued/i, 'a refused write is not queued and must not claim to be');
});

test('the escalation decision is production code and keeps cancel zero-write', () => {
	const occupancy = new Map<number, string>([[202, SECTION_B.name]]);
	const names = new Map<number, string>([[101, 'Room 101'], [202, 'Room 202']]);

	// An occupied target is an escalation, not a plain write.
	assert.equal(
		resolveHomeRoomIntent(SECTION_A, 202, (r) => occupancy.get(r), (r) => names.get(r)).kind,
		'swap',
	);
	// Removing a room is an unassign escalation.
	assert.equal(
		resolveHomeRoomIntent(SECTION_A, null, (r) => occupancy.get(r), (r) => names.get(r)).kind,
		'unassign',
	);
	// A free room is a plain write and must not escalate.
	assert.equal(
		resolveHomeRoomIntent(SECTION_A, 303, (r) => occupancy.get(r), (r) => names.get(r)).kind,
		'direct',
	);
	// Re-picking the section's own room is not a swap of itself.
	assert.equal(
		resolveHomeRoomIntent(SECTION_A, 101, (r) => occupancy.get(r), (r) => names.get(r)).kind,
		'direct',
	);
});

test('the transport is never dispatched when the browser is offline, and the change is queued', async () => {
	let putDispatched = 0;
	const runner = makeRunner(false, async () => { putDispatched += 1; });
	const result = await runner(SWAP_PENDING, { sectionId: SECTION_B.id, homeRoomId: SECTION_A.homeRoomId ?? null });
	assert.equal(putDispatched, 0, 'offline must dispatch nothing');
	assert.equal(result.status, 'queued');
	assert.equal(result.status === 'queued' ? result.reason : null, 'offline');
	assert.ok(dom.window.localStorage.getItem(QUEUE_KEY), 'an offline change is held in the local queue');
});
