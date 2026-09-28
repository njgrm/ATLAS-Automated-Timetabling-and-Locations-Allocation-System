/**
 * A9 (AGENTS.md §5, 2026-09-29) — the fail-closed disposable-database guard.
 *
 * The incident: a bare `npx tsx --test src/__tests__/enrollpro-rollover-automation.test.ts`
 * resolved the configured `DATABASE_URL` and ran `prisma.school.create` against it,
 * creating 5 `schools` rows in the LIVE database. The rule is now: DB-writing
 * suites run only through `npm run test:server-db`, and must fail closed when the
 * connected database name is not disposable.
 *
 * This file proves three things, none of which needs a database:
 *
 *  1. The guard ACCEPTS the harness's own names and REFUSES everything else,
 *     including a missing / non-postgres / unparseable `DATABASE_URL` (fail
 *     closed, never fall open) and both protected shared database names.
 *  2. PIN: the guard's pattern and protected name are byte-identical to the ones
 *     in `scripts/run-db-suite.mjs`. That runner is plain `.mjs` run by bare
 *     `node`, so it cannot import a TypeScript module and keeps its own literal;
 *     this pin is what holds the two definitions together. If either is edited
 *     without the other, this test fails.
 *  3. COVERAGE: every suite in the `test:server-db` argv list that writes rows
 *     either calls `requireDisposableDatabase` or provisions its own disposable
 *     database and reassigns `DATABASE_URL`. A new DB-writing suite added to that
 *     list without one of the two fails here, so the classification in the
 *     handoff cannot silently rot.
 *
 * Reachable from `test:disposable-db-guard` in `atlas-server/package.json`
 * (AGENTS.md §11: a test no gate runs is not evidence).
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	DISPOSABLE_DATABASE_PATTERN,
	PROTECTED_DATABASES,
	assertDisposableDatabaseTarget,
	databaseNameFromUrl,
	requireDisposableDatabase,
} from './helpers/disposable-database-guard.js';

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(here, '..', '..');
const pkg = JSON.parse(readFileSync(join(serverRoot, 'package.json'), 'utf8')) as {
	scripts?: Record<string, string>;
};

const url = (db: string) => `postgresql://atlas_user:pw@localhost:5432/${db}?schema=public`;

// ─── 1. accept / refuse ───────────────────────────────────────────────────────

test('G1. the guard accepts the harness names `test:server-db` actually creates', () => {
	// `run-db-suite.mjs` builds `atlas_restore_drill_<yyyymmdd>_<slug><hex>`; the
	// date stamp is today's UTC date, so derive it the same way rather than
	// hard-coding a day that will go stale.
	const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
	const accepted = [
		`atlas_restore_drill_${stamp}_enrollprorollov3f2a`, // runner slugFor(file)
		`atlas_restore_drill_${stamp}_tpl9ab3c1d5e`, // the runner's template
		'atlas_restore_drill_20260929_a', // minimal in-range suffix
	];
	for (const name of accepted) {
		const target = assertDisposableDatabaseTarget(url(name), 'g1');
		assert.equal(target.name, name, `${name} must be accepted`);
		assert.equal(target.url, url(name), 'the validated URL is returned unchanged');
	}
});

test('G2. the guard refuses every non-disposable target, and names why', () => {
	const cases: Array<{ label: string; raw: string | undefined; expect: RegExp }> = [
		{ label: 'missing DATABASE_URL', raw: undefined, expect: /DATABASE_URL is not set/ },
		{ label: 'empty DATABASE_URL', raw: '', expect: /DATABASE_URL is not set/ },
		{ label: 'non-postgres URL', raw: 'mysql://u:p@h:3306/atlas_staging', expect: /must be a postgres URL/ },
		{ label: 'unparseable URL', raw: 'postgresql://u:p@h:5432/', expect: /no parsable database name/ },
		{ label: 'staging database', raw: url('atlas_staging'), expect: /protected shared database "atlas_staging"/ },
		{
			label: 'live database',
			raw: url('atlas_recovery_clean_rebuild_20260905'),
			expect: /protected shared database "atlas_recovery_clean_rebuild_20260905"/,
		},
		{ label: 'a development database', raw: url('atlas_db'), expect: /is not disposable/ },
		{ label: 'drill prefix but no date stamp', raw: url('atlas_restore_drill_x'), expect: /is not disposable/ },
		{ label: 'drill prefix with an uppercase suffix', raw: url('atlas_restore_drill_20260929_AB'), expect: /is not disposable/ },
		{ label: 'drill-shaped name in the wrong slot', raw: url('prefix_atlas_restore_drill_20260929_a'), expect: /is not disposable/ },
	];
	for (const { label, raw, expect } of cases) {
		assert.throws(
			() => assertDisposableDatabaseTarget(raw, 'g2'),
			expect,
			`${label} must be refused with a message naming the reason`,
		);
	}
});

test('G3. every refusal tells the operator to use the harness, and the guard never falls open', () => {
	for (const raw of [undefined, url('atlas_staging'), 'not-a-url']) {
		let message = '';
		try {
			assertDisposableDatabaseTarget(raw, 'g3');
			assert.fail('the guard must throw');
		} catch (error) {
			message = (error as Error).message;
		}
		assert.match(message, /npm run test:server-db/, 'the refusal must name the harness');
		assert.match(message, /Nothing was written/, 'the refusal must state the no-write fact');
		assert.match(message, /g3/, 'the refusal must name the calling suite');
	}
});

test('G4. requireDisposableDatabase reads the effective DATABASE_URL', () => {
	const original = process.env.DATABASE_URL;
	try {
		delete process.env.DATABASE_URL;
		assert.throws(() => requireDisposableDatabase('g4-absent'), /DATABASE_URL is not set/);
		process.env.DATABASE_URL = url('atlas_staging');
		assert.throws(() => requireDisposableDatabase('g4-staging'), /atlas_staging/);
		process.env.DATABASE_URL = url('atlas_restore_drill_20260929_g4ok');
		assert.equal(requireDisposableDatabase('g4-ok').name, 'atlas_restore_drill_20260929_g4ok');
	} finally {
		if (original === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = original;
	}
});

test('G5. the name parser decodes, and yields "" for an unparseable URL', () => {
	assert.equal(databaseNameFromUrl(url('atlas_staging')), 'atlas_staging');
	assert.equal(databaseNameFromUrl('postgresql://u:p@h:5432/atlas%5Fstaging'), 'atlas_staging');
	assert.equal(databaseNameFromUrl('nonsense'), '');
});

// ─── 2. PIN: the guard and the runner define the same contract ───────────────

test('P1. the runner and the guard share one disposable pattern and one protected name', () => {
	const runner = readFileSync(join(serverRoot, 'scripts', 'run-db-suite.mjs'), 'utf8');
	const runnerPattern = /const DISPOSABLE_PATTERN = \/(\^.*\$)\/;/.exec(runner);
	assert.ok(runnerPattern, 'run-db-suite.mjs must still declare DISPOSABLE_PATTERN');
	assert.equal(
		runnerPattern[1],
		DISPOSABLE_DATABASE_PATTERN.source,
		'the runner pattern and the guard pattern have drifted — update BOTH',
	);
	const runnerProtected = /const PROTECTED_DATABASE = '([^']+)'/.exec(runner);
	assert.ok(runnerProtected, 'run-db-suite.mjs must still declare PROTECTED_DATABASE');
	assert.ok(
		PROTECTED_DATABASES.includes(runnerProtected[1]),
		`the runner's protected database "${runnerProtected[1]}" must be refused by the guard too`,
	);
	// The live database is named explicitly in both, so a refusal says why.
	assert.ok(PROTECTED_DATABASES.includes('atlas_recovery_clean_rebuild_20260905'), 'the live database must be named');
	assert.ok(PROTECTED_DATABASES.includes('atlas_staging'), 'the staging snapshot must be named');
});

test('P2. exactly one definition of the pattern exists in the server test tree', () => {
	// Guards against a future suite re-typing a divergent regex.
	const offenders: string[] = [];
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const abs = join(dir, entry.name);
			if (entry.isDirectory()) walk(abs);
			else if (entry.name.endsWith('.ts') && /atlas_restore_drill_\[0-9\]/.test(readFileSync(abs, 'utf8'))) {				if (!entry.name.startsWith('disposable-database-guard.')) offenders.push(abs.slice(serverRoot.length + 1));
			}
		}
	};
	walk(join(serverRoot, 'src', '__tests__'));
	assert.deepEqual(offenders, [], `these files re-type the disposable pattern; import it instead:\n  ${offenders.join('\n  ')}`);
});

// ─── 3. COVERAGE: every DB-writing suite in the harness list is guarded ──────

test('C1. every suite in the test:server-db list that writes rows is guarded or self-provisions', () => {
	const script = pkg.scripts?.['test:server-db'];
	assert.ok(script, 'test:server-db must exist');
	const files = [...new Set(script.match(/src\/__tests__\/[\w.-]+\.test\.ts/g) ?? [])];
	assert.ok(files.length > 0, 'test:server-db must name its suites');

	const WRITES =
		/\b(?:prisma|base|instrumented|client)\.[A-Za-z_$][\w$]*\.(?:create|createMany|upsert|update|updateMany|delete|deleteMany)\s*\(|\bqueryRawUnsafe|\bexecuteRawUnsafe/;
	const unguarded: string[] = [];
	const guarded: string[] = [];
	for (const file of files) {
		const text = readFileSync(join(serverRoot, file), 'utf8');
		if (!WRITES.test(text)) continue; // non-writing suite: no guard needed
		if (text.includes('requireDisposableDatabase(')) {
			guarded.push(file);
			continue;
		}
		// Self-provisioning suites create their own disposable database and point
		// DATABASE_URL at it before writing, so they cannot write to the configured
		// database. Their name assertion is the shared DISPOSABLE_DATABASE_PATTERN.
		if (text.includes('provisionDisposableDatabase') && /process\.env\.DATABASE_URL\s*=/.test(text)) continue;
		unguarded.push(file);
	}
	assert.deepEqual(
		unguarded,
		[],
		`these DB-writing suites can write to the configured DATABASE_URL but are not guarded; ` +
			`add requireDisposableDatabase('<file>') at the top:\n  ${unguarded.join('\n  ')}`,
	);
	assert.ok(guarded.length >= 30, `expected the guarded set to stay substantive, got ${guarded.length}`);
});

test('C2. the guard is imported with a runtime .js ending (ESM-safe, AGENTS.md §5)', () => {
	const files = [...new Set(pkg.scripts?.['test:server-db']?.match(/src\/__tests__\/[\w.-]+\.test\.ts/g) ?? [])];
	for (const file of files) {
		const text = readFileSync(join(serverRoot, file), 'utf8');
		for (const m of text.matchAll(/from '(\.[^']*disposable-database-guard[^']*)'/g)) {
			assert.match(m[1], /\.js$/, `${file} imports ${m[1]} without an ESM-safe .js ending`);
		}
	}
});
