/**
 * A2-WARNING-COUNT-62 — the operator-visible warning figure must be a pure
 * function of the current entry slots.
 *
 * REPORTED (live release `d31bfacb`, draft run 321): a manual swap followed by
 * a revert is NOT net-neutral on the warning count — 159 -> 68 -> 69 — and
 * nothing on screen says why. The swap response carries the whole warning list
 * and the SAME sentence repeats once per ordered term with a distinct
 * `blockEntryIds` set per term, which pointed at a per-term multiplicity or an
 * aggregated/deduplicated value recomputed on read.
 *
 * That theory is REFUTED, and this file is the proof.
 *
 * The count is produced, in order, by:
 *   1. `constraint-validator.ts:668 validateHardConstraints` — the violation
 *      producer, a pure function of `ctx.entries` (the slots).
 *   2. `constraint-validator.ts:420 groupEntriesByTerm` + `:445
 *      facultyDayTermKey` / `:453 parseFacultyDayTermKey` — the aggregation
 *      step. It buckets by `facultyId|day|term` and then DISCARDS the term when
 *      it builds the row, so one violating block yields one row per ordered
 *      term with a byte-identical sentence. That is real per-term multiplicity,
 *      but it is deterministic in the slots.
 *   3. `manual-edit.service.ts:804 computeSummary` +
 *      `:823 mergePreservedSummaryFields` — the summary writer the manual-edit
 *      path persists.
 *   4. `atlas-client/src/components/timetable/timetableWorkspaceTruth.ts:92
 *      deriveRunWideReadiness` — the ONLY count authority the client has, and
 *      the number the header/summary renders. It reads
 *      `summary.softViolationCount` first (`:98`) and, when that field is
 *      absent, SILENTLY substitutes the selected-term violation list (`:105`,
 *      filtered at `hooks/useTimetableData.ts:681-692`).
 *
 * ROOT CAUSE: `RunSummary.softViolationCount` was written by NO producer.
 * `generation.service.ts`'s persisted summary omitted it, and `computeSummary`
 * omitted it too (so `mergePreservedSummaryFields` dropped the inherited value
 * on every manual edit). With the field permanently absent, the header figure
 * was never the run's warning count — it was a SELECTED-TERM subset whose
 * membership moves with the term selector and with each violation's
 * `entities.entryIds` term mapping, and with nothing else in the schedule. A
 * net-neutral swap + revert could therefore move the number while the entry
 * slots were restored exactly, which is precisely the reported symptom.
 *
 * The fix is server-side and additive: both producers now persist the run-wide
 * SOFT count from the SAME recomputation that already produces
 * `hardViolationCount` and `violationCounts`, so the fallback can never engage
 * on a real run and the figure is a pure function of the slots.
 *
 * Hermetic: the real exported `buildValidatorCtx` / `validateHardConstraints` /
 * `computeSummary` / `mergePreservedSummaryFields`, on a local fixture. No
 * database, no network, no live mutation.
 *
 * Run: `npm run test:warning-count-scope-warn62` (wired in
 * `atlas-server/package.json`).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
	validateHardConstraints,
	type ScheduledEntry,
	type ValidatorContext,
	type Violation,
} from '../services/constraint-validator.js';
import { buildValidatorCtx, computeSummary, mergePreservedSummaryFields } from '../services/manual-edit.service.js';
import { buildWarningWindowAuthority, type WarningWindowPolicyRow } from '../services/warning-window-authority.service.js';

const SCHOOL = 11;
const YEAR = 9;
const RUN = 707;
const SECTION = 200;
const SUBJECT = 100;
const ROOM = 2001;
const ROOM_2 = 2002;
const SECTION_2 = 201;
const TERMS = [1, 2, 3] as const;

// Four contiguous 45-minute periods = 180 minutes, above the 135-minute
// default limit, so ONE violating block per ordered term.
const BLOCK: ReadonlyArray<{ startTime: string; endTime: string }> = [
	{ startTime: '06:00', endTime: '06:45' },
	{ startTime: '06:45', endTime: '07:30' },
	{ startTime: '07:30', endTime: '08:15' },
	{ startTime: '08:15', endTime: '09:00' },
];

const POLICY_RECORD = {
	maxConsecutiveTeachingMinutesBeforeBreak: 135,
	periodLengthMinutes: 45,
	minBreakMinutesAfterConsecutiveBlock: 10,
	maxTeachingMinutesPerDay: 480,
	earliestStartTime: '06:00',
	latestEndTime: '18:00',
	enforceConsecutiveBreakAsHard: false,
	enableTravelWellbeingChecks: true,
	maxBuildingTransitionsPerDay: 4,
	maxBackToBackTransitionsWithoutBuffer: 2,
	maxIdleGapMinutesPerDay: 60,
	avoidEarlyFirstPeriod: false,
	avoidLateLastPeriod: false,
	enableVacantAwareConstraints: false,
	targetFacultyDailyVacantMinutes: 0,
	targetSectionDailyVacantPeriods: 0,
	maxCompressedTeachingMinutesPerDay: 0,
	constraintConfig: {},
} as const;

function entry(overrides: Partial<ScheduledEntry> & Pick<ScheduledEntry, 'entryId'>): ScheduledEntry {
	return {
		facultyId: 1,
		roomId: ROOM,
		subjectId: SUBJECT,
		sectionId: SECTION,
		day: 'MONDAY',
		termIndex: 1,
		startTime: '06:00',
		endTime: '06:45',
		durationMinutes: 45,
		...overrides,
	} as ScheduledEntry;
}

/**
 * Teacher 1 teaches the same four-period block in EVERY ordered term (3
 * violating rows, one per term, identical sentences). Teacher 2 teaches it in
 * Term 1 only (1 row). Run-wide SOFT total is therefore 4, while a single-term
 * view sees 2 (Term 1) or 1 (Terms 2 and 3) — the exact population gap that
 * made the header figure move without the schedule moving.
 */
function baseEntries(): ScheduledEntry[] {
	const out: ScheduledEntry[] = [];
	for (const term of TERMS) {
		BLOCK.forEach((slot, index) => {
			out.push(entry({
				entryId: `t${term}-p${index + 1}`,
				termIndex: term,
				startTime: slot.startTime,
				endTime: slot.endTime,
			}));
		});
	}
	BLOCK.forEach((slot, index) => {
		out.push(entry({
			entryId: `solo-p${index + 1}`,
			facultyId: 2,
			roomId: ROOM_2,
			sectionId: SECTION_2,
			termIndex: 1,
			startTime: slot.startTime,
			endTime: slot.endTime,
		}));
	});
	return out;
}

function refDataFor(entries: ScheduledEntry[]) {
	const policyRow: WarningWindowPolicyRow & Record<string, unknown> = { ...POLICY_RECORD };
	const windowAuthority = buildWarningWindowAuthority({
		sections: [
			{ id: SECTION, gradeLevel: 7, programType: 'REGULAR' },
			{ id: SECTION_2, gradeLevel: 7, programType: 'REGULAR' },
		],
		policyRow,
		specialEvents: [],
		shiftWindows: [],
	});
	return {
		run: {
			id: RUN, schoolId: SCHOOL, schoolYearId: YEAR, status: 'COMPLETED',
			summary: { isPublished: false }, draftEntries: entries, unassignedItems: [], version: 1,
		},
		entries,
		unassignedItems: [],
		faculty: [
			{ id: 1, maxHoursPerWeek: 20, ancillaryMinutesPerWeek: 0 },
			{ id: 2, maxHoursPerWeek: 20, ancillaryMinutesPerWeek: 0 },
		],
		facultySubjects: TERMS.map(() => [1, 2].map((facultyId) => ({
			facultyId,
			subjectId: SUBJECT,
			gradeLevels: [7],
			sectionIds: [facultyId === 1 ? SECTION : SECTION_2],
		}))).flat(),
		rooms: [ROOM, ROOM_2].map((id) => ({
			id,
			type: 'CLASSROOM',
			isTeachingSpace: true,
			isSharedFacility: false,
			capacity: 40,
			features: [],
			floor: 1,
			buildingId: 1,
			building: { gradeScope: null },
		})),
		subjects: [{ id: SUBJECT, code: 'SUB', preferredRoomType: 'CLASSROOM', requiredFeatures: [], gradeLevels: [7] }],
		policyRecord: policyRow,
		buildings: [{ id: 1, x: 0, y: 0 }],
		facultyNameMap: new Map([[1, 'Teacher One'], [2, 'Teacher Two']]),
		roomNameMap: new Map([[ROOM, 'Room 2001'], [ROOM_2, 'Room 2002']]),
		subjectNameMap: new Map([[SUBJECT, 'SUB']]),
		subjectNameDetailMap: new Map([[SUBJECT, 'Subject']]),
		sectionEnrollment: new Map([[SECTION, 30], [SECTION_2, 30]]),
		sectionGradeLevel: new Map([[SECTION, 7], [SECTION_2, 7]]),
		windowAuthority,
		classProgramSlots: [],
	} as unknown as Parameters<typeof buildValidatorCtx>[4];
}

function validate(entries: ScheduledEntry[]): ReturnType<typeof validateHardConstraints> {
	const ctx: ValidatorContext = buildValidatorCtx(SCHOOL, YEAR, RUN, entries, refDataFor(entries));
	return validateHardConstraints(ctx);
}

function softCount(violations: readonly Violation[]): number {
	return violations.filter((v) => v.severity === 'SOFT').length;
}

/** A stable multiset signature: code, severity, message, sorted entry ids. */
function multiset(violations: readonly Violation[]): string[] {
	return violations
		.map((v) => `${v.severity}:${v.code}:${v.message}:${[...(v.entities?.entryIds ?? [])].sort().join(',')}`)
		.sort();
}

/**
 * The exact slot-mutation both real writers perform:
 * `applySwapWithTarget` (manual-edit.service.ts:1987-2007) and the revert's
 * `withSlot` (:1822-1828) both write exactly `day`, `startTime`, `endTime` and
 * `durationMinutes` and spread the rest of the entry. This helper mirrors that
 * field set so the fixture cannot diverge from the production write.
 */
function withSlot(current: ScheduledEntry, slot: { day: string; startTime: string; endTime: string }): ScheduledEntry {
	const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
	return {
		...current,
		day: slot.day,
		startTime: slot.startTime,
		endTime: slot.endTime,
		durationMinutes: toMin(slot.endTime) - toMin(slot.startTime),
	};
}

function moveEntry(entries: ScheduledEntry[], entryId: string, slot: { day: string; startTime: string; endTime: string }): ScheduledEntry[] {
	return entries.map((e) => (e.entryId === entryId ? withSlot(e, slot) : e));
}

/**
 * A net-neutral swap: two ADJACENT periods of the SAME violating block trade
 * slots. The set of occupied intervals is unchanged, so the block is still four
 * contiguous periods and the violation multiset must be identical. A revert then
 * restores the recorded prior slots.
 */
function netNeutralSwap(entries: ScheduledEntry[]): { swapped: ScheduledEntry[]; revert: (after: ScheduledEntry[]) => ScheduledEntry[] } {
	const first = entries.find((e) => e.entryId === 't1-p1')!;
	const second = entries.find((e) => e.entryId === 't1-p2')!;
	const priorA = { day: first.day, startTime: first.startTime, endTime: first.endTime };
	const priorB = { day: second.day, startTime: second.startTime, endTime: second.endTime };
	const swapped = entries.map((e) => {
		if (e.entryId === first.entryId) return withSlot(e, priorB);
		if (e.entryId === second.entryId) return withSlot(e, priorA);
		return e;
	});
	return {
		swapped,
		revert: (after) => moveEntry(moveEntry(after, first.entryId, priorA), second.entryId, priorB),
	};
}

/**
 * The client count authority, reproduced exactly:
 * `deriveRunWideReadiness` reads `summary.softViolationCount` and falls back to
 * the display list's SOFT count (timetableWorkspaceTruth.ts:98,105,115), and the
 * display list is the term-filtered violation array
 * (`hooks/useTimetableData.ts:681-692`).
 */
function operatorVisibleCount(summary: unknown, violations: readonly Violation[], termFilter: 'all' | number, entries: readonly ScheduledEntry[]): number {
	const termByEntryId = new Map(entries.map((e) => [e.entryId, e.termIndex]));
	const display = violations.filter((violation) => {
		if (termFilter === 'all') return true;
		const metaTerm = (violation.meta as { termIndex?: unknown } | undefined)?.termIndex;
		if (typeof metaTerm === 'number') return metaTerm === termFilter;
		const entryIds = violation.entities?.entryIds ?? [];
		if (entryIds.length === 0) return true;
		return entryIds.some((entryId: string) => termByEntryId.get(entryId) === termFilter);
	});
	const summaryRecord = summary && typeof summary === 'object' ? (summary as Record<string, unknown>) : null;
	const serverCount = summaryRecord?.softViolationCount;
	if (typeof serverCount === 'number' && Number.isFinite(serverCount)) return serverCount;
	return softCount(display);
}

// ─── the producer chain ─────────────────────────────────────────────────────

test('the fixture is a real multi-term violating block, not a degenerate one', () => {
	const result = validate(baseEntries());
	const consecutive = result.violations.filter((v) => v.code === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED');
	assert.equal(consecutive.length, 4, 'one violating block per ordered term, plus teacher 2 in Term 1');
	assert.equal(result.violations.filter((v) => v.severity === 'HARD').length, 0, 'the fixture stays SOFT-only');
	// The aggregation step: `parseFacultyDayTermKey` discards the term, so the
	// three teacher-1 rows carry ONE byte-identical sentence.
	const teacher1 = consecutive.filter((v) => v.entities.facultyId === 1);
	assert.equal(teacher1.length, TERMS.length, 'one row per observed ordered term');
	assert.equal(new Set(teacher1.map((v) => v.message)).size, 1, 'the per-term rows repeat one identical sentence');
	const blockKeySets = new Set(teacher1.map((v) => (v.meta as { blockEntryIds?: string[] }).blockEntryIds?.join(',')));
	assert.equal(blockKeySets.size, TERMS.length, 'each term names a distinct blockEntryIds set');
});

test('the validator arithmetic IS net-neutral across a swap + revert of the slots', () => {
	const before = baseEntries();
	const { swapped, revert } = netNeutralSwap(before);
	const after = revert(swapped);
	const pre = validate(before);
	const post = validate(after);
	assert.deepEqual(multiset(post.violations), multiset(pre.violations), 'the restored slots restore the exact violation multiset');
	assert.equal(softCount(post.violations), softCount(pre.violations), 'the run-wide SOFT total is unchanged');
	// The swap itself is count-neutral too, so nothing here can hide a residue.
	// Only the CONSECUTIVE rows are compared: the swap permutes which entry holds
	// which period, and a HARD conflict row names the pair it saw, so the full
	// multiset legitimately differs by entry identity while the warning count does
	// not move.
	assert.deepEqual(
		multiset(validate(swapped).violations.filter((v) => v.severity === 'SOFT')),
		multiset(pre.violations.filter((v) => v.severity === 'SOFT')),
		'a swap inside one block leaves the warning multiset identical',
	);
});

// ─── the defect ─────────────────────────────────────────────────────────────

test('D1 FAILING-FIRST: a manual edit summary carries the run-wide SOFT count', () => {
	const entries = baseEntries();
	const result = validate(entries);
	const summary = computeSummary(entries, [], result);
	assert.equal(
		summary.softViolationCount,
		softCount(result.violations),
		'computeSummary must persist the run-wide SOFT count from the recomputation it already performs',
	);
	assert.equal(summary.hardViolationCount, 0, 'the HARD count was already correct; the SOFT count was the omission');
});

test('D1 FAILING-FIRST: the run-wide SOFT count survives a net-neutral swap + revert', () => {
	const before = baseEntries();
	const { swapped, revert } = netNeutralSwap(before);
	// The generation-shaped summary the live run carried at generation time.
	const generationSummary = { ...computeSummary(before, [], validate(before)), isPublished: false };
	const preRunWide = softCount(validate(before).violations);

	const afterSwap = mergePreservedSummaryFields(generationSummary, computeSummary(swapped, [], validate(swapped)));
	const afterRevert = mergePreservedSummaryFields(afterSwap, computeSummary(revert(swapped), [], validate(revert(swapped))));

	assert.equal(afterSwap.softViolationCount, preRunWide, 'a swap summary must state the run-wide SOFT count');
	assert.equal(afterRevert.softViolationCount, preRunWide, 'a revert summary must state the same run-wide SOFT count');
	assert.equal(afterRevert.softViolationCount, afterSwap.softViolationCount, 'a net-neutral pair leaves the figure untouched');
});

test('D1 FAILING-FIRST: the operator-visible figure is a pure function of the entry slots, not of the term selector', () => {
	const entries = baseEntries();
	const result = validate(entries);
	const summary = mergePreservedSummaryFields(
		{ ...computeSummary(entries, [], result), isPublished: false },
		computeSummary(entries, [], result),
	);
	const across = (['all', 1, 2, 3] as const).map(
		(termFilter) => operatorVisibleCount(summary, result.violations, termFilter, entries),
	);
	assert.deepEqual(
		new Set(across),
		new Set([softCount(result.violations)]),
		`the header figure must be the run's warning count for every term scope; got ${JSON.stringify(across)}`,
	);
});

test('D1 mutant control: the figure DOES discriminate — the absent-field fallback yields a smaller, term-scoped population', () => {
	const entries = baseEntries();
	const result = validate(entries);
	const fixed = computeSummary(entries, [], result);
	// The pre-fix shape: the same summary with the run-wide count field absent,
	// which is exactly what every live run carried before this candidate.
	const preFix = { ...fixed } as Record<string, unknown>;
	delete preFix.softViolationCount;

	assert.equal(fixed.softViolationCount, 4, 'the fixed summary states the run-wide total');
	assert.equal(operatorVisibleCount(fixed, result.violations, 2, entries), 4, 'with the field present every term scope reads 4');
	assert.equal(operatorVisibleCount(preFix, result.violations, 2, entries), 1, 'without the field the Term-2 view reads 1 of the 4 rows');
	assert.notEqual(
		operatorVisibleCount(preFix, result.violations, 2, entries),
		softCount(result.violations),
		'the fallback population is genuinely smaller, so the invariance assertion discriminates',
	);
	assert.deepEqual(
		[1, 2, 3].map((t) => operatorVisibleCount(preFix, result.violations, t, entries)),
		[2, 1, 1],
		'the pre-fix figure moved with the term selector alone, with no schedule change at all',
	);
});

test('D1 FAILING-FIRST: the generation producer persists the run-wide SOFT count', () => {
	// The generation summary literal is only reachable inside the generation
	// transaction, so this asserts the real source expression (the established
	// pattern in `lib/__tests__/timetable-dynamic-workspace-publication.test.ts`).
	const source = readFileSync(new URL('../services/generation.service.ts', import.meta.url), 'utf8');
	assert.match(
		source,
		/softViolationCount: mergedValidationResult\.violations\.filter\(\(v\) => v\.severity === 'SOFT'\)\.length/,
		'the persisted generation summary must carry the run-wide SOFT count',
	);
});
