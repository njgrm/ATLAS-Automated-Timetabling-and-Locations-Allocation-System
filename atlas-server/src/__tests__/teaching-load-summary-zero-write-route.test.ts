/**
 * Teaching Load summary zero-write route test (TL-C01R2 item 4).
 *
 * Instruments the REAL production data-access path (`withDataContext` +
 * Prisma `$use` middleware) and invokes the REAL `getAssignmentSummary`
 * against the live database:
 * - the summary GET performs ZERO Prisma writes (no create/update/upsert/
 *   delete on any model — including teachingLoadCycle and schedulingPolicy);
 * - the result carries the additive `workloadPolicy`, `workloadPolicyStatus`,
 *   and `cycleDiagnostic` contract fields.
 *
 * POSITIVE CONTROL (state-neutral): a no-op update inside a rolled-back
 * transaction proves the recorder observes real writes end-to-end. The update
 * writes the row's current values back and the transaction always rolls back,
 * so persisted state is unchanged.
 *
 * Requires a reachable database (same DATABASE_URL the server uses).
 * Run with `npx tsx <this-file>`.
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

type RecordedStatement = { model?: string; action: string };

const recorded: RecordedStatement[] = [];

async function main() {
  loadServerEnv();
  if (!process.env.DATABASE_URL) {
    console.error('[FAIL] DATABASE_URL is unavailable; cannot run the live zero-write route test.');
    process.exit(1);
  }
  const prismaModule = await import('../lib/prisma.js');
  const dataContext = await import('../lib/data-context.js');
  const service = await import('../services/faculty-assignment.service.js');

  // Dedicated instrumented client: a query extension records every statement the
  // production path executes through the injected context. ($use middleware is
  // unavailable in this generated client; $extends query interception is used.)
  const baseInstrumented = (prismaModule as any).createTestPrismaClient();
  if (!baseInstrumented?.$extends) {
    console.error('[FAIL] Prisma client with $extends interception support is unavailable.');
    process.exit(1);
  }
  const instrumented = baseInstrumented.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          recorded.push({ model, action: operation });
          return query(args);
        },
      },
    },
  });

  section('live summary route performs zero Prisma writes');

  const mirrors = await instrumented.enrollProSchoolYearMirror.findMany({
    select: { schoolId: true, enrollProSchoolYearId: true, isActive: true, isArchived: true },
  });
  recorded.length = 0; // mirror lookup is setup, not the route under test.
  const active = (mirrors as any[]).filter((m) => m.isActive && !m.isArchived);
  assert(active.length > 0, `active non-archived school year resolves (found ${active.length})`);
  if (active.length === 0) {
    console.log(`\nTotal: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
    process.exit(1);
  }
  const schoolId = (active[0] as any).schoolId as number;
  const schoolYearId = (active[0] as any).enrollProSchoolYearId as number;

  const summary = await (dataContext as any).withDataContext(instrumented, () =>
    (service as any).getAssignmentSummary(schoolId, schoolYearId),
  );

  const writes = recorded.filter((stmt) => WRITE_ACTIONS.has(stmt.action));
  assert(writes.length === 0, `summary GET performs zero Prisma writes (observed ${JSON.stringify(writes.slice(0, 5))})`);
  const cycleWrites = recorded.filter(
    (stmt) => stmt.model === 'TeachingLoadCycle' && WRITE_ACTIONS.has(stmt.action),
  );
  assert(cycleWrites.length === 0, 'summary GET performs zero teachingLoadCycle writes');
  const policyWrites = recorded.filter(
    (stmt) => stmt.model === 'SchedulingPolicy' && WRITE_ACTIONS.has(stmt.action),
  );
  assert(policyWrites.length === 0, 'summary GET performs zero schedulingPolicy writes');
  assert(recorded.length > 0, `summary GET performed reads (${recorded.length} statements observed)`);
  assert(summary && typeof summary === 'object', 'summary result resolves');
  assert('workloadPolicy' in summary && 'workloadPolicyStatus' in summary, 'summary carries the workload-policy contract');
  assert('cycleDiagnostic' in summary && 'source' in summary, 'summary carries the cycle source + diagnostic contract');
  assert(Array.isArray(summary.faculty), 'summary faculty resolves');

  section('positive control: recorder observes a real write, rolled back');

  recorded.length = 0;
  const policyRow = await instrumented.schedulingPolicy.findUnique({
    where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
  });
  assert(policyRow != null, 'persisted policy row exists for the state-neutral control');
  if (policyRow != null) {
    recorded.length = 0;
    await instrumented.$transaction(async (tx: any) => {
      await tx.schedulingPolicy.update({
        where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
        data: { teachingStandardMinutes: (policyRow as any).teachingStandardMinutes },
      });
      throw new Error('TL_C01R2_ROLLBACK_PROBE');
    }).catch((error: any) => {
      if (error?.message !== 'TL_C01R2_ROLLBACK_PROBE') throw error;
    });
    const observed = recorded.filter(
      (stmt) => stmt.model === 'SchedulingPolicy' && stmt.action === 'update',
    );
    assert(observed.length > 0, 'recorder observed the rolled-back schedulingPolicy:update');
    const after = await instrumented.schedulingPolicy.findUnique({
      where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
    });
    assert(
      (after as any)?.teachingStandardMinutes === (policyRow as any).teachingStandardMinutes,
      'rolled-back control left persisted policy values unchanged',
    );
  }

  await instrumented.$disconnect();

  console.log(`\n=== Teaching Load Summary Zero-Write Route Tests ===`);
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  if (failCount > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`[FAIL] zero-write route test crashed: ${String(error?.message ?? error).slice(0, 300)}`);
  process.exit(1);
});
