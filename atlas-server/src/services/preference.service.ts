/**
 * Preference service — faculty preference CRUD and officer monitoring.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';
import type { DayOfWeek, TimeSlotPreference, PreferenceStatus } from '@prisma/client';

// ─── Types ───

export interface TimeSlotInput {
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	preference: TimeSlotPreference;
}

export interface SaveDraftInput {
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
	notes?: string | null;
	timeSlots: TimeSlotInput[];
	version?: number;
}

export interface SubmitInput extends SaveDraftInput {
	version: number;
}

interface ServiceError {
	statusCode: number;
	code: string;
	message: string;
}

function err(statusCode: number, code: string, message: string): ServiceError {
	return Object.assign(new Error(message), { statusCode, code });
}

// ─── Lifecycle guard ───

/**
 * Check whether the preference window is currently active.
 * In v1 this checks the lifecycle phase constant; in future it will read
 * persisted phase state per school+year.
 *
 * Returns null if window is open, or a ServiceError if blocked.
 */
export function checkPreferenceWindow(currentPhase: string): ServiceError | null {
	if (currentPhase === 'PREFERENCE_COLLECTION') return null;
	return err(
		403,
		'PREFERENCE_WINDOW_CLOSED',
		`Preference submissions are only accepted during the Preference Collection phase. Current phase: ${currentPhase}.`,
	);
}

// ─── Faculty self operations ───

export async function getPreference(schoolId: number, schoolYearId: number, facultyId: number) {
	const pref = await prisma.facultyPreference.findUnique({
		where: { schoolId_schoolYearId_facultyId: { schoolId, schoolYearId, facultyId } },
		include: { timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] } },
	});
	return pref;
}

export async function saveDraft(input: SaveDraftInput) {
	const { schoolId, schoolYearId, facultyId, notes, timeSlots, version } = input;

	// Verify faculty exists
	const faculty = await prisma.facultyMirror.findFirst({
		where: { id: facultyId, schoolId },
	});
	if (!faculty) throw err(404, 'FACULTY_NOT_FOUND', 'Faculty member not found in this school.');

	const existing = await prisma.facultyPreference.findUnique({
		where: { schoolId_schoolYearId_facultyId: { schoolId, schoolYearId, facultyId } },
	});

	if (existing) {
		// Optimistic lock check
		if (version !== undefined && version !== existing.version) {
			throw err(409, 'VERSION_CONFLICT', `Version conflict: expected ${existing.version}, got ${version}. Reload and retry.`);
		}
		// Cannot edit an already submitted preference via draft save
		if (existing.status === 'SUBMITTED') {
			throw err(422, 'ALREADY_SUBMITTED', 'Preference has been submitted. It cannot be edited as a draft.');
		}

		return prisma.$transaction(async (tx) => {
			await tx.preferenceTimeSlot.deleteMany({ where: { preferenceId: existing.id } });
			return tx.facultyPreference.update({
				where: { id: existing.id },
				data: {
					notes,
					version: { increment: 1 },
					timeSlots: {
						createMany: {
							data: timeSlots.map((ts) => ({
								day: ts.day,
								startTime: ts.startTime,
								endTime: ts.endTime,
								preference: ts.preference,
							})),
						},
					},
				},
				include: { timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] } },
			});
		});
	}

	// Create new
	return prisma.facultyPreference.create({
		data: {
			schoolId,
			schoolYearId,
			facultyId,
			notes,
			status: 'DRAFT',
			timeSlots: {
				createMany: {
					data: timeSlots.map((ts) => ({
						day: ts.day,
						startTime: ts.startTime,
						endTime: ts.endTime,
						preference: ts.preference,
					})),
				},
			},
		},
		include: { timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] } },
	});
}

export async function submitPreference(input: SubmitInput) {
	const { schoolId, schoolYearId, facultyId, notes, timeSlots, version } = input;

	// Verify faculty exists
	const faculty = await prisma.facultyMirror.findFirst({
		where: { id: facultyId, schoolId },
	});
	if (!faculty) throw err(404, 'FACULTY_NOT_FOUND', 'Faculty member not found in this school.');

	const existing = await prisma.facultyPreference.findUnique({
		where: { schoolId_schoolYearId_facultyId: { schoolId, schoolYearId, facultyId } },
	});

	if (existing) {
		if (version !== existing.version) {
			throw err(409, 'VERSION_CONFLICT', `Version conflict: expected ${existing.version}, got ${version}. Reload and retry.`);
		}
		if (existing.status === 'SUBMITTED') {
			throw err(422, 'ALREADY_SUBMITTED', 'Preference has already been submitted.');
		}

		return prisma.$transaction(async (tx) => {
			await tx.preferenceTimeSlot.deleteMany({ where: { preferenceId: existing.id } });
			return tx.facultyPreference.update({
				where: { id: existing.id },
				data: {
					notes,
					status: 'SUBMITTED',
					submittedAt: new Date(),
					version: { increment: 1 },
					timeSlots: {
						createMany: {
							data: timeSlots.map((ts) => ({
								day: ts.day,
								startTime: ts.startTime,
								endTime: ts.endTime,
								preference: ts.preference,
							})),
						},
					},
				},
				include: { timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] } },
			});
		});
	}

	// Create and submit in one step
	return prisma.facultyPreference.create({
		data: {
			schoolId,
			schoolYearId,
			facultyId,
			notes,
			status: 'SUBMITTED',
			submittedAt: new Date(),
			timeSlots: {
				createMany: {
					data: timeSlots.map((ts) => ({
						day: ts.day,
						startTime: ts.startTime,
						endTime: ts.endTime,
						preference: ts.preference,
					})),
				},
			},
		},
		include: { timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] } },
	});
}

// ─── Officer monitoring ───

export async function getOfficerSummary(
	schoolId: number,
	schoolYearId: number,
	statusFilter?: 'SUBMITTED' | 'DRAFT' | 'MISSING',
) {
	// All active faculty for this school
	const allFaculty = await prisma.facultyMirror.findMany({
		where: { schoolId, isActiveForScheduling: true },
		orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
		select: { id: true, firstName: true, lastName: true, department: true },
	});

	// All preferences for this school+year
	const preferences = await prisma.facultyPreference.findMany({
		where: { schoolId, schoolYearId },
		select: { facultyId: true, status: true, submittedAt: true, version: true },
	});

	const prefMap = new Map(preferences.map((p) => [p.facultyId, p]));

	type FacultySummaryItem = {
		facultyId: number;
		firstName: string;
		lastName: string;
		department: string | null;
		preferenceStatus: 'SUBMITTED' | 'DRAFT' | 'MISSING';
		submittedAt: Date | null;
	};

	const items: FacultySummaryItem[] = allFaculty.map((f) => {
		const pref = prefMap.get(f.id);
		return {
			facultyId: f.id,
			firstName: f.firstName,
			lastName: f.lastName,
			department: f.department,
			preferenceStatus: pref ? pref.status : 'MISSING',
			submittedAt: pref?.submittedAt ?? null,
		};
	});

	// Apply status filter
	const filtered = statusFilter
		? items.filter((i) => i.preferenceStatus === statusFilter)
		: items;

	const counts = {
		total: allFaculty.length,
		submitted: items.filter((i) => i.preferenceStatus === 'SUBMITTED').length,
		draft: items.filter((i) => i.preferenceStatus === 'DRAFT').length,
		missing: items.filter((i) => i.preferenceStatus === 'MISSING').length,
	};

	return { counts, faculty: filtered };
}

// ─── Reminder (placeholder action — logs intent, returns acknowledgement) ───

export async function triggerReminder(
	schoolId: number,
	schoolYearId: number,
	facultyIds: number[],
	triggeredBy: number,
) {
	const timestamp = new Date().toISOString();

	// Durable audit record — replaces volatile console.log
	const audit = await prisma.auditLog.create({
		data: {
			schoolId,
			schoolYearId,
			action: 'PREFERENCE_REMINDER_TRIGGERED',
			actorId: triggeredBy,
			targetIds: facultyIds,
			metadata: { count: facultyIds.length, timestamp },
		},
	});

	return {
		reminded: facultyIds.length,
		auditId: audit.id,
		timestamp,
		note: 'Reminder logged. Push/email delivery is not yet implemented.',
	};
}

// ─── Seed preferences (idempotent) ───

/** Default Mon–Fri 07:00–17:00 AVAILABLE template for seeded preferences. */
const DEFAULT_SEED_SLOTS: { day: DayOfWeek; startTime: string; endTime: string; preference: TimeSlotPreference }[] = [
	{ day: 'MONDAY', startTime: '07:00', endTime: '17:00', preference: 'AVAILABLE' },
	{ day: 'TUESDAY', startTime: '07:00', endTime: '17:00', preference: 'AVAILABLE' },
	{ day: 'WEDNESDAY', startTime: '07:00', endTime: '17:00', preference: 'AVAILABLE' },
	{ day: 'THURSDAY', startTime: '07:00', endTime: '17:00', preference: 'AVAILABLE' },
	{ day: 'FRIDAY', startTime: '07:00', endTime: '17:00', preference: 'AVAILABLE' },
];

export async function seedPreferencesForSchoolYear(
	schoolId: number,
	schoolYearId: number,
	actorId: number,
) {
	// All active faculty for this school
	const activeFaculty = await prisma.facultyMirror.findMany({
		where: { schoolId, isActiveForScheduling: true },
		select: { id: true },
	});

	// Existing preferences for this school+year
	const existing = await prisma.facultyPreference.findMany({
		where: { schoolId, schoolYearId },
		select: { facultyId: true },
	});
	const existingSet = new Set(existing.map((p) => p.facultyId));

	// Faculty that need seeding
	const toSeed = activeFaculty.filter((f) => !existingSet.has(f.id));

	// Batch-create inside a transaction
	if (toSeed.length > 0) {
		await prisma.$transaction(async (tx) => {
			for (const f of toSeed) {
				await tx.facultyPreference.create({
					data: {
						schoolId,
						schoolYearId,
						facultyId: f.id,
						status: 'DRAFT',
						notes: null,
						timeSlots: {
							createMany: { data: DEFAULT_SEED_SLOTS },
						},
					},
				});
			}
		});
	}

	// Durable audit
	const audit = await prisma.auditLog.create({
		data: {
			schoolId,
			schoolYearId,
			action: 'PREFERENCE_SEEDED',
			actorId,
			targetIds: toSeed.map((f) => f.id),
			metadata: {
				totalFaculty: activeFaculty.length,
				alreadySeeded: existingSet.size,
				created: toSeed.length,
			},
		},
	});

	return {
		totalFaculty: activeFaculty.length,
		alreadySeeded: existingSet.size,
		created: toSeed.length,
		schoolId,
		schoolYearId,
		auditId: audit.id,
	};
}
