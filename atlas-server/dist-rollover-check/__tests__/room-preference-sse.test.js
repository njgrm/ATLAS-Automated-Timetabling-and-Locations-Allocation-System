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
    return { status: response.status, json, headers: response.headers };
}
async function readUntil(reader, matcher, timeoutMs) {
    const decoder = new TextDecoder();
    let buffer = '';
    const timeoutAt = Date.now() + timeoutMs;
    while (Date.now() < timeoutAt) {
        const readResult = await Promise.race([
            reader.read(),
            new Promise((resolve) => {
                setTimeout(() => resolve({ done: true, value: undefined }), 250);
            }),
        ]);
        if (readResult.done)
            continue;
        buffer += decoder.decode(readResult.value, { stream: true });
        if (matcher(buffer)) {
            return buffer;
        }
    }
    return null;
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
        const officerLogin = await requestJson(baseUrl, '/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: officerEmail, password: seededPassword }),
        });
        assertEqual(officerLogin.status, 200, 'Officer login returns HTTP 200');
        const token = officerLogin.json?.token;
        assert(Boolean(token), 'Officer token exists');
        if (!token)
            return;
        section('SSE-01 stream receives room preference sync event');
        const sseResponse = await fetch(`${baseUrl}/room-preferences/${facultyAccount.schoolId}/1/events`, {
            headers: {
                authorization: `Bearer ${token}`,
                accept: 'text/event-stream',
            },
        });
        assertEqual(sseResponse.status, 200, 'SSE endpoint returns HTTP 200');
        assertEqual(sseResponse.headers.get('content-type')?.includes('text/event-stream'), true, 'SSE content-type is text/event-stream');
        if (!sseResponse.body) {
            assert(false, 'SSE response body is missing');
            return;
        }
        const reader = sseResponse.body.getReader();
        await requestJson(baseUrl, `/room-preferences/${facultyAccount.schoolId}/1/runs/${run.id}/faculty/${facultyAccount.facultyId}/sync`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ actions: [] }),
        });
        const streamText = await readUntil(reader, (text) => text.includes('event: ROOM_REQUEST_SYNC_COMPLETED'), 5000);
        assert(Boolean(streamText), 'SSE stream includes ROOM_REQUEST_SYNC_COMPLETED event');
        await reader.cancel();
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
    console.error('\nUnhandled room preference SSE test error:', error);
    process.exit(1);
});
