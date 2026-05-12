/**
 * Specialization Expansion Script
 *
 * Adds SpecializationAlias entries for subjects not yet covered.
 * Maps the 34 ATLAS subjects to representative EnrollPro specialization strings.
 *
 * Current coverage: ~19 BEC subjects (from seed)
 * Goal: All 34 subjects mapped
 *
 * Usage:
 *   cd d:\ATLAS
 *   node atlas-server/src/scripts/extend-specialization-mapping.mjs
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

// Mapping of subject codes to representative specialization strings
// These are fallback names for subjects that may not have exact matches in EnrollPro
// In real deployments, these should be validated against actual EnrollPro specialization data
const SPECIALIZATION_MAP = {
  ENGLISH: 'ENGLISH LANGUAGE SPECIALIZATION',
  MATH: 'MATHEMATICS SPECIALIZATION',
  SCIENCE: 'GENERAL SCIENCE SPECIALIZATION',
  SOCIOLOGY: 'SOCIAL SCIENCES SPECIALIZATION',
  FIL: 'PILIPINAS STUDIES SPECIALIZATION',
  MAPEH: 'ARTS AND PHYSICAL EDUCATION SPECIALIZATION',
  TLE: 'TECHNICAL LIVELIHOOD EDUCATION SPECIALIZATION',
  HG: 'HOMEROOM GUIDANCE SPECIALIZATION',
  ESP: 'ENVIRONMENTAL SCIENCE SPECIALIZATION',
  
  // Advanced/Elective subjects (these may need adjustment based on actual EnrollPro data)
  ICT: 'INFORMATION AND COMMUNICATION TECHNOLOGY SPECIALIZATION',
  ENVIRONMENTAL_SCIENCE: 'ENVIRONMENTAL SCIENCE SPECIALIZATION',
  BIOTECHNOLOGY: 'BIOTECHNOLOGY AND LIFE SCIENCES SPECIALIZATION',
  MUSIC: 'MUSIC ARTS SPECIALIZATION',
  VISUAL_ARTS: 'VISUAL ARTS SPECIALIZATION',
  THEATER_ARTS: 'THEATER ARTS AND PERFORMANCE SPECIALIZATION',
  MEDIA_ARTS: 'MEDIA ARTS SPECIALIZATION',
  CREATIVE_WRITING: 'CREATIVE WRITING SPECIALIZATION',
  DANCE: 'DANCE AND MOVEMENT SPECIALIZATION',
  CONSUMERS_CHEMISTRY: 'APPLIED CHEMISTRY SPECIALIZATION',
  ELECTRONICS_ROBOTICS: 'ELECTRONICS AND ROBOTICS SPECIALIZATION',
  RESEARCH_I: 'RESEARCH AND INNOVATION SPECIALIZATION',
  RESEARCH_II: 'RESEARCH AND INNOVATION SPECIALIZATION',
  RESEARCH_III: 'RESEARCH AND INNOVATION SPECIALIZATION',
  RESEARCH_IV: 'RESEARCH AND INNOVATION SPECIALIZATION',
  MANDARIN: 'FOREIGN LANGUAGE SPECIALIZATION',
  JAPANESE: 'FOREIGN LANGUAGE SPECIALIZATION',
  FRENCH: 'FOREIGN LANGUAGE SPECIALIZATION',
  ARABIC: 'FOREIGN LANGUAGE SPECIALIZATION',
  GERMAN: 'FOREIGN LANGUAGE SPECIALIZATION',
  PROGRAMMING: 'INFORMATION TECHNOLOGY SPECIALIZATION',
  WEB_DEVELOPMENT: 'INFORMATION TECHNOLOGY SPECIALIZATION',
  DATA_SCIENCE: 'INFORMATION TECHNOLOGY SPECIALIZATION',
  CYBERSECURITY: 'CYBERSECURITY SPECIALIZATION',
};

(async () => {
  try {
    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('  SPECIALIZATION MAPPING EXPANSION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Get all subjects
    const allSubjects = await prisma.subject.findMany({
      where: { schoolId: SCHOOL_ID },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });

    console.log(`Total subjects in system: ${allSubjects.length}\n`);

    // 2. Get existing specialization mappings
    const existing = await prisma.specializationAlias.findMany({
      where: { schoolId: SCHOOL_ID },
      select: { canonical: true },
    });

    const existingCodes = new Set(existing.map((e) => e.canonical));
    console.log(`Existing specialization mappings: ${existingCodes.size}\n`);

    // 3. Identify gaps
    const gaps = allSubjects.filter((s) => !existingCodes.has(s.code));
    console.log(`Subjects needing specialization mapping: ${gaps.length}\n`);

    if (gaps.length === 0) {
      console.log('✅ All subjects already have specialization mappings!\n');
      await prisma.$disconnect();
      return;
    }

    // 4. Create new specialization mappings
    let created = 0;
    const creationLog = [];

    for (const subject of gaps) {
      const aliasString = SPECIALIZATION_MAP[subject.code];

      if (!aliasString) {
        console.log(`⚠️  No fallback mapping for ${subject.code}. Skipping.`);
        continue;
      }

      try {
        // Check if this alias already exists for this school/subject
        const existing = await prisma.specializationAlias.findFirst({
          where: {
            schoolId: SCHOOL_ID,
            canonical: subject.code,
            alias: aliasString,
          },
        });

        if (existing) {
          console.log(`  (Already exists) ${subject.code} → ${aliasString}`);
        } else {
          await prisma.specializationAlias.create({
            data: {
              schoolId: SCHOOL_ID,
              canonical: subject.code,
              alias: aliasString,
            },
          });

          console.log(`✓ Created: ${subject.code} → ${aliasString}`);
          created++;
          creationLog.push({ code: subject.code, alias: aliasString });
        }
      } catch (e) {
        if (e.code === 'P2002') {
          // Unique constraint violation - already exists
          console.log(`  (Already exists) ${subject.code} → ${aliasString}`);
        } else {
          console.error(`Error creating mapping for ${subject.code}:`, e.message);
        }
      }
    }

    console.log(`\n───────────────────────────────────────────────────────\n`);
    console.log(`New specialization mappings created: ${created}`);

    // 5. Verify final state
    const finalMappings = await prisma.specializationAlias.findMany({
      where: { schoolId: SCHOOL_ID },
      select: { canonical: true, alias: true },
      orderBy: { canonical: 'asc' },
    });

    console.log(`\nFinal specialization mapping coverage: ${finalMappings.length} mappings`);

    // Group by canonical (subject)
    const bySubject = new Map();
    for (const mapping of finalMappings) {
      if (!bySubject.has(mapping.canonical)) {
        bySubject.set(mapping.canonical, []);
      }
      bySubject.get(mapping.canonical).push(mapping.alias);
    }

    console.log(`\nSubjects covered by specialization:`);
    for (const [subject, aliases] of bySubject) {
      console.log(`  ${subject}: ${aliases.length} alias(es)`);
    }

    const unmappedSubjects = allSubjects.filter((s) => !bySubject.has(s.code));
    if (unmappedSubjects.length > 0) {
      console.log(`\n⚠️  ${unmappedSubjects.length} subjects still unmapped:`);
      for (const s of unmappedSubjects) {
        console.log(`  - ${s.code} (${s.name})`);
      }
    } else {
      console.log(`\n✅ All ${allSubjects.length} subjects now have specialization mappings!`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
