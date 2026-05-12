const { PrismaClient } = require("./node_modules/.prisma/client");
const p = new PrismaClient();
async function main() {
  // Mark ICT (subject 10) as isSeedable: false since the new seed schema uses TLE_ICT_7/8/9/10
  const updated = await p.subject.update({
    where: { id: 10 },
    data: { isSeedable: false }
  });
  console.log("Updated ICT subject:", updated.code, "isSeedable:", updated.isSeedable);
}
main().catch(console.error).finally(() => p.$disconnect());
