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

test('C01R D1 the sub-nav renders on the index with all five timetable links', () => {
	const markup = renderSubNav('/timetable');
	assert.match(markup, /data-testid="timetable-sub-nav"/);
	for (const [key, href] of [
		['schedule', '/timetable'],
		['setup', '/timetable/setup'],
		['policies', '/timetable/policies'],
		['runs', '/timetable/runs'],
		['exports', '/timetable/exports'],
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

/* ── D2 — one status region ──────────────────────────────────────────────── */

test('C01R D2 the header exposes exactly one status region owning every status surface', () => {
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
	const regionAt = markup.indexOf('data-testid="timetable-simple-status-region"');
	for (const testId of [
		'timetable-simple-input-drift',
		'timetable-hidden-row-controls',
		'timetable-simple-task-prompt',
		'timetable-simple-readiness-chip',
	]) {
		const at = markup.indexOf(`data-testid="${testId}"`);
		assert.ok(at > regionAt, `${testId} must render inside the single status region`);
	}
	// Both mutually exclusive NEXT STEP states are still the region's two blocks.
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.equal((header.match(/data-testid="timetable-simple-task-prompt"/g) ?? []).length, 2, 'the two task-prompt states must be kept, not collapsed');
	// Drift repairs and the hidden-row controls stay reachable from the region.
	assert.match(markup, /timetable-simple-sync-setup/, 'Sync with setup stays reachable');
	assert.match(markup, /timetable-simple-impact-preview/, 'Preview impact stays reachable');
	assert.match(markup, /timetable-show-full-day-toggle/, 'Show full day stays reachable');
	assert.match(markup, /timetable-hidden-rows-chip/, 'the hidden-row chip stays reachable');
	// The single required filter/readiness controls survive the consolidation.
	assert.match(markup, /data-testid="timetable-filters-trigger"/);
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

test('C01R D3 the has-run state renders exactly one filled primary (publish is secondary)', () => {
	const markup = renderHeader(CLEAN_UNPUBLISHED);
	assert.match(markup, /data-testid="timetable-simple-publish-action"/, 'Publish stays reachable without opening More');
	const publish = markup.match(new RegExp('<[^>]*data-testid="timetable-simple-publish-action"[^>]*>'));
	assert.ok(publish, 'the publish control must render');
	assert.doesNotMatch(publish[0], /bg-primary/, 'an enabled Publish must be secondary/outline, never a second solid primary');
	const solid = solidActionButtons(markup);
	assert.equal(solid.length, 1, `the has-run state must render exactly one filled primary, found ${solid.length}`);
});

test('C01R D3 a published run renders no solid action and the primary dispatches (no chevron menu)', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: true }),
		blockingHardCount: 0,
	});
	assert.match(markup, /data-testid="timetable-simple-published-state"/);
	assert.equal(solidActionButtons(markup).length, 0, 'a published run has no action to take, so no solid control may render');
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
	const markup = renderHeader({
		...CLEAN_UNPUBLISHED,
		policyAlignmentWarning: 'Two earlier rows are hidden by the current start-time policy.',
		hiddenRowCount: 2,
		showFullDay: true,
	});
	const toggle = markup.match(new RegExp('<[^>]*data-testid="timetable-show-full-day-toggle"[^>]*>'));
	assert.ok(toggle, 'the full-day toggle must render');
	assert.doesNotMatch(toggle[0], /bg-primary/, 'the active toggle must stay secondary so the primary stays sole');
	assert.match(toggle[0], /aria-pressed="true"/, 'the toggle state stays announced without the solid fill');
});

/* ── D4 — cell density (F-07) ────────────────────────────────────────────── */

test('C01R D4 the grade-dedupe helper keeps the grade exactly once (real surface strings)', () => {
	// Packet §0 F-07: `P. CRUZ · G7 Room 103 · G7AW` repeats the grade.
	assert.equal(dedupeCellGradeRepetition('G7 Room 103', 'G7AW'), 'Room 103');
	// Committed cell-info fixture: the short room label carries the grade twice.
	assert.equal(dedupeCellGradeRepetition('G7 Room 101 · G7', 'G7AW'), 'Room 101');
	// No duplication: untouched. No section grade: untouched (never drop information).
	assert.equal(dedupeCellGradeRepetition('Room 101', 'G7AW'), 'Room 101');
	assert.equal(dedupeCellGradeRepetition('G7 Room 101 · G7', null), 'G7 Room 101 · G7');
	assert.equal(dedupeCellGradeRepetition('Room #9', 'Section #1'), 'Room #9');
	assert.equal(dedupeCellGradeRepetition('G10 Room 5 · G10', 'G10AW'), 'Room 5');
});

function renderFacultyGrid(): string {
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
		formatFacultyInitials: (id: number) => (id === 9 ? 'C. AGUILAR' : `Faculty #${id}`),
		facultyLabel: (id: number) => `Faculty ${id}`,
		viewMode: 'faculty',
		termFilter: 1 as const,
		pivotLabel: () => '',
		roomLabelShort: () => 'G7 Room 101 · G7',
		kbSelectedSource: null,
		onKbPlace: () => {},
		getCellConflict: () => null,
		getLiveCellConflict: () => null,
		onNavToFaculty: () => {},
		onNavToSection: () => {},
		onNavToRoom: () => {},
	}));
}

test('C01R D4 the rendered faculty cell shows the grade once with the full string behind a Tooltip', () => {
	const markup = renderFacultyGrid();
	const detail = markup.match(new RegExp('<p[^>]*data-testid="timetable-cell-detail"[^>]*>([^<]*)</p>'));
	assert.ok(detail, 'the cell detail must render');
	assert.match(detail[1], /Room 101/, 'the room renders without its repeated grade prefix');
	assert.doesNotMatch(detail[1], /G7 Room/, 'the F-07 grade repetition is gone from the visible cell');
	assert.match(detail[1], /G7AW/, 'the section code (the single grade carrier) is kept');
	assert.match(markup, /data-cell-teacher="C\. AGUILAR"/, 'cell data attributes are unchanged');
	// The full un-deduped string stays available through a @/ui Tooltip, not a title.
	const grid = source('src/components/timetable/TimetableGrid.tsx');
	assert.match(grid, /dedupeCellGradeRepetition\(roomText, sectionText\)/);
	assert.match(grid, /<TooltipContent[^>]*data-testid="timetable-cell-detail-full"/);
	assert.doesNotMatch(grid, /title=/);
});

/* ── D5 — page heading ───────────────────────────────────────────────────── */

test('C01R D5 every timetable surface renders one visible h1 naming the surface', () => {
	for (const [path, heading] of [
		['/timetable', 'Class Schedule'],
		['/timetable/setup', 'Setup'],
		['/timetable/policies', 'Scheduling Policy'],
		['/timetable/runs', 'Runs'],
		['/timetable/exports', 'Exports'],
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
	assert.match(header, /<SimpleFilterControls context=\{context\} renderActiveFilters=\{false\} \/>/);
	assert.match(header, /<SimpleActiveFilterChips context=\{context\} \/>/);
	assert.match(header, /<SimpleReadinessChip/);
	assert.match(header, /<TimetableStatusLegend compact \/>/);
	assert.match(header, /<SimpleDriftBanner/);
});
