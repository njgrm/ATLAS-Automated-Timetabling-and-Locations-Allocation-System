/**
 * ATLAS DepEd glossary.
 *
 * Single source of truth for plain-language DepEd labels so raw internal codes
 * never ship to non-technical scheduler officers. See
 * `docs/phases/setup-content-area-improvement-plan-2026-08-08.md` Phase 0A.1.
 *
 * Compact grade format is `GR{grade}` (Decision 5 in the plan). Long form is
 * `Grade {grade}`. The shorthand `G{grade}` is intentionally absent.
 */

/** Department code -> plain DepEd learning-area name. Re-exported by subject-constants for back-compat. */
export const DEPARTMENT_LABELS: Readonly<Record<string, string>> = {
	SCI: 'Science',
	MATH: 'Mathematics',
	ENG: 'English',
	FIL: 'Filipino',
	AP: 'Araling Panlipunan',
	ESP: 'Edukasyon sa Pagpapakatao',
	MAPEH: 'MAPEH',
	TLE: 'Technology and Livelihood Education',
	GENERAL: 'General',
} as const;

/** Resolve a department code to a plain label, falling back to the raw value when unknown. */
export function departmentLabel(code: string | null | undefined): string {
	if (!code) return 'General';
	return DEPARTMENT_LABELS[code] ?? code;
}

/** Special-program scope code -> { short, full } descriptor. */
export const PROGRAM_LABELS: Readonly<Record<string, { short: string; full: string }>> = {
	REGULAR: { short: 'Regular', full: 'Regular Program' },
	STE: { short: 'STE', full: 'Science, Technology, and Engineering' },
	SPA: { short: 'SPA', full: 'Special Program in the Arts' },
	SPS: { short: 'SPS', full: 'Special Program in Sports' },
	SPJ: { short: 'SPJ', full: 'Special Program in Journalism' },
	SPFL: { short: 'SPFL', full: 'Special Program in Foreign Language' },
	SPTVE: { short: 'SPTVE', full: 'Special Program in Technical-Vocational Education' },
	OTHER: { short: 'Other', full: 'Other Program' },
} as const;

/** Resolve a program scope code to its short descriptor, falling back to the raw value. */
export function programShortLabel(code: string | null | undefined): string {
	if (!code) return 'Regular';
	return PROGRAM_LABELS[code]?.short ?? code;
}

/** Resolve a program scope code to its full plain-language descriptor, falling back to the short label. */
export function programFullLabel(code: string | null | undefined): string {
	if (!code) return 'Regular Program';
	return PROGRAM_LABELS[code]?.full ?? programShortLabel(code);
}

/** Compact grade label, e.g. `GR7`. Decision 5: compact form is `GR{grade}`, never `G{grade}`. */
export function gradeCompact(grade: number): string {
	return `GR${grade}`;
}

/** Long-form grade label for explanatory copy where space is not constrained, e.g. `Grade 7`. */
export function gradeLong(grade: number): string {
	return `Grade ${grade}`;
}

/**
 * Friendly label for placeholder / Teacher X rows. The badge label may still
 * read "Teacher X" but the default first/last name for a new placeholder must
 * not be "Teacher X" (Decision shorthand in the plan). Use this where a
 * non-jargon placeholder description is needed.
 */
export const TEACHER_X_LABEL = 'Temporary (to be hired)';