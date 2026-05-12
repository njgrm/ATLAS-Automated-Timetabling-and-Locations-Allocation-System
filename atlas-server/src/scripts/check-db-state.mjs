// Diagnostic script — check current faculty/assignment DB state
import { PrismaClient } from '../../../atlas-server/node_modules/.prisma/client/default.js';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

try {
  const [active, stale, assignmentCount, aliasCount] = await Promise.all([
    prisma.facultyMirror.count({ where: { schoolId: 1, isStale: false } }),
    prisma.facultyMirror.count({ where: { schoolId: 1, isStale: true } }),
    prisma.facultySubject.count({ where: { schoolId: 1 } }),
    prisma.specializationAlias.count({ where: { schoolId: 1 } }),
  ]);

  // Sample department/specialization values from active faculty
  const depts = await prisma.facultyMirror.findMany({
    where: { schoolId: 1, isStale: false },
    select: { department: true, specialization: true },
    orderBy: { department: 'asc' },
  });

  // Count by department
  const deptCounts = {};
  for (const f of depts) {
    const key = `dept=${f.department ?? 'null'} / spec=${f.specialization ?? 'null'}`;
    deptCounts[key] = (deptCounts[key] ?? 0) + 1;
  }

  // Current assignments
  const assignments = await prisma.facultySubject.findMany({
    where: { schoolId: 1 },
    include: { faculty: { select: { firstName: true, lastName: true, isStale: true } }, subject: { select: { code: true } } },
    take: 10,
  });

  // Subject allowedSpecializations
  const subjects = await prisma.subject.findMany({
    where: { schoolId: 1, isSeedable: true },
    select: { code: true, allowedSpecializations: true },
  });

  console.log(JSON.stringify({ active, stale, assignmentCount, aliasCount, deptCounts, assignments, subjects }, null, 2));
} finally {
  await prisma.$disconnect();
}
