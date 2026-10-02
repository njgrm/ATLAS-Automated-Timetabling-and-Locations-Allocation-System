/**
 * A5 — the one-click "Place" path, driven through the REAL hook (2026-09-30).
 *
 * ── WHY THIS FILE EXISTS (fresh QA, 2026-09-30) ──────────────────────────────
 *
 * The packet required "a rendered/hook-level control that a clean slot click
 * commits and produces a receipt with Undo". The candidate's `#4 SOURCE` row in
 * `a5-unassigned-panel.test.tsx` only read the hook's source text and matched a
 * regex, so it could not see the commit branch's ROUTING. QA proved the gap:
 * widening the real `decision.kind === 'auto-commit'` branch to also accept
 * `review-blocked` left `test:a5-unassigned-panel`, `test:timetable-relaxed-main-b02`
 * and `test:a2-place-one-action` all green — no test exercised `handleKbPlace`'s
 * place-unassigned commit routing.
 *
 * ── HOW EACH ROW IS DECIDED ──────────────────────────────────────────────────
 *
 * The REAL `useScheduleReviewWorkspaceState()` is mounted (the A8 host recipe,
 * same as `a2-move-one-action.test.tsx`; the transport is mocked at the
 * `atlasApi` object, NOT stubbed at the module boundary as
 * `a2-place-one-action.test.tsx` does), the unassigned item is armed exactly as
 * the panel's `Place` button arms it (`setKbSelectedSource({ type: 'unassigned',
 * item })`), and the REAL `centerWorkspaceContext.handleKbPlace` is driven onto
 * a slot:
 *
 *   A  RENDERED/BEHAVIOURAL: a clean slot commits EXACTLY ONCE, registers the
 *      contextual Undo, and writes the REAL `buildEditReceipt` sentence.
 *   B1 RENDERED/BEHAVIOURAL: a hard-blocked preview commits ZERO and keeps the
 *      review path (the `No free time:` message) — this is the row QA's mutant
 *      turns red.
 *   B2 a no-owner item commits ZERO and opens the Teaching Load repair.
 *   B3 an occupied slot commits ZERO and opens the placement review.
 *
 * Run: `npm run test:a5-unassigned-panel`.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

import type { DraftReport, ScheduledEntry, UnassignedItem, ViolationReport } from '@/types';

const ORIGIN = 'https://njgrm.buru-degree.ts.net';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: `${ORIGIN}/timetable` });
Object.assign(globalThis, {
	window: dom.window, document: dom.window.document, Document: dom.window.Document,
	DocumentFragment: dom.window.DocumentFragment, ShadowRoot: dom.window.ShadowRoot,
	HTMLElement: dom.window.HTMLElement, HTMLDivElement: dom.window.HTMLDivElement,
	HTMLSpanElement: dom.window.HTMLSpanElement, HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLInputElement: dom.window.HTMLInputElement, HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	SVGElement: dom.window.SVGElement, Element: dom.window.Element, Node: dom.window.Node,
	Event: dom.window.Event, CustomEvent: dom.window.CustomEvent, FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent, MouseEvent: dom.window.MouseEvent,
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter, MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

function matchMediaStub(query: string) {
	const min = /min-width:\s*(\d+)px/.exec(query);
	const max = /max-width:\s*(\d+)px/.exec(query);
	const matches = min ? 1366 >= Number(min[1]) : max ? 1366 <= Number(max[1]) : false;
	return {
		matches, media: query, onchange: null,
		addEventListener: () => {}, removeEventListener: () => {},
		addListener: () => {}, removeListener: () => {},
		dispatchEvent: () => false,
	};
}
(dom.window as unknown as { matchMedia: typeof matchMediaStub }).matchMedia = matchMediaStub;
(globalThis as Record<string, unknown>).matchMedia = matchMediaStub;
Object.defineProperty(globalThis, 'sessionStorage', { value: dom.window.sessionStorage, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
(globalThis as Record<string, unknown>).fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });

const { createRoot } = await import('react-dom/client');
const atlasApi = (await import('@/lib/api')).default;
const { timetableQueryClient } = await import('@/lib/timetable-data/timetableQueryClient');
const { resetTimetableWarmScope } = await import('@/lib/timetable-data/timetableServerState');
const { MemoryRouter } = await import('react-router-dom');
const { useScheduleReviewWorkspaceState } = await import('@/hooks/useScheduleReviewWorkspaceState');

const ACTOR_TOKEN = `header.${Buffer.from(JSON.stringify({ role: 'admin', userId: 46, schoolId: 1 })).toString('base64url')}.signature`;

const ENTRY_A: ScheduledEntry = {
	entryId: 'e-existing', facultyId: 21, roomId: 31, subjectId: 11, sectionId: 71,
	day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1,
} as ScheduledEntry;

const FREE_SLOT = { day: 'MONDAY', startTime: '07:30', endTime: '08:15' };
const OCCUPIED_SLOT = { day: 'MONDAY', startTime: '06:00', endTime: '06:45' };

/** The item the panel's `Place` button hands to `setKbSelectedSource`. */
function placeItem(overrides: Partial<UnassignedItem> = {}): UnassignedItem {
	return {
		sectionId: 71, subjectId: 11, gradeLevel: 7, session: 1,
		reason: 'NO_AVAILABLE_SLOT', facultyId: 21, homeRoomId: null, termIndex: 1,
		...overrides,
	} as UnassignedItem;
}

function draft(): DraftReport {
	return {
		runId: 7, status: 'COMPLETED', entries: [ENTRY_A], unassignedItems: [], version: 3,
		summary: { runId: 7, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false },
		finishedAt: '2030-06-01T00:00:00.000Z', createdAt: '2030-06-01T00:00:00.000Z',
	} as unknown as DraftReport;
}

function cleanPreview() {
	return {
		allowed: true, hardViolations: [], softViolations: [], humanConflicts: [],
		violationDelta: { hardBefore: 0, hardAfter: 0, softBefore: 0, softAfter: 0 },
		affectedEntries: [], policyImpactSummary: [], dailyLoadBand: 'ok', dailyMinutesAfter: 0, facultyWeeklyMinutes: {},
	};
}

function blockedPreview() {
	const conflict = {
		code: 'FACULTY_TIME_CONFLICT',
		severity: 'HARD',
		humanTitle: 'Teacher double-booked',
		humanDetail: 'Mr Cruz is already teaching ESP on Mon 7:00 AM–7:45 AM',
	};
	return {
		allowed: false, hardViolations: [conflict], softViolations: [], humanConflicts: [conflict],
		violationDelta: { hardBefore: 0, hardAfter: 1, softBefore: 0, softAfter: 0 },
		affectedEntries: [], policyImpactSummary: [], dailyLoadBand: 'ok', dailyMinutesAfter: 0, facultyWeeklyMinutes: {},
	};
}

function commitResult() {
	return {
		editId: 88, newVersion: 4, draft: draft(),
		violationDelta: { hardBefore: 0, hardAfter: 0, softBefore: 0, softAfter: 0 },
		warnings: [],
	};
}

const posts: string[] = [];
let previewResponse: unknown = null;
function respond(url: string): unknown {
	if (/\/generation\/\d+\/\d+\/runs$/.test(url)) return { runs: [{ id: 7, status: 'COMPLETED', runNumber: 1 }] };
	if (url.includes('/runs/latest/draft')) return draft();
	if (url.includes('/runs/latest/violations')) return { violations: [] } as unknown as ViolationReport;
	if (url.includes('pre-generation-drafts')) return { counts: { draft: 0 }, draftPlacements: [] };
	if (url.includes('/auth/me')) return { user: { schoolId: 1, userId: 46, role: 'admin' } };
	if (url.includes('/runtime/context')) {
		return {
			schoolId: 1, activeSchoolYearId: 9, activeSchoolYearLabel: '2030-2031', source: 'atlas-persisted',
			stale: false, activeTerm: { verified: false, termIndex: 1, displayLabel: 'Term 1', orderedTerms: [] },
			activeSchoolYear: { isArchived: false },
		};
	}
	if (url.includes('/readiness/diagnostic')) return { readiness: { status: 'READY', generateAllowed: true, zeroWrite: true, groups: [], blockers: [], gaps: [], totals: { lines: 0, pairs: 0, sessionsByTerm: {} } } };
	if (/\/subjects\?/.test(url)) return { subjects: [{ id: 11, code: 'TLE', name: 'TLE' }] };
	if (/\/faculty\?/.test(url)) return { faculty: [{ id: 21, firstName: 'P.', lastName: 'Cruz' }] };
	if (url.includes('/map/schools/')) return { buildings: [{ id: 2, name: 'G7 Main', shortCode: 'G7AW', rooms: [{ id: 31, name: 'Room 101', floor: 1, type: 'CLASSROOM', isTeachingSpace: true, features: [] }] }] };
	if (url.includes('/sections/summary/')) return { sections: [{ id: 71, name: '7-Rizal' }] };
	if (url.includes('/room-preferences/')) return { counts: { pending: 0 }, requests: [] };
	if (url.includes('/policies/')) return { policy: null };
	if (url.includes('/manual-edits')) return { edits: [] };
	return {};
}

function withMockedApi<T>(fn: () => Promise<T>): Promise<T> {
	const originalGet = atlasApi.get;
	const originalPost = atlasApi.post;
	(atlasApi as unknown as { get: unknown }).get = async (url: string) => ({ data: respond(url) });
	(atlasApi as unknown as { post: unknown }).post = async (url: string) => {
		posts.push(url);
		if (url.includes('/manual-edits/preview')) return { data: previewResponse ?? cleanPreview() };
		if (url.includes('/manual-edits/commit')) return { data: commitResult() };
		return { data: {} };
	};
	return fn().finally(() => {
		(atlasApi as unknown as { get: unknown }).get = originalGet;
		(atlasApi as unknown as { post: unknown }).post = originalPost;
	});
}

const container = () => document.getElementById('root')!;
let root: Root | null = null;
async function mount(element: ReturnType<typeof createElement>) {
	if (root) await act(async () => { root?.unmount(); });
	container().innerHTML = '';
	root = createRoot(container());
	await act(async () => { root?.render(element); });
}
async function flush(rounds = 6) {
	for (let index = 0; index < rounds; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}
async function waitFor(predicate: () => boolean, label: string, rounds = 100) {
	for (let index = 0; index < rounds; index += 1) {
		if (predicate()) return;
		await flush(1);
	}
	assert.ok(predicate(), `timed out waiting for ${label}`);
}

let hostState: any = null;
function A5PlaceHost() {
	hostState = useScheduleReviewWorkspaceState() as any;
	if (!hostState.centerWorkspaceContext) return createElement('div', { 'data-testid': 'a5-place-host-pending' });
	return createElement('div', { 'data-testid': 'a5-place-host-ready' });
}

type Observed = {
	commitPosts: string[];
	previewPosts: string[];
	undo: any;
	status: any;
};

/**
 * Mount the REAL hook, arm an unassigned item exactly as the panel's `Place`
 * button does, drive the REAL `handleKbPlace`, and report what the hook did.
 */
async function placeThroughRealHook(item: UnassignedItem, slot: { day: string; startTime: string; endTime: string }, preview: unknown): Promise<Observed> {
	previewResponse = preview;
	const observed: Observed = { commitPosts: [], previewPosts: [], undo: null, status: null };
	await withMockedApi(async () => {
		timetableQueryClient.clear();
		resetTimetableWarmScope();
		posts.length = 0;
		dom.window.sessionStorage.setItem('atlas_local_token', ACTOR_TOKEN);
		hostState = null;
		try {
			await mount(createElement(MemoryRouter, { initialEntries: ['/timetable'] }, createElement(A5PlaceHost)));
			await waitFor(
				() => hostState?.centerWorkspaceContext?.handleKbPlace && hostState?.draft?.runId === 7,
				'the production workspace to settle with the run on screen',
			);
			// Arm the placement exactly as the panel's `Place` button arms it.
			act(() => { hostState.headerContext.setKbSelectedSource({ type: 'unassigned', item }); });
			await act(async () => { await hostState.centerWorkspaceContext.handleKbPlace(slot.day, slot.startTime, slot.endTime); });
			observed.commitPosts = posts.filter((url) => url.includes('/manual-edits/commit'));
			observed.previewPosts = posts.filter((url) => url.includes('/manual-edits/preview'));
			observed.undo = hostState.lastAutoSaveUndo;
			observed.status = hostState.inlineActionStatus;
		} finally {
			await act(async () => { root?.unmount(); root = null; });
			hostState = null;
			previewResponse = null;
			await flush(2);
		}
	});
	return observed;
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	timetableQueryClient.clear();
	void resetTimetableWarmScope;
});

test('A the one-click place on a CLEAN slot commits exactly once, registers Undo, and writes the receipt', async () => {
	const observed = await placeThroughRealHook(placeItem(), FREE_SLOT, cleanPreview());

	assert.equal(observed.previewPosts.length, 1, 'the placement was gated by exactly one authoritative preview');
	assert.equal(observed.commitPosts.length, 1, 'the clean slot committed on the SINGLE click — no second Confirm');
	assert.ok(observed.undo, 'the place registered a contextual Undo');
	assert.equal(observed.undo.ledger, 'run', 'reverting the run manual-edits ledger');
	assert.equal(observed.undo.editId, 88, 'bound to the commit’s edit id');
	assert.equal(observed.undo.newVersion, 4, 'and to the committed version');

	// The REAL `buildEditReceipt` sentence, naming the class and its new slot.
	assert.match(
		observed.status?.message ?? '',
		/^Placed TLE for 7-Rizal to Mon 7:30\. No new problems\. Undo below\.$/,
		'the receipt names the class, the destination, the honest problem clause, and the Undo',
	);
	assert.equal(observed.status?.tone, 'success', 'a clean placement reads as a success');
});

test('B1 a HARD-BLOCKED slot commits ZERO and keeps the review path (QA mutant turns this red)', async () => {
	const observed = await placeThroughRealHook(placeItem(), FREE_SLOT, blockedPreview());

	assert.equal(observed.previewPosts.length, 1, 'the blocked placement still ran the authoritative preview');
	assert.equal(observed.commitPosts.length, 0, 'a hard-blocked slot must NOT commit — no write on the review path');
	assert.equal(observed.undo, null, 'and registers NO Undo for a change that never landed');
	assert.match(observed.status?.message ?? '', /^No free time: this slot double-books /, 'the review path states the obstruction in plain words');
	assert.doesNotMatch(observed.status?.message ?? '', /^Placed /, 'and never speaks the committed receipt');
	assert.equal(observed.status?.tone, 'error', 'the blocked placement reads as an error');
});

test('B2 a NO-OWNER item commits ZERO and opens the Teaching Load repair', async () => {
	const observed = await placeThroughRealHook(placeItem({ facultyId: null }), FREE_SLOT, cleanPreview());

	assert.equal(observed.commitPosts.length, 0, 'a session with no owner must NOT commit a placement');
	assert.equal(observed.previewPosts.length, 0, 'and never reaches the placement preview');
	assert.equal(observed.undo, null, 'no Undo for a change that never landed');
	assert.match(observed.status?.message ?? '', /no Teaching Load owner yet/, 'the only honest next step is the repair');
});

test('B3 an OCCUPIED slot commits ZERO and opens the placement review', async () => {
	const observed = await placeThroughRealHook(placeItem(), OCCUPIED_SLOT, cleanPreview());

	assert.equal(observed.commitPosts.length, 0, 'an occupied slot must NOT auto-commit');
	assert.equal(observed.previewPosts.length, 0, 'and is refused before any authoritative preview');
	assert.equal(observed.undo, null, 'no Undo for a change that never landed');
	assert.match(observed.status?.message ?? '', /^Placement review opened\./, 'the occupied slot keeps the review path');
});
