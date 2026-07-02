const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const outputDir = 'C:/Users/njgro/.gemini/antigravity-ide/brain/243a4c25-efae-4744-8a9a-9e3282b4f9e8/scratch';
    const report = {
        setup: "Playwright Chromium QA",
        target: "",
        serviceWorkers: "enabled",
        viewports: ['1440x900', '900x900', '390x844'],
        routes_tested: ['/login', '/timetable'],
        errors: [],
        findings: {},
        consoleLogs: [],
        networkErrors: []
    };

    let browser;
    let context;
    let page;

    async function setupBrowser(swState) {
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: swState });
        page = await context.newPage();
        
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                report.consoleLogs.push({ type: msg.type(), text: msg.text() });
            }
        });

        page.on('requestfailed', request => {
            report.networkErrors.push({ url: request.url(), error: request.failure().errorText });
        });
    }

    let baseUrl = 'https://njgrm.buru-degree.ts.net';
    let isFallback = false;

    await setupBrowser('allow');

    try {
        console.log(`Trying primary Tailnet URL: ${baseUrl}...`);
        const response = await page.goto(`${baseUrl}/login`, { waitUntil: 'load', timeout: 30000 });
        if (!response || !response.ok()) {
            throw new Error(`Failed to load Tailnet. Status: ${response ? response.status() : 'No response'}`);
        }
        report.target = baseUrl;
        report.serviceWorkers = "enabled";
    } catch (e) {
        console.log("Tailnet failed, falling back to local dev with SW blocked:", e.message);
        await browser.close();
        isFallback = true;
        baseUrl = 'http://localhost:5176';
        report.target = baseUrl;
        report.serviceWorkers = "blocked";
        await setupBrowser('block');
        
        const response = await page.goto(`${baseUrl}/login`, { waitUntil: 'load', timeout: 30000 }).catch(err => {
            report.errors.push("Could not reach local dev server: " + err.message);
        });
        if (!response || !response.ok()) {
            report.errors.push(`Failed to load fallback ${baseUrl}/login.`);
            fs.writeFileSync(path.join(outputDir, 'qa_report.json'), JSON.stringify(report, null, 2));
            await browser.close();
            return;
        }
    }

    try {
        console.log('Logging in...');
        await page.waitForTimeout(2000); // Let the form render
        
        await page.getByPlaceholder('Employee ID or Email').fill('1000001');
        await page.getByPlaceholder('Enter your password').fill('AdminSY2026!');
        await page.getByRole('button', { name: /Sign In/i }).click();
        
        console.log('Wait for dashboard redirection...');
        await page.waitForURL('**/dashboard*', { timeout: 15000 }).catch(() => console.log('Did not redirect to dashboard immediately.'));
        await page.waitForTimeout(3000);

        await page.evaluate(() => {
            localStorage.setItem('atlas_timetable_tour', 'true');
        });

        console.log('Navigating to /timetable...');
        await page.goto(`${baseUrl}/timetable`, { waitUntil: 'load', timeout: 30000 });

        // Wait for schedule content to load
        console.log('Waiting 10s for timetable data to load...');
        await page.waitForTimeout(10000);

        console.log('Checking Desktop (1440x900)...');
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.screenshot({ path: path.join(outputDir, 'qa_1440x900.png') });
        
        let overflow1440 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        report.findings['1440x900_overflow'] = overflow1440;

        // 1. Check Header Buttons
        report.findings.header_buttons = await page.evaluate(() => {
            const header = document.querySelector('header') || document.querySelector('.sticky.top-0');
            if (!header) return [];
            return Array.from(header.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
        });

        // 2. Refresh Discoverability
        report.findings.has_refresh_text = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('*')).some(el => 
                el.childNodes.length === 1 && 
                el.childNodes[0].nodeType === 3 && 
                el.childNodes[0].textContent.includes('Refresh schedule')
            );
        });

        // 3. More Menu content
        console.log('Opening More menu...');
        const moreButtons = await page.$$('button:has-text("More"), [aria-label*="More"]');
        if (moreButtons.length > 0) {
            await moreButtons[0].click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(1000);
            report.findings.more_menu_items = await page.evaluate(() => {
                const menuItems = document.querySelectorAll('[role="menuitem"]');
                return Array.from(menuItems).map(m => m.innerText.trim());
            });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        }

        // 4. Violation Copy Check
        report.findings.violation_samples = await page.evaluate(() => {
            const lists = Array.from(document.querySelectorAll('ul, ol, [role="list"]'));
            let violations = [];
            for (let list of lists) {
                const items = Array.from(list.querySelectorAll('li, [role="listitem"]')).map(el => el.innerText.trim());
                if (items.some(t => t.includes('prefers') || t.includes('contract'))) {
                    violations = violations.concat(items);
                }
            }
            return violations.slice(0, 10);
        });

        report.findings.has_show_more = await page.evaluate(() => {
            return !!Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('show more'));
        });

        report.findings.has_internal_ids = report.findings.violation_samples.some(v => 
            v.includes('Entry entry-') || 
            v.includes('subject ') || 
            v.includes('section ') || 
            v.includes('room ') || 
            v.includes('faculty ')
        );

        // 5. Accessible labels on class blocks
        report.findings.class_block_aria = await page.evaluate(() => {
            const blocks = Array.from(document.querySelectorAll('td > div, [role="button"], button'));
            return blocks
                .filter(b => b.innerText && b.innerText.includes('G') && b.innerText.length < 50)
                .map(b => b.getAttribute('aria-label'))
                .filter(Boolean)
                .slice(0, 5);
        });

        // 6. Click on class block (Mouse)
        const classBlocks = await page.$$('td > div[tabindex], td > button, td > div.cursor-pointer, [role="gridcell"] > div');
        report.findings.dock_appeared_mouse = false;
        
        if (classBlocks.length > 0) {
            console.log('Clicking class block...');
            await classBlocks[0].click({ force: true, timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(2000);
            
            const dockText = await page.evaluate(() => {
                const d = Array.from(document.querySelectorAll('div, form, dialog, section')).find(el => {
                    const t = el.innerText || '';
                    return t.includes('Teaching Load') || t.includes('Preview impact') || t.includes('Create timetable revision') || t.includes('Save Teaching Load');
                });
                return d ? d.innerText.substring(0, 200) : null;
            });
            
            if (dockText) {
                report.findings.dock_appeared_mouse = true;
                report.findings.dock_text_mouse = dockText;
                await page.keyboard.press('Escape'); // close it
                await page.waitForTimeout(1000);
            }
        }

        // 7. Keyboard focus + Enter
        if (classBlocks.length > 0) {
            console.log('Testing keyboard enter on class block...');
            await classBlocks[0].focus().catch(() => {});
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);
            
            const dockText = await page.evaluate(() => {
                const d = Array.from(document.querySelectorAll('div, form, dialog, section')).find(el => {
                    const t = el.innerText || '';
                    return t.includes('Teaching Load') || t.includes('Preview impact') || t.includes('Create timetable revision') || t.includes('Save Teaching Load');
                });
                return d ? d.innerText.substring(0, 200) : null;
            });

            if (dockText) {
                report.findings.dock_appeared_keyboard = true;
                report.findings.dock_text_keyboard = dockText;
                await page.keyboard.press('Escape'); // close it
            }
        }

        // Check Narrow & Mobile
        console.log('Checking Narrow Desktop (900x900)...');
        await page.setViewportSize({ width: 900, height: 900 });
        await page.waitForTimeout(1000);
        report.findings['900x900_overflow'] = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        await page.screenshot({ path: path.join(outputDir, 'qa_900x900.png') });

        console.log('Checking Mobile (390x844)...');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(1000);
        report.findings['390x844_overflow'] = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        await page.screenshot({ path: path.join(outputDir, 'qa_390x844.png') });

    } catch (e) {
        console.log(e);
        report.errors.push(e.stack);
    } finally {
        await browser.close();
    }

    fs.writeFileSync(path.join(outputDir, 'qa_report.json'), JSON.stringify(report, null, 2));
    console.log("QA test complete.");
})();
