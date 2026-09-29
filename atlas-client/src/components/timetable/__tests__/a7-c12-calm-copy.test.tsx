/**
 * A7 c12b — ONE VOCABULARY: the copy contract for the calm Class Schedule page.
 *
 * ── WHO THIS IS FOR ──────────────────────────────────────────────────────────
 * An older, mouse-first scheduler. Decision 8 (operator) approves the Step 0
 * proposal and fixes the unplaced wording as `N classes need a time slot`. The
 * copy spec is the 27-row table in `docs/handoffs/lane-c-to-a2.md`
 * ("A7 -> Lane C, proposal — Step 0").
 *
 * ── HOW EACH ROW IS DECIDED (and it says which, in its own name) ─────────────
 *   - RENDERED rows render the REAL component and read real output.
 *   - RESOLVER rows read the ONE pure resolver that produces the words a surface
 *     renders (the same resolver the component calls), so a rename in the module
 *     moves the surface and this row together.
 *   - SOURCE rows read a file, and are labelled as SOURCE rows because the
 *     surface is too heavy to mount here (a 300-line dialog or the whole center
 *     workspace). They are weaker evidence and are disclosed as such; the rows
 *     that decide user-visible behaviour are the RENDERED ones.
 *
 * ── THE FIXTURES ARE REAL SURFACES, NOT INVENTED ─────────────────────────────
 * Every fixture is built from the same context shape the workspace builds (see
 * `a2-header-budget-2026-09-29.test.tsx`, whose harness this copies).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	SVGElement: dom.window.SVGElement,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.PointerEvent,
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
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

const fetchStub = () => Promise.resolve({
	ok: true, status: 200,
	json: () => Promise.resolve({ drift: { status: 'aligned', message: null, recommendedAction: null, conflicts: [], unacknowledgedReconfiguredSections: 0 } }),
});
beforeEach(() => { globalThis.fetch = fetchStub as unknown as typeof fetch; });

const { renderToStaticMarkup } = await import('react-dom/server');
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TimetableSimpleHeader } = await import('@/components/timetable/TimetableSimpleHeader');
const { TimetableRunsPane } = await import('@/components/timetable/TimetableRunsPane');
const { SimpleReadinessChip, resolveSimpleReadiness } = await import('@/components/timetable/simple/SimpleSetupSharedControls');
const { deriveSimpleLifecycleAction } = await import('@/lib/simple-timetable-state');
const { runAnchorLabel, runStateSentence, BUILD_NEW_DRAFT_LABEL, buildNewDraftDialogTitle, runStateBadgeLabel, PUBLISHED_SCHEDULE_STAYS_IN_USE } = await import('@/lib/timetable-plain-language');
const { deriveTimetableCapabilities } = await import('@/lib/timetable-capabilities');

const CLIENT_ROOT = resolve(import.meta.dirname, '../../../..');
const source = (relative: string) => readFileSync(resolve(CLIENT_ROOT, relative), 'utf8');

let mountedRoot: { unmount: () => void } | null = null;
let mountedHost: HTMLElement | null = null;
afterEach(() => {
	if (mountedRoot) { act(() => mountedRoot!.unmount()); mountedRoot = null; }
	if (mountedHost) { mountedHost.remove(); mountedHost = null; }
	for (const stray of [...dom.window.document.body.children]) stray.remove();
});

// ═══ FIXTURES ═══════════════════════════════════════════════════════════════

function baseContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	const noop = () => {};
	return {
		isPreGenerationWorkspace: false, leftTab: 'sessions', leftPanelRef: { current: null },
		presentationMode: 'workflow', setPresentationMode: noop, handleRunChange: noop,
		schoolId: 1, schoolYearId: 1, centerView: 'schedule', newDraftLoading: false,
		handleStartNewPreGenerationDraft: noop, openPreGenerationWorkspace: noop, returnToGeneratedRun: noop,
		generating: false, loading: false, handleTriggerGenerate: noop, setPublishAcknowledged: noop,
		setShowPublishDialog: noop, exitPolicyView: noop, switchCenterViewWithGuard: (a: () => void) => a(),
		enterPolicyView: noop, openMapWorkspace: noop, handleRefresh: noop,
		editHistoryReadState: 'ready', setShowEditHistory: noop,
		tutorial: { start: noop, step: 0, totalSteps: 0, seen: true, open: false },
		sectionLabel: (id: number) => `GR7 - ${id}`, subjectLabel: () => 'TLE', facultyLabel: () => 'Cruz, Pedro',
		setUnassignedReasonFilter: noop, requestPendingCount: 0, statusColor: () => 'muted',
		formatDuration: (v: number | null) => `${v}ms`, formatTimestamp: (v: string) => v,
		viewMode: 'section', setViewMode: noop, setEntityFilter: noop, focusSection: noop, sectionFocusId: null,
		setSelectedEntry: noop, setSelectedViolation: noop, setSeverityFilter: noop, enterManualEditView: noop,
		setPreGenKbSource: noop, setKbSelectedSource: noop, entityFilter: 'all',
		groupedPivotEntities: [{ label: 'Grade 7', ids: [41] }],
		VIEW_MODE_LABELS: { section: 'Section', faculty: 'Teacher', room: 'Room' },
		PROGRAM_FILTER_OPTIONS: [], ENTRY_KIND_FILTER_OPTIONS: [],
		WELLBEING_CODES: new Set<string>(), CONFLICT_CODES: new Set<string>(),
		DAYS: ['MONDAY'], DAY_SHORT: { MONDAY: 'Mon' }, pivotLabel: (id: number) => `Entity ${id}`,
		programFilter: 'all', setProgramFilter: noop, entryKindFilter: 'all',
		termFilter: 2, termOptions: [{ value: '1', label: 'TERM 1' }, { value: '2', label: 'TERM 2' }, { value: '3', label: 'TERM 3' }],
		activeTermIndex: 2, onTermFilterChange: noop, draftPlacementCount: 0, hasPublishedReturnState: false,
		severityFilter: 'all',
		draft: null, activeGeneratedRunId: null, selectedRunId: 'latest', runs: [], hasSelectedEntry: false,
		editHistoryCount: 0, blockingHardCount: 0, hardCount: 0, softCount: 0,
		summary: { isPublished: false, unassignedCount: 0, assignedCount: 0, hardViolationCount: 0 },
		schoolYearContext: { activeSchoolYearLabel: '2026-2027', source: 'enrollpro', activeTerm: null },
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
		...overrides,
	};
}

function draftContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return baseContext({
		draft: {
			runId: 321,
			entries: [{ entryId: 'e-tle', sectionId: 41, subjectId: 31, day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
			unassignedItems: [], violations: [],
			summary: { isPublished: false, unassignedCount: 0, assignedCount: 118, hardViolationCount: 0 },
			inputState: null, version: 14, createdAt: '2026-09-28T08:00:00.000Z', finishedAt: '2026-09-28T08:00:00.000Z',
		},
		activeGeneratedRunId: 321, selectedRunId: '321',
		runs: [{ id: 321, createdAt: '2026-09-28T08:00:00.000Z', durationMs: 4200, status: 'COMPLETED' }],
		...overrides,
	});
}

function headerProps(context: Record<string, unknown>) {
	return {
		context, layoutMode: 'simple', onLayoutModeChange: () => {}, activeTask: null, onTaskChange: () => {},
		onSetRepairOrigin: () => {}, readinessSheetOpen: false, onReadinessSheetOpenChange: () => {},
		swapClassTimesMode: null, onSwapClassTimesStart: () => {}, onSwapClassTimesCancel: () => {},
		undoRedoControl: null, onDiscardDraft: () => {},
	};
}

function headerMarkup(context: Record<string, unknown>): string {
	return renderToStaticMarkup(createElement(MemoryRouter as never, { initialEntries: ['/timetable'] },
		createElement(TimetableSimpleHeader as never, headerProps(context) as never)));
}

function tree(markup: string): HTMLElement {
	const host = dom.window.document.createElement('div');
	host.innerHTML = markup;
	return host;
}

async function mountHeader(context: Record<string, unknown>) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	mountedHost = host;
	const root = createRoot(host);
	mountedRoot = root;
	act(() => { root.render(createElement(MemoryRouter as never, { initialEntries: ['/timetable'] }, createElement(TimetableSimpleHeader as never, headerProps(context) as never))); });
	await settle();
	return {
		doc: (id: string) => dom.window.document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null,
		openMenu: async () => {
			const trigger = dom.window.document.querySelector('[data-testid="timetable-simple-more-trigger"]') as HTMLElement | null;
			assert.ok(trigger, 'the More trigger is rendered');
			act(() => { trigger!.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, button: 0 })); });
			await settle();
			return dom.window.document.querySelector('[role="menu"]') as HTMLElement | null;
		},
	};
}
async function settle(): Promise<void> {
	for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

// ═══ ROW 1 — THE TAB READS `Draft`, NEVER `Planning` (RENDERED) ══════════════

test('ROW 1 RENDERED: the draft tab reads `Draft` and never `Planning`', () => {
	const host = tree(headerMarkup(baseContext()));
	const draftTab = host.querySelector('[data-testid="timetable-sub-nav-draft"]');
	assert.ok(draftTab, 'the draft tab is rendered');
	assert.equal((draftTab!.textContent ?? '').trim(), 'Draft', 'the tab reads `Draft`');
	const nav = host.querySelector('[data-testid="timetable-sub-nav"]')!;
	assert.equal((nav.textContent ?? '').includes('Planning'), false, 'and `Planning` never appears on the tab row');
});

// ═══ ROW 6 — THE PUBLISH PRIMARY READS `Publish` (RENDERED) ══════════════════

test('ROW 6 RENDERED: with a draft on screen the one primary publish control reads `Publish`', () => {
	const host = tree(headerMarkup(draftContext()));
	const publish = host.querySelector('[data-testid="timetable-simple-publish-action"]');
	assert.ok(publish, 'the publish primary is rendered');
	assert.equal((publish!.textContent ?? '').trim(), 'Publish', 'its visible label is `Publish`');
	assert.equal((publish!.textContent ?? '').includes('Publish schedule'), false, 'and never `Publish schedule`');
});

// ═══ ROWS 18, 19, 23, 24 — THE `keep` ROWS ARE UNCHANGED (RESOLVER) ═════════

test('ROWS 18/19/23/24 RESOLVER: the `keep` rows still say what the table keeps', () => {
	assert.equal(runStateBadgeLabel({ isPreGeneration: false, hasRun: true, isPublished: false }), 'Draft schedule', 'row 18 keep: draft badge');
	assert.equal(runStateBadgeLabel({ isPreGeneration: false, hasRun: true, isPublished: true }), 'Published schedule', 'row 18 keep: published badge');
	assert.equal(PUBLISHED_SCHEDULE_STAYS_IN_USE, 'Your published schedule stays in use.', 'row 24 keep');
});

// ═══ ROWS 2, 3, 4, 5, 7 — THE LIFECYCLE PRIMARY LABELS (RESOLVER) ══════════

test('ROWS 2/3/4/5/7 RESOLVER: every Generate primary label is `Generate a draft`; Publish/Published and the job-naming labels are kept', () => {
	const noRun = deriveSimpleLifecycleAction({ hasGeneratedRun: false, isPreGeneration: false, scopeResolved: true, curriculumState: 'ready' });
	assert.equal(noRun.label, 'Generate a draft', 'row 3: no-run primary');
	const preGen = deriveSimpleLifecycleAction({ hasGeneratedRun: false, isPreGeneration: true, scopeResolved: true, curriculumState: 'ready' });
	assert.equal(preGen.label, 'Generate a draft', 'row 2: pre-generation primary');
	const failed = deriveSimpleLifecycleAction({ hasGeneratedRun: false, isPreGeneration: false, scopeResolved: true, curriculumState: 'ready', latestRunFailed: true });
	assert.equal(failed.label, 'Generate a draft', 'row 4: failed-run primary');
	const published = deriveSimpleLifecycleAction({ hasGeneratedRun: true, isPublished: true, scopeResolved: true, curriculumState: 'ready' });
	assert.equal(published.label, 'Published', 'row 5 keep: published');
	const publishable = deriveSimpleLifecycleAction({ hasGeneratedRun: true, isPublished: false, scopeResolved: true, curriculumState: 'ready' });
	assert.equal(publishable.label, 'Publish', 'row 6: publishable primary');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true, hardCount: 2, scopeResolved: true, curriculumState: 'ready' }).label, 'Fix blockers', 'row 7 keep');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true, softCount: 2, scopeResolved: true, curriculumState: 'ready' }).label, 'Review warnings', 'row 7 keep');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true, isPublished: true, unassignedCount: 1, scopeResolved: true, curriculumState: 'ready' }).label, 'Review follow-ups', 'row 7 keep');
});

// ═══ ROW 8 — ONE VERB FOR "make a new draft" (RESOLVER) ═════════════════════

test('ROW 8 RESOLVER: `Build a new draft` is gone; the one verb is `Generate a draft`', () => {
	assert.equal(BUILD_NEW_DRAFT_LABEL, 'Generate a draft', 'the single verb');
	assert.equal(buildNewDraftDialogTitle(false), 'Generate a draft', 'the dialog title uses the same verb');
	assert.equal(buildNewDraftDialogTitle(true), 'Generate a draft?', 'and so does the published variant');
});

// ═══ ROW 16 — THE RUN ANCHOR FALLBACK (RESOLVER) ════════════════════════════

test('ROW 16 RESOLVER: the run anchor fallback reads `Draft · run N`', () => {
	assert.equal(runAnchorLabel(318), 'Draft · run 318', 'the plain anchor is the draft');
	assert.equal(runAnchorLabel(318, 'Sep 26, 08:05 PM'), 'Sep 26, 08:05 PM · run 318', 'a real timestamp anchor is unchanged');
});

// ═══ ROW 10 — THE PRE-GENERATION STATE LINE (RESOLVER) ══════════════════════

test('ROW 10 RESOLVER: the pre-generation state sentence is `Draft · nothing placed yet`', () => {
	assert.equal(runStateSentence({ isPreGeneration: true, hasRun: false, runId: null, isPublished: false }), 'Draft · nothing placed yet', 'the pre-generation line says what the surface is');
});

// ═══ ROW 17 — THE RUN-STATE BADGE WORDS (RESOLVER) ══════════════════════════

test('ROW 17 RESOLVER: the run-state badge says `Draft`, never `Generated`', () => {
	const build = (overrides: Record<string, unknown>) => deriveTimetableCapabilities({
		scopeResolved: true, curriculumState: 'ready', generating: false, isPreGeneration: false,
		hasGeneratedRun: true, isPublished: false, latestRunFailed: false, hardCount: 0, unassignedCount: 0,
		softCount: 0, hasSelectedEntry: false, requestPendingCount: 0, ...overrides,
	});
	assert.equal(build({ hardCount: 1 }).lifecycleLabel, 'Draft — issues to review', 'row 17: issues');
	assert.equal(build({}).lifecycleLabel, 'Draft — ready to review', 'row 17: reviewable');
});

// ═══ ROWS 20, 21, 22 — THE DENIAL / NAV LABELS (RESOLVER) ═══════════════════

test('ROWS 20/21/22 RESOLVER: denial and nav labels use `Generate a draft` and the draft/schedule words', () => {
	const caps = deriveTimetableCapabilities({
		scopeResolved: true, curriculumState: 'ready', generating: false, isPreGeneration: false,
		hasGeneratedRun: false, isPublished: false, latestRunFailed: false, hardCount: 0, unassignedCount: 0,
		softCount: 0, hasSelectedEntry: true, requestPendingCount: 0,
	});
	assert.equal(caps.gates.move.repair.label, 'Generate a draft', 'row 20: move nav label');
	assert.equal(caps.gates.swap.repair.label, 'Generate a draft', 'row 20: swap nav label');
	assert.equal(caps.gates.publication.reason, 'No draft yet to publish.', 'row 21: no-run publish denial');
	const publishedCaps = deriveTimetableCapabilities({
		scopeResolved: true, curriculumState: 'ready', generating: false, isPreGeneration: false,
		hasGeneratedRun: true, isPublished: true, latestRunFailed: false, hardCount: 0, unassignedCount: 0,
		softCount: 0, hasSelectedEntry: true, requestPendingCount: 0,
	});
	assert.equal(publishedCaps.gates.publication.reason, 'This schedule is already published.', 'row 22: already-published denial');
});

// ═══ ROW 13 / D3 — THE ACTIVE YEAR, FROM ONE SOURCE (RENDERED) ══════════════

test('ROW 13 / D3 RENDERED: the readiness chip names the ACTIVE year and never a stale one', () => {
	const snapshot = {
		draft: null, blockingHardCount: 0, summary: { isPublished: false, unassignedCount: 0, assignedCount: 0, hardViolationCount: 0 },
		softCount: 0, isPreGenerationWorkspace: false,
		schoolYearContext: { activeSchoolYearLabel: '2026-2027', source: 'enrollpro', activeTerm: null } as never,
		hasGeneratedRun: false, isRunPublished: false,
	};
	const { readiness, publishBlocked, publishBlockedReason } = resolveSimpleReadiness(snapshot as never);
	assert.equal(readiness, 'No draft yet for 2026-2027', 'the chip names the active year in the active-year sentence');
	const host = tree(renderToStaticMarkup(createElement(SimpleReadinessChip as never, {
		readiness, publishBlocked, publishBlockedReason, blockingHardCount: 0, softCount: 0,
	} as never)));
	assert.ok((host.textContent ?? '').includes('No draft yet for 2026-2027'), 'and the rendered chip shows it');
	assert.equal((host.textContent ?? '').includes('No 2025-2026 timetable yet'), false, 'the stale year never renders');
	assert.equal((host.textContent ?? '').includes('timetable yet'), false, 'and the retired wording is gone');
});

test('ROW 13 / D3 RENDERED: the setup pane and the header chip derive the year from the SAME `schoolYearContext.activeSchoolYearLabel`', () => {
	// The one-source property, asserted on the shared derivation BOTH surfaces call.
	const active = { activeSchoolYearLabel: '2026-2027', source: 'enrollpro', activeTerm: null } as never;
	const a = resolveSimpleReadiness({ draft: null, blockingHardCount: 0, summary: { isPublished: false, unassignedCount: 0, assignedCount: 0, hardViolationCount: 0 }, softCount: 0, isPreGenerationWorkspace: false, schoolYearContext: active, hasGeneratedRun: false, isRunPublished: false } as never);
	const b = resolveSimpleReadiness({ draft: null, blockingHardCount: 0, summary: { isPublished: false, unassignedCount: 0, assignedCount: 0, hardViolationCount: 0 }, softCount: 0, isPreGenerationWorkspace: false, schoolYearContext: active, hasGeneratedRun: false, isRunPublished: false } as never);
	assert.equal(a.readiness, b.readiness, 'both surfaces read the same derivation, so they cannot disagree');
	// And the setup pane really hands that one source to the derivation.
	const pane = source('src/components/timetable/TimetableSetupPane.tsx');
	assert.match(pane, /schoolYearContext: inputs\.schoolYearContext/, 'the setup pane passes the workspace context, not a second/derived year');
	assert.doesNotMatch(pane, /activeSchoolYearLabel:\s*inputs\.schoolYearId/, 'the setup pane never derives a year label from the year id');
});

// ═══ ROWS 14/15 — THE RUNS PANE (RENDERED) ══════════════════════════════════

test('ROWS 14/15 RENDERED: the Runs empty state uses the new copy and the duplicate `read-only history` sub-row is deleted', () => {
	const host = tree(renderToStaticMarkup(createElement(MemoryRouter as never, { initialEntries: ['/timetable/runs'] },
		createElement(TimetableRunsPane as never, {
			runs: [], runsPending: false, runsUnavailableReason: null, selectedRunId: 'latest',
			onSelectRun: () => {}, formatTimestamp: (v: string) => v, formatDuration: (v: number) => String(v),
		} as never))));
	const text = host.textContent ?? '';
	assert.ok(text.includes('No drafts yet for this school year.'), 'row 14: the empty headline');
	assert.ok(text.includes('Drafts and published schedules appear here.'), 'row 14: the empty explanation');
	assert.equal(text.includes('No generation runs yet'), false, 'the retired wording is gone');
	assert.equal(text.includes('read-only history'), false, 'row 15: the duplicate `read-only history` sub-row is deleted');
});

// ═══ ROWS 4, 8, 25 — THE MORE MENU (RENDERED, one client mount) ═════════════

test('ROWS 4/25 RENDERED: the More menu has NO `Expert tools` group and the unplaced item reads `N classes need a time slot`', async () => {
	const view = await mountHeader(baseContext());
	const menu = await view.openMenu();
	assert.ok(menu, 'the real More menu opens through the production trigger');
	assert.equal(menu!.querySelector('[data-testid="timetable-simple-more-expert-tools"]'), null, 'row 4: the whole `Expert tools` group is deleted');
	assert.equal((menu!.textContent ?? '').includes('Expert tools'), false, 'and its name never renders');
	assert.equal(menu!.querySelector('[data-testid="timetable-layout-toggle"]'), null, 'the `Expert view` switch is retired');
	assert.equal(menu!.querySelector('[data-testid="timetable-more-review-issues"]'), null, 'and `Review issues` is not in an Expert group');
	// The other groups survive.
	for (const id of ['timetable-simple-more-daily-tasks', 'timetable-simple-more-help', 'timetable-simple-more-tools', 'timetable-simple-more-schedule-data']) {
		assert.ok(menu!.querySelector(`[data-testid="${id}"]`), `${id} still renders`);
	}
	const unplaced = menu!.querySelector('[data-testid="timetable-more-unassigned-sessions"]') as HTMLElement;
	assert.ok(unplaced, 'row 25: the unplaced entry renders');
	assert.match(unplaced.textContent ?? '', /0 classes need a time slot/, 'row 25: the exact decision-8 wording');
	assert.equal((unplaced.textContent ?? '').includes('Unassigned sessions'), false, 'the retired wording is gone');
	assert.ok((unplaced.textContent ?? '').includes('No draft yet.'), 'row 25: `No generated schedule yet.` becomes `No draft yet.`');
});

test('ROWS 4/25 RENDERED (control): with no previous year in localStorage the More menu adds no `Past years` item', async () => {
	const view = await mountHeader(baseContext());
	const menu = await view.openMenu();
	assert.equal(menu!.querySelector('[data-testid="timetable-more-past-years"]'), null, 'row 4: the `Past years` item is hidden when there is no previous year');
});

test('ROW 8 RENDERED: with a draft on screen the More `Generate` row reads `Generate a draft`', async () => {
	const view = await mountHeader(draftContext());
	const menu = await view.openMenu();
	assert.ok(menu, 'the More menu opens');
	const generate = menu!.querySelector('[data-testid="timetable-more-generate"]') as HTMLElement;
	assert.ok(generate, 'the More Generate row renders once a run exists');
	assert.ok((generate.textContent ?? '').includes('Generate a draft'), 'row 8: the one verb');
	assert.equal((generate.textContent ?? '').includes('Build a new draft'), false, 'and the retired verb is gone');
});

// ═══ ROWS 9/11/12/26/27 — SOURCE ROWS (surfaces too heavy to mount) ═════════

test('ROW 9 SOURCE: the discard dialog asks `Discard this draft?` and its button reads `Discard draft`', () => {
	const dialog = source('src/components/timetable/modals/TimetableWorkflowDialogs.tsx');
	assert.match(dialog, /Discard this draft\?/, 'the title');
	assert.match(dialog, />Discard draft</, 'the confirm button');
	assert.doesNotMatch(dialog, /Reset the draft schedule\?/, 'the retired title is gone');
	assert.doesNotMatch(dialog, />Reset draft</, 'the retired button is gone');
});

test('ROW 11 SOURCE: the pre-generation draft note uses the one verb `Generate a draft` and no `build a new version`', () => {
	const center = source('src/components/timetable/CenterWorkspacePaneSurface.tsx');
	assert.doesNotMatch(center, /use Generate to build a new version/, 'the retired phrase is gone');
	assert.doesNotMatch(center, /Nothing is placed in this draft yet\. The draft is a separate working copy/, 'the 3-line paragraph is replaced by one line');
});

test('ROW 12 SOURCE: the Schedule empty state reads `No draft yet. Generate one to begin.`', () => {
	const center = source('src/components/timetable/CenterWorkspacePaneSurface.tsx');
	assert.match(center, /No draft yet\. Generate one to begin\./, 'the new empty-state sentence');
	assert.doesNotMatch(center, /No timetable yet\. Use the primary action above to begin\./, 'the retired sentence is gone');
});

test('ROW 26 SOURCE: the login/landing copy uses `Generate draft timetables…`', () => {
	const login = source('src/pages/Login.tsx');
	assert.doesNotMatch(login, /Build draft timetables with policy/, 'the retired copy is gone');
	assert.match(login, /Generate draft timetables with policy/, 'the new copy');
});

test('ROW 27 SOURCE: the export dialogs say `one Draft (or the Published schedule) and one term`', () => {
	const print = source('src/components/timetable/simple/SchedulerPrintDialog.tsx');
	const exportCenter = source('src/components/timetable/simple/SchedulerExportCenterDialog.tsx');
	assert.match(print, /one Draft \(or the Published schedule\) and one term/, 'the print dialog');
	assert.match(exportCenter, /one Draft \(or the Published schedule\) and one term/, 'the export centre dialog');
	assert.doesNotMatch(print, /one completed run and one ordered term/, 'the retired phrase is gone from the print dialog');
	assert.doesNotMatch(exportCenter, /from the selected run and ordered term/, 'and from the export centre dialog');
});
