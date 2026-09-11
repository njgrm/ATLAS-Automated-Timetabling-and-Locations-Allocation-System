/**
 * RR-TERM-CACHE-C01 — the rollover card exposes exactly one narrow repair path
 * for a missing/stale persisted term snapshot and never routes that state
 * through the broad faculty/section rollover apply.
 *
 * Run (client workspace): `npx tsx --test src/lib/__tests__/rollover-term-repair.test.ts`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { describeTermAuthority, type TermAuthorityStatus } from '@/lib/settings';

function termAuthority(overrides: Partial<TermAuthorityStatus>): TermAuthorityStatus {
	return {
		state: 'MISSING',
		code: null,
		message: 'message',
		persisted: false,
		persistedSemanticRevision: null,
		liveSemanticRevision: null,
		cachedAt: null,
		termCount: 3,
		needsRepair: true,
		repairAction: 'PREVIEW_TERM_CACHE_SYNC',
		canPreview: true,
		...overrides,
	};
}

test('aligned year with missing terms reads as terms-not-saved with one preview action', () => {
	const view = describeTermAuthority(termAuthority({ state: 'MISSING' }));
	assert.equal(view.needsRepair, true);
	assert.equal(view.primaryAction, 'PREVIEW_TERM_CACHE_SYNC');
	assert.match(view.badgeLabel, /terms not saved/i);
	assert.doesNotMatch(view.badgeLabel, /no action/i);
});

test('a stale persisted revision reads as changed-at-source with the same single repair action', () => {
	const view = describeTermAuthority(termAuthority({ state: 'PERSISTED_STALE', persisted: true }));
	assert.equal(view.primaryAction, 'PREVIEW_TERM_CACHE_SYNC');
	assert.match(view.badgeLabel, /changed at source/i);
});

test('a current persisted snapshot needs no repair action', () => {
	const view = describeTermAuthority(termAuthority({ state: 'PERSISTED_CURRENT', needsRepair: false, repairAction: 'NONE' }));
	assert.equal(view.needsRepair, false);
	assert.equal(view.primaryAction, 'NONE');
});

test('unreachable upstream without a snapshot offers retry, not a term save', () => {
	const view = describeTermAuthority(termAuthority({ state: 'UPSTREAM_UNAVAILABLE', needsRepair: true, repairAction: 'RETRY_ENROLLPRO', canPreview: false }));
	assert.equal(view.primaryAction, 'RETRY_ENROLLPRO');
});

test('year-drift term state never claims a term repair', () => {
	const view = describeTermAuthority(termAuthority({ state: 'PERSISTED_UNVERIFIED', needsRepair: false, repairAction: 'NONE' }));
	assert.equal(view.needsRepair, false);
});

test('the card wires the narrow preview/apply contract and not the broad rollover apply for this state', () => {
	const source = readFileSync(new URL('../../components/runtime/RolloverGuidanceCard.tsx', import.meta.url), 'utf8');
	assert.ok(source.includes('previewTermCacheSync(requestSchoolId)'), 'term repair opens the zero-write term preview for the resolved actor school');
	assert.ok(source.includes('applyTermCacheSync(schoolId'), 'term repair persists through the narrow term-cache apply');
	assert.ok(source.includes('data-testid="rollover-term-repair-action"'), 'one repair action is exposed');
	assert.ok(source.includes('data-testid="rollover-term-repair-apply"'), 'the preview dialog owns the apply control');
	assert.ok(source.includes('describeTermAuthority(status?.termAuthority)'), 'the card renders the separate term-authority state');
	// RR-TERM-CACHE-C01R: no school-1 default may remain in the card or its
	// term-authority wrappers.
	assert.doesNotMatch(source, /schoolId\s*=\s*1(?!\d)/, 'the card must not default schoolId to 1');

	const repairStart = source.indexOf('const handleTermRepair');
	const applyStart = source.indexOf('const handleTermApply');
	const checkStart = source.indexOf('if (!loading && !status && !error) return null;');
	assert.ok(repairStart > 0 && applyStart > repairStart && checkStart > applyStart, 'handlers are present and ordered');
	const repairHandlers = source.slice(repairStart, checkStart);
	assert.equal(repairHandlers.includes('applyRolloverSync('), false, 'the term-repair path must never call the broad rollover apply');
	assert.equal(repairHandlers.includes('applyArchiveAndSync('), false, 'the term-repair path must never call archive-and-sync');
});
