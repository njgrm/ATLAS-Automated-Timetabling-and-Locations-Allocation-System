/**
 * UX-AUDIT-FINDINGS-C01 — class-schedule UX audit findings 3, 4, 6, 7 with 2/9
 * re-verified. Static-markup and source-contract controls (the interaction
 * proof for F3 hover/focus and F6 published read-only lives in the sibling
 * `ux-audit-findings-c01-dom.test.tsx`).
 *
 * Fixed surface: Simple timetable header + shared timetable grid.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { TimetableGrid } from '../TimetableGrid';
import { TimetableSimpleHeader } from '../TimetableSimpleHeader';
import type { ScheduleReviewWorkspaceHeaderContext } from '../buildScheduleReviewWorkspaceContexts';
import type { DraftReport, ScheduledEntry, Violation } from '@/types';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

/* ── shared fixtures ─────────────────────────────────────────────────────── */

function entryFor(entryId: string, termIndex: number): ScheduledEntry {
	return {
		entryId,
		sectionId: 701,
		facultyId: 9,
		roomId: 9,
		subjectId: 1,
		day: 'MONDAY',
		startTime: '11:30',
		endTime: '12:15',
		durationMinutes: 45,
		termIndex,
	} as unknown as ScheduledEntry;
}

function renderGrid(entries: ScheduledEntry[], violationIndex: Map<string, Violation[]>, reviewEntryIds?: ReadonlySet<string>): string {
	return renderToStaticMarkup(createElement(TimetableGrid, {
		entries,
		timeSlots: [{ startTime: '11:30', endTime: '12:15' }],
		violationIndex,
		highlightedEntryIds: new Set<string>(),
		selectedEntry: null,
		followUps: new Set<string>(),
		onEntryClick: () => {},
		subjectLabel: () => 'TLE',
		sectionLabel: () => 'G7AW',
		gradeForSection: () => 7,
		entryContextLabel: () => 'G7AW',
		formatFacultyInitials: () => 'P. CRUZ',
		facultyLabel: () => 'P. CRUZ',
		viewMode: 'section',
		termFilter: 1,
		reviewEntryIds,
		pivotLabel: () => '',
		roomLabelShort: () => 'Room 103 · G7AW',
		kbSelectedSource: null,
		onKbPlace: () => {},
		getCellConflict: () => null,
		getLiveCellConflict: () => null,
		onNavToFaculty: () => {},
		onNavToSection: () => {},
		onNavToRoom: () => {},
	}));
}

function draftWithSummary(summary: Record<string, unknown>): DraftReport {
	return {
		runId: 42,
		status: 'COMPLETED',
		entries: [],
		unassignedItems: [],
		summary: summary as unknown as DraftReport['summary'],
		version: 3,
		finishedAt: null,
		createdAt: '2031-01-01T00:00:00.000Z',
	} as unknown as DraftReport;
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

function renderHeader(overrides: Record<string, unknown> = {}, layoutMode: 'simple' | 'advanced' = 'simple'): string {
	return renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(TimetableSimpleHeader, {
				context: makeContext(overrides),
				layoutMode,
				onLayoutModeChange: () => {},
				activeTask: null,
				onTaskChange: () => {},
			}),
		),
	);
}

const CLEAN_DRAFT = {
	draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
	blockingHardCount: 0,
};
const PUBLISHED = {
	draft: draftWithSummary({ runId: 317, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: true }),
	blockingHardCount: 0,
};

/* ── F3 — every per-entry warning glyph is named and explained ───────────── */

const softViolation = {
	code: 'TEACHER_OVERLOAD_SOFT',
	severity: 'SOFT',
	message: 'Teacher is close to the load limit',
} as unknown as Violation;

test('F3: the SOFT warning indicator carries a truthful accessible name', () => {
	const index = new Map<string, Violation[]>([['e-soft', [softViolation]]]);
	const markup = renderGrid([entryFor('e-soft', 1)], index, new Set(['e-soft']));
	const tag = markup.match(/<span[^>]*data-testid="timetable-entry-severity-indicator"[^>]*>/)?.[0] ?? '';
	assert.ok(tag, 'the per-entry severity indicator must render');
	assert.match(tag, /role="img"/);
	assert.match(tag, /aria-label="Warning: Teacher is close to the load limit"/, 'the indicator names the real warning');
});

test('F3: no bare, unlabelled entry warning glyph remains in the grid', () => {
	const grid = source('src/components/timetable/TimetableGrid.tsx');
	// The bare severity icons moved into the labelled indicator component.
	assert.doesNotMatch(grid, /<AlertTriangle/, 'no bare warning triangle may remain in the grid');
	assert.doesNotMatch(grid, /<AlertCircle className="size-3\.5 shrink-0 text-red-500" \/>/, 'no bare hard-conflict icon may remain');
	assert.match(grid, /<EntrySeverityIndicator severity=\{severity\} reasons=\{severityReasons\} \/>/);
	// The remaining conflict/follow-up glyphs are named too.
	assert.match(grid, /role="img" aria-label="Sandbox conflict"/);
	assert.match(grid, /role="img" aria-label="Marked for follow-up"/);
});

test('F3: the explanation uses the @/ui Tooltip primitive, never a native title or details', () => {
	const badge = source('src/components/timetable/TimetableGridConflictBadge.tsx');
	assert.match(badge, /EntrySeverityIndicator/);
	assert.match(badge, /<TooltipContent[\s\S]*?\{heading\}/, 'the indicator discloses the reasons through @/ui Tooltip');
	const code = badge.replace(/\/\*[\s\S]*?\*\//g, '');
	assert.doesNotMatch(code, /\btitle=/, 'no native title attribute');
	assert.doesNotMatch(code, /<details/, 'no native details disclosure');
});

/* ── F4 — legible grid typography, no-scroll preserved ───────────────────── */

test('F4: time, subject, and teacher/room line render at 14px (text-sm)', () => {
	const markup = renderGrid([entryFor('e-1', 1)], new Map());
	assert.match(markup, /<table[^>]*class="[^"]*text-sm/, 'the grid table base is 14px');
	assert.match(markup, /<td class="px-2 py-1\.5 text-muted-foreground whitespace-nowrap font-mono text-sm align-top">/, 'the time label is 14px');
	assert.match(markup, /font-semibold text-sm truncate/, 'the entry subject line is 14px');
	assert.match(markup, /truncate text-sm font-medium text-muted-foreground\/80/, 'the teacher/room line is 14px');
});

test('F4: the 9.6px flags are raised to a legible size', () => {
	const grid = source('src/components/timetable/TimetableGrid.tsx');
	assert.doesNotMatch(grid, /text-\[0\.6rem\]/, 'the 9.6px ceremony/placement flags are gone');
	assert.doesNotMatch(grid, /text-\[0\.65rem\]/, 'the 10.4px hidden-cell flag is gone');
	assert.doesNotMatch(grid, /text-\[0\.\d+rem\]/, 'no sub-12px arbitrary rem size remains in the grid');
});

test('F4: the no-scroll architecture is preserved (scroll only inside the grid region)', () => {
	const grid = source('src/components/timetable/TimetableGrid.tsx');
	assert.match(grid, /<div ref=\{setNodeRef\} className="overflow-auto scrollbar-thin"/, 'the grid keeps its inner scroll region');
	assert.doesNotMatch(grid, /overflow-(x|y)-scroll/, 'the grid never opts into a global scrollbar');
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	assert.match(center, /className="flex-1 min-h-0"/, 'the grid wrapper remains flex-1 min-h-0');
});

/* ── F6 — published read-only, draft editable (source contract) ──────────── */

test('F6: the grid drives read-only from publication state, not CSS', () => {
	const grid = source('src/components/timetable/TimetableGrid.tsx');
	assert.match(grid, /useTimetableEntryReadOnly\(\)/, 'the grid subscribes to the publication signal');
	assert.match(grid, /readOnly=\{readOnly\}/, 'the read-only state reaches each entry');
	const entry = source('src/components/timetable/TimetableDraggableEntry.tsx');
	assert.match(entry, /disabled: readOnly/, 'dnd-kit dragging is disabled when read-only');
	assert.match(entry, /data-read-only="true"/, 'the read-only entry is marked');
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /setTimetableEntryReadOnly\(isRunPublished\)/, 'the header publishes its isRunPublished state to the grid');
});

/* ── F7 — the four daily tasks are labelled header actions ───────────────── */

test('F7: all four daily tasks render as labelled header controls without opening More', () => {
	const markup = renderHeader(CLEAN_DRAFT);
	assert.match(markup, /data-testid="timetable-simple-daily-tasks"/);
	for (const id of [
		'timetable-header-place-unresolved',
		'timetable-header-swap-sessions',
		'timetable-header-teacher-departure',
		'timetable-header-review-requests',
	]) {
		assert.ok(markup.includes(id), `${id} must be reachable in the header`);
	}
	assert.match(markup, /Place unresolved/);
	assert.match(markup, /Swap sessions/);
	assert.match(markup, /Teacher leaving/);
	assert.match(markup, /Room requests/);
	// They are NOT behind the (closed) More menu in this render.
	assert.doesNotMatch(markup, /data-testid="timetable-more-place-unresolved"/);
	assert.doesNotMatch(markup, /data-testid="timetable-more-swap-sessions"/);
});

test('F7: the daily header actions mirror the More enablement rules', () => {
	const markup = renderHeader(CLEAN_DRAFT);
	const place = markup.match(/<button[^>]*data-testid="timetable-header-place-unresolved"[^>]*>/)?.[0] ?? '';
	const swap = markup.match(/<button[^>]*data-testid="timetable-header-swap-sessions"[^>]*>/)?.[0] ?? '';
	const departure = markup.match(/<button[^>]*data-testid="timetable-header-teacher-departure"[^>]*>/)?.[0] ?? '';
	const requests = markup.match(/<button[^>]*data-testid="timetable-header-review-requests"[^>]*>/)?.[0] ?? '';
	assert.doesNotMatch(place, /disabled=""/, 'a generated run enables Place unresolved');
	assert.doesNotMatch(swap, /disabled=""/, 'a generated run enables Swap sessions');
	assert.doesNotMatch(departure, /disabled=""/, 'a generated run enables Teacher leaving');
	assert.match(requests, /disabled=""/, 'zero pending requests disables Review room requests');

	const withRequests = renderHeader({ ...CLEAN_DRAFT, requestPendingCount: 3 });
	const enabled = withRequests.match(/<button[^>]*data-testid="timetable-header-review-requests"[^>]*>/)?.[0] ?? '';
	assert.doesNotMatch(enabled, /disabled=""/, 'pending requests enable Review room requests');
	assert.match(withRequests, /Room requests \(3\)/);
});

test('F7: the expert tools stay under More', () => {
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /data-testid="timetable-simple-more-expert-tools"/);
	assert.match(menu, /Review issues/);
	assert.match(menu, /Advanced rules/);
	assert.match(menu, /Expert view/);
});

/* ── F2 / F9 — re-verify only, no change ─────────────────────────────────── */

test('F2 re-verify: a published run offers "New version", never a destructive "Generate"', () => {
	const markup = renderHeader(PUBLISHED);
	assert.match(markup, /New version/);
	assert.equal(markup.includes('Generate schedule'), false, 'no destructive Generate label on a published run');
	assert.equal(markup.includes('Publish schedule'), false, 'no publish affordance on a published run');
});

test('F9 re-verify: the standalone Term control is intact', () => {
	const markup = renderHeader(CLEAN_DRAFT);
	assert.match(markup, /data-testid="timetable-simple-term-filter"/);
	assert.match(markup, /aria-label="Term"/);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /<SimpleTermSwitcher context=\{context\} \/>/, 'the standalone term switcher is unchanged');
});

/* ── B5 — touched component files stay inside the 1000-physical-line cap ─── */

test('B5 cap guard: every component file this change touched stays inside 1000 physical lines', () => {
	const touched = [
		'src/components/timetable/TimetableGrid.tsx',
		'src/components/timetable/TimetableDraggableEntry.tsx',
		'src/components/timetable/TimetableGridConflictBadge.tsx',
		'src/components/timetable/TimetableSimpleHeader.tsx',
		'src/components/timetable/simple/SimpleMoreMenuContent.tsx',
	];
	for (const path of touched) {
		const physical = source(path).replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length;
		assert.ok(physical <= 1000, `${path} is ${physical} physical lines (cap 1000)`);
	}
});
