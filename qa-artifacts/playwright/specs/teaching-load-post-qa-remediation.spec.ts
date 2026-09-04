import { expect, test } from '@playwright/test';

import { loginAdmin } from './timetable-layout-helpers';

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
  await loginAdmin(page);
});

test('teacher-specific missing-load intent is escapable', async ({ page }) => {
  await page.goto('/teaching-load?facultyId=24342&task=missing-load', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('teaching-load-content-shell')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('tab', { name: 'Teachers' })).toHaveAttribute('data-state', 'active');
  await page.getByRole('tab', { name: 'Sections' }).click();
  await expect(page.getByRole('tab', { name: 'Sections' })).toHaveAttribute('data-state', 'active');
  await page.getByRole('tab', { name: 'Subjects' }).click();
  await expect(page.getByRole('tab', { name: 'Subjects' })).toHaveAttribute('data-state', 'active');
});

test('school-wide missing-load intent is escapable', async ({ page }) => {
  await page.goto('/teaching-load?task=missing-load', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('teaching-load-content-shell')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('tab', { name: 'Subjects' })).toHaveAttribute('data-state', 'active');
  await page.getByRole('tab', { name: 'Teachers' }).click();
  await expect(page.getByRole('tab', { name: 'Teachers' })).toHaveAttribute('data-state', 'active');
});

test('subject focus waits for async rows and section disclosure is keyboard operable', async ({ page }) => {
  await page.goto('/teaching-load?view=subjects', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('teaching-load-content-shell')).toBeVisible({ timeout: 45_000 });
  const firstSubject = page.getByTestId('teaching-load-subject-focus-target').first();
  await expect(firstSubject).toBeVisible({ timeout: 45_000 });
  const subjectId = await firstSubject.getAttribute('data-subject-id');
  expect(subjectId).toMatch(/^\d+$/);
  await page.goto(`/teaching-load?view=subjects&subjectId=${subjectId}`, { waitUntil: 'domcontentloaded' });
  const focusedSubject = page.locator(`[data-testid="teaching-load-subject-focus-target"][data-subject-id="${subjectId}"]`);
  await expect(focusedSubject).toBeFocused({ timeout: 45_000 });

  await page.getByRole('tab', { name: 'Sections' }).click();
  const sectionFilter = page.getByRole('combobox');
  await sectionFilter.click();
  await page.getByRole('option', { name: 'All Sections' }).click();
  const sectionRow = page.getByTestId('teaching-load-section-row').first().getByRole('button').first();
  await expect(sectionRow).toBeVisible({ timeout: 45_000 });
  const before = await sectionRow.getAttribute('aria-expanded');
  await sectionRow.focus();
  await page.keyboard.press('Enter');
  await expect(sectionRow).toHaveAttribute('aria-expanded', before === 'true' ? 'false' : 'true');
});

test('mobile repair actions remain reachable', async ({ page }) => {
  await page.goto('/teaching-load', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('teaching-load-repair-queue')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Discard draft' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
