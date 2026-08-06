import http from 'node:http';
import bcrypt from 'bcryptjs';
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
    const seededPassword = 'DepEd2026!';
    const school = await prisma.school.findFirst({ select: { id: true }, orderBy: { id: 'asc' } });
    if (!school) {
        console.error('\nNo school found for faculty draft contract test. Run seed first.');
        process.exitCode = 1;
        return;
    }
    const schoolId = school.id;
    const sectionMirror = await prisma.sectionMirror.findFirst({
        where: { schoolId, isStale: false, isActiveForScheduling: true },
        orderBy: [{ schoolYearId: 'desc' }, { displayOrder: 'asc' }, { externalId: 'asc' }],
        select: { externalId: true, schoolYearId: true, displayOrder: true, programType: true },
    });
    const room = await prisma.room.findFirst({
        where: {
            isTeachingSpace: true,
            building: { schoolId, isTeachingBuilding: true },
        },
        orderBy: { id: 'asc' },
    });
    if (!sectionMirror || !room) {
        console.error('\nMissing room or SectionMirror data for draft contract test.');
        process.exitCode = 1;
        return;
    }
    const schoolYearId = sectionMirror.schoolYearId;
    const sectionId = sectionMirror.externalId;
    const programType = (sectionMirror.programType ?? 'REGULAR');
    const runIds = [];
    const cleanup = {
        authAccountId: null,
        facultyIds: [],
        facultySubjectId: null,
        subjectId: null,
    };
    const now = Date.now();
    const unique = now.toString().slice(-8);
    const sharedEntryId = `faculty-draft-${Date.now()}`;
    const employeeId = `9${unique.slice(-6)}`;
    const email = `faculty.identity.${unique}@example.test`;
    const staleExternalId = 8_000_000 + Number(unique.slice(-5));
    const canonicalExternalId = staleExternalId + 1;
    const staleFaculty = await prisma.facultyMirror.create({
        data: {
            schoolId,
            externalId: staleExternalId,
            firstName: 'Identity',
            lastName: 'Stale',
            contactInfo: email,
            department: 'SCIENCE',
            specialization: 'Science',
            isActiveForScheduling: true,
        },
    });
    cleanup.facultyIds.push(staleFaculty.id);
    const canonicalFaculty = await prisma.facultyMirror.create({
        data: {
            schoolId,
            externalId: canonicalExternalId,
            employeeId,
            firstName: 'Identity',
            lastName: 'Canonical',
            contactInfo: email,
            department: 'SCIENCE',
            specialization: 'Science',
            isActiveForScheduling: true,
        },
    });
    cleanup.facultyIds.push(canonicalFaculty.id);
    const facultyAccount = await prisma.atlasAuthAccount.create({
        data: {
            schoolId,
            facultyId: staleFaculty.id,
            email,
            employeeId,
            accountName: employeeId,
            role: 'faculty',
            passwordHash: await bcrypt.hash(seededPassword, 10),
            isActive: true,
        },
    });
    cleanup.authAccountId = facultyAccount.id;
    const subject = await prisma.subject.create({
        data: {
            schoolId,
            code: `FID-${unique}`,
            name: `Faculty Identity Contract ${unique}`,
            ownerDepartment: 'SCIENCE',
            minMinutesPerWeek: 60,
            gradeLevels: [sectionMirror.displayOrder],
            programScopes: [programType],
            isActive: true,
        },
    });
    cleanup.subjectId = subject.id;
    const facultySubject = await prisma.facultySubject.create({
        data: {
            schoolId,
            facultyId: canonicalFaculty.id,
            subjectId: subject.id,
            gradeLevels: [sectionMirror.displayOrder],
            sectionIds: [sectionId],
            assignedBy: facultyAccount.id,
        },
    });
    cleanup.facultySubjectId = facultySubject.id;
    await prisma.subjectSectionOwnership.create({
        data: {
            schoolId,
            facultySubjectId: facultySubject.id,
            facultyId: canonicalFaculty.id,
            subjectId: subject.id,
            sectionId,
        },
    });
    const oldRun = await prisma.generationRun.create({
        data: {
            schoolId,
            schoolYearId,
            status: 'COMPLETED',
            runType: 'FULL',
            triggeredBy: facultyAccount.id,
            startedAt: new Date(now - 120000),
            finishedAt: new Date(now - 119000),
            durationMs: 1000,
            summary: {},
            violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
            draftEntries: [],
            unassignedItems: [],
        },
    });
    runIds.push(oldRun.id);
    const latestRun = await prisma.generationRun.create({
        data: {
            schoolId,
            schoolYearId,
            status: 'COMPLETED',
            runType: 'FULL',
            triggeredBy: facultyAccount.id,
            startedAt: new Date(now - 60000),
            finishedAt: new Date(now - 58000),
            durationMs: 1000,
            summary: {},
            violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
            draftEntries: [
                {
                    entryId: sharedEntryId,
                    subjectId: subject.id,
                    sectionId,
                    facultyId: canonicalFaculty.id,
                    roomId: room.id,
                    day: 'MONDAY',
                    startTime: '08:00',
                    endTime: '09:00',
                    durationMinutes: 60,
                    entryKind: 'SECTION',
                },
            ],
            unassignedItems: [],
        },
    });
    runIds.push(latestRun.id);
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
            throw new Error('Faculty login did not return a token.');
        const relinkedAccount = await prisma.atlasAuthAccount.findUnique({ where: { id: facultyAccount.id }, select: { facultyId: true } });
        assertEqual(relinkedAccount?.facultyId, canonicalFaculty.id, 'Faculty login rewrites stale auth link to canonical assignment-bearing mirror');
        assertEqual(login.json?.user?.userId, canonicalFaculty.externalId, 'Faculty login token identity uses canonical external id');
        section('FAC-DRAFT-01 dashboard uses latest draft run and shows assigned session counts');
        const dashboard = await requestJson(baseUrl, `/faculty-portal/${schoolId}/${schoolYearId}/dashboard`, {
            headers: { authorization: `Bearer ${token}` },
        });
        assertEqual(dashboard.status, 200, 'Faculty dashboard endpoint returns HTTP 200');
        assertEqual(dashboard.json?.faculty?.id, canonicalFaculty.id, 'Faculty dashboard resolves canonical assignment-bearing faculty id');
        assertEqual(dashboard.json?.runContext?.runId, latestRun.id, 'Dashboard runContext resolves to latest draft run');
        assertEqual(dashboard.json?.schedulePreview?.runId, latestRun.id, 'Dashboard schedule preview runId uses latest draft run');
        assert((dashboard.json?.schedulePreview?.counts?.total ?? 0) > 0, 'Dashboard scheduled classes count is non-zero for assigned draft entry');
        assert((dashboard.json?.teachingAssignments?.length ?? 0) > 0, 'Dashboard teachingAssignments are non-empty for canonical assignment-bearing faculty');
        section('FAC-DRAFT-02 room preferences latest contract resolves same draft run');
        const roomState = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/latest/faculty/${canonicalFaculty.id}`, {
            headers: { authorization: `Bearer ${token}` },
        });
        assertEqual(roomState.status, 200, 'Room preferences latest endpoint returns HTTP 200');
        assertEqual(roomState.json?.runId, latestRun.id, 'Room preferences state resolves to latest draft run');
        assert((roomState.json?.entries?.length ?? 0) > 0, 'Room preferences state returns assigned entries for faculty');
        assertEqual(roomState.json?.entries?.[0]?.entryId, sharedEntryId, 'Room preferences entry comes from latest draft run payload');
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
        if (runIds.length > 0) {
            await prisma.generationRun.deleteMany({ where: { id: { in: runIds } } }).catch(() => { });
        }
        if (cleanup.facultySubjectId) {
            await prisma.subjectSectionOwnership.deleteMany({ where: { facultySubjectId: cleanup.facultySubjectId } }).catch(() => { });
            await prisma.facultySubject.deleteMany({ where: { id: cleanup.facultySubjectId } }).catch(() => { });
        }
        if (cleanup.subjectId) {
            await prisma.subject.deleteMany({ where: { id: cleanup.subjectId } }).catch(() => { });
        }
        if (cleanup.authAccountId) {
            await prisma.atlasAuthAccount.deleteMany({ where: { id: cleanup.authAccountId } }).catch(() => { });
        }
        if (cleanup.facultyIds.length > 0) {
            await prisma.facultyMirror.deleteMany({ where: { id: { in: cleanup.facultyIds } } }).catch(() => { });
        }
        await prisma.$disconnect();
    }
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0)
        process.exitCode = 1;
}
run().catch((error) => {
    console.error('\nUnhandled faculty draft run contract test error:', error);
    process.exit(1);
});
