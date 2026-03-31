import { prisma } from '../lib/prisma.js';
import { createFacultyAdapter, type ExternalFaculty } from './faculty-adapter.js';

const adapter = createFacultyAdapter();

export async function syncFacultyFromExternal(schoolId: number, authToken?: string) {
	let external: ExternalFaculty[];
	try {
		external = await adapter.fetchFacultyBySchool(schoolId, authToken);
	} catch {
		return { synced: false, error: 'Faculty source unreachable.' };
	}

	for (const f of external) {
		await prisma.facultyMirror.upsert({
			where: {
				schoolId_externalId: { schoolId, externalId: f.id },
			},
			update: {
				firstName: f.firstName,
				lastName: f.lastName,
				department: f.department,
				contactInfo: f.contactInfo,
				lastSyncedAt: new Date(),
			},
			create: {
				externalId: f.id,
				schoolId,
				firstName: f.firstName,
				lastName: f.lastName,
				department: f.department,
				contactInfo: f.contactInfo,
				isActiveForScheduling: true,
				maxHoursPerWeek: 30,
				lastSyncedAt: new Date(),
			},
		});
	}

	return { synced: true, count: external.length };
}

export async function getFacultyBySchool(schoolId: number) {
	return prisma.facultyMirror.findMany({
		where: { schoolId },
		include: {
			facultySubjects: {
				include: { subject: { select: { id: true, name: true, code: true } } },
			},
		},
		orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
	});
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
		where: { schoolId, isActiveForScheduling: true },
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
