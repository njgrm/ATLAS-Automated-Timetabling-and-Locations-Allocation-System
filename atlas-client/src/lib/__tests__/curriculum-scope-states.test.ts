/**
 * SCA-02.2 — Curriculum Requirements view-state helper verification.
 *
 * Exercises the production derivation path (no mocks): loading / error /
 * missing-config / empty / configured states, scope display names, and
 * scope filtering used by the operator page.
 *
 * Run with: npx tsx src/lib/__tests__/curriculum-scope-states.test.ts
 */

import assert from 'node:assert/strict';
import {
	deriveCurriculumViewState,
	resolveCurriculumYearScope,
	scopeDisplayName,
	filterRequirementsByScope,
	buildScopeIdSets,
	SCOPE_STATE_LABELS,
	type CurriculumScopeStatus,
} from '../curriculum-scope-states.js';

let passed = 0;
let failed = 0;

function ok(condition: boolean, label: string) {
	if (condition) { passed += 1; console.log(`  OK ${label}`); return; }
	failed += 1; console.error(`  FAIL ${label}`);
}

function main() {
	// View-state precedence: loading > error > missing-config > empty > configured.
	ok(deriveCurriculumViewState({ loading: true, error: 'x', termConfigPresent: false, requirementCount: 0 }) === 'loading', 'loading wins over error');
	ok(deriveCurriculumViewState({ loading: false, error: 'boom', termConfigPresent: true, requirementCount: 3 }) === 'error', 'error wins over configured');
	ok(deriveCurriculumViewState({ loading: false, error: null, termConfigPresent: false, requirementCount: 0 }) === 'missing-config', 'missing terms without config');
	ok(deriveCurriculumViewState({ loading: false, error: null, termConfigPresent: true, requirementCount: 0 }) === 'empty', 'empty with config but no rows');
	ok(deriveCurriculumViewState({ loading: false, error: null, termConfigPresent: true, requirementCount: 2 }) === 'configured', 'configured with rows');

	// Scope labels cover every state the readiness service can emit.
	for (const state of ['MISSING', 'EMPTY', 'CONFIGURED', 'STALE', 'CONFLICTING'] as const) {
		ok(typeof SCOPE_STATE_LABELS[state] === 'string' && SCOPE_STATE_LABELS[state].length > 0, `label exists for ${state}`);
	}

	// Display names distinguish grade/program/override scopes.
	ok(scopeDisplayName({ gradeLevel: 10, programType: 'STE', sectionMirrorId: null, cohortId: null, scopeKey: 'G10:STE:-:-' }) === 'Grade 10 · STE', 'grade/program scope name');
	ok(scopeDisplayName({ gradeLevel: 7, programType: 'REGULAR', sectionMirrorId: 42, cohortId: null, scopeKey: 'x' }) === 'Grade 7 · REGULAR · Section #42', 'section override scope name');
	ok(scopeDisplayName({ gradeLevel: null, programType: null, sectionMirrorId: null, cohortId: null, scopeKey: '*' }) === 'Whole school year', 'whole-year scope name');

	// Filtering: '*' and null disable the filter; unknown scopes yield zero rows.
	const scopes: CurriculumScopeStatus[] = [
		{ scopeKey: 'G7:REGULAR:-:-', gradeLevel: 7, programType: 'REGULAR', sectionMirrorId: null, cohortId: null, state: 'CONFIGURED', requirementIds: [1, 2], detail: '' },
		{ scopeKey: 'G10:STE:-:-', gradeLevel: 10, programType: 'STE', sectionMirrorId: null, cohortId: null, state: 'EMPTY', requirementIds: [], detail: '' },
	];
	const sets = buildScopeIdSets(scopes);
	const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
	ok(filterRequirementsByScope(rows, null, sets).length === 3, 'null filter returns all rows');
	ok(filterRequirementsByScope(rows, '*', sets).length === 3, 'whole-year filter returns all rows');
	ok(filterRequirementsByScope(rows, 'G7:REGULAR:-:-', sets).length === 2, 'scope filter narrows to scope rows');
	ok(filterRequirementsByScope(rows, 'G10:STE:-:-', sets).length === 0, 'explicit-empty scope filters to zero rows (not missing)');
	ok(filterRequirementsByScope(rows, 'G9:SPA:-:-', sets).length === 0, 'unknown scope yields zero rows');

	// SCA-02R: active-year context must belong to the resolved actor school.
	// A school-1 cache default is never inherited for another actor.
	const okScope = resolveCurriculumYearScope(2, { activeSchoolYearId: 9, schoolId: 2 });
	ok(okScope.ok && okScope.schoolYearId === 9, 'matching actor school resolves the year');
	ok(resolveCurriculumYearScope(null, { activeSchoolYearId: 9, schoolId: 2 }).ok === false, 'unresolved actor blocks');
	ok(resolveCurriculumYearScope(2, null).ok === false, 'missing context blocks');
	ok(resolveCurriculumYearScope(2, { activeSchoolYearId: null, schoolId: 2 }).ok === false, 'missing year blocks');
	const mismatch = resolveCurriculumYearScope(2, { activeSchoolYearId: 9, schoolId: 1 });
	ok(!mismatch.ok && (mismatch as { reason: string }).reason === 'school-mismatch', 'school-1 default never serves actor 2');
	const mismatch2 = resolveCurriculumYearScope(3, { activeSchoolYearId: 9, schoolId: 2 });
	ok(!mismatch2.ok, 'cross-school context never resolves');
	ok(resolveCurriculumYearScope(2, { activeSchoolYearId: 9, schoolId: null }).ok === true, 'unknown context school defers to server authority');

	console.log(`\ncurriculum-scope-states: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

main();
