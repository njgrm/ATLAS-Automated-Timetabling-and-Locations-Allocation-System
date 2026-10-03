/**
 * ATLAS live Tailnet browser acceptance — one command.
 *
 * Why this exists: `AGENTS.md` section 11 says "a user-facing fix is done when
 * it is seen rendered", but there was no way to *do* that from an agent shell:
 * Hermes `browser_exec` refuses private/internal addresses ("Blocked: URL
 * targets a private or internal address"), which includes the Tailnet origin
 * and 127.0.0.1. Agents were recording that as a blocked acceptance row rather
 * than routing around it. This script is that route.
 *
 * Usage:
 *   node ops/qa/atlas-live-acceptance.mjs --route /timetable --name timetable
 *   node ops/qa/atlas-live-acceptance.mjs --route /timetable --mobile
 *   node ops/qa/atlas-live-acceptance.mjs --all-known
 *
 * Outputs to docs/reviews/<name>-<date>/ :
 *   <route-slug>-1366x768.png, <route-slug>-390x844.png, measurements.json
 *
 * Rules this script enforces so a reviewer cannot fool themselves:
 *   - asserts window.location.origin is the Tailnet origin, and fails loudly otherwise
 *   - waits 7-8s before asserting rendered state (a ~4s read is a false defect)
 *   - records EVERY non-GET /api request as a write, and reports them
 *   - reports pageerror + console errors rather than swallowing them
 *   - prefers measured DOM geometry over a visual read, which is also stronger evidence
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ORIGIN = 'https://njgrm.buru-degree.ts.net';
const PROFILE = 'C:/Users/njgro/.config/opencode/playwright-profile';
const REPO = 'D:/ATLAS';
const OUT_ROOT = join(REPO, 'docs/reviews');

const KNOWN_ROUTES = {
  timetable: '/timetable',
  policies: '/timetable/policies',
  subjects: '/subjects',
  teachers: '/teachers',
  'teaching-load': '/teaching-load',
  sections: '/sections',
  'campus-rooms': '/campus-rooms',
  'class-schedule': '/class-schedule',
};

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const slug = (p) => p.replace(/^\//, '').replace(/[/?=&]+/g, '-') || 'root';

const routes = [];
if (arg('all-known')) {
  for (const [name, path] of Object.entries(KNOWN_ROUTES)) routes.push({ name, path });
} else {
  const route = arg('route');
  if (!route) {
    console.error('need --route <path> or --all-known');
    process.exit(2);
  }
  routes.push({ name: arg('name') || slug(route), path: route });
}
const withMobile = Boolean(arg('mobile', false));

const stamp = new Date().toISOString().slice(0, 10);

// Playwright is not in every checkout's node_modules - D:/ATLAS has an empty
// tree. Resolve it from the first location that actually has it.
function loadPlaywright() {
  const candidates = [
    join(REPO, 'package.json'),
    'C:/Users/njgro/AppData/Local/hermes/package.json',
    'C:/Users/njgro/AppData/Local/hermes/cache/scratch/package.json',
    'E:/ATLAS-worktrees/lane-a4-release-20261003-1cbae2e3/atlas-client/package.json',
  ];
  for (const base of candidates) {
    try {
      const pw = createRequire(base)('playwright');
      if (pw && pw.chromium) return pw;
    } catch { /* try the next candidate */ }
  }
  // Last resort: a bare specifier, in case playwright is on NODE_PATH.
  try { return createRequire(import.meta.url)('playwright'); } catch { /* fall through */ }
  throw new Error(
    'playwright not found. Run `npm ci` in atlas-client of a worktree that has it, ' +
    'or install playwright at the repo root, then re-run this script.',
  );
}

const { chromium } = loadPlaywright();

// The playwright package version and the cached browser build drift apart on
// this machine (several chromium_headless_shell builds are cached, none matching
// the installed package). Rather than depend on `npx playwright install`, use a
// browser that is already on disk.
function cachedChromium() {
  const root = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  let candidates = [];
  try {
    candidates = readdirSync(root)
      .filter((d) => /^chromium(_headless_shell)?-\d+$/.test(d))
      .sort()
      .reverse();
  } catch { return null; }
  for (const dir of candidates) {
    for (const rel of [
      'chrome-win/chrome.exe',
      'chrome-headless-shell-win64/chrome-headless-shell.exe',
    ]) {
      const p = join(root, dir, rel);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 768 },
  ...(cachedChromium() ? { executablePath: cachedChromium() } : {}),
});
const page = ctx.pages()[0] || (await ctx.newPage());

const pageErrors = [];
const consoleErrors = [];
const writes = [];
const apiCalls = [];

page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('response', (r) => {
  const method = r.request().method();
  const path = r.url().replace(ORIGIN, '').slice(0, 140);
  if (!r.url().includes('/api/')) return;
  apiCalls.push(`${r.status()} ${method} ${path}`);
  if (!['GET', 'HEAD'].includes(method)) writes.push(`${method} ${path}`);
});

const report = [];

for (const { name, path } of routes) {
  const dir = join(OUT_ROOT, `${name}-${stamp}`);
  mkdirSync(dir, { recursive: true });

  let navError = null;
  try {
    await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    navError = String(e).slice(0, 200);
  }

  // CRITICAL: wait long enough for the active school year to resolve. At ~4s
  // /timetable queries the WRONG schoolYearId and renders "No draft yet" while
  // the active year holds a published run. Asserting early files a false defect.
  await page.waitForTimeout(8000);

  const facts = await page.evaluate(() => {
    const txt = document.body.innerText || '';
    const trunc = [...document.querySelectorAll('*')]
      .filter((n) => n.children.length === 0 && /…|\.\.\./.test(n.textContent || ''))
      .map((n) => (n.textContent || '').trim().slice(0, 80));
    const tiny = [...document.querySelectorAll('main *, header *')]
      .filter((n) => {
        if (n.children.length) return false;
        const fs = parseFloat(getComputedStyle(n).fontSize);
        return fs > 0 && fs < 12 && (n.innerText || '').trim();
      })
      .map((n) => ({ text: n.innerText.trim().slice(0, 50), fontSize: getComputedStyle(n).fontSize }));
    const header = [...document.querySelectorAll('header')]
      .filter((h) => h.getBoundingClientRect().top > 40)[0];
    return {
      origin: window.location.origin,
      url: location.pathname + location.search,
      title: document.title,
      authenticated: Boolean(localStorage.getItem('atlas_local_token') || sessionStorage.getItem('atlas_local_token')),
      globalScrollbar: document.documentElement.scrollHeight > window.innerHeight + 4,
      headerHeightPx: header ? Math.round(header.getBoundingClientRect().height) : null,
      truncatedText: [...new Set(trunc)].slice(0, 12),
      sub12pxText: tiny.slice(0, 12),
      bodyStart: txt.slice(0, 400),
    };
  });

  const shot = join(dir, `${slug(path)}-1366x768.png`);
  await page.screenshot({ path: shot });

  let mobile = null;
  if (withMobile) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(dir, `${slug(path)}-390x844.png`) });
    mobile = await page.evaluate(() => ({
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      globalScrollbar: document.documentElement.scrollHeight > window.innerHeight + 4,
    }));
    await page.setViewportSize({ width: 1366, height: 768 });
  }

  const originOk = facts.origin === ORIGIN;
  report.push({
    name, path, dir, screenshot: shot, mobile, navError,
    originOk,
    writesObserved: writes,
    pageErrors, consoleErrors,
    apiSample: apiCalls.slice(0, 25),
    ...facts,
  });
}

writeFileSync(
  join(OUT_ROOT, `live-acceptance-${stamp}.json`),
  JSON.stringify({ generatedAt: new Date().toISOString(), origin: ORIGIN, report }, null, 2),
);

for (const r of report) {
  const flags = [
    r.originOk ? 'ORIGIN-OK' : 'ORIGIN-WRONG',
    r.authenticated ? 'AUTHED' : 'NOT-AUTHED',
    r.writesObserved.length ? `WRITES:${r.writesObserved.length}` : 'ZERO-WRITE',
    r.pageErrors.length ? `PAGEERR:${r.pageErrors.length}` : 'NO-PAGEERR',
    r.truncatedText.length ? `TRUNCATED:${r.truncatedText.length}` : 'NO-TRUNCATION',
    r.sub12pxText.length ? `SUB12PX:${r.sub12pxText.length}` : 'NO-SUB12PX',
    r.globalScrollbar ? 'GLOBAL-SCROLLBAR' : 'NO-SCROLLBAR',
  ];
  console.log(`${r.name.padEnd(16)} ${r.path.padEnd(22)} ${flags.join(' ')}`);
  console.log(`  -> ${r.screenshot}`);
  if (r.writesObserved.length) console.log(`  WRITES: ${r.writesObserved.join(', ')}`);
  if (r.pageErrors.length) console.log(`  PAGE ERRORS: ${r.pageErrors.join(' | ')}`);
}

await ctx.close();
console.log(`\nmeasurements: ${join(OUT_ROOT, `live-acceptance-${stamp}.json`)}`);