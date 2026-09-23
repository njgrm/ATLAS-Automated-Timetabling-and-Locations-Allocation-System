import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

import { capturePublishedReturnState } from '../../../lib/timetable-published-return';

const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../../../', path), 'utf8');

test('C05 direct Draft route preserves the prior published run, term, view, and entity for return', () => {
	const published = { runId: '317', termFilter: 2 as const, viewMode: 'faculty' as const, entityFilter: '12' };
	const captured = capturePublishedReturnState(null, { centerView: 'schedule', isPublished: true, ...published });
	assert.deepEqual(captured, published);
	assert.deepEqual(capturePublishedReturnState(captured, { centerView: 'pre-generation', isPublished: true, ...published }), published,
		'direct route entry retains the state-only snapshot while the published schedule is hidden');
	assert.match(source('hooks/useScheduleReviewWorkspaceState.ts'), /usePublishedTimetableReturnState\(/,
		'the workspace captures published context independently of the Draft button callback');
});

test('C05 production navigation returns from Draft to the exact published context without writes', { timeout: 45_000 }, async () => {
	const portProbe = createServer();
	await new Promise<void>((resolveListen, reject) => portProbe.once('error', reject).listen(0, '127.0.0.1', resolveListen));
	const port = (portProbe.address() as { port: number }).port;
	await new Promise<void>((resolveClose) => portProbe.close(() => resolveClose()));
	const vite = spawn(process.execPath, [resolve(import.meta.dirname, '../../../../node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: resolve(import.meta.dirname, '../../../../'), stdio: 'ignore' });
	let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
	try {
		const origin = `http://127.0.0.1:${port}`;
		let ready = false;
		for (let attempt = 0; attempt < 100 && !ready; attempt++) {
			try { ready = (await fetch(`${origin}/src/components/timetable/__tests__/timetable-post-deploy-c05.harness.html`)).ok; } catch { /* isolated Vite startup */ }
			if (!ready) await new Promise((resolveWait) => setTimeout(resolveWait, 100));
		}
		assert.equal(ready, true, 'isolated production-component harness must start');
		browser = await chromium.launch({ headless: true });
		const page = await browser.newPage();
		await page.addInitScript(() => {
			(window as any).__c05Writes = 0;
			const originalFetch = window.fetch.bind(window);
			window.fetch = (input, init = {}) => {
				if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(init.method ?? 'GET').toUpperCase())) (window as any).__c05Writes += 1;
				return originalFetch(input, init);
			};
		});
		await page.goto(`${origin}/src/components/timetable/__tests__/timetable-post-deploy-c05.harness.html`);
		await page.getByTestId('timetable-sub-nav-draft').click();
		await page.waitForFunction(() => document.querySelector('[data-testid="c05-route"]')?.textContent === '/timetable/pre-generation');
		await page.getByTestId('timetable-return-to-published').waitFor({ state: 'visible' });
		assert.equal((await page.getByTestId('c05-center-view').textContent())?.trim(), 'pre-generation');
		await page.getByTestId('timetable-return-to-published').click();
		await page.waitForFunction(() => document.querySelector('[data-testid="c05-route"]')?.textContent === '/timetable');
		await page.waitForFunction(() => {
			const state = (window as any).__c05State;
			return state?.centerView === 'schedule' && state?.runId === '317' && state?.termFilter === 2 && state?.viewMode === 'faculty' && state?.entityFilter === '12';
		});
		assert.deepEqual(await page.evaluate(() => (window as any).__c05State), {
			centerView: 'schedule', runId: '317', termFilter: 2, viewMode: 'faculty', entityFilter: '12',
		});
		assert.equal(await page.evaluate(() => (window as any).__c05Writes), 0, 'route navigation and published return stay transport-write-free');
	} finally {
		await browser?.close();
		vite.kill();
	}
});
