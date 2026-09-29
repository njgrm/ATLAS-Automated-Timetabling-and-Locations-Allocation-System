/**
 * A6-TL-DEMAND-SOURCE-C01 correction (bounded, behaviour-identical).
 *
 * WHY THIS FILE EXISTS. `pages/TeachingLoad.tsx` stood at 989 physical lines.
 * `origin/main` advanced to `d84c9259` (998) and auto-merges cleanly with this
 * branch, but the union is 1002 — over the AGENTS.md §8 1000-physical-line cap
 * that the committed `A6C5-S9-1` guard enforces. The page's JSX regions
 * (toolbar slots, draft controls, modal props, grid props, test ids) are each
 * pinned by a committed source-text assertion, so moving one would break a
 * green control. The one coherent, UNPINNED block is the page's pure view-model:
 * `useMemo`/`useCallback` derivations that read `data`/`ui` and return values.
 *
 * WHAT MOVED, VERBATIM. `resolveSectionHoverDeltaMinutes`, `previewLoadHours`,
 * `placeholderFacultyIds`, `coverageHeadline`, `truthModel`,
 * `truthUnresolvedReasons`, and the `reviewModalCopy` destructure — with their
 * exact dependency lists, comments, and the ordering fact that
 * `placeholderFacultyIds` is resolved before `useTeachingLoadOutage` consumes
 * it. The page still decides WHEN to recompute (it calls this hook once); no
 * value, prop, word, test id, or rendered output changes.
 */
import { useCallback, useMemo } from 'react';

import { buildTeachingLoadTruthModel } from '@/lib/teaching-load-authority-truth';
import {
	buildCoverageHeadline,
	previewLoadHoursFor,
	reviewModalCopy,
	sectionHoverDeltaMinutesFor,
} from '@/components/faculty-assignments/teachingLoadWorkspaceMetrics';
import { useTeachingLoadData } from '@/hooks/useTeachingLoadData';
import { useTeachingLoadUI } from '@/hooks/useTeachingLoadUI';
import type { Subject } from '@/types';

type TeachingLoadDataModel = ReturnType<typeof useTeachingLoadData>;
type TeachingLoadUiModel = ReturnType<typeof useTeachingLoadUI>;

export function useTeachingLoadWorkspaceModel(input: {
	data: TeachingLoadDataModel;
	ui: TeachingLoadUiModel;
}) {
	const { data, ui } = input;

	// A6: the five derivations live in `teachingLoadWorkspaceMetrics.ts`, which
	// records the extraction; the page still decides WHEN to recompute.
	const resolveSectionHoverDeltaMinutes = useCallback((subject: Subject, sectionId: number) => {
		return sectionHoverDeltaMinutesFor(
			subject,
			sectionId,
			data.selected,
			data.selectedId,
			ui.policyReady,
			ui.workloadPolicy,
			data.effectiveAssignmentsByFaculty,
			data.subjects,
			data.sectionMap,
		);
	}, [data, ui.policyReady, ui.workloadPolicy]);

	const previewLoadHours = useMemo(() => {
		return previewLoadHoursFor(ui.loadProfile, ui.hoveredIncomingMinutes);
	}, [ui.loadProfile, ui.hoveredIncomingMinutes]);

	// Canonical truth surface, derived from the server contracts. A6 c5: resolved
	// BEFORE the shortage hook that takes it as a parameter — one derivation, two
	// consumers, so the truth panel and the header cannot disagree about who is a
	// to-be-hired record.
	const placeholderFacultyIds = useMemo(
		() => new Set(data.faculty.filter((member) => member.isPlaceholder).map((member) => member.id)),
		[data.faculty],
	);

	const coverageHeadline = useMemo(() => {
		return buildCoverageHeadline(data.coverageTotals);
	}, [data.coverageTotals]);

	const truthModel = useMemo(
		() => buildTeachingLoadTruthModel({
			diagnostics: data.authorityDiagnostics,
			placeholderFacultyIds,
			workloadPolicyStatus: data.workloadPolicyStatus,
		}),
		[data.authorityDiagnostics, data.workloadPolicyStatus, placeholderFacultyIds],
	);
	const truthUnresolvedReasons = useMemo(
		() => (data.authorityDiagnostics?.unresolvedReasons ?? []).map((reason) => ({ code: reason.code, message: reason.message })),
		[data.authorityDiagnostics],
	);

	// Returned as a PAIR so the title and the description can never come from
	// different branches — see `reviewModalCopy`'s header.
	const { title: reviewModalTitle, description: reviewModalDescription } = reviewModalCopy(
		ui.viewMode,
		data.selected,
	);

	return {
		resolveSectionHoverDeltaMinutes,
		previewLoadHours,
		placeholderFacultyIds,
		coverageHeadline,
		truthModel,
		truthUnresolvedReasons,
		reviewModalTitle,
		reviewModalDescription,
	};
}
