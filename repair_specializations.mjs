import { PrismaClient } from './atlas-server/node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

async function run() {
  const schoolId = 1;
  console.log('--- STARTING SPECIALIZATION MAPPING REPAIR ---');

  // Define Repair Map (Alias Name -> New Canonical Code)
  const repairPlan = {
    // Science mappings from generic 'SCI' (Inactive) to specific active codes
    'MAJOR IN BIOLOGY': 'SCI_BIO',
    'MAJOR IN CHEMISTRY': 'SCI_CHEM',
    'MAJOR IN PHYSICS': 'SCI_PHYS',
    'MAJOR IN GENERAL SCIENCE / BIOLOGY / CHEMISTRY / PHYSICS': 'SCI_BIO', // Default to Bio if mixed
    'Science': 'SCI_BIO',
    
    // MAPEH/Dance mappings from 'DANCE' (Inactive) to 'MAPEH' (Active) or 'SPA_SPEC'
    'DANCE': 'SPA_SPEC', // Assuming SPA_SPEC is the active home for Dance specialists
    'FINE ARTS': 'MAPEH',
  };

  for (const [aliasName, newCanonical] of Object.entries(repairPlan)) {
    // 1. Delete existing incorrect mappings for this alias
    const deleted = await prisma.specializationAlias.deleteMany({
      where: {
        schoolId,
        alias: aliasName
      }
    });

    if (deleted.count > 0) {
      console.log(`Removed ${deleted.count} old mapping(s) for: ${aliasName}`);
    }

    // 2. Create new correct mapping
    await prisma.specializationAlias.create({
      data: {
        schoolId,
        alias: aliasName,
        canonical: newCanonical
      }
    });
    console.log(`Fixed mapping: [${aliasName}] -> [${newCanonical}]`);
  }

  console.log('--- REPAIR COMPLETE ---');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
