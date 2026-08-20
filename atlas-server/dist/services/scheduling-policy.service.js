/**
 * Scheduling policy service — CRUD and default-fallback for school/year policy.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
// ─── Helpers ───
function err(statusCode, code, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    return e;
}
export function computeEffectiveWeeklyTeachingMinutes(maxHoursPerWeek, ancillaryMinutesPerWeek) {
    const baseMinutes = Math.max(0, Math.round(maxHoursPerWeek * 60));
    const deduction = Math.max(0, Math.round(ancillaryMinutesPerWeek ?? 0));
    return Math.max(0, baseMinutes - deduction);
}
export async function validateAncillaryLoadImmutable(facultyId, nextAncillaryMinutesPerWeek, nextAncillaryLoadSource) {
    if (nextAncillaryMinutesPerWeek === undefined && nextAncillaryLoadSource === undefined) {
        return;
    }
    const current = await prisma.facultyMirror.findUnique({
        where: { id: facultyId },
        select: {
            ancillaryMinutesPerWeek: true,
            ancillaryLoadSource: true,
        },
    });
    if (!current) {
        throw err(404, 'FACULTY_NOT_FOUND', 'Faculty mirror not found.');
    }
    if (current.ancillaryLoadSource !== 'HR') {
        return;
    }
    const requestedMinutes = nextAncillaryMinutesPerWeek ?? current.ancillaryMinutesPerWeek;
    const requestedSource = nextAncillaryLoadSource ?? current.ancillaryLoadSource;
    if (requestedMinutes !== current.ancillaryMinutesPerWeek || requestedSource !== current.ancillaryLoadSource) {
        throw err(409, 'ANCILLARY_LOAD_IMMUTABLE', 'Ancillary load is managed by HR sync and cannot be edited locally.');
    }
}
// ─── Default values ───
export const POLICY_DEFAULTS = {
    teacherMoveEnabled: true,
    periodLengthMinutes: 45,
    periodsPerDay: 10,
    maxConsecutiveTeachingMinutesBeforeBreak: 120,
    minBreakMinutesAfterConsecutiveBlock: 15,
    maxTeachingMinutesPerDay: 480,
    earliestStartTime: '06:00',
    latestEndTime: '18:30',
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
    showSpecialEventsInGrid: true,
    enableFlagCeremony: true,
    flagCeremonyStartTime: '07:00',
    flagCeremonyEndTime: '07:30',
    enableRecess: true,
    recessStartTime: '09:45',
    recessEndTime: '10:00',
    enableLunchWindow: true,
    enableTleTwoPassPriority: true,
    allowFlexibleSubjectAssignment: false,
    allowConsecutiveLabSessions: false,
};
/**
 * Canonical generator/validator contract for which wellbeing limits block placement.
 * Daily hard ceiling never exceeds the baseline 8-hour cap; consecutive/break hardness
 * follows the explicit policy switch.
 */
export function resolvePolicyPlacementSemantics(policy) {
    const hardDailyLimitMinutes = Math.min(Math.max(0, Math.round(policy.maxTeachingMinutesPerDay)), POLICY_DEFAULTS.maxTeachingMinutesPerDay);
    return {
        hardDailyLimitMinutes,
        enforceConsecutiveBreakAsHard: policy.enforceConsecutiveBreakAsHard === true,
    };
}
export const DEFAULT_CONSTRAINT_CONFIG = {
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
    SESSION_PATTERN_VIOLATED: { enabled: true, weight: 3, treatAsHard: false },
    ROOM_CAPACITY_EXCEEDED: { enabled: true, weight: 5, treatAsHard: false },
};
// ─── Validation ───
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const STANDARD_PERIOD_MINUTES = 50;
function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}
function minutesToTime(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function overlapsWindow(left, right) {
    return left.start < right.end && right.start < left.end;
}
export function validatePolicyInput(input) {
    const errors = [];
    // --- ints ---
    function requirePositiveInt(val, name, min, max, fallback) {
        if (val === undefined || val === null)
            return fallback;
        const n = Number(val);
        if (!Number.isInteger(n) || n < min || n > max) {
            errors.push(`${name} must be an integer between ${min} and ${max}.`);
            return fallback;
        }
        return n;
    }
    const maxConsecutive = requirePositiveInt(input.maxConsecutiveTeachingMinutesBeforeBreak, 'maxConsecutiveTeachingMinutesBeforeBreak', 30, 600, POLICY_DEFAULTS.maxConsecutiveTeachingMinutesBeforeBreak);
    const minBreak = requirePositiveInt(input.minBreakMinutesAfterConsecutiveBlock, 'minBreakMinutesAfterConsecutiveBlock', 5, 120, POLICY_DEFAULTS.minBreakMinutesAfterConsecutiveBlock);
    const maxDaily = requirePositiveInt(input.maxTeachingMinutesPerDay, 'maxTeachingMinutesPerDay', 60, 600, POLICY_DEFAULTS.maxTeachingMinutesPerDay);
    const periodLengthMinutes = requirePositiveInt(input.periodLengthMinutes, 'periodLengthMinutes', 30, 90, POLICY_DEFAULTS.periodLengthMinutes);
    const periodsPerDay = requirePositiveInt(input.periodsPerDay, 'periodsPerDay', 4, 12, POLICY_DEFAULTS.periodsPerDay);
    // --- times ---
    function requireTime(val, name, fallback) {
        if (val === undefined || val === null)
            return fallback;
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
    if (errors.length === 0 && latestMinutes - earliestMinutes < periodLengthMinutes) {
        errors.push(`The schedule window must be at least ${periodLengthMinutes} minutes to fit one class period.`);
    }
    // --- bool ---
    let teacherMoveEnabled = POLICY_DEFAULTS.teacherMoveEnabled;
    if (input.teacherMoveEnabled !== undefined && input.teacherMoveEnabled !== null) {
        if (typeof input.teacherMoveEnabled !== 'boolean') {
            errors.push('teacherMoveEnabled must be a boolean.');
        }
        else {
            teacherMoveEnabled = input.teacherMoveEnabled;
        }
    }
    let enforceHard = POLICY_DEFAULTS.enforceConsecutiveBreakAsHard;
    if (input.enforceConsecutiveBreakAsHard !== undefined && input.enforceConsecutiveBreakAsHard !== null) {
        if (typeof input.enforceConsecutiveBreakAsHard !== 'boolean') {
            errors.push('enforceConsecutiveBreakAsHard must be a boolean.');
        }
        else {
            enforceHard = input.enforceConsecutiveBreakAsHard;
        }
    }
    let enableTravel = POLICY_DEFAULTS.enableTravelWellbeingChecks;
    if (input.enableTravelWellbeingChecks !== undefined && input.enableTravelWellbeingChecks !== null) {
        if (typeof input.enableTravelWellbeingChecks !== 'boolean') {
            errors.push('enableTravelWellbeingChecks must be a boolean.');
        }
        else {
            enableTravel = input.enableTravelWellbeingChecks;
        }
    }
    const maxWalkingDistance = requirePositiveInt(input.maxWalkingDistanceMetersPerTransition, 'maxWalkingDistanceMetersPerTransition', 10, 1000, POLICY_DEFAULTS.maxWalkingDistanceMetersPerTransition);
    const maxTransitions = requirePositiveInt(input.maxBuildingTransitionsPerDay, 'maxBuildingTransitionsPerDay', 1, 20, POLICY_DEFAULTS.maxBuildingTransitionsPerDay);
    const maxB2B = requirePositiveInt(input.maxBackToBackTransitionsWithoutBuffer, 'maxBackToBackTransitionsWithoutBuffer', 1, 10, POLICY_DEFAULTS.maxBackToBackTransitionsWithoutBuffer);
    const maxIdleGap = requirePositiveInt(input.maxIdleGapMinutesPerDay, 'maxIdleGapMinutesPerDay', 10, 300, POLICY_DEFAULTS.maxIdleGapMinutesPerDay);
    // --- booleans (avoidEarly/Late) ---
    let avoidEarly = POLICY_DEFAULTS.avoidEarlyFirstPeriod;
    if (input.avoidEarlyFirstPeriod !== undefined && input.avoidEarlyFirstPeriod !== null) {
        if (typeof input.avoidEarlyFirstPeriod !== 'boolean') {
            errors.push('avoidEarlyFirstPeriod must be a boolean.');
        }
        else {
            avoidEarly = input.avoidEarlyFirstPeriod;
        }
    }
    let avoidLate = POLICY_DEFAULTS.avoidLateLastPeriod;
    if (input.avoidLateLastPeriod !== undefined && input.avoidLateLastPeriod !== null) {
        if (typeof input.avoidLateLastPeriod !== 'boolean') {
            errors.push('avoidLateLastPeriod must be a boolean.');
        }
        else {
            avoidLate = input.avoidLateLastPeriod;
        }
    }
    // --- vacant-aware booleans and ints ---
    let enableVacant = POLICY_DEFAULTS.enableVacantAwareConstraints;
    if (input.enableVacantAwareConstraints !== undefined && input.enableVacantAwareConstraints !== null) {
        if (typeof input.enableVacantAwareConstraints !== 'boolean') {
            errors.push('enableVacantAwareConstraints must be a boolean.');
        }
        else {
            enableVacant = input.enableVacantAwareConstraints;
        }
    }
    const targetFacultyVacant = requirePositiveInt(input.targetFacultyDailyVacantMinutes, 'targetFacultyDailyVacantMinutes', 0, 300, POLICY_DEFAULTS.targetFacultyDailyVacantMinutes);
    const targetSectionVacant = requirePositiveInt(input.targetSectionDailyVacantPeriods, 'targetSectionDailyVacantPeriods', 0, 10, POLICY_DEFAULTS.targetSectionDailyVacantPeriods);
    const maxCompressedPerDay = requirePositiveInt(input.maxCompressedTeachingMinutesPerDay, 'maxCompressedTeachingMinutesPerDay', 60, 600, POLICY_DEFAULTS.maxCompressedTeachingMinutesPerDay);
    // --- lunch window ---
    let enforceLunch = POLICY_DEFAULTS.enforceLunchWindow;
    if (input.enforceLunchWindow !== undefined && input.enforceLunchWindow !== null) {
        if (typeof input.enforceLunchWindow !== 'boolean') {
            errors.push('enforceLunchWindow must be a boolean.');
        }
        else {
            enforceLunch = input.enforceLunchWindow;
        }
    }
    let enableLunchWindow = POLICY_DEFAULTS.enableLunchWindow;
    if (input.enableLunchWindow !== undefined && input.enableLunchWindow !== null) {
        if (typeof input.enableLunchWindow !== 'boolean') {
            errors.push('enableLunchWindow must be a boolean.');
        }
        else {
            enableLunchWindow = input.enableLunchWindow;
        }
    }
    // Backward-compat: when either flag is provided, keep them in sync.
    enableLunchWindow = input.enableLunchWindow !== undefined || input.enforceLunchWindow === undefined
        ? enableLunchWindow
        : enforceLunch;
    enforceLunch = enableLunchWindow;
    let showSpecialEventsInGrid = POLICY_DEFAULTS.showSpecialEventsInGrid;
    if (input.showSpecialEventsInGrid !== undefined && input.showSpecialEventsInGrid !== null) {
        if (typeof input.showSpecialEventsInGrid !== 'boolean') {
            errors.push('showSpecialEventsInGrid must be a boolean.');
        }
        else {
            showSpecialEventsInGrid = input.showSpecialEventsInGrid;
        }
    }
    let enableFlagCeremony = POLICY_DEFAULTS.enableFlagCeremony;
    if (input.enableFlagCeremony !== undefined && input.enableFlagCeremony !== null) {
        if (typeof input.enableFlagCeremony !== 'boolean') {
            errors.push('enableFlagCeremony must be a boolean.');
        }
        else {
            enableFlagCeremony = input.enableFlagCeremony;
        }
    }
    const flagCeremonyStartTime = requireTime(input.flagCeremonyStartTime, 'flagCeremonyStartTime', POLICY_DEFAULTS.flagCeremonyStartTime);
    const flagCeremonyEndTime = requireTime(input.flagCeremonyEndTime, 'flagCeremonyEndTime', POLICY_DEFAULTS.flagCeremonyEndTime);
    let enableRecess = POLICY_DEFAULTS.enableRecess;
    if (input.enableRecess !== undefined && input.enableRecess !== null) {
        if (typeof input.enableRecess !== 'boolean') {
            errors.push('enableRecess must be a boolean.');
        }
        else {
            enableRecess = input.enableRecess;
        }
    }
    const recessStartTime = requireTime(input.recessStartTime, 'recessStartTime', POLICY_DEFAULTS.recessStartTime);
    const recessEndTime = requireTime(input.recessEndTime, 'recessEndTime', POLICY_DEFAULTS.recessEndTime);
    const flagWithinBounds = timeToMinutes(flagCeremonyEndTime) > earliestMinutes && timeToMinutes(flagCeremonyStartTime) < latestMinutes;
    const recessWithinBounds = timeToMinutes(recessEndTime) > earliestMinutes && timeToMinutes(recessStartTime) < latestMinutes;
    enableFlagCeremony = enableFlagCeremony && flagWithinBounds;
    enableRecess = enableRecess && recessWithinBounds;
    let lunchStart = requireTime(input.lunchStartTime, 'lunchStartTime', POLICY_DEFAULTS.lunchStartTime);
    let lunchEnd = requireTime(input.lunchEndTime, 'lunchEndTime', POLICY_DEFAULTS.lunchEndTime);
    let lunchStartMinutes = timeToMinutes(lunchStart);
    let lunchEndMinutes = timeToMinutes(lunchEnd);
    // Normalize lunch window against schedule bounds for robust "half-day" policies.
    // If it cannot fit, gracefully disable lunch enforcement instead of failing save.
    if (errors.length === 0 && enableLunchWindow) {
        lunchStartMinutes = Math.max(lunchStartMinutes, earliestMinutes);
        lunchEndMinutes = Math.min(lunchEndMinutes, latestMinutes);
        if (lunchStartMinutes >= lunchEndMinutes) {
            enableLunchWindow = false;
            enforceLunch = false;
        }
        else {
            lunchStart = minutesToTime(lunchStartMinutes);
            lunchEnd = minutesToTime(lunchEndMinutes);
        }
    }
    if (errors.length === 0) {
        const lunchMinutes = enableLunchWindow ? Math.max(0, lunchEndMinutes - lunchStartMinutes) : 0;
        const effectiveTeachingWindowMinutes = latestMinutes - earliestMinutes - lunchMinutes;
        if (effectiveTeachingWindowMinutes < STANDARD_PERIOD_MINUTES) {
            errors.push(`Policy leaves only ${effectiveTeachingWindowMinutes} effective teaching minutes, which is below one period (${STANDARD_PERIOD_MINUTES} minutes).`);
        }
    }
    if (errors.length === 0) {
        const windows = [
            {
                enabled: enableFlagCeremony,
                startTime: flagCeremonyStartTime,
                endTime: flagCeremonyEndTime,
            },
            {
                enabled: enableRecess,
                startTime: recessStartTime,
                endTime: recessEndTime,
            },
            {
                enabled: enableLunchWindow,
                startTime: lunchStart,
                endTime: lunchEnd,
            },
        ];
        for (const [index, windowDef] of windows.entries()) {
            if (!windowDef.enabled)
                continue;
            const start = timeToMinutes(windowDef.startTime);
            const end = timeToMinutes(windowDef.endTime);
            if (start >= end) {
                errors.push(`Special event window #${index + 1} must have startTime before endTime.`);
            }
            if (end <= earliestMinutes || start >= latestMinutes)
                continue;
        }
        const enabledWindows = windows
            .filter((windowDef) => windowDef.enabled)
            .map((windowDef) => ({
            start: timeToMinutes(windowDef.startTime),
            end: timeToMinutes(windowDef.endTime),
        }));
        for (let index = 0; index < enabledWindows.length; index++) {
            for (let nextIndex = index + 1; nextIndex < enabledWindows.length; nextIndex++) {
                if (overlapsWindow(enabledWindows[index], enabledWindows[nextIndex])) {
                    errors.push('Special event windows must not overlap each other.');
                }
            }
        }
    }
    // --- TLE two-pass priority ---
    let enableTleTwoPass = POLICY_DEFAULTS.enableTleTwoPassPriority;
    if (input.enableTleTwoPassPriority !== undefined && input.enableTleTwoPassPriority !== null) {
        if (typeof input.enableTleTwoPassPriority !== 'boolean') {
            errors.push('enableTleTwoPassPriority must be a boolean.');
        }
        else {
            enableTleTwoPass = input.enableTleTwoPassPriority;
        }
    }
    // --- Flexible subject assignment ---
    let allowFlexibleAssignment = POLICY_DEFAULTS.allowFlexibleSubjectAssignment;
    if (input.allowFlexibleSubjectAssignment !== undefined && input.allowFlexibleSubjectAssignment !== null) {
        if (typeof input.allowFlexibleSubjectAssignment !== 'boolean') {
            errors.push('allowFlexibleSubjectAssignment must be a boolean.');
        }
        else {
            allowFlexibleAssignment = input.allowFlexibleSubjectAssignment;
        }
    }
    // --- Consecutive lab sessions ---
    let allowConsecutiveLab = POLICY_DEFAULTS.allowConsecutiveLabSessions;
    if (input.allowConsecutiveLabSessions !== undefined && input.allowConsecutiveLabSessions !== null) {
        if (typeof input.allowConsecutiveLabSessions !== 'boolean') {
            errors.push('allowConsecutiveLabSessions must be a boolean.');
        }
        else {
            allowConsecutiveLab = input.allowConsecutiveLabSessions;
        }
    }
    // --- constraintConfig (JSON object) ---
    let constraintConfig = null;
    if (input.constraintConfig !== undefined && input.constraintConfig !== null) {
        if (typeof input.constraintConfig !== 'object' || Array.isArray(input.constraintConfig)) {
            errors.push('constraintConfig must be a JSON object.');
        }
        else {
            constraintConfig = {};
            for (const [key, val] of Object.entries(input.constraintConfig)) {
                if (typeof val !== 'object' || val === null || Array.isArray(val)) {
                    errors.push(`constraintConfig.${key} must be an object with { enabled, weight, treatAsHard }.`);
                    continue;
                }
                const v = val;
                const enabled = typeof v.enabled === 'boolean' ? v.enabled : true;
                const weight = typeof v.weight === 'number' && v.weight >= 1 && v.weight <= 10 ? v.weight : 5;
                const treatAsHard = typeof v.treatAsHard === 'boolean' ? v.treatAsHard : false;
                constraintConfig[key] = { enabled, weight, treatAsHard };
            }
        }
    }
    return {
        data: {
            teacherMoveEnabled,
            periodLengthMinutes,
            periodsPerDay,
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
            enforceLunchWindow: enableLunchWindow,
            showSpecialEventsInGrid,
            enableFlagCeremony,
            flagCeremonyStartTime,
            flagCeremonyEndTime,
            enableRecess,
            recessStartTime,
            recessEndTime,
            enableLunchWindow,
            enableTleTwoPassPriority: enableTleTwoPass,
            allowFlexibleSubjectAssignment: allowFlexibleAssignment,
            allowConsecutiveLabSessions: allowConsecutiveLab,
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
const SCHEMA_DRIFT_CODES = new Set(['P2021', 'P2022']);
const SCHEMA_DRIFT_MSG = /column .* does not exist|relation .* does not exist|undefined column/i;
let schemaDriftWarned = false;
let ensureColumnsPromise = null;
function isSchemaDriftError(e) {
    if (!e || typeof e !== 'object')
        return false;
    const err = e;
    if (err.code && SCHEMA_DRIFT_CODES.has(err.code))
        return true;
    const msg = err.meta?.message ?? err.message ?? '';
    // P2010 is generic "raw query failed"; treat as schema drift only when message proves drift.
    if (err.code === 'P2010') {
        return SCHEMA_DRIFT_MSG.test(msg);
    }
    return SCHEMA_DRIFT_MSG.test(msg);
}
/**
 * Build a synthetic in-memory policy from defaults.
 * Used as fallback when the DB schema is behind and `findUnique`/`create` fails.
 */
function buildSyntheticPolicy(schoolId, schoolYearId) {
    return {
        id: -1,
        schoolId,
        schoolYearId,
        ...POLICY_DEFAULTS,
        constraintConfig: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}
function normalizeRoomCapacityConstraintConfig(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return config;
    }
    const root = config;
    const roomCapacityOverride = root.ROOM_CAPACITY_EXCEEDED;
    if (!roomCapacityOverride || typeof roomCapacityOverride !== 'object' || Array.isArray(roomCapacityOverride)) {
        return config;
    }
    const normalizedOverride = roomCapacityOverride;
    if (normalizedOverride.treatAsHard === false) {
        return config;
    }
    return {
        ...root,
        ROOM_CAPACITY_EXCEEDED: {
            enabled: typeof normalizedOverride.enabled === 'boolean' ? normalizedOverride.enabled : true,
            weight: typeof normalizedOverride.weight === 'number' ? normalizedOverride.weight : 5,
            treatAsHard: false,
        },
    };
}
/**
 * Best-effort runtime healing for policy schema drift.
 * Handles cases where migration history says "up to date" but columns are missing.
 */
async function ensureSchedulingPolicyColumns() {
    if (!ensureColumnsPromise) {
        ensureColumnsPromise = (async () => {
            await prisma.$executeRawUnsafe(`
				CREATE TABLE IF NOT EXISTS "scheduling_policies" (
					"id" SERIAL PRIMARY KEY,
					"school_id" INTEGER NOT NULL,
					"school_year_id" INTEGER NOT NULL,
					"teacher_move_enabled" BOOLEAN NOT NULL DEFAULT true,
					"period_length_minutes" INTEGER NOT NULL DEFAULT 45,
					"periods_per_day" INTEGER NOT NULL DEFAULT 10,
					"max_consecutive_teaching_minutes_before_break" INTEGER NOT NULL DEFAULT 120,
					"min_break_minutes_after_consecutive_block" INTEGER NOT NULL DEFAULT 15,
					"max_teaching_minutes_per_day" INTEGER NOT NULL DEFAULT 480,
					"earliest_start_time" TEXT NOT NULL DEFAULT '06:00',
					"latest_end_time" TEXT NOT NULL DEFAULT '18:00',
					"enforce_consecutive_break_as_hard" BOOLEAN NOT NULL DEFAULT false,
					"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
				);
			`);
            await prisma.$executeRawUnsafe(`
				ALTER TABLE "scheduling_policies"
				ADD COLUMN IF NOT EXISTS "teacher_move_enabled" BOOLEAN NOT NULL DEFAULT true,
				ADD COLUMN IF NOT EXISTS "period_length_minutes" INTEGER NOT NULL DEFAULT 45,
				ADD COLUMN IF NOT EXISTS "periods_per_day" INTEGER NOT NULL DEFAULT 10,
				ADD COLUMN IF NOT EXISTS "max_consecutive_teaching_minutes_before_break" INTEGER NOT NULL DEFAULT 120,
				ADD COLUMN IF NOT EXISTS "min_break_minutes_after_consecutive_block" INTEGER NOT NULL DEFAULT 15,
				ADD COLUMN IF NOT EXISTS "max_teaching_minutes_per_day" INTEGER NOT NULL DEFAULT 480,
				ADD COLUMN IF NOT EXISTS "earliest_start_time" TEXT NOT NULL DEFAULT '06:00',
				ADD COLUMN IF NOT EXISTS "latest_end_time" TEXT NOT NULL DEFAULT '18:00',
				ADD COLUMN IF NOT EXISTS "enforce_consecutive_break_as_hard" BOOLEAN NOT NULL DEFAULT false,
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
				ADD COLUMN IF NOT EXISTS "show_special_events_in_grid" BOOLEAN NOT NULL DEFAULT true,
				ADD COLUMN IF NOT EXISTS "enable_flag_ceremony" BOOLEAN NOT NULL DEFAULT true,
				ADD COLUMN IF NOT EXISTS "flag_ceremony_start_time" TEXT NOT NULL DEFAULT '07:00',
				ADD COLUMN IF NOT EXISTS "flag_ceremony_end_time" TEXT NOT NULL DEFAULT '07:30',
				ADD COLUMN IF NOT EXISTS "enable_recess" BOOLEAN NOT NULL DEFAULT true,
				ADD COLUMN IF NOT EXISTS "recess_start_time" TEXT NOT NULL DEFAULT '09:45',
				ADD COLUMN IF NOT EXISTS "recess_end_time" TEXT NOT NULL DEFAULT '10:00',
				ADD COLUMN IF NOT EXISTS "enable_lunch_window" BOOLEAN NOT NULL DEFAULT true,
				ADD COLUMN IF NOT EXISTS "enable_tle_two_pass_priority" BOOLEAN NOT NULL DEFAULT true,
				ADD COLUMN IF NOT EXISTS "allow_flexible_subject_assignment" BOOLEAN NOT NULL DEFAULT false,
				ADD COLUMN IF NOT EXISTS "allow_consecutive_lab_sessions" BOOLEAN NOT NULL DEFAULT false,
				ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
				ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
			`);
            await prisma.$executeRawUnsafe(`
				CREATE UNIQUE INDEX IF NOT EXISTS "scheduling_policies_school_id_school_year_id_key"
				ON "scheduling_policies" ("school_id", "school_year_id")
			`);
            await prisma.$executeRawUnsafe(`
				UPDATE "scheduling_policies"
				SET "enable_lunch_window" = "enforce_lunch_window"
				WHERE "enable_lunch_window" IS DISTINCT FROM "enforce_lunch_window"
			`);
            await prisma.$executeRawUnsafe(`
				UPDATE "scheduling_policies"
				SET "createdAt" = COALESCE("createdAt", NOW())
				WHERE "createdAt" IS NULL
			`);
            await prisma.$executeRawUnsafe(`
				UPDATE "scheduling_policies"
				SET "updatedAt" = COALESCE("updatedAt", NOW())
				WHERE "updatedAt" IS NULL
			`);
        })().catch((e) => {
            ensureColumnsPromise = null;
            throw e;
        });
    }
    await ensureColumnsPromise;
}
// ─── Get (with default-fallback creation) ───
export async function getOrCreatePolicy(schoolId, schoolYearId) {
    try {
        await ensureSchedulingPolicyColumns();
        const existing = await prisma.schedulingPolicy.findUnique({
            where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
        });
        if (existing) {
            const normalizedConstraintConfig = normalizeRoomCapacityConstraintConfig(existing.constraintConfig);
            if (normalizedConstraintConfig !== existing.constraintConfig && normalizedConstraintConfig != null) {
                return await prisma.schedulingPolicy.update({
                    where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
                    data: { constraintConfig: normalizedConstraintConfig },
                });
            }
            return existing;
        }
        // Auto-create with defaults
        return await prisma.schedulingPolicy.create({
            data: { schoolId, schoolYearId, ...POLICY_DEFAULTS },
        });
    }
    catch (e) {
        if (isSchemaDriftError(e)) {
            if (!schemaDriftWarned) {
                console.warn(`[POLICY_SCHEMA_DRIFT] scheduling_policies table is missing expected columns. ` +
                    `Returning in-memory defaults for school ${schoolId}, year ${schoolYearId}. ` +
                    `Action: run \`npx prisma migrate deploy\` to apply pending migrations.`);
                schemaDriftWarned = true;
            }
            return buildSyntheticPolicy(schoolId, schoolYearId);
        }
        // Re-throw non-drift errors
        throw e;
    }
}
// ─── Upsert ───
export async function upsertPolicy(schoolId, schoolYearId, input) {
    const { data, errors } = validatePolicyInput(input);
    if (errors.length > 0) {
        throw err(400, 'INVALID_POLICY', errors.join(' '));
    }
    const existingWindows = await prisma.gradeShiftWindow.findMany({
        where: { schoolId, schoolYearId },
        select: { gradeLevel: true, programType: true, startTime: true, endTime: true },
    });
    const policyStart = timeToMinutes(data.earliestStartTime);
    const policyEnd = timeToMinutes(data.latestEndTime);
    for (const window of existingWindows) {
        const windowStart = timeToMinutes(window.startTime);
        const windowEnd = timeToMinutes(window.endTime);
        if (windowStart < policyStart || windowEnd > policyEnd) {
            throw err(400, 'POLICY_CONFLICTS_WITH_SHIFT_WINDOWS', `Scheduling policy bounds must include configured grade shift windows${window.programType ? ` for ${window.programType}` : ''}.`);
        }
    }
    // Prisma Json? fields need Prisma.JsonNull instead of plain null
    const constraintConfigValue = data.constraintConfig === null
        ? Prisma.JsonNull
        : data.constraintConfig;
    const prismaData = {
        maxConsecutiveTeachingMinutesBeforeBreak: data.maxConsecutiveTeachingMinutesBeforeBreak,
        minBreakMinutesAfterConsecutiveBlock: data.minBreakMinutesAfterConsecutiveBlock,
        maxTeachingMinutesPerDay: data.maxTeachingMinutesPerDay,
        teacherMoveEnabled: data.teacherMoveEnabled,
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
        showSpecialEventsInGrid: data.showSpecialEventsInGrid,
        enableFlagCeremony: data.enableFlagCeremony,
        flagCeremonyStartTime: data.flagCeremonyStartTime,
        flagCeremonyEndTime: data.flagCeremonyEndTime,
        enableRecess: data.enableRecess,
        recessStartTime: data.recessStartTime,
        recessEndTime: data.recessEndTime,
        enableLunchWindow: data.enableLunchWindow,
        enableTleTwoPassPriority: data.enableTleTwoPassPriority,
        allowFlexibleSubjectAssignment: data.allowFlexibleSubjectAssignment,
        allowConsecutiveLabSessions: data.allowConsecutiveLabSessions,
        constraintConfig: constraintConfigValue,
    };
    try {
        await ensureSchedulingPolicyColumns();
        return await prisma.schedulingPolicy.upsert({
            where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
            create: { schoolId, schoolYearId, ...prismaData },
            update: prismaData,
        });
    }
    catch (e) {
        if (isSchemaDriftError(e)) {
            throw err(503, 'POLICY_SCHEMA_DRIFT', 'Scheduling policy columns are out of date in the database. Run `npx prisma migrate deploy` and retry.');
        }
        throw e;
    }
}
//# sourceMappingURL=scheduling-policy.service.js.map