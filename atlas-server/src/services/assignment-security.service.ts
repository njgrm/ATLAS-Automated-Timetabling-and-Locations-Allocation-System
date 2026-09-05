/**
 * Assignment security, concurrency, and source ownership primitives.
 *
 * Provides:
 * - School scope derivation from authenticated actor
 * - Optimistic version guard
 * - Preview fingerprint computation and validation
 * - Serializable transaction apply helper
 * - Audit principal contract
 * - Mutation authorization gate
 *
 * All Teaching Load mutations must use these primitives.
 */

import { getDataContext } from '../lib/data-context.js';
import { Prisma } from '@prisma/client';

const db = () => getDataContext();

// ─── Types ───

export interface AuthenticatedActor {
  id: number;
  schoolId: number;
  role: 'SCHEDULER_OFFICER' | 'IT_ADMIN' | 'FACULTY' | 'PUBLIC';
}

export interface SchoolScope {
  schoolId: number;
  schoolYearId: number;
}

export interface VersionGuard {
  entityId: number;
  entityType: string;
  expectedVersion: number;
  currentVersion: number;
}

export interface PreviewFingerprint {
  hash: string;
  createdAt: string;
  scopeKey: string;
  entityVersions: Record<string, number>;
}

export interface MutationAuditEntry {
  actorId: number;
  schoolId: number;
  schoolYearId: number;
  action: string;
  targetIds: number[];
  metadata: Record<string, unknown>;
  timestamp: string;
}

// ─── Errors ───

export function authError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
  const e = new Error(message) as Error & { statusCode: number; code: string };
  e.statusCode = statusCode;
  e.code = code;
  return e;
}

// ─── School Scope Derivation ───

/**
 * Derive school scope from the authenticated actor.
 * Never trust body/query schoolId for authorization.
 */
export function deriveSchoolScope(actor: AuthenticatedActor, requestedSchoolId?: number): SchoolScope {
  if (requestedSchoolId !== undefined && requestedSchoolId !== actor.schoolId) {
    throw authError(403, 'CROSS_SCHOOL_DENIED', 'Cannot mutate resources belonging to another school.');
  }
  return { schoolId: actor.schoolId, schoolYearId: 0 }; // schoolYearId set by caller
}

/**
 * Validate that the actor's school matches the entity's school.
 */
export function validateSchoolOwnership(actorSchoolId: number, entitySchoolId: number, entityType: string): void {
  if (actorSchoolId !== entitySchoolId) {
    throw authError(403, 'CROSS_SCHOOL_DENIED', `Cannot mutate ${entityType} belonging to another school.`);
  }
}

// ─── Role Authorization ───

const PRIVILEGED_ROLES = new Set(['SCHEDULER_OFFICER', 'IT_ADMIN']);

export function requirePrivilegedRole(actor: AuthenticatedActor): void {
  if (!PRIVILEGED_ROLES.has(actor.role)) {
    throw authError(403, 'INSUFFICIENT_ROLE', 'Requires scheduler officer or IT admin role.');
  }
}

export function requireSchedulerOrAdmin(actor: AuthenticatedActor): void {
  requirePrivilegedRole(actor);
}

// ─── Optimistic Version Guard ───

/**
 * Verify that the entity version matches the expected version.
 * Returns the current version for use in the update predicate.
 */
export function assertVersionGuard(
  currentVersion: number,
  expectedVersion: number | undefined,
  entityType: string,
  entityId: number,
): number {
  if (expectedVersion === undefined) {
    throw authError(400, 'VERSION_REQUIRED', `Optimistic version required for ${entityType} ${entityId}.`);
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw authError(400, 'VERSION_INVALID', `Version must be a positive integer for ${entityType} ${entityId}.`);
  }
  if (currentVersion !== expectedVersion) {
    throw authError(409, 'STALE_WRITE', `${entityType} ${entityId} has been modified. Expected version ${expectedVersion}, found ${currentVersion}. Refresh and retry.`);
  }
  return currentVersion;
}

/**
 * Bump version for an entity. Returns the new version.
 */
export function bumpVersion(currentVersion: number): number {
  return currentVersion + 1;
}

// ─── Preview Fingerprint ───

/**
 * Compute a deterministic fingerprint for a preview payload.
 * The hash is based on the content and entity versions, not timestamps.
 */
export function computePreviewFingerprint(
  scopeKey: string,
  entityVersions: Record<string, number>,
  contentHash: string,
): PreviewFingerprint {
  const versionString = Object.entries(entityVersions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');

  const hashInput = `${scopeKey}|${versionString}|${contentHash}`;
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  return {
    hash: `FP_${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`,
    createdAt: new Date().toISOString(),
    scopeKey,
    entityVersions,
  };
}

/**
 * Validate that a preview fingerprint matches the current entity versions.
 * Used during apply to detect stale plans.
 */
export function validatePreviewFingerprint(
  currentVersions: Record<string, number>,
  fingerprint: PreviewFingerprint,
): { valid: boolean; driftedKeys: string[] } {
  const driftedKeys: string[] = [];
  for (const [key, expectedVersion] of Object.entries(fingerprint.entityVersions)) {
    const current = currentVersions[key];
    if (current === undefined || current !== expectedVersion) {
      driftedKeys.push(key);
    }
  }
  return { valid: driftedKeys.length === 0, driftedKeys };
}

// ─── Audit Principal ───

/**
 * Create an audit entry for a mutation.
 */
export function createAuditEntry(
  actor: AuthenticatedActor,
  schoolYearId: number,
  action: string,
  targetIds: number[],
  metadata: Record<string, unknown> = {},
): MutationAuditEntry {
  return {
    actorId: actor.id,
    schoolId: actor.schoolId,
    schoolYearId,
    action,
    targetIds,
    metadata,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Write an audit log entry to the database.
 */
export async function writeAuditLog(
  actor: AuthenticatedActor,
  schoolYearId: number,
  action: string,
  targetIds: number[],
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const entry = createAuditEntry(actor, schoolYearId, action, targetIds, metadata);
  await db().auditLog.create({
    data: {
      schoolId: entry.schoolId,
      schoolYearId: entry.schoolYearId,
      action: entry.action,
      actorId: entry.actorId,
      targetIds: entry.targetIds,
      metadata: entry.metadata as Prisma.InputJsonValue,
    },
  });
}

// ─── Serializable Transaction Apply ───

/**
 * Execute a mutation inside a Serializable transaction with version guard.
 * The callback receives a transactional Prisma client and must perform all
 * reads and writes inside the transaction.
 */
export async function applyInSerializableTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db().$transaction(callback, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10_000,
    timeout: 30_000,
  });
}

// ─── Mutation Gate (preview-only default) ───

/**
 * Validate that a mutation request includes explicit apply confirmation.
 * If `previewOnly` is omitted or true, the mutation is read-only.
 */
export function requireExplicitApply(previewOnly: boolean | undefined, action: string): void {
  if (previewOnly !== false) {
    throw authError(
      400,
      'PREVIEW_ONLY',
      `${action} requires explicit previewOnly=false to apply. Omitted or true defaults to preview.`,
    );
  }
}
