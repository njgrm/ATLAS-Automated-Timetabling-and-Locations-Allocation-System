/**
 * TT-TL-MODULES-C04R1 (F2) — capability-override mounted-route authority suite.
 *
 * Failing-first contract on the real Express app with hand-signed JWTs. Every
 * capability-override route must enforce strict positive school/year parsing and
 * actor-school equality before any service dispatch, and the only mutation path
 * is the previewed, fingerprinted, exactly-confirmed apply. Direct PUT/DELETE
 * are retired with typed 410.
 *
 * Covered rows:
 *   F2-a missing actor school                → 403 ACTOR_SCHOOL_REQUIRED, zero writes
 *   F2-b malformed / non-positive school or year → 400 INVALID_PARAM, zero writes
 *   F2-c cross-school actor                  → 403 SCHOOL_MISMATCH, zero writes
 *   F2-d archived school year                → 409 ARCHIVED_YEAR_READ_ONLY, zero writes
 *   F2-e stale fingerprint                   → 409 FINGERPRINT_MISMATCH, zero writes
 *   F2-f stale source revision (concurrent)  → 409 CAPABILITY_OVERRIDE_SOURCE_DRIFT, zero writes
 *   F2-g duplicate replay                    → second apply replayed:true, zero new writes
 *   F2-h retired direct PUT/DELETE           → 410 typed code, zero writes
 *   F2-i system token                        → 401 on every route, zero writes
 *   F2-j positive control                    → exactly one policy config + one audit row
 *
 * All rows live in a disposable fixture school/year and every fixture row is
 * removed in `finally` with a zero-residue assertion. Live school 1 and any live
 * year are never touched. Run with `npx tsx <this-file>` against a reachable
 * database supplied through DATABASE_URL.
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

const FIXTURE_NAME = 'TT-TL-C04R1 CAPABILITY FIXTURE — SAFE TO DELETE';
const ACTIVE_YEAR = 990041;
const ARCHIVED_YEAR = 990042;
const OTHER_YEAR = 990043;
const FIXTURE_FACULTY_ID = 990041;
const OTHER_FACULTY_ID = 990042;

async function main() {
  loadServerEnv();
  if (!process.env.DATABASE_URL) {
    console.error('[FAIL] DATABASE_URL is unavailable.');
    process.exit(1);
  }
  const prismaModule = await import('../lib/prisma.js');
  const instrumented = (prismaModule as any).createTestPrismaClient();

  let fixtureSchoolId = 0;
  try {
    const created = await instrumented.school.create({
      data: { name: FIXTURE_NAME, shortName: 'TTC04R1C' },
      select: { id: true },
    });
    fixtureSchoolId = created.id as number;
    assert(fixtureSchoolId > 0, `fixture school created (id=${fixtureSchoolId})`);

    await instrumented.enrollProSchoolYearMirror.createMany({
      data: [
        { schoolId: fixtureSchoolId, enrollProSchoolYearId: ACTIVE_YEAR, yearLabel: 'FIXTURE-ACTIVE', isActive: true, isArchived: false },
        { schoolId: fixtureSchoolId, enrollProSchoolYearId: ARCHIVED_YEAR, yearLabel: 'FIXTURE-ARCHIVED', isActive: false, isArchived: true },
        { schoolId: fixtureSchoolId, enrollProSchoolYearId: OTHER_YEAR, yearLabel: 'FIXTURE-HISTORICAL', isActive: false, isArchived: false },
      ],
    });

    const auditCount = () => instrumented.auditLog.count({ where: { schoolId: fixtureSchoolId } });
    const policyCount = () => instrumented.schedulingPolicy.count({ where: { schoolId: fixtureSchoolId } });

    section('boot the real app with hand-signed JWTs');
    const app = (await import('../app.js')).default;
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET as string;
    assert(typeof secret === 'string' && secret.length > 0, 'JWT secret configured for route tests');
    const signJwt = (payload: Record<string, unknown>): string =>
      (jwt.default as any).sign(payload, secret, { expiresIn: '5m' });
    const systemToken = (process.env.ATLAS_SYSTEM_TOKEN ?? '').trim();
    assert(systemToken.length > 0, 'system token configured for route tests');

    const server = await new Promise<any>((resolveServer, rejectServer) => {
      const listener = app.listen(0, () => resolveServer(listener));
      listener.on('error', rejectServer);
    });
    try {
      const address = server.address();
      const port = typeof address === 'object' && address ? (address as any).port : 0;
      assert(port > 0, `ephemeral test server listening (port=${port})`);
      const baseUrl = `http://127.0.0.1:${port}`;
      const officerJwt = (schoolId: number | null) => signJwt(
        schoolId == null
          ? { userId: 9001, role: 'officer', authSource: 'local' }
          : { userId: 9001, role: 'officer', authSource: 'local', schoolId },
      );

      async function callRoute(
        name: string,
        method: string,
        path: string,
        token: string | null,
        body: unknown,
        expectStatus: number,
        expectCode?: string,
        header?: Record<string, string>,
      ) {
        const res = await fetch(baseUrl + path, {
          method,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(header ?? {}),
            'Content-Type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        const okStatus = res.status === expectStatus;
        const okCode = expectCode == null || (json as any).code === expectCode;
        assert(okStatus && okCode, `${name} → ${res.status}/${(json as any).code ?? 'no-code'} (expected ${expectStatus}${expectCode ? `/${expectCode}` : ''})`);
        return json;
      }

      const GET_PATH = `/api/v1/faculty-assignments/capability-overrides?schoolId=${fixtureSchoolId}&schoolYearId=${ACTIVE_YEAR}`;
      const PREVIEW_PATH = '/api/v1/faculty-assignments/capability-overrides/preview';
      const APPLY_PATH = '/api/v1/faculty-assignments/capability-overrides/apply';
      const mutation = { action: 'SET', facultyId: FIXTURE_FACULTY_ID, subjectCode: 'MATH', specializationCode: null, specializationLabel: null, note: null };

      section('F2-a/F2-i missing actor school and system token');
      for (const [name, method, path, body] of [
        ['GET', 'GET', GET_PATH, undefined],
        ['preview', 'POST', PREVIEW_PATH, { schoolId: fixtureSchoolId, schoolYearId: ACTIVE_YEAR, mutation }],
        ['apply', 'POST', APPLY_PATH, { schoolId: fixtureSchoolId, schoolYearId: ACTIVE_YEAR, mutation, expectedFingerprint: 'x', expectedSourceRevision: {}, confirmationText: 'APPLY CAPABILITY OVERRIDE' }],
      ] as Array<[string, string, string, unknown]>) {
        await callRoute(`F2-a ${name} missing actor school`, method, path, officerJwt(null), body, 403, 'ACTOR_SCHOOL_REQUIRED');
        await callRoute(`F2-i ${name} system token rejected`, method, path, systemToken, body, 401);
      }
      assert((await auditCount()) === 0 && (await policyCount()) === 0, 'F2-a/F2-i zero writes');

      section('F2-b malformed school/year identifiers');
      for (const [label, value] of [
        ['fractional', '3.5'], ['infinite', 'Infinity'], ['string-junk', 'abc'],
        ['zero', '0'], ['negative', '-4'], ['empty', ''],
      ] as Array<[string, string]>) {
        await callRoute(`F2-b GET schoolId=${label}`, 'GET', `/api/v1/faculty-assignments/capability-overrides?schoolId=${encodeURIComponent(value)}&schoolYearId=${ACTIVE_YEAR}`, officerJwt(fixtureSchoolId), undefined, 400, 'INVALID_PARAM');
        await callRoute(`F2-b GET schoolYearId=${label}`, 'GET', `/api/v1/faculty-assignments/capability-overrides?schoolId=${fixtureSchoolId}&schoolYearId=${encodeURIComponent(value)}`, officerJwt(fixtureSchoolId), undefined, 400, 'INVALID_PARAM');
        await callRoute(`F2-b preview schoolId=${label}`, 'POST', PREVIEW_PATH, officerJwt(fixtureSchoolId), { schoolId: value, schoolYearId: ACTIVE_YEAR, mutation }, 400, 'INVALID_PARAM');
        await callRoute(`F2-b apply schoolYearId=${label}`, 'POST', APPLY_PATH, officerJwt(fixtureSchoolId), { schoolId: fixtureSchoolId, schoolYearId: value, mutation, expectedFingerprint: 'x', expectedSourceRevision: {}, confirmationText: 'APPLY CAPABILITY OVERRIDE' }, 400, 'INVALID_PARAM');
      }
      await callRoute('F2-b preview missing schoolId', 'POST', PREVIEW_PATH, officerJwt(fixtureSchoolId), { schoolYearId: ACTIVE_YEAR, mutation }, 400, 'INVALID_PARAM');
      await callRoute('F2-b preview missing mutation', 'POST', PREVIEW_PATH, officerJwt(fixtureSchoolId), { schoolId: fixtureSchoolId, schoolYearId: ACTIVE_YEAR }, 400, 'INVALID_CAPABILITY_OVERRIDE');
      assert((await auditCount()) === 0 && (await policyCount()) === 0, 'F2-b zero writes');

      section('F2-c cross-school actor');
      await callRoute('F2-c cross-school GET', 'GET', GET_PATH, officerJwt(999997), undefined, 403, 'SCHOOL_MISMATCH');
      await callRoute('F2-c cross-school preview', 'POST', PREVIEW_PATH, officerJwt(999997), { schoolId: fixtureSchoolId, schoolYearId: ACTIVE_YEAR, mutation }, 403, 'SCHOOL_MISMATCH');
      await callRoute('F2-c cross-school apply', 'POST', APPLY_PATH, officerJwt(999997), { schoolId: fixtureSchoolId, schoolYearId: ACTIVE_YEAR, mutation, expectedFingerprint: 'x', expectedSourceRevision: {}, confirmationText: 'APPLY CAPABILITY OVERRIDE' }, 403, 'SCHOOL_MISMATCH');
      assert((await auditCount()) === 0 && (await policyCount()) === 0, 'F2-c zero writes');

      section('F2-d archived / non-active school year');
      await callRoute('F2-d archived preview', 'POST', PREVIEW_PATH, officerJwt(fixtureSchoolId), { schoolId: fixtureSchoolId, schoolYearId: ARCHIVED_YEAR, mutation }, 409, 'ARCHIVED_YEAR_READ_ONLY');
      await callRoute('F2-d archived apply', 'POST', APPLY_PATH, officerJwt(fixtureSchoolId), { schoolId: fixtureSchoolId, schoolYearId: ARCHIVED_YEAR, mutation, expectedFingerprint: 'x', expectedSourceRevision: {}, confirmationText: 'APPLY CAPABILITY OVERRIDE' }, 409, 'ARCHIVED_YEAR_READ_ONLY');
      await callRoute('F2-d historical year rejected', 'POST', PREVIEW_PATH, officerJwt(fixtureSchoolId), { schoolId: fixtureSchoolId, schoolYearId: OTHER_YEAR, mutation }, 409, 'INACTIVE_HISTORICAL_YEAR');
      assert((await auditCount()) === 0 && (await policyCount()) === 0, 'F2-d zero writes');

      section('F2-h retired direct PUT / DELETE');
      await callRoute('F2-h PUT retired', 'PUT', '/api/v1/faculty-assignments/capability-overrides', officerJwt(fixtureSchoolId), { schoolId: fixtureSchoolId, schoolYearId: ACTIVE_YEAR, mutation }, 410, 'CAPABILITY_OVERRIDE_DIRECT_MUTATION_RETIRED');
      await callRoute('F2-h DELETE retired', 'DELETE', '/api/v1/faculty-assignments/capability-overrides', officerJwt(fixtureSchoolId), undefined, 410, 'CAPABILITY_OVERRIDE_DIRECT_MUTATION_RETIRED');
      assert((await auditCount()) === 0 && (await policyCount()) === 0, 'F2-h zero writes');

      section('F2-j positive control, F2-e fingerprint, F2-f drift, F2-g replay');
      const previewBody = { schoolId: fixtureSchoolId, schoolYearId: ACTIVE_YEAR, mutation };
      const preview = await callRoute('F2-j preview succeeds', 'POST', PREVIEW_PATH, officerJwt(fixtureSchoolId), previewBody, 200);
      assert(typeof preview.fingerprint === 'string' && preview.fingerprint.length > 0, 'preview returns a fingerprint');
      assert(preview.confirmationText === 'APPLY CAPABILITY OVERRIDE', 'preview returns the server-issued confirmation text');
      assert(preview.change?.action === 'create', 'preview classifies the first override as create');
      assert((await auditCount()) === 0 && (await policyCount()) === 0, 'preview writes nothing');

      // F2-e: wrong fingerprint with the correct source revision.
      await callRoute('F2-e stale fingerprint rejected', 'POST', APPLY_PATH, officerJwt(fixtureSchoolId), {
        ...previewBody,
        expectedFingerprint: '0'.repeat(64),
        expectedSourceRevision: preview.sourceRevision,
        confirmationText: 'APPLY CAPABILITY OVERRIDE',
      }, 409, 'FINGERPRINT_MISMATCH');
      assert((await auditCount()) === 0 && (await policyCount()) === 0, 'F2-e zero writes');

      // F2-g: exact apply writes exactly one policy config + one audit row.
      const applied = await callRoute('F2-j apply succeeds', 'POST', APPLY_PATH, officerJwt(fixtureSchoolId), {
        ...previewBody,
        expectedFingerprint: preview.fingerprint,
        expectedSourceRevision: preview.sourceRevision,
        confirmationText: preview.confirmationText,
      }, 200);
      assert(applied.replayed === false && applied.revalidatedInTransaction === true, 'apply writes and reports transactional revalidation');
      assert((await policyCount()) === 1 && (await auditCount()) === 1, 'apply wrote exactly one policy config + one audit row');

      // F2-g: duplicate replay is zero-write. The first apply legitimately
      // advances the source revision, so a replay must re-preview (now
      // classified `unchanged`) and then apply with the fresh revision.
      const replayPreview = await callRoute('F2-g replay preview', 'POST', PREVIEW_PATH, officerJwt(fixtureSchoolId), previewBody, 200);
      assert(replayPreview.change?.action === 'unchanged', 'replay preview classifies the override as unchanged');
      const replayed = await callRoute('F2-g duplicate replay', 'POST', APPLY_PATH, officerJwt(fixtureSchoolId), {
        ...previewBody,
        expectedFingerprint: replayPreview.fingerprint,
        expectedSourceRevision: replayPreview.sourceRevision,
        confirmationText: replayPreview.confirmationText,
      }, 200);
      assert(replayed.replayed === true, 'duplicate apply is a zero-write replay');
      assert((await policyCount()) === 1 && (await auditCount()) === 1, 'F2-g replay wrote nothing');

      // F2-f: concurrent source change between preview and apply fails closed.
      const driftPreview = await callRoute('F2-f drift preview', 'POST', PREVIEW_PATH, officerJwt(fixtureSchoolId), {
        schoolId: fixtureSchoolId, schoolYearId: ACTIVE_YEAR,
        mutation: { action: 'SET', facultyId: OTHER_FACULTY_ID, subjectCode: 'SCI', specializationCode: null, specializationLabel: null, note: null },
      }, 200);
      // Interleave: an unrelated capability-override write changes the source revision.
      const policyRow = await instrumented.schedulingPolicy.findFirst({ where: { schoolId: fixtureSchoolId, schoolYearId: ACTIVE_YEAR } });
      await instrumented.schedulingPolicy.update({
        where: { id: policyRow.id },
        data: { constraintConfig: { ...(policyRow.constraintConfig as object), __interleave: true } },
      });
      await callRoute('F2-f concurrent source change rejected', 'POST', APPLY_PATH, officerJwt(fixtureSchoolId), {
        schoolId: fixtureSchoolId, schoolYearId: ACTIVE_YEAR,
        mutation: { action: 'SET', facultyId: OTHER_FACULTY_ID, subjectCode: 'SCI', specializationCode: null, specializationLabel: null, note: null },
        expectedFingerprint: driftPreview.fingerprint,
        expectedSourceRevision: driftPreview.sourceRevision,
        confirmationText: driftPreview.confirmationText,
      }, 409, 'CAPABILITY_OVERRIDE_SOURCE_DRIFT');
      assert((await auditCount()) === 1, 'F2-f concurrent change wrote no audit row');

      section('zero-residue fixture cleanup');
      const leftoverAudit = await auditCount();
      const leftoverPolicy = await policyCount();
      assert(leftoverAudit === 1 && leftoverPolicy === 1, `fixture writes accounted for (audit=${leftoverAudit}, policy=${leftoverPolicy})`);
    } finally {
      server.close();
    }
  } finally {
    if (fixtureSchoolId > 0) {
      await instrumented.auditLog.deleteMany({ where: { schoolId: fixtureSchoolId } });
      await instrumented.schedulingPolicy.deleteMany({ where: { schoolId: fixtureSchoolId } });
      await instrumented.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
      await instrumented.school.deleteMany({ where: { id: fixtureSchoolId } });
    }
  }

  const residueSchool = await instrumented.school.count({ where: { name: FIXTURE_NAME } });
  const residueMirrors = await instrumented.enrollProSchoolYearMirror.count({ where: { schoolId: fixtureSchoolId } });
  const residuePolicies = await instrumented.schedulingPolicy.count({ where: { schoolId: fixtureSchoolId } });
  const residueAudit = await instrumented.auditLog.count({ where: { schoolId: fixtureSchoolId } });
  assert(
    residueSchool === 0 && residueMirrors === 0 && residuePolicies === 0 && residueAudit === 0,
    `zero residue (school=${residueSchool}, mirrors=${residueMirrors}, policies=${residuePolicies}, audit=${residueAudit})`,
  );

  console.log(`\n${passCount} passed, ${failCount} failed`);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(2);
});
