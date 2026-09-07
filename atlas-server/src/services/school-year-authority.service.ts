/**
 * SCA-02R — school-year authority.
 *
 * Every Curriculum Requirements read and mutation verifies that the
 * requested schoolYearId belongs to the actor's school through the
 * ATLAS-persisted EnrollPro school-year mirror. Extracted into its own
 * module so both `term-config.service.ts` and
 * `school-year-offering.service.ts` can depend on it without a cycle.
 */

import { getDataContext } from '../lib/data-context.js';

const db = () => getDataContext();

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
  const e = new Error(message) as Error & { statusCode: number; code: string };
  e.statusCode = statusCode;
  e.code = code;
  return e;
}

export interface SchoolYearAuthority {
  schoolId: number;
  schoolYearId: number;
  yearLabel: string;
  isActive: boolean;
}

/**
 * Verify that `schoolYearId` is a known, same-school, non-archived year.
 * Missing (including cross-school years with no local mirror) → 404
 * YEAR_NOT_FOUND. Archived → 409 YEAR_ARCHIVED. Never leaks another
 * school's year existence beyond "not found for this school".
 */
export async function assertSchoolYearAuthority(
  schoolId: number,
  schoolYearId: number,
): Promise<SchoolYearAuthority> {
  if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
    throw err(400, 'INVALID_PARAM', 'schoolYearId must be a positive integer.');
  }
  const mirror = await db().enrollProSchoolYearMirror.findUnique({
    where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
  });
  if (!mirror) {
    throw err(404, 'YEAR_NOT_FOUND', 'No school-year record exists for this school and year.');
  }
  if (mirror.isArchived) {
    throw err(409, 'YEAR_ARCHIVED', 'This school year is archived and read-only. Requirements cannot be configured on archived years.');
  }
  return {
    schoolId,
    schoolYearId,
    yearLabel: mirror.yearLabel,
    isActive: mirror.isActive,
  };
}
