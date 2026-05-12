const path = require('path');
const { readFileSync } = require('fs');

// Load .env from project root  
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
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  CLEAN: Delete bloated faculty-subject assignments');
    console.log('══════════════════════════════════════════════════════════════\n');

    const countBefore = await prisma.facultySubject.count({ where: { schoolId: 1 } });
    console.log(`FacultySubject rows before delete: ${countBefore}\n`);

    const deleted = await prisma.facultySubject.deleteMany({
      where: { schoolId: 1 },
    });
    console.log(`✅ Deleted ${deleted.count} rows\n`);

    const countAfter = await prisma.facultySubject.count({ where: { schoolId: 1 } });
    console.log(`FacultySubject rows after delete: ${countAfter}\n`);

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
