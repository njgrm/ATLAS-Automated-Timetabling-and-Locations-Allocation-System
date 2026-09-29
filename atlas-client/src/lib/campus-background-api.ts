/**
 * A9 m1 — the ONE typed client seam for the campus background.
 *
 * Both the editor and every read-only viewer read the placement through
 * {@link fetchCampusBackground}, so no viewer can accidentally render the old
 * fixed 920x580 framing by forgetting a second request or by reading a different
 * field name. The editor writes through {@link saveCampusBackground}, which is the
 * only caller of the placement PUT.
 *
 * The payload type is {@link CampusMapPlacement} — the SAME type the pure module
 * produces — so what is stored is what was drawn, with no second serialisation
 * shape that could drift from the arithmetic.
 */

import atlasApi from '@/lib/api';
import type { CampusMapPlacement, RawCampusMapPlacement } from '@/components/campus-map/campusMapBackground';

export type CampusBackground = {
	campusImageUrl: string | null;
	/** `null` = nothing stored; the caller normalises that to "fit whole, locked". */
	campusMapPlacement: RawCampusMapPlacement | null;
};

/** Read the photo and its placement together, from the endpoint every viewer already used. */
export async function fetchCampusBackground(schoolId: number): Promise<CampusBackground> {
	const { data } = await atlasApi.get<CampusBackground>(`/map/schools/${schoolId}/campus-image`);
	return {
		campusImageUrl: data?.campusImageUrl ?? null,
		campusMapPlacement: data?.campusMapPlacement ?? null,
	};
}

/**
 * Store the placement. Returns what the SERVER stored, not what was sent, so a
 * server-side clamp or rounding is reflected in the editor's state rather than
 * being overwritten on the next render by the optimistic value.
 */
export async function saveCampusBackground(
	schoolId: number,
	placement: CampusMapPlacement,
): Promise<CampusMapPlacement> {
	const { data } = await atlasApi.put<{ placement: CampusMapPlacement }>(
		`/map/schools/${schoolId}/campus-map-placement`,
		{ placement },
	);
	return data.placement;
}
