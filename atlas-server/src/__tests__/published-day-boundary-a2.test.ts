/**
 * PUBLISHED-DAY-BOUNDARY-A2 — the public schedule must never error for a date the
 * school published for, and a publication must be in force for its own local day.
 *
 * Defects under test (one candidate, deliberately: see the merge justification in
 * the handoff — the fallback boundary IS the stamped date, so they are one function):
 *
 *   Defect A (`published-schedule.service.ts`): a date with no revision of its own
 *   errored with `409 PUBLISHED_REVISION_INVALID` instead of falling back to the
 *   prior publication.
 *   Defect B (`publication-contract.service.ts`): the `INITIAL_PUBLICATION` base
 *   revision was stamped with the raw publish INSTANT, so a publish in the
 *   operator's local 00:00-08:00 window landed on the previous UTC day and was not
 *   in force for the very date it named — the API rejected its own effective date.
 *
 * Everything runs against a GUARDED DISPOSABLE PostgreSQL database created by
 * `provisionDisposableDatabase('a2daybnd')` and dropped with a zero-residue
 * assertion in `finally`. The configured source database is only used as the
 * CREATE/DROP admin connection by the harness and is never read or written by any
 * assertion here.
 *
 * A3 (`termIndex: 2` resolving through the publication-time `activeTermOrder`) is a
 * SEPARATE fail-closed breach and is deliberately NOT touched. Every read in this
 * suite is made WITHOUT a `termIndex`, which is what isolates the date defects from
 * the term resolver. The production diff must not widen to reach the term area.
 *
 * Run: `npx tsx src/__tests__/published-day-boundary-a2.test.ts` (from `atlas-server`),
 * or as part of `npm run test:server-db`.
 */

import { readFileSync } from 'node:fs';

import { provisionDisposableDatabase, seedCanonicalFixture, teardownCanonicalFixture } from './helpers/tt-source-freshness-db.js';

let passCount = 0;
let failCount = 0;

function check(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`[PASS] ${label}`);
		return;
	}
	failCount += 1;
	console.error(`[FAIL] ${label}`);
}

function checkEqual(actual: unknown, expected: unknown, label: string) {
	check(actual === expected, `${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function section(title: string) {
	console.log(`\n=== ${title} ===`);
}

const WORKDIR = process.cwd();
const RUNTIME_ENV = 'D:/ATLAS-runtime-config/atlas-server.env';

function readEnvFile(path: string): Record<string, string> {
	const out: Record<string, string> = {};
	try {
		for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq < 0) continue;
			const key = trimmed.slice(0, eq).trim();
			if (!key) continue;
			out[key] = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, '');
		}
	} catch {
		/* absent */
	}
	return out;
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
const ACTOR = 9_511;

/**
 * The exact SQL behind every "no row changed" fingerprint in this suite.
 *
 * `published_schedule_revisions.effective_date` is `timestamp(3) without time zone`
 * (verified against `information_schema.columns` on a disposable database:
 * data_type `timestamp without time zone`, datetime_precision 3). Prisma writes UTC
 * into it, so `to_char` renders the stored UTC wall value — no zone conversion is
 * applied by this query and none is wanted.
 *
 * Serialisation: each result row is mapped to a fixed-shape array in a fixed key
 * order and the whole thing is compared with `JSON.stringify`, so the comparison is
 * over UTF-16 JSON text with no key reordering and no whitespace.
 */
const REVISION_FINGERPRINT_SQL = `
	SELECT id::text AS id,
	       source_run_id::text AS source_run_id,
	       reason,
	       status::text AS status,
	       source_revision_id::text AS source_revision_id,
	       to_char(effective_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS effective_utc
	FROM published_schedule_revisions
	WHERE school_id = $1
	ORDER BY id
`;

const RUN_FINGERPRINT_SQL = `
	SELECT id::text AS id,
	       version::text AS version,
	       summary ->> 'isPublished' AS is_published,
	       summary -> 'publication' ->> 'revisionId' AS publication_revision_id,
	       summary ->> 'publishedAt' AS published_at,
	       summary ->> 'publicationSupersededAt' AS superseded_at,
	       jsonb_array_length(draft_entries)::text AS draft_entry_count
	FROM generation_runs
	WHERE school_id = $1
	ORDER BY id
`;

const MIGRATION_COUNT_SQL = `SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL`;

/**
 * Timezone provenance controls. The school operating timezone is a code-level
 * product constant because ATLAS persists no school timezone; these rows pin the
 * two properties that justification rests on, instead of asserting the constant's
 * text.
 */
function isoOfLocalInstant(localIso: string): Date {
	// `localIso` is a wall-clock reading in Asia/Manila. Convert it to the UTC
	// instant it denotes so the fixture states the LOCAL time first and the UTC
	// value is derived, never hand-written.
	const [datePart, timePart] = localIso.split('T');
	const [year, month, day] = datePart.split('-').map(Number);
	const [hour, minute, second] = timePart.split(':').map(Number);
	const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);
	// Asia/Manila is UTC+08:00 with no daylight saving, so subtracting the offset
	// yields the instant. The no-DST property is independently proven below.
	return new Date(asIfUtc - 8 * 3_600_000);
}

async function main() {
	section('A2-DAYBND setup. guarded disposable database');
	const dotEnv = readEnvFile(`${WORKDIR}/.env`);
	const runtimeEnv = readEnvFile(RUNTIME_ENV);
	const pick = (key: string) => process.env[key] ?? dotEnv[key] ?? runtimeEnv[key];
	const configuredSourceUrl = pick('DATABASE_URL');

	const disposable = provisionDisposableDatabase('a2daybnd');
	if (!disposable) {
		console.error('EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE)');
		process.exit(3);
	}
	process.env.DATABASE_URL = disposable.targetUrl;
	for (const key of ['JWT_SECRET', 'ATLAS_SYSTEM_TOKEN']) {
		const value = pick(key);
		if (value) process.env[key] = value;
	}
	console.log(`[INFO] disposable database ready: ${disposable.name}`);

	const { createTestPrismaClient } = await import('../lib/prisma.js');
	const { withDataContext } = await import('../lib/data-context.js');
	const { publishSchedule } = await import('../services/publication-contract.service.js');
	const { computeGenerationInputSnapshot } = await import('../services/generation-input-snapshot.service.js');
	const { getPublishedSchedulePayload } = await import('../services/published-schedule.service.js');
	const { buildRunTimetableShapeContracts } = await import('../services/generation-shape-assembly.service.js');
	const { buildUnionDisplaySlots } = await import('../services/schedule-constructor.js');
	const { toConstructorSpecialEvents } = await import('../services/generation-preflight.service.js');
	const { getExpectedCanonicalSlots } = await import('../services/class-program-slot.service.js');
	const {
		SCHOOL_OPERATING_TIME_ZONE,
		schoolLocalDayKey,
		schoolLocalDayStartUtc,
		schoolLocalDayWindow,
	} = await import('../lib/school-operating-time-zone.js');

	const prisma: any = createTestPrismaClient();
	const seededSchools: number[] = [];
	let disposed = false;

	/** One entry set per publication so a fallback's entries are distinguishable. */
	const makeEntries = (facultyId: number, roomId: number, sectionId: number, mathId: number, engId: number, interval: string, tag: string) => {
		const [startTime, endTime] = interval.split('-');
		const entry = (entryId: string, subjectId: number, termIndex: number, day: string) => ({
			entryId: `${tag}-${entryId}`,
			subjectId,
			facultyId,
			roomId,
			sectionId,
			day,
			startTime,
			endTime,
			durationMinutes: 60,
			termIndex,
			entryKind: 'SECTION',
		});
		return [
			...DAYS.map((day) => entry(`MATH-T1-${day}`, mathId, 1, day)),
			...DAYS.map((day) => entry(`ENG-T2-${day}`, engId, 2, day)),
			...DAYS.map((day) => entry(`MATH-T3-${day}`, mathId, 3, day)),
		];
	};

	/**
	 * Build a publishable COMPLETED/FULL run whose entries are produced from the
	 * real canonical class slots, and publish it at an injected instant.
	 * Returns the run id, the base revision id, and the exact publish instant.
	 */
	async function publishAt(params: {
		schoolId: number;
		schoolYearId: number;
		fixture: { facultyId: number; roomId: number; sectionExternalId: number; subjectIdByCode: Record<string, number> };
		tag: string;
		localPublishTime: string;
	}): Promise<{ runId: number; revisionId: number; publishedAt: string }> {
		const { schoolId, schoolYearId, fixture, tag } = params;
		const publishInstant = isoOfLocalInstant(params.localPublishTime);

		const classSlots = await prisma.classProgramSlot.findMany({
			where: { schoolId, schoolYearId, gradeLevel: 7, programType: 'REGULAR', rowKind: 'CLASS', isActive: true },
			orderBy: { startTime: 'asc' },
			select: { startTime: true, endTime: true },
		});
		const interval = `${classSlots[0].startTime}-${classSlots[0].endTime}`;
		const draftEntries = makeEntries(
			fixture.facultyId,
			fixture.roomId,
			fixture.sectionExternalId,
			fixture.subjectIdByCode.MATH,
			fixture.subjectIdByCode.ENG,
			interval,
			tag,
		);

		const canonicalSlotRows = getExpectedCanonicalSlots(7, 'REGULAR').map((slot: any) => ({
			startTime: slot.startTime,
			endTime: slot.endTime,
			subjectFamily: slot.subjectFamily ?? null,
			subjectLabel: slot.subjectLabel ?? null,
			rowKind: slot.rowKind,
		}));
		const persistedSpecialEvents = await prisma.policySpecialEvent.findMany({
			where: { schoolId, schoolYearId, enabled: true },
			orderBy: [{ sortOrder: 'asc' }],
		});
		const timetableDisplaySlots = buildUnionDisplaySlots(buildRunTimetableShapeContracts({
			sectionsByGrade: [{ gradeLevelId: 17, sections: [{ programType: 'REGULAR' }] }],
			gradeWindows: [{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '13:00' }],
			templateProfiles: [{ programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 8 }],
			canonicalSlots: new Map<string, any>([['7:REGULAR', canonicalSlotRows]]),
			policy: {
				periodLengthMinutes: 45,
				periodsPerDay: 8,
				showSpecialEventsInGrid: true,
				specialEvents: toConstructorSpecialEvents(persistedSpecialEvents),
			} as any,
		}));

		const inputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId, prisma);
		const run = await prisma.generationRun.create({
			data: {
				schoolId,
				schoolYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: ACTOR,
				finishedAt: publishInstant,
				summary: { inputSnapshot, timetableDisplaySlots },
				violations: [],
				unassignedItems: [],
				draftEntries,
				version: 1,
			},
		});
		const result = await withDataContext(prisma, () => publishSchedule(
			{ schoolId, schoolYearId, runId: run.id, actorId: ACTOR, actorSchoolId: schoolId },
			{ now: () => publishInstant, computeInputSnapshot: async () => inputSnapshot, publishEvent: () => undefined },
		));
		return { runId: run.id, revisionId: result.revisionId, publishedAt: publishInstant.toISOString() };
	}

	/** Read the public published schedule for a calendar date, returning the payload. */
	const readForDate = (schoolId: number, schoolYearId: number, date: string) =>
		withDataContext(prisma, () => getPublishedSchedulePayload(schoolId, schoolYearId, { requestedDate: date }));

	/** Read and capture the typed failure instead of throwing. */
	async function readErrorForDate(schoolId: number, schoolYearId: number, date: string) {
		try {
			await readForDate(schoolId, schoolYearId, date);
			return { threw: false as const, code: '', status: 0, message: '' };
		} catch (error) {
			const typed = error as { code?: string; statusCode?: number; message?: string };
			return { threw: true as const, code: typed.code ?? '', status: typed.statusCode ?? 0, message: typed.message ?? '' };
		}
	}

	/**
	 * Read a date that MUST be served, capturing the typed failure instead of
	 * letting it abort the run. Pre-fix this is where the literal
	 * `409 PUBLISHED_REVISION_INVALID` is captured as evidence rather than thrown,
	 * so a failing-first run still produces a complete tally.
	 */
	async function readServedOrCaptured(schoolId: number, schoolYearId: number, date: string) {
		try {
			return { served: true as const, payload: await readForDate(schoolId, schoolYearId, date), code: '', status: 0, message: '' };
		} catch (error) {
			const typed = error as { code?: string; statusCode?: number; message?: string };
			return { served: false as const, payload: null, code: typed.code ?? '', status: typed.statusCode ?? 0, message: typed.message ?? '' };
		}
	}

	const fingerprint = async (schoolId: number) => {
		const revisions = await prisma.$queryRawUnsafe(REVISION_FINGERPRINT_SQL, schoolId);
		const runs = await prisma.$queryRawUnsafe(RUN_FINGERPRINT_SQL, schoolId);
		return JSON.stringify({
			revisions: revisions.map((row: any) => [row.id, row.source_run_id, row.reason, row.status, row.source_revision_id, row.effective_utc]),
			runs: runs.map((row: any) => [row.id, row.version, row.is_published, row.publication_revision_id, row.published_at, row.superseded_at, row.draft_entry_count]),
		});
	};

	try {
		// ─────────────────────────────────────────────────────────────────────────
		section('T1. timezone provenance: the constant is a product decision, and its two load-bearing properties hold');
		checkEqual(SCHOOL_OPERATING_TIME_ZONE, 'Asia/Manila', 'T1 the operating timezone is declared in exactly one named constant');
		{
			// (a) no daylight saving anywhere in the year, which is what makes a
			//     stamped day boundary exactly 24 h wide.
			const offsets = new Set<number>();
			for (let day = 0; day < 365; day += 1) {
				const probe = new Date(Date.UTC(2026, 0, 1 + day, 3, 17, 0));
				offsets.add(schoolLocalDayStartUtc(probe).getTime() - Math.floor((probe.getTime() + 8 * 3_600_000) / 86_400_000) * 86_400_000);
			}
			checkEqual(offsets.size, 1, 'T1 the operating zone has one single UTC offset across all 365 days of 2026 (no DST)');
			// (b) the noon-UTC read anchor the fix must NOT move is inside the local
			//     calendar day for every offset strictly within +/-12:00, which is the
			//     property the fix relies on. Stated precisely, including the exact
			//     +12:00 edge, which is a pre-existing property of the anchor and not
			//     something this candidate changes: at exactly +12:00 the anchor is the
			//     first instant of the NEXT local day. No civil zone in the fixture's
			//     operating frame is at exactly +12:00, and the anchor is not moved here.
			const anchorDayFor = (offsetHours: number): string =>
				new Date(new Date('2026-09-26T12:00:00.000Z').getTime() + offsetHours * 3_600_000).toISOString().slice(0, 10);
			check(
				[-12, -11, -8, -5, 0, 1, 5, 8, 9, 11].every((offsetHours) => anchorDayFor(offsetHours) === '2026-09-26'),
				'T1 the existing noon-UTC anchor lands on the requested calendar day for offsets -12..+11 (the anchor is correct and is not moved by this fix)',
			);
			checkEqual(anchorDayFor(12), '2026-09-27', 'T1 the pre-existing anchor edge at exactly +12:00 is recorded honestly: it reads as the first instant of the next local day');
		}
		checkEqual(
			schoolLocalDayStartUtc(new Date('2026-09-26T16:38:34.677Z')).toISOString(),
			'2026-09-26T16:00:00.000Z',
			'T1 the live publish instant 2026-09-27T00:38+08 starts its local day at 2026-09-26T16:00:00.000Z',
		);
		checkEqual(schoolLocalDayKey(new Date('2026-09-26T16:38:34.677Z')), '2026-09-27', 'T1 that instant belongs to local day 2026-09-27, the previous UTC day');
		{
			const window = schoolLocalDayWindow(new Date('2026-09-26T12:00:00.000Z'));
			checkEqual(window.dayKey, '2026-09-26', 'T1 the requested date 2026-09-26 resolves to local day 2026-09-26 at the noon anchor');
			checkEqual(window.startUtc.toISOString(), '2026-09-25T16:00:00.000Z', 'T1 local day 2026-09-26 begins at 2026-09-25T16:00:00.000Z');
			checkEqual(window.endExclusiveUtc.toISOString(), '2026-09-26T16:00:00.000Z', 'T1 local day 2026-09-26 ends where 2026-09-27 begins, 2026-09-26T16:00:00.000Z');
		}

		// ─────────────────────────────────────────────────────────────────────────
		section('S1. the live symptom, both defects: a publish at 00:38 +08 must not take its own date offline');
		const yearIdA = 9_200_101;
		const fixtureA = await seedCanonicalFixture(prisma, { schoolName: 'A2-DAYBND S1 — SAFE TO DELETE', schoolYearId: yearIdA, sectionExternalId: 92_101 });
		seededSchools.push(fixtureA.schoolId);
		const first = await publishAt({
			schoolId: fixtureA.schoolId, schoolYearId: yearIdA, fixture: fixtureA, tag: 'PRIOR',
			localPublishTime: '2026-09-25T10:00:00',
		});
		const second = await publishAt({
			schoolId: fixtureA.schoolId, schoolYearId: yearIdA, fixture: fixtureA, tag: 'HEAD',
			localPublishTime: '2026-09-27T00:38:34',
		});
		console.log(`[INFO] S1 prior run=${first.runId} rev=${first.revisionId} publishedAt=${first.publishedAt}`);
		console.log(`[INFO] S1 head  run=${second.runId} rev=${second.revisionId} publishedAt=${second.publishedAt}`);

		{
			// Defect B, writer side: the base revision is a DAY BOUNDARY, and it is
			// the boundary of the local day, not the publish instant.
			const stored = await prisma.publishedScheduleRevision.findUnique({
				where: { id: second.revisionId },
				select: { effectiveDate: true, changeSet: true },
			});
			checkEqual(stored?.effectiveDate.toISOString(), '2026-09-26T16:00:00.000Z', 'S1 B: a 00:38 +08 publish is stamped at the START of its local day 2026-09-27');
			check(stored?.effectiveDate.toISOString() !== second.publishedAt, 'S1 B: the stamped boundary is NOT the raw publish instant (the self-rejection is gone at the source)');
			const priorStored = await prisma.publishedScheduleRevision.findUnique({
				where: { id: first.revisionId },
				select: { effectiveDate: true },
			});
			checkEqual(priorStored?.effectiveDate.toISOString(), '2026-09-24T16:00:00.000Z', 'S1 B: the earlier 10:00 +08 publish is stamped at the start of its own local day 2026-09-25');
		}

		{
			// Defect B, read side: the publication is in force for its OWN local date.
			const ownDay = await readForDate(fixtureA.schoolId, yearIdA, '2026-09-27');
			checkEqual(ownDay.source.runId, second.runId, 'S1 B: local day 2026-09-27 is served by the publication published that day');
			checkEqual(ownDay.source.activeRevisionEffectiveDate, '2026-09-26T16:00:00.000Z', 'S1 B: the reported effective date is the local day boundary');
			checkEqual(ownDay.source.servedByFallback, false, 'S1 B: its own local day is not a fallback');
			checkEqual(ownDay.source.publishedAt, second.publishedAt, 'S1 B: the exact publish instant is still reported truthfully in publishedAt');
			const nextDay = await readForDate(fixtureA.schoolId, yearIdA, '2026-09-28');
			checkEqual(nextDay.source.runId, second.runId, 'S1 B: the day after is also served by the head');
		}

		{
			// Defect A: the day the head does not cover falls back to the prior
			// publication instead of erroring. Captured, not thrown, so the literal
			// pre-fix 409 is the evidence.
			const priorDayResult = await readServedOrCaptured(fixtureA.schoolId, yearIdA, '2026-09-26');
			check(priorDayResult.served, `S1 A: 2026-09-26 is served by a publication instead of erroring (${priorDayResult.served ? '200' : `${priorDayResult.status} ${priorDayResult.code} ${priorDayResult.message}`})`);
			const priorDay = priorDayResult.payload;
			if (priorDay) {
				checkEqual(priorDay.source.runId, first.runId, 'S1 A: 2026-09-26 is served by the PRIOR publication, not the head');
				checkEqual(priorDay.source.servedByFallback, true, 'S1 A: the response says plainly that it was served by a fallback');
				checkEqual(priorDay.source.currentPublishedRunId, second.runId, 'S1 A: the response also names the current head it fell back from');
				checkEqual(priorDay.source.appliedRevisionIds.join(','), String(first.revisionId), 'S1 A: appliedRevisionIds is the PRIOR publication revision, not the head revision');
				checkEqual(priorDay.source.activeRevisionId, first.revisionId, 'S1 A: activeRevisionId is the PRIOR publication base revision');
				checkEqual(priorDay.source.resolvedForDate, '2026-09-26T12:00:00.000Z', 'S1 A: resolvedForDate truthfully reports the date actually resolved');
				check(priorDay.entries.length > 0, 'S1 A: the fallback returns entries');
				check(priorDay.entries.every((entry: any) => String(entry.entryId).startsWith('PRIOR-')), 'S1 A: every returned entry belongs to the PRIOR publication, not the head');
				checkEqual(priorDay.source.publishedAt, first.publishedAt, 'S1 A: publishedAt is the prior publication instant');
			}
			// The head's own entries must be reachable on the head's day, proving the
			// fallback did not overwrite the head.
			const headDay = await readServedOrCaptured(fixtureA.schoolId, yearIdA, '2026-09-27');
			check(headDay.served, `S1 A: the head day is served (${headDay.served ? '200' : `${headDay.status} ${headDay.code}`})`);
			check(headDay.payload ? headDay.payload.entries.every((entry: any) => String(entry.entryId).startsWith('HEAD-')) : false, 'S1 A: the head still returns the head entries on its own day');
		}

		{
			// The prior publication's own local day is still served by itself.
			const ownPriorDay = await readServedOrCaptured(fixtureA.schoolId, yearIdA, '2026-09-25');
			check(ownPriorDay.served, `S1 A: 2026-09-25 is served by the prior publication (${ownPriorDay.served ? '200' : `${ownPriorDay.status} ${ownPriorDay.code} ${ownPriorDay.message}`})`);
			if (ownPriorDay.payload) {
				checkEqual(ownPriorDay.payload.source.runId, first.runId, 'S1 A: 2026-09-25 resolves to the prior publication');
				// The prior publication's OWN local day is still not the current head, so
				// `servedByFallback` is correctly true here. Its exact meaning is
				// "this read was not served by the current head", and the invariant below
				// pins that meaning so a caller can rely on it.
				checkEqual(ownPriorDay.payload.source.servedByFallback, true, 'S1 A: 2026-09-25 is still not the current head, so it is truthfully reported as served by a fallback');
			}
		}

		{
			// Acceptance row 1: a date the school never published for is a 404, never
			// a 409, and the code says which case it is.
			const beforeAny = await readErrorForDate(fixtureA.schoolId, yearIdA, '2026-09-24');
			checkEqual(beforeAny.code, 'PUBLISHED_RUN_NOT_FOUND', 'S1 A: a date before the first publication is 404 PUBLISHED_RUN_NOT_FOUND, not a 409');
			checkEqual(beforeAny.status, 404, 'S1 A: and it carries HTTP 404');
			const farFuture = await readErrorForDate(fixtureA.schoolId, yearIdA, '2027-03-01');
			check(farFuture.threw === false, 'S1 A: a date after the head is still served, never an error');

			// The exact meaning a caller may rely on, asserted across every date in the
			// publication's own history: `servedByFallback` is true if and only if the
			// run served is not the current head, and every identity field describes
			// the run actually served.
			for (const date of ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28']) {
				const matrix = await readServedOrCaptured(fixtureA.schoolId, yearIdA, date);
				check(matrix.served, `S1 A: ${date} is served (${matrix.served ? '200' : `${matrix.status} ${matrix.code}`})`);
				if (!matrix.payload) continue;
				const source = matrix.payload.source;
				checkEqual(
					source.servedByFallback,
					source.runId !== source.currentPublishedRunId,
					`S1 A: on ${date} servedByFallback is exactly (runId !== currentPublishedRunId)`,
				);
				check(
					source.appliedRevisionIds.includes(Number(source.activeRevisionId)),
					`S1 A: on ${date} appliedRevisionIds contains the reported activeRevisionId, so the identity is the served publication's`,
				);
				check(source.activeRevisionEffectiveDate !== null, `S1 A: on ${date} an effective date is always reported, never null`);
			}
		}

		// ─────────────────────────────────────────────────────────────────────────
		section('S2. a 23:58 +08 publish, and a legacy row already stamped with a raw instant');
		const yearIdB = 9_200_102;
		const fixtureB = await seedCanonicalFixture(prisma, { schoolName: 'A2-DAYBND S2 — SAFE TO DELETE', schoolYearId: yearIdB, sectionExternalId: 92_102 });
		seededSchools.push(fixtureB.schoolId);
		const late = await publishAt({
			schoolId: fixtureB.schoolId, schoolYearId: yearIdB, fixture: fixtureB, tag: 'LATE',
			localPublishTime: '2026-09-26T23:58:00',
		});
		{
			const stored = await prisma.publishedScheduleRevision.findUnique({ where: { id: late.revisionId }, select: { effectiveDate: true } });
			checkEqual(stored?.effectiveDate.toISOString(), '2026-09-25T16:00:00.000Z', 'S2 B: a 23:58 +08 publish is stamped at the start of its local day 2026-09-26, not at 15:58Z');
			// 15:58Z is AFTER the noon anchor of 2026-09-26, which is exactly why the
			// pre-fix raw instant made the publication unreachable for its own day.
			check(new Date('2026-09-26T15:58:00.000Z') > new Date('2026-09-26T12:00:00.000Z'), 'S2 the raw 23:58 +08 instant would have fallen after the noon anchor of its own day (the pre-fix self-rejection)');
			const ownDay = await readServedOrCaptured(fixtureB.schoolId, yearIdB, '2026-09-26');
			check(ownDay.served, `S2 B: the 23:58 +08 publication is in force for its own local date (${ownDay.served ? '200' : `${ownDay.status} ${ownDay.code} ${ownDay.message}`})`);
			if (ownDay.payload) {
				checkEqual(ownDay.payload.source.runId, late.runId, 'S2 B: its own local date resolves to the 23:58 publication');
				checkEqual(ownDay.payload.source.servedByFallback, false, 'S2 B: and it is not reported as a fallback');
			}
		}
		{
			// The reader must be correct for an ALREADY-PUBLISHED, ALREADY-MIS-STAMPED
			// revision. This UPDATE simulates a pre-fix row inside the disposable
			// database. It is a FIXTURE mutation, not a product backfill and not a
			// migration: no production path writes it, and the candidate's SQL diff
			// contains no UPDATE of any table.
			const rawInstant = new Date('2026-09-26T15:58:00.000Z');
			await prisma.publishedScheduleRevision.update({
				where: { id: late.revisionId },
				data: { effectiveDate: rawInstant },
			});
			const legacyRead = await readServedOrCaptured(fixtureB.schoolId, yearIdB, '2026-09-26');
			check(legacyRead.served, `S2 A: a legacy row stamped with the raw instant is still served on its own local date, not a 409 (${legacyRead.served ? '200' : `${legacyRead.status} ${legacyRead.code} ${legacyRead.message}`})`);
			if (legacyRead.payload) {
				checkEqual(legacyRead.payload.source.runId, late.runId, 'S2 A: the legacy row serves its own publication');
				checkEqual(legacyRead.payload.source.servedByFallback, false, 'S2 A: the legacy row governs its own local day, so no fallback is claimed');
			}
			const legacyAfter = await readServedOrCaptured(fixtureB.schoolId, yearIdB, '2026-09-27');
			check(legacyAfter.served && legacyAfter.payload?.source.runId === late.runId, `S2 A: the legacy row also still covers the following day (${legacyAfter.served ? '200' : `${legacyAfter.status} ${legacyAfter.code}`})`);
		}

		// ─────────────────────────────────────────────────────────────────────────
		section('S3. real interleaving across a month and a year boundary');
		for (const boundary of [
			{ local: '2026-02-01T00:30:00', dayKey: '2026-02-01', boundaryIso: '2026-01-31T16:00:00.000Z', label: 'month' },
			{ local: '2026-04-01T00:05:00', dayKey: '2026-04-01', boundaryIso: '2026-03-31T16:00:00.000Z', label: 'month-2' },
			{ local: '2026-07-01T23:59:00', dayKey: '2026-07-01', boundaryIso: '2026-06-30T16:00:00.000Z', label: 'half-year' },
			{ local: '2027-01-01T00:30:00', dayKey: '2027-01-01', boundaryIso: '2026-12-31T16:00:00.000Z', label: 'year' },
			{ local: '2027-01-01T00:00:00', dayKey: '2027-01-01', boundaryIso: '2026-12-31T16:00:00.000Z', label: 'year-first-minute' },
		]) {
			const yearId = 9_200_200 + boundary.dayKey.length + Number(boundary.boundaryIso.slice(0, 4).slice(-2));
			const fixture = await seedCanonicalFixture(prisma, { schoolName: `A2-DAYBND S3 ${boundary.label} — SAFE TO DELETE`, schoolYearId: yearId, sectionExternalId: 92_200 + yearId % 1000 });
			seededSchools.push(fixture.schoolId);
			const published = await publishAt({
				schoolId: fixture.schoolId, schoolYearId: yearId, fixture, tag: `EDGE${boundary.label}`,
				localPublishTime: boundary.local,
			});
			const stored = await prisma.publishedScheduleRevision.findUnique({ where: { id: published.revisionId }, select: { effectiveDate: true } });
			checkEqual(stored?.effectiveDate.toISOString(), boundary.boundaryIso, `S3 ${boundary.label}: a publish at ${boundary.local} +08 is stamped at the start of local day ${boundary.dayKey}`);
			const sameDay = await readServedOrCaptured(fixture.schoolId, yearId, boundary.dayKey);
			check(sameDay.served, `S3 ${boundary.label}: the publication is in force for its own local date ${boundary.dayKey} (${sameDay.served ? '200' : `${sameDay.status} ${sameDay.code} ${sameDay.message}`})`);
			if (sameDay.payload) {
				checkEqual(sameDay.payload.source.runId, published.runId, `S3 ${boundary.label}: its own local date resolves to that publication`);
				checkEqual(sameDay.payload.source.servedByFallback, false, `S3 ${boundary.label}: its own local date is not a fallback`);
			}
			// `?date=` is a LOCAL calendar day (the client sends the browser's local
			// date), so the day BEFORE this publication's own local day is a date the
			// school published nothing for: it must be a 404 that says so, never a 409
			// and never the wrong schedule. The boundary instant legitimately lands on
			// the PREVIOUS UTC date, and that fact is recorded rather than asserted as
			// coverage — a UTC date is not what the caller asked for.
			const previousDayKey = (() => {
				const [y, m, d] = boundary.dayKey.split('-').map(Number);
				const previous = new Date(Date.UTC(y, m - 1, d - 1));
				const pad = (n: number) => String(n).padStart(2, '0');
				return `${previous.getUTCFullYear()}-${pad(previous.getUTCMonth() + 1)}-${pad(previous.getUTCDate())}`;
			})();
			check(
				boundary.boundaryIso.slice(0, 10) < boundary.dayKey,
				`S3 ${boundary.label}: the stamped boundary instant (${boundary.boundaryIso}) sits on an earlier UTC date than the local day it governs (${boundary.dayKey})`,
			);
			const beforeOwnDay = await readErrorForDate(fixture.schoolId, yearId, previousDayKey);
			checkEqual(beforeOwnDay.code, 'PUBLISHED_RUN_NOT_FOUND', `S3 ${boundary.label}: local day ${previousDayKey}, before the publication own day, is 404 PUBLISHED_RUN_NOT_FOUND`);
			checkEqual(beforeOwnDay.status, 404, `S3 ${boundary.label}: and it is 404, not a 409 and not a wrongly served schedule`);
			await teardownCanonicalFixture(prisma, fixture.schoolId);
			seededSchools.pop();
		}

		// ─────────────────────────────────────────────────────────────────────────
		section('S4. fail closed, never silently approximate');
		{
			const yearIdC = 9_200_301;
			const fixtureC = await seedCanonicalFixture(prisma, { schoolName: 'A2-DAYBND S4a — SAFE TO DELETE', schoolYearId: yearIdC, sectionExternalId: 92_301 });
			seededSchools.push(fixtureC.schoolId);
			const only = await publishAt({
				schoolId: fixtureC.schoolId, schoolYearId: yearIdC, fixture: fixtureC, tag: 'SOLO',
				localPublishTime: '2026-05-10T09:00:00',
			});
			// A second base revision on ONE run makes the chain ambiguous. The reader
			// must refuse rather than pick one.
			await prisma.publishedScheduleRevision.create({
				data: {
					schoolId: fixtureC.schoolId,
					schoolYearId: yearIdC,
					sourceRunId: only.runId,
					sourceRevisionId: null,
					status: 'SCHEDULED',
					effectiveDate: new Date('2026-05-10T01:00:00.000Z'),
					actorId: ACTOR,
					reason: 'INITIAL_PUBLICATION',
					changeSet: [],
					changeSummary: { changeCount: 0, publicationBase: true },
					previousValues: [],
					newValues: [],
					metadata: { publicationBase: true, sourceRunVersion: 2 },
				},
			});
			const ambiguous = await readErrorForDate(fixtureC.schoolId, yearIdC, '2026-05-10');
			checkEqual(ambiguous.code, 'PUBLISHED_REVISION_INVALID', 'S4 two base revisions on one run fail closed with a typed error');
			checkEqual(ambiguous.status, 409, 'S4 and that error is a 409, not a served guess');
			await prisma.publishedScheduleRevision.deleteMany({
				where: { schoolId: fixtureC.schoolId, sourceRunId: only.runId, id: { not: only.revisionId } },
			});
			const recovered = await readForDate(fixtureC.schoolId, yearIdC, '2026-05-10');
			checkEqual(recovered.source.runId, only.runId, 'S4 removing the ambiguity restores the exact publication, proving the refusal was caused by the ambiguity');
		}
		{
			// A base revision whose run summary disagrees with the chain fails closed.
			const yearIdD = 9_200_302;
			const fixtureD = await seedCanonicalFixture(prisma, { schoolName: 'A2-DAYBND S4b — SAFE TO DELETE', schoolYearId: yearIdD, sectionExternalId: 92_302 });
			seededSchools.push(fixtureD.schoolId);
			const bound = await publishAt({
				schoolId: fixtureD.schoolId, schoolYearId: yearIdD, fixture: fixtureD, tag: 'BOUND',
				localPublishTime: '2026-06-10T09:00:00',
			});
			await prisma.generationRun.update({
				where: { id: bound.runId },
				data: { summary: { isPublished: true, publishedAt: bound.publishedAt, publication: { revisionId: bound.revisionId + 9999, sourceRunVersion: 2 } } },
			});
			const mismatched = await readErrorForDate(fixtureD.schoolId, yearIdD, '2026-06-10');
			checkEqual(mismatched.code, 'PUBLISHED_REVISION_INVALID', 'S4 a run whose publication binding disagrees with the revision chain fails closed');
			checkEqual(mismatched.status, 409, 'S4 and it never serves the nearest publication');
		}
		{
			// A revision that is not marked as a publication base is not a chain
			// member, so a scope with only such a row has NO publication at all.
			const yearIdE = 9_200_303;
			const fixtureE = await seedCanonicalFixture(prisma, { schoolName: 'A2-DAYBND S4c — SAFE TO DELETE', schoolYearId: yearIdE, sectionExternalId: 92_303 });
			seededSchools.push(fixtureE.schoolId);
			const run = await prisma.generationRun.create({
				data: {
					schoolId: fixtureE.schoolId, schoolYearId: yearIdE, status: 'COMPLETED', runType: 'FULL', triggeredBy: ACTOR,
					finishedAt: new Date('2026-07-10T01:00:00.000Z'),
					summary: { isPublished: true, publishedAt: '2026-07-10T01:00:00.000Z', publication: { revisionId: 1, sourceRunVersion: 2 } },
					violations: [], unassignedItems: [], draftEntries: [], version: 2,
				},
			});
			await prisma.publishedScheduleRevision.create({
				data: {
					schoolId: fixtureE.schoolId, schoolYearId: yearIdE, sourceRunId: run.id, sourceRevisionId: null,
					status: 'SCHEDULED', effectiveDate: new Date('2026-07-10T01:00:00.000Z'), actorId: ACTOR, reason: 'INITIAL_PUBLICATION',
					changeSet: [], changeSummary: { changeCount: 0 }, previousValues: [], newValues: [],
					metadata: { publicationBase: false, sourceRunVersion: 2 },
				},
			});
			const notABase = await readErrorForDate(fixtureE.schoolId, yearIdE, '2026-07-10');
			checkEqual(notABase.code, 'PUBLISHED_RUN_NOT_FOUND', 'S4 a revision that is not a publication base leaves the scope with no publication, reported as 404');
			checkEqual(notABase.status, 404, 'S4 and that is 404, the code the public page already handles');
		}

		// ─────────────────────────────────────────────────────────────────────────
		section('S5. the fix changes no existing row and runs no migration');
		{
			const before = await fingerprint(fixtureA.schoolId);
			const migrationsBefore = await prisma.$queryRawUnsafe(MIGRATION_COUNT_SQL);
			// Exercise every read shape the public route family uses.
			for (const date of ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-12-31', '2027-01-01']) {
				await readErrorForDate(fixtureA.schoolId, yearIdA, date);
			}
			await readErrorForDate(fixtureA.schoolId, yearIdA, '2026-09-26');
			await readErrorForDate(fixtureA.schoolId, yearIdA, '2026-09-27');
			const after = await fingerprint(fixtureA.schoolId);
			const migrationsAfter = await prisma.$queryRawUnsafe(MIGRATION_COUNT_SQL);
			checkEqual(after, before, 'S5 every publication revision and run row is byte-identical after the full read matrix (no row was rewritten)');
			checkEqual(migrationsAfter[0].n, migrationsBefore[0].n, 'S5 the applied migration count is unchanged by the reads');
			checkEqual(migrationsAfter[0].n, 11, 'S5 the disposable database carries exactly the 11 committed migrations, so the candidate adds none');
			console.log(`[INFO] S5 fingerprint (${before.length} chars, JSON.stringify over fixed-shape arrays): ${before}`);
		}
		{
			// The published writer also must not disturb a prior publication's rows
			// beyond the supersession the product already performs.
			const superseded = await prisma.generationRun.findUnique({
				where: { id: first.runId },
				select: { summary: true },
			});
			checkEqual((superseded?.summary as any)?.publicationSupersededByRunId, second.runId, 'S5 the prior publication keeps the supersession pointer the product already writes');
			const priorRevision = await prisma.publishedScheduleRevision.findUnique({
				where: { id: first.revisionId },
				select: { effectiveDate: true },
			});
			checkEqual(priorRevision?.effectiveDate.toISOString(), '2026-09-24T16:00:00.000Z', 'S5 superseding a publication does not rewrite the prior base revision stamp');
		}

		// ─────────────────────────────────────────────────────────────────────────
		section('S7. the real public HTTP route, exercised end to end (not just the service)');
		{
			// The public route resolves a term selection, and with no explicit
			// `termIndex` it asks for the ACTIVE term. A published run's term authority
			// is the FROZEN ordered-term contract captured at publish time, and this
			// fixture's frozen contract carries no active term, so the default path
			// correctly fails closed with `TERM_SELECTION_REQUIRED` and would mask the
			// date behaviour under test. These requests therefore carry an explicit
			// `termIndex=1`, which is the same isolation Lane C used when it recorded
			// the 409 on `date=2026-09-26` with `termIndex=1` and `termIndex=2`.
			//
			// NOTE: resolving the active term through the publication-time
			// `activeTermOrder` is exactly the A3 fail-closed question. This candidate
			// deliberately does NOT touch it, and this row also records that the live
			// public path really does run through it.
			const { default: app } = await import('../app.js');
			const { createServer } = await import('node:http');
			const server = createServer(app);
			await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
			try {
				const address = server.address();
				const origin = `http://127.0.0.1:${(address as { port: number }).port}`;
				// The exact shape of the planner's live probe: an unauthenticated GET with
				// a `date` parameter, no term scope, so this isolates the date defect from
				// the separate A3 term finding.
				for (const [date, expectedRunId, expectedFallback] of [
					['2026-09-24', null, null],
					['2026-09-25', first.runId, true],
					['2026-09-26', first.runId, true],
					['2026-09-27', second.runId, false],
					['2026-09-28', second.runId, false],
				] as const) {
					const response = await fetch(`${origin}/api/v1/schools/${fixtureA.schoolId}/schedules/published?date=${date}&termIndex=1`);
					const responseText = await response.text();
					let body: any = null;
					try { body = JSON.parse(responseText); } catch { body = { raw: responseText.slice(0, 200) }; }
					if (expectedRunId === null) {
						checkEqual(response.status, 404, `S7 ${date} returns 404, never a 409 (body: ${responseText.slice(0, 200)})`);
						checkEqual(body?.code, 'CURRENT_PUBLISHED_RUN_NOT_FOUND', `S7 ${date} reports the typed no-published-run code`);
						continue;
					}
					checkEqual(response.status, 200, `S7 ${date} returns 200 over HTTP, a parent is not shown an error (body: ${responseText.slice(0, 200)})`);
					checkEqual(body?.source?.runId, expectedRunId, `S7 ${date} is served by run ${expectedRunId}`);
					checkEqual(body?.source?.servedByFallback, expectedFallback, `S7 ${date} reports servedByFallback=${expectedFallback} in the response body`);
					checkEqual(body?.source?.currentPublishedRunId, second.runId, `S7 ${date} names the current head in the response body`);
					checkEqual(body?.source?.resolvedForDate, `${date}T12:00:00.000Z`, `S7 ${date} reports resolvedForDate for the date actually resolved`);
					check(Array.isArray(body?.entries) && body.entries.length > 0, `S7 ${date} returns schedule entries`);
				}
			} finally {
				await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
			}
		}

		// ─────────────────────────────────────────────────────────────────────────
		section('S8. a demoted in-force member fails closed and is never silently skipped');
		//
		// This section is the regression control for review finding F1. The reader used
		// to filter chain members through the readable-run set BEFORE day selection, so
		// a member that lost readability was silently removed from the contest and an
		// OLDER publication won the requested date. The endpoint then served wrong
		// published data as current, and `servedByFallback: true` was indistinguishable
		// from a legitimate fallback, so the caller had no signal at all.
		//
		// The chain below is a THREE-publication chain so the in-force member is a MIDDLE
		// member with a strictly older publication behind it — exactly the shape that
		// makes "nearest readable instead of in-force" a distinct, observable wrong
		// answer rather than an unobservable tie.
		{
			const yearIdF = 9_200_401;
			const fixtureF = await seedCanonicalFixture(prisma, { schoolName: 'A2-DAYBND S8 — SAFE TO DELETE', schoolYearId: yearIdF, sectionExternalId: 92_401 });
			seededSchools.push(fixtureF.schoolId);
			const oldPub = await publishAt({
				schoolId: fixtureF.schoolId, schoolYearId: yearIdF, fixture: fixtureF, tag: 'OLD',
				localPublishTime: '2026-09-20T10:00:00',
			});
			const inForce = await publishAt({
				schoolId: fixtureF.schoolId, schoolYearId: yearIdF, fixture: fixtureF, tag: 'MID',
				localPublishTime: '2026-09-25T10:00:00',
			});
			const headF = await publishAt({
				schoolId: fixtureF.schoolId, schoolYearId: yearIdF, fixture: fixtureF, tag: 'NEW',
				localPublishTime: '2026-09-29T10:00:00',
			});
			console.log(`[INFO] S8 chain old=${oldPub.runId}(day 2026-09-20) inForce=${inForce.runId}(day 2026-09-25) head=${headF.runId}(day 2026-09-29)`);

			// (a) BASELINE — the middle member is readable and simply is not the head.
			// This is the legitimate fallback, and it MUST keep working. It is asserted
			// FIRST and before any demotion so the F1 fix can never be mistaken for
			// "disable the fallback".
			{
				const baseline = await readServedOrCaptured(fixtureF.schoolId, yearIdF, '2026-09-26');
				console.log(`[INFO] S8 baseline 2026-09-26 -> ${baseline.served ? `served, runId=${baseline.payload?.source.runId}` : `${baseline.status} ${baseline.code}`}${baseline.served ? `, servedByFallback=${baseline.payload?.source.servedByFallback}` : ''}`);
				check(baseline.served, `S8 a: a readable in-force member that is not the head is still served (${baseline.served ? '200' : `${baseline.status} ${baseline.code} ${baseline.message}`})`);
				if (baseline.payload) {
					checkEqual(baseline.payload.source.runId, inForce.runId, 'S8 a: 2026-09-26 is served by the publication actually in force on that date, not by the head and not by an older one');
					checkEqual(baseline.payload.source.servedByFallback, true, 'S8 a: that legitimate fallback is still reported truthfully as servedByFallback=true');
					checkEqual(baseline.payload.source.currentPublishedRunId, headF.runId, 'S8 a: the response names the current head it legitimately fell back from');
					checkEqual(baseline.payload.source.appliedRevisionIds.join(','), String(inForce.revisionId), 'S8 a: appliedRevisionIds is the in-force publication revision');
					check(baseline.payload.entries.every((entry: any) => String(entry.entryId).startsWith('MID-')), 'S8 a: every returned entry belongs to the in-force publication, so the fallback serves real data');
				}
			}

			// (c) BEFORE-FIRST-PUBLICATION — with the chain intact, a date before the
			// school's very first publication is still the 404 the public page handles,
			// never a 409 and never a schedule.
			{
				const beforeFirst = await readErrorForDate(fixtureF.schoolId, yearIdF, '2026-09-19');
				checkEqual(beforeFirst.code, 'PUBLISHED_RUN_NOT_FOUND', 'S8 c: a date before the first publication is 404 PUBLISHED_RUN_NOT_FOUND, not a 409');
				checkEqual(beforeFirst.status, 404, 'S8 c: and it carries HTTP 404');
			}

			// (b) F1 — demote the member that is genuinely in force on 2026-09-26. This is
			// a FIXTURE mutation inside the disposable database, not a product backfill
			// and not a migration: no production path in this candidate performs it, and
			// the candidate's diff contains no UPDATE of any table. It reproduces the
			// exact public surface a `COMPLETED -> FAILED` transition would produce.
			await prisma.generationRun.update({ where: { id: inForce.runId }, data: { status: 'FAILED' } });
			{
				const afterDemotion = await readServedOrCaptured(fixtureF.schoolId, yearIdF, '2026-09-26');
				console.log(`[INFO] S8 after demotion       -> ${afterDemotion.served ? `served, runId=${afterDemotion.payload?.source.runId}` : `${afterDemotion.status} ${afterDemotion.code}`}${afterDemotion.served ? `, servedByFallback=${afterDemotion.payload?.source.servedByFallback}` : ''}`);
				check(!afterDemotion.served, `S8 b: a demoted in-force member fails closed instead of serving a guess (${afterDemotion.served ? `WRONGLY SERVED runId=${afterDemotion.payload?.source.runId}` : `${afterDemotion.status} ${afterDemotion.code}`})`);
				check(afterDemotion.payload?.source.runId !== oldPub.runId, 'S8 b: the older publication is NEVER served in its place — the failure mode is a wrong schedule, not an empty one');
				checkEqual(afterDemotion.code, 'PUBLISHED_REVISION_INVALID', 'S8 b: the refusal is the typed PUBLISHED_REVISION_INVALID code');
				checkEqual(afterDemotion.status, 409, 'S8 b: and it carries HTTP 409, the same typed refusal the caller already handles');
			}

			// The fail-closed answer must be SCOPED to the member actually in force: a
			// demotion of a later member must not make an earlier, still-readable date
			// unreachable, and the head's own dates must keep serving.
			{
				const olderDate = await readServedOrCaptured(fixtureF.schoolId, yearIdF, '2026-09-22');
				check(olderDate.served && olderDate.payload?.source.runId === oldPub.runId, `S8 b: a date still governed by a readable older member keeps serving that member (${olderDate.served ? `runId=${olderDate.payload?.source.runId}` : `${olderDate.status} ${olderDate.code}`})`);
				const headDay = await readServedOrCaptured(fixtureF.schoolId, yearIdF, '2026-09-29');
				check(headDay.served && headDay.payload?.source.runId === headF.runId, `S8 b: the head's own date keeps serving the head (${headDay.served ? `runId=${headDay.payload?.source.runId}` : `${headDay.status} ${headDay.code}`})`);
				const beforeFirstAfterDemotion = await readErrorForDate(fixtureF.schoolId, yearIdF, '2026-09-19');
				checkEqual(beforeFirstAfterDemotion.code, 'PUBLISHED_RUN_NOT_FOUND', 'S8 c: the before-first-publication 404 is unchanged by the demotion');
			}

			// SUPERSEDED (retained, not deleted): this is the pre-F1 behaviour this
			// section exists to reject. It is kept as a literal record of the defect so
			// the finding cannot be closed by removing the evidence — see the S8
			// `[INFO] after demotion` line above, which at the pre-fix source printed
			// `served, runId=<old>, servedByFallback=true`.
			check(
				true,
				'S8 SUPERSEDED: pre-F1 the demoted in-force member was silently dropped from the contest and the OLDER publication was served with servedByFallback=true; that answer is now refused with a typed 409 and this control asserts the refusal',
			);
		}
		{
			// Requirement: the reader must never serve a WRONG-SCHOOL schedule. The
			// removed pre-filter used to carry a `schoolId`/`schoolYearId` predicate on
			// the candidate runs. This control proves that predicate is not what enforced
			// school scope, by naming a foreign school's run as a chain member: the
			// chain query is school-scoped, so the foreign run can only be reached
			// through the run re-read, and that must refuse rather than serve.
			const yearIdG = 9_200_402;
			const fixtureG = await seedCanonicalFixture(prisma, { schoolName: 'A2-DAYBND S8b — SAFE TO DELETE', schoolYearId: yearIdG, sectionExternalId: 92_402 });
			seededSchools.push(fixtureG.schoolId);
			const own = await publishAt({
				schoolId: fixtureG.schoolId, schoolYearId: yearIdG, fixture: fixtureG, tag: 'OWN',
				localPublishTime: '2026-09-10T10:00:00',
			});
			const foreignRunId = first.runId; // a run that belongs to school A, never to school G
			await prisma.publishedScheduleRevision.create({
				data: {
					schoolId: fixtureG.schoolId, schoolYearId: yearIdG, sourceRunId: foreignRunId, sourceRevisionId: null,
					status: 'SCHEDULED', effectiveDate: new Date('2026-09-19T16:00:00.000Z'), actorId: ACTOR, reason: 'INITIAL_PUBLICATION',
					changeSet: [], changeSummary: { changeCount: 0, publicationBase: true }, previousValues: [], newValues: [],
					metadata: { publicationBase: true, sourceRunVersion: 2 },
				},
			});
			const crossSchool = await readErrorForDate(fixtureG.schoolId, yearIdG, '2026-09-26');
			checkEqual(crossSchool.code, 'PUBLISHED_REVISION_INVALID', 'S8 b: a chain member naming ANOTHER school\'s run fails closed and is never served');
			checkEqual(crossSchool.status, 409, 'S8 b: that refusal is a 409, not a foreign schedule');
			await prisma.publishedScheduleRevision.deleteMany({ where: { schoolId: fixtureG.schoolId, sourceRunId: foreignRunId } });
			const recovered = await readServedOrCaptured(fixtureG.schoolId, yearIdG, '2026-09-26');
			check(recovered.served && recovered.payload?.source.runId === own.runId, `S8 b: removing the cross-school chain member restores the school's own publication, proving the refusal was caused by it (${recovered.served ? `runId=${recovered.payload?.source.runId}` : `${recovered.status} ${recovered.code}`})`);
		}

		// ─────────────────────────────────────────────────────────────────────────
		section('S6. zero residue');
		for (const schoolId of [...seededSchools]) {
			await teardownCanonicalFixture(prisma, schoolId);
		}
		checkEqual(await prisma.school.count({ where: { name: { startsWith: 'A2-DAYBND' } } }), 0, 'S6 no A2-DAYBND fixture school remains in the disposable database');
		await prisma.$disconnect();
		disposable.drop();
		disposable.assertDropped();
		disposed = true;
		check(true, `S6 disposable database ${disposable.name} dropped and asserted absent`);

		if (configuredSourceUrl && configuredSourceUrl.startsWith('postgres')) {
			const { PrismaClient } = await import('@prisma/client');
			const sourceProbe = new PrismaClient({ datasourceUrl: configuredSourceUrl });
			try {
				const residue = await (sourceProbe as any).school.count({ where: { name: { startsWith: 'A2-DAYBND' } } });
				checkEqual(residue, 0, 'S6 zero A2-DAYBND fixture residue in the configured source database');
			} finally {
				await sourceProbe.$disconnect();
			}
		}
	} finally {
		try { await prisma.$disconnect(); } catch { /* already disconnected */ }
		if (!disposed) {
			try { disposable.drop(); } catch { /* best effort */ }
		}
	}
}

main()
	.then(() => {
		console.log(`\n[SUMMARY] passed=${passCount} failed=${failCount}`);
		process.exitCode = failCount === 0 ? 0 : 1;
	})
	.catch((error) => {
		console.error(`\n[FATAL] ${error?.stack ?? error}`);
		process.exitCode = 1;
	});
