import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { isDraftPublishedStrict } from '../../components/timetable/timetableWorkspaceTruth';
import type { DraftReport, RunSummary } from '../../types';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

/**
 * R2 load-bearing control for the real consumers.
 *
 * Rendering `ScheduleReviewWorkspace.tsx`/`CenterWorkspace.tsx` is infeasible in
 * this harness: `ScheduleReviewWorkspace` calls the network hook
 * `useScheduleReviewWorkspaceState()`, and `CenterWorkspace` reads the browser
 * viewport in a `useState` initializer and mounts heavy DOM/dnd sub-surfaces.
 * Per the packet's option 2, the consumers' published derivation is the single
 * exported pure selector below, and this file adds (a) the selector fixture,
 * (b) a call-site binding check, and (c) a discrimination mutant.
 */

// The exact base (pre-C04) loose OR-marker predicate that both consumers used.
// Reproduced verbatim so the fixture can be proven to distinguish semantics.
function baseLooseOrMarkerPredicate(draft: { summary?: unknown } | null | undefined): boolean {
	const summary = draft?.summary;
	if (!summary || typeof summary !== 'object') return false;
	const candidate = summary as Record<string, unknown>;
	if (candidate.isPublished === true) return true;
	if (typeof candidate.publishedAt === 'string' && candidate.publishedAt.length > 0) return true;
	return typeof candidate.publishedBy === 'number';
}

const SUPERSEDED_SUMMARY = {
	isPublished: false,
	publishedAt: '2031-01-01T00:00:00.000Z',
	publishedBy: 4,
};
const PUBLISHED_SUMMARY = {
	isPublished: true,
	publishedAt: '2031-01-01T00:00:00.000Z',
	publishedBy: 4,
};

function draft(summary: Record<string, unknown>): Pick<DraftReport, 'summary'> {
	return { summary: summary as unknown as RunSummary };
}

// --- (a) executable superseded-fixture test on the single selector ---

test('R2 selector: a superseded run is never published', () => {
	assert.equal(isDraftPublishedStrict(draft(SUPERSEDED_SUMMARY)), false);
	assert.equal(isDraftPublishedStrict(draft(PUBLISHED_SUMMARY)), true);
	assert.equal(isDraftPublishedStrict(null), false);
});

// --- (c) discrimination mutant: the fixture distinguishes the two semantics ---

test('R2 discrimination mutant: the loose marker predicate is fooled, the strict selector is not', () => {
	assert.equal(
		baseLooseOrMarkerPredicate({ summary: SUPERSEDED_SUMMARY }),
		true,
		'the base loose OR-marker predicate must render a superseded run as published',
	);
	assert.equal(
		isDraftPublishedStrict(draft(SUPERSEDED_SUMMARY)),
		false,
		'the strict selector must not be fooled by retained markers',
	);
	// Both agree on a truly published run, so the fixture is not trivially different.
	assert.equal(baseLooseOrMarkerPredicate({ summary: PUBLISHED_SUMMARY }), true);
	assert.equal(isDraftPublishedStrict(draft(PUBLISHED_SUMMARY)), true);
});

// --- (b) call-site binding: both real consumers route through the selector ---

test('R2 both real R2 consumers derive published state through the single selector', () => {
	const consumers: Array<{ file: string; argument: string }> = [
		{ file: 'src/components/timetable/CenterWorkspace.tsx', argument: 'draft' },
		{ file: 'src/components/timetable/ScheduleReviewWorkspace.tsx', argument: 'state.draft' },
	];
	for (const { file, argument } of consumers) {
		const src = source(file);
		// The derivation binds to the shared selector, not an inline predicate.
		assert.match(
			src,
			new RegExp(`const isDraftPublished = isDraftPublishedStrict\\(${argument.replace('.', '\\.')}\\)`),
			`${file} must derive published state through isDraftPublishedStrict(${argument})`,
		);
		// No loose OR-marker predicate may return.
		assert.doesNotMatch(src, /publishedBy/, `${file} must not fall back to publishedBy markers`);
		assert.doesNotMatch(src, /candidate\.publishedAt|summary\.publishedAt/, `${file} must not fall back to publishedAt markers`);
		// The derivation flows to the rendered consuming surface.
		assert.match(src, /isPublished=\{isDraftPublished\}/, `${file} must pass the derived flag to its published surface`);
	}
});
