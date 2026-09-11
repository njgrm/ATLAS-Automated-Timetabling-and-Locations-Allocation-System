import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION,
	canonicalCarryForwardSectionKey,
	classifyCarryForwardRow,
	matchTargetFacultyByExternalIdentity,
	matchTargetSectionByCanonicalKey,
	normalizeCarryForwardProgramType,
	normalizeCarryForwardSectionName,
	type CarryForwardRowDecisionInput,
	type CarryForwardSectionCandidate,
} from '../services/teaching-load-carry-forward.service.js';

const root = resolve(import.meta.dirname, '../..');

function source(path: string): string {
	return readFileSync(resolve(root, path), 'utf8');
}

// A deliberately wrong, ID-only section matcher. It is NOT used in production;
// it proves the production canonical matcher would be bypassed by an ID-only
// implementation and produce an incorrect plan.
function idOnlySectionMatch(
	sourceSection: CarryForwardSectionCandidate,
	targetSections: readonly CarryForwardSectionCandidate[],
): CarryForwardSectionCandidate | null {
	return targetSections.find((section) => section.externalId === sourceSection.externalId) ?? null;
}

test('section identity is canonical grade + program + normalized name, never an id', () => {
	assert.equal(normalizeCarryForwardSectionName('  Sampaguita-  A '), 'SAMPAGUITA A');
	assert.equal(normalizeCarryForwardSectionName('Grade   7 / Rizal'), 'GRADE 7 RIZAL');
	assert.equal(normalizeCarryForwardProgramType(' ste '), 'STE');
	assert.equal(normalizeCarryForwardProgramType('unknown'), 'OTHER');
	assert.equal(
		canonicalCarryForwardSectionKey(7, 'REGULAR', 'Sampaguita'),
		canonicalCarryForwardSectionKey(7, 'regular', ' sampaguita '),
		'case/whitespace variants of the same section produce one canonical key',
	);
});

test('FAILING-FIRST MUTANT: an ID-only matcher picks the wrong renamed/re-IDed section', () => {
	const sourceSection: CarryForwardSectionCandidate = {
		sectionMirrorId: 0,
		externalId: 111,
		gradeLevel: 7,
		programType: 'REGULAR',
		name: 'Sampaguita',
	};
	// The external id 111 was reused for a DIFFERENT section (Rizal), while the
	// same-named section was re-created with a new id (222).
	const targetSections: CarryForwardSectionCandidate[] = [
		{ sectionMirrorId: 10, externalId: 111, gradeLevel: 7, programType: 'REGULAR', name: 'Rizal' },
		{ sectionMirrorId: 20, externalId: 222, gradeLevel: 7, programType: 'REGULAR', name: 'Sampaguita' },
	];

	const canonical = matchTargetSectionByCanonicalKey(sourceSection, targetSections);
	assert.equal(canonical.status, 'MATCH');
	assert.equal(canonical.status === 'MATCH' ? canonical.section.sectionMirrorId : null, 20, 'canonical matching resolves the semantically identical section');

	const idOnly = idOnlySectionMatch(sourceSection, targetSections);
	assert.equal(idOnly?.sectionMirrorId, 10, 'the ID-only mutant resolves the renamed section');
	assert.notEqual(
		canonical.status === 'MATCH' ? canonical.section.sectionMirrorId : null,
		idOnly?.sectionMirrorId ?? null,
		'ID-only matching produces a different (incorrect) plan than canonical matching',
	);
});

test('ambiguous and missing canonical section matches fail closed', () => {
	const sourceSection: CarryForwardSectionCandidate = { sectionMirrorId: 0, externalId: 1, gradeLevel: 8, programType: 'REGULAR', name: 'Narra' };
	const duplicates: CarryForwardSectionCandidate[] = [
		{ sectionMirrorId: 1, externalId: 900, gradeLevel: 8, programType: 'REGULAR', name: 'Narra' },
		{ sectionMirrorId: 2, externalId: 901, gradeLevel: 8, programType: 'REGULAR', name: 'Narra ' },
	];
	assert.equal(matchTargetSectionByCanonicalKey(sourceSection, duplicates).status, 'AMBIGUOUS');
	assert.equal(matchTargetSectionByCanonicalKey(sourceSection, []).status, 'MISSING');
});

test('faculty match uses stable external identity and never the ATLAS row id', () => {
	const targetFaculty = [
		{ facultyMirrorId: 501, externalId: 8001, employeeId: 'EMP8001' },
		{ facultyMirrorId: 999, externalId: 8002, employeeId: 'EMP8002' },
	];
	const match = matchTargetFacultyByExternalIdentity({ facultyMirrorId: 1, externalId: 8002, employeeId: null }, targetFaculty);
	assert.equal(match.status, 'MATCH');
	assert.equal(match.status === 'MATCH' ? match.faculty.facultyMirrorId : null, 999, 'resolves by external identity, not the archived row id');
	assert.equal(matchTargetFacultyByExternalIdentity({ facultyMirrorId: 1, externalId: 12345, employeeId: null }, targetFaculty).status, 'MISSING');
	assert.equal(matchTargetFacultyByExternalIdentity(null, targetFaculty).status, 'MISSING');
});

const baseDecision: CarryForwardRowDecisionInput = {
	targetSubjectResolved: true,
	targetSubjectActive: true,
	sourceSectionResolved: true,
	targetSectionMatch: 'MATCH',
	duplicateSourcePair: false,
	inCurrentDemand: true,
	alreadyOccupied: false,
	facultyResolved: true,
	facultyActive: true,
	qualified: true,
	capBlocked: false,
};

test('classification priority encodes fill-empty-only and typed skips', () => {
	assert.equal(classifyCarryForwardRow(baseDecision), 'EXACT_CARRY');
	assert.equal(classifyCarryForwardRow({ ...baseDecision, alreadyOccupied: true }), 'ALREADY_OCCUPIED');
	assert.equal(classifyCarryForwardRow({ ...baseDecision, targetSectionMatch: 'AMBIGUOUS' }), 'AMBIGUOUS');
	assert.equal(classifyCarryForwardRow({ ...baseDecision, duplicateSourcePair: true }), 'AMBIGUOUS');
	assert.equal(classifyCarryForwardRow({ ...baseDecision, sourceSectionResolved: false }), 'MISSING_SECTION');
	assert.equal(classifyCarryForwardRow({ ...baseDecision, targetSectionMatch: 'MISSING' }), 'MISSING_SECTION');
	assert.equal(classifyCarryForwardRow({ ...baseDecision, targetSubjectActive: false }), 'NO_CURRENT_DEMAND');
	assert.equal(classifyCarryForwardRow({ ...baseDecision, inCurrentDemand: false }), 'NO_CURRENT_DEMAND');
	assert.equal(classifyCarryForwardRow({ ...baseDecision, facultyResolved: false }), 'MISSING_FACULTY');
	assert.equal(classifyCarryForwardRow({ ...baseDecision, facultyActive: false }), 'MISSING_FACULTY');
	assert.equal(classifyCarryForwardRow({ ...baseDecision, qualified: false }), 'UNQUALIFIED');
	assert.equal(classifyCarryForwardRow({ ...baseDecision, capBlocked: true }), 'CAP_BLOCKED');
	// An occupied target ALWAYS wins over an otherwise-carryable pair.
	assert.equal(classifyCarryForwardRow({ ...baseDecision, alreadyOccupied: true, capBlocked: true, qualified: false }), 'ALREADY_OCCUPIED');
});

test('FAILING-FIRST MUTANT: an overwrite-nonempty classifier would carry an occupied pair', () => {
	const occupied: CarryForwardRowDecisionInput = { ...baseDecision, alreadyOccupied: true };
	assert.equal(classifyCarryForwardRow(occupied), 'ALREADY_OCCUPIED');
	// The mutant ignores occupancy and would report a carry.
	const mutantOverwriteNonEmpty = (input: CarryForwardRowDecisionInput): string =>
		input.targetSubjectResolved && input.targetSubjectActive && input.inCurrentDemand && input.facultyResolved && input.qualified ? 'EXACT_CARRY' : 'SKIP';
	assert.equal(mutantOverwriteNonEmpty(occupied), 'EXACT_CARRY', 'the overwrite mutant would mislabel an occupied pair as carried');
});

test('the apply confirmation text is an explicit, non-empty contract', () => {
	assert.equal(TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION, 'APPLY TEACHING LOAD CARRY-FORWARD');
});

test('the archived history surface stays read-only (no carry-forward mutation controls)', () => {
	const historyView = source('../atlas-client/src/components/faculty-assignments/TeachingLoadHistoryView.tsx');
	assert.equal(historyView.includes('atlasApi.post'), false, 'history view must not POST');
});
