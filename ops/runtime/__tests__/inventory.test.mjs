import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContract } from '../lib/contract.mjs';
import { buildTaskQueryCommand, inspectLegacyScheduledTask, parseSchtasksList, sanitizeTaskFields } from '../lib/inventory.mjs';

const CONTRACT = loadContract();

const SCHTASKS_OUTPUT = [
	'Folder: \\',
	'HostName:                             HOST',
	'TaskName:                             \\ATLAS-DevServer-Temp2',
	'Next Run Time:                        N/A',
	'Status:                               Disabled',
	'Task To Run:                          cmd /c start-atlas-dev.cmd',
	'Run As User:                          DOMAIN\\someuser',
	'Last Run Time:                        9/12/2026 3:11:00 PM',
	'Last Result:                          1',
	'Author:                               DOMAIN\\someuser',
].join('\r\n');

test('the only scheduled-task command ever built is a read-only query', () => {
	const command = buildTaskQueryCommand('ATLAS-DevServer-Temp2');
	assert.deepEqual(command, { file: 'schtasks', args: ['/query', '/tn', 'ATLAS-DevServer-Temp2', '/v', '/fo', 'LIST'] });
	const joined = command.args.join(' ').toLowerCase();
	for (const mutation of ['/create', '/change', '/delete', '/end', '/run']) {
		assert.ok(!joined.includes(mutation), `query command must not include ${mutation}`);
	}
});

test('schtasks LIST parsing and identity redaction', () => {
	const fields = parseSchtasksList(SCHTASKS_OUTPUT);
	assert.equal(fields.Status, 'Disabled');
	assert.equal(fields['Last Result'], '1');
	const sanitized = sanitizeTaskFields(fields);
	assert.equal(sanitized['Run As User'], '<redacted>');
	assert.ok(!JSON.stringify(sanitized).includes('someuser'));
});

test('legacy task inventory is read-only and declares explicit supersession', () => {
	const calls = [];
	const inventory = inspectLegacyScheduledTask({
		contract: CONTRACT,
		runner: (command) => {
			calls.push(command);
			return SCHTASKS_OUTPUT;
		},
	});
	assert.equal(inventory.exists, true);
	assert.equal(inventory.readOnly, true);
	assert.equal(inventory.status, 'Disabled');
	assert.equal(inventory.lastResult, '1');
	assert.equal(inventory.supersession.taskName, 'ATLAS-DevServer-Temp2');
	assert.equal(inventory.supersession.supersededBy, 'RUNTIME-SUPERVISION-C01');
	assert.equal(inventory.supersession.sourceMayModify, false);
	assert.equal(calls.length, 1);
	assert.deepEqual(calls[0].args[0], '/query');
	assert.ok(!JSON.stringify(inventory).includes('someuser'), 'inventory never surfaces a machine username');
});

test('a missing legacy task is reported as absent without mutation', () => {
	const calls = [];
	const inventory = inspectLegacyScheduledTask({
		contract: CONTRACT,
		runner: (command) => {
			calls.push(command);
			const error = new Error('task not found');
			error.status = 1;
			throw error;
		},
	});
	assert.equal(inventory.exists, false);
	assert.equal(inventory.readOnly, true);
	assert.equal(inventory.supersession.observed, false);
	assert.equal(calls.length, 1);
});
