import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';
import {
  computeTeachingLoadMinutes,
  detectDuplicateOwnershipTuples,
} from '../services/faculty-assignment.service.js';

type CliOptions = {
  schoolId: number;
  outputPath: string;
  focus: string[];
};

type FocusedAssignment = {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  minMinutesPerWeek: number;
  sectionCount: number;
  gradeCount: number;
  sectionIds: number[];
  gradeLevels: number[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, '../../../qa-artifacts/faculty-assignment-baseline-report.json');
const DEFAULT_FOCUS = ['diego aquino', 'soriano miguel', 'miguel soriano'];

function parseArgs(argv: string[]): CliOptions {
  let schoolId = 1;
  let outputPath = DEFAULT_OUTPUT_PATH;
  let focus = DEFAULT_FOCUS;

  for (const arg of argv) {
    if (arg.startsWith('--schoolId=')) {
      schoolId = Number.parseInt(arg.split('=')[1] ?? '1', 10) || 1;
      continue;
    }
    if (arg.startsWith('--output=')) {
      const raw = arg.split('=')[1]?.trim();
      if (raw) {
        outputPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
      }
      continue;
    }
    if (arg.startsWith('--focus=')) {
      const raw = arg.split('=')[1] ?? '';
      const parsed = raw
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
      if (parsed.length > 0) {
        focus = parsed;
      }
    }
  }

  return { schoolId, outputPath, focus };
}

function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();
}

function roundHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const [faculty, assignments] = await Promise.all([
    prisma.facultyMirror.findMany({
      where: { schoolId: options.schoolId, isStale: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        maxHoursPerWeek: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    }),
    prisma.facultySubject.findMany({
      where: { schoolId: options.schoolId },
      select: {
        facultyId: true,
        subjectId: true,
        sectionIds: true,
        gradeLevels: true,
        subject: { select: { code: true, name: true, minMinutesPerWeek: true } },
        faculty: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ facultyId: 'asc' }, { subjectId: 'asc' }],
    }),
  ]);

  const assignmentsByFaculty = new Map<number, typeof assignments>();
  for (const assignment of assignments) {
    const list = assignmentsByFaculty.get(assignment.facultyId) ?? [];
    list.push(assignment);
    assignmentsByFaculty.set(assignment.facultyId, list);
  }

  const facultyRows = faculty.map((member) => {
    const rows = assignmentsByFaculty.get(member.id) ?? [];
    const sectionMinutes = computeTeachingLoadMinutes(rows, 'section');
    const gradeMinutes = computeTeachingLoadMinutes(rows, 'grade');
    const sectionHours = roundHours(sectionMinutes);
    const gradeHours = roundHours(gradeMinutes);

    return {
      facultyId: member.id,
      fullName: formatFullName(member.firstName, member.lastName),
      maxHoursPerWeek: member.maxHoursPerWeek,
      assignmentCount: rows.length,
      sectionHours,
      gradeHours,
      deltaHours: Math.round((sectionHours - gradeHours) * 10) / 10,
      sectionFormulaMinutes: sectionMinutes,
      gradeFormulaMinutes: gradeMinutes,
    };
  });

  const mismatches = facultyRows
    .filter((row) => row.sectionFormulaMinutes !== row.gradeFormulaMinutes)
    .sort((a, b) => Math.abs(b.deltaHours) - Math.abs(a.deltaHours) || a.fullName.localeCompare(b.fullName));

  const duplicateOwnership = detectDuplicateOwnershipTuples(
    assignments.map((assignment) => ({
      facultyId: assignment.facultyId,
      facultyName: formatFullName(assignment.faculty.firstName, assignment.faculty.lastName),
      subjectId: assignment.subjectId,
      sectionIds: [...assignment.sectionIds].sort((a, b) => a - b),
    })),
  );

  const focusedFaculty = facultyRows
    .filter((row) => {
      const name = row.fullName.toLowerCase();
      return options.focus.some((needle) => name.includes(needle));
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const focusedAssignments = new Map<number, FocusedAssignment[]>();
  for (const focused of focusedFaculty) {
    const rows = (assignmentsByFaculty.get(focused.facultyId) ?? [])
      .map((assignment) => ({
        subjectId: assignment.subjectId,
        subjectCode: assignment.subject.code,
        subjectName: assignment.subject.name,
        minMinutesPerWeek: assignment.subject.minMinutesPerWeek,
        sectionCount: assignment.sectionIds.length,
        gradeCount: assignment.gradeLevels.length,
        sectionIds: [...assignment.sectionIds].sort((a, b) => a - b),
        gradeLevels: [...assignment.gradeLevels].sort((a, b) => a - b),
      }))
      .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
    focusedAssignments.set(focused.facultyId, rows);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    schoolId: options.schoolId,
    totals: {
      facultyCount: facultyRows.length,
      assignmentCount: assignments.length,
      mismatchCount: mismatches.length,
      duplicateOwnershipCount: duplicateOwnership.length,
    },
    formulas: {
      sectionBased: 'sum(subject.minMinutesPerWeek * sectionIds.length) / 60',
      gradeBased: 'sum(subject.minMinutesPerWeek * gradeLevels.length) / 60',
      expectedSourceOfTruth: 'sectionBased',
    },
    mismatches,
    duplicateOwnership,
    focusedCases: focusedFaculty.map((row) => ({
      summary: row,
      assignments: focusedAssignments.get(row.facultyId) ?? [],
    })),
  };

  mkdirSync(path.dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('\nFaculty assignment baseline diagnostics complete.');
  console.log(`School ID: ${options.schoolId}`);
  console.log(`Faculty scanned: ${report.totals.facultyCount}`);
  console.log(`Assignments scanned: ${report.totals.assignmentCount}`);
  console.log(`Mismatched faculty hours (section vs grade): ${report.totals.mismatchCount}`);
  console.log(`Duplicate ownership tuples (subjectId+sectionId): ${report.totals.duplicateOwnershipCount}`);
  console.log(`Focused cases found: ${report.focusedCases.length}`);

  if (report.focusedCases.length > 0) {
    console.log('\nFocused case summaries:');
    for (const focused of report.focusedCases) {
      const s = focused.summary;
      console.log(
        `- ${s.fullName} (#${s.facultyId}): sectionHours=${s.sectionHours}, gradeHours=${s.gradeHours}, delta=${s.deltaHours}`,
      );
    }
  }

  if (report.duplicateOwnership.length > 0) {
    console.log('\nTop duplicate ownership tuples:');
    for (const tuple of report.duplicateOwnership.slice(0, 10)) {
      const owners = tuple.owners.map((owner) => `${owner.facultyName}(#${owner.facultyId})`).join(' | ');
      console.log(`- subjectId=${tuple.subjectId}, sectionId=${tuple.sectionId}, owners=${owners}`);
    }
  }

  console.log(`\nReport written to: ${options.outputPath}\n`);
}

run()
  .catch((error) => {
    console.error('Baseline diagnostics failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
