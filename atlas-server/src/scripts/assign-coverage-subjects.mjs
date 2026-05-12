import { createRequire } from 'module';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://atlas_user:incorrect404@localhost:5432/atlas_db?schema=public';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../node_modules/.prisma/client/default.js');

const prisma = new PrismaClient();

const TARGET_SUBJECT_IDS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 36, 37, 38, 39, 40, 44, 46, 47];

async function main() {
  const schoolId = 1;
  const assignedBy = 1;

  const faculty = await prisma.facultyMirror.findMany({
    where: {
      schoolId,
      isActiveForScheduling: true,
      isStale: false,
    },
    select: { id: true },
  });

  const subjects = await prisma.subject.findMany({
    where: {
      schoolId,
      id: { in: TARGET_SUBJECT_IDS },
      isActive: true,
    },
    select: { id: true, code: true, gradeLevels: true },
  });

  let created = 0;
  let updated = 0;

  for (const f of faculty) {
    for (const s of subjects) {
      const rec = await prisma.facultySubject.upsert({
        where: {
          facultyId_subjectId: {
            facultyId: f.id,
            subjectId: s.id,
          },
        },
        update: {
          schoolId,
          assignedBy,
          gradeLevels: s.gradeLevels.length > 0 ? s.gradeLevels : [7, 8, 9, 10],
        },
        create: {
          facultyId: f.id,
          subjectId: s.id,
          schoolId,
          assignedBy,
          gradeLevels: s.gradeLevels.length > 0 ? s.gradeLevels : [7, 8, 9, 10],
          sectionIds: [],
        },
      });

      if (rec.createdAt.getTime() === rec.updatedAt.getTime()) {
        created += 1;
      } else {
        updated += 1;
      }
    }
  }

  console.log(`Active faculty: ${faculty.length}`);
  console.log(`Target subjects: ${subjects.length}`);
  console.log(`Created/updated assignment rows touched: ${created + updated}`);
  console.log(`Created (approx): ${created}`);
  console.log(`Updated (approx): ${updated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
