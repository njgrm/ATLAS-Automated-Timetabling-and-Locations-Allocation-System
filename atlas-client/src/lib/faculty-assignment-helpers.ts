import type { 
	ExternalSection, 
	Subject, 
	FacultySummary,
	LoadStatus,
	FacultyAssignmentDraft,
	FacultyOwnershipState,
	SubjectSectionOwnershipIndexEntry,
	LoadBreakdownItem,
	RotationFamilyBreakdownItem,
	LoadProfile,
} from '../types';
import { isDepartmentMatch } from './grade-labels';

export type { FacultyAssignmentDraft, FacultyOwnershipState, LoadStatus, SubjectSectionOwnershipIndexEntry };

/**
 * LEGACY client policy constants — retained ONLY for non-Teaching-Load surfaces
 * (Teachers page, timetable sandbox) that have not yet been migrated to
 * effective school/year policy consumption. The Teaching Load client path must
 * NOT reference these: it consumes the effective policy returned by
 * GET /faculty-assignments/summary (`workloadPolicy` + `workloadPolicyStatus`)
 * through `EffectiveTeachingPolicy`, `deriveTeachingWorkload`, and
 * `deriveTeachingLoadStatus`. Follow-up: migrate the legacy surfaces and
 * delete these constants.
 */
export const STANDARD_WEEKLY_TEACHING_HOURS = 30;
export const MAX_WEEKLY_TEACHING_HOURS = 40;
export const CLASS_ADVISER_EQUIVALENT_HOURS = 5;

export function normalizeDepartmentCode(value: string | null | undefined): string {
	const normalized = (value ?? '').trim().toUpperCase();
	if (!normalized) return '';
	const table: Record<string, string> = {
		SCIENCE: 'SCI',
		SCI: 'SCI',
		MATHEMATICS: 'MATH',
		MATH: 'MATH',
		ENGLISH: 'ENG',
		ENG: 'ENG',
		FILIPINO: 'FIL',
		FIL: 'FIL',
		MAPEH: 'MAPEH',
		ESP: 'ESP',
		VALUES: 'ESP',
		'VALUES EDUCATION': 'ESP',
		AP: 'AP',
		'SOCIAL STUDIES': 'AP',
		'ARALING PANLIPUNAN': 'AP',
		TLE: 'TLE',
		LANGUAGES: 'ENG',
		SPA: 'SPA',
		SPS: 'SPS',
	};
	return table[normalized] ?? normalized;
}

export function matchesOwnershipDepartment(facultyDepartment: string | null | undefined, subject: Subject): boolean {
	const ownerDepartments = [
		...(subject.ownerDepartment ? [subject.ownerDepartment] : []),
		...(subject.allowedOwnerDepartments ?? []),
	]
		.map((value) => normalizeDepartmentCode(value))
		.filter((value): value is string => Boolean(value));

	if (ownerDepartments.length > 0) {
		const normalizedFaculty = normalizeDepartmentCode(facultyDepartment);
		if (!normalizedFaculty) return false;
		if (ownerDepartments.includes(normalizedFaculty)) return true;
		return false;
	}

	return isDepartmentMatch(facultyDepartment ?? null, subject.code, subject.name);
}

export function getFacultyComparableLoadHours(member: FacultySummary): number {
	if (member.isPlaceholder) {
		return member.gradeTeachingHours ?? member.syntheticCoverageHours ?? 0;
	}
	// Canonical: actual instructional teaching hours only. Credited fallbacks
	// (policyCreditedHours / subjectHours) mix advisory/ancillary credit into
	// teaching load and created false overloads — they must never apply here.
	return member.actualTeachingHours ?? member.sectionTeachingHours ?? 0;
}

/**
 * Actual teaching hours for a faculty row, preferring an explicitly computed
 * effective (draft-aware) value when the caller supplies one.
 */
export function resolveTeachingActualHours(
	member: FacultySummary,
	effectiveHours?: Map<number, number>,
): number {
	if (member.isPlaceholder) {
		return member.gradeTeachingHours ?? member.syntheticCoverageHours ?? 0;
	}
	const effective = effectiveHours?.get(member.id);
	if (typeof effective === 'number' && Number.isFinite(effective)) {
		return Math.max(0, effective);
	}
	return member.actualTeachingHours ?? member.sectionTeachingHours ?? 0;
}

/**
 * Teaching utilization percent from actual teaching hours only.
 * Advisory/ancillary credit never inflates this figure.
 * The standard is always explicit (effective school/year policy) — no default.
 */
export function teachingUtilizationPercentFor(
	member: FacultySummary,
	standardHours: number,
	effectiveHours?: Map<number, number>,
): number {
	const actual = resolveTeachingActualHours(member, effectiveHours);
	if (!(standardHours > 0)) return 0;
	return Math.round((actual / standardHours) * 1000) / 10;
}

/**
 * Effective school/year workload policy as returned by
 * GET /faculty-assignments/summary (no client-side defaults).
 */
export interface EffectiveTeachingPolicy {
	teachingStandardMinutes: number;
	advisoryCreditMinutes: number;
	hardCapMinutes: number;
}

export function teachingStandardHoursOf(policy: EffectiveTeachingPolicy): number {
	return policy.teachingStandardMinutes / 60;
}

export function advisoryCreditHoursOf(policy: EffectiveTeachingPolicy): number {
	return policy.advisoryCreditMinutes / 60;
}

export function hardCapHoursOf(policy: EffectiveTeachingPolicy): number {
	return policy.hardCapMinutes / 60;
}

/**
 * Advisory credit authority: for a valid class adviser (validity is decided
 * server-side and surfaced as `isClassAdviser`), credit equals the persisted
 * effective school/year `advisoryCreditMinutes`. The EnrollPro mirror field
 * `advisoryEquivalentHours` is display-only faculty data and must never
 * silently override ATLAS workload policy — there is no persisted ATLAS
 * per-faculty advisory override model.
 */
export function resolveAdvisoryCreditHours(
	member: Pick<FacultySummary, 'isClassAdviser'>,
	policy: EffectiveTeachingPolicy,
): number {
	if (!member.isClassAdviser) return 0;
	return advisoryCreditHoursOf(policy);
}

/**
 * Canonical teaching-load status from ACTUAL teaching hours against the
 * explicit effective standard. All parameters required — no local defaults.
 */
export function deriveTeachingLoadStatus(
	actualTeachingHours: number,
	standardHours: number,
	maxHoursPerWeek: number,
): { status: LoadStatus; label: string; instruction?: string } {
	if (actualTeachingHours > maxHoursPerWeek) {
		return { status: 'over-cap', label: 'Over maximum', instruction: 'Move classes before generating.' };
	}
	if (actualTeachingHours > standardHours) {
		return { status: 'overload-allowed', label: 'Above standard', instruction: 'Review before generating.' };
	}
	if (actualTeachingHours === standardHours) {
		return { status: 'compliant', label: 'At standard' };
	}
	return { status: 'below-standard', label: 'Below standard' };
}

export interface TeachingWorkloadSummary {
	teachingHours: number;
	creditHours: number;
	creditedTotalHours: number;
	remainingTeachingHours: number;
	excessTeachingHours: number;
	overCapHours: number;
	status: LoadStatus;
	statusLabel: string;
	statusInstruction?: string;
}

/**
 * Canonical workload summary for the Teaching Load client. The teaching
 * standard and cap come from the effective school/year policy argument —
 * advisory/ancillary credit is display-only and never creates teaching
 * overload or shrinks teaching remaining.
 */
export function deriveTeachingWorkload(
	teachingHours: number,
	creditHours: number,
	policy: EffectiveTeachingPolicy,
	maxHoursPerWeek: number,
): TeachingWorkloadSummary {
	const normalizedTeachingHours = roundHours(Math.max(teachingHours, 0));
	const normalizedCreditHours = roundHours(Math.max(creditHours, 0));
	const creditedTotalHours = roundHours(normalizedTeachingHours + normalizedCreditHours);
	const standardHours = teachingStandardHoursOf(policy);
	const { status, label, instruction } = deriveTeachingLoadStatus(normalizedTeachingHours, standardHours, maxHoursPerWeek);

	return {
		teachingHours: normalizedTeachingHours,
		creditHours: normalizedCreditHours,
		creditedTotalHours,
		remainingTeachingHours: roundHours(Math.max(standardHours - normalizedTeachingHours, 0)),
		excessTeachingHours: roundHours(Math.max(normalizedTeachingHours - standardHours, 0)),
		overCapHours: roundHours(Math.max(normalizedTeachingHours - maxHoursPerWeek, 0)),
		status,
		statusLabel: label,
		statusInstruction: instruction,
	};
}

export type WorkloadBarTone = 'below-standard' | 'at-standard' | 'excess' | 'over-cap' | 'unconfigured';

export interface WorkloadBarState {
	teachingWidthPercent: number;
	creditWidthPercent: number;
	standardMarkerPercent: number | null;
	tone: WorkloadBarTone;
	isOverCap: boolean;
	excessTeachingHours: number;
	/** Projected teaching = actual + incoming teaching (credit never included). */
	projectedTeachingHours: number;
	projectedTone: WorkloadBarTone;
	projectedOverCap: boolean;
}

function percentOfCap(value: number, maxHours: number): number {
	return Math.min(100, Math.max(0, (value / Math.max(maxHours, 1)) * 100));
}

/**
 * Pure workload-bar state. Teaching width, tone, marker, excess, and over-cap
 * derive from ACTUAL teaching hours against the explicit effective standard;
 * credit widens only the neutral segment. Unknown standard yields the
 * unconfigured state (never a local-standard claim). Projected status uses
 * actual + incoming TEACHING only — credit never triggers projected excess/cap.
 */
export function resolveWorkloadBarState(input: {
	teachingHours: number;
	creditHours: number;
	maxHours: number;
	standardHours?: number | null;
	incomingTeachingHours?: number;
}): WorkloadBarState {
	const teaching = Math.max(input.teachingHours, 0);
	const credit = Math.max(input.creditHours, 0);
	const incoming = Math.max(input.incomingTeachingHours ?? 0, 0);
	const cap = Math.max(input.maxHours, 1);
	const standard = input.standardHours;
	const teachingWidthPercent = percentOfCap(teaching, cap);
	const creditWidthPercent = Math.max(0, percentOfCap(teaching + credit, cap) - teachingWidthPercent);
	const projectedTeachingHours = Math.round((teaching + incoming) * 10) / 10;
	const projectedOverCap = projectedTeachingHours > input.maxHours;
	const toneFor = (value: number): WorkloadBarTone => {
		if (standard == null || !(standard > 0)) return 'unconfigured';
		if (value > input.maxHours) return 'over-cap';
		if (value > standard) return 'excess';
		if (value === standard) return 'at-standard';
		return 'below-standard';
	};
	if (standard == null || !(standard > 0)) {
		return {
			teachingWidthPercent,
			creditWidthPercent,
			standardMarkerPercent: null,
			tone: 'unconfigured',
			isOverCap: teaching > input.maxHours,
			excessTeachingHours: 0,
			projectedTeachingHours,
			projectedTone: 'unconfigured',
			projectedOverCap,
		};
	}
	const isOverCap = teaching > input.maxHours;
	const excessTeachingHours = Math.max(0, Math.round((teaching - standard) * 10) / 10);
	return {
		teachingWidthPercent,
		creditWidthPercent,
		standardMarkerPercent: percentOfCap(standard, cap),
		tone: toneFor(teaching),
		isOverCap,
		excessTeachingHours,
		projectedTeachingHours,
		projectedTone: toneFor(projectedTeachingHours),
		projectedOverCap,
	};
}

function resolveRotationFamily(subject: Pick<Subject, 'code' | 'rotationFamily'>): string | null {
	const explicit = (subject.rotationFamily ?? '').trim().toUpperCase();
	if (explicit.length > 0) {
		return explicit;
	}
	const code = (subject.code ?? '').trim().toUpperCase();
	if (code.startsWith('TLE')) return 'TLE_ROTATION';
	if (code.startsWith('SCI_')) return 'SCIENCE';
	return null;
}

type RotationTermMetadata = {
	termRank: number | null;
	termLabel: string | null;
	termGroupId: string | null;
	termCount: number | null;
};

function toCanonicalRotationTermLabel(termLabel: string | null | undefined, termRank: number | null): string | null {
	if (typeof termRank === 'number' && Number.isInteger(termRank) && termRank > 0) {
		return `Term ${termRank}`;
	}

	const trimmed = (termLabel ?? '').trim();
	if (!trimmed) {
		return null;
	}

	const rankMatch = trimmed.match(/(\d+)/);
	if (rankMatch) {
		const parsed = Number(rankMatch[1]);
		if (Number.isInteger(parsed) && parsed > 0) {
			return `Term ${parsed}`;
		}
	}

	return trimmed;
}

function resolveRotationTermMetadata(subject: Subject): RotationTermMetadata {
	const explicitTermRank =
		typeof subject.rotationTermRank === 'number' && Number.isInteger(subject.rotationTermRank) && subject.rotationTermRank > 0
			? subject.rotationTermRank
			: null;
	const derivedTermRank =
		typeof subject.modularOrder === 'number' && Number.isInteger(subject.modularOrder) && subject.modularOrder > 0
			? subject.modularOrder
			: null;
	const termRank = explicitTermRank ?? derivedTermRank;

	const explicitTermCount =
		typeof subject.rotationTermCount === 'number' && Number.isInteger(subject.rotationTermCount) && subject.rotationTermCount > 0
			? subject.rotationTermCount
			: null;
	const derivedTermCount =
		typeof subject.termCount === 'number' && Number.isInteger(subject.termCount) && subject.termCount > 0
			? subject.termCount
			: null;
	const termCount = explicitTermCount ?? derivedTermCount;

	const explicitTermLabel = (subject.rotationTermLabel ?? '').trim();
	const termLabel = toCanonicalRotationTermLabel(explicitTermLabel, termRank);

	const explicitTermGroupId = (subject.rotationTermGroupId ?? '').trim();
	const derivedTermGroupId = (subject.termGroupId ?? '').trim();
	const termGroupId = explicitTermGroupId || derivedTermGroupId || null;

	return {
		termRank,
		termLabel,
		termGroupId,
		termCount,
	};
}

function normalizeRotationTermLaneKey(termRank: number | null): number {
	return typeof termRank === 'number' && Number.isInteger(termRank) && termRank > 0 ? termRank : 0;
}

function uniqueSortedPositiveInts(values: readonly number[] | null | undefined): number[] {
	return Array.from(new Set((values ?? []).filter((value) => Number.isInteger(value) && value > 0))).sort(
		(left, right) => left - right,
	);
}

export function deriveLoadStatus(actualTeachingHours: number, maxHoursPerWeek = MAX_WEEKLY_TEACHING_HOURS): { status: LoadStatus; label: string; instruction?: string } {
	if (actualTeachingHours > maxHoursPerWeek) {
		return { status: 'over-cap', label: 'Over maximum', instruction: 'Move classes before generating.' };
	}
	if (actualTeachingHours > STANDARD_WEEKLY_TEACHING_HOURS) {
		return { status: 'overload-allowed', label: 'Above standard', instruction: 'Review before generating.' };
	}
	if (actualTeachingHours === STANDARD_WEEKLY_TEACHING_HOURS) {
		return { status: 'compliant', label: 'At standard' };
	}
	return { status: 'below-standard', label: 'Below standard' };
}

export function getFacultyLoadSortRank(
	faculty: Pick<FacultySummary, 'isActiveForScheduling' | 'actualTeachingHours' | 'sectionTeachingHours' | 'policyCreditedHours' | 'subjectCount' | 'maxHoursPerWeek'>,
): number {
	const weeklyHours = faculty.actualTeachingHours ?? faculty.sectionTeachingHours ?? 0;
	const subjectCount = faculty.subjectCount ?? 0;
	const maxHours = faculty.maxHoursPerWeek ?? MAX_WEEKLY_TEACHING_HOURS;
	const loadStatus = deriveLoadStatus(weeklyHours, maxHours);

	// Ascending order puts the scheduler's most urgent repair states first.
	if (!faculty.isActiveForScheduling) return 5;
	if (weeklyHours === 0 || subjectCount === 0) return 4;
	if (loadStatus.status === 'over-cap') return 0;
	if (loadStatus.status === 'overload-allowed') return 1;
	if (loadStatus.status === 'compliant') return 2;
	return 3;
}

export type WorkloadCapacitySummary = {
	teachingHours: number;
	creditHours: number;
	creditedTotalHours: number;
	toStandardHours: number;
	toCapHours: number;
	overStandardHours: number;
	overCapHours: number;
	status: LoadStatus;
	statusLabel: string;
	statusInstruction?: string;
};

function roundHours(value: number): number {
	return Math.round(value * 10) / 10;
}

export function deriveWorkloadCapacity(
	teachingHours: number,
	creditHours: number,
	maxHours = MAX_WEEKLY_TEACHING_HOURS,
): WorkloadCapacitySummary {
	const normalizedTeachingHours = roundHours(Math.max(teachingHours, 0));
	const normalizedCreditHours = roundHours(Math.max(creditHours, 0));
	const creditedTotalHours = roundHours(normalizedTeachingHours + normalizedCreditHours);
	// Canonical: teaching standard, remaining, and excess derive from ACTUAL
	// teaching hours only. Advisory/ancillary credit is display-only workload
	// and must never create teaching overload or shrink teaching remaining.
	const { status, label, instruction } = deriveLoadStatus(normalizedTeachingHours, maxHours);

	return {
		teachingHours: normalizedTeachingHours,
		creditHours: normalizedCreditHours,
		creditedTotalHours,
		toStandardHours: roundHours(Math.max(STANDARD_WEEKLY_TEACHING_HOURS - normalizedTeachingHours, 0)),
		toCapHours: roundHours(Math.max(maxHours - normalizedTeachingHours, 0)),
		overStandardHours: roundHours(Math.max(normalizedTeachingHours - STANDARD_WEEKLY_TEACHING_HOURS, 0)),
		overCapHours: roundHours(Math.max(normalizedTeachingHours - maxHours, 0)),
		status,
		statusLabel: label,
		statusInstruction: instruction,
	};
}

/**
 * Request scope for Teaching Load reads/writes. The actor school comes from
 * the authenticated session (/auth/me) and the year from runtime context —
 * never a hardcoded school literal. Missing scope throws a typed error the
 * caller must surface instead of falling back to school 1.
 */
export function teachingLoadScopeParams(
	actorSchoolId: number | null | undefined,
	schoolYearId: number | null | undefined,
): { schoolId: number; schoolYearId: number } {
	if (typeof actorSchoolId !== 'number' || !Number.isInteger(actorSchoolId) || actorSchoolId <= 0) {
		throw Object.assign(new Error('Teaching Load needs a signed-in scheduler account with a school assignment.'), {
			code: 'SCHOOL_UNRESOLVED',
		});
	}
	if (typeof schoolYearId !== 'number' || !Number.isInteger(schoolYearId) || schoolYearId <= 0) {
		throw Object.assign(new Error('Teaching Load needs an active school year before loading data.'), {
			code: 'SCHOOL_YEAR_UNRESOLVED',
		});
	}
	return { schoolId: actorSchoolId, schoolYearId };
}

/**
 * Guided empty-state message with the dynamic active school-year label.
 * No hardcoded year literals.
 */
export function buildGuidedEmptyTeachingLoadMessage(schoolYearLabel: string | null): string {
	const year = schoolYearLabel?.trim() ? schoolYearLabel.trim() : 'the active school year';
	return `Build ${year} Teaching Load first. Start with the suggested draft or use the guided repair queue. Optionally, Year Setup can preview carrying forward compatible assignments from an archived year first.`;
}

/**
 * LEGACY local department comparison (client alias table). Retained only for
 * non-Teaching-Load consumers. The Teaching Load path compares the
 * server-supplied canonical `departmentCode` with exact equality.
 */
export function isSameDepartment(
	left: string | null | undefined,
	right: string | null | undefined,
): boolean {
	const normalizedLeft = normalizeDepartmentCode(left);
	const normalizedRight = normalizeDepartmentCode(right);
	if (!normalizedLeft || !normalizedRight) return false;
	return normalizedLeft === normalizedRight;
}

export type TeachingLoadStatusFilter = 'all' | 'teaching-assigned' | 'no-teaching' | 'adviser-only';
export type TeachingLoadLoadFilter = 'all' | 'below-standard' | 'at-standard' | 'excess';

export type TeachingLoadFacet =
	| 'teaching-assigned'
	| 'no-teaching'
	| 'adviser-only'
	| 'below-standard'
	| 'at-standard'
	| 'excess'
	| 'unmapped';

export interface TeachingLoadFacetSelection {
	department?: string;
	status?: TeachingLoadStatusFilter;
	load?: TeachingLoadLoadFilter;
}

export interface TeachingLoadFacetCounts {
	/** Status counts on the department+load+search base (excludes only status). */
	statusCounts: Record<TeachingLoadFacet, number>;
	/** Load-band counts on the department+status+search base (excludes only load). */
	loadCounts: Record<'below-standard' | 'at-standard' | 'excess', number>;
	/** Department counts on the status+load+search base (excludes only department). */
	departmentCounts: { value: string; label: string; count: number }[];
}

/**
 * Canonical per-faculty teaching-load facet from actual teaching hours and the
 * SERVER-SUPPLIED canonical department code. Precedence: unmapped department
 * (data quality) > adviser-only > no-teaching > below/at/excess standard.
 * Credited workload never influences the outcome. standardHours is explicit
 * (effective school/year policy) and may be null when UNCONFIGURED.
 */
export function deriveTeachingLoadFacet(
	member: FacultySummary,
	standardHours: number | null,
	effectiveHours?: Map<number, number>,
): TeachingLoadFacet {
	if (!member.departmentCode || member.departmentCode === 'UNMAPPED') return 'unmapped';
	const actual = resolveTeachingActualHours(member, effectiveHours);
	if (actual <= 0) {
		return member.isClassAdviser ? 'adviser-only' : 'no-teaching';
	}
	if (standardHours == null) return 'teaching-assigned';
	if (actual < standardHours) return 'below-standard';
	if (actual === standardHours) return 'at-standard';
	return 'excess';
}

function canonicalDepartmentKey(member: FacultySummary): string {
	return member.departmentCode && member.departmentCode.trim() ? member.departmentCode.trim() : 'UNMAPPED';
}

function matchesDepartmentSelection(
	member: FacultySummary,
	department: string | undefined,
): boolean {
	const selection = (department ?? 'all').trim();
	if (!selection || selection === 'all') return true;
	// Server-supplied canonical identity: exact code equality only. No alias
	// tables, no keyword or prefix inference on the Teaching Load path.
	return canonicalDepartmentKey(member) === selection;
}

function matchesStatusSelection(
	member: FacultySummary,
	status: TeachingLoadStatusFilter | undefined,
	_standardHours: number | null,
	effectiveHours?: Map<number, number>,
): boolean {
	if (!status || status === 'all') return true;
	const actual = resolveTeachingActualHours(member, effectiveHours);
	if (status === 'teaching-assigned') return actual > 0;
	if (status === 'no-teaching') return actual <= 0;
	return member.isClassAdviser && actual <= 0;
}

function matchesLoadSelection(
	member: FacultySummary,
	load: TeachingLoadLoadFilter | undefined,
	standardHours: number | null,
	effectiveHours?: Map<number, number>,
): boolean {
	if (!load || load === 'all') return true;
	if (standardHours == null) return false;
	const actual = resolveTeachingActualHours(member, effectiveHours);
	if (actual <= 0) return false;
	if (load === 'below-standard') return actual < standardHours;
	if (load === 'at-standard') return actual === standardHours;
	return actual > standardHours;
}

/**
 * Contextual facet counts with an exact count/row contract:
 * - statusCounts are computed on the department+load+search base, so selecting
 *   a status option yields exactly its displayed count;
 * - loadCounts are computed on the department+status+search base;
 * - departmentCounts are computed on the status+load+search base.
 * `No teaching load` includes every zero-teaching faculty member; `Adviser only`
 * is its adviser subset (counted separately, filtered as a subset).
 * standardHours is the explicit effective standard (null when UNCONFIGURED).
 */
export function computeTeachingLoadFacets(
	members: FacultySummary[],
	selection: TeachingLoadFacetSelection = {},
	effectiveHours?: Map<number, number>,
	standardHours: number | null = null,
): TeachingLoadFacetCounts {
	const department = selection.department ?? 'all';
	const status = selection.status ?? 'all';
	const load = selection.load ?? 'all';

	const matchesDept = (row: FacultySummary) => matchesDepartmentSelection(row, department);
	const matchesStat = (row: FacultySummary) => matchesStatusSelection(row, status, standardHours, effectiveHours);
	const matchesLd = (row: FacultySummary) => matchesLoadSelection(row, load, standardHours, effectiveHours);

	const statusBase = members.filter((row) => matchesDept(row) && matchesLd(row));
	const statusCounts: Record<TeachingLoadFacet, number> = {
		'teaching-assigned': 0,
		'no-teaching': 0,
		'adviser-only': 0,
		'below-standard': 0,
		'at-standard': 0,
		excess: 0,
		unmapped: 0,
	};
	for (const row of statusBase) {
		const actual = resolveTeachingActualHours(row, effectiveHours);
		if (actual > 0) {
			statusCounts['teaching-assigned'] += 1;
		} else {
			// Contract: No teaching load includes ALL zero-teaching faculty;
			// Adviser only is its adviser subset.
			statusCounts['no-teaching'] += 1;
			if (row.isClassAdviser) statusCounts['adviser-only'] += 1;
		}
		if (canonicalDepartmentKey(row) === 'UNMAPPED') statusCounts['unmapped'] += 1;
		const facet = deriveTeachingLoadFacet(row, standardHours, effectiveHours);
		if (facet === 'below-standard' || facet === 'at-standard' || facet === 'excess') {
			statusCounts[facet] += 1;
		}
	}

	const loadBase = members.filter((row) => matchesDept(row) && matchesStat(row));
	const loadCounts: Record<'below-standard' | 'at-standard' | 'excess', number> = {
		'below-standard': 0,
		'at-standard': 0,
		excess: 0,
	};
	if (standardHours != null) {
		for (const row of loadBase) {
			const actual = resolveTeachingActualHours(row, effectiveHours);
			if (actual <= 0) continue;
			if (actual < standardHours) loadCounts['below-standard'] += 1;
			else if (actual === standardHours) loadCounts['at-standard'] += 1;
			else loadCounts['excess'] += 1;
		}
	}

	const departmentBase = members.filter((row) => matchesStat(row) && matchesLd(row));
	const byCode = new Map<string, { value: string; label: string; count: number }>();
	for (const row of departmentBase) {
		const key = canonicalDepartmentKey(row);
		const existing = byCode.get(key);
		if (existing) {
			existing.count += 1;
		} else {
			byCode.set(key, {
				value: key,
				label: key === 'UNMAPPED' ? 'Unmapped' : (row.departmentLabel?.trim() || row.department?.trim() || key),
				count: 1,
			});
		}
	}
	return {
		statusCounts,
		loadCounts,
		departmentCounts: Array.from(byCode.values()).sort((left, right) => left.label.localeCompare(right.label)),
	};
}

/**
 * Pure row filter behind the Teaching Load grid. The hook and the
 * count/row-equality tests share this function so displayed counts and
 * resulting rows match exactly by construction.
 */
export function applyTeachingLoadFilters(
	members: FacultySummary[],
	selection: TeachingLoadFacetSelection = {},
	effectiveHours?: Map<number, number>,
	standardHours: number | null = null,
): FacultySummary[] {
	const department = selection.department ?? 'all';
	const status = selection.status ?? 'all';
	const load = selection.load ?? 'all';
	return members.filter(
		(row) =>
			matchesDepartmentSelection(row, department)
			&& matchesStatusSelection(row, status, standardHours, effectiveHours)
			&& matchesLoadSelection(row, load, standardHours, effectiveHours),
	);
}

export function buildSectionMap(sections: ExternalSection[]): Map<number, ExternalSection> {
	return new Map(sections.map((section) => [section.id, section]));
}

export function deriveGradeLevelsForSections(
	sectionIds: readonly number[],
	sectionMap: Map<number, ExternalSection>,
): number[] {
	return Array.from(
		new Set(
			uniqueSortedPositiveInts(sectionIds)
				.map((sectionId) => sectionMap.get(sectionId)?.displayOrder)
				.filter(
					(displayOrder): displayOrder is number =>
						typeof displayOrder === 'number' && Number.isInteger(displayOrder) && displayOrder > 0,
				),
		),
	).sort((left, right) => left - right);
}

export function normalizeDraftAssignments(
	assignments: FacultyAssignmentDraft[],
	sectionMap: Map<number, ExternalSection>,
): FacultyAssignmentDraft[] {
	return assignments
		.map((assignment) => {
			const sectionIds = uniqueSortedPositiveInts(assignment.sectionIds).filter((sectionId) => sectionMap.has(sectionId));
			return {
				subjectId: assignment.subjectId,
				sectionIds,
				gradeLevels: deriveGradeLevelsForSections(sectionIds, sectionMap),
			};
		})
		.filter((assignment) => assignment.sectionIds.length > 0)
		.sort((left, right) => left.subjectId - right.subjectId);
}

export function buildAssignmentSignature(assignments: FacultyAssignmentDraft[]): string {
	return assignments
		.map((assignment) => `${assignment.subjectId}:${uniqueSortedPositiveInts(assignment.sectionIds).join(',')}`)
		.sort()
		.join('|');
}

export function getAssignmentOwnershipKey(subjectId: number, sectionId: number): string {
	return `${subjectId}:${sectionId}`;
}

export function buildOwnershipMap(
	assignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>,
	facultyNames: Record<number, string>,
	source: FacultyOwnershipState['source'],
): Record<string, FacultyOwnershipState> {
	const ownershipMap: Record<string, FacultyOwnershipState> = {};
	for (const [facultyIdRaw, assignments] of Object.entries(assignmentsByFaculty)) {
		const facultyId = Number(facultyIdRaw);
		const facultyName = facultyNames[facultyId] ?? `Faculty ${facultyId}`;
		for (const assignment of assignments) {
			for (const sectionId of assignment.sectionIds) {
				ownershipMap[getAssignmentOwnershipKey(assignment.subjectId, sectionId)] = {
					facultyId,
					facultyName,
					source,
				};
			}
		}
	}
	return ownershipMap;
}

export function buildOwnershipMapFromIndex(
	ownershipIndex: SubjectSectionOwnershipIndexEntry[],
): Record<string, FacultyOwnershipState> {
	const ownershipMap: Record<string, FacultyOwnershipState> = {};
	for (const entry of ownershipIndex) {
		ownershipMap[getAssignmentOwnershipKey(entry.subjectId, entry.sectionId)] = {
			facultyId: entry.facultyId,
			facultyName: entry.facultyName,
			source: 'saved',
		};
	}
	return ownershipMap;
}

/**
 * Like buildOwnershipMap but accumulates ALL owners per key instead of last-write-wins.
 * Use this to detect database-level duplicate ownership conflicts that bypass the
 * transaction guardrails (e.g. via seeding scripts).
 */
export function buildMultiOwnerSavedMap(
	savedAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>,
	facultyNames: Record<number, string>,
): Record<string, FacultyOwnershipState[]> {
	const multiMap: Record<string, FacultyOwnershipState[]> = {};
	for (const [facultyIdRaw, assignments] of Object.entries(savedAssignmentsByFaculty)) {
		const facultyId = Number(facultyIdRaw);
		const facultyName = facultyNames[facultyId] ?? `Faculty ${facultyId}`;
		for (const assignment of assignments) {
			for (const sectionId of assignment.sectionIds) {
				const key = getAssignmentOwnershipKey(assignment.subjectId, sectionId);
				const existing = multiMap[key];
				if (existing) {
					existing.push({ facultyId, facultyName, source: 'saved' });
				} else {
					multiMap[key] = [{ facultyId, facultyName, source: 'saved' }];
				}
			}
		}
	}
	return multiMap;
}

/**
 * Returns the set of ownership keys (subjectId:sectionId) that are owned by more
 * than one faculty in saved data - these are hard database-level conflicts.
 */
export function detectSavedConflictKeys(
	multiOwnerMap: Record<string, FacultyOwnershipState[]>,
): Set<string> {
	const conflicted = new Set<string>();
	for (const [key, owners] of Object.entries(multiOwnerMap)) {
		if (owners.length > 1) {
			conflicted.add(key);
		}
	}
	return conflicted;
}

export function buildPendingOwnershipMap(
	savedAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>,
	draftAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>,
	facultyNames: Record<number, string>,
): Record<string, FacultyOwnershipState> {
	const savedOwnershipMap = buildOwnershipMap(savedAssignmentsByFaculty, facultyNames, 'saved');
	const pendingOwnershipMap: Record<string, FacultyOwnershipState> = {};

	for (const [facultyIdRaw, assignments] of Object.entries(draftAssignmentsByFaculty)) {
		const facultyId = Number(facultyIdRaw);
		const facultyName = facultyNames[facultyId] ?? `Faculty ${facultyId}`;
		const savedSignature = new Set(
			(savedAssignmentsByFaculty[facultyId] ?? []).flatMap((assignment) =>
				assignment.sectionIds.map((sectionId) => getAssignmentOwnershipKey(assignment.subjectId, sectionId)),
			),
		);

		for (const assignment of assignments) {
			for (const sectionId of assignment.sectionIds) {
				const key = getAssignmentOwnershipKey(assignment.subjectId, sectionId);
				const savedOwner = savedOwnershipMap[key];
				if (savedSignature.has(key) && savedOwner?.facultyId === facultyId) {
					continue;
				}
				pendingOwnershipMap[key] = {
					facultyId,
					facultyName,
					source: 'pending',
				};
			}
		}
	}

	return pendingOwnershipMap;
}

/**
 * Builds a map of subject-section ownership that reflects the actual state of the world
 * including all active drafts. If a faculty member has a draft, their draft COMPLETELY
 * overrides their saved assignments for the purpose of this map.
 */
export function buildEffectiveOwnershipMap(
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>,
	facultyNames: Record<number, string>,
	pendingOwnershipMap: Record<string, FacultyOwnershipState>,
): Record<string, FacultyOwnershipState & { isPending: boolean }> {
	const map: Record<string, FacultyOwnershipState & { isPending: boolean }> = {};
	
	for (const [facultyIdRaw, assignments] of Object.entries(effectiveAssignmentsByFaculty)) {
		const facultyId = Number(facultyIdRaw);
		const facultyName = facultyNames[facultyId] ?? `Faculty ${facultyId}`;
		
		for (const a of assignments) {
			for (const sectionId of a.sectionIds) {
				const key = getAssignmentOwnershipKey(a.subjectId, sectionId);
				const isPending = pendingOwnershipMap[key]?.facultyId === facultyId;
				
				map[key] = {
					facultyId,
					facultyName,
					source: isPending ? 'pending' : 'saved',
					isPending
				};
			}
		}
	}
	return map;
}

export function computeSectionAssignmentDeltaMinutes(
	subject: Subject,
	sectionId: number,
	currentAssignments: FacultyAssignmentDraft[],
	subjects: Subject[],
	sectionMap: Map<number, ExternalSection>,
	equivalentHours: number,
	policy: EffectiveTeachingPolicy,
	maxHoursPerWeek: number,
): number {
	const currentProfile = buildTeachingLoadProfile(currentAssignments, subjects, sectionMap, equivalentHours, policy, maxHoursPerWeek);
	const currentMinutes = currentProfile.actualTeachingHours * 60;

	const nextAssignments = currentAssignments.map((a) =>
		a.subjectId === subject.id
			? { ...a, sectionIds: Array.from(new Set([...a.sectionIds, sectionId])) }
			: a,
	);
	if (!currentAssignments.some((a) => a.subjectId === subject.id)) {
		nextAssignments.push({ subjectId: subject.id, sectionIds: [sectionId], gradeLevels: [] });
	}

	const nextProfile = buildTeachingLoadProfile(nextAssignments, subjects, sectionMap, equivalentHours, policy, maxHoursPerWeek);
	const nextMinutes = nextProfile.actualTeachingHours * 60;

	return Math.max(0, nextMinutes - currentMinutes);
}

export function buildTeachingLoadProfile(
	assignments: FacultyAssignmentDraft[],
	subjects: Subject[],
	sectionMap: Map<number, ExternalSection>,
	equivalentHours = 0,
	policy: EffectiveTeachingPolicy,
	maxHoursPerWeek: number,
): LoadProfile {
	const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
	const breakdown: LoadBreakdownItem[] = [];
	let rawMinutes = 0;
	const nonRotationLanes = new Map<string, number>();
	const familyAccumulators = new Map<
		string,
		{
			rawMinutes: number;
			subjectCodes: Set<string>;
			termBuckets: Map<
				number,
				{
					termRank: number | null;
					termLabel: string | null;
					termGroupId: string | null;
					termCount: number | null;
					laneMinutes: Map<number, number>;
				}
			>;
		}
	>();

	const computeTermBucketMinutes = (bucket: { laneMinutes: Map<number, number> }): number =>
		Array.from(bucket.laneMinutes.values()).reduce((sum, value) => sum + value, 0);

	const computeFamilyPeakMinutes = (
		termBuckets: Map<
			number,
			{
				termRank: number | null;
				termLabel: string | null;
				termGroupId: string | null;
				termCount: number | null;
				laneMinutes: Map<number, number>;
			}
		>,
	): number => {
		let peak = 0;
		for (const bucket of termBuckets.values()) {
			const bucketMinutes = computeTermBucketMinutes(bucket);
			if (bucketMinutes > peak) {
				peak = bucketMinutes;
			}
		}
		return peak;
	};

	for (const assignment of assignments) {
		const subject = subjectMap.get(assignment.subjectId);
		if (!subject) continue;
		const rotationFamily = resolveRotationFamily(subject);
		const rotationTermMetadata = resolveRotationTermMetadata(subject);
		for (const sectionId of assignment.sectionIds) {
			const section = sectionMap.get(sectionId);
			if (!section) continue;
			let isRotationDuplicate = false;

			if (rotationFamily) {
				const accumulator = familyAccumulators.get(rotationFamily) ?? {
					rawMinutes: 0,
					subjectCodes: new Set<string>(),
					termBuckets: new Map(),
				};

				const termKey = normalizeRotationTermLaneKey(rotationTermMetadata.termRank);
				const termBucket = accumulator.termBuckets.get(termKey) ?? {
					termRank: rotationTermMetadata.termRank,
					termLabel: rotationTermMetadata.termLabel,
					termGroupId: rotationTermMetadata.termGroupId,
					termCount: rotationTermMetadata.termCount,
					laneMinutes: new Map<number, number>(),
				};

				if (!termBucket.termLabel && rotationTermMetadata.termLabel) {
					termBucket.termLabel = rotationTermMetadata.termLabel;
				}
				if (!termBucket.termGroupId && rotationTermMetadata.termGroupId) {
					termBucket.termGroupId = rotationTermMetadata.termGroupId;
				}
				if (!termBucket.termCount && rotationTermMetadata.termCount) {
					termBucket.termCount = rotationTermMetadata.termCount;
				}
				if (!termBucket.termRank && rotationTermMetadata.termRank) {
					termBucket.termRank = rotationTermMetadata.termRank;
				}

				const familyPeakBefore = computeFamilyPeakMinutes(accumulator.termBuckets);
				const termBucketBeforeMinutes = computeTermBucketMinutes(termBucket);
				const currentTermLaneMinutes = termBucket.laneMinutes.get(sectionId) ?? 0;
				const laneIncrease = Math.max(0, subject.minMinutesPerWeek - currentTermLaneMinutes);
				const termBucketAfterMinutes = termBucketBeforeMinutes + laneIncrease;
				const familyPeakAfter = Math.max(familyPeakBefore, termBucketAfterMinutes);
				isRotationDuplicate = laneIncrease <= 0 || familyPeakAfter <= familyPeakBefore;

				if (laneIncrease > 0) {
					termBucket.laneMinutes.set(sectionId, subject.minMinutesPerWeek);
				}

				termBucket.termLabel = toCanonicalRotationTermLabel(termBucket.termLabel, termBucket.termRank);
				accumulator.rawMinutes += subject.minMinutesPerWeek;
				accumulator.subjectCodes.add(subject.code);
				accumulator.termBuckets.set(termKey, termBucket);
				familyAccumulators.set(rotationFamily, accumulator);
			} else {
				const laneKey = `subject:${subject.id}:${sectionId}`;
				const currentLaneMinutes = nonRotationLanes.get(laneKey) ?? 0;
				if (subject.minMinutesPerWeek > currentLaneMinutes) {
					nonRotationLanes.set(laneKey, subject.minMinutesPerWeek);
				}
			}

			breakdown.push({
				subjectId: subject.id,
				subjectName: subject.name,
				subjectCode: subject.code,
				rotationFamily,
				rotationTermRank: rotationTermMetadata.termRank,
				rotationTermLabel: rotationTermMetadata.termLabel,
				rotationTermGroupId: rotationTermMetadata.termGroupId,
				rotationTermCount: rotationTermMetadata.termCount,
				isRotationDuplicate,
				sectionId,
				sectionName: section.name,
				gradeLevel: section.displayOrder,
				minutesPerWeek: subject.minMinutesPerWeek,
				totalMinutes: subject.minMinutesPerWeek,
			});
			rawMinutes += subject.minMinutesPerWeek;
		}
	}

	const nonRotationCreditedMinutes = Array.from(nonRotationLanes.values()).reduce((sum, value) => sum + value, 0);
	const rotationFamilyComputations = Array.from(familyAccumulators.entries()).map(([family, stats]) => {
		const termBuckets = Array.from(stats.termBuckets.values()).map((bucket) => ({
			termRank: bucket.termRank,
			termLabel: bucket.termLabel,
			termGroupId: bucket.termGroupId,
			termCount: bucket.termCount,
			creditedMinutes: computeTermBucketMinutes(bucket),
			unitCount: bucket.laneMinutes.size,
		}));
		const peakMinutes = [...termBuckets].reduce((max, b) => Math.max(max, b.creditedMinutes), 0);
		const peakBuckets = termBuckets.filter(b => b.creditedMinutes === peakMinutes && b.creditedMinutes > 0);
		const peakLabels = peakBuckets
			.map(b => toCanonicalRotationTermLabel(b.termLabel, b.termRank))
			.filter(Boolean) as string[];

		const creditedFamilyMinutes = peakMinutes;

		return {
			creditedFamilyMinutes,
			detail: {
				family,
				rawHours: Math.round((stats.rawMinutes / 60) * 10) / 10,
				creditedHours: Math.round((creditedFamilyMinutes / 60) * 10) / 10,
				overcountHours: Math.round(((stats.rawMinutes - creditedFamilyMinutes) / 60) * 10) / 10,
				unitCount: termBuckets.reduce((sum, bucket) => sum + bucket.unitCount, 0),
				dominantTermRank: peakBuckets[0]?.termRank ?? null,
				dominantTermLabel: peakLabels.length > 1 ? `Tied: ${peakLabels.join(', ')}` : (peakLabels[0] ?? null),
				termGroupId: peakBuckets[0]?.termGroupId ?? null,
				termCount: peakBuckets[0]?.termCount ?? null,
				termBuckets: termBuckets.map(b => ({
					...b,
					subjectCodes: Array.from(stats.subjectCodes).sort((left, right) => left.localeCompare(right))
				})),
				subjectCodes: Array.from(stats.subjectCodes).sort((left, right) => left.localeCompare(right)),
			} satisfies RotationFamilyBreakdownItem,
		};
	});
	const creditedMinutes = nonRotationCreditedMinutes
		+ rotationFamilyComputations.reduce((sum, family) => sum + family.creditedFamilyMinutes, 0);
	const actualTeachingHours = Math.round((creditedMinutes / 60) * 10) / 10;
	const rawTeachingHours = Math.round((rawMinutes / 60) * 10) / 10;
	const rotationOvercountHours = Math.round(Math.max(0, rawTeachingHours - actualTeachingHours) * 10) / 10;
	// Canonical TL workload: explicit effective policy, actual-teaching basis.
	const workload = deriveTeachingWorkload(actualTeachingHours, equivalentHours, policy, maxHoursPerWeek);
	const normalizedEquivalentHours = workload.creditHours;
	const creditedTotalHours = workload.creditedTotalHours;
	const rotationFamilies: RotationFamilyBreakdownItem[] = rotationFamilyComputations
		.map((entry) => entry.detail)
		.sort((left, right) => right.overcountHours - left.overcountHours || left.family.localeCompare(right.family));

	return {
		actualTeachingHours,
		rawTeachingHours,
		rotationOvercountHours,
		equivalentHours: normalizedEquivalentHours,
		creditedTotalHours,
		overloadHours: workload.excessTeachingHours,
		overCapHours: workload.overCapHours,
		remainingHours: workload.remainingTeachingHours,
		excessTeachingHours: workload.excessTeachingHours,
		status: workload.status,
		statusLabel: workload.statusLabel,
		statusInstruction: workload.statusInstruction,
		rotationFamilies,
		breakdown: breakdown.sort(
			(left, right) =>
				left.gradeLevel - right.gradeLevel || left.sectionName.localeCompare(right.sectionName) || left.subjectCode.localeCompare(right.subjectCode),
		),
	};
}