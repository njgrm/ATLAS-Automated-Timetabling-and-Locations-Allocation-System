/**
 * LANE-C DEPARTURE-SWAP-C04 — a published swap never crosses terms.
 *
 * Live QA on 2026-09-25 swapped a Term 2 class with another class's Term 1 copy
 * (the client picked the first of three per-term copies in the slot). The server
 * moved both and reported clashes against the copies left behind. These rows pin
 * the server guard:
 *   G1 two different ordered terms do not overlap, so the swap is refused
 *   G2 the same term, or a whole-year entry (no term), may swap
 *   G3 the guard runs in the swap builder shared by preview and write, before the
 *      change set is returned, with a stable error code
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { effectiveTermsOverlap, entryTermScope } from '../services/effective-scheduled-resources.js';

const swappable = (a: { termIndex?: number | null }, b: { termIndex?: number | null }) =>
	effectiveTermsOverlap(entryTermScope(a), entryTermScope(b));

test('G1: a Term 2 class cannot swap with a Term 1 class', () => {
	assert.equal(swappable({ termIndex: 2 }, { termIndex: 1 }), false);
	assert.equal(swappable({ termIndex: 3 }, { termIndex: 2 }), false);
});

test('G2: same term, or a whole-year class, may swap', () => {
	assert.equal(swappable({ termIndex: 2 }, { termIndex: 2 }), true);
	assert.equal(swappable({ termIndex: null }, { termIndex: 2 }), true);
	assert.equal(swappable({}, { termIndex: 3 }), true);
});

test('G3: the shared swap builder refuses cross-term pairs before returning changes', () => {
	const service = readFileSync(new URL('../services/published-revision.service.ts', import.meta.url), 'utf8');
	const start = service.indexOf('async function buildPublishedSwapRevisionInput');
	assert.ok(start > 0, 'swap builder exists');
	const body = service.slice(start, service.indexOf('\n}\n', start));
	const guard = body.indexOf("'SWAP_TERM_MISMATCH'");
	assert.ok(guard > 0, 'builder throws SWAP_TERM_MISMATCH');
	assert.match(body, /if \(!effectiveTermsOverlap\(termA, termB\)\)/);
	assert.ok(guard < body.indexOf("changeType: 'PUBLISHED_SWAP'"), 'guard runs before the change set is built');
	assert.match(service, /previewPublishedScheduleRevision\(await buildPublishedSwapRevisionInput\(input\)/, 'preview uses the guarded builder');
});
