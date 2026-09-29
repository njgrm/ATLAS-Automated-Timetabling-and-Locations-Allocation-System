/**
 * A5 (2026-09-30) — rotation-aware subject counts: helper unit tests, the
 * failing-first control, and the cross-layer parity test.
 *
 * THE DEFECT. A term-rotating family is stored as one catalogue row per term
 * slot, so a section teaching Science (SCI_BIO/SCI_CHEM/SCI_ES, termGroupId
 * SCIENCE) and TLE (TLE_AFA_EXP/TLE_FCS_EXP/TLE_ICT_EXP, termGroupId
 * TLE_EXPLORATORY) read as SIX subjects where the scheduler knows TWO.
 *
 * FAILING-FIRST is explicit: `base` is the shower of `.length` the old counts
 * used, asserted at 6 for the rotation-only set and 8 with the two standalone
 * subjects. The helper reads 2 and 4. `base > fixed` is asserted so the pinned
 * total is attributable to the helper and not to a fixture that happens not to
 * discriminate.
 *
 * CROSS-LAYER PARITY. The Dashboard "Subjects" tile is counted in
 * `atlas-server/src/services/subject-rotation-count.service.ts`, which is a
 * separate TypeScript program (the server's `rootDir: src` cannot reach client
 * source). This file imports THAT server module directly and asserts the two
 * layers return the SAME numbers over the SAME fixture, so drift is caught
 * rather than assumed absent. The server module is dependency-free on purpose,
 * which is what makes it importable here.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	countSubjectGroups,
	distinctSubjectsByRotation,
	groupSubjectsByRotation,
	subjectRotationGroupKey,
} from '@/lib/rotation-subject-count';
import { countRotationSubjectGroups } from '../../../../atlas-server/src/services/subject-rotation-count.service';

/** Both layers accept these rows: the client's `RotationSubjectLike` and the
 *  server's `SubjectRotationCountRow`. */
type ParityRow = {
	termGroupId: string | null;
	rotationFamily: string | null;
	hasFacultySubject: boolean;
};

/* ─────────────────────────── fixtures ─────────────────────────── */

const SCIENCE_ROTATION: ParityRow[] = [
	{ termGroupId: 'SCIENCE', rotationFamily: 'SCIENCE', hasFacultySubject: true },
	{ termGroupId: 'SCIENCE', rotationFamily: 'SCIENCE', hasFacultySubject: true },
	{ termGroupId: 'SCIENCE', rotationFamily: 'SCIENCE', hasFacultySubject: true },
];

const TLE_ROTATION: ParityRow[] = [
	{ termGroupId: 'TLE_EXPLORATORY', rotationFamily: 'TLE', hasFacultySubject: true },
	{ termGroupId: 'TLE_EXPLORATORY', rotationFamily: 'TLE', hasFacultySubject: true },
	{ termGroupId: 'TLE_EXPLORATORY', rotationFamily: 'TLE', hasFacultySubject: true },
];

const STANDALONE: ParityRow[] = [
	{ termGroupId: null, rotationFamily: null, hasFacultySubject: true },
	{ termGroupId: null, rotationFamily: null, hasFacultySubject: true },
];

const ROTATION_ONLY: ParityRow[] = [...SCIENCE_ROTATION, ...TLE_ROTATION];
const SECTION_WITH_STANDALONE: ParityRow[] = [...ROTATION_ONLY, ...STANDALONE];

/* ─────────────────────────── the one rule ─────────────────────────── */

test('RSC-1 subjectRotationGroupKey: termGroupId wins, then rotationFamily, then null', () => {
	assert.equal(
		subjectRotationGroupKey({ termGroupId: 'science', rotationFamily: 'tle' }),
		'SCIENCE',
		'termGroupId must take precedence over rotationFamily',
	);
	assert.equal(
		subjectRotationGroupKey({ termGroupId: null, rotationFamily: 'tle' }),
		'TLE',
		'rotationFamily is the fallback key when termGroupId is absent',
	);
	assert.equal(
		subjectRotationGroupKey({ termGroupId: '  ' , rotationFamily: '' }),
		null,
		'whitespace-only keys are null, so a blank field never merges rows',
	);
	assert.equal(
		subjectRotationGroupKey({}),
		null,
		'a row with neither field is standalone',
	);
});

test('RSC-2 groupSubjectsByRotation: a family is one group; a standalone row is its own group', () => {
	const groups = groupSubjectsByRotation(SECTION_WITH_STANDALONE);
	assert.equal(groups.length, 4, 'Science(3) + TLE(3) + 2 standalone must be FOUR groups');
	assert.deepEqual(
		groups.map((group) => group.length),
		[3, 3, 1, 1],
		'the two rotation families each hold their three term rows; each standalone stands alone',
	);
});

test('RSC-3 distinctSubjectsByRotation: one representative per group', () => {
	const distinct = distinctSubjectsByRotation(SECTION_WITH_STANDALONE);
	assert.equal(distinct.length, 4, 'four groups means four representatives');
});

/* ─────────────────────────── the failing-first control ─────────────────────────── */

test('RSC-4 FAILING-FIRST: the naive row count is 6/8, the rotation count is 2/4', () => {
	// The base implementation, verbatim: every count surface used `.length`.
	const base = (rows: ParityRow[]): number => rows.length;

	assert.equal(
		base(ROTATION_ONLY),
		6,
		'the recorded base behaviour changed — re-verify before trusting the contrast below',
	);
	assert.equal(
		countSubjectGroups(ROTATION_ONLY),
		2,
		'Science(3) + TLE(3) must count as TWO subjects',
	);
	assert.ok(
		base(ROTATION_ONLY) > countSubjectGroups(ROTATION_ONLY),
		'DISCRIMINATION FAILURE: the naive count does not exceed the fixed count, so this suite ' +
			'cannot tell the fix from the defect it replaced',
	);

	assert.equal(base(SECTION_WITH_STANDALONE), 8, 'the naive count over the full fixture is not 8');
	assert.equal(
		countSubjectGroups(SECTION_WITH_STANDALONE),
		4,
		'Science + TLE + 2 standalone must count as FOUR subjects, never 6 or 8',
	);
});

/* ─────────────────────────── family-level predicate semantics ─────────────────────────── */

test('RSC-5 a group counts once when ANY member satisfies the predicate', () => {
	const rows: ParityRow[] = [
		// Science: one unstaffed member -> the family is ONE problem.
		{ termGroupId: 'SCIENCE', rotationFamily: null, hasFacultySubject: false },
		{ termGroupId: 'SCIENCE', rotationFamily: null, hasFacultySubject: true },
		{ termGroupId: 'SCIENCE', rotationFamily: null, hasFacultySubject: true },
		// TLE: fully staffed -> no problem.
		{ termGroupId: 'TLE_EXPLORATORY', rotationFamily: null, hasFacultySubject: true },
		{ termGroupId: 'TLE_EXPLORATORY', rotationFamily: null, hasFacultySubject: true },
		{ termGroupId: 'TLE_EXPLORATORY', rotationFamily: null, hasFacultySubject: true },
	];
	assert.equal(
		countSubjectGroups(rows, (row) => !row.hasFacultySubject),
		1,
		'a partly-staffed family must read as ONE gap, not one-per-term-row and not zero',
	);
});

test('RSC-6 two distinct rotation groups stay two; codes are not used as a heuristic', () => {
	// Different termGroupId, same rotationFamily-ish look — they must not merge.
	const rows: ParityRow[] = [
		{ termGroupId: 'SCIENCE', rotationFamily: 'X', hasFacultySubject: true },
		{ termGroupId: 'TLE_EXPLORATORY', rotationFamily: 'X', hasFacultySubject: true },
	];
	assert.equal(countSubjectGroups(rows), 2, 'two distinct termGroupId values must stay two groups');
});

/* ─────────────────────────── cross-layer parity ─────────────────────────── */

test('RSC-7 CROSS-LAYER PARITY: client helper and server count agree on the same fixture', () => {
	for (const [name, rows] of [
		['rotation only', ROTATION_ONLY],
		['with standalone', SECTION_WITH_STANDALONE],
	] as const) {
		const server = countRotationSubjectGroups(rows);
		assert.equal(
			countSubjectGroups(rows),
			server.subjectCount,
			`the client and server subject counts disagree for the "${name}" fixture`,
		);
		assert.equal(
			countSubjectGroups(rows, (row) => !row.hasFacultySubject),
			server.unassignedSubjectCount,
			`the client and server UNASSIGNED counts disagree for the "${name}" fixture`,
		);
	}

	// Pin the absolute numbers too, so a matched-but-wrong pair cannot pass.
	assert.equal(countSubjectGroups(ROTATION_ONLY), 2, 'parity fixture: Science(3)+TLE(3) = 2');
	assert.equal(
		countSubjectGroups(SECTION_WITH_STANDALONE),
		4,
		'parity fixture: Science(3)+TLE(3)+2 standalone = 4',
	);
});
