const { PrismaClient } = require("./node_modules/.prisma/client");
const p = new PrismaClient();
async function main() {
  // How many auth accounts?
  const auths = await p.atlasAuthAccount.findMany({ select: { id: true, identifier: true, role: true, employeeId: true } });
  console.log("Auth accounts:", JSON.stringify(auths));
  // How many faculty?
  const facCount = await p.facultyMirror.count({ where: { schoolId: 1 } });
  console.log("Faculty mirrors:", facCount);
  // Sample faculty 
  const fac5 = await p.facultyMirror.findMany({ where: { schoolId: 1 }, take: 5, select: { id: true, employeeId: true, firstName: true, lastName: true } });
  console.log("Sample faculty:", JSON.stringify(fac5));
  // Subjects count
  const subj = await p.subject.count({ where: { schoolId: 1 } });
  console.log("Subjects:", subj);
}
main().catch(console.error).finally(() => p.$disconnect());
