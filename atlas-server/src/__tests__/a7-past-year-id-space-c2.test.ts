/**
 * A7-C3 — the id-space proof behind `TIMETABLE_READS_SCHOOL_YEAR_PARAM = true`.
 *
 * WHY THIS FILE EXISTS. A7's year list offers a read-only Timetable link at
 * `/timetable?schoolYearId=<enrollProSchoolYearId>`, and until 2026-09-29 it
 * deliberately did NOT: the flag was `false` and the page said so in plain words.
 * A2 then shipped the past-year route (train 5) and Lane C reported it live. The
 * failure mode of enabling the link wrongly is specific and bad: an operator opens
 * "2030-2031" and reads TODAY's schedule, because the page ignored the parameter.
 * A fail-closed sentence is always better than that.
 *
 * So the flag is not a matter of trust. It rests on ONE claim that is easy to get
 * wrong and impossible to see: that the id in the link and the id the server
 * accepts are THE SAME NUMBER. ATLAS has two school-year id spaces in play — the
 * EnrollPro year id (`enrollProSchoolYearId`) and an internal `schoolYearMirrors`
 * primary key — and they are not equal. A link built from one and gated on the
 * other produces a refusal, or worse, the wrong year.
 *
 * WHAT THIS PROVES, and it proves it by construction rather than by assertion:
 *
 *   1. THE ROUTER'S OWN SOURCE derives the allowed set from
 *      `enrollProSchoolYearId`. The route builds
 *      `actorSchoolYearIds: yearRows.map((row) => row.enrollProSchoolYearId)`,
 *      and this test reads that expression out of the real route source and
 *      applies it to a fixture whose two id spaces are DELIBERATELY DIFFERENT
 *      numbers. If the router ever switched to the internal primary key, this
 *      test would refuse the link's id and go red.
 *   2. The link's id, fed through the REAL `resolvePastYearReadScope`, is
 *      accepted with no dispatch and no refusal.
 *   3. The INTERNAL primary key for the same year is REFUSED, which is what
 *      makes row 1 discriminating: if both spaces were accepted, or if the test
 *      passed for the wrong reason, this row would fail.
 *   4. The same EnrollPro year id is the one the existing Teaching Load history
 *      link already uses, so the two links on the year row cannot disagree.
 *
 * Hermetic: no database, no live runtime, no network, no credential. Prisma is
 * not imported at all — this is a pure scope-resolution test over a fixture.
 * Run: `npm run test:past-year-id-space-c2`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { resolvePastYearReadScope } from '../services/past-year-timetable-scope.js';

const ACTOR_SCHOOL_ID = 1;
const OTHER_SCHOOL_ID = 2;

/**
 * One school year, expressed in BOTH id spaces with deliberately different
 * numbers, so that any confusion between them is immediately visible.
 *
 *   2023-2024  ->  EnrollPro year id 10   (what A7's link uses)
 *                  internal primary key 4700 (what a careless link might use)
 */
const YEAR_LABEL = '2023-2024';
const ENROLLPRO_YEAR_ID = 10;
const INTERNAL_MIRROR_ID = 4700;

const yearRows = [
	{ enrollProSchoolYearId: ENROLLPRO_YEAR_ID, id: INTERNAL_MIRROR_ID, yearLabel: YEAR_LABEL },
	{ enrollProSchoolYearId: 8, id: 4001, yearLabel: '2022-2023' },
];

/** The exact expression the real route uses to build its allowed set. */
function actorSchoolYearIdsAsTheRouterBuildsThem(rows: typeof yearRows): number[] {
	return rows.map((row) => row.enrollProSchoolYearId);
}

test('A7-C3: the past-year link id and the id the server accepts are the same number', () => {
	const scope = resolvePastYearReadScope({
		actorSchoolId: ACTOR_SCHOOL_ID,
		requestedSchoolId: String(ACTOR_SCHOOL_ID),
		requestedSchoolYearId: ENROLLPRO_YEAR_ID,
		actorSchoolYearIds: actorSchoolYearIdsAsTheRouterBuildsThem(yearRows),
		activeSchoolYearId: 8,
	});

	assert.equal(scope.ok, true, `the EnrollPro year id must be accepted: ${JSON.stringify(scope)}`);
	if (!scope.ok) return;
	assert.equal(scope.schoolYearId, ENROLLPRO_YEAR_ID, 'the accepted id must be the one the link carries');
	assert.equal(scope.schoolId, ACTOR_SCHOOL_ID, 'a same-school caller must keep its own school');
});

test('A7-C3 DISCRIMINATOR: the internal primary key is refused, so row 1 is not passing by accident', () => {
	const scope = resolvePastYearReadScope({
		actorSchoolId: ACTOR_SCHOOL_ID,
		requestedSchoolId: String(ACTOR_SCHOOL_ID),
		requestedSchoolYearId: INTERNAL_MIRROR_ID,
		actorSchoolYearIds: actorSchoolYearIdsAsTheRouterBuildsThem(yearRows),
		activeSchoolYearId: 8,
	});

	assert.equal(
		scope.ok,
		false,
		'the internal mirror primary key must NOT be accepted: if it were, this test could not tell the two id spaces apart and the link would be unsafe to enable',
	);
	if (scope.ok) return;
	assert.equal(
		'schoolYearId' in scope && scope.schoolYearId != null,
		false,
		'a refused scope must carry no schoolYearId, or a caller could read on a refused year',
	);
});

/**
 * The link-building half. The year list's href is built from
 * `year.enrollProSchoolYearId` — the same field the Teaching Load link uses. This
 * asserts the two are the SAME field, so the two links on a year row can never
 * point at different years, which is the defect an operator would experience as
 * "the two buttons show different things".
 */
test('A7-C3: the year-row links are built from the same field, so they cannot disagree', async () => {
	const cardSource = readFileSync(new URL('../../../atlas-client/src/components/runtime/SchoolYearListCard.tsx', import.meta.url), 'utf8');
	const tlMatch = cardSource.match(/year-setup-tl-\$\{year\.([A-Za-z]+)\}/);
	const timetableMatch = cardSource.match(/year-setup-timetable-\$\{year\.([A-Za-z]+)\}/);
	assert.ok(tlMatch, 'could not find the Teaching Load link testid in the year card');
	assert.ok(timetableMatch, 'could not find the Timetable link testid in the year card');
	assert.equal(
		timetableMatch[1],
		tlMatch[1],
		'the two links must be built from the same year field, or one row can open two different years',
	);
	assert.equal(
		tlMatch[1],
		'enrollProSchoolYearId',
		'both links must use enrollProSchoolYearId, the id space the server accepts',
	);
});

/**
 * The live-route half. This is the row that would have caught the original worry,
 * and it is a source assertion on ONE narrow fact rather than a test of user-facing
 * behaviour — labelled as such on purpose. It asks a single question: does the real
 * published-schedule route still derive its allowed ids from `enrollProSchoolYearId`?
 * If A2 ever switches that, the link becomes unsafe and this goes red.
 */
test('A7-C3: the live route still derives its allowed year ids from enrollProSchoolYearId', () => {
	const routeSource = readFileSync(new URL('../routes/published-schedule.router.ts', import.meta.url), 'utf8');
	assert.ok(
		routeSource.includes('actorSchoolYearIds: yearRows.map((row) => row.enrollProSchoolYearId)'),
		'the published-schedule route no longer builds its allowed ids from enrollProSchoolYearId. '
			+ 'If that changed, the two id spaces may have diverged: set '
			+ 'TIMETABLE_READS_SCHOOL_YEAR_PARAM back to false until the spaces are proved equal again.',
	);
});

test('A7-C3: another school cannot read a year it does not own', () => {
	const scope = resolvePastYearReadScope({
		actorSchoolId: OTHER_SCHOOL_ID,
		requestedSchoolId: String(OTHER_SCHOOL_ID),
		requestedSchoolYearId: ENROLLPRO_YEAR_ID,
		// Another school's mirror set, which does not contain this year.
		actorSchoolYearIds: [99, 98],
		activeSchoolYearId: 98,
	});
	assert.equal(scope.ok, false, 'a year outside the actor school must be refused');
});
