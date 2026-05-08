import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const PORT = 4174;
const BASE_URL = `http://${HOST}:${PORT}`;
const SCREENSHOT_DIR = path.resolve('qa-artifacts', 'screenshots', 'login-parity');

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 90_000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {
			// Server still starting.
		}
		await sleep(500);
	}
	throw new Error(`Timed out waiting for client server at ${url}`);
}

function startClientServer() {
	const command = `npm --prefix atlas-client run dev -- --host ${HOST} --port ${PORT}`;
	const child = spawn(command, {
		shell: true,
		stdio: 'pipe',
	});

	child.stdout.on('data', (chunk) => {
		process.stdout.write(`[client] ${chunk}`);
	});
	child.stderr.on('data', (chunk) => {
		process.stderr.write(`[client] ${chunk}`);
	});

	return child;
}

function registerRoutes(page, options) {
	const {
		accent = '18 88% 46%',
		loginMode = 'idle',
		localAuthAfterLogin = false,
	} = options;

	let loginCount = 0;

	page.route('**/enrollpro-api/settings/public', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				schoolName: 'HNHS',
				logoUrl: null,
				colorScheme: null,
				selectedAccentHsl: accent,
				activeSchoolYearId: 1,
			}),
		});
	});

	page.route('**/api/v1/auth/me', async (route) => {
		const authHeader = route.request().headers()['authorization'] ?? '';
		if (localAuthAfterLogin && authHeader.includes('mock-local-token')) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					user: {
						userId: 10,
						role: 'officer',
						authSource: 'local',
						mustChangePassword: false,
					},
				}),
			});
			return;
		}

		await route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ code: 'NO_TOKEN', message: 'Unauthorized' }),
		});
	});

	page.route('**/api/v1/auth/login', async (route) => {
		loginCount += 1;

		if (loginMode === 'invalid') {
			await route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({
					code: 'INVALID_CREDENTIALS',
					message: 'Invalid email or password.',
				}),
			});
			return;
		}

		if (loginMode === 'loading') {
			await sleep(1300);
			await route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({
					code: 'INVALID_CREDENTIALS',
					message: 'Invalid email or password.',
				}),
			});
			return;
		}

		if (loginMode === 'success') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					token: 'mock-local-token',
					user: {
						userId: 10,
						role: 'officer',
						authSource: 'local',
					},
				}),
			});
			return;
		}

		await route.fallback();
	});

	return {
		getLoginCount: () => loginCount,
	};
}

async function assertStaticParityContent(page) {
	await page.waitForSelector('[data-testid="atlas-login-page"]');
	const mustHaveText = [
		'Welcome Back',
		'Remember me',
		'Forgot password?',
		'Or continue with',
		'ATLAS Scheduling System',
		'Terms',
		'Privacy Policy',
		'Preference Collection',
		'Automated Generation',
		'Review and Publish Workflow',
	];

	for (const text of mustHaveText) {
		const locator = page.getByText(text, { exact: false }).first();
		if ((await locator.count()) < 1) {
			throw new Error(`Missing required parity text: ${text}`);
		}
	}
}

async function run() {
	await rm(SCREENSHOT_DIR, { recursive: true, force: true });
	await mkdir(SCREENSHOT_DIR, { recursive: true });

	const devServer = startClientServer();
	let browser;

	try {
		await waitForServer(`${BASE_URL}/login`);
		browser = await chromium.launch({ headless: true });

		{
			const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
			registerRoutes(page, { loginMode: 'idle', accent: '18 88% 46%' });
			await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
			await assertStaticParityContent(page);
			await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-empty-form.png'), fullPage: true });
		}

		{
			const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
			registerRoutes(page, { loginMode: 'invalid', accent: '18 88% 46%' });
			await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
			await page.fill('[data-testid="login-email-input"]', 'officer@atlas.local');
			await page.fill('[data-testid="login-password-input"]', 'wrong-password');
			await page.click('[data-testid="login-submit-button"]');
			await page.waitForSelector('[data-testid="login-error-message"]');
			const errorText = await page.locator('[data-testid="login-error-message"]').innerText();
			if (!errorText.includes('Invalid email or password')) {
				throw new Error('Invalid-credential state does not show generic invalid-credential messaging.');
			}
			await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-invalid-credentials.png'), fullPage: true });
		}

		{
			const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
			registerRoutes(page, { loginMode: 'loading', accent: '18 88% 46%' });
			await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
			await page.fill('[data-testid="login-email-input"]', 'officer@atlas.local');
			await page.fill('[data-testid="login-password-input"]', 'wrong-password');
			await page.click('[data-testid="login-submit-button"]');
			await page.waitForSelector('text=Signing in...');
			await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-loading-submit.png'), fullPage: true });
		}

		{
			const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
			registerRoutes(page, { loginMode: 'idle', accent: '155 84% 36%' });
			await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
			const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
			if (accent !== '155 84% 36%') {
				throw new Error(`Configured accent was not applied. Expected "155 84% 36%", got "${accent}".`);
			}
			await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-configured-accent.png'), fullPage: true });
		}

		{
			const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
			registerRoutes(page, { loginMode: 'success', accent: '155 84% 36%', localAuthAfterLogin: true });
			await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
			await page.fill('[data-testid="login-email-input"]', 'officer@atlas.local');
			await page.fill('[data-testid="login-password-input"]', 'Atlas2026!');
			await page.click('[data-testid="login-submit-button"]');
			await page.waitForURL(`${BASE_URL}/`, { timeout: 5000 });
		}

		console.log('\nLogin UI parity checks passed. Screenshots saved at qa-artifacts/screenshots/login-parity/.');
	} finally {
		if (browser) {
			await browser.close();
		}

		devServer.kill();
	}
}

run().catch((error) => {
	console.error('\nLogin UI parity check failed:', error);
	process.exit(1);
});
