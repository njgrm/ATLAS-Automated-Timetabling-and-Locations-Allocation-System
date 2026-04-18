import { prisma } from '../lib/prisma.js';
import { createFacultyAdapter, type ExternalFaculty } from './faculty-adapter.js';

const adapter = createFacultyAdapter();
let facultyColumnsEnsured = false;

async function ensureFacultyProfileColumns() {
	if (facultyColumnsEnsured) return;
	await prisma.$executeRawUnsafe(`
		ALTER TABLE "faculty_mirrors"
		ADD COLUMN IF NOT EXISTS "employment_status" TEXT NOT NULL DEFAULT 'PERMANENT',
		ADD COLUMN IF NOT EXISTS "is_class_adviser" BOOLEAN NOT NULL DEFAULT false,
		ADD COLUMN IF NOT EXISTS "advisory_equivalent_hours" INTEGER NOT NULL DEFAULT 0,
		ADD COLUMN IF NOT EXISTS "can_teach_outside_department" BOOLEAN NOT NULL DEFAULT false
	`);
	facultyColumnsEnsured = true;
}

export async function syncFacultyFromExternal(schoolId: number, authToken?: string) {
	await ensureFacultyProfileColumns();
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
				employmentStatus: f.employmentStatus ?? 'PERMANENT',
				isClassAdviser: f.isClassAdviser ?? false,
				advisoryEquivalentHours: f.advisoryEquivalentHours ?? (f.isClassAdviser ? 5 : 0),
				canTeachOutsideDepartment: f.canTeachOutsideDepartment ?? false,
				contactInfo: f.contactInfo,
				lastSyncedAt: new Date(),
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
				isActiveForScheduling: true,
				maxHoursPerWeek: 30,
				lastSyncedAt: new Date(),
			},
		});
	}

	return { synced: true, count: external.length };
}

export async function getFacultyBySchool(schoolId: number) {
	await ensureFacultyProfileColumns();
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
	await ensureFacultyProfileColumns();
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
	await ensureFacultyProfileColumns();
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
	await ensureFacultyProfileColumns();
	return prisma.facultyMirror.count({
		where: { schoolId, isActiveForScheduling: true },
	});
}

export async function getLastSyncTime(schoolId: number): Promise<Date | null> {
	await ensureFacultyProfileColumns();
	const latest = await prisma.facultyMirror.findFirst({
		where: { schoolId },
		orderBy: { lastSyncedAt: 'desc' },
		select: { lastSyncedAt: true },
	});
	return latest?.lastSyncedAt ?? null;
}
