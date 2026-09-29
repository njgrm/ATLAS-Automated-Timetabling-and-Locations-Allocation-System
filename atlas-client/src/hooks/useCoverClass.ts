/**
 * A6 c10 — THE ONE OWNER of the cover-candidate read and the cover assignment.
 *
 * WHY A HOOK. Three properties of the write cannot be a `useState` away, and one
 * of them is a safety property:
 *
 *  1. **SCOPE IS REQUIRED, NEVER DEFAULTED.** The window is reachable from four
 *     surfaces, and `CreatePlaceholderDialog.tsx` already hard-codes a school-1
 *     default on this subsystem — so `schoolId` and `schoolYearId` are required
 *     parameters with no default and the hook refuses to dispatch without both.
 *     A missing scope is a no-op, never an implicit write to school 1.
 *
 *  2. **A SCOPE CHANGE INVALIDATES AN IN-FLIGHT REPLY.** The page already owns a
 *     `scopeEpochRef` for the suggestion path and `useCoverShortage` opens its
 *     own for the same reason: a late reply from the previous school must not
 *     repopulate the new school's window. It reuses `createScopeEpoch` /
 *     `captureEpoch`, so there is one mechanism rather than three.
 *
 *  3. **THE 409 → ALLOW → RETRY IS ONE FLOW, NOT TWO CALL SITES.** The packet's
 *     rule and contract §2's: a cross-department teacher is OFFERED, and choosing
 *     one raises a typed `NEEDS_PERMISSION` refusal whose answer is the same body
 *     with `grantPermission: true`, which writes the permission and the
 *     ownership in one transaction. If the retry lived at a call site, a second
 *     call site would forget it. So the retry is INSIDE `assign`, the
 *     permission prompt is state the window renders, and the only thing the
 *     window can do to a refusal is call `assign` again or `cancelPermission`.
 *
 * WHY THE CANDIDATE READ IS NOT CACHED ACROSS CLASSES. `hoursAfter` depends on
 * the class, so a cached list for subject A is a wrong answer for class B. The
 * hook holds ONE class's response and replaces it wholesale on every open, which
 * is also what makes a re-read after a grant honest: contract §4 says the grant
 * invalidates the qualification cache, so the very next read carries the new
 * permission and the teacher moves into "Teachers for this subject (allowed)".
 *
 * WHAT IT DELIBERATELY DOES NOT OWN. The ranking, the greying, the prompt
 * sentence and the counting rule all live in `coverClassCandidates`, which has
 * no React and no network. This hook owns WHEN, not WHAT.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { captureEpoch, createScopeEpoch } from '@/lib/scope-request-epoch';
import {
	permissionPrompt,
	type CoverAssignmentResult,
	type CoverCandidate,
	type CoverCandidatesResponse,
	type CoverCandidateTier,
	type NeedsPermissionBody,
	type PermissionPrompt,
} from '@/components/faculty-assignments/coverClassCandidates';

export type CoverClassTarget = {
	subjectId: number;
	subjectCode?: string;
	subjectName?: string;
	sectionId: number;
	sectionName: string;
	gradeLevel?: number | null;
	/** The class's weekly hours, when a read supplied it. Never synthesised. */
	weeklyHoursPerWeek?: number | null;
};

export type CoverClassState = {
	target: CoverClassTarget | null;
	response: CoverCandidatesResponse | null;
	loading: boolean;
	loadError: string | null;
	/** The teacher currently being written, or null. */
	assigningFacultyId: number | null;
	assignError: string | null;
	/** The typed refusal waiting for the scheduler's answer, or null. */
	permission: (PermissionPrompt & { facultyId: number; subjectId: number; sectionId: number }) | null;
	/** What the last successful assignment did, for the window's own outcome line. */
	outcome: { name: string; permissionCreated: boolean; weeklyMinutes: number | null } | null;
};

export type UseCoverClassParams = {
	schoolId: number | null;
	schoolYearId: number | null;
	/** Changes whenever the school or year changes; opens this hook's epoch. */
	scopeKey: string | null;
	/** Faculty ids the roster marks as to-be-hired, so a placeholder is never rendered. */
	placeholderFacultyIds?: ReadonlySet<number>;
	/** The page's own write gate; a read-only workspace never offers a write. */
	writeBlockedReason: string | null;
	/** Called after a successful assignment so the page can re-read its roster. */
	onAssigned?: () => void;
};

const EMPTY: CoverClassState = {
	target: null,
	response: null,
	loading: false,
	loadError: null,
	assigningFacultyId: null,
	assignError: null,
	permission: null,
	outcome: null,
};

export function useCoverClass({
	schoolId,
	schoolYearId,
	scopeKey,
	placeholderFacultyIds,
	writeBlockedReason,
	onAssigned,
}: UseCoverClassParams) {
	const [state, setState] = useState<CoverClassState>(EMPTY);
	const epochRef = useRef(createScopeEpoch());

	// A scope change closes the window and discards everything in it. A candidate
	// list, a permission prompt and an outcome all belong to the school that
	// produced them, and a late reply must not repopulate a new school.
	useEffect(() => {
		epochRef.current.begin();
		setState(EMPTY);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scopeKey]);

	const open = useCallback(
		(target: CoverClassTarget) => {
			if (schoolId == null || schoolYearId == null) {
				setState({
					...EMPTY,
					target,
					loadError: 'ATLAS needs a school and a school year before it can look for a teacher.',
				});
				return;
			}
			setState({ ...EMPTY, target, loading: true });
			const stillCurrent = captureEpoch(epochRef.current);
			atlasApi
				.get<CoverCandidatesResponse>(
					`/teaching-load/${schoolId}/${schoolYearId}/cover-candidates`,
					{ params: { subjectId: target.subjectId, sectionId: target.sectionId } },
				)
				.then(({ data }) => {
					if (!stillCurrent()) return;
					setState((previous) => ({
						...previous,
						loading: false,
						response: data ?? null,
						loadError: null,
					}));
				})
				.catch((error: any) => {
					if (!stillCurrent()) return;
					const status = error?.response?.status;
					setState((previous) => ({
						...previous,
						loading: false,
		loadError: status === 404
							? 'ATLAS cannot look up candidates for this class yet. The cover route is not on this server.'
							: error?.response?.data?.message
								?? 'ATLAS could not look up candidates for this class. Nothing was changed.',
					}));
				});
		},
		[schoolId, schoolYearId],
	);

	const close = useCallback(() => setState(EMPTY), []);

	/**
	 * The single Assign action, including the permission retry.
	 *
	 * `grantPermission` is a PARAMETER of the private request builder rather than
	 * of this function, so the two calls cannot drift on the body: the retry is
	 * literally the same object with one field set. A 409 whose `code` is
	 * anything OTHER than `NEEDS_PERMISSION` is not a permission problem and is
	 * surfaced as an error rather than re-offered as a prompt — re-asking for
	 * permission on a `SECTION_ALREADY_OWNED` would be a control that lies.
	 */
	const assign = useCallback(
		async (facultyId: number, grantPermission: boolean) => {
			const target = state.target;
			if (!target || schoolId == null || schoolYearId == null) return;
			if (writeBlockedReason) {
				setState((previous) => ({ ...previous, assignError: writeBlockedReason }));
				return;
			}
			const body = {
				facultyId,
				subjectId: target.subjectId,
				sectionId: target.sectionId,
				grantPermission,
			};
			const stillCurrent = captureEpoch(epochRef.current);
			setState((previous) => ({ ...previous, assigningFacultyId: facultyId, assignError: null, permission: null }));
			try {
				const { data } = await atlasApi.post<CoverAssignmentResult>(
					`/teaching-load/${schoolId}/${schoolYearId}/cover-assignments`,
					body,
				);
				if (!stillCurrent()) return;
				const name = state.response?.candidates.find((row) => row.facultyId === facultyId)?.name ?? 'The teacher';
				setState((previous) => ({
					...previous,
					assigningFacultyId: null,
					response: null,
					permission: null,
					outcome: {
						name,
						permissionCreated: Boolean(data?.permissionCreated),
						weeklyMinutes: typeof data?.weeklyMinutes === 'number' ? data.weeklyMinutes : null,
					},
				}));
				toast.success(
					data?.permissionCreated
						? `${name} may now teach this subject, and the class is theirs.`
						: `${name} now teaches this class.`,
				);
				onAssigned?.();
			} catch (error: any) {
				if (!stillCurrent()) return;
				const status = error?.response?.status;
				const payload = error?.response?.data;
				if (status === 409 && payload?.code === 'NEEDS_PERMISSION') {
					const details = payload as NeedsPermissionBody;
					const prompt = permissionPrompt(details);
					setState((previous) => ({
						...previous,
						assigningFacultyId: null,
						assignError: null,
						permission: {
							...prompt,
							facultyId: details.facultyId,
							subjectId: details.subjectId,
							sectionId: target.sectionId,
						},
					}));
					return;
				}
				setState((previous) => ({
					...previous,
					assigningFacultyId: null,
					assignError: payload?.actionHint
						?? payload?.message
						?? 'ATLAS could not assign this class. Nothing was changed; it is safe to try again.',
				}));
			}
		},
		[onAssigned, schoolId, schoolYearId, state.response, state.target, writeBlockedReason],
	);

	/**
	 * The answer to the Allow prompt: the IDENTICAL body with `grantPermission`
	 * true, which contract §2 says writes the permission and the ownership in one
	 * transaction. It is a separate name because it is a different DECISION, and a
	 * decision that can only be expressed by passing a boolean to the ordinary
	 * action is a decision the window can make by accident.
	 */
	const allowAndAssign = useCallback(() => {
		const pending = state.permission;
		if (!pending) return;
		void assign(pending.facultyId, true);
	}, [assign, state.permission]);

	/** Cancel is the safe answer, and it must leave no draft. */
	const cancelPermission = useCallback(() => {
		setState((previous) => ({ ...previous, permission: null, assigningFacultyId: null }));
	}, []);

	/** The candidate list, placeholders already gone. */
	const candidates = useMemo<CoverCandidate[]>(
		() => (state.response?.candidates ?? []).filter(
			(row) => !row.isPlaceholder && !placeholderFacultyIds?.has(row.facultyId),
		),
		[placeholderFacultyIds, state.response],
	);

	/** How many groups have any row at all — the window's empty state is about all three. */
	const tierCounts = useMemo(() => {
		const counts: Record<CoverCandidateTier, number> = { QUALIFIED: 0, OTHER_DEPARTMENT: 0, ANYONE: 0 };
		for (const row of candidates) counts[row.tier] += 1;
		return counts;
	}, [candidates]);

	return {
		...state,
		candidates,
		tierCounts,
		/** `Grade 8 – Rizal · MAPEH · 4 h/week` — the header the packet words. */
		headerLine: state.target ? coverClassHeaderLine(state.target) : '',
		open,
		close,
		assign,
		allowAndAssign,
		cancelPermission,
	};
}

/**
 * `Grade 8 – Rizal · MAPEH · 4 h/week`.
 *
 * Assembled from the target only, and the hours clause is DROPPED when no read
 * supplied it. A `4 h/week` invented from a default would be the exact class of
 * false claim this whole packet is about, and a header that reads
 * `Grade 8 – Rizal · MAPEH` is still a complete identification.
 */
export function coverClassHeaderLine(target: CoverClassTarget): string {
	const grade = target.gradeLevel != null ? `Grade ${target.gradeLevel}` : '';
	const section = target.sectionName.trim();
	const identity = [grade, section].filter(Boolean).join(' – ') || 'This class';
	const subject = (target.subjectCode || target.subjectName || '').trim();
	const hours = typeof target.weeklyHoursPerWeek === 'number' && Number.isFinite(target.weeklyHoursPerWeek)
		? `${target.weeklyHoursPerWeek} h/week`
		: null;
	return [identity, subject, hours].filter(Boolean).join(' · ');
}
