import { PrismaClient } from '@prisma/client';
// Startup diagnostic: verify DATABASE_URL protocol is correct
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error('[prisma] ❌ DATABASE_URL is not set. Prisma queries will fail.');
}
else if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    console.error(`[prisma] ❌ DATABASE_URL has unexpected protocol: ${dbUrl.substring(0, 30)}...`);
}
else {
    console.log('[prisma] ✔ DATABASE_URL protocol looks correct');
}
export const prisma = new PrismaClient();
//# sourceMappingURL=prisma.js.map