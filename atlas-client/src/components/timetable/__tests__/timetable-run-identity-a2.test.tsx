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
import { readFileSync } from 'node:fs';
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

/**
 * The run-state text of the orientation strip's state cell, entities decoded.
 *
 * A2-UX-STATUS-C2 / U1 made the label match LABEL-AGNOSTIC on purpose. It used to
 * pin `>Run:</span>`, which asserted the very doubling U1 removed ("Run: Run
 * 321 · Draft"): the helper would have failed only because the label was
 * reworded, and would have passed again the moment a `Run <n> ·` value came
 * back. It now strips whatever bold lead-in the cell carries and asserts the
 * VALUE, which is what every row in this file is actually about.
 */
function runIdentityText(markup: string): string {
	const match = markup.match(/data-testid="timetable-run-identity"[^>]*><span[^>]*>[^<]*<\/span>([^<]*)</);
	assert.ok(match, `expected the run-identity cell; markup had ${markup.length} chars`);
	return decodeEntities(match[1]).trim();
}

/** The bold lead-in label of the orientation strip's state cell. */
function runIdentityLabel(markup: string): string {
	const match = markup.match(/data-testid="timetable-run-identity"[^>]*><span[^>]*>([^<]*)<\/span>/);
	assert.ok(match, 'expected the run-identity cell label');
	return decodeEntities(match[1]).trim();
}

/** The text of the heading run-state badge. */
function runBadgeText(markup: string): string {
	const match = markup.match(/data-testid="timetable-run-state-badge"[^>]*>([\s\S]*?)<\/span><\/div>|data-testid="timetable-run-state-badge"[^>]*>([\s\S]*?)<\/div>/);
	assert.ok(match, 'expected the run-state badge');
	return decodeEntities((match[1] ?? match[2] ?? '').replace(/<[^>]*>/g, '')).trim();
}

/** The badge's own state attributes: the key, the icon sign and the tone token. */
function runBadgeState(markup: string): { key: string; sign: string; tone: string; iconClass: string; tag: string } {
	const match = markup.match(/<[a-z]+([^>]*?)data-testid="timetable-run-state-badge"([^>]*)>/);
	assert.ok(match, 'expected the run-state badge element');
	const attrs = `${match[1]} ${match[2]}`;
	const read = (name: string) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '';
	const icon = markup.match(/data-testid="timetable-run-state-sign"[^>]*class="([^"]*)"/)?.[1]
		?? markup.match(/class="([^"]*)"[^>]*data-testid="timetable-run-state-sign"/)?.[1]
		?? '';
	return { key: read('data-run-state'), sign: read('data-run-state-sign'), tone: read('data-run-state-tone'), iconClass: icon, tag: match[0] };
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
		`Published — this is the schedule in use. (Run ${PUBLISHED_RUN})`,
		'the printed run number must be the run whose publication state is printed',
	);
	assert.ok(
		!identity.includes(`run ${NEWER_RUN}`),
		`the newer unfinished run #${NEWER_RUN} must not be printed at all (got "${identity}")`,
	);
	assert.ok(
		!new RegExp(`run ${NEWER_RUN}[^<]*Published`).test(markup),
		'the false pairing "run 322 … Published" must not appear anywhere in the header',
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
		`Published — this is the schedule in use. (Run ${PUBLISHED_RUN})`,
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
		!new RegExp(`run ${NEWER_RUN}`).test(markup),
		'and the FAILED run that is not on the grid is never printed as the run in view',
	);
});

// ── (c) the normal case still names the run and its state ────────────────────

test('C3 (c) the normal case still renders the run number and Published', () => {
	const markup = renderHeader();
	assert.equal(
		runIdentityText(markup),
		`Published — this is the schedule in use. (Run ${PUBLISHED_RUN})`,
		'the ordinary case is unchanged',
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
		`Draft — teachers and students cannot see it yet. (Run ${PUBLISHED_RUN})`,
		'a draft run says Draft, and says what that means',
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
	// A7 c12b (row 10) SUPERSEDED the planner line: `No schedule made yet.` is
	// `Draft · nothing placed yet`. The property is unchanged — the line never
	// claims a run it does not have.
	assert.equal(runIdentityText(markup), 'Draft · nothing placed yet', 'the planner names the draft state');
	assert.equal(runBadgeText(markup), 'No schedule yet', 'and the badge agrees with it');
	assert.ok(!/Run/.test(runIdentityText(markup)), 'the planner line never claims a run it does not have');
});

// ══════════════════════════════════════════════════════════════════════════
// A2-UX-STATUS-C2 — U1 the doubled word, U2 the empty badge, #51 truthfulness
//
// These render the REAL header (same `renderToStaticMarkup` harness as the C3
// rows above), so each one fails on the pre-candidate source and passes only
// when the header's own markup is right. They are appended, not substituted: no
// C3 assertion above was removed or weakened.
// ══════════════════════════════════════════════════════════════════════════

const HEADER_SOURCE = resolve(
	process.cwd(),
	'src/components/timetable/ScheduleReviewWorkspaceHeader.tsx',
);

function headerSource(): string {
	return readFileSync(HEADER_SOURCE, 'utf8');
}

// ── U1 — the doubled word ──────────────────────────────────────────────────

test('U1 the orientation strip can never print the doubled "Run: Run"', () => {
	// The literal the audit recorded. Asserted against the pre-candidate
	// construction first, so this row cannot pass vacuously.
	assert.equal('Run: ' + 'Run 321 · Draft', 'Run: Run 321 · Draft', 'pre-fix: the label and the value both opened with "Run"');

	for (const draft of [
		publishedDraft(PUBLISHED_RUN, true),
		publishedDraft(PUBLISHED_RUN, false),
		publishedDraft(NEWER_RUN, false),
	]) {
		const markup = renderHeader({ draft, activeGeneratedRunId: draft.runId });
		const cell = markup.match(/data-testid="timetable-run-identity"[\s\S]*?<\/span><\/span>/)?.[0] ?? '';
		assert.doesNotMatch(cell, /Run: Run/, 'the rendered cell can never contain the literal "Run: Run"');
		assert.doesNotMatch(cell, />Run:</, 'nor a bold "Run:" lead-in in front of a value that opens with "Run"');
	}
	// And the source can never reintroduce it: no bold `Run:` lead-in at all.
	assert.doesNotMatch(
		headerSource(),
		/text-foreground">Run:<\/span>/,
		'the header no longer renders a "Run:" lead-in beside a value that names the run',
	);
});

test('U1 the line is state-first: the state, what it means, then the run number', () => {
	assert.equal(
		runIdentityLabel(renderHeader({ draft: publishedDraft(PUBLISHED_RUN, false) })),
		'State:',
		'the cell is labelled for its content, not for the id',
	);
	assert.equal(
		runIdentityText(renderHeader({ draft: publishedDraft(PUBLISHED_RUN, false) })),
		`Draft — teachers and students cannot see it yet. (Run ${PUBLISHED_RUN})`,
		'a draft says what a draft MEANS for the people it affects, with the number last',
	);
	assert.equal(
		runIdentityText(renderHeader({ draft: publishedDraft(PUBLISHED_RUN, true) })),
		`Published — this is the schedule in use. (Run ${PUBLISHED_RUN})`,
		'a published run says it is the one in use, with the number last',
	);
	// The number is genuinely secondary: it is the tail, never the lead-in.
	// INTEGRATION (2026-09-28): the tail shape changed when the header was
	// pointed at the single lib source. The INTENT of the original row — the
	// number is a trailing suffix, not the opening token — is preserved and
	// strengthened: the pattern matches the new `(Run N)` tail, and a second
	// control now pins that the line cannot open with the number at all.
	const line = runIdentityText(renderHeader());
	assert.match(line, /\(Run \d+\)$/, 'the run number is a trailing suffix, not the lead-in');
	assert.match(line, /^Published|^Draft/, 'and the state word leads');
	assert.doesNotMatch(line, /^\d/, 'the number can never open the sentence');
});

// ── U2 — the badge carries no information ──────────────────────────────────

test('U2 Draft and Published differ in LABEL, ICON and COLOUR — none alone is load-bearing', () => {
	const draft = runBadgeState(renderHeader({ draft: publishedDraft(PUBLISHED_RUN, false) }));
	const published = runBadgeState(renderHeader({ draft: publishedDraft(PUBLISHED_RUN, true) }));

	assert.equal(draft.key, 'draft', 'a draft run keys the badge "draft"');
	assert.equal(published.key, 'published', 'a published run keys it "published"');

	// 1. LABEL
	assert.equal(runBadgeText(renderHeader({ draft: publishedDraft(PUBLISHED_RUN, false) })), 'Draft schedule');
	assert.equal(runBadgeText(renderHeader({ draft: publishedDraft(PUBLISHED_RUN, true) })), 'Published schedule');
	assert.notEqual(draft.tag, published.tag, 'and the two states are not the same element');

	// 2. ICON — a distinct glyph per state, not a tint of one glyph.
	assert.equal(draft.sign, 'in-progress', 'a draft is marked as work in progress');
	assert.equal(published.sign, 'settled', 'a published run is marked as settled');
	assert.notEqual(draft.iconClass, published.iconClass, 'the two states render different SVG geometry');

	// 3. COLOUR
	assert.equal(draft.tone, 'amber', 'a draft is amber');
	assert.equal(published.tone, 'emerald', 'a published run is green');
	assert.notEqual(draft.tag, published.tag, 'so the badge element itself differs in colour');
	// Colour is never the only channel: the icon and the word are both present
	// in each state, and the icon is aria-hidden so it never double-reads.
	for (const state of [draft, published]) {
		assert.ok(state.iconClass, 'each state renders an icon');
	}
	assert.match(renderHeader({ draft: publishedDraft(PUBLISHED_RUN, true) }), /aria-hidden="true"[^>]*data-testid="timetable-run-state-sign"/);
	assert.equal(runBadgeText(renderHeader({ draft: publishedDraft(PUBLISHED_RUN, true) })), 'Published schedule', 'and the word is visible text, not a title attribute');
});

test('U2 every run state has its own key, sign and tone', () => {
	const cases: Array<[Record<string, unknown>, string, string, string]> = [
		[{ draft: publishedDraft(PUBLISHED_RUN, false) }, 'draft', 'in-progress', 'amber'],
		[{ draft: publishedDraft(PUBLISHED_RUN, true) }, 'published', 'settled', 'emerald'],
		[{ draft: null, summary: null, runs: [] }, 'empty', 'none', 'muted'],
		[{ isPreGenerationWorkspace: true, centerView: 'pre-generation', draft: null, runs: [], summary: null }, 'planning', 'in-progress', 'amber'],
	];
	for (const [overrides, key, sign, tone] of cases) {
		const state = runBadgeState(renderHeader(overrides));
		assert.equal(state.key, key, `key for ${key}`);
		assert.equal(state.sign, sign, `sign for ${key}`);
		assert.equal(state.tone, tone, `tone for ${key}`);
	}
});

// ── #51 — the run tab and the heading follow the RUN, never the layout mode ──

test('#51 a published run on the Expert surface renders no "Draft" anywhere in its state chrome', () => {
	const markup = renderHeader({ draft: publishedDraft(PUBLISHED_RUN, true) });
	// The pre-candidate surface: the badge's variant AND its whole class string
	// were chosen by `isPreGenerationWorkspace`, so a published run and an
	// unpublished one were styled identically and only the word differed.
	assert.doesNotMatch(
		markup.match(/<[a-z]+[^>]*data-testid="timetable-run-state-badge"[^>]*>/)?.[0] ?? '',
		/isPreGenerationWorkspace|uppercase/,
		'the badge styling is not keyed on the layout/surface flag, and no longer shouts in caps',
	);
	assert.doesNotMatch(
		headerSource(),
		/variant=\{isPreGenerationWorkspace \? 'secondary' : 'default'\}/,
		'the pre-candidate layout-keyed badge variant is gone from the source',
	);
	// Test the words operators see. A broad markup slice also includes internal
	// test IDs such as `timetable-draft-state-strip`, which are not visible copy.
	assert.match(runIdentityText(markup), /^Published\b/, 'the state line leads with publication');
	assert.doesNotMatch(runIdentityText(markup), /Draft/i, 'the visible state line never calls a published run a draft');
	assert.equal(runBadgeText(markup), 'Published schedule', 'the visible badge agrees');
	// The heading is a SECTION name, never a run state — which is why it cannot
	// disagree with the badge.
	assert.equal(runIdentityLabel(markup), 'State:', 'the strip cell is labelled by state');
	assert.doesNotMatch(
		headerSource(),
		/Generated timetable/,
		'the pre-#51 "Generated timetable" heading wording cannot come back',
	);
});

test('#51 the published/draft verdict reads the run and tolerates any run shape', () => {
	// MINIMAL shape: only the one field the publication contract uses. The base
	// fixture carries five summary fields, and a test that only ever sees the
	// full shape proves nothing about a run the server shaped differently.
	const minimalPublished = {
		runId: 320,
		status: 'COMPLETED',
		entries: [],
		unassignedItems: [],
		summary: { isPublished: true },
		version: 1,
		finishedAt: null,
		createdAt: '2030-01-01T00:00:00.000Z',
	} as unknown as DraftReport;
	const minimalDraft = { ...minimalPublished, summary: { isPublished: false } } as unknown as DraftReport;

	for (const [draft, expected] of [[minimalPublished, 'published'], [minimalDraft, 'draft']] as const) {
		const markup = renderHeader({ draft, activeGeneratedRunId: draft.runId, runs: [{ id: draft.runId, status: 'COMPLETED' }] });
		assert.equal(
			runBadgeState(markup).key,
			expected,
			`a summary carrying only isPublished must still read "${expected}" — no other field is consulted`,
		);
	}
	// A summary that is not an object at all is neither: no crash, no claim.
	const junk = { ...minimalPublished, summary: 'not-a-summary' } as unknown as DraftReport;
	assert.equal(runBadgeState(renderHeader({ draft: junk, activeGeneratedRunId: 320 })).key, 'draft', 'a junk summary reads as unpublished, never as published');
	assert.equal(runBadgeState(renderHeader({ draft: null, summary: null })).key, 'empty', 'and no draft at all is its own state');
});

test('#51 SUPERSEDED (A7 c12b, decision 8): the draft tab is named `Draft`, the operator\'s one vocabulary', () => {
	const subNav = readFileSync(
		resolve(process.cwd(), 'src/components/timetable/TimetableSubNav.tsx'),
		'utf8',
	);
	// The superseded claim, retained: "the sub-nav tab is a SECTION name, so it can
	// never read as a run state — the link was named `Planning`." Decision 8
	// (operator, 2026-09-30) explicitly reverses it in the CORRECTION: "The draft
	// should never be 'planning', it should be 'draft'."
	assert.match(subNav, /\{ key: 'draft', label: 'Draft', to: '\/timetable\/pre-generation' \}/, 'the pre-generation link reads Draft, the one vocabulary');
	const labels = [...subNav.matchAll(/label: '([^']+)', to: '/g)].map((match) => match[1]);
	assert.deepEqual(
		labels,
		['Schedule', 'Draft', 'Setup', 'Policies', 'Runs'],
		'the five tabs keep one vocabulary; decision 8 sets the draft tab to Draft',
	);
});

/* INTEGRATION NOTE (Planner A2, 2026-09-28, A2-UX-INT-C2).
 *
 * A2-UX-STATUS-C2 (S2) had to define its own run-state line locally, because the
 * lib sentence was built around the `Run <n> -` prefix U1 removes, and it correctly
 * reported that duplication as a DEPENDENCY instead of forking the string silently.
 * The integration boundary closed it: `ScheduleReviewWorkspaceHeader.tsx` now calls
 * the lib `runStateSentence` and the local copy is deleted. The header therefore
 * renders the LIB format, so S2's six expectations below were superseded by the
 * equal-or-stronger assertions already present on the other side of the conflict
 * (same rendered value, stricter patterns, plus the U5 `No generated run yet` and
 * `^Run` rows). This is a supersession, not a deletion: every control S2 added is
 * retained, and its unique U1/U2/#51 regression tests are all still in this file.
 * Recorded here so no later reader concludes a control was removed to pass a gate.
 */
