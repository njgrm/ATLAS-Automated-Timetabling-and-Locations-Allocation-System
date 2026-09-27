/**
 * A2-TIMETABLE-CUSTODY (correction C3) — the run number and the publication state
 * printed beside it must belong to the SAME run.
 *
 * QA finding, BLOCKING, and NEW in the candidate: `ScheduleReviewWorkspaceHeader`
 * passed `runId: activeGeneratedRunId` together with
 * `isPublished: isRunPublished`, and those are two different sources.
 * `isRunPublished` is `isDraftPublishedStrict(draft)` — the state of
 * `draft.summary`, i.e. of `draft.runId`. `activeGeneratedRunId` is
 * `useTimetableData.ts:1370-1375`, which under `selectedRunId === 'latest'`
 * resolves to `runs[0]?.id`, the NEWEST run regardless of whether it finished.
 *
 * The same file proves the two diverge, which is why the defect is not
 * theoretical: `newerFailedRunNotice` (lines 352-358) exists precisely for
 * `latestRunCandidate.id !== draft.runId`, and the line it renders —
 * "Grid uses completed run #321; newer run #322 is RUNNING" — asserts that the
 * grid is `draft.runId` while `runs[0]` is something else. So a published run
 * 321 with a newer in-flight 322 rendered BOTH "the grid uses 321" AND
 * "Run: Run 322 · Published" at the same moment. The pre-candidate base named no
 * run at all, so the false pairing was introduced here, not inherited.
 *
 * The empty state was affected too: with `draft == null` and
 * `runOptions[0].status === 'FAILED'` — a state this file already contemplates on
 * line 234 — `activeGeneratedRunId` is non-null, so `hasRun: true` rendered
 * "Draft schedule" where "No generated run yet" is the truthful word (the file's
 * own `hasGeneratedRun: Boolean(draft)` says the same thing one line up).
 *
 * ── Why these rows RENDER the production header ──────────────────────────────
 * The pre-correction suite's `runStateSentence` rows test only the pure
 * function, and its WIRING row only asserted the SYMBOL was present in the
 * source. Neither can fail on this defect: the defect is in WHICH argument the
 * header passes, and both of those rows pass on `f9879289` with the defect
 * present. So these rows render the real `ScheduleReviewWorkspaceHeader` with
 * `renderToStaticMarkup` and read the two addressable regions
 * (`timetable-run-identity`, `timetable-run-state-badge`) out of the markup.
 * That is production-path proof: it fails on the candidate and passes only when
 * the header's own argument choice is right.
 *
 * Run: `npm run test:timetable-run-identity-a2` (wired in atlas-client/package.json
 * in the same commit, and added to `test:client-suite`).
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { ScheduleReviewWorkspaceHeader } from '@/components/timetable/ScheduleReviewWorkspaceHeader';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { DraftReport } from '@/types';

const PUBLISHED_RUN = 321;
const NEWER_RUN = 322;

function publishedDraft(runId: number, isPublished: boolean): DraftReport {
	return {
		runId,
		status: 'COMPLETED',
		entries: [],
		unassignedItems: [],
		summary: {
			runId,
			hardViolationCount: 0,
			softViolationCount: 0,
			unassignedCount: 0,
			isPublished,
		},
		version: 3,
		finishedAt: null,
		createdAt: '2031-01-01T00:00:00.000Z',
	} as unknown as DraftReport;
}

function makeContext(overrides: Record<string, unknown> = {}): ScheduleReviewWorkspaceHeaderContext {
	return {
		isPreGenerationWorkspace: false,
		activeGeneratedRunId: PUBLISHED_RUN,
		leftTab: 'violations',
		leftPanelRef: { current: null },
		presentationMode: 'workflow',
		setPresentationMode: () => {},
		viewMode: 'section',
		setViewMode: () => {},
		entityFilter: '701',
		setEntityFilter: () => {},
		focusSection: () => {},
		sectionFocusId: null,
		programFilter: 'all',
		entryKindFilter: 'all',
		violations: [],
		hardCount: 0,
		blockingHardCount: 0,
		softCount: 0,
		selectedRunId: String(PUBLISHED_RUN),
		handleRunChange: () => {},
		runs: [{ id: PUBLISHED_RUN, createdAt: '2031-01-01T00:00:00.000Z', status: 'COMPLETED' }],
		schoolYearContext: { activeSchoolYearLabel: '2030-2031', source: 'atlas', activeTerm: null },
		schoolId: 1,
		curriculumReadiness: {
			state: 'ready',
			message: 'ready',
			diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] },
		},
		centerView: 'schedule',
		newDraftLoading: false,
		schoolYearId: 9,
		handleStartNewPreGenerationDraft: async () => {},
		draftPlacementCount: 0,
		openPreGenerationWorkspace: async () => {},
		returnToGeneratedRun: () => {},
		generating: false,
		loading: false,
		handleTriggerGenerate: () => {},
		draft: publishedDraft(PUBLISHED_RUN, true),
		setPublishAcknowledged: () => {},
		setShowPublishDialog: () => {},
		exitPolicyView: () => {},
		switchCenterViewWithGuard: (action: () => void) => action(),
		enterPolicyView: () => {},
		openMapWorkspace: async () => {},
		handleRefresh: () => {},
		refreshReferenceLabels: () => {},
		referenceLookupStatus: { state: 'ready', label: 'References ready' },
		revertLoading: false,
		editHistoryCount: 0,
		undoBlockedReason: null,
		lastEditUndoable: false,
		revertLastEdit: async () => {},
		setShowEditHistory: () => {},
		tutorial: { start: () => {} },
		sectionLabel: (id: number) => `Section ${id}`,
		subjectLabel: (id: number) => `Subject ${id}`,
		facultyLabel: (id: number) => `Teacher ${id}`,
		setUnassignedReasonFilter: () => {},
		summary: { assignedCount: 0, classesProcessed: 0, hardViolationCount: 0, unassignedCount: 0 },
		requestPendingCount: 0,
		statusColor: () => '',
		formatDuration: () => '',
		formatTimestamp: () => 'Sep 26, 08:05 PM',
		groupedPivotEntities: [],
		pivotLabel: () => '',
		setSelectedEntry: () => {},
		hasSelectedEntry: false,
		setSelectedViolation: () => {},
		enterManualEditView: () => {},
		setPreGenKbSource: () => {},
		setKbSelectedSource: () => {},
		severityFilter: 'all',
		setSeverityFilter: () => {},
		setLeftTab: () => {},
		VIEW_MODE_LABELS: { section: 'Section', faculty: 'Teacher', room: 'Room' },
		PROGRAM_FILTER_OPTIONS: [],
		ENTRY_KIND_FILTER_OPTIONS: [],
		WELLBEING_CODES: new Set<string>(),
		CONFLICT_CODES: new Set<string>(),
		setProgramFilter: () => {},
		setEntryKindFilter: () => {},
		policy: { teacherMoveEnabled: true },
		policyAlignmentWarning: null,
		showFullDay: false,
		setShowFullDay: () => {},
		hiddenRowCount: 0,
		termFilter: 'all',
		onTermFilterChange: () => {},
		termOptions: [],
		activeTermIndex: null,
		...overrides,
	} as unknown as ScheduleReviewWorkspaceHeaderContext;
}

function renderHeader(overrides: Record<string, unknown> = {}): string {
	return renderToStaticMarkup(
		createElement(
			MemoryRouter,
			null,
			createElement(ScheduleReviewWorkspaceHeader, { context: makeContext(overrides) }),
		),
	);
}

/** The run-state text of the orientation strip's `Run:` cell, entities decoded. */
function runIdentityText(markup: string): string {
	const match = markup.match(/data-testid="timetable-run-identity"[^>]*><span[^>]*>Run:<\/span>([^<]*)</);
	assert.ok(match, `expected the run-identity cell; markup had ${markup.length} chars`);
	return decodeEntities(match[1]).trim();
}

/** The text of the heading run-state badge. */
function runBadgeText(markup: string): string {
	const match = markup.match(/data-testid="timetable-run-state-badge"[^>]*>([^<]*)</);
	assert.ok(match, 'expected the run-state badge');
	return decodeEntities(match[1]).trim();
}

function decodeEntities(text: string): string {
	return text
		.replace(/&middot;/g, '·')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#x27;/g, "'");
}

// ── (a) a newer in-flight run must never be printed with the older run's state ─

test('C3 (a) a newer unfinished run over a published draft.runId is not printed as Published', () => {
	const markup = renderHeader({
		// The exact state the header's OWN `newerFailedRunNotice` exists for:
		// selectedRunId === 'latest' with runs[0] not COMPLETED and not draft.runId.
		selectedRunId: 'latest',
		activeGeneratedRunId: NEWER_RUN,
		runs: [
			{ id: NEWER_RUN, createdAt: '2031-02-01T00:00:00.000Z', status: 'RUNNING' },
			{ id: PUBLISHED_RUN, createdAt: '2031-01-01T00:00:00.000Z', status: 'COMPLETED' },
		],
		draft: publishedDraft(PUBLISHED_RUN, true),
		summary: { assignedCount: 0, classesProcessed: 0, hardViolationCount: 0, unassignedCount: 0 },
	});

	// Sanity: the divergence the file documents is genuinely present in this
	// fixture. `newerFailedRunNotice` (line 352) is exactly this condition, and
	// it gates the `timetable-newer-run-failed` badge on line 414 — so the
	// header is ALREADY telling the operator it is showing the older run.
	assert.match(
		markup,
		/data-testid="timetable-newer-run-failed"/,
		'precondition: the header has already detected that runs[0] is not the run on the grid',
	);

	const identity = runIdentityText(markup);
	assert.equal(
		identity,
		'Published — this is the schedule in use. (Run 321)',
		'the printed run number must be the run whose publication state is printed, and the state now leads',
	);
	assert.ok(
		!identity.includes(`Run ${NEWER_RUN}`),
		`the newer unfinished run #${NEWER_RUN} must not be printed at all (got "${identity}")`,
	);
	assert.ok(
		!/^Run/.test(identity),
		`the run number is secondary and never the subject of the sentence (got "${identity}")`,
	);
	assert.ok(
		!new RegExp(`${NEWER_RUN}[^<]*Published`).test(markup),
		'the false pairing "322 … Published" must not appear anywhere in the header',
	);
});

test('C3 (a2) the same holds when the newer run FAILED rather than is in flight', () => {
	const markup = renderHeader({
		selectedRunId: 'latest',
		activeGeneratedRunId: NEWER_RUN,
		runs: [
			{ id: NEWER_RUN, createdAt: '2031-02-01T00:00:00.000Z', status: 'FAILED' },
			{ id: PUBLISHED_RUN, createdAt: '2031-01-01T00:00:00.000Z', status: 'COMPLETED' },
		],
		draft: publishedDraft(PUBLISHED_RUN, true),
	});
	assert.equal(
		runIdentityText(markup),
		'Published — this is the schedule in use. (Run 321)',
		'a failed newer run is still not the published run on the grid',
	);
	assert.equal(
		runBadgeText(markup),
		'Published schedule',
		'and the badge describes the run that is actually on the grid',
	);
});

// ── (b) the FAILED-only empty state is an empty state, not a draft schedule ──

test('C3 (b) a FAILED-only run list with no draft renders the empty state, not "Draft schedule"', () => {
	const markup = renderHeader({
		selectedRunId: 'latest',
		// Non-null, exactly as `useTimetableData` resolves it: runs[0] exists.
		activeGeneratedRunId: NEWER_RUN,
		runs: [{ id: NEWER_RUN, createdAt: '2031-02-01T00:00:00.000Z', status: 'FAILED' }],
		draft: null,
		summary: null,
	});
	assert.equal(
		runBadgeText(markup),
		'No schedule yet',
		'with no draft there is no run on the grid, so the badge must not claim a draft schedule',
	);
	// `runStateSentence` returns null when there is nothing to name, and the
	// header omits the cell rather than printing a placeholder — so no run
	// number appears at all in this state.
	assert.ok(
		!markup.includes('data-testid="timetable-run-identity"'),
		'and the run-identity cell is omitted entirely, because no run is on the grid',
	);
	assert.ok(
		!markup.includes('Draft schedule'),
		'the pre-fix "Draft schedule" over a FAILED-only run list is gone',
	);
	assert.ok(
		!/No generated run yet/.test(markup),
		'U5: the empty badge says what is missing, not what the engine has not produced',
	);
	assert.ok(
		!new RegExp(`${NEWER_RUN}\\s*[·(]`).test(markup),
		'and the FAILED run that is not on the grid is never printed as the run in view',
	);
});

// ── (c) the normal case still names the run and its state ────────────────────

test('C3 (c) the normal case still renders the run number and Published', () => {
	const markup = renderHeader();
	assert.equal(
		runIdentityText(markup),
		'Published — this is the schedule in use. (Run 321)',
		'the ordinary case still names the run, and the state now leads the sentence',
	);
	assert.equal(runBadgeText(markup), 'Published schedule', 'and so is its badge');
});

test('C3 (c2) an unpublished draft still renders the run number and Draft', () => {
	const markup = renderHeader({
		draft: publishedDraft(PUBLISHED_RUN, false),
		activeGeneratedRunId: PUBLISHED_RUN,
	});
	assert.equal(
		runIdentityText(markup),
		'Draft — teachers and students cannot see it yet. (Run 321)',
		'a draft run leads with Draft and says what a draft means',
	);
	assert.equal(runBadgeText(markup), 'Draft schedule', 'and the badge agrees');
});

test('C3 (c3) the pre-generation planner keeps its own line and never claims a run', () => {
	const markup = renderHeader({
		isPreGenerationWorkspace: true,
		centerView: 'pre-generation',
		draft: null,
		activeGeneratedRunId: null,
		runs: [],
		summary: null,
	});
	assert.equal(runIdentityText(markup), 'No schedule made yet.', 'the planner says what is missing, in three words');
	assert.equal(runBadgeText(markup), 'No schedule yet', 'and the badge agrees with it');
	assert.ok(!/Run/.test(runIdentityText(markup)), 'the planner line never claims a run it does not have');
});
