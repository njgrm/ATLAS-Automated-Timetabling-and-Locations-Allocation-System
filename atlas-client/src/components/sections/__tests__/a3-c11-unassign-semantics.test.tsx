/**
 * A3 c11 FIX-08 - RENDERED: the Assign Home Room header tells the truth about
 * what a control will do.
 *
 * THE OPERATOR'S WORDS, as recorded: `Clear Selection` is present "even when no
 * room is selected, which makes the control look actionable when there is
 * nothing to clear", and it is ambiguous - it does not say whether it means
 * local deselection or permanent unassignment. The review forbade implementing
 * both readings. Planner A3 decided Option C and this suite proves Option C is
 * the ONLY branch shipped:
 *
 *   (a) no control named or labelled like Clear/Deselect exists in the header,
 *   (b) `Unassign Room` is absent when the section has no home room, and is
 *       present and destructive when it has one,
 *   (c) `Confirm Assignment` is disabled with nothing staged, and - the
 *       staging auditor's exact failure - invoking the handler anyway performs
 *       no `onSelect` and opens no confirmation, so it can never behave as a
 *       silent destructive unassign,
 *   (d) re-picking the room that is already selected leaves it selected (no
 *       ambiguous toggle-off), while a different room replaces the pick,
 *   (e) `Unassign Room` opens the EXISTING `UnassignConfirmationModal` with the
 *       section and current room named, and mutates nothing by itself.
 *
 * HOW THIS IS EVIDENCE: every assertion reads the RENDERED document, through
 * the real `SectionRoomMapModal`, the real `HomeRoomConfirmDialogs` and the real
 * `UnassignConfirmationModal`. Only the transport is stubbed, and the stub
 * counts writes so "mutates nothing" is decided by a counter rather than by
 * reading source. The `pages/Sections.tsx` wiring is checked by a source ratchet
 * at the end, because the page itself is not mounted (the house rule: mounting a
 * 1000-line page that opens a supervised fetch would test the harness).
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

/**
 * Writes are counted, never merely absent: FIX-08's whole point is that a
 * control which LOOKS like it removes an assignment must not remove one, so the
 * stub has to be able to say "0 writes happened" as a fact.
 */
const transport = { puts: [] as unknown[], posts: [] as unknown[] };
const BUILDINGS = [{
	id: 1, name: 'Grade 9 Academic Wing', floorCount: 2, x: 0, y: 0, width: 100, height: 80,
	color: '#e11d48', rotation: 0, gradeScope: [], isTeachingBuilding: true,
	rooms: [
		{ id: 401, name: 'G9 Room 401', type: 'CLASSROOM', capacity: 40, isTeachingSpace: true, floor: 1, floorPosition: 1 },
		{ id: 402, name: 'G9 Room 402', type: 'CLASSROOM', capacity: 40, isTeachingSpace: true, floor: 1, floorPosition: 2 },
	],
}];

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async (url: string) => {
			if (url.includes('/map/schools/1/buildings')) return { data: { buildings: BUILDINGS } };
			throw new Error(`unexpected GET in the unassign control: ${url}`);
		},
		put: async (url: string, body: unknown) => { transport.puts.push({ url, body }); return { data: {} }; },
		post: async (url: string, body: unknown) => { transport.posts.push({ url, body }); return { data: {} }; },
		patch: async () => ({ data: {} }),
		delete: async () => ({ data: {} }),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

installCanvasShim(dom.window as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } });

const { act, createElement, Fragment, useState } = await import('react');
const { createRoot } = await import('react-dom/client');
type Root = import('react-dom/client').Root;
const { SectionRoomMapModal } = await import('../SectionRoomMapModal');
const { HomeRoomConfirmDialogs } = await import('../HomeRoomConfirmDialogs');
import type { PendingAssignment } from '../HomeRoomConfirmDialogs';
const { resolveHomeRoomIntent } = await import('../homeRoomPersistence');
type Building = import('@/types').Building;

const SECTION = { id: 11, name: 'Grade 9 - Sampaguita', homeRoomId: 401 } as unknown as PendingAssignment['section'];
/** The same shape with nothing assigned: there is nothing to unassign. */
const SECTION_NO_ROOM = { id: 12, name: 'Grade 9 - Makakalikasan', homeRoomId: null } as unknown as PendingAssignment['section'];
const ROOM_NAMES = new Map<number, string>([[401, 'G9 Room 401'], [402, 'G9 Room 402']]);
const OCCUPANTS = new Map<number, string>();

let root: Root | null = null;
let renderSeq = 0;

const doc = () => dom.window.document as unknown as HTMLElement;
/** `document.textContent` is `null` per the DOM spec (Document is one of the two
 *  node types with no text of its own), so the operator's screen is read from
 *  `body`. */
const bodyText = () => dom.window.document.body.textContent ?? '';
const byTestId = (id: string) => doc().querySelector<HTMLElement>(`[data-testid="${id}"]`);
const dialogText = () => doc().querySelector('[role="dialog"]')?.textContent ?? bodyText();

function click(el: HTMLElement | null, label: string) {
	assert.ok(el, `control tried to click a missing control: ${label}`);
	act(() => { el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

/** A click that DISPATCHES, so a disabled control's handler is still reached.
 *  This is the only way to prove the guard is in the code and not merely in the
 *  `disabled` attribute, which is the staging auditor's exact failure. */
function forceClick(el: HTMLElement | null, label: string) {
	assert.ok(el, `control tried to force-click a missing control: ${label}`);
	act(() => { el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

/** Source with every comment removed, so a scan judges CODE and not prose. */
function codeOf(path: string): string {
	return readFileSync(resolve(import.meta.dirname, path), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^[ \t]*\/\/.*$/gm, '');
}

type HarnessOptions = {
	currentRoomId: number | null;
	section?: PendingAssignment['section'];
	canWrite?: boolean;
	writeBlockedReason?: string | null;
	/** Wire the page's real intent resolution + confirmation surface. */
	withConfirmation?: boolean;
	onSelect?: (roomId: number | null) => void;
};

/**
 * The page's own wiring, transcribed: `onSelect` -> `resolveHomeRoomIntent` ->
 * `pendingAssignment` -> `HomeRoomConfirmDialogs`, which is exactly the code path
 * in `pages/Sections.tsx` (asserted by the source ratchet at the end).
 */
function Harness(props: HarnessOptions) {
	const [pending, setPending] = useState<PendingAssignment | null>(null);
	const [selected, setSelected] = useState<number[]>([]);

	function handleSelect(roomId: number | null) {
		props.onSelect?.(roomId);
		setSelected((current) => [...current, roomId === null ? -1 : roomId]);
		if (!props.withConfirmation) return;
		const section = props.section ?? SECTION;
		const intent = resolveHomeRoomIntent(
			section,
			roomId,
			(id: number) => OCCUPANTS.get(id),
			(id: number) => ROOM_NAMES.get(id),
		);
		if (intent.kind === 'unassign') {
			setPending({ section, roomId: null, type: 'unassign', currentRoomName: intent.currentRoomName });
			return;
		}
		if (intent.kind === 'swap') {
			setPending({
				section, roomId, type: 'swap',
				displacedSection: intent.displacedSectionName,
				currentRoomName: intent.currentRoomName,
				targetRoomName: intent.targetRoomName,
			});
			return;
		}
		setPending({ section, roomId, type: 'direct' });
	}

	return createElement(
		Fragment,
		null,
		createElement(SectionRoomMapModal, {
			open: true,
			onOpenChange: () => {},
			sectionName: (props.section ?? SECTION).name,
			sectionId: (props.section ?? SECTION).id,
			currentRoomId: props.currentRoomId,
			onSelect: handleSelect,
			schoolId: 1,
			roomOccupancy: new Map<number, string>(),
			canWrite: props.canWrite ?? true,
			writeBlockedReason: props.writeBlockedReason ?? null,
		}),
		pending ? createElement(HomeRoomConfirmDialogs, {
			pending,
			sections: [props.section ?? SECTION] as never,
			onRun: async () => ({ status: 'failed' as const, reason: 'blocked' as const, detail: 'not attempted in this control' }),
			onClose: () => setPending(null),
		}) : null,
		createElement('output', { 'data-testid': 'harness-selected' }, JSON.stringify(selected)),
	);
}

/** ONE root for the whole suite, re-rendered per case: mounting a fresh Radix
 *  portal each time left stale nodes in `body` for the later cases. */
function ensureRoot(): Root {
	if (!root) {
		const container = dom.window.document.createElement('div');
		dom.window.document.body.appendChild(container);
		root = createRoot(container);
	}
	return root;
}

async function render(props: HarnessOptions) {
	const r = ensureRoot();
	// A fresh key per case, so no case inherits another case's staged state or
	// its selection log.
	renderSeq += 1;
	await act(async () => {
		r.render(createElement(Harness, { ...props, key: renderSeq } as never));
		await new Promise((resolve) => setTimeout(resolve, 0));
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
	return doc();
}

function selectedCalls(): number[] {
	return JSON.parse(byTestId('harness-selected')?.textContent ?? '[]') as number[];
}

/** The sidebar's room row for a named room. */
function roomRow(name: string): HTMLButtonElement | null {
	for (const button of Array.from(doc().querySelectorAll('button'))) {
		if ((button.textContent ?? '').includes(name)) return button as HTMLButtonElement;
	}
	return null;
}

/* ------------------- (a) no ambiguous Clear/Deselect control ------------------ */

test('FIX-08 (a) RENDERED: the header offers no control named like Clear or Deselect', async () => {
	await render({ currentRoomId: 401 });
	const controls = Array.from(doc().querySelectorAll('button'));
	const named = controls.map((b) => `${(b.textContent ?? '').trim()} [${b.getAttribute('aria-label') ?? ''}]`);
	for (const control of controls) {
		const label = `${(control.textContent ?? '').trim()} ${control.getAttribute('aria-label') ?? ''}`;
		assert.doesNotMatch(
			label,
			/\b(clear|deselect)\b/i,
			`the header must not carry a control that reads as local deselection: ${label}`,
		);
	}
	// The controls the header DOES own, spelled out so a reviewer can see the whole
	// surface in one line. Exactly two: the removal, and the confirm.
	const headerNames = named.filter((n) => /Confirm Assignment|Unassign Room/.test(n));
	assert.equal(headerNames.length, 2, `expected exactly two header actions, saw: ${headerNames.join(' | ')}`);
	assert.match(headerNames[0], /Unassign Room/, 'the removal is named as a removal');
	assert.match(headerNames[1], /Confirm Assignment/);
	// And the base control is gone from the CODE, not merely hidden, so it cannot
	// come back with a different label.
	const modalCode = codeOf('../SectionRoomMapModal.tsx');
	assert.doesNotMatch(modalCode, /Clear Selection/, 'the Clear Selection control must be gone');
	assert.doesNotMatch(modalCode, /Deselect Room/, 'Option B must not ship alongside Option C');
	assert.doesNotMatch(modalCode, /setSelectedRoomId\(null\)/, 'staged state must never be nulled by a header control');
});

/* ---------------- (b) Unassign Room: conditional and destructive ------------- */

test('FIX-08 (b) RENDERED: Unassign Room is absent with no home room, and destructive when there is one', async () => {
	await render({ currentRoomId: null, section: SECTION_NO_ROOM });
	assert.equal(
		byTestId('room-map-unassign'),
		null,
		'a section with nothing assigned must not be offered an unassign control - there is nothing to remove',
	);

	await render({ currentRoomId: 401 });
	const unassign = byTestId('room-map-unassign');
	assert.ok(unassign, 'a section WITH a home room must offer the persisted removal');
	assert.match(unassign!.textContent ?? '', /Unassign Room/, 'and it must be named as a removal, not a deselect');
	assert.match(unassign!.className, /text-destructive/, `the destructive pattern is required, got "${unassign!.className}"`);
	assert.match(unassign!.className, /border-destructive/, 'and its border must carry the destructive token too');
});

/* ------------- (c) Confirm cannot act as a silent destructive unassign ------- */

test('FIX-08 (c) RENDERED: with nothing staged, Confirm Assignment is disabled AND its handler does nothing', async () => {
	const onSelectCalls: Array<number | null> = [];
	// A section that already has a home room: on the base revision Confirm was
	// enabled and `onSelect(null)` reached the unassign path. That is the exact
	// failure the staging auditor recorded.
	await render({ currentRoomId: 401, onSelect: (id) => onSelectCalls.push(id) });
	let confirm = byTestId('room-map-confirm') as HTMLButtonElement;
	assert.ok(confirm, 'the confirm control exists');
	assert.equal(confirm.disabled, true, 'Confirm must be disabled when the staged pick is the room already assigned');
	const reason = byTestId('room-map-confirm-reason');
	assert.ok(reason, 'a disabled primary action must state why');
	assert.match(reason!.textContent ?? '', /already assigned/i);

	// The decisive part: reach the handler anyway.
	forceClick(confirm, 'Confirm Assignment');
	// `[...onSelectCalls]`: `assert.deepEqual` is an assertion signature, so
	// asserting the array itself would narrow it to `never[]` for the rest of
	// the block and the next push would not type-check.
	assert.deepEqual([...onSelectCalls], [], 'the handler must not call onSelect - in particular never with null');
	assert.equal(byTestId('unassign-modal-confirm'), null, 'and no confirmation dialog may open');
	assert.equal(transport.puts.length, 0, 'and nothing may be written');

	// A section with no home room and no staged pick: also inert.
	await render({ currentRoomId: null, section: SECTION_NO_ROOM, onSelect: (id: number | null) => onSelectCalls.push(id) });
	confirm = byTestId('room-map-confirm') as HTMLButtonElement;
	assert.equal(confirm.disabled, true, 'Confirm must be disabled with nothing staged at all');
	assert.match(byTestId('room-map-confirm-reason')?.textContent ?? '', /Pick a room/i);
	forceClick(confirm, 'Confirm Assignment (empty)');
	assert.deepEqual([...onSelectCalls], [], 'still no onSelect: a null selection is not an unassign');
	assert.equal(byTestId('unassign-modal-confirm'), null);
	assert.equal(transport.puts.length, 0);
});

test('FIX-08 (c) RENDERED: Confirm is also unavailable when the owner says the write cannot happen', async () => {
	const onSelectCalls: Array<number | null> = [];
	const blocked = 'Home-room change not saved. ATLAS is still checking the section source, so nothing was written.';
	await render({ currentRoomId: 401, canWrite: false, writeBlockedReason: blocked, onSelect: (id) => onSelectCalls.push(id) });
	// Stage a DIFFERENT room, so the only thing that can block the confirm is the
	// owner's write gate.
	click(roomRow('G9 Room 402'), 'room row 402');
	const confirm = byTestId('room-map-confirm') as HTMLButtonElement;
	assert.equal(confirm.disabled, true, 'an unwritable page must not offer a working Confirm');
	assert.equal(byTestId('room-map-confirm-reason')?.textContent, blocked, "and it must show the owner's own not-saved sentence");
	forceClick(confirm, 'Confirm Assignment (blocked)');
	assert.deepEqual([...onSelectCalls], [], 'no onSelect: the click cannot be written, so it must not be accepted');
	assert.equal(byTestId('unassign-modal-confirm'), null);
	assert.equal(transport.puts.length, 0);
	// And the removal control is unavailable for the same reason.
	assert.equal((byTestId('room-map-unassign') as HTMLButtonElement).disabled, true, 'Unassign must be unavailable too');
});

test('FIX-08 RENDERED: a genuinely different room makes Confirm available and reports the pick', async () => {
	const onSelectCalls: Array<number | null> = [];
	await render({ currentRoomId: 401, onSelect: (id) => onSelectCalls.push(id) });
	click(roomRow('G9 Room 402'), 'room row 402');
	const confirm = byTestId('room-map-confirm') as HTMLButtonElement;
	assert.equal(confirm.disabled, false, 'a real change is available');
	assert.equal(byTestId('room-map-confirm-reason'), null, 'and no reason is shown when there is nothing to explain');
	assert.match(bodyText(), /G9 Room 402/, 'the staged pick is visible in the Active Selection panel');
	click(confirm, 'Confirm Assignment');
	assert.deepEqual(onSelectCalls, [402], 'Confirm reports exactly the staged room');
});

/* -------------------------- (d) no ambiguous toggle-off --------------------- */

test('FIX-08 (d) RENDERED: re-picking the selected room leaves it selected; another room replaces it', async () => {
	await render({ currentRoomId: 401 });
	// The room is already selected when the dialog opens.
	assert.match(bodyText(), /G9 Room 401/, 'the current room is the active selection');
	click(roomRow('G9 Room 401'), 'room row 401 (already selected)');
	assert.match(bodyText(), /G9 Room 401/, 'it must still be selected - a second pick is not a deselect');
	assert.equal(
		(byTestId('room-map-confirm') as HTMLButtonElement).disabled,
		true,
		'and Confirm stays disabled, because nothing changed',
	);
	// A different room replaces the staged pick.
	click(roomRow('G9 Room 402'), 'room row 402');
	assert.match(bodyText(), /G9 Room 402/, 'a different room becomes the staged pick');
	assert.equal((byTestId('room-map-confirm') as HTMLButtonElement).disabled, false);
});

/* ---- (e) the unassign control routes to the EXISTING confirmation modal ----- */

test('FIX-08 (e) RENDERED: Unassign Room opens the existing confirmation, names the room, and writes nothing', async () => {
	const onSelectCalls: Array<number | null> = [];
	const queueKey = 'atlas:sections-home-room-queue:v1:1:7';
	dom.window.localStorage.clear();
	await render({ currentRoomId: 401, withConfirmation: true, onSelect: (id) => onSelectCalls.push(id) });

	click(byTestId('room-map-unassign'), 'Unassign Room');

	// The EXISTING modal, reached through the page's real intent resolution.
	const confirmInDialog = byTestId('unassign-modal-confirm');
	assert.ok(confirmInDialog, 'the existing UnassignConfirmationModal must open');
	assert.ok(byTestId('unassign-modal-keep'), 'with its own safe option');
	const text = dialogText();
	assert.match(text, /Grade 9 - Sampaguita/, 'the confirmation names the section');
	assert.match(text, /G9 Room 401/, 'and the room being removed');
	assert.match(confirmInDialog!.textContent ?? '', /remove home room/i, 'and the destructive action is named as a removal');
	assert.match(confirmInDialog!.className, /destructive/, `the confirm must be the destructive variant, got "${confirmInDialog!.className}"`);
	// It asked; it did not act.
	assert.deepEqual(onSelectCalls, [null], 'the modal asked for the removal through the page (onSelect(null)) exactly once');
	assert.equal(transport.puts.length, 0, 'the control itself must not write');
	assert.equal(transport.posts.length, 0, 'nor post anything');
	assert.equal(dom.window.localStorage.getItem(queueKey), null, 'nor write to the local queue');
	assert.equal(byTestId('home-room-result'), null, 'and it must not claim an outcome before one exists');
});

/* ------------------- the page wiring this suite transcribes ----------------- */

test('FIX-08 wiring ratchet: the page still routes an unassign request to the existing confirmation', () => {
	const page = codeOf('../../../pages/Sections.tsx');
	assert.match(page, /if \(intent\.kind === 'unassign'\) \{/, 'the page must still resolve an unassign intent');
	assert.match(page, /type: 'unassign',/, 'and still mark the pending assignment as an unassign');
	assert.match(
		page,
		/homeRoomWrite=\{homeRoomWrite\}/,
		'the page must hand its ONE write gate to the map modal surface (FIX-12)',
	);
	// The §8 extraction moved the modal mounts out of the page, so the gate is now
	// passed to the extracted surface and applied there. Asserting BOTH halves is
	// stronger than the single-page row this replaces: a gate that stops at the
	// page, or one the extracted surface drops, both fail.
	const mapModals = codeOf('../SectionsHomeRoomMapModals.tsx');
	assert.match(
		mapModals,
		/canWrite=\{homeRoomWrite\.canWrite\}[\s\S]{0,200}writeBlockedReason=\{homeRoomWrite\.notSavedNotice\}/,
		'the map modal must be told the write gate (FIX-12)',
	);
	assert.match(
		mapModals,
		/canWrite=\{false\}[\s\S]{0,200}writeBlockedReason=\{GLOBAL_BROWSE_BLOCKED_REASON\}/,
		'the school-wide browse surface stays a read with its own stated reason',
	);
	const modal = codeOf('../SectionRoomMapModal.tsx');
	assert.match(modal, /onSelect\(null\);/, 'the Unassign control must route through onSelect(null)');
	assert.doesNotMatch(modal, /atlasApi\.put/, 'the modal must never write the assignment itself');
	assert.doesNotMatch(modal, /UnassignConfirmationModal/, 'the modal must not build a second confirmation');
	// HomeRoomConfirmDialogs owns the single unassign dialog.
	const dialogs = codeOf('../HomeRoomConfirmDialogs.tsx');
	assert.match(dialogs, /<UnassignConfirmationModal\s+open=\{pending\.type === 'unassign'\}/, 'one existing confirmation surface, keyed on the unassign intent');
});

test('the selected-call log is a real log, not a stub that cannot fail', async () => {
	await render({ currentRoomId: 401, onSelect: () => {} });
	assert.deepEqual(selectedCalls(), [], 'precondition: nothing is selected before any interaction');
	click(byTestId('room-map-unassign'), 'Unassign Room');
	assert.deepEqual(selectedCalls(), [-1], 'the unassign request is recorded, so the assertions above are load-bearing');
});
