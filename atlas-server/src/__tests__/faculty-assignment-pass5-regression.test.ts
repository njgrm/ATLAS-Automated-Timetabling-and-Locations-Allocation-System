import {
  buildRotationTermBreakdown,
  buildDuplicateOwnershipBlockingResult,
  computeTeachingLoadMinutes,
  detectDuplicateOwnershipTuples,
  resolveAssignmentSpecializationIdentity,
} from '../services/faculty-assignment.service.js';
import {
  __testComputeCreditedCapacityMinutes,
  __testEstimateCapacityLaneDeltaMinutes,
} from '../services/teaching-load-automation.service.js';
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

section('Assignment specialization identity contract');
{
  const artsIdentity = resolveAssignmentSpecializationIdentity({
    subjectCode: 'SPA_SPEC',
    allowedSpecializations: ['MUSIC', 'DANCE'],
    facultySpecialization: 'Music',
  });
  assertEqual(artsIdentity.specializationCode, 'MUSIC', 'SPA umbrella rows derive canonical specialization code from faculty specialization');
  assertEqual(artsIdentity.specializationLabel, 'Music', 'SPA umbrella rows preserve readable specialization label');

  const sportsIdentity = resolveAssignmentSpecializationIdentity({
    subjectCode: 'SPS_SPEC',
    allowedSpecializations: ['BASKETBALL'],
    facultySpecialization: 'Basketball',
  });
  assertEqual(sportsIdentity.specializationCode, 'BASKETBALL', 'SPS umbrella rows derive canonical specialization code from faculty specialization');

  const regularIdentity = resolveAssignmentSpecializationIdentity({
    subjectCode: 'ENG',
    facultySpecialization: 'English',
  });
  assertEqual(regularIdentity.specializationCode, null, 'Regular non-specialization subjects do not auto-persist specialization identity');
}

section('Rotational peak-term credited load contract');
{
  const scienceTerm1 = {
    id: 301,
    code: 'SCI_BIO',
    rotationFamily: 'SCIENCE',
    modularGroupId: 'SCIENCE',
    modularOrder: 1,
    termGroupId: 'SCIENCE',
    termCount: 3,
    minMinutesPerWeek: 225,
  };
  const scienceTerm2 = {
    id: 302,
    code: 'SCI_ES',
    rotationFamily: 'SCIENCE',
    modularGroupId: 'SCIENCE',
    modularOrder: 2,
    termGroupId: 'SCIENCE',
    termCount: 3,
    minMinutesPerWeek: 225,
  };

  const peakOnlyMinutes = computeTeachingLoadMinutes(
    [
      { subject: scienceTerm1, sectionIds: [701, 702], gradeLevels: [7] },
      { subject: scienceTerm2, sectionIds: [701, 702], gradeLevels: [7] },
    ],
    'section',
  );
  assertEqual(peakOnlyMinutes, 450, 'Rotational family credits only the heaviest single term lane total');

  const englishYearRound = {
    id: 303,
    code: 'ENG',
    rotationFamily: null,
    modularGroupId: null,
    modularOrder: null,
    termGroupId: null,
    termCount: null,
    minMinutesPerWeek: 240,
  };
  const mixedMinutes = computeTeachingLoadMinutes(
    [
      { subject: englishYearRound, sectionIds: [701, 702], gradeLevels: [7] },
      { subject: scienceTerm1, sectionIds: [701, 702], gradeLevels: [7] },
      { subject: scienceTerm2, sectionIds: [701, 702], gradeLevels: [7] },
    ],
    'section',
  );
  assertEqual(mixedMinutes, 930, 'Year-round subjects stack on top of rotational peak-term credited load');
}

section('Hard-cap delta respects rotational peak terms');
{
  const baselineLanes = new Map<string, number>([
    ['family:SCIENCE:term:1:701', 225],
    ['family:SCIENCE:term:1:702', 225],
  ]);

  const baselineCredited = __testComputeCreditedCapacityMinutes(baselineLanes);
  assertEqual(baselineCredited, 450, 'Capacity ledger baseline credits only current peak term minutes');

  const nonPeakDelta = __testEstimateCapacityLaneDeltaMinutes(
    baselineLanes,
    'family:SCIENCE:term:3:701',
    225,
  );
  assertEqual(nonPeakDelta, 0, 'Adding a non-peak term lane does not consume additional credited hard-cap minutes');

  const peakGrowthDelta = __testEstimateCapacityLaneDeltaMinutes(
    baselineLanes,
    'family:SCIENCE:term:1:703',
    225,
  );
  assertEqual(peakGrowthDelta, 225, 'Adding to the current peak term lane consumes incremental credited hard-cap minutes');
}

section('Teacher per-term rotational breakdown contract');
{
  const breakdown = buildRotationTermBreakdown([
    {
      subjectId: 301,
      subject: {
        id: 301,
        name: 'Science - Biology',
        code: 'SCI_BIO',
        rotationFamily: 'SCIENCE',
        modularGroupId: 'SCIENCE',
        modularOrder: 1,
        termGroupId: 'SCIENCE',
        termCount: 3,
        minMinutesPerWeek: 225,
      },
      sections: [
        { id: 701, name: '7-Rizal' },
        { id: 702, name: '7-Luna' },
      ],
    },
    {
      subjectId: 302,
      subject: {
        id: 302,
        name: 'Science - Earth Science',
        code: 'SCI_ES',
        rotationFamily: 'SCIENCE',
        modularGroupId: 'SCIENCE',
        modularOrder: 2,
        termGroupId: 'SCIENCE',
        termCount: 3,
        minMinutesPerWeek: 225,
      },
      sections: [
        { id: 701, name: '7-Rizal' },
      ],
    },
  ]);

  assertEqual(breakdown.length, 1, 'Breakdown groups rotational assignments per family');
  const scienceBreakdown = breakdown[0];
  assertEqual(scienceBreakdown.family, 'SCIENCE', 'Breakdown family key is normalized');
  assertEqual(scienceBreakdown.peakTermLabel, 'Term 1', 'Breakdown exposes canonical peak term labels');
  assertEqual(scienceBreakdown.peakTermMinutesPerWeek, 450, 'Breakdown exposes peak-term credited weekly minutes');
  assertEqual(scienceBreakdown.termBuckets.length, 2, 'Breakdown includes each active rotational term bucket');

  const termOne = scienceBreakdown.termBuckets.find((bucket) => bucket.termRank === 1);
  const termTwo = scienceBreakdown.termBuckets.find((bucket) => bucket.termRank === 2);
  assert(Boolean(termOne), 'Term 1 bucket is present');
  assert(Boolean(termTwo), 'Term 2 bucket is present');
  if (termOne) {
    assertEqual(termOne.creditedMinutesPerWeek, 450, 'Term 1 credited minutes include both section lanes');
    assertEqual(termOne.isPeakTerm, true, 'Term 1 bucket is marked as peak term');
  }
  if (termTwo) {
    assertEqual(termTwo.creditedMinutesPerWeek, 225, 'Term 2 credited minutes are retained for visibility');
    assertEqual(termTwo.isPeakTerm, false, 'Non-peak term bucket is flagged correctly');
  }
}

console.log(`\nSummary: ${passCount} passed, ${failCount} failed.`);
if (failCount > 0) {
  process.exitCode = 1;
}
