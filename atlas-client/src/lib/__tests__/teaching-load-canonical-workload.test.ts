import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
	deriveTeachingWorkload,
	deriveTeachingLoadStatus,
	getFacultyComparableLoadHours,
	isSameDepartment,
	deriveTeachingLoadFacet,
	teachingUtilizationPercentFor,
	computeTeachingLoadFacets,
	applyTeachingLoadFilters,
	resolveWorkloadBarState,
	resolveAdvisoryCreditHours,
	teachingLoadScopeParams,
	buildGuidedEmptyTeachingLoadMessage,
	type EffectiveTeachingPolicy,
} from '../faculty-assignment-helpers';
import type { FacultySummary } from '../../types';

// Isolated test double for the superseded enumeration strategy: collecting faculty
// only from assignment rows. Production code must NOT use this; it drops zero-load faculty.
function enumerateFacultyFromAssignments(
	activeFaculty: FacultySummary[],
	assignmentsByFaculty: Record<number, { subjectId: number; sectionIds: number[]; gradeLevels: number[] }[]>,
): number[] {
	const ids = new Set<number>();
	for (const [facultyIdRaw, rows] of Object.entries(assignmentsByFaculty)) {
		if (rows.length > 0) ids.add(Number(facultyIdRaw));
	}
	return activeFaculty.filter((row) => ids.has(row.id)).map((row) => row.id);
}

// Effective policies under test: persisted school/year values injected by the
// caller (as the summary contract delivers them). No client-side defaults.
const POLICY_A: EffectiveTeachingPolicy = { teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400 };
const POLICY_B: EffectiveTeachingPolicy = { teachingStandardMinutes: 1500, advisoryCreditMinutes: 200, hardCapMinutes: 2000 };

function member(overrides: Partial<FacultySummary>): FacultySummary {
	return {
		id: 1,
		externalId: 1,
		firstName: 'Test',
		lastName: 'Teacher',
		department: 'Filipino',
		departmentCode: 'FIL',
		departmentLabel: 'Filipino',
		departmentStatus: 'MAPPED',
		specialization: null,
		employmentStatus: 'ACTIVE',
		isActiveForScheduling: true,
		isPlaceholder: false,
		isClassAdviser: false,
		advisedSectionId: null,
		advisedSectionName: null,
		advisoryEquivalentHours: 0,
		ancillaryMinutesPerWeek: 0,
		canTeachOutsideDepartment: false,
		maxHoursPerWeek: 40,
		version: 1,
		subjectCount: 1,
		sectionCount: 1,
		subjectHours: 0,
		sectionTeachingHours: 0,
		gradeTeachingHours: 0,
		advisoryHours: 0,
		ancillaryHours: 0,
		policyCreditedHours: 0,
		policyLoadPercentage: 0,
		actualTeachingHours: 0,
		teachingUtilizationPercent: 0,
		teachingCapacityRemainingMinutes: 0,
		excessTeachingMinutes: 0,
		creditedWorkloadMinutes: 0,
		syntheticCoverageHours: 0,
		loadSignalMode: 'STANDARD',
		assignments: [],
		...overrides,
	} as FacultySummary;
}

// ─── Canonical workload semantics from the effective policy ───

test('26.25h teaching + 5h advisory stays below the effective 30h standard', () => {
	const workload = deriveTeachingWorkload(26.25, 5, POLICY_A, 40);
	assert.equal(workload.teachingHours, 26.3); // hour inputs round to 1 decimal
	assert.equal(workload.creditedTotalHours, 31.3);
	assert.equal(workload.status, 'below-standard');
	assert.equal(workload.remainingTeachingHours, 3.7);
	assert.equal(workload.excessTeachingHours, 0);
	assert.equal(workload.overCapHours, 0);
});

test('adviser-only (0 teaching + 5 credit) has 0% utilization and full standard remaining', () => {
	const workload = deriveTeachingWorkload(0, 5, POLICY_A, 40);
	assert.equal(workload.creditedTotalHours, 5);
	assert.equal(workload.status, 'below-standard');
	assert.equal(workload.remainingTeachingHours, 30);
	assert.equal(workload.excessTeachingHours, 0);
});

test('37.5h teaching has positive excess and zero (never negative) remaining', () => {
	const workload = deriveTeachingWorkload(37.5, 0, POLICY_A, 40);
	assert.equal(workload.remainingTeachingHours, 0);
	assert.ok(workload.remainingTeachingHours >= 0, 'remaining must never be negative');
	assert.equal(workload.excessTeachingHours, 7.5);
	assert.equal(workload.status, 'overload-allowed');
});

test('30h teaching is at standard regardless of advisory credit', () => {
	const workload = deriveTeachingWorkload(30, 5, POLICY_A, 40);
	assert.equal(workload.status, 'compliant');
	assert.equal(workload.remainingTeachingHours, 0);
	assert.equal(workload.excessTeachingHours, 0);
	assert.equal(workload.creditedTotalHours, 35);
});

test('NEGATIVE CONTROL: credited-workload status disagrees with canonical status (proves sensitivity)', () => {
	const buggyStatus = (teaching: number, credit: number) =>
		teaching + credit >= 30 ? 'compliant-or-worse' : 'below-standard';
	assert.equal(buggyStatus(26.25, 5), 'compliant-or-worse');
	assert.notEqual(deriveTeachingWorkload(26.25, 5, POLICY_A, 40).status, 'compliant-or-worse');
});

// ─── Persisted-standard variance changes statuses without a client rebuild ───

test('same 28h fixture flips status when the persisted standard changes (no rebuild)', () => {
	const under1800 = deriveTeachingWorkload(28, 0, POLICY_A, 40);
	const over1500 = deriveTeachingWorkload(28, 0, POLICY_B, 40);
	assert.equal(under1800.status, 'below-standard');
	assert.equal(under1800.remainingTeachingHours, 2);
	assert.equal(under1800.excessTeachingHours, 0);
	assert.equal(over1500.status, 'overload-allowed');
	assert.equal(over1500.remainingTeachingHours, 0);
	assert.equal(over1500.excessTeachingHours, 3);
	assert.equal(deriveTeachingLoadStatus(28, 30, 40).status, 'below-standard');
	assert.equal(deriveTeachingLoadStatus(28, 25, 40).status, 'overload-allowed');
});

// ─── Advisory invariance ───

test('changing advisory credit never changes utilization or excess', () => {
	const low = deriveTeachingWorkload(25, 5, POLICY_A, 40);
	const high = deriveTeachingWorkload(25, 10, { ...POLICY_A, advisoryCreditMinutes: 600 }, 40);
	const utilization = (teaching: number, standard: number) => Math.round((teaching / standard) * 1000) / 10;
	assert.equal(utilization(low.teachingHours, 30), utilization(high.teachingHours, 30));
	assert.equal(low.excessTeachingHours, high.excessTeachingHours);
	assert.equal(low.remainingTeachingHours, high.remainingTeachingHours);
	assert.notEqual(low.creditedTotalHours, high.creditedTotalHours);
});

// ─── Comparable load is actual-teaching only ───

test('comparable load ignores credited fallbacks when actual teaching is known', () => {
	const row = member({ actualTeachingHours: 26.3, sectionTeachingHours: 26.3, policyCreditedHours: 31.3, subjectHours: 31.3 });
	assert.equal(getFacultyComparableLoadHours(row), 26.3);
});

test('comparable load is 0 (not credited) when actual teaching fields are absent', () => {
	const row = member({ actualTeachingHours: undefined, sectionTeachingHours: undefined, policyCreditedHours: 31.3, subjectHours: 31.3 });
	assert.equal(getFacultyComparableLoadHours(row as FacultySummary), 0);
});

// ─── Department identity uses normalized codes, not raw labels ───

test('Filipino ~ FIL ~ filipino (raw equality fails, canonical matches)', () => {
	const rawLeft: string = 'Filipino';
	const rawRight: string = 'FIL';
	const rawEquality = rawLeft === rawRight;
	assert.equal(rawEquality, false, 'raw display-label equality misses this pair');
	assert.equal(isSameDepartment('Filipino', 'FIL'), true);
	assert.equal(isSameDepartment('filipino ', 'FIL'), true);
	assert.equal(isSameDepartment('', 'FIL'), false);
	assert.equal(isSameDepartment(null, 'FIL'), false);
	assert.equal(isSameDepartment('', 'FIL'), false);
	assert.equal(isSameDepartment('MATH', 'FIL'), false);
});

// ─── Teaching-load facets derive from actual teaching + explicit standard ───

test('adviser with zero teaching is adviser-only with 0% utilization', () => {
	const row = member({ isClassAdviser: true, actualTeachingHours: 0, sectionTeachingHours: 0, advisoryEquivalentHours: 5 });
	assert.equal(deriveTeachingLoadFacet(row, 30), 'adviser-only');
	assert.equal(teachingUtilizationPercentFor(row, 30), 0);
});

test('26.3h teaching + advisory credit stays below standard at facet level', () => {
	const row = member({ actualTeachingHours: 26.3, sectionTeachingHours: 26.3, policyCreditedHours: 31.3 });
	assert.equal(deriveTeachingLoadFacet(row, 30), 'below-standard');
});

test('30h teaching is at-standard; 37.5h is excess', () => {
	assert.equal(deriveTeachingLoadFacet(member({ actualTeachingHours: 30, sectionTeachingHours: 30 }), 30), 'at-standard');
	assert.equal(deriveTeachingLoadFacet(member({ actualTeachingHours: 37.5, sectionTeachingHours: 37.5 }), 30), 'excess');
});

test('UNCONFIGURED standard yields coarse facets only (no invented bands)', () => {
	assert.equal(deriveTeachingLoadFacet(member({ actualTeachingHours: 10, sectionTeachingHours: 10 }), null), 'teaching-assigned');
	assert.equal(deriveTeachingLoadFacet(member({ actualTeachingHours: 0, sectionTeachingHours: 0 }), null), 'no-teaching');
	assert.equal(
		deriveTeachingLoadFacet(member({ actualTeachingHours: 0, sectionTeachingHours: 0, isClassAdviser: true }), null),
		'adviser-only',
	);
});

test('zero-teaching non-adviser is no-teaching; blank code is unmapped', () => {
	assert.equal(deriveTeachingLoadFacet(member({ actualTeachingHours: 0, sectionTeachingHours: 0 }), 30), 'no-teaching');
	assert.equal(
		deriveTeachingLoadFacet(member({ actualTeachingHours: 10, sectionTeachingHours: 10, departmentCode: null, departmentLabel: null, department: '  ' }), 30),
		'unmapped',
	);
});

test('NEGATIVE CONTROL: persisted alias change regroups Filipino faculty without a client rebuild', () => {
	// Same raw roster; only the SERVER-SUPPLIED canonical codes differ (as if the
	// persisted DepartmentAlias rows changed). The client performs zero inference.
	const rawFilipino = { department: 'Filipino' };
	const mappedAsFil = member({ id: 1, departmentCode: 'FIL', departmentLabel: 'Filipino', ...rawFilipino });
	const mappedAsUnmapped = member({ id: 1, departmentCode: 'UNMAPPED', departmentLabel: 'Unmapped', ...rawFilipino });
	const groupsIfMapped = computeTeachingLoadFacets([mappedAsFil], { department: 'all' }, undefined, 30);
	const groupsIfUnmapped = computeTeachingLoadFacets([mappedAsUnmapped], { department: 'all' }, undefined, 30);
	assert.equal(groupsIfMapped.departmentCounts.find((entry) => entry.value === 'FIL')?.count ?? 0, 1);
	assert.equal(groupsIfMapped.departmentCounts.find((entry) => entry.value === 'UNMAPPED')?.count ?? 0, 0);
	assert.equal(groupsIfUnmapped.departmentCounts.find((entry) => entry.value === 'UNMAPPED')?.count ?? 0, 1);
	assert.equal(
		computeTeachingLoadFacets([mappedAsFil], { department: 'FIL' }, undefined, 30).statusCounts['teaching-assigned']
		+ computeTeachingLoadFacets([mappedAsFil], { department: 'FIL' }, undefined, 30).statusCounts['no-teaching'],
		1,
	);
});

test('contract: No teaching load includes every zero-teaching faculty; Adviser only is its subset', () => {
	const roster = [
		member({ id: 1, departmentCode: 'FIL', actualTeachingHours: 30, sectionTeachingHours: 30 }),
		member({ id: 2, departmentCode: 'FIL', actualTeachingHours: 0, sectionTeachingHours: 0 }),
		member({ id: 3, departmentCode: 'FIL', actualTeachingHours: 0, sectionTeachingHours: 0, isClassAdviser: true, advisoryEquivalentHours: 5 }),
		member({ id: 4, departmentCode: 'MATH', actualTeachingHours: 0, sectionTeachingHours: 0 }),
	];
	const facets = computeTeachingLoadFacets(roster, { department: 'FIL', status: 'all', load: 'all' }, undefined, 30);
	assert.equal(facets.statusCounts['no-teaching'], 2, 'no-teaching includes the adviser');
	assert.equal(facets.statusCounts['adviser-only'], 1, 'adviser-only is the subset');
});

test('count/row equality: every displayed count equals its resulting rows', () => {
	const roster = [
		member({ id: 1, departmentCode: 'FIL', departmentLabel: 'Filipino', actualTeachingHours: 35, sectionTeachingHours: 35, subjectCount: 2 }),
		member({ id: 2, departmentCode: 'FIL', departmentLabel: 'Filipino', actualTeachingHours: 30, sectionTeachingHours: 30, subjectCount: 2 }),
		member({ id: 3, departmentCode: 'FIL', departmentLabel: 'Filipino', actualTeachingHours: 0, sectionTeachingHours: 0, subjectCount: 0 }),
		member({ id: 4, departmentCode: 'FIL', departmentLabel: 'Filipino', actualTeachingHours: 0, sectionTeachingHours: 0, subjectCount: 0, isClassAdviser: true, advisoryEquivalentHours: 5 }),
		member({ id: 5, departmentCode: 'MATH', departmentLabel: 'Mathematics', actualTeachingHours: 10, sectionTeachingHours: 10, subjectCount: 1 }),
		member({ id: 6, departmentCode: 'UNMAPPED', departmentLabel: 'Unmapped', department: 'Klingon', actualTeachingHours: 12, sectionTeachingHours: 12, subjectCount: 1 }),
	];
	const base = { department: 'all' as const, status: 'all' as const, load: 'all' as const };
	const all = computeTeachingLoadFacets(roster, base, undefined, 30);
	// Status options on the all-base.
	for (const option of ['teaching-assigned', 'no-teaching', 'adviser-only'] as const) {
		const rows = applyTeachingLoadFilters(roster, { ...base, status: option }, undefined, 30);
		assert.equal(rows.length, all.statusCounts[option], `status ${option}: count equals rows`);
	}
	// Load options on the all-base.
	for (const option of ['below-standard', 'at-standard', 'excess'] as const) {
		const rows = applyTeachingLoadFilters(roster, { ...base, load: option }, undefined, 30);
		assert.equal(rows.length, all.loadCounts[option], `load ${option}: count equals rows`);
	}
	// Department options on the all-base.
	for (const entry of all.departmentCounts) {
		const rows = applyTeachingLoadFilters(roster, { ...base, department: entry.value }, undefined, 30);
		assert.equal(rows.length, entry.count, `department ${entry.value}: count equals rows`);
	}
	// Contextual: Filipino + excess, and Filipino no-teaching complement.
	const filFacets = computeTeachingLoadFacets(roster, { department: 'FIL', status: 'all', load: 'all' }, undefined, 30);
	assert.equal(filFacets.statusCounts['teaching-assigned'], 2);
	assert.equal(filFacets.statusCounts['no-teaching'], 2);
	assert.equal(filFacets.statusCounts['adviser-only'], 1);
	assert.equal(filFacets.loadCounts['excess'], 1);
	assert.deepEqual(
		applyTeachingLoadFilters(roster, { department: 'FIL', status: 'no-teaching', load: 'all' }, undefined, 30).map((row) => row.id).sort(),
		[3, 4],
		'Filipino no-teaching complement is exactly the two zero-teaching teachers',
	);
});

// ─── Faculty enumeration comes from active faculty, not assignments ───

test('NEGATIVE CONTROL: assignment-derived enumeration drops zero-load faculty', () => {
	const active = [
		member({ id: 1, actualTeachingHours: 30, sectionTeachingHours: 30 }),
		member({ id: 2, actualTeachingHours: 0, sectionTeachingHours: 0 }),
		member({ id: 3, actualTeachingHours: 0, sectionTeachingHours: 0, isClassAdviser: true, advisoryEquivalentHours: 5 }),
	];
	const assignmentsByFaculty: Record<number, { subjectId: number; sectionIds: number[]; gradeLevels: number[] }[]> = {
		1: [{ subjectId: 9, sectionIds: [3], gradeLevels: [7] }],
	};
	const fromAssignments = enumerateFacultyFromAssignments(active, assignmentsByFaculty);
	assert.deepEqual(fromAssignments.sort(), [1], 'assignment-derived set drops zero-load faculty');
	const visible = active.filter((row) => row.isActiveForScheduling).map((row) => row.id);
	assert.deepEqual(visible.sort(), [1, 2, 3], 'All view must include every active faculty member');
});

// ─── Contextual facet counts respect the other active filter ───

test('NEGATIVE CONTROL: department-blind status counts disagree with contextual counts', () => {
	const roster = [
		member({ id: 1, department: 'Filipino', departmentCode: 'FIL', departmentLabel: 'Filipino', actualTeachingHours: 30, sectionTeachingHours: 30 }),
		member({ id: 2, department: 'Filipino', departmentCode: 'FIL', departmentLabel: 'Filipino', actualTeachingHours: 0, sectionTeachingHours: 0 }),
		member({ id: 3, department: 'Mathematics', departmentCode: 'MATH', departmentLabel: 'Mathematics', actualTeachingHours: 0, sectionTeachingHours: 0 }),
	];
	const contextual = computeTeachingLoadFacets(roster, { department: 'FIL', status: 'all' }, undefined, 30);
	assert.equal(contextual.statusCounts['no-teaching'], 1, 'only the Filipino zero-load teacher counts');
	assert.equal(contextual.statusCounts['at-standard'], 1);
	const blindNoTeaching = roster.filter((row) => deriveTeachingLoadFacet(row, 30) === 'no-teaching').length;
	assert.equal(blindNoTeaching, 2, 'department-blind count over-counts once Filipino is selected');
	assert.notEqual(blindNoTeaching, contextual.statusCounts['no-teaching']);
});

// ─── No local policy literals in the Teaching Load client ───

const TL_POLICY_FREE_FILES = [
	'../../hooks/useTeachingLoadUI.ts',
	'../../hooks/useTeachingLoadData.ts',
	'../../hooks/useTeachingLoadRouteIntent.ts',
	'../../pages/TeachingLoad.tsx',
	'../../components/faculty-assignments/TeacherGridMode.tsx',
	'../../components/faculty-assignments/WorkloadInspector.tsx',
	'../../components/faculty-assignments/WorkspaceToolbar.tsx',
	'../../components/faculty-assignments/SectionGridMode.tsx',
	'../../components/faculty-assignments/StackedWorkloadBar.tsx',
	'../faculty-teaching-load-cache.ts',
];

const LEGACY_POLICY_IDENTIFIERS = [
	'STANDARD_WEEKLY_TEACHING_HOURS',
	'MAX_WEEKLY_TEACHING_HOURS',
	'CLASS_ADVISER_EQUIVALENT_HOURS',
];

test('NEGATIVE CONTROL: Teaching Load client files reference no local policy constants', () => {
	const here = dirname(fileURLToPath(import.meta.url));
	for (const relative of TL_POLICY_FREE_FILES) {
		const source = readFileSync(resolve(here, relative), 'utf8');
		for (const identifier of LEGACY_POLICY_IDENTIFIERS) {
			assert.ok(
				!source.includes(identifier),
				`${relative} must not reference ${identifier} (consume the effective policy instead)`,
			);
		}
	}
});

test('NEGATIVE CONTROL: TL-facing helper functions carry no local policy defaults', () => {	const here = dirname(fileURLToPath(import.meta.url));
	const source = readFileSync(resolve(here, '../faculty-assignment-helpers.ts'), 'utf8');
	const spans: Array<[string, string, string]> = [
		['deriveTeachingWorkload', 'export function deriveTeachingWorkload(', 'export function deriveLoadStatus('],
		['deriveTeachingLoadStatus', 'export function deriveTeachingLoadStatus(', 'export interface TeachingWorkloadSummary'],
		['teachingUtilizationPercentFor', 'export function teachingUtilizationPercentFor(', 'export interface EffectiveTeachingPolicy'],
		['computeTeachingLoadFacets', 'export function computeTeachingLoadFacets(', 'export function buildSectionMap('],
		['buildTeachingLoadProfile', 'export function buildTeachingLoadProfile(', '/* END buildTeachingLoadProfile'],
	];
	for (const [label, startMarker, endMarker] of spans) {
		const start = source.indexOf(startMarker);
		let end = source.indexOf(endMarker, start);
		if (end <= start) end = source.length;
		assert.ok(start >= 0, `${label} span located`);
		const span = source.slice(start, end);
		for (const identifier of LEGACY_POLICY_IDENTIFIERS) {
			assert.ok(!span.includes(identifier), `${label} must not reference ${identifier}`);
		}
	}
});

// ─── Workload-bar actual-versus-credit rendering ───

test('26.3h teaching + 5h advisory renders visually below standard', () => {
	const state = resolveWorkloadBarState({ teachingHours: 26.3, creditHours: 5, maxHours: 40, standardHours: 30 });
	assert.equal(state.tone, 'below-standard');
	assert.ok(Math.abs(state.teachingWidthPercent - 65.75) < 0.01, `teaching width follows actual (got ${state.teachingWidthPercent})`);
	assert.ok(Math.abs(state.creditWidthPercent - 12.5) < 0.01, `credit widens only the neutral segment (got ${state.creditWidthPercent})`);
	assert.ok(Math.abs((state.standardMarkerPercent ?? 0) - 75) < 0.01, 'marker sits at the effective standard');
	assert.equal(state.isOverCap, false);
	assert.equal(state.excessTeachingHours, 0);
});

test('credit growth never changes bar tone; teaching growth does', () => {
	const base = { teachingHours: 26.3, maxHours: 40, standardHours: 30 };
	assert.equal(resolveWorkloadBarState({ ...base, creditHours: 5 }).tone, 'below-standard');
	assert.equal(resolveWorkloadBarState({ ...base, creditHours: 15 }).tone, 'below-standard');
	assert.equal(resolveWorkloadBarState({ teachingHours: 37.5, creditHours: 0, maxHours: 40, standardHours: 30 }).tone, 'excess');
	assert.equal(resolveWorkloadBarState({ teachingHours: 37.5, creditHours: 0, maxHours: 40, standardHours: 30 }).excessTeachingHours, 7.5);
	assert.equal(resolveWorkloadBarState({ teachingHours: 41, creditHours: 0, maxHours: 40, standardHours: 30 }).tone, 'over-cap');
	assert.equal(resolveWorkloadBarState({ teachingHours: 41, creditHours: 0, maxHours: 40, standardHours: 30 }).isOverCap, true);
});

test('unknown standard renders the unconfigured bar state (no local claim)', () => {
	const state = resolveWorkloadBarState({ teachingHours: 26.3, creditHours: 5, maxHours: 40, standardHours: null });
	assert.equal(state.tone, 'unconfigured');
	assert.equal(state.standardMarkerPercent, null);
	assert.ok(state.teachingWidthPercent > 0, 'teaching width still renders');
});

// ─── Actor school scope and dynamic school-year label ───

test('request scope honors the actor school and year (no school-1 fallback)', () => {
	assert.deepEqual(teachingLoadScopeParams(3, 55), { schoolId: 3, schoolYearId: 55 });
	assert.deepEqual(teachingLoadScopeParams(1, 8), { schoolId: 1, schoolYearId: 8 });
});

test('NEGATIVE CONTROL: missing actor school or year throws a typed error instead of defaulting', () => {
	for (const [label, school, year] of [
		['null school', null, 55],
		['zero school', 0, 55],
		['NaN school', NaN, 55],
		['null year', 3, null],
		['zero year', 3, 0],
	] as Array<[string, any, any]>) {
		assert.throws(() => teachingLoadScopeParams(school, year), `missing ${label} throws`);
	}
	try {
		teachingLoadScopeParams(null, 55);
		assert.fail('expected SCHOOL_UNRESOLVED');
	} catch (error: any) {
		assert.equal(error?.code, 'SCHOOL_UNRESOLVED');
	}
});

test('guided empty-state message interpolates the dynamic school-year label', () => {
	assert.ok(buildGuidedEmptyTeachingLoadMessage('2027-2028').includes('2027-2028'));
	assert.ok(!buildGuidedEmptyTeachingLoadMessage('2027-2028').includes('2026-2027'));
	assert.ok(buildGuidedEmptyTeachingLoadMessage(null).includes('the active school year'));
});

test('NEGATIVE CONTROL: Teaching Load client hardcodes no school id or school-year literal', () => {
	const here = dirname(fileURLToPath(import.meta.url));
	const tlFiles = [...TL_POLICY_FREE_FILES, '../../pages/TeachingLoad.tsx'];
	for (const relative of new Set(tlFiles)) {
		const source = readFileSync(resolve(here, relative), 'utf8');
		assert.ok(!source.includes('DEFAULT_SCHOOL_ID'), `${relative} must not reference DEFAULT_SCHOOL_ID`);
		assert.ok(!source.includes('2026-2027'), `${relative} must not hardcode a school-year literal`);
	}
});

// ─── Advisory policy authority (persisted effective advisory only) ───

test('valid adviser credit equals the persisted effective advisory (mirror never overrides)', () => {
	const adviser = member({ isClassAdviser: true, advisoryEquivalentHours: 4 });
	assert.equal(resolveAdvisoryCreditHours(adviser, POLICY_A), 5, 'policy advisory wins over the 4h mirror value');
	assert.equal(resolveAdvisoryCreditHours(member({ isClassAdviser: false }), POLICY_A), 0, 'non-adviser gets zero');
	assert.equal(
		resolveAdvisoryCreditHours(member({ isClassAdviser: true }), { ...POLICY_A, advisoryCreditMinutes: 360 }),
		6,
		'persisted advisory change flows through with no rebuild',
	);
});

test('changing only persisted advisory credit changes credited workload, never utilization/remaining/excess', () => {
	const before = deriveTeachingWorkload(20, 5, POLICY_A, 40);
	const after = deriveTeachingWorkload(20, 6, { ...POLICY_A, advisoryCreditMinutes: 360 }, 40);
	assert.notEqual(after.creditedTotalHours, before.creditedTotalHours);
	assert.equal(after.status, before.status);
	assert.equal(after.remainingTeachingHours, before.remainingTeachingHours);
	assert.equal(after.excessTeachingHours, before.excessTeachingHours);
	const utilization = (teaching: number, standard: number) => Math.round((teaching / standard) * 1000) / 10;
	assert.equal(utilization(after.teachingHours, 30), utilization(before.teachingHours, 30));
});

// ─── Projected teaching bar (actual + incoming teaching only) ───

test('NEGATIVE CONTROL: 26h + 5h advisory + 1h incoming projects 27h teaching, never a 32h warning', () => {
	const state = resolveWorkloadBarState({ teachingHours: 26, creditHours: 5, maxHours: 40, standardHours: 30, incomingTeachingHours: 1 });
	assert.equal(state.projectedTeachingHours, 27);
	assert.equal(state.projectedTone, 'below-standard');
	assert.equal(state.projectedOverCap, false);
	// The superseded credited-based projection would warn at 26+5+1 = 32h.
	const buggyProjected = 26 + 5 + 1;
	assert.equal(buggyProjected, 32, 'buggy credited projection hits the warning shape');
	assert.notEqual(state.projectedTeachingHours, buggyProjected);
	assert.equal(state.tone, 'below-standard', 'current tone unaffected by credit or incoming');
});

// ─── Persisted department labels surface verbatim ───

test('custom persisted department label changes the UI with no rebuild', () => {
	const roster = [
		member({ id: 1, department: 'Filipino', departmentCode: 'FIL', departmentLabel: 'Filipino (Mother Tongue)', actualTeachingHours: 10, sectionTeachingHours: 10 }),
	];
	const facets = computeTeachingLoadFacets(roster, { department: 'all', status: 'all', load: 'all' }, undefined, 30);
	assert.equal(facets.departmentCounts[0]?.value, 'FIL');
	assert.equal(facets.departmentCounts[0]?.label, 'Filipino (Mother Tongue)', 'server label surfaces verbatim, never re-mapped');
});
