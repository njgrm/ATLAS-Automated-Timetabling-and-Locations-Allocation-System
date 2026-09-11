/**
 * ATLAS guarded migration entry point (Prompt 06, DBR-06.4; MIG-GUARD-R1).
 *
 * Mandatory wrapper for every shared migration/cutover command. It exits
 * nonzero unless a fresh, checksum-valid manifest exists for the exact
 * configured target AND that exact archive passes a current
 * `pg_restore --list` revalidation immediately before spawning Prisma.
 * Only then does it run the real shared command (`prisma migrate deploy`).
 *
 * MIG-GUARD-R1: the wrapper is also the sole owner of the repository root
 * Prisma schema. It always spawns Prisma with
 * `--schema ../prisma/schema.prisma`, so `npm run migrate:guarded` works from
 * `atlas-server/` without a manual forwarded `-- -- --schema ...` argument.
 * Forwarded Prisma arguments are preserved, but a forwarded `--schema` flag
 * (including `--schema=<path>`) is rejected before the backup gate and before
 * any spawn, so schema precedence is never duplicated or ambiguous.
 *
 * Usage (from atlas-server/):
 *   npx tsx src/scripts/atlas-migrate.ts [--config <path>] [-- <extra prisma args>]
 *
 * This wrapper is the canonical entry point: runbooks forbid bare
 * `prisma migrate deploy` against shared databases.
 */
import 'dotenv/config';
import { execFile, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  BackupOperationError,
  loadBackupConfig,
  sanitizeTargetFromDatabaseUrl,
  selectAndRevalidateBackupForMigration,
  type ArchiveRevalidator,
  type BackupManifest,
} from '../services/database-backup.service.js';

const execFileAsync = promisify(execFile);

/** Repository root Prisma schema, relative to the atlas-server/ working dir. */
export const ATLAS_PRISMA_SCHEMA_PATH = '../prisma/schema.prisma';

const SCHEMA_FLAG = '--schema';

export type MigrationSpawnOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdio: 'inherit';
  shell: boolean;
  timeout: number;
};

export type MigrationSpawnResult = { status: number | null; error?: Error | null };

export type MigrationSpawn = (
  command: string,
  args: string[],
  options: MigrationSpawnOptions,
) => MigrationSpawnResult;

/**
 * Detect a caller-supplied `--schema <path>` or `--schema=<path>` forwarded
 * after `--`. Any forwarded schema is a conflict: the guarded wrapper is the
 * sole owner of the repository root schema.
 */
export function hasForwardedSchemaFlag(extraArgs: string[] = []): boolean {
  return extraArgs.some((arg) => arg === SCHEMA_FLAG || arg.startsWith(`${SCHEMA_FLAG}=`));
}

/**
 * Build the exact `npx` argument vector for `prisma migrate deploy`.
 *
 * The guarded wrapper always supplies the canonical root schema. Forwarded
 * arguments are preserved in order; a forwarded schema is rejected by
 * `hasForwardedSchemaFlag` before this builder is reached, so the canonical
 * schema flag is never duplicated or overridden.
 */
export function buildPrismaMigrateArgs(extraArgs: string[] = []): string[] {
  return ['prisma', 'migrate', 'deploy', SCHEMA_FLAG, ATLAS_PRISMA_SCHEMA_PATH, ...extraArgs];
}

function defaultSpawn(command: string, args: string[], options: MigrationSpawnOptions): MigrationSpawnResult {
  return spawnSync(command, args, options) as MigrationSpawnResult;
}

function defaultRevalidator(): ArchiveRevalidator {
  return {
    async runPgRestoreList(archivePath) {
      const pgBinDir = process.env.ATLAS_PG_BIN_DIR ?? 'D:\\PostgreSQL\\18\\bin';
      try {
        const { stdout } = await execFileAsync(join(pgBinDir, 'pg_restore.exe'), ['--list', archivePath], {
          timeout: 5 * 60 * 1000,
        });
        const entries = stdout.split('\n').filter((line) => /^\d+;/.test(line.trim())).length;
        return { exitCode: 0, entries };
      } catch {
        return { exitCode: 1, entries: 0 };
      }
    },
  };
}

export type GuardedMigrationOptions = {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  spawn?: MigrationSpawn;
  revalidator?: ArchiveRevalidator;
  nowMs?: () => number;
  log?: (message: string) => void;
  logError?: (message: string) => void;
};

/**
 * Run the guarded migration: gate first, spawn only after the gate resolves.
 * Returns the process exit code (0 only when Prisma itself succeeds). Spawn and
 * revalidation are injectable so the production path is testable without a live
 * database or a real migration.
 */
export async function runGuardedMigration(options: GuardedMigrationOptions = {}): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const spawn = options.spawn ?? defaultSpawn;
  const revalidator = options.revalidator ?? defaultRevalidator();
  const nowMs = options.nowMs ?? (() => Date.now());
  const log = options.log ?? ((message: string) => console.log(message));
  const logError = options.logError ?? ((message: string) => console.error(message));

  const reportFailure = (code: string, message: string): number => {
    logError(`MIGRATE_GATE_FAIL code=${code} message=${message}`);
    return 1;
  };

  const configIndex = argv.indexOf('--config');
  const configPath = configIndex >= 0 ? argv[configIndex + 1] : env.ATLAS_BACKUP_CONFIG;
  const separator = argv.indexOf('--');
  const extraArgs = separator >= 0 ? argv.slice(separator + 1) : [];

  // MIG-GUARD-R1: reject a caller-supplied schema before any gate or spawn. The
  // wrapper owns the root schema, so a forwarded --schema is an ambiguous
  // conflict, not a supported override.
  if (hasForwardedSchemaFlag(extraArgs)) {
    return reportFailure(
      'SCHEMA_FLAG_CONFLICT',
      'A caller-supplied --schema is not allowed; the guarded wrapper owns the repository root Prisma schema.',
    );
  }

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) return reportFailure('CONFIG_MISSING', 'DATABASE_URL is not configured.');

  let config;
  let target;
  try {
    config = loadBackupConfig(configPath);
    target = sanitizeTargetFromDatabaseUrl(databaseUrl);
  } catch (error) {
    if (error instanceof BackupOperationError) return reportFailure(error.code, error.message);
    return reportFailure('GATE_UNKNOWN', error instanceof Error ? error.message : String(error));
  }

  let manifest: BackupManifest;
  try {
    // F-06-02: the guarded production path revalidates the selected archive
    // (fresh checksum + current `pg_restore --list` on that exact file)
    // immediately before spawning Prisma. Any failure blocks the spawn below.
    manifest = await selectAndRevalidateBackupForMigration({
      root: config.backupRoot,
      targetDatabase: target.database,
      nowMs: nowMs(),
      maxAgeMs: config.freshManifestMaxAgeMs,
      revalidator,
    });
  } catch (error) {
    if (error instanceof BackupOperationError) return reportFailure(error.code, error.message);
    return reportFailure('GATE_UNKNOWN', error instanceof Error ? error.message : String(error));
  }
  log(`MIGRATE_GATE_OK target=${target.database} manifest=${manifest.manifestFileName}`);

  const child = spawn('npx', buildPrismaMigrateArgs(extraArgs), {
    cwd,
    env,
    stdio: 'inherit',
    shell: true,
    timeout: 10 * 60 * 1000,
  });
  if (child.error) return reportFailure('MIGRATE_SPAWN_FAILED', child.error.message);
  return child.status ?? 1;
}

async function main(): Promise<void> {
  process.exitCode = await runGuardedMigration();
}

// Direct-run only: importing this module (e.g. for buildPrismaMigrateArgs in
// tests) must not spawn Prisma. argv[1] is the script path when run via tsx/node.
const entryArg = process.argv[1]?.replace(/\\/g, '/') ?? '';
if (entryArg.endsWith('scripts/atlas-migrate.ts') || entryArg.endsWith('scripts/atlas-migrate.js')) {
  void main();
}
