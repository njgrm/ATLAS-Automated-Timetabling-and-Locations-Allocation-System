import { PrismaClient } from '../../node_modules/.prisma/client/index.js';

const p = new PrismaClient();

async function main() {
  // Check locked sessions for subject 10 (ICT)
  const lockedICT = await p.lockedSession.findMany({
    where: { schoolId: 1, schoolYearId: 1, subjectId: 10 }
  });
  console.log('Locked sessions for ICT (subject 10):', lockedICT.length);
  if (lockedICT.length > 0) {
    console.log('Sample:', JSON.stringify(lockedICT.slice(0, 3), null, 2));
  }

  // Check all locked sessions 
  const allLocked = await p.lockedSession.count({ where: { schoolId: 1, schoolYearId: 1 } });
  console.log('All locked sessions:', allLocked);

  // Check pre-generation draft placements
  const allDrafts = await p.preGenerationDraftPlacement.count({ where: { schoolId: 1, schoolYearId: 1 } });
  console.log('All pre-gen draft placements:', allDrafts);

  const ictDrafts = await p.preGenerationDraftPlacement.findMany({
    where: { schoolId: 1, schoolYearId: 1, subjectId: 10 }
  });
  console.log('Pre-gen draft placements for ICT:', ictDrafts.length);

  // Check faculty assignments for subject 10 (ICT)
  const ictAssignments = await p.facultySubject.findMany({
    where: { schoolId: 1, subjectId: 10 },
    select: { id: true, facultyId: true, gradeLevels: true, sectionIds: true }
  });
  console.log('Faculty assignments for ICT:', JSON.stringify(ictAssignments, null, 2));

  // Check all faculty assignments to understand the scope
  const allAssignments = await p.facultySubject.count({ where: { schoolId: 1 } });
  console.log('Total faculty-subject assignments:', allAssignments);

  // Check what subjects have NO assignments
  const subjectsWithAssignments = await p.facultySubject.groupBy({
    by: ['subjectId'],
    where: { schoolId: 1 }
  });
  const coveredSubjectIds = new Set(subjectsWithAssignments.map(s => s.subjectId));
  
  const allSubjects = await p.subject.findMany({ where: { schoolId: 1 }, select: { id: true, code: true, name: true } });
  const uncovered = allSubjects.filter(s => !coveredSubjectIds.has(s.id));
  console.log('\nSubjects with NO faculty assignments:');
  uncovered.forEach(s => console.log(`  id=${s.id} code=${s.code} ${s.name}`));

  // Check generation run 2 violations breakdown
  const run2 = await p.scheduleRun.findUnique({ where: { id: 2 }, select: { id: true, summary: true } });
  if (run2?.summary) {
    const summary = run2.summary;
    console.log('\nRun 2 summary:');
    console.log('  hardViolationCount:', summary.hardViolationCount);
    if (Array.isArray(summary.violations)) {
      const byType = {};
      summary.violations.forEach((v) => {
        byType[v.type] = (byType[v.type] || 0) + 1;
      });
      console.log('  Violations by type:', JSON.stringify(byType));
    }
  }
}

main().finally(() => p.$disconnect());
