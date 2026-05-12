/**
 * Seed a section snapshot for schoolId=1, schoolYearId=1 using the same
 * stub data as StubSectionAdapter. This lets the auto-mode section adapter
 * fall back to this snapshot when EnrollPro is unavailable.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const STUB_SECTIONS = [
  {
    gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7,
    sections: [
      { id: 1, name: '7-Rizal', maxCapacity: 40, enrolledCount: 35, gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' },
      { id: 2, name: '7-Bonifacio', maxCapacity: 40, enrolledCount: 32, gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' },
      { id: 3, name: '7-STE', maxCapacity: 40, enrolledCount: 38, gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'STE', programCode: 'STE', programName: 'Science, Technology, and Engineering' },
    ],
  },
  {
    gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8,
    sections: [
      { id: 4, name: '8-Aquino', maxCapacity: 40, enrolledCount: 30, gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8, programType: 'REGULAR' },
      { id: 5, name: '8-Quezon', maxCapacity: 40, enrolledCount: 36, gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8, programType: 'REGULAR' },
      { id: 6, name: '8-STE', maxCapacity: 40, enrolledCount: 33, gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8, programType: 'STE', programCode: 'STE', programName: 'Science, Technology, and Engineering' },
    ],
  },
  {
    gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9,
    sections: [
      { id: 7, name: '9-Luna', maxCapacity: 40, enrolledCount: 28, gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9, programType: 'REGULAR' },
      { id: 8, name: '9-SPS', maxCapacity: 40, enrolledCount: 37, gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9, programType: 'SPS', programCode: 'SPS', programName: 'Special Program in Sports' },
    ],
  },
  {
    gradeLevelId: 4, gradeLevelName: 'Grade 10', displayOrder: 10,
    sections: [
      { id: 9, name: '10-Recto', maxCapacity: 40, enrolledCount: 34, gradeLevelId: 4, gradeLevelName: 'Grade 10', displayOrder: 10, programType: 'REGULAR' },
      { id: 10, name: '10-SPA', maxCapacity: 40, enrolledCount: 31, gradeLevelId: 4, gradeLevelName: 'Grade 10', displayOrder: 10, programType: 'SPA', programCode: 'SPA', programName: 'Special Program in the Arts' },
    ],
  },
];

const snapshot = await prisma.sectionSnapshot.upsert({
  where: { schoolId_schoolYearId: { schoolId: 1, schoolYearId: 1 } },
  update: {
    payload: STUB_SECTIONS,
    source: 'stub',
    fetchedAt: new Date(),
    checksum: 'stub-seed',
  },
  create: {
    schoolId: 1,
    schoolYearId: 1,
    payload: STUB_SECTIONS,
    source: 'stub',
    fetchedAt: new Date(),
    checksum: 'stub-seed',
  },
});
console.log(`Section snapshot upserted: id=${snapshot.id}, schoolId=${snapshot.schoolId}, schoolYearId=${snapshot.schoolYearId}, sections=10`);
await prisma.$disconnect();
