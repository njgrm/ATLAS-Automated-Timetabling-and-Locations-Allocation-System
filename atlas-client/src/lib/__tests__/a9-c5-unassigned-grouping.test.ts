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
	groupUnassignedByRotationFamily,
	groupUnassignedByTerm,
	humanizeFamilyToken,
	resolveRotationTermLabel,
	rotationFamilyPlainName,
	subjectIdentityLabel,
	unassignedMemberLabel,
	unassignedMinutesLabel,
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

test('SUPERSEDED (A9-c5 R1): A9-C5-1: rows group by TERM, ascending, with the all-year group last', () => {
	// Superseded as PRODUCTION BEHAVIOUR by `groupUnassignedByRotationFamily` below
	// (operator section.docx item 5 asked for one row per rotating family). The
	// function still exists and is still true, so the row is KEPT, not deleted; the
	// replacement controls (A9-C5-5..9) are beside it.
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

/* ═══════════════════ A9 c5 R1 (2026-09-30): ONE ROW PER ROTATING FAMILY ═══════════════════
 * Operator (section.docx item 5): *"show a term-rotating family (Science, TLE) as ONE row with its
 * per-term subjects inline (e.g. 'Science (rotates): Chemistry T2, Earth Science T3'), no raw codes
 * (SCI_CHEM, TLE_AFA_EXP, TLE_ROTATION) on screen."* These rows call the pure functions the dialog
 * renders, so the wording and the structure cannot drift behind a green suite. */

/** Real server-shaped rows: `subjectName` is the human name (`Science Chemistry`). */
const FAMILY_ROWS = [
	{ subjectId: 11, subjectName: 'Science Chemistry', subjectDisplayLabel: 'SCIENCE', subjectCode: 'SCI_CHEM', rotationFamily: 'SCIENCE', rotationTermGroupId: 'sci', rotationTermLabel: 'TERM 2', rotationTermRank: 2, minMinutesPerWeek: 225 },
	{ subjectId: 12, subjectName: 'Science Earth Science', subjectDisplayLabel: 'SCIENCE', subjectCode: 'SCI_EARTH', rotationFamily: 'SCIENCE', rotationTermGroupId: 'sci', rotationTermLabel: 'TERM 3', rotationTermRank: 3, minMinutesPerWeek: 225 },
	{ subjectId: 13, subjectName: 'TLE Bread and Pastry', subjectDisplayLabel: 'TLE', subjectCode: 'TLE_BREAD', rotationFamily: 'TLE_ROTATION', rotationTermGroupId: 'tle', rotationTermLabel: 'TERM 2', rotationTermRank: 2, minMinutesPerWeek: 300 },
	{ subjectId: 14, subjectName: 'TLE Nail Care', subjectDisplayLabel: 'TLE', subjectCode: 'TLE_NAIL', rotationFamily: 'TLE_ROTATION', rotationTermGroupId: 'tle', rotationTermLabel: 'TERM 3', rotationTermRank: 3, minMinutesPerWeek: 300 },
	{ subjectId: 15, subjectName: 'MAPEH', subjectDisplayLabel: 'MAPEH', subjectCode: 'MAPEH', rotationFamily: null, rotationTermGroupId: null, rotationTermLabel: null, rotationTermRank: null, minMinutesPerWeek: 225 },
];

test('A9-C5-5 (R1): a rotating family is ONE row, its per-term members inline', () => {
	const groups = groupUnassignedByRotationFamily(FAMILY_ROWS);
	// Three rows: two families plus one plain class — NOT one row per subject, and not one per term.
	assert.deepEqual(
		groups.map((g) => [g.heading, g.rows.length]),
		[['Science (rotates)', 2], ['TLE (rotates)', 2], ['MAPEH', 1]],
		'the rotating families must collapse to one row each',
	);
	assert.deepEqual(groups[0].members, ['Chemistry T2', 'Earth Science T3']);
	assert.deepEqual(groups[1].members, ['Bread and Pastry T2', 'Nail Care T3']);
	assert.equal(groups[0].rotates, true, 'a family row is marked rotating');
	assert.equal(groups[2].rotates, false, 'a plain class is not marked rotating');
});

test('A9-C5-6 (R1): a class that does not rotate keeps a plain row and no invented term', () => {
	const groups = groupUnassignedByRotationFamily(FAMILY_ROWS);
	const plain = groups.find((g) => g.heading === 'MAPEH');
	assert.ok(plain, 'the non-rotating class must still render');
	assert.equal(plain!.rotates, false);
	assert.deepEqual(plain!.members, ['MAPEH']);
	assert.doesNotMatch(plain!.members.join(' '), /\bT\d/, 'a non-rotating class must not gain a term');
});

test('A9-C5-7 (R1): no raw code token survives into any heading or member', () => {
	// The regex the packet names, plus the three literal tokens it forbids.
	const RAW = /[A-Z0-9]+_[A-Z0-9_]+/;
	const CODEY = [
		{ subjectId: 21, subjectName: 'SCI_CHEM', subjectDisplayLabel: 'SCI_CHEM', subjectCode: 'SCI_CHEM', rotationFamily: 'SCIENCE', rotationTermGroupId: 'sci', rotationTermLabel: 'TERM 2', rotationTermRank: 2, minMinutesPerWeek: 225 },
		{ subjectId: 22, subjectName: 'TLE_AFA_EXP', subjectDisplayLabel: 'TLE_AFA_EXP', subjectCode: 'TLE_AFA_EXP', rotationFamily: 'TLE_ROTATION', rotationTermGroupId: 'tle', rotationTermLabel: 'TERM 2', rotationTermRank: 2, minMinutesPerWeek: 300 },
		{ subjectId: 23, subjectName: 'TLE_ROTATION', subjectDisplayLabel: 'TLE_ROTATION', subjectCode: 'TLE_ROTATION', rotationFamily: 'TLE_ROTATION', rotationTermGroupId: 'tle', rotationTermLabel: 'TERM 3', rotationTermRank: 3, minMinutesPerWeek: 300 },
	];
	for (const group of groupUnassignedByRotationFamily(CODEY)) {
		for (const text of [group.heading, ...group.members, group.minutesLabel]) {
			assert.doesNotMatch(text, RAW, `a raw code token reached the screen: "${text}"`);
		}
		assert.doesNotMatch(group.heading, /SCI_CHEM|TLE_AFA_EXP|TLE_ROTATION/);
		assert.doesNotMatch(group.members.join(' '), /SCI_CHEM|TLE_AFA_EXP|TLE_ROTATION/);
	}
});

test('A9-C5-8 (R1): the minutes figure stays truthful — one value, or a range', () => {
	assert.equal(unassignedMinutesLabel([225, 225]), '225 min');
	assert.equal(unassignedMinutesLabel([150, 225]), '150–225 min');
	assert.equal(unassignedMinutesLabel([]), '', 'no minutes must not invent a figure');
	const groups = groupUnassignedByRotationFamily([
		{ subjectId: 31, subjectName: 'Science Physics', subjectCode: 'SCI_PHY', rotationFamily: 'SCIENCE', rotationTermGroupId: 'sci', rotationTermLabel: 'TERM 2', rotationTermRank: 2, minMinutesPerWeek: 150 },
		{ subjectId: 32, subjectName: 'Science Biology', subjectCode: 'SCI_BIO', rotationFamily: 'SCIENCE', rotationTermGroupId: 'sci', rotationTermLabel: 'TERM 3', rotationTermRank: 3, minMinutesPerWeek: 225 },
	]);
	assert.equal(groups[0].minutesLabel, '150–225 min', 'a family whose members differ must not claim one value');
});

test('A9-C5-9 (R1): a leading family word is dropped, and a single-word row is never blanked', () => {
	assert.equal(
		unassignedMemberLabel({ subjectName: 'Science Chemistry', rotationTermLabel: 'TERM 2', rotationTermRank: 2 }, 'Science'),
		'Chemistry T2',
	);
	assert.equal(
		unassignedMemberLabel({ subjectName: 'TLE Bread and Pastry', rotationTermLabel: 'TERM 3', rotationTermRank: 3 }, 'TLE'),
		'Bread and Pastry T3',
	);
	// A single-word subject equal to the family must not collapse to an empty label.
	assert.equal(
		unassignedMemberLabel({ subjectName: 'Science', rotationTermLabel: 'TERM 2', rotationTermRank: 2 }, 'Science'),
		'Science T2',
	);
	// The family token itself never reaches the screen; the plain name does.
	assert.equal(rotationFamilyPlainName({ subjectName: 'TLE Bread and Pastry', rotationFamily: 'TLE_ROTATION' }), 'TLE');
	assert.equal(rotationFamilyPlainName({ subjectName: 'Science Chemistry', rotationFamily: 'SCIENCE' }), 'Science');
	assert.equal(humanizeFamilyToken('STE_APPLIED_CHEM'), 'Applied Chemistry');
});

/* ═══════════════════ A9 c2 R2 (2026-09-30): NO EMPTY MEMBER LABEL ═══════════════════
 * A fully blank rotating row used to produce `members: ['']`, so the family row
 * rendered `Science (rotates): ` with a trailing empty member. The row is
 * unreachable from today's non-null server shape; the guard is here regardless.
 * Truthful: fall back to the family's plain name (the only identity it has) and
 * never invent a term. Fails first at `c886a410`, where the member is ''. */

test('A9-C5-10 (R2): a fully blank rotating row never lists an empty member', () => {
	const groups = groupUnassignedByRotationFamily([
		{ subjectId: 90, subjectName: null, subjectDisplayLabel: null, subjectCode: null, rotationFamily: 'SCIENCE', rotationTermGroupId: 'sci', rotationTermLabel: null, rotationTermRank: null, minMinutesPerWeek: null },
	]);
	assert.equal(groups.length, 1, 'the blank rotating row still forms one family row');
	assert.equal(groups[0].heading, 'Science (rotates)');
	assert.deepEqual(
		groups[0].members,
		['Science'],
		'a blank member must fall back to the family name, never an empty string',
	);
	for (const member of groups[0].members) {
		assert.ok(member.trim().length > 0, `no member label may be empty; got "${member}"`);
	}
	assert.doesNotMatch(groups[0].members.join(' '), /\bT\d/, 'a blank row must not gain an invented term');
});

test('A9-C5-11 (R2): an empty member label is dropped at the grouping boundary', () => {
	// Defence in depth: a row whose family NAME is itself blank (no name, no code,
	// only a group id) cannot push a '' member into the row's member list.
	const groups = groupUnassignedByRotationFamily([
		{ subjectId: 91, subjectName: null, subjectDisplayLabel: null, subjectCode: null, rotationFamily: null, rotationTermGroupId: 'bare', rotationTermLabel: null, rotationTermRank: null, minMinutesPerWeek: null },
	]);
	for (const group of groups) {
		for (const member of group.members) {
			assert.ok(member.trim().length > 0, `no member label may be empty; got "${member}"`);
		}
	}
	assert.deepEqual(groups[0].members, [], 'an empty label is dropped rather than emitted');
});
