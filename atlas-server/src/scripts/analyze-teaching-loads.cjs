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
    console.log('Teaching Load & Overlap Analysis\n');

    // Get all faculty with their subject assignments
    const fs = await prisma.facultySubject.findMany({
      where: { schoolId: 1 },
      select: {
        facultyId: true,
        subjectId: true,
        subject: { select: { code: true } },
        faculty: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ facultyId: 'asc' }, { subjectId: 'asc' }],
    });

    console.log(`Total FacultySubject assignments: ${fs.length}\n`);

    // Group by faculty
    const byFaculty = new Map();
    for (const a of fs) {
      if (!byFaculty.has(a.facultyId)) {
        byFaculty.set(a.facultyId, []);
      }
      byFaculty.get(a.facultyId).push(a.subject.code);
    }

    // Analyze overlaps
    let overlappingCount = 0;
    for (const [fid, subjects] of byFaculty) {
      const unique = new Set(subjects);
      if (unique.size < subjects.length) {
        overlappingCount++;
        const dups = subjects.filter((s, i) => subjects.indexOf(s) !== i);
        const fac = fs.find(x => x.facultyId === fid);
        console.log(`⚠️  ${fac.faculty.firstName} ${fac.faculty.lastName}: Teaching ${fac.subject.code} multiple times`);
      }
    }

    console.log(`\nFaculty with overlapping assignments: ${overlappingCount}`);

    // Distribution stats
    const loads = Array.from(byFaculty.values()).map(s => s.length);
    const avgLoad = (loads.reduce((a, b) => a + b, 0) / loads.length).toFixed(1);
    const minLoad = Math.min(...loads);
    const maxLoad = Math.max(...loads);

    console.log(`\nTeaching load distribution:`);
    console.log(`- Average subjects per faculty: ${avgLoad}`);
    console.log(`- Min: ${minLoad}, Max: ${maxLoad}`);
    console.log(`\nFaculty teaching 0-1 subjects: ${loads.filter(l => l <= 1).length}`);
    console.log(`Faculty teaching 2-3 subjects: ${loads.filter(l => l >= 2 && l <= 3).length}`);
    console.log(`Faculty teaching 4+ subjects: ${loads.filter(l => l >= 4).length}`);

    // Get adviser count
    const advisers = await prisma.facultyMirror.findMany({
      where: { schoolId: 1, isActiveForScheduling: true, isStale: false },
      select: { 
        id: true, 
        firstName: true, 
        lastName: true,
        isClassAdviser: true,
      },
    });

    const adviserCount = advisers.filter(a => a.isClassAdviser).length;
    console.log(`\n───────────────────────────────────────────────────────\n`);
    console.log(`Class advisers (from EnrollPro): ${adviserCount} / ${advisers.length} faculty`);

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
