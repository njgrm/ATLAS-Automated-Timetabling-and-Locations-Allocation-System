import { createServer } from 'node:http';
import { prisma } from '../lib/prisma.js';
import { previewRolloverSync, resetDummyYearAndApplyRollover } from '../services/enrollpro-rollover.service.js';
import { triggerGenerationRun } from '../services/generation.service.js';
import { applyTeachingLoadSuggestionProposal, cancelTeachingLoadSuggestionProposal, createTeachingLoadSuggestionProposal, } from '../services/teaching-load-suggestion-proposal.service.js';
let passCount = 0;
let failCount = 0;
function section(name) {
    console.log(`\n════ ${name} ════`);
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
    assert(actual === expected, `${label} — expected ${String(expected)}, got ${String(actual)}`);
}
function assertGreaterThanOrEqual(actual, expected, label) {
    assert(actual >= expected, `${label} — expected >= ${expected}, got ${actual}`);
}
async function countReadinessRows(schoolId, schoolYearId) {
    const [sectionMirrors, facultyMirrors, generationRuns, schedulingPolicies, facultySubjects, ownerships, auditLogs, mirrors, teachingLoadSuggestions,] = await Promise.all([
        prisma.sectionMirror.count({ where: { schoolId, schoolYearId } }),
        prisma.facultyMirror.count({ where: { schoolId, isActiveForScheduling: true, isStale: false } }),
        prisma.generationRun.count({ where: { schoolId, schoolYearId } }),
        prisma.schedulingPolicy.count({ where: { schoolId, schoolYearId } }),
        prisma.facultySubject.count({ where: { schoolId } }),
        prisma.subjectSectionOwnership.count({ where: { schoolId } }),
        prisma.auditLog.count({ where: { schoolId, schoolYearId } }),
        prisma.enrollProSchoolYearMirror.count({ where: { schoolId, enrollProSchoolYearId: schoolYearId } }),
        prisma.teachingLoadSuggestionProposal.count({ where: { schoolId, schoolYearId } }),
    ]);
    return {
        sectionMirrors,
        facultyMirrors,
        generationRuns,
        schedulingPolicies,
        facultySubjects,
        ownerships,
        auditLogs,
        mirrors,
        teachingLoadSuggestions,
    };
}
async function expectErrorCode(action, expectedCode, label) {
    try {
        await action();
        assert(false, `${label} — expected ${expectedCode}, got success`);
    }
    catch (error) {
        const code = error.code;
        assertEqual(code, expectedCode, label);
    }
}
function enrollProBaseUrl() {
    return process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
}
async function fetchEnrollProJson(path) {
    const response = await fetch(`${enrollProBaseUrl()}${path}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
        throw new Error(`EnrollPro ${path} returned HTTP ${response.status}`);
    }
    return response.json();
}
async function fetchEnrollProStatus(path) {
    const response = await fetch(`${enrollProBaseUrl()}${path}`, { signal: AbortSignal.timeout(10000) });
    await response.arrayBuffer().catch(() => undefined);
    return response.status;
}
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
function payloadRows(payload) {
    const record = asRecord(payload);
    if (Array.isArray(record.data))
        return record.data;
    if (Array.isArray(record.gradeLevels)) {
        return record.gradeLevels.flatMap((grade) => {
            const gradeRecord = asRecord(grade);
            return Array.isArray(gradeRecord.sections) ? gradeRecord.sections : [];
        });
    }
    return [];
}
function hasPositiveId(value) {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric > 0;
}
function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function assertSectionContract(row, label) {
    const section = asRecord(row);
    const grade = asRecord(section.gradeLevel);
    assert(hasPositiveId(section.id), `${label} exposes a positive section id`);
    assert(hasText(section.name), `${label} exposes a section name`);
    assert(hasText(section.programType), `${label} exposes a program type`);
    assert(hasPositiveId(grade.id) || hasPositiveId(grade.displayOrder), `${label} exposes grade identity`);
    assert(Number.isFinite(Number(section.maxCapacity)) || Number.isFinite(Number(section.enrolledCount)), `${label} exposes capacity or enrollment count`);
    if (section.advisingTeacher != null) {
        const adviser = asRecord(section.advisingTeacher);
        assert(hasPositiveId(adviser.id), `${label} adviser exposes teacher id when adviser is present`);
        assert(hasText(adviser.firstName) || hasText(adviser.lastName) || hasText(adviser.fullName), `${label} adviser exposes a readable name when adviser is present`);
    }
}
function assertFacultyContract(row, label) {
    const faculty = asRecord(row);
    assert(hasPositiveId(faculty.teacherId ?? faculty.id), `${label} exposes a positive faculty id`);
    assert(hasText(faculty.fullName) || hasText(faculty.firstName) || hasText(faculty.lastName), `${label} exposes a readable faculty name`);
    assert(typeof faculty.isActive === 'boolean' || typeof faculty.isActiveForScheduling === 'boolean', `${label} exposes active scheduling status`);
    assert('departmentCode' in faculty || 'departmentName' in faculty || 'specialization' in faculty, `${label} exposes department or specialization fields`);
}
function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
    });
    res.end(body);
}
function handleFakeEnrollProRolloverRequest(req, res) {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/api/integration/v1/school-year') {
        sendJson(res, 200, { data: { id: 2, yearLabel: '2027-2028' } });
        return;
    }
    if (url.pathname === '/api/settings/public') {
        sendJson(res, 200, {
            schoolName: 'HNHS',
            activeSchoolYearId: 2,
            activeSchoolYearLabel: '2027-2028',
        });
        return;
    }
    if (url.pathname === '/api/integration/v1/sections') {
        sendJson(res, 200, {
            data: [
                {
                    id: 2001,
                    name: 'Grade 7 Rollover Test',
                    maxCapacity: 45,
                    enrolledCount: 0,
                    programType: 'REGULAR',
                    gradeLevel: { id: 7, name: 'Grade 7', displayOrder: 7 },
                    advisingTeacher: null,
                },
            ],
            meta: { page: 1, limit: 200, totalPages: 1 },
        });
        return;
    }
    if (url.pathname === '/api/integration/v1/faculty' || url.pathname === '/api/integration/v1/default/faculty') {
        sendJson(res, 200, {
            data: [
                {
                    teacherId: 9001,
                    employeeId: 'ROLL-9001',
                    firstName: 'Rollover',
                    lastName: 'Teacher',
                    fullName: 'Rollover Teacher',
                    departmentCode: 'MATH',
                    departmentName: 'Mathematics',
                    specialization: 'Mathematics',
                    isActive: true,
                    isTeachingExempt: false,
                },
            ],
            meta: { page: 1, limit: 200, totalPages: 1 },
        });
        return;
    }
    sendJson(res, 404, { error: 'not found' });
}
async function startFakeEnrollProRolloverServer() {
    const server = createServer(handleFakeEnrollProRolloverRequest);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Fake EnrollPro server did not expose a TCP port.');
    }
    return { server, baseUrl: `http://127.0.0.1:${address.port}/api` };
}
async function stopServer(server) {
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
}
async function run() {
    const schoolId = 1;
    const activeSchoolYearId = 1;
    const staleSchoolYearId = 39;
    const officer = await prisma.atlasAuthAccount.findFirst({
        where: { schoolId, role: { in: ['admin', 'officer', 'SYSTEM_ADMIN'] }, isActive: true },
        orderBy: { id: 'asc' },
        select: { id: true },
    });
    const actorId = officer?.id ?? 0;
    section('Rollover preview contract');
    const beforePreview = await countReadinessRows(schoolId, activeSchoolYearId);
    const preview = await previewRolloverSync(schoolId);
    const afterPreview = await countReadinessRows(schoolId, activeSchoolYearId);
    assertEqual(preview.enrollProActiveYear?.id, activeSchoolYearId, 'EnrollPro active year is canonical schoolYearId=1');
    assertEqual(preview.enrollProActiveYear?.yearLabel, '2026-2027', 'EnrollPro active year label is 2026-2027');
    assertEqual(preview.drift.status, 'aligned', 'Rollover drift is aligned after dummy reset');
    assertEqual(preview.counts?.sectionCount, 20, 'EnrollPro section feed exposes 20 sections');
    assertEqual(preview.counts?.facultyCount, 24, 'EnrollPro faculty feed exposes 24 faculty');
    assertEqual(JSON.stringify(afterPreview), JSON.stringify(beforePreview), 'Rollover preview performs no local writes');
    section('EnrollPro field-level drift contract');
    const yearPayload = asRecord(await fetchEnrollProJson('/integration/v1/school-year'));
    const yearData = asRecord(yearPayload.data ?? yearPayload);
    assertEqual(Number(yearData.id), activeSchoolYearId, 'EnrollPro school-year feed exposes canonical numeric id');
    assertEqual(String(yearData.yearLabel), '2026-2027', 'EnrollPro school-year feed exposes readable year label');
    const sectionPayload = await fetchEnrollProJson('/integration/v1/sections?page=1&limit=3');
    const sectionRows = payloadRows(sectionPayload);
    assertGreaterThanOrEqual(sectionRows.length, 1, 'EnrollPro section feed exposes row data for field drift checks');
    assertSectionContract(sectionRows[0], 'EnrollPro section row');
    const facultyPayload = await fetchEnrollProJson('/integration/v1/default/faculty?page=1&limit=3');
    const facultyRows = payloadRows(facultyPayload);
    assertGreaterThanOrEqual(facultyRows.length, 1, 'EnrollPro faculty feed exposes row data for field drift checks');
    assertFacultyContract(facultyRows[0], 'EnrollPro faculty row');
    const settingsPayload = asRecord(await fetchEnrollProJson('/settings/public'));
    assertEqual(Number(settingsPayload.activeSchoolYearId), activeSchoolYearId, 'EnrollPro public settings exposes activeSchoolYearId');
    assertEqual(String(settingsPayload.activeSchoolYearLabel), '2026-2027', 'EnrollPro public settings exposes activeSchoolYearLabel');
    const subjectOfferingsStatus = await fetchEnrollProStatus('/integration/v1/subject-offerings?page=1&limit=1');
    assert([200, 404, 405].includes(subjectOfferingsStatus), `Optional subject-offerings probe is classified without blocking ATLAS — got HTTP ${subjectOfferingsStatus}`);
    section('Current-year mirror and empty Teaching Load contract');
    assertEqual(beforePreview.sectionMirrors, 20, 'ATLAS mirrors 20 current-year sections');
    assertGreaterThanOrEqual(beforePreview.facultyMirrors, 24, 'ATLAS has at least the 24 active EnrollPro faculty candidates');
    assertGreaterThanOrEqual(beforePreview.schedulingPolicies, 1, 'ATLAS has a current-year scheduling policy baseline');
    assertEqual(beforePreview.generationRuns, 0, 'ATLAS starts the active year without current-year generation runs');
    assertEqual(beforePreview.facultySubjects, 0, 'Teaching Load faculty-subject ownership starts empty');
    assertEqual(beforePreview.ownerships, 0, 'Teaching Load section ownership starts empty');
    section('Reset and generation guards');
    await expectErrorCode(() => resetDummyYearAndApplyRollover({
        schoolId,
        actorId,
        confirmReset: true,
        confirmationText: 'WRONG_CONFIRMATION',
    }), 'CONFIRMATION_REQUIRED', 'Dummy reset apply requires the exact confirmation phrase');
    await expectErrorCode(() => triggerGenerationRun(schoolId, staleSchoolYearId, actorId), 'ACTIVE_YEAR_DRIFT', 'Stale-year generation is blocked by EnrollPro active-year drift');
    await expectErrorCode(() => triggerGenerationRun(schoolId, activeSchoolYearId, actorId), 'TEACHING_LOAD_REVIEW_REQUIRED', 'Current-year generation is blocked until Teaching Load is reviewed');
    section('Simulated EnrollPro next-year rollover');
    const originalEnrollProApi = process.env.ENROLLPRO_API;
    const fakeEnrollPro = await startFakeEnrollProRolloverServer();
    const beforeSimulatedNextYear = await countReadinessRows(schoolId, 2);
    try {
        process.env.ENROLLPRO_API = fakeEnrollPro.baseUrl;
        const simulatedPreview = await previewRolloverSync(schoolId);
        const afterSimulatedPreview = await countReadinessRows(schoolId, 2);
        assertEqual(simulatedPreview.enrollProActiveYear?.id, 2, 'Simulated EnrollPro rollover exposes next canonical schoolYearId=2');
        assertEqual(simulatedPreview.enrollProActiveYear?.yearLabel, '2027-2028', 'Simulated EnrollPro rollover exposes readable 2027-2028 label');
        assertEqual(simulatedPreview.drift.status, 'atlas-stale', 'ATLAS reports atlas-stale when EnrollPro has rolled to the next year');
        assertEqual(simulatedPreview.drift.recommendedAction, 'RUN_ROLLOVER_SYNC', 'Next-year drift recommends rollover sync');
        assertEqual(simulatedPreview.counts?.sectionCount, 1, 'Simulated next-year section feed is counted from live-shaped EnrollPro data');
        assertEqual(simulatedPreview.counts?.facultyCount, 1, 'Simulated next-year faculty feed is counted from live-shaped EnrollPro data');
        assertEqual(JSON.stringify(afterSimulatedPreview), JSON.stringify(beforeSimulatedNextYear), 'Simulated next-year rollover preview performs no local writes');
        await expectErrorCode(() => triggerGenerationRun(schoolId, activeSchoolYearId, actorId), 'ACTIVE_YEAR_DRIFT', 'Generation against the old active year is blocked after simulated EnrollPro rollover');
    }
    finally {
        if (originalEnrollProApi === undefined) {
            delete process.env.ENROLLPRO_API;
        }
        else {
            process.env.ENROLLPRO_API = originalEnrollProApi;
        }
        await stopServer(fakeEnrollPro.server);
    }
    section('Reversible setup-to-generation fixture');
    const beforeFixture = await countReadinessRows(schoolId, activeSchoolYearId);
    const createdRunIds = [];
    const createdProposalIds = [];
    try {
        const cancelProposal = await createTeachingLoadSuggestionProposal({
            schoolId,
            schoolYearId: activeSchoolYearId,
            actorId,
            coverageMode: 'REAL_FACULTY_HARD_CAP',
        });
        createdProposalIds.push(cancelProposal.proposal.id);
        const cancelledProposal = await cancelTeachingLoadSuggestionProposal({ proposalId: cancelProposal.proposal.id });
        const afterProposalCancel = await countReadinessRows(schoolId, activeSchoolYearId);
        assertEqual(cancelledProposal.proposal.status, 'CANCELLED', 'Teaching Load suggestion proposal cancel marks unused proposals cancelled');
        assertEqual(afterProposalCancel.facultySubjects, beforeFixture.facultySubjects, 'Teaching Load suggestion proposal cancel performs no FacultySubject writes');
        assertEqual(afterProposalCancel.ownerships, beforeFixture.ownerships, 'Teaching Load suggestion proposal cancel performs no ownership writes');
        const proposal = await createTeachingLoadSuggestionProposal({
            schoolId,
            schoolYearId: activeSchoolYearId,
            actorId,
            coverageMode: 'REAL_FACULTY_HARD_CAP',
        });
        createdProposalIds.push(proposal.proposal.id);
        const afterProposalPreview = await countReadinessRows(schoolId, activeSchoolYearId);
        assertEqual(afterProposalPreview.facultySubjects, beforeFixture.facultySubjects, 'Teaching Load suggestion proposal preview performs no FacultySubject writes');
        assertEqual(afterProposalPreview.ownerships, beforeFixture.ownerships, 'Teaching Load suggestion proposal preview performs no ownership writes');
        assertEqual(proposal.proposal.status, 'PENDING', 'Teaching Load suggestion proposal is saved for officer review before apply');
        assertGreaterThanOrEqual(proposal.proposal.suggestedAssignmentCount, 1, 'Teaching Load suggestion proposal records suggested assignment count');
        const appliedProposal = await applyTeachingLoadSuggestionProposal({
            proposalId: proposal.proposal.id,
            actorId,
        });
        assertEqual(appliedProposal.proposal.status, 'APPLIED', 'Teaching Load suggestion proposal apply marks the proposal applied');
        const fill = appliedProposal.applyResult;
        const afterFill = await countReadinessRows(schoolId, activeSchoolYearId);
        assertGreaterThanOrEqual(fill.assignmentsCreated, 1, 'Teaching Load fixture creates normalized assignment rows');
        assertGreaterThanOrEqual(afterFill.ownerships, 1, 'Teaching Load fixture writes normalized section ownership');
        const run = await triggerGenerationRun(schoolId, activeSchoolYearId, actorId, {
            roomerStrategy: 'HOME_ROOM_FIRST',
        });
        createdRunIds.push(run.id);
        const persistedRun = await prisma.generationRun.findUnique({
            where: { id: run.id },
            select: { status: true, draftEntries: true },
        });
        assertEqual(persistedRun?.status, 'COMPLETED', 'Current-year generation succeeds after normalized Teaching Load fixture');
        assertGreaterThanOrEqual(Array.isArray(persistedRun?.draftEntries) ? persistedRun.draftEntries.length : 0, 1, 'Generated current-year timetable contains entries');
    }
    finally {
        if (createdRunIds.length > 0) {
            await prisma.manualScheduleEdit.deleteMany({ where: { schoolId, schoolYearId: activeSchoolYearId, runId: { in: createdRunIds } } });
            await prisma.followUpFlag.deleteMany({ where: { runId: { in: createdRunIds } } });
            await prisma.auditLog.deleteMany({
                where: {
                    schoolId,
                    schoolYearId: activeSchoolYearId,
                    targetIds: { hasSome: createdRunIds },
                },
            });
            await prisma.generationRun.deleteMany({ where: { id: { in: createdRunIds } } });
        }
        await prisma.subjectSectionOwnership.deleteMany({ where: { schoolId } });
        await prisma.facultySubject.deleteMany({ where: { schoolId } });
        if (createdProposalIds.length > 0) {
            await prisma.teachingLoadSuggestionProposal.deleteMany({ where: { id: { in: createdProposalIds } } });
        }
    }
    const afterFixture = await countReadinessRows(schoolId, activeSchoolYearId);
    assertEqual(afterFixture.generationRuns, beforeFixture.generationRuns, 'Generation fixture cleanup restores current-year run count');
    assertEqual(afterFixture.facultySubjects, beforeFixture.facultySubjects, 'Generation fixture cleanup restores FacultySubject count');
    assertEqual(afterFixture.ownerships, beforeFixture.ownerships, 'Generation fixture cleanup restores SubjectSectionOwnership count');
    assertEqual(afterFixture.auditLogs, beforeFixture.auditLogs, 'Generation fixture cleanup restores current-year audit log count');
    assertEqual(afterFixture.teachingLoadSuggestions, beforeFixture.teachingLoadSuggestions, 'Generation fixture cleanup restores Teaching Load suggestion proposal count');
    console.log(`\nEnrollPro rollover readiness test complete: ${passCount} passed, ${failCount} failed.`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=enrollpro-rollover-readiness.test.js.map