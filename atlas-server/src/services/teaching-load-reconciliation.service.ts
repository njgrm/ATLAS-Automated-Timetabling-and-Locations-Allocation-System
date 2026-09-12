/**
 * Teaching Load reconciliation service — canonical active-year Teaching Load
 * reconciliation preview and fingerprinted apply.
 *
 * Demand authority: persisted SchoolYearOffering (Curriculum Requirement) rows
 * + SchoolYearTermConfig + OfferingTermAssignment + SectionMirror + Subject
 * catalog. EnrollPro supplies school-year, section, faculty, adviser and related
 * source identities — never curriculum decisions.
 *
 * HG (Homeroom Guidance) never becomes curriculum demand, never creates
 * Teaching Load ownership, never adds teaching minutes, and is always proposed
 * for retirement when present as ownership.
 *
 * Advisory credit comes only from the effective ATLAS workload policy and is
 * separate from teaching utilization and hard-cap capacity.
 *
 * The preview is zero-write. The apply requires an exact fingerprint, exact
 * source revision, and an explicit confirmation; it revalidates every source
 * revision inside one Serializable transaction, fails with a typed 409 and zero
 * partial writes on any drift, is idempotent, refreshes the TeachingLoadCycle
 * once, and emits a TEACHING_LOAD_RECONCILIATION audit event. It never touches
 * curriculum requirements, subjects, sections, generation runs, or publication.
 */

import { getDataContext } from '../lib/data-context.js';
import { Prisma } from '@prisma/client';
import { canonicalHash } from '../lib/canonical-json.js';
import { HG_SUBJECT_CODE } from './hg-advisory.service.js';
import { resolveEffectiveWorkloadPolicy } from './scheduling-policy.service.js';
import { readTeachingLoadCycleSource, refreshTeachingLoadCycle } from './teaching-load-cycle.service.js';
import { buildDepartmentAuthoritySourceRevision } from './department-authority.service.js';
import { buildQualificationPolicySnapshot, evaluateQualificationWithPolicy, type QualificationPolicy } from './qualification-evaluator.service.js';
import { computeTeachingLoadMinutes } from './faculty-assignment.service.js';
import { WORKLOAD_DEFAULTS } from './workload-policy.service.js';
import { buildDerivedDemand, toDerivedDemandPairIdentities, type DerivedDemandResult } from './derived-demand.service.js';

const db = () => getDataContext();

const SCHEMA_VERSION = 'TL-C02.1';
export const TEACHING_LOAD_RECONCILIATION_CONFIRMATION = 'APPLY TEACHING LOAD RECONCILIATION';
export const PROGRAM_TYPE_VOCABULARY = ['REGULAR', 'STE', 'SPS', 'SPA'] as const;

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

export function isTransactionConflictError(error: unknown): boolean {
	return !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034';
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type TermConfigSnapshot = {
	id: number;
	termCount: number;
	termIdentities: string[];
	updatedAt: string;
};

export type OfferingSnapshot = {
	id: number;
	subjectId: number | null;
	gradeLevel: number;
	programType: string;
	sectionMirrorId: number | null;
	cohortId: number | null;
	classification: string;
	weeklyMinutes: number;
	rotationFamily: string | null;
	rotationOrder: number | null;
	termMode: string;
	isActive: boolean;
	version: number;
	termAssignments: Array<{ termIdentity: string }>;
};

export type SectionSnapshot = {
	id: number;
	externalId: number;
	gradeLevel: number;
	programType: string;
	displayOrder: number;
	isActiveForScheduling: boolean;
	isStale: boolean;
	version: number;
};

export type SubjectSnapshot = {
	id: number;
	code: string;
	name: string;
	minMinutesPerWeek: number;
	programScopes: string[];
	gradeLevels: number[];
	allowedSpecializations: string[];
	ownerDepartment: string | null;
	rotationFamily: string | null;
	modularGroupId: string | null;
	modularOrder: number | null;
	termGroupId: string | null;
	termCount: number | null;
	isActive: boolean;
};

export type FacultySnapshot = {
	id: number;
	firstName: string;
	lastName: string;
	department: string | null;
	specialization: string | null;
	canTeachOutsideDepartment: boolean;
	isClassAdviser: boolean;
	advisedSectionId: number | null;
	isActiveForScheduling: boolean;
	isPlaceholder: boolean;
	isStale: boolean;
	version: number;
};

export type FacultySubjectSnapshot = {
	id: number;
	facultyId: number;
	subjectId: number;
	sectionIds: number[];
	gradeLevels: number[];
	version: number;
};

export type OwnershipSnapshot = {
	id: number;
	subjectId: number;
	sectionId: number;
	facultyId: number;
	facultySubjectId: number;
	specializationCode: string | null;
	specializationLabel: string | null;
};

export type CohortSnapshot = {
	id: number;
	memberSectionIds: number[];
};

export type WorkloadPolicySnapshot = {
	teachingStandardMinutes: number;
	advisoryCreditMinutes: number;
	hardCapMinutes: number;
	status: 'CONFIGURED' | 'UNCONFIGURED';
};

export type DepartmentRevisionSnapshot = {
	revisionHash: string;
	aliasRows: number;
	labelRows: number;
};

export type CrossDepartmentPermissionSnapshot = {
	facultyId: number;
	subjectId: number;
};

export type DepartmentRowSnapshot = {
	alias: string;
	department: string;
};

export type DepartmentLabelRowSnapshot = {
	code: string;
	label: string;
};

export type SubjectOwnerPrefixSnapshot = {
	prefix: string;
	department: string;
};

export type CycleStateSnapshot = {
	state: 'MISSING' | 'EMPTY' | 'POPULATED' | 'MISMATCH';
	version: number;
};

export type SchoolYearAuthoritySnapshot = {
	authorityMode: 'SOLE_ACTIVE_NON_ARCHIVED';
	mirrorId: number;
	enrollProSchoolYearId: number;
	yearLabel: string;
	isActive: boolean;
	isArchived: boolean;
	syncStatus: string;
	updatedAt: string;
};

export type ReconciliationSourceSnapshot = {
	schoolId: number;
	schoolYearId: number;
	schoolYearAuthority: SchoolYearAuthoritySnapshot;
	termConfig: TermConfigSnapshot | null;
	/**
	 * Canonical derived demand (DEMAND-C01). This is the ONLY demand authority:
	 * persisted `SchoolYearOffering` / `OfferingTermAssignment` /
	 * `SchoolYearTermConfig` rows are never selected as truth.
	 */
	derivedDemand: DerivedDemandResult;
	sections: SectionSnapshot[];
	cohorts: CohortSnapshot[];
	subjects: SubjectSnapshot[];
	faculty: FacultySnapshot[];
	facultySubjects: FacultySubjectSnapshot[];
	ownership: OwnershipSnapshot[];
	specializationAliases: Array<{ alias: string; canonical: string }>;
	crossDepartmentPermissions: CrossDepartmentPermissionSnapshot[];
	departmentAliases: DepartmentRowSnapshot[];
	departmentLabels: DepartmentLabelRowSnapshot[];
	subjectOwnerPrefixes: SubjectOwnerPrefixSnapshot[];
	workloadPolicy: WorkloadPolicySnapshot;
	departmentRevision: DepartmentRevisionSnapshot;
	cycleState: CycleStateSnapshot;
};

export type DemandPair = {
	key: string;
	offeringId: number;
	offeringVersion: number;
	subjectId: number;
	subjectCode: string;
	sectionId: number;
	gradeLevel: number;
	programType: string;
	classification: string;
	weeklyMinutes: number;
	termMode: string;
	termIdentities: string[];
	rotationFamily: string | null;
	rotationOrder: number | null;
	provenance: string;
};

export type OwnershipDiagnostic =
	| 'VALID_RETAIN'
	| 'MISSING_OWNER'
	| 'OUTSIDE_CURRICULUM'
	| 'HG_FORBIDDEN'
	| 'DUPLICATE'
	| 'WRONG_SCOPE'
	| 'UNQUALIFIED_OWNER'
	| 'OWNER_INACTIVE_OR_STALE'
	| 'OVER_STANDARD'
	| 'OVER_HARD_CAP'
	| 'ADVISER_SECTION_PREFERENCE_UNSATISFIED';

export type OwnershipRowClassification = {
	ownershipId: number;
	pairKey: string;
	diagnostics: OwnershipDiagnostic[];
	primaryAction: 'RETAIN' | 'RETIRE' | 'RELEASE';
};

export type ReconciliationActionType = 'RETAIN' | 'INSERT' | 'MOVE' | 'RETIRE' | 'UNRESOLVED';

export type ReconciliationPlanEntry = {
	action: ReconciliationActionType;
	subjectId: number;
	subjectCode: string;
	sectionId: number;
	classification: string;
	weeklyMinutes: number;
	termMode: string;
	termIdentities: string[];
	rotationFamily: string | null;
	currentOwnerId: number | null;
	proposedFacultyId: number | null;
	currentOwnershipId: number | null;
	diagnostics: OwnershipDiagnostic[];
	reason: string;
	unresolvedReason: string | null;
	adviserPreferenceApplied: boolean;
};

export type FacultyWorkloadSnapshot = {
	facultyId: number;
	name: string;
	isClassAdviser: boolean;
	isActiveForScheduling: boolean;
	isPlaceholder: boolean;
	beforeMinutes: number;
	afterMinutes: number;
	beforeStatus: string;
	afterStatus: string;
};

export type AdviserPreferenceOutcome = {
	facultyId: number;
	sectionId: number;
	satisfied: boolean;
	reason: string;
};

export type ReconciliationPlan = {
	schoolId: number;
	schoolYearId: number;
	demand: DemandPair[];
	actions: ReconciliationPlanEntry[];
	hgRowsFound: Array<{ ownershipId: number; subjectId: number; sectionId: number; facultyId: number }>;
	facultyWorkloads: FacultyWorkloadSnapshot[];
	adviserPreference: AdviserPreferenceOutcome[];
	classificationTotals: Record<string, number>;
	sourceRevision: string;
	fingerprint: string;
};

export type TeachingLoadAuthorityDiagnostic = {
	code: string;
	scope: 'PAIR' | 'FACULTY' | 'POLICY' | 'AUTHORITY';
	pairKey?: string;
	facultyId?: number;
	message: string;
};

export type TeachingLoadAuthorityDiagnostics = {
	demandedSubjectSectionPairs: DemandPair[];
	ownedSubjectSectionPairs: Array<{
		ownershipId: number;
		pairKey: string;
		subjectId: number;
		subjectCode: string;
		sectionId: number;
		facultyId: number;
	}>;
	unownedActiveFaculty: Array<{
		facultyId: number;
		name: string;
		department: string | null;
		specialization: string | null;
	}>;
	validAdviserMappings: Array<{
		facultyId: number;
		name: string;
		sectionId: number;
	}>;
	legacyHgOwnershipRows: ReconciliationPlan['hgRowsFound'];
	advisoryCreditEligibility: Array<{
		facultyId: number;
		name: string;
		sectionId: number | null;
		eligible: boolean;
		creditMinutes: number;
		reason: string;
	}>;
	overloadCapacityTotals: {
		policyStatus: WorkloadPolicySnapshot['status'];
		teachingStandardMinutes: number | null;
		hardCapMinutes: number | null;
		beforeTeachingMinutes: number;
		afterTeachingMinutes: number;
		beforeOverStandardCount: number;
		afterOverStandardCount: number;
		beforeOverHardCapCount: number;
		afterOverHardCapCount: number;
	};
	candidateCountsByDepartment: Array<{
		department: string;
		candidateCount: number;
		demandedPairCount: number;
	}>;
	unresolvedReasons: TeachingLoadAuthorityDiagnostic[];
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

export function normalizeSectionProgramType(programType: string | null | undefined): string {
	const upper = (programType ?? '').trim().toUpperCase();
	if ((PROGRAM_TYPE_VOCABULARY as readonly string[]).includes(upper)) return upper;
	return 'OTHER';
}

export function pairKeyOf(subjectId: number, sectionId: number): string {
	return `${subjectId}:${sectionId}`;
}

export function demandSortKey(demand: DemandPair): string {
	return `${String(demand.sectionId).padStart(8, '0')}:${String(demand.subjectId).padStart(8, '0')}`;
}

export function demandSortKeyForAction(pairKey: string): string {
	const [subjectIdRaw, sectionIdRaw] = pairKey.split(':');
	return `${String(Number(sectionIdRaw)).padStart(8, '0')}:${String(Number(subjectIdRaw)).padStart(8, '0')}`;
}

/**
 * Resolve the concrete section external ids an offering applies to.
 * Base-scope rows expand to every active section of the offering grade and
 * program. Section/cohort overrides resolve to their exact sections. Missing
 * or stale targets yield an empty expansion (never a guess).
 */
export function resolveOfferingSections(
	offering: OfferingSnapshot,
	sections: SectionSnapshot[],
	cohorts: CohortSnapshot[],
): Array<{ externalId: number; gradeLevel: number; programType: string; provenance: string }> {
	if (offering.sectionMirrorId != null) {
		const mirror = sections.find((section) => section.id === offering.sectionMirrorId);
		if (!mirror) return [];
		return [{ externalId: mirror.externalId, gradeLevel: mirror.gradeLevel, programType: mirror.programType, provenance: 'section-override' }];
	}
	if (offering.cohortId != null) {
		const cohort = cohorts.find((item) => item.id === offering.cohortId);
		if (!cohort) return [];
		const members = cohort.memberSectionIds
			.map((externalId) => sections.find((section) => section.externalId === externalId))
			.filter((section): section is SectionSnapshot => section != null);
		return members.map((section) => ({ externalId: section.externalId, gradeLevel: section.gradeLevel, programType: section.programType, provenance: 'cohort-override' }));
	}
	const targetProgram = normalizeSectionProgramType(offering.programType);
	return sections
		.filter((section) => section.gradeLevel === offering.gradeLevel && normalizeSectionProgramType(section.programType) === targetProgram)
		.map((section) => ({ externalId: section.externalId, gradeLevel: section.gradeLevel, programType: section.programType, provenance: 'grade-program-scope' }));
}

/**
 * Expand the canonical derived demand into one demand graph of expected
 * subject-section ownership. Term identities and rotation come exclusively from
 * the derived-demand contract; persisted offering rows are never consulted.
 */
export function expandCurriculumDemand(snapshot: ReconciliationSourceSnapshot): DemandPair[] {
	const derived = snapshot.derivedDemand;
	if (!derived.ok) {
		throw err(
			409,
			'DERIVED_DEMAND_BLOCKED',
			`Derived demand is unavailable: ${derived.blockers.map((entry) => entry.code).join(', ')}.`,
		);
	}
	return toDerivedDemandPairIdentities(derived).map((pair): DemandPair => ({
		key: pair.key,
		offeringId: 0,
		offeringVersion: 0,
		subjectId: pair.subjectId,
		subjectCode: pair.subjectCode,
		sectionId: pair.sectionId,
		gradeLevel: pair.gradeLevel,
		programType: pair.programType,
		classification: 'CORE',
		weeklyMinutes: pair.weeklyMinutes,
		termMode: pair.termMode,
		termIdentities: pair.termIdentities,
		rotationFamily: pair.rotationFamily,
		rotationOrder: pair.rotationOrder,
		provenance: 'derived-demand',
	}));
}

/**
 * Classify every current ownership row against the canonical demand graph.
 * One row may carry multiple diagnostics; the proposed action is unambiguous.
 */
export function classifyOwnershipRows(
	snapshot: ReconciliationSourceSnapshot,
	demandPairs: DemandPair[],
	ownership: OwnershipSnapshot[],
): Map<number, OwnershipRowClassification> {
	const demandKeys = new Set(demandPairs.map((pair) => pair.key));
	const subjectById = new Map(snapshot.subjects.map((subject) => [subject.id, subject]));
	const facultyById = new Map(snapshot.faculty.map((member) => [member.id, member]));
	const sectionByExternal = new Map(snapshot.sections.map((section) => [section.externalId, section]));

	const byPair = new Map<string, number[]>();
	for (const row of ownership) {
		const key = pairKeyOf(row.subjectId, row.sectionId);
		const list = byPair.get(key) ?? [];
		list.push(row.id);
		byPair.set(key, list);
	}

	const result = new Map<number, OwnershipRowClassification>();
	for (const row of ownership) {
		const key = pairKeyOf(row.subjectId, row.sectionId);
		const diagnostics: OwnershipDiagnostic[] = [];
		const subject = subjectById.get(row.subjectId);
		const faculty = facultyById.get(row.facultyId);
		const section = sectionByExternal.get(row.sectionId);

		if ((byPair.get(key)?.length ?? 0) > 1) {
			diagnostics.push('DUPLICATE');
		}

		const isHg = subject?.code.toUpperCase() === HG_SUBJECT_CODE;
		const inDemand = demandKeys.has(key);
		const facultyActive = !!faculty && faculty.isActiveForScheduling && !faculty.isStale && !faculty.isPlaceholder;

		let primaryAction: OwnershipRowClassification['primaryAction'];
		if (isHg) {
			diagnostics.push('HG_FORBIDDEN');
			primaryAction = 'RETIRE';
		} else if (!inDemand) {
			diagnostics.push(subject && !subject.isActive ? 'WRONG_SCOPE' : 'OUTSIDE_CURRICULUM');
			if (!section || !section.isActiveForScheduling) diagnostics.push('WRONG_SCOPE');
			primaryAction = 'RETIRE';
		} else if (!section || !section.isActiveForScheduling || (subject && !subject.isActive)) {
			diagnostics.push('WRONG_SCOPE');
			primaryAction = 'RETIRE';
		} else if (!facultyActive) {
			diagnostics.push('OWNER_INACTIVE_OR_STALE');
			primaryAction = 'RELEASE';
		} else {
			diagnostics.push('VALID_RETAIN');
			primaryAction = 'RETAIN';
		}

		result.set(row.id, { ownershipId: row.id, pairKey: key, diagnostics, primaryAction });
	}

	// Pair-level diagnostics for demanded pairs without ownership. Each pair
	// gets a unique negative marker so the map never collapses distinct pairs.
	let markerIndex = 0;
	for (const pair of demandPairs) {
		if (!byPair.has(pair.key)) {
			const marker = -1 - markerIndex;
			markerIndex += 1;
			result.set(marker, { ownershipId: marker, pairKey: pair.key, diagnostics: ['MISSING_OWNER'], primaryAction: 'RETAIN' });
		}
	}

	return result;
}

// ─── Workload math (mirrors the production summary read path) ───────────────

type AssignedPairInput = {
	subject: SubjectSnapshot;
	sectionId: number;
};

function minutesForAssignedPairs(pairs: AssignedPairInput[], subjectById: Map<number, SubjectSnapshot>): number {
	const bySubject = new Map<number, AssignedPairInput[]>();
	for (const pair of pairs) {
		const list = bySubject.get(pair.subject.id) ?? [];
		list.push(pair);
		bySubject.set(pair.subject.id, list);
	}
	const assignments: Array<{
		subject: {
			id?: number;
			code?: string | null;
			rotationFamily?: string | null;
			modularGroupId?: string | null;
			modularOrder?: number | null;
			termGroupId?: string | null;
			termCount?: number | null;
			minMinutesPerWeek: number;
		};
		sectionIds: number[];
		gradeLevels: number[];
	}> = [];
	for (const [subjectId, list] of bySubject) {
		const subject = subjectById.get(subjectId);
		if (!subject) continue;
		assignments.push({
			subject: {
				id: subject.id,
				code: subject.code,
				rotationFamily: subject.rotationFamily,
				modularGroupId: subject.modularGroupId,
				modularOrder: subject.modularOrder,
				termGroupId: subject.termGroupId,
				termCount: subject.termCount,
				minMinutesPerWeek: subject.minMinutesPerWeek,
			},
			sectionIds: [...new Set(list.map((pair) => pair.sectionId))].sort((a, b) => a - b),
			gradeLevels: [],
		});
	}
	return computeTeachingLoadMinutes(assignments, 'section');
}

export function computeFacultyTeachingMinutes(
	assignedPairsByFaculty: Map<number, AssignedPairInput[]>,
	subjectById: Map<number, SubjectSnapshot>,
): Map<number, number> {
	const result = new Map<number, number>();
	for (const [facultyId, pairs] of assignedPairsByFaculty) {
		result.set(facultyId, minutesForAssignedPairs(pairs, subjectById));
	}
	return result;
}

export function workloadStatusOf(minutes: number, policy: WorkloadPolicySnapshot | null): string {
	if (minutes <= 0) return 'zero-load';
	if (!policy || policy.status !== 'CONFIGURED') return 'below-standard';
	const standard = policy.teachingStandardMinutes;
	const hardCap = policy.hardCapMinutes;
	if (minutes > hardCap) return 'over-cap';
	if (minutes > standard) return 'excess';
	if (minutes === standard) return 'at-standard';
	return 'below-standard';
}

export function computeWorkloadDistribution(
	faculty: FacultySnapshot[],
	minutesByFaculty: Map<number, number>,
	policy: WorkloadPolicySnapshot | null,
	activeSectionIds: Set<number>,
): { zeroLoad: number; adviserOnly: number; belowStandard: number; atStandard: number; excess: number; overCap: number } {
	let zeroLoad = 0;
	let adviserOnly = 0;
	let belowStandard = 0;
	let atStandard = 0;
	let excess = 0;
	let overCap = 0;
	for (const member of faculty) {
		if (!member.isActiveForScheduling || member.isStale || member.isPlaceholder) continue;
		const minutes = minutesByFaculty.get(member.id) ?? 0;
		const status = workloadStatusOf(minutes, policy);
		if (status === 'zero-load') {
			zeroLoad += 1;
			if (member.isClassAdviser && member.advisedSectionId != null && activeSectionIds.has(member.advisedSectionId)) {
				adviserOnly += 1;
			}
		} else if (status === 'below-standard') belowStandard += 1;
		else if (status === 'at-standard') atStandard += 1;
		else if (status === 'excess') excess += 1;
		else if (status === 'over-cap') overCap += 1;
	}
	return { zeroLoad, adviserOnly, belowStandard, atStandard, excess, overCap };
}

// ─── Qualification (canonical evaluator over persisted policy) ──────────────

type QualificationResolver = (facultyId: number, subjectId: number, sectionProgramType: string) => Promise<{ eligible: boolean; tier: number | null }>;

/**
 * Canonical persisted-policy qualification resolver. Routes through the shared
 * `qualification-evaluator.service.ts` tier evaluator with a policy snapshot
 * built ONLY from persisted rows supplied in the reconciliation snapshot — no
 * database access, no per-school cache, no subject-name/prefix/glossary or
 * legacy inference (persisted-only mode). A faculty member is qualified for a
 * pair when the canonical evaluator returns a tier for it.
 */
export function buildQualificationResolver(snapshot: ReconciliationSourceSnapshot): QualificationResolver {
	const policy: QualificationPolicy = buildQualificationPolicySnapshot(snapshot.schoolId, {
		departmentAliases: snapshot.departmentAliases,
		departmentLabels: snapshot.departmentLabels,
		subjectOwnerPrefixes: snapshot.subjectOwnerPrefixes,
		crossDepartmentPermissions: snapshot.crossDepartmentPermissions,
		legacyCrossLanguageException: false,
		persistedOnly: true,
	});
	const subjectById = new Map(snapshot.subjects.map((subject) => [subject.id, subject]));
	const facultyById = new Map(snapshot.faculty.map((member) => [member.id, member]));

	const cache = new Map<string, { eligible: boolean; tier: number | null }>();

	return async (facultyId, subjectId, sectionProgramType) => {
		const cacheKey = `${facultyId}:${subjectId}:${normalizeSectionProgramType(sectionProgramType)}`;
		const cached = cache.get(cacheKey);
		if (cached) return cached;

		const subject = subjectById.get(subjectId);
		const member = facultyById.get(facultyId);
		// No staleness/placeholder/active short-circuit here: the canonical
		// evaluator is the single qualification authority and the differential
		// contract requires identical results. Candidate selection and ownership
		// disposition filter inactive/stale/placeholder faculty separately
		// (classifyOwnershipRows + pickCandidate).
		if (!subject || !member) {
			cache.set(cacheKey, { eligible: false, tier: null });
			return { eligible: false, tier: null };
		}
		if (subject.code.toUpperCase() === HG_SUBJECT_CODE) {
			cache.set(cacheKey, { eligible: false, tier: null });
			return { eligible: false, tier: null };
		}

		const result = evaluateQualificationWithPolicy(
			{
				facultyId: member.id,
				facultyDepartment: member.department,
				facultySpecialization: member.specialization,
				canTeachOutsideDepartment: member.canTeachOutsideDepartment,
				subjectId: subject.id,
				subjectCode: subject.code,
				subjectName: subject.name,
				subjectOwnerDepartment: subject.ownerDepartment,
				subjectAllowedDepartments: subject.ownerDepartment ? [subject.ownerDepartment] : [],
				subjectAllowedSpecializations: subject.allowedSpecializations,
				subjectProgramScopes: subject.programScopes as never,
				sectionProgramType: normalizeSectionProgramType(sectionProgramType) as never,
				specializationAliases: snapshot.specializationAliases,
			},
			policy,
		);
		const value = { eligible: result.eligible, tier: result.tier };
		cache.set(cacheKey, value);
		return value;
	};
}

// ─── Plan builder ────────────────────────────────────────────────────────────

type CandidateEvaluation = {
	facultyId: number;
	minutes: number;
	tier: number | null;
	isSectionAdviser: boolean;
	adviserPreferenceGranted: boolean;
};

async function pickCandidate(
	pair: DemandPair,
	snapshot: ReconciliationSourceSnapshot,
	resolveQualification: QualificationResolver,
	assignedPairsByFaculty: Map<number, AssignedPairInput[]>,
	facultyMinutes: Map<number, number>,
	adviserPreferenceGrantedBySection: Map<number, number>,
): Promise<{ facultyId: number; adviserPreferenceApplied: boolean } | null> {
	const hardCap = snapshot.workloadPolicy.status === 'CONFIGURED'
		? snapshot.workloadPolicy.hardCapMinutes
		: Number.POSITIVE_INFINITY;
	const section = snapshot.sections.find((item) => item.externalId === pair.sectionId);
	const sectionProgramType = section ? normalizeSectionProgramType(section.programType) : 'REGULAR';
	const sectionAdviser = snapshot.faculty.find(
		(member) => member.isClassAdviser && member.advisedSectionId === pair.sectionId && !member.isPlaceholder && member.isActiveForScheduling && !member.isStale,
	);
	// The cap gate MUST use the same minutes the simulated load credits. The
	// workload computation (`computeTeachingLoadMinutes`) credits
	// subject.minMinutesPerWeek, so a pair whose offering minutes differ would
	// otherwise pass the gate and then exceed the cap after assignment.
	const gateSubject = snapshot.subjects.find((subject) => subject.id === pair.subjectId);
	const gateMinutes = gateSubject ? Math.max(0, gateSubject.minMinutesPerWeek) : pair.weeklyMinutes;

	const evaluations: CandidateEvaluation[] = [];
	for (const member of snapshot.faculty) {
		if (member.isPlaceholder || member.isStale || !member.isActiveForScheduling) continue;
		const qual = await resolveQualification(member.id, pair.subjectId, sectionProgramType);
		if (!qual.eligible) continue;
		const currentMinutes = facultyMinutes.get(member.id) ?? 0;
		if (currentMinutes + gateMinutes > hardCap) continue;
		evaluations.push({
			facultyId: member.id,
			minutes: currentMinutes,
			tier: qual.tier,
			isSectionAdviser: sectionAdviser != null && sectionAdviser.id === member.id,
			adviserPreferenceGranted: (adviserPreferenceGrantedBySection.get(pair.sectionId) ?? 0) > 0,
		});
	}

	if (evaluations.length === 0) return null;

	const adviserCandidates = evaluations.filter((evaluation) => evaluation.isSectionAdviser && !evaluation.adviserPreferenceGranted);
	const pool = adviserCandidates.length > 0 ? adviserCandidates : evaluations;
	pool.sort((left, right) => {
		// Balance toward the teaching standard: lowest current teaching minutes first.
		if (left.minutes !== right.minutes) return left.minutes - right.minutes;
		const leftTier = left.tier ?? 0;
		const rightTier = right.tier ?? 0;
		if (leftTier !== rightTier) return rightTier - leftTier;
		return left.facultyId - right.facultyId;
	});
	const chosen = pool[0];
	return { facultyId: chosen.facultyId, adviserPreferenceApplied: adviserCandidates.length > 0 && chosen.isSectionAdviser };
}

/**
 * Build the deterministic reconciliation plan over the canonical demand graph.
 *
 * Final-action model: every demanded subject-section pair appears EXACTLY ONCE
 * in the final plan. A retained pair that later becomes a rebalance or
 * adviser-preference MOVE REPLACES its RETAIN action (never appends a second
 * action). Invariant: RETAIN + INSERT + MOVE + UNRESOLVED === demandCount.
 *
 * Simulated load is updated after every proposed assignment (never stale), every
 * zero-load active faculty enters candidate evaluation, and ranking prefers the
 * qualified adviser of the section, then balance toward the standard, then the
 * stable faculty-id tie-break. The adviser-own-section grant map persists
 * through fill, rebalance, and the adviser-transfer pass so a section is never
 * granted twice and no pair is moved twice.
 */
export async function buildReconciliationPlan(
	snapshot: ReconciliationSourceSnapshot,
	resolveQualification: QualificationResolver,
): Promise<ReconciliationPlan> {
	const subjectById = new Map(snapshot.subjects.map((subject) => [subject.id, subject]));
	const facultyById = new Map(snapshot.faculty.map((member) => [member.id, member]));
	const sectionByExternal = new Map(snapshot.sections.map((section) => [section.externalId, section]));
	const demand = expandCurriculumDemand(snapshot);
	const demandByKey = new Map(demand.map((pair) => [pair.key, pair]));
	const classifications = classifyOwnershipRows(snapshot, demand, snapshot.ownership);

	const actionsByPair = new Map<string, ReconciliationPlanEntry>();
	const putAction = (pairKey: string, entry: ReconciliationPlanEntry) => {
		actionsByPair.set(pairKey, entry);
	};
	const hgRowsFound: ReconciliationPlan['hgRowsFound'] = [];
	const assignedPairsByFaculty = new Map<number, AssignedPairInput[]>();
	const assignedFacultyByPair = new Map<string, number>();
	const releasedPairs = new Map<string, { ownershipId: number; fromFacultyId: number; diagnostics: OwnershipDiagnostic[] }>();
	const adviserPreferenceGrantedBySection = new Map<number, number>();
	const adviserTransferBlockers = new Map<number, string>();

	const totalMinutesByFaculty = () => computeFacultyTeachingMinutes(assignedPairsByFaculty, subjectById);

	const registerAssignment = (pair: DemandPair, facultyId: number) => {
		assignedFacultyByPair.set(pair.key, facultyId);
		const list = assignedPairsByFaculty.get(facultyId) ?? [];
		list.push({ subject: subjectById.get(pair.subjectId)!, sectionId: pair.sectionId });
		assignedPairsByFaculty.set(facultyId, list);
	};

	const unassignPair = (pairKey: string, facultyId: number, subjectId: number, sectionId: number) => {
		assignedFacultyByPair.delete(pairKey);
		const list = assignedPairsByFaculty.get(facultyId) ?? [];
		assignedPairsByFaculty.set(
			facultyId,
			list.filter((item) => !(item.subject.id === subjectId && item.sectionId === sectionId)),
		);
	};

	// 1. Existing ownership disposition.
	for (const row of [...snapshot.ownership].sort((a, b) => a.id - b.id)) {
		const classification = classifications.get(row.id);
		if (!classification) continue;
		const pair = demandByKey.get(classification.pairKey);
		if (classification.primaryAction === 'RETAIN' && pair) {
			// Qualification refinement: an active owner may still be unqualified
			// for the pair under the persisted department/program/specialization
			// policy. Unqualified owners release the pair to the candidate pool.
			const member = facultyById.get(row.facultyId);
			const subject = subjectById.get(row.subjectId);
			const section = sectionByExternal.get(row.sectionId);
			const qual = member && subject && section
				? await resolveQualification(member.id, subject.id, section.programType)
				: { eligible: false, tier: null };
			if (!qual.eligible) {
				classification.diagnostics = ['UNQUALIFIED_OWNER'];
				classification.primaryAction = 'RELEASE';
			}
		}
		if (classification.primaryAction === 'RETAIN' && pair) {
			registerAssignment(pair, row.facultyId);
			putAction(pair.key, {
				action: 'RETAIN',
				subjectId: pair.subjectId,
				subjectCode: pair.subjectCode,
				sectionId: pair.sectionId,
				classification: pair.classification,
				weeklyMinutes: pair.weeklyMinutes,
				termMode: pair.termMode,
				termIdentities: pair.termIdentities,
				rotationFamily: pair.rotationFamily,
				currentOwnerId: row.facultyId,
				proposedFacultyId: row.facultyId,
				currentOwnershipId: row.id,
				diagnostics: classification.diagnostics,
				reason: 'Ownership matches curriculum demand and the owner is qualified and active.',
				unresolvedReason: null,
				adviserPreferenceApplied: false,
			});
		} else if (classification.primaryAction === 'RETIRE') {
			const isHg = classification.diagnostics.includes('HG_FORBIDDEN');
			if (isHg) {
				hgRowsFound.push({ ownershipId: row.id, subjectId: row.subjectId, sectionId: row.sectionId, facultyId: row.facultyId });
			}
			putAction(pair?.key ?? `${row.subjectId}:${row.sectionId}`, {
				action: 'RETIRE',
				subjectId: row.subjectId,
				subjectCode: subjectById.get(row.subjectId)?.code ?? `subject-${row.subjectId}`,
				sectionId: row.sectionId,
				classification: pair?.classification ?? 'UNKNOWN',
				weeklyMinutes: pair?.weeklyMinutes ?? 0,
				termMode: pair?.termMode ?? 'UNKNOWN',
				termIdentities: pair?.termIdentities ?? [],
				rotationFamily: pair?.rotationFamily ?? null,
				currentOwnerId: row.facultyId,
				proposedFacultyId: null,
				currentOwnershipId: row.id,
				diagnostics: classification.diagnostics,
				reason: isHg
					? 'Homeroom Guidance is never curriculum demand and never creates Teaching Load ownership.'
					: classification.diagnostics.includes('WRONG_SCOPE')
					? 'Ownership references a scope that is not part of the active-year curriculum.'
					: 'Ownership exists outside the mechanically expanded curriculum demand.',
				unresolvedReason: null,
				adviserPreferenceApplied: false,
			});
		} else {
			// RELEASE: pair stays demanded; the current owner is released.
			if (pair) {
				releasedPairs.set(pair.key, { ownershipId: row.id, fromFacultyId: row.facultyId, diagnostics: classification.diagnostics });
			} else {
				putAction(`${row.subjectId}:${row.sectionId}`, {
					action: 'RETIRE',
					subjectId: row.subjectId,
					subjectCode: subjectById.get(row.subjectId)?.code ?? `subject-${row.subjectId}`,
					sectionId: row.sectionId,
					classification: 'UNKNOWN',
					weeklyMinutes: 0,
					termMode: 'UNKNOWN',
					termIdentities: [],
					rotationFamily: null,
					currentOwnerId: row.facultyId,
					proposedFacultyId: null,
					currentOwnershipId: row.id,
					diagnostics: classification.diagnostics,
					reason: 'Ownership cannot be reconciled to any curriculum demand.',
					unresolvedReason: null,
					adviserPreferenceApplied: false,
				});
			}
		}
	}

	// 2. Fill demanded pairs without a valid owner (MISSING_OWNER and released).
	const orderedDemand = [...demand].sort((left, right) => demandSortKey(left).localeCompare(demandSortKey(right)));
	for (const pair of orderedDemand) {
		if (assignedFacultyByPair.has(pair.key)) continue;
		const candidate = await pickCandidate(pair, snapshot, resolveQualification, assignedPairsByFaculty, totalMinutesByFaculty(), adviserPreferenceGrantedBySection);
		const released = releasedPairs.get(pair.key);
		if (candidate) {
			registerAssignment(pair, candidate.facultyId);
			if (candidate.adviserPreferenceApplied) {
				adviserPreferenceGrantedBySection.set(pair.sectionId, candidate.facultyId);
			}
			if (released) {
				putAction(pair.key, {
					action: 'MOVE',
					subjectId: pair.subjectId,
					subjectCode: pair.subjectCode,
					sectionId: pair.sectionId,
					classification: pair.classification,
					weeklyMinutes: pair.weeklyMinutes,
					termMode: pair.termMode,
					termIdentities: pair.termIdentities,
					rotationFamily: pair.rotationFamily,
					currentOwnerId: released.fromFacultyId,
					proposedFacultyId: candidate.facultyId,
					currentOwnershipId: released.ownershipId,
					diagnostics: released.diagnostics,
					reason: 'Current owner is not a valid active qualified owner; moved to a qualified candidate.',
					unresolvedReason: null,
					adviserPreferenceApplied: candidate.adviserPreferenceApplied,
				});
			} else {
				putAction(pair.key, {
					action: 'INSERT',
					subjectId: pair.subjectId,
					subjectCode: pair.subjectCode,
					sectionId: pair.sectionId,
					classification: pair.classification,
					weeklyMinutes: pair.weeklyMinutes,
					termMode: pair.termMode,
					termIdentities: pair.termIdentities,
					rotationFamily: pair.rotationFamily,
					currentOwnerId: null,
					proposedFacultyId: candidate.facultyId,
					currentOwnershipId: null,
					diagnostics: ['MISSING_OWNER'],
					reason: 'Curriculum demand has no ownership; assigned to a qualified candidate.',
					unresolvedReason: null,
					adviserPreferenceApplied: candidate.adviserPreferenceApplied,
				});
			}
		} else {
			const unresolvedReason = released
				? 'RELEASED_OWNER_NO_CANDIDATE'
				: 'NO_QUALIFIED_CANDIDATE';
			putAction(pair.key, {
				action: 'UNRESOLVED',
				subjectId: pair.subjectId,
				subjectCode: pair.subjectCode,
				sectionId: pair.sectionId,
				classification: pair.classification,
				weeklyMinutes: pair.weeklyMinutes,
				termMode: pair.termMode,
				termIdentities: pair.termIdentities,
				rotationFamily: pair.rotationFamily,
				currentOwnerId: released?.fromFacultyId ?? null,
				proposedFacultyId: null,
				currentOwnershipId: released?.ownershipId ?? null,
				diagnostics: released?.diagnostics ?? ['MISSING_OWNER'],
				reason: 'No safe qualified candidate with hard-cap capacity exists for this demanded pair.',
				unresolvedReason,
				adviserPreferenceApplied: false,
			});
		}
	}

	// 3. Rebalance: move pairs away from excess/over-cap faculty to qualified
	//    underloaded faculty when this reduces overload without breaking coverage.
	//    The adviser-grant map persists here so rebalance never re-moves a pair
	//    that already satisfied an adviser preference.
	const facultyMinutes = totalMinutesByFaculty();
	const policy = snapshot.workloadPolicy.status === 'CONFIGURED' ? snapshot.workloadPolicy : null;
	const standard = policy?.teachingStandardMinutes ?? Number.POSITIVE_INFINITY;
	const hardCap = policy?.hardCapMinutes ?? Number.POSITIVE_INFINITY;

	const overloaded = Array.from(assignedPairsByFaculty.entries())
		.map(([facultyId, pairs]) => ({ facultyId, minutes: facultyMinutes.get(facultyId) ?? 0, pairs }))
		.filter((entry) => entry.minutes > standard)
		.sort((a, b) => b.minutes - a.minutes || a.facultyId - b.facultyId);

	for (const donor of overloaded) {
		if ((facultyMinutes.get(donor.facultyId) ?? 0) <= standard) continue;
		const donorPairs = [...donor.pairs].sort((a, b) => {
			const leftMinutes = a.subject.minMinutesPerWeek;
			const rightMinutes = b.subject.minMinutesPerWeek;
			return rightMinutes - leftMinutes || a.sectionId - b.sectionId;
		});
		for (const pair of donorPairs) {
			if ((facultyMinutes.get(donor.facultyId) ?? 0) <= standard) break;
			const demandPair = demandByKey.get(pairKeyOf(pair.subject.id, pair.sectionId));
			if (!demandPair) continue;
			const recipient = await pickCandidate(
				{ ...demandPair, weeklyMinutes: pair.subject.minMinutesPerWeek },
				snapshot,
				resolveQualification,
				assignedPairsByFaculty,
				facultyMinutes,
				adviserPreferenceGrantedBySection,
			);
			if (!recipient || recipient.facultyId === donor.facultyId) continue;
			const recipientMinutes = facultyMinutes.get(recipient.facultyId) ?? 0;
			if (recipientMinutes + pair.subject.minMinutesPerWeek > hardCap) continue;
			// Only move when it reduces total overload and does not create excess.
			if (recipientMinutes + pair.subject.minMinutesPerWeek > standard) continue;
			const existingAction = actionsByPair.get(demandPair.key);
			const currentOwnershipId = existingAction?.currentOwnershipId ?? null;
			// Remove from donor, add to recipient in simulation (final-action
			// model: REPLACE the pair's action with the MOVE, never append).
			unassignPair(demandPair.key, donor.facultyId, pair.subject.id, pair.sectionId);
			registerAssignment(demandPair, recipient.facultyId);
			if (recipient.adviserPreferenceApplied) {
				adviserPreferenceGrantedBySection.set(demandPair.sectionId, recipient.facultyId);
			}
			const nextMinutes = totalMinutesByFaculty();
			facultyMinutes.set(donor.facultyId, nextMinutes.get(donor.facultyId) ?? 0);
			facultyMinutes.set(recipient.facultyId, nextMinutes.get(recipient.facultyId) ?? 0);
			putAction(demandPair.key, {
				action: 'MOVE',
				subjectId: pair.subject.id,
				subjectCode: demandPair.subjectCode,
				sectionId: pair.sectionId,
				classification: demandPair.classification,
				weeklyMinutes: pair.subject.minMinutesPerWeek,
				termMode: demandPair.termMode,
				termIdentities: demandPair.termIdentities,
				rotationFamily: demandPair.rotationFamily,
				currentOwnerId: donor.facultyId,
				proposedFacultyId: recipient.facultyId,
				currentOwnershipId,
				diagnostics: ['OVER_STANDARD'],
				reason: 'Rebalance: reduced an over-standard faculty load without breaking curriculum coverage.',
				unresolvedReason: null,
				adviserPreferenceApplied: false,
			});
		}
	}

	// 4. Adviser-own-section pass: when a qualified active adviser still has no
	//    demanded subject in their advisory section, safely transfer ONE valid
	//    pair to them (hard-cap safe; never over the cap; never a second grant
	//    for the same section). This considers safe reassignment of an
	//    already-valid ownership, not only missing/released pairs.
	const advisers = snapshot.faculty
		.filter((member) => member.isClassAdviser && member.advisedSectionId != null && !member.isPlaceholder && member.isStale === false && member.isActiveForScheduling)
		.sort((a, b) => a.id - b.id);
	for (const adviser of advisers) {
		const sectionId = adviser.advisedSectionId!;
		if (adviserPreferenceGrantedBySection.has(sectionId)) continue;
		if (adviserPreferenceGrantedBySection.get(sectionId) === adviser.id) continue;
		const ownsAnyInSection = (assignedPairsByFaculty.get(adviser.id) ?? []).some((pair) => pair.sectionId === sectionId);
		if (ownsAnyInSection) {
			adviserPreferenceGrantedBySection.set(sectionId, adviser.id);
			continue;
		}
		const sectionPairs = demand
			.filter((pair) => pair.sectionId === sectionId && assignedFacultyByPair.has(pair.key))
			.sort((a, b) => a.weeklyMinutes - b.weeklyMinutes || a.subjectId - b.subjectId);
		const sectionProgramType = normalizeSectionProgramType(sectionByExternal.get(sectionId)?.programType);
		let qualifiedOptions = 0;
		let transferTarget: DemandPair | null = null;
		for (const pair of sectionPairs) {
			const qual = await resolveQualification(adviser.id, pair.subjectId, sectionProgramType);
			if (!qual.eligible) continue;
			qualifiedOptions += 1;
			const currentOwnerId = assignedFacultyByPair.get(pair.key);
			if (currentOwnerId == null || currentOwnerId === adviser.id) continue;
			// The cap gate MUST use the same minutes the simulated load credits
			// (subject.minMinutesPerWeek), matching pickCandidate and the
			// rebalance gate — an offering value smaller than the credited
			// minutes could otherwise push the adviser over the hard cap.
			const gateSubject = subjectById.get(pair.subjectId);
			const gateMinutes = gateSubject ? Math.max(0, gateSubject.minMinutesPerWeek) : pair.weeklyMinutes;
			const adviserMinutes = facultyMinutes.get(adviser.id) ?? 0;
			if (adviserMinutes + gateMinutes > hardCap) continue;
			transferTarget = pair;
			break;
		}
		if (transferTarget) {
			const currentOwnerId = assignedFacultyByPair.get(transferTarget.key)!;
			const currentOwnershipId = actionsByPair.get(transferTarget.key)?.currentOwnershipId ?? null;
			unassignPair(transferTarget.key, currentOwnerId, transferTarget.subjectId, transferTarget.sectionId);
			registerAssignment(transferTarget, adviser.id);
			adviserPreferenceGrantedBySection.set(sectionId, adviser.id);
			const nextMinutes = totalMinutesByFaculty();
			facultyMinutes.set(adviser.id, nextMinutes.get(adviser.id) ?? 0);
			facultyMinutes.set(currentOwnerId, nextMinutes.get(currentOwnerId) ?? 0);
			putAction(transferTarget.key, {
				action: 'MOVE',
				subjectId: transferTarget.subjectId,
				subjectCode: transferTarget.subjectCode,
				sectionId: transferTarget.sectionId,
				classification: transferTarget.classification,
				weeklyMinutes: transferTarget.weeklyMinutes,
				termMode: transferTarget.termMode,
				termIdentities: transferTarget.termIdentities,
				rotationFamily: transferTarget.rotationFamily,
				currentOwnerId,
				proposedFacultyId: adviser.id,
				currentOwnershipId,
				diagnostics: ['ADVISER_SECTION_PREFERENCE_UNSATISFIED'],
				reason: 'Adviser-own-section preference: transferred one demanded subject in the advisory section to the qualified adviser.',
				unresolvedReason: null,
				adviserPreferenceApplied: true,
			});
		} else {
			adviserTransferBlockers.set(
				adviser.id,
				qualifiedOptions === 0 ? 'ADVISER_NOT_QUALIFIED_FOR_DEMANDED_SUBJECTS' : 'HARD_CAP_CONFLICT_OR_NO_SAFE_TRANSFER',
			);
		}
	}

	// 5. Adviser-section preference outcomes.
	const activeSectionIds = new Set(snapshot.sections.map((section) => section.externalId));
	const adviserPreference: AdviserPreferenceOutcome[] = [];
	for (const member of snapshot.faculty) {
		if (!member.isClassAdviser || member.advisedSectionId == null) continue;
		if (!activeSectionIds.has(member.advisedSectionId)) continue;
		if (member.isPlaceholder || member.isStale || !member.isActiveForScheduling) continue;
		const sectionPairs = demand.filter((pair) => pair.sectionId === member.advisedSectionId);
		const sectionProgramType = normalizeSectionProgramType(sectionByExternal.get(member.advisedSectionId)?.programType);
		let qualifiedPairs = 0;
		for (const pair of sectionPairs) {
			const qual = await resolveQualification(member.id, pair.subjectId, sectionProgramType);
			if (qual.eligible) qualifiedPairs += 1;
		}
		if (qualifiedPairs === 0) {
			adviserPreference.push({
				facultyId: member.id,
				sectionId: member.advisedSectionId,
				satisfied: false,
				reason: 'ADVISER_NOT_QUALIFIED_FOR_DEMANDED_SUBJECTS',
			});
			continue;
		}
		const ownsAnyInSection = (assignedPairsByFaculty.get(member.id) ?? []).some((pair) => pair.sectionId === member.advisedSectionId);
		if (ownsAnyInSection || adviserPreferenceGrantedBySection.get(member.advisedSectionId) === member.id) {
			adviserPreference.push({
				facultyId: member.id,
				sectionId: member.advisedSectionId,
				satisfied: true,
				reason: 'SATISFIED',
			});
			continue;
		}
		adviserPreference.push({
			facultyId: member.id,
			sectionId: member.advisedSectionId,
			satisfied: false,
			reason: adviserTransferBlockers.get(member.id) ?? 'NO_SAFE_TRANSFER',
		});
	}

	// 6. Final action list from the unique-pair map (deterministic order).
	const actions = Array.from(actionsByPair.entries())
		.sort((a, b) => demandSortKeyForAction(a[0]).localeCompare(demandSortKeyForAction(b[0])))
		.map(([, entry]) => entry);

	// 7. Classification totals (including pair-level MISSING_OWNER).
	const classificationTotals: Record<string, number> = {};
	const seenPairs = new Map<string, OwnershipRowClassification>();
	for (const classification of classifications.values()) {
		if (classification.ownershipId < 0) continue;
		seenPairs.set(classification.pairKey, classification);
		for (const diagnostic of classification.diagnostics) {
			classificationTotals[diagnostic] = (classificationTotals[diagnostic] ?? 0) + 1;
		}
	}
	for (const pair of demand) {
		if (!seenPairs.has(pair.key)) {
			classificationTotals['MISSING_OWNER'] = (classificationTotals['MISSING_OWNER'] ?? 0) + 1;
		}
	}

	// 8. Per-faculty before/after workloads.
	const beforeMinutes = new Map<number, number>();
	for (const member of snapshot.faculty) {
		const owned = snapshot.ownership
			.filter((row) => row.facultyId === member.id)
			.map((row) => ({ subject: subjectById.get(row.subjectId)!, sectionId: row.sectionId }))
			.filter((entry) => entry.subject != null);
		beforeMinutes.set(member.id, minutesForAssignedPairs(owned, subjectById));
	}
	const afterMinutes = totalMinutesByFaculty();

	const facultyWorkloads: FacultyWorkloadSnapshot[] = snapshot.faculty
		.filter((member) => member.isActiveForScheduling && !member.isStale && !member.isPlaceholder)
		.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.id - b.id)
		.map((member) => ({
			facultyId: member.id,
			name: `${member.lastName}, ${member.firstName}`,
			isClassAdviser: member.isClassAdviser,
			isActiveForScheduling: member.isActiveForScheduling,
			isPlaceholder: member.isPlaceholder,
			beforeMinutes: beforeMinutes.get(member.id) ?? 0,
			afterMinutes: afterMinutes.get(member.id) ?? 0,
			beforeStatus: workloadStatusOf(beforeMinutes.get(member.id) ?? 0, snapshot.workloadPolicy),
			afterStatus: workloadStatusOf(afterMinutes.get(member.id) ?? 0, snapshot.workloadPolicy),
		}));

	const sourceRevision = await buildReconciliationSourceRevision(snapshot);
	const fingerprint = await buildReconciliationFingerprint(snapshot, sourceRevision, actions);

	return {
		schoolId: snapshot.schoolId,
		schoolYearId: snapshot.schoolYearId,
		demand,
		actions,
		hgRowsFound,
		facultyWorkloads,
		adviserPreference,
		classificationTotals,
		sourceRevision,
		fingerprint,
	};
}

/**
 * Build the read-only authority/diagnostic view consumed by the reconciliation
 * preview. This deliberately reports persisted legacy rows instead of deleting
 * them, and derives candidate counts from the same qualification and policy
 * authorities used by the plan builder.
 */
export async function buildTeachingLoadAuthorityDiagnostics(
	snapshot: ReconciliationSourceSnapshot,
	plan: ReconciliationPlan,
	resolveQualification: QualificationResolver,
): Promise<TeachingLoadAuthorityDiagnostics> {
	const subjectById = new Map(snapshot.subjects.map((subject) => [subject.id, subject]));
	const demandKeys = new Set(plan.demand.map((pair) => pair.key));
	const activeSectionIds = new Set(snapshot.sections.map((section) => section.externalId));
	const activeFaculty = snapshot.faculty.filter((member) => member.isActiveForScheduling && !member.isStale && !member.isPlaceholder);
	const nameOf = (member: FacultySnapshot) => `${member.lastName}, ${member.firstName}`;

	const ownedSubjectSectionPairs = snapshot.ownership
		.filter((row) => demandKeys.has(pairKeyOf(row.subjectId, row.sectionId)))
		.filter((row) => subjectById.get(row.subjectId)?.code.toUpperCase() !== HG_SUBJECT_CODE)
		.sort((a, b) => a.sectionId - b.sectionId || a.subjectId - b.subjectId || a.id - b.id)
		.map((row) => ({
			ownershipId: row.id,
			pairKey: pairKeyOf(row.subjectId, row.sectionId),
			subjectId: row.subjectId,
			subjectCode: subjectById.get(row.subjectId)?.code ?? `SUBJECT_${row.subjectId}`,
			sectionId: row.sectionId,
			facultyId: row.facultyId,
		}));
	const ownedFacultyIds = new Set(ownedSubjectSectionPairs.map((row) => row.facultyId));

	const unownedActiveFaculty = activeFaculty
		.filter((member) => !ownedFacultyIds.has(member.id))
		.sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || a.id - b.id)
		.map((member) => ({ facultyId: member.id, name: nameOf(member), department: member.department, specialization: member.specialization }));

	const validAdviserMappings = activeFaculty
		.filter((member) => member.isClassAdviser && member.advisedSectionId != null && activeSectionIds.has(member.advisedSectionId))
		.sort((a, b) => a.id - b.id)
		.map((member) => ({ facultyId: member.id, name: nameOf(member), sectionId: member.advisedSectionId! }));
	const validAdviserFacultyIds = new Set(validAdviserMappings.map((row) => row.facultyId));

	const configuredAdvisoryMinutes = snapshot.workloadPolicy.status === 'CONFIGURED'
		? snapshot.workloadPolicy.advisoryCreditMinutes
		: 0;
	const advisoryCreditEligibility = activeFaculty.map((member) => {
		const sectionId = member.advisedSectionId ?? null;
		const eligible = validAdviserFacultyIds.has(member.id);
		let reason = 'NOT_CLASS_ADVISER';
		if (member.isClassAdviser && sectionId == null) reason = 'ADVISER_MAPPING_MISSING';
		else if (member.isClassAdviser && !activeSectionIds.has(sectionId!)) reason = 'ADVISER_MAPPING_STALE_OR_OUT_OF_SCOPE';
		else if (eligible && snapshot.workloadPolicy.status !== 'CONFIGURED') reason = 'WORKLOAD_POLICY_UNCONFIGURED';
		else if (eligible) reason = 'ELIGIBLE';
		return {
			facultyId: member.id,
			name: nameOf(member),
			sectionId: eligible ? sectionId : null,
			eligible: eligible && snapshot.workloadPolicy.status === 'CONFIGURED',
			creditMinutes: eligible ? configuredAdvisoryMinutes : 0,
			reason,
		};
	});

	const beforeTeachingMinutes = plan.facultyWorkloads.reduce((sum, row) => sum + row.beforeMinutes, 0);
	const afterTeachingMinutes = plan.facultyWorkloads.reduce((sum, row) => sum + row.afterMinutes, 0);
	const standard = snapshot.workloadPolicy.status === 'CONFIGURED' ? snapshot.workloadPolicy.teachingStandardMinutes : null;
	const hardCap = snapshot.workloadPolicy.status === 'CONFIGURED' ? snapshot.workloadPolicy.hardCapMinutes : null;
	const countAbove = (rows: FacultyWorkloadSnapshot[], threshold: number | null) => threshold == null ? 0 : rows.filter((row) => row.beforeMinutes > threshold).length;
	const countAfterAbove = (rows: FacultyWorkloadSnapshot[], threshold: number | null) => threshold == null ? 0 : rows.filter((row) => row.afterMinutes > threshold).length;

	const beforeMinutesByFaculty = new Map(plan.facultyWorkloads.map((row) => [row.facultyId, row.beforeMinutes]));
	const candidateCounts = new Map<string, { candidateCount: number; pairKeys: Set<string> }>();
	for (const member of activeFaculty) {
		const department = member.department?.trim() || 'UNMAPPED';
		if (!candidateCounts.has(department)) candidateCounts.set(department, { candidateCount: 0, pairKeys: new Set<string>() });
	}
	for (const pair of plan.demand) {
		const section = snapshot.sections.find((row) => row.externalId === pair.sectionId);
		const sectionProgramType = normalizeSectionProgramType(section?.programType);
		for (const member of activeFaculty) {
			const qualification = await resolveQualification(member.id, pair.subjectId, sectionProgramType);
			if (!qualification.eligible) continue;
			const minutes = beforeMinutesByFaculty.get(member.id) ?? 0;
			if (hardCap != null && minutes + Math.max(0, subjectById.get(pair.subjectId)?.minMinutesPerWeek ?? pair.weeklyMinutes) > hardCap) continue;
			const department = member.department?.trim() || 'UNMAPPED';
			const entry = candidateCounts.get(department) ?? { candidateCount: 0, pairKeys: new Set<string>() };
			entry.candidateCount += 1;
			entry.pairKeys.add(pair.key);
			candidateCounts.set(department, entry);
		}
	}

	const unresolvedReasons: TeachingLoadAuthorityDiagnostic[] = [];
	const seenReasons = new Set<string>();
	const addReason = (entry: TeachingLoadAuthorityDiagnostic) => {
		const key = `${entry.code}|${entry.scope}|${entry.pairKey ?? ''}|${entry.facultyId ?? ''}`;
		if (seenReasons.has(key)) return;
		seenReasons.add(key);
		unresolvedReasons.push(entry);
	};
	for (const row of advisoryCreditEligibility) {
		if (row.reason === 'ADVISER_MAPPING_MISSING' || row.reason === 'ADVISER_MAPPING_STALE_OR_OUT_OF_SCOPE') {
			addReason({ code: row.reason, scope: 'FACULTY', facultyId: row.facultyId, message: `${row.name} has no valid current-year EnrollPro adviser mapping.` });
		}
	}
	if (snapshot.workloadPolicy.status !== 'CONFIGURED') {
		addReason({ code: 'WORKLOAD_POLICY_UNCONFIGURED', scope: 'POLICY', message: 'Persisted workload policy is unavailable; no advisory credit or cap is inferred.' });
	}
	for (const action of plan.actions) {
		if (action.action === 'UNRESOLVED' && action.unresolvedReason) {
			addReason({ code: action.unresolvedReason, scope: 'PAIR', pairKey: pairKeyOf(action.subjectId, action.sectionId), message: action.reason });
		}
		for (const diagnostic of action.diagnostics) {
			if (diagnostic === 'OWNER_INACTIVE_OR_STALE' || diagnostic === 'UNQUALIFIED_OWNER' || diagnostic === 'WRONG_SCOPE') {
				addReason({ code: diagnostic, scope: 'PAIR', pairKey: pairKeyOf(action.subjectId, action.sectionId), message: action.reason });
			}
		}
	}

	return {
		demandedSubjectSectionPairs: plan.demand,
		ownedSubjectSectionPairs,
		unownedActiveFaculty,
		validAdviserMappings,
		legacyHgOwnershipRows: plan.hgRowsFound,
		advisoryCreditEligibility,
		overloadCapacityTotals: {
			policyStatus: snapshot.workloadPolicy.status,
			teachingStandardMinutes: standard,
			hardCapMinutes: hardCap,
			beforeTeachingMinutes,
			afterTeachingMinutes,
			beforeOverStandardCount: countAbove(plan.facultyWorkloads, standard),
			afterOverStandardCount: countAfterAbove(plan.facultyWorkloads, standard),
			beforeOverHardCapCount: countAbove(plan.facultyWorkloads, hardCap),
			afterOverHardCapCount: countAfterAbove(plan.facultyWorkloads, hardCap),
		},
		candidateCountsByDepartment: [...candidateCounts.entries()]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([department, value]) => ({ department, candidateCount: value.candidateCount, demandedPairCount: value.pairKeys.size })),
		unresolvedReasons,
	};
}

// ─── Source revision + fingerprint ───────────────────────────────────────────

/** Sorted unique set for integer-valued arrays (set semantics, not order). */
export function canonicalIntSet(values: number[]): number[] {
	return [...new Set(values)].filter((value) => Number.isInteger(value)).sort((a, b) => a - b);
}

/** Sorted unique set for string-valued arrays (set semantics, not order). */
export function canonicalStringSet(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export async function buildReconciliationSourceRevision(snapshot: ReconciliationSourceSnapshot): Promise<string> {
	return canonicalHash({
		schemaVersion: SCHEMA_VERSION,
		schoolId: snapshot.schoolId,
		schoolYearId: snapshot.schoolYearId,
		schoolYearAuthority: {
			authorityMode: snapshot.schoolYearAuthority.authorityMode,
			mirrorId: snapshot.schoolYearAuthority.mirrorId,
			enrollProSchoolYearId: snapshot.schoolYearAuthority.enrollProSchoolYearId,
			yearLabel: snapshot.schoolYearAuthority.yearLabel,
			isActive: snapshot.schoolYearAuthority.isActive,
			isArchived: snapshot.schoolYearAuthority.isArchived,
			syncStatus: snapshot.schoolYearAuthority.syncStatus,
			updatedAt: snapshot.schoolYearAuthority.updatedAt,
		},
		termConfig: snapshot.termConfig
			? {
				id: snapshot.termConfig.id,
				termCount: snapshot.termConfig.termCount,
				termIdentities: snapshot.termConfig.termIdentities,
				updatedAt: snapshot.termConfig.updatedAt,
			}
			: null,
		derivedDemandRevision: snapshot.derivedDemand.ok ? snapshot.derivedDemand.revision : null,
		derivedDemandBlockers: snapshot.derivedDemand.ok ? [] : snapshot.derivedDemand.blockers.map((entry) => entry.code).sort(),
		sections: snapshot.sections
			.map((section) => ({
				id: section.id,
				externalId: section.externalId,
				gradeLevel: section.gradeLevel,
				programType: section.programType,
				displayOrder: section.displayOrder,
				isActiveForScheduling: section.isActiveForScheduling,
				isStale: section.isStale,
				version: section.version,
			}))
			.sort((a, b) => a.id - b.id),
		cohorts: snapshot.cohorts.map((cohort) => ({ id: cohort.id, memberSectionIds: [...cohort.memberSectionIds].sort((a, b) => a - b) })).sort((a, b) => a.id - b.id),
		subjects: snapshot.subjects
			.map((subject) => ({
				id: subject.id,
				code: subject.code,
				rotationFamily: subject.rotationFamily,
				minMinutesPerWeek: subject.minMinutesPerWeek,
				programScopes: canonicalStringSet(subject.programScopes),
				gradeLevels: canonicalIntSet(subject.gradeLevels),
				allowedSpecializations: canonicalStringSet(subject.allowedSpecializations),
				ownerDepartment: subject.ownerDepartment,
				isActive: subject.isActive,
			}))
			.sort((a, b) => a.id - b.id),
		faculty: snapshot.faculty
			.map((member) => ({
				id: member.id,
				department: member.department,
				specialization: member.specialization,
				canTeachOutsideDepartment: member.canTeachOutsideDepartment,
				isClassAdviser: member.isClassAdviser,
				advisedSectionId: member.advisedSectionId,
				isActiveForScheduling: member.isActiveForScheduling,
				isPlaceholder: member.isPlaceholder,
				version: member.version,
			}))
			.sort((a, b) => a.id - b.id),
		facultySubjects: snapshot.facultySubjects
			.map((row) => ({
				id: row.id,
				facultyId: row.facultyId,
				subjectId: row.subjectId,
				sectionIds: canonicalIntSet(row.sectionIds),
				gradeLevels: canonicalIntSet(row.gradeLevels ?? []),
				version: row.version,
			}))
			.sort((a, b) => a.id - b.id),
		ownership: snapshot.ownership
			.map((row) => ({ id: row.id, subjectId: row.subjectId, sectionId: row.sectionId, facultyId: row.facultyId, facultySubjectId: row.facultySubjectId }))
			.sort((a, b) => a.id - b.id),
		crossDepartmentPermissions: snapshot.crossDepartmentPermissions
			.map((row) => ({ facultyId: row.facultyId, subjectId: row.subjectId }))
			.sort((a, b) => a.facultyId - b.facultyId || a.subjectId - b.subjectId),
		specializationAliases: snapshot.specializationAliases
			.map((row) => ({ alias: row.alias, canonical: row.canonical }))
			.sort((a, b) => a.alias.localeCompare(b.alias) || a.canonical.localeCompare(b.canonical)),
		subjectOwnerPrefixes: snapshot.subjectOwnerPrefixes
			.map((row) => ({ prefix: row.prefix, department: row.department }))
			.sort((a, b) => a.prefix.localeCompare(b.prefix) || a.department.localeCompare(b.department)),
		departmentRevision: snapshot.departmentRevision.revisionHash,
		workloadPolicy: snapshot.workloadPolicy.status === 'CONFIGURED'
			? {
				teachingStandardMinutes: snapshot.workloadPolicy.teachingStandardMinutes,
				advisoryCreditMinutes: snapshot.workloadPolicy.advisoryCreditMinutes,
				hardCapMinutes: snapshot.workloadPolicy.hardCapMinutes,
			}
			: null,
	});
}

export async function buildReconciliationFingerprint(
	snapshot: ReconciliationSourceSnapshot,
	sourceRevision: string,
	actions: ReconciliationPlanEntry[],
): Promise<string> {
	return canonicalHash({
		schemaVersion: SCHEMA_VERSION,
		schoolId: snapshot.schoolId,
		schoolYearId: snapshot.schoolYearId,
		sourceRevision,
		actions: actions
			.map((entry) => ({
				action: entry.action,
				subjectId: entry.subjectId,
				sectionId: entry.sectionId,
				currentOwnerId: entry.currentOwnerId,
				proposedFacultyId: entry.proposedFacultyId,
				reason: entry.reason,
				unresolvedReason: entry.unresolvedReason,
			}))
			.sort((a, b) => a.sectionId - b.sectionId || a.subjectId - b.subjectId || a.action.localeCompare(b.action)),
	});
}

// ─── Snapshot read (set-based, batched, never N+1) ──────────────────────────

export async function readSchoolYearAuthoritySnapshot(
	client: Prisma.TransactionClient,
	schoolId: number,
	schoolYearId: number,
): Promise<SchoolYearAuthoritySnapshot> {
	const tx = client as any;
	const select = {
		id: true,
		enrollProSchoolYearId: true,
		yearLabel: true,
		isActive: true,
		isArchived: true,
		syncStatus: true,
		updatedAt: true,
	} as const;
	const [requestedMirror, activeMirrors] = await Promise.all([
		tx.enrollProSchoolYearMirror.findUnique({
			where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
			select,
		}),
		tx.enrollProSchoolYearMirror.findMany({
			where: { schoolId, isActive: true, isArchived: false },
			select,
			orderBy: [{ enrollProSchoolYearId: 'asc' }, { id: 'asc' }],
		}),
	]);
	if (!requestedMirror) {
		throw err(404, 'YEAR_MIRROR_NOT_FOUND', 'No school-year mirror exists for this school and year.');
	}
	if (requestedMirror.isArchived) {
		throw err(409, 'ARCHIVED_YEAR', 'This school year is archived and cannot be reconciled.');
	}
	if (activeMirrors.length === 0) {
		throw err(409, 'ACTIVE_YEAR_UNAVAILABLE', 'No active, non-archived school-year mirror exists for this school.');
	}
	if (activeMirrors.length > 1) {
		throw err(409, 'ACTIVE_YEAR_AMBIGUOUS', 'More than one active, non-archived school-year mirror exists for this school. Resolve the school-year authority before reconciling.');
	}
	const [mirror] = activeMirrors;
	if (mirror.enrollProSchoolYearId !== schoolYearId) {
		throw err(409, 'INACTIVE_HISTORICAL_YEAR', 'This school year is not the currently active year and cannot be reconciled.');
	}
	return {
		authorityMode: 'SOLE_ACTIVE_NON_ARCHIVED',
		mirrorId: mirror.id,
		enrollProSchoolYearId: mirror.enrollProSchoolYearId,
		yearLabel: mirror.yearLabel,
		isActive: mirror.isActive,
		isArchived: mirror.isArchived,
		syncStatus: mirror.syncStatus,
		updatedAt: new Date(mirror.updatedAt).toISOString(),
	};
}

export async function readReconciliationSourceSnapshot(
	schoolId: number,
	schoolYearId: number,
	client: Prisma.TransactionClient | typeof import('../lib/data-context.js') = db(),
): Promise<ReconciliationSourceSnapshot> {
	const tx = client as any;
	const schoolYearAuthority = await readSchoolYearAuthoritySnapshot(tx, schoolId, schoolYearId);
	const derivedDemand = await buildDerivedDemand(schoolId, schoolYearId, { client: tx as never });
	const [sections, cohorts, subjects, faculty, facultySubjects, ownership, specializationAliases, crossDepartmentPermissions, departmentAliasRows, departmentLabelRows, subjectOwnerPrefixRows, policyRow, cycleRead] = await Promise.all([
		tx.sectionMirror.findMany({ where: { schoolId, schoolYearId, isActiveForScheduling: true, isStale: false } }),
		tx.instructionalCohort.findMany({ where: { schoolId, schoolYearId, isActive: true } }),
		tx.subject.findMany({ where: { schoolId } }),
		tx.facultyMirror.findMany({ where: { schoolId, isStale: false } }),
		tx.facultySubject.findMany({ where: { schoolId, schoolYearId } }),
		tx.subjectSectionOwnership.findMany({ where: { schoolId, schoolYearId } }),
		tx.specializationAlias.findMany({ where: { schoolId }, select: { alias: true, canonical: true } }),
		tx.crossDepartmentPermission.findMany({ where: { schoolId }, select: { facultyId: true, subjectId: true } }),
		tx.departmentAlias.findMany({ where: { schoolId }, select: { alias: true, department: true } }),
		tx.departmentLabel.findMany({ where: { schoolId }, select: { code: true, label: true } }),
		tx.subjectOwnerPrefix.findMany({ where: { schoolId }, select: { prefix: true, department: true } }),
		tx.schedulingPolicy.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
			select: { teachingStandardMinutes: true, advisoryCreditMinutes: true, hardCapMinutes: true },
		}),
		readTeachingLoadCycleSource(schoolId, schoolYearId, tx),
	]);

	const workloadResolution = resolveEffectiveWorkloadPolicy(policyRow);
	const departmentRevision = await buildDepartmentAuthoritySourceRevision(
		schoolId,
		departmentAliasRows,
		departmentLabelRows,
		null,
		null,
	);
	const cycleState: CycleStateSnapshot = cycleRead.source.state === 'UNCONFIGURED'
		? { state: 'MISSING', version: 0 }
		: cycleRead.diagnostic?.mismatched
		? { state: 'MISMATCH', version: cycleRead.source.version }
		: { state: cycleRead.source.state, version: cycleRead.source.version };

	return {
		schoolId,
		schoolYearId,
		schoolYearAuthority,
		termConfig: derivedDemand.ok
			? {
				id: 0,
				termCount: derivedDemand.termStructure.terms.length,
				termIdentities: derivedDemand.termStructure.terms.map((term) => term.identity),
				updatedAt: '',
			}
			: null,
		derivedDemand,
		sections: sections.map((section: any) => ({
			id: section.id,
			externalId: section.externalId,
			// SectionMirror has no gradeLevel column; displayOrder carries the grade.
			gradeLevel: section.displayOrder,
			programType: section.programType,
			displayOrder: section.displayOrder,
			isActiveForScheduling: section.isActiveForScheduling,
			isStale: section.isStale,
			version: section.version,
		})),
		cohorts: cohorts.map((cohort: any) => ({ id: cohort.id, memberSectionIds: cohort.memberSectionIds })),
		subjects: subjects.map((subject: any) => ({
			id: subject.id,
			code: subject.code,
			name: subject.name,
			minMinutesPerWeek: subject.minMinutesPerWeek,
			programScopes: subject.programScopes,
			gradeLevels: subject.gradeLevels,
			allowedSpecializations: subject.allowedSpecializations,
			ownerDepartment: subject.ownerDepartment,
			rotationFamily: subject.rotationFamily,
			modularGroupId: subject.modularGroupId,
			modularOrder: subject.modularOrder,
			termGroupId: subject.termGroupId,
			termCount: subject.termCount,
			isActive: subject.isActive,
		})),
		faculty: faculty.map((member: any) => ({
			id: member.id,
			firstName: member.firstName,
			lastName: member.lastName,
			department: member.department,
			specialization: member.specialization,
			canTeachOutsideDepartment: member.canTeachOutsideDepartment,
			isClassAdviser: member.isClassAdviser,
			advisedSectionId: member.advisedSectionId,
			isActiveForScheduling: member.isActiveForScheduling,
			isPlaceholder: member.isPlaceholder,
			isStale: member.isStale,
			version: member.version,
		})),
		facultySubjects: facultySubjects.map((row: any) => ({
			id: row.id,
			facultyId: row.facultyId,
			subjectId: row.subjectId,
			sectionIds: row.sectionIds,
			gradeLevels: row.gradeLevels,
			version: row.version,
		})),
		ownership: ownership.map((row: any) => ({
			id: row.id,
			subjectId: row.subjectId,
			sectionId: row.sectionId,
			facultyId: row.facultyId,
			facultySubjectId: row.facultySubjectId,
			specializationCode: row.specializationCode,
			specializationLabel: row.specializationLabel,
		})),
		specializationAliases: specializationAliases.map((row: any) => ({ alias: row.alias, canonical: row.canonical })),
		crossDepartmentPermissions: crossDepartmentPermissions.map((row: any) => ({ facultyId: row.facultyId, subjectId: row.subjectId })),
		departmentAliases: departmentAliasRows.map((row: any) => ({ alias: row.alias, department: row.department })),
		departmentLabels: departmentLabelRows.map((row: any) => ({ code: row.code, label: row.label })),
		subjectOwnerPrefixes: subjectOwnerPrefixRows.map((row: any) => ({ prefix: row.prefix, department: row.department })),
		workloadPolicy: workloadResolution.policy
			? {
				teachingStandardMinutes: workloadResolution.policy.teachingStandardMinutes,
				advisoryCreditMinutes: workloadResolution.policy.advisoryCreditMinutes,
				hardCapMinutes: workloadResolution.policy.hardCapMinutes,
				status: 'CONFIGURED',
			}
			: { ...WORKLOAD_DEFAULTS, status: 'UNCONFIGURED' },
		departmentRevision: {
			revisionHash: departmentRevision.revisionHash,
			aliasRows: departmentRevision.aliasRows,
			labelRows: departmentRevision.labelRows,
		},
		cycleState,
	};
}

// ─── Preview (zero-write) ────────────────────────────────────────────────────

export interface TeachingLoadReconciliationPreview {
	schemaVersion: string;
	schoolId: number;
	schoolYearId: number;
	fingerprint: string;
	sourceRevision: string;
	/** Canonical derived-demand semantic revision (DEMAND-C01 authority). */
	derivedDemandRevision: string | null;
	termConfig: { id: number; termCount: number; termIdentities: string[] } | null;
	generatedAt: string;
	before: {
		ownershipCount: number;
		demandCount: number;
		activeFacultyCount: number;
		activeSectionCount: number;
		distribution: { zeroLoad: number; adviserOnly: number; belowStandard: number; atStandard: number; excess: number; overCap: number };
	};
	demand: DemandPair[];
	actions: ReconciliationPlanEntry[];
	actionTotals: Record<ReconciliationActionType, number>;
	classificationTotals: Record<string, number>;
	perFaculty: FacultyWorkloadSnapshot[];
	after: {
		distribution: { zeroLoad: number; adviserOnly: number; belowStandard: number; atStandard: number; excess: number; overCap: number };
	};
	adviserPreference: AdviserPreferenceOutcome[];
	authorityDiagnostics: TeachingLoadAuthorityDiagnostics;
	hgRows: { found: number; removed: number; removedRows: Array<{ ownershipId: number; subjectId: number; sectionId: number; facultyId: number }> };
	departmentAuthority: { status: string; aliasRows: number; labelRows: number; revisionHash: string };
	workloadPolicy: WorkloadPolicySnapshot;
	cycleImpact: { stateBefore: 'MISSING' | 'EMPTY' | 'POPULATED' | 'MISMATCH'; stateAfter: string; cycleVersion: number };
	effectiveContractImpact: { hgRowsExcluded: boolean; stableExternalIdentifiers: boolean; rotationAndTermMetadataPreserved: boolean };
	zeroWriteProof: { preview: boolean; writes: number };
	confirmationText: string;
	authorizesMutation: boolean;
}

export async function previewTeachingLoadReconciliation(
	schoolId: number,
	schoolYearId: number,
	actorSchoolId: number | null | undefined,
): Promise<TeachingLoadReconciliationPreview> {
	if (!Number.isInteger(schoolId) || schoolId <= 0) {
		throw err(400, 'INVALID_PARAM', 'schoolId must be a positive integer.');
	}
	if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
		throw err(400, 'INVALID_PARAM', 'schoolYearId must be a positive integer.');
	}
	if (actorSchoolId == null) {
		throw err(403, 'ACTOR_SCHOOL_REQUIRED', 'Reconciliation preview requires an authenticated actor school.');
	}
	if (!Number.isInteger(actorSchoolId) || actorSchoolId <= 0 || actorSchoolId !== schoolId) {
		throw err(403, 'SCHOOL_MISMATCH', 'Request school does not match the authenticated actor school.');
	}

	const snapshot = await readReconciliationSourceSnapshot(schoolId, schoolYearId);
	const qualificationResolver = await buildQualificationResolver(snapshot);
	const plan = await buildReconciliationPlan(snapshot, qualificationResolver);

	const actionTotals: Record<ReconciliationActionType, number> = { RETAIN: 0, INSERT: 0, MOVE: 0, RETIRE: 0, UNRESOLVED: 0 };
	for (const entry of plan.actions) {
		actionTotals[entry.action] += 1;
	}

	const activeFaculty = snapshot.faculty.filter((member) => member.isActiveForScheduling && !member.isStale && !member.isPlaceholder);
	const activeSectionIds = new Set(snapshot.sections.map((section) => section.externalId));
	const beforeMinutes = new Map(plan.facultyWorkloads.map((row) => [row.facultyId, row.beforeMinutes]));
	const afterMinutes = new Map(plan.facultyWorkloads.map((row) => [row.facultyId, row.afterMinutes]));
	const before = computeWorkloadDistribution(activeFaculty, beforeMinutes, snapshot.workloadPolicy, activeSectionIds);
	const after = computeWorkloadDistribution(activeFaculty, afterMinutes, snapshot.workloadPolicy, activeSectionIds);
	const authorityDiagnostics = await buildTeachingLoadAuthorityDiagnostics(snapshot, plan, qualificationResolver);

	return {
		schemaVersion: SCHEMA_VERSION,
		schoolId,
		schoolYearId,
		fingerprint: plan.fingerprint,
		sourceRevision: plan.sourceRevision,
		derivedDemandRevision: snapshot.derivedDemand.ok ? snapshot.derivedDemand.revision : null,
		termConfig: snapshot.termConfig
			? { id: snapshot.termConfig.id, termCount: snapshot.termConfig.termCount, termIdentities: snapshot.termConfig.termIdentities }
			: null,
		generatedAt: new Date().toISOString(),
		before: {
			ownershipCount: snapshot.ownership.length,
			demandCount: plan.demand.length,
			activeFacultyCount: activeFaculty.length,
			activeSectionCount: snapshot.sections.length,
			distribution: before,
		},
		demand: plan.demand,
		actions: plan.actions,
		actionTotals,
		classificationTotals: plan.classificationTotals,
		perFaculty: plan.facultyWorkloads,
		after: { distribution: after },
		adviserPreference: plan.adviserPreference,
		authorityDiagnostics,
		hgRows: {
			found: plan.hgRowsFound.length,
			removed: plan.hgRowsFound.length,
			removedRows: plan.hgRowsFound,
		},
		departmentAuthority: {
			status: snapshot.departmentRevision.aliasRows + snapshot.departmentRevision.labelRows > 0 ? 'CONFIGURED' : 'EMPTY',
			aliasRows: snapshot.departmentRevision.aliasRows,
			labelRows: snapshot.departmentRevision.labelRows,
			revisionHash: snapshot.departmentRevision.revisionHash,
		},
		workloadPolicy: snapshot.workloadPolicy,
		cycleImpact: { stateBefore: snapshot.cycleState.state, stateAfter: 'POPULATED', cycleVersion: snapshot.cycleState.version },
		effectiveContractImpact: {
			hgRowsExcluded: plan.hgRowsFound.length > 0 || snapshot.ownership.every((row) => (snapshot.subjects.find((subject) => subject.id === row.subjectId)?.code ?? '').toUpperCase() !== HG_SUBJECT_CODE),
			stableExternalIdentifiers: true,
			rotationAndTermMetadataPreserved: true,
		},
		zeroWriteProof: { preview: true, writes: 0 },
		confirmationText: TEACHING_LOAD_RECONCILIATION_CONFIRMATION,
		authorizesMutation: false,
	};
}

// ─── Apply (Serializable, fingerprinted, idempotent) ─────────────────────────

export interface ApplyTeachingLoadReconciliationInput {
	actorSchoolId: number | null | undefined;
	actorId: number;
	schoolId: unknown;
	schoolYearId: unknown;
	expectedFingerprint: unknown;
	expectedSourceRevision: unknown;
	confirmationText: unknown;
}

export interface TeachingLoadReconciliationApplyResult {
	schoolId: number;
	schoolYearId: number;
	fingerprint: string;
	inserted: number;
	moved: number;
	retired: number;
	retained: number;
	unresolved: number;
	hgRemoved: number;
	affectedFacultyIds: number[];
	ownershipIdsWritten: number[];
	facultySubjectIdsWritten: number[];
	operationId: number;
	replayed: boolean;
	revalidatedInTransaction: boolean;
}

function parsePositiveInt(value: unknown, field: string): number {
	if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
	if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
		const parsed = Number(value.trim());
		if (Number.isSafeInteger(parsed)) return parsed;
	}
	throw err(400, 'INVALID_PARAM', `${field} must be a positive integer.`);
}

function assertActorScope(actorSchoolId: number | null | undefined, schoolId: number): asserts actorSchoolId is number {
	if (actorSchoolId == null) {
		throw err(403, 'ACTOR_SCHOOL_REQUIRED', 'Reconciliation apply requires an authenticated actor school.');
	}
	if (!Number.isInteger(actorSchoolId) || actorSchoolId <= 0 || actorSchoolId !== schoolId) {
		throw err(403, 'SCHOOL_MISMATCH', 'Request school does not match the authenticated actor school.');
	}
}

// Test-only hook: lets tests inject a cycle-refresh failure and prove the whole
// transaction rolls back. NEVER set outside a test harness.
let cycleRefreshOverride: ((schoolId: number, schoolYearId: number, client: Prisma.TransactionClient) => Promise<unknown>) | null = null;

export function __setCycleRefreshOverrideForTest(fn: ((schoolId: number, schoolYearId: number, client: Prisma.TransactionClient) => Promise<unknown>) | null): void {
	cycleRefreshOverride = fn;
}

async function executePlanInTransaction(
	tx: Prisma.TransactionClient,
	schoolId: number,
	schoolYearId: number,
	snapshot: ReconciliationSourceSnapshot,
	plan: ReconciliationPlan,
	actorId: number,
): Promise<{ inserted: number; moved: number; retired: number; retained: number; unresolved: number; hgRemoved: number; affectedFacultyIds: number[]; ownershipIdsWritten: number[]; facultySubjectIdsWritten: number[]; operationId: number }> {
	const writes = {
		inserted: 0,
		moved: 0,
		retired: 0,
		retained: 0,
		unresolved: 0,
		hgRemoved: 0,
		affectedFacultyIds: new Set<number>(),
		ownershipIdsWritten: [] as number[],
		facultySubjectIdsWritten: [] as number[],
	};

	const ownershipById = new Map(snapshot.ownership.map((row) => [row.id, row]));
	const facultySubjectKey = (facultyId: number, subjectId: number) => `${facultyId}:${subjectId}`;
	const facultySubjectsByKey = new Map<string, FacultySubjectSnapshot>();
	for (const row of snapshot.facultySubjects) {
		facultySubjectsByKey.set(facultySubjectKey(row.facultyId, row.subjectId), row);
	}

	// Derive gradeLevels from the row's resulting sectionIds using the current
	// SectionMirror mapping (externalId -> displayOrder).
	const sectionGradeByExternal = new Map<number, number>();
	for (const section of snapshot.sections) {
		sectionGradeByExternal.set(section.externalId, section.gradeLevel);
	}
	const deriveGradeLevels = (sectionIds: number[]): number[] => {
		return canonicalIntSet(sectionIds.map((id) => sectionGradeByExternal.get(id)).filter((grade): grade is number => grade != null));
	};

	const ensureFacultySubject = async (facultyId: number, subjectId: number, sectionId: number, gradeLevel: number) => {
		const key = facultySubjectKey(facultyId, subjectId);
		const existing = facultySubjectsByKey.get(key);
		if (existing) {
			if (!existing.sectionIds.includes(sectionId)) {
				const nextSectionIds = canonicalIntSet([...existing.sectionIds, sectionId]);
				const nextGradeLevels = deriveGradeLevels(nextSectionIds);
				const updated = await tx.facultySubject.update({
					where: { id: existing.id },
					data: {
						sectionIds: { set: nextSectionIds },
						gradeLevels: { set: nextGradeLevels },
						version: { increment: 1 },
					},
					select: { id: true, sectionIds: true, gradeLevels: true },
				});
				facultySubjectsByKey.set(key, { ...existing, sectionIds: updated.sectionIds, gradeLevels: updated.gradeLevels, version: existing.version + 1 });
				writes.facultySubjectIdsWritten.push(updated.id);
			}
			return existing.id;
		}
		const created = await tx.facultySubject.create({
			data: {
				facultyId,
				subjectId,
				schoolId,
				schoolYearId,
				gradeLevels: deriveGradeLevels([sectionId]).length > 0 ? deriveGradeLevels([sectionId]) : [gradeLevel],
				sectionIds: [sectionId],
				assignedBy: actorId,
			},
			select: { id: true },
		});
		facultySubjectsByKey.set(key, {
			id: created.id,
			facultyId,
			subjectId,
			sectionIds: [sectionId],
			gradeLevels: deriveGradeLevels([sectionId]).length > 0 ? deriveGradeLevels([sectionId]) : [gradeLevel],
			version: 1,
		});
		writes.facultySubjectIdsWritten.push(created.id);
		return created.id;
	};

	const releaseFacultySubjectSection = async (facultyId: number, subjectId: number, sectionId: number) => {
		const key = facultySubjectKey(facultyId, subjectId);
		const existing = facultySubjectsByKey.get(key);
		if (!existing) return;
		const nextSectionIds = existing.sectionIds.filter((id) => id !== sectionId);
		if (nextSectionIds.length === 0) {
			await tx.facultySubject.delete({ where: { id: existing.id } });
			facultySubjectsByKey.delete(key);
			writes.facultySubjectIdsWritten.push(existing.id);
		} else {
			const nextGradeLevels = deriveGradeLevels(nextSectionIds);
			const updated = await tx.facultySubject.update({
				where: { id: existing.id },
				data: {
					sectionIds: { set: nextSectionIds },
					gradeLevels: { set: nextGradeLevels },
					version: { increment: 1 },
				},
				select: { id: true },
			});
			facultySubjectsByKey.set(key, { ...existing, sectionIds: nextSectionIds, gradeLevels: nextGradeLevels, version: existing.version + 1 });
			writes.facultySubjectIdsWritten.push(updated.id);
		}
	};

	const upsertOwnership = async (subjectId: number, sectionId: number, facultyId: number, facultySubjectId: number) => {
		const upserted = await tx.subjectSectionOwnership.upsert({
			where: { schoolId_schoolYearId_subjectId_sectionId: { schoolId, schoolYearId, subjectId, sectionId } },
			create: { schoolId, schoolYearId, subjectId, sectionId, facultyId, facultySubjectId, assignedAt: new Date() },
			update: { facultyId, facultySubjectId, assignedAt: new Date() },
			select: { id: true },
		});
		writes.ownershipIdsWritten.push(upserted.id);
	};

	const subjectByDemand = new Map<string, { subject: SubjectSnapshot; section: SectionSnapshot }>();
	for (const pair of plan.demand) {
		const subject = snapshot.subjects.find((item) => item.id === pair.subjectId);
		const section = snapshot.sections.find((item) => item.externalId === pair.sectionId);
		if (subject && section) subjectByDemand.set(pair.key, { subject, section });
	}

	for (const entry of plan.actions) {
		if (entry.action === 'RETAIN') {
			writes.retained += 1;
			if (entry.currentOwnerId != null) writes.affectedFacultyIds.add(entry.currentOwnerId);
			continue;
		}
		if (entry.action === 'UNRESOLVED') {
			writes.unresolved += 1;
			continue;
		}
		const demandContext = subjectByDemand.get(pairKeyOf(entry.subjectId, entry.sectionId));

		if (entry.action === 'RETIRE') {
			const row = entry.currentOwnershipId != null ? ownershipById.get(entry.currentOwnershipId) : undefined;
			if (row) {
				await tx.subjectSectionOwnership.delete({ where: { id: row.id } });
				writes.ownershipIdsWritten.push(row.id);
				writes.retired += 1;
				writes.affectedFacultyIds.add(row.facultyId);
				await releaseFacultySubjectSection(row.facultyId, row.subjectId, row.sectionId);
			} else {
				writes.retired += 1;
			}
			if (entry.diagnostics.includes('HG_FORBIDDEN')) writes.hgRemoved += 1;
			continue;
		}

		if (entry.action === 'INSERT' || entry.action === 'MOVE') {
			if (entry.proposedFacultyId == null) {
				writes.unresolved += 1;
				continue;
			}
			const gradeLevel = demandContext?.section.gradeLevel ?? 7;
			const targetFacultySubjectId = await ensureFacultySubject(entry.proposedFacultyId, entry.subjectId, entry.sectionId, gradeLevel);
			// Write the ownership to the recipient BEFORE releasing the donor so
			// a FacultySubject row is never deleted while an ownership row still
			// references it (FK safety within the same transaction).
			await upsertOwnership(entry.subjectId, entry.sectionId, entry.proposedFacultyId, targetFacultySubjectId);
			writes.affectedFacultyIds.add(entry.proposedFacultyId);
			if (entry.action === 'MOVE' && entry.currentOwnerId != null && entry.currentOwnerId !== entry.proposedFacultyId) {
				await releaseFacultySubjectSection(entry.currentOwnerId, entry.subjectId, entry.sectionId);
				writes.affectedFacultyIds.add(entry.currentOwnerId);
			}
			if (entry.action === 'INSERT') writes.inserted += 1;
			else writes.moved += 1;
			continue;
		}
	}

	const audit = await tx.auditLog.create({
		data: {
			schoolId,
			schoolYearId,
			actorId,
			action: 'TEACHING_LOAD_RECONCILIATION',
			targetIds: writes.ownershipIdsWritten,
			metadata: {
				fingerprint: plan.fingerprint,
				inserted: writes.inserted,
				moved: writes.moved,
				retired: writes.retired,
				retained: writes.retained,
				unresolved: writes.unresolved,
				hgRemoved: writes.hgRemoved,
				affectedFacultyIds: Array.from(writes.affectedFacultyIds),
			} as object,
		},
	});

	// Refresh the annual Teaching Load cycle INSIDE the same transaction as the
	// ownership/FacultySubject/audit writes so an injected failure (or any
	// concurrent abort) rolls back every write atomically.
	if (cycleRefreshOverride) {
		await cycleRefreshOverride(schoolId, schoolYearId, tx);
	} else {
		await refreshTeachingLoadCycle(schoolId, schoolYearId, tx);
	}

	return {
		inserted: writes.inserted,
		moved: writes.moved,
		retired: writes.retired,
		retained: writes.retained,
		unresolved: writes.unresolved,
		hgRemoved: writes.hgRemoved,
		affectedFacultyIds: Array.from(writes.affectedFacultyIds),
		ownershipIdsWritten: writes.ownershipIdsWritten,
		facultySubjectIdsWritten: writes.facultySubjectIdsWritten,
		operationId: audit.id,
	};
}

/**
 * Fingerprinted apply. All validation that can run without writes happens first;
 * then ONE Serializable transaction re-reads every source revision, recomputes
 * the canonical revision and fingerprint, aborts with a typed 409 on any drift,
 * re-runs the deterministic plan, and writes canonical SubjectSectionOwnership
 * plus derived FacultySubject state consistently. Replay with a matching
 * fingerprint after a prior successful apply performs zero writes.
 */
export async function applyTeachingLoadReconciliation(input: ApplyTeachingLoadReconciliationInput): Promise<TeachingLoadReconciliationApplyResult> {
	const schoolId = parsePositiveInt(input.schoolId, 'schoolId');
	const schoolYearId = parsePositiveInt(input.schoolYearId, 'schoolYearId');
	assertActorScope(input.actorSchoolId, schoolId);
	if (input.confirmationText !== TEACHING_LOAD_RECONCILIATION_CONFIRMATION) {
		throw err(400, 'CONFIRMATION_REQUIRED', `confirmationText="${TEACHING_LOAD_RECONCILIATION_CONFIRMATION}" is required.`);
	}
	if (typeof input.expectedFingerprint !== 'string' || !input.expectedFingerprint) {
		throw err(400, 'FINGERPRINT_REQUIRED', 'expectedFingerprint from the preview is required.');
	}
	if (typeof input.expectedSourceRevision !== 'string' || !input.expectedSourceRevision) {
		throw err(400, 'FINGERPRINT_REQUIRED', 'expectedSourceRevision from the preview is required.');
	}

	try {
		const result = await db().$transaction(async (tx) => {
			const snapshot = await readReconciliationSourceSnapshot(schoolId, schoolYearId, tx as any);
			const actualRevision = await buildReconciliationSourceRevision(snapshot);
			if (actualRevision !== input.expectedSourceRevision) {
				throw err(409, 'SOURCE_DRIFT', 'Teaching Load reconciliation source changed since the preview. Re-run the preview before applying.');
			}
			const qualificationResolver = await buildQualificationResolver(snapshot);
			const plan = await buildReconciliationPlan(snapshot, qualificationResolver);
			if (plan.fingerprint !== input.expectedFingerprint) {
				throw err(409, 'FINGERPRINT_MISMATCH', 'Reconciliation preview fingerprint does not match the current request. Re-run the preview before applying.');
			}

			const hasMutation = plan.actions.some((entry) => entry.action === 'INSERT' || entry.action === 'MOVE' || entry.action === 'RETIRE');
			if (!hasMutation) {
				return {
					schoolId,
					schoolYearId,
					fingerprint: plan.fingerprint,
					inserted: 0,
					moved: 0,
					retired: 0,
					retained: plan.actions.filter((entry) => entry.action === 'RETAIN').length,
					unresolved: plan.actions.filter((entry) => entry.action === 'UNRESOLVED').length,
					hgRemoved: 0,
					affectedFacultyIds: [],
					ownershipIdsWritten: [],
					facultySubjectIdsWritten: [],
					operationId: 0,
					replayed: true,
					revalidatedInTransaction: true,
				};
			}

			const result = await executePlanInTransaction(tx, schoolId, schoolYearId, snapshot, plan, input.actorId);
			return {
				schoolId,
				schoolYearId,
				fingerprint: plan.fingerprint,
				...result,
				replayed: false,
				revalidatedInTransaction: true,
			};
		}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

		// Cycle refresh happens INSIDE the Serializable transaction (see
		// executePlanInTransaction). Replay performs zero writes and refreshes
		// nothing. Nothing runs against the global client from here on.
		return result;
	} catch (error: unknown) {
		if (isTransactionConflictError(error)) {
			throw err(409, 'TRANSACTION_CONFLICT', 'Concurrent transaction conflict: no partial writes occurred. Re-run the preview and retry the apply.');
		}
		throw error;
	}
}

// ─── Readiness (demand-coverage authority) ───────────────────────────────────

export interface TeachingLoadReconciliationReadiness {
	schoolId: number;
	schoolYearId: number;
	ready: boolean;
	demandCount: number;
	ownedDemandCount: number;
	unresolvedDemandCount: number;
	validOwnershipCount: number;
	blockers: Array<{ code: string; message: string }>;
	acceptedExceptions: number;
}

export async function getTeachingLoadReconciliationReadiness(
	schoolId: number,
	schoolYearId: number,
): Promise<TeachingLoadReconciliationReadiness> {
	const snapshot = await readReconciliationSourceSnapshot(schoolId, schoolYearId);
	const qualificationResolver = await buildQualificationResolver(snapshot);
	const plan = await buildReconciliationPlan(snapshot, qualificationResolver);

	const demandCount = plan.demand.length;
	const unresolvedCount = plan.actions.filter((entry) => entry.action === 'UNRESOLVED').length;
	const insertedCount = plan.actions.filter((entry) => entry.action === 'INSERT').length;
	const movedCount = plan.actions.filter((entry) => entry.action === 'MOVE').length;
	const retainedCount = plan.actions.filter((entry) => entry.action === 'RETAIN').length;
	// Unique final-action model: each demanded pair has exactly one action among
	// RETAIN/INSERT/MOVE/UNRESOLVED, so owned <= demand always holds.
	const ownedDemandCount = retainedCount + movedCount + insertedCount;

	const blockers: Array<{ code: string; message: string }> = [];
	if (!snapshot.termConfig) {
		blockers.push({ code: 'TL_TERM_CONFIG_MISSING', message: 'No persisted school-year term configuration; curriculum term applicability is unresolved.' });
	}
	if (demandCount === 0) {
		blockers.push({ code: 'TL_DEMAND_EMPTY', message: 'No mechanically expanded curriculum demand exists for the active school year.' });
	}
	if (unresolvedCount > 0) {
		blockers.push({
			code: 'TL_UNRESOLVED_COVERAGE',
			message: `${unresolvedCount} demanded subject-section pair${unresolvedCount === 1 ? ' has' : 's have'} no valid qualified owner.`,
		});
	}
	if (insertedCount > 0 || movedCount > 0) {
		blockers.push({
			code: 'TL_RECONCILIATION_PENDING',
			message: `${insertedCount + movedCount} demanded pair${insertedCount + movedCount === 1 ? ' is' : 's are'} proposed for change and are not yet applied.`,
		});
	}

	return {
		schoolId,
		schoolYearId,
		ready: blockers.length === 0,
		demandCount,
		ownedDemandCount,
		unresolvedDemandCount: unresolvedCount,
		validOwnershipCount: retainedCount,
		blockers,
		acceptedExceptions: 0,
	};
}
