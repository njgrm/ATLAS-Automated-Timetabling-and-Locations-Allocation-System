/**
 * A2 move-swap, Item 2 — "Swap with another class" swaps on the operator's
 * SECOND pick, in ONE action, with the ONE receipt and a contextual Undo, and
 * it NEVER HANGS.
 *
 * ── THE RECORDED DEFECT ──────────────────────────────────────────────────────
 *
 * "Swap with another class shows *Review swap before saving* and then sticks on
 * *Checking swap options.* with the *Swap sessions* button disabled." Codex's
 * walk, 30 Sep 05:50 +08, Term 1, GR7 – Luna.
 *
 * ── WHY THIS IS A REAL MOUNT AND NOT A SOURCE-TEXT ROW ───────────────────────
 *
 * The hang is a CLIENT absence-of-bound: `openRegularSwapPrompt` set
 * `regularSwapPreview.loading = true` and cleared it only when the request
 * settled, so a request that never settles left a spinner and a disabled
 * control forever. A source-text assertion would pass on a surface that still
 * hangs. So this file mounts the REAL `useTimetableMutations` hook with the
 * transport mocked at the module boundary and drives the production
 * `commitRegularSwapNow` the operator's second pick now calls:
 *
 *   S1 ONE ACTION — a legal DIRECT_SWAP pair issues exactly one preview POST and
 *                   exactly one commit POST, with no dialog commit step between.
 *   S2 RECEIPT    — the committed swap writes the ONE receipt sentence, from
 *                   `buildEditReceipt`, to the inline status.
 *   S3 NO HANG    — a preview that never resolves is bounded: within
 *                   SWAP_COMMIT_BOUND_MS the surface resolves to a decided
 *                   { ok:false } with plain words, and `loading` is false. It is
 *                   NOT left on a spinner.
 *   S4 NO HANG (commit) — a commit that never resolves is bounded the same way.
 *   S5 BLOCKED    — a BLOCKED preview refuses with plain words and dispatches
 *                   ZERO commits.
 *
 * Run: `npm run test:ux-a2-move-swap` (wired in atlas-client/package.json in the
 * same commit).
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

// ─── transport mock: records the real URLs the one-action swap dispatches ────
type Posted = { url: string; body: any };
let posted: Posted[] = [];
let previewResponse: any;
let previewNeverResolves = false;
let commitResponse: any;
let commitNeverResolves = false;
/** F2 — the post-commit violations/edit-history reads never settle. */
let getNeverResolves = false;

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		post: async (url: string, body: any) => {
			posted.push({ url, body });
			if (url.includes('/swap/preview')) {
				if (previewNeverResolves) return new Promise(() => {});
				return { data: previewResponse };
			}
			if (url.endsWith('/swap')) {
				if (commitNeverResolves) return new Promise(() => {});
				return { data: commitResponse };
			}
			return { data: {} };
		},
		get: async (url: string) => {
			if (getNeverResolves && (url.includes('/violations') || url.includes('/manual-edits'))) {
				return new Promise(() => {});
			}
			if (url.includes('/violations')) return { data: { violations: [], counts: { runWide: null } } };
			if (url.includes('/manual-edits')) return { data: { edits: [] } };
			return { data: {} };
		},
		delete: async () => ({ data: {} }),
	},
});

const { createElement } = await import('react');
const { act } = await import('react');
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

function directPreview(overrides: Record<string, unknown> = {}) {
	return {
		allowed: true, hardViolations: [], softViolations: [], humanConflicts: [],
		violationDelta: { hardBefore: 0, hardAfter: 0, softBefore: 0, softAfter: 0 },
		...overrides,
	};
}

function seedDirectSwap() {
	previewNeverResolves = false;
	commitNeverResolves = false;
	getNeverResolves = false;
	previewResponse = {
		direct: directPreview(),
		autoFixBlockingPreview: null, autoFixBlockingTarget: null,
		autoFixSourcePreview: null, autoFixSourceTarget: null,
		recommendedStrategy: 'DIRECT_SWAP',
	};
	commitResponse = {
		editId: 55, newVersion: 4,
		draft: { runId: 7, version: 4, entries: [ENTRY_A, ENTRY_B], unassignedItems: [], summary: { isPublished: false } },
		violationDelta: { hardBefore: 0, hardAfter: 0, softBefore: 0, softAfter: 0 },
		warnings: [],
	};
}

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
/**
 * F2 — the swap review dialog opens on `Boolean(regularSwapPending)` in the
 * state hook, which the mutations hook drives through this injected setter. The
 * recorder is therefore the dialog's open state; a non-null value here IS a
 * dialog the operator would see.
 */
let swapPendingCalls: Array<{ entryA: unknown; entryB: unknown } | null> = [];
function recordSetRegularSwapPending(value: unknown) {
	swapPendingCalls.push(typeof value === 'function' ? (value as (p: null) => never)(null) : (value as never));
}
function dialogWasOpened(): boolean {
	return swapPendingCalls.some((value) => value != null);
}
let api: ReturnType<typeof useTimetableMutations> | null = null;
function Probe() {
	api = useTimetableMutations(currentInput);
	return null;
}
let currentInput = mutationInput();

async function mountInput(input: ReturnType<typeof mutationInput>): Promise<void> {
	currentInput = input;
	api = null;
	posted = [];
	statuses = [];
	swapPendingCalls = [];
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	await act(async () => { createRoot(host).render(createElement(Probe)); });
}

const previewCalls = () => posted.filter((call) => call.url.includes('/swap/preview'));
const swapCalls = () => posted.filter((call) => call.url.endsWith('/swap'));
const lastStatus = () => statuses[statuses.length - 1];

test('S1 ONE ACTION: a legal pair dispatches exactly one preview and one commit, with no dialog step', async () => {
	seedDirectSwap();
	await mountInput(mutationInput());
	let outcome: any = null;
	await act(async () => { outcome = await api!.commitRegularSwapNow(ENTRY_A as never, ENTRY_B as never); });

	assert.equal(previewCalls().length, 1, 'exactly one swap preview round-trip gates the commit');
	assert.equal(swapCalls().length, 1, 'exactly one swap commit — no second step stands between the pick and the save');
	assert.equal(outcome.ok, true, 'the second pick performed the commit');
	assert.equal(outcome.result.editId, 55, 'and it returns the edit id the workspace registers for Undo');
	assert.equal(swapCalls()[0].body.strategy, 'DIRECT_SWAP');
	assert.equal(swapCalls()[0].body.expectedVersion, 3, 'the commit carries the run version CAS');
});

test('S2 RECEIPT: the committed swap writes the ONE receipt sentence to the inline status', async () => {
	seedDirectSwap();
	await mountInput(mutationInput());
	await act(async () => { await api!.commitRegularSwapNow(ENTRY_A as never, ENTRY_B as never); });

	const status = lastStatus();
	assert.ok(status, 'the commit speaks');
	assert.match(status.message, /^Swapped 7-Rizal from Mon 6:00 to Mon 6:45\./, 'the receipt names the class and both slots, from buildEditReceipt');
	assert.match(status.message, /No new problems\./, 'and the honest problem clause');
});

test('S3 NEVER HANGS (preview): a preview that never resolves is bounded to plain words, not a spinner', async () => {
	seedDirectSwap();
	previewNeverResolves = true;
	await mountInput(mutationInput());

	mock.timers.enable({ apis: ['setTimeout'] });
	try {
		let pending: Promise<any> | null = null;
		await act(async () => { pending = api!.commitRegularSwapNow(ENTRY_A as never, ENTRY_B as never); });
		mock.timers.tick(SWAP_COMMIT_BOUND_MS + 50);
		let outcome: any = null;
		await act(async () => { outcome = await pending; });

		assert.equal(outcome.ok, false, 'the bound resolves the surface to a DECIDED state');
		assert.notEqual(lastStatus()?.message, 'Checking swap options.', 'never left on the pre-fix spinner sentence');
		assert.match(lastStatus()?.message ?? '', /could not check this swap in time/i, 'plain words name what happened');
		assert.equal(api!.regularSwapPreview?.loading, false, 'no spinner is left standing');
		assert.equal(swapCalls().length, 0, 'nothing was committed on the timeout');
	} finally {
		mock.timers.reset();
	}
});

test('S4 NEVER HANGS (commit): a commit that never resolves is bounded to plain words', async () => {
	seedDirectSwap();
	commitNeverResolves = true;
	await mountInput(mutationInput());

	mock.timers.enable({ apis: ['setTimeout'] });
	try {
		let pending: Promise<any> | null = null;
		await act(async () => { pending = api!.commitRegularSwapNow(ENTRY_A as never, ENTRY_B as never); });
		mock.timers.tick(SWAP_COMMIT_BOUND_MS + 50);
		let outcome: any = null;
		await act(async () => { outcome = await pending; });

		assert.equal(outcome.ok, false, 'the commit bound resolves to a decided state');
		assert.match(lastStatus()?.message ?? '', /could not save this swap in time/i);
		assert.equal(api!.regularSwapPreview?.loading, false, 'the spinner is cleared');
	} finally {
		mock.timers.reset();
	}
});

test('S5 BLOCKED: a blocked preview refuses in plain words and dispatches ZERO commits', async () => {
	seedDirectSwap();
	previewResponse = { ...previewResponse, recommendedStrategy: 'BLOCKED', autoFixBlockingPreview: null, autoFixSourcePreview: null };
	await mountInput(mutationInput());
	let outcome: any = null;
	await act(async () => { outcome = await api!.commitRegularSwapNow(ENTRY_A as never, ENTRY_B as never); });

	assert.equal(outcome.ok, false, 'a blocked pair is refused');
	assert.equal(swapCalls().length, 0, 'no commit is dispatched');
	assert.match(String(outcome.message), /cannot trade times safely/i, 'and the refusal is plain words, not a code');
});

/* ── F2 CORRECTION (2026-09-30) ────────────────────────────────────────────────
 *
 * The swap review dialog opens on `Boolean(regularSwapPending)`
 * (`TimetablePlacementDialogs.tsx:692`), so `regularSwapPending` IS the dialog
 * state. S3/S4 could not see the defect because they only asserted the preview
 * spinner; these two rows assert the dialog state itself and the non-gating
 * refresh, which is what F2 was about.
 */

test('S6 F2 NO DIALOG + NON-GATING REFRESH: a successful one-action swap leaves no dialog standing, and a hung post-commit read cannot hold it open', { timeout: 8000 }, async () => {
	seedDirectSwap();
	// The violations + edit-history reads never settle. The resolved operator state
	// (receipt + Undo from the COMMITTED response) must NOT wait on them.
	getNeverResolves = true;
	await mountInput(mutationInput({ setRegularSwapPending: recordSetRegularSwapPending }));

	let outcome: any = null;
	await act(async () => { outcome = await api!.commitRegularSwapNow(ENTRY_A as never, ENTRY_B as never); });

	assert.equal(outcome.ok, true, 'the swap resolved from the commit response even while the refresh hung');
	assert.equal(outcome.result.editId, 55, 'the Undo identity comes from the commit, not the refresh');
	// THE DIALOG. `Boolean(regularSwapPending)` is the dialog’s open condition, so a
	// non-null setter call here is a dialog the operator would see.
	assert.equal(dialogWasOpened(), false, 'the one-action path never opened the swap review dialog');
	assert.equal(api!.regularSwapPreview?.loading, false, 'and no spinner is left standing');
	assert.match(lastStatus()?.message ?? '', /^Swapped 7-Rizal/, 'the receipt is on screen');
});

test('S7 F2 NO DIALOG ON ERROR: a commit timeout leaves no dialog open and no disabled control — the operator retries in plain words', async () => {
	seedDirectSwap();
	commitNeverResolves = true;
	await mountInput(mutationInput({ setRegularSwapPending: recordSetRegularSwapPending }));

	mock.timers.enable({ apis: ['setTimeout'] });
	try {
		let pending: Promise<any> | null = null;
		await act(async () => { pending = api!.commitRegularSwapNow(ENTRY_A as never, ENTRY_B as never); });
		mock.timers.tick(SWAP_COMMIT_BOUND_MS + 50);
		let outcome: any = null;
		await act(async () => { outcome = await pending; });

		assert.equal(outcome.ok, false, 'the commit bound resolved to a decided state');
		assert.equal(dialogWasOpened(), false, 'the swap review dialog is NOT left standing after a commit timeout');
		assert.equal(api!.regularSwapPreview?.loading, false, 'and the commit control is not left pending');
		assert.match(lastStatus()?.message ?? '', /could not save this swap in time/i, 'the operator is told, in plain words, to try again');
	} finally {
		mock.timers.reset();
	}
});
