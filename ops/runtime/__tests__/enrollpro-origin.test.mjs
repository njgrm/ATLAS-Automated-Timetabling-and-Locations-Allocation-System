import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContract, validateContract } from '../lib/contract.mjs';
import {
	ENROLLPRO_ORIGIN_INVALID,
	ENROLLPRO_ORIGIN_MISSING,
	normalizeEnrollProOrigin,
	normalizeHttpOrigin,
	resolveEnrollProOrigin,
} from '../lib/enrollpro-origin.mjs';
import { buildTargets } from '../lib/supervisor.mjs';

const CONTRACT = loadContract();
const DURABLE = 'https://dev-jegs.buru-degree.ts.net';

function clone() {
	return JSON.parse(JSON.stringify(CONTRACT));
}

/* ─── Shared origin normalizer (R2) ────────────────────────────────────────── */

test('normalizeEnrollProOrigin accepts normalized http(s) origins and drops a single trailing slash', () => {
	assert.equal(normalizeEnrollProOrigin('https://dev-jegs.buru-degree.ts.net'), DURABLE);
	assert.equal(normalizeEnrollProOrigin('https://dev-jegs.buru-degree.ts.net/'), DURABLE);
	assert.equal(normalizeEnrollProOrigin('  https://dev-jegs.buru-degree.ts.net/  '), DURABLE);
	assert.equal(normalizeEnrollProOrigin('http://127.0.0.1:5000'), 'http://127.0.0.1:5000');
	assert.equal(normalizeEnrollProOrigin('HTTP://Host.Example:8080'), 'http://host.example:8080');
});

test('normalizeEnrollProOrigin treats absent and blank values as missing semantics', () => {
	assert.equal(normalizeEnrollProOrigin(undefined), null);
	assert.equal(normalizeEnrollProOrigin(null), null);
	assert.equal(normalizeEnrollProOrigin(''), null);
	assert.equal(normalizeEnrollProOrigin('   '), null);
});

test('normalizeEnrollProOrigin rejects credentials, path, query, fragment, scheme, and unparseable values', () => {
	for (const invalid of [
		'https://user:pass@host.example',
		'https://host.example/api',
		'https://host.example/api/',
		'https://host.example/?x=1',
		'https://host.example/#frag',
		'ftp://host.example',
		'mailto:ops@host.example',
		'host.example',
		'https://',
		'http:// host.example',
	]) {
		assert.throws(
			() => normalizeEnrollProOrigin(invalid),
			(error) => error.code === ENROLLPRO_ORIGIN_INVALID,
			`${invalid} must be rejected as ${ENROLLPRO_ORIGIN_INVALID}`,
		);
	}
});

test('normalizeHttpOrigin surfaces the caller-supplied code and label', () => {
	assert.throws(
		() => normalizeHttpOrigin('not a url', { code: 'RUNTIME_CONTRACT_INVALID', label: 'upstream.defaultEnrollProOrigin' }),
		(error) => error.code === 'RUNTIME_CONTRACT_INVALID' && /upstream\.defaultEnrollProOrigin/.test(error.message),
	);
});

/* ─── Durable precedence inside the composed child env (R1) ────────────────── */

test('buildTargets resolves the EnrollPro target from the durable env, not the inherited env', () => {
	// Failing-first control: the pre-fix code read the raw inherited `env` and
	// therefore produced `http://inherited.invalid` here.
	const targets = buildTargets({
		contract: CONTRACT,
		sourceDir: 'C:/deploy/atlas',
		env: { ENROLLPRO_PROXY_ORIGIN: 'http://inherited.invalid' },
		envValues: { ENROLLPRO_PROXY_ORIGIN: DURABLE },
	});
	const client = targets.find((target) => target.name === 'client');
	assert.equal(client.env.ATLAS_HOST_ENROLLPRO_TARGET, DURABLE);
	assert.equal(client.env.ROLLOVER_AUTO_SYNC_ENABLED, 'false', 'pinned invariants stay pinned');
});

test('buildTargets uses a durable value when the inherited environment has none, and normalizes a trailing slash', () => {
	const onlyDurable = buildTargets({
		contract: CONTRACT,
		sourceDir: 'C:/deploy/atlas',
		env: {},
		envValues: { ENROLLPRO_PROXY_ORIGIN: `${DURABLE}/` },
	});
	assert.equal(onlyDurable.find((target) => target.name === 'client').env.ATLAS_HOST_ENROLLPRO_TARGET, DURABLE);
});

test('buildTargets rejects a malformed durable origin before any target is built', () => {
	assert.throws(
		() => buildTargets({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', env: {}, envValues: { ENROLLPRO_PROXY_ORIGIN: 'https://host.example/path' } }),
		(error) => error.code === ENROLLPRO_ORIGIN_INVALID,
	);
});

test('buildTargets keeps the reviewed development default outside the launch gate', () => {
	const targets = buildTargets({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas', env: {}, envValues: {} });
	assert.equal(targets.find((target) => target.name === 'client').env.ATLAS_HOST_ENROLLPRO_TARGET, CONTRACT.upstream.defaultEnrollProOrigin);
});

/* ─── Launch gate semantics (R3) ───────────────────────────────────────────── */

test('resolveEnrollProOrigin requires an explicit origin only for the supervised launch gate', () => {
	assert.throws(
		() => resolveEnrollProOrigin({ contract: CONTRACT, childEnv: {}, requireExplicit: true }),
		(error) => error.code === ENROLLPRO_ORIGIN_MISSING,
	);
	assert.equal(
		resolveEnrollProOrigin({ contract: CONTRACT, childEnv: {}, requireExplicit: false }),
		CONTRACT.upstream.defaultEnrollProOrigin,
	);
	// A durable value that composes over an inherited value still wins.
	assert.equal(
		resolveEnrollProOrigin({ contract: CONTRACT, childEnv: { ENROLLPRO_PROXY_ORIGIN: DURABLE }, requireExplicit: true }),
		DURABLE,
	);
});

/* ─── Contract upstream shape (R2) ─────────────────────────────────────────── */

test('validateContract rejects a missing or malformed upstream shape', () => {
	const missing = clone();
	delete missing.upstream;
	assert.throws(() => validateContract(missing), (error) => error.code === 'RUNTIME_CONTRACT_INVALID');

	const badVariable = clone();
	badVariable.upstream.enrollProOriginVariable = 'not a variable';
	assert.throws(() => validateContract(badVariable), (error) => error.code === 'RUNTIME_CONTRACT_INVALID');

	const badDefault = clone();
	badDefault.upstream.defaultEnrollProOrigin = 'https://host.example/path';
	assert.throws(() => validateContract(badDefault), (error) => error.code === 'RUNTIME_CONTRACT_INVALID');

	const absentDefault = clone();
	absentDefault.upstream.defaultEnrollProOrigin = '';
	assert.throws(() => validateContract(absentDefault), (error) => error.code === 'RUNTIME_CONTRACT_INVALID');
});

test('validateContract accepts the reviewed contract upstream shape', () => {
	const reviewed = clone();
	assert.equal(validateContract(reviewed).upstream.enrollProOriginVariable, 'ENROLLPRO_PROXY_ORIGIN');
});
