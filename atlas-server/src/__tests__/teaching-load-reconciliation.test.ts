/**
 * Teaching Load reconciliation tests (TL-C02).
 *
 * Part A is hermetic: pure demand expansion, classification, workload math, and
 * deterministic plan building over constructed snapshots (no database).
 * Part B runs the real preview/apply service against a DISPOSABLE fixture
 * school/year (created here, fully removed in `finally` with a zero-residue
 * assertion) — no live school/year is ever touched and the apply is never
 * invoked against school 1 / year 8.
 *
 * Proofs: demand expansion equivalence + scope; rotating-term demand; HG
 * exclusion across demand/plan/apply; adviser-own-section preference ranking +
 * unsatisfied reason; sequential simulated-load update; zero-load faculty
 * candidate inclusion; overload rebalance + hard-cap; UNMAPPED department
 * honesty; preview zero-write negative control; fingerprint/source-drift/
 * concurrency negative controls; idempotent replay; real service integration.
 *
 * Run with `npx tsx <this-file>`. Requires a reachable database for Part B.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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

function assertEqual(actual: unknown, expected: unknown, label: string) {
  assert(actual === expected, `${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function loadServerEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const content = readFileSync(resolve(here, '../../.env'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

// ─── Part A: hermetic snapshot builders ─────────────────────────────────────

function buildSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    schoolId: 1,
    schoolYearId: 9001,
    schoolYearAuthority: { mirrorId: 7, enrollProSchoolYearId: 9001, yearLabel: '2029-2030', isActive: true, isArchived: false, syncStatus: 'synced', updatedAt: '2026-09-08T20:43:57.400Z' },
    termConfig: { id: 71, termCount: 3, termIdentities: ['Term 1', 'Term 2', 'Term 3'], updatedAt: '2026-09-08T20:43:57.400Z' },
    offerings: [
      {
        id: 1001, subjectId: 11, gradeLevel: 7, programType: 'REGULAR', sectionMirrorId: null, cohortId: null,
        classification: 'CORE', weeklyMinutes: 240, rotationFamily: null, rotationOrder: null, termMode: 'ALL',
        isActive: true, version: 1, termAssignments: [],
      },
      {
        id: 1002, subjectId: 12, gradeLevel: 7, programType: 'REGULAR', sectionMirrorId: null, cohortId: null,
        classification: 'CORE', weeklyMinutes: 240, rotationFamily: null, rotationOrder: null, termMode: 'ALL',
        isActive: true, version: 1, termAssignments: [],
      },
      {
        id: 1003, subjectId: 13, gradeLevel: 7, programType: 'REGULAR', sectionMirrorId: null, cohortId: null,
        classification: 'CORE', weeklyMinutes: 180, rotationFamily: 'SCIENCE', rotationOrder: 1, termMode: 'ROTATING_FAMILY_MEMBER',
        isActive: true, version: 1, termAssignments: [{ termIdentity: 'Term 1' }],
      },
      {
        id: 1004, subjectId: 14, gradeLevel: 7, programType: 'REGULAR', sectionMirrorId: null, cohortId: null,
        classification: 'CORE', weeklyMinutes: 180, rotationFamily: 'SCIENCE', rotationOrder: 2, termMode: 'ROTATING_FAMILY_MEMBER',
        isActive: true, version: 1, termAssignments: [{ termIdentity: 'Term 2' }],
      },
    ],
    sections: [
      { id: 501, externalId: 101, gradeLevel: 7, programType: 'REGULAR', displayOrder: 7, isActiveForScheduling: true, isStale: false, version: 1 },
      { id: 502, externalId: 102, gradeLevel: 7, programType: 'REGULAR', displayOrder: 7, isActiveForScheduling: true, isStale: false, version: 1 },
    ],
    cohorts: [],
    subjects: [
      { id: 11, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, programScopes: ['REGULAR'], gradeLevels: [7], allowedSpecializations: [], ownerDepartment: 'MATH', rotationFamily: null, modularGroupId: null, modularOrder: null, termGroupId: null, termCount: 3, isActive: true },
      { id: 12, code: 'ENG', name: 'English', minMinutesPerWeek: 240, programScopes: ['REGULAR'], gradeLevels: [7], allowedSpecializations: [], ownerDepartment: 'ENG', rotationFamily: null, modularGroupId: null, modularOrder: null, termGroupId: null, termCount: 3, isActive: true },
      { id: 13, code: 'SCI_BIO', name: 'Science Biology', minMinutesPerWeek: 180, programScopes: ['REGULAR'], gradeLevels: [7], allowedSpecializations: [], ownerDepartment: 'SCI', rotationFamily: 'SCIENCE', modularGroupId: null, modularOrder: null, termGroupId: null, termCount: 3, isActive: true },
      { id: 14, code: 'SCI_CHEM', name: 'Science Chemistry', minMinutesPerWeek: 180, programScopes: ['REGULAR'], gradeLevels: [7], allowedSpecializations: [], ownerDepartment: 'SCI', rotationFamily: 'SCIENCE', modularGroupId: null, modularOrder: null, termGroupId: null, termCount: 3, isActive: true },
      { id: 99, code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 300, programScopes: ['REGULAR'], gradeLevels: [7], allowedSpecializations: [], ownerDepartment: 'ESP', rotationFamily: null, modularGroupId: null, modularOrder: null, termGroupId: null, termCount: 3, isActive: true },
    ],
    faculty: [
      { id: 1, firstName: 'Mara', lastName: 'Math', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: true, advisedSectionId: 101, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
      { id: 2, firstName: 'Ella', lastName: 'Eng', department: 'ENG', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: true, advisedSectionId: 102, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
      { id: 3, firstName: 'Zero', lastName: 'Load', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
    ],
    facultySubjects: [],
    ownership: [],
    specializationAliases: [],
    crossDepartmentPermissions: [],
    departmentAliases: [],
    departmentLabels: [],
    subjectOwnerPrefixes: [],
    workloadPolicy: { teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400, status: 'CONFIGURED' },
    departmentRevision: { revisionHash: 'DEADBEEF', aliasRows: 0, labelRows: 0 },
    cycleState: { state: 'POPULATED', version: 1 },
    ...overrides,
  } as any;
}

function stubResolver(rules: Array<{ facultyId: number; subjectId: number; programType: string; eligible: boolean; tier: number | null }> = []) {
  const lookup = new Map(rules.map((rule) => [`${rule.facultyId}:${rule.subjectId}:${rule.programType}`, rule]));
  return async (facultyId: number, subjectId: number, sectionProgramType: string) => {
    const rule = lookup.get(`${facultyId}:${subjectId}:${sectionProgramType}`);
    if (rule) return { eligible: rule.eligible, tier: rule.tier };
    // Fail closed: unlisted faculty/subject/program combinations are NOT eligible.
    return { eligible: false, tier: null };
  };
}

function focusedSubject(id: number, code: string, dept: string, minutes = 240, rotationFamily: string | null = null) {
  return {
    id, code, name: code, minMinutesPerWeek: minutes, programScopes: ['REGULAR'], gradeLevels: [7],
    allowedSpecializations: [], ownerDepartment: dept, rotationFamily, modularGroupId: null,
    modularOrder: null, termGroupId: null, termCount: 3, isActive: true,
  };
}

function focusedSnapshot(input: {
  subjects: any[];
  offerings: any[];
  sections?: any[];
  faculty: any[];
  ownership?: any[];
  workloadPolicy?: any;
  specializationAliases?: any[];
  crossDepartmentPermissions?: any[];
  departmentAliases?: any[];
  departmentLabels?: any[];
  subjectOwnerPrefixes?: any[];
  cycleState?: any;
}) {
  const sections = input.sections ?? [
    { id: 501, externalId: 101, gradeLevel: 7, programType: 'REGULAR', displayOrder: 7, isActiveForScheduling: true, isStale: false, version: 1 },
    { id: 502, externalId: 102, gradeLevel: 7, programType: 'REGULAR', displayOrder: 7, isActiveForScheduling: true, isStale: false, version: 1 },
  ];
  return {
    schoolId: 1,
    schoolYearId: 9001,
    schoolYearAuthority: { mirrorId: 7, enrollProSchoolYearId: 9001, yearLabel: '2029-2030', isActive: true, isArchived: false, syncStatus: 'synced', updatedAt: '2026-09-08T20:43:57.400Z' },
    termConfig: { id: 71, termCount: 3, termIdentities: ['Term 1', 'Term 2', 'Term 3'], updatedAt: '2026-09-08T20:43:57.400Z' },
    offerings: input.offerings,
    sections,
    cohorts: [],
    subjects: input.subjects,
    faculty: input.faculty,
    facultySubjects: [],
    ownership: input.ownership ?? [],
    specializationAliases: input.specializationAliases ?? [],
    crossDepartmentPermissions: input.crossDepartmentPermissions ?? [],
    departmentAliases: input.departmentAliases ?? [],
    departmentLabels: input.departmentLabels ?? [],
    subjectOwnerPrefixes: input.subjectOwnerPrefixes ?? [],
    workloadPolicy: input.workloadPolicy ?? { teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400, status: 'CONFIGURED' },
    departmentRevision: { revisionHash: 'DEADBEEF', aliasRows: (input.departmentAliases?.length ?? 0), labelRows: (input.departmentLabels?.length ?? 0) },
    cycleState: input.cycleState ?? { state: 'POPULATED', version: 1 },
  } as any;
}

function regularOffering(id: number, subjectId: number, classification = 'CORE', minutes = 240, termMode = 'ALL', termAssignments: Array<{ termIdentity: string }> = [], rotationFamily: string | null = null) {
  return {
    id, subjectId, gradeLevel: 7, programType: 'REGULAR', sectionMirrorId: null, cohortId: null,
    classification, weeklyMinutes: minutes, rotationFamily, rotationOrder: null, termMode,
    isActive: true, version: 1, termAssignments,
  };
}

// ─── Part A: hermetic tests ─────────────────────────────────────────────────

async function runHermeticTests(svc: typeof import('../services/teaching-load-reconciliation.service.js')) {
  section('A1. demand expansion equivalence + scope');
  {
    const snapshot = buildSnapshot();
    const demand = svc.expandCurriculumDemand(snapshot);
    assertEqual(demand.length, 8, 'two sections x four subjects = 8 demand pairs');
    const math101 = demand.find((pair) => pair.subjectCode === 'MATH' && pair.sectionId === 101);
    assert(!!math101, 'MATH:101 exists');
    assertEqual(math101!.weeklyMinutes, 240, 'MATH minutes from offering');
    assertEqual(math101!.termMode, 'ALL', 'ALL-term mode');
    assertEqual(math101!.termIdentities.length, 3, 'ALL terms = configured three');
  }

  section('A2. rotating-term demand');
  {
    const snapshot = buildSnapshot();
    const demand = svc.expandCurriculumDemand(snapshot);
    const bio = demand.find((pair) => pair.subjectCode === 'SCI_BIO' && pair.sectionId === 101);
    const chem = demand.find((pair) => pair.subjectCode === 'SCI_CHEM' && pair.sectionId === 101);
    assert(!!bio && !!chem, 'rotating members demanded per section');
    assertEqual(bio!.termIdentities[0], 'Term 1', 'SCI_BIO term from persisted assignment');
    assertEqual(chem!.termIdentities[0], 'Term 2', 'SCI_CHEM term from persisted assignment');
    assertEqual(bio!.rotationFamily, 'SCIENCE', 'rotation family preserved');
  }

  section('A3. HG exclusion across curriculum → demand');
  {
    const snapshot = buildSnapshot({
      offerings: [...(buildSnapshot() as any).offerings, {
        id: 2001, subjectId: 99, gradeLevel: 7, programType: 'REGULAR', sectionMirrorId: null, cohortId: null,
        classification: 'CORE', weeklyMinutes: 300, rotationFamily: null, rotationOrder: null, termMode: 'ALL',
        isActive: true, version: 1, termAssignments: [],
      }],
    });
    const demand = svc.expandCurriculumDemand(snapshot);
    assert(demand.every((pair) => pair.subjectCode !== 'HG'), 'HG never appears as demand');
    assertEqual(demand.length, 8, 'HG offering adds zero demand');
  }

  section('A4. classification vocabulary');
  {
    const snapshot = buildSnapshot({
      ownership: [
        { id: 1, subjectId: 11, sectionId: 101, facultyId: 1, facultySubjectId: 1, specializationCode: null, specializationLabel: null },
        { id: 2, subjectId: 99, sectionId: 101, facultyId: 1, facultySubjectId: 2, specializationCode: null, specializationLabel: null },
        { id: 3, subjectId: 11, sectionId: 555, facultyId: 1, facultySubjectId: 3, specializationCode: null, specializationLabel: null },
      ],
    });
    const demand = svc.expandCurriculumDemand(snapshot);
    const classifications = svc.classifyOwnershipRows(snapshot, demand, snapshot.ownership);
    const classificationRows = Array.from(classifications.values());
    const byId = new Map(classificationRows.map((row) => [row.ownershipId, row]));
    assert(byId.get(1)!.primaryAction === 'RETAIN', 'demanded active ownership retains');
    assert(byId.get(1)!.diagnostics.includes('VALID_RETAIN'), 'VALID_RETAIN diagnostic');
    assert(byId.get(2)!.primaryAction === 'RETIRE' && byId.get(2)!.diagnostics.includes('HG_FORBIDDEN'), 'HG row retires');
    assert(byId.get(3)!.primaryAction === 'RETIRE' && byId.get(3)!.diagnostics.includes('OUTSIDE_CURRICULUM'), 'outside-curriculum row retires');
    const missing = classificationRows.filter((row) => row.diagnostics.includes('MISSING_OWNER')).length;
    assertEqual(missing, 7, 'MISSING_OWNER pair-level diagnostics per missing pair');
  }

  section('A5. workload math (rotation-peak semantics)');
  {
    const snapshot = buildSnapshot();
    const subjectById: Map<number, any> = new Map((snapshot as any).subjects.map((subject: any) => [subject.id, subject]));
    const pairs = new Map<number, Array<{ subject: any; sectionId: number }>>([
      [1, [
        { subject: subjectById.get(13)!, sectionId: 101 },
        { subject: subjectById.get(14)!, sectionId: 101 },
        { subject: subjectById.get(11)!, sectionId: 101 },
      ]],
    ]);
    const minutes = svc.computeFacultyTeachingMinutes(pairs, subjectById);
    // MATH 240 always-on + max(SCI_BIO 180, SCI_CHEM 180) = 240 + 180 = 420
    assertEqual(minutes.get(1), 420, 'rotation members peak, not sum');
  }

  section('A6. adviser preference + sequential simulated load + zero-load inclusion');
  {
    const snapshot = focusedSnapshot({
      subjects: [focusedSubject(11, 'MATH', 'MATH'), focusedSubject(12, 'ENG', 'ENG')],
      offerings: [regularOffering(1001, 11), regularOffering(1002, 12)],
      faculty: [
        { id: 1, firstName: 'Mara', lastName: 'Math', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: true, advisedSectionId: 101, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
        { id: 2, firstName: 'Ella', lastName: 'Eng', department: 'ENG', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: true, advisedSectionId: 102, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
        { id: 3, firstName: 'Zero', lastName: 'Load', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
      ],
      ownership: [
        { id: 1, subjectId: 11, sectionId: 101, facultyId: 1, facultySubjectId: 1, specializationCode: null, specializationLabel: null },
      ],
    });
    const resolver = stubResolver([
      { facultyId: 1, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
      { facultyId: 2, subjectId: 12, programType: 'REGULAR', eligible: true, tier: 2 },
      { facultyId: 3, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
    ]);
    const plan = await svc.buildReconciliationPlan(snapshot, resolver);
    const inserts = plan.actions.filter((entry) => entry.action === 'INSERT');
    assertEqual(inserts.length, 3, 'three missing pairs inserted');
    const math101 = plan.actions.find((entry) => entry.subjectCode === 'MATH' && entry.sectionId === 101);
    assertEqual(math101?.action, 'RETAIN', 'MATH:101 retained on the adviser (existing valid ownership)');
    const math102 = plan.actions.find((entry) => entry.subjectCode === 'MATH' && entry.sectionId === 102);
    assertEqual(math102?.proposedFacultyId, 3, 'zero-load qualified faculty 3 enters evaluation and is chosen first for MATH:102');
    const eng101 = plan.actions.find((entry) => entry.subjectCode === 'ENG' && entry.sectionId === 101);
    assertEqual(eng101?.proposedFacultyId, 2, 'ENG:101 goes to the qualified ENG faculty (faculty 2), not the unqualified adviser');
    const eng102 = plan.actions.find((entry) => entry.subjectCode === 'ENG' && entry.sectionId === 102);
    assertEqual(eng102?.proposedFacultyId, 2, 'ENG:102 goes to qualified ENG faculty');
    const satisfied1 = plan.adviserPreference.find((outcome) => outcome.facultyId === 1 && outcome.sectionId === 101);
    assert(satisfied1?.satisfied === true, 'adviser 1 satisfied with one demanded subject in advisory section 101');
    const satisfied2 = plan.adviserPreference.find((outcome) => outcome.facultyId === 2 && outcome.sectionId === 102);
    assert(satisfied2?.satisfied === true, 'adviser 2 satisfied (owns ENG in 102)');
    // Sequential simulated load: faculty 3 receives MATH:102 at 240 minutes and
    // would receive a second identical pair only if it remained lowest-load.
    const faculty3After = plan.facultyWorkloads.find((row) => row.facultyId === 3);
    assertEqual(faculty3After?.afterMinutes, 240, 'simulated load updated after every assignment');
  }

  section('A7. adviser preference unsatisfied reason');
  {
    const snapshot = focusedSnapshot({
      subjects: [focusedSubject(11, 'MATH', 'MATH'), focusedSubject(12, 'ENG', 'ENG')],
      offerings: [regularOffering(1001, 11), regularOffering(1002, 12)],
      faculty: [
        { id: 5, firstName: 'No', lastName: 'Qual', department: 'FIL', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: true, advisedSectionId: 101, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
        { id: 6, firstName: 'Qual', lastName: 'Backup', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
      ],
    });
    const resolver = stubResolver([
      { facultyId: 6, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
      { facultyId: 6, subjectId: 12, programType: 'REGULAR', eligible: true, tier: 2 },
    ]);
    const plan = await svc.buildReconciliationPlan(snapshot, resolver);
    const outcome = plan.adviserPreference.find((entry) => entry.facultyId === 5);
    assert(!!outcome, 'adviser outcome recorded');
    assertEqual(outcome!.satisfied, false, 'unsatisfied when adviser is not qualified');
    assertEqual(outcome!.reason, 'ADVISER_NOT_QUALIFIED_FOR_DEMANDED_SUBJECTS', 'visible typed reason returned');
  }

  section('A8. overload rebalance + hard-cap safety');
  {
    const snapshot = focusedSnapshot({
      subjects: [focusedSubject(11, 'MATH', 'MATH', 240)],
      offerings: [regularOffering(1001, 11)],
      faculty: [
        { id: 1, firstName: 'Over', lastName: 'One', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
        { id: 2, firstName: 'Under', lastName: 'Two', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
      ],
      ownership: [
        { id: 1, subjectId: 11, sectionId: 101, facultyId: 1, facultySubjectId: 1, specializationCode: null, specializationLabel: null },
        { id: 2, subjectId: 11, sectionId: 102, facultyId: 1, facultySubjectId: 2, specializationCode: null, specializationLabel: null },
      ],
      workloadPolicy: { teachingStandardMinutes: 240, advisoryCreditMinutes: 0, hardCapMinutes: 480, status: 'CONFIGURED' },
    });
    const resolver = stubResolver([
      { facultyId: 1, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
      { facultyId: 2, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
    ]);
    const plan = await svc.buildReconciliationPlan(snapshot, resolver);
    const rebalanceMove = plan.actions.find((entry) => entry.action === 'MOVE' && entry.diagnostics.includes('OVER_STANDARD'));
    assert(!!rebalanceMove, 'an over-standard pair is proposed for a rebalance move');
    assertEqual(rebalanceMove!.currentOwnerId, 1, 'rebalance donor is the over-standard faculty');
    assertEqual(rebalanceMove!.proposedFacultyId, 2, 'move targets the qualified underloaded faculty');
    const after1 = plan.facultyWorkloads.find((row) => row.facultyId === 1);
    const after2 = plan.facultyWorkloads.find((row) => row.facultyId === 2);
    assertEqual(after1!.afterMinutes, 240, 'donor reduced to standard');
    assertEqual(after2!.afterMinutes, 240, 'recipient at standard');
    assertEqual(after1!.afterStatus, 'at-standard', 'donor excess resolved');
  }

  section('A10. hard-cap gate uses the credited minutes, never a smaller offering value');
  {
    const snapshot = focusedSnapshot({
      subjects: [focusedSubject(11, 'MATH', 'MATH', 240)],
      offerings: [regularOffering(1001, 11, 'CORE', 100)],
      sections: [{ id: 501, externalId: 101, gradeLevel: 7, programType: 'REGULAR', displayOrder: 7, isActiveForScheduling: true, isStale: false, version: 1 }],
      faculty: [
        { id: 1, firstName: 'Mara', lastName: 'Math', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
      ],
      workloadPolicy: { teachingStandardMinutes: 180, advisoryCreditMinutes: 0, hardCapMinutes: 200, status: 'CONFIGURED' },
    });
    const resolver = stubResolver([
      { facultyId: 1, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
    ]);
    const plan = await svc.buildReconciliationPlan(snapshot, resolver);
    const unresolved = plan.actions.find((entry) => entry.action === 'UNRESOLVED');
    assert(!!unresolved, 'pair is unresolved because the credited 240 minutes exceed the 200 hard cap');
    assertEqual(unresolved!.unresolvedReason, 'NO_QUALIFIED_CANDIDATE', 'typed reason when no safe candidate exists');
  }

  section('A9. fingerprint determinism and source sensitivity');
  {
    const snapshotA = buildSnapshot();
    const snapshotB = buildSnapshot();
    const planA = await svc.buildReconciliationPlan(snapshotA, stubResolver());
    const planB = await svc.buildReconciliationPlan(snapshotB, stubResolver());
    assertEqual(planA.fingerprint, planB.fingerprint, 'identical snapshots → identical fingerprints');
    assertEqual(planA.sourceRevision, planB.sourceRevision, 'identical snapshots → identical source revision');
    const drifted = buildSnapshot({ offerings: (buildSnapshot() as any).offerings.map((offering: any) => offering.id === 1001 ? { ...offering, version: 2 } : offering) });
    const planC = await svc.buildReconciliationPlan(drifted, stubResolver());
    assert(planC.sourceRevision !== planA.sourceRevision, 'offering version drift flips the source revision');
    assert(planC.fingerprint !== planA.fingerprint, 'offering version drift flips the fingerprint');
  }

  section('A11. final-action model: one action per demanded pair (264 never reports 278)');
  {
    // Two demanded pairs, both owned by faculty 1 (over-standard). Rebalance
    // must move one pair — REPLACING that pair's RETAIN with a MOVE — so the
    // final plan has exactly one action per pair and owned never exceeds demand.
    const snapshot = focusedSnapshot({
      subjects: [focusedSubject(11, 'MATH', 'MATH', 240)],
      offerings: [regularOffering(1001, 11)],
      faculty: [
        { id: 1, firstName: 'Over', lastName: 'One', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
        { id: 2, firstName: 'Under', lastName: 'Two', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
      ],
      ownership: [
        { id: 1, subjectId: 11, sectionId: 101, facultyId: 1, facultySubjectId: 1, specializationCode: null, specializationLabel: null },
        { id: 2, subjectId: 11, sectionId: 102, facultyId: 1, facultySubjectId: 2, specializationCode: null, specializationLabel: null },
      ],
      workloadPolicy: { teachingStandardMinutes: 240, advisoryCreditMinutes: 0, hardCapMinutes: 480, status: 'CONFIGURED' },
    });
    const resolver = stubResolver([
      { facultyId: 1, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
      { facultyId: 2, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
    ]);
    const plan = await svc.buildReconciliationPlan(snapshot, resolver);

    const pairKeys = plan.actions.map((entry) => `${entry.subjectId}:${entry.sectionId}`);
    assertEqual(new Set(pairKeys).size, pairKeys.length, 'every final action has a unique subject-section pair');

    const demandCount = plan.demand.length;
    const retained = plan.actions.filter((entry) => entry.action === 'RETAIN').length;
    const inserted = plan.actions.filter((entry) => entry.action === 'INSERT').length;
    const moved = plan.actions.filter((entry) => entry.action === 'MOVE').length;
    const unresolved = plan.actions.filter((entry) => entry.action === 'UNRESOLVED').length;
    assertEqual(retained + inserted + moved + unresolved, demandCount, 'RETAIN + INSERT + MOVE + UNRESOLVED === demandCount (final-action invariant)');
    assert(retained + moved + inserted <= demandCount, 'owned demand pairs never exceed demand (264 cannot report 278)');

    const rebalanceMove = plan.actions.find((entry) => entry.action === 'MOVE' && entry.diagnostics.includes('OVER_STANDARD'));
    assert(!!rebalanceMove, 'rebalance move produced');
    const samePair = plan.actions.filter((entry) => entry.subjectId === rebalanceMove!.subjectId && entry.sectionId === rebalanceMove!.sectionId);
    assertEqual(samePair.length, 1, 'the moved pair appears exactly once (its RETAIN was replaced, not appended)');
    assertEqual(samePair[0].action, 'MOVE', 'the surviving action for the moved pair is MOVE');
  }

  section('A12. adviser-own-section preference transfers a validly-owned pair');
  {
    // All demand pairs are validly owned by a non-adviser; the qualified adviser
    // of the section owns nothing. The plan must safely transfer ONE pair to the
    // adviser (hard-cap safe, one grant per section, no duplicate action).
    const snapshot = focusedSnapshot({
      subjects: [focusedSubject(11, 'MATH', 'MATH', 240)],
      offerings: [regularOffering(1001, 11)],
      sections: [{ id: 501, externalId: 101, gradeLevel: 7, programType: 'REGULAR', displayOrder: 7, isActiveForScheduling: true, isStale: false, version: 1 }],
      faculty: [
        { id: 1, firstName: 'Non', lastName: 'Adviser', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
        { id: 2, firstName: 'Ms', lastName: 'Adviser', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: true, advisedSectionId: 101, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
      ],
      ownership: [
        { id: 1, subjectId: 11, sectionId: 101, facultyId: 1, facultySubjectId: 1, specializationCode: null, specializationLabel: null },
      ],
      workloadPolicy: { teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400, status: 'CONFIGURED' },
    });
    const resolver = stubResolver([
      { facultyId: 1, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
      { facultyId: 2, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
    ]);
    const plan = await svc.buildReconciliationPlan(snapshot, resolver);
    const transfer = plan.actions.find((entry) => entry.action === 'MOVE' && entry.adviserPreferenceApplied);
    assert(!!transfer, 'a validly-owned pair is transferred to the qualified adviser');
    assertEqual(transfer!.currentOwnerId, 1, 'transfer donor is the previous valid owner');
    assertEqual(transfer!.proposedFacultyId, 2, 'transfer recipient is the section adviser');
    const adviserOutcome = plan.adviserPreference.find((outcome) => outcome.facultyId === 2);
    assert(adviserOutcome?.satisfied === true, 'adviser satisfied after the transfer');
    const adviserAfter = plan.facultyWorkloads.find((row) => row.facultyId === 2);
    assertEqual(adviserAfter!.afterMinutes, 240, 'adviser load after transfer respects minutes');
  }

  section('A13. reconciliation routes through the canonical qualification evaluator (differential)');
  {
    const snapshot = focusedSnapshot({
      subjects: [
        focusedSubject(11, 'MATH', 'MATH'),
        { ...focusedSubject(13, 'SCI_BIO', 'SCI'), allowedSpecializations: ['SCIENCE'] },
        { ...focusedSubject(14, 'ENG', 'ENG'), programScopes: ['STE'] },
      ],
      offerings: [regularOffering(1001, 11), regularOffering(1002, 13), regularOffering(1003, 14)],
      sections: [
        { id: 501, externalId: 101, gradeLevel: 7, programType: 'REGULAR', displayOrder: 7, isActiveForScheduling: true, isStale: false, version: 1 },
      ],
      faculty: [
        { id: 1, firstName: 'Dept', lastName: 'Only', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
        { id: 2, firstName: 'Spec', lastName: 'Alias', department: 'SCI', specialization: 'BIO-SCI', canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
        { id: 3, firstName: 'Cross', lastName: 'Dept', department: 'FIL', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
        { id: 4, firstName: 'Stale', lastName: 'Faculty', department: 'FIL', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: true, version: 1 },
        { id: 5, firstName: 'Outside', lastName: 'Override', department: 'FIL', specialization: null, canTeachOutsideDepartment: true, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
      ],
      specializationAliases: [{ alias: 'BIO-SCI', canonical: 'SCIENCE' }],
      crossDepartmentPermissions: [{ facultyId: 3, subjectId: 11 }],
      departmentLabels: [{ code: 'MATH', label: 'Mathematics' }, { code: 'SCI', label: 'Science' }, { code: 'ENG', label: 'English' }, { code: 'FIL', label: 'Filipino' }],
    });
    const resolver = svc.buildQualificationResolver(snapshot);

    const cases = [
      { label: 'department match', facultyId: 1, subjectId: 11, programType: 'REGULAR', expectEligible: true },
      { label: 'specialization alias (tier 1)', facultyId: 2, subjectId: 13, programType: 'REGULAR', expectEligible: true },
      { label: 'cross-department permission (tier 3)', facultyId: 3, subjectId: 11, programType: 'REGULAR', expectEligible: true },
      { label: 'program mismatch', facultyId: 1, subjectId: 14, programType: 'REGULAR', expectEligible: false },
      { label: 'inactive/stale faculty', facultyId: 4, subjectId: 11, programType: 'REGULAR', expectEligible: false },
      { label: 'canTeachOutsideDepartment (tier 3)', facultyId: 5, subjectId: 11, programType: 'REGULAR', expectEligible: true },
    ];

    const qe = await import('../services/qualification-evaluator.service.js') as typeof import('../services/qualification-evaluator.service.js');
    const canonicalPolicy = qe.buildQualificationPolicySnapshot(snapshot.schoolId, {
      departmentAliases: snapshot.departmentAliases,
      departmentLabels: snapshot.departmentLabels,
      subjectOwnerPrefixes: snapshot.subjectOwnerPrefixes,
      crossDepartmentPermissions: snapshot.crossDepartmentPermissions,
      legacyCrossLanguageException: false,
      persistedOnly: true,
    });

    for (const testCase of cases) {
      const member = (snapshot as any).faculty.find((f: any) => f.id === testCase.facultyId);
      const subject = (snapshot as any).subjects.find((s: any) => s.id === testCase.subjectId);
      const resolved = await resolver(testCase.facultyId, testCase.subjectId, testCase.programType);
      const canonical = qe.evaluateQualificationWithPolicy(
        {
          facultyId: member.id,
          facultyDepartment: member.department,
          facultySpecialization: member.specialization,
          canTeachOutsideDepartment: member.canTeachOutsideDepartment,
          subjectId: subject.id,
          subjectCode: subject.code,
          subjectName: subject.name,
          subjectOwnerDepartment: subject.ownerDepartment,
          subjectAllowedDepartments: subject.ownerDepartment ? [subject.ownerDepartment] : [],
          subjectAllowedSpecializations: subject.allowedSpecializations,
          subjectProgramScopes: subject.programScopes,
          sectionProgramType: testCase.programType as never,
          specializationAliases: snapshot.specializationAliases,
        },
        canonicalPolicy,
      );
      assertEqual(resolved.eligible, canonical.eligible, `${testCase.label}: resolver eligibility equals canonical evaluator`);
      assertEqual(resolved.tier, canonical.tier, `${testCase.label}: resolver tier equals canonical evaluator`);
      assertEqual(resolved.eligible, testCase.expectEligible, `${testCase.label}: expected eligibility`);
    }
  }

  section('A14. adviser-transfer hard-cap gate uses credited minutes, not offering minutes');
  {
    // MATH is credited 240 but its offering declares 120. The adviser already
    // carries 60 minutes (GEN in section 102). With hardCap 240, granting the
    // MATH:101 transfer using the offering value (60+120<=240) would push the
    // adviser to 300 > cap. The gate must use the credited 240 → no transfer.
    const snapshot = focusedSnapshot({
      subjects: [focusedSubject(11, 'MATH', 'MATH', 240), { ...focusedSubject(15, 'GEN', 'MATH', 60), programScopes: ['STE'] }],
      offerings: [
        regularOffering(1001, 11, 'CORE', 120),
        {
          id: 1002, subjectId: 15, gradeLevel: 7, programType: 'STE', sectionMirrorId: null, cohortId: null,
          classification: 'CORE', weeklyMinutes: 60, rotationFamily: null, rotationOrder: null, termMode: 'ALL',
          isActive: true, version: 1, termAssignments: [],
        },
      ],
      sections: [
        { id: 501, externalId: 101, gradeLevel: 7, programType: 'REGULAR', displayOrder: 7, isActiveForScheduling: true, isStale: false, version: 1 },
        { id: 502, externalId: 102, gradeLevel: 7, programType: 'STE', displayOrder: 7, isActiveForScheduling: true, isStale: false, version: 1 },
      ],
      faculty: [
        { id: 1, firstName: 'Non', lastName: 'Adviser', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: false, advisedSectionId: null, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
        { id: 2, firstName: 'Ms', lastName: 'Adviser', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isClassAdviser: true, advisedSectionId: 101, isActiveForScheduling: true, isPlaceholder: false, isStale: false, version: 1 },
      ],
      ownership: [
        { id: 1, subjectId: 11, sectionId: 101, facultyId: 1, facultySubjectId: 1, specializationCode: null, specializationLabel: null },
        { id: 2, subjectId: 15, sectionId: 102, facultyId: 2, facultySubjectId: 2, specializationCode: null, specializationLabel: null },
      ],
      workloadPolicy: { teachingStandardMinutes: 240, advisoryCreditMinutes: 0, hardCapMinutes: 240, status: 'CONFIGURED' },
    });
    const resolver = stubResolver([
      { facultyId: 1, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
      { facultyId: 2, subjectId: 11, programType: 'REGULAR', eligible: true, tier: 2 },
      { facultyId: 1, subjectId: 15, programType: 'STE', eligible: true, tier: 2 },
      { facultyId: 2, subjectId: 15, programType: 'STE', eligible: true, tier: 2 },
    ]);
    const plan = await svc.buildReconciliationPlan(snapshot, resolver);
    const transfer = plan.actions.find((entry) => entry.action === 'MOVE' && entry.adviserPreferenceApplied);
    assert(!transfer, 'no adviser transfer is granted because the credited minutes would exceed the hard cap');
    const adviserOutcome = plan.adviserPreference.find((outcome) => outcome.facultyId === 2);
    assertEqual(adviserOutcome?.satisfied, false, 'adviser preference unsatisfied under hard-cap conflict');
    assertEqual(adviserOutcome?.reason, 'HARD_CAP_CONFLICT_OR_NO_SAFE_TRANSFER', 'truthful typed reason returned');
    const adviserAfter = plan.facultyWorkloads.find((row) => row.facultyId === 2);
    assert(adviserAfter!.afterMinutes <= 240, 'adviser load never exceeds the hard cap');
    assertEqual(adviserAfter!.afterMinutes, 60, 'adviser load stays at the pre-existing 60 minutes');
  }
}

// ─── Part B: disposable-fixture DB integration ──────────────────────────────

const WRITE_ACTIONS = new Set([
  'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany',
  'executeRaw', 'queryRaw',
]);

const recorded: Array<{ model?: string; action: string }> = [];

function writes() {
  return recorded.filter((stmt) => WRITE_ACTIONS.has(stmt.action));
}

function resetRecording() {
  recorded.length = 0;
}

async function runFixtureTests(svc: typeof import('../services/teaching-load-reconciliation.service.js')) {
  const prismaModule = await import('../lib/prisma.js');
  const dataContext = await import('../lib/data-context.js');

  const base = (prismaModule as any).createTestPrismaClient();
  const instrumented = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          recorded.push({ model, action: operation });
          return query(args);
        },
      },
    },
  });
  const run = <T>(fn: () => Promise<T>): Promise<T> =>
    (dataContext as any).withDataContext(instrumented, fn);

  const FIXTURE_NAME = 'TL-C02 FIXTURE SCHOOL — SAFE TO DELETE';
  let fixtureSchoolId = 0;
  const fixtureYearId = 9025;
  let fixtureTermConfigId = 0;
  let fixtureSection101 = 0;
  let fixtureSection102 = 0;
  let fixtureSubjectMath = 0;
  let fixtureSubjectEng = 0;
  let fixtureFaculty1 = 0;
  let fixtureFaculty2 = 0;
  let fixtureFaculty3 = 0;

  try {
    section('B1. fixture setup (disposable school/year, zero live impact)');
    const created = await instrumented.school.create({
      data: { name: FIXTURE_NAME, shortName: 'TLC02FX' },
      select: { id: true },
    });
    fixtureSchoolId = (created as any).id as number;
    assert(fixtureSchoolId > 0, `fixture school created (id=${fixtureSchoolId})`);

    await instrumented.enrollProSchoolYearMirror.create({
      data: {
        schoolId: fixtureSchoolId,
        enrollProSchoolYearId: fixtureYearId,
        yearLabel: '2029-2030',
        isActive: true,
        isArchived: false,
        syncStatus: 'synced',
      },
    });

    const termConfig = await instrumented.schoolYearTermConfig.create({
      data: {
        schoolId: fixtureSchoolId,
        schoolYearId: fixtureYearId,
        termCount: 3,
        termIdentities: ['Term 1', 'Term 2', 'Term 3'],
        isActive: true,
      },
      select: { id: true },
    });
    fixtureTermConfigId = (termConfig as any).id as number;

    const mathSubject = await instrumented.subject.create({
      data: {
        schoolId: fixtureSchoolId, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240,
        programScopes: ['REGULAR'], gradeLevels: [7], ownerDepartment: 'MATH', isActive: true,
      },
      select: { id: true },
    });
    fixtureSubjectMath = (mathSubject as any).id as number;
    const engSubject = await instrumented.subject.create({
      data: {
        schoolId: fixtureSchoolId, code: 'ENG', name: 'English', minMinutesPerWeek: 240,
        programScopes: ['REGULAR'], gradeLevels: [7], ownerDepartment: 'ENG', isActive: true,
      },
      select: { id: true },
    });
    fixtureSubjectEng = (engSubject as any).id as number;

    const section101 = await instrumented.sectionMirror.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, externalId: 101, name: 'Grade 7 - A',
        gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 50, enrolledCount: 50,
        isActiveForScheduling: true, isStale: false,
      },
      select: { id: true },
    });
    fixtureSection101 = (section101 as any).id as number;
    const section102 = await instrumented.sectionMirror.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, externalId: 102, name: 'Grade 7 - B',
        gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 50, enrolledCount: 50,
        isActiveForScheduling: true, isStale: false,
      },
      select: { id: true },
    });
    fixtureSection102 = (section102 as any).id as number;

    const faculty1 = await instrumented.facultyMirror.create({
      data: {
        schoolId: fixtureSchoolId, externalId: 7001, employeeId: 'EMP7001', firstName: 'Mara', lastName: 'Math',
        department: 'MATH', isActiveForScheduling: true, isClassAdviser: false, maxHoursPerWeek: 30,
      },
      select: { id: true },
    });
    fixtureFaculty1 = (faculty1 as any).id as number;
    const faculty2 = await instrumented.facultyMirror.create({
      data: {
        schoolId: fixtureSchoolId, externalId: 7002, employeeId: 'EMP7002', firstName: 'Ella', lastName: 'Eng',
        department: 'ENG', isActiveForScheduling: true, isClassAdviser: false, maxHoursPerWeek: 30,
      },
      select: { id: true },
    });
    fixtureFaculty2 = (faculty2 as any).id as number;

    await instrumented.schoolYearOffering.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, termConfigId: fixtureTermConfigId,
        subjectId: fixtureSubjectMath, gradeLevel: 7, programType: 'REGULAR',
        classification: 'CORE', weeklyMinutes: 240, termMode: 'ALL', isActive: true,
      },
    });
    await instrumented.schoolYearOffering.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, termConfigId: fixtureTermConfigId,
        subjectId: fixtureSubjectEng, gradeLevel: 7, programType: 'REGULAR',
        classification: 'CORE', weeklyMinutes: 240, termMode: 'ALL', isActive: true,
      },
    });

    // Existing ownership: MATH:101 → faculty 1 (valid); ENG:102 → faculty 1 (unqualified).
    const fsMath = await instrumented.facultySubject.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: fixtureFaculty1,
        subjectId: fixtureSubjectMath, sectionIds: [101], gradeLevels: [7], assignedBy: 0,
      },
      select: { id: true },
    });
    const fsEng = await instrumented.facultySubject.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: fixtureFaculty1,
        subjectId: fixtureSubjectEng, sectionIds: [102], gradeLevels: [7], assignedBy: 0,
      },
      select: { id: true },
    });
    await instrumented.subjectSectionOwnership.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, subjectId: fixtureSubjectMath,
        sectionId: 101, facultyId: fixtureFaculty1, facultySubjectId: (fsMath as any).id as number,
      },
    });
    await instrumented.subjectSectionOwnership.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, subjectId: fixtureSubjectEng,
        sectionId: 102, facultyId: fixtureFaculty1, facultySubjectId: (fsEng as any).id as number,
      },
    });
    resetRecording();

    section('B2a. UNMAPPED department display stays honest; persisted codes still qualify');
    const unmappedPreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    assertEqual(unmappedPreview.departmentAuthority.status, 'EMPTY', 'department authority EMPTY without label rows (honest display)');
    assertEqual(unmappedPreview.departmentAuthority.labelRows, 0, 'zero label rows');
    // Qualification matches persisted department values exactly (never name/
    // prefix inference) even before label rows exist; the display stays UNMAPPED.
    assertEqual(unmappedPreview.actionTotals.UNRESOLVED, 0, 'persisted-code department equality qualifies without label rows');
    assertEqual(unmappedPreview.authorizesMutation, false, 'unmapped preview authorizes no mutation');

    // Provision the canonical department label rows (the production department-
    // authority apply is a separate operator approval; the fixture provisions
    // the equivalent rows directly so the happy path is exercised).
    await instrumented.departmentLabel.create({ data: { schoolId: fixtureSchoolId, code: 'MATH', label: 'Mathematics' } });
    await instrumented.departmentLabel.create({ data: { schoolId: fixtureSchoolId, code: 'ENG', label: 'English' } });
    resetRecording();

    section('B2b. cycle truth: MISSING / MISMATCH / POPULATED are reported truthfully, never hardcoded');
    const missingCyclePreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    assertEqual(missingCyclePreview.cycleImpact.stateBefore, 'MISSING', 'no cycle row → MISSING');
    await instrumented.teachingLoadCycle.create({
      data: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, state: 'EMPTY' },
    });
    const mismatchPreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    assertEqual(mismatchPreview.cycleImpact.stateBefore, 'MISMATCH', 'persisted EMPTY with ownership present → MISMATCH');
    await instrumented.teachingLoadCycle.update({
      where: { schoolId_schoolYearId: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } },
      data: { state: 'POPULATED' },
    });
    const populatedPreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    assertEqual(populatedPreview.cycleImpact.stateBefore, 'POPULATED', 'persisted POPULATED with ownership present → POPULATED');
    resetRecording();

    section('B2. preview is zero-write and produces a demand-aware plan');
    const preview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    assert(writes().length === 0, 'preview performs zero writes');
    const readOps = recorded.filter((stmt) => !WRITE_ACTIONS.has(stmt.action));
    assert(readOps.length < 30, `preview read query count is bounded and set-based (${readOps.length} read ops, no N+1)`);
    assert(readOps.every((stmt) => ['findMany', 'findFirst', 'aggregate', 'findUnique', 'count'].includes(stmt.action)), 'preview uses set-based/batched reads only');
    assertEqual(preview.before.ownershipCount, 2, 'census ownership count');
    assertEqual(preview.before.demandCount, 4, 'mechanical demand count (2 subjects x 2 sections)');
    assertEqual(preview.actionTotals.RETAIN, 1, 'MATH:101 retains');
    assertEqual(preview.actionTotals.MOVE, 1, 'ENG:102 moves from unqualified faculty 1');
    assertEqual(preview.actionTotals.INSERT, 2, 'MATH:102 and ENG:101 inserted');
    assertEqual(preview.actionTotals.UNRESOLVED, 0, 'no unresolved pairs with two qualified faculties');
    assertEqual(preview.hgRows.found, 0, 'zero HG rows in fixture');
    assertEqual(preview.authorizesMutation, false, 'preview authorizes no mutation');
    assert(preview.fingerprint.length === 64, 'canonical SHA-256 fingerprint');
    const moved = preview.actions.find((entry) => entry.action === 'MOVE');
    assertEqual(moved?.proposedFacultyId, fixtureFaculty2, 'unqualified ENG owner moved to qualified ENG faculty');

    section('B3. apply requires exact confirmation + fingerprint + actor scope');
    let threw = false;
    try {
      await run(() => svc.applyTeachingLoadReconciliation({
        actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
        expectedFingerprint: preview.fingerprint, expectedSourceRevision: preview.sourceRevision,
        confirmationText: 'WRONG',
      }));
    } catch (error: any) {
      threw = error?.code === 'CONFIRMATION_REQUIRED' && error?.statusCode === 400;
    }
    assert(threw, 'missing confirmation → 400 CONFIRMATION_REQUIRED');
    threw = false;
    try {
      await run(() => svc.applyTeachingLoadReconciliation({
        actorSchoolId: fixtureSchoolId + 999, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
        expectedFingerprint: preview.fingerprint, expectedSourceRevision: preview.sourceRevision,
        confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
      }));
    } catch (error: any) {
      threw = error?.code === 'SCHOOL_MISMATCH' && error?.statusCode === 403;
    }
    assert(threw, 'cross-school actor → 403 SCHOOL_MISMATCH');

    section('B4. fingerprint/source drift → typed 409, zero partial writes');
    resetRecording();
    threw = false;
    try {
      await run(() => svc.applyTeachingLoadReconciliation({
        actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
        expectedFingerprint: 'F'.repeat(64), expectedSourceRevision: preview.sourceRevision,
        confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
      }));
    } catch (error: any) {
      threw = error?.code === 'FINGERPRINT_MISMATCH' && error?.statusCode === 409;
    }
    assert(threw, 'forged fingerprint → 409 FINGERPRINT_MISMATCH');
    assert(writes().length === 0, 'forged fingerprint apply performs zero writes');

    resetRecording();
    await instrumented.schoolYearOffering.updateMany({
      where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, subjectId: fixtureSubjectMath },
      data: { weeklyMinutes: 250 },
    });
    resetRecording();
    threw = false;
    try {
      await run(() => svc.applyTeachingLoadReconciliation({
        actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
        expectedFingerprint: preview.fingerprint, expectedSourceRevision: preview.sourceRevision,
        confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
      }));
    } catch (error: any) {
      threw = error?.code === 'SOURCE_DRIFT' && error?.statusCode === 409;
    }
    assert(threw, 'offering drift after preview → 409 SOURCE_DRIFT, zero writes');
    assert(writes().length === 0, 'drifted apply performs zero writes');
    await instrumented.schoolYearOffering.updateMany({
      where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, subjectId: fixtureSubjectMath },
      data: { weeklyMinutes: 240 },
    });

    section('B5. apply is Serializable + idempotent and keeps derived state consistent');
    const freshPreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    resetRecording();
    const applyResult = await run(() => svc.applyTeachingLoadReconciliation({
      actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
      expectedFingerprint: freshPreview.fingerprint, expectedSourceRevision: freshPreview.sourceRevision,
      confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
    }));
    assertEqual(applyResult.replayed, false, 'first apply executes writes');
    assertEqual(applyResult.retained, 1, 'one retained');
    assertEqual(applyResult.moved, 1, 'one moved');
    assertEqual(applyResult.inserted, 2, 'two inserted');
    assertEqual(applyResult.revalidatedInTransaction, true, 'in-transaction revalidation');
    assert(applyResult.operationId > 0, 'audit event emitted');

    const ownerships = await instrumented.subjectSectionOwnership.findMany({
      where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId },
      orderBy: [{ subjectId: 'asc' }, { sectionId: 'asc' }],
    });
    assertEqual(ownerships.length, 4, 'four ownership rows after apply');
    const eng102 = ownerships.find((row: any) => row.subjectId === fixtureSubjectEng && row.sectionId === 102);
    assertEqual((eng102 as any).facultyId, fixtureFaculty2, 'ENG:102 ownership moved to faculty 2');

    const fsCheck = await instrumented.facultySubject.findMany({
      where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId },
    });
    for (const row of fsCheck as any[]) {
      const ownedSections = ownerships
        .filter((o: any) => o.facultyId === row.facultyId && o.subjectId === row.subjectId)
        .map((o: any) => o.sectionId)
        .sort((a: number, b: number) => a - b);
      const storedSections = [...(row.sectionIds as number[])].sort((a, b) => a - b);
      assertEqual(JSON.stringify(storedSections), JSON.stringify(ownedSections), `FacultySubject ${row.id} sectionIds mirror ownership`);
    }

    const cycle = await instrumented.teachingLoadCycle.findFirst({
      where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId },
    });
    assert(!!cycle && cycle.state === 'POPULATED', 'TeachingLoadCycle refreshed to POPULATED');
    const audit = await instrumented.auditLog.findFirst({
      where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, action: 'TEACHING_LOAD_RECONCILIATION' },
      orderBy: { id: 'desc' },
    });
    assert(!!audit, 'TEACHING_LOAD_RECONCILIATION audit row exists');

    section('B6. idempotent replay with a fresh fingerprint performs zero writes');
    const replayPreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    assertEqual(replayPreview.actionTotals.INSERT + replayPreview.actionTotals.MOVE + replayPreview.actionTotals.RETIRE, 0, 'post-apply state needs no mutations');
    resetRecording();
    const replay = await run(() => svc.applyTeachingLoadReconciliation({
      actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
      expectedFingerprint: replayPreview.fingerprint, expectedSourceRevision: replayPreview.sourceRevision,
      confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
    }));
    assertEqual(replay.replayed, true, 'replay path detected');
    assertEqual(replay.ownershipIdsWritten.length, 0, 'replay performs zero ownership writes');
    assertEqual(replay.facultySubjectIdsWritten.length, 0, 'replay performs zero faculty-subject writes');
    assert(writes().length === 0, 'replay performs zero writes overall');

    section('B7. readiness reports coverage truth, not cycle state alone');
    const readiness = await run(() => svc.getTeachingLoadReconciliationReadiness(fixtureSchoolId, fixtureYearId));
    assertEqual(readiness.demandCount, 4, 'readiness demand count');
    assertEqual(readiness.unresolvedDemandCount, 0, 'readiness unresolved');
    assertEqual(readiness.ready, true, 'readiness ready with full valid coverage');
    assert(readiness.ownedDemandCount <= readiness.demandCount, 'readiness ownedDemandCount never exceeds demandCount (unique final actions)');

    section('B9. transaction closure: concurrent policy / department mutation → typed 409, zero writes');
    const closurePreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));

    // Concurrent workload-policy mutation between preview and apply.
    await instrumented.schedulingPolicy.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
        teachingStandardMinutes: 1700, advisoryCreditMinutes: 300, hardCapMinutes: 2300,
      },
    });
    resetRecording();
    threw = false;
    try {
      await run(() => svc.applyTeachingLoadReconciliation({
        actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
        expectedFingerprint: closurePreview.fingerprint, expectedSourceRevision: closurePreview.sourceRevision,
        confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
      }));
    } catch (error: any) {
      threw = error?.code === 'SOURCE_DRIFT' && error?.statusCode === 409;
    }
    assert(threw, 'workload-policy mutation after preview → 409 SOURCE_DRIFT');
    assert(writes().length === 0, 'policy-drift apply performs zero writes');
    const policyOwnerships = await instrumented.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
    assertEqual(policyOwnerships, 4, 'ownership rows unchanged after policy-drift rejection');

    // Concurrent department-authority mutation between preview and apply.
    const closurePreview2 = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    await instrumented.departmentLabel.create({ data: { schoolId: fixtureSchoolId, code: 'FIL', label: 'Filipino' } });
    resetRecording();
    threw = false;
    try {
      await run(() => svc.applyTeachingLoadReconciliation({
        actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
        expectedFingerprint: closurePreview2.fingerprint, expectedSourceRevision: closurePreview2.sourceRevision,
        confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
      }));
    } catch (error: any) {
      threw = error?.code === 'SOURCE_DRIFT' && error?.statusCode === 409;
    }
    assert(threw, 'department-label mutation after preview → 409 SOURCE_DRIFT');
    assert(writes().length === 0, 'department-drift apply performs zero writes');

    section('B10. atomic derived state: injected cycle-refresh failure rolls back every write');
    // Force a pending mutation so the apply actually writes before the cycle
    // refresh runs: add a new AP subject + offering (new demanded pairs).
    const apSubject = await instrumented.subject.create({
      data: {
        schoolId: fixtureSchoolId, code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 240,
        programScopes: ['REGULAR'], gradeLevels: [7], ownerDepartment: 'MATH', isActive: true,
      },
      select: { id: true },
    });
    await instrumented.schoolYearOffering.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, termConfigId: fixtureTermConfigId,
        subjectId: (apSubject as any).id as number, gradeLevel: 7, programType: 'REGULAR',
        classification: 'CORE', weeklyMinutes: 240, termMode: 'ALL', isActive: true,
      },
    });
    const atomicPreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    assert(atomicPreview.actionTotals.INSERT > 0, 'atomic preview has pending inserts');
    const cycleBefore = await instrumented.teachingLoadCycle.findUnique({
      where: { schoolId_schoolYearId: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } },
    });
    const cycleVersionBefore = (cycleBefore as any)?.version ?? 0;
    const ownershipBeforeAtomic = await instrumented.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
    svc.__setCycleRefreshOverrideForTest(async () => {
      throw new Error('INJECTED_CYCLE_REFRESH_FAILURE');
    });
    let rollbackThrew = false;
    try {
      await run(() => svc.applyTeachingLoadReconciliation({
        actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
        expectedFingerprint: atomicPreview.fingerprint, expectedSourceRevision: atomicPreview.sourceRevision,
        confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
      }));
    } catch (error: any) {
      rollbackThrew = /INJECTED_CYCLE_REFRESH_FAILURE/.test(error?.message ?? '');
    } finally {
      svc.__setCycleRefreshOverrideForTest(null);
    }
    assert(rollbackThrew, 'injected cycle-refresh failure propagates');
    const ownershipsAfterRollback = await instrumented.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
    assertEqual(ownershipsAfterRollback, ownershipBeforeAtomic, 'cycle-refresh failure rolls back every ownership write (count unchanged)');
    const cycleAfter = await instrumented.teachingLoadCycle.findUnique({
      where: { schoolId_schoolYearId: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } },
    });
    assertEqual((cycleAfter as any)?.version ?? 0, cycleVersionBefore, 'cycle version unchanged after rollback');
    const auditCountBefore = await instrumented.auditLog.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, action: 'TEACHING_LOAD_RECONCILIATION' } });
    assert(auditCountBefore === 1, 'no reconciliation audit row was added by the rolled-back apply');
    // Restore the B10 scaffold (AP subject + offering) back to a clean state:
    // the rolled-back apply left the AP demand unowned.
    await instrumented.schoolYearOffering.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, subjectId: (apSubject as any).id as number } });
    await instrumented.subject.delete({ where: { id: (apSubject as any).id as number } });

    section('B11. active-year authority: missing / inactive / archived / cross-school');
    // Missing year mirror → 404, before any writes.
    await instrumented.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
    resetRecording();
    threw = false;
    try {
      await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    } catch (error: any) {
      threw = error?.code === 'YEAR_MIRROR_NOT_FOUND' && error?.statusCode === 404;
    }
    assert(threw, 'missing year mirror → 404 YEAR_MIRROR_NOT_FOUND');
    assert(writes().length === 0, 'missing-year preview performs zero writes');
    // Cross-school / unknown year id → 404 (scoped mirror lookup).
    threw = false;
    try {
      await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId + 100, fixtureSchoolId));
    } catch (error: any) {
      threw = error?.code === 'YEAR_MIRROR_NOT_FOUND' && error?.statusCode === 404;
    }
    assert(threw, 'unknown (cross-school) year → 404 YEAR_MIRROR_NOT_FOUND');
    // Known but inactive historical year → 409.
    await instrumented.enrollProSchoolYearMirror.create({
      data: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId, yearLabel: '2028-2029', isActive: false, isArchived: false, syncStatus: 'synced' },
    });
    threw = false;
    try {
      await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    } catch (error: any) {
      threw = error?.code === 'INACTIVE_HISTORICAL_YEAR' && error?.statusCode === 409;
    }
    assert(threw, 'known inactive historical year → 409 INACTIVE_HISTORICAL_YEAR');
    // Archived year → 409.
    await instrumented.enrollProSchoolYearMirror.update({
      where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId } },
      data: { isArchived: true, archivedAt: new Date(), archivedBy: 0, archiveReason: 'test' },
    });
    threw = false;
    try {
      await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    } catch (error: any) {
      threw = error?.code === 'ARCHIVED_YEAR' && error?.statusCode === 409;
    }
    assert(threw, 'archived year → 409 ARCHIVED_YEAR');
    // Apply repeats the same validation through the Serializable tx client.
    threw = false;
    try {
      await run(() => svc.applyTeachingLoadReconciliation({
        actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
        expectedFingerprint: '0'.repeat(64), expectedSourceRevision: '0'.repeat(64),
        confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
      }));
    } catch (error: any) {
      threw = error?.code === 'ARCHIVED_YEAR' && error?.statusCode === 409;
    }
    assert(threw, 'apply rejects the archived year through the in-transaction validation');
    // Restore an active mirror for the remaining tests.
    await instrumented.enrollProSchoolYearMirror.update({
      where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId } },
      data: { isArchived: false, archivedAt: null, archivedBy: null, archiveReason: null, isActive: true },
    });
    const restored = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    assert(restored.fingerprint.length === 64, 'restored active year preview succeeds');
    resetRecording();

    section('B12. FacultySubject derived gradeLevels across cross-grade insert, move, retire');
    // Add a grade-8 section and a MATH grade-8 offering (cross-grade demand).
    await instrumented.sectionMirror.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, externalId: 201, name: 'Grade 8 - A',
        gradeLevelId: 8, gradeLevelName: 'Grade 8', displayOrder: 8, programType: 'REGULAR', maxCapacity: 50, enrolledCount: 50,
        isActiveForScheduling: true, isStale: false,
      },
    });
    await instrumented.schoolYearOffering.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, termConfigId: fixtureTermConfigId,
        subjectId: fixtureSubjectMath, gradeLevel: 8, programType: 'REGULAR',
        classification: 'CORE', weeklyMinutes: 240, termMode: 'ALL', isActive: true,
      },
    });

    // B12a INSERT cross-grade: MATH:201 has no owner → f1 (the only MATH faculty) receives it.
    const insertPreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    const math201Insert = insertPreview.actions.find((entry: any) => entry.subjectId === fixtureSubjectMath && entry.sectionId === 201);
    assert(!!math201Insert && math201Insert.action === 'INSERT', 'MATH:201 proposed as a cross-grade INSERT');
    const insertApply = await run(() => svc.applyTeachingLoadReconciliation({
      actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
      expectedFingerprint: insertPreview.fingerprint, expectedSourceRevision: insertPreview.sourceRevision,
      confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
    }));
    assertEqual(insertApply.replayed, false, 'cross-grade insert apply executes');
    {
      const f1MathFs = await instrumented.facultySubject.findFirst({
        where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: fixtureFaculty1, subjectId: fixtureSubjectMath },
      });
      assertEqual(JSON.stringify((f1MathFs as any).sectionIds), JSON.stringify([101, 102, 201]), 'f1 MATH sectionIds after cross-grade insert');
      assertEqual(JSON.stringify((f1MathFs as any).gradeLevels), JSON.stringify([7, 8]), 'f1 MATH gradeLevels derived from resulting sections (cross-grade insert)');
    }
    // Replay after the insert: zero writes and BOTH arrays unchanged.
    const insertReplayPreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    const replayApply = await run(() => svc.applyTeachingLoadReconciliation({
      actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
      expectedFingerprint: insertReplayPreview.fingerprint, expectedSourceRevision: insertReplayPreview.sourceRevision,
      confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
    }));
    assertEqual(replayApply.replayed, true, 'replay after cross-grade insert is zero-write');
    {
      const f1MathFs = await instrumented.facultySubject.findFirst({
        where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: fixtureFaculty1, subjectId: fixtureSubjectMath },
      });
      assertEqual(JSON.stringify((f1MathFs as any).sectionIds), JSON.stringify([101, 102, 201]), 'replay leaves f1 MATH sectionIds unchanged');
      assertEqual(JSON.stringify((f1MathFs as any).gradeLevels), JSON.stringify([7, 8]), 'replay leaves f1 MATH gradeLevels unchanged');
    }

    // B12b MOVE cross-grade: a new grade-8 adviser (f3, MATH, advises 201) receives MATH:201
    // via the adviser-own-section preference; f1's MATH FS drops the grade-8 section.
    const f3 = await instrumented.facultyMirror.create({
      data: {
        schoolId: fixtureSchoolId, externalId: 7003, employeeId: 'EMP7003', firstName: 'G8', lastName: 'Adviser',
        department: 'MATH', isActiveForScheduling: true, isClassAdviser: true, advisedSectionId: 201, maxHoursPerWeek: 30,
      },
      select: { id: true },
    });
    fixtureFaculty3 = (f3 as any).id as number;
    const movePreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    const math201Move = movePreview.actions.find((entry: any) => entry.subjectId === fixtureSubjectMath && entry.sectionId === 201);
    assert(!!math201Move && math201Move.action === 'MOVE' && math201Move.proposedFacultyId === fixtureFaculty3, 'MATH:201 moves to the grade-8 adviser (cross-grade MOVE)');
    const moveApply = await run(() => svc.applyTeachingLoadReconciliation({
      actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
      expectedFingerprint: movePreview.fingerprint, expectedSourceRevision: movePreview.sourceRevision,
      confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
    }));
    assertEqual(moveApply.replayed, false, 'cross-grade move apply executes');
    {
      const f3MathFs = await instrumented.facultySubject.findFirst({
        where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: fixtureFaculty3, subjectId: fixtureSubjectMath },
      });
      assertEqual(JSON.stringify((f3MathFs as any).gradeLevels), JSON.stringify([8]), 'f3 MATH gradeLevels after move = [8]');
      const f1MathFs = await instrumented.facultySubject.findFirst({
        where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: fixtureFaculty1, subjectId: fixtureSubjectMath },
      });
      assertEqual(JSON.stringify((f1MathFs as any).sectionIds), JSON.stringify([101, 102]), 'f1 MATH sectionIds after move');
      assertEqual(JSON.stringify((f1MathFs as any).gradeLevels), JSON.stringify([7]), 'f1 MATH gradeLevels recomputed after move (drops grade 8)');
    }

    // B12c RETIRE cross-grade: an inconsistent grade-8 ownership (MATH:202, no offering)
    // is retired and the owner's FS arrays are recomputed.
    await instrumented.sectionMirror.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, externalId: 202, name: 'Grade 8 - B',
        gradeLevelId: 8, gradeLevelName: 'Grade 8', displayOrder: 8, programType: 'STE', maxCapacity: 50, enrolledCount: 50,
        isActiveForScheduling: true, isStale: false,
      },
    });
    {
      const f1MathFs = await instrumented.facultySubject.findFirst({
        where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: fixtureFaculty1, subjectId: fixtureSubjectMath },
      });
      const updatedFs = await instrumented.facultySubject.update({
        where: { id: (f1MathFs as any).id as number },
        data: { sectionIds: { set: [101, 102, 202] }, gradeLevels: { set: [7, 8] } },
        select: { id: true },
      });
      await instrumented.subjectSectionOwnership.create({
        data: {
          schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, subjectId: fixtureSubjectMath,
          sectionId: 202, facultyId: fixtureFaculty1, facultySubjectId: (updatedFs as any).id as number,
        },
      });
    }
    const retirePreview = await run(() => svc.previewTeachingLoadReconciliation(fixtureSchoolId, fixtureYearId, fixtureSchoolId));
    const math202Retire = retirePreview.actions.find((entry: any) => entry.subjectId === fixtureSubjectMath && entry.sectionId === 202);
    assert(!!math202Retire && math202Retire.action === 'RETIRE', 'MATH:202 (no offering) proposed as RETIRE');
    const retireApply = await run(() => svc.applyTeachingLoadReconciliation({
      actorSchoolId: fixtureSchoolId, actorId: 1, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
      expectedFingerprint: retirePreview.fingerprint, expectedSourceRevision: retirePreview.sourceRevision,
      confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
    }));
    assertEqual(retireApply.replayed, false, 'cross-grade retire apply executes');
    {
      const f1MathFs = await instrumented.facultySubject.findFirst({
        where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: fixtureFaculty1, subjectId: fixtureSubjectMath },
      });
      assertEqual(JSON.stringify((f1MathFs as any).sectionIds), JSON.stringify([101, 102]), 'f1 MATH sectionIds after retire');
      assertEqual(JSON.stringify((f1MathFs as any).gradeLevels), JSON.stringify([7]), 'f1 MATH gradeLevels recomputed after retire (drops grade 8)');
      const math202 = await instrumented.subjectSectionOwnership.findFirst({
        where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, subjectId: fixtureSubjectMath, sectionId: 202 },
      });
      assert(math202 == null, 'MATH:202 ownership removed');
    }
  } finally {
    section('B8. fixture cleanup (zero residue)');
    const cleanup = await instrumented.$transaction(async (tx: any) => {
      await tx.offeringTermAssignment.deleteMany({ where: { offering: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } } });
      await tx.subjectSectionOwnership.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
      await tx.schoolYearOffering.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
      await tx.facultySubject.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
      await tx.teachingLoadCycle.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
      await tx.schoolYearTermConfig.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
      await tx.sectionMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
      await tx.facultyMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
      await tx.departmentLabel.deleteMany({ where: { schoolId: fixtureSchoolId } });
      await tx.schedulingPolicy.deleteMany({ where: { schoolId: fixtureSchoolId } });
      await tx.subject.deleteMany({ where: { schoolId: fixtureSchoolId } });
      await tx.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
      await tx.auditLog.deleteMany({ where: { schoolId: fixtureSchoolId } });
      await tx.school.delete({ where: { id: fixtureSchoolId } });
    });
    assert(true, 'fixture cleanup executed');

    const residue = await instrumented.$transaction(async (tx: any) => {
      const [schools, ownerships, facultySubjects, offerings, sections, faculty, subjects, cycles, audits] = await Promise.all([
        tx.school.count({ where: { id: fixtureSchoolId } }),
        tx.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId } }),
        tx.facultySubject.count({ where: { schoolId: fixtureSchoolId } }),
        tx.schoolYearOffering.count({ where: { schoolId: fixtureSchoolId } }),
        tx.sectionMirror.count({ where: { schoolId: fixtureSchoolId } }),
        tx.facultyMirror.count({ where: { schoolId: fixtureSchoolId } }),
        tx.subject.count({ where: { schoolId: fixtureSchoolId } }),
        tx.teachingLoadCycle.count({ where: { schoolId: fixtureSchoolId } }),
        tx.auditLog.count({ where: { schoolId: fixtureSchoolId } }),
      ]);
      return [schools, ownerships, facultySubjects, offerings, sections, faculty, subjects, cycles, audits];
    });
    assertEqual(residue.reduce((sum: number, value: number) => sum + value, 0), 0, 'zero residue across all fixture-scoped models');
  }
}

async function main() {
  loadServerEnv();
  const svc = await import('../services/teaching-load-reconciliation.service.js') as typeof import('../services/teaching-load-reconciliation.service.js');
  await runHermeticTests(svc);
  if (process.env.DATABASE_URL) {
    await runFixtureTests(svc);
  } else {
    console.warn('[SKIP] Part B fixture tests require DATABASE_URL.');
  }

  console.log(`\nRESULT: ${passCount} passed, ${failCount} failed`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(2);
});