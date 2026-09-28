/**
 * A2 C12 / ITEM S2 — the PAST-YEAR READ scope, as pure arithmetic.
 *
 * ## Why a helper and not a middleware
 * `middleware/authorize.ts` owns the actor-school predicate
 * (`assertRequestSchoolScope`), and it is correct — but it writes to `res` and
 * cannot be unit-tested without an Express double. "May THIS actor read THIS
 * school year?" is arithmetic over four inputs, so it lives here, is called by
 * the route BEFORE any service dispatch, and is unit-tested directly.
 *
 * ## No second authority
 * The order below is deliberately the same order `assertRequestSchoolScope` uses
 * (unresolved actor school first, then cross-school), and the router loads
 * `actorSchoolYearIds` for the ACTOR's school. A caller naming a different
 * `schoolId` is refused on the school check BEFORE the year list is consulted,
 * so asking for someone else's school can never reach their year list.
 *
 * ## Why there is no fallback branch
 * C2's rationale, which is the whole reason this file has no "best effort" arm:
 * silently serving the CURRENT year while the operator believes they are looking
 * at 2022-2023 is a lie; an empty state is only an annoyance. Every refusal here
 * returns a typed code and NO `schoolYearId`, so a refused year has nothing to
 * fall through with. See `past-year-timetable-scope-c12.test.ts`.
 *
 * This is a READ. No migration, no schema change, no write, no generation, no
 * publication.
 */

export type PastYearScopeCode =
	| 'INVALID_PARAM'
	| 'SCHOOL_SCOPE_REQUIRED'
	| 'CROSS_SCHOOL_DENIED'
	| 'SCHOOL_YEAR_NOT_FOUND'
	| 'NOT_A_PAST_SCHOOL_YEAR';

export type PastYearReadScope =
	| { ok: true; schoolId: number; schoolYearId: number; activeSchoolYearId: number | null }
	| { ok: false; status: number; code: PastYearScopeCode; message: string };

export type PastYearReadScopeInput = {
	/** `req.user?.schoolId` — the ONLY authority for which school is readable. */
	actorSchoolId: number | null | undefined;
	/** `req.params.schoolId`, RAW and uncoerced. */
	requestedSchoolId: unknown;
	/** `req.params.schoolYearId`, RAW and uncoerced. */
	requestedSchoolYearId: unknown;
	/**
	 * The years that belong to the ACTOR's school. The route MUST load this with
	 * `where: { schoolId: actorSchoolId }`; passing a list built from any other
	 * school would make the school check decorative.
	 */
	actorSchoolYearIds: readonly number[];
	/**
	 * The runtime-active year, from the single published-schedule election
	 * authority. `null` when the election did not resolve — and `null` is NOT
	 * permission: this surface then cannot prove a year is past, and refuses.
	 */
	activeSchoolYearId: number | null;
};

function refuse(status: number, code: PastYearScopeCode, message: string): PastYearReadScope {
	return { ok: false, status, code, message };
}

/**
 * A strict positive-integer parse. Shared with the route so "what counts as an
 * id" has ONE definition rather than a second copy to drift.
 *
 * Deliberately stricter than `Number(raw)`: a partial parse like `'7abc'` and a
 * fractional `'7.5'` are both REFUSALS, not rounded values.
 */
export function parsePositiveIntegerParam(raw: unknown): number | null {
	if (typeof raw === 'number') {
		return Number.isSafeInteger(raw) && raw >= 1 ? raw : null;
	}
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (!/^\d+$/.test(trimmed)) return null;
	const parsed = Number(trimmed);
	return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

export function resolvePastYearReadScope(input: PastYearReadScopeInput): PastYearReadScope {
	// 1. The school id itself. Mirrors `assertRequestSchoolScope`'s 400.
	const requestedSchoolId = parsePositiveIntegerParam(input.requestedSchoolId);
	if (requestedSchoolId === null) {
		return refuse(400, 'INVALID_PARAM', 'schoolId must be a positive integer.');
	}

	// 2. The ACTOR's school, before anything else. An unresolved actor school is
	//    its own typed 403 — it is not the same event as a cross-school actor,
	//    and collapsing them would silently change the deployed API contract.
	//
	//    NOTE the STRICTER parse than the path parameters above: the path is a
	//    string and must be parsed, but the actor school arrives from the verified
	//    token payload and is required to be a REAL integer. A stringly-typed
	 //    `'1'` is an UNRESOLVED actor school, exactly as
	//    `assertRequestSchoolScope` treats it — accepting it here would make this
	//    surface more permissive than the guard it is supposed to sit behind.
	const rawActorSchoolId = input.actorSchoolId;
	const actorSchoolId = typeof rawActorSchoolId === 'number' && Number.isSafeInteger(rawActorSchoolId) && rawActorSchoolId >= 1
		? rawActorSchoolId
		: null;
	if (actorSchoolId === null) {
		return refuse(403, 'SCHOOL_SCOPE_REQUIRED', 'Authenticated school scope is required for this action.');
	}

	// 3. Cross-school. BEFORE the year list is read, so the year ids of another
	//    school cannot be probed by watching which code comes back.
	if (actorSchoolId !== requestedSchoolId) {
		return refuse(403, 'CROSS_SCHOOL_DENIED', 'Cannot read another school\'s school year.');
	}

	// 4. The year id.
	const schoolYearId = parsePositiveIntegerParam(input.requestedSchoolYearId);
	if (schoolYearId === null) {
		return refuse(400, 'INVALID_PARAM', 'schoolYearId must be a positive integer.');
	}

	// 5. Does the ACTOR's school own this year? No `activeSchoolYearId` widening:
	//    the list is already the actor school's own.
	if (!input.actorSchoolYearIds.includes(schoolYearId)) {
		return refuse(404, 'SCHOOL_YEAR_NOT_FOUND', 'That school year does not belong to your school.');
	}

	// 6. The current year is not this surface. With an UNRESOLVED active year we
	//    cannot prove the year is past, so we refuse rather than guess.
	if (input.activeSchoolYearId === null || schoolYearId === input.activeSchoolYearId) {
		return refuse(409, 'NOT_A_PAST_SCHOOL_YEAR', 'That is the current school year. Open it without the past-year parameter.');
	}

	return { ok: true, schoolId: actorSchoolId, schoolYearId, activeSchoolYearId: input.activeSchoolYearId };
}
