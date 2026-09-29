/**
 * A6 c10 — the school's ACTIVE SUBJECTS, for the permission add-picker.
 *
 * WHY THIS EXISTS RATHER THAN A PROP. The permission chooser needs a real list of
 * subjects to offer, and the two surfaces that can show it — the teacher profile
 * on `/faculty` and `Review coverage` on `/subjects` — are different pages with
 * different data already loaded. Threading a `subjects` prop through both would
 * mean one of them fetches a list it otherwise has no use for, and the other
 * fetches it twice. The list is small, stable for a school year, and read-only, so
 * it is read here, once, and only when a panel that needs it is actually mounted.
 *
 * WHY IT FAILS QUIETLY. An empty subject list is a real state (a school year with
 * no subjects yet) and is rendered as "no subjects to add" — NOT as an error, and
 * NOT as a picker that opens onto nothing. A chooser whose options failed to load
 * looks identical to a chooser that has nothing to offer, and a scheduler would
 * read the second as a fact about the school.
 */
import { useEffect, useState } from 'react';

import atlasApi from '@/lib/api';
import type { Subject } from '@/types';

export type UseSchoolSubjectsParams = {
	schoolId: number | null;
	/** False while the panel is unmounted, so an unmounted chooser reads nothing. */
	enabled: boolean;
};

export function useSchoolSubjects({ schoolId, enabled }: UseSchoolSubjectsParams) {
	const [subjects, setSubjects] = useState<Subject[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!enabled || schoolId == null) return;
		let cancelled = false;
		setLoading(true);
		atlasApi
			.get<Subject[]>('/subjects', { params: { schoolId, isActive: true } })
			.then(({ data }) => {
				if (cancelled) return;
				setSubjects(Array.isArray(data) ? data : []);
			})
			.catch(() => {
				// Silent, and the caller renders "no subjects to add" — see the file
				// note on why a failed read must not look like an empty school.
				if (!cancelled) setSubjects([]);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => { cancelled = true; };
	}, [enabled, schoolId]);

	return { subjects, loading };
}
