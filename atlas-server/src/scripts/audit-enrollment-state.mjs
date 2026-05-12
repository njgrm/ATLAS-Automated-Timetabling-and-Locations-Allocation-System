#!/usr/bin/env node
/**
 * AUDIT: Enrollment State & Program Distribution
 * 
 * Inspects:
 * 1. All sections imported from EnrollPro (program types, grade levels)
 * 2. Subject-to-program-scope mappings
 * 3. Faculty specializations and current assignments
 * 4. Violation patterns by subject
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../../.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../node_modules/.prisma/client/default.js');

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function audit() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('SECTION INVENTORY (EnrollPro imported)');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  const sections = await prisma.section.findMany({
    where: { schoolId: 1, isActive: true },
    select: {
      id: true,
      code: true,
      gradeLevel: true,
      programType: true,
      section: true,
      enrollmentCount: true,
    },
    orderBy: [{ gradeLevel: 'asc' }, { programType: 'asc' }, { section: 'asc' }],
  });

  console.log(`Total active sections: ${sections.length}\n`);

  const programDistribution = {};
  sections.forEach((s) => {
    const key = `Grade ${s.gradeLevel} - ${s.programType}`;
    if (!programDistribution[key]) programDistribution[key] = [];
    programDistribution[key].push(s.code);
  });

  Object.entries(programDistribution)
    .sort()
    .forEach(([key, codes]) => {
      console.log(`${key}: ${codes.length} sections`);
      console.log(`  ${codes.join(', ')}\n`);
    });

  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('SUBJECT CONFIGURATION BY PROGRAM SCOPE');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  const subjects = await prisma.subject.findMany({
    where: { schoolId: 1, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      programScopes: true,
      allowedSpecializations: true,
      gradeLevels: true,
      isSeedable: true,
    },
    orderBy: { code: 'asc' },
  });

  const byProgram = {};
  subjects.forEach((s) => {
    const progs = s.programScopes?.length ? s.programScopes.join(',') : 'REGULAR';
    if (!byProgram[progs]) byProgram[progs] = [];
    byProgram[progs].push({ code: s.code, name: s.name, allowed: s.allowedSpecializations });
  });

  Object.entries(byProgram)
    .sort()
    .forEach(([progs, subjs]) => {
      console.log(`Program Scope: ${progs}`);
      console.log(`  Count: ${subjs.length}`);
      subjs.forEach((s) => {
        const allowed = s.allowed?.length ? ` [allowed: ${s.allowed.join(', ')}]` : '';
        console.log(`    - ${s.code} (${s.name})${allowed}`);
      });
      console.log();
    });

  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('FACULTY SPECIALIZATION DISTRIBUTION');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  const faculty = await prisma.facultyMirror.findMany({
    where: { schoolId: 1, isStale: false, isActiveForScheduling: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      specialization: true,
      isClassAdviser: true,
    },
    orderBy: { specialization: 'asc' },
  });

  const bySpecialization = {};
  faculty.forEach((f) => {
    const spec = f.specialization || 'NO_SPECIALIZATION';
    if (!bySpecialization[spec]) bySpecialization[spec] = [];
    bySpecialization[spec].push(`${f.firstName} ${f.lastName}${f.isClassAdviser ? ' [CLASS_ADVISER]' : ''}`);
  });

  console.log(`Total active non-stale faculty: ${faculty.length}`);
  console.log(`Class advisers: ${faculty.filter((f) => f.isClassAdviser).length}\n`);

  Object.entries(bySpecialization)
    .sort()
    .forEach(([spec, names]) => {
      console.log(`${spec}: ${names.length} faculty`);
      names.slice(0, 3).forEach((n) => console.log(`  - ${n}`));
      if (names.length > 3) console.log(`  ... and ${names.length - 3} more`);
      console.log();
    });

  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('SPECIALIZATION ALIAS COVERAGE');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  const aliases = await prisma.specializationAlias.findMany({
    where: { schoolId: 1 },
    select: { alias: true, canonical: true },
    orderBy: { canonical: 'asc' },
  });

  const byCanonical = {};
  aliases.forEach((a) => {
    if (!byCanonical[a.canonical]) byCanonical[a.canonical] = [];
    byCanonical[a.canonical].push(a.alias);
  });

  console.log(`Total aliases: ${aliases.length}\n`);
  Object.entries(byCanonical)
    .sort()
    .forEach(([canonical, aliasSet]) => {
      console.log(`${canonical}: ${aliasSet.length} aliases`);
      aliasSet.slice(0, 2).forEach((a) => console.log(`  - ${a}`));
      if (aliasSet.length > 2) console.log(`  ... and ${aliasSet.length - 2} more`);
      console.log();
    });

  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('CURRENT FACULTY-SUBJECT ASSIGNMENTS (bloated state)');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  const fsCount = await prisma.facultySubject.count({
    where: { schoolId: 1 },
  });

  const activeFacultyCount = await prisma.facultyMirror.count({
    where: { schoolId: 1, isStale: false, isActiveForScheduling: true },
  });

  console.log(`Total FacultySubject rows: ${fsCount}`);
  console.log(`Active faculty: ${activeFacultyCount}`);
  console.log(`Avg assignments per faculty: ${(fsCount / activeFacultyCount).toFixed(1)}`);
  console.log(`Expected realistic avg: 3-4 per faculty\n`);

  const subjectAssignmentCounts = await prisma.facultySubject.groupBy({
    by: ['subjectId'],
    where: { schoolId: 1 },
    _count: true,
    orderBy: { _count: { subjectId: 'desc' } },
  });

  console.log('Top 10 over-assigned subjects:');
  const subjectMap = new Map(subjects.map((s) => [s.id, s.code]));
  subjectAssignmentCounts.slice(0, 10).forEach(({ subjectId, _count }) => {
    const code = subjectMap.get(subjectId) || `ID:${subjectId}`;
    console.log(`  ${code}: ${_count.subjectId} faculty (should be ~5-10)`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('CONSTRAINT ANALYSIS: ENV_SCI (Subject ID 11, likely source of violations)');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  const envSci = await prisma.subject.findFirst({
    where: { schoolId: 1, id: 11 },
    select: { id: true, code: true, name: true, allowedSpecializations: true, programScopes: true },
  });

  console.log(`Subject: ${envSci?.code} (${envSci?.name})`);
  console.log(`Program Scopes: ${envSci?.programScopes?.join(', ') || 'REGULAR'}`);
  console.log(`Allowed Specializations: ${envSci?.allowedSpecializations?.length ? envSci.allowedSpecializations.join(', ') : 'NONE (open to all)'}\n`);

  // Find all faculty currently assigned to this subject
  const envSciAssignments = await prisma.facultySubject.findMany({
    where: { schoolId: 1, subjectId: 11 },
    select: {
      facultyId: true,
      faculty: { select: { firstName: true, lastName: true, specialization: true } },
    },
    take: 5,
  });

  console.log(`Current faculty assigned to ENV_SCI: ${envSciAssignments.length} (sample of 5)`);
  envSciAssignments.forEach((fs) => {
    console.log(`  ${fs.faculty.firstName} ${fs.faculty.lastName} - Spec: ${fs.faculty.specialization || 'null'}`);
  });

  // Check which sections require ENV_SCI
  const envSciSections = await prisma.section.findMany({
    where: {
      schoolId: 1,
      isActive: true,
      sectionSubjects: {
        some: { subjectId: 11 },
      },
    },
    select: { id: true, code: true, gradeLevel: true, programType: true },
  });

  console.log(`\nSections requiring ENV_SCI: ${envSciSections.length}`);
  envSciSections.slice(0, 5).forEach((s) => {
    console.log(`  ${s.code} (Grade ${s.gradeLevel}, ${s.programType})`);
  });

  console.log(
    '\n✅ Audit complete. Use findings to understand realistic seeding strategy.\n'
  );

  await prisma.$disconnect();
}

audit().catch((e) => {
  console.error('Audit failed:', e);
  process.exit(1);
});
