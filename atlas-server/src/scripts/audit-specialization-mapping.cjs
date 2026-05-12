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
    console.log('Specialization Mapping Coverage Audit\n');

    // Get all aliases
    const aliases = await prisma.specializationAlias.findMany({
      where: { schoolId: 1 },
      select: { 
        id: true, 
        enrollproSpecializedString: true, 
        atlasCode: true,
        _count: { select: { facultyMirrors: true } },
      },
      orderBy: { enrollproSpecializedString: 'asc' },
    });

    // Get all subjects
    const subjects = await prisma.subject.findMany({
      where: { schoolId: 1 },
      select: { code: true, isSeedable: true },
      orderBy: { code: 'asc' },
    });

    console.log(`Specialization aliases configured: ${aliases.length}\n`);
    console.log('Aliases with faculty count:\n');

    let aliasesWithFaculty = 0;
    for (const a of aliases) {
      if (a._count.facultyMirrors > 0) aliasesWithFaculty++;
      const icon = a._count.facultyMirrors > 0 ? '✅' : '⚠️ ';
      console.log(`${icon} ${a.enrollproSpecializedString.slice(0, 40).padEnd(40)} → ${a.atlasCode.padEnd(15)} (${a._count.facultyMirrors} faculty)`);
    }

    console.log(`\n───────────────────────────────────────────────────────`);
    console.log(`Aliases with faculty: ${aliasesWithFaculty} / ${aliases.length}`);

    console.log(`\n───────────────────────────────────────────────────────\n`);
    console.log(`All subjects in ATLAS (${subjects.length}):\n`);

    const seedable = subjects.filter(s => s.isSeedable);
    console.log(`Seedable subjects: ${seedable.length}`);
    for (const s of seedable) {
      console.log(`  - ${s.code}`);
    }

    console.log(`\nNon-seedable subjects: ${subjects.length - seedable.length}`);
    for (const s of subjects.filter(s => !s.isSeedable)) {
      console.log(`  - ${s.code}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
