/**
 * Grade Level Resolver — the ONE place ATLAS turns an EnrollPro grade level into
 * the numeric JHS grade (7..10).
 *
 * Authority order (hotfix 2026-09-28, widened 2026-09-29 by A2 c15):
 *   1. The grade NAME synced from EnrollPro (`SectionMirror.gradeLevelName`,
 *      e.g. "Grade 7"). EnrollPro re-mints `grade_level_id` on every wipe or
 *      rollover (observed: 5..8, then 17..20, then 1..4), so the id is never a
 *      stable grade. The name is.
 *   2. A registry learned from `section_mirrors (grade_level_id, grade_level_name)`
 *      of the requested school year, for call sites that only hold an id.
 *   3. The legacy id map (5..8 and 17..20 -> 7..10, 7..10 pass-through, >=100 % 100).
 *      Kept only for rows with no usable name. It must never override 1 or 2.
 *
 * `gradeNumberOf` is the second entry point, and the one most sites use: the
 * grade name, else `displayOrder` when it is a real grade (7-12), else `null`.
 * It exists because `displayOrder` is measured as the true grade 7..10 in every
 * school year, so a caller that can represent "no grade" should prefer it over
 * the id. `resolveSectionGradeLevel` deliberately does NOT read `displayOrder` —
 * see its comment for the carry-forward control that depends on that.
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
/**
 * The compact house form, `GR7` / `GR 7`. `lib/grade-labels.ts` Decision 5
 * makes `GR{grade}` the sanctioned compact grade label, and the resolvers this
 * authority replaced both accepted any name carrying a grade digit. A mirror row
 * may therefore legitimately be named `GR7`, and refusing it would lose a grade
 * the previous code could read.
 */
const COMPACT_GRADE_NAME_PATTERN = /^gr\.?\s*(\d{1,2})$/i;

/** Parse a grade out of a grade-level name, long form ("Grade 7") or compact ("GR7"). */
function parseGradeName(name: string | null | undefined): number | null {
	if (typeof name !== 'string') return null;
	const compact = name.trim().match(COMPACT_GRADE_NAME_PATTERN);
	if (compact) {
		const compactGrade = Number.parseInt(compact[1], 10);
		return Number.isInteger(compactGrade) && compactGrade > 0 ? compactGrade : null;
	}
	const match = name.match(GRADE_NAME_PATTERN);
	if (!match) return null;
	const grade = Number.parseInt(match[1], 10);
	return Number.isInteger(grade) && grade > 0 ? grade : null;
}

/** Parse "Grade 7" / "grade10" / "GRADE 9 - STE" into 7 / 10 / 9. Null when absent. */
export function gradeFromGradeLevelName(name: string | null | undefined): number | null {
	return parseGradeName(name);
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
 * `number`: the grade NAME, then the registry learned from the requested year,
 * then the legacy id map. This is the 2026-09-28 hotfix behaviour, UNCHANGED.
 *
 * WHY IT DOES NOT READ `displayOrder`, stated without a cause I cannot show.
 * `gradeNumberOf` reads the order as a second source; this function does not.
 * The two reasons that ARE established by evidence:
 *   1. ITS CONSUMERS CANNOT REACH IT. The callers that need a guaranteed
 *      `number` pass a ref carrying only `{ gradeLevelId, gradeLevelName }` —
 *      `resolveCarryForwardGrade(gradeLevelId, gradeLevelName)` is the clearest
 *      example, and it forwards exactly those two fields. An order leg here
 *      would be unreachable on that path, not merely unused.
 *   2. IT HAS A REGISTRY LEG THE OTHER DOES NOT. Call sites such as
 *      `derived-demand.service.ts` pass a school-year registry learned from
 *      `section_mirrors (grade_level_id, grade_level_name)`, which recovers a
 *      grade for a row that has no name AND no order. `gradeNumberOf` has no
 *      registry, so it is the right tool only where a null is representable.
 *   So: use `gradeNumberOf` wherever a null is representable (a displayed
 *   badge, a label, a scope key, a nullable payload field), and this function
 *   where a number is structurally required and the registry is wanted.
 *
 * AN HONEST CORRECTION, recorded because the earlier version of this comment
 * asserted a cause that was wrong. A 2026-09-29 correction round first added the
 * order leg to THIS function, then reverted it, attributing the revert to a
 * carry-forward control ("two rows are exact carries despite independent
 * displayOrder values (expected 2, got 3)") that went red in the same run.
 * That attribution was NOT established. Executing the control afterwards with
 * the name/order legs forced to their base behaviour reproduced the identical
 * `2 vs 3` failure, so that control is red independently of this function; and
 * the control's fixture sets `gradeLevelName: 'Grade 7'` on every row, so the
 * name leg answers first and `displayOrder = 9` is never consulted. The order
 * leg was, on the evidence, not what turned those two carries into three. What
 * actually turned them is not established. The revert is kept because reasons 1
 * and 2 above stand on their own, not because of that control.
 *
 * WHAT THIS FUNCTION DOES NOT DO. It does not return `null` — it returns a
 * number. For a reference with no usable name and no registry, it falls to the
 * legacy id map, and `legacyGradeFromInternalId(1)` is `1`. So an unnamed
 * post-wipe row can and does come back as `1..4` here. Callers that must not
 * surface a fabricated grade need `gradeNumberOf`, which returns `null` instead.
 *
 * A name outside 7..12 is rejected here too, so a mirror naming a non-JHS grade
 * can no longer leak through the name leg.
 */
export function resolveSectionGradeLevel(
	ref: GradeLevelRef,
	registry?: GradeLevelRegistry | null,
	fallback: LegacyGradeFallback = 'internal-id',
): number {
	const fromName = gradeFromGradeLevelName(ref.gradeLevelName);
	if (fromName !== null && fromName >= MIN_GRADE && fromName <= MAX_GRADE) return fromName;
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
