const { PrismaClient } = require("./node_modules/.prisma/client");
const p = new PrismaClient();
async function main() {
  const auths = await p.atlasAuthAccount.findMany({ select: { id: true, email: true, role: true, employeeId: true, accountName: true } });
  console.log("Auth accounts:", JSON.stringify(auths, null, 2));
  const fac5 = await p.facultyMirror.findMany({ where: { schoolId: 1 }, take: 5, select: { id: true, employeeId: true, firstName: true, lastName: true } });
  console.log("Sample faculty (first 5):", JSON.stringify(fac5));
  // Check if faculty 3179586 (AQUINO) exists
  const aquino = await p.facultyMirror.findFirst({ where: { employeeId: "3179586" } });
  console.log("AQUINO faculty:", JSON.stringify(aquino));
  // Auth for 1000001 or 3179586
  const authMath = await p.atlasAuthAccount.findFirst({ where: { employeeId: "3179586" } });
  console.log("AQUINO auth:", JSON.stringify(authMath));
}
main().catch(console.error).finally(() => p.$disconnect());
