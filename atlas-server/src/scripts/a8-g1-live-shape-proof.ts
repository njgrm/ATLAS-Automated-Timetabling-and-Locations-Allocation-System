/**
 * A8-G1 live-shaped before/after proof — spread a section's weekly classes
 * across days, on a WHOLE-DATABASE COPY OF STAGING.
 *
 * Packet:  `docs/prompts/a8-g1-spread-sessions-2026-09-29.md` (rule 3)
 * Approach: `docs/prompts/a8-g1-spread-sessions-approach-2026-09-29-r2.md` (R5)
 *
 * The packet's central proof row is a before/after table on live-shaped data.
 * This script produces it, and it is deliberately built to be hard to run
 * wrongly:
 *
 *  1. It refuses to start unless the disposable target matches
 *     `^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$` and is neither `atlas_db` nor
 *     `atlas_recovery_clean_rebuild_20260905`. The same two names are re-checked
 *     by `assertRestoreTargetAllowed` and `assertCleanupTargetAllowed` from
 *     `database-backup.service.ts`, so the guard is enforced by the shared
 *     primitive and not only by this file.
 *
 *  2. The copy is a WHOLE-DATABASE `pg_dump` | `pg_restore`, reusing the
 *     already-guarded primitives in `atlas-restore-drill.ts`
 *     (`createdb -T template0`, `pg_restore`, `runWithGuaranteedCleanup`,
 *     `assertCleanupTargetAllowed`). There is deliberately NO hand-written
 *     per-table copier: the production preflight reads ~20 tables in FK order
 *     (`generation-preflight.service.ts`), and a partial copy would either fail
 *     on FK order or silently omit a table, producing a decisive-looking but
 *     wrong table.
 *
 *  3. Staging is reached ONLY through a `childEnvFor`-style environment, never
 *     through the `DATABASE_URL`-bound Prisma singleton
 *     (`lib/prisma.ts` binds at import time, so importing it would bind the
 *     singleton to whatever URL is ambient and could read the drill database
 *     while recording the source signature). Every database client in here is
 *     constructed explicitly for one named database.
 *
 *  4. `ROLLOVER_AUTO_SYNC_ENABLED=false`, as the drill sets it, so nothing in
 *     the restored copy can phone home and mutate a source system.
 *
 *  5. Generation-equivalent work runs ONLY against the drill database. The
 *     "before" figure is read the way the packet itself read it: from the
 *     newest COMPLETED run's persisted `draft_entries`, so "before" is the real
 *     production output, not a reconstruction. "After" is the new constructor
 *     over the same restored inputs.
 *
 *  6. The source counts are recorded before and after and must be identical;
 *     the drill database is dropped; and the script proves absence over exactly
 *     the names it created.
 *
 * It never prints a credential and never reads `D:\ATLAS-runtime-config\*`.
 *
 * Usage (from atlas-server/):
 *   npx tsx src/scripts/a8-g1-live-shape-proof.ts --source-env <path-to-env> \
 *     --target atlas_restore_drill_YYYYMMDD_a8g1 [--school-id 1] [--school-year-id 10]
 *   npx tsx src/scripts/a8-g1-live-shape-proof.ts --self-test
 *
 * `--self-test` exercises every guard and every measurement function with NO
 * database, so the harness can be proven runnable up to the database boundary
 * on a machine where this executor holds no database credential.
 */
import 'dotenv/config';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
	BackupOperationError,
	assertCleanupTargetAllowed,
	assertRestoreTargetAllowed,
	runWithGuaranteedCleanup,
	sanitizeTargetFromDatabaseUrl,
} from '../services/database-backup.service.js';

const execFileAsync = promisify(execFile);
const PG_BIN_DIR = process.env.ATLAS_PG_BIN_DIR ?? 'D:\\PostgreSQL\\18\\bin';

const INCIDENT_DATABASE = 'atlas_db';
const RECOVERY_DATABASE = 'atlas_recovery_clean_rebuild_20260905';
const DISPOSABLE_TARGET_PATTERN = /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/;

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

function fail(code: string, message: string): never {
	console.error(`A8G1_PROOF_FAILED code=${code} ${message}`);
	process.exit(1);
}

/**
 * Throw (never `process.exit`) so `runWithGuaranteedCleanup` always runs its
 * cleanup and the drill database is always dropped, even on failure.
 */
function throwFailure(code: string, message: string): never {
	throw new BackupOperationError(code, message);
}

function argValue(args: string[], name: string): string | undefined {
	const index = args.indexOf(name);
	if (index < 0) return undefined;
	return args[index + 1];
}

// ─── Guards ─────────────────────────────────────────────────────────────────

/**
 * The packet's fail-closed rule. Deliberately independent of the shared
 * primitive so the SELF-TEST can prove the rule without a database, and then
 * hands the same name to `assertRestoreTargetAllowed` / `assertCleanupTargetAllowed`
 * so the shared guard agrees.
 */
export function assertDisposableTarget(target: string, activeDatabase: string): void {
	if (!DISPOSABLE_TARGET_PATTERN.test(target)) {
		throw new BackupOperationError(
			'TARGET_NOT_DISPOSABLE',
			`Target "${target}" does not match ${DISPOSABLE_TARGET_PATTERN}. Refusing to run.`,
		);
	}
	if (target === INCIDENT_DATABASE || target === RECOVERY_DATABASE) {
		throw new BackupOperationError('TARGET_PROTECTED', `Target "${target}" is a protected name.`);
	}
	if (target === activeDatabase) {
		throw new BackupOperationError('TARGET_IS_ACTIVE', `Target "${target}" is the active database.`);
	}
}

/**
 * `childEnvFor` from `atlas-restore-drill.ts:49-59`, reproduced rather than
 * imported because that module executes `main()` on import. It is the ONLY way
 * this script ever reaches a database: an explicit PG* environment per named
 * database, never the `DATABASE_URL`-bound Prisma singleton.
 */
function childEnvFor(databaseUrl: string, dbName: string): NodeJS.ProcessEnv {
	const parsed = new URL(databaseUrl);
	const env: NodeJS.ProcessEnv = {
		...process.env,
		PGHOST: parsed.hostname,
		PGPORT: parsed.port || '5432',
		PGDATABASE: dbName,
		// The packet's automation kill-switch, set for every child, exactly as
		// `atlas-restore-drill.ts:205` does for the smoke.
		ROLLOVER_AUTO_SYNC_ENABLED: 'false',
	};
	if (parsed.username) env.PGUSER = decodeURIComponent(parsed.username);
	if (parsed.password) env.PGPASSWORD = decodeURIComponent(parsed.password);
	// Never let a child inherit an ambient DATABASE_URL that could bind the
	// singleton to the wrong database.
	delete env.DATABASE_URL;
	return env;
}

async function psql(dbName: string, sql: string, adminEnv: NodeJS.ProcessEnv): Promise<string> {
	const { stdout } = await execFileAsync(join(PG_BIN_DIR, 'psql.exe'), ['-t', '-A', '-F', ',', '-c', sql], {
		env: { ...adminEnv, PGDATABASE: dbName, PGPASSWORD: adminEnv.PGPASSWORD, PGCONNECT_TIMEOUT: '10' },
		timeout: 60000,
	});
	return stdout.trim();
}

async function databaseExists(dbName: string, adminEnv: NodeJS.ProcessEnv): Promise<boolean> {
	const out = await psql('postgres', `select 1 from pg_database where datname='${dbName.replace(/'/g, "''")}'`, adminEnv);
	return out === '1';
}

// ─── Measurement ────────────────────────────────────────────────────────────
// These are pure functions over an entry list, so `--self-test` can prove the
// numbers are real without a database.

export interface MeasurableEntry {
	facultyId: number;
	roomId: number;
	subjectId: number;
	sectionId: number;
	day: string;
	startTime: string;
	endTime: string;
	entryKind?: 'SECTION' | 'COHORT';
	cohortCode?: string | null;
}

export interface ShapeCounts {
	entryCount: number;
	/** Distinct (section|cohort, subject) pairs holding >1 session on a day. */
	sameDayRepeatPairs: number;
	/** Worst single (pair, day) cell, e.g. 5 for "Filipino x5 - Monday". */
	worstSameDayCount: number;
	teacherOverlaps: number;
	sectionOverlaps: number;
	roomOverlaps: number;
}

function pairKeyOf(entry: MeasurableEntry): string {
	return entry.entryKind === 'COHORT' && entry.cohortCode
		? `${entry.cohortCode}:${entry.subjectId}`
		: `${entry.sectionId}:${entry.subjectId}`;
}

/** Overlap = the same holder booked twice in one (day, interval). */
function countHolderOverlaps(entries: MeasurableEntry[], holder: (entry: MeasurableEntry) => string): number {
	const seen = new Set<string>();
	let overlaps = 0;
	for (const entry of entries) {
		const key = `${holder(entry)}|${entry.day}|${entry.startTime}-${entry.endTime}`;
		if (seen.has(key)) overlaps += 1;
		seen.add(key);
	}
	return overlaps;
}

export function measureShape(entries: MeasurableEntry[]): ShapeCounts {
	const perPairDay = new Map<string, number>();
	for (const entry of entries) {
		const key = `${pairKeyOf(entry)}|${entry.day}`;
		perPairDay.set(key, (perPairDay.get(key) ?? 0) + 1);
	}
	const pairsWithRepeat = new Set<string>();
	let worstSameDayCount = 0;
	for (const [key, count] of perPairDay) {
		if (count < 2) continue;
		pairsWithRepeat.add(key.slice(0, key.lastIndexOf('|')));
		if (count > worstSameDayCount) worstSameDayCount = count;
	}
	return {
		entryCount: entries.length,
		sameDayRepeatPairs: pairsWithRepeat.size,
		worstSameDayCount,
		teacherOverlaps: countHolderOverlaps(entries, (entry) => `t${entry.facultyId}`),
		sectionOverlaps: countHolderOverlaps(entries, (entry) => `s${entry.sectionId}`),
		roomOverlaps: countHolderOverlaps(entries, (entry) => `r${entry.roomId}`),
	};
}

function renderTable(before: ShapeCounts & { unplaced: number; hardViolations: number; seconds: number | null },
	after: ShapeCounts & { unplaced: number; hardViolations: number; seconds: number | null }): string {
	const rows: Array<[string, string, string, string]> = [
		['entries placed', String(before.entryCount), String(after.entryCount), 'same restored inputs, new constructor'],
		['same-day repeat pairs', String(before.sameDayRepeatPairs), String(after.sameDayRepeatPairs), 'TARGET 0 non-block'],
		['worst same-day count', String(before.worstSameDayCount), String(after.worstSameDayCount), 'TARGET <= ceil(sessions/5)'],
		['unplaced', String(before.unplaced), String(after.unplaced), 'MUST NOT RISE (910/920 today)'],
		['teacher overlaps', String(before.teacherOverlaps), String(after.teacherOverlaps), 'MUST STAY 0'],
		['section overlaps', String(before.sectionOverlaps), String(after.sectionOverlaps), 'MUST STAY 0'],
		['room overlaps', String(before.roomOverlaps), String(after.roomOverlaps), 'MUST STAY 0'],
		['hard violations', String(before.hardViolations), String(after.hardViolations), 'MUST STAY 0'],
		['run seconds', before.seconds == null ? 'n/a' : String(before.seconds), after.seconds == null ? 'n/a' : String(after.seconds), 'constructor wall clock'],
	];
	const width = Math.max(...rows.map((row) => row[0].length));
	const head = `| ${'measure'.padEnd(width)} | before   | after    | note`;
	const rule = `| ${'-'.repeat(width)} | -------- | -------- | ----`;
	const body = rows.map((row) => `| ${row[0].padEnd(width)} | ${row[1].padEnd(8)} | ${row[2].padEnd(8)} | ${row[3]}`);
	return [head, rule, ...body].join('\n');
}

// ─── Self-test: every guard and every measurement, no database ──────────────

function selfTest(): void {
	const check = (label: string, fn: () => void) => {
		fn();
		console.log(`  ok  ${label}`);
	};
	const rejects = (label: string, target: string, active = 'atlas_staging') => {
		let threw = false;
		try {
			assertDisposableTarget(target, active);
		} catch {
			threw = true;
		}
		if (!threw) throw new Error(`guard FAILED to reject ${target}`);
		console.log(`  ok  rejects ${label}`);
	};
	const accepts = (label: string, target: string) => {
		assertDisposableTarget(target, 'atlas_staging');
		console.log(`  ok  accepts ${label}`);
	};

	console.log('A8G1_SELF_TEST guards');
	accepts('a well-formed drill target', 'atlas_restore_drill_20260929_a8g1');
	rejects('the live database', 'atlas_db');
	rejects('the recovery database', 'atlas_recovery_clean_rebuild_20260905');
	rejects('a non-drill name', 'atlas_staging');
	rejects('a malformed date', 'atlas_restore_drill_2026_a8g1');
	rejects('an uppercase suffix', 'atlas_restore_drill_20260929_A8G1');
	rejects('the active database', 'atlas_restore_drill_20260929_a8g1', 'atlas_restore_drill_20260929_a8g1');

	console.log('A8G1_SELF_TEST measurement');
	// The live Run 347 shape, transcribed: 8-Makatao (section 27, subject 1,
	// faculty 1) holds all five of its sessions on Monday at 07:30, 08:15,
	// 10:00, 10:45 and 11:30. A second, healthy pair is spread one per day on a
	// DIFFERENT faculty and in non-colliding intervals, so the only thing wrong
	// with this "before" shape is the same-day repeat — exactly as on live,
	// where teacher and section overlaps were both 0.
	const worst: MeasurableEntry[] = [
		{ facultyId: 1, roomId: 31, subjectId: 1, sectionId: 27, day: 'MONDAY', startTime: '07:30', endTime: '08:15' },
		{ facultyId: 1, roomId: 31, subjectId: 1, sectionId: 27, day: 'MONDAY', startTime: '08:15', endTime: '09:00' },
		{ facultyId: 1, roomId: 31, subjectId: 1, sectionId: 27, day: 'MONDAY', startTime: '10:00', endTime: '10:45' },
		{ facultyId: 1, roomId: 31, subjectId: 1, sectionId: 27, day: 'MONDAY', startTime: '10:45', endTime: '11:30' },
		{ facultyId: 1, roomId: 31, subjectId: 1, sectionId: 27, day: 'MONDAY', startTime: '11:30', endTime: '12:15' },
		...DAYS.map((day) => ({
			facultyId: 2, roomId: 32, subjectId: 2, sectionId: 20, day,
			startTime: '07:30', endTime: '08:15',
		})),
	];
	const worstCounts = measureShape(worst);
	check('finds the one repeat pair', () => {
		if (worstCounts.sameDayRepeatPairs !== 1) throw new Error(`expected 1, got ${worstCounts.sameDayRepeatPairs}`);
	});
	check('finds the worst cell of 5', () => {
		if (worstCounts.worstSameDayCount !== 5) throw new Error(`expected 5, got ${worstCounts.worstSameDayCount}`);
	});
	check('the before shape has 0/0/0 overlaps, as live did', () => {
		if (worstCounts.teacherOverlaps || worstCounts.sectionOverlaps || worstCounts.roomOverlaps) {
			throw new Error(
				`expected 0/0/0, got ${worstCounts.teacherOverlaps}/${worstCounts.sectionOverlaps}/${worstCounts.roomOverlaps}`,
			);
		}
	});

	const spread: MeasurableEntry[] = [1, 2, 3, 4, 5].map((index) => ({
		facultyId: 1, roomId: 31, subjectId: 1, sectionId: 27, day: DAYS[index],
		startTime: '07:30', endTime: '08:15',
	}));
	const spreadCounts = measureShape(spread);
	check('a spread run has 0 repeats', () => {
		if (spreadCounts.sameDayRepeatPairs !== 0) throw new Error(`expected 0, got ${spreadCounts.sameDayRepeatPairs}`);
	});
	check('a spread run has 0 overlaps', () => {
		if (spreadCounts.teacherOverlaps || spreadCounts.sectionOverlaps || spreadCounts.roomOverlaps) {
			throw new Error('expected 0/0/0');
		}
	});

	const collided: MeasurableEntry[] = [
		{ facultyId: 5, roomId: 40, subjectId: 1, sectionId: 30, day: 'MONDAY', startTime: '07:30', endTime: '08:15' },
		{ facultyId: 5, roomId: 41, subjectId: 2, sectionId: 31, day: 'MONDAY', startTime: '07:30', endTime: '08:15' },
	];
	const collidedCounts = measureShape(collided);
	check('detects a teacher overlap', () => {
		if (collidedCounts.teacherOverlaps !== 1) throw new Error(`expected 1, got ${collidedCounts.teacherOverlaps}`);
	});
	check('and does not mistake it for a room or section overlap', () => {
		if (collidedCounts.roomOverlaps !== 0 || collidedCounts.sectionOverlaps !== 0) throw new Error('expected 0/0');
	});

	console.log('A8G1_SELF_TEST table renderer');
	const rendered = renderTable(
		{ ...worstCounts, unplaced: 10, hardViolations: 0, seconds: null },
		{ ...spreadCounts, unplaced: 10, hardViolations: 0, seconds: 12.3 },
	);
	const lines = rendered.split('\n');
	if (lines.length !== 11) throw new Error(`expected 11 table lines, got ${lines.length}`);
	if (!lines[0].includes('measure') || !lines[1].startsWith('| -')) {
		throw new Error('the table header is malformed');
	}
	console.log(rendered);

	// The shared primitive must agree with the local guard.
	console.log('A8G1_SELF_TEST shared primitive agreement');
	assertRestoreTargetAllowed('atlas_restore_drill_20260929_a8g1', 'atlas_staging', INCIDENT_DATABASE);
	console.log('  ok  assertRestoreTargetAllowed accepts the drill target');
	let sharedThrew = false;
	try {
		assertCleanupTargetAllowed('atlas_db', 'atlas_db', 'atlas_staging', INCIDENT_DATABASE);
	} catch {
		sharedThrew = true;
	}
	if (!sharedThrew) throw new Error('assertCleanupTargetAllowed accepted a protected name');
	console.log('  ok  assertCleanupTargetAllowed rejects a protected name');

	console.log('A8G1_SELF_TEST_OK');
}

// ─── The real run ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.includes('--self-test')) {
		selfTest();
		return;
	}

	const target = argValue(args, '--target');
	if (!target) fail('ARG_MISSING', '--target <atlas_restore_drill_YYYYMMDD_suffix> is required.');

	// The source URL is supplied by the operator's environment. This script
	// never invents one, never reads `D:\ATLAS-runtime-config\*`, and never
	// prints it.
	const sourceEnvPath = argValue(args, '--source-env');
	if (sourceEnvPath) {
		if (!existsSync(sourceEnvPath)) fail('SOURCE_ENV_MISSING', `--source-env path does not exist: ${sourceEnvPath}`);
		// Loaded, never echoed. Only `DATABASE_URL` is taken from it.
		for (const line of readFileSync(sourceEnvPath, 'utf8').split(/\r?\n/)) {
			const match = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
			if (match && !process.env.DATABASE_URL) process.env.DATABASE_URL = match[1].replace(/^["']|["']$/g, '');
		}
	}
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		fail(
			'CONFIG_MISSING',
			'No DATABASE_URL. Supply the staging URL via --source-env <path-to-env> or an ambient DATABASE_URL. ' +
			'This executor has no credential authority and will not read a credential file to obtain one.',
		);
	}

	const active = sanitizeTargetFromDatabaseUrl(databaseUrl);
	console.log(`A8G1_SOURCE name=${active.database} (read-only pg_dump source)`);
	// Both guards: the local fail-closed rule, then the shared primitive.
	assertDisposableTarget(target, active.database);
	assertRestoreTargetAllowed(target, active.database, INCIDENT_DATABASE);

	const adminEnv = childEnvFor(databaseUrl, 'postgres');
	if (await databaseExists(target, adminEnv)) {
		fail('RESTORE_TARGET_EXISTS', `Disposable target already exists: ${target}. Refusing to restore over it.`);
	}

	// Source signature: recorded before and after, and must be identical.
	const SOURCE_SQL =
		'select (select count(*) from schools),(select count(*) from section_mirrors),' +
		'(select count(*) from subjects),(select count(*) from faculty_mirrors),' +
		'(select count(*) from rooms),(select count(*) from generation_runs),' +
		'(select count(*) from generation_runs where status=\'COMPLETED\')';
	const sourceBefore = await psql(active.database, SOURCE_SQL, childEnvFor(databaseUrl, active.database));
	console.log(`A8G1_SOURCE_SIGNATURE_BEFORE ${sourceBefore.replace(/,/g, '/')}`);

	const archivePath = join(process.env.TEMP ?? process.cwd(), `${target}.dump`);
	await execFileAsync(join(PG_BIN_DIR, 'pg_dump.exe'), ['-Fc', '-f', archivePath, active.database], {
		env: childEnvFor(databaseUrl, active.database),
		timeout: 15 * 60 * 1000,
	});
	console.log(`A8G1_DUMP_OK bytes=${existsSync(archivePath)} archive=${archivePath}`);

	await execFileAsync(join(PG_BIN_DIR, 'createdb.exe'), ['-T', 'template0', target], { env: adminEnv, timeout: 120000 });
	console.log(`A8G1_CREATED name=${target} template=template0`);

	await runWithGuaranteedCleanup({
		operation: async () => {
			try {
				await execFileAsync(join(PG_BIN_DIR, 'pg_restore.exe'), ['-d', target, archivePath], {
					env: childEnvFor(databaseUrl, target),
					timeout: 15 * 60 * 1000,
				});
			} catch (error) {
				throwFailure('RESTORE_FAILED', error instanceof Error ? error.message.slice(0, 300) : String(error));
			}
			console.log(`A8G1_RESTORED name=${target}`);
			await runShapeComparison(target, databaseUrl, sourceBefore);
		},
		cleanup: async () => {
			assertDisposableTarget(target, active.database);
			assertCleanupTargetAllowed(target, target, active.database, INCIDENT_DATABASE);
			await psql('postgres', `select pg_terminate_backend(pid) from pg_stat_activity where datname='${target}' and pid<>pg_backend_pid()`, adminEnv);
			await execFileAsync(join(PG_BIN_DIR, 'dropdb.exe'), [target], { env: adminEnv, timeout: 120000 });
			if (await databaseExists(target, adminEnv)) {
				throw new BackupOperationError('CLEANUP_FAILED', `Disposable target still exists after drop: ${target}`);
			}
			console.log(`A8G1_CLEANUP_OK name=${target} absent=true`);

			// Zero residue over exactly the names this script created.
			const residue = await psql(
				'postgres',
				`select coalesce(string_agg(datname, ','), 'NONE') from pg_database where datname like 'atlas_restore_drill_%' and datname = '${target}'`,
				adminEnv,
			);
			console.log(`A8G1_RESIDUE name=${target} present=${residue !== 'NONE'}`);

			const sourceAfter = await psql(active.database, SOURCE_SQL, childEnvFor(databaseUrl, active.database));
			console.log(`A8G1_SOURCE_SIGNATURE_AFTER  ${sourceAfter.replace(/,/g, '/')}`);
			if (sourceBefore !== sourceAfter) {
				throwFailure('SOURCE_TOUCHED', 'The staging source counts changed during the proof run.');
			}
			console.log('A8G1_SOURCE_UNCHANGED true');
		},
	});
	console.log('A8G1_PROOF_OK');
}

/**
 * Reads the newest COMPLETED run's persisted `draft_entries` as the BEFORE
 * figure (the packet's own read-only-SQL method), then runs the new constructor
 * over the same restored inputs as the AFTER figure.
 */
async function runShapeComparison(target: string, databaseUrl: string, sourceBefore: string): Promise<void> {
	// Imported dynamically so the self-test never touches a database client.
	const { PrismaClient } = await import('@prisma/client');
	const drillUrl = new URL(databaseUrl);
	drillUrl.pathname = `/${target}`;

	// A client constructed EXPLICITLY for the drill database. The
	// `DATABASE_URL`-bound singleton in `lib/prisma.ts` is never imported.
	const drill = new PrismaClient({ datasources: { db: { url: drillUrl.toString() } } });
	try {
		// The newest COMPLETED run that actually carries entries. `draftEntries`
		// is jsonb and Prisma cannot filter on "is a non-empty array" in the
		// query, so the newest COMPLETED run is read and an empty payload is
		// rejected below rather than silently becoming a "before" of zero.
		const run = await drill.generationRun.findFirst({
			where: { status: 'COMPLETED' },
			orderBy: { id: 'desc' },
			select: { id: true, schoolId: true, schoolYearId: true, draftEntries: true, unassignedItems: true, violations: true },
		});
		if (!run) throwFailure('NO_COMPLETED_RUN', 'The restored copy has no COMPLETED generation run to read a BEFORE figure from.');
		if (!Array.isArray(run.draftEntries) || run.draftEntries.length === 0) {
			throwFailure('NO_PERSISTED_ENTRIES', `COMPLETED run ${run.id} carries no draft_entries to measure.`);
		}

		const beforeEntries = (Array.isArray(run.draftEntries) ? run.draftEntries : []) as unknown as MeasurableEntry[];
		const before = {
			...measureShape(beforeEntries),
			unplaced: Array.isArray(run.unassignedItems) ? run.unassignedItems.length : 0,
			hardViolations: Array.isArray(run.violations)
				? (run.violations as Array<{ severity?: string }>).filter((v) => v.severity === 'HARD').length
				: 0,
			seconds: null as number | null,
		};
		console.log(`A8G1_BEFORE_SOURCE run=${run.id} school=${run.schoolId} year=${run.schoolYearId}`);

		const { buildGenerationPreflight, buildPreflightConstructorInput, buildPreflightValidatorContext } =
			await import('../services/generation-preflight.service.js');
		const { constructBaseline } = await import('../services/schedule-constructor.js');
		const { validateHardConstraints } = await import('../services/constraint-validator.js');

		const preflight = await buildGenerationPreflight(run.schoolId, run.schoolYearId, { client: drill as never });
		// The SAME production builders the generation service uses, so the
		// constructor input and the validator context cannot drift from a run.
		const input = buildPreflightConstructorInput(preflight.assembly, { roomerStrategy: 'HOME_ROOM_FIRST' });
		const startedAt = Date.now();
		const result = constructBaseline(input);
		const seconds = (Date.now() - startedAt) / 1000;

		// The production validator context builder, so the HARD count below is the
		// same count the run receipt carries.
		const validation = validateHardConstraints(
			buildPreflightValidatorContext(preflight.assembly as never, result.entries as never, run.id),
		);
		const after = {
			...measureShape(result.entries as unknown as MeasurableEntry[]),
			unplaced: result.unassignedCount,
			hardViolations: validation.violations.filter((v) => v.severity === 'HARD').length,
			seconds,
		};

		console.log('A8G1_SHAPE_TABLE');
		console.log(renderTable(before, after));
		console.log(
			`A8G1_SPREAD_REPORT sameDayRepeatPairs=${result.spreadReport?.sameDayRepeatPairs ?? 0} ` +
			`exceptions=${result.spreadReport?.exceptions.length ?? 0}`,
		);
		if (result.spreadReport?.exceptions.length) {
			for (const exception of result.spreadReport.exceptions.slice(0, 10)) {
				console.log(`A8G1_SPREAD_EXCEPTION ${exception.message}`);
			}
		}

		if (after.unplaced > before.unplaced) {
			throwFailure('UNPLACED_RAISED', `unplaced rose: ${before.unplaced} -> ${after.unplaced}`);
		}
		if (after.teacherOverlaps > 0 || after.sectionOverlaps > 0 || after.roomOverlaps > 0) {
			throwFailure('OVERLAP_INTRODUCED', `overlaps teacher/section/room = ${after.teacherOverlaps}/${after.sectionOverlaps}/${after.roomOverlaps}`);
		}
		if (after.hardViolations > 0) throwFailure('HARD_VIOLATIONS', `hard violations = ${after.hardViolations}`);
	} finally {
		await drill.$disconnect();
	}
}

main().catch((error) => {
	if (error instanceof BackupOperationError) fail(error.code, error.message);
	fail('A8G1_UNKNOWN', error instanceof Error ? error.message : String(error));
});
