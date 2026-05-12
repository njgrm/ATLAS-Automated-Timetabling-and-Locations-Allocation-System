const { PrismaClient } = require("./node_modules/.prisma/client");
const p = new PrismaClient();
async function main() {
  const subjs = await p.subject.findMany({ where: { schoolId: 1 }, select: { id: true, code: true, name: true, isSeedable: true, programScopes: true }, orderBy: { id: "asc" } });
  subjs.forEach(s => console.log(s.id + "\t" + s.code + "\t" + s.name + "\t" + JSON.stringify(s.programScopes) + "\t" + s.isSeedable));
}
main().catch(console.error).finally(() => p.$disconnect());
