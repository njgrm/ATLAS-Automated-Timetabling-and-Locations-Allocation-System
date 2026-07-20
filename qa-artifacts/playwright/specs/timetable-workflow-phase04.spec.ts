import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-workflow-phase04');
const schoolId = 1;
const schoolYearId = 55;

async function loginAdmin(page: Page): Promise<string> {
	const response = await page.request.post('/api/v1/auth/login', { data: credentials });
	expect(response.ok(), `Admin login failed with HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	const payload = await response.json() as { token?: string };
	expect(payload.token, 'Admin login API must return a bearer token.').toBeTruthy();
	await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${payload.token}` });
	await page.addInitScript((token) => {
		sessionStorage.setItem('atlas_local_token', token);
		localStorage.setItem('atlas_timetable_tour', 'true');
	}, payload.token!);
	return payload.token!;
}

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

test.describe.serial('Timetable Phase 4 first-load performance gates', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
	});

	test('run history is metadata-only and matches representative run details', async ({ page }, testInfo) => {
		test.setTimeout(60_000);
		const token = await loginAdmin(page);
		const headers = { Authorization: `Bearer ${token}` };

		const startedAt = performance.now();
		const response = await page.request.get(`/api/v1/generation/${schoolId}/${schoolYearId}/runs?limit=20`, { headers });
		const elapsedMs = performance.now() - startedAt;
		const text = await response.text();
		const bodyBytes = Buffer.byteLength(text, 'utf8');

		expect(response.ok(), `Run history failed with HTTP ${response.status()}: ${text.slice(0, 500)}`).toBeTruthy();
		expect(bodyBytes, 'Run history must stay metadata-sized for first timetable load.').toBeLessThan(50_000);
		expect(text).not.toContain('draftEntries');
		expect(text).not.toContain('violations');
		expect(text).not.toContain('unassignedItems');
		expect(text).not.toContain('"summary"');

		const payload = JSON.parse(text) as {
			runs: Array<{
				id: number;
				status: string;
				createdAt: string;
				durationMs: number | null;
				draftEntries?: unknown;
				violations?: unknown;
				unassignedItems?: unknown;
				summary?: unknown;
			}>;
			count: number;
		};
		expect(payload.count).toBe(payload.runs.length);
		expect(payload.runs.length).toBeGreaterThan(0);

		const firstRun = payload.runs[0];
		const detailResponse = await page.request.get(`/api/v1/generation/${schoolId}/${schoolYearId}/runs/${firstRun.id}`, { headers });
		const detailPayload = await detailResponse.json() as {
			run: {
				id: number;
				status: string;
				createdAt: string;
				durationMs: number | null;
			};
		};
		const detail = detailPayload.run;
		expect(detailResponse.ok()).toBeTruthy();
		expect(firstRun.id).toBe(detail.id);
		expect(firstRun.status).toBe(detail.status);
		expect(firstRun.createdAt).toBe(detail.createdAt);
		expect(firstRun.durationMs).toBe(detail.durationMs);

		const limitOneResponse = await page.request.get(`/api/v1/generation/${schoolId}/${schoolYearId}/runs?limit=1`, { headers });
		const limitOneText = await limitOneResponse.text();
		expect(limitOneResponse.ok()).toBeTruthy();
		const limitOne = JSON.parse(limitOneText) as { runs: Array<{ id: number }>; count: number };
		expect(limitOne.count).toBe(1);
		expect(limitOne.runs[0]?.id).toBe(firstRun.id);

		await attachReport(testInfo, 'run-history-contract', {
			elapsedMs,
			bodyBytes,
			firstRunId: firstRun.id,
			limitOneId: limitOne.runs[0]?.id ?? null,
			omittedFields: ['summary', 'draftEntries', 'violations', 'unassignedItems'],
		});
	});

	test('first table and first action are available within Phase 4 timing budgets', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await loginAdmin(page);

		const advancedRequests: string[] = [];
		page.on('request', (request) => {
			const url = request.url();
			if (
				url.includes('ManualEditPanel')
				|| url.includes('SchedulingPolicyPane')
				|| url.includes('BuildingView')
				|| url.includes('CampusMap')
				|| url.includes('react-konva')
			) {
				advancedRequests.push(url);
			}
		});

		const startedAt = performance.now();
		await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });

		await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 15_000 });
		const tableVisibleMs = performance.now() - startedAt;

		await expect(page.getByTestId('timetable-task-place')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('timetable-filters-trigger')).toBeVisible({ timeout: 15_000 });
		const firstActionVisibleMs = performance.now() - startedAt;

		const layoutMetrics = await page.evaluate(() => {
			const root = document.scrollingElement ?? document.documentElement;
			const center = document.querySelector('#center-panel')?.getBoundingClientRect();
			const left = document.querySelector('#left-panel')?.getBoundingClientRect();
			const right = document.querySelector('#right-panel')?.getBoundingClientRect();
			const taskGuide = document.querySelector('[data-testid="timetable-task-guide"]')?.getBoundingClientRect();
			const filtersTrigger = document.querySelector('[data-testid="timetable-filters-trigger"]')?.getBoundingClientRect();
			return {
				scrollHeight: root.scrollHeight,
				clientHeight: root.clientHeight,
				overflow: getComputedStyle(document.body).overflow,
				viewportWidth: window.innerWidth,
				centerWidth: center?.width ?? 0,
				leftWidth: left?.width ?? 0,
				rightWidth: right?.width ?? 0,
				taskGuideHeight: taskGuide?.height ?? 0,
				filtersVisible: Boolean(filtersTrigger && filtersTrigger.width > 0 && filtersTrigger.height > 0),
			};
		});

		expect(
			tableVisibleMs,
			`Table must become visible under 5s on Tailnet. Actual: ${Math.round(tableVisibleMs)}ms`,
		).toBeLessThan(5_000);
		expect(
			firstActionVisibleMs,
			`Primary timetable action must become visible under 6s on Tailnet. Actual: ${Math.round(firstActionVisibleMs)}ms`,
		).toBeLessThan(6_000);
		expect(
			layoutMetrics.scrollHeight,
			`Timetable should not create a global page scrollbar. Metrics: ${JSON.stringify(layoutMetrics)}`,
		).toBeLessThanOrEqual(layoutMetrics.clientHeight + 8);
		expect(layoutMetrics.filtersVisible, 'Advanced filters must be disclosed behind a visible Filters trigger.').toBeTruthy();
		expect(
			layoutMetrics.taskGuideHeight,
			`Task guide must stay compact so the grid remains primary. Metrics: ${JSON.stringify(layoutMetrics)}`,
		).toBeLessThanOrEqual(120);
		if (layoutMetrics.viewportWidth < 1024) {
			expect(
				layoutMetrics.leftWidth,
				`Compact viewport should not show the Needs attention rail by default. Metrics: ${JSON.stringify(layoutMetrics)}`,
			).toBeLessThanOrEqual(8);
			expect(
				layoutMetrics.rightWidth,
				`Compact viewport should not show an empty detail rail by default. Metrics: ${JSON.stringify(layoutMetrics)}`,
			).toBeLessThanOrEqual(8);
			expect(
				layoutMetrics.centerWidth,
				`Compact viewport should give the timetable grid nearly the full width. Metrics: ${JSON.stringify(layoutMetrics)}`,
			).toBeGreaterThan(layoutMetrics.viewportWidth * 0.9);
		}
		expect(advancedRequests, 'Advanced diagnostics must not be requested before the initial grid/list is actionable.').toEqual([]);

		await attachReport(testInfo, 'first-load-timings', {
			tableVisibleMs,
			firstActionVisibleMs,
			layoutMetrics,
			advancedRequests,
		});
	});
});
