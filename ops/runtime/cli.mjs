import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadContract, loadEnvironmentReference, resolveLogDirectory, summarizeEnvironmentReference, verifyProductPin } from './lib/contract.mjs';
import { BoundedLogger } from './lib/logs.mjs';
import { Supervisor, buildTargets } from './lib/supervisor.mjs';
import { buildInstallPreview, buildUninstallPreview, formatStatus } from './lib/status.mjs';
import { inspectLegacyScheduledTask } from './lib/inventory.mjs';
import { RuntimeError, fail } from './lib/errors.mjs';
import { readState } from './lib/state.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

function defaultResolveSha(sourceDir) {
	return execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
}

function resolveSourceDirForPreview(env) {
	const value = env.ATLAS_RUNTIME_SOURCE_DIR;
	return typeof value === 'string' && value.trim() !== '' ? resolve(value) : REPO_ROOT;
}

function statePathFor(sourceDir, contract) {
	return resolve(sourceDir, contract.logs.defaultDirectory, contract.state.fileBaseName);
}

async function runStart(deps) {
	const contract = deps.contract;
	const env = deps.env;
	const reference = loadEnvironmentReference({ contract, env });
	verifyProductPin({ contract, sourceDir: reference.sourceDir, resolveSha: deps.resolveSha });
	const logDirectory = resolveLogDirectory({ contract, sourceDir: reference.sourceDir, env });
	const logger = new BoundedLogger({
		directory: logDirectory,
		fileBaseName: contract.logs.fileBaseName,
		maxBytes: contract.logs.maxBytes,
		maxFiles: contract.logs.maxFiles,
		secretValues: [...reference.values.values()],
	});
	logger.info(`Starting ${contract.stream} release=${contract.releaseLabel} pin=${contract.productPin}`);
	logger.info(`Environment reference: ${JSON.stringify(summarizeEnvironmentReference(reference))}`);
	const targets = buildTargets({ contract, sourceDir: reference.sourceDir, envValues: Object.fromEntries(reference.values) });
	const supervisor = new Supervisor({ contract, sourceDir: reference.sourceDir, logger, targets, statePath: statePathFor(reference.sourceDir, contract) });
	const status = await supervisor.start();
	return { exitCode: 0, output: formatStatus(status) };
}

async function runStop(deps) {
	const contract = deps.contract;
	const reference = loadEnvironmentReference({ contract, env: deps.env });
	const logger = new BoundedLogger({ directory: resolveLogDirectory({ contract, sourceDir: reference.sourceDir, env: deps.env }), fileBaseName: contract.logs.fileBaseName, maxBytes: contract.logs.maxBytes, maxFiles: contract.logs.maxFiles, secretValues: [...reference.values.values()] });
	const targets = buildTargets({ contract, sourceDir: reference.sourceDir, envValues: Object.fromEntries(reference.values) });
	const supervisor = new Supervisor({ contract, sourceDir: reference.sourceDir, logger, targets, statePath: statePathFor(reference.sourceDir, contract), inspectListeners: deps.inspectListeners });
	const status = await supervisor.stop();
	return { exitCode: 0, output: formatStatus(status) };
}

async function runStatus(deps) {
	const contract = deps.contract;
	const reference = loadEnvironmentReference({ contract, env: deps.env });
	const prior = readState(statePathFor(reference.sourceDir, contract));
	const targets = buildTargets({ contract, sourceDir: reference.sourceDir, envValues: Object.fromEntries(reference.values) });
	const supervisor = new Supervisor({ contract, sourceDir: reference.sourceDir, logger: null, targets, statePath: statePathFor(reference.sourceDir, contract), inspectListeners: deps.inspectListeners });
	supervisor.ownedPids = prior?.ownedPids ?? {};
	supervisor.state = prior?.state ?? 'stopped';
	const status = supervisor.getStatus();
	return { exitCode: 0, output: formatStatus(status) };
}

async function runRollback(deps) {
	const contract = deps.contract;
	const reference = loadEnvironmentReference({ contract, env: deps.env });
	verifyProductPin({ contract, sourceDir: reference.sourceDir, resolveSha: deps.resolveSha });
	const logger = new BoundedLogger({ directory: resolveLogDirectory({ contract, sourceDir: reference.sourceDir, env: deps.env }), fileBaseName: contract.logs.fileBaseName, maxBytes: contract.logs.maxBytes, maxFiles: contract.logs.maxFiles, secretValues: [...reference.values.values()] });
	const targets = buildTargets({ contract, sourceDir: reference.sourceDir, envValues: Object.fromEntries(reference.values) });
	const supervisor = new Supervisor({ contract, sourceDir: reference.sourceDir, logger, targets, statePath: statePathFor(reference.sourceDir, contract), inspectListeners: deps.inspectListeners });
	const status = await supervisor.rollback();
	return { exitCode: 0, output: formatStatus(status) };
}

function runPreview(deps, kind) {
	const contract = deps.contract;
	const sourceDir = resolveSourceDirForPreview(deps.env);
	const preview = kind === 'install' ? buildInstallPreview({ contract, sourceDir }) : buildUninstallPreview({ contract, sourceDir });
	return { exitCode: 0, output: JSON.stringify(preview, null, 2) };
}

function runInventory(deps) {
	const inventory = inspectLegacyScheduledTask({ contract: deps.contract, runner: deps.taskRunner });
	return { exitCode: 0, output: JSON.stringify(inventory, null, 2) };
}

/** Dispatch a CLI command. Exported so tests can drive routing without a shell. */
export async function runCli(argv, overrides = {}) {
	const command = argv[0];
	const deps = {
		contract: overrides.contract ?? loadContract(overrides.contractOptions),
		env: overrides.env ?? process.env,
		resolveSha: overrides.resolveSha ?? defaultResolveSha,
		inspectListeners: overrides.inspectListeners,
		taskRunner: overrides.taskRunner,
	};
	try {
		switch (command) {
			case 'start':
				return await runStart(deps);
			case 'stop':
				return await runStop(deps);
			case 'status':
				return await runStatus(deps);
			case 'rollback':
				return await runRollback(deps);
			case 'install-preview':
				return runPreview(deps, 'install');
			case 'uninstall-preview':
				return runPreview(deps, 'uninstall');
			case 'inventory':
				return runInventory(deps);
			default:
				throw fail('CLI_USAGE', 'Usage: node ops/runtime/cli.mjs <start|stop|status|rollback|install-preview|uninstall-preview|inventory>');
		}
	} catch (error) {
		if (error instanceof RuntimeError) {
			return { exitCode: 1, output: JSON.stringify({ code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) }, null, 2) };
		}
		throw error;
	}
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
	runCli(process.argv.slice(2))
		.then((result) => {
			console.log(result.output);
			process.exitCode = result.exitCode;
		})
		.catch((error) => {
			console.error(JSON.stringify({ code: 'CLI_UNEXPECTED', message: error instanceof Error ? error.message : String(error) }, null, 2));
			process.exitCode = 1;
		});
}

export { REPO_ROOT, statePathFor };
