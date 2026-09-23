import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

import { buildSectionLabel } from '@/lib/timetable-reference-labels';
import { resolveViolationFacultyTarget } from '@/lib/timetable-entry-pivot';
import { resolveTimetableFallbackTermIndex, resolveTimetableLoadGate } from '@/hooks/useTimetableData';
import { simpleTutorialSteps } from '../simple/SimpleHeaderHelpers';

const clientRoot = resolve(import.meta.dirname, '../../../..');
const source = (path: string) => readFileSync(resolve(clientRoot, path), 'utf8');

test('C04 ordinary schedule chrome omits routine source, school-year, and run provenance', () => {
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.doesNotMatch(header, /data-testid="timetable-source-truth"/, 'routine source provenance stays out of the ordinary header');
	assert.doesNotMatch(header, /School year #\$\{schoolYearId\}|schoolYearContext\?\.activeSchoolYearLabel/, 'ordinary status chrome does not repeat the year identity');
	assert.match(header, /termAuthorityNotice/, 'actionable unresolved-term guidance remains visible');
	assert.match(header, /newerFailedRunNotice/, 'a genuinely actionable run mismatch remains visible');
});

test('C04 selected section labels and chooser labels share the known canonical grade label', () => {
	const label = buildSectionLabel(new Map([[7, {
		id: 7,
		name: 'Luna',
		gradeLevelId: 17,
		displayOrder: 1,
		gradeLevelName: null,
		programType: 'REGULAR',
	} as any]]), (_type, code) => code ?? 'Special Program');
	assert.equal(label(7), 'GR7 - Luna');
	assert.equal(label(707), 'Section #707', 'an unknown section is not assigned an invented grade');
});

test('C04 user-facing schedule help says Expert and keeps stored layout identity unchanged', () => {
	const visibleCopy = simpleTutorialSteps('published').map((step) => `${step.title} ${step.body} ${step.target}`).join('\n');
	assert.doesNotMatch(visibleCopy, /\bAdvanced\b/i);
	assert.match(visibleCopy, /Expert view/);
	assert.match(source('src/components/timetable/simple/SimpleMoreMenuContent.tsx'), /Expert view/);
	assert.match(source('src/components/timetable/ScheduleReviewWorkspace.tsx'), /atlas_timetable_layout_mode.*advanced/s, 'the persisted route/layout key does not change');
});

test('C04 the Simple draft header exposes Return to published when a published context is saved', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /data-testid="timetable-return-to-published"/);
	assert.match(header, /Return to published/);
});

test('C04 term scope and control fail closed together and term navigation avoids a full bootstrap', () => {
	const data = source('src/hooks/useTimetableData.ts');
	const state = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(data, /fallbackTermIndex[\s\S]{0,300}termFilter/);
	assert.doesNotMatch(data, /const loadAll = useCallback[\s\S]*?\}, \[[^\]]*termFilter/, 'term selection does not recreate the full bootstrap callback');
	assert.doesNotMatch(state, /const handleTermFilterChange[\s\S]*?setTermFilter\(value\)/, 'unresolved authority cannot leave All terms selected over a concrete fallback grid');
	assert.match(data, /queryKey: timetableRunBundleQueryKey\(currentScope\)/, 'term data remains term-scoped');
	assert.equal(resolveTimetableFallbackTermIndex(null), null, 'unknown authority has no fabricated Term 1');
	assert.deepEqual(resolveTimetableLoadGate({ authorityReady: false, termFilter: 'all', userOverrodeTermFilter: false, fallbackTermIndex: null }), { kind: 'blocked-setup' });
});

test('C04 issue activation uses the violation canonical teacher, not an unrelated first entry', () => {
	const mutations = source('src/hooks/useTimetableMutations.ts');
	assert.match(mutations, /resolveViolationFacultyTarget/, 'the issue activation uses the shared canonical-target resolver');
	const violation = { entities: { facultyId: 12, entryIds: ['unrelated-first', 'affected-second'] } } as any;
	const entries = [
		{ entryId: 'unrelated-first', facultyId: 9 },
		{ entryId: 'affected-second', facultyId: 12 },
	] as any;
	assert.deepEqual(resolveViolationFacultyTarget({ violation, entries, facultyIds: new Set([9, 12]) }), {
		facultyId: 12,
		entry: entries[1],
	}, 'confirmation names the violation teacher and selects only that teacher’s affected entry');
});

test('C04 school branding has a local visual fallback after the configured logo fails', () => {
	const sidebar = source('src/components/app-shell/AppSidebar.tsx');
	assert.match(sidebar, /onError=/, 'the failed image switches to the existing local school icon');
	assert.match(sidebar, /<School/, 'fallback remains a local icon rather than a network retry');
});

test('C04 teacher issue confirmation blocks the grid, cancel is inert, and confirm pivots/highlights', { timeout: 45_000 }, async () => {
	const portProbe = createServer();
	await new Promise<void>((resolveListen, reject) => portProbe.once('error', reject).listen(0, '127.0.0.1', resolveListen));
	const port = (portProbe.address() as { port: number }).port;
	await new Promise<void>((resolveClose) => portProbe.close(() => resolveClose()));
	const vite = spawn(process.execPath, [resolve(clientRoot, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: clientRoot, stdio: 'ignore' });
	let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
	try {
		const origin = `http://127.0.0.1:${port}`;
		let ready = false;
		for (let attempt = 0; attempt < 100 && !ready; attempt++) {
			try { ready = (await fetch(`${origin}/src/components/timetable/__tests__/timetable-post-deploy-c04.harness.html`)).ok; } catch { /* isolated Vite startup */ }
			if (!ready) await new Promise((resolveWait) => setTimeout(resolveWait, 100));
		}
		assert.equal(ready, true, 'isolated C04 UI harness must start');
		browser = await chromium.launch({ headless: true });
		const page = await browser.newPage();
		await page.goto(`${origin}/src/components/timetable/__tests__/timetable-post-deploy-c04.harness.html`);
		await page.getByRole('heading', { name: "Open Fernandez, Luz's timetable?" }).waitFor();
		const underlying = await page.locator('main > button').first().boundingBox();
		assert.ok(underlying);
		await page.mouse.click(underlying.x + underlying.width / 2, underlying.y + underlying.height / 2);
		let state = await page.evaluate(() => window.__c04State);
		assert.equal(state?.confirmCount, 0, 'modal overlay prevents the click reaching the timetable cell');
		if (await page.getByRole('heading', { name: "Open Fernandez, Luz's timetable?" }).count() > 0) {
			await page.getByRole('button', { name: 'Cancel' }).click();
		}
		state = await page.evaluate(() => window.__c04State);
		assert.deepEqual(state, { viewMode: 'section', entityFilter: '7', selectedEntry: 'existing', selectedViolation: 'existing-issue', confirmCount: 0 }, 'cancel leaves current context and selection unchanged');
		await page.getByRole('button', { name: 'Select faculty issue' }).click();
		await page.getByRole('heading', { name: "Open Fernandez, Luz's timetable?" }).waitFor();
		await page.getByRole('button', { name: 'Open teacher timetable' }).click();
		state = await page.evaluate(() => window.__c04State);
		assert.deepEqual(state, { viewMode: 'faculty', entityFilter: '12', selectedEntry: 'affected-session', selectedViolation: 'consecutive-minutes', confirmCount: 1 }, 'confirm pivots only after consent and selects/highlights the affected session');
	} finally {
		await browser?.close();
		vite.kill();
	}
});
