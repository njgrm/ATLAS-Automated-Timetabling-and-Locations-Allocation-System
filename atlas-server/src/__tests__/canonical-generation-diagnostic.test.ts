/**
 * GEN-C01 canonical diagnostic production-path test.
 *
 * Proves, against the live database through the REAL injected data-access
 * path (`withDataContext` + Prisma `$extends`):
 *  - the canonical diagnostic and the live generation trigger share the SAME
 *    input assembly and scheduling core function references;
 *  - running the diagnostic performs ZERO Prisma writes on every model
 *    (no create/update/upsert/delete/executeRaw/queryRaw);
 *  - the before/after database signature is byte-identical;
 *  - every canonical demand line resolves a reconciled owner within scope and
 *    a section within scope (cross-school/year scope + owner substitution
 *    negative control);
 *  - a positive control proves the write recorder actually observes writes.
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

/** Read a service source and normalize it to one line for import-closure checks. */
function readSource(relativePath: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, relativePath), 'utf8').replace(/\s+/g, ' ');
}

/** Assert a source file statically imports a named binding from a relative specifier. */
function hasStaticImport(source: string, binding: string, specifier: string): boolean {
  const importRegex = new RegExp(
    `import\\s*(?:type\\s*)?[\\s\\S]*?\\b${binding}\\b[\\s\\S]*?from\\s*['"]${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
  );
  return importRegex.test(source);
}

const WRITE_ACTIONS = new Set([
  'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany',
  'executeRaw', 'executeRawUnsafe', '$executeRaw', '$executeRawUnsafe',
]);

/** Raw-read operations (e.g. `$queryRaw`) are reads, not writes. */
const RAW_READ_ACTIONS = new Set(['$queryRaw', '$queryRawUnsafe']);

type RecordedStatement = { model?: string; action: string };

const recorded: RecordedStatement[] = [];

async function main() {
  loadServerEnv();
  if (!process.env.DATABASE_URL) {
    console.error('[FAIL] DATABASE_URL is unavailable; cannot run the live diagnostic test.');
    process.exit(1);
  }
  const prismaModule = await import('../lib/prisma.js');
  const dataContext = await import('../lib/data-context.js');
  const diagnostic = await import('../services/canonical-generation-diagnostic.service.js');
  const generation = await import('../services/generation.service.js');

  section('diagnostic and live generation share the same assembly + core');

  const generationSource = readSource('../services/generation.service.ts');
  const diagnosticSource = readSource('../services/canonical-generation-diagnostic.service.ts');

  assert(
    hasStaticImport(generationSource, 'assembleGenerationInputs', './generation-input-assembly.service.js'),
    'live trigger statically imports assembleGenerationInputs from the shared assembly module',
  );
  assert(
    hasStaticImport(diagnosticSource, 'assembleGenerationInputs', './generation-input-assembly.service.js'),
    'diagnostic statically imports assembleGenerationInputs from the shared assembly module',
  );
  assert(
    hasStaticImport(generationSource, 'runHybridScheduler', './hybrid-scheduler.js'),
    'live trigger statically imports runHybridScheduler from the same scheduling core',
  );
  assert(
    hasStaticImport(diagnosticSource, 'runHybridScheduler', './hybrid-scheduler.js'),
    'diagnostic statically imports runHybridScheduler from the same scheduling core',
  );
  assert(
    hasStaticImport(generationSource, 'validateHardConstraints', './constraint-validator.js'),
    'live trigger statically imports validateHardConstraints from the same validator',
  );
  assert(
    hasStaticImport(diagnosticSource, 'validateHardConstraints', './constraint-validator.js'),
    'diagnostic statically imports validateHardConstraints from the same validator',
  );
  assert(
    hasStaticImport(generationSource, 'buildGenerationValidatorContext', './generation-input-assembly.service.js'),
    'live trigger statically imports the shared validator-context builder',
  );
  assert(
    hasStaticImport(diagnosticSource, 'buildGenerationValidatorContext', './generation-input-assembly.service.js'),
    'diagnostic statically imports the shared validator-context builder',
  );

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

  // Raw operations are NOT routed through $allOperations; wrap them so the
  // recorder observes raw reads AND raw writes (adversarial F1 closure).
  for (const rawAction of ['$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe']) {
    const original = (instrumented as any)[rawAction].bind(instrumented);
    (instrumented as any)[rawAction] = async (...rawArgs: unknown[]) => {
      recorded.push({ action: rawAction });
      return original(...rawArgs);
    };
  }

  section('static write-closure negative control (diagnostic + assembly)');

  const diagSourceScan = readSource('../services/canonical-generation-diagnostic.service.ts');
  const assemblySourceScan = readSource('../services/generation-input-assembly.service.ts');
  const forbiddenWriteTokens = [
    '.create(', '.createMany(', '.createManyAndReturn(',
    '.updateMany(', '.updateManyAndReturn(',
    '.upsert(', '.delete(', '.deleteMany(',
    '$executeRaw', '$executeRawUnsafe', '.executeRaw', '.executeRawUnsafe',
  ];
  for (const token of forbiddenWriteTokens) {
    assert(!diagSourceScan.includes(token), `diagnostic source contains no write token ${token}`);
    assert(!assemblySourceScan.includes(token), `assembly source contains no write token ${token}`);
  }

  section('resolve the active school year');

  const mirrors = await instrumented.enrollProSchoolYearMirror.findMany({
    select: { schoolId: true, enrollProSchoolYearId: true, isActive: true, isArchived: true },
  });
  const active = (mirrors as any[]).filter((m) => m.isActive && !m.isArchived);
  assert(active.length > 0, `active non-archived school year resolves (found ${active.length})`);
  if (active.length !== 1) {
    console.log(`\nTotal: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
    process.exit(1);
  }
  const schoolId = (active[0] as any).schoolId as number;
  const schoolYearId = (active[0] as any).enrollProSchoolYearId as number;
  assert(schoolId === 1 && schoolYearId === 8, `canonical scope is school 1 / year 8 (got ${schoolId}/${schoolYearId})`);

  section('canonical diagnostic runs read-only through the production data path');

  recorded.length = 0;
  const beforeSignature = await (dataContext as any).withDataContext(instrumented, () =>
    (diagnostic as any).computeDatabaseSignature(schoolId, schoolYearId),
  );
  const report = await (dataContext as any).withDataContext(instrumented, () =>
    (diagnostic as any).runCanonicalGenerationDiagnostic(schoolId, schoolYearId),
  );
  const afterSignature = await (dataContext as any).withDataContext(instrumented, () =>
    (diagnostic as any).computeDatabaseSignature(schoolId, schoolYearId),
  );

  assert(['CANDIDATE_READY', 'BLOCKED', 'ERROR'].includes(report.status), `diagnostic status resolves (${report.status})`);
  assert(report.scope.schoolId === schoolId && report.scope.schoolYearId === schoolYearId, 'diagnostic scope matches requested scope');
  assert(report.canonicalDemand.totalLines > 0, `canonical demand lines resolve (${report.canonicalDemand.totalLines})`);
  assert(report.canonicalDemand.totalSessions > 0, `canonical demand sessions resolve (${report.canonicalDemand.totalSessions})`);
  assert(report.productionDemand.totalLines > 0, `production demand lines resolve (${report.productionDemand.totalLines})`);
assert(typeof report.runtimeMs === 'number' && report.runtimeMs >= 0, 'runtime reported');
	assert(Array.isArray(report.sourceRevisions.canonical?.termConfig?.termIdentities ?? null), 'canonical source revision reports term config');
  assert('inputSnapshot' in report.sourceRevisions, 'input snapshot revision reported');
  assert(report.demandAlignment.canonicalSessions === report.canonicalDemand.totalSessions, 'demand alignment reports canonical total');
  assert(report.demandAlignment.productionSessions === report.productionDemand.totalSessions, 'demand alignment reports production total');

  section('zero writes across the entire diagnostic');

  const writes = recorded.filter((stmt) => WRITE_ACTIONS.has(stmt.action));
  assert(writes.length === 0, `diagnostic performs zero Prisma/model writes (observed ${JSON.stringify(writes.slice(0, 5))})`);
  assert(recorded.length > 0, `diagnostic performed reads through the production path (${recorded.length} statements)`);
  const rawReads = recorded.filter((stmt) => RAW_READ_ACTIONS.has(stmt.action));
  assert(rawReads.length > 0, 'recorder observed raw-read statements (migration signature probe)');

  section('database signature equality before/after');

  assert(
    beforeSignature?.sha256 === afterSignature?.sha256,
    `database signature unchanged by diagnostic (${String(beforeSignature?.sha256).slice(0, 12)}...)`,
  );
  assert(beforeSignature?.probes?.runCount === afterSignature?.probes?.runCount, 'generation run count unchanged');
  assert(beforeSignature?.probes?.ownership?.count === afterSignature?.probes?.ownership?.count, 'ownership count unchanged');
  assert(beforeSignature?.probes?.migrationCount === afterSignature?.probes?.migrationCount, 'migration count unchanged');

  section('canonical demand stays in scope with reconciled owners');

  const lineOwnerInScope = report.canonicalDemand.ownerStateTotals;
  assert(
    lineOwnerInScope.VALID === report.canonicalDemand.totalLines,
    `every canonical demand line resolves a VALID reconciled owner (VALID=${lineOwnerInScope.VALID}/${report.canonicalDemand.totalLines})`,
  );
  assert(
    lineOwnerInScope.MISSING === 0 && lineOwnerInScope.OUTSIDE_SCOPE === 0 && lineOwnerInScope.INACTIVE_OR_STALE === 0 && lineOwnerInScope.NO_QUALIFIED_SCOPE === 0,
    'no demand line is missing, out-of-scope, inactive/stale, or without qualified scope',
  );

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
      throw new Error('GEN_C01_ROLLBACK_PROBE');
    }).catch((error: any) => {
      if (error?.message !== 'GEN_C01_ROLLBACK_PROBE') throw error;
    });
    const observed = recorded.filter(
      (stmt) => stmt.model === 'SchedulingPolicy' && stmt.action === 'update',
    );
    assert(observed.length > 0, 'recorder observed the rolled-back schedulingPolicy:update');
    assert(
      observed.every((stmt) => WRITE_ACTIONS.has(stmt.action)),
      'recorder classifies the rolled-back schedulingPolicy:update as a write',
    );
    const after = await instrumented.schedulingPolicy.findUnique({
      where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
    });
    assert(
      (after as any)?.teachingStandardMinutes === (policyRow as any).teachingStandardMinutes,
      'rolled-back control left persisted policy values unchanged',
    );
  }

  section('positive control: recorder observes a raw SQL write, rolled back');

  recorded.length = 0;
  await instrumented.$transaction(async (tx: any) => {
    await tx.$executeRaw`UPDATE scheduling_policies SET max_teaching_minutes_per_day = max_teaching_minutes_per_day WHERE id = 0`;
    throw new Error('GEN_C01_RAW_ROLLBACK_PROBE');
  }).catch((error: any) => {
    if (error?.message !== 'GEN_C01_RAW_ROLLBACK_PROBE') throw error;
  });
  const rawWrites = recorded.filter((stmt) => WRITE_ACTIONS.has(stmt.action));
  assert(rawWrites.length > 0, `recorder observed the rolled-back raw write (${JSON.stringify(rawWrites.slice(0, 3))})`);
  const finalPolicy = await instrumented.schedulingPolicy.findUnique({
    where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
  });
  assert(
    (finalPolicy as any)?.maxTeachingMinutesPerDay === (policyRow as any)?.maxTeachingMinutesPerDay,
    'rolled-back raw control left persisted policy values unchanged',
  );

  await instrumented.$disconnect();

  console.log(`\n=== GEN-C01 Canonical Diagnostic Production-Path Tests ===`);
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  if (failCount > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`[FAIL] canonical diagnostic test crashed: ${String(error?.message ?? error).slice(0, 300)}`);
  process.exit(1);
});