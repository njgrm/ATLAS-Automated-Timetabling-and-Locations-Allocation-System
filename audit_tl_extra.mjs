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

    console.log('Opening Staffing Audit...');
    try {
        await page.click('button:has-text("Review saved coverage")'); // or the actual button text
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'audit_tl_staffing_audit.png', fullPage: true });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
    } catch (e) {
        console.error("Could not open Staffing Audit:", e);
    }

    console.log('Opening Suggest Teaching Load Draft (AutoFill)...');
    try {
        await page.click('button:has-text("SUGGEST")');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'audit_tl_autofill.png', fullPage: true });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
    } catch (e) {
        console.error("Could not open AutoFill Modal:", e);
    }

    console.log('Switching to Section View...');
    try {
        await page.click('button[aria-label="More Teaching Load tools"]');
        await page.waitForTimeout(500);
        await page.click('text="Section view"');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'audit_tl_section_view.png', fullPage: true });
    } catch (e) {
        console.error("Could not switch to Section View:", e);
    }

    console.log('Done!');
    await browser.close();
})();
