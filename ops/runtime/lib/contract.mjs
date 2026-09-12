import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail } from './errors.mjs';

/** Default location of the reviewed, immutable contract. */
export const DEFAULT_CONTRACT_PATH = fileURLToPath(new URL('../runtime-contract.json', import.meta.url));

const CONTRACT_REQUIRED_KEYS = ['contractVersion', 'stream', 'productPin', 'releaseLabel', 'serverEntry', 'clientDist', 'ports', 'invariants', 'environmentReference', 'logs', 'supervision', 'state', 'legacyScheduledTask'];
const HEX40 = /^[0-9a-f]{40}$/;

function assertObject(value, code, label) {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw fail(code, `${label} must be an object.`);
	}
	return value;
}

function assertPositiveInt(value, code, label) {
	if (!Number.isInteger(value) || value <= 0) {
		throw fail(code, `${label} must be a positive integer.`);
	}
	return value;
}

/**
 * Validate the immutable contract shape. Any deviation is a fail-closed
 * contract defect: the supervisor must not start with an ambiguous pin, port,
 * invariant, or bound.
 */
export function validateContract(contract) {
	assertObject(contract, 'RUNTIME_CONTRACT_INVALID', 'contract');
	for (const key of CONTRACT_REQUIRED_KEYS) {
		if (!(key in contract)) throw fail('RUNTIME_CONTRACT_INVALID', `contract is missing required key "${key}".`);
	}
	if (contract.contractVersion !== 1) throw fail('RUNTIME_CONTRACT_INVALID', `unsupported contractVersion ${JSON.stringify(contract.contractVersion)}.`);
	if (typeof contract.productPin !== 'string' || !HEX40.test(contract.productPin)) {
		throw fail('RUNTIME_CONTRACT_INVALID', 'productPin must be a 40-character lowercase hex commit SHA.');
	}
	if (typeof contract.releaseLabel !== 'string' || contract.releaseLabel.trim() === '') {
		throw fail('RUNTIME_CONTRACT_INVALID', 'releaseLabel must be a non-empty string.');
	}
	for (const key of ['serverEntry', 'clientDist']) {
		if (typeof contract[key] !== 'string' || contract[key].trim() === '' || isAbsolute(contract[key]) || contract[key].split(/[\\/]/).includes('..')) {
			throw fail('RUNTIME_CONTRACT_INVALID', `${key} must be a repository-relative path without traversal.`);
		}
	}
	const ports = assertObject(contract.ports, 'RUNTIME_CONTRACT_INVALID', 'ports');
	for (const key of ['server', 'client']) {
		const port = assertPositiveInt(ports[key], 'RUNTIME_CONTRACT_INVALID', `ports.${key}`);
		if (port > 65535) throw fail('RUNTIME_CONTRACT_INVALID', `ports.${key} must be <= 65535.`);
	}
	if (ports.server === ports.client) throw fail('RUNTIME_CONTRACT_INVALID', 'server and client ports must differ.');

	const invariants = assertObject(contract.invariants, 'RUNTIME_CONTRACT_INVALID', 'invariants');
	if (invariants.ROLLOVER_AUTO_SYNC_ENABLED !== 'false') {
		throw fail('RUNTIME_CONTRACT_INVALID', 'invariants.ROLLOVER_AUTO_SYNC_ENABLED must be the pinned string "false".');
	}

	const envRef = assertObject(contract.environmentReference, 'RUNTIME_CONTRACT_INVALID', 'environmentReference');
	for (const key of ['variable', 'sourceDirVariable', 'releaseShaVariable']) {
		if (typeof envRef[key] !== 'string' || envRef[key].trim() === '') {
			throw fail('RUNTIME_CONTRACT_INVALID', `environmentReference.${key} must be a non-empty variable name.`);
		}
	}
	if (!Array.isArray(envRef.requiredKeys) || envRef.requiredKeys.length === 0 || envRef.requiredKeys.some((k) => typeof k !== 'string' || k.trim() === '')) {
		throw fail('RUNTIME_CONTRACT_INVALID', 'environmentReference.requiredKeys must be a non-empty string list.');
	}

	const logs = assertObject(contract.logs, 'RUNTIME_CONTRACT_INVALID', 'logs');
	assertPositiveInt(logs.maxBytes, 'RUNTIME_CONTRACT_INVALID', 'logs.maxBytes');
	assertPositiveInt(logs.maxFiles, 'RUNTIME_CONTRACT_INVALID', 'logs.maxFiles');
	if (logs.maxFiles < 2) throw fail('RUNTIME_CONTRACT_INVALID', 'logs.maxFiles must be at least 2 to retain one rotated file.');

	const supervision = assertObject(contract.supervision, 'RUNTIME_CONTRACT_INVALID', 'supervision');
	for (const key of ['maxRestarts', 'backoffBaseMs', 'backoffMaxMs', 'survivalWindowMs', 'readinessTimeoutMs', 'livenessTimeoutMs', 'shutdownGraceMs']) {
		assertPositiveInt(supervision[key], 'RUNTIME_CONTRACT_INVALID', `supervision.${key}`);
	}
	if (supervision.backoffMaxMs < supervision.backoffBaseMs) {
		throw fail('RUNTIME_CONTRACT_INVALID', 'supervision.backoffMaxMs must be >= backoffBaseMs.');
	}
	if (typeof supervision.healthLivenessPath !== 'string' || !supervision.healthLivenessPath.startsWith('/')) {
		throw fail('RUNTIME_CONTRACT_INVALID', 'supervision.healthLivenessPath must be an absolute path.');
	}
	if (typeof supervision.healthReadinessPath !== 'string' || supervision.healthReadinessPath === supervision.healthLivenessPath) {
		throw fail('RUNTIME_CONTRACT_INVALID', 'supervision.healthReadinessPath must be a distinct absolute path.');
	}

	assertObject(contract.legacyScheduledTask, 'RUNTIME_CONTRACT_INVALID', 'legacyScheduledTask');
	if (typeof contract.legacyScheduledTask.name !== 'string' || contract.legacyScheduledTask.name.trim() === '') {
		throw fail('RUNTIME_CONTRACT_INVALID', 'legacyScheduledTask.name must be a non-empty string.');
	}
	return contract;
}

export function loadContract(options = {}) {
	const contractPath = options.contractPath ?? DEFAULT_CONTRACT_PATH;
	const read = options.readFileSync ?? readFileSync;
	let parsed;
	try {
		parsed = JSON.parse(read(contractPath, 'utf8'));
	} catch (error) {
		throw fail('RUNTIME_CONTRACT_UNREADABLE', `Cannot read runtime contract at ${contractPath}: ${error instanceof Error ? error.message : String(error)}`);
	}
	return validateContract(parsed);
}

function canonical(pathValue, realpath = realpathSync) {
	try {
		return realpath(pathValue);
	} catch {
		return resolve(pathValue);
	}
}

function normalizeForCompare(pathValue) {
	return canonical(pathValue).replace(/[\\/]+$/, '').toLowerCase();
}

/** True when `childPath` equals or is nested inside `parentPath`. */
export function isPathInside(childPath, parentPath) {
	const child = normalizeForCompare(childPath);
	const parent = normalizeForCompare(parentPath);
	if (child === parent) return true;
	const withSep = parent.endsWith(sep) ? parent : parent + sep;
	return child.startsWith(withSep);
}

/** Relative path is repo-relative (no absolute/traversal) and non-empty. */
export function assertRepoRelativePath(value, code, label) {
	if (typeof value !== 'string' || value.trim() === '' || isAbsolute(value) || value.split(/[\\/]/).some((segment) => segment === '..')) {
		throw fail(code, `${label} must be a non-empty repository-relative path without traversal.`);
	}
	return value;
}

/** Parse a dotenv-format file into a key -> raw string map (no interpolation). */
export function parseEnvFile(text) {
	const values = new Map();
	for (const rawLine of String(text).split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line === '' || line.startsWith('#')) continue;
		const withoutExport = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
		const eq = withoutExport.indexOf('=');
		if (eq <= 0) continue;
		const key = withoutExport.slice(0, eq).trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
		let value = withoutExport.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		values.set(key, value);
	}
	return values;
}

/**
 * Resolve the operator-owned environment reference.
 *
 * Fail-closed rules:
 * - the reference variable must be present and non-empty;
 * - the file must exist and be readable;
 * - the file must live OUTSIDE the deployed source directory (never a
 *   worktree-only transient path);
 * - the durable source directory must be present and exist;
 * - every required key must be defined.
 *
 * Secret values are returned for child propagation only; callers must never
 * log, print, or persist them.
 */
export function loadEnvironmentReference(options) {
	const { contract, env = process.env } = options;
	const read = options.readFileSync ?? readFileSync;
	const exists = options.existsSync ?? existsSync;
	const realpath = options.realpathSync ?? realpathSync;

	const refVar = contract.environmentReference.variable;
	const refPath = env[refVar];
	if (typeof refPath !== 'string' || refPath.trim() === '') {
		throw fail('ENV_REFERENCE_MISSING', `Required operator environment reference ${refVar} is not set.`);
	}
	if (!isAbsolute(refPath)) {
		throw fail('ENV_REFERENCE_INVALID', `${refVar} must be an absolute path.`);
	}
	if (!exists(refPath)) {
		throw fail('ENV_REFERENCE_MISSING', `Environment reference file does not exist: ${refPath}`);
	}

	const sourceDirVar = contract.environmentReference.sourceDirVariable;
	const sourceDir = env[sourceDirVar];
	if (typeof sourceDir !== 'string' || sourceDir.trim() === '') {
		throw fail('SOURCE_DIR_MISSING', `Required operator source directory reference ${sourceDirVar} is not set.`);
	}
	if (!isAbsolute(sourceDir)) {
		throw fail('SOURCE_DIR_INVALID', `${sourceDirVar} must be an absolute path.`);
	}
	if (!exists(sourceDir)) {
		throw fail('SOURCE_DIR_MISSING', `Source directory does not exist: ${sourceDir}`);
	}

	if (isPathInside(refPath, sourceDir)) {
		throw fail('ENV_REFERENCE_INSIDE_REPO', `Environment reference file must live outside the deployed source directory; ${refVar} points inside ${sourceDirVar}.`);
	}

	let values;
	try {
		values = parseEnvFile(read(refPath, 'utf8'));
	} catch (error) {
		throw fail('ENV_REFERENCE_UNREADABLE', `Cannot read environment reference file: ${error instanceof Error ? error.message : String(error)}`);
	}

	const presentKeys = [...values.keys()].sort();
	const missingRequiredKeys = contract.environmentReference.requiredKeys.filter((key) => !values.has(key) || values.get(key).trim() === '');
	if (missingRequiredKeys.length > 0) {
		throw fail('ENV_REFERENCE_INCOMPLETE', `Environment reference is missing required keys: ${missingRequiredKeys.join(', ')}`, { missingRequiredKeys });
	}

	return { path: refPath, sourceDir, values, presentKeys, missingRequiredKeys: [] };
}

/**
 * Return a secret-free summary suitable for durable logs. Only variable names
 * and counts are exposed; values never leave this boundary.
 */
export function summarizeEnvironmentReference(reference) {
	return {
		path: reference.path,
		sourceDir: reference.sourceDir,
		keyCount: reference.presentKeys.length,
		presentKeys: reference.presentKeys,
	};
}

/**
 * Verify the deployed release against the reviewed pin contract.
 *
 * Model (satisfiable for an installable tree):
 * - `productPin` is the reviewed ANCESTOR milestone that must be reachable
 *   from the deployed HEAD (`git merge-base --is-ancestor`). A commit cannot
 *   contain its own SHA, so equality with the pin is intentionally NOT required.
 * - `ATLAS_RUNTIME_RELEASE_SHA` is the operator-declared exact installed HEAD.
 *   It must be present and must equal the resolved HEAD (declared-vs-actual).
 *
 * All resolution is injected so tests can model git semantics without a
 * precomputed result; the real-path control runs against a temporary git repo.
 */
export function verifyProductPin(options) {
	const { contract, sourceDir } = options;
	const resolveHead = options.resolveHead;
	const isAncestor = options.isAncestor;
	if (typeof resolveHead !== 'function') {
		throw fail('PIN_RESOLVER_MISSING', 'verifyProductPin requires a resolveHead function.');
	}
	if (typeof isAncestor !== 'function') {
		throw fail('PIN_RESOLVER_MISSING', 'verifyProductPin requires an isAncestor function.');
	}
	const env = options.env ?? process.env;

	let head;
	try {
		head = resolveHead(sourceDir);
	} catch (error) {
		throw fail('PIN_UNRESOLVED', `Cannot resolve the deployed HEAD from the source directory: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (typeof head !== 'string' || !HEX40.test(head)) {
		throw fail('PIN_UNRESOLVED', 'Resolved deployed HEAD is not a 40-character lowercase hex commit SHA.');
	}

	const releaseShaVariable = contract.environmentReference.releaseShaVariable;
	const declaredReleaseSha = env[releaseShaVariable];
	if (declaredReleaseSha === undefined || declaredReleaseSha === null || String(declaredReleaseSha).trim() === '') {
		throw fail('RELEASE_SHA_MISSING', `Required exact release SHA ${releaseShaVariable} is not set.`);
	}
	if (typeof declaredReleaseSha !== 'string' || !HEX40.test(declaredReleaseSha)) {
		throw fail('RELEASE_SHA_INVALID', `${releaseShaVariable} must be a 40-character lowercase hex commit SHA.`);
	}
	if (declaredReleaseSha !== head) {
		throw fail('RELEASE_SHA_MISMATCH', 'Declared release SHA does not match the deployed source directory HEAD.');
	}

	let descendant;
	try {
		descendant = isAncestor(contract.productPin, head, sourceDir);
	} catch (error) {
		throw fail('PIN_CHECK_FAILED', `Cannot verify the reviewed pin ancestry: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (descendant !== true) {
		throw fail('PIN_MISMATCH', `Deployed HEAD ${head} does not descend from the reviewed product pin ${contract.productPin}.`);
	}

	return {
		head,
		releaseSha: head,
		declaredReleaseSha,
		productPin: contract.productPin,
		releaseLabel: contract.releaseLabel,
	};
}

/**
 * Resolve the durable log directory. When the operator variable is absent the
 * repository-relative default under the deployed source directory is used so
 * logs always remain bounded and durable rather than worktree-scoped.
 */
export function resolveLogDirectory(options) {
	const { contract, sourceDir, env = process.env } = options;
	const variable = contract.logs.directoryVariable;
	const override = env[variable];
	if (typeof override === 'string' && override.trim() !== '') {
		if (!isAbsolute(override)) throw fail('LOG_DIR_INVALID', `${variable} must be an absolute path when set.`);
		return normalizeForCompare(override) === normalizeForCompare(sourceDir) ? override : resolve(override);
	}
	return resolve(sourceDir, contract.logs.defaultDirectory);
}

/** Resolve the pinned invariant environment applied to every child process. */
export function resolveInvariantEnv(contract) {
	return Object.fromEntries(Object.entries(contract.invariants).map(([key, value]) => [key, String(value)]));
}
