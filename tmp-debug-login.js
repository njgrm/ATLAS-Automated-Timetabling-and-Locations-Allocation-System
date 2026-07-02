const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('response', async res => {
        const url = res.url();
        if (url.includes('/api/')) {
            console.log(`[API Response] ${res.status()} ${url}`);
            if (res.status() >= 400) {
                try {
                    const text = await res.text();
                    console.log(`[API Error Body] ${text}`);
                } catch(e){}
            }
        }
    });

    try {
        await page.goto('http://127.0.0.1:5174/login', { waitUntil: 'load' });
        await page.waitForTimeout(2000);
        
        await page.getByPlaceholder('Employee ID or Email').fill('1000001');
        await page.getByPlaceholder('Enter your password').fill('AdminSY2026!');
        await page.getByRole('button', { name: /Sign In/i }).click();
        
        await page.waitForTimeout(5000);
    } catch(e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
