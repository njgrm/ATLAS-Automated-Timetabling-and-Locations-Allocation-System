import { execFileSync } from 'node:child_process';

import { fail } from './errors.mjs';

/**
 * Read-only Windows scheduled-task inventory.
 *
 * The only command this module can ever build is `schtasks /query`. It never
 * creates, changes, disables, or deletes a task. The legacy
 * `ATLAS-DevServer-Temp2` task is treated as observed external state and is
 * superseded by this supervision contract; removing it belongs to a separate
 * reviewed live-install packet.
 */
export function buildTaskQueryCommand(name) {
	return { file: 'schtasks', args: ['/query', '/tn', name, '/v', '/fo', 'LIST'] };
}

/** Parse `schtasks /query /v /fo LIST` output into a key -> value object. */
export function parseSchtasksList(output) {
	const fields = {};
	for (const rawLine of String(output).split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line === '') continue;
		const colon = line.indexOf(':');
		if (colon <= 0) continue;
		const key = line.slice(0, colon).trim();
		const value = line.slice(colon + 1).trim();
		if (key !== '') fields[key] = value;
	}
	return fields;
}

/** Omit identity-bearing fields so no machine username is ever surfaced. */
export function sanitizeTaskFields(fields) {
	const omitted = new Set(['Run As User', 'Author', 'Run As User ']);
	const out = {};
	for (const [key, value] of Object.entries(fields)) {
		if (omitted.has(key)) {
			out[key] = '<redacted>';
			continue;
		}
		out[key] = value;
	}
	return out;
}

export function inspectLegacyScheduledTask(options) {
	const { contract } = options;
	const name = options.name ?? contract.legacyScheduledTask.name;
	const runner = options.runner ?? ((command) => execFileSync(command.file, command.args, { encoding: 'utf8', windowsHide: true }));
	const query = buildTaskQueryCommand(name);

	let raw;
	try {
		raw = runner(query);
	} catch (error) {
		if (error && typeof error === 'object' && 'status' in error) {
			return {
				name,
				exists: false,
				readOnly: true,
				supersession: describeSupersession(contract, name, false),
				reason: 'task-not-found',
			};
		}
		throw fail('TASK_INVENTORY_FAILED', `Cannot inspect scheduled task "${name}": ${error instanceof Error ? error.message : String(error)}`);
	}

	const fields = sanitizeTaskFields(parseSchtasksList(raw));
	return {
		name,
		exists: true,
		readOnly: true,
		status: fields['Status'] ?? fields['Scheduled Task State'] ?? null,
		lastResult: fields['Last Result'] ?? fields['Last Run Result'] ?? null,
		lastRunTime: fields['Last Run Time'] ?? null,
		nextRunTime: fields['Next Run Time'] ?? null,
		taskToRun: fields['Task To Run'] ?? null,
		scheduleType: fields['Schedule Type'] ?? null,
		fields,
		supersession: describeSupersession(contract, name, true),
	};
}

export function describeSupersession(contract, name, exists) {
	return {
		taskName: name,
		supersededBy: contract.legacyScheduledTask.supersededBy,
		disposition: contract.legacyScheduledTask.disposition,
		observed: exists,
		sourceMayModify: false,
		note: contract.legacyScheduledTask.note,
	};
}
