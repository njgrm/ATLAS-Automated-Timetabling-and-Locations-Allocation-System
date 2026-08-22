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

    try {
        console.log('Clicking first faculty row...');
        const rows = await page.locator('div.border.border-border\\/40.bg-background.shadow-sm').all();
        if (rows.length > 0) {
            await rows[0].click();
            await page.waitForTimeout(2000);

            console.log('Expanding GR7...');
            await page.click('text="GR7"');
            await page.waitForTimeout(2000);

            console.log('Clicking the first swap button...');
            const swapButtons = await page.locator('button.h-6.w-6.text-primary.border-primary\\/30').all();
            if (swapButtons.length > 0) {
                await swapButtons[0].click();
                await page.waitForTimeout(1000);
                
                // Click "Transfer" inside the modal
                console.log('Clicking Transfer in modal...');
                await page.click('button:has-text("Transfer")');
                await page.waitForTimeout(2000);

                await page.screenshot({ path: 'audit_tl_after_transfer.png', fullPage: true });

                console.log('Selecting the donor teacher to see if they got anything back...');
                // We'll just exit here for now.
            } else {
                console.log('No swap buttons found.');
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }

    console.log('Done!');
    await browser.close();
})();
