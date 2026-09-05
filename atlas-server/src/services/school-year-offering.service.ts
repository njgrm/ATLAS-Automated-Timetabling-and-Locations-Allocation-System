/**
 * School-year offering service — CRUD, preview/apply, and readiness
 * for persisted offering truth per (schoolId, schoolYearId).
 *
 * Business logic only; no transport concerns.
 * Preview paths perform zero writes. Apply paths are version-guarded.
 */

import { getDataContext } from '../lib/data-context.js';
import { type OfferingClassification, type TermMode, type ProgramType } from '@prisma/client';
import { getTermConfig, type TermConfigData } from './term-config.service.js';

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

// ─── Validation ───

const VALID_GRADE_LEVELS = new Set([7, 8, 9, 10]);
const VALID_PROGRAM_TYPES = new Set(['REGULAR', 'STE', 'SPA', 'SPS', 'OTHER']);

export function validateOfferingInput(input: OfferingInput, termConfig: TermConfigData): string[] {
  const errors: string[] = [];

  if (input.termMode === 'EMPTY') {
    if (input.subjectId !== null) {
      errors.push('EMPTY scope offering must have null subjectId.');
    }
    if (input.weeklyMinutes !== 0) {
      errors.push('EMPTY scope offering must have 0 weeklyMinutes.');
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
    if (!input.rotationFamily || input.rotationFamily.trim().length === 0) {
      errors.push('ROTATING_FAMILY_MEMBER must have a rotationFamily.');
    }
    if (!Number.isInteger(input.rotationOrder) || input.rotationOrder! < 1 || input.rotationOrder! > termConfig.termCount) {
      errors.push(`rotationOrder must be between 1 and ${termConfig.termCount}.`);
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
    if (input.termIdentities.length !== termConfig.termCount) {
      errors.push(`ALL mode offering must assign exactly ${termConfig.termCount} terms.`);
    }
  }

  // Validate term identities belong to the config
  const invalidTerms = input.termIdentities.filter((t) => !termConfig.termIdentities.includes(t));
  if (invalidTerms.length > 0) {
    errors.push(`Term identities not in config: ${invalidTerms.join(', ')}.`);
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
  const termConfig = await getTermConfig(schoolId, schoolYearId);
  if (!termConfig) {
    return {
      offerings: proposedOfferings,
      totalCount: proposedOfferings.length,
      newCount: proposedOfferings.length,
      unchangedCount: 0,
      retiredCount: 0,
      termConfigValid: false,
      fingerprint: computeFingerprint(proposedOfferings),
    };
  }

  const existing = await listOfferings(schoolId, schoolYearId);
  const existingActive = existing.filter((o) => o.isActive);

  let newCount = 0;
  let unchangedCount = 0;
  let retiredCount = 0;

  for (const proposed of proposedOfferings) {
    const match = existingActive.find(
      (e) =>
        e.subjectId === proposed.subjectId &&
        e.gradeLevel === proposed.gradeLevel &&
        e.programType === proposed.programType &&
        e.classification === proposed.classification &&
        e.weeklyMinutes === proposed.weeklyMinutes &&
        e.termMode === proposed.termMode,
    );
    if (match) {
      unchangedCount++;
    } else {
      newCount++;
    }
  }

  // Count offerings that would be retired (exist active but not in proposed)
  for (const existingOffering of existingActive) {
    const match = proposedOfferings.find(
      (p) =>
        p.subjectId === existingOffering.subjectId &&
        p.gradeLevel === existingOffering.gradeLevel &&
        p.programType === existingOffering.programType,
    );
    if (!match) {
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
    fingerprint: computeFingerprint(proposedOfferings),
  };
}

// ─── Apply (version-guarded) ───

export async function applyOfferings(
  schoolId: number,
  schoolYearId: number,
  proposedOfferings: OfferingInput[],
  actorId: number,
): Promise<{ applied: number; retired: number }> {
  const termConfig = await getTermConfig(schoolId, schoolYearId);
  if (!termConfig) {
    throw err(400, 'TERM_CONFIG_MISSING', 'Term configuration must exist before applying offerings.');
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
    // Get current active offerings
    const currentActive = await tx.schoolYearOffering.findMany({
      where: { schoolId, schoolYearId, isActive: true },
    });

    let applied = 0;
    let retired = 0;

    // Retire offerings not in proposed set
    for (const current of currentActive) {
      const stillNeeded = proposedOfferings.some(
        (p) =>
          p.subjectId === current.subjectId &&
          p.gradeLevel === current.gradeLevel &&
          p.programType === current.programType,
      );
      if (!stillNeeded) {
        await tx.schoolYearOffering.update({
          where: { id: current.id },
          data: {
            isActive: false,
            retiredAt: new Date(),
            retiredBy: actorId,
            updatedBy: actorId,
            version: { increment: 1 },
          },
        });
        // Remove term assignments
        await tx.offeringTermAssignment.deleteMany({ where: { offeringId: current.id } });
        retired++;
      }
    }

    // Upsert proposed offerings
    for (const input of proposedOfferings) {
      const existing = currentActive.find(
        (e) =>
          e.subjectId === input.subjectId &&
          e.gradeLevel === input.gradeLevel &&
          e.programType === input.programType,
      );

      if (existing) {
        // Update if changed
        const needsUpdate =
          existing.classification !== input.classification ||
          existing.weeklyMinutes !== input.weeklyMinutes ||
          existing.termMode !== input.termMode ||
          existing.rotationFamily !== input.rotationFamily ||
          existing.rotationOrder !== input.rotationOrder;

        if (needsUpdate) {
          await tx.schoolYearOffering.update({
            where: { id: existing.id },
            data: {
              classification: input.classification,
              weeklyMinutes: input.weeklyMinutes,
              termMode: input.termMode,
              rotationFamily: input.rotationFamily ?? null,
              rotationOrder: input.rotationOrder ?? null,
              updatedBy: actorId,
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
            schoolId,
            schoolYearId,
            termConfigId: termConfig.id,
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
            createdBy: actorId,
            updatedBy: actorId,
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
  });

  return result;
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

// ─── Fingerprint (deterministic, content-based) ───

function computeFingerprint(offerings: OfferingInput[]): string {
  const canonical = JSON.stringify(
    offerings
      .map((o) => ({
        subjectId: o.subjectId,
        gradeLevel: o.gradeLevel,
        programType: o.programType,
        classification: o.classification,
        weeklyMinutes: o.weeklyMinutes,
        termMode: o.termMode,
        rotationFamily: o.rotationFamily ?? null,
        rotationOrder: o.rotationOrder ?? null,
        termIdentities: [...o.termIdentities].sort(),
      }))
      .sort((a, b) => (a.subjectId ?? 0) - (b.subjectId ?? 0) || a.gradeLevel - b.gradeLevel),
  );

  // Simple hash (for preview identification, not cryptographic security)
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `OFFERING_PREVIEW_${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}
