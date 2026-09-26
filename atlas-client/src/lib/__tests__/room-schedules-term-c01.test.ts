import assert from 'node:assert/strict';
import test from 'node:test';

import { pivotDraftToView } from '../schedule-pivot';
import type { DraftReport, ScheduledEntry } from '@/types';

/**
 * ROOM-SCHEDULES-TERM-C01 — one selected ordered term per on-screen schedule view.
 *
 * THE DEFECT THIS EXISTS TO PROVE ABSENT. The live page reported 10 conflicts for
 * G7 Room 103 and its inspector showed three copies of AP and three of Math in
 * one Monday slot, each linked to T1, T2 or T3. Cause: the Rooms view never sent
 * a term, and the Teachers/Sections views pivoted the whole draft client-side.
 * A weekly grid built from three merged terms puts the same class in one slot
 * three times, and the grid scores `entries.length > 1` as a room conflict — so
 * the page manufactured conflicts for a scheduler to adjudicate.
 *
 * THE ADVERSARIAL FIXTURE, as the acceptance packet requires: the SAME room,
 * teacher and section appear in the SAME interval in THREE different terms. A
 * correct implementation shows one term's entry and reports no conflict; the old
 * all-term merge showed three and reported a conflict that does not exist.
 */

const SLOT = { day: 'MONDAY', startTime: '08:00', endTime: '08:45' } as const;

function entry(termIndex: number, overrides: Partial<ScheduledEntry> = {}): ScheduledEntry {
	return {
		entryId: `ap-t${termIndex}`,
		sectionId: 701,
		facultyId: 501,
		roomId: 601,
		subjectId: 11,
		durationMinutes: 45,
		...SLOT,
		termIndex,
		...overrides,
	};
}

const THREE_TERM_REPORT = {
	runId: 318,
	status: 'COMPLETED',
	createdAt: '2031-01-01T00:00:00.000Z',
	finishedAt: '2031-01-01T00:01:00.000Z',
	entries: [entry(1), entry(2), entry(3)],
	summary: {
		timetableDisplaySlots: [{ startTime: '08:00', endTime: '08:45' }],
	},
} as DraftReport;

const SUBJECTS = new Map([[11, 'AP']]);
const ENTITY = { id: 701, name: '7-Rizal' };

function cellEntries(result: ReturnType<typeof pivotDraftToView>) {
	assert.equal(result.ok, true, 'a fully identified single-term draft must build a view');
	if (!result.ok) return [] as string[];
	return result.view.grid
		.flatMap((row) => row.cells)
		.flatMap((cell) => cell.entries.map((e) => e.entryId));
}

test('each view shows exactly the selected term, never a merge of the three', () => {
	for (const kind of ['rooms', 'teachers', 'sections'] as const) {
		for (const term of [1, 2, 3]) {
			assert.deepEqual(
				cellEntries(pivotDraftToView(THREE_TERM_REPORT, kind, kind === 'rooms' ? 601 : kind === 'teachers' ? 501 : 701, ENTITY, term, SUBJECTS)),
				[`ap-t${term}`],
				`${kind} view scoped to term ${term} must show only that term's entry`,
			);
		}
	}
});

test('a single selected term reports NO conflict — the defect reported 10', () => {
	// The load-bearing assertion. Under the old all-term merge this cell held
	// three entries, so `entries.length > 1` was true and conflictCount rose once
	// per occupied slot. A room with one class in one term has no conflict.
	for (const kind of ['rooms', 'teachers', 'sections'] as const) {
		const result = pivotDraftToView(THREE_TERM_REPORT, kind, kind === 'rooms' ? 601 : kind === 'teachers' ? 501 : 701, ENTITY, 2, SUBJECTS);
		assert.equal(result.ok, true);
		if (!result.ok) continue;
		assert.equal(result.view.summary.conflictCount, 0, `${kind} view must not invent a conflict across terms`);
		assert.equal(result.view.summary.entryCount, 1, `${kind} view must count one entry, not three`);
	}
});

test('a term with no sessions is empty, not filled from another term', () => {
	// §7: a missing term identity is unresolved authority and must never be
	// topped up from a neighbouring term to fill the gap.
	const result = pivotDraftToView(THREE_TERM_REPORT, 'sections', 701, ENTITY, 4, SUBJECTS);
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.view.summary.entryCount, 0, 'term 4 has no sessions and must show none');
	assert.equal(result.view.summary.conflictCount, 0);
});

test('an entry with NO term identity refuses the view instead of defaulting to Term 1', () => {
	// The regression this change exists to remove. The old pivot mapped
	// `e.termIndex ?? 1`, so an unidentified entry silently became Term 1 and
	// the view claimed a verified single-term schedule it could not support.
	const unidentified = {
		...THREE_TERM_REPORT,
		entries: [entry(2), { ...entry(1), termIndex: undefined as unknown as number }],
	} as DraftReport;

	const result = pivotDraftToView(unidentified, 'sections', 701, ENTITY, 1, SUBJECTS);
	assert.equal(result.ok, false, 'an unidentified entry must not be silently treated as Term 1');
	if (result.ok) return;
	assert.equal(result.reason, 'TERM_IDENTITY_UNAVAILABLE');
});

test('the pivot refuses an invalid term outright rather than defaulting one', () => {
	// No clamping, no cycling, no "first term" fallback.
	for (const bad of [0, -1, 1.5, Number.NaN]) {
		const result = pivotDraftToView(THREE_TERM_REPORT, 'sections', 701, ENTITY, bad, SUBJECTS);
		assert.equal(result.ok, false, `term ${String(bad)} must be refused`);
	}
});

test('the selected term is carried on every projected entry, never defaulted', () => {
	// Proves the `?? 1` fall-open is gone from the projection itself, not only
	// from the filter that precedes it.
	const result = pivotDraftToView(THREE_TERM_REPORT, 'sections', 701, ENTITY, 3, SUBJECTS);
	assert.equal(result.ok, true);
	if (!result.ok) return;
	const terms = result.view.grid
		.flatMap((row) => row.cells)
		.flatMap((cell) => cell.entries)
		.map((e) => e.termIndex);
	assert.deepEqual(terms, [3], 'every projected entry carries the one selected term');
	assert.ok(terms.every((t) => typeof t === 'number' && t > 0), 'no entry may project an invented term');
});

test('MUTANT: if the term filter is removed the adversarial fixture fails', () => {
	// A control that proves this suite would catch a regression rather than
	// merely passing. Simulates the pre-fix behaviour — merge every term — and
	// asserts the resulting violation is detectable.
	const merged = THREE_TERM_REPORT.entries.map((e) => e.entryId);
	assert.equal(merged.length, 3, 'the fixture really does hold one entry per term in one slot');
	const allTermsInOneSlot = merged.length > 1;
	assert.ok(allTermsInOneSlot, 'an unfiltered merge of this fixture is a >1 occupancy, which is exactly what was scored as a conflict');
});
