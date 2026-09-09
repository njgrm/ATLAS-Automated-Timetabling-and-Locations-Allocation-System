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
import { getEffectiveWorkloadPolicy } from './scheduling-policy.service.js';
import { refreshTeachingLoadCycle } from './teaching-load-cycle.service.js';
import { readDepartmentAuthoritySourceRevision } from './department-authority.service.js';
import { isProgramScopeCompatible } from './qualification-evaluator.service.js';
import { computeTeachingLoadMinutes } from './faculty-assignment.service.js';
import { WORKLOAD_DEFAULTS } from './workload-policy.service.js';

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

export type ReconciliationSourceSnapshot = {
	schoolId: number;
	schoolYearId: number;
	termConfig: TermConfigSnapshot | null;
	offerings: OfferingSnapshot[];
	sections: SectionSnapshot[];
	cohorts: CohortSnapshot[];
	subjects: SubjectSnapshot[];
	faculty: FacultySnapshot[];
	facultySubjects: FacultySubjectSnapshot[];
	ownership: OwnershipSnapshot[];
	specializationAliases: Array<{ alias: string; canonical: string }>;
	crossDepartmentPermissions: CrossDepartmentPermissionSnapshot[];
	workloadPolicy: WorkloadPolicySnapshot;
	departmentRevision: DepartmentRevisionSnapshot;
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
 * Expand the persisted curriculum requirements into one canonical demand graph
 * of expected subject-section ownership. Rotating-family members are demanded
 * in their own terms; term identities always come from the persisted term
 * configuration, never from hardcoded term counts.
 */
export function expandCurriculumDemand(snapshot: ReconciliationSourceSnapshot): DemandPair[] {
	const subjectById = new Map(snapshot.subjects.map((subject) => [subject.id, subject]));
	const demandByPair = new Map<string, DemandPair>();

	const register = (pair: DemandPair) => {
		const existing = demandByPair.get(pair.key);
		if (!existing) {
			demandByPair.set(pair.key, pair);
			return;
		}
		// Overlapping offering rows for the same pair: prefer the more specific
		// expansion and the larger weekly minutes, and record the overlap in
		// provenance so the operator can see it.
		const specificity = (p: DemandPair) => (p.provenance === 'section-override' ? 3 : p.provenance === 'cohort-override' ? 2 : 1);
		if (specificity(pair) > specificity(existing) || (specificity(pair) === specificity(existing) && pair.weeklyMinutes > existing.weeklyMinutes)) {
			demandByPair.set(pair.key, { ...pair, provenance: `${pair.provenance}+overlap-with-${existing.provenance}` });
		}
	};

	for (const offering of snapshot.offerings) {
		if (!offering.isActive) continue;
		if (offering.termMode === 'EMPTY') continue;
		const subject = offering.subjectId != null ? subjectById.get(offering.subjectId) : undefined;
		if (!subject) continue;
		if (subject.code.toUpperCase() === HG_SUBJECT_CODE) continue;

		const weeklyMinutes = offering.weeklyMinutes > 0 ? offering.weeklyMinutes : subject.minMinutesPerWeek;
		const termIdentities = offering.termMode === 'ALL'
			? (snapshot.termConfig?.termIdentities ?? [])
			: offering.termAssignments.map((assignment) => assignment.termIdentity).sort((a, b) => a.localeCompare(b));
		const rotationFamily = offering.rotationFamily ?? subject.rotationFamily;

		const sections = resolveOfferingSections(offering, snapshot.sections, snapshot.cohorts);
		for (const section of sections) {
			const key = pairKeyOf(subject.id, section.externalId);
			register({
				key,
				offeringId: offering.id,
				offeringVersion: offering.version,
				subjectId: subject.id,
				subjectCode: subject.code,
				sectionId: section.externalId,
				gradeLevel: section.gradeLevel,
				programType: section.programType,
				classification: offering.classification,
				weeklyMinutes,
				termMode: offering.termMode,
				termIdentities,
				rotationFamily,
				rotationOrder: offering.rotationOrder,
				provenance: section.provenance,
			});
		}
	}

	return Array.from(demandByPair.values());
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

// ─── Qualification (persisted department/program/specialization policy) ─────

type QualificationResolver = (facultyId: number, subjectId: number, sectionProgramType: string) => Promise<{ eligible: boolean; tier: number | null }>;

/**
 * Canonical persisted-policy qualification resolver. Department identity uses
 * ONLY persisted DepartmentAlias/DepartmentLabel data via the canonical identity
 * function (no name/prefix/keyword inference). A faculty member is qualified for
 * a pair when the program scope is compatible and any of: department match,
 * specialization match (persisted aliases), persisted cross-department
 * permission, or the canTeachOutsideDepartment override holds.
 */
export async function buildQualificationResolver(snapshot: ReconciliationSourceSnapshot): Promise<QualificationResolver> {
	const { loadCanonicalDepartmentMap } = await import('./faculty-assignment.service.js');
	const departmentMap = await loadCanonicalDepartmentMap(snapshot.schoolId);
	const subjectById = new Map(snapshot.subjects.map((subject) => [subject.id, subject]));
	const facultyById = new Map(snapshot.faculty.map((member) => [member.id, member]));
	const crossDepartmentPermissions = new Map<number, Set<number>>();
	for (const row of snapshot.crossDepartmentPermissions) {
		const set = crossDepartmentPermissions.get(row.facultyId) ?? new Set<number>();
		set.add(row.subjectId);
		crossDepartmentPermissions.set(row.facultyId, set);
	}
	const aliasToCanonical = new Map<string, string>();
	for (const alias of snapshot.specializationAliases) {
		aliasToCanonical.set(alias.alias.trim().toUpperCase(), alias.canonical.trim().toUpperCase());
	}

	// Department identity uses persisted aliases first, then exact trimmed
	// uppercase equality of the persisted values. This never infers a department
	// from a name, subject description, prefix, or glossary. Department LABELS
	// stay a display concern (the summary path reports UNMAPPED until label rows
	// exist) and are not required for qualification matching.
	const resolveDepartmentCode = (raw: string | null | undefined): string | null => {
		const upper = (raw ?? '').trim().toUpperCase();
		if (!upper) return null;
		return departmentMap.aliases.get(upper) ?? upper;
	};

	const cache = new Map<string, { eligible: boolean; tier: number | null }>();

	return async (facultyId, subjectId, sectionProgramType) => {
		const cacheKey = `${facultyId}:${subjectId}:${normalizeSectionProgramType(sectionProgramType)}`;
		const cached = cache.get(cacheKey);
		if (cached) return cached;

		const subject = subjectById.get(subjectId);
		const member = facultyById.get(facultyId);
		if (!subject || !member || member.isPlaceholder || member.isStale || !member.isActiveForScheduling) {
			cache.set(cacheKey, { eligible: false, tier: null });
			return { eligible: false, tier: null };
		}
		if (subject.code.toUpperCase() === HG_SUBJECT_CODE) {
			cache.set(cacheKey, { eligible: false, tier: null });
			return { eligible: false, tier: null };
		}
		if (!isProgramScopeCompatible(subject.programScopes as never, normalizeSectionProgramType(sectionProgramType) as never)) {
			cache.set(cacheKey, { eligible: false, tier: null });
			return { eligible: false, tier: null };
		}

		if (member.canTeachOutsideDepartment) {
			cache.set(cacheKey, { eligible: true, tier: 3 });
			return { eligible: true, tier: 3 };
		}

		const facultyDepartment = resolveDepartmentCode(member.department);
		const subjectDepartment = resolveDepartmentCode(subject.ownerDepartment);

		// Department match (persisted-value equality only).
		const departmentMatch = facultyDepartment != null && subjectDepartment != null && facultyDepartment === subjectDepartment;

		// Specialization match (persisted alias-aware).
		let specializationMatch = false;
		if (member.specialization && subject.allowedSpecializations.length > 0) {
			const facultySpec = member.specialization.trim().toUpperCase();
			const subjectSpecs = new Set(subject.allowedSpecializations.map((entry) => entry.trim().toUpperCase()));
			specializationMatch = subjectSpecs.has(facultySpec) || subjectSpecs.has(aliasToCanonical.get(facultySpec) ?? facultySpec);
		}

		// Persisted cross-department permission.
		const crossDepartmentMatch = (crossDepartmentPermissions.get(member.id)?.has(subject.id)) === true;

		const eligible = departmentMatch || specializationMatch || crossDepartmentMatch;
		const tier = departmentMatch || specializationMatch ? 2 : crossDepartmentMatch ? 3 : null;
		cache.set(cacheKey, { eligible, tier });
		return { eligible, tier };
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
 * Simulated load is updated after every proposed assignment (never stale), every
 * zero-load active faculty enters candidate evaluation, and ranking prefers the
 * qualified adviser of the section, then balance toward the standard, then the
 * stable faculty-id tie-break.
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

	const actions: ReconciliationPlanEntry[] = [];
	const hgRowsFound: ReconciliationPlan['hgRowsFound'] = [];
	const assignedPairsByFaculty = new Map<number, AssignedPairInput[]>();
	const assignedFacultyByPair = new Map<string, number>();
	const releasedPairs = new Map<string, { ownershipId: number; fromFacultyId: number; diagnostics: OwnershipDiagnostic[] }>();
	const adviserPreferenceGrantedBySection = new Map<number, number>();

	const totalMinutesByFaculty = () => computeFacultyTeachingMinutes(assignedPairsByFaculty, subjectById);

	const registerAssignment = (pair: DemandPair, facultyId: number) => {
		assignedFacultyByPair.set(pair.key, facultyId);
		const list = assignedPairsByFaculty.get(facultyId) ?? [];
		list.push({ subject: subjectById.get(pair.subjectId)!, sectionId: pair.sectionId });
		assignedPairsByFaculty.set(facultyId, list);
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
			actions.push({
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
			actions.push({
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
				actions.push({
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
				actions.push({
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
				actions.push({
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
				: snapshot.workloadPolicy.status === 'CONFIGURED'
				? 'NO_QUALIFIED_CANDIDATE'
				: 'NO_QUALIFIED_CANDIDATE';
			actions.push({
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
	const rebalanceActions: ReconciliationPlanEntry[] = [];
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
				new Map(),
			);
			if (!recipient || recipient.facultyId === donor.facultyId) continue;
			const recipientMinutes = facultyMinutes.get(recipient.facultyId) ?? 0;
			if (recipientMinutes + pair.subject.minMinutesPerWeek > hardCap) continue;
			// Only move when it reduces total overload and does not create excess.
			if (recipientMinutes + pair.subject.minMinutesPerWeek > standard) continue;
			const ownershipId = [...classifications.entries()].find(([, classification]) =>
				classification.pairKey === demandPair.key && classification.primaryAction === 'RETAIN')?.[1].ownershipId ?? null;
			// Remove from donor, add to recipient in simulation.
			assignedPairsByFaculty.set(
				donor.facultyId,
				(assignedPairsByFaculty.get(donor.facultyId) ?? []).filter((item) => !(item.subject.id === pair.subject.id && item.sectionId === pair.sectionId)),
			);
			registerAssignment(demandPair, recipient.facultyId);
			const nextMinutes = totalMinutesByFaculty();
			facultyMinutes.set(donor.facultyId, nextMinutes.get(donor.facultyId) ?? 0);
			facultyMinutes.set(recipient.facultyId, nextMinutes.get(recipient.facultyId) ?? 0);
			rebalanceActions.push({
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
				currentOwnershipId: ownershipId,
				diagnostics: ['OVER_STANDARD'],
				reason: 'Rebalance: reduced an over-standard faculty load without breaking curriculum coverage.',
				unresolvedReason: null,
				adviserPreferenceApplied: false,
			});
		}
	}
	actions.push(...rebalanceActions);

	// 4. Adviser-section preference outcomes.
	const activeSectionIds = new Set(snapshot.sections.map((section) => section.externalId));
	const actionByPair = new Map<string, ReconciliationPlanEntry>();
	for (const entry of actions) {
		actionByPair.set(pairKeyOf(entry.subjectId, entry.sectionId), entry);
	}
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
		// Not satisfied: distinguish a free pair that went elsewhere from a
		// section whose pairs are all already validly owned (no churn).
		const freePairWentElsewhere = sectionPairs.some((pair) => {
			const entry = actionByPair.get(pair.key);
			return entry?.action === 'INSERT' && entry.proposedFacultyId !== member.id;
		});
		adviserPreference.push({
			facultyId: member.id,
			sectionId: member.advisedSectionId,
			satisfied: false,
			reason: freePairWentElsewhere ? 'CAPACITY_OR_RANKING' : 'ALL_SECTION_PAIRS_ALREADY_OWNED',
		});
	}

	// 5. Classification totals (including pair-level MISSING_OWNER).
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

	// 6. Per-faculty before/after workloads.
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

// ─── Source revision + fingerprint ───────────────────────────────────────────

export async function buildReconciliationSourceRevision(snapshot: ReconciliationSourceSnapshot): Promise<string> {
	return canonicalHash({
		schemaVersion: SCHEMA_VERSION,
		schoolId: snapshot.schoolId,
		schoolYearId: snapshot.schoolYearId,
		termConfig: snapshot.termConfig
			? {
				id: snapshot.termConfig.id,
				termCount: snapshot.termConfig.termCount,
				termIdentities: snapshot.termConfig.termIdentities,
				updatedAt: snapshot.termConfig.updatedAt,
			}
			: null,
		offerings: snapshot.offerings
			.map((offering) => ({
				id: offering.id,
				subjectId: offering.subjectId,
				gradeLevel: offering.gradeLevel,
				programType: offering.programType,
				sectionMirrorId: offering.sectionMirrorId,
				cohortId: offering.cohortId,
				classification: offering.classification,
				weeklyMinutes: offering.weeklyMinutes,
				rotationFamily: offering.rotationFamily,
				rotationOrder: offering.rotationOrder,
				termMode: offering.termMode,
				isActive: offering.isActive,
				version: offering.version,
				terms: offering.termAssignments.map((assignment) => assignment.termIdentity).sort((a, b) => a.localeCompare(b)),
			}))
			.sort((a, b) => a.id - b.id),
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
				programScopes: subject.programScopes,
				gradeLevels: subject.gradeLevels,
				allowedSpecializations: subject.allowedSpecializations,
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
			.map((row) => ({ id: row.id, facultyId: row.facultyId, subjectId: row.subjectId, sectionIds: [...row.sectionIds].sort((a, b) => a - b), version: row.version }))
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

export async function readReconciliationSourceSnapshot(
	schoolId: number,
	schoolYearId: number,
	client: Prisma.TransactionClient | typeof import('../lib/data-context.js') = db(),
): Promise<ReconciliationSourceSnapshot> {
	const tx = client as any;
	const [termConfig, offerings, sections, cohorts, subjects, faculty, facultySubjects, ownership, specializationAliases, crossDepartmentPermissions, workloadResolution, departmentRevision] = await Promise.all([
		tx.schoolYearTermConfig.findFirst({ where: { schoolId, schoolYearId, isActive: true } }),
		tx.schoolYearOffering.findMany({
			where: { schoolId, schoolYearId, isActive: true },
			include: { termAssignments: { select: { termIdentity: true } } },
		}),
		tx.sectionMirror.findMany({ where: { schoolId, schoolYearId, isActiveForScheduling: true, isStale: false } }),
		tx.instructionalCohort.findMany({ where: { schoolId, schoolYearId, isActive: true } }),
		tx.subject.findMany({ where: { schoolId } }),
		tx.facultyMirror.findMany({ where: { schoolId, isStale: false } }),
		tx.facultySubject.findMany({ where: { schoolId, schoolYearId } }),
		tx.subjectSectionOwnership.findMany({ where: { schoolId, schoolYearId } }),
		tx.specializationAlias.findMany({ where: { schoolId }, select: { alias: true, canonical: true } }),
		tx.crossDepartmentPermission.findMany({ where: { schoolId }, select: { facultyId: true, subjectId: true } }),
		getEffectiveWorkloadPolicy(schoolId, schoolYearId),
		readDepartmentAuthoritySourceRevision(schoolId),
	]);

	return {
		schoolId,
		schoolYearId,
		termConfig: termConfig
			? {
				id: termConfig.id,
				termCount: termConfig.termCount,
				termIdentities: Array.isArray(termConfig.termIdentities) ? (termConfig.termIdentities as string[]) : [],
				updatedAt: new Date(termConfig.updatedAt).toISOString(),
			}
			: null,
		offerings: offerings.map((offering: any) => ({
			id: offering.id,
			subjectId: offering.subjectId,
			gradeLevel: offering.gradeLevel,
			programType: offering.programType,
			sectionMirrorId: offering.sectionMirrorId,
			cohortId: offering.cohortId,
			classification: offering.classification,
			weeklyMinutes: offering.weeklyMinutes,
			rotationFamily: offering.rotationFamily,
			rotationOrder: offering.rotationOrder,
			termMode: offering.termMode,
			isActive: offering.isActive,
			version: offering.version,
			termAssignments: offering.termAssignments.map((assignment: any) => ({ termIdentity: assignment.termIdentity })),
		})),
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
	};
}

// ─── Preview (zero-write) ────────────────────────────────────────────────────

export interface TeachingLoadReconciliationPreview {
	schemaVersion: string;
	schoolId: number;
	schoolYearId: number;
	fingerprint: string;
	sourceRevision: string;
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
	hgRows: { found: number; removed: number; removedRows: Array<{ ownershipId: number; subjectId: number; sectionId: number; facultyId: number }> };
	departmentAuthority: { status: string; aliasRows: number; labelRows: number; revisionHash: string };
	workloadPolicy: WorkloadPolicySnapshot;
	cycleImpact: { stateBefore: string; stateAfter: string };
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

	const stateBefore = 'POPULATED'; // the census reads the persisted cycle; preview reads ownership directly.

	return {
		schemaVersion: SCHEMA_VERSION,
		schoolId,
		schoolYearId,
		fingerprint: plan.fingerprint,
		sourceRevision: plan.sourceRevision,
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
		cycleImpact: { stateBefore, stateAfter: 'POPULATED' },
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

	const ensureFacultySubject = async (facultyId: number, subjectId: number, sectionId: number, gradeLevel: number) => {
		const key = facultySubjectKey(facultyId, subjectId);
		const existing = facultySubjectsByKey.get(key);
		if (existing) {
			if (!existing.sectionIds.includes(sectionId)) {
				const updated = await tx.facultySubject.update({
					where: { id: existing.id },
					data: { sectionIds: { set: [...existing.sectionIds, sectionId].sort((a, b) => a - b) }, version: { increment: 1 } },
					select: { id: true, sectionIds: true },
				});
				facultySubjectsByKey.set(key, { ...existing, sectionIds: updated.sectionIds, version: existing.version + 1 });
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
				gradeLevels: [gradeLevel],
				sectionIds: [sectionId],
				assignedBy: actorId,
			},
			select: { id: true },
		});
		facultySubjectsByKey.set(key, { id: created.id, facultyId, subjectId, sectionIds: [sectionId], version: 1 });
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
			const updated = await tx.facultySubject.update({
				where: { id: existing.id },
				data: { sectionIds: { set: nextSectionIds }, version: { increment: 1 } },
				select: { id: true },
			});
			facultySubjectsByKey.set(key, { ...existing, sectionIds: nextSectionIds, version: existing.version + 1 });
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

		// Refresh the annual Teaching Load cycle once after a successful apply.
		if (!result.replayed) {
			await refreshTeachingLoadCycle(schoolId, schoolYearId);
		}
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
	const ownedDemandCount = plan.actions.filter((entry) => entry.action === 'RETAIN' || entry.action === 'MOVE' || entry.action === 'INSERT').length;

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
		validOwnershipCount: plan.actions.filter((entry) => entry.action === 'RETAIN').length,
		blockers,
		acceptedExceptions: 0,
	};
}