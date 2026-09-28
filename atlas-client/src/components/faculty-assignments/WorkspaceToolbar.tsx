import { useMemo, type ReactNode } from 'react';
import { Zap, Settings2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs';
import { cn } from '@/lib/utils';
import { SmartHelpTrigger } from '@/components/smart/SmartPageShell';
import { CompactTitleStrip } from '@/components/app-shell/CompactTitleStrip';
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
	 * FIX 38 — the header's `Load summary` control.
	 *
	 * This is a SLOT, not a callback, on purpose. The toolbar owns the control's
	 * POSITION in the action group (after `Help`, before the primary suggestion
	 * action) and nothing else: the open flag and the dialog belong to
	 * `TeachingLoadSummarySurface`, and the panel body belongs to the page. A
	 * callback here would force the page to own all three, which is what pushed
	 * it over the AGENTS.md §8 line cap and what would let the dialog's figures
	 * drift from the page's `truthModel`.
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
 * The `cached` + online case MUST keep producing the exact string the queue
 * already printed (`Unverified — EnrollPro is not reachable, so this figure is
 * withheld.`), so the common degraded state reads identically to before.
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
 * A6 C3: the withheld SENTENCE, composed per state rather than from one fixed
 * clause. The `cached` + online case is pinned to the exact string this page has
 * printed since A6 C2, byte-for-byte, so the state a scheduler meets most often
 * reads identically to before.
 *
 * It is written out per state instead of composed from
 * `teachingLoadUnverifiedReason` for one grammar reason: that function's
 * `EnrollPro not reachable` is the AMBER LINE's clause, and the sentence needs
 * the same clause in a sentence — `EnrollPro IS not reachable`. Composing one
 * from the other silently dropped the `is` and changed a string the committed
 * `A6-C2-3` row asserts. The other three states are new, so they are written to
 * read as sentences.
 */
export function teachingLoadUnverifiedStatus(input: {
	dataSource: WorkspaceToolbarProps['dataSource'];
	isOnline: boolean;
}): string {
	if (!input.isOnline) return 'Unverified — ATLAS is offline, so this figure is withheld.';
	if (input.dataSource === 'refreshing') return 'Unverified — ATLAS is checking EnrollPro now, so this figure is withheld.';
	if (input.dataSource === 'none') return 'Unverified — no live Teaching Load source is available, so this figure is withheld.';
	return 'Unverified — EnrollPro is not reachable, so this figure is withheld.';
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
	loadSummaryAction,
	historyAction,
	savedAtLabel = null,
}: WorkspaceToolbarProps) {
	const completenessPercent = totalPairs > 0 ? Math.round(((realAssignedPairs + syntheticPlaceholderPairs) / totalPairs) * 100) : 0;

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
	 * `savedAtLabel` is the PAGE's real field, never a synthesised clock reading.
	 * With no timestamp the clause is dropped, so the sentence degrades from
	 * `Using saved data from <time> — EnrollPro not reachable` to `Using the last
	 * saved data — EnrollPro not reachable` instead of inventing a time we cannot
	 * prove (see the `savedAtLabel` prop doc).
	 */
	const degradedLine = useMemo(() => {
		if (!degradedTail) return null;
		const prefix = savedAtLabel
			? `Using saved data from ${(() => { const p = new Date(savedAtLabel); return Number.isNaN(p.getTime()) ? savedAtLabel : p.toLocaleString(); })()}`
			: 'Using the last saved data';
		return `${prefix} — ${degradedTail}`;
	}, [degradedTail, savedAtLabel]);

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
	 * It is `truncate`d, never wrapped: the height budget is 2 band rows and
	 * 70px, so a longer sentence loses its tail rather than becoming a third row.
	 */
	const statusSentence = useMemo(() => {
		if (dataSource === 'refreshing') return 'Checking EnrollPro for the latest roster…';
		const parts = [`${completenessPercent}% staffed`];
		parts.push(
			unassignedPairs > 0
				? `${unassignedPairs} ${unassignedPairs === 1 ? 'class needs' : 'classes need'} a teacher`
				: 'Every class has a teacher',
		);
		return parts.join(' · ');
	}, [completenessPercent, dataSource, unassignedPairs]);

	return (
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
						]}
						triggerLabel="Help"
						className="hidden h-7 shrink-0 px-2 text-xs sm:inline-flex"
					/>

					{/* FIX 38: `Load summary`, AFTER `Help` and BEFORE the primary
					 * suggestion action, per the requested header order.
					 *
					 * This component does not draw the control — the page passes
					 * `TeachingLoadSummarySurface` here, which owns both the
					 * `h-7` button and the dialog. What matters for the header
					 * height model is only that it sits on row 1, and the
					 * surface's button is `h-7`, so `ROW_1_COMMAND_PX` is
					 * unchanged and the committed header control stays green. */}
					{loadSummaryAction}

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
			 * NO SIDEWAYS SCROLL. `overflow-x-auto` is gone from this row. The
			 * sentence is `min-w-0` + `truncate`, so at 1366 a long sentence loses
			 * its tail instead of pushing the roster sideways or becoming a third
			 * band row.
			 *
			 * HEIGHT: unchanged. Only the 1px `border-t` hairline separates the
			 * rows and every member is `h-7`, so the band is still 1 + 28 = 29px
			 * and `TEACHING_LOAD_HEADER_MODEL` still holds at 9 + 28 + 29 = 66px
			 * against a 70px budget with a hard 2-row ceiling. The degraded line
			 * therefore did NOT have to move into the dialog: it is a `h-7` pill in
			 * this same 28px row, which is the operator's better outcome and the
			 * reason no budget was broken. */}
			<div className="flex min-w-0 flex-nowrap items-center gap-2 border-t border-border/40" data-testid="teaching-load-readiness-strip">
				{degradedLine ? (
					<span
						data-testid="teaching-load-degraded-notice"
						data-degraded={degradedTail ?? undefined}
						className="flex h-7 min-w-0 shrink items-center gap-1.5 rounded-full border border-warning-border bg-warning-muted px-2.5 text-xs font-semibold text-warning-foreground"
					>
						<AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="min-w-0 truncate">{degradedLine}</span>
					</span>
				) : (
					<span
						data-testid="teaching-load-status-sentence"
						className="flex h-7 min-w-0 shrink items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 text-xs font-semibold text-foreground"
					>
						<span className="min-w-0 truncate">{statusSentence}</span>
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
	);
}
