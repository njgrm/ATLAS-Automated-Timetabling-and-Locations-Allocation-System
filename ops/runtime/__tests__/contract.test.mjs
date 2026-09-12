import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
	loadContract,
	loadEnvironmentReference,
	parseEnvFile,
	resolveInvariantEnv,
	summarizeEnvironmentReference,
	validateContract,
	verifyProductPin,
} from '../lib/contract.mjs';
import { defaultIsAncestor, defaultResolveHead } from '../lib/git.mjs';

const CONTRACT = loadContract();
const SHA = CONTRACT.productPin;
const OTHER_SHA = '0123456789abcdef0123456789abcdef01234567';

function clone() {
	return JSON.parse(JSON.stringify(CONTRACT));
}

function envIo(overrides = {}) {
	const files = new Map(overrides.files ?? []);
	return {
		existsSync: (path) => files.has(path) || Boolean(overrides.exists?.(path)),
		readFileSync: (path) => {
			if (!files.has(path)) throw new Error(`ENOENT ${path}`);
			return files.get(path);
		},
		realpathSync: (path) => path,
	};
}

test('reviewed contract validates and pins the rollover invariant to false', () => {
	const contract = loadContract();
	assert.equal(contract.invariants.ROLLOVER_AUTO_SYNC_ENABLED, 'false');
	assert.deepEqual(resolveInvariantEnv(contract), { ROLLOVER_AUTO_SYNC_ENABLED: 'false', ATLAS_SUPERVISED: 'true' });
	assert.match(contract.productPin, /^[0-9a-f]{40}$/);
});

test('contract validation rejects a fail-open rollover invariant', () => {
	const contract = clone();
	contract.invariants.ROLLOVER_AUTO_SYNC_ENABLED = 'true';
	assert.throws(() => validateContract(contract), (error) => error.code === 'RUNTIME_CONTRACT_INVALID');
});

test('contract validation rejects absolute and traversing entries', () => {
	const absolute = clone();
	absolute.serverEntry = 'C:/worktree/atlas-server/dist/server.js';
	assert.throws(() => validateContract(absolute), (error) => error.code === 'RUNTIME_CONTRACT_INVALID');
	const traversal = clone();
	traversal.clientDist = '../other/dist';
	assert.throws(() => validateContract(traversal), (error) => error.code === 'RUNTIME_CONTRACT_INVALID');
});

test('contract validation rejects duplicate ports and unbounded logs', () => {
	const duplicate = clone();
	duplicate.ports.client = duplicate.ports.server;
	assert.throws(() => validateContract(duplicate), (error) => error.code === 'RUNTIME_CONTRACT_INVALID');
	const badLogs = clone();
	badLogs.logs.maxFiles = 1;
	assert.throws(() => validateContract(badLogs), (error) => error.code === 'RUNTIME_CONTRACT_INVALID');
});

test('parseEnvFile handles comments, quotes, export and blank values', () => {
	const parsed = parseEnvFile([
		'# comment',
		'DATABASE_URL=postgresql://user:pass@host/db',
		'export JWT_SECRET="quoted-secret"',
		"OTHER='single'",
		'EMPTY=',
		'not a valid line',
	].join('\n'));
	assert.equal(parsed.get('DATABASE_URL'), 'postgresql://user:pass@host/db');
	assert.equal(parsed.get('JWT_SECRET'), 'quoted-secret');
	assert.equal(parsed.get('OTHER'), 'single');
	assert.equal(parsed.get('EMPTY'), '');
});

test('missing environment reference fails closed before any child starts', () => {
	assert.throws(
		() => loadEnvironmentReference({ contract: CONTRACT, env: {}, ...envIo() }),
		(error) => error.code === 'ENV_REFERENCE_MISSING',
	);
});

test('environment reference file must exist', () => {
	assert.throws(
		() => loadEnvironmentReference({ contract: CONTRACT, env: { ATLAS_RUNTIME_ENV_FILE: 'C:/ops/durable.env', ATLAS_RUNTIME_SOURCE_DIR: 'C:/deploy/atlas' }, ...envIo() }),
		(error) => error.code === 'ENV_REFERENCE_MISSING',
	);
});

test('environment reference must live outside the deployed source directory', () => {
	const envFile = 'C:/deploy/atlas/.env';
	const io = envIo({ files: [[envFile, 'DATABASE_URL=x\nJWT_SECRET=y\n']], exists: (path) => path === 'C:/deploy/atlas' });
	assert.throws(
		() => loadEnvironmentReference({ contract: CONTRACT, env: { ATLAS_RUNTIME_ENV_FILE: envFile, ATLAS_RUNTIME_SOURCE_DIR: 'C:/deploy/atlas' }, ...io }),
		(error) => error.code === 'ENV_REFERENCE_INSIDE_REPO',
	);
});

test('environment reference must contain every required key without exposing values', () => {
	const envFile = 'C:/ops/durable.env';
	const io = envIo({ files: [[envFile, 'DATABASE_URL=postgresql://hidden\n']], exists: (path) => path === 'C:/deploy/atlas' });
	assert.throws(
		() => loadEnvironmentReference({ contract: CONTRACT, env: { ATLAS_RUNTIME_ENV_FILE: envFile, ATLAS_RUNTIME_SOURCE_DIR: 'C:/deploy/atlas' }, ...io }),
		(error) => error.code === 'ENV_REFERENCE_INCOMPLETE' && error.details.missingRequiredKeys.includes('JWT_SECRET'),
	);
});

test('resolved environment reference exposes key names but never values', () => {
	const envFile = 'C:/ops/durable.env';
	const io = envIo({ files: [[envFile, 'DATABASE_URL=postgresql://user:secret@host/db\nJWT_SECRET=super-secret\n']], exists: (path) => path === 'C:/deploy/atlas' });
	const reference = loadEnvironmentReference({ contract: CONTRACT, env: { ATLAS_RUNTIME_ENV_FILE: envFile, ATLAS_RUNTIME_SOURCE_DIR: 'C:/deploy/atlas' }, ...io });
	assert.deepEqual(reference.presentKeys, ['DATABASE_URL', 'JWT_SECRET']);
	const summary = JSON.stringify(summarizeEnvironmentReference(reference));
	assert.ok(!summary.includes('secret'));
	assert.ok(!summary.includes('postgresql://'));
});

test('missing deployed HEAD fails closed before release/pin checks', () => {
	assert.throws(
		() => verifyProductPin({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', env: {}, resolveHead: () => { throw new Error('no git'); }, isAncestor: () => true }),
		(error) => error.code === 'PIN_UNRESOLVED',
	);
	assert.throws(
		() => verifyProductPin({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', env: {}, resolveHead: () => 'not-a-sha', isAncestor: () => true }),
		(error) => error.code === 'PIN_UNRESOLVED',
	);
});

test('absent, invalid, or mismatched ATLAS_RUNTIME_RELEASE_SHA fails closed', () => {
	const base = { contract: CONTRACT, sourceDir: 'C:/deploy/atlas', resolveHead: () => OTHER_SHA, isAncestor: () => true };
	assert.throws(
		() => verifyProductPin({ ...base, env: {} }),
		(error) => error.code === 'RELEASE_SHA_MISSING',
	);
	assert.throws(
		() => verifyProductPin({ ...base, env: { ATLAS_RUNTIME_RELEASE_SHA: 'not-a-sha' } }),
		(error) => error.code === 'RELEASE_SHA_INVALID',
	);
	assert.throws(
		() => verifyProductPin({ ...base, env: { ATLAS_RUNTIME_RELEASE_SHA: SHA } }),
		(error) => error.code === 'RELEASE_SHA_MISMATCH',
	);
});

test('a deployed HEAD not descended from the reviewed ancestor pin fails PIN_MISMATCH', () => {
	assert.throws(
		() => verifyProductPin({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', env: { ATLAS_RUNTIME_RELEASE_SHA: OTHER_SHA }, resolveHead: () => OTHER_SHA, isAncestor: () => false }),
		(error) => error.code === 'PIN_MISMATCH',
	);
});

test('an ancestor-descended release verifies and reports releaseSha distinctly from productPin', () => {
	const result = verifyProductPin({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', env: { ATLAS_RUNTIME_RELEASE_SHA: OTHER_SHA }, resolveHead: () => OTHER_SHA, isAncestor: (pin, head) => pin === SHA && head === OTHER_SHA });
	assert.equal(result.releaseSha, OTHER_SHA);
	assert.equal(result.productPin, SHA);
	assert.notEqual(result.releaseSha, result.productPin);
	assert.equal(result.releaseLabel, CONTRACT.releaseLabel);
});

test('a REAL checked-out tree descending from the reviewed pin verifies (ancestor semantics)', () => {
	// This is the control class that was missing: a real git history containing
	// ops/runtime, where the reviewed pin is an ancestor of the installed HEAD.
	// The old equality model is unsatisfiable for such a tree.
	const repo = mkdtempSync(join(tmpdir(), 'atlas-pin-repo-'));
	const git = (args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true }).trim();
	try {
		git(['init', '-q']);
		mkdirSync(join(repo, 'ops', 'runtime'), { recursive: true });
		writeFileSync(join(repo, 'ops', 'runtime', 'host.mjs'), '// reviewed milestone\n');
		git(['add', '-A']);
		git(['-c', 'user.email=t@example.invalid', '-c', 'user.name=Test', 'commit', '-q', '-m', 'reviewed pin milestone']);
		const pin = git(['rev-parse', 'HEAD']);

		writeFileSync(join(repo, 'ops', 'runtime', 'README.md'), 'supervisor release\n');
		git(['add', '-A']);
		git(['-c', 'user.email=t@example.invalid', '-c', 'user.name=Test', 'commit', '-q', '-m', 'installed supervisor release']);
		const head = git(['rev-parse', 'HEAD']);
		assert.notEqual(head, pin);

		const contract = clone();
		contract.productPin = pin;
		const result = verifyProductPin({
			contract,
			sourceDir: repo,
			env: { ATLAS_RUNTIME_RELEASE_SHA: head },
			resolveHead: defaultResolveHead,
			isAncestor: defaultIsAncestor,
		});
		assert.equal(result.releaseSha, head);
		assert.equal(result.productPin, pin);

		// A HEAD that does not descend from an unrelated pin fails PIN_MISMATCH.
		const unrelated = clone();
		unrelated.productPin = SHA;
		assert.throws(
			() => verifyProductPin({ contract: unrelated, sourceDir: repo, env: { ATLAS_RUNTIME_RELEASE_SHA: head }, resolveHead: defaultResolveHead, isAncestor: defaultIsAncestor }),
			(error) => error.code === 'PIN_MISMATCH',
		);
	} finally {
		rmSync(repo, { recursive: true, force: true });
	}
});
