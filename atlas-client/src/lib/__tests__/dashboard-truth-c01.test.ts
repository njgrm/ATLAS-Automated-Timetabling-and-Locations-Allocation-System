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
	assert.match(item.hint ?? '', /unavailable/i);
});

test('DTC01-S1 surface 3 (header tile): 0 HARD / 335 SOFT renders no blocker claim', () => {
	const html = renderToStaticMarkup(createElement(RunBlockerTile as never, {
		generationAvailable: true,
		hardViolationCount: 0,
		softViolationCount: 335,
	} as never));
	assert.doesNotMatch(html, /blocker/i);
	assert.match(html, /No hard violations/);
	assert.match(html, /335 warning/i);
});

test('DTC01-S1 surface 3: a non-zero run-wide HARD count is labelled run-wide', () => {
	const html = renderToStaticMarkup(createElement(RunBlockerTile as never, {
		generationAvailable: true,
		hardViolationCount: 3,
		softViolationCount: 335,
	} as never));
	assert.match(html, /3 run-wide review blockers/);
});

test('DTC01-S1 surface 3 null control: an unresolved HARD count never renders 0 or "No blockers"', () => {
	const html = renderToStaticMarkup(createElement(RunBlockerTile as never, {
		generationAvailable: true,
		hardViolationCount: null,
		softViolationCount: null,
	} as never));
	assert.doesNotMatch(html, /No blockers/i);
	assert.doesNotMatch(html, /No hard violations/i);
	assert.match(html, /unavailable/i);
});

test('DTC01-S1 surface 4 (term popover): the hard row is run-wide, absent at 0, explicit when unavailable', () => {
	const zero = renderToStaticMarkup(createElement(ActiveTermHardViolationsRow as never, { count: 0 } as never));
	assert.equal(zero, '', 'a zero hard count renders no figure at all (no non-zero "Hard violations")');
	const blocked = renderToStaticMarkup(createElement(ActiveTermHardViolationsRow as never, { count: 4 } as never));
	assert.match(blocked, /Hard violations \(run-wide\)/);
	assert.match(blocked, />4</);
	const unavailable = renderToStaticMarkup(createElement(ActiveTermHardViolationsRow as never, { count: null } as never));
	assert.match(unavailable, /Unavailable/);
	assert.doesNotMatch(unavailable, />0</);
});

// ─── A1 source guard: the combined total is never blocker language ──────────

test('DTC01-A1 source: the Dashboard no longer consumes the combined violation total as blockers', () => {
	assert.match(DASHBOARD_SOURCE, /runWideHardViolationCount/, 'the tile/checklist must source the run-wide HARD state');
	assert.doesNotMatch(DASHBOARD_SOURCE, /\$\{violationCount\}/, 'the combined total must not drive any rendered blocker string');
	assert.doesNotMatch(DASHBOARD_SOURCE, /activeTermHardViolationCount/, 'the term-scoped combined state must be gone');
	assert.doesNotMatch(DASHBOARD_SOURCE, /'No blockers'/, 'the clean tile must not claim "No blockers"');
});
