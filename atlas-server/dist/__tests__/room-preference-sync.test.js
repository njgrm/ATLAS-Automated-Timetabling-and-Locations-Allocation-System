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
        where: { role: 'faculty', isActive: true, facultyId: { not: null } },
        orderBy: { id: 'asc' },
    });
    if (!facultyAccount?.facultyId) {
        console.error('\nNo seeded faculty account linked to faculty_mirror found. Run realistic seed first.');
        process.exitCode = 1;
        return;
    }
    const now = new Date();
    const run = await prisma.generationRun.create({
        data: {
            schoolId: facultyAccount.schoolId,
            schoolYearId: 1,
            status: 'COMPLETED',
            runType: 'FULL',
            triggeredBy: facultyAccount.id,
            startedAt: now,
            finishedAt: now,
            durationMs: 1,
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
            body: JSON.stringify({ email: facultyAccount.email, password: seededPassword }),
        });
        assertEqual(login.status, 200, 'Faculty login returns HTTP 200');
        const token = login.json?.token;
        assert(Boolean(token), 'Faculty login token available');
        if (!token)
            return;
        section('SYNC-01 invalid queued action reports deterministic failure and keeps recoverability');
        const sync = await requestJson(baseUrl, `/room-preferences/${facultyAccount.schoolId}/1/runs/${run.id}/faculty/${facultyAccount.facultyId}/sync`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                actions: [
                    { actionId: 'bad-1', type: 'SAVE_DRAFT', entryId: 'entry-1' },
                ],
            }),
        });
        assertEqual(sync.status, 200, 'Sync endpoint returns HTTP 200 with per-action results');
        assertEqual(sync.json?.results?.length, 1, 'Sync returns one action result');
        assertEqual(sync.json?.results?.[0]?.ok, false, 'Invalid action is rejected');
        assertEqual(typeof sync.json?.results?.[0]?.error?.message, 'string', 'Rejected action includes message');
        assert(Array.isArray(sync.json?.state?.entries), 'Sync response includes latest state snapshot for recoverability');
    }
    finally {
        await prisma.generationRun.delete({ where: { id: run.id } }).catch(() => { });
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
    console.error('\nUnhandled room preference sync test error:', error);
    process.exit(1);
});
//# sourceMappingURL=room-preference-sync.test.js.map