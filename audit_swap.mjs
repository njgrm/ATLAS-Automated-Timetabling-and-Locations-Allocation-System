import { chromium } from 'playwright';

(async () => {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    
    console.log('Navigating to timetable...');
    await page.goto('https://njgrm.buru-degree.ts.net/login');
    await page.fill('#identifier', '1234501');
    await page.fill('#password', 'DepEdSY2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('https://njgrm.buru-degree.ts.net/');
    await page.goto('https://njgrm.buru-degree.ts.net/timetable');
    await page.waitForTimeout(4000); 
    
    console.log('Testing swap flow...');
    try {
        const cards = page.locator('div[data-timetable-entry="true"]');
        if (await cards.count() >= 2) {
            console.log('Clicking first card...');
            await cards.nth(0).click();
            await page.waitForTimeout(1000);
            
            console.log('Clicking second card...');
            await cards.nth(1).click();
            await page.waitForTimeout(2000);
            
            await page.screenshot({ path: 'audit_swap_dialog.png', fullPage: true });
        } else {
            console.log("Not enough class cards found to test swap.");
        }
    } catch (e) {
        console.error("Couldn't test swap:", e);
    }
    
    console.log('Testing right sidebar / review issues...');
    try {
        // Find review issues in more menu
        await page.click('button:has-text("More")');
        await page.waitForTimeout(500);
        await page.click('text="Review issues"');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'audit_review_issues.png', fullPage: true });
    } catch (e) {
        console.error("Couldn't test review issues:", e);
    }
    
    console.log('Done!');
    await browser.close();
})();
