import http from 'node:http';
import jwt from 'jsonwebtoken';
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
    return {
        status: response.status,
        json,
        headers: response.headers,
    };
}
async function run() {
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'atlas-local-auth-test-secret';
    }
    const seededPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Atlas2026!';
    const seededOfficer = await prisma.atlasAuthAccount.findFirst({
        where: { role: 'officer', isActive: true },
        orderBy: { id: 'asc' },
    });
    const officerEmail = process.env.ATLAS_SEEDED_OFFICER_EMAIL ?? seededOfficer?.email ?? 'officer@deped.edu.ph';
    let officerPassword = seededPassword;
    if (officerEmail === 'admin@deped.edu.ph') {
        officerPassword = 'AdminSY2026!';
    }
    const officerAccount = await prisma.atlasAuthAccount.findUnique({ where: { email: officerEmail } });
    if (!officerAccount) {
        console.error('\nSeeded local auth accounts are missing. Run the realistic seed first.');
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
        section('INT-AUTH-01 /auth/login issues local token');
        const login = await requestJson(`${baseUrl}`, '/auth/login', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                email: officerEmail,
                password: officerPassword,
            }),
        });
        assertEqual(login.status, 200, 'Login returns HTTP 200');
        const token = typeof login.json?.token === 'string' ? login.json.token : null;
        assert(Boolean(token), 'Login returns a token');
        assertEqual(login.json?.user?.authSource, 'local', 'Login response marks authSource as local');
        section('INT-AUTH-02 /auth/me accepts local token');
        if (!token) {
            assert(false, 'Skipped /auth/me local assertion because token is missing');
        }
        else {
            const me = await requestJson(`${baseUrl}`, '/auth/me', {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            });
            assertEqual(me.status, 200, '/auth/me returns HTTP 200 for local token');
            assert(typeof me.json?.user?.userId === 'number', '/auth/me local response includes numeric userId');
            assertEqual(me.json?.user?.role, 'officer', '/auth/me local response preserves role metadata');
            assert(typeof me.json?.user?.schoolId === 'number', '/auth/me local response includes schoolId');
            assert(typeof me.json?.user?.accountId === 'number', '/auth/me local response includes accountId');
            assertEqual(me.json?.user?.authSource, 'local', '/auth/me returns local authSource');
        }
        section('INT-AUTH-03 auth guard blocks unauthenticated writes');
        const writeNoToken = await requestJson(`${baseUrl}`, '/subjects', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({ schoolId: 1 }),
        });
        assertEqual(writeNoToken.status, 401, 'Protected write endpoint rejects missing token');
        assertEqual(writeNoToken.json?.code, 'NO_TOKEN', 'Missing token response uses NO_TOKEN code');
        section('INT-AUTH-04 auth guard accepts local token on protected writes');
        if (!token) {
            assert(false, 'Skipped protected-write auth acceptance check because token is missing');
        }
        else {
            const writeWithToken = await requestJson(`${baseUrl}`, '/subjects', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({}),
            });
            assertEqual(writeWithToken.status, 400, 'Protected write reaches route validation when token is valid');
            assertEqual(writeWithToken.json?.code, 'MISSING_FIELDS', 'Route-level validation runs after auth acceptance');
        }
        section('INT-AUTH-05 bridge token compatibility is preserved');
        const bridgeToken = jwt.sign({
            userId: 9001,
            role: 'admin',
            mustChangePassword: false,
        }, process.env.JWT_SECRET, { expiresIn: '10m' });
        const bridgeMe = await requestJson(`${baseUrl}`, '/auth/me', {
            headers: {
                authorization: `Bearer ${bridgeToken}`,
            },
        });
        assertEqual(bridgeMe.status, 200, '/auth/me accepts bridge-style tokens');
        assertEqual(bridgeMe.json?.user?.authSource, 'bridge', '/auth/me normalizes bridge token authSource');
        assertEqual(bridgeMe.json?.user?.role, 'admin', 'Bridge token role is preserved');
        section('INT-AUTH-06 privileged guard remains intact for officer/admin');
        if (!token) {
            assert(false, 'Skipped privileged guard regression check because officer token is missing');
        }
        else {
            const officerWrite = await requestJson(`${baseUrl}`, '/subjects', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({}),
            });
            assertEqual(officerWrite.status, 400, 'Officer token still passes auth guard and reaches route validation');
        }
        const adminWrite = await requestJson(`${baseUrl}`, '/subjects', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${bridgeToken}`,
            },
            body: JSON.stringify({}),
        });
        assertEqual(adminWrite.status, 400, 'Bridge admin token still passes auth guard and reaches route validation');
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
    console.error('\nUnhandled integration test error:', error);
    process.exit(1);
});
//# sourceMappingURL=auth-login-integration.test.js.map