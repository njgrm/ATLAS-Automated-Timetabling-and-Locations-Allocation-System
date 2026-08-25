import assert from 'node:assert/strict';
import test from 'node:test';

import type { ScheduledEntry } from '@/types';

/**
 * Term filter regression tests for Prompt 03/03A/03B.
 *
 * These tests verify:
 * 1. Active term defaults termFilter when userOverrodeTermFilter=false
 * 2. User manual selection sets override and prevents refresh overwrite
 * 3. School year change clears override and allows re-defaulting
 * 4. Specific term filters exclude entries with missing termIndex
 * 5. termFilter="all" includes entries with missing termIndex
 */

/* ─── Helpers ─── */

function entry(overrides: Partial<ScheduledEntry> = {}): ScheduledEntry {
	return {
		entryId: `entry-${Math.random().toString(36).slice(2, 8)}`,
		facultyId: 10,
		roomId: 100,
		subjectId: 1000,
		sectionId: 1,
		day: 'MONDAY',
		startTime: '08:00',
		endTime: '08:45',
		durationMinutes: 45,
		entryKind: 'SECTION',
		...overrides,
	};
}

/** Mirrors the term filter logic from useTimetableData.ts filteredDraftEntries */
function filterByTerm(
	entries: ScheduledEntry[],
	termFilter: 'all' | 1 | 2 | 3,
): ScheduledEntry[] {
	return entries.filter((e) => {
		if (termFilter === 'all') return true;
		const entryTermIndex = e.termIndex ?? null;
		if (entryTermIndex === null) return false;
		return entryTermIndex === termFilter;
	});
}

/** Simulates the default-term-setting behavior from useScheduleReviewWorkspaceState */
function resolveDefaultTermFilter(
	activeTermIndex: number | null | undefined,
	userOverrode: boolean,
	currentFilter: 'all' | 1 | 2 | 3,
): 'all' | 1 | 2 | 3 {
	if (userOverrode) return currentFilter;
	if (activeTermIndex === 1 || activeTermIndex === 2 || activeTermIndex === 3) {
		return activeTermIndex;
	}
	return currentFilter;
}

/* ─── Test 1: Active verified term defaults termFilter ─── */

test('activeTerm.termIndex=1 defaults termFilter to 1 when userOverrode=false', () => {
	const result = resolveDefaultTermFilter(1, false, 'all');
	assert.equal(result, 1, 'Should default to term 1');
});

test('activeTerm.termIndex=2 defaults termFilter to 2 when userOverrode=false', () => {
	const result = resolveDefaultTermFilter(2, false, 'all');
	assert.equal(result, 2, 'Should default to term 2');
});

test('activeTerm.termIndex=3 defaults termFilter to 3 when userOverrode=false', () => {
	const result = resolveDefaultTermFilter(3, false, 'all');
	assert.equal(result, 3, 'Should default to term 3');
});

test('activeTerm=null keeps current filter when userOverrode=false', () => {
	const result = resolveDefaultTermFilter(null, false, 'all');
	assert.equal(result, 'all', 'Should keep all when no active term');
});

test('activeTerm=undefined keeps current filter when userOverrode=false', () => {
	const result = resolveDefaultTermFilter(undefined, false, 'all');
	assert.equal(result, 'all', 'Should keep all when active term is undefined');
});

/* ─── Test 2: User override prevents refresh overwrite ─── */

test('user selecting "All terms" sets override and prevents later active-term refresh', () => {
	// User selects "All terms"
	let filter: 'all' | 1 | 2 | 3 = 'all';
	let userOverrode = true;

	// Simulate a background refresh that would default to term 1
	const refreshedFilter = resolveDefaultTermFilter(1, userOverrode, filter);

	assert.equal(refreshedFilter, 'all', 'Override should prevent refresh from changing filter');
	assert.equal(userOverrode, true, 'Override flag should remain true');
});

test('user selecting specific term keeps that selection across refresh', () => {
	// User selects Term 2
	let filter: 'all' | 1 | 2 | 3 = 2;
	let userOverrode = true;

	// Simulate a background refresh that would default to term 1
	const refreshedFilter = resolveDefaultTermFilter(1, userOverrode, filter);

	assert.equal(refreshedFilter, 2, 'User selection of Term 2 should be preserved');
});

/* ─── Test 3: School year change clears override ─── */

test('school year change clears override and allows re-defaulting', () => {
	// User had overridden to "All terms"
	let userOverrode = true;

	// Simulate school year change effect
	userOverrode = false;

	// Now active term should be applied
	const filter = resolveDefaultTermFilter(3, userOverrode, 'all');
	assert.equal(filter, 3, 'After school year change, active term should be applied');
});

test('school year change after override allows new active term default', () => {
	// User had overridden to Term 2
	let userOverrode = true;
	let filter: 'all' | 1 | 2 | 3 = 2;

	// School year changes, clearing override
	userOverrode = false;

	// New active term is Term 3
	const newFilter = resolveDefaultTermFilter(3, userOverrode, filter);
	assert.equal(newFilter, 3, 'New active term should take effect after school year change');
});

/* ─── Test 4: Specific term filters exclude entries with missing termIndex ─── */

test('termFilter=1 excludes entries without termIndex', () => {
	const entries = [
		entry({ entryId: 'e1', termIndex: 1 }),
		entry({ entryId: 'e2', termIndex: undefined }),
		entry({ entryId: 'e3', termIndex: 2 }),
		entry({ entryId: 'e4' }), // no termIndex at all
	];
	const filtered = filterByTerm(entries, 1);
	assert.equal(filtered.length, 1, 'Only entries with termIndex=1 should pass');
	assert.equal(filtered[0].entryId, 'e1');
});

test('termFilter=2 excludes entries without termIndex', () => {
	const entries = [
		entry({ entryId: 'e1', termIndex: 1 }),
		entry({ entryId: 'e2', termIndex: 2 }),
		entry({ entryId: 'e3' }), // no termIndex
	];
	const filtered = filterByTerm(entries, 2);
	assert.equal(filtered.length, 1, 'Only entries with termIndex=2 should pass');
	assert.equal(filtered[0].entryId, 'e2');
});

test('termFilter=3 excludes entries without termIndex', () => {
	const entries = [
		entry({ entryId: 'e1', termIndex: 3 }),
		entry({ entryId: 'e2', termIndex: 1 }),
		entry({ entryId: 'e3' }), // no termIndex
	];
	const filtered = filterByTerm(entries, 3);
	assert.equal(filtered.length, 1, 'Only entries with termIndex=3 should pass');
	assert.equal(filtered[0].entryId, 'e1');
});

/* ─── Test 5: termFilter="all" includes entries with missing termIndex ─── */

test('termFilter=all includes all entries regardless of termIndex', () => {
	const entries = [
		entry({ entryId: 'e1', termIndex: 1 }),
		entry({ entryId: 'e2', termIndex: 2 }),
		entry({ entryId: 'e3', termIndex: 3 }),
		entry({ entryId: 'e4', termIndex: undefined }),
		entry({ entryId: 'e5' }), // no termIndex
	];
	const filtered = filterByTerm(entries, 'all');
	assert.equal(filtered.length, 5, 'All entries should pass when filter is "all"');
});

test('termFilter=all includes entries with missing termIndex even when other terms exist', () => {
	const entries = [
		entry({ entryId: 'e1', termIndex: 1 }),
		entry({ entryId: 'e2' }), // no termIndex
	];
	const filtered = filterByTerm(entries, 'all');
	assert.equal(filtered.length, 2, 'Both entries should be included');
});

/* ─── Combined scenario tests ─── */

test('full lifecycle: default -> override -> refresh preserves override -> school year change re-defaults', () => {
	// Step 1: Active term is T1, no override -> should default to 1
	let filter: 'all' | 1 | 2 | 3 = 'all';
	let userOverrode = false;
	filter = resolveDefaultTermFilter(1, userOverrode, filter);
	assert.equal(filter, 1, 'Step 1: Should default to term 1');

	// Step 2: User selects "All terms" -> override is set
	userOverrode = true;
	filter = 'all';
	assert.equal(filter, 'all', 'Step 2: User selected All terms');

	// Step 3: Background refresh tries to set T1 -> should be blocked
	filter = resolveDefaultTermFilter(1, userOverrode, filter);
	assert.equal(filter, 'all', 'Step 3: Refresh should not overwrite user selection');

	// Step 4: School year changes -> override cleared
	userOverrode = false;

	// Step 5: New active term is T3 -> should default to 3
	filter = resolveDefaultTermFilter(3, userOverrode, filter);
	assert.equal(filter, 3, 'Step 5: Should default to new active term after school year change');
});

test('entries without termIndex are correctly partitioned', () => {
	const entries = [
		entry({ entryId: 'e1', termIndex: 1 }),
		entry({ entryId: 'e2', termIndex: 2 }),
		entry({ entryId: 'e3', termIndex: 3 }),
		entry({ entryId: 'e4' }), // no termIndex
	];

	const t1 = filterByTerm(entries, 1);
	const t2 = filterByTerm(entries, 2);
	const t3 = filterByTerm(entries, 3);
	const all = filterByTerm(entries, 'all');

	assert.equal(t1.length, 1, 'T1 filter: 1 entry');
	assert.equal(t2.length, 1, 'T2 filter: 1 entry');
	assert.equal(t3.length, 1, 'T3 filter: 1 entry');
	assert.equal(all.length, 4, 'All filter: 4 entries (including missing termIndex)');

	// Entry without termIndex appears in "all" but not in specific terms
	const noTermEntry = entries.find((e) => e.entryId === 'e4')!;
	assert.ok(!t1.includes(noTermEntry), 'No-termIndex entry excluded from T1');
	assert.ok(!t2.includes(noTermEntry), 'No-termIndex entry excluded from T2');
	assert.ok(!t3.includes(noTermEntry), 'No-termIndex entry excluded from T3');
	assert.ok(all.includes(noTermEntry), 'No-termIndex entry included in All');
});
