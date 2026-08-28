import { expect, test, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { loginAdmin, openTaskDrawer, openTimetableAdvanced, openTimetableSimple } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-overhaul-iteration-a');

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

test.describe.serial('Timetable overhaul Iteration A source and workflow truth', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
	});

	test('runtime source and latest completed run are visible to the operator', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const token = await loginAdmin(page);
		const headers = { Authorization: `Bearer ${token}` };

		const runtimeResponse = await page.request.get('/api/v1/runtime/context?schoolId=1', { headers });
		expect(runtimeResponse.ok()).toBeTruthy();
		const runtime = await runtimeResponse.json() as {
			activeSchoolYearId: number;
			source: string;
			stale: boolean;
			upstream?: { reachable?: boolean; verified?: boolean };
		};
		const [runsResponse, latestDraftResponse] = await Promise.all([
			page.request.get(`/api/v1/generation/1/${runtime.activeSchoolYearId}/runs?limit=5`, { headers }),
			page.request.get(`/api/v1/generation/1/${runtime.activeSchoolYearId}/runs/latest/draft`, { headers }),
		]);

		expect(runsResponse.ok()).toBeTruthy();
		expect(latestDraftResponse.ok()).toBeTruthy();

		const runsPayload = await runsResponse.json() as { runs: Array<{ id: number; status: string }> };
		const latestDraft = await latestDraftResponse.json() as {
			runId: number;
			entries: unknown[];
			unassignedItems: Array<{ facultyId?: number | null; homeRoomId?: number | null }>;
		};

		await openTimetableAdvanced(page);
		const sourceTruth = page.getByTestId('timetable-source-truth');
		await expect(sourceTruth, 'Saved/stale runtime source must be visible in the timetable header.').toBeVisible({ timeout: 20_000 });
		await expect(sourceTruth).toContainText(new RegExp(`School year #${runtime.activeSchoolYearId}`));
		await expect(sourceTruth).toContainText(/Using saved ATLAS data|Using cached school year|Verified with EnrollPro|Checking source/i);

		const newestRun = runsPayload.runs[0];
		if (newestRun && newestRun.id !== latestDraft.runId && newestRun.status !== 'COMPLETED') {
			await expect(page.getByTestId('timetable-run-source-note')).toContainText(
				new RegExp(`completed run #${latestDraft.runId}.*run #${newestRun.id}`, 'i'),
			);
		}

		await attachReport(testInfo, 'source-truth-contract', {
			runtime,
			newestRun,
			latestCompletedDraftRunId: latestDraft.runId,
			assignedEntries: latestDraft.entries.length,
			unassignedItems: latestDraft.unassignedItems.length,
			unassignedWithFaculty: latestDraft.unassignedItems.filter((item) => item.facultyId != null).length,
			unassignedWithHomeRoom: latestDraft.unassignedItems.filter((item) => item.homeRoomId != null).length,
		});
	});

	test('missing-room generated unassigned items require room review before save', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const token = await loginAdmin(page);
		const headers = { Authorization: `Bearer ${token}` };
		const runtimeResponse = await page.request.get('/api/v1/runtime/context?schoolId=1', { headers });
		expect(runtimeResponse.ok()).toBeTruthy();
		const runtime = await runtimeResponse.json() as { activeSchoolYearId: number };
		const latestDraftResponse = await page.request.get(`/api/v1/generation/1/${runtime.activeSchoolYearId}/runs/latest/draft`, { headers });
		expect(latestDraftResponse.ok()).toBeTruthy();
		const latestDraft = await latestDraftResponse.json() as {
			unassignedItems: Array<{ facultyId?: number | null; homeRoomId?: number | null }>;
		};
		const missingRoomCount = latestDraft.unassignedItems.filter((item) => item.facultyId != null && item.homeRoomId == null).length;
		test.skip(missingRoomCount === 0, 'Current live fixture has no generated unassigned missing-room item to validate.');

		await openTimetableSimple(page);
		await openTaskDrawer(page, /Place unresolved sessions/i);
		const panel = page.locator('#panel-unassigned');
		await expect(panel.getByTestId('generated-unassigned-card').first()).toBeVisible({ timeout: 20_000 });
		await panel.getByTestId('generated-unassigned-card').first().click();

		await expect(panel.getByText(/Needs room/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(panel.getByRole('button', { name: /^Review room source$/i }).first()).toBeVisible({ timeout: 10_000 });

		await attachReport(testInfo, 'missing-room-unassigned-contract', {
			totalUnassigned: latestDraft.unassignedItems.length,
			missingRoomCount,
			expectedNextStep: 'Review room source opens grid-slot selection and generated placement review before save.',
		});
	});

	test('generated occupied-slot swap uses the modern Swap sessions action label', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await loginAdmin(page);
		await openTimetableSimple(page);
		await openTaskDrawer(page, /Swap sessions/i);

		const entries = page.locator('[data-timetable-entry="true"]');
		await expect(entries.nth(0)).toBeVisible({ timeout: 20_000 });
		await entries.nth(0).click();
		await expect(entries.nth(1)).toBeVisible({ timeout: 20_000 });
		await entries.nth(1).click();

		const dialog = page.getByRole('dialog').filter({ hasText: /Swap these two classes\?/i });
		await expect(dialog).toBeVisible({ timeout: 20_000 });
		await expect(dialog.getByRole('button', { name: /Swap sessions/i })).toBeVisible({ timeout: 10_000 });
		await expect(dialog.getByRole('button', { name: /Apply repair/i })).toHaveCount(0);

		await attachReport(testInfo, 'swap-label-contract', {
			dialogVisible: true,
			expectedPrimaryAction: 'Swap sessions',
		});
	});
});
