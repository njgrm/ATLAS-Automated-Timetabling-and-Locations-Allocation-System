import { PrismaClient } from './atlas-server/node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

async function main() {
  const schoolId = 1;

  console.log('--- Subjects (Active vs Inactive) ---');
  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    select: { code: true, name: true, isActive: true }
  });
  console.table(subjects);

  console.log('\n--- Specialization Aliases (Mappings) ---');
  const aliases = await prisma.specializationAlias.findMany({
    where: { schoolId },
    select: { alias: true, canonical: true }
  });
  console.table(aliases);

  console.log('\n--- Faculty Specializations & Departments ---');
  const faculty = await prisma.facultyMirror.findMany({
    where: { schoolId, isStale: false, specialization: { not: null } },
    select: { department: true, specialization: true },
    distinct: ['department', 'specialization']
  });
  console.table(faculty);

  // Check for orphan specializations (unmapped)
  const mappedAliases = new Set(aliases.map(a => a.alias));
  const activeSubjectCodes = new Set(subjects.filter(s => s.isActive).map(s => s.code));
  
  const orphans = faculty.filter(f => {
    const spec = f.specialization;
    if (activeSubjectCodes.has(spec)) return false; // Auto-mapped
    if (mappedAliases.has(spec)) return false; // Alias-mapped
    return true;
  });

  console.log('\n--- Orphan Specializations (Needs Mapping) ---');
  console.table(orphans);

  // Check for mappings to INACTIVE subjects
  const inactiveMappings = aliases.filter(a => {
    const sub = subjects.find(s => s.code === a.canonical);
    return sub && !sub.isActive;
  });

  console.log('\n--- Mappings to Inactive Subjects ---');
  console.table(inactiveMappings);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
