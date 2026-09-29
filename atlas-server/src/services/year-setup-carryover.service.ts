/**
 * A7-C4 — a new school year arrives the way the scheduler left it (R1: it must
 * never reset silently).
 *
 * THE OPERATOR'S WORDS (docs/prompts/a7-year-carryover-2026-09-29.md): "setting
 * that up is a real hassle. It shouldn't reset … policies and grade shifts
 * shouldn't [reset] unless stated otherwise." Until this file exists, pressing
 * one button on `/admin/year-setup` handed the operator an EMPTY year: they
 * re-entered every grade's start/finish time and their flag ceremonies and
 * special days, one year at a time, forever.
 *
 * FOUR PROPERTIES THIS FILE EXISTS TO HOLD, each of which is a packet ruling:
 *
 *   R1 THE DEFAULT LIVES HERE, NOT IN A CALLER. `resolveYearSetupCarryOptions`
 *      is the ONLY place a switch is interpreted, and it is a fail-safe: any
 *      value that is not literally `false` is `true`. A stale client, a direct
 *      API caller, the automation path (`initiatedBy: 'system'`) and a request
 *      whose field is missing, `null` or garbage therefore all get KEEP. The
 *      guarantee is a property of the server, not of a checkbox a user may forget
 *      to tick — and because the default is resolved HERE, `resetDummyYearAndApplyRollover`
 *      and every other path inherit it without passing anything.
 *
 *   R2 THE CARRY LANDS BEFORE THE POLICY IS CREATED. `applyRolloverSync` calls
 *      `getOrCreatePolicy(schoolId, activeYear.id)`, which CREATES a defaults row
 *      for the new year. If the carry ran after that, the target would no longer
 *      be empty, the fill-empty-only rule would copy nothing, and the new year
 *      would silently get factory-default scheduling rules — the exact defect
 *      the operator is complaining about. So the caller runs this BEFORE the
 *      policy phase. `getOrCreatePolicy` then finds an existing row and takes its
 *      existing normalise-only path, unchanged.
 *
 *   R3 FILL-EMPTY-ONLY, PER PART, REUSING THE HOTFIX SCRIPT'S SQL LOGIC. The
 *      rules were verified against live data on 2026-09-29
 *      (`src/scripts/copy-year-setup-shift-windows-events.mjs`, receipt
 *      `D:/ATLAS-runtime-config/backups/year-setup-copy-20260929/receipt-year1.json`):
 *        - scheduling policy: copy only when the target year has NO row at all
 *          (not a field-by-field merge);
 *        - grade time windows: copy a source window only when the target has no
 *          row for the same `(grade_level, program_type)`. The in-transaction
 *          filter below is the authority for this. `uq_grade_shift_window` backs it
 *          up for NON-NULL `program_type` only: `programType` is nullable and a
 *          PostgreSQL unique index treats NULLs as distinct, so it would NOT stop
 *          two NULL-program rows. Do not rely on it for that case. The
 *          `Serializable` transaction below is what holds: two concurrent carries
 *          read the same target set, so one loses with a serialization failure
 *          rather than inserting a duplicate. `withSchoolLock` is NOT the guarantee
 *          and must not be cited as one — it lives in the ROUTES
 *          (`runtime.router.ts`), and the automation path
 *          (`rollover-automation.service.ts`) reaches this function without it.
 *          A serialization failure is deliberately not caught or retried here: it
 *          propagates out of `applyRolloverSync` and fails the rollover loudly
 *          rather than writing anything ambiguous;
 *        - flag ceremonies / special events: copy only when the target year has
 *          ZERO `policy_special_events` rows.
 *      A source row is never updated or deleted; a target row is never
 *      overwritten; no other table is touched.
 *
 *   R5 ONE AUDIT ROW, ONLY WHEN SOMETHING WAS COPIED. Action
 *      `YEAR_SETUP_KEPT_FROM_PREVIOUS_YEAR`, recording the source year, both
 *      switches and the three inserted counts. When the plan copies nothing (a
 *      re-run, or everything already present) no row is written, so the whole
 *      operation — audit included — is idempotent.
 *
 * R6 THE SOURCE YEAR is the most recent OTHER mirrored year that actually has
 * something to copy — NOT `getLatestAtlasSchoolYearId`, which after activation
 * returns the new year itself. It is named in the result so the confirmation can
 * say which year was kept from, and when there is no such year the plan copies
 * nothing and says so.
 *
 * R8 THE PLAN IS ZERO-WRITE. `planYearSetupCarryover` is exported separately from
 * `applyYearSetupCarryover` precisely so the counts can be shown without a write;
 * the apply computes the plan INSIDE its own transaction and inserts from that
 * same plan, so the two can never disagree. `getRolloverStatus` — read by six
 * surfaces including four other lanes' pages — does not change, so this adds no
 * request to any read path.
 */
import { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

export type YearSetupCarryOptions = {
	/** The `scheduling_policies` row: school day, caps, breaks, lunch, ceremony times. */
	keepSchedulingRules: boolean;
	/** The `grade_shift_windows` rows and the `policy_special_events` rows. */
	keepGradeTimeWindows: boolean;
};

/** One part's counts, as the plan reports them. */
export type YearSetupCarryPartCounts = {
	/** How many rows the source year holds for this part. 0 when the switch is off. */
	source: number;
	/** How many rows the TARGET year already holds. Never changed by a carry. */
	targetExisting: number;
	/** How many rows this carry will insert. */
	toInsert: number;
};

export type YearSetupCarryPlan = {
	/** The EnrollPro school-year id the setup is kept FROM, or null when there is none. */
	sourceYearId: number | null;
	sourceYearLabel: string | null;
	schedulingPolicy: { source: number; targetExisting: number; toInsert: 0 | 1 };
	gradeShiftWindows: YearSetupCarryPartCounts;
	policySpecialEvents: YearSetupCarryPartCounts;
};

export type GradeShiftWindowRow = {
	gradeLevel: number;
	programType: string | null;
	startTime: string;
	endTime: string;
};

export type PolicySpecialEventRow = {
	eventType: string;
	label: string;
	gradeGroup: string | null;
	programType: string | null;
	startTime: string;
	endTime: string;
	enabled: boolean;
	sortOrder: number;
};

/**
 * The packet's `YearSetupCarryPlan` plus the rows themselves, so the apply can
 * insert from the plan it computed INSIDE its own transaction rather than from a
 * second read that could disagree with it.
 */
export type YearSetupCarryPlanWithRows = YearSetupCarryPlan & {
	rows: {
		schedulingPolicy: Record<string, unknown> | null;
		gradeShiftWindows: GradeShiftWindowRow[];
		policySpecialEvents: PolicySpecialEventRow[];
	};
};

export type YearSetupCarryoverResult = {
	plan: YearSetupCarryPlan;
	/** True only when at least one row was actually inserted. */
	applied: boolean;
	/** Null when nothing was copied, so the whole operation is idempotent (R5). */
	auditLogId: number | null;
};

/**
 * R4 — THE EXPLICIT FIELD MAP. `SchedulingPolicy` has ~45 columns including a
 * `constraintConfig` Json, and a wildcard `INSERT ... SELECT` is REFUSED: it
 * would silently copy a column nobody read, and it would not survive a schema
 * change. This list is the model's data columns minus the five that are identity
 * or bookkeeping (`id`, `schoolId`, `schoolYearId`, `createdAt`, `updatedAt`).
 *
 * It is exported because it is also the test's oracle: the S1 row asserts the
 * copied row equals the source on EVERY key here, and a completeness row asserts
 * this list is still exactly the model's data columns — so adding a column to
 * `prisma/schema.prisma` without adding it here turns the suite RED instead of
 * quietly dropping that column from every future carry.
 */
export const SCHEDULING_POLICY_CARRY_COLUMNS = [
	'teacherMoveEnabled',
	'periodLengthMinutes',
	'periodsPerDay',
	'maxConsecutiveTeachingMinutesBeforeBreak',
	'minBreakMinutesAfterConsecutiveBlock',
	'maxTeachingMinutesPerDay',
	'earliestStartTime',
	'latestEndTime',
	'enforceConsecutiveBreakAsHard',
	'enableTravelWellbeingChecks',
	'maxWalkingDistanceMetersPerTransition',
	'maxBuildingTransitionsPerDay',
	'maxBackToBackTransitionsWithoutBuffer',
	'maxIdleGapMinutesPerDay',
	'avoidEarlyFirstPeriod',
	'avoidLateLastPeriod',
	'enableVacantAwareConstraints',
	'targetFacultyDailyVacantMinutes',
	'targetSectionDailyVacantPeriods',
	'maxCompressedTeachingMinutesPerDay',
	'lunchStartTime',
	'lunchEndTime',
	'enforceLunchWindow',
	'showSpecialEventsInGrid',
	'enableFlagCeremony',
	'flagCeremonyStartTime',
	'flagCeremonyEndTime',
	'enableRecess',
	'recessStartTime',
	'recessEndTime',
	'enableLunchWindow',
	'enableTeacherLunchWindow',
	'enforceTeacherLunchWindow',
	'enableShiftCoherenceGuard',
	'enforceShiftCoherenceGuard',
	'enableTleTwoPassPriority',
	'allowFlexibleSubjectAssignment',
	'allowConsecutiveLabSessions',
	'constraintConfig',
	'teachingStandardMinutes',
	'advisoryCreditMinutes',
	'hardCapMinutes',
] as const;

/** Identity and bookkeeping columns R4 excludes from the copy, named explicitly. */
export const SCHEDULING_POLICY_CARRY_EXCLUDED_COLUMNS = [
	'id',
	'schoolId',
	'schoolYearId',
	'createdAt',
	'updatedAt',
] as const;

/** R5 — the one audit action name, named once so the write and the test agree. */
export const YEAR_SETUP_KEPT_AUDIT_ACTION = 'YEAR_SETUP_KEPT_FROM_PREVIOUS_YEAR';

/**
 * R1 — THE FAIL-SAFE, AND THE ONLY INTERPRETER OF THE TWO SWITCHES.
 *
 * Any value that is not literally `false` is `true`. That covers, by
 * construction: `undefined` (field absent), `null`, `{}` (switches object
 * absent), the string `"false"`, `0`, `''`, `NaN`, an array, a function, and any
 * object whose properties are inherited rather than own. Only a caller that
 * deliberately sends the boolean `false` gets an empty new year — and a caller
 * that sends nothing cannot turn the default off by omission.
 */
export function resolveYearSetupCarryOptions(input: unknown): YearSetupCarryOptions {
	const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
	return {
		keepSchedulingRules: raw.keepSchedulingRules !== false,
		keepGradeTimeWindows: raw.keepGradeTimeWindows !== false,
	};
}

type CarryClient = Prisma.TransactionClient | PrismaClient;

const sameProgram = (a: unknown, b: unknown): boolean => (a ?? null) === (b ?? null);

/**
 * R6 + R3 + R4 + R8 — the plan, computed from READS ONLY. Split out from the
 * inserts so `planYearSetupCarryover` is provably a set of reads (S7).
 */
async function planCarry(
	client: CarryClient,
	schoolId: number,
	toYearId: number,
	options: YearSetupCarryOptions,
): Promise<YearSetupCarryPlanWithRows> {
	// The target's own emptiness is read first and unconditionally, so a run with
	// no usable source year still reports a truthful `targetExisting` and copies
	// nothing — rather than reporting a plan that implies the target was empty.
	const [targetPolicy, targetWindows, targetEvents] = await Promise.all([
		client.schedulingPolicy.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId: toYearId } },
		}),
		client.gradeShiftWindow.findMany({
			where: { schoolId, schoolYearId: toYearId },
			select: { gradeLevel: true, programType: true },
		}),
		client.policySpecialEvent.count({ where: { schoolId, schoolYearId: toYearId } }),
	]);
	const emptyRows: YearSetupCarryPlanWithRows['rows'] = {
		schedulingPolicy: null,
		gradeShiftWindows: [],
		policySpecialEvents: [],
	};

	// R6: the most recent OTHER mirrored year, highest EnrollPro year id first.
	// `getLatestAtlasSchoolYearId` is deliberately NOT used: after activation it
	// returns the new year itself, which is the target.
	const candidates = await client.enrollProSchoolYearMirror.findMany({
		where: { schoolId, enrollProSchoolYearId: { not: toYearId } },
		orderBy: { enrollProSchoolYearId: 'desc' },
		select: { enrollProSchoolYearId: true, yearLabel: true },
	});

	let sourceYearId: number | null = null;
	let sourceYearLabel: string | null = null;
	for (const candidate of candidates) {
		const [policies, windows, events] = await Promise.all([
			client.schedulingPolicy.count({ where: { schoolId, schoolYearId: candidate.enrollProSchoolYearId } }),
			client.gradeShiftWindow.count({ where: { schoolId, schoolYearId: candidate.enrollProSchoolYearId } }),
			client.policySpecialEvent.count({ where: { schoolId, schoolYearId: candidate.enrollProSchoolYearId } }),
		]);
		if (policies + windows + events > 0) {
			sourceYearId = candidate.enrollProSchoolYearId;
			sourceYearLabel = candidate.yearLabel;
			break;
		}
	}

	if (sourceYearId == null) {
		return {
			sourceYearId: null,
			sourceYearLabel: null,
			schedulingPolicy: { source: 0, targetExisting: targetPolicy ? 1 : 0, toInsert: 0 },
			gradeShiftWindows: { source: 0, targetExisting: targetWindows.length, toInsert: 0 },
			policySpecialEvents: { source: 0, targetExisting: targetEvents, toInsert: 0 },
			rows: emptyRows,
		};
	}

	// R4 part 1 — the source policy is read whenever the switch is on, so the
	// reported `source` count is truthful even when the target is already full
	// and nothing will be inserted. The copy itself is all-or-nothing: the target
	// year must have NO `scheduling_policies` row at all.
	const sourcePolicy = options.keepSchedulingRules
		? await client.schedulingPolicy.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId: sourceYearId } },
		})
		: null;
	const policyRow: Record<string, unknown> | null = (sourcePolicy != null && targetPolicy == null)
		? Object.fromEntries(SCHEDULING_POLICY_CARRY_COLUMNS.map((column) => [column, sourcePolicy[column] as unknown]))
		: null;

	// R4 part 2 — per `(grade_level, program_type)`, which is also the shape of
	// `uq_grade_shift_window`. This filter is the authority: the unique key backs
	// it up only for a non-NULL `program_type`, because a PostgreSQL unique index
	// treats NULLs as distinct and would therefore permit two NULL-program rows
	// for one `(school_id, school_year_id, grade_level)`.
	const sourceWindows = options.keepGradeTimeWindows
		? await client.gradeShiftWindow.findMany({
			where: { schoolId, schoolYearId: sourceYearId },
			orderBy: [{ gradeLevel: 'asc' }, { programType: 'asc' }],
		})
		: [];
	const windowRows: GradeShiftWindowRow[] = sourceWindows
		.filter((source) => !targetWindows.some((target) => (
			target.gradeLevel === source.gradeLevel && sameProgram(target.programType, source.programType)
		)))
		.map((row) => ({
			gradeLevel: Number(row.gradeLevel),
			programType: (row.programType ?? null) as string | null,
			startTime: String(row.startTime),
			endTime: String(row.endTime),
		}));

	// R4 part 3 — flag ceremonies and special days are all-or-nothing, keyed on
	// the target holding ZERO `policy_special_events` rows.
	const sourceEvents = options.keepGradeTimeWindows
		? await client.policySpecialEvent.findMany({
			where: { schoolId, schoolYearId: sourceYearId },
			orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
		})
		: [];
	const eventRows: PolicySpecialEventRow[] = targetEvents === 0
		? sourceEvents.map((row) => ({
			eventType: String(row.eventType),
			label: String(row.label),
			gradeGroup: (row.gradeGroup ?? null) as string | null,
			programType: (row.programType ?? null) as string | null,
			startTime: String(row.startTime),
			endTime: String(row.endTime),
			enabled: row.enabled === true,
			sortOrder: Number(row.sortOrder ?? 0),
		}))
		: [];

	return {
		sourceYearId,
		sourceYearLabel,
		schedulingPolicy: {
			source: sourcePolicy != null ? 1 : 0,
			targetExisting: targetPolicy ? 1 : 0,
			toInsert: policyRow == null ? 0 : 1,
		},
		gradeShiftWindows: { source: sourceWindows.length, targetExisting: targetWindows.length, toInsert: windowRows.length },
		policySpecialEvents: { source: sourceEvents.length, targetExisting: targetEvents, toInsert: eventRows.length },
		rows: { schedulingPolicy: policyRow, gradeShiftWindows: windowRows, policySpecialEvents: eventRows },
	};
}

/**
 * R8 — the zero-write plan. Exported so the counts can be produced without a
 * write, and so the S7 row can prove it inserts nothing.
 */
export async function planYearSetupCarryover(
	client: CarryClient,
	schoolId: number,
	toYearId: number,
	options?: unknown,
): Promise<YearSetupCarryPlanWithRows> {
	return planCarry(client, schoolId, toYearId, resolveYearSetupCarryOptions(options));
}

/**
 * The one write. ONE `Serializable` transaction that computes the plan INSIDE it
 * and inserts from that same plan — never a plan computed outside and inserted
 * inside, which is how a concurrent rollover would copy a stale target state.
 */
export async function applyYearSetupCarryover(input: {
	schoolId: number;
	toYearId: number;
	actorId: number;
	options?: Partial<YearSetupCarryOptions> | unknown;
}): Promise<YearSetupCarryoverResult> {
	const options = resolveYearSetupCarryOptions(input.options);
	return prisma.$transaction(async (tx) => {
		const plan = await planCarry(tx, input.schoolId, input.toYearId, options);

		if (plan.rows.schedulingPolicy != null) {
			// R4: the create payload is the explicit field map plus the two scope
			// keys. The cast is the price of an enumerated map over a 42-column
			// model, and the S1 completeness row is what keeps it honest.
			const data = {
				schoolId: input.schoolId,
				schoolYearId: input.toYearId,
				...(plan.rows.schedulingPolicy as Record<string, unknown>),
			} as unknown as Prisma.SchedulingPolicyUncheckedCreateInput;
			await tx.schedulingPolicy.create({ data });
		}
		if (plan.rows.gradeShiftWindows.length > 0) {
			const data = plan.rows.gradeShiftWindows.map((row) => ({
				schoolId: input.schoolId,
				schoolYearId: input.toYearId,
				gradeLevel: row.gradeLevel,
				programType: row.programType,
				startTime: row.startTime,
				endTime: row.endTime,
			})) as unknown as Prisma.GradeShiftWindowCreateManyInput[];
			await tx.gradeShiftWindow.createMany({ data });
		}
		if (plan.rows.policySpecialEvents.length > 0) {
			const data = plan.rows.policySpecialEvents.map((row) => ({
				schoolId: input.schoolId,
				schoolYearId: input.toYearId,
				eventType: row.eventType,
				label: row.label,
				gradeGroup: row.gradeGroup,
				programType: row.programType,
				startTime: row.startTime,
				endTime: row.endTime,
				enabled: row.enabled,
				sortOrder: row.sortOrder,
			})) as unknown as Prisma.PolicySpecialEventCreateManyInput[];
			await tx.policySpecialEvent.createMany({ data });
		}

		// R5: the audit row exists only when a row was actually inserted, so a
		// re-run writes nothing at all — not even an audit line.
		const inserted = plan.schedulingPolicy.toInsert
			+ plan.gradeShiftWindows.toInsert
			+ plan.policySpecialEvents.toInsert;
		if (inserted === 0) return { plan, applied: false, auditLogId: null };

		const audit = await tx.auditLog.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.toYearId,
				action: YEAR_SETUP_KEPT_AUDIT_ACTION,
				actorId: input.actorId,
				targetIds: [input.toYearId],
				metadata: {
					sourceYearId: plan.sourceYearId,
					sourceYearLabel: plan.sourceYearLabel,
					keepSchedulingRules: options.keepSchedulingRules,
					keepGradeTimeWindows: options.keepGradeTimeWindows,
					schedulingPolicyInserted: plan.schedulingPolicy.toInsert,
					gradeShiftWindowsInserted: plan.gradeShiftWindows.toInsert,
					policySpecialEventsInserted: plan.policySpecialEvents.toInsert,
				},
			},
		});
		return { plan, applied: true, auditLogId: audit.id };
	}, { isolationLevel: 'Serializable' });
}
