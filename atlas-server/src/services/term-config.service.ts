/**
 * School-year term configuration service — CRUD and validation for
 * persisted term identities per (schoolId, schoolYearId).
 *
 * Business logic only; no transport concerns.
 */

import { getDataContext } from '../lib/data-context.js';

const db = () => getDataContext();

// ─── Types ───

export interface TermConfigData {
  id: number;
  schoolId: number;
  schoolYearId: number;
  termCount: number;
  termIdentities: string[];
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TermConfigInput {
  termCount: number;
  termIdentities: string[];
  isActive?: boolean;
}

// ─── Errors ───

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
  const e = new Error(message) as Error & { statusCode: number; code: string };
  e.statusCode = statusCode;
  e.code = code;
  return e;
}

// ─── Validation ───

export function validateTermConfigInput(input: TermConfigInput): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(input.termCount) || input.termCount < 1 || input.termCount > 12) {
    errors.push('termCount must be an integer between 1 and 12.');
  }

  if (!Array.isArray(input.termIdentities)) {
    errors.push('termIdentities must be an array of strings.');
  } else {
    if (input.termIdentities.length !== input.termCount) {
      errors.push(`termIdentities length (${input.termIdentities.length}) must equal termCount (${input.termCount}).`);
    }
    const nonStrings = input.termIdentities.filter((id) => typeof id !== 'string' || id.trim().length === 0);
    if (nonStrings.length > 0) {
      errors.push('All term identities must be non-empty strings.');
    }
    const unique = new Set(input.termIdentities);
    if (unique.size !== input.termIdentities.length) {
      errors.push('Term identities must be unique.');
    }
  }

  return errors;
}

// ─── Read ───

export async function getTermConfig(schoolId: number, schoolYearId: number): Promise<TermConfigData | null> {
  const row = await db().schoolYearTermConfig.findUnique({
    where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
  });
  if (!row) return null;
  return {
    id: row.id,
    schoolId: row.schoolId,
    schoolYearId: row.schoolYearId,
    termCount: row.termCount,
    termIdentities: row.termIdentities as string[],
    isActive: row.isActive,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Create/Update ───

export async function upsertTermConfig(
  schoolId: number,
  schoolYearId: number,
  input: TermConfigInput,
  actorId?: number,
): Promise<TermConfigData> {
  const errors = validateTermConfigInput(input);
  if (errors.length > 0) {
    throw err(400, 'INVALID_TERM_CONFIG', errors.join(' '));
  }

  const existing = await db().schoolYearTermConfig.findUnique({
    where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
  });

  if (existing) {
    const updated = await db().schoolYearTermConfig.update({
      where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
      data: {
        termCount: input.termCount,
        termIdentities: input.termIdentities,
        isActive: input.isActive ?? existing.isActive,
        updatedBy: actorId ?? existing.updatedBy,
      },
    });
    return {
      id: updated.id,
      schoolId: updated.schoolId,
      schoolYearId: updated.schoolYearId,
      termCount: updated.termCount,
      termIdentities: updated.termIdentities as string[],
      isActive: updated.isActive,
      createdBy: updated.createdBy,
      updatedBy: updated.updatedBy,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  const created = await db().schoolYearTermConfig.create({
    data: {
      schoolId,
      schoolYearId,
      termCount: input.termCount,
      termIdentities: input.termIdentities,
      isActive: input.isActive ?? true,
      createdBy: actorId ?? null,
      updatedBy: actorId ?? null,
    },
  });

  return {
    id: created.id,
    schoolId: created.schoolId,
    schoolYearId: created.schoolYearId,
    termCount: created.termCount,
    termIdentities: created.termIdentities as string[],
    isActive: created.isActive,
    createdBy: created.createdBy,
    updatedBy: created.updatedBy,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

// ─── Validation helpers ───

export function validateTermIdentity(termIdentity: string, termConfig: TermConfigData): boolean {
  return termConfig.termIdentities.includes(termIdentity);
}

export function validateAllTermIdentities(termIdentities: string[], termConfig: TermConfigData): { valid: boolean; invalid: string[] } {
  const invalid = termIdentities.filter((id) => !termConfig.termIdentities.includes(id));
  return { valid: invalid.length === 0, invalid };
}
