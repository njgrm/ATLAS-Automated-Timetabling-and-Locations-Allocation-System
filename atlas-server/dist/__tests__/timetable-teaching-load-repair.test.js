import { prisma } from '../lib/prisma.js';
import { previewTeachingLoadRepair, applyTeachingLoadRepair, } from '../services/timetable-teaching-load-repair.service.js';
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
        console.error('\nMissing seeded officer account for Teaching Load repair integration test.');
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
            code: `TEST-TLR-SUB-${Date.now()}`,
            name: 'TLR Test Subject',
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
            externalId: 30006,
            name: '7-TLR Test Section',
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
            externalId: 40006,
            firstName: 'TLR Test',
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
    // 5. Seed SectionSnapshot
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
                            name: '7-TLR Test Section',
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
                            name: '7-TLR Test Section',
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
            name: 'Test TLR Room',
            type: 'CLASSROOM',
            capacity: 40,
            isTeachingSpace: true,
        }
    });
    try {
        section('TL-REPAIR-01: UNASSIGNED preview identifies current owner and lists suggestions');
        const unassignedKey = `${sectionRec.externalId}:${subject.id}:1:SECTION`;
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
                        facultyId: null, // Unassigned
                        homeRoomId: room.id,
                    },
                ],
            },
        });
        createdRunIds.push(run.id);
        // First, clear any prior ownership records for this section-subject
        await prisma.subjectSectionOwnership.deleteMany({
            where: { schoolId, subjectId: subject.id, sectionId: sectionRec.externalId },
        });
        const previewRes = await previewTeachingLoadRepair(run.id, schoolId, schoolYearId, {
            changes: [
                {
                    kind: 'UNASSIGNED',
                    unassignedKey,
                    subjectId: subject.id,
                    sectionId: sectionRec.externalId,
                    session: 1,
                    entryKind: 'SECTION',
                    fromFacultyId: null,
                    toFacultyId: faculty.id,
                },
            ],
        });
        assertEqual(previewRes.unassignedReadiness.length, 1, 'Returns 1 unassigned readiness item');
        assertEqual(previewRes.unassignedReadiness[0].currentOwnerId, null, 'Identifies current canonical owner as null');
        assertEqual(previewRes.unassignedReadiness[0].proposedOwnerId, faculty.id, 'Identifies proposed owner correctly');
        assertEqual(previewRes.unassignedReadiness[0].canPlaceNow, true, 'Proposed teacher has conflict-free slots');
        assert(previewRes.unassignedReadiness[0].suggestedPlacements.length > 0, 'Lists at least one placement suggestion');
        section('TL-REPAIR-02: UNASSIGNED apply updates canonical ownership and keeps item visible');
        const initialRunsCount = await prisma.generationRun.count();
        const applyRes = await applyTeachingLoadRepair(run.id, schoolId, schoolYearId, officer.id, {
            expectedRunVersion: run.version,
            changes: [
                {
                    kind: 'UNASSIGNED',
                    unassignedKey,
                    subjectId: subject.id,
                    sectionId: sectionRec.externalId,
                    session: 1,
                    entryKind: 'SECTION',
                    fromFacultyId: null,
                    toFacultyId: faculty.id,
                },
            ],
        });
        assertEqual(applyRes.newVersion, run.version + 1, 'Version incremented successfully');
        const finalRunsCount = await prisma.generationRun.count();
        assertEqual(finalRunsCount, initialRunsCount, 'No new generation run was created');
        // Check database updates
        const persistedOwnership = await prisma.subjectSectionOwnership.findUnique({
            where: { schoolId_subjectId_sectionId: { schoolId, subjectId: subject.id, sectionId: sectionRec.externalId } },
        });
        assert(persistedOwnership !== null, 'SubjectSectionOwnership record created');
        assertEqual(persistedOwnership?.facultyId, faculty.id, 'SubjectSectionOwnership lists correct teacher');
        const persistedFacultySubject = await prisma.facultySubject.findUnique({
            where: { facultyId_subjectId: { facultyId: faculty.id, subjectId: subject.id } },
        });
        assert(Boolean(persistedFacultySubject?.sectionIds.includes(sectionRec.externalId)), 'FacultySubject sectionIds lists section ID');
        // Verify unassigned item remains visible (was not placed)
        assertEqual(applyRes.draft.unassignedItems.length, 1, 'Unassigned item remains in list when not placed');
        assertEqual(applyRes.draft.entries.length, 0, 'No entry created in timetable grid');
        section('TL-REPAIR-03: Placement removes unassigned item and inserts scheduled entry');
        const suggestion = previewRes.unassignedReadiness[0].suggestedPlacements[0];
        assert(suggestion !== undefined, 'Suggested placement exists');
        const placementApplyRes = await applyTeachingLoadRepair(run.id, schoolId, schoolYearId, officer.id, {
            expectedRunVersion: applyRes.newVersion,
            changes: [
                {
                    kind: 'UNASSIGNED',
                    unassignedKey,
                    subjectId: subject.id,
                    sectionId: sectionRec.externalId,
                    session: 1,
                    entryKind: 'SECTION',
                    fromFacultyId: null,
                    toFacultyId: faculty.id,
                },
            ],
            placementProposal: suggestion,
        });
        assertEqual(placementApplyRes.draft.unassignedItems.length, 0, 'Unassigned item removed after placement succeeds');
        assertEqual(placementApplyRes.draft.entries.length, 1, 'Scheduled entry inserted into timetable grid');
        section('TL-REPAIR-04: Conflict blocks and rolls back');
        // Attempting to place another unassigned item that overlaps or conflicts with the existing entry
        // Let's create another unassigned item in the same section, subject, and same slot
        const conflictingRun = await prisma.generationRun.create({
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
                    classesProcessed: 2,
                    assignedCount: 1,
                    unassignedCount: 1,
                    hardViolationCount: 0,
                    softViolationCount: 0,
                    timetableDisplaySlots: [
                        { startTime: '08:00', endTime: '09:00' },
                    ],
                },
                violations: [],
                draftEntries: [
                    {
                        entryId: 'existing-occupied-entry',
                        facultyId: faculty.id,
                        roomId: room.id,
                        subjectId: subject.id,
                        sectionId: sectionRec.externalId,
                        day: suggestion.targetDay,
                        startTime: suggestion.targetStartTime,
                        endTime: suggestion.targetEndTime,
                        durationMinutes: 60,
                        entryKind: 'SECTION',
                    },
                ],
                unassignedItems: [
                    {
                        sectionId: sectionRec.externalId,
                        subjectId: subject.id,
                        gradeLevel: 7,
                        session: 2,
                        reason: 'NO_AVAILABLE_SLOT',
                        facultyId: null,
                        homeRoomId: room.id,
                    },
                ],
            },
        });
        createdRunIds.push(conflictingRun.id);
        const conflictUnassignedKey = `${sectionRec.externalId}:${subject.id}:2:SECTION`;
        let hasThrownConflict = false;
        try {
            // Propose to place in the exact same slot occupied by 'existing-occupied-entry'
            await applyTeachingLoadRepair(conflictingRun.id, schoolId, schoolYearId, officer.id, {
                expectedRunVersion: conflictingRun.version,
                changes: [
                    {
                        kind: 'UNASSIGNED',
                        unassignedKey: conflictUnassignedKey,
                        subjectId: subject.id,
                        sectionId: sectionRec.externalId,
                        session: 2,
                        entryKind: 'SECTION',
                        fromFacultyId: null,
                        toFacultyId: faculty.id,
                    },
                ],
                placementProposal: {
                    editType: 'PLACE_UNASSIGNED',
                    sectionId: sectionRec.externalId,
                    subjectId: subject.id,
                    session: 2,
                    targetDay: suggestion.targetDay,
                    targetStartTime: suggestion.targetStartTime,
                    targetEndTime: suggestion.targetEndTime,
                    targetRoomId: room.id,
                    targetFacultyId: faculty.id,
                },
            });
        }
        catch (e) {
            hasThrownConflict = true;
            assertEqual(e.statusCode, 422, 'Conflicting placement fails validation with 422');
            assertEqual(e.code, 'HARD_VIOLATION_BLOCK', 'Conflicting placement returns HARD_VIOLATION_BLOCK');
        }
        assert(hasThrownConflict, 'Conflicting placement blocks and throws error');
        // Verify database was rolled back (generation run not mutated)
        const rollbackCheckRun = await prisma.generationRun.findUnique({
            where: { id: conflictingRun.id },
        });
        assertEqual((rollbackCheckRun?.draftEntries).length, 1, 'Draft entries rolled back');
        assertEqual((rollbackCheckRun?.unassignedItems).length, 1, 'Unassigned items rolled back');
        section('TL-REPAIR-05: Published run blocks canonical repair');
        const publishedRun = await prisma.generationRun.create({
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
                    publishedAt: new Date().toISOString(), // Published marker
                },
                violations: [],
                draftEntries: [],
                unassignedItems: [],
            },
        });
        createdRunIds.push(publishedRun.id);
        let hasThrownPublished = false;
        try {
            await applyTeachingLoadRepair(publishedRun.id, schoolId, schoolYearId, officer.id, {
                expectedRunVersion: publishedRun.version,
                changes: [
                    {
                        kind: 'UNASSIGNED',
                        unassignedKey,
                        subjectId: subject.id,
                        sectionId: sectionRec.externalId,
                        session: 1,
                        entryKind: 'SECTION',
                        fromFacultyId: null,
                        toFacultyId: faculty.id,
                    },
                ],
            });
        }
        catch (e) {
            hasThrownPublished = true;
            assertEqual(e.statusCode, 409, 'Published run blocks with 409');
            assertEqual(e.code, 'RUN_ALREADY_PUBLISHED', 'Published run returns RUN_ALREADY_PUBLISHED');
        }
        assert(hasThrownPublished, 'Published run blocks apply');
    }
    finally {
        console.log('\nCleaning up mock data...');
        await prisma.generationRun.deleteMany({ where: { id: { in: createdRunIds } } });
        await prisma.subjectSectionOwnership.deleteMany({ where: { id: { in: createdOwnershipIds } } });
        await prisma.facultySubject.deleteMany({ where: { id: { in: createdFacultySubjectIds } } });
        await prisma.facultyMirror.deleteMany({ where: { id: { in: createdFacultyIds } } });
        await prisma.sectionMirror.deleteMany({ where: { id: { in: createdSectionIds } } });
        await prisma.subject.deleteMany({ where: { id: { in: createdSubjectIds } } });
        if (hasSnapshotExisted) {
            await prisma.sectionSnapshot.update({
                where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
                data: { payload: originalSnapshotPayload },
            });
        }
        else {
            await prisma.sectionSnapshot.deleteMany({
                where: { schoolId, schoolYearId },
            });
        }
    }
    console.log(`\nTests finished: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run().catch((e) => {
    console.error('Unhandled test error:', e);
    process.exit(1);
});
//# sourceMappingURL=timetable-teaching-load-repair.test.js.map