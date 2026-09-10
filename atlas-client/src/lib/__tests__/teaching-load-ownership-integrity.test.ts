import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	buildSaveCommitReceipt,
	transferExactSectionPair,
	type TeachingLoadDraftMap,
} from '@/lib/teaching-load-helpers';

const root = resolve(import.meta.dirname, '../../..');

function source(path: string): string {
	return readFileSync(resolve(root, path), 'utf8');
}

// ─── Exact-pair transfer production helper ────────────────────────────────

function draft(subjectId: number, sectionIds: number[]) {
	return { subjectId, sectionIds, gradeLevels: [] };
}

test('exact-pair transfer moves exactly the selected section and nothing else', () => {
	const saved: TeachingLoadDraftMap = { 10: [draft(1, [101, 102])], 11: [] };
	const result = transferExactSectionPair({
		assignmentsByFaculty: saved,
		savedAssignmentsByFaculty: saved,
		subjectId: 1,
		sectionId: 101,
		fromFacultyId: 10,
		toFacultyId: 11,
	});
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.deepEqual(result.updates[10], [draft(1, [102])]);
	assert.deepEqual(result.updates[11], [draft(1, [101])]);
});

test('exact-pair transfer never invents a two-way exchange from the recipient first section', () => {
	// The recipient already owns section 999 for this subject. A transfer of 101
	// must leave 999 with the recipient, not hand it back to the donor.
	const saved: TeachingLoadDraftMap = { 10: [draft(1, [101])], 11: [draft(1, [999])] };
	const result = transferExactSectionPair({
		assignmentsByFaculty: saved,
		savedAssignmentsByFaculty: saved,
		subjectId: 1,
		sectionId: 101,
		fromFacultyId: 10,
		toFacultyId: 11,
	});
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.deepEqual(result.updates[10], []);
	assert.deepEqual(result.updates[11], [draft(1, [999, 101])]);
	// NEGATIVE CONTROL: the receipt must not contain 999 for the donor.
	assert.ok(!JSON.stringify(result.updates[10] ?? []).includes('999'));
});

test('exact-pair transfer rejects a donor that does not own the pair', () => {
	const saved: TeachingLoadDraftMap = { 10: [draft(1, [102])], 11: [] };
	const result = transferExactSectionPair({
		assignmentsByFaculty: saved,
		savedAssignmentsByFaculty: saved,
		subjectId: 1,
		sectionId: 101,
		fromFacultyId: 10,
		toFacultyId: 11,
	});
	assert.equal(result.ok, false);
	if (result.ok) return;
	assert.equal(result.code, 'DONOR_DOES_NOT_OWN');
});

test('exact-pair transfer rejects a missing destination and a same-teacher target', () => {
	const saved: TeachingLoadDraftMap = { 10: [draft(1, [101])] };
	const noDestination = transferExactSectionPair({
		assignmentsByFaculty: saved,
		savedAssignmentsByFaculty: saved,
		subjectId: 1,
		sectionId: 101,
		fromFacultyId: 10,
		toFacultyId: null,
	});
	assert.equal(noDestination.ok, false);
	if (!noDestination.ok) assert.equal(noDestination.code, 'NO_DESTINATION');

	const sameTeacher = transferExactSectionPair({
		assignmentsByFaculty: saved,
		savedAssignmentsByFaculty: saved,
		subjectId: 1,
		sectionId: 101,
		fromFacultyId: 10,
		toFacultyId: 10,
	});
	assert.equal(sameTeacher.ok, false);
	if (!sameTeacher.ok) assert.equal(sameTeacher.code, 'SAME_TEACHER');
});

test('exact-pair transfer reads pending drafts over saved rows', () => {
	const saved: TeachingLoadDraftMap = { 10: [draft(1, [101])], 11: [] };
	const pending: TeachingLoadDraftMap = { 10: [], 11: [draft(1, [101])] };
	const result = transferExactSectionPair({
		assignmentsByFaculty: pending,
		savedAssignmentsByFaculty: saved,
		subjectId: 1,
		sectionId: 101,
		fromFacultyId: 11,
		toFacultyId: 10,
	});
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.deepEqual(result.updates[11], []);
	assert.deepEqual(result.updates[10], [draft(1, [101])]);
});

// ─── Partial-commit receipt ───────────────────────────────────────────────

test('save receipt names exactly which teachers committed and which did not', () => {
	const receipt = buildSaveCommitReceipt({
		committedLastNames: ['Aguilar', 'Bautista'],
		failedLastName: 'Cruz',
		error: 'Version conflict.',
	});
	assert.match(receipt, /Aguilar, Bautista/);
	assert.match(receipt, /Not saved: Cruz/);
});

test('save receipt returns the raw error when nothing committed', () => {
	const receipt = buildSaveCommitReceipt({
		committedLastNames: [],
		failedLastName: 'Cruz',
		error: 'Version conflict.',
	});
	assert.equal(receipt, 'Version conflict.');
});

// ─── Production source guardrails ─────────────────────────────────────────

test('TeachingLoad page delegates transfer and save to the production helpers', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	assert.match(page, /transferExactSectionPair\(/);
	assert.match(page, /buildSaveCommitReceipt\(/);
	// NEGATIVE CONTROL: the array-position exchange must be gone.
	assert.doesNotMatch(page, /sectionIds\[0\]/);
	assert.doesNotMatch(page, /sectionToGiveBack/);
});

test('Teaching Load surface no longer wires split-brain, reconciliation, staffing audit, or Subjects mode', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	const dataHook = source('src/hooks/useTeachingLoadData.ts');
	const uiHook = source('src/hooks/useTeachingLoadUI.ts');

	assert.doesNotMatch(page, /reconcile-split-brain/);
	assert.doesNotMatch(dataHook, /reconcile-split-brain/);
	assert.doesNotMatch(page, /TeachingLoadReconciliationPanel/);
	assert.doesNotMatch(page, /StaffingAuditSheet/);
	assert.doesNotMatch(page, /SubjectCoverageMode/);
	assert.doesNotMatch(page, /Reconcile teaching load/);
	assert.doesNotMatch(page, /Global Reset/);
	assert.doesNotMatch(page, /showJumpList/);
	assert.doesNotMatch(uiHook, /jumpListItems/);
	assert.doesNotMatch(uiHook, /showJumpList/);
	// The legacy Subjects editor must not be re-imported.
	assert.ok(!existsSync(resolve(root, 'src/components/faculty-assignments/SubjectCoverageMode.tsx')));
	assert.ok(!existsSync(resolve(root, 'src/components/faculty-assignments/StaffingAuditSheet.tsx')));
	assert.ok(!existsSync(resolve(root, 'src/components/faculty-assignments/AssignmentWorkspace.tsx')));
	assert.ok(!existsSync(resolve(root, 'src/components/faculty-assignments/RosterSidebar.tsx')));
	assert.ok(!existsSync(resolve(root, 'src/components/faculty-assignments/TeacherIdentityStrip.tsx')));
});

test('HG exclusion uses the canonical catalog code, never a display name', () => {
	const uiHook = source('src/hooks/useTeachingLoadUI.ts');
	const historyHook = source('src/hooks/useAssignmentHistory.ts');
	for (const file of [uiHook, historyHook]) {
		assert.doesNotMatch(file, /includes\(['"]homeroom['"]\)/i);
		assert.doesNotMatch(file, /includes\(['"]hr['"]\)/i);
	}
	assert.match(historyHook, /subject\.code === 'HG'/);
	assert.match(uiHook, /subject\.code === 'HG'/);
});

test('Teaching Load state is bound to the resolved actor scope with a scope reset', () => {
	const dataHook = source('src/hooks/useTeachingLoadData.ts');
	const uiHook = source('src/hooks/useTeachingLoadUI.ts');
	const page = source('src/pages/TeachingLoad.tsx');
	assert.match(dataHook, /const scopeKey = /);
	assert.match(uiHook, /resetForScope/);
	assert.match(page, /resetForScope/);
	// No hardcoded school-1 fallback in the Teaching Load data path.
	assert.doesNotMatch(dataHook, /DEFAULT_SCHOOL_ID/);
	assert.doesNotMatch(page, /DEFAULT_SCHOOL_ID/);
});
