import http from 'node:http';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
let passCount = 0;
let failCount = 0;
function section(name) {
    console.log(`\n═══ ${name} ═══`);
}
function assert(condition, label) {
    if (condition) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  ✗ ${label}`);
}
function assertEqual(actual, expected, label) {
    if (actual === expected) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
}
async function requestJson(baseUrl, path, options) {
    const response = await fetch(`${baseUrl}${path}`, options);
    let json = null;
    try {
        json = await response.json();
    }
    catch {
        json = null;
    }
    return { status: response.status, json };
}
async function run() {
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'atlas-local-auth-test-secret';
    }
    const preferredFacultyEmail = process.env.ATLAS_FACULTY_TEST_EMAIL ?? 'maria.santos@deped.edu.ph';
    const seededPassword = process.env.ATLAS_FACULTY_TEST_PASSWORD ??
        process.env.ATLAS_DEFAULT_AUTH_PASSWORD ??
        'DepEd2026!';
    const facultyAccount = (await prisma.atlasAuthAccount.findFirst({
        where: { role: 'faculty', isActive: true, email: preferredFacultyEmail },
    })) ??
        (await prisma.atlasAuthAccount.findFirst({
            where: { role: 'faculty', isActive: true },
            orderBy: { id: 'asc' },
        }));
    if (!facultyAccount) {
        console.error('\nNo seeded faculty local auth account found. Run realistic seed first.');
        process.exitCode = 1;
        return;
    }
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
        console.error('Unable to resolve ephemeral test server port.');
        server.close();
        process.exitCode = 1;
        return;
    }
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
    try {
        const login = await requestJson(baseUrl, '/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: facultyAccount.email, password: seededPassword }),
        });
        assertEqual(login.status, 200, 'Faculty login returns HTTP 200');
        const token = login.json?.token;
        assert(Boolean(token), 'Faculty login token exists');
        if (!token)
            return;
        section('MY-DASH-01 fallback disclaimer contract is present');
        const dashboard = await requestJson(baseUrl, '/faculty-portal/1/1/dashboard', {
            headers: { authorization: `Bearer ${token}` },
        });
        assertEqual(dashboard.status, 200, 'Faculty dashboard endpoint returns HTTP 200');
        assertEqual(typeof dashboard.json?.fallbackBanner?.show, 'boolean', 'Fallback banner show flag exists');
        assertEqual(dashboard.json?.fallbackBanner?.show, true, 'Fallback banner remains visible while schedule is not published');
        assert(Array.isArray(dashboard.json?.teachingAssignments), 'Teaching assignment identity list exists on dashboard contract');
        const bannerText = `${dashboard.json?.fallbackBanner?.title ?? ''} ${dashboard.json?.fallbackBanner?.message ?? ''}`.toLowerCase();
        assert(bannerText.includes('not') || bannerText.includes('draft') || bannerText.includes('published'), 'Fallback banner copy communicates non-final status');
    }
    finally {
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0)
        process.exitCode = 1;
}
run().catch((error) => {
    console.error('\nUnhandled faculty dashboard contract test error:', error);
    process.exit(1);
});
//# sourceMappingURL=faculty-dashboard-contract.test.js.map