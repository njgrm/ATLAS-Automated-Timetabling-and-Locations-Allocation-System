/**
 * Department authority gate tests (TL-C01R4A section E).
 *
 * Failing-first contract (new behavior, RED before the fix):
 *  1. system token cannot execute operator apply;
 *  2. JWT with missing schoolId is rejected;
 *  3. cross-school JWT is rejected;
 *  4. fractional, infinite, string-junk, zero and negative school IDs are typed 400;
 *  5. in-place label value update invalidates the revision despite unchanged counts/createdAt;
 *  6. concurrent change during an otherwise unchanged replay is rejected;
 *  7. unrelated scoped row change invalidates the transaction;
 *  8. exact unchanged replay succeeds with zero writes after transactional revalidation;
 *  9. artifact byte hash matches its byte-hash sidecar;
 * 10. approval target equals the preview fingerprint accepted by the service.
 *
 * Plus recorder sensitivity and zero-residue fixture proof. Service-level gates
 * run against a disposable fixture school; route-level gates boot the real
 * Express app on an ephemeral port with hand-signed JWTs.
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

const WRITE_ACTIONS = new Set([
  'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany',
  'executeRaw', 'queryRaw',
]);

const LABELS = [
  { code: 'AP', label: 'Araling Panlipunan' },
  { code: 'ENG', label: 'English' },
  { code: 'ESP', label: 'Edukasyon sa Pagpapakatao' },
  { code: 'FIL', label: 'Filipino' },
  { code: 'MAPEH', label: 'MAPEH' },
  { code: 'MATH', label: 'Mathematics' },
  { code: 'SCI', label: 'Science' },
  { code: 'TLE', label: 'Technology and Livelihood Education' },
];

const recorded: Array<{ model?: string; action: string }> = [];
function writes() {
  return recorded.filter((stmt) => WRITE_ACTIONS.has(stmt.action));
}
function resetRecording() {
  recorded.length = 0;
}

async function main() {
  loadServerEnv();
  if (!process.env.DATABASE_URL) {
    console.error('[FAIL] DATABASE_URL is unavailable.');
    process.exit(1);
  }
  const prismaModule = await import('../lib/prisma.js');
  const dataContext = await import('../lib/data-context.js');
  const service = await import('../services/department-authority.service.js') as typeof import('../services/department-authority.service.js');

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
  const run = (fn: () => Promise<any>): Promise<any> =>
    (dataContext as any).withDataContext(instrumented, fn);

  // Capture the current shared-school authority without assuming a particular
  // deployment phase. The suite must prove it leaves that state unchanged,
  // whether the approved labels are not yet applied or already persisted.
  const liveDepartmentBefore = {
    aliases: await instrumented.departmentAlias.findMany({
      where: { schoolId: 1 },
      select: { alias: true, department: true },
      orderBy: { alias: 'asc' },
    }),
    labels: await instrumented.departmentLabel.findMany({
      where: { schoolId: 1 },
      select: { code: true, label: true },
      orderBy: { code: 'asc' },
    }),
  };

  const FIXTURE_NAME = 'TL-C01R4A FIXTURE SCHOOL — SAFE TO DELETE';
  let fixtureSchoolId = 0;
  try {
    const created = await instrumented.school.create({
      data: { name: FIXTURE_NAME, shortName: 'TLR4AX' },
      select: { id: true },
    });
    fixtureSchoolId = (created as any).id as number;
    assert(fixtureSchoolId > 0, `fixture school created (id=${fixtureSchoolId})`);
    resetRecording();

    section('E4. strict school-id parsing');
    const { parseStrictPositiveInt } = service as any;
    assert(typeof parseStrictPositiveInt === 'function', 'parseStrictPositiveInt is exported');
    if (typeof parseStrictPositiveInt === 'function') {
      assert(parseStrictPositiveInt('3') === 3, 'plain integer parses');
      assert(parseStrictPositiveInt(7) === 7, 'numeric integer parses');
      for (const [label, value] of [
        ['fractional', '3.5'], ['infinite', 'Infinity'], ['string-junk', 'abc'],
        ['empty', ''], ['zero', '0'], ['negative', '-4'], ['null', null], ['undefined', undefined],
        ['float-number', 2.5], ['NaN-number', NaN],
      ] as Array<[string, any]>) {
        let threw = false;
        try {
          parseStrictPositiveInt(value);
        } catch (e: any) {
          threw = e?.statusCode === 400;
        }
        assert(threw, `${label} (${JSON.stringify(String(value))}) is typed 400`);
      }
    }

    section('E2/E3. actor school required on preview and apply');
    for (const fn of ['previewDepartmentAuthority', 'applyDepartmentAuthority'] as const) {
      resetRecording();
      try {
        await run(() => (service as any)[fn === 'previewDepartmentAuthority'
          ? 'previewDepartmentAuthority'
          : 'applyDepartmentAuthority'](
          ...(fn === 'previewDepartmentAuthority'
            ? [fixtureSchoolId, { actorSchoolId: null, aliases: [], labels: [] }]
            : [{
              actorSchoolId: null, schoolId: fixtureSchoolId,
              expectedFingerprint: 'x', expectedSourceRevision: {},
              aliases: [], labels: [], confirmationText: 'APPLY DEPARTMENT AUTHORITY',
            }]),
        ));
        assert(false, `${fn} with missing actor school must throw`);
      } catch (e: any) {
        assert(e?.statusCode === 403, `${fn} missing actor school → typed 403 (got ${e?.statusCode}/${e?.code})`);
      }
      assert(writes().length === 0, `${fn} missing actor school performs zero writes`);
    }

    section('E5. in-place value change invalidates the revision (counts/createdAt unchanged)');
    const seedPreview: any = await run(() => (service as any).previewDepartmentAuthority(
      fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases: [], labels: [{ code: 'FIL', label: 'Filipino' }] },
    ));
    assert(typeof seedPreview?.sourceRevision?.revisionHash === 'string', 'revision carries canonical revisionHash');
    if (typeof seedPreview?.sourceRevision?.revisionHash === 'string') {
      await run(() => (service as any).applyDepartmentAuthority({
        actorSchoolId: fixtureSchoolId, schoolId: fixtureSchoolId,
        expectedFingerprint: seedPreview.fingerprint, expectedSourceRevision: seedPreview.sourceRevision,
        aliases: [], labels: [{ code: 'FIL', label: 'Filipino' }],
        confirmationText: (service as any).DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION,
      }));
      // In-place value change directly (test-only fixture write): same counts, same createdAt.
      const beforeUpdate: any = await run(() => (service as any).previewDepartmentAuthority(
        fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases: [], labels: [{ code: 'FIL', label: 'Filipino' }] },
      ));
      await instrumented.departmentLabel.updateMany({
        where: { schoolId: fixtureSchoolId, code: 'FIL' },
        data: { label: 'Wikang Filipino' },
      });
      const after: any = await run(() => (service as any).previewDepartmentAuthority(
        fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases: [], labels: [{ code: 'FIL', label: 'Filipino' }] },
      ));
      assert(after.sourceRevision.revisionHash !== beforeUpdate.sourceRevision.revisionHash, 'in-place value change flips revisionHash');
      assert(after.sourceRevision.labelRows === beforeUpdate.sourceRevision.labelRows, 'row counts unchanged (control holds)');
      resetRecording();
      try {
        await run(() => (service as any).applyDepartmentAuthority({
          actorSchoolId: fixtureSchoolId, schoolId: fixtureSchoolId,
          expectedFingerprint: seedPreview.fingerprint, expectedSourceRevision: seedPreview.sourceRevision,
          aliases: [], labels: [{ code: 'FIL', label: 'Filipino' }],
          confirmationText: (service as any).DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION,
        }));
        assert(false, 'stale revision apply must throw');
      } catch (e: any) {
        assert(e?.statusCode === 409, `stale revision → 409 (got ${e?.statusCode}/${e?.code})`);
      }
      assert(writes().length === 0, 'stale revision apply performs zero writes');
      await instrumented.departmentLabel.deleteMany({ where: { schoolId: fixtureSchoolId } });
      resetRecording();
    }

    section('E6/E7/E8. replay path with concurrent drift + clean replay');
    const p1 = await run(() => (service as any).previewDepartmentAuthority(
      fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases: [], labels: LABELS },
    ));
    const applied = await run(() => (service as any).applyDepartmentAuthority({
      actorSchoolId: fixtureSchoolId, schoolId: fixtureSchoolId,
      expectedFingerprint: p1.fingerprint, expectedSourceRevision: p1.sourceRevision,
      aliases: [], labels: LABELS,
      confirmationText: (service as any).DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION,
    }));
    assert(applied.created.length === 8, 'eight labels applied');
    // Concurrent unrelated scoped change: one extra alias row.
    await instrumented.departmentAlias.create({ data: { schoolId: fixtureSchoolId, alias: 'TMPX', department: 'SCI' } });
    resetRecording();
    try {
      await run(() => (service as any).applyDepartmentAuthority({
        actorSchoolId: fixtureSchoolId, schoolId: fixtureSchoolId,
        expectedFingerprint: p1.fingerprint, expectedSourceRevision: p1.sourceRevision,
        aliases: [], labels: LABELS,
        confirmationText: (service as any).DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION,
      }));
      assert(false, 'drifted replay must throw');
    } catch (e: any) {
      assert(e?.statusCode === 409, `concurrent drift on replay → 409 (got ${e?.code})`);
    }
    assert(writes().length === 0, 'drifted replay performs zero writes');
    await instrumented.departmentAlias.deleteMany({ where: { schoolId: fixtureSchoolId, alias: 'TMPX' } });
    resetRecording();
    const p2 = await run(() => (service as any).previewDepartmentAuthority(
      fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases: [], labels: LABELS },
    ));
    const replay = await run(() => (service as any).applyDepartmentAuthority({
      actorSchoolId: fixtureSchoolId, schoolId: fixtureSchoolId,
      expectedFingerprint: p2.fingerprint, expectedSourceRevision: p2.sourceRevision,
      aliases: [], labels: LABELS,
      confirmationText: (service as any).DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION,
    }));
    assert(replay.replayed === true, 'clean replay reports replayed:true');
    assert(replay.revalidatedInTransaction === true, 'replay passed in-transaction revalidation');
    assert(writes().length === 0, 'clean replay performs zero writes');

    section('E9. apply artifact byte hash matches its byte-hash sidecar');
    {
      const here = dirname(fileURLToPath(import.meta.url));
      const artifactPath = resolve(here, '../../../docs/verification/department-authority-apply-r4a.json');
      const sidecarPath = resolve(here, '../../../docs/verification/department-authority-apply-r4a.sha256');
      const { createHash } = await import('node:crypto');
      const raw = readFileSync(artifactPath, 'utf8');
      const doc = JSON.parse(raw);
      const byteSha = createHash('sha256').update(raw, 'utf8').digest('hex').toUpperCase();
      const sidecar = readFileSync(sidecarPath, 'utf8');
      assert(sidecar.includes(byteSha), 'sidecar carries the exact byte SHA of the artifact file');
      assert(!raw.includes('"byteSha256"'), 'artifact file contains no self-referential byte hash');
    }

    section('E10. approval target equals the preview fingerprint accepted by the service');
    {
      const here = dirname(fileURLToPath(import.meta.url));
      const doc = JSON.parse(readFileSync(resolve(here, '../../../docs/verification/department-authority-apply-r4a.json'), 'utf8'));
      const payload = doc.semanticPayload;
      const { buildDepartmentAuthorityFingerprint } = service as any;
      const recomputed = await buildDepartmentAuthorityFingerprint(
        payload.scope.schoolId,
        [],
        payload.proposedLabels.map((row: any) => ({ code: row.code, label: row.label })),
        payload.sourceRevision,
      );
      assert(recomputed === payload.previewFingerprint, 'service recomputes the artifact preview fingerprint exactly');
      assert(typeof payload.approvalSentence === 'string' && payload.approvalSentence.includes(payload.previewFingerprint), 'approval sentence binds the service-accepted preview fingerprint');
      assert(payload.authorizesMutation === false, 'artifact authorizes no mutation');
    }

    section('recorder sensitivity + zero-residue fixture proof');
    resetRecording();
    await instrumented.departmentLabel.create({ data: { schoolId: fixtureSchoolId, code: 'TMP', label: 'Tmp' } });
    assert(writes().some((w) => w.model === 'DepartmentLabel' && w.action === 'create'), 'recorder flags direct writes');
    await instrumented.departmentLabel.deleteMany({ where: { schoolId: fixtureSchoolId, code: 'TMP' } });
    resetRecording();

    section('E1–E4. real-route authentication, scope, and parsing gates');
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
      const base = `http://127.0.0.1:${port}`;
      // Clean fixture slate for route proofs (fixture-scoped deletes only).
      await instrumented.departmentAlias.deleteMany({ where: { schoolId: fixtureSchoolId } });
      await instrumented.departmentLabel.deleteMany({ where: { schoolId: fixtureSchoolId } });
      const officerJwt = (schoolId: number | null) => signJwt(
        schoolId == null
          ? { userId: 9001, role: 'officer', authSource: 'local' }
          : { userId: 9001, role: 'officer', authSource: 'local', schoolId },
      );
      async function callRoute(name: string, method: string, path: string, token: string | null, body: unknown, expectStatus: number, expectCode?: string) {
        const res = await fetch(base + path, {
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
      const previewBody = { schoolId: fixtureSchoolId, aliases: [], labels: LABELS };
      const applyBase = (extra: Record<string, unknown>) => ({
        schoolId: fixtureSchoolId,
        expectedFingerprint: '0'.repeat(64),
        expectedSourceRevision: {},
        aliases: [], labels: [],
        confirmationText: 'APPLY DEPARTMENT AUTHORITY',
        ...extra,
      });
      // E1: system token cannot execute operator apply (JWT-only route).
      await callRoute('E1 system-token apply rejected', 'POST', '/api/v1/faculty-assignments/department-authority/apply', systemToken, applyBase({}), 401);
      // E1b: system token cannot preview either.
      await callRoute('E1b system-token preview rejected', 'POST', '/api/v1/faculty-assignments/department-authority/preview', systemToken, previewBody, 401);
      // E2: JWT with missing schoolId is rejected.
      await callRoute('E2 missing actor school rejected', 'POST', '/api/v1/faculty-assignments/department-authority/apply', officerJwt(null), applyBase({}), 403, 'ACTOR_SCHOOL_REQUIRED');
      // E3: cross-school JWT is rejected.
      await callRoute('E3 cross-school JWT rejected', 'POST', '/api/v1/faculty-assignments/department-authority/apply', officerJwt(999997), applyBase({}), 403, 'SCHOOL_MISMATCH');
      // E4: malformed school IDs are typed 400 on GET and POST preview.
      for (const [label, value] of [
        ['fractional', '3.5'], ['infinite', 'Infinity'], ['string-junk', 'abc'],
        ['zero', '0'], ['negative', '-4'], ['empty', ''],
      ] as Array<[string, string]>) {
        await callRoute(`E4 GET schoolId=${label} rejected`, 'GET', `/api/v1/faculty-assignments/department-authority?schoolId=${encodeURIComponent(value)}`, officerJwt(fixtureSchoolId), undefined, 400, 'INVALID_PARAM');
        await callRoute(`E4 preview schoolId=${label} rejected`, 'POST', '/api/v1/faculty-assignments/department-authority/preview', officerJwt(fixtureSchoolId), { ...previewBody, schoolId: value }, 400, 'INVALID_PARAM');
      }
      // GET retains documented integration-token read access, school-scoped.
      {
        const res = await fetch(`${base}/api/v1/faculty-assignments/department-authority?schoolId=${fixtureSchoolId}`, {
          headers: { 'X-Integration-Key': systemToken },
        });
        const json = await res.json().catch(() => ({}));
        assert(res.status === 200 && (json as any).schoolId === fixtureSchoolId, 'system-token GET returns the requested school scope');
        assert(Array.isArray((json as any).labels), 'system-token GET returns label rows');
      }
      // Positive route control: officer JWT preview succeeds through the real route.
      {
        const json = await callRoute('officer preview succeeds', 'POST', '/api/v1/faculty-assignments/department-authority/preview', officerJwt(fixtureSchoolId), previewBody, 200);
        assert(Array.isArray((json as any).changes), 'officer preview returns changes');
      }
      // R4B: numeric-string schoolId carries the identical contract on preview and apply.
      {
        const stringPreview: any = await callRoute('R4B string-ID preview succeeds', 'POST', '/api/v1/faculty-assignments/department-authority/preview', officerJwt(fixtureSchoolId), { ...previewBody, schoolId: String(fixtureSchoolId) }, 200);
        const numericPreview: any = await callRoute('R4B numeric-ID preview succeeds', 'POST', '/api/v1/faculty-assignments/department-authority/preview', officerJwt(fixtureSchoolId), previewBody, 200);
        assert(stringPreview.fingerprint === numericPreview.fingerprint, 'string-ID and numeric-ID previews share one fingerprint');
        assert(stringPreview.schoolId === fixtureSchoolId && numericPreview.schoolId === fixtureSchoolId, 'both previews scope to the fixture school');
        const applied: any = await callRoute('R4B string-ID apply succeeds', 'POST', '/api/v1/faculty-assignments/department-authority/apply', officerJwt(fixtureSchoolId), {
          schoolId: String(fixtureSchoolId),
          expectedFingerprint: stringPreview.fingerprint,
          expectedSourceRevision: stringPreview.sourceRevision,
          aliases: [], labels: LABELS,
          confirmationText: 'APPLY DEPARTMENT AUTHORITY',
        }, 200);
        assert(applied.created?.length === 8, 'string-ID apply created the eight labels (normalize-once boundary holds)');
        assert(applied.schoolId === fixtureSchoolId, 'apply response scoped to the fixture school');
        // Restore the fixture to empty for the remaining proofs.
        await instrumented.departmentLabel.deleteMany({ where: { schoolId: fixtureSchoolId } });
      }
      // R4B: empty/idempotent apply exercises the route with zero writes.
      {
        const emptyPreview: any = await callRoute('R4B empty preview succeeds', 'POST', '/api/v1/faculty-assignments/department-authority/preview', officerJwt(fixtureSchoolId), { schoolId: String(fixtureSchoolId), aliases: [], labels: [] }, 200);
        const before = await instrumented.departmentLabel.count({ where: { schoolId: fixtureSchoolId } });
        const replayed: any = await callRoute('R4B empty apply replays', 'POST', '/api/v1/faculty-assignments/department-authority/apply', officerJwt(fixtureSchoolId), {
          schoolId: String(fixtureSchoolId),
          expectedFingerprint: emptyPreview.fingerprint,
          expectedSourceRevision: emptyPreview.sourceRevision,
          aliases: [], labels: [],
          confirmationText: 'APPLY DEPARTMENT AUTHORITY',
        }, 200);
        const after = await instrumented.departmentLabel.count({ where: { schoolId: fixtureSchoolId } });
        assert(replayed.replayed === true, 'empty apply reports replayed:true through the route');
        assert(before === 0 && after === 0, 'empty apply left zero rows (zero writes on the route)');
      }
      // R4B: malformed / missing / cross-school / missing-actor inputs stay typed 4xx on apply.
      {
        const validPreview: any = await callRoute('R4B apply-matrix preview', 'POST', '/api/v1/faculty-assignments/department-authority/preview', officerJwt(fixtureSchoolId), previewBody, 200);
        const validApply = {
          schoolId: fixtureSchoolId,
          expectedFingerprint: validPreview.fingerprint,
          expectedSourceRevision: validPreview.sourceRevision,
          aliases: [], labels: LABELS,
          confirmationText: 'APPLY DEPARTMENT AUTHORITY',
        };
        for (const [label, value] of [
          ['fractional', '3.5'], ['infinite', 'Infinity'], ['string-junk', 'abc'],
          ['zero', '0'], ['negative', '-4'], ['empty', ''],
        ] as Array<[string, string]>) {
          await callRoute(`R4B apply schoolId=${label} rejected`, 'POST', '/api/v1/faculty-assignments/department-authority/apply', officerJwt(fixtureSchoolId), { ...validApply, schoolId: value }, 400, 'INVALID_PARAM');
        }
        await callRoute('R4B apply missing schoolId rejected', 'POST', '/api/v1/faculty-assignments/department-authority/apply', officerJwt(fixtureSchoolId), { ...validApply, schoolId: undefined }, 400, 'INVALID_PARAM');
        await callRoute('R4B apply cross-school rejected', 'POST', '/api/v1/faculty-assignments/department-authority/apply', officerJwt(999997), validApply, 403, 'SCHOOL_MISMATCH');
        await callRoute('R4B apply missing-actor rejected', 'POST', '/api/v1/faculty-assignments/department-authority/apply', officerJwt(null), validApply, 403, 'ACTOR_SCHOOL_REQUIRED');
        await callRoute('R4B apply system-token rejected', 'POST', '/api/v1/faculty-assignments/department-authority/apply', systemToken, validApply, 401);
      }
      // R4B: disposable route fixtures must not alter the current live-school
      // authority state. Do not hardcode a pre-apply 0/0 lifecycle snapshot.
      {
        const liveDepartmentAfter = {
          aliases: await instrumented.departmentAlias.findMany({
            where: { schoolId: 1 },
            select: { alias: true, department: true },
            orderBy: { alias: 'asc' },
          }),
          labels: await instrumented.departmentLabel.findMany({
            where: { schoolId: 1 },
            select: { code: true, label: true },
            orderBy: { code: 'asc' },
          }),
        };
        assert(
          JSON.stringify(liveDepartmentAfter) === JSON.stringify(liveDepartmentBefore),
          `live school department authority unchanged during suite (aliases=${liveDepartmentAfter.aliases.length}, labels=${liveDepartmentAfter.labels.length})`,
        );
      }
    } finally {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
  } finally {
    if (fixtureSchoolId > 0) {
      await instrumented.departmentAlias.deleteMany({ where: { schoolId: fixtureSchoolId } }).catch(() => {});
      await instrumented.departmentLabel.deleteMany({ where: { schoolId: fixtureSchoolId } }).catch(() => {});
      await instrumented.school.deleteMany({ where: { id: fixtureSchoolId, name: FIXTURE_NAME } }).catch(() => {});
      const residueAliases = await instrumented.departmentAlias.count({ where: { schoolId: fixtureSchoolId } }).catch(() => -1);
      const residueLabels = await instrumented.departmentLabel.count({ where: { schoolId: fixtureSchoolId } }).catch(() => -1);
      const residueSchool = await instrumented.school.count({ where: { id: fixtureSchoolId } }).catch(() => -1);
      assert(residueAliases === 0 && residueLabels === 0 && residueSchool === 0, `zero residue (aliases=${residueAliases}, labels=${residueLabels}, school=${residueSchool})`);
    }
    try {
      await instrumented.$disconnect();
    } catch {}
  }

  console.log(`\n=== Department Authority Gate Tests ===`);
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  if (failCount > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`[FAIL] department authority gate suite crashed: ${String(error?.message ?? error).slice(0, 300)}`);
  process.exit(1);
});
