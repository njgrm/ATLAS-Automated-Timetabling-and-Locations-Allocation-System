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
	// SUPERSEDED (DRAFT-UX-C01 S3, operator 2026-09-25): the sign is named by its severity summary ("1 warning"; "Must fix" for HARD).
	// assert.match(tag, /aria-label="1 warning: 1 Schedule note"/, 'the indicator names the warning count and its non-blocking severity');
	assert.match(tag, /aria-label="1 warning"/, 'the indicator names the warning count and its non-blocking severity');
});

test('F3: no bare, unlabelled entry warning glyph remains in the grid', () => {
	const grid = source('src/components/timetable/TimetableGrid.tsx');
	// The bare severity icons moved into the labelled indicator component.
	assert.doesNotMatch(grid, /<AlertTriangle/, 'no bare warning triangle may remain in the grid');
	assert.doesNotMatch(grid, /<AlertCircle className="size-3\.5 shrink-0 text-red-500" \/>/, 'no bare hard-conflict icon may remain');
	assert.match(grid, /<EntrySeverityIndicator[\s\S]*?warnings=\{warnings\}/);
	// The remaining conflict/follow-up glyphs are named too.
	assert.match(grid, /role="img" aria-label="Sandbox conflict"/);
	assert.match(grid, /role="img" aria-label="Marked for follow-up"/);
});

test('F3: the explanation uses the @/ui Tooltip primitive, never a native title or details', () => {
	const badge = source('src/components/timetable/TimetableGridConflictBadge.tsx');
	assert.match(badge, /EntrySeverityIndicator/);
	assert.match(badge, /<TooltipContent[\s\S]*?\{warningSummary\}/, 'the indicator discloses the reasons through @/ui Tooltip');
	const code = badge.replace(/\/\*[\s\S]*?\*\//g, '');
	assert.doesNotMatch(code, /\btitle=/, 'no native title attribute');
	assert.doesNotMatch(code, /<details/, 'no native details disclosure');
});

/* ── F4 / R1 (UX-AUDIT-SIZE-C01) — legible absolute typography, no-scroll ── */

// UX-AUDIT-SIZE-C01 R1: `index.css` applies `@media (max-width:640px){:root{font-size:15px}}`,
// so a rem token shrinks on a 390×844 viewport (`text-sm` → 0.875 × 15 = 13.125px). The grid
// must therefore carry absolute `text-[Npx]` values. These controls resolve the rendered class
// against the viewport root instead of trusting the class token.
const VIEWPORT_ROOTS: ReadonlyArray<readonly [string, number]> = [['1366×768', 16], ['390×844', 15]];
const REM_BY_TOKEN: Record<string, number> = { xs: 0.75, sm: 0.875, base: 1, lg: 1.125 };

function resolveFontSizePx(className: string, rootPx: number): number | null {
	const absolute = className.match(/(?:^|\s)text-\[(\d+(?:\.\d+)?)px\](?=\s|$)/);
	if (absolute) return Number(absolute[1]);
	const rem = className.match(/(?:^|\s)text-(xs|sm|base|lg)(?=\s|$)/);
	if (rem) return REM_BY_TOKEN[rem[1]] * rootPx;
	return null;
}

function renderedFontSizePx(markup: string, tagPattern: RegExp, rootPx: number): number | null {
	const tag = markup.match(tagPattern)?.[0];
	if (!tag) return null;
	const className = tag.match(/class="([^"]*)"/)?.[1];
	if (!className) return null;
	return resolveFontSizePx(className, rootPx);
}

// Renders every flag the static surface can reach: the ceremony overlay, the per-entry term
// label, and the cohort badge. Placement/Current are drag-state-only, so the source contract
// in the next test carries their floor.
function renderGridFlags(): string {
	return renderToStaticMarkup(createElement(TimetableGrid, {
		entries: [entryFor('e-1', 1), { ...entryFor('e-2', 1), entryKind: 'COHORT', cohortCode: 'G7AW' } as unknown as ScheduledEntry],
		timeSlots: [{ startTime: '11:30', endTime: '12:15', eventName: 'Flag Ceremony', dayOfWeek: 'MONDAY' }],
		violationIndex: new Map(),
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
		termFilter: 'all',
		termOptions: [{ value: '1', label: 'Term 1' }],
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

test('F4/R1: table base, time, subject, and teacher/room render absolute ≥14px at both viewport roots', () => {
	const markup = renderGrid([entryFor('e-1', 1)], new Map());
	const targets: ReadonlyArray<readonly [string, RegExp]> = [
		['grid table base', /<table[^>]*class="[^"]*"[^>]*>/],
		['time label', /<td class="px-2 py-1\.5[^"]*">/],
		['entry subject line', /<div class="[^"]*font-semibold[^"]*truncate[^"]*">/],
		['teacher/room line', /<p class="[^"]*truncate[^"]*"[^>]*data-testid="timetable-cell-detail"/],
	];
	for (const [viewport, rootPx] of VIEWPORT_ROOTS) {
		for (const [label, pattern] of targets) {
			const size = renderedFontSizePx(markup, pattern, rootPx);
			assert.notEqual(size, null, `${label} resolves a rendered font size at ${viewport}`);
			assert.ok((size ?? 0) >= 14, `${label} renders ${size}px at ${viewport} (root ${rootPx}px); expected absolute ≥14px`);
		}
	}
});

test('F4/R1: grid flags hold an absolute ≥12px floor no rem token can shrink', () => {
	const grid = source('src/components/timetable/TimetableGrid.tsx');
	assert.doesNotMatch(grid, /\btext-(xs|sm)\b/, 'no rem font-size token remains in the grid');
	assert.doesNotMatch(grid, /text-\[0?\.\d+rem\]/, 'no arbitrary rem size remains in the grid');
	const absolute = [...grid.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].map((match) => Number(match[1]));
	assert.ok(absolute.length > 0, 'the grid sizes are absolute px values');
	assert.ok(absolute.every((px) => px >= 12), `every grid font-size token is ≥12px, saw ${absolute.join(', ')}`);

	const markup = renderGridFlags();
	const flags: ReadonlyArray<readonly [string, RegExp]> = [
		['ceremony overlay', /<div class="[^"]*"[^>]*data-testid="timetable-ceremony-overlay-label"/],
		['term label', /<span class="[^"]*"[^>]*data-testid="timetable-entry-term-label"/],
		['cohort badge', /<span class="[^"]*rounded bg-sky-100[^"]*">/],
	];
	for (const [viewport, rootPx] of VIEWPORT_ROOTS) {
		for (const [label, pattern] of flags) {
			const size = renderedFontSizePx(markup, pattern, rootPx);
			assert.notEqual(size, null, `${label} resolves a rendered font size at ${viewport}`);
			assert.ok((size ?? 0) >= 12, `${label} renders ${size}px at ${viewport} (root ${rootPx}px); expected absolute ≥12px`);
		}
	}
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
	assert.doesNotMatch(header, /setTimetableEntryReadOnly/, 'publication state is not owned by the Simple-only header');
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /isDraftPublishedStrict\(state\.draft\)/, 'the shared workspace keeps the strict publication predicate');
	assert.match(workspace, /useLayoutEffect\(\(\) => \{\s*setTimetableEntryReadOnly\(isDraftPublished\)/, 'the shared owner publishes the signal before paint for Simple and Advanced');
});

/* ── F7 — header density stays calm; daily work remains in More ─────────── */

test('F7: no daily repair controls are promoted into the persistent header', () => {
	const markup = renderHeader(CLEAN_DRAFT);
	for (const id of [
		'timetable-simple-daily-tasks',
		'timetable-header-place-unresolved',
		'timetable-header-swap-sessions',
		'timetable-header-teacher-departure',
		'timetable-header-review-requests',
	]) {
		assert.equal(markup.includes(id), false, `${id} must not crowd the persistent header`);
	}
});

test('F7: More keeps daily tools and preserves their relevance rules', () => {
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /timetable-more-place-unresolved/);
	assert.match(menu, /timetable-more-swap-sessions/);
	assert.match(menu, /Teacher leaving \/ Reassign load/);
	assert.match(menu, /context\.requestPendingCount > 0/);
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
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): "New version" is a More entry once a run exists.
	// assert.match(markup, /New version/);
	assert.match(source('src/components/timetable/simple/SimpleHeaderActions.tsx'), /generate\.published \? PUBLISHED_GENERATE_LABEL : 'Generate'/);
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
