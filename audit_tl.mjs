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
    
    console.log('Taking full page screenshot...');
    await page.screenshot({ path: 'audit_tl_main.png', fullPage: true });

    console.log('Trying to find an assignment block or cell to click...');
    try {
        // Just click the first subject or assignment button we can find
        const cell = page.locator('button').filter({ hasText: 'Assign' }).first();
        if (await cell.isVisible()) {
            await cell.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'audit_tl_assign_clicked.png', fullPage: true });
            await page.keyboard.press('Escape');
        } else {
            console.log('No "Assign" buttons found, looking for an existing assignment to click...');
            const assignment = page.locator('div[role="button"]').first();
            if (await assignment.isVisible()) {
                await assignment.click();
                await page.waitForTimeout(2000);
                await page.screenshot({ path: 'audit_tl_assignment_clicked.png', fullPage: true });
                await page.keyboard.press('Escape');
            }
        }
    } catch (e) {
        console.error(e);
    }

    console.log('Trying to click a faculty row...');
    try {
        // Try clicking a teacher's name or row
        const row = page.locator('tr').nth(1);
        if (await row.isVisible()) {
            await row.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'audit_tl_row_clicked.png', fullPage: true });
        }
    } catch (e) {
        console.error(e);
    }
    
    console.log('Done!');
    await browser.close();
})();
