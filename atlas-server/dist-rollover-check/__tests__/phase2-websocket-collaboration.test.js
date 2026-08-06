import http from 'node:http';
import WebSocket from 'ws';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { registerRoomPreferenceCollaborationSocket } from '../services/room-preference-collaboration.service.js';
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
function waitForSocketEvent(ws, matcher, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            ws.off('message', onMessage);
            reject(new Error(`Timed out waiting for websocket event after ${timeoutMs}ms`));
        }, timeoutMs);
        const onMessage = (raw) => {
            try {
                const parsed = JSON.parse(String(raw));
                if (!matcher(parsed))
                    return;
                clearTimeout(timeout);
                ws.off('message', onMessage);
                resolve(parsed);
            }
            catch {
                // Ignore malformed frames.
            }
        };
        ws.on('message', onMessage);
    });
}
function waitForClose(ws, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Timed out waiting for websocket close after ${timeoutMs}ms`));
        }, timeoutMs);
        ws.once('close', () => {
            clearTimeout(timeout);
            resolve();
        });
    });
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
        console.error('\nMissing seeded officer/faculty accounts for websocket collaboration test.');
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
        console.error('\nMissing seed data for websocket collaboration test.');
        process.exitCode = 1;
        return;
    }
    const entryId = `phase2-ws-${Date.now()}`;
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
    const wsLifecycle = registerRoomPreferenceCollaborationSocket(server, {
        heartbeatTimeoutMs: 700,
        pruneIntervalMs: 100,
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
        console.error('Unable to resolve ephemeral test server port.');
        wsLifecycle.dispose();
        server.close();
        process.exitCode = 1;
        return;
    }
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
    const wsBase = `ws://127.0.0.1:${address.port}${wsLifecycle.path}`;
    let officerWs = null;
    let facultyWs = null;
    let timeoutWs = null;
    let keepAliveTimer = null;
    try {
        const officerLogin = await requestJson(baseUrl, '/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: officer.email, password: seededPassword }),
        });
        assertEqual(officerLogin.status, 200, 'Officer login returns HTTP 200');
        const officerToken = officerLogin.json?.token;
        assert(Boolean(officerToken), 'Officer token exists');
        if (!officerToken)
            return;
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
        section('PH2-WS-01 websocket auth handshake rejects missing token');
        const unauthorizedWs = new WebSocket(wsBase);
        const unauthorizedError = await waitForSocketEvent(unauthorizedWs, (payload) => payload?.type === 'collab.error');
        assertEqual(unauthorizedError.code, 'UNAUTHORIZED', 'Missing token is rejected at websocket handshake');
        unauthorizedWs.close();
        section('PH2-WS-02 presence join/leave and selection broadcast across roles');
        officerWs = new WebSocket(`${wsBase}?accessToken=${encodeURIComponent(officerToken)}`);
        facultyWs = new WebSocket(`${wsBase}?accessToken=${encodeURIComponent(facultyToken)}`);
        await Promise.all([
            waitForSocketEvent(officerWs, (payload) => payload?.type === 'collab.connected'),
            waitForSocketEvent(facultyWs, (payload) => payload?.type === 'collab.connected'),
        ]);
        keepAliveTimer = setInterval(() => {
            if (officerWs?.readyState === WebSocket.OPEN) {
                officerWs.send(JSON.stringify({ type: 'collab.heartbeat' }));
            }
            if (facultyWs?.readyState === WebSocket.OPEN) {
                facultyWs.send(JSON.stringify({ type: 'collab.heartbeat' }));
            }
        }, 200);
        officerWs.send(JSON.stringify({
            type: 'collab.join',
            schoolId,
            schoolYearId,
            runId: run.id,
            viewMode: 'SCHEDULER_QUEUE',
        }));
        facultyWs.send(JSON.stringify({
            type: 'collab.join',
            schoolId,
            schoolYearId,
            runId: run.id,
            viewMode: 'FACULTY_ACTIVE_DRAFT',
        }));
        await Promise.all([
            waitForSocketEvent(officerWs, (payload) => payload?.type === 'collab.snapshot'),
            waitForSocketEvent(facultyWs, (payload) => payload?.type === 'collab.snapshot'),
        ]);
        const upsert = await waitForSocketEvent(officerWs, (payload) => payload?.type === 'collab.presence.upsert' && payload?.presence?.role === 'faculty');
        assertEqual(upsert.presence.role, 'faculty', 'Officer receives faculty presence upsert');
        facultyWs.send(JSON.stringify({
            type: 'collab.selection',
            selection: {
                schoolId,
                schoolYearId,
                runId: run.id,
                day: 'MONDAY',
                startTime: '08:00',
                endTime: '09:00',
                entryId,
                source: 'GRID_CELL',
            },
        }));
        const selection = await waitForSocketEvent(officerWs, (payload) => payload?.type === 'collab.selection');
        assertEqual(selection.selection.entryId, entryId, 'Officer receives faculty cell selection broadcast');
        section('PH2-WS-03 room request updates propagate via websocket fanout');
        const requestEventPromise = waitForSocketEvent(officerWs, (payload) => payload?.type === 'collab.room-request.event' && payload?.event?.type === 'ROOM_REQUEST_SUBMITTED');
        const submitResponse = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/faculty/${faculty.facultyId}/entries/${entryId}/submit`, {
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
        assertEqual(submitResponse.status, 200, 'Faculty request submit succeeds');
        const requestEvent = await requestEventPromise;
        assertEqual(requestEvent.event.entryId, entryId, 'Officer receives submitted request live event');
        section('PH2-WS-04 heartbeat timeout removes stale connection and emits leave');
        timeoutWs = new WebSocket(`${wsBase}?accessToken=${encodeURIComponent(facultyToken)}`);
        await waitForSocketEvent(timeoutWs, (payload) => payload?.type === 'collab.connected');
        timeoutWs.send(JSON.stringify({
            type: 'collab.join',
            schoolId,
            schoolYearId,
            runId: run.id,
            viewMode: 'FACULTY_ACTIVE_DRAFT',
        }));
        await waitForSocketEvent(timeoutWs, (payload) => payload?.type === 'collab.snapshot');
        const leaveNoticePromise = waitForSocketEvent(officerWs, (payload) => payload?.type === 'collab.presence.leave');
        await waitForClose(timeoutWs, 4000);
        const leaveNotice = await leaveNoticePromise;
        assert(typeof leaveNotice.connectionId === 'string' && leaveNotice.connectionId.length > 0, 'Officer receives presence leave after timeout close');
        if (facultyWs) {
            const manualLeavePromise = waitForSocketEvent(officerWs, (payload) => payload?.type === 'collab.presence.leave');
            facultyWs.close();
            await manualLeavePromise;
            assert(true, 'Manual websocket close emits presence leave');
        }
    }
    finally {
        if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
            keepAliveTimer = null;
        }
        if (officerWs && officerWs.readyState === WebSocket.OPEN)
            officerWs.close();
        if (facultyWs && facultyWs.readyState === WebSocket.OPEN)
            facultyWs.close();
        if (timeoutWs && timeoutWs.readyState === WebSocket.OPEN)
            timeoutWs.close();
        await prisma.facultyRoomPreference.deleteMany({ where: { runId: run.id } }).catch(() => { });
        await prisma.generationRun.delete({ where: { id: run.id } }).catch(() => { });
        wsLifecycle.dispose();
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
    console.error('\nUnhandled phase2 websocket collaboration test error:', error);
    process.exit(1);
});
