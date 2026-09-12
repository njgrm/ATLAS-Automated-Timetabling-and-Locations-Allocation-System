/**
 * Deterministic status output. Field order and nested ordering are fixed so
 * `status` is byte-stable for equal state, which makes it safe for operator
 * diffing and for tests.
 */
export function formatStatus(status) {
	const sortedInvariants = Object.fromEntries(Object.entries(status.invariants ?? {}).sort(([a], [b]) => a.localeCompare(b)));
	const ordered = {
		stream: status.stream,
		state: status.state,
		releaseLabel: status.releaseLabel,
		productPin: status.productPin,
		releaseSha: status.releaseSha,
		sourceDir: status.sourceDir,
		startedAt: status.startedAt,
		updatedAt: status.updatedAt,
		uptimeMs: status.uptimeMs,
		restartFailures: status.restartFailures,
		nextRestartAt: status.nextRestartAt,
		invariants: sortedInvariants,
		targets: (status.targets ?? []).map((target) => ({
			name: target.name,
			label: target.label,
			port: target.port,
			pid: target.pid,
			owned: target.owned,
			live: target.live,
			livenessPath: target.livenessPath,
			readinessPath: target.readinessPath,
		})),
	};
	return JSON.stringify(ordered, null, 2);
}

/**
 * Build a human-readable, non-mutating preview of the future live installation.
 * Every entry is inert: `executed` is always false and nothing is run here.
 */
export function buildInstallPreview(options) {
	const { contract, sourceDir } = options;
	const serverPort = contract.ports.server;
	const clientPort = contract.ports.client;
	return {
		executed: false,
		requiresSeparateApproval: true,
		stream: contract.stream,
		steps: [
			{
				id: 'pin-source',
				description: 'Point ATLAS_RUNTIME_SOURCE_DIR at the durable deployed checkout and confirm its HEAD descends from the reviewed product pin (ancestor milestone).',
				command: `git -C "<ATLAS_RUNTIME_SOURCE_DIR>" merge-base --is-ancestor ${contract.productPin} HEAD`,
				mutates: false,
			},
			{
				id: 'release-sha',
				description: 'Declare the exact installed release SHA; it must equal the deployed HEAD and descend from the reviewed pin.',
				command: `setx ${contract.environmentReference.releaseShaVariable} "<git -C %ATLAS_RUNTIME_SOURCE_DIR% rev-parse HEAD>"`,
				mutates: true,
			},
			{
				id: 'env-reference',
				description: 'Point ATLAS_RUNTIME_ENV_FILE at the operator-owned env file outside any worktree; never copy it into the repository.',
				command: `setx ${contract.environmentReference.variable} "<absolute operator path>"`,
				mutates: true,
			},
			{
				id: 'boot-start',
				description: 'Register the reviewed supervisor as a boot/start scheduled task owned by the operator.',
				command: `schtasks /Create /TN "ATLAS-Runtime-Supervisor" /SC ONSTART /RU "<operator account>" /TR "node ${sourceDir}/ops/runtime/cli.mjs start"`,
				mutates: true,
			},
			{
				id: 'supersede-legacy-task',
				description: `Disable and remove the superseded ${contract.legacyScheduledTask.name} task only after the supervisor is healthy.`,
				command: `schtasks /Change /TN "${contract.legacyScheduledTask.name}" /DISABLE`,
				mutates: true,
			},
			{
				id: 'start-supervisor',
				description: `Start supervising exactly one owner on ${serverPort} and ${clientPort}.`,
				command: `node ${sourceDir}/ops/runtime/cli.mjs start`,
				mutates: true,
			},
			{
				id: 'verify-status',
				description: 'Verify liveness + dependency readiness and the rollover-disabled invariant.',
				command: `node ${sourceDir}/ops/runtime/cli.mjs status`,
				mutates: false,
			},
		],
	};
}

export function buildUninstallPreview(options) {
	const { contract, sourceDir } = options;
	return {
		executed: false,
		requiresSeparateApproval: true,
		stream: contract.stream,
		steps: [
			{
				id: 'stop',
				description: 'Stop the supervised runtime; only owned child PIDs are terminated and ports must release.',
				command: `node ${sourceDir}/ops/runtime/cli.mjs stop`,
				mutates: true,
			},
			{
				id: 'remove-boot-task',
				description: 'Delete the supervisor boot/start scheduled task.',
				command: 'schtasks /Delete /TN "ATLAS-Runtime-Supervisor" /F',
				mutates: true,
			},
			{
				id: 'restore-legacy-task',
				description: `Optionally re-enable the superseded ${contract.legacyScheduledTask.name} task if operations require it.`,
				command: `schtasks /Change /TN "${contract.legacyScheduledTask.name}" /ENABLE`,
				mutates: true,
			},
			{
				id: 'verify',
				description: 'Verify both ports are empty and no supervisor process remains.',
				command: `node ${sourceDir}/ops/runtime/cli.mjs status`,
				mutates: false,
			},
		],
	};
}
