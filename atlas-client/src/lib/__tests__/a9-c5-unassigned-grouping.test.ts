/**
 * A9 c5 (2026-09-30) — the unassigned-classes grouping, asserted as VALUES.
 *
 * Operator (`section.docx` item 2): *"notice the unassigned classes. Improve the UI. Maybe do it per
 * term instead of per subject if that is better."* The operator's screenshot showed `MAPEH` printed
 * twice (name over code) and the term folded into a per-row violet pill.
 *
 * These rows call the same pure functions the dialog renders, so the wording and the grouping cannot
 * drift behind a green suite (`AGENTS.md` §11: a source-text assertion is not acceptance evidence).
 * The rendered surface is the planner's loopback row.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	ALL_YEAR_HEADING,
	groupUnassignedByTerm,
	resolveRotationTermLabel,
	subjectIdentityLabel,
	unassignedTermRank,
} from '@/lib/section-unassigned-grouping';

/** The operator's own rows: MAPEH has no term; SCIENCE and TLE_ROTATION rotate T2/T3. */
const ROWS = [
	{ subjectId: 1, subjectName: 'MAPEH', subjectCode: 'MAPEH', rotationFamily: null, rotationTermLabel: null, rotationTermRank: null },
	{ subjectId: 2, subjectName: 'SCIENCE', subjectCode: 'SCIENCE', rotationFamily: 'SCIENCE', rotationTermLabel: 'TERM 2', rotationTermRank: 2 },
	{ subjectId: 3, subjectName: 'SCIENCE', subjectCode: 'SCIENCE', rotationFamily: 'SCIENCE', rotationTermLabel: 'TERM 3', rotationTermRank: 3 },
	{ subjectId: 4, subjectName: 'TLE_ROTATION', subjectCode: 'TLE_ROTATION', rotationFamily: 'TLE_ROTATION', rotationTermLabel: 'TERM 2', rotationTermRank: 2 },
	{ subjectId: 5, subjectName: 'TLE_ROTATION', subjectCode: 'TLE_ROTATION', rotationFamily: 'TLE_ROTATION', rotationTermLabel: 'TERM 3', rotationTermRank: 3 },
];

test('A9-C5-1: rows group by TERM, ascending, with the all-year group last', () => {
	const groups = groupUnassignedByTerm(ROWS);
	assert.deepEqual(
		groups.map((g) => [g.heading, g.rows.length]),
		[['Term 2', 2], ['Term 3', 2], [ALL_YEAR_HEADING, 1]],
		'the classes must read per term, not one flat row per subject',
	);
	// A row keeps its server order inside its group.
	assert.deepEqual(groups[0].rows.map((r) => r.subjectId), [2, 4]);
	assert.deepEqual(groups[1].rows.map((r) => r.subjectId), [3, 5]);
	assert.deepEqual(groups[2].rows.map((r) => r.subjectId), [1]);
});

test('A9-C5-2: an unreadable term degrades to All year, never to an invented Term 1', () => {
	// The failure mode this guards: a missing term becoming `Term 1` would move a class onto a term
	// nobody assigned it to. The fallback is the truthful one.
	const groups = groupUnassignedByTerm([
		{ subjectId: 9, subjectName: 'RAW', subjectCode: 'RAW', rotationTermLabel: '  ', rotationTermRank: null },
	]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].heading, ALL_YEAR_HEADING);
	assert.equal(groups[0].rank, null);
});

test('A9-C5-3: `rotationTermRank` alone still yields the term, and the label agrees', () => {
	assert.equal(resolveRotationTermLabel({ rotationTermLabel: null, rotationTermRank: 3 }), 'Term 3');
	// A label with no digit is kept verbatim (the pre-existing resolution this file preserves), and
	// its own `rotationTermRank` still gives it a term to sort into.
	assert.equal(resolveRotationTermLabel({ rotationTermLabel: 'Second Term', rotationTermRank: 2 }), 'Second Term');
	assert.equal(unassignedTermRank({ rotationTermLabel: 'Second Term', rotationTermRank: 2 }), 2);
	assert.equal(unassignedTermRank({ rotationTermLabel: 'TERM 3', rotationTermRank: null }), 3);
	assert.equal(unassignedTermRank({ rotationTermLabel: null, rotationTermRank: null }), null);
});

test('A9-C5-4: the duplicated name/code pair collapses to one line', () => {
	// The operator's exact defect: `MAPEH` over `MAPEH`.
	assert.deepEqual(subjectIdentityLabel('MAPEH', 'MAPEH'), { primary: 'MAPEH', secondary: null });
	assert.deepEqual(subjectIdentityLabel('SCIENCE', 'SCIENCE'), { primary: 'SCIENCE', secondary: null });
	assert.deepEqual(subjectIdentityLabel('TLE_ROTATION', 'TLE_ROTATION'), { primary: 'TLE_ROTATION', secondary: null });
	// A code that adds information is kept as the secondary token.
	assert.deepEqual(subjectIdentityLabel('Mathematics', 'MATH'), { primary: 'Mathematics', secondary: 'MATH' });
	// Degenerate inputs never render an empty row.
	assert.deepEqual(subjectIdentityLabel('', 'ESP'), { primary: 'ESP', secondary: null });
	assert.deepEqual(subjectIdentityLabel('English', ''), { primary: 'English', secondary: null });
});
