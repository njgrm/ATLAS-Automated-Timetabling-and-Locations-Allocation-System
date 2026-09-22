/**
 * COMPANION-SSO-C03 (Option A) — ATLAS-side normalization of the reverse-SSO
 * identity assertion produced by `POST /api/v1/auth/sso/exchange`.
 *
 * EnrollPro's `companionSsoReverseExchangeResponseSchema`
 * (`shared/src/schemas/companion-sso.schema.ts:62-76` at `7b6231ee`) requires:
 *   - `identity.roles` to be a non-empty array drawn from `RoleEnum`
 *     (`shared/src/constants/index.ts:4-11`), and
 *   - `identity.firstName` / `identity.lastName`, WHEN PRESENT, to be
 *     non-empty strings (`z.string().min(1).optional()`): a present-but-empty
 *     name fails validation, so empty names must be OMITTED, not sent as `""`.
 *
 * EnrollPro never compares the asserted name: `assertUserCanEnterEnrollPro`
 * (`server/src/features/auth/companion-sso-reverse.service.ts:411-419`)
 * checks only `isActive`, and `resolveUserById` (`:421-434`) prefers `userId`
 * then falls back to `employeeId`. The reverse assertion therefore sends
 * `subject` + `employeeId` (never a local numeric `userId`) and omits empty
 * names; `employeeId` is the reconciliation key the producer fails closed on.
 *
 * Local `atlas_auth_accounts.role` values are stored lowercase (`officer`,
 * `faculty`, `admin`, plus the legacy uppercase `SYSTEM_ADMIN`), so the raw
 * column value is NOT a valid EnrollPro role. The helpers below translate the
 * persisted identity into the exact EnrollPro vocabulary and return `null` when
 * that is impossible, so the producer can fail typed instead of emitting an
 * assertion EnrollPro must reject with 502.
 *
 * This module is producer-side conformance only. The ATLAS Flow B issuance gate
 * (`POST /api/v1/auth/sso/authorize`, privileged roles via
 * `atlas-server/src/middleware/authorize.ts`) keeps issuance privileged; these
 * helpers guarantee that whatever the gate releases can be represented in
 * EnrollPro's schema.
 */

/** Mirror of EnrollPro `RoleEnum` at `5887d685`. */
export const ENROLLPRO_SSO_ROLE_VOCABULARY = [
	'SYSTEM_ADMIN',
	'HEAD_REGISTRAR',
	'CLASS_ADVISER',
	'TEACHER',
	'LEARNER',
	'MRF',
] as const;

export type EnrollProSsoRole = (typeof ENROLLPRO_SSO_ROLE_VOCABULARY)[number];

/**
 * Exact-match map from an ATLAS local role to the EnrollPro role vocabulary.
 * `officer`, `admin`, and the legacy uppercase `SYSTEM_ADMIN` map to
 * `SYSTEM_ADMIN`; `faculty` maps to `TEACHER` (permitted by EnrollPro's
 * ATLAS-allowed staff-role set). Any other role returns `null` — unmappable.
 */
export function mapLocalRoleToEnrollProRoles(role: string): readonly EnrollProSsoRole[] | null {
	switch (role) {
		case 'officer':
		case 'admin':
		case 'SYSTEM_ADMIN':
			return ['SYSTEM_ADMIN'];
		case 'faculty':
			return ['TEACHER'];
		default:
			return null;
	}
}

export type ReverseSsoNameParts = { firstName: string; lastName: string };

/**
 * Resolve the assertion name parts from persisted identity only:
 *   1. the canonical faculty mirror's first/last name, when BOTH trimmed parts
 *      are non-empty;
 *   2. otherwise a persisted `accountName` split on whitespace (first token →
 *      `firstName`, remaining tokens joined by one space → `lastName`), when
 *      both resulting parts are non-empty;
 *   3. otherwise `null` — the producer OMITS both name keys (never `""`, never
 *      fabricated) so EnrollPro's `min(1).optional()` schema stays satisfiable.
 *
 * It never fabricates a name and never returns an empty string.
 */
export function resolveReverseSsoNameParts(input: {
	faculty: { firstName: string | null; lastName: string | null } | null;
	accountName: string | null;
}): ReverseSsoNameParts | null {
	const facultyFirst = input.faculty?.firstName?.trim() ?? '';
	const facultyLast = input.faculty?.lastName?.trim() ?? '';
	if (facultyFirst && facultyLast) {
		return { firstName: facultyFirst, lastName: facultyLast };
	}

	const accountName = input.accountName?.trim() ?? '';
	if (accountName) {
		const [first = '', ...rest] = accountName.split(/\s+/);
		const last = rest.join(' ');
		if (first && last) {
			return { firstName: first, lastName: last };
		}
	}
	return null;
}
