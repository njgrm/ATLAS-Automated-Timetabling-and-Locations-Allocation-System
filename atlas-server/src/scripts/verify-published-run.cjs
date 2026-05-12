const path = require('path');
const { readFileSync } = require('fs');

const envPath = path.join(__dirname, '../../.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const { PrismaClient } = require('./../../node_modules/.prisma/client/default.js');
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

(async () => {
  try {
    const run = await prisma.generationRun.findUnique({
      where: { id: 14 },
      select: {
        id: true,
        status: true,
        summary: true,
      },
    });

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('Generation Run 14 Status:\n');
    console.log(`ID: ${run.id}`);
    console.log(`Status: ${run.status}`);
    console.log(`\nSummary (parsed):`);
    if (typeof run.summary === 'string') {
      const parsed = JSON.parse(run.summary);
      console.log(`- isPublished: ${parsed.isPublished}`);
      console.log(`- hardViolationCount: ${parsed.hardViolationCount}`);
      console.log(`- publishedAt: ${parsed.publishedAt}`);
      console.log(`- publishedBy: ${parsed.publishedBy}`);
    } else {
      console.log(JSON.stringify(run.summary, null, 2).split('\n').slice(0, 5).join('\n'));
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
