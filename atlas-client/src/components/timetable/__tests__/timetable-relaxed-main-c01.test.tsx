/**
 * TIMETABLE-RELAXED-MAIN-C01 — Candidate A behaviour proofs.
 *
 * Real-surface, rendered assertions (not wiring): the actual
 * `TimetableSimpleHeader`, `TimetableGrid` and `TimetableSubNav` render with an
 * injected workspace context, and the App route table is read from source.
 *
 * Fixtures come from the real authority shape: the ordered-term contract is the
 * committed `Term 1/2/3` shape (`timetable-term-gate-c01`), the drift shape is
 * the committed R7 rooms comparison, and the cell strings are the live
 * `TLE / P. CRUZ · Room 103 · G7AW` shape.
 *
 * Run: `npm run test:timetable-relaxed-main`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { isVerifiedOrderedActiveTerm, type OrderedAcademicTerm } from '@/lib/academic-term';
import { TimetableSimpleHeader } from '../TimetableSimpleHeader';
import { primaryDispatchesReviewIssues } from '../simple/SimpleHeaderHelpers';
import { TimetableGrid } from '../TimetableGrid';
import { TimetableSubNav } from '../TimetableSubNav';
import type { ScheduleReviewWorkspaceHeaderContext } from '../buildScheduleReviewWorkspaceContexts';
import type { DraftReport, GenerationInputComparison, ScheduledEntry, Violation } from '@/types';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

// The committed ordered-term contract (timetable-term-gate-c01).
const ORDERED_TERMS: OrderedAcademicTerm[] = [
	{ identity: 'T1', displayLabel: 'TERM 1', order: 1 },
	{ identity: 'T2', displayLabel: 'TERM 2', order: 2 },
	{ identity: 'T3', displayLabel: 'TERM 3', order: 3 },
];

function staleRoomsInputState(): GenerationInputComparison {
	return {
		status: 'STALE',
		message: 'Rooms changed.',
		actionHint: 'Review rooms.',
		changedDomains: ['rooms'],
		checkedAt: '2026-09-13T00:00:00.000Z',
	} as unknown as GenerationInputComparison;
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

/* ── A1 — canonical ordered-term authority, fail-closed ─────────────────── */

test('A1 control: an unknown or ambiguous active-term identity is never treated as verified', () => {
	// Failing-first control for the canonical predicate. Each shape below would
	// silently authorize a timetable read (and a Term-1 selection) if the
	// membership / integer / positive guards were weakened.
	assert.equal(isVerifiedOrderedActiveTerm(null), false, 'a missing context is unresolved');
	assert.equal(isVerifiedOrderedActiveTerm({ verified: false, termIndex: 2, orderedTerms: ORDERED_TERMS }), false, 'unverified is unresolved');
	assert.equal(isVerifiedOrderedActiveTerm({ verified: true, termIndex: null, orderedTerms: ORDERED_TERMS }), false, 'a missing index is unresolved');
	assert.equal(isVerifiedOrderedActiveTerm({ verified: true, termIndex: 4, orderedTerms: ORDERED_TERMS }), false, 'an index outside the ordered contract is unresolved');
	assert.equal(isVerifiedOrderedActiveTerm({ verified: true, termIndex: 2 }), false, 'no ordered contract is unresolved');
	assert.equal(isVerifiedOrderedActiveTerm({ verified: true, termIndex: 2.5, orderedTerms: ORDERED_TERMS }), false, 'a non-integer index is unresolved');
	assert.equal(isVerifiedOrderedActiveTerm({ verified: true, termIndex: 0, orderedTerms: [{ identity: 'T0', displayLabel: 'TERM 0', order: 0 }] }), false, 'a non-positive index is unresolved');
	// The verified, in-contract shape is the only one that authorizes.
	assert.equal(isVerifiedOrderedActiveTerm({ verified: true, termIndex: 2, orderedTerms: ORDERED_TERMS }), true, 'the verified in-contract term is authoritative');
});

test('A1: an unverified term authority exposes no fabricated term option and says so in plain language', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
		schoolYearContext: {
			activeSchoolYearLabel: '2030-2031',
			source: 'cache',
			activeTerm: { source: 'atlas-unverified', verified: false, activeTerm: null, termIndex: null, orderedTerms: ORDERED_TERMS },
		},
		// The workspace collapses term options to `All terms` while unresolved.
		termOptions: [{ value: 'all', label: 'All terms' }],
		activeTermIndex: null,
	});
	const trigger = markup.match(/<[^>]*data-testid="timetable-simple-term-filter"[^>]*>/)?.[0] ?? '';
	assert.ok(trigger, 'the term switcher must render');
	assert.equal((trigger.match(/data-term-options="([^"]*)"/)?.[1] ?? ''), 'all', 'no numeric term is offered while authority is unverified');
	assert.match(markup, /term setup is unverified/i, 'the surface names the unresolved term authority in plain language');
});

/* ── A2 — one clean term label + visible term labels under All terms ────── */

test('A2: the term switcher no longer renders a duplicated visible "TERM TERM" prefix', () => {
	const controls = source('src/components/timetable/simple/SimpleBeneficiaryControls.tsx');
	// The redundant visible field label (the option labels already read "TERM N")
	// is gone; only the aria-label and the screen-reader option list remain.
	assert.doesNotMatch(controls, /tracking-wide text-muted-foreground xl:inline">\s*\n?\s*Term/, 'no duplicated visible "Term" prefix may remain');
	assert.match(controls, /aria-label="Term"/, 'the trigger keeps its accessible name');
	assert.match(controls, /timetable-simple-term-options/, 'the screen-reader option list stays');
});

function renderAllTermsGrid(entries: ScheduledEntry[]): string {
	return renderToStaticMarkup(createElement(TimetableGrid, {
		entries,
		timeSlots: [{ startTime: '11:30', endTime: '12:15' }],
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
		termOptions: [
			{ value: 'all', label: 'All terms' },
			{ value: '1', label: 'TERM 1' },
			{ value: '2', label: 'TERM 2' },
		],
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

test('A2: every stacked entry under All terms carries its own visible term label', () => {
	const markup = renderAllTermsGrid([entryFor('e-term1', 1), entryFor('e-term2', 2)]);
	const labels = [...markup.matchAll(/data-testid="timetable-entry-term-label"[^>]*data-term-index="([^"]*)"/g)].map((m) => m[1]);
	assert.deepEqual(labels, ['1', '2'], 'both stacked entries render a term label naming their own ordered term');
	assert.match(markup, />TERM 1</, 'the first entry names TERM 1');
	assert.match(markup, />TERM 2</, 'the second entry names TERM 2');
});

test('A2: a concrete-term view does not repeat the term label on every entry', () => {
	const markup = renderToStaticMarkup(createElement(TimetableGrid, {
		entries: [entryFor('e-term2', 2)],
		timeSlots: [{ startTime: '11:30', endTime: '12:15' }],
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
		termFilter: 2,
		termOptions: [{ value: '2', label: 'TERM 2' }],
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
	assert.doesNotMatch(markup, /timetable-entry-term-label/, 'a single-term view needs no per-entry term label');
});

/* ── A3/A4 — one status region, one authority state ─────────────────────── */

test('A4: the stale-input state never renders beside the verified-source authority line', () => {
	const markup = renderHeader({
		draft: draftWithSummary(
			{ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false },
			staleRoomsInputState(),
		),
		schoolYearContext: { activeSchoolYearLabel: '2030-2031', source: 'enrollpro-verified', activeTerm: null },
	});
	assert.match(markup, /timetable-simple-input-drift/, 'the drift state renders');
	assert.match(markup, /The current schedule stays unchanged while you review school information\./, 'the notice makes the no-change promise explicit');
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the one setup CTA moved into
	// More ▸ Schedule actions and keeps its drift label there.
	// const setupCta = markup.match(/data-testid="timetable-simple-review-setup"[\s\S]*?<\/a>/)?.[0] ?? '';
	// assert.match(setupCta, /Check school information/, 'the one adjacent setup action is plain and actionable');
	// assert.equal((markup.match(/>Check school information</g) ?? []).length, 1, 'the stale notice has one setup CTA, not competing duplicates');
	assert.equal((markup.match(/>Check school information</g) ?? []).length, 0, 'no competing setup CTA in the header row');
	assert.match(source('src/components/timetable/TimetableSimpleHeader.tsx'), /schoolInformationLabel=\{showDriftState \? 'Check school information' : 'School information'\}/, 'the one setup action is plain and actionable (in More)');
	assert.doesNotMatch(markup, /timetable-simple-authority/, 'the source authority line must not contradict it');
	assert.doesNotMatch(markup, /Verified with EnrollPro/, 'the verified-source claim is suppressed while inputs are stale');
});

test('A4: a fresh-input state hides routine source provenance while retaining the clean-input state', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
		schoolYearContext: {
			activeSchoolYearLabel: '2030-2031',
			source: 'enrollpro-verified',
			activeTerm: { source: 'enrollpro', verified: true, activeTerm: 'T2', termIndex: 2, orderedTerms: ORDERED_TERMS },
		},
	});
	assert.doesNotMatch(markup, /timetable-simple-authority/, 'routine source provenance stays out of the ordinary schedule header');
	assert.doesNotMatch(markup, /Verified with EnrollPro/, 'the verified source is not repeated in routine schedule chrome');
	assert.doesNotMatch(markup, /timetable-simple-input-drift/, 'no drift line renders when inputs are fresh');
	assert.doesNotMatch(markup, /timetable-term-authority-unverified/, 'no term-authority notice renders for a verified contract');
});

test('A3/C5: the header renders one compact status region and one primary, with the redundant NEXT STEP line gone', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 1, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
		hardCount: 1,
		blockingHardCount: 1,
		summary: { assignedCount: 5, classesProcessed: 5, hardViolationCount: 1, unassignedCount: 0 },
	});
	assert.equal((markup.match(/data-testid="timetable-simple-status-region"/g) ?? []).length, 1, 'exactly one status region');
	// C5 — the status region carries the chip, the one authority state and the
	// setup entry point; it no longer carries a redundant `Next step:` line that
	// duplicates the primary action's own label.
	assert.match(markup, /data-testid="timetable-simple-readiness-chip"/, 'the one status chip renders inside the region');
	assert.doesNotMatch(markup, /Next step:/, 'the duplicated next-step copy is removed');
	assert.doesNotMatch(markup, /data-testid="timetable-simple-next-action"/, 'the redundant NEXT STEP row is gone');
	assert.doesNotMatch(markup, /data-testid="timetable-simple-task-prompt"/, 'no separate task-prompt band remains');
	// A3 — the single primary action names the lifecycle next step itself. The
	// control renders either a bare label (link variant) or a `<span>` label, so
	// read the text that follows its leading icon.
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the lifecycle primary merged
	// into the warnings control, which names the next step in its accessible
	// name; Publish is the one filled primary once a run exists.
	// const primaryIdx = markup.indexOf('timetable-simple-primary-action');
	// assert.equal(primaryLabel, 'Fix blockers', 'the primary names the lifecycle next step');
	const warningsTag = markup.match(/<[^>]*data-testid="timetable-simple-warnings-control"[^>]*>/)?.[0] ?? '';
	// SUPERSEDED BY WORD (LANE-C-PLAIN-LANGUAGE-C03 J1, 2026-09-26). The
	// assertion's INTENT is unchanged and still enforced on the line below: the
	// merged control must name the lifecycle next step AND the current count.
	// Only the vocabulary changed — the 2026-09-26 audit finding 3 found one HARD
	// problem carried four names, and this accessible name mixed the old noun
	// ("blocker") with the new one ("Must fix"). The original assertion is
	// retained verbatim:
	//   assert.match(warningsTag, /aria-label="Fix blockers: 1 blocker"/, 'the merged control names the lifecycle next step');
	// The count value (1), the merged control, the dispatch, and the absence of a
	// second lifecycle primary are all still asserted exactly as before.
	assert.match(warningsTag, /aria-label="Fix must-fix problems: 1 Must fix"/, 'the merged control names the lifecycle next step and the count, in the one plain word');
	assert.doesNotMatch(warningsTag, /blocker/i, 'the merged control carries no competing name for the same idea');
	assert.equal((markup.match(/data-testid="timetable-simple-primary-action"/g) ?? []).length, 0, 'no second lifecycle primary');
	// A3 — the setup repairs are relocated to the setup sub-page, not the header.
	assert.doesNotMatch(markup, /timetable-simple-sync-setup/, 'Sync with setup is not a header control');
	assert.doesNotMatch(markup, /timetable-simple-impact-preview/, 'Preview impact is not a header control');
	// SUPERSEDED (DRAFT-UX-C01): assert.match(markup, /data-testid="timetable-simple-review-setup"/, 'one labelled way to the setup repairs remains');
	assert.match(source('src/components/timetable/simple/SimpleHeaderActions.tsx'), /data-testid="timetable-simple-review-setup"/, 'one labelled way to the setup repairs remains (in More)');
	// Status key, Tutorial and Day options are not header controls any more.
	assert.doesNotMatch(markup, /data-testid="timetable-status-legend"/, 'Status key left the header row');
	assert.doesNotMatch(markup, /data-testid="timetable-simple-tutorial-trigger"/, 'Tutorial left the header row');
	assert.doesNotMatch(markup, /data-testid="timetable-day-options-trigger"/, 'Day options left the header row');
});

test('C5: the status band carries no band chrome and the action row adds no bottom band padding', () => {
	// Failing-first control for the density correction: the pre-correction header
	// rendered the status region as its own bordered, padded card band
	// (`mt-1 mb-1 ... py-1`, so a full extra band of vertical chrome) and gave the
	// action row its own `pb-1.5` bottom band. Both are the vertical chrome that
	// pushed the grid top past the target.
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const regionTag = header.match(/<section[^>]*data-testid="timetable-simple-status-region"[^>]*>/)?.[0];
	assert.ok(regionTag, 'the status region still renders');
	assert.doesNotMatch(regionTag, /mt-1|mb-1|py-1|rounded-lg border|shadow-sm/, 'the status region no longer renders its own bordered/padded band');
	// The action row keeps its horizontal padding and drops the vertical band.
	const actionRow = header.match(/<div className="flex min-w-0 flex-wrap items-center gap-1\.5 px-3[^"]*">/)?.[0];
	assert.ok(actionRow, 'the single action row still renders');
	assert.doesNotMatch(actionRow, /pb-1\.5|py-/, 'the action row adds no bottom band padding');
	// Exactly one status region element exists in the whole header source.
	assert.equal((header.match(/data-testid="timetable-simple-status-region"/g) ?? []).length, 1, 'exactly one status region element');
});

test('C6: the primary action leads the narrow action strip and returns inline at lg', () => {
	const markup = renderHeader({
		draft: draftWithSummary({ runId: 42, hardViolationCount: 1, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
		hardCount: 1,
		blockingHardCount: 1,
		summary: { assignedCount: 5, classesProcessed: 5, hardViolationCount: 1, unassignedCount: 0 },
	});
	// The action strip is the sanctioned horizontally scrollable region, so the
	// primary must lead it (visible without scrolling) on narrow viewports and
	// return to its inline order at lg — never clipped unreachably.
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the lifecycle primary
	// (`order-first lg:order-none`) is gone. The action row wraps (never a
	// horizontal strip), so the one primary (Publish here) and More stay
	// visible on narrow viewports without reordering.
	const renderedTag = markup.match(/<[^>]*data-testid="timetable-simple-publish-action"[^>]*>/)?.[0];
	assert.ok(renderedTag, 'the rendered primary action element exists');
	assert.match(markup, /class="flex min-w-0 flex-wrap items-center justify-start gap-1\.5 lg:ml-auto lg:justify-end"/, 'the primary cluster wraps instead of scrolling');
	assert.doesNotMatch(markup, /overflow-x-auto/, 'no horizontally scrolling strip can clip the primary');
});

test('C7: the header primary and More never both dispatch the review-issues action', () => {
	// Behavioural decision (the shared helper the header reads).
	assert.equal(
		primaryDispatchesReviewIssues({ activeTaskId: null, lifecycleKind: 'review-warnings' }),
		true,
		'the review-warnings primary owns review-issues',
	);
	assert.equal(
		primaryDispatchesReviewIssues({ activeTaskId: 'review-issues', lifecycleKind: 'publish' }),
		true,
		'an armed review task owns review-issues',
	);
	// Every other state keeps the More entry, so the review is never stranded.
	assert.equal(primaryDispatchesReviewIssues({ activeTaskId: null, lifecycleKind: 'fix-blockers' }), false);
	assert.equal(primaryDispatchesReviewIssues({ activeTaskId: null, lifecycleKind: 'publish' }), false);
	assert.equal(primaryDispatchesReviewIssues({ activeTaskId: null, lifecycleKind: 'review-follow-ups' }), false);
	assert.equal(primaryDispatchesReviewIssues({ activeTaskId: 'swap-sessions', lifecycleKind: 'review-warnings' }), false);

	// Wiring: the header threads the decision into More, and More gates the
	// duplicate entry on it (the dropdown content is portal-mounted and cannot
	// render in SSR, so the runtime condition is this decision + this gate).
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /hideReviewIssues=\{moreHidesReviewIssues\}/, 'the header passes the C7 decision');
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the merged warnings control
	// now owns the review dispatch whenever issue review is open; the shared
	// helper still covers an armed review task.
	// assert.match(header, /const moreHidesReviewIssues = primaryDispatchesReviewIssues\(\{/, 'the decision is the shared helper');
	assert.match(header, /const moreHidesReviewIssues = warningsDispatch === 'review-issues' \|\| primaryDispatchesReviewIssues\(\{/, 'the decision is the warnings control plus the shared helper');
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(
		menu,
		/\{hideReviewIssues \? null : \(\s*\n\s*<DropdownMenuItem[^>]*data-testid="timetable-more-review-issues"/,
		'the More entry renders only when the primary does not own it',
	);
});

test('A3: the relocated header controls remain reachable from the More menu (source contract)', () => {
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	for (const testId of ['timetable-more-tutorial', 'timetable-more-status-key', 'timetable-more-day-options', 'timetable-more-map', 'timetable-more-manual-edit', 'timetable-more-building']) {
		assert.ok(menu.includes(testId), `${testId} must be reachable from More`);
	}
	assert.doesNotMatch(menu, /Generate schedule/, 'the duplicate Generate entry is removed from More');
	// One STATUS_ITEMS source is shared with the grid legend.
	assert.match(menu, /STATUS_ITEMS/);
	assert.match(source('src/components/timetable/TimetableStatusLegend.tsx'), /export const STATUS_ITEMS/);
});

/* ── A5 — navigation hygiene and the router warning ─────────────────────── */

test('A5 control: every /timetable* child route carries an explicit null element', () => {
	const app = source('src/App.tsx');
	const parentStart = app.indexOf("path: 'timetable'");
	const nextSibling = app.indexOf("path: 'timetabling/how-it-works'", parentStart);
	assert.ok(parentStart >= 0 && nextSibling > parentStart, 'the timetable route block must be bounded');
	const block = app.slice(parentStart, nextSibling);
	for (const child of ['index: true', "path: 'policies'", "path: 'pre-generation'", "path: 'map'", "path: 'manual-edit'", "path: 'building'", "path: 'exports'", "path: 'runs'", "path: 'setup'"]) {
		assert.ok(
			new RegExp(`\\{ ${child.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, element: null \\}`).test(block),
			`child ${child} must render an explicit null element (clears the element-less leaf warning)`,
		);
	}
});

test('A5: the sub-nav gains a Draft entry and the tools stay reachable from the index', () => {
	const markup = renderToStaticMarkup(
		createElement(MemoryRouter, { initialEntries: ['/timetable'] }, createElement(TimetableSubNav)),
	);
	assert.match(markup, /data-testid="timetable-sub-nav-draft"[^>]*href="\/timetable\/pre-generation"/, 'Draft links to the pre-generation surface');
});

/* ── A7 — scroll restoration wiring ─────────────────────────────────────── */

test('A7: the grid scroll region is wrapped by the scroll-memory unit (source contract)', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	assert.match(center, /<GridScrollMemory scrollTopRef=\{gridScrollTopRef\}/, 'the grid scroll region remembers its position');
	assert.match(center, /const gridScrollTopRef = useRef\(0\)/, 'the position is owned by the always-mounted center panel');
	const memory = source('src/components/timetable/GridScrollMemory.tsx');
	assert.match(memory, /data-radix-scroll-area-viewport/, 'the real Radix viewport is captured');
	assert.match(memory, /viewport\.scrollTop = scrollTopRef\.current/, 'the captured position is restored on mount');
});

/* ── A8 — warning prioritisation and the typography floor ───────────────── */

function renderSeverityGrid(reviewEntryIds: ReadonlySet<string>): string {
	const violation = { severity: 'HARD', entities: { entryIds: ['e-flagged'] } } as unknown as Violation;
	const index = new Map<string, Violation[]>([['e-flagged', [violation]]]);
	return renderToStaticMarkup(createElement(TimetableGrid, {
		entries: [entryFor('e-flagged', 1), entryFor('e-quiet', 1)],
		timeSlots: [{ startTime: '11:30', endTime: '12:15' }],
		violationIndex: index,
		reviewEntryIds,
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

test('A8 control: only entries in the active review set carry a warning marker', () => {
	// The flagged entry is NOT in the active review set: no marker may render.
	const outside = renderSeverityGrid(new Set(['e-other']));
	assert.doesNotMatch(outside, /data-testid="timetable-entry-term-label"[\s\S]*?AlertCircle/, 'a cell outside the review set carries no marker');
	const inside = renderSeverityGrid(new Set(['e-flagged']));
	assert.match(inside, /text-red-500/, 'a HARD entry inside the review set keeps its differentiated marker');
});

test('A8: the /map leaf meets the 12px typography floor', () => {
	const campus = source('src/components/CampusMap.tsx');
	assert.doesNotMatch(campus, /text-\[10px\]/, 'the 10px /map leaf is gone');
	for (const match of campus.matchAll(/text-\[([0-9.]+)(px|rem)\]/g)) {
		const value = match[2] === 'px' ? Number(match[1]) : Number(match[1]) * 16;
		assert.ok(value >= 12, `CampusMap contains ${match[0]}, below the 12px floor`);
	}
});

/* ── C8/C9 — one Confirm per draft placement; the dialog is not a per-drop modal ── */

type DraftDropDecision =
	| { kind: 'pending' }
	| { kind: 'inline-confirm'; softCount: number }
	| { kind: 'review-dialog'; reason: 'no-owner' | 'no-room' | 'no-preview' | 'blocked' };

type DecideDraftDrop = (input: {
	hasFacultyOwner: boolean;
	hasRoom: boolean;
	preview?: { allowed: boolean; hardViolations: { length: number }; softViolations: { length: number } } | null;
}) => DraftDropDecision;

/** The pre-generation drop body, bounded so source assertions cannot drift. */
function stagePreGenDropSource(): string {
	const hook = source('src/hooks/useTimetableMutations.ts');
	const start = hook.indexOf('const stagePreGenDrop');
	const end = hook.indexOf('const runConfirmPreview', start);
	assert.ok(start > 0 && end > start, 'stagePreGenDrop must be locatable in the mutation hook');
	return hook.slice(start, end);
}

test('C8/C9 control: a clean draft slot never opens the review dialog, so one placement never shows two Confirms', async () => {
	const stage = stagePreGenDropSource();
	// Failing-first (as shipped at `ed6b6f05`): `setShowPreGenConfirm(true)` ran
	// unconditionally *before* the authoritative preview resolved, so a clean slot
	// rendered the dialog's "Save placement" beside the inline pending bar's
	// "Save placement" — two visible Confirms for one placement. The drop must now
	// route every dialog open through the shared single-Confirm decision.
	const decisionIndex = stage.indexOf('decideDraftPlacementReview(');
	assert.ok(decisionIndex >= 0, 'the drop must consult the shared single-Confirm decision');
	const firstDialogOpen = stage.indexOf('setShowPreGenConfirm(true)');
	assert.ok(firstDialogOpen >= 0, 'the dialog stays reachable for a genuine blocked consequence');
	assert.ok(decisionIndex < firstDialogOpen, 'the review dialog is only opened through the decision, never before it');
	assert.match(
		stage,
		/kind === 'review-dialog'[\s\S]{0,80}?setShowPreGenConfirm\(true\)/,
		'the dialog opens only for a review-dialog decision',
	);
	// C9 — whenever the dialog is used, the inline pending bar is cleared, so the
	// two save controls can never co-render for one placement.
	const dialogOpenings = stage.split('setShowPreGenConfirm(true)').slice(1);
	assert.ok(dialogOpenings.length > 0, 'the dialog opening sites must be visible to this control');
	for (const tail of dialogOpenings) {
		assert.match(tail.slice(0, 400), /setPreGenPending\(null\)/, 'using the dialog hides the inline Confirm (exactly one save control)');
	}

	const mod = (await import('@/lib/simple-timetable-state')) as unknown as Record<string, unknown>;
	const decide = mod.decideDraftPlacementReview as DecideDraftDrop | undefined;
	assert.equal(typeof decide, 'function', 'the shared draft-drop decision must exist');
	const clean = { allowed: true, hardViolations: [], softViolations: [] };
	assert.deepEqual(decide!({ hasFacultyOwner: true, hasRoom: true, preview: clean }), { kind: 'inline-confirm', softCount: 0 }, 'a clean slot confirms inline — no dialog');
	assert.deepEqual(
		decide!({ hasFacultyOwner: true, hasRoom: true, preview: { allowed: true, hardViolations: [], softViolations: [{}, {}] } }),
		{ kind: 'inline-confirm', softCount: 2 },
		'a soft-warned slot keeps the inline single Confirm and carries its warning count',
	);
	assert.deepEqual(decide!({ hasFacultyOwner: true, hasRoom: true }), { kind: 'pending' }, 'before the preview resolves the drop is pending, never confirmable');
	assert.deepEqual(decide!({ hasFacultyOwner: true, hasRoom: true, preview: null }), { kind: 'review-dialog', reason: 'no-preview' }, 'an unavailable preview never confirms');
	assert.deepEqual(
		decide!({ hasFacultyOwner: true, hasRoom: true, preview: { allowed: false, hardViolations: [{}], softViolations: [] } }),
		{ kind: 'review-dialog', reason: 'blocked' },
		'a blocked slot keeps the detailed review',
	);
	assert.deepEqual(
		decide!({ hasFacultyOwner: true, hasRoom: true, preview: { allowed: true, hardViolations: [{}], softViolations: [] } }),
		{ kind: 'review-dialog', reason: 'blocked' },
		'a preview with hard conflicts never confirms inline',
	);
	assert.deepEqual(decide!({ hasFacultyOwner: false, hasRoom: true, preview: clean }), { kind: 'review-dialog', reason: 'no-owner' }, 'no owner never reaches a Confirm');
	assert.deepEqual(decide!({ hasFacultyOwner: true, hasRoom: false, preview: clean }), { kind: 'review-dialog', reason: 'no-room' }, 'no room never reaches a Confirm');
});

/* ── C10 — every committing draft placement path can be undone ───────────── */

test('C10: the review dialog commit returns its operation identity and registers the same Undo the inline anchor does', () => {
	const hook = source('src/hooks/useTimetableMutations.ts');
	const start = hook.indexOf('const commitConfirmPlacement');
	const end = hook.indexOf('const executeSwapAction', start);
	assert.ok(start > 0 && end > start, 'commitConfirmPlacement must be locatable');
	const commit = hook.slice(start, end);
	assert.match(commit, /Promise<DraftPlacementCommitResult \| null>/, 'the dialog commit exposes its operation identity');
	assert.match(commit, /return data;/, 'the commit result reaches the caller so Undo can be registered');

	const state = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(state, /const wrappedCommitConfirmPlacement = useCallback/, 'the dialog commit is wrapped to register Undo');
	assert.match(state, /commitConfirmPlacement: wrappedCommitConfirmPlacement/, 'the dialogs context receives the Undo-registering wrapper');
	const wrapperStart = state.indexOf('const wrappedCommitConfirmPlacement');
	const wrapper = state.slice(wrapperStart, state.indexOf('const handleEntryClick', wrapperStart));
	assert.match(wrapper, /setLastAutoSaveUndo\(\{/, 'the dialog path registers an Undo target');
	assert.match(wrapper, /editId: result\.operationId/, 'the Undo target is the commit operation');
	assert.match(wrapper, /newVersion: result\.resultingVersion/, 'the Undo target pins the resulting version');
});

/* ── C11 — a draft placement's Undo reverts the draft ledger, not the run ── */

test('C11: a pre-generation draft Undo dispatches the draft-ledger revert, never the run manual-edits revert', async () => {
	// Behavioural control of the routing decision itself. A pre-generation draft
	// commit returns the draft-ledger action id as both operationId and
	// resultingVersion; dispatching that id to the run manual-edits revert always
	// 409s (UNDO_CONFLICT). The strip must therefore route by ledger.
	const { dispatchUndoByLedger } = await import('@/components/timetable/timetableUndoRedoState');
	assert.equal(typeof dispatchUndoByLedger, 'function', 'the ledger-routed Undo dispatch must exist (C11)');

	const dispatched: string[] = [];
	const handlers = {
		revertRunEdit: async (operationId: number, expectedVersion: number) => {
			dispatched.push(`run:${operationId}:${expectedVersion}`);
			return false;
		},
		revertDraftEdit: async (operationId: number, expectedVersion: number) => {
			dispatched.push(`draft:${operationId}:${expectedVersion}`);
			return true;
		},
	};

	const draftOk = await dispatchUndoByLedger({ ledger: 'draft', editId: 25, newVersion: 25 }, handlers);
	assert.deepEqual(dispatched, ['draft:25:25'], 'a draft Undo target dispatches the draft-ledger revert and zero run reverts');
	assert.equal(draftOk, true, 'a successful draft revert is reported to the caller');

	dispatched.length = 0;
	const runOk = await dispatchUndoByLedger({ ledger: 'run', editId: 912, newVersion: 44 }, handlers);
	assert.deepEqual(dispatched, ['run:912:44'], 'a genuine run manual edit keeps the run revert');
	assert.equal(runOk, false, 'the handler result is returned unchanged');

	// A target predating the ledger field is a run edit (the only ledger before C11).
	dispatched.length = 0;
	await dispatchUndoByLedger({ editId: 7, newVersion: 3 }, handlers);
	assert.deepEqual(dispatched, ['run:7:3'], 'a target with no ledger keeps the run revert path');

	// Production wiring — the strip routes by ledger and both draft commit paths
	// register a draft-ledger target.
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /dispatchUndoByLedger\(target,/, 'the Undo strip routes through the ledger dispatch');
	assert.match(workspace, /revertDraftEdit: state\.revertDraftEditById/, 'a draft target dispatches the draft-ledger revert');
	assert.match(workspace, /revertRunEdit: state\.revertEditById/, 'a run target keeps the run manual-edits revert');

	const state = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	const preGenWrapper = state.slice(state.indexOf('const wrappedCommitPreGenPending'), state.indexOf('const wrappedCommitConfirmPlacement'));
	assert.match(preGenWrapper, /ledger: 'draft'/, 'the inline pre-generation draft commit registers a draft-ledger Undo target');
	const dialogStart = state.indexOf('const wrappedCommitConfirmPlacement');
	const dialogWrapper = state.slice(dialogStart, state.indexOf('const handleEntryClick', dialogStart));
	assert.match(dialogWrapper, /ledger: 'draft'/, 'the review-dialog draft commit registers a draft-ledger Undo target');

	const hook = source('src/hooks/useTimetableMutations.ts');
	const draftRevertStart = hook.indexOf('const revertDraftEditById');
	assert.ok(draftRevertStart > 0, 'the draft-ledger revert must exist in the mutation hook');
	const draftRevert = hook.slice(draftRevertStart, hook.indexOf('const redoLastEdit', draftRevertStart));
	assert.match(draftRevert, /pre-generation-drafts\/undo/, 'the draft revert posts to the draft-ledger undo endpoint');
	assert.match(draftRevert, /operationId,[\s\S]{0,40}expectedVersion,/, 'the draft revert sends the operation CAS (operationId + expectedVersion)');
	assert.equal(draftRevert.includes('${apiBase}/revert'), false, 'the draft revert never uses the run manual-edits revert');
});
