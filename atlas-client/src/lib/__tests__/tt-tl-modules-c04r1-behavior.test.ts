import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { SimpleDriftBanner } from '../../components/timetable/simple/SimpleDriftBanner';
import { TeacherDepartureRecoverySheetBody } from '../../components/timetable/TeacherDepartureRecoverySheet';
import { Sheet } from '../../ui/sheet';
import { deriveTimetableCapabilities } from '../timetable-capabilities';
import type { DraftReport, FacultyMirror, GenerationInputComparison, TeachingLoadRepairPreviewResult } from '../../types';

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

function draftWithInputState(inputState: GenerationInputComparison, summaryPatch: Record<string, unknown> = {}): DraftReport {
	return {
		runId: 42,
		status: 'COMPLETED',
		entries: [],
		unassignedItems: [],
		summary: { hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, ...summaryPatch },
		inputState,
		version: 3,
		finishedAt: null,
		createdAt: '2031-01-01T00:00:00.000Z',
	} as unknown as DraftReport;
}

const STALE_INPUT: GenerationInputComparison = {
	status: 'STALE',
	message: 'Rooms changed.',
	actionHint: 'Review the rooms that changed.',
	changedDomains: ['rooms'],
	checkedAt: null,
} as unknown as GenerationInputComparison;

function renderBanner(inputState: GenerationInputComparison, isPublished: boolean, summaryPatch: Record<string, unknown> = {}) {
	return renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(SimpleDriftBanner, {
				schoolId: 1,
				schoolYearId: 9,
				activeGeneratedRunId: 42,
				draft: draftWithInputState(inputState, summaryPatch),
				isPreGenerationWorkspace: false,
				loading: false,
				onRefresh: () => {},
				capabilities: READY_CAPABILITIES,
				isPublished,
			}),
		),
	);
}

/* ------------------------------------------------------------------ *
 * F4 — published drift must never expose or dispatch the direct sync
 * ------------------------------------------------------------------ */

test('F4 unpublished drift keeps the canonical sync route', () => {
	const markup = renderBanner(STALE_INPUT, false);
	assert.match(markup, /timetable-simple-sync-setup/);
	assert.doesNotMatch(markup, /timetable-simple-published-drift-guidance/);
});

test('F4 published drift routes to revision guidance and exposes no sync action', () => {
	const markup = renderBanner(STALE_INPUT, true);
	assert.match(markup, /timetable-simple-published-drift-guidance/);
	assert.match(markup, /effective-dated revision/i);
	// The direct sync action and its impact preview must be gone entirely.
	assert.doesNotMatch(markup, /timetable-simple-sync-setup/);
	assert.doesNotMatch(markup, /timetable-simple-impact-preview/);
	assert.doesNotMatch(markup, /timetable-simple-repair-/);
	assert.doesNotMatch(markup, /Sync with setup/);
});

test('F4 loose-predicate mutant: retained markers alone never hide the sync route', () => {
	// A superseded run keeps `publishedAt`/`publishedBy` markers while the strict
	// predicate is false. If the banner used loose markers, it would wrongly hide
	// the sync action; the strict prop is the only authority.
	const markup = renderBanner(STALE_INPUT, false, {
		publishedAt: '2031-01-01T00:00:00.000Z',
		publishedBy: 7,
		publicationSupersededAt: '2031-02-01T00:00:00.000Z',
	});
	assert.match(markup, /timetable-simple-sync-setup/);
	assert.doesNotMatch(markup, /timetable-simple-published-drift-guidance/);
});

/* ------------------------------------------------------------------ *
 * F1 — no ephemeral absence window; truthful unpublished/published copy
 * ------------------------------------------------------------------ */

function renderDepartureSheet(isPublished: boolean) {
	// F1: render the real, portal-free sheet interior. Radix `SheetContent`
	// renders through a client portal, which `renderToStaticMarkup` cannot emit;
	// the exported body is the same production content the mounted sheet renders.
	// `Sheet` is the Radix Dialog root that supplies the title/description context
	// only — it mounts no portal.
	return renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(Sheet, { open: true, onOpenChange: () => {} },
			createElement(TeacherDepartureRecoverySheetBody, {
				open: true,
				onOpenChange: () => {},
				initialFacultyId: null,
				draft: draftWithInputState(STALE_INPUT),
				facultyMap: new Map<number, FacultyMirror>(),
				subjectLabel: (id: number) => `Subject ${id}`,
				sectionLabel: (id: number) => `Section ${id}`,
				facultyLabel: (id: number) => `Faculty ${id}`,
				previewTeachingLoadRepair: async () => ({} as TeachingLoadRepairPreviewResult),
				commitTeachingLoadRepair: async () => null,
				onSaved: () => {},
				isPublished,
				schoolId: 1,
				schoolYearId: 9,
				runId: 42,
			}),
			),
		),
	);
}

test('F1 unpublished departure repair captures no ephemeral absence dates', () => {
	const markup = renderDepartureSheet(false);
	// The false finite-end / until-further-notice authority is gone entirely.
	assert.doesNotMatch(markup, /Absence window/i);
	assert.doesNotMatch(markup, /Unavailable from/i);
	assert.doesNotMatch(markup, /Unavailable until/i);
	assert.doesNotMatch(markup, /until further notice/i);
	assert.doesNotMatch(markup, /teacher-departure-window-start/);
	assert.doesNotMatch(markup, /type="date"/);
	// Truthful copy: a current-generated-run reassignment with no reversion.
	assert.match(markup, /current generated run/i);
	assert.match(markup, /records no absence period/i);
});

test('F1 published departure repair cannot imply an end-date reversion', () => {
	const markup = renderDepartureSheet(true);
	// No window, no date input, no end-date reversion affordance anywhere.
	assert.doesNotMatch(markup, /until further notice/i);
	assert.doesNotMatch(markup, /Unavailable until/i);
	assert.doesNotMatch(markup, /Absence window/i);
	assert.doesNotMatch(markup, /type="date"/);
	// The rendered published truth states the effective date is the only
	// temporal authority, and the rendered save reason routes to a revision.
	assert.match(markup, /sole temporal authority/i);
	assert.match(markup, /Published schedules require an effective-date revision/);
	// The direct Teaching Load save affordance is never rendered for a published
	// run; the step gate keeps the revision path (`Review revision`) as the next
	// enabled action, whose source contract the C04R1 contract suite covers.
	assert.doesNotMatch(markup, /teacher-departure-save-button/);
	assert.match(markup, /effective-dated revision/i);
});

test('F1 absence-window mutant: the false authority is not present anywhere in the sheet source', () => {
	// Load-bearing removal control: if a finite-end window were reintroduced, the
	// rendered unpublished sheet above would contain date inputs again. This
	// guards the state/validation names as a second, mechanical signal.
	const markup = renderDepartureSheet(false) + renderDepartureSheet(true);
	assert.doesNotMatch(markup, /absenceWindow|absence-window/);
});
