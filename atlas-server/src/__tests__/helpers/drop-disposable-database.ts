/**
 * TEST-GATE-COVERAGE-C01R2 D1 — shared bounded-retry drop for disposable databases.
 *
 * Root cause (packet §0): dropping a database immediately after a suite's
 * server/Prisma client closes is a race; a single `DROP ... WITH (FORCE)`
 * is occasionally refused while a connection is still closing. The old
 * teardown swallowed that one failure (`try { … } catch {}`) and the final
 * zero-residue assertion then failed, turning a real-pass file red.
 *
 * This helper retries the drop a bounded number of times with a short
 * backoff delay (mirroring the already-fixed runner `dropDb` in
 * `atlas-server/scripts/run-db-suite.mjs`: 5 attempts, 300ms × (attempt+1)).
 * It returns whether the database is gone; callers keep their exact final
 * zero-residue assertion, so a genuinely stuck database still fails loudly
 * (D2 — residue is never masked, never caught past).
 *
 * Fail-closed guards: the name must satisfy the repository disposable pattern
 * and must never equal the configured source database; otherwise this throws
 * instead of dropping.
 *
 * The optional `dropOnce` / `isGone` / `sleep` seams exist ONLY so D3 can
 * simulate the first-attempt failure deterministically without a live race.
 * Production callers omit them and get the real `psql` path.
 */

import { execFileSync } from 'node:child_process';

const PSQL = 'D:/PostgreSQL/18/bin/psql.exe';
const DISPOSABLE_PATTERN = /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/;
const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 300;

export type DropDisposableDatabaseOptions = {
	source: URL;
	adminEnv: NodeJS.ProcessEnv;
	name: string;
	attempts?: number;
	baseDelayMs?: number;
	/** Test seam for D3: overrides the single real `psql` DROP attempt. */
	dropOnce?: () => void;
	/** Test seam for D3: overrides the `SELECT count(*)` gone-check. */
	isGone?: () => boolean;
	/** Test seam for D3: overrides the backoff wait. */
	sleep?: (ms: number) => Promise<void>;
};

function defaultDropOnce(source: URL, adminEnv: NodeJS.ProcessEnv, name: string): void {
	execFileSync(
		PSQL,
		['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${name} WITH (FORCE)`],
		{ env: adminEnv, stdio: 'pipe' },
	);
}

function defaultIsGone(source: URL, adminEnv: NodeJS.ProcessEnv, name: string): boolean {
	try {
		const count = execFileSync(
			PSQL,
			['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `SELECT count(*) FROM pg_database WHERE datname = '${name}'`],
			{ env: adminEnv, stdio: 'pipe' },
		)
			.toString()
			.trim();
		return count === '0';
	} catch {
		// A failed census read is not proof of absence; let the caller retry,
		// and the suite's own final assertion will surface the real error.
		return false;
	}
}

export async function dropDisposableDatabaseWithRetry(options: DropDisposableDatabaseOptions): Promise<boolean> {
	const { source, adminEnv, name } = options;
	if (!DISPOSABLE_PATTERN.test(name)) {
		throw new Error(`refusing to drop non-disposable database "${name}"`);
	}
	if (name === source.pathname.replace(/^\//, '')) {
		throw new Error('refusing to drop the configured database');
	}
	const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
	const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
	const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
	const dropOnce = options.dropOnce ?? (() => defaultDropOnce(source, adminEnv, name));
	const isGone = options.isGone ?? (() => defaultIsGone(source, adminEnv, name));

	for (let attempt = 0; attempt < attempts; attempt += 1) {
		try {
			dropOnce();
		} catch {
			/* a refused DROP is the race this helper exists for — back off and retry */
		}
		try {
			if (isGone()) return true;
		} catch {
			/* treat a failed census the same as "not yet gone" and retry */
		}
		if (attempt < attempts - 1) await sleep(baseDelayMs * (attempt + 1));
	}
	return false;
}
