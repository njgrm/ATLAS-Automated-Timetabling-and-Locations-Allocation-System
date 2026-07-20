import { test, expect } from '@playwright/test';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

test.describe('UX Audit Screenshots', () => {
    test.use({ baseURL: 'https://njgrm.buru-degree.ts.net' });

    test('capture all states', async ({ page, isMobile }, testInfo) => {
        test.setTimeout(120000);
        const viewportName = testInfo.project.name;
        const outDir = `qa-artifacts/ux-audit/${viewportName}`;
        
        // 1. Login
        const response = await page.request.post('/api/v1/auth/login', { data: credentials });
        const payload = await response.json();
        await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${payload.token}` });
        await page.addInitScript((token) => {
            sessionStorage.setItem('atlas_local_token', token);
            localStorage.setItem('atlas_timetable_tour', 'true');
        }, payload.token);

        // 2. Navigate to /timetable
        await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45000 });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${outDir}/01-initial-generated-run-review.png`, fullPage: true });

        // 3. Generated unassigned tab/list
        const unassignedTab = page.getByRole('tab', { name: /Unassigned/i }).or(page.getByRole('button', { name: /Unassigned/i }));
        if (await unassignedTab.count() > 0) {
            await unassignedTab.first().click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: `${outDir}/02-generated-unassigned-tab.png`, fullPage: true });

            const unassignedItem = page.locator('#panel-unassigned [role="button"]').first();
            if (await unassignedItem.count() > 0) {
                await unassignedItem.click();
                await page.waitForTimeout(1000);
                await page.screenshot({ path: `${outDir}/03-selecting-unassigned-item.png`, fullPage: true });

                await unassignedItem.hover();
                await page.waitForTimeout(500);
                await page.screenshot({ path: `${outDir}/04-hover-unassigned-item.png`, fullPage: true });
            }
        }

        const occupiedCells = page.locator('[data-timetable-entry="true"]');
        if (await occupiedCells.count() >= 2) {
            await occupiedCells.nth(0).click();
            await occupiedCells.nth(1).click();
            await page.waitForTimeout(1000);
            const dialog = page.getByRole('dialog');
            if (await dialog.count() > 0) {
                await page.screenshot({ path: `${outDir}/05-occupied-session-swap-review.png`, fullPage: true });
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
            }
        }

        if (await occupiedCells.count() > 0) {
            await occupiedCells.nth(0).click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: `${outDir}/08-right-side-detail-panel.png`, fullPage: true });
            await page.keyboard.press('Escape');
        }

        const draftButton = page.getByRole('button', { name: /Plan before generating|Opening draft/i });
        if (await draftButton.count() > 0) {
            await draftButton.click();
            await expect(page.getByText(/Pre-Generation Draft/i).first()).toBeVisible({ timeout: 10000 });
            await page.waitForTimeout(2000);
            await page.screenshot({ path: `${outDir}/06-pre-generation-draft-workspace.png`, fullPage: true });

            const draftQueueItem = page.locator('#panel-unassigned [role="button"]').first();
            if (await draftQueueItem.count() > 0) {
                await draftQueueItem.click();
                const emptyTargetCell = page
                    .locator('td[role="button"][data-day][data-start-time][data-end-time]')
                    .filter({ hasNot: page.locator('[data-timetable-entry="true"]') })
                    .first();
                if (await emptyTargetCell.count() > 0) {
                    await emptyTargetCell.click();
                    await page.waitForTimeout(1000);
                    await page.screenshot({ path: `${outDir}/07-draft-queue-placement-review.png`, fullPage: true });
                    await page.keyboard.press('Escape');
                }
            }
        }
    });
});
