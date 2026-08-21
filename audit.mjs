import { chromium } from 'playwright';

(async () => {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    
    console.log('Navigating to login...');
    await page.goto('https://njgrm.buru-degree.ts.net/login');
    
    console.log('Logging in...');
    await page.fill('#identifier', '1234501');
    await page.fill('#password', 'DepEdSY2026!');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for navigation...');
    await page.waitForURL('https://njgrm.buru-degree.ts.net/');
    
    console.log('Navigating to timetable...');
    await page.goto('https://njgrm.buru-degree.ts.net/timetable');
    
    console.log('Waiting for timetable to load...');
    await page.waitForTimeout(5000); 
    
    console.log('Clicking Start placing...');
    try {
        await page.click('button:has-text("Start placing")');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'timetable_placing.png', fullPage: true });
    } catch (e) {
        console.error("Couldn't click start placing:", e);
    }
    
    console.log('Clicking a class cell...');
    try {
        await page.locator('td[data-day] div[role="button"]').first().click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'timetable_cell_clicked.png', fullPage: true });
    } catch (e) {
        console.error("Couldn't click cell:", e);
    }
    
    console.log('Done!');
    await browser.close();
})();
