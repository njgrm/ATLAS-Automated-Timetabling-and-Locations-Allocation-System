/**
 * Fix 25 — build a `LoadProfile` for the teacher the user is reviewing, from
 * data the Teachers roster ALREADY has.
 *
 * WHY THIS EXISTS.
 *
 * The Fix 25 acceptance criterion is that the in-page modal shows "the same
 * workload information currently shown in the Teaching Load inspector" and that
 * it is achieved by "extract/reuse the presentational content from
 * `WorkloadInspector` rather than copy/pasting metrics". So the presentation
 * component is REUSED AS-IS (`WorkloadInspector` is imported, never edited and
 * never copied). What was missing is a presentation-shaped value for it: the
 * Teaching Load page builds a `LoadProfile` from the full assignment/subject/section
 * graph via `buildTeachingLoadProfile`, and the roster summary does not carry
 * that graph — it carries the already-aggregated numbers.
 *
 * This module is that adapter, and it is the "genuinely shared workload
 * presentation primitive" the c10 brief asked for. It is pure, has no data
 * fetching, and lives in `components/faculty/` so the parallel FIX-26 lane can
 * import it for its audit-summary modal without either lane editing the other's
 * directory.
 *
 * FIDELITY RULES.
 *
 * - Every figure is READ from the roster summary; none is recomputed from a
 *   different authority. `policyCreditedHours` stays the credited total,
 *   `actualTeachingHours` stays the teaching hours.
 * - The status is derived by the ONE canonical `deriveLoadStatus` the Teaching
 *   Load page uses, so the badge cannot disagree with the rest of the product.
 * - When the workload policy is UNCONFIGURED the adapter reports
 *   `policyReady: false` and a null standard, so `WorkloadInspector` renders its
 *   own honest "Teaching standard not configured" panel rather than this module
 *   inventing an hour figure.
 * - Nothing here mutates the `FacultySummary` it is given.
 */
import { deriveLoadStatus, STANDARD_WEEKLY_TEACHING_HOURS } from '@/lib/faculty-assignment-helpers';
import { resolveSectionGradeNumber } from '@/lib/schedule-review-helpers';
import type { FacultySummary, LoadBreakdownItem, LoadProfile, RotationFamilyTermBreakdown } from '@/types';

export type TeacherWorkloadView = {
	loadProfile: LoadProfile | null;
	rotationTermBreakdown: RotationFamilyTermBreakdown[];
	/** Null when the school year has no persisted workload policy. */
	teachingStandardHours: number | null;
	policyReady: boolean;
};

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

function toBreakdown(faculty: FacultySummary): LoadBreakdownItem[] {
	const rows: LoadBreakdownItem[] = [];
	for (const assignment of faculty.assignments ?? []) {
		const subject = assignment.subject;
		if (!subject) continue;
		// A section with no known grade still has to render; 0 is the
		// "ungraded" value every other consumer in this stream already uses.
		for (const section of assignment.sections ?? []) {
			rows.push({
				subjectId: subject.id,
				subjectName: subject.name,
				subjectCode: subject.code,
				rotationFamily: subject.rotationFamily ?? null,
				rotationTermRank: subject.rotationTermRank ?? null,
				rotationTermLabel: subject.rotationTermLabel ?? null,
				rotationTermGroupId: subject.rotationTermGroupId ?? null,
				rotationTermCount: subject.rotationTermCount ?? null,
		// The roster summary is already rotation-deduplicated, so no row
			// in it is a rotation duplicate.
			isRotationDuplicate: false,
			sectionId: section.id,
			sectionName: section.name,
			// A2 c15: the grade comes from the one client authority
			// (`gradeNumberOf`: `gradeLevelName`, then `displayOrder`). It used to
			// read the section's EnrollPro `gradeLevelId` directly, and that id
			// re-mints on every wipe — 1..4 for Grades 7..10 as of 2026-09-28 — so
			// `WorkloadInspector` rendered `GR1`. A section that names no real
			// grade reports `null` and renders no badge, never `GR1`.
			gradeLevel: resolveSectionGradeNumber(section),
			minutesPerWeek: subject.minMinutesPerWeek ?? 0,
			totalMinutes: subject.minMinutesPerWeek ?? 0,
			});
		}
	}
	return rows;
}

/**
 * Project a roster `FacultySummary` into the values `WorkloadInspector` needs.
 *
 * Pure and side-effect free. Safe to call on every render.
 */
export function buildTeacherWorkloadView(faculty: FacultySummary | null): TeacherWorkloadView {
	if (!faculty) {
		return { loadProfile: null, rotationTermBreakdown: [], teachingStandardHours: null, policyReady: false };
	}

	const actual = faculty.actualTeachingHours ?? 0;
	const overcount = faculty.rotationFamilyOvercountHours ?? 0;
	const credited = faculty.policyCreditedHours ?? 0;
	const maxHours = faculty.maxHoursPerWeek ?? 0;

	// Policy readiness is signalled by the summary carrying policy-derived
	// figures. Without them there is no standard to compare against, and the
	// inspector's unconfigured panel is the truthful render.
	const policyReady = faculty.teachingUtilizationPercent != null && faculty.teachingCapacityRemainingMinutes != null;

	// The standard is the summary's own arithmetic, not a constant: the effective
	// standard is a per-school-year policy value, and the utilization percentage
	// was computed against it upstream.
	const derivedStandard =
		policyReady && faculty.teachingUtilizationPercent != null && faculty.teachingUtilizationPercent > 0
			? round2(actual / (faculty.teachingUtilizationPercent / 100))
			: policyReady
				? STANDARD_WEEKLY_TEACHING_HOURS
				: null;

	const { status, label, instruction } = deriveLoadStatus(actual, maxHours);
	const excess = faculty.excessTeachingMinutes != null ? round2(faculty.excessTeachingMinutes / 60) : 0;

	const loadProfile: LoadProfile = {
		actualTeachingHours: actual,
		// "All classes added together" — the figure before rotational families
		// are collapsed to their busiest term.
		rawTeachingHours: round2(actual + overcount),
		rotationOvercountHours: round2(overcount),
		equivalentHours: round2(Math.max(0, credited - actual)),
		creditedTotalHours: round2(credited),
		overloadHours: excess,
		overCapHours: round2(Math.max(0, actual - maxHours)),
		remainingHours:
			faculty.teachingCapacityRemainingMinutes != null
				? round2(faculty.teachingCapacityRemainingMinutes / 60)
				: derivedStandard != null
					? round2(Math.max(0, derivedStandard - actual))
					: 0,
		excessTeachingHours: excess,
		status,
		statusLabel: label,
		statusInstruction: instruction,
		rotationFamilies: [],
		breakdown: toBreakdown(faculty),
	};

	return {
		loadProfile,
		rotationTermBreakdown: faculty.rotationTermBreakdown ?? [],
		teachingStandardHours: derivedStandard,
		policyReady,
	};
}
