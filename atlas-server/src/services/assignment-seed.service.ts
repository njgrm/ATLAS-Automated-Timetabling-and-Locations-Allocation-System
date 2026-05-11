/**
 * Assignment Seed Service
 *
 * Seeds FacultySubject (assignment) records for faculty×subject pairs where
 * `faculty.department` is contained in `subject.allowedSpecializations`.
 *
 * This runs automatically after every faculty sync to pre-populate the
 * FacultyAssignments page with qualified pairings that the Scheduler fills.
 */

import { prisma } from '../lib/prisma';

export interface AssignmentSeedResult {
	created: number;
	skipped: number;
}

/**
 * For each non-stale active faculty member, scan all subjects whose
 * `allowedSpecializations` array includes the faculty's `department`.
 * Create a FacultySubject record (with empty sectionIds) if one doesn't exist.
 */
export async function seedQualifiedAssignments(
	schoolId: number,
	_schoolYearId: number,
): Promise<AssignmentSeedResult> {
	const [faculty, subjects] = await Promise.all([
		prisma.facultyMirror.findMany({
			where: {
				schoolId,
				isStale: false,
				isActiveForScheduling: true,
				department: { not: null },
			},
			select: { id: true, department: true },
		}),
		prisma.subject.findMany({
			where: {
				schoolId,
				isActive: true,
				// Only auto-seed subjects that have explicit department restrictions
				NOT: { allowedSpecializations: { isEmpty: true } },
			},
			select: { id: true, allowedSpecializations: true },
		}),
	]);

	let created = 0;
	let skipped = 0;

	for (const member of faculty) {
		if (!member.department) continue;

		for (const subject of subjects) {
			if (!subject.allowedSpecializations.includes(member.department)) {
				continue;
			}

			// Check if assignment already exists
			const existing = await prisma.facultySubject.findUnique({
				where: { facultyId_subjectId: { facultyId: member.id, subjectId: subject.id } },
				select: { id: true },
			});

			if (existing) {
				skipped += 1;
				continue;
			}

			await prisma.facultySubject.create({
				data: {
					facultyId: member.id,
					subjectId: subject.id,
					schoolId,
					sectionIds: [],
					gradeLevels: [],
					assignedBy: 0, // 0 = system-seeded (no specific officer)
				},
			});
			created += 1;
		}
	}

	return { created, skipped };
}
