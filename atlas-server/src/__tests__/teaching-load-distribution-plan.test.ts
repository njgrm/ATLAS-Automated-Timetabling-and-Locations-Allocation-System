import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { summarizeDistributionPlan, emptyDistributionPlan } from '../services/teaching-load-automation.service.js';

const root = resolve(import.meta.dirname, '../..');

function source(path: string): string {
	return readFileSync(resolve(root, path), 'utf8');
}

const HARD_CAP_MINUTES = 2400;

function overCap(teachingMinutes: number, overMinutes: number) {
	return { teachingMinutes, overMinutes };
}

test('coverage complete with above-standard teachers is NOT reported as balanced', () => {
	// Year-9 shaped input: 265 covered rows, 0 uncovered, 14 exact moves, seven
	// teachers at 2250 minutes (over the 1800 standard, under the 2400 hard cap).
	const moves = Array.from({ length: 14 }, (_, index) => ({ fromFacultyId: 100 + (index % 7) }));
	const summary = summarizeDistributionPlan({
		coveredRows: 265,
		uncoveredRows: 0,
		moves,
		overCapFaculty: Array.from({ length: 7 }, () => overCap(2250, 450)),
		hardCapMinutes: HARD_CAP_MINUTES,
	});

	assert.equal(summary.coveredRows, 265);
	assert.equal(summary.uncoveredRows, 0);
	assert.equal(summary.proposedMoves, 14);
	assert.equal(summary.aboveStandardFaculty, 7);
	assert.equal(summary.hardCapBreaches, 0);
	assert.equal(summary.unresolvedImbalance, 0);
	assert.equal(summary.balanced, false, 'coverage alone must never produce a balanced claim');
});

test('all pairs owned but no qualified receiver leaves an explicit unresolved imbalance', () => {
	const summary = summarizeDistributionPlan({
		coveredRows: 265,
		uncoveredRows: 0,
		moves: [],
		overCapFaculty: Array.from({ length: 7 }, () => overCap(2250, 450)),
		hardCapMinutes: HARD_CAP_MINUTES,
	});

	assert.equal(summary.proposedMoves, 0);
	assert.equal(summary.unresolvedImbalance, 7);
	assert.equal(summary.balanced, false);
});

test('a partial rebalance reports only the still-unresolved donors', () => {
	const moves = [{ fromFacultyId: 1 }, { fromFacultyId: 2 }];
	const summary = summarizeDistributionPlan({
		coveredRows: 100,
		uncoveredRows: 0,
		moves,
		overCapFaculty: Array.from({ length: 5 }, () => overCap(2250, 450)),
		hardCapMinutes: HARD_CAP_MINUTES,
	});

	assert.equal(summary.proposedMoves, 2);
	assert.equal(summary.unresolvedImbalance, 3);
	assert.equal(summary.balanced, false);
});

test('absolute hard-cap breaches are counted separately from above-standard faculty', () => {
	const summary = summarizeDistributionPlan({
		coveredRows: 10,
		uncoveredRows: 0,
		moves: [],
		overCapFaculty: [overCap(2700, 900), overCap(2250, 450)],
		hardCapMinutes: HARD_CAP_MINUTES,
	});

	assert.equal(summary.aboveStandardFaculty, 2);
	assert.equal(summary.hardCapBreaches, 1);
	assert.equal(summary.balanced, false);
});

test('balanced is true only when coverage and distribution are both fully safe', () => {
	const summary = summarizeDistributionPlan({
		coveredRows: 50,
		uncoveredRows: 0,
		moves: [],
		overCapFaculty: [],
		hardCapMinutes: HARD_CAP_MINUTES,
	});

	assert.equal(summary.balanced, true);
	assert.equal(summary.proposedMoves, 0);
	assert.equal(summary.unresolvedImbalance, 0);
});

test('uncovered rows always falsify balanced even when nobody is over standard', () => {
	const summary = summarizeDistributionPlan({
		coveredRows: 40,
		uncoveredRows: 3,
		moves: [],
		overCapFaculty: [],
		hardCapMinutes: HARD_CAP_MINUTES,
	});

	assert.equal(summary.uncoveredRows, 3);
	assert.equal(summary.balanced, false);
});

test('the production zero-section distribution plan is never balanced', () => {
	const plan = emptyDistributionPlan();
	assert.equal(plan.summary.distributionEvaluated, false);
	assert.equal(plan.summary.balanced, false, 'a zero-section preview must not render as balanced success');
});

test('an unevaluated distribution can never be reported as balanced', () => {
	const summary = summarizeDistributionPlan({
		coveredRows: 265,
		uncoveredRows: 0,
		moves: [],
		overCapFaculty: [],
		hardCapMinutes: HARD_CAP_MINUTES,
		distributionEvaluated: false,
	});

	assert.equal(summary.distributionEvaluated, false);
	assert.equal(summary.balanced, false, 'a failed distribution evaluation must fail closed');
});

test('a partially-relieved donor still counts as unresolved', () => {
	const summary = summarizeDistributionPlan({
		coveredRows: 5,
		uncoveredRows: 0,
		moves: [{ fromFacultyId: 1, minutes: 225 }],
		overCapFaculty: [{ facultyId: 1, teachingMinutes: 2250, totalCreditedMinutes: 2250, overMinutes: 450 }],
		hardCapMinutes: HARD_CAP_MINUTES,
	});

	assert.equal(summary.proposedMoves, 1);
	assert.equal(summary.unresolvedImbalance, 1);
	assert.equal(summary.balanced, false);
});

test('a donor is resolved only when the moves cover the whole excess', () => {
	const summary = summarizeDistributionPlan({
		coveredRows: 5,
		uncoveredRows: 0,
		moves: [{ fromFacultyId: 1, minutes: 450 }],
		overCapFaculty: [{ facultyId: 1, teachingMinutes: 2250, totalCreditedMinutes: 2250, overMinutes: 450 }],
		hardCapMinutes: HARD_CAP_MINUTES,
	});

	assert.equal(summary.unresolvedImbalance, 0);
	assert.equal(summary.aboveStandardFaculty, 1);
	assert.equal(summary.balanced, false);
});

// ─── Production wiring guardrails (source scan) ─────────────────────────

test('autoFill composes the canonical distribution plan into its result', () => {
	const automation = source('src/services/teaching-load-automation.service.ts');
	assert.match(automation, /buildTeachingLoadDistributionPlan\(\{/);
	assert.match(automation, /previewOrApplyOverCapRebalance\(\{/);
	assert.match(automation, /distribution,/);
	// The old "use rebalance to redistribute" dead-end copy must be gone.
	assert.doesNotMatch(automation, /use rebalance to redistribute/);
});

test('the over-cap plan builder carries the bounded adviser tie-break', () => {
	const automation = source('src/services/teaching-load-automation.service.ts');
	assert.match(automation, /adviserPreference/);
	assert.match(automation, /advisedSectionId === ownership\.sectionId/);
});

test('the reviewed apply persists moves inside the same Serializable transaction', () => {
	const proposal = source('src/services/teaching-load-suggestion-proposal.service.ts');
	assert.match(proposal, /refreshedPreview\.distribution\?\.moves/);
	assert.match(proposal, /TEACHING_LOAD_PROPOSAL_STALE/);
	assert.match(proposal, /movesApplied/);
	assert.match(proposal, /isolationLevel: 'Serializable'/);
	assert.match(proposal, /moveCount: movesApplied/);
});
