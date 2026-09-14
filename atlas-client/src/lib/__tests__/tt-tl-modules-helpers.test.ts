import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildCapabilityOverrideMutation,
	buildQualificationApplyPayload,
	buildQualificationPreviewPayload,
	buildRedistributionRequest,
	canonicalRefusalFromError,
	capabilityOverrideApplyEnabled,
	capabilityOverrideRefusalCopy,
	createEmptyCapabilityOverrideDraft,
	describeCapabilityOverrideEffect,
	describeDepartureRepairTruth,
	qualificationApplyEnabled,
	qualificationRefusalCopy,
	redistributeDispatchAllowed,
	refusalCopy,
	summarizeReadiness,
	summarizeRedistribution,
	workspaceScopeKey,
	type CapabilityOverridePreviewState,
	type QualificationPreviewState,
} from '@/components/timetable/TacticalSandboxDock.helpers';

/* ------------------------------------------------------------------ *
 * F1 — truthful departure repair copy (no absence window)
 * ------------------------------------------------------------------ */

test('F1 unpublished copy describes a current-run reassignment and no reversion', () => {
	const copy = describeDepartureRepairTruth(false, 3);
	assert.match(copy, /current generated run/i);
	assert.match(copy, /3 affected classes/i);
	assert.match(copy, /no absence period/i);
	assert.doesNotMatch(copy, /until further notice|unavailable until|end date/i);
});

test('F1 published copy names the revision effective date as the only temporal authority', () => {
	const copy = describeDepartureRepairTruth(true, 2);
	assert.match(copy, /published/i);
	assert.match(copy, /effective-dated revision/i);
	assert.match(copy, /sole temporal authority/i);
	assert.doesNotMatch(copy, /until further notice|end date/i);
});

test('F1 singular and zero counts read truthfully', () => {
	assert.match(describeDepartureRepairTruth(false, 1), /1 affected class /i);
	assert.match(describeDepartureRepairTruth(false, 0), /0 affected classes/i);
	assert.match(describeDepartureRepairTruth(false, -5), /0 affected classes/i);
});

/* ------------------------------------------------------------------ *
 * Canonical refusal mapping
 * ------------------------------------------------------------------ */

test('canonical refusals map to truthful, non-retrying copy', () => {
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

test('refusal copy never advertises success for a refusal', () => {
	assert.doesNotMatch(refusalCopy('HARD_VIOLATION_BLOCK'), /saved successfully|save complete|success/i);
	assert.match(refusalCopy('HARD_VIOLATION_BLOCK'), /Nothing was saved/i);
	assert.doesNotMatch(refusalCopy('TEACHING_LOAD_QUALIFICATION_MISSING'), /saved successfully|success/i);
});

test('unknown refusal falls back to the server message, never swallowed', () => {
	assert.equal(refusalCopy('SOMETHING_NEW', 'Server said no.'), 'Server said no.');
	assert.match(refusalCopy(null), /refused the repair/i);
});

test('canonicalRefusalFromError extracts the typed code and message', () => {
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
 * F3 — qualification apply requires the SERVER-issued confirmation
 * ------------------------------------------------------------------ */

const SERVER_ISSUED = 'APPLY DEPARTMENT AUTHORITY';

const qualifiedPreview: QualificationPreviewState = {
	fingerprint: 'fp-abc',
	expectedSourceRevision: { revisionHash: 'rev-1' },
	confirmationText: SERVER_ISSUED,
	conflicts: 0,
	creates: 2,
};

test('F3 no apply payload without a server fingerprint', () => {
	const aliases = [{ key: 'MATH', value: 'Mathematics' }];
	assert.equal(buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], null, SERVER_ISSUED), null);
	assert.equal(
		buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], { ...qualifiedPreview, fingerprint: null }, SERVER_ISSUED),
		null,
	);
	assert.equal(qualificationApplyEnabled({ ...qualifiedPreview, fingerprint: null }), false);
});

test('F3 no apply payload when the preview carried no server confirmation', () => {
	const aliases = [{ key: 'MATH', value: 'Mathematics' }];
	assert.equal(
		buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], { ...qualifiedPreview, confirmationText: null }, SERVER_ISSUED),
		null,
	);
});

test('F3 apply requires the exact value the server preview returned', () => {
	const aliases = [{ key: 'MATH', value: 'Mathematics' }];
	assert.equal(buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], qualifiedPreview, 'apply department authority'), null);
	assert.equal(buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], qualifiedPreview, ''), null);
	assert.equal(buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], qualifiedPreview, 'APPLY SOMETHING ELSE'), null);
	const payload = buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], qualifiedPreview, SERVER_ISSUED);
	assert.equal(payload?.expectedFingerprint, 'fp-abc');
	assert.equal(payload?.confirmationText, SERVER_ISSUED);
});

test('F3 a mutated server-issued value rejects the previously valid input', () => {
	const aliases = [{ key: 'MATH', value: 'Mathematics' }];
	// If the server changes the phrase, the old client input must no longer authorize.
	const mutated = { ...qualifiedPreview, confirmationText: 'APPLY DEPARTMENT AUTHORITY V2' };
	assert.equal(buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], mutated, SERVER_ISSUED), null);
	assert.ok(buildQualificationApplyPayload({ schoolId: 5 }, aliases, [], mutated, 'APPLY DEPARTMENT AUTHORITY V2'));
});

test('R4 preview payload dispatches nothing without a resolved school', () => {
	assert.equal(buildQualificationPreviewPayload({ schoolId: null }, [{ key: 'A', value: 'B' }], []), null);
	assert.equal(buildQualificationPreviewPayload({ schoolId: 0 }, [], []), null);
	assert.deepEqual(buildQualificationPreviewPayload({ schoolId: 7 }, [], []), { schoolId: 7, aliases: [], labels: [] });
});

test('R4 qualification refusals are typed and truthful', () => {
	assert.match(qualificationRefusalCopy('FINGERPRINT_REQUIRED'), /fingerprint/i);
	assert.match(qualificationRefusalCopy('SOURCE_DRIFT'), /preview again/i);
	assert.match(qualificationRefusalCopy('CONFIRMATION_REQUIRED'), /confirmation text the server preview returned/i);
	assert.equal(qualificationRefusalCopy('WHATEVER', 'Server copy.'), 'Server copy.');
});

/* ------------------------------------------------------------------ *
 * F2 — capability-override helper gating
 * ------------------------------------------------------------------ */

test('F2 capability mutation dispatches nothing without a selected teacher', () => {
	assert.equal(buildCapabilityOverrideMutation(createEmptyCapabilityOverrideDraft(), null), null);
	assert.equal(buildCapabilityOverrideMutation(createEmptyCapabilityOverrideDraft(), 0), null);
	assert.equal(buildCapabilityOverrideMutation(createEmptyCapabilityOverrideDraft(), 12)?.facultyId, 12);
});

test('F2 capability mutation normalizes codes and honors SET/REMOVE', () => {
	const draft = { ...createEmptyCapabilityOverrideDraft(), action: 'SET' as const, subjectCode: ' math ', specializationCode: ' math ' };
	const mutation = buildCapabilityOverrideMutation(draft, 4);
	assert.equal(mutation?.subjectCode, 'MATH');
	assert.equal(mutation?.specializationCode, 'MATH');
	assert.equal(buildCapabilityOverrideMutation({ ...draft, action: 'REMOVE' }, 4)?.action, 'REMOVE');
});

test('F2 capability apply stays disabled until a server fingerprint exists', () => {
	const noFingerprint: CapabilityOverridePreviewState = {
		fingerprint: null,
		expectedSourceRevision: null,
		confirmationText: null,
		changeAction: 'create',
		subjectCode: 'MATH',
		specializationCode: null,
		conflictCount: 0,
	};
	assert.equal(capabilityOverrideApplyEnabled(noFingerprint), false);
	assert.equal(capabilityOverrideApplyEnabled({ ...noFingerprint, fingerprint: 'fp', confirmationText: SERVER_ISSUED }), true);
	assert.equal(capabilityOverrideApplyEnabled({ ...noFingerprint, fingerprint: 'fp', confirmationText: null }), false);
});

test('F2 capability effect is truthful for each classified action', () => {
	const base: CapabilityOverridePreviewState = {
		fingerprint: 'fp',
		expectedSourceRevision: null,
		confirmationText: SERVER_ISSUED,
		changeAction: 'create',
		subjectCode: 'MATH',
		specializationCode: null,
		conflictCount: 0,
	};
	assert.match(describeCapabilityOverrideEffect(base), /will create/i);
	assert.match(describeCapabilityOverrideEffect({ ...base, changeAction: 'remove' }), /will remove/i);
	assert.match(describeCapabilityOverrideEffect({ ...base, changeAction: 'unchanged' }), /already current/i);
	assert.match(describeCapabilityOverrideEffect(null), /Preview shows/i);
});

test('F2 capability refusals are typed and truthful', () => {
	assert.match(capabilityOverrideRefusalCopy('FINGERPRINT_MISMATCH'), /preview again/i);
	assert.match(capabilityOverrideRefusalCopy('CAPABILITY_OVERRIDE_SOURCE_DRIFT'), /Nothing was saved/i);
	assert.match(capabilityOverrideRefusalCopy('ARCHIVED_YEAR_READ_ONLY'), /read-only/i);
	assert.match(capabilityOverrideRefusalCopy('SCHOOL_MISMATCH'), /different school/i);
	assert.equal(capabilityOverrideRefusalCopy('WHATEVER', 'Server copy.'), 'Server copy.');
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
