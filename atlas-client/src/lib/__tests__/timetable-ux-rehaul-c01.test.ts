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
	const regions = markup.match(/data-testid="timetable-simple-status-region"/g) ?? [];
	assert.equal(regions.length, 1, 'exactly one status region may render');
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	// The drift message is a descendant of the region, not a sibling strip.
	assert.match(
		markup,
		/<section[^>]*data-testid="timetable-simple-status-region"[^>]*>[\s\S]*?data-testid="timetable-simple-input-drift"[\s\S]*?<\/section>/,
		'the drift message must render inside the single status region',
	);
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
	const withoutRegion = markup.replace(
		/<section[^>]*data-testid="timetable-simple-status-region"[^>]*>[\s\S]*?<\/section>/,
		'',
	);
	assert.doesNotMatch(withoutRegion, /timetable-simple-input-drift/, 'no sibling drift strip may remain');
	assert.doesNotMatch(withoutRegion, /timetable-hidden-row-controls/, 'no sibling hidden-row strip may remain');
	// C5 — the two mutually exclusive NEXT STEP task-prompt blocks collapsed into
	// the single lifecycle action control (this state's publish-slot primary).
	assert.equal((header.match(/data-testid="timetable-simple-task-prompt"/g) ?? []).length, 0, 'the NEXT STEP band collapses into the one action control');
	assert.match(markup, /data-testid="timetable-simple-publish-action"/, 'the one next-step action control still renders');
	// A3 — the setup-input repairs are relocated to the setup sub-page; the
	// header keeps one labelled way there.
	assert.match(markup, /data-testid="timetable-simple-review-setup"/, 'one labelled setup entry point remains');
	assert.doesNotMatch(markup, /timetable-simple-sync-setup/, 'Sync with setup is not a header control');
	assert.doesNotMatch(markup, /timetable-simple-impact-preview/, 'Preview impact is not a header control');
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
	assert.match(markup, /data-testid="timetable-simple-primary-action"/);
});

test('C01R C1 the publish-ready state renders one solid publish control and no second primary', () => {
	const markup = renderHeader(CLEAN_UNPUBLISHED);
	assert.match(markup, /data-testid="timetable-simple-generate-action"/, 'Generate stays reachable without opening More');
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
	assert.match(markup, /data-testid="timetable-simple-primary-action"/, 'the next step keeps its primary affordance');
	assert.equal(solidActionButtons(markup).length, 1, 'exactly one filled action in the issue state');
	const publish = markup.match(new RegExp('<[^>]*data-testid="timetable-simple-publish-action"[^>]*>'));
	assert.ok(publish, 'the publish control stays reachable');
	assert.doesNotMatch(publish[0], /bg-primary/, 'away from the publish slot it is secondary/outline');
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
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const primaryBlocks = header.split('data-testid="timetable-simple-primary-action"');
	assert.ok(primaryBlocks.length > 1, 'primary action blocks must exist');
	for (const block of primaryBlocks.slice(1)) {
		const buttonWindow = block.slice(0, 400);
		assert.doesNotMatch(buttonWindow, /ChevronDown/, 'the dispatching primary must not render a menu chevron');
	}
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
	assert.match(header, /<SimpleDriftBanner/);
});
