const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
async function main() {
  // The 9 core BEC subjects that SHOULD be active
  const bceCodes = ['FIL', 'ENG', 'MATH', 'SCI', 'AP', 'MAPEH', 'ESP', 'TLE', 'HG'];
  
  // Get all active subjects
  const active = await p.subject.findMany({ 
    where: { schoolId: 1, isActive: true },
    select: { id: true, code: true, isSeedable: true, programScopes: true }
  });
  
  console.log('All active subjects (', active.length, '):');
  active.forEach(s => console.log(`  id=${s.id} code=${s.code} seedable=${s.isSeedable} scopes=${JSON.stringify(s.programScopes)}`));
  
  // Identify subjects to deactivate (anything that's NOT in bceCodes set)
  const toDeactivate = active.filter(s => !bceCodes.includes(s.code));
  console.log('\nSubjects to deactivate (', toDeactivate.length, '):');
  toDeactivate.forEach(s => console.log(`  id=${s.id} code=${s.code}`));
  
  // Actually deactivate them
  if (toDeactivate.length > 0) {
    const result = await p.subject.updateMany({
      where: { id: { in: toDeactivate.map(s => s.id) } },
      data: { isActive: false }
    });
    console.log('\nDeactivated', result.count, 'subjects');
  }
  
  // Verify BEC subjects are still active
  const remaining = await p.subject.count({ where: { schoolId: 1, isActive: true } });
  console.log('Remaining active subjects:', remaining);
  
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); });
