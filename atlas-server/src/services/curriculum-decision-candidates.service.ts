/**
 * SCA-03E-R2 — dynamic decision-candidate reconstruction (read-only).
 *
 * Business logic only; no transport concerns. Reconstructs the decision
 * workspace candidate groups DYNAMICALLY from current ATLAS subjects, active
 * sections, annual ownership evidence, persisted term configuration, and
 * persisted current-year requirements. Never loads candidates from a
 * checked-in JSON file and never from a production constant.
 *
 * Authority model (SCA-03E-R.1): NO subject code, grade, program,
 * specialization count, classification, action, or term identity receives
 * any established/pre-resolved/approved/locked status from code. Every
 * reconstructed group is an UNAPPROVED_SUGGESTION with a null
 * classification and an explicit operator confirm-or-reject decision
 * pending. Prior operator choices may enter the workspace ONLY through an
 * operator action (restoring/importing a validated decision draft on the
 * client); this module encodes no operator decision. Ownership is
 * SUGGESTION_ONLY provenance everywhere: it is never approved, never
 * auto-applied, and never treated as curriculum authority. Performs zero
 * writes.
 *
 * SCA-03E-R2 source revision: every exported/restored draft is bound to a
 * `sourceRevisionHash` — a canonical SHA-256 over ALL semantic source values
 * that can change the candidate set or its meaning (subject metadata,
 * section identity/grade/program/state, ownership associations, term-config
 * contents, active persisted requirements and their term assignments, plus
 * school and school-year identity). Counts and timestamps stay diagnostic
 * only and never act as the equality or authorization gate. Reads are
 * batched/set-based; no per-row database loop.
 */

import { getDataContext } from '../lib/data-context.js';
import type { ProgramType } from '@prisma/client';
import { canonicalHash, sortByKey } from '../lib/canonical-json.js';
import { assertSchoolYearAuthority } from './school-year-authority.service.js';
import {
  buildExpectedScopes,
  expectedProgramForSection,
  requirementScopeKey,
} from './school-year-offering.service.js';
import { normalizeGradeLevelSync } from './class-program-slot.service.js';
import { getTermConfig } from './term-config.service.js';

const db = () => getDataContext();

const VALID_GRADES = new Set([7, 8, 9, 10]);

// ─── Result types (JSON-safe; no Date instances cross the boundary) ───

export interface CandidateSectionRef {
  mirrorId: number;
  externalId: number;
  name: string;
}

export interface CandidateOwnershipEvidence {
  evidenceStatus: 'SUGGESTION_ONLY';
  ownershipIds: number[];
  facultyIds: number[];
}

/** Every reconstructed group is unapproved; nothing is pre-resolved. */
export type CandidateDecisionStatus = 'UNAPPROVED_SUGGESTION';

export interface DecisionCandidateGroup {
  groupKey: string;
  gradeLevel: number;
  programType: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  weeklyMinutes: number;
  /** Catalog rotation family is an observation only, never rotation authority. */
  catalogRotationFamily: string | null;
  affectedScopeKeys: string[];
  affectedSections: CandidateSectionRef[];
  sectionCount: number;
  demandMinutesPerWeek: number;
  demandDerivation: string;
  currentOwnershipEvidence: CandidateOwnershipEvidence;
  decisionStatus: CandidateDecisionStatus;
  termMode: 'ALL';
  termModeStatus: 'UNAPPROVED_SUGGESTION';
  unresolvedFields: string[];
}

export interface DecisionCandidatesResult {
  schoolId: number;
  schoolYearId: number;
  generatedAt: string;
  authorizesNoMutation: true;
  provenanceNote: string;
  /** Canonical SHA-256 over every semantic source value (SCA-03E-R2). */
  sourceRevisionHash: string;
  termConfig: { id: number; termCount: number; termIdentities: string[]; updatedAt: string } | null;
  /** Diagnostic only — never the equality or authorization gate. */
  sourceRevisions: {
    activeSubjectCount: number;
    activeSectionCount: number;
    annualOwnershipCount: number;
    activeRequirementCount: number;
    subjectsUpdatedAtMax: string | null;
    ownershipsUpdatedAtMax: string | null;
  };
  groups: DecisionCandidateGroup[];
  counts: { total: number; unresolved: number };
}

/**
 * SCA-03E-R.1: reconstruct decision-candidate groups from live evidence.
 * Read-only: SELECT queries only, no transaction, no writes. No group is
 * pre-approved, locked, classified, or pre-resolved by any code constant.
 */
export async function getDecisionCandidates(
  schoolId: number,
  schoolYearId: number,
): Promise<DecisionCandidatesResult> {
  await assertSchoolYearAuthority(schoolId, schoolYearId);

  const [subjects, sections, ownerships, termConfig, activeRequirements, requirementTermAssignments] = await Promise.all([
    db().subject.findMany({
      where: { schoolId, isActive: true },
      select: {
        id: true, code: true, name: true, minMinutesPerWeek: true,
        rotationFamily: true, modularGroupId: true, modularOrder: true, termGroupId: true, termCount: true,
        gradeLevels: true, programScopes: true, isActive: true, updatedAt: true,
      },
      orderBy: { code: 'asc' },
    }),
    db().sectionMirror.findMany({
      where: { schoolId, schoolYearId, isActiveForScheduling: true, isStale: false },
      select: {
        id: true, externalId: true, name: true, gradeLevelId: true, gradeLevelName: true,
        programType: true, programCode: true, programName: true,
        isActiveForScheduling: true, isStale: true, version: true, updatedAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    db().subjectSectionOwnership.findMany({
      where: { schoolId, schoolYearId },
      select: {
        id: true, facultySubjectId: true, facultyId: true, subjectId: true, sectionId: true, updatedAt: true,
      },
      orderBy: { id: 'asc' },
    }),
    getTermConfig(schoolId, schoolYearId),
    db().schoolYearOffering.findMany({
      where: { schoolId, schoolYearId, isActive: true },
      select: {
        id: true, termConfigId: true, subjectId: true, gradeLevel: true, programType: true,
        sectionMirrorId: true, cohortId: true, classification: true, weeklyMinutes: true,
        rotationFamily: true, rotationOrder: true, termMode: true, isActive: true, version: true, updatedAt: true,
      },
      orderBy: { id: 'asc' },
    }),
    db().offeringTermAssignment.findMany({
      where: { offering: { schoolId, schoolYearId } },
      select: { offeringId: true, termIdentity: true },
      orderBy: [{ offeringId: 'asc' }, { termIdentity: 'asc' }],
    }),
  ]);

  // SCA-03E-R2 canonical semantic revision (batched, set-based; no per-row
  // loop). Arrays are stably ordered by identity so a semantically identical
  // reordered database result hashes identically. Counts/timestamps are NOT
  // in the hash domain: same-count changes must still invalidate a draft.
  const hashInput = {
    schoolId,
    schoolYearId,
    subjects: sortByKey(subjects, (s) => `${s.id}`).map((s) => ({
      id: s.id, code: s.code, name: s.name, minMinutesPerWeek: s.minMinutesPerWeek,
      rotationFamily: s.rotationFamily, modularGroupId: s.modularGroupId, modularOrder: s.modularOrder,
      termGroupId: s.termGroupId, termCount: s.termCount,
      // gradeLevels/programScopes are SETS — canonical order before hashing so a
      // semantically identical reordered result hashes identically.
      gradeLevels: [...s.gradeLevels].sort((a, b) => a - b),
      programScopes: [...s.programScopes].sort(),
      isActive: s.isActive, updatedAt: s.updatedAt,
    })),
    sections: sortByKey(sections, (s) => `${s.id}`).map((s) => ({
      id: s.id, externalId: s.externalId, name: s.name, gradeLevelId: s.gradeLevelId,
      gradeLevelName: s.gradeLevelName, programType: s.programType, programCode: s.programCode,
      programName: s.programName, isActiveForScheduling: s.isActiveForScheduling, isStale: s.isStale,
      version: s.version, updatedAt: s.updatedAt,
    })),
    ownerships: sortByKey(ownerships, (o) => `${o.id}`).map((o) => ({
      id: o.id, facultySubjectId: o.facultySubjectId, facultyId: o.facultyId,
      subjectId: o.subjectId, sectionId: o.sectionId, updatedAt: o.updatedAt,
    })),
    termConfig: termConfig
      ? {
        id: termConfig.id, termCount: termConfig.termCount,
        termIdentities: termConfig.termIdentities, isActive: termConfig.isActive,
        updatedAt: termConfig.updatedAt,
      }
      : null,
    requirements: sortByKey(activeRequirements, (r) => `${r.id}`).map((r) => ({
      id: r.id, termConfigId: r.termConfigId, subjectId: r.subjectId, gradeLevel: r.gradeLevel,
      programType: r.programType, sectionMirrorId: r.sectionMirrorId, cohortId: r.cohortId,
      classification: r.classification, weeklyMinutes: r.weeklyMinutes,
      rotationFamily: r.rotationFamily, rotationOrder: r.rotationOrder, termMode: r.termMode,
      isActive: r.isActive, version: r.version, updatedAt: r.updatedAt,
    })),
    requirementTermAssignments: sortByKey(requirementTermAssignments, (a) => `${a.offeringId}|${a.termIdentity}`)
      .map((a) => ({ offeringId: a.offeringId, termIdentity: a.termIdentity })),
  };
  const sourceRevisionHash = await canonicalHash(hashInput);

  // Bucket sections by normalized grade/program scope. Sections whose grade
  // does not normalize to 7-10 are excluded from candidacy (same gate as
  // buildExpectedScopes); they remain visible in sourceRevisions counts.
  interface ScopeBucket {
    gradeLevel: number;
    programType: string;
    scopeKey: string;
    sections: CandidateSectionRef[];
    externalIds: Set<number>;
  }
  const buckets = new Map<string, ScopeBucket>();
  for (const section of sections) {
    const gradeLevel = normalizeGradeLevelSync(section.gradeLevelId);
    if (!VALID_GRADES.has(gradeLevel)) continue;
    const programType = expectedProgramForSection(section.programType);
    const scopeKey = requirementScopeKey({
      gradeLevel, programType, sectionMirrorId: null, cohortId: null,
    });
    let bucket = buckets.get(scopeKey);
    if (!bucket) {
      bucket = { gradeLevel, programType, scopeKey, sections: [], externalIds: new Set() };
      buckets.set(scopeKey, bucket);
    }
    bucket.sections.push({ mirrorId: section.id, externalId: section.externalId, name: section.name });
    bucket.externalIds.add(section.externalId);
  }
  // Deterministic section order within every bucket.
  for (const bucket of buckets.values()) {
    bucket.sections.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Ownership index: subjectId -> sectionExternalId -> ownership rows.
  const ownershipBySubjectSection = new Map<number, Map<number, { id: number; facultyId: number }[]>>();
  for (const ownership of ownerships) {
    let bySection = ownershipBySubjectSection.get(ownership.subjectId);
    if (!bySection) {
      bySection = new Map();
      ownershipBySubjectSection.set(ownership.subjectId, bySection);
    }
    const list = bySection.get(ownership.sectionId);
    const entry = { id: ownership.id, facultyId: ownership.facultyId };
    if (list) list.push(entry);
    else bySection.set(ownership.sectionId, [entry]);
  }

  const groups: DecisionCandidateGroup[] = [];
  const orderedBuckets = [...buckets.values()].sort((a, b) => a.scopeKey.localeCompare(b.scopeKey));

  // Mechanical pass: every catalog-compatible subject × scope pair is a
  // suggestion. Compatibility mirrors suggestRequirementsFromCatalog
  // (gradeLevels × programScopes); ownership evidence attaches but never
  // gates candidacy and never classifies. No row is pre-resolved, locked,
  // classified, or approved by code.
  for (const bucket of orderedBuckets) {
    for (const subject of subjects) {
      if (!subject.gradeLevels.includes(bucket.gradeLevel)) continue;
      if (!subject.programScopes.includes(bucket.programType as ProgramType)) continue;
      const bySection = ownershipBySubjectSection.get(subject.id);
      const ownershipIds: number[] = [];
      const facultyIds = new Set<number>();
      if (bySection) {
        for (const externalId of bucket.externalIds) {
          for (const row of bySection.get(externalId) ?? []) {
            ownershipIds.push(row.id);
            facultyIds.add(row.facultyId);
          }
        }
      }
      ownershipIds.sort((a, b) => a - b);
      const sectionCount = bucket.sections.length;
      const demandMinutesPerWeek = subject.minMinutesPerWeek * sectionCount;
      groups.push({
        groupKey: `G${bucket.gradeLevel}:${bucket.programType}:${subject.code}`,
        gradeLevel: bucket.gradeLevel,
        programType: bucket.programType,
        subjectId: subject.id,
        subjectCode: subject.code,
        subjectName: subject.name,
        weeklyMinutes: subject.minMinutesPerWeek,
        catalogRotationFamily: subject.rotationFamily,
        affectedScopeKeys: [bucket.scopeKey],
        affectedSections: bucket.sections,
        sectionCount,
        demandMinutesPerWeek,
        demandDerivation: `${subject.minMinutesPerWeek} min/wk (catalog) × ${sectionCount} section(s) = ${demandMinutesPerWeek} min/wk`,
        currentOwnershipEvidence: {
          evidenceStatus: 'SUGGESTION_ONLY',
          ownershipIds,
          facultyIds: [...facultyIds].sort((a, b) => a - b),
        },
        decisionStatus: 'UNAPPROVED_SUGGESTION',
        termMode: 'ALL',
        termModeStatus: 'UNAPPROVED_SUGGESTION',
        unresolvedFields: ['classification', 'operatorConfirmReject', 'rotationOrder(if rotating)'],
      });
    }
  }

  groups.sort((a, b) => a.groupKey.localeCompare(b.groupKey));

  const maxUpdatedAt = (rows: { updatedAt: Date }[]): string | null => {
    let max: number | null = null;
    for (const row of rows) {
      const t = row.updatedAt.getTime();
      if (max === null || t > max) max = t;
    }
    return max === null ? null : new Date(max).toISOString();
  };

  // Touch buildExpectedScopes so the expected-scope inventory and the
  // candidate buckets can never silently diverge: every bucket scope must
  // be an expected scope. This is a read-only consistency probe, not a
  // second data source.
  const expected = await buildExpectedScopes(schoolId, schoolYearId);
  const expectedKeys = new Set(expected.map((e) => e.scopeKey));
  for (const bucket of orderedBuckets) {
    if (!expectedKeys.has(bucket.scopeKey)) {
      throw new Error(`Decision-candidate scope ${bucket.scopeKey} is not an expected scope. Refresh section mirrors and retry.`);
    }
  }

  return {
    schoolId,
    schoolYearId,
    generatedAt: new Date().toISOString(),
    authorizesNoMutation: true,
    provenanceNote: 'Every group is an UNAPPROVED_SUGGESTION. Ownership rows are SUGGESTION_ONLY staffing evidence: never approved, never auto-applied, never curriculum authority. Prior operator choices enter only by restoring an explicit decision draft; only explicit operator confirmation creates requirements (a later SCA step). Drafts are bound to sourceRevisionHash: any semantic source change invalidates a saved draft.',
    sourceRevisionHash,
    termConfig: termConfig
      ? {
        id: termConfig.id,
        termCount: termConfig.termCount,
        termIdentities: termConfig.termIdentities,
        updatedAt: termConfig.updatedAt.toISOString(),
      }
      : null,
    sourceRevisions: {
      activeSubjectCount: subjects.length,
      activeSectionCount: sections.length,
      annualOwnershipCount: ownerships.length,
      activeRequirementCount: activeRequirements.length,
      subjectsUpdatedAtMax: maxUpdatedAt(subjects),
      ownershipsUpdatedAtMax: maxUpdatedAt(ownerships),
    },
    groups,
    counts: {
      total: groups.length,
      unresolved: groups.length,
    },
  };
}
