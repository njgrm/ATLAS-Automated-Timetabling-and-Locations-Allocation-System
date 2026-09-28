/**
 * A2 C12 / ITEM S2 — the PAST-YEAR READ scope helper, and the read-only shape of
 * the route that uses it.
 *
 * ── WHY A PURE HELPER, AND WHY IT IS SEPARATE ────────────────────────────────
 * C3 requires a scoped published read where "the scope is enforced by the actor,
 * not by the caller". `middleware/authorize.ts` already owns the actor-school
 * predicate (`assertRequestSchoolScope`), but it is a middleware: it writes to
 * `res` and cannot be unit-tested without an Express double. The decision
 * "may THIS actor read THIS school year" is pure arithmetic over four inputs, so
 * it lives in `services/past-year-timetable-scope.ts` and the route calls it.
 * No second authority is invented: the helper is checked into the same
 * fail-closed order `assertRequestSchoolScope` uses, and the router route is
 * bound to the actor's OWN school when it loads the year list.
 *
 * ── THE ONE INVARIANT THIS FILE EXISTS TO PROTECT ───────────────────────────
 * A past-year read must never widen, and must never fall through. Row 2 is the
 * load-bearing one: a caller that names a DIFFERENT `schoolId` is refused on the
 * school check, BEFORE the year is even looked at, so asking for someone else's
 * school cannot reach their year list. If that ordering ever inverts, a caller
 * can read any year it can name — and the year label on screen would then belong
 * to a school the operator does not belong to.
 *
 * This is a PURE test: no database, no mounted router, no network. Run:
 *   npm run test:past-year-timetable-scope-c12
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	parsePositiveIntegerParam,
	resolvePastYearReadScope,
} from '../services/past-year-timetable-scope.js';

/** The actor school in every row below unless a row says otherwise. */
const ACTOR_SCHOOL = 1;
/** The actor's active year — the current year, never a past-year target. */
const ACTIVE_YEAR = 9;
/** Two real past years of the actor's own school. */
const PAST_YEARS = [7, 8];
/** A year belonging to ANOTHER school. It must be unreachable from ACTOR_SCHOOL. */
const FOREIGN_YEAR = 42;

function scope(overrides: Partial<Parameters<typeof resolvePastYearReadScope>[0]> = {}) {
	return resolvePastYearReadScope({
		actorSchoolId: ACTOR_SCHOOL,
		requestedSchoolId: String(ACTOR_SCHOOL),
		requestedSchoolYearId: String(PAST_YEARS[0]),
		// The route loads the year list for the ACTOR's school only. The foreign
		// year is deliberately present in this list here, so row 2 proves the
		// SCHOOL check is what refuses — not the absence of the year.
		actorSchoolYearIds: [...PAST_YEARS, ACTIVE_YEAR, FOREIGN_YEAR],
		activeSchoolYearId: ACTIVE_YEAR,
		...overrides,
	});
}

// ═══ ROW 1 — an in-scope past year is the published read ════════════════════

test('ROW 1: an in-scope past school year of the actor school is admitted, read-only', () => {
	const decision = scope();
	assert.equal(decision.ok, true, `expected the read to be admitted, got ${JSON.stringify(decision)}`);
	if (!decision.ok) return;
	assert.equal(decision.schoolId, ACTOR_SCHOOL, 'the school is the ACTOR school, never the requested one');
	assert.equal(decision.schoolYearId, PAST_YEARS[0], 'and it is the requested year');
	assert.equal(decision.activeSchoolYearId, ACTIVE_YEAR, 'the active year travels with the decision so the published read can label itself historical');
});

// ═══ ROW 2 — THE LOAD-BEARING ROW: only the actor's school decides scope ═══

test('ROW 2: the actor school is the ONLY thing that decides scope — a caller cannot widen it by naming another schoolId', () => {
	// The foreign year IS in the list handed to the helper, so the year check
	// would pass. Only the school check can refuse — and it refuses first.
	const widened = scope({ requestedSchoolId: '2', requestedSchoolYearId: String(FOREIGN_YEAR) });
	assert.equal(widened.ok, false, 'asking for another school is refused even when the year exists in the list it was given');
	if (widened.ok) return;
	assert.equal(widened.status, 403);
	assert.equal(widened.code, 'CROSS_SCHOOL_DENIED');

	// ORDERING, asserted directly: a request that is BOTH cross-school AND for an
	// unknown year must be refused on the SCHOOL. If the year check ever moved
	// first, a caller could probe which year ids exist by reading the error code.
	const both = scope({ requestedSchoolId: '2', requestedSchoolYearId: '9999' });
	assert.equal(both.ok, false);
	if (both.ok) return;
	assert.equal(both.code, 'CROSS_SCHOOL_DENIED', 'the school check decides before the year check, so the year ids cannot be probed');

	// And the admitted row still resolves to the ACTOR school even when the
	// requested value is a different string that parses to the same number.
	assert.equal(scope({ requestedSchoolId: ' 1 ' }).ok, true, 'a padded but equal school id is the same school');
});

// ═══ ROW 3 — an unresolved actor school fails closed ════════════════════════

test('ROW 3: an unresolved or non-integer actor school is refused, and never becomes a school of its own', () => {
	for (const actorSchoolId of [null, undefined, 0, -1, 1.5, '1'] as const) {
		// `as never` for the string case, exactly as
		// `scheduler-c01-qa-corrections.test.ts:29` does against
		// `assertRequestSchoolScope`: the declared type is `number | null |
		// undefined`, but the value comes from a DECODED TOKEN PAYLOAD and a
		// stringly-typed `'1'` is a real thing the runtime guard must refuse. The
		// production type is not widened to make the test convenient.
		const decision = scope({ actorSchoolId: actorSchoolId as never });
		assert.equal(decision.ok, false, `actorSchoolId ${JSON.stringify(actorSchoolId)} must not be admitted`);
		if (decision.ok) continue;
		assert.equal(decision.status, 403, `actorSchoolId ${JSON.stringify(actorSchoolId)} is a 403`);
		assert.equal(decision.code, 'SCHOOL_SCOPE_REQUIRED',
			`actorSchoolId ${JSON.stringify(actorSchoolId)} keeps the established SCHOOL_SCOPE_REQUIRED code`);
	}
});

// ═══ ROW 4 — malformed parameters fail closed, they do not default ═════════

test('ROW 4: a malformed school or year id is refused with a typed 400, and is never coerced', () => {
	for (const requestedSchoolId of ['', 'abc', '0', '-1', '1.5', null, undefined, {}]) {
		const decision = scope({ requestedSchoolId: requestedSchoolId as never });
		assert.equal(decision.ok, false, `schoolId ${JSON.stringify(requestedSchoolId)} must not be admitted`);
		if (decision.ok) continue;
		assert.equal(decision.status, 400, `schoolId ${JSON.stringify(requestedSchoolId)} is a 400`);
		assert.equal(decision.code, 'INVALID_PARAM');
	}
	for (const requestedSchoolYearId of ['', 'abc', '0', '-1', '7.5', null, undefined]) {
		const decision = scope({ requestedSchoolYearId: requestedSchoolYearId as never });
		assert.equal(decision.ok, false, `schoolYearId ${JSON.stringify(requestedSchoolYearId)} must not be admitted`);
		if (decision.ok) continue;
		assert.equal(decision.status, 400, `schoolYearId ${JSON.stringify(requestedSchoolYearId)} is a 400`);
		assert.equal(decision.code, 'INVALID_PARAM');
	}

	// The parser is exported so the route and the client-facing refusal can share
	// ONE definition of "positive integer" — no second copy to drift.
	assert.equal(parsePositiveIntegerParam('7'), 7);
	assert.equal(parsePositiveIntegerParam(' 7 '), 7);
	assert.equal(parsePositiveIntegerParam('7abc'), null, 'a partial parse is not a parse');
	assert.equal(parsePositiveIntegerParam(7 as never), 7);
	assert.equal(parsePositiveIntegerParam('0'), null);
	assert.equal(parsePositiveIntegerParam('-1'), null);
	assert.equal(parsePositiveIntegerParam('1.5'), null);
	assert.equal(parsePositiveIntegerParam(null), null);
	assert.equal(parsePositiveIntegerParam(undefined), null);
});

// ═══ ROW 5 — a year the caller may not read is refused, and is NOT a fall-through ══

test('ROW 5: an unknown or out-of-scope year is refused with a typed 404, and there is no admitted fallback', () => {
	const unknown = scope({ requestedSchoolYearId: '9999' });
	assert.equal(unknown.ok, false, 'a year outside the actor school year list is refused');
	if (unknown.ok) return;
	assert.equal(unknown.status, 404);
	assert.equal(unknown.code, 'SCHOOL_YEAR_NOT_FOUND');
	// A refusal carries NO schoolYearId: the router has nothing to read, so there
	// is no way for a refused year to reach the published reader as a default.
	assert.equal('schoolYearId' in unknown, false, 'a refused decision carries no year to fall through to');

	// The mirror case: the actor school owns NO years at all. Still a refusal.
	const noYears = scope({ actorSchoolYearIds: [] });
	assert.equal(noYears.ok, false);
	if (noYears.ok) return;
	assert.equal(noYears.code, 'SCHOOL_YEAR_NOT_FOUND');
});

// ═══ ROW 6 — the active year is not a past year ═════════════════════════════

test('ROW 6: the ACTIVE year is refused by this surface — the current year is the other screen, not this one', () => {
	const active = scope({ requestedSchoolYearId: String(ACTIVE_YEAR) });
	assert.equal(active.ok, false, 'the active year is not served by the past-year read');
	if (active.ok) return;
	assert.equal(active.status, 409);
	assert.equal(active.code, 'NOT_A_PAST_SCHOOL_YEAR');
	// An archived-but-still-active election (activeSchoolYearId null because the
	// authority did not resolve) must NOT make the active year admissible either:
	// without a known active year this surface cannot prove the year is past.
	const unresolvedActive = scope({ activeSchoolYearId: null, requestedSchoolYearId: String(ACTIVE_YEAR) });
	assert.equal(unresolvedActive.ok, false, 'an unresolved active-year authority does not admit a year on this surface');
	if (unresolvedActive.ok) return;
	assert.equal(unresolvedActive.code, 'NOT_A_PAST_SCHOOL_YEAR');
});

// ═══ ROW 7 — the route is READ-ONLY and binds the actor's own school ════════

test('ROW 7: the past-year route is a GET, is actor-authenticated, and loads its year list for the ACTOR school', () => {
	const source = readFileSync(
		resolve(import.meta.dirname, '../routes/published-schedule.router.ts'),
		'utf8',
	);

	// ONE registration, and it is a GET. C1 is structural: a past year must have
	// no reachable mutation, so no POST/PUT/PATCH/DELETE may exist on this path.
	const registrations = [...source.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*history[^']*)'/g)]
		.map((match) => ({ method: match[1].toUpperCase(), path: match[2] }));
	assert.equal(registrations.length, 1, `expected exactly one past-year route registration, found ${JSON.stringify(registrations)}`);
	assert.equal(registrations[0].method, 'GET', 'and it is a GET — a past year has no reachable mutation on the server either');
	assert.match(registrations[0].path, /\/schools\/:schoolId\/school-years\/:schoolYearId\/schedules\/published\/history$/,
		'it sits inside the published family, one segment deeper than the public read so it can never shadow it');

	// The scope helper is the thing that decides, and the year list is loaded for
	// the actor school — this is what makes row 2 true at the route.
	assert.match(source, /resolvePastYearReadScope/, 'the route decides scope with the shared helper');
	assert.match(source, /schoolId:\s*actorSchoolId/, 'the year list is loaded for the ACTOR school, never the requested one');
	// Authenticated: the public published family is deliberately open, so this
	// variant must name its own authentication or it would widen nothing and
	// read everything.
	assert.match(source, /\/history',\s*\n\s*authenticate,/, 'the past-year read requires a credential of its own');

	// The public family is untouched: it still has no authentication and no scope
	// helper, because EnrollPro/AIMS read it unauthenticated by contract. A change
	// that "secured" it would break a companion, and a change that left the new
	// route unauthenticated would make C3 a no-op.
	//
	// The boundary is the past-year SECTION BANNER, not the route line: the new
	// section carries its own explanatory comment that names the helper, and a
	// comment is not a leak into another route's handler. What must not appear in
	// any pre-existing handler is the helper CALL and the `authenticate` guard.
	const firstPublic = /router\.get\('\/schools\/:schoolId\/schedules\/published'/.exec(source);
	const pastYearSection = /\/\/ ─── Past-year READ/.exec(source);
	assert.ok(firstPublic, 'the public published family is present, so the slice below is a real check');
	assert.ok(pastYearSection, 'the past-year section is present, so the slice below has a real end');
	assert.ok(pastYearSection.index > firstPublic.index, 'the past-year section comes after the public family, as it must');
	const publicHandlers = source.slice(firstPublic.index, pastYearSection.index);
	assert.ok(publicHandlers.includes('/schedules/published'), 'the slice really does contain the public published handlers');
	assert.doesNotMatch(publicHandlers, /resolvePastYearReadScope\s*\(/,
		'the public published family is unchanged — the new scope is never CALLED in its handlers');
	assert.doesNotMatch(publicHandlers, /router\.(get|post|put|patch|delete)\([^)]*\bauthenticate\b/,
		'and it stays unauthenticated, because EnrollPro/AIMS read it by contract and securing it would break a companion. (Checked as a ROUTE ARGUMENT, not the bare word: the SSE route legitimately names `import(...authenticate.js)` in a type position, which is not a guard.)');
});

// ═══ ROW 8 — C5: the term axis is the REQUESTED YEAR'S own frozen contract ══

test('ROW 8 (C5 / §7): the past-year read resolves its term from the requested year, never the current year', async () => {
	const source = readFileSync(
		resolve(import.meta.dirname, '../routes/published-schedule.router.ts'),
		'utf8',
	);
	const pastYearRoute = source.slice(source.indexOf('// ─── Past-year READ'));

	// The term selector the past-year route uses is the one that DEFAULTS to
	// `'active'` — and for a PUBLISHED (frozen) run the published service resolves
	// `'active'` against THAT RUN'S OWN frozen ordered-term contract, scoped to
	// `resolved.source.schoolYearId`. So the default is the PAST YEAR's own term,
	// not the current school's.
	assert.match(pastYearRoute, /requireActiveTermSelection/,
		'the past-year read defaults to the year-scoped frozen term, resolved from the requested year');

	// …and it must NOT reach for the live active-year election to pick a term. That
	// election is the CURRENT year by definition, and using it here would put the
	// current school's term axis on a past year's grid — the exact substitution C5
	// forbids. (The election IS used, but only to REFUSE the current year in the
	// scope helper — never to choose which term to display.)
	const termChoice = pastYearRoute.slice(
		pastYearRoute.indexOf('requireActiveTermSelection'),
		pastYearRoute.indexOf('getPublishedSchedulePayload'),
	);
	assert.doesNotMatch(termChoice, /resolveActiveSchoolYearElection|resolveActiveSchoolYearId/,
		'choosing WHICH TERM to display never consults the current active-year election');

	// §7 — the frozen-contract refusal is the service's, and the route must not
	// swallow it into a Term 1 substitution. The route rethrows anything that is
	// not PUBLISHED_RUN_NOT_FOUND, so TERM_STRUCTURE_UNAVAILABLE reaches the client
	// as a typed 409.
	const catchesOnlyNotPublished = pastYearRoute.match(/serviceError\?\.code === '([A-Z_]+)'/g) ?? [];
	assert.deepEqual(catchesOnlyNotPublished, ["serviceError?.code === 'PUBLISHED_RUN_NOT_FOUND'"],
		'the route converts exactly one service failure — "nothing published" — and rethrows every other typed failure, so a missing term contract cannot be laundered into a term');
});
