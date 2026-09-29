/**
 * A8-POST-GENERATION-REFRESH — after a generation run completes, the Class
 * Schedule must show the new draft WITHOUT a manual reload.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 *
 * `useTimetableMutations.triggerGeneration` re-read the workspace with
 * `await loadAll(false)`. `loadAll`'s boolean form maps ONLY to `preserveRun`:
 * `force` stays false, so `runTimetableLoad` reads the runs list and the
 * `run:'latest'` bundle through `ensureTimetableRuns` / `ensureTimetableRunBundle`
 * with `force:false`. Those serve the TanStack entry inside the 60 s
 * `TIMETABLE_STALE_MS` window, so the run the POST just created is never
 * fetched and the grid keeps the previous bundle until a full page reload
 * rebuilds the query client.
 *
 * ── HOW EACH ROW IS DECIDED ─────────────────────────────────────────────────
 *
 * Rows A8-1a / A8-1b exercise the REAL production data layer (the singleton
 * `timetableQueryClient` + the `ensureTimetable*` readers) with a mocked
 * transport, and count dispatches. A8-1a is the failing-first control: it
 * asserts the pre-fix `force:false` path is a cache hit that keeps the OLD
 * draft — the live defect. A8-1b asserts the forced re-read fetches the NEW run
 * and NEW draft.
 *
 * Row A8-2 is RENDERED: the real `TimetableGrid` is fed from the refreshed
 * production data layer in the SAME query-client session (no reload) and must
 * show the new draft; the real `GenerateConfirmDialog` is asserted closed. The
 * dialog's open control proves the closed assertion is load-bearing.
 *
 * Row A8-3 is WIRING (secondary): a source read of the production call site.
 *
 * Row A8-4 is the PRIMARY, RENDERED, BEHAVIOURAL row (added by bounded
 * correction R1). It renders the REAL `useScheduleReviewWorkspaceState()` — hence
 * the REAL `loadAll` and the REAL `triggerGeneration` — inside a `MemoryRouter`,
 * drives the production chain `handleTriggerGenerate` → `confirmGenerate`, and
 * asserts the NEW draft reaches the real grid with no reload and the confirm
 * dialog closes. It FAILS on the reverted (pre-fix) source, so the acceptance
 * no longer rests on a source-text assertion.
 *
 * Run: `npm run test:a8-post-generation-refresh` (wired in atlas-client/package.json
 * in the same commit; `--test-force-exit` ends the run after the production host's
 * own elapsed-time interval, which jsdom does not retire on its own).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

import type { DraftReport, ScheduledEntry, ViolationReport } from '@/types';
import type { ResolvedTimetableScope } from '@/lib/timetable-data/timetableQueryKeys';

const ORIGIN = 'https://njgrm.buru-degree.ts.net';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: `${ORIGIN}/timetable` });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	Document: dom.window.Document,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	HTMLElement: dom.window.HTMLElement,
	HTMLDivElement: dom.window.HTMLDivElement,
	HTMLSpanElement: dom.window.HTMLSpanElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	SVGElement: dom.window.SVGElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
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
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

// The production workspace hook reaches `window.matchMedia` (responsive layout,
// coarse-pointer detection) and reads the auth token from session/localStorage.
// jsdom provides neither, so both are provided here before any hook renders.
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
// `requestCollaborationTicket` uses the global `fetch`. Answering it with a
// non-ok response keeps the host deterministic: no ticket, so no WebSocket is
// ever constructed, and no real network call is attempted.
(globalThis as Record<string, unknown>).fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });

// react-dom must load after the DOM globals, or it disables input events.
const { createRoot } = await import('react-dom/client');
const atlasApi = (await import('@/lib/api')).default;
const { timetableQueryClient } = await import('@/lib/timetable-data/timetableQueryClient');
const {
	ensureTimetableDraftBoard,
	ensureTimetableRunBundle,
	ensureTimetableRuns,
	readTimetableRunBundle,
	resetTimetableWarmScope,
} = await import('@/lib/timetable-data/timetableServerState');
const { timetableRunsQueryKey } = await import('@/lib/timetable-data/timetableQueryKeys');
const { TimetableGrid } = await import('@/components/timetable/TimetableGrid');
const { GenerateConfirmDialog } = await import('@/components/timetable/modals/TimetableWorkflowDialogs');
const { MemoryRouter } = await import('react-router-dom');
const { useScheduleReviewWorkspaceState } = await import('@/hooks/useScheduleReviewWorkspaceState');

const CLIENT_ROOT = resolve(import.meta.dirname, '../../../..');

/* ── the shared scope: (schoolId, schoolYearId, runId='latest', termIndex) ── */

const scope: ResolvedTimetableScope = { schoolId: 1, schoolYearId: 9, runId: 'latest', termIndex: 2 };
const RUN_OLD = 100;
const RUN_NEW = 101;
const OLD_SUBJECT_LABEL = 'OLD-DRAFT-SUBJECT';
const NEW_SUBJECT_LABEL = 'NEW-DRAFT-SUBJECT';

function entry(entryId: string, subjectId: number): ScheduledEntry {
	return {
		entryId,
		facultyId: 9,
		roomId: 9,
		subjectId,
		sectionId: 701,
		day: 'MONDAY',
		startTime: '11:30',
		endTime: '12:15',
		durationMinutes: 45,
		termIndex: 1,
	};
}

function draft(runId: number, entries: ScheduledEntry[]): DraftReport {
	return {
		runId,
		status: 'COMPLETED',
		entries,
		unassignedItems: [],
		summary: { runId, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false },
		inputState: {},
		version: 1,
		finishedAt: '2030-06-01T00:00:00.000Z',
		createdAt: '2030-06-01T00:00:00.000Z',
	} as unknown as DraftReport;
}

const OLD_BUNDLE = { draft: draft(RUN_OLD, [entry('e-old', 1)]), violations: { violations: [] } as unknown as ViolationReport };
const NEW_BUNDLE = {
	draft: draft(RUN_NEW, [entry('e-new', 2)]),
	violations: { violations: [] } as unknown as ViolationReport,
};

const RUN_OLD_ROW = { id: RUN_OLD, status: 'COMPLETED', runNumber: 1 };
const RUN_NEW_ROW = { id: RUN_NEW, status: 'COMPLETED', runNumber: 2 };

/**
 * The token the production hook reads from sessionStorage. It must be a
 * three-segment JWT so `decodeJwtPayload` returns a claim set (role/userId),
 * and the mocked `/auth/me` resolves the actor school it belongs to.
 */
const ACTOR_TOKEN = `header.${Buffer.from(JSON.stringify({ role: 'admin', userId: 46, schoolId: 1 })).toString('base64url')}.signature`;

/** A ready generation diagnostic for the exact host scope (schoolId 1, year 9). */
function readyDiagnostic() {
	return {
		scope: { schoolId: 1, schoolYearId: 9 },
		status: 'READY',
		generateAllowed: true,
		schedulerExecuted: true,
		derivedDemandRevision: 'REV',
		termStructure: {
			format: 'TRIMESTER',
			terms: [{ identity: 'T1', order: 1 }, { identity: 'T2', order: 2 }, { identity: 'T3', order: 3 }],
		},
		totals: { lines: 40, pairs: 12, sessionsByTerm: { T1: 20, T2: 20 } },
		teachingLoadCoverage: { requiredPairs: 0, ownedPairs: 0, missingPairs: 0, inactiveOrStalePairs: 0, outsideScopePairs: 0 },
		blockerCount: 0,
		gapCount: 0,
		gapClassCount: 0,
		groups: [],
		blockers: [],
		gaps: [],
		zeroWrite: true,
	};
}

const SUBJECTS_FIXTURE = [
	{ id: 1, code: OLD_SUBJECT_LABEL, name: 'Old Draft Subject' },
	{ id: 2, code: NEW_SUBJECT_LABEL, name: 'New Draft Subject' },
];
const FACULTY_FIXTURE = [{ id: 9, firstName: 'P.', lastName: 'Cruz' }];
const BUILDINGS_FIXTURE = [
	{ id: 2, name: 'G7 Main', shortCode: 'G7AW', rooms: [{ id: 9, name: 'Room 103', floor: 1, type: 'CLASSROOM', isTeachingSpace: true, features: [] }] },
];

/** `old` is the cache the operator is looking at; the POST flips it to `new`. */
let phase: 'old' | 'new' = 'old';

function respond(url: string): unknown {
	if (/\/generation\/\d+\/\d+\/runs$/.test(url)) {
		return { runs: phase === 'old' ? [RUN_OLD_ROW] : [RUN_NEW_ROW, RUN_OLD_ROW] };
	}
	if (url.includes('/runs/latest/draft')) return phase === 'old' ? OLD_BUNDLE.draft : NEW_BUNDLE.draft;
	if (url.includes('/runs/latest/violations')) return phase === 'old' ? OLD_BUNDLE.violations : NEW_BUNDLE.violations;
	if (url.includes('pre-generation-drafts')) return { counts: { draft: phase === 'old' ? 1 : 2 }, draftPlacements: [] };
	// ── mount-time reads the real production workspace hook issues ──
	if (url.includes('/auth/me')) return { user: { schoolId: 1, userId: 46, role: 'admin' } };
	if (url.includes('/runtime/context')) {
		return {
			schoolId: 1,
			activeSchoolYearId: 9,
			activeSchoolYearLabel: '2030-2031',
			source: 'atlas-persisted',
			stale: false,
			// Unverified but term-indexed: the D3 fallback loads one explicit term.
			activeTerm: { verified: false, termIndex: 1, displayLabel: 'Term 1', orderedTerms: [] },
			activeSchoolYear: { isArchived: false },
		};
	}
	if (url.includes('/readiness/diagnostic')) return { readiness: readyDiagnostic() };
	if (/\/subjects\?/.test(url)) return { subjects: SUBJECTS_FIXTURE };
	if (/\/faculty\?/.test(url)) return { faculty: FACULTY_FIXTURE };
	if (url.includes('/map/schools/')) return { buildings: BUILDINGS_FIXTURE };
	if (url.includes('/sections/summary/')) return { sections: [{ id: 701, name: 'G7AW' }] };
	if (url.includes('/room-preferences/')) return { counts: { pending: 0 }, requests: [] };
	if (url.includes('/policies/')) return { policy: null };
	// The run-scoped manual-edit ledger is read on mount; an empty ledger keeps
	// `editHistory` an array rather than the `undefined` a bare `{}` would give.
	if (url.includes('/manual-edits')) return { edits: [] };
	// Any remaining mount-time read settles with an empty body rather than
	// throwing, so the real workspace host reaches a stable state.
	return {};
}

/**
 * Mocked transport over the REAL production data layer. `post` models the
 * generation request: it returns the completed run and flips the GET phase to
 * `new`, exactly as the server would after a run is created.
 */
function withMockedApi<T>(fn: (calls: string[], posts: string[]) => Promise<T>): Promise<T> {
	const originalGet = atlasApi.get;
	const originalPost = atlasApi.post;
	const calls: string[] = [];
	const posts: string[] = [];
	phase = 'old';
	(atlasApi as unknown as { get: unknown }).get = async (url: string) => {
		calls.push(url);
		return { data: respond(url) };
	};
	(atlasApi as unknown as { post: unknown }).post = async (url: string) => {
		posts.push(url);
		phase = 'new';
		// No `summary` on purpose: `triggerGeneration` then emits no completion
		// toast, so the harness leaves no sonner dismiss timer behind.
		return { data: { id: RUN_NEW, status: 'COMPLETED' } };
	};
	return fn(calls, posts).finally(() => {
		(atlasApi as unknown as { get: unknown }).get = originalGet;
		(atlasApi as unknown as { post: unknown }).post = originalPost;
	});
}

/* ── render harness (jsdom), following ux-audit-findings-c01-dom.test.tsx ── */

const container = () => document.getElementById('root')!;
let root: Root | null = null;

async function mount(element: ReturnType<typeof createElement>) {
	if (root) await act(async () => { root?.unmount(); });
	root = createRoot(container());
	await act(async () => { root?.render(element); });
}

async function flush(rounds = 6) {
	for (let index = 0; index < rounds; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

/** Settle the real host until `predicate()` holds, or fail loudly after the cap. */
async function waitFor(predicate: () => boolean, label: string, rounds = 80) {
	for (let index = 0; index < rounds; index += 1) {
		if (predicate()) return;
		await flush(1);
	}
	assert.ok(predicate(), `timed out waiting for ${label}`);
}

function gridProps(overrides: Record<string, unknown> = {}) {
	return {
		entries: [] as ScheduledEntry[],
		timeSlots: [{ startTime: '11:30', endTime: '12:15' }],
		violationIndex: new Map<string, unknown[]>(),
		highlightedEntryIds: new Set<string>(),
		selectedEntry: null,
		followUps: new Set<string>(),
		onEntryClick: () => {},
		subjectLabel: (id: number) => (id === 2 ? NEW_SUBJECT_LABEL : OLD_SUBJECT_LABEL),
		sectionLabel: () => 'G7AW',
		gradeForSection: () => 7,
		entryContextLabel: () => 'G7AW',
		formatFacultyInitials: () => 'P. CRUZ',
		facultyLabel: () => 'P. CRUZ',
		viewMode: 'section',
		termFilter: 1,
		pivotLabel: () => '',
		roomLabelShort: () => 'Room 103 · G7AW',
		kbSelectedSource: null,
		onKbPlace: () => {},
		getCellConflict: () => null,
		getLiveCellConflict: () => null,
		onNavToFaculty: () => {},
		onNavToSection: () => {},
		onNavToRoom: () => {},
		...overrides,
	} as Record<string, unknown>;
}

function confirmDialog(open: boolean) {
	return createElement(GenerateConfirmDialog, {
		open,
		onOpenChange: () => {},
		isPublished: false,
		schoolYearLabel: '2030-2031',
		termSource: 'atlas',
		lockedClassCount: null,
		classesToSchedule: null,
		enforceShiftWindows: true,
		setEnforceShiftWindows: () => {},
		followUpCount: 0,
		onConfirm: () => {},
	} as never);
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	timetableQueryClient.clear();
	dom.window.close();
});

/* ═══ A8-1 — the data-layer control and the fix ═══════════════════════════ */

test('A8-1a data layer (failing-first control): the pre-fix force:false re-read is a cache hit and keeps the OLD run and draft', async () => {
	await withMockedApi(async (calls, posts) => {
		timetableQueryClient.clear();
		resetTimetableWarmScope();

		// Seed the real singleton client with the OLD run and the OLD run:'latest' bundle.
		await ensureTimetableRuns(scope);
		await ensureTimetableRunBundle(scope);
		assert.equal(readTimetableRunBundle(scope)?.draft.runId, RUN_OLD, 'precondition: the cache holds the OLD draft');

		// Simulate a completed generation: the POST creates run 101 and every
		// subsequent GET now returns the NEW run/draft.
		const { data: completedRun } = await atlasApi.post(`/generation/1/9/runs`, {});
		assert.equal(completedRun.id, RUN_NEW, 'the POST returned the completed run 101');
		assert.equal(completedRun.status, 'COMPLETED');
		assert.equal(posts.length, 1, 'exactly one generation POST was simulated');

		// ── THE DEFECT: the pre-fix path (`loadAll(false)` → force:false) is a
		//    cache hit. It dispatches nothing and the workspace keeps the OLD run.
		calls.length = 0;
		await ensureTimetableRuns(scope, { force: false });
		await ensureTimetableRunBundle(scope, { force: false });
		assert.equal(calls.length, 0, `pre-fix force:false must not dispatch (observed ${calls.length}) — this is the live defect`);
		assert.equal(readTimetableRunBundle(scope)?.draft.runId, RUN_OLD, 'the pre-fix path still holds the OLD draft');
		const staleRuns = timetableQueryClient.getQueryData(timetableRunsQueryKey(scope)) as typeof RUN_OLD_ROW[];
		assert.equal(staleRuns[0].id, RUN_OLD, 'and the OLD run list — the new run 101 is nowhere in the cache');

		// ── THE FIX: the forced active-scope re-read fetches the new run and draft.
		calls.length = 0;
		await ensureTimetableRuns(scope, { force: true });
		await ensureTimetableRunBundle(scope, { force: true });
		const freshRuns = timetableQueryClient.getQueryData(timetableRunsQueryKey(scope)) as typeof RUN_NEW_ROW[];
		assert.equal(freshRuns[0].id, RUN_NEW, 'the fixed path fetched the NEW run (101)');
		assert.equal(readTimetableRunBundle(scope)?.draft.runId, RUN_NEW, 'and the NEW draft');
		assert.ok(calls.some((url) => url.includes('/runs/latest/draft')), 'the run bundle was re-fetched, never served from cache');
	});
});

/* ═══ A8-2 — RENDERED: the grid shows the new draft, no reload ════════════ */

test('A8-2 RENDERED: a completed run makes the grid show the new draft with no reload, and the confirm dialog is closed', async () => {
	await withMockedApi(async () => {
		timetableQueryClient.clear();
		resetTimetableWarmScope();

		await ensureTimetableRuns(scope);
		await ensureTimetableRunBundle(scope);
		await ensureTimetableDraftBoard(scope);

		// BEFORE completion: the grid is fed the OLD draft from the production layer.
		await mount(createElement(TimetableGrid, gridProps({ entries: readTimetableRunBundle(scope)!.draft.entries }) as never));
		assert.ok(container().textContent?.includes(OLD_SUBJECT_LABEL), 'the OLD draft is on the grid before the run');
		assert.ok(!container().textContent?.includes(NEW_SUBJECT_LABEL), 'the NEW draft is not present yet');
		await mount(confirmDialog(true));
		assert.ok(document.body.querySelector('[data-testid="timetable-generate-confirm-dialog"]'), 'the confirm dialog is open before the run commits');

		// COMPLETED GENERATION: POST creates run 101; the GETs now serve the NEW run/draft.
		await atlasApi.post(`/generation/1/9/runs`, {});

		// THE FIX: the active-scope re-read is forced. The query client is NEVER
		// cleared, so this is the same session — no reload.
		await ensureTimetableRuns(scope, { force: true });
		await ensureTimetableRunBundle(scope, { force: true });
		await ensureTimetableDraftBoard(scope, { force: true });

		await mount(createElement(TimetableGrid, gridProps({ entries: readTimetableRunBundle(scope)!.draft.entries }) as never));
		assert.ok(container().textContent?.includes(NEW_SUBJECT_LABEL), 'the NEW draft is rendered after completion with no reload');
		assert.ok(!container().textContent?.includes(OLD_SUBJECT_LABEL), 'the OLD draft is gone from the grid');

		// The dialog is closed into the new draft, and the control proves the
		// closed assertion is load-bearing.
		await mount(confirmDialog(false));
		assert.equal(
			document.body.querySelector('[data-testid="timetable-generate-confirm-dialog"]'),
			null,
			'the generate confirm dialog is closed after completion',
		);
		await mount(confirmDialog(true));
		assert.ok(document.body.querySelector('[data-testid="timetable-generate-confirm-dialog"]'), 'control: the same dialog renders when open');
	});
});

/* ═══ A8-3 — WIRING: the production call site forces the re-read ══════════ */

test('A8-3 WIRING: the generation call site forces the active-scope re-read (the failing-first discriminator)', () => {
	const source = readFileSync(resolve(CLIENT_ROOT, 'src/hooks/useTimetableMutations.ts'), 'utf8');
	const start = source.indexOf('const triggerGeneration = useCallback');
	const end = source.indexOf('const handleTriggerGenerate');
	assert.ok(start >= 0 && end > start, 'the triggerGeneration body was located');
	const body = source.slice(start, end);

	assert.match(
		body,
		/await loadAll\(\{ preserveRun: false, force: true \}\);/,
		'loadAll is called with force:true after a completed run',
	);
	assert.match(
		body,
		/await fetchDraftBoardSummary\(schoolYearId, \{ forceRefresh: true \}\);/,
		'the draft board is re-read with forceRefresh:true',
	);
	assert.doesNotMatch(body, /await loadAll\(false\);/, 'the legacy non-forcing boolean call is gone from the generation path');
	assert.doesNotMatch(body, /await fetchDraftBoardSummary\(schoolYearId\);/, 'the un-forced draft-board read is gone from the generation path');

	// The change is narrow: the two unrelated `loadAll(false)` call sites
	// (publish / discard) are left exactly as they were.
	const remaining = (source.match(/await loadAll\(false\);/g) ?? []).length;
	assert.equal(remaining, 2, 'the unrelated loadAll(false) call sites are untouched');

	// The declarations the call depends on were widened, not bypassed.
	const dataHook = readFileSync(resolve(CLIENT_ROOT, 'src/hooks/useTimetableData.ts'), 'utf8');
	assert.match(dataHook, /loadAll: \(options\?: LoadAllOptions \| boolean\) => Promise<void>;/, 'the data hook contract accepts the options object');
	assert.match(dataHook, /export type LoadAllOptions = \{ preserveRun\?: boolean; force\?: boolean \};/);
	assert.match(dataHook, /fetchDraftBoardSummary: \(syId: number, options\?: FetchOptions\)/, 'the draft-board read accepts force options');
});

/* ═══ A8-4 — RENDERED, BEHAVIOURAL: the REAL production call site ════════
 *
 * A8-1a/A8-2 exercise the data layer and a forced read the TEST performs. This
 * row is the one that runs the REAL production chain — `handleTriggerGenerate`
 * → `confirmGenerate` → `triggerGeneration` — with the REAL `loadAll` from
 * `useTimetableData` and the REAL `fetchDraftBoardSummary`. If the product fix
 * is reverted to `loadAll(false)`, the post-POST re-read is a cache hit,
 * `draft.runId` stays 100, and the new draft never reaches the grid — so this
 * row fails on the reverted source and passes only with the fix. */

let hostState: any = null;
let hostActions: { handleTriggerGenerate: () => void; confirmGenerate: (override?: boolean) => void } | null = null;

/**
 * The real production workspace: `useScheduleReviewWorkspaceState()` builds the
 * data + mutation hooks itself (including the production `loadAll`). The row
 * exposes its state and the two generate controls, then feeds the real grid
 * from `centerWorkspaceContext.gridEntries`.
 */
function A8ProductionHost() {
	const state = useScheduleReviewWorkspaceState() as any;
	hostState = state;
	// `workspaceContexts` is empty until the actor school resolves, so the host
	// renders a placeholder on that first frame.
	const center = state.centerWorkspaceContext;
	const dialog = state.dialogContext;
	if (!center || !dialog) {
		hostActions = null;
		return createElement('div', { 'data-testid': 'a8-host-pending' });
	}
	hostActions = {
		handleTriggerGenerate: () => state.centerWorkspaceContext.handleTriggerGenerate(),
		confirmGenerate: (override?: boolean) => state.dialogContext.confirmGenerate(override),
	};
	return createElement('div', null,
		createElement(TimetableGrid, gridProps({ entries: center.gridEntries }) as never),
		createElement(GenerateConfirmDialog, {
			open: !!dialog.showGenerateConfirm,
			onOpenChange: (open: boolean) => dialog.setShowGenerateConfirm?.(open),
			isPublished: false,
			schoolYearLabel: '2030-2031',
			termSource: 'atlas',
			lockedClassCount: dialog.draftBoardSummary?.lockedForRun ?? null,
			classesToSchedule: dialog.draftBoardSummary?.unscheduled ?? null,
			enforceShiftWindows: !!dialog.enforceShiftWindows,
			setEnforceShiftWindows: dialog.setEnforceShiftWindows ?? (() => {}),
			followUpCount: 0,
			onConfirm: () => {},
		} as never),
	);
}

test('A8-4 RENDERED (real production call site): handleTriggerGenerate → confirmGenerate re-reads the active scope and the grid shows the new draft', async () => {
	await withMockedApi(async (calls, posts) => {
		timetableQueryClient.clear();
		resetTimetableWarmScope();
		dom.window.sessionStorage.setItem('atlas_local_token', ACTOR_TOKEN);

		try {
			await mount(createElement(MemoryRouter, { initialEntries: ['/timetable'] }, createElement(A8ProductionHost)));

			// The real host settles: the OLD run + OLD draft are on screen and the
			// canonical generation diagnostic is ready.
			await waitFor(
				() => hostState?.draft?.runId === RUN_OLD && hostState?.headerContext?.curriculumReadiness?.state === 'ready',
				'the OLD draft and a ready generation diagnostic',
			);
			assert.ok(container().querySelector('[data-timetable-entry-id="e-old"]'), 'the OLD draft entry is rendered before the run');
			assert.equal(container().querySelector('[data-timetable-entry-id="e-new"]'), null, 'the NEW draft entry is not present yet');
			assert.equal(document.body.querySelector('[data-testid="timetable-generate-confirm-dialog"]'), null, 'the confirm dialog is closed on arrival');

			// Press Generate — the REAL handler opens the confirm dialog.
			act(() => { hostActions!.handleTriggerGenerate(); });
			await flush();
			assert.equal(hostState.dialogContext.showGenerateConfirm, true, 'handleTriggerGenerate opened the confirm dialog');
			assert.ok(document.body.querySelector('[data-testid="timetable-generate-confirm-dialog"]'), 'the confirm dialog is rendered open');

			// Confirm — the REAL confirmGenerate runs the REAL triggerGeneration,
			// which POSTs the completed run and then re-reads the active scope.
			act(() => { hostActions!.confirmGenerate(true); });
			await waitFor(() => hostState?.draft?.runId === RUN_NEW, 'the NEW run draft after the production re-read');
			// Let the generation promise settle (`setGenerating(false)` clears the
			// production elapsed-time interval before the host unmounts).
			await waitFor(() => hostState?.generating === false, 'generation to settle');

			assert.equal(posts.length, 1, 'exactly one generation POST was issued');
			assert.equal(hostState.dialogContext.showGenerateConfirm, false, 'confirmGenerate closed the dialog');
			assert.equal(document.body.querySelector('[data-testid="timetable-generate-confirm-dialog"]'), null, 'the confirm dialog is closed after completion');
			// Same query-client session — never cleared — and the real grid shows
			// the NEW draft while the OLD one is gone.
			assert.ok(container().querySelector('[data-timetable-entry-id="e-new"]'), 'the NEW draft entry is rendered after completion');
			assert.equal(container().querySelector('[data-timetable-entry-id="e-old"]'), null, 'the OLD draft entry is gone from the grid');
			assert.ok(calls.some((url) => url.includes('/runs/latest/draft')), 'the latest run bundle was re-read over the wire');
		} finally {
			await act(async () => { root?.unmount(); root = null; });
			hostState = null;
			hostActions = null;
			await flush(2);
		}
	});
});
