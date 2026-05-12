/**
 * SEED REALISTIC FACULTY-SUBJECT ASSIGNMENTS
 *
 * Creates FacultySubject records based on specialization matching:
 * 1. For each active faculty member
 * 2. Look up their specialization in SpecializationAlias
 * 3. Create FacultySubject for the matching canonical subject
 * 4. Handle class advisers separately for HG assignment
 *
 * Usage: npm run db:seed-realistic
 * Or: node atlas-server/src/scripts/seed-realistic-assignments.cjs
 */

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

async function main() {
  console.log(
    '\n═══════════════════════════════════════════════════════════════════════════'
  );
  console.log('  SEED REALISTIC FACULTY-SUBJECT ASSIGNMENTS FROM SPECIALIZATIONS');
  console.log(
    '═══════════════════════════════════════════════════════════════════════════\n'
  );

  const schoolId = 1;

  // 1. Load all data needed
  console.log('Loading data from database...\n');

  const faculty = await prisma.facultyMirror.findMany({
    where: { schoolId, isStale: false, isActiveForScheduling: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      specialization: true,
      isClassAdviser: true,
    },
    orderBy: { lastName: 'asc' },
  });
  console.log(`Loaded ${faculty.length} active faculty`);

  const aliases = await prisma.specializationAlias.findMany({
    where: { schoolId },
    select: { alias: true, canonical: true },
  });
  console.log(`Loaded ${aliases.length} specialization aliases`);

  const subjects = await prisma.subject.findMany({
    where: { schoolId, isActive: true },
    select: {
      id: true,
      code: true,
      gradeLevels: true,
      programScopes: true,
    },
  });
  console.log(`Loaded ${subjects.length} subjects`);

  const sections = await prisma.section.findMany({
    where: { schoolId, isActive: true },
    select: {
      id: true,
      programType: true,
      gradeLevel: true,
      sectionSubjects: {
        select: { subjectId: true },
      },
    },
  });
  console.log(`Loaded ${sections.length} sections\n`);

  // 2. Build lookup maps
  const aliasMap = new Map();
  const subjectMap = new Map(subjects.map((s) => [s.code, s]));
  const subjectIdMap = new Map(subjects.map((s) => [s.id, s]));

  // Build alias map: specialization string → canonical subject code
  aliases.forEach(({ alias, canonical }) => {
    // Store both exact and lowercase for matching
    aliasMap.set(alias.toLowerCase(), canonical);
    aliasMap.set(alias, canonical);
  });

  // Map subjects by programScope to understand which are STE/SPA
  const steSubjects = subjects.filter((s) =>
    s.programScopes?.includes('STE')
  );
  const spaSubjects = subjects.filter((s) =>
    s.programScopes?.includes('SPA')
  );

  console.log(`STE-track subjects: ${steSubjects.length}`);
  console.log(`SPA-track subjects: ${spaSubjects.length}\n`);

  // Build a map of which subjects are required per (gradeLevel, programType)
  const sectionRequirementsByProgram = {};
  sections.forEach((sec) => {
    const key = `${sec.gradeLevel}:${sec.programType}`;
    if (!sectionRequirementsByProgram[key]) {
      sectionRequirementsByProgram[key] = new Set();
    }
    sec.sectionSubjects.forEach(({ subjectId }) => {
      sectionRequirementsByProgram[key].add(subjectId);
    });
  });

  // 3. Delete existing (bloated) assignments
  console.log('Clearing old bloated faculty-subject assignments...');
  const deletedCount = await prisma.facultySubject.deleteMany({
    where: { schoolId },
  });
  console.log(`Deleted ${deletedCount.count} rows\n`);

  // 4. Seed new realistic assignments
  console.log('Creating realistic assignments...\n');

  let assignmentsCreated = 0;
  let facultyProcessed = 0;
  const unmatched = [];

  for (const f of faculty) {
    facultyProcessed++;

    // Get the faculty's specialization
    const spec = f.specialization?.toLowerCase() || '';

    // Try to find a matching subject via alias
    let canonicalCode = null;
    if (spec) {
      canonicalCode = aliasMap.get(spec) || aliasMap.get(spec.trim());
    }

    if (!canonicalCode) {
      unmatched.push(`${f.firstName} ${f.lastName} (spec: ${spec})`);
      // Assign HG if they're a class adviser, otherwise skip
      if (f.isClassAdviser) {
        const hg = subjectMap.get('HG');
        if (hg) {
          await prisma.facultySubject.create({
            data: {
              schoolId,
              facultyId: f.id,
              subjectId: hg.id,
              gradeLevels: hg.gradeLevels,
            },
          });
          assignmentsCreated++;
        }
      }
      continue;
    }

    // Get the subject
    const subject = subjectMap.get(canonicalCode);
    if (!subject) {
      unmatched.push(
        `${f.firstName} ${f.lastName} → ${canonicalCode} (subject not found)`
      );
      continue;
    }

    // Create FacultySubject
    await prisma.facultySubject.create({
      data: {
        schoolId,
        facultyId: f.id,
        subjectId: subject.id,
        gradeLevels: subject.gradeLevels,
      },
    });
    assignmentsCreated++;

    // If class adviser, also assign to HG
    if (f.isClassAdviser) {
      const hg = subjectMap.get('HG');
      if (hg && hg.id !== subject.id) {
        // Avoid duplicate HG assignments if specialization is HG
        await prisma.facultySubject.create({
          data: {
            schoolId,
            facultyId: f.id,
            subjectId: hg.id,
            gradeLevels: hg.gradeLevels,
          },
        });
        assignmentsCreated++;
      }
    }
  }

  console.log(`✅ Seeded ${assignmentsCreated} realistic assignments`);
  console.log(`Processed ${facultyProcessed} faculty members\n`);

  if (unmatched.length > 0) {
    console.log(`⚠️  ${unmatched.length} faculty could not be matched:`);
    unmatched.slice(0, 10).forEach((u) => console.log(`  - ${u}`));
    if (unmatched.length > 10) console.log(`  ... and ${unmatched.length - 10} more`);
  }

  // 5. Summary
  const finalCount = await prisma.facultySubject.count({ where: { schoolId } });
  const avgPerFaculty = finalCount / faculty.length;

  console.log(`\n─────────────────────────────────────────────────────────────────────────`);
  console.log(`Total FacultySubject rows after seeding: ${finalCount}`);
  console.log(`Avg assignments per faculty: ${avgPerFaculty.toFixed(1)} (expected 2-4)`);
  console.log(
    `─────────────────────────────────────────────────────────────────────────\n`
  );

  if (avgPerFaculty < 1.5) {
    console.log('⚠️  WARNING: Specialization matching may have failed. Check alias coverage.\n');
  } else {
    console.log(
      '✅ Realistic seeding complete. Ready to generate schedules.\n'
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
