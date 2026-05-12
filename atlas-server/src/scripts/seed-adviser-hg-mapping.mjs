/**
 * Adviser-to-HG Mapping Script
 *
 * Links class advisers (from EnrollPro) to HG assignments based on section adviser.
 * Ensures each section has exactly one HG instructor = the section's adviser.
 *
 * Usage:
 *   cd d:\ATLAS
 *   node atlas-server/src/scripts/seed-adviser-hg-mapping.mjs
 */

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

const SCHOOL_ID = 1;
const SCHOOL_YEAR_ID = 1;

(async () => {
  try {
    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('  ADVISER-TO-HG MAPPING');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Get HG subject
    const hgSubject = await prisma.subject.findUnique({
      where: { schoolId_code: { schoolId: SCHOOL_ID, code: 'HG' } },
      select: { id: true },
    });

    if (!hgSubject) {
      throw new Error('HG subject not found!');
    }

    console.log('HG subject found.\n');

    // 2. Get all sections with advisers
    const sections = await prisma.section.findMany({
      where: {
        schoolId: SCHOOL_ID,
        schoolYearId: SCHOOL_YEAR_ID,
        // NOT: only those with adviserId (can be null)
      },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        adviserId: true,
      },
      orderBy: { id: 'asc' },
    });

    console.log(`Total sections: ${sections.length}`);

    const withAdvisers = sections.filter((s) => s.adviserId !== null && s.adviserId !== undefined);
    console.log(`Sections with advisers: ${withAdvisers.length}\n`);

    // 3. Get adviser faculty (active, not stale)
    const advisers = await prisma.facultyMirror.findMany({
      where: {
        schoolId: SCHOOL_ID,
        isStale: false,
        isActiveForScheduling: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isClassAdviser: true,
      },
    });

    const adviserMap = new Map(advisers.map((a) => [a.id, a]));
    console.log(`Active advisers in system: ${advisers.filter((a) => a.isClassAdviser).length}\n`);

    // 4. Create HG assignments for each adviser
    let created = 0;
    let duplicates = 0;
    let notFound = 0;
    const mappingLog = [];

    for (const section of withAdvisers) {
      const adviser = adviserMap.get(section.adviserId);

      if (!adviser) {
        console.log(`⚠️  Section ${section.name} adviser ID ${section.adviserId} not found in system`);
        notFound++;
        continue;
      }

      try {
        // Check if already exists
        const existing = await prisma.facultySubject.findFirst({
          where: {
            schoolId: SCHOOL_ID,
            facultyId: section.adviserId,
            subjectId: hgSubject.id,
          },
        });

        if (existing) {
          // Update sectionIds if needed (add section to assignment if not already there)
          const sectionIds = existing.sectionIds || [];
          if (!sectionIds.includes(section.id)) {
            await prisma.facultySubject.update({
              where: { id: existing.id },
              data: {
                sectionIds: [...sectionIds, section.id],
              },
            });
            console.log(`Updated: ${adviser.firstName} ${adviser.lastName} → HG (Section ${section.name})`);
          } else {
            duplicates++;
          }
          created++;
        } else {
          // Create new HG assignment
          await prisma.facultySubject.create({
            data: {
              schoolId: SCHOOL_ID,
              facultyId: section.adviserId,
              subjectId: hgSubject.id,
              gradeLevels: [section.gradeLevel],
              sectionIds: [section.id],
            },
          });
          created++;
          console.log(`Created: ${adviser.firstName} ${adviser.lastName} → HG (Section ${section.name})`);
        }

        mappingLog.push({
          sectionId: section.id,
          sectionName: section.name,
          adviserId: section.adviserId,
          adviserName: `${adviser.firstName} ${adviser.lastName}`,
          gradeLevel: section.gradeLevel,
        });
      } catch (e) {
        console.error(`Error mapping section ${section.name}:`, e.message);
      }
    }

    console.log(`\n───────────────────────────────────────────────────────\n`);
    console.log(`HG assignments created/updated: ${created}`);
    console.log(`Sections with advisers processed: ${withAdvisers.length}`);
    console.log(`Duplicates skipped: ${duplicates}`);
    console.log(`Advisers not found: ${notFound}`);

    console.log(`\nHG mapping summary:`);
    const byAdviser = new Map();
    for (const log of mappingLog) {
      if (!byAdviser.has(log.adviserId)) {
        byAdviser.set(log.adviserId, []);
      }
      byAdviser.get(log.adviserId).push(log.sectionName);
    }

    console.log(`Advisers with HG assignments: ${byAdviser.size}`);
    let totalAssignments = 0;
    for (const [advId, sections] of byAdviser) {
      const adviser = adviserMap.get(advId);
      totalAssignments += sections.length;
      console.log(`  ${adviser.firstName} ${adviser.lastName}: ${sections.join(', ')}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
