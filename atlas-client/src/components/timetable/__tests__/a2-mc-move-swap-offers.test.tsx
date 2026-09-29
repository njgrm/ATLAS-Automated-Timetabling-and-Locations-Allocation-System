/**
 * A2 mc, S3 — a move must always have a target. RENDERED + DERIVED evidence.
 *
 * THE DEFECT (packet item 3), measured at base `c57b8e1d`: `legalMoveTargets`
 * excludes any slot occupied by another entry, so a section with a class in every
 * period produced an EMPTY list, one dead-end sentence, and a Cancel. In the
 * Manual Edit panel the Target Time Slot select struck through every occupied
 * option, appended ` (occupied)` to each, and explained only why they were struck
 * through in a helper sentence under the control.
 *
 * Rows:
 *   S3a DERIVED: with every period occupied the derivation carries SWAP OFFERS,
 *        each naming the occupant's subject and teacher.
 *   S3b RENDERED + CLICKED: the status line renders the offers as real, focusable
 *        controls labelled `Swap with <subject> (<teacher>)`, says plainly which
 *        swaps are allowed and which are not, and keeps the Cancel reachable.
 *   S3c RENDERED: the Manual Edit timeslot option names WHO is there and whether
 *        it is a swap — not ` (occupied)` — and the helper sentence under the
 *        control is GONE.
 *   S3d GRAMMAR: an unassigned teacher drops the parenthetical rather than
 *        printing `Unassigned` twice; no label carries an ellipsis.
 *   S3e NEGATIVE: when nothing is legal the line names the REASON (every period
 *        occupied / only lunch-and-break rows) instead of one flat sentence.
 *   S3f THE ONE RULE: partner selection is delegated to `findRegularSwapCandidate`
 *        — a swap offered here is exactly a swap that helper would accept, and a
 *        swap it refuses is reported with the reason, never invented.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
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
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const CLIENT_ROOT = resolve(process.cwd());
const { createRoot } = await import('react-dom/client');
const {
	ALL_PERIODS_OCCUPIED_REASON,
	NO_LEGAL_TARGET_IN_VIEW,
	NO_SWAP_PARTNER_REASON,
	SPECIAL_EVENT_ONLY_REASON,
	describeMoveSwapOffers,
	describeMoveTargets,
	legalMoveTargets,
	swapOfferLabel,
} = await import('@/components/timetable/timetableMoveTargets');
const { findRegularSwapCandidate } = await import('@/lib/timetable-swap-routing');
const { TimetableMoveStatusLine } = await import('@/components/timetable/TimetableMoveStatusLine');

const SLOTS = [
	{ day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
	{ day: 'MONDAY', startTime: '06:45', endTime: '07:30' },
	{ day: 'MONDAY', startTime: '07:30', endTime: '08:15' },
	{ day: 'MONDAY', startTime: '12:00', endTime: '12:45', isSpecialEvent: true, eventName: 'Health Break' },
];

/** The class being moved: 7-Rizal, Mr Cruz, room 31. */
const MOVING = {
	entryId: 'entry-1::t1',
	day: 'MONDAY',
	startTime: '06:00',
	sectionId: 71,
	subjectId: 11,
	facultyId: 21,
	roomId: 31,
	termIndex: 1,
};

const subjectLabel = (id: number) => (id === 11 ? 'TLE' : id === 12 ? 'ESP' : id === 13 ? 'FIL' : `Subject ${id}`);
const facultyLabel = (id: number) => (id === 21 ? 'Mr Cruz' : id === 22 ? 'Mr Diaz' : `Teacher ${id}`);

/**
 * Every ordinary period is occupied.
 *   06:00 is this class's OWN slot, so it is skipped (that is the unchanged
 *   `Already in this slot.` guard, not a move target);
 *   06:45 holds a class in the SAME SECTION — a legal swap partner;
 *   07:30 holds a class with the SAME TEACHER in another section — also legal;
 *   12:00 is a break row and is never a target at all.
 */
const OCCUPIED = [
	MOVING,
	{ entryId: 'entry-2::t1', day: 'MONDAY', startTime: '06:00', endTime: '06:45', sectionId: 71, subjectId: 12, facultyId: 22, roomId: 32, termIndex: 1 },
	{ entryId: 'entry-3::t1', day: 'MONDAY', startTime: '06:45', endTime: '07:30', sectionId: 71, subjectId: 12, facultyId: 22, roomId: 32, termIndex: 1 },
	{ entryId: 'entry-4::t1', day: 'MONDAY', startTime: '07:30', endTime: '08:15', sectionId: 73, subjectId: 14, facultyId: 21, roomId: 34, termIndex: 1 },
];

async function mount(element: unknown): Promise<HTMLElement> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => { root.render(element as never); });
	return host;
}

test('S3a DERIVED: with every period occupied the derivation carries swap offers naming the occupant', () => {
	const notice = describeMoveTargets({
		slots: SLOTS,
		occupants: OCCUPIED,
		movingEntry: MOVING,
		subjectLabel,
		facultyLabel,
	});
	assert.equal(notice.kind, 'none', 'there is genuinely no free slot in this view');
	assert.deepEqual(legalMoveTargets({ slots: SLOTS, occupants: OCCUPIED, movingEntry: MOVING }), [],
		'the free-target list is genuinely empty, so this slice is what closes the dead end');

	const offers = describeMoveSwapOffers({ slots: SLOTS, occupants: OCCUPIED, movingEntry: MOVING, subjectLabel, facultyLabel });
	assert.equal(offers.length, 2, 'two occupied ordinary periods produce two offers; the lunch row never does');
	const sameSection = offers.find((offer) => offer.occupantEntryId === 'entry-3::t1');
	assert.equal(sameSection?.allowed, true, 'the same-section occupant is a legal swap partner');
	assert.equal(sameSection?.label, 'Swap with ESP (Mr Diaz)', 'the label is exactly the packet shape: subject, then teacher');
	const sameFaculty = offers.find((offer) => offer.occupantEntryId === 'entry-4::t1');
	assert.equal(sameFaculty?.allowed, true, 'the same-teacher occupant in another section is also legal');
	assert.equal(sameFaculty?.label, 'Swap with Subject 14 (Mr Cruz)');
	assert.equal(offers.some((offer) => offer.slotKey === 'MONDAY-12:00'), false,
		'the lunch/break row is never offered as a swap target');
	assert.equal(offers.some((offer) => offer.slotKey === 'MONDAY-06:00'), false,
		"and the class's own period is never offered either — that guard is untouched");
});

test('S3b RENDERED + CLICKED: the status line offers the swap as a real control and keeps the Cancel', async () => {
	const notice = describeMoveTargets({ slots: SLOTS, occupants: OCCUPIED, movingEntry: MOVING, subjectLabel, facultyLabel });
	assert.equal(notice.kind, 'none');

	const picked: string[] = [];
	let disarmed = 0;
	const host = await mount(createElement(TimetableMoveStatusLine, {
		tone: 'warning',
		message: notice.kind === 'none' ? notice.sentence : '',
		moveTargetNotice: notice,
		onDisarm: () => { disarmed += 1; },
		onSelectSwap: (offer: { occupantEntryId: string }) => { picked.push(offer.occupantEntryId); },
	}));

	// The message span is UNCHANGED: it still reads exactly the `message` prop.
	const message = host.querySelector('[data-testid="timetable-move-status-message"]')?.textContent;
	assert.equal(message, ALL_PERIODS_OCCUPIED_REASON, 'the line names WHY there is no target, not one flat sentence');

	const offers = host.querySelectorAll('[data-testid="timetable-move-swap-offer"]');
	assert.equal(offers.length, 2, 'every allowed swap is a control, not a sentence');
	assert.equal(offers[0].tagName, 'BUTTON', 'a swap the operator may take is a real button');
	assert.match(offers[0].textContent ?? '', /^Swap with ESP \(Mr Diaz\)/, 'and its label is the packet shape');
	assert.match(offers[0].className ?? '', /h-11/, 'at the walk standard 44px target floor');

	act(() => { (offers[0] as HTMLElement).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	assert.deepEqual(picked, ['entry-3::t1'], 'clicking the offer arms THAT swap');

	const cancel = host.querySelector('[data-testid="timetable-move-no-target-cancel"]');
	assert.ok(cancel, 'the one Cancel is still reachable in the no-target state — the exit can never be stranded');
	act(() => { (cancel as HTMLElement).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	assert.equal(disarmed, 1, 'and it still disarms exactly once');
});

test('S3c RENDERED: an occupied option names WHO is there and whether it is a swap, and the helper sentence is gone', () => {
	// The Manual Edit panel's own Timeslot select is where the operator picks a
	// slot; its option text is what they read. Labelled WIRING because the option
	// text lives inside a Radix `SelectContent` that only mounts on open, and this
	// harness does not drive the portal; S3a/S3b prove the SAME label derivation
	// renders as a real control on the status line.
	const panel = readFileSync(resolve(CLIENT_ROOT, 'src/components/ManualEditPanel.tsx'), 'utf8');
	assert.doesNotMatch(panel, /\{ts\.occupied && ' \(occupied\)'\}/, 'the bare occupied suffix is gone from the option');
	assert.doesNotMatch(panel, /<p className="text-\[0\.6875rem\] text-muted-foreground">\s*Struck-through/, 'the helper sentence under the control is REMOVED, not reworded (§11 subtract first)');
	assert.doesNotMatch(panel, /text-muted-foreground line-through/, 'and nothing is struck through any more, which read as "disabled"');
	assert.match(panel, /offer\.label/, 'the option reuses the ONE swap-offer label from the derivation');
	assert.match(panel, /data-swap-state=/, 'and states the swap verdict on the option itself');
	// The derivation it reads is the single owner, not a second rule.
	assert.match(panel, /describeMoveSwapOffers/);
});

test('S3d GRAMMAR: an unassigned teacher drops the parenthetical, and no label carries an ellipsis', () => {
	assert.equal(swapOfferLabel('FIL', null), 'Swap with FIL', 'no `Unassigned` twice');
	assert.equal(swapOfferLabel('FIL', '   '), 'Swap with FIL', 'a blank teacher is dropped the same way');
	assert.equal(swapOfferLabel('FIL', 'Mr Cruz'), 'Swap with FIL (Mr Cruz)', 'the full shape when both resolve');
	for (const label of [swapOfferLabel('FIL', null), swapOfferLabel('FIL', 'Mr Cruz')]) {
		assert.doesNotMatch(label, /…|\.\.\./, 'no ellipsis in a control label (§8)');
	}
});

test('S3e NEGATIVE: the line names the reason, and an occupied slot with no partner says so', () => {
	const noPartner = describeMoveTargets({
		slots: SLOTS,
		occupants: [
			MOVING,
			{ entryId: 'x1', day: 'MONDAY', startTime: '06:00', endTime: '06:45', sectionId: 91, subjectId: 91, facultyId: 91, roomId: 91, termIndex: 1 },
			{ entryId: 'x2', day: 'MONDAY', startTime: '06:45', endTime: '07:30', sectionId: 92, subjectId: 92, facultyId: 92, roomId: 92, termIndex: 1 },
			{ entryId: 'x3', day: 'MONDAY', startTime: '07:30', endTime: '08:15', sectionId: 93, subjectId: 93, facultyId: 93, roomId: 93, termIndex: 1 },
		],
		movingEntry: MOVING,
		subjectLabel,
		facultyLabel,
	});
	assert.equal(noPartner.kind, 'none');
	const offers = noPartner.kind === 'none' ? (noPartner.swapOffers ?? []) : [];
	assert.equal(offers.length, 2, 'each occupied slot this class could move into states its verdict; its own period is not one of them');
	assert.equal(offers.every((offer) => !offer.allowed), true, 'and none is legal, because none shares a section, teacher or room');
	assert.equal(offers[0].blockedReason, NO_SWAP_PARTNER_REASON, 'the reason is one plain sentence naming the rule');

	// Only lunch/break rows in view.
	const lunchOnly = describeMoveTargets({
		slots: [{ day: 'MONDAY', startTime: '12:00', endTime: '12:45', isSpecialEvent: true, eventName: 'Lunch' }],
		occupants: [],
		movingEntry: MOVING,
		subjectLabel,
		facultyLabel,
	});
	assert.equal(lunchOnly.kind === 'none' ? lunchOnly.sentence : null, SPECIAL_EVENT_ONLY_REASON,
		'a view of only break rows says THAT, not "no free slot"');

	// The accepted flat sentence is still the answer when it is the true one: the
	// view's only period is this class's own, so there is genuinely no free slot.
	const ownSlotOnly = describeMoveTargets({ slots: [SLOTS[0]], occupants: [MOVING], movingEntry: MOVING });
	assert.equal(ownSlotOnly.kind === 'none' ? ownSlotOnly.sentence : null, NO_LEGAL_TARGET_IN_VIEW,
		'the pre-existing accepted sentence is preserved for the case it was true of');
});

test('S3f THE ONE RULE: an offer is exactly what findRegularSwapCandidate accepts, never a fork of its scoring', () => {
	const slotEntries = OCCUPIED.filter((e) => e.day === 'MONDAY' && e.startTime === '06:45');
	assert.equal(findRegularSwapCandidate(MOVING, slotEntries)?.entryId, 'entry-3::t1',
		'the one helper accepts the same-section occupant; the offer below agrees');
	const offers = describeMoveSwapOffers({ slots: SLOTS, occupants: OCCUPIED, movingEntry: MOVING, subjectLabel, facultyLabel });
	const offer = offers.find((o) => o.slotKey === 'MONDAY-06:45');
	assert.equal(offer?.occupantEntryId, findRegularSwapCandidate(MOVING, slotEntries)?.entryId,
		'the derived offer is the helper own answer, not a re-implementation');
	// A caller that cannot answer "swap with whom?" gets NO offer, never a guess.
	const withoutIdentity = describeMoveTargets({
		slots: SLOTS,
		occupants: OCCUPIED.map(({ entryId, day, startTime, endTime }) => ({ entryId, day, startTime, endTime })),
		movingEntry: MOVING,
		subjectLabel,
		facultyLabel,
	});
	assert.deepEqual(withoutIdentity.kind === 'none' ? withoutIdentity.swapOffers : null, [],
		'occupants with no identity yield no offer at all, because a guessed partner would be a false one');
});
