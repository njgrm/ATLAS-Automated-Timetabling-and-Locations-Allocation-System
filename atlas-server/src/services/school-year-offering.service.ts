/**
 * School-year offering service — CRUD, preview/apply, and readiness
 * for persisted offering truth per (schoolId, schoolYearId).
 *
 * Business logic only; no transport concerns.
 * Preview paths perform zero writes. Apply paths are version-guarded.
 */

import { createHash } from 'node:crypto';
import { getDataContext } from '../lib/data-context.js';
import { canonicalStringify } from '../lib/canonical-json.js';
import { type OfferingClassification, type TermMode, type ProgramType } from '@prisma/client';
import { getTermConfig, type TermConfigData } from './term-config.service.js';
import { normalizeGradeLevelSync } from './class-program-slot.service.js';
import { assertSchoolYearAuthority } from './school-year-authority.service.js';

const db = () => getDataContext();

// ─── Types ───

export interface OfferingData {
  id: number;
  schoolId: number;
  schoolYearId: number;
  termConfigId: number;
  subjectId: number | null;
  gradeLevel: number;
  programType: ProgramType;
  sectionMirrorId: number | null;
  cohortId: number | null;
  classification: OfferingClassification;
  weeklyMinutes: number;
  rotationFamily: string | null;
  rotationOrder: number | null;
  termMode: TermMode;
  isActive: boolean;
  retiredAt: Date | null;
  retiredBy: number | null;
  version: number;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  termIdentities: string[];
}

export interface OfferingInput {
  subjectId: number | null;
  gradeLevel: number;
  programType: ProgramType;
  sectionMirrorId?: number | null;
  cohortId?: number | null;
  classification: OfferingClassification;
  weeklyMinutes: number;
  rotationFamily?: string | null;
  rotationOrder?: number | null;
  termMode: TermMode;
  termIdentities: string[];
}

export interface OfferingPreviewResult {
  offerings: OfferingInput[];
  totalCount: number;
  newCount: number;
  unchangedCount: number;
  retiredCount: number;
  termConfigValid: boolean;
  fingerprint: string;
  /**
   * SCA-02: active source revisions (row id → version) observed by this
   * preview. The batch apply must echo them back; any drift rejects with
   * STALE_WRITE before a single write.
   */
  sourceVersions: Record<string, number>;
  /**
   * SCA-02R: exact term-config revision this preview was computed against.
   * The batch apply must echo `termConfigUpdatedAt` and revalidate it
   * inside the same Serializable transaction.
   */
  termConfigRevision: { id: number; updatedAt: string } | null;
}

export interface OfferingReadinessResult {
  ready: boolean;
  termConfigPresent: boolean;
  offeringCount: number;
  blockers: Array<{ code: string; message: string }>;
}

// ─── Errors ───

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
  const e = new Error(message) as Error & { statusCode: number; code: string };
  e.statusCode = statusCode;
  e.code = code;
  return e;
}

// ─── SCA-02R — Canonical requirement identity ───
//
// One shared identity representation containing every scope-defining field.
// Used consistently by duplicate detection, preview comparison,
// unchanged/new/retired counts, batch retirement, batch upsert matching,
// and conflict detection, so default, section, and cohort requirements can
// never collapse into each other.

export interface RequirementIdentity {
  subjectId: number | null;
  gradeLevel: number;
  programType: string;
  sectionMirrorId: number | null;
  cohortId: number | null;
  rotationFamily: string | null;
}

export function requirementIdentityOf(input: {
  subjectId: number | null;
  gradeLevel: number;
  programType: string;
  sectionMirrorId?: number | null;
  cohortId?: number | null;
  rotationFamily?: string | null;
}): RequirementIdentity {
  return {
    subjectId: input.subjectId,
    gradeLevel: input.gradeLevel,
    programType: input.programType,
    sectionMirrorId: input.sectionMirrorId ?? null,
    cohortId: input.cohortId ?? null,
    // rotationFamily distinguishes rows: two rotating members of different
    // families in one scope are distinct requirements.
    rotationFamily: input.rotationFamily ?? null,
  };
}

/** Deterministic identity key for matching, counting, and retirement. */
export function requirementIdentityKey(identity: RequirementIdentity): string {
  return canonicalStringify([
    identity.subjectId,
    identity.gradeLevel,
    identity.programType,
    identity.sectionMirrorId,
    identity.cohortId,
    identity.rotationFamily,
  ]);
}

/** Normalized semantic payload bound by the fingerprint (identity excluded). */
export interface RequirementSemantics {
  classification: string;
  weeklyMinutes: number;
  termMode: string;
  rotationOrder: number | null;
  termIdentities: string[];
}

export function requirementSemanticsOf(input: {
  classification: string;
  weeklyMinutes: number;
  termMode: string;
  rotationOrder?: number | null;
  termIdentities: string[];
}): RequirementSemantics {
  return {
    classification: input.classification,
    weeklyMinutes: input.weeklyMinutes,
    termMode: input.termMode,
    rotationOrder: input.rotationOrder ?? null,
    termIdentities: [...input.termIdentities].sort(),
  };
}

/** True when two rows carry identical semantics (identity compared separately). */
export function sameRequirementSemantics(
  a: { classification: string; weeklyMinutes: number; termMode: string; rotationFamily?: string | null; rotationOrder?: number | null; termIdentities: string[] },
  b: { classification: string; weeklyMinutes: number; termMode: string; rotationFamily?: string | null; rotationOrder?: number | null; termIdentities: string[] },
): boolean {
  if (a.classification !== b.classification) return false;
  if (a.weeklyMinutes !== b.weeklyMinutes) return false;
  if (a.termMode !== b.termMode) return false;
  if ((a.rotationFamily ?? null) !== (b.rotationFamily ?? null)) return false;
  if ((a.rotationOrder ?? null) !== (b.rotationOrder ?? null)) return false;
  const aTerms = [...a.termIdentities].sort();
  const bTerms = [...b.termIdentities].sort();
  return aTerms.length === bTerms.length && aTerms.every((t, i) => t === bTerms[i]);
}

// ─── Validation ───

const VALID_GRADE_LEVELS = new Set([7, 8, 9, 10]);
const VALID_PROGRAM_TYPES = new Set(['REGULAR', 'STE', 'SPA', 'SPS', 'OTHER']);

/** Whitelisted fields for a requirement input at route and service boundaries. */
export const KNOWN_OFFERING_FIELDS = new Set([
  'subjectId',
  'gradeLevel',
  'programType',
  'sectionMirrorId',
  'cohortId',
  'classification',
  'weeklyMinutes',
  'rotationFamily',
  'rotationOrder',
  'termMode',
  'termIdentities',
]);

/** Whitelisted fields for a single-row requirement patch. */
export const KNOWN_REQUIREMENT_PATCH_FIELDS = new Set([
  'classification',
  'weeklyMinutes',
  'termMode',
  'rotationFamily',
  'rotationOrder',
  'termIdentities',
]);

/**
 * SCA-02R: list unknown field names, or null when the value is not an
 * object at all (the caller then reports a shape error instead).
 */
export function unknownFieldNames(raw: unknown, allowed: Set<string>): string[] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return Object.keys(raw as Record<string, unknown>).filter((k) => !allowed.has(k));
}

/** Reject unknown fields with a stable typed error at either boundary. */
export function assertKnownFields(raw: unknown, allowed: Set<string>, what: string): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw err(400, 'INVALID_OFFERING', `${what} must be an object.`);
  }
  const unknown = Object.keys(raw as Record<string, unknown>).filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    throw err(400, 'UNKNOWN_FIELD', `${what} contains unknown field(s): ${unknown.join(', ')}.`);
  }
}

/**
 * SCA-02: `termConfig` may be null. All-year (`ALL` with zero term
 * assignments) and explicit-empty (`EMPTY`) rows never require term truth,
 * so ordinary all-year subjects must not acquire a fake term configuration.
 * Only term-aware rows (rotating members, or rows carrying term assignments)
 * require persisted term truth.
 */
export function validateOfferingInput(input: OfferingInput, termConfig: TermConfigData | null): string[] {
  const errors: string[] = [];

  // SCA-02R: strict shape checks first — non-string term identities,
  // malformed rotation metadata, and malformed optional ids are typed
  // errors, never coercions or runtime TypeErrors.
  if (!Array.isArray(input.termIdentities)) {
    errors.push('termIdentities must be an array of strings.');
  } else {
    const malformedTerms = input.termIdentities.filter((t) => typeof t !== 'string' || t.trim().length === 0);
    if (malformedTerms.length > 0) {
      errors.push('Every term identity must be a non-empty string.');
    }
  }
  if (input.rotationFamily !== undefined && input.rotationFamily !== null && typeof input.rotationFamily !== 'string') {
    errors.push('rotationFamily must be a string or null.');
  }
  if (input.rotationOrder !== undefined && input.rotationOrder !== null && !Number.isInteger(input.rotationOrder)) {
    errors.push('rotationOrder must be an integer or null.');
  }
  for (const [field, value] of [['subjectId', input.subjectId], ['sectionMirrorId', input.sectionMirrorId], ['cohortId', input.cohortId]] as const) {
    if (value !== undefined && value !== null && (!Number.isInteger(value) || (value as number) <= 0)) {
      errors.push(`${field} must be a positive integer or null.`);
    }
  }

  if (input.termMode === 'EMPTY') {
    if (input.subjectId !== null) {
      errors.push('EMPTY scope offering must have null subjectId.');
    }
    if (input.weeklyMinutes !== 0) {
      errors.push('EMPTY scope offering must have 0 weeklyMinutes.');
    }
    if (input.termIdentities.length !== 0) {
      errors.push('EMPTY scope offering must not carry term assignments.');
    }
    if (input.rotationFamily != null || input.rotationOrder != null) {
      errors.push('EMPTY scope offering must not have rotation metadata.');
    }
  } else {
    if (input.subjectId === null) {
      errors.push('Non-EMPTY offering must have a subjectId.');
    }
    if (!Number.isInteger(input.weeklyMinutes) || input.weeklyMinutes <= 0) {
      errors.push('weeklyMinutes must be a positive integer.');
    }
  }

  if (!VALID_GRADE_LEVELS.has(input.gradeLevel)) {
    errors.push(`gradeLevel must be one of: ${[...VALID_GRADE_LEVELS].join(', ')}.`);
  }

  if (!VALID_PROGRAM_TYPES.has(input.programType)) {
    errors.push(`programType must be one of: ${[...VALID_PROGRAM_TYPES].join(', ')}.`);
  }

  if (input.termMode === 'ROTATING_FAMILY_MEMBER') {
    if (typeof input.rotationFamily !== 'string' || input.rotationFamily.trim().length === 0) {
      errors.push('ROTATING_FAMILY_MEMBER must have a rotationFamily.');
    }
    if (!termConfig) {
      errors.push('ROTATING_FAMILY_MEMBER requires persisted term configuration.');
    } else {
      if (!Number.isInteger(input.rotationOrder) || input.rotationOrder! < 1 || input.rotationOrder! > termConfig.termCount) {
        errors.push(`rotationOrder must be between 1 and ${termConfig.termCount}.`);
      }
    }
    if (input.termIdentities.length !== 1) {
      errors.push('ROTATING_FAMILY_MEMBER must assign exactly one term.');
    }
  } else if (input.termMode === 'ALL') {
    if (input.rotationFamily != null) {
      errors.push('ALL mode offering must not have a rotationFamily.');
    }
    if (input.rotationOrder != null) {
      errors.push('ALL mode offering must not have a rotationOrder.');
    }
    if (input.termIdentities.length === 0) {
      // All-year requirement: runs every term of the year. No term truth
      // required and no synthesized term list is stored.
    } else if (!termConfig) {
      errors.push('Term-assigned ALL mode offering requires persisted term configuration.');
    } else if (input.termIdentities.length !== termConfig.termCount) {
      errors.push(`ALL mode offering must assign zero terms (all-year) or exactly ${termConfig.termCount} terms.`);
    }
  }

  // Validate term identities belong to the config (only when assigned).
  if (input.termIdentities.length > 0) {
    if (!termConfig) {
      errors.push('Term assignments require persisted term configuration.');
    } else {
      const invalidTerms = input.termIdentities.filter((t) => !termConfig.termIdentities.includes(t));
      if (invalidTerms.length > 0) {
        errors.push(`Term identities not in config: ${invalidTerms.join(', ')}.`);
      }
    }
  }

  // Section/cohort exclusivity
  if (input.sectionMirrorId != null && input.cohortId != null) {
    errors.push('Cannot specify both sectionMirrorId and cohortId.');
  }

  return errors;
}

// ─── Read ───

export async function listOfferings(schoolId: number, schoolYearId: number): Promise<OfferingData[]> {
  const rows = await db().schoolYearOffering.findMany({
    where: { schoolId, schoolYearId },
    include: { termAssignments: { select: { termIdentity: true } } },
    orderBy: [{ gradeLevel: 'asc' }, { programType: 'asc' }, { id: 'asc' }],
  });

  return rows.map((row) => ({
    id: row.id,
    schoolId: row.schoolId,
    schoolYearId: row.schoolYearId,
    termConfigId: row.termConfigId,
    subjectId: row.subjectId,
    gradeLevel: row.gradeLevel,
    programType: row.programType,
    sectionMirrorId: row.sectionMirrorId,
    cohortId: row.cohortId,
    classification: row.classification,
    weeklyMinutes: row.weeklyMinutes,
    rotationFamily: row.rotationFamily,
    rotationOrder: row.rotationOrder,
    termMode: row.termMode,
    isActive: row.isActive,
    retiredAt: row.retiredAt,
    retiredBy: row.retiredBy,
    version: row.version,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    termIdentities: row.termAssignments.map((ta) => ta.termIdentity),
  }));
}

// ─── Preview (zero writes) ───

export async function previewOfferings(
  schoolId: number,
  schoolYearId: number,
  proposedOfferings: OfferingInput[],
): Promise<OfferingPreviewResult> {
  await assertSchoolYearAuthority(schoolId, schoolYearId);
  const termConfig = await getTermConfig(schoolId, schoolYearId);
  // Fail-closed preview: malformed proposals reject before any diff is
  // computed, so a preview can never bless an unvalidatable set.
  for (const input of proposedOfferings) {
    assertKnownFields(input, KNOWN_OFFERING_FIELDS, 'offering');
    const errors = validateOfferingInput(input, termConfig);
    if (errors.length > 0) {
      throw err(400, 'INVALID_OFFERING', `Offering subjectId=${input.subjectId} grade=${input.gradeLevel}: ${errors.join(' ')}`);
    }
  }
  assertNoProposedConflicts(proposedOfferings);
  const termConfigRevision = termConfig ? { id: termConfig.id, updatedAt: termConfig.updatedAt.toISOString() } : null;
  if (!termConfig) {
    return {
      offerings: proposedOfferings,
      totalCount: proposedOfferings.length,
      newCount: proposedOfferings.length,
      unchangedCount: 0,
      retiredCount: 0,
      termConfigValid: false,
      fingerprint: computeRequirementFingerprint(proposedOfferings),
      sourceVersions: {},
      termConfigRevision,
    };
  }

  const existing = await listOfferings(schoolId, schoolYearId);
  const existingActive = existing.filter((o) => o.isActive);
  const sourceVersions: Record<string, number> = {};
  const existingByIdentity = new Map<string, OfferingData>();
  for (const row of existingActive) {
    sourceVersions[String(row.id)] = row.version;
    existingByIdentity.set(requirementIdentityKey(requirementIdentityOf(row)), row);
  }

  let newCount = 0;
  let unchangedCount = 0;
  let retiredCount = 0;

  for (const proposed of proposedOfferings) {
    const match = existingByIdentity.get(requirementIdentityKey(requirementIdentityOf(proposed)));
    if (match && sameRequirementSemantics(match, proposed)) {
      unchangedCount++;
    } else {
      newCount++;
    }
  }

  // Count offerings that would be retired (exist active but not in proposed).
  // Matching is by full canonical identity: an override row never rescues
  // its base scope from retirement, and vice versa.
  const proposedKeys = new Set(proposedOfferings.map((p) => requirementIdentityKey(requirementIdentityOf(p))));
  for (const existingOffering of existingActive) {
    if (!proposedKeys.has(requirementIdentityKey(requirementIdentityOf(existingOffering)))) {
      retiredCount++;
    }
  }

  return {
    offerings: proposedOfferings,
    totalCount: proposedOfferings.length,
    newCount,
    unchangedCount,
    retiredCount,
    termConfigValid: true,
    fingerprint: computeRequirementFingerprint(proposedOfferings),
    sourceVersions,
    termConfigRevision,
  };
}

/**
 * SCA-02R: the same canonical identity proposed twice with different
 * semantics is a conflict, not an upsert. Reject before any write.
 */
export function assertNoProposedConflicts(proposedOfferings: OfferingInput[]): void {
  const seen = new Map<string, OfferingInput>();
  for (const proposed of proposedOfferings) {
    const key = requirementIdentityKey(requirementIdentityOf(proposed));
    const first = seen.get(key);
    if (first) {
      if (!sameRequirementSemantics(first, proposed)) {
        throw err(409, 'CURRICULUM_SCOPE_CONFLICT', 'The same requirement scope is proposed with different minutes, classification, or term rules. Resolve the conflict before applying.');
      }
      throw err(409, 'REQUIREMENT_DUPLICATE', 'The same requirement scope is proposed twice in one batch.');
    }
    seen.set(key, proposed);
  }
}

// ─── Apply (version-guarded) ───

/** SCA-02: a proposed row needs persisted term truth only when it is term-aware. */
export function offeringNeedsTermConfig(input: OfferingInput): boolean {
  if (input.termMode === 'EMPTY') return false;
  if (input.termMode === 'ROTATING_FAMILY_MEMBER') return true;
  return input.termIdentities.length > 0;
}

export async function applyOfferings(
  schoolId: number,
  schoolYearId: number,
  proposedOfferings: OfferingInput[],
  actorId: number,
): Promise<{ applied: number; retired: number }> {
  await assertSchoolYearAuthority(schoolId, schoolYearId);
  const termConfig = await getTermConfig(schoolId, schoolYearId);
  if (!termConfig) {
    throw err(400, 'TERM_CONFIG_MISSING', 'Term configuration must exist before applying requirements.');
  }

  // Validate all proposed offerings
  for (const input of proposedOfferings) {
    const errors = validateOfferingInput(input, termConfig);
    if (errors.length > 0) {
      throw err(400, 'INVALID_OFFERING', `Offering subjectId=${input.subjectId} grade=${input.gradeLevel}: ${errors.join(' ')}`);
    }
  }

  // Use a transaction for atomicity
  const result = await db().$transaction(async (tx) => {
    return applyProposedInTx(tx as unknown as TxClient, {
      schoolId,
      schoolYearId,
      termConfigId: termConfig.id,
      proposedOfferings,
      actorId,
    });
  });

  return result;
}

interface TxClient {
  schoolYearOffering: {
    findMany(args: unknown): Promise<Array<{
      id: number; subjectId: number | null; gradeLevel: number; programType: string;
      sectionMirrorId: number | null; cohortId: number | null;
      classification: string; weeklyMinutes: number; termMode: string;
      rotationFamily: string | null; rotationOrder: number | null;
      termAssignments: Array<{ termIdentity: string }>;
    }>>;
    update(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<{ id: number }>;
  };
  offeringTermAssignment: {
    deleteMany(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
  };
}

/**
 * Shared batch upsert core. Runs inside the caller's transaction; the caller
 * owns validation, fingerprint/staleness guards, and isolation level.
 * Matching and retirement use the canonical requirement identity, so
 * default, section, and cohort rows never collapse into each other.
 */
async function applyProposedInTx(
  tx: TxClient,
  params: {
    schoolId: number;
    schoolYearId: number;
    termConfigId: number;
    proposedOfferings: OfferingInput[];
    actorId: number | null;
  },
): Promise<{ applied: number; retired: number }> {
    // Get current active offerings with scope + term applicability.
    const currentActive = await tx.schoolYearOffering.findMany({
      where: { schoolId: params.schoolId, schoolYearId: params.schoolYearId, isActive: true },
      include: { termAssignments: { select: { termIdentity: true } } },
    });
    const currentByIdentity = new Map<string, (typeof currentActive)[number]>();
    for (const row of currentActive) {
      currentByIdentity.set(requirementIdentityKey(requirementIdentityOf({
        subjectId: row.subjectId,
        gradeLevel: row.gradeLevel,
        programType: row.programType,
        sectionMirrorId: row.sectionMirrorId,
        cohortId: row.cohortId,
        rotationFamily: row.rotationFamily,
      })), row);
    }

    let applied = 0;
    let retired = 0;

    // Retire offerings not in proposed set (identity match only).
    const proposedKeys = new Set(params.proposedOfferings.map((p) => requirementIdentityKey(requirementIdentityOf(p))));
    for (const current of currentActive) {
      const key = requirementIdentityKey(requirementIdentityOf({
        subjectId: current.subjectId,
        gradeLevel: current.gradeLevel,
        programType: current.programType,
        sectionMirrorId: current.sectionMirrorId,
        cohortId: current.cohortId,
        rotationFamily: current.rotationFamily,
      }));
      if (!proposedKeys.has(key)) {
        await tx.schoolYearOffering.update({
          where: { id: current.id },
          data: {
            isActive: false,
            retiredAt: new Date(),
            retiredBy: params.actorId,
            updatedBy: params.actorId,
            version: { increment: 1 },
          },
        });
        // Remove term assignments
        await tx.offeringTermAssignment.deleteMany({ where: { offeringId: current.id } });
        retired++;
      }
    }

    // Upsert proposed offerings
    for (const input of params.proposedOfferings) {
      const existing = currentByIdentity.get(requirementIdentityKey(requirementIdentityOf(input)));

      if (existing) {
        // Update when semantics differ (classification, minutes, term mode,
        // rotation order, or term assignments).
        const existingTerms = existing.termAssignments.map((t) => t.termIdentity);
        const needsUpdate = !sameRequirementSemantics(
          {
            classification: existing.classification,
            weeklyMinutes: existing.weeklyMinutes,
            termMode: existing.termMode,
            rotationFamily: existing.rotationFamily,
            rotationOrder: existing.rotationOrder,
            termIdentities: existingTerms,
          },
          input,
        );

        if (needsUpdate) {
          await tx.schoolYearOffering.update({
            where: { id: existing.id },
            data: {
              classification: input.classification,
              weeklyMinutes: input.weeklyMinutes,
              termMode: input.termMode,
              rotationFamily: input.rotationFamily ?? null,
              rotationOrder: input.rotationOrder ?? null,
              updatedBy: params.actorId,
              version: { increment: 1 },
            },
          });
          // Update term assignments
          await tx.offeringTermAssignment.deleteMany({ where: { offeringId: existing.id } });
          for (const termIdentity of input.termIdentities) {
            await tx.offeringTermAssignment.create({
              data: { offeringId: existing.id, termIdentity },
            });
          }
        }
        applied++;
      } else {
        // Create new
        const created = await tx.schoolYearOffering.create({
          data: {
            schoolId: params.schoolId,
            schoolYearId: params.schoolYearId,
            termConfigId: params.termConfigId,
            subjectId: input.subjectId,
            gradeLevel: input.gradeLevel,
            programType: input.programType,
            sectionMirrorId: input.sectionMirrorId ?? null,
            cohortId: input.cohortId ?? null,
            classification: input.classification,
            weeklyMinutes: input.weeklyMinutes,
            rotationFamily: input.rotationFamily ?? null,
            rotationOrder: input.rotationOrder ?? null,
            termMode: input.termMode,
            createdBy: params.actorId,
            updatedBy: params.actorId,
          },
        });
        for (const termIdentity of input.termIdentities) {
          await tx.offeringTermAssignment.create({
            data: { offeringId: created.id, termIdentity },
          });
        }
        applied++;
      }
    }

    return { applied, retired };
}

// ─── Readiness ───

export async function evaluateOfferingReadiness(
  schoolId: number,
  schoolYearId: number,
): Promise<OfferingReadinessResult> {
  const termConfig = await getTermConfig(schoolId, schoolYearId);
  const offerings = termConfig ? await listOfferings(schoolId, schoolYearId) : [];
  const activeOfferings = offerings.filter((o) => o.isActive);

  const blockers: Array<{ code: string; message: string }> = [];

  if (!termConfig) {
    blockers.push({
      code: 'OFFERING_TERM_CONFIG_MISSING',
      message: 'No persisted term configuration exists for this school year. Configure terms before adding offerings.',
    });
  }

  if (activeOfferings.length === 0 && termConfig) {
    blockers.push({
      code: 'OFFERING_TRUTH_MISSING',
      message: 'No active offerings exist. Add offerings to define generation demand.',
    });
  }

  return {
    ready: blockers.length === 0,
    termConfigPresent: termConfig !== null,
    offeringCount: activeOfferings.length,
    blockers,
  };
}

// ─── Fingerprint (canonical JSON + SHA-256) ───

/**
 * SCA-02R: content fingerprint over the repository canonical JSON facility
 * (`lib/canonical-json.ts`) hashed with SHA-256. Binds every semantic
 * proposal field — identity (subject, grade, program, section, cohort,
 * rotation family), classification, minutes, term mode, rotation order, and
 * normalized (sorted) term identities. Proposals are sorted by identity key
 * first, so array ordering never changes the hash, while any semantic field
 * mutation invalidates it.
 */
export function computeRequirementFingerprint(offerings: OfferingInput[]): string {
  const normalized = offerings.map((o) => ({
    identity: requirementIdentityOf(o),
    semantics: requirementSemanticsOf(o),
  }));
  normalized.sort((a, b) =>
    requirementIdentityKey(a.identity).localeCompare(requirementIdentityKey(b.identity)),
  );
  return `CURR_REQ_${createHash('sha256').update(canonicalStringify(normalized)).digest('hex').toUpperCase()}`;
}

/** Legacy alias: all callers bind the same canonical fingerprint. */
export function computeFingerprint(offerings: OfferingInput[]): string {
  return computeRequirementFingerprint(offerings);
}

// ─── SCA-02 — Curriculum Requirements (ATLAS-owned current-year authority) ───
//
// User-facing language is "Curriculum Requirements" / "Required Subjects".
// The Prisma model name `SchoolYearOffering` is retained to avoid schema churn.
// This block never calls EnrollPro: section/program metadata may identify
// scopes, but required subjects are operator-persisted ATLAS truth only.

export type CurriculumScopeState = 'MISSING' | 'EMPTY' | 'CONFIGURED' | 'STALE' | 'CONFLICTING';

export interface CurriculumScopeStatus {
  scopeKey: string;
  gradeLevel: number | null;
  programType: string | null;
  sectionMirrorId: number | null;
  cohortId: number | null;
  state: CurriculumScopeState;
  requirementIds: number[];
  detail: string;
}

export interface CurriculumReadinessResult {
  ready: boolean;
  termConfigPresent: boolean;
  requirementCount: number;
  scopeStates: CurriculumScopeStatus[];
  blockers: Array<{ code: string; scopeKey: string; message: string }>;
}

export interface CurriculumRequirementsSnapshot {
  termConfig: TermConfigData | null;
  requirements: OfferingData[];
}

/** Canonical scope identity: grade + program + optional section/cohort override. */
export function requirementScopeKey(row: {
  gradeLevel: number;
  programType: string;
  sectionMirrorId: number | null;
  cohortId: number | null;
}): string {
  const section = row.sectionMirrorId === null ? '-' : `section-${row.sectionMirrorId}`;
  const cohort = row.cohortId === null ? '-' : `cohort-${row.cohortId}`;
  return `G${row.gradeLevel}:${row.programType}:${section}:${cohort}`;
}

/**
 * SCA-02R: expected base-scope inventory built from same-school/year
 * active, non-stale section mirrors. Grade numbers come from
 * `normalizeGradeLevelSync`; programs outside the requirement vocabulary
 * (REGULAR/STE/SPA/SPS/OTHER) fold to OTHER, matching the section-adapter
 * fallback for unknown program metadata.
 */
export interface ExpectedScope {
  gradeLevel: number;
  programType: string;
  scopeKey: string;
}

const REQUIREMENT_PROGRAMS = new Set(['REGULAR', 'STE', 'SPA', 'SPS', 'OTHER']);

export function expectedProgramForSection(rawProgramType: string | null): string {
  const normalized = (rawProgramType ?? '').trim().toUpperCase();
  return REQUIREMENT_PROGRAMS.has(normalized) ? normalized : 'OTHER';
}

export async function buildExpectedScopes(
  schoolId: number,
  schoolYearId: number,
): Promise<ExpectedScope[]> {
  const mirrors = await db().sectionMirror.findMany({
    where: { schoolId, schoolYearId, isActiveForScheduling: true, isStale: false },
    select: { gradeLevelId: true, programType: true },
  });
  const seen = new Map<string, ExpectedScope>();
  for (const mirror of mirrors) {
    const gradeLevel = normalizeGradeLevelSync(mirror.gradeLevelId);
    if (!VALID_GRADE_LEVELS.has(gradeLevel)) continue;
    const programType = expectedProgramForSection(mirror.programType);
    const scopeKey = `G${gradeLevel}:${programType}:-:-`;
    if (!seen.has(scopeKey)) {
      seen.set(scopeKey, { gradeLevel, programType, scopeKey });
    }
  }
  return [...seen.values()].sort((a, b) => a.scopeKey.localeCompare(b.scopeKey));
}

/**
 * SCA-02R: classify one exact-scope row group. Shared by expected base
 * scopes and out-of-inventory scopes (overrides) so both use identical
 * EMPTY/STALE/CONFLICTING/CONFIGURED semantics.
 */
export function classifyScopeGroup(
  group: OfferingData[],
  termConfig: TermConfigData,
): {
  state: CurriculumScopeState;
  detail: string;
  blockers: Array<{ code: string; scopeKey: string; message: string }>;
} {
  const scopeKey = requirementScopeKey({
    gradeLevel: group[0].gradeLevel,
    programType: group[0].programType,
    sectionMirrorId: group[0].sectionMirrorId,
    cohortId: group[0].cohortId,
  });
  const blockers: Array<{ code: string; scopeKey: string; message: string }> = [];

  if (group.every((r) => r.termMode === 'EMPTY')) {
    return {
      state: 'EMPTY',
      detail: 'Scope is explicitly configured as offering nothing. This is intentional and does not block readiness.',
      blockers,
    };
  }

  if (group.some((r) => r.termConfigId !== termConfig.id)) {
    blockers.push({
      code: 'CURRICULUM_SCOPE_STALE',
      scopeKey,
      message: `Scope ${scopeKey} references a superseded term configuration. Refresh the requirements against the current terms.`,
    });
    return { state: 'STALE', detail: 'One or more rows reference a superseded term configuration.', blockers };
  }

  // Conflicting: the same canonical identity persisted twice with different
  // semantics (possible only for legacy rows predating identity enforcement).
  const byIdentity = new Map<string, OfferingData[]>();
  for (const row of group) {
    if (row.subjectId === null) continue;
    const key = requirementIdentityKey(requirementIdentityOf(row));
    const list = byIdentity.get(key);
    if (list) list.push(row);
    else byIdentity.set(key, [row]);
  }
  for (const list of byIdentity.values()) {
    if (list.length > 1 && list.some((r) => !sameRequirementSemantics(list[0], r))) {
      blockers.push({
        code: 'CURRICULUM_SCOPE_CONFLICT',
        scopeKey,
        message: `Scope ${scopeKey} requires the same subject with different minutes, classification, or term rules. Resolve the conflict before proceeding.`,
      });
      return { state: 'CONFLICTING', detail: 'The same requirement identity persists with different semantics.', blockers };
    }
  }

  // Term truth per row: unknown or out-of-config applicability blocks.
  for (const row of group) {
    if (row.termMode === 'EMPTY') continue;
    if (row.termMode === 'ROTATING_FAMILY_MEMBER') {
      if (!row.rotationFamily || row.termIdentities.length !== 1 || !termConfig.termIdentities.includes(row.termIdentities[0])) {
        blockers.push({
          code: 'OFFERING_TERM_TRUTH_MISSING',
          scopeKey,
          message: `Requirement ${row.id} has ambiguous rotation applicability.`,
        });
      }
    } else if (row.termIdentities.length > 0) {
      // ALL mode with explicit assignments: every assigned term must exist.
      const invalid = row.termIdentities.filter((t) => !termConfig.termIdentities.includes(t));
      if (invalid.length > 0) {
        blockers.push({
          code: 'OFFERING_TERM_TRUTH_MISSING',
          scopeKey,
          message: `Requirement ${row.id} references unknown terms: ${invalid.join(', ')}.`,
        });
      }
    }
    // ALL mode with zero assignments is an all-year requirement: no term
    // truth needed and no synthesized term list is ever attached.
  }

  return { state: 'CONFIGURED', detail: 'Scope has persisted required subjects.', blockers };
}

/**
 * SCA-02.3/02R: production-reachable read-only readiness over persisted
 * requirements. The expected scope inventory comes from active section
 * mirrors: every expected grade/program base scope must hold configured
 * requirements or an explicit EMPTY marker, else it is MISSING.
 * Section/cohort overrides never satisfy a base scope, and an EMPTY marker
 * clears only its exact scope. Never consults the subject catalog.
 */
export async function evaluateCurriculumReadiness(
  schoolId: number,
  schoolYearId: number,
): Promise<CurriculumReadinessResult> {
  await assertSchoolYearAuthority(schoolId, schoolYearId);
  const termConfig = await getTermConfig(schoolId, schoolYearId);
  const rows = termConfig ? (await listOfferings(schoolId, schoolYearId)).filter((o) => o.isActive) : [];
  const blockers: CurriculumReadinessResult['blockers'] = [];
  const scopeStates: CurriculumScopeStatus[] = [];

  if (!termConfig) {
    blockers.push({
      code: 'OFFERING_TERM_CONFIG_MISSING',
      scopeKey: '*',
      message: 'No persisted term configuration exists for this school year. Configure terms before adding required subjects.',
    });
    const expectedWithoutConfig = await buildExpectedScopes(schoolId, schoolYearId);
    if (expectedWithoutConfig.length === 0) {
      scopeStates.push({
        scopeKey: '*',
        gradeLevel: null,
        programType: null,
        sectionMirrorId: null,
        cohortId: null,
        state: 'MISSING',
        requirementIds: [],
        detail: 'No Curriculum Requirements truth exists for this school year.',
      });
    } else {
      for (const expected of expectedWithoutConfig) {
        scopeStates.push({
          scopeKey: expected.scopeKey,
          gradeLevel: expected.gradeLevel,
          programType: expected.programType,
          sectionMirrorId: null,
          cohortId: null,
          state: 'MISSING',
          requirementIds: [],
          detail: 'Scope has sections but no term configuration or requirements yet.',
        });
      }
    }
    // Rows without a config are unreachable through validated writes (the
    // schema FK requires a config row), so no further states apply here.
    return { ready: false, termConfigPresent: false, requirementCount: 0, scopeStates, blockers };
  }

  const byScope = new Map<string, OfferingData[]>();
  for (const row of rows) {
    const key = requirementScopeKey(row);
    const group = byScope.get(key);
    if (group) group.push(row);
    else byScope.set(key, [row]);
  }

  // SCA-02R: every expected base scope (from section mirrors) must hold
  // configured requirements or an explicit EMPTY marker. Only rows WITHOUT
  // section/cohort overrides count toward the base scope.
  const expected = await buildExpectedScopes(schoolId, schoolYearId);
  const evaluatedKeys = new Set<string>();
  for (const item of expected) {
    const baseRows = (byScope.get(item.scopeKey) ?? []).filter((r) => r.sectionMirrorId === null && r.cohortId === null);
    if (baseRows.length === 0) {
      blockers.push({
        code: 'OFFERING_TRUTH_MISSING',
        scopeKey: item.scopeKey,
        message: `Scope ${item.scopeKey} has active sections but no required subjects and no explicit-empty marker.`,
      });
      scopeStates.push({
        scopeKey: item.scopeKey,
        gradeLevel: item.gradeLevel,
        programType: item.programType,
        sectionMirrorId: null,
        cohortId: null,
        state: 'MISSING',
        requirementIds: [],
        detail: 'Active sections exist for this grade/program scope, but no requirements or explicit-empty marker is configured.',
      });
      evaluatedKeys.add(item.scopeKey);
      continue;
    }
    const verdict = classifyScopeGroup(baseRows, termConfig);
    scopeStates.push({
      scopeKey: item.scopeKey,
      gradeLevel: item.gradeLevel,
      programType: item.programType,
      sectionMirrorId: null,
      cohortId: null,
      requirementIds: baseRows.map((r) => r.id),
      state: verdict.state,
      detail: verdict.detail,
    });
    blockers.push(...verdict.blockers);
    evaluatedKeys.add(item.scopeKey);
  }

  if (rows.length === 0 && expected.length === 0) {
    blockers.push({
      code: 'OFFERING_TRUTH_MISSING',
      scopeKey: '*',
      message: 'No required subjects are configured for this school year. Add Curriculum Requirements before Teaching Load or generation can consume them.',
    });
    scopeStates.push({
      scopeKey: '*',
      gradeLevel: null,
      programType: null,
      sectionMirrorId: null,
      cohortId: null,
      state: 'MISSING',
      requirementIds: [],
      detail: 'No Curriculum Requirements truth exists for this school year.',
    });
    return { ready: false, termConfigPresent: true, requirementCount: 0, scopeStates, blockers };
  }

  // Persisted scopes outside the expected inventory (section/cohort
  // overrides, or grades without current section mirrors) are evaluated on
  // their own merits but never satisfy a missing base scope.
  for (const [scopeKey, group] of byScope) {
    if (evaluatedKeys.has(scopeKey)) continue;
    const first = group[0];
    const verdict = classifyScopeGroup(group, termConfig);
    scopeStates.push({
      scopeKey,
      gradeLevel: first.gradeLevel,
      programType: first.programType,
      sectionMirrorId: first.sectionMirrorId,
      cohortId: first.cohortId,
      requirementIds: group.map((r) => r.id),
      state: verdict.state,
      detail: verdict.detail,
    });
    blockers.push(...verdict.blockers);
  }

  scopeStates.sort((a, b) => a.scopeKey.localeCompare(b.scopeKey));
  return {
    ready: blockers.length === 0,
    termConfigPresent: true,
    requirementCount: rows.length,
    scopeStates,
    blockers,
  };
}

/** SCA-02.1: read-only snapshot for the operator workflow. Zero writes. */
export async function getCurriculumRequirements(
  schoolId: number,
  schoolYearId: number,
): Promise<CurriculumRequirementsSnapshot> {
  await assertSchoolYearAuthority(schoolId, schoolYearId);
  const termConfig = await getTermConfig(schoolId, schoolYearId);
  const requirements = termConfig ? await listOfferings(schoolId, schoolYearId) : [];
  return { termConfig, requirements };
}

async function assertRequirementSubject(schoolId: number, subjectId: number): Promise<void> {
  // Integer guard first: NaN/float ids must be typed 400s, never Prisma 500s.
  if (!Number.isInteger(subjectId) || subjectId <= 0) {
    throw err(400, 'INVALID_SUBJECT', 'subjectId must be a positive integer.');
  }
  const subject = await db().subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    throw err(400, 'INVALID_SUBJECT', `Subject ${subjectId} does not exist.`);
  }
  if (subject.schoolId !== schoolId) {
    throw err(403, 'CROSS_SCHOOL_DENIED', `Subject ${subjectId} belongs to another school.`);
  }
  if (!subject.isActive) {
    throw err(400, 'SUBJECT_INACTIVE', `Subject ${subject.code} is archived and cannot become a current-year requirement. Reactivate it in the catalog first.`);
  }
}

async function assertRequirementScope(
  schoolId: number,
  schoolYearId: number,
  sectionMirrorId: number | null | undefined,
  cohortId: number | null | undefined,
): Promise<{ sectionMirrorId: number | null; cohortId: number | null }> {
  const section = sectionMirrorId ?? null;
  const cohort = cohortId ?? null;
  if (section !== null && (!Number.isInteger(section) || section <= 0)) {
    throw err(400, 'INVALID_SECTION_SCOPE', 'sectionMirrorId must be a positive integer.');
  }
  if (cohort !== null && (!Number.isInteger(cohort) || cohort <= 0)) {
    throw err(400, 'INVALID_COHORT_SCOPE', 'cohortId must be a positive integer.');
  }
  if (section !== null && cohort !== null) {
    throw err(400, 'INVALID_SCOPE', 'A requirement cannot override both a section and a cohort. Choose one scope.');
  }
  if (section !== null) {
    // Section identity is EnrollPro-mirrored; ATLAS only checks same-school/year membership.
    const mirror = await db().sectionMirror.findUnique({ where: { id: section } });
    if (!mirror || mirror.schoolId !== schoolId || mirror.schoolYearId !== schoolYearId) {
      throw err(400, 'INVALID_SECTION_SCOPE', 'Section override must reference a section of this school and school year.');
    }
  }
  if (cohort !== null) {
    const row = await db().instructionalCohort.findUnique({ where: { id: cohort } });
    if (!row || row.schoolId !== schoolId || row.schoolYearId !== schoolYearId) {
      throw err(400, 'INVALID_COHORT_SCOPE', 'Cohort override must reference a cohort of this school and school year.');
    }
  }
  return { sectionMirrorId: section, cohortId: cohort };
}

/** Narrow single-row patch: metadata fields only, never scope identity. */
export interface RequirementPatch {
  classification?: OfferingClassification;
  weeklyMinutes?: number;
  termMode?: TermMode;
  rotationFamily?: string | null;
  rotationOrder?: number | null;
  termIdentities?: string[];
}

const VALID_CLASSIFICATIONS = new Set(['CORE', 'SPECIALIZATION', 'EXPLORATORY', 'OTHER']);
const VALID_TERM_MODES = new Set(['ALL', 'ROTATING_FAMILY_MEMBER', 'EMPTY']);

/**
 * SCA-02.1: versioned single-row create. Operator provenance is recorded as
 * createdBy/updatedBy actor id. Never derives policy from subject codes and
 * never contacts EnrollPro offering endpoints.
 *
 * SCA-02R2: canonical duplicate discovery and insertion execute inside ONE
 * Serializable transaction. Concurrent identical creates therefore produce
 * exactly one active row: the loser either observes the winner's row inside
 * its own transaction (typed 409 REQUIREMENT_EXISTS) or loses the
 * serialization race (Prisma P2034 / SQLSTATE 40001), which is mapped to the
 * same typed 409 after a bounded existence re-read. Spurious serialization
 * conflicts with no persisted duplicate retry a bounded number of times;
 * every retry re-runs discovery inside its own transaction, so no retry can
 * create duplicate offerings or duplicate term assignments. Term assignments
 * are created in the same transaction as the offering row (atomic).
 */
export async function createRequirement(
  schoolId: number,
  schoolYearId: number,
  input: OfferingInput,
  actorId: number | null,
): Promise<OfferingData> {
  await assertSchoolYearAuthority(schoolId, schoolYearId);
  assertKnownFields(input, KNOWN_OFFERING_FIELDS, 'offering');
  const termConfig = await getTermConfig(schoolId, schoolYearId);
  if (!termConfig) {
    throw err(400, 'TERM_CONFIG_MISSING', 'Term configuration must exist before adding required subjects.');
  }
  const errors = validateOfferingInput(input, termConfig);
  if (errors.length > 0) {
    throw err(400, 'INVALID_OFFERING', errors.join(' '));
  }
  if (input.subjectId !== null) {
    await assertRequirementSubject(schoolId, input.subjectId);
  }
  const scope = await assertRequirementScope(schoolId, schoolYearId, input.sectionMirrorId, input.cohortId);

  // SCA-02R: duplicate detection on the canonical identity — a section or
  // cohort override never collides with the base scope or each other.
  // The identity key is pure computation; the EXISTENCE read itself must
  // happen inside the Serializable transaction below (see createInTx).
  const identityKey = requirementIdentityKey(requirementIdentityOf({
    subjectId: input.subjectId,
    gradeLevel: input.gradeLevel,
    programType: input.programType,
    sectionMirrorId: scope.sectionMirrorId,
    cohortId: scope.cohortId,
    rotationFamily: input.rotationFamily ?? null,
  }));
  const discoveryWhere = {
    schoolId,
    schoolYearId,
    isActive: true,
    subjectId: input.subjectId,
    gradeLevel: input.gradeLevel,
    programType: input.programType,
  };
  const discoverySelect = {
    subjectId: true, gradeLevel: true, programType: true,
    sectionMirrorId: true, cohortId: true, rotationFamily: true,
  };
  const isDuplicateRow = (row: {
    subjectId: number | null; gradeLevel: number; programType: string;
    sectionMirrorId: number | null; cohortId: number | null; rotationFamily: string | null;
  }): boolean =>
    requirementIdentityKey(requirementIdentityOf({
      subjectId: row.subjectId,
      gradeLevel: row.gradeLevel,
      programType: row.programType,
      sectionMirrorId: row.sectionMirrorId,
      cohortId: row.cohortId,
      rotationFamily: row.rotationFamily,
    })) === identityKey;

  // SCA-02R2: bounded attempts. Attempt 1 handles the uncontended path and
  // the genuine-duplicate race. A retry happens ONLY for a serialization
  // conflict with no persisted duplicate (spurious SSI abort against a
  // genuinely different identity); it re-runs discovery inside a fresh
  // transaction and therefore cannot duplicate anything.
  const MAX_CREATE_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
    try {
      const createdId = await db().$transaction(async (tx) => {
        const scopePeers = await tx.schoolYearOffering.findMany({
          where: discoveryWhere,
          select: discoverySelect,
        });
        if (scopePeers.some(isDuplicateRow)) {
          throw err(409, 'REQUIREMENT_EXISTS', 'An active requirement already covers this exact scope. Edit or retire it instead of creating a duplicate.');
        }
        const row = await tx.schoolYearOffering.create({
          data: {
            schoolId,
            schoolYearId,
            termConfigId: termConfig.id,
            subjectId: input.subjectId,
            gradeLevel: input.gradeLevel,
            programType: input.programType,
            sectionMirrorId: scope.sectionMirrorId,
            cohortId: scope.cohortId,
            classification: input.classification,
            weeklyMinutes: input.weeklyMinutes,
            rotationFamily: input.rotationFamily ?? null,
            rotationOrder: input.rotationOrder ?? null,
            termMode: input.termMode,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        for (const termIdentity of input.termIdentities) {
          await tx.offeringTermAssignment.create({ data: { offeringId: row.id, termIdentity } });
        }
        return row.id;
      }, { isolationLevel: 'Serializable' });

      const rows = await listOfferings(schoolId, schoolYearId);
      const full = rows.find((r) => r.id === createdId);
      if (!full) throw err(500, 'REQUIREMENT_NOT_FOUND', 'Requirement was created but could not be read back.');
      return full;
    } catch (error) {
      if (!isSerializationConflict(error)) throw error;
      // The transaction rolled back fully: no partial offering row and no
      // partial term assignments exist from this attempt. Re-read once (no
      // write) to distinguish a genuine duplicate race from a spurious abort.
      const current = await db().schoolYearOffering.findMany({
        where: discoveryWhere,
        select: discoverySelect,
      });
      if (current.some(isDuplicateRow)) {
        throw err(409, 'REQUIREMENT_EXISTS', 'An active requirement already covers this exact scope. Edit or retire it instead of creating a duplicate.');
      }
      if (attempt === MAX_CREATE_ATTEMPTS) throw error;
      // Spurious conflict, bounded retry with fresh discovery inside the
      // next transaction. No silent duplicates possible (see above).
    }
  }
  // Unreachable: the loop returns or throws on every path.
  throw err(500, 'REQUIREMENT_NOT_FOUND', 'Requirement creation did not complete.');
}

/**
 * SCA-02R2: true only for transaction serialization failures (Prisma P2034
 * or SQLSTATE 40001). Typed API errors (which carry statusCode) are never
 * serialization conflicts — a 409 thrown for a genuine duplicate inside the
 * transaction must propagate unchanged, never enter the retry path.
 */
function isSerializationConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  if (typeof record.statusCode === 'number') return false;
  const code = record.code;
  if (code === 'P2034' || code === '40001') return true;
  const message = (record.message as string | undefined) ?? '';
  return /could not serialize/i.test(message) && !('statusCode' in record);
}

/**
 * SCA-02.1: versioned single-row update. The scope identity
 * (subject/grade/program/section/cohort) is immutable; only requirement
 * metadata changes. Stale versions reject with STALE_WRITE before any write.
 */
export async function updateRequirementAtomic(
  id: number,
  schoolId: number,
  expectedVersion: number | undefined,
  patch: RequirementPatch,
  actorId: number | null,
): Promise<OfferingData> {
  if (expectedVersion === undefined || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw err(400, 'VERSION_REQUIRED', 'expectedVersion is required and must be a positive integer.');
  }
  if (!Number.isInteger(id) || id <= 0) {
    throw err(400, 'INVALID_PARAM', 'id must be a positive integer.');
  }
  const current = await db().schoolYearOffering.findUnique({
    where: { id },
    include: { termAssignments: { select: { termIdentity: true } } },
  });
  if (!current || current.schoolId !== schoolId) {
    throw err(404, 'REQUIREMENT_NOT_FOUND', 'Requirement does not exist in this school.');
  }
  await assertSchoolYearAuthority(schoolId, current.schoolYearId);
  if (!current.isActive) {
    throw err(409, 'REQUIREMENT_RETIRED', 'Requirement is retired. Create a new requirement instead.');
  }
  if (current.version !== expectedVersion) {
    throw err(409, 'STALE_WRITE', `Requirement ${id} has been modified. Expected version ${expectedVersion}, found ${current.version}. Refresh and retry.`);
  }

  if (patch.classification !== undefined && !VALID_CLASSIFICATIONS.has(patch.classification)) {
    throw err(400, 'INVALID_CLASSIFICATION', 'classification must be CORE, SPECIALIZATION, EXPLORATORY, or OTHER.');
  }
  if (patch.termMode !== undefined && !VALID_TERM_MODES.has(patch.termMode)) {
    throw err(400, 'INVALID_TERM_MODE', 'termMode must be ALL, ROTATING_FAMILY_MEMBER, or EMPTY.');
  }
  if (patch.weeklyMinutes !== undefined && (!Number.isInteger(patch.weeklyMinutes) || patch.weeklyMinutes < 0)) {
    throw err(400, 'INVALID_MINUTES', 'weeklyMinutes must be a non-negative integer.');
  }
  assertKnownFields(patch, KNOWN_REQUIREMENT_PATCH_FIELDS, 'requirement patch');

  const merged: OfferingInput = {
    subjectId: current.subjectId,
    gradeLevel: current.gradeLevel,
    programType: current.programType,
    sectionMirrorId: current.sectionMirrorId,
    cohortId: current.cohortId,
    classification: patch.classification ?? current.classification,
    weeklyMinutes: patch.weeklyMinutes ?? current.weeklyMinutes,
    rotationFamily: patch.rotationFamily !== undefined ? patch.rotationFamily : current.rotationFamily,
    rotationOrder: patch.rotationOrder !== undefined ? patch.rotationOrder : current.rotationOrder,
    termMode: patch.termMode ?? current.termMode,
    termIdentities: patch.termIdentities ?? current.termAssignments.map((t) => t.termIdentity),
  };

  const termConfig = await getTermConfig(schoolId, current.schoolYearId);
  if (!termConfig) {
    throw err(400, 'TERM_CONFIG_MISSING', 'Term configuration must exist before editing required subjects.');
  }
  // EMPTY rows are scope markers: they cannot gain a subject through patch.
  if (current.subjectId === null && merged.termMode !== 'EMPTY') {
    throw err(400, 'INVALID_OFFERING', 'An explicit-empty scope cannot change term mode without a subject. Retire it and create a subject requirement instead.');
  }
  const errors = validateOfferingInput(merged, termConfig);
  if (errors.length > 0) {
    throw err(400, 'INVALID_OFFERING', errors.join(' '));
  }

  await db().$transaction(async (tx) => {
    const guarded = await tx.schoolYearOffering.updateMany({
      where: { id, version: expectedVersion },
      data: {
        classification: merged.classification,
        weeklyMinutes: merged.weeklyMinutes,
        termMode: merged.termMode,
        rotationFamily: merged.rotationFamily,
        rotationOrder: merged.rotationOrder,
        updatedBy: actorId,
        version: { increment: 1 },
      },
    });
    if (guarded.count !== 1) {
      throw err(409, 'STALE_WRITE', `Requirement ${id} changed during the update. Refresh and retry.`);
    }
    await tx.offeringTermAssignment.deleteMany({ where: { offeringId: id } });
    for (const termIdentity of merged.termIdentities) {
      await tx.offeringTermAssignment.create({ data: { offeringId: id, termIdentity } });
    }
  });

  const rows = await listOfferings(schoolId, current.schoolYearId);
  const full = rows.find((r) => r.id === id);
  if (!full) throw err(500, 'REQUIREMENT_NOT_FOUND', 'Requirement was updated but could not be read back.');
  return full;
}

/**
 * SCA-02.1: versioned single-row retire (soft; a replacement is a new row).
 * Keeps the row for audit; clears term assignments like the batch path.
 */
export async function retireRequirementAtomic(
  id: number,
  schoolId: number,
  expectedVersion: number | undefined,
  actorId: number | null,
): Promise<OfferingData> {
  if (expectedVersion === undefined || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw err(400, 'VERSION_REQUIRED', 'expectedVersion is required and must be a positive integer.');
  }
  if (!Number.isInteger(id) || id <= 0) {
    throw err(400, 'INVALID_PARAM', 'id must be a positive integer.');
  }
  const current = await db().schoolYearOffering.findUnique({ where: { id } });
  if (!current || current.schoolId !== schoolId) {
    throw err(404, 'REQUIREMENT_NOT_FOUND', 'Requirement does not exist in this school.');
  }
  await assertSchoolYearAuthority(schoolId, current.schoolYearId);
  if (!current.isActive) {
    throw err(409, 'REQUIREMENT_RETIRED', 'Requirement is already retired.');
  }
  if (current.version !== expectedVersion) {
    throw err(409, 'STALE_WRITE', `Requirement ${id} has been modified. Expected version ${expectedVersion}, found ${current.version}. Refresh and retry.`);
  }

  await db().$transaction(async (tx) => {
    const guarded = await tx.schoolYearOffering.updateMany({
      where: { id, version: expectedVersion },
      data: {
        isActive: false,
        retiredAt: new Date(),
        retiredBy: actorId,
        updatedBy: actorId,
        version: { increment: 1 },
      },
    });
    if (guarded.count !== 1) {
      throw err(409, 'STALE_WRITE', `Requirement ${id} changed during the retire. Refresh and retry.`);
    }
    await tx.offeringTermAssignment.deleteMany({ where: { offeringId: id } });
  });

  const rows = await listOfferings(schoolId, current.schoolYearId);
  const full = rows.find((r) => r.id === id);
  if (!full) throw err(500, 'REQUIREMENT_NOT_FOUND', 'Requirement was retired but could not be read back.');
  return full;
}

export interface CurriculumBatchApplyParams {
  schoolId: number;
  schoolYearId: number;
  proposedOfferings: OfferingInput[];
  actorId: number | null;
  expectedFingerprint: string;
  expectedSourceVersions: Record<string, number>;
  /**
   * SCA-02R: term-config revision observed by the preview (ISO updatedAt).
   * Reread and revalidated inside the Serializable transaction.
   */
  expectedTermConfigUpdatedAt: string;
}

/**
 * SCA-02.1/02R: canonical-hash batch apply for Curriculum Requirements.
 * Serializable and idempotent: re-applying identical content against
 * unchanged sources succeeds with the same fingerprint. A fingerprint
 * mismatch, any source-version drift, or a concurrent term-config edit
 * rejects with zero partial writes.
 */
export async function applyCurriculumBatch(
  params: CurriculumBatchApplyParams,
): Promise<{ applied: number; retired: number; fingerprint: string }> {
  const { schoolId, schoolYearId, proposedOfferings, actorId, expectedFingerprint, expectedSourceVersions, expectedTermConfigUpdatedAt } = params;
  if (!expectedFingerprint || typeof expectedFingerprint !== 'string') {
    throw err(400, 'FINGERPRINT_REQUIRED', 'expectedFingerprint from the batch preview is required.');
  }
  if (!expectedSourceVersions || typeof expectedSourceVersions !== 'object') {
    throw err(400, 'VERSION_REQUIRED', 'expectedSourceVersions from the batch preview is required.');
  }
  if (!expectedTermConfigUpdatedAt || typeof expectedTermConfigUpdatedAt !== 'string' || Number.isNaN(Date.parse(expectedTermConfigUpdatedAt))) {
    throw err(400, 'VERSION_REQUIRED', 'expectedTermConfigUpdatedAt from the batch preview is required and must be an ISO timestamp.');
  }
  await assertSchoolYearAuthority(schoolId, schoolYearId);

  const termConfig = await getTermConfig(schoolId, schoolYearId);
  if (!termConfig) {
    throw err(400, 'TERM_CONFIG_MISSING', 'Term configuration must exist before applying requirements.');
  }
  if (termConfig.updatedAt.toISOString() !== new Date(expectedTermConfigUpdatedAt).toISOString()) {
    throw err(409, 'STALE_WRITE', 'Term configuration changed after the preview was generated. Refresh the preview and review again.');
  }
  for (const input of proposedOfferings) {
    assertKnownFields(input, KNOWN_OFFERING_FIELDS, 'offering');
    const errors = validateOfferingInput(input, termConfig);
    if (errors.length > 0) {
      throw err(400, 'INVALID_OFFERING', `Offering subjectId=${input.subjectId} grade=${input.gradeLevel}: ${errors.join(' ')}`);
    }
    if (input.subjectId !== null) {
      await assertRequirementSubject(schoolId, input.subjectId);
    }
    await assertRequirementScope(schoolId, schoolYearId, input.sectionMirrorId, input.cohortId);
  }
  assertNoProposedConflicts(proposedOfferings);

  const contentFingerprint = computeRequirementFingerprint(proposedOfferings);
  if (contentFingerprint !== expectedFingerprint) {
    throw err(409, 'FINGERPRINT_MISMATCH', 'The proposed requirements differ from the previewed set. Refresh the preview and review again.');
  }

  const result = await db().$transaction(
    async (tx) => {
      // SCA-02R: reread the term-config revision inside the transaction —
      // a concurrent term edit between preview and apply rejects here.
      const liveConfig = await tx.schoolYearTermConfig.findUnique({
        where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
      });
      if (!liveConfig || liveConfig.updatedAt.toISOString() !== new Date(expectedTermConfigUpdatedAt).toISOString()) {
        throw err(409, 'STALE_WRITE', 'Term configuration changed after the preview was generated. Refresh the preview and review again.');
      }
      const currentActive = await tx.schoolYearOffering.findMany({
        where: { schoolId, schoolYearId, isActive: true },
      });
      const drifted: number[] = [];
      for (const row of currentActive) {
        if (expectedSourceVersions[String(row.id)] !== row.version) drifted.push(row.id);
      }
      for (const key of Object.keys(expectedSourceVersions)) {
        if (!currentActive.some((r) => String(r.id) === key)) drifted.push(Number(key));
      }
      if (drifted.length > 0) {
        throw err(409, 'STALE_WRITE', 'Requirements changed after the preview was generated. Refresh the preview and review again.');
      }
      return applyProposedInTx(tx as unknown as TxClient, {
        schoolId,
        schoolYearId,
        termConfigId: termConfig.id,
        proposedOfferings,
        actorId,
      });
    },
    { isolationLevel: 'Serializable' },
  );

  return { ...result, fingerprint: contentFingerprint };
}

export interface RequirementSuggestion {
  subjectId: number;
  subjectCode: string;
  gradeLevel: number;
  programType: ProgramType;
  weeklyMinutes: number;
  termMode: TermMode;
}

/**
 * SCA-02.3: migration-assistance suggestions derived from catalog
 * compatibility. Returned ONLY as unapproved suggestions with provenance —
 * the caller must persist them through preview/apply. Never writes.
 */
export async function suggestRequirementsFromCatalog(
  schoolId: number,
  schoolYearId: number,
): Promise<{ suggestions: RequirementSuggestion[]; provenance: string; approved: boolean }> {
  await assertSchoolYearAuthority(schoolId, schoolYearId);
  const catalog = await db().subject.findMany({
    where: { schoolId, isActive: true },
    orderBy: { code: 'asc' },
  });
  const suggestions: RequirementSuggestion[] = [];
  for (const subject of catalog) {
    const grades = subject.gradeLevels.length > 0 ? subject.gradeLevels : [];
    const programs = subject.programScopes.length > 0 ? subject.programScopes : ['REGULAR'];
    for (const gradeLevel of grades) {
      for (const programType of programs) {
        suggestions.push({
          subjectId: subject.id,
          subjectCode: subject.code,
          gradeLevel,
          programType: programType as ProgramType,
          weeklyMinutes: subject.minMinutesPerWeek,
          termMode: 'ALL',
        });
      }
    }
  }
  return {
    suggestions,
    provenance: 'catalog-compatibility-unapproved',
    approved: false,
  };
}
