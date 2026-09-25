import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { SimpleDriftBanner } from '../../components/timetable/simple/SimpleDriftBanner';
import { SimpleMoreMenuContent } from '../../components/timetable/simple/SimpleMoreMenuContent';
import { simpleTutorialSteps } from '../../components/timetable/simple/SimpleHeaderHelpers';
import { TimetableSimpleHeader } from '../../components/timetable/TimetableSimpleHeader';
import type { ScheduleReviewWorkspaceHeaderContext } from '../../components/timetable/buildScheduleReviewWorkspaceContexts';
import { deriveTimetableCapabilities } from '../timetable-capabilities';
import { deriveGenerationReadinessState } from '../timetable-generation-readiness';
import type { DraftReport, GenerationInputComparison } from '../../types';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

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

function renderBanner(inputState: GenerationInputComparison, isPublished = false, extra: Record<string, unknown> = {}) {
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
				...extra,
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
		// A runtime-unknown domain (forward-compat) still has no dedicated home.
		changedDomains: ['rooms', 'unknownDomain'] as unknown as GenerationInputComparison['changedDomains'],
		checkedAt: '2026-09-13T00:00:00.000Z',
	});
	assert.match(markup, /data-testid="timetable-simple-repair-primary"/);
	assert.match(markup, /href="\/admin\/year-setup"/);
	assert.ok(mountedRoutes().has('/admin/year-setup'));
});

// --- S4-client / D5 rendered regeneration affordance ---

test('D5 a stale availability change renders its chip and the explicit regenerate action', () => {
	const markup = renderBanner(
		{
			status: 'STALE',
			message: 'Teacher availability changed.',
			actionHint: 'Regenerate to apply.',
			changedDomains: ['availability'] as GenerationInputComparison['changedDomains'],
			checkedAt: '2026-09-13T00:00:00.000Z',
		},
		false,
		{ onRegenerate: () => {}, regenerationEnabled: true },
	);
	assert.match(markup, /Teacher availability/);
	assert.match(markup, /data-testid="timetable-simple-regenerate-to-apply"/);
	assert.match(markup, /data-testid="timetable-simple-regenerate-impact"/);
	assert.match(markup, /Regenerate to apply/);
	// PUBLISHED-TERM-AND-DRIFT-FOLLOWUP-C01 (F2) — the rendered chip's repair
	// action must carry the exact concern-workspace href, and that href must be
	// a mounted route. A mounted-route-only assertion would be satisfied by
	// the legacy `/faculty` redirect too, so the href itself is asserted.
	assert.match(markup, /data-testid="timetable-simple-repair-availability"/);
	assert.match(markup, /href="\/faculty\/concerns"/);
	assert.doesNotMatch(markup, /href="\/faculty"/);
	assert.ok(mountedRoutes().has('/faculty/concerns'), 'the availability repair href must be a mounted route');
	// `availability` is a mapped domain, so the primary repair affordance IS the
	// per-domain control (it carries data-primary-repair) and the umbrella Year
	// Setup fallback must not appear.
	assert.match(
		markup,
		/data-testid="timetable-simple-repair-availability"[^>]*data-primary-repair="true"|data-primary-repair="true"[^>]*data-testid="timetable-simple-repair-availability"/,
		'the availability repair is the primary repair action',
	);
	assert.doesNotMatch(markup, /data-testid="timetable-simple-repair-primary"/);
});

test('D5 a published run never renders the regenerate action, only revision guidance', () => {
	const markup = renderBanner(
		{
			status: 'STALE',
			message: 'Setup changed.',
			actionHint: 'Make a revision.',
			changedDomains: ['availability'] as GenerationInputComparison['changedDomains'],
			checkedAt: '2026-09-13T00:00:00.000Z',
		},
		true,
		{ onRegenerate: () => {}, regenerationEnabled: true },
	);
	assert.doesNotMatch(markup, /timetable-simple-regenerate-to-apply/);
	assert.doesNotMatch(markup, /timetable-simple-regenerate-impact/);
	assert.doesNotMatch(markup, /timetable-simple-sync-setup/);
});

test('D5 a closed generation gate disables the regenerate action rather than dispatching', () => {
	const markup = renderBanner(
		{
			status: 'STALE',
			message: 'Policy changed.',
			actionHint: 'Regenerate to apply.',
			changedDomains: ['policy'] as GenerationInputComparison['changedDomains'],
			checkedAt: '2026-09-13T00:00:00.000Z',
		},
		false,
		{ onRegenerate: () => {}, regenerationEnabled: false },
	);
	assert.match(markup, /data-testid="timetable-simple-regenerate-to-apply"/);
	assert.match(markup, /disabled=""[^>]*data-testid="timetable-simple-regenerate-to-apply"/);
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
	assert.match(markup, /data-testid="timetable-simple-readiness-chip"/);
	assert.match(markup, /1 blocker/);
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
	// A3 — the drift message renders inside the single status region; the
	// setup-input repairs (Fix rooms / Preview impact / Sync with setup) are
	// relocated to the `/timetable/setup` sub-page, one click away.
	assert.match(markup, /timetable-simple-input-drift/);
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the setup entry point is in More ▸ Schedule actions.
	// assert.match(markup, /data-testid="timetable-simple-review-setup"/);
	assert.match(source('src/components/timetable/simple/SimpleHeaderActions.tsx'), /data-testid="timetable-simple-review-setup"/);
	assert.doesNotMatch(markup, /timetable-simple-sync-setup/);
	assert.doesNotMatch(markup, /timetable-simple-repair-rooms/);
});

// --- F3/Ux-quickfix: the no-run primary action is never absent and never a dead self-link ---

/** A real blocked readiness state for the active scope, built through the
 * production adapter so the repair is the exact production repair. */
function blockedReadiness(code: string, category: string) {
	return deriveGenerationReadinessState(
		{
			scope: { schoolId: 1, schoolYearId: 9 },
			status: 'BLOCKED',
			generateAllowed: false,
			schedulerExecuted: true,
			derivedDemandRevision: 'REV-BLOCKED',
			termStructure: { format: 'TRIMESTER', terms: [{ identity: 'T1', order: 1 }] },
			totals: { lines: 12, pairs: 4, sessionsByTerm: { T1: 12 } },
			teachingLoadCoverage: null,
			blockers: [
				{
					code,
					category,
					termIdentity: 'T1',
					sectionId: 9001,
					subjectId: 7,
					subjectCode: 'TLE-7',
					entity: 'Section 7-A · TLE-7',
					reason: `${code} blocks generation.`,
					owningSurface: 'Generation algorithm',
					nextAction: 'Re-run readiness after data/policy fixes.',
				},
			],
			zeroWrite: true,
		},
		{ schoolId: 1, schoolYearId: 9 },
	);
}

test('ALGORITHM_LIMIT/self-route repair renders a real in-place primary action, never absent', () => {
	const markup = renderHeader({
		schoolYearId: 9,
		curriculumReadiness: blockedReadiness('SEARCH_LIMIT_UNRESOLVED', 'ALGORITHM_LIMIT'),
	});
	// C5 — the empty state names its next step through the single primary action
	// alone; the redundant NEXT STEP row no longer renders.
	assert.doesNotMatch(markup, /data-testid="timetable-simple-next-action"/);
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): with no generated run the
	// one visible primary is Generate (disabled here, with its reason); the
	// in-place repair is the More ▸ "Next step" entry, still a real button that
	// re-runs readiness, never a dead self-link.
	// assert.match(markup, /data-testid="timetable-simple-primary-action"/);
	// assert.match(markup, /<button[^>]*data-testid="timetable-simple-primary-action"/);
	// assert.match(markup, /Recheck generation readiness/);
	assert.match(markup, /<button[^>]*data-testid="timetable-simple-generate-action"[^>]*disabled=""|<button[^>]*disabled=""[^>]*data-testid="timetable-simple-generate-action"/, 'Generate is the visible primary and cannot dispatch while blocked');
	assert.doesNotMatch(
		markup,
		/href="\/timetable"[^>]*data-testid="timetable-simple-primary-action"|data-testid="timetable-simple-primary-action"[^>]*href="\/timetable"/,
	);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /: setupRepairIsInPlace\s*\? \{ label: setupRepair\.label \?\? lifecycleAction\.label, disabled: lifecycleAction\.disabled \|\| context\.loading, href: null, onSelect: \(\) => context\.handleRefresh\(\) \}/, 'the in-place repair re-runs readiness from More');
});

test('a genuinely external repair still renders a navigable primary action', () => {
	const markup = renderHeader({
		schoolYearId: 9,
		curriculumReadiness: blockedReadiness('OWNERSHIP_MISSING', 'DEMAND_AUTHORITY'),
	});
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the external repair is the
	// More ▸ "Next step" link (same href); Generate is the visible primary.
	// assert.match(markup, /data-testid="timetable-simple-primary-action"/);
	assert.match(markup, /data-testid="timetable-simple-generate-action"/);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /lifecycleAction\.kind === 'fix-setup' && setupRepair\.kind === 'navigate'\s*\? \{ label: setupRepair\.label \?\? lifecycleAction\.label, disabled: false, href: setupRepair\.href \?\? YEAR_SETUP_HREF/);
	assert.match(source('src/components/timetable/simple/SimpleHeaderActions.tsx'), /<Link to=\{nextStep\.href\} onClick=\{onClose\}>/, 'the repair stays a navigable link');
});

test('the empty-state copy and the no-run tutorial agree with the rendered primary action', () => {
	const markup = renderHeader({
		schoolYearId: 9,
		curriculumReadiness: blockedReadiness('SEARCH_LIMIT_UNRESOLVED', 'ALGORITHM_LIMIT'),
	});
	const noRunSteps = simpleTutorialSteps('ready-no-run');
	const actionStep = noRunSteps.find((step) => step.title === 'Check the lifecycle action');
	assert.ok(actionStep, 'the no-run tutorial must name the lifecycle action step');
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): with no run, Generate is the one primary.
	// assert.equal(actionStep.targetTestId, 'timetable-simple-primary-action');
	assert.equal(actionStep.targetTestId, 'timetable-simple-generate-action');
	// The tutorial targets the exact testid that the empty state renders.
	assert.match(markup, new RegExp(`data-testid="${actionStep.targetTestId}"`));
	// The raw engine diagnostic stays behind the tooltip: the operator sentence is
	// rendered, and the technical reason is not leaked into it.
	const operatorMatch = markup.match(/data-testid="timetable-curriculum-readiness-message"[^>]*>([^<]*)</);
	assert.ok(operatorMatch, 'the operator readiness sentence must render');
	assert.match(operatorMatch[1], /Setup needs attention before ATLAS can generate a timetable\./);
	assert.doesNotMatch(operatorMatch[1], /SEARCH_LIMIT_UNRESOLVED/);
});