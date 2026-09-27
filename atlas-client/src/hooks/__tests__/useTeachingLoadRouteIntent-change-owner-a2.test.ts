/**
 * A2-TIMETABLE-CUSTODY (finding #3) — "Change owner" lands on the CLASS'S OWN
 * teacher, with the class in view.
 *
 * THE DEFECT. The timetable's "Change owner" action navigated to
 *
 *     /teaching-load?facultyId=19&sectionId=141&subjectId=6&task=missing-load
 *
 * and the page showed AGUILAR, CARLO MIGUEL · FIL — a DIFFERENT teacher from the
 * class's own (GARCIA · MAPEH) — with no way back to the class. Two defects in
 * the A2-owned routing code produce that, both visible in source:
 *
 *   a) `parseRouteIntent` resolved `task=missing-load` WITH `facultyId` at a rule
 *      ABOVE the sectionId rule, and that branch returns `sectionId: null`. The
 *      `sectionId` the timetable deliberately put in the URL was DISCARDED, so the
 *      class was never in view and there was nothing to navigate back to.
 *   b) the same branch applies `filterStatus: 'no-teaching'`, whose canonical
 *      subject is a teacher who has NO teaching load. The class being re-owned HAS
 *      a teacher — the operator is asking to CHANGE that owner — so the filter
 *      selected the opposite population from the one the operator was looking at.
 *
 * THE FIX. A `change-owner` intent, placed above the `missing-load` rules so it
 * cannot be swallowed by them, which KEEPS `sectionId`/`subjectId` and applies NO
 * "no teaching load" filter.
 *
 * Rows:
 *   R1 change-owner resolves to teacher mode on the class's OWN faculty id.
 *   R2 change-owner KEEPS the section and subject, so the class is in view — this
 *      is the discarded-`sectionId` half, and it is the row that fails at base.
 *   R3 change-owner applies no "no teaching load" filter, unlike missing-load,
 *      which is the wrong-population half.
 *   R4 precedence: change-owner is not swallowed by the missing-load rules, and a
 *      change-owner URL with no facultyId degrades safely instead of stranding.
 *   R5 the existing missing-load behaviour is UNCHANGED, so nothing that relies on
 *      the old intent moved. This is a preservation row, not a redefinition.
 *   R6 the repair queue opens nothing for change-owner, so a class with a teacher
 *      is not filed as a "teacher missing load" repair.
 *
 * Run: `npm run test:a2-change-owner-intent` (wired in atlas-client/package.json in
 * this same commit, and added to `test:client-suite`).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { parseRouteIntent } from '@/hooks/useTeachingLoadRouteIntent';

function params(query: string): URLSearchParams {
	return new URLSearchParams(query);
}

/** The exact URL the pre-fix code produced, from the finding. */
const PRE_FIX_URL = 'facultyId=19&sectionId=141&subjectId=6&task=missing-load';
/** The URL this candidate produces for the same class. */
const CANDIDATE_URL = 'facultyId=19&sectionId=141&subjectId=6&task=change-owner';

// ── R1/R2 the class's own teacher, with the class in view ────────────────────

test('R1/R2 change-owner resolves to the class OWN teacher with the class kept in view', () => {
	const intent = parseRouteIntent(params(CANDIDATE_URL));
	assert.equal(intent.viewMode, 'teacher', 'teacher mode: the operator is here to change a teacher');
	assert.equal(intent.facultyId, 19, 'and it is the CLASS\'s own teacher id, taken from the timetable entry');
	assert.equal(intent.sectionId, 141, 'the class stays in view — the pre-fix branch discarded this');
	assert.equal(intent.subjectId, 6, 'and so does the subject');
	assert.equal(intent.task, 'change-owner', 'the task round-trips');

	// MUTANT / failing-first: the pre-fix URL loses the class.
	const preFix = parseRouteIntent(params(PRE_FIX_URL));
	assert.equal(
		preFix.sectionId,
		null,
		'precondition: the pre-fix intent THREW AWAY sectionId 141, which is why there was no way back to the class',
	);
	assert.equal(
		preFix.task,
		'missing-load',
		'and it claimed the missing-load task, whose filter is about teachers with no load',
	);
});

// ── R3 no "no teaching load" filter for an action on a staffed class ─────────

test('R3 change-owner applies no "no teaching load" filter; missing-load does', () => {
	// The filter is applied in `useTeachingLoadRouteIntent`'s task block, keyed on
	// the parsed `task`. The parsed task is the contract that block reads, so this
	// asserts the routing decision that drives it.
	const changeOwner = parseRouteIntent(params(CANDIDATE_URL));
	assert.equal(
		changeOwner.task,
		'change-owner',
		'a class that HAS a teacher is not routed through the no-teaching filter',
	);
	assert.notEqual(changeOwner.task, 'missing-load', 'which is the row that would have hidden the class\'s own teacher');

	// And the missing-load intent is still the no-teaching one, for the surfaces
	// that genuinely mean "find me a teacher with no load".
	const missing = parseRouteIntent(params(PRE_FIX_URL));
	assert.equal(missing.task, 'missing-load', 'missing-load keeps its own meaning, untouched');
});

// ── R4 precedence and safe degradation ──────────────────────────────────────

test('R4 change-owner is not swallowed by the missing-load rules, and degrades safely', () => {
	// With a facultyId it must win over every missing-load branch.
	for (const query of [
		'facultyId=19&sectionId=141&task=change-owner',
		'facultyId=19&task=change-owner',
		'view=allocation&facultyId=19&task=change-owner',
	]) {
		const intent = parseRouteIntent(params(query));
		assert.equal(intent.viewMode, 'teacher', `"${query}": resolves to the teacher, not the school-wide coverage view`);
		assert.equal(intent.facultyId, 19, `"${query}": on the class's own teacher`);
	}
	// With NO facultyId there is no class teacher to name, so it must NOT claim
	// teacher mode on nobody: it falls through to the existing school-wide
	// coverage rule rather than stranding the operator.
	const noFaculty = parseRouteIntent(params('sectionId=141&subjectId=6&task=change-owner'));
	assert.ok(
		noFaculty.viewMode === 'allocation' || noFaculty.viewMode === 'teacher',
		'a change-owner URL with no teacher still lands on a real surface',
	);
	assert.equal(noFaculty.viewMode, 'allocation', 'specifically the allocation/coverage surface, not a blank teacher');
	assert.equal(noFaculty.facultyId, null, 'and it claims no teacher it does not have');
});

// ── R5 preservation: nothing that relied on the old intents moved ───────────

test('R5 the existing route intents are unchanged', () => {
	const cases: Array<[string, ReturnType<typeof parseRouteIntent>]> = [
		['task=missing-load', parseRouteIntent(params('task=missing-load'))],
		['task=missing-load&facultyId=7', parseRouteIntent(params('task=missing-load&facultyId=7'))],
		['sectionId=141', parseRouteIntent(params('sectionId=141'))],
		['facultyId=7', parseRouteIntent(params('facultyId=7'))],
		['task=over-cap', parseRouteIntent(params('task=over-cap'))],
		['task=review-placeholders', parseRouteIntent(params('task=review-placeholders'))],
		['view=subjects', parseRouteIntent(params('view=subjects'))],
		['', parseRouteIntent(params(''))],
	];
	// Each of these is the behaviour documented in the module's precedence table
	// and asserted by the pre-existing `useTeachingLoadRouteIntent.test.ts`.
	const expected: Array<[string, string | null, number | null, number | null, string | null]> = [
		['task=missing-load', 'allocation', null, null, 'missing-load'],
		['task=missing-load&facultyId=7', 'teacher', 7, null, 'missing-load'],
		['sectionId=141', 'allocation', null, 141, null],
		['facultyId=7', 'teacher', 7, null, null],
		['task=over-cap', 'teacher', null, null, 'over-cap'],
		['task=review-placeholders', 'teacher', null, null, 'review-placeholders'],
		['view=subjects', 'allocation', null, null, null],
		['', null, null, null, null],
	];
	cases.forEach(([label, intent], index) => {
		const [name, viewMode, facultyId, sectionId, task] = expected[index];
		assert.equal(label, name, 'the case order is the documented order');
		assert.equal(intent.viewMode, viewMode, `${label}: viewMode is unchanged`);
		assert.equal(intent.facultyId, facultyId, `${label}: facultyId is unchanged`);
		assert.equal(intent.sectionId, sectionId, `${label}: sectionId is unchanged`);
		assert.equal(intent.task, task, `${label}: task is unchanged`);
	});
});

// ── R6 the repair queue files nothing for a staffed class ───────────────────

test('R6 change-owner opens no "teacher missing load" repair item', () => {
	// `useTeachingLoadRepairQueue.routedRepairId` maps `teacherRepairIntent ===
	// 'missing-load'` to a `teacher-missing-<id>` repair row. For change-owner it
	// must not, because the teacher HAS a load and this is not a repair.
	const intent = parseRouteIntent(params(CANDIDATE_URL));
	assert.notEqual(
		intent.task,
		'missing-load',
		'a class with a teacher is never filed as a teacher-missing-load repair',
	);
	// And the subject-only coverage queue is likewise not selected.
	assert.notEqual(intent.viewMode, 'allocation', 'nor routed to the school-wide missing-coverage view');
});
