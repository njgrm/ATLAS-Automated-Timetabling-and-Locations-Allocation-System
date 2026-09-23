import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';

import { TimetableIssueRepairGuide } from '../TimetableIssueRepairGuide';

const clientRoot = resolve(import.meta.dirname, '../../../..');

test('C03 selected issue guide stays human-readable and exposes preview, not direct apply', () => {
	const context = {
		selectedRunId: '316', runs: [{ id: 316 }], schoolYearId: 10, defaultSchoolId: 1,
		VIOLATION_LABELS: { FACULTY_TIME_CONFLICT: 'Teacher double-booked' },
		sectionLabel: () => 'GR7 - Cedar', subjectLabel: () => 'Mathematics',
		formatConstraintMessage: () => 'A teacher has overlapping classes.',
		previewEdit: () => Promise.resolve(null),
	} as never;
	const markup = renderToStaticMarkup(createElement(TimetableIssueRepairGuide, {
		context,
		violation: {
			code: 'FACULTY_TIME_CONFLICT', severity: 'HARD', message: 'raw saved message',
			schoolId: 1, schoolYearId: 10, runId: 316,
			entities: { sectionId: 7, subjectId: 4, entryIds: ['entry-1'] }, meta: { termIndex: 1 },
		},
	}));
	assert.match(markup, /Selected issue repair guide/);
	assert.match(markup, /Teacher double-booked/);
	assert.match(markup, /A teacher has overlapping classes\./);
	assert.doesNotMatch(markup, /FACULTY_TIME_CONFLICT|fingerprint|source revision/i);
	assert.doesNotMatch(markup, /Preview & Apply|Apply now/i);
	const componentSource = readFileSync(resolve(clientRoot, 'src/components/timetable/TimetableIssueRepairGuide.tsx'), 'utf8');
	assert.match(componentSource, /context\.previewEdit\(option\.proposal\)/, 'each option must enter the existing canonical preview flow');
	assert.match(componentSource, /violation-repair-options/);
	assert.match(componentSource, /setLoading\(true\)/, 'the guide exposes a pending verification state');
	assert.match(componentSource, /setResult\(data\)/, 'only the server response supplies verified options');
	assert.match(componentSource, /setError\('Verified repair guidance could not be loaded/);
	assert.match(componentSource, /result\?\.status !== 'REPAIRABLE'/, 'policy and no-safe results render guidance, not an option');
	assert.match(componentSource, /Projected:.*hard change/);
	assert.doesNotMatch(componentSource, /manual-edits\/commit|\/apply/);
	assert.doesNotMatch(componentSource, /commitManualEdit|applyProposal|setSelectedViolation/, 'opening or previewing the guide cannot apply or advance an issue');
	const railSource = readFileSync(resolve(clientRoot, 'src/components/timetable/GeneratedRunRailPanels.tsx'), 'utf8');
	assert.match(railSource, /<TimetableIssueRepairGuide context=\{context\} violation=\{selectedViolation\} \/>/, 'the rendered issue panel owns the selected issue guide');
});

test('C03 browser interaction verifies loading, server options, preview delegation, error and policy-only states', { timeout: 45_000 }, async () => {
	const portProbe = createServer();
	await new Promise<void>((resolveListen, reject) => portProbe.once('error', reject).listen(0, '127.0.0.1', resolveListen));
	const port = (portProbe.address() as { port: number }).port;
	await new Promise<void>((resolveClose) => portProbe.close(() => resolveClose()));
	const vite = spawn(process.execPath, [resolve(clientRoot, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: clientRoot, stdio: 'ignore' });
	let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
	let releaseFirstResponse: () => void = () => {};
	try {
		const origin = `http://127.0.0.1:${port}`;
		let ready = false;
		for (let attempt = 0; attempt < 100 && !ready; attempt++) {
			try { ready = (await fetch(`${origin}/src/components/timetable/__tests__/timetable-scheduling-quality-c03.harness.html`)).ok; } catch { /* wait for isolated Vite startup */ }
			if (!ready) await new Promise((resolveWait) => setTimeout(resolveWait, 100));
		}
		assert.equal(ready, true, 'isolated Vite harness must start');
		browser = await chromium.launch({ headless: true });
		const page = await browser.newPage();
		let requestCount = 0;
		let requestBody: Record<string, unknown> | undefined;
		const firstResponse = new Promise<void>((resolveResponse) => { releaseFirstResponse = resolveResponse; });
		await page.route('**/api/v1/generation/1/10/runs/316/violation-repair-options', async (route) => {
			requestCount++;
			if (requestCount === 1) {
				requestBody = route.request().postDataJSON() as Record<string, unknown>;
				await firstResponse;
				await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
					violation: { code: 'FACULTY_TIME_CONFLICT', severity: 'HARD', message: 'Conflict' }, evidence: [], status: 'REPAIRABLE', verifiedAt: '2030-01-02T03:04:05.000Z',
					options: [{ id: 'move-a', label: 'Move this session to tuesday 08:00–08:45', explanation: 'This preview removes the selected issue without adding a hard conflict.', affectedEntryIds: ['entry-a'], proposal: { editType: 'CHANGE_TIMESLOT', entryId: 'entry-a', targetDay: 'TUESDAY', targetStartTime: '08:00', targetEndTime: '08:45' }, projectedDelta: { targetIssuesBefore: 1, targetIssuesAfter: 0, hardBefore: 1, hardAfter: 0, softBefore: 0, softAfter: 0 } }], blockers: [],
				}) });
			} else if (requestCount === 2) {
				await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"offline"}' });
			} else {
				await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
					violation: { code: 'ROOM_TIME_CONFLICT', severity: 'HARD', message: 'Conflict' }, evidence: [], status: 'POLICY_CHANGE_REQUIRED', verifiedAt: '2030-01-02T03:04:05.000Z', options: [], blockers: ['Free a suitable room or review its assignment.'],
				}) });
			}
		});
		const harnessUrl = `${origin}/src/components/timetable/__tests__/timetable-scheduling-quality-c03.harness.html`;
		await page.goto(harnessUrl);
		await page.getByText('Checking safe repair options…').waitFor();
		assert.equal(requestCount, 1);
		assert.equal(requestBody?.termIndex, 1);
		const initialState = await page.evaluate(() => (window as Window & { __c03State?: { previewCalls: unknown[]; applyCalls: number } }).__c03State);
		assert.deepEqual(initialState, { previewCalls: [], applyCalls: 0 }, 'opening a selected issue only requests guidance');
		releaseFirstResponse();
		await page.getByRole('button', { name: 'Preview' }).waitFor();
		assert.match(await page.locator('[data-testid="timetable-issue-repair-guide"]').innerText(), /Verified option|Move this session|Projected/);
		await page.getByRole('button', { name: 'Preview' }).click();
		const previewState = await page.evaluate(() => (window as Window & { __c03State?: { previewCalls: Array<Record<string, unknown>>; applyCalls: number } }).__c03State);
		assert.deepEqual(previewState, { previewCalls: [{ editType: 'CHANGE_TIMESLOT', entryId: 'entry-a', targetDay: 'TUESDAY', targetStartTime: '08:00', targetEndTime: '08:45' }], applyCalls: 0 });

		await page.goto(`${harnessUrl}?next=1`);
		await page.getByRole('status').waitFor();
		const navigatedState = await page.evaluate(() => (window as Window & { __c03State?: { previewCalls: unknown[]; applyCalls: number } }).__c03State);
		assert.equal((navigatedState?.previewCalls ?? []).length, 1, 'issue navigation does not preview or apply another option');
		assert.equal(navigatedState?.applyCalls, 0, 'the guide never applies directly');

		await page.goto(`${harnessUrl}?next=1&policy=1`);
		await page.getByText(/Free a suitable room or review its assignment/).waitFor();
		assert.equal(await page.getByRole('button', { name: 'Preview' }).count(), 0, 'policy-only results expose no preview proposal');
		assert.equal(requestCount, 3);
	} finally {
		releaseFirstResponse?.();
		await browser?.close();
		vite.kill();
	}
});
