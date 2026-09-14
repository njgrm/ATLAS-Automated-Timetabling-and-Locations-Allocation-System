import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { SimpleDriftBanner } from '../../components/timetable/simple/SimpleDriftBanner';
import { SimpleMoreMenuContent } from '../../components/timetable/simple/SimpleMoreMenuContent';
import { TimetableSimpleHeader } from '../../components/timetable/TimetableSimpleHeader';
import type { ScheduleReviewWorkspaceHeaderContext } from '../../components/timetable/buildScheduleReviewWorkspaceContexts';
import { deriveTimetableCapabilities } from '../timetable-capabilities';
import type { DraftReport, GenerationInputComparison } from '../../types';

const clientRoot = resolve(import.meta.dirname, '../../..');

function mountedRoutes(): Set<string> {
	const app = readFileSync(resolve(clientRoot, 'src/App.tsx'), 'utf8');
	return new Set(
		Array.from(app.matchAll(/path:\s*'([^']+)'/g)).map((match) => `/${match[1].replace(/^\//, '')}`),
	);
}

const READY_CAPABILITIES = deriveTimetableCapabilities({
	scopeResolved: true,
	curriculumState: 'ready',
	generating: false,
	isPreGeneration: false,
	hasGeneratedRun: true,
	isPublished: false,
	latestRunFailed: false,
	hardCount: 0,
	unassignedCount: 0,
	softCount: 0,
	hasSelectedEntry: false,
	requestPendingCount: 0,
});

function draftWithInputState(inputState: GenerationInputComparison): DraftReport {
	return {
		runId: 42,
		status: 'COMPLETED',
		entries: [],
		unassignedItems: [],
		summary: { hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0 },
		inputState,
		version: 3,
		finishedAt: null,
		createdAt: '2031-01-01T00:00:00.000Z',
	} as unknown as DraftReport;
}

function renderBanner(inputState: GenerationInputComparison, isPublished = false) {
	return renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(SimpleDriftBanner, {
				schoolId: 1,
				schoolYearId: 9,
				activeGeneratedRunId: 42,
				draft: draftWithInputState(inputState),
				isPreGenerationWorkspace: false,
				loading: false,
				onRefresh: () => {},
				capabilities: READY_CAPABILITIES,
				isPublished,
			}),
		),
	);
}

// --- R6 rendered routed-action control ---

test('R6 the drift banner renders a routed repair action whose href is the domain href', () => {
	const markup = renderBanner({
		status: 'STALE',
		message: 'Rooms changed.',
		actionHint: 'Review rooms.',
		changedDomains: ['rooms'],
		checkedAt: '2026-09-13T00:00:00.000Z',
	});
	assert.match(markup, /data-testid="timetable-simple-input-drift"/);
	assert.match(markup, /data-testid="timetable-simple-repair-rooms"/);
	assert.match(markup, /href="\/map"/);
	// The primary action resolves to the primaryHref and is mounted.
	assert.match(markup, /data-primary-repair="true"[^>]*href="\/map"|href="\/map"[^>]*data-primary-repair="true"/);
	assert.ok(mountedRoutes().has('/map'), 'the repair href must be a mounted route');
});

test('R6 an unmapped changed domain renders the umbrella primary repair action', () => {
	const markup = renderBanner({
		status: 'STALE',
		message: 'Demand changed.',
		actionHint: 'Review setup.',
		// 'derivedDemand' has no dedicated home in the client domain map.
		changedDomains: ['rooms', 'derivedDemand'] as GenerationInputComparison['changedDomains'],
		checkedAt: '2026-09-13T00:00:00.000Z',
	});
	assert.match(markup, /data-testid="timetable-simple-repair-primary"/);
	assert.match(markup, /href="\/admin\/year-setup"/);
	assert.ok(mountedRoutes().has('/admin/year-setup'));
});

test('R6 a fresh run renders no drift banner and no repair control', () => {
	const markup = renderBanner({
		status: 'FRESH',
		message: 'Fresh.',
		actionHint: '',
		changedDomains: [],
		checkedAt: '2026-09-13T00:00:00.000Z',
	});
	assert.doesNotMatch(markup, /timetable-simple-input-drift/);
});

// --- R1 / R2 header rendered publish gate ---

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

function makeHeaderContext(overrides: Record<string, unknown> = {}): ScheduleReviewWorkspaceHeaderContext {
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
				context: makeHeaderContext(overrides),
				layoutMode: 'simple',
				onLayoutModeChange: () => {},
				activeTask: null,
				onTaskChange: () => {},
				swapClassTimesMode: null,
				onSwapClassTimesStart: () => {},
				onSwapClassTimesCancel: () => {},
			}),
		),
	);
}

test('R1 a run-wide blocking HARD renders a truthful publish block', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 1, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
		hardCount: 1,
		blockingHardCount: 1,
		summary: { assignedCount: 5, classesProcessed: 5, hardViolationCount: 1, unassignedCount: 0 },
	});
	assert.match(markup, /data-testid="timetable-publish-readiness-summary"/);
	assert.match(markup, /1 hard blocker/);
});

test('R1 a legacy non-blocking HARD does not block publish', () => {
	// Total run-wide HARD is 1 (a retired/non-promotable code), but the server
	// allowlist-filtered blocking count is 0.
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 1, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
		hardCount: 1,
		blockingHardCount: 0,
		summary: { assignedCount: 5, classesProcessed: 5, hardViolationCount: 1, unassignedCount: 0 },
	});
	assert.doesNotMatch(markup, /data-testid="timetable-publish-readiness-summary"/);
	assert.match(markup, /Publish schedule/);
});

test('R2 a superseded run renders not-published', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false, publishedAt: '2031-01-01T00:00:00.000Z', publishedBy: 4 }),
		blockingHardCount: 0,
	});
	assert.doesNotMatch(markup, /Published/);
});

test('R2 a truly published run renders published', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: true }),
		blockingHardCount: 0,
	});
	assert.match(markup, /Published/);
});

test('R7 Simple renders the setup-sync entry point from the shared drift surface', () => {
	const markup = renderHeader({
		draft: draftWithSummary(
			{ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false },
			{
				status: 'STALE',
				message: 'Rooms changed.',
				actionHint: 'Review rooms.',
				changedDomains: ['rooms'],
				checkedAt: '2026-09-13T00:00:00.000Z',
			},
		),
		blockingHardCount: 0,
	});
	// The drift banner renders the live setup-sync entry point plus the routed repair.
	assert.match(markup, /timetable-simple-input-drift/);
	assert.match(markup, /timetable-simple-sync-setup/);
	assert.match(markup, /timetable-simple-repair-rooms/);
	assert.match(markup, /href="\/map"/);
});