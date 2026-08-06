import { prisma } from '../lib/prisma.js';
import { syncTimetableSetup } from '../services/timetable-sync-setup.service.js';
let passCount = 0;
let failCount = 0;
function section(name) {
    console.log(`\n═══ ${name} ═══`);
}
function assert(condition, label) {
    if (condition) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  ✗ ${label}`);
}
function assertEqual(actual, expected, label) {
    if (actual === expected) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
}
async function run() {
    const refFaculty = await prisma.facultyMirror.findFirst({
        orderBy: { id: 'desc' },
    });
    const refSection = await prisma.sectionMirror.findFirst({
        orderBy: { id: 'desc' },
    });
    const refSubject = await prisma.subject.findFirst({
        orderBy: { id: 'desc' },
    });
    const schoolId = refFaculty?.schoolId ?? refSection?.schoolId ?? refSubject?.schoolId ?? 1;
    const schoolYearId = refSection?.schoolYearId ?? 29;
    const officer = await prisma.atlasAuthAccount.findFirst({
        where: { role: 'officer', isActive: true },
        orderBy: { id: 'asc' },
    });
    if (!officer) {
        console.error('\nMissing seeded officer account for sync setup test.');
        process.exitCode = 1;
        return;
    }
    const createdRunIds = [];
    const createdOwnershipIds = [];
    const createdFacultySubjectIds = [];
    const createdFacultyIds = [];
    const createdSectionIds = [];
    const createdSubjectIds = [];
    // Dynamic relationship setup to guarantee dependencies exist
    let subject = refSubject;
    if (!subject) {
        subject = await prisma.subject.create({
            data: {
                schoolId,
                code: `TEST-SUB-${Date.now()}`,
                name: 'Test Subject',
                minMinutesPerWeek: 180,
                preferredRoomType: 'CLASSROOM',
                gradeLevels: [7],
                isActive: true,
            }
        });
        createdSubjectIds.push(subject.id);
    }
    let sectionRec = refSection;
    if (!sectionRec) {
        sectionRec = await prisma.sectionMirror.create({
            data: {
                schoolId,
                schoolYearId,
                externalId: 10001,
                name: '7-Test Section',
                gradeLevelId: 7,
                gradeLevelName: 'Grade 7',
                displayOrder: 1,
                maxCapacity: 40,
                enrolledCount: 35,
                programType: 'REGULAR',
                isActiveForScheduling: true,
            }
        });
        createdSectionIds.push(sectionRec.id);
    }
    let faculty = refFaculty;
    if (!faculty) {
        faculty = await prisma.facultyMirror.create({
            data: {
                schoolId,
                externalId: 20001,
                firstName: 'Test',
                lastName: 'Teacher',
                department: 'English',
                employmentStatus: 'PERMANENT',
                isActiveForScheduling: true,
            }
        });
        createdFacultyIds.push(faculty.id);
    }
    let facultySubject = await prisma.facultySubject.findFirst({
        where: { schoolId, facultyId: faculty.id, subjectId: subject.id },
    });
    if (!facultySubject) {
        facultySubject = await prisma.facultySubject.create({
            data: {
                schoolId,
                facultyId: faculty.id,
                subjectId: subject.id,
                gradeLevels: [7],
                assignedBy: officer.id,
            }
        });
        createdFacultySubjectIds.push(facultySubject.id);
    }
    let ownership = await prisma.subjectSectionOwnership.findFirst({
        where: { schoolId, subjectId: subject.id, sectionId: sectionRec.externalId },
    });
    if (!ownership) {
        ownership = await prisma.subjectSectionOwnership.create({
            data: {
                schoolId,
                facultySubjectId: facultySubject.id,
                facultyId: faculty.id,
                subjectId: subject.id,
                sectionId: sectionRec.externalId,
            }
        });
        createdOwnershipIds.push(ownership.id);
    }
    try {
        section('SYNC-SETUP-01: Sync updates teacher assignments');
        // Create a mock run where the entry has a different faculty (null) than live setup
        const run = await prisma.generationRun.create({
            data: {
                schoolId,
                schoolYearId,
                status: 'COMPLETED',
                runType: 'FULL',
                triggeredBy: officer.id,
                startedAt: new Date(),
                finishedAt: new Date(),
                durationMs: 500,
                summary: {
                    classesProcessed: 1,
                    assignedCount: 1,
                    unassignedCount: 0,
                    hardViolationCount: 0,
                    softViolationCount: 0,
                },
                violations: [],
                draftEntries: [
                    {
                        entryId: `entry-${Date.now()}`,
                        subjectId: ownership.subjectId,
                        sectionId: ownership.sectionId,
                        facultyId: null, // Out of sync with live setup
                        roomId: 1,
                        day: 'MONDAY',
                        startTime: '07:00',
                        endTime: '08:00',
                        durationMinutes: 60,
                        entryKind: 'SECTION',
                    },
                ],
                unassignedItems: [],
            },
        });
        createdRunIds.push(run.id);
        const result = await syncTimetableSetup(schoolId, schoolYearId, run.id, officer.id);
        assertEqual(result.updatedFacultyCount, 1, 'Sync identifies 1 changed teacher assignment');
        assertEqual(result.displacedEntriesCount, 0, 'No entries are deleted');
        const updatedRun = await prisma.generationRun.findUnique({
            where: { id: run.id },
        });
        const updatedEntries = updatedRun?.draftEntries;
        assert(updatedEntries && updatedEntries.length === 1, 'Draft entry list still has 1 entry');
        assertEqual(updatedEntries[0].facultyId, ownership.facultyId, 'Draft entry faculty ID updated to match live setup');
        section('SYNC-SETUP-02: Sync deletes entries for deleted sections/subjects');
        // Create a run with a non-existent subject/section ID (e.g. 999999)
        const runWithDeleted = await prisma.generationRun.create({
            data: {
                schoolId,
                schoolYearId,
                status: 'COMPLETED',
                runType: 'FULL',
                triggeredBy: officer.id,
                startedAt: new Date(),
                finishedAt: new Date(),
                durationMs: 500,
                summary: {
                    classesProcessed: 1,
                    assignedCount: 1,
                    unassignedCount: 0,
                    hardViolationCount: 0,
                    softViolationCount: 0,
                },
                violations: [],
                draftEntries: [
                    {
                        entryId: `deleted-${Date.now()}`,
                        subjectId: 999999, // Non-existent subject
                        sectionId: 999999, // Non-existent section
                        facultyId: null,
                        roomId: 1,
                        day: 'MONDAY',
                        startTime: '07:00',
                        endTime: '08:00',
                        durationMinutes: 60,
                        entryKind: 'SECTION',
                    },
                ],
                unassignedItems: [],
            },
        });
        createdRunIds.push(runWithDeleted.id);
        const resultDeleted = await syncTimetableSetup(schoolId, schoolYearId, runWithDeleted.id, officer.id);
        assertEqual(resultDeleted.displacedEntriesCount, 1, 'Sync identifies 1 displaced/deleted class');
        const updatedRunDeleted = await prisma.generationRun.findUnique({
            where: { id: runWithDeleted.id },
        });
        const updatedEntriesDeleted = updatedRunDeleted?.draftEntries;
        assertEqual(updatedEntriesDeleted.length, 0, 'Draft entry for deleted section/subject is removed');
    }
    finally {
        if (createdRunIds.length > 0) {
            await prisma.generationRun.deleteMany({
                where: { id: { in: createdRunIds } },
            });
        }
        if (createdOwnershipIds.length > 0) {
            await prisma.subjectSectionOwnership.deleteMany({
                where: { id: { in: createdOwnershipIds } },
            });
        }
        if (createdFacultySubjectIds.length > 0) {
            await prisma.facultySubject.deleteMany({
                where: { id: { in: createdFacultySubjectIds } },
            });
        }
        if (createdFacultyIds.length > 0) {
            await prisma.facultyMirror.deleteMany({
                where: { id: { in: createdFacultyIds } },
            });
        }
        if (createdSectionIds.length > 0) {
            await prisma.sectionMirror.deleteMany({
                where: { id: { in: createdSectionIds } },
            });
        }
        if (createdSubjectIds.length > 0) {
            await prisma.subject.deleteMany({
                where: { id: { in: createdSubjectIds } },
            });
        }
        await prisma.$disconnect();
    }
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0)
        process.exitCode = 1;
}
run().catch((error) => {
    console.error('\nUnhandled test error:', error);
    process.exit(1);
});
