/**
 * MIG-GUARD-R1: focused coverage for the canonical guarded migration command.
 *
 * Proves that `npm run migrate:guarded` (src/scripts/atlas-migrate.ts):
 *   1. always spawns Prisma with the exact repository root schema path;
 *   2. completes backup selection, checksum validation, and the current
 *      `pg_restore --list` revalidation before Prisma is spawned;
 *   3. never spawns Prisma when the backup gate fails;
 *   4. preserves supported forwarded Prisma arguments in stable order; and
 *   5. rejects a forwarded `--schema` conflict before the backup gate and
 *      before any spawn instead of creating ambiguous schema precedence.
 *
 * Hermetic: the Prisma spawn and `pg_restore --list` revalidator are injectable
 * fakes; backups are written to a disposable temp root. No live database
 * contact and no real migration.
 * Run: npx tsx src/__tests__/migration-guard.test.ts
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATLAS_PRISMA_SCHEMA_PATH,
  buildPrismaMigrateArgs,
  hasForwardedSchemaFlag,
  runGuardedMigration,
  type MigrationSpawn,
} from '../scripts/atlas-migrate.js';
import {
  loadBackupConfig,
  performBackup,
  revalidateArchiveForMigration,
  type ArchiveRevalidator,
  type BackupRunner,
} from '../services/database-backup.service.js';

let passCount = 0;
let failCount = 0;

function ok(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passCount += 1;
    console.log(`  \u2713 ${label}`);
  } else {
    failCount += 1;
    console.error(`  \u2717 ${label}${detail ? ` \u2014 ${detail}` : ''}`);
  }
}

async function expectCodeAsync(fn: () => Promise<unknown>, code: string, label: string): Promise<void> {
  try {
    await fn();
    failCount += 1;
    console.error(`  \u2717 ${label} \u2014 expected ${code}, but no error was thrown`);
  } catch (error) {
    const actual = (error as { code?: string }).code ?? 'NO_CODE';
    ok(actual === code, label, actual === code ? undefined : `expected ${code}, got ${actual}`);
  }
}

const TEST_ROOT = join(process.cwd(), 'src', '__tests__', 'tmp-migration-guard');
const DB_URL = 'postgresql://atlas_user:secret@localhost:5432/atlas_unit_test';
const SCHEMA_FLAG = '--schema';

function fakeRunner(overrides?: Partial<BackupRunner>): BackupRunner {
  return {
    async runPgDump(archivePath) {
      writeFileSync(archivePath, 'fake-dump-bytes');
      return { exitCode: 0 };
    },
    async runPgRestoreList() {
      return { exitCode: 0, entries: 42 };
    },
    async getServerVersion() {
      return '18.1';
    },
    async getClientVersion() {
      return '18.1';
    },
    async countRows() {
      return { schools: 1, authAccounts: 44 };
    },
    ...overrides,
  };
}

function writeConfigFile(root: string): string {
  const configPath = join(TEST_ROOT, `config-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(
    configPath,
    JSON.stringify({ backupRoot: root, freshManifestMaxAgeMs: 60 * 60 * 1000 }),
  );
  return configPath;
}

function freshRoot(name: string): string {
  const root = join(TEST_ROOT, name);
  mkdirSync(root, { recursive: true });
  return root;
}

type CapturedSpawn = { command: string; args: string[] };

/**
 * Failing-first detector: a valid guarded `prisma migrate deploy` invocation
 * carries exactly one `--schema <root path>` pair. The pre-fix default
 * (`['prisma', 'migrate', 'deploy']`) has no schema and must be rejected.
 */
function hasCanonicalSchema(args: string[]): boolean {
  const indexes = args.reduce<number[]>((acc, arg, index) => (arg === SCHEMA_FLAG ? [...acc, index] : acc), []);
  return indexes.length === 1 && args[indexes[0] + 1] === ATLAS_PRISMA_SCHEMA_PATH;
}

async function run(): Promise<void> {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(TEST_ROOT, { recursive: true });

  console.log('\n\u2550\u2550\u2550 prisma spawn argument construction (schema ownership) \u2550\u2550\u2550');
  {
    const base = buildPrismaMigrateArgs();
    ok(base[0] === 'prisma' && base[1] === 'migrate' && base[2] === 'deploy', 'spawns `prisma migrate deploy`');
    ok(base.includes(SCHEMA_FLAG), 'canonical command includes the schema flag');
    ok(base[base.indexOf(SCHEMA_FLAG) + 1] === ATLAS_PRISMA_SCHEMA_PATH, 'schema flag carries the exact root schema path', base.join(' '));
    ok(!hasCanonicalSchema(['prisma', 'migrate', 'deploy']), 'legacy default argument list (pre-fix) fails the canonical-schema detector');
    ok(hasCanonicalSchema(base), 'corrected default argument list passes the canonical-schema detector');

    const forwarded = buildPrismaMigrateArgs(['--skip-generate', '--tag=abc']);
    ok(forwarded.includes('--skip-generate') && forwarded.includes('--tag=abc'), 'unrelated forwarded args are preserved');
    ok(
      forwarded.indexOf('--skip-generate') < forwarded.indexOf('--tag=abc'),
      'forwarded non-schema args keep a stable relative order',
      forwarded.join(' '),
    );

    ok(hasForwardedSchemaFlag([SCHEMA_FLAG, '../evil.prisma']), 'detects a forwarded `--schema <path>` conflict');
    ok(hasForwardedSchemaFlag(['--schema=../evil.prisma']), 'detects a forwarded `--schema=<path>` conflict');
    ok(!hasForwardedSchemaFlag(['--skip-generate', '--tag=abc']), 'does not flag supported non-schema forwarded args');
    ok(
      hasCanonicalSchema(buildPrismaMigrateArgs(['--skip-generate', '--tag=abc'])),
      'supported forwarded args leave exactly one canonical schema argument',
    );
  }

  console.log('\n\u2550\u2550\u2550 gate completes before Prisma is spawned \u2550\u2550\u2550');
  {
    const root = freshRoot('happy');
    const configPath = writeConfigFile(root);
    const made = await performBackup({
      databaseUrl: DB_URL,
      config: { ...loadBackupConfig(), backupRoot: root },
      now: new Date(Date.now() - 1000),
      runner: fakeRunner(),
    });

    const events: string[] = [];
    let revalidatedArchivePath: string | null = null;
    let captured: CapturedSpawn | null = null;

    const revalidator: ArchiveRevalidator = {
      async runPgRestoreList(archivePath) {
        events.push('revalidate');
        revalidatedArchivePath = archivePath;
        return { exitCode: 0, entries: 42 };
      },
    };
    const spawn: MigrationSpawn = (command, args) => {
      events.push('spawn');
      captured = { command, args };
      return { status: 0 };
    };

    const code = await runGuardedMigration({
      argv: ['--config', configPath],
      env: { DATABASE_URL: DB_URL },
      spawn,
      revalidator,
      nowMs: () => Date.now(),
      log: () => undefined,
      logError: () => undefined,
    });

    const spawnArgs = captured ? (captured as CapturedSpawn).args : [];
    ok(code === 0, 'gate success returns the Prisma exit code');
    ok(events.join(',') === 'revalidate,spawn', 'checksum/revalidation resolves before the spawn', events.join(','));
    ok(revalidatedArchivePath === made.archivePath, 'current pg_restore --list ran against the exact selected archive');
    ok(captured !== null && (captured as CapturedSpawn).command === 'npx', 'Prisma is invoked through npx');
    ok(
      spawnArgs[spawnArgs.indexOf(SCHEMA_FLAG) + 1] === ATLAS_PRISMA_SCHEMA_PATH,
      'spawned command contains the exact root schema path',
      spawnArgs.join(' '),
    );
  }

  console.log('\n\u2550\u2550\u2550 failed backup gate never spawns Prisma \u2550\u2550\u2550');
  {
    // Corrupted archive: manifest fields look valid, but checksum validation
    // fails before selection can satisfy the gate.
    const corruptRoot = freshRoot('corrupt');
    const corruptConfig = writeConfigFile(corruptRoot);
    const corruptBackup = await performBackup({
      databaseUrl: DB_URL,
      config: { ...loadBackupConfig(), backupRoot: corruptRoot },
      now: new Date(Date.now() - 1000),
      runner: fakeRunner(),
    });
    const bytes = Buffer.from(readFileSync(corruptBackup.archivePath));
    bytes[0] = bytes[0] === 0 ? 1 : 0;
    writeFileSync(corruptBackup.archivePath, bytes);

    // The pre-spawn revalidation step recomputes the archive checksum and
    // rejects a byte-level mismatch before it ever reaches pg_restore --list.
    await expectCodeAsync(
      () =>
        revalidateArchiveForMigration({
          manifest: corruptBackup.manifest,
          root: corruptRoot,
          revalidator: { async runPgRestoreList() { return { exitCode: 0, entries: 42 }; } },
        }),
      'CHECKSUM_MISMATCH',
      'pre-spawn revalidation recomputes and rejects a corrupt archive checksum',
    );

    let corruptSpawned = false;
    const corruptErrors: string[] = [];
    const corruptCode = await runGuardedMigration({
      argv: ['--config', corruptConfig],
      env: { DATABASE_URL: DB_URL },
      spawn: () => {
        corruptSpawned = true;
        return { status: 0 };
      },
      revalidator: { async runPgRestoreList() { return { exitCode: 0, entries: 42 }; } },
      nowMs: () => Date.now(),
      log: () => undefined,
      logError: (message) => corruptErrors.push(message),
    });
    ok(corruptCode === 1 && !corruptSpawned, 'checksum-invalid archive fails the gate and never spawns Prisma');
    ok(corruptErrors.length > 0, 'checksum-invalid archive reports a gate failure', corruptErrors.join(' | '));

    // Empty backup root: no fresh target-matching manifest exists.
    const emptyRoot = freshRoot('empty');
    const emptyConfig = writeConfigFile(emptyRoot);
    let emptySpawned = false;
    const emptyErrors: string[] = [];
    const emptyCode = await runGuardedMigration({
      argv: ['--config', emptyConfig],
      env: { DATABASE_URL: DB_URL },
      spawn: () => {
        emptySpawned = true;
        return { status: 0 };
      },
      revalidator: { async runPgRestoreList() { return { exitCode: 0, entries: 42 }; } },
      nowMs: () => Date.now(),
      log: () => undefined,
      logError: (message) => emptyErrors.push(message),
    });
    ok(emptyCode === 1 && !emptySpawned, 'missing fresh manifest blocks the spawn');
    ok(emptyErrors.some((message) => message.includes('GATE_NO_FRESH_MANIFEST')), 'missing fresh manifest reports GATE_NO_FRESH_MANIFEST');

    // Current pg_restore --list rejects the archive even though fields verify.
    const rejectRoot = freshRoot('reject');
    const rejectConfig = writeConfigFile(rejectRoot);
    await performBackup({
      databaseUrl: DB_URL,
      config: { ...loadBackupConfig(), backupRoot: rejectRoot },
      now: new Date(Date.now() - 1000),
      runner: fakeRunner(),
    });
    const rejectEvents: string[] = [];
    const rejectErrors: string[] = [];
    const rejectCode = await runGuardedMigration({
      argv: ['--config', rejectConfig],
      env: { DATABASE_URL: DB_URL },
      spawn: () => {
        rejectEvents.push('spawn');
        return { status: 0 };
      },
      revalidator: {
        async runPgRestoreList() {
          rejectEvents.push('revalidate');
          return { exitCode: 1, entries: 0 };
        },
      },
      nowMs: () => Date.now(),
      log: () => undefined,
      logError: (message) => rejectErrors.push(message),
    });
    ok(rejectCode === 1 && !rejectEvents.includes('spawn'), 'failed current revalidation blocks the spawn');
    ok(rejectErrors.some((message) => message.includes('RESTORE_LIST_INVALID')), 'failed current revalidation reports RESTORE_LIST_INVALID');
  }

  console.log('\n\u2550\u2550\u2550 forwarded arguments stay supported \u2550\u2550\u2550');
  {
    const root = freshRoot('forwarded');
    const configPath = writeConfigFile(root);
    await performBackup({
      databaseUrl: DB_URL,
      config: { ...loadBackupConfig(), backupRoot: root },
      now: new Date(Date.now() - 1000),
      runner: fakeRunner(),
    });

    let captured: CapturedSpawn | null = null;
    const code = await runGuardedMigration({
      argv: ['--config', configPath, '--', '--skip-generate', '--tag=abc'],
      env: { DATABASE_URL: DB_URL },
      spawn: (command, args) => {
        captured = { command, args };
        return { status: 0 };
      },
      revalidator: { async runPgRestoreList() { return { exitCode: 0, entries: 42 }; } },
      nowMs: () => Date.now(),
      log: () => undefined,
      logError: () => undefined,
    });

    const spawnArgs = captured ? (captured as CapturedSpawn).args : [];
    ok(code === 0, 'forwarded-argument run reaches Prisma');
    ok(spawnArgs.includes('--skip-generate') && spawnArgs.includes('--tag=abc'), 'forwarded args reach the spawned command');
    ok(
      spawnArgs.indexOf('--skip-generate') < spawnArgs.indexOf('--tag=abc'),
      'forwarded non-schema args keep a stable relative order',
      spawnArgs.join(' '),
    );
    ok(hasCanonicalSchema(spawnArgs), 'exactly one canonical schema argument is supplied', spawnArgs.join(' '));
  }

  console.log('\n\u2550\u2550\u2550 conflicting schema input fails before spawn \u2550\u2550\u2550');
  {
    const root = freshRoot('conflict');
    const configPath = writeConfigFile(root);
    await performBackup({
      databaseUrl: DB_URL,
      config: { ...loadBackupConfig(), backupRoot: root },
      now: new Date(Date.now() - 1000),
      runner: fakeRunner(),
    });

    const conflicts: string[][] = [
      [SCHEMA_FLAG, '../evil.prisma'],
      ['--schema=../evil.prisma'],
    ];
    for (const conflict of conflicts) {
      let spawned = false;
      const errors: string[] = [];
      const code = await runGuardedMigration({
        argv: ['--config', configPath, '--', '--skip-generate', ...conflict, '--tag=abc'],
        env: { DATABASE_URL: DB_URL },
        spawn: () => {
          spawned = true;
          return { status: 0 };
        },
        revalidator: { async runPgRestoreList() { return { exitCode: 0, entries: 42 }; } },
        nowMs: () => Date.now(),
        log: () => undefined,
        logError: (message) => errors.push(message),
      });
      ok(code === 1 && !spawned, `conflicting schema input fails before spawn (${conflict.join(' ')})`);
      ok(
        errors.some((message) => message.includes('SCHEMA_FLAG_CONFLICT')),
        `conflicting schema input reports SCHEMA_FLAG_CONFLICT (${conflict.join(' ')})`,
      );
    }
  }
}

run()
  .catch((error) => {
    failCount += 1;
    console.error(`  \u2717 harness failed \u2014 ${error instanceof Error ? error.message : String(error)}`);
  })
  .finally(() => {
    try {
      if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    console.log(`\nmigration-guard: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) process.exitCode = 1;
  });
