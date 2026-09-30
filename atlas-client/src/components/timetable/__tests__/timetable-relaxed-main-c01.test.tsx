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
import { ScheduleReviewWorkspaceHeader } from '../ScheduleReviewWorkspaceHeader';
import { CHANGE_NOTICE_UNVERIFIED_SENTENCE } from '../simple/SimpleChangeNotice';
import { primaryDispatchesReviewIssues } from '../simple/SimpleHeaderHelpers';
import { TimetableGrid } from '../TimetableGrid';
import { TimetableSubNav } from '../TimetableSubNav';
import type { ScheduleReviewWorkspaceHeaderContext } from '../buildScheduleReviewWorkspaceContexts';
import type { DraftReport, GenerationInputComparison, ScheduledEntry, Violation } from '@/types';
import { CENTER_PANE_OWNER, assertCenterPaneOwnerIsRendered, centerPaneSource } from './centerPaneOwner';

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
	// A2-UX-WIRE-C2: the comparison time is corrected to the production shape. The
	// run this fixture's draft belongs to was created at `2031-01-01T00:00:00.000Z`
	// (see `draftWithSummary`), and a STALE comparison the server writes for THAT
	// run is stamped after it exists. The pre-fix value, `2026-09-13`, predates the
	// run by four years, so #59/#17 correctly refuses to read it as a drift claim
	// about a 2031 schedule. The pre-fix, impossible ordering is kept as a control
	// in `timetable-drift-banner-390-a2.test.tsx`.
	//
	// A2 C11 S2 (T3e correction, 2026-09-28): the last sentence of that note was
	// WRONG and is corrected here rather than left to mislead. This fixture is the
	// PROVEN-CHANGE branch. Measured through the production gate
	// (`useRunChangeNotice` -> `describeRunInputDrift` -> `deriveRunFreshness`),
	// `checkedAt 00:05` is AFTER the run's own `createdAt 00:00` on the same day, so
	// the comparison reconciles to `trustworthy: true` and `runDriftClaimSentence`
	// returns a claim. The schedule really IS out of date on this fixture, so the
	// no-change promise T3e used to demand here would have been a lie. The
	// UNPROVEN branch is `unverifiableRoomsInputState()` below, and it is the one
	// that carries the promise.
	return {
		status: 'STALE',
		message: 'Rooms changed.',
		actionHint: 'Review rooms.',
		changedDomains: ['rooms'],
		checkedAt: '2031-01-01T00:05:00.000Z',
	} as unknown as GenerationInputComparison;
}

/**
 * A2 C11 S2 (T3e correction, 2026-09-28) — the UNPROVEN branch.
 *
 * `status: 'UNKNOWN'` is ATLAS saying it could not complete the comparison. The
 * `changedDomains` list is NON-EMPTY ON PURPOSE: a populated domain list is the
 * only thing that could promote an UNKNOWN comparison into a change claim, and the
 * rule says it must not. So this fixture is the discrimination for that specific
 * failure: had the gate derived the claim from `domains.length > 0` instead of from
 * the reconciled freshness, the banner below would name "Rooms" as changed and the
 * promise would be gone.
 *
 * The `checkedAt` is the SAME post-run stamp as `staleRoomsInputState()`, so the
 * only difference between the two fixtures is the server's own verdict. Timing is
 * therefore not what separates the branches here — provability is.
 */
function unverifiableRoomsInputState(): GenerationInputComparison {
	return {
		status: 'UNKNOWN',
		message: 'Could not compare this run with the current school information.',
		actionHint: 'Try the check again.',
		changedDomains: ['rooms'],
		checkedAt: '2031-01-01T00:05:00.000Z',
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

/**
 * A2 C11 S2 (T3e correction) — the SECOND layout, rendered from the same context.
 *
 * Lane C's spec is "the Expert header gets the same one-sentence banner shape. Do
 * not let the two layouts drift onto two different banners", and a promise that
 * only one layout keeps is not a promise. Both headers reach the notice through
 * the ONE `useRunChangeNotice` gate, so this helper exists to prove that, on the
 * same fixtures, rather than to assert the wiring.
 */
function renderExpertHeader(overrides: Record<string, unknown> = {}): string {
	return renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(ScheduleReviewWorkspaceHeader, {
				context: makeContext(overrides),
				onEditDraft: () => {},
				onDiscardDraft: () => {},
			}),
		),
	);
}

/** The ONE drift sentence a rendered header put on screen, or `null` if none. */
function driftSentenceOf(markup: string): string | null {
	return markup.match(/data-testid="timetable-simple-drift-message"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? null;
}

/** Word count of a whole visible drift claim, any age tail included. */
function claimWordCount(sentence: string): number {
	return sentence.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
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
	// SUPERSEDED (A2-C6-TRUTH, T3e, 2026-09-28) — the 21-word sentence this row
	// pinned is gone; the promise it protected is NOT. Measured on live run 321,
	// the band read 21 words (25 when calm) of subordination before the one fact
	// an older reader needs, and it still showed `Preview impact` /
	// `Regenerate to apply` on a run that had not changed. T3e is WORDING ONLY —
	// the `alarming` / `driftClaimed` / `unverifiedNote` / `showRegenerateAction`
	// predicates are untouched, so #17/#59 semantics are unchanged. The row is
	// kept, not deleted: the intent ("the notice makes the no-change promise
	// explicit") is asserted by the replacement immediately below.
	// assert.match(markup, /The current schedule stays unchanged while you review school information\./, 'the notice makes the no-change promise explicit');
	// SUPERSEDED (C11 S2, T3e, 2026-09-28) — the row's PREMISE is wrong for this
	// fixture, not its wording. `staleRoomsInputState()` + draft `runId 42`
	// reconciles to STALE WITH A CLAIMABLE DRIFT CLAIM: the comparison is stamped
	// `2031-01-01T00:05:00.000Z` and the run's own `createdAt` is
	// `2031-01-01T00:00:00.000Z` (`finishedAt` is null), so the comparison is
	// provably NEWER than the run finished. On a schedule that really is out of
	// date, "This schedule is unchanged" is not a shorter sentence — it is a false
	// promise, which is worse than the 21 words it replaced. Kept verbatim, not
	// deleted (AGENTS.md §16); the promise it protected is asserted on the branch
	// that can honestly make it, by the RENDERED replacement below.
	// assert.match(markup, /This schedule is unchanged\./,
	// 	'T3e: the shortened notice still makes the no-change promise explicit');
	// The age tail is part of the visible claim, so the budget is counted over
	// the WHOLE span (sentence + any age tail), not the sentence alone. The new
	// banner renders no age tail, and the budget is now measured over BOTH
	// sentences below.
	const driftMessage = markup.match(/data-testid="timetable-simple-drift-message"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '';
	const claimWords = driftMessage.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
	assert.ok(claimWords > 0 && claimWords <= 12,
		`T3e/A2-C7: the whole drift claim is within the 12-word budget an older reader can hold (measured ${claimWords} incl. the age tail)`);
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

/**
 * A2 C11 S2 — the RENDERED REPLACEMENT for the superseded T3e row above
 * (2026-09-28). Superseding a row is only honest if something enforces its
 * intent, so the intent is now asserted as a rule, on the real header, in BOTH
 * layouts, on BOTH branches.
 *
 * THE LOAD-BEARING RULE: an unproven comparison must not claim a change, and must
 * promise the schedule is unchanged.
 *
 * The gate is not a heuristic and these rows do not ask it to be one.
 * `useRunChangeNotice` hands the run's OWN timing (`finishedAt`/`createdAt`) to
 * `describeRunInputDrift`, which reconciles the comparison's `checkedAt` against
 * it and yields FRESH / STALE / UNKNOWN. Only a comparison ATLAS can tie to the
 * run may claim a change:
 *
 *   STALE (provably newer than the run finished) → the changed sentence plus the
 *     one primary "Update schedule". The schedule really is out of date, so the
 *     no-change promise would be a lie and is asserted ABSENT.
 *   UNKNOWN, or a comparison ATLAS cannot reconcile to the run → the promise
 *     sentence, NO apply action, NO alarm styling. This is the sentence T3e was
 *     protecting, and it is now asserted where it can honestly be made.
 *   FRESH → no notice at all (asserted by the fresh-input row above).
 *
 * DISCRIMINATION, per branch. Each fixture is the other's twin with exactly one
 * field changed (`status`), and the `checkedAt` is the SAME post-run stamp on
 * both, so timing provably cannot be what separates them. A gate that derived the
 * claim from `changedDomains.length > 0` — the tempting shortcut, and the one the
 * non-empty UNKNOWN fixture below is built to catch — would pass the STALE rows
 * and fail the UNKNOWN ones; a gate that promised "unchanged" unconditionally would
 * fail the STALE rows. The rows discriminate in BOTH directions, so neither a
 * silent gate nor an over-promising one can pass this file.
 *
 * These are RENDERED rows. They read the real `TimetableSimpleHeader` and the real
 * `ScheduleReviewWorkspaceHeader`, and every assertion is a boolean, a string or
 * a count — no JSDOM node is ever compared with `assert.equal`.
 */
test('A4 RENDERED: an unproven comparison promises no change in BOTH layouts; a proven one claims it and offers Update', () => {
	const draft = (inputState: GenerationInputComparison) => draftWithSummary(
		{ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false },
		inputState,
	);
	const schoolYearContext = { activeSchoolYearLabel: '2030-2031', source: 'enrollpro-verified', activeTerm: null };
	const layouts: ReadonlyArray<readonly [string, (o: Record<string, unknown>) => string]> = [
		['Simple', renderHeader],
		['Expert', renderExpertHeader],
	];

	for (const [layoutName, render] of layouts) {
		// ── PROVEN CHANGE (STALE) ──────────────────────────────────────────
		const proven = render({ draft: draft(staleRoomsInputState()), schoolYearContext });
		assert.match(proven, /timetable-simple-input-drift/, `${layoutName}: a proven change is on screen`);
		assert.match(proven, /data-drift-status="STALE"/, `${layoutName}: the row reports the reconciled status it was given`);
		assert.match(proven, /data-drift-claimable="true"/, `${layoutName}: a comparison ATLAS can tie to this run MAY claim a change`);
		assert.equal(driftSentenceOf(proven), 'Rooms changed.',
			`${layoutName}: a proven change NAMES the changed area — the server's own changedDomains, not an invented noun`);
		assert.match(proven, /timetable-simple-regenerate-to-apply/, `${layoutName}: a proven change offers the one primary "Update schedule"`);
		assert.equal((proven.match(/timetable-simple-regenerate-to-apply/g) ?? []).length, 1,
			`${layoutName}: and exactly one, never a competing duplicate`);
		// The load-bearing rule's other half, asserted as a NEGATIVE: on a schedule
		// that really did change, the promise is a lie and must not be printed.
		assert.doesNotMatch(proven, /This schedule is unchanged/,
			`${layoutName}: a PROVEN change may not promise the schedule is unchanged — that is the false promise the superseded row would have forced`);
		assert.doesNotMatch(proven, /Could not check school information/,
			`${layoutName}: a PROVEN change is not the unverified branch either`);
		assert.equal(/checked\b|\d+\s*(s|m|h)\s*ago/i.test(driftSentenceOf(proven) ?? ''), false,
			`${layoutName}: the changed sentence carries no relative-age tail, so the word budget below counts the whole claim`);

		// ── UNPROVEN CHANGE (UNKNOWN) ──────────────────────────────────────
		const unproven = render({ draft: draft(unverifiableRoomsInputState()), schoolYearContext });
		assert.match(unproven, /timetable-simple-input-drift/, `${layoutName}: an unverified state is still on screen — "not proven" is not "nothing is wrong"`);
		assert.match(unproven, /data-drift-status="UNKNOWN"/, `${layoutName}: the row reports the reconciled status it was given`);
		assert.match(unproven, /data-drift-claimable="false"/, `${layoutName}: an unproven comparison MAY NOT claim a change`);
		// The sentence T3e was protecting, rendered on the branch that can make it.
		assert.equal(driftSentenceOf(unproven), CHANGE_NOTICE_UNVERIFIED_SENTENCE,
			`${layoutName}: ATLAS could not check, so the row promises the schedule is unchanged instead of claiming a change`);
		assert.match(unproven, /This schedule is unchanged\./,
			`${layoutName}: the no-change promise is explicit`);
		// A non-empty `drift.domains` list must never, by itself, promote UNKNOWN.
		// The fixture's `changedDomains` is ['rooms'] and the names survive in the
		// `sr-only` detail span, so the check is that they are NOT in the sentence.
		assert.match(unproven, /data-testid="timetable-simple-change-areas"[^>]*>Rooms</,
			`${layoutName}: the area name is still carried for assistive tech and the detail dialog`);
		assert.doesNotMatch(unproven, /Rooms changed/,
			`${layoutName}: a non-empty changedDomains list does NOT by itself turn an UNKNOWN comparison into a change claim`);
		assert.doesNotMatch(unproven, />Rooms changed since/,
			`${layoutName}: nor does it leak the changed sentence anywhere in the row`);
		// No apply action: there is nothing proven to apply, so the affordance is not
		// mounted. A disabled control would still be a control offering to do it.
		assert.doesNotMatch(unproven, /timetable-simple-regenerate-to-apply/,
			`${layoutName}: an unproven comparison mounts NO apply action at all`);
		assert.doesNotMatch(unproven, /Update schedule/,
			`${layoutName}: and states the "Update schedule" verb nowhere, so the promise and the offer cannot contradict each other`);
		assert.doesNotMatch(unproven, /timetable-simple-regenerate-preservation-note/,
			`${layoutName}: no regeneration dialog is mounted, because nothing was triggered`);
		// The secondary (the detail) may stay: it shows what ATLAS knows, which is
		// not a claim and not an action on the schedule.
		assert.match(unproven, /timetable-simple-impact-preview/,
			`${layoutName}: the read-only detail stays available — suppressing information is not the same as being honest`);
		// No alarm styling on the unproven branch: two confidences must not share
		// one alarm, and nothing is wrong yet.
		const unprovenBand = unproven.match(/<div[^>]*data-testid="timetable-simple-input-drift"[^>]*>/)?.[0] ?? '';
		assert.match(unprovenBand, /bg-muted\/40/, `${layoutName}: the unproven row wears the calm-note styling`);
		assert.equal(/red|destructive|amber/.test(unprovenBand), false,
			`${layoutName}: and no alarm class of any kind`);

		// ── THE 12-WORD BUDGET, OVER BOTH SENTENCES ────────────────────────
		// The budget is counted over the WHOLE visible claim, any age tail
		// included, and it has to hold for the promise sentence as well as the
		// changed one — a promise that does not fit is still a promise owed.
		for (const [branch, sentence] of [
			['proven', driftSentenceOf(proven) ?? ''],
			['unproven', driftSentenceOf(unproven) ?? ''],
		] as const) {
			const words = claimWordCount(sentence);
			assert.ok(words > 0 && words <= 12,
				`${layoutName}/${branch}: the whole drift claim is within the 12-word budget an older reader can hold (measured ${words} incl. any age tail)`);
		}
	}
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
	// ── SUPERSEDED IN PLACE, 2026-09-29, A2 HEADER-BUDGET (operator) ──
	// AGENTS.md §8's "Header budget" caps the `<header>` BOX at two calm rows, and
	// the in-header status region was the surface that made the box a third band.
	// The status line is now `SimpleHeaderStatusBand` in
	// `simple/SimpleHeaderTrailingSurfaces.tsx`, a SIBLING of `</header>`, with
	// `data-testid="timetable-simple-status-band"`. The structural pin is retained
	// VERBATIM and is NOT run as pass/fail:
	//   assert.equal((markup.match(/data-testid="timetable-simple-status-region"/g) ?? []).length, 1, 'exactly one status region');
	//
	// THE CLAIM IS UNCHANGED — "exactly one status surface, never two" — only the
	// element that carries it moved. The two assertions below restate it: exactly
	// ONE band renders, and the superseded in-box region renders ZERO times, so the
	// old surface cannot quietly come back alongside the new one.
	assert.equal((markup.match(/data-testid="timetable-simple-status-band"/g) ?? []).length, 1, 'exactly one status surface');
	assert.equal((markup.match(/data-testid="timetable-simple-status-region"/g) ?? []).length, 0, 'and the superseded in-box status region is gone');
	// It is a SIBLING of the header box, not a child of it — read on the RENDERED
	// output, because counting the one element is not enough: a status line mounted
	// back at the END of the `<header>` would still render exactly once. The box's
	// own closing tag has to come first. `renderToStaticMarkup` emits no comments,
	// so this is the element's real closing tag. (This assertion was added after a
	// mutant that re-mounted the surface inside `</header>` PASSED the rest of the
	// row; the D1 row in `timetable-header-collapse-c01` records the same finding.)
	assert.ok(markup.indexOf('</header>') < markup.indexOf('data-testid="timetable-simple-status-band"'),
		'the one status surface renders after the header box closes — a sibling, not a third row inside it');
	// C5 — the ONE status chip. It is a row-1 control now, not a child of a status
	// region, so the message is corrected to the structure that is actually
	// asserted; the assertion itself is unchanged.
	assert.match(markup, /data-testid="timetable-simple-readiness-chip"/, 'the one status chip still renders in the header');
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
	//
	// A2 HEADER-BUDGET (operator, 2026-09-29) — RE-PINNED, and the reason is
	// recorded rather than the assertion quietly rewritten. This row is a
	// SOURCE-text row because the property it protects is the SOURCE of a JSX
	// attribute, which no rendered-DOM assertion can distinguish. Two things moved
	// in one slice, and both are pinned below.
	//
	// SUPERSEDED IN PLACE. The old pins named `simple/SimpleHeaderStatusStrip.tsx`
	// and `<section data-testid="timetable-simple-status-region">` as the owner of
	// the status markup, and the header mounted `<SimpleHeaderStatusStrip>`:
	//   assert.match(statusStrip, /<section[^>]*data-testid="timetable-simple-status-region"/, 'the status region markup lives in the extracted status strip');
	//   assert.match(header, /<SimpleHeaderStatusStrip/, 'and the header renders that strip rather than the region itself');
	// §8's header budget moved the status line OUT of the `<header>` box to a
	// SIBLING, so the owner is now `simple/SimpleHeaderTrailingSurfaces.tsx` and
	// the element is `data-testid="timetable-simple-status-band"`. The
	// `SimpleHeaderStatusStrip` MODULE is NOT deleted — `SimpleHeaderOrientationRow`
	// still uses it — so pinning its disappearance would be wrong; pinning the new
	// owner is what the row is for.
	//
	// WHAT IS STILL LOAD-BEARING, and asserted below: the status line carries NO
	// card chrome, and NO extra band padding is added below the header box. The
	// defect this row was written for was a header that stacked bordered, padded
	// card bands. Two honest notes on what that means now:
	//   - the band DOES carry a one-line `py-1` and a `border-b`. It is a single
	//     calm line under the box, not a card, and §8 caps the BOX at two rows
	//     rather than forbidding content below it. So the card-chrome assertion
	//     below reads `rounded-` / `shadow-` / `mt-1` / `mb-1`, and the padding
	//     assertion pins the ONE thin line rather than forbidding padding outright.
	//   - the CONTROL ROW's old `pb-1.5` assertion is superseded: row 2 is now the
	//     box's LAST row and its `pb-1.5` is the box's own bottom breathing room,
	//     inside the box, not a band under it. The claim it protected — no extra
	//     vertical band — is now asserted as "one line below the box, and it is
	//     this one", which is what the count assertions decide.
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const statusStrip = source('src/components/timetable/simple/SimpleHeaderStatusStrip.tsx');
	const trailing = source('src/components/timetable/simple/SimpleHeaderTrailingSurfaces.tsx');
	// DISCRIMINATION: the pin names the file that owns the status markup, so a
	// silent move of it into some third module fails here rather than passing by
	// reading an empty string.
	assert.match(trailing, /data-testid="timetable-simple-status-band"/,
		'the status line markup lives in the trailing surfaces module');
	assert.match(header, /<SimpleHeaderTrailingSurfaces/,
		'and the header renders that surface, so the line is actually mounted');
	// The module the header no longer uses is untouched and still exported, so this
	// row cannot pass by reading an empty file.
	assert.match(statusStrip, /data-testid="timetable-simple-status-region"/,
		'the superseded status-strip module still owns its own region for the Expert surface');
	assert.equal((header.match(/<SimpleHeaderTrailingSurfaces/g) ?? []).length, 1,
		'exactly one trailing surface is mounted — the status line cannot be doubled');
	// EXACTLY ONE status line across the whole header surface. A second copy in
	// EITHER file still fails this row.
	assert.equal((`${header}\n${trailing}`.match(/data-testid="timetable-simple-status-band"/g) ?? []).length, 1,
		'exactly one status line element');
	// NO CARD CHROME on the line: no margin band, no rounded card, no shadow.
	const bandTag = trailing.match(/<div[^>]*data-testid="timetable-simple-status-band"[^>]*>/)?.[0];
	assert.ok(bandTag, 'the status line still renders');
	assert.doesNotMatch(bandTag, /mt-1|mb-1|rounded-|shadow-|ring-/,
		'the status line renders no bordered/padded card band of its own');
	// NO EXTRA BAND PADDING BELOW THE HEADER BOX. Read as the THINNESS of the one
	// line plus the fact that nothing else follows the box: a second padded band,
	// or a line that grows, fails here.
	assert.match(bandTag, /py-1/, 'the status line keeps its one thin line of padding');
	assert.doesNotMatch(bandTag, /py-[2-9]|py-\[|pb-[2-9]|pt-[2-9]/,
		'and that line never grows into a band');
	// The header BOX itself is the two rows and nothing else: exactly one row band,
	// the line is mounted after the box rather than inside it, and the box's own
	// element is the one §8 bounds. (A `</header>` COUNT is deliberately not used:
	// the file's record comments quote the tag in prose, so counting it would read
	// a comment. This reads the element's own literal and its position instead.)
	assert.equal((header.match(/data-testid="timetable-simple-header-row"/g) ?? []).length, 1,
		'exactly one header row band');
	assert.equal((header.match(/data-testid="timetable-simple-status-band"/g) ?? []).length, 0,
		'the status line is not inside the header box');
	const headerBoxAt = header.indexOf('<header className="shrink-0 border-b border-border bg-background" data-testid="timetable-simple-header">');
	assert.ok(headerBoxAt >= 0, 'the header box element is the one §8 bounds');
	assert.ok(header.indexOf('<SimpleHeaderTrailingSurfaces') > headerBoxAt,
		'and the status line is mounted AFTER the box, as a sibling, not inside it');
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
	// MECHANISM SUPERSEDED 2026-09-28 (A2 C12 item 1, on Lane C's ruling that the
	// header is at most 2 visual rows at 1366 px): this cluster no longer WRAPS from
	// `lg` up. The requirement the row protects is unchanged and still asserted
	// below — no horizontally scrolling strip can clip the primary, and the primary
	// cluster holds one line at `lg`. What changed is that pressure is absorbed by
	// truncation rather than by a second line.
	//
	// SUPERSEDED AGAIN IN PLACE, 2026-09-29, A2 HEADER-BUDGET (operator). The
	// cluster is now
	//   `flex min-w-0 flex-wrap items-center gap-1.5 pr-3 lg:ml-auto lg:flex-nowrap lg:justify-end`
	// — row 1's right-aligned group now holds the tabs before it, so the cluster
	// carries its own trailing padding (`pr-3`) and the `justify-start` token is
	// gone. The original assertion is retained VERBATIM and is NOT run as pass/fail,
	// because it pinned a full class string including that token:
	//   assert.match(markup, /class="flex min-w-0 flex-wrap items-center justify-start gap-1\.5 lg:ml-auto lg:flex-nowrap lg:justify-end"/, 'the primary cluster does not wrap from lg up: one visual line, no scrolling strip');
	//
	// WHAT REPLACES IT is the requirement without the brittle part: the same
	// cluster, identified by the tokens it MUST carry, and not by a token it
	// happened to carry. Dropping `lg:flex-nowrap` fails the first assertion; adding
	// `overflow-x-auto` fails the second. That is strictly more discriminating than
	// the exact-string form, which failed on a harmless `pr-3` and would have
	// failed again on the next class change.
	const cluster = markup.match(/<div class="[^"]*lg:flex-nowrap[^"]*">/)?.[0] ?? '';
	assert.ok(cluster, 'the primary / Undo / More cluster renders');
	assert.match(cluster, /class="flex min-w-0 flex-wrap items-center[^"]*lg:flex-nowrap[^"]*"/,
		'the primary cluster does not wrap from lg up: one visual line, no scrolling strip');
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

	// Wiring: A7 c12b (decision 8 / CORRECTION item 1) DELETED the More
	// `Review issues` entry together with the `Expert tools` group, so the C7
	// duplicate is now impossible BY CONSTRUCTION rather than gated. The old wiring
	// is retained as the superseded row (AGENTS.md §16):
	//   assert.match(header, /hideReviewIssues=\{moreHidesReviewIssues\}/, 'the header passes the C7 decision');
	//   assert.match(header, /const moreHidesReviewIssues = warningsDispatch === 'review-issues' \|\| primaryDispatchesReviewIssues\(\{/);
	//   assert.match(menu, /\{hideReviewIssues \? null : \(\s*\n\s*<DropdownMenuItem[^>]*data-testid="timetable-more-review-issues"/);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.doesNotMatch(header, /moreHidesReviewIssues|hideReviewIssues=/,
		'the header no longer threads the C7 decision, because the More entry it guarded is gone');
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.doesNotMatch(menu, /timetable-more-review-issues/,
		'the More review-issues entry is deleted with the Expert tools group');
	assert.doesNotMatch(menu, /hideReviewIssues/, 'and the gate that guarded it is gone');
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
	// C11 slice 1 (F4) — the centre-pane chain moved to
	// `CenterWorkspacePaneSurface.tsx` (the AGENTS.md §8 cap, plus F4's
	// requirement for a rendered row on the real surface). The property decided
	// here is UNCHANGED and nothing was removed or weakened; only the owning
	// module is read now, and `assertCenterPaneOwnerIsRendered()` pins the new
	// owner to the one CenterWorkspace actually renders.
	assertCenterPaneOwnerIsRendered();
	const center = centerPaneSource(CENTER_PANE_OWNER);
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
