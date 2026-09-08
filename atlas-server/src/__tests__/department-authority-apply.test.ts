/**
 * Department authority preview/apply tests (TL-C01R4.3).
 *
 * Uses a DISPOSABLE fixture school (created here, fully removed in `finally`
 * with a zero-residue assertion). No live school/year data is touched: every
 * write is scoped to the fixture school and every test proves its writes.
 *
 * Proofs: exact 8-label/0-alias preview; order-independent fingerprint;
 * missing-confirmation / forged-fingerprint / cross-school / drift zero-write
 * gates; conflicting-label whole-transaction abort; concurrent drift rejection;
 * apply creates only scoped labels; idempotent replay; rollback receipt scope;
 * no writes outside department_aliases/department_labels; recorder negative
 * control.
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
  const run = <T>(fn: () => Promise<T>): Promise<T> =>
    (dataContext as any).withDataContext(instrumented, fn);

  const FIXTURE_NAME = 'TL-C01R4 FIXTURE SCHOOL — SAFE TO DELETE';
  let fixtureSchoolId = 0;
  try {
    section('fixture setup (disposable school, zero live impact)');
    const created = await instrumented.school.create({
      data: { name: FIXTURE_NAME, shortName: 'TLR4FX' },
      select: { id: true },
    });
    fixtureSchoolId = (created as any).id as number;
    assert(fixtureSchoolId > 0, `fixture school created (id=${fixtureSchoolId})`);
    resetRecording();

    section('1. preview returns exactly eight label creates and zero aliases');
    const preview = await run(() => service.previewDepartmentAuthority(fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases: [], labels: LABELS }));
    assert(preview.changes.filter((c) => c.kind === 'label' && c.action === 'create').length === 8, 'eight label creates');
    assert(preview.changes.filter((c) => c.kind === 'alias').length === 0, 'zero alias rows');
    assert(preview.sourceRevision.aliasRows === 0 && preview.sourceRevision.labelRows === 0, 'empty source revision');
    assert(typeof preview.fingerprint === 'string' && preview.fingerprint.length === 64, '64-char fingerprint');
    const listed = await run(() => service.listDepartmentAuthority(fixtureSchoolId));
    assert(listed.aliases.length === 0 && listed.labels.length === 0, 'list shows empty authority');

    section('2. fingerprint is order-independent');
    const shuffled = await run(() => service.previewDepartmentAuthority(fixtureSchoolId, {
      actorSchoolId: fixtureSchoolId,
      aliases: [],
      labels: [...LABELS].reverse(),
    }));
    assert(shuffled.fingerprint === preview.fingerprint, 'shuffled input yields the identical fingerprint');

    const goodApply = {
      actorSchoolId: fixtureSchoolId,
      schoolId: fixtureSchoolId,
      expectedFingerprint: preview.fingerprint,
      expectedSourceRevision: preview.sourceRevision,
      aliases: [],
      labels: LABELS,
      confirmationText: service.DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION,
    };

    section('3. missing confirmation causes zero writes');
    resetRecording();
    try {
      await run(() => service.applyDepartmentAuthority({ ...goodApply, confirmationText: 'yes please' }));
      assert(false, 'missing confirmation must throw');
    } catch (e: any) {
      assert(e?.statusCode === 400 && e?.code === 'CONFIRMATION_REQUIRED', 'typed 400 CONFIRMATION_REQUIRED');
    }
    assert(writes().length === 0, 'zero writes on missing confirmation');

    section('4. forged fingerprint causes zero writes');
    resetRecording();
    try {
      await run(() => service.applyDepartmentAuthority({ ...goodApply, expectedFingerprint: '0'.repeat(64) }));
      assert(false, 'forged fingerprint must throw');
    } catch (e: any) {
      assert(e?.statusCode === 409 && e?.code === 'FINGERPRINT_MISMATCH', 'typed 409 FINGERPRINT_MISMATCH');
    }
    assert(writes().length === 0, 'zero writes on forged fingerprint');

    section('5. cross-school request causes zero writes');
    resetRecording();
    try {
      await run(() => service.applyDepartmentAuthority({ ...goodApply, actorSchoolId: 999998 }));
      assert(false, 'cross-school apply must throw');
    } catch (e: any) {
      assert(e?.statusCode === 403 && e?.code === 'SCHOOL_MISMATCH', 'typed 403 SCHOOL_MISMATCH');
    }
    assert(writes().length === 0, 'zero writes on cross-school request');

    section('6. source drift causes zero writes');
    resetRecording();
    // Real concurrent drift: a TMP row changes the canonical hash while counts
    // stay comparable. Fudged count-only differences must NOT gate (diagnostic only).
    await instrumented.departmentLabel.create({ data: { schoolId: fixtureSchoolId, code: 'TMPD', label: 'Tmp' } });
    resetRecording();
    try {
      await run(() => service.applyDepartmentAuthority({
        ...goodApply,
        expectedFingerprint: preview.fingerprint,
        expectedSourceRevision: preview.sourceRevision,
      }));
      assert(false, 'drifted revision must throw');
    } catch (e: any) {
      assert(e?.statusCode === 409 && e?.code === 'SOURCE_DRIFT', 'typed 409 SOURCE_DRIFT');
    }
    assert(writes().length === 0, 'zero writes on source drift');
    resetRecording();
    await instrumented.departmentLabel.deleteMany({ where: { schoolId: fixtureSchoolId, code: 'TMPD' } });
    resetRecording();

    section('7. conflicting existing label aborts the whole transaction');
    resetRecording();
    const seedPreview = await run(() => service.previewDepartmentAuthority(fixtureSchoolId, {
      actorSchoolId: fixtureSchoolId,
      aliases: [],
      labels: [{ code: 'FIL', label: 'Wikang Filipino' }],
    }));
    const seedConflict = await run(() => service.applyDepartmentAuthority({
      actorSchoolId: fixtureSchoolId,
      schoolId: fixtureSchoolId,
      expectedFingerprint: seedPreview.fingerprint,
      expectedSourceRevision: seedPreview.sourceRevision,
      aliases: [],
      labels: [{ code: 'FIL', label: 'Wikang Filipino' }],
      confirmationText: service.DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION,
    }));
    assert(seedConflict.created.length === 1, 'conflict seed row created');
    const rePreview = await run(() => service.previewDepartmentAuthority(fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases: [], labels: LABELS }));
    const filChange = rePreview.changes.find((c) => c.kind === 'label' && c.key === 'FIL');
    assert(filChange?.action === 'conflict', 'preview marks the divergent label as conflict');
    resetRecording();
    try {
      await run(() => service.applyDepartmentAuthority({
        ...goodApply,
        expectedFingerprint: rePreview.fingerprint,
        expectedSourceRevision: rePreview.sourceRevision,
      }));
      assert(false, 'conflicting apply must throw');
    } catch (e: any) {
      assert(e?.statusCode === 409 && e?.code === 'DEPARTMENT_AUTHORITY_CONFLICT', 'typed 409 DEPARTMENT_AUTHORITY_CONFLICT');
    }
    const afterConflict = await run(() => service.listDepartmentAuthority(fixtureSchoolId));
    assert(afterConflict.labels.length === 1, 'aborted transaction wrote nothing new (still exactly the seed row)');
    assert(writes().filter((w) => w.model === 'DepartmentLabel').length === 0, 'zero label writes on conflict abort');
    // Repair the seed back to the accepted value for the remaining proofs.
    resetRecording();
    await instrumented.departmentLabel.deleteMany({ where: { schoolId: fixtureSchoolId, code: 'FIL' } });
    resetRecording();

    section('8. concurrent preview/apply drift is rejected');
    const stalePreview = await run(() => service.previewDepartmentAuthority(fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases: [], labels: LABELS }));
    const concurrentPreview = await run(() => service.previewDepartmentAuthority(fixtureSchoolId, {
      actorSchoolId: fixtureSchoolId,
      aliases: [],
      labels: [{ code: 'SCI', label: 'Science' }],
    }));
    await run(() => service.applyDepartmentAuthority({
      actorSchoolId: fixtureSchoolId,
      schoolId: fixtureSchoolId,
      expectedFingerprint: concurrentPreview.fingerprint,
      expectedSourceRevision: concurrentPreview.sourceRevision,
      aliases: [],
      labels: [{ code: 'SCI', label: 'Science' }],
      confirmationText: service.DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION,
    }));
    resetRecording();
    try {
      await run(() => service.applyDepartmentAuthority({
        ...goodApply,
        expectedFingerprint: stalePreview.fingerprint,
        expectedSourceRevision: stalePreview.sourceRevision,
      }));
      assert(false, 'stale preview apply must throw');
    } catch (e: any) {
      assert(e?.statusCode === 409, `concurrent drift rejected with 409 (got ${e?.code})`);
    }
    assert(writes().length === 0, 'zero writes on concurrent drift');
    resetRecording();
    await instrumented.departmentLabel.deleteMany({ where: { schoolId: fixtureSchoolId } });
    resetRecording();

    section('9. successful apply creates only the eight scoped labels');
    const fresh = await run(() => service.previewDepartmentAuthority(fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases: [], labels: LABELS }));
    resetRecording();
    const applied = await run(() => service.applyDepartmentAuthority({
      ...goodApply,
      expectedFingerprint: fresh.fingerprint,
      expectedSourceRevision: fresh.sourceRevision,
    }));
    assert(applied.created.length === 8, 'eight rows created');
    assert(applied.conflicting.length === 0, 'no conflicts');
    assert(applied.replayed === false, 'first apply is not a replay');
    assert(applied.revalidatedInTransaction === true, 'apply passed in-transaction revalidation');
    const writtenModels = new Set(writes().map((w) => `${w.model}:${w.action}`));
    const allowed = new Set(['DepartmentLabel:create']);
    const outOfScope = Array.from(writtenModels).filter((entry) => !allowed.has(entry));
    assert(outOfScope.length === 0, `writes only department_labels creates (got ${JSON.stringify(Array.from(writtenModels))})`);
    const scoped = await instrumented.departmentLabel.findMany({ where: { schoolId: fixtureSchoolId }, select: { code: true, label: true } });
    assert(scoped.length === 8, 'exactly eight scoped label rows persisted');
    assert(applied.after.labels === 8 && applied.before.labels === 0, 'before/after counts exact');

    section('10. replay is an idempotent no-op');
    resetRecording();
    const replayPreview = await run(() => service.previewDepartmentAuthority(fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases: [], labels: LABELS }));
    assert(replayPreview.changes.every((c) => c.action === 'unchanged'), 're-preview marks all rows unchanged');
    const replay = await run(() => service.applyDepartmentAuthority({
      ...goodApply,
      expectedFingerprint: replayPreview.fingerprint,
      expectedSourceRevision: replayPreview.sourceRevision,
    }));
    assert(replay.replayed === true, 'replay reports replayed:true');
    assert(replay.revalidatedInTransaction === true, 'replay passed in-transaction revalidation');
    assert(replay.created.length === 0, 'replay creates nothing');
    assert(writes().length === 0, 'replay performs zero writes');

    section('transaction-conflict mapping + diagnostic-only counts');
    assert(service.isTransactionConflictError({ code: 'P2034' }) === true, 'P2034 maps to transaction conflict');
    assert(service.isTransactionConflictError({ code: 'P2002' }) === false, 'unique violation is not a transaction conflict');
    assert(service.isTransactionConflictError(null) === false, 'null is not a transaction conflict');
    {
      // Counts/maxCreatedAt are diagnostic: a forged revision carrying the CORRECT
      // hash but wrong counts still satisfies concurrency (hash is the authority).
      resetRecording();
      const forged = await run(() => service.previewDepartmentAuthority(fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases: [], labels: LABELS }));
      const tamperedRevision = { ...forged.sourceRevision, aliasRows: 9999 };
      const tamperedApply = await run(() => service.applyDepartmentAuthority({
        actorSchoolId: fixtureSchoolId, schoolId: fixtureSchoolId,
        expectedFingerprint: forged.fingerprint, expectedSourceRevision: tamperedRevision,
        aliases: [], labels: LABELS,
        confirmationText: service.DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION,
      }));
      assert(tamperedApply.replayed === true, 'count-only tampering does not gate (hash authority)');
      assert(writes().length === 0, 'hash-satisfied replay performs zero writes');
    }

    section('11. rollback receipt identifies only rows created by that apply');
    assert(applied.rollback.length === 8, 'rollback lists eight rows');
    assert(applied.rollback.every((row) => row.op === 'delete' && row.table === 'department_labels' && (row.key as any).schoolId === fixtureSchoolId), 'rollback rows scoped to the fixture school');

    section('12. no faculty/subject/ownership/cycle/curriculum/generation/timetable tables written');
    const forbiddenModels = new Set([
      'FacultyMirror', 'Subject', 'SubjectSectionOwnership', 'FacultySubject', 'TeachingLoadCycle',
      'SchoolYearOffering', 'DepartmentAlias', 'GenerationRun', 'PublishedScheduleRevision',
    ]);
    const forbiddenWrites = writes().filter((w) => forbiddenModels.has(w.model ?? ''));
    assert(forbiddenWrites.length === 0, `no forbidden-model writes (observed: ${JSON.stringify(writes().slice(0, 8))})`);

    section('validation edges: malformed authority rejected before any DB read');
    const badInputs: Array<[string, unknown, unknown]> = [
      ['blank alias', [{ alias: '  ', department: 'FIL' }], []],
      ['blank label', [], [{ code: 'FIL', label: '' }]],
      ['overlong alias', [{ alias: 'A'.repeat(65), department: 'FIL' }], []],
      ['overlong label', [], [{ code: 'FIL', label: 'L'.repeat(65) }]],
      ['duplicate alias', [{ alias: 'FIL', department: 'FIL' }, { alias: 'fil', department: 'FIL' }], []],
      ['duplicate code', [], [{ code: 'FIL', label: 'Filipino' }, { code: 'fil', label: 'Filipino' }]],
      ['non-array aliases', { alias: 'FIL' }, []],
      ['non-string code', [], [{ code: 42, label: 'Filipino' }]],
    ];
    for (const [label, aliases, labels] of badInputs) {
      resetRecording();
      try {
        await run(() => service.previewDepartmentAuthority(fixtureSchoolId, { actorSchoolId: fixtureSchoolId, aliases, labels }));
        assert(false, `${label} must throw`);
      } catch (e: any) {
        assert(e?.statusCode === 400 && e?.code === 'INVALID_DEPARTMENT_AUTHORITY', `${label} → typed 400`);
      }
      assert(writes().length === 0, `${label} performs zero writes`);
    }
    {
      resetRecording();
      const empty = await run(() => service.previewDepartmentAuthority(fixtureSchoolId, { actorSchoolId: fixtureSchoolId }));
      assert(empty.changes.length === 0, 'empty proposal previews zero changes');
      assert(typeof empty.fingerprint === 'string' && empty.fingerprint.length === 64, 'empty preview still fingerprinted');
      assert(writes().length === 0, 'empty preview performs zero writes');
    }

    section('negative control: recorder flags an unauthorized write shape');
    resetRecording();
    await instrumented.departmentLabel.create({ data: { schoolId: fixtureSchoolId, code: 'TMP', label: 'Tmp' } });
    const flagged = writes().filter((w) => w.model === 'DepartmentLabel' && w.action === 'create');
    assert(flagged.length === 1, 'recorder detects a direct departmentLabel:create');
    await instrumented.departmentLabel.deleteMany({ where: { schoolId: fixtureSchoolId, code: 'TMP' } });
    resetRecording();
  } finally {
    section('fixture cleanup with zero-residue proof');
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

  console.log(`\n=== Department Authority Apply Tests ===`);
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  if (failCount > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`[FAIL] department authority suite crashed: ${String(error?.message ?? error).slice(0, 300)}`);
  process.exit(1);
});
