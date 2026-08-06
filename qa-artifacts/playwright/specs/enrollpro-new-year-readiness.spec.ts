import { expect, test, type APIResponse, type Page } from '@playwright/test';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1234501',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'DepEdSY2026!',
};

async function login(page: Page): Promise<string> {
	const health = await page.request.get('/api/v1/health').catch((error) => error as Error);
	if (health instanceof Error) {
		throw new Error(`Dev stack unavailable: ${health.message}`);
	}
	expect(health.ok(), `Dev stack unavailable: /api/v1/health returned HTTP ${health.status()}.`).toBeTruthy();

	const response = await page.request.post('/api/v1/auth/login', { data: credentials });
	expect(response.ok(), `Login failed with HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	const payload = await response.json() as { token?: string };
	expect(payload.token, 'Login API must return a bearer token.').toBeTruthy();
	await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${payload.token}` });
	await page.addInitScript((token) => {
		window.sessionStorage.setItem('atlas_local_token', token);
		window.localStorage.setItem('atlas_timetable_tour', 'true');
		window.localStorage.setItem('atlas_timetable_layout_mode', 'simple');
	}, payload.token!);
	return payload.token!;
}

async function readJson<T>(response: APIResponse): Promise<T> {
	const text = await response.text();
	expect(response.ok(), `Expected ${response.url()} to succeed, got HTTP ${response.status()}: ${text.slice(0, 500)}`).toBeTruthy();
	return JSON.parse(text) as T;
}

test.describe.serial('EnrollPro 2026-2027 new-year readiness', () => {
	test('officer workflow shows aligned setup and blocks generation until Teaching Load is ready', async ({ page }) => {
		test.setTimeout(180_000);
		await login(page);

		const latestTimetable404s: string[] = [];
		let guardLatestTimetable404 = true;
		page.on('response', (response) => {
			if (
				guardLatestTimetable404
				&& response.status() === 404
				&& response.url().includes('/api/v1/generation/1/1/runs/latest/timetable')
			) {
				latestTimetable404s.push(response.url());
			}
		});

		const status = await readJson<{
			drift: { status: string; enrollProSchoolYearLabel: string | null };
			counts?: { sectionCount: number; facultyCount: number };
			mirror: { yearLabel: string; sectionCount: number; facultyCount: number; syncStatus: string } | null;
		}>(await page.request.get('/api/v1/runtime/rollover-status?schoolId=1&includeCounts=true'));
		expect(status.drift.status).toBe('aligned');
		expect(status.drift.enrollProSchoolYearLabel).toBe('2026-2027');
		expect(status.counts?.sectionCount).toBe(20);
		expect(status.counts?.facultyCount).toBe(24);
		expect(status.mirror?.yearLabel).toBe('2026-2027');
		expect(status.mirror?.syncStatus).toBe('setup-review-required');

		const sections = await readJson<{ sections: unknown[] }>(
			await page.request.get('/api/v1/sections/summary/1?schoolId=1'),
		);
		expect(sections.sections).toHaveLength(20);

		const faculty = await readJson<{ faculty: Array<{ isActiveForScheduling?: boolean; isStale?: boolean }> }>(
			await page.request.get('/api/v1/faculty?schoolId=1'),
		);
		const activeFacultyCount = faculty.faculty.filter((record) => record.isActiveForScheduling !== false && record.isStale !== true).length;
		expect(activeFacultyCount).toBe(24);

		await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('body')).toContainText(/2026-2027|Teaching Load|Build Teaching Load/i, { timeout: 30_000 });
		await page.waitForTimeout(2_000);

		await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.getByRole('heading', { name: /Campus and rooms/i })).toBeVisible({ timeout: 30_000 });
		await page.waitForTimeout(2_000);
		expect(latestTimetable404s, 'Dashboard and Campus widgets must not request latest/timetable before a current-year run exists.').toEqual([]);

		await page.goto('/sections', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('body')).toContainText(/2026-2027|20|section/i, { timeout: 30_000 });

		await page.goto('/teachers', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('body')).toContainText(/24|teacher|faculty/i, { timeout: 30_000 });

		await page.goto('/teaching-load', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('body')).toContainText(/Build Teaching Load|review|required|Generation is blocked/i, { timeout: 30_000 });

		guardLatestTimetable404 = false;
		await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('body')).toContainText(/2026-2027|Teaching Load|No current-year timetable|No 2026-2027 timetable/i, { timeout: 30_000 });

		const currentGeneration = await page.request.post('/api/v1/generation/1/1/runs');
		expect(currentGeneration.status()).toBe(409);
		const currentBlock = await currentGeneration.json() as { code?: string; message?: string; actionHint?: string };
		expect(currentBlock.code).toBe('TEACHING_LOAD_REVIEW_REQUIRED');
		expect(`${currentBlock.message ?? ''} ${currentBlock.actionHint ?? ''}`).toMatch(/Teaching Load|assign section owners|save the load/i);

		const staleGeneration = await page.request.post('/api/v1/generation/1/39/runs');
		expect(staleGeneration.status()).toBe(409);
		const staleBlock = await staleGeneration.json() as { code?: string; message?: string; actionHint?: string };
		expect(staleBlock.code).toBe('ACTIVE_YEAR_DRIFT');
		expect(`${staleBlock.message ?? ''} ${staleBlock.actionHint ?? ''}`).toMatch(/2026-2027|Sync|new school year/i);

		const currentRuns = await readJson<{ runs?: unknown[] }>(
			await page.request.get('/api/v1/generation/1/1/runs'),
		);
		expect(currentRuns.runs ?? []).toHaveLength(0);
	});
});
