/**
 * A3 c11 — the per-section `SectionRoomMapModal` mount the `/sections` page owns.
 *
 * Extracted verbatim out of `pages/Sections.tsx` because that page crossed
 * AGENTS.md §8's mandatory 1000-physical-line ceiling, and the directive is
 * explicit: "Extract sub-components before continuing." Nothing here is new
 * behaviour — the props, the guards, the read-only reasons and the `onSelect`
 * body are the same code the page ran inline, and the comments travel with them
 * so the reasoning stays next to the code it explains.
 *
 * ── A9 c3 (2026-09-30): THE SCHOOL-WIDE BROWSE MOUNT IS GONE ───────────────────────────
 * The operator's `section.docx` item 5 asked to remove "browser room map" because every
 * row already opens a map scoped to its own section. The global-browse instance (the
 * `sectionId={0}` / `canWrite=false` mount and its blocked-reason sentence) had no opener
 * left on `/sections` once the header control was removed, so it is SUBTRACTED here rather
 * than parked: a source grep for the global-browse state and its prop returns nothing.
 * Only the per-section mount remains, and it is mounted only under a resolved actor
 * school (the ACTOR-SCOPE-C01 fail-closed rule the modal itself enforces).
 */
import * as React from 'react';
import { toast } from 'sonner';
import { SectionRoomMapModal } from './SectionRoomMapModal';
import type { SectionDetail } from './SectionRow';
import type { RoomSectionMetadata } from '@/components/BuildingView';
import type { HomeRoomWriteAvailability } from './homeRoomWriteAvailability';

export type SectionsHomeRoomMapModalsProps = {
	scopedSchoolId: number | null;
	/** The section whose row opened the map, or null. */
	mapTarget: SectionDetail | null;
	onMapTargetChange: (target: SectionDetail | null) => void;
	roomOccupancy: Map<number, string>;
	roomSectionData: Map<number, RoomSectionMetadata>;
	buildingOccupancy: Map<number, number>;
	/** The ONE write gate, derived in `homeRoomWriteAvailability.ts`. */
	homeRoomWrite: HomeRoomWriteAvailability;
	/** The page's not-saved notice channel. */
	onNotSaved: (notice: string) => void;
	/** The page's one home-room write path — assign, swap and unassign alike. */
	onHomeRoomChange: (target: SectionDetail, roomId: number | null) => void;
};

export function SectionsHomeRoomMapModals({
	scopedSchoolId,
	mapTarget,
	onMapTargetChange,
	roomOccupancy,
	roomSectionData,
	buildingOccupancy,
	homeRoomWrite,
	onNotSaved,
	onHomeRoomChange,
}: SectionsHomeRoomMapModalsProps) {
	if (scopedSchoolId == null) return null;

	return (
		<>
			{/* A3 C4 (top-10 #3): the row's "View room map" control lands here. It
				reuses the existing modal component and feeds its `onSelect` into the
				SAME `handleHomeRoomChange` the dropdown uses, so a room picked on the
				map goes through the identical confirm/queue/swap path and cannot
				bypass it.

				A3 C4 review finding N2: browsing the map is a legitimate READ, so the
				control stays enabled in read-only mode rather than being disabled like
				the sibling picker. FIX-12 closes the dead end that finding left: the
				modal is told the write gate, so its Confirm control is disabled and
				states the reason, and the read-only `onSelect` below now REPORTS the
				not-saved outcome instead of returning silently (N2's own note said
				the dead end "leaves the modal OPEN rather than closing it and silently
				doing nothing" — the truth is better served by saying the click cannot
				be saved, and the modal says so before the click). */}
			{mapTarget != null && (
				<SectionRoomMapModal
					open
					onOpenChange={(open) => { if (!open) onMapTargetChange(null); }}
					sectionName={mapTarget.name}
					sectionId={mapTarget.id}
					currentRoomId={mapTarget.homeRoomId ?? null}
					onSelect={(roomId) => {
						if (!homeRoomWrite.canWrite) {
							// FIX-08 routes the unassign here as `null`; FIX-12 says a
							// click that cannot be written says so instead of closing.
							const notice = homeRoomWrite.notSavedNotice ?? 'Home-room change not saved. Nothing was changed.';
							onNotSaved(notice);
							toast.error('Home-room change not saved', { description: notice });
							return;
						}
						if (roomId === (mapTarget.homeRoomId ?? null)) {
							onMapTargetChange(null);
							return;
						}
						onMapTargetChange(null);
						onHomeRoomChange(mapTarget, roomId);
					}}
					schoolId={scopedSchoolId}
					roomOccupancy={roomOccupancy}
					roomSectionData={roomSectionData}
					buildingOccupancy={buildingOccupancy}
					canWrite={homeRoomWrite.canWrite}
					writeBlockedReason={homeRoomWrite.notSavedNotice}
				/>
			)}
		</>
	);
}
