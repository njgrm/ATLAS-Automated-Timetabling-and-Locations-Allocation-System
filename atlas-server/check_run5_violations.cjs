const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
async function main() {
  const run = await p.generationRun.findUnique({
    where: { id: 5 },
    select: { id: true, violations: true }
  });
  if (!run) { console.log('Run 5 not found'); return; }
  const viols = run.violations || [];
  const hard = viols.filter(v => v.severity === 'HARD');
  console.log('Hard violation count:', hard.length);
  
  // Group by subjectId
  const bySubject = {};
  for (const v of hard) {
    const sub = v.entities?.subjectId || 'unknown';
    bySubject[sub] = (bySubject[sub] || 0) + 1;
  }
  console.log('Violations by subjectId:', JSON.stringify(bySubject));
  
  // Group by faculty
  const byFaculty = {};
  for (const v of hard) {
    const fac = v.entities?.facultyId || 'unknown';
    byFaculty[fac] = (byFaculty[fac] || 0) + 1;
  }
  console.log('Violations by facultyId:', JSON.stringify(byFaculty));
  
  // Show first 3 violations  
  console.log('First 3 violations:', JSON.stringify(hard.slice(0,3), null, 2));
  
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); });
