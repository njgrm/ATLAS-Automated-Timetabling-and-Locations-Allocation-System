import { prisma } from '../lib/prisma.js';
import { solveQuickPlace, applyQuickPlace } from '../services/timetable-quick-place.service.js';
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
        console.error('\nMissing seeded officer account for quick place test.');
        process.exitCode = 1;
        return;
    }
    const createdRunIds = [];
    const createdOwnershipIds = [];
    const createdFacultySubjectIds = [];
    const createdFacultyIds = [];
    const createdSectionIds = [];
    const createdSubjectIds = [];
    let hasSnapshotExisted = false;
    let originalSnapshotPayload = null;
    // 1. Create mock subject
    const subject = await prisma.subject.create({
        data: {
            schoolId,
            code: `TEST-QP-SUB-${Date.now()}`,
            name: 'Test Subject',
            minMinutesPerWeek: 180,
            preferredRoomType: 'CLASSROOM',
            gradeLevels: [7],
            isActive: true,
        }
    });
    createdSubjectIds.push(subject.id);
    // 2. Create mock section
    const sectionRec = await prisma.sectionMirror.create({
        data: {
            schoolId,
            schoolYearId,
            externalId: 30005,
            name: '7-Test Section',
            gradeLevelId: 7,
            gradeLevelName: 'Grade 7',
            displayOrder: 7,
            maxCapacity: 40,
            enrolledCount: 35,
            programType: 'REGULAR',
            isActiveForScheduling: true,
        }
    });
    createdSectionIds.push(sectionRec.id);
    // 3. Create mock teacher
    const faculty = await prisma.facultyMirror.create({
        data: {
            schoolId,
            externalId: 40005,
            firstName: 'QP Test',
            lastName: 'Teacher',
            department: 'English',
            employmentStatus: 'PERMANENT',
            isActiveForScheduling: true,
            maxHoursPerWeek: 20,
        }
    });
    createdFacultyIds.push(faculty.id);
    // 4. Create mock FacultySubject
    const facultySubject = await prisma.facultySubject.create({
        data: {
            schoolId,
            facultyId: faculty.id,
            subjectId: subject.id,
            gradeLevels: [7],
            sectionIds: [sectionRec.externalId],
            assignedBy: officer.id,
        }
    });
    createdFacultySubjectIds.push(facultySubject.id);
    // 5. Create mock SubjectSectionOwnership
    const ownership = await prisma.subjectSectionOwnership.create({
        data: {
            schoolId,
            facultySubjectId: facultySubject.id,
            facultyId: faculty.id,
            subjectId: subject.id,
            sectionId: sectionRec.externalId,
        }
    });
    createdOwnershipIds.push(ownership.id);
    // 5b. Create fallback subject
    const subjectFallback = await prisma.subject.create({
        data: {
            schoolId,
            code: `TEST-QP-SUB-FB-${Date.now()}`,
            name: 'Fallback Subject',
            minMinutesPerWeek: 180,
            preferredRoomType: 'FACULTY_ROOM',
            gradeLevels: [7],
            isActive: true,
        }
    });
    createdSubjectIds.push(subjectFallback.id);
    const facultySubjectFallback = await prisma.facultySubject.create({
        data: {
            schoolId,
            facultyId: faculty.id,
            subjectId: subjectFallback.id,
            gradeLevels: [7],
            sectionIds: [sectionRec.externalId],
            assignedBy: officer.id,
        }
    });
    createdFacultySubjectIds.push(facultySubjectFallback.id);
    const ownershipFallback = await prisma.subjectSectionOwnership.create({
        data: {
            schoolId,
            facultySubjectId: facultySubjectFallback.id,
            facultyId: faculty.id,
            subjectId: subjectFallback.id,
            sectionId: sectionRec.externalId,
        }
    });
    createdOwnershipIds.push(ownershipFallback.id);
    // 6. Seed SectionSnapshot
    const existingSnapshot = await prisma.sectionSnapshot.findUnique({
        where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
    });
    if (existingSnapshot) {
        hasSnapshotExisted = true;
        originalSnapshotPayload = existingSnapshot.payload;
    }
    await prisma.sectionSnapshot.upsert({
        where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
        create: {
            schoolId,
            schoolYearId,
            payload: [
                {
                    gradeLevelId: 7,
                    gradeLevelName: 'Grade 7',
                    displayOrder: 7,
                    sections: [
                        {
                            id: sectionRec.externalId,
                            name: '7-Test Section',
                            maxCapacity: 40,
                            enrolledCount: 35,
                            gradeLevelId: 7,
                            gradeLevelName: 'Grade 7',
                            displayOrder: 7,
                        }
                    ]
                }
            ],
        },
        update: {
            payload: [
                {
                    gradeLevelId: 7,
                    gradeLevelName: 'Grade 7',
                    displayOrder: 7,
                    sections: [
                        {
                            id: sectionRec.externalId,
                            name: '7-Test Section',
                            maxCapacity: 40,
                            enrolledCount: 35,
                            gradeLevelId: 7,
                            gradeLevelName: 'Grade 7',
                            displayOrder: 7,
                        }
                    ]
                }
            ],
        }
    });
    // Make sure a test room exists
    const room = await prisma.room.findFirst({
        where: { building: { schoolId }, isTeachingSpace: true },
    }) ?? await prisma.room.create({
        data: {
            buildingId: (await prisma.building.findFirst({ where: { schoolId } }))?.id ?? 1,
            name: 'Test QP Room',
            type: 'CLASSROOM',
            capacity: 40,
            isTeachingSpace: true,
        }
    });
    try {
        section('QUICK-PLACE-01: solveQuickPlace resolves and places unassigned item');
        const run = await prisma.generationRun.create({
            data: {
                schoolId,
                schoolYearId,
                status: 'COMPLETED',
                runType: 'FULL',
                triggeredBy: officer.id,
                startedAt: new Date(),
                finishedAt: new Date(),
                durationMs: 400,
                summary: {
                    classesProcessed: 1,
                    assignedCount: 0,
                    unassignedCount: 1,
                    hardViolationCount: 0,
                    softViolationCount: 0,
                    timetableDisplaySlots: [
                        { startTime: '08:00', endTime: '09:00' },
                        { startTime: '09:00', endTime: '10:00' },
                    ],
                },
                violations: [],
                draftEntries: [],
                unassignedItems: [
                    {
                        sectionId: sectionRec.externalId,
                        subjectId: subject.id,
                        gradeLevel: 7,
                        session: 1,
                        reason: 'NO_AVAILABLE_SLOT',
                        facultyId: faculty.id,
                        homeRoomId: room.id,
                    },
                    {
                        sectionId: sectionRec.externalId,
                        subjectId: subject.id,
                        gradeLevel: 7,
                        session: 2,
                        reason: 'NO_AVAILABLE_SLOT',
                        facultyId: faculty.id,
                        homeRoomId: null,
                    },
                    {
                        sectionId: sectionRec.externalId,
                        subjectId: subjectFallback.id,
                        gradeLevel: 7,
                        session: 1,
                        reason: 'NO_AVAILABLE_SLOT',
                        facultyId: faculty.id,
                        homeRoomId: null,
                    },
                ],
            },
        });
        createdRunIds.push(run.id);
        const result = await solveQuickPlace(run.id, schoolId, schoolYearId);
        console.log('Solve result:', JSON.stringify(result, null, 2));
        assertEqual(result.placed.length, 3, 'Quick Place solver placed 3 unassigned items');
        assertEqual(result.unplaced.length, 0, 'No unplaced items remain');
        assertEqual(result.newEntries.length, 3, 'New entries contains the auto-placed items');
        // Assert subject display label is correctly sourced from subject.name
        assertEqual(result.placed[0].subjectName, 'Test Subject', 'Subject 1 name is correct (not gradeLevels)');
        assertEqual(result.placed[2].subjectName, 'Fallback Subject', 'Subject 3 name is correct (not gradeLevels)');
        // Assert room assignment metadata reasons
        assertEqual(result.newEntries[0].metadata?.roomAssignmentReason, 'HOME_ROOM_ASSIGNED', 'Metadata reason for home room matches');
        assertEqual(result.newEntries[1].metadata?.roomAssignmentReason, 'PREFERRED_ROOM_TYPE_ASSIGNED', 'Metadata reason for preferred type matches');
        assertEqual(result.newEntries[2].metadata?.roomAssignmentReason, 'FALLBACK_ROOM_ASSIGNED', 'Metadata reason for fallback matches');
        section('QUICK-PLACE-02: applyQuickPlace commits solved placements to DB');
        const applyResult = await applyQuickPlace(run.id, schoolId, schoolYearId, officer.id, run.version);
        assertEqual(applyResult.success, true, 'Quick Place apply succeeded');
        assertEqual(applyResult.placedCount, 3, 'Quick Place applied 3 placements');
        assertEqual(applyResult.version, run.version + 1, 'Run version incremented');
        const updatedRun = await prisma.generationRun.findUnique({
            where: { id: run.id },
        });
        const dbEntries = updatedRun?.draftEntries;
        assert(dbEntries && dbEntries.length === 3, 'Draft entries committed to DB');
        assertEqual(dbEntries[0].facultyId, faculty.id, 'Committed entry has correct teacher');
        // Confirm manual-edit history matches and is compatible
        const manualEdits = await prisma.manualScheduleEdit.findMany({
            where: { runId: run.id },
        });
        assertEqual(manualEdits.length, 3, 'Manual schedule edits were correctly logged');
        assertEqual(manualEdits[0].editType, 'PLACE_UNASSIGNED', 'Logged edit has correct editType');
        section('QUICK-PLACE-03: applyQuickPlace blocks on version mismatch');
        let versionConflictError = false;
        try {
            // Using run.version (stale version, since it is now run.version + 1)
            await applyQuickPlace(run.id, schoolId, schoolYearId, officer.id, run.version);
        }
        catch (e) {
            if (e.code === 'VERSION_CONFLICT') {
                versionConflictError = true;
            }
        }
        assert(versionConflictError, 'applyQuickPlace throws VERSION_CONFLICT on stale version');
        section('QUICK-PLACE-04: applyQuickPlace blocks on published run');
        // Mock published run summary
        await prisma.generationRun.update({
            where: { id: run.id },
            data: {
                summary: {
                    ...updatedRun?.summary,
                    isPublished: true,
                    publishedAt: new Date().toISOString(),
                    publishedBy: officer.id,
                },
            },
        });
        let publishedError = false;
        try {
            await applyQuickPlace(run.id, schoolId, schoolYearId, officer.id, updatedRun.version + 1);
        }
        catch (e) {
            if (e.code === 'RUN_ALREADY_PUBLISHED') {
                publishedError = true;
            }
        }
        assert(publishedError, 'applyQuickPlace throws RUN_ALREADY_PUBLISHED on published run');
    }
    catch (e) {
        console.error('Test run failed with error:', e);
        failCount += 1;
    }
    finally {
        // Clean up created resources
        for (const id of createdRunIds) {
            await prisma.generationRun.deleteMany({ where: { id } }).catch(() => { });
        }
        for (const id of createdOwnershipIds) {
            await prisma.subjectSectionOwnership.deleteMany({ where: { id } }).catch(() => { });
        }
        for (const id of createdFacultySubjectIds) {
            await prisma.facultySubject.deleteMany({ where: { id } }).catch(() => { });
        }
        for (const id of createdFacultyIds) {
            await prisma.facultyMirror.deleteMany({ where: { id } }).catch(() => { });
        }
        for (const id of createdSectionIds) {
            await prisma.sectionMirror.deleteMany({ where: { id } }).catch(() => { });
        }
        for (const id of createdSubjectIds) {
            await prisma.subject.deleteMany({ where: { id } }).catch(() => { });
        }
        // Restore SectionSnapshot
        if (hasSnapshotExisted) {
            await prisma.sectionSnapshot.update({
                where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
                data: { payload: originalSnapshotPayload },
            }).catch(() => { });
        }
        else {
            await prisma.sectionSnapshot.deleteMany({
                where: { schoolId, schoolYearId },
            }).catch(() => { });
        }
        console.log(`\nTests finished: ${passCount} passed, ${failCount} failed`);
        if (failCount > 0) {
            process.exitCode = 1;
        }
    }
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=timetable-quick-place.test.js.map