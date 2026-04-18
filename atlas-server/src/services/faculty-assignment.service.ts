import { prisma } from '../lib/prisma.js';

export async function getAssignmentsByFaculty(facultyId: number) {
	return prisma.facultySubject.findMany({
		where: { facultyId },
		include: { subject: true },
		orderBy: { subject: { name: 'asc' } },
	});
}

export async function setAssignments(
	facultyId: number,
	schoolId: number,
	assignedBy: number,
	assignments: { subjectId: number; gradeLevels: number[] }[],
) {
	// Verify faculty exists and is active
	const faculty = await prisma.facultyMirror.findUnique({ where: { id: facultyId } });
	if (!faculty) return { success: false as const, error: 'Faculty not found.' };
	if (!faculty.isActiveForScheduling) {
		return { success: false as const, error: 'Faculty is not active for scheduling.' };
	}

	// Use a transaction: delete old assignments, create new ones
	await prisma.$transaction(async (tx) => {
		await tx.facultySubject.deleteMany({ where: { facultyId } });

		if (assignments.length > 0) {
			await tx.facultySubject.createMany({
				data: assignments.map((a) => ({
					facultyId,
					subjectId: a.subjectId,
					schoolId,
					gradeLevels: a.gradeLevels,
					assignedBy,
				})),
			});
		}
	});

	return { success: true as const };
}

export async function getAssignmentSummary(schoolId: number) {
	const faculty = await prisma.facultyMirror.findMany({
		where: { schoolId },
		include: {
			facultySubjects: {
				include: { subject: { select: { id: true, name: true, code: true, minMinutesPerWeek: true } } },
			},
		},
		orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
	});

	return faculty.map((f) => {
		// Sum distinct subject hours (no grade-level multiplier).
		// Actual weekly load depends on section assignments during generation.
		const subjectMinutes = f.facultySubjects.reduce(
			(sum, fs) => sum + fs.subject.minMinutesPerWeek,
			0,
		);
		const subjectHours = subjectMinutes / 60;

		return {
			id: f.id,
			externalId: f.externalId,
			firstName: f.firstName,
			lastName: f.lastName,
			department: f.department,
			employmentStatus: f.employmentStatus,
			isClassAdviser: f.isClassAdviser,
			advisoryEquivalentHours: f.advisoryEquivalentHours,
			canTeachOutsideDepartment: f.canTeachOutsideDepartment,
			isActiveForScheduling: f.isActiveForScheduling,
			maxHoursPerWeek: f.maxHoursPerWeek,
			subjectCount: f.facultySubjects.length,
			subjectHours: Math.round(subjectHours * 10) / 10,
			assignments: f.facultySubjects,
		};
	});
}
