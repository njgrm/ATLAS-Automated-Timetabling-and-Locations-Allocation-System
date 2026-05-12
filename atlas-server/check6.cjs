const { PrismaClient } = require("./node_modules/.prisma/client");
const p = new PrismaClient();
async function main() {
  const total = await p.facultySubject.count();
  console.log("Total facultySubject rows (all schools):", total);
  const bySchool = await p.facultySubject.groupBy({ by: ["schoolId"], _count: { _all: true } });
  console.log("By school:", JSON.stringify(bySchool));
  const stubFacAssignments = await p.facultySubject.count({ where: { facultyId: { lte: 20 } } });
  console.log("Stub faculty (1-20) assignments:", stubFacAssignments);
  const sections = await p.sectionMirror.count({ where: { schoolId: 1 } });
  console.log("SectionMirror count:", sections);
  const sampSec = await p.sectionMirror.findMany({ where: { schoolId: 1 }, take: 5, select: { id: true, gradeLevelId: true, gradeLevelName: true, programCode: true, programName: true, isSpecialProgram: true } });
  console.log("Sample sections:", JSON.stringify(sampSec));
}
main().catch(console.error).finally(() => p.$disconnect());
