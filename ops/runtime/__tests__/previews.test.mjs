import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContract } from '../lib/contract.mjs';
import { runCli } from '../cli.mjs';
import { buildInstallPreview, buildUninstallPreview } from '../lib/status.mjs';

const CONTRACT = loadContract();

test('install preview is inert and covers pin, env reference, boot, supersession, and start', () => {
	const preview = buildInstallPreview({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas' });
	assert.equal(preview.executed, false);
	assert.equal(preview.requiresSeparateApproval, true);
	const ids = preview.steps.map((step) => step.id);
	for (const required of ['pin-source', 'env-reference', 'boot-start', 'supersede-legacy-task', 'start-supervisor', 'verify-status']) {
		assert.ok(ids.includes(required), `missing preview step ${required}`);
	}
	assert.ok(preview.steps.some((step) => step.command.includes(CONTRACT.productPin)));
	assert.ok(preview.steps.some((step) => step.command.includes(CONTRACT.legacyScheduledTask.name)));
});

test('uninstall preview is a reversible counterpart of the install preview', () => {
	const preview = buildUninstallPreview({ contract: CONTRACT, sourceDir: 'C:/deploy/atlas' });
	assert.equal(preview.executed, false);
	const ids = preview.steps.map((step) => step.id);
	for (const required of ['stop', 'remove-boot-task', 'restore-legacy-task', 'verify']) {
		assert.ok(ids.includes(required), `missing uninstall step ${required}`);
	}
});

test('install-preview and uninstall-preview CLI commands never mutate', async () => {
	const install = await runCli(['install-preview'], { contract: CONTRACT, env: { ATLAS_RUNTIME_SOURCE_DIR: 'C:/deploy/atlas' } });
	assert.equal(install.exitCode, 0);
	assert.equal(JSON.parse(install.output).executed, false);
	const uninstall = await runCli(['uninstall-preview'], { contract: CONTRACT, env: { ATLAS_RUNTIME_SOURCE_DIR: 'C:/deploy/atlas' } });
	assert.equal(uninstall.exitCode, 0);
	assert.equal(JSON.parse(uninstall.output).executed, false);
});

test('inventory CLI runs a read-only query and surfaces supersession', async () => {
	const calls = [];
	const result = await runCli(['inventory'], {
		contract: CONTRACT,
		env: {},
		taskRunner: (command) => {
			calls.push(command);
			return ['Status: Disabled', 'Last Result: 1', 'Task To Run: start-atlas-dev.cmd'].join('\n');
		},
	});
	assert.equal(result.exitCode, 0);
	const inventory = JSON.parse(result.output);
	assert.equal(inventory.exists, true);
	assert.equal(inventory.readOnly, true);
	assert.equal(inventory.supersession.supersededBy, 'RUNTIME-SUPERVISION-C01');
	assert.equal(calls.length, 1);
	assert.equal(calls[0].args[0], '/query');
});

test('unknown CLI commands fail with usage without performing work', async () => {
	const result = await runCli(['frobnicate'], { contract: CONTRACT, env: {} });
	assert.equal(result.exitCode, 1);
	assert.equal(JSON.parse(result.output).code, 'CLI_USAGE');
});
