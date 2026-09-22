#!/usr/bin/env node
/**
 * Per-file isolation runner behind `npm run test:server-db` (TEST-GATE-COVERAGE-C01R D1).
 *
 * Why this exists: the DB-backed server suites were written to run against their
 * OWN disposable database. Running all 53 files in one `tsx --test` invocation on
 * one shared database breaks isolation (cross-suite interference), and several
 * suites refuse any database not named `atlas_restore_drill_<yyyymmdd>_<suffix>`.
 * This runner restores the suites' design assumption: exactly one file per fresh
 * database, then drop it.
 *
 * Prerequisites (fail closed when missing):
 * - `DATABASE_URL` must point at a disposable PostgreSQL database named
 *   `atlas_restore_drill_<yyyymmdd>_<suffix>`. It is used ONLY as the admin
 *   connection (template source + CREATE/DROP host); no suite ever connects to
 *   it. The runner refuses to start when `DATABASE_URL` is missing, is not a
 *   `postgres(ql)` URL, names the protected recovery database
 *   `atlas_recovery_clean_rebuild_20260905`, or is not a disposable
 *   `atlas_restore_drill_*` name — a wrong drop target is an incident, not a bug.
 * - `JWT_SECRET` / `ATLAS_SYSTEM_TOKEN` may be any test values; the runner sets
 *   non-authoritative defaults when they are unset and forwards them to children.
 *
 * Lifecycle per run:
 * 1. Build ONE template database (`..._tpl<rand>`) with `prisma migrate deploy`.
 * 2. Per file: `CREATE DATABASE <atlas_restore_drill_yyyymmdd_slug+rand> TEMPLATE <tpl>`,
 *    run `npx tsx --test <file>` with `DATABASE_URL` pointed at it,
 *    `DROP DATABASE ... WITH (FORCE)` in a `finally`, record pass/fail.
 * 3. Drop the template, then verify zero residue: no database created by this run
 *    may remain. The drop step only ever names databases this run created (exact
 *    match) — it never drops the base/admin database or anything else.
 *
 * `KNOWN_RED` rule: a file that genuinely cannot be made green within the packet
 * must NOT be silently dropped and must NOT count as passing. Record it below as
 * `{ file, cause, date }`; the run reports it as `SKIPPED-KNOWN-RED` and the entry
 * carries its date so the list cannot grow silently — each entry needs a dated
 * justification and a follow-up owner.
 *
 * Usage: `node scripts/run-db-suite.mjs [--only=<substr>] <file.test.ts ...>`
 * The file list is passed explicitly so `test:server-db` in package.json keeps
 * naming every suite (the gate-reachability guard asserts that). `--only` is a
 * debugging filter only; the gate never uses it.
 */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const ATLAS_SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DISPOSABLE_PATTERN = /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/;
const PROTECTED_DATABASE = 'atlas_recovery_clean_rebuild_20260905';
const SUFFIX_CHARS = /^[a-z0-9]+$/;

/**
 * Dated known-red list. Empty means the gate is fully green. See the header for
 * the rule: file + root cause + date, reported as skipped, never as passing.
 * @type {{ file: string; cause: string; date: string }[]}
 */
// 2026-09-22 (resolved the same day): the single entry this list held was
// department-authority-gates E9, and it was fixed by extending the .gitattributes
// LF policy to docs/verification/** - the artifact now materialises as its pinned
// LF bytes (4621 B, SHA d1d8e74e...) and E9 passes 82/82. The list is empty; keep
// it that way, or add a dated entry that names a follow-up owner.
const KNOWN_RED = [
	// 2026-09-22 — department-authority-gates.test.ts E9 fails honestly: the
	// committed docs/verification/department-authority-apply-r4a.json carries
	// CRLF bytes (SHA 44ADC028…) while its .sha256 sidecar pins the LF bytes
	// (SHA D1D8E74E…; proven: LF-normalized blob hashes to the sidecar value,
	// and E10 passes, so content is intact — pure line-ending drift).
	// docs/verification/** is outside the .gitattributes LF-enforced paths, so
	// the flip was never prevented. Remediation is docs-side only (planner-owned
	// docs correction: extend the LF policy to docs/verification/** and restore
	// the artifact to its pinned LF bytes, or re-emit the sidecar) — outside the
	// executor's writable paths, and the byte-exact assertion must not be
	// weakened or deleted to force green. Reported BLOCKING in the handoff.
];

function failClosed(message) {
	console.error(`[server-db] FATAL: ${message}`);
	process.exit(2);
}

function dbNameFromUrl(url) {
	try {
		return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
	} catch {
		return '';
	}
}

function withDb(url, name) {
	const copy = new URL(url);
	copy.pathname = `/${name}`;
	return copy.toString();
}

function slugFor(file) {
	const base = file.split('/').pop().replace(/\.test\.ts$/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
	return base.slice(0, 18) + randomBytes(2).toString('hex');
}

async function main() {
	const rawArgs = process.argv.slice(2);
	const onlyFilters = rawArgs.filter((a) => a.startsWith('--only=')).map((a) => a.slice('--only='.length));
	const files = [...new Set(rawArgs.filter((a) => a.endsWith('.test.ts') && !a.startsWith('--')))];
	if (files.length === 0) failClosed('no test files provided (pass them explicitly so gate-reachability stays honest)');

	const baseUrl = process.env.DATABASE_URL;
	if (!baseUrl) failClosed('DATABASE_URL is unavailable; point it at the staged disposable database.');
	if (!baseUrl.startsWith('postgres')) failClosed('DATABASE_URL must be a postgres URL.');
	const baseName = dbNameFromUrl(baseUrl);
	if (baseName === PROTECTED_DATABASE) {
		failClosed(`DATABASE_URL must never point at the protected recovery database "${PROTECTED_DATABASE}".`);
	}
	if (!DISPOSABLE_PATTERN.test(baseName)) {
		failClosed(`DATABASE_URL must point at a disposable atlas_restore_drill_* database; got "${baseName || '<unparseable>'}".`);
	}
	if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-gate-coverage-c01r-jwt-secret';
	if (!process.env.ATLAS_SYSTEM_TOKEN) process.env.ATLAS_SYSTEM_TOKEN = 'test-gate-coverage-c01r-system-token';

	const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
	const admin = new PrismaClient({ datasourceUrl: baseUrl });
	const created = [];
	const quoteIdent = (name) => `"${name.replace(/"/g, '""')}"`;
	const execAdmin = async (sql) => admin.$queryRawUnsafe(sql);

const dropDb = async (name) => {
	// A suite can leave a connection closing for a moment after it exits, so a
	// single `DROP ... WITH (FORCE)` is occasionally refused. Retry briefly; a
	// persistent failure still surfaces as DROP-FAILED and non-zero residue.
	let lastError = null;
	for (let attempt = 0; attempt < 5; attempt += 1) {
		try {
			await execAdmin(`DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`);
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
		}
	}
	throw lastError;
};

	let templateName = '';
	try {
		templateName = `atlas_restore_drill_${dateStamp}_tpl${randomBytes(3).toString('hex')}`;
		if (!DISPOSABLE_PATTERN.test(templateName)) failClosed(`generated template name violates the guard: ${templateName}`);
		created.push(templateName);
		await dropDb(templateName);
		await execAdmin(`CREATE DATABASE ${quoteIdent(templateName)}`);
		const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy', '--schema=../prisma/schema.prisma'], {
			cwd: ATLAS_SERVER_DIR,
			env: { ...process.env, DATABASE_URL: withDb(baseUrl, templateName) },
			shell: process.platform === 'win32',
			stdio: 'pipe',
			encoding: 'utf8',
			timeout: 300000,
		});
		if (migrate.status !== 0) {
			console.error(`[server-db] template migrate deploy failed:\n${migrate.stdout ?? ''}\n${migrate.stderr ?? ''}`);
			failClosed(`could not build template database ${templateName}`);
		}
		console.error(`[server-db] template ready: ${templateName}`);

		const knownRedByFile = new Map(KNOWN_RED.map((entry) => [entry.file, entry]));
		let pass = 0;
		let fail = 0;
		let skippedKnownRed = 0;
		const failedFiles = [];

		for (const file of files) {
			if (onlyFilters.length > 0 && !onlyFilters.some((f) => file.includes(f))) continue;
			const known = knownRedByFile.get(file);
			if (known) {
				skippedKnownRed += 1;
				console.error(`[server-db] SKIPPED-KNOWN-RED ${file} (${known.date} — ${known.cause})`);
				continue;
			}
			const suffix = slugFor(file);
			if (!SUFFIX_CHARS.test(suffix)) failClosed(`generated suffix violates the guard: ${suffix}`);
			const dbName = `atlas_restore_drill_${dateStamp}_${suffix}`;
			if (!DISPOSABLE_PATTERN.test(dbName)) failClosed(`generated database name violates the guard: ${dbName}`);
			created.push(dbName);
			const started = Date.now();
			let outcome;
			try {
				await execAdmin(`CREATE DATABASE ${quoteIdent(dbName)} TEMPLATE ${quoteIdent(templateName)}`);
				const child = spawnSync('npx', ['tsx', '--test', file], {
					cwd: ATLAS_SERVER_DIR,
					env: {
						...process.env,
						DATABASE_URL: withDb(baseUrl, dbName),
						// Runner-to-suite handshake: publication-contract-postgres-concurrency
						// requires the runner-approved disposable target in
						// PUBC01R_DISPOSABLE_DATABASE and fails closed without it.
						PUBC01R_DISPOSABLE_DATABASE: dbName,
					},
					shell: process.platform === 'win32',
					stdio: 'inherit',
					encoding: 'utf8',
					timeout: 600000,
				});
				const elapsed = ((Date.now() - started) / 1000).toFixed(1);
				if (child.error) {
					outcome = `FAIL ${file} (${child.error.code === 'ETIMEDOUT' ? 'timeout' : child.error.message}, ${elapsed}s)`;
					fail += 1;
					failedFiles.push(file);
				} else if (child.status !== 0) {
					outcome = `FAIL ${file} (exit ${child.status}, ${elapsed}s)`;
					fail += 1;
					failedFiles.push(file);
				} else {
					outcome = `PASS ${file} (${elapsed}s)`;
					pass += 1;
				}
			} catch (error) {
				outcome = `FAIL ${file} (runner error: ${String(error?.message ?? error).slice(0, 200)})`;
				fail += 1;
				failedFiles.push(file);
			} finally {
				try {
					await dropDb(dbName);
				} catch (error) {
					outcome += ` [DROP-FAILED: ${String(error?.message ?? error).slice(0, 160)}]`;
					fail += 1;
					if (!failedFiles.includes(file)) failedFiles.push(file);
				}
			}
			console.error(`[server-db] ${outcome} (database dropped)`);
		}

		// Drop the template, then prove zero residue over exactly the names created.
		try {
			await dropDb(templateName);
		} catch (error) {
			console.error(`[server-db] template drop failed: ${String(error?.message ?? error).slice(0, 160)}`);
			fail += 1;
		}
		const residue = await admin.$queryRawUnsafe(
			`SELECT count(*)::int AS n FROM pg_database WHERE datname = ANY(ARRAY[${created.map((n) => `'${n}'`).join(',')}] )`,
		);
		const residueCount = Number(residue?.[0]?.n ?? -1);
		console.error(
			`[server-db] files: ${pass} pass, ${fail} fail, ${skippedKnownRed} skipped-known-red | ` +
			`databases created: ${created.length} (incl. template), residue of own databases: ${residueCount}`,
		);
		if (residueCount !== 0) {
			console.error('[server-db] FATAL: runner-created databases remain (zero-residue violation).');
			process.exit(1);
		}
		if (failedFiles.length > 0) {
			console.error(`[server-db] failing files:\n  ${failedFiles.join('\n  ')}`);
			process.exit(1);
		}
	} finally {
		await admin.$disconnect();
	}
}

main().catch((error) => {
	console.error(`[server-db] FATAL: ${String(error?.message ?? error).slice(0, 300)}`);
	process.exit(2);
});
