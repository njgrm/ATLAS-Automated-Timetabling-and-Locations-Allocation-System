import test from 'node:test';
import assert from 'node:assert/strict';

import {
	advisoryCreditHoursOf,
	buildTeachingLoadProfile,
	deriveTeachingLoadStatus,
	getFacultyComparableLoadHours,
	resolveAdvisoryCreditHours,
	resolveEffectiveLoadBaselineHours,
	resolveWorkloadBarState,
	teachingUtilizationPercentFor,
	type EffectiveTeachingPolicy,
} from '../faculty-assignment-helpers';
import { isHomeroomGuidanceCode } from '../timetable-ttc02-insertion';
import type { ExternalSection, FacultyAssignmentDraft, FacultySummary, Subject } from '../../types';

/*
 * TL-OPERATOR-WORKSPACE-C05 correction C-4 — effective-load parity.
 *
 * Operator-settled contract:
 *   Total Teaching Load = Actual Teaching Load + effective Class Advising credit.
 *   Ancillary Work, ARAL, HG/HGP, and scheduled breaks contribute ZERO credit.
 *
 * Production seam under test: `resolveEffectiveLoadBaselineHours` is the single
 * baseline consumed by the Teaching Load workspace profile
 * (`useTeachingLoadUI.loadProfile`, which feeds `WorkloadInspector` →
 * `StackedWorkloadBar` via `equivalentHours`) and by the section-hover preview
 * delta (`TeachingLoad.resolveSectionHoverDeltaMinutes`).
 *
 * Export parity authority (READ ONLY, beneficiary-export worktree):
 *   docs/reference/atlas-teacher-program-output-contract-2026-09-15.md §2.1–2.6
 *   atlas-server/src/__tests__/tt-output-c05r1-teacher-program.test.ts control 4
 *   actualTeachingMinutes=270, advisoryMinutes=60, totalTeachingLoad=330.
 */

// Effective school/year policy injected by the summary contract (no defaults).
const POLICY: EffectiveTeachingPolicy = {
	teachingStandardMinutes: 1800, // 30h standard
	advisoryCreditMinutes: 60, // 1h authorized adviser credit
	hardCapMinutes: 2400, // 40h cap
};

// Canonical fixture shared with the export contract (see header):
// six 45-minute non-rotation section lanes = 270 teaching minutes = 4.5h.
const CANONICAL_ACTUAL_TEACHING_MINUTES = 270;
const CANONICAL_ADVISER_CREDIT_MINUTES = 60;
const CANONICAL_TOTAL_TEACHING_MINUTES = 330;
const CANONICAL_ACTUAL_TEACHING_HOURS = 4.5;
const CANONICAL_ADVISER_CREDIT_HOURS = 1;
const CANONICAL_TOTAL_TEACHING_HOURS = 5.5;

function section(id: number, displayOrder = 7): ExternalSection {
	return {
		id,
		name: `Section ${id}`,
		maxCapacity: 50,
		enrolledCount: 40,
		gradeLevelId: 1,
		gradeLevelName: `Grade ${displayOrder}`,
		displayOrder,
	};
}

function subject(
	overrides: Partial<Subject> & Pick<Subject, 'id' | 'code' | 'name' | 'minMinutesPerWeek'>,
): Subject {
	return {
		schoolId: 1,
		schedulingDisposition: 'SCHEDULED_TEACHING',
		preferredRoomType: 'CLASSROOM',
		gradeLevels: [7],
		isActive: true,
		isSeedable: true,
		interSectionEnabled: false,
		interSectionGradeLevels: [],
		programScopes: [],
		allowedSpecializations: [],
		requiredFeatures: [],
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	} as Subject;
}

function member(overrides: Partial<FacultySummary> = {}): FacultySummary {
	return {
		id: 1,
		externalId: 1,
		employeeId: null,
		firstName: 'Test',
		lastName: 'Teacher',
		department: 'Mathematics',
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
		departmentCode: 'MATH',
		departmentLabel: 'Mathematics',
		departmentStatus: 'MAPPED',
		version: 1,
		subjectCount: 1,
		sectionCount: 6,
		subjectHours: 4.5,
		sectionTeachingHours: 4.5,
		gradeTeachingHours: 4.5,
		advisoryHours: 0,
		ancillaryHours: 0,
		policyCreditedHours: 5.5,
		policyLoadPercentage: 0,
		actualTeachingHours: 4.5,
		teachingUtilizationPercent: 15,
		teachingCapacityRemainingMinutes: 1530,
		excessTeachingMinutes: 0,
		creditedWorkloadMinutes: 330,
		syntheticCoverageHours: 0,
		loadSignalMode: 'STANDARD',
		assignments: [],
		...overrides,
	} as FacultySummary;
}

// Six 45-minute MATH lanes → 270 credited minutes (mirrors the export fixture's
// five MATH sessions + one rotation session, without the rotation machinery).
const CANONICAL_SUBJECT = subject({ id: 10, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 45 });
const CANONICAL_SUBJECTS = [CANONICAL_SUBJECT];
const CANONICAL_SECTIONS = new Map([1, 2, 3, 4, 5, 6].map((id) => [id, section(id)]));
const CANONICAL_ASSIGNMENTS: FacultyAssignmentDraft[] = [
	{ subjectId: 10, sectionIds: [1, 2, 3, 4, 5, 6], gradeLevels: [7] },
];

function canonicalProfile(baselineHours: number, maxHoursPerWeek = 40) {
	return buildTeachingLoadProfile(
		CANONICAL_ASSIGNMENTS,
		CANONICAL_SUBJECTS,
		CANONICAL_SECTIONS,
		baselineHours,
		POLICY,
		maxHoursPerWeek,
	);
}

// The retired (pre-correction) baseline: adviser credit PLUS ancillary minutes.
// Kept only to prove the controls are sensitive to the old behavior.
function legacyBaselineHours(row: Pick<FacultySummary, 'isClassAdviser' | 'ancillaryMinutesPerWeek'>, policy = POLICY): number {
	return resolveAdvisoryCreditHours(row, policy) + (row.ancillaryMinutesPerWeek || 0) / 60;
}

// ─── C1 — ancillary never changes the baseline or the credited total ───

test('C1 — ancillary minutes never change the effective-load baseline or the credited total', () => {
	const adviser = member({ isClassAdviser: true, ancillaryMinutesPerWeek: 0 });
	const adviserWithAncillary = member({ isClassAdviser: true, ancillaryMinutesPerWeek: 300 }); // +5h
	const nonAdviser = member({ isClassAdviser: false, ancillaryMinutesPerWeek: 300 });

	const baselinePlain = resolveEffectiveLoadBaselineHours(adviser, POLICY);
	const baselineAncillary = resolveEffectiveLoadBaselineHours(adviserWithAncillary, POLICY);
	const baselineNonAdviser = resolveEffectiveLoadBaselineHours(nonAdviser, POLICY);

	assert.equal(baselinePlain, CANONICAL_ADVISER_CREDIT_HOURS);
	assert.equal(baselineAncillary, CANONICAL_ADVISER_CREDIT_HOURS, 'ancillary never augments adviser credit');
	assert.equal(baselinePlain, baselineAncillary);
	assert.equal(baselineNonAdviser, 0, 'a non-adviser receives zero credit regardless of ancillary');

	const profilePlain = canonicalProfile(baselinePlain);
	const profileAncillary = canonicalProfile(baselineAncillary);

	assert.equal(profilePlain.actualTeachingHours, CANONICAL_ACTUAL_TEACHING_HOURS);
	assert.equal(
		profilePlain.creditedTotalHours,
		profilePlain.actualTeachingHours + CANONICAL_ADVISER_CREDIT_HOURS,
		'workspace total = actual teaching + adviser credit',
	);
	assert.equal(profilePlain.creditedTotalHours, CANONICAL_TOTAL_TEACHING_HOURS);
	assert.deepEqual(
		profileAncillary,
		profilePlain,
		'ancillary = 0 and ancillary ≠ 0 must produce a byte-identical workspace profile',
	);

	// Sensitivity: the retired baseline DIFFERS, so the controls above are load-bearing.
	assert.equal(legacyBaselineHours(adviserWithAncillary), 6);
	const legacyProfile = canonicalProfile(legacyBaselineHours(adviserWithAncillary));
	assert.equal(legacyProfile.creditedTotalHours, CANONICAL_ACTUAL_TEACHING_HOURS + 6);
	assert.notEqual(legacyProfile.creditedTotalHours, profileAncillary.creditedTotalHours);
});

// ─── C2 — ancillary never moves a classification surface ───

test('C2 — ancillary never moves load classification (status, utilization, bar, comparable load)', () => {
	// Boundary fixture: 30.0h actual teaching sits exactly at the 30h standard.
	// The retired ancillary inflation only moved the CREDITED total (30→36h).
	const BOUNDARY_SUBJECT = subject({ id: 20, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 180 });
	const boundarySections = new Map([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => [id, section(id)]));
	const boundaryAssignments: FacultyAssignmentDraft[] = [
		{ subjectId: 20, sectionIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], gradeLevels: [7] },
	];
	const adviser = member({
		isClassAdviser: true,
		ancillaryMinutesPerWeek: 0,
		actualTeachingHours: 30,
		sectionTeachingHours: 30,
	});
	const adviserWithAncillary = member({ ...adviser, ancillaryMinutesPerWeek: 300 });

	const baselinePlain = resolveEffectiveLoadBaselineHours(adviser, POLICY);
	const baselineAncillary = resolveEffectiveLoadBaselineHours(adviserWithAncillary, POLICY);
	assert.equal(baselinePlain, CANONICAL_ADVISER_CREDIT_HOURS);
	assert.equal(baselineAncillary, CANONICAL_ADVISER_CREDIT_HOURS);

	const profilePlain = buildTeachingLoadProfile(boundaryAssignments, [BOUNDARY_SUBJECT], boundarySections, baselinePlain, POLICY, 40);
	const profileAncillary = buildTeachingLoadProfile(boundaryAssignments, [BOUNDARY_SUBJECT], boundarySections, baselineAncillary, POLICY, 40);
	assert.equal(profilePlain.actualTeachingHours, 30);
	assert.equal(profilePlain.creditedTotalHours, 31);
	assert.deepEqual(profileAncillary, profilePlain, 'the profile is byte-identical with and without ancillary');

	// Surfaces fed directly by ACTUAL teaching hours: unaffected by credit anyway.
	assert.deepEqual(deriveTeachingLoadStatus(profilePlain.actualTeachingHours, 30, 40), { status: 'compliant', label: 'At standard' });
	assert.deepEqual(deriveTeachingLoadStatus(profileAncillary.actualTeachingHours, 30, 40), deriveTeachingLoadStatus(profilePlain.actualTeachingHours, 30, 40));
	assert.equal(teachingUtilizationPercentFor(adviser, 30), 100);
	assert.equal(teachingUtilizationPercentFor(adviserWithAncillary, 30), teachingUtilizationPercentFor(adviser, 30));
	assert.equal(getFacultyComparableLoadHours(adviser), 30);
	assert.equal(getFacultyComparableLoadHours(adviserWithAncillary), getFacultyComparableLoadHours(adviser));
	assert.equal(profilePlain.excessTeachingHours, 0);
	assert.equal(profilePlain.remainingHours, 0);

	// Surface fed by the BASELINE (`equivalentHours` → StackedWorkloadBar credit
	// segment, WorkloadInspector:169): identical with and without ancillary.
	const barPlain = resolveWorkloadBarState({
		teachingHours: profilePlain.actualTeachingHours,
		creditHours: profilePlain.equivalentHours,
		maxHours: 40,
		standardHours: 30,
	});
	const barAncillary = resolveWorkloadBarState({
		teachingHours: profileAncillary.actualTeachingHours,
		creditHours: profileAncillary.equivalentHours,
		maxHours: 40,
		standardHours: 30,
	});
	assert.deepEqual(barAncillary, barPlain, 'the rendered bar state is byte-identical with and without ancillary');
	assert.equal(barPlain.tone, 'at-standard');
	assert.equal(barPlain.teachingWidthPercent, 75);
	assert.equal(barPlain.creditWidthPercent, 2.5, 'only the 1h adviser credit widens the bar');

	// Sensitivity: the retired baseline moved the credited total AND the bar.
	const legacyProfile = buildTeachingLoadProfile(boundaryAssignments, [BOUNDARY_SUBJECT], boundarySections, legacyBaselineHours(adviserWithAncillary), POLICY, 40);
	assert.equal(legacyProfile.creditedTotalHours, 36);
	const legacyBar = resolveWorkloadBarState({
		teachingHours: legacyProfile.actualTeachingHours,
		creditHours: legacyProfile.equivalentHours,
		maxHours: 40,
		standardHours: 30,
	});
	assert.equal(legacyBar.creditWidthPercent, 15);
	assert.notEqual(legacyBar.creditWidthPercent, barPlain.creditWidthPercent);
});

// ─── C3 — export contract and workspace share one equation ───

test('C3 — teacher-program export and the Teaching Load workspace state the same equation', () => {
	const adviser = member({ isClassAdviser: true, ancillaryMinutesPerWeek: 300 }); // 5h ancillary present
	const baseline = resolveEffectiveLoadBaselineHours(adviser, POLICY);
	const profile = canonicalProfile(baseline);

	// Workspace (hours) — the identity the export asserts in minutes.
	assert.equal(profile.actualTeachingHours, CANONICAL_ACTUAL_TEACHING_HOURS);
	assert.equal(baseline, CANONICAL_ADVISER_CREDIT_HOURS);
	assert.equal(profile.creditedTotalHours, profile.actualTeachingHours + baseline);
	assert.equal(profile.creditedTotalHours, CANONICAL_TOTAL_TEACHING_HOURS);

	// Mechanical minute-level comparison against the export suite (control 4):
	//   atlas-server/src/__tests__/tt-output-c05r1-teacher-program.test.ts
	//   actualTeachingMinutes === 270, advisoryMinutes === 60, totalTeachingLoad === 330.
	assert.equal(profile.actualTeachingHours * 60, CANONICAL_ACTUAL_TEACHING_MINUTES);
	assert.equal(baseline * 60, CANONICAL_ADVISER_CREDIT_MINUTES);
	assert.equal(profile.creditedTotalHours * 60, CANONICAL_TOTAL_TEACHING_MINUTES);
	assert.equal(
		profile.creditedTotalHours * 60,
		profile.actualTeachingHours * 60 + baseline * 60,
		'total = actual + adviser credit on both surfaces',
	);
});

// ─── C4 — adviser credit stays policy-owned ───

test('C4 — adviser credit is policy-owned and cannot be substituted or augmented by ancillary', () => {
	const adviser = member({ isClassAdviser: true, advisoryEquivalentHours: 4, ancillaryMinutesPerWeek: 600 }); // +10h ancillary

	assert.equal(resolveEffectiveLoadBaselineHours(adviser, POLICY), advisoryCreditHoursOf(POLICY), 'the persisted policy is the only credit authority');
	assert.equal(resolveEffectiveLoadBaselineHours(adviser, POLICY), 1, 'the display-only mirror value never overrides policy');
	assert.equal(
		resolveEffectiveLoadBaselineHours(adviser, { ...POLICY, advisoryCreditMinutes: 360 }),
		6,
		'a persisted advisory-policy change flows through with no rebuild',
	);
	assert.equal(
		resolveEffectiveLoadBaselineHours(member({ isClassAdviser: false, ancillaryMinutesPerWeek: 600 }), POLICY),
		0,
		'ancillary can never substitute for adviser credit on a non-adviser',
	);
	assert.equal(
		resolveEffectiveLoadBaselineHours(member({ isClassAdviser: true, ancillaryMinutesPerWeek: 600 }), POLICY),
		1,
		'ancillary can never augment adviser credit on an adviser',
	);
});

// ─── C5 — AP stays ordinary demand; ARAL / HG / breaks contribute zero ───

test('C5 — AP contributes true teaching minutes; ARAL Program / HG / break rows contribute zero', () => {
	const ap = subject({ id: 50, code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 60 });
	const aral = subject({ id: 51, code: 'ARAL', name: 'ARAL Program', minMinutesPerWeek: 300, schedulingDisposition: 'REFERENCE_ONLY' });
	const hg = subject({ id: 52, code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 300, schedulingDisposition: 'REFERENCE_ONLY' });
	const breakLike = subject({ id: 53, code: 'BREAK', name: 'Configured Break', minMinutesPerWeek: 0 });
	const subjects = [ap, aral, hg, breakLike];
	const sections = new Map([[1, section(1)]]);

	// Canonical authority delivers AP ownership only: ARAL is absent from demand
	// and HG is REFERENCE_ONLY (zero pairs), so neither ever becomes an assignment.
	const profile = buildTeachingLoadProfile(
		[{ subjectId: 50, sectionIds: [1], gradeLevels: [7] }],
		subjects,
		sections,
		0,
		POLICY,
		40,
	);

	assert.equal(profile.actualTeachingHours, 1, 'AP contributes its true 60 teaching minutes (never zero)');
	assert.equal(profile.equivalentHours, 0, 'AP is teaching demand, never ancillary/credited');
	assert.equal(profile.creditedTotalHours, 1);
	assert.deepEqual(profile.breakdown.map((row) => row.subjectCode), ['AP'], 'no ARAL/HG/break lane enters the teaching breakdown');

	// A zero-minute non-teaching row contributes zero teaching load.
	const zeroMinute = buildTeachingLoadProfile(
		[{ subjectId: 53, sectionIds: [1], gradeLevels: [7] }],
		subjects,
		sections,
		0,
		POLICY,
		40,
	);
	assert.equal(zeroMinute.actualTeachingHours, 0);

	// Shared production predicate: HG is recognized as non-demand wherever it appears.
	assert.equal(isHomeroomGuidanceCode('HG'), true);
	assert.equal(isHomeroomGuidanceCode('AP'), false);
	assert.equal(isHomeroomGuidanceCode(null), false);
});
