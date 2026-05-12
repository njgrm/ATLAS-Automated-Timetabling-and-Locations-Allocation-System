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
    const subjects = await prisma.subject.findMany({
      where: { schoolId: 1 },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
         isSeedable: true,
        allowedSpecializations: true,
        gradeLevels: true,
        _count: { select: { facultySubjects: true } },
      },
    });

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('Subject Audit (School 1):\n');

    for (const s of subjects) {
      const specs = s.allowedSpecializations?.length ? s.allowedSpecializations.join(', ') : '(unrestricted)';
      console.log(`${s.code.padEnd(12)} | Seedable: ${s.isSeedable ? 'YES' : 'NO '} | Faculty: ${s._count.facultySubjects.toString().padStart(2)} | Specs: ${specs}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    const seedable = subjects.filter(s => s.seedable).length;
    const unseeded = subjects.filter(s => s._count.facultySubjects === 0).length;
    const emptyNonSeedable = subjects.filter(s => !s.isSeedable && s._count.facultySubjects === 0).length;

    console.log(`Seedable subjects: ${seedable}`);
    console.log(`Subjects with no faculty: ${unseeded}`);
    console.log(`Non-seedable subjects with no faculty: ${emptyNonSeedable} ⚠️`);

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
