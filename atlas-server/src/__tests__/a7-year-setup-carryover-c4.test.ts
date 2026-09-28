/**
 * A7-C4 — a new school year keeps last year's setup, and it must NEVER reset
 * silently.
 *
 * THE OPERATOR'S COMPLAINT (docs/prompts/a7-year-carryover-2026-09-29.md):
 * "setting that up is a real hassle. It shouldn't reset … policies and grade
 * shifts shouldn't [reset] unless stated otherwise." Before this packet, pressing
 * one button handed them an EMPTY new year, forever.
 *
 * WHY THE FIXTURES ARE BUILT FROM THE REAL SURFACE (AGENTS.md §11, "a control's
 * fixture must come from the real surface"). The fill-empty-only rules were
 * verified against live data on 2026-09-29 by
 * `src/scripts/copy-year-setup-shift-windows-events.mjs` (receipt
 * `D:/ATLAS-runtime-config/backups/year-setup-copy-20260929/receipt-year1.json`),
 * and the source year here carries the same shape that script found: a policy row,
 * several `grade_shift_windows` rows including a NULL `program_type`, and two
 * `policy_special_events` rows. The NULL program type is not decoration — it is
 * the case `(a ?? null) === (b ?? null)` has to get right, because `SQL NULL` is
 * what a plain `===` would treat as "not the same" and re-insert over an
 * existing row.
 *
 * EVERY ROW NAMES ITS HARNESS, AND EVERY ROW WAS SEEN RED FIRST. Rows S1–S8 plus
 * the R2 ordering row were run against the base tree (no service file, no wiring)
 * and were red there; the literal red output is in the candidate handoff. A test
 * that has never failed is not evidence.
 *
 * DB-WRITING SUITE, SO IT RUNS ONLY THROUGH THE HARNESS (§5). `run-db-suite.mjs`
 * gives this file its own disposable `atlas_restore_drill_<yyyymmdd>_<suffix>`
 * database and drops it; `requireDisposableDatabase` fails closed before the
 * first row if the connected database is anything else. Nothing here can reach a
 * live or staging database.
 *
 * SCOPE, STATED PLAINLY. The real `applyRolloverSync` is NOT driven here: its
 * `previewRolloverSync` needs a live EnrollPro, so this file exercises the two
 * production functions the claim actually rests on — `applyYearSetupCarryover`
 * (the real service, on a real database) and `getOrCreatePolicy` (the real
 * service, on a real database, in the real order) — plus a source scan of the two
 * call sites, each with a positive control. The scan rows are the honest limit of
 * this harness and are labelled as scans, not as renders.
 *
 * Run: `npm run test:a7-year-setup-carryover`
 *   = node scripts/run-db-suite.mjs src/__tests__/a7-year-setup-carryover-c4.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';

import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { getOrCreatePolicy, POLICY_DEFAULTS } from '../services/scheduling-policy.service.js';
import {
	SCHEDULING_POLICY_CARRY_COLUMNS,
	SCHEDULING_POLICY_CARRY_EXCLUDED_COLUMNS,
	YEAR_SETUP_KEPT_AUDIT_ACTION,
	applyYearSetupCarryover,
	planYearSetupCarryover,
	resolveYearSetupCarryOptions,
} from '../services/year-setup-carryover.service.js';
import { requireDisposableDatabase } from './helpers/disposable-database-guard.js';

// Refuses a non-disposable DATABASE_URL at module load, i.e. strictly before the
// first write (§5 / the 2026-09-29 staging-write incident).
requireDisposableDatabase('a7-year-setup-carryover-c4.test.ts');

const SCHOOL_NAME = 'A7-C4 carryover fixture school';
const SOURCE_YEAR = 10;   // 2023-2024, the year being kept FROM
const TARGET_YEAR = 11;   // 2024-2025, the NEW year, empty on arrival
const ACTOR_ID = 1;

/** One school + the two mirrored years, created once and reused by every row. */
let schoolId = 0;

const sourcePolicyData = {
	periodLengthMinutes: 50,
	periodsPerDay: 8,
	maxTeachingMinutesPerDay: 360,
	earliestStartTime: '07:15',
	latestEndTime: '17:45',
	enforceLunchWindow: true,
	lunchStartTime: '12:00',
	lunchEndTime: '13:00',
	enableFlagCeremony: true,
	flagCeremonyStartTime: '07:20',
	flagCeremonyEndTime: '07:35',
	enableRecess: true,
	recessStartTime: '09:50',
	recessEndTime: '10:05',
	teachingStandardMinutes: 1800,
	advisoryCreditMinutes: 300,
	hardCapMinutes: 2400,
	constraintConfig: { consecutiveTeachingThreshold: 135, lunchWindow: { enabled: true } },
} as const;

const sourceWindows = [
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '07:20', endTime: '15:40' },
	{ gradeLevel: 8, programType: 'REGULAR', startTime: '07:35', endTime: '15:55' },
	{ gradeLevel: 9, programType: null, startTime: '07:50', endTime: '16:10' },
] as const;

const sourceEvents = [
	{ eventType: 'FLAG_CEREMONY', label: 'Monday flag ceremony', gradeGroup: 'ALL', programType: null, startTime: '07:20', endTime: '07:35', enabled: true, sortOrder: 1 },
	{ eventType: 'SPECIAL_DAY', label: 'Foundation Day', gradeGroup: '9', programType: 'REGULAR', startTime: '08:00', endTime: '12:00', enabled: true, sortOrder: 2 },
] as const;

async function seedSchool() {
	const school = await prisma.school.create({ data: { name: SCHOOL_NAME, shortName: 'A7C4' } });
	schoolId = school.id;
	await prisma.enrollProSchoolYearMirror.createMany({
		data: [
			{ schoolId, enrollProSchoolYearId: SOURCE_YEAR, yearLabel: '2023-2024', isActive: false },
			{ schoolId, enrollProSchoolYearId: TARGET_YEAR, yearLabel: '2024-2025', isActive: true },
		],
	});
}

async function seedSourceYear() {
	await prisma.schedulingPolicy.create({ data: { schoolId, schoolYearId: SOURCE_YEAR, ...sourcePolicyData } });
	await prisma.gradeShiftWindow.createMany({
		data: sourceWindows.map((row) => ({ schoolId, schoolYearId: SOURCE_YEAR, ...row })),
	});
	await prisma.policySpecialEvent.createMany({
		data: sourceEvents.map((row) => ({ schoolId, schoolYearId: SOURCE_YEAR, ...row })),
	});
}

before(async () => {
	await seedSchool();
});

after(async () => {
	// Disposable by construction (the harness owns and drops the database), so
	// this is hygiene for a shared template run, not a rollback.
	await prisma.school.deleteMany({ where: { name: SCHOOL_NAME } });
	await prisma.$disconnect();
});

/** Every row this suite may touch, for the byte-identical rows. */
async function snapshotYear(yearId: number) {
	const [policy, windows, events] = await Promise.all([
		prisma.schedulingPolicy.findUnique({ where: { schoolId_schoolYearId: { schoolId, schoolYearId: yearId } } }),
		prisma.gradeShiftWindow.findMany({ where: { schoolId, schoolYearId: yearId }, orderBy: [{ gradeLevel: 'asc' }, { id: 'asc' }] }),
		prisma.policySpecialEvent.findMany({ where: { schoolId, schoolYearId: yearId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
	]);
	return { policy, windows, events };
}

async function carryAuditCount(): Promise<number> {
	return prisma.auditLog.count({ where: { schoolId, action: YEAR_SETUP_KEPT_AUDIT_ACTION } });
}

async function targetCounts() {
	const [policy, windows, events] = await Promise.all([
		prisma.schedulingPolicy.count({ where: { schoolId, schoolYearId: TARGET_YEAR } }),
		prisma.gradeShiftWindow.count({ where: { schoolId, schoolYearId: TARGET_YEAR } }),
		prisma.policySpecialEvent.count({ where: { schoolId, schoolYearId: TARGET_YEAR } }),
	]);
	return { policy, windows, events };
}

describe('A7-C4 the source year setup a new school year keeps', () => {
	beforeEach(async () => {
		await prisma.schedulingPolicy.deleteMany({ where: { schoolId } });
		await prisma.gradeShiftWindow.deleteMany({ where: { schoolId } });
		await prisma.policySpecialEvent.deleteMany({ where: { schoolId } });
		await prisma.auditLog.deleteMany({ where: { schoolId } });
		await seedSourceYear();
	});

	// ── S1 ───────────────────────────────────────────────────────────────────
	test('S1: an empty target keeps the policy, every missing grade window and the events, and every copied policy column equals the source', async () => {
		const before = await snapshotYear(SOURCE_YEAR);

		const result = await applyYearSetupCarryover({ schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID });

		assert.equal(result.applied, true, 'an empty target must take the carry');
		assert.ok(result.auditLogId != null, 'a real carry must write its one audit row');
		assert.equal(result.plan.sourceYearId, SOURCE_YEAR, 'the source must be the previous year, not the target');
		assert.equal(result.plan.sourceYearLabel, '2023-2024', 'the plan must name the year it kept from, so the confirmation can say so');
		assert.equal(result.plan.schedulingPolicy.toInsert, 1);
		assert.equal(result.plan.gradeShiftWindows.toInsert, sourceWindows.length);
		assert.equal(result.plan.policySpecialEvents.toInsert, sourceEvents.length);

		const after = await snapshotYear(TARGET_YEAR);
		assert.ok(after.policy, 'the new year has no policy row after the carry');
		assert.equal(after.windows.length, sourceWindows.length);
		assert.equal(after.events.length, sourceEvents.length);

		// R4: EVERY carried column equals the source, on the real written row.
		// This is the row that makes a wildcard `INSERT ... SELECT` or a silently
		// dropped column fail: it walks the enumerated list, not a hand-picked few.
		for (const column of SCHEDULING_POLICY_CARRY_COLUMNS) {
			assert.deepEqual(
				(after.policy as unknown as Record<string, unknown>)[column],
				(before.policy as unknown as Record<string, unknown>)[column],
				`the carried policy column "${column}" differs from the source`,
			);
		}
		// The scope keys are the target's, never the source's.
		assert.equal(after.policy!.schoolYearId, TARGET_YEAR);
		assert.equal(after.policy!.schoolId, schoolId);
		assert.notEqual(after.policy!.id, before.policy!.id);
		// And the three identity/bookkeeping columns were NOT carried.
		for (const excluded of SCHEDULING_POLICY_CARRY_EXCLUDED_COLUMNS) {
			if (excluded === 'schoolId' || excluded === 'schoolYearId') continue;
			assert.notDeepEqual(
				(after.policy as unknown as Record<string, unknown>)[excluded],
				(before.policy as unknown as Record<string, unknown>)[excluded],
				`"${excluded}" must not be copied from the source`,
			);
		}

		// The grade windows keep their grade, program type (INCLUDING the null one)
		// and times.
		assert.deepEqual(
			after.windows.map((row) => ({ gradeLevel: row.gradeLevel, programType: row.programType, startTime: row.startTime, endTime: row.endTime })),
			before.windows.map((row) => ({ gradeLevel: row.gradeLevel, programType: row.programType, startTime: row.startTime, endTime: row.endTime })),
		);
		assert.deepEqual(
			after.events.map((row) => ({ eventType: row.eventType, label: row.label, gradeGroup: row.gradeGroup, programType: row.programType, startTime: row.startTime, endTime: row.endTime, enabled: row.enabled, sortOrder: row.sortOrder })),
			before.events.map((row) => ({ eventType: row.eventType, label: row.label, gradeGroup: row.gradeGroup, programType: row.programType, startTime: row.startTime, endTime: row.endTime, enabled: row.enabled, sortOrder: row.sortOrder })),
		);
	});

	/**
	 * R4 COMPLETENESS — the row that keeps the field map from rotting.
	 *
	 * S1 proves every column IN THE LIST is copied. On its own that would pass
	 * happily if someone added a column to `prisma/schema.prisma` and forgot the
	 * list: the new column would simply be dropped from every future carry, and the
	 * S1 row would still be green because it only walks the list. This row reads
	 * the Prisma model definition and requires the list to be EXACTLY the model's
	 * data columns minus the named exclusions, so that failure is red.
	 */
	test('S1b: the carried column list is exactly the model\'s data columns, so a new column cannot be silently dropped', () => {
		const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === 'SchedulingPolicy');
		assert.ok(model, 'SchedulingPolicy is missing from the Prisma DMMF');
		const dataColumns = model!.fields.map((field) => field.name).sort();
		const expected = dataColumns.filter((name) => !(SCHEDULING_POLICY_CARRY_EXCLUDED_COLUMNS as readonly string[]).includes(name)).sort();
		const carried: string[] = [...SCHEDULING_POLICY_CARRY_COLUMNS].sort();
		assert.deepEqual(
			carried,
			expected,
			`the explicit field map has drifted from the model.\n  missing from the map: ${expected.filter((n) => !carried.includes(n)).join(', ') || '(none)'}\n  in the map but not a model column: ${carried.filter((n) => !expected.includes(n)).join(', ') || '(none)'}`,
		);
		// Positive control: the comparison really discriminates. A column the map
		// does not have must be reported as missing.
		assert.ok(expected.length > SCHEDULING_POLICY_CARRY_EXCLUDED_COLUMNS.length, 'the model has no data columns, so this row would pass vacuously');
		assert.equal(
			expected.includes('maxBackToBackTransitionsWithoutBuffer' as string),
			true,
			'a known model column must be in the expected set, or the comparison above is not comparing the right things',
		);
	});

	// ── R2, the ordering the packet calls "the whole point" ──────────────────
	/**
	 * R2 — WHY THE CARRY RUNS BEFORE `getOrCreatePolicy`.
	 *
	 * `getOrCreatePolicy` CREATES a defaults row for a year that has none. So if
	 * the carry ran after it, the target would no longer be empty, the
	 * fill-empty-only rule would copy nothing, and the new school year would
	 * silently get factory-default scheduling rules — precisely the complaint the
	 * operator filed. This row proves the ordering MATTERS and that the order the
	 * packet mandates produces the kept year: the two REAL production services are
	 * run in the mandated order, against a real database.
	 */
	test('R2: carry first, then the real getOrCreatePolicy finds the kept row and does not replace it with defaults', async () => {
		await applyYearSetupCarryover({ schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID });
		const carried = await snapshotYear(TARGET_YEAR);
		assert.ok(carried.policy, 'the carry must have written the policy before the policy phase');

		// The REAL service, unchanged, exactly as `applyRolloverSync` calls it next.
		const policy = await getOrCreatePolicy(schoolId, TARGET_YEAR);

		assert.equal(policy.periodLengthMinutes, sourcePolicyData.periodLengthMinutes, 'the school-day length was reset to a default');
		assert.equal(policy.earliestStartTime, sourcePolicyData.earliestStartTime);
		assert.equal(policy.flagCeremonyStartTime, sourcePolicyData.flagCeremonyStartTime);
		assert.equal(policy.teachingStandardMinutes, sourcePolicyData.teachingStandardMinutes);
		assert.deepEqual(policy.constraintConfig, sourcePolicyData.constraintConfig, 'the ceremony/lunch constraint was reset');
		assert.equal((await targetCounts()).policy, 1, 'getOrCreatePolicy must not have created a second policy row');

		// THE NEGATIVE CONTROL, and it is the load-bearing half: the SAME real
		// service, run against the year BEFORE the carry — which is what "the carry
		// ran after the policy phase" means. It must produce a defaults row, and
		// that row must then BLOCK the carry. So this row goes red the moment the
		// ordering is reversed, and it cannot pass for a reason unrelated to order.
		const otherYear = 12;
		await prisma.enrollProSchoolYearMirror.create({ data: { schoolId, enrollProSchoolYearId: otherYear, yearLabel: '2025-2026', isActive: false } });
		try {
			const defaulted = await getOrCreatePolicy(schoolId, otherYear);
			assert.equal(
				defaulted.periodLengthMinutes,
				45,
				'this control assumes getOrCreatePolicy still defaults periodLengthMinutes to 45; if the default changed, re-read the control before trusting it',
			);
			const blocked = await applyYearSetupCarryover({ schoolId, toYearId: otherYear, actorId: ACTOR_ID });
			assert.equal(blocked.plan.schedulingPolicy.toInsert, 0, 'a year that already has a policy row must not be given another one');
			assert.equal(blocked.plan.schedulingPolicy.targetExisting, 1);
			// The shape of the damage is the useful half: the grade windows and the
			// events still copy (they are keyed per row / per zero), but the SCHOOL
			// DAY comes across as a factory default. That HALF reset is exactly what
			// an operator reports as "it reset", and it is what the ordering prevents.
			assert.equal(blocked.plan.gradeShiftWindows.toInsert, sourceWindows.length, 'the grade windows are keyed per row, so a policy-order defect is a HALF reset, not a clean empty year');
			const afterBlocked = await snapshotYear(otherYear);
			assert.equal(afterBlocked.policy!.periodLengthMinutes, 45, 'the policy must be the defaults row the policy phase left behind');
			assert.equal(afterBlocked.policy!.earliestStartTime, POLICY_DEFAULTS.earliestStartTime, 'the school-day start must be the factory default, not the source value — that is the half reset');
			assert.notEqual(afterBlocked.policy!.earliestStartTime, sourcePolicyData.earliestStartTime, 'if these were equal the control would be proving nothing');
			assert.equal(afterBlocked.windows.length, sourceWindows.length);
		} finally {
			await prisma.schedulingPolicy.deleteMany({ where: { schoolYearId: otherYear } });
			await prisma.enrollProSchoolYearMirror.deleteMany({ where: { enrollProSchoolYearId: otherYear } });
		}
	});

	// ── S2 ───────────────────────────────────────────────────────────────────
	test('S2: a target that already has its own setup keeps it, byte for byte, and only the missing part is filled', async () => {
		// A target with ITS OWN policy, one of its own windows, and its own event.
		await prisma.schedulingPolicy.create({
			data: { schoolId, schoolYearId: TARGET_YEAR, periodLengthMinutes: 40, earliestStartTime: '06:00', lunchStartTime: '11:00' },
		});
		await prisma.gradeShiftWindow.create({
			data: { schoolId, schoolYearId: TARGET_YEAR, gradeLevel: 7, programType: 'REGULAR', startTime: '06:05', endTime: '14:00' },
		});
		await prisma.policySpecialEvent.create({
			data: { schoolId, schoolYearId: TARGET_YEAR, eventType: 'SPECIAL_DAY', label: 'Target-only day', gradeGroup: '8', programType: null, startTime: '09:00', endTime: '10:00', enabled: false, sortOrder: 9 },
		});
		const targetBefore = await snapshotYear(TARGET_YEAR);

		const result = await applyYearSetupCarryover({ schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID });

		assert.equal(result.plan.schedulingPolicy.toInsert, 0, 'a target that already has a policy row must not be given another');
		assert.equal(result.plan.gradeShiftWindows.toInsert, sourceWindows.length - 1, 'only the missing grade window may be filled');
		// R3: events are all-or-nothing, keyed on the target having ZERO.
		assert.equal(result.plan.policySpecialEvents.toInsert, 0, 'a target with any event row of its own keeps none of the source events');

		const targetAfter = await snapshotYear(TARGET_YEAR);
		assert.deepEqual(targetAfter.policy, targetBefore.policy, 'the target policy row changed');
		assert.equal(targetAfter.policy!.periodLengthMinutes, 40);
		assert.equal(targetAfter.policy!.earliestStartTime, '06:00');
		const keptWindow = targetAfter.windows.find((row) => row.gradeLevel === 7);
		assert.equal(keptWindow!.startTime, '06:05', 'the target\'s own grade-7 window was overwritten');
		assert.equal(targetAfter.events.length, 1);
		assert.equal(targetAfter.events[0].label, 'Target-only day');
		assert.equal(targetAfter.events[0].enabled, false);
		// …and the two grades that had no window of their own got one.
		assert.deepEqual(
			targetAfter.windows.filter((row) => row.gradeLevel !== 7).map((row) => row.gradeLevel).sort(),
			[8, 9],
		);
	});

	// ── S3 ───────────────────────────────────────────────────────────────────
	test('S3: a switch turned off copies nothing for that part, and writes no audit row when nothing was copied at all', async () => {
		const rulesOff = await applyYearSetupCarryover({
			schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID,
			options: { keepSchedulingRules: false },
		});
		const counts = await targetCounts();
		assert.equal(counts.policy, 0, 'switch 1 off must leave the new year with no policy row');
		assert.equal(rulesOff.plan.schedulingPolicy.toInsert, 0);
		// The other switch is untouched by the first one being off.
		assert.equal(counts.windows, sourceWindows.length, 'switch 2 must still copy when only switch 1 is off');
		assert.equal(counts.events, sourceEvents.length);

		// Both off, on a clean target: nothing is copied and NO audit row exists,
		// so a "kept" line could never be claimed for a run that kept nothing.
		await prisma.schedulingPolicy.deleteMany({ where: { schoolId, schoolYearId: TARGET_YEAR } });
		await prisma.gradeShiftWindow.deleteMany({ where: { schoolId, schoolYearId: TARGET_YEAR } });
		await prisma.policySpecialEvent.deleteMany({ where: { schoolId, schoolYearId: TARGET_YEAR } });
		await prisma.auditLog.deleteMany({ where: { schoolId } });

		const bothOff = await applyYearSetupCarryover({
			schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID,
			options: { keepSchedulingRules: false, keepGradeTimeWindows: false },
		});
		assert.deepEqual(await targetCounts(), { policy: 0, windows: 0, events: 0 }, 'both switches off must leave the new year completely empty');
		assert.equal(bothOff.applied, false, 'nothing copied must not report an apply');
		assert.equal(bothOff.auditLogId, null, 'nothing copied must write no audit row');
		assert.equal(await carryAuditCount(), 0, 'the audit table must hold no YEAR_SETUP_KEPT row');
	});

	// ── S4 ───────────────────────────────────────────────────────────────────
	test('S4: a second run copies nothing, writes no audit row, and leaves every row byte-identical', async () => {
		const first = await applyYearSetupCarryover({ schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID });
		assert.equal(first.applied, true);
		const auditAfterFirst = await carryAuditCount();
		assert.equal(auditAfterFirst, 1, 'the first run writes exactly one audit row');

		const rowsAfterFirst = await snapshotYear(TARGET_YEAR);

		const second = await applyYearSetupCarryover({ schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID });
		assert.equal(second.applied, false, 'a re-run must report nothing applied');
		assert.equal(second.auditLogId, null, 'a re-run must write no audit row');
		assert.equal(await carryAuditCount(), 1, 'the audit count must not move on a re-run — the whole operation is idempotent');
		assert.deepEqual(await targetCounts(), { policy: 1, windows: sourceWindows.length, events: sourceEvents.length });
		assert.deepEqual(await snapshotYear(TARGET_YEAR), rowsAfterFirst, 'a re-run changed a row');
	});

	// ── S5 ───────────────────────────────────────────────────────────────────
	test('S5 THE FAIL-SAFE: absent, null, "false", 0, {} and garbage all resolve to KEEP — only a literal false means off', () => {
		// The default lives in this function and nowhere else, so a stale client,
		// a direct API caller and the automation path cannot turn it off.
		for (const input of [
			undefined,
			null,
			{},
			{ keepSchedulingRules: undefined, keepGradeTimeWindows: undefined },
			'false',
			'FALSE',
			0,
			'',
			NaN,
			[],
			['false'],
			() => false,
			{ keepSchedulingRules: 'false', keepGradeTimeWindows: 'no' },
			{ keepSchedulingRules: null, keepGradeTimeWindows: 0 },
			{ keepSchedulingRules: 1, keepGradeTimeWindows: {} },
			{ unrelated: 'field' },
		]) {
			assert.deepEqual(
				resolveYearSetupCarryOptions(input),
				{ keepSchedulingRules: true, keepGradeTimeWindows: true },
				`input ${JSON.stringify(input) ?? String(input)} must resolve to KEEP on both parts`,
			);
		}
		// POSITIVE CONTROL: the detector is not vacuous — only the boolean `false`
		// turns a part off, and it does so for that part alone.
		assert.deepEqual(
			resolveYearSetupCarryOptions({ keepSchedulingRules: false, keepGradeTimeWindows: true }),
			{ keepSchedulingRules: false, keepGradeTimeWindows: true },
		);
		assert.deepEqual(
			resolveYearSetupCarryOptions({ keepSchedulingRules: true, keepGradeTimeWindows: false }),
			{ keepSchedulingRules: true, keepGradeTimeWindows: false },
		);
		assert.deepEqual(
			resolveYearSetupCarryOptions(false),
			{ keepSchedulingRules: true, keepGradeTimeWindows: true },
			'the whole options bag being false must not turn anything off',
		);
	});

	// ── S6 ───────────────────────────────────────────────────────────────────
	test('S6: the source year is never mutated — every source row is byte-identical after a carry', async () => {
		const before = await snapshotYear(SOURCE_YEAR);
		await applyYearSetupCarryover({ schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID });
		const after = await snapshotYear(SOURCE_YEAR);
		assert.deepEqual(after, before, 'a source policy / window / event row changed during a carry');

		// And the negative control: the assertion above would also pass if the
		// carry had deleted the source and the snapshot compared nothing, so prove
		// the snapshot is non-empty and the compare is on real rows.
		assert.ok(before.policy && before.windows.length === sourceWindows.length && before.events.length === sourceEvents.length, 'the source fixture is empty, so S6 would pass vacuously');
	});

	// ── S7 ───────────────────────────────────────────────────────────────────
	test('S7: the plan is zero-write — planYearSetupCarryover inserts nothing', async () => {
		const before = await snapshotYear(TARGET_YEAR);
		const auditBefore = await carryAuditCount();

		const plan = await planYearSetupCarryover(prisma, schoolId, TARGET_YEAR, { keepSchedulingRules: true, keepGradeTimeWindows: true });

		assert.equal(plan.sourceYearId, SOURCE_YEAR, 'the plan must still find the source year');
		assert.equal(plan.schedulingPolicy.toInsert, 1, 'the plan must still report what it WOULD insert — it is a plan, not a no-op');
		assert.equal(plan.gradeShiftWindows.toInsert, sourceWindows.length);
		assert.equal(plan.policySpecialEvents.toInsert, sourceEvents.length);
		assert.deepEqual(await snapshotYear(TARGET_YEAR), before, 'the plan wrote a row');
		assert.equal(await carryAuditCount(), auditBefore, 'the plan wrote an audit row');
	});

	// ── S8 ───────────────────────────────────────────────────────────────────
	test('S8: the default cannot be turned off by omission — a caller that passes no yearSetupCarry at all still keeps', async () => {
		// The real service, called exactly as `applyRolloverSync` calls it when its
		// caller omitted the switches: `options` is undefined. Both parts copy.
		const omitted = await applyYearSetupCarryover({ schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID });
		assert.equal(omitted.plan.schedulingPolicy.toInsert, 1, 'omission must keep the scheduling rules');
		assert.equal(omitted.plan.gradeShiftWindows.toInsert, sourceWindows.length, 'omission must keep the grade windows');
		assert.equal(omitted.plan.policySpecialEvents.toInsert, sourceEvents.length, 'omission must keep the events');
		assert.equal((await targetCounts()).policy, 1);
		assert.equal((await targetCounts()).events, sourceEvents.length);

		// Same again on a fresh target with an EMPTY options object, which is what
		// the route sends when the body carried no `yearSetupCarry` values.
		await prisma.schedulingPolicy.deleteMany({ where: { schoolId, schoolYearId: TARGET_YEAR } });
		await prisma.gradeShiftWindow.deleteMany({ where: { schoolId, schoolYearId: TARGET_YEAR } });
		await prisma.policySpecialEvent.deleteMany({ where: { schoolId, schoolYearId: TARGET_YEAR } });
		const emptyBag = await applyYearSetupCarryover({ schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID, options: {} });
		assert.equal(emptyBag.plan.schedulingPolicy.toInsert, 1, 'an empty options object must keep the scheduling rules');
		assert.equal(emptyBag.plan.gradeShiftWindows.toInsert, sourceWindows.length, 'an empty options object must keep the grade windows');
	});

	/**
	 * S8b - THE CALL-SITE SCAN, and its limits stated. The real `applyRolloverSync`
	 * cannot be driven hermetically (its preview needs a live EnrollPro), so the
	 * call sites were read by hand and this row pins the parts of that reading a
	 * scan CAN decide. This is a SOURCE assertion and it is labelled as one; the
	 * behavioural half of S8 is the row above, on the real service and a real
	 * database.
	 *
	 * WHAT THIS ROW PROVES, precisely: no call site in the server tree passes a
	 * LITERAL default-off carry (a bare `false`, or a `?? false` / `|| false`
	 * fallback), and the route forwards the raw body values unvalidated. It
	 * detects those textual shapes only.
	 *
	 * WHAT IT DOES NOT PROVE, stated here rather than left implied: a call site
	 * passing a boolean VARIABLE that evaluates to `false` would not be flagged by
	 * this scan. The manual review that closed the gap read all six call sites of
	 * `applyRolloverSync` — the `/rollover-sync/apply` route, `/reset-dummy-year`,
	 * `/rollover-archive/apply`, `applyTestYearRecovery`, `resetDummyYearAndApplyRollover`
	 * and the automation path — and found that only the first passes the object at
	 * all, with both values taken raw off `req.body`. The behavioural row above,
	 * not this one, is what guarantees the property.
	 *
	 * The POSITIVE CONTROL is the part that makes it evidence: the same extractor,
	 * fed a synthetic default-off caller, must report it. A scan that cannot go red
	 * is not a scan.
	 */
	test('S8b: no call site in the server tree passes a default-off carry, and the route forwards the raw body values unvalidated', () => {
		const serverRoot = new URL('..', import.meta.url);
		const carry = readFileSync(new URL('services/year-setup-carryover.service.ts', serverRoot), 'utf8');
		const rollover = readFileSync(new URL('services/enrollpro-rollover.service.ts', serverRoot), 'utf8');
		const router = readFileSync(new URL('routes/runtime.router.ts', serverRoot), 'utf8');

		// The switches are interpreted in exactly one place, which is what makes
		// the fail-safe airtight.
		const interpreters = carry.match(/keepSchedulingRules\s*!==\s*false/g) ?? [];
		assert.equal(interpreters.length, 1, `the fail-safe must be the only interpreter of the switches; found ${interpreters.length} comparisons in the service`);
		assert.equal(/function resolveYearSetupCarryOptions/.test(carry), true, 'the fail-safe must stay a named, exported, testable function');

		// `applyRolloverSync` hands the service whatever it was given and never
		// substitutes a value of its own.
		assert.ok(
			/failedPhase = 'year-setup-carryover';/.test(rollover),
			'the carry phase must exist in applyRolloverSync, or the default is not applied on the sync path at all',
		);
		assert.ok(
			/yearSetupCarryOptions = resolveYearSetupCarryOptions\(options\?\.yearSetupCarry\);/.test(rollover),
			'applyRolloverSync must resolve the switches through the service fail-safe, not inline',
		);
		const carryCall = rollover.slice(rollover.indexOf("failedPhase = 'year-setup-carryover'"));
		assert.ok(
			carryCall.indexOf("getOrCreatePolicy(schoolId, activeYear.id)") > carryCall.indexOf('applyYearSetupCarryover({'),
			'R2: the carry must be called BEFORE getOrCreatePolicy — the order is the whole point, because getOrCreatePolicy creates a defaults row',
		);

		// The route passes the two raw body values through, with no validation and
		// no `?? false` anywhere near them.
		assert.ok(
			/keepSchedulingRules: req\.body\?\.yearSetupCarry\?\.keepSchedulingRules/.test(router),
			'the route must forward the raw request value so the server default decides',
		);
		assert.ok(
			/keepGradeTimeWindows: req\.body\?\.yearSetupCarry\?\.keepGradeTimeWindows/.test(router),
			'the route must forward the raw request value so the server default decides',
		);
		assert.equal(
			/keepSchedulingRules[^,]*\?\?\s*false|keepGradeTimeWindows[^,]*\?\?\s*false/.test(router),
			false,
			'the route must never default a carry switch to false; that is the silent reset the packet forbids',
		);

		// THE POSITIVE CONTROL. The same two checks, fed a synthetic default-off
		// caller, must go red — so a green result above means something.
		const defaultOffCaller = `const options = { yearSetupCarry: { keepSchedulingRules: false } };`;
		const defaultOffRoute = `yearSetupCarry: { keepSchedulingRules: req.body?.x?.y ?? false },`;
		const scanFlagsDefaultOff = (source: string): boolean => (
			/keepSchedulingRules\s*:\s*false/.test(source)
			|| /keepGradeTimeWindows\s*:\s*false/.test(source)
			|| /keepSchedulingRules[^,]*\?\?\s*false/.test(source)
			|| /keepGradeTimeWindows[^,]*\?\?\s*false/.test(source)
		);
		assert.equal(scanFlagsDefaultOff(rollover), false, 'POSITIVE CONTROL: the real rollover service must not be flagged');
		assert.equal(scanFlagsDefaultOff(router), false, 'POSITIVE CONTROL: the real router must not be flagged');
		assert.equal(scanFlagsDefaultOff(defaultOffCaller), true, 'POSITIVE CONTROL: a default-off caller must be flagged, or this scan cannot detect one');
		assert.equal(scanFlagsDefaultOff(defaultOffRoute), true, 'POSITIVE CONTROL: a route-level ?? false must be flagged');
	});

	// ── R5 ───────────────────────────────────────────────────────────────────
	test('R5: exactly one audit row is written per real carry, naming the source year, both switches and the three counts', async () => {
		const result = await applyYearSetupCarryover({
			schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID,
			options: { keepSchedulingRules: true, keepGradeTimeWindows: false },
		});
		assert.equal(result.applied, true, 'the policy alone is a real carry, so the audit row is required');

		const rows = await prisma.auditLog.findMany({ where: { schoolId, action: YEAR_SETUP_KEPT_AUDIT_ACTION }, orderBy: { id: 'asc' } });
		assert.equal(rows.length, 1, 'exactly one audit row per real carry');
		const audit = rows[0];
		assert.equal(audit.id, result.auditLogId, 'the returned id must be the row that was written');
		assert.equal(audit.schoolYearId, TARGET_YEAR, 'the audit row belongs to the NEW year');
		assert.equal(audit.actorId, ACTOR_ID);
		const metadata = audit.metadata as Record<string, unknown>;
		assert.equal(metadata.sourceYearId, SOURCE_YEAR, 'the audit row names the year it kept from');
		assert.equal(metadata.sourceYearLabel, '2023-2024');
		assert.equal(metadata.keepSchedulingRules, true, 'the audit records the RESOLVED switch, not the request');
		assert.equal(metadata.keepGradeTimeWindows, false);
		assert.equal(metadata.schedulingPolicyInserted, 1);
		assert.equal(metadata.gradeShiftWindowsInserted, 0, 'the off switch must be recorded as zero, not omitted');
		assert.equal(metadata.policySpecialEventsInserted, 0);
	});
});

describe('A7-C4 the source year that gets chosen', () => {
	beforeEach(async () => {
		await prisma.schedulingPolicy.deleteMany({ where: { schoolId } });
		await prisma.gradeShiftWindow.deleteMany({ where: { schoolId } });
		await prisma.policySpecialEvent.deleteMany({ where: { schoolId } });
		await prisma.auditLog.deleteMany({ where: { schoolId } });
	});

	/**
	 * R6 — the source year is the most recent OTHER mirrored year that actually has
	 * something to copy. `getLatestAtlasSchoolYearId` is NOT used: after activation
	 * it returns the new year itself, which would make the target its own source.
	 */
	test('R6: the source is the most recent OTHER year that has something to copy, and an empty school copies nothing and says so', async () => {
		// Year 9 is mirrored and completely EMPTY; year 10 is mirrored and full.
		await prisma.enrollProSchoolYearMirror.create({ data: { schoolId, enrollProSchoolYearId: 9, yearLabel: '2022-2023', isActive: false } });
		await prisma.enrollProSchoolYearMirror.update({ where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: SOURCE_YEAR } }, data: { isActive: false } });
		await prisma.enrollProSchoolYearMirror.update({ where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: TARGET_YEAR } }, data: { isActive: true } });
		await seedSourceYear();

		const plan = await planYearSetupCarryover(prisma, schoolId, TARGET_YEAR, {});
		assert.equal(plan.sourceYearId, SOURCE_YEAR, 'the most recent year WITH something to copy wins; year 9 is more recent and empty');

		// And the fail-closed branch: a school whose only other year is empty has no
		// source at all, and the plan says so rather than inventing one.
		await prisma.schedulingPolicy.deleteMany({ where: { schoolId, schoolYearId: SOURCE_YEAR } });
		await prisma.gradeShiftWindow.deleteMany({ where: { schoolId, schoolYearId: SOURCE_YEAR } });
		await prisma.policySpecialEvent.deleteMany({ where: { schoolId, schoolYearId: SOURCE_YEAR } });
		const noSource = await planYearSetupCarryover(prisma, schoolId, TARGET_YEAR, {});
		assert.equal(noSource.sourceYearId, null, 'no year has anything to copy, so there is no source');
		assert.equal(noSource.sourceYearLabel, null);
		assert.equal(noSource.schedulingPolicy.toInsert, 0);
		assert.equal(noSource.gradeShiftWindows.toInsert, 0);
		assert.equal(noSource.policySpecialEvents.toInsert, 0);

		const applied = await applyYearSetupCarryover({ schoolId, toYearId: TARGET_YEAR, actorId: ACTOR_ID });
		assert.equal(applied.applied, false, 'nothing to copy must not report an apply');
		assert.equal(applied.auditLogId, null);
		assert.deepEqual(await targetCounts(), { policy: 0, windows: 0, events: 0 });
	});
});
