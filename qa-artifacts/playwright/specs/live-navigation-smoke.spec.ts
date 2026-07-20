import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type NavigationIssue = {
	route: string;
	kind: 'console' | 'pageerror' | 'response' | 'requestfailed';
	detail: string;
};

const adminRoutes = ['/', '/sections', '/subjects', '/teachers', '/teaching-load', '/map', '/timetable', '/schedules', '/audit'];
const facultyRoutes = ['/my', '/my/schedule', '/my/preferences', '/my/room-preferences'];
const publicRoutes = ['/login', '/public/schedules'];

async function login(page: Page, identifier: string, password: string) {
	const response = await page.request.post('/api/v1/auth/login', { data: { identifier, password } });
	expect(response.ok(), `Login failed with HTTP ${response.status()}`).toBeTruthy();
	const payload = await response.json() as { token?: string };
	expect(payload.token).toBeTruthy();
	await page.addInitScript(token => sessionStorage.setItem('atlas_local_token', token), payload.token!);
}

async function auditRoutes(page: Page, routes: string[]) {
	const issues: NavigationIssue[] = [];
	let activeRoute = routes[0] ?? '/';

	page.on('pageerror', error => issues.push({ route: activeRoute, kind: 'pageerror', detail: error.message }));
	page.on('console', message => {
		if (message.type() === 'error') issues.push({ route: activeRoute, kind: 'console', detail: message.text() });
	});
	page.on('response', response => {
		if (response.status() >= 400) {
			issues.push({ route: activeRoute, kind: 'response', detail: `${response.status()} ${response.url()}` });
		}
	});
	page.on('requestfailed', request => {
		const detail = request.failure()?.errorText ?? 'unknown request failure';
		if (!detail.includes('ERR_ABORTED')) issues.push({ route: activeRoute, kind: 'requestfailed', detail: `${detail} ${request.url()}` });
	});

	const results: Array<{ route: string; finalUrl: string; title: string }> = [];
	for (const route of routes) {
		activeRoute = route;
		await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('body')).not.toBeEmpty({ timeout: 10_000 });
		await page.waitForTimeout(1_500);
		results.push({ route, finalUrl: page.url(), title: await page.title() });
	}
	return { results, issues };
}

async function attachReport(testInfo: TestInfo, role: string, report: Awaited<ReturnType<typeof auditRoutes>>) {
	const outputDir = path.join(process.cwd(), 'qa-artifacts', 'navigation-smoke');
	fs.mkdirSync(outputDir, { recursive: true });
	const reportPath = path.join(outputDir, `${role}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
	await testInfo.attach(`${role}-navigation-report`, { path: reportPath, contentType: 'application/json' });
}

test.describe.serial('Live Tailnet navigation smoke', () => {
	test('admin navigation', async ({ page }, testInfo) => {
		test.setTimeout(180_000);
		await login(page, process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001', process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!');
		const report = await auditRoutes(page, adminRoutes);
		await attachReport(testInfo, 'admin', report);
		const critical = report.issues.filter(issue => issue.kind === 'pageerror' || (issue.kind === 'response' && issue.detail.includes('/api/v1/') && /^5/.test(issue.detail)));
		expect(critical, 'Admin navigation must not produce page exceptions or first-party API 5xx responses').toEqual([]);
	});

	test('faculty navigation', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		await login(page, process.env.PLAYWRIGHT_FACULTY_EMAIL ?? '2000056', process.env.PLAYWRIGHT_FACULTY_PASSWORD ?? 'DepEd2026!');
		const report = await auditRoutes(page, facultyRoutes);
		await attachReport(testInfo, 'faculty', report);
		const critical = report.issues.filter(issue => issue.kind === 'pageerror' || (issue.kind === 'response' && issue.detail.includes('/api/v1/') && /^5/.test(issue.detail)));
		expect(critical, 'Faculty navigation must not produce page exceptions or first-party API 5xx responses').toEqual([]);
	});

	test('public navigation', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const report = await auditRoutes(page, publicRoutes);
		await attachReport(testInfo, 'public', report);
		const critical = report.issues.filter(issue => issue.kind === 'pageerror' || (issue.kind === 'response' && issue.detail.includes('/api/v1/') && /^5/.test(issue.detail)));
		expect(critical, 'Public navigation must not produce page exceptions or first-party API 5xx responses').toEqual([]);
	});
});
