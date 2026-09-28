/**
 * A6 c5 §2 — the ONE owner of the `coverage/repair` call.
 *
 * WHY A HOOK AND NOT PAGE STATE. Three things must be true at once and none of
 * them is a `useState` away:
 *
 *  1. THE PREVIEW IS `apply:false`, ALWAYS, AND IT COMES FIRST. The endpoint is
 *     a write endpoint; `apply` is the only field that makes it write. This
 *     hook is the only place in the client that builds that body, so
 *     "preview first" is a property of the code rather than of a call site's
 *     discipline, and a test can read the request body instead of trusting a
 *     comment.
 *
 *  2. THE SCOPE IS THE PAGE'S OWN. `CreatePlaceholderDialog.tsx` hard-codes a
 *     school-1 default on the same subsystem. So `schoolId` and
 *     `schoolYearId` are REQUIRED parameters with no default, and the hook
 *     refuses to dispatch without both — a missing scope is a no-op, never an
 *     implicit write to school 1.
 *
 *     A6 c5 CORRECTION ROUND 1. This comment previously said the claim was
 *     "a committed negative control forbids that literal anywhere on this
 *     page", which was not true of THIS file: the school-1 control
 *     (`teaching-load-canonical-workload.test.ts`, `TL_POLICY_FREE_FILES`) read
 *     `pages/TeachingLoad.tsx` and the data hooks, and the page is not where
 *     the request body is built. The control now lists this file too, so the
 *     sentence above describes a real gate — and it discriminates: the moment
 *     this file was added to the list, the control failed on the very literal
 *     this comment used to quote, which is the evidence that the entry is read.
 *     (The identifier is therefore named here as "a school-1 default"; a comment
 *     that quoted the constant would be indistinguishable from a call site.)
 *     The behavioural half is decided separately, on the request BODY with a
 *     school that is not 1 (`A6C5-S4-2`) and on a refusal when the scope is
 *     missing (`A6C5-S4-3`). The source control catches a reintroduced literal;
 *     the behavioural control catches a default that is not a literal at all.
 *
 *  3. A SCOPE CHANGE INVALIDATES AN IN-FLIGHT REPLY. The page already owns a
 *     `scopeEpochRef` for the suggestion path, and this hook opens its own
 *     epoch for the same reason: a late `apply:true` reply from the previous
 *     school must not repopulate the new school's dialog. It reuses
 *     `createScopeEpoch` / `captureEpoch` so there is one mechanism.
 *
 * THE TWO NUMBERS ARE NEVER READ FROM `created` / `assignmentsCreated`. A8 c2
 * changed both to count persisted inserts only, so neither is a delivered
 * coverage figure; the plan's `plannedPairCount` is the preview number and
 * `stillUncoveredPairs` is the after-state. Both are read here, once.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { captureEpoch, createScopeEpoch } from '@/lib/scope-request-epoch';
import {
	COVER_OPTIONS,
	buildCoverDriftModel,
	buildCoverOutcomeModel,
	classNameForPair,
	type CoverDriftModel,
	type CoverOptionId,
	type CoverOutcomeModel,
} from '@/components/faculty-assignments/teachingLoadOutage';
import type { ExternalSection, Subject } from '@/types';

/** The subset of the A8 result this client reads, and nothing else. */
export type CoverRepairResult = {
	applied: boolean;
	plannedAssignments: Array<{
		subjectId: number;
		subjectCode: string;
		subjectName: string;
		assignableSectionIds: number[];
		deferredSectionIds: number[];
		plannedPairCount: number;
		teacherName: string;
		maxHoursPerWeek: number;
	}>;
	assignedPairs: Array<{ subjectId: number; sectionId: number; facultyId: number }>;
	stillUncoveredPairs: Array<{ subjectId: number; sectionId: number; facultyId: number }>;
	unresolvedSubjectRefs: string[];
};

export type UseCoverShortageParams = {
	schoolId: number | null;
	schoolYearId: number | null;
	subjects: Subject[];
	sectionMap: Map<number, ExternalSection>;
	/** Changes whenever the school or year changes; opens this hook's epoch. */
	scopeKey: string | null;
};

type OptionPreview = { plannedPairCount: number; classNames: string[] };

export function useCoverShortage({ schoolId, schoolYearId, subjects, sectionMap, scopeKey }: UseCoverShortageParams) {
	const [open, setOpen] = useState(false);
	const [subjectId, setSubjectId] = useState<number | null>(null);
	const [selectedOptionId, setSelectedOptionId] = useState<CoverOptionId>('standard-30');
	const [previews, setPreviews] = useState<Record<string, OptionPreview | undefined>>({});
	const [previewPending, setPreviewPending] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [drift, setDrift] = useState<CoverDriftModel | null>(null);
	const [outcome, setOutcome] = useState<CoverOutcomeModel | null>(null);
	const [applying, setApplying] = useState(false);
	const [applyError, setApplyError] = useState<string | null>(null);
	const epochRef = useRef(createScopeEpoch());

	// A scope change resets the WHOLE dialog, including a preview resolved under
	// the previous school's subjects — its class names came from that school's
	// section map. An effect, not a `useMemo`: this mutates state and opens an
	// epoch, and a `useMemo` may be re-run by the renderer for any reason.
	useEffect(() => {
		epochRef.current.begin();
		setOpen(false);
		setSubjectId(null);
		setSelectedOptionId('standard-30');
		setPreviews({});
		setPreviewPending(false);
		setPreviewError(null);
		setDrift(null);
		setOutcome(null);
		setApplying(false);
		setApplyError(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scopeKey]);

	const subject = useMemo(
		() => subjects.find((row) => row.id === subjectId) ?? null,
		[subjectId, subjects],
	);

	const openFor = useCallback((entry: { subjectId: number }) => {
		setSubjectId(entry.subjectId);
		setSelectedOptionId('standard-30');
		setPreviews({});
		setDrift(null);
		setOutcome(null);
		setApplyError(null);
		setPreviewError(null);
		setOpen(true);
	}, []);

	const close = useCallback(() => {
		setOpen(false);
		setOutcome(null);
		setDrift(null);
		setApplyError(null);
	}, []);

	/**
	 * The request body, built in ONE place.
	 *
	 * `apply` is a PARAMETER, not a constant, because both values are genuinely
	 * used — and because a single builder means the two calls cannot drift on
	 * anything else. `maxHoursPerWeek` is sent only when the option has one, so
	 * `Leave it open` never reaches the server at all.
	 */
	const buildRequest = useCallback((optionId: CoverOptionId, apply: boolean) => {
		const option = COVER_OPTIONS.find((row) => row.id === optionId);
		if (schoolId == null || schoolYearId == null || !subject || !option || option.maxHoursPerWeek == null) {
			return null;
		}
		return {
			schoolId,
			schoolYearId,
			subjectIds: [subject.id],
			maxHoursPerWeek: option.maxHoursPerWeek,
			teacherName: `${subject.name} — to be hired`,
			apply,
		};
	}, [schoolId, schoolYearId, subject]);

	/**
	 * `apply:false`, always. The server returns `plannedAssignments` identically
	 * for both values, so this is a real plan for free.
	 */
	const runPreview = useCallback(async () => {
		const body = buildRequest(selectedOptionId, false);
		if (!body) {
			setPreviewError('ATLAS needs a school year and a subject before it can check this.');
			return;
		}
		const stillCurrent = captureEpoch(epochRef.current);
		setPreviewPending(true);
		setPreviewError(null);
		setDrift(null);
		try {
			const { data } = await atlasApi.post<CoverRepairResult>('/faculty-assignments/coverage/repair', body);
			if (!stillCurrent()) return;
			const plan = (data.plannedAssignments ?? []).find((row) => row.subjectId === subject?.id)
				?? data.plannedAssignments?.[0];
			const classNames = (plan?.assignableSectionIds ?? []).map((sectionId) => (
				classNameForPair({ subjectId: plan?.subjectId ?? subject?.id ?? 0, sectionId }, subjects, sectionMap)
			));
			setPreviews((previous) => ({
				...previous,
				[selectedOptionId]: { plannedPairCount: plan?.plannedPairCount ?? 0, classNames },
			}));
		} catch (error: any) {
			if (!stillCurrent()) return;
			setPreviewError(
				error?.response?.data?.message
				?? 'ATLAS could not check what this would assign. Nothing was saved.',
			);
		} finally {
			if (stillCurrent()) setPreviewPending(false);
		}
	}, [buildRequest, sectionMap, selectedOptionId, subject, subjects]);

	const runApply = useCallback(async () => {
		const body = buildRequest(selectedOptionId, true);
		if (!body) {
			setApplyError('ATLAS needs a school year and a subject before it can assign a teacher.');
			return;
		}
		const stillCurrent = captureEpoch(epochRef.current);
		setApplying(true);
		setApplyError(null);
		try {
			const { data } = await atlasApi.post<CoverRepairResult>('/faculty-assignments/coverage/repair', body);
			if (!stillCurrent()) return;
			const model = buildCoverOutcomeModel({
				assignedPairs: data.assignedPairs ?? [],
				stillUncoveredPairs: data.stillUncoveredPairs ?? [],
				unresolvedSubjectRefs: data.unresolvedSubjectRefs ?? [],
				subjects,
				sectionMap,
			});
			setOutcome(model);
			toast.success(model.stillOpenLine);
		} catch (error: any) {
			if (!stillCurrent()) return;
			// The 409 drift body. The packet requires the changed classes NAMED,
			// in plain words, with a `Review again` control — and the names come
			// from the page's own subject/section data, never from an id.
			const details = error?.response?.data?.details;
			if (error?.response?.status === 409 && details) {
				setDrift(buildCoverDriftModel({
					driftScope: details.driftScope,
					details,
					subjects,
					sectionMap,
				}));
				setApplyError(null);
			} else {
				setApplyError(
					error?.response?.data?.actionHint
					?? error?.response?.data?.message
					?? 'ATLAS could not assign a teacher. Nothing was saved; it is safe to try again.',
				);
			}
		} finally {
			if (stillCurrent()) setApplying(false);
		}
	}, [buildRequest, sectionMap, selectedOptionId, subjects]);

	// `Review again` re-previews AND clears the drift gate, so the primary
	// action is reachable again only on a plan the scheduler has just seen.
	const reviewAgain = useCallback(() => {
		setDrift(null);
		setOutcome(null);
		void runPreview();
	}, [runPreview]);

	const selectedPreview = previews[selectedOptionId] ?? undefined;
	const previewClassNames = useMemo(() => {
		const list = selectedPreview?.classNames ?? [];
		// Bounded at ten, exactly as the 409 surface is, and the overflow is
		// named rather than dropped: a bounded list that does not say what it
		// hid is the same silence the packet is removing.
		return list.slice(0, 10);
	}, [selectedPreview]);

	return {
		open,
		openFor,
		close,
		subjectId,
		subjectName: subject?.name ?? '',
		selectedOptionId,
		onSelectOption: setSelectedOptionId,
		previews,
		previewClassNames,
		previewPending,
		previewError,
		drift,
		outcome,
		applying,
		applyError,
		onPreview: () => void runPreview(),
		onApply: () => void runApply(),
		onReviewAgain: reviewAgain,
	};
}
