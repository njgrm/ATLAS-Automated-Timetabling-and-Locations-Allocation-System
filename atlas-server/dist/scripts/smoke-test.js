/**
 * ATLAS Local Smoke Test
 *
 * Hits all critical endpoints and reports status.
 * Usage:  cd atlas-server && npx tsx src/scripts/smoke-test.ts
 *
 * Requires:
 *   - Server running on http://localhost:5001
 *   - Valid JWT_SECRET in .env (generates a test token locally)
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';
const BASE = process.env.ATLAS_BASE_URL ?? 'http://localhost:5001';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET not set in .env — cannot generate auth token.');
    process.exit(1);
}
// Generate a short-lived officer token for auth-protected routes
const token = jwt.sign({ userId: 1, role: 'officer' }, JWT_SECRET, { expiresIn: '5m' });
const tests = [
    {
        name: 'Health',
        url: '/api/v1/health',
        auth: false,
        expectStatus: 200,
        expectShape: (b) => {
            const r = b;
            return r.status === 'ok' ? null : `Expected status "ok", got "${r.status}"`;
        },
    },
    {
        name: 'Buildings',
        url: '/api/v1/map/schools/1/buildings',
        auth: false,
        expectStatus: 200,
        expectShape: (b) => {
            const r = b;
            return Array.isArray(r.buildings) ? null : 'Expected { buildings: [...] }';
        },
    },
    {
        name: 'Campus image',
        url: '/api/v1/map/schools/1/campus-image',
        auth: false,
        expectStatus: 200,
    },
    {
        name: 'Subject stats',
        url: '/api/v1/subjects/stats/1',
        auth: false,
        expectStatus: 200,
        expectShape: (b) => {
            const r = b;
            return typeof r.count === 'number' ? null : 'Expected { count: number }';
        },
    },
    {
        name: 'Subjects list',
        url: '/api/v1/subjects?schoolId=1',
        auth: false,
        expectStatus: 200,
        expectShape: (b) => {
            const r = b;
            return Array.isArray(r.subjects) ? null : 'Expected { subjects: [...] }';
        },
    },
    {
        name: 'Faculty list (auth)',
        url: '/api/v1/faculty?schoolId=1',
        auth: true,
        expectStatus: 200,
        expectShape: (b) => {
            const r = b;
            return Array.isArray(r.faculty) ? null : 'Expected { faculty: [...] }';
        },
    },
    {
        name: 'Generation runs (auth)',
        url: '/api/v1/generation/1/1/runs?limit=20',
        auth: true,
        expectStatus: 200,
        expectShape: (b) => {
            const r = b;
            return Array.isArray(r.runs) ? null : 'Expected { runs: [...] }';
        },
    },
];
let passed = 0;
let failed = 0;
for (const t of tests) {
    const headers = { Accept: 'application/json' };
    if (t.auth)
        headers['Authorization'] = `Bearer ${token}`;
    try {
        const res = await fetch(`${BASE}${t.url}`, { headers });
        const status = res.status;
        if (status !== t.expectStatus) {
            const body = await res.text().catch(() => '');
            console.log(`❌ ${t.name}: expected ${t.expectStatus}, got ${status}  ${body.substring(0, 120)}`);
            failed++;
            continue;
        }
        if (t.expectShape) {
            const body = await res.json();
            const err = t.expectShape(body);
            if (err) {
                console.log(`❌ ${t.name}: ${status} but shape mismatch — ${err}`);
                failed++;
                continue;
            }
        }
        console.log(`✅ ${t.name}: ${status}`);
        passed++;
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`❌ ${t.name}: fetch error — ${msg}`);
        failed++;
    }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests.`);
process.exit(failed > 0 ? 1 : 0);
//# sourceMappingURL=smoke-test.js.map