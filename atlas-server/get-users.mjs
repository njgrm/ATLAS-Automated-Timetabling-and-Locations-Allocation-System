import { prisma } from './src/lib/prisma.js';

async function main() {
  const users = await prisma.user.findMany({ select: { email: true, role: true }});
  console.log(users);
}
main().catch(console.error).finally(() => prisma.$disconnect());
