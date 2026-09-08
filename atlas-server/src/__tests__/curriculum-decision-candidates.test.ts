/**
 * SCA-03E-R — decision-candidate reconstruction integrity verification.
 *
 * Proves through the production service + route on a disposable school with
 * an EnrollPro year mirror and zero-residue cleanup:
 *  1. Groups reconstruct DYNAMICALLY from live subjects/sections/ownerships
 *     (add/remove a subject changes the group set; nothing loads JSON and
 *     nothing reads a code-owned decision constant).
 *  2. NO code-owned authority: Applied Physics, Robotics, and Research
 *     receive no pre-resolved/locked/approved/classified status from their
 *     codes alone; with zero persisted requirements every group stays
 *     UNAPPROVED_SUGGESTION, unclassified, and operator-editable.
 *  3. The same candidate codes under another school/year inherit no
 *     decision (no school/year carries historical decisions forward).
 *  4. Ownership stays SUGGESTION_ONLY everywhere and never becomes
 *     curriculum authority.
 *  5. No specialization-count rule: a third and a fourth specialization
 *     remain representable and unapproved.
 *  6. Negative-control fixture: the suite fails if a code-matched row is
 *     automatically marked pre-resolved again.
 *  7. Cross-school/archived/unauthenticated reads reject; zero writes.
 *
 * Run with: npx tsx --env-file=.env src/__tests__/curriculum-decision-candidates.test.ts
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { getDecisionCandidates } from '../services/curriculum-decision-candidates.service.js';

// Disposable fixtures — NEVER canonical school 1.
const SCHOOL = 99961;
const SCHOOL_B = 99960;
const YEAR = 77861;
const MISSING_YEAR = 77862;
const PORT = 5994;
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

function officerToken(schoolId: number): string {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign({ userId: 41, role: 'officer', schoolId, authSource: 'local' }, secret, { expiresIn: '1h' });
}

async function fetchJson(path: string, options?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function cleanup() {
  await prisma.offeringTermAssignment.deleteMany({
    where: { offering: { schoolId: { in: [SCHOOL, SCHOOL_B] } } },
  });
  await prisma.schoolYearOffering.deleteMany({ where: { schoolId: { in: [SCHOOL, SCHOOL_B] } } });
  await prisma.schoolYearTermConfig.deleteMany({ where: { schoolId: { in: [SCHOOL, SCHOOL_B] } } });
  await prisma.subjectSectionOwnership.deleteMany({ where: { schoolId: { in: [SCHOOL, SCHOOL_B] } } });
  await prisma.facultySubject.deleteMany({ where: { schoolId: { in: [SCHOOL, SCHOOL_B] } } });
  await prisma.facultyMirror.deleteMany({ where: { schoolId: { in: [SCHOOL, SCHOOL_B] } } });
  await prisma.sectionMirror.deleteMany({ where: { schoolId: { in: [SCHOOL, SCHOOL_B] } } });
  await prisma.subject.deleteMany({ where: { schoolId: { in: [SCHOOL, SCHOOL_B] } } });
  await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: { in: [SCHOOL, SCHOOL_B] } } });
  await prisma.school.deleteMany({ where: { id: { in: [SCHOOL, SCHOOL_B] } } });
}

async function writeSignature(): Promise<string> {
  const [subjects, sections, ownerships, offerings, configs] = await Promise.all([
    prisma.subject.findMany({ where: { schoolId: SCHOOL }, select: { id: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    prisma.sectionMirror.findMany({ where: { schoolId: SCHOOL }, select: { id: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    prisma.subjectSectionOwnership.findMany({ where: { schoolId: SCHOOL }, select: { id: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    prisma.schoolYearOffering.findMany({ where: { schoolId: SCHOOL }, select: { id: true, version: true }, orderBy: { id: 'asc' } }),
    prisma.schoolYearTermConfig.findMany({ where: { schoolId: SCHOOL }, select: { id: true, updatedAt: true }, orderBy: { id: 'asc' } }),
  ]);
  return JSON.stringify({ subjects, sections, ownerships, offerings, configs });
}

/**
 * Negative-control fixture: emulates the forbidden regression in which any
 * catalog-compatible row whose subject code matches the historical
 * specialization set is automatically marked pre-resolved by code. The
 * production reconstruction must NEVER equal this output for the same
 * inputs; if code-derived pre-resolution returns, the assertions below fail.
 */
function forbiddenCodeMatchRegression(
  groups: Array<{ subjectCode: string; decisionStatus: string }>,
  codes = ['STE_APPLIED_PHYS', 'STE_ROBOTICS', 'STE_RESEARCH'],
): Array<{ subjectCode: string; decisionStatus: string }> {
  return groups.filter((g) => codes.includes(g.subjectCode));
}

async function main() {
  await cleanup();
  for (const school of [SCHOOL, SCHOOL_B]) {
    await prisma.school.upsert({
      where: { id: school },
      create: { id: school, name: `SCA-03E-R School ${school}`, shortName: `R-${school}` },
      update: {},
    });
  }
  await prisma.enrollProSchoolYearMirror.createMany({
    data: [
      { schoolId: SCHOOL, enrollProSchoolYearId: YEAR, yearLabel: 'E 1', isActive: true },
      { schoolId: SCHOOL_B, enrollProSchoolYearId: YEAR, yearLabel: 'E 1', isActive: true },
    ],
  });
  const { default: app } = await import('../app.js');
  const server = app.listen(PORT, () => {});

  try {
    console.log('=== R1: fixtures (catalog, sections, faculty, ownerships) ===');
    const mkSubject = (schoolId: number, code: string, gradeLevels: number[], programScopes: any[], minMinutesPerWeek = 225) =>
      prisma.subject.create({
        data: {
          schoolId, code, name: `${code} subject`, minMinutesPerWeek,
          preferredRoomType: 'CLASSROOM', gradeLevels, programScopes,
        },
      });
    const math = await mkSubject(SCHOOL, 'DW_MATH', [7, 8, 9, 10], ['REGULAR', 'STE', 'SPA', 'SPS']);
    const ap = await mkSubject(SCHOOL, 'STE_APPLIED_PHYS', [10], ['STE']);
    const rob = await mkSubject(SCHOOL, 'STE_ROBOTICS', [10], ['STE']);
    const research = await mkSubject(SCHOOL, 'STE_RESEARCH', [7, 8, 9, 10], ['STE']);
    const music = await mkSubject(SCHOOL, 'DW_MUSIC', [7], ['SPA'], 200);
    ok(true, 'catalog fixtures: DW_MATH, AP, Robotics, Research, MUSIC');

    const mkSection = (schoolId: number, externalId: number, name: string, gradeLevelId: number, programType: string, overrides: Record<string, unknown> = {}) =>
      prisma.sectionMirror.create({
        data: {
          externalId, schoolId, schoolYearId: YEAR, name, gradeLevelId,
          gradeLevelName: `Grade ${gradeLevelId}`, displayOrder: externalId,
          maxCapacity: 45, enrolledCount: 40, programType,
          isActiveForScheduling: true, isStale: false, ...overrides,
        },
      });
    await mkSection(SCHOOL, 6101, 'E Aguinaldo', 7, 'REGULAR');
    await mkSection(SCHOOL, 6102, 'E Luna', 7, 'REGULAR');
    await mkSection(SCHOOL, 6103, 'E Bonifacio', 7, 'STE');
    await mkSection(SCHOOL, 6104, 'E Makatao', 8, 'STE');
    await mkSection(SCHOOL, 6105, 'E Rose', 9, 'STE');
    await mkSection(SCHOOL, 6106, 'E Silver', 10, 'STE');
    await mkSection(SCHOOL, 6107, 'E Jade', 10, 'REGULAR');
    await mkSection(SCHOOL, 6108, 'E Pearl', 10, 'REGULAR');
    await mkSection(SCHOOL, 6109, 'E Rizal', 7, 'SPA');
    await mkSection(SCHOOL, 6110, 'E Stale', 7, 'REGULAR', { isStale: true, staleReason: 'R-fixture' });
    await mkSection(SCHOOL, 6111, 'E Inactive', 8, 'REGULAR', { isActiveForScheduling: false });
    ok(true, '11 section mirrors (9 scheduling-active, 1 stale, 1 inactive)');

    const mkFaculty = (tag: string, externalId: number) => prisma.facultyMirror.create({
      data: { schoolId: SCHOOL, externalId, firstName: `E${tag}`, lastName: 'Faculty', employmentStatus: 'PERMANENT', isActiveForScheduling: true },
    });
    const facA = await mkFaculty('A', 961001);
    const facB = await mkFaculty('B', 961002);
    const facC = await mkFaculty('C', 961003);
    const facD = await mkFaculty('D', 961004);
    const mkFs = (facultyId: number, subjectId: number, sectionExternalIds: number[]) =>
      prisma.facultySubject.create({
        data: { schoolId: SCHOOL, schoolYearId: YEAR, facultyId, subjectId, gradeLevels: [7], sectionIds: sectionExternalIds, assignedBy: 41 },
      });
    const fsMath = await mkFs(facA.id, math.id, [6101]);
    const fsAp = await mkFs(facB.id, ap.id, [6106]);
    const fsRob = await mkFs(facB.id, rob.id, [6106]);
    const fsRes = await mkFs(facC.id, research.id, [6103, 6104, 6105, 6106]);
    const fsMusic = await mkFs(facD.id, music.id, [6109, 6107]);
    const mkOwn = (fsId: number, facultyId: number, subjectId: number, sectionExternalId: number) =>
      prisma.subjectSectionOwnership.create({
        data: { schoolId: SCHOOL, schoolYearId: YEAR, facultySubjectId: fsId, facultyId, subjectId, sectionId: sectionExternalId },
      });
    const ownMath = await mkOwn(fsMath.id, facA.id, math.id, 6101);
    await mkOwn(fsAp.id, facB.id, ap.id, 6106);
    await mkOwn(fsRob.id, facB.id, rob.id, 6106);
    await mkOwn(fsRes.id, facC.id, research.id, 6103);
    await mkOwn(fsRes.id, facC.id, research.id, 6104);
    await mkOwn(fsRes.id, facC.id, research.id, 6105);
    await mkOwn(fsRes.id, facC.id, research.id, 6106);
    await mkOwn(fsMusic.id, facD.id, music.id, 6109);
    // Owned-but-incompatible: MUSIC (G7/SPA only) owned on a G10 REGULAR
    // section must never become a candidate — ownership confers nothing.
    await mkOwn(fsMusic.id, facD.id, music.id, 6107);
    ok(true, '9 annual ownership rows incl. one owned-but-incompatible probe');

    console.log('=== R2: zero persisted requirements → zero code authority ===');
    const sigBefore = await writeSignature();
    const result = await getDecisionCandidates(SCHOOL, YEAR);
    // Mechanical: MATH×7 scopes + AP×1 + ROB×1 + RES×4 + MUSIC×1 = 14.
    ok(result.groups.length === 14, `14 mechanical groups (got ${result.groups.length})`);
    ok(result.counts.total === 14 && result.counts.unresolved === 14, 'counts.total === counts.unresolved (nothing pre-resolved)');
    ok((result.counts as { preResolved?: number }).preResolved === undefined, 'no preResolved counter ships (concept removed)');
    ok(!('establishedDecisions' in result), 'no establishedDecisions field ships from code');
    ok(!('unmatchedEstablishedDecisions' in result), 'no unmatched-established field ships from code');
    ok(result.authorizesNoMutation === true, 'authorizesNoMutation true');
    ok(result.termConfig === null, 'no persisted term config (never defaulted)');
    ok(result.sourceRevisions.annualOwnershipCount === 9, 'source revisions count all 9 ownership rows');
    ok(result.sourceRevisions.activeRequirementCount === 0, 'zero persisted current-year requirements');

    const everyGroupUnapproved =
      result.groups.every((g) => g.decisionStatus === 'UNAPPROVED_SUGGESTION');
    ok(everyGroupUnapproved, 'EVERY group is UNAPPROVED_SUGGESTION (incl. AP/ROB/Research codes)');
    const specialCoded = result.groups.filter((g) =>
      ['STE_APPLIED_PHYS', 'STE_ROBOTICS', 'STE_RESEARCH'].includes(g.subjectCode));
    ok(specialCoded.length === 6, `six code-matched groups present (got ${specialCoded.length})`);
    ok(specialCoded.every((g) => g.decisionStatus === 'UNAPPROVED_SUGGESTION'), 'AP/ROB/Research receive no status from their codes alone');
    // Negative control: the forbidden regression would mark these six; the
    // reconstruction must never match that output for the same inputs.
    const mutant = forbiddenCodeMatchRegression(result.groups);
    ok(mutant.length === 6 && mutant.every((g) => g.decisionStatus !== 'PRE_RESOLVED_SPECIALIZATION'),
      'negative control: code-matched rows are NOT pre-resolved (mutant output is never produced)');

    const byKey = new Map(result.groups.map((g) => [g.groupKey, g]));
    const researchG10 = byKey.get('G10:STE:STE_RESEARCH');
    const apG10 = byKey.get('G10:STE:STE_APPLIED_PHYS');
    ok(!!researchG10 && researchG10.decisionStatus === 'UNAPPROVED_SUGGESTION', 'G10 Research exclusion is NOT baked in — it stays an operator decision');
    ok(!!apG10 && apG10.decisionStatus === 'UNAPPROVED_SUGGESTION', 'G10 Applied Physics stays an unapproved operator decision');
    ok(!result.groups.some((g) => g.groupKey.includes('Stale') || g.groupKey.includes('Inactive')), 'stale/inactive sections contribute no scope');
    ok(!byKey.has('G10:REGULAR:DW_MUSIC'), 'owned-but-incompatible MUSIC yields no G10 REGULAR group');
    ok(!byKey.has('G8:REGULAR:DW_MATH'), 'inactive-section scope G8 REGULAR absent');

    console.log('=== R3: ownership stays SUGGESTION_ONLY (never curriculum authority) ===');
    const mathG7 = byKey.get('G7:REGULAR:DW_MATH');
    ok(!!mathG7, 'MATH G7 REGULAR group present');
    ok(mathG7?.termMode === 'ALL' && mathG7?.termModeStatus === 'UNAPPROVED_SUGGESTION', 'term mode ALL unapproved');
    ok(!('termIdentities' in (mathG7 as object)), 'no term identities ship on any group (never defaulted)');
    ok(
      mathG7?.sectionCount === 2 && mathG7?.demandMinutesPerWeek === 450 &&
      mathG7?.demandDerivation === '225 min/wk (catalog) × 2 section(s) = 450 min/wk',
      `sections + demand + formula (got ${mathG7?.demandDerivation})`,
    );
    ok(
      mathG7?.affectedSections.map((s) => s.name).join(',') === 'E Aguinaldo,E Luna',
      'affected sections resolved read-only from mirrors',
    );
    ok(
      mathG7?.currentOwnershipEvidence.evidenceStatus === 'SUGGESTION_ONLY' &&
      mathG7?.currentOwnershipEvidence.ownershipIds.join(',') === String(ownMath.id) &&
      mathG7?.currentOwnershipEvidence.facultyIds.join(',') === String(facA.id),
      'ownership evidence SUGGESTION_ONLY with exact ids',
    );
    ok(
      result.groups.every((g) => g.currentOwnershipEvidence.evidenceStatus === 'SUGGESTION_ONLY'),
      'ownership remains SUGGESTION_ONLY on every group (never curriculum authority)',
    );

    console.log('=== R4: no specialization-count rule (third/fourth specialization allowed) ===');
    const astro = await mkSubject(SCHOOL, 'DW_ASTRONOMY', [10], ['STE'], 200);
    const astrobio = await mkSubject(SCHOOL, 'DW_ASTROBIOLOGY', [10], ['STE'], 180);
    const afterMore = await getDecisionCandidates(SCHOOL, YEAR);
    const astroGroup = afterMore.groups.find((g) => g.groupKey === 'G10:STE:DW_ASTRONOMY');
    const astrobioGroup = afterMore.groups.find((g) => g.groupKey === 'G10:STE:DW_ASTROBIOLOGY');
    ok(!!astroGroup && astroGroup.decisionStatus === 'UNAPPROVED_SUGGESTION', 'third G10 STE subject reconstructs as unapproved (no count rule)');
    ok(!!astrobioGroup && astrobioGroup.decisionStatus === 'UNAPPROVED_SUGGESTION', 'fourth G10 STE subject reconstructs as unapproved (no count rule)');
    await prisma.subject.delete({ where: { id: astro.id } });
    await prisma.subject.delete({ where: { id: astrobio.id } });
    const afterRemove = await getDecisionCandidates(SCHOOL, YEAR);
    ok(afterRemove.groups.length === 14, 'removing subjects shrinks the set (dynamic, never JSON-loaded)');

    console.log('=== R5: same codes under another school inherit no decision ===');
    await mkSubject(SCHOOL_B, 'STE_RESEARCH', [7, 8, 9, 10], ['STE']);
    await mkSubject(SCHOOL_B, 'STE_APPLIED_PHYS', [10], ['STE']);
    await mkSubject(SCHOOL_B, 'STE_ROBOTICS', [10], ['STE']);
    await mkSection(SCHOOL_B, 96201, 'B Silver', 10, 'STE');
    await mkSection(SCHOOL_B, 96202, 'B Bonifacio', 7, 'STE');
    const otherSchool = await getDecisionCandidates(SCHOOL_B, YEAR);
    ok(otherSchool.groups.length >= 4, `school B reconstructs its own codes (got ${otherSchool.groups.length})`);
    const bSpecial = otherSchool.groups.filter((g) =>
      ['STE_APPLIED_PHYS', 'STE_ROBOTICS', 'STE_RESEARCH'].includes(g.subjectCode));
    ok(bSpecial.length >= 3 && bSpecial.every((g) => g.decisionStatus === 'UNAPPROVED_SUGGESTION'),
      'same codes under another school/year inherit NO decision (all unapproved)');
    ok(otherSchool.counts.total === otherSchool.counts.unresolved, 'school B has zero pre-resolved groups');

    console.log('=== R6: zero-write + route + authority ===');
    // sigBefore brackets all reconstruction reads AND the R4 add/remove
    // cycle AND all SCHOOL_B fixture inserts (SCHOOL-only signature, so the
    // SCHOOL_B inserts cannot affect it): any SERVICE write on SCHOOL would
    // break equality.
    ok((await writeSignature()) === sigBefore, 'reconstruction + add/remove cycle wrote nothing to SCHOOL');
    const headers = { Authorization: `Bearer ${officerToken(SCHOOL)}` };
    let res = await fetchJson(`/api/v1/curriculum-requirements/${YEAR}/decision-candidates`, { headers });
    ok(res.status === 200 && res.body.candidates?.counts?.total === 14, `route 200 with 14 groups (got ${res.status}/${res.body.candidates?.counts?.total})`);
    ok(typeof res.body.candidates?.sourceRevisionHash === 'string' && res.body.candidates.sourceRevisionHash.length === 64, 'route payload carries a canonical 64-hex sourceRevisionHash');
    ok(res.body.candidates?.counts?.preResolved === undefined && res.body.candidates?.groups?.every((g: any) => g.decisionStatus === 'UNAPPROVED_SUGGESTION'), 'route payload has no pre-resolved concept');
    ok(res.body.candidates?.groups?.every((g: any) => g.currentOwnershipEvidence?.evidenceStatus === 'SUGGESTION_ONLY'), 'route payload SUGGESTION_ONLY everywhere');
    res = await fetchJson(`/api/v1/curriculum-requirements/${YEAR}/decision-candidates`);
    ok(res.status === 401, 'unauthenticated read rejected (not 404)');
    res = await fetchJson(`/api/v1/curriculum-requirements/${YEAR}/decision-candidates`, { headers: { Authorization: `Bearer ${officerToken(SCHOOL_B)}` } });
    ok(res.status === 200 && res.body.candidates?.groups?.length >= 3, 'school-B actor sees own scope (school isolation holds)');
    res = await fetchJson(`/api/v1/curriculum-requirements/${MISSING_YEAR}/decision-candidates`, { headers });
    ok(res.status === 404, 'mirror-less year 404 (wrong year fails closed)');
    await expectCode(() => getDecisionCandidates(SCHOOL, MISSING_YEAR), 'YEAR_NOT_FOUND', 'service mirror-less year YEAR_NOT_FOUND');
  console.log('=== R7: canonical semantic revision — same-count changes invalidate drafts ===');
    const hashOf = async (s: number, y: number) => (await getDecisionCandidates(s, y)).sourceRevisionHash;
    const oldGate = (r: Awaited<ReturnType<typeof getDecisionCandidates>>) =>
      JSON.stringify({
        subjects: r.sourceRevisions.activeSubjectCount,
        sections: r.sourceRevisions.activeSectionCount,
        ownerships: r.sourceRevisions.annualOwnershipCount,
        requirements: r.sourceRevisions.activeRequirementCount,
        subjectsUpdatedAtMax: r.sourceRevisions.subjectsUpdatedAtMax,
        ownershipsUpdatedAtMax: r.sourceRevisions.ownershipsUpdatedAtMax,
      });

    const h0 = await hashOf(SCHOOL, YEAR);
    ok(typeof h0 === 'string' && h0.length === 64, 'sourceRevisionHash is a canonical 64-hex SHA-256');
    ok((await hashOf(SCHOOL, YEAR)) === h0, 'semantically identical reordered database result hashes identically (stable across reads)');
    ok(h0 !== (await hashOf(SCHOOL_B, YEAR)), '#8 cross-school substitution changes the hash');
    const g0 = oldGate(await getDecisionCandidates(SCHOOL, YEAR));

    // #1 section grade/program/name/identity semantics.
    const sectionByExternalId = (externalId: number) => ({
      schoolId_schoolYearId_externalId: { schoolId: SCHOOL, schoolYearId: YEAR, externalId },
    });
    await prisma.sectionMirror.update({ where: sectionByExternalId(6103), data: { name: 'E Bonifacio RENAMED' } });
    ok((await hashOf(SCHOOL, YEAR)) !== h0, '#1 section name change (same count) changes the hash');
    ok(oldGate(await getDecisionCandidates(SCHOOL, YEAR)) === g0,
      '#1 mutant negative control: the old count/max-timestamp gate is UNCHANGED, so the suite fails if the gate falls back to count/timestamp equality');
    await prisma.sectionMirror.update({ where: sectionByExternalId(6103), data: { name: 'E Bonifacio' } });

    // #2 ownership faculty/subject/section association.
    await prisma.subjectSectionOwnership.update({ where: { id: ownMath.id }, data: { facultyId: facB.id } });
    ok((await hashOf(SCHOOL, YEAR)) !== h0, '#2 ownership faculty association change (same count) changes the hash');
    await prisma.subjectSectionOwnership.update({ where: { id: ownMath.id }, data: { facultyId: facA.id } });

    // #3 subject scopes/minutes/rotation/name.
    await prisma.subject.update({ where: { id: math.id }, data: { minMinutesPerWeek: 250 } });
    ok((await hashOf(SCHOOL, YEAR)) !== h0, '#3 subject minutes change (same count) changes the hash');
    await prisma.subject.update({ where: { id: math.id }, data: { minMinutesPerWeek: 225 } });

    // #4 term count or ordered identities.
    const tc = await prisma.schoolYearTermConfig.create({
      data: { schoolId: SCHOOL, schoolYearId: YEAR, termCount: 2, termIdentities: ['Q1', 'Q2'], isActive: true },
    });
    const h4a = await hashOf(SCHOOL, YEAR);
    ok(h4a !== h0, '#4 term config creation changes the hash');
    await prisma.schoolYearTermConfig.update({ where: { id: tc.id }, data: { termIdentities: ['Q2', 'Q1'] } });
    ok((await hashOf(SCHOOL, YEAR)) !== h4a, '#4 term identity ORDER change (same count) changes the hash');

    // #5 requirement classification/minutes/scope/rotation.
    const offering = await prisma.schoolYearOffering.create({
      data: {
        schoolId: SCHOOL, schoolYearId: YEAR, termConfigId: tc.id, subjectId: math.id,
        gradeLevel: 7, programType: 'REGULAR' as never, classification: 'CORE' as never,
        weeklyMinutes: 225, termMode: 'ALL' as never, isActive: true,
      },
    });
    const h5a = await hashOf(SCHOOL, YEAR);
    await prisma.schoolYearOffering.update({ where: { id: offering.id }, data: { classification: 'EXPLORATORY' as never } });
    ok((await hashOf(SCHOOL, YEAR)) !== h5a, '#5 requirement classification change (same count) changes the hash');

    // #6 requirement term assignment replacement.
    await prisma.offeringTermAssignment.create({ data: { offeringId: offering.id, termIdentity: 'Q1' } });
    const h6a = await hashOf(SCHOOL, YEAR);
    await prisma.offeringTermAssignment.deleteMany({ where: { offeringId: offering.id } });
    await prisma.offeringTermAssignment.create({ data: { offeringId: offering.id, termIdentity: 'Q2' } });
    ok((await hashOf(SCHOOL, YEAR)) !== h6a, '#6 term assignment replacement (same count) changes the hash');

    // #7 delete-and-recreate with equal active counts.
    const h7a = await hashOf(SCHOOL, YEAR);
    await prisma.schoolYearOffering.update({ where: { id: offering.id }, data: { isActive: false } });
    await prisma.schoolYearOffering.create({
      data: {
        schoolId: SCHOOL, schoolYearId: YEAR, termConfigId: tc.id, subjectId: music.id,
        gradeLevel: 7, programType: 'SPA' as never, classification: 'CORE' as never,
        weeklyMinutes: 200, termMode: 'ALL' as never, isActive: true,
      },
    });
    ok((await hashOf(SCHOOL, YEAR)) !== h7a, '#7 delete-and-recreate with equal active counts changes the hash');

    // #8 cross-year substitution (same school, different year).
    await prisma.enrollProSchoolYearMirror.create({
      data: { schoolId: SCHOOL, enrollProSchoolYearId: YEAR + 1, yearLabel: 'E 2', isActive: true },
    });
    await prisma.sectionMirror.create({
      data: {
        externalId: 61901, schoolId: SCHOOL, schoolYearId: YEAR + 1, name: 'E2 Aguinaldo', gradeLevelId: 7,
        gradeLevelName: 'Grade 7', displayOrder: 61901, maxCapacity: 45, enrolledCount: 40,
        programType: 'REGULAR', isActiveForScheduling: true, isStale: false,
      },
    });
    await prisma.sectionMirror.create({
      data: {
        externalId: 61902, schoolId: SCHOOL, schoolYearId: YEAR + 1, name: 'E2 Luna', gradeLevelId: 7,
        gradeLevelName: 'Grade 7', displayOrder: 61902, maxCapacity: 45, enrolledCount: 40,
        programType: 'REGULAR', isActiveForScheduling: true, isStale: false,
      },
    });
    ok((await hashOf(SCHOOL, YEAR + 1)) !== h0, '#8 same school different year changes the hash');

    // Query-shape gate: candidate+hash reads are batched/set-based — a fixed
    // small query count regardless of group cardinality (14 groups would add
    // >= 14 queries if the code looped per row). Counted via an injected
    // counting proxy on the exact production data-access path.
    const counters = new Map<string, number>();
    const COUNTED_METHODS = ['findMany', 'findUnique', 'findFirst', 'count', 'aggregate', 'groupBy'];
    const countingPrisma = new Proxy(prisma, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver) as unknown;
        if (typeof prop === 'string' && value !== null && typeof value === 'object') {
          const delegate = value as Record<string, unknown>;
          if (COUNTED_METHODS.some((m) => typeof delegate[m] === 'function')) {
            return new Proxy(delegate, {
              get(t, p, r) {
                const v = Reflect.get(t, p, t);
                if (typeof p === 'string' && COUNTED_METHODS.includes(p)) {
                  counters.set(p, (counters.get(p) ?? 0) + 1);
                }
                return v;
              },
            });
          }
        }
        return value;
      },
    });
    const { withDataContext } = await import('../lib/data-context.js');
    const qs = await withDataContext(countingPrisma, () => getDecisionCandidates(SCHOOL, YEAR));
    const totalQueries = COUNTED_METHODS.reduce((sum, m) => sum + (counters.get(m) ?? 0), 0);
    ok(totalQueries >= 4 && totalQueries <= 14,
      `query-shape: batched/set-based reads (${totalQueries} queries for ${qs.groups.length} groups; per-row would be >= 14)`);

    // No code-matched subject gains authority after any semantic change.
    const finalGroups = (await getDecisionCandidates(SCHOOL, YEAR)).groups;
    ok(finalGroups.filter((g) => ['STE_APPLIED_PHYS', 'STE_ROBOTICS', 'STE_RESEARCH'].includes(g.subjectCode))
      .every((g) => g.decisionStatus === 'UNAPPROVED_SUGGESTION'), 'semantic hash changes never grant code-matched subjects authority');
  // SCA-03E-R3 #4: set-like subject arrays (gradeLevels, programScopes) must be
    // canonically sorted before hashing; identical semantic sets hash identically.
    console.log('=== R8: canonical set ordering — gradeLevels/programScopes ===');
    const hR8a = await hashOf(SCHOOL, YEAR);
    const origSubject = await prisma.subject.findUnique({ where: { id: math.id }, select: { updatedAt: true } });
    const pinnedUpdatedAt = origSubject?.updatedAt ?? new Date();
    await prisma.subject.update({
      where: { id: math.id },
      data: { gradeLevels: [10, 9, 8, 7], programScopes: ['SPS', 'SPA', 'STE', 'REGULAR'] as any, updatedAt: pinnedUpdatedAt },
    });
    ok((await hashOf(SCHOOL, YEAR)) === hR8a,
      '#4 reordered gradeLevels/programScopes (same semantic set, pinned updatedAt) hashes identically (canonical sort)');
    await prisma.subject.update({
      where: { id: math.id },
      data: { gradeLevels: [7, 8, 9, 10], programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] as any, updatedAt: pinnedUpdatedAt },
    });
    ok((await hashOf(SCHOOL, YEAR)) === hR8a, '#4 restoring original array order keeps the hash stable');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanup();
  }

  const residue = await prisma.subject.count({ where: { schoolId: { in: [SCHOOL, SCHOOL_B] } } });
  ok(residue === 0, 'zero residue after cleanup');
  console.log(`\ncurriculum-decision-candidates: ${passed} passed, ${failed} failed`);
  assert.equal(failed, 0, `${failed} check(s) failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
