import test from 'node:test';
import assert from 'node:assert/strict';

import {
	loadContract,
	loadEnvironmentReference,
	parseEnvFile,
	resolveInvariantEnv,
	summarizeEnvironmentReference,
	validateContract,
	verifyProductPin,
} from '../lib/contract.mjs';

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

test('product pin verification rejects a stale or mismatched deployed source', () => {
	assert.throws(
		() => verifyProductPin({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', env: {}, resolveSha: () => OTHER_SHA }),
		(error) => error.code === 'PIN_MISMATCH',
	);
	assert.throws(
		() => verifyProductPin({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', env: {}, resolveSha: () => 'not-a-sha' }),
		(error) => error.code === 'PIN_UNRESOLVED',
	);
	assert.throws(
		() => verifyProductPin({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', env: {}, resolveSha: () => { throw new Error('no git'); } }),
		(error) => error.code === 'PIN_UNRESOLVED',
	);
});

test('product pin verification rejects a declared/actual mismatch and accepts an exact match', () => {
	assert.throws(
		() => verifyProductPin({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', env: { ATLAS_RUNTIME_PRODUCT_SHA: OTHER_SHA }, resolveSha: () => SHA }),
		(error) => error.code === 'PIN_MISMATCH',
	);
	const result = verifyProductPin({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', env: { ATLAS_RUNTIME_PRODUCT_SHA: SHA }, resolveSha: () => SHA });
	assert.equal(result.actualSha, SHA);
	assert.equal(result.releaseLabel, CONTRACT.releaseLabel);
});
