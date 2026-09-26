/**
 * GradeBadge — a ZERO-PALETTE accessibility adapter over the one canonical
 * grade chip.
 *
 * The colour authority for this app is
 * `components/GradeLevelBadge.tsx` (`GRADE_STYLES`, lines 17-20). That file is
 * consumed by the A2 room-schedule surfaces, so this stream imports it and
 * never edits it. This adapter exists only to add what the Teachers / Teaching
 * Load surfaces need and the primitive does not expose: an accessible label
 * that names the section the grade belongs to, and a stable test hook.
 *
 * IT DEFINES NO COLOUR MAP. It holds no `bg-`/`text-`/`border-` grade literal
 * and does not import `GRADE_COLORS` from `@/lib/grade-labels`; doing either
 * would recreate the duplicate-palette defect this consolidation removes.
 * `test:a3-teachers-load` F13-3 and F13-4 assert that at source.
 *
 * The surviving palette, verbatim, is the DepEd mapping required by
 * AGENTS.md 8, and it carries full dark variants because dark mode is real in
 * this app (15 `dark:` occurrences across 5 client files, including
 * `components/timetable/RightPanel.tsx:400` and
 * `components/timetable/GeneratedUnassignedPanel.tsx:78`):
 *
 *   7  -> bg-green-100 text-green-800  border-green-300  + dark green-900/40
 *   8  -> bg-yellow-100 text-yellow-800 border-yellow-300 + dark yellow-900/40
 *   9  -> bg-red-100 text-red-800 border-red-300 + dark red-900/40
 *   10 -> bg-blue-100 text-blue-800 border-blue-300 + dark blue-900/40
 *
 * G8 is `yellow`, not `amber`. The earlier claim that `GRADE_COLORS` used amber
 * for G8 was refuted at source: `lib/grade-labels.ts:20` is
 * `'8': 'bg-yellow-100/80 text-yellow-700'`. The other `amber` usages on the
 * Teachers surface are load-STATUS colours (`below-standard`), not grades.
 */
import { GradeLevelBadge } from '@/components/GradeLevelBadge';

export type GradeBadgeProps = {
	/** Numeric JHS grade level, e.g. 7-10. */
	grade: number;
	/** Optional accessible suffix naming what the grade qualifies, e.g. a section. */
	ariaSuffix?: string;
	/** Passed through; layout only. Never a colour. */
	className?: string;
};

export function GradeBadge({ grade, ariaSuffix, className }: GradeBadgeProps) {
	if (!Number.isFinite(grade)) return null;

	// The visible text of `GradeLevelBadge` is `prefix + grade` (default
	// prefix `GR`), so the accessible name is derived from the same contract
	// rather than from a second label source.
	const visible = `GR${grade}`;

	return (
		<span
			data-testid="grade-badge"
			data-grade={grade}
			aria-label={ariaSuffix ? `${visible}, ${ariaSuffix}` : undefined}
		>
			<GradeLevelBadge grade={grade} className={className} />
		</span>
	);
}
