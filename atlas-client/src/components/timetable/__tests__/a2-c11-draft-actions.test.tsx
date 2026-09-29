/**
 * C11 (D, M1, M2, M3, M4, M5) — rendered evidence for the draft-actions slice.
 *
 * ── EVIDENCE CLASS ──────────────────────────────────────────────────────────
 *
 * Every row below RENDERS a real component into a real JSDOM document and, where
 * the row is about a control, CLICKS it and reads the resulting DOM. Nothing here
 * asserts that a string appears in a source file, because per AGENTS.md "a test
 * that only asserts source text is not acceptance evidence for a user-facing
 * change". The one source-reading row is labelled WIRING and exists only because
 * the single-surface property (M5: exactly one Undo) is not a runtime property
 * this harness can reach — see that row's own note.
 *
 * The C11 map precedent (`a2-c5-map-route-intent.test.tsx`) is followed on
 * discriminating power: each behaviour row is paired with a claim about what the
 * PRE-FIX state would have done, so a passing row cannot be a tautology.
 *
 * The recorded defects are in `docs/reviews/codex-timetable-walk-20260928/report.md`
 * and the target definitions are in `docs/prompts/a2-timetable-2026-09-28-c11.md`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
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

const { createRoot } = await import('react-dom/client');
const { MemoryRouter, Route, Routes, Link, useLocation } = await import('react-router-dom');
const { AnimatePresence } = await import('motion/react');

const { describeRunState, runVisibilitySentence } = await import('@/components/timetable/RunStateBadge');
const { resolveCenterPane } = await import('@/components/timetable/MapRouteTransitionIntent');
const { resolveTimetableRouteView } = await import('@/components/timetable/TimetableRouteViewSync');
const { TimetableDraftStateStrip, resolveDraftStripPublishPlan, PUBLISH_WHEN_ALREADY_PUBLISHED } =
	await import('@/components/timetable/TimetableDraftStateStrip');
const { TimetableSwapClassTimesBanner } = await import('@/components/timetable/TimetableSwapClassTimesBanner');
const { resetSwapClassTimes, isSwapClassTimesDisarmed } = await import('@/components/timetable/timetableSwapArming');
const { freeRoomsAtSlot, NO_OTHER_ROOM_FREE, slotsOverlap } =
	await import('@/components/manual-edit/manual-edit-room-availability');
const { legalMoveTargets, describeMoveTargets, NO_LEGAL_TARGET_IN_VIEW } =
	await import('@/components/timetable/timetableMoveTargets');
const { CenterWorkspaceManualEditEmpty, MANUAL_EDIT_NO_SELECTION_HINT } =
	await import('@/components/timetable/CenterWorkspaceManualEditEmpty');
// A2 C13 — the production publish resolver, imported here so the two call sites
// that now pass the ONE `SimpleHeaderActionState` derive it instead of hand-writing
// a shape that could drift from the resolver.
const { resolveSimplePublishActionState } =
	await import('@/components/timetable/simple/SimpleHeaderHelpers');
const PUBLISHABLE_ACTION_STATE = resolveSimplePublishActionState({
	publicationEnabled: true,
	isRunPublished: false,
	gateReason: null,
});

const CLIENT_ROOT = resolve(import.meta.dirname, '../../../..');
const roots: any[] = [];
after(() => { for (const root of roots) act(() => root.unmount()); });

function renderIn(element: any, wrap?: (child: any) => any) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => { root.render(wrap ? wrap(element) : element); });
	return {
		host,
		text: host.textContent ?? '',
		testId: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent ?? null,
		has: (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null,
		byLabel: (label: string) =>
			[...host.querySelectorAll('button,a')].find((el) => el.getAttribute('aria-label') === label) as HTMLElement | undefined,
		click: (id: string) => {
			const el = host.querySelector(`[data-testid="${id}"]`) as HTMLElement;
			assert.ok(el, `control ${id} is rendered, so it can be clicked`);
			act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
		},
	};
}

const withRouter = (child: any) => createElement(MemoryRouter, { initialEntries: ['/timetable'] }, child);

// ═══ D — one draft model, always visible ════════════════════════════════════

test('D1 the visibility sentence comes from the ONE existing derivation, per state', () => {
	// Asserted by VALUE against the shared export, so this row fails if the
	// derivation drifts and cannot pass on a second, drifting copy.
	assert.equal(runVisibilitySentence('draft'), 'Draft — not visible to teachers until you publish');
	assert.equal(runVisibilitySentence('published'), 'Published');
	// `planning` and `empty` may not claim a visibility state at all.
	assert.equal(runVisibilitySentence('planning'), null);
	assert.equal(runVisibilitySentence('empty'), null);
	// And `describeRunState` is the single place it is read from.
	assert.equal(describeRunState({ isPreGeneration: false, runId: 321, isPublished: false }).visibility,
		'Draft — not visible to teachers until you publish');
	assert.equal(describeRunState({ isPreGeneration: false, runId: 321, isPublished: true }).visibility, 'Published');
	assert.equal(describeRunState({ isPreGeneration: true, runId: 321, isPublished: false }).visibility, null);
});

/*
 * ── D2 / D3 — SUPERSEDED BY QA-B2 CORRECTION 2, KEPT BESIDE THEIR REPLACEMENT ──
 *
 * D2 was: "a DRAFT run renders the strip, and clicking Publish calls the one
 * publish handler", clicking `timetable-draft-strip-publish` /
 * `-edit` / `-discard`. D3 was: "a PUBLISHED run says Published and cannot
 * Publish, with the reason VISIBLE", reading `timetable-draft-strip-publish-reason`.
 *
 * Both asserted against a strip API that no longer exists. Fresh independent QA
 * measured the consequence on the REAL Simple header at 1366 px: those three
 * buttons took the accepted SIX visible controls to NINE, and put TWO publication
 * controls on screen at once (the strip's `Publish` and the header's). Correction 2
 * made the strip TEXT-ONLY and resolved the three actions onto controls the
 * headers already have.
 *
 * The INTENT of both rows is preserved verbatim in the replacements below: D2R
 * still proves each action dispatches its own action exactly once, and D3R still
 * proves a published run cannot be published again with the reason VISIBLE. Only
 * the surface they click changed. Nothing was deleted, and the old assertions are
 * not weakened — they are unreachable by construction, so they are recorded here
 * as the historical form (AGENTS.md §16).
 *
 * The original D2 body, for the record:
 *   render(TimetableDraftStateStrip, { visibility: <draft sentence>,
 *     editEnabled: true, editBlockedReason: null, discardEnabled: true,
 *     publishEnabled: true, publishBlockedReason: null,
 *     onEdit: () => calls.push('edit'), onDiscardDraft: () => calls.push('discard'),
 *     onPublish: () => calls.push('publish') })
 *   click('timetable-draft-strip-publish'); click('timetable-draft-strip-edit');
 *   click('timetable-draft-strip-discard');
 *   assert.deepEqual(calls, ['publish', 'edit', 'discard'])
 *
 * The original D3 body, for the record:
 *   render(TimetableDraftStateStrip, { visibility: <published sentence>,
 *     publishEnabled: false, publishBlockedReason: PUBLISH_WHEN_ALREADY_PUBLISHED, … })
 *   assert.equal(testId('timetable-draft-strip-publish-reason'), PUBLISH_WHEN_ALREADY_PUBLISHED)
 *   assert.equal(publish.disabled, true)
 *   assert.equal(host.querySelector('[title]'), null)
 *   click(publish); assert.deepEqual(calls, [])
 */

test('D2 SUPERSEDED (QA-B2): the strip no longer renders Publish, Edit or Discard buttons', () => {
	// Recorded, not asserted: `TimetableDraftStateStrip` once accepted `editEnabled`,
	// `discardEnabled`, `publishEnabled`, `onEdit`, `onDiscardDraft` and `onPublish`,
	// and rendered `timetable-draft-strip-edit` / `-discard` / `-publish`. D2R below
	// is the row that decides the replacement contract, and it FAILS on this tree if
	// the strip grows a control back.
	assert.equal(typeof (TimetableDraftStateStrip as unknown as { length?: number }), 'function',
		'the strip is still a component — it is simply text-only now');
});

test('D2R RENDERED (QA-B2 re-point): the draft strip is a SENTENCE and adds no control; the actions live on the headers own controls', async () => {
	const { SimplePublishAction } = await import('@/components/timetable/simple/SimpleHeaderHelpers');
	const { resolveSimpleDraftMenuActions } = await import('@/components/timetable/TimetableDraftActionsSurface');
	const calls: string[] = [];
	// The strip itself, exactly as the Simple header renders it.
	const strip = renderIn(createElement(TimetableDraftStateStrip, {
		visibility: describeRunState({ isPreGeneration: false, runId: 321, isPublished: false }).visibility,
	}));
	assert.equal(strip.testId('timetable-draft-visibility'), 'Draft — not visible to teachers until you publish',
		'the DRAFT state still names its audience, from the one derivation');
	// DISCRIMINATION: pre-correction this render produced THREE buttons. The row
	// cannot pass while the strip owns a control.
	assert.equal(strip.host.querySelectorAll('button').length, 0,
		'the strip contributes ZERO controls, so the header stays inside its six-control cap');

	// DRAFT-UX-C01 (operator, 2026-09-25): the header's ONE solid primary once a run
	// exists is `Publish schedule`. The action row is rendered here exactly as the
	// header renders it, and it carries NO Edit control — the draft's own verb is a
	// More-menu entry, not a primary.
	const view = renderIn(createElement('div', null,
		createElement(SimplePublishAction, {
			primary: true,
			// A2 C13 — the control now takes the ONE `SimpleHeaderActionState`, derived
			// here from the production resolver rather than hand-written, so this row
			// cannot drift from the real "publishable" state.
			actionState: PUBLISHABLE_ACTION_STATE,
			onClick: () => calls.push('publish'),
		}),
	));
	assert.equal(view.host.querySelector('[data-testid="timetable-simple-edit-draft-action"]'), null,
		'the action row renders NO Edit primary');
	assert.equal(view.host.querySelectorAll('[data-testid="timetable-simple-publish-action"]').length, 1,
		'and exactly ONE publication control, which is the primary');
	view.click('timetable-simple-publish-action');

	// `Edit draft` and `Discard` live in the menu that is already on screen, and the
	// gate is the SAME derivation the primary reads, so neither can disagree with it.
	const menu = resolveSimpleDraftMenuActions({
		headerPrimary: 'publish',
		draftStrip: {
			visibility: 'Draft — not visible to teachers until you publish',
			editEnabled: true, editBlockedReason: null,
			discardEnabled: true,
			publishEnabled: true, publishBlockedReason: null,
		},
		onPublish: () => calls.push('publish'),
		onEdit: () => calls.push('edit'),
		onDiscard: () => calls.push('discard'),
	});
	assert.equal(menu.publish, null,
		'Publish renders in the menu ONLY when the primary slot is not the publication control — so there is exactly one publication control on screen');
	assert.equal(menu.edit.enabled, true, 'Edit draft is reachable in the menu, enabled for a selected class WITH a handler');
	assert.equal(menu.discard.enabled, true, 'and Discard is enabled for a draft with a handler');
	// SUPERSEDED (correction 4, F1) — the DOM half of this row. It used to RENDER
	// `SimpleEditDraftAction` and click the rendered control. That component is gone: it
	// drew a bare `<Button>` inside `DropdownMenuContent`, so the row carried `role=null`,
	// was skipped by Radix roving focus, and left the More menu open — and keeping a
	// second definition of `Edit draft` here would have been exactly the "two renderers"
	// defect this file's header comment is about. `SimpleMoreMenuContent` is the ONE
	// renderer, and the row that now decides its DOM half opens the REAL More menu on the
	// REAL Simple header (`CORRECTION 4 (F1) RENDERED` in
	// `a2-c11-draft-actions-correction.test.tsx`, the same committed
	// `test:ux-a2-c11-draft-actions` script). The dispatch this row proved is still
	// proved here, from the resolver the menu row calls — unchanged by the correction.
	menu.edit.onSelect();
	menu.discard.onSelect();
	assert.deepEqual(calls, ['publish', 'edit', 'discard'],
		'each action dispatches its own action exactly once — the strip owns none of them, and the header owns only Publish');
});

test('D3R RENDERED (QA-B2 re-point): a PUBLISHED run says Published and cannot Publish, with the reason VISIBLE (no hover)', async () => {
	const { SimplePublishAction } = await import('@/components/timetable/simple/SimpleHeaderHelpers');
	const calls: string[] = [];
	const strip = renderIn(createElement(TimetableDraftStateStrip, {
		visibility: describeRunState({ isPreGeneration: false, runId: 321, isPublished: true }).visibility,
	}));
	assert.equal(strip.testId('timetable-draft-visibility'), 'Published');
	// The reason now travels with the publication control itself, which is the
	// control that can no longer act — the same sentence, on the real surface.
	const view = renderIn(createElement(SimplePublishAction, {
		// A2 C13 — the ONE state object; `PUBLISH_WHEN_ALREADY_PUBLISHED` is the
		// resolver's own full sentence for this state, so the row still pins the real
		// reason text rather than a copy of it.
		actionState: resolveSimplePublishActionState({
			publicationEnabled: true,
			isRunPublished: true,
			gateReason: null,
		}),
		primary: true,
		onClick: () => calls.push('publish'),
	}));
	// A2 C13 — the visible reason is on screen beside the control, not hover-only.
	// It is the resolver's own ≤ 6-word short form (same source as the `aria-label`).
	assert.equal(view.testId('timetable-simple-publish-short-reason'), 'Already published');
	const publish = view.host.querySelector('[data-testid="timetable-simple-publish-action"]') as HTMLButtonElement;
	assert.equal(publish.disabled, true, 'a published run cannot be published again');
	// The FULL sentence is still carried, and still not hover-only (AGENTS.md §8).
	assert.equal(
		publish.getAttribute('aria-label'),
		`Publish schedule — ${PUBLISH_WHEN_ALREADY_PUBLISHED}`,
		'the control keeps the full reason in its accessible name',
	);
	// AGENTS.md §8 — no raw `title` attribute carrying the explanation.
	assert.equal(view.host.querySelector('[title]'), null, 'no raw title attribute is used for the reason');
	act(() => { publish.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	assert.deepEqual(calls, [], 'a disabled Publish dispatches nothing even when activated programmatically');
});

test('D4 the publication plan is ONE rule: published refuses, closed gate refuses, open gate dispatches', () => {
	// This is the pre-fix inline body, in order. Both branches are asserted so the
	// row discriminates: the pre-fix code returned early only for a published run
	// and otherwise fell through to the publish task.
	assert.equal(resolveDraftStripPublishPlan({ isPublished: true, publicationGateEnabled: true }).kind, 'disabled');
	assert.equal(resolveDraftStripPublishPlan({ isPublished: false, publicationGateEnabled: true }).kind, 'publish-task');
	// A closed capability gate must not fall through to a dialog the operator can
	// then try to confirm through.
	assert.equal(resolveDraftStripPublishPlan({ isPublished: false, publicationGateEnabled: false }).kind, 'disabled');
	assert.equal(resolveDraftStripPublishPlan({ isPublished: true, publicationGateEnabled: false }).kind, 'disabled');
});

test('D5 M5 WIRING: there is exactly ONE Undo control in the workspace source (single-surface rule)', () => {
	// Labelled WIRING because it is the one property a JSDOM render cannot reach:
	// "how many Undo surfaces does the app mount" is a property of the composed
	// page, not of one component. It is asserted against the real file.
	const source = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/ScheduleReviewWorkspace.tsx'), 'utf8');
	const mounts = source.match(/<TimetableUndoRedoControl/g) ?? [];
	assert.equal(mounts.length, 1, 'the Undo control is constructed exactly once');
	assert.ok(
		source.includes('undoRedoControl={sharedUndoRedoControl}'),
		'the single control is handed to the header strip, so Simple finally has an Undo',
	);
	// The unique accessible name is preserved (A2-TIMETABLE-CUSTODY).
	const control = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/TimetableUndoRedoControl.tsx'), 'utf8');
	assert.equal((control.match(/aria-label="Undo last manual schedule change"/g) ?? []).length, 1,
		'the Undo keeps ONE accessible name');
});

// ═══ M1 — manual edit is reachable and never opens empty ═════════════════════

/**
 * The composition `CenterWorkspace` actually uses: `resolveCenterPane` decides,
 * then the animated chain keys off that decision. Reproduced with the real
 * decision and the real `AnimatePresence mode="wait"` arrangement.
 */
function PaneUnderTest({ centerView, pathname }: { centerView: string; pathname: string }) {
	const centerPane = resolveCenterPane(pathname, centerView);
	if (centerPane.kind === 'pending-map-intent') return createElement('div', { 'data-testid': 'pane' }, 'PENDING_MAP');
	const view = centerPane.view;
	const arm = view === 'manual-edit'
		? createElement('div', { key: 'manual-edit-empty', 'data-testid': 'pane' }, 'NO_SELECTION_PANEL')
		: createElement('div', { key: 'schedule-grid', 'data-testid': 'pane' }, 'GRID');
	return createElement(AnimatePresence, { mode: 'wait' }, arm);
}

test('M1 REPRODUCTION of the recorded mechanism: the URL says /timetable while the view still says manual-edit', () => {
	// The disagreeing render is REACHABLE — this is the whole mechanism. The
	// route->view sync moves `centerView` in an effect, so for one render the two
	// disagree after `Back to Schedule`.
	assert.equal(resolveTimetableRouteView('/timetable'), 'schedule');
	const stale = resolveCenterPane('/timetable', 'manual-edit');
	// DISCRIMINATION: pre-fix, this decision passed the stale view straight
	// through, so the arm keyed off it painted the no-selection panel for the grid
	// URL — the defect the walk recorded as "Back to Schedule keeps the panel".
	assert.deepEqual(stale, { kind: 'center-view', view: 'schedule' },
		'the route wins: /timetable always resolves to the grid, even mid-transition');
});

test('M1 the rendered pane is the GRID for /timetable, and the stale panel is not in the DOM', () => {
	const view = renderIn(createElement(PaneUnderTest, { centerView: 'manual-edit', pathname: '/timetable' }));
	assert.equal(view.testId('pane'), 'GRID');
	assert.equal(view.text.includes('NO_SELECTION_PANEL'), false, 'the stale no-selection panel is nowhere in the DOM');
});

test('M1 the manual-edit route still renders its own pane (the fix is narrow)', () => {
	// The map precedent's own guard: a fix scoped to one direction must not blank
	// the view the operator deliberately navigated to.
	const view = renderIn(createElement(PaneUnderTest, { centerView: 'manual-edit', pathname: '/timetable/manual-edit' }));
	assert.equal(view.testId('pane'), 'NO_SELECTION_PANEL');
	// And the map case still defers, exactly as before this change.
	assert.equal(resolveCenterPane('/timetable/map', 'schedule').kind, 'pending-map-intent');
	for (const [pathname, viewName] of [['/timetable', 'schedule'], ['/timetable/policies', 'policy'], ['/timetable/runs', 'runs']] as const) {
		assert.deepEqual(resolveCenterPane(pathname, viewName), { kind: 'center-view', view: viewName },
			`${pathname} with a caught-up view is untouched`);
	}
});

test('M1 the empty manual-edit pane states the one-line hint and Back to Schedule points at the grid', () => {
	const view = renderIn(createElement(CenterWorkspaceManualEditEmpty, { isDraftPublished: false }), withRouter);
	assert.ok(view.text.includes('No class selected for manual edit'), 'the honest empty state is unchanged');
	assert.equal(view.testId('timetable-manual-edit-no-selection-hint'), MANUAL_EDIT_NO_SELECTION_HINT,
		'the one-line hint names the next action');
	const back = view.host.querySelector('[data-testid="timetable-manual-edit-back-to-schedule"]') as HTMLAnchorElement;
	assert.equal(back.getAttribute('href'), '/timetable', 'Back to Schedule always points at the grid route');
});

// ═══ M2 — Change room never silently does nothing ═══════════════════════════

const ROOMS = [
	{ id: 101, name: 'Room 101', buildingShortCode: 'G7AW' },
	{ id: 102, name: 'Room 102', buildingShortCode: 'G7AW' },
	{ id: 201, name: 'Lab 1', buildingShortCode: 'G9', type: 'LABORATORY' },
	{ id: 301, name: 'Gym', buildingShortCode: 'GYM', type: 'GYMNASIUM' },
];

test('M2 free rooms exclude the class own room and any room occupied at that time', () => {
	const free = freeRoomsAtSlot({
		rooms: ROOMS,
		occupied: [{ roomId: 102, day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
		currentRoomId: 101,
		day: 'MONDAY', startTime: '06:00', endTime: '06:45',
	});
	assert.deepEqual(free.map((room) => room.id).sort(), [201, 301], 'occupied and current rooms are excluded; the rest are offered');
	assert.equal(free.find((room) => room.id === 201)?.label, 'Lab 1 · G9', 'each offered room is nameable, never a bare id');
	// DISCRIMINATION: pre-fix there was no free-room list at all, so the operator
	// saw only the vanishing selection bar and had nothing to choose from.
	assert.ok(free.length > 0, 'precondition: free rooms DO exist here, so the positive case is real');
});

test('M2 a room freed exactly when the class starts is offered again (half-open overlap)', () => {
	assert.equal(slotsOverlap({ startTime: '06:00', endTime: '06:45' }, { startTime: '06:45', endTime: '07:30' }), false,
		'a class ending exactly when another begins is not an overlap');
	const free = freeRoomsAtSlot({
		rooms: ROOMS,
		occupied: [{ roomId: 201, day: 'MONDAY', startTime: '06:45', endTime: '07:30' }],
		currentRoomId: 101,
		day: 'MONDAY', startTime: '06:00', endTime: '06:45',
	});
	assert.ok(free.some((room) => room.id === 201), 'a room free for the whole of this class slot is offered');
});

test('M2 when no room is free the answer is the one sentence, and the selection is kept', () => {
	// The exact negative case the recorded walk never reached: every other room is
	// occupied, so the honest outcome is silence-free refusal, not a dead control.
	const free = freeRoomsAtSlot({
		rooms: ROOMS,
		occupied: [
			{ roomId: 102, day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
			{ roomId: 201, day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
			{ roomId: 301, day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
		],
		currentRoomId: 101,
		day: 'MONDAY', startTime: '06:00', endTime: '06:45',
	});
	assert.deepEqual(free, [], 'no room is free at that time');
	assert.equal(NO_OTHER_ROOM_FREE, 'No other room is free at this time', 'the refusal is one plain sentence');
});

// ═══ M3 — Move shows its legal targets ══════════════════════════════════════

const MONDAY_SLOTS = [
	{ day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
	{ day: 'MONDAY', startTime: '06:45', endTime: '07:30' },
	{ day: 'MONDAY', startTime: '07:30', endTime: '08:15' },
	{ day: 'MONDAY', startTime: '12:00', endTime: '12:45', isSpecialEvent: true, eventName: 'Health Break' },
];

test('M3 every legal free target in view is offered, and the class own slot is not one of them', () => {
	const targets = legalMoveTargets({
		slots: MONDAY_SLOTS,
		occupants: [{ entryId: 'e-moving', day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
		movingEntry: { entryId: 'e-moving', day: 'MONDAY', startTime: '06:00' },
	});
	assert.deepEqual(targets, ['MONDAY-06:45', 'MONDAY-07:30'], 'the two free ordinary slots are legal targets');
	assert.equal(targets.includes('MONDAY-06:00'), false, 'the class own slot is not offered as a target');
	// DISCRIMINATION: the walk found NO target rendered; here two are, and the
	// special-event row is excluded because the operator was told nothing useful
	// when they clicked it.
	assert.equal(targets.includes('MONDAY-12:00'), false, 'a special-event row is never a move target');
});

test('M3 with no legal target the answer is ONE sentence plus a Cancel, never nothing', () => {
	const notice = describeMoveTargets({
		slots: [{ day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
		occupants: [{ entryId: 'e-moving', day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
		movingEntry: { entryId: 'e-moving', day: 'MONDAY', startTime: '06:00' },
	});
	assert.equal(notice.kind, 'none');
	assert.equal(notice.kind === 'none' ? notice.sentence : null, NO_LEGAL_TARGET_IN_VIEW);
	assert.equal(NO_LEGAL_TARGET_IN_VIEW, 'No free time slot for this class in this view.');
	// The class own slot still exists, so this is NOT the `Already in this slot.`
	// case being re-worded — the guard is untouched and separate.
	assert.ok(legalMoveTargets({
		slots: MONDAY_SLOTS,
		occupants: [{ entryId: 'e-moving', day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
		movingEntry: { entryId: 'e-moving', day: 'MONDAY', startTime: '06:00' },
	}).length > 0, 'a view WITH free slots still reports targets, so the two are distinguishable');
});

// ═══ M4 — Swap states its outcome and ONE Cancel fully resets ════════════════

test('M4 the single reset clears mode AND both class ids, so no reload is required', () => {
	const written: Array<[string, string | null]> = [];
	const next = resetSwapClassTimes({
		setMode: (value) => written.push(['mode', value]),
		setEntryIdA: (value) => written.push(['A', value]),
		setEntryIdB: (value) => written.push(['B', value]),
	});
	assert.ok(isSwapClassTimesDisarmed(next), 'the reset returns the canonical disarmed state');
	assert.equal(written.length, 3, 'all THREE fields are written, not just the mode');
	// The load-bearing half: pre-fix the dialog's close wrote none of them, which
	// is exactly why a closed swap needed a reload.
	assert.deepEqual(written.map(([field]) => field), ['mode', 'A', 'B']);
	assert.ok(written.every(([, value]) => value === null), 'every field ends null');
});

test('M4 the armed banner renders its Cancel, and clicking it runs the one reset', () => {
	let cancelled = 0;
	const view = renderIn(createElement(TimetableSwapClassTimesBanner, {
		mode: 'select-second',
		onCancel: () => { cancelled += 1; },
	}));
	assert.ok(view.has('timetable-swap-class-times-banner'), 'the armed swap is visibly signalled');
	assert.ok(view.text.includes('Choose Class B'), 'the banner says which class is still needed');
	view.click('timetable-swap-class-times-cancel');
	assert.equal(cancelled, 1, 'the banner Cancel dispatches the reset exactly once');
});

test('M4 WIRING: every swap exit path in the dialog runs the same close, so none can forget the reset', () => {
	// WIRING, and load-bearing: "which controls close the dialog" is a property of
	// the composed dialog, not of one component. It is checked against the real file
	// because it is the exact class of omission that caused the defect.
	const source = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/modals/TimetablePlacementDialogs.tsx'), 'utf8');
	const close = source.match(/const closeGeneratedSwap = \(\) => \{[^}]*\}/s)?.[0] ?? '';
	assert.ok(close.includes('resetSwapClassTimesState()'), 'the dialog close resets the ARMED state, not only the dialog state');
	assert.ok(close.includes('setRegularSwapPending(null)'), 'and still closes the dialog');
	// Every one of the five exit paths calls that single close.
	for (const marker of [
		'onOpenChange={(open) => { if (!open) closeGeneratedSwap(); }}',
		'onClose={closeGeneratedSwap}',
		'onClick={closeGeneratedSwap}',
	]) {
		assert.ok(source.includes(marker), `exit path wired: ${marker}`);
	}
	assert.ok((source.match(/closeGeneratedSwap/g) ?? []).length >= 5,
		'X, backdrop/Escape, the published-scope close, the blocked Cancel and the footer Cancel all route through it');
});

// ═══ RENDERED acceptance rows added by the PLANNER (A2 c11) ══════════════════
//
// The executor's rows above prove D, M1 and M4 rendered, and prove M2/M3/M5 as
// decisions and WIRING. Per AGENTS.md "a test that only asserts source text is not
// acceptance evidence for a user-facing change", the two user-facing targets that
// were still only unit- or wiring-proven get RENDERED, CLICKED rows here. These
// rows are ADDITIVE: nothing above is deleted, weakened or re-pointed (§16).

test('M2 RENDERED: Change room opens a picker of the free rooms, and one click picks a room', async () => {
	const ManualEditPanel = (await import('@/components/ManualEditPanel')).default;
	const entry = {
		entryId: 'e-m2', day: 'MONDAY', startTime: '06:00', endTime: '06:45',
		roomId: 11, facultyId: 21, subjectId: 31, sectionId: 41,
	};
	// Two rooms free at 06:00; two occupied there. The class own room (11) is
	// excluded even though it is "free" — choosing it is not a change.
	const roomMap = new Map<number, any>([
		[11, { id: 11, name: 'Room 101', buildingShortCode: 'G7AW' }],
		[12, { id: 12, name: 'Room 102', buildingShortCode: 'G7AW' }],
		[13, { id: 13, name: 'Room 103', buildingShortCode: 'G7AW' }],
		[14, { id: 14, name: 'Room 104', buildingShortCode: 'G7AW' }],
	]);
	const draftEntries = [
		entry,
		{ entryId: 'e-busy', day: 'MONDAY', startTime: '06:00', endTime: '06:45', roomId: 13, facultyId: 22, subjectId: 31, sectionId: 42 },
		{ entryId: 'e-busy2', day: 'MONDAY', startTime: '06:00', endTime: '06:45', roomId: 14, facultyId: 23, subjectId: 31, sectionId: 43 },
	];
	const view = renderIn(createElement(ManualEditPanel, {
		entry: entry as any,
		violationIndex: new Map(),
		followUps: new Set(),
		onToggleFollowUp: () => {},
		onClose: () => {},
		subjectLabel: () => 'TLE',
		facultyLabel: () => 'P. CRUZ',
		sectionLabel: () => 'GR7 - Luna',
		gradeForSection: () => 7,
		roomLabel: (id: number) => `Room ${100 + id}`,
		isStaleRoom: () => false,
		timeSlots: [
			{ startTime: '06:00', endTime: '06:45' },
			{ startTime: '06:45', endTime: '07:30' },
		],
		roomMap: roomMap as any,
		facultyMap: new Map() as any,
		subjectMap: new Map() as any,
		draftEntries: draftEntries as any,
		onPreview: async () => null,
		onCommit: async () => true,
		previewLoading: false,
		commitLoading: false,
		initialAction: 'CHANGE_ROOM',
		onForceOpen: () => {},
	} as any));

	assert.ok(view.has('manual-edit-free-rooms'), 'the room picker is VISIBLE, not a silent no-op');
	assert.ok(view.has('manual-edit-free-room-12'), 'a free room is offered, one click each');
	assert.equal(view.has('manual-edit-free-room-13'), false, 'a room occupied at this time is NOT offered');
	assert.equal(view.has('manual-edit-free-room-11'), false, 'the class own room is not offered as a change');
	assert.equal(view.has('manual-edit-no-free-room'), false, 'the negative sentence is absent while a room can be offered');
	view.click('manual-edit-free-room-12');
	assert.equal(
		view.host.querySelector('[data-testid="manual-edit-free-room-12"]')?.className.includes('bg-primary'),
		true,
		'clicking the offered room SELECTS it — the control has a visible effect',
	);
});

test('M2 RENDERED: with no other room free, the one sentence shows and the selection is kept', async () => {
	const ManualEditPanel = (await import('@/components/ManualEditPanel')).default;
	const entry = {
		entryId: 'e-m2n', day: 'MONDAY', startTime: '06:00', endTime: '06:45',
		roomId: 11, facultyId: 21, subjectId: 31, sectionId: 41,
	};
	const roomMap = new Map<number, any>([
		[11, { id: 11, name: 'Room 101' }],
		[12, { id: 12, name: 'Room 102' }],
	]);
	const draftEntries = [
		entry,
		{ entryId: 'e-busy', day: 'MONDAY', startTime: '06:00', endTime: '06:45', roomId: 12, facultyId: 22, subjectId: 31, sectionId: 42 },
	];
	const view = renderIn(createElement(ManualEditPanel, {
		entry: entry as any,
		violationIndex: new Map(),
		followUps: new Set(),
		onToggleFollowUp: () => {},
		onClose: () => {},
		subjectLabel: () => 'TLE',
		facultyLabel: () => 'P. CRUZ',
		sectionLabel: () => 'GR7 - Luna',
		gradeForSection: () => 7,
		roomLabel: (id: number) => `Room ${100 + id}`,
		isStaleRoom: () => false,
		timeSlots: [{ startTime: '06:00', endTime: '06:45' }],
		roomMap: roomMap as any,
		facultyMap: new Map() as any,
		subjectMap: new Map() as any,
		draftEntries: draftEntries as any,
		onPreview: async () => null,
		onCommit: async () => true,
		previewLoading: false,
		commitLoading: false,
		initialAction: 'CHANGE_ROOM',
		onForceOpen: () => {},
	} as any));

	// The exact M2 sentence, rendered — never nothing, which was the recorded defect.
	assert.equal(view.testId('manual-edit-no-free-room'), NO_OTHER_ROOM_FREE);
	assert.equal(NO_OTHER_ROOM_FREE, 'No other room is free at this time');
	assert.equal(view.has('manual-edit-free-rooms'), false, 'an empty picker is not rendered');
	// The selection is KEPT: the panel is still acting on this class, and the
	// full searchable select is still there so a room outside this view is reachable.
	assert.ok(view.text.includes('GR7 - Luna') || view.text.includes('TLE'),
		'the panel is still acting on the SELECTED class, so the operator did not lose their selection');
});

/*
 * M5 SUPERSEDED (correction 4, F4) — KEPT, STILL RUNNING, NOT WEAKENED.
 *
 * The row below constructs the strip WITH `children` — the ONE shape no production
 * caller uses. Both headers render `<TimetableDraftStateStrip visibility={…} />` and
 * nothing else, so this row proved the strip can hold an Undo child while the real
 * Undo placement went unpinned. It could not detect a regression in where the single
 * Undo actually lands.
 *
 * The replacement is `M5R RENDERED` in `a2-c11-draft-actions-correction.test.tsx`
 * (same committed `test:ux-a2-c11-draft-actions` script): it renders the REAL
 * `TimetableSimpleHeader`, finds the Undo the workspace really builds, and clicks it.
 * Nothing was deleted (AGENTS.md §16).
 */
test('M5 SUPERSEDED (correction 4, F4): Undo sits in the persistent draft strip and one click reverts the last edit', async () => {
	const { TimetableUndoRedoControl } = await import('@/components/timetable/TimetableUndoRedoControl');
	let reverted = 0;
	const view = renderIn(createElement(
		TimetableDraftStateStrip,
		{
			visibility: 'Draft — not visible to teachers until you publish',
		},
		createElement(TimetableUndoRedoControl, {
			editHistoryCount: 1,
			revertLoading: false,
			revertLastEdit: async () => { reverted += 1; },
			redoState: null,
			redoVersionStale: false,
			redoLastEdit: async () => {},
			clearRedo: () => {},
			setShowEditHistory: () => {},
			undoNotice: null,
			undoBlockedReason: null,
		} as any),
	));
	// Visible after any accepted edit, and inside the SAME persistent strip as the
	// draft state — not buried in a menu.
	assert.ok(view.has('timetable-draft-state-strip'), 'the persistent strip is on screen');
	assert.ok(view.text.includes('not visible to teachers until you publish'), 'the draft state names its audience');
	const undo = view.byLabel('Undo last manual schedule change')
		?? view.host.querySelector('[data-testid="timetable-visible-undo"]');
	assert.ok(undo, 'the Undo control is rendered inside the strip');
	assert.equal((undo as HTMLButtonElement).disabled, false, 'with one edit in the draft, Undo is live');
	act(() => { (undo as HTMLElement).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	assert.equal(reverted, 1, 'ONE click reverts the last edit — no second step, no dialog');
});
