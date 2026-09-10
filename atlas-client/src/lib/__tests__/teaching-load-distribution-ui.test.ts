import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../../..');

function source(path: string): string {
	return readFileSync(resolve(root, path), 'utf8');
}

test('the suggestion preview never claims full capacity success from coverage alone', () => {
	const modal = source('src/components/faculty-assignments/AutoFillSummaryModal.tsx');

	// The false year-9 claim must be gone.
	assert.doesNotMatch(modal, /everyone is within their workload capacity/i);
	assert.doesNotMatch(modal, />Complete Coverage</);

	// Balance is derived from the structured distribution summary, not coverage.
	assert.match(modal, /const hasImbalance = Boolean\(distribution && !distribution\.summary\.balanced\)/);
	assert.match(modal, /hasImbalance/);

	// A dedicated imbalance surface with separate counts exists.
	assert.match(modal, /data-testid="teaching-load-distribution-imbalance"/);
	assert.match(modal, /Uncovered rows/);
	assert.match(modal, /Proposed moves/);
	assert.match(modal, /Unresolved imbalance/);
	assert.match(modal, /Above standard/);
	assert.match(modal, /Over hard cap/);

	// The genuinely balanced state is explicitly gated and truthful.
	assert.match(modal, /distribution\?\.summary\.balanced === true/);
	assert.match(modal, /Balanced Teaching Load/);
	assert.match(modal, /no reallocation moves are proposed/);
	// A missing/unevaluated distribution must not be treated as balanced.
	assert.match(modal, /teaching-load-distribution-unevaluated/);
	assert.match(modal, /balance not evaluated/);
	// The distribution counts are shown even when a coverage shortage coexists.
	assert.match(modal, /teaching-load-distribution-summary/);
});

test('client AutoFillSummaryResult carries the structured distribution plan', () => {
	const types = source('src/types.ts');
	assert.match(types, /TeachingLoadDistributionSummary/);
	assert.match(types, /TeachingLoadDistributionPlan/);
	assert.match(types, /distribution\?: TeachingLoadDistributionPlan/);
	assert.match(types, /movesApplied\?: number/);
});
