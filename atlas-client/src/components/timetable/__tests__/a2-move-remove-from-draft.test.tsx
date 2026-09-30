/**
 * A2 move-swap, Item 3 — "Remove from draft" in the selected-class More menu:
 * one action, no confirm dialog, one receipt, and a contextual Undo on the
 * DRAFT ledger.
 *
 * ── THE RECORDED DEFECT ──────────────────────────────────────────────────────
 *
 * "The selected-class menu has no way to take a class out of the draft
 * (unschedule back to the unplaced list)." The capability existed
 * (`unassignDraftPlacement` → `DELETE …/pre-generation-drafts/{id}`) but was
 * reachable only behind a second confirmation.
 *
 * ── HOW EACH ROW IS DECIDED ──────────────────────────────────────────────────
 *
 * J1 RENDERED: the REAL `ScheduleReviewWorkspaceSelectedActions` renders the
 *    `Remove from draft` row when, and only when, the caller can act
 *    (`onRemoveFromDraft` present). Fails on base 607f2363: the row does not
 *    exist at all.
 * J2 RENDERED, BEHAVIOURAL: the REAL `useScheduleReviewWorkspaceState()` is
 *    mounted; `removeDraftPlacement(id)` performs exactly one DELETE with no
 *    confirm dialog and registers the draft-ledger Undo plus the ONE receipt.
 *
 * Run: `npm run test:ux-a2-move-swap`.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

import type { DraftReport } from '@/types';

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
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

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
const { ScheduleReviewWorkspaceSelectedActions } = await import('../ScheduleReviewWorkspaceSelectedActions');
const { DropdownMenu, DropdownMenuTrigger } = await import('@/ui/dropdown-menu');

const ACTOR_TOKEN = `header.${Buffer.from(JSON.stringify({ role: 'admin', userId: 46, schoolId: 1 })).toString('base64url')}.signature`;

const PLACEMENT = {
	id: 900, status: 'DRAFT', sectionId: 71, subjectId: 11, facultyId: 21, roomId: 31,
	day: 'MONDAY', startTime: '06:00', endTime: '06:45', version: 1,
};

function draftBoard() {
	return {
		placements: [PLACEMENT], queue: [], periodSlots: [], classPeriodSlots: [],
		counts: { draft: 1, lockedForRun: 0, archived: 0, unscheduled: 0 },
		filters: { grades: [], departments: [], buildings: [] },
	};
}
function draft(): DraftReport {
	return {
		runId: 7, status: 'COMPLETED', entries: [], unassignedItems: [], version: 3,
		summary: { runId: 7, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false },
		finishedAt: '2030-06-01T00:00:00.000Z', createdAt: '2030-06-01T00:00:00.000Z',
	} as unknown as DraftReport;
}

const deletes: string[] = [];
function respond(url: string): unknown {
	if (/\/generation\/\d+\/\d+\/runs$/.test(url)) return { runs: [{ id: 7, status: 'COMPLETED', runNumber: 1 }] };
	if (url.includes('/runs/latest/draft')) return draft();
	if (url.includes('/runs/latest/violations')) return { violations: [] };
	if (url.includes('pre-generation-drafts')) return draftBoard();
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
	if (url.includes('/map/schools/')) return { buildings: [] };
	if (url.includes('/sections/summary/')) return { sections: [{ id: 71, name: '7-Rizal' }] };
	if (url.includes('/room-preferences/')) return { counts: { pending: 0 }, requests: [] };
	if (url.includes('/policies/')) return { policy: null };
	if (url.includes('/manual-edits')) return { edits: [] };
	return {};
}

function withMockedApi<T>(fn: () => Promise<T>): Promise<T> {
	const originalGet = atlasApi.get;
	const originalDelete = (atlasApi as unknown as { delete?: unknown }).delete;
	(atlasApi as unknown as { get: unknown }).get = async (url: string) => ({ data: respond(url) });
	(atlasApi as unknown as { delete: unknown }).delete = async (url: string) => {
		deletes.push(url);
		return { data: { board: { ...draftBoard(), placements: [] }, operationId: 900, resultingVersion: 905 } };
	};
	return fn().finally(() => {
		(atlasApi as unknown as { get: unknown }).get = originalGet;
		(atlasApi as unknown as { delete: unknown }).delete = originalDelete;
	});
}

let root: Root | null = null;
const container = () => document.getElementById('root')!;
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
function A2RemoveHost() {
	hostState = useScheduleReviewWorkspaceState() as any;
	if (!hostState.centerWorkspaceContext) return createElement('div', { 'data-testid': 'a2-remove-host-pending' });
	return createElement('div', { 'data-testid': 'a2-remove-host-ready' });
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	timetableQueryClient.clear();
});

const lock = { isLocked: false, label: 'Lock this class', line: 'Not locked', blockReason: null, toggle: async () => {} };

async function renderMenuRow(onRemoveFromDraft?: () => void): Promise<Element | null> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const localRoot = createRoot(host);
	await act(async () => {
		localRoot.render(createElement(DropdownMenu, { open: true },
			createElement(DropdownMenuTrigger as never, null, 'More'),
			createElement(ScheduleReviewWorkspaceSelectedActions, {
				onDismissSelection: () => {}, onChooseNewTime: () => {}, onChangeRoom: () => {}, onSwap: () => {},
				lock: lock as never, onViewDetails: () => {}, onChangeOwner: () => {}, onTeacherLeaving: () => {},
				onExpertDetails: () => {}, onRemoveFromDraft,
			} as never)));
	});
	await flush(2);
	const found = document.body.querySelector('[data-testid="timetable-simple-selected-remove-from-draft-action"]');
	await act(async () => { localRoot.unmount(); });
	host.remove();
	return found;
}

test('J1 RENDERED: the More menu shows Remove from draft only when it can act', async () => {
	assert.ok(await renderMenuRow(() => {}), 'the menu offers Remove from draft for a removable draft class');
	assert.equal(await renderMenuRow(undefined), null, 'and it is absent when there is nothing to remove');
});

test('J2 BEHAVIOURAL: removeDraftPlacement performs exactly one DELETE and registers receipt + draft Undo', async () => {
	await withMockedApi(async () => {
		timetableQueryClient.clear();
		resetTimetableWarmScope();
		deletes.length = 0;
		dom.window.sessionStorage.setItem('atlas_local_token', ACTOR_TOKEN);
		hostState = null;
		if (root) await act(async () => { root?.unmount(); });
		container().innerHTML = '';
		root = createRoot(container());
		await act(async () => { root?.render(createElement(MemoryRouter, { initialEntries: ['/timetable'] }, createElement(A2RemoveHost))); });
		try {
			await waitFor(() => !!hostState?.removeDraftPlacement, 'the production removeDraftPlacement to exist');
			await waitFor(
				() => (hostState?.centerWorkspaceContext?.draftBoard?.placements?.length ?? 0) > 0,
				'the draft board to carry the placement the menu row was opened for',
			);

			await act(async () => { await hostState.removeDraftPlacement(900); });

			assert.equal(deletes.length, 1, 'exactly one removal — no confirm dialog, no second call');
			assert.match(deletes[0], /\/pre-generation-drafts\/900$/, 'the DELETE targets the placement');

			assert.ok(hostState.lastAutoSaveUndo, 'the removal registered a contextual Undo');
			assert.equal(hostState.lastAutoSaveUndo.ledger, 'draft', 'against the DRAFT ledger, so revertDraftEditById reverses it');
			assert.equal(hostState.lastAutoSaveUndo.editId, 900, 'bound to the operation id the DELETE returned');

			const message = hostState.inlineActionStatus?.message ?? '';
			assert.match(message, /^Removed TLE for 7-Rizal from Mon 6:00\./, 'the ONE receipt sentence names the class and the slot it left');
			assert.match(message, /It is back on the unplaced list\./, 'and says where the class went');
			assert.doesNotMatch(message, /Placement removed and returned to queue\./, 'the old toast vocabulary is gone');
		} finally {
			await act(async () => { root?.unmount(); root = null; });
			hostState = null;
			await flush(2);
		}
	});
});
