const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const outputDir = 'C:/Users/njgro/.gemini/antigravity-ide/brain/243a4c25-efae-4744-8a9a-9e3282b4f9e8/scratch';
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const baseUrl = 'http://localhost:5174';
    await page.goto(`${baseUrl}/login`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await page.getByPlaceholder('Employee ID or Email').fill('1000001');
    await page.getByPlaceholder('Enter your password').fill('AdminSY2026!');
    await page.getByRole('button', { name: /Sign In/i }).click();
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outputDir, 'login_error.png') });

    await browser.close();
    console.log('Done screenshotting login failure');
})();
