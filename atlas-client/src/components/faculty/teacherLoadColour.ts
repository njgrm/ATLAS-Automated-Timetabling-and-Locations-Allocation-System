/**
 * D6 (2026-10-03, `forReview/miss-jo-1.docx`) — "YELLOW (no teaching load), GREEN (with teaching
 * load)": the load state as a COLOUR on the teacher row, replacing the standalone `Load` filter the
 * document asks to remove.
 *
 * WHAT "HAS A TEACHING LOAD" MEANS HERE, stated once because it is a claim the colours depend on.
 * It is `subjectCount > 0` — a teacher holding at least one subject in Teaching Load — and that is
 * the SAME predicate the removed `Load: All / With teaching load / Needs teaching load` filter used
 * (`(f.subjectCount ?? 0) > 0`) and the same one `teacherLoadTruth.hasLoad` uses. It is deliberately
 * NOT `sectionTeachingHours > 0`: a teacher can have subjects assigned and zero hours placed, and
 * after D6 that teacher is "with teaching load" — which is what the member asked to be told, because
 * what a scheduler needs to see on a department filter result is who has been GIVEN work, not who has
 * been given hours that fit on a timetable.
 *
 * IT IS ONE BINARY, NOT FOUR COLOURS. The document names two. A row already carries its own
 * `Load status` badge (`FacultyLoadStateBadge`), which distinguishes `No load` / `Under` / `Ready` /
 * `Near cap` / `Over cap` / `Excluded` and owns those tones. This module adds ONE cue beside it —
 * "has this teacher been given a teaching load at all" — so a scheduler scanning a department's
 * teachers sees the coverage gap without a second, competing status vocabulary. Two vocabularies for
 * load on one row is `AGENTS.md` §8's "never two chips that say the same thing" in numeric form, and
 * the richer badge is already on screen carrying the detail.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL (`DESIGN.md` §3). The row keeps its word badge, so the two agree by
 * construction: `No load` is amber and `hasLoad` is false; every other badge is a loaded teacher and
 * `hasLoad` is true. A colour-blind scheduler reads the same fact from the word.
 *
 * THE TONES ARE THE BADGE PRIMITIVE'S OWN `success` AND `warning` VARIANTS. `badgeVariants` in
 * `@/ui/badge-variants` already declares `success: 'bg-emerald-100 text-emerald-800'` and
 * `warning: 'bg-amber-100 text-amber-800'`, so the cue takes the SAME two variants rather than a
 * second pair of colour classes written beside them — one look per control, and the cue cannot drift
 * away from the word beside it. They are not `--color-success` / `--color-warning` utilities: `index.css`
 * declares `--color-warning` but has NO `--color-success`, and a dot painted with a class that does not
 * exist renders transparent, which would read as "no state" on the exact row the member asked to be
 * readable.
 */
import { cn } from '@/lib/utils';

/** The minimum a roster row needs for this decision. Both fields are on `FacultySummary`. */
export type TeacherLoadColourRow = {
	/** Subjects this teacher holds in Teaching Load. */
	subjectCount: number | null;
};

/**
 * THE PREDICATE. One spelling, shared by the colour, the tooltip and any control that needs to ask.
 *
 * `subjectCount` is null on no real path (the server always computes it), but the roster read is
 * typed as optional-tolerant throughout this page, so `?? 0` is stated here once rather than in each
 * caller.
 */
export function teacherHasTeachingLoad(row: TeacherLoadColourRow): boolean {
	return (row.subjectCount ?? 0) > 0;
}

/**
 * THE TONES — the `Badge variant` names themselves, so this type IS `badgeVariants`' own vocabulary
 * rather than a parallel one. `success` and `warning` are the exact variant keys `@/ui/badge`
 * declares, which is what makes "one look per control" (`AGENTS.md` §8) true here by construction: a
 * test can assert the variant and that is the primitive's own name, not this file's.
 *
 * They are the sanctioned status ladder in `DESIGN.md` §3 — success emerald, warning amber — and NOT
 * the DepEd grade palette in `@/lib/grade-labels`. Those two palettes must never meet: a yellow dot on
 * a teacher row that sits three columns from a `GR8` chip would read as a grade.
 */
export const TEACHER_LOAD_COLOUR_TONE = {
	/** No teaching load — the coverage gap the member wants to spot. */
	withoutLoad: 'warning',
	/** At least one subject in Teaching Load. */
	withLoad: 'success',
} as const;

export type TeacherLoadColourTone = (typeof TEACHER_LOAD_COLOUR_TONE)[keyof typeof TEACHER_LOAD_COLOUR_TONE];

/** THE CUE MARKER — one dot beside the row's existing status word. */
export type TeacherLoadColour = {
	hasLoad: boolean;
	tone: TeacherLoadColourTone;
	/** The `Badge variant` this cue paints with, taken straight from `@/ui/badge`. */
	badgeVariant: TeacherLoadColourTone;
	/** Stable hook for a rendered test. The DOT is what carries the colour. */
	testId: 'teacher-load-colour-with' | 'teacher-load-colour-without';
	/** The dot's class, so the colour is a token decision and not a page-local string. */
	dotClassName: string;
	/** Read by assistive technology as well as seen: colour alone is not a signal (`DESIGN.md` §3). */
	label: string;
};

/**
 * The dot's fill, keyed by the badge variant's own paint.
 *
 * The `Badge` variants are a surface + a text colour (`bg-emerald-100 text-emerald-800`), which an
 * 8px dot cannot use: it needs the solid hue. The hues are therefore the SAME two families the
 * variants declare — emerald for loaded, amber for no load — written once, here, so the dot and the
 * badge beside it cannot end up on two different palettes. They are raw palette classes, which
 * `DESIGN.md` §3 sanctions for exactly these status colours.
 */
const LOAD_COLOUR_DOT_CLASS: Record<TeacherLoadColourTone, string> = {
	[TEACHER_LOAD_COLOUR_TONE.withoutLoad]: 'bg-amber-500',
	[TEACHER_LOAD_COLOUR_TONE.withLoad]: 'bg-emerald-600',
};

/**
 * THE CUE CLASSES, and why they are the same two shapes the status chip row already uses.
 *
 * `TeacherAttentionFilters` renders its chips as `rounded-full` and marks the active one with
 * `variant="default"`. Copying that geometry rather than inventing a dot is `AGENTS.md` §11's "copy
 * what works" rule: a new cue on this page that does not match the page's existing cue reads as a
 * second design language.
 */
const LOAD_CUE_CLASS = 'size-2 shrink-0 rounded-full';

/**
 * Derive the load cue for one roster row.
 *
 * Returned as DATA rather than as JSX so the arithmetic can be tested without a renderer and so a
 * second surface can show the same cue without a second derivation.
 */
export function teacherLoadColour(row: TeacherLoadColourRow): TeacherLoadColour {
	const hasLoad = teacherHasTeachingLoad(row);
	const tone = hasLoad ? TEACHER_LOAD_COLOUR_TONE.withLoad : TEACHER_LOAD_COLOUR_TONE.withoutLoad;
	return {
		hasLoad,
		tone,
		badgeVariant: tone,
		testId: hasLoad ? 'teacher-load-colour-with' : 'teacher-load-colour-without',
		dotClassName: cn(LOAD_CUE_CLASS, LOAD_COLOUR_DOT_CLASS[tone]),
		label: hasLoad ? 'Has teaching load' : 'No teaching load',
	};
}