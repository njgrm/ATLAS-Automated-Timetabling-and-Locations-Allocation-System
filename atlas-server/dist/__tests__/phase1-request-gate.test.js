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
function firstSectionIdFromSnapshot(payload) {
    if (!Array.isArray(payload))
        return null;
    for (const grade of payload) {
        const sectionId = grade.sections?.[0]?.id;
        if (typeof sectionId === 'number' && sectionId > 0) {
            return sectionId;
        }
    }
    return null;
}
async function run() {
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'atlas-local-auth-test-secret';
    }
    const seededPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Atlas2026!';
    const officer = await prisma.atlasAuthAccount.findFirst({
        where: { role: { in: ['officer', 'admin', 'SYSTEM_ADMIN'] }, isActive: true },
        orderBy: { id: 'asc' },
    });
    const facultyAccount = await prisma.atlasAuthAccount.findFirst({
        where: { role: 'faculty', isActive: true, facultyId: { not: null } },
        orderBy: { id: 'asc' },
    });
    if (!officer || !facultyAccount?.facultyId) {
        console.error('\nMissing seeded officer/faculty accounts.');
        process.exitCode = 1;
        return;
    }
    const schoolId = facultyAccount.schoolId;
    const schoolYearId = 1;
    const subject = await prisma.subject.findFirst({ where: { schoolId, isActive: true }, orderBy: { id: 'asc' } });
    const rooms = await prisma.room.findMany({
        where: {
            isTeachingSpace: true,
            building: { schoolId, isTeachingBuilding: true },
        },
        orderBy: { id: 'asc' },
        take: 2,
    });
    const snapshot = await prisma.sectionSnapshot.findFirst({ where: { schoolId }, orderBy: { fetchedAt: 'desc' }, select: { payload: true } });
    const sectionId = firstSectionIdFromSnapshot(snapshot?.payload);
    if (!subject || rooms.length < 2 || !sectionId) {
        console.error('\nMissing subject/rooms/section snapshot data for Phase 1 gate test.');
        process.exitCode = 1;
        return;
    }
    const now = Date.now();
    const run = await prisma.generationRun.create({
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
            draftEntries: [
                {
                    entryId: `phase1-gate-${Date.now()}-a`,
                    subjectId: subject.id,
                    sectionId,
                    facultyId: facultyAccount.facultyId,
                    roomId: rooms[0].id,
                    day: 'MONDAY',
                    startTime: '08:00',
                    endTime: '09:00',
                    durationMinutes: 60,
                },
            ],
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
        const officerLogin = await requestJson(baseUrl, '/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: officer.email, password: seededPassword }),
        });
        assertEqual(officerLogin.status, 200, 'Officer login returns HTTP 200');
        const officerToken = officerLogin.json?.token;
        assert(Boolean(officerToken), 'Officer token available');
        if (!officerToken)
            return;
        const facultyLogin = await requestJson(baseUrl, '/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: facultyAccount.email, password: seededPassword }),
        });
        assertEqual(facultyLogin.status, 200, 'Faculty login returns HTTP 200');
        const facultyToken = facultyLogin.json?.token;
        assert(Boolean(facultyToken), 'Faculty token available');
        if (!facultyToken)
            return;
        section('PH1-GATE-01 active draft resolver for faculty latest endpoint');
        const latestState = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/latest/faculty/${facultyAccount.facultyId}`, {
            headers: { authorization: `Bearer ${facultyToken}` },
        });
        assertEqual(latestState.status, 200, 'Latest faculty room preference endpoint returns HTTP 200');
        assertEqual(latestState.json?.runId, run.id, 'Latest faculty endpoint resolves to active draft run');
        section('PH1-GATE-02 submitted pending request blocks generation until decided');
        const submit = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/faculty/${facultyAccount.facultyId}/entries/${latestState.json?.entries?.[0]?.entryId}/submit`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${facultyToken}`,
            },
            body: JSON.stringify({
                actionType: 'ROOM_CHANGE',
                requestedRoomId: rooms[1].id,
                expectedRunVersion: run.version,
            }),
        });
        assertEqual(submit.status, 200, 'Faculty request submit succeeds');
        const gateBlocked = await requestJson(baseUrl, `/generation/${schoolId}/${schoolYearId}/runs/gate`, {
            headers: { authorization: `Bearer ${officerToken}` },
        });
        assertEqual(gateBlocked.status, 200, 'Generation gate endpoint returns HTTP 200');
        assertEqual(gateBlocked.json?.blocked, true, 'Gate is blocked with pending request');
        assert((gateBlocked.json?.openCount ?? 0) >= 1, 'Gate reports pending request count');
        const triggerBlocked = await requestJson(baseUrl, `/generation/${schoolId}/${schoolYearId}/runs`, {
            method: 'POST',
            headers: { authorization: `Bearer ${officerToken}` },
        });
        assertEqual(triggerBlocked.status, 409, 'Generation trigger blocked while request pending');
        assertEqual(triggerBlocked.json?.code, 'OPEN_ROOM_REQUESTS_BLOCK_GENERATION', 'Generation blocker code is explicit');
        const summary = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/summary?decisionStatus=PENDING`, {
            headers: { authorization: `Bearer ${officerToken}` },
        });
        assertEqual(summary.status, 200, 'Officer summary endpoint returns HTTP 200');
        const requestId = summary.json?.requests?.[0]?.id;
        assert(Boolean(requestId), 'Pending request available for decision');
        if (!requestId)
            return;
        const review = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/requests/${requestId}/review`, {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${officerToken}`,
            },
            body: JSON.stringify({
                decisionStatus: 'REJECTED',
                reviewerNotes: 'Phase 1 gate test decision',
                requestVersion: summary.json?.requests?.[0]?.version,
            }),
        });
        assertEqual(review.status, 200, 'Officer can decide request');
        const gateOpen = await requestJson(baseUrl, `/generation/${schoolId}/${schoolYearId}/runs/gate`, {
            headers: { authorization: `Bearer ${officerToken}` },
        });
        assertEqual(gateOpen.status, 200, 'Gate endpoint still accessible after decision');
        assertEqual(gateOpen.json?.blocked, false, 'Gate unblocks after all requests are decided');
    }
    finally {
        await prisma.facultyRoomPreference.deleteMany({ where: { runId: run.id } }).catch(() => { });
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
    console.error('\nUnhandled phase1 request gate test error:', error);
    process.exit(1);
});
//# sourceMappingURL=phase1-request-gate.test.js.map