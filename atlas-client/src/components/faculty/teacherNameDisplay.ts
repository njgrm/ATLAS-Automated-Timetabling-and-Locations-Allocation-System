/**
 * Teacher display-name casing — ONE convention for the Teachers, Teaching Load
 * and Teacher-detail surfaces (Fix 22).
 *
 * SCOPE: DISPLAY ONLY. `firstName` / `lastName` are read exactly as stored and
 * are never written, normalised, trimmed, re-cased or reordered by this module.
 * The only transformations are (a) the `Last, First` presentation order,
 * (b) collapsing redundant whitespace, and (c) UPPERCASING FOR DISPLAY.
 *
 * WHY UPPERCASE, and why it is a *display* transform.
 *
 * The root cause of the mixed-casing defect is the DATA, not the renderer:
 * some teachers are persisted uppercase and some are persisted Title Case, so
 * any renderer that preserves stored casing necessarily shows both. Lane C
 * observed exactly that on one screen at 1366x768: "AGUILAR, CARLO MIGUEL"
 * beside "Alcantara, Roberto".
 *
 * The original Fix 22 acceptance criterion is explicit — "Teacher names render
 * consistently uppercase in targeted UI" — and its recommended implementation
 * says to prefer "a display-layer standard (`uppercase` class or centralized
 * formatter) over mutating persisted person-name data".
 *
 * HISTORY, recorded because it is a correction. An earlier cycle in this same
 * stream deliberately REMOVED a CSS `uppercase` transform and preserved stored
 * casing, reasoning that "uppercase shouts Filipino given names". That was a
 * narrowing rewrite AGAINST the acceptance criterion, and it left the live
 * symptom in place. Cycle c10 re-issued the original criterion and the
 * narrowing is overruled. A centralized formatter (this file) is used in
 * preference to per-element CSS classes because two of its consumers —
 * `components/faculty-assignments/WorkloadInspector.tsx` and
 * `components/faculty-assignments/TeacherGridMode.tsx` — are owned by a
 * parallel lane this one must not edit, and the formatter standardises them
 * without a single cross-directory edit.
 *
 * SEARCH / SORT SAFETY (acceptance criterion 2). Because the transform lives
 * here and NOT in the data, every consumer that needs the true underlying value
 * calls `formatFacultyStoredName` / `teacherNameSortKey` below, and the roster's
 * own search and sort read the raw `firstName` / `lastName` fields. A visible
 * uppercase / stored-original split therefore cannot change what a search for
 * "alcantara" matches, and cannot change sort order.
 *
 * NOT A DATABASE REWRITE (acceptance criterion 3). Nothing in ATLAS mutates a
 * persisted person name. There is no `toUpperCase()` on any write path in this
 * stream; if such a change is ever wanted it needs separate approval.
 *
 * PLACEHOLDER IDENTITY (A3 c17 row 4, display only). A to-be-hired record is
 * stored with a SENTINEL last name, not a person's name: Lane C read
 * `— TO BE HIRED, MAPEH` and `1 — TO BE HIRED, TEACHER` on staging. The stored
 * value is left exactly as it is; only the DISPLAY name changes, to
 * "To be hired: MAPEH" / "To be hired: Teacher 1", so a scheduler reads a
 * status and a subject instead of punctuation and a shouted sentinel.
 *
 * The strip is deliberately narrow and mechanical, because the stored string is
 * data the app does not own: a leading numeric token (`1 `) and a leading
 * em-dash/hyphen run are removed from the LAST name only, and what remains is
 * the label. Nothing is re-cased, re-ordered, or invented here beyond that
 * prefix removal.
 *
 * ── IDENTITY IS THE FLAG; THE SENTINEL ONLY SHAPES THE TEXT (A3 c17 C2) ──
 *
 * The first cut of this row required `isPlaceholder` AND the stored sentinel.
 * That was a narrowing of the requester's words, which are "for `isPlaceholder`,
 * no `#ID-PENDING` and no 'Active teacher'" — the FLAG, named, with no condition
 * on the stored text — and it bought a protection that turned out to be a
 * liability: a placeholder whose stored last name lacks the sentinel kept both
 * the invented `#ID-PENDING` chip and the false "Active teacher" line, i.e. it
 * rendered as a real teacher. Unobservable on today's two live records only
 * because both happen to carry the sentinel; a placeholder created through
 * `CreatePlaceholderDialog` with a typed last name does not.
 *
 * So: `isPlaceholder` ALONE decides that a record is to-be-hired, and the
 * sentinel is a TEXT rule applied inside that branch. A flagged record with a
 * real person's name keeps that name as its label (it is still a person who has
 * not been hired yet, and inventing a status word over their name would destroy
 * information) — but it can no longer be mistaken for a hired teacher, because
 * every consumer of this module asks the same exported predicate.
 *
 * The two must never disagree, and they cannot: `isPlaceholderSentinelName` (the
 * Profile header's badge) and `formatFacultyDisplayName` (everywhere else) both
 * read `faculty.isPlaceholder` and nothing else.
 */
import type { FacultySummary } from '@/types';

type NameLike = {
	firstName?: string | null;
	lastName?: string | null;
	/**
	 * A3 c17 row 4. Optional so every existing call site — roster, profile,
	 * Teaching Load, Timetable — keeps compiling unchanged and picks the
	 * placeholder display up for free from the summary it already passes.
	 */
	isPlaceholder?: boolean;
};

/**
 * The stored sentinel, matched loosely enough to survive the casing and
 * punctuation variants observed on the real records
 * (`— TO BE HIRED`, `1 — TO BE HIRED`, `TO BE HIRED`).
 *
 * A TEXT rule, not an identity rule — see the C2 note in this file's header.
 */
const PLACEHOLDER_SENTINEL = /to\s+be\s+hired/i;

/** Collapse runs of whitespace and trim. Never changes letter casing. */
function tidy(value: string | null | undefined): string {
	return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * The UNDERLYING, stored-cased person name in `Last, First` order.
 *
 * This is the value search, sort and filtering must use. It is deliberately
 * NOT uppercased: it is the byte-preserved record of what EnrollPro holds. Use
 * `formatFacultyDisplayName` for anything a person reads.
 */
export function formatFacultyStoredName(faculty: NameLike | null | undefined): string {
	const last = tidy(faculty?.lastName);
	const first = tidy(faculty?.firstName);
	if (last && first) return `${last}, ${first}`;
	return last || first || 'Unnamed teacher';
}

/**
 * The sort/search key for a teacher: stored casing, `Last First` (no comma) so
 * it compares directly against a lower-cased query token.
 *
 * Casing must not influence matching order, which is why the roster lower-cases
 * the query before comparing. This key is therefore LEFT IN STORED CASING and is
 * the value the lower-casing is applied to — it does NOT uppercase anything.
 * (A3-C10 QA finding F3: an earlier version of this docstring said "A name is
 * UPPERCASE here", which described the opposite of the code three lines below. The
 * code was right; the sentence was the trap, because an editor "fixing" either
 * side would have broken either sort stability or the stored-value contract.)
 *
 * It is derived from the STORED fields, so it matches the stored value, never the
 * displayed one. Any ordering that needs a display value must not use this.
 */
export function teacherNameSortKey(faculty: NameLike | null | undefined): string {
	return `${tidy(faculty?.lastName)} ${tidy(faculty?.firstName)}`.trim();
}

/**
 * The label a placeholder record shows: the STORED name with the sentinel
 * phrase, the leading numeric token and the leading dash run removed, and the
 * counter re-expressed as a plain trailing number.
 *
 *   `— TO BE HIRED, MAPEH`       -> label `MAPEH`,      counter none
 *   `1 — TO BE HIRED, TEACHER`   -> label `TEACHER`,    counter `1`
 *
 * The counter is kept rather than discarded because two to-be-hired records
 * that both read "To be hired: MAPEH" are indistinguishable on a roster of
 * eight; the stored number is the only thing that tells them apart. It is moved
 * to the end and rendered as a bare number, so it reads as an identifier
 * instead of as leading punctuation.
 *
 * The label is returned in its STORED casing, never re-cased. `MAPEH` is a
 * programme token and uppercasing or sentence-casing it would be a guess about
 * what it is; this module's contract is that it never re-cases data.
 */
function placeholderLabel(faculty: NameLike): { label: string; counter: string } {
	const last = tidy(faculty?.lastName);
	const first = tidy(faculty?.firstName);

	// A3 C17 C2: a flagged record whose last name is a REAL person's name keeps
	// that whole name as its label. Taking only the first name here would drop
	// the surname — "To be hired: Roberto" for Alcantara, Roberto — which is
	// information loss on a record that has a real name to lose. The status word
	// still goes in front, so the record is still identified as to-be-hired.
	if (!PLACEHOLDER_SENTINEL.test(last)) {
		return { label: last && first ? `${last}, ${first}` : last || first, counter: '' };
	}

	// A leading numeric token is a running counter on the record, not a name.
	const counter = /^(\d+)\s*[-–—]?\s*/.exec(last)?.[1] ?? '';
	// Strip the sentinel phrase and every dash run from the LAST name; the
	// first name is the label and is left exactly as stored.
	const bareLast = last
		.replace(/^(\d+)\s*[-–—]?\s*/, '')
		.replace(PLACEHOLDER_SENTINEL, '')
		.replace(/^[\s,;–—-]+|[\s,;–—-]+$/g, '')
		.trim();
	const bareFirst = first.replace(/^[\s,;–—-]+|[\s,;–—-]+$/g, '').trim();
	const label = bareFirst || bareLast;
	return { label, counter };
}

/** The plain-words display name for a to-be-hired record. */
const PLACEHOLDER_DISPLAY_PREFIX = 'To be hired';

/**
 * Canonical Teachers/Teaching Load/Teacher-detail DISPLAY name: `LAST, FIRST`
 * in UPPERCASE (Fix 22).
 *
 * Falls back to whichever part exists, so a partially-entered placeholder
 * teacher still renders something rather than a stray comma.
 *
 * A3 c17 row 4, as corrected by C2: `isPlaceholder` ALONE selects the
 * to-be-hired branch (see this file's header for why the flag, not the
 * sentinel, is the identity rule). Inside that branch the sentinel is a TEXT
 * rule — it is stripped when present — so a flagged record with a real person's
 * name keeps that name as its label. This function still cannot LOSE a name: it
 * can only replace punctuation, a shouted sentinel and a leading counter.
 */
export function formatFacultyDisplayName(faculty: NameLike | null | undefined): string {
	if (!faculty) return 'UNNAMED TEACHER';
	if (faculty.isPlaceholder) {
		const { label, counter } = placeholderLabel(faculty);
		if (!label) return PLACEHOLDER_DISPLAY_PREFIX;
		return `${PLACEHOLDER_DISPLAY_PREFIX}: ${label.toUpperCase()}${counter ? ` ${counter}` : ''}`;
	}
	return formatFacultyStoredName(faculty).toUpperCase();
}

/**
 * True when this record is a to-be-hired one.
 *
 * THE IDENTITY PREDICATE (A3 c17 C2), and the single answer every surface must
 * use: the roster, the Profile header's `To be hired` badge, the Teaching Load
 * repair queue and the Timetable grid all ask THIS, so they cannot disagree
 * about which record is a placeholder. It reads the flag and nothing else; the
 * stored sentinel is a text rule inside the display formatters, not a second
 * opinion about identity.
 */
export function isPlaceholderSentinelName(faculty: NameLike | null | undefined): boolean {
	return Boolean(faculty?.isPlaceholder);
}

/** Convenience overload for the common `FacultySummary` call site. */
export function formatFacultySummaryName(faculty: FacultySummary | null | undefined): string {
	return formatFacultyDisplayName(faculty);
}

/**
 * Uppercased avatar initials for a teacher, e.g. `AM` for
 * "Alcantara, Roberto" (Fix 22 "badges/avatars" audit row).
 *
 * Reads the stored fields and uppercases the two first characters. Never
 * mutates the input, and never returns a stray comma or digit when a name part
 * is missing.
 *
 * A3 c17 row 4: a PLACEHOLDER's initials come from its STRIPPED label
 * (`MAPEH` -> `M`), not from `TO BE HIRED` -> `TB`. A circular avatar that
 * renders six words overflows itself, and `TB` reads as a person's initials when
 * it is a status. One or two characters, always — and the branch is selected by
 * the same `isPlaceholder` flag the display name uses, so the avatar and the
 * name can never disagree about which record this is.
 */
export function formatFacultyInitials(faculty: NameLike | null | undefined): string {
	if (faculty?.isPlaceholder) {
		const stripped = placeholderLabel(faculty).label.replace(/[^A-Za-z0-9]/g, '').charAt(0);
		return (stripped || 'T').toUpperCase();
	}
	const first = tidy(faculty?.firstName).charAt(0);
	const last = tidy(faculty?.lastName).charAt(0);
	return `${first}${last}`.toUpperCase();
}
