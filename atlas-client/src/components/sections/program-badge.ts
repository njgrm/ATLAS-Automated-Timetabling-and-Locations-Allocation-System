/**
 * A9 c1 R1 (2026-09-30) — THE ONE program-badge definition for `/sections`.
 *
 * THE DEFECT the shared module closes. A9 c1 fixed `SectionRow.tsx` so a
 * regular section shows a solid dark `BEC` badge and a special program shows its
 * own code on a solid dark fill with white text. The MOBILE card
 * (`SectionMobileCard.tsx`, the surface below 768px) was left behind: it still
 * rendered the OLD pale badge (`bg-white text-xs`) and a separate grey
 * `Regular Program` caption, so the same section looked like two different
 * things on one page (AGENTS.md §8 "one look per control").
 *
 * WHY A MODULE AND NOT A SECOND COPY. When the decision lived in one component,
 * the second renderer silently kept the old one. Putting the map and its three
 * helpers here means both renderers import the SAME function, so a change lands
 * on the row and the card at once — the defect the R1 correction exists to fix.
 *
 * WHAT DOES NOT CHANGE. `REGULAR` is the persisted value (schema, API, server);
 * only its operator-facing label reads `BEC`, read from the locked
 * `PROGRAM_SCOPE_OPTIONS` in `@/lib/subject-constants`.
 */
import { PROGRAM_SCOPE_OPTIONS } from '@/lib/subject-constants';

/**
 * The committed map: one solid dark fill per program code, each with white text.
 *
 * The seven-hundred step is deliberate: `bg-emerald-600` measures ~3.8:1 against
 * white, below the 4.5:1 floor the packet sets, so every fill is one step darker.
 * `a9-c1-program-badges.test.ts` re-derives each ratio from the installed
 * Tailwind palette, so a paler fill here is a failure, not a silent drift.
 */
export const PROGRAM_BADGE: Record<string, string> = {
	REGULAR: 'bg-slate-700 text-white border-slate-800',
	STE:   'bg-emerald-700 text-white border-emerald-800',
	SPA:   'bg-purple-700 text-white border-purple-800',
	SPS:   'bg-orange-700 text-white border-orange-800',
	SPJ:   'bg-sky-700 text-white border-sky-800',
	SPFL:  'bg-indigo-700 text-white border-indigo-800',
	SPTVE: 'bg-amber-700 text-white border-amber-800',
	OTHER: 'bg-slate-700 text-white border-slate-800',
};

/** The one fallback, so an unrecognised code is a dark badge rather than an unstyled one. */
export const PROGRAM_BADGE_FALLBACK = PROGRAM_BADGE.OTHER;

/** The class string for a program code, falling back to `OTHER` for an unknown one. */
export function programBadgeClass(code: string | null | undefined): string {
	if (!code) return PROGRAM_BADGE.REGULAR;
	return PROGRAM_BADGE[code] ?? PROGRAM_BADGE_FALLBACK;
}

/**
 * The code a row shows. A special-program section keeps its own code; every other
 * section shows the regular program, i.e. `REGULAR` — the stored value, never a
 * display invention.
 */
export function resolveProgramCode(input: {
	isSpecialProgram?: boolean | null;
	programCode?: string | null;
}): string {
	return input.isSpecialProgram && input.programCode ? input.programCode : 'REGULAR';
}

/** The operator-facing label, read from the locked `PROGRAM_SCOPE_OPTIONS`. */
const PROGRAM_LABEL: Record<string, string> = Object.fromEntries(
	PROGRAM_SCOPE_OPTIONS.map((option) => [option.value, option.label]),
);

/** `REGULAR` reads `BEC`, as it does on `/subjects`; an unknown code reads itself. */
export function programBadgeLabel(code: string | null | undefined): string {
	if (!code) return PROGRAM_LABEL.REGULAR ?? 'BEC';
	return PROGRAM_LABEL[code] ?? code;
}
