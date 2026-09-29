/**
 * DASHBOARD-TRUTH-C01 (Lane A) — Dashboard blocker truthfulness (hermetic).
 *
 * The measured defect: the Scheduling Dashboard presented a combined HARD+SOFT
 * total as "review blockers". The latest run's `runs/latest/violations` report
 * is TERM-FILTERED HARD+SOFT (`buildViolationReport` -> `filterViolationsByTerm`)
 * and has no `totalCount`; the only truthful run-wide blocker authority is
 * `counts.runWide.blockingHard` (else `counts.runWide.hard`), with
 * `counts.runWide.soft` as the acknowledged warning total.
 *
 * These tests exercise the REAL surfaces with a 0 HARD / 335 SOFT fixture and
 * assert the resulting strings, plus a `null`/unavailable control where the
 * truthful count cannot be resolved.
 *
 * Failing-first: every assertion in this file fails against the pre-fix source
 * (combined total rendered as blockers; `resolveRunWide*` absent).
 *
 * Run: `npx tsx --test src/lib/__tests__/dashboard-truth-c01.test.ts`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import * as DashboardDataModule from '@/hooks/useDashboardData';
import * as DashboardPage from '@/pages/Dashboard';
import * as ReadinessCardModule from '@/components/dashboard/ReadinessCard';
import type { ReadinessRow } from '@/components/dashboard/ReadinessCard';

const READINESS_CARD_SOURCE = readFileSync(
	resolve(import.meta.dirname, '../../components/dashboard/ReadinessCard.tsx'),
	'utf8',
);

// Namespace access keeps the failing-first control granular: on the pre-fix
// source these are `undefined` and the individual tests fail with a clear
// TypeError instead of aborting the whole module link.
const {
	resolveRunWideHardViolationCount,
	resolveRunWideSoftViolationCount,
} = DashboardDataModule as unknown as {
	resolveRunWideHardViolationCount: (report: unknown) => number | null;
	resolveRunWideSoftViolationCount: (report: unknown) => number | null;
};
const {
	pickNextStep,
	buildRunReviewChecklistItem,
	RunBlockerTile,
	ActiveTermHardViolationsRow,
} = DashboardPage as unknown as {
	pickNextStep: (args: Record<string, unknown>) => { title: string; body: string; cta: string; href: string; warn?: string };
	buildRunReviewChecklistItem: (args: Record<string, unknown>) => { label: string; done: boolean; href: string; hint?: string };
	RunBlockerTile: (props: Record<string, unknown>) => unknown;
	ActiveTermHardViolationsRow: (props: Record<string, unknown>) => unknown;
};

// 0 HARD / 335 SOFT — the measured production shape.
const FIXTURE_0_HARD_335_SOFT = {
	counts: { runWide: { total: 335, hard: 0, blockingHard: 0, soft: 335, byCode: {} } },
};
const FIXTURE_UNAVAILABLE = { counts: { total: 335 } };

const DASHBOARD_SOURCE = readFileSync(
	resolve(import.meta.dirname, '../../pages/Dashboard.tsx'),
	'utf8',
);

function reviewArgs(overrides: Record<string, unknown>) {
	return {
		phase: 'REVIEW',
		subjectCount: 22,
		facultyCount: 42,
		sectionCount: 20,
		unassignedSubjectCount: 0,
		missingCoverageSubjectIds: [],
		buildingsDone: true,
		latestRunStatus: 'COMPLETED',
		hardViolationCount: null,
		softViolationCount: null,
		derivedDemand: null,
		degraded: false,
		...overrides,
	};
}

// ─── A1: truthful run-wide HARD provenance ──────────────────────────────────

test('DTC01-A1: the run-wide HARD count prefers blockingHard, then hard — never the combined total', () => {
	assert.equal(resolveRunWideHardViolationCount(FIXTURE_0_HARD_335_SOFT), 0);
	assert.equal(resolveRunWideHardViolationCount({ counts: { runWide: { hard: 4, soft: 9 } } }), 4);
	assert.equal(
		resolveRunWideHardViolationCount({ counts: { runWide: { hard: 4, blockingHard: 2 } } }),
		2,
		'the allowlist-filtered blockingHard wins over the unfiltered hard count',
	);
});

test('DTC01-A1 null control: a report without run-wide counts resolves to null, never 0 or a term-filtered length', () => {
	assert.equal(resolveRunWideHardViolationCount(FIXTURE_UNAVAILABLE), null);
	assert.equal(resolveRunWideHardViolationCount(null), null);
	assert.equal(resolveRunWideHardViolationCount(undefined), null);
});

test('DTC01-A2: the run-wide SOFT warning total resolves truthfully, null when absent', () => {
	assert.equal(resolveRunWideSoftViolationCount(FIXTURE_0_HARD_335_SOFT), 335);
	assert.equal(resolveRunWideSoftViolationCount({ counts: { runWide: { hard: 0 } } }), null);
	assert.equal(resolveRunWideSoftViolationCount(null), null);
});

// ─── S1 surfaces (1) callout, (2) checklist, (3) tile, (4) term row ─────────

test('DTC01-S1 surface 1 (lifecycle callout): 0 HARD / 335 SOFT never claims blockers and states the warnings', () => {
	const next = pickNextStep(reviewArgs({ hardViolationCount: 0, softViolationCount: 335 }));
	assert.doesNotMatch(next.warn ?? '', /blocker/i, 'the callout must not claim blockers for SOFT-only');
	assert.doesNotMatch(next.title, /resolve scheduling violations/i);
	assert.match(next.body, /no hard violations/i);
	assert.match(next.body, /335 warning/i, 'the acknowledged SOFT total must not be silently dropped');
});

test('DTC01-S1 surface 1 null control: an unresolved HARD count never reads as clean or publishable', () => {
	const next = pickNextStep(reviewArgs({ hardViolationCount: null, softViolationCount: null }));
	const text = `${next.title} ${next.body} ${next.warn ?? ''}`;
	assert.doesNotMatch(text, /no hard violations/i, 'null must never render as a clean "no hard violations" claim');
	assert.notEqual(next.href, '/schedules', 'an unresolved HARD count must not route to publish');
	assert.match(text, /unavailable|could not read/i);
});

test('DTC01-A3/S3: 0 HARD / 335 SOFT marks the review step done, with warnings labelled (not blockers)', () => {
	const item = buildRunReviewChecklistItem({
		generationAvailable: true,
		latestRunStatus: 'COMPLETED',
		hardViolationCount: 0,
		softViolationCount: 335,
	});
	assert.equal(item.done, true, 'SOFT-only violations must not block the review step');
	assert.doesNotMatch(item.hint ?? '', /blocker/i);
	assert.match(item.hint ?? '', /335 warning/i);
});

test('DTC01-S1 surface 2: a non-zero run-wide HARD count keeps the step incomplete with hard-only language', () => {
	const item = buildRunReviewChecklistItem({
		generationAvailable: true,
		latestRunStatus: 'COMPLETED',
		hardViolationCount: 2,
		softViolationCount: 335,
	});
	assert.equal(item.done, false);
	assert.match(item.hint ?? '', /2 run-wide hard blocker/i);
});

test('DTC01-S1 surface 2 null control: an unresolved HARD count is not done and says so', () => {
	const item = buildRunReviewChecklistItem({
		generationAvailable: true,
		latestRunStatus: 'COMPLETED',
		hardViolationCount: null,
		softViolationCount: null,
	});
	assert.equal(item.done, false, 'an unavailable count must never read as clean');
	// A7 C6 COPY RE-BASELINE (additive — the row and its intent are kept).
	// OLD PIN: /unavailable/i. NEW SENTENCE: "ATLAS could not count the problems
	// that must be fixed. Open the timetable to check."
	// The intent was never the word "unavailable" — it was "an unresolved count
	// must SAY SO, and say what to do". Both halves are now asserted, and the
	// second half is a stronger claim than the old pin made.
	assert.match(item.hint ?? '', /could not count the problems that must be fixed/i, 'the step must say what could not be established');
	assert.match(item.hint ?? '', /Open the timetable to check/i, 'and it must say what the scheduler does about it');
	assert.doesNotMatch(item.hint ?? '', /^0$|\bno problems\b/i, 'and it must never read as a clean run');
});

test('DTC01-S1 surface 3 (header tile): 0 HARD / 335 SOFT renders no blocker claim', () => {
	const html = renderToStaticMarkup(createElement(RunBlockerTile as never, {
		generationAvailable: true,
		hardViolationCount: 0,
		softViolationCount: 335,
	} as never));
	assert.doesNotMatch(html, /blocker/i);
	// A7 C6 COPY RE-BASELINE (additive).
	// OLD: "No hard violations". NEW: "No problems must be fixed".
	// OLD SOFT WORDING: "335 warnings acknowledged".
	// NEW: "335 preferences the draft could not meet" — the packet's own plain
	// wording, and a MORE truthful one: a SOFT violation is an unmet preference,
	// not a defect in the timetable. The count itself is still asserted.
	assert.match(html, /No problems must be fixed/);
	assert.match(html, /335 preferences the draft could not meet/i, 'the acknowledged SOFT total must still be rendered as a figure, in plain words');
});

test('DTC01-S1 surface 3: a non-zero run-wide HARD count is labelled run-wide', () => {
	const html = renderToStaticMarkup(createElement(RunBlockerTile as never, {
		generationAvailable: true,
		hardViolationCount: 3,
		softViolationCount: 335,
	} as never));
	// A7 C6 COPY RE-BASELINE (additive) + A7 C6 SOURCE FIX.
	// OLD PIN: /3 run-wide review blockers/ — which asserted the COUNT and the
	// RUN-WIDE SCOPE. The first plain-words pass dropped "run-wide" and lost the
	// scope, so the SOURCE was corrected to say "across the whole timetable"
	// rather than the pin being weakened. Both halves are asserted below, and a
	// term-scoped claim is now explicitly rejected.
	assert.match(html, />3\b/, 'the run-wide HARD count must still be rendered');
	assert.match(html, /across the whole timetable/i, 'the figure must still declare that it covers the whole timetable, not one term');
	assert.doesNotMatch(html, /this term|selected term/i, 'it must never be presented as a term-scoped figure');
});

test('DTC01-S1 surface 3 null control: an unresolved HARD count never renders 0 or "No blockers"', () => {
	const html = renderToStaticMarkup(createElement(RunBlockerTile as never, {
		generationAvailable: true,
		hardViolationCount: null,
		softViolationCount: null,
	} as never));
	assert.doesNotMatch(html, /No blockers/i);
	assert.doesNotMatch(html, /No problems must be fixed/i);
	// A7 C6 COPY RE-BASELINE (additive).
	// OLD PIN: /unavailable/i. NEW: "ATLAS could not count the problems that must
	// be fixed. Open the timetable to check." — the packet requires the row to say
	// what is unavailable AND what to check, so both are asserted.
	assert.match(html, /could not count the problems that must be fixed/i);
	assert.match(html, /Open the timetable to check/i);
	assert.doesNotMatch(html, />0</, 'an unresolved count must never render a zero figure');
});

test('DTC01-S1 surface 4 (term popover): the hard row is run-wide, absent at 0, explicit when unavailable', () => {
	const zero = renderToStaticMarkup(createElement(ActiveTermHardViolationsRow as never, { count: 0 } as never));
	assert.equal(zero, '', 'a zero hard count renders no figure at all (no non-zero problem row)');
	const blocked = renderToStaticMarkup(createElement(ActiveTermHardViolationsRow as never, { count: 4 } as never));
	// A7 C6 COPY RE-BASELINE (additive) + A7 C6 SOURCE FIX.
	// OLD PIN: /Hard violations \(run-wide\)/. NEW: "Problems that must be fixed in
	// the whole timetable" — plain words that still declare the scope.
	assert.match(blocked, /in the whole timetable/i, 'the row must still declare that it covers the whole timetable');
	assert.match(blocked, />4</);
	const unavailable = renderToStaticMarkup(createElement(ActiveTermHardViolationsRow as never, { count: null } as never));
	// OLD PIN: /Unavailable/. NEW: "Could not count them" — the plain-words form of
	// the same truth (an unresolved count is never a zero).
	assert.match(unavailable, /Could not count them/i);
	assert.doesNotMatch(unavailable, />0</);
});

// ─── A7 C6: the UNRESOLVED bucket (QA F2) ────────────────────────────────────
//
// The defect these guard: an unresolved violation count was promoted into the
// "not ready" enumeration and given the amber next-task ring, so a Dashboard
// could read "NOT READY: TIMETABLE MADE AND CHECKED" beside "Schedule is
// published" — telling an older scheduler their published timetable was broken
// when the data established only that ATLAS could not COUNT.
//
// The card's promise is now three buckets, not two, so these assert the
// bucketing and the header, both through the pure functions the card itself
// calls. Reachable from the committed `test:dashboard-truth-c01` script.

const { bucketReadinessRows, readinessHeaderText } = ReadinessCardModule as unknown as {
	bucketReadinessRows: (rows: ReadinessRow[]) => { done: ReadinessRow[]; outstanding: ReadinessRow[]; unresolved: ReadinessRow[] };
	readinessHeaderText: (rows: ReadinessRow[]) => string;
};

/**
 * A7 C6 — the shape QA had to force, kept as the fixture every row below uses:
 * the unresolved row is deliberately NOT last, it sits between an outstanding
 * row and a done one.
 */
const THREE_BUCKET_ROWS: ReadinessRow[] = [
	{ label: 'School year and terms set', done: true, href: '/admin/year-setup' },
	{ label: 'Subjects added', done: false, href: '/subjects' },
	{ label: 'Timetable made and checked', done: false, unresolved: true, href: '/timetable', hint: 'ATLAS could not count the problems that must be fixed. Open the timetable to check.' },
	{ label: 'Teaching rooms marked', done: true, href: '/map' },
	{ label: 'Schedule published', done: true, href: '/schedules' },
];

test('A7C6-R2 buckets: an unresolved row is neither done nor outstanding', () => {
	const { done, outstanding, unresolved } = bucketReadinessRows(THREE_BUCKET_ROWS);

	assert.deepEqual(done.map((r) => r.label), ['School year and terms set', 'Teaching rooms marked', 'Schedule published']);
	assert.deepEqual(outstanding.map((r) => r.label), ['Subjects added'], 'only the row whose data came back and says incomplete is outstanding');
	assert.deepEqual(unresolved.map((r) => r.label), ['Timetable made and checked'], 'a read that never arrived is not outstanding work');
});

test('A7C6-R2 buckets: the three buckets partition the input exactly once', () => {
	const { done, outstanding, unresolved } = bucketReadinessRows(THREE_BUCKET_ROWS);
	const seen = [...done, ...outstanding, ...unresolved];

	assert.equal(seen.length, THREE_BUCKET_ROWS.length, 'no row may be dropped or double-counted');
	assert.equal(new Set(seen.map((r) => r.label)).size, THREE_BUCKET_ROWS.length, 'no row may appear in two buckets');
	// The row order is preserved inside each bucket, because the buckets are
	// what the demo-story order is read from.
	assert.equal(unresolved[0].label, 'Timetable made and checked');
});

test('A7C6-R2 buckets: an unresolved row is not last — the mid-list case is covered', () => {
	const { outstanding, unresolved } = bucketReadinessRows(THREE_BUCKET_ROWS);
	assert.notEqual(unresolved[unresolved.length - 1].label, outstanding[outstanding.length - 1]?.label);
	assert.equal(THREE_BUCKET_ROWS.findIndex((r) => r.label === 'Timetable made and checked'), 2, 'the fixture puts the unresolved row mid-list, not last');
});

test('A7C6-R2 header: it counts and never renders a "not ready:" enumeration', () => {
	const header = readinessHeaderText(THREE_BUCKET_ROWS);

	assert.match(header, /^3 of 5 ready/);
	assert.match(header, /1 step to go/, 'the outstanding count is named');
	assert.match(header, /1 ATLAS could not check/, 'the unresolvable count is named separately');
	// THE FALSIFIABLE ROW. Round 1 spelled every outstanding label into this
	// line; the list below the header is the naming, and each name is its own
	// link to the page that fixes that step.
	assert.doesNotMatch(header, /not ready:/i, 'the header must never enumerate outstanding steps');
	for (const row of THREE_BUCKET_ROWS.filter((r) => !r.done)) {
		assert.ok(
			!header.toLowerCase().includes(row.label.toLowerCase()),
			`the header must not spell the step "${row.label}"`,
		);
	}
});

test('A7C6-R2 header: an unresolved-only remainder never claims a step is outstanding', () => {
	// The exact screen QA rejected: everything done except the run review, whose
	// count could not be read. The header must not say a step is to go.
	const header = readinessHeaderText([
		{ label: 'School year and terms set', done: true, href: '/admin/year-setup' },
		{ label: 'Schedule published', done: true, href: '/schedules' },
		{ label: 'Timetable made and checked', done: false, unresolved: true, href: '/timetable' },
	]);

	assert.equal(header, '2 of 3 ready · 1 ATLAS could not check');
	assert.doesNotMatch(header, /step.*to go/i, 'nothing is outstanding, so nothing is "to go"');
	assert.doesNotMatch(header, /not ready/i);
});

test('A7C6-R2 header: a fully resolved list is calm and claims nothing is outstanding', () => {
	const header = readinessHeaderText(THREE_BUCKET_ROWS.filter((r) => r.done));

	assert.equal(header, '3 of 3 ready · nothing left to do');
	assert.doesNotMatch(header, /could not check/i);
});

test('A7C6-R2 source: the card derives its three buckets from one function', () => {
	assert.match(READINESS_CARD_SOURCE, /bucketReadinessRows\(rows\)/, 'the card must bucket through the tested function, not re-derive inline');
	assert.match(READINESS_CARD_SOURCE, /readinessHeaderText\(rows\)/, 'the header must render through the tested function');
	assert.doesNotMatch(READINESS_CARD_SOURCE, /not ready:/i, 'the enumerated "not ready:" header must not come back');
});

// ─── A1 source guard: the combined total is never blocker language ──────────

test('DTC01-A1 source: the Dashboard no longer consumes the combined violation total as blockers', () => {
	assert.match(DASHBOARD_SOURCE, /runWideHardViolationCount/, 'the tile/checklist must source the run-wide HARD state');
	assert.doesNotMatch(DASHBOARD_SOURCE, /\$\{violationCount\}/, 'the combined total must not drive any rendered blocker string');
	assert.doesNotMatch(DASHBOARD_SOURCE, /activeTermHardViolationCount/, 'the term-scoped combined state must be gone');
	assert.doesNotMatch(DASHBOARD_SOURCE, /'No blockers'/, 'the clean tile must not claim "No blockers"');
});
