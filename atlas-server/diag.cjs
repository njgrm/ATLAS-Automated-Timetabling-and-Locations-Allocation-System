process.env.DATABASE_URL = 'postgresql://atlas_user:incorrect404@localhost:5432/atlas_db?schema=public';
const { PrismaClient } = require('./node_modules/.prisma/client/default.js');
const p = new PrismaClient();

async function main() {
  const f = await p.facultyMirror.findMany({ where: { id: { in: [1,2] }}, select: { id:true, firstName:true, lastName:true, isStale:true, isActiveForScheduling:true }});
  console.log('Faculty 1&2:', JSON.stringify(f));
  
  const ict = await p.subject.findFirst({ where: {id:10, schoolId:1}, select:{id:true,code:true,isSeedable:true}});
  console.log('Subject 10:', JSON.stringify(ict));
  
  const n = await p.facultySubject.count({where:{subjectId:10}});
  console.log('ICT assignments:', n);

  // Check if any section snapshot includes ICT  
  const snap = await p.sectionSnapshot.findFirst({ where: { schoolId:1 }, select: { id:true } });
  console.log('Section snapshot:', JSON.stringify(snap));
  
  // Check all active non-stale faculty count
  const activeCount = await p.facultyMirror.count({ where: { isStale: false, isActiveForScheduling: true, schoolId: 1 }});
  console.log('Active non-stale faculty:', activeCount);
  
  // Check total faculty subject assignments  
  const assignCount = await p.facultySubject.count({ where: { schoolId: 1 }});
  console.log('Total assignments:', assignCount);
  
  // Get unique subjects in assignments
  const subjects = await p.facultySubject.groupBy({ by: ['subjectId'], _count: { subjectId: true }, where: { schoolId: 1 }});
  console.log('Subjects with assignments:', JSON.stringify(subjects));
}
main().catch(e=>console.error(e)).finally(()=>p.$disconnect());
