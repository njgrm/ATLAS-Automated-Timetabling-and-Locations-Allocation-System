import { prisma } from '../lib/prisma.js';
import { getRunViolations } from '../services/generation.service.js';
let passCount = 0;
let failCount = 0;
function section(name) {
    console.log(`\n=== ${name} ===`);
}
function assert(condition, label) {
    if (condition) {
        passCount += 1;
        console.log(`  OK ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  FAIL ${label}`);
}
function assertEqual(actual, expected, label) {
    if (actual === expected) {
        passCount += 1;
        console.log(`  OK ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  FAIL ${label} - expected ${String(expected)}, got ${String(actual)}`);
}
async function run() {
    const faculty = await prisma.facultyMirror.findFirst({
        where: { isActiveForScheduling: true, isStale: false },
        orderBy: { id: 'asc' },
        select: { id: true, schoolId: true },
    });
    const actor = await prisma.atlasAuthAccount.findFirst({
        where: { role: 'officer', isActive: true },
        orderBy: { id: 'asc' },
        select: { id: true },
    });
    if (!faculty || !actor) {
        console.error('\nMissing seeded data for term-scoped violation test.');
        process.exitCode = 1;
        await prisma.$disconnect();
        return;
    }
    const schoolId = faculty.schoolId;
    const schoolYearId = 1;
    const now = Date.now();
    const run = await prisma.generationRun.create({
        data: {
            schoolId,
            schoolYearId,
            status: 'COMPLETED',
            runType: 'FULL',
            triggeredBy: actor.id,
            startedAt: new Date(now - 8000),
            finishedAt: new Date(now - 3000),
            durationMs: 5000,
            summary: {
                violationCounts: {
                    TERM_1_LOCK: 1,
                    TERM_2_LOCK: 1,
                    TERM_2_ENTRY: 1,
                    GENERIC_WARNING: 1,
                },
            },
            violations: [
                { code: 'TERM_1_LOCK', severity: 'SOFT', meta: { termIndex: 1 } },
                { code: 'TERM_2_LOCK', severity: 'SOFT', meta: { termIndex: 2 } },
                { code: 'TERM_2_ENTRY', severity: 'HARD', entities: { entryIds: ['entry-term-2'] } },
                { code: 'GENERIC_WARNING', severity: 'SOFT' },
            ],
            draftEntries: [
                {
                    entryId: 'entry-term-1',
                    subjectId: 1,
                    sectionId: 1,
                    facultyId: faculty.id,
                    roomId: 1,
                    day: 'MONDAY',
                    startTime: '07:00',
                    endTime: '08:00',
                    durationMinutes: 60,
                    termIndex: 1,
                },
                {
                    entryId: 'entry-term-2',
                    subjectId: 1,
                    sectionId: 1,
                    facultyId: faculty.id,
                    roomId: 1,
                    day: 'TUESDAY',
                    startTime: '08:00',
                    endTime: '09:00',
                    durationMinutes: 60,
                    termIndex: 2,
                },
                {
                    entryId: 'entry-term-3',
                    subjectId: 1,
                    sectionId: 1,
                    facultyId: faculty.id,
                    roomId: 1,
                    day: 'WEDNESDAY',
                    startTime: '09:00',
                    endTime: '10:00',
                    durationMinutes: 60,
                    termIndex: 3,
                },
            ],
            unassignedItems: [],
        },
    });
    try {
        section('TERM-VIOL-01 returns all violations when no term filter');
        const all = await getRunViolations(run.id, schoolId, schoolYearId);
        assertEqual(all.violations.length, 4, 'All violations returned without term filter');
        section('TERM-VIOL-02 filters to term 2 by explicit meta and entry references');
        const term2 = await getRunViolations(run.id, schoolId, schoolYearId, 2);
        const term2Codes = term2.violations.map((v) => v.code).sort();
        assertEqual(JSON.stringify(term2Codes), JSON.stringify(['GENERIC_WARNING', 'TERM_2_ENTRY', 'TERM_2_LOCK']), 'Term 2 includes matching and generic violations only');
        section('TERM-VIOL-03 filters to term 1 correctly');
        const term1 = await getRunViolations(run.id, schoolId, schoolYearId, 1);
        const term1Codes = term1.violations.map((v) => v.code).sort();
        assertEqual(JSON.stringify(term1Codes), JSON.stringify(['GENERIC_WARNING', 'TERM_1_LOCK']), 'Term 1 includes explicit + generic violations');
        section('TERM-VIOL-04 ignores invalid term filter values');
        const invalid = await getRunViolations(run.id, schoolId, schoolYearId, 99);
        assertEqual(invalid.violations.length, 4, 'Invalid term filter falls back to unfiltered violations');
        assert(Boolean(invalid.counts.byCode.TERM_2_LOCK), 'Violation byCode summary remains available');
    }
    finally {
        await prisma.generationRun.delete({ where: { id: run.id } }).catch(() => { });
        await prisma.$disconnect();
    }
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run().catch((error) => {
    console.error('\nUnhandled term-scoped violations test error:', error);
    process.exit(1);
});
//# sourceMappingURL=term-scoped-violations.test.js.map