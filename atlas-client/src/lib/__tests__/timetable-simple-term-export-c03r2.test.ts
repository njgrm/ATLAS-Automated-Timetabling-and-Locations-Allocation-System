/**
 * TT-OUTPUT-C03R2 — Simple Timetable selected-term beneficiary output controls.
 *
 * Production-path proof: these controls render the real `TimetableSimpleHeader`
 * (not a helper) with an injected workspace context and assert the exact request
 * URLs the official downloads use. Under the pre-correction behavior the Simple
 * header had no ordered-term switcher, no `termIndex` on the summary workbook
 * request, no class-program action, and produced an all-term summary workbook,
 * so every assertion below fails against the base commit.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { TimetableSimpleHeader } from '../../components/timetable/TimetableSimpleHeader';
import type { ScheduleReviewWorkspaceHeaderContext } from '../../components/timetable/buildScheduleReviewWorkspaceContexts';
import type { DraftReport } from '@/types';

const TERM_OPTIONS = [
	{ value: 'all', label: 'All terms' },
	{ value: '1', label: 'First Term' },
	{ value: '2', label: 'Second Term' },
	{ value: '3', label: 'Third Term' },
];

function makeContext(overrides: Partial<ScheduleReviewWorkspaceHeaderContext> = {}): ScheduleReviewWorkspaceHeaderContext {
	const draft = {
		runId: 42,
		status: 'COMPLETED',
		createdAt: '2031-01-01T00:00:00.000Z',
		finishedAt: '2031-01-01T00:01:00.000Z',
		entries: [],
		summary: { assignedCount: 0, classesProcessed: 0, hardViolationCount: 0, unassignedCount: 0 },
	} as unknown as DraftReport;

	const context: Record<string, unknown> = {
		isPreGenerationWorkspace: false,
		activeGeneratedRunId: 42,
		leftTab: 'violations',
		leftPanelRef: { current: null },
		presentationMode: 'matrix',
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
		softCount: 0,
		selectedRunId: 'latest',
		handleRunChange: () => {},
		runs: [{ id: 42, createdAt: '2031-01-01T00:00:00.000Z', status: 'COMPLETED' }],
		schoolYearContext: {
			source: 'enrollpro-verified',
			activeSchoolYearLabel: '2030-2031',
			activeTerm: { termIndex: 2, orderedTerms: [{ identity: 't1', displayLabel: 'First Term', order: 1 }, { identity: 't2', displayLabel: 'Second Term', order: 2 }, { identity: 't3', displayLabel: 'Third Term', order: 3 }] },
		},
		schoolId: 7,
		curriculumReadiness: undefined,
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
		draft,
		setPublishAcknowledged: () => {},
		setShowPublishDialog: () => {},
		exitPolicyView: () => {},
		switchCenterViewWithGuard: () => {},
		enterPolicyView: () => {},
		openMapWorkspace: async () => {},
		handleRefresh: () => {},
		refreshReferenceLabels: () => {},
		referenceLookupStatus: { state: 'ready', label: 'Names ready' },
		revertLoading: false,
		editHistoryCount: 0,
		revertLastEdit: async () => {},
		setShowEditHistory: () => {},
		tutorial: { start: () => {} },
		sectionLabel: (id: number) => `Section ${id}`,
		subjectLabel: (id: number) => `Subject ${id}`,
		facultyLabel: (id: number) => `Faculty ${id}`,
		setUnassignedReasonFilter: () => {},
		summary: { assignedCount: 0, classesProcessed: 0, hardViolationCount: 0, unassignedCount: 0 },
		requestPendingCount: 0,
		statusColor: () => '',
		formatDuration: () => '',
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
		PROGRAM_FILTER_OPTIONS: [{ value: 'all', label: 'All programs' }],
		ENTRY_KIND_FILTER_OPTIONS: [{ value: 'all', label: 'All entry types' }],
		WELLBEING_CODES: new Set<string>(),
		CONFLICT_CODES: new Set<string>(),
		formatTimestamp: (value: string | null) => value ?? '',
		setProgramFilter: () => {},
		setEntryKindFilter: () => {},
		policy: null,
		policyAlignmentWarning: null,
		showFullDay: false,
		setShowFullDay: () => {},
		hiddenRowCount: 0,
		termFilter: 2,
		onTermFilterChange: () => {},
		termOptions: TERM_OPTIONS,
		activeTermIndex: 2,
	};
	return { ...context, ...overrides } as unknown as ScheduleReviewWorkspaceHeaderContext;
}

function renderHeader(context: ScheduleReviewWorkspaceHeaderContext) {
	return renderToStaticMarkup(
		createElement(
			MemoryRouter,
			null,
			createElement(TimetableSimpleHeader, {
				context,
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

function attr(tag: string, name: string): string | null {
	const match = tag.match(new RegExp(`${name}="([^"]*)"`));
	return match ? match[1].replace(/&amp;/g, '&') : null;
}

test('Simple Timetable renders the configured ordered-term options', () => {
	const markup = renderHeader(makeContext({ termFilter: 2 }));
	const trigger = tagFor(markup, 'timetable-simple-term-filter');
	assert.equal(attr(trigger, 'data-term-filter'), '2', 'the switcher reflects the selected term');
	assert.equal(attr(trigger, 'data-term-options'), 'all,1,2,3', 'the switcher is bound to the configured ordered terms, not a hardcoded list');
	for (const option of TERM_OPTIONS) {
		assert.ok(markup.includes(option.label), `rendered markup exposes the configured "${option.label}" option`);
	}
});

test('every beneficiary export binds the selected term into its real request URL and filename', () => {
	for (const term of [1, 2, 3]) {
		const markup = renderHeader(makeContext({ termFilter: term, viewMode: 'faculty', entityFilter: '502' }));
		const trigger = tagFor(markup, 'timetable-simple-export-trigger');

		const summaryUrl = attr(trigger, 'data-export-summary-url');
		const summaryFile = attr(trigger, 'data-export-summary-filename');
		assert.ok(summaryUrl?.includes('summary-teacher-schedule.xlsx?termIndex=' + term), `summary workbook sends termIndex=${term}: ${summaryUrl}`);
		assert.ok(summaryFile?.includes(`-term${term}`), `summary workbook filename names the term: ${summaryFile}`);

		const classUrl = attr(trigger, 'data-export-class-program-url');
		const classFile = attr(trigger, 'data-export-class-program-filename');
		assert.ok(classUrl?.includes('class-program.xlsx?termIndex=' + term), `class program sends termIndex=${term}: ${classUrl}`);
		assert.ok(classFile?.includes(`-term${term}`), `class program filename names the term: ${classFile}`);

		const teacherUrl = attr(trigger, 'data-export-teacher-program-url');
		const teacherFile = attr(trigger, 'data-export-teacher-program-filename');
		assert.ok(teacherUrl?.includes('teacher-program.docx?facultyId=502&termIndex=' + term), `teacher program sends termIndex=${term}: ${teacherUrl}`);
		assert.ok(teacherFile?.includes(`-term${term}`), `teacher program filename names the term: ${teacherFile}`);
	}
});

test('"All terms" disables official beneficiary downloads and explains why', () => {
	const markup = renderHeader(makeContext({ termFilter: 'all' }));
	const trigger = tagFor(markup, 'timetable-simple-export-trigger');
	assert.equal(attr(trigger, 'data-export-needs-term'), 'true');
	assert.equal(attr(trigger, 'data-export-summary-url'), '', 'no all-term summary request is exposed');
	assert.equal(attr(trigger, 'data-export-class-program-url'), '', 'no all-term class-program request is exposed');
	assert.ok(markup.includes('Choose a term to export.'), 'the operator is told why the download is disabled');
});
