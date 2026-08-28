import { expect, test, type Page } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

const ROUTE = '/teaching-load';

async function openTeachingLoad(page: Page) {
	await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => null);
	await page.waitForTimeout(1000);
}

test.describe('Teaching Load lock recovery', () => {
	test.beforeEach(async ({ page }) => {
		await loginAdmin(page);
		await openTeachingLoad(page);
	});

	test('no global scrollbar or horizontal overflow', async ({ page }) => {
		await assertNoGlobalOverflow(page);
	});

	test('lock recovery action exists when quarantine is blocking', async ({ page }) => {
		// Check if the lock state is active by looking for the unlock button or alert chip
		const lockAlert = page.locator('[data-testid="teaching-load-alert-unlock-editing"]');
		const moreMenu = page.locator('button[aria-label*="More" i], button[aria-label*="more" i]').first();

		// If the lock is active, the unlock alert chip should be visible
		const isLocked = await lockAlert.isVisible({ timeout: 3000 }).catch(() => false);

		if (isLocked) {
			await expect(lockAlert).toBeVisible();
			await expect(lockAlert).toContainText('Unlock editing');
		}

		// The More menu should contain the lock recovery action when locked
		if (isLocked && await moreMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
			await moreMenu.click();
			const unlockAction = page.getByRole('menuitem', { name: /Review and unlock editing/i });
			const reconcileAction = page.getByRole('menuitem', { name: /Reconcile saved coverage/i });
			const hasUnlockAction = await unlockAction.isVisible({ timeout: 2000 }).catch(() => false);
			const hasReconcileAction = await reconcileAction.isVisible({ timeout: 2000 }).catch(() => false);
			expect(hasUnlockAction || hasReconcileAction, 'More menu should contain a lock recovery action').toBeTruthy();
			// Close the menu
			await page.keyboard.press('Escape');
		}
	});

	test('lock recovery dialog opens and shows plain-language summary', async ({ page }) => {
		// Try to open the lock recovery dialog via the alert chip or More menu
		const lockAlert = page.locator('[data-testid="teaching-load-alert-unlock-editing"]');
		const isLocked = await lockAlert.isVisible({ timeout: 3000 }).catch(() => false);

		if (!isLocked) {
			test.skip(true, 'Lock state not active on this environment');
			return;
		}

		// Click the unlock alert chip
		await lockAlert.click();

		// The lock recovery dialog should open
		const dialog = page.locator('[role="dialog"]').filter({ hasText: /Review and unlock Teaching Load editing/i });
		await expect(dialog).toBeVisible({ timeout: 5000 });

		// Should show plain-language summary
		await expect(dialog).toContainText('ATLAS found saved Teaching Load links');
		await expect(dialog).toContainText('What ATLAS will do');
		await expect(dialog).toContainText('What ATLAS will not do');

		// Should NOT show AutoFillSummaryModal content
		await expect(dialog).not.toContainText('Suggested Teaching Load covers all rows');

		// Should have Cancel and Unlock buttons
		const cancelButton = dialog.getByRole('button', { name: /Cancel/i });
		const unlockButton = dialog.getByRole('button', { name: /Unlock Teaching Load editing/i });
		await expect(cancelButton).toBeVisible();
		await expect(unlockButton).toBeVisible();

		// Close via Cancel
		await cancelButton.click();
		await expect(dialog).not.toBeVisible({ timeout: 3000 });
	});

	test('lock recovery dialog does not open AutoFillSummaryModal', async ({ page }) => {
		const lockAlert = page.locator('[data-testid="teaching-load-alert-unlock-editing"]');
		const isLocked = await lockAlert.isVisible({ timeout: 3000 }).catch(() => false);

		if (!isLocked) {
			test.skip(true, 'Lock state not active on this environment');
			return;
		}

		await lockAlert.click();

		// The AutoFillSummaryModal should NOT be visible
		const autoFillModal = page.locator('[role="dialog"]').filter({ hasText: /Suggested Teaching Load/i });
		await expect(autoFillModal).not.toBeVisible({ timeout: 2000 });
	});

	test('no text overlap on desktop', async ({ page }) => {
		const spill = await page.evaluate(() => {
			const vpWidth = window.innerWidth;
			const hasLocalScroll = (el: Element) => {
				let current: Element | null = el.parentElement;
				while (current && current !== document.body) {
					const style = window.getComputedStyle(current);
					if (/(auto|scroll|hidden)/.test(style.overflowX) && current.scrollWidth > current.clientWidth + 2) {
						return true;
					}
					current = current.parentElement;
				}
				return false;
			};

			const nodes = Array.from(document.querySelectorAll('h1,h2,h3,p,span,button,a,label,td,th,[role="button"]')).slice(0, 800);
			return nodes
				.map((element) => {
					const rect = element.getBoundingClientRect();
					const style = window.getComputedStyle(element);
					const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
					if (!visible) return null;
					if (hasLocalScroll(element)) return null;
					// Element starts inside viewport but extends beyond it — real spill.
					if (rect.left >= -2 && rect.left < vpWidth && rect.right > vpWidth + 2) {
						return { text: (element.textContent ?? '').trim().slice(0, 60), left: Math.round(rect.left), right: Math.round(rect.right) };
					}
					return null;
				})
				.filter(Boolean)
				.slice(0, 5);
		});
		expect(spill, `Visible text must not spill outside viewport: ${JSON.stringify(spill)}`).toEqual([]);
	});
});

test.describe('Teaching Load lock recovery — mobile', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test.beforeEach(async ({ page }) => {
		await loginAdmin(page);
		await openTeachingLoad(page);
	});

	test('no global scrollbar on mobile', async ({ page }) => {
		await assertNoGlobalOverflow(page);
	});

	test('no horizontal overflow on mobile', async ({ page }) => {
		const overflow = await page.evaluate(() => {
			const root = document.scrollingElement ?? document.documentElement;
			return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
		});
		expect(overflow.scrollWidth, `Mobile horizontal overflow: ${overflow.scrollWidth}px > ${overflow.clientWidth}px`).toBeLessThanOrEqual(overflow.clientWidth + 8);
	});

	test('no text spill outside viewport on mobile', async ({ page }) => {
		const viewportWidth = 390;
		const spill = await page.evaluate((vpWidth) => {
			const hasLocalScroll = (el: Element) => {
				let current: Element | null = el.parentElement;
				while (current && current !== document.body) {
					const style = window.getComputedStyle(current);
					if (/(auto|scroll|hidden)/.test(style.overflowX) && current.scrollWidth > current.clientWidth + 2) {
						return true;
					}
					current = current.parentElement;
				}
				return false;
			};

			const nodes = Array.from(document.querySelectorAll('h1,h2,h3,p,span,button,a,label,td,th,[role="button"]')).slice(0, 600);
			return nodes
				.map((element) => {
					const rect = element.getBoundingClientRect();
					const style = window.getComputedStyle(element);
					const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
					if (!visible) return null;
					if (hasLocalScroll(element)) return null;
					// Element starts inside viewport but extends beyond it — real spill.
					if (rect.left >= 0 && rect.left < vpWidth && rect.right > vpWidth + 2) {
						return { text: (element.textContent ?? '').trim().slice(0, 60), right: Math.round(rect.right) };
					}
					return null;
				})
				.filter(Boolean)
				.slice(0, 5);
		}, viewportWidth);
		expect(spill, `Mobile text spill: ${JSON.stringify(spill)}`).toEqual([]);
	});

	test('primary lock action is fully visible on mobile', async ({ page }) => {
		const lockAlert = page.locator('[data-testid="teaching-load-alert-unlock-editing"]');
		const isLocked = await lockAlert.isVisible({ timeout: 3000 }).catch(() => false);

		if (!isLocked) {
			// If not locked, check that the primary action and More are visible
			const moreButton = page.locator('button[aria-label*="More" i]').first();
			await expect(moreButton).toBeVisible({ timeout: 5000 });
			return;
		}

		// The lock alert chip must be fully visible (not clipped)
		const box = await lockAlert.boundingBox();
		expect(box, 'Lock alert should be visible').not.toBeNull();
		expect(box!.x, 'Lock alert should not be clipped on left').toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width, 'Lock alert should not be clipped on right').toBeLessThanOrEqual(390 + 2);
	});

	test('lock recovery dialog content does not overflow on mobile', async ({ page }) => {
		const lockAlert = page.locator('[data-testid="teaching-load-alert-unlock-editing"]');
		const isLocked = await lockAlert.isVisible({ timeout: 3000 }).catch(() => false);

		if (!isLocked) {
			test.skip(true, 'Lock state not active on this environment');
			return;
		}

		await lockAlert.click();
		const dialog = page.locator('[role="dialog"]').filter({ hasText: /Review and unlock Teaching Load editing/i });
		await expect(dialog).toBeVisible({ timeout: 5000 });

		// Check dialog content doesn't overflow
		const dialogBox = await dialog.boundingBox();
		if (dialogBox) {
			expect(dialogBox.width, 'Lock recovery dialog should not exceed mobile viewport').toBeLessThanOrEqual(420);
		}

		// Close
		const cancel = dialog.getByRole('button', { name: /Cancel/i });
		await cancel.click();
	});

	test('repair queue primary action is visible on mobile', async ({ page }) => {
		const repairCard = page.locator('[data-testid="teaching-load-current-repair"]');
		const isVisible = await repairCard.isVisible({ timeout: 3000 }).catch(() => false);
		if (!isVisible) return;

		const primaryAction = page.locator('[data-testid="teaching-load-repair-review"]');
		const actionVisible = await primaryAction.isVisible({ timeout: 2000 }).catch(() => false);
		expect(actionVisible, 'Repair queue primary action should be visible on mobile').toBeTruthy();
	});

	test('draft action bar does not overflow on mobile', async ({ page }) => {
		const actionBar = page.locator('[data-testid="teaching-load-draft-action-bar"]');
		const isVisible = await actionBar.isVisible({ timeout: 3000 }).catch(() => false);
		if (!isVisible) return;

		const box = await actionBar.boundingBox();
		if (box) {
			expect(box.x, 'Draft action bar should not overflow left').toBeGreaterThanOrEqual(-2);
			expect(box.x + box.width, 'Draft action bar should not overflow right').toBeLessThanOrEqual(392);
		}
	});
});

test.describe('Teaching Load lock recovery — intercepted reconcile', () => {
	test('reconcile 500 error keeps dialog open and shows error in dialog', async ({ page }) => {
		await loginAdmin(page);
		await openTeachingLoad(page);

		const lockAlert = page.locator('[data-testid="teaching-load-alert-unlock-editing"]');
		const isLocked = await lockAlert.isVisible({ timeout: 3000 }).catch(() => false);

		if (!isLocked) {
			test.skip(true, 'Lock state not active on this environment');
			return;
		}

		// Intercept the reconcile endpoint to return 500
		await page.route('**/faculty-assignments/integrity/reconcile-split-brain', (route) => {
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Simulated server error for testing' }),
			});
		});

		// Open the lock recovery dialog
		await lockAlert.click();
		const dialog = page.locator('[role="dialog"]').filter({ hasText: /Review and unlock Teaching Load editing/i });
		await expect(dialog).toBeVisible({ timeout: 5000 });

		// Click Unlock
		const unlockButton = dialog.getByRole('button', { name: /Unlock Teaching Load editing/i });
		await expect(unlockButton).toBeVisible();
		await unlockButton.click();

		// Dialog must remain open
		await expect(dialog).toBeVisible({ timeout: 10_000 });

		// Error must appear inside the dialog
		const errorBanner = dialog.locator('[data-testid="lock-recovery-error"]');
		await expect(errorBanner).toBeVisible({ timeout: 5_000 });
		await expect(errorBanner).toContainText('could not reconcile');

		// Try again button should be visible
		const tryAgain = dialog.getByRole('button', { name: /Try again/i });
		await expect(tryAgain).toBeVisible();

		// Close button should say "Close" not "Cancel"
		const closeButton = dialog.getByRole('button', { name: /Close/i }).first();
		await expect(closeButton).toBeVisible();

		// No live write should have happened (intercepted)
		// Close the dialog
		await closeButton.click();
		await expect(dialog).not.toBeVisible({ timeout: 3000 });
	});

	test('reconcile success closes dialog and shows persistent feedback', async ({ page }) => {
		await loginAdmin(page);
		await openTeachingLoad(page);

		const lockAlert = page.locator('[data-testid="teaching-load-alert-unlock-editing"]');
		const isLocked = await lockAlert.isVisible({ timeout: 3000 }).catch(() => false);

		if (!isLocked) {
			test.skip(true, 'Lock state not active on this environment');
			return;
		}

		// Intercept the reconcile endpoint to return success for any request
		let applyRequestMade = false;
		await page.route('**/faculty-assignments/integrity/reconcile-split-brain', async (route) => {
			const request = route.request();
			const body = JSON.parse(request.postData() ?? '{}');
			// Track whether an apply request (non-preview) was made
			if (body.previewOnly === false) {
				applyRequestMade = true;
			}
			// Always fulfill with success
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					applied: true,
					schoolId: body.schoolId ?? 1,
					schoolYearId: body.schoolYearId ?? 5,
					quarantine: { required: false, severity: 'NONE', reasonCodes: [], message: '' },
					counters: { summaryAssignedPairs: 0, summaryUnassignedPairs: 0, summaryTotalPairs: 0 },
					repairPreview: { truthReconcile: { rowsToUpdate: 0, updatedRows: 0 }, staleReconcile: { staleOwnedCurrentYearPairCount: 0, deletedOwnershipRows: 0 }, realFacultyRecovery: { placeholderMovesPlanned: 0, placeholderMovesApplied: 0, blockerCount: 0 } },
				}),
			});
		});

		// Open the lock recovery dialog
		await lockAlert.click();
		const dialog = page.locator('[role="dialog"]').filter({ hasText: /Review and unlock Teaching Load editing/i });
		await expect(dialog).toBeVisible({ timeout: 5000 });

		// Click Unlock
		const unlockButton = dialog.getByRole('button', { name: /Unlock Teaching Load editing/i });
		await expect(unlockButton).toBeVisible();
		await unlockButton.click();

		// Dialog should close after success
		await expect(dialog).not.toBeVisible({ timeout: 15_000 });

		// The apply reconcile endpoint should have been called
		expect(applyRequestMade, 'Apply reconcile endpoint should have been called').toBeTruthy();

		// Persistent feedback should appear
		const feedback = page.locator('[data-testid="teaching-load-suggestion-feedback"], [role="status"]').filter({ hasText: /unlocked|cleaned|still locked/i });
		const hasFeedback = await feedback.isVisible({ timeout: 5000 }).catch(() => false);
		expect(hasFeedback, 'Persistent feedback should appear after reconcile success').toBeTruthy();
	});
});
