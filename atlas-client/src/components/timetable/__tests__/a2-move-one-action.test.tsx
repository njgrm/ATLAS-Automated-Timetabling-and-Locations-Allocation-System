/**
 * A2 move-swap, Item 1 — "Choose a new time" then a highlighted free slot moves
 * on that ONE action, with the existing receipt and Undo; the strip stops
 * promising a confirmation step that does not exist.
 *
 * ── THE RECORDED DEFECT ──────────────────────────────────────────────────────
 *
 * "Choose a new time then a highlighted free slot shows *Review the change
 * before saving. Nothing changes until you confirm.*" The move already committed
 * on the slot pick; the sentence described a step the screen does not have, so
 * the operator waited for a confirm that never came.
 *
 * ── HOW EACH ROW IS DECIDED ──────────────────────────────────────────────────
 *
 * H1 RENDERED, BEHAVIOURAL: the REAL `useScheduleReviewWorkspaceState()` is
 *    mounted (the A8 host recipe) with the transport mocked, the move is armed
 *    exactly as `startMoveSelectedEntry` arms it, and the REAL `handleKbPlace`
 *    is driven onto a free slot. It must dispatch exactly one move commit, write
 *    the ONE receipt sentence, and register the contextual Undo — with NO confirm
 *    control in the path.
 *
 * H2 RENDERED COPY: the REAL extracted strip renders the truthful hint. The old
 *    promise is absent. This fails on base 607f2363 where the strip still says
 *    `Review the change before saving. Nothing changes until you confirm.`
 *
 * Run: `npm run test:ux-a2-move-swap`.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

import type { DraftReport, ScheduledEntry, ViolationReport } from '@/types';

const ORIGIN = 'https://njgrm.buru-degree.ts.net';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: `${ORIGIN}/timetable` });
Object.assign(globalThis, {
	window: dom.window, document: dom.window.document, Document: dom.window.Document,
	DocumentFragment: dom.window.DocumentFragment, ShadowRoot: dom.window.ShadowRoot,
	HTMLElement: dom.window.HTMLElement, HTMLDivElement: dom.window.HTMLDivElement,
	HTMLSpanElement: dom.window.HTMLSpanElement, HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLInputElement: dom.window.HTMLInputElement, HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
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
const { ScheduleReviewWorkspaceSelectionStrip } = await import('../ScheduleReviewWorkspaceSelectionStrip');
const { Move } = await import('lucide-react');

const ACTOR_TOKEN = `header.${Buffer.from(JSON.stringify({ role: 'admin', userId: 46, schoolId: 1 })).toString('base64url')}.signature`;

const ENTRY_A: ScheduledEntry = {
	entryId: 'e-moving', facultyId: 21, roomId: 31, subjectId: 11, sectionId: 71,
	day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1,
} as ScheduledEntry;

const MOVED_SLOT = { day: 'MONDAY', startTime: '07:30', endTime: '08:15' };

function draft(): DraftReport {
	return {
		runId: 7, status: 'COMPLETED', entries: [ENTRY_A], unassignedItems: [], version: 3,
		summary: { runId: 7, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false },
		finishedAt: '2030-06-01T00:00:00.000Z', createdAt: '2030-06-01T00:00:00.000Z',
	} as unknown as DraftReport;
}

function previewResult() {
	return {
		allowed: true, hardViolations: [], softViolations: [], humanConflicts: [],
		violationDelta: { hardBefore: 0, hardAfter: 0, softBefore: 0, softAfter: 0 },
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
	(globalThis as Record<string, unknown>).__phase = 'old';
	(atlasApi as unknown as { get: unknown }).get = async (url: string) => ({ data: respond(url) });
	(atlasApi as unknown as { post: unknown }).post = async (url: string) => {
		posts.push(url);
		if (url.includes('/manual-edits/preview')) return { data: previewResult() };
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
function A2MoveHost() {
	hostState = useScheduleReviewWorkspaceState() as any;
	if (!hostState.centerWorkspaceContext) return createElement('div', { 'data-testid': 'a2-move-host-pending' });
	return createElement('div', { 'data-testid': 'a2-move-host-ready' });
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	timetableQueryClient.clear();
	void resetTimetableWarmScope;
});

test('H1 the pick IS the move: one commit, the receipt, and the Undo, with no confirm control', async () => {
	await withMockedApi(async () => {
		timetableQueryClient.clear();
		resetTimetableWarmScope();
		posts.length = 0;
		dom.window.sessionStorage.setItem('atlas_local_token', ACTOR_TOKEN);
		hostState = null;

		try {
			await mount(createElement(MemoryRouter, { initialEntries: ['/timetable'] }, createElement(A2MoveHost)));
			await waitFor(
				() => hostState?.centerWorkspaceContext?.handleKbPlace && hostState?.draft?.runId === 7,
				'the production workspace to settle with the run on screen',
			);

			// Arm the move exactly as `startMoveSelectedEntry` arms it.
			act(() => { hostState.headerContext.setKbSelectedSource({ type: 'entry', entry: ENTRY_A }); });
			// One action: the slot pick.
			await act(async () => { await hostState.centerWorkspaceContext.handleKbPlace(MOVED_SLOT.day, MOVED_SLOT.startTime, MOVED_SLOT.endTime); });

			const commitPosts = posts.filter((url) => url.includes('/manual-edits/commit'));
			assert.equal(commitPosts.length, 1, 'the slot pick dispatched exactly one move commit — no confirm click');
			assert.equal(posts.filter((url) => url.includes('/manual-edits/preview')).length, 1, 'and exactly one authoritative preview gated it');

			// The contextual Undo the other committed changes register.
			assert.ok(hostState.lastAutoSaveUndo, 'the move registered a contextual Undo');
			assert.equal(hostState.lastAutoSaveUndo.ledger, 'run', 'reverting the run manual-edits ledger');
			assert.equal(hostState.lastAutoSaveUndo.editId, 88, 'bound to the commit’s edit id');

			// The ONE receipt sentence, naming the class and both slots.
			assert.match(hostState.inlineActionStatus?.message ?? '', /^Moved TLE for 7-Rizal from Mon 6:00 to Mon 7:30\./, 'the receipt names the class, from and to');
			assert.doesNotMatch(hostState.inlineActionStatus?.message ?? '', /Review the change before saving|Nothing changes until you confirm/, 'and no confirmation step is promised');
		} finally {
			await act(async () => { root?.unmount(); root = null; });
			hostState = null;
			await flush(2);
		}
	});
});

test('H2 RENDERED: the strip hint states the truth and no longer promises a confirmation step', async () => {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	await act(async () => {
		createRoot(host).render(createElement(ScheduleReviewWorkspaceSelectionStrip, {
			selectedEntry: ENTRY_A,
			subjectLabel: () => 'TLE',
			sectionLabel: () => '7-Rizal',
			publishedChangeScope: false,
			primaryAction: { label: 'Choose a new time', icon: Move, onClick: () => {} },
			lock: { isLocked: false, label: 'Lock this class', line: 'Not locked', blockReason: null, toggle: async () => {} } as never,
			onDismissSelection: () => {}, onChooseNewTime: () => {}, onChangeRoom: () => {}, onSwap: () => {},
			onViewDetails: () => {}, onChangeOwner: () => {}, onTeacherLeaving: () => {}, onExpertDetails: () => {},
		} as never));
	});
	const hint = host.querySelector('[data-testid="timetable-selection-strip-hint"]')?.textContent ?? '';
	assert.equal(hint, 'Changes apply as soon as you pick a slot.', 'the strip says when the change lands');
	assert.doesNotMatch(hint, /Review the change before saving|Nothing changes until you confirm/, 'and never promises a confirm that does not exist');
});
