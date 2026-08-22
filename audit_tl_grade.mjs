import { chromium } from 'playwright';

(async () => {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    
    console.log('Navigating to login...');
    await page.goto('https://njgrm.buru-degree.ts.net/login');
    await page.fill('#identifier', '1234501');
    await page.fill('#password', 'DepEdSY2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('https://njgrm.buru-degree.ts.net/');
    
    console.log('Navigating to teaching load...');
    await page.goto('https://njgrm.buru-degree.ts.net/teaching-load');
    await page.waitForTimeout(5000); 

    console.log('Trying to click a faculty row to expand subjects...');
    try {
        const rows = await page.locator('div.border.border-border\\/40.bg-background.shadow-sm').all();
        if (rows.length > 0) {
            await rows[0].click();
            await page.waitForTimeout(2000);

            console.log('Expanding a grade level...');
            await page.click('text="GR7"');
            await page.waitForTimeout(2000);
            
            await page.screenshot({ path: 'audit_tl_grade_expanded.png', fullPage: true });
        }
    } catch (e) {
        console.error("Could not interact with rows:", e);
    }

    console.log('Done!');
    await browser.close();
})();
