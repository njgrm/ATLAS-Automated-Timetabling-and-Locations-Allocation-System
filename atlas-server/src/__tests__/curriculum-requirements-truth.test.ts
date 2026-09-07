/**
 * SCA-02R — Curriculum Requirements integrity verification.
 *
 * Proves through production service/route paths on disposable schools with
 * EnrollPro year mirrors and zero-residue cleanup:
 *  1. Section A → Section B changes the fingerprint.
 *  2. Cohort/default/section rows stay distinct through preview and apply.
 *  3. Input array reordering does not change the fingerprint.
 *  4. Any semantic field mutation after preview rejects apply.
 *  5. Concurrent term-config mutation rejects with zero writes.
 *  6. A new requirement inserted after preview rejects apply.
 *  7. A school-2 actor cannot resolve or mutate school-1 year truth.
 *  8. A nonexistent or archived year cannot receive configuration.
 *  9. A grade/program with active sections but no requirements is MISSING.
 * 10. An explicit EMPTY marker clears only its exact scope.
 * 11. Rotating requirements succeed through the UI payload shape.
 * 12. Non-string term identities return typed 400s.
 * 13. No EnrollPro offering call, Teaching Load write, generation write, or
 *    live-data mutation occurs.
 *
 * Run with: npx tsx src/__tests__/curriculum-requirements-truth.test.ts
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import {
  previewOfferings,
  applyCurriculumBatch,
  createRequirement,
  updateRequirementAtomic,
  retireRequirementAtomic,
  evaluateCurriculumReadiness,
  getCurriculumRequirements,
  suggestRequirementsFromCatalog,
  computeRequirementFingerprint,
  requirementIdentityKey,
  requirementIdentityOf,
  type OfferingInput,
} from '../services/school-year-offering.service.js';
import { upsertTermConfig, getTermConfig } from '../services/term-config.service.js';

// Disposable fixtures — NEVER canonical school 1.
const SCHOOL_A = 99981;
const SCHOOL_B = 99980;
const YEAR = 77911;
const YEAR2 = 77912;
const ARCHIVED_YEAR = 77913;
const MISSING_YEAR = 77914;
const PORT = 5997;
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

function ok(condition: boolean, label: string) {
  if (condition) { passed += 1; console.log(`  OK ${label}`); return; }
  failed += 1; console.error(`  FAIL ${label}`);
}

async function expectCode(action: () => Promise<unknown>, code: string, label: string) {
  try {
    await action();
    ok(false, `${label} — expected ${code}, got success`);
  } catch (error) {
    ok((error as { code?: string }).code === code, `${label} — expected ${code}, got ${(error as { code?: string }).code ?? (error as Error).message}`);
  }
}

async function fetchJson(path: string, options?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function officerToken(schoolId: number): string {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign({ userId: 41, role: 'officer', schoolId, authSource: 'local' }, secret, { expiresIn: '1h' });
}

function authHeaders(schoolId: number): Record<string, string> {
  return { Authorization: `Bearer ${officerToken(schoolId)}` };
}

async function cleanup() {
  await prisma.offeringTermAssignment.deleteMany({
    where: { offering: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } },
  });
  await prisma.schoolYearOffering.deleteMany({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } });
  await prisma.schoolYearTermConfig.deleteMany({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } });
  await prisma.sectionMirror.deleteMany({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } });
  await prisma.instructionalCohort.deleteMany({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } });
  await prisma.subject.deleteMany({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } });
  await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } });
  await prisma.school.deleteMany({ where: { id: { in: [SCHOOL_A, SCHOOL_B] } } });
}

async function writeSignature(schoolId: number, year: number): Promise<string> {
  const rows = await prisma.schoolYearOffering.findMany({
    where: { schoolId, schoolYearId: year },
    select: { id: true, version: true, updatedAt: true },
    orderBy: { id: 'asc' },
  });
  return JSON.stringify(rows.map((r) => [r.id, r.version, r.updatedAt.toISOString()]));
}

function coreInput(overrides: Partial<OfferingInput> & { subjectId: number | null }): OfferingInput {
  return {
    gradeLevel: 7,
    programType: 'REGULAR',
    sectionMirrorId: null,
    cohortId: null,
    classification: 'CORE',
    weeklyMinutes: 200,
    rotationFamily: null,
    rotationOrder: null,
    termMode: 'ALL',
    termIdentities: [],
    ...overrides,
  };
}

async function main() {
  await cleanup();
  for (const school of [SCHOOL_A, SCHOOL_B]) {
    await prisma.school.upsert({
      where: { id: school },
      create: { id: school, name: `SCA-02R School ${school}`, shortName: `R-${school}` },
      update: {},
    });
  }
  // Year mirrors: the authority backbone. B mirrors YEAR (own truth) but
  // nothing else; ARCHIVED_YEAR is archived; MISSING_YEAR has no mirror.
  await prisma.enrollProSchoolYearMirror.createMany({
    data: [
      { schoolId: SCHOOL_A, enrollProSchoolYearId: YEAR, yearLabel: 'R 1', isActive: true },
      { schoolId: SCHOOL_A, enrollProSchoolYearId: YEAR2, yearLabel: 'R 2', isActive: false },
      { schoolId: SCHOOL_A, enrollProSchoolYearId: ARCHIVED_YEAR, yearLabel: 'R 0', isActive: false, isArchived: true, archiveReason: 'SCA-02R fixture' },
      { schoolId: SCHOOL_B, enrollProSchoolYearId: YEAR, yearLabel: 'R 1', isActive: true },
    ],
  });
  const { default: app } = await import('../app.js');
  const server = app.listen(PORT, () => {});
  const tlBefore = await prisma.subjectSectionOwnership.count({ where: { schoolId: SCHOOL_A } });
  const runsBefore = await prisma.generationRun.count({ where: { schoolId: SCHOOL_A } });

  try {
    console.log('=== R1: fixtures (mirrors, 2-term config, catalog, sections, cohort) ===');
    const cfg = await upsertTermConfig(SCHOOL_A, YEAR, { termCount: 2, termIdentities: ['Q1', 'Q2'] }, 41);
    ok(cfg.termCount === 2 && cfg.termIdentities.join(',') === 'Q1,Q2', '2-term Q1/Q2 config persists');
    const mkSubject = (code: string, school = SCHOOL_A) => prisma.subject.create({
      data: {
        schoolId: school, code, name: `${code} subject`, minMinutesPerWeek: 200,
        preferredRoomType: 'CLASSROOM', gradeLevels: [7, 10], programScopes: ['REGULAR', 'STE', 'SPA'],
      },
    });
    const math = await mkSubject('R_MATH');
    const eng = await mkSubject('R_ENG');
    const spec = await mkSubject('R_SPEC');
    const otherSchoolSubject = await mkSubject('R_FOREIGN', SCHOOL_B);
    ok(math.isSeedable === false && math.isSystemManaged === false, 'fixture subjects unmanaged (SCA-01R4 holds)');
    const mkSection = (externalId: number, name: string, gradeLevelId: number, programType: string) =>
      prisma.sectionMirror.create({
        data: {
          externalId, schoolId: SCHOOL_A, schoolYearId: YEAR, name, gradeLevelId,
          gradeLevelName: `Grade ${gradeLevelId}`, displayOrder: gradeLevelId,
          maxCapacity: 45, enrolledCount: 40, programType,
          isActiveForScheduling: true, isStale: false,
        },
      });
    const secG7a = await mkSection(9101, 'R 7-A', 7, 'REGULAR');
    await mkSection(9102, 'R 7-B', 7, 'REGULAR');
    const secG10ste = await mkSection(9103, 'R 10-STE', 10, 'STE');
    const secG9spa = await mkSection(9104, 'R 9-SPA', 9, 'SPA');
    void secG9spa;
    const cohort = await prisma.instructionalCohort.create({
      data: {
        schoolId: SCHOOL_A, schoolYearId: YEAR, cohortCode: 'R-COHORT-1',
        specializationCode: 'R_SPEC', specializationName: 'R Special', gradeLevel: 10, memberSectionIds: [],
      },
    });
    ok(secG7a.id > 0 && cohort.id > 0, 'section + cohort fixtures created');

    console.log('=== R2: year authority — missing, cross-school, archived (controls 7+8) ===');
    let res = await fetchJson(`/api/v1/curriculum-requirements/${YEAR2}/requirements`, { headers: authHeaders(SCHOOL_B) });
    ok(res.status === 404 && res.body.code === 'YEAR_NOT_FOUND', 'school-B actor cannot resolve school-A-only YEAR2');
    res = await fetchJson(`/api/v1/curriculum-requirements/${MISSING_YEAR}/requirements`, { headers: authHeaders(SCHOOL_A) });
    ok(res.status === 404 && res.body.code === 'YEAR_NOT_FOUND', 'mirror-less year resolves 404, never 500');
    res = await fetchJson(`/api/v1/curriculum-requirements/${ARCHIVED_YEAR}/requirements`, { headers: authHeaders(SCHOOL_A) });
    ok(res.status === 409 && res.body.code === 'YEAR_ARCHIVED', 'archived year read rejected');
    res = await fetchJson(`/api/v1/curriculum-requirements/${ARCHIVED_YEAR}/readiness`, { headers: authHeaders(SCHOOL_A) });
    ok(res.status === 409 && res.body.code === 'YEAR_ARCHIVED', 'archived year readiness rejected');
    await expectCode(() => createRequirement(SCHOOL_A, ARCHIVED_YEAR, coreInput({ subjectId: math.id }), 41), 'YEAR_ARCHIVED', 'archived year cannot receive requirements');
    await expectCode(() => createRequirement(SCHOOL_B, YEAR2, coreInput({ subjectId: otherSchoolSubject.id }), 41), 'YEAR_NOT_FOUND', 'school-B actor cannot configure school-A-only year');
    await expectCode(() => upsertTermConfig(SCHOOL_A, MISSING_YEAR, { termCount: 2, termIdentities: ['Q1', 'Q2'] }, 41), 'YEAR_NOT_FOUND', 'mirror-less year cannot receive term config');
    await expectCode(() => upsertTermConfig(SCHOOL_A, ARCHIVED_YEAR, { termCount: 2, termIdentities: ['Q1', 'Q2'] }, 41), 'YEAR_ARCHIVED', 'archived year cannot receive term config');

    console.log('=== R3: canonical identity — default/section/cohort never collapse (control 2) ===');
    const base = await createRequirement(SCHOOL_A, YEAR, coreInput({ subjectId: math.id }), 41);
    const secRow = await createRequirement(SCHOOL_A, YEAR, coreInput({ subjectId: math.id, sectionMirrorId: secG10ste.id, gradeLevel: 10, programType: 'STE' }), 41);
    const cohRow = await createRequirement(SCHOOL_A, YEAR, coreInput({ subjectId: math.id, cohortId: cohort.id, gradeLevel: 10, programType: 'STE' }), 41);
    const keys = new Set([base, secRow, cohRow].map((r) => requirementIdentityKey(requirementIdentityOf(r))));
    ok(keys.size === 3, 'base, section-override, and cohort-override rows hold distinct identities');
    await expectCode(() => createRequirement(SCHOOL_A, YEAR, coreInput({ subjectId: math.id }), 41), 'REQUIREMENT_EXISTS', 'exact-identity duplicate rejected');
    await expectCode(
      () => createRequirement(SCHOOL_A, YEAR, coreInput({ subjectId: math.id, sectionMirrorId: secG10ste.id, gradeLevel: 10, programType: 'STE' }), 41),
      'REQUIREMENT_EXISTS',
      'section-override duplicate rejected without touching base',
    );
    // Same scope, different rotation family: distinct identity, allowed.
    const rotA = await createRequirement(SCHOOL_A, YEAR, {
      subjectId: spec.id, gradeLevel: 10, programType: 'STE', sectionMirrorId: null, cohortId: null,
      classification: 'SPECIALIZATION', weeklyMinutes: 150, rotationFamily: 'FAM_A', rotationOrder: 1,
      termMode: 'ROTATING_FAMILY_MEMBER', termIdentities: ['Q1'],
    }, 41);
    const rotB = await createRequirement(SCHOOL_A, YEAR, {
      subjectId: spec.id, gradeLevel: 10, programType: 'STE', sectionMirrorId: null, cohortId: null,
      classification: 'SPECIALIZATION', weeklyMinutes: 150, rotationFamily: 'FAM_B', rotationOrder: 1,
      termMode: 'ROTATING_FAMILY_MEMBER', termIdentities: ['Q1'],
    }, 41);
    ok(rotA.id !== rotB.id, 'rotation families distinguish identities');
    // Preview counts respect identity: proposing only the base retires 4.
    const baseOnlyPreview = await previewOfferings(SCHOOL_A, YEAR, [coreInput({ subjectId: math.id })]);
    ok(baseOnlyPreview.retiredCount === 4 && baseOnlyPreview.unchangedCount === 1 && baseOnlyPreview.newCount === 0, `identity-scoped preview counts (retired=${baseOnlyPreview.retiredCount})`);

    console.log('=== R4: fingerprint integrity — SHA-256, order-free, field-complete (controls 1,3,4) ===');
    const fpA = computeRequirementFingerprint([coreInput({ subjectId: math.id }), coreInput({ subjectId: eng.id, gradeLevel: 8 })]);
    ok(fpA.startsWith('CURR_REQ_') && fpA.length === 9 + 64, 'canonical SHA-256 fingerprint shape');
    const reversed = computeRequirementFingerprint([coreInput({ subjectId: eng.id, gradeLevel: 8 }), coreInput({ subjectId: math.id })]);
    ok(reversed === fpA, 'array reordering does not change the fingerprint (control 3)');
    const variants: Array<[string, OfferingInput]> = [
      ['section', coreInput({ subjectId: math.id, sectionMirrorId: secG7a.id })],
      ['cohort', coreInput({ subjectId: math.id, cohortId: cohort.id, gradeLevel: 10, programType: 'STE' })],
      ['classification', coreInput({ subjectId: math.id, classification: 'EXPLORATORY' })],
      ['minutes', coreInput({ subjectId: math.id, weeklyMinutes: 201 })],
      ['rotationFamily', coreInput({ subjectId: math.id, classification: 'SPECIALIZATION', rotationFamily: 'X', rotationOrder: 1, termMode: 'ROTATING_FAMILY_MEMBER', termIdentities: ['Q1'] })],
      ['termMode', coreInput({ subjectId: math.id, termMode: 'EMPTY', weeklyMinutes: 0 })],
      ['terms', coreInput({ subjectId: math.id, termMode: 'ALL', termIdentities: ['Q1', 'Q2'] })],
    ];
    for (const [label, variant] of variants) {
      ok(computeRequirementFingerprint([variant]) !== computeRequirementFingerprint([coreInput({ subjectId: math.id })]), `fingerprint binds ${label} (control 1/4)`);
    }
    ok(
      computeRequirementFingerprint([coreInput({ subjectId: math.id, termMode: 'ALL', termIdentities: ['Q2', 'Q1'] })])
      === computeRequirementFingerprint([coreInput({ subjectId: math.id, termMode: 'ALL', termIdentities: ['Q1', 'Q2'] })]),
      'term order normalized, term set significant',
    );

    console.log('=== R5: term-config concurrency (control 5) ===');
    const liveCfg = await getTermConfig(SCHOOL_A, YEAR);
    assert(liveCfg, 'term config readable');
    await expectCode(
      () => upsertTermConfig(SCHOOL_A, YEAR, { termCount: 2, termIdentities: ['Q1', 'Q2'] }, 41),
      'VERSION_REQUIRED',
      'term edit without token rejected',
    );
    await expectCode(
      () => upsertTermConfig(SCHOOL_A, YEAR, { termCount: 2, termIdentities: ['Q1', 'Q2'], expectedUpdatedAt: '2000-01-01T00:00:00.000Z' }, 41),
      'STALE_WRITE',
      'term edit with stale token rejected',
    );
    const sigRace = await writeSignature(SCHOOL_A, YEAR);
    const racePreview = await previewOfferings(SCHOOL_A, YEAR, [coreInput({ subjectId: math.id })]);
    assert(racePreview.termConfigRevision, 'preview binds term revision');
    // Concurrent term edit (reordered identities keep Q1/Q2 valid for later
    // probes while guaranteeing an updatedAt bump even at ms resolution).
    await upsertTermConfig(SCHOOL_A, YEAR, { termCount: 2, termIdentities: ['Q2', 'Q1'], expectedUpdatedAt: liveCfg.updatedAt.toISOString() }, 41);
    await expectCode(
      () => applyCurriculumBatch({
        schoolId: SCHOOL_A, schoolYearId: YEAR, proposedOfferings: [coreInput({ subjectId: math.id })],
        actorId: 41, expectedFingerprint: racePreview.fingerprint,
        expectedSourceVersions: racePreview.sourceVersions,
        expectedTermConfigUpdatedAt: racePreview.termConfigRevision!.updatedAt,
      }),
      'STALE_WRITE',
      'apply after concurrent term edit rejected',
    );
    ok((await writeSignature(SCHOOL_A, YEAR)) === sigRace, 'term race wrote nothing (control 5)');
    await expectCode(
      () => applyCurriculumBatch({
        schoolId: SCHOOL_A, schoolYearId: YEAR, proposedOfferings: [coreInput({ subjectId: math.id })],
        actorId: 41, expectedFingerprint: racePreview.fingerprint,
        expectedSourceVersions: racePreview.sourceVersions,
        expectedTermConfigUpdatedAt: 'not-a-timestamp',
      }),
      'VERSION_REQUIRED',
      'malformed term revision token rejected',
    );

    console.log('=== R6: batch staleness — insert-after-preview, tamper, drift (controls 4+6) ===');
    const snap = await getCurriculumRequirements(SCHOOL_A, YEAR);
    const activeInputs: OfferingInput[] = snap.requirements.filter((r) => r.isActive).map((r) => ({
      subjectId: r.subjectId, gradeLevel: r.gradeLevel, programType: r.programType,
      sectionMirrorId: r.sectionMirrorId, cohortId: r.cohortId, classification: r.classification,
      weeklyMinutes: r.weeklyMinutes, rotationFamily: r.rotationFamily, rotationOrder: r.rotationOrder,
      termMode: r.termMode, termIdentities: r.termIdentities,
    }));
    const fresh = await previewOfferings(SCHOOL_A, YEAR, activeInputs);
    const sigBatch = await writeSignature(SCHOOL_A, YEAR);
    // Control 6: insert after preview.
    const inserted = await createRequirement(SCHOOL_A, YEAR, coreInput({ subjectId: eng.id }), 41);
    const sigPostInsert = await writeSignature(SCHOOL_A, YEAR);
    await expectCode(
      () => applyCurriculumBatch({
        schoolId: SCHOOL_A, schoolYearId: YEAR, proposedOfferings: activeInputs,
        actorId: 41, expectedFingerprint: fresh.fingerprint,
        expectedSourceVersions: fresh.sourceVersions,
        expectedTermConfigUpdatedAt: fresh.termConfigRevision!.updatedAt,
      }),
      'STALE_WRITE',
      'insert-after-preview rejects apply (control 6)',
    );
    ok((await writeSignature(SCHOOL_A, YEAR)) === sigPostInsert, 'stale insert-race apply wrote nothing');
    // Tamper after preview → fingerprint mismatch (control 4).
    const tampered = activeInputs.map((o) => ({ ...o }));
    tampered[0] = { ...tampered[0], weeklyMinutes: tampered[0].weeklyMinutes + 1 };
    await expectCode(
      () => applyCurriculumBatch({
        schoolId: SCHOOL_A, schoolYearId: YEAR, proposedOfferings: tampered,
        actorId: 41, expectedFingerprint: fresh.fingerprint,
        expectedSourceVersions: { ...fresh.sourceVersions, [String(inserted.id)]: inserted.version },
        expectedTermConfigUpdatedAt: fresh.termConfigRevision!.updatedAt,
      }),
      'FINGERPRINT_MISMATCH',
      'semantic mutation after preview rejects apply (control 4)',
    );
    ok((await writeSignature(SCHOOL_A, YEAR)) !== sigBatch, 'only the deliberate insert changed state');
    // Retire the inserted row via single-row path, then re-preview + apply cleanly.
    await retireRequirementAtomic(inserted.id, SCHOOL_A, inserted.version, 41);
    const refPreview = await previewOfferings(SCHOOL_A, YEAR, activeInputs);
    res = await fetchJson(`/api/v1/curriculum-requirements/${YEAR}/requirements/apply`, {
      method: 'POST',
      headers: authHeaders(SCHOOL_A),
      body: JSON.stringify({
        offerings: activeInputs,
        expectedFingerprint: refPreview.fingerprint,
        expectedSourceVersions: refPreview.sourceVersions,
        expectedTermConfigUpdatedAt: refPreview.termConfigRevision!.updatedAt,
      }),
    });
    ok(res.status === 200 && res.body.receipt.fingerprint === refPreview.fingerprint, 'fresh route apply succeeds');
    // Duplicate identity in one batch → conflict, zero writes.
    const dupSig = await writeSignature(SCHOOL_A, YEAR);
    await expectCode(
      () => applyCurriculumBatch({
        schoolId: SCHOOL_A, schoolYearId: YEAR,
        proposedOfferings: [...activeInputs, { ...activeInputs[0] }],
        actorId: 41,
        expectedFingerprint: computeRequirementFingerprint([...activeInputs, { ...activeInputs[0] }]),
        expectedSourceVersions: refPreview.sourceVersions,
        expectedTermConfigUpdatedAt: refPreview.termConfigRevision!.updatedAt,
      }),
      'REQUIREMENT_DUPLICATE',
      'exact-duplicate batch rejected',
    );
    await expectCode(
      () => applyCurriculumBatch({
        schoolId: SCHOOL_A, schoolYearId: YEAR,
        proposedOfferings: [...activeInputs, { ...activeInputs[0], weeklyMinutes: 999 }],
        actorId: 41,
        expectedFingerprint: computeRequirementFingerprint([...activeInputs, { ...activeInputs[0], weeklyMinutes: 999 }]),
        expectedSourceVersions: refPreview.sourceVersions,
        expectedTermConfigUpdatedAt: refPreview.termConfigRevision!.updatedAt,
      }),
      'CURRICULUM_SCOPE_CONFLICT',
      'same-identity-different-semantics batch rejected',
    );
    ok((await writeSignature(SCHOOL_A, YEAR)) === dupSig, 'conflicting batches wrote nothing');

    console.log('=== R7: missing-scope readiness from section mirrors (controls 9+10) ===');
    // Expected: G7:REGULAR (configured), G10:STE (configured via rotating
    // base rows), G9:SPA (missing).
    const ready1 = await evaluateCurriculumReadiness(SCHOOL_A, YEAR);
    const g9 = ready1.scopeStates.find((s) => s.scopeKey === 'G9:SPA:-:-');
    ok(g9?.state === 'MISSING', 'G9:SPA with sections but no requirements is MISSING (control 9)');
    ok(ready1.blockers.some((b) => b.code === 'OFFERING_TRUTH_MISSING' && b.scopeKey === 'G9:SPA:-:-'), 'missing base scope blocks');
    const g7 = ready1.scopeStates.find((s) => s.scopeKey === 'G7:REGULAR:-:-');
    ok(g7?.state === 'CONFIGURED', 'configured base scope reads CONFIGURED');
    // Override-only must not satisfy the base: G10:STE base has no base rows
    // (only rotating rows ARE base rows here — check separately below).
    // Explicit EMPTY clears only its exact scope (control 10).
    await createRequirement(SCHOOL_A, YEAR, {
      subjectId: null, gradeLevel: 9, programType: 'SPA', sectionMirrorId: null, cohortId: null,
      classification: 'OTHER', weeklyMinutes: 0, rotationFamily: null, rotationOrder: null,
      termMode: 'EMPTY', termIdentities: [],
    }, 41);
    const ready2 = await evaluateCurriculumReadiness(SCHOOL_A, YEAR);
    ok(ready2.scopeStates.find((s) => s.scopeKey === 'G9:SPA:-:-')?.state === 'EMPTY', 'EMPTY marker clears its exact base scope');
    ok(!ready2.blockers.some((b) => b.scopeKey === 'G9:SPA:-:-'), 'explicit EMPTY does not block');
    // EMPTY on an override scope leaves every base untouched, and an
    // override EMPTY must not satisfy its base (control 10, both directions).
    const secG8 = await mkSection(9105, 'R 8-A', 8, 'REGULAR');
    await createRequirement(SCHOOL_A, YEAR, {
      subjectId: null, gradeLevel: 8, programType: 'REGULAR', sectionMirrorId: secG8.id, cohortId: null,
      classification: 'OTHER', weeklyMinutes: 0, rotationFamily: null, rotationOrder: null,
      termMode: 'EMPTY', termIdentities: [],
    }, 41);
    const ready3 = await evaluateCurriculumReadiness(SCHOOL_A, YEAR);
    const g8overrideEmpty = ready3.scopeStates.find((s) => s.scopeKey === `G8:REGULAR:section-${secG8.id}:-`);
    const g8base = ready3.scopeStates.find((s) => s.scopeKey === 'G8:REGULAR:-:-');
    ok(g8overrideEmpty?.state === 'EMPTY', 'override EMPTY marks the override scope');
    ok(g8base?.state === 'MISSING', 'override EMPTY does not satisfy the base scope (control 10)');

    console.log('=== R8: strict validation — non-string terms, unknown fields, body schoolId (control 12) ===');
    const badTerms: OfferingInput = { ...coreInput({ subjectId: math.id }), termIdentities: [1 as unknown as string] };
    res = await fetchJson('/api/v1/curriculum-requirements/requirements', {
      method: 'POST',
      headers: authHeaders(SCHOOL_A),
      body: JSON.stringify({ schoolId: SCHOOL_A, schoolYearId: YEAR, offering: badTerms }),
    });
    ok(res.status === 400, `non-string term identity via create rejected (got ${res.status})`);
    res = await fetchJson(`/api/v1/curriculum-requirements/${YEAR}/requirements/preview`, {
      method: 'POST',
      headers: authHeaders(SCHOOL_A),
      body: JSON.stringify({ offerings: [badTerms] }),
    });
    ok(res.status === 400, `non-string term identity via preview rejected (got ${res.status})`);
    await expectCode(
      () => createRequirement(SCHOOL_A, YEAR, { ...coreInput({ subjectId: math.id }), termIdentities: [null as unknown as string] }, 41),
      'INVALID_OFFERING',
      'direct-service non-string terms rejected',
    );
    res = await fetchJson('/api/v1/curriculum-requirements/requirements', {
      method: 'POST',
      headers: authHeaders(SCHOOL_A),
      body: JSON.stringify({ schoolId: SCHOOL_A, schoolYearId: YEAR, offering: { ...coreInput({ subjectId: math.id }), bogusField: 1 } }),
    });
    ok(res.status === 400 && res.body.code === 'UNKNOWN_FIELD', 'unknown offering field rejected at route');
    await expectCode(
      () => createRequirement(SCHOOL_A, YEAR, { ...coreInput({ subjectId: math.id }), bogusField: 1 } as unknown as OfferingInput, 41),
      'UNKNOWN_FIELD',
      'unknown offering field rejected at service',
    );
    res = await fetchJson(`/api/v1/curriculum-requirements/requirements/${base.id}`, {
      method: 'PATCH',
      headers: authHeaders(SCHOOL_A),
      body: JSON.stringify({ expectedVersion: 9999, bogusPatch: true }),
    });
    ok(res.status === 400 && res.body.code === 'UNKNOWN_FIELD', 'unknown patch field rejected at route');
    res = await fetchJson('/api/v1/curriculum-requirements/requirements', {
      method: 'POST',
      headers: authHeaders(SCHOOL_A),
      body: JSON.stringify({ schoolId: 'abc', schoolYearId: YEAR, offering: coreInput({ subjectId: math.id }) }),
    });
    ok(res.status === 400 && res.body.code === 'INVALID_PARAM', 'malformed body schoolId rejected');
    res = await fetchJson('/api/v1/curriculum-requirements/requirements', {
      method: 'POST',
      headers: authHeaders(SCHOOL_A),
      body: JSON.stringify({ schoolId: SCHOOL_B, schoolYearId: YEAR, offering: coreInput({ subjectId: math.id }) }),
    });
    ok(res.status === 403 && res.body.code === 'CROSS_SCHOOL_DENIED', 'mismatched body schoolId rejected');
    // Rotating UI payload shape (control 11): family + order + one term + null overrides.
    res = await fetchJson('/api/v1/curriculum-requirements/requirements', {
      method: 'POST',
      headers: authHeaders(SCHOOL_A),
      body: JSON.stringify({
        schoolId: SCHOOL_A, schoolYearId: YEAR,
        offering: {
          subjectId: spec.id, gradeLevel: 10, programType: 'STE', sectionMirrorId: null, cohortId: null,
          classification: 'SPECIALIZATION', weeklyMinutes: 120, rotationFamily: 'UI_ROT', rotationOrder: 2,
          termMode: 'ROTATING_FAMILY_MEMBER', termIdentities: ['Q2'],
        },
      }),
    });
    ok(res.status === 201, `UI rotating payload creates (got ${res.status})`);

    console.log('=== R9: zero-write reads, no consumer writes, no upstream (control 13) ===');
    const sigReads = await writeSignature(SCHOOL_A, YEAR);
    await getCurriculumRequirements(SCHOOL_A, YEAR);
    await evaluateCurriculumReadiness(SCHOOL_A, YEAR);
    await previewOfferings(SCHOOL_A, YEAR, activeInputs);
    await suggestRequirementsFromCatalog(SCHOOL_A, YEAR);
    ok((await writeSignature(SCHOOL_A, YEAR)) === sigReads, 'reads + preview + suggestions write nothing');
    const sug = await suggestRequirementsFromCatalog(SCHOOL_A, YEAR);
    ok(sug.approved === false && sug.provenance === 'catalog-compatibility-unapproved' && sug.suggestions.length > 0, 'suggestions unapproved with provenance');
    const tlAfter = await prisma.subjectSectionOwnership.count({ where: { schoolId: SCHOOL_A } });
    const runsAfter = await prisma.generationRun.count({ where: { schoolId: SCHOOL_A } });
    ok(tlAfter === tlBefore && runsAfter === runsBefore, 'no Teaching Load or generation writes');
    const here = dirname(fileURLToPath(import.meta.url));
    const svcSrc = readFileSync(join(here, '../services/school-year-offering.service.ts'), 'utf8');
    const routerSrc = readFileSync(join(here, '../routes/curriculum-requirements.router.ts'), 'utf8');
    ok(!/fetchUpstreamProgramSignals/.test(svcSrc), 'no upstream program signals in service');
    ok(!/subject-offerings/.test(svcSrc) && !/subject-offerings/.test(routerSrc), 'no EnrollPro subject-offerings reference');
    ok(!/integration\/v1/.test(svcSrc) && !/integration\/v1/.test(routerSrc), 'no EnrollPro integration feed reference');
    ok(/\.map\(String\)/.test(svcSrc) === false, 'no String() coercion remains in service');
    ok(/schoolYearOffering/.test(svcSrc), 'positive control: scan ran over the real service');

    console.log('=== R10: single-row concurrency retained ===');
    await expectCode(() => updateRequirementAtomic(base.id, SCHOOL_A, 999, { weeklyMinutes: 250 }, 41), 'STALE_WRITE', 'stale single update rejected');
    const upd = await updateRequirementAtomic(base.id, SCHOOL_A, base.version, { weeklyMinutes: 250 }, 41);
    ok(upd.weeklyMinutes === 250 && upd.version === base.version + 1, 'versioned update applies');
    await expectCode(() => updateRequirementAtomic(base.id, SCHOOL_B, upd.version, { weeklyMinutes: 260 }, 41), 'REQUIREMENT_NOT_FOUND', 'school-B actor cannot mutate school-A row (control 7)');
    ok((await prisma.schoolYearOffering.findUnique({ where: { id: base.id } }))?.weeklyMinutes === 250, 'cross-school mutation wrote nothing');
  } finally {
    server.close();
    await cleanup();
  }

  const residue = await prisma.schoolYearOffering.count({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } })
    + await prisma.schoolYearTermConfig.count({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } })
    + await prisma.sectionMirror.count({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } })
    + await prisma.instructionalCohort.count({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } })
    + await prisma.subject.count({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } })
    + await prisma.enrollProSchoolYearMirror.count({ where: { schoolId: { in: [SCHOOL_A, SCHOOL_B] } } });
  ok(residue === 0, 'zero residue on disposable schools, mirrors, and sections');

  console.log(`\ncurriculum-requirements-truth: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
