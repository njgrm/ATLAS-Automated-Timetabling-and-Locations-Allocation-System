const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const report = {};
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    let baseUrl = 'https://njgrm.buru-degree.ts.net';
    await page.goto(`${baseUrl}/login`);
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('Employee ID or Email').fill('1000001');
    await page.getByPlaceholder('Enter your password').fill('AdminSY2026!');
    await page.getByRole('button', { name: /Sign In/i }).click();
    
    await page.waitForTimeout(5000); // just wait instead of exact url match
    await page.evaluate(() => localStorage.setItem('atlas_timetable_tour', 'true'));
    await page.goto(`${baseUrl}/timetable`);
    await page.waitForTimeout(10000); // wait for data to load

    // Get violations
    report.violation_samples = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.split('\n').filter(line => line.includes('prefers') || line.includes('contract') || line.includes('Entry')).slice(0, 10);
    });

    // Test mouse click
    report.dock_mouse = false;
    const classBlocks = await page.$$('[aria-label^="Select "]');
    report.classBlocksCount = classBlocks.length;
    
    if (classBlocks.length > 0) {
        await classBlocks[0].click();
        await page.waitForTimeout(2000);
        report.dock_mouse_text = await page.evaluate(() => {
            const d = Array.from(document.querySelectorAll('div, form, dialog, section')).find(el => {
                const t = el.innerText || '';
                return t.includes('Teaching Load') || t.includes('Create timetable revision') || t.includes('Save Teaching Load');
            });
            return d ? d.innerText.substring(0, 200) : null;
        });
        report.dock_mouse = !!report.dock_mouse_text;
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
    }

    // Test keyboard
    report.dock_keyboard = false;
    if (classBlocks.length > 1) {
        await classBlocks[1].focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        report.dock_keyboard_text = await page.evaluate(() => {
            const d = Array.from(document.querySelectorAll('div, form, dialog, section')).find(el => {
                const t = el.innerText || '';
                return t.includes('Teaching Load') || t.includes('Create timetable revision') || t.includes('Save Teaching Load');
            });
            return d ? d.innerText.substring(0, 200) : null;
        });
        report.dock_keyboard = !!report.dock_keyboard_text;
    }

    fs.writeFileSync('C:/Users/njgro/.gemini/antigravity-ide/brain/243a4c25-efae-4744-8a9a-9e3282b4f9e8/scratch/qa_click_test.json', JSON.stringify(report, null, 2));
    await browser.close();
})();
