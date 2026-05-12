const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
async function main() {
  // Check subjects that are causing violations
  const subjectIds = [10, 11, 12, 13, 14, 15, 17, 20, 36, 47];
  const subjects = await p.subject.findMany({ 
    where: { id: { in: subjectIds } },
    select: { id: true, code: true, isSeedable: true, programScopes: true, gradeLevels: true }
  });
  subjects.forEach(s => console.log(JSON.stringify(s)));
  
  // Check ICT specifically
  const ict = await p.subject.findFirst({ where: { schoolId: 1, code: 'ICT' } });
  console.log('ICT isSeedable:', ict?.isSeedable, 'programScopes:', ict?.programScopes);
  
  // Check faculty assignments for subjects in violation
  const assignments = await p.facultySubject.findMany({ 
    where: { schoolId: 1, subjectId: { in: subjectIds } },
    select: { facultyId: true, subjectId: true }
  });
  console.log('Assignments for violation subjects:', JSON.stringify(assignments));
  
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); });
