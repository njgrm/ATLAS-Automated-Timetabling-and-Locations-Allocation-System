/**
 * ATLAS operational backup CLI (Prompt 06).
 *
 * Usage (from atlas-server/):
 *   npx tsx src/scripts/atlas-backup.ts backup [--config <path>]
 *   npx tsx src/scripts/atlas-backup.ts retention [--config <path>]
 *   npx tsx src/scripts/atlas-backup.ts validate --manifest <path> [--config <path>]
 *
 * Reads connection identity from protected existing configuration
 * (atlas-server/.env DATABASE_URL). Secrets never appear in argv or logs:
 * only host/port/database identity is printed.
 */
import 'dotenv/config';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BACKUP_OPERATOR_DEFAULTS,
  BackupOperationError,
  connectionEnvFromDatabaseUrl,
  createLiveBackupRunner,
  enforceRetention,
  loadBackupConfig,
  performBackup,
  sanitizeTargetFromDatabaseUrl,
  verifyStoredManifest,
} from '../services/database-backup.service.js';

const PG_BIN_DIR = process.env.ATLAS_PG_BIN_DIR ?? 'D:\\PostgreSQL\\18\\bin';

function fail(code: string, message: string): never {
  console.error(`BACKUP_FAIL code=${code} message=${message}`);
  process.exit(1);
}

function configPathFromArgs(args: string[]): string | undefined {
  const index = args.indexOf('--config');
  return index >= 0 ? args[index + 1] : process.env.ATLAS_BACKUP_CONFIG;
}

function manifestPathFromArgs(args: string[]): string {
  const index = args.indexOf('--manifest');
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) fail('ARG_MISSING', 'validate requires --manifest <path>.');
  return value as string;
}

function scheduledLogPath(): string | null {
  const configured = process.env.ATLAS_BACKUP_LOG_FILE;
  if (configured) return configured;
  if (process.env.ATLAS_BACKUP_SCHEDULED === 'true') {
    return join(BACKUP_OPERATOR_DEFAULTS.backupRoot, '..', 'logs', 'backup-scheduled.log');
  }
  return null;
}

function logLine(message: string): void {
  console.log(message);
  const logPath = scheduledLogPath();
  if (logPath) {
    try {
      const dir = join(logPath, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
    } catch {
      // Logging must never mask the backup result.
    }
  }
}

async function commandBackup(configPath?: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('CONFIG_MISSING', 'DATABASE_URL is not configured.');
  const config = loadBackupConfig(configPath);
  const target = sanitizeTargetFromDatabaseUrl(databaseUrl as string);
  // Touch the secret-bearing split once to prove the path resolves; the values
  // themselves are never printed or logged.
  connectionEnvFromDatabaseUrl(databaseUrl as string);
  const runner = createLiveBackupRunner(PG_BIN_DIR, databaseUrl as string);
  try {
    const result = await performBackup({
      databaseUrl: databaseUrl as string,
      config,
      runner,
      workspaceDir: process.cwd().replace(/\\atlas-server$/, ''),
    });
    logLine(`BACKUP_OK target=${target.host}:${target.port}/${target.database} archive=${result.manifest.archiveFileName} bytes=${result.manifest.byteSize} sha256=${result.manifest.sha256} restoreListEntries=${result.manifest.restoreListEntries}`);
  } catch (error) {
    if (error instanceof BackupOperationError) fail(error.code, error.message);
    fail('BACKUP_UNKNOWN', error instanceof Error ? error.message : String(error));
  }
}

async function commandRetention(configPath?: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('CONFIG_MISSING', 'DATABASE_URL is not configured.');
  const config = loadBackupConfig(configPath);
  const target = sanitizeTargetFromDatabaseUrl(databaseUrl as string);
  try {
    const result = enforceRetention({ root: config.backupRoot, targetDatabase: target.database, keep: config.retentionCount });
    logLine(`RETENTION_OK target=${target.database} kept=${result.kept.length} deleted=${result.deleted.length}`);
    for (const name of result.deleted) logLine(`RETENTION_DELETED archive=${name}`);
  } catch (error) {
    if (error instanceof BackupOperationError) fail(error.code, error.message);
    fail('RETENTION_UNKNOWN', error instanceof Error ? error.message : String(error));
  }
}

async function commandValidate(manifestPath: string, configPath?: string): Promise<void> {
  const config = loadBackupConfig(configPath);
  try {
    const manifest = verifyStoredManifest(manifestPath, config.backupRoot);
    logLine(`VALIDATE_OK archive=${manifest.archiveFileName} sha256=${manifest.sha256} target=${manifest.target.database}`);
  } catch (error) {
    if (error instanceof BackupOperationError) fail(error.code, error.message);
    fail('VALIDATE_UNKNOWN', error instanceof Error ? error.message : String(error));
  }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'backup') await commandBackup(configPathFromArgs(rest));
  else if (command === 'retention') await commandRetention(configPathFromArgs(rest));
  else if (command === 'validate') await commandValidate(manifestPathFromArgs(rest), configPathFromArgs(rest));
  else fail('ARG_UNKNOWN', 'Expected one of: backup, retention, validate.');
}

main();
