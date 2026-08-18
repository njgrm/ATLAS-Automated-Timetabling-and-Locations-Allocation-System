/**
 * AIMS Teaching Load Proposal Isolation Test
 *
 * Proves that suggestion preview/cancel does not mutate canonical Teaching Load
 * or published schedules. This is the contract guardrail for Prompt 01.
 *
 * Test flow:
 *   1. Resolve active school year dynamically from runtime context.
 *   2. Snapshot canonical TL counts and published schedule state.
 *   3. Create a suggestion proposal (previewOnly: true).
 *   4. Assert canonical TL counts are unchanged.
 *   5. Assert published schedule is unchanged.
 *   6. Cancel the proposal.
 *   7. Assert canonical TL counts are still unchanged.
 *   8. Assert published schedule is still unchanged.
 *   9. Assert proposal status is CANCELLED.
 */
import { prisma } from '../lib/prisma.js';
import { createTeachingLoadSuggestionProposal, cancelTeachingLoadSuggestionProposal, } from '../services/teaching-load-suggestion-proposal.service.js';
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
function assertDeepEqual(actual, expected, label) {
    const a = JSON.stringify(actual, (_key, value) => (value instanceof Date ? value.toISOString() : value));
    const b = JSON.stringify(expected, (_key, value) => (value instanceof Date ? value.toISOString() : value));
    assert(a === b, `${label}\n  expected: ${b}\n  received: ${a}`);
}
async function snapshotTlCounts(schoolId, schoolYearId) {
    const [facultySubjects, ownerships, proposals] = await Promise.all([
        prisma.facultySubject.count({ where: { schoolId } }),
        prisma.subjectSectionOwnership.count({ where: { schoolId } }),
        prisma.teachingLoadSuggestionProposal.findMany({
            where: { schoolId, schoolYearId, status: 'PENDING' },
            select: { id: true, status: true },
        }),
    ]);
    return { facultySubjects, ownerships, pendingProposals: proposals.length, proposalIds: proposals.map((p) => p.id) };
}
async function snapshotPublishedSchedule(schoolId) {
    const runs = await prisma.generationRun.findMany({
        where: { schoolId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
            id: true,
            schoolYearId: true,
            summary: true,
            draftEntries: true,
            createdAt: true,
        },
    });
    const publishedRuns = runs.filter((r) => {
        const s = r.summary;
        return s?.isPublished === true;
    });
    return {
        completedCount: runs.length,
        publishedCount: publishedRuns.length,
        latestPublishedRunId: publishedRuns[0]?.id ?? null,
        latestPublishedSchoolYearId: publishedRuns[0]?.schoolYearId ?? null,
        entryCount: publishedRuns[0]
            ? Array.isArray(publishedRuns[0].draftEntries)
                ? publishedRuns[0].draftEntries.length
                : 0
            : 0,
    };
}
async function run() {
    const DEFAULT_SCHOOL_ID = 1;
    // Step 1: Resolve active school year dynamically
    section('Resolve active school year');
    let activeSchoolYearId = null;
    try {
        const mirrors = await prisma.enrollProSchoolYearMirror.findMany({
            where: { schoolId: DEFAULT_SCHOOL_ID, isActive: true },
            orderBy: { lastSyncedAt: 'desc' },
            take: 1,
            select: { enrollProSchoolYearId: true, yearLabel: true },
        });
        if (mirrors.length > 0) {
            activeSchoolYearId = mirrors[0].enrollProSchoolYearId;
            console.log(`  Active school year: ${activeSchoolYearId} (${mirrors[0].yearLabel})`);
        }
    }
    catch {
        // If the mirror table doesn't exist or query fails, fall back to latest run
    }
    if (activeSchoolYearId == null) {
        const latestRun = await prisma.generationRun.findFirst({
            where: { schoolId: DEFAULT_SCHOOL_ID },
            orderBy: { createdAt: 'desc' },
            select: { schoolYearId: true },
        });
        if (latestRun) {
            activeSchoolYearId = latestRun.schoolYearId;
            console.log(`  Fallback school year from latest run: ${activeSchoolYearId}`);
        }
    }
    assert(activeSchoolYearId != null, 'Could not resolve active school year');
    const schoolYearId = activeSchoolYearId;
    // Step 2: Snapshot canonical TL counts and published schedule state
    section('Snapshot baseline state');
    const beforeTl = await snapshotTlCounts(DEFAULT_SCHOOL_ID, schoolYearId);
    const beforePublished = await snapshotPublishedSchedule(DEFAULT_SCHOOL_ID);
    console.log(`  FacultySubject rows: ${beforeTl.facultySubjects}`);
    console.log(`  SubjectSectionOwnership rows: ${beforeTl.ownerships}`);
    console.log(`  Pending proposals: ${beforeTl.pendingProposals}`);
    console.log(`  Completed runs: ${beforePublished.completedCount}`);
    console.log(`  Published runs: ${beforePublished.publishedCount}`);
    console.log(`  Latest published run ID: ${beforePublished.latestPublishedRunId}`);
    console.log(`  Latest published entry count: ${beforePublished.entryCount}`);
    // Step 3: Create suggestion proposal (preview only)
    section('Create suggestion proposal (previewOnly)');
    let proposalId = null;
    try {
        const proposal = await createTeachingLoadSuggestionProposal({
            schoolId: DEFAULT_SCHOOL_ID,
            schoolYearId,
            actorId: 0,
            coverageMode: 'REAL_FACULTY_THEN_TEACHER_X',
        });
        proposalId = proposal.proposal.id;
        console.log(`  Created proposal ID: ${proposalId}`);
        console.log(`  Proposal status: ${proposal.proposal.status}`);
        console.log(`  Suggested assignment count: ${proposal.proposal.suggestedAssignmentCount}`);
        console.log(`  Preview suggested rows: ${proposal.preview.suggestedRows?.length ?? 0}`);
        // Step 4: Assert canonical TL counts are unchanged
        section('Verify canonical TL counts unchanged after preview');
        const afterPreviewTl = await snapshotTlCounts(DEFAULT_SCHOOL_ID, schoolYearId);
        assertEqual(afterPreviewTl.facultySubjects, beforeTl.facultySubjects, 'FacultySubject count unchanged after preview');
        assertEqual(afterPreviewTl.ownerships, beforeTl.ownerships, 'SubjectSectionOwnership count unchanged after preview');
        // One new pending proposal should exist (ours)
        assertEqual(afterPreviewTl.pendingProposals, beforeTl.pendingProposals + 1, 'One new pending proposal created');
        // Step 5: Assert published schedule is unchanged
        section('Verify published schedule unchanged after preview');
        const afterPreviewPublished = await snapshotPublishedSchedule(DEFAULT_SCHOOL_ID);
        assertEqual(afterPreviewPublished.completedCount, beforePublished.completedCount, 'Completed run count unchanged after preview');
        assertEqual(afterPreviewPublished.publishedCount, beforePublished.publishedCount, 'Published run count unchanged after preview');
        assertEqual(afterPreviewPublished.latestPublishedRunId, beforePublished.latestPublishedRunId, 'Latest published run ID unchanged after preview');
        assertEqual(afterPreviewPublished.entryCount, beforePublished.entryCount, 'Published entry count unchanged after preview');
        // Step 6: Cancel the proposal
        section('Cancel proposal');
        const cancelResult = await cancelTeachingLoadSuggestionProposal({ proposalId });
        assertEqual(cancelResult.proposal.status, 'CANCELLED', 'Proposal status is CANCELLED');
        console.log(`  Cancelled proposal ${proposalId}`);
        // Step 7: Assert canonical TL counts still unchanged
        section('Verify canonical TL counts unchanged after cancel');
        const afterCancelTl = await snapshotTlCounts(DEFAULT_SCHOOL_ID, schoolYearId);
        assertEqual(afterCancelTl.facultySubjects, beforeTl.facultySubjects, 'FacultySubject count unchanged after cancel');
        assertEqual(afterCancelTl.ownerships, beforeTl.ownerships, 'SubjectSectionOwnership count unchanged after cancel');
        assertEqual(afterCancelTl.pendingProposals, beforeTl.pendingProposals, 'Pending proposal count restored after cancel');
        // Step 8: Assert published schedule still unchanged
        section('Verify published schedule unchanged after cancel');
        const afterCancelPublished = await snapshotPublishedSchedule(DEFAULT_SCHOOL_ID);
        assertEqual(afterCancelPublished.completedCount, beforePublished.completedCount, 'Completed run count unchanged after cancel');
        assertEqual(afterCancelPublished.publishedCount, beforePublished.publishedCount, 'Published run count unchanged after cancel');
        assertEqual(afterCancelPublished.latestPublishedRunId, beforePublished.latestPublishedRunId, 'Latest published run ID unchanged after cancel');
        assertEqual(afterCancelPublished.entryCount, beforePublished.entryCount, 'Published entry count unchanged after cancel');
    }
    catch (error) {
        // Clean up proposal if it was created
        if (proposalId != null) {
            try {
                await cancelTeachingLoadSuggestionProposal({ proposalId });
                console.log(`  Cleaned up proposal ${proposalId} after error`);
            }
            catch {
                console.error(`  Failed to clean up proposal ${proposalId}`);
            }
        }
        throw error;
    }
    // Step 9: Assert no proposals remain pending
    section('Final state verification');
    const finalTl = await snapshotTlCounts(DEFAULT_SCHOOL_ID, schoolYearId);
    assertEqual(finalTl.pendingProposals, beforeTl.pendingProposals, 'No pending proposals remain after cleanup');
    section('Summary');
    console.log(`  Pass: ${passCount}`);
    console.log(`  Fail: ${failCount}`);
    if (failCount > 0) {
        process.exit(1);
    }
}
run();
//# sourceMappingURL=aims-teaching-load-proposal-isolation.test.js.map