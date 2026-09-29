/**
 * A8-C5 S1.1 — write-path school-year authority: never default a year id.
 *
 * Lane C's 17:25 truth-fix ruling (`docs/prompts/truth-fixes-2026-09-29.md` §A8):
 * `faculty.router.ts`, `section.router.ts` §sync and
 * §special-program-placement-overlay each read
 * `schoolYearId = activeYear?.id ?? 1`.  When the caller supplies no
 * `schoolYearId` and EnrollPro's active school year cannot be resolved, those
 * sites silently wrote against year id `1` — a real write into an arbitrary
 * year.  This module is the single fail-closed resolver every such write path
 * uses.
 *
 * Contract:
 *  - A caller-supplied `schoolYearId` must be a positive integer.  Anything
 *    else is a `400 INVALID_BODY` refusal.  We never coerce, round or
 *    substitute a year id.
 *  - With no caller-supplied id, the active EnrollPro school year must resolve.
 *    Otherwise this is a typed refusal.
 *  - The refusal code `ACTIVE_SCHOOL_YEAR_UNRESOLVED` is NEW (it does not exist
 *    anywhere at base `f925045c`).  Its *shape* copies the existing
 *    unresolved-authority refusals — `ACTIVE_SCHOOL_YEAR_AMBIGUOUS`
 *    (`publication-contract.service.ts`) and the client vocabulary
 *    `ACTIVE_SCHOOL_YEAR_REQUIRED` (`atlas-client/src/pages/Subjects.tsx`) —
 *    and its HTTP status is 409, matching `ACTIVE_TERM_UNRESOLVED`.
 *
 * Authority: this module only *refuses* a write.  It grants no capability,
 * creates no year, and dispatches nothing.  Callers must return before any
 * service/mirror dispatch, which is what gives A1 its "zero writes and zero
 * downstream sync dispatch".
 */

import { fetchEnrollProActiveSchoolYear } from '../services/section-adapter.js';

export const ACTIVE_SCHOOL_YEAR_UNRESOLVED = 'ACTIVE_SCHOOL_YEAR_UNRESOLVED' as const;

export type WriteSchoolYearRefusal = {
	readonly ok: false;
	readonly status: 400 | 409;
	readonly code: string;
	readonly message: string;
};

export type WriteSchoolYearResolution =
	| { readonly ok: true; readonly schoolYearId: number; readonly yearLabel: string | null }
	| WriteSchoolYearRefusal;

function invalid(schoolYearId: unknown): WriteSchoolYearRefusal {
	return {
		ok: false,
		status: 400,
		code: 'INVALID_BODY',
		message: 'schoolYearId must be a positive integer when provided.',
	};
}

/**
 * Resolve the school year a WRITE path must use.
 *
 * @param suppliedSchoolYearId raw `req.body.schoolYearId`; `undefined` means
 *   "caller did not supply one, resolve the EnrollPro active year".
 * @param authToken upstream auth token forwarded to the EnrollPro integration
 *   endpoint.
 */
export async function resolveWriteSchoolYearId(
	suppliedSchoolYearId: unknown,
	authToken?: string,
): Promise<WriteSchoolYearResolution> {
	if (suppliedSchoolYearId !== undefined && suppliedSchoolYearId !== null) {
		const schoolYearId = Number(suppliedSchoolYearId);
		if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) return invalid(suppliedSchoolYearId);
		return { ok: true, schoolYearId, yearLabel: null };
	}

	const activeYear = await fetchEnrollProActiveSchoolYear(authToken);
	if (!activeYear || !Number.isInteger(activeYear.id) || activeYear.id <= 0) {
		// Fail closed. We do not fall back to year id 1 (or any other year).
		return {
			ok: false,
			status: 409,
			code: ACTIVE_SCHOOL_YEAR_UNRESOLVED,
			message:
				'The active school year could not be resolved, so this change was not saved. Retry once the school year is available in EnrollPro, or send an explicit schoolYearId.',
		};
	}
	return { ok: true, schoolYearId: activeYear.id, yearLabel: activeYear.yearLabel ?? null };
}
