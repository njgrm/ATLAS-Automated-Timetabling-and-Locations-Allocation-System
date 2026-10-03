/**
 * Teaching Load Automation Service
 *
 * Implements the state-preserving Auto-Fill algorithm per DO 005 s.2024.
 *
 * Algorithm Overview:
 *  1. Build a resolved-pair set and capacity map from existing SubjectSectionOwnership rows.
 *  2. Verify HG records for all active advisers (warn if missing).
 *  3. Build a work queue: all active subject × section pairs not already resolved.
 *  4. For each unresolved pair, find the best-qualified, lowest-loaded candidate.
 *  5. Respect DO 005 caps (standard = 1,800 min/week, hard = 2,400 min/week).
 *  6. Modular bundles: simulate the entire group and report cap-limited rows.
 *  7. Return a zero-write suggestion; reviewed proposal apply owns persistence.
 *  8. Return { preserved, created, unresolved, warnings, staffingReport }.
 *
 * Design invariants:
 * - NEVER overwrites an existing SubjectSectionOwnership row.
 * - HG advisory records are not touched (already written by hg-advisory.service).
 * - Business logic is entirely in this service; controllers are transport-only.
 */

import { getDataContext } from '../lib/data-context.js';
import { type SectionFetchResult, type SectionSourceLabel } from './section-adapter.js';
import { fetchSectionsForRuntimeControls } from './section.service.js';
import { HG_SUBJECT_CODE } from './hg-advisory.service.js';
import {
	matchesSubjectOwnershipDepartment,
	normalizeDepartmentCode,
	resolveRotationTermMetadata,
	resolveSubjectAllowedOwnerDepartments,
	resolveSubjectRotationFamily,
	resolveSubjectOwnerDepartmentCode,
} from './subject-ownership.service.js';
import {
	assertTeachingLoadWriteAuthority,
	getActiveSubjectCoverageSummary,
	getAssignmentSummary,
	previewOrApplyRealFacultyRecovery,
	previewOrApplyTeachingLoadTruthReconcile,
	previewOrApplyStaleOwnershipReconcile,
} from './faculty-assignment.service.js';
import { refreshTeachingLoadCycle } from './teaching-load-cycle.service.js';
import {
	buildDerivedDemand,
	type DerivedDemandBlocker,
	type DerivedDemandSuccess,
	type DerivedTeachingLoadPair,
} from './derived-demand.service.js';
import { WORKLOAD_DEFAULTS, workloadPolicyRevision, type WorkloadPolicy } from './workload-policy.service.js';
import {
	POLICY_DEFAULTS as SCHEDULING_POLICY_DEFAULTS,
	getEffectiveWorkloadPolicyFromClient,
	resolveSchedulingPolicyForRead,
	type EffectiveWorkloadPolicy,
} from './scheduling-policy.service.js';
import {
	effectiveWeeklyCapMinutes,
	evaluateWeeklyLoad,
	resolveRealFacultyCapMinutes as resolveRealFacultyCapMinutesShared,
	type TeachingLoadCapMode,
} from './teaching-load-capacity.service.js';
import {
	prepareTeachingLoadPlacementPlanner,
	selectFirstTimetableFeasibleCandidate,
	type PlacementPlanningSession,
	type TeachingLoadPlacementPlanner,
} from './teaching-load-placement-check.service.js';
import {
	buildQualificationPolicySnapshot,
	evaluateQualificationWithPolicy,
	resolveSubjectAllowedOwnerDepartments as resolvePersistedAllowedOwnerDepartments,
	type QualificationPolicy,
	type QualificationResult,
} from './qualification-evaluator.service.js';

const db = () => getDataContext();

// HG (Homeroom Guidance) is covered by the adviser's advisory credit and ARAL
// Program is an explicitly excluded beneficiary program. Neither may generate
// an ordinary Teaching Load demand row or consume teaching-minute capacity.
const NON_DEMAND_SUBJECT_CODES = [HG_SUBJECT_CODE, 'ARAL'] as const;

function isNonDemandSubjectCode(code: string | null | undefined): boolean {
	if (!code) return false;
	const normalized = code.trim().toUpperCase();
	return NON_DEMAND_SUBJECT_CODES.some((entry) => entry === normalized);
}

// DO 005 s.2024 weekly minute caps — sourced from workload policy defaults
const STANDARD_CAP_MIN = WORKLOAD_DEFAULTS.teachingStandardMinutes;
const HARD_CAP_MIN = WORKLOAD_DEFAULTS.hardCapMinutes;
const TRUE_LOAD_OUTLIER_OVERLOAD_HOURS = 24;
const TRUE_LOAD_OUTLIER_POLICY_MULTIPLIER = 2;

export type CoverageMode =
	| 'REAL_FACULTY_STANDARD'
	| 'REAL_FACULTY_HARD_CAP'
	| 'REAL_FACULTY_THEN_TEACHER_X';

export const COVERAGE_MODES: CoverageMode[] = [
	'REAL_FACULTY_STANDARD',
	'REAL_FACULTY_HARD_CAP',
	'REAL_FACULTY_THEN_TEACHER_X',
];

const DEFAULT_COVERAGE_MODE: CoverageMode = 'REAL_FACULTY_STANDARD';
const REAL_ONLY_STANDARD_MODE: CoverageMode = 'REAL_FACULTY_STANDARD';
const REAL_ONLY_HARD_CAP_MODE: CoverageMode = 'REAL_FACULTY_HARD_CAP';

/**
 * A8 c4: rank tier for a real teacher with no qualification match for the
 * subject. The canonical resolver returns tier 3 for an out-of-department
 * override, so 4 is the first free rank and stays below no real teacher.
 */
export const ANYONE_REAL_FACULTY_TIER = 4;

export type PersistedQualificationAuthority = {
	policy: QualificationPolicy;
	specializationAliases: Array<{ alias: string; canonical: string }>;
};

/**
 * A8 c4: exported so `teaching-load-cover.service.ts` resolves qualification
 * tiers through the SAME persisted-only policy snapshot the suggestion engine
 * uses, instead of re-deriving a second policy view that could disagree with it.
 */
export async function loadPersistedQualificationAuthority(schoolId: number, client?: unknown): Promise<PersistedQualificationAuthority> {
	const actor = (client ?? db()) as any;
	const [aliasRows, labelRows, prefixRows, permissionRows, specializationAliases] = await Promise.all([
		actor.departmentAlias.findMany({ where: { schoolId }, select: { alias: true, department: true } }),
		actor.departmentLabel.findMany({ where: { schoolId }, select: { code: true, label: true } }),
		actor.subjectOwnerPrefix.findMany({ where: { schoolId }, select: { prefix: true, department: true } }),
		actor.crossDepartmentPermission.findMany({ where: { schoolId }, select: { facultyId: true, subjectId: true } }),
		actor.specializationAlias.findMany({ where: { schoolId }, select: { alias: true, canonical: true } }),
	]);

	return {
		policy: buildQualificationPolicySnapshot(schoolId, {
			departmentAliases: aliasRows,
			departmentLabels: labelRows,
			subjectOwnerPrefixes: prefixRows,
			crossDepartmentPermissions: permissionRows,
			legacyCrossLanguageException: false,
			persistedOnly: true,
		}),
		specializationAliases: specializationAliases.map((row: any) => ({ alias: row.alias, canonical: row.canonical })),
	};
}

export interface AutoFillOptions {
	previewOnly?: boolean;
	staffingOnly?: boolean;
	coverageMode?: CoverageMode;
	/**
	 * Bind every suggestion-path read to this client. A reviewed proposal apply
	 * passes its Serializable transaction client here so coverage, canonical
	 * derived demand, and the pair set are resolved from one snapshot. Defaults
	 * to the ambient data context for read-only preview routes.
	 */
	client?: unknown;
	/**
	 * A8 c4 item 3: when `false`, the SAVED-placeholder pool is never consulted,
	 * so a caller can require real teachers only ("no to-be-hired, ever").
	 * Defaults to `true` so every existing caller keeps the placeholder fallback
	 * it has today.
	 *
	 * This option does not change ORDER. A placeholder is reachable only once the
	 * real pass has run and found nobody with room — see the ordering invariant on
	 * the placeholder pool below.
	 */
	allowPlaceholders?: boolean;
	/**
	 * A8 c4 correction (F2): when `true`, a real teacher with NO qualification
	 * match for a subject is offered at `ANYONE_REAL_FACULTY_TIER`, ranked after
	 * every QUALIFIED and OTHER_DEPARTMENT candidate.
	 *
	 * THIS IS A SEPARATE DECISION FROM `allowPlaceholders`. "Never hire a
	 * to-be-hired" and "an unqualified teacher is acceptable" are independent
	 * operator judgements, and A8 c4 had welded them together.
	 *
	 * It defaults to `false` because a `REAL_TEACHER` row becomes a PERSISTED
	 * `SubjectSectionOwnership` insert, and the reviewed suggestion-apply path
	 * (the only writer) requires every insert receiver to be qualification-valid.
	 * Opting in makes an insert that the apply path refuses with a typed reason
	 * and zero writes — the cover surface (`cover-candidates` /
	 * `cover-assignments`) is a separate implementation and is unaffected either
	 * way, so its three tiers never shrink.
	 */
	allowUnqualifiedRealFaculty?: boolean;
	/** Test seam for exercising auto-fill's shape-ranking wiring with a fixed snapshot. */
	placementPlanner?: TeachingLoadPlacementPlanner;
}

export interface StaffingTruthBucket {
	shortageRows: number;
	shortageConcurrentHoursPerWeek: number;
	shortageConcurrentMinutesPerWeek: number;
	rowsClosedByRealFaculty: number;
	rowsClosedByTeacherX: number;
}

export interface StaffingTruthComparison {
	baseline: {
		totalTeachableRows: number;
		realCoveredRows: number;
		syntheticCoveredRows: number;
		unassignedRows: number;
	};
	realOnly: StaffingTruthBucket;
	hardCap: StaffingTruthBucket;
	teacherX: StaffingTruthBucket;
}

export interface SuggestedRowPreview {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	sectionId: number;
	sectionName: string;
	facultyId: number | null;
	facultyName: string;
	/**
	 * - `KEPT_EXISTING` — an ownership row the plan preserves unchanged.
	 * - `REAL_TEACHER` — a new assignment to a real (non-placeholder) teacher. On
	 *   the DEFAULT path that teacher is also QUALIFIED for the subject: a
	 *   `REAL_TEACHER` row becomes a persisted `SubjectSectionOwnership` insert,
	 *   and the reviewed suggestion apply re-validates every insert receiver and
	 *   refuses an unqualified one. A caller that passes
	 *   `allowUnqualifiedRealFaculty: true` can still PREVIEW an unqualified
	 *   `REAL_TEACHER` row; that plan is refused at apply time with a typed reason
	 *   and zero writes, so the persisted set is qualification-valid.
	 * - `PLACEHOLDER_TEACHER` — TL-SHORTAGE-C02 item 3: a new assignment to a
	 *   SAVED `isPlaceholder` teacher who holds the subject qualification. This
	 *   is a PERSISTED insert, unlike a substitute.
	 * - `TEMPORARY_SUBSTITUTE` — preview-only, `facultyId` is null, never saved.
	 */
	assignmentType: 'KEPT_EXISTING' | 'REAL_TEACHER' | 'PLACEHOLDER_TEACHER' | 'TEMPORARY_SUBSTITUTE';
	warning?: string | null;
}

export type TeachingLoadCandidateRejectionReason =
	| 'PROGRAM_SCOPE_INCOMPATIBLE'
	| 'NOT_QUALIFIED'
	| 'HARD_CAP_EXCEEDED'
	| 'CURRENT_OWNER'
	| 'PLACEHOLDER_FACULTY'
	/** Ownership outside canonical derived demand is never an ordinary move target. */
	| 'OUTSIDE_CANONICAL_DEMAND'
	/**
	 * SHIFT-COHERENCE-C01 (D11): the candidate's acceptance would place the
	 * teacher into both shift windows (a duty day exceeding the 8-hour service
	 * day). Emitted only under the HARD policy switch; always overridable by a
	 * manual assignment.
	 */
	| 'SHIFT_COHERENCE_CONFLICT'
	/** The candidate has capacity but cannot fit the current timetable shape. */
	| 'TIMETABLE_SHAPE_CONFLICT';

export interface TeachingLoadCandidateRejection {
	subjectId: number;
	subjectCode: string;
	sectionId: number;
	sectionName: string;
	facultyId: number;
	facultyName: string;
	reason: TeachingLoadCandidateRejectionReason;
	/** Generator-aligned placement reason when the timetable shape rejected the candidate. */
	placementReason?: string;
	/**
	 * SHIFT-COHERENCE-C01 (D11): present only on a `SHIFT_COHERENCE_CONFLICT`
	 * rejection so the operator sees the exact windows that make the teacher
	 * span and the sections responsible — never an aggregate-only count.
	 */
	spanningWindows?: ShiftCoherenceWindow[];
	sections?: ShiftCoherenceSection[];
}

/**
 * FACULTY-GRADE-PREFERENCE-C01 (decision D10): a SOFT, non-blocking advisory
 * emitted when a CHOSEN assignment places a teacher outside their own persisted
 * grade preference. It is deliberately NOT a `TeachingLoadCandidateRejection`:
 * the teacher is not skipped, coverage is unchanged, and the advisory never
 * removes a candidate from ranking. Keeping it a separate type also avoids
 * widening the client's closed `TeachingLoadCandidateRejectionReason` union.
 */
export type TeachingLoadPreferenceNoticeReason = 'OUTSIDE_PREFERRED_GRADE';

export interface TeachingLoadPreferenceNotice {
	subjectId: number;
	subjectCode: string;
	sectionId: number;
	sectionName: string;
	facultyId: number;
	facultyName: string;
	/** The numeric JHS grade (7-10) of the section the teacher was assigned to. */
	gradeLevel: number;
	/** The teacher's persisted preference. Empty means no preference. */
	preferredGradeLevels: number[];
	reason: TeachingLoadPreferenceNoticeReason;
}

/**
 * SHIFT-COHERENCE-C01 (decision D11) — a resolved grade shift window.
 *
 * Windows come from `grade_shift_windows` for `(schoolId, schoolYearId)`. The
 * numeric grade is the section's `displayOrder`, never an EnrollPro
 * `gradeLevelId`. A section with no matching row (exact programType, else
 * programType = null) has NO shift authority and contributes no window.
 */
export interface ShiftCoherenceWindow {
	gradeLevel: number;
	programType: string | null;
	startTime: string;
	endTime: string;
}

/** A section the teacher already holds (or is being considered for). */
export interface ShiftCoherenceSection {
	id: number;
	name: string;
	gradeLevel: number;
}

/**
 * SHIFT-COHERENCE-C01 (D11): a SOFT advisory naming WHO spans and WHY. Emitted
 * under the default SOFT switch; the HARD switch emits the typed
 * `SHIFT_COHERENCE_CONFLICT` rejection instead.
 *
 * The guard gates `autoFill` candidate selection ONLY. Manual assignment and the
 * reviewed proposal-apply path are deliberately NOT gated: a scheduler can
 * always place a spanning teacher by hand, and the guard never throws or blocks
 * generation — a row with no coherent candidate is simply left unresolved.
 */
export interface TeachingLoadShiftCoherenceNotice {
	subjectId: number;
	subjectCode: string;
	sectionId: number;
	sectionName: string;
	facultyId: number;
	facultyName: string;
	reason: 'SHIFT_COHERENCE_CONFLICT';
	/** The distinct resolved windows that make the teacher span. */
	spanningWindows: ShiftCoherenceWindow[];
	/** The sections responsible for the span (already assigned + candidate). */
	sections: ShiftCoherenceSection[];
}

const MAX_CANDIDATE_REJECTIONS = 100;

function appendBoundedCandidateRejections(
	target: TeachingLoadCandidateRejection[],
	rows: TeachingLoadCandidateRejection[],
): void {
	const seen = new Set(target.map((row) => `${row.subjectId}:${row.sectionId}:${row.facultyId}:${row.reason}`));
	for (const row of rows) {
		if (target.length >= MAX_CANDIDATE_REJECTIONS) return;
		const key = `${row.subjectId}:${row.sectionId}:${row.facultyId}:${row.reason}`;
		if (seen.has(key)) continue;
		seen.add(key);
		target.push(row);
	}
}

export interface DistributionRetainAction {
	action: 'RETAIN';
	subjectId: number;
	sectionId: number;
	facultyId: number;
}

export interface DistributionInsertAction {
	action: 'INSERT';
	subjectId: number;
	sectionId: number;
	facultyId: number;
}

export type DistributionMoveAction = OverCapRebalanceMove & { action: 'MOVE' };

export interface TeachingLoadDistributionSummary {
	/** Subject-section pairs that already have a valid owner. */
	coveredRows: number;
	/** Subject-section pairs still without an owner. */
	uncoveredRows: number;
	/** Exact reallocation moves proposed for existing over-standard owners. */
	proposedMoves: number;
	/** Above-standard owners that still have no eligible receiver after the plan. */
	unresolvedImbalance: number;
	/** Faculty above the teaching standard / individual weekly maximum (e.g. 30h). */
	aboveStandardFaculty: number;
	/** Faculty above the policy absolute hard cap (e.g. 40h). */
	hardCapBreaches: number;
	/**
	 * Whether the distribution evaluator actually ran. False means the result is
	 * unknown, and `balanced` must not be trusted as success.
	 */
	distributionEvaluated: boolean;
	/** True only when distribution was evaluated AND coverage and balance are safe. */
	balanced: boolean;
}

export interface TeachingLoadDistributionPlan {
	retains: DistributionRetainAction[];
	inserts: DistributionInsertAction[];
	moves: DistributionMoveAction[];
	/** Bounded, stable rejection details that explain why receivers were skipped. */
	candidateRejections?: TeachingLoadCandidateRejection[];
	/**
	 * Exact persisted workload policy that produced this plan. Null when the
	 * policy was UNCONFIGURED; the plan must then never be applied.
	 */
	policy: TeachingLoadDistributionPolicyBinding | null;
	summary: TeachingLoadDistributionSummary;
}

export interface TeachingLoadDistributionPolicyBinding {
	teachingStandardMinutes: number;
	advisoryCreditMinutes: number;
	hardCapMinutes: number;
	revision: string;
}

export interface AutoFillResult {
	preserved: number;
	/**
	 * TL-SHORTAGE-C02 item 2 (correction R1) — PERSISTED assignments only: the
	 * number of distribution INSERTs, which is exactly what a reviewed apply
	 * writes as `subjectSectionOwnership` rows.
	 *
	 * It does NOT include Teacher-X `TEMPORARY_SUBSTITUTE` rows. Those are
	 * preview-only (they carry `facultyId: null`, are stripped from the plan and
	 * are never persisted), so counting them here made a run that created
	 * nothing report a non-zero created count. Read the substitute rows from
	 * `teacherXResolution.unsavedSubstituteRows` and the real uncovered count
	 * from `stillNeedRealTeacher`.
	 */
	created: number;
	/** Same persisted-assignment count as `created`; kept for back-compat. */
	assignmentsCreated: number;
	/**
	 * Distinct teachers named by the persisted INSERTs. A substitute row names no
	 * teacher, so it can never make this count non-zero.
	 */
	uniqueTeachersAffected: number;
	unresolved: number;
	coverageMode: CoverageMode;
	warnings: string[];
	sectionSource: SectionSourceLabel;
	sectionFallbackReason: string | null;
	staffingReport: StaffingReport;
	staffingTruth: StaffingTruthComparison;
	teacherXResolution?: {
		applied: boolean;
		rowsClosedByTeacherX: number;
		createdPlaceholders: number;
		reusedPlaceholders: number;
		placeholderAssignmentsUpserted: number;
		resolvedSubjectCodes: string[];
		stillUncoveredSubjectCodes: string[];
		/**
		 * TL-SHORTAGE-C02 item 2 — the substitutes counted by `rowsClosedByTeacherX`
		 * are PREVIEW-ONLY. They carry `facultyId: null`, are stripped from the
		 * distribution plan, and are never persisted by apply, so this number is
		 * NOT delivered coverage. Read it as "unsaved substitute rows", never as
		 * "classes covered".
		 */
		unsavedSubstituteRows?: number;
	};
	/**
	 * TL-SHORTAGE-C02 item 2 — subject-section pairs this plan still needs a REAL
	 * teacher for, i.e. the number generation will emit `TL_DEMAND_UNCOVERED`
	 * blockers for. This is the field a UI must read for Teacher-X mode;
	 * `unresolved` carries the same value for back-compat.
	 */
	stillNeedRealTeacher?: number;
	suggestedRows?: SuggestedRowPreview[];
	/** Bounded, stable rejection details for uncovered subject-section rows. */
	candidateRejections?: TeachingLoadCandidateRejection[];
	/**
	 * FACULTY-GRADE-PREFERENCE-C01 (D10): bounded, SOFT advisories for chosen
	 * assignments that fall outside a teacher's persisted preference. These never
	 * block an assignment and never reduce coverage.
	 */
	preferenceNotices?: TeachingLoadPreferenceNotice[];
	/**
	 * SHIFT-COHERENCE-C01 (D11): bounded SOFT advisories naming a chosen
	 * assignment that places the teacher into both shift windows. Emitted only
	 * under the SOFT switch; HARD surfaces the typed rejection instead.
	 */
	shiftCoherenceNotices?: TeachingLoadShiftCoherenceNotice[];
	/** Coverage + distribution plan. Never report full success from coverage alone. */
	distribution?: TeachingLoadDistributionPlan;
	/** Moves actually persisted by an apply call. */
	movesApplied?: number;
	/**
	 * Canonical `DERIVED_DEMAND_V2` revision that produced this suggestion set.
	 * The reviewed proposal apply re-resolves this revision through its
	 * Serializable transaction client and fails closed when it changed.
	 */
	derivedDemandRevision: string;
	/** Exact count of canonical (SCHEDULED_TEACHING) subject-section pairs consumed. */
	canonicalDemandPairCount: number;
	/**
	 * Current-year ownership rows that fall outside canonical derived demand
	 * (e.g. REFERENCE_ONLY subjects or scope-mismatched sections). They are
	 * excluded from suggestion demand, staffing need, and ordinary minutes.
	 */
	outsideDemandOwnershipCount: number;
}

export type TeachingLoadSplitBrainReasonCode =
	| 'ASSIGNED_PAIR_MISMATCH'
	| 'UNASSIGNED_PAIR_MISMATCH'
	| 'TOTAL_PAIR_MISMATCH'
	| 'FACULTY_LOAD_OUTLIER'
	| 'FACULTY_LOAD_REVIEW_REQUIRED'
	| 'INTEGRITY_MISSING_OWNERSHIP'
	| 'INTEGRITY_OWNERSHIP_WITHOUT_SCOPE'
	| 'INTEGRITY_OUT_OF_SUBJECT_SCOPE'
	| 'STALE_OWNERSHIP_PRESENT'
	| 'TRUTH_RECONCILE_PENDING'
	| 'REAL_FACULTY_RECOVERY_PENDING'
	| 'REAL_FACULTY_RECOVERY_BLOCKERS'
	| 'SPECIAL_PROGRAM_APPROVAL_REQUIRED';

export interface TeachingLoadSplitBrainOutlierFacultyRow {
	facultyId: number;
	facultyName: string;
	policyCreditedHours: number;
	maxHoursPerWeek: number;
	overloadHours: number;
	subjectCodes: string[];
}

export interface TeachingLoadSplitBrainIntegrityDetailRow {
	facultyId: number;
	facultyName: string;
	subjectId: number;
	subjectCode: string;
	sectionCount: number;
}

export interface TeachingLoadSplitBrainRecoveryBlocker {
	subjectCode: string;
	sectionId: number;
	category:
		| 'TRUE_DEPARTMENT_SHORTAGE'
		| 'SKEWED_ASSIGNMENT_TOPOLOGY'
		| 'UNRESOLVED_AUTOMATION_SEED_BIAS'
		| 'ROTATION_FAMILY_MODELING_GAP'
		| 'SUBJECT_CONTRACT_GAP';
	reason: string;
}

export interface TeachingLoadSplitBrainReconcileInput {
	schoolId: number;
	schoolYearId: number;
	actorId: number;
	authToken?: string;
	previewOnly?: boolean;
}

export interface TeachingLoadSplitBrainApprovalRequiredCandidate {
	subjectCode: string;
	subjectName: string;
	facultyId: number;
	facultyName: string;
	department: string | null;
	specialization: string | null;
	currentTotalAssignedPairs: number;
	requiredSpecializationCodes: string[];
	reason: string;
}

export interface TeachingLoadSplitBrainReconcileResult {
	applied: boolean;
	schoolId: number;
	schoolYearId: number;
	quarantine: {
		required: boolean;
		severity: 'NONE' | 'WARNING' | 'BLOCKING';
		reasonCodes: TeachingLoadSplitBrainReasonCode[];
		message: string;
	};
	counters: {
		summaryAssignedPairs: number;
		summaryUnassignedPairs: number;
		summaryTotalPairs: number;
		coverageAssignedPairs: number;
		coverageUnassignedPairs: number;
		coverageTotalPairs: number;
		assignmentPairDelta: number;
		unassignedPairDelta: number;
		totalPairDelta: number;
		integrityMissingOwnershipPairs: number;
		integrityOwnershipWithoutScopePairs: number;
		integrityOutOfSubjectScopePairs: number;
		staleOwnedCurrentYearPairs: number;
		overloadedFacultyRows: number;
		trueLoadOutlierRows: number;
		loadReviewRows: number;
		approvalLinkedLoadRows: number;
		truthRowsToUpdate: number;
		realFacultyMovesPlanned: number;
		realFacultyBlockers: number;
		specialProgramApprovalCandidates: number;
	};
	repairPreview: {
		truthReconcile: {
			rowsToUpdate: number;
			updatedRows: number;
			rowsWithOutOfSubjectScope: number;
			outOfSubjectScopePairCount: number;
		};
		staleReconcile: {
			staleOwnedCurrentYearPairCount: number;
			deletedOwnershipRows: number;
		};
		realFacultyRecovery: {
			placeholderMovesPlanned: number;
			placeholderMovesApplied: number;
			blockerCount: number;
			blockers: TeachingLoadSplitBrainRecoveryBlocker[];
		};
		integrity: {
			missingOwnershipSamples: TeachingLoadSplitBrainIntegrityDetailRow[];
			ownershipWithoutScopeSamples: TeachingLoadSplitBrainIntegrityDetailRow[];
			outOfSubjectScopeSamples: TeachingLoadSplitBrainIntegrityDetailRow[];
		};
		loadOutliers: {
			rows: TeachingLoadSplitBrainOutlierFacultyRow[];
		};
	};
	specialProgramApprovalQueue: TeachingLoadSplitBrainApprovalRequiredCandidate[];
}

export interface StaffingCrossTrainee {
	department: string;
	availableTeachers: number;
	totalSpareHours: number;
	qualifiedRecoveryHoursPerWeek?: number;
}

export interface StaffingReport {
	department: string;
	dominantShortageDepartment: string;
	unassignedSections: number;
	missingHoursPerWeek: number;
	concurrentUnassignedSections: number;
	concurrentMissingHoursPerWeek: number;
	recoverableConcurrentRows: number;
	recoverableConcurrentMissingHoursPerWeek: number;
	recoverableConcurrentMissingMinutesPerWeek: number;
	constrainedConcurrentRows: number;
	constrainedConcurrentMissingHoursPerWeek: number;
	constrainedConcurrentMissingMinutesPerWeek: number;
	recommendedNewHires: number;
	internalCrossTrainees: StaffingCrossTrainee[];
	missingMinutesPerWeek: number;
	concurrentMissingMinutesPerWeek: number;
	rotationAdjustedMinutesPerWeek: number;
	shortages: StaffingShortageDetail[];
}

export interface StaffingShortageDetail {
	department: string;
	count: number;
	missingMinutesPerWeek: number;
	concurrentCount: number;
	concurrentMissingMinutesPerWeek: number;
	recoverableConcurrentCount: number;
	recoverableConcurrentMissingMinutesPerWeek: number;
	constrainedConcurrentCount: number;
	constrainedConcurrentMissingMinutesPerWeek: number;
	rotationAdjustedMinutesPerWeek: number;
	sections: Array<{
		subjectId: number;
		subjectCode: string;
		subjectName: string;
		sectionId: number;
		sectionName: string;
		programType: string;
	}>;
}

interface SubjectRow {
	id: number;
	code: string;
	name: string;
	rotationFamily: string | null;
	gradeLevels: number[];
	programScopes: string[];
	minMinutesPerWeek: number;
	modularGroupId: string | null;
	modularOrder: number | null;
	termGroupId: string | null;
	termCount: number | null;
	ownerDepartment: string | null;
	requiredFeatures: string[];
	allowedSpecializations: string[];
}

interface FacultyRow {
	id: number;
	firstName: string;
	lastName: string;
	department: string | null;
	specialization: string | null;
	canTeachOutsideDepartment: boolean;
	maxHoursPerWeek: number;
	isPlaceholder: boolean;
	isClassAdviser: boolean;
	advisoryEquivalentHours: number;
	ancillaryMinutesPerWeek: number | null;
	advisedSectionId: number | null;
}

interface UnresolvedPair {
	subjectId: number;
	sectionId: number;
	subject: SubjectRow;
	sectionName: string;
	sectionProgramType: string;
}

interface CoverageSimulationResult {
	rowsClosedByRealFaculty: number;
	unresolvedPairs: UnresolvedPair[];
	capacityUsed: Map<number, number>;
	staffingReport: StaffingReport;
	candidateRejections: TeachingLoadCandidateRejection[];
	preferenceNotices: TeachingLoadPreferenceNotice[];
	shiftCoherenceNotices: TeachingLoadShiftCoherenceNotice[];
}

interface StaffingShortageBucket {
	department: string;
	rawUnassignedSections: number;
	rawMissingMinutesPerWeek: number;
	concurrentUnassignedSections: number;
	concurrentMissingMinutesPerWeek: number;
	recoverableConcurrentCount: number;
	recoverableConcurrentMissingMinutesPerWeek: number;
	constrainedConcurrentCount: number;
	constrainedConcurrentMissingMinutesPerWeek: number;
	rotationAdjustedMinutesPerWeek: number;
}

interface ConcurrentLaneDemand {
	department: string;
	minutes: number;
	allowedOwnerDepartments: string[];
}

async function fetchSectionsForAutoFill(
	schoolId: number,
	schoolYearId: number,
	authToken?: string,
): Promise<SectionFetchResult> {
	return fetchSectionsForRuntimeControls(schoolId, schoolYearId, {
		authToken,
		preferLocalEvidenceFirst: true,
	});
}

/**
 * Convert maxHoursPerWeek to minutes/week for capacity calculations.
 * FacultyMirror.maxHoursPerWeek stores the limit in hours (default 30).
 *
 * When nonTeachingMinutes is provided, the cap is reduced by advisory + ancillary
 * credits so the auto-fill's capacity gate matches the roster's policyCreditedHours
 * semantics (credited load = teaching + advisory + ancillary).
 */
/**
 * TL-SHORTAGE-C02 item 1: the auto-fill capacity gate delegates to the ONE
 * shared cap rule. The hard-cap branch used to be a bare `HARD_CAP_MIN` that
 * never read `maxHoursPerWeek`, so a 30h teacher was promised a 40h budget and
 * then flagged over cap by the same plan.
 */
function resolveRealFacultyCapMinutes(faculty: FacultyRow, mode: CoverageMode, nonTeachingMinutes?: number): number {
	return resolveSharedRealFacultyCapMinutes(faculty.maxHoursPerWeek, mode, nonTeachingMinutes);
}

/**
 * Module-level wrapper over the shared rule. The policy ceilings are resolved
 * once from the effective workload policy where available so a persisted policy
 * change is honoured, falling back to the workload defaults exactly as the
 * former module constants did.
 */
function resolveSharedRealFacultyCapMinutes(
	maxHoursPerWeek: number,
	mode: CoverageMode,
	nonTeachingMinutes?: number,
	policy?: { teachingStandardMinutes?: number | null; hardCapMinutes?: number | null } | null,
): number {
	return resolveRealFacultyCapMinutesShared({
		maxHoursPerWeek,
		mode: mode === REAL_ONLY_STANDARD_MODE ? 'REAL_FACULTY_STANDARD' : 'REAL_FACULTY_HARD_CAP',
		policyStandardMinutes: Math.max(0, Math.round(policy?.teachingStandardMinutes ?? STANDARD_CAP_MIN)),
		policyHardCapMinutes: Math.max(0, Math.round(policy?.hardCapMinutes ?? HARD_CAP_MIN)),
		nonTeachingMinutes,
	});
}

function resolveRealCoverageMode(coverageMode: CoverageMode): CoverageMode {
	return coverageMode === REAL_ONLY_STANDARD_MODE ? REAL_ONLY_STANDARD_MODE : REAL_ONLY_HARD_CAP_MODE;
}

type CapacityLedger = {
	lanes: Map<string, number>;
	nonRotationMinutes: number;
	rotationFamilyTermTotals: Map<string, Map<number, number>>;
	creditedMinutes: number;
};

type CapacityLaneDescriptor =
	| { kind: 'non-rotation' }
	| { kind: 'rotation'; family: string; termKey: number };

function cloneCapacityLedgers(source: Map<number, CapacityLedger>): Map<number, CapacityLedger> {
	const cloned = new Map<number, CapacityLedger>();
	for (const [facultyId, ledger] of source.entries()) {
		cloned.set(facultyId, {
			lanes: new Map<string, number>(ledger.lanes),
			nonRotationMinutes: ledger.nonRotationMinutes,
			rotationFamilyTermTotals: new Map(
				Array.from(ledger.rotationFamilyTermTotals.entries()).map(([family, totals]) => [family, new Map<number, number>(totals)]),
			),
			creditedMinutes: ledger.creditedMinutes,
		});
	}
	return cloned;
}

function parseCapacityLaneDescriptor(laneKey: string): CapacityLaneDescriptor {
	const rotationMatch = /^family:([^:]+):term:(\d+):\d+$/.exec(laneKey);
	if (rotationMatch) {
		return {
			kind: 'rotation',
			family: rotationMatch[1],
			termKey: Number(rotationMatch[2]),
		};
	}

	return { kind: 'non-rotation' };
}

function getFamilyPeakMinutes(termTotals: Map<number, number>): number {
	let peak = 0;
	for (const value of termTotals.values()) {
		if (value > peak) {
			peak = value;
		}
	}
	return peak;
}

function createEmptyCapacityLedger(): CapacityLedger {
	return {
		lanes: new Map<string, number>(),
		nonRotationMinutes: 0,
		rotationFamilyTermTotals: new Map<string, Map<number, number>>(),
		creditedMinutes: 0,
	};
}

function estimateCapacityLaneDeltaMinutes(
	ledger: CapacityLedger,
	laneKey: string,
	nextLaneMinutes: number,
): number {
	const normalizedMinutes = Math.max(0, Number(nextLaneMinutes) || 0);
	if (normalizedMinutes <= 0) {
		return 0;
	}

	const currentLaneMinutes = ledger.lanes.get(laneKey) ?? 0;
	if (normalizedMinutes <= currentLaneMinutes) {
		return 0;
	}

	const laneIncrease = normalizedMinutes - currentLaneMinutes;
	const descriptor = parseCapacityLaneDescriptor(laneKey);
	if (descriptor.kind === 'non-rotation') {
		return laneIncrease;
	}

	// Rotation-family capacity fix (TL-01 Fix A): sections within the SAME
	// family and SAME term run CONCURRENTLY in the timetable (the constructor
	// schedules each section's sessions inside that section's term window),
	// so same-term lane minutes must ADD UP, not collapse to a peak. Only
	// DISTINCT terms of the same family rotate against each other. Billing
	// the peak alone let one teacher absorb dozens of same-term rotation
	// sections while staying "under cap" (the 2026-09-02 PAOLO/FRANCIS 114h
	// incident: 29 TLE sections across 3 same-term subjects billed ~30h).
	const termTotals = ledger.rotationFamilyTermTotals.get(descriptor.family) ?? new Map<number, number>();
	const termTotalAfter = (termTotals.get(descriptor.termKey) ?? 0) + laneIncrease;
	const otherTermTotals = Array.from(termTotals.entries())
		.filter(([termKey]) => termKey !== descriptor.termKey)
		.map(([, minutes]) => minutes);
	const concurrentPeakAfter = Math.max(termTotalAfter, ...(otherTermTotals.length > 0 ? otherTermTotals : [0]));
	const concurrentPeakBefore = getFamilyPeakMinutes(termTotals);
	return Math.max(0, concurrentPeakAfter - concurrentPeakBefore);
}

function estimateProjectedRotationFamilyPeakMinutes(
	ledger: CapacityLedger,
	laneKey: string,
	nextLaneMinutes: number,
): number {
	const descriptor = parseCapacityLaneDescriptor(laneKey);
	if (descriptor.kind === 'non-rotation') {
		return 0;
	}

	const normalizedMinutes = Math.max(0, Number(nextLaneMinutes) || 0);
	const currentLaneMinutes = ledger.lanes.get(laneKey) ?? 0;
	const termTotals = ledger.rotationFamilyTermTotals.get(descriptor.family) ?? new Map<number, number>();
	const termTotalBefore = termTotals.get(descriptor.termKey) ?? 0;
	const peakBefore = getFamilyPeakMinutes(termTotals);
	const laneIncrease = Math.max(0, normalizedMinutes - currentLaneMinutes);
	const termTotalAfter = termTotalBefore + laneIncrease;
	return Math.max(peakBefore, termTotalAfter);
}

function applyCapacityLaneMinutesToLedger(
	ledger: CapacityLedger,
	laneKey: string,
	nextLaneMinutes: number,
): number {
	const deltaMinutes = estimateCapacityLaneDeltaMinutes(ledger, laneKey, nextLaneMinutes);
	if (deltaMinutes <= 0) {
		return 0;
	}

	const normalizedMinutes = Math.max(0, Number(nextLaneMinutes) || 0);
	const currentLaneMinutes = ledger.lanes.get(laneKey) ?? 0;
	const laneIncrease = normalizedMinutes - currentLaneMinutes;
	ledger.lanes.set(laneKey, normalizedMinutes);

	const descriptor = parseCapacityLaneDescriptor(laneKey);
	if (descriptor.kind === 'non-rotation') {
		ledger.nonRotationMinutes += laneIncrease;
	} else {
		const termTotals = ledger.rotationFamilyTermTotals.get(descriptor.family) ?? new Map<number, number>();
		const termTotalBefore = termTotals.get(descriptor.termKey) ?? 0;
		termTotals.set(descriptor.termKey, termTotalBefore + laneIncrease);
		ledger.rotationFamilyTermTotals.set(descriptor.family, termTotals);
	}

	ledger.creditedMinutes += deltaMinutes;
	return deltaMinutes;
}

function createCapacityLedgerFromLanes(lanes: Map<string, number>): CapacityLedger {
	const ledger = createEmptyCapacityLedger();
	for (const [laneKey, laneMinutes] of lanes.entries()) {
		const normalized = Math.max(0, Number(laneMinutes) || 0);
		if (normalized <= 0) {
			continue;
		}
		applyCapacityLaneMinutesToLedger(ledger, laneKey, normalized);
	}
	return ledger;
}

export function __testComputeCreditedCapacityMinutes(lanes: Map<string, number>): number {
	return createCapacityLedgerFromLanes(lanes).creditedMinutes;
}

export function __testEstimateCapacityLaneDeltaMinutes(
	lanes: Map<string, number>,
	laneKey: string,
	nextLaneMinutes: number,
): number {
	const ledger = createCapacityLedgerFromLanes(lanes);
	return estimateCapacityLaneDeltaMinutes(ledger, laneKey, nextLaneMinutes);
}

export function __testResolveEffectiveCapMinutes(
	maxHoursPerWeek: number,
	mode: CoverageMode,
	nonTeachingMinutes: number,
): number {
	// Exported control surface for TL-SHORTAGE-C02 item 1: the auto-fill cap and
	// the proposal-apply receiver cap must resolve identically for the same
	// teacher, because both call the one shared rule.
	return resolveRealFacultyCapMinutes(
		{ id: 0, firstName: '', lastName: '', department: null, specialization: null, canTeachOutsideDepartment: false, maxHoursPerWeek, isPlaceholder: false, isClassAdviser: false, advisoryEquivalentHours: 0, ancillaryMinutesPerWeek: null, advisedSectionId: null },
		mode,
		nonTeachingMinutes,
	);
}

function resolveCapacityRotationFamily(
	subjectCode: string | null | undefined,
	explicitRotationFamily: string | null | undefined,
	modularGroupId?: string | null,
): string | null {
	const explicit = (explicitRotationFamily ?? '').trim().toUpperCase();
	if (explicit.length > 0) {
		return explicit;
	}
	const fallback = resolveSubjectRotationFamily(subjectCode, modularGroupId ?? null);
	const normalizedFallback = (fallback ?? '').trim().toUpperCase();
	return normalizedFallback.length > 0 ? normalizedFallback : null;
}

function normalizeRotationTermLaneKey(termRank: number | null): number {
	return Number.isInteger(termRank) && Number(termRank) > 0 ? Number(termRank) : 0;
}

function buildCapacityLaneKey(input: {
	subjectId: number;
	subjectCode: string | null | undefined;
	rotationFamily: string | null | undefined;
	modularGroupId?: string | null;
	modularOrder?: number | null;
	termGroupId?: string | null;
	termCount?: number | null;
	sectionId: number;
}): string {
	const rotationFamily = resolveCapacityRotationFamily(
		input.subjectCode,
		input.rotationFamily,
		input.modularGroupId ?? null,
	);
	if (!rotationFamily) {
		return `subject:${input.subjectId}:${input.sectionId}`;
	}
	const termMetadata = resolveRotationTermMetadata({
		subjectCode: input.subjectCode,
		rotationFamily,
		modularGroupId: input.modularGroupId ?? null,
		modularOrder: input.modularOrder ?? null,
		termGroupId: input.termGroupId ?? null,
		termCount: input.termCount ?? null,
	});
	return `family:${rotationFamily}:term:${normalizeRotationTermLaneKey(termMetadata.termRank)}:${input.sectionId}`;
}

function normalizeKey(value: string | null | undefined): string {
	return (value ?? '').trim().toLowerCase();
}

function formatDepartmentLabel(value: string | null | undefined): string {
	const normalized = normalizeKey(value);
	const labels: Record<string, string> = {
		sci: 'SCIENCE',
		science: 'SCIENCE',
		tle: 'TLE',
		eng: 'ENGLISH',
		languages: 'LANGUAGES',
		ap: 'SOCIAL STUDIES',
		'esp': 'VALUES',
		values: 'VALUES',
		math: 'MATHEMATICS',
		mathematics: 'MATHEMATICS',
		fil: 'FILIPINO',
		mapeh: 'MAPEH',
		guidance: 'GUIDANCE',
	};

	return labels[normalized] ?? (value?.trim().toUpperCase() || 'GENERAL');
}

/**
 * A8-C5 S1.3 — exported so the hire estimate is directly testable against the
 * REAL function rather than a re-implementation of its arithmetic. The test that
 * pins it is `a8-c5-hire-estimate-policy.test.ts`.
 */
export function buildStaffingReport(
	unresolvedPairs: UnresolvedPair[],
	faculty: FacultyRow[],
	capacityUsed: Map<number, number>,
	coverageMode: CoverageMode = REAL_ONLY_STANDARD_MODE,
	nonTeachingMinutesByFaculty?: Map<number, number>,
	/**
	 * A8-C5 S1.3 — the SAVED workload policy for this school year, so the hire
	 * estimate divides missing hours by the standard the school actually set
	 * rather than by the `STANDARD_CAP_MIN` module constant. Same resolution the
	 * per-teacher capacity gate already uses (`resolveSharedRealFacultyCapMinutes`,
	 * line 787): `policy?.teachingStandardMinutes ?? STANDARD_CAP_MIN`. When the
	 * saved policy equals the default, the estimate is byte-identical to base.
	 */
	policy?: { teachingStandardMinutes?: number | null; hardCapMinutes?: number | null } | null,
): StaffingReport {
	const effectiveCoverageMode = resolveRealCoverageMode(coverageMode);
	const rawByDepartment = new Map<string, { count: number; missingMinutesPerWeek: number }>();
	const concurrentLanes = new Map<string, ConcurrentLaneDemand>();
	const shortageSections = new Map<string, StaffingShortageDetail['sections']>();

	for (const pair of unresolvedPairs) {
		const fallbackDepartment = pair.subject.ownerDepartment
			?? resolveSubjectOwnerDepartmentCode(pair.subject.code, pair.subject.name)
			?? pair.subject.modularGroupId
			?? 'GENERAL';
		const department = formatDepartmentLabel(fallbackDepartment);
		const subjectMinutes = Math.max(0, Number(pair.subject.minMinutesPerWeek) || 0);

		const rawBucket = rawByDepartment.get(department) ?? { count: 0, missingMinutesPerWeek: 0 };
		rawBucket.count += 1;
		rawBucket.missingMinutesPerWeek += subjectMinutes;
		rawByDepartment.set(department, rawBucket);

		const laneKey = buildCapacityLaneKey({
			subjectId: pair.subjectId,
			subjectCode: pair.subject.code,
			rotationFamily: pair.subject.rotationFamily,
			modularGroupId: pair.subject.modularGroupId,
			modularOrder: pair.subject.modularOrder,
			termGroupId: pair.subject.termGroupId,
			termCount: pair.subject.termCount,
			sectionId: pair.sectionId,
		});
		const allowedOwnerDepartments = resolveSubjectAllowedOwnerDepartments(
			pair.subject.ownerDepartment,
			pair.subject.code,
			pair.subject.name,
			pair.subject.requiredFeatures,
		);
		const existingLane = concurrentLanes.get(laneKey);
		if (!existingLane || subjectMinutes > existingLane.minutes) {
			concurrentLanes.set(laneKey, {
				department,
				minutes: subjectMinutes,
				allowedOwnerDepartments,
			});
		}

		const sections = shortageSections.get(department) ?? [];
		sections.push({
			subjectId: pair.subject.id,
			subjectCode: pair.subject.code,
			subjectName: pair.subject.name,
			sectionId: pair.sectionId,
			sectionName: pair.sectionName,
			programType: pair.sectionProgramType,
		});
		shortageSections.set(department, sections);
	}

	const concurrentByDepartment = new Map<string, { count: number; missingMinutesPerWeek: number }>();
	for (const lane of concurrentLanes.values()) {
		const bucket = concurrentByDepartment.get(lane.department) ?? { count: 0, missingMinutesPerWeek: 0 };
		bucket.count += 1;
		bucket.missingMinutesPerWeek += lane.minutes;
		concurrentByDepartment.set(lane.department, bucket);
	}

	const facultySpareMinutes = new Map<number, number>();
	const facultyDepartmentCode = new Map<number, string | null>();
	const facultyDepartmentLabel = new Map<number, string>();
	for (const member of faculty) {
		const nonTeachingMinutes = nonTeachingMinutesByFaculty?.get(member.id) ?? 0;
		const spareMinutes = Math.max(0, resolveRealFacultyCapMinutes(member, effectiveCoverageMode, nonTeachingMinutes) - (capacityUsed.get(member.id) ?? 0));
		facultySpareMinutes.set(member.id, spareMinutes);
		facultyDepartmentCode.set(member.id, normalizeDepartmentCode(member.department));
		facultyDepartmentLabel.set(member.id, formatDepartmentLabel(member.department));
	}

	const sortedConcurrentLanes = Array.from(concurrentLanes.values()).sort((left, right) => right.minutes - left.minutes);
	const recoverabilityByDepartment = new Map<string, {
		recoverableCount: number;
		recoverableMinutes: number;
		constrainedCount: number;
		constrainedMinutes: number;
	}>();
	const crossTraineeTeacherIdsByDepartment = new Map<string, Set<number>>();

	for (const lane of sortedConcurrentLanes) {
		const normalizedAllowedDepartments = new Set<string>(
			lane.allowedOwnerDepartments
				.map((department) => normalizeDepartmentCode(department))
				.filter((department): department is string => Boolean(department)),
		);

		let bestFacultyId: number | null = null;
		let bestSpareMinutes = 0;
		for (const member of faculty) {
			const spareMinutes = facultySpareMinutes.get(member.id) ?? 0;
			if (spareMinutes <= 0) continue;
			const memberDepartmentCode = facultyDepartmentCode.get(member.id);
			if (!memberDepartmentCode || !normalizedAllowedDepartments.has(memberDepartmentCode)) continue;
			if (spareMinutes > bestSpareMinutes) {
				bestSpareMinutes = spareMinutes;
				bestFacultyId = member.id;
			}
		}

		const recoverabilityBucket = recoverabilityByDepartment.get(lane.department) ?? {
			recoverableCount: 0,
			recoverableMinutes: 0,
			constrainedCount: 0,
			constrainedMinutes: 0,
		};

		if (bestFacultyId != null && bestSpareMinutes >= lane.minutes) {
			recoverabilityBucket.recoverableCount += 1;
			recoverabilityBucket.recoverableMinutes += lane.minutes;
			facultySpareMinutes.set(bestFacultyId, bestSpareMinutes - lane.minutes);

			const teacherDepartment = facultyDepartmentLabel.get(bestFacultyId) ?? 'GENERAL';
			if (teacherDepartment !== lane.department) {
				const teachers = crossTraineeTeacherIdsByDepartment.get(teacherDepartment) ?? new Set<number>();
				teachers.add(bestFacultyId);
				crossTraineeTeacherIdsByDepartment.set(teacherDepartment, teachers);
			}
		} else {
			recoverabilityBucket.constrainedCount += 1;
			recoverabilityBucket.constrainedMinutes += lane.minutes;
		}

		recoverabilityByDepartment.set(lane.department, recoverabilityBucket);
	}

	const allDepartments = new Set<string>([
		...rawByDepartment.keys(),
		...concurrentByDepartment.keys(),
	]);

	const shortageBuckets = Array.from(allDepartments)
		.map((department) => {
			const raw = rawByDepartment.get(department) ?? { count: 0, missingMinutesPerWeek: 0 };
			const concurrent = concurrentByDepartment.get(department) ?? { count: 0, missingMinutesPerWeek: 0 };
			const recoverability = recoverabilityByDepartment.get(department) ?? {
				recoverableCount: 0,
				recoverableMinutes: 0,
				constrainedCount: 0,
				constrainedMinutes: 0,
			};
			return {
				department,
				rawUnassignedSections: raw.count,
				rawMissingMinutesPerWeek: raw.missingMinutesPerWeek,
				concurrentUnassignedSections: concurrent.count,
				concurrentMissingMinutesPerWeek: concurrent.missingMinutesPerWeek,
				recoverableConcurrentCount: recoverability.recoverableCount,
				recoverableConcurrentMissingMinutesPerWeek: recoverability.recoverableMinutes,
				constrainedConcurrentCount: recoverability.constrainedCount,
				constrainedConcurrentMissingMinutesPerWeek: recoverability.constrainedMinutes,
				rotationAdjustedMinutesPerWeek: Math.max(0, raw.missingMinutesPerWeek - concurrent.missingMinutesPerWeek),
			};
		})
		.sort((left, right) => {
			if (right.concurrentMissingMinutesPerWeek !== left.concurrentMissingMinutesPerWeek) {
				return right.concurrentMissingMinutesPerWeek - left.concurrentMissingMinutesPerWeek;
			}
			if (right.rawMissingMinutesPerWeek !== left.rawMissingMinutesPerWeek) {
				return right.rawMissingMinutesPerWeek - left.rawMissingMinutesPerWeek;
			}
			return left.department.localeCompare(right.department);
		});

	const primaryShortage: StaffingShortageBucket = shortageBuckets[0] ?? {
		department: 'GENERAL',
		rawUnassignedSections: 0,
		rawMissingMinutesPerWeek: 0,
		concurrentUnassignedSections: 0,
		concurrentMissingMinutesPerWeek: 0,
		rotationAdjustedMinutesPerWeek: 0,
	};
	const totalRawUnassignedSections = shortageBuckets.reduce((sum, bucket) => sum + bucket.rawUnassignedSections, 0);
	const totalConcurrentUnassignedSections = shortageBuckets.reduce((sum, bucket) => sum + bucket.concurrentUnassignedSections, 0);

	const rawMissingMinutesPerWeek = shortageBuckets.reduce((sum, bucket) => sum + bucket.rawMissingMinutesPerWeek, 0);
	const concurrentMissingMinutesPerWeek = shortageBuckets.reduce((sum, bucket) => sum + bucket.concurrentMissingMinutesPerWeek, 0);
	const rawMissingHoursPerWeek = Math.round((rawMissingMinutesPerWeek / 60) * 10) / 10;
	const concurrentMissingHoursPerWeek = Math.round((concurrentMissingMinutesPerWeek / 60) * 10) / 10;
	const rotationAdjustedMinutesPerWeek = Math.max(0, rawMissingMinutesPerWeek - concurrentMissingMinutesPerWeek);
	const recoverableConcurrentRows = shortageBuckets.reduce((sum, bucket) => sum + bucket.recoverableConcurrentCount, 0);
	const recoverableConcurrentMissingMinutesPerWeek = shortageBuckets.reduce(
		(sum, bucket) => sum + bucket.recoverableConcurrentMissingMinutesPerWeek,
		0,
	);
	const constrainedConcurrentRows = shortageBuckets.reduce((sum, bucket) => sum + bucket.constrainedConcurrentCount, 0);
	const constrainedConcurrentMissingMinutesPerWeek = shortageBuckets.reduce(
		(sum, bucket) => sum + bucket.constrainedConcurrentMissingMinutesPerWeek,
		0,
	);
	const recoverableConcurrentMissingHoursPerWeek = Math.round((recoverableConcurrentMissingMinutesPerWeek / 60) * 10) / 10;
	const constrainedConcurrentMissingHoursPerWeek = Math.round((constrainedConcurrentMissingMinutesPerWeek / 60) * 10) / 10;
	// A8-C5 S1.3: the RESOLVED policy standard minutes, the same value the
	// per-teacher capacity gate uses. A school whose saved standard is not the
	// default gets an estimate from its own number; a school on the default
	// reproduces the base figure exactly.
	const resolvedStandardMinutes = Math.max(0, Math.round(policy?.teachingStandardMinutes ?? STANDARD_CAP_MIN));
	const recommendedNewHires = resolvedStandardMinutes > 0
		? Math.round((concurrentMissingHoursPerWeek / (resolvedStandardMinutes / 60)) * 10) / 10
		: 0;

	const initialSpareByFaculty = new Map<number, number>();
	for (const member of faculty) {
		initialSpareByFaculty.set(member.id, Math.max(0, resolveRealFacultyCapMinutes(member, effectiveCoverageMode) - (capacityUsed.get(member.id) ?? 0)));
	}

	const internalCrossTrainees = Array.from(crossTraineeTeacherIdsByDepartment.entries())
		.map(([department, teacherIds]) => {
			const teacherList = Array.from(teacherIds);
			const totalSpareMinutes = teacherList.reduce((sum, facultyId) => sum + (initialSpareByFaculty.get(facultyId) ?? 0), 0);
			const qualifiedRecoveryMinutes = teacherList.reduce((sum, facultyId) => {
				const initial = initialSpareByFaculty.get(facultyId) ?? 0;
				const remaining = facultySpareMinutes.get(facultyId) ?? 0;
				return sum + Math.max(0, initial - remaining);
			}, 0);
			return {
				department,
				availableTeachers: teacherList.length,
				totalSpareHours: Math.round((totalSpareMinutes / 60) * 10) / 10,
				qualifiedRecoveryHoursPerWeek: Math.round((qualifiedRecoveryMinutes / 60) * 10) / 10,
			};
		})
		.sort((left, right) => {
			if ((right.qualifiedRecoveryHoursPerWeek ?? 0) !== (left.qualifiedRecoveryHoursPerWeek ?? 0)) {
				return (right.qualifiedRecoveryHoursPerWeek ?? 0) - (left.qualifiedRecoveryHoursPerWeek ?? 0);
			}
			if (right.totalSpareHours !== left.totalSpareHours) {
				return right.totalSpareHours - left.totalSpareHours;
			}
			if (right.availableTeachers !== left.availableTeachers) {
				return right.availableTeachers - left.availableTeachers;
			}
			return left.department.localeCompare(right.department);
		});

	const shortages = shortageBuckets.map((bucket) => ({
		department: bucket.department,
		count: bucket.rawUnassignedSections,
		missingMinutesPerWeek: bucket.rawMissingMinutesPerWeek,
		concurrentCount: bucket.concurrentUnassignedSections,
		concurrentMissingMinutesPerWeek: bucket.concurrentMissingMinutesPerWeek,
		recoverableConcurrentCount: bucket.recoverableConcurrentCount,
		recoverableConcurrentMissingMinutesPerWeek: bucket.recoverableConcurrentMissingMinutesPerWeek,
		constrainedConcurrentCount: bucket.constrainedConcurrentCount,
		constrainedConcurrentMissingMinutesPerWeek: bucket.constrainedConcurrentMissingMinutesPerWeek,
		rotationAdjustedMinutesPerWeek: bucket.rotationAdjustedMinutesPerWeek,
		sections: (shortageSections.get(bucket.department) ?? []).slice(0, 50),
	}));

	return {
		department: primaryShortage.department,
		dominantShortageDepartment: primaryShortage.department,
		unassignedSections: totalRawUnassignedSections,
		missingHoursPerWeek: rawMissingHoursPerWeek,
		concurrentUnassignedSections: totalConcurrentUnassignedSections,
		concurrentMissingHoursPerWeek,
		recoverableConcurrentRows,
		recoverableConcurrentMissingHoursPerWeek,
		recoverableConcurrentMissingMinutesPerWeek,
		constrainedConcurrentRows,
		constrainedConcurrentMissingHoursPerWeek,
		constrainedConcurrentMissingMinutesPerWeek,
		recommendedNewHires,
		internalCrossTrainees,
		missingMinutesPerWeek: rawMissingMinutesPerWeek,
		concurrentMissingMinutesPerWeek,
		rotationAdjustedMinutesPerWeek,
		shortages,
	};
}


function normalizeSpecializationCode(val: string | null | undefined): string | null {
	if (!val) return null;
	return val.trim().toUpperCase().replace(/\s+/g, '_');
}

function isSpecialProgramSpecializationSubject(subjectCode: string | null | undefined): boolean {
	const code = (subjectCode ?? '').trim().toUpperCase();
	return code === 'SPA_SPEC' || code === 'SPS_SPEC' || code.startsWith('SPA_') || code.startsWith('SPS_');
}

function isSpecialProgramBaselineDepartment(department: string | null | undefined): boolean {
	const normalized = normalizeDepartmentCode(department);
	return normalized === 'MAPEH';
}

function isSpecialProgramGeneralistSpecialization(specialization: string | null | undefined): boolean {
	const normalized = normalizeSpecializationCode(specialization);
	return normalized === 'MAJOR_IN_MAPEH' || normalized === 'MAPEH';
}

export interface TeachingLoadQualificationFaculty {
	specialization: string | null;
	department: string | null;
	canTeachOutsideDepartment: boolean;
}

export interface TeachingLoadQualificationSubject {
	code: string;
	name: string;
	allowedSpecializations: string[] | null | undefined;
	ownerDepartment: string | null;
	requiredFeatures: string[] | null | undefined;
}

export type TeachingLoadQualificationAuthority =
	| 'HG'
	| 'SPECIALIZATION_ALIAS'
	| 'ALLOWED_SPECIALIZATION'
	| 'DEPARTMENT'
	| 'SPECIAL_PROGRAM_BASELINE'
	| 'CROSS_DEPARTMENT_PERMISSION'
	| 'OUTSIDE_DEPARTMENT_OVERRIDE';

/**
 * Canonical qualification resolver. Returns both the tier used for ranking and
 * the exact authority branch that granted eligibility. The distribution plan
 * binds the authority branch so an apply can detect a qualification/authority
 * change between preview and write.
 */
export function resolveTeachingLoadQualification(input: {
	faculty: TeachingLoadQualificationFaculty;
	subject: TeachingLoadQualificationSubject;
	aliasesByCanonical: Map<string, Set<string>>;
}): { tier: number | null; authority: TeachingLoadQualificationAuthority | null } {
	const { faculty, subject, aliasesByCanonical } = input;
	const code = subject.code.toUpperCase();
	if (code === 'HG' || subject.name.toLowerCase().includes('homeroom')) {
		return { tier: 1, authority: 'HG' };
	}

	// Tier 1: SpecializationAlias match
	if (faculty.specialization) {
		const normalizedSpecialization = faculty.specialization.trim().toLowerCase();
		const canonKey = subject.code.trim().toLowerCase();
		const aliasSet = aliasesByCanonical.get(canonKey);
		if (aliasSet && aliasSet.has(normalizedSpecialization)) {
			return { tier: 1, authority: 'SPECIALIZATION_ALIAS' };
		}
	}

	const allowed = (subject.allowedSpecializations ?? []).map((entry) => entry.trim().toLowerCase());
	const normalizedSpecialization = faculty.specialization?.trim().toLowerCase() ?? null;
	const normalizedDepartment = faculty.department?.trim().toLowerCase() ?? null;

	if (normalizedSpecialization && allowed.includes(normalizedSpecialization)) {
		return { tier: 2, authority: 'ALLOWED_SPECIALIZATION' };
	}
	if (normalizedDepartment && allowed.includes(normalizedDepartment)) {
		return { tier: 2, authority: 'ALLOWED_SPECIALIZATION' };
	}

	const isDepartmentOwner = matchesSubjectOwnershipDepartment(
		faculty.department,
		subject.code,
		subject.name,
		subject.ownerDepartment,
		subject.requiredFeatures ?? [],
	);
	if (isDepartmentOwner) {
		return { tier: 2, authority: 'DEPARTMENT' };
	}

	if (isSpecialProgramSpecializationSubject(subject.code)
		&& isSpecialProgramBaselineDepartment(faculty.department)
		&& isSpecialProgramGeneralistSpecialization(faculty.specialization)
	) {
		return { tier: 2, authority: 'SPECIAL_PROGRAM_BASELINE' };
	}

	if (faculty.canTeachOutsideDepartment) {
		return { tier: 3, authority: 'OUTSIDE_DEPARTMENT_OVERRIDE' };
	}

	return { tier: null, authority: null };
}

function canonicalQualificationAuthority(result: QualificationResult): TeachingLoadQualificationAuthority | null {
	if (!result.eligible || result.tier == null) return null;
	switch (result.reason) {
		case 'SPECIALIZATION_ALIAS_MATCH': return 'SPECIALIZATION_ALIAS';
		case 'SPECIALIZATION_AND_DEPARTMENT_MATCH': return 'ALLOWED_SPECIALIZATION';
		case 'DEPARTMENT_MATCH': return 'DEPARTMENT';
		case 'SPECIAL_PROGRAM_DEPARTMENT_MATCH': return 'SPECIAL_PROGRAM_BASELINE';
		case 'CROSS_LANGUAGE_EXCEPTION': return 'DEPARTMENT';
		case 'CROSS_DEPARTMENT_PERMISSION': return 'CROSS_DEPARTMENT_PERMISSION';
		case 'CAN_TEACH_OUTSIDE_DEPARTMENT': return 'OUTSIDE_DEPARTMENT_OVERRIDE';
		default: return null;
	}
}

function evaluateCanonicalTeachingLoadQualification(
	faculty: TeachingLoadQualificationFaculty & { id?: number },
	subject: TeachingLoadQualificationSubject & { id?: number; programScopes?: string[] },
	sectionProgramType: string,
	authority: PersistedQualificationAuthority,
): { tier: number | null; authority: TeachingLoadQualificationAuthority | null; reason: string } {
	// Owner departments are resolved through the SAME persisted policy snapshot
	// as reconciliation: the subject's persisted owner department, the persisted
	// subject-owner prefix table, and explicit OWNER_DEPT features. In
	// persisted-only mode this never falls back to legacy code prefixes or
	// subject-name glossaries.
	const allowedDepartments = resolvePersistedAllowedOwnerDepartments(
		subject.ownerDepartment,
		subject.code,
		subject.name,
		subject.requiredFeatures ?? [],
		authority.policy,
	);
	const result = evaluateQualificationWithPolicy({
		facultyId: faculty.id ?? 0,
		facultyDepartment: faculty.department,
		facultySpecialization: faculty.specialization,
		canTeachOutsideDepartment: faculty.canTeachOutsideDepartment,
		subjectId: subject.id ?? 0,
		subjectCode: subject.code,
		subjectName: subject.name,
		subjectOwnerDepartment: subject.ownerDepartment,
		subjectAllowedDepartments: allowedDepartments,
		subjectAllowedSpecializations: subject.allowedSpecializations ?? [],
		subjectProgramScopes: (subject.programScopes ?? []) as never,
		sectionProgramType: sectionProgramType as never,
		specializationAliases: authority.specializationAliases,
	}, authority.policy);
	return { tier: result.tier, authority: canonicalQualificationAuthority(result), reason: result.reason };
}

/**
 * Transaction-bound canonical receiver evaluation. The reviewed suggestion-apply
 * path must re-validate a move's receiver against the SAME persisted-only policy
 * snapshot used to preview it, resolved through the caller's transaction client
 * so the authority cannot change between the validation read and the write.
 */
export async function evaluateTeachingLoadReceiverQualification(
	client: unknown,
	schoolId: number,
	faculty: TeachingLoadQualificationFaculty & { id?: number },
	subject: TeachingLoadQualificationSubject & { id?: number; programScopes?: string[] },
	sectionProgramType: string,
): Promise<{ tier: number | null; authority: TeachingLoadQualificationAuthority | null; reason: string }> {
	const authority = await loadPersistedQualificationAuthority(schoolId, client);
	return evaluateCanonicalTeachingLoadQualification(faculty, subject, sectionProgramType, authority);
}

function compareSubjectsDeterministically(sa: SubjectRow, sb: SubjectRow): number {
	// 1. Constrained / Specialization-bound / Special Program first
	const aConstrained = (sa.allowedSpecializations?.length ?? 0) > 0 || isSpecialProgramSpecializationSubject(sa.code);
	const bConstrained = (sb.allowedSpecializations?.length ?? 0) > 0 || isSpecialProgramSpecializationSubject(sb.code);
	if (aConstrained !== bConstrained) {
		return aConstrained ? -1 : 1;
	}

	// 2. Non-modular vs Modular (non-modular first)
	const aModular = Boolean(sa.modularGroupId);
	const bModular = Boolean(sb.modularGroupId);
	if (aModular !== bModular) {
		return aModular ? 1 : -1;
	}

	if (sa.modularGroupId && sb.modularGroupId) {
		if (sa.modularGroupId !== sb.modularGroupId) {
			return sa.modularGroupId.localeCompare(sb.modularGroupId);
		}
		if ((sa.modularOrder ?? 0) !== (sb.modularOrder ?? 0)) {
			return (sa.modularOrder ?? 0) - (sb.modularOrder ?? 0);
		}
	}

	// 3. Final tie-breaker: alphabetical by code
	return sa.code.localeCompare(sb.code);
}

type ExistingOwnershipRow = {
	subjectId: number;
	sectionId: number;
	facultyId: number;
	facultySubject: {
		subject: {
			id: number;
			code: string;
			modularGroupId: string | null;
			modularOrder: number | null;
			termGroupId: string | null;
			termCount: number | null;
			rotationFamily: string | null;
			minMinutesPerWeek: number;
		};
	};
};

/**
 * A8 c4: the exact read shape `computeCanonicalConcurrentWeeklyMinutes` needs,
 * exported so a consumer reads precisely these fields and no more.
 */
export type CanonicalConcurrentOwnershipRow = ExistingOwnershipRow;

/** The subject semantics the canonical lane key needs. */
export type CanonicalConcurrentSubjectRow = ExistingOwnershipRow['facultySubject']['subject'];

/**
 * A8 c4 (`cover-candidates.hoursNow`): THE canonical concurrent weekly teaching
 * minutes for every teacher, produced by the SAME capacity ledger the auto-fill
 * gate uses — raw placed minutes with the rotation-family concurrent-peak rule
 * in `estimateCapacityLaneDeltaMinutes` (the 2026-09-02 PAOLO/FRANCIS 114h
 * incident: same-term rotation sections run CONCURRENTLY and must add up, not
 * collapse to a peak).
 *
 * This is an extraction, not a re-implementation. A consumer that copies the lane
 * arithmetic gets a second, silently divergent peak rule; that is a defect. The
 * arithmetic stays here.
 */
export function computeCanonicalConcurrentWeeklyMinutes(
	existingOwnerships: readonly CanonicalConcurrentOwnershipRow[],
): Map<number, number> {
	return buildInitialCapacityTracking(existingOwnerships as ExistingOwnershipRow[]).capacityUsed;
}

/**
 * A8 c4 (`cover-candidates.hoursAfter`): the canonical delta of adding one
 * (subject, section) pair to one teacher, computed through the same ledger so a
 * rotation-family section is billed its real concurrent minutes rather than the
 * family's peak. `afterMinutes === currentMinutes + deltaMinutes`.
 */
export function estimateCanonicalConcurrentWeeklyDeltaMinutes(input: {
	existingOwnerships: readonly CanonicalConcurrentOwnershipRow[];
	facultyId: number;
	subject: CanonicalConcurrentSubjectRow;
	sectionId: number;
}): { currentMinutes: number; deltaMinutes: number; afterMinutes: number } {
	const minutes = Math.max(0, Number(input.subject.minMinutesPerWeek) || 0);
	const { capacityLedgersByFaculty, capacityUsed } = buildInitialCapacityTracking(input.existingOwnerships as ExistingOwnershipRow[]);
	const currentMinutes = capacityUsed.get(input.facultyId) ?? 0;
	if (minutes <= 0) {
		return { currentMinutes, deltaMinutes: 0, afterMinutes: currentMinutes };
	}
	const ledger = capacityLedgersByFaculty.get(input.facultyId) ?? createEmptyCapacityLedger();
	const deltaMinutes = estimateCapacityLaneDeltaMinutes(
		ledger,
		buildCapacityLaneKey({
			subjectId: input.subject.id,
			subjectCode: input.subject.code,
			rotationFamily: input.subject.rotationFamily,
			modularGroupId: input.subject.modularGroupId,
			modularOrder: input.subject.modularOrder,
			termGroupId: input.subject.termGroupId,
			termCount: input.subject.termCount,
			sectionId: input.sectionId,
		}),
		minutes,
	);
	return { currentMinutes, deltaMinutes, afterMinutes: currentMinutes + deltaMinutes };
}

function buildInitialCapacityTracking(existingOwnerships: ExistingOwnershipRow[]): {
	capacityLedgersByFaculty: Map<number, CapacityLedger>;
	capacityUsed: Map<number, number>;
} {
	const capacityLanesByFaculty = new Map<number, Map<string, number>>();
	for (const ownership of existingOwnerships) {
		const subject = ownership.facultySubject.subject;
		const mins = Math.max(0, Number(subject.minMinutesPerWeek) || 0);
		if (mins <= 0) continue;
		const laneKey = buildCapacityLaneKey({
			subjectId: subject.id,
			subjectCode: subject.code,
			rotationFamily: subject.rotationFamily,
			modularGroupId: subject.modularGroupId,
			modularOrder: subject.modularOrder,
			termGroupId: subject.termGroupId,
			termCount: subject.termCount,
			sectionId: ownership.sectionId,
		});
		const lanes = capacityLanesByFaculty.get(ownership.facultyId) ?? new Map<string, number>();
		const currentLaneMinutes = lanes.get(laneKey) ?? 0;
		if (mins > currentLaneMinutes) {
			lanes.set(laneKey, mins);
		}
		capacityLanesByFaculty.set(ownership.facultyId, lanes);
	}

	const capacityLedgersByFaculty = new Map<number, CapacityLedger>();
	const capacityUsed = new Map<number, number>();
	for (const [facultyId, lanes] of capacityLanesByFaculty.entries()) {
		const ledger = createCapacityLedgerFromLanes(lanes);
		capacityLedgersByFaculty.set(facultyId, ledger);
		capacityUsed.set(facultyId, ledger.creditedMinutes);
	}

	return { capacityLedgersByFaculty, capacityUsed };
}

type CoverageCandidateRankSnapshot = {
	facultyId: number;
	tier: number;
	subjectAssignedCount: number;
	rotationLaneAssignedCount?: number;
	rotationFamilyAssignedCount?: number;
	projectedRotationFamilyPeakMinutes?: number;
	projectedUsedMinutes: number;
	/**
	 * FACULTY-GRADE-PREFERENCE-C01 (D10) soft signals. Both default to neutral
	 * when absent, so a snapshot with no preference reproduces the base ordering
	 * exactly.
	 */
	advisoryMatch?: boolean;
	preferredGradeMatch?: boolean;
	/**
	 * SHIFT-COHERENCE-C01 (D11) soft signal. `false` marks a candidate whose
	 * acceptance would make the teacher span both shift windows. Neutral when
	 * absent, so a snapshot with the guard off reproduces the base ordering
	 * exactly.
	 */
	shiftCoherent?: boolean;
};

function compareCoverageCandidateRank(
	left: CoverageCandidateRankSnapshot,
	right: CoverageCandidateRankSnapshot,
): number {
	if (left.tier !== right.tier) return left.tier - right.tier;
	// Advisory override (D10): a section's adviser is always preferred for their
	// own advisory section, regardless of their grade preference.
	const leftAdvisory = left.advisoryMatch === true;
	const rightAdvisory = right.advisoryMatch === true;
	if (leftAdvisory !== rightAdvisory) return leftAdvisory ? -1 : 1;
	// Soft preference tier (D10): prefer a candidate whose persisted preference
	// includes the section's numeric grade. This only reorders otherwise
	// qualified candidates; it never filters and never reduces coverage.
	const leftPreferred = left.preferredGradeMatch === true;
	const rightPreferred = right.preferredGradeMatch === true;
	if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1;
	// Shift-coherence soft tier (D11): when the guard is enabled, prefer a
	// candidate whose acceptance does not span both shift windows. Neutral when
	// both snapshots are undefined, so S7/D10 ordering is byte-identical when the
	// guard is off. This only reorders; HARD filtering happens before ranking.
	if (left.shiftCoherent !== right.shiftCoherent) {
		return (left.shiftCoherent ?? true) ? -1 : 1;
	}
	if (left.subjectAssignedCount !== right.subjectAssignedCount) {
		return left.subjectAssignedCount - right.subjectAssignedCount;
	}
	const leftFamilyAssignedCount = left.rotationFamilyAssignedCount ?? 0;
	const rightFamilyAssignedCount = right.rotationFamilyAssignedCount ?? 0;
	if (leftFamilyAssignedCount !== rightFamilyAssignedCount) {
		return leftFamilyAssignedCount - rightFamilyAssignedCount;
	}
	const leftProjectedFamilyPeak = left.projectedRotationFamilyPeakMinutes ?? 0;
	const rightProjectedFamilyPeak = right.projectedRotationFamilyPeakMinutes ?? 0;
	if (leftProjectedFamilyPeak !== rightProjectedFamilyPeak) {
		return leftProjectedFamilyPeak - rightProjectedFamilyPeak;
	}
	const leftLaneAssignedCount = left.rotationLaneAssignedCount ?? 0;
	const rightLaneAssignedCount = right.rotationLaneAssignedCount ?? 0;
	if (leftLaneAssignedCount !== rightLaneAssignedCount) {
		return leftLaneAssignedCount - rightLaneAssignedCount;
	}
	if (left.projectedUsedMinutes !== right.projectedUsedMinutes) {
		return left.projectedUsedMinutes - right.projectedUsedMinutes;
	}
	return left.facultyId - right.facultyId;
}

export function __testRankCoverageCandidates(candidates: CoverageCandidateRankSnapshot[]): number[] {
	return [...candidates]
		.sort((left, right) => compareCoverageCandidateRank(left, right))
		.map((entry) => entry.facultyId);
}

/**
 * FACULTY-GRADE-PREFERENCE-C01 (D10). Pure decision used by the ranking loop.
 * It NEVER returns a "blocked" result: `outsidePreferredGrade` only decides
 * whether a SOFT `OUTSIDE_PREFERRED_GRADE` advisory is emitted for a CHOSEN
 * assignment. The advisory override makes a section adviser's own advisory
 * section always count as a match, regardless of their preference.
 */
export interface GradePreferenceEvaluation {
	advisoryMatch: boolean;
	hasPreference: boolean;
	preferredGradeMatch: boolean;
	outsidePreferredGrade: boolean;
}

export function evaluateGradePreferenceMatch(input: {
	isClassAdviser: boolean | null | undefined;
	advisedSectionId: number | null | undefined;
	sectionId: number;
	sectionGradeLevel: number | null | undefined;
	preferredGradeLevels: readonly number[] | undefined;
}): GradePreferenceEvaluation {
	const advisoryMatch =
		input.isClassAdviser === true
		&& input.advisedSectionId != null
		&& input.advisedSectionId === input.sectionId;
	const hasPreference = Array.isArray(input.preferredGradeLevels) && input.preferredGradeLevels.length > 0;
	const preferredGradeMatch =
		hasPreference
		&& Number.isInteger(input.sectionGradeLevel)
		&& (input.preferredGradeLevels as number[]).includes(input.sectionGradeLevel as number);
	return {
		advisoryMatch,
		hasPreference,
		preferredGradeMatch,
		outsidePreferredGrade: hasPreference && !preferredGradeMatch && !advisoryMatch,
	};
}

// ─── SHIFT-COHERENCE-C01 (D11) pure helpers ─────────────────────────────────

function shiftWindowMinutes(value: string): number {
	const [hours, minutes] = value.split(':').map(Number);
	return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function shiftWindowKey(window: ShiftCoherenceWindow): string {
	return `${window.startTime}|${window.endTime}`;
}

/**
 * Resolve a section's shift window from the `grade_shift_windows` authority.
 *
 * The numeric grade is the section `displayOrder`. The exact
 * `(gradeLevel, programType)` row wins; otherwise the `(gradeLevel, null)` row is
 * used. When neither exists the section has NO shift authority and returns null
 * — a window is never fabricated.
 */
export function resolveSectionShiftWindow(input: {
	gradeLevel: number | null | undefined;
	programType: string | null | undefined;
	windows: ReadonlyArray<ShiftCoherenceWindow>;
}): ShiftCoherenceWindow | null {
	if (!Number.isInteger(input.gradeLevel)) return null;
	const grade = input.gradeLevel as number;
	const programType = input.programType ?? null;
	if (programType != null) {
		const exact = input.windows.find((window) => window.gradeLevel === grade && window.programType === programType);
		if (exact) return { ...exact };
	}
	const fallback = input.windows.find((window) => window.gradeLevel === grade && (window.programType ?? null) === null);
	return fallback ? { ...fallback } : null;
}

export interface ShiftCoherenceSpanEvaluation {
	/** True when the union extent `[min start, max end]` is not itself a window. */
	spans: boolean;
	/** Distinct resolved windows in `W` (deduped by start/end). */
	windows: ShiftCoherenceWindow[];
	minStartMinutes: number | null;
	maxEndMinutes: number | null;
}

/**
 * The deterministic span rule. For a teacher, let `W` be the distinct resolved
 * windows across their sections (already assigned plus the candidate under
 * consideration). The teacher spans iff `W.length >= 2` AND no single window in
 * `W` has both the minimum start and the maximum end of `W`.
 *
 * This flags `06:00-15:30` + `09:45-18:30` (union `06:00-18:30`) and does NOT
 * flag G7 + G8 (identical windows).
 */
export function evaluateShiftCoherenceSpan(
	windows: ReadonlyArray<ShiftCoherenceWindow>,
): ShiftCoherenceSpanEvaluation {
	const byKey = new Map<string, ShiftCoherenceWindow>();
	for (const window of windows) {
		const key = shiftWindowKey(window);
		if (!byKey.has(key)) byKey.set(key, window);
	}
	const distinct = [...byKey.values()];
	if (distinct.length === 0) {
		return { spans: false, windows: distinct, minStartMinutes: null, maxEndMinutes: null };
	}
	let minStartMinutes = Number.POSITIVE_INFINITY;
	let maxEndMinutes = Number.NEGATIVE_INFINITY;
	for (const window of distinct) {
		const start = shiftWindowMinutes(window.startTime);
		const end = shiftWindowMinutes(window.endTime);
		if (start < minStartMinutes) minStartMinutes = start;
		if (end > maxEndMinutes) maxEndMinutes = end;
	}
	if (distinct.length < 2) {
		return { spans: false, windows: distinct, minStartMinutes, maxEndMinutes };
	}
	const coveredByOneWindow = distinct.some(
		(window) => shiftWindowMinutes(window.startTime) === minStartMinutes
			&& shiftWindowMinutes(window.endTime) === maxEndMinutes,
	);
	return { spans: !coveredByOneWindow, windows: distinct, minStartMinutes, maxEndMinutes };
}

/** One section a teacher is assigned to, with its resolved shift window. */
interface FacultyShiftSection {
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	window: ShiftCoherenceWindow;
}

/** Per-candidate selection context for the shift-coherence guard. */
interface ShiftCoherenceSelectionContext {
	enabled: boolean;
	enforce: boolean;
	/** Window resolved for the candidate section (null = no shift authority). */
	sectionWindow: ShiftCoherenceWindow | null;
	/** Current sections/windows already held by each faculty. */
	assignmentsByFacultyId: ReadonlyMap<number, FacultyShiftSection[]>;
}

function cloneShiftAssignments(
	source: ReadonlyMap<number, FacultyShiftSection[]> | undefined,
): Map<number, FacultyShiftSection[]> {
	const cloned = new Map<number, FacultyShiftSection[]>();
	for (const [facultyId, rows] of (source ?? new Map()).entries()) {
		cloned.set(facultyId, [...rows]);
	}
	return cloned;
}

function dedupeShiftSections(entries: ReadonlyArray<FacultyShiftSection>): ShiftCoherenceSection[] {
	const seen = new Set<number>();
	const sections: ShiftCoherenceSection[] = [];
	for (const entry of entries) {
		if (seen.has(entry.sectionId)) continue;
		seen.add(entry.sectionId);
		sections.push({ id: entry.sectionId, name: entry.sectionName, gradeLevel: entry.gradeLevel });
	}
	return sections;
}

function describeShiftWindow(window: ShiftCoherenceWindow): string {
	const program = window.programType ? ` ${window.programType}` : '';
	return `G${window.gradeLevel}${program} ${window.startTime}-${window.endTime}`;
}

function buildShiftCoherenceWarningLine(notice: TeachingLoadShiftCoherenceNotice): string {
	const windows = notice.spanningWindows.map(describeShiftWindow).join(' + ');
	const sections = notice.sections.map((section) => `${section.name} (G${section.gradeLevel})`).join(', ');
	return `Shift coherence (SOFT): ${notice.facultyName} would span ${windows} across ${sections}. Manual assignment can override this.`;
}

function appendShiftCoherenceWarnings(
	warnings: string[],
	notices: ReadonlyArray<TeachingLoadShiftCoherenceNotice>,
	rejections: ReadonlyArray<TeachingLoadCandidateRejection>,
): void {
	for (const notice of notices.slice(0, MAX_CANDIDATE_REJECTIONS)) {
		warnings.push(buildShiftCoherenceWarningLine(notice));
	}
	const rejected = rejections.filter((row) => row.reason === 'SHIFT_COHERENCE_CONFLICT');
	if (rejected.length > 0) {
		const names = [...new Set(rejected.map((row) => row.facultyName))].slice(0, 5).join(', ');
		warnings.push(
			`Shift coherence (HARD): auto-fill rejected ${rejected.length} candidate assignment${rejected.length === 1 ? '' : 's'} that would span both shift windows (${names}). Rows with no coherent candidate are left unresolved; manual assignment can override this.`,
		);
	}
}

function findBestCandidateForMode(
	subjectRow: SubjectRow,
	sectionId: number,
	sectionName: string,
	sectionProgramType: string,
	faculty: FacultyRow[],
	coverageMode: CoverageMode,
	capacityLedgersByFaculty: Map<number, CapacityLedger>,
	capacityUsed: Map<number, number>,
	qualificationAuthority: PersistedQualificationAuthority,
	subjectAssignmentCountByFacultyId?: Map<number, number>,
	rotationLaneAssignmentCountByFacultyId?: Map<number, number>,
	rotationFamilyAssignmentCountByFacultyId?: Map<number, number>,
	nonTeachingMinutesByFaculty?: Map<number, number>,
	sectionGradeLevel?: number,
	preferredGradeLevelsByFacultyId?: ReadonlyMap<number, number[]>,
	shiftCoherence?: ShiftCoherenceSelectionContext,
	/**
	 * A8 c4 item 3: when `allowUnqualified` is true, a real teacher with NO
	 * qualification match for this subject becomes a candidate at
	 * `ANYONE_REAL_FACULTY_TIER` — ranked after every QUALIFIED and
	 * OTHER_DEPARTMENT candidate — so the coverage fallback can stop at "any real
	 * teacher" instead of dropping straight to a to-be-hired placeholder.
	 *
	 * It is OFF unless the caller asks. `autoFill` asks only when
	 * `allowUnqualifiedRealFaculty: true`, and it defaults to `false` (QA F2),
	 * so a `REAL_TEACHER` row on the default path is qualification-valid.
	 */
	candidateReach?: { allowUnqualified?: boolean },
): {
	faculty: FacultyRow | null;
	rankedFaculty: FacultyRow[];
	rejections: TeachingLoadCandidateRejection[];
	preferenceNotice: TeachingLoadPreferenceNotice | null;
	shiftCoherenceNotice: TeachingLoadShiftCoherenceNotice | null;
} {
	const candidates: Array<{
		faculty: FacultyRow;
		tier: number;
		projectedUsedMinutes: number;
		subjectAssignedCount: number;
		rotationLaneAssignedCount: number;
		rotationFamilyAssignedCount: number;
		projectedRotationFamilyPeakMinutes: number;
		advisoryMatch: boolean;
		preferredGradeMatch: boolean;
		outsidePreferredGrade: boolean;
		shiftSpans: boolean;
		spanningWindows: ShiftCoherenceWindow[];
		spanningSections: ShiftCoherenceSection[];
	}> = [];
	const rejections: TeachingLoadCandidateRejection[] = [];
	const guardEnabled = shiftCoherence?.enabled === true;
	const guardEnforce = guardEnabled && shiftCoherence?.enforce === true;
	const allowUnqualifiedCandidates = candidateReach?.allowUnqualified === true;
	const realCoverageMode = resolveRealCoverageMode(coverageMode);
	const subjectMinutes = Math.max(0, Number(subjectRow.minMinutesPerWeek) || 0);
	const laneKey = buildCapacityLaneKey({
		subjectId: subjectRow.id,
		subjectCode: subjectRow.code,
		rotationFamily: subjectRow.rotationFamily,
		modularGroupId: subjectRow.modularGroupId,
		modularOrder: subjectRow.modularOrder,
		termGroupId: subjectRow.termGroupId,
		termCount: subjectRow.termCount,
		sectionId,
	});

	for (const member of faculty) {
		const qualification = evaluateCanonicalTeachingLoadQualification(
			member,
			subjectRow,
			sectionProgramType,
			qualificationAuthority,
		);
		// A8 c4: `PROGRAM_SCOPE_INCOMPATIBLE` is a STRUCTURAL rejection and stays
		// one at every tier — a teacher whose program scope excludes this section can
		// never cover it, so it is never reachable as an `ANYONE` candidate. Only
		// the plain "no qualification match" case may become an `ANYONE` candidate,
		// and only when the caller opted in.
		const isProgramScopeIncompatible = qualification.reason === 'PROGRAM_SCOPE_INCOMPATIBLE';
		const reachableAsAnyone = allowUnqualifiedCandidates && !isProgramScopeIncompatible;
		if ((qualification.tier == null || qualification.authority == null) && !reachableAsAnyone) {
			rejections.push({
				subjectId: subjectRow.id,
				subjectCode: subjectRow.code,
				sectionId,
				sectionName,
				facultyId: member.id,
				facultyName: `${member.lastName}, ${member.firstName}`,
				reason: isProgramScopeIncompatible ? 'PROGRAM_SCOPE_INCOMPATIBLE' : 'NOT_QUALIFIED',
			});
			continue;
		}
		// `reachableAsAnyone` above is the ONLY way an unqualified teacher reaches
		// this list, and the caller sets it explicitly. Ranking it last (tier 4)
		// keeps every qualified candidate ahead of it without changing any
		// qualified candidate's own tier.
		const rankTier = qualification.tier ?? ANYONE_REAL_FACULTY_TIER;
		const ledger = capacityLedgersByFaculty.get(member.id) ?? createEmptyCapacityLedger();
		const used = capacityUsed.get(member.id) ?? 0;
		const deltaMinutes = estimateCapacityLaneDeltaMinutes(ledger, laneKey, subjectMinutes);
		const nonTeachingMinutes = nonTeachingMinutesByFaculty?.get(member.id) ?? 0;
		const limit = resolveRealFacultyCapMinutes(member, realCoverageMode, nonTeachingMinutes);
		if (used + deltaMinutes > limit) {
			rejections.push({
				subjectId: subjectRow.id,
				subjectCode: subjectRow.code,
				sectionId,
				sectionName,
				facultyId: member.id,
				facultyName: `${member.lastName}, ${member.firstName}`,
				reason: 'HARD_CAP_EXCEEDED',
			});
			continue;
		}

		// FACULTY-GRADE-PREFERENCE-C01 (D10). Advisory override first: a section's
		// adviser is always assignable to, and preferred for, their own advisory
		// section. The preference is a soft signal only — it never rejects a
		// candidate. An unset/empty preference changes nothing.
		const preferenceEvaluation = evaluateGradePreferenceMatch({
			isClassAdviser: member.isClassAdviser,
			advisedSectionId: member.advisedSectionId,
			sectionId,
			sectionGradeLevel,
			preferredGradeLevels: preferredGradeLevelsByFacultyId?.get(member.id),
		});
		const advisoryMatch = preferenceEvaluation.advisoryMatch;
		const preferredGradeMatch = preferenceEvaluation.preferredGradeMatch;
		const outsidePreferredGrade = preferenceEvaluation.outsidePreferredGrade;

		// SHIFT-COHERENCE-C01 (D11). The guard gates autoFill candidate
		// selection ONLY — it never blocks generation and manual assignment is
		// never gated. `W` is the distinct resolved windows across the teacher's
		// already-held sections plus this candidate section. A null candidate
		// window (no shift authority) adds nothing and can never create a span.
		const existingShiftSections = guardEnabled
			? (shiftCoherence?.assignmentsByFacultyId.get(member.id) ?? [])
			: [];
		const candidateWindow = guardEnabled ? shiftCoherence?.sectionWindow ?? null : null;
		const candidateShiftSections: FacultyShiftSection[] = candidateWindow
			? [...existingShiftSections, {
				sectionId,
				sectionName,
				gradeLevel: Number.isInteger(sectionGradeLevel) ? (sectionGradeLevel as number) : 0,
				window: candidateWindow,
			}]
			: [...existingShiftSections];
		const spanEvaluation = guardEnabled
			? evaluateShiftCoherenceSpan(candidateShiftSections.map((entry) => entry.window))
			: { spans: false, windows: [] as ShiftCoherenceWindow[], minStartMinutes: null, maxEndMinutes: null };
		const shiftSpans = spanEvaluation.spans;
		const spanningWindows = spanEvaluation.windows;
		const spanningSections = dedupeShiftSections(candidateShiftSections);

		// HARD only: a spanning candidate is rejected with the typed reason. SOFT
		// never rejects — it emits an advisory for the chosen assignment instead.
		if (guardEnforce && shiftSpans) {
			rejections.push({
				subjectId: subjectRow.id,
				subjectCode: subjectRow.code,
				sectionId,
				sectionName,
				facultyId: member.id,
				facultyName: `${member.lastName}, ${member.firstName}`,
				reason: 'SHIFT_COHERENCE_CONFLICT',
				spanningWindows,
				sections: spanningSections,
			});
		}

		candidates.push({
				faculty: member,
				tier: rankTier,
				projectedUsedMinutes: used + deltaMinutes,
				subjectAssignedCount: subjectAssignmentCountByFacultyId?.get(member.id) ?? 0,
				rotationLaneAssignedCount: rotationLaneAssignmentCountByFacultyId?.get(member.id) ?? 0,
				rotationFamilyAssignedCount: rotationFamilyAssignmentCountByFacultyId?.get(member.id) ?? 0,
				projectedRotationFamilyPeakMinutes: estimateProjectedRotationFamilyPeakMinutes(ledger, laneKey, subjectMinutes),
				advisoryMatch,
				preferredGradeMatch,
				outsidePreferredGrade,
				shiftSpans,
				spanningWindows,
				spanningSections,
			});
	}

	if (candidates.length === 0) {
		return { faculty: null, rankedFaculty: [], rejections, preferenceNotice: null, shiftCoherenceNotice: null };
	}

	// HARD removes every spanning candidate from selection. When none remain the
	// row goes unresolved (the caller reports it) — never a thrown/blocking error.
	const selectable = guardEnforce
		? candidates.filter((candidate) => !candidate.shiftSpans)
		: candidates;
	if (selectable.length === 0) {
		return { faculty: null, rankedFaculty: [], rejections, preferenceNotice: null, shiftCoherenceNotice: null };
	}

	selectable.sort((a, b) => compareCoverageCandidateRank({
		facultyId: a.faculty.id,
		tier: a.tier,
		subjectAssignedCount: a.subjectAssignedCount,
		rotationLaneAssignedCount: a.rotationLaneAssignedCount,
		rotationFamilyAssignedCount: a.rotationFamilyAssignedCount,
		projectedRotationFamilyPeakMinutes: a.projectedRotationFamilyPeakMinutes,
		projectedUsedMinutes: a.projectedUsedMinutes,
		advisoryMatch: a.advisoryMatch,
		preferredGradeMatch: a.preferredGradeMatch,
		shiftCoherent: guardEnabled ? !a.shiftSpans : undefined,
	}, {
		facultyId: b.faculty.id,
		tier: b.tier,
		subjectAssignedCount: b.subjectAssignedCount,
		rotationLaneAssignedCount: b.rotationLaneAssignedCount,
		rotationFamilyAssignedCount: b.rotationFamilyAssignedCount,
		projectedRotationFamilyPeakMinutes: b.projectedRotationFamilyPeakMinutes,
		projectedUsedMinutes: b.projectedUsedMinutes,
		advisoryMatch: b.advisoryMatch,
		preferredGradeMatch: b.preferredGradeMatch,
		shiftCoherent: guardEnabled ? !b.shiftSpans : undefined,
	}));

	const selected = selectable[0];
	const preferenceNotice: TeachingLoadPreferenceNotice | null =
		selected.outsidePreferredGrade && Number.isInteger(sectionGradeLevel)
			? {
				subjectId: subjectRow.id,
				subjectCode: subjectRow.code,
				sectionId,
				sectionName,
				facultyId: selected.faculty.id,
				facultyName: `${selected.faculty.lastName}, ${selected.faculty.firstName}`,
				gradeLevel: sectionGradeLevel as number,
				preferredGradeLevels: [...(preferredGradeLevelsByFacultyId?.get(selected.faculty.id) ?? [])].sort((a, b) => a - b),
				reason: 'OUTSIDE_PREFERRED_GRADE',
			}
			: null;

	// SOFT: name who spans and why for the chosen assignment.
	const shiftCoherenceNotice: TeachingLoadShiftCoherenceNotice | null =
		guardEnabled && !guardEnforce && selected.shiftSpans
			? {
				subjectId: subjectRow.id,
				subjectCode: subjectRow.code,
				sectionId,
				sectionName,
				facultyId: selected.faculty.id,
				facultyName: `${selected.faculty.lastName}, ${selected.faculty.firstName}`,
				reason: 'SHIFT_COHERENCE_CONFLICT',
				spanningWindows: selected.spanningWindows,
				sections: selected.spanningSections,
			}
			: null;

	return {
		faculty: selected.faculty,
		rankedFaculty: selectable.map((candidate) => candidate.faculty),
		rejections,
		preferenceNotice,
		shiftCoherenceNotice,
	};
}

function simulateRealFacultyCoverage(input: {
	coverageMode: CoverageMode;
	realFaculty: FacultyRow[];
	candidatePairs: UnresolvedPair[];
	baseCapacityLedgersByFaculty: Map<number, CapacityLedger>;
	qualificationAuthority: PersistedQualificationAuthority;
	nonTeachingMinutesByFaculty?: Map<number, number>;
	sectionGradeLevelBySectionId?: ReadonlyMap<number, number>;
	preferredGradeLevelsByFacultyId?: ReadonlyMap<number, number[]>;
	/** A8-C5 S1.3: the saved workload policy, forwarded to the staffing report. */
	policy?: { teachingStandardMinutes?: number | null; hardCapMinutes?: number | null } | null;
	/** SHIFT-COHERENCE-C01 (D11): policy switches, per-section windows, seeded assignments. */
	shiftCoherence?: {
		enabled: boolean;
		enforce: boolean;
		sectionWindowBySectionId: ReadonlyMap<number, ShiftCoherenceWindow | null>;
		assignmentsByFacultyId: ReadonlyMap<number, FacultyShiftSection[]>;
	};
}): CoverageSimulationResult {
	const capacityLedgersByFaculty = cloneCapacityLedgers(input.baseCapacityLedgersByFaculty);
	const capacityUsed = new Map<number, number>();
	for (const [facultyId, ledger] of capacityLedgersByFaculty.entries()) {
		capacityUsed.set(facultyId, ledger.creditedMinutes);
	}
	const shiftAssignmentsByFacultyId = cloneShiftAssignments(input.shiftCoherence?.assignmentsByFacultyId);

	const bySubjectId = new Map<number, UnresolvedPair[]>();
	for (const pair of input.candidatePairs) {
		const bucket = bySubjectId.get(pair.subjectId) ?? [];
		bucket.push(pair);
		bySubjectId.set(pair.subjectId, bucket);
	}

	const subjectMap = new Map<number, SubjectRow>(input.candidatePairs.map((pair) => [pair.subjectId, pair.subject]));
	const orderedSubjectIds = Array.from(bySubjectId.keys()).sort((a, b) => {
		const sa = subjectMap.get(a);
		const sb = subjectMap.get(b);
		if (!sa || !sb) return a - b;
		return compareSubjectsDeterministically(sa, sb);
	});

	const unresolvedPairs: UnresolvedPair[] = [];
	const candidateRejections: TeachingLoadCandidateRejection[] = [];
	const preferenceNotices: TeachingLoadPreferenceNotice[] = [];
	const shiftCoherenceNotices: TeachingLoadShiftCoherenceNotice[] = [];
	let rowsClosedByRealFaculty = 0;
	const rotationFamilyAssignmentCountsByFamily = new Map<string, Map<number, number>>();

	const applyCapacityLane = (facultyId: number, subject: SubjectRow, sectionId: number) => {
		const minutes = Math.max(0, Number(subject.minMinutesPerWeek) || 0);
		if (minutes <= 0) return;
		const laneKey = buildCapacityLaneKey({
			subjectId: subject.id,
			subjectCode: subject.code,
			rotationFamily: subject.rotationFamily,
			modularGroupId: subject.modularGroupId,
			modularOrder: subject.modularOrder,
			termGroupId: subject.termGroupId,
			termCount: subject.termCount,
			sectionId,
		});
		const ledger = capacityLedgersByFaculty.get(facultyId) ?? createEmptyCapacityLedger();
		applyCapacityLaneMinutesToLedger(ledger, laneKey, minutes);
		capacityLedgersByFaculty.set(facultyId, ledger);
		capacityUsed.set(facultyId, ledger.creditedMinutes);
	};

	for (const subjectId of orderedSubjectIds) {
		const pairs = bySubjectId.get(subjectId) ?? [];
		const subjectRow = subjectMap.get(subjectId);
		if (!subjectRow) continue;

		const subjectAssignmentCountByFacultyId = new Map<number, number>();
		const rotationLaneAssignmentCountByFacultyId = new Map<number, number>();
		const rotationFamily = resolveCapacityRotationFamily(
			subjectRow.code,
			subjectRow.rotationFamily,
			subjectRow.modularGroupId,
		);
		const rotationTermMetadata = resolveRotationTermMetadata({
			subjectCode: subjectRow.code,
			rotationFamily,
			modularGroupId: subjectRow.modularGroupId,
			modularOrder: subjectRow.modularOrder,
			termGroupId: subjectRow.termGroupId,
			termCount: subjectRow.termCount,
		});
		const rotationLaneDistributionKey = rotationFamily
			? `${rotationFamily}:term:${normalizeRotationTermLaneKey(rotationTermMetadata.termRank)}`
			: null;
		const rotationFamilyAssignmentCountByFacultyId = rotationFamily
			? (rotationFamilyAssignmentCountsByFamily.get(rotationFamily) ?? new Map<number, number>())
			: undefined;

		for (const pair of pairs) {
			const candidateShiftWindow = input.shiftCoherence?.enabled === true
				? (input.shiftCoherence.sectionWindowBySectionId.get(pair.sectionId) ?? null)
				: null;
			const selection = findBestCandidateForMode(
				subjectRow,
				pair.sectionId,
				pair.sectionName,
				pair.sectionProgramType,
				input.realFaculty,
				input.coverageMode,
				capacityLedgersByFaculty,
				capacityUsed,
				input.qualificationAuthority,
				subjectAssignmentCountByFacultyId,
				rotationLaneAssignmentCountByFacultyId,
				rotationFamilyAssignmentCountByFacultyId,
				input.nonTeachingMinutesByFaculty,
				input.sectionGradeLevelBySectionId?.get(pair.sectionId) ?? 0,
				input.preferredGradeLevelsByFacultyId,
				input.shiftCoherence
					? {
						enabled: input.shiftCoherence.enabled,
						enforce: input.shiftCoherence.enforce,
						sectionWindow: candidateShiftWindow,
						assignmentsByFacultyId: shiftAssignmentsByFacultyId,
					}
					: undefined,
			);
			appendBoundedCandidateRejections(candidateRejections, selection.rejections);
			if (selection.preferenceNotice && preferenceNotices.length < MAX_CANDIDATE_REJECTIONS) {
				preferenceNotices.push(selection.preferenceNotice);
			}
			if (selection.shiftCoherenceNotice && shiftCoherenceNotices.length < MAX_CANDIDATE_REJECTIONS) {
				shiftCoherenceNotices.push(selection.shiftCoherenceNotice);
			}
			const candidate = selection.faculty;
			if (!candidate) {
				unresolvedPairs.push(pair);
				continue;
			}

			rowsClosedByRealFaculty += 1;
			applyCapacityLane(candidate.id, subjectRow, pair.sectionId);
			if (candidateShiftWindow) {
				const list = shiftAssignmentsByFacultyId.get(candidate.id) ?? [];
				list.push({
					sectionId: pair.sectionId,
					sectionName: pair.sectionName,
					gradeLevel: input.sectionGradeLevelBySectionId?.get(pair.sectionId) ?? 0,
					window: candidateShiftWindow,
				});
				shiftAssignmentsByFacultyId.set(candidate.id, list);
			}
			subjectAssignmentCountByFacultyId.set(candidate.id, (subjectAssignmentCountByFacultyId.get(candidate.id) ?? 0) + 1);
			if (rotationLaneDistributionKey) {
				rotationLaneAssignmentCountByFacultyId.set(
					candidate.id,
					(rotationLaneAssignmentCountByFacultyId.get(candidate.id) ?? 0) + 1,
				);
			}
			if (rotationFamily && rotationFamilyAssignmentCountByFacultyId) {
				rotationFamilyAssignmentCountByFacultyId.set(
					candidate.id,
					(rotationFamilyAssignmentCountByFacultyId.get(candidate.id) ?? 0) + 1,
				);
				rotationFamilyAssignmentCountsByFamily.set(rotationFamily, rotationFamilyAssignmentCountByFacultyId);
			}
		}
	}

	return {
		rowsClosedByRealFaculty,
		unresolvedPairs,
		capacityUsed,
		staffingReport: buildStaffingReport(unresolvedPairs, input.realFaculty, capacityUsed, input.coverageMode, input.nonTeachingMinutesByFaculty, input.policy),
		candidateRejections,
		preferenceNotices,
		shiftCoherenceNotices,
	};
}

function buildStaffingTruthComparison(input: {
	totalTeachableRows: number;
	realCoveredRows: number;
	syntheticCoveredRows: number;
	unassignedRows: number;
	standardSimulation: CoverageSimulationResult;
	hardCapSimulation: CoverageSimulationResult;
}): StaffingTruthComparison {
	const toBucket = (
		simulation: CoverageSimulationResult,
		rowsClosedByTeacherX: number,
		forceZeroShortage = false,
	): StaffingTruthBucket => ({
		shortageRows: forceZeroShortage ? 0 : simulation.unresolvedPairs.length,
		shortageConcurrentHoursPerWeek: forceZeroShortage
			? 0
			: simulation.staffingReport.concurrentMissingHoursPerWeek,
		shortageConcurrentMinutesPerWeek: forceZeroShortage
			? 0
			: simulation.staffingReport.concurrentMissingMinutesPerWeek,
		rowsClosedByRealFaculty: simulation.rowsClosedByRealFaculty,
		rowsClosedByTeacherX,
	});

	const teacherXRowsClosed = input.hardCapSimulation.unresolvedPairs.length;

	return {
		baseline: {
			totalTeachableRows: input.totalTeachableRows,
			realCoveredRows: input.realCoveredRows,
			syntheticCoveredRows: input.syntheticCoveredRows,
			unassignedRows: input.unassignedRows,
		},
		realOnly: toBucket(input.standardSimulation, 0),
		hardCap: toBucket(input.hardCapSimulation, 0),
		teacherX: toBucket(input.hardCapSimulation, teacherXRowsClosed, true),
	};
}

function buildSectionSourceWarning(sectionResult: SectionFetchResult): string | null {
	if (sectionResult.source === 'enrollpro') {
		return null;
	}

	if (sectionResult.source === 'stub') {
		return 'Using local stub data for this preview.';
	}

	if (sectionResult.source === 'atlas-mirror') {
		return 'Using saved ATLAS section data instead of a live connection to EnrollPro.';
	}

	const fallbackReason = (sectionResult.fallbackReason ?? '').trim();
	if (fallbackReason === 'atlas-mirror-preferred-runtime-control') {
		return 'Using saved ATLAS section data for this preview (live connection is paused).';
	}

	if (fallbackReason === 'atlas-snapshot-preferred-runtime-control') {
		return 'Using a saved snapshot of section data for this preview.';
	}

	// Never return the raw fallbackReason string to the user
	return 'Using saved ATLAS section data for this preview.';
}

/**
 * Pure summary of a coverage + distribution plan. Exported so the exact counts
 * can be asserted without a database. `balanced` is only true when coverage is
 * complete AND no move is proposed AND nobody is above the teaching standard or
 * the absolute hard cap. It must never be derived from coverage alone.
 */
export function summarizeDistributionPlan(input: {
	coveredRows: number;
	uncoveredRows: number;
	moves: Array<{ fromFacultyId: number; minutes?: number }>;
	overCapFaculty: Array<{ facultyId?: number; teachingMinutes: number; totalCreditedMinutes?: number; overMinutes: number }>;
	hardCapMinutes: number;
	distributionEvaluated?: boolean;
}): TeachingLoadDistributionSummary {
	const distributionEvaluated = input.distributionEvaluated !== false;
	const aboveStandardFaculty = input.overCapFaculty.length;
	// The accepted Teaching Load contract measures hard-cap breaches from actual
	// teaching minutes only; advisory/ancillary credit is neutral and can never
	// create a hard-cap breach on its own.
	const hardCapBreaches = input.overCapFaculty.filter(
		(member) => member.teachingMinutes > input.hardCapMinutes,
	).length;
	// A donor is resolved only when the proposed moves cover the whole amount the
	// donor is over; a partially-relieved donor still leaves an unresolved row.
	// Donors without a stable id (unusual) fall back to the distinct-donor count.
	let unresolvedImbalance = 0;
	const donorIds = new Set(input.moves.map((move) => move.fromFacultyId));
	for (const member of input.overCapFaculty) {
		if (member.overMinutes <= 0) continue;
		if (member.facultyId == null) continue;
		const movedMinutes = input.moves
			.filter((move) => move.fromFacultyId === member.facultyId)
			.reduce((sum, move) => sum + Math.max(0, Number(move.minutes ?? 0) || 0), 0);
		if (movedMinutes < member.overMinutes) unresolvedImbalance += 1;
	}
	const unknownIdDonors = input.overCapFaculty.filter((member) => member.facultyId == null).length;
	if (unknownIdDonors > 0) {
		unresolvedImbalance += Math.max(0, unknownIdDonors - donorIds.size);
	}
	const balanced =
		distributionEvaluated
		&& input.uncoveredRows === 0
		&& input.moves.length === 0
		&& aboveStandardFaculty === 0
		&& hardCapBreaches === 0;
	return {
		coveredRows: Math.max(0, input.coveredRows),
		uncoveredRows: Math.max(0, input.uncoveredRows),
		proposedMoves: input.moves.length,
		unresolvedImbalance,
		aboveStandardFaculty,
		hardCapBreaches,
		distributionEvaluated,
		balanced,
	};
}

/**
 * Distribution plan for the zero-section early return. There is nothing to
 * evaluate, so this is explicitly NOT a balanced result — a failed/empty
 * preview must never render as success.
 */
export function emptyDistributionPlan(): TeachingLoadDistributionPlan {
	return {
		retains: [],
		inserts: [],
		moves: [],
		candidateRejections: [],
		policy: null,
		summary: {
			coveredRows: 0,
			uncoveredRows: 0,
			proposedMoves: 0,
			unresolvedImbalance: 0,
			aboveStandardFaculty: 0,
			hardCapBreaches: 0,
			distributionEvaluated: false,
			balanced: false,
		},
	};
}

/**
 * Build the single coverage + distribution plan for the daily suggestion
 * workflow. It preserves valid existing rows, structures coverage inserts, and
 * reuses the canonical over-cap rebalance preview so distribution moves are
 * exact structured actions, never warning strings.
 */
async function buildTeachingLoadDistributionPlan(params: {
	schoolId: number;
	schoolYearId: number;
	authToken?: string;
	preserved: number;
	unresolved: number;
	suggestedRows: SuggestedRowPreview[];
	placementSession?: PlacementPlanningSession | null;
}): Promise<TeachingLoadDistributionPlan> {
	const retains: DistributionRetainAction[] = [];
	const inserts: DistributionInsertAction[] = [];

	for (const row of params.suggestedRows) {
		const facultyId = row.facultyId ?? null;
		if (facultyId == null || !Number.isInteger(facultyId) || facultyId <= 0) continue;
		if (row.assignmentType === 'KEPT_EXISTING') {
			retains.push({ action: 'RETAIN', subjectId: row.subjectId, sectionId: row.sectionId, facultyId });
		} else if (row.assignmentType === 'REAL_TEACHER' || row.assignmentType === 'PLACEHOLDER_TEACHER') {
			// TL-SHORTAGE-C02 item 3: a SAVED placeholder assignment is a real
			// persisted INSERT (apply writes `plan.inserts`), so it belongs here
			// exactly like a real-teacher insert. An unsaved substitute row still
			// falls through, because it carries `facultyId: null`.
			inserts.push({ action: 'INSERT', subjectId: row.subjectId, sectionId: row.sectionId, facultyId });
		}
	}

	let rebalance: OverCapRebalanceResult;
	let distributionEvaluated = true;
	try {
		rebalance = await previewOrApplyOverCapRebalance({
			schoolId: params.schoolId,
			schoolYearId: params.schoolYearId,
			actorId: 0,
			authToken: params.authToken,
			previewOnly: true,
			placementSession: params.placementSession ?? undefined,
		});
		// If the evaluator resolved no sections or could not resolve the effective
		// persisted policy it could not judge distribution. Treat that as
		// unevaluated so `balanced` can never be inferred from a silently empty
		// over-cap list or an invented policy.
		if (rebalance.sectionsResolved <= 0 || rebalance.evaluated !== true) {
			distributionEvaluated = false;
		}
	} catch {
		distributionEvaluated = false;
		rebalance = {
			applied: false,
			schoolId: params.schoolId,
			schoolYearId: params.schoolYearId,
			overCapFaculty: [],
			proposedMoves: [],
			candidateRejections: [],
			movesApplied: 0,
			ownershipRowsMoved: 0,
			facultySubjectRowsUpdated: 0,
			facultyMirrorVersionsBumped: 0,
			sectionsResolved: 0,
			policy: null,
			evaluated: false,
		};
	}

	const moves: DistributionMoveAction[] = rebalance.proposedMoves.map((move) => ({
		action: 'MOVE',
		...move,
	}));

	const policy = rebalance.policy;
	const policyBinding: TeachingLoadDistributionPolicyBinding | null = policy != null
		? {
			teachingStandardMinutes: policy.teachingStandardMinutes,
			advisoryCreditMinutes: policy.advisoryCreditMinutes,
			hardCapMinutes: policy.hardCapMinutes,
			revision: workloadPolicyRevision(policy),
		}
		: null;
	if (policyBinding == null) {
		distributionEvaluated = false;
	}

	return {
		retains,
		inserts,
		moves,
		candidateRejections: rebalance.candidateRejections,
		policy: policyBinding,
		summary: summarizeDistributionPlan({
			coveredRows: params.preserved,
			uncoveredRows: params.unresolved,
			moves,
			overCapFaculty: rebalance.overCapFaculty,
			// The effective persisted hard cap is write authority; the module
			// default is never used to judge balance.
			hardCapMinutes: policyBinding?.hardCapMinutes ?? WORKLOAD_DEFAULTS.hardCapMinutes,
			distributionEvaluated,
		}),
	};
}

/**
 * Resolve the canonical derived-demand authority for a suggestion path.
 *
 * This is the single current-year pair authority for Teaching Load suggestions,
 * staffing need, and distribution. It reads only through the supplied client
 * (the ambient data context for read-only previews, or the Serializable
 * transaction client for a reviewed apply) and never performs an EnrollPro
 * network read or writes a cache. A missing/malformed ordered-term authority is
 * a typed fail-closed blocker, never a silent empty demand.
 */
export async function resolveSuggestionDerivedDemand(
	schoolId: number,
	schoolYearId: number,
	client?: unknown,
): Promise<DerivedDemandSuccess> {
	const derived = await buildDerivedDemand(schoolId, schoolYearId, { client: (client ?? db()) as never });
	if (!derived.ok) {
		const error = new Error(
			`Canonical derived demand is unavailable for this school year: ${derived.blockers.map((entry) => entry.code).join(', ') || 'UNKNOWN'}. Run the explicit term sync before preparing Teaching Load suggestions.`,
		) as Error & { statusCode: number; code: string; details: { blockers: DerivedDemandBlocker[] } };
		error.statusCode = 409;
		error.code = 'DERIVED_DEMAND_UNAVAILABLE';
		error.details = { blockers: derived.blockers };
		throw error;
	}
	return derived;
}

/** Stable identity of one canonical Teaching Load pair: `subjectId:sectionExternalId`. */
function canonicalPairKey(pair: DerivedTeachingLoadPair): string {
	return `${pair.subjectId}:${pair.sectionExternalId}`;
}

export async function autoFill(
	schoolId: number,
	schoolYearId: number,
	authToken?: string,
	options?: AutoFillOptions,
): Promise<AutoFillResult> {
	if (options?.previewOnly !== true && options?.staffingOnly !== true) {
		const error = new Error('Direct Teaching Load auto-fill apply is retired. Create and review a suggestion proposal before applying changes.') as Error & {
			statusCode: number;
			code: string;
		};
		error.statusCode = 409;
		error.code = 'TEACHING_LOAD_PROPOSAL_REQUIRED';
		throw error;
	}
	const warnings: string[] = [];
	const previewOnly = options?.previewOnly ?? false;
	const staffingOnly = options?.staffingOnly === true;
	const coverageMode = options?.coverageMode ?? DEFAULT_COVERAGE_MODE;
	// A8 c4 item 3, corrected by QA (F2). TWO independent operator decisions,
	// deliberately NOT welded together:
	//   `allowPlaceholders`          — may a to-be-hired record take the class?
	//   `allowUnqualifiedRealFaculty` — may a real but UNQUALIFIED teacher take it?
	// The placeholder pool stays available by default (`true`, so every existing
	// caller is unchanged). The unqualified-real-teacher tier defaults to `false`
	// because a `REAL_TEACHER` row is a PERSISTED insert and the reviewed
	// suggestion-apply path is qualification-valid by construction. The cover
	// surface does not read this option: `teaching-load-cover.service.ts` resolves
	// its own tiers, so `cover-candidates` keeps offering `ANYONE`.
	const allowPlaceholders = options?.allowPlaceholders !== false;
	const allowUnqualifiedRealFaculty = options?.allowUnqualifiedRealFaculty === true;
	const realCoverageMode = resolveRealCoverageMode(coverageMode);

	// Canonical derived demand is the sole current-year pair authority. A typed
	// blocker (missing/ambiguous active year, unavailable/empty/malformed ordered
	// term structure, invalid rotation metadata) fails the suggestion closed
	// before any coverage, staffing, or distribution work.
	const derivedDemand = await resolveSuggestionDerivedDemand(schoolId, schoolYearId, options?.client);

	const sectionResult = await fetchSectionsForAutoFill(schoolId, schoolYearId, authToken);
	const sectionSourceWarning = buildSectionSourceWarning(sectionResult);
	if (sectionSourceWarning) {
		warnings.push(sectionSourceWarning);
	}
	const sectionGradeLevel = new Map<number, number>();
	const sectionMeta = new Map<number, { sectionName: string; programType: string; programTypeRaw: string | null }>();
	for (const grade of sectionResult.gradeLevels) {
		for (const section of grade.sections) {
			if (section.id > 0) {
				sectionGradeLevel.set(section.id, section.displayOrder);
				sectionMeta.set(section.id, {
					sectionName: section.name,
					programType: section.programType ?? 'REGULAR',
					programTypeRaw: section.programType ?? null,
				});
			}
		}
	}

	// ─── SHIFT-COHERENCE-C01 (D11) authority ────────────────────────────────
	// Resolve the policy switches and the grade shift windows from the same read
	// client used by the rest of the preview. The guard gates `autoFill`
	// candidate selection only; manual assignment and the reviewed proposal-apply
	// path are never gated. A section with no shift authority contributes no
	// window and can never create a span.
	const schedulingPolicy = await resolveSchedulingPolicyForRead(
		schoolId,
		schoolYearId,
		(options?.client as never) ?? null,
	);
	// A8-C5 S1.3: the SAVED workload policy, forwarded to every staffing report so
	// the hire estimate divides by the school's own standard rather than the
	// `STANDARD_CAP_MIN` module constant. This is the SAME policy object the
	// shift-coherence switches below are read from, so there is no second read and
	// no possibility of the two disagreeing.
	const resolvedWorkloadPolicy = (schedulingPolicy ?? null) as {
		teachingStandardMinutes?: number | null;
		hardCapMinutes?: number | null;
	} | null;
	const enableShiftCoherenceGuard = typeof (schedulingPolicy as { enableShiftCoherenceGuard?: unknown })?.enableShiftCoherenceGuard === 'boolean'
		? (schedulingPolicy as { enableShiftCoherenceGuard: boolean }).enableShiftCoherenceGuard
		: SCHEDULING_POLICY_DEFAULTS.enableShiftCoherenceGuard;
	const enforceShiftCoherenceGuard = enableShiftCoherenceGuard
		&& (typeof (schedulingPolicy as { enforceShiftCoherenceGuard?: unknown })?.enforceShiftCoherenceGuard === 'boolean'
			? (schedulingPolicy as { enforceShiftCoherenceGuard: boolean }).enforceShiftCoherenceGuard
			: SCHEDULING_POLICY_DEFAULTS.enforceShiftCoherenceGuard);

	// The real Prisma client always exposes `gradeShiftWindow`; a narrow test
	// double that does not is treated as having no window authority (the guard is
	// additive and SOFT by default, so it never throws and never blocks).
	const shiftWindowReader = ((options?.client as { gradeShiftWindow?: { findMany: (args: unknown) => Promise<unknown[]> } }) ?? db());
	const shiftWindowRows = enableShiftCoherenceGuard && shiftWindowReader.gradeShiftWindow
		? await shiftWindowReader.gradeShiftWindow.findMany({
			where: { schoolId, schoolYearId },
			select: { gradeLevel: true, programType: true, startTime: true, endTime: true },
		})
		: [];
	const shiftWindows: ShiftCoherenceWindow[] = (shiftWindowRows as Array<{
		gradeLevel: number;
		programType: string | null;
		startTime: string;
		endTime: string;
	}>).map((row) => ({
		gradeLevel: row.gradeLevel,
		programType: row.programType ?? null,
		startTime: row.startTime,
		endTime: row.endTime,
	}));
	const sectionShiftWindowBySectionId = new Map<number, ShiftCoherenceWindow | null>();
	for (const [sectionId, grade] of sectionGradeLevel.entries()) {
		sectionShiftWindowBySectionId.set(sectionId, resolveSectionShiftWindow({
			gradeLevel: grade,
			programType: sectionMeta.get(sectionId)?.programTypeRaw ?? null,
			windows: shiftWindows,
		}));
	}

	const allSectionIds = Array.from(sectionGradeLevel.keys());
	if (allSectionIds.length === 0) {
		warnings.push('No active sections were resolved for the selected school year. Auto-fill cannot continue.');
		const emptyReport = buildStaffingReport([], [], new Map<number, number>(), realCoverageMode, undefined, resolvedWorkloadPolicy);
		const emptyTruth: StaffingTruthComparison = {
			baseline: {
				totalTeachableRows: 0,
				realCoveredRows: 0,
				syntheticCoveredRows: 0,
				unassignedRows: 0,
			},
			realOnly: {
				shortageRows: 0,
				shortageConcurrentHoursPerWeek: 0,
				shortageConcurrentMinutesPerWeek: 0,
				rowsClosedByRealFaculty: 0,
				rowsClosedByTeacherX: 0,
			},
			hardCap: {
				shortageRows: 0,
				shortageConcurrentHoursPerWeek: 0,
				shortageConcurrentMinutesPerWeek: 0,
				rowsClosedByRealFaculty: 0,
				rowsClosedByTeacherX: 0,
			},
			teacherX: {
				shortageRows: 0,
				shortageConcurrentHoursPerWeek: 0,
				shortageConcurrentMinutesPerWeek: 0,
				rowsClosedByRealFaculty: 0,
				rowsClosedByTeacherX: 0,
			},
		};
		return {
			preserved: 0,
			created: 0,
			assignmentsCreated: 0,
			uniqueTeachersAffected: 0,
			unresolved: 0,
			coverageMode,
			warnings,
			sectionSource: sectionResult.source,
			sectionFallbackReason: sectionResult.fallbackReason ?? null,
			staffingReport: emptyReport,
			staffingTruth: emptyTruth,
			distribution: emptyDistributionPlan(),
			preferenceNotices: [],
			shiftCoherenceNotices: [],
			derivedDemandRevision: derivedDemand.revision,
			canonicalDemandPairCount: derivedDemand.totalPairs,
			outsideDemandOwnershipCount: 0,
		};
	}

	const staleReconcile = await previewOrApplyStaleOwnershipReconcile({
		schoolId,
		schoolYearId,
		actorId: 0,
		authToken,
		previewOnly: true,
	});

	if (staleReconcile.staleOwnedCurrentYearPairCount > 0) {
		if (staleReconcile.applied) {
			warnings.push(
				`Removed ${staleReconcile.deletedOwnershipRows} stale ownership row${staleReconcile.deletedOwnershipRows === 1 ? '' : 's'} before coverage simulation so saved coverage truth can persist.`,
			);
		} else {
			warnings.push(
				`Detected ${staleReconcile.staleOwnedCurrentYearPairCount} stale owned pair${staleReconcile.staleOwnedCurrentYearPairCount === 1 ? '' : 's'}. Simulated recoverability may exceed saved coverage until stale ownership reconciliation is applied.`,
			);
		}
	}

	const faculty = await db().facultyMirror.findMany({
		where: { schoolId, isStale: false, isActiveForScheduling: true },
		select: {
			id: true,
			firstName: true,
			lastName: true,
			department: true,
			specialization: true,
			canTeachOutsideDepartment: true,
			maxHoursPerWeek: true,
			isPlaceholder: true,
			isClassAdviser: true,
			advisoryEquivalentHours: true,
			ancillaryMinutesPerWeek: true,
			advisedSectionId: true,
		},
	});
	const activeFacultyIds = faculty.map((member) => member.id);
	const realFaculty = faculty.filter((member) => !member.isPlaceholder);
	const realFacultyIds = realFaculty.map((member) => member.id);
	const placeholderFacultyIds = new Set(faculty.filter((member) => member.isPlaceholder).map((member) => member.id));

	// FACULTY-GRADE-PREFERENCE-C01 (D10). One year-independent read of the
	// ATLAS-owned soft preference. There is deliberately no schoolYearId filter:
	// the preference persists across rollover. Empty arrays are dropped so an
	// unset preference changes nothing.
	const gradePreferenceRows = await db().facultyGradePreference.findMany({
		where: { schoolId },
		select: { facultyId: true, gradeLevels: true },
	});
	const preferredGradeLevelsByFacultyId = new Map<number, number[]>();
	for (const row of gradePreferenceRows) {
		if (Array.isArray(row.gradeLevels) && row.gradeLevels.length > 0) {
			preferredGradeLevelsByFacultyId.set(row.facultyId, row.gradeLevels);
		}
	}

	// One persisted-only qualification snapshot is shared by coverage and
	// distribution evaluation for this preview. This keeps aliases, owner
	// prefixes, cross-department permissions, and policy revision coherent.
	const qualificationAuthority = await loadPersistedQualificationAuthority(schoolId);
	// Prepare the generator-aligned timetable shape ONCE. The candidate loop below
	// walks its ranked teachers against this shared reservation session, so a
	// proposal prefers a teacher who can actually be placed instead of discovering
	// the conflict only after its preview is built. When shape authority is not
	// ready, no candidate is claimed feasible; proposal creation remains fail-closed
	// through the existing placement gate.
	const placementPlanner = options?.placementPlanner ?? await prepareTeachingLoadPlacementPlanner(schoolId, schoolYearId);
	const placementSession = placementPlanner.begin(new Map(
		faculty.map((member) => [member.id, `${member.lastName}, ${member.firstName}`]),
	));

	// ─── Step 1: Build resolved-pair set + capacity used per faculty ───────────
	const existingOwnerships = await db().subjectSectionOwnership.findMany({
		where: {
			schoolId,
			schoolYearId,
			sectionId: { in: allSectionIds },
			facultyId: { in: activeFacultyIds },
		},
		select: {
			subjectId: true,
			sectionId: true,
			facultyId: true,
			facultySubject: {
				select: {
					subject: {
						select: {
							id: true,
							code: true,
							modularGroupId: true,
							modularOrder: true,
							termGroupId: true,
							termCount: true,
							rotationFamily: true,
							minMinutesPerWeek: true,
						},
					},
				},
			},
		},
	});

	// Active subjects (HG/ARAL are excluded — advisory and beneficiary programs).
	// This row set also supplies the Subject semantics used for qualification and
	// capacity; the canonical pair set below decides which pairs create demand.
	const subjects = await db().subject.findMany({
		where: {
			schoolId,
			isActive: true,
			code: { notIn: [...NON_DEMAND_SUBJECT_CODES] },
		},
		select: {
			id: true,
			code: true,
			name: true,
			rotationFamily: true,
			gradeLevels: true,
			programScopes: true,
			minMinutesPerWeek: true,
			modularGroupId: true,
			modularOrder: true,
			termGroupId: true,
			termCount: true,
			ownerDepartment: true,
			requiredFeatures: true,
			allowedSpecializations: true,
		},
	});
	const subjectMap = new Map<number, SubjectRow>(subjects.map((subject) => [subject.id, subject]));

	// Canonical pair authority: only SCHEDULED_TEACHING subject x active-section
	// pairs whose normalized grade/program scope matches and whose ordered-term
	// rotation is valid. REFERENCE_ONLY subjects, out-of-scope sections, and
	// HG/ARAL codes never enter the demand set.
	const canonicalPairs: DerivedTeachingLoadPair[] = derivedDemand.teachingLoadPairs.filter((pair) =>
		subjectMap.has(pair.subjectId),
	);
	const canonicalPairKeySet = new Set<string>(canonicalPairs.map((pair) => canonicalPairKey(pair)));

	// Every existing ownership identity (used for the advisory/HG check), then the
	// canonical-demand subset used for coverage, capacity, and minutes.
	const allResolvedPairs = new Set<string>(existingOwnerships.map((o) => `${o.subjectId}:${o.sectionId}`));
	const canonicalOwnershipRows = existingOwnerships.filter((o) =>
		canonicalPairKeySet.has(`${o.subjectId}:${o.sectionId}`),
	);
	const outsideDemandOwnershipRows = existingOwnerships.filter(
		(o) => !canonicalPairKeySet.has(`${o.subjectId}:${o.sectionId}`),
	);
	const resolvedPairs = new Set<string>(canonicalOwnershipRows.map((o) => `${o.subjectId}:${o.sectionId}`));
	const preserved = resolvedPairs.size;

	// SHIFT-COHERENCE-C01 (D11): seed each real teacher's already-held shift
	// windows from their canonical current-year ownerships. A section with no
	// resolved window contributes nothing (never a fabricated window).
	const baseShiftAssignmentsByFacultyId = new Map<number, FacultyShiftSection[]>();
	if (enableShiftCoherenceGuard) {
		for (const ownership of canonicalOwnershipRows) {
			const window = sectionShiftWindowBySectionId.get(ownership.sectionId) ?? null;
			if (!window) continue;
			const meta = sectionMeta.get(ownership.sectionId);
			const list = baseShiftAssignmentsByFacultyId.get(ownership.facultyId) ?? [];
			list.push({
				sectionId: ownership.sectionId,
				sectionName: meta?.sectionName ?? `Section ${ownership.sectionId}`,
				gradeLevel: sectionGradeLevel.get(ownership.sectionId) ?? 0,
				window,
			});
			baseShiftAssignmentsByFacultyId.set(ownership.facultyId, list);
		}
	}

	// HG is covered by the adviser's advisory credit (advisoryEquivalentHours)
	// and ARAL Program is an excluded beneficiary program. Neither may consume
	// teaching-capacity budget — exclude both from the capacity ledgers.
	const nonDemandSubjectRowsForCapacity = await db().subject.findMany({
		where: { schoolId, code: { in: [...NON_DEMAND_SUBJECT_CODES] } },
		select: { id: true },
	});
	const nonDemandSubjectIdSetForCapacity = new Set(nonDemandSubjectRowsForCapacity.map((row) => row.id));
	const nonDemandOwnershipRows = canonicalOwnershipRows.filter(
		(o) => !nonDemandSubjectIdSetForCapacity.has(o.subjectId),
	);

	const realOwnershipRows = nonDemandOwnershipRows.filter((ownership) => realFacultyIds.includes(ownership.facultyId));
	const {
		capacityLedgersByFaculty: baseRealCapacityLedgersByFaculty,
		capacityUsed: baseRealCapacityUsed,
	} = buildInitialCapacityTracking(realOwnershipRows as ExistingOwnershipRow[]);

	const capacityLedgersByFaculty = cloneCapacityLedgers(baseRealCapacityLedgersByFaculty);
	const capacityUsed = new Map<number, number>(baseRealCapacityUsed);

	// ─── Step 2: Verify HG records for advisers (warn if missing) ─────────────
	const advisersWithoutHg = await db().facultyMirror.findMany({
		where: {
			schoolId,
			isStale: false,
			isClassAdviser: true,
			advisedSectionId: { not: null },
		},
		select: { id: true, firstName: true, lastName: true, advisedSectionId: true },
	});

	const hgSubject = await db().subject.findFirst({
		where: { schoolId, code: 'HG' },
		select: { id: true },
	});

	if (hgSubject) {
		for (const adviser of advisersWithoutHg) {
			const hasHg = allResolvedPairs.has(`${hgSubject.id}:${adviser.advisedSectionId}`);
			if (!hasHg) {
				warnings.push(
					`HG advisory missing for ${adviser.firstName} ${adviser.lastName} (section ${adviser.advisedSectionId}). Run faculty sync to repair.`,
				);
			}
		}
	}

	// Defect 6: existing ownership that falls outside canonical demand is
	// diagnosed and excluded from ordinary workload/suggestion demand. It is
	// never silently converted into a suggested pair or teaching minute.
	if (outsideDemandOwnershipRows.length > 0) {
		warnings.push(
			`Detected ${outsideDemandOwnershipRows.length} current-year ownership row${outsideDemandOwnershipRows.length === 1 ? '' : 's'} outside canonical derived demand (reference-only, out-of-scope, or inactive-pair). They were excluded from ordinary Teaching Load demand and capacity.`,
		);
	}

	// ─── Step 2b: Compute non-teaching credit minutes per faculty ────────────
	// Credited-load semantics: the cap applies to CREDITED load (teaching +
	// advisory + ancillary). Advisory and ancillary are non-teaching credits
	// that reduce the available teaching budget. HG (Homeroom Guidance) is
	// covered BY the advisory credit — the adviser's 5h advisoryEquivalentHours
	// already accounts for it, so HG minutes are excluded from the capacity
	// ledgers entirely (see the nonHgOwnershipRows filter above) to avoid
	// double-counting advisory duty against both teaching budget and credit.
	const currentYearSectionIdSet = new Set(allSectionIds);
	const nonTeachingMinutesByFaculty = new Map<number, number>();
	for (const member of faculty) {
		if (member.isPlaceholder) continue;
		const isValidAdviser =
			member.isClassAdviser &&
			member.advisedSectionId != null &&
			currentYearSectionIdSet.has(member.advisedSectionId);
		const advisoryMinutes = isValidAdviser
			? Math.max(0, Math.round((member.advisoryEquivalentHours ?? 0) * 60))
			: 0;
		const ancillaryMinutes = Math.max(0, Math.round(member.ancillaryMinutesPerWeek ?? 0));
		const total = advisoryMinutes + ancillaryMinutes;
		if (total > 0) {
			nonTeachingMinutesByFaculty.set(member.id, total);
		}
	}

	// ─── Step 3: Build the canonical work queue ───────────────────────────────
	// The work queue is derived exclusively from canonical derived-demand pair
	// identities. The former independent active-subject x active-section
	// Cartesian construction is removed; no pair exists unless canonical demand
	// produced it and its runtime section evidence is available.
	const workQueue: UnresolvedPair[] = [];
	const unresolvedPairs: UnresolvedPair[] = [];
	const autoFillCandidateRejections: TeachingLoadCandidateRejection[] = [];
	const autoFillPreferenceNotices: TeachingLoadPreferenceNotice[] = [];
	const autoFillShiftCoherenceNotices: TeachingLoadShiftCoherenceNotice[] = [];
	const allTeachablePairs: UnresolvedPair[] = [];
	const teachablePairKeySet = new Set<string>();
	for (const pair of canonicalPairs) {
		const subject = subjectMap.get(pair.subjectId)!;
		const sectionInfo = sectionMeta.get(pair.sectionExternalId);
		if (!sectionInfo) continue;
		const key = `${pair.subjectId}:${pair.sectionExternalId}`;
		const unresolvedPair: UnresolvedPair = {
			subjectId: pair.subjectId,
			sectionId: pair.sectionExternalId,
			subject,
			sectionName: sectionInfo.sectionName,
			sectionProgramType: sectionInfo.programType,
		};
		allTeachablePairs.push(unresolvedPair);
		teachablePairKeySet.add(key);
		if (!resolvedPairs.has(key)) {
			workQueue.push(unresolvedPair);
		}
	}

	const realAssignedPairSet = new Set<string>();
	const syntheticAssignedPairSet = new Set<string>();
	for (const ownership of existingOwnerships) {
		const pairKey = `${ownership.subjectId}:${ownership.sectionId}`;
		if (!teachablePairKeySet.has(pairKey)) {
			continue;
		}
		if (placeholderFacultyIds.has(ownership.facultyId)) {
			syntheticAssignedPairSet.add(pairKey);
		} else {
			realAssignedPairSet.add(pairKey);
		}
	}

	const syntheticOnlyPairSet = new Set<string>(
		Array.from(syntheticAssignedPairSet).filter((pairKey) => !realAssignedPairSet.has(pairKey)),
	);
	const anyAssignedPairSet = new Set<string>([
		...Array.from(realAssignedPairSet),
		...Array.from(syntheticAssignedPairSet),
	]);

	const realCoverageQueue = allTeachablePairs.filter(
		(pair) => !realAssignedPairSet.has(`${pair.subjectId}:${pair.sectionId}`),
	);

	const standardSimulation = simulateRealFacultyCoverage({
		coverageMode: REAL_ONLY_STANDARD_MODE,
		realFaculty,
		candidatePairs: realCoverageQueue,
		baseCapacityLedgersByFaculty: baseRealCapacityLedgersByFaculty,
		qualificationAuthority,
		nonTeachingMinutesByFaculty,
		sectionGradeLevelBySectionId: sectionGradeLevel,
		preferredGradeLevelsByFacultyId,
		policy: resolvedWorkloadPolicy,
		shiftCoherence: {
			enabled: enableShiftCoherenceGuard,
			enforce: enforceShiftCoherenceGuard,
			sectionWindowBySectionId: sectionShiftWindowBySectionId,
			assignmentsByFacultyId: baseShiftAssignmentsByFacultyId,
		},
	});
	const hardCapSimulation = simulateRealFacultyCoverage({
		coverageMode: REAL_ONLY_HARD_CAP_MODE,
		realFaculty,
		candidatePairs: realCoverageQueue,
		baseCapacityLedgersByFaculty: baseRealCapacityLedgersByFaculty,
		qualificationAuthority,
		nonTeachingMinutesByFaculty,
		sectionGradeLevelBySectionId: sectionGradeLevel,
		preferredGradeLevelsByFacultyId,
		policy: resolvedWorkloadPolicy,
		shiftCoherence: {
			enabled: enableShiftCoherenceGuard,
			enforce: enforceShiftCoherenceGuard,
			sectionWindowBySectionId: sectionShiftWindowBySectionId,
			assignmentsByFacultyId: baseShiftAssignmentsByFacultyId,
		},
	});

	const staffingTruth = buildStaffingTruthComparison({
		totalTeachableRows: allTeachablePairs.length,
		realCoveredRows: realAssignedPairSet.size,
		syntheticCoveredRows: syntheticOnlyPairSet.size,
		unassignedRows: Math.max(0, allTeachablePairs.length - anyAssignedPairSet.size),
		standardSimulation,
		hardCapSimulation,
	});

	const selectedSimulation = coverageMode === REAL_ONLY_STANDARD_MODE
		? standardSimulation
		: hardCapSimulation;
	const selectedStaffingReport = coverageMode === 'REAL_FACULTY_THEN_TEACHER_X'
		? buildStaffingReport([], realFaculty, hardCapSimulation.capacityUsed, REAL_ONLY_HARD_CAP_MODE, nonTeachingMinutesByFaculty, resolvedWorkloadPolicy)
		: selectedSimulation.staffingReport;
	const selectedUnresolvedForMode = coverageMode === 'REAL_FACULTY_THEN_TEACHER_X'
		? 0
		: selectedSimulation.unresolvedPairs.length;

	if (staffingOnly) {
		appendShiftCoherenceWarnings(warnings, selectedSimulation.shiftCoherenceNotices, selectedSimulation.candidateRejections);
		return {
			preserved,
			created: 0,
			assignmentsCreated: 0,
			uniqueTeachersAffected: 0,
			unresolved: selectedUnresolvedForMode,
			stillNeedRealTeacher: selectedUnresolvedForMode,
			coverageMode,
			warnings,
			sectionSource: sectionResult.source,
			sectionFallbackReason: sectionResult.fallbackReason ?? null,
			staffingReport: selectedStaffingReport,
			staffingTruth,
			candidateRejections: selectedSimulation.candidateRejections,
			preferenceNotices: selectedSimulation.preferenceNotices,
			shiftCoherenceNotices: selectedSimulation.shiftCoherenceNotices,
			derivedDemandRevision: derivedDemand.revision,
			canonicalDemandPairCount: canonicalPairs.length,
			outsideDemandOwnershipCount: outsideDemandOwnershipRows.length,
		};
	}

	// ─── Step 5 & 6: Assign pairs, respecting caps and modular bundles ─────────
	// Group work queue by subjectId for modular bundle processing
	const bySubjectId = new Map<number, UnresolvedPair[]>();
	for (const pair of workQueue) {
		const bucket = bySubjectId.get(pair.subjectId) ?? [];
		bucket.push(pair);
		bySubjectId.set(pair.subjectId, bucket);
	}

	// Sort subjects: non-modular first, then modular groups in order
	const orderedSubjectIds = Array.from(bySubjectId.keys()).sort((a, b) => {
		const sa = subjectMap.get(a)!;
		const sb = subjectMap.get(b)!;
		return compareSubjectsDeterministically(sa, sb);
	});

	// Track new assignments to persist: facultyId → { subjectId → Set<sectionId> }
	const pendingAssignments = new Map<number, Map<number, Set<number>>>();

	function addPending(facultyId: number, subjectId: number, sectionId: number): void {
		if (!pendingAssignments.has(facultyId)) {
			pendingAssignments.set(facultyId, new Map());
		}
		const bySubject = pendingAssignments.get(facultyId)!;
		if (!bySubject.has(subjectId)) {
			bySubject.set(subjectId, new Set());
		}
		bySubject.get(subjectId)!.add(sectionId);
		// Update credited capacity with rotation-family lane collapsing.
		const subject = subjectMap.get(subjectId)!;
		const minutes = Math.max(0, Number(subject.minMinutesPerWeek) || 0);
		if (minutes <= 0) {
			return;
		}
		const laneKey = buildCapacityLaneKey({
			subjectId,
			subjectCode: subject.code,
			rotationFamily: subject.rotationFamily,
			modularGroupId: subject.modularGroupId,
			modularOrder: subject.modularOrder,
			termGroupId: subject.termGroupId,
			termCount: subject.termCount,
			sectionId,
		});
		const ledger = capacityLedgersByFaculty.get(facultyId) ?? createEmptyCapacityLedger();
		applyCapacityLaneMinutesToLedger(ledger, laneKey, minutes);
		capacityLedgersByFaculty.set(facultyId, ledger);
		capacityUsed.set(facultyId, ledger.creditedMinutes);
	}

	// SHIFT-COHERENCE-C01 (D11): the real assignment loop accumulates windows
	// exactly as the simulation does, so a second assignment that would span both
	// shift windows is evaluated against the first.
	const shiftAssignmentsByFacultyId = cloneShiftAssignments(baseShiftAssignmentsByFacultyId);

	/**
	 * TL-SHORTAGE-C02 item 3 — the SAVED-placeholder pool.
	 *
	 * A saved `isPlaceholder` teacher is a persisted ATLAS record that the
	 * generator already accepts as an owner, so excluding it from the suggestion
	 * engine made the only thing that unblocks generation invisible to the tool
	 * that fills load. Placeholders are therefore assignable, but under strict
	 * ordering and qualification rules:
	 *
	 *  - consulted ONLY after the real-teacher pass below has run, so a real
	 *    teacher with room is never displaced. A8 c4 strengthened this: when the
	 *    caller also passes `allowUnqualifiedRealFaculty: true`, the real pass
	 *    offers the `ANYONE` tier, so a placeholder is unreachable while ANY real
	 *    teacher has room, not merely while a QUALIFIED one does;
	 *  - never consulted at all when the caller passes `allowPlaceholders: false`;
	 *  - only for a subject the placeholder holds a persisted `facultySubject`
	 *    qualification row for in this school year;
	 *  - only up to the placeholder's own `maxHoursPerWeek` budget, measured with
	 *    the same rotation-lane capacity ledger the real pass uses;
	 *  - active and not stale only.
	 *
	 * Unlike `TEMPORARY_SUBSTITUTE` rows these are PERSISTED inserts, so they are
	 * reported as the distinct `PLACEHOLDER_TEACHER` assignment type.
	 */
	const placeholderPool = faculty.filter((member) => member.isPlaceholder);
	const placeholderAssignedFacultyIds = new Set<number>();
	const placeholderClosedPairs: UnresolvedPair[] = [];
	const placeholderSubjectIdsByFacultyId = new Map<number, Set<number>>();
	if (placeholderPool.length > 0) {
		const placeholderQualifications = await db().facultySubject.findMany({
			where: {
				schoolId,
				schoolYearId,
				facultyId: { in: placeholderPool.map((member) => member.id) },
			},
			select: { facultyId: true, subjectId: true },
		});
		for (const row of placeholderQualifications) {
			const set = placeholderSubjectIdsByFacultyId.get(row.facultyId) ?? new Set<number>();
			set.add(row.subjectId);
			placeholderSubjectIdsByFacultyId.set(row.facultyId, set);
		}
	}

	/**
	 * Try to cover one still-uncovered pair with a saved placeholder. Returns the
	 * placeholder that took it, or null. Capacity is read from the SAME ledger
	 * the real pass writes through, and the budget is the placeholder's own
	 * `maxHoursPerWeek` — never the school hard cap — so a placeholder can never
	 * be handed a 40h budget it did not contract for.
	 */
	const tryAssignPlaceholder = (pair: UnresolvedPair): FacultyRow | null => {
		const minutes = Math.max(0, Number(pair.subject.minMinutesPerWeek) || 0);
		if (minutes <= 0) return null;
		const laneKey = buildCapacityLaneKey({
			subjectId: pair.subjectId,
			subjectCode: pair.subject.code,
			rotationFamily: pair.subject.rotationFamily,
			modularGroupId: pair.subject.modularGroupId,
			modularOrder: pair.subject.modularOrder,
			termGroupId: pair.subject.termGroupId,
			termCount: pair.subject.termCount,
			sectionId: pair.sectionId,
		});
		// Deterministic order: least-loaded placeholder first, then lowest id.
		const candidates = placeholderPool
			.filter((member) => placeholderSubjectIdsByFacultyId.get(member.id)?.has(pair.subjectId) === true)
			.map((member) => ({ member, used: capacityUsed.get(member.id) ?? 0 }))
			.sort((left, right) => (left.used - right.used) || (left.member.id - right.member.id));
		for (const candidate of candidates) {
			const budget = effectiveWeeklyCapMinutes({
				maxHoursPerWeek: candidate.member.maxHoursPerWeek,
				ancillaryMinutesPerWeek: candidate.member.ancillaryMinutesPerWeek,
			});
			if (budget <= 0) continue;
			const ledger = capacityLedgersByFaculty.get(candidate.member.id) ?? createEmptyCapacityLedger();
			const delta = estimateCapacityLaneDeltaMinutes(ledger, laneKey, minutes);
			if (candidate.used + delta > budget) continue;
			const placement = placementSession?.tryAssign({
				sectionId: pair.sectionId,
				subjectId: pair.subjectId,
				facultyId: candidate.member.id,
			});
			if (placement && !placement.placeable) {
				appendBoundedCandidateRejections(autoFillCandidateRejections, [{
					subjectId: pair.subjectId,
					subjectCode: pair.subject.code,
					sectionId: pair.sectionId,
					sectionName: pair.sectionName,
					facultyId: candidate.member.id,
					facultyName: `${candidate.member.lastName}, ${candidate.member.firstName}`,
					reason: 'TIMETABLE_SHAPE_CONFLICT',
					placementReason: placement.reason,
				}]);
				continue;
			}
			applyCapacityLaneMinutesToLedger(ledger, laneKey, minutes);
			capacityLedgersByFaculty.set(candidate.member.id, ledger);
			capacityUsed.set(candidate.member.id, ledger.creditedMinutes);
			return candidate.member;
		}
		return null;
	};

	for (const subjectId of orderedSubjectIds) {
		const pairs = bySubjectId.get(subjectId)!;
		const subjectRow = subjectMap.get(subjectId)!;
		const subjectAssignmentCountByFacultyId = new Map<number, number>();
		const rotationLaneAssignmentCountByFacultyId = new Map<number, number>();
		const rotationFamily = resolveCapacityRotationFamily(
			subjectRow.code,
			subjectRow.rotationFamily,
			subjectRow.modularGroupId,
		);
		const rotationTermMetadata = resolveRotationTermMetadata({
			subjectCode: subjectRow.code,
			rotationFamily,
			modularGroupId: subjectRow.modularGroupId,
			modularOrder: subjectRow.modularOrder,
			termGroupId: subjectRow.termGroupId,
			termCount: subjectRow.termCount,
		});
		const rotationLaneDistributionKey = rotationFamily
			? `${rotationFamily}:term:${normalizeRotationTermLaneKey(rotationTermMetadata.termRank)}`
			: null;

		for (const pair of pairs) {
			const candidateShiftWindow = enableShiftCoherenceGuard
				? (sectionShiftWindowBySectionId.get(pair.sectionId) ?? null)
				: null;
			const selection = findBestCandidateForMode(
				subjectRow,
				pair.sectionId,
				pair.sectionName,
				pair.sectionProgramType,
				realFaculty,
				realCoverageMode,
				capacityLedgersByFaculty,
				capacityUsed,
				qualificationAuthority,
				subjectAssignmentCountByFacultyId,
				rotationLaneAssignmentCountByFacultyId,
				undefined,
				nonTeachingMinutesByFaculty,
				sectionGradeLevel.get(pair.sectionId) ?? 0,
				preferredGradeLevelsByFacultyId,
				{
					enabled: enableShiftCoherenceGuard,
					enforce: enforceShiftCoherenceGuard,
					sectionWindow: candidateShiftWindow,
					assignmentsByFacultyId: shiftAssignmentsByFacultyId,
				},
				{ allowUnqualified: allowUnqualifiedRealFaculty },
			);
			appendBoundedCandidateRejections(autoFillCandidateRejections, selection.rejections);
			let candidate = selection.faculty;
			if (placementSession && candidate) {
				const placementSelection = selectFirstTimetableFeasibleCandidate(
					placementSession,
					{ sectionId: pair.sectionId, subjectId: pair.subjectId },
					selection.rankedFaculty.map((rankedCandidate) => rankedCandidate.id),
				);
				candidate = selection.rankedFaculty.find((rankedCandidate) => rankedCandidate.id === placementSelection.facultyId) ?? null;
				for (const placement of placementSelection.rejected) {
					const rankedCandidate = selection.rankedFaculty.find((entry) => entry.id === placement.facultyId);
					if (!rankedCandidate) continue;
					appendBoundedCandidateRejections(autoFillCandidateRejections, [{
						subjectId: pair.subjectId,
						subjectCode: subjectRow.code,
						sectionId: pair.sectionId,
						sectionName: pair.sectionName,
						facultyId: rankedCandidate.id,
						facultyName: `${rankedCandidate.lastName}, ${rankedCandidate.firstName}`,
						reason: 'TIMETABLE_SHAPE_CONFLICT',
						placementReason: placement.reason,
					}]);
				}
			}
			// These notices describe the original capacity-ranked choice. If shape
			// ranking selected a different teacher, omit the advisory rather than
			// attach an inaccurate name to the accepted assignment.
			if (candidate === selection.faculty && selection.preferenceNotice && autoFillPreferenceNotices.length < MAX_CANDIDATE_REJECTIONS) {
				autoFillPreferenceNotices.push(selection.preferenceNotice);
			}
			if (candidate === selection.faculty && selection.shiftCoherenceNotice && autoFillShiftCoherenceNotices.length < MAX_CANDIDATE_REJECTIONS) {
				autoFillShiftCoherenceNotices.push(selection.shiftCoherenceNotice);
			}
			if (!candidate) {
				// A8 c4 item 3 ORDER INVARIANT: the saved-placeholder pool is
				// reachable ONLY when (a) the caller permits placeholders at all and
				// (b) the real pass above — which, with
				// `allowUnqualifiedRealFaculty`, also offers the `ANYONE` tier —
				// returned nobody. A placeholder is therefore never proposed while
				// ANY real teacher the caller admits has room, which is the
				// operator's "absolute last resort" rule. This branch is the proof
				// site: `selection.faculty === null` means the real pass, placeholders
				// included in ranking, found no room.
				const placeholder = allowPlaceholders ? tryAssignPlaceholder(pair) : null;
				if (placeholder) {
					placeholderAssignedFacultyIds.add(placeholder.id);
					addPending(placeholder.id, pair.subjectId, pair.sectionId);
					placeholderClosedPairs.push(pair);
					continue;
				}
				warnings.push(`Lacking Faculty: no department-qualified teacher for ${subjectRow.name} (${pair.sectionName}).`);
				unresolvedPairs.push(pair);
			} else {
				addPending(candidate.id, pair.subjectId, pair.sectionId);
				if (candidateShiftWindow) {
					const list = shiftAssignmentsByFacultyId.get(candidate.id) ?? [];
					list.push({
						sectionId: pair.sectionId,
						sectionName: pair.sectionName,
						gradeLevel: sectionGradeLevel.get(pair.sectionId) ?? 0,
						window: candidateShiftWindow,
					});
					shiftAssignmentsByFacultyId.set(candidate.id, list);
				}
				subjectAssignmentCountByFacultyId.set(candidate.id, (subjectAssignmentCountByFacultyId.get(candidate.id) ?? 0) + 1);
				if (rotationLaneDistributionKey) {
					rotationLaneAssignmentCountByFacultyId.set(
						candidate.id,
						(rotationLaneAssignmentCountByFacultyId.get(candidate.id) ?? 0) + 1,
					);
				}
			}
		}
	}

	// SHIFT-COHERENCE-C01 (D11): name who spans and why for the actual plan.
	appendShiftCoherenceWarnings(warnings, autoFillShiftCoherenceNotices, autoFillCandidateRejections);

	// ─── Step 7: Persist new assignments ──────────────────────────────────────
	let teacherXResolution: AutoFillResult['teacherXResolution'] | undefined;
	let teacherXRowsClosed = 0;

	if (coverageMode === 'REAL_FACULTY_THEN_TEACHER_X') {
		const unresolvedSubjectCodes = [...new Set(unresolvedPairs.map((pair) => pair.subject.code.trim().toUpperCase()))];

		teacherXRowsClosed = staffingTruth.teacherX.rowsClosedByTeacherX;
		teacherXResolution = {
			applied: false,
			rowsClosedByTeacherX: teacherXRowsClosed,
			createdPlaceholders: 0,
			reusedPlaceholders: 0,
			placeholderAssignmentsUpserted: 0,
			resolvedSubjectCodes: [],
			stillUncoveredSubjectCodes: unresolvedSubjectCodes,
			// Every substitute row is unsaved: `apply` persists only
			// `distribution.inserts`, and substitutes are not inserts.
			unsavedSubstituteRows: unresolvedPairs.length,
		};
	}

	// TL-SHORTAGE-C02 item 2 (correction R1 / B1): `created` and
	// `assignmentsCreated` count PERSISTED assignments ONLY, and are computed
	// below from the distribution plan's INSERTs.
	//
	// The previous `totalCreated = created + teacherXRowsClosed` added the
	// Teacher-X substitute count, so a run that persisted nothing reported
	// `assignmentsCreated: 1` — exactly the false claim the packet item was
	// meant to close, reappearing on the field a UI renders first. A
	// `TEMPORARY_SUBSTITUTE` row carries `facultyId: null`, is stripped from the
	// distribution plan, and is never written by apply.
	//
	// The substitute reporting is unchanged and still truthful in
	// `teacherXResolution.rowsClosedByTeacherX` / `unsavedSubstituteRows`, and
	// the real uncovered count is `stillNeedRealTeacher`.
	// TL-SHORTAGE-C02 item 2: Teacher-X mode must NOT force `unresolved` to 0.
	// Its `TEMPORARY_SUBSTITUTE` rows (facultyId null) are stripped from the
	// distribution plan and never persisted — apply writes only `plan.inserts` —
	// so the previous forced zero made the page read "complete" while generation
	// still emitted one `TL_DEMAND_UNCOVERED` blocker per uncovered pair.
	// `unresolved` now carries the REAL count in every mode, and the explicit
	// `stillNeedRealTeacher` field carries the same number for Teacher-X so a
	// caller never has to infer it from `unresolved`.
	const stillNeedRealTeacher = unresolvedPairs.length;
	const finalUnresolved = stillNeedRealTeacher;
	const staffingReport = coverageMode === 'REAL_FACULTY_THEN_TEACHER_X'
		? buildStaffingReport([], realFaculty, capacityUsed, REAL_ONLY_HARD_CAP_MODE, nonTeachingMinutesByFaculty, resolvedWorkloadPolicy)
		: selectedStaffingReport;

	// ─── Build suggestedRows preview from the actual assignment plan ──────
	const suggestedRows: SuggestedRowPreview[] = [];

	// Detect over-cap faculty from existing ownerships (Fix B).
	// A faculty is over-cap when their credited teaching load + non-teaching
	// credits exceed their maxHoursPerWeek cap.
	// TL-SHORTAGE-C02 item 5: the auto-fill over-cap report reads the ONE shared
	// load definition, so Teaching Load and generation agree on who is over
	// limit instead of auto-fill pairing teaching+advisory minutes against the
	// generator's whole-hour cap.
	const overCapFacultyById = new Map<number, { overMinutes: number; facultyName: string }>();
	for (const member of faculty) {
		if (member.isPlaceholder) continue;
		const evaluation = evaluateWeeklyLoad(capacityUsed.get(member.id) ?? 0, {
			maxHoursPerWeek: member.maxHoursPerWeek,
			ancillaryMinutesPerWeek: member.ancillaryMinutesPerWeek,
		});
		if (evaluation.isOverLimit) {
			overCapFacultyById.set(member.id, {
				overMinutes: evaluation.overMinutes,
				facultyName: `${member.lastName}, ${member.firstName}`,
			});
		}
	}
	if (overCapFacultyById.size > 0) {
		for (const [facultyId, info] of overCapFacultyById) {
			const overHours = Math.round((info.overMinutes / 60) * 10) / 10;
			warnings.push(
				`Teacher above the teaching standard: ${info.facultyName} is over their weekly maximum by ${overHours}h/week (${Math.round(info.overMinutes)} min). The suggestion plan proposes exact reallocation moves where a qualified same-department receiver has capacity.`,
			);
		}
	}

	// 1. KEPT_EXISTING: canonical-demand ownerships that were already resolved
	for (const ownership of canonicalOwnershipRows) {
		const sectionMeta_ = sectionMeta.get(ownership.sectionId);
		const subjectRow_ = subjectMap.get(ownership.subjectId);
		const facultyMember = faculty.find((m) => m.id === ownership.facultyId);
		const overCapInfo = overCapFacultyById.get(ownership.facultyId);
		suggestedRows.push({
			subjectId: ownership.subjectId,
			subjectCode: subjectRow_?.code ?? `Subject #${ownership.subjectId}`,
			subjectName: subjectRow_?.name ?? `Subject #${ownership.subjectId}`,
			sectionId: ownership.sectionId,
			sectionName: sectionMeta_?.sectionName ?? `Section ${ownership.sectionId}`,
			facultyId: ownership.facultyId,
			facultyName: facultyMember ? `${facultyMember.lastName}, ${facultyMember.firstName}` : `Faculty #${ownership.facultyId}`,
			assignmentType: 'KEPT_EXISTING',
			warning: overCapInfo
				? `Teacher already over cap by ${Math.round((overCapInfo.overMinutes / 60) * 10) / 10}h`
				: null,
		});
	}

	// 2. REAL_TEACHER / PLACEHOLDER_TEACHER: proposed new assignments from
	// pendingAssignments. TL-SHORTAGE-C02 item 3 — a saved placeholder is
	// reported as its own assignment type so an operator can tell a persisted
	// "to be hired" assignment from an unsaved substitute row.
	for (const [facultyId, subjectMap_] of pendingAssignments) {
		const facultyMember = faculty.find((m) => m.id === facultyId);
		const facultyName = facultyMember ? `${facultyMember.lastName}, ${facultyMember.firstName}` : `Faculty #${facultyId}`;
		const assignmentType = facultyMember?.isPlaceholder ? 'PLACEHOLDER_TEACHER' : 'REAL_TEACHER';
		for (const [subjectId, sectionIds] of subjectMap_) {
			const subjectRow_ = subjects.find((s) => s.id === subjectId);
			for (const sectionId of sectionIds) {
				const sectionMeta_ = sectionMeta.get(sectionId);
				suggestedRows.push({
					subjectId,
					subjectCode: subjectRow_?.code ?? `Subject #${subjectId}`,
					subjectName: subjectRow_?.name ?? `Subject #${subjectId}`,
					sectionId,
					sectionName: sectionMeta_?.sectionName ?? `Section ${sectionId}`,
					facultyId,
					facultyName,
					assignmentType,
					warning: null,
				});
			}
		}
	}

	// 3. TEMPORARY_SUBSTITUTE: unresolved pairs (in substitute mode, these will get placeholder teachers)
	if (coverageMode === 'REAL_FACULTY_THEN_TEACHER_X') {
		for (const pair of unresolvedPairs) {
			suggestedRows.push({
				subjectId: pair.subjectId,
				subjectCode: pair.subject.code,
				subjectName: pair.subject.name,
				sectionId: pair.sectionId,
				sectionName: pair.sectionName,
				facultyId: null,
				facultyName: 'Temporary substitute',
				assignmentType: 'TEMPORARY_SUBSTITUTE',
				warning: null,
			});
		}
	}

	const distribution = await buildTeachingLoadDistributionPlan({
		schoolId,
		schoolYearId,
		authToken,
		preserved,
		unresolved: finalUnresolved,
		suggestedRows,
		placementSession,
	});

	if (distribution.summary.aboveStandardFaculty > 0) {
		warnings.push(
			`Distribution: ${distribution.summary.aboveStandardFaculty} teacher${distribution.summary.aboveStandardFaculty === 1 ? '' : 's'} are above the teaching standard. `
			+ `${distribution.summary.proposedMoves} exact reallocation move${distribution.summary.proposedMoves === 1 ? '' : 's'} proposed to qualified same-department receivers; `
			+ `${distribution.summary.unresolvedImbalance} imbalance row${distribution.summary.unresolvedImbalance === 1 ? '' : 's'} remain unresolved.`,
		);
	}

	// TL-SHORTAGE-C02 item 2 (correction R1 / B1): PERSISTED assignments only.
	// A distribution INSERT is exactly what a reviewed apply writes as a
	// `subjectSectionOwnership` row, so this count equals what apply persists.
	// A `TEMPORARY_SUBSTITUTE` row has `facultyId: null`, is stripped from the
	// plan in `buildTeachingLoadDistributionPlan`, and is therefore never an
	// INSERT — it must not be counted here. The substitute reporting is
	// unchanged and still truthful in `teacherXResolution`
	// (`rowsClosedByTeacherX` / `unsavedSubstituteRows`), and the real
	// uncovered count is `stillNeedRealTeacher`.
	const created = distribution.inserts.length;
	const uniqueTeachersAffected = new Set<number>(
		distribution.inserts.map((insert) => insert.facultyId),
	).size;

	return {
		preserved,
		created,
		assignmentsCreated: created,
		uniqueTeachersAffected,
		unresolved: finalUnresolved,
		stillNeedRealTeacher,
		coverageMode,
		warnings,
		sectionSource: sectionResult.source,
		sectionFallbackReason: sectionResult.fallbackReason ?? null,
		staffingReport,
		staffingTruth,
		teacherXResolution,
		suggestedRows,
		candidateRejections: autoFillCandidateRejections,
		preferenceNotices: autoFillPreferenceNotices,
		shiftCoherenceNotices: autoFillShiftCoherenceNotices,
		distribution,
		derivedDemandRevision: derivedDemand.revision,
		canonicalDemandPairCount: canonicalPairs.length,
		outsideDemandOwnershipCount: outsideDemandOwnershipRows.length,
	};
}

function aggregateCoverageRows(rows: Array<{ relevantSectionCount: number; ownedSectionCount: number; uncoveredSectionCount: number }>) {
	return rows.reduce(
		(accumulator, row) => ({
			totalPairs: accumulator.totalPairs + Math.max(0, row.relevantSectionCount),
			assignedPairs: accumulator.assignedPairs + Math.max(0, row.ownedSectionCount),
			unassignedPairs: accumulator.unassignedPairs + Math.max(0, row.uncoveredSectionCount),
		}),
		{ totalPairs: 0, assignedPairs: 0, unassignedPairs: 0 },
	);
}

function filterCoverageRowsForSplitBrain<T extends { subjectCode: string }>(rows: T[]): T[] {
	return rows.filter((row) => row.subjectCode !== HG_SUBJECT_CODE);
}

const BLOCKING_SPLIT_BRAIN_REASON_CODES = new Set<TeachingLoadSplitBrainReasonCode>([
	'ASSIGNED_PAIR_MISMATCH',
	'UNASSIGNED_PAIR_MISMATCH',
	'TOTAL_PAIR_MISMATCH',
	'FACULTY_LOAD_OUTLIER',
	'INTEGRITY_MISSING_OWNERSHIP',
	'INTEGRITY_OWNERSHIP_WITHOUT_SCOPE',
	'STALE_OWNERSHIP_PRESENT',
]);

function resolveSplitBrainQuarantine(reasonCodes: TeachingLoadSplitBrainReasonCode[]): {
	required: boolean;
	severity: TeachingLoadSplitBrainReconcileResult['quarantine']['severity'];
} {
	const hasBlockingReason = reasonCodes.some((code) => BLOCKING_SPLIT_BRAIN_REASON_CODES.has(code));
	if (hasBlockingReason) {
		return {
			required: true,
			severity: 'BLOCKING',
		};
	}

	if (reasonCodes.length > 0) {
		return {
			required: false,
			severity: 'WARNING',
		};
	}

	return {
		required: false,
		severity: 'NONE',
	};
}

export function __testAggregateSplitBrainCoverageTotals(
	rows: Array<{ subjectCode: string; relevantSectionCount: number; ownedSectionCount: number; uncoveredSectionCount: number }>,
) {
	return aggregateCoverageRows(filterCoverageRowsForSplitBrain(rows));
}

export function __testResolveSplitBrainQuarantine(reasonCodes: TeachingLoadSplitBrainReasonCode[]) {
	return resolveSplitBrainQuarantine(reasonCodes);
}

export async function previewOrApplyTeachingLoadSplitBrainReconcile(
	input: TeachingLoadSplitBrainReconcileInput,
): Promise<TeachingLoadSplitBrainReconcileResult> {
	const apply = input.previewOnly === false;

	const [beforeSummary, beforeCoverage] = await Promise.all([
		getAssignmentSummary(input.schoolId, input.schoolYearId, input.authToken),
		getActiveSubjectCoverageSummary(input.schoolId, input.schoolYearId, input.authToken),
	]);

	const [truthReconcile, staleReconcile, realFacultyRecovery] = await Promise.all([
		previewOrApplyTeachingLoadTruthReconcile({
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			actorId: input.actorId,
			authToken: input.authToken,
			previewOnly: !apply,
		}),
		previewOrApplyStaleOwnershipReconcile({
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			actorId: input.actorId,
			authToken: input.authToken,
			previewOnly: !apply,
		}),
		previewOrApplyRealFacultyRecovery({
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			actorId: input.actorId,
			authToken: input.authToken,
			apply,
		}),
	]);

	const [finalSummary, finalCoverage] = apply
		? await Promise.all([
			getAssignmentSummary(input.schoolId, input.schoolYearId, input.authToken),
			getActiveSubjectCoverageSummary(input.schoolId, input.schoolYearId, input.authToken),
		])
		: [beforeSummary, beforeCoverage];

	const summaryTotals = finalSummary.coverageTotals;
	const coverageRowsForComparison = filterCoverageRowsForSplitBrain(finalCoverage.rows);
	const coverageTotals = aggregateCoverageRows(coverageRowsForComparison);
	const assignmentPairDelta = summaryTotals.assignedPairs - coverageTotals.assignedPairs;
	const unassignedPairDelta = summaryTotals.unassignedPairs - coverageTotals.unassignedPairs;
	const totalPairDelta = summaryTotals.totalPairs - coverageTotals.totalPairs;

	const specialProgramApprovalQueue: TeachingLoadSplitBrainApprovalRequiredCandidate[] = [];

	const truthRowsPending = finalSummary.faculty.reduce(
		(total, facultyRow) =>
			total
			+ facultyRow.assignments.filter((assignment) =>
				(assignment.missingOwnershipSectionCount ?? 0) > 0
				|| (assignment.ownershipWithoutScopeSectionCount ?? 0) > 0
				|| (assignment.outOfSubjectScopeSectionCount ?? 0) > 0,
			).length,
		0,
	);
	const truthRowsWithOutOfSubjectScopePending = finalSummary.faculty.reduce(
		(total, facultyRow) =>
			total
			+ facultyRow.assignments.filter(
				(assignment) => (assignment.outOfSubjectScopeSectionCount ?? 0) > 0,
			).length,
		0,
	);
	const truthOutOfSubjectScopePairCountPending = finalSummary.faculty.reduce(
		(total, facultyRow) =>
			total
			+ facultyRow.assignments.reduce(
				(assignmentTotal, assignment) => assignmentTotal + (assignment.outOfSubjectScopeSectionCount ?? 0),
				0,
			),
		0,
	);
	const pendingRealFacultyMoves = apply
		? Math.max(0, realFacultyRecovery.placeholderMovesPlanned - realFacultyRecovery.placeholderMovesApplied)
		: realFacultyRecovery.placeholderMovesPlanned;

	const approvalFacultyIdSet = new Set(specialProgramApprovalQueue.map((candidate) => candidate.facultyId));
	const overloadedFacultyRows = finalSummary.faculty
		.filter((facultyRow) => !facultyRow.isPlaceholder)
		.filter((facultyRow) => (Number(facultyRow.maxHoursPerWeek) || 0) > 0)
		.filter((facultyRow) => (Number(facultyRow.policyCreditedHours) || 0) > (Number(facultyRow.maxHoursPerWeek) || 0) + 0.1);
	const approvalLinkedLoadRows = overloadedFacultyRows.filter((facultyRow) => approvalFacultyIdSet.has(facultyRow.id));
	const nonApprovalOverloadRows = overloadedFacultyRows.filter((facultyRow) => !approvalFacultyIdSet.has(facultyRow.id));
	const trueLoadOutlierRows = nonApprovalOverloadRows.filter((facultyRow) => {
		const maxHours = Number(facultyRow.maxHoursPerWeek) || 0;
		const policyHours = Number(facultyRow.policyCreditedHours) || 0;
		const overloadHours = Math.max(0, (Number(facultyRow.policyCreditedHours) || 0) - maxHours);
		const isMultiplierOutlier = maxHours > 0 && policyHours >= maxHours * TRUE_LOAD_OUTLIER_POLICY_MULTIPLIER;
		return overloadHours >= TRUE_LOAD_OUTLIER_OVERLOAD_HOURS || isMultiplierOutlier;
	});
	const trueLoadOutlierFacultyIdSet = new Set(trueLoadOutlierRows.map((facultyRow) => facultyRow.id));
	const loadReviewRows = nonApprovalOverloadRows.filter((facultyRow) => !trueLoadOutlierFacultyIdSet.has(facultyRow.id));
	const overloadedFacultyDiagnostics: TeachingLoadSplitBrainOutlierFacultyRow[] = trueLoadOutlierRows
		.map((facultyRow) => ({
			facultyId: facultyRow.id,
			facultyName: `${facultyRow.firstName ?? ''} ${facultyRow.lastName ?? ''}`.trim() || `Faculty #${facultyRow.id}`,
			policyCreditedHours: Number(facultyRow.policyCreditedHours) || 0,
			maxHoursPerWeek: Number(facultyRow.maxHoursPerWeek) || 0,
			overloadHours: Math.max(0, (Number(facultyRow.policyCreditedHours) || 0) - (Number(facultyRow.maxHoursPerWeek) || 0)),
			subjectCodes: facultyRow.assignments.map((assignment) => assignment.subject.code),
		}))
		.sort((left, right) => right.overloadHours - left.overloadHours || left.facultyName.localeCompare(right.facultyName))
		.slice(0, 25);

	const reasonCodes: TeachingLoadSplitBrainReasonCode[] = [];
	if (assignmentPairDelta !== 0) reasonCodes.push('ASSIGNED_PAIR_MISMATCH');
	if (unassignedPairDelta !== 0) reasonCodes.push('UNASSIGNED_PAIR_MISMATCH');
	if (totalPairDelta !== 0) reasonCodes.push('TOTAL_PAIR_MISMATCH');
	if ((finalSummary.integrityDiagnostics.currentYearMissingOwnershipPairs ?? 0) > 0) reasonCodes.push('INTEGRITY_MISSING_OWNERSHIP');
	if ((finalSummary.integrityDiagnostics.currentYearOwnershipWithoutMatchingScopePairs ?? 0) > 0) {
		reasonCodes.push('INTEGRITY_OWNERSHIP_WITHOUT_SCOPE');
	}
	if ((finalSummary.integrityDiagnostics.currentYearOutOfSubjectScopePairs ?? 0) > 0) {
		reasonCodes.push('INTEGRITY_OUT_OF_SUBJECT_SCOPE');
	}
	if ((finalSummary.integrityDiagnostics.staleOwnedCurrentYearPairCount ?? 0) > 0) reasonCodes.push('STALE_OWNERSHIP_PRESENT');
	if (trueLoadOutlierRows.length > 0) reasonCodes.push('FACULTY_LOAD_OUTLIER');
	if (loadReviewRows.length > 0) reasonCodes.push('FACULTY_LOAD_REVIEW_REQUIRED');
	if (truthRowsPending > 0) reasonCodes.push('TRUTH_RECONCILE_PENDING');
	if (pendingRealFacultyMoves > 0) reasonCodes.push('REAL_FACULTY_RECOVERY_PENDING');
	if (realFacultyRecovery.blockers.length > 0) reasonCodes.push('REAL_FACULTY_RECOVERY_BLOCKERS');
	const dedupedReasonCodes = [...new Set(reasonCodes)];
	const quarantine = resolveSplitBrainQuarantine(dedupedReasonCodes);

	return {
		applied: apply,
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		quarantine: {
			required: quarantine.required,
			severity: quarantine.severity,
			reasonCodes: dedupedReasonCodes,
			message: quarantine.required
				? 'Teaching Load data truth is inconsistent. Quarantine assignment edits until reconcile actions are applied.'
				: dedupedReasonCodes.length > 0
				? 'Teaching Load has warnings that require scheduler review before final publish.'
				: 'Teaching Load data paths are currently consistent.',
		},
		counters: {
			summaryAssignedPairs: summaryTotals.assignedPairs,
			summaryUnassignedPairs: summaryTotals.unassignedPairs,
			summaryTotalPairs: summaryTotals.totalPairs,
			coverageAssignedPairs: coverageTotals.assignedPairs,
			coverageUnassignedPairs: coverageTotals.unassignedPairs,
			coverageTotalPairs: coverageTotals.totalPairs,
			assignmentPairDelta,
			unassignedPairDelta,
			totalPairDelta,
			integrityMissingOwnershipPairs: finalSummary.integrityDiagnostics.currentYearMissingOwnershipPairs ?? 0,
			integrityOwnershipWithoutScopePairs: finalSummary.integrityDiagnostics.currentYearOwnershipWithoutMatchingScopePairs ?? 0,
			integrityOutOfSubjectScopePairs: finalSummary.integrityDiagnostics.currentYearOutOfSubjectScopePairs ?? 0,
			staleOwnedCurrentYearPairs: finalSummary.integrityDiagnostics.staleOwnedCurrentYearPairCount ?? 0,
			overloadedFacultyRows: trueLoadOutlierRows.length,
			trueLoadOutlierRows: trueLoadOutlierRows.length,
			loadReviewRows: loadReviewRows.length,
			approvalLinkedLoadRows: approvalLinkedLoadRows.length,
			truthRowsToUpdate: truthRowsPending,
			realFacultyMovesPlanned: pendingRealFacultyMoves,
			realFacultyBlockers: realFacultyRecovery.blockers.length,
			specialProgramApprovalCandidates: specialProgramApprovalQueue.length,
		},
		repairPreview: {
			truthReconcile: {
				rowsToUpdate: truthRowsPending,
				updatedRows: truthReconcile.updatedRows,
				rowsWithOutOfSubjectScope: truthRowsWithOutOfSubjectScopePending,
				outOfSubjectScopePairCount: truthOutOfSubjectScopePairCountPending,
			},
			staleReconcile: {
				staleOwnedCurrentYearPairCount: staleReconcile.staleOwnedCurrentYearPairCount,
				deletedOwnershipRows: staleReconcile.deletedOwnershipRows,
			},
			realFacultyRecovery: {
				placeholderMovesPlanned: realFacultyRecovery.placeholderMovesPlanned,
				placeholderMovesApplied: realFacultyRecovery.placeholderMovesApplied,
				blockerCount: realFacultyRecovery.blockers.length,
				blockers: realFacultyRecovery.blockers.slice(0, 25).map((blocker) => ({
					subjectCode: blocker.subjectCode,
					sectionId: blocker.sectionId,
					category: blocker.category,
					reason: blocker.reason,
				})),
			},
			integrity: {
				missingOwnershipSamples: finalSummary.integrityDiagnostics.missingOwnershipSamples,
				ownershipWithoutScopeSamples: finalSummary.integrityDiagnostics.ownershipWithoutScopeSamples,
				outOfSubjectScopeSamples: finalSummary.integrityDiagnostics.outOfSubjectScopeSamples,
			},
			loadOutliers: {
				rows: overloadedFacultyDiagnostics,
			},
		},
		specialProgramApprovalQueue,
	};
}

// ─── Over-Cap Rebalance (Fix C) ─────────────────────────────────────────────

export interface OverCapRebalanceInput {
	schoolId: number;
	schoolYearId: number;
	actorId: number;
	actorSchoolId?: number | null;
	authToken?: string;
	previewOnly?: boolean;
	/**
	 * Bind canonical derived-demand resolution to this client. The mounted routes
	 * leave it undefined so the ambient data context is used; an apply re-resolves
	 * inside its Serializable transaction through the transaction client.
	 */
	client?: unknown;
	/** Shares accepted suggestion reservations with previewed distribution moves. */
	placementSession?: PlacementPlanningSession;
}

export interface OverCapRebalanceMove {
	ownershipId: number;
	facultySubjectId: number;
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	sectionId: number;
	sectionName: string;
	fromFacultyId: number;
	fromFacultyName: string;
	toFacultyId: number;
	toFacultyName: string;
	minutes: number;
	/** Qualification tier the reviewed receiver matched at preview time. */
	toQualificationTier: number;
	/** Exact authority branch that granted receiver eligibility. */
	toQualificationAuthority: TeachingLoadQualificationAuthority;
}

export interface OverCapRebalanceFacultyDetail {
	facultyId: number;
	facultyName: string;
	teachingMinutes: number;
	nonTeachingMinutes: number;
	totalCreditedMinutes: number;
	capMinutes: number;
	overMinutes: number;
}

export interface OverCapRebalanceResult {
	applied: boolean;
	schoolId: number;
	schoolYearId: number;
	overCapFaculty: OverCapRebalanceFacultyDetail[];
	proposedMoves: OverCapRebalanceMove[];
	movesApplied: number;
	ownershipRowsMoved: number;
	facultySubjectRowsUpdated: number;
	facultyMirrorVersionsBumped: number;
	/** Sections the evaluator resolved. 0 means distribution was not evaluated. */
	sectionsResolved: number;
	/** Effective persisted workload policy used for this evaluation. */
	policy: EffectiveWorkloadPolicy | null;
	/** True only when a persisted effective policy was resolved and evaluated. */
	evaluated: boolean;
	/** Bounded, stable diagnostics explaining why receivers were skipped. */
	candidateRejections: TeachingLoadCandidateRejection[];
	/** Canonical `DERIVED_DEMAND_V2` revision that produced this rebalance. */
	derivedDemandRevision?: string;
	/** Exact canonical (SCHEDULED_TEACHING) pair count consumed as demand authority. */
	canonicalDemandPairCount?: number;
	/** Current-year ownership rows outside canonical demand, excluded from minutes/moves. */
	outsideDemandOwnershipCount?: number;
}

export async function previewOrApplyOverCapRebalance(
	input: OverCapRebalanceInput,
): Promise<OverCapRebalanceResult> {
	const apply = input.previewOnly === false;
	if (apply) {
		await assertTeachingLoadWriteAuthority({
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			actorSchoolId: input.actorSchoolId ?? null,
		});
	}

	// Canonical derived demand is the sole current-year pair authority for
	// over-cap minutes, move targets, and the apply revalidation. A missing or
	// malformed ordered-term authority fails closed with the typed
	// DERIVED_DEMAND_UNAVAILABLE contract before any capacity or move work.
	const derivedDemand = await resolveSuggestionDerivedDemand(input.schoolId, input.schoolYearId, input.client);

	// The accepted Teaching Load contract is driven by the current persisted
	// effective policy, never a module-level default. An UNCONFIGURED policy
	// means distribution cannot be judged, so the evaluator reports unevaluated
	// and proposes no move (fail closed, zero writes).
	const policyResolution = await getEffectiveWorkloadPolicyFromClient(
		db() as any,
		input.schoolId,
		input.schoolYearId,
	);
	const effectivePolicy = policyResolution.policy;
	const effectiveStandardMinutes = effectivePolicy?.teachingStandardMinutes ?? null;

	const sectionResult = await fetchSectionsForRuntimeControls(input.schoolId, input.schoolYearId, {
		authToken: input.authToken,
		preferLocalEvidenceFirst: true,
	});
	const allSectionIds: number[] = [];
	for (const grade of sectionResult.gradeLevels) {
		for (const section of grade.sections) {
			if (section.id > 0) allSectionIds.push(section.id);
		}
	}
	if (allSectionIds.length === 0 || effectiveStandardMinutes == null) {
		return {
			applied: false,
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			overCapFaculty: [],
			proposedMoves: [],
			candidateRejections: [],
			movesApplied: 0,
			ownershipRowsMoved: 0,
			facultySubjectRowsUpdated: 0,
			facultyMirrorVersionsBumped: 0,
			sectionsResolved: allSectionIds.length,
			policy: effectivePolicy,
			evaluated: false,
			derivedDemandRevision: derivedDemand.revision,
			canonicalDemandPairCount: derivedDemand.totalPairs,
			outsideDemandOwnershipCount: 0,
		};
	}

	// Stale ownership must be inspected without mutation before capacity
	// computation. An apply cannot repair it here: doing so would commit writes
	// before the later Serializable canonical-revision revalidation.
	const staleOwnershipPreview = await previewOrApplyStaleOwnershipReconcile({
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		actorId: input.actorId,
		authToken: input.authToken,
		previewOnly: true,
	});
	if (apply && staleOwnershipPreview.staleOwnedCurrentYearPairCount > 0) {
		const error = new Error(
			'Teaching Load contains stale ownership. Reconcile stale ownership before applying an over-cap rebalance.',
		) as Error & { statusCode: number; code: string };
		error.statusCode = 409;
		error.code = 'TEACHING_LOAD_STALE_OWNERSHIP_RECONCILIATION_REQUIRED';
		throw error;
	}

	const [faculty, subjects, existingOwnerships] = await Promise.all([
		db().facultyMirror.findMany({
			where: { schoolId: input.schoolId, isStale: false, isActiveForScheduling: true },
			select: {
				id: true,
				firstName: true,
				lastName: true,
				department: true,
				specialization: true,
				canTeachOutsideDepartment: true,
				maxHoursPerWeek: true,
				isPlaceholder: true,
				isClassAdviser: true,
				advisoryEquivalentHours: true,
				ancillaryMinutesPerWeek: true,
				advisedSectionId: true,
			},
		}),
		db().subject.findMany({
			where: { schoolId: input.schoolId, isActive: true, code: { notIn: [...NON_DEMAND_SUBJECT_CODES] } },
			select: {
				id: true,
				code: true,
				name: true,
				rotationFamily: true,
				gradeLevels: true,
				programScopes: true,
				minMinutesPerWeek: true,
				modularGroupId: true,
				modularOrder: true,
				termGroupId: true,
				termCount: true,
				ownerDepartment: true,
				requiredFeatures: true,
				allowedSpecializations: true,
				schedulingDisposition: true,
			},
		}),
		db().subjectSectionOwnership.findMany({
			where: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				sectionId: { in: allSectionIds },
			},
			orderBy: [{ id: 'asc' }],
			select: {
				id: true,
				subjectId: true,
				sectionId: true,
				facultyId: true,
				facultySubjectId: true,
				facultySubject: {
					select: {
						assignedBy: true,
						subject: {
							select: {
								id: true,
								code: true,
								modularGroupId: true,
								modularOrder: true,
								termGroupId: true,
								termCount: true,
								rotationFamily: true,
								minMinutesPerWeek: true,
							},
						},
					},
				},
			},
		}),
	]);

	const realFaculty = faculty.filter((m) => !m.isPlaceholder);
	const currentYearSectionIdSet = new Set(allSectionIds);
	const subjectById = new Map(subjects.map((s) => [s.id, s]));

	// Compute non-teaching minutes per faculty
	const nonTeachingMinutesByFaculty = new Map<number, number>();
	for (const member of faculty) {
		if (member.isPlaceholder) continue;
		const isValidAdviser =
			member.isClassAdviser &&
			member.advisedSectionId != null &&
			currentYearSectionIdSet.has(member.advisedSectionId);
		const advisoryMinutes = isValidAdviser
			? Math.max(0, Math.round((member.advisoryEquivalentHours ?? 0) * 60))
			: 0;
		const ancillaryMinutes = Math.max(0, Math.round(member.ancillaryMinutesPerWeek ?? 0));
		const total = advisoryMinutes + ancillaryMinutes;
		if (total > 0) nonTeachingMinutesByFaculty.set(member.id, total);
	}

	// Build capacity tracking from existing ownerships.
	// HG is covered by the advisory credit, ARAL is an excluded program, and a
	// REFERENCE_ONLY subject creates no ordinary teaching minutes. Exclude all
	// three from the capacity ledger and from every move target.
	const nonDemandSubjectRowsForRebalance = await db().subject.findMany({
		where: {
			schoolId: input.schoolId,
			OR: [{ code: { in: [...NON_DEMAND_SUBJECT_CODES] } }, { schedulingDisposition: 'REFERENCE_ONLY' }],
		},
		select: { id: true },
	});
	const nonDemandSubjectIdSetForRebalance = new Set(nonDemandSubjectRowsForRebalance.map((row) => row.id));

	// Canonical pair authority: only SCHEDULED_TEACHING subject x active-section
	// pairs whose normalized grade/program scope matches and whose ordered-term
	// rotation is valid count as ordinary over-cap minutes or move targets.
	// Ownership outside canonical demand is excluded from capacity and never
	// proposed; it is counted and surfaced as a bounded diagnostic.
	const canonicalPairKeySetForRebalance = new Set<string>(
		derivedDemand.teachingLoadPairs
			.filter((pair) => subjectById.has(pair.subjectId))
			.map((pair) => `${pair.subjectId}:${pair.sectionExternalId}`),
	);
	const canonicalOwnershipRowsForRebalance = existingOwnerships.filter((o) =>
		canonicalPairKeySetForRebalance.has(`${o.subjectId}:${o.sectionId}`),
	);
	const outsideDemandOwnershipRowsForRebalance = existingOwnerships.filter(
		(o) => !canonicalPairKeySetForRebalance.has(`${o.subjectId}:${o.sectionId}`),
	);
	const outsideDemandOwnershipCount = outsideDemandOwnershipRowsForRebalance.length;
	const nonDemandOwnershipRowsForRebalance = canonicalOwnershipRowsForRebalance.filter(
		(o) => !nonDemandSubjectIdSetForRebalance.has(o.subjectId),
	);
	const realOwnershipRows = nonDemandOwnershipRowsForRebalance.filter((o) => realFaculty.some((f) => f.id === o.facultyId));
	const { capacityUsed } = buildInitialCapacityTracking(realOwnershipRows as ExistingOwnershipRow[]);

	// Detect over-cap faculty from ACTUAL teaching minutes against the ONE
	// shared applicable cap (TL-SHORTAGE-C02 item 5). This replaces the previous
	// `teachingMinutes > effectiveStandardMinutes`, which compared against the
	// school 30h standard and never consulted `maxHoursPerWeek` — the reason the
	// generator reported 5 teachers over limit while Teaching Load reported 0.
	// Advisory/ancillary credit remains neutral: it is reported as credited
	// workload but can never make a teacher over the applicable cap.
	const overCapFaculty: OverCapRebalanceFacultyDetail[] = [];
	for (const member of realFaculty) {
		const teachingMinutes = capacityUsed.get(member.id) ?? 0;
		const nonTeachingMinutes = nonTeachingMinutesByFaculty.get(member.id) ?? 0;
		const evaluation = evaluateWeeklyLoad(teachingMinutes, {
			maxHoursPerWeek: member.maxHoursPerWeek,
			ancillaryMinutesPerWeek: member.ancillaryMinutesPerWeek,
		});
		if (evaluation.isOverLimit) {
			overCapFaculty.push({
				facultyId: member.id,
				facultyName: `${member.lastName}, ${member.firstName}`,
				teachingMinutes,
				nonTeachingMinutes,
				totalCreditedMinutes: teachingMinutes + nonTeachingMinutes,
				capMinutes: evaluation.capMinutes,
				overMinutes: evaluation.overMinutes,
			});
		}
	}
	overCapFaculty.sort((a, b) => (b.overMinutes - a.overMinutes) || (a.facultyId - b.facultyId));

	if (overCapFaculty.length === 0) {
		return {
			applied: false,
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			overCapFaculty: [],
			proposedMoves: [],
			candidateRejections: [],
			movesApplied: 0,
			ownershipRowsMoved: 0,
			facultySubjectRowsUpdated: 0,
			facultyMirrorVersionsBumped: 0,
			sectionsResolved: allSectionIds.length,
			policy: effectivePolicy,
			evaluated: true,
			derivedDemandRevision: derivedDemand.revision,
			canonicalDemandPairCount: derivedDemand.totalPairs,
			outsideDemandOwnershipCount,
		};
	}

	// Receiver selection uses the SAME persisted-only qualification snapshot as
	// canonical reconciliation and the coverage path: department aliases/labels,
	// subject owner prefixes, explicit cross-department permissions, and
	// specialization aliases. Legacy prefix/glossary/name inference is disabled.
	const qualificationAuthority = await loadPersistedQualificationAuthority(input.schoolId);
	// Reuse the suggestion session when present. Standalone redistribution
	// previews prepare the same generator-aligned snapshot once for move search.
	const placementSession = input.placementSession ?? (await prepareTeachingLoadPlacementPlanner(
		input.schoolId,
		input.schoolYearId,
	)).begin(new Map(faculty.map((member) => [member.id, `${member.lastName}, ${member.firstName}`])));

	// Build section name + program-type maps
	const sectionNameMap = new Map<number, string>();
	const sectionProgramTypeMap = new Map<number, string>();
	for (const grade of sectionResult.gradeLevels) {
		for (const section of grade.sections) {
			if (section.id > 0) {
				sectionNameMap.set(section.id, section.name);
				sectionProgramTypeMap.set(section.id, section.programType ?? 'REGULAR');
			}
		}
	}

	// Build a mutable capacity map for simulating moves
	const simCapacityUsed = new Map<number, number>(capacityUsed);

	const proposedMoves: OverCapRebalanceMove[] = [];
	const candidateRejections: TeachingLoadCandidateRejection[] = [];
	// Placeholder/inactive faculty are part of the school roster and are reported
	// transparently when they are not receivers; they never become candidates.
	const facultyCandidatesByStableId = [...faculty].sort((left, right) => left.id - right.id);

	// For each over-cap faculty, propose moves to bring them under cap
	for (const overFaculty of overCapFaculty) {
		const ownerships = existingOwnerships.filter((o) => o.facultyId === overFaculty.facultyId);
		// Sort by minutes descending (move biggest loads first)
		const ownershipsWithMinutes = ownerships
			.map((o) => {
				const subject = subjectById.get(o.subjectId);
				return { ownership: o, minutes: subject ? Math.max(0, Number(subject.minMinutesPerWeek) || 0) : 0 };
			})
			.filter((entry) => entry.minutes > 0)
			.sort((a, b) => (b.minutes - a.minutes) || (a.ownership.id - b.ownership.id));

		let remainingOverMinutes = overFaculty.overMinutes;

		for (const { ownership, minutes } of ownershipsWithMinutes) {
			if (remainingOverMinutes <= 0) break;

			const subject = subjectById.get(ownership.subjectId);
			if (!subject) continue;

			// HG/advisory, ARAL, and REFERENCE_ONLY ownerships never generate
			// ordinary demand or moves. A reference-only subject must never be an
			// overload move target.
			if (isNonDemandSubjectCode(subject.code)) continue;
			if ((subject as { schedulingDisposition?: string }).schedulingDisposition === 'REFERENCE_ONLY') continue;

			// Canonical gate: only a pair produced by canonical derived demand may
			// become an ordinary move target. Out-of-scope legacy ownership is still
			// evaluated so its bounded receiver diagnostics remain visible, but it is
			// excluded from capacity and can never enter proposedMoves.
			const isCanonicalOwnership = canonicalPairKeySetForRebalance.has(`${ownership.subjectId}:${ownership.sectionId}`);

			const sectionProgramType = sectionProgramTypeMap.get(ownership.sectionId) ?? 'REGULAR';
			const ownershipRejections: TeachingLoadCandidateRejection[] = [];

			const eligibleReceivers: Array<{
				candidate: typeof realFaculty[number];
				tier: number;
				authority: TeachingLoadQualificationAuthority;
				spareMinutes: number;
				adviserPreference: boolean;
			}> = [];

			for (const candidate of facultyCandidatesByStableId) {
				if (candidate.id === overFaculty.facultyId) {
					ownershipRejections.push({
						subjectId: subject.id,
						subjectCode: subject.code,
						sectionId: ownership.sectionId,
						sectionName: sectionNameMap.get(ownership.sectionId) ?? `Section ${ownership.sectionId}`,
						facultyId: candidate.id,
						facultyName: `${candidate.lastName}, ${candidate.firstName}`,
						reason: 'CURRENT_OWNER',
					});
					continue;
				}
				if (candidate.isPlaceholder) {
					ownershipRejections.push({
						subjectId: subject.id,
						subjectCode: subject.code,
						sectionId: ownership.sectionId,
						sectionName: sectionNameMap.get(ownership.sectionId) ?? `Section ${ownership.sectionId}`,
						facultyId: candidate.id,
						facultyName: `${candidate.lastName}, ${candidate.firstName}`,
						reason: 'PLACEHOLDER_FACULTY',
					});
					continue;
				}

				const qualification = evaluateCanonicalTeachingLoadQualification(
					candidate,
					subject,
					sectionProgramType,
					qualificationAuthority,
				);
				const tier = qualification.tier;
				if (tier == null || qualification.authority == null) {
					ownershipRejections.push({
						subjectId: subject.id,
						subjectCode: subject.code,
						sectionId: ownership.sectionId,
						sectionName: sectionNameMap.get(ownership.sectionId) ?? `Section ${ownership.sectionId}`,
						facultyId: candidate.id,
						facultyName: `${candidate.lastName}, ${candidate.firstName}`,
						reason: qualification.reason === 'PROGRAM_SCOPE_INCOMPATIBLE' ? 'PROGRAM_SCOPE_INCOMPATIBLE' : 'NOT_QUALIFIED',
					});
					continue;
				}

				const candidateTeaching = simCapacityUsed.get(candidate.id) ?? 0;
				// TL-SHORTAGE-C02 item 5 (correction R1 / B2): receiver eligibility
				// and over-cap reporting are now ONE decision, made by the ONE
				// shared evaluation.
				//
				// This previously re-derived the cap inline as
				// `min(maxHours*60, effectiveStandardMinutes)`, which ignored the
				// teacher's own contract and their ancillary credit, while the
				// over-cap report above judged the same teacher by
				// `evaluateWeeklyLoad`. A 30h teacher carrying 600 ancillary
				// minutes was reported OVER cap (1440 teaching vs a 1200
				// applicable cap) and, in the same run, still received a move
				// because the retired gate saw 1800-1440 = 360 spare minutes.
				// Routing both through `evaluateWeeklyLoad` makes the coherence
				// rule structural: a receiver this evaluation calls over limit
				// has no spare capacity, so `spareMinutes < minutes` rejects them
				// with the same `HARD_CAP_EXCEEDED` reason as any other
				// over-committed teacher. No separate guard is needed, and a
				// second copy of the cap rule cannot reappear here.
				const candidateEvaluation = evaluateWeeklyLoad(candidateTeaching, {
					maxHoursPerWeek: candidate.maxHoursPerWeek,
					ancillaryMinutesPerWeek: candidate.ancillaryMinutesPerWeek,
				});
				const spareMinutes = candidateEvaluation.capMinutes - candidateTeaching;
				if (spareMinutes < minutes) {
					ownershipRejections.push({
						subjectId: subject.id,
						subjectCode: subject.code,
						sectionId: ownership.sectionId,
						sectionName: sectionNameMap.get(ownership.sectionId) ?? `Section ${ownership.sectionId}`,
						facultyId: candidate.id,
						facultyName: `${candidate.lastName}, ${candidate.firstName}`,
						reason: 'HARD_CAP_EXCEEDED',
					});
					continue;
				}

				const isAdviserForSection = candidate.isClassAdviser === true && candidate.advisedSectionId === ownership.sectionId;
				const hasRealPairForSection = existingOwnerships.some(
					(existing) => existing.facultyId === candidate.id
						&& existing.sectionId === ownership.sectionId
						&& !isNonDemandSubjectCode(subjectById.get(existing.subjectId)?.code),
				);
				const adviserPreference = isAdviserForSection && !hasRealPairForSection;

				eligibleReceivers.push({ candidate, tier, authority: qualification.authority, spareMinutes, adviserPreference });
			}

			// Preserve the established capacity/qualification ordering, then choose
			// the first receiver whose real timetable slots fit. Failed trials never
			// reserve a slot; accepted moves reserve one for the remaining loop.
			eligibleReceivers.sort((left, right) =>
				(left.tier - right.tier)
				|| Number(right.adviserPreference) - Number(left.adviserPreference)
				|| (right.spareMinutes - left.spareMinutes)
				|| (left.candidate.id - right.candidate.id));
			let selectedReceiver = eligibleReceivers[0] ?? null;
			if (placementSession && eligibleReceivers.length > 0) {
				const placementSelection = selectFirstTimetableFeasibleCandidate(
					placementSession,
					{ sectionId: ownership.sectionId, subjectId: ownership.subjectId, replacesExistingPlacement: true },
					eligibleReceivers.map((entry) => entry.candidate.id),
				);
				selectedReceiver = eligibleReceivers.find((entry) => entry.candidate.id === placementSelection.facultyId) ?? null;
				for (const rejected of placementSelection.rejected) {
					appendBoundedCandidateRejections(ownershipRejections, [{
						subjectId: subject.id,
						subjectCode: subject.code,
						sectionId: ownership.sectionId,
						sectionName: sectionNameMap.get(ownership.sectionId) ?? `Section ${ownership.sectionId}`,
						facultyId: rejected.facultyId,
						facultyName: rejected.facultyName,
						reason: 'TIMETABLE_SHAPE_CONFLICT',
						placementReason: rejected.reason,
					}]);
				}
				// Unlike capacity-only tie breaks, a timetable rejection changes the
				// scheduler's next action. Keep it visible even when another receiver
				// can take the move.
				appendBoundedCandidateRejections(candidateRejections, ownershipRejections.filter(
					(rejection) => rejection.reason === 'TIMETABLE_SHAPE_CONFLICT',
				));
			}
			const bestReceiver = selectedReceiver?.candidate ?? null;
			const bestTier = selectedReceiver?.tier ?? Infinity;
			const bestAuthority = selectedReceiver?.authority ?? null;

			if (!bestReceiver) {
				appendBoundedCandidateRejections(candidateRejections, ownershipRejections);
			}

			if (bestReceiver && bestAuthority != null) {
				if (isCanonicalOwnership) {
					proposedMoves.push({
						ownershipId: ownership.id,
						facultySubjectId: ownership.facultySubjectId,
						subjectId: ownership.subjectId,
						subjectCode: subject.code,
						subjectName: subject.name,
						sectionId: ownership.sectionId,
						sectionName: sectionNameMap.get(ownership.sectionId) ?? `Section ${ownership.sectionId}`,
						fromFacultyId: overFaculty.facultyId,
						fromFacultyName: overFaculty.facultyName,
						toFacultyId: bestReceiver.id,
						toFacultyName: `${bestReceiver.lastName}, ${bestReceiver.firstName}`,
						minutes,
						toQualificationTier: bestTier,
						toQualificationAuthority: bestAuthority,
					});

					// Update simulation
					simCapacityUsed.set(overFaculty.facultyId, (simCapacityUsed.get(overFaculty.facultyId) ?? 0) - minutes);
					simCapacityUsed.set(bestReceiver.id, (simCapacityUsed.get(bestReceiver.id) ?? 0) + minutes);
					remainingOverMinutes -= minutes;
				} else {
					// Non-canonical ownership is never moved; report why it is excluded.
					appendBoundedCandidateRejections(candidateRejections, [{
						subjectId: subject.id,
						subjectCode: subject.code,
						sectionId: ownership.sectionId,
						sectionName: sectionNameMap.get(ownership.sectionId) ?? `Section ${ownership.sectionId}`,
						facultyId: bestReceiver.id,
						facultyName: `${bestReceiver.lastName}, ${bestReceiver.firstName}`,
						reason: 'OUTSIDE_CANONICAL_DEMAND',
					}]);
				}
			}
		}
	}

	if (!apply || proposedMoves.length === 0) {
		return {
			applied: false,
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			overCapFaculty,
			proposedMoves,
			candidateRejections,
			movesApplied: 0,
			ownershipRowsMoved: 0,
			facultySubjectRowsUpdated: 0,
			facultyMirrorVersionsBumped: 0,
			sectionsResolved: allSectionIds.length,
			policy: effectivePolicy,
			evaluated: true,
			derivedDemandRevision: derivedDemand.revision,
			canonicalDemandPairCount: derivedDemand.totalPairs,
			outsideDemandOwnershipCount,
		};
	}

	// Apply moves transactionally
	let ownershipRowsMoved = 0;
	let facultySubjectRowsUpdated = 0;
	let facultyMirrorVersionsBumped = 0;
	const affectedFacultyIds = new Set<number>();

	// Serializable isolation (matching the proposal apply) is required so the
	// canonical-revision re-read below is a true freshness boundary: a competing
	// commit between the re-read and commit aborts instead of silently winning.
	await db().$transaction(async (tx) => {
		await assertTeachingLoadWriteAuthority({
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			actorSchoolId: input.actorSchoolId ?? null,
		}, tx as any);

		// Canonical authority is re-resolved inside THIS Serializable transaction
		// through the transaction client. A change to term, disposition, scope,
		// section, or rotation authority since the preview fails typed stale before
		// any ownership, FacultySubject, cycle, or audit write.
		const txDerivedDemand = await resolveSuggestionDerivedDemand(input.schoolId, input.schoolYearId, tx);
		if (txDerivedDemand.revision !== derivedDemand.revision) {
			const stale = new Error('The canonical derived demand changed since this over-cap rebalance preview. Preview a fresh rebalance.') as Error & { statusCode: number; code: string };
			stale.statusCode = 409;
			stale.code = 'TEACHING_LOAD_REBALANCE_STALE';
			throw stale;
		}
		// Group moves by (fromFacultyId, facultySubjectId) for sectionIds recomputation
		const movesByFromFs = new Map<number, OverCapRebalanceMove[]>();
		for (const move of proposedMoves) {
			const key = move.facultySubjectId;
			const arr = movesByFromFs.get(key) ?? [];
			arr.push(move);
			movesByFromFs.set(key, arr);
		}

		// Group moves by (toFacultyId, subjectId) for receiver FacultySubject upsert
		const movesByToFacultySubject = new Map<string, OverCapRebalanceMove[]>();
		for (const move of proposedMoves) {
			const key = `${move.toFacultyId}:${move.subjectId}`;
			const arr = movesByToFacultySubject.get(key) ?? [];
			arr.push(move);
			movesByToFacultySubject.set(key, arr);
		}

		// Step 1: Upsert receiver FacultySubject rows and resolve real facultySubjectIds
		// (must run BEFORE ownership updates — facultySubjectId has an FK constraint
		// and cannot hold a temporary value)
		const receiverFacultySubjectIdByMove = new Map<number, number>();
		for (const [key, moves] of movesByToFacultySubject) {
			const [toFacultyIdStr, subjectIdStr] = key.split(':');
			const toFacultyId = Number(toFacultyIdStr);
			const subjectId = Number(subjectIdStr);
			const sectionIds = moves.map((m) => m.sectionId);

			// Upsert FacultySubject for receiver
			const existingFs = await tx.facultySubject.findUnique({
				where: { facultyId_subjectId_schoolYearId: { facultyId: toFacultyId, subjectId, schoolYearId: input.schoolYearId } },
				select: { id: true, sectionIds: true },
			});

			let facultySubjectId: number;
			if (existingFs) {
				facultySubjectId = existingFs.id;
				const mergedSections = [...new Set([...existingFs.sectionIds, ...sectionIds])].sort((a, b) => a - b);
				await tx.facultySubject.update({
					where: { id: facultySubjectId },
					data: { sectionIds: mergedSections, assignedBy: input.actorId },
				});
			} else {
				const fs = await tx.facultySubject.create({
					data: {
						facultyId: toFacultyId,
						subjectId,
						schoolId: input.schoolId,
						schoolYearId: input.schoolYearId,
						gradeLevels: [],
						sectionIds,
						assignedBy: input.actorId,
					},
					select: { id: true },
				});
				facultySubjectId = fs.id;
			}

			for (const move of moves) {
				receiverFacultySubjectIdByMove.set(move.ownershipId, facultySubjectId);
			}
			facultySubjectRowsUpdated += 1;
		}

		// Step 2: Update ownership rows — reassign to the receiver with the real facultySubjectId
		for (const move of proposedMoves) {
			const receiverFacultySubjectId = receiverFacultySubjectIdByMove.get(move.ownershipId);
			if (receiverFacultySubjectId == null) continue;
			await tx.subjectSectionOwnership.update({
				where: { id: move.ownershipId },
				data: { facultyId: move.toFacultyId, facultySubjectId: receiverFacultySubjectId },
			});
			ownershipRowsMoved += 1;
			affectedFacultyIds.add(move.fromFacultyId);
			affectedFacultyIds.add(move.toFacultyId);
		}

		// Step 3: Update sectionIds on sender FacultySubject rows
		for (const [fsId, moves] of movesByFromFs) {
			const fs = await tx.facultySubject.findUnique({
				where: { id: fsId },
				select: { sectionIds: true },
			});
			if (!fs) continue;
			const movedSectionIds = new Set(moves.map((m) => m.sectionId));
			const remainingSections = fs.sectionIds.filter((sid) => !movedSectionIds.has(sid));
			if (remainingSections.length === 0) {
				await tx.facultySubject.delete({ where: { id: fsId } });
			} else {
				await tx.facultySubject.update({
					where: { id: fsId },
					data: { sectionIds: remainingSections.sort((a, b) => a - b) },
				});
			}
			facultySubjectRowsUpdated += 1;
		}

		await refreshTeachingLoadCycle(input.schoolId, input.schoolYearId, tx);

		// Step 4: Audit log
		await tx.auditLog.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				action: 'TEACHING_LOAD_REBALANCE',
				actorId: input.actorId,
				targetIds: proposedMoves.map((m) => m.ownershipId),
				metadata: {
					moveCount: proposedMoves.length,
					overCapFacultyCount: overCapFaculty.length,
					moves: proposedMoves.map((m) => ({
						ownershipId: m.ownershipId,
						subjectId: m.subjectId,
						sectionId: m.sectionId,
						fromFacultyId: m.fromFacultyId,
						toFacultyId: m.toFacultyId,
						minutes: m.minutes,
					})),
				} as object,
			},
		});
	}, { isolationLevel: 'Serializable' });

	return {
		applied: true,
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		overCapFaculty,
		proposedMoves,
		candidateRejections,
		movesApplied: proposedMoves.length,
		ownershipRowsMoved,
		facultySubjectRowsUpdated,
		facultyMirrorVersionsBumped,
		sectionsResolved: allSectionIds.length,
		policy: effectivePolicy,
		evaluated: true,
		derivedDemandRevision: derivedDemand.revision,
		canonicalDemandPairCount: derivedDemand.totalPairs,
		outsideDemandOwnershipCount,
	};
}
