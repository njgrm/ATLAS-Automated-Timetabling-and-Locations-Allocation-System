import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createPublishedScheduleRevision } from '../services/published-revision.service.js';
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
async function expectServiceCode(label, expectedCode, action) {
    try {
        await action();
        assert(false, `${label} throws ${expectedCode}`);
    }
    catch (error) {
        assertEqual(error.code, expectedCode, `${label} throws ${expectedCode}`);
    }
}
async function run() {
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'atlas-published-revision-test-secret';
    }
    const actorId = 919191;
    const schoolYearId = 606001;
    const now = new Date('2030-05-30T10:00:00.000Z');
    const testSchool = await prisma.school.create({
        data: {
            name: `Published Revision Contract ${Date.now()}`,
            shortName: 'PRC',
        },
    });
    const sourceRun = await prisma.generationRun.create({
        data: {
            schoolId: testSchool.id,
            schoolYearId,
            status: 'COMPLETED',
            runType: 'FULL',
            triggeredBy: actorId,
            startedAt: new Date('2030-05-29T08:00:00.000Z'),
            finishedAt: new Date('2030-05-29T08:01:00.000Z'),
            durationMs: 60000,
            summary: {
                isPublished: true,
                publishedAt: '2030-05-29T09:00:00.000Z',
                publishedBy: actorId,
                hardViolationCount: 0,
            },
            violations: [],
            draftEntries: [
                {
                    entryId: 'revision-entry-1',
                    subjectId: 101,
                    sectionId: 202,
                    facultyId: 303,
                    roomId: 404,
                    day: 'MONDAY',
                    startTime: '07:30',
                    endTime: '08:15',
                    durationMinutes: 45,
                },
            ],
            unassignedItems: [],
        },
    });
    const revisionChange = {
        entryId: 'revision-entry-1',
        changeType: 'CHANGE_FACULTY',
        previous: { facultyId: 303, roomId: 404, day: 'MONDAY', startTime: '07:30', endTime: '08:15' },
        next: { facultyId: 505, roomId: 404, day: 'MONDAY', startTime: '07:30', endTime: '08:15' },
    };
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
    const token = jwt.sign({ userId: actorId, role: 'officer', mustChangePassword: false }, process.env.JWT_SECRET, { expiresIn: '10m' });
    try {
        section('PUB-REV-01 service creates revision and audit without mutating published source');
        const serviceResult = await createPublishedScheduleRevision({
            schoolId: testSchool.id,
            schoolYearId,
            sourceRunId: sourceRun.id,
            actorId,
            effectiveDate: '2030-06-03T00:00:00.000Z',
            reason: 'Teacher reassignment after publication.',
            changes: [revisionChange],
        }, { now });
        assert(serviceResult.revision.id > 0, 'Service returns created revision ID');
        assertEqual(serviceResult.revision.status, 'SCHEDULED', 'Revision is stored as scheduled');
        assertEqual(serviceResult.revision.sourceRunId, sourceRun.id, 'Revision points to source published run');
        assertEqual(serviceResult.revision.effectiveDate.toISOString(), '2030-06-03T00:00:00.000Z', 'Revision stores effective date');
        assert(serviceResult.auditId > 0, 'Service returns audit ID');
        const preservedRun = await prisma.generationRun.findUniqueOrThrow({ where: { id: sourceRun.id } });
        assertEqual(preservedRun.summary.isPublished, true, 'Source run remains published');
        assertEqual(preservedRun.version, sourceRun.version, 'Source run version is unchanged');
        const audit = await prisma.auditLog.findUniqueOrThrow({ where: { id: serviceResult.auditId } });
        assertEqual(audit.action, 'PUBLISHED_SCHEDULE_REVISION_CREATED', 'Audit action records revision creation');
        assertEqual(audit.metadata.publishedTruthPreserved, true, 'Audit metadata records published truth preservation');
        section('PUB-REV-02 service rejects missing and same-day effective dates');
        await expectServiceCode('Missing effective date', 'EFFECTIVE_DATE_REQUIRED', () => createPublishedScheduleRevision({
            schoolId: testSchool.id,
            schoolYearId,
            sourceRunId: sourceRun.id,
            actorId,
            reason: 'Missing date should fail.',
            changes: [revisionChange],
        }, { now }));
        await expectServiceCode('Same-day effective date', 'EFFECTIVE_DATE_SAME_DAY', () => createPublishedScheduleRevision({
            schoolId: testSchool.id,
            schoolYearId,
            sourceRunId: sourceRun.id,
            actorId,
            effectiveDate: '2030-05-30T23:00:00.000Z',
            reason: 'Same day should fail.',
            changes: [revisionChange],
        }, { now }));
        section('PUB-REV-03 API creates revision and rejects missing effective date');
        const validApi = await requestJson(baseUrl, `/generation/${testSchool.id}/${schoolYearId}/runs/${sourceRun.id}/published-revisions`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                effectiveDate: '2030-06-04T00:00:00.000Z',
                reason: 'API scheduled repair.',
                changeSet: [revisionChange],
            }),
        });
        assertEqual(validApi.status, 201, 'API creates revision with HTTP 201');
        assert(validApi.json?.revision?.id > 0, 'API response includes revision ID');
        assertEqual(validApi.json?.revision?.sourceRunId, sourceRun.id, 'API revision points to source run');
        const missingDateApi = await requestJson(baseUrl, `/generation/${testSchool.id}/${schoolYearId}/runs/${sourceRun.id}/published-revisions`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                reason: 'API missing date should fail.',
                changes: [revisionChange],
            }),
        });
        assertEqual(missingDateApi.status, 400, 'API missing effective date returns HTTP 400');
        assertEqual(missingDateApi.json?.code, 'EFFECTIVE_DATE_REQUIRED', 'API missing effective date returns machine-readable code');
    }
    finally {
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        await prisma.auditLog.deleteMany({ where: { schoolId: testSchool.id } });
        await prisma.publishedScheduleRevision.deleteMany({ where: { schoolId: testSchool.id } });
        await prisma.generationRun.deleteMany({ where: { schoolId: testSchool.id } });
        await prisma.school.delete({ where: { id: testSchool.id } });
        await prisma.$disconnect();
    }
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0)
        process.exitCode = 1;
}
run().catch((error) => {
    console.error('\nUnhandled published revision contract test error:', error);
    process.exit(1);
});
