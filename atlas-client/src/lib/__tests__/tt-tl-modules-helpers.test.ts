import assert from 'node:assert/strict';
import test from 'node:test';

import {
	absenceWindowRevisionDateError,
	buildQualificationApplyPayload,
	buildQualificationPreviewPayload,
	buildRedistributionRequest,
	canonicalRefusalFromError,
	createEmptyAbsenceWindow,
	DEPARTMENT_AUTHORITY_CONFIRMATION_PHRASE,
	describeAbsenceWindow,
	qualificationApplyEnabled,
	qualificationRefusalCopy,
	redistributeDispatchAllowed,
	refusalCopy,
	summarizeReadiness,
	summarizeRedistribution,
	validateAbsenceWindow,
	workspaceScopeKey,
	type AbsenceWindow,
	type QualificationPreviewState,
} from '@/components/timetable/TacticalSandboxDock.helpers';

const window = (patch: Partial<AbsenceWindow> = {}): AbsenceWindow => ({ ...createEmptyAbsenceWindow(), ...patch });

/* ------------------------------------------------------------------ *
 * R2 — absence window validation
 * ------------------------------------------------------------------ */

test('R2 absence window requires a start date', () => {
	assert.match(String(validateAbsenceWindow(window())), /first date/i);
	assert.equal(validateAbsenceWindow(window({ startDate: '2026-09-01', endDate: '2026-09-10' })), null);
});

test('R2 absence window requires an end date unless until-further-notice', () => {
	assert.match(String(validateAbsenceWindow(window({ startDate: '2026-09-01' }))), /end date/i);
	assert.equal(validateAbsenceWindow(window({ startDate: '2026-09-01', untilFurtherNotice: true })), null);
	assert.match(String(validateAbsenceWindow(window({ startDate: '2026-09-01', endDate: '2026-09-10', untilFurtherNotice: true }))), /one meaning/i);
});

test('R2 absence window rejects an end date before the start date', () => {
	assert.match(String(validateAbsenceWindow(window({ startDate: '2026-09-10', endDate: '2026-09-01' }))), /cannot be earlier/i);
	assert.equal(validateAbsenceWindow(window({ startDate: '2026-09-01', endDate: '2026-09-01' })), null);
});

test('R2 absence window rejects malformed dates', () => {
	assert.match(String(validateAbsenceWindow(window({ startDate: 'not-a-date' }))), /first date/i);
	assert.match(String(validateAbsenceWindow(window({ startDate: '2026-09-01', endDate: '2026-13-45' }))), /end date/i);
});

test('R2 describeAbsenceWindow is truthful for each window shape', () => {
	assert.match(describeAbsenceWindow(window()), /No absence window/i);
	assert.match(describeAbsenceWindow(window({ startDate: '2026-09-01' })), /Unavailable from 2026-09-01/i);
	assert.match(describeAbsenceWindow(window({ startDate: '2026-09-01', untilFurtherNotice: true })), /until further notice/i);
	assert.match(describeAbsenceWindow(window({ startDate: '2026-09-01', endDate: '2026-09-10' })), /2026-09-01 to 2026-09-10/);
});

test('R2 published-mode revision effective date may not precede the absence start', () => {
	const future = '2099-01-01';
	const w = window({ startDate: future, untilFurtherNotice: true });
	assert.match(String(absenceWindowRevisionDateError(w, '2098-12-31')), /on or after 2099-01-01/i);
	assert.equal(absenceWindowRevisionDateError(w, future), null);
});

/* ------------------------------------------------------------------ *
 * R2 — canonical refusal mapping
 * ------------------------------------------------------------------ */

test('R2 canonical refusals map to truthful, non-retrying copy', () => {
	for (const code of [
		'TEACHING_LOAD_QUALIFICATION_MISSING',
		'TEACHING_LOAD_REPAIR_STALE',
		'FACULTY_VERSION_CONFLICT',
		'RUN_ALREADY_PUBLISHED',
		'HARD_VIOLATION_BLOCK',
		'SOFT_OVERRIDE_REQUIRED',
	]) {
		const copy = refusalCopy(code);
		assert.notEqual(copy, code, `${code} maps to operator copy`);
		assert.ok(copy.length > 20, `${code} copy is substantive`);
	}
});

test('R2 refusal copy never advertises success for a refusal', () => {
	assert.doesNotMatch(refusalCopy('HARD_VIOLATION_BLOCK'), /saved successfully|save complete|success/i);
	assert.match(refusalCopy('HARD_VIOLATION_BLOCK'), /Nothing was saved/i);
	assert.doesNotMatch(refusalCopy('TEACHING_LOAD_QUALIFICATION_MISSING'), /saved successfully|success/i);
});

test('R2 unknown refusal falls back to the server message, never swallowed', () => {
	assert.equal(refusalCopy('SOMETHING_NEW', 'Server said no.'), 'Server said no.');
	assert.match(refusalCopy(null), /refused the repair/i);
});

test('R2 canonicalRefusalFromError extracts the typed code and message', () => {
	const refusal = canonicalRefusalFromError({ response: { data: { code: 'TEACHING_LOAD_REPAIR_STALE' } } });
	assert.equal(refusal.code, 'TEACHING_LOAD_REPAIR_STALE');
	assert.match(refusal.message, /Nothing was saved/i);
});

/* ------------------------------------------------------------------ *
 * R3 — redistribution request gating (preview-only, never apply)
 * ------------------------------------------------------------------ */

test('R3 unresolved school/year dispatches nothing', () => {
	assert.equal(buildRedistributionRequest({ schoolId: null, schoolYearId: 5 }), null);
	assert.equal(buildRedistributionRequest({ schoolId: 5, schoolYearId: null }), null);
	assert.equal(buildRedistributionRequest({ schoolId: 0, schoolYearId: 5 }), null);
	assert.equal(buildRedistributionRequest({ schoolId: 5, schoolYearId: 0 }), null);
	assert.equal(redistributeDispatchAllowed({ schoolId: 5, schoolYearId: null }), false);
});

test('R3 resolved scope yields exactly a previewOnly:true request', () => {
	const request = buildRedistributionRequest({ schoolId: 12, schoolYearId: 34 });
	assert.deepEqual(request, { schoolId: 12, schoolYearId: 34, previewOnly: true });
	assert.ok(!('confirmApply' in (request as object)));
});

test('R3 redistribution summary is derived only from the canonical response', () => {
	const summary = summarizeRedistribution({
		overCapFaculty: [{ facultyId: 1 }, { facultyId: 2 }],
		proposedMoves: [{ subjectId: 3 }],
		movesApplied: 0,
		sectionsResolved: 9,
		evaluated: true,
		candidateRejections: [{ code: 'NO_CAPACITY' }],
		derivedDemandRevision: 'rev-7',
	});
	assert.equal(summary?.overCapCount, 2);
	assert.equal(summary?.proposedMoveCount, 1);
	assert.equal(summary?.candidateRejectionCount, 1);
	assert.equal(summary?.derivedDemandRevision, 'rev-7');
	assert.equal(summarizeRedistribution(null), null);
});

test('R3 readiness summary preserves canonical blocker codes and totals', () => {
	const readiness = summarizeReadiness({
		ready: false,
		demandCount: 10,
		ownedDemandCount: 7,
		unresolvedDemandCount: 3,
		blockers: [{ code: 'TL_UNRESOLVED_COVERAGE' }, { code: 'TL_RECONCILIATION_PENDING' }],
	});
	assert.equal(readiness?.demandCount, 10);
	assert.equal(readiness?.ownedDemandCount, 7);
	assert.deepEqual(readiness?.blockerCodes, ['TL_UNRESOLVED_COVERAGE', 'TL_RECONCILIATION_PENDING']);
});

/* ------------------------------------------------------------------ *
 * R4 — qualification authority apply gating
 * ------------------------------------------------------------------ */

const qualifiedPreview: QualificationPreviewState = {
	fingerprint: 'fp-abc',
	expectedSourceRevision: { revisionHash: 'rev-1' },
	conflicts: 0,
	creates: 2,
};

test('R4 no apply payload without a server fingerprint', () => {
	const aliases = [{ key: 'MATH', value: 'Mathematics' }];
	assert.equal(buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], null, DEPARTMENT_AUTHORITY_CONFIRMATION_PHRASE), null);
	assert.equal(
		buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], { ...qualifiedPreview, fingerprint: null }, DEPARTMENT_AUTHORITY_CONFIRMATION_PHRASE),
		null,
	);
	assert.equal(qualificationApplyEnabled({ ...qualifiedPreview, fingerprint: null }), false);
});

test('R4 apply requires the exact server-issued confirmation phrase', () => {
	const aliases = [{ key: 'MATH', value: 'Mathematics' }];
	assert.equal(buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], qualifiedPreview, 'apply department authority'), null);
	assert.equal(buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], qualifiedPreview, ''), null);
	const payload = buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], qualifiedPreview, DEPARTMENT_AUTHORITY_CONFIRMATION_PHRASE);
	assert.equal(payload?.expectedFingerprint, 'fp-abc');
	assert.equal(payload?.confirmationText, DEPARTMENT_AUTHORITY_CONFIRMATION_PHRASE);
});

test('R4 preview payload dispatches nothing without a resolved school', () => {
	assert.equal(buildQualificationPreviewPayload({ schoolId: null }, [{ key: 'A', value: 'B' }], []), null);
	assert.equal(buildQualificationPreviewPayload({ schoolId: 0 }, [], []), null);
	assert.deepEqual(buildQualificationPreviewPayload({ schoolId: 7 }, [], []), { schoolId: 7, aliases: [], labels: [] });
});

test('R4 qualification refusals are typed and truthful', () => {
	assert.match(qualificationRefusalCopy('FINGERPRINT_REQUIRED'), /fingerprint/i);
	assert.match(qualificationRefusalCopy('SOURCE_DRIFT'), /preview again/i);
	assert.match(qualificationRefusalCopy('CONFIRMATION_REQUIRED'), /APPLY DEPARTMENT AUTHORITY/);
	assert.equal(qualificationRefusalCopy('WHATEVER', 'Server copy.'), 'Server copy.');
});

/* ------------------------------------------------------------------ *
 * R8(d) — scope-change clearing
 * ------------------------------------------------------------------ */

test('R8(d) workspace scope key changes with school, year, or run', () => {
	const baseline = workspaceScopeKey({ schoolId: 1, schoolYearId: 2, runId: 3 });
	assert.notEqual(baseline, workspaceScopeKey({ schoolId: 9, schoolYearId: 2, runId: 3 }));
	assert.notEqual(baseline, workspaceScopeKey({ schoolId: 1, schoolYearId: 9, runId: 3 }));
	assert.notEqual(baseline, workspaceScopeKey({ schoolId: 1, schoolYearId: 2, runId: 9 }));
	assert.equal(workspaceScopeKey({ schoolId: 1, schoolYearId: 2, runId: 3 }), baseline);
	assert.match(workspaceScopeKey({ schoolId: null, schoolYearId: null, runId: null }), /none/);
});
