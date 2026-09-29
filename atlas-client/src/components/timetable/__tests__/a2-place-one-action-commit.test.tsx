/**
 * A2 place-one-action — ONE ACTION: a clean or soft-warned draft drop COMMITS in
 * `stagePreGenDrop` with no Confirm click, returns the operation identity the
 * workspace registers as the contextual Undo, and carries the selected term.
 *
 * This mounts the REAL `useTimetableMutations` hook (not a source-text row) with
 * the transport mocked at the module boundary, so the commit is triggered by the
 * production drop path itself:
 *
 *   S1 CLEAN   — exactly one commit POST, no Confirm dialog opened, and the result
 *                carries the operation identity plus `termIndex` from the drop.
 *   S2 SOFT    — a soft-warned preview commits too (soft is not a confirm gate).
 *   S3 BLOCKED — a hard-conflict preview opens the review dialog and commits ZERO.
 *   S4 NO-OWNER— a queue item with no Teaching-Load owner never even previews and
 *                commits ZERO (fail-closed before the network).
 *
 * Run: node --experimental-test-module-mocks --import tsx --test <this file>
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

// ─── transport mock: records the real URLs the drop path dispatches ───────────
type Posted = { url: string; body: any };
let posted: Posted[] = [];
let previewResponse: any;
let commitResponse: any;

function previewResult(overrides: Record<string, unknown> = {}) {
	return {
		allowed: true, hardViolations: [], softViolations: [] as unknown[],
		violationDelta: { hardBefore: 0, hardAfter: 0, softBefore: 0, softAfter: 0 },
		humanConflicts: [], affectedEntries: [], policyImpactSummary: [],
		dailyLoadBand: 'ok', dailyMinutesAfter: 0, facultyWeeklyMinutes: {},
		...overrides,
	};
}

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		post: async (url: string, body: any) => {
			posted.push({ url, body });
			if (url.includes('/pre-generation-drafts/preview')) return { data: previewResponse };
			if (url.includes('/pre-generation-drafts/commit')) return { data: commitResponse };
			return { data: {} };
		},
		get: async () => ({ data: {} }),
	},
});

const { createElement } = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { useTimetableMutations } = await import('@/hooks/useTimetableMutations');

const noop = () => {};
const noopRef = { current: null } as { current: null };
const map = () => new Map();

function mutationInput(overrides: Record<string, unknown> = {}) {
	return {
		actorRole: 'REGISTRAR', schoolYearId: 9,
		schoolYearContext: { schoolId: 1, activeSchoolYearLabel: 'SY 2026-2027', activeTerm: { termIndex: 1 } },
		roomRequestSummary: null, requestStatusFilter: 'ALL', requestDecisionFilter: 'ALL', requestSearch: '',
		setViewMode: noop, setEntityFilter: noop, draft: null, setSelectedEntry: noop,
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
		setInlineActionStatus: noop, preGenPending: null, preGenAllowSoftOverride: false, setPreGenSaving: noop,
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
		facultyMap: map(), roomMap: map(), sectionMap: map(), setPendingFacultyIssuePivot: noop,
		...overrides,
	} as unknown as Parameters<typeof useTimetableMutations>[0];
}

let api: ReturnType<typeof useTimetableMutations> | null = null;
function Probe() {
	api = useTimetableMutations(currentInput);
	return null;
}
let currentInput = mutationInput();
let dialogOpens = 0;

function freshInput(overrides: Record<string, unknown> = {}) {
	return mutationInput({ setShowPreGenConfirm: () => { dialogOpens += 1; }, ...overrides });
}

async function mountInput(input: ReturnType<typeof mutationInput>): Promise<void> {
	currentInput = input;
	api = null;
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	await act(async () => { createRoot(host).render(createElement(Probe)); });
}

const QUEUE_ITEM = {
	assignmentKey: '71:11', entryKind: 'SECTION', sectionId: 71, sectionName: '7-A', gradeLevel: 7,
	subjectId: 11, subjectCode: 'TLE', subjectName: 'TLE', sessionNumber: 1, sessionsPerWeek: 1,
	preferredRoomType: 'CLASSROOM', cohortCode: null, cohortName: null, programCode: null, programName: null,
	expectedEnrollment: 40, facultyOptions: [21], facultyOptionsEnriched: [], hasNoTeacher: false,
};
const ROOM = { id: 31, name: 'Room 101', buildingId: 1, buildingName: 'Main', buildingShortCode: 'MN', floor: 1, type: 'CLASSROOM', isTeachingSpace: true };
const commitCalls = () => posted.filter((call) => call.url.includes('/pre-generation-drafts/commit'));
const previewCalls = () => posted.filter((call) => call.url.includes('/pre-generation-drafts/preview'));

async function runDrop(input: ReturnType<typeof mutationInput>, source: any) {
	posted = [];
	dialogOpens = 0;
	await mountInput(input);
	// Typed loosely on purpose: `stagePreGenDrop`'s return is asserted through the
	// hook instance at runtime, and a structural annotation here would only
	// restate the production type without testing it.
	let outcome: any = null;
	await act(async () => {
		outcome = await api!.stagePreGenDrop(source, 'MONDAY', '06:00', '06:45', { termIndex: 2 });
	});
	return outcome;
}

function seedResponses(preview: any) {
	previewResponse = preview;
	commitResponse = {
		placement: { id: 900, termIndex: 2 },
		preview,
		board: { placements: [], queue: [], periodSlots: [], classPeriodSlots: [], counts: { draft: 1, lockedForRun: 0, archived: 0, unscheduled: 0 }, filters: { grades: [], departments: [], buildings: [] } },
		operationId: 77,
		resultingVersion: 77,
	};
}

test('S1 CLEAN: a clean drop commits in one call, no Confirm dialog, and carries the term', async () => {
	seedResponses(previewResult());
	const input = freshInput({ roomMap: new Map([[ROOM.id, ROOM]]) });
	const outcome = await runDrop(input, { type: 'draftQueue', item: QUEUE_ITEM } as never);

	assert.equal(commitCalls().length, 1, 'a clean drop dispatches exactly one commit — no Confirm click');
	assert.equal(dialogOpens, 0, 'no review/confirm dialog is opened for an ordinary placement');
	assert.ok(outcome, 'the drop returns the operation identity the workspace registers as Undo');
	assert.equal(outcome!.result.operationId, 77, 'the Undo target is the commit operation');
	assert.equal(outcome!.result.resultingVersion, 77, 'and it pins the resulting version');
	assert.equal(outcome!.pending.termIndex, 2, 'the placement carries the term the operator placed into');
	assert.equal(commitCalls()[0].body.termIndex, 2, 'and the commit body carries termIndex 2, never the schema default');
	assert.equal(previewCalls().length, 1, 'exactly one authoritative preview gates the commit');
});

test('S2 SOFT: a soft-warned drop also commits in one call (soft is not a confirm gate)', async () => {
	// The violation must be scoped to the target slot, or `scopePreviewToCandidate`
	// filters it out and the test would not actually exercise a soft drop.
	const softEntities = { day: 'MONDAY', startTime: '06:00', endTime: '06:45' };
	seedResponses(previewResult({ softViolations: [{ code: 'X', severity: 'SOFT', entities: softEntities }], humanConflicts: [{ code: 'X', severity: 'SOFT', humanTitle: 't', humanDetail: 'd' }] }));
	const input = freshInput({ roomMap: new Map([[ROOM.id, ROOM]]) });
	const outcome = await runDrop(input, { type: 'draftQueue', item: QUEUE_ITEM } as never);

	assert.equal(commitCalls().length, 1, 'a soft-warned drop still commits without a Confirm step');
	assert.equal(dialogOpens, 0, 'soft warnings do not open the review dialog');
	assert.ok(outcome, 'the soft commit returns its operation identity for Undo');
});

test('S3 BLOCKED: a hard-conflict preview opens the review dialog and commits ZERO', async () => {
	// The violation must be scoped to the target slot, or `scopePreviewToCandidate`
	// filters it out and the "blocked" drop would look clean and commit.
	const hardEntities = { day: 'MONDAY', startTime: '06:00', endTime: '06:45' };
	seedResponses(previewResult({ allowed: false, hardViolations: [{ code: 'FACULTY_TIME_CONFLICT', severity: 'HARD', entities: hardEntities }], humanConflicts: [{ code: 'FACULTY_TIME_CONFLICT', severity: 'HARD', humanTitle: 't', humanDetail: 'd' }] }));
	const input = freshInput({ roomMap: new Map([[ROOM.id, ROOM]]) });
	const outcome = await runDrop(input, { type: 'draftQueue', item: QUEUE_ITEM } as never);

	assert.equal(commitCalls().length, 0, 'a blocked drop must NOT auto-commit');
	assert.ok(dialogOpens >= 1, 'it keeps the single fail-closed review dialog');
	assert.equal(outcome, null, 'and returns no Undo identity, because nothing committed');
});

test('S4 NO-OWNER: a queue item with no Teaching-Load owner never previews and commits ZERO', async () => {
	seedResponses(previewResult());
	const input = freshInput({ roomMap: new Map([[ROOM.id, ROOM]]) });
	const outcome = await runDrop(input, { type: 'draftQueue', item: { ...QUEUE_ITEM, facultyOptions: [], hasNoTeacher: true } } as never);

	assert.equal(commitCalls().length, 0, 'a no-owner drop must NOT auto-commit');
	assert.equal(previewCalls().length, 0, 'the missing prerequisite fails closed before any preview round-trip');
	assert.ok(dialogOpens >= 1, 'the review dialog owns the recovery, never an inline Confirm');
	assert.equal(outcome, null, 'nothing committed, so there is no Undo identity');
});
