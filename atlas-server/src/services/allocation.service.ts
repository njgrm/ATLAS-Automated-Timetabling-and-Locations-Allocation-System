/**
 * Dynamic allocation, insertion, and rebalance service.
 *
 * Converts persisted offering demand into a work queue, evaluates allocation
 * candidates using canonical qualification and workload policies, and produces
 * preview/apply plans with exact moves/inserts/removals.
 *
 * Replaces scattered auto-fill/rebalance logic in:
 * - teaching-load-automation.service.ts (findBestCandidateForMode, simulateRealFacultyCoverage)
 * - teaching-load-suggestion-proposal.service.ts
 * - hybrid-scheduler.ts (repair candidates)
 *
 * Preview performs zero writes. Apply uses the exact approved fingerprinted plan.
 */

import { getDataContext } from '../lib/data-context.js';
import { evaluateQualification, type QualificationInput, type QualificationResult } from './qualification-evaluator.service.js';
import { computeWorkload, type WorkloadPolicy, WORKLOAD_DEFAULTS } from './workload-policy.service.js';
import { computeTeachingLoadMinutes } from './faculty-assignment.service.js';

const db = () => getDataContext();

// ─── Types ───

export interface WorkQueueItem {
  id: string;
  schoolId: number;
  schoolYearId: number;
  subjectId: number;
  subjectCode: string;
  sectionId: number;
  sectionName: string;
  gradeLevel: number;
  programType: string;
  termIdentity: string | null;
  meetingsPerWeek: number;
  minutesPerMeeting: number;
  totalMinutesPerWeek: number;
  classification: string;
  rotationFamily: string | null;
  currentOwnerId: number | null;
  currentOwnerName: string | null;
  status: 'UNASSIGNED' | 'INVALID_OWNERSHIP' | 'VALID';
}

export interface AllocationCandidate {
  facultyId: number;
  facultyName: string;
  department: string | null;
  specialization: string | null;
  qualificationTier: number | null;
  qualificationReason: string;
  currentTeachingMinutes: number;
  projectedTeachingMinutes: number;
  teachingCapacityRemaining: number;
  wouldExceedStandard: boolean;
  wouldExceedCap: boolean;
  score: number;
}

export interface AllocationPlanItem {
  action: 'INSERT' | 'MOVE' | 'REMOVE' | 'RETAIN';
  workQueueItemId: string;
  subjectId: number;
  sectionId: number;
  fromFacultyId: number | null;
  fromFacultyName: string | null;
  toFacultyId: number;
  toFacultyName: string;
  qualificationTier: number;
  qualificationReason: string;
  beforeTeachingMinutes: number;
  afterTeachingMinutes: number;
  affectedSections: string[];
}

export interface AllocationPreviewResult {
  plan: AllocationPlanItem[];
  insertedCount: number;
  movedCount: number;
  removedCount: number;
  retainedCount: number;
  unresolvedItems: Array<{ workQueueItemId: string; reason: string; rejectedCandidates: string[] }>;
  perFacultyBeforeAfter: Array<{
    facultyId: number;
    facultyName: string;
    beforeMinutes: number;
    afterMinutes: number;
    deltaMinutes: number;
  }>;
  fingerprint: string;
  policyRevision: number;
}

// ─── Errors ───

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
  const e = new Error(message) as Error & { statusCode: number; code: string };
  e.statusCode = statusCode;
  e.code = code;
  return e;
}

// ─── Work Queue Construction ───

/**
 * Build the work queue from persisted offering demand minus valid current ownership.
 * Each item has a stable identity including school/year, offering, section, term, meetings, and minutes.
 */
export async function buildWorkQueue(
  schoolId: number,
  schoolYearId: number,
): Promise<WorkQueueItem[]> {
  const [offerings, ownerships, sections, subjects] = await Promise.all([
    db().schoolYearOffering.findMany({
      where: { schoolId, schoolYearId, isActive: true },
      include: { subject: { select: { id: true, code: true, name: true } } },
    }),
    db().subjectSectionOwnership.findMany({
      where: { schoolId, schoolYearId },
    }),
    db().sectionMirror.findMany({
      where: { schoolId, schoolYearId, isActiveForScheduling: true },
    }),
    db().subject.findMany({
      where: { schoolId, isActive: true },
    }),
  ]);

  const sectionMap = new Map(sections.map((s) => [s.externalId, s]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const ownershipSet = new Set(
    ownerships.map((o) => `${o.subjectId}:${o.sectionId}`),
  );

  const items: WorkQueueItem[] = [];

  for (const offering of offerings) {
    if (!offering.subjectId) continue; // skip EMPTY scope
    const subject = subjectMap.get(offering.subjectId);
    if (!subject) continue;

    // For each section that matches this offering's grade/program
    const matchingSections = sections.filter(
      (s) => s.gradeLevelId === offering.gradeLevel && s.programType === offering.programType,
    );

    for (const section of matchingSections) {
      const key = `${offering.subjectId}:${section.externalId}`;
      const ownership = ownerships.find(
        (o) => o.subjectId === offering.subjectId && o.sectionId === section.externalId,
      );

      let status: WorkQueueItem['status'] = 'UNASSIGNED';
      if (ownership) {
        status = 'VALID';
      }

      const meetingsPerWeek = Math.max(1, Math.ceil(offering.weeklyMinutes / 45)); // default 45-min period

      items.push({
        id: `${offering.id}:${section.externalId}`,
        schoolId,
        schoolYearId,
        subjectId: offering.subjectId,
        subjectCode: subject.code,
        sectionId: section.externalId,
        sectionName: section.name,
        gradeLevel: offering.gradeLevel,
        programType: offering.programType,
        termIdentity: null, // simplified for now
        meetingsPerWeek,
        minutesPerMeeting: 45,
        totalMinutesPerWeek: offering.weeklyMinutes,
        classification: offering.classification,
        rotationFamily: offering.rotationFamily,
        currentOwnerId: ownership?.facultyId ?? null,
        currentOwnerName: null, // resolved later
        status,
      });
    }
  }

  return items;
}

// ─── Candidate Evaluation ───

/**
 * Evaluate all eligible faculty candidates for a work queue item.
 * Uses canonical qualification and workload policies.
 */
export async function evaluateCandidates(
  workItem: WorkQueueItem,
  schoolId: number,
  schoolYearId: number,
  workloadPolicy: WorkloadPolicy,
): Promise<AllocationCandidate[]> {
  const [faculty, specializations] = await Promise.all([
    db().facultyMirror.findMany({
      where: { schoolId, isStale: false, isActiveForScheduling: true },
      include: {
        facultySubjects: {
          where: { schoolId, schoolYearId },
          select: { subjectId: true, sectionIds: true },
        },
      },
    }),
    db().specializationAlias.findMany({
      where: { schoolId },
      select: { canonical: true, alias: true },
    }),
  ]);

  const subject = await db().subject.findUnique({ where: { id: workItem.subjectId } });
  if (!subject) return [];

  const aliases = specializations.map((s) => ({ alias: s.alias, canonical: s.canonical }));
  const candidates: AllocationCandidate[] = [];

  for (const member of faculty) {
    // Compute current teaching load
    let currentTeachingMinutes = 0;
    for (const fs of member.facultySubjects) {
      const sub = await db().subject.findUnique({ where: { id: fs.subjectId } });
      if (sub) {
        currentTeachingMinutes += sub.minMinutesPerWeek * fs.sectionIds.length;
      }
    }

    // Check if already teaching this subject-section
    const alreadyTeaching = member.facultySubjects.some(
      (fs) => fs.subjectId === workItem.subjectId && fs.sectionIds.includes(workItem.sectionId),
    );
    if (alreadyTeaching) continue;

    // Evaluate qualification
    const qualInput: QualificationInput = {
      facultyId: member.id,
      facultyDepartment: member.department,
      facultySpecialization: member.specialization,
      canTeachOutsideDepartment: member.canTeachOutsideDepartment,
      subjectId: workItem.subjectId,
      subjectCode: workItem.subjectCode,
      subjectName: subject.name,
      subjectOwnerDepartment: subject.ownerDepartment,
      subjectAllowedDepartments: [], // resolved by evaluator
      subjectAllowedSpecializations: subject.allowedSpecializations,
      subjectProgramScopes: subject.programScopes as any,
      sectionProgramType: workItem.programType as any,
      specializationAliases: aliases,
    };

    const qual = await evaluateQualification(qualInput, schoolId);
    if (!qual.eligible) continue;

    const projectedMinutes = currentTeachingMinutes + workItem.totalMinutesPerWeek;
    const workload = computeWorkload(projectedMinutes, 0, 0, workloadPolicy);

    candidates.push({
      facultyId: member.id,
      facultyName: `${member.firstName} ${member.lastName}`,
      department: member.department,
      specialization: member.specialization,
      qualificationTier: qual.tier,
      qualificationReason: qual.reason,
      currentTeachingMinutes,
      projectedTeachingMinutes: projectedMinutes,
      teachingCapacityRemaining: workload.teachingCapacityRemainingMinutes,
      wouldExceedStandard: workload.excessTeachingMinutes > 0,
      wouldExceedCap: projectedMinutes > workloadPolicy.hardCapMinutes,
      score: computeCandidateScore(qual.tier ?? 99, currentTeachingMinutes, projectedMinutes, workloadPolicy),
    });
  }

  // Sort by score (lower is better)
  candidates.sort((a, b) => a.score - b.score);
  return candidates;
}

function computeCandidateScore(
  qualTier: number,
  currentMinutes: number,
  projectedMinutes: number,
  policy: WorkloadPolicy,
): number {
  // Lower score = better candidate
  // Tier 1 (alias) < Tier 2 (spec+dept) < Tier 3 (cross-dept)
  const tierScore = qualTier * 1000;
  // Prefer candidates with lower projected load
  const loadScore = projectedMinutes / 60;
  // Penalty for exceeding standard
  const excessPenalty = projectedMinutes > policy.teachingStandardMinutes ? 500 : 0;
  return tierScore + loadScore + excessPenalty;
}

// ─── Preview ───

/**
 * Generate an allocation preview plan. Performs zero writes.
 */
export async function previewAllocation(
  schoolId: number,
  schoolYearId: number,
): Promise<AllocationPreviewResult> {
  const workQueue = await buildWorkQueue(schoolId, schoolYearId);
  const unassigned = workQueue.filter((item) => item.status !== 'VALID');

  const plan: AllocationPlanItem[] = [];
  const unresolved: AllocationPreviewResult['unresolvedItems'] = [];
  const facultyLoadDelta = new Map<number, { name: string; before: number; after: number }>();

  // Load workload policy
  const policyRow = await db().schedulingPolicy.findUnique({
    where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
  });
  const workloadPolicy: WorkloadPolicy = {
    teachingStandardMinutes: policyRow?.teachingStandardMinutes ?? WORKLOAD_DEFAULTS.teachingStandardMinutes,
    advisoryCreditMinutes: policyRow?.advisoryCreditMinutes ?? WORKLOAD_DEFAULTS.advisoryCreditMinutes,
    hardCapMinutes: policyRow?.hardCapMinutes ?? WORKLOAD_DEFAULTS.hardCapMinutes,
  };

  for (const item of unassigned) {
    const candidates = await evaluateCandidates(item, schoolId, schoolYearId, workloadPolicy);

    if (candidates.length === 0) {
      unresolved.push({
        workQueueItemId: item.id,
        reason: 'NO_QUALIFIED_CANDIDATE',
        rejectedCandidates: [],
      });
      continue;
    }

    const best = candidates[0];
    if (best.wouldExceedCap) {
      unresolved.push({
        workQueueItemId: item.id,
        reason: 'ALL_CANDIDATES_EXCEED_CAP',
        rejectedCandidates: candidates.slice(0, 5).map((c) => c.facultyName),
      });
      continue;
    }

    plan.push({
      action: 'INSERT',
      workQueueItemId: item.id,
      subjectId: item.subjectId,
      sectionId: item.sectionId,
      fromFacultyId: null,
      fromFacultyName: null,
      toFacultyId: best.facultyId,
      toFacultyName: best.facultyName,
      qualificationTier: best.qualificationTier ?? 99,
      qualificationReason: best.qualificationReason,
      beforeTeachingMinutes: best.currentTeachingMinutes,
      afterTeachingMinutes: best.projectedTeachingMinutes,
      affectedSections: [item.sectionName],
    });

    // Update faculty load tracking
    const existing = facultyLoadDelta.get(best.facultyId);
    if (existing) {
      existing.after = best.projectedTeachingMinutes;
    } else {
      facultyLoadDelta.set(best.facultyId, {
        name: best.facultyName,
        before: best.currentTeachingMinutes,
        after: best.projectedTeachingMinutes,
      });
    }
  }

  const insertedCount = plan.filter((p) => p.action === 'INSERT').length;
  const perFacultyBeforeAfter = Array.from(facultyLoadDelta.entries()).map(([facultyId, data]) => ({
    facultyId,
    facultyName: data.name,
    beforeMinutes: data.before,
    afterMinutes: data.after,
    deltaMinutes: data.after - data.before,
  }));

  return {
    plan,
    insertedCount,
    movedCount: 0,
    removedCount: 0,
    retainedCount: workQueue.filter((item) => item.status === 'VALID').length,
    unresolvedItems: unresolved,
    perFacultyBeforeAfter,
    fingerprint: computeAllocationFingerprint(plan),
    policyRevision: 0,
  };
}

function computeAllocationFingerprint(plan: AllocationPlanItem[]): string {
  const canonical = JSON.stringify(
    plan.map((p) => ({
      action: p.action,
      subjectId: p.subjectId,
      sectionId: p.sectionId,
      toFacultyId: p.toFacultyId,
    })).sort((a, b) => a.subjectId - b.subjectId || a.sectionId - b.sectionId),
  );
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `ALLOC_${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}
