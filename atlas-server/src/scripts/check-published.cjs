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
    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('CHECK: Published schedules in database\n');

    // Check published schedules
    const schedules = await prisma.schedule.findMany({
      where: { schoolId: 1, state: 'PUBLISHED' },
      select: { 
        id: true, 
        termId: true, 
        state: true, 
        publishedAt: true, 
        generationRunId: true,
      },
    });

    console.log(`Published schedules found: ${schedules.length}\n`);
    
    if (schedules.length > 0) {
      for (const s of schedules) {
        console.log(`  - Term: ${s.termId}, Run: ${s.generationRunId}, Published: ${s.publishedAt}`);
      }
    }

    // Check all schedules (any state)
    const all = await prisma.schedule.findMany({
      where: { schoolId: 1 },
      select: { 
        id: true, 
        termId: true, 
        state: true, 
        publishedAt: true, 
        generationRunId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\nAll schedules: ${all.length}`);
    if (all.length > 0) {
      console.log('Most recent:');
      for (const s of all.slice(0, 3)) {
        console.log(`  - Term: ${s.termId}, State: ${s.state}, Run: ${s.generationRunId}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
