/**
 * A8-C5 S2.3 / S2.4 — the operator-visible half, RENDERED.
 *
 * The capability model (`test:a8-c5-generate-gate`, 600 inputs) proved that no
 * state greys out Generate. That is a MODEL row, and the packet is explicit that
 * "a source-text read is not visible proof": the operator half of the contract is
 * what a scheduler sees after the click. This file is that control.
 *
 * WHAT WAS ACTUALLY BROKEN. The gate had already been made enabled in every
 * state, and the click still dead-ended: `handleTriggerGenerate` in
 * `useScheduleReviewWorkspaceState` read
 * `if (readiness.state !== 'ready') { toast.error(...); return; }`. So a blocked
 * year produced a TOAST and no dialog at all. The operator was told a button was
 * clickable, clicked it, and was told nothing, with no way forward.
 *
 * WHAT IS PROVED HERE, in the order the operator described it:
 *
 *   D1  clicking Generate from a BLOCKED state opens the Generate dialog, and
 *       every named cause is on screen carrying the count the server measured;
 *   D2  each cause's fix button carries the S2.1 TABLE's route and label — the
 *       server's own `group.action` and the table disagreeing is decided in the
 *       table's favour, and the fixture spans several routes so this cannot pass
 *       vacuously;
 *   D3  there is EXACTLY ONE "Check again", and clicking it really re-runs the
 *       check (not merely one control that happens to exist);
 *   D4  the lines are plain — no engine code, no id, no ellipsis — and the
 *       blocker count is stated ONCE, because the two summary stoppers that
 *       restate it are subtracted when the panel is on screen;
 *   D5  a year with stoppers but NO diagnostic behind them (the school scope
 *       never loaded) is still explained, and still has one "Check again";
 *   D6  the 14px floor on every control this change puts on screen;
 *   D7  S2.4 — publication names the placeholder-owned and the open classes in
 *       the SAME words and with the SAME routes as the generation panel, and
 *       refuses on neither, because neither blocks.
 *
 * THE PATH IS THE REAL ONE. The real `TimetableSimpleHeader` (the control a
 * scheduler clicks), the real `resolveGenerateTrigger` (the one decision the
 * click makes), the real `TimetableWorkflowDialogs` and the real
 * `SimpleGenerationBlockerGroups`. What stands in is the workspace's own
 * plumbing and nothing else: the provider state, and the toast channel that used
 * to be the dead end. Rows D5 and D7 say so where it matters.
 *
 * Run: `npm run test:a8-c5-generate-dialog` (also named in `test:client-suite`).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, createElement, useState, type ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { TimetableGenerationStopper } from '../../../lib/timetable-capabilities';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable/setup' });
function matchMediaStub(query: string) {
	const min = /min-width:\s*(\d+)px/.exec(query);
	const max = /max-width:\s*(\d+)px/.exec(query);
	const matches = min ? 1366 >= Number(min[1]) : max ? 1366 <= Number(max[1]) : false;
	return { matches, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };
}
(dom.window as unknown as { matchMedia: typeof matchMediaStub }).matchMedia = matchMediaStub;
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	DocumentFragment: dom.window.DocumentFragment,
	Text: dom.window.Text,
	SVGElement: dom.window.SVGElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
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
	matchMedia: matchMediaStub,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { deriveGenerationReadinessState, representativeBlockerCode } = await import('../../../lib/timetable-generation-readiness');
const { BLOCKER_CODE_COPY, blockerSentence } = await import('../../../lib/timetable-blocker-code-copy');
const { resolveGenerateTrigger } = await import('../../../lib/timetable-capabilities');
const { composePublishRefusalCauses, TimetableWorkflowDialogs } = await import('../modals/TimetableWorkflowDialogs');
const { TimetableSimpleHeader } = await import('../TimetableSimpleHeader');
const { buttonVariants } = await import('@/ui/button');

let root: Root | null = null;
const container = () => document.getElementById('root')!;

async function mount(element: ReactElement) {
	if (root) await act(async () => { root?.unmount(); });
	root = createRoot(container());
	await act(async () => { root?.render(element); });
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	dom.window.close();
});

/* ------------------------------------------------------------------ *
 * The BLOCKED payload: four real root causes across three fix routes,
 * counted in classes — the shape the server sends.
 * ------------------------------------------------------------------ */
function blockedDiagnostic() {
	return {
		scope: { schoolId: 1, schoolYearId: 9 },
		status: 'BLOCKED',
		generateAllowed: false,
		schedulerExecuted: true,
		derivedDemandRevision: 'REV',
		termStructure: { format: 'TRIMESTER', terms: [{ identity: 'T1', order: 1 }, { identity: 'T2', order: 2 }] },
		totals: { lines: 40, pairs: 12, sessionsByTerm: { T1: 20, T2: 20 } },
		teachingLoadCoverage: { requiredPairs: 264, ownedPairs: 214, missingPairs: 50, inactiveOrStalePairs: 0, outsideScopePairs: 0 },
		blockerCount: 4,
		gapCount: 620,
		gapClassCount: 50,
		groups: [
			{ cause: 'TEACHER_COVERAGE_GAP', code: 'TL_DEMAND_UNCOVERED', codes: ['TL_DEMAND_UNCOVERED', 'TL_NO_QUALIFIED_OWNER'], count: 50, sessionCount: 620, unit: 'classes', examples: ['MAPEH 7-A', 'ENG 7-B'], action: { label: 'Assign teachers', target: '/teaching-load' } },
			{ cause: 'ROOMS_MISSING', code: 'ROOMS_MISSING', codes: ['ROOMS_MISSING'], count: 3, sessionCount: 3, unit: 'class groups', examples: ['SCI 7-C'], action: { label: 'Add teaching rooms', target: '/campus-rooms' } },
			{ cause: 'GRADE_WINDOW_MISSING', code: 'GRADE_WINDOW_MISSING', codes: ['GRADE_WINDOW_MISSING'], count: 7, sessionCount: 7, unit: 'class groups', examples: ['FIL 7-D'], action: { label: 'Open the time windows', target: '/admin/year-setup' } },
			{ cause: 'TERM_AUTHORITY_UNRESOLVED', code: 'TERM_AUTHORITY_UNRESOLVED', codes: ['TERM_AUTHORITY_UNRESOLVED'], count: 1, sessionCount: 1, unit: 'class groups', examples: ['PE 7-E'], action: { label: 'Set the school year terms', target: '/admin/year-setup' } },
		],
		blockers: [
			{ code: 'TL_DEMAND_UNCOVERED', category: 'DATA_GAP', termIdentity: 'T1', sectionId: 700, subjectId: 31, subjectCode: 'MAPEH', entity: 'Section 700', reason: 'r', owningSurface: 'Teaching Load', nextAction: 'n' },
			{ code: 'ROOMS_MISSING', category: 'DATA_GAP', termIdentity: 'T1', sectionId: 701, subjectId: 32, subjectCode: 'SCI', entity: 'Section 701', reason: 'r', owningSurface: 'Rooms', nextAction: 'n' },
			{ code: 'GRADE_WINDOW_MISSING', category: 'POLICY_BLOCKER', termIdentity: 'T1', sectionId: 702, subjectId: 33, subjectCode: 'FIL', entity: 'Section 702', reason: 'r', owningSurface: 'Year Setup', nextAction: 'n' },
			{ code: 'TERM_AUTHORITY_UNRESOLVED', category: 'DATA_GAP', termIdentity: null, sectionId: 703, subjectId: 34, subjectCode: 'PE', entity: 'Section 703', reason: 'r', owningSurface: 'Year Setup', nextAction: 'n' },
		],
	};
}

function blockedReadiness() {
	const state = deriveGenerationReadinessState(blockedDiagnostic(), { schoolId: 1, schoolYearId: 9 });
	assert.equal(state.state, 'blocked', 'the fixture must be a blocked year');
	return state as Extract<typeof state, { state: 'blocked' }>;
}

/**
 * The whole workspace as ONE tree: the real Simple header above the real dialogs,
 * joined by the ONE decision the click makes.
 *
 * The stand-in is the workspace's plumbing and nothing else. `handleTriggerGenerate`
 * below is three lines: hand the click site's own stoppers to the real
 * `resolveGenerateTrigger`, record what it decided, open the dialog if it says
 * so. That IS what the hook does; the hook's provider tree is not what this row
 * is about.
 */
function Workspace(props: {
	readiness: Record<string, unknown>;
	publishUnassignedCount?: number;
	placeholderOwnedCount?: number | null;
	onCheckAgain?: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [stoppers, setStoppers] = useState<TimetableGenerationStopper[]>([]);
	const state = (props.readiness.state ?? 'ready') as 'loading' | 'ready' | 'blocked' | 'unavailable' | 'failed';
	const handleTriggerGenerate = (clickSite: TimetableGenerationStopper[] = []) => {
		const outcome = resolveGenerateTrigger({ readinessState: state, clickSiteStoppers: clickSite, fallbackStoppers: [] });
		setStoppers(outcome.stoppers);
		if (outcome.opensDialog) setOpen(true);
	};
	const dialogContext = {
		showUnassignConfirm: false, setShowUnassignConfirm: () => {}, setPendingUnassignId: () => {}, pendingUnassignId: null,
		unassignDraftPlacement: async () => {},
		showGenerateConfirm: open, setShowGenerateConfirm: setOpen,
		generationStoppers: stoppers,
		generationReadinessDiagnostic: (props.readiness.diagnostic ?? null) as never,
		onCheckScheduleAgain: props.onCheckAgain ?? (() => {}),
		enforceShiftWindows: true, setEnforceShiftWindows: () => {},
		draftBoardSummary: null, followUps: new Set<string>(), confirmGenerate: () => {},
		showResetDraftDialog: false, setShowResetDraftDialog: () => {}, openPreGenerationWorkspace: async () => {},
		showLeavePreGenDialog: false, setShowLeavePreGenDialog: () => {}, pendingCenterSwitch: null, setPendingCenterSwitch: () => {},
		requestPreview: null, requestPreviewLoading: false, setRequestPreview: () => {}, setSelectedRequestId: () => {},
		setRequestAppeals: () => {}, setAppealReason: () => {},
		requestPreviewHardConflicts: [], requestPreviewSoftWarnings: [], requestAppeals: [], appealsLoading: false,
		isPrivilegedUser: false, updateAppealStatus: async () => {}, appealReason: '', appealSubmitting: false,
		submitAppeal: async () => {}, requestReviewerNotes: '', setRequestReviewerNotes: () => {}, requestReviewSaving: false,
		reviewRoomRequest: async () => {}, generating: false, generationElapsed: 0,
		showPublishDialog: true, setShowPublishDialog: () => {}, publishAcknowledged: false, setPublishAcknowledged: () => {},
		softCount: 0, publishUnassignedCount: props.publishUnassignedCount ?? 0,
		publishPlaceholderOwnedCount: props.placeholderOwnedCount ?? null,
		policy: null, handlePublishConfirm: () => {},
		approvalSchoolId: null, approvalSchoolYearId: null, approvalActorId: null,
	} as never;
	const headerContext = {
		isPreGenerationWorkspace: false, activeGeneratedRunId: null, leftTab: 'violations',
		leftPanelRef: { current: null }, presentationMode: 'workflow', setPresentationMode: () => {},
		viewMode: 'section', setViewMode: () => {}, entityFilter: '701', setEntityFilter: () => {},
		focusSection: () => {}, sectionFocusId: null, programFilter: 'all',
		entryKindFilter: 'all', violations: [], hardCount: 0, blockingHardCount: 0, softCount: 0,
		selectedRunId: 'latest', handleRunChange: () => {}, runs: [],
		schoolYearContext: { activeSchoolYearLabel: '2030-2031', source: 'enrollpro-verified', activeTerm: null },
		schoolId: 1, curriculumReadiness: props.readiness, centerView: 'schedule', newDraftLoading: false, schoolYearId: 9,
		handleStartNewPreGenerationDraft: async () => {}, draftPlacementCount: 0,
		openPreGenerationWorkspace: async () => {}, returnToGeneratedRun: () => {},
		generating: false, loading: false, handleTriggerGenerate, draft: null,
		setPublishAcknowledged: () => {}, setShowPublishDialog: () => {}, exitPolicyView: () => {},
		switchCenterViewWithGuard: (action: () => void) => action(), enterPolicyView: () => {},
		openMapWorkspace: async () => {}, handleRefresh: () => {}, refreshReferenceLabels: () => {},
		referenceLookupStatus: { state: 'ready', label: 'References ready' },
		revertLoading: false, editHistoryCount: 0, revertLastEdit: async () => {}, setShowEditHistory: () => {},
		tutorial: { start: () => {} },
		sectionLabel: (id: number) => `GR7 - Section ${id}`, subjectLabel: (id: number) => `Subject ${id}`,
		facultyLabel: (id: number) => `Teacher ${id}`, setUnassignedReasonFilter: () => {},
		summary: { assignedCount: 0, classesProcessed: 0, hardViolationCount: 0, unassignedCount: 0 },
		requestPendingCount: 0, statusColor: () => '', formatDuration: () => '', formatTimestamp: () => '',
		groupedPivotEntities: [{ label: 'Grade 7', ids: [701] }], pivotLabel: (id: number) => `GR7 - Section ${id}`,
		setSelectedEntry: () => {}, hasSelectedEntry: false, setSelectedViolation: () => {},
		enterManualEditView: () => {}, setPreGenKbSource: () => {}, setKbSource: () => {},
		severityFilter: 'all', setSeverityFilter: () => {}, setLeftTab: () => {},
		VIEW_MODE_LABELS: { section: 'Section', faculty: 'Teacher', room: 'Room' },
		PROGRAM_FILTER_OPTIONS: [], ENTRY_KIND_FILTER_OPTIONS: [],
		WELLBEING_CODES: new Set<string>(), CONFLICT_CODES: new Set<string>(),
		policy: { teacherMoveEnabled: true }, policyAlignmentWarning: null, showFullDay: false, setShowFullDay: () => {},
		hiddenRowCount: 0, termFilter: 2, onTermFilterChange: () => {},
		termOptions: [{ value: '1', label: 'TERM 1' }, { value: '2', label: 'TERM 2' }],
		activeTermIndex: 2,
	} as never;
	return createElement(
		MemoryRouter,
		null,
		createElement('div', null,
			createElement(TimetableSimpleHeader as unknown as (p: Record<string, unknown>) => ReactElement, {
				context: headerContext, layoutMode: 'simple', onLayoutModeChange: () => {}, activeTask: null, onTaskChange: () => {},
			}),
			createElement(TimetableWorkflowDialogs, { context: dialogContext }),
		),
	);
}

async function clickGenerate() {
	const button = document.querySelector<HTMLButtonElement>('[data-testid="timetable-simple-generate-action"]');
	assert.ok(button, 'the Simple header renders its Generate control');
	assert.equal(button!.disabled, false,
		'A8-C5 S2.3: the control an operator clicks is NEVER disabled except while a run is in progress');
	await act(async () => { button!.click(); });
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

const all = (testid: string) => Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`));
const dialogOpen = () => all('timetable-generate-confirm-dialog').length > 0;
const dialogText = () => all('timetable-generate-confirm-dialog')[0]?.textContent ?? '';
const panelLines = () => all('timetable-generation-blocker-group-headline').map((node) => node.textContent?.trim() ?? '');
const stopperLines = () => all('timetable-generate-stopper-cause').map((node) => node.textContent?.trim() ?? '');

/* ────────────────────────────────────────────────────────────────────────────
 * D0 — the click DECISION, stated as a table so it cannot drift quietly.
 * ──────────────────────────────────────────────────────────────────────────── */
test('D0 the click always reaches the dialog; only a ready year may start a run', () => {
	// This is the row that fails on the pre-fix behaviour, where the hook read
	// `if (readiness.state !== 'ready') { toast.error(...); return; }`: a blocked
	// year produced a toast and no dialog, and nothing about that was testable
	// because the decision lived inside a 2,400-line provider hook.
	for (const readinessState of ['loading', 'blocked', 'unavailable', 'failed'] as const) {
		const outcome = resolveGenerateTrigger({
			readinessState,
			clickSiteStoppers: [],
			fallbackStoppers: [{
				key: 'setup-blocked', line: 'x', shortReason: 'y', count: 3, href: '/admin/year-setup',
				actionLabel: 'Open Year Setup', checkFailed: false, retryLabel: null, repair: { kind: 'none', label: null, href: null },
			}],
		});
		assert.equal(outcome.opensDialog, true, `a "${readinessState}" year opens the dialog that explains it`);
		assert.equal(outcome.mayGenerate, false, `a "${readinessState}" year never starts a run`);
		assert.equal(outcome.stoppers.length, 1, 'and it always has something to say');
	}
	// The ONLY state that starts a run is a ready year — and it clears the list, so
	// a cause captured during an earlier blocked visit cannot linger in a dialog
	// that no longer has anything to explain.
	const ready = resolveGenerateTrigger({
		readinessState: 'ready',
		clickSiteStoppers: [{ key: 'setup-drift', line: 'x', shortReason: 'y', count: null, href: '/admin/year-setup', actionLabel: 'Open Year Setup', checkFailed: false, retryLabel: null, repair: { kind: 'none', label: null, href: null } }],
		fallbackStoppers: [],
	});
	assert.deepEqual(ready, { stoppers: [], opensDialog: false, mayGenerate: true });

	// THE CLICK SITE WINS, and it is the one that can see drift: the workspace's
	// own fallback is a strict subset, never a second, different list.
	const wired = resolveGenerateTrigger({
		readinessState: 'blocked',
		clickSiteStoppers: [{ key: 'setup-drift', line: 'drift', shortReason: 'drift', count: null, href: '/admin/year-setup', actionLabel: 'Open Year Setup', checkFailed: false, retryLabel: null, repair: { kind: 'none', label: null, href: null } }],
		fallbackStoppers: [{ key: 'setup-blocked', line: 'blocked', shortReason: 'blocked', count: 4, href: '/admin/year-setup', actionLabel: 'Open Year Setup', checkFailed: false, retryLabel: null, repair: { kind: 'none', label: null, href: null } }],
	});
	assert.deepEqual(wired.stoppers.map((stopper) => stopper.key), ['setup-drift'],
		'the array the clicked control derived is the one the dialog reads');
	// ...and an EMPTY click-site array falls back rather than opening an empty dialog.
	const fellBack = resolveGenerateTrigger({
		readinessState: 'blocked', clickSiteStoppers: [],
		fallbackStoppers: [{ key: 'setup-blocked', line: 'blocked', shortReason: 'blocked', count: 4, href: '/admin/year-setup', actionLabel: 'Open Year Setup', checkFailed: false, retryLabel: null, repair: { kind: 'none', label: null, href: null } }],
	});
	assert.deepEqual(fellBack.stoppers.map((stopper) => stopper.key), ['setup-blocked'],
		'a caller that passed no stoppers still gets the causes this workspace owns — never an empty dialog');
});

/* ────────────────────────────────────────────────────────────────────────────
 * D1 + D2 + D3 + D4 — the click, the causes, the routes, the ONE recheck.
 * ──────────────────────────────────────────────────────────────────────────── */
test('D1/D2/D3/D4 clicking Generate from a blocked state opens a dialog that names every cause, routes it, and offers ONE "Check again"', async () => {
	const readiness = blockedReadiness();
	let rechecks = 0;
	await mount(createElement(Workspace, { readiness, onCheckAgain: () => { rechecks += 1; } }));
	assert.equal(dialogOpen(), false, 'before the click there is no dialog to explain anything');
	await clickGenerate();

	// D1 — THE DIALOG OPENED. This is the row that fails on the pre-fix code,
	// where the click produced a toast and no dialog at all.
	assert.equal(dialogOpen(), true,
		'clicking Generate from a blocked state opens the dialog, not a toast and not nothing');

	// D1 — EVERY NAMED CAUSE IS VISIBLE WITH ITS COUNT. The expected text is the
	// S2.1 table's own composed sentence for each code (`blockerSentence`), so
	// these strings are the table's, not this row's.
	assert.deepEqual(panelLines(), [
		blockerSentence('TL_DEMAND_UNCOVERED', 50),
		blockerSentence('ROOMS_MISSING', 3),
		blockerSentence('GRADE_WINDOW_MISSING', 7),
		blockerSentence('TERM_AUTHORITY_UNRESOLVED', 1),
	], 'one line per root cause, each carrying the class count the server measured');
	for (const line of panelLines()) {
		assert.doesNotMatch(line, /[A-Z][A-Z0-9_]{4,}/, `no engine code on screen: ${line}`);
		assert.doesNotMatch(line, /…|\.\.\./, `no truncation on screen: ${line}`);
		assert.doesNotMatch(line, /\b#\d+\b/, `no id on screen: ${line}`);
	}

	// D2 — EACH FIX BUTTON CARRIES THE ROUTE FROM THE TABLE.
	const expected = readiness.diagnostic.groups.map((group) => {
		const code = representativeBlockerCode(group);
		assert.ok(code, `${group.cause} must resolve a code the shared table knows (A7)`);
		return BLOCKER_CODE_COPY[code!];
	});
	const distinctRoutes = new Set(expected.map((row) => row.route)).size;
	assert.ok(distinctRoutes >= 3,
		`THE CONTROL IS NOT VACUOUS: the fixture spans ${distinctRoutes} fix routes, or an href assertion over it proves nothing`);
	const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-testid="timetable-generation-blocker-group-action"]'));
	assert.equal(anchors.length, readiness.diagnostic.groups.length, 'ONE fix button per cause');
	anchors.forEach((anchor, index) => {
		assert.equal(anchor.getAttribute('href'), expected[index].route,
			`cause ${index}'s button must open the S2.1 route, not the server's own action`);
		assert.equal((anchor.textContent ?? '').trim(), expected[index].buttonLabel,
			`cause ${index}'s button must carry the S2.1 label`);
	});

	// D3 — EXACTLY ONE "Check again", and it is not a decoration.
	const checks = all('timetable-generate-check-again');
	assert.equal(checks.length, 1, 'exactly ONE "Check again" for the whole dialog');
	assert.equal(all('timetable-generation-blocker-check-again').length, 0,
		'the reused panel does not bring a SECOND copy of the same control into the dialog');
	assert.match(checks[0].textContent ?? '', /Check again/);
	await act(async () => { checks[0].click(); });
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	assert.equal(rechecks, 1, 'and it really re-runs the schedule check');

	// D4 — SUBTRACTION: `setup-blocked` and `readiness-unverified` both restate the
	// panel's own blocker count, so they are dropped when the panel is on screen.
	// No CAUSE is lost: the panel's per-cause lines are on screen instead.
	assert.deepEqual(stopperLines(), [], 'no summary stopper restates the number the panel already shows');
	const fours = (dialogText().match(/\b4\b/g) ?? []).length;
	assert.ok(fours <= 2, `the blocker count is not printed in two shapes (${fours} occurrences of "4")`);

	// Nothing was deleted to achieve it: the complete row list is still reachable
	// behind the panel's own disclosure, in the dialog too.
	const trigger = all('timetable-generation-blocker-detail-trigger')[0];
	assert.ok(trigger, 'the full row list is behind a disclosure control in the dialog too');
	assert.match(trigger!.textContent ?? '', /Show all 4 setup items/);
});

/* ────────────────────────────────────────────────────────────────────────────
 * D5 — the no-dead-end row: stoppers with NO diagnostic behind them.
 * ──────────────────────────────────────────────────────────────────────────── */
test('D5 a year whose school scope never loaded still gets a plain explanation, a fix route and ONE "Check again"', async () => {
	// No diagnostic at all. This is the state in which a dialog that rendered only
	// the blocker panel would be EMPTY — the dead end this packet exists to remove,
	// and the one the operator named as "no sections, no time periods, no subjects,
	// school year out of sync".
	await mount(createElement(Workspace, {
		readiness: { state: 'unavailable', message: 'Your school and school year scope could not be verified.' },
	}));
	await clickGenerate();
	assert.equal(dialogOpen(), true, 'a check that could not run still opens the dialog');
	assert.deepEqual(panelLines(), [], 'there is no diagnostic, so there are no panel lines');
	const lines = stopperLines();
	assert.ok(lines.length > 0, 'but the dialog still says why, in words');
	for (const line of lines) {
		// `ATLAS` is the product's own name and is 5 capitals, so the engine-token
		// shape alone would flag it. It is the one allowlisted word.
		assert.doesNotMatch(line.replace(/\bATLAS\b/g, 'Atlas'), /[A-Z][A-Z0-9_]{4,}/, `no engine code on screen: ${line}`);
		assert.doesNotMatch(line, /…|\.\.\./, `no truncation on screen: ${line}`);
	}
	// The cause that could not RUN is stated in plain words, as addendum 20:05
	// item 4 requires ("retries by itself once, then says so plainly with a Retry
	// button"). The single recheck control below IS that button, so the dialog has
	// one control for the action rather than one per line.
	assert.match(lines.join(' '), /could not read this school year/i,
		'the cause that a check could not run is stated in plain words');
	assert.equal(all('timetable-generate-check-again').length, 1, 'and there is still exactly ONE recheck control');
	assert.equal(all('timetable-generate-stopper-action').length, lines.length, 'ONE fix button per cause');
	assert.ok(
		all('timetable-generate-stopper-action').every((anchor) => (anchor.getAttribute('href') ?? '').startsWith('/')),
		'every fix button opens a real mounted route, never a dead control',
	);
	// HONESTY: a cause with no measurement prints NO number at all. An invented
	// count is the "651 setup items" defect this lane exists to remove.
	assert.deepEqual(
		all('timetable-generate-stopper-cause').map((node) => node.getAttribute('data-cause-count')),
		lines.map(() => 'none'),
		'an unmeasured cause states no number',
	);
});

/* ────────────────────────────────────────────────────────────────────────────
 * D6 — the 14px floor on every control this change puts on screen.
 * ──────────────────────────────────────────────────────────────────────────── */
const { compile, optimize } = await import('@tailwindcss/node');
const { readFileSync } = await import('node:fs');
const { resolve: resolvePath } = await import('node:path');

const FONT_CLASS = /^text-(xs|sm|base|lg|xl|2xl)$/;
const FONT_ARBITRARY = /^text-\[([\d.]+)(rem|px)\]$/;

/**
 * The theme's font sizes, resolved over REAL COMPILED output.
 *
 * This cannot ask jsdom: Tailwind emits `.text-xs{font-size:var(--text-xs)}` and
 * jsdom does not substitute custom properties in computed styles, so a number
 * read from there would be reporting a limitation as a measurement. The same
 * chain `a7-c8-type-scale.test.ts` A7C8-4 established is used instead: compile
 * the theme, read `--text-*` out of the emitted root block, rem -> px at the 16px
 * initial root font size.
 */
async function compiledFontSizes(): Promise<Record<string, number>> {
	const clientRoot = resolvePath(process.cwd());
	const themeCss = readFileSync(resolvePath(clientRoot, 'src/index.css'), 'utf8');
	const compiled = await compile(themeCss, { base: clientRoot, onDependency: () => {} });
	const css = optimize(compiled.build(['text-xs', 'text-sm', 'text-base', 'p-4']), { minify: true }).code;
	const sizes: Record<string, number> = {};
	for (const name of ['xs', 'sm', 'base', 'lg', 'xl']) {
		const value = new RegExp(`--text-${name}:([^;}]+)`).exec(css)?.[1]?.trim();
		if (value && /rem$/.test(value)) sizes[name] = Number.parseFloat(value) * 16;
	}
	return sizes;
}

/**
 * The EFFECTIVE font size of a rendered element, read off its class list.
 *
 * `cn` is tailwind-merge, so the LAST font-size utility in the list is the one
 * that applies. That is exactly the link a class-presence assertion cannot
 * check: the shared `@/ui` Button's `sm` size carries `text-[0.8rem]` (12.8px)
 * and each control below overrides it locally with `text-xs` (14px). Deleting
 * that local class would leave the control at 12.8px — silently under the floor,
 * with every other test still green — which is what this measures.
 */
function effectiveFontSizePx(element: Element, sizes: Record<string, number>): number | null {
	let size: number | null = null;
	for (const token of (element.getAttribute('class') ?? '').split(/\s+/)) {
		const named = FONT_CLASS.exec(token);
		if (named && sizes[named[1]] !== undefined) { size = sizes[named[1]]; continue; }
		const arbitrary = FONT_ARBITRARY.exec(token);
		if (arbitrary) size = arbitrary[2] === 'px' ? Number.parseFloat(arbitrary[1]) : Number.parseFloat(arbitrary[1]) * 16;
	}
	return size;
}

test('D6 nothing this packet puts on screen renders under the 14px floor ux-audit.js enforces', async () => {
	const sizes = await compiledFontSizes();
	// THE PREMISE, MEASURED. A8-C5 item 3 was raised on the claim that `text-xs`
	// "renders at 12px" on this panel. It does not: the theme sets
	// `--text-xs: 0.875rem`, which is 14px — exactly the floor, not under it. So
	// the class is correct as written and changing it to `text-sm` would make this
	// panel the only 15px control on the page. What the row enforces instead is
	// the FLOOR, which is the rule that was actually asked for.
	assert.equal(sizes.xs, 14, '`text-xs` compiles to 14px in a real Tailwind build, so it is AT the floor, not below it');
	assert.ok(sizes.sm >= 14);

	// DISCRIMINATION, part one: the shared primitive's own `sm` size is BELOW the
	// floor. Without this, the row below could be satisfied by a page that simply
	// has no local overrides, and the measurement would prove nothing.
	const sharedSm = buttonVariants({ variant: 'outline', size: 'sm' });
	assert.match(sharedSm, /text-\[0\.8rem\]/,
		'the shared `sm` button is 12.8px, so the local `text-xs` on these controls is what holds them at the floor');
	assert.equal(effectiveFontSizePx({ getAttribute: () => `text-[0.8rem]` } as unknown as Element, sizes), 12.8);

	await mount(createElement(Workspace, { readiness: blockedReadiness() }));
	await clickGenerate();

	const controls = [
		...Array.from(document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-group-action"]')),
		...Array.from(document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-group-headline"]')),
		...Array.from(document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-group-detail"]')),
		...Array.from(document.querySelectorAll<HTMLElement>('[data-testid="timetable-generate-check-again"]')),
		...Array.from(document.querySelectorAll<HTMLElement>('[data-testid="timetable-generate-stopper-action"]')),
		...Array.from(document.querySelectorAll<HTMLElement>('[data-testid="timetable-generate-stopper-line"]')),
	];
	assert.ok(controls.length >= 8, `the fixture must exercise the whole list (${controls.length} controls)`);
	for (const control of controls) {
		const px = effectiveFontSizePx(control, sizes);
		assert.ok(px !== null, `every control carries a resolvable font-size utility: ${control.getAttribute('class')}`);
		assert.ok(px! >= 14, `nothing this packet touches renders under 14px (${px}px): ${control.textContent?.trim().slice(0, 40)}`);
	}
});

/* ────────────────────────────────────────────────────────────────────────────
 * D7 — S2.4: publication names the same classes in the same words.
 * ──────────────────────────────────────────────────────────────────────────── */
test('D7 S2.4 the publish refusal names the placeholder-owned and the open classes in the SAME words and routes as the generation panel, and refuses on neither', async () => {
	// BOTH POPULATIONS, in the shared table's own words.
	const both = composePublishRefusalCauses(12, 4);
	assert.equal(both.length, 2, 'both populations are named');
	assert.equal(both[0].line, blockerSentence('TL_DEMAND_UNCOVERED', 12));
	assert.equal(both[1].line, blockerSentence('SYNTHETIC_PLACEHOLDER_OWNED', 4),
		'the THIRD state uses the identical sentence the generation panel renders for it (C3.7)');
	// DISCRIMINATION: the third state's line is not a copy of the no-teacher line,
	// or "it is named" would also be true of duplicated copy.
	assert.notEqual(both[0].line, both[1].line, 'the to-be-hired line must not reuse the no-teacher wording');
	for (const cause of both) {
		const code = cause.key === 'placeholder-owned' ? 'SYNTHETIC_PLACEHOLDER_OWNED' : 'TL_DEMAND_UNCOVERED';
		assert.equal(cause.href, BLOCKER_CODE_COPY[code].route, `${cause.key} opens the S2.1 route`);
		assert.equal(cause.actionLabel, BLOCKER_CODE_COPY[code].buttonLabel, `${cause.key} carries the S2.1 label`);
	}
	// HONESTY: an unmeasured placeholder count produces NO line. Never a zero.
	assert.deepEqual(composePublishRefusalCauses(0, null), [], 'nothing measured, nothing printed');
	assert.deepEqual(composePublishRefusalCauses(0, 0), [], 'a measured zero is still nothing to name');
	assert.deepEqual(composePublishRefusalCauses(3, null).map((cause) => cause.line), [blockerSentence('TL_DEMAND_UNCOVERED', 3)]);

	// RENDERED. The publish refusal is on screen with both classes named, and
	// Publish is NOT disabled by a state that blocks neither.
	await mount(createElement(Workspace, { readiness: blockedReadiness(), publishUnassignedCount: 0, placeholderOwnedCount: 4 }));
	const rendered = all('timetable-publish-class-refusal-cause');
	assert.equal(rendered.length, 1, 'only the measured population is printed — the unplaced count is 0 here');
	assert.match(rendered[0].textContent ?? '', /^4 classes are on a to-be-hired teacher/,
		'the publish refusal names the third state in the same words as the generation panel');
	const publishButton = all('timetable-publish-class-refusal')
		.flatMap((node) => Array.from(node.querySelectorAll<HTMLAnchorElement>('[data-testid="timetable-publish-class-refusal-action"]')));
	assert.equal(publishButton.length, 1, 'ONE fix button for the named class');
	assert.equal(publishButton[0].getAttribute('href'), BLOCKER_CODE_COPY.SYNTHETIC_PLACEHOLDER_OWNED.route,
		'and it opens the S2.1 route for that state');
	// S1.2: a placeholder-owned class blocks NEITHER generation nor publication, so
	// the Publish control must remain pressable. The refusal NAMES; it does not bar.
	const publish = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
		.find((button) => (button.textContent ?? '').trim() === 'Publish');
	assert.ok(publish, 'the publish dialog still offers its own control');
	assert.equal(publish!.disabled, false,
		'a to-be-hired owner names a class, it does not refuse publication (S1.2)');
});
