/**
 * A2 C13 — the teacher-departure "jump to the affected session" handler, extracted
 * from `ScheduleReviewWorkspace.tsx` for §8's 1000-physical-line cap.
 *
 * WHY IT MOVED: that file stood at 997 physical lines with no headroom, and A2 C13
 * added two props to it. §8's rule is to EXTRACT a sub-component, never to delete a
 * comment to make room, and this is the natural unit for the same reason
 * `createSwapArmHandler` already lives beside this component in `timetableSwapArming.ts`:
 * it is a PURE DOM effect with no component state, no props and no hook of its own.
 *
 * NOTHING BEHAVIOURAL CHANGED. The escape fallback, the three-candidate lookup
 * (direct node, then the cell that holds it, then the overflow trigger), the smooth
 * scroll, the temporary highlight and the 1600 ms cleanup are byte-for-byte the
 * same work, in the same order, on the same frame.
 *
 * `createTeacherDepartureJump` returns a STABLE callback (it closes over nothing),
 * so the call site keeps a `useCallback` with an empty dependency list and the
 * identity is unchanged — which matters, because the handler is passed into the
 * departure workflow and a new identity per render would re-fire its effects.
 */
export function createTeacherDepartureJump(): (entryId: string) => void {
	return (entryId: string) => {
		if (typeof window === 'undefined') return;
		window.requestAnimationFrame(() => {
			const escaped = window.CSS?.escape ? window.CSS.escape(entryId) : entryId.replace(/"/g, '\\"');
			const direct = document.querySelector<HTMLElement>(`[data-timetable-entry-id="${escaped}"]`);
			const cell = direct?.closest<HTMLElement>('td[data-day][data-start-time][data-end-time]')
				?? document.querySelector<HTMLElement>(`td[data-cell-entry-ids~="${escaped}"]`);
			const trigger = document.querySelector<HTMLElement>(`[data-overflow-entry-ids~="${escaped}"]`);
			(cell ?? trigger ?? direct)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
			(cell ?? trigger ?? direct)?.classList.add('ring-2', 'ring-violet-500', 'ring-offset-2');
			window.setTimeout(() => (cell ?? trigger ?? direct)?.classList.remove('ring-2', 'ring-violet-500', 'ring-offset-2'), 1600);
		});
	};
}
