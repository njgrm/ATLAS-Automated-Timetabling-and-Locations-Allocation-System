/**
 * Auto-Assign Subjects from Specialization Aliases
 *
 * Creates FacultySubject (assignment) records for all active, non-stale faculty
 * by matching their `specialization` field against the SpecializationAlias table.
 *
 * Unlike the built-in seedQualifiedAssignments service (which relies on
 * subject.allowedSpecializations and faculty.department), this script uses the
 * SpecializationAlias table directly — which correctly handles the real EnrollPro
 * specialization strings like "MAJOR IN MATHEMATICS (WITH STATISTICS BACKGROUND)".
 *
 * Usage:
 *   cd d:\ATLAS
 *   node atlas-server/src/scripts/auto-assign-subjects.mjs
 *
 * Prerequisites:
 *   - DATABASE_URL set in environment (or via atlas-server/.env)
 *   - Faculty synced from EnrollPro (run faculty sync first)
 *   - Specialization aliases seeded (npm run db:seed)
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from atlas-server
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
} catch {
  // .env not found — rely on existing environment
}

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../node_modules/.prisma/client/default.js');

const SCHOOL_ID = 1;

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  AUTO-ASSIGN SUBJECTS FROM SPECIALIZATION ALIASES');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Load all active non-stale faculty
  const faculty = await prisma.facultyMirror.findMany({
    where: {
      schoolId: SCHOOL_ID,
      isStale: false,
      isActiveForScheduling: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      specialization: true,
      department: true,
    },
  });
  console.log(`Active non-stale faculty: ${faculty.length}`);

  // 2. Load all specialization aliases
  const aliases = await prisma.specializationAlias.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { alias: true, canonical: true },
  });
  // Build case-insensitive map: alias.toLowerCase() -> canonical (subject code)
  const aliasMap = new Map(aliases.map((a) => [a.alias.toLowerCase().trim(), a.canonical]));
  console.log(`Specialization aliases loaded: ${aliases.length}`);

  // 3. Load all active BEC subjects (isSeedable=true — these are the ones the scheduler assigns)
  const subjects = await prisma.subject.findMany({
    where: { schoolId: SCHOOL_ID, isActive: true },
    select: { id: true, code: true, gradeLevels: true, isSeedable: true },
  });
  const subjectByCode = new Map(subjects.map((s) => [s.code, s]));
  console.log(`Subjects loaded: ${subjects.length} (${subjects.filter(s => s.isSeedable).length} seedable)\n`);

  let created = 0;
  let skipped = 0;
  let noMatch = 0;

  const noMatchSpecs = new Set();

  for (const member of faculty) {
    // Try specialization first, then department as fallback
    const specRaw = member.specialization ?? member.department;
    if (!specRaw) {
      noMatch++;
      noMatchSpecs.add('(no specialization or department)');
      continue;
    }

    const specKey = specRaw.toLowerCase().trim();
    const canonical = aliasMap.get(specKey);

    if (!canonical) {
      noMatch++;
      noMatchSpecs.add(specRaw);
      continue;
    }

    const subject = subjectByCode.get(canonical);
    if (!subject) {
      noMatch++;
      noMatchSpecs.add(`${specRaw} -> ${canonical} (subject not found)`);
      continue;
    }

    // Use subject's own gradeLevels so qualifications match what the scheduler expects
    const gradeLevels = subject.gradeLevels.length > 0 ? subject.gradeLevels : [7, 8, 9, 10];

    // Check if assignment already exists
    const existing = await prisma.facultySubject.findUnique({
      where: { facultyId_subjectId: { facultyId: member.id, subjectId: subject.id } },
      select: { id: true, gradeLevels: true },
    });

    if (existing) {
      // If gradeLevels is empty (created by old seedQualifiedAssignments), update it
      if (existing.gradeLevels.length === 0) {
        await prisma.facultySubject.update({
          where: { id: existing.id },
          data: { gradeLevels },
        });
        created++;
        console.log(`  UPDATED gradeLevels: ${member.lastName}, ${member.firstName} -> ${canonical} [${gradeLevels.join(',')}]`);
      } else {
        skipped++;
      }
      continue;
    }

    await prisma.facultySubject.create({
      data: {
        facultyId: member.id,
        subjectId: subject.id,
        schoolId: SCHOOL_ID,
        gradeLevels,
        sectionIds: [],
        assignedBy: 0, // 0 = system auto-assigned
      },
    });
    created++;
    console.log(`  ASSIGNED: ${member.lastName}, ${member.firstName} -> ${canonical} [${gradeLevels.join(',')}]`);
  }

  console.log('\n───────────────────────────────────────────────────────');
  console.log(`  Assignments created/updated: ${created}`);
  console.log(`  Already assigned (skipped):  ${skipped}`);
  console.log(`  No alias match (skipped):    ${noMatch}`);
  console.log('───────────────────────────────────────────────────────');

  if (noMatchSpecs.size > 0) {
    console.log('\n⚠️  Specializations with no alias match (add to seed.js if needed):');
    for (const s of noMatchSpecs) {
      console.log(`     "${s}"`);
    }
  }

  console.log('\n✅ Auto-assignment complete.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
