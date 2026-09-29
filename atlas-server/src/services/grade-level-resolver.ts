/**
 * Grade Level Resolver — the ONE place ATLAS turns an EnrollPro grade level into
 * the numeric JHS grade (7..10).
 *
 * Authority order (hotfix 2026-09-28, widened 2026-09-29 by A2 c15):
 *   1. The grade NAME synced from EnrollPro (`SectionMirror.gradeLevelName`,
 *      e.g. "Grade 7"). EnrollPro re-mints `grade_level_id` on every wipe or
 *      rollover (observed: 5..8, then 17..20, then 1..4), so the id is never a
 *      stable grade. The name is.
 *   1b. `displayOrder`, the mirror's own grade number, but only when it is a
 *      real grade (7..12). Measured as 7..10 in every school year, so it is a
 *      safe stand-in for a row that carries no usable name.
 *   2. A registry learned from `section_mirrors (grade_level_id, grade_level_name)`
 *      of the requested school year, for call sites that only hold an id.
 *   3. The legacy id map (5..8 and 17..20 -> 7..10, 7..10 pass-through, >=100 % 100).
 *      Kept only for rows with no usable name. It must never override 1 or 2.
 *
 * `gradeNumberOf` is the name+`displayOrder` authority and is the entry point
 * every grade-reading site uses. `resolveSectionGradeLevel` is that plus the
 * registry and legacy legs, for consumers that must return a `number`.
 */

/** gradeLevelId -> numeric grade, learned from mirror rows' grade names. */
export type GradeLevelRegistry = ReadonlyMap<number, number>;

export interface GradeLevelRef {
	gradeLevelId: number;
	gradeLevelName?: string | null;
	/**
	 * The true grade number as stored by the mirror (7..10 in every measured
	 * school year). A second reliable source, used only when the name is absent
	 * or is not a real grade. See `gradeNumberOf`.
	 */
	displayOrder?: number | null;
}

/** The grade band a name or `displayOrder` may express. ATLAS is JHS 7-10. */
const MIN_GRADE = 7;
const MAX_GRADE = 12;

const GRADE_NAME_PATTERN = /grade\s*(\d{1,2})/i;

/** Parse "Grade 7" / "grade10" / "GRADE 9 - STE" into 7 / 10 / 9. Null when absent. */
export function gradeFromGradeLevelName(name: string | null | undefined): number | null {
	if (typeof name !== 'string') return null;
	const match = name.match(GRADE_NAME_PATTERN);
	if (!match) return null;
	const grade = Number.parseInt(match[1], 10);
	return Number.isInteger(grade) && grade > 0 ? grade : null;
}

const LEGACY_ENROLLPRO_GRADE_IDS: Readonly<Record<number, number>> = {
	5: 7,
	6: 8,
	7: 9,
	8: 10,
	17: 7,
	18: 8,
	19: 9,
	20: 10,
};

/**
 * Legacy fallback: map a historical EnrollPro internal `grade_level_id` to a grade.
 * Only for rows that carry no grade name and are absent from the registry.
 */
export function legacyGradeFromInternalId(gradeLevelId: number): number {
	if (gradeLevelId in LEGACY_ENROLLPRO_GRADE_IDS) return LEGACY_ENROLLPRO_GRADE_IDS[gradeLevelId];
	if (gradeLevelId >= 7 && gradeLevelId <= 10) return gradeLevelId;
	if (gradeLevelId >= 100) {
		const normalized = gradeLevelId % 100;
		if (normalized >= 1 && normalized <= 12) return normalized;
	}
	return gradeLevelId;
}

/**
 * Normalize a value that is usually already a grade number (7..10 passes
 * through) and otherwise a legacy internal id. For subject/scope grade lists,
 * never for a section's `gradeLevelId` (use `resolveSectionGradeLevel`).
 */
export function normalizeGradeNumberOrLegacyId(value: number): number {
	if (!Number.isFinite(value)) return value;
	if (value >= 7 && value <= 10) return value;
	return legacyGradeFromInternalId(value);
}

/**
 * Which legacy reading an unnamed, unregistered id falls back to. Callers keep
 * the reading they had before the hotfix: `internal-id` (7 -> 9, the generation
 * and demand paths) or `grade-first` (7 -> 7, carry-forward/offering scopes).
 */
export type LegacyGradeFallback = 'internal-id' | 'grade-first';

/**
 * THE grade-number authority (A2 c15, 2026-09-29).
 *
 * A section's numeric grade is `gradeLevelName` ("Grade 7".."Grade 10"), and
 * `displayOrder` when it is a real grade. It is NEVER the EnrollPro
 * `grade_level_id`: that is an internal FK the upstream re-mints on every wipe
 * or rollover (observed on staging: 5..8, then 17..20, then 1..4 — the last
 * observed on 2026-09-28 for school years 1 and 2). `displayOrder` is accepted
 * only inside 7..12 so a mirrored `0`/`1` sentinel can never pass as a grade.
 *
 * Returns `null` — never a fabricated number — when neither source names a
 * real grade, so a caller can render "unknown" instead of "Grade 1".
 */
export function gradeNumberOf(ref: {
	gradeLevelName?: string | null;
	displayOrder?: number | null;
	/** Accepted for call-site convenience and deliberately never read. */
	gradeLevelId?: number | null;
}): number | null {
	const fromName = gradeFromGradeLevelName(ref.gradeLevelName);
	if (fromName !== null && fromName >= MIN_GRADE && fromName <= MAX_GRADE) return fromName;
	const order = ref.displayOrder;
	if (typeof order === 'number' && Number.isInteger(order) && order >= MIN_GRADE && order <= MAX_GRADE) return order;
	return null;
}

/**
 * Resolve a section's numeric grade for a consumer that structurally requires a
 * `number`: the stated grade (`gradeNumberOf`), then the registry learned from
 * the requested year, then the legacy id map.
 *
 * WHERE THIS DIFFERS FROM `gradeNumberOf`, and why:
 *   - `gradeNumberOf` returns `null` for a reference with no name and no real
 *     `displayOrder`. This function must return something, so it falls through
 *     to the registry and then the legacy id map — which is why the legacy map
 *     has no `1 -> 7` entry: an unnamed post-wipe id `1` must stay unresolvable
 *     rather than silently become Grade 7.
 *   - A name outside 7..12 is rejected here too, so a mirror naming a
 *     non-JHS grade can no longer leak through the name leg.
 *   - Adding the `displayOrder` leg means an unnamed mirror row now resolves to
 *     its true grade instead of its id's legacy reading. That is the same fix
 *     applied to every former `displayOrder ?? gradeLevelId` call site, and it
 *     cannot turn a correct grade into a wrong one.
 */
export function resolveSectionGradeLevel(
	ref: GradeLevelRef,
	registry?: GradeLevelRegistry | null,
	fallback: LegacyGradeFallback = 'internal-id',
): number {
	const stated = gradeNumberOf(ref);
	if (stated !== null) return stated;
	const fromRegistry = registry?.get(ref.gradeLevelId);
	if (fromRegistry !== undefined) return fromRegistry;
	return fallback === 'grade-first'
		? normalizeGradeNumberOrLegacyId(ref.gradeLevelId)
		: legacyGradeFromInternalId(ref.gradeLevelId);
}

/**
 * Build an id -> grade registry from mirror rows of ONE school year (e.g. the
 * `(gradeLevelId, gradeLevelName)` pairs already loaded for that year). Only
 * name-derived grades enter it, so the legacy map can never seed it.
 */
export function buildGradeLevelRegistry(rows: Iterable<GradeLevelRef>): Map<number, number> {
	const registry = new Map<number, number>();
	for (const row of rows) {
		const grade = gradeFromGradeLevelName(row.gradeLevelName);
		if (grade !== null && !registry.has(row.gradeLevelId)) registry.set(row.gradeLevelId, grade);
	}
	return registry;
}
