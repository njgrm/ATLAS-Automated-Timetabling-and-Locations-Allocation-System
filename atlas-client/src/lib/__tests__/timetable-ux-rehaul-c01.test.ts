/**
 * TIMETABLE-UX-REHAUL-C01R — the relaxed Simple shell (one status, one primary,
 * persistent sub-nav).
 *
 * Production-path proof: the real `TimetableSimpleHeader` / `TimetableSubNav` /
 * `TimetableGrid` render with an injected workspace context (not a helper).
 * Fixtures are copied from the live surface quoted in packet §0 and from the
 * committed cell-info fixtures (`G7AW`, `G7 Room 101 · G7`):
 * - F-07: `P. CRUZ · G7 Room 103 · G7AW` repeats the grade.
 * - U2: two filled primaries (`Publish schedule`, `Review warnings`) + outline `Generate`.
 * - U3: no persistent sub-nav; Setup/Runs/Exports reachable only by typing the URL.
 * - U6: no-scroll architecture (pinned by the route-keys suite, not re-measured here).
 *
 * Run: `npm run test:timetable-ux-rehaul`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { TimetableSimpleHeader } from '../../components/timetable/TimetableSimpleHeader';
import { TimetableSubNav } from '../../components/timetable/TimetableSubNav';
import { TimetableGrid, dedupeCellGradeRepetition } from '../../components/timetable/TimetableGrid';
import type { ScheduleReviewWorkspaceHeaderContext } from '../../components/timetable/buildScheduleReviewWorkspaceContexts';
import type { DraftReport, GenerationInputComparison, ScheduledEntry } from '@/types';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function draftWithSummary(summary: Record<string, unknown>, inputState?: GenerationInputComparison): DraftReport {
	return {
		runId: 42,
		status: 'COMPLETED',
		entries: [],
		unassignedItems: [],
		summary: summary as unknown as DraftReport['summary'],
		inputState,
		version: 3,
		finishedAt: null,
		createdAt: '2031-01-01T00:00:00.000Z',
	} as unknown as DraftReport;
}

// Live drift shape from the committed R7 surface: a stale rooms comparison.
function staleRoomsInputState(): GenerationInputComparison {
	return {
		status: 'STALE',
		message: 'Rooms changed.',
		actionHint: 'Review rooms.',
		changedDomains: ['rooms'],
		checkedAt: '2026-09-13T00:00:00.000Z',
	} as unknown as GenerationInputComparison;
}

function makeContext(overrides: Record<string, unknown> = {}): ScheduleReviewWorkspaceHeaderContext {
	return {
		isPreGenerationWorkspace: false,
		activeGeneratedRunId: 42,
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
		selectedRunId: '42',
		handleRunChange: () => {},
		runs: [{ id: 42, createdAt: '2031-01-01T00:00:00.000Z', status: 'COMPLETED' }],
		schoolYearContext: { activeSchoolYearLabel: '2030-2031', source: 'enrollpro-verified', activeTerm: null },
		schoolId: 1,
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
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
		draft: null,
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
		formatTimestamp: () => '',
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
		createElement(MemoryRouter, null,
			createElement(TimetableSimpleHeader, {
				context: makeContext(overrides),
				layoutMode: 'simple',
				onLayoutModeChange: () => {},
				activeTask: null,
				onTaskChange: () => {},
			}),
		),
	);
}

function renderSubNav(path: string): string {
	return renderToStaticMarkup(
		createElement(MemoryRouter, { initialEntries: [path] },
			createElement(TimetableSubNav),
		),
	);
}

/**
 * D3 counting rule: a "filled/solid action" is a rendered `<button>` carrying
 * the shadcn `default`-variant fill (`bg-primary`). Outline/ghost/secondary
 * controls, badges, and legend dots never match. The shell selection strip is
 * not part of `TimetableSimpleHeader` and is out of scope for this count.
 */
function solidActionButtons(markup: string): string[] {
	return (markup.match(/<button[^>]*>/g) ?? []).filter((tag) => /\bbg-primary\b/.test(tag));
}

const CLEAN_UNPUBLISHED = {
	draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
	blockingHardCount: 0,
};

/* ── D1 — persistent sub-nav ─────────────────────────────────────────────── */

test('C01R D1 the sub-nav renders the four timetable navigation links without an export page', () => {
	const markup = renderSubNav('/timetable');
	assert.match(markup, /data-testid="timetable-sub-nav"/);
	for (const [key, href] of [
		['schedule', '/timetable'],
		['draft', '/timetable/pre-generation'],
		['setup', '/timetable/setup'],
		['policies', '/timetable/policies'],
		['runs', '/timetable/runs'],
	] as Array<[string, string]>) {
		assert.match(markup, new RegExp(`data-testid="timetable-sub-nav-${key}"[^>]*href="${href.replaceAll('/', '\\/')}"|href="${href.replaceAll('/', '\\/')}"[^>]*data-testid="timetable-sub-nav-${key}"`), `sub-nav item ${key} must link to ${href}`);
	}
	// The index link is the active one here (real NavLink active state).
	const schedule = markup.match(new RegExp('<[^>]*data-testid="timetable-sub-nav-schedule"[^>]*>'));
	assert.ok(schedule, 'the schedule item must render');
	assert.match(schedule[0], /aria-current="page"/, 'the index route must mark Schedule active');
});

test('C01R D1 the sub-nav marks the sub-page active without new routes or data reads', () => {
	const markup = renderSubNav('/timetable/setup');
	const setup = markup.match(new RegExp('<[^>]*data-testid="timetable-sub-nav-setup"[^>]*>'));
	assert.ok(setup, 'the setup item must render');
	assert.match(setup[0], /aria-current="page"/, 'the setup route must mark Setup active');
	const schedule = markup.match(new RegExp('<[^>]*data-testid="timetable-sub-nav-schedule"[^>]*>'));
	assert.ok(schedule, 'the schedule item must render');
	assert.doesNotMatch(schedule[0], /aria-current/, 'the index link must not stay active on a sub-page');
	// The entry point is new links, not a new route tree or fetch layer.
	const nav = source('src/components/timetable/TimetableSubNav.tsx');
	assert.match(nav, /NavLink/);
	assert.doesNotMatch(nav, /fetch\(|axios|useQuery|useMutation|atlasApi/);
	const app = source('src/App.tsx');
	assert.doesNotMatch(app, /path: 'timetable\/setup'|path: 'timetable\/runs'|path: 'timetable\/exports'/, 'no flat sibling route may exist');
	// The shell renders it above the workspace on every /timetable* route.
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /<TimetableSubNav \/>/);
});

test('C01R D1 the sub-nav uses primitives only and keeps the no-scroll shell', () => {
	const nav = source('src/components/timetable/TimetableSubNav.tsx');
	assert.doesNotMatch(nav, /<select\b/);
	assert.doesNotMatch(nav, /<button[\s>]/);
	assert.doesNotMatch(nav, /<details\b/);
	assert.doesNotMatch(nav, /title="/);
	assert.doesNotMatch(nav, /overflow-auto/);
	for (const match of nav.matchAll(/text-\[([0-9.]+)rem\]/g)) {
		assert.ok(Number(match[1]) >= 0.75, `sub-nav contains ${match[0]}, below the 12px floor`);
	}
	assert.ok(nav.split('\n').length <= 150, 'the sub-nav must stay within its 150-line budget');
});

/* ── D2/C3 — one status surface ──────────────────────────────────────────── */

test('C01R C3 the header renders one status surface owning drift, day options, and the next step', () => {
	const markup = renderHeader({
		draft: draftWithSummary(
			{ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false },
			staleRoomsInputState(),
		),
		blockingHardCount: 0,
		policyAlignmentWarning: 'Two earlier rows are hidden by the current start-time policy.',
		hiddenRowCount: 2,
	});
	// SUPERSEDED (A2 c14 follow-ups, 2026-09-29, authority: AGENTS.md §8 header
	// budget + A2 C11 S2 item 2, both already on main). The two assertions below
	// pinned ONE CONTAINER by name. The header-budget slice deliberately split
	// that container: the run-identity / term-authority / capped-messages band is
	// now `timetable-simple-status-band` (row 1, in
	// `simple/SimpleHeaderTrailingSurfaces.tsx`), and the change notice moved to
	// ROW 2 as its first child — "ONE sentence, ONE primary action, one secondary,
	// and part of THIS row rather than a row of its own". The drift message is
	// therefore still rendered, but it is no longer a DESCENDANT of the status
	// surface. The property this row exists to protect is unchanged and is
	// re-asserted by the R-rows immediately below, in rendered markup, which is
	// stronger than either superseded pin:
	//
	//   const regions = markup.match(/data-testid="timetable-simple-status-region"/g) ?? [];
	//   assert.equal(regions.length, 1, 'exactly one status region may render');
	//   const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	//   // The drift message is a descendant of the region, not a sibling strip.
	//   assert.match(
	//   	markup,
	//   	/<section[^>]*data-testid="timetable-simple-status-region"[^>]*>[\s\S]*?data-testid="timetable-simple-input-drift"[\s\S]*?<\/section>/,
	//   	'the drift message must render inside the single status region',
	//   );
	//
	// C01R C3R (replacement) — the one status surface is still exactly one, and
	// the drift warning is still ON SCREEN rather than derived and dropped.
	const bands = markup.match(/data-testid="timetable-simple-status-band"/g) ?? [];
	assert.equal(bands.length, 1, 'exactly one status band may render in the Simple header');
	// The drift message renders — a header that derived the notice and dropped it
	// is exactly the defect C11 S2 item 2 was written to close.
	assert.match(
		markup,
		/data-testid="timetable-simple-input-drift"/,
		'the drift message still renders in the Simple header',
	);
	// …and it renders as a later sibling of the status band, not inside it: that
	// is the C11 S2 item 2 placement this supersession records. The offset
	// control that decides it lives at C01R C3R2 below.
	assert.doesNotMatch(
		markup,
		/data-testid="timetable-simple-status-band"[\s\S]*?data-testid="timetable-simple-input-drift"/,
		'the drift notice is not rendered by the status band',
	);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	// A3 — the hidden-row controls and the setup-input repairs moved OUT of the
	// header row: the repairs live on `/timetable/setup`, and the Day options
	// live in the More menu. One shared `SimpleDayOptions` still owns the panel
	// structure (in its inline form).
	assert.doesNotMatch(markup, /data-testid="timetable-day-options-trigger"/, 'Day options is not a header control');
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /<SimpleDayOptions/, 'the More menu mounts the shared Day options');
	assert.match(menu, /data-testid="timetable-more-day-options"/);
	const dayOptions = source('src/components/timetable/simple/SimpleDayOptions.tsx');
	for (const testId of ['timetable-hidden-rows-chip', 'timetable-show-full-day-toggle', 'timetable-hidden-row-controls']) {
		assert.ok(dayOptions.indexOf(`data-testid="${testId}"`) >= 0, `${testId} stays wired inside the shared controls`);
	}
	assert.match(dayOptions, /<PopoverContent forceMount/, 'the panel stays mounted in the DOM');
	assert.match(dayOptions, /<PopoverTrigger asChild>/, 'disclosure stays on the @/ui Popover trigger');
	// Neither surface may remain a direct header child: strip the region and
	// the drift line must be gone from the remainder.
	// SUPERSEDED (A2 c14 follow-ups, 2026-09-29, same authority as the two pins
	// above): this strip named `timetable-simple-status-region`, which the header
	// budget replaced with `timetable-simple-status-band`. Run verbatim it is now
	// a NO-OP strip — the pattern matches nothing, so `withoutRegion` equals
	// `markup` and the drift control below would pass on a header that rendered
	// BOTH a band and a second sibling drift strip. That is the "sibling drift
	// strip may remain" defect, and the old pin can no longer catch it. Original
	// retained:
	//
	//   const withoutRegion = markup.replace(
	//   	/<section[^>]*data-testid="timetable-simple-status-region"[^>]*>[\s\S]*?<\/section>/,
	//   	'',
	//   );
	//   assert.doesNotMatch(withoutRegion, /timetable-simple-input-drift/, 'no sibling drift strip may remain');
	//   assert.doesNotMatch(withoutRegion, /timetable-hidden-row-controls/, 'no sibling hidden-row strip may remain');
	//
	// C01R C3R2 (replacement) — placement, decided by offset rather than by a
	// nested-tag regex, because the two surfaces are SIBLINGS and the superseded
	// regexes both assumed ancestry. The real shape (A2 C12 + C11 S2 item 2):
	//   row 1 = title/tabs/status chip/primary/More
	//   row 2 = the change notice, then the pickers
	//   then   = `SimpleHeaderTrailingSurfaces`, which owns the status band, as a
	//           SIBLING of the two-row band and not a child of the header box.
	// A `<\/section>`-terminated strip cannot decide this: the band is a `div`,
	// and a lazy close would stop on a nested element, so a stale pin here would
	// silently become a no-op that always passes.
	const row1At = markup.indexOf('data-testid="timetable-simple-header-row-1"');
	const row2At = markup.indexOf('data-testid="timetable-simple-header-row-2"');
	const driftAt = markup.indexOf('data-testid="timetable-simple-input-drift"');
	const bandAt = markup.indexOf('data-testid="timetable-simple-status-band"');
	assert.ok(row1At >= 0 && row2At > row1At, 'the two-row band is row 1 then row 2');
	assert.ok(driftAt > row2At, 'the drift notice renders inside the row-2 band');
	// The status band is its own trailing surface, NOT an ancestor of the notice.
	assert.ok(bandAt > driftAt, 'the status band is a trailing sibling, not a container of the drift notice');
	// …and there is exactly one of each, so a second sibling strip cannot creep in.
	assert.equal((markup.match(/data-testid="timetable-simple-input-drift"/g) ?? []).length, 1, 'exactly one drift notice renders');
	assert.equal((markup.match(/data-testid="timetable-hidden-row-controls"/g) ?? []).length, 0, 'no sibling hidden-row strip joins the header');
	// C5 — the two mutually exclusive NEXT STEP task-prompt blocks collapsed into
	// the single lifecycle action control (this state's publish-slot primary).
	assert.equal((header.match(/data-testid="timetable-simple-task-prompt"/g) ?? []).length, 0, 'the NEXT STEP band collapses into the one action control');
	assert.match(markup, /data-testid="timetable-simple-publish-action"/, 'the one next-step action control still renders');
	// A3 — the setup-input repairs are relocated to the setup sub-page; the
	// header keeps one labelled way there.
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): assert.match(markup, /data-testid="timetable-simple-review-setup"/, 'one labelled setup entry point remains');
	// The one labelled setup entry point moved into More ▸ Schedule actions.
	const actions = source('src/components/timetable/simple/SimpleHeaderActions.tsx');
	assert.match(actions, /<Link to="\/timetable\/setup"[^>]*data-testid="timetable-simple-review-setup"/, 'one labelled setup entry point remains (in More)');
	assert.doesNotMatch(markup, /timetable-simple-sync-setup/, 'Sync with setup is not a header control');
	// SUPERSEDED (A2 c14 follow-ups, 2026-09-29, authority: A2 C11 S2 item 2,
	// already on main). This pin was MASKED behind the earlier failing assertion
	// in this same row, so the row had been reporting the first failure only and
	// this one had never been exercised. It is recorded here rather than left to
	// be rediscovered. `timetable-simple-impact-preview` is the "See what
	// changed" SECONDARY of the header change notice, and one secondary is
	// exactly what C11 S2 specifies for that row ("ONE sentence, ONE primary
	// action, one secondary"). It was not a header control when this pin was
	// written because the header had no change notice of its own to give it to.
	// The property the pin protects — the header must not collect a sprawl of
	// detail controls — is re-asserted below as a COUNT, which is what actually
	// fails when a second one is added. Original retained:
	//
	//   assert.doesNotMatch(markup, /timetable-simple-impact-preview/, 'Preview impact is not a header control');
	//
	// C01R C3R3 (replacement) — the C11 S2 shape, in rendered markup: one notice,
	// one secondary, at most one primary. The secondary and the primary are each
	// counted so a second detail button fails this row, which the superseded
	// doesNotMatch could not do once one legitimate secondary existed. The
	// primary is bounded at AT MOST one and not exactly one, because
	// `SimpleDriftBanner` mounts the apply action only when regeneration is
	// actually offered for this run — a notice with no primary is the correct
	// rendering, and pinning it to 1 would have demanded an inert control.
	assert.equal((markup.match(/data-testid="timetable-simple-impact-preview"/g) ?? []).length, 1, 'the change notice carries exactly one secondary detail control');
	assert.ok((markup.match(/data-testid="timetable-simple-regenerate-to-apply"/g) ?? []).length <= 1, 'the change notice carries at most one primary action');
	assert.equal((markup.match(/data-testid="timetable-simple-input-drift"/g) ?? []).length, 1, 'and exactly one change notice, so the counts above are not split across two of them');
	// Simple keeps the status and schedule chooser, without grid-refinement controls.
	assert.doesNotMatch(markup, /timetable-filters-trigger|timetable-active-filters/);
	assert.match(markup, /data-testid="timetable-simple-readiness-chip"/);
});

/* ── D3 — one primary action per state ───────────────────────────────────── */

test('C01R D3 the no-run state renders exactly one filled primary', () => {
	// No draft and no pre-generation workspace: the "Get started" NEXT STEP state.
	const markup = renderHeader({ draft: null, isPreGenerationWorkspace: false });
	assert.match(markup, /data-testid="timetable-simple-generate-action"/, 'Generate stays reachable without opening More');
	const solid = solidActionButtons(markup);
	assert.equal(solid.length, 1, `the no-run state must render exactly one filled primary, found ${solid.length}`);
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): assert.match(markup, /data-testid="timetable-simple-primary-action"/);
	// With no generated run, Generate IS the one filled primary.
	assert.match(solid[0], /data-testid="timetable-simple-generate-action"/);
});

test('C01R C1 the publish-ready state renders one solid publish control and no second primary', () => {
	const markup = renderHeader(CLEAN_UNPUBLISHED);
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): assert.match(markup, /data-testid="timetable-simple-generate-action"/, 'Generate stays reachable without opening More');
	// Once a run exists Publish owns the primary slot and Generate moves into More.
	assert.doesNotMatch(markup, /data-testid="timetable-simple-generate-action"/, 'Generate is a More entry once a run exists');
	assert.match(source('src/components/timetable/simple/SimpleHeaderActions.tsx'), /data-testid="timetable-more-generate"/);
	const publish = markup.match(new RegExp('<[^>]*data-testid="timetable-simple-publish-action"[^>]*>'));
	assert.ok(publish, 'the dedicated publish control must render');
	assert.match(publish[0], /bg-primary/, 'the publish-slot owner is the filled primary');
	assert.match(publish[0], /aria-label="Publish schedule"/, 'gating and aria-label are unchanged');
	assert.equal(
		markup.includes('data-testid="timetable-simple-primary-action"'),
		false,
		'no second publish primary may render beside the dedicated control',
	);
	assert.equal(solidActionButtons(markup).length, 1, 'exactly one filled action in the publish-ready state');
});

test('C01R C1 an issue state renders the lifecycle primary solid with publish secondary', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 1, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
		hardCount: 1,
		blockingHardCount: 1,
		summary: { assignedCount: 5, classesProcessed: 5, hardViolationCount: 1, unassignedCount: 0 },
	});
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the lifecycle primary
	// ("Fix blockers" / "Review warnings") merged into the warnings control, and
	// Publish is the one primary once a run exists.
	// assert.match(markup, /data-testid="timetable-simple-primary-action"/, 'the next step keeps its primary affordance');
	// assert.doesNotMatch(publish[0], /bg-primary/, 'away from the publish slot it is secondary/outline');
	const warnings = markup.match(new RegExp('<[^>]*data-testid="timetable-simple-warnings-control"[^>]*>'));
	assert.ok(warnings, 'the next step keeps its affordance on the merged warnings control');
	assert.match(warnings[0], /data-warnings-dispatch="readiness-sheet"/, 'blockers open the readiness sheet, as Fix blockers did');
	// SUPERSEDED IN PART (A2 C13, operator 2026-09-29) — the filled count, and only
	// the filled count. The ORIGINAL row read, verbatim:
	//     assert.equal(solidActionButtons(markup).length, 1, 'exactly one filled action in the issue state');
	// This fixture sets `hardCount: 1` / `blockingHardCount: 1`, so Publish is
	// DISABLED. Its count of 1 was satisfied by that disabled control wearing
	// `variant="default"` — a solid `bg-primary` at the shared base's
	// `disabled:opacity-50`, which reads as a pale-green "nearly ready" primary.
	// That is the pin this candidate removes, so the count is corrected to 0 and the
	// replacement below keeps the row's real property: the issue state still offers
	// its next step, and nothing that cannot act looks like it can.
	// NOT deleted (AGENTS.md §16).
	assert.equal(solidActionButtons(markup).length, 0, 'no FILLED action in the issue state — a blocked control is not a primary');
	const publish = markup.match(new RegExp('<[^>]*data-testid="timetable-simple-publish-action"[^>]*>'));
	assert.ok(publish, 'the publish control stays reachable');
	// THE REPLACEMENT for the superseded count.
	assert.doesNotMatch(publish[0], /\bbg-primary\b/, 'the blocked publish control is not a filled primary');
	assert.match(publish[0], /\bbg-muted\b/, 'it wears the plainly-unavailable treatment');
	assert.match(markup, /data-testid="timetable-simple-publish-short-reason"/,
		'and the reason it cannot act is visible beside it, not hover-only');
});

test('C01R D3 a published run renders no solid action and the primary dispatches (no chevron menu)', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: true }),
		blockingHardCount: 0,
	});
	assert.match(markup, /data-testid="timetable-simple-published-state"/);
	assert.equal(solidActionButtons(markup).length, 0, 'a published run has no action to take, so no solid control may render');
	assert.equal(markup.includes('data-testid="timetable-simple-publish-action"'), false, 'no publish control may render on a published run');
	// The primary action button dispatches; it never carries the false menu affordance.
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the lifecycle primary
	// blocks are gone from the header (`timetable-simple-primary-action`); the
	// visible primary is Generate / Publish, neither of which renders a chevron.
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.doesNotMatch(header, /data-testid="timetable-simple-primary-action"/);
	assert.doesNotMatch(source('src/components/timetable/simple/SimpleHeaderActions.tsx'), /ChevronDown/, 'no moved action renders a menu chevron');
	// A chevron survives only where a control genuinely opens a menu/sheet.
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(helpers, /data-testid="timetable-simple-schedule-sheet-trigger"/);
});

test('C01R D3 the full-day toggle is secondary and announces its pressed state', () => {
	// The toggle lives in the portal-mounted Day options panel
	// (`simple/SimpleDayOptions`), so its shape is pinned at that source:
	// secondary variant with a pressed binding.
	const dayOptions = source('src/components/timetable/simple/SimpleDayOptions.tsx');
	const anchor = dayOptions.indexOf('data-testid="timetable-show-full-day-toggle"');
	assert.ok(anchor >= 0, 'the full-day toggle must stay wired');
	const buttonStart = dayOptions.lastIndexOf('<Button', anchor);
	const block = dayOptions.slice(buttonStart, anchor);
	assert.match(block, /variant="outline"/, 'the toggle must stay secondary so the primary stays sole');
	assert.match(block, /aria-pressed=\{showFullDay\}/, 'the toggle state stays announced without the solid fill');
	assert.doesNotMatch(block, /bg-primary/);
	// A3 — the disclosure that carries it moved out of the header row into More.
	const markup = renderHeader({
		...CLEAN_UNPUBLISHED,
		policyAlignmentWarning: 'Two earlier rows are hidden by the current start-time policy.',
		hiddenRowCount: 2,
		showFullDay: true,
	});
	assert.doesNotMatch(markup, /data-testid="timetable-day-options-trigger"/, 'Day options is not a header control');
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /hiddenRowCount=\{context\.hiddenRowCount\}/, 'the More menu passes the hidden-row count into the shared controls');
	assert.match(menu, /data-testid="timetable-more-day-options"/);
});

/* ── D4 — cell density (F-07) ────────────────────────────────────────────── */

test('C01R C2 the grade-dedupe helper drops the repeated building grade once (real surface strings)', () => {
	// Packet F-07 as corrected: roomLabelShort is `{room.name} · {buildingShortCode}`.
	assert.equal(dedupeCellGradeRepetition('G7 Room 103 · G7AW'), 'Room 103 · G7AW');
	assert.equal(dedupeCellGradeRepetition('Room 103 · MAIN'), 'Room 103 · MAIN');
	assert.equal(dedupeCellGradeRepetition('G7 Room 101 · G7'), 'Room 101 · G7');
	assert.equal(dedupeCellGradeRepetition('Room 101'), 'Room 101');
	assert.equal(dedupeCellGradeRepetition('Room #9'), 'Room #9');
	assert.equal(dedupeCellGradeRepetition('G10 Room 5 · G10'), 'Room 5 · G10');
});

function renderGrid(viewMode: 'section' | 'faculty', roomShort: string, teacherInitials: string): string {
	const entry = {
		entryId: 'term1-entry',
		sectionId: 701,
		facultyId: 9,
		roomId: 9,
		subjectId: 1,
		day: 'MONDAY',
		startTime: '11:30',
		endTime: '12:15',
		durationMinutes: 45,
		termIndex: 1,
	} as unknown as ScheduledEntry;
	return renderToStaticMarkup(createElement(TimetableGrid, {
		entries: [entry],
		timeSlots: [{ startTime: '11:30', endTime: '12:15' }],
		violationIndex: new Map(),
		highlightedEntryIds: new Set<string>(),
		selectedEntry: null,
		followUps: new Set<string>(),
		onEntryClick: () => {},
		subjectLabel: (id: number) => (id === 1 ? 'FIL' : `Subject ${id}`),
		sectionLabel: () => 'G7AW',
		gradeForSection: () => 7,
		entryContextLabel: () => 'G7AW',
		formatFacultyInitials: () => teacherInitials,
		facultyLabel: (id: number) => `Faculty ${id}`,
		viewMode,
		termFilter: 1 as const,
		pivotLabel: () => '',
		roomLabelShort: () => roomShort,
		kbSelectedSource: null,
		onKbPlace: () => {},
		getCellConflict: () => null,
		getLiveCellConflict: () => null,
		onNavToFaculty: () => {},
		onNavToSection: () => {},
		onNavToRoom: () => {},
	}));
}

function cellDetailText(markup: string): string {
	const detail = markup.match(new RegExp('<p[^>]*data-testid="timetable-cell-detail"[^>]*>([^<]*)</p>'));
	assert.ok(detail, 'the cell detail must render');
	return detail[1];
}

test('C01R C2 the rendered section-pivot cell reads the cited string without the repeated grade', () => {
	// Packet F-07: the live section cell reads `P. CRUZ · G7 Room 103 · G7AW`.
	const markup = renderGrid('section', 'G7 Room 103 · G7AW', 'P. CRUZ');
	assert.equal(cellDetailText(markup), 'P. CRUZ · Room 103 · G7AW');
	assert.match(markup, /data-cell-teacher="P\. CRUZ"/, 'cell data attributes are unchanged');
	// The full un-deduped string stays available through a @/ui Tooltip, not a title.
	const grid = source('src/components/timetable/TimetableGrid.tsx');
	assert.match(grid, /dedupeCellGradeRepetition\(roomText\)/);
	assert.match(grid, /<TooltipContent[^>]*data-testid="timetable-cell-detail-full"/);
	assert.doesNotMatch(grid, /title=/);
});

test('C01R C2 the rendered faculty cell drops the repeated grade with the full string behind a Tooltip', () => {
	const markup = renderGrid('faculty', 'G7 Room 101 · G7', 'C. AGUILAR');
	const text = cellDetailText(markup);
	assert.match(text, /Room 101/, 'the room renders without its repeated grade prefix');
	assert.doesNotMatch(text, /G7 Room/, 'the F-07 grade repetition is gone from the visible cell');
	assert.match(text, /G7AW/, 'the section code is kept');
});

/* ── D5 — page heading ───────────────────────────────────────────────────── */

test('C01R D5 every timetable surface renders one visible h1 naming the surface', () => {
	for (const [path, heading] of [
		['/timetable', 'Class Schedule'],
		['/timetable/setup', 'Setup'],
		['/timetable/policies', 'Scheduling Policy'],
		['/timetable/runs', 'Runs'],
		['/timetable/exports', 'Download schedules'],
	] as Array<[string, string]>) {
		const markup = renderSubNav(path);
		const h1 = markup.match(new RegExp('<h1[^>]*>([^<]*)</h1>'));
		assert.ok(h1, `an h1 must render on ${path}`);
		assert.equal(h1[1], heading, `${path} names its surface`);
		assert.equal((markup.match(/<h1/g) ?? []).length, 1, 'exactly one h1 per surface');
	}
	// The heading reuses the shared route-chrome titles, not a forked copy.
	const nav = source('src/components/timetable/TimetableSubNav.tsx');
	assert.match(nav, /resolveRouteChrome/);
});

/* ── Boundaries that must survive ────────────────────────────────────────── */

test('C01R boundaries: scope hygiene, term identity, actor scope, and the strict predicate survive', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /flex flex-col h-\[calc\(100svh-3\.5rem\)\]/, 'the no-scroll root survives');
	assert.match(workspace, /buildScopeKey|clearScopeState/, 'scope hygiene survives');
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /isRunPublishedStrict/, 'the strict publication predicate survives');
	assert.match(header, /<SimpleGenerateAction/);
	assert.match(header, /<SimplePublishedState|<SimplePublishAction/);
	assert.doesNotMatch(header, /SimpleFilterControls|SimpleActiveFilterChips/);
	assert.match(header, /resetSimpleWorkspaceFilters\(context\)/);
	assert.match(header, /<SimpleReadinessChip/);
	// A3 — the status key left the header row; one STATUS_ITEMS source now feeds
	// the More menu.
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /STATUS_ITEMS/, 'the More menu renders the shared status key');
	assert.doesNotMatch(header, /<TimetableStatusLegend compact \/>/, 'the status key is not a header control');
	// SUPERSEDED (A2 c14 follow-ups, 2026-09-29, authority: A2 C11 S2, already on
	// main as ac77bd594). The header no longer renders `<SimpleDriftBanner>`
	// inline; it asks the ONE shared gate for a notice node and mounts what comes
	// back, so the banner MARKUP moved into
	// `simple/SimpleHeaderChangeNoticeSlot.tsx`. This is a stale pin after a
	// legitimate refactor, not a removed behaviour: the banner still renders in
	// the Simple header, which the rendered C01R C3R row above now proves from
	// markup. This exact re-pin was already applied to
	// `timetable-scheduler-simplicity-c02.test.ts` on 2026-09-28 and this file
	// was simply missed. Original retained:
	//
	//   assert.match(header, /<SimpleDriftBanner/);
	//
	// C01R boundaries-R (replacement) — the two halves that can break
	// independently, so dropping either pin cannot let this row pass on a header
	// that shows no drift warning at all (the failure it exists to catch).
	const noticeSlot = source('src/components/timetable/simple/SimpleHeaderChangeNoticeSlot.tsx');
	assert.match(noticeSlot, /<SimpleDriftBanner/, 'the shared gate MOUNTS the drift banner (a silent slot is a silent header)');
	assert.match(header, /const changeNotice = useRunChangeNotice\(/, 'the header derives the notice through that one shared gate');
	assert.match(header, /\{changeNotice\.node\}/, 'and MOUNTS the node it returns — the warning is on screen, not derived and dropped');
});
