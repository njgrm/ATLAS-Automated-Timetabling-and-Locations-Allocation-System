import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Durable supervisor state, used for duplicate-instance prevention, rollback,
 * and deterministic status output. The file contains only identities and
 * lifecycle facts — never secrets.
 */
export function readState(statePath, fsImpl = {}) {
	const exists = fsImpl.existsSync ?? existsSync;
	const read = fsImpl.readFileSync ?? readFileSync;
	if (!exists(statePath)) return null;
	try {
		return JSON.parse(read(statePath, 'utf8'));
	} catch {
		return null;
	}
}

export function writeState(statePath, state, fsImpl = {}) {
	const exists = fsImpl.existsSync ?? existsSync;
	const mkdir = fsImpl.mkdirSync ?? mkdirSync;
	const write = fsImpl.writeFileSync ?? writeFileSync;
	const rename = fsImpl.renameSync ?? renameSync;
	const dir = dirname(statePath);
	if (!exists(dir)) mkdir(dir, { recursive: true });
	const temp = `${statePath}.tmp`;
	write(temp, JSON.stringify(state, null, 2));
	rename(temp, statePath);
	return state;
}

export function clearState(statePath, fsImpl = {}) {
	const exists = fsImpl.existsSync ?? existsSync;
	const rm = fsImpl.rmSync ?? rmSync;
	if (exists(statePath)) rm(statePath, { force: true });
}

/** Best-effort liveness probe for a recorded PID (signals are not delivered). */
export function isPidAlive(pid, kill = process.kill) {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		kill(pid, 0);
		return true;
	} catch (error) {
		// EPERM means the process exists but is not signalable by this user.
		return error && error.code === 'EPERM';
	}
}

/** Build a fresh state record with explicit previous-run preservation. */
export function newState(options) {
	const { contract, ownedPids, prior, state, now, sourceDir } = options;
	const timestamp = now ?? new Date().toISOString();
	return {
		contractVersion: contract.contractVersion,
		stream: contract.stream,
		releaseLabel: contract.releaseLabel,
		productPin: contract.productPin,
		sourceDir: sourceDir ?? prior?.sourceDir ?? null,
		state,
		startedAt: prior?.startedAt ?? timestamp,
		updatedAt: timestamp,
		ownedPids: { ...ownedPids },
		previous: prior
			? {
					state: prior.state,
					productPin: prior.productPin,
					releaseLabel: prior.releaseLabel,
					sourceDir: prior.sourceDir ?? null,
					ownedPids: prior.ownedPids ?? {},
					updatedAt: prior.updatedAt,
				}
			: null,
	};
}
