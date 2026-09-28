/**
 * Teaching Load workspace DERIVED METRICS.
 *
 * A6, second pass: this is a pure extraction out of `pages/TeachingLoad.tsx`,
 * which the operator's item 38 pushed back over the AGENTS.md §8 1000-physical-
 * line cap. The item-38 fallback (extract the truth/summary wiring) could not be
 * used, because the committed control in
 * `src/lib/__tests__/tl-operator-workspace-c05-r3-truth.test.ts` asserts
 * `assert.match(page, /<TeachingLoadTruthPanel/)` and then inspects the 400
 * characters BEFORE that index. Moving the panel into a sibling surface would
 * have deleted the string that control reads, so a different block moved
 * instead. The one that moved is the one whose extraction costs the least
 * meaning.
 *
 * WHY THESE FOUR AND NOT OTHERS. Every function here was ALREADY a pure
 * derivation wearing a `useMemo` / `useCallback` as a formality: each reads
 * arguments and returns a value, and each had exactly one call site. Moving
 * them changes no behaviour, introduces no new authority, and cannot drift from
 * the page because there is nothing to keep in step — the page still decides
 * WHEN to recompute, and the module only says what the value is.
 *
 * This file therefore imports NO React, NO API client, and NO hook. That is
 * deliberate and is the property that makes the extraction safe: a page that has
 * quietly grown a side effect cannot hide in here.
 */
import {
	computeSectionAssignmentDeltaMinutes,
	resolveEffectiveLoadBaselineHours,
	type FacultyAssignmentDraft,
} from '@/lib/faculty-assignment-helpers';
import type { EffectiveWorkloadPolicyState } from '@/lib/faculty-teaching-load-cache';
import type {
	ExternalSection,
	FacultySummary,
	LoadProfile,
	Subject,
	TeachingLoadCoverageTotals,
} from '@/types';

/**
 * The coverage figures the header strip and the repair queue both read.
 *
 * `unassigned` is derived here rather than read from the server, because the
 * server's own `unassignedPairs` is the RAW total and the operator-facing figure
 * is `total - (real + placeholder)`: a class held by a temporary substitute is
 * staffed, so counting it as unassigned is what makes a fully-staffed roster
 * read as incomplete. `rawUnassigned` keeps the server's number available so a
 * caller can show both rather than quietly picking one.
 *
 * The all-zero fallback is a REAL state (no coverage totals yet), not an
 * error state, so every field is zeroed rather than left undefined.
 */
export type TeachingLoadCoverageHeadline = {
	assigned: number;
	realAssigned: number;
	syntheticAssigned: number;
	total: number;
	unassigned: number;
	rawUnassigned: number;
};

export function buildCoverageHeadline(
	coverageTotals: TeachingLoadCoverageTotals | null,
): TeachingLoadCoverageHeadline {
	if (coverageTotals) {
		const assigned = Math.max(0, coverageTotals.assignedPairs);
		const realAssigned = Math.max(0, coverageTotals.realFacultyAssignedPairs);
		const syntheticAssigned = Math.max(0, coverageTotals.syntheticPlaceholderPairs);
		const total = Math.max(0, coverageTotals.totalPairs);
		return {
			assigned,
			realAssigned,
			syntheticAssigned,
			total,
			unassigned: Math.max(0, total - (realAssigned + syntheticAssigned)),
			rawUnassigned: coverageTotals.unassignedPairs,
		};
	}
	return { assigned: 0, realAssigned: 0, syntheticAssigned: 0, total: 0, unassigned: 0, rawUnassigned: 0 };
}

/**
 * Active teachers above their own weekly maximum — the one count that blocks
 * generation outright, which is why it outranks the advisory excess count
 * everywhere it is shown.
 *
 * `actualTeachingHours ?? sectionTeachingHours` is the same fallback the row
 * readout uses, so the count and the rows cannot disagree about who is over.
 */
export function countTeachersAboveWeeklyMax(faculty: FacultySummary[]): number {
	return faculty.filter(
		(member) => member.isActiveForScheduling
			&& (member.actualTeachingHours ?? member.sectionTeachingHours ?? 0) > member.maxHoursPerWeek,
	).length;
}

/**
 * Credited hours plus whatever a hovered section would ADD, for the live
 * preview the inspector shows while a scheduler holds the pointer over a row.
 *
 * Hovered minutes are divided by 60, and the result is added to the CREDITED
 * total rather than the raw one: the preview has to agree with the figure the
 * row shows, and the row shows credited hours.
 */
export function previewLoadHoursFor(
	loadProfile: LoadProfile | null,
	hoveredIncomingMinutes: number,
): number {
	return (loadProfile?.creditedTotalHours ?? 0) + (hoveredIncomingMinutes / 60);
}

/**
 * The minutes a hovered section would move the SELECTED teacher's load by, for
 * the same preview.
 *
 * Returns 0 unless the effective policy, the teacher, and the scope are all
 * resolved: without a policy there is no honest number to preview, and a
 * preview that invents one is worse than no preview. This mirrors the row
 * readout's own fail-closed behaviour rather than softening it.
 */
export function sectionHoverDeltaMinutesFor(
	subject: Subject,
	sectionId: number,
	selected: FacultySummary | null,
	selectedId: number | null,
	policyReady: boolean,
	workloadPolicy: EffectiveWorkloadPolicyState | null,
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>,
	subjects: Subject[],
	sectionMap: Map<number, ExternalSection>,
): number {
	if (!policyReady || workloadPolicy == null || selected == null) return 0;
	return computeSectionAssignmentDeltaMinutes(
		subject,
		sectionId,
		effectiveAssignmentsByFaculty[selectedId ?? 0] ?? [],
		subjects,
		sectionMap,
		resolveEffectiveLoadBaselineHours(selected, workloadPolicy),
		workloadPolicy,
		selected.maxHoursPerWeek,
	);
}

/**
 * A6 C3 SLICE 1 — the workspace's ONE header state: what the page is working
 * from, in the page's own words.
 *
 * This was a 55-line `useMemo` inside `pages/TeachingLoad.tsx`, which put the
 * file 5 lines under the AGENTS.md §8 1000-physical-line cap. It was already a
 * pure function wearing a `useMemo` as a formality — seven `data.*` fields in,
 * four strings out, no React, no API — so it moved here with EVERY string
 * byte-for-byte. No copy was reworded in that move, and the branches are still
 * in the same order, because this slice is an extraction and nothing else. The
 * copy itself is A6 C3's later business, decided on its own evidence.
 */
export type TeachingLoadWorkspaceState = {
	label: string;
	description: string;
	nextAction: string;
	writeBlockedReason: string | null;
};

export function buildTeachingLoadWorkspaceState(input: {
	isOnline: boolean;
	dataSource: 'live' | 'cached' | 'refreshing' | 'none';
	canPersistAssignments: boolean;
	activeDraftCount: number;
	degradedNotice: string | null;
	error: string | null;
}): TeachingLoadWorkspaceState {
	if (!input.isOnline) {
		return {
			label: 'Offline',
			description: 'ATLAS is showing the last saved teaching load. Changes stay off until the connection returns.',
			nextAction: 'Reconnect, then refresh before saving assignments.',
			writeBlockedReason: 'Saving is off until ATLAS reconnects. Your work is safe to review.',
		};
	}
	if (input.dataSource === 'refreshing') {
		return {
			label: 'Checking source',
			description: 'ATLAS is comparing the saved workspace with EnrollPro. The last saved snapshot remains visible while this finishes.',
			nextAction: 'Wait for verification before saving new changes.',
			writeBlockedReason: 'Saving is off while ATLAS verifies the roster with EnrollPro.',
		};
	}
	if (input.dataSource === 'live' && input.canPersistAssignments) {
		return {
			label: 'EnrollPro roster verified',
			description: 'ATLAS Teaching Load draft. Assignment data was checked against EnrollPro. Draft changes can be saved.',
			nextAction: input.activeDraftCount > 0 ? 'Save the draft changes before leaving this page.' : 'Inspect one teacher or fill section coverage gaps.',
			writeBlockedReason: null,
		};
	}
	if (input.dataSource === 'cached' && input.canPersistAssignments) {
		return {
			label: 'ATLAS Teaching Load draft',
			description: input.degradedNotice ?? 'ATLAS is using synced EnrollPro section data for Teaching Load. This is expected. Draft changes can be saved.',
			nextAction: input.activeDraftCount > 0 ? 'Save your changes. Refresh later to pick up any new EnrollPro changes.' : 'Check the classes below. Refresh later to pick up any new EnrollPro changes.',
			writeBlockedReason: null,
		};
	}
	if (input.dataSource === 'cached') {
		return {
			label: 'Read-only saved data',
			description: input.degradedNotice ?? 'ATLAS can show the saved assignments, but it cannot safely save changes yet.',
			nextAction: 'Refresh from EnrollPro before saving, suggesting, or resetting assignments.',
			writeBlockedReason: 'Saving is off until ATLAS reconnects to EnrollPro.',
		};
	}
	return {
		label: 'No assignment data',
		description: input.error ?? 'ATLAS could not load a live source or a saved teaching load.',
		nextAction: 'Retry the connection before assigning teachers.',
		writeBlockedReason: 'Saving is off because no teaching load data is available.',
	};
}

/**
 * The review dialog's title and description, for the selected teacher OR the
 * selected section.
 *
 * A6 C2 (Slice 5, Minor 7) — THE TITLE NAMES THE ROSTER-LEVEL PURPOSE, AND THE
 * DESCRIPTION NAMES THE SUBJECT.
 *
 * Lane C: the neutral `Review teachers` control opened `TEACHER WORKLOAD:
 * VALDEZ, GABRIELA LUZ` — a dialog exposing Total/Underloaded/Balanced/Overloaded
 * filters over a 42-person roster. The title presented a ROSTER-WIDE audit as one
 * person's profile, and neither the label nor the copy explained why Valdez was
 * the subject.
 *
 * So the title is constant for the teacher view — `Staff workload audit` — and
 * when a teacher IS selected the DESCRIPTION says so, in words, instead of the
 * title implying it by naming somebody. `data.selected`, not `selectedId`, is the
 * input, because a stale id resolves to `null` and would otherwise render a
 * named description for nobody.
 *
 * The strings are still returned TOGETHER so they can never be taken from
 * different branches: a roster-audit title beside a section-coverage description
 * is exactly the mismatch this function prevents. The RETURN SHAPE IS UNCHANGED
 * (`{ title, description }`), so every committed control that reads it keeps
 * working — the fix is the string, not the contract.
 */
export function reviewModalCopy(
	viewMode: string,
	selected: { lastName: string; firstName: string } | null,
): { title: string; description: string } {
	if (viewMode !== 'teacher') {
		return {
			title: 'Review section',
			description: 'Section coverage and ownership for the selected section.',
		};
	}
	if (!selected) {
		return {
			title: 'Staff workload audit',
			description: 'Every active teacher’s teaching load and capacity. Choose a teacher in the list to narrow it to one person.',
		};
	}
	return {
		title: 'Staff workload audit',
		description: `Narrowed to ${selected.lastName}, ${selected.firstName}. This is one person inside the staff-wide workload audit; their teaching load, capacity, and the next safe action.`,
	};
}
