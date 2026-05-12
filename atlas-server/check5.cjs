const { PrismaClient } = require("./node_modules/.prisma/client");
const p = new PrismaClient();
async function main() {
  // Total assignments across ALL school IDs
  const total = await p.facultySubject.count();
  console.log("Total facultySubject rows (all schools):", total);
  const bySchool = await p.facultySubject.groupBy({ by: ["schoolId"], _count: true });
  console.log("By school:", JSON.stringify(bySchool));
  // Check stub faculty (IDs 1-20) - do they have assignments?
  const stubFacAssignments = await p.facultySubject.findMany({ where: { facultyId: { lte: 20 } } });
  console.log("Stub faculty (1-20) assignments:", stubFacAssignments.length);
  // Real sections count from EnrollPro
  const sections = await p.sectionMirror.count({ where: { schoolId: 1 } });
  console.log("SectionMirror count:", sections);
  // Sample EnrollPro sections
  const sampSec = await p.sectionMirror.findMany({ where: { schoolId: 1 }, take: 5, select: { id: true, externalId: true, name: true, gradeLevel: true, programType: true } });
  console.log("Sample sections:", JSON.stringify(sampSec));
  // Generation runs
  const runs = await p.generationRun.findMany({ where: { schoolId: 1 }, select: { id: true, status: true, createdAt: true } });
  console.log("All generation runs:", JSON.stringify(runs));
}
main().catch(console.error).finally(() => p.$disconnect());
