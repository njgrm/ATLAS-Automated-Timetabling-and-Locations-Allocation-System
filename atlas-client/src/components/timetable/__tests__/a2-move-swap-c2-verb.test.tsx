/**
 * A2 move-swap c2, Item 1 — the receipt's verb comes from the COMMITTED record.
 *
 * ── THE RECORDED DEFECT ──────────────────────────────────────────────────────
 *
 * A move committed, but the receipt read `Swapped Luna from Mon 6:00 to Tue 6:00`:
 * the wrong verb, and a sentence that names one class under a verb that means two.
 * `timetable-edit-receipt.ts` already maps `MOVE_ENTRY -> 'Moved'` and
 * `SWAP_ENTRIES -> 'Swapped'`; `composeSwapReceipt` passed `SWAP_ENTRIES` always.
 *
 * ── WHAT THIS FILE DECIDES ───────────────────────────────────────────────────
 *
 * V1 MOVE      — a committed result where exactly ONE class relocated says `Moved`
 *                (never `Swapped`). Fails on base d707051e: base always says Swapped.
 * V2 EXCHANGE  — a committed result where BOTH classes traded says `Swapped` AND
 *                names both classes. Fails on base d707051e: base names one class.
 *
 * Run: `npm run test:ux-a2-move-swap-c2`.
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

let commitResponse: any = null;

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		post: async (url: string) => {
			if (url.endsWith('/swap')) return { data: commitResponse };
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

const noop = () => {};
const noopRef = { current: null } as { current: null };
const map = () => new Map();

const ENTRY_A = {
	entryId: 'e-a', sectionId: 71, subjectId: 11, facultyId: 21, roomId: 31,
	day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1,
};
const ENTRY_B = {
	entryId: 'e-b', sectionId: 72, subjectId: 12, facultyId: 22, roomId: 32,
	day: 'MONDAY', startTime: '06:45', endTime: '07:30', durationMinutes: 45, termIndex: 1,
};

function commitFor(entries: unknown[]) {
	return {
		editId: 55, newVersion: 4,
		draft: { runId: 7, version: 4, entries, unassignedItems: [], summary: { isPublished: false } },
		violationDelta: { hardBefore: 0, hardAfter: 0, softBefore: 0, softAfter: 0 },
		warnings: [],
	};
}

function mutationInput() {
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
		facultyMap: map(), roomMap: map(),
		sectionMap: new Map([[71, { id: 71, name: '7-Rizal' }], [72, { id: 72, name: '8-Luna' }]]),
		setPendingFacultyIssuePivot: noop,
	} as unknown as Parameters<typeof useTimetableMutations>[0];
}

let statuses: Array<{ tone: string; message: string }> = [];
let api: ReturnType<typeof useTimetableMutations> | null = null;
let currentInput = mutationInput();
function Probe() {
	api = useTimetableMutations(currentInput);
	return null;
}
async function mountInput(): Promise<void> {
	currentInput = mutationInput();
	api = null;
	statuses = [];
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	await act(async () => { createRoot(host).render(createElement(Probe)); });
}
const lastStatus = () => statuses[statuses.length - 1];

test('V1 MOVE: a committed result where only one class relocated says Moved, never Swapped', async () => {
	commitResponse = commitFor([
		{ ...ENTRY_A, day: 'TUESDAY', startTime: '06:00', endTime: '06:45' },
		{ ...ENTRY_B },
	]);
	await mountInput();
	await act(async () => { await api!.commitRegularSwapNow(ENTRY_A as never, ENTRY_B as never); });

	const message = lastStatus()?.message ?? '';
	assert.match(message, /^Moved 7-Rizal from Mon 6:00 to Tue 6:00\./, `the committed move says Moved: ${message}`);
	assert.doesNotMatch(message, /^Swapped/, 'a move is never described as a swap');
});

test('V2 EXCHANGE: a committed trade says Swapped AND names both classes', async () => {
	commitResponse = commitFor([
		{ ...ENTRY_A, day: 'MONDAY', startTime: '06:45', endTime: '07:30' },
		{ ...ENTRY_B, day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
	]);
	await mountInput();
	await act(async () => { await api!.commitRegularSwapNow(ENTRY_A as never, ENTRY_B as never); });

	const message = lastStatus()?.message ?? '';
	assert.match(message, /^Swapped 7-Rizal and 8-Luna from Mon 6:00 to Mon 6:45\./, `the exchange names both classes: ${message}`);
});
