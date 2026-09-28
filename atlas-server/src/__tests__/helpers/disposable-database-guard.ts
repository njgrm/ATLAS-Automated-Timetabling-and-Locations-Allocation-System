/**
 * A9 / AGENTS.md §5 (2026-09-29) — the ONE definition of the disposable-database
 * contract, shared by every DB-writing server suite.
 *
 * The incident this exists for: a bare `npx tsx --test
 * src/__tests__/enrollpro-rollover-automation.test.ts` resolved the configured
 * `DATABASE_URL` and ran `prisma.school.create` against it, creating 5 `schools`
 * rows in the LIVE database (deleted again as ids 286/299/308/317/318). The
 * operator's rule is now explicit: *"DB-writing suites run only through `npm run
 * test:server-db` (disposable `atlas_restore_drill_*`), and must fail closed when
 * the connected database name is not disposable."*
 *
 * Import + call this at the TOP of a DB-writing suite, before the first row is
 * created:
 *
 * ```ts
 * import { requireDisposableDatabase } from './helpers/disposable-database-guard.js';
 * requireDisposableDatabase('my-suite.test.ts');
 * ```
 *
 * A top-level call runs during module evaluation, i.e. strictly before the suite
 * body, so a non-disposable target is refused before any `prisma.*` write.
 *
 * Single definition: the `test:server-db` runner (`scripts/run-db-suite.mjs`) is
 * plain `.mjs` executed by bare `node` and cannot import a TypeScript module, so
 * it keeps its own literal. `disposable-db-write-guard.test.ts` pins the two
 * definitions to each other by parsing the runner source — if either is edited
 * without the other, that test fails. Do NOT retype the regex in a suite.
 */

/**
 * The disposable database-name contract. The date stamp is `YYYYMMDD`; the suffix
 * is lowercase alphanumeric (the runner's `slugFor`, and every hand-built
 * `atlas_restore_drill_<stamp>_<suffix>` name in the suites).
 */
export const DISPOSABLE_DATABASE_PATTERN = /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/;

/**
 * Shared, non-disposable databases a DB-writing suite must never touch. Both are
 * already rejected by the pattern; they are named explicitly so the refusal
 * message says WHY rather than only that the name looks wrong.
 *
 * - `atlas_recovery_clean_rebuild_20260905` is the LIVE database
 *   (`docs/runbooks/staging.md:26`, and the same constant the runner refuses).
 * - `atlas_staging` is the staging snapshot of the live database
 *   (`docs/runbooks/staging.md:26`); `atlas-server/.env` was repointed to it
 *   after the incident, so a bare suite run would write to staging instead.
 */
export const PROTECTED_DATABASES: readonly string[] = [
	'atlas_recovery_clean_rebuild_20260905',
	'atlas_staging',
];

/** Parse the database name out of a postgres URL, or `''` when unparseable. */
export function databaseNameFromUrl(url: string): string {
	try {
		return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
	} catch {
		return '';
	}
}

export type DisposableDatabaseTarget = {
	/** The effective `DATABASE_URL` that was validated. */
	url: string;
	/** The database name parsed out of that URL. */
	name: string;
};

/**
 * Fail closed unless `rawUrl` names a disposable `atlas_restore_drill_*`
 * database. Throws a remediation-bearing `Error` on every other input, including
 * a missing or unparseable URL — there is no fall-open branch.
 *
 * `context` is the calling suite's filename; it is quoted in the message so the
 * operator can see which suite refused.
 */
export function assertDisposableDatabaseTarget(rawUrl: string | undefined | null, context: string): DisposableDatabaseTarget {
	const refuse = (reason: string): never => {
		throw new Error(
			`[db-write-guard] REFUSING TO RUN ${context}: ${reason}\n` +
				'  DB-writing suites must run only through `npm run test:server-db`, which gives each\n' +
				'  file its own disposable atlas_restore_drill_<yyyymmdd>_<suffix> database and drops it.\n' +
				'  Nothing was written. Set DATABASE_URL to a disposable atlas_restore_drill_* database,\n' +
				'  or use the harness. Never point DATABASE_URL at a live or staging database.',
		);
	};

	if (!rawUrl) return refuse('DATABASE_URL is not set.');
	if (!rawUrl.startsWith('postgres')) return refuse(`DATABASE_URL must be a postgres URL (got "${rawUrl.slice(0, 40)}").`);

	const name = databaseNameFromUrl(rawUrl);
	if (!name) return refuse('DATABASE_URL carries no parsable database name.');
	if (PROTECTED_DATABASES.includes(name)) {
		return refuse(`DATABASE_URL points at the protected shared database "${name}".`);
	}
	if (!DISPOSABLE_DATABASE_PATTERN.test(name)) {
		return refuse(`database "${name}" is not disposable (expected atlas_restore_drill_<yyyymmdd>_<suffix>).`);
	}
	return { url: rawUrl, name };
}

/**
 * The top-of-suite entry point: validate the effective `DATABASE_URL` these
 * suites' Prisma clients actually connect with (`src/lib/prisma.ts` reads
 * `process.env.DATABASE_URL` at module load), or throw.
 */
export function requireDisposableDatabase(context: string): DisposableDatabaseTarget {
	return assertDisposableDatabaseTarget(process.env.DATABASE_URL, context);
}
