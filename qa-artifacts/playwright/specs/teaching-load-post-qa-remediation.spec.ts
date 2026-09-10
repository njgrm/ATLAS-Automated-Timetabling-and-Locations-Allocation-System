import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TL-UX-C01 Teaching Load QA.
 *
 * Live Tailnet run (default): observation-only baseline. It authenticates,
 * walks `/teaching-load` across the required viewports, captures screenshots and
 * layout metrics, and records every non-login write the deployed client
 * dispatches. The known pre-fix defect (a background split-brain preview POST)
 * is asserted here as the "before" evidence.
 *
 * Candidate run (`PLAYWRIGHT_EXPECT_CANDIDATE=1`): asserts the redesigned
 * workspace against the isolated candidate served through the Tailnet IP and
 * fails on ANY non-login write (abort mode).
 */

const CANDIDATE = process.env.PLAYWRIGHT_EXPECT_CANDIDATE === '1';
const SHOT_DIR = resolve(process.cwd(), 'test-results', 'tl-ux-c01');
const SPLIT_BRAIN_PREVIEW = '/faculty-assignments/integrity/reconcile-split-brain';

const ADMIN = {
	identifier: process.env.PLAYWRIGHT_ADMIN_ID ?? '1234501',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'DepEdSY2026!',
};

type Violation = { method: string; url: string; body: string | null };

const VIEWPORTS = [
	{ width: 1440, height: 900 },
	{ width: 1280, height: 720 },
	{ width: 1024, height: 768 },
	{ width: 390, height: 844 },
	{ width: 360, height: 800 },
	{ width: 640, height: 360 },
];

async function loginReadOnly(page: Page): Promise<void> {
	const response = await page.request.post('/api/v1/auth/login', { data: ADMIN });
	expect(response.ok(), `Admin login failed HTTP ${response.status()}: ${(await response.text()).slice(0, 300)}`).toBeTruthy();
	const payload = (await response.json()) as { token?: string };
	expect(payload.token, 'Admin login must return a bearer token.').toBeTruthy();
	await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${payload.token}` });
	await page.addInitScript((token) => {
		window.sessionStorage.setItem('atlas_local_token', token);
	}, payload.token!);
}

async function installMutationGuard(page: Page, mode: 'abort' | 'record'): Promise<Violation[]> {
	const violations: Violation[] = [];
	await page.route('**/*', async (route) => {
		const request = route.request();
		const method = request.method().toUpperCase();
		const url = request.url();
		const isSafe = ['GET', 'HEAD', 'OPTIONS'].includes(method) || url.includes('/api/v1/auth/login');
		if (!isSafe) {
			violations.push({ method, url, body: request.postData() });
			if (mode === 'abort') {
				await route.abort();
				return;
			}
		}
		await route.continue();
	});
	return violations;
}

async function measure(page: Page) {
	return page.evaluate(() => {
		const shell = document.querySelector('[data-testid="teaching-load-content-shell"]') as HTMLElement | null;
		const workspace = document.querySelector('[data-testid="teaching-load-workspace"]') as HTMLElement | null;
		const root = document.scrollingElement ?? document.documentElement;
		const shellHeight = shell?.getBoundingClientRect().height ?? 0;
		const workspaceHeight = workspace?.getBoundingClientRect().height ?? 0;
		return {
			shellHeight: Math.round(shellHeight),
			workspaceHeight: Math.round(workspaceHeight),
			workspaceShare: shellHeight > 0 ? Number((workspaceHeight / shellHeight).toFixed(3)) : 0,
			globalScrollWidth: root.scrollWidth,
			globalClientWidth: root.clientWidth,
		};
	});
}

test.beforeAll(() => {
	mkdirSync(SHOT_DIR, { recursive: true });
});

test('Teaching Load read-only walk across viewports', async ({ page }) => {
	const violations = await installMutationGuard(page, CANDIDATE ? 'abort' : 'record');
	await loginReadOnly(page);

	const metrics: Record<string, unknown> = {};
	for (const viewport of VIEWPORTS) {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.goto('/teaching-load', { waitUntil: 'domcontentloaded' });
		await expect(page.getByTestId('teaching-load-content-shell')).toBeVisible({ timeout: 60_000 });
		metrics[`${viewport.width}x${viewport.height}`] = await measure(page);
		await page.screenshot({
			path: resolve(SHOT_DIR, `${CANDIDATE ? 'candidate' : 'live'}-${viewport.width}x${viewport.height}.png`),
			fullPage: false,
		});
		expect((metrics[`${viewport.width}x${viewport.height}`] as { globalScrollWidth: number }).globalScrollWidth)
			.toBeLessThanOrEqual((metrics[`${viewport.width}x${viewport.height}`] as { globalClientWidth: number }).globalClientWidth + 1);
	}

	// eslint-disable-next-line no-console
	console.log(`[TL-UX-C01 ${CANDIDATE ? 'candidate' : 'live'}] metrics ${JSON.stringify(metrics)}`);

	if (CANDIDATE) {
		// The redesigned candidate must dispatch zero non-login writes.
		expect(violations, `Candidate dispatched forbidden writes: ${JSON.stringify(violations)}`).toEqual([]);
	} else {
		// The deployed client currently dispatches the split-brain preview as the
		// ONLY non-login write. Any other write would be a separate defect.
		const unexpected = violations.filter((violation) => !violation.url.includes(SPLIT_BRAIN_PREVIEW));
		expect(unexpected, `Unexpected live writes: ${JSON.stringify(unexpected)}`).toEqual([]);
		expect(violations.length, 'Expected the known live split-brain preview defect to reproduce.').toBeGreaterThan(0);
	}
});

test('redesigned candidate holds workspace height and removes split-authority controls', async ({ page }) => {
	test.skip(!CANDIDATE, 'Structural assertions run only against the isolated candidate.');
	const violations = await installMutationGuard(page, 'abort');
	await loginReadOnly(page);

	const floors = [
		{ width: 1440, height: 900, minShare: 0.45, minHeight: 260 },
		{ width: 1280, height: 720, minShare: 0.45, minHeight: 240 },
		{ width: 1024, height: 768, minShare: 0.4, minHeight: 200 },
		{ width: 390, height: 844, minShare: 0.35, minHeight: 160 },
		{ width: 360, height: 800, minShare: 0.35, minHeight: 160 },
		{ width: 640, height: 360, minShare: 0.2, minHeight: 120 },
	];

	for (const floor of floors) {
		await page.setViewportSize({ width: floor.width, height: floor.height });
		await page.goto('/teaching-load', { waitUntil: 'domcontentloaded' });
		await expect(page.getByTestId('teaching-load-content-shell')).toBeVisible({ timeout: 60_000 });
		await expect(page.getByTestId('teaching-load-workspace')).toBeVisible();
		const value = await measure(page);
		expect(value.workspaceHeight, `workspace collapsed at ${floor.width}x${floor.height}: ${JSON.stringify(value)}`).toBeGreaterThanOrEqual(floor.minHeight);
		expect(value.workspaceShare, `workspace share too small at ${floor.width}x${floor.height}: ${JSON.stringify(value)}`).toBeGreaterThanOrEqual(floor.minShare);
		expect(value.globalScrollWidth).toBeLessThanOrEqual(value.globalClientWidth + 1);
	}

	await expect(page.getByRole('tab', { name: 'Subjects' })).toHaveCount(0);
	await expect(page.getByTestId('teaching-load-open-reconciliation')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Reconcile teaching load/i })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Open staffing audit/i })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Details' })).toHaveCount(0);
	expect(violations, `Candidate dispatched forbidden writes: ${JSON.stringify(violations)}`).toEqual([]);
});
