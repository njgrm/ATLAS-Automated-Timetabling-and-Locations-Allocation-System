/**
 * ATLAS operational database backup/restore service (Prompt 06).
 *
 * Narrow, operator-configured controls for logical backup (`pg_dump -Fc`),
 * checksum manifests, retention, guarded disposable restore, and the
 * pre-migration backup gate. All values that vary by environment live in
 * operator configuration (file + env), never as application-policy constants.
 *
 * Secrets policy: connection credentials travel only in child-process
 * environment variables (`PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`).
 * They are never placed in argv, never written to manifests, and never logged.
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const BACKUP_TOOL_ID = 'atlas-backup';
export const BACKUP_TOOL_VERSION = 1;
export const RESTORE_DRILL_TARGET_PREFIX = 'atlas_restore_drill_';

export type BackupOperatorConfig = {
  /** Directory that owns every backup artifact. Operator configuration. */
  backupRoot: string;
  /** Human-readable schedule contract, e.g. "daily at 22:00 Asia/Manila". */
  schedule: string;
  /** Number of successful daily backups retained. */
  retentionCount: number;
  /** Recovery-point objective in hours. */
  rpoHours: number;
  /** Restore-drill target in minutes. */
  restoreDrillTargetMinutes: number;
  /** PostgreSQL major version required for client/server parity. */
  requiredPostgresMajor: number;
  /** Max age (ms) of a manifest that still counts as "fresh" for the gate. */
  freshManifestMaxAgeMs: number;
};

export const BACKUP_OPERATOR_DEFAULTS: BackupOperatorConfig = {
  backupRoot: 'D:\\ATLAS-database-recovery\\backups',
  schedule: 'daily at 22:00 Asia/Manila',
  retentionCount: 14,
  rpoHours: 24,
  restoreDrillTargetMinutes: 60,
  requiredPostgresMajor: 18,
  freshManifestMaxAgeMs: 24 * 60 * 60 * 1000,
};

export type SanitizedTarget = {
  host: string;
  port: number;
  database: string;
};

export type BackupManifest = {
  backupTool: string;
  toolVersion: number;
  createdAt: string;
  schedule: string;
  target: SanitizedTarget;
  clientVersion: string;
  serverVersion: string;
  archiveFileName: string;
  manifestFileName: string;
  byteSize: number;
  sha256: string;
  dumpExitCode: number;
  counts: Record<string, number>;
  restoreListExitCode: number;
  restoreListEntries: number;
  valid: boolean;
};

export class BackupOperationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BackupOperationError';
    this.code = code;
  }
}

/** Load operator configuration: explicit file wins, otherwise defaults. */
export function loadBackupConfig(configPath?: string): BackupOperatorConfig {
  if (!configPath) return { ...BACKUP_OPERATOR_DEFAULTS };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8')) as unknown;
  } catch (error) {
    throw new BackupOperationError(
      'CONFIG_UNREADABLE',
      `Backup config at ${configPath} cannot be read or parsed.`,
    );
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new BackupOperationError('CONFIG_INVALID', 'Backup config must be a JSON object.');
  }
  const merged: BackupOperatorConfig = { ...BACKUP_OPERATOR_DEFAULTS };
  const record = raw as Record<string, unknown>;
  if (typeof record.backupRoot === 'string' && record.backupRoot.trim()) merged.backupRoot = record.backupRoot;
  if (typeof record.schedule === 'string' && record.schedule.trim()) merged.schedule = record.schedule;
  if (Number.isInteger(record.retentionCount) && (record.retentionCount as number) > 0) {
    merged.retentionCount = record.retentionCount as number;
  }
  if (typeof record.rpoHours === 'number' && record.rpoHours > 0) merged.rpoHours = record.rpoHours;
  if (typeof record.restoreDrillTargetMinutes === 'number' && record.restoreDrillTargetMinutes > 0) {
    merged.restoreDrillTargetMinutes = record.restoreDrillTargetMinutes as number;
  }
  if (Number.isInteger(record.requiredPostgresMajor) && (record.requiredPostgresMajor as number) > 0) {
    merged.requiredPostgresMajor = record.requiredPostgresMajor as number;
  }
  if (typeof record.freshManifestMaxAgeMs === 'number' && record.freshManifestMaxAgeMs > 0) {
    merged.freshManifestMaxAgeMs = record.freshManifestMaxAgeMs as number;
  }
  return merged;
}

/** Extract credential-free target identity from a PostgreSQL URL. */
export function sanitizeTargetFromDatabaseUrl(databaseUrl: string): SanitizedTarget {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new BackupOperationError('TARGET_INVALID', 'DATABASE_URL is not a valid URL.');
  }
  if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
    throw new BackupOperationError('TARGET_INVALID', 'DATABASE_URL must include host and database name.');
  }
  const port = parsed.port ? Number(parsed.port) : 5432;
  if (!Number.isInteger(port) || port <= 0) {
    throw new BackupOperationError('TARGET_INVALID', 'DATABASE_URL carries an invalid port.');
  }
  return { host: parsed.hostname, port, database: decodeURIComponent(parsed.pathname.slice(1)) };
}

/** Split a PostgreSQL URL into child env (secret-bearing) plus plain db name. */
export function connectionEnvFromDatabaseUrl(databaseUrl: string): { env: NodeJS.ProcessEnv; dbName: string } {
  const target = sanitizeTargetFromDatabaseUrl(databaseUrl);
  const parsed = new URL(databaseUrl);
  const env: NodeJS.ProcessEnv = {
    PGHOST: target.host,
    PGPORT: String(target.port),
    PGDATABASE: target.database,
  };
  if (parsed.username) env.PGUSER = decodeURIComponent(parsed.username);
  if (parsed.password) env.PGPASSWORD = decodeURIComponent(parsed.password);
  return { env, dbName: target.database };
}

/** Parse a major version (e.g. "18.1" -> 18) and enforce parity. */
export function checkVersionParity(clientVersion: string, serverVersion: string, requiredMajor: number): void {
  const clientMajor = Number.parseInt(clientVersion.trim().split('.')[0] ?? '', 10);
  const serverMajor = Number.parseInt(serverVersion.trim().split('.')[0] ?? '', 10);
  if (!Number.isInteger(clientMajor) || !Number.isInteger(serverMajor)) {
    throw new BackupOperationError('VERSION_UNPARSEABLE', 'PostgreSQL client/server versions are not parseable.');
  }
  if (clientMajor !== serverMajor) {
    throw new BackupOperationError(
      'VERSION_MISMATCH',
      `PostgreSQL client major ${clientMajor} differs from server major ${serverMajor}.`,
    );
  }
  if (clientMajor !== requiredMajor) {
    throw new BackupOperationError(
      'VERSION_UNSUPPORTED',
      `PostgreSQL major ${clientMajor} is not the required ${requiredMajor}.`,
    );
  }
}

function canonicalPath(value: string): string {
  return resolve(normalize(value));
}

function isInsideRoot(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Fail closed unless `destPath` is strictly inside the configured backup root
 * and outside forbidden zones (repository, PostgreSQL data dir, Temp).
 * Junction/symlink escapes are rejected via realpath containment.
 */
export function validateDestination(root: string, destPath: string, options?: { workspaceDir?: string }): void {
  const canonicalRoot = canonicalPath(root);
  const canonicalDest = canonicalPath(destPath);
  const forbidden: Array<{ label: string; dir: string }> = [
    { label: 'TEMP', dir: canonicalPath(tmpdir()) },
    { label: 'PGDATA', dir: canonicalPath('D:\\PostgreSQL\\18\\data') },
  ];
  if (options?.workspaceDir) forbidden.push({ label: 'REPO', dir: canonicalPath(options.workspaceDir) });
  for (const entry of forbidden) {
    if (canonicalDest === entry.dir || isInsideRoot(entry.dir, canonicalDest)) {
      throw new BackupOperationError(
        'DESTINATION_FORBIDDEN',
        `Backup destination must not live inside ${entry.label}.`,
      );
    }
  }
  if (canonicalDest === canonicalRoot || !isInsideRoot(canonicalRoot, canonicalDest)) {
    throw new BackupOperationError('DESTINATION_ESCAPE', 'Backup destination must be strictly inside the backup root.');
  }
  let realRoot: string;
  try {
    realRoot = canonicalPath(realpathSync(canonicalRoot));
  } catch {
    throw new BackupOperationError('DESTINATION_UNRESOLVABLE', 'Backup root cannot be resolved; refusing to write.');
  }
  let probe = canonicalDest;
  for (;;) {
    try {
      const real = canonicalPath(realpathSync(probe));
      if (real !== probe && !isInsideRoot(realRoot, real) && real !== realRoot) {
        throw new BackupOperationError('DESTINATION_SYMLINK_ESCAPE', 'Backup destination escapes the root via link.');
      }
      break;
    } catch (error) {
      if (error instanceof BackupOperationError) throw error;
      const parent = canonicalPath(join(probe, '..'));
      if (parent === probe) {
        throw new BackupOperationError('DESTINATION_UNRESOLVABLE', 'Backup destination parents cannot be resolved.');
      }
      probe = parent;
      if (probe === canonicalRoot || isInsideRoot(canonicalRoot, probe)) break;
    }
  }
}

export function buildArchiveFileName(database: string, now: Date): { archiveFileName: string; manifestFileName: string } {
  const safeDb = database.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const archiveFileName = `${BACKUP_TOOL_ID}-${safeDb}-${stamp}.dump`;
  return { archiveFileName, manifestFileName: `${archiveFileName}.manifest.json` };
}

export function sha256OfFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Full schema check for a manifest object. Never throws for bad input. */
export function validateManifestObject(value: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null) return { ok: false, errors: ['manifest must be an object'] };
  const m = value as Record<string, unknown>;
  if (m.backupTool !== BACKUP_TOOL_ID) errors.push('backupTool lineage mismatch');
  if (m.toolVersion !== BACKUP_TOOL_VERSION) errors.push('toolVersion mismatch');
  if (typeof m.createdAt !== 'string' || Number.isNaN(Date.parse(m.createdAt))) errors.push('createdAt invalid');
  if (typeof m.schedule !== 'string' || !m.schedule) errors.push('schedule missing');
  const t = m.target as Record<string, unknown> | undefined;
  if (!t || typeof t.host !== 'string' || !t.host || !Number.isInteger(t.port) || typeof t.database !== 'string' || !t.database) {
    errors.push('target identity incomplete');
  }
  for (const key of ['clientVersion', 'serverVersion', 'archiveFileName', 'manifestFileName', 'sha256'] as const) {
    if (typeof m[key] !== 'string' || !(m[key] as string)) errors.push(`${key} missing`);
  }
  if (!Number.isInteger(m.byteSize) || (m.byteSize as number) <= 0) errors.push('byteSize invalid');
  if (typeof m.sha256 === 'string' && !/^[0-9a-f]{64}$/.test(m.sha256)) errors.push('sha256 malformed');
  if (m.dumpExitCode !== 0) errors.push('dumpExitCode nonzero');
  if (m.restoreListExitCode !== 0) errors.push('restoreListExitCode nonzero');
  if (!Number.isInteger(m.restoreListEntries) || (m.restoreListEntries as number) <= 0) {
    errors.push('restoreListEntries invalid');
  }
  if (typeof m.counts !== 'object' || m.counts === null) errors.push('counts missing');
  if (m.valid !== true) errors.push('valid flag not true');
  return { ok: errors.length === 0, errors };
}

/**
 * Verify a stored manifest: schema, lineage, dump presence, byte size, and
 * recomputed checksum. Throws fail-closed on any mismatch.
 */
export function verifyStoredManifest(manifestPath: string, root: string): BackupManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  } catch {
    throw new BackupOperationError('MANIFEST_UNREADABLE', 'Manifest cannot be read or parsed.');
  }
  const check = validateManifestObject(parsed);
  if (!check.ok) {
    throw new BackupOperationError('MANIFEST_INCOMPLETE', `Manifest invalid: ${check.errors.join('; ')}`);
  }
  const manifest = parsed as BackupManifest;
  const archivePath = canonicalPath(join(root, manifest.archiveFileName));
  validateDestination(root, archivePath);
  if (!existsSync(archivePath)) {
    throw new BackupOperationError('ARCHIVE_MISSING', 'Manifest references a missing archive.');
  }
  const size = statSync(archivePath).size;
  if (size !== manifest.byteSize) {
    throw new BackupOperationError('ARCHIVE_SIZE_MISMATCH', 'Archive byte size differs from manifest.');
  }
  const actual = sha256OfFile(archivePath);
  if (actual !== manifest.sha256) {
    throw new BackupOperationError('CHECKSUM_MISMATCH', 'Archive checksum differs from manifest.');
  }
  return manifest;
}

export function isManifestFresh(manifest: BackupManifest, nowMs: number, maxAgeMs: number): boolean {
  const created = Date.parse(manifest.createdAt);
  if (Number.isNaN(created)) return false;
  const age = nowMs - created;
  return age >= 0 && age <= maxAgeMs;
}

/**
 * Retention operates only on exact validated manifests. Returns victims
 * (oldest first) beyond `keep` newest valid manifests for the target.
 */
export function selectRetentionVictims(
  manifests: BackupManifest[],
  keep: number,
  targetDatabase: string,
): BackupManifest[] {
  const eligible = manifests
    .filter((m) => m.target.database === targetDatabase)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return eligible.slice(keep);
}

/** Guard: restore targets must be disposable drill names, never live/shared. */
export function assertRestoreTargetAllowed(name: string, activeDatabase: string, incidentDatabase: string): void {
  if (!name.startsWith(RESTORE_DRILL_TARGET_PREFIX)) {
    throw new BackupOperationError('RESTORE_TARGET_PROTECTED', 'Restore target must use the disposable drill prefix.');
  }
  if (name === activeDatabase || name === incidentDatabase) {
    throw new BackupOperationError('RESTORE_TARGET_PROTECTED', 'Restore target must never be the active or incident database.');
  }
  if (!/^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/.test(name)) {
    throw new BackupOperationError('RESTORE_TARGET_MALFORMED', 'Restore target name is malformed.');
  }
}

/** Guard: cleanup may drop only the exact verified disposable target. */
export function assertCleanupTargetAllowed(name: string, verifiedDrillTarget: string, activeDatabase: string, incidentDatabase: string): void {
  if (name !== verifiedDrillTarget) {
    throw new BackupOperationError('CLEANUP_TARGET_MISMATCH', 'Cleanup target differs from the verified drill target.');
  }
  if (name === activeDatabase || name === incidentDatabase) {
    throw new BackupOperationError('CLEANUP_TARGET_PROTECTED', 'Cleanup must never select the active or incident database.');
  }
}

export type BackupRunner = {
  runPgDump: (archivePath: string) => Promise<{ exitCode: number }>;
  runPgRestoreList: (archivePath: string) => Promise<{ exitCode: number; entries: number }>;
  getServerVersion: () => Promise<string>;
  getClientVersion: () => Promise<string>;
  countRows: () => Promise<Record<string, number>>;
};

export function createLiveBackupRunner(pgBinDir: string, databaseUrl: string): BackupRunner {
  const { env, dbName } = connectionEnvFromDatabaseUrl(databaseUrl);
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
  const pgDump = join(pgBinDir, 'pg_dump.exe');
  const pgRestore = join(pgBinDir, 'pg_restore.exe');
  const psql = join(pgBinDir, 'psql.exe');
  return {
    async runPgDump(archivePath) {
      try {
        await execFileAsync(pgDump, ['-Fc', '-f', archivePath, dbName], { env: childEnv, timeout: 10 * 60 * 1000 });
        return { exitCode: 0 };
      } catch (error) {
        const exitCode = typeof (error as { code?: unknown }).code === 'number'
          ? ((error as { code: number }).code as number)
          : 1;
        return { exitCode };
      }
    },
    async runPgRestoreList(archivePath) {
      try {
        const { stdout } = await execFileAsync(pgRestore, ['--list', archivePath], { env: childEnv, timeout: 5 * 60 * 1000 });
        const entries = stdout.split('\n').filter((line) => /^\d+;/.test(line.trim())).length;
        return { exitCode: 0, entries };
      } catch {
        return { exitCode: 1, entries: 0 };
      }
    },
    async getServerVersion() {
      const { stdout } = await execFileAsync(psql, ['-t', '-A', '-c', 'show server_version'], { env: childEnv, timeout: 30000 });
      return stdout.trim();
    },
    async getClientVersion() {
      const { stdout } = await execFileAsync(pgDump, ['--version'], { timeout: 30000 });
      const match = /(\d+\.\d+)/.exec(stdout);
      return match ? match[1] as string : stdout.trim();
    },
    async countRows() {
      const { stdout } = await execFileAsync(
        psql,
        ['-t', '-A', '-F', ',', '-c', 'select (select count(*) from schools),(select count(*) from atlas_auth_accounts),(select count(*) from faculty_mirrors),(select count(*) from section_mirrors),(select count(*) from subjects),(select count(*) from buildings),(select count(*) from rooms),(select count(*) from teaching_load_cycles),(select count(*) from generation_runs)'],
        { env: childEnv, timeout: 60000 },
      );
      const parts = stdout.trim().split(',');
      const keys = ['schools', 'authAccounts', 'facultyMirrors', 'sectionMirrors', 'subjects', 'buildings', 'rooms', 'teachingLoadCycles', 'generationRuns'];
      const counts: Record<string, number> = {};
      keys.forEach((key, index) => {
        counts[key] = Number(parts[index] ?? '0');
      });
      return counts;
    },
  };
}

/** Perform one non-overwriting custom-format backup with manifest. */
export async function performBackup(params: {
  databaseUrl: string;
  config: BackupOperatorConfig;
  runner: BackupRunner;
  now?: Date;
  workspaceDir?: string;
}): Promise<{ archivePath: string; manifestPath: string; manifest: BackupManifest }> {
  const now = params.now ?? new Date();
  const target = sanitizeTargetFromDatabaseUrl(params.databaseUrl);
  const root = canonicalPath(params.config.backupRoot);
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  const { archiveFileName, manifestFileName } = buildArchiveFileName(target.database, now);
  const archivePath = join(root, archiveFileName);
  const manifestPath = join(root, manifestFileName);
  validateDestination(root, archivePath, { workspaceDir: params.workspaceDir });
  if (existsSync(archivePath) || existsSync(manifestPath)) {
    throw new BackupOperationError('ARCHIVE_COLLISION', 'Backup archive already exists; refusing to overwrite.');
  }
  const [clientVersion, serverVersion] = await Promise.all([
    params.runner.getClientVersion(),
    params.runner.getServerVersion(),
  ]);
  checkVersionParity(clientVersion, serverVersion, params.config.requiredPostgresMajor);
  const dump = await params.runner.runPgDump(archivePath);
  if (dump.exitCode !== 0 || !existsSync(archivePath)) {
    throw new BackupOperationError('DUMP_FAILED', 'pg_dump exited nonzero or produced no archive.');
  }
  const listed = await params.runner.runPgRestoreList(archivePath);
  if (listed.exitCode !== 0 || listed.entries <= 0) {
    throw new BackupOperationError('RESTORE_LIST_INVALID', 'pg_restore --list rejected the new archive.');
  }
  const counts = await params.runner.countRows();
  const manifest: BackupManifest = {
    backupTool: BACKUP_TOOL_ID,
    toolVersion: BACKUP_TOOL_VERSION,
    createdAt: now.toISOString(),
    schedule: params.config.schedule,
    target,
    clientVersion,
    serverVersion,
    archiveFileName,
    manifestFileName,
    byteSize: statSync(archivePath).size,
    sha256: sha256OfFile(archivePath),
    dumpExitCode: dump.exitCode,
    counts,
    restoreListExitCode: listed.exitCode,
    restoreListEntries: listed.entries,
    valid: true,
  };
  const check = validateManifestObject(manifest);
  if (!check.ok) {
    throw new BackupOperationError('MANIFEST_INCOMPLETE', `Fresh manifest invalid: ${check.errors.join('; ')}`);
  }
  const tmpPath = `${manifestPath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(manifest, null, 2));
  renameSync(tmpPath, manifestPath);
  return { archivePath, manifestPath, manifest };
}

/** Pre-migration gate: nonzero unless a fresh, valid manifest exists for the exact target. */
export function findFreshBackupForTarget(params: {
  root: string;
  targetDatabase: string;
  nowMs: number;
  maxAgeMs: number;
}): BackupManifest {
  const root = canonicalPath(params.root);
  let files: string[] = [];
  try {
    files = readdirSync(root).filter((f) => f.endsWith('.manifest.json'));
  } catch {
    throw new BackupOperationError('GATE_NO_MANIFEST', 'No backup manifest exists for the target.');
  }
  const fresh: BackupManifest[] = [];
  for (const file of files) {
    let manifest: BackupManifest;
    try {
      manifest = verifyStoredManifest(join(root, file), root);
    } catch {
      continue;
    }
    if (manifest.target.database !== params.targetDatabase) continue;
    if (!isManifestFresh(manifest, params.nowMs, params.maxAgeMs)) continue;
    fresh.push(manifest);
  }
  if (fresh.length === 0) {
    throw new BackupOperationError('GATE_NO_FRESH_MANIFEST', 'No fresh checksum-valid manifest exists for the exact target.');
  }
  fresh.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return fresh[0] as BackupManifest;
}

export type ArchiveRevalidator = {
  runPgRestoreList: (archivePath: string) => Promise<{ exitCode: number; entries: number }>;
};

/**
 * F-06-02 correction: revalidate the selected archive immediately before a
 * guarded migration. Recomputes size + checksum from disk, then runs the
 * configured PostgreSQL `pg_restore --list` against that exact archive and
 * requires exit 0 with a nonzero entry count. A manifest whose stored fields
 * are valid still blocks migration when the current restore-list invocation
 * fails. Dependency-injectable via `revalidator` so the guarded production
 * path is testable without running a real migration.
 */
export async function revalidateArchiveForMigration(params: {
  manifest: BackupManifest;
  root: string;
  revalidator: ArchiveRevalidator;
}): Promise<BackupManifest> {
  const root = canonicalPath(params.root);
  const verified = verifyStoredManifest(join(root, params.manifest.manifestFileName), root);
  if (verified.archiveFileName !== params.manifest.archiveFileName || verified.sha256 !== params.manifest.sha256) {
    throw new BackupOperationError('MANIFEST_CHANGED', 'Selected manifest changed on disk after selection; refusing migration.');
  }
  const archivePath = join(root, verified.archiveFileName);
  const listed = await params.revalidator.runPgRestoreList(archivePath);
  if (listed.exitCode !== 0 || listed.entries <= 0) {
    throw new BackupOperationError('RESTORE_LIST_INVALID', 'Current pg_restore --list rejected the selected archive; migration blocked.');
  }
  return verified;
}

/**
 * Guarded migration selection: pick the fresh target-matching manifest, then
 * revalidate that exact archive (checksum + current restore-list) before the
 * caller spawns Prisma. The caller must spawn `prisma migrate deploy` only
 * after this resolves; any throw blocks the spawn.
 */
export async function selectAndRevalidateBackupForMigration(params: {
  root: string;
  targetDatabase: string;
  nowMs: number;
  maxAgeMs: number;
  revalidator: ArchiveRevalidator;
}): Promise<BackupManifest> {
  const manifest = findFreshBackupForTarget({
    root: params.root,
    targetDatabase: params.targetDatabase,
    nowMs: params.nowMs,
    maxAgeMs: params.maxAgeMs,
  });
  return revalidateArchiveForMigration({ manifest, root: params.root, revalidator: params.revalidator });
}

export type DrillCleanupReport = {
  cleanupAttempted: boolean;
  cleanupOk: boolean;
  cleanupCode: string | null;
  cleanupMessage: string | null;
};

/**
 * F-06-01 correction: run a protected drill operation with guaranteed cleanup.
 *
 * The operation runs first; cleanup runs exactly once afterwards even when the
 * operation throws (restore failure, count/orphan mismatch, smoke failure).
 * A cleanup failure is reported through `reportCleanupFailure` (default:
 * `DRILL_CLEANUP_FAIL` on stderr) without hiding the original operational
 * failure: when both fail, the original error is rethrown and the cleanup
 * code is reported separately. When only cleanup fails, the cleanup error is
 * thrown. Never calls `process.exit()` — the caller maps the thrown error to
 * the process exit code, preserving the original failure code.
 */
export async function runWithGuaranteedCleanup<T>(params: {
  operation: () => Promise<T>;
  cleanup: () => Promise<void>;
  reportCleanupFailure?: (code: string, message: string) => void;
}): Promise<{ result: T; cleanup: DrillCleanupReport }> {
  let result!: T;
  let opError: unknown = null;
  try {
    result = await params.operation();
  } catch (error) {
    opError = error;
  }
  const report: DrillCleanupReport = {
    cleanupAttempted: true,
    cleanupOk: false,
    cleanupCode: null,
    cleanupMessage: null,
  };
  try {
    await params.cleanup();
    report.cleanupOk = true;
  } catch (cleanupError) {
    const code = cleanupError instanceof BackupOperationError ? cleanupError.code : 'CLEANUP_FAILED';
    const message = cleanupError instanceof Error ? cleanupError.message.slice(0, 300) : String(cleanupError).slice(0, 300);
    report.cleanupCode = code;
    report.cleanupMessage = message;
    (params.reportCleanupFailure ?? ((c, m) => console.error(`DRILL_CLEANUP_FAIL code=${c} message=${m}`)))(code, message);
    if (!opError) opError = cleanupError;
  }
  if (opError) throw opError;
  return { result, cleanup: report };
}

/** Enforce retention: delete only validated-lineage victims (archive + manifest). */
export function enforceRetention(params: {
  root: string;
  targetDatabase: string;
  keep: number;
}): { kept: string[]; deleted: string[] } {
  const root = canonicalPath(params.root);
  const files = readdirSync(root).filter((f) => f.endsWith('.manifest.json'));
  const verified: BackupManifest[] = [];
  for (const file of files) {
    try {
      verified.push(verifyStoredManifest(join(root, file), root));
    } catch {
      continue;
    }
  }
  const victims = selectRetentionVictims(verified, params.keep, params.targetDatabase);
  const deleted: string[] = [];
  const victimNames = new Set(victims.map((v) => v.manifestFileName));
  for (const manifest of verified) {
    if (!victimNames.has(manifest.manifestFileName)) continue;
    const archivePath = join(root, manifest.archiveFileName);
    validateDestination(root, archivePath);
    unlinkSync(archivePath);
    unlinkSync(join(root, manifest.manifestFileName));
    deleted.push(manifest.archiveFileName);
  }
  const kept = verified
    .filter((m) => !victimNames.has(m.manifestFileName) && m.target.database === params.targetDatabase)
    .map((m) => m.archiveFileName);
  return { kept, deleted };
}
