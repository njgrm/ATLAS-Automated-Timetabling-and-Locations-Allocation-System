const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const outputDir = 'C:/Users/njgro/.gemini/antigravity-ide/brain/243a4c25-efae-4744-8a9a-9e3282b4f9e8/scratch';
    const report = {
        setup: "Playwright Chromium (Tailnet)",
        viewports: ['1440x900', '900x900', '390x844'],
        routes_tested: ['/login', '/timetable'],
        errors: [],
        findings: {},
        consoleLogs: [],
        networkErrors: []
    };

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            report.consoleLogs.push({ type: msg.type(), text: msg.text() });
        }
    });

    page.on('requestfailed', request => {
        report.networkErrors.push({ url: request.url(), error: request.failure().errorText });
    });

    const baseUrl = 'https://njgrm.buru-degree.ts.net';
    
    try {
        console.log(`Using ${baseUrl}/login...`);
        const response = await page.goto(`${baseUrl}/login`, { waitUntil: 'load', timeout: 30000 });
        if (!response || !response.ok()) {
            throw new Error(`Failed to load ${baseUrl}/login. Status: ${response ? response.status() : 'No response'}`);
        }
    } catch (e) {
        console.log("Could not reach Tailnet:", e.message);
        report.errors.push("Could not reach Tailnet: " + e.message);
        fs.writeFileSync(path.join(outputDir, 'timetable_report.json'), JSON.stringify(report, null, 2));
        await browser.close();
        return;
    }

    try {
        // Login
        console.log('Logging in...');
        await page.waitForTimeout(2000); 
        
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
        await page.waitForTimeout(10000);

        console.log('Checking Desktop (1440x900)...');
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.screenshot({ path: path.join(outputDir, 'timetable_tailnet_1440x900.png') });
        
        let overflow1440 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        report.findings['1440x900'] = { overflow: overflow1440 };

        report.dom_analysis = await page.evaluate(() => {
            return {
                buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean),
                links: Array.from(document.querySelectorAll('a')).map(a => a.innerText.trim()).filter(Boolean),
                headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.innerText.trim()).filter(Boolean),
                spans: Array.from(document.querySelectorAll('span')).map(s => s.innerText.trim()).filter(t => t.length > 0 && t.length < 50),
                tabs: Array.from(document.querySelectorAll('[role="tab"]')).map(t => t.innerText.trim()),
                cards: Array.from(document.querySelectorAll('.rounded-xl, .card')).map(c => c.innerText.trim().substring(0, 100))
            };
        });

        report.ux_checks = await page.evaluate(() => {
            const textContent = document.body.innerText;
            const hasText = (t) => textContent.includes(t);
            const moreBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => b.innerText.trim() === 'More' || (b.getAttribute('aria-label') && b.getAttribute('aria-label').includes('More')));
            return {
                hasMoreMenu: !!moreBtn,
                hasRefresh: hasText('Refresh'),
                hasPublish: hasText('Publish'),
                hasNeedsAttention: hasText('Needs attention'),
                hasViolations: hasText('Violations'),
                hasUnassigned: hasText('Unassigned'),
                hasRequests: hasText('Requests'),
                hasOldLabels: {
                    recoveryTools: hasText('Recovery Tools'),
                    workflow: hasText('Workflow'),
                    classProgramMatrix: hasText('Class Program Matrix'),
                    inputStatusUnavailable: hasText('Input status unavailable'),
                    staleRunData: hasText('stale run data')
                }
            };
        });

        // Attempt to interact with More menu using Playwright selectors
        console.log('Attempting to open More menu...');
        const moreButtons = await page.$$('button:has-text("More"), [aria-label*="More"]');
        if (moreButtons.length > 0) {
            await moreButtons[0].click({ timeout: 2000 }).catch(() => console.log('Could not click More button.'));
            await page.waitForTimeout(1000);
            report.moreMenuContents = await page.evaluate(() => {
                const menuItems = document.querySelectorAll('[role="menuitem"]');
                return Array.from(menuItems).map(m => m.innerText.trim());
            });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        }

        // Click a class block
        const classBlocks = await page.$$('td > div.cursor-pointer, div.cursor-pointer:has-text("Grade"), div.cursor-pointer:has-text("Section")');
        let dockAppeared = false;
        if (classBlocks.length > 0) {
            console.log('Clicking a class block to see if dock appears...');
            try {
                for(let b of classBlocks) {
                    const box = await b.boundingBox();
                    if (box && box.width > 20 && box.height > 20) {
                        await b.click({ timeout: 2000 });
                        await page.waitForTimeout(2000);
                        
                        const dockText = await page.evaluate(() => {
                            const docks = Array.from(document.querySelectorAll('div, form, dialog, section')).filter(el => {
                                const t = el.innerText || '';
                                return t.includes('Teaching Load') || t.includes('Preview impact') || t.includes('Create timetable revision') || t.includes('Save Teaching Load');
                            });
                            docks.sort((a,b) => (b.innerText||'').length - (a.innerText||'').length);
                            return docks.length > 0 ? docks[0].innerText.substring(0, 500) : null;
                        });
                        if (dockText) {
                            dockAppeared = true;
                            report.dockText = dockText;
                            await page.screenshot({ path: path.join(outputDir, 'timetable_tailnet_1440x900_dock.png') });
                        }
                        break;
                    }
                }
            } catch(e) {
                console.log("Failed to click block:", e.message);
            }
        }
        report.findings.dock_appeared = dockAppeared;

        console.log('Checking Narrow Desktop (900x900)...');
        await page.setViewportSize({ width: 900, height: 900 });
        await page.waitForTimeout(2000);
        let overflow900 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        report.findings['900x900'] = { overflow: overflow900 };
        await page.screenshot({ path: path.join(outputDir, 'timetable_tailnet_900x900.png') });

        console.log('Checking Mobile (390x844)...');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(2000);
        let overflow390 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        report.findings['390x844'] = { overflow: overflow390 };
        await page.screenshot({ path: path.join(outputDir, 'timetable_tailnet_390x844.png') });

    } catch (e) {
        console.log(e);
        report.errors.push(e.stack);
    } finally {
        await browser.close();
    }

    fs.writeFileSync(path.join(outputDir, 'timetable_report.json'), JSON.stringify(report, null, 2));
    console.log("Done. Report saved to timetable_report.json.");
})();
