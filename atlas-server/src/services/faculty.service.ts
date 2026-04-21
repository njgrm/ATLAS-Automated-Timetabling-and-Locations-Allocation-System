/**
 * Faculty service — Wave 3.5 Source-of-Truth Hardening
 *
 * Features:
 * - Full reconciliation (upsert + stale detection)
 * - Durable cache with auto-save and auto-fallback
 * - Stale teachers hidden by default
 * - Adviser mapping support
 */

import { prisma } from '../lib/prisma.js';
import { createFacultyAdapter, type ExternalFaculty, type FacultyFetchResult } from './faculty-adapter.js';
import crypto from 'crypto';

const adapter = createFacultyAdapter();

// ─── Types ───

export type FacultySourceLabel = 'enrollpro' | 'cached-enrollpro' | 'stub';

export interface FacultySyncResult {
	synced: boolean;
	error?: string;
	source: FacultySourceLabel;
	fetchedAt: Date;
	activeCount: number;
	staleCount: number;
	deactivatedCount: number;
	isStale?: boolean;
	staleReason?: string;
}

export interface FacultyListResult {
	faculty: Awaited<ReturnType<typeof prisma.facultyMirror.findMany>>;
	source: FacultySourceLabel;
	fetchedAt: Date | null;
	isStale: boolean;
	staleReason?: string;
	activeCount: number;
	staleCount: number;
}

// ─── Cache helpers ───

function computeChecksum(payload: unknown): string {
	return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function saveSnapshot(schoolId: number, schoolYearId: number, data: FacultyFetchResult): Promise<void> {
	const checksum = computeChecksum(data.teachers);
	await prisma.facultySnapshot.upsert({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		update: {
			payload: data.teachers as any,
			source: data.source,
			fetchedAt: data.fetchedAt,
			checksum,
		},
		create: {
			schoolId,
			schoolYearId,
			payload: data.teachers as any,
			source: data.source,
			fetchedAt: data.fetchedAt,
			checksum,
		},
	});
}

async function loadSnapshot(schoolId: number, schoolYearId: number): Promise<{
	teachers: ExternalFaculty[];
	fetchedAt: Date;
} | null> {
	const snapshot = await prisma.facultySnapshot.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
	});
	if (!snapshot) return null;
	return {
		teachers: snapshot.payload as unknown as ExternalFaculty[],
		fetchedAt: snapshot.fetchedAt,
	};
}

// ─── Sync with reconciliation ───

export async function syncFacultyFromExternal(
	schoolId: number,
	schoolYearId: number,
	authToken?: string,
): Promise<FacultySyncResult> {
	let fetchResult: FacultyFetchResult;
	let isStale = false;
	let staleReason: string | undefined;
	let sourceLabel: FacultySourceLabel;

	try {
		fetchResult = await adapter.fetchFacultyBySchool(schoolId, authToken);
		sourceLabel = fetchResult.source === 'stub' ? 'stub' : 'enrollpro';

		// Save snapshot on successful fetch
		await saveSnapshot(schoolId, schoolYearId, fetchResult);
	} catch (err) {
		// Upstream failed — try cached snapshot
		const cached = await loadSnapshot(schoolId, schoolYearId);
		if (cached) {
			fetchResult = {
				teachers: cached.teachers,
				source: 'enrollpro',
				fetchedAt: cached.fetchedAt,
			};
			sourceLabel = 'cached-enrollpro';
			isStale = true;
			staleReason = err instanceof Error ? err.message : 'Upstream unavailable';
		} else {
			// No cache — explicit error
			return {
				synced: false,
				error: 'UPSTREAM_UNAVAILABLE: Faculty source unreachable and no cached snapshot exists.',
				source: 'enrollpro',
				fetchedAt: new Date(),
				activeCount: 0,
				staleCount: 0,
				deactivatedCount: 0,
				isStale: true,
				staleReason: 'No upstream and no cache',
			};
		}
	}

	const external = fetchResult.teachers;
	const externalIds = new Set(external.map((f) => f.id));

	// 1. Upsert current teachers
	for (const f of external) {
		await prisma.facultyMirror.upsert({
			where: { schoolId_externalId: { schoolId, externalId: f.id } },
			update: {
				firstName: f.firstName,
				lastName: f.lastName,
				department: f.department,
				employmentStatus: f.employmentStatus ?? 'PERMANENT',
				isClassAdviser: f.isClassAdviser ?? false,
				advisoryEquivalentHours: f.advisoryEquivalentHours ?? (f.isClassAdviser ? 5 : 0),
				canTeachOutsideDepartment: f.canTeachOutsideDepartment ?? false,
				contactInfo: f.contactInfo,
				advisedSectionId: f.advisedSectionId ?? null,
				advisedSectionName: f.advisedSectionName ?? null,
				lastSyncedAt: new Date(),
				// Clear stale flag on successful upstream appearance
				isStale: false,
				staleReason: null,
				staleAt: null,
			},
			create: {
				externalId: f.id,
				schoolId,
				firstName: f.firstName,
				lastName: f.lastName,
				department: f.department,
				employmentStatus: f.employmentStatus ?? 'PERMANENT',
				isClassAdviser: f.isClassAdviser ?? false,
				advisoryEquivalentHours: f.advisoryEquivalentHours ?? (f.isClassAdviser ? 5 : 0),
				canTeachOutsideDepartment: f.canTeachOutsideDepartment ?? false,
				contactInfo: f.contactInfo,
				advisedSectionId: f.advisedSectionId ?? null,
				advisedSectionName: f.advisedSectionName ?? null,
				isActiveForScheduling: true,
				maxHoursPerWeek: 30,
				lastSyncedAt: new Date(),
				isStale: false,
			},
		});
	}

	// 2. Detect and mark stale teachers (locally present but missing from upstream)
	const localTeachers = await prisma.facultyMirror.findMany({
		where: { schoolId },
		select: { id: true, externalId: true, isStale: true },
	});

	let deactivatedCount = 0;
	for (const local of localTeachers) {
		if (!externalIds.has(local.externalId) && !local.isStale) {
			// Mark as stale (soft-deactivate)
			await prisma.facultyMirror.update({
				where: { id: local.id },
				data: {
					isStale: true,
					staleReason: 'Missing from upstream during reconciliation',
					staleAt: new Date(),
				},
			});
			deactivatedCount++;
		}
	}

	// Count results
	const [activeCount, staleCount] = await Promise.all([
		prisma.facultyMirror.count({ where: { schoolId, isStale: false } }),
		prisma.facultyMirror.count({ where: { schoolId, isStale: true } }),
	]);

	return {
		synced: true,
		source: sourceLabel,
		fetchedAt: fetchResult.fetchedAt,
		activeCount,
		staleCount,
		deactivatedCount,
		isStale,
		staleReason,
	};
}

// ─── Faculty list (excludes stale by default) ───

export interface GetFacultyOptions {
	includeStale?: boolean;
}

export async function getFacultyBySchool(
	schoolId: number,
	options: GetFacultyOptions = {},
): Promise<FacultyListResult> {
	const { includeStale = false } = options;

	const whereClause: any = { schoolId };
	if (!includeStale) {
		whereClause.isStale = false;
	}

	const [faculty, lastSyncRecord, activeCount, staleCount] = await Promise.all([
		prisma.facultyMirror.findMany({
			where: whereClause,
			include: {
				facultySubjects: {
					include: { subject: { select: { id: true, name: true, code: true } } },
				},
			},
			orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
		}),
		prisma.facultyMirror.findFirst({
			where: { schoolId },
			orderBy: { lastSyncedAt: 'desc' },
			select: { lastSyncedAt: true },
		}),
		prisma.facultyMirror.count({ where: { schoolId, isStale: false } }),
		prisma.facultyMirror.count({ where: { schoolId, isStale: true } }),
	]);

	return {
		faculty,
		source: 'enrollpro', // Source of the mirror data
		fetchedAt: lastSyncRecord?.lastSyncedAt ?? null,
		isStale: false,
		activeCount,
		staleCount,
	};
}

export async function getFacultyById(id: number) {
	return prisma.facultyMirror.findUnique({
		where: { id },
		include: {
			facultySubjects: {
				include: { subject: true },
			},
		},
	});
}

export async function updateFacultyMirror(
	id: number,
	data: Partial<{
		localNotes: string;
		isActiveForScheduling: boolean;
		maxHoursPerWeek: number;
		employmentStatus: string;
		isClassAdviser: boolean;
		advisoryEquivalentHours: number;
		canTeachOutsideDepartment: boolean;
	}>,
	expectedVersion: number,
) {
	const existing = await prisma.facultyMirror.findUnique({ where: { id } });
	if (!existing) return { success: false as const, error: 'Faculty not found.' };
	if (existing.version !== expectedVersion) {
		return { success: false as const, error: 'Version conflict. Please reload.' };
	}

	const updated = await prisma.facultyMirror.update({
		where: { id },
		data: {
			...data,
			version: { increment: 1 },
		},
	});
	return { success: true as const, faculty: updated };
}

export async function getFacultyCountBySchool(schoolId: number): Promise<number> {
	return prisma.facultyMirror.count({
		where: { schoolId, isActiveForScheduling: true, isStale: false },
	});
}

export async function getLastSyncTime(schoolId: number): Promise<Date | null> {
	const latest = await prisma.facultyMirror.findFirst({
		where: { schoolId },
		orderBy: { lastSyncedAt: 'desc' },
		select: { lastSyncedAt: true },
	});
	return latest?.lastSyncedAt ?? null;
}

// ─── Adviser helpers ───

export async function getFacultyWithAdviserInfo(schoolId: number) {
	return prisma.facultyMirror.findMany({
		where: { schoolId, isStale: false, isClassAdviser: true },
		select: {
			id: true,
			firstName: true,
			lastName: true,
			advisedSectionId: true,
			advisedSectionName: true,
		},
		orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
	});
}

export async function getHomeroomRecommendation(facultyId: number) {
	const faculty = await prisma.facultyMirror.findUnique({
		where: { id: facultyId },
		select: {
			isClassAdviser: true,
			advisedSectionId: true,
			advisedSectionName: true,
		},
	});

	if (!faculty || !faculty.isClassAdviser || !faculty.advisedSectionId) {
		return null;
	}

	return {
		hasAdviserMapping: true,
		advisedSectionId: faculty.advisedSectionId,
		advisedSectionName: faculty.advisedSectionName,
		homeroomHint: `Configure homeroom for ${faculty.advisedSectionName}`,
	};
}
