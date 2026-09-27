/**
 * A3-C5-SUBJECTS-STATS (stream A3) — the "Room constrained" tile contradicts its
 * own help text.
 *
 * THE DEFECT
 *
 * `useSubjectStats.tsx` counted a subject as room-constrained on
 * `s.requiredFeatures.length > 0`. `requiredFeatures` is a MIXED list: the
 * server folds an ownership marker `OWNER_DEPT:<code>` into it
 * (atlas-server/src/services/subject-ownership.service.ts:44) alongside real
 * room features. So an active `CLASSROOM` subject whose only feature is
 * `['OWNER_DEPT:AP']` — a subject with NO room need whatsoever — was counted as
 * "Room constrained", while the tile's own help text says "Active subjects that
 * need a specialized room type or room feature", and while its two siblings
 * (`SubjectRow.tsx:84`, `SubjectCoverageSheet.tsx:84`) already filter the
 * markers out. Three surfaces, one subject, two different answers.
 *
 * WHY THE SPLIT IS NOT RE-IMPLEMENTED HERE
 *
 * The fix calls the repository's single definition, `splitSubjectFeatures`,
 * rather than adding a second `.filter(f => !f.startsWith('OWNER_DEPT'))`. A
 * second definition is the defect class AGENTS.md §11 records, and control
 * `A3-C5-6c` below exists specifically to make a hand-rolled filter go red: a
 * naive prefix test misses `'  owner_dept:ap '` (case/whitespace) and counts
 * `'   '` as a room feature, where the shared splitter correctly does neither.
 *
 * F6 — THIS SUITE DOES NOT ASSERT ABSENCE ONLY
 *
 * A suite proving only "the marker subject is not counted" is passed by a
 * function that counts NOTHING. So every case below is pinned to an EXACT
 * integer, and `A3-C5-6b` computes the pre-fix, marker-inclusive count over the
 * same fixture and requires it to be STRICTLY HIGHER — the exact assertion that
 * goes red if the marker exclusion is removed. `A3-C5-6a` additionally shows
 * the count scaling with real room demand, so "always returns 0" cannot pass.
 *
 * FIXTURES come from the real `Subject` shape (full field set), derived from the
 * fixture already used by `a3-c4-subjects-copy.test.tsx` — AGENTS.md §11 warns
 * that an invented minimal fixture passes controls a real row would fail.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { countRoomConstrainedSubjects } from '../useSubjectStats';
import { splitSubjectFeatures } from '../subject-feature-presentation';
import type { Subject } from '../../../types';

/**
 * A REAL `Subject` row, carrying the full field set the API returns. Defaults
 * are a plain `CLASSROOM` subject with no features — the unremarkable case every
 * counting assertion starts from.
 */
function subjectFixture(overrides: Partial<Subject> = {}): Subject {
	return {
		id: 41,
		code: 'SCI10',
		name: 'Earth Science',
		displayCode: 'SCI10',
		outputLabel: null,
		ownerDepartment: 'AP',
		allowedOwnerDepartments: ['AP'],
		qualificationPriority: 'DEPARTMENT_FIRST',
		rotationFamily: null,
		minMinutesPerWeek: 225,
		preferredRoomType: 'CLASSROOM',
		isActive: true,
		isSeedable: false,
		isSystemManaged: false,
		gradeLevels: [9],
		interSectionEnabled: false,
		interSectionGradeLevels: [],
		modularGroupId: null,
		modularOrder: null,
		programScopes: ['REGULAR'],
		allowedSpecializations: [],
		requiredFeatures: [],
		rotationTermLabel: null,
		rotationTermRank: null,
		rotationTermGroupId: null,
		rotationTermCount: null,
		specializationSource: 'NONE',
		createdAt: '2026-09-28T00:00:00.000Z',
		updatedAt: '2026-09-28T00:00:00.000Z',
		...overrides,
	} as Subject;
}

// ===========================================================================
// The five required cases. Each pinned to an EXACT number.
// ===========================================================================

/**
 * THE FIX. An active `CLASSROOM` subject carrying an ownership marker and
 * nothing else has NO room need, so it is not room-constrained.
 *
 * DISCRIMINATOR (failing-first): on base this returns 1.
 */
test('A3-C5-1a: an ownership marker alone does not make a CLASSROOM subject room-constrained', () => {
	const subjects = [subjectFixture({ requiredFeatures: ['OWNER_DEPT:AP'] })];
	assert.equal(
		countRoomConstrainedSubjects(subjects),
		0,
		'a subject whose only feature is an ownership marker is being counted as room-constrained, ' +
			'while the tile claims it needs "a specialized room type or room feature"',
	);
});

/** A real room feature still counts — the fix must not swallow ground 2. */
test('A3-C5-1b: a real room feature on a CLASSROOM subject is counted', () => {
	const subjects = [subjectFixture({ requiredFeatures: ['LAB_BENCH'] })];
	assert.equal(
		countRoomConstrainedSubjects(subjects),
		1,
		'a subject that genuinely needs a lab bench is no longer counted as room-constrained',
	);
});

/**
 * The mixed case, and the one that pins the fix to "excludes markers" rather
 * than "excludes marked subjects": the real room feature is still counted even
 * though an ownership marker sits beside it.
 */
test('A3-C5-1c: a real room feature still counts when an ownership marker sits beside it', () => {
	const subjects = [subjectFixture({ requiredFeatures: ['OWNER_DEPT:AP', 'LAB_BENCH'] })];
	assert.equal(
		countRoomConstrainedSubjects(subjects),
		1,
		'the real room feature is not counted once an ownership marker is present in the same list',
	);
});

/**
 * Ground 1 must survive the change: `preferredRoomType` is a non-nullable
 * `RoomType` (`types.ts`), so a subject wanting a non-classroom room is
 * constrained regardless of its feature list.
 */
test('A3-C5-1d: a non-CLASSROOM preferred room type is counted with no features at all', () => {
	const subjects = [subjectFixture({ preferredRoomType: 'LABORATORY', requiredFeatures: [] })];
	assert.equal(
		countRoomConstrainedSubjects(subjects),
		1,
		'the preferred-room-type ground was lost — a subject needing a LAB is no longer counted',
	);
});

/**
 * The `isActive` gate must survive: an archived subject is out of scope for the
 * tile, even when it has real room features AND a non-classroom room type.
 */
test('A3-C5-1e: an archived subject is never counted, whatever its room needs', () => {
	const subjects = [
		subjectFixture({ id: 46, isActive: false, requiredFeatures: ['LAB_BENCH'] }),
		subjectFixture({ id: 47, isActive: false, preferredRoomType: 'LABORATORY' }),
	];
	assert.equal(
		countRoomConstrainedSubjects(subjects),
		0,
		'an archived subject is being counted as room-constrained; the tile says "Active subjects"',
	);
});

// ===========================================================================
// A mixed set with a pinned total, plus the discrimination controls.
// ===========================================================================

/**
 * The mixed catalogue. Exactly THREE of these seven are room-constrained, and
 * the total is asserted as a number so an over- or under-count cannot pass.
 */
const MIXED_CATALOGUE: Subject[] = [
	// 0 — the reported defect: marker only, no room need.
	subjectFixture({ id: 41, requiredFeatures: ['OWNER_DEPT:AP'] }),
	// 1 — genuine room feature.
	subjectFixture({ id: 42, requiredFeatures: ['LAB_BENCH'] }),
	// 1 — marker AND a real feature: the feature is what counts.
	subjectFixture({ id: 43, requiredFeatures: ['OWNER_DEPT:AP', 'LAB_BENCH'] }),
	// 1 — room-type ground, empty feature list.
	subjectFixture({ id: 44, preferredRoomType: 'LABORATORY', requiredFeatures: [] }),
	// 0 — an ordinary classroom subject.
	subjectFixture({ id: 45 }),
	// 0 — archived, real room feature.
	subjectFixture({ id: 46, isActive: false, requiredFeatures: ['LAB_BENCH'] }),
	// 0 — archived, non-classroom room, and a marker.
	subjectFixture({ id: 47, isActive: false, preferredRoomType: 'LABORATORY', requiredFeatures: ['OWNER_DEPT:TLE'] }),
];

test('A3-C5-2a: a mixed catalogue yields exactly three room-constrained subjects', () => {
	assert.equal(
		countRoomConstrainedSubjects(MIXED_CATALOGUE),
		3,
		'the room-constrained total over a mixed catalogue is wrong — an over- or under-count passed',
	);
});

/**
 * F6 POSITIVE CONTROL. "The marker subject is not counted" is satisfiable by a
 * function that counts nothing, so the count is shown to TRACK real room demand:
 * 0 subjects needing a special room, then one, then three.
 */
test('A3-C5-6a: the count tracks real room demand, so it cannot be satisfied by counting nothing', () => {
	assert.equal(
		countRoomConstrainedSubjects([]),
		0,
		'an empty catalogue does not report zero room-constrained subjects',
	);
	assert.equal(
		countRoomConstrainedSubjects([subjectFixture({ id: 1 }), subjectFixture({ id: 2, code: 'MATH10' })]),
		0,
		'two plain CLASSROOM subjects with no features are reported as room-constrained',
	);
	assert.equal(
		countRoomConstrainedSubjects([
			subjectFixture({ id: 1, preferredRoomType: 'GYMNASIUM' }),
			subjectFixture({ id: 2, code: 'MATH10', requiredFeatures: ['PROJECTOR'] }),
		]),
		2,
		'two genuinely room-constrained subjects are not both counted — the count is under-reporting',
	);
});

/**
 * F6 DISCRIMINATION — the mandatory positive control. This is the assertion that
 * goes RED if the marker exclusion is removed.
 *
 * `markerInclusiveCount` is the BASE implementation, reproduced here verbatim
 * from `useSubjectStats.tsx` at base (`s.requiredFeatures.length > 0`). Over the
 * SAME fixture it yields 4, not 3. The two numbers are asserted to differ, so
 * the pinned total of 3 in `A3-C5-2a` is attributable to the marker exclusion
 * and not to any other property of the fixture.
 *
 * HOW THIS WAS DEMONSTRATED: the suite was first run against the base
 * `useSubjectStats.tsx` (see the executor handoff for the literal output) and
 * `A3-C5-1a` and `A3-C5-2a` both failed there, returning 1 and 4 respectively.
 */
test('A3-C5-6b: the marker-inclusive base count is strictly higher, so the fix is load-bearing', () => {
	/** The base implementation, verbatim. */
	const markerInclusiveCount = (subjects: Subject[]): number =>
		subjects.filter(
			(s) => s.isActive && (s.preferredRoomType !== 'CLASSROOM' || s.requiredFeatures.length > 0),
		).length;

	const base = markerInclusiveCount(MIXED_CATALOGUE);
	const fixed = countRoomConstrainedSubjects(MIXED_CATALOGUE);

	assert.equal(base, 4, 'the recorded base behaviour changed — re-verify before trusting the contrast below');
	assert.equal(fixed, 3, 'the fixed count over the same fixture is not the expected 3');
	assert.ok(
		base > fixed,
		'DISCRIMINATION FAILURE: the marker-inclusive count does not exceed the fixed count, so this ' +
			'suite cannot tell the fix from the defect it replaced',
	);
	// And the one-subject difference is exactly the marker-only subject.
	assert.equal(
		base - fixed,
		1,
		'the gap between the base and fixed counts is not the single marker-only subject',
	);
});

/**
 * A hand-rolled second definition is the defect class §11 records, so the
 * shared splitter's behaviour is pinned where a naive filter differs.
 *
 * `splitSubjectFeatures` trims, uppercases for the marker test, and drops empty
 * entries. A local `.filter((f) => !f.startsWith('OWNER_DEPT'))` gets all three
 * wrong: it misses the lowercase/whitespace marker, and it counts a
 * whitespace-only entry as a room feature. Each of these would be an
 * under- and over-count respectively, so this control is what makes "one shared
 * definition" enforced rather than merely requested.
 */
test('A3-C5-6c: the count follows the shared splitter where a hand-rolled prefix filter would diverge', () => {
	// A marker that is lowercase and whitespace-padded is still a marker.
	const padded = subjectFixture({ requiredFeatures: ['  owner_dept:ap  '] });
	assert.equal(
		countRoomConstrainedSubjects([padded]),
		0,
		'a padded/lowercase ownership marker is being counted as a room feature — the split is not the shared one',
	);
	// A whitespace-only entry carries no room requirement at all.
	const blank = subjectFixture({ requiredFeatures: ['   '] });
	assert.equal(
		countRoomConstrainedSubjects([blank]),
		0,
		'a whitespace-only entry is being counted as a room feature',
	);
	// ...while a padded REAL feature is a real feature and must still count.
	const paddedReal = subjectFixture({ requiredFeatures: ['  LAB_BENCH  '] });
	assert.equal(
		countRoomConstrainedSubjects([paddedReal]),
		1,
		'a real room feature lost its count — the change narrowed the count instead of correcting it',
	);

	// Pin the same three facts on the shared splitter directly, so a future
	// divergence in the shared module is attributed to the shared module.
	assert.deepEqual(splitSubjectFeatures(['  owner_dept:ap  ']).roomFeatures, []);
	assert.deepEqual(splitSubjectFeatures(['   ']).roomFeatures, []);
	assert.deepEqual(splitSubjectFeatures(['  LAB_BENCH  ']).roomFeatures, ['LAB_BENCH']);
});

/**
 * SUPPLEMENTARY ratchet, not the primary proof. The behaviour controls above
 * are what discriminate; this only records that the count has not quietly grown
 * its own copy of the marker prefix. Labelled as a ratchet because the prior
 * stream's source-shape ratchet passed review while the defect was fully back.
 */
test('A3-C5-6d: the count consumes the shared splitter rather than re-testing the marker prefix', () => {
	const source = readFileSync(
		resolve(import.meta.dirname, '../useSubjectStats.tsx'),
		'utf8',
	);
	assert.match(
		source,
		/splitSubjectFeatures/,
		'the count no longer calls the repository\'s shared feature splitter',
	);
	assert.doesNotMatch(
		source,
		/startsWith\(\s*['"]OWNER_DEPT/,
		'a second, hand-rolled marker-prefix definition was added next to the shared splitter',
	);
	// The help text is unchanged: it already described the corrected behaviour,
	// and the defect was the count disagreeing with it rather than the copy.
	assert.match(
		source,
		/Active subjects that need a specialized room type or room feature\./,
		'the tile help text was altered — the fix belongs in the count, not the copy',
	);
});
