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

	const simpleHeader = page.getByTestId('timetable-simple-header');
	const taskGuide = page.getByTestId('timetable-task-guide');
	const moreTrigger = page.getByTestId('timetable-simple-more-trigger');

	await expect(simpleHeader.or(taskGuide)).toBeVisible({ timeout: 45_000 });

	if (await moreTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
		return;
	}

	const isAdvancedNow = await taskGuide.isVisible({ timeout: 2_000 }).catch(() => false);
	if (isAdvancedNow) {
		const simpleViewButton = page.getByTestId('timetable-layout-toggle');
		await expect(simpleViewButton).toBeVisible({ timeout: 10_000 });
		await simpleViewButton.click();
		await expect(simpleHeader).toBeVisible({ timeout: 15_000 });
		await expect(moreTrigger).toBeVisible({ timeout: 15_000 });
		return;
	}

	await expect(moreTrigger).toBeVisible({ timeout: 15_000 });
}

export async function ensureSimpleMode(page: Page) {
	const moreTrigger = page.getByTestId('timetable-simple-more-trigger');
	if (await moreTrigger.isVisible({ timeout: 2_000 }).catch(() => false)) {
		return;
	}
	const taskGuide = page.getByTestId('timetable-task-guide');
	const isAdvanced = await taskGuide.isVisible({ timeout: 2_000 }).catch(() => false);
	if (isAdvanced) {
		const simpleViewButton = page.getByTestId('timetable-layout-toggle');
		await expect(simpleViewButton).toBeVisible({ timeout: 10_000 });
		await simpleViewButton.click();
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 15_000 });
		await expect(moreTrigger).toBeVisible({ timeout: 15_000 });
	}
}

export async function openTimetableAdvanced(page: Page) {
	await openTimetableSimple(page);
	await page.getByTestId('timetable-simple-more-trigger').click();
	await expect(page.getByTestId('timetable-simple-more-expert-tools')).toBeVisible({ timeout: 5_000 });
	await page.getByTestId('timetable-layout-toggle').click();
	await expect(page.getByTestId('timetable-task-guide')).toBeVisible({ timeout: 20_000 });
}

export async function openTaskDrawer(page: Page, taskName: RegExp | string) {
	await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 20_000 });
	await openSimpleMore(page);
	const menuItem = page.getByRole('menuitem', { name: taskName });
	const hasMenuItem = await menuItem.isVisible({ timeout: 5_000 }).catch(() => false);
	if (!hasMenuItem) {
		return null;
	}
	await menuItem.click();
	const drawer = page.getByTestId('timetable-task-drawer');
	await expect(drawer).toBeVisible({ timeout: 20_000 });
	return drawer;
}

export async function openSimpleMore(page: Page) {
	const moreTrigger = page.getByTestId('timetable-simple-more-trigger');
	const triggerCount = await moreTrigger.count();
	if (triggerCount === 0) {
		const taskGuideVisible = await page.getByTestId('timetable-task-guide').isVisible({ timeout: 2_000 }).catch(() => false);
		if (taskGuideVisible) {
			const simpleViewButton = page.getByTestId('timetable-layout-toggle');
			await expect(simpleViewButton).toBeVisible({ timeout: 10_000 });
			await simpleViewButton.click({ force: true });
			await page.waitForTimeout(500);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 15_000 });
			await expect(moreTrigger).toBeVisible({ timeout: 15_000 });
		} else {
			await page.waitForTimeout(1000);
			const retryCount = await moreTrigger.count();
			if (retryCount === 0) {
				throw new Error('timetable-simple-more-trigger not in DOM after retry. Cannot open More menu.');
			}
		}
	}
	const moreMenu = page.getByTestId('timetable-simple-more-daily-tasks');
	const isAlreadyOpen = await moreMenu.isVisible({ timeout: 1_000 }).catch(() => false);
	if (!isAlreadyOpen) {
		await moreTrigger.click();
	}
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
