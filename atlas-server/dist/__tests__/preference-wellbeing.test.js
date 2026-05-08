/**
 * preference-wellbeing.test.ts
 *
 * Verifies that:
 * 1. Well-being fields are persisted and returned from draft save.
 * 2. Well-being fields are persisted and returned from submit.
 * 3. saveDraft resets a SUBMITTED preference back to DRAFT.
 */
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
    }
    else {
        failCount += 1;
        console.error(`  ✗ ${label}`);
    }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
    }
    else {
        failCount += 1;
        console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
    }
}
async function requestJson(baseUrl, path, options) {
    const res = await fetch(`${baseUrl}${path}`, options);
    let json = null;
    try {
        json = await res.json();
    }
    catch {
        json = null;
    }
    return { status: res.status, json };
}
async function run() {
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'atlas-local-auth-test-secret';
    }
    const seededPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Atlas2026!';
    // Resolve a faculty account linked to faculty_mirror
    const facultyAccount = await prisma.atlasAuthAccount.findFirst({
        where: { role: 'faculty', isActive: true, facultyId: { not: null } },
        orderBy: { id: 'asc' },
    });
    if (!facultyAccount?.facultyId) {
        console.error('\nNo seeded faculty account linked to faculty_mirror. Run realistic seed first.');
        process.exitCode = 1;
        return;
    }
    const facultyId = facultyAccount.facultyId;
    const schoolId = facultyAccount.schoolId;
    // Use a fixed schoolYearId (ATLAS stores this as a plain integer, no DB model).
    const syId = 1;
    // Clean up any existing preference for this faculty/year to start fresh
    await prisma.facultyPreference.deleteMany({ where: { facultyId, schoolYearId: syId } });
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
        // Login as faculty
        const loginRes = await requestJson(baseUrl, '/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: facultyAccount.email, password: seededPassword }),
        });
        assertEqual(loginRes.status, 200, 'Faculty login returns HTTP 200');
        const token = loginRes.json?.token ?? '';
        assert(!!token, 'Faculty login returns a token');
        const authHeader = { 'content-type': 'application/json', Authorization: `Bearer ${token}` };
        /* ── Section 1: Save draft with well-being fields ── */
        section('Save draft persists well-being fields');
        const draftPayload = {
            notes: 'Integration test draft',
            timeSlots: [{ day: 'MONDAY', startTime: '08:00', endTime: '09:00', preference: 'PREFERRED' }],
            wellbeing: {
                pregnancySupport: true,
                physicalAilmentSupport: false,
                minimizeTravelTime: true,
                avoidUpperFloors: false,
            },
            version: 1,
        };
        const draftRes = await requestJson(baseUrl, `/preferences/${schoolId}/${syId}/faculty/${facultyId}/draft`, { method: 'PUT', headers: authHeader, body: JSON.stringify(draftPayload) });
        assertEqual(draftRes.status, 200, 'PUT /draft returns HTTP 200');
        assertEqual(draftRes.json?.preference?.status, 'DRAFT', 'Preference status is DRAFT');
        assertEqual(draftRes.json?.preference?.pregnancySupport, true, 'pregnancySupport persisted as true');
        assertEqual(draftRes.json?.preference?.physicalAilmentSupport, false, 'physicalAilmentSupport persisted as false');
        assertEqual(draftRes.json?.preference?.minimizeTravelTime, true, 'minimizeTravelTime persisted as true');
        assertEqual(draftRes.json?.preference?.avoidUpperFloors, false, 'avoidUpperFloors persisted as false');
        const draftVersion = draftRes.json?.preference?.version;
        /* ── Section 2: Submit with well-being fields ── */
        section('Submit persists well-being fields');
        const submitPayload = {
            ...draftPayload,
            wellbeing: {
                pregnancySupport: false,
                physicalAilmentSupport: true,
                minimizeTravelTime: true,
                avoidUpperFloors: true,
            },
            version: draftVersion,
        };
        const submitRes = await requestJson(baseUrl, `/preferences/${schoolId}/${syId}/faculty/${facultyId}/submit`, { method: 'POST', headers: authHeader, body: JSON.stringify(submitPayload) });
        assertEqual(submitRes.status, 200, 'POST /submit returns HTTP 200');
        assertEqual(submitRes.json?.preference?.status, 'SUBMITTED', 'Preference status is SUBMITTED after submit');
        assertEqual(submitRes.json?.preference?.physicalAilmentSupport, true, 'physicalAilmentSupport updated to true on submit');
        assertEqual(submitRes.json?.preference?.avoidUpperFloors, true, 'avoidUpperFloors updated to true on submit');
        const submittedVersion = submitRes.json?.preference?.version;
        /* ── Section 3: saveDraft resets SUBMITTED → DRAFT ── */
        section('saveDraft resets SUBMITTED preference back to DRAFT');
        const reDraftPayload = {
            ...draftPayload,
            wellbeing: {
                pregnancySupport: false,
                physicalAilmentSupport: false,
                minimizeTravelTime: false,
                avoidUpperFloors: true,
            },
            version: submittedVersion,
        };
        const reDraftRes = await requestJson(baseUrl, `/preferences/${schoolId}/${syId}/faculty/${facultyId}/draft`, { method: 'PUT', headers: authHeader, body: JSON.stringify(reDraftPayload) });
        assertEqual(reDraftRes.status, 200, 'PUT /draft on SUBMITTED preference returns HTTP 200');
        assertEqual(reDraftRes.json?.preference?.status, 'DRAFT', 'Preference reset from SUBMITTED to DRAFT');
        assertEqual(reDraftRes.json?.preference?.avoidUpperFloors, true, 'avoidUpperFloors updated in re-draft');
        assertEqual(reDraftRes.json?.preference?.pregnancySupport, false, 'pregnancySupport reset to false in re-draft');
    }
    finally {
        await new Promise((resolve) => server.close(() => resolve()));
        await prisma.$disconnect();
    }
    console.log(`\n─── Results: ${passCount} passed, ${failCount} failed ───`);
    if (failCount > 0)
        process.exitCode = 1;
}
run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
//# sourceMappingURL=preference-wellbeing.test.js.map