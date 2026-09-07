/**
 * ATLAS guarded migration entry point (Prompt 06, DBR-06.4).
 *
 * Mandatory wrapper for every shared migration/cutover command. It exits
 * nonzero unless a fresh, checksum-valid manifest exists for the exact
 * configured target AND that exact archive passes a current
 * `pg_restore --list` revalidation immediately before spawning Prisma.
 * Only then does it run the real shared
 * command (`prisma migrate deploy`).
 *
 * Usage (from atlas-server/):
 *   npx tsx src/scripts/atlas-migrate.ts [--config <path>] [-- <extra prisma args>]
 *
 * This wrapper is the canonical entry point: runbooks forbid bare
 * `prisma migrate deploy` against shared databases.
 */
import 'dotenv/config';
import { execFile } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  BackupOperationError,
  loadBackupConfig,
  sanitizeTargetFromDatabaseUrl,
  selectAndRevalidateBackupForMigration,
} from '../services/database-backup.service.js';

const execFileAsync = promisify(execFile);

function fail(code: string, message: string): never {
  console.error(`MIGRATE_GATE_FAIL code=${code} message=${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const configIndex = args.indexOf('--config');
  const configPath = configIndex >= 0 ? args[configIndex + 1] : process.env.ATLAS_BACKUP_CONFIG;
  const separator = args.indexOf('--');
  const extraArgs = separator >= 0 ? args.slice(separator + 1) : [];

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('CONFIG_MISSING', 'DATABASE_URL is not configured.');
  const config = loadBackupConfig(configPath);
  const target = sanitizeTargetFromDatabaseUrl(databaseUrl as string);

  let manifest;
  try {
    // F-06-02: the guarded production path revalidates the selected archive
    // (fresh checksum + current `pg_restore --list` on that exact file)
    // immediately before spawning Prisma. Any failure blocks the spawn below.
    manifest = await selectAndRevalidateBackupForMigration({
      root: config.backupRoot,
      targetDatabase: target.database,
      nowMs: Date.now(),
      maxAgeMs: config.freshManifestMaxAgeMs,
      revalidator: {
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
      },
    });
  } catch (error) {
    if (error instanceof BackupOperationError) fail(error.code, error.message);
    fail('GATE_UNKNOWN', error instanceof Error ? error.message : String(error));
  }
  console.log(`MIGRATE_GATE_OK target=${target.database} manifest=${(manifest as { manifestFileName: string }).manifestFileName}`);

  const child = spawnSync('npx', ['prisma', 'migrate', 'deploy', ...extraArgs], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: true,
    timeout: 10 * 60 * 1000,
  });
  if (child.error) fail('MIGRATE_SPAWN_FAILED', child.error.message);
  process.exit(child.status ?? 1);
}

main();
