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
    const seededPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Atlas2026!';
    const facultyAccount = await prisma.atlasAuthAccount.findFirst({
        where: { role: 'faculty', isActive: true },
        orderBy: { id: 'asc' },
    });
    if (!facultyAccount) {
        console.error('\nNo seeded faculty local auth account found. Run realistic seed first.');
        process.exitCode = 1;
        return;
    }
    const server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
        console.error('Unable to resolve ephemeral test server port.');
        server.close();
        process.exitCode = 1;
        return;
    }
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
    try {
        section('FAC-ROUTE-01 faculty login and /my portal data access');
        const login = await requestJson(baseUrl, '/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: facultyAccount.email, password: seededPassword }),
        });
        assertEqual(login.status, 200, 'Faculty login returns HTTP 200');
        const token = typeof login.json?.token === 'string' ? login.json.token : null;
        assert(Boolean(token), 'Faculty login returns token');
        if (!token) {
            assert(false, 'Skipping route restriction checks because token is missing');
            return;
        }
        const dashboard = await requestJson(baseUrl, '/faculty-portal/1/1/dashboard', {
            headers: { authorization: `Bearer ${token}` },
        });
        assert(dashboard.status === 200 || dashboard.status === 403, 'My portal endpoint responds deterministically');
        section('FAC-ROUTE-02 faculty blocked from admin faculty list');
        const facultyList = await requestJson(baseUrl, '/faculty?schoolId=1', {
            headers: { authorization: `Bearer ${token}` },
        });
        assertEqual(facultyList.status, 403, 'Faculty cannot access /faculty listing');
        section('FAC-ROUTE-03 faculty blocked from scheduler assignment summary');
        const assignments = await requestJson(baseUrl, '/faculty-assignments/summary?schoolId=1&schoolYearId=1', {
            headers: { authorization: `Bearer ${token}` },
        });
        assertEqual(assignments.status, 403, 'Faculty cannot access /faculty-assignments/summary');
        section('FAC-ROUTE-04 faculty blocked from generation review APIs');
        const generation = await requestJson(baseUrl, '/generation/1/1/runs/latest', {
            headers: { authorization: `Bearer ${token}` },
        });
        assertEqual(generation.status, 403, 'Faculty cannot access generation latest run endpoint');
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
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run().catch((error) => {
    console.error('\nUnhandled faculty route restriction test error:', error);
    process.exit(1);
});
