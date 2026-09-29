/**
 * A8 C3 — generate WITH teacher gaps, and group blockers by ROOT CAUSE.
 *
 * Live S.Y. 2023-2024 evidence (`docs/prompts/a8-c3-generate-with-gaps-2026-09-29.md`
 * §Evidence, 651 rows the operator saw as 651 identical "Recheck generation
 * readiness" rows):
 *
 *   TL_NO_QUALIFIED_OWNER      570   session rows of ~50 uncovered classes
 *   TL_DEMAND_UNCOVERED         50   the same fact at pair level
 *   WORKLOAD_POLICY_BLOCK       15
 *   FACULTY_SUBJECT_NOT_QUALIFIED 12
 *   FACULTY_OVERLOAD             4
 *
 * This file is the hermetic, production-path test of the two rules:
 *
 *  1. `classifyGenerationBlockers` — a GAP does not prevent generation; a
 *     BLOCKER does. Attribution is only ever accepted when the violating pair is
 *     one the SAME diagnostic proved has no owner. Everything unprovable stays a
 *     blocker (fail closed).
 *  2. `buildGenerationBlockerGroups` — one line per ROOT CAUSE, counted in
 *     CLASSES, deterministic order, derived from the already-assembled blocker
 *     objects only (no second scheduler run, no second DB read).
 *
 * Run: `npm run test:a8-c3-generate-gaps` (also named in `test:server-suite`).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	ADVISORY_CODES,
	ATTRIBUTABLE_GAP_CODES,
	COVERAGE_GAP_CODES,
	buildGenerationBlockerGroups,
	classifyGenerationBlockers,
	countGapClasses,
	deriveGenerateDecision,
} from '../services/generation-blocker-groups.service.js';
import {
	POLICY_ADVISORY_VIOLATION_CODES as ADVISORY_VIOLATION_CODES,
	buildGenerationCompletedMessage,
	summarizeTeacherGaps,
} from '../services/generation.service.js';
import { countBlockingHardViolations } from '../services/publication-contract.service.js';
import { isPromotableConstraintCode } from '../services/scheduling-policy.service.js';
import type { GenerationPreflightBlocker } from '../services/generation-preflight.service.js';

function blocker(overrides: Partial<GenerationPreflightBlocker> & { code: string }): GenerationPreflightBlocker {
	return {
		category: 'DATA_GAP',
		termIdentity: null,
		sectionId: null,
		subjectId: null,
		subjectCode: null,
		entity: 'Section ?',
		reason: 'r',
		owningSurface: 'Teaching Load',
		nextAction: 'n',
		...overrides,
	};
}

/** The live 2023-2024 shape: 50 uncovered classes, 570 session rows, 3 terms. */
function liveCoverageGapFixture() {
	const rows: GenerationPreflightBlocker[] = [];
	for (let pair = 0; pair < 50; pair += 1) {
		const sectionId = 700 + pair;
		const subjectId = 10 + (pair % 6);
		rows.push(blocker({
			code: 'TL_DEMAND_UNCOVERED',
			sectionId,
			subjectId,
			subjectCode: `SUBJ-${subjectId}`,
			entity: `Section ${sectionId} · Subject SUBJ-${subjectId}`,
		}));
		// 570 session rows over 50 classes: 13 each for the first ten and 11 for
		// the rest. A session-row count and a class count MUST disagree here, or
		// the whole point of the change is untested.
		const sessions = pair < 10 ? 13 : 11;
		for (let session = 0; session < sessions; session += 1) {
			rows.push(blocker({
				code: 'TL_NO_QUALIFIED_OWNER',
				termIdentity: `T${(session % 3) + 1}`,
				sectionId,
				subjectId,
				subjectCode: `SUBJ-${subjectId}`,
				entity: `Section ${sectionId} · Subject SUBJ-${subjectId} · T${(session % 3) + 1} · session ${session}`,
			}));
		}
	}
	return rows;
}

/* ------------------------------------------------------------------ *
 * 1. The gap-vs-blocker rule
 * ------------------------------------------------------------------ */

test('C3.1 the two coverage codes are gaps, and they are the same fact at two grains', () => {
	assert.deepEqual([...COVERAGE_GAP_CODES].sort(), ['TL_DEMAND_UNCOVERED', 'TL_NO_QUALIFIED_OWNER']);
	assert.deepEqual([...ATTRIBUTABLE_GAP_CODES].sort(), ['FACULTY_OVERLOAD', 'FACULTY_SUBJECT_NOT_QUALIFIED', 'WORKLOAD_POLICY_BLOCK']);
	const classification = classifyGenerationBlockers(liveCoverageGapFixture());
	assert.equal(classification.gaps.length, 620, 'every coverage row is a GAP');
	assert.equal(classification.blocking.length, 0, 'no coverage row blocks');
	assert.equal(classification.gapCount, 620, 'gapCount counts rows, honestly');
	assert.equal(classification.gapClassCount, 50, 'gapClassCount counts CLASSES, not sessions');
	assert.equal(countGapClasses(classification.gaps), 50);
});

test('C3.2 an attributable workload/qualification item is a GAP; the same item on a COVERED pair is an ADVISORY', () => {
	const uncovered = classifyGenerationBlockers([
		blocker({ code: 'TL_DEMAND_UNCOVERED', sectionId: 700, subjectId: 10 }),
		// The SAME codes, on the pair the diagnostic just proved has no owner.
		blocker({ code: 'WORKLOAD_POLICY_BLOCK', category: 'POLICY_BLOCKER', sectionId: 700, subjectId: 10 }),
		blocker({ code: 'FACULTY_SUBJECT_NOT_QUALIFIED', category: 'ALGORITHM_LIMIT', sectionId: 700, subjectId: 10 }),
		blocker({ code: 'FACULTY_OVERLOAD', category: 'ALGORITHM_LIMIT', sectionId: 700, subjectId: 10 }),
	]);
	assert.equal(uncovered.gaps.length, 4, 'attribution is by pair, so all four are gaps');
	assert.equal(uncovered.advisories.length, 0);
	assert.equal(uncovered.blocking.length, 0);

	// A8 C3 (planner ruling): the same three codes on a COVERED pair — or with no
	// pair at all — are ADVISORY, not blocking. They stay recorded, counted and
	// visible; they simply do not stop a reviewable schedule.
	const covered = classifyGenerationBlockers([
		blocker({ code: 'TL_DEMAND_UNCOVERED', sectionId: 700, subjectId: 10 }),
		blocker({ code: 'WORKLOAD_POLICY_BLOCK', category: 'POLICY_BLOCKER', sectionId: 901, subjectId: 99 }),
		blocker({ code: 'FACULTY_SUBJECT_NOT_QUALIFIED', category: 'ALGORITHM_LIMIT', sectionId: 901, subjectId: 99 }),
		// A real teacher breach carries no pair at all, so it is never attributable.
		blocker({ code: 'FACULTY_OVERLOAD', category: 'ALGORITHM_LIMIT', sectionId: null, subjectId: null, entity: 'Run validation · FACULTY_OVERLOAD' }),
	]);
	assert.equal(covered.gaps.length, 1, 'only the coverage row itself is a gap');
	assert.equal(covered.advisoryCount, 3, 'the three unattributable workload/qualification rows are advisories');
	assert.deepEqual(covered.advisories.map((b) => b.code).sort(), ['FACULTY_OVERLOAD', 'FACULTY_SUBJECT_NOT_QUALIFIED', 'WORKLOAD_POLICY_BLOCK']);
	assert.equal(covered.blocking.length, 0);

	// Nothing is lost: gaps + advisories + blocking === the rows handed in.
	assert.equal(covered.gaps.length + covered.advisories.length + covered.blocking.length, 4);
	// And the advisories are still GROUPED, with their counts, so the operator
	// still sees "4 teachers are over their weekly limit -> Review their load".
	const grouped = buildGenerationBlockerGroups({ blockers: covered.advisories, labelFor: () => null });
	assert.deepEqual(grouped.map((group) => group.cause), ['FACULTY_OVERLOAD', 'FACULTY_SUBJECT_NOT_QUALIFIED', 'WORKLOAD_POLICY_BLOCK']);
	assert.equal(grouped[0].action.target, '/teaching-load');
});

test('C3.3 a code outside the allowlist is NEVER a gap, even on an uncovered pair', () => {
	// A room or shape failure on an unowned class is still hard infeasibility.
	const classification = classifyGenerationBlockers([
		blocker({ code: 'TL_DEMAND_UNCOVERED', sectionId: 700, subjectId: 10 }),
		blocker({ code: 'ROOM_RESOURCE_UNAVAILABLE', category: 'RESOURCE_INFEASIBLE', sectionId: 700, subjectId: 10 }),
		blocker({ code: 'CANONICAL_TEMPLATE_INCOMPLETE', category: 'DATA_GAP', sectionId: 700, subjectId: 10 }),
		blocker({ code: 'TL_OWNERSHIP_CONFLICT', category: 'DATA_GAP', sectionId: 700, subjectId: 10 }),
	]);
	assert.deepEqual(classification.blocking.map((b) => b.code).sort(), ['CANONICAL_TEMPLATE_INCOMPLETE', 'ROOM_RESOURCE_UNAVAILABLE', 'TL_OWNERSHIP_CONFLICT']);
});

test('C3.4 the generation decision: neither a gap nor an advisory lets a run through a real hard violation, a missing dry run, or a writing diagnostic', () => {
	const ready = deriveGenerateDecision({ blockingBlockerCount: 0, schedulerRan: true, hardCount: 4, hardGapCount: 4, advisoryHardCount: 0, zeroWrite: true });
	assert.equal(ready.generateAllowed, true, 'every hard violation is a provable gap and the dry run ran zero-write');
	assert.equal(ready.status, 'READY');

	// The A8 C3 advisory path: hard violations that are all advisory-class.
	const advisory = deriveGenerateDecision({ blockingBlockerCount: 0, schedulerRan: true, hardCount: 5, hardGapCount: 0, advisoryHardCount: 5, zeroWrite: true });
	assert.equal(advisory.generateAllowed, true, 'advisories do not stop a reviewable run');
	assert.equal(advisory.status, 'READY');
	assert.equal(advisory.blockingHardCount, 0, 'but they are not counted as blocking, so the report is honest');

	assert.equal(deriveGenerateDecision({ blockingBlockerCount: 0, schedulerRan: true, hardCount: 6, hardGapCount: 0, advisoryHardCount: 5, zeroWrite: true }).generateAllowed, false,
		'ONE real hard violation alongside advisories still blocks');
	assert.equal(deriveGenerateDecision({ blockingBlockerCount: 0, schedulerRan: false, hardCount: 0, hardGapCount: 0, advisoryHardCount: 0, zeroWrite: true }).generateAllowed, false,
		'a gap never substitutes for the dry run');
	assert.equal(deriveGenerateDecision({ blockingBlockerCount: 0, schedulerRan: true, hardCount: 0, hardGapCount: 0, advisoryHardCount: 0, zeroWrite: false }).generateAllowed, false,
		'a gap never substitutes for the zero-write proof');
	assert.equal(deriveGenerateDecision({ blockingBlockerCount: 1, schedulerRan: true, hardCount: 0, hardGapCount: 0, advisoryHardCount: 0, zeroWrite: true }).generateAllowed, false,
		'one blocking blocker blocks');
});

/* ------------------------------------------------------------------ *
 * 4. THE SAFETY INVARIANT of the A8 C3 ruling
 * ------------------------------------------------------------------ */

test('C3.11 SAFETY: an advisory run is still REFUSED by the publication predicate', () => {
	// This is the load-bearing proof of the ruling. Generation may start with
	// advisories; PUBLICATION may not. The predicate is the production one —
	// `countBlockingHardViolations`, the exact function `publishSchedule` calls,
	// over the codes the production `RunSummary` would have persisted.
	for (const code of ['FACULTY_OVERLOAD', 'FACULTY_SUBJECT_NOT_QUALIFIED', 'UNASSIGNED_SECTION']) {
		assert.ok(ADVISORY_VIOLATION_CODES.has(code), `${code} must be an advisory-class persisted code`);
		assert.equal(countBlockingHardViolations([{ code, severity: 'HARD' }]) > 0, true,
			`a run carrying ${code} must be refused publication`);
	}
	// And the run's own summary gate agrees, because it is the same expression
	// `generation.service.ts` persists into `blockingHardViolationCount`.
	const persisted = [
		{ code: 'FACULTY_OVERLOAD', severity: 'HARD' },
		{ code: 'FACULTY_SUBJECT_NOT_QUALIFIED', severity: 'HARD' },
	];
	assert.equal(
		persisted.filter((violation) => violation.severity === 'HARD' && isPromotableConstraintCode(violation.code)).length,
		2,
		'the run summary\'s blockingHardViolationCount counts them, so the client publish gate refuses too',
	);
	// A SOFT advisory of the same code never blocked and still does not.
	assert.equal(countBlockingHardViolations([{ code: 'FACULTY_OVERLOAD', severity: 'SOFT' }]), 0);
});

test('C3.12 the run breakdown counts the advisories it carried, and the message names them', () => {
	const breakdown = summarizeTeacherGaps({
		unassignedItems: [
			{ sectionId: 700, subjectId: 10, reason: 'NO_QUALIFIED_FACULTY' },
			{ sectionId: 700, subjectId: 10, reason: 'NO_QUALIFIED_FACULTY' },
			{ sectionId: 800, subjectId: 20, reason: 'NO_AVAILABLE_SLOT' },
		],
		violations: [
			{ code: 'FACULTY_OVERLOAD', severity: 'HARD' },
			{ code: 'FACULTY_SUBJECT_NOT_QUALIFIED', severity: 'HARD' },
			{ code: 'FACULTY_BREAK_REQUIREMENT_VIOLATED', severity: 'SOFT' },
		],
	});
	assert.equal(breakdown.teacherGapClasses, 1, 'two session rows of one class are one class');
	assert.equal(breakdown.timeSlotClasses, 1);
	assert.equal(breakdown.policyAdvisoryCount, 2, 'only the HARD advisory-class violations count');

	assert.equal(
		buildGenerationCompletedMessage({ unplacedCount: 2, teacherGapClasses: 1, timeSlotClasses: 1, policyAdvisories: 2 }),
		'New schedule ready. 1 class still needs a teacher and 1 class still needs a time slot and 2 policy advisories to review before it can be published.',
	);
	// A8 C3 ITEM 5: the packet asks the run result to NAME the gaps, not just
	// count them. The names come from the run's own persisted rows.
	assert.equal(
		buildGenerationCompletedMessage({
			unplacedCount: 50,
			teacherGapClasses: 50,
			timeSlotClasses: 0,
			policyAdvisories: 0,
			teacherGapExamples: ['MAPEH 7-A', 'ENG 7-B', 'SCI 7-C'],
		}),
		'New schedule ready. 50 classes still need a teacher: MAPEH 7-A, ENG 7-B, SCI 7-C.',
		'the gaps are named in plain words, as the packet requires',
	);
	// Capped rather than truncated, and never an ellipsis (§8).
	const many = buildGenerationCompletedMessage({
		unplacedCount: 50,
		teacherGapClasses: 50,
		teacherGapExamples: ['A 7-A', 'B 7-B', 'C 7-C', 'D 7-D', 'E 7-E', 'F 7-F', 'G 7-G'],
	});
	assert.doesNotMatch(many, /…|\.\.\./, 'a name is never sliced with an ellipsis');
	assert.doesNotMatch(many, /F 7-F|G 7-G/, 'the example list is capped at five');
	// A nameless run still reads honestly rather than printing an empty colon.
	assert.equal(
		buildGenerationCompletedMessage({ unplacedCount: 3, teacherGapClasses: 3, teacherGapExamples: [] }),
		'New schedule ready. 3 classes still need a teacher.',
	);
	assert.equal(
		buildGenerationCompletedMessage({ unplacedCount: 3, teacherGapClasses: 3, teacherGapExamples: ['  ', ''] }),
		'New schedule ready. 3 classes still need a teacher.',
	);
	// A run with nothing unplaced but advisories still says so, and never claims
	// "All classes placed" while advisories remain.
	assert.equal(
		buildGenerationCompletedMessage({ unplacedCount: 0, teacherGapClasses: 0, timeSlotClasses: 0, policyAdvisories: 1 }),
		'New schedule ready. 1 policy advisory to review before it can be published.',
	);
});

/* ------------------------------------------------------------------ *
 * 2. Grouping by root cause, counted in classes
 * ------------------------------------------------------------------ */

test('C3.5 the live 620-row coverage set collapses to ONE line reading 50 classes', () => {
	const groups = buildGenerationBlockerGroups({
		blockers: liveCoverageGapFixture(),
		labelFor: (sectionId) => `Section ${sectionId}`,
	});
	assert.equal(groups.length, 1, '570 + 50 rows fold into one root cause, not 620 lines');
	assert.equal(groups[0].cause, 'TEACHER_COVERAGE_GAP');
	assert.equal(groups[0].unit, 'classes');
	assert.equal(groups[0].count, 50, 'the count is CLASSES');
	assert.equal(groups[0].sessionCount, 620, 'the row count stays available and is never the headline');
	assert.deepEqual(groups[0].codes.sort(), ['TL_DEMAND_UNCOVERED', 'TL_NO_QUALIFIED_OWNER']);
	assert.ok(groups[0].examples.length > 0 && groups[0].examples.length <= 5, 'examples are capped at ~5');
	assert.equal(groups[0].action.target, '/teaching-load');
});

test('C3.6 groups are deterministic, sorted by count desc then code, and repeatable', () => {
	const rows = [
		...liveCoverageGapFixture(),
		blocker({ code: 'FACULTY_OVERLOAD', category: 'ALGORITHM_LIMIT', sectionId: null, subjectId: null, entity: 'Run validation · FACULTY_OVERLOAD' }),
		blocker({ code: 'WORKLOAD_POLICY_BLOCK', category: 'POLICY_BLOCKER', sectionId: 901, subjectId: 99, entity: 'Section 901 · Subject 99' }),
		blocker({ code: 'FACULTY_SUBJECT_NOT_QUALIFIED', category: 'ALGORITHM_LIMIT', sectionId: 902, subjectId: 98, entity: 'Section 902 · Subject 98' }),
	];
	const once = buildGenerationBlockerGroups({ blockers: rows, labelFor: (id) => `Section ${id}` });
	const twice = buildGenerationBlockerGroups({ blockers: [...rows].reverse(), labelFor: (id) => `Section ${id}` });
	assert.deepEqual(once, twice, 'the order of the input rows cannot change the diagnostic');
	assert.deepEqual(once.map((group) => group.cause), [
		'TEACHER_COVERAGE_GAP',
		// The three 1-class lines tie, so the cause name breaks the tie
		// ascending: the order cannot depend on the order the rows arrived in.
		'FACULTY_OVERLOAD',
		'FACULTY_SUBJECT_NOT_QUALIFIED',
		'WORKLOAD_POLICY_BLOCK',
	]);
	assert.equal(once[0].count, 50);
	assert.equal(once[1].count, 1);
	assert.equal(once[1].unit, 'items', 'a year-wide row with no class is an item, never faked up as a class');
});

test('C3.7 every row of every group maps back to exactly one group — nothing is silently dropped', () => {
	const rows = liveCoverageGapFixture();
	const groups = buildGenerationBlockerGroups({ blockers: rows, labelFor: (id) => `Section ${id}` });
	const folded = groups.reduce((total, group) => total + group.sessionCount, 0);
	assert.equal(folded, rows.length, 'group session counts must account for every blocker row');
});

test('C3.8 an example never leaks a raw engine id when a label is available', () => {
	const groups = buildGenerationBlockerGroups({
		blockers: [
			blocker({ code: 'TL_DEMAND_UNCOVERED', sectionId: 700, subjectId: 10, subjectCode: 'MAPEH' }),
			blocker({ code: 'TL_DEMAND_UNCOVERED', sectionId: 701, subjectId: 11, subjectCode: 'ENG' }),
		],
		labelFor: (sectionId, _subjectId, subjectCode) => `${subjectCode ?? 'Class'} 7-${sectionId === 700 ? 'A' : 'B'}`,
	});
	assert.deepEqual(groups[0].examples, ['ENG 7-B', 'MAPEH 7-A'], 'equal-frequency examples are alphabetical, so the list is reproducible');
});

/* ------------------------------------------------------------------ *
 * 3. The run result names the gaps, from the PERSISTED unassigned rows
 * ------------------------------------------------------------------ */

test('C3.9 the run breakdown counts CLASSES, and a teacher gap is distinguished from a time-slot problem', () => {
	// The live 2023-2024 shape: 570 unassigned SESSION rows over 50 classes, all
	// of them "no qualified owner", plus 15 classes that merely had no slot.
	const unassignedItems = [
		...Array.from({ length: 570 }, (_, index) => ({
			sectionId: 700 + (index % 50),
			subjectId: 10 + (index % 50),
			reason: 'NO_QUALIFIED_FACULTY',
		})),
		{ sectionId: 800, subjectId: 20, reason: 'NO_AVAILABLE_SLOT' },
	];
	const breakdown = summarizeTeacherGaps({
		unassignedItems,
		labelFor: (sectionId, subjectId) => `SUBJ${subjectId} 7-${sectionId}`,
	});
	assert.equal(breakdown.teacherGapClasses, 50, 'the teacher gap is 50 classes, not 570 sessions');
	assert.equal(breakdown.timeSlotClasses, 1);
	assert.ok(breakdown.teacherGapExamples.length > 0 && breakdown.teacherGapExamples.length <= 5);

	const sentence = buildGenerationCompletedMessage({
		unplacedCount: 571,
		teacherGapClasses: breakdown.teacherGapClasses,
		timeSlotClasses: breakdown.timeSlotClasses,
	});
	assert.equal(sentence, 'New schedule ready. 50 classes still need a teacher and 1 class still needs a time slot.');
	assert.doesNotMatch(sentence, /\b570\b/, 'the session-row count never reaches the operator sentence');
	assert.doesNotMatch(sentence, /session/i, 'no session-row vocabulary');
});

test('C3.10 the completed sentence keeps its exact pre-existing wording in every other case', () => {
	// The single-number form is unchanged, so the accepted copy contract holds.
	assert.equal(buildGenerationCompletedMessage(0), 'New schedule ready. All classes placed.');
	assert.equal(buildGenerationCompletedMessage(1), 'New schedule ready. 1 class still needs a time slot.');
	assert.equal(buildGenerationCompletedMessage(4), 'New schedule ready. 4 classes still need a time slot.');
	assert.equal(buildGenerationCompletedMessage(Number.NaN), 'New schedule ready.');
	assert.equal(buildGenerationCompletedMessage(-1), 'New schedule ready.');
	// Measured but unclassified: identical to the legacy wording, never a new one.
	assert.equal(
		buildGenerationCompletedMessage({ unplacedCount: 4, teacherGapClasses: 0, timeSlotClasses: 0 }),
		'New schedule ready. 4 classes still need a time slot.',
	);
	// A gap alone is enough to name the teacher problem.
	assert.equal(
		buildGenerationCompletedMessage({ unplacedCount: 50, teacherGapClasses: 50, timeSlotClasses: 0 }),
		'New schedule ready. 50 classes still need a teacher.',
	);
});
