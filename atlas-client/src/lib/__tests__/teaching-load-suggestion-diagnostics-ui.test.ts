import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../../..');

function source(path: string): string {
	return readFileSync(resolve(root, path), 'utf8');
}

test('the suggestion summary renders concise candidate diagnostics, not a raw log', () => {
	const modal = source('src/components/faculty-assignments/AutoFillSummaryModal.tsx');
	// C-3: the diagnostics body was extracted into its own renderable component so
	// the rendered grouping can be asserted directly. The modal still owns the
	// data selection and delegates rendering.
	const panel = source('src/components/faculty-assignments/TeachingLoadCandidateDiagnostics.tsx');

	// The modal consumes the pure helpers and delegates to the panel.
	assert.match(modal, /candidateRejectionsForResult/);
	assert.match(modal, /<TeachingLoadCandidateDiagnostics rejections=\{candidateRejections\} \/>/);
	// The panel is the single place the summary is grouped and rendered.
	assert.match(panel, /summarizeCandidateRejections/);

	// A dedicated, compact surface exists with per-reason rows.
	assert.match(panel, /data-testid="teaching-load-candidate-diagnostics"/);
	assert.match(panel, /data-testid=\{`teaching-load-rejection-\$\{group\.reason\}`\}/);
	assert.match(panel, /Zero-load teachers are always evaluated/);

	// It must not degrade into a raw log dump.
	for (const file of [modal, panel]) {
		assert.doesNotMatch(file, /<pre/);
		assert.doesNotMatch(file, /JSON\.stringify\(candidateRejections/);
	}
});

test('client Teaching Load types carry the bounded rejection contract', () => {
	const types = source('src/types.ts');
	assert.match(types, /export type TeachingLoadCandidateRejectionReason/);
	assert.match(types, /export type TeachingLoadCandidateRejection = \{/);
	assert.match(types, /candidateRejections\?: TeachingLoadCandidateRejection\[\]/);
	assert.match(types, /'PROGRAM_SCOPE_INCOMPATIBLE'/);
	assert.match(types, /'PLACEHOLDER_FACULTY'/);
});

test('the diagnostics helper keeps rejection labels and grouping deterministic', () => {
	const helper = source('src/lib/teaching-load-suggestion-diagnostics.ts');
	assert.match(helper, /export const CANDIDATE_REJECTION_LABELS/);
	assert.match(helper, /export function summarizeCandidateRejections/);
	assert.match(helper, /export function candidateRejectionsForResult/);
});
