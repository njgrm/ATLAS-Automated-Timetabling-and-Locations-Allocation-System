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
    const faculty = await prisma.atlasAuthAccount.findFirst({
        where: { role: 'faculty', isActive: true, facultyId: { not: null } },
        orderBy: { id: 'asc' },
    });
    if (!officer || !faculty?.facultyId) {
        console.error('\nMissing seeded officer/faculty accounts for concurrency test.');
        process.exitCode = 1;
        return;
    }
    const schoolId = faculty.schoolId;
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
        console.error('\nMissing seed data for concurrency test.');
        process.exitCode = 1;
        return;
    }
    const entryId = `phase2-concurrency-${Date.now()}`;
    const now = Date.now();
    const run = await prisma.generationRun.create({
        data: {
            schoolId,
            schoolYearId,
            status: 'COMPLETED',
            runType: 'FULL',
            triggeredBy: officer.id,
            startedAt: new Date(now - 50000),
            finishedAt: new Date(now - 49000),
            durationMs: 1000,
            summary: {},
            violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
            draftEntries: [
                {
                    entryId,
                    subjectId: subject.id,
                    sectionId,
                    facultyId: faculty.facultyId,
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
        const facultyLogin = await requestJson(baseUrl, '/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: faculty.email, password: seededPassword }),
        });
        assertEqual(facultyLogin.status, 200, 'Faculty login returns HTTP 200');
        const facultyToken = facultyLogin.json?.token;
        assert(Boolean(facultyToken), 'Faculty token exists');
        if (!facultyToken)
            return;
        section('PH2-CONFLICT-01 stale run version is rejected with VERSION_CONFLICT');
        const staleRunVersionSubmit = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/faculty/${faculty.facultyId}/entries/${entryId}/submit`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${facultyToken}`,
            },
            body: JSON.stringify({
                actionType: 'ROOM_CHANGE',
                requestedRoomId: rooms[1].id,
                expectedRunVersion: run.version + 999,
            }),
        });
        assertEqual(staleRunVersionSubmit.status, 409, 'Stale run version returns HTTP 409');
        assertEqual(staleRunVersionSubmit.json?.code, 'VERSION_CONFLICT', 'Run version conflict returns VERSION_CONFLICT code');
        section('PH2-CONFLICT-02 stale request version is rejected with VERSION_CONFLICT');
        const firstSubmit = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/faculty/${faculty.facultyId}/entries/${entryId}/submit`, {
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
        assertEqual(firstSubmit.status, 200, 'First submit succeeds with current run version');
        const actualRequestVersion = firstSubmit.json?.entries?.find((entry) => entry.entryId === entryId)?.version;
        assert(typeof actualRequestVersion === 'number', 'First submit returns persisted request version');
        const staleRequestVersionSubmit = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/faculty/${faculty.facultyId}/entries/${entryId}/submit`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${facultyToken}`,
            },
            body: JSON.stringify({
                actionType: 'ROOM_CHANGE',
                requestedRoomId: rooms[0].id,
                expectedRunVersion: run.version,
                requestVersion: actualRequestVersion + 999,
            }),
        });
        assertEqual(staleRequestVersionSubmit.status, 409, 'Stale request version returns HTTP 409');
        assertEqual(staleRequestVersionSubmit.json?.code, 'VERSION_CONFLICT', 'Request version conflict returns VERSION_CONFLICT code');
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
    console.error('\nUnhandled phase2 concurrency conflict test error:', error);
    process.exit(1);
});
