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
    console.log('DIAGNOSE: Find subjects with few or no faculty assignments\n');

    // Get all subjects and their faculty counts
    const subjects = await prisma.subject.findMany({
      where: { schoolId: 1 },
      select: {
        id: true,
        code: true,
        name: true,
        _count: { select: { facultySubjects: true } },
      },
    });

    // Sort by faculty count manually
    subjects.sort((a, b) => a._count.facultySubjects - b._count.facultySubjects);

    console.log('Subjects by faculty count (ascending):\n');
    for (const s of subjects) {
      const symbol = s._count.facultySubjects === 0 ? '❌' : (s._count.facultySubjects < 5 ? '⚠️ ' : '✅');
      console.log(`${symbol} ${s.code.padEnd(20)} | ${s._count.facultySubjects.toString().padStart(3)} faculty`);
    }

    console.log('\n───────────────────────────────────────────────────────\n');

    // Get subjects with 0 faculty
    const empty = subjects.filter(s => s._count.facultySubjects === 0);
    if (empty.length > 0) {
      console.log(`⚠️  CRITICAL: ${empty.length} subjects with NO faculty:`);
      for (const s of empty) {
        console.log(`   - ${s.code}`);
      }
    } else {
      console.log('✅ All subjects have at least one faculty member');
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
