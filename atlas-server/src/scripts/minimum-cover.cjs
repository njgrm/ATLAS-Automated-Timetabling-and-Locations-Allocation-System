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
    console.log('MINIMUM COVER: Assign at least 1 faculty to each subject\n');

    // Subjects with no faculty and their best-fit source subjects
    const assignments = {
      'CREATIVE_WRITING': ['ENG'],
      'DANCE': ['MAPEH', 'AP'],
      'ENVIRONMENTAL_SCIENCE': ['SCI'],
      'ICT': ['TLE'],
      'RESEARCH_IV': ['MATH'],
      'ELECTRONICS_ROBOTICS': ['ELECTRONICS', 'TLE'],
      'MUSIC': ['MAPEH', 'AP'],
      'MEDIA_ARTS': ['AP', 'ENG'],
      'BIOTECHNOLOGY': ['SCI'],
      'THEATER_ARTS': ['ENG', 'AP'],
      'CONSUMERS_CHEMISTRY': ['SCI'],
      'VISUAL_ARTS': ['AP', 'MAPEH'],
    };

    const subjects = await prisma.subject.findMany({
      where: { schoolId: 1 },
      select: { id: true, code: true, gradeLevels: true },
    });
    const subjectMap = Object.fromEntries(subjects.map(s => [s.code, s]));

    let assigned = 0;

    for (const [targetCode, sourceSubjects] of Object.entries(assignments)) {
      if (!subjectMap[targetCode]) continue;
      const targetSubject = subjectMap[targetCode];

      // Find one faculty member teaching any of the source subjects
      const faculty = await prisma.facultySubject.findFirst({
        where: {
          schoolId: 1,
          subject: { code: { in: sourceSubjects } },
        },
        select: { facultyId: true },
      });

      if (!faculty) {
        console.log(`⚠️  ${targetCode}: No source faculty found`);
        continue;
      }

      // Check if already assigned
      const existing = await prisma.facultySubject.findFirst({
        where: {
          facultyId: faculty.facultyId,
          subjectId: targetSubject.id,
          schoolId: 1,
        },
      });

      if (existing) {
        console.log(`⏭️  ${targetCode}: Already assigned`);
        continue;
      }

      // Create assignment
      await prisma.facultySubject.create({
        data: {
          facultyId: faculty.facultyId,
          subjectId: targetSubject.id,
          schoolId: 1,
          gradeLevels: targetSubject.gradeLevels,
          assignedBy: 1,
        },
      });

      assigned++;
      console.log(`✅ ${targetCode}: Assigned to one faculty`);
    }

    console.log(`\n───────────────────────────────────────────────────────`);
    console.log(`New minimum-cover assignments: ${assigned}\n`);

    const total = await prisma.facultySubject.count({ where: { schoolId: 1 } });
    console.log(`Total FacultySubject rows: ${total}\n`);

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
