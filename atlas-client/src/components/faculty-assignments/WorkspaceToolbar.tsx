import { useMemo, type ReactNode } from 'react';
import { Zap, Activity, Settings2, Users } from 'lucide-react';
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

const STRIP_TONE: Record<'success' | 'warning' | 'danger' | 'info', string> = {
	success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
	warning: 'border-amber-200 bg-amber-50 text-amber-700',
	danger:  'border-rose-200 bg-rose-50 text-rose-700',
	info:    'border-sky-200 bg-sky-50 text-sky-700',
};

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
				onClick: onRetrySource,
				disabled: true,
				variant: 'outline' as const,
				helper: 'ATLAS is checking live assignment data.',
			};
		}
		if (!isOnline || dataSource === 'none') {
			return {
				label: isOnline ? 'Retry source' : 'Offline',
				onClick: onRetrySource,
				disabled: !isOnline,
				variant: 'outline' as const,
				helper: isOnline ? 'Try loading teaching load data again.' : 'Reconnect before retrying.',
			};
		}
		return {
			label: 'Preview suggested assignments',
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
								<TabsTrigger value="teacher" className="h-6 px-2.5 text-xs font-bold uppercase tracking-tight">Teachers</TabsTrigger>
								<TabsTrigger value="allocation" className="h-6 px-2.5 text-xs font-bold uppercase tracking-tight">Sections</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
				</>
			}
			statusDescription={workspaceStateDescription}
			statusNextAction={workspaceStateNextAction}
			status={
				<Badge
					variant="outline"
					data-source-state={dataSource}
					className="h-6 cursor-help rounded-full border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 shadow-none"
				>
					<span className={cn('mr-1.5 size-2 rounded-full', statusConfig.color)} />
					{statusConfig.label}
				</Badge>
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
							data-testid={primaryAction.label === 'Preview suggested assignments' ? 'teaching-load-suggest-draft-action' : undefined}
							className="h-7 gap-1.5 border border-primary/20 bg-primary/5 px-2 text-xs font-bold uppercase tracking-tight text-primary shadow-sm transition-all hover:bg-primary/10 sm:px-3"
						>
							<Zap className="size-4" />
							<span className="hidden sm:inline">{primaryAction.label}</span>
							<span className="sm:hidden">{primaryAction.label === 'Preview suggested assignments' ? 'Preview' : primaryAction.label}</span>
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
									<DropdownMenuLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Staffing mode</DropdownMenuLabel>
									<DropdownMenuRadioGroup value={coverageMode} onValueChange={(v) => onCoverageModeChange(v as CoverageMode)}>
										{Object.entries(coverageModeConfig || {}).map(([mode, config]) => (
											<DropdownMenuRadioItem key={mode} value={mode} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
												<span className="text-xs font-bold uppercase tracking-tight">{config.label}</span>
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
			{/* A3-C10-S3 ROW 2 — the single compact state line. Everything that used
				to be its own band under the strip is here now: the % staffed figure,
				the classes-without-a-teacher count, the state-driven alert chip, and
				the page's `stateLineSlot` (canonical truth summary, the "Next step"
				chip and its action, and the archived-load control).

				HEIGHT: the old `mt-1.5 ... border-t ... pt-1.5` wrapper cost 13px
				of margin+padding to separate a row that no longer exists. Only the
				1px `border-t` hairline is kept, so the row is 1 + 28 = 29px.

				NOT A DISCLOSURE. Every chip on this line is visible at a glance; the
				caller's slot is a peer, not a hidden panel. Horizontal overflow
				scrolls inside this shrink-0 strip (the same treatment the readiness
				strip already had) and never becomes a global scrollbar. */}
			<div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto border-t border-border/40" data-testid="teaching-load-readiness-strip">
				<div
					className={cn(
						'flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm',
						STRIP_TONE[completenessPercent === 100 ? 'success' : 'warning'],
					)}
				>
					<span className="text-xs uppercase tracking-wide opacity-75">% staffed</span>
					<span className="text-sm font-bold tabular-nums">{completenessPercent}%</span>
				</div>

				<div
					className={cn(
						'flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm',
						STRIP_TONE[unassignedPairs > 0 ? 'warning' : 'success'],
					)}
				>
					<span className="text-xs uppercase tracking-wide opacity-75">Classes without a teacher</span>
					<span className="text-sm font-bold tabular-nums">{unassignedPairs}</span>
				</div>

{alertChip ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="outline"
							data-testid={alertChip.testId}
							data-alert-key={alertChip.key}
							onClick={alertChip.onClick}
							disabled={alertChip.disabled}
							aria-label={alertChip.label}
							className={cn(
								'flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm transition-colors cursor-pointer hover:brightness-95',
								STRIP_TONE[alertChip.tone],
							)}
						>
							{alertChip.key === 'overcap' ? <Activity className="size-3.5" /> : <Users className="size-3.5" />}
							<span className="text-sm font-bold">{alertChip.label}</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-64 text-xs leading-relaxed">
						{alertChip.tooltip}
					</TooltipContent>
				</Tooltip>
			) : null}

				{/* The page's own state, on the same line and at the same height.
					`min-w-0` + the strip's `overflow-x-auto` is what keeps a long
					truth sentence from pushing the roster sideways. */}
				{stateLineSlot}
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
