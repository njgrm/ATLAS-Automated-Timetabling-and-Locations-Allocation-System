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
    
    // 1. Generate button
    console.log('Clicking Generate...');
    try {
        await page.click('button:has-text("Generate")');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'audit_generate.png', fullPage: true });
        
        // Try to close generate if it's a dialog
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
    } catch (e) {
        console.error("Couldn't test Generate:", e);
    }

    // 2. More button
    console.log('Clicking More...');
    try {
        await page.click('button:has-text("More")');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'audit_more.png', fullPage: true });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
    } catch (e) {
        console.error("Couldn't test More:", e);
    }
    
    // 3. Find a class card and try to right click or click on its menu
    console.log('Testing class card interaction...');
    try {
        // Find the first occupied class card (not empty space)
        const classCard = page.locator('div[data-timetable-entry="true"]').first();
        if (await classCard.isVisible()) {
            // Hover it
            await classCard.hover();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'audit_hover_card.png', fullPage: true });
            
            // Click it
            await classCard.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'audit_click_card.png', fullPage: true });
            
            // Close dialog
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
        } else {
            console.log("No class cards found.");
        }
    } catch (e) {
        console.error("Couldn't interact with class card:", e);
    }
    
    console.log('Done!');
    await browser.close();
})();
