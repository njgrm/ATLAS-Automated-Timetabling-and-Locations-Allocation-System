import { PrismaClient } from './atlas-server/node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

async function run() {
  const schoolId = 1;
  const faculty = await prisma.facultyMirror.findMany({
    where: { schoolId, isStale: false, specialization: { not: null } },
    select: { department: true, specialization: true },
    distinct: ['department', 'specialization']
  });
  const aliases = await prisma.specializationAlias.findMany({ where: { schoolId } });
  const subjects = await prisma.subject.findMany({ where: { schoolId } });
  const subMap = new Map(subjects.map(s => [s.code, s]));
  const aliasMap = new Map(aliases.map(a => [a.alias, a.canonical]));

  console.log('--- COMPLETE SPECIALIZATION MAPPING REPORT ---');
  const report = faculty.map(f => {
    const spec = f.specialization;
    const directCode = subMap.has(spec) ? spec : null;
    const aliasCode = aliasMap.get(spec);
    const mappedCode = directCode || aliasCode;
    const subject = mappedCode ? subMap.get(mappedCode) : null;
    
    return {
      Department: f.department,
      Specialization: spec,
      Mapped_To: mappedCode || 'UNMAPPED',
      Subject_Name: subject ? subject.name : 'N/A',
      Status: subject ? (subject.isActive ? 'ACTIVE' : 'INACTIVE') : 'UNMAPPED'
    };
  });
  
  // Sort by department then specialization
  report.sort((a, b) => (a.Department || '').localeCompare(b.Department || '') || a.Specialization.localeCompare(b.Specialization));
  
  console.table(report);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
