import { useMemo, useState, type ReactNode } from 'react';
import { Zap, Settings2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs';
import { cn } from '@/lib/utils';
import { SmartHelpTrigger } from '@/components/smart/SmartPageShell';
import { CompactTitleStrip, COMPACT_TITLE_STRIP_CLASS } from '@/components/app-shell/CompactTitleStrip';
import { TeachingLoadSummaryMenuItem, TeachingLoadSummaryMenuSlot } from '@/components/faculty-assignments/TeachingLoadSummarySurface';
import { teachingLoadDegradedCopy } from '@/components/faculty-assignments/teachingLoadDegradedCopy';
import type { CoverageMode } from '@/types';

type WorkspaceToolbarProps = {
	realAssignedPairs: number;
	syntheticPlaceholderPairs: number;
	unassignedPairs: number;
	totalPairs: number;
	overCapCount: number;
	excessTeachingCount: number;
	policyReady: boolean;
	onShowExcessTeachingLoad: () => void;
	onShowTemporarySubstitutes: () => void;
	autoFillLoading: boolean;
	autoFillEnabled: boolean;
	onAutoFillClick: () => void;
	viewMode: string;
	onViewModeChange: (value: string) => void;
	dataSource: 'live' | 'cached' | 'refreshing' | 'none';
	degradedWriteEnabled: boolean;
	isWorkspaceWritable: boolean;
	isOnline: boolean;
	dataSourceNotice: string | null;
	coverageMode: CoverageMode;
	onCoverageModeChange: (mode: CoverageMode) => void;
	coverageModeConfig: Record<CoverageMode, { label: string; description: string }>;
	workspaceStateLabel: string;
	workspaceStateDescription: string;
	workspaceStateNextAction: string;
	activeDraftCount: number;
	saving: boolean;
	onSave: () => void;
	onRetrySource: () => void;
	/**
	 * A3-C10-S3 — the page's compact state line, rendered INSIDE row 2 beside the
	 * `% staffed` / `Classes without a teacher` / alert chips.
	 *
	 * Before this prop the page stacked the truth summary, the repair queue and
	 * the archived-load control as three further `shrink-0` bands under the
	 * strip, so the first assignment row sat at ~430px of a 768px viewport. They
	 * are one horizontal line now, and this slot is how they get there without
	 * this component having to know what they are.
	 *
	 * The slot is NOT a disclosure: whatever the page passes must be visible and
	 * self-announcing. A caller that wants a popover must put the count or state
	 * on the trigger (see the repair queue's "N to fix" contract).
	 */
	stateLineSlot?: ReactNode;
	/**
	 * A6 c5 §1 — the page's shortage line, rendered INSTEAD of this toolbar's own
	 * status sentence when there is a real shortage.
	 *
	 * This is a SLOT for the same reason `stateLineSlot` is: the line's figures
	 * come from the page's ownership index, which this component has no access
	 * to, and a toolbar that recomputed them would be a second authority for the
	 * one number the header exists to state. The toolbar keeps the POSITION and
	 * the SUPPRESSION RULE; the page keeps the figures.
	 *
	 * `null` or absent means "no shortage", and the status sentence renders
	 * exactly as it always has — so every committed row that renders this
	 * component without the slot is untouched.
	 */
	shortageLineSlot?: ReactNode;
	/**
	 * FIX 38 / A6 c6 item 2 — the header's `Load summary` control.
	 *
	 * This is a SLOT, not a callback, on purpose. The toolbar owns the control's
	 * POSITION in the action group and nothing else: the open flag and the dialog
	 * belong to `TeachingLoadSummarySurface`, and the panel body belongs to the
	 * page. A callback here would force the page to own all three, which is what
	 * pushed it over the AGENTS.md §8 line cap and what would let the dialog's
	 * figures drift from the page's `truthModel`.
	 *
	 * A6 c6 moved that position from row 1 into the `More` menu. The slot contract
	 * is UNCHANGED — the page still builds `TeachingLoadSummarySurface` and still
	 * hands it over; only the place it renders changed, and the toolbar says so
	 * with `TeachingLoadSummaryMenuSlot` rather than by asking the page to know.
	 */
	loadSummaryAction?: ReactNode;
	/**
	 * A6 C2 (Major 1) — the `Archived load` navigation link, MOVED out of the
	 * state line and into this toolbar's More menu.
	 *
	 * Lane C measured the state line trying to hold 1,070px: 140px `% staffed`,
	 * 231px `Classes without a teacher`, a 451px summary, a 223px next-step
	 * chip, a 169px Assign, and a 117px `Archived load` link. The link was the
	 * only one of those that is NAVIGATION rather than state, and the operator's
	 * target header keeps `Archived load` out of the two status rows. It is still
	 * a real link to `/teaching-load/history`, the PAGE still builds it (so
	 * `client-quality-c01` and `a6-teaching-load-surface` keep one place to read
	 * the reachability claim), and only its POSITION moves — into the More
	 * dropdown, where a settings-adjacent destination belongs.
	 */
	historyAction?: ReactNode;
	/**
	 * A6 C2 (Major 2) — when the last successful Teaching Load snapshot was
	 * fetched, as a display string the PAGE derived from a real field.
	 *
	 * It exists for the degraded line. `SectionSummaryResponse.fetchedAt` is the
	 * only timestamp the client genuinely holds, so the page supplies that when
	 * it has one and `null` otherwise, and the degraded sentence drops the
	 * `from <time>` clause rather than inventing a time. A fabricated
	 * "saved from 09:14" next to a number we cannot verify is the exact class of
	 * claim this packet exists to remove.
	 */
	savedAtLabel?: string | null;
};

/**
 * A3-C10-S3 — TEACHING LOAD HEADER HEIGHT MODEL (768px-tall viewport).
 *
 * JSDOM performs no layout, so this is the declared model the committed
 * control checks, and the control re-derives every number from the class
 * strings below. Tailwind's scale is what it is: `py-1` = 4px per side, `h-7`
 * = 28px, `border-t` = 1px. Change a size here and the control goes red, which
 * is the point: the numbers live next to the classes that produce them.
 *
 *   APP_CHROME_PX            56   the `3.5rem` app bar above the route root
 *                                     (`h-[calc(100svh-3.5rem)]` in the page)
 *   STRIP_CONTAINER_BOX_PX    9   CompactTitleStrip `py-1` (8) + `border-b` (1)
 *   ROW_1_COMMAND_PX         28   tallest control in the command row: the
 *                                     `h-7` Help / Preview / More buttons
 *   ROW_2_BORDER_PX           1   the `border-t` hairline between the rows
 *   ROW_2_CHIP_PX            28   tallest chip in the state line (`h-7`)
 *   ROW_2_BAND_PX            29   1 + 28: the whole of row 2
 *   ---------------------------------------------
 *   HEADER_TOTAL_PX          66   9 + 28 + 29
 *
 * BEFORE this change the same stack was FIVE rows, not three, and the numbers
 * below are DERIVED by the committed control from the base class strings rather
 * than estimated:
 *   9 (strip) + 28 (command) + 45 (tab row: mt-1.5 6 + border-t 1 + pt-1.5 6
 *     + h-8 32) + 41 (readiness: mt-1.5 6 + border-t 1 + pt-1.5 6 + h-7 28)
 *     + 42 (truth summary band) + 58 (next-step banner: py-1 8 + border 2
 *     + p-1.5 12 + its h-9 action row 36)
 *     = 223px, and the first assignment row measured ~430px from the viewport
 *       top at 1366x768 (Lane C, live release a1db27d5).
 *   The saving is 157px, which is ~3.9 more 40px assignment rows.
 *
 * A6 c4 (G2) — ROW 2 IS NO LONGER A PACKING, AND THE MODEL SAYS SO. Every number
 * above is re-derived from the class strings on the candidate's own markup by
 * `__tests__/a3-c10-tl-header-density.test.ts`, not carried over; the derived
 * total is still 66px because the tallest member of row 2 is still the `h-7`
 * next-step action. What changed is what row 2 is allowed to do, and the four
 * entries below record the superseded arrangement as declared values rather than
 * leaving it only in prose:
 *
 *   ROW_2_SUPERSEDED_TRUNCATE_COUNT     5  header: 2 (`statusSentence`,
 *                                            `degradedLine`); next step: 3
 *                                            (title, disabled reason, action
 *                                            label). All five cut a claim off
 *                                            mid-word. The operator's rule is
 *                                            "no sentence is cut off with an
 *                                            ellipsis", so they are gone and
 *                                            `a6-tl-header-budget` fails if any
 *                                            one comes back.
 *   ROW_2_SUPERSEDED_AMBER_PILL_COUNT   1  the `disabledReason` rendered as its
 *                                            own `bg-warning-muted` pill beside
 *                                            the header's amber degraded notice:
 *                                            Lane C's "two amber lines when
 *                                            EnrollPro is unreachable". It is
 *                                            now visible text inside the next
 *                                            step's own chip.
 *   ROW_2_WRAP_LINE_PX                 16  one `text-xs` line box — the unit the
 *                                            row's wrap fallback adds. Declared
 *                                            so the cost of not cutting a
 *                                            sentence is a number, not a shrug.
 *   HEADER_TOTAL_IF_SENTENCE_WRAPS_PX   74  9 + 28 + 1 + 32 + 4, i.e. row 2 with
 *                                            the status sentence on two lines
 *                                            (2 x 16) plus its `py-0.5`. This
 *                                            is OVER the 70px budget, which is
 *                                            the point: it is why the row
 *                                            measures its declared content
 *                                            against the 1366px row instead of
 *                                            relying on the wrap. 74 - 66 = 8px
 *                                            is what "undo the squeeze" costs
 *                                            when the content does not fit, and
 *                                            the measurement exists to keep that
 *                                            case from becoming the normal one.
 */
/**
 * A3-C10-S3 — WHERE ROW 2 CAME FROM, and why nothing is hidden in it.
 *
 * The truth summary (42px), the "Next step" repair-queue banner (58px) and the
 * archived-load control were three `shrink-0` bands stacked under this strip.
 * At 1366x768 that put the first assignment row at ~430px of 768 (Lane C, live
 * release a1db27d5) under five stacked header rows. They are ONE line now, and
 * row 2 is where the record of that move lives — this component owns the row.
 *
 * NOTHING WAS HIDDEN, only relocated: the truth panel kept every figure and
 * testid in the `Load summary` dialog (built by the page from its own
 * `truthModel`), the repair queue kept its count, live status, safety
 * `disabledReason` and primary action, and `Archived load` is still a real link
 * to `/teaching-load/history` — the page builds it, this component positions it
 * in More. Only the repair queue's prose `description` moved behind a hover,
 * whose trigger already names the task, the count and the status.
 *
 * A6 c5 then removed two more things from this row, and the reasons are stated
 * at the two sites that do it: the `% staffed` figure (which counted a
 * placeholder-held class as staffed) and the `missing-load` repair-queue item
 * (which routed a scheduler to another tab to learn which subject was short).
 * Both are replaced by `TeachingLoadShortageLine`, supplied by the page through
 * `shortageLineSlot`.
 */
export const TEACHING_LOAD_HEADER_MODEL = {
	APP_CHROME_PX: 56,
	STRIP_CONTAINER_BOX_PX: 9,
	ROW_1_COMMAND_PX: 28,
	ROW_2_BORDER_PX: 1,
	ROW_2_CHIP_PX: 28,
	/** 1 + 28: the whole of row 2. */
	ROW_2_BAND_PX: 29,
	/** 9 + 28 + 29 */
	HEADER_TOTAL_PX: 66,
	/**
	 * The pre-change stack, derived by the committed control from the base
	 * class strings: 9 + 28 + 45 + 41 + 42 + 58.
	 */
	PRE_CHANGE_HEADER_TOTAL_PX: 223,
	/** Lane C's recorded first-data-row y-offset, 1366x768, release a1db27d5. */
	MEASURED_FIRST_ROW_BASELINE_PX: 430,
	/** A6 c4 (G2) — the five `truncate` class strings row 2 used to carry. */
	ROW_2_SUPERSEDED_TRUNCATE_COUNT: 5,
	/** A6 c4 (G2) — the second filled amber pill, removed. */
	ROW_2_SUPERSEDED_AMBER_PILL_COUNT: 1,
	/** A6 c4 (G2) — one `text-xs` line box, the wrap fallback's unit. */
	ROW_2_WRAP_LINE_PX: 16,
	/** A6 c4 (G2) — 9 + 28 + 1 + 32 + 4, the cost of not cutting a sentence. */
	HEADER_TOTAL_IF_SENTENCE_WRAPS_PX: 74,
} as const;

/*
 * A6 C2: `STRIP_TONE` is GONE, and deliberately so. The four-tone pill palette
 * existed only to colour the two `% staffed` / `Classes without a teacher` pills
 * and the alert pill on row 2. Row 2 is now one sentence that uses the ordinary
 * foreground colour plus `text-destructive` for the alert clause, and the
 * degraded line uses the shared `border-warning-border bg-warning-muted
 * text-warning-foreground` warning treatment the rest of ATLAS already uses. A
 * second private colour vocabulary for four pills was one more thing to keep in
 * step with the theme, and there are no pills left to keep in step.
 */

/**
 * A6 C2 CORRECTION — the ONE definition of "the Teaching Load source is not
 * verified", exported so the page can hand the SAME answer to the repair queue.
 *
 * It exists because two consumers must never disagree. This component decides
 * whether row 2 prints the amber `EnrollPro not reachable` line INSTEAD of a
 * derived count, and `pages/TeachingLoad.tsx` decides whether the repair queue
 * withholds its own derived figures. A second, separately-written copy of the
 * rule in either place would let a scheduler read "EnrollPro not reachable" and
 * "Teaching Load looks ready" in the same glance — which is exactly the defect
 * the correction exists to close, and exactly what the first QA pass rendered.
 *
 * `refreshing` is NOT degraded, and is checked BEFORE the notice on purpose:
 * ATLAS is actively asking EnrollPro, so "not reachable" would be a lie
 * mid-check, and a notice left over from an earlier attempt must not turn a live
 * check into a claim of failure. The order below is therefore load-bearing and is
 * the same order `degradedTail` used, so the header's own copy is unchanged.
 */
export function isTeachingLoadSourceDegraded(input: {
	dataSource: WorkspaceToolbarProps['dataSource'];
	isOnline: boolean;
	dataSourceNotice: string | null;
}): boolean {
	if (!input.isOnline) return true;
	if (input.dataSource === 'refreshing') return false;
	return input.dataSource !== 'live' || Boolean(input.dataSourceNotice);
}

/*
 * A6 C3 (N-1 / N-3) — THE WIDER QUESTION, AND THE CAUSE IT ACTUALLY HAS.
 *
 * `isTeachingLoadSourceDegraded` above answers ONE narrow question: is there
 * something wrong with the source right now, in the sense that justifies an
 * amber line? It deliberately says `false` for `refreshing`, because ATLAS is
 * actively asking EnrollPro and "not reachable" would be a lie mid-check.
 *
 * That narrowness is correct for the amber line and wrong for a FIGURE. While
 * ATLAS is `refreshing`, the coverage totals, the over-cap count and the
 * teacher's hours on screen all still describe the LAST SAVED snapshot — they
 * are simply not confirmed yet. So the wider question is its own predicate:
 * "are the figures on this page confirmed?", answered by
 * `isTeachingLoadSourceUnverified`. It is wider in two ways: `refreshing` is
 * unverified, and it needs no `dataSourceNotice`, because a stale notice left
 * over from an earlier attempt says nothing about whether the CURRENT numbers
 * are confirmed.
 *
 * WHY IT REFUSES TO NAME A CAUSE IT DOES NOT HAVE. The three functions below
 * are the one place the withheld string is written, so the header's amber line
 * and the repair queue's per-row status cannot disagree about WHY a number is
 * missing — which is defect N-3, where `OFFLINE` and `NONE` were both labelled
 * "EnrollPro is not reachable". That is false when ATLAS is the thing that is
 * down, and false when there is no source to reach. Naming the cause the page
 * actually has is the point: an operator who reads "ATLAS is offline" knows
 * that waiting will not help, and one who reads "no live Teaching Load source
 * is available" knows to look upstream, while "EnrollPro not reachable" is the
 * one answer that covers all three cases and is therefore only sometimes true.
 *
 * The `cached` + online case is the one a scheduler meets most often. A6 c6 item 4
 * changed its wording — the reason, not the fact, is at the comment on
 * `teachingLoadUnverifiedStatus` below.
 */
export function isTeachingLoadSourceUnverified(input: {
	dataSource: WorkspaceToolbarProps['dataSource'];
	isOnline: boolean;
}): boolean {
	return !input.isOnline || input.dataSource !== 'live';
}

export function teachingLoadUnverifiedReason(input: {
	dataSource: WorkspaceToolbarProps['dataSource'];
	isOnline: boolean;
}): string {
	if (!input.isOnline) return 'ATLAS is offline';
	if (input.dataSource === 'refreshing') return 'ATLAS is checking EnrollPro now';
	if (input.dataSource === 'none') return 'no live Teaching Load source is available';
	return 'EnrollPro not reachable';
}

/*
 * A6 c6 item 4 — the withheld SENTENCE, and why it is now four plain sentences.
 *
 * The base wrote `Unverified — EnrollPro is not reachable, so this figure is
 * withheld.` in all four states. Lane C, verbatim: that is 68 characters, a product
 * name, and the word "withheld", which a scheduler cannot act on. This is the ONE
 * function that writes it, so this is the one place the four plain sentences live.
 *
 * EACH STATE SAYS WHAT IS UNAVAILABLE AND NOTHING ELSE. No product name on the calm
 * face: `teachingLoadUnverifiedReason` above is the technical clause, and it now
 * feeds the pill's Tooltip and the page's `Help` step, which is where a cause
 * belongs. No em dash either — the base used one to bolt a label onto a clause, and
 * the result read as two things rather than one sentence.
 *
 * The four stay DISTINGUISHABLE, which is the property the base lost by collapsing
 * `OFFLINE` and `NONE` into one EnrollPro-shaped answer: an operator who reads
 * "ATLAS is offline" knows waiting will not help.
 */
export function teachingLoadUnverifiedStatus(input: {
	dataSource: WorkspaceToolbarProps['dataSource'];
	isOnline: boolean;
}): string {
	if (!input.isOnline) return 'ATLAS is offline, so these numbers cannot be checked.';
	if (input.dataSource === 'refreshing') return 'ATLAS is checking the live roster now, so these numbers are not confirmed yet.';
	if (input.dataSource === 'none') return 'No live Teaching Load source is available, so these numbers cannot be checked.';
	return 'These numbers come from the last saved roster, not the current one.';
}

export function WorkspaceToolbar({
	realAssignedPairs,
	syntheticPlaceholderPairs,
	unassignedPairs,
	totalPairs,
	overCapCount,
	excessTeachingCount,
	policyReady,
	onShowExcessTeachingLoad,
	onShowTemporarySubstitutes,
	autoFillLoading,
	autoFillEnabled,
	onAutoFillClick,
	viewMode,
	onViewModeChange,
	dataSource,
	degradedWriteEnabled,
	isWorkspaceWritable,
	isOnline,
	dataSourceNotice,
	coverageMode,
	onCoverageModeChange,
	coverageModeConfig,
	workspaceStateLabel,
	workspaceStateDescription,
	workspaceStateNextAction,
	activeDraftCount,
	saving,
	onSave,
	onRetrySource,
	stateLineSlot,
	shortageLineSlot,
	loadSummaryAction,
	historyAction,
	savedAtLabel = null,
}: WorkspaceToolbarProps) {
	/*
	 * A6 c5 S3 — THE COMPUTATION, not the slot.
	 *
	 * `syntheticPlaceholderPairs` used to be ADDED into the numerator, so a
	 * class held by a to-be-hired record counted as staffed. Suppressing the
	 * figure while a shortage line is showing hid the slot, not the arithmetic:
	 * any other consumer of this component would still have been told 25
	 * classes had a teacher. A placeholder is not a teacher, so the numerator is
	 * `realAssignedPairs` alone and the denominator is unchanged.
	 */
	const completenessPercent = totalPairs > 0 ? Math.round((realAssignedPairs / totalPairs) * 100) : 0;

	const statusConfig = useMemo(() => {
		if (!isOnline) return { label: 'Offline', color: 'bg-amber-500', description: 'Disconnected from the server. Changes are locked until ATLAS reconnects.' };
		if (dataSource === 'refreshing') return { label: 'Checking source', color: 'bg-blue-500 animate-pulse', description: dataSourceNotice ?? 'Verifying live data before edits continue.' };
		if (dataSource === 'live') return { label: 'EnrollPro roster verified', color: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]', description: 'ATLAS Teaching Load draft. Freshly verified. Draft changes can be saved.' };
		if (isWorkspaceWritable) return { label: 'ATLAS Teaching Load draft', color: 'bg-amber-500', description: dataSourceNotice ?? 'ATLAS is using synced EnrollPro section data for Teaching Load. This is expected.' };
		if (degradedWriteEnabled) return { label: 'ATLAS Teaching Load draft', color: 'bg-amber-500', description: dataSourceNotice ?? 'ATLAS is using synced EnrollPro section data for Teaching Load. This is expected.' };
		return { label: 'Read-only', color: 'bg-blue-500', description: dataSourceNotice ?? 'Viewing a saved snapshot. Edits need source verification first.' };
	}, [isOnline, dataSource, isWorkspaceWritable, degradedWriteEnabled, dataSourceNotice]);

	const primaryAction = useMemo(() => {
		if (dataSource === 'refreshing') {
			return {
				label: 'Checking source',
				shortLabel: 'Checking',
				isSuggestion: false,
				onClick: onRetrySource,
				disabled: true,
				variant: 'outline' as const,
				helper: 'ATLAS is checking live assignment data.',
			};
		}
		if (!isOnline || dataSource === 'none') {
			return {
				label: isOnline ? 'Retry source' : 'Offline',
				shortLabel: isOnline ? 'Retry' : 'Offline',
				isSuggestion: false,
				onClick: onRetrySource,
				disabled: !isOnline,
				variant: 'outline' as const,
				helper: isOnline ? 'Try loading teaching load data again.' : 'Reconnect before retrying.',
			};
		}
		/*
		 * A6 C2 (Major 1): the operator's own words are `Suggest assignments`,
		 * SECONDARY, not red. The old label was `Preview suggested assignments`
		 * and the old call site forced `border border-primary/20 bg-primary/5
		 * … text-primary` on top of the `secondary` variant, so it READ as the
		 * page's primary action in primary colour while doing nothing until a
		 * second dialog. The label is now the operator's, the primary tint is
		 * gone, and the button is honestly a secondary one.
		 */
		return {
			label: 'Suggest assignments',
			shortLabel: 'Suggest',
			isSuggestion: true,
			onClick: onAutoFillClick,
			disabled: autoFillLoading || !autoFillEnabled,
			variant: 'secondary' as const,
			helper: autoFillEnabled ? 'Preview ATLAS suggestions before any Teaching Load rows are saved. Nothing is applied until you confirm.' : 'Suggestions need live writable data.',
		};
	}, [autoFillEnabled, autoFillLoading, dataSource, isOnline, onAutoFillClick, onRetrySource]);

	// State-driven alert chip: surfaces only when something needs attention.
	// Priority: above-weekly-maximum classes (generation blocker) > excess teaching
	// load (actual teaching above the standard) > temporary teacher placeholders.
	const alertChip = useMemo(() => {
		if (overCapCount > 0) {
			return {
				key: 'overcap',
				label: `Above weekly max: ${overCapCount}`,
				tone: 'danger' as const,
				tooltip: 'Active teachers above the weekly maximum. Review the filtered teacher list and move classes before generating.',
				onClick: onShowExcessTeachingLoad,
				disabled: false,
				testId: 'teaching-load-alert-over-cap',
			};
		}
		if (policyReady && excessTeachingCount > 0) {
			return {
				key: 'excess',
				label: `Excess teaching load: ${excessTeachingCount}`,
				tone: 'warning' as const,
				tooltip: 'Active teachers with actual teaching above the standard. Advisory credit never counts toward this figure.',
				onClick: onShowExcessTeachingLoad,
				disabled: false,
				testId: 'teaching-load-alert-excess',
			};
		}
		if (syntheticPlaceholderPairs > 0) {
			return {
				key: 'teacherx',
				label: `Temporary substitutes: ${syntheticPlaceholderPairs}`,
				tone: 'warning' as const,
				tooltip: 'Temporary substitutes are filling load rows. Open the filtered teacher list to replace them before generating.',
				onClick: onShowTemporarySubstitutes,
				disabled: false,
				testId: 'teaching-load-alert-teacher-x',
			};
		}
		return null;
	}, [overCapCount, excessTeachingCount, policyReady, syntheticPlaceholderPairs, onShowExcessTeachingLoad, onShowTemporarySubstitutes]);

	/*
	 * A6 C2 (Major 2) — the degraded-data gate for the WHOLE header.
	 *
	 * Lane C's second finding: `% staffed 100%` and `Classes without a teacher 0`
	 * sat beside `Unknown number of classes`, `Not available`, and a page that
	 * said it was using saved data because EnrollPro could not be reached. A
	 * scheduler could conclude staffing was complete. While the figures are NOT
	 * verified, row 2 therefore renders ONE amber line and NO derived count at
	 * all — the number is withheld, not relabelled, so nothing live-looking can
	 * ever sit next to an unknown again.
	 *
	 * `refreshing` is deliberately NOT degraded: ATLAS is actively asking
	 * EnrollPro, and "not reachable" would be a lie mid-check. It gets its own
	 * honest line instead. Offline and `none` are degraded but say so in their
	 * own words, because "EnrollPro not reachable" is false when ATLAS is the
	 * thing that is down.
	 *
	 * A6 C2 CORRECTION: the DECISION is no longer restated here. This memo only
	 * chooses the wording, and it asks `isTeachingLoadSourceDegraded` — the same
	 * exported predicate `pages/TeachingLoad.tsx` uses to decide whether the
	 * repair queue withholds its figures. The three strings and their order are
	 * byte-for-byte the behaviour that was here before, so no committed row on
	 * this header changes.
	 */
	const isSourceDegraded = isTeachingLoadSourceDegraded({ dataSource, isOnline, dataSourceNotice });
	// A6 C3 (N-1): the WIDER predicate, for the two things the degraded one must
	// not decide. `refreshing` is deliberately absent from `isSourceDegraded` —
	// "not reachable" would be a lie mid-check — but the figures on screen are
	// still the last saved snapshot, so a derived count may not be printed as if
	// it were live while the check runs. The header already says so honestly
	// (`Checking EnrollPro for the latest roster…`); this is what keeps the
	// snapshot-derived `Above weekly max: N` out of the same sentence.
	const isSourceUnverified = isTeachingLoadSourceUnverified({ dataSource, isOnline });
	const degradedTail = useMemo(() => {
		if (!isSourceDegraded) return null;
		return teachingLoadUnverifiedReason({ dataSource, isOnline });
	}, [dataSource, isOnline, isSourceDegraded]);

	/*
	 * A6 c6 items 4 and 5 — every string this header prints about a source it
	 * cannot verify now comes from ONE derivation, in
	 * `teachingLoadDegradedCopy`: the visible pill's plain lead, the Tooltip's
	 * technical detail, and the one new `Help` step. It was extracted out of this
	 * file because four memos of the same subject pushed it past the AGENTS.md §8
	 * 1000-line cap, and because one derivation is what keeps the pill, the hover
	 * and Help from ever disagreeing about the cause. The reasoning moved with
	 * the code, into that file's own header.
	 */
	const { lead: degradedLead, detail: degradedDetail, helpStep: sourceHelpStep } = useMemo(
		() => teachingLoadDegradedCopy({ dataSource, isOnline, degraded: isSourceDegraded, savedAtLabel }),
		[dataSource, isOnline, isSourceDegraded, savedAtLabel],
	);

	/*
	 * ONE sentence of status. The `% staffed` and `Classes without a teacher`
	 * figures the header used to show as two separate pills are now inside it,
	 * and the state-driven alert is inside it too — which is what removes Lane C's
	 * "the warning chip is hidden under the Assign button" overlap at 1366
	 * without moving the ONE primary action off the row.
	 *
	 * The alert is NOT part of this string: the clause below carries its own
	 * test id and tone, and putting the same words in both places printed them
	 * twice.
	 *
	 * It WRAPS, it is not `truncate`d. A6 c4 (G2.3) replaced `truncate` with
	 * `flex-wrap` on the band: AGENTS.md §8 forbids a sentence ending in an
	 * ellipsis, and a truncated sentence is that defect in a different guise.
	 * Row 2 grows instead of clipping. Do not reintroduce `truncate` here — the
	 * comment that used to justify it is what made the defect look deliberate.
	 */
	const statusSentence = useMemo(() => {
		// A6 c4 (G2.3): the trailing `…` is GONE. AGENTS.md §8 — "No sentence is
		// cut off with an ellipsis" — and a literal ellipsis here is the copy
		// equivalent of the `truncate` this row used to carry: it told the reader
		// the sentence was clipped when it was not. The sentence is complete
		// without it, and `a6-teaching-load-surface` A6-C3-3-N1 already asserts
		// this string without the character.
		if (dataSource === 'refreshing') return 'Checking EnrollPro for the latest roster';
		const parts = [`${completenessPercent}% staffed`];
		parts.push(
			unassignedPairs > 0
				? `${unassignedPairs} ${unassignedPairs === 1 ? 'class needs' : 'classes need'} a teacher`
				: 'Every class has a teacher',
		);
		return parts.join(' · ');
	}, [completenessPercent, dataSource, unassignedPairs]);

	/*
	 * A6 c5 §1 — THE SUBTRACTION, and the one judgement it forced.
	 *
	 * The packet is explicit and repeated: the shortage line *replaces* the
	 * `alertChip` and the repair queue's "Assign teachers to open classes" item,
	 * and "two chips that say the same thing is a §8 violation". So when the page
	 * supplies a shortage line, this toolbar renders NEITHER its own status
	 * sentence NOR the alert clause beside it. The line is the whole status
	 * claim on row 2, plus its one action.
	 *
	 * WHAT THAT DOES TO `Above weekly max: N`, stated rather than assumed. That
	 * count is the one figure that blocks generation outright, so deleting it
	 * from row 2 for the duration of a staffing shortage would hide a blocker
	 * behind an unrelated fix. It is NOT hidden, and this is the reason: the
	 * `alertChip` was always a DUPLICATE of the repair queue's per-teacher
	 * `over-cap` items (`<name> is over the weekly max · 32.0h used / 30h max`),
	 * and the queue is still on row 2, in `stateLineSlot`, untouched by this
	 * slice. Removing the chip therefore leaves the blocker stated exactly once
	 * rather than zero times — which is §8's actual rule, and a strict
	 * improvement over the two-vocabulary arrangement it replaces.
	 *
	 * The `data-alert-key` / `data-testid` contracts and the a3-c10 T7 row that
	 * read them are untouched: they render this component WITHOUT the slot, which
	 * is the no-shortage state, and in that state the sentence and the alert
	 * render exactly as they always have.
	 */
	const hasShortageLine = Boolean(shortageLineSlot);

	/*
	 * A6 c6 item 2 — the `Load summary` open flag lives HERE, and the reason is a
	 * real defect this row's evidence found rather than a style preference. Radix
	 * unmounts a menu's content on close, so a surface rendered INSIDE that content
	 * takes its own dialog down with it in the same commit that opens the dialog:
	 * the control renders, the item is a real menu item, and clicking it does
	 * nothing. The flag therefore lives above the strip, the menu ITEM is a sibling
	 * of the surface rather than its child, and the page's slot still hands over the
	 * same untouched `TeachingLoadSummarySurface` node.
	 */
	const [summaryOpen, setSummaryOpen] = useState(false);
	const summaryControl = useMemo(() => ({ open: summaryOpen, setOpen: setSummaryOpen }), [summaryOpen]);

	return (
		<>
		<CompactTitleStrip
			stripTestId="teaching-load-command-header"
			rowTestId="teaching-load-compact-command-header"
			/* A3-TITLE-STRIP-C3: the h1 keeps Teaching Load's own text-sm /
				sm:text-base scale. Strip A's text-lg / lg:text-xl is not applied
				here — that trade needs a rendered screen this stream cannot run. */
			/* A3-C10-S3 ROW 1: title, the Teachers/Sections switch, and the status
				badge share ONE line. The switch used to be a second strip row
				(`mt-1.5 + border-t + pt-1.5` = 13px of pure gap around an `h-8`
				`Tabs` = 45px) and now sits in the shared strip's `leading` group at
				`h-7`, matching the `h-7` action buttons on the right. The `gap-2`
				between them is the shared `leading` gap, so no local spacing is
				declared here.

				The `teaching-load-tab-row` id MOVES with it: it is the same
				element, the same test id, one row higher. */
			title={
				<>
				<h1 className="text-sm font-bold tracking-tight text-foreground sm:text-base">Teaching Load</h1>
					{/* Row 1: the Teachers/Sections switch, on the command row. */}
					<div className="flex min-w-0 items-center" data-testid="teaching-load-tab-row">
						<Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'teacher' | 'allocation')} className="h-7">
							<TabsList className="h-7 p-0.5 border border-border/40 bg-muted/50">
							<TabsTrigger value="teacher" className="h-6 px-2.5 text-xs font-bold">Teachers</TabsTrigger>
							<TabsTrigger value="allocation" className="h-6 px-2.5 text-xs font-bold">Sections</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
				</>
			}
			statusDescription={workspaceStateDescription}
			statusNextAction={workspaceStateNextAction}
		status={
			/*
			 * A6 C2 (Major 1) — row 1, the operator's order: `Teaching Load` ·
			 * Teachers | Sections · DRAFT CHIP, then right: Help, `Suggest
			 * assignments`, settings. The source-verification badge is KEPT and
			 * keeps its `[data-source-state]` attribute and its four labels; the
			 * draft chip is ADDED beside it, because "is my work saved?" and
			 * "is this data current?" are two different questions and the header
			 * could answer only the second.
			 *
			 * `h-6`, not `h-7`, so `ROW_1_COMMAND_PX` is still driven by the
			 * action buttons and the committed height model is unchanged.
			 */
			<span className="inline-flex items-center gap-1.5">
				<Badge
					variant="outline"
					data-source-state={dataSource}
					className="h-6 cursor-help rounded-full border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 shadow-none"
				>
					<span className={cn('mr-1.5 size-2 rounded-full', statusConfig.color)} />
					{statusConfig.label}
				</Badge>
				<Badge
					variant="outline"
					data-testid="teaching-load-draft-chip"
					data-draft-state={activeDraftCount > 0 ? 'unsaved' : 'saved'}
					className={cn(
						'h-6 rounded-full px-2 text-xs font-semibold shadow-none',
						activeDraftCount > 0
							? 'border-sky-200 bg-sky-50 text-sky-700'
							: 'border-emerald-200 bg-emerald-50 text-emerald-700',
					)}
				>
					{activeDraftCount > 0 ? 'Draft — not saved' : 'Saved'}
				</Badge>
			</span>
		}
			actions={
				<>
					<SmartHelpTrigger
						title="How to use Teaching Load"
						description="Use this page to build and review which teacher owns each subject-section load before timetable generation."
					steps={[
						{
							title: 'Start with the repair queue',
							body: 'ATLAS puts missing load, overloads, placeholders, and unsaved draft work in the order scheduler officers should fix them.',
						},
						{
							title: 'Preview suggestions first',
							body: 'Suggest Teaching Load draft shows what ATLAS can fill before anything becomes final.',
						},
						{
							title: 'Use Advanced grid only when needed',
							body: 'Dense teacher and section grids stay available for expert repair, but they should not be your first stop.',
						},
						{
							title: 'Save only after review',
							body: 'Draft changes stay visible near the action bar so you can save, undo, or discard with a clear status message.',
						},
						sourceHelpStep,
					]}
					triggerLabel="Help"
					className="hidden h-7 shrink-0 px-2 text-xs sm:inline-flex"
				/>

				{/*
				 * A6 c6 item 2 — `Load summary` USED TO BE HERE, between `Help` and the
				 * primary action. Lane C, verbatim: "several competing top controls
				 * (`Load summary`, `Retry source`, `More Teaching Load tools`), not
				 * one clear main button." A header that offers three buttons of equal
				 * weight gives an older, mouse-first scheduler no first move, so the
				 * complete breakdown moved into the `More` menu as its FIRST item.
				 *
				 * NOTHING ELSE MOVED AND NOTHING WAS LOST. The page still builds the
				 * surface and still hands it over through the same `loadSummaryAction`
				 * slot; the dialog, the `TeachingLoadTruthPanel` body, the
				 * `truthModel` authority, `data-testid="teaching-load-summary-open"`
				 * and the accessible name `Load summary` are all unchanged, and
				 * `a6-teaching-load-surface` `A6-38-1b` proves the same dialog opens
				 * from the new place. `ROW_1_COMMAND_PX` was 28px because of the `h-7`
				 * Help / More buttons, which are still there, so
				 * `TEACHING_LOAD_HEADER_MODEL` is unchanged.
				 */}

					<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant={primaryAction.variant}
							size="sm"
							onClick={primaryAction.onClick}
							disabled={primaryAction.disabled}
							data-testid={primaryAction.isSuggestion ? 'teaching-load-suggest-draft-action' : undefined}
							/*
							 * A6 C2: no `bg-primary/5 … text-primary` overlay, no
							 * `uppercase tracking-tight`. The `secondary` variant is now
							 * what the operator sees, so the button that does nothing
							 * until a second dialog can no longer be mistaken for the
							 * page's primary action.
							 */
							className="h-7 gap-1.5 px-2 text-xs sm:px-3"
						>
							<Zap className="size-4" />
							<span className="hidden sm:inline">{primaryAction.label}</span>
							<span className="sm:hidden">{primaryAction.shortLabel}</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-62.5 text-xs font-semibold">
						{primaryAction.helper}
					</TooltipContent>
				</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									{/* A3-C10-S3: this used to be `size="icon-sm"` plus `h-7 w-7`,
									 * which is NOT a shrink. The `icon-sm` variant contributes
									 * `size-10` and tailwind-merge does not treat `size-*` and
									 * `h-*` as the same group, so the button shipped with two
									 * competing heights (40px and 28px) and which one won was
									 * decided by stylesheet order, not by the call site. That
									 * ambiguity sat on row 1, the row this whole budget is
									 * measured against, so the variant is dropped and the size is
									 * declared once, here. The `h-7 w-7 shadow-sm` prefix is
									 * deliberate: the A3-TITLE-STRIP-C3 suite pins that literal. */}
									<Button variant="outline" className="h-7 w-7 shadow-sm shrink-0 rounded-[min(var(--radius-md),12px)] p-0" aria-label="More Teaching Load tools">
										<Settings2 className="size-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-64 p-2">
									{/*
									 * A6 c6 item 2, arrival point. The ITEM is the control — a real
									 * `DropdownMenuItem` with the packet's testid and accessible name,
									 * and deliberately no `<button>` nested inside it. It is FIRST, above
									 * `Archived load` and the staffing-mode group, because it is the one
									 * thing in here a scheduler may want in the first ten seconds. The
									 * DIALOG is rendered from the same node as a SIBLING of the menu, at
									 * the end of this component, so closing the menu cannot unmount it.
									 */}
									{loadSummaryAction ? (
										<TeachingLoadSummaryMenuSlot value={summaryControl}>
											<TeachingLoadSummaryMenuItem />
										</TeachingLoadSummaryMenuSlot>
									) : null}
									{/*
									 * A6 C2 (Major 1): the `Archived load` link arrives here
									 * from the PAGE, which still builds it — only its position
									 * moved off row 2. `asChild` hands the menu-item styling
									 * and the keyboard/roving-focus behaviour to the link itself,
									 * so it stays one real link rather than a div wrapping one.
									 */}
									{historyAction}
									<DropdownMenuSeparator />
									<DropdownMenuLabel className="text-xs font-semibold text-muted-foreground/70">Staffing mode</DropdownMenuLabel>
									<DropdownMenuRadioGroup value={coverageMode} onValueChange={(v) => onCoverageModeChange(v as CoverageMode)}>
										{Object.entries(coverageModeConfig || {}).map(([mode, config]) => (
											<DropdownMenuRadioItem key={mode} value={mode} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
												<span className="text-xs font-bold">{config.label}</span>
												<span className="text-xs text-muted-foreground font-medium leading-tight">{config.description}</span>
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="text-xs font-bold">More teaching-load tools</TooltipContent>
					</Tooltip>
				</>
			}
		>
			{/* A6 C2 ROW 2 — ONE sentence of status + ONE primary action.
			 *
			 * THE DEFECT, MEASURED BY LANE C at 1366x768: this row was
			 * `flex … flex-nowrap … overflow-x-auto` and tried to hold 1,070px of
			 * content — 140px `% staffed`, 231px `Classes without a teacher`, a
			 * 451px summary, a 223px next-step/warning, 169px Assign and a 117px
			 * `Archived load`. The warning section BEGAN at x=1115 while Assign
			 * began at x=1133, so only its icon was visible, and the summary text
			 * was cut to 204px of 329px. At 1920 the warning was still hidden
			 * beneath Assign. The row scrolled sideways, which is the rejection.
			 *
			 * WHAT REPLACED IT:
			 *   - ONE sentence (`teaching-load-status-sentence`) carrying the
			 *     `% staffed` figure, the classes-needing-a-teacher clause and the
			 *     alert, so the alert can no longer be overlapped BY anything;
			 *   - OR, when the data is degraded, exactly ONE amber line
			 *     (`teaching-load-degraded-notice`) and NO derived count at all;
			 *   - and the page's `stateLineSlot`, whose `h-7` repair queue supplies
			 *     the ONE primary action (`teaching-load-repair-review`).
			 *
			 * NO SIDEWAYS SCROLL, AND NO CUT-OFF SENTENCE EITHER. `overflow-x-auto`
			 * is gone from this row, and A6 c4 (G2) removed `truncate` from it as
			 * well. The defect Lane C measured was not only a sideways scroller: it
			 * was a row that hid a claim by cutting it. A scheduler whose status
			 * sentence ends in `…` cannot tell a complete sentence from a clipped
			 * one, which is the same failure as the sideways scroller in a slower
			 * form. So `flex-nowrap` became `flex-wrap` and nothing on this row
			 * truncates: a long sentence WRAPS onto a second line of the same band
			 * rather than losing its tail. The band is still ONE row — `a3-c10` T3
			 * and `A6-C2-4` both count BAND rows, and a wrapped line inside row 2 is
			 * not a third band.
			 *
			 * A wrapping row is only honest if the wrap is a fallback, so
			 * `a6-tl-header-budget` measures the DECLARED content of both members
			 * (the status line and the page's next step) against the 1366px row and
			 * fails if they no longer fit. `truncate` hid the overflow; the measured
			 * budget states it.
			 *
			 * HEIGHT: unchanged, and re-derived rather than carried over. Only the
			 * 1px `border-t` hairline separates the rows, and the tallest member is
			 * still the `h-7` repair-queue action button at 28px, so the band is
			 * 1 + 28 = 29px and `TEACHING_LOAD_HEADER_MODEL` still holds at
			 * 9 + 28 + 29 = 66px against the 70px budget with a hard 2-row ceiling.
			 * The 4px of remaining slack is deliberately NOT spent on padding: the
			 * operator's instruction was to undo the squeeze, and the way to undo a
			 * squeeze is to stop packing four claim-bearers into one band — which is
			 * what the repair queue's one-chip change did — not to re-tighten the
			 * remaining two. */}
			<div className={cn(COMPACT_TITLE_STRIP_CLASS.bandRow, 'gap-x-3 gap-y-1 border-t border-border/40')} data-testid="teaching-load-readiness-strip">
				{/*
				 * A6 c7 CORRECTION ROUND 1 — ONE CLAIM PER FACT. The shortage line
				 * takes the slot; the pill returns only when there is nothing to
				 * claim. This order used to be `degradedLead ? pill :
				 * hasShortageLine ? line : sentence`, and the pill winning it is the
				 * SAME conflation as c5's `isLive` one level up: a source-freshness
				 * surface took the slot and the shortage claim vanished, which is
				 * what Lane C saw on staging. c7 first widened it to "both, as
				 * siblings"; that is one fact printed twice. The pill says the roster
				 * is the last saved one, and the line's own `· <date> roster`
				 * clause says exactly that — so the pair is the §8 "two chips that
				 * say the same thing" defect, before width is even considered, and
				 * row 2 is `flex-wrap`, so it would also have wrapped. SUBTRACT THE
				 * DUPLICATE, do not shorten a figure, a subject name or the date.
				 * Nothing is silenced: c6 §1.5.3 made the header's PRIMARY action
				 * the retry, so the pill was never the retry; it returns unchanged,
				 * with c6's copy and its technical Tooltip, in the no-shortage
				 * state. `A6C7-9` discriminates this order; `A6C7-3` measures the
				 * filled-amber ratchet, which is now ZERO in this state. */}
				{hasShortageLine ? (
					/* A6 c5: the page's shortage line IS the status claim, so neither
					 * the `% staffed` sentence nor the alert clause is printed beside
					 * it. See the `hasShortageLine` memo for why the over-cap figure
					 * is still stated exactly once, on the repair queue. */
					shortageLineSlot
				) : degradedLead ? (
					/*
					 * A6 c6 item 5: the pill carries the plain lead and the Tooltip
					 * carries the detail. The `data-degraded` attribute keeps its
					 * clause — `A6-C2-3` and `a6-tl-header-budget` `A6c4-G2-1` read
					 * this surface for the cause, and none of them needed to change.
					 */
					<Tooltip>
					<TooltipTrigger asChild>
						<span
							data-testid="teaching-load-degraded-notice"
							data-degraded={degradedTail ?? undefined}
							className="flex min-h-7 min-w-0 cursor-help items-start gap-1.5 rounded-full border border-warning-border bg-warning-muted px-2.5 py-0.5 text-xs font-semibold text-warning-foreground"
						>
							<AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
							<span>{degradedLead}</span>
						</span>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-80 text-xs font-semibold">
						{degradedDetail}
					</TooltipContent>
					</Tooltip>
				) : (
					<span
						data-testid="teaching-load-status-sentence"
						className="flex min-h-7 min-w-0 items-start gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground"
					>
						<span>{statusSentence}</span>
						{/*
						 * A6 C3 (N-1): the alert KEEPS its test id, its `data-alert-key`
						 * and its exact `Above weekly max: N` label in the healthy case —
						 * it is simply not printed while the figures are unconfirmed. The
						 * count is read from the last saved snapshot, so a scheduler
						 * mid-check would read it as a live generation blocker; the amber
						 * line and the queue say the same thing, so the header must too.
						 * The wrapped control is the same, the tone is the same, and the
						 * alert returns the moment the source is verified.
						 */}
						{alertChip && !isSourceUnverified && (
							<span data-testid={alertChip.testId} data-alert-key={alertChip.key} className="shrink-0 font-bold text-destructive">
								· {alertChip.label}
							</span>
						)}
					</span>
				)}

				{/* The page's own state, on the same line and at the same height, and
					pushed to the right so the sentence truncates BEFORE the ONE action
					can be squeezed or hidden. */}
				<div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5">{stateLineSlot}</div>
			</div>

			<p className="sr-only">
				<span className="font-semibold text-foreground">Next:</span> {workspaceStateNextAction}
			</p>
			<p className="sr-only" aria-live="polite" data-testid="teaching-load-source-truth-summary">
				{statusConfig.label}. {statusConfig.description}
			</p>
		</CompactTitleStrip>

			{/*
			 * A6 c6 item 2, the other half: the page's `TeachingLoadSummarySurface`
			 * renders HERE, as a SIBLING of the strip and therefore OUTSIDE the `More`
			 * menu's content. That placement is the fix, not a detail — a dialog
			 * rendered inside the menu content is unmounted by the very click that
			 * opens it. The slot is wrapped in the same provider the menu item reads,
			 * so one flag drives both, and while the dialog is closed this renders
			 * nothing at all: the strip's two-band shape and the header height model
			 * are untouched.
			 */}
			{loadSummaryAction ? (
				<TeachingLoadSummaryMenuSlot value={summaryControl}>
					{loadSummaryAction}
				</TeachingLoadSummaryMenuSlot>
			) : null}
		</>
	);
}
