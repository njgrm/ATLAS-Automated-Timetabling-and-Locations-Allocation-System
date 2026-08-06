import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'teachers-teaching-load-guided-workflow');

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

async function assertNoVisibleOverlap(page: Page) {
	const overlap = await page.evaluate(() => {
		const visible = Array.from(document.querySelectorAll<HTMLElement>('button, a, input, [role="button"]'))
			.map((element) => {
				const rect = element.getBoundingClientRect();
				return {
					text: (element.innerText || element.getAttribute('aria-label') || element.getAttribute('data-testid') || '').replace(/\s+/g, ' ').trim(),
					testId: element.getAttribute('data-testid') ?? '',
					top: rect.top,
					left: rect.left,
					right: rect.right,
					bottom: rect.bottom,
					width: rect.width,
					height: rect.height,
				};
			})
			.filter((item) => item.width > 8 && item.height > 8 && item.top >= 0 && item.bottom <= window.innerHeight && item.left >= 0 && item.right <= window.innerWidth);

		for (let i = 0; i < visible.length; i += 1) {
			for (let j = i + 1; j < visible.length; j += 1) {
				const a = visible[i];
				const b = visible[j];
				const areaX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
				const areaY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
				const area = areaX * areaY;
				const minArea = Math.min(a.width * a.height, b.width * b.height);
				if (area > 0 && area / Math.max(1, minArea) > 0.65 && a.text && b.text && a.text !== b.text) {
					return { a, b, area };
				}
			}
		}
		return null;
	});
	expect(overlap, `Visible controls must not overlap: ${JSON.stringify(overlap)}`).toBeNull();
}

async function gotoTeachers(page: Page) {
	await page.goto('/faculty', { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.getByTestId('admin-content-shell')).toBeVisible({ timeout: 45_000 });
	await expect(page.getByTestId('teachers-next-action-strip')).toBeVisible({ timeout: 45_000 });
}

async function gotoTeachingLoad(page: Page, query = '') {
	await page.goto(`/teaching-load${query}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.getByTestId('teaching-load-content-shell')).toBeVisible({ timeout: 45_000 });
	await expect(page.getByTestId('teaching-load-repair-queue')).toBeVisible({ timeout: 45_000 });
}

test.describe.serial('Teachers + Teaching Load guided workflow simplification', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('Teachers page exposes one clear repair action and attention chips', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await gotoTeachers(page);

		await expect(page.getByTestId('teacher-repair-card')).toBeVisible({ timeout: 20_000 });
		await expect(page.locator('[data-testid="teacher-row-primary-action"]:visible').first()).toBeVisible({ timeout: 20_000 });
		await expect(page.locator('[data-testid="teacher-row-more-actions"]:visible').first()).toBeVisible({ timeout: 20_000 });
		const strip = page.getByTestId('teachers-next-action-strip');
		await expect(strip.getByRole('button', { name: /Needs load/i })).toBeVisible();
		await expect(strip.getByRole('button', { name: /^Over cap/i })).toBeVisible();
		await expect(strip.getByRole('button', { name: /Review placeholders/i })).toBeVisible();

		const href = await page.locator('[data-testid="teacher-row-primary-action"]:visible').first().getAttribute('href');
		expect(href, 'Teacher row primary action must deep-link to Teaching Load with a task intent.').toMatch(/\/teaching-load\?facultyId=\d+&task=(missing-load|over-cap|review-placeholders|review)/);

		const metrics = await page.evaluate(() => {
			const strip = document.querySelector('[data-testid="teachers-next-action-strip"]')?.getBoundingClientRect();
			const content = document.querySelector('[data-testid="admin-content-shell"]')?.getBoundingClientRect();
			return {
				stripHeight: Math.round(strip?.height ?? 0),
				contentTop: Math.round(content?.top ?? 0),
				nextCopy: document.querySelector('[data-testid="teachers-next-action-strip"]')?.textContent?.replace(/\s+/g, ' ').trim(),
			};
		});
		expect(metrics.stripHeight).toBeLessThanOrEqual(page.viewportSize()!.width < 768 ? 128 : 96);
		await assertNoGlobalOverflow(page);
		await assertNoVisibleOverlap(page);
		await attachReport(testInfo, 'teachers-guided-strip', metrics);
	});

	test('Teachers repair action opens the Teaching Load repair queue with context preserved', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await gotoTeachers(page);

		await page.getByTestId('teacher-repair-card').click();
		await expect(page).toHaveURL(/\/teaching-load\?facultyId=\d+&task=(missing-load|over-cap|review-placeholders|review)/, { timeout: 20_000 });
		await expect(page.getByTestId('teaching-load-repair-queue')).toBeVisible({ timeout: 45_000 });
		await expect(page.getByTestId('teaching-load-current-repair')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByTestId('teaching-load-repair-review')).toBeVisible({ timeout: 20_000 });

		const summary = await page.evaluate(() => ({
			url: location.pathname + location.search,
			currentRepair: document.querySelector('[data-testid="teaching-load-current-repair"]')?.textContent?.replace(/\s+/g, ' ').trim(),
			nextItems: Array.from(document.querySelectorAll('[data-testid="teaching-load-next-repair"]')).map((node) => node.textContent?.replace(/\s+/g, ' ').trim()),
		}));
		await assertNoGlobalOverflow(page);
		await assertNoVisibleOverlap(page);
		await attachReport(testInfo, 'teachers-to-teaching-load-route', summary);
	});

	test('Teaching Load keeps guided queue, advanced grid, and save reasons visible', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await gotoTeachingLoad(page);

		await expect(page.getByTestId('teaching-load-current-repair')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByTestId('teaching-load-advanced-grid-toggle').first()).toBeVisible({ timeout: 20_000 });
		await expect(page.getByTestId('teaching-load-draft-action-bar')).toBeVisible({ timeout: 20_000 });
		const suggestDraftAction = page.getByRole('button', { name: /Suggest Teaching Load draft/i });
		await expect(suggestDraftAction).toBeVisible({ timeout: 60_000 });
		await expect(suggestDraftAction).toBeEnabled({ timeout: 60_000 });
		await expect(page.getByTestId('teaching-load-apply-suggestion')).toHaveCount(0);
		const proposalResponsePromise = page.waitForResponse((response) =>
			response.url().includes('/api/v1/faculty-assignments/suggestion-proposals')
			&& !response.url().includes('/apply')
			&& response.request().method() === 'POST',
		);
		await suggestDraftAction.click();
		const proposalResponse = await proposalResponsePromise;
		expect(proposalResponse.status(), `Suggestion proposal preview must persist a pending proposal, got HTTP ${proposalResponse.status()}.`).toBe(201);
		const proposalPayload = await proposalResponse.json() as { proposal?: { id?: number; status?: string } };
		expect(Number(proposalPayload.proposal?.id)).toBeGreaterThan(0);
		expect(proposalPayload.proposal?.status).toBe('PENDING');
		await expect(page.getByTestId('teaching-load-suggestion-preview')).toBeVisible({ timeout: 60_000 });
		await expect(page.getByTestId('teaching-load-apply-suggestion')).toBeVisible();
		const cancelResponsePromise = page.waitForResponse((response) =>
			response.url().includes(`/api/v1/faculty-assignments/suggestion-proposals/${proposalPayload.proposal?.id}/cancel`)
			&& response.request().method() === 'POST',
		);
		await page.getByTestId('teaching-load-suggestion-preview').getByRole('button', { name: /Cancel/i }).click();
		const cancelResponse = await cancelResponsePromise;
		expect(cancelResponse.status(), `Suggestion proposal cancel must persist cancellation, got HTTP ${cancelResponse.status()}.`).toBe(200);
		const cancelPayload = await cancelResponse.json() as { proposal?: { status?: string } };
		expect(cancelPayload.proposal?.status).toBe('CANCELLED');

		const saveButton = page.getByRole('button', { name: /^Save draft$/i });
		if (await saveButton.count() === 0) {
			await expect(page.getByTestId('teaching-load-draft-save-reason')).toBeVisible({ timeout: 10_000 });
		} else if (await saveButton.last().isDisabled()) {
			await expect(page.getByTestId('teaching-load-draft-save-reason')).toBeVisible({ timeout: 10_000 });
		}

		const toggle = page.getByTestId('teaching-load-advanced-grid-toggle').first();
		if (await page.getByText(/Guided mode is active/i).isVisible().catch(() => false)) {
			await page.getByTestId('teaching-load-advanced-grid-toggle').last().click();
		} else {
			await toggle.click();
		}
		await expect(page.getByRole('button', { name: /More filters/i }).first()).toBeVisible({ timeout: 20_000 });

		const metrics = await page.evaluate(() => {
			const guide = document.querySelector('[data-testid="teaching-load-task-guide"]')?.getBoundingClientRect();
			const queue = document.querySelector('[data-testid="teaching-load-repair-queue"]')?.getBoundingClientRect();
			const bar = document.querySelector('[data-testid="teaching-load-draft-action-bar"]')?.getBoundingClientRect();
			return {
				guideHeight: Math.round(guide?.height ?? 0),
				queueHeight: Math.round(queue?.height ?? 0),
				draftBarHeight: Math.round(bar?.height ?? 0),
				currentRepair: document.querySelector('[data-testid="teaching-load-current-repair"]')?.textContent?.replace(/\s+/g, ' ').trim(),
			};
		});
		expect(metrics.guideHeight).toBeLessThanOrEqual(72);
		expect(metrics.queueHeight).toBeLessThanOrEqual(page.viewportSize()!.width < 768 ? 260 : 180);
		await assertNoGlobalOverflow(page);
		await assertNoVisibleOverlap(page);
		await attachReport(testInfo, 'teaching-load-guided-queue', metrics);
	});
});
