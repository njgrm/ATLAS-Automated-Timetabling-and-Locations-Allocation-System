import { useEffect, useState } from 'react';

import { fetchCampusBackground } from '@/lib/campus-background-api';

/**
 * A9 m1 — read the campus photo and its placement ONCE for a component that
 * already has the school in hand.
 *
 * WHY A HOOK AND NOT A CALLER PROP. The timetable centre pane does not receive
 * the photo from anywhere: it is a pane deep inside the workspace, and threading
 * a new prop through it would mean touching the workspace's own contract for a
 * presentation concern. Reading it here keeps the change inside this file and
 * keeps the shared seam (`fetchCampusBackground`) as the single way the client
 * learns where the photo is.
 *
 * THE FAILURE PATH IS DELIBERATE AND HONEST. A read that fails leaves BOTH the
 * photo and the placement null, which renders the same bare beige map this pane
 * has always rendered. It never renders a photo framed by a placement it never
 * received, and it never renders a building list against a photo that failed to
 * load — the two are set from one response, so they cannot disagree.
 */
export function useCampusBackground(schoolId: number | null | undefined): {
	campusImageUrl: string | null;
	campusMapPlacement: unknown;
} {
	const [campusImageUrl, setCampusImageUrl] = useState<string | null>(null);
	const [campusMapPlacement, setCampusMapPlacement] = useState<unknown>(null);

	useEffect(() => {
		if (schoolId == null) {
			setCampusImageUrl(null);
			setCampusMapPlacement(null);
			return;
		}
		let cancelled = false;
		fetchCampusBackground(schoolId)
			.then((background) => {
				if (cancelled) return;
				setCampusImageUrl(background.campusImageUrl);
				setCampusMapPlacement(background.campusMapPlacement);
			})
			.catch(() => {
				if (cancelled) return;
				setCampusImageUrl(null);
				setCampusMapPlacement(null);
			});
		return () => {
			cancelled = true;
		};
	}, [schoolId]);

	return { campusImageUrl, campusMapPlacement };
}
