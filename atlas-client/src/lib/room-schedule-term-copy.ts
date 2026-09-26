/**
 * ROOM-SCHEDULES-TERM-C01 — ONE wording for "the term could not be verified".
 *
 * WHY THIS EXISTS. A schedule view is scoped to exactly one verified ordered
 * term, so when term authority is unresolved the view must refuse rather than
 * merge terms. The first cut of this change refused correctly but each surface
 * then fell through to its own "no timetable yet" branch, which asserted that a
 * timetable does not exist and told the operator to build Teaching Load — a
 * false statement, because a timetable usually DOES exist and Teaching Load is
 * not the missing thing. The refusal state therefore needs its own honest copy
 * rather than the absence state.
 *
 * WHY IT NAMES ATLAS, NOT ENROLLPRO. The authority these views depend on is the
 * term contract ATLAS persists for the active school year
 * (`enrollpro_school_year_mirrors.term_contract_cache`), which the runtime
 * context attaches and the server's own term validation reads. Measured
 * read-only on 2026-09-26: the active mirror (id 551, SY 2031-2032) holds a
 * populated cache naming T1/T2/T3. So this is a statement about ATLAS's own
 * cached term authority, and telling an operator to go and change something in
 * EnrollPro would send them somewhere that cannot fix it.
 *
 * ONE export, imported by all three surfaces. Copying this sentence a third
 * time is how two wordings for one condition start.
 */
export const UNVERIFIED_TERM_TITLE = 'Term not verified';

export const UNVERIFIED_TERM_BODY =
  'ATLAS could not verify which term this schedule is for, so it is not showing a schedule. '
  + 'This is a term-contract problem on the ATLAS side, not a missing timetable. '
  + 'Retry once the term is confirmed, or ask an administrator to re-sync the school year.';
