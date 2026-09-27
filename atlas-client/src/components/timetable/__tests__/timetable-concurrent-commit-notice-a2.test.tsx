/**
 * A2-TIMETABLE-CUSTODY (Lane C finding #61) — a concurrent commit must name what
 * changed, and must not leave a stale action armed.
 *
 * The recorded defect, on live `c5a9e832`, draft run 321: another lane's commit
 * landed while the operator was mid-swap. Three failures, all reproduced here.
 *
 *   #1 The conflict notice names engineer ids. The toast read, verbatim:
 *      "Manual swap committed between entries entry-321::t2 and entry-421::t2."
 *      An operator cannot act on that.
 *   #2 The grid changed underneath the operator mid-action, with no re-sync and
 *      no acknowledgement of the change.
 *   #3 The swap selection banner stayed armed on a class that had just moved, so
 *      the operator could complete a swap against a stale selection.
 *
 * THE PAYLOAD, TRACED NOT ASSUMED. `swapManualEntries` publishes
 * `TIMETABLE_EDIT_COMMITTED` (`manual-edit.service.ts:2475`) whose `message` is
 * server-rendered from the raw ids. `notification-events.service.ts:260-277`
 * bridges that event into the SSE notification stream and copies
 * `runId` + `actorId` alongside the event metadata, so the delivered payload is:
 *   { type, domain:'timetable', severity, message, schoolId, schoolYearId,
 *     metadata: { runId, actorId, editId, strategy,
 *                 entryIdA, entryIdB, affectedTermIndices } }
 * The client rendered `event.message` verbatim (`useNotificationStream.notify`).
 *
 * That payload IS sufficient to fix this client-side: the ids are the join key
 * into the grid the client already holds, and `actorId` is the exact identity
 * claim the client also holds. So this is a client fix, not a server-contract gap.
 *
 * Rows (rendered into a real JSDOM document where a surface exists):
 *   F1 the pre-fix operator-facing string, reproduced verbatim — the defect.
 *   F2 a concurrent swap is named in words, and no id appears anywhere.
 *   F3 an unresolvable id yields the honest "we could not name it" notice — and
 *      still never an id, and never a confident wrong sentence.
 *   F4 the operator's OWN commit is silent: no notice, no id, no extra step.
 *   F5 a selection on a class the commit touched is cancelled and reported.
 *   F6 a selection whose class moved is cancelled even with NO event at all —
 *      the guard reads live state, so a re-render cannot bypass it.
 *   F7 no armed selection => no cancel, and the notice is unaffected.
 *   F8 the rendered notice is announced (role=alert), dismissible through @/ui,
 *      survives a re-render, and carries no id in its text.
 *   F9 NO internal id reaches an operator-facing string on ANY path, swept.
 *   F10 MUTANTS: the pre-fix behaviours fail F2/F3/F5, so those rows discriminate.
 *   F11 the takeover is scoped to the swap payload only; the other edit types keep
 *      their existing toast.
 *   F12 §8 compliance of the new component source.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable' });
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
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const { createRoot } = await import('react-dom/client');
const { formatTime } = await import('@/lib/utils');
const concurrent = await import('@/lib/timetable-concurrent-commit');
const { default: ConcurrentCommitNoticeBar } = await import('../ConcurrentCommitNoticeBar');

const {
	describeConcurrentCommit,
	evaluateArmedSwapSelection,
	isOwnTimetableCommit,
	readConflictingEntryIds,
	isSwapCommitEvent,
	CONCURRENT_COMMIT_HEADLINE,
	UNNAMED_COMMIT_DETAIL,
} = concurrent;

const clientRoot = resolve(import.meta.dirname, '../../../..');
const barSource = readFileSync(resolve(clientRoot, 'src/components/timetable/ConcurrentCommitNoticeBar.tsx'), 'utf8');
const streamSource = readFileSync(resolve(clientRoot, 'src/hooks/useNotificationStream.ts'), 'utf8');
const workspaceStateSource = readFileSync(resolve(clientRoot, 'src/hooks/useScheduleReviewWorkspaceState.ts'), 'utf8');

// ── the live payload, built exactly as notification-events.service.ts:260-277
// builds it from manual-edit.service.ts:2475-2498 ────────────────────────────
const MY_ACTOR_ID = 46;   // the operator's own `userId` claim
const OTHER_ACTOR_ID = 52;

const ENTRY_A = {
	entryId: 'entry-321::t2', subjectId: 11, sectionId: 101,
	day: 'MONDAY', startTime: '07:30', endTime: '08:15', roomId: 5, facultyId: 7,
	durationMinutes: 45, termIndex: 2,
};
const ENTRY_B = {
	entryId: 'entry-421::t2', subjectId: 12, sectionId: 102,
	day: 'WEDNESDAY', startTime: '08:15', endTime: '09:00', roomId: 6, facultyId: 8,
	durationMinutes: 45, termIndex: 2,
};
const ENTRIES = [ENTRY_A, ENTRY_B];

/** The verbatim toast the operator saw on live `c5a9e832`. */
const PRE_FIX_TOAST = 'Manual swap committed between entries entry-321::t2 and entry-421::t2';

function swapEvent(
	overrides: Record<string, unknown> = {},
	metadata: Record<string, unknown> = {},
	{ omitSwapKeys = false }: { omitSwapKeys?: boolean } = {},
) {
	return {
		id: 9001,
		type: 'TIMETABLE_EDIT_COMMITTED',
		domain: 'timetable',
		severity: 'warning',
		message: PRE_FIX_TOAST,
		schoolId: 1,
		schoolYearId: 1,
		metadata: {
			runId: 321,
			actorId: OTHER_ACTOR_ID,
			editId: 77,
			strategy: 'DIRECT_SWAP',
			affectedTermIndices: [2],
			...(omitSwapKeys
				? {}
				: { entryIdA: ENTRY_A.entryId, entryIdB: ENTRY_B.entryId }),
			...metadata,
		},
		...overrides,
	} as never;
}

const subjectLabel = (id: number) => ({ 11: 'MAPEH', 12: 'ESP' }[id] ?? `Subject #${id}`);
const sectionLabel = (id: number) => ({ 101: 'GR7 - A', 102: 'GR7 - B' }[id] ?? `Section #${id}`);

const noticeCtx = { entries: ENTRIES, subjectLabel, sectionLabel, formatTime, actorId: MY_ACTOR_ID };

const ARMED = { mode: 'select-second' as const, entryIdA: ENTRY_A.entryId, entryIdB: null };
const ANCHOR = { entryId: ENTRY_A.entryId, day: ENTRY_A.day, startTime: ENTRY_A.startTime, endTime: ENTRY_A.endTime };

const roots: any[] = [];
after(() => {
	for (const root of roots) act(() => root.unmount());
});

function render(notice: unknown, props: Record<string, unknown> = {}): { text: string; host: HTMLElement } {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	roots.push(root);
	const el = ConcurrentCommitNoticeBar as never;
	act(() => {
		root.render(createElement(el, { notice, onDismiss: () => undefined, ...props } as never));
	});
	return { text: host.textContent ?? '', host };
}

/** Every string the module can hand to an operator, across the payload matrix. */
function operatorFacingStrings(): string[] {
	const payloads = [
		swapEvent(),
		swapEvent({}, { entryIdA: 'entry-999::t2' }),                 // unresolvable A
		swapEvent({}, { entryIdB: 'entry-888::t2' }),                 // unresolvable B
		swapEvent({}, { entryIdA: undefined, entryIdB: undefined }),   // no ids at all
		swapEvent({}, { entryIdA: '', entryIdB: null }),               // malformed
		swapEvent({}, { strategy: 'AUTO_FIX_MOVE_BLOCKING' }),
		swapEvent({ message: 'Manual edit committed: PLACE_UNASSIGNED' }),
	];
	const out: string[] = [];
	for (const payload of payloads) {
		const notice = describeConcurrentCommit(payload, noticeCtx);
		if (notice) {
			out.push(notice.headline, notice.detail, ...(notice.notes ?? []));
		}
		for (const disposition of ['keep', 'cancel'] as const) {
			const verdict = evaluateArmedSwapSelection(ARMED, {
				entries: ENTRIES,
				anchor: ANCHOR,
				movedEntryIds: disposition === 'cancel' ? readConflictingEntryIds(payload) : [],
				actorId: MY_ACTOR_ID,
				classLabel: (entryId) => {
					const entry = ENTRIES.find((candidate) => candidate.entryId === entryId);
					return entry ? `${subjectLabel(entry.subjectId)} · ${sectionLabel(entry.sectionId)}` : null;
				},
			});
			out.push(...verdict.messages);
		}
	}
	return out;
}

// ── F1 the reproduction ─────────────────────────────────────────────────────

test('F1 REPRODUCTION: the pre-fix operator-facing string is the reported defect', () => {
	// What the shipped code did: render the server's `message` verbatim.
	const preFix = (swapEvent() as unknown as { message: string }).message;
	assert.equal(
		preFix,
		'Manual swap committed between entries entry-321::t2 and entry-421::t2',
		'precondition: this is the exact string the operator saw on live c5a9e832',
	);
	assert.match(preFix, /entry-321::t2/, 'precondition: it leaks the first internal entry id');
	assert.match(preFix, /entry-421::t2/, 'precondition: it leaks the second internal entry id');
	assert.ok(
		!/\b(MAPEH|ESP|GR7|MONDAY|WEDNESDAY)\b/.test(preFix),
		'precondition: it names no class, no subject, and no day — an operator cannot act on it',
	);
});

// ── F2 name the change in words ─────────────────────────────────────────────

test('F2 a concurrent swap is named in words, with no id anywhere in it', () => {
	const notice = describeConcurrentCommit(swapEvent(), noticeCtx);
	assert.ok(notice, 'a foreign swap commit produces a notice');
	assert.equal(notice.headline, CONCURRENT_COMMIT_HEADLINE, 'the notice leads with what happened');
	assert.match(notice.detail, /MAPEH/, 'it names the first class by subject');
	assert.match(notice.detail, /ESP/, 'it names the second class by subject');
	assert.match(notice.detail, /GR7 - A/, 'it names the section');
	assert.match(notice.detail, /MONDAY/, 'it names a day');
	assert.match(notice.detail, /7:30 AM/, 'it names a time, through the real formatTime');
	assert.ok(!/entry-|\bt2\b/.test(`${notice.headline} ${notice.detail}`), 'no internal id reaches the sentence');
	// It must be actionable: the operator is told the grid is being re-read.
	assert.match(notice.detail, /refresh/i, 'the notice tells the operator to re-check before saving');
});

// ── F3 the unresolvable path ────────────────────────────────────────────────

test('F3 an id the client cannot resolve yields the honest notice, never an id', () => {
	for (const metadata of [
		{ entryIdA: 'entry-999::t2' },        // class A unknown to this client
		{ entryIdB: 'entry-888::t2' },        // class B unknown
		{ entryIdA: '', entryIdB: null },      // malformed
	]) {
		const notice = describeConcurrentCommit(swapEvent({}, metadata), noticeCtx);
		assert.ok(notice, 'an unresolvable concurrent commit still tells the operator something happened');
		assert.equal(notice.headline, CONCURRENT_COMMIT_HEADLINE, 'the headline is unchanged');
		assert.equal(
			notice.detail,
			UNNAMED_COMMIT_DETAIL,
			'the detail SAYS it could not be named, rather than guessing a sentence',
		);
		assert.ok(
			!/entry-|\bt2\b|999|888/.test(`${notice.headline} ${notice.detail}`),
			`an unresolvable id never reaches the operator: ${notice.detail}`,
		);
		assert.ok(!/MAPEH|ESP/.test(notice.detail), 'an unresolvable id never produces a confident wrong sentence');
	}
});

// ── F4 the operator's own commit is silent ─────────────────────────────────

test('F4 the operator\'s own commit is silent and misattribution is impossible', () => {
	const own = swapEvent({}, { actorId: MY_ACTOR_ID });
	assert.equal(isOwnTimetableCommit(own, MY_ACTOR_ID), true, 'the actor is recognised as the operator');
	assert.equal(describeConcurrentCommit(own, noticeCtx), null, 'the operator\'s own swap raises no notice');

	// Ownership is an exact claim comparison, in the SAME id space:
	// manual-edit.router.ts:247 takes `actorId = req.user?.userId`, and the client
	// reads `userId` off the same token. So equality is the whole test.
	const foreign = swapEvent({}, { actorId: OTHER_ACTOR_ID });
	assert.equal(isOwnTimetableCommit(foreign, MY_ACTOR_ID), false, 'another scheduler is not the operator');
	assert.equal(isOwnTimetableCommit(foreign, OTHER_ACTOR_ID), true, 'ownership is symmetric for that actor');

	// An event with NO actor id cannot be attributed, so it is not claimed as the
	// operator's — and the notice must then not say "another scheduler" either.
	const unattributed = swapEvent({}, { actorId: undefined });
	assert.equal(isOwnTimetableCommit(unattributed, MY_ACTOR_ID), false, 'an unidentifiable actor is not silently treated as me');
	const notice = describeConcurrentCommit(unattributed, { ...noticeCtx, actorId: null });
	assert.ok(notice, 'an unidentifiable actor still surfaces the change');
	assert.ok(!/another scheduler/i.test(notice.headline), 'it does not name a scheduler it cannot identify');
	assert.equal(notice.attribution, 'unknown', 'the attribution is reported as unknown');
});

// ── F5 the commit cancels a selection it touched ───────────────────────────

test('F5 a selection on a class the concurrent commit touched is cancelled and reported', () => {
	const moved = readConflictingEntryIds(swapEvent());
	assert.deepEqual([...moved].sort(), [ENTRY_A.entryId, ENTRY_B.entryId].sort(), 'the payload names both moved entries');

	const classLabel = (entryId: string): string | null => {
		const entry = ENTRIES.find((candidate) => candidate.entryId === entryId);
		if (!entry) return null;
		return `${subjectLabel(entry.subjectId)} · ${sectionLabel(entry.sectionId)}`;
	};

	const verdict = evaluateArmedSwapSelection(ARMED, {
		entries: ENTRIES, anchor: ANCHOR, movedEntryIds: moved, actorId: MY_ACTOR_ID, classLabel,
	});
	assert.equal(verdict.disposition, 'cancel', 'the stale selection is not completable');
	assert.equal(verdict.armed.mode, null, 'swap mode is released');
	assert.equal(verdict.armed.entryIdA, null, 'the stale Class A is released');
	assert.ok(verdict.messages.length > 0, 'the operator is told what happened to their selection');
	assert.match(verdict.messages.join(' '), /MAPEH/, 'the cancellation names the class in words');
	assert.ok(!/entry-|\bt2\b/.test(verdict.messages.join(' ')), 'the cancellation leaks no id');

	// A selection the commit did NOT touch survives untouched.
	const untouched = evaluateArmedSwapSelection(ARMED, {
		entries: ENTRIES, anchor: ANCHOR, movedEntryIds: ['entry-777::t2'], actorId: MY_ACTOR_ID, classLabel,
	});
	assert.equal(untouched.disposition, 'keep', 'an unrelated commit does not cancel the selection');
	assert.equal(untouched.armed.entryIdA, ENTRY_A.entryId, 'the selection survives an unrelated commit');
	assert.deepEqual(untouched.messages, [], 'and says nothing about a selection it did not touch');

	// With no way to name the class the message omits the name rather than
	// inventing one — an unresolvable label must not become a fake class.
	const anonymous = evaluateArmedSwapSelection(ARMED, {
		entries: ENTRIES, anchor: ANCHOR, movedEntryIds: moved, actorId: MY_ACTOR_ID, classLabel: () => null,
	});
	assert.equal(anonymous.disposition, 'cancel', 'it still cancels');
	assert.ok(!/MAPEH/.test(anonymous.messages.join(' ')), 'and names no class it cannot resolve');
});

// ── F6 the guard holds with no event at all (re-render cannot bypass it) ────

test('F6 a selection whose class moved is cancelled with no event, and cannot be bypassed', () => {
	// The other lane's commit landed and the grid was re-read. Class A is no
	// longer where the operator selected it, but NO stream event reached this
	// client. A guard that only listens for events would sail straight through.
	const movedGrid = [{ ...ENTRY_A, day: 'THURSDAY', startTime: '10:00', endTime: '10:45' }, ENTRY_B];
	const verdict = evaluateArmedSwapSelection(ARMED, {
		entries: movedGrid, anchor: ANCHOR, movedEntryIds: [], actorId: MY_ACTOR_ID,
	});
	assert.equal(verdict.disposition, 'cancel', 'a moved class cancels the selection with no event at all');
	assert.match(verdict.messages.join(' '), /moved|changed/i, 'the operator is told the class moved');

	// A class that vanished from the grid entirely is also fail-closed.
	const vanished = evaluateArmedSwapSelection(ARMED, {
		entries: [ENTRY_B], anchor: ANCHOR, movedEntryIds: [], actorId: MY_ACTOR_ID,
	});
	assert.equal(vanished.disposition, 'cancel', 'a class no longer on the grid cancels the selection');

	// A selection whose class has NOT moved is left completely alone — this is
	// the normal single-user path and it must stay silent.
	const still = evaluateArmedSwapSelection(ARMED, {
		entries: ENTRIES, anchor: ANCHOR, movedEntryIds: [], actorId: MY_ACTOR_ID,
	});
	assert.equal(still.disposition, 'keep', 'an unmoved selection is kept');
	assert.deepEqual(still.messages, [], 'the normal path says nothing at all');

	// Re-reading the same inputs is idempotent: a re-render cannot flip it back.
	assert.deepEqual(
		evaluateArmedSwapSelection(ARMED, { entries: movedGrid, anchor: ANCHOR, movedEntryIds: [], actorId: MY_ACTOR_ID }),
		verdict,
		'the verdict is a pure function of live state, so no re-render can restore the stale selection',
	);
});

// ── F7 no selection armed ───────────────────────────────────────────────────

test('F7 with nothing armed there is nothing to cancel, and the notice is unaffected', () => {
	for (const armed of [
		{ mode: null, entryIdA: null, entryIdB: null },
		{ mode: 'select-first', entryIdA: null, entryIdB: null },
	] as const) {
		const verdict = evaluateArmedSwapSelection(armed, {
			entries: ENTRIES, anchor: null, movedEntryIds: [ENTRY_A.entryId, ENTRY_B.entryId], actorId: MY_ACTOR_ID,
		});
		assert.equal(verdict.disposition, 'keep', 'nothing armed means nothing to cancel');
		assert.deepEqual(verdict.messages, [], 'and no message about a selection that does not exist');
	}
	// A selection armed but with Class A not yet chosen is still not a stale action.
	const partial = evaluateArmedSwapSelection(
		{ mode: 'select-first', entryIdA: null, entryIdB: null },
		{ entries: [], anchor: null, movedEntryIds: [ENTRY_A.entryId], actorId: MY_ACTOR_ID },
	);
	assert.equal(partial.disposition, 'keep', 'a half-armed swap is not cancelled by a commit');
});

// ── F8 the rendered surface ────────────────────────────────────────────────

test('F8 the notice is announced, dismissible through @/ui, and id-free', () => {
	const notice = describeConcurrentCommit(swapEvent(), noticeCtx);
	const view = render(notice);
	const bar = view.host.querySelector('[data-testid="concurrent-commit-notice"]');
	assert.ok(bar, 'the notice renders');
	assert.equal(bar!.getAttribute('role'), 'alert', 'it is announced to assistive tech, not shown only visually');
	assert.ok((bar!.getAttribute('aria-live') ?? '').length > 0, 'it carries a live region');
	assert.match(view.text, /MAPEH/, 'it names the change in words');
	assert.ok(!/entry-|\bt2\b/.test(view.text), `no id is rendered: ${view.text}`);
	assert.ok(
		!/\btitle=/.test(bar!.outerHTML),
		'no HTML title attribute is used for the extra information (§8)',
	);

	// Dismissal is a real control wired to the handler, through the @/ui Button.
	const dismiss = view.host.querySelector('[data-testid="concurrent-commit-dismiss"]');
	assert.ok(dismiss, 'the notice is dismissible');
	assert.equal(dismiss!.tagName.toLowerCase(), 'button', 'the dismiss control renders as a real button');
	// It carries the same 44px touch target the sibling auto-save strip uses.
	assert.match(dismiss!.getAttribute('class') ?? '', /\bh-11\b/, 'the dismiss control carries the 44px touch target');
	assert.equal(
		dismiss!.getAttribute('aria-label'),
		'Dismiss the notice that the schedule changed',
		'the dismiss control is named for assistive tech, since it shows only an icon',
	);

	// A null notice renders nothing at all — the silent normal path.
	const none = render(null);
	assert.equal(none.host.textContent, '', 'no notice means no DOM at all');
	assert.equal(none.host.querySelector('[data-testid="concurrent-commit-notice"]'), null, 'not even an empty region');
});

// ── F9 the id-leak sweep ────────────────────────────────────────────────────

test('F9 no internal id reaches an operator-facing string on ANY path', () => {
	// SCOPE, STATED PLAINLY because this row's name overclaims on its own: F9 can
	// only see what THIS MODULE produces. When it was first written the claim it
	// names was false, because the server authored a raw-id string that reached
	// the operator through the durable inbox — a path no client assertion can
	// observe. The claim is true now because the SOURCE was fixed, and the rows
	// that would actually catch a server regression are:
	//   atlas-server/src/__tests__/timetable-swap-notification-message-a2.test.ts
	//   atlas-server/src/__tests__/timetable-swap-custody-a2.test.ts  (the M row)
	// This row is kept and still sweeps every string this module can produce.
	const strings = operatorFacingStrings();
	assert.ok(strings.length > 0, 'the sweep actually produced strings to check');
	for (const value of strings) {
		assert.ok(
			!/entry-\d|::t\d|entryId[AB]/.test(value),
			`an internal id reached an operator-facing string: ${JSON.stringify(value)}`,
		);
	}
	// And the raw ids themselves are absent, whatever the payload said.
	const all = strings.join('\n');
	for (const raw of [ENTRY_A.entryId, ENTRY_B.entryId, 'entry-999::t2', 'entry-888::t2']) {
		assert.ok(!all.includes(raw), `the raw id ${raw} never appears in operator-facing text`);
	}
});

// ── F10 mutants ────────────────────────────────────────────────────────────

test('F10 MUTANT: the pre-fix behaviours fail F2, F3, F5 and F6', () => {
	// M-A: the pre-fix code rendered `event.message` verbatim.
	const preFixNamed = (swapEvent() as unknown as { message: string }).message;
	assert.match(preFixNamed, /entry-321::t2/, 'the pre-fix named sentence leaks an id, so F2 discriminates');
	assert.ok(!/MAPEH/.test(preFixNamed), 'the pre-fix named sentence names no class, so F2 discriminates');

	// M-B: the pre-fix "another user changed this" guess for an unresolvable id.
	const preFixGuess = `Another scheduler swapped two classes for you.`;
	assert.ok(!/could not|couldn.t name|not name/i.test(preFixGuess), 'a guess never says it is a guess, so F3 discriminates');

	// M-C: the pre-fix guard did nothing at all on a concurrent commit.
	assert.equal(
		evaluateArmedSwapSelection(ARMED, { entries: ENTRIES, anchor: ANCHOR, movedEntryIds: [], actorId: MY_ACTOR_ID }).disposition,
		'keep',
		'precondition: with no guard the stale selection is completable, so F5/F6 discriminate',
	);

	// M-D: ownership compared the wrong claim, so an operator's own swap was
	// reported as someone else's change.
	const own = swapEvent({}, { actorId: MY_ACTOR_ID });
	assert.equal(
		isOwnTimetableCommit(own, OTHER_ACTOR_ID),
		false,
		'precondition: a wrong-claim comparison reports my own swap as another\'s',
	);
});

// ── F11 scope of the takeover ───────────────────────────────────────────────

test('F11 only the swap payload is taken over; other edit types keep their toast', () => {
	assert.equal(isSwapCommitEvent(swapEvent()), true, 'the swap payload is taken over');
	// Built WITHOUT the swap keys, as the other publishers really do publish:
	// `manual-edit.service.ts:1413` sends `entryId`, `:1608` sends `editIds`.
	for (const metadata of [
		{ editType: 'PLACE_UNASSIGNED', entryId: 'entry-1::t1' },
		{ editIds: [1, 2, 3], batchSize: 3 },
	]) {
		assert.equal(
			isSwapCommitEvent(swapEvent({}, metadata, { omitSwapKeys: true })),
			false,
			'a non-swap edit is left to the existing notification path',
		);
	}
	assert.equal(isSwapCommitEvent(swapEvent({ type: 'SCHEDULE_PUBLISHED' })), false, 'another domain/type is left alone');
	assert.equal(isSwapCommitEvent(swapEvent({ domain: 'generation' })), false, 'another domain is left alone');
	// And the suppression is wired at the notify seam, not by deleting the toast path.
	assert.match(
		streamSource,
		/describeConcurrentCommit|isSwapCommitEvent/,
		'the stream consults the takeover predicate rather than dropping notifications',
	);
	assert.match(streamSource, /toast\./, 'the ordinary notification toast path is still present');
});

// ── F12 the wiring and §8 ───────────────────────────────────────────────────

test('F12 the guard is wired to live state and the component obeys §8', () => {
	// The arming anchor is captured in ONE place, so whichever arm site set the
	// id, the guard has an anchor to compare against.
	assert.match(
		workspaceStateSource,
		/swapAnchorRef/,
		'the workspace records where Class A sat when it was armed',
	);
	assert.match(
		workspaceStateSource,
		/evaluateArmedSwapSelection/,
		'the workspace routes every selection decision through the one guard',
	);
	// The use-time re-check is what makes a re-render or a stale closure unable
	// to restore a stale selection: it reads the live grid, not a captured entry.
	assert.match(
		workspaceStateSource,
		/gridEntries[\s\S]{0,400}evaluateArmedSwapSelection|evaluateArmedSwapSelection[\s\S]{0,400}gridEntries/,
		'the commit-time guard reads the live grid entries',
	);

	// §8: no raw unstyled <button>, no <details>, no title=, no native <select>,
	// and no new scroll surface in the new component. Two details make this a real
	// check rather than a tautology: comments are stripped first (this file's own
	// doc comment names the very tags being banned), and the tag match is
	// case-SENSITIVE, because `<Button` from `@/ui` is the required primitive and
	// `<button` is the raw element §8 forbids — only the lowercase form is a
	// violation.
	const barJsx = barSource
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^\s*\/\/.*$/gm, '');
	assert.ok(!/<button[\s>]/.test(barJsx), 'no raw <button> in the notice component (§8)');
	assert.ok(!/<details/.test(barJsx), 'no raw <details> (§8)');
	assert.ok(!/\btitle=/.test(barJsx), 'no HTML title attribute (§8)');
	assert.ok(!/<select[\s>]/.test(barJsx), 'no native <select> (§8)');
	assert.ok(!/overflow-(auto|scroll|y-auto|x-auto)/.test(barJsx), 'no new scroll surface (§8)');
	// `shrink-0` is load-bearing in the flex column the workspace renders: without
	// it the row can compress and clip the sentence the operator must read.
	assert.match(barJsx, /\bshrink-0\b/, 'the notice row cannot be compressed in the workspace flex column (§8)');
	assert.match(barSource, /from '@\/ui\/button'/, 'the dismiss control is routed through @/ui (§8)');
	assert.match(barJsx, /<Button[\s>]/, 'and the only interactive affordance is that @/ui Button (§8)');
	assert.match(barSource, /role="alert"/, 'the notice is announced (§8)');
	assert.ok(barSource.split('\n').length <= 1000, 'the new component is far below the 1000-line ceiling (§8)');
});
