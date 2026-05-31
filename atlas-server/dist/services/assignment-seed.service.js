/**
 * Assignment Seed Service
 *
 * Seeds FacultySubject (assignment) records for faculty×subject pairs where
    * `faculty.department` matches the subject ownership department baseline.
 *
 * This runs automatically after every faculty sync to pre-populate the
 * Teaching Load page with qualified pairings that the Scheduler fills.
 */
import { prisma } from '../lib/prisma.js';
import { matchesSubjectOwnershipDepartment } from './subject-ownership.service.js';
/**
 * For each non-stale active faculty member, scan all subjects whose
    * ownership department matches the faculty `department`.
 * Create a FacultySubject record (with empty sectionIds) if one doesn't exist.
 */
export async function seedQualifiedAssignments(schoolId, _schoolYearId) {
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
            },
            select: { id: true, code: true, name: true, ownerDepartment: true, requiredFeatures: true },
        }),
    ]);
    let created = 0;
    let skipped = 0;
    for (const member of faculty) {
        if (!member.department)
            continue;
        for (const subject of subjects) {
            if (!matchesSubjectOwnershipDepartment(member.department, subject.code, subject.name, subject.ownerDepartment, subject.requiredFeatures)) {
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
//# sourceMappingURL=assignment-seed.service.js.map