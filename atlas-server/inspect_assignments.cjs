const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
p.facultySubject.findMany({ where: { schoolId: 1 }, select: { id: true, facultyId: true, subjectId: true, sectionIds: true, gradeLevels: true } })
.then(r => { 
  console.log('Total assignments:', r.length);
  r.forEach(a => console.log(JSON.stringify({fac: a.facultyId, sub: a.subjectId, sections: a.sectionIds.length, grades: a.gradeLevels})));
  return p.$disconnect(); 
}).catch(e => { console.error(e); p.$disconnect(); });
