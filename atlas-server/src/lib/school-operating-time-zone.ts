/**
 * PUBLISHED-DAY-BOUNDARY-A2 (Defect B) — the school's operating calendar day.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * A published schedule is a DATE-addressed artifact. The public page asks for
 * `?date=YYYY-MM-DD`, and `atlas-client/src/lib/published-schedule-cache-key.ts`
 * (`currentPublishedScheduleDate()`) builds that value from the BROWSER's local
 * calendar date via `getTimezoneOffset()` — never from UTC. The server then
 * anchors the request at noon UTC of the same `YYYY-MM-DD`
 * (`resolveReadDate` in `published-schedule.service.ts`), which is a deliberate
 * choice: noon UTC sits inside the caller's local calendar day for every offset
 * in roughly -12..+12, so the whole day is in scope.
 *
 * The publication writer stamped the base revision with the raw publish INSTANT
 * (`effectiveDate: publishedAt`). An instant is not a day. A publish at
 * 2026-09-27T00:38+08 is 2026-09-26T16:38Z, which is AFTER the noon-UTC anchor
 * of the very date it names (2026-09-26T12:00Z) — so the API rejected its own
 * effective date. The fix is to stamp a DAY BOUNDARY in the same local frame the
 * caller asks in, and never to move the noon-UTC anchor.
 *
 * WHERE THE TIME ZONE COMES FROM — read this before changing the constant
 * --------------------------------------------------------------------
 * ATLAS has NO persisted school timezone. Exhaustive search of
 * `prisma/schema.prisma` for `tz|time_zone|zone|utc` returns nothing; the
 * `School` model has no timezone column, `SchoolYearTermConfig` carries only
 * term identities, `EnrollProSchoolYearMirror` has no offset, and no
 * `process.env.TZ` / `ATLAS_*TIMEZONE` configuration exists anywhere in the
 * repository. The only `Asia/Manila` literal in `atlas-server/src` is a
 * human-readable cron description inside `database-backup.service.ts` — a string
 * in a log line, not an authority.
 *
 * So the operating timezone is a PRODUCT constant of this deployment, declared
 * in exactly one place, and this is a deliberate product decision rather than a
 * discovered fact:
 *
 *  - ATLAS is a Philippine DepEd Junior High School product. The evidence is in
 *    the tree, not in configuration: `faculty-grade-preference.service.ts`
 *    documents "numeric Philippine JHS grades 7-10", and both DOCX exporters
 *    (`docx-export.service.ts`, `official-program-docx.service.ts`) render the
 *    "Republic of the Philippines" government identity line.
 *  - Asia/Manila is UTC+08:00 with NO daylight saving, so the offset is constant
 *    and a day boundary is exactly 24 h wide. `Intl` resolves it by IANA name
 *    rather than a hard-coded +08:00, so a future relocation is a one-line
 *    change here instead of a hunt for magic literals.
 *
 * A `School.timezone` column would be the durable answer, but that is a schema
 * migration and therefore explicitly out of scope for this candidate: this fix
 * changes NO row and runs NO migration. The reader is deliberately built so that
 * a wrong offset cannot produce an error — it can only change WHICH prior
 * publication is selected, and every response reports the run it was actually
 * served by. See `servedByFallback` in `published-schedule.service.ts`.
 *
 * All day arithmetic is delegated to `Intl.DateTimeFormat` so the platform owns
 * zone data; this module never hard-codes an offset in minutes.
 */

/**
 * The school's operating timezone. One IANA zone name, one place. See the
 * provenance block above before changing it.
 */
export const SCHOOL_OPERATING_TIME_ZONE = 'Asia/Manila';

const DAY_MS = 86_400_000;

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zonedParts(instant: Date, timeZone: string): ZonedParts {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).formatToParts(instant);
	const read = (type: Intl.DateTimeFormatPartTypes): number => {
		const found = parts.find((part) => part.type === type);
		const value = found ? Number(found.value) : Number.NaN;
		if (!Number.isFinite(value)) {
			throw new Error(`Unable to resolve ${type} in time zone ${timeZone}.`);
		}
		return value;
	};
	return {
		year: read('year'),
		month: read('month'),
		day: read('day'),
		hour: read('hour'),
		minute: read('minute'),
		second: read('second'),
	};
}

/**
 * Offset of `timeZone` from UTC at `instant`, in milliseconds (east positive).
 * Derived by reading the instant back as zoned wall-clock fields, exactly the
 * technique `Intl` documents for zone-offset extraction — no offset table here.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
	const wall = zonedParts(instant, timeZone);
	const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
	// Compare at whole-second resolution: `formatToParts` has no sub-second field.
	return asUtc - (instant.getTime() - instant.getMilliseconds());
}

/** The school's local calendar day containing `instant`, as `YYYY-MM-DD`. */
export function schoolLocalDayKey(instant: Date): string {
	const wall = zonedParts(instant, SCHOOL_OPERATING_TIME_ZONE);
	const month = String(wall.month).padStart(2, '0');
	const day = String(wall.day).padStart(2, '0');
	return `${String(wall.year).padStart(4, '0')}-${month}-${day}`;
}

/**
 * Start of the school's local calendar day containing `instant`, as a UTC
 * instant. This is the value a publication stamps as its day-granular
 * `effectiveDate`.
 *
 * Two passes: the first derives the boundary from the offset at `instant`, the
 * second re-derives it from the offset AT that candidate. For a fixed-offset
 * zone (Asia/Manila) the two agree exactly; the refinement is what keeps the
 * boundary honest in a zone that observes daylight saving, where the offset at
 * the start of the day can differ from the offset later in the same day.
 */
export function schoolLocalDayStartUtc(instant: Date): Date {
	if (Number.isNaN(instant.getTime())) {
		throw new Error('schoolLocalDayStartUtc requires a valid instant.');
	}
	const offsetAtInstant = zoneOffsetMs(instant, SCHOOL_OPERATING_TIME_ZONE);
	const floored = Math.floor((instant.getTime() + offsetAtInstant) / DAY_MS) * DAY_MS;
	const firstPass = new Date(floored - offsetAtInstant);
	const offsetAtBoundary = zoneOffsetMs(firstPass, SCHOOL_OPERATING_TIME_ZONE);
	return offsetAtBoundary === offsetAtInstant ? firstPass : new Date(floored - offsetAtBoundary);
}

/**
 * The school's local calendar day window containing `instant`.
 *
 * `dayKey` is the local `YYYY-MM-DD`; `startUtc` is the instant that local day
 * begins; `endExclusiveUtc` is the instant the NEXT local day begins, so
 * `effectiveDate < endExclusiveUtc` means "stamped somewhere inside this local
 * day or earlier".
 *
 * `startUtc` is resolved through the SAME noon-UTC convention the published
 * read already uses for `?date=YYYY-MM-DD`, so a day key derived from a
 * requested date and a day key derived from a stored instant are directly
 * comparable as plain `YYYY-MM-DD` strings.
 */
export function schoolLocalDayWindow(instant: Date): { dayKey: string; startUtc: Date; endExclusiveUtc: Date } {
	const dayKey = schoolLocalDayKey(instant);
	const [year, month, day] = dayKey.split('-').map(Number);
	// `Date.UTC` normalises an out-of-range day, so this is an exact calendar
	// increment across month and year boundaries (including 29 Feb).
	const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
	const nextDayKey = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}`;
	const atNoonUtc = (key: string): Date => new Date(`${key}T12:00:00.000Z`);
	return {
		dayKey,
		startUtc: schoolLocalDayStartUtc(atNoonUtc(dayKey)),
		endExclusiveUtc: schoolLocalDayStartUtc(atNoonUtc(nextDayKey)),
	};
}
