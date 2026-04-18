/**
 * Scheduling policy service — CRUD and default-fallback for school/year policy.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

// ─── Helpers ───

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

// ─── Default values ───

export const POLICY_DEFAULTS = {
	maxConsecutiveTeachingMinutesBeforeBreak: 120,
	minBreakMinutesAfterConsecutiveBlock: 15,
	maxTeachingMinutesPerDay: 400,
	earliestStartTime: '07:00',
	latestEndTime: '17:00',
	enforceConsecutiveBreakAsHard: false,
	enableTravelWellbeingChecks: true,
	maxWalkingDistanceMetersPerTransition: 120,
	maxBuildingTransitionsPerDay: 4,
	maxBackToBackTransitionsWithoutBuffer: 2,
	maxIdleGapMinutesPerDay: 60,
	avoidEarlyFirstPeriod: false,
	avoidLateLastPeriod: false,
	enableVacantAwareConstraints: false,
	targetFacultyDailyVacantMinutes: 60,
	targetSectionDailyVacantPeriods: 1,
	maxCompressedTeachingMinutesPerDay: 300,
	lunchStartTime: '11:55',
	lunchEndTime: '12:55',
	enforceLunchWindow: true,
	enableTleTwoPassPriority: true,
	allowFlexibleSubjectAssignment: false,
} as const;

export interface ConstraintOverride {
	enabled: boolean;
	weight: number; // 1–10
	treatAsHard: boolean;
}

export const DEFAULT_CONSTRAINT_CONFIG: Record<string, ConstraintOverride> = {
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: { enabled: true, weight: 5, treatAsHard: false },
	FACULTY_BREAK_REQUIREMENT_VIOLATED: { enabled: true, weight: 5, treatAsHard: false },
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: { enabled: true, weight: 4, treatAsHard: false },
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: { enabled: true, weight: 4, treatAsHard: false },
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: { enabled: true, weight: 3, treatAsHard: false },
	FACULTY_EXCESSIVE_IDLE_GAP: { enabled: true, weight: 3, treatAsHard: false },
	FACULTY_EARLY_START_PREFERENCE: { enabled: false, weight: 2, treatAsHard: false },
	FACULTY_LATE_END_PREFERENCE: { enabled: false, weight: 2, treatAsHard: false },
	FACULTY_INSUFFICIENT_DAILY_VACANT: { enabled: false, weight: 3, treatAsHard: false },
	SECTION_OVERCOMPRESSED: { enabled: false, weight: 3, treatAsHard: false },
};

// ─── Exported policy shape (for cross-service use) ───

export interface SchedulingPolicyData {
	maxConsecutiveTeachingMinutesBeforeBreak: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	enforceConsecutiveBreakAsHard: boolean;
	enableTravelWellbeingChecks: boolean;
	maxWalkingDistanceMetersPerTransition: number;
	maxBuildingTransitionsPerDay: number;
	maxBackToBackTransitionsWithoutBuffer: number;
	maxIdleGapMinutesPerDay: number;
	avoidEarlyFirstPeriod: boolean;
	avoidLateLastPeriod: boolean;
	enableVacantAwareConstraints: boolean;
	targetFacultyDailyVacantMinutes: number;
	targetSectionDailyVacantPeriods: number;
	maxCompressedTeachingMinutesPerDay: number;
	lunchStartTime: string;
	lunchEndTime: string;
	enforceLunchWindow: boolean;
	enableTleTwoPassPriority: boolean;
	allowFlexibleSubjectAssignment: boolean;
	constraintConfig: Record<string, ConstraintOverride> | null;
}

// ─── Validation ───

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const STANDARD_PERIOD_MINUTES = 50;

function timeToMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

function minutesToTime(totalMinutes: number): string {
	const h = Math.floor(totalMinutes / 60);
	const m = totalMinutes % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface PolicyInput {
	maxConsecutiveTeachingMinutesBeforeBreak?: unknown;
	minBreakMinutesAfterConsecutiveBlock?: unknown;
	maxTeachingMinutesPerDay?: unknown;
	earliestStartTime?: unknown;
	latestEndTime?: unknown;
	enforceConsecutiveBreakAsHard?: unknown;
	enableTravelWellbeingChecks?: unknown;
	maxWalkingDistanceMetersPerTransition?: unknown;
	maxBuildingTransitionsPerDay?: unknown;
	maxBackToBackTransitionsWithoutBuffer?: unknown;
	maxIdleGapMinutesPerDay?: unknown;
	avoidEarlyFirstPeriod?: unknown;
	avoidLateLastPeriod?: unknown;
	enableVacantAwareConstraints?: unknown;
	targetFacultyDailyVacantMinutes?: unknown;
	targetSectionDailyVacantPeriods?: unknown;
	maxCompressedTeachingMinutesPerDay?: unknown;
	lunchStartTime?: unknown;
	lunchEndTime?: unknown;
	enforceLunchWindow?: unknown;
	enableTleTwoPassPriority?: unknown;
	allowFlexibleSubjectAssignment?: unknown;
	constraintConfig?: unknown;
}

export function validatePolicyInput(input: PolicyInput): { data: SchedulingPolicyData; errors: string[] } {
	const errors: string[] = [];

	// --- ints ---
	function requirePositiveInt(val: unknown, name: string, min: number, max: number, fallback: number): number {
		if (val === undefined || val === null) return fallback;
		const n = Number(val);
		if (!Number.isInteger(n) || n < min || n > max) {
			errors.push(`${name} must be an integer between ${min} and ${max}.`);
			return fallback;
		}
		return n;
	}

	const maxConsecutive = requirePositiveInt(
		input.maxConsecutiveTeachingMinutesBeforeBreak,
		'maxConsecutiveTeachingMinutesBeforeBreak', 30, 600,
		POLICY_DEFAULTS.maxConsecutiveTeachingMinutesBeforeBreak,
	);
	const minBreak = requirePositiveInt(
		input.minBreakMinutesAfterConsecutiveBlock,
		'minBreakMinutesAfterConsecutiveBlock', 5, 120,
		POLICY_DEFAULTS.minBreakMinutesAfterConsecutiveBlock,
	);
	const maxDaily = requirePositiveInt(
		input.maxTeachingMinutesPerDay,
		'maxTeachingMinutesPerDay', 60, 600,
		POLICY_DEFAULTS.maxTeachingMinutesPerDay,
	);

	// --- times ---
	function requireTime(val: unknown, name: string, fallback: string): string {
		if (val === undefined || val === null) return fallback;
		if (typeof val !== 'string' || !HH_MM.test(val)) {
			errors.push(`${name} must be a valid HH:mm time string.`);
			return fallback;
		}
		return val;
	}

	const earliest = requireTime(input.earliestStartTime, 'earliestStartTime', POLICY_DEFAULTS.earliestStartTime);
	const latest = requireTime(input.latestEndTime, 'latestEndTime', POLICY_DEFAULTS.latestEndTime);

	const earliestMinutes = timeToMinutes(earliest);
	const latestMinutes = timeToMinutes(latest);

	if (errors.length === 0 && earliestMinutes >= latestMinutes) {
		errors.push('earliestStartTime must be before latestEndTime.');
	}
	if (errors.length === 0 && latestMinutes - earliestMinutes < STANDARD_PERIOD_MINUTES) {
		errors.push(
			`The schedule window must be at least ${STANDARD_PERIOD_MINUTES} minutes to fit one class period.`,
		);
	}

	// --- bool ---
	let enforceHard: boolean = POLICY_DEFAULTS.enforceConsecutiveBreakAsHard;
	if (input.enforceConsecutiveBreakAsHard !== undefined && input.enforceConsecutiveBreakAsHard !== null) {
		if (typeof input.enforceConsecutiveBreakAsHard !== 'boolean') {
			errors.push('enforceConsecutiveBreakAsHard must be a boolean.');
		} else {
			enforceHard = input.enforceConsecutiveBreakAsHard;
		}
	}

	let enableTravel: boolean = POLICY_DEFAULTS.enableTravelWellbeingChecks;
	if (input.enableTravelWellbeingChecks !== undefined && input.enableTravelWellbeingChecks !== null) {
		if (typeof input.enableTravelWellbeingChecks !== 'boolean') {
			errors.push('enableTravelWellbeingChecks must be a boolean.');
		} else {
			enableTravel = input.enableTravelWellbeingChecks;
		}
	}

	const maxWalkingDistance = requirePositiveInt(
		input.maxWalkingDistanceMetersPerTransition,
		'maxWalkingDistanceMetersPerTransition', 10, 1000,
		POLICY_DEFAULTS.maxWalkingDistanceMetersPerTransition,
	);
	const maxTransitions = requirePositiveInt(
		input.maxBuildingTransitionsPerDay,
		'maxBuildingTransitionsPerDay', 1, 20,
		POLICY_DEFAULTS.maxBuildingTransitionsPerDay,
	);
	const maxB2B = requirePositiveInt(
		input.maxBackToBackTransitionsWithoutBuffer,
		'maxBackToBackTransitionsWithoutBuffer', 1, 10,
		POLICY_DEFAULTS.maxBackToBackTransitionsWithoutBuffer,
	);

	const maxIdleGap = requirePositiveInt(
		input.maxIdleGapMinutesPerDay,
		'maxIdleGapMinutesPerDay', 10, 300,
		POLICY_DEFAULTS.maxIdleGapMinutesPerDay,
	);

	// --- booleans (avoidEarly/Late) ---
	let avoidEarly: boolean = POLICY_DEFAULTS.avoidEarlyFirstPeriod;
	if (input.avoidEarlyFirstPeriod !== undefined && input.avoidEarlyFirstPeriod !== null) {
		if (typeof input.avoidEarlyFirstPeriod !== 'boolean') {
			errors.push('avoidEarlyFirstPeriod must be a boolean.');
		} else {
			avoidEarly = input.avoidEarlyFirstPeriod;
		}
	}

	let avoidLate: boolean = POLICY_DEFAULTS.avoidLateLastPeriod;
	if (input.avoidLateLastPeriod !== undefined && input.avoidLateLastPeriod !== null) {
		if (typeof input.avoidLateLastPeriod !== 'boolean') {
			errors.push('avoidLateLastPeriod must be a boolean.');
		} else {
			avoidLate = input.avoidLateLastPeriod;
		}
	}

	// --- vacant-aware booleans and ints ---
	let enableVacant: boolean = POLICY_DEFAULTS.enableVacantAwareConstraints;
	if (input.enableVacantAwareConstraints !== undefined && input.enableVacantAwareConstraints !== null) {
		if (typeof input.enableVacantAwareConstraints !== 'boolean') {
			errors.push('enableVacantAwareConstraints must be a boolean.');
		} else {
			enableVacant = input.enableVacantAwareConstraints;
		}
	}

	const targetFacultyVacant = requirePositiveInt(
		input.targetFacultyDailyVacantMinutes,
		'targetFacultyDailyVacantMinutes', 0, 300,
		POLICY_DEFAULTS.targetFacultyDailyVacantMinutes,
	);
	const targetSectionVacant = requirePositiveInt(
		input.targetSectionDailyVacantPeriods,
		'targetSectionDailyVacantPeriods', 0, 10,
		POLICY_DEFAULTS.targetSectionDailyVacantPeriods,
	);
	const maxCompressedPerDay = requirePositiveInt(
		input.maxCompressedTeachingMinutesPerDay,
		'maxCompressedTeachingMinutesPerDay', 60, 600,
		POLICY_DEFAULTS.maxCompressedTeachingMinutesPerDay,
	);

	// --- lunch window ---
	let enforceLunch: boolean = POLICY_DEFAULTS.enforceLunchWindow;
	if (input.enforceLunchWindow !== undefined && input.enforceLunchWindow !== null) {
		if (typeof input.enforceLunchWindow !== 'boolean') {
			errors.push('enforceLunchWindow must be a boolean.');
		} else {
			enforceLunch = input.enforceLunchWindow;
		}
	}
	let lunchStart = requireTime(input.lunchStartTime, 'lunchStartTime', POLICY_DEFAULTS.lunchStartTime);
	let lunchEnd = requireTime(input.lunchEndTime, 'lunchEndTime', POLICY_DEFAULTS.lunchEndTime);

	let lunchStartMinutes = timeToMinutes(lunchStart);
	let lunchEndMinutes = timeToMinutes(lunchEnd);

	// Normalize lunch window against schedule bounds for robust "half-day" policies.
	// If it cannot fit, gracefully disable lunch enforcement instead of failing save.
	if (errors.length === 0 && enforceLunch) {
		lunchStartMinutes = Math.max(lunchStartMinutes, earliestMinutes);
		lunchEndMinutes = Math.min(lunchEndMinutes, latestMinutes);
		if (lunchStartMinutes >= lunchEndMinutes) {
			enforceLunch = false;
		} else {
			lunchStart = minutesToTime(lunchStartMinutes);
			lunchEnd = minutesToTime(lunchEndMinutes);
		}
	}

	if (errors.length === 0) {
		const lunchMinutes = enforceLunch ? Math.max(0, lunchEndMinutes - lunchStartMinutes) : 0;
		const effectiveTeachingWindowMinutes = latestMinutes - earliestMinutes - lunchMinutes;
		if (effectiveTeachingWindowMinutes < STANDARD_PERIOD_MINUTES) {
			errors.push(
				`Policy leaves only ${effectiveTeachingWindowMinutes} effective teaching minutes, which is below one period (${STANDARD_PERIOD_MINUTES} minutes).`,
			);
		}
	}

	// --- TLE two-pass priority ---
	let enableTleTwoPass: boolean = POLICY_DEFAULTS.enableTleTwoPassPriority;
	if (input.enableTleTwoPassPriority !== undefined && input.enableTleTwoPassPriority !== null) {
		if (typeof input.enableTleTwoPassPriority !== 'boolean') {
			errors.push('enableTleTwoPassPriority must be a boolean.');
		} else {
			enableTleTwoPass = input.enableTleTwoPassPriority;
		}
	}

	// --- Flexible subject assignment ---
	let allowFlexibleAssignment: boolean = POLICY_DEFAULTS.allowFlexibleSubjectAssignment;
	if (input.allowFlexibleSubjectAssignment !== undefined && input.allowFlexibleSubjectAssignment !== null) {
		if (typeof input.allowFlexibleSubjectAssignment !== 'boolean') {
			errors.push('allowFlexibleSubjectAssignment must be a boolean.');
		} else {
			allowFlexibleAssignment = input.allowFlexibleSubjectAssignment;
		}
	}

	// --- constraintConfig (JSON object) ---
	let constraintConfig: Record<string, ConstraintOverride> | null = null;
	if (input.constraintConfig !== undefined && input.constraintConfig !== null) {
		if (typeof input.constraintConfig !== 'object' || Array.isArray(input.constraintConfig)) {
			errors.push('constraintConfig must be a JSON object.');
		} else {
			constraintConfig = {} as Record<string, ConstraintOverride>;
			for (const [key, val] of Object.entries(input.constraintConfig as Record<string, unknown>)) {
				if (typeof val !== 'object' || val === null || Array.isArray(val)) {
					errors.push(`constraintConfig.${key} must be an object with { enabled, weight, treatAsHard }.`);
					continue;
				}
				const v = val as Record<string, unknown>;
				const enabled = typeof v.enabled === 'boolean' ? v.enabled : true;
				const weight = typeof v.weight === 'number' && v.weight >= 1 && v.weight <= 10 ? v.weight : 5;
				const treatAsHard = typeof v.treatAsHard === 'boolean' ? v.treatAsHard : false;
				constraintConfig[key] = { enabled, weight, treatAsHard };
			}
		}
	}

	return {
		data: {
			maxConsecutiveTeachingMinutesBeforeBreak: maxConsecutive,
			minBreakMinutesAfterConsecutiveBlock: minBreak,
			maxTeachingMinutesPerDay: maxDaily,
			earliestStartTime: earliest,
			latestEndTime: latest,
			enforceConsecutiveBreakAsHard: enforceHard,
			enableTravelWellbeingChecks: enableTravel,
			maxWalkingDistanceMetersPerTransition: maxWalkingDistance,
			maxBuildingTransitionsPerDay: maxTransitions,
			maxBackToBackTransitionsWithoutBuffer: maxB2B,
			maxIdleGapMinutesPerDay: maxIdleGap,
			avoidEarlyFirstPeriod: avoidEarly,
			avoidLateLastPeriod: avoidLate,
			enableVacantAwareConstraints: enableVacant,
			targetFacultyDailyVacantMinutes: targetFacultyVacant,
			targetSectionDailyVacantPeriods: targetSectionVacant,
			maxCompressedTeachingMinutesPerDay: maxCompressedPerDay,
			lunchStartTime: lunchStart,
			lunchEndTime: lunchEnd,
			enforceLunchWindow: enforceLunch,
			enableTleTwoPassPriority: enableTleTwoPass,
			allowFlexibleSubjectAssignment: allowFlexibleAssignment,
			constraintConfig,
		},
		errors,
	};
}

// ─── Schema-drift detection ───

/**
 * Known Prisma/PG error codes that indicate the DB schema is behind
 * the Prisma client — e.g. a column referenced by the generated query
 * does not exist yet in the actual table.
 *
 * P2010 = raw query failed, P2022 = column not found (Prisma 5+).
 * We also match on the PostgreSQL "column … does not exist" message
 * for generic driver-level errors without a Prisma code.
 */
const SCHEMA_DRIFT_CODES = new Set(['P2010', 'P2022']);
const SCHEMA_DRIFT_MSG = /column .* does not exist|relation .* does not exist|undefined column/i;
let schemaDriftWarned = false;
let ensureColumnsPromise: Promise<void> | null = null;

function isSchemaDriftError(e: unknown): boolean {
	if (!e || typeof e !== 'object') return false;
	const err = e as { code?: string; message?: string; meta?: { message?: string } };
	if (err.code && SCHEMA_DRIFT_CODES.has(err.code)) return true;
	const msg = err.meta?.message ?? err.message ?? '';
	return SCHEMA_DRIFT_MSG.test(msg);
}

/**
 * Build a synthetic in-memory policy from defaults.
 * Used as fallback when the DB schema is behind and `findUnique`/`create` fails.
 */
function buildSyntheticPolicy(schoolId: number, schoolYearId: number) {
	return {
		id: -1,
		schoolId,
		schoolYearId,
		...POLICY_DEFAULTS,
		constraintConfig: null as unknown as null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

/**
 * Best-effort runtime healing for policy schema drift.
 * Handles cases where migration history says "up to date" but columns are missing.
 */
async function ensureSchedulingPolicyColumns(): Promise<void> {
	if (!ensureColumnsPromise) {
		ensureColumnsPromise = (async () => {
			await prisma.$executeRawUnsafe(`
				ALTER TABLE "scheduling_policies"
				ADD COLUMN IF NOT EXISTS "enable_travel_wellbeing_checks" BOOLEAN NOT NULL DEFAULT true,
				ADD COLUMN IF NOT EXISTS "max_walking_distance_meters_per_transition" INTEGER NOT NULL DEFAULT 120,
				ADD COLUMN IF NOT EXISTS "max_building_transitions_per_day" INTEGER NOT NULL DEFAULT 4,
				ADD COLUMN IF NOT EXISTS "max_back_to_back_transitions_without_buffer" INTEGER NOT NULL DEFAULT 2,
				ADD COLUMN IF NOT EXISTS "max_idle_gap_minutes_per_day" INTEGER NOT NULL DEFAULT 60,
				ADD COLUMN IF NOT EXISTS "avoid_early_first_period" BOOLEAN NOT NULL DEFAULT false,
				ADD COLUMN IF NOT EXISTS "avoid_late_last_period" BOOLEAN NOT NULL DEFAULT false,
				ADD COLUMN IF NOT EXISTS "constraint_config" JSONB,
				ADD COLUMN IF NOT EXISTS "enable_vacant_aware_constraints" BOOLEAN NOT NULL DEFAULT false,
				ADD COLUMN IF NOT EXISTS "target_faculty_daily_vacant_minutes" INTEGER NOT NULL DEFAULT 60,
				ADD COLUMN IF NOT EXISTS "target_section_daily_vacant_periods" INTEGER NOT NULL DEFAULT 1,
				ADD COLUMN IF NOT EXISTS "max_compressed_teaching_minutes_per_day" INTEGER NOT NULL DEFAULT 300,
				ADD COLUMN IF NOT EXISTS "lunch_start_time" TEXT NOT NULL DEFAULT '11:55',
				ADD COLUMN IF NOT EXISTS "lunch_end_time" TEXT NOT NULL DEFAULT '12:55',
				ADD COLUMN IF NOT EXISTS "enforce_lunch_window" BOOLEAN NOT NULL DEFAULT true,
				ADD COLUMN IF NOT EXISTS "enable_tle_two_pass_priority" BOOLEAN NOT NULL DEFAULT true,
				ADD COLUMN IF NOT EXISTS "allow_flexible_subject_assignment" BOOLEAN NOT NULL DEFAULT false;
			`);
		})().catch((e) => {
			ensureColumnsPromise = null;
			throw e;
		});
	}
	await ensureColumnsPromise;
}

// ─── Get (with default-fallback creation) ───

export async function getOrCreatePolicy(schoolId: number, schoolYearId: number) {
	try {
		await ensureSchedulingPolicyColumns();
		const existing = await prisma.schedulingPolicy.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		});
		if (existing) return existing;

		// Auto-create with defaults
		return await prisma.schedulingPolicy.create({
			data: { schoolId, schoolYearId, ...POLICY_DEFAULTS },
		});
	} catch (e: unknown) {
		if (isSchemaDriftError(e)) {
			if (!schemaDriftWarned) {
				console.warn(
					`[POLICY_SCHEMA_DRIFT] scheduling_policies table is missing expected columns. ` +
					`Returning in-memory defaults for school ${schoolId}, year ${schoolYearId}. ` +
					`Action: run \`npx prisma migrate deploy\` to apply pending migrations.`,
				);
				schemaDriftWarned = true;
			}
			return buildSyntheticPolicy(schoolId, schoolYearId);
		}
		// Re-throw non-drift errors
		throw e;
	}
}

// ─── Upsert ───

export async function upsertPolicy(schoolId: number, schoolYearId: number, input: PolicyInput) {
	const { data, errors } = validatePolicyInput(input);
	if (errors.length > 0) {
		throw err(400, 'INVALID_POLICY', errors.join(' '));
	}

	// Prisma Json? fields need Prisma.JsonNull instead of plain null
	const constraintConfigValue = data.constraintConfig === null
		? Prisma.JsonNull
		: (data.constraintConfig as unknown as Prisma.InputJsonValue);

	const prismaData = {
		maxConsecutiveTeachingMinutesBeforeBreak: data.maxConsecutiveTeachingMinutesBeforeBreak,
		minBreakMinutesAfterConsecutiveBlock: data.minBreakMinutesAfterConsecutiveBlock,
		maxTeachingMinutesPerDay: data.maxTeachingMinutesPerDay,
		earliestStartTime: data.earliestStartTime,
		latestEndTime: data.latestEndTime,
		enforceConsecutiveBreakAsHard: data.enforceConsecutiveBreakAsHard,
		enableTravelWellbeingChecks: data.enableTravelWellbeingChecks,
		maxWalkingDistanceMetersPerTransition: data.maxWalkingDistanceMetersPerTransition,
		maxBuildingTransitionsPerDay: data.maxBuildingTransitionsPerDay,
		maxBackToBackTransitionsWithoutBuffer: data.maxBackToBackTransitionsWithoutBuffer,
		maxIdleGapMinutesPerDay: data.maxIdleGapMinutesPerDay,
		avoidEarlyFirstPeriod: data.avoidEarlyFirstPeriod,
		avoidLateLastPeriod: data.avoidLateLastPeriod,
		enableVacantAwareConstraints: data.enableVacantAwareConstraints,
		targetFacultyDailyVacantMinutes: data.targetFacultyDailyVacantMinutes,
		targetSectionDailyVacantPeriods: data.targetSectionDailyVacantPeriods,
		maxCompressedTeachingMinutesPerDay: data.maxCompressedTeachingMinutesPerDay,
		lunchStartTime: data.lunchStartTime,
		lunchEndTime: data.lunchEndTime,
		enforceLunchWindow: data.enforceLunchWindow,
		enableTleTwoPassPriority: data.enableTleTwoPassPriority,
		allowFlexibleSubjectAssignment: data.allowFlexibleSubjectAssignment,
		constraintConfig: constraintConfigValue,
	};

	try {
		await ensureSchedulingPolicyColumns();
		return await prisma.schedulingPolicy.upsert({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
			create: { schoolId, schoolYearId, ...prismaData },
			update: prismaData,
		});
	} catch (e: unknown) {
		if (isSchemaDriftError(e)) {
			throw err(
				503,
				'POLICY_SCHEMA_DRIFT',
				'Scheduling policy columns are out of date in the database. Run `npx prisma migrate deploy` and retry.',
			);
		}
		throw e;
	}
}
