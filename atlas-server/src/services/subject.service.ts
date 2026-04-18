import { prisma } from '../lib/prisma.js';

const MATATAG_DEFAULTS = [
	{ code: 'FIL', name: 'Filipino', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7, 8, 9, 10] },
	{ code: 'ENG', name: 'English', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7, 8, 9, 10] },
	{ code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7, 8, 9, 10] },
	{ code: 'SCI', name: 'Science', minMinutesPerWeek: 225, preferredRoomType: 'LABORATORY' as const, gradeLevels: [7, 8, 9, 10] },
	{ code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7, 8, 9, 10] },
	{ code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 200, preferredRoomType: 'GYMNASIUM' as const, gradeLevels: [7, 8, 9, 10] },
	{ code: 'VE', name: 'Values Education', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7, 8, 9, 10] },
	{ code: 'TLE', name: 'Technology and Livelihood Education', minMinutesPerWeek: 200, preferredRoomType: 'TLE_WORKSHOP' as const, gradeLevels: [7, 8, 9, 10] },
	{ code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7, 8, 9, 10] },
];

export async function ensureDefaultSubjects(schoolId: number): Promise<void> {
	const count = await prisma.subject.count({ where: { schoolId } });
	if (count > 0) return;

	await prisma.subject.createMany({
		data: MATATAG_DEFAULTS.map((s) => ({
			schoolId,
			code: s.code,
			name: s.name,
			minMinutesPerWeek: s.minMinutesPerWeek,
			preferredRoomType: s.preferredRoomType,
			gradeLevels: s.gradeLevels,
			isSeedable: true,
			isActive: true,
		})),
	});
}

export async function getSubjectsBySchool(schoolId: number) {
	return prisma.subject.findMany({
		where: { schoolId },
		orderBy: [{ isSeedable: 'desc' }, { name: 'asc' }],
	});
}

export async function getSubjectById(id: number) {
	return prisma.subject.findUnique({ where: { id } });
}

export async function createSubject(
	schoolId: number,
	data: {
		code: string;
		name: string;
		minMinutesPerWeek: number;
		preferredRoomType: string;
		sessionPattern?: string;
		gradeLevels: number[];
		interSectionEnabled?: boolean;
		interSectionGradeLevels?: number[];
	},
) {
	// Validate inter-section grade levels are within subject's grade levels
	const interGrades = data.interSectionGradeLevels ?? [];
	if (interGrades.length > 0) {
		const invalid = interGrades.filter((g) => !data.gradeLevels.includes(g));
		if (invalid.length > 0) {
			throw Object.assign(
				new Error(`interSectionGradeLevels contains grades not in subject gradeLevels: ${invalid.join(', ')}`),
				{ statusCode: 400, code: 'INVALID_INTER_SECTION_GRADES' },
			);
		}
	}

	return prisma.subject.create({
		data: {
			schoolId,
			code: data.code,
			name: data.name,
			minMinutesPerWeek: data.minMinutesPerWeek,
			preferredRoomType: data.preferredRoomType as any,
			sessionPattern: (data.sessionPattern as any) ?? 'ANY',
			gradeLevels: data.gradeLevels,
			isActive: true,
			isSeedable: false,
			interSectionEnabled: data.interSectionEnabled ?? false,
			interSectionGradeLevels: interGrades,
		},
	});
}

export async function updateSubject(
	id: number,
	data: Partial<{
		name: string;
		minMinutesPerWeek: number;
		preferredRoomType: string;
		sessionPattern: string;
		gradeLevels: number[];
		isActive: boolean;
		interSectionEnabled: boolean;
		interSectionGradeLevels: number[];
	}>,
) {
	const subject = await prisma.subject.findUnique({ where: { id } });
	if (!subject) return null;

	// Validate inter-section grade levels if provided
	const newGradeLevels = data.gradeLevels ?? subject.gradeLevels;
	if (data.interSectionGradeLevels !== undefined && data.interSectionGradeLevels.length > 0) {
		const invalid = data.interSectionGradeLevels.filter((g) => !newGradeLevels.includes(g));
		if (invalid.length > 0) {
			throw Object.assign(
				new Error(`interSectionGradeLevels contains grades not in subject gradeLevels: ${invalid.join(', ')}`),
				{ statusCode: 400, code: 'INVALID_INTER_SECTION_GRADES' },
			);
		}
	}

	// Seedable subjects can update name, minMinutesPerWeek, and gradeLevels
	if (subject.isSeedable) {
		const allowed: Record<string, unknown> = {};
		if (data.name !== undefined) allowed.name = data.name;
		if (data.minMinutesPerWeek !== undefined) allowed.minMinutesPerWeek = data.minMinutesPerWeek;
		if (data.gradeLevels !== undefined) allowed.gradeLevels = data.gradeLevels;
		if (data.sessionPattern !== undefined) allowed.sessionPattern = data.sessionPattern;
		// Seedable subjects can also have inter-section settings updated
		if (data.interSectionEnabled !== undefined) allowed.interSectionEnabled = data.interSectionEnabled;
		if (data.interSectionGradeLevels !== undefined) allowed.interSectionGradeLevels = data.interSectionGradeLevels;
		return prisma.subject.update({ where: { id }, data: allowed });
	}

	const updateData: Record<string, unknown> = {};
	if (data.name !== undefined) updateData.name = data.name;
	if (data.minMinutesPerWeek !== undefined) updateData.minMinutesPerWeek = data.minMinutesPerWeek;
	if (data.preferredRoomType !== undefined) updateData.preferredRoomType = data.preferredRoomType;
	if (data.sessionPattern !== undefined) updateData.sessionPattern = data.sessionPattern as any;
	if (data.gradeLevels !== undefined) updateData.gradeLevels = data.gradeLevels;
	if (data.isActive !== undefined) updateData.isActive = data.isActive;
	if (data.interSectionEnabled !== undefined) updateData.interSectionEnabled = data.interSectionEnabled;
	if (data.interSectionGradeLevels !== undefined) updateData.interSectionGradeLevels = data.interSectionGradeLevels;

	return prisma.subject.update({ where: { id }, data: updateData });
}

export async function deleteSubject(id: number): Promise<{ success: boolean; error?: string }> {
	const subject = await prisma.subject.findUnique({
		where: { id },
		include: { facultySubjects: { select: { id: true }, take: 1 } },
	});
	if (!subject) return { success: false, error: 'Subject not found.' };
	if (subject.isSeedable) return { success: false, error: 'DepEd standard subjects cannot be deleted.' };
	if (subject.facultySubjects.length > 0) {
		return { success: false, error: 'Cannot delete a subject that is assigned to faculty.' };
	}

	await prisma.subject.delete({ where: { id } });
	return { success: true };
}

export async function getSubjectCountBySchool(schoolId: number): Promise<number> {
	return prisma.subject.count({ where: { schoolId, isActive: true } });
}

export async function getSubjectsWithoutFaculty(schoolId: number) {
	return prisma.subject.findMany({
		where: {
			schoolId,
			isActive: true,
			facultySubjects: { none: {} },
		},
		select: { id: true, name: true, code: true },
	});
}
