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

test.describe.serial('EnrollPro new-year readiness', () => {
	test('officer workflow uses dynamic active year and blocks stale-year generation', async ({ page }) => {
		test.setTimeout(180_000);
		await login(page);

		const latestTimetable404s: string[] = [];
		let guardLatestTimetable404 = true;
		let activeSchoolYearId = 1;
		page.on('response', (response) => {
			if (
				guardLatestTimetable404
				&& response.status() === 404
				&& response.url().includes('/runs/latest/timetable')
			) {
				latestTimetable404s.push(response.url());
			}
		});

		// Fetch runtime context to derive active school year dynamically
		const context = await readJson<{
			activeSchoolYearId: number;
			activeSchoolYearLabel: string | null;
			activeYearDrift: { status: string; recommendedAction: string };
		}>(await page.request.get('/api/v1/runtime/context?schoolId=1&verifyUpstream=true'));
		activeSchoolYearId = context.activeSchoolYearId;
		expect(activeSchoolYearId).toBeGreaterThan(0);
		console.log(`  ℹ Derived activeSchoolYearId=${activeSchoolYearId} from runtime context`);

		// Fetch rollover status for drift validation
		const status = await readJson<{
			drift: { status: string; enrollProSchoolYearLabel: string | null; recommendedAction: string };
			counts?: { sectionCount: number; facultyCount: number };
			mirror: { yearLabel: string; sectionCount: number; facultyCount: number; syncStatus: string } | null;
		}>(await page.request.get('/api/v1/runtime/rollover-status?schoolId=1&includeCounts=true'));

		// Drift alignment: both endpoints must agree
		expect(context.activeYearDrift.status).toBe(status.drift.status);
		console.log(`  ℹ Drift status: ${context.activeYearDrift.status}`);

		// Accept aligned, mapping-conflict, or enrollpro-unreachable
		expect(['aligned', 'mapping-conflict', 'enrollpro-unreachable']).toContain(status.drift.status);

		// Current-year readiness checks (only when aligned)
		if (status.drift.status === 'aligned') {
			expect(status.drift.enrollProSchoolYearLabel).toBeTruthy();
			expect(status.mirror?.yearLabel).toBeTruthy();
			expect(status.mirror?.syncStatus).toBe('setup-review-required');

			const sections = await readJson<{ sections: unknown[] }>(
				await page.request.get(`/api/v1/sections/summary/${activeSchoolYearId}?schoolId=1`),
			);
			expect(sections.sections.length).toBeGreaterThan(0);
			console.log(`  ℹ Sections for year ${activeSchoolYearId}: ${sections.sections.length}`);

			const faculty = await readJson<{ faculty: Array<{ isPlaceholder?: boolean; isStale?: boolean; isActiveForScheduling?: boolean }> }>(
				await page.request.get(`/api/v1/faculty?schoolId=1&schoolYearId=${activeSchoolYearId}`),
			);
			const realEnrollProFaculty = faculty.faculty.filter((r) => !r.isPlaceholder && r.isStale !== true && r.isActiveForScheduling !== false);
			const placeholders = faculty.faculty.filter((r) => r.isPlaceholder === true);
			const totalActive = faculty.faculty.filter((r) => r.isStale !== true && r.isActiveForScheduling !== false);
			console.log(`  ℹ Faculty: ${realEnrollProFaculty.length} real, ${placeholders.length} placeholders, ${totalActive.length} total active`);
		}

		// Dashboard, map, sections, teachers, teaching-load navigation
		await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('body')).toContainText(/Teaching Load|Build Teaching Load/i, { timeout: 30_000 });
		await page.waitForTimeout(2_000);

		await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.getByRole('heading', { name: /Campus and rooms/i })).toBeVisible({ timeout: 30_000 });
		await page.waitForTimeout(2_000);

		guardLatestTimetable404 = false;

		await page.goto('/sections', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('body')).toContainText(/section/i, { timeout: 30_000 });

		await page.goto('/teachers', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('body')).toContainText(/teacher|faculty/i, { timeout: 30_000 });

		await page.goto('/teaching-load', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('body')).toContainText(/Build Teaching Load|review|required|Generation is blocked/i, { timeout: 30_000 });

		// Teaching Load suggestion workflow (read-only: preview then cancel)
		const suggestDraftAction = page.getByRole('button', { name: /Suggest Teaching Load draft/i });
		if (await suggestDraftAction.isVisible({ timeout: 5_000 }).catch(() => false)) {
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
			const suggestionPreview = page.getByTestId('teaching-load-suggestion-preview');
			await expect(suggestionPreview).toBeVisible({ timeout: 60_000 });
			await expect(suggestionPreview).toContainText(/Review suggested Teaching Load draft|Suggested Teaching Load/i);
			await expect(page.getByTestId('teaching-load-apply-suggestion')).toBeVisible();
			const cancelResponsePromise = page.waitForResponse((response) =>
				response.url().includes(`/api/v1/faculty-assignments/suggestion-proposals/${proposalPayload.proposal?.id}/cancel`)
				&& response.request().method() === 'POST',
			);
			await suggestionPreview.getByRole('button', { name: /Cancel/i }).click();
			const cancelResponse = await cancelResponsePromise;
			expect(cancelResponse.status(), `Suggestion proposal cancel must persist cancellation, got HTTP ${cancelResponse.status()}.`).toBe(200);
			const cancelPayload = await cancelResponse.json() as { proposal?: { status?: string } };
			expect(cancelPayload.proposal?.status).toBe('CANCELLED');
			await expect(suggestionPreview).toBeHidden({ timeout: 10_000 });
		}

		// Timetable page
		await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('body')).toContainText(/Timetable|Teaching Load|No current-year timetable/i, { timeout: 30_000 });

		// Stale-year generation guard: attempt generation for a stale year
		const staleSchoolYearId = activeSchoolYearId === 1 ? 39 : 1;
		const staleRunsBefore = await readJson<{ runs?: unknown[] }>(
			await page.request.get(`/api/v1/generation/1/${staleSchoolYearId}/runs`),
		);
		const staleRunCountBefore = (staleRunsBefore.runs ?? []).length;

		const staleGeneration = await page.request.post(`/api/v1/generation/1/${staleSchoolYearId}/runs`);
		expect(staleGeneration.status()).toBe(409);
		const staleBlock = await staleGeneration.json() as { code?: string; message?: string; actionHint?: string };
		expect(staleBlock.code).toBe('ACTIVE_YEAR_DRIFT');

		// Verify stale year run count did not increase
		const staleRunsAfter = await readJson<{ runs?: unknown[] }>(
			await page.request.get(`/api/v1/generation/1/${staleSchoolYearId}/runs`),
		);
		expect((staleRunsAfter.runs ?? []).length).toBe(staleRunCountBefore);
		console.log(`  ✓ Stale year ${staleSchoolYearId} generation blocked, run count unchanged at ${staleRunCountBefore}`);
	});
});
