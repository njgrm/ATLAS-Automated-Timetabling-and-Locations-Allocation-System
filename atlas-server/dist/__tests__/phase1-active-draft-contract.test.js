import http from 'node:http';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
let passCount = 0;
let failCount = 0;
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
    const officer = await prisma.atlasAuthAccount.findFirst({ where: { role: { in: ['officer', 'admin', 'SYSTEM_ADMIN'] }, isActive: true }, orderBy: { id: 'asc' } });
    const faculty = await prisma.atlasAuthAccount.findFirst({ where: { role: 'faculty', isActive: true, facultyId: { not: null } }, orderBy: { id: 'asc' } });
    if (!officer || !faculty?.facultyId) {
        console.error('\nMissing seeded officer/faculty accounts for active-draft contract test.');
        process.exitCode = 1;
        return;
    }
    const schoolId = faculty.schoolId;
    const schoolYearId = 1;
    const now = Date.now();
    const olderRun = await prisma.generationRun.create({
        data: {
            schoolId,
            schoolYearId,
            status: 'COMPLETED',
            runType: 'FULL',
            triggeredBy: officer.id,
            startedAt: new Date(now - 120000),
            finishedAt: new Date(now - 119000),
            durationMs: 1000,
            summary: {},
            violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
            draftEntries: [],
            unassignedItems: [],
        },
    });
    const activeRun = await prisma.generationRun.create({
        data: {
            schoolId,
            schoolYearId,
            status: 'COMPLETED',
            runType: 'FULL',
            triggeredBy: officer.id,
            startedAt: new Date(now - 60000),
            finishedAt: new Date(now - 59000),
            durationMs: 1000,
            summary: {},
            violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
            draftEntries: [],
            unassignedItems: [],
        },
    });
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
            body: JSON.stringify({ email: faculty.email, password: seededPassword }),
        });
        assertEqual(login.status, 200, 'Faculty login returns HTTP 200');
        const token = login.json?.token;
        assert(Boolean(token), 'Faculty token available');
        if (!token)
            return;
        const latest = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/latest/faculty/${faculty.facultyId}`, {
            headers: { authorization: `Bearer ${token}` },
        });
        assertEqual(latest.status, 200, 'Latest faculty endpoint returns HTTP 200');
        assertEqual(latest.json?.runId, activeRun.id, 'Latest faculty endpoint resolves active draft run');
        const portal = await requestJson(baseUrl, `/faculty-portal/${schoolId}/${schoolYearId}/dashboard`, {
            headers: { authorization: `Bearer ${token}` },
        });
        assertEqual(portal.status, 200, 'Faculty portal endpoint returns HTTP 200');
        assertEqual(portal.json?.runId, activeRun.id, 'Faculty portal resolves active draft run');
        const explicitOlder = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${olderRun.id}/faculty/${faculty.facultyId}`, {
            headers: { authorization: `Bearer ${token}` },
        });
        assertEqual(explicitOlder.status, 200, 'Explicit run endpoint remains accessible for historical draft');
        assertEqual(explicitOlder.json?.runId, olderRun.id, 'Explicit run endpoint is not silently overridden');
    }
    finally {
        await prisma.facultyRoomPreference.deleteMany({ where: { runId: { in: [olderRun.id, activeRun.id] } } }).catch(() => { });
        await prisma.generationRun.deleteMany({ where: { id: { in: [olderRun.id, activeRun.id] } } }).catch(() => { });
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
    console.error('\nUnhandled phase1 active draft contract test error:', error);
    process.exit(1);
});
//# sourceMappingURL=phase1-active-draft-contract.test.js.map