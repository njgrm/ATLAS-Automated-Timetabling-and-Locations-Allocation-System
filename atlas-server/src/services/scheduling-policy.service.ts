/**
 * Scheduling policy service — CRUD and default-fallback for school/year policy.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';

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
} as const;

// ─── Exported policy shape (for cross-service use) ───

export interface SchedulingPolicyData {
	maxConsecutiveTeachingMinutesBeforeBreak: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	enforceConsecutiveBreakAsHard: boolean;
}

// ─── Validation ───

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

export interface PolicyInput {
	maxConsecutiveTeachingMinutesBeforeBreak?: unknown;
	minBreakMinutesAfterConsecutiveBlock?: unknown;
	maxTeachingMinutesPerDay?: unknown;
	earliestStartTime?: unknown;
	latestEndTime?: unknown;
	enforceConsecutiveBreakAsHard?: unknown;
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

	if (errors.length === 0 && timeToMinutes(earliest) >= timeToMinutes(latest)) {
		errors.push('earliestStartTime must be before latestEndTime.');
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

	return {
		data: {
			maxConsecutiveTeachingMinutesBeforeBreak: maxConsecutive,
			minBreakMinutesAfterConsecutiveBlock: minBreak,
			maxTeachingMinutesPerDay: maxDaily,
			earliestStartTime: earliest,
			latestEndTime: latest,
			enforceConsecutiveBreakAsHard: enforceHard,
		},
		errors,
	};
}

// ─── Get (with default-fallback creation) ───

export async function getOrCreatePolicy(schoolId: number, schoolYearId: number) {
	const existing = await prisma.schedulingPolicy.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
	});
	if (existing) return existing;

	// Auto-create with defaults
	return prisma.schedulingPolicy.create({
		data: { schoolId, schoolYearId, ...POLICY_DEFAULTS },
	});
}

// ─── Upsert ───

export async function upsertPolicy(schoolId: number, schoolYearId: number, input: PolicyInput) {
	const { data, errors } = validatePolicyInput(input);
	if (errors.length > 0) {
		throw err(400, 'INVALID_POLICY', errors.join(' '));
	}

	return prisma.schedulingPolicy.upsert({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		create: { schoolId, schoolYearId, ...data },
		update: data,
	});
}
