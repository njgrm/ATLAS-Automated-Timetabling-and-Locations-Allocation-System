/**
 * The break band in the Class Schedule grid — one token-backed presentation.
 *
 * MR-61 (class-schedule.docx): "change color of HEALTH BREAK".
 *
 * AT BASE 4c4682b9 this cell was painted `bg-amber-50/40 text-amber-700`, which
 * is the app's WARNING semantic (DESIGN.md §3, "Warning — needs review"). Inside
 * this one grid amber already means four other things: a real flag/HGP overlay
 * (`timetable-ceremony-overlay-label`), a class colliding with a block
 * (`timetable-blocked-overlap-label`), a SOFT violation, and every unplaced /
 * "needs owner" chip in the rail. A routine 09:00 break row therefore read the
 * same as a problem. The member's read was correct.
 *
 * Two constraints decided the replacement, and both rule a status colour out:
 *
 *  1. §8 encodes grade meaning as G7 green / G8 yellow / G9 red / G10 blue, and
 *     every teaching-period cell is painted with its grade's tint. A break in
 *     amber or red collides with G8 or G9. `--warning` (35 76% 33%) is the
 *     yellow-amber family, and `--destructive` is G9 red, so neither can carry
 *     "not a teaching period".
 *  2. The rule is to reuse what exists, never to invent a second palette. The
 *     app already has a neutral, grade-free language for a row that holds no
 *     subject: `bg-muted` with `text-muted-foreground`, used ~146 times across
 *     `src/components` (header bands, non-grade periods, inactive tab strips),
 *     and the room-schedule grid already labels a special event with exactly
 *     this ink — `components/room-schedules/ScheduleTimetableGrid.tsx` renders
 *     `text-xs font-semibold text-muted-foreground` for an event label.
 *
 * So the break takes the SAME neutral surface a non-grade teaching period
 * already takes (`bg-muted/40` at the grid's `else` branch) at full strength,
 * with the same ink the room grid already uses for an event. Nothing new is
 * defined: `--muted` and `--muted-foreground` are both in `index.css @theme
 * inline`, and `--muted-foreground` on `--muted` measures 5.149:1 (index.css
 * :root note), so the band text clears WCAG AA.
 *
 * `BREAK_BAND_TONE` is the token NAME, not a colour. A test can assert that this
 * string resolves to a registered token without hard-coding a hex value, which
 * is why the tone travels with the markup as `data-break-tone`.
 */

/**
 * The semantic tone the break band is painted from. Must be a `--color-<tone>`
 * utility registered by `index.css @theme inline`, and the grid cell renders it
 * as `data-break-tone` so the choice is machine-checkable, not a class literal.
 */
export const BREAK_BAND_TONE = 'muted';

/**
 * The break band's colour utilities. Background, ink and the left rule the cell
 * already carried — no new geometry, no new row, no new control.
 */
export const BREAK_BAND_COLOUR_CLASS = `bg-${BREAK_BAND_TONE} text-muted-foreground border-border/30`;