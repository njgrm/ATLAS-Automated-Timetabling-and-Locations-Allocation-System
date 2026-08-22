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
        console.log('Clicking first faculty row (Aguilar)...');
        const rows = await page.locator('div.border.border-border\\/40.bg-background.shadow-sm').all();
        if (rows.length > 0) {
            await rows[0].click();
            await page.waitForTimeout(2000);

            console.log('Expanding GR7...');
            await page.click('text="GR7"');
            await page.waitForTimeout(2000);

            console.log('Clicking the first swap button (Luna or Aguinaldo)...');
            const swapButtons = await page.locator('button.h-6.w-6.text-primary.border-primary\\/30').all();
            if (swapButtons.length > 0) {
                // Click it! This should now INSTANTLY swap.
                await swapButtons[0].click();
                await page.waitForTimeout(2000);

                await page.screenshot({ path: 'audit_tl_after_instant_swap.png', fullPage: true });

                console.log('Clicking Undo last...');
                await page.click('button:has-text("Undo last")');
                await page.waitForTimeout(2000);

                await page.screenshot({ path: 'audit_tl_after_undo.png', fullPage: true });

                console.log('Clicking Redo last...');
                // wait, is there a redo button? or do we press Ctrl+Y?
                // The UI doesn't have a Redo button, but we can send keyboard shortcut
                await page.keyboard.press('Control+Y');
                await page.waitForTimeout(2000);

                await page.screenshot({ path: 'audit_tl_after_redo.png', fullPage: true });

                console.log('Clicking Discard draft...');
                await page.click('button:has-text("Discard draft")');
                await page.waitForTimeout(1000);
                await page.click('button:has-text("Discard all")');
                await page.waitForTimeout(2000);

                await page.screenshot({ path: 'audit_tl_after_discard.png', fullPage: true });
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
