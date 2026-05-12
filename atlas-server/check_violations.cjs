const { PrismaClient } = require("./node_modules/.prisma/client");
const p = new PrismaClient();
async function main() {
  const locked = await p.lockedSession.count({ where: { schoolId: 1, schoolYearId: 1 } });
  console.log("All locked sessions:", locked);
  const ict = await p.facultySubject.findMany({ where: { schoolId: 1, subjectId: 10 }, select: { id: true, facultyId: true, sectionIds: true, gradeLevels: true } });
  console.log("ICT assignments:", JSON.stringify(ict));
  const covered = await p.facultySubject.groupBy({ by: ["subjectId"], where: { schoolId: 1 } });
  console.log("Covered subject IDs:", JSON.stringify(covered.map(x => x.subjectId).sort((a,b)=>a-b)));
  const run2 = await p.generationRun.findUnique({ where: { id: 2 }, select: { summary: true } });
  const s = run2 && run2.summary;
  if(s) {
    console.log("Run2 hardViolations:", s.hardViolationCount, "assigned:", s.assignedCount, "unassigned:", s.unassignedCount);
    const vlist = s.violations || [];
    const combos = {};
    vlist.forEach(v => { const k = "f"+v.facultyId+":s"+v.subjectId; combos[k] = (combos[k]||0)+1; });
    console.log("Violation combos:", JSON.stringify(combos));
  }
  const fac12 = await p.facultySubject.findMany({ where: { schoolId: 1, facultyId: { in: [1, 2] } } });
  console.log("Fac1&2 assignments:", JSON.stringify(fac12.map(x=>({fid:x.facultyId,sid:x.subjectId,sids:x.sectionIds}))));
}
main().catch(console.error).finally(() => p.disconnect ? p.disconnect() : p.$disconnect());
