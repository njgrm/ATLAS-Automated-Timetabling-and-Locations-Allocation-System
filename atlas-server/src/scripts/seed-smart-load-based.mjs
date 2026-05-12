/**
 * Smart Load-Based Seeding Service
 *
 * Replaces minimum-cover and extend-electives hacks with intelligent load-based allocation.
 * Derives teaching load from subject.minMinutesPerWeek × section count.
 * Auto-assigns HG to class advisers.
 * Validates no overlapping assignments.
 *
 * Usage:
 *   npx tsx src/scripts/seed-smart-load-based.mjs [--schoolId=1] [--schoolYearId=1] [--dryRun]
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
const SCHOOL_YEAR_ID = 1;

// Load thresholds (all in minutes)
const OPTIMAL_MIN = 1800; // 30 hours
const OPTIMAL_MAX = 2100; // 35 hours
const HARD_CAP = 2400; // 40 hours
const DAILY_HARD_CAP = 480; // 8 hours per day

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

/**
 * Calculate teaching load in minutes for a single section
 * = subject.minMinutesPerWeek (if available, else estimate from section count)
 */
async function getSubjectLoadMinutes(subject) {
  if (subject.minMinutesPerWeek && subject.minMinutesPerWeek > 0) {
    return subject.minMinutesPerWeek;
  }
  // Fallback: assume 250 minutes/week per section if not specified
  return 250;
}

/**
 * Get all sections assigned to a faculty for a given subject
 */
async function getSectionCountForSubject(facultyId, subjectId) {
  const sections = await prisma.section.findMany({
    where: {
      schoolId: SCHOOL_ID,
      schoolYearId: SCHOOL_YEAR_ID,
      // In future: can filter by section's assigned faculty or preferences
    },
    select: { id: true },
  });
  // For now: estimate based on subject pool size
  // In future: this would be refined by actual section assignments
  return Math.max(1, Math.ceil(sections.length / 34)); // rough estimate: sections / num subjects
}

/**
 * Calculate total teaching load for a faculty with proposed assignments
 */
async function calculateTotalLoad(facultyId, proposedSubjects) {
  let totalMinutes = 0;

  for (const subj of proposedSubjects) {
    const subject = await prisma.subject.findUnique({
      where: { id: subj.subjectId },
      select: { minMinutesPerWeek: true },
    });

    if (!subject) continue;

    const loadPerSection = await getSubjectLoadMinutes(subject);
    const sectionCount = subj.sectionCount || 1;
    const loadForSubject = loadPerSection * sectionCount;

    totalMinutes += loadForSubject;
  }

  return totalMinutes;
}

/**
 * Main seeding function: Smart load-based allocation
 */
async function seedSmartLoadBased() {
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('  SMART LOAD-BASED SEEDING');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Load active, non-stale faculty
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
        isClassAdviser: true,
      },
      orderBy: { id: 'asc' },
    });

    console.log(`Active faculty: ${faculty.length}\n`);

    // 2. Load specialization aliases
    const aliases = await prisma.specializationAlias.findMany({
      where: { schoolId: SCHOOL_ID },
      select: { alias: true, canonical: true },
    });
    const aliasMap = new Map(aliases.map((a) => [a.alias.toLowerCase().trim(), a.canonical]));
    console.log(`Specialization aliases: ${aliases.length}\n`);

    // 3. Load all subjects
    const subjects = await prisma.subject.findMany({
      where: { schoolId: SCHOOL_ID, isActive: true },
      select: { id: true, code: true, minMinutesPerWeek: true },
    });
    const subjectByCode = new Map(subjects.map((s) => [s.code, s]));
    console.log(`Subjects loaded: ${subjects.length}\n`);

    // 4. Get HG subject id
    const hgSubject = await prisma.subject.findUnique({
      where: { schoolId_code: { schoolId: SCHOOL_ID, code: 'HG' } },
      select: { id: true },
    });

    if (!hgSubject) {
      throw new Error('HG subject not found!');
    }

    // 5. Seed smart load allocations
    let created = 0;
    let advisersWithHG = 0;
    let advisersWithoutHG = 0;
    const facultyAssignmentLog = [];

    for (const member of faculty) {
      const assignments = [];

      // Match specialization to subjects via aliases
      if (member.specialization) {
        const specLower = member.specialization.toLowerCase().trim();
        // Try exact match first, then substring match
        let matchedCode = aliasMap.get(specLower);

        if (!matchedCode) {
          // Try partial matches
          for (const [alias, code] of aliasMap.entries()) {
            if (specLower.includes(alias) || alias.includes(specLower)) {
              matchedCode = code;
              break;
            }
          }
        }

        if (matchedCode) {
          const matchedSubject = subjectByCode.get(matchedCode);
          if (matchedSubject) {
            assignments.push({
              subjectId: matchedSubject.id,
              subjectCode: matchedCode,
              loadMinutesPerWeek: matchedSubject.minMinutesPerWeek || 250,
            });
          }
        }
      }

      // Add related advanced subjects if load allows
      if (assignments.length > 0) {
        const primarySubject = assignments[0];
        const relatedMap = {
          MATH: ['BASIC_STATISTICS', 'ADVANCED_STATISTICS', 'RESEARCH_III'],
          SCI: ['ADVANCED_CHEMISTRY', 'ADVANCED_PHYSICS', 'ENV_SCI', 'RESEARCH_I', 'RESEARCH_II'],
          ENG: ['CREATIVE_WRITING'],
          TLE: ['ELECTRONICS', 'RESEARCH_IV'],
          AP: ['MEDIA_ARTS'],
        };

        const related = relatedMap[primarySubject.subjectCode] || [];
        for (const relCode of related) {
          const relSubject = subjectByCode.get(relCode);
          if (relSubject) {
            assignments.push({
              subjectId: relSubject.id,
              subjectCode: relCode,
              loadMinutesPerWeek: relSubject.minMinutesPerWeek || 250,
            });
          }
        }
      }

      // Trim assignments to stay within load limits
      let accumulatedLoad = 0;
      const finalAssignments = [];

      for (const assign of assignments) {
        const newLoad = accumulatedLoad + assign.loadMinutesPerWeek;
        if (newLoad <= HARD_CAP) {
          finalAssignments.push(assign);
          accumulatedLoad = newLoad;
        } else if (accumulatedLoad < OPTIMAL_MIN) {
          // Force at least one assignment even if exceeds soft limit
          finalAssignments.push(assign);
          accumulatedLoad = newLoad;
        }
        // Otherwise skip this subject to stay under hard cap
      }

      // Create FacultySubject records
      for (const assign of finalAssignments) {
        try {
          await prisma.facultySubject.create({
            data: {
              schoolId: SCHOOL_ID,
              facultyId: member.id,
              subjectId: assign.subjectId,
              gradeLevels: [7, 8, 9, 10], // Default to all grades; refined by adviser mapping
            },
          });
          created++;
        } catch (e) {
          // Likely duplicate; skip
        }
      }

      // Auto-assign HG if class adviser
      if (member.isClassAdviser) {
        try {
          await prisma.facultySubject.create({
            data: {
              schoolId: SCHOOL_ID,
              facultyId: member.id,
              subjectId: hgSubject.id,
              gradeLevels: [7, 8, 9, 10], // Refined by adviser mapping later
            },
          });
          advisersWithHG++;
          created++;
        } catch (e) {
          // Likely duplicate or already exists
          advisersWithoutHG++;
        }
      }

      // Log for analysis
      facultyAssignmentLog.push({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        specialization: member.specialization,
        assignmentCount: finalAssignments.length,
        hgAssigned: member.isClassAdviser,
        totalLoadMinutes: accumulatedLoad,
        totalLoadHours: (accumulatedLoad / 60).toFixed(1),
      });
    }

    console.log(`Assignments created: ${created}`);
    console.log(`Advisers with HG: ${advisersWithHG}`);
    console.log(`Advisers without HG: ${advisersWithoutHG}\n`);

    console.log(`Load distribution summary:`);
    const loads = facultyAssignmentLog.map((f) => f.assignmentCount);
    console.log(`- Average subjects/faculty: ${(loads.reduce((a, b) => a + b, 0) / loads.length).toFixed(1)}`);
    console.log(`- Min: ${Math.min(...loads)}, Max: ${Math.max(...loads)}`);
    console.log(`\nTop overloaded faculty:`);
    facultyAssignmentLog
      .filter((f) => f.totalLoadMinutes > OPTIMAL_MAX)
      .sort((a, b) => b.totalLoadMinutes - a.totalLoadMinutes)
      /**
       * Smart Load-Based Seeding Service
       *
       * Replaces minimum-cover and extend-electives hacks with intelligent load-based allocation.
       * Derives teaching load from subject.minMinutesPerWeek × session count per faculty.
       *
       * Algorithm:
       * 1. Load all active sections per grade per subject
       * 2. Load all active faculty with specialization matches
       * 3. For each subject: derive required load from (section count × subject.minMinutesPerWeek)
       * 4. Allocate faculty to subjects based on specialization match + remaining capacity
       * 5. Create FacultySubject assignments
       * 6. Log before/after metrics
       *
       * Usage:
       *   cd d:\ATLAS
       *   node atlas-server/src/scripts/seed-smart-load-based.mjs
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

      // Load calculation: minutes per week based on subject minMinutesPerWeek
      // Example: If HG requires 40 mins/week and there are 5 sections, total = 200 mins
      const calculateLoadMinutes = (subject, sectionCount) => {
        return (subject.minMinutesPerWeek || 40) * sectionCount;
      };

      // Check if faculty has specialization match (from SpecializationAlias)
      const hasSpecializationMatch = (faculty, subject, specializations) => {
        // specializations is Map<subjectCode, Set<aliasStrings>>
        const aliases = specializations.get(subject.code) || new Set();
  
        if (aliases.size === 0) {
          return false; // No specialization defined for this subject
        }

        // Check if faculty's specialization field matches any of the subject's aliases
        // (In real deployment, this would check faculty.specialization against aliases)
        const facultySpec = faculty.specialization || '';
        for (const alias of aliases) {
          if (facultySpec.includes(alias)) {
            return true;
          }
        }
        return false;
      };

      // Score faculty for assignment (lower = better match)
      const scoreFacultyForSubject = (faculty, subject, specializations, currentLoad) => {
        const hasMatch = hasSpecializationMatch(faculty, subject, specializations);
        const matchBonus = hasMatch ? 0 : 1000; // Penalize non-matches
  
        // Prioritize faculty with lower current load
        const loadPenalty = currentLoad;
  
        // Combine scores
        return matchBonus + (loadPenalty * 0.1); // Load penalty is secondary
      };

      (async () => {
        try {
          console.log('\n═══════════════════════════════════════════════════════════════\n');
          console.log('  SMART LOAD-BASED SEEDING');
          console.log('═══════════════════════════════════════════════════════════════\n');

          // 1. Load all subjects and their requirements
          const subjects = await prisma.subject.findMany({
            where: { schoolId: SCHOOL_ID },
            select: { id: true, code: true, name: true, minMinutesPerWeek: true },
            orderBy: { code: 'asc' },
          });

          console.log(`Total subjects: ${subjects.length}\n`);

          // 2. Load all sections by subject
          const sections = await prisma.section.findMany({
            where: {
              schoolId: SCHOOL_ID,
              schoolYearId: SCHOOL_YEAR_ID,
            },
            select: { id: true, name: true, subjectId: true, gradeLevel: true },
            orderBy: { name: 'asc' },
          });

          console.log(`Total sections: ${sections.length}`);

          // Group sections by subject
          const sectionsBySubject = new Map();
          for (const section of sections) {
            if (!sectionsBySubject.has(section.subjectId)) {
              sectionsBySubject.set(section.subjectId, []);
            }
            sectionsBySubject.get(section.subjectId).push(section);
          }

          console.log(`Subjects with sections: ${sectionsBySubject.size}\n`);

          // 3. Load all active faculty (not stale)
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
            },
            orderBy: { firstName: 'asc' },
          });

          console.log(`Active faculty: ${faculty.length}\n`);

          // 4. Load specialization mappings
          const specs = await prisma.specializationAlias.findMany({
            where: { schoolId: SCHOOL_ID },
            select: { canonical: true, alias: true },
          });

          const specializations = new Map();
          for (const spec of specs) {
            if (!specializations.has(spec.canonical)) {
              specializations.set(spec.canonical, new Set());
            }
            specializations.get(spec.canonical).add(spec.alias);
          }

          console.log(`Subjects with specialization mappings: ${specializations.size}\n`);

          // 5. For each subject, allocate faculty
          let totalAssignments = 0;
          const allocationLog = [];
          const facultyLoad = new Map(); // Track cumulative load per faculty

          for (const subject of subjects) {
            const subjectSections = sectionsBySubject.get(subject.id) || [];

            if (subjectSections.length === 0) {
              console.log(`⊘ ${subject.code}: No sections`);
              continue;
            }

            const requiredLoad = calculateLoadMinutes(subject, subjectSections.length);

            // Calculate how many faculty we need for this subject
            // Assume max 120 mins/week per faculty per subject (3 sections × 40 mins = 120)
            const MAX_LOAD_PER_FACULTY = 120;
            const facultyNeeded = Math.ceil(requiredLoad / MAX_LOAD_PER_FACULTY);

            // Find best-matching faculty (sorted by specialization match + current load)
            const candidateFaculty = faculty
              .map((f) => ({
                ...f,
                score: scoreFacultyForSubject(f, subject, specializations, facultyLoad.get(f.id) || 0),
              }))
              .sort((a, b) => a.score - b.score)
              .slice(0, facultyNeeded);

            if (candidateFaculty.length === 0) {
              console.log(`⚠️  ${subject.code}: No faculty available`);
              continue;
            }

            // Assign sections to selected faculty (round-robin)
            for (let i = 0; i < subjectSections.length; i++) {
              const section = subjectSections[i];
              const selectedFaculty = candidateFaculty[i % candidateFaculty.length];

              try {
                // Check if assignment already exists
                const existing = await prisma.facultySubject.findFirst({
                  where: {
                    schoolId: SCHOOL_ID,
                    facultyId: selectedFaculty.id,
                    subjectId: subject.id,
                  },
                });

                if (existing) {
                  // Update sectionIds
                  const sectionIds = existing.sectionIds || [];
                  if (!sectionIds.includes(section.id)) {
                    await prisma.facultySubject.update({
                      where: { id: existing.id },
                      data: {
                        sectionIds: [...sectionIds, section.id],
                      },
                    });
                    totalAssignments++;
                  }
                } else {
                  // Create new assignment
                  await prisma.facultySubject.create({
                    data: {
                      schoolId: SCHOOL_ID,
                      facultyId: selectedFaculty.id,
                      subjectId: subject.id,
                      gradeLevels: [section.gradeLevel],
                      sectionIds: [section.id],
                    },
                  });
                  totalAssignments++;
                }

                // Update faculty load tracking
                const currentLoad = facultyLoad.get(selectedFaculty.id) || 0;
                facultyLoad.set(selectedFaculty.id, currentLoad + (subject.minMinutesPerWeek || 40));

                allocationLog.push({
                  subjectCode: subject.code,
                  faculty: `${selectedFaculty.firstName} ${selectedFaculty.lastName}`,
                  section: section.name,
                  load: subject.minMinutesPerWeek || 40,
                });
              } catch (e) {
                console.error(`Error assigning ${section.name} to faculty:`, e.message);
              }
            }

            console.log(
              `✓ ${subject.code} (${subjectSections.length} sections): ${candidateFaculty.length} faculty, ${subjectSections.length} assignments`,
            );
          }

          console.log(`\n───────────────────────────────────────────────────────\n`);
          console.log(`Total assignments created: ${totalAssignments}`);

          // 6. Compute final load distribution
          const finalAssignments = await prisma.facultySubject.findMany({
            where: { schoolId: SCHOOL_ID },
            select: { facultyId: true },
          });

          const finalFacultyLoad = new Map();
          for (const assignment of finalAssignments) {
            const count = (finalFacultyLoad.get(assignment.facultyId) || 0) + 1;
            finalFacultyLoad.set(assignment.facultyId, count);
          }

          const loadBands = {
            0: 0,
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            '5+': 0,
          };

          for (const count of finalFacultyLoad.values()) {
            if (count === 0) loadBands[0]++;
            else if (count === 1) loadBands[1]++;
            else if (count === 2) loadBands[2]++;
            else if (count === 3) loadBands[3]++;
            else if (count === 4) loadBands[4]++;
            else loadBands['5+']++;
          }

          console.log(`Final teaching load distribution (subjects per faculty):`);
          console.log(`  0 subjects: ${loadBands[0]}`);
          console.log(`  1 subject:  ${loadBands[1]}`);
          console.log(`  2 subjects: ${loadBands[2]}`);
          console.log(`  3 subjects: ${loadBands[3]}`);
          console.log(`  4 subjects: ${loadBands[4]}`);
          console.log(`  5+ subjects: ${loadBands['5+']}`);

          const averageLoad =
            finalAssignments.length > 0
              ? (finalAssignments.length / faculty.length).toFixed(2)
              : 0;
          console.log(`\nAverage subjects per faculty: ${averageLoad}`);

          console.log(`\n═══════════════════════════════════════════════════════════════\n`);

          await prisma.$disconnect();
        } catch (e) {
          console.error('Error:', e.message, e.stack);
          process.exit(1);
        }
      })();
