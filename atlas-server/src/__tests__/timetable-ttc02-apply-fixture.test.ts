import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

import { prisma } from '../lib/prisma.js';
import {
  applyUnassignedInsertion,
  previewUnassignedInsertion,
  summarizeUnassignedInsertionReadiness,
} from '../services/timetable-insertion.service.js';

test('TT-C02 pre-generation insertion: zero-write preview, guarded apply, idempotency, ownership immutability, and cleanup', async () => {
  const unique = `${Date.now() % 10_000_000}`;
  const schoolLabel = `TT-C02 DISPOSABLE ${unique}`;

  const actor = await prisma.atlasAuthAccount.findFirst({
    where: { role: { in: ['officer', 'admin'] }, isActive: true },
    orderBy: { id: 'asc' },
  });
  assert(actor, 'A seeded officer/admin account is required for the isolated TT-C02 fixture.');
  const actorId = actor.id;

  // Fully disposable school + year isolation (never touches the live year).
  const createdSchoolIds: number[] = [];
  const createdTermConfigIds: number[] = [];
  const createdPolicyIds: number[] = [];
  const createdSubjectIds: number[] = [];
  const createdSectionIds: number[] = [];
  const createdFacultyIds: number[] = [];
  const createdFacultySubjectIds: number[] = [];
  const createdOwnershipIds: number[] = [];
  const createdOfferingIds: number[] = [];
  const createdBuildingIds: number[] = [];
  const createdRoomIds: number[] = [];
  const createdLockIds: number[] = [];
  const createdLockActionIds: number[] = [];
  const createdAuditIds: number[] = [];

  const subjectCode = `TT${unique.slice(-7)}`;
  const externalSectionId = 7_100_000 + (Date.now() % 1_000_000);
  const externalFacultyId = 8_100_000 + (Date.now() % 1_000_000);
  let disposableScope: { schoolId: number; schoolYearId: number } | null = null;

  try {
    const school = await prisma.school.create({
      data: { name: schoolLabel, shortName: schoolLabel.slice(0, 50) },
    });
    createdSchoolIds.push(school.id);
    const schoolId = school.id;
    const schoolYearId = 900_000 + (Date.now() % 100_000);
    disposableScope = { schoolId, schoolYearId };

    const termConfig = await prisma.schoolYearTermConfig.create({
      data: {
        schoolId,
        schoolYearId,
        termCount: 3,
        termIdentities: ['T1', 'T2', 'T3'],
        isActive: true,
        createdBy: actorId,
      },
    });
    createdTermConfigIds.push(termConfig.id);
    const termIdentity = 'T1';

    const policy = await prisma.schedulingPolicy.create({
      data: {
        schoolId,
        schoolYearId,
        periodLengthMinutes: 45,
        periodsPerDay: 10,
        earliestStartTime: '07:00',
        latestEndTime: '16:30',
      },
    });
    createdPolicyIds.push(policy.id);

    const subject = await prisma.subject.create({
      data: {
        schoolId,
        code: subjectCode,
        name: 'TT-C02 Probe Subject',
        minMinutesPerWeek: 90,
        preferredRoomType: 'CLASSROOM',
        gradeLevels: [7],
        isActive: true,
      },
    });
    createdSubjectIds.push(subject.id);

    const section = await prisma.sectionMirror.create({
      data: {
        schoolId,
        schoolYearId,
        externalId: externalSectionId,
        name: 'TT-C02 Probe Section',
        gradeLevelId: 7,
        gradeLevelName: 'Grade 7',
        displayOrder: 1,
        maxCapacity: 40,
        enrolledCount: 30,
        programType: 'REGULAR',
        isActiveForScheduling: true,
      },
    });
    createdSectionIds.push(section.id);

    const faculty = await prisma.facultyMirror.create({
      data: {
        schoolId,
        externalId: externalFacultyId,
        firstName: 'TTC02',
        lastName: 'Probe',
        department: 'Math',
        employmentStatus: 'PERMANENT',
        isActiveForScheduling: true,
        maxHoursPerWeek: 30,
      },
    });
    createdFacultyIds.push(faculty.id);

    const facultySubject = await prisma.facultySubject.create({
      data: {
        schoolId,
        schoolYearId,
        facultyId: faculty.id,
        subjectId: subject.id,
        gradeLevels: [7],
        sectionIds: [section.externalId],
        assignedBy: actorId,
      },
    });
    createdFacultySubjectIds.push(facultySubject.id);

    const ownership = await prisma.subjectSectionOwnership.create({
      data: {
        schoolId,
        schoolYearId,
        subjectId: subject.id,
        sectionId: section.externalId,
        facultySubjectId: facultySubject.id,
        facultyId: faculty.id,
      },
    });
    createdOwnershipIds.push(ownership.id);

    const offering = await prisma.schoolYearOffering.create({
      data: {
        schoolId,
        schoolYearId,
        termConfigId: termConfig.id,
        subjectId: subject.id,
        gradeLevel: 7,
        programType: 'REGULAR',
        sectionMirrorId: section.id,
        cohortId: null,
        classification: 'CORE',
        weeklyMinutes: 90,
        rotationFamily: null,
        rotationOrder: null,
        termMode: 'ALL',
        isActive: true,
        createdBy: actorId,
      },
    });
    createdOfferingIds.push(offering.id);

    const building = await prisma.building.create({
      data: { schoolId, name: 'TT-C02 Probe Building', gradeScope: [] },
    });
    createdBuildingIds.push(building.id);
    const room = await prisma.room.create({
      data: {
        buildingId: building.id,
        name: 'TT-C02 Probe Room',
        type: 'CLASSROOM',
        capacity: 45,
        isTeachingSpace: true,
        isSharedFacility: false,
      },
    });
    createdRoomIds.push(room.id);

    const ownershipBefore = await prisma.subjectSectionOwnership.findMany({
      where: { schoolId, schoolYearId, subjectId: subject.id },
    });
    const facultyVersionBefore = (
      await prisma.facultyMirror.findUniqueOrThrow({ where: { id: faculty.id } })
    ).version;
    const offeringVersionBefore = (
      await prisma.schoolYearOffering.findUniqueOrThrow({ where: { id: offering.id } })
    ).version;

    const summary = await summarizeUnassignedInsertionReadiness(schoolId, schoolYearId);
    const demandKey = `${subject.id}:${section.externalId}:${termIdentity}`;
    const targetLine = summary.lineStates.find((line) => line.demandKey === demandKey);
    assert(targetLine, 'disposable demand line must appear in the canonical demand projection');
    assert.equal(targetLine.state, 'PLACEABLE', 'valid owner + disposable room must be placeable');
    assert.ok(targetLine.candidates.length >= 1, 'placeable line must expose candidate slots');

    // Zero-write preview negative control.
    const lockCountBefore = await prisma.lockedSession.count({ where: { schoolId, schoolYearId } });
    const auditCountBefore = await prisma.auditLog.count({
      where: { schoolId, schoolYearId, action: 'TIMETABLE_INSERTION_APPLIED' },
    });

    const preview = await previewUnassignedInsertion(schoolId, schoolYearId, demandKey);
    assert.equal(preview.zeroWrite, true);
    assert.match(preview.fingerprint, /^TTI_[0-9A-F]{64}$/);
    assert.ok(preview.candidates.length >= 1);
    assert.equal(
      await prisma.lockedSession.count({ where: { schoolId, schoolYearId } }),
      lockCountBefore,
      'preview is zero-write: no LockedSession row may be created',
    );
    assert.equal(
      await prisma.auditLog.count({ where: { schoolId, schoolYearId, action: 'TIMETABLE_INSERTION_APPLIED' } }),
      auditCountBefore,
      'preview is zero-write: no audit log row may be created',
    );

    // Apply writes exactly one draft row + one action + one audit log.
    const result = await applyUnassignedInsertion({
      schoolId,
      schoolYearId,
      actorId,
      actorSchoolId: schoolId,
      previewFingerprint: preview.fingerprint,
      confirm: true,
      demandKey,
      candidateIndex: 0,
    });
    assert.equal(result.applied, true);
    assert.equal(result.alreadyApplied, false);
    assert.ok(result.lockedSessionId);
    assert.ok(result.auditLogId);
    createdLockIds.push(result.lockedSessionId as number);
    createdAuditIds.push(result.auditLogId as number);
    const actionRows = await prisma.lockedSessionAction.findMany({
      where: { lockId: result.lockedSessionId as number },
    });
    assert.equal(actionRows.length, 1, 'apply must write one LockedSessionAction for undo/audit');
    createdLockActionIds.push(...actionRows.map((row) => row.id));

    // Ownership immutability: Teaching Load/curriculum/subjects/sections are
    // never modified by an insertion apply.
    const ownershipAfter = await prisma.subjectSectionOwnership.findMany({
      where: { schoolId, schoolYearId, subjectId: subject.id },
    });
    assert.deepEqual(
      ownershipAfter.map((row) => ({ id: row.id, facultyId: row.facultyId, facultySubjectId: row.facultySubjectId })),
      ownershipBefore.map((row) => ({ id: row.id, facultyId: row.facultyId, facultySubjectId: row.facultySubjectId })),
      'apply must never update SubjectSectionOwnership',
    );
    const facultyVersionAfter = (
      await prisma.facultyMirror.findUniqueOrThrow({ where: { id: faculty.id } })
    ).version;
    assert.equal(facultyVersionAfter, facultyVersionBefore, 'apply must never bump the faculty optimistic version');
    const offeringVersionAfter = (
      await prisma.schoolYearOffering.findUniqueOrThrow({ where: { id: offering.id } })
    ).version;
    assert.equal(offeringVersionAfter, offeringVersionBefore, 'apply must never touch curriculum offerings');

    // Idempotency: applying the same fingerprint again is a no-op.
    const second = await applyUnassignedInsertion({
      schoolId,
      schoolYearId,
      actorId,
      actorSchoolId: schoolId,
      previewFingerprint: preview.fingerprint,
      confirm: true,
      demandKey,
      candidateIndex: 0,
    });
    assert.equal(second.applied, false);
    assert.equal(second.alreadyApplied, true, 'the exact fingerprint must be idempotent');
    assert.equal(
      await prisma.lockedSession.count({ where: { id: result.lockedSessionId as number } }),
      1,
      'idempotent retry must not create a second LockedSession row',
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          schoolId,
          schoolYearId,
          action: 'TIMETABLE_INSERTION_APPLIED',
          metadata: { path: ['previewFingerprint'], equals: preview.fingerprint },
        },
      }),
      1,
      'idempotent retry must not create a second audit row',
    );

    // Stale-source/fingerprint rejection: tampered fingerprint fails closed.
    const freshPreview = await previewUnassignedInsertion(schoolId, schoolYearId, demandKey);
    const tampered = freshPreview.fingerprint.slice(0, -1) + (freshPreview.fingerprint.endsWith('A') ? 'B' : 'A');
    await assert.rejects(
      applyUnassignedInsertion({
        schoolId,
        schoolYearId,
        actorId,
        actorSchoolId: schoolId,
        previewFingerprint: tampered,
        confirm: true,
        demandKey,
        candidateIndex: 0,
      }),
      (error: Error & { code?: string }) => error.code === 'INSERTION_STALE_AUTHORITY',
      'a drifted fingerprint must reject with INSERTION_STALE_AUTHORITY',
    );
    assert.equal(
      await prisma.lockedSession.count({ where: { schoolId, schoolYearId } }),
      lockCountBefore + createdLockIds.length,
      'a rejected stale apply must not add draft rows',
    );

    // The inserted draft row carries the expected section/subject/day/time.
    const inserted = await prisma.lockedSession.findUniqueOrThrow({
      where: { id: result.lockedSessionId as number },
    });
    assert.equal(inserted.sectionId, section.externalId);
    assert.equal(inserted.subjectId, subject.id);
    assert.equal(inserted.facultyId, faculty.id);
    assert.equal(inserted.status, 'DRAFT');
    assert.ok(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(String(inserted.day)));
  } finally {
    // Deterministic catch-all cleanup for the disposable school/year scope
    // BEFORE id-based deletes: even a mid-test failure cannot leave orphan
    // locks/actions/audits/offerings/ownership rows in the shared database.
    if (disposableScope) {
      const { schoolId, schoolYearId } = disposableScope;
      await prisma.auditLog.deleteMany({ where: { schoolId, schoolYearId, action: 'TIMETABLE_INSERTION_APPLIED' } });
      await prisma.lockedSessionAction.deleteMany({ where: { schoolId, schoolYearId, actionType: 'INSERT_UNASSIGNED_MEETING' } });
      await prisma.lockedSession.deleteMany({ where: { schoolId, schoolYearId } });
      await prisma.schoolYearOffering.deleteMany({ where: { schoolId, schoolYearId } });
      await prisma.subjectSectionOwnership.deleteMany({ where: { schoolId, schoolYearId } });
      await prisma.facultySubject.deleteMany({ where: { schoolId, schoolYearId } });
      await prisma.schedulingPolicy.deleteMany({ where: { schoolId, schoolYearId } });
      await prisma.schoolYearTermConfig.deleteMany({ where: { schoolId, schoolYearId } });
    }
    if (createdAuditIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
    }
    if (createdLockActionIds.length > 0) {
      await prisma.lockedSessionAction.deleteMany({ where: { id: { in: createdLockActionIds } } });
    }
    if (createdLockIds.length > 0) {
      await prisma.lockedSession.deleteMany({ where: { id: { in: createdLockIds } } });
    }
    if (createdOfferingIds.length > 0) {
      await prisma.schoolYearOffering.deleteMany({ where: { id: { in: createdOfferingIds } } });
    }
    if (createdOwnershipIds.length > 0) {
      await prisma.subjectSectionOwnership.deleteMany({ where: { id: { in: createdOwnershipIds } } });
    }
    if (createdFacultySubjectIds.length > 0) {
      await prisma.facultySubject.deleteMany({ where: { id: { in: createdFacultySubjectIds } } });
    }
    if (createdRoomIds.length > 0) {
      await prisma.room.deleteMany({ where: { id: { in: createdRoomIds } } });
    }
    if (createdBuildingIds.length > 0) {
      await prisma.building.deleteMany({ where: { id: { in: createdBuildingIds } } });
    }
    if (createdFacultyIds.length > 0) {
      await prisma.facultyMirror.deleteMany({ where: { id: { in: createdFacultyIds } } });
    }
    if (createdSectionIds.length > 0) {
      await prisma.sectionMirror.deleteMany({ where: { id: { in: createdSectionIds } } });
    }
    if (createdSubjectIds.length > 0) {
      await prisma.subject.deleteMany({ where: { id: { in: createdSubjectIds } } });
    }
    if (createdPolicyIds.length > 0) {
      await prisma.schedulingPolicy.deleteMany({ where: { id: { in: createdPolicyIds } } });
    }
    if (createdTermConfigIds.length > 0) {
      await prisma.schoolYearTermConfig.deleteMany({ where: { id: { in: createdTermConfigIds } } });
    }
    if (createdSchoolIds.length > 0) {
      await prisma.school.deleteMany({ where: { id: { in: createdSchoolIds } } });
    }
    const residueSubject = await prisma.subject.findMany({ where: { code: subjectCode } });
    assert.equal(residueSubject.length, 0, 'fixture cleanup must leave zero disposable subject rows');
    const residueSchool = await prisma.school.findMany({ where: { name: schoolLabel } });
    assert.equal(residueSchool.length, 0, 'fixture cleanup must leave zero disposable school rows');
    await prisma.$disconnect();
  }
});
