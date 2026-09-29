/**
 * A6 c10 — ONE owner of the subject-permission reads and writes.
 *
 * THE CONTRACT, from A8 c4's handoff (`docs/handoffs/lane-c-to-a2.md` §4), which
 * is binding and which this hook is written against rather than derived from:
 *
 *   GET    /faculty/:facultyId/subject-permissions?schoolId=<n>
 *          -> { schoolId, facultyId, canTeachOutsideDepartment, subjects[] }
 *   POST   /faculty/:facultyId/subject-permissions        { schoolId, subjectId }
 *          -> 200 { facultyId, subjectId, created }        (200, not 201: idempotent)
 *   DELETE /faculty/:facultyId/subject-permissions/:subjectId?schoolId=<n>
 *          -> 200 { removed }                             (NO request body; an
 *                                                            absent row is 200
 *                                                            with removed:false,
 *                                                            never a 404)
 *
 * `canTeachOutsideDepartment` has NO route of its own — it already rides
 * `PUT /faculty/:facultyId`, so the switch writes through the existing teacher
 * edit. A8 c4 explicitly says not to build a new toggle endpoint, and this hook
 * is the proof that the client did not.
 *
 * WHY A HOOK RATHER THAN PAGE STATE. The permission list is edited from TWO
 * surfaces — the teacher profile and Subjects' `Review coverage` — and A8 c4's
 * contract makes them the same list. If each surface owned its own fetch, one of
 * them would show a stale grant after the other created it, and the scheduler
 * would learn that the permission they just granted "did not save". So the read,
 * the grant and the revoke live here, and both surfaces call the same handle.
 *
 * WHY `schoolId` IS REQUIRED AND NEVER DEFAULTED. `CreatePlaceholderDialog.tsx`
 * hard-codes a school-1 default on this subsystem, and a permission written
 * against the wrong school is a permission that appears to work and does not.
 * With no school the hook does not dispatch; it is a no-op, not a guess.
 *
 * WHY A 404 IS NOT TREATED AS A FAILURE WORTH A TOAST. A8 c4's routes are not
 * deployed yet, so the first read on staging is a 404. That is a real, dated
 * state of the product and it is rendered as ONE quiet line saying the control is
 * not available on this server — not as a red error, and not as an empty list that
 * would read as "this teacher has no permissions" and be believed.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';

export type SubjectPermission = {
	subjectId: number;
	code: string;
	name: string;
	ownerDepartment: string | null;
	grantedAt: string | null;
};

export type SubjectPermissionsState = {
	permissions: SubjectPermission[];
	canTeachOutsideDepartment: boolean;
	loading: boolean;
	/** True when the server has no such route yet. Not the same as "none". */
	unavailable: boolean;
	/** A subject the scheduler chose to add. Null while the chooser is closed. */
	grantInFlight: boolean;
	revokingSubjectId: number | null;
	/** The page's write gate; a read-only workspace offers no permission control. */
	writeBlockedReason: string | null;
};

export type UseSubjectPermissionsParams = {
	facultyId: number | null;
	schoolId: number | null;
	writeBlockedReason?: string | null;
	/** Called after any successful write, so the caller re-reads its own roster. */
	onChanged?: () => void;
};

const EMPTY: SubjectPermissionsState = {
	permissions: [],
	canTeachOutsideDepartment: false,
	loading: false,
	unavailable: false,
	grantInFlight: false,
	revokingSubjectId: null,
	writeBlockedReason: null,
};

export function useSubjectPermissions({
	facultyId,
	schoolId,
	writeBlockedReason,
	onChanged,
}: UseSubjectPermissionsParams) {
	const [state, setState] = useState<SubjectPermissionsState>(EMPTY);

	const read = useCallback(async () => {
		if (facultyId == null || schoolId == null) {
			setState(EMPTY);
			return;
		}
		setState((previous) => ({ ...previous, loading: true }));
		try {
			const { data } = await atlasApi.get<{
				subjects: SubjectPermission[];
				canTeachOutsideDepartment: boolean;
			}>(`/faculty/${facultyId}/subject-permissions`, { params: { schoolId } });
			setState((previous) => ({
				...previous,
				loading: false,
				unavailable: false,
				permissions: [...(data?.subjects ?? [])].sort((a, b) => a.code.localeCompare(b.code)),
				canTeachOutsideDepartment: data?.canTeachOutsideDepartment === true,
			}));
		} catch (error: any) {
			// A6 c10: 404 means A8 c4's route is not on this server. It is rendered as
			// `unavailable` and nothing else — a red toast for a route that is not
			// deployed yet would train a scheduler to distrust the control.
			const status = error?.response?.status;
			setState((previous) => ({
				...previous,
				loading: false,
				unavailable: status === 404 || status === 405,
				permissions: [],
			}));
		}
	}, [facultyId, schoolId]);

	// A change of teacher or school re-reads. Keyed on BOTH because the permission
	// list is per (teacher, school) and a stale one is a lie about authority.
	useEffect(() => {
		void read();
	}, [read]);

	const grant = useCallback(
		async (subjectId: number) => {
			if (facultyId == null || schoolId == null || writeBlockedReason) return;
			setState((previous) => ({ ...previous, grantInFlight: true }));
			try {
				const { data } = await atlasApi.post<{ created: boolean }>(
					`/faculty/${facultyId}/subject-permissions`,
					{ schoolId, subjectId },
				);
				setState((previous) => ({ ...previous, grantInFlight: false }));
				toast.success(data?.created === false
					? 'They could already teach this subject.'
					: 'They can now teach this subject.');
				await read();
				onChanged?.();
			} catch (error: any) {
				setState((previous) => ({ ...previous, grantInFlight: false }));
				toast.error(
					error?.response?.data?.message
					?? 'ATLAS could not grant that. Nothing was changed.',
				);
			}
		},
		[facultyId, onChanged, read, schoolId, writeBlockedReason],
	);

	const revoke = useCallback(
		async (subjectId: number) => {
			if (facultyId == null || schoolId == null || writeBlockedReason) return;
			setState((previous) => ({ ...previous, revokingSubjectId: subjectId }));
			try {
				// Contract §4: `subjectId` in the PATH, `schoolId` in the QUERY, and
				// NO request body. A body here is a 400 from a route that is explicit
				// about having none.
				await atlasApi.delete(`/faculty/${facultyId}/subject-permissions/${subjectId}`, {
					params: { schoolId },
				});
				setState((previous) => ({ ...previous, revokingSubjectId: null }));
				toast.success('That permission is removed.');
				await read();
				onChanged?.();
			} catch (error: any) {
				setState((previous) => ({ ...previous, revokingSubjectId: null }));
				toast.error(
					error?.response?.data?.message
					?? 'ATLAS could not remove that. Nothing was changed.',
				);
			}
		},
		[facultyId, onChanged, read, schoolId, writeBlockedReason],
	);

	/**
	 * The blanket flag, through the route that ALREADY owns it.
	 *
	 * `PUT /faculty/:facultyId` replaces a teacher's profile behind a version CAS,
	 * so this sends the teacher's own `version` and nothing else it did not read.
	 * A `409 VERSION_CONFLICT` re-reads the permissions (which carry the flag) and
	 * says the teacher changed underneath, rather than retrying a stale write.
	 */
	const setCanTeachOutsideDepartment = useCallback(
		async (next: boolean, version: number) => {
			if (facultyId == null || schoolId == null || writeBlockedReason) return;
			try {
				await atlasApi.put(`/faculty/${facultyId}`, {
					schoolId,
					canTeachOutsideDepartment: next,
					version,
				});
				toast.success(next
					? 'They may now be considered for subjects outside their department.'
					: 'That is off. Cross-department subjects now need a one-subject permission.');
				await read();
				onChanged?.();
			} catch (error: any) {
				if (error?.response?.status === 409) {
					await read();
					toast.error('This teacher changed while you were editing. Review the profile and try again.');
					return;
				}
				toast.error(
					error?.response?.data?.message
					?? 'ATLAS could not save that. Nothing was changed.',
				);
			}
		},
		[facultyId, onChanged, read, schoolId, writeBlockedReason],
	);

	return { ...state, read, grant, revoke, setCanTeachOutsideDepartment };
}
