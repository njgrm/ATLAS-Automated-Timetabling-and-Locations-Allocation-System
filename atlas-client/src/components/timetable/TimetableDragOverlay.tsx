/**
 * A2 mc R1 — the drag overlay, extracted from `ScheduleReviewWorkspace.tsx`.
 *
 * WHY: that file stood at 995 physical lines against the AGENTS.md §8 cap of
 * 1000, and the R1 swap-offer wiring had to add real code there. §8 says EXTRACT
 * rather than grow. `TimetableDragOverlay` was the seam: a self-contained
 * presentational component with two resolver props, referenced by exactly one
 * call site inside the workspace and imported by nothing in the repository, so
 * moving it cannot change another lane's surface.
 *
 * A MOVED COMPONENT IS NOT A CHANGED COMPONENT — the markup, the classes and the
 * copy are byte-identical.
 */
import { useDndContext } from '@dnd-kit/core';

export function TimetableDragOverlay({
	subjectLabel,
	sectionLabel,
}: {
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
}) {
	const { active } = useDndContext();
	const source = active?.data.current as any;
	if (!source?.type) return null;
	const label = source.type === 'entry'
		? subjectLabel(source.entry.subjectId)
		: source.type === 'draftQueue'
			? `${subjectLabel(source.item.subjectId)} · ${source.item.sectionName}`
			: source.type === 'draftPlacement'
				? `Draft · ${subjectLabel(source.placement?.subjectId ?? source.entry?.subjectId)}`
				: `${subjectLabel(source.item.subjectId)} · ${sectionLabel(source.item.sectionId)}`;
	return (
		<div className="rounded border border-primary/60 bg-card px-2.5 py-1.5 text-xs shadow-md pointer-events-none select-none">
			<p className="font-medium">{label}</p>
			<p className="mt-0.5 text-xs text-muted-foreground">Release on a highlighted cell to review move or swap.</p>
		</div>
	);
}
