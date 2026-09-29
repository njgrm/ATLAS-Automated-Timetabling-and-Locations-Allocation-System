/**
 * A6 c10 — THE COVER-CLASS CONTRACT, asserted as DERIVATIONS.
 *
 * WHY THIS FILE IS PURE, and why that is a strength rather than a fallback.
 * `coverClassCandidates.ts` is React-free and API-free by design: every decision
 * the window makes is a function of data, and a function of data is provable
 * without a DOM. An earlier attempt at this file mounted the real window in jsdom
 * and was cut: Radix's `Dialog` needs a dozen DOM globals on `globalThis` that
 * jsdom does not install, and a harness that spends its budget on `ReferenceError:
 * CustomEvent is not defined` from inside `@radix-ui` is not measuring the product.
 * The RENDERED half is not abandoned — it is covered where the render already
 * happens: `a6-c9-staffing-figure`'s `A6C9-2` mounts `TeachingLoadStaffingFigure`,
 * which mounts `CoverClassDialog`, and asserts the dialog opens on the pressed
 * class's own subject and section ids. This file owns everything the window
 * DECIDES; that file owns that the window OPENS.
 *
 * WHY A PURE SUITE IS ALSO THE STRONGER EVIDENCE for these claims. AGENTS.md §11:
 * "A test that only asserts source text is not acceptance evidence for a
 * user-facing change." Nothing here reads a file's bytes — every assertion below
 * is about a value a component will render, computed by the function that
 * computes it, from A8 c4's contract shape (`docs/handoffs/lane-c-to-a2.md` §1–§3)
 * field for field, because §11 also requires the fixture to come from the real
 * surface the row is about.
 *
 * THE SEVEN CLAIMS, each mapped to the operator sentence it answers.
 *   1  placeholders are never a row, at any tier  ("absolute last resort")
 *   2  three groups, in the packet's order, empty ones omitted
 *   3  an over-cap teacher is shown, with a readable reason
 *   4  the Allow prompt is the server's own 409
 *   5  the header drops hours it was not given, rather than inventing them
 *   6  a class is open when nobody owns it OR a to-be-hired record does
 *   7  the open counts reconcile  (unowned + placeholderOwned === total)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
	COVER_LAST_RESORT_LABEL,
	PERMISSION_ALLOW_LABEL,
	coverCandidateAssignDisabled,
	coverCandidateBlockedReason,
	coverCandidateDepartment,
	coverCandidateHoursLine,
	coverCandidateNameLine,
	coverCandidateTierBadge,
	groupCoverCandidates,
	openClassIsUnstaffed,
	permissionPrompt,
	placeholderHeldClassCount,
	reconcileOpenClassCounts,
	removePlaceholderCandidates,
	type CoverCandidate,
	type CoverCandidatesResponse,
} from '@/components/faculty-assignments/coverClassCandidates';
import { coverClassHeaderLine } from '@/hooks/useCoverClass';
import { subjectCoverageVerdict, countPlaceholderHeldClasses, subjectNeedsRealTeacher, FULL_COVERAGE_LABEL } from '@/components/subjects/subjects-coverage-truth';

/**
 * A8 c4's `CoverCandidate`, field for field, contract §1. The first nine keys are
 * the packet's verbatim list and A8 c4 guarantees all nine on every row, so none
 * of them is optional here either — a field the contract promises must not be
 * typed as maybe-absent, because that is how a client grows a fallback for a field
 * the server does send.
 */
const CANDIDATE = (over: Partial<CoverCandidate> = {}): CoverCandidate => ({
	facultyId: 1,
	name: 'Teacher',
	department: 'Education',
	tier: 'QUALIFIED',
	hoursNow: 18,
	hoursAfter: 22,
	cap: 30,
	overCapAfter: false,
	reason: null,
	specialization: '',
	isPlaceholder: false,
	hasRoom: true,
	needsPermission: false,
	permissionGranted: false,
	canTeachOutsideDepartment: false,
	qualificationAuthority: null,
	version: 7,
	...over,
});

/** One row per shape the window has to survive; see the A8C10-2 note on row 6. */
const CANDIDATES: CoverCandidate[] = [
	CANDIDATE({ facultyId: 46, name: 'Ana Bautista', specialization: 'MAPEH' }),
	CANDIDATE({ facultyId: 47, name: 'Ben Cruz', hoursNow: 28, hoursAfter: 32, overCapAfter: true, hasRoom: false, reason: 'This would put them 2 h over their 30 h weekly maximum.' }),
	CANDIDATE({ facultyId: 48, name: 'Maria Reyes', department: 'Science', specialization: 'Biology', tier: 'OTHER_DEPARTMENT', needsPermission: true, reason: 'She is in Science. Allow her to teach MAPEH once to cover this class.' }),
	CANDIDATE({ facultyId: 49, name: 'Cara Dela Cruz', department: 'Filipino', tier: 'OTHER_DEPARTMENT', needsPermission: false, permissionGranted: true }),
	CANDIDATE({ facultyId: 50, name: 'Dan Ellis', department: null, tier: 'ANYONE', needsPermission: true }),
	// The row that must never survive. Its `isPlaceholder` is `true`, and the type
	// says `false` — so it is cast here deliberately, and that cast is the point:
	// it is what a server that got the flag wrong would send, and the client must
	// still refuse to render it.
	CANDIDATE({ facultyId: 88, name: '— TO BE HIRED, MAPEH —', isPlaceholder: true as unknown as false, tier: 'ANYONE' }),
];

const byId = (rows: CoverCandidate[], facultyId: number) =>
	rows.find((row) => row.facultyId === facultyId)!;

// ═════════════════════════════════════════════════════════════════════════════
// A6C10-1 / 2 — THREE PLAIN GROUPS; A PLACEHOLDER IS ABSENT, NOT LAST.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C10-1 the three groups appear in the packet order and nothing else', () => {
	const groups = groupCoverCandidates(CANDIDATES);
	assert.deepEqual(
		groups.map((group) => group.id),
		['QUALIFIED', 'OTHER_DEPARTMENT', 'ANYONE'],
		'teachers for this subject, then teachers from other departments, then anyone with free hours',
	);
	assert.deepEqual(
		groups.map((group) => group.title),
		['Teachers for this subject', 'Teachers from other departments', 'Anyone with free hours'],
		'the headings are the packet\'s three plain names, not internal vocabulary',
	);
	// The server's ranking is preserved INSIDE each group and never re-sorted:
	// contract §1 says "do not re-sort", and re-sorting client-side would be a
	// second authority on who is the best candidate.
	assert.deepEqual(
		groups[0]!.candidates.map((row) => row.facultyId),
		[46, 47],
		'within a tier the server\'s order is kept, including the over-cap teacher last in its own tier',
	);
	// Every row belongs to exactly one group, so no candidate is silently dropped
	// and none is shown twice.
	assert.equal(
		groups.reduce((total, group) => total + group.candidates.length, 0),
		removePlaceholderCandidates(CANDIDATES).length,
		'every surviving candidate is in exactly one group',
	);
});

test('A6C10-1b the server\'s own ranking survives the grouping, un-reordered', () => {
	// The five real rows, handed over deliberately OUT of tier order and with the
	// two QUALIFIED rows reversed relative to their ids — which is exactly what a
	// client-side sort by name or by facultyId would "fix", and must not.
	const shuffled = [CANDIDATES[4]!, CANDIDATES[3]!, CANDIDATES[1]!, CANDIDATES[0]!, CANDIDATES[2]!];
	assert.deepEqual(
		shuffled.map((row) => row.facultyId),
		[50, 49, 47, 46, 48],
		'precondition: the input is neither tier-sorted nor id-sorted',
	);
	const groups = groupCoverCandidates(shuffled);
	assert.deepEqual(
		groups.map((group) => group.id),
		['QUALIFIED', 'OTHER_DEPARTMENT', 'ANYONE'],
		'the GROUPS are in the packet order regardless of how the rows arrived',
	);
	assert.deepEqual(
		groups[0]!.candidates.map((row) => row.facultyId),
		[47, 46],
		'and within QUALIFIED the arrival order is intact — 47 before 46, not re-sorted by id',
	);
	assert.deepEqual(
		groups[1]!.candidates.map((row) => row.facultyId),
		[49, 48],
		'and within OTHER_DEPARTMENT likewise: 49 before 48',
	);
	assert.deepEqual(
		groups.flatMap((group) => group.candidates.map((row) => row.facultyId)),
		[47, 46, 49, 48, 50],
		'every real row survives the partition, exactly once, with no loss and no duplication',
	);
});

test('A6C10-2 a to-be-hired record is NEVER a row - not last, not greyed, absent', () => {
	// "Our fallback shouldn\'t immediately go to placeholder teachers; that should be
	// an absolute last resort, when there are no identifiable teachers that can
	// cover a class based on the scheduler\'s decision." - A class with no real
	// teacher and a placeholder available would still have to be filled by a REAL
	// teacher first, so the placeholder is not a last row: it is not a row.
	const surviving = removePlaceholderCandidates(CANDIDATES);
	assert.equal(
		surviving.some((row) => row.facultyId === 88),
		false,
		'the placeholder candidate is removed from the array, so no ordering can put it last',
	);
	assert.equal(
		groupCoverCandidates(CANDIDATES).flatMap((group) => group.candidates).some((row) => row.facultyId === 88),
		false,
		'and it is absent from every group, at every tier',
	);

	// The ROSTER\'s own flag removes it too, independently of the server flag. Both
	// are needed: a server that mislabels a placeholder must not be able to put a
	// to-be-hired record in front of a scheduler, and a roster that knows better
	// than the server must win. This is why the filter takes a set as well.
	assert.equal(
		removePlaceholderCandidates(CANDIDATES, new Set([46])).some((row) => row.facultyId === 46),
		false,
		'a faculty id the roster marks to-be-hired is removed even when the row claims isPlaceholder false',
	);
	assert.equal(
		removePlaceholderCandidates(CANDIDATES, new Set([46])).some((row) => row.facultyId === 88),
		false,
		'and the server-flagged placeholder is still removed - the two filters compose',
	);

	// MUTANT CONTROL. Without the filter, the placeholder IS present. Without this,
	// the two assertions above could be passing because the fixture happened to
	// omit it - which is the "a proof artefact must actually discriminate" failure.
	assert.equal(
		CANDIDATES.some((row) => row.facultyId === 88),
		true,
		'precondition: the fixture really does contain the row the filter removes',
	);
	assert.equal(removePlaceholderCandidates(CANDIDATES).length, CANDIDATES.length - 1, 'and exactly one row is removed');
});

test('A6C10-2b a group with nobody in it is omitted rather than rendered empty', () => {
	// An empty "Anyone with free hours" heading above a quiet last-resort link is
	// noise, and AGENTS.md §8\'s "less on screen" is the whole point of this change.
	const onlyQualified = groupCoverCandidates(CANDIDATES.filter((row) => row.tier === 'QUALIFIED'));
	assert.deepEqual(onlyQualified.map((group) => group.id), ['QUALIFIED'], 'the two empty tiers do not appear as empty headings');
	assert.equal(groupCoverCandidates([]).length, 0, 'and a response with no real candidates yields no groups, so the window shows its own honest empty state');
});

test('A6C10-2c the last-resort path is a named constant, and it is not a group', () => {
	// The to-be-hired route is a POSITION on the screen, not a fourth tier of
	// people. `groupCoverCandidates` has no way to produce it, which is the
	// structural guarantee that it cannot be ranked against a real teacher.
	assert.equal(COVER_LAST_RESORT_LABEL, 'No one can take this class?  Add a to-be-hired teacher');
	assert.equal(
		COVER_LAST_RESORT_LABEL.toLowerCase().includes('last resort'),
		false,
		'the label does not apologise; it is the operator\'s own sentence and it reads as an action',
	);
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C10-3 — AN OVER-CAP TEACHER IS SHOWN, WITH A READABLE REASON.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C10-3 an over-cap teacher is in the list, is the one that is gated, and says why', () => {
	// Contract §0.1: the packet said "has room" and the client spec said "shown
	// greyed, not hidden". A8 c4 resolved it in the client\'s favour, and this is
	// that resolution: over-cap rows ARE in the list, and only their own control
	// is disabled. Filtering server-side would leave the client unable to grey
	// anything, and a scheduler who cannot see the over-cap teacher cannot decide
	// that the over-cap teacher is the right answer.
	const ben = byId(CANDIDATES, 47);
	assert.equal(coverCandidateBlockedReason(ben), 'This would put them 2 h over their 30 h weekly maximum.', 'the server\'s own sentence is the reason, verbatim');

	const benControl = coverCandidateAssignDisabled(ben, null);
	assert.equal(benControl.disabled, true, 'their Assign control is disabled');
	assert.equal(benControl.reason, 'This would put them 2 h over their 30 h weekly maximum.', 'and it carries the reason as its own explanation');

	// ONLY that row. A control that disables every row is not a cap guard.
	for (const facultyId of [46, 48, 49, 50]) {
		const other = coverCandidateAssignDisabled(byId(CANDIDATES, facultyId), null);
		assert.equal(other.disabled, false, `faculty ${facultyId} is assignable - only the over-cap row is gated`);
		assert.equal(other.reason, null, 'and carries no disabled reason');
	}
});

test('A6C10-3b the client\'s own overrun sentence exists for a server that sends no reason', () => {
	// `reason` is the one optional field in the contract: it is a sentence the
	// server assembles, and a tier that needs no explanation may omit it. This is
	// the ONE reader of that optionality, and it is not a silent blank.
	const noReason = CANDIDATE({ hoursNow: 28, hoursAfter: 34, cap: 30, overCapAfter: true, reason: null });
	assert.equal(
		coverCandidateBlockedReason(noReason),
		'This would put them 4 h over their 30 h weekly maximum.',
		'it NAMES the overrun rather than showing a greyed row with no readable cause',
	);
	// MUTANT: a row that is not over cap has no reason, whatever its hours say.
	// Otherwise the fallback would grey every teacher who is simply busy.
	assert.equal(
		coverCandidateBlockedReason(CANDIDATE({ hoursAfter: 34, overCapAfter: false })),
		null,
		'a row that is not over cap is not gated, even when its hours exceed its cap',
	);
	// And a missing cap degrades to the honest half of the sentence, not to NaN.
	assert.equal(
		coverCandidateBlockedReason(CANDIDATE({ hoursAfter: 34, cap: Number.NaN, overCapAfter: true, reason: null })),
		'This would put them over their weekly maximum.',
		'an unparseable cap drops the figure and keeps the meaning',
	);
});

test('A6C10-3c a read-only workspace gates every row, with the page\'s own reason', () => {
	// The page already owns the write gate; a second copy of that rule here would be
	// a second answer to "can I write?". So the reason is PASSED IN, and it wins
	// over the cap reason - it is the outer condition.
	const gated = coverCandidateAssignDisabled(byId(CANDIDATES, 46), 'Read-only: verify the source first');
	assert.equal(gated.disabled, true);
	assert.equal(gated.reason, 'Read-only: verify the source first', 'the page\'s reason, not a second opinion about the cap');
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C10-4 — THE ALLOW PROMPT IS THE SERVER\'S OWN 409.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C10-4 the Allow prompt is assembled from the 409 body, in the operator\'s sentence', () => {
	// Contract §2, verbatim. The prompt is built from THIS and not from the
	// candidate row, because the 409 is the authority on who was refused: a row can
	// be stale by the time the server answers.
	const details = {
		code: 'NEEDS_PERMISSION' as const,
		facultyId: 48,
		facultyName: 'Maria Reyes',
		department: 'Science',
		subjectId: 11,
		subjectCode: 'MAPEH',
		subjectName: 'Physical Education',
		canTeachOutsideDepartment: false,
	};
	const prompt = permissionPrompt(details);
	assert.equal(prompt.question, 'Allow Maria Reyes to teach MAPEH?', 'exactly the packet\'s question, with the server\'s name and subject');
	assert.equal(prompt.detail, 'Maria Reyes is in Science. They will be allowed to teach MAPEH from now on.', 'the department is the fact being weighed, and the grant is described as lasting');
	assert.equal(prompt.confirmLabel, PERMISSION_ALLOW_LABEL);
	assert.equal(PERMISSION_ALLOW_LABEL, 'Allow and assign', 'the positive control is the packet\'s own two verbs, and it says what it does');
	assert.equal(prompt.cancelLabel, 'Cancel', 'declining is a named, equal choice');

	// A MISSING DEPARTMENT degrades to a sentence that still asks. The department
	// clause is a courtesy, not the decision, and a broken clause would be worse
	// than a shorter question.
	assert.equal(
		permissionPrompt({ ...details, department: null }).question,
		'Allow Maria Reyes to teach MAPEH?',
		'with no department the question is unchanged and still complete',
	);
	assert.doesNotMatch(
		permissionPrompt({ ...details, department: null }).detail,
		/\s\s| is in \./,
		'and the detail has no doubled space and no dangling `is in .`',
	);
	// A missing name is the one field the question cannot do without, so it
	// degrades to a pronoun rather than to `Allow undefined to teach MAPEH?`.
	assert.equal(
		permissionPrompt({ ...details, facultyName: null }).question,
		'Allow This teacher to teach MAPEH?',
		'an unnamed teacher still gets a readable question',
	);
	// A code-only subject still identifies the subject.
	assert.equal(
		permissionPrompt({ facultyName: 'Ana Bautista', subjectCode: null, subjectName: 'Physical Education' }).question,
		'Allow Ana Bautista to teach Physical Education?',
		'and the subject falls back to its name when its code is absent',
	);
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C10-5 / 6 — THE HEADER, THE LOAD CONSEQUENCE, AND THE ROW\'S IDENTITY.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C10-5 the header names the class, and DROPS hours it was not given', () => {
	const full = { subjectId: 11, subjectCode: 'MAPEH', sectionId: 305, sectionName: '8 - Rizal', gradeLevel: 8, weeklyHoursPerWeek: 4 };
	assert.equal(coverClassHeaderLine(full), 'Grade 8 – 8 - Rizal · MAPEH · 4 h/week', 'grade, class, subject, and the real weekly hours');

	// MUTANT CONTROL, and the load-bearing half. A `4 h/week` invented from a
	// default is the exact class of false claim this packet exists to remove.
	const noHours = { ...full, weeklyHoursPerWeek: undefined };
	assert.equal(coverClassHeaderLine(noHours), 'Grade 8 – 8 - Rizal · MAPEH', 'with no hours supplied the clause is DROPPED, not zeroed');
	assert.doesNotMatch(coverClassHeaderLine(noHours), /h\/week|0 h|NaN|undefined/, 'and nothing is substituted for it');

	// A non-finite hours figure is the same case: a NaN must never reach a header.
	assert.doesNotMatch(
		coverClassHeaderLine({ ...full, weeklyHoursPerWeek: Number.NaN }),
		/h\/week|NaN/,
		'a NaN hours figure is dropped exactly like an absent one',
	);
	// A grade-less section still names the class, because the section name is the
	// identifier a scheduler uses.
	assert.equal(
		coverClassHeaderLine({ subjectId: 11, subjectCode: 'MAPEH', sectionId: 305, sectionName: '8 - Rizal', gradeLevel: null }),
		'8 - Rizal · MAPEH',
		'without a grade the class is still named',
	);
});

test('A6C10-6 the row states the load consequence in the server\'s own numbers', () => {
	// Contract §1: the capacity maths is NOT the client\'s to re-derive. `cap` comes
	// from `effectiveWeeklyCapMinutes` and `hoursNow` from the same rollup the
	// auto-fill capacity ledger uses, rotation-family peak rule included. The
	// client reads all three and prints them; a client that added `hoursNow` to the
	// class\'s minutes itself could disagree with the write it is about to make.
	assert.equal(coverCandidateHoursLine(byId(CANDIDATES, 48)), '18 h → 22 h of 30 h', 'before, after, and the cap, with a real arrow');
	// A half hour is not rounded away into a lie.
	assert.equal(coverCandidateHoursLine(CANDIDATE({ hoursNow: 18.5, hoursAfter: 22.5, cap: 30 })), '18.5 h → 22.5 h of 30 h', 'a half hour survives to one decimal');
	// Any missing figure drops the whole clause rather than printing `NaN h`.
	for (const broken of [{ hoursNow: undefined }, { hoursAfter: Number.NaN }, { cap: null }] as Array<Record<string, unknown>>) {
		assert.equal(coverCandidateHoursLine(CANDIDATE(broken as never)), '', `with ${Object.keys(broken)[0]} missing the clause is dropped, not printed as NaN`);
	}
	// The department is what the scheduler is being asked to weigh on a
	// cross-department row, so it is on the row.
	assert.equal(coverCandidateDepartment(byId(CANDIDATES, 48)), 'Science');
	assert.equal(coverCandidateNameLine(byId(CANDIDATES, 48)).context, 'Science dept · Biology', 'department and specialisation together when both are known');
	assert.equal(
		coverCandidateNameLine(CANDIDATE({ department: 'Education', specialization: '' })).context,
		'Education dept',
		'the department alone when there is no specialisation',
	);
	assert.equal(coverCandidateNameLine(byId(CANDIDATES, 50)).context, null, 'and nothing at all when a teacher has no department - `null` is a real answer');
	// A blank department string is not a department.
	assert.equal(coverCandidateDepartment(CANDIDATE({ department: '   ' as never })), null, 'a whitespace department is no department');
});

test('A6C10-6b the tier badge is null for a qualified teacher, because the group heading said it', () => {
	// Two vocabularies for one fact is AGENTS.md §8\'s "two chips that say the same
	// thing". The group heading is `Teachers for this subject`; a row inside it
	// saying `QUALIFIED` again is the same defect in smaller type.
	assert.equal(coverCandidateTierBadge(byId(CANDIDATES, 46)), null, 'a QUALIFIED row carries no badge');
	assert.equal(coverCandidateTierBadge(byId(CANDIDATES, 48)), 'Science dept', 'an OTHER_DEPARTMENT row shows the department - the fact being weighed');
	assert.equal(coverCandidateTierBadge(byId(CANDIDATES, 50)), 'No subject match', 'and an ANYONE row without a department says so in words');
	assert.equal(coverCandidateTierBadge(CANDIDATE({ tier: 'ANYONE', department: 'Science' })), 'Science dept', 'the department wins when there is one');
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C10-7 — THE COUNTING RULE, and the arithmetic the audit could not reconcile.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C10-7 a class is open when nobody owns it OR a to-be-hired record owns it', () => {
	// Codex audit finding 3, rated BLOCKING: placeholders were counted as STAFFED,
	// so "Needs staffing" showed 0 while the header said 72. The predicate takes the
	// HOLDER\'S IDENTITY rather than a boolean the caller already computed, because
	// the whole defect is a caller passing `heldBy != null` instead of this.
	assert.equal(openClassIsUnstaffed(null), true, 'nobody owns it');
	assert.equal(openClassIsUnstaffed({ facultyId: 46, isPlaceholder: false }), false, 'a real teacher owns it');
	assert.equal(openClassIsUnstaffed({ facultyId: 88, isPlaceholder: true }), true, 'a to-be-hired record owns it - OPEN, and this is the row the audit found');
	// A placeholder flag with NO id is still a placeholder; an id with no flag is
	// not, because the flag is what the roster asserts.
	assert.equal(openClassIsUnstaffed({ facultyId: null, isPlaceholder: false }), true, 'a null id with no placeholder flag is unowned');
	assert.equal(openClassIsUnstaffed({ facultyId: null, isPlaceholder: true }), true, 'and a null id that is also a placeholder is open either way');
	assert.equal(openClassIsUnstaffed({ facultyId: 88, isPlaceholder: false }), false, 'an id alone is an owner; the flag is the claim about it');
});

test('A6C10-7b the open counts reconcile, and the check would catch a row that does not', () => {
	// The live figures: 50 placeholder-held, 22 unowned, 72 total.
	const real = reconcileOpenClassCounts({ total: 72, unowned: 22, placeholderOwned: 50 });
	assert.equal(real.open, 72, 'every open class is counted, whichever way it is open');
	assert.equal(real.reconciled, true, 'and the arithmetic the audit could not do is now checkable');

	// A baseline that is short by one cannot detect the damage it exists to detect -
	// AGENTS.md §11 names this exact failure. A count that does not sum is reported,
	// not absorbed.
	const short = reconcileOpenClassCounts({ total: 72, unowned: 22, placeholderOwned: 49 });
	assert.equal(short.open, 71);
	assert.equal(short.reconciled, false, 'a count that does not sum to the total is caught, and the gap is visible rather than papered over');
	// Negatives are clamped, not summed into a nonsense figure.
	assert.equal(reconcileOpenClassCounts({ total: 5, unowned: -3, placeholderOwned: 2 }).open, 2, 'a negative contribution is clamped to zero');
});

test('A6C10-7c a subject is covered only when a REAL teacher holds every class', () => {
	// Codex audit finding 7, MAJOR: `/subjects` printed "Full coverage" and
	// "MISSING COVERAGE 0" on release e75d6b8f while `/teaching-load` said 72
	// classes still needed a real teacher. Both were true of the same data, and the
	// difference was a to-be-hired record.
	const fullyCovered = subjectCoverageVerdict({ uncoveredSectionCount: 0, placeholderHeldSectionCount: 0 });
	assert.equal(fullyCovered.fullyCoveredByRealTeachers, true);
	assert.equal(fullyCovered.openClassCount, 0);
	assert.equal(fullyCovered.label, FULL_COVERAGE_LABEL, 'and only then may the word `Full coverage` be printed');

	// THE ROW THE AUDIT FOUND: every class has an owner, and the owner is a
	// placeholder. `uncoveredSectionCount` is 0 - which is exactly why the page read
	// 0 and why `Full coverage` was false reassurance.
	const placeholderOnly = subjectCoverageVerdict({ uncoveredSectionCount: 0, placeholderHeldSectionCount: 50 });
	assert.equal(placeholderOnly.fullyCoveredByRealTeachers, false, 'a subject held ENTIRELY by placeholders is NOT covered');
	assert.equal(placeholderOnly.openClassCount, 50, 'and its open figure is 50, not 0');
	assert.doesNotMatch(placeholderOnly.label, /Full coverage/, '`Full coverage` can no longer appear over a placeholder');
	assert.equal(placeholderOnly.tone, 'warning', 'and the row is a warning, in the warning tone');

	// Mixed: the two failure modes SUM, so the row's figure and the Teaching Load
	// header's figure are the same quantity computed the same way.
	const mixed = subjectCoverageVerdict({ uncoveredSectionCount: 22, placeholderHeldSectionCount: 50 });
	assert.equal(mixed.openClassCount, 72, 'unowned plus placeholder-held, which is the 72 the header claims');

	// The status FILTER used the same wrong predicate, so a subject held entirely by
	// placeholders was filtered OUT of the one filter meant to find it.
	assert.equal(
		subjectNeedsRealTeacher({ uncoveredSectionCount: 0, placeholderHeldSectionCount: 1 }),
		true,
		'one placeholder-held class is enough for the filter to keep the subject',
	);
	assert.equal(
		subjectNeedsRealTeacher({ uncoveredSectionCount: 0, placeholderHeldSectionCount: 0 }),
		false,
		'and a genuinely covered subject is still filtered out',
	);
});

test('A6C10-7d placeholder-held classes are counted by SECTION, not by record', () => {
	// One to-be-hired record covering six MAPEH classes is SIX open classes. A
	// count of records would understate the outage by exactly the factor that makes
	// it invisible - which is how a roster full of placeholders read as fine.
	const rows = [
		{ isPlaceholder: true, sectionIds: [1, 2, 3, 4, 5, 6] },
		{ isPlaceholder: false, sectionIds: [7, 8] },
		{ isPlaceholder: true, sectionIds: [9] },
	];
	assert.equal(placeholderHeldClassCount({ subjectId: 11, rows }), 7, 'six plus one, ignoring the two real ones');
	assert.equal(
		countPlaceholderHeldClasses(rows.map((row) => ({ isPlaceholder: row.isPlaceholder, sections: row.sectionIds }))),
		7,
		'the two counters agree, because they read the same rows',
	);
	assert.equal(placeholderHeldClassCount({ subjectId: 11, rows: [] }), 0, 'a subject nobody holds is zero, not an error');
	// MUTANT: a record with no sections contributes NOTHING, so a placeholder that
	// holds nothing cannot inflate the figure.
	assert.equal(
		placeholderHeldClassCount({ subjectId: 11, rows: [{ isPlaceholder: true, sectionIds: [] }] }),
		0,
		'a to-be-hired record holding no classes adds nothing',
	);
});

// ═════════════════════════════════════════════════════════════════════════════
// THE CONTRACT RESPONSE ITSELF — a shape check, so a server change is caught here
// rather than as an `undefined` on a page.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C10-8 a contract response is consumed whole: every field the window reads is present and finite', () => {
	// AGENTS.md §11: "Every acceptance row names the harness that decides it" - this
	// is the row that decides whether A8 c4's response carries what the window
	// reads. A missing field here is A8 c4's defect to report, not a client fallback
	// to add, so this asserts PRESENCE and says so.
	const response: CoverCandidatesResponse = {
		schoolId: 1,
		schoolYearId: 2,
		subject: { id: 11, code: 'MAPEH', name: 'Physical Education' },
		section: { id: 305, name: '8 - Rizal', displayOrder: 8, programType: null },
		weeklyMinutes: 240,
		candidates: CANDIDATES,
		counts: { QUALIFIED: 2, OTHER_DEPARTMENT: 2, ANYONE: 2, total: 6 },
	};
	for (const field of ['facultyId', 'name', 'department', 'tier', 'hoursNow', 'hoursAfter', 'cap', 'overCapAfter', 'version'] as const) {
		for (const row of response.candidates) {
			assert.notEqual((row as Record<string, unknown>)[field], undefined, `every candidate carries ${field} - the packet's verbatim list of nine`);
		}
	}
	/*
	 * A8 c4's contract says placeholders are NEVER in `candidates`, at any tier. The
	 * fixture above deliberately VIOLATES that, because a client that only works
	 * when the server keeps its promise is not a client - the whole point of the
	 * filter is that the promise is not the client's to rely on. So the
	 * reconciliation below is stated as what it actually is: the rendered rows are
	 * the server's own counts MINUS the rows the server should not have offered,
	 * and the difference is exactly the placeholder. That is the honest shape, and
	 * it is also the observable one - if a future server change dropped a real
	 * teacher as well, this row goes red and names the gap.
	 */
	const groups = groupCoverCandidates(response.candidates);
	const shown = groups.reduce((total, group) => total + group.candidates.length, 0);
	const offeredButRefused = response.candidates.filter((row) => row.facultyId === 88);
	assert.equal(offeredButRefused.length, 1, 'precondition: the server offered exactly one placeholder');
	assert.equal(shown, response.counts.total - offeredButRefused.length, 'the rendered rows are the server\'s total minus the placeholder it should not have offered');

	const partition = Object.fromEntries(groups.map((group) => [group.id, group.candidates.length]));
	const placeholderTiers = offeredButRefused.map((row) => row.tier);
	for (const tier of ['QUALIFIED', 'OTHER_DEPARTMENT', 'ANYONE'] as const) {
		const refusedHere = placeholderTiers.filter((row) => row === tier).length;
		assert.equal(
			partition[tier],
			(response.counts as Record<string, number>)[tier]! - refusedHere,
			`${tier}: the partition matches the server's count minus the placeholders it wrongly offered in this tier`,
		);
	}
});
