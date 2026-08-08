import { expect, type Page } from '@playwright/test';

export const adminCredentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

export async function loginAdmin(page: Page): Promise<string> {
	const health = await page.request.get('/api/v1/health').catch((error) => error as Error);
	if (health instanceof Error) {
		throw new Error(`Dev stack unavailable: health check could not reach Tailnet target. ${health.message}`);
	}
	expect(health.ok(), `Dev stack unavailable: /api/v1/health returned HTTP ${health.status()}. Start ATLAS with npm run dev before running live timetable specs.`).toBeTruthy();
	const response = await page.request.post('/api/v1/auth/login', { data: adminCredentials });
	expect(response.ok(), `Admin login failed with HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	const payload = await response.json() as { token?: string };
	expect(payload.token, 'Admin login API must return a bearer token.').toBeTruthy();
	await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${payload.token}` });
	await page.addInitScript((token) => {
		window.sessionStorage.setItem('atlas_local_token', token);
		window.localStorage.setItem('atlas_timetable_tour', 'true');
	}, payload.token!);
	return payload.token!;
}

export async function openTimetableSimple(page: Page) {
	await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.locator('table[aria-label="Timetable"], [data-testid="timetable-simple-header"], [data-testid="timetable-simple-task-prompt"]').first()).toBeVisible({ timeout: 45_000 });
	if (await page.getByTestId('timetable-simple-header').isVisible({ timeout: 2_000 }).catch(() => false)) {
		await expect(page.getByTestId('timetable-task-guide')).toHaveCount(0);
		return;
	}
	const layoutToggle = page.getByTestId('timetable-layout-toggle');
	await expect(layoutToggle).toBeVisible({ timeout: 20_000 });
	if (/Simple/i.test(await layoutToggle.innerText())) {
		await layoutToggle.click();
	}
	await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 20_000 });
	await expect(page.getByTestId('timetable-task-guide')).toHaveCount(0);
}

export async function openTimetableAdvanced(page: Page) {
	await openTimetableSimple(page);
	await page.getByTestId('timetable-simple-more-trigger').click();
	await page.getByTestId('timetable-layout-toggle').click();
	await expect(page.getByTestId('timetable-task-guide')).toBeVisible({ timeout: 20_000 });
	await expect(page.getByTestId('timetable-layout-toggle')).toContainText(/Simple/i);
}

export async function openTaskDrawer(page: Page, taskName: RegExp | string) {
	await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 20_000 });
	await openSimpleMore(page);
	await page.getByRole('menuitem', { name: taskName }).click();
	const drawer = page.getByTestId('timetable-task-drawer');
	await expect(drawer).toBeVisible({ timeout: 20_000 });
	return drawer;
}

export async function openSimpleMore(page: Page) {
	await page.getByTestId('timetable-simple-more-trigger').click();
	await expect(page.getByTestId('timetable-simple-more-daily-tasks')).toBeVisible({ timeout: 10_000 });
	await expect(page.getByTestId('timetable-simple-more-schedule-data')).toBeVisible({ timeout: 10_000 });
	await expect(page.getByTestId('timetable-simple-more-expert-tools')).toBeVisible({ timeout: 10_000 });
}

export async function openDraftPlanningFromSimpleMore(page: Page) {
	await openTimetableSimple(page);
	await openSimpleMore(page);
	await page.getByRole('menuitem', { name: /^Plan draft$/i }).click();
	await expect(page.getByTestId('pregen-plotting-tray')).toBeVisible({ timeout: 30_000 });
}

export async function openSelectedClassMoreActions(page: Page) {
	await expect(page.getByTestId('timetable-selection-strip')).toBeVisible({ timeout: 10_000 });
	await page.getByTestId('simple-selected-more-actions').click();
	await expect(page.getByTestId('teacher-departure-selected-action')).toBeVisible({ timeout: 10_000 });
}

export async function openSelectedClassTeacherDeparture(page: Page) {
	await openSelectedClassMoreActions(page);
	await page.getByTestId('teacher-departure-selected-action').click();
	const sheet = page.getByTestId('teacher-departure-recovery-sheet');
	await expect(sheet).toBeVisible({ timeout: 20_000 });
	return sheet;
}

export async function openPrimaryTaskDrawer(page: Page) {
	await expect(page.getByTestId('timetable-simple-primary-action')).toBeVisible({ timeout: 20_000 });
	await page.getByTestId('timetable-simple-primary-action').click();
	const drawer = page.getByTestId('timetable-task-drawer');
	await expect(drawer).toBeVisible({ timeout: 20_000 });
	return drawer;
}

export async function assertNoGlobalOverflow(page: Page) {
	const metrics = await page.evaluate(() => {
		const root = document.scrollingElement ?? document.documentElement;
		return {
			scrollHeight: root.scrollHeight,
			clientHeight: root.clientHeight,
			scrollWidth: root.scrollWidth,
			clientWidth: root.clientWidth,
		};
	});
	expect(metrics.scrollHeight, `No global vertical scrollbar expected. ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientHeight + 8);
	expect(metrics.scrollWidth, `No horizontal page overflow expected. ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientWidth + 8);
	return metrics;
}
