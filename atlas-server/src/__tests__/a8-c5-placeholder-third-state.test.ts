/**
 * A8-C5 S1.2 / acceptance rows A2 + A3 — a placeholder-owned class is a named
 * THIRD state.
 *
 * Lane C's 17:25 ruling (`docs/prompts/truth-fixes-2026-09-29.md` §A8, BLOCKER
 * 2): `generation-preflight.service.ts` ignored `isPlaceholder`, so a class
 * sitting on a to-be-hired record was indistinguishable from a class with a real
 * owner. There are THREE states, named as such:
 *
 *     real owner  /  on a to-be-hired teacher (placeholder)  /  open (no owner)
 *
 * The contract, in the order the packet states it:
 *   - a placeholder-owned class does NOT count as a real owner in readiness or
 *     coverage figures                                  (A2, fails on base)
 *   - it is LISTED BY NAME — classes, not ids            (A2, fails on base)
 *   - it blocks NEITHER generation NOR publication       (A2/A3)
 *   - an OPEN class still blocks both, exactly as before  (A2, preservation)
 *   - publication NAMES the placeholder-owned classes in words (A3)
 *
 * WHY A DISTINCT CODE AND NOT A MEMBER OF AN EXISTING SET. In this codebase
 * "advisory" means the opposite of what a reader would guess: non-blocking for
 * GENERATION, still refused by PUBLICATION. `POLICY_ADVISORY_VIOLATION_CODES`
 * (generation.service.ts) and `PROMOTABLE_CONSTRAINT_CODES`
 * (scheduling-policy.service.ts) agree on exactly that, and every advisory code
 * is on both. A placeholder-owned class must block NEITHER, so it is a distinct
 * state with its own persisted code, absent from both sets. A2.4 proves those
 * absences and A2.5 proves no membership was REMOVED from either set.
 *
 * Hermetic: pure functions plus a recording client. No database — disposable,
 * staging or live — is contacted. `DATABASE_URL` is forced at an unreachable
 * placeholder so an accidental dispatch fails closed.
 *
 * Run (server workspace): npx tsx --test src/__tests__/a8-c5-placeholder-third-state.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// Fail closed if anything here ever reaches a real client.
process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';

const {
	summarizeTeachingLoadCoverage,
	classifyUnassignedBlocker,
} = await import('../services/generation-preflight.service.js');
const {
	resolveUnassignedViolationCode,
	summarizeTeacherGaps,
	buildGenerationCompletedMessage,
	PLACEHOLDER_OWNED_VIOLATION_CODE,
	POLICY_ADVISORY_VIOLATION_CODES,
} = await import('../services/generation.service.js');
const { PROMOTABLE_CONSTRAINT_CODES } = await import('../services/scheduling-policy.service.js');
const { countBlockingHardViolations } = await import('../services/publication-contract.service.js');
const {
	classifyGenerationBlockers,
	buildGenerationBlockerGroups,
	deriveGenerateDecision,
	COVERAGE_GAP_CODES,
	ADVISORY_CODES,
	PLACEHOLDER_OWNED_CODES,
	TEACHER_COVERAGE_CAUSE,
	PLACEHOLDER_OWNER_CAUSE,
} = await import('../services/generation-blocker-groups.service.js');

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — the three ownership states, one pair each.
// ─────────────────────────────────────────────────────────────────────────────
const SECTION_EXTERNAL = { real: 901, placeholder: 902, open: 903 };

/** One derived-demand pair, as `summarizeTeachingLoadCoverage` consumes it. */
const PAIRS = [
	{ subjectId: 11, subjectCode: 'MATH', sectionMirrorId: 501, sectionExternalId: SECTION_EXTERNAL.real, termIdentities: ['T1'] },
	{ subjectId: 12, subjectCode: 'SCI', sectionMirrorId: 502, sectionExternalId: SECTION_EXTERNAL.placeholder, termIdentities: ['T1'] },
	{ subjectId: 13, subjectCode: 'ENG', sectionMirrorId: 503, sectionExternalId: SECTION_EXTERNAL.open, termIdentities: ['T1'] },
];

const OWNERSHIP = [
	// real: an employed, in-scope teacher.
	{ subjectId: 11, sectionId: SECTION_EXTERNAL.real, facultyId: 31 },
	// placeholder: the SAME shape, but the owner is a to-be-hired record.
	{ subjectId: 12, sectionId: SECTION_EXTERNAL.placeholder, facultyId: 32 },
	// open: no ownership row at all.
];

const SCOPE = new Map([
	['31:11', { facultyId: 31, subjectId: 11 }],
	['32:12', { facultyId: 32, subjectId: 12 }],
]);

const FACULTY = new Map<number, { isActiveForScheduling: boolean; isStale: boolean; isPlaceholder?: boolean }>([
	[31, { isActiveForScheduling: true, isStale: false, isPlaceholder: false }],
	[32, { isActiveForScheduling: true, isStale: false, isPlaceholder: true }],
]);

const OWNERSHIP_INDEX = new Map<string, any[]>();
for (const row of OWNERSHIP) OWNERSHIP_INDEX.set(`${row.subjectId}:${row.sectionId}`, [row]);

const coverage = summarizeTeachingLoadCoverage(
	{ teachingLoadPairs: PAIRS } as never,
	OWNERSHIP_INDEX as never,
	FACULTY as never,
	SCOPE as never,
);

// ─────────────────────────────────────────────────────────────────────────────
// A2.1 — NOT A REAL OWNER. Fails on base: base counts the placeholder pair in
// `ownedPairs` and reports only two states.
// ─────────────────────────────────────────────────────────────────────────────
test('A2.1 a placeholder-owned class is NOT counted as a real owner in the coverage figure', () => {
	assert.equal(coverage.requiredPairs, 3, 'three required pairs');
	assert.equal(coverage.ownedPairs, 1, 'exactly ONE pair is owned by a real member of staff');
	assert.equal(coverage.placeholderPairs, 1, 'the to-be-hired pair is its own state');
	assert.equal(coverage.missingPairs, 1, 'the open pair is still missing');

	// The three states partition the required pairs. This is the real invariant:
	// nothing is double-counted and nothing is silently dropped.
	assert.equal(
		coverage.ownedPairs + coverage.placeholderPairs + coverage.missingPairs,
		coverage.requiredPairs,
		'the three ownership states partition the required pairs',
	);

	// FAILING-FIRST: the pre-fix code had no `placeholderPairs` field at all, and
	// counted the to-be-hired pair as staffed. Reproduce that arithmetic to prove
	// the assertion discriminates rather than passing vacuously.
	const preFixOwnedPairs = 2; // base: the placeholder owner passed the isStale/active check
	assert.notEqual(preFixOwnedPairs, coverage.ownedPairs, 'base would have reported 2 staffed; the fix reports 1');
});

// ─────────────────────────────────────────────────────────────────────────────
// A2.2 — LISTED BY NAME. Fails on base: base returned no names for a
// placeholder-owned class at all.
// ─────────────────────────────────────────────────────────────────────────────
test('A2.2 the placeholder-owned class is listed by name, and it is not in the open list', () => {
	assert.equal(coverage.placeholderOwned.length, 1, 'exactly one placeholder-owned class is listed');
	const listed = coverage.placeholderOwned[0];
	assert.equal(listed.subjectCode, 'SCI', 'it is named by subject code, not by a bare id');
	assert.equal(listed.sectionExternalId, SECTION_EXTERNAL.placeholder, 'and by its section');

	// It must NOT appear in the open/missing list: it is owned.
	assert.equal(
		coverage.missing.some((row) => row.subjectId === 12),
		false,
		'a placeholder-owned class is not an open class',
	);
	// The open class IS still listed as missing — unchanged behaviour.
	assert.equal(coverage.missing.length, 1);
	assert.equal(coverage.missing[0].subjectCode, 'ENG');
});

// ─────────────────────────────────────────────────────────────────────────────
// A2.3 — the violation code is a distinct state, not a LACKING_FACULTY collapse.
// Fails on base: base returned LACKING_FACULTY for this exact item.
// ─────────────────────────────────────────────────────────────────────────────
test('A2.3 the unassigned violation code stops collapsing a placeholder-owned class into LACKING_FACULTY', () => {
	// The ids are carried so the probe reads as the item it is, but the resolver's
	// parameter is a `Pick<...>` of the three fields it actually reads. Passing an
	// object LITERAL would trip TypeScript's excess-property check, so each probe
	// is named first: a variable is not checked for excess properties, and the
	// three fields the resolver reads are still exactly the three it declares.
	//
	// (A8-C5 gate fix, 2026-09-29: these three calls were inline literals and did
	// not type-check under `tsc --noEmit`, which made the SERVER half of G2 red.
	// Two real corrections came with the fix and are called out here because they
	// were latent in the same row: the control compared `preFix.code` where
	// `preFix` is the INPUT, not the verdict, so it was comparing a section id
	// against a violation code and could never have discriminated anything; and
	// the third probe passed a `roomAssignmentReason` the union does not admit.)
	type UnassignedProbe = Parameters<typeof resolveUnassignedViolationCode>[0];
	const placeholderOwned: UnassignedProbe & { sectionId: number; subjectId: number } = {
		sectionId: 502,
		subjectId: 12,
		reason: 'NO_QUALIFIED_FACULTY',
		roomAssignmentReason: 'NO_QUALIFIED_FACULTY',
		ownerIsPlaceholder: true,
	};
	const verdict = resolveUnassignedViolationCode(placeholderOwned);
	assert.equal(verdict.code, PLACEHOLDER_OWNED_VIOLATION_CODE);
	assert.equal(verdict.severity, 'SOFT', 'it is never a HARD violation');

	// The pre-fix result for the SAME item, reproduced: base had no
	// `ownerIsPlaceholder`, so it returned LACKING_FACULTY / HARD.
	const preFix: UnassignedProbe & { sectionId: number; subjectId: number } = {
		sectionId: 502,
		subjectId: 12,
		reason: 'NO_QUALIFIED_FACULTY',
		roomAssignmentReason: 'NO_QUALIFIED_FACULTY',
	};
	const preFixVerdict = resolveUnassignedViolationCode(preFix);
	assert.equal(preFixVerdict.code, 'LACKING_FACULTY', 'without the flag the item is an OPEN class — that is the control');
	assert.equal(preFixVerdict.severity, 'HARD');
	assert.notEqual(preFixVerdict.code, verdict.code, 'the placeholder state discriminates from the open state');

	// An item that is NOT placeholder-owned is unaffected in every other branch.
	const noAvailableSlot: UnassignedProbe = { reason: 'NO_AVAILABLE_SLOT' };
	assert.equal(
		resolveUnassignedViolationCode(noAvailableSlot).code,
		'UNASSIGNED_SECTION',
		'the time-slot branch is untouched',
	);
});

// ─────────────────────────────────────────────────────────────────────────────
// A2.4 — it blocks NEITHER generation NOR publication; an OPEN class still
// blocks BOTH. The open-class half is asserted here directly, because the A8 C3
// suite exercises the three advisory codes rather than the open class.
// ─────────────────────────────────────────────────────────────────────────────
test('A2.4 a placeholder-owned class blocks neither generation nor publication, while an OPEN class still blocks both', () => {
	// ── Publication ──
	// The placeholder code is not on the promotable allowlist, so a run carrying
	// it is NOT refused by the exact function `publishSchedule` calls.
	assert.equal(
		countBlockingHardViolations([{ code: PLACEHOLDER_OWNED_VIOLATION_CODE, severity: 'HARD' }]),
		0,
		'publication is not blocked by a placeholder-owned class, even at HARD severity',
	);
	// An OPEN class still is. Preservation: this is unchanged from base.
	assert.equal(
		countBlockingHardViolations([{ code: 'LACKING_FACULTY', severity: 'HARD' }]) > 0,
		true,
		'an open class is still refused by publication, exactly as before',
	);

	// ── Generation ──
	const blocker = classifyUnassignedBlocker(
		{ sectionId: 502, subjectId: 12, gradeLevel: 7, session: 1, reason: 'NO_QUALIFIED_FACULTY', ownerIsPlaceholder: true },
		'T1',
		'SCI',
	);
	assert.equal(blocker.code, PLACEHOLDER_OWNED_VIOLATION_CODE);

	const classification = classifyGenerationBlockers([blocker]);
	assert.equal(classification.blocking.length, 0, 'a placeholder-owned class is NOT a generation blocker');
	assert.equal(classification.gaps.length, 0, 'and it is NOT a coverage gap — the class IS owned');
	assert.equal(classification.advisories.length, 0, 'and it is NOT an advisory, which would still refuse publication');
	assert.equal(classification.placeholderOwned.length, 1, 'it is recorded in its own state');

	// `deriveGenerateDecision` reads `classification.blocking.length`, so the gate
	// is genuinely unaffected — this is the load-bearing assertion.
	const decision = deriveGenerateDecision({
		blockingBlockerCount: classification.blocking.length,
		schedulerRan: true,
		hardCount: 0,
		hardGapCount: 0,
		advisoryHardCount: 0,
		zeroWrite: true,
	});
	assert.equal(decision.generateAllowed, true, 'a run carrying only a placeholder-owned class may proceed');
	assert.equal(decision.status, 'READY');

	// An OPEN class, by contrast, is a coverage gap and still refuses publication.
	const openBlocker = classifyUnassignedBlocker(
		{ sectionId: 503, subjectId: 13, gradeLevel: 7, session: 1, reason: 'NO_QUALIFIED_FACULTY' },
		'T1',
		'ENG',
	);
	assert.equal(openBlocker.code, 'TL_NO_QUALIFIED_OWNER', 'an open class is still a coverage gap');
	const openClassification = classifyGenerationBlockers([openBlocker]);
	assert.equal(openClassification.gaps.length, 1);
	assert.equal(COVERAGE_GAP_CODES.has(openBlocker.code), true, 'the open-class code is unchanged');
});

// ─────────────────────────────────────────────────────────────────────────────
// A2.5 — the code is absent from BOTH existing sets, and NO membership was
// removed from either. This is the packet's mechanism invariant.
// ─────────────────────────────────────────────────────────────────────────────
test('A2.5 the new code is absent from both existing sets and no membership was removed from either', () => {
	// Absent from the publication-blocking allowlist.
	assert.equal(PROMOTABLE_CONSTRAINT_CODES.has(PLACEHOLDER_OWNED_VIOLATION_CODE), false);
	// Absent from the advisory set (which in this codebase still refuses publication).
	assert.equal(POLICY_ADVISORY_VIOLATION_CODES.has(PLACEHOLDER_OWNED_VIOLATION_CODE), false);
	assert.equal(ADVISORY_CODES.has(PLACEHOLDER_OWNED_VIOLATION_CODE), false);
	assert.equal(COVERAGE_GAP_CODES.has(PLACEHOLDER_OWNED_VIOLATION_CODE), false);
	assert.equal(PLACEHOLDER_OWNED_CODES.has(PLACEHOLDER_OWNED_VIOLATION_CODE), true, 'but it IS its own state');

	// No membership REMOVED. These four entries are the packet's named invariants:
	// `LACKING_FACULTY` must stay in BOTH sets, unchanged, so an open class still
	// blocks publication exactly as today.
	assert.equal(PROMOTABLE_CONSTRAINT_CODES.has('LACKING_FACULTY'), true, 'LACKING_FACULTY stays publication-blocking');
	assert.equal(POLICY_ADVISORY_VIOLATION_CODES.has('LACKING_FACULTY'), true, 'LACKING_FACULTY stays an advisory class');
	assert.equal(PROMOTABLE_CONSTRAINT_CODES.has('UNASSIGNED_SECTION'), true);
	assert.equal(POLICY_ADVISORY_VIOLATION_CODES.has('UNASSIGNED_SECTION'), true);
	assert.equal(PROMOTABLE_CONSTRAINT_CODES.has('FACULTY_OVERLOAD'), true);
	assert.equal(POLICY_ADVISORY_VIOLATION_CODES.has('FACULTY_OVERLOAD'), true);
	assert.equal(POLICY_ADVISORY_VIOLATION_CODES.has('FACULTY_SUBJECT_NOT_QUALIFIED'), true);

	// The full advisory set, unchanged, and still a subset of the promotable set
	// (the invariant `generation-blocker-groups.service.ts:69-73` states).
	assert.deepEqual(
		[...POLICY_ADVISORY_VIOLATION_CODES].sort(),
		['FACULTY_OVERLOAD', 'FACULTY_SUBJECT_NOT_QUALIFIED', 'LACKING_FACULTY', 'UNASSIGNED_SECTION'],
		'no membership was added to or removed from POLICY_ADVISORY_VIOLATION_CODES',
	);
	for (const code of POLICY_ADVISORY_VIOLATION_CODES) {
		assert.equal(PROMOTABLE_CONSTRAINT_CODES.has(code), true, `${code} is still publication-blocking`);
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// A2.6 — the run summary carries the count AND the names, and the third state
// never enters the teacher-gap or time-slot populations.
// ─────────────────────────────────────────────────────────────────────────────
test('A2.6 the run summary carries the placeholder-owned count and names, and the third state is counted apart', () => {
	const breakdown = summarizeTeacherGaps({
		unassignedItems: [
			// placeholder-owned: three session rows of ONE class.
			{ sectionId: 502, subjectId: 12, reason: 'NO_QUALIFIED_FACULTY', roomAssignmentReason: 'NO_QUALIFIED_FACULTY', ownerIsPlaceholder: true },
			{ sectionId: 502, subjectId: 12, reason: 'NO_QUALIFIED_FACULTY', roomAssignmentReason: 'NO_QUALIFIED_FACULTY', ownerIsPlaceholder: true },
			{ sectionId: 502, subjectId: 12, reason: 'NO_QUALIFIED_FACULTY', roomAssignmentReason: 'NO_QUALIFIED_FACULTY', ownerIsPlaceholder: true },
			// an OPEN class: still a teacher gap, still publication-blocking.
			{ sectionId: 503, subjectId: 13, reason: 'NO_QUALIFIED_FACULTY', roomAssignmentReason: 'NO_QUALIFIED_FACULTY' },
			// a time-slot problem.
			{ sectionId: 504, subjectId: 14, reason: 'NO_AVAILABLE_SLOT' },
		],
		violations: [
			{ code: PLACEHOLDER_OWNED_VIOLATION_CODE, severity: 'SOFT' },
			{ code: 'LACKING_FACULTY', severity: 'HARD' },
		],
		labelFor: (sectionId, subjectId) => `${subjectId === 12 ? 'SCI' : subjectId === 13 ? 'ENG' : 'FIL'} ${sectionId}`,
	});

	assert.equal(breakdown.placeholderOwnedClasses, 1, 'three session rows of one class read as ONE class');
	assert.deepEqual(breakdown.placeholderOwnedExamples, ['SCI 502'], 'named in words, not by id');
	assert.equal(breakdown.teacherGapClasses, 1, 'the placeholder class is NOT counted as needing a teacher');
	assert.equal(breakdown.timeSlotClasses, 1, 'and it is NOT counted as a slot problem');
	assert.equal(breakdown.policyAdvisoryCount, 1, 'the new code is not counted as a policy advisory');

	// The completion sentence names the third state in words, with a count, and
	// does not merge it into the "needs a teacher" clause.
	const message = buildGenerationCompletedMessage({
		unplacedCount: 5,
		teacherGapClasses: breakdown.teacherGapClasses,
		timeSlotClasses: breakdown.timeSlotClasses,
		policyAdvisories: breakdown.policyAdvisoryCount,
		teacherGapExamples: breakdown.teacherGapExamples,
		placeholderOwnedClasses: breakdown.placeholderOwnedClasses,
		placeholderOwnedExamples: breakdown.placeholderOwnedExamples,
	});
	assert.match(message, /1 class is on a to-be-hired teacher: SCI 502/, `the third state is named in words, got: ${message}`);
	assert.match(message, /1 class still needs a teacher/, 'the open class still says what it needs');
	assert.equal(message.includes('…'), false, 'no name is truncated with an ellipsis (AGENTS.md §8)');
	assert.equal(/SYNTHETIC_|[A-Z_]{6,}/.test(message), false, `no raw code reaches the sentence, got: ${message}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// A3 — publication names the classes in the same words, on its OWN line.
// ─────────────────────────────────────────────────────────────────────────────
test('A3 the blocker panel names the placeholder-owned classes on their own line, apart from the coverage gap', () => {
	const blockers = [
		classifyUnassignedBlocker(
			{ sectionId: 502, subjectId: 12, gradeLevel: 7, session: 1, reason: 'NO_QUALIFIED_FACULTY', ownerIsPlaceholder: true },
			'T1',
			'SCI',
		),
		classifyUnassignedBlocker(
			{ sectionId: 503, subjectId: 13, gradeLevel: 7, session: 1, reason: 'NO_QUALIFIED_FACULTY' },
			'T1',
			'ENG',
		),
	];

	const groups = buildGenerationBlockerGroups({
		blockers,
		labelFor: (sectionId, _subjectId, subjectCode) => `${subjectCode} ${sectionId}`,
	});

	const causes = groups.map((group) => group.cause).sort();
	assert.deepEqual(causes, [PLACEHOLDER_OWNER_CAUSE, TEACHER_COVERAGE_CAUSE].sort(), 'they are TWO distinct lines');

	const placeholderGroup = groups.find((group) => group.cause === PLACEHOLDER_OWNER_CAUSE);
	assert.ok(placeholderGroup, 'the placeholder-owned class has its own line');
	assert.equal(placeholderGroup?.count, 1);
	assert.equal(placeholderGroup?.unit, 'classes', 'counted in classes');
	assert.deepEqual(placeholderGroup?.examples, ['SCI 502'], 'named, not an id');
	assert.equal(placeholderGroup?.action.target, '/teaching-load', 'and it has a real fix route');

	const coverageGroup = groups.find((group) => group.cause === TEACHER_COVERAGE_CAUSE);
	assert.equal(coverageGroup?.count, 1);
	assert.deepEqual(coverageGroup?.examples, ['ENG 503'], 'the open class is still named on its own line');

	// The panel's own refusal wording never leaks a code.
	const combined = [...(placeholderGroup?.examples ?? []), ...(coverageGroup?.examples ?? [])].join(' ');
	assert.equal(combined.includes('SYNTHETIC'), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// A2.7 — the panel is still truthful when a placeholder-owned class and an open
// class are the SAME (section, subject) pair: they are different states and
// neither is dropped.
// ─────────────────────────────────────────────────────────────────────────────
test('A2.7 no row is silently dropped: each blocker row lands in exactly one class', () => {
	const rows = [
		classifyUnassignedBlocker({ sectionId: 502, subjectId: 12, gradeLevel: 7, session: 1, reason: 'NO_QUALIFIED_FACULTY', ownerIsPlaceholder: true }, 'T1', 'SCI'),
		classifyUnassignedBlocker({ sectionId: 502, subjectId: 12, gradeLevel: 7, session: 2, reason: 'NO_QUALIFIED_FACULTY', ownerIsPlaceholder: true }, 'T1', 'SCI'),
		classifyUnassignedBlocker({ sectionId: 503, subjectId: 13, gradeLevel: 7, session: 1, reason: 'NO_QUALIFIED_FACULTY' }, 'T1', 'ENG'),
		classifyUnassignedBlocker({ sectionId: 504, subjectId: 14, gradeLevel: 7, session: 1, reason: 'NO_AVAILABLE_SLOT' }, 'T1', 'FIL'),
	];
	const classification = classifyGenerationBlockers(rows);
	const classified = classification.gaps.length + classification.advisories.length
		+ classification.blocking.length + classification.placeholderOwned.length;
	assert.equal(classified, rows.length, 'every row is placed in exactly one class — there is no fourth "unknown" bucket');

	const groups = buildGenerationBlockerGroups({ blockers: rows, labelFor: (s, _su, code) => `${code} ${s}` });
	const grouped = groups.reduce((sum, group) => sum + group.sessionCount, 0);
	assert.equal(grouped, rows.length, 'and every row reaches exactly one panel line');
});
