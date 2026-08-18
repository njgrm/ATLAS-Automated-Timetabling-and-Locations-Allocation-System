/**
 * Teaching Load suggestion preview test.
 *
 * Proves that suggestedAssignmentBreakdown and suggestedRows are consistent
 * when auto-fill produces a mix of existing, real-teacher, and substitute rows.
 *
 * This test calls createTeachingLoadSuggestionProposal against live Tailnet data
 * and verifies the row counts match the breakdown.
 */
import { prisma } from '../lib/prisma.js';
import { createTeachingLoadSuggestionProposal, cancelTeachingLoadSuggestionProposal } from '../services/teaching-load-suggestion-proposal.service.js';

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n════ ${name} ════`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	assert(actual === expected, `${label} — expected ${String(expected)}, got ${String(actual)}`);
}

function assertGreaterThanOrEqual(actual: number, expected: number, label: string) {
	assert(actual >= expected, `${label} — expected >= ${expected}, got ${actual}`);
}

async function run() {
	const schoolId = 1;
	const schoolYearId = 5;
	const actorId = 1;

	section('Cleanup: cancel any pending proposals');
	const pendingProposals = await prisma.teachingLoadSuggestionProposal.findMany({
		where: { schoolId, schoolYearId, status: 'PENDING' },
		select: { id: true },
	});
	for (const p of pendingProposals) {
		await cancelTeachingLoadSuggestionProposal({ proposalId: p.id });
	}

	section('Create proposal with REAL_FACULTY_THEN_TEACHER_X coverage mode');
	const proposal = await createTeachingLoadSuggestionProposal({
		schoolId,
		schoolYearId,
		actorId,
		coverageMode: 'REAL_FACULTY_THEN_TEACHER_X',
	});

	const breakdown = proposal.proposal.suggestedAssignmentBreakdown;
	const suggestedRows = proposal.preview.suggestedRows ?? [];

	section('Verify breakdown counts');
	assert(breakdown !== undefined, 'suggestedAssignmentBreakdown is present in proposal response');
	assertEqual(typeof breakdown?.existingRows, 'number', 'existingRows is a number');
	assertEqual(typeof breakdown?.realTeacherRows, 'number', 'realTeacherRows is a number');
	assertEqual(typeof breakdown?.substituteRows, 'number', 'substituteRows is a number');
	assertEqual(typeof breakdown?.newSuggestedRows, 'number', 'newSuggestedRows is a number');
	assertEqual(typeof breakdown?.previewRowCount, 'number', 'previewRowCount is a number');
	assertEqual(typeof breakdown?.unresolvedRows, 'number', 'unresolvedRows is a number');
	assertGreaterThanOrEqual(breakdown!.newSuggestedRows, 0, 'newSuggestedRows >= 0');
	assertEqual(breakdown!.newSuggestedRows, breakdown!.realTeacherRows + breakdown!.substituteRows, 'newSuggestedRows = realTeacherRows + substituteRows');
	assertEqual(breakdown!.previewRowCount, breakdown!.existingRows + breakdown!.realTeacherRows + breakdown!.substituteRows, 'previewRowCount = existingRows + realTeacherRows + substituteRows');

	section('Verify suggestedAssignmentCount equals newSuggestedRows');
	assertEqual(proposal.proposal.suggestedAssignmentCount, breakdown!.newSuggestedRows, `suggestedAssignmentCount (${proposal.proposal.suggestedAssignmentCount}) equals newSuggestedRows (${breakdown!.newSuggestedRows})`);

	section('Verify suggestedRows length matches previewRowCount');
	assertEqual(suggestedRows.length, breakdown!.previewRowCount, `suggestedRows.length (${suggestedRows.length}) equals previewRowCount (${breakdown!.previewRowCount})`);

	section('Verify breakdown derived from suggestedRows (single source of truth)');
	const typeCounts = new Map<string, number>();
	for (const row of suggestedRows) {
		typeCounts.set(row.assignmentType, (typeCounts.get(row.assignmentType) ?? 0) + 1);
	}
	assertEqual(breakdown!.existingRows, typeCounts.get('KEPT_EXISTING') ?? 0, 'breakdown.existingRows matches KEPT_EXISTING count in suggestedRows');
	assertEqual(breakdown!.realTeacherRows, typeCounts.get('REAL_TEACHER') ?? 0, 'breakdown.realTeacherRows matches REAL_TEACHER count in suggestedRows');
	assertEqual(breakdown!.substituteRows, typeCounts.get('TEMPORARY_SUBSTITUTE') ?? 0, 'breakdown.substituteRows matches TEMPORARY_SUBSTITUTE count in suggestedRows');
	assertEqual(breakdown!.previewRowCount, suggestedRows.length, 'breakdown.previewRowCount equals suggestedRows.length');

	section('Verify suggestedRows have real names');
	for (const row of suggestedRows) {
		assert(typeof row.subjectCode === 'string' && row.subjectCode.length > 0, `Row has subjectCode: ${row.subjectCode}`);
		assert(typeof row.subjectName === 'string' && row.subjectName.length > 0, `Row has subjectName: ${row.subjectName}`);
		assert(typeof row.sectionName === 'string' && row.sectionName.length > 0, `Row has sectionName: ${row.sectionName}`);
		assert(typeof row.assignmentType === 'string', `Row has assignmentType: ${row.assignmentType}`);

		if (row.assignmentType === 'REAL_TEACHER') {
			assert(typeof row.facultyName === 'string' && row.facultyName.length > 0, `REAL_TEACHER row has facultyName: ${row.facultyName}`);
			assert(!row.facultyName.includes('Suggested'), `REAL_TEACHER row facultyName is not placeholder: ${row.facultyName}`);
		} else if (row.assignmentType === 'TEMPORARY_SUBSTITUTE') {
			assertEqual(row.facultyName, 'Temporary substitute', 'TEMPORARY_SUBSTITUTE row has correct facultyName');
		} else if (row.assignmentType === 'KEPT_EXISTING') {
			// KEPT_EXISTING rows are valid
		} else {
			assert(false, `Unexpected assignmentType: ${row.assignmentType}`);
		}
	}

	section('Cleanup: cancel the proposal');
	await cancelTeachingLoadSuggestionProposal({ proposalId: proposal.proposal.id });

	section('Summary');
	console.log(`  Pass: ${passCount}`);
	console.log(`  Fail: ${failCount}`);
	if (failCount > 0) {
		process.exit(1);
	}
}

run();
