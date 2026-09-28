import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadContract, loadEnvironmentReference } from '../lib/contract.mjs';

/*
 * Guard: a cutover must not sign every browser out.
 *
 * The server verifies a stateless JWT against a signing secret taken from the
 * operator-owned durable environment reference. If that resolved secret ever
 * became release-scoped -- i.e. regenerated per release, or read from a path
 * joined onto the release `sourceDir` -- then every deploy or restart would
 * invalidate every remember-me session at once, silently and globally. Nothing
 * at the type level, build level, or route level would fail.
 *
 * This file therefore pins the exact property the falsification rests on: for
 * two DIFFERENT release `sourceDir`s, the resolved environment values are
 * byte-identical, because only `ATLAS_RUNTIME_ENV_FILE` determines them.
 *
 * Fixture rules (ATLAS directive 4 and 12):
 * - every fixture is SYNTHETIC and lives under the OS temp directory created by
 *   `mkdtempSync`; no real environment file, worktree `.env`, or credential is
 *   read, opened, printed, or referenced anywhere in this file;
 * - the synthetic secrets are assembled from fragments at runtime so that no
 *   secret-shaped literal is present in this file to be found by `git grep`.
 *
 * SERIALIZATION OF EVERY COMPUTED ARTIFACT IN THIS FILE (directive 11).
 * A digest here is exactly:
 *
 *     sha256( utf8_bytes( S ) )   rendered as 64 lowercase hex characters
 *
 * where S is the string produced by the relevant helper below. Concretely:
 *
 * 1. Secret digest: S = the single JavaScript string returned by
 *    `loadEnvironmentReference(...).values.get('JWT_SECRET')` -- i.e. the value
 *    AFTER `parseEnvFile` has trimmed surrounding whitespace and stripped one
 *    matched pair of surrounding single or double quotes. NOT included: the key
 *    name, the `=` sign, a trailing newline, a UTF-8 BOM, any surrounding
 *    whitespace, or any case folding. `createHash('sha256').update(S, 'utf8')`
 *    -- `'utf8'` is explicit, and the string is encoded as UTF-8 with no BOM.
 *
 * 2. Whole-map digest: S = the keys of `values` sorted ascending by JavaScript
 *    default string comparison (UTF-16 code-unit order), each key rendered as
 *    `KEY=VALUE` with the post-`parseEnvFile` value, joined by a single
 *    LF (U+000A), with exactly one trailing LF. Same UTF-8 encoding, no BOM.
 *
 * 3. Synthetic env file bytes: the helper `writeSyntheticEnvFile` writes the
 *    lines joined by a single LF (U+000A) with exactly one trailing LF,
 *    `writeFileSync(path, text, 'utf8')` -- LF only, no CRLF, no BOM. LF is
 *    chosen explicitly so the fixture bytes are identical on every platform and
 *    `parseEnvFile`'s `/\r?\n/` split is not what is being measured.
 *
 * No test in this file prints, asserts, or embeds a secret value. Assertions are
 * made only on digests, on booleans, and on key NAMES.
 */

const CONTRACT = loadContract();
const REF_VAR = CONTRACT.environmentReference.variable;
const SOURCE_DIR_VAR = CONTRACT.environmentReference.sourceDirVariable;
const SECRET_KEY = 'JWT_SECRET';

const SECRET_A = ['atlas', 'synthetic', 'signing', 'secret', 'alpha'].join('-');
const SECRET_B = ['atlas', 'synthetic', 'signing', 'secret', 'beta'].join('-');
const SYNTHETIC_DATABASE_URL = ['postgresql', '', 'synthetic-user:synthetic-pass@127.0.0.1:5432/synthetic-db'].join(':');

function digestOf(text) {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

function digestOfSecret(reference) {
	return digestOf(reference.values.get(SECRET_KEY));
}

function digestOfWholeMap(reference) {
	const lines = [...reference.values.keys()].sort().map((key) => `${key}=${reference.values.get(key)}`);
	return digestOf(`${lines.join('\n')}\n`);
}

function writeSyntheticEnvFile(path, secret) {
	const lines = [
		'# synthetic test fixture; not a real credential and not an operator file',
		`${SECRET_KEY}=${secret}`,
		`DATABASE_URL=${SYNTHETIC_DATABASE_URL}`,
		'',
	];
	writeFileSync(path, lines.join('\n'), 'utf8');
}

/** A synthetic env file that lives OUTSIDE every candidate release directory. */
function makeEnvFile(root, name, secret) {
	const durableDir = join(root, 'durable');
	mkdirSync(durableDir, { recursive: true });
	const envFile = join(durableDir, name);
	writeSyntheticEnvFile(envFile, secret);
	return envFile;
}

function makeReleaseDir(root, name) {
	const releaseDir = join(root, name);
	mkdirSync(releaseDir, { recursive: true });
	return releaseDir;
}

function resolve(contract, envFile, sourceDir) {
	return loadEnvironmentReference({
		contract,
		env: { [REF_VAR]: envFile, [SOURCE_DIR_VAR]: sourceDir },
	});
}

test('the resolved signing secret is byte-identical for two different release source directories', () => {
	const root = mkdtempSync(join(tmpdir(), 'atlas-signing-secret-stability-'));
	try {
		const envFile = makeEnvFile(root, 'release-invariant.env', SECRET_A);
		const releaseA = makeReleaseDir(root, 'release-a');
		const releaseB = makeReleaseDir(root, 'release-b');
		assert.notEqual(releaseA, releaseB);

		const fromA = resolve(CONTRACT, envFile, releaseA);
		const fromB = resolve(CONTRACT, envFile, releaseB);

		// The two resolutions really are different releases resolving the same
		// durable reference; only the release identity differs.
		assert.equal(fromA.sourceDir, releaseA);
		assert.equal(fromB.sourceDir, releaseB);
		assert.notEqual(fromA.sourceDir, fromB.sourceDir);
		assert.equal(fromA.path, fromB.path);
		assert.equal(fromA.path, envFile);
		assert.ok(fromA.presentKeys.includes(SECRET_KEY));
		assert.ok(fromB.presentKeys.includes(SECRET_KEY));

		// THE PROPERTY: release identity must not reach the signing secret.
		assert.equal(
			digestOfSecret(fromA),
			digestOfSecret(fromB),
			'signing secret digest must not depend on the release source directory',
		);
		assert.equal(
			fromA.values.get(SECRET_KEY) === fromB.values.get(SECRET_KEY),
			true,
			'signing secret bytes must be identical across releases',
		);
		// Nor may it reach any other resolved value.
		assert.equal(digestOfWholeMap(fromA), digestOfWholeMap(fromB));

		// Sanity on the artifact itself: 64 lowercase hex characters, so a
		// comparison above compared digests and not two undefined values.
		assert.match(digestOfSecret(fromA), /^[0-9a-f]{64}$/);
		assert.match(digestOfWholeMap(fromA), /^[0-9a-f]{64}$/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('negative control: a different synthetic env file resolves a different signing secret digest under the same release', () => {
	const root = mkdtempSync(join(tmpdir(), 'atlas-signing-secret-negative-'));
	try {
		const releaseDir = makeReleaseDir(root, 'release-shared');
		const envFileAlpha = makeEnvFile(root, 'alpha.env', SECRET_A);
		const envFileBeta = makeEnvFile(root, 'beta.env', SECRET_B);
		assert.notEqual(envFileAlpha, envFileBeta);

		const alpha = resolve(CONTRACT, envFileAlpha, releaseDir);
		const beta = resolve(CONTRACT, envFileBeta, releaseDir);

		// Same release, only the durable reference differs.
		assert.equal(alpha.sourceDir, beta.sourceDir);
		assert.notEqual(alpha.path, beta.path);

		// Without this control the stability test would also pass against a
		// loader that returned a constant, making it tautological.
		assert.notEqual(
			digestOfSecret(alpha),
			digestOfSecret(beta),
			'a changed durable env file must change the resolved signing secret digest',
		);
		assert.notEqual(digestOfWholeMap(alpha), digestOfWholeMap(beta));
		assert.match(digestOfSecret(alpha), /^[0-9a-f]{64}$/);
		assert.match(digestOfSecret(beta), /^[0-9a-f]{64}$/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
