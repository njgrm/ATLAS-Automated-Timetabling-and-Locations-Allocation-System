import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-simplification-recovery');

async function loginAdmin(page: Page) {
	const response = await page.request.post('/api/v1/auth/login', { data: credentials });
	expect(response.ok(), `Admin login failed with HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	const payload = await response.json() as { token?: string };
	expect(payload.token, 'Admin login API must return a bearer token.').toBeTruthy();
	await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${payload.token}` });
	await page.addInitScript((token) => {
		sessionStorage.setItem('atlas_local_token', token);
		localStorage.setItem('atlas_timetable_tour', 'true');
	}, payload.token!);
}

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

async function openTimetable(page: Page) {
	await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45_000 });
	await expect(page.getByTestId('timetable-task-guide')).toBeVisible({ timeout: 10_000 });
}

async function blockDestructiveTimetableWrites(page: Page) {
	const blocked: string[] = [];
	await page.route('**/api/v1/generation/**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const pathname = url.pathname;
		const method = request.method();
		const isPreview = pathname.endsWith('/preview') || pathname.endsWith('/swap/preview') || pathname.endsWith('/fix-suggestions');
		const isReadOnly = method === 'GET' || method === 'HEAD';

		if (!isReadOnly && !isPreview) {
			blocked.push(`${method} ${pathname}`);
			await route.fulfill({
				status: 409,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'TIMETABLE_SIMPLIFICATION_WRITE_BLOCKED' }),
			});
			return;
		}
		await route.continue();
	});
	return blocked;
}

async function getPreviewLabelSummary(page: Page) {
	const decorated = page.locator('td[data-pointer-preview-status]');
	await expect.poll(async () => decorated.count(), {
		message: 'A selected or dragged source should show grid-wide cell guidance.',
		timeout: 10_000,
	}).toBeGreaterThan(5);
	return decorated.evaluateAll((nodes) => {
		const values = nodes
			.map((node) => node.getAttribute('data-pointer-preview-status'))
			.filter((value): value is string => Boolean(value));
		return {
			count: values.length,
			unique: Array.from(new Set(values)).sort(),
			visibleText: nodes.slice(0, 8).map((node) => (node.textContent ?? '').trim()),
		};
	});
}

test.describe.serial('Timetable simplification recovery gates', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('generated unassigned select and drag show grid-wide guidance without deprecated assignment dialog', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetable(page);

		await page.getByRole('tab', { name: /Unassigned/i }).click();
		const list = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
		await expect(list).toBeVisible({ timeout: 15_000 });
		const sourceRow = list.locator('[aria-label^="Unassigned session"]').first();
		await expect(sourceRow).toBeVisible({ timeout: 15_000 });

		await sourceRow.click();
		const selectedSummary = await getPreviewLabelSummary(page);
		await expect(page.getByRole('dialog').filter({ hasText: /Assign teacher and room|Choose teacher|Choose room/i })).toHaveCount(0);
		await expect(page.getByText(/Assign teacher and room/i)).toHaveCount(0);

		await page.keyboard.press('Escape');
		await page.reload({ waitUntil: 'domcontentloaded' });
		await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45_000 });
		await page.getByRole('tab', { name: /Unassigned/i }).click();
		await expect(list).toBeVisible({ timeout: 15_000 });
		await expect(sourceRow).toBeVisible({ timeout: 15_000 });

		const targetCell = page.locator('td[data-day][data-start-time][data-end-time]').first();
		await expect(targetCell).toBeVisible({ timeout: 10_000 });
		const sourceBox = await sourceRow.boundingBox();
		const targetBox = await targetCell.boundingBox();
		expect(sourceBox, 'Generated unassigned drag source must have a measurable box.').toBeTruthy();
		expect(targetBox, 'Timetable drop target must have a measurable box.').toBeTruthy();

		await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
		await page.mouse.down();
		await page.mouse.move(sourceBox!.x + sourceBox!.width / 2 + 16, sourceBox!.y + sourceBox!.height / 2, { steps: 4 });
		await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 8 });
		const dragSummary = await getPreviewLabelSummary(page);
		await expect(page.getByRole('dialog').filter({ hasText: /Assign teacher and room|Choose teacher|Choose room/i })).toHaveCount(0);
		await page.keyboard.press('Escape');
		await page.mouse.up();

		expect(blockedWrites, 'Recovery gate must not commit live timetable writes.').toEqual([]);
		await attachReport(testInfo, 'generated-unassigned-guidance', {
			selectedSummary,
			dragSummary,
			blockedWrites,
		});
	});
});
