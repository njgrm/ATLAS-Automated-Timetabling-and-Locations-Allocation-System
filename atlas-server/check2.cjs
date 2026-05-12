const { PrismaClient } = require("./node_modules/.prisma/client");
const p = new PrismaClient();
async function main() {
  const total = await p.facultySubject.count({ where: { schoolId: 1 } });
  console.log("Total facultySubject rows for school 1:", total);
  const allFA = await p.facultySubject.findMany({ where: { schoolId: 1 }, select: { facultyId: true, subjectId: true } });
  console.log("All assignments:", JSON.stringify(allFA));
  const facultyCount = await p.facultyMirror.count({ where: { schoolId: 1 } });
  console.log("Faculty mirror count:", facultyCount);
  // Check run 2 summary fields
  const run2 = await p.generationRun.findUnique({ where: { id: 2 }, select: { id: true, status: true, summary: true } });
  if(run2) {
    const s = run2.summary;
    console.log("Run2 status:", run2.status);
    console.log("Summary keys:", s ? Object.keys(s) : "null");
    if(s) {
      Object.keys(s).forEach(k => {
        const v = s[k];
        if(!Array.isArray(v)) console.log("  "+k+":", v);
        else console.log("  "+k+": [array length "+v.length+"]");
      });
    }
  }
}
main().catch(console.error).finally(() => p.$disconnect());
