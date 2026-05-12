const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
async function main() {
  const active = await p.facultyMirror.count({ where: { schoolId: 1, isActiveForScheduling: true } });
  const stale = await p.facultyMirror.count({ where: { schoolId: 1, isStale: true } });
  const total = await p.facultyMirror.count({ where: { schoolId: 1 } });
  console.log('Active for scheduling:', active, '| Stale:', stale, '| Total:', total);
  
  // Check stub faculty (externalId 1-20)
  const stubs = await p.facultyMirror.findMany({ 
    where: { schoolId: 1, externalId: { in: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20] } },
    select: { id: true, externalId: true, firstName: true, lastName: true, isStale: true, isActiveForScheduling: true }
  });
  console.log('Stub faculty sample:', JSON.stringify(stubs.slice(0,3)));
  
  // Count faculty with assignments
  const withAssign = await p.facultySubject.findMany({ where: { schoolId: 1 }, select: { facultyId: true } });
  const uniqueFac = new Set(withAssign.map(a => a.facultyId));
  console.log('Faculty with assignments:', uniqueFac.size);
  
  // Check if those faculty are active
  const assignedFac = await p.facultyMirror.findMany({ 
    where: { id: { in: [...uniqueFac] }, isActiveForScheduling: true },
    select: { id: true }
  });
  console.log('Assigned faculty that are active:', assignedFac.length);
  
  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); });
