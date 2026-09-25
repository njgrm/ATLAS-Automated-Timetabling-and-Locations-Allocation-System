/**
 * UX-QUICKFIX-C01 — Simple header action-row truth.
 *
 * Problem: Generate and Publish were only reachable through the More menu
 * (Generate) or as a single dynamic primary button that could decay into a
 * disabled "Publish schedule" dead end on an already-published run.
 *
 * Production-path proof: these controls render the real `TimetableSimpleHeader`
 * with an injected workspace context (not a helper), and the dispatch guards
 * are the exact functions the header's click handlers read.
 *
 * Run: `npx tsx --test src/lib/__tests__/ux-quickfix-c01-header-actions.test.ts`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { TimetableSimpleHeader } from '../../components/timetable/TimetableSimpleHeader';
import {
	resolveSimpleGenerateActionState,
	resolveSimplePublishActionState,
	shouldDispatchSimpleGenerate,
	shouldDispatchSimplePublish,
} from '../../components/timetable/simple/SimpleHeaderHelpers';
import type { ScheduleReviewWorkspaceHeaderContext } from '../../components/timetable/buildScheduleReviewWorkspaceContexts';
import type { DraftReport } from '@/types';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
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

function tagFor(markup: string, testId: string): string {
	const match = markup.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`));
	assert.ok(match, `expected an element with data-testid="${testId}"`);
	return match[0];
}

const CLEAN_UNPUBLISHED = {
	draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
	blockingHardCount: 0,
};

// --- (a) Generate is present and enabled when generation is allowed ---

test('UX-QUICKFIX-C01 (a) Generate is present and enabled when the generation gate is open', () => {
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): Generate is the visible primary only while no
	// generated run exists; once a run exists it is a More ▸ Schedule actions entry.
	// const markup = renderHeader(CLEAN_UNPUBLISHED);
	const markup = renderHeader({ draft: null });
	const generate = tagFor(markup, 'timetable-simple-generate-action');
	assert.doesNotMatch(generate, /\sdisabled=""/, 'an open generation gate must render an enabled Generate control');
	assert.match(generate, /aria-label="Generate schedule"/);
	assert.match(markup, /<span>Generate<\/span>/);
});

// --- (b) Publish is present and enabled when the publication gate is open ---

test('UX-QUICKFIX-C01 (b) Publish is present and enabled when the publication gate is open', () => {
	const markup = renderHeader(CLEAN_UNPUBLISHED);
	const publish = tagFor(markup, 'timetable-simple-publish-action');
	assert.doesNotMatch(publish, /\sdisabled=""/, 'an open publication gate must render an enabled Publish control');
	assert.match(publish, /aria-label="Publish schedule"/);
	assert.match(markup, /<span>Publish schedule<\/span>/);
});

// --- (c) an already-published run is never a disabled "Publish schedule" ---

test('UX-QUICKFIX-C01 (c) an already-published run shows the published state, not a dead disabled Publish', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: true }),
		blockingHardCount: 0,
	});
	assert.match(markup, /data-testid="timetable-simple-published-state"/, 'the published state must render');
	// SUPERSEDED (LANE-C C03 B4): assert.match(markup, /Published schedule — view only/);
	assert.match(markup, /Published schedule/);
	assert.match(markup, /Changes start on a date you choose/);
	assert.equal(markup.includes('Publish schedule'), false, 'no publish affordance may render on a published run');
	assert.equal(
		markup.includes('data-testid="timetable-simple-primary-action"'),
		false,
		'the dead-end publish primary slot is replaced by the published state',
	);
	// Generate remains the adjacent real next step (re-generate from new data).
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): Generate is the visible primary only while no
	// generated run exists; once a run exists it is a More ▸ Schedule actions entry.
	// assert.match(markup, /data-testid="timetable-simple-generate-action"/);
	assert.doesNotMatch(markup, /data-testid="timetable-simple-generate-action"/);
	assert.match(source('src/components/timetable/TimetableSimpleHeader.tsx'), /visible: headerPrimary !== 'generate',[\s\S]*published: isRunPublished,/, 'More offers "New version" beside a published run');
});

test('UX-QUICKFIX-C01 (c2) a published run with follow-ups keeps the follow-up review action', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 2, isPublished: true }),
		blockingHardCount: 0,
		summary: { assignedCount: 5, classesProcessed: 5, hardViolationCount: 0, unassignedCount: 2 },
	});
	assert.match(markup, /data-testid="timetable-simple-published-state"/);
	assert.equal(markup.includes('Publish schedule'), false);
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the lifecycle primary is no longer a visible control.
	// assert.match(markup, /data-testid="timetable-simple-primary-action"/);
	// assert.match(markup, /Review follow-ups/);
	// The follow-up review stays reachable: More ▸ "Next step: Review follow-ups" and "Unassigned sessions (N)".
	assert.match(markup, /2 follow-up items remain/);
	const actions = source('src/components/timetable/simple/SimpleHeaderActions.tsx');
	assert.match(actions, /kind === 'review-follow-ups'/);
	assert.match(actions, /Next step: \{nextStep\.label\}/);
});

// --- (d) no request is dispatched while a gate is closed ---

test('UX-QUICKFIX-C01 (d) the visible dispatch guards fail closed on a closed gate', () => {
	// The exact guards the header click handlers read.
	assert.equal(shouldDispatchSimpleGenerate(false), false, 'a closed generation gate must never dispatch');
	assert.equal(shouldDispatchSimplePublish(false, false), false, 'a closed publication gate must never dispatch');
	assert.equal(shouldDispatchSimplePublish(true, true), false, 'a published run must never dispatch a publish');
	// Positive controls: the guards do not block an open gate.
	assert.equal(shouldDispatchSimpleGenerate(true), true);
	assert.equal(shouldDispatchSimplePublish(true, false), true);

	const generationAction = resolveSimpleGenerateActionState({
		canPlanOrGenerate: false,
		loading: false,
		generating: false,
		gateReason: 'Setup inputs for the active school year are not ready yet.',
	});
	assert.equal(generationAction.disabled, true);
	assert.equal(generationAction.reason, 'Setup inputs for the active school year are not ready yet.');

	const publishAction = resolveSimplePublishActionState({
		publicationEnabled: false,
		isRunPublished: false,
		gateReason: 'Fix 1 hard blocker before publishing.',
	});
	assert.equal(publishAction.disabled, true);
	assert.equal(publishAction.reason, 'Fix 1 hard blocker before publishing.');
});

test('UX-QUICKFIX-C01 (d2) a closed generation gate renders a disabled Generate with the truthful reason', () => {
	// DRAFT-UX-C01: rendered in the no-run state, where Generate is the visible primary.
	const markup = renderHeader({
		draft: null,
		curriculumReadiness: { state: 'unavailable', message: 'Setup check unavailable.' },
	});
	const generate = tagFor(markup, 'timetable-simple-generate-action');
	assert.match(generate, /disabled=""/, 'the disabled generation control cannot dispatch');
	assert.match(generate, /aria-label="Generate schedule — Schedule information could not be checked\."/);
});

test('UX-QUICKFIX-C01 (d3) a closed publication gate renders a disabled Publish and still shows the next step', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 1, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
		hardCount: 1,
		blockingHardCount: 1,
		summary: { assignedCount: 5, classesProcessed: 5, hardViolationCount: 1, unassignedCount: 0 },
	});
	const publish = tagFor(markup, 'timetable-simple-publish-action');
	assert.match(publish, /disabled=""/, 'the disabled publish control cannot dispatch');
	assert.match(publish, /aria-label="Publish schedule — Fix 1 hard blocker before publishing\."/);
	// The real next step is still a functional primary action.
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): assert.match(markup, /data-testid="timetable-simple-primary-action"/);
	// The next step (Fix blockers) is the merged warnings control.
	assert.match(tagFor(markup, 'timetable-simple-warnings-control'), /data-warnings-dispatch="readiness-sheet"/);
});

test('UX-QUICKFIX-C01 (d4) every visible handler consults its pure guard before dispatch', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /if \(!shouldDispatchSimpleGenerate\(canPlanOrGenerate\)\) return;/);
	assert.match(header, /if \(!shouldDispatchSimplePublish\(capabilities\.gates\.publication\.enabled, isRunPublished\)\) return;/);
});

// --- (discoverability) both controls live in the header action row, not More ---

test('UX-QUICKFIX-C01 the action row mounts Generate and Publish without opening More', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /<SimpleGenerateAction/);
	assert.match(header, /<SimplePublishedState|<SimplePublishAction/);
	// The More menu is not required to reach either control.
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): one primary at a time —
	// Generate without a run, Publish once a run exists (the other is in More).
	// const markup = renderHeader(CLEAN_UNPUBLISHED);
	// assert.match(markup, /data-testid="timetable-simple-generate-action"/);
	assert.match(renderHeader({ draft: null }), /data-testid="timetable-simple-generate-action"/);
	assert.match(renderHeader(CLEAN_UNPUBLISHED), /data-testid="timetable-simple-publish-action"/);
});
