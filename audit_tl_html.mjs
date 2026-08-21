import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    
    await page.goto('https://njgrm.buru-degree.ts.net/login');
    await page.fill('#identifier', '1234501');
    await page.fill('#password', 'DepEdSY2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('https://njgrm.buru-degree.ts.net/');
    
    await page.goto('https://njgrm.buru-degree.ts.net/teaching-load');
    await page.waitForTimeout(5000); 
    
    const html = await page.content();
    fs.writeFileSync('audit_tl.html', html);
    
    await browser.close();
})();
