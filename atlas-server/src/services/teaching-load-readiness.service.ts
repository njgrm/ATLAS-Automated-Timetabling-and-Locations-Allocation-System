/**
 * Teaching Load readiness evaluator — checks whether the current school/year
 * has complete offering coverage, ownership, and workload policy configuration.
 *
 * Exposed as a readiness domain in the dashboard and as a standalone check
 * for generation gating.
 */

import { getDataContext } from '../lib/data-context.js';
import { evaluateOfferingReadiness, type OfferingReadinessResult } from './school-year-offering.service.js';
import { getTermConfig } from './term-config.service.js';

const db = () => getDataContext();

// ─── Types ───

export interface TeachingLoadReadinessResult {
  ready: boolean;
  termConfigPresent: boolean;
  offeringReadiness: OfferingReadinessResult;
  ownershipCount: number;
  facultyCount: number;
  activeOwnershipCount: number;
  coveragePercent: number;
  blockers: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
}

// ─── Readiness Evaluation ───

export async function evaluateTeachingLoadReadiness(
  schoolId: number,
  schoolYearId: number,
): Promise<TeachingLoadReadinessResult> {
  const [termConfig, offeringReadiness, ownershipCount, facultyCount, activeOwnershipCount] = await Promise.all([
    getTermConfig(schoolId, schoolYearId),
    evaluateOfferingReadiness(schoolId, schoolYearId),
    db().subjectSectionOwnership.count({ where: { schoolId, schoolYearId } }),
    db().facultyMirror.count({ where: { schoolId, isStale: false, isActiveForScheduling: true } }),
    db().subjectSectionOwnership.count({
      where: {
        schoolId,
        schoolYearId,
        facultySubject: { faculty: { isStale: false, isActiveForScheduling: true } },
      },
    }),
  ]);

  const blockers: TeachingLoadReadinessResult['blockers'] = [];
  const warnings: TeachingLoadReadinessResult['warnings'] = [];

  // Term config check
  if (!termConfig) {
    blockers.push({
      code: 'TL_TERM_CONFIG_MISSING',
      message: 'No persisted term configuration. Configure terms before setting up teaching load.',
    });
  }

  // Offering readiness
  for (const blocker of offeringReadiness.blockers) {
    blockers.push({
      code: `TL_${blocker.code}`,
      message: blocker.message,
    });
  }

  // Ownership checks
  if (ownershipCount === 0) {
    blockers.push({
      code: 'TL_OWNERSHIP_EMPTY',
      message: 'No subject-section ownerships exist. Assign teaching load before generation.',
    });
  } else if (activeOwnershipCount < ownershipCount) {
    warnings.push({
      code: 'TL_OWNERSHIP_STALE',
      message: `${ownershipCount - activeOwnershipCount} ownerships reference inactive faculty.`,
    });
  }

  // Coverage percent
  const coveragePercent = offeringReadiness.offeringCount > 0
    ? Math.round((activeOwnershipCount / (offeringReadiness.offeringCount * 10)) * 100) // rough estimate
    : 0;

  // Faculty count warnings
  if (facultyCount === 0) {
    blockers.push({
      code: 'TL_FACULTY_EMPTY',
      message: 'No active faculty mirrors exist. Sync faculty before setting up teaching load.',
    });
  }

  return {
    ready: blockers.length === 0,
    termConfigPresent: termConfig !== null,
    offeringReadiness,
    ownershipCount,
    facultyCount,
    activeOwnershipCount,
    coveragePercent,
    blockers,
    warnings,
  };
}
