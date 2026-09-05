/**
 * Canonical qualification evaluator — single source of truth for all
 * department, program, specialization, and cross-department evaluation.
 *
 * Replaces scattered evaluation logic in:
 * - subject-ownership.service.ts (department matching)
 * - qualification.service.ts (tiered matching)
 * - teaching-load-automation.service.ts (resolveQualificationTier)
 * - seeded-teaching-load.service.ts (matchesFacultySubject)
 * - faculty-assignment-helpers.ts (client-side matchesOwnershipDepartment)
 * - grade-labels.ts (client-side getQualificationTier)
 *
 * All backend consumers must route through this evaluator.
 * Client consumers receive canonical reasons from the API.
 */

import { getDataContext } from '../lib/data-context.js';
import type { ProgramType } from '@prisma/client';

const db = () => getDataContext();

// ─── Canonical Result Type ───

export interface QualificationResult {
  eligible: boolean;
  tier: number | null;
  reason: string;
  policyRevision: number;
  sourceFacts: {
    facultyDepartment: string | null;
    facultySpecialization: string | null;
    subjectOwnerDepartment: string | null;
    subjectAllowedDepartments: string[];
    subjectAllowedSpecializations: string[];
    subjectProgramScopes: ProgramType[];
    aliasMatched: boolean;
    departmentMatched: boolean;
    specializationMatched: boolean;
    crossDepartmentPermitted: boolean;
    programScopeMatched: boolean;
  };
}

// ─── Policy Cache (per school) ───

interface QualificationPolicy {
  schoolId: number;
  departmentAliases: Map<string, string>;
  departmentLabels: Map<string, string>;
  subjectOwnerPrefixes: Map<string, string>;
  crossDepartmentPermissions: Map<number, Set<number>>; // facultyId -> Set<subjectId>
  legacyCrossLanguageException: boolean;
  revision: number;
}

const policyCache = new Map<number, QualificationPolicy>();
const POLICY_TTL_MS = 30_000;
let policyTimestamps = new Map<number, number>();

async function getPolicy(schoolId: number): Promise<QualificationPolicy> {
  const now = Date.now();
  const cached = policyCache.get(schoolId);
  const ts = policyTimestamps.get(schoolId) ?? 0;
  if (cached && now - ts < POLICY_TTL_MS) return cached;

  const [aliasRows, labelRows, prefixRows, permRows] = await Promise.all([
    db().departmentAlias.findMany({ where: { schoolId } }),
    db().departmentLabel.findMany({ where: { schoolId } }),
    db().subjectOwnerPrefix.findMany({ where: { schoolId } }),
    db().crossDepartmentPermission.findMany({ where: { schoolId } }),
  ]);

  const departmentAliases = new Map<string, string>();
  for (const row of aliasRows) {
    departmentAliases.set(row.alias.toUpperCase(), row.department.toUpperCase());
  }

  const departmentLabels = new Map<string, string>();
  for (const row of labelRows) {
    departmentLabels.set(row.code.toUpperCase(), row.label);
  }

  const subjectOwnerPrefixes = new Map<string, string>();
  for (const row of prefixRows) {
    subjectOwnerPrefixes.set(row.prefix.toUpperCase(), row.department.toUpperCase());
  }

  const crossDepartmentPermissions = new Map<number, Set<number>>();
  for (const row of permRows) {
    const set = crossDepartmentPermissions.get(row.facultyId) ?? new Set();
    set.add(row.subjectId);
    crossDepartmentPermissions.set(row.facultyId, set);
  }

  const policy: QualificationPolicy = {
    schoolId,
    departmentAliases,
    departmentLabels,
    subjectOwnerPrefixes,
    crossDepartmentPermissions,
    legacyCrossLanguageException: true, // preserved from existing behavior
    revision: aliasRows.length + labelRows.length + prefixRows.length + permRows.length,
  };

  policyCache.set(schoolId, policy);
  policyTimestamps.set(schoolId, now);
  return policy;
}

export function invalidatePolicyCache(schoolId?: number) {
  if (schoolId !== undefined) {
    policyCache.delete(schoolId);
    policyTimestamps.delete(schoolId);
  } else {
    policyCache.clear();
    policyTimestamps.clear();
  }
}

// ─── Department Normalization ───

const LEGACY_DEPARTMENT_NORMALIZATION: Record<string, string> = {
  'SCIENCE': 'SCI',
  'SCI': 'SCI',
  'MATHEMATICS': 'MATH',
  'MATH': 'MATH',
  'LANGUAGE': 'ENG',
  'LANGUAGES': 'ENG',
  'FILIPINO': 'FIL',
  'FIL': 'FIL',
  'ENGLISH': 'ENG',
  'ENG': 'ENG',
  'SOCIAL STUDIES': 'AP',
  'SOCIAL_STUDIES': 'AP',
  'ARALING PANLIPUNAN': 'AP',
  'AP': 'AP',
  'VALUES': 'ESP',
  'ESP': 'ESP',
  'EDUKASYON SA PAGPAPAKATAO': 'ESP',
  'MAPEH': 'MAPEH',
  'TLE': 'TLE',
  'TECHNOLOGY AND LIVELIHOOD EDUCATION': 'TLE',
  'FILIPINO VALUES': 'ESP',
};

export function normalizeDepartmentCode(value: string | null | undefined, policy: QualificationPolicy): string | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (!upper) return null;
  // Check persisted aliases first
  const aliasTarget = policy.departmentAliases.get(upper);
  if (aliasTarget) return aliasTarget;
  // Fall back to legacy normalization
  return LEGACY_DEPARTMENT_NORMALIZATION[upper] ?? upper;
}

// ─── Subject Department Resolution ───

const LEGACY_SUBJECT_OWNER_DEPARTMENT_BY_PREFIX: Record<string, string> = {
  'FIL': 'FIL',
  'ENG': 'ENG',
  'MATH': 'MATH',
  'AP': 'AP',
  'ESP': 'ESP',
  'MAPEH': 'MAPEH',
  'TLE': 'TLE',
  'SCI': 'SCI',
  'STE': 'SCI',
  'SPA': 'MAPEH',
  'SPS': 'MAPEH',
};

export function resolveSubjectOwnerDepartmentCode(
  subjectCode: string,
  subjectName: string,
  policy: QualificationPolicy,
): string | null {
  // Check persisted prefix rules first
  for (const [prefix, dept] of policy.subjectOwnerPrefixes) {
    if (subjectCode.toUpperCase().startsWith(prefix)) return dept;
  }
  // Fall back to legacy prefix rules
  for (const [prefix, dept] of Object.entries(LEGACY_SUBJECT_OWNER_DEPARTMENT_BY_PREFIX)) {
    if (subjectCode.toUpperCase().startsWith(prefix)) return dept;
  }
  // Special cases
  const upperCode = subjectCode.toUpperCase();
  if (upperCode === 'HG') return 'ESP';
  if (upperCode.includes('DEVL_READING') || upperCode.includes('READING')) return 'ENG';
  return null;
}

export function resolveSubjectAllowedOwnerDepartments(
  ownerDepartment: string | null,
  subjectCode: string,
  subjectName: string,
  requiredFeatures: string[],
  policy: QualificationPolicy,
): string[] {
  const departments: string[] = [];
  const inferred = resolveSubjectOwnerDepartmentCode(subjectCode, subjectName, policy);
  if (ownerDepartment) departments.push(normalizeDepartmentCode(ownerDepartment, policy)!);
  if (inferred) departments.push(normalizeDepartmentCode(inferred, policy)!);
  // Feature-tagged departments
  for (const feature of requiredFeatures) {
    if (feature.startsWith('OWNER_DEPT:')) {
      const dept = normalizeDepartmentCode(feature.slice('OWNER_DEPT:'.length), policy);
      if (dept) departments.push(dept);
    }
  }
  return [...new Set(departments.filter(Boolean))];
}

// ─── Department Matching ───

export function matchesDepartment(
  facultyDepartment: string | null,
  allowedDepartments: string[],
  policy: QualificationPolicy,
): boolean {
  const normalized = normalizeDepartmentCode(facultyDepartment, policy);
  if (!normalized) return false;
  return allowedDepartments.includes(normalized);
}

export function matchesCrossLanguageException(
  facultyDepartment: string | null,
  subjectCode: string,
  policy: QualificationPolicy,
): boolean {
  if (!policy.legacyCrossLanguageException) return false;
  const dept = normalizeDepartmentCode(facultyDepartment, policy);
  const code = subjectCode.toUpperCase();
  if (dept === 'ENG' && code.startsWith('FIL')) return true;
  if (dept === 'FIL' && code.startsWith('ENG')) return true;
  return false;
}

// ─── Program Scope Matching ───

export function isProgramScopeCompatible(
  subjectProgramScopes: ProgramType[],
  sectionProgramType: ProgramType,
): boolean {
  if (!subjectProgramScopes || subjectProgramScopes.length === 0) return true;
  return subjectProgramScopes.includes(sectionProgramType);
}

// ─── Qualification Tier Evaluation ───

export interface QualificationInput {
  facultyId: number;
  facultyDepartment: string | null;
  facultySpecialization: string | null;
  canTeachOutsideDepartment: boolean;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  subjectOwnerDepartment: string | null;
  subjectAllowedDepartments: string[];
  subjectAllowedSpecializations: string[];
  subjectProgramScopes: ProgramType[];
  sectionProgramType: ProgramType;
  specializationAliases?: Array<{ alias: string; canonical: string }>;
}

/**
 * Canonical qualification evaluator — replaces all scattered evaluation logic.
 *
 * Tier 1: SpecializationAlias match (faculty specialization matches an alias
 *         whose canonical matches the subject's allowedSpecializations)
 * Tier 2: allowedSpecializations direct match + department match
 * Tier 3: canTeachOutsideDepartment override
 * Tier null: not qualified
 */
export async function evaluateQualification(
  input: QualificationInput,
  schoolId: number,
): Promise<QualificationResult> {
  const policy = await getPolicy(schoolId);

  const facultyDept = normalizeDepartmentCode(input.facultyDepartment, policy);
  const subjectDept = normalizeDepartmentCode(input.subjectOwnerDepartment, policy);
  const allowedDepts = input.subjectAllowedDepartments.map((d) => normalizeDepartmentCode(d, policy)!).filter(Boolean);

  const result: QualificationResult = {
    eligible: false,
    tier: null,
    reason: 'NOT_QUALIFIED',
    policyRevision: policy.revision,
    sourceFacts: {
      facultyDepartment: facultyDept,
      facultySpecialization: input.facultySpecialization,
      subjectOwnerDepartment: subjectDept,
      subjectAllowedDepartments: allowedDepts,
      subjectAllowedSpecializations: input.subjectAllowedSpecializations,
      subjectProgramScopes: input.subjectProgramScopes,
      aliasMatched: false,
      departmentMatched: false,
      specializationMatched: false,
      crossDepartmentPermitted: false,
      programScopeMatched: false,
    },
  };

  // Check program scope first — if incompatible, not qualified regardless of tier
  const programMatch = isProgramScopeCompatible(input.subjectProgramScopes, input.sectionProgramType);
  result.sourceFacts.programScopeMatched = programMatch;
  if (!programMatch) {
    result.reason = 'PROGRAM_SCOPE_INCOMPATIBLE';
    return result;
  }

  // Tier 1: SpecializationAlias match
  if (input.facultySpecialization && input.specializationAliases) {
    const aliasMatch = input.specializationAliases.find(
      (a) => a.alias.toUpperCase() === input.facultySpecialization!.toUpperCase(),
    );
    if (aliasMatch) {
      const canonical = aliasMatch.canonical.toUpperCase();
      if (input.subjectAllowedSpecializations.some((s) => s.toUpperCase() === canonical)) {
        result.eligible = true;
        result.tier = 1;
        result.reason = 'SPECIALIZATION_ALIAS_MATCH';
        result.sourceFacts.aliasMatched = true;
        result.sourceFacts.specializationMatched = true;
        return result;
      }
    }
  }

  // Tier 2: allowedSpecializations direct match + department match
  const specMatch = input.facultySpecialization &&
    input.subjectAllowedSpecializations.some((s) => s.toUpperCase() === input.facultySpecialization!.toUpperCase());
  const deptMatch = matchesDepartment(input.facultyDepartment, allowedDepts, policy);

  result.sourceFacts.specializationMatched = !!specMatch;
  result.sourceFacts.departmentMatched = deptMatch;

  if (specMatch && deptMatch) {
    result.eligible = true;
    result.tier = 2;
    result.reason = 'SPECIALIZATION_AND_DEPARTMENT_MATCH';
    return result;
  }

  // SPA/SPS special program baseline: if subject is SPA/SPS and faculty dept is MAPEH
  const upperCode = input.subjectCode.toUpperCase();
  if ((upperCode.startsWith('SPA_') || upperCode.startsWith('SPS_')) && deptMatch) {
    result.eligible = true;
    result.tier = 2;
    result.reason = 'SPECIAL_PROGRAM_DEPARTMENT_MATCH';
    return result;
  }

  // Cross-language exception
  if (matchesCrossLanguageException(input.facultyDepartment, input.subjectCode, policy)) {
    result.eligible = true;
    result.tier = 2;
    result.reason = 'CROSS_LANGUAGE_EXCEPTION';
    return result;
  }

  // Check persisted cross-department permission
  const permSet = policy.crossDepartmentPermissions.get(input.facultyId);
  if (permSet && permSet.has(input.subjectId)) {
    result.eligible = true;
    result.tier = 3;
    result.reason = 'CROSS_DEPARTMENT_PERMISSION';
    result.sourceFacts.crossDepartmentPermitted = true;
    return result;
  }

  // Tier 3: canTeachOutsideDepartment override
  if (input.canTeachOutsideDepartment) {
    result.eligible = true;
    result.tier = 3;
    result.reason = 'CAN_TEACH_OUTSIDE_DEPARTMENT';
    return result;
  }

  return result;
}

// ─── Batch Evaluation ───

export async function evaluateBatchQualifications(
  inputs: QualificationInput[],
  schoolId: number,
): Promise<QualificationResult[]> {
  const results: QualificationResult[] = [];
  for (const input of inputs) {
    results.push(await evaluateQualification(input, schoolId));
  }
  return results;
}

// ─── Department Label Resolution ───

const LEGACY_DEPARTMENT_LABELS: Record<string, string> = {
  'SCI': 'SCIENCE',
  'MATH': 'MATHEMATICS',
  'ENG': 'LANGUAGES',
  'FIL': 'FILIPINO',
  'AP': 'SOCIAL STUDIES',
  'ESP': 'VALUES EDUCATION',
  'MAPEH': 'MAPEH',
  'TLE': 'TLE',
};

export function resolveDepartmentLabel(code: string, policy: QualificationPolicy): string {
  const upper = code.toUpperCase();
  return policy.departmentLabels.get(upper) ?? LEGACY_DEPARTMENT_LABELS[upper] ?? upper;
}
