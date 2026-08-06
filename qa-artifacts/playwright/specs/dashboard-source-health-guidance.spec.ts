import { expect, test, type Page } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

type DashboardSourceState =
	| 'verified_live'
	| 'checking_source'
	| 'using_saved_data'
	| 'no_saved_data'
	| 'partial_degraded';

function readinessSummaryFixture(sourceState: DashboardSourceState) {
	const sourceMessage: Record<DashboardSourceState, string> = {
		verified_live: 'Verified live readiness data.',
		checking_source: 'Checking readiness source.',
		using_saved_data: 'Using saved readiness data.',
		no_saved_data: 'No saved readiness data is available yet.',
		partial_degraded: 'Some readiness sources are unavailable.',
	};

	return {
		schoolId: 1,
		activeSchoolYearId: 55,
		activeSchoolYearLabel: '2026-2027',
		resolvedAt: new Date('2026-07-28T08:00:00.000Z').toISOString(),
		sourceState,
		sourceMessage: sourceMessage[sourceState],
		campus: {
			buildings: [],
			campusImageUrl: null,
			teachingRoomCount: 0,
			totalRoomCount: 0,
			buildingSetupStatus: { done: false, subMessage: 'Rooms need review' },
		},
		subjects: {
			subjectCount: 42,
			unassignedSubjectCount: 3,
		},
		faculty: {
			facultyCount: 145,
			lastSyncedAt: null,
		},
		sections: {
			sectionCount: 82,
			lastSyncedAt: null,
		},
		generation: {
			latestRunStatus: 'FAILED',
			latestRunId: 225,
			violationCount: 12,
			isPublished: false,
			createdAt: null,
			finishedAt: null,
		},
		lifecyclePhase: 'SETUP',
	};
}

async function mockReadinessSummary(page: Page, sourceState: DashboardSourceState) {
	await page.unroute('**/api/v1/dashboard/readiness-summary**').catch(() => undefined);
	await page.route('**/api/v1/dashboard/readiness-summary**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(readinessSummaryFixture(sourceState)),
		});
	});
}

test.describe('Dashboard source-health guidance', () => {
	test.beforeEach(async ({ page }) => {
		await loginAdmin(page);
	});

	test('source-unavailable state gives one wait-versus-repair instruction and keeps repair links', async ({ page }) => {
		await mockReadinessSummary(page, 'using_saved_data');
		const startedAt = Date.now();
		await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60_000 });

		const panel = page.getByTestId('dashboard-source-health-panel');
		await expect(panel).toBeVisible({ timeout: 10_000 });
		expect(Date.now() - startedAt, 'Dashboard source decision should be visible inside the first-action budget.').toBeLessThan(5_000);

		await expect(panel).toHaveAttribute('data-source-decision', 'using_saved_data');
		await expect(page.getByTestId('dashboard-source-decision')).toContainText(
			'Source unavailable: review saved data now; wait for EnrollPro before final sync.',
		);
		await expect(panel).toContainText('Saved ATLAS data is useful for repair work, but it is not a replacement for live EnrollPro verification.');
		await expect(panel.locator('[data-source-repair-link]')).toHaveCount(5);
		await expect(panel.getByRole('button', { name: 'Sections' })).toBeVisible();
		await expect(panel.getByRole('button', { name: 'Teaching Load' })).toBeVisible();
		await expect(page.getByTestId('dashboard-readiness-hub')).toBeVisible();
		await expect(page.getByTestId('dashboard-readiness-hub')).toContainText(/Setup readiness/i);
		await assertNoGlobalOverflow(page);
	});

	test('verified source state does not show outage or stale-source copy', async ({ page }) => {
		await mockReadinessSummary(page, 'verified_live');
		await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60_000 });

		const panel = page.getByTestId('dashboard-source-health-panel');
		await expect(panel).toBeVisible({ timeout: 10_000 });
		await expect(panel).toHaveAttribute('data-source-decision', 'verified_live');
		await expect(page.getByTestId('dashboard-source-decision')).toContainText('Source verified: continue setup normally.');
		await expect(panel).not.toContainText(/Source unavailable|wait for EnrollPro before final sync|No saved data/i);
		await expect(panel.locator('[data-source-repair-link]')).toHaveCount(5);
		await assertNoGlobalOverflow(page);
	});

	test('checking and no-saved-data states remain distinct from cached fallback', async ({ page }) => {
		await mockReadinessSummary(page, 'checking_source');
		await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.getByTestId('dashboard-source-health-panel')).toHaveAttribute('data-source-decision', 'checking_source');
		await expect(page.getByTestId('dashboard-source-decision')).toContainText(
			'Checking source: review visible setup data now; wait for the check to finish before final sync.',
		);

		await mockReadinessSummary(page, 'no_saved_data');
		await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.getByTestId('dashboard-source-health-panel')).toHaveAttribute('data-source-decision', 'no_saved_data');
		await expect(page.getByTestId('dashboard-source-decision')).toContainText('No saved data: reconnect EnrollPro before repairing setup.');
		await assertNoGlobalOverflow(page);
	});
});
