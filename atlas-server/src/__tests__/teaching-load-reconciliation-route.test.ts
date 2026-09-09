/**
 * Teaching Load reconciliation MOUNTED-ROUTE integration tests (TL-C02R1).
 *
 * Boots the real Express app on an ephemeral port with real authentication
 * middleware and hand-signed JWTs. All data lives in a disposable fixture
 * school/year (fully removed in `finally` with a zero-residue assertion); the
 * live school 1 / year 8 is never touched and the live fingerprint is never
 * applied.
 *
 * Proofs:
 *  - own-school JWT preview + exact-fingerprint apply succeed on the fixture;
 *  - numeric-string schoolId/schoolYearId normalize to one fingerprint;
 *  - missing-school and cross-school JWTs fail with typed 403;
 *  - system token cannot call preview/apply (401), but can read readiness;
 *  - malformed identifiers fail with typed 400;
 *  - missing / archived / unavailable / historical / ambiguous years fail BEFORE any writes;
 *  - exact-fingerprint apply succeeds once and replay is zero-write;
 *  - sensitivity control: deactivating the mirror flips the same preview to 409,
 *    and re-activating it succeeds — proving the active-year gate is load-bearing;
 *  - all disposable rows are removed in finally cleanup.
 *
 * Run with `npx tsx <this-file>`. Requires a reachable database.
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

async function main() {
  loadServerEnv();
  if (!process.env.DATABASE_URL) {
    console.error('[FAIL] DATABASE_URL is unavailable.');
    process.exit(1);
  }
  const prismaModule = await import('../lib/prisma.js');
  const base = (prismaModule as any).createTestPrismaClient();

  const FIXTURE_NAME = 'TL-C02R1 ROUTE FIXTURE — SAFE TO DELETE';
  const fixtureYearId = 9075;
  let fixtureSchoolId = 0;
  let fixtureTermConfigId = 0;
  let fixtureSection101 = 0;
  let fixtureSubjectMath = 0;
  let fixtureFaculty1 = 0;
  let server: any = null;

  try {
    section('R1. fixture setup (disposable school/year + active mirror)');
    const created = await base.school.create({ data: { name: FIXTURE_NAME, shortName: 'TLC02R1X' }, select: { id: true } });
    fixtureSchoolId = (created as any).id as number;
    assert(fixtureSchoolId > 0, `fixture school created (id=${fixtureSchoolId})`);
    await base.enrollProSchoolYearMirror.create({
      data: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId, yearLabel: '2029-2030', isActive: true, isArchived: false, syncStatus: 'synced' },
    });
    const termConfig = await base.schoolYearTermConfig.create({
      data: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, termCount: 3, termIdentities: ['Term 1', 'Term 2', 'Term 3'], isActive: true },
      select: { id: true },
    });
    fixtureTermConfigId = (termConfig as any).id as number;
    const math = await base.subject.create({
      data: { schoolId: fixtureSchoolId, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, programScopes: ['REGULAR'], gradeLevels: [7], ownerDepartment: 'MATH', isActive: true },
      select: { id: true },
    });
    fixtureSubjectMath = (math as any).id as number;
    const sectionRow = await base.sectionMirror.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, externalId: 101, name: 'Grade 7 - A',
        gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 50, enrolledCount: 50,
        isActiveForScheduling: true, isStale: false,
      },
      select: { id: true },
    });
    fixtureSection101 = (section as any).id as number;
    const faculty = await base.facultyMirror.create({
      data: { schoolId: fixtureSchoolId, externalId: 7101, employeeId: 'E7101', firstName: 'Mara', lastName: 'Math', department: 'MATH', isActiveForScheduling: true, isClassAdviser: false, maxHoursPerWeek: 30 },
      select: { id: true },
    });
    fixtureFaculty1 = (faculty as any).id as number;
    await base.schoolYearOffering.create({
      data: {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, termConfigId: fixtureTermConfigId,
        subjectId: fixtureSubjectMath, gradeLevel: 7, programType: 'REGULAR',
        classification: 'CORE', weeklyMinutes: 240, termMode: 'ALL', isActive: true,
      },
    });
    // No ownership: MATH:101 is a pending INSERT so the first apply writes.

    section('R2. real app boot + signed JWTs');
    const app = (await import('../app.js')).default;
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET as string;
    assert(typeof secret === 'string' && secret.length > 0, 'JWT secret configured');
    const signJwt = (payload: Record<string, unknown>): string =>
      (jwt.default as any).sign(payload, secret, { expiresIn: '5m' });
    const systemToken = (process.env.ATLAS_SYSTEM_TOKEN ?? '').trim();
    assert(systemToken.length > 0, 'system token configured');
    const officerJwt = (schoolId: number | null | undefined, extra: Record<string, unknown> = {}) => signJwt({
      userId: 9001,
      role: 'officer',
      authSource: 'local',
      ...(schoolId == null ? {} : { schoolId }),
      ...extra,
    });
    server = await new Promise<any>((resolveServer, rejectServer) => {
      const listener = app.listen(0, () => resolveServer(listener));
      listener.on('error', rejectServer);
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? (address as any).port : 0;
    assert(port > 0, `ephemeral test server listening (port=${port})`);
    const baseUrl = `http://127.0.0.1:${port}`;

    async function callRoute(name: string, method: string, path: string, token: string | null, body: unknown, expectStatus: number, expectCode?: string) {
      const res = await fetch(baseUrl + path, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      const okStatus = res.status === expectStatus;
      const okCode = expectCode == null || (json as any).code === expectCode;
      assert(okStatus && okCode, `${name} → ${res.status}/${(json as any).code ?? 'no-code'} (expected ${expectStatus}${expectCode ? `/${expectCode}` : ''})`);
      return json;
    }
    const previewPath = '/api/v1/faculty-assignments/reconciliation/preview';
    const applyPath = '/api/v1/faculty-assignments/reconciliation/apply';
    const readinessPath = '/api/v1/faculty-assignments/reconciliation/readiness';
    const previewBody = () => ({ schoolId: fixtureSchoolId, schoolYearId: fixtureYearId });

    section('R3. auth, scope, and parsing gates');
    // Missing actor school → 403.
    await callRoute('R3 missing-school preview rejected', 'POST', previewPath, officerJwt(null), previewBody(), 403, 'ACTOR_SCHOOL_REQUIRED');
    await callRoute('R3 missing-school apply rejected', 'POST', applyPath, officerJwt(null), previewBody(), 403, 'ACTOR_SCHOOL_REQUIRED');
    // Cross-school JWT → 403.
    await callRoute('R3 cross-school preview rejected', 'POST', previewPath, officerJwt(999997), previewBody(), 403, 'SCHOOL_MISMATCH');
    await callRoute('R3 cross-school apply rejected', 'POST', applyPath, officerJwt(999997), previewBody(), 403, 'SCHOOL_MISMATCH');
    // System token cannot call operator preview/apply.
    await callRoute('R3 system-token preview rejected', 'POST', previewPath, systemToken, previewBody(), 401);
    await callRoute('R3 system-token apply rejected', 'POST', applyPath, systemToken, previewBody(), 401);
    // System token CAN read the read-only readiness surface.
    {
      const res = await fetch(`${baseUrl}${readinessPath}?schoolId=${fixtureSchoolId}&schoolYearId=${fixtureYearId}`, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      const json = await res.json().catch(() => ({}));
      assert(res.status === 200 && typeof (json as any).demandCount === 'number', 'system-token readiness returns the coverage contract');
    }
    // Malformed identifiers → typed 400.
    for (const [label, value] of [
      ['fractional', '3.5'], ['infinite', 'Infinity'], ['string-junk', 'abc'], ['zero', '0'], ['negative', '-4'], ['empty', ''],
    ] as Array<[string, string]>) {
      await callRoute(`R3 preview schoolId=${label} rejected`, 'POST', previewPath, officerJwt(fixtureSchoolId), { schoolId: value, schoolYearId: fixtureYearId }, 400, 'INVALID_PARAM');
      await callRoute(`R3 preview schoolYearId=${label} rejected`, 'POST', previewPath, officerJwt(fixtureSchoolId), { schoolId: fixtureSchoolId, schoolYearId: value }, 400, 'INVALID_PARAM');
    }

    section('R4. numeric-string identifiers normalize to one contract');
    const numericPreview: any = await callRoute('R4 numeric preview succeeds', 'POST', previewPath, officerJwt(fixtureSchoolId), previewBody(), 200);
    assert(typeof numericPreview.fingerprint === 'string' && numericPreview.fingerprint.length === 64, 'numeric preview returns a canonical fingerprint');
    const stringPreview: any = await callRoute('R4 string preview succeeds', 'POST', previewPath, officerJwt(fixtureSchoolId), { schoolId: String(fixtureSchoolId), schoolYearId: String(fixtureYearId) }, 200);
    assertEqual(stringPreview.fingerprint, numericPreview.fingerprint, 'string-id and numeric-id previews share one fingerprint');

    section('R5. exact-fingerprint apply succeeds once; replay is zero-write');
    const before = await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
    const applied: any = await callRoute('R5 apply succeeds', 'POST', applyPath, officerJwt(fixtureSchoolId), {
      schoolId: String(fixtureSchoolId),
      schoolYearId: fixtureYearId,
      expectedFingerprint: numericPreview.fingerprint,
      expectedSourceRevision: numericPreview.sourceRevision,
      confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
    }, 200);
    assertEqual(applied.replayed, false, 'first apply executes writes');
    assertEqual(applied.inserted, 1, 'one ownership inserted through the route');
    const after = await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
    assertEqual(after, before + 1, 'ownership row created through the route');
    const fsAfter = await base.facultySubject.findFirst({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, facultyId: fixtureFaculty1, subjectId: fixtureSubjectMath } });
    assertEqual(JSON.stringify((fsAfter as any).sectionIds), JSON.stringify([101]), 'FacultySubject sectionIds set by the route apply');
    assertEqual(JSON.stringify((fsAfter as any).gradeLevels), JSON.stringify([7]), 'FacultySubject gradeLevels derived by the route apply');

    const replayPreview: any = await callRoute('R5 replay preview', 'POST', previewPath, officerJwt(fixtureSchoolId), previewBody(), 200);
    const replayCount = await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
    const replay: any = await callRoute('R5 replay apply', 'POST', applyPath, officerJwt(fixtureSchoolId), {
      schoolId: fixtureSchoolId,
      schoolYearId: fixtureYearId,
      expectedFingerprint: replayPreview.fingerprint,
      expectedSourceRevision: replayPreview.sourceRevision,
      confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
    }, 200);
    assertEqual(replay.replayed, true, 'replay reports replayed:true through the route');
    const replayCountAfter = await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
    assertEqual(replayCountAfter, replayCount, 'replay performs zero ownership writes through the route');

    section('R6. active-year authority through the mounted routes (before writes)');
    // Missing year → 404, no writes.
    {
      const beforeWrites = await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
      await callRoute('R6 missing year preview rejected', 'POST', previewPath, officerJwt(fixtureSchoolId), { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId + 100 }, 404, 'YEAR_MIRROR_NOT_FOUND');
      const afterWrites = await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
      assertEqual(afterWrites, beforeWrites, 'missing-year rejection writes nothing');
    }
    // No active mirror → 409 ACTIVE_YEAR_UNAVAILABLE.
    {
      await base.enrollProSchoolYearMirror.update({
        where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId } },
        data: { isActive: false },
      });
      const beforeWrites = await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
      await callRoute('R6 unavailable year readiness rejected', 'GET', `${readinessPath}?schoolId=${fixtureSchoolId}&schoolYearId=${fixtureYearId}`, officerJwt(fixtureSchoolId), undefined, 409, 'ACTIVE_YEAR_UNAVAILABLE');
      await callRoute('R6 unavailable year preview rejected', 'POST', previewPath, officerJwt(fixtureSchoolId), previewBody(), 409, 'ACTIVE_YEAR_UNAVAILABLE');
      await callRoute('R6 unavailable year apply rejected', 'POST', applyPath, officerJwt(fixtureSchoolId), {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
        expectedFingerprint: replayPreview.fingerprint, expectedSourceRevision: replayPreview.sourceRevision,
        confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
      }, 409, 'ACTIVE_YEAR_UNAVAILABLE');
      const afterWrites = await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
      assertEqual(afterWrites, beforeWrites, 'unavailable-year rejection writes nothing');

      // A different sole active mirror makes the requested row historical.
      const alternateYearId = fixtureYearId + 1;
      await base.enrollProSchoolYearMirror.create({
        data: { schoolId: fixtureSchoolId, enrollProSchoolYearId: alternateYearId, yearLabel: '2030-2031', isActive: true, isArchived: false, syncStatus: 'synced' },
      });
      await callRoute('R6 historical requested year rejected', 'POST', previewPath, officerJwt(fixtureSchoolId), previewBody(), 409, 'INACTIVE_HISTORICAL_YEAR');

      // Reactivating the requested mirror now creates a genuinely ambiguous
      // same-school active set. A requested-row-only mutant would accept it.
      await base.enrollProSchoolYearMirror.update({
        where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId } },
        data: { isActive: true },
      });
      const requestedRow = await base.enrollProSchoolYearMirror.findUnique({
        where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId } },
      });
      assert(Boolean((requestedRow as any)?.isActive && !(requestedRow as any)?.isArchived), 'R6 mutant: requested-row-only implementation would accept two active mirrors');
      const mutationSignatureBefore = {
        ownership: await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
        facultySubjects: await base.facultySubject.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
        cycles: await base.teachingLoadCycle.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
        audits: await base.auditLog.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
      };
      await callRoute('R6 ambiguous year readiness rejected', 'GET', `${readinessPath}?schoolId=${fixtureSchoolId}&schoolYearId=${fixtureYearId}`, officerJwt(fixtureSchoolId), undefined, 409, 'ACTIVE_YEAR_AMBIGUOUS');
      await callRoute('R6 ambiguous year preview rejected', 'POST', previewPath, officerJwt(fixtureSchoolId), previewBody(), 409, 'ACTIVE_YEAR_AMBIGUOUS');
      await callRoute('R6 ambiguous year apply rejected', 'POST', applyPath, officerJwt(fixtureSchoolId), {
        schoolId: fixtureSchoolId, schoolYearId: fixtureYearId,
        expectedFingerprint: replayPreview.fingerprint, expectedSourceRevision: replayPreview.sourceRevision,
        confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
      }, 409, 'ACTIVE_YEAR_AMBIGUOUS');
      const mutationSignatureAfter = {
        ownership: await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
        facultySubjects: await base.facultySubject.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
        cycles: await base.teachingLoadCycle.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
        audits: await base.auditLog.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
      };
      assertEqual(JSON.stringify(mutationSignatureAfter), JSON.stringify(mutationSignatureBefore), 'ambiguous route matrix writes no ownership, FacultySubject, cycle, or audit rows');

      await base.enrollProSchoolYearMirror.update({
        where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: alternateYearId } },
        data: { isActive: false, isArchived: true, archivedAt: new Date(), archivedBy: 0, archiveReason: 'ambiguity resolved' },
      });
      const restored: any = await callRoute('R6 archived competitor restores intended year', 'POST', previewPath, officerJwt(fixtureSchoolId), previewBody(), 200);
      assert(typeof restored.fingerprint === 'string', 'sole active intended year returns a fingerprint after competitor archive');
    }
    // Archived year → 409, no writes.
    {
      await base.enrollProSchoolYearMirror.update({
        where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId } },
        data: { isArchived: true, archivedAt: new Date(), archivedBy: 0, archiveReason: 'route test' },
      });
      const beforeWrites = await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
      await callRoute('R6 archived year preview rejected', 'POST', previewPath, officerJwt(fixtureSchoolId), previewBody(), 409, 'ARCHIVED_YEAR');
      const afterWrites = await base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
      assertEqual(afterWrites, beforeWrites, 'archived-year rejection writes nothing');
      await base.enrollProSchoolYearMirror.update({
        where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId } },
        data: { isArchived: false, archivedAt: null, archivedBy: null, archiveReason: null },
      });
    }
  } finally {
    section('R7. fixture cleanup (zero residue)');
    if (server) {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
    if (fixtureSchoolId) {
      await base.$transaction(async (tx: any) => {
        await tx.offeringTermAssignment.deleteMany({ where: { offering: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } } });
        await tx.subjectSectionOwnership.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
        await tx.schoolYearOffering.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
        await tx.facultySubject.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
        await tx.teachingLoadCycle.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
        await tx.schoolYearTermConfig.deleteMany({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } });
        await tx.sectionMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
        await tx.facultyMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
        await tx.subject.deleteMany({ where: { schoolId: fixtureSchoolId } });
        await tx.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
        await tx.auditLog.deleteMany({ where: { schoolId: fixtureSchoolId } });
        await tx.school.delete({ where: { id: fixtureSchoolId } });
      });
    }
    const residue = await base.$transaction(async (tx: any) => {
      const [schools, mirrors, ownerships, facultySubjects, offerings, sections, faculty, subjects, cycles, audits] = await Promise.all([
        tx.school.count({ where: { id: fixtureSchoolId } }),
        tx.enrollProSchoolYearMirror.count({ where: { schoolId: fixtureSchoolId } }),
        tx.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId } }),
        tx.facultySubject.count({ where: { schoolId: fixtureSchoolId } }),
        tx.schoolYearOffering.count({ where: { schoolId: fixtureSchoolId } }),
        tx.sectionMirror.count({ where: { schoolId: fixtureSchoolId } }),
        tx.facultyMirror.count({ where: { schoolId: fixtureSchoolId } }),
        tx.subject.count({ where: { schoolId: fixtureSchoolId } }),
        tx.teachingLoadCycle.count({ where: { schoolId: fixtureSchoolId } }),
        tx.auditLog.count({ where: { schoolId: fixtureSchoolId } }),
      ]);
      return [schools, mirrors, ownerships, facultySubjects, offerings, sections, faculty, subjects, cycles, audits];
    });
    assertEqual(residue.reduce((sum: number, value: number) => sum + value, 0), 0, 'zero residue across all fixture-scoped models');
  }

  console.log(`\nRESULT: ${passCount} passed, ${failCount} failed`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(2);
});
