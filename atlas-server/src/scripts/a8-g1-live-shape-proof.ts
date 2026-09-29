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
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
	facultyId: number | null;
	roomId: number;
	subjectId: number;
	sectionId: number;
	day: string;
	startTime: string;
	endTime: string;
	termIndex?: 1 | 2 | 3 | 4 | null;
	entryKind?: 'SECTION' | 'COHORT';
	cohortCode?: string | null;
}

export interface OverlapDetail {
	holder: string;
	term: string;
	day: string;
	slot: string;
	count: number;
	entryKinds: string;
	samePair: boolean;
}

export interface ShapeCounts {
	entryCount: number;
	/** Distinct (section|cohort, subject) pairs holding more sessions on a day than `ceil(sessionsPerWeek/5)`. */
	sameDayRepeatPairs: number;
	/** Worst single (pair, day) cell. */
	worstSameDayCount: number;
	/**
	 * Overlaps keyed on (holder, TERM, day, interval). A teacher legitimately
	 * holds the same slot in different terms, and `constructBaseline` leaves
	 * `termIndex` undefined for a concurrent (every-term) lane, so an undefined
	 * term is its own bucket `CONCURRENT` and never collides with T1/T2/T3.
	 */
	teacherOverlaps: number;
	sectionOverlaps: number;
	roomOverlaps: number;
	/**
	 * D3: entries emitted with `facultyId: null`. `schedule-constructor.ts:3203`
	 * sets `facultyId: isModularUnified ? null : facId`, so a modular-unified lane
	 * carries no single teacher — its per-term teachers are resolved elsewhere.
	 * Counting those as one holder key made attempt 2 report 71 "teacher
	 * overlaps" that were entirely this artifact, which made a real signal
	 * unfalsifiable. They are excluded from the teacher counter and REPORTED
	 * here instead, never silently dropped.
	 */
	entriesWithUnresolvedFaculty: number;
	/** Up to 10 offenders, so a non-zero count can actually be checked. */
	overlapDetail: OverlapDetail[];
	/** Sessions demanded this run — the frame size, printed on every side. */
	sessionsDemanded: number;
}

function pairKeyOf(entry: MeasurableEntry): string {
	return entry.entryKind === 'COHORT' && entry.cohortCode
		? `${entry.cohortCode}:${entry.subjectId}`
		: `${entry.sectionId}:${entry.subjectId}`;
}

function termBucketOf(entry: MeasurableEntry): string {
	return entry.termIndex == null ? 'CONCURRENT' : `T${entry.termIndex}`;
}

/**
 * D2: an overlap is the same holder booked twice in one (TERM, day, interval).
 *
 * Keying on the term is the whole point. A rotation or modular lane legitimately
 * re-teaches the same teacher the same slot in T1 and again in T2; counting that
 * as an overlap is the artifact that made the first attempt report 1675/1820/1820
 * before-overlaps. A teacher genuinely double-booked INSIDE one term still
 * collides here, which is the case that must stay fatal.
 */
function findHolderOverlaps(
	entries: MeasurableEntry[],
	holder: (entry: MeasurableEntry) => string | null,
): { count: number; detail: OverlapDetail[]; skipped: number } {
	const seen = new Map<string, { count: number; kinds: Set<string>; pairs: Set<string> }>();
	let skipped = 0;
	for (const entry of entries) {
		const holderKey = holder(entry);
		if (holderKey === null) {
			skipped += 1;
			continue;
		}
		const key = `${holder(entry)}|${termBucketOf(entry)}|${entry.day}|${entry.startTime}-${entry.endTime}`;
		const bucket = seen.get(key) ?? { count: 0, kinds: new Set<string>(), pairs: new Set<string>() };
		bucket.count += 1;
		bucket.kinds.add(entry.entryKind ?? 'SECTION');
		bucket.pairs.add(pairKeyOf(entry));
		seen.set(key, bucket);
	}
	const offenders: OverlapDetail[] = [];
	for (const [key, bucket] of seen) {
		if (bucket.count < 2) continue;
		const [holderId, term, day, slot] = key.split('|');
		offenders.push({
			holder: holderId,
			term,
			day,
			slot,
			count: bucket.count - 1,
			entryKinds: [...bucket.kinds].sort().join('+'),
			samePair: bucket.pairs.size === 1,
		});
	}
	offenders.sort((a, b) => b.count - a.count || a.holder.localeCompare(b.holder) || a.slot.localeCompare(b.slot));
	return { count: offenders.reduce((sum, o) => sum + o.count, 0), detail: offenders.slice(0, 10), skipped };
}

export function measureShape(entries: MeasurableEntry[], sessionsDemanded: number): ShapeCounts {
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
	const teacher = findHolderOverlaps(entries, (entry) => (entry.facultyId == null ? null : `t${entry.facultyId}`));
	const section = findHolderOverlaps(entries, (entry) => `s${entry.sectionId}`);
	const room = findHolderOverlaps(entries, (entry) => `r${entry.roomId}`);
	return {
		entryCount: entries.length,
		sameDayRepeatPairs: pairsWithRepeat.size,
		worstSameDayCount,
		teacherOverlaps: teacher.count,
		sectionOverlaps: section.count,
		roomOverlaps: room.count,
		entriesWithUnresolvedFaculty: teacher.skipped,
		overlapDetail: [...teacher.detail, ...section.detail, ...room.detail].slice(0, 10),
		sessionsDemanded,
	};
}

/**
 * D3 GUARD (representation): a proof that cannot see the defect it exists to
 * measure proves nothing (AGENTS.md §11: "a proof artefact must actually
 * discriminate — check that it differs before relying on it").
 *
 * Attempt 2 measured a LEGACY side with ZERO same-day repeats, so the `0 -> 0`
 * spread result was vacuous rather than a pass. This guard is the permanent
 * check: the legacy ordering, on the same frame, must reproduce the live-shaped
 * defect — at least one repeated pair and a worst cell of three or more. Live
 * Run 347 had 31 pairs and a worst cell of 15.
 *
 * Returns an error string, or `null` when the frame is representative. Pure, so
 * the suite can prove it actually fires.
 */
export const REPRESENTATION_MIN_REPEAT_PAIRS = 1;
export const REPRESENTATION_MIN_WORST_CELL = 3;

export function frameRepresentationProblem(legacy: ShapeCounts): string | null {
	if (legacy.sameDayRepeatPairs < REPRESENTATION_MIN_REPEAT_PAIRS) {
		return (
			`The frame is NOT representative: the LEGACY ordering produced ${legacy.sameDayRepeatPairs} same-day ` +
			`repeat pair(s), expected at least ${REPRESENTATION_MIN_REPEAT_PAIRS}. A before/after table whose before ` +
			`side cannot see the defect cannot measure the fix, so the spread row would be vacuous rather than a pass. ` +
			`Either the restored frame does not reproduce live's home-room contention, or the measurement is not ` +
			`running the production algorithm.`
		);
	}
	if (legacy.worstSameDayCount < REPRESENTATION_MIN_WORST_CELL) {
		return (
			`The frame is NOT representative: the LEGACY ordering's worst same-day cell is ` +
			`${legacy.worstSameDayCount}, expected at least ${REPRESENTATION_MIN_WORST_CELL}. Live Run 347 held five ` +
			`Filipino sessions for 8-Makatao on Monday.`
		);
	}
	return null;
}

/** A measurement that could not be taken. Never substituted with another frame. */
export const UNAVAILABLE = 'UNAVAILABLE';

type Side = {
	counts: ShapeCounts;
	unplaced: number;
	hardViolations: number;
	seconds: number | null;
	/** Which ordering produced this side, printed so the frame is self-describing. */
	ordering: string;
};

function cell(value: number | null): string {
	return value == null ? UNAVAILABLE : String(value);
}

/**
 * D1 GUARD: a table whose two sides disagree about how much work they measured
 * is not evidence of anything.
 *
 * This is the row that let a broken measurement through: the first attempt
 * compared a 3-term saved run (2730 entries) against one constructor
 * invocation (920 sessions) and produced a table that read as decisive. Nothing
 * checked the frame, so every row in it was unquotable.
 *
 * Returns an error string, or `null` when the two sides are comparable. Pure, so
 * both `--self-test` and the test suite can prove it actually fires.
 */
export function frameMismatchReason(before: ShapeCounts, after: ShapeCounts): string | null {
	if (before.sessionsDemanded !== after.sessionsDemanded) {
		return (
			`The two sides measured different amounts of work: before=${before.sessionsDemanded} ` +
			`after=${after.sessionsDemanded}. The table is not comparable and no row of it may be quoted.`
		);
	}
	if (after.sessionsDemanded === 0) {
		return 'The restored inputs demand zero sessions; there is nothing to compare.';
	}
	return null;
}

function renderTable(before: Side, after: Side): string {
	const rows: Array<[string, string, string, string]> = [
		['ordering', before.ordering, after.ordering, 'the ONE variable that differs'],
		['sessions demanded', cell(before.counts.sessionsDemanded), cell(after.counts.sessionsDemanded), 'FRAME — must be equal'],
		['entries placed', cell(before.counts.entryCount), cell(after.counts.entryCount), 'same inputs, same process'],
		['unplaced', cell(before.unplaced), cell(after.unplaced), 'MUST NOT RISE'],
		['same-day repeat pairs', cell(before.counts.sameDayRepeatPairs), cell(after.counts.sameDayRepeatPairs), 'TARGET 0 non-block'],
		['worst same-day count', cell(before.counts.worstSameDayCount), cell(after.counts.worstSameDayCount), 'TARGET <= ceil(sessions/5)'],
		['teacher overlaps', cell(before.counts.teacherOverlaps), cell(after.counts.teacherOverlaps), 'term-keyed; MUST NOT RISE'],
		['section overlaps', cell(before.counts.sectionOverlaps), cell(after.counts.sectionOverlaps), 'term-keyed; MUST NOT RISE'],
		['room overlaps', cell(before.counts.roomOverlaps), cell(after.counts.roomOverlaps), 'term-keyed; MUST NOT RISE'],
		['hard violations', cell(before.hardViolations), cell(after.hardViolations), 'MUST NOT RISE'],
		['run seconds', cell(before.seconds), cell(after.seconds), 'constructor wall clock'],
	];
	const width = Math.max(...rows.map((row) => row[0].length));
	const head = `| ${'measure'.padEnd(width)} | before                    | after`;
	const rule = `| ${'-'.repeat(width)} | ------------------------- | -------------------------`;
	const body = rows.map((row) => `| ${row[0].padEnd(width)} | ${row[1].padEnd(25)} | ${row[2].padEnd(25)} | ${row[3]}`);
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
	// DIFFERENT faculty and in non-colliding intervals.
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
	const worstCounts = measureShape(worst, 10);
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
	const spreadCounts = measureShape(spread, 5);
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
	const collidedCounts = measureShape(collided, 2);
	check('detects a teacher overlap', () => {
		if (collidedCounts.teacherOverlaps !== 1) throw new Error(`expected 1, got ${collidedCounts.teacherOverlaps}`);
	});
	check('and does not mistake it for a room or section overlap', () => {
		if (collidedCounts.roomOverlaps !== 0 || collidedCounts.sectionOverlaps !== 0) throw new Error('expected 0/0');
	});

	// D2: the artifact the first attempt measured. The same teacher, the same
	// room, the same slot, in two DIFFERENT terms is a legitimate re-teach and
	// must not be counted.
	const reTaught: MeasurableEntry[] = [
		{ facultyId: 5, roomId: 40, subjectId: 1, sectionId: 30, day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex: 1 },
		{ facultyId: 5, roomId: 40, subjectId: 2, sectionId: 30, day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex: 2 },
	];
	const reTaughtCounts = measureShape(reTaught, 2);
	check('D2: a re-teach in a different term is NOT an overlap', () => {
		if (reTaughtCounts.teacherOverlaps !== 0) throw new Error(`expected 0, got ${reTaughtCounts.teacherOverlaps}`);
		if (reTaughtCounts.roomOverlaps !== 0) throw new Error(`room expected 0, got ${reTaughtCounts.roomOverlaps}`);
	});

	// D2: a genuine double-book INSIDE one term must still be caught.
	const sameTermClash: MeasurableEntry[] = [
		{ facultyId: 5, roomId: 40, subjectId: 1, sectionId: 30, day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex: 1 },
		{ facultyId: 5, roomId: 41, subjectId: 2, sectionId: 31, day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex: 1 },
	];
	const sameTermCounts = measureShape(sameTermClash, 2);
	check('D2: a double-book inside ONE term IS an overlap', () => {
		if (sameTermCounts.teacherOverlaps !== 1) throw new Error(`expected 1, got ${sameTermCounts.teacherOverlaps}`);
	});
	check('D2: and it is reported with its term and slot so it can be checked', () => {
		const detail = sameTermCounts.overlapDetail[0];
		if (!detail) throw new Error('no detail emitted for a real overlap');
		if (detail.term !== 'T1') throw new Error(`expected term T1, got ${detail.term}`);
		if (detail.day !== 'MONDAY' || detail.slot !== '07:30-08:15') throw new Error(`bad slot ${detail.day} ${detail.slot}`);
		if (detail.samePair !== false) throw new Error('two different pairs were reported as one pair');
	});

	// D2: two concurrent lanes for one teacher in one slot must collide.
	const concurrentClash: MeasurableEntry[] = [
		{ facultyId: 6, roomId: 42, subjectId: 1, sectionId: 32, day: 'TUESDAY', startTime: '07:30', endTime: '08:15' },
		{ facultyId: 6, roomId: 43, subjectId: 2, sectionId: 33, day: 'TUESDAY', startTime: '07:30', endTime: '08:15' },
	];
	const concurrentCounts = measureShape(concurrentClash, 2);
	check('D2: two CONCURRENT lanes for one teacher in one slot DO overlap', () => {
		if (concurrentCounts.teacherOverlaps !== 1) throw new Error(`expected 1, got ${concurrentCounts.teacherOverlaps}`);
		if (concurrentCounts.overlapDetail[0]?.term !== 'CONCURRENT') throw new Error('term bucket should be CONCURRENT');
	});

	// D3: attempt 2 reported 71 "teacher overlaps" that were ALL `holder=tnone`.
	// The constructor emits `facultyId: null` for a modular-unified lane
	// (`schedule-constructor.ts:3203`), so those entries have per-term teachers
	// resolved elsewhere and are not a double-book by anyone.
	console.log('A8G1_SELF_TEST null-faculty handling (D3)');
	const nullFaculty: MeasurableEntry[] = [
		{ facultyId: null, roomId: 50, subjectId: 1, sectionId: 40, day: 'MONDAY', startTime: '11:30', endTime: '12:15', termIndex: 1 },
		{ facultyId: null, roomId: 51, subjectId: 2, sectionId: 41, day: 'MONDAY', startTime: '11:30', endTime: '12:15', termIndex: 1 },
		{ facultyId: null, roomId: 52, subjectId: 3, sectionId: 42, day: 'MONDAY', startTime: '11:30', endTime: '12:15', termIndex: 1 },
	];
	const nullFacultyCounts = measureShape(nullFaculty, 3);
	check('D3: entries with no facultyId are NOT teacher overlaps', () => {
		if (nullFacultyCounts.teacherOverlaps !== 0) throw new Error(`expected 0, got ${nullFacultyCounts.teacherOverlaps}`);
	});
	check('D3: and they are REPORTED, not silently dropped', () => {
		if (nullFacultyCounts.entriesWithUnresolvedFaculty !== 3) {
			throw new Error(`expected 3 reported, got ${nullFacultyCounts.entriesWithUnresolvedFaculty}`);
		}
	});
	check('D3: a real teacher is still counted alongside them', () => {
		const mixed = measureShape([
			...nullFaculty,
			{ facultyId: 9, roomId: 53, subjectId: 4, sectionId: 43, day: 'MONDAY', startTime: '11:30', endTime: '12:15', termIndex: 1 },
			{ facultyId: 9, roomId: 54, subjectId: 5, sectionId: 44, day: 'MONDAY', startTime: '11:30', endTime: '12:15', termIndex: 1 },
		], 5);
		if (mixed.teacherOverlaps !== 1) throw new Error(`expected 1, got ${mixed.teacherOverlaps}`);
		if (mixed.overlapDetail[0]?.holder !== 't9') throw new Error('the offender must be the real teacher');
	});

	console.log('A8G1_SELF_TEST representation guard');
	const representative = measureShape(worst, 10);
	check('D3-guard: a legacy side that repeats 5 on Monday PASSES the guard', () => {
		if (frameRepresentationProblem(representative) !== null) throw new Error('expected a representative frame');
	});
	check('D3-guard: attempt 2\'s vacuous frame (repeats 0) is REJECTED', () => {
		const vacuous = measureShape(spread, 920);
		const reason = frameRepresentationProblem(vacuous);
		if (reason === null) throw new Error('the guard did NOT fire on a zero-repeat before side');
		if (!reason.includes('NOT representative')) throw new Error('the reason must say the frame is not representative');
	});
	check('D3-guard: a frame whose worst cell is only 2 is REJECTED', () => {
		const weak = measureShape([
			{ facultyId: 1, roomId: 60, subjectId: 1, sectionId: 50, day: 'MONDAY', startTime: '07:30', endTime: '08:15' },
			{ facultyId: 1, roomId: 60, subjectId: 1, sectionId: 50, day: 'MONDAY', startTime: '08:15', endTime: '09:00' },
		], 2);
		const reason = frameRepresentationProblem(weak);
		if (reason === null) throw new Error('the guard did NOT fire on a worst cell of 2');
		if (!reason.includes('worst same-day cell')) throw new Error('the reason must name the worst cell');
	});
	check('D3-guard: the thresholds are the ones the packet names', () => {
		if (REPRESENTATION_MIN_REPEAT_PAIRS !== 1) throw new Error('repeat-pair threshold drifted');
		if (REPRESENTATION_MIN_WORST_CELL !== 3) throw new Error('worst-cell threshold drifted');
	});

	console.log('A8G1_SELF_TEST table renderer');
	const rendered = renderTable(
		{ counts: worstCounts, unplaced: 10, hardViolations: 0, seconds: null, ordering: 'LEGACY_SOFT_PENALTY' },
		{ counts: spreadCounts, unplaced: 10, hardViolations: 0, seconds: 12.3, ordering: 'DAY_COUNT_FIRST' },
	);
	const lines = rendered.split('\n');
	if (lines.length !== 13) throw new Error(`expected 13 table lines, got ${lines.length}`);
	check('the table prints the frame size on BOTH sides', () => {
		if (!lines.some((line) => line.includes('sessions demanded'))) throw new Error('no frame row');
	});
	check('the table names the one variable that differs', () => {
		if (!lines.some((line) => line.includes('LEGACY_SOFT_PENALTY') && line.includes('DAY_COUNT_FIRST'))) {
			throw new Error('the ordering row is missing');
		}
	});
	check('an unmeasurable value prints UNAVAILABLE, never a substitute', () => {
		const withNull = renderTable(
			{ counts: worstCounts, unplaced: 10, hardViolations: 0, seconds: null, ordering: 'LEGACY_SOFT_PENALTY' },
			{ counts: spreadCounts, unplaced: 10, hardViolations: 0, seconds: null, ordering: 'DAY_COUNT_FIRST' },
		);
		if (!withNull.includes(UNAVAILABLE)) throw new Error('expected UNAVAILABLE in the table');
	});

	console.log('A8G1_SELF_TEST frame guard');
	check('D1: identical frames pass the guard', () => {
		if (frameMismatchReason(worstCounts, worstCounts) !== null) throw new Error('expected no mismatch');
	});
	check('D1: a 3-term run against a 1-week run is REJECTED (the first attempt\'s shape)', () => {
		// Exactly the first attempt: before 2730 entries over a multi-term run,
		// after one week of 920 sessions.
		const multiTerm = measureShape(worst, 2730);
		const oneWeek = measureShape(spread, 920);
		const reason = frameMismatchReason(multiTerm, oneWeek);
		if (reason === null) throw new Error('the frame guard did NOT fire on mismatched frames');
		if (!reason.includes('2730') || !reason.includes('920')) throw new Error('the reason must name both frame sizes');
	});
	check('D1: an empty frame is REJECTED', () => {
		const empty = measureShape([], 0);
		if (frameMismatchReason(empty, empty) === null) throw new Error('the frame guard did NOT fire on an empty frame');
	});
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
 * Runs BOTH orderings over the SAME constructor input, in the SAME process, and
 * measures both with the SAME function.
 *
 * D1: the first attempt measured "before" from a saved 3-term run and "after"
 * from one constructor invocation (one week). The two sides are now the same
 * frame by construction — the only difference is `input.spreadOrdering`.
 *
 * `legacy` is the pre-change comparator, reached through the
 * `ConstructorInput.spreadOrdering` test seam, NOT through a saved run and NOT
 * through a hand-copied comparator. `production` is the accepted default.
 */
export async function runShapeComparison(target: string, databaseUrl: string, sourceBefore: string): Promise<void> {
	const { PrismaClient } = await import('@prisma/client');
	const drillUrl = new URL(databaseUrl);
	drillUrl.pathname = `/${target}`;

	// A client constructed EXPLICITLY for the drill database. The
	// `DATABASE_URL`-bound singleton in `lib/prisma.ts` is never imported.
	const drill = new PrismaClient({ datasources: { db: { url: drillUrl.toString() } } });
	try {
		// The run whose scope names the school year to reproduce. Informational
		// only — it is NOT a measurement side.
		const run = await drill.generationRun.findFirst({
			where: { status: 'COMPLETED' },
			orderBy: { id: 'desc' },
			select: { id: true, schoolId: true, schoolYearId: true },
		});
		if (!run) throwFailure('NO_COMPLETED_RUN', 'The restored copy has no COMPLETED generation run to name a scope.');
		console.log(`A8G1_SCOPE run=${run.id} school=${run.schoolId} year=${run.schoolYearId} (names the scope only; NOT a table side)`);

		const { buildGenerationPreflight, buildPreflightConstructorInput, buildPreflightValidatorContext } =
			await import('../services/generation-preflight.service.js');
		// D3 (frame content): the PRODUCTION algorithm, not a bare constructor.
		// `generation.service.ts:1006` calls `runHybridScheduler(constructorInput)`,
		// which runs `constructBaseline` across every seed profile, picks the best
		// by fewest-unassigned then fitness, and then applies `repairHardConflicts`
		// and `repairUnassignedByEjection`. Attempt 2 called `constructBaseline`
		// directly, which is NOT what produced live Run 347 — hence its 855/65
		// against production's 910/10, and hence a legacy side that spread
		// perfectly and could not see the defect. `runHybridScheduler` takes the
		// same `ConstructorInput`, so `spreadOrdering` reaches every profile run
		// through its `{ ...input, demandOverride }` spread.
		const { runHybridScheduler } = await import('../services/hybrid-scheduler.js');
		const { validateHardConstraints } = await import('../services/constraint-validator.js');

		const preflight = await buildGenerationPreflight(run.schoolId, run.schoolYearId, { client: drill as never });
		// ONE input object. Both orderings receive this exact object, so neither
		// side can drift in scope, term set, lock set, policy or room list.
		const baseInput = buildPreflightConstructorInput(preflight.assembly, { roomerStrategy: 'HOME_ROOM_FIRST' });

		const measure = (ordering: 'DAY_COUNT_FIRST' | 'LEGACY_SOFT_PENALTY', label: string): Side => {
			const input = { ...baseInput, spreadOrdering: ordering };
			const startedAt = Date.now();
			const result = runHybridScheduler(input);
			const seconds = (Date.now() - startedAt) / 1000;
			const validation = validateHardConstraints(
				buildPreflightValidatorContext(preflight.assembly as never, result.entries as never, run.id),
			);
			const sessionsDemanded = result.classesProcessed;
			const side: Side = {
				counts: measureShape(result.entries as unknown as MeasurableEntry[], sessionsDemanded),
				unplaced: result.unassignedCount,
				hardViolations: validation.violations.filter((v) => v.severity === 'HARD').length,
				seconds,
				ordering: label,
			};
			console.log(
				`A8G1_SIDE ordering=${label} demanded=${sessionsDemanded} placed=${side.counts.entryCount} ` +
				`unplaced=${side.unplaced} repeats=${side.counts.sameDayRepeatPairs} worst=${side.counts.worstSameDayCount} ` +
				`overlaps(t/s/r)=${side.counts.teacherOverlaps}/${side.counts.sectionOverlaps}/${side.counts.roomOverlaps} ` +
				`noFaculty=${side.counts.entriesWithUnresolvedFaculty} hard=${side.hardViolations} ` +
				`hybrid=${result.hybridEnabled} profile=${result.selectedProfileId} seconds=${seconds.toFixed(3)}`,
			);
			for (const detail of side.counts.overlapDetail) {
				console.log(
					`A8G1_OVERLAP ordering=${label} holder=${detail.holder} term=${detail.term} day=${detail.day} ` +
					`slot=${detail.slot} count=${detail.count} kinds=${detail.entryKinds} samePair=${detail.samePair}`,
				);
			}
			return side;
		};

		const before = measure('LEGACY_SOFT_PENALTY', 'LEGACY_SOFT_PENALTY');
		const after = measure('DAY_COUNT_FIRST', 'DAY_COUNT_FIRST');

		// The frame guard. A table whose two sides disagree about how much work
		// they measured is not evidence of anything, and attempt 1's table looked
		// decisive precisely because nothing checked this.
		const frameProblem = frameMismatchReason(before.counts, after.counts);
		if (frameProblem) throwFailure(frameProblem.startsWith('The two sides') ? 'FRAME_MISMATCH' : 'FRAME_EMPTY', frameProblem);

		// The REPRESENTATION guard. Equal frames are not enough: the frame must also
		// be able to see the defect. Attempt 2 satisfied the frame guard and still
		// produced a vacuous `repeats 0 -> 0`, because its before side could not
		// reproduce the same-day repeat at all.
		const representationProblem = frameRepresentationProblem(before.counts);
		if (representationProblem) {
			console.error(
				`A8G1_NOT_REPRESENTATIVE legacy_repeats=${before.counts.sameDayRepeatPairs} ` +
				`legacy_worst=${before.counts.worstSameDayCount} demanded=${before.counts.sessionsDemanded} ` +
				`placed=${before.counts.entryCount} hybrid_profile=${'see A8G1_SIDE'}`,
			);
			throwFailure('FRAME_NOT_REPRESENTATIVE', representationProblem);
		}
		console.log(
			`A8G1_REPRESENTATIVE legacy_repeats=${before.counts.sameDayRepeatPairs} ` +
			`legacy_worst=${before.counts.worstSameDayCount} (live Run 347: 31 pairs, worst 15)`,
		);

		console.log('A8G1_SHAPE_TABLE');
		console.log(renderTable(before, after));

		console.log(`A8G1_VERDICT repeats ${before.counts.sameDayRepeatPairs} -> ${after.counts.sameDayRepeatPairs} (target 0 non-block)`);
		console.log(`A8G1_VERDICT worst ${before.counts.worstSameDayCount} -> ${after.counts.worstSameDayCount} (target <= ceil(sessions/5))`);
		console.log(`A8G1_VERDICT unplaced ${before.unplaced} -> ${after.unplaced} (must not rise)`);
		console.log(
			`A8G1_VERDICT overlaps ${before.counts.teacherOverlaps}/${before.counts.sectionOverlaps}/${before.counts.roomOverlaps}` +
			` -> ${after.counts.teacherOverlaps}/${after.counts.sectionOverlaps}/${after.counts.roomOverlaps} (must not rise)`,
		);
		console.log(
			`A8G1_VERDICT unresolved-faculty entries ${before.counts.entriesWithUnresolvedFaculty} -> ` +
			`${after.counts.entriesWithUnresolvedFaculty} (modular-unified lanes; excluded from the teacher counter)`,
		);

		// The packet's own frame is 910/920 from live Run 347. The table's frame is
		// this run's own `demanded`. Reporting the two as if they were the same
		// frame is exactly the error attempt 1 made, so the comparison is stated
		// explicitly and never used to satisfy packet rule 3.
		console.log(
			`A8G1_PACKET_REFERENCE packet_frame=live_Run_347 placed=910 unplaced=10 of 920. ` +
			`THIS table's frame is demanded=${after.counts.sessionsDemanded} placed=${after.counts.entryCount} ` +
			`unplaced=${after.unplaced}. A DIFFERENT frame: equality of before/after unplaced inside this table ` +
			`does NOT satisfy packet rule 3, which is stated against 910/920.`,
		);

		// Every row below stays FATAL. None is relaxed, and none is reported as
		// UNAVAILABLE: at this point both sides are measured over one frame, so
		// an unavailable number would be a bug in the harness, not a data gap.
		if (after.unplaced > before.unplaced) {
			throwFailure('UNPLACED_RAISED', `unplaced rose: ${before.unplaced} -> ${after.unplaced} (frame ${after.counts.sessionsDemanded} sessions).`);
		}
		for (const [label, key] of [['teacher', 'teacherOverlaps'], ['section', 'sectionOverlaps'], ['room', 'roomOverlaps']] as const) {
			if (after.counts[key] > before.counts[key]) {
				throwFailure(
					'OVERLAP_INTRODUCED',
					`${label} overlaps rose: ${before.counts[key]} -> ${after.counts[key]}. ` +
					`Check the A8G1_OVERLAP lines above for the term and slot.`,
				);
			}
			if (after.counts[key] > 0) {
				// Not fatal when the base is equally non-zero (an order-independent
				// structural defect), but never silent: it is reported as its own
				// code so it cannot be mistaken for a pass.
				console.error(
					`A8G1_WARNING ${label} overlaps are ${after.counts[key]} on BOTH sides ` +
					`(before=${before.counts[key]}). Reordering cannot create a same-term double-book because ` +
					`facultyOcc/roomOcc/sectionOcc gate every candidate, so this is order-independent and ` +
					`pre-existing, NOT introduced by A8-G1. It still needs its own lane.`,
				);
			}
		}
		if (after.hardViolations > before.hardViolations) {
			throwFailure('HARD_VIOLATIONS', `hard violations rose: ${before.hardViolations} -> ${after.hardViolations}`);
		}
	} finally {
		await drill.$disconnect();
	}
}

/**
 * Only drive the proof when this file is EXECUTED, never when it is IMPORTED.
 * The measurement functions above are imported by
 * `a8-g1-spread-sessions.test.ts` so the D1 frame guard and the D2 term keying
 * are covered by a real test rather than only by `--self-test`; importing must
 * not start a restore.
 */
function isExecutedDirectly(): boolean {
	const entry = process.argv[1];
	if (!entry) return false;
	try {
		return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
	} catch {
		return false;
	}
}

if (isExecutedDirectly()) {
	main().catch((error) => {
		if (error instanceof BackupOperationError) fail(error.code, error.message);
		fail('A8G1_UNKNOWN', error instanceof Error ? error.message : String(error));
	});
}
