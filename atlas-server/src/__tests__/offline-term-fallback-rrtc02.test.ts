/**
 * RR-TERM-CACHE offline resilience — the persisted-contract active-term
 * derivation used when the live EnrollPro active-term endpoint is unreachable.
 *
 * The persisted `activeTerm` snapshot is only rewritten when the contract's
 * semantic revision changes, so after a term rollover it can still name the
 * previous term. When the persisted terms carry verified date boundaries the
 * current term must be derived from them instead.
 *
 * Run: `npx tsx --test src/__tests__/offline-term-fallback-rrtc02.test.ts`
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { derivePersistedActiveTerm } from '../services/runtime-context.service.js';

const TERMS = [
	{ identity: 'T1', order: 1, startDate: '2026-04-02', endDate: '2026-09-19' },
	{ identity: 'T2', order: 2, startDate: '2026-09-20', endDate: '2026-10-22' },
	{ identity: 'T3', order: 3, startDate: '2026-10-30', endDate: '2027-06-01' },
];

test('a stale persisted activeTerm snapshot is corrected to the term containing today', () => {
	// The snapshot names T1 (as captured 2026-09-18); today is inside T2.
	assert.deepEqual(derivePersistedActiveTerm(TERMS, 1, new Date('2026-09-24T12:00:00')), { identity: 'T2', termIndex: 2 });
});

test('the snapshot is kept when it is still the current term', () => {
	assert.deepEqual(derivePersistedActiveTerm(TERMS, 2, new Date('2026-09-24T12:00:00')), { identity: 'T2', termIndex: 2 });
});

test('a gap between two terms resolves to the latest term that has already started', () => {
	// 2026-10-23..2026-10-29 lies between T2's end and T3's start.
	assert.deepEqual(derivePersistedActiveTerm(TERMS, 1, new Date('2026-10-25T12:00:00')), { identity: 'T2', termIndex: 2 });
});

test('terms without verified boundaries fall back to the snapshot', () => {
	const undated = [
		{ identity: 'T1', order: 1, startDate: null, endDate: null },
		{ identity: 'T2', order: 2, startDate: null, endDate: null },
		{ identity: 'T3', order: 3, startDate: null, endDate: null },
	];
	assert.deepEqual(derivePersistedActiveTerm(undated, 1, new Date('2026-09-24T12:00:00')), { identity: 'T1', termIndex: 1 });
});

test('a date-derived term is returned even without a snapshot', () => {
	assert.deepEqual(derivePersistedActiveTerm(TERMS, null, new Date('2026-11-05T12:00:00')), { identity: 'T3', termIndex: 3 });
});

test('no derivable term and no snapshot yields null', () => {
	const futureOnly = [{ identity: 'T1', order: 1, startDate: '2099-01-01', endDate: '2099-06-01' }];
	assert.equal(derivePersistedActiveTerm(futureOnly, null, new Date('2026-09-24T12:00:00')), null);
});
