/**
 * ATLAS guarded disposable restore drill (Prompt 06, DBR-06.6).
 *
 * Restores one validated backup archive into exactly one guarded disposable
 * database, verifies migration/schema/FK/counts/identity reads, runs a
 * built-server smoke on a non-live port with automation disabled, proves the
 * live service and active database are untouched, then drops the disposable
 * target and proves its absence.
 *
 * Usage (from atlas-server/):
 *   npx tsx src/scripts/atlas-restore-drill.ts --archive <path> --manifest <path> --target atlas_restore_drill_YYYYMMDD_<unique> [--port 5002]
 *
 * Forbidden by construction: restoring over any existing database
 * (`--clean --create` is never used), touching atlas_db, or dropping anything
 * except the verified disposable target.
 */
import 'dotenv/config';
import { execFile } from 'node:child_process';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  BackupOperationError,
  assertCleanupTargetAllowed,
  assertRestoreTargetAllowed,
  runWithGuaranteedCleanup,
  sanitizeTargetFromDatabaseUrl,
  verifyStoredManifest,
} from '../services/database-backup.service.js';

const execFileAsync = promisify(execFile);
const PG_BIN_DIR = process.env.ATLAS_PG_BIN_DIR ?? 'D:\\PostgreSQL\\18\\bin';
const INCIDENT_DATABASE = 'atlas_db';
const LIVE_HEALTH_URL = 'http://127.0.0.1:5001/api/v1/health';

function fail(code: string, message: string): never {
  console.error(`DRILL_FAIL code=${code} message=${message}`);
  process.exit(1);
}

function argValue(args: string[], name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) fail('ARG_MISSING', `${name} <value> is required.`);
  return value as string;
}

function childEnvFor(databaseUrl: string, dbName: string): NodeJS.ProcessEnv {
  const parsed = new URL(databaseUrl);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGDATABASE: dbName,
  };
  if (parsed.username) env.PGUSER = decodeURIComponent(parsed.username);
  if (parsed.password) env.PGPASSWORD = decodeURIComponent(parsed.password);
  return env;
}

async function psql(dbName: string, sql: string, adminEnv: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await execFileAsync(join(PG_BIN_DIR, 'psql.exe'), ['-t', '-A', '-F', ',', '-c', sql], {
    env: adminEnv,
    timeout: 60000,
  });
  return stdout.trim();
}

async function databaseExists(dbName: string, adminEnv: NodeJS.ProcessEnv): Promise<boolean> {
  const out = await psql('postgres', `select 1 from pg_database where datname='${dbName.replace(/'/g, "''")}'`, adminEnv);
  return out === '1';
}

async function fetchHealth(url: string, timeoutMs: number): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForHealth(url: string, attempts: number, delayMs: number): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    if ((await fetchHealth(url, 5000)) === 200) return true;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

function stopChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already dead */ }
      resolve();
    }, 10000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try { child.kill('SIGTERM'); } catch { clearTimeout(timer); resolve(); }
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const archivePath = argValue(args, '--archive');
  const manifestPath = argValue(args, '--manifest');
  const target = argValue(args, '--target');
  const portIndex = args.indexOf('--port');
  const portRaw = portIndex >= 0 ? args[portIndex + 1] : '5002';
  const smokePort = Number(portRaw);
  const port = Number.isInteger(smokePort) && smokePort > 0 ? smokePort : 5002;
  if (port === 5001) fail('ARG_INVALID', 'Smoke port must not be the live port 5001.');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('CONFIG_MISSING', 'DATABASE_URL is not configured.');
  const active = sanitizeTargetFromDatabaseUrl(databaseUrl as string);
  assertRestoreTargetAllowed(target, active.database, INCIDENT_DATABASE);

  if (!existsSync(archivePath)) fail('ARCHIVE_MISSING', 'Archive path does not exist.');
  const manifest = verifyStoredManifest(manifestPath, join(manifestPath, '..'));
  if (manifest.archiveFileName !== archivePath.split(/[\\/]/).pop()) {
    fail('MANIFEST_ARCHIVE_MISMATCH', 'Manifest does not describe the supplied archive.');
  }
  console.log(`DRILL_MANIFEST_OK archive=${manifest.archiveFileName} sha256=${manifest.sha256}`);

  const adminEnv = childEnvFor(databaseUrl as string, 'postgres');
  if (await databaseExists(target, adminEnv)) {
    fail('RESTORE_TARGET_EXISTS', 'Disposable target already exists; refusing to restore over it.');
  }
  console.log(`DRILL_TARGET_ABSENT name=${target}`);

  const liveBefore = await fetchHealth(LIVE_HEALTH_URL, 10000);
  const activeCountsBefore = await psql(active.database, 'select (select count(*) from schools),(select count(*) from atlas_auth_accounts)', childEnvFor(databaseUrl as string, active.database));

  await execFileAsync(join(PG_BIN_DIR, 'createdb.exe'), ['-T', 'template0', target], { env: adminEnv, timeout: 120000 });
  console.log(`DRILL_CREATED name=${target} template=template0`);

  // Every failure below runs cleanup via try/finally inside
  // `runWithGuaranteedCleanup`. Nothing in the protected operation calls
  // `fail()`/`process.exit()` directly — failures throw and the original code
  // is preserved for the single exit point after cleanup.
  const throwFailure = (code: string, message: string): never => {
    throw new BackupOperationError(code, message);
  };

  await runWithGuaranteedCleanup({
    operation: async () => {
      let child: ChildProcess | null = null;
      try {
        try {
          await execFileAsync(join(PG_BIN_DIR, 'pg_restore.exe'), ['-d', target, archivePath], {
            env: childEnvFor(databaseUrl as string, target),
            timeout: 10 * 60 * 1000,
          });
        } catch (error) {
          throwFailure('RESTORE_FAILED', error instanceof Error ? error.message.slice(0, 300) : String(error));
        }
        console.log(`DRILL_RESTORED name=${target}`);

        const drillEnv = childEnvFor(databaseUrl as string, target);
        const migrationRows = await psql(target, 'select count(*) from _prisma_migrations', drillEnv);
        const orphanAuth = await psql(target, 'select count(*) from atlas_auth_accounts a left join faculty_mirrors f on f.id=a.faculty_id where a.faculty_id is not null and f.id is null', drillEnv);
        const orphanRooms = await psql(target, 'select count(*) from rooms r left join buildings b on b.id=r.building_id where b.id is null', drillEnv);
        const drillCounts = await psql(target, 'select (select count(*) from schools),(select count(*) from atlas_auth_accounts),(select count(*) from faculty_mirrors),(select count(*) from section_mirrors),(select count(*) from subjects),(select count(*) from buildings),(select count(*) from rooms)', drillEnv);
        const [dSchools, dAuth, dFaculty, dSections, dSubjects, dBuildings, dRooms] = drillCounts.split(',');
        const expected: Record<string, string | undefined> = {
          schools: String(manifest.counts.schools ?? ''),
          authAccounts: String(manifest.counts.authAccounts ?? ''),
          facultyMirrors: String(manifest.counts.facultyMirrors ?? ''),
          sectionMirrors: String(manifest.counts.sectionMirrors ?? ''),
          subjects: String(manifest.counts.subjects ?? ''),
          buildings: String(manifest.counts.buildings ?? ''),
          rooms: String(manifest.counts.rooms ?? ''),
        };
        const actual: Record<string, string | undefined> = {
          schools: dSchools, authAccounts: dAuth, facultyMirrors: dFaculty, sectionMirrors: dSections, subjects: dSubjects, buildings: dBuildings, rooms: dRooms,
        };
        for (const key of Object.keys(expected)) {
          if (expected[key] !== actual[key]) {
            throwFailure('DRILL_COUNT_MISMATCH', `Count ${key}: manifest=${expected[key]} drill=${actual[key]}.`);
          }
        }
        if (orphanAuth !== '0' || orphanRooms !== '0') {
          throwFailure('DRILL_ORPHANS', `Orphan rows: auth=${orphanAuth} rooms=${orphanRooms}.`);
        }
        const sampleEmail = await psql(target, "select email from atlas_auth_accounts where role='faculty' order by id limit 1", drillEnv);
        if (!sampleEmail || !sampleEmail.includes('@')) throwFailure('DRILL_IDENTITY_READ', 'Representative faculty identity read failed.');
        console.log(`DRILL_VERIFIED migrations=${migrationRows} orphans=0 counts=${drillCounts} identity=ok`);

        const serverEntry = join(process.cwd(), 'dist', 'server.js');
        if (!existsSync(serverEntry)) throwFailure('SMOKE_NO_BUILD', 'Built server dist/server.js is missing; run npm run build first.');
        const drillUrl = new URL(databaseUrl as string);
        drillUrl.pathname = `/${target}`;
        const smokeEnv: NodeJS.ProcessEnv = {
          ...process.env,
          DATABASE_URL: drillUrl.toString(),
          PORT: String(port),
          ROLLOVER_AUTO_SYNC_ENABLED: 'false',
        };
        child = spawn(process.execPath, [serverEntry], { env: smokeEnv, stdio: 'ignore' });
        const smokeUrl = `http://127.0.0.1:${port}/api/v1/health`;
        const smokeOk = await waitForHealth(smokeUrl, 30, 2000);
        if (!smokeOk) throwFailure('SMOKE_FAILED', `Built server on drill database did not answer ${smokeUrl}.`);
        console.log(`DRILL_SMOKE_OK port=${port} automation=disabled`);

        const liveAfter = await fetchHealth(LIVE_HEALTH_URL, 10000);
        const activeCountsAfter = await psql(active.database, 'select (select count(*) from schools),(select count(*) from atlas_auth_accounts)', childEnvFor(databaseUrl as string, active.database));
        if (liveBefore !== 200 || liveAfter !== 200) throwFailure('LIVE_TOUCHED', `Live health changed: before=${liveBefore} after=${liveAfter}.`);
        if (activeCountsBefore !== activeCountsAfter) throwFailure('ACTIVE_TOUCHED', 'Active database counts changed during drill.');
        console.log(`DRILL_LIVE_UNTOUCHED port=5001 health=200 activeCounts=${activeCountsAfter}`);
      } finally {
        if (child) await stopChild(child);
      }
    },
    cleanup: async () => {
      assertCleanupTargetAllowed(target, target, active.database, INCIDENT_DATABASE);
      await psql('postgres', `select pg_terminate_backend(pid) from pg_stat_activity where datname='${target}' and pid<>pg_backend_pid()`, adminEnv);
      await execFileAsync(join(PG_BIN_DIR, 'dropdb.exe'), [target], { env: adminEnv, timeout: 120000 });
      if (await databaseExists(target, adminEnv)) {
        throw new BackupOperationError('CLEANUP_FAILED', 'Disposable target still exists after drop.');
      }
      console.log(`DRILL_CLEANUP_OK name=${target} absent=true`);
    },
  });
}

main().catch((error) => {
  if (error instanceof BackupOperationError) fail(error.code, error.message);
  fail('DRILL_UNKNOWN', error instanceof Error ? error.message : String(error));
});
