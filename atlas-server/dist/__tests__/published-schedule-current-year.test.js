import app from '../app.js';
import { prisma } from '../lib/prisma.js';
let passCount = 0;
let failCount = 0;
let server;
let baseUrl;
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
async function requestJson(path) {
    const response = await fetch(`${baseUrl}${path}`);
    let body = null;
    try {
        body = await response.json();
    }
    catch {
        body = null;
    }
    return { status: response.status, body };
}
async function run() {
    const DEFAULT_SCHOOL_ID = 1;
    // Start the server
    section('Setup: start server');
    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const addr = server.address();
            if (addr && typeof addr === 'object') {
                baseUrl = `http://localhost:${addr.port}`;
            }
            resolve();
        });
    });
    console.log(`  Server listening on ${baseUrl}`);
    try {
        // Step 1: Resolve active school year
        section('Resolve active school year');
        const mirrors = await prisma.enrollProSchoolYearMirror.findMany({
            where: { schoolId: DEFAULT_SCHOOL_ID, isActive: true },
            orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
            take: 1,
            select: { enrollProSchoolYearId: true, yearLabel: true },
        });
        assert(mirrors.length > 0, 'Active school year mirror exists');
        const activeSchoolYearId = mirrors[0].enrollProSchoolYearId;
        console.log(`  Active school year: ${activeSchoolYearId} (${mirrors[0].yearLabel})`);
        // Step 2: Find a historical published run (different school year)
        section('Find historical published run');
        const historicalRuns = await prisma.generationRun.findMany({
            where: {
                schoolId: DEFAULT_SCHOOL_ID,
                status: 'COMPLETED',
                schoolYearId: { not: activeSchoolYearId },
            },
            orderBy: [{ createdAt: 'desc' }],
            take: 5,
            select: { id: true, schoolYearId: true, summary: true },
        });
        const historicalPublished = historicalRuns.find((r) => {
            const s = r.summary;
            return s?.isPublished === true;
        });
        if (historicalPublished) {
            console.log(`  Historical published run: ID ${historicalPublished.id}, schoolYearId ${historicalPublished.schoolYearId}`);
        }
        else {
            console.log('  No historical published runs found (all published runs may be current year)');
        }
        // Step 3: Verify default endpoint returns active-year published run
        section('Verify default endpoint returns active-year published run');
        const defaultResponse = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/schedules/published`);
        if (defaultResponse.status === 200) {
            assertEqual(defaultResponse.body.source?.schoolYearId, activeSchoolYearId, 'Default endpoint returns active school year ID');
            console.log(`  Default endpoint returned schoolYearId: ${defaultResponse.body.source?.schoolYearId}`);
        }
        else if (defaultResponse.status === 404) {
            assertEqual(defaultResponse.body.code, 'CURRENT_PUBLISHED_RUN_NOT_FOUND', 'Default endpoint returns CURRENT_PUBLISHED_RUN_NOT_FOUND when no active-year published run');
            console.log('  Default endpoint correctly returned 404 CURRENT_PUBLISHED_RUN_NOT_FOUND');
        }
        else {
            assert(false, `Default endpoint returned unexpected status ${defaultResponse.status}: ${JSON.stringify(defaultResponse.body)}`);
        }
        // Step 4: Verify explicit historical year endpoint still works
        if (historicalPublished) {
            section('Verify explicit historical year endpoint still works');
            const historicalResponse = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/schedules/published/${historicalPublished.schoolYearId}`);
            assertEqual(historicalResponse.status, 200, 'Historical year endpoint returns 200');
            assertEqual(historicalResponse.body.source?.schoolYearId, historicalPublished.schoolYearId, 'Historical endpoint returns correct school year ID');
            console.log(`  Historical endpoint returned schoolYearId: ${historicalResponse.body.source?.schoolYearId}`);
        }
        else {
            section('Verify explicit historical year endpoint still works');
            console.log('  Skipped: no historical published runs to test against');
        }
        // Step 5: Verify default endpoint does not return historical run when active year differs
        if (historicalPublished) {
            section('Verify default endpoint does not return historical run');
            const defaultResponse2 = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/schedules/published`);
            if (defaultResponse2.status === 200) {
                const returnedYear = defaultResponse2.body.source?.schoolYearId;
                const isHistorical = returnedYear === historicalPublished.schoolYearId && returnedYear !== activeSchoolYearId;
                assert(!isHistorical, `Default endpoint did not return historical run ${historicalPublished.id} (schoolYearId ${historicalPublished.schoolYearId}) as current`);
            }
        }
    }
    finally {
        // Clean up: close server
        section('Cleanup');
        await new Promise((resolve) => {
            server.close(() => resolve());
        });
        console.log('  Server closed');
    }
    section('Summary');
    console.log(`  Pass: ${passCount}`);
    console.log(`  Fail: ${failCount}`);
    if (failCount > 0) {
        process.exit(1);
    }
}
run();
//# sourceMappingURL=published-schedule-current-year.test.js.map