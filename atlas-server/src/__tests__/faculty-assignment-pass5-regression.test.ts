import {
  buildDuplicateOwnershipBlockingResult,
  computeTeachingLoadMinutes,
  detectDuplicateOwnershipTuples,
} from '../services/faculty-assignment.service.js';
import {
  buildSectionRosterIndex,
  normalizeIncomingAssignmentScope,
} from '../services/faculty-assignment-scope.service.js';

let passCount = 0;
let failCount = 0;

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function assert(condition: boolean, label: string) {
  if (condition) {
    passCount += 1;
    console.log(`[PASS] ${label}`);
    return;
  }
  failCount += 1;
  console.error(`[FAIL] ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  assert(actual === expected, `${label} (expected ${String(expected)}, got ${String(actual)})`);
}

const sections = [
  {
    id: 701,
    name: '7-Rizal',
    maxCapacity: 45,
    enrolledCount: 40,
    gradeLevelId: 7,
    gradeLevelName: 'Grade 7',
    displayOrder: 7,
    programType: 'REGULAR',
    programCode: 'REGULAR',
    programName: 'Regular',
    adviserId: 11,
    adviserName: 'Ana Cruz',
  },
  {
    id: 702,
    name: '7-Luna',
    maxCapacity: 45,
    enrolledCount: 38,
    gradeLevelId: 7,
    gradeLevelName: 'Grade 7',
    displayOrder: 7,
    programType: 'REGULAR',
    programCode: 'REGULAR',
    programName: 'Regular',
    adviserId: 12,
    adviserName: 'Berto Lim',
  },
  {
    id: 801,
    name: '8-Mabini',
    maxCapacity: 45,
    enrolledCount: 39,
    gradeLevelId: 8,
    gradeLevelName: 'Grade 8',
    displayOrder: 8,
    programType: 'REGULAR',
    programCode: 'REGULAR',
    programName: 'Regular',
    adviserId: 13,
    adviserName: 'Cora Yu',
  },
];

const subject = {
  id: 91,
  minMinutesPerWeek: 240,
};

const rosterIndex = buildSectionRosterIndex([
  {
    gradeLevelId: 7,
    gradeLevelName: 'Grade 7',
    displayOrder: 7,
    sections: sections.filter((entry) => entry.displayOrder === 7) as never,
  },
  {
    gradeLevelId: 8,
    gradeLevelName: 'Grade 8',
    displayOrder: 8,
    sections: sections.filter((entry) => entry.displayOrder === 8) as never,
  },
]);

section('Faculty vs teaching-load hours parity');
{
  const assignment = { subjectId: 91, sectionIds: [701, 702], gradeLevels: [7] };
  const loadMinutes = computeTeachingLoadMinutes(
    [{ subject, sectionIds: assignment.sectionIds, gradeLevels: assignment.gradeLevels }],
    'section',
  );
  const facultySubjectHours = loadMinutes / 60;
  assertEqual(facultySubjectHours, 8, 'Faculty subjectHours parity is preserved at 8.0 hours for two sections');
}

section('Multi-section same-grade correctness');
{
  const normalized = normalizeIncomingAssignmentScope({ subjectId: 91, sectionIds: [701, 702], gradeLevels: [7] }, rosterIndex);
  assert(normalized.ok, 'Normalization succeeds for two sections in the same grade level');
  if (normalized.ok) {
    assertEqual(normalized.value.gradeLevels.length, 1, 'Derived grade list deduplicates to one grade');
    assertEqual(normalized.value.gradeLevels[0], 7, 'Derived grade is Grade 7');
    const sectionLoadMinutes = computeTeachingLoadMinutes(
      [{ subject, sectionIds: normalized.value.sectionIds, gradeLevels: normalized.value.gradeLevels }],
      'section',
    );
    assertEqual(sectionLoadMinutes / 60, 8, 'Two same-grade sections correctly double the subject weekly load');
  }
}

section('Duplicate ownership detection and blocking');
{
  const duplicates = detectDuplicateOwnershipTuples([
    { facultyId: 1, facultyName: 'Santos, Joel', subjectId: 91, sectionIds: [701, 702] },
    { facultyId: 2, facultyName: 'Reyes, Ana', subjectId: 91, sectionIds: [702] },
  ]);
  assertEqual(duplicates.length, 1, 'Duplicate tuple is detected for overlapping subject-section ownership');

  const blocking = buildDuplicateOwnershipBlockingResult(
    [{ subjectId: 91, sectionId: 702, facultyId: 2 }],
    new Map([[2, 'Reyes, Ana']]),
  );
  assert(Boolean(blocking && !blocking.success), 'Blocking result is emitted for duplicate ownership conflicts');
  if (blocking && !blocking.success) {
    assertEqual(blocking.code, 'DUPLICATE_SECTION_OWNERSHIP', 'Blocking result uses DUPLICATE_SECTION_OWNERSHIP code');
  }
}

console.log(`\nSummary: ${passCount} passed, ${failCount} failed.`);
if (failCount > 0) {
  process.exitCode = 1;
}
