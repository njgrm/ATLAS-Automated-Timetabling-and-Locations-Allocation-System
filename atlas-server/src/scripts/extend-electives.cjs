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
    console.log('EXTEND: Add faculty to advanced and elective subjects\n');

    // Mapping of elective subjects to source subject codes
    const electiveMap = {
      'ENV_SCI': ['SCI'],           // Environmental Science → Science teachers
      'ADVANCED_CHEMISTRY': ['SCI'],    // Advanced Chemistry → Science teachers
      'ADVANCED_PHYSICS': ['SCI'],      // Advanced Physics → Science teachers
      'BASIC_STATISTICS': ['MATH'],     // Basic Statistics → Math teachers
      'ADVANCED_STATISTICS': ['MATH'],  // Advanced Statistics → Math teachers
      'ELECTRONICS': ['TLE'],           // Electronics → TLE teachers
      'RESEARCH_I': ['SCI'],            // Research I → Science teachers
      'RESEARCH_II': ['SCI'],           // Research II → Science teachers
      'RESEARCH_III': ['MATH'],         // Research III → Math teachers
      'TLE_ICT_7': ['TLE'],             // TLE-ICT → TLE teachers
      'TLE_ICT_8': ['TLE'],
      'TLE_ICT_9': ['TLE'],
      'TLE_ICT_10': ['TLE'],
      'HG': ['SCI', 'MATH', 'ENG'],    // Homeroom Guidance → various advisers
    };

    // Load all active faculty
    const faculty = await prisma.facultyMirror.findMany({
      where: { schoolId: 1, isActiveForScheduling: true, isStale: false },
    });

    // Load subjects
    const subjects = await prisma.subject.findMany({
      where: { schoolId: 1 },
      select: { id: true, code: true, name: true, gradeLevels: true },
    });

    const subjectMap = Object.fromEntries(subjects.map(s => [s.code, s]));

    let created = 0;
    let skipped = 0;

    for (const [electiveCode, sourceSubjects] of Object.entries(electiveMap)) {
      if (!subjectMap[electiveCode]) {
        console.log(`⚠️  ${electiveCode} not found`);
        continue;
      }

      const electiveSubject = subjectMap[electiveCode];

      // Find all faculty currently teaching source subjects
      const sourceTeachers = await prisma.facultySubject.findMany({
        where: {
          schoolId: 1,
          subject: { code: { in: sourceSubjects } },
        },
        select: { facultyId: true },
        distinct: ['facultyId'],
      });

      const teacherIds = sourceTeachers.map(t => t.facultyId);

      if (teacherIds.length === 0) {
        skipped++;
        continue;
      }

      // Add elective to those teachers (if not already assigned)
      for (const facultyId of teacherIds) {
        const existing = await prisma.facultySubject.findFirst({
          where: {
            facultyId,
            subjectId: electiveSubject.id,
            schoolId: 1,
          },
        });

        if (existing) continue;

        await prisma.facultySubject.create({
          data: {
            facultyId,
            subjectId: electiveSubject.id,
            schoolId: 1,
            gradeLevels: electiveSubject.gradeLevels,
             assignedBy: 1,  // Admin user ID
          },
        });
        created++;
      }

      console.log(`✅ ${electiveCode}: Added to ${teacherIds.length} teachers`);
    }

    console.log(`\n───────────────────────────────────────────────────────`);
    console.log(`New assignments created: ${created}`);
    console.log(`Subjects skipped (no source teachers): ${skipped}`);
    console.log(`───────────────────────────────────────────────────────\n`);

    // Final audit
    const total = await prisma.facultySubject.count({ where: { schoolId: 1 } });
    console.log(`Total FacultySubject rows: ${total}\n`);

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
