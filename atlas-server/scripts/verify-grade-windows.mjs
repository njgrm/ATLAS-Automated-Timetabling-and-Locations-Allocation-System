/**
 * Verification script: confirm active-year scheduling policy and grade-shift windows
 * match the real 2026-2027 day/afternoon baseline.
 *
 * Usage:  node scripts/verify-grade-windows.mjs
 * Exit 0 = all checks pass, Exit 1 = failure detected.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXPECTED_POLICY = { earliestStartTime: '06:00', latestEndTime: '18:30' };

const EXPECTED_WINDOWS = [
  { gradeLevel: 7, programType: null, startTime: '06:00', endTime: '15:30' },
  { gradeLevel: 8, programType: null, startTime: '06:00', endTime: '15:30' },
  { gradeLevel: 9, programType: null, startTime: '09:45', endTime: '18:30' },
  { gradeLevel: 10, programType: null, startTime: '09:45', endTime: '18:30' },
  { gradeLevel: 7, programType: 'STE', startTime: '06:00', endTime: '15:30' },
  { gradeLevel: 8, programType: 'STE', startTime: '06:00', endTime: '15:30' },
  { gradeLevel: 9, programType: 'STE', startTime: '09:45', endTime: '18:30' },
  { gradeLevel: 10, programType: 'STE', startTime: '09:45', endTime: '18:30' },
  { gradeLevel: 7, programType: 'SPA', startTime: '06:00', endTime: '15:30' },
  { gradeLevel: 8, programType: 'SPA', startTime: '06:00', endTime: '15:30' },
  { gradeLevel: 9, programType: 'SPA', startTime: '09:45', endTime: '18:30' },
  { gradeLevel: 10, programType: 'SPA', startTime: '09:45', endTime: '18:30' },
  { gradeLevel: 7, programType: 'SPS', startTime: '06:00', endTime: '15:30' },
  { gradeLevel: 8, programType: 'SPS', startTime: '06:00', endTime: '15:30' },
  { gradeLevel: 9, programType: 'SPS', startTime: '09:45', endTime: '18:30' },
  { gradeLevel: 10, programType: 'SPS', startTime: '09:45', endTime: '18:30' },
];

let failed = false;

function fail(msg) {
  console.error(`  FAIL: ${msg}`);
  failed = true;
}

function pass(msg) {
  console.log(`  PASS: ${msg}`);
}

async function main() {
  console.log('=== Grade-Shift Window Baseline Verification ===\n');

  // 1. Resolve active school year — canonical ID is enrollProSchoolYearId, not mirror row id
  const activeMirror = await prisma.enrollProSchoolYearMirror.findFirst({
    where: { isActive: true },
    select: { id: true, schoolId: true, enrollProSchoolYearId: true, yearLabel: true },
    orderBy: { id: 'desc' },
  });

  if (!activeMirror) {
    fail('No active school year found in EnrollProSchoolYearMirror (isActive=true).');
    process.exit(1);
  }

  const schoolId = activeMirror.schoolId;
  const schoolYearId = activeMirror.enrollProSchoolYearId;
  const mirrorRowId = activeMirror.id;
  console.log(`Active mirror row: id=${mirrorRowId}`);
  console.log(`Canonical schoolYearId (enrollProSchoolYearId): ${schoolYearId}`);
  console.log(`schoolId=${schoolId}, yearLabel="${activeMirror.yearLabel}"\n`);

  // 2. Check scheduling policy bounds
  const policy = await prisma.schedulingPolicy.findUnique({
    where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
    select: { earliestStartTime: true, latestEndTime: true },
  });

  if (!policy) {
    fail('No SchedulingPolicy row found for active year.');
  } else {
    if (policy.earliestStartTime !== EXPECTED_POLICY.earliestStartTime) {
      fail(`Policy earliestStartTime is "${policy.earliestStartTime}", expected "${EXPECTED_POLICY.earliestStartTime}".`);
    } else {
      pass(`Policy earliestStartTime = "${policy.earliestStartTime}".`);
    }
    if (policy.latestEndTime !== EXPECTED_POLICY.latestEndTime) {
      fail(`Policy latestEndTime is "${policy.latestEndTime}", expected "${EXPECTED_POLICY.latestEndTime}".`);
    } else {
      pass(`Policy latestEndTime = "${policy.latestEndTime}".`);
    }
  }

  // 3. Check grade-shift windows
  const windows = await prisma.gradeShiftWindow.findMany({
    where: { schoolId, schoolYearId },
    orderBy: [{ gradeLevel: 'asc' }, { programType: 'asc' }],
  });

  console.log(`\nFound ${windows.length} grade-shift windows for active year.\n`);

  for (const expected of EXPECTED_WINDOWS) {
    const actual = windows.find(
      (w) => w.gradeLevel === expected.gradeLevel && w.programType === expected.programType,
    );

    if (!actual) {
      fail(`Missing window: grade ${expected.gradeLevel} programType ${expected.programType ?? 'null'}.`);
      continue;
    }

    // Check legacy default
    if (actual.startTime === '07:30' && actual.endTime === '17:00') {
      fail(`Window grade ${expected.gradeLevel} programType ${expected.programType ?? 'null'} still has legacy default 07:30-17:00.`);
    }

    // Check expected values
    if (actual.startTime !== expected.startTime || actual.endTime !== expected.endTime) {
      fail(
        `Window grade ${expected.gradeLevel} programType ${expected.programType ?? 'null'}: ` +
        `got ${actual.startTime}-${actual.endTime}, expected ${expected.startTime}-${expected.endTime}.`,
      );
    } else {
      pass(`Grade ${expected.gradeLevel} ${expected.programType ?? 'null'} = ${actual.startTime}-${actual.endTime}.`);
    }
  }

  // 4. Check for any unexpected legacy windows
  const legacyWindows = windows.filter((w) => w.startTime === '07:30' && w.endTime === '17:00');
  if (legacyWindows.length > 0) {
    fail(`${legacyWindows.length} window(s) still have legacy default 07:30-17:00.`);
  }

  console.log('\n=== Result ===');
  if (failed) {
    console.error('VERIFICATION FAILED — see FAIL messages above.');
    process.exit(1);
  } else {
    console.log('ALL CHECKS PASSED.');
    process.exit(0);
  }
}

main()
  .catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
