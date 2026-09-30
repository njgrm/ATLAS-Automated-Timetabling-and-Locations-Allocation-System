/**
 * A2 move-swap c2, Item 2 — the operator's swap must complete in ≤ 2 s.
 *
 * ── THE RECORDED DEFECT ──────────────────────────────────────────────────────
 *
 * On live (train 19, Run 355, GR7 – Luna), MATH Mon 07:30 -> Swap -> FIL Mon 06:00
 * returned `ATLAS could not check this swap in time. Nothing changed.` The slow
 * request was the separate `/swap/preview`, whose `findAutoFixTarget` re-validates
 * the whole run once per candidate slot in two pools (see the block comment at
 * `commitRegularSwapNow`). The commit `/swap` validates only 2-3 times.
 *
 * ── WHAT THIS FILE DECIDES ───────────────────────────────────────────────────
 *
 * L1 LATENCY   — with the preview that timed out on live mocked to NEVER resolve,
 *                the operator's legal swap still LANDS inside 2 s with the ONE
 *                receipt and the committed edit id the workspace registers Undo
 *                from, and NO preview is dispatched. Fails on base d707051e: base
 *                gates the commit on that preview, so the 8 s bound fires first.
 * L2 BACKSTOP  — a COMMIT that never resolves is still bounded to plain words, so
 *                the bound remains a backstop rather than the thing live data hits.
 *
 * Run: `npm run test:ux-a2-move-swap-c2` (wired in atlas-client/package.json).
 */
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element, Node: dom.window.Node, Text: dom.window.Text,
	Event: dom.window.Event, CustomEvent: dom.window.CustomEvent, MouseEvent: dom.window.MouseEvent,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

type Posted = { url: string; body: any };
let posted: Posted[] = [];
let previewNeverResolves = false;
let commitNeverResolves = false;

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		post: async (url: string, body: any) => {
			posted.push({ url, body });
			if (url.includes('/swap/preview')) {
				if (previewNeverResolves) return new Promise(() => {});
				return { data: { direct: null, autoFixBlockingPreview: null, autoFixBlockingTarget: null, autoFixSourcePreview: null, autoFixSourceTarget: null, recommendedStrategy: 'DIRECT_SWAP' } };
			}
			if (url.endsWith('/swap')) {
				if (commitNeverResolves) return new Promise(() => {});
				return { data: commitResponse };
			}
			return { data: {} };
		},
		get: async (url: string) => {
			if (url.includes('/violations')) return { data: { violations: [], counts: { runWide: null } } };
			if (url.includes('/manual-edits')) return { data: { edits: [] } };
			return { data: {} };
		},
		delete: async () => ({ data: {} }),
	},
});

const { createElement, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { useTimetableMutations } = await import('@/hooks/useTimetableMutations');
const { SWAP_COMMIT_BOUND_MS } = await import('@/components/timetable/timetableSwapArming');

const noop = () => {};
const noopRef = { current: null } as { current: null };
const map = () => new Map();

const ENTRY_A = {
	entryId: 'e-a', sectionId: 71, subjectId: 11, facultyId: 21, roomId: 31,
	day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1,
};
const ENTRY_B = {
	entryId: 'e-b', sectionId: 71, subjectId: 12, facultyId: 22, roomId: 32,
	day: 'MONDAY', startTime: '06:45', endTime: '07:30', durationMinutes: 45, termIndex: 1,
};

const commitResponse = {
	editId: 55, newVersion: 4,
	draft: { runId: 7, version: 4, entries: [ENTRY_A, ENTRY_B], unassignedItems: [], summary: { isPublished: false } },
	violationDelta: { hardBefore: 0, hardAfter: 0, softBefore: 0, softAfter: 0 },
	warnings: [],
};

function mutationInput(overrides: Record<string, unknown> = {}) {
	return {
		actorRole: 'REGISTRAR', schoolYearId: 9,
		schoolYearContext: { schoolId: 1, activeSchoolYearLabel: 'SY 2026-2027', activeTerm: { termIndex: 1 } },
		roomRequestSummary: null, requestStatusFilter: 'ALL', requestDecisionFilter: 'ALL', requestSearch: '',
		setViewMode: noop, setEntityFilter: noop,
		draft: { runId: 7, version: 3, entries: [ENTRY_A, ENTRY_B], unassignedItems: [], summary: { isPublished: false } },
		setSelectedEntry: noop,
		rightPanelRef: noopRef, isDesktop: true, openRoomGridWorkspace: noop,
		setSelectedRequestId: noop, setRequestPreviewLoading: noop, setRequestPreview: noop,
		setRequestReviewerNotes: noop, setAppealsLoading: noop, setRequestAppeals: noop,
		loadRoomRequestSummary: async () => {}, requestPreview: null, appealReason: '', setAppealSubmitting: noop,
		setAppealReason: noop, setRequestReviewSaving: noop, requestReviewerNotes: '',
		setKbSelectedSource: noop, setPreGenKbSource: noop, setSelectedViolation: noop, setFollowUps: noop,
		setGenerating: noop, setShowGenerateConfirm: noop, enforceShiftWindows: true, setEnforceShiftWindows: noop,
		draftBoardSummary: null, fetchDraftBoardSummary: async () => null, loadAll: async () => {},
		setNewDraftLoading: noop, setDraftBoard: noop, setDraftBoardSummary: noop, setLeftTab: noop,
		setCenterView: noop, setPreGenOnboarding: noop, setPreGenPending: noop, setPreGenPreview: noop,
		setPreGenPreviewLoading: noop, setPreGenPreviewError: noop, setPreGenAllowSoftOverride: noop,
		setInlineActionStatus: (status: unknown) => { statuses.push(status as never); },
		preGenPending: null, preGenAllowSoftOverride: false, setPreGenSaving: noop,
		draftBoard: null, violations: [], setShowPublishDialog: noop, publishAcknowledged: false,
		setPublishAcknowledged: noop, setSwapAction: noop, setShowSwapConfirm: noop, setSwapSaving: noop,
		swapAction: null, setRegularSwapSaving: noop, setRegularSwapPending: noop, regularSwapPending: null,
		setDeletingPlacementId: noop, setBlockerModalData: noop, setShowPreGenConfirm: noop,
		preGenConfirmCtx: null, setPreGenConfirmCtx: noop, confirmFacultyId: '', setConfirmFacultyId: noop,
		confirmRoomId: '', setConfirmRoomId: noop, setConfirmPreviewLoading: noop, setConfirmPreview: noop,
		setConfirmRawPreview: noop, setConfirmPreviewError: noop, setConfirmAllowSoftOverride: noop,
		setConfirmAllowDailyOverride: noop, setConfirmSaving: noop, autoPreviewRef: noopRef,
		setEditHistory: noop, editHistory: [], setDraft: noop, setPreviewLoading: noop, setPreviewResult: noop,
		setCommitLoading: noop, setSoftConfirmWarnings: noop, setShowSoftConfirm: noop,
		setPendingCommitProposal: noop, setDragItem: noop, setRevertLoading: noop, setViolationReport: noop,
		violationReport: null, viewMode: 'section', entityFilter: 'all',
		facultyMap: map(), roomMap: map(), sectionMap: new Map([[71, { id: 71, name: '7-Rizal' }]]),
		setPendingFacultyIssuePivot: noop,
		...overrides,
	} as unknown as Parameters<typeof useTimetableMutations>[0];
}

let statuses: Array<{ tone: string; message: string }> = [];
let api: ReturnType<typeof useTimetableMutations> | null = null;
let currentInput = mutationInput();
function Probe() {
	api = useTimetableMutations(currentInput);
	return null;
}

async function mountInput(input: ReturnType<typeof mutationInput>): Promise<void> {
	currentInput = input;
	api = null;
	posted = [];
	statuses = [];
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	await act(async () => { createRoot(host).render(createElement(Probe)); });
}

const previewCalls = () => posted.filter((call) => call.url.includes('/swap/preview'));
const swapCalls = () => posted.filter((call) => call.url.endsWith('/swap'));
const lastStatus = () => statuses[statuses.length - 1];

test('L1 LATENCY: the operator\'s swap lands in <=2s even when the preview that timed out on live never resolves', async () => {
	previewNeverResolves = true; // the live-shaped slow check
	commitNeverResolves = false;
	await mountInput(mutationInput());

	mock.timers.enable({ apis: ['setTimeout'] });
	try {
		let pending: Promise<any> | null = null;
		await act(async () => { pending = api!.commitRegularSwapNow(ENTRY_A as never, ENTRY_B as never); });
		// ONLY 2 s pass — the 8 s preview bound the operator used to hit has NOT elapsed.
		mock.timers.tick(2000);
		let outcome: any = null;
		await act(async () => { outcome = await Promise.race([pending, Promise.resolve('STILL_PENDING')]); });

		assert.notEqual(outcome, 'STILL_PENDING', 'the swap is NOT gated on the slow preview');
		assert.equal(outcome.ok, true, 'the operator\'s swap landed');
		assert.equal(previewCalls().length, 0, 'no separate preview is dispatched on the one-action path');
		assert.equal(swapCalls().length, 1, 'exactly one commit carries the whole action');
		assert.equal(swapCalls()[0].body.strategy, 'DIRECT_SWAP', 'the server validates the direct swap');
		assert.equal(outcome.result.editId, 55, 'the Undo identity comes from the committed response');
		assert.match(lastStatus()?.message ?? '', /^Swapped 7-Rizal from Mon 6:00 to Mon 6:45\./, 'the ONE receipt is on screen');
		assert.equal(api!.regularSwapPreview?.loading, false, 'no spinner is left standing');
	} finally {
		mock.timers.reset();
	}
});

test('L2 BACKSTOP: a COMMIT that never resolves is still bounded to plain words', async () => {
	previewNeverResolves = false;
	commitNeverResolves = true;
	await mountInput(mutationInput());

	mock.timers.enable({ apis: ['setTimeout'] });
	try {
		let pending: Promise<any> | null = null;
		await act(async () => { pending = api!.commitRegularSwapNow(ENTRY_A as never, ENTRY_B as never); });
		mock.timers.tick(SWAP_COMMIT_BOUND_MS + 50);
		let outcome: any = null;
		await act(async () => { outcome = await pending; });

		assert.equal(outcome.ok, false, 'the bound resolves the surface to a decided state');
		assert.match(lastStatus()?.message ?? '', /could not save this swap in time/i, 'plain words name what happened');
		assert.equal(api!.regularSwapPreview?.loading, false, 'no spinner is left standing');
	} finally {
		mock.timers.reset();
	}
});
