import { AlertTriangle, BadgeCheck, ClipboardList, Info, Users } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import {
	isKnown,
	minutesToHours,
	type TeachingLoadTruthModel,
	type TruthMetric,
} from '@/lib/teaching-load-authority-truth';

type TeachingLoadTruthPanelProps = {
	model: TeachingLoadTruthModel | null;
	loading?: boolean;
	sourceRevision?: string | null;
	/**
	 * F4 — whether the upstream source the page sentence describes is verified.
	 * When false the badge must not claim "Source verified": the workspace is
	 * showing the ATLAS runtime cache while upstream verification is unavailable.
	 */
	upstreamVerified?: boolean;
	/** Concise server explanations for unresolved pairs, shown on demand only. */
	unresolvedReasons?: Array<{ code: string; message: string }>;
	/**
	 * A3-C10-S3 — render as a peer chip inside the workspace's single compact
	 * state line instead of as a full-width card band.
	 *
	 * `inline` removes the card chrome (`rounded-xl border px-2 py-1.5 shadow-sm`
	 * = 14px of box) and pins the collapsed summary row to `h-7` so the panel
	 * is the same 28px as its neighbours. It changes NOTHING about what the
	 * panel states: the same summary line, the same `data-testid` hooks, the
	 * same source-verification badge, the same Details popover, and the same
	 * in-DOM metric rows behind the same Accordion. The default stays `false`,
	 * so any other caller keeps the card treatment.
	 */
	inline?: boolean;
	/**
	 * FIX 38 — open the disclosure on first render.
	 *
	 * The panel's own default is COLLAPSED with a one-line summary, which is
	 * right for a peer chip in a dense header and wrong for a modal whose
	 * entire reason to exist is the complete breakdown: a dialog whose body is
	 * one summary line and a collapsed disclosure is a dialog that has to be
	 * clicked twice. `TeachingLoadSummaryDialog` passes `expanded`, so the modal
	 * opens already showing `Classes needing a teacher`, `Total teaching hours`,
	 * `Standard load`, `School hard cap`, `Above standard` and `Hours still
	 * available`.
	 *
	 * `defaultValue` is the correct prop, not `value`: this is a DISCLOSURE
	 * the operator can still close, not a controlled panel the page forces
	 * open on every render.
	 */
	expanded?: boolean;
	/**
	 * A6 C2 (Major 3, operator 2026-09-28) — render the breakdown as a VERTICAL
	 * definition list instead of two horizontal pill strips.
	 *
	 * THE DEFECT, MEASURED BY LANE C at 1366x768 on
	 * `https://njgrm.buru-degree.ts.net/teaching-load`: opening `Load summary`
	 * produced two 34px-high HORIZONTAL scrollers — content 1,189px and 2,388px
	 * wide inside a 451px container, and still 1,189px/2,388px at 1920x1080.
	 * Every label and value that mattered required a hidden sideways scroll to
	 * read. The cause was literal: the two metric rows were
	 * `flex … flex-nowrap … overflow-x-auto` pill strips, so their width grew
	 * with the number of metrics and the row scrolled sideways.
	 *
	 * In this mode each row is a `<dl>` of `dt`/`dd` pairs that STACKS. There is
	 * no `flex-nowrap` and no overflow class on the row at all, so there is no
	 * sideways scroller to discover — not a narrower one, and not a grid that
	 * can still spill. The dialog's own bounded body scroll region stays the one
	 * scroll region, and this component still contributes no vertical scroller of
	 * its own (a3-c10 T9, and `tl-operator-workspace-c05-r3-truth`, both of which
	 * read this file and ban the literal outright).
	 *
	 * NOTHING IS DROPPED IN THIS MODE. Every `data-testid`, every
	 * `data-metric-state`, the source badge and the `Details` disclosure render
	 * exactly as they do in the pill form; only the arrangement changes. The
	 * default stays `false`, so the compact inline chip and any other caller keep
	 * the pill treatment that fits a 28px header row.
	 */
	vertical?: boolean;
};

const CHIP_TONE: Record<'neutral' | 'success' | 'warning' | 'danger' | 'unknown', string> = {
	neutral: 'border-border/60 bg-background text-foreground',
	success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
	warning: 'border-warning-border bg-warning-muted text-warning-foreground',
	danger: 'border-rose-200 bg-rose-50 text-rose-800',
	unknown: 'border-dashed border-border bg-muted/40 text-muted-foreground',
};

/**
 * One metric, described ONCE, so the two renderers cannot disagree about which
 * label, value, tone or test id belongs to a figure. The alternative — writing
 * each metric out twice, once per mode — is exactly how a test id and its label
 * drift apart between a dialog and a header.
 */
type MetricSpec = {
	label: string;
	metric: TruthMetric<unknown>;
	format: (value: never) => string;
	tone?: keyof typeof CHIP_TONE;
	testId: string;
};

function MetricChip({ label, metric, format, tone = 'neutral', testId }: MetricSpec) {
	if (!isKnown(metric)) {
		return (
			<div
				data-testid={testId}
				data-metric-state="unknown"
				className={cn('flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm', CHIP_TONE.unknown)}
			>
				<Info className="size-3.5" />
				<span className="uppercase tracking-wide opacity-80">{label}</span>
				<span className="font-bold">Not available</span>
			</div>
		);
	}
	return (
		<div
			data-testid={testId}
			data-metric-state="known"
			className={cn('flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm', CHIP_TONE[tone])}
		>
			<span className="uppercase tracking-wide opacity-80">{label}</span>
			<span className="text-sm font-bold tabular-nums">{format(metric.value as never)}</span>
		</div>
	);
}

/**
 * A6 C2 (Major 3) — the same metric as a STACKED definition-list row.
 *
 * This is the renderer the `vertical` mode uses inside the `Load summary`
 * dialog, and it is the direct replacement for the horizontal pill strip whose
 * `flex-nowrap overflow-x-auto` row Lane C measured at 1,189px and 2,388px of
 * content inside a 451px container. There is no overflow class here at all: the
 * row is `flex-col` through its `<dl>` parent, so the width is the container's
 * width and every label and value is visible without a sideways scroll.
 *
 * SENTENCE CASE, unlike the pill. The pill's `uppercase tracking-wide` is what
 * made the summary read as a diagnostic wall; a definition list is prose, so the
 * label is sentence case and the value keeps `tabular-nums` so a column of them
 * stays aligned.
 *
 * `data-testid` and `data-metric-state` are on the SAME element as in the pill
 * form, and an unknown authority still reads `Not available` rather than 0.
 */
function MetricRow({ label, metric, format, testId }: MetricSpec) {
	return (
		<div
			data-testid={testId}
			data-metric-state={isKnown(metric) ? 'known' : 'unknown'}
			className="flex min-w-0 items-baseline justify-between gap-3 py-1"
		>
			<dt className="min-w-0 text-xs font-semibold text-muted-foreground">{label}</dt>
			<dd className="shrink-0 text-xs font-bold tabular-nums text-foreground">
				{isKnown(metric) ? format(metric.value as never) : 'Not available'}
			</dd>
		</div>
	);
}

function DrillDownList({ title, values, empty }: { title: string; values: string[]; empty: string }) {
	return (
		<div className="space-y-1">
			<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
			{values.length === 0 ? (
				<p className="text-xs font-medium text-muted-foreground">{empty}</p>
			) : (
				<ul className="space-y-0.5">
					{values.map((value) => (
						<li key={value} className="text-xs font-semibold text-foreground">{value}</li>
					))}
				</ul>
			)}
		</div>
	);
}

/**
 * Compact, scheduler-first canonical truth surface. Summary first; names,
 * explanations, and server reasons on demand. Never renders a raw diagnostic
 * wall and never invents a number for an unknown authority.
 */
export function TeachingLoadTruthPanel({ model, loading = false, sourceRevision = null, upstreamVerified = true, unresolvedReasons = [], inline = false, expanded = false, vertical = false }: TeachingLoadTruthPanelProps) {
	const zeroLoadNames = model && isKnown(model.zeroLoadFaculty) ? model.zeroLoadFaculty.value.names : [];
	const adviserNames = model && isKnown(model.adviserStatus) ? model.adviserStatus.value.names : [];
	const hgExplanation = model && isKnown(model.excludedHgRows) ? model.excludedHgRows.value.explanation : '';
	const hasDrillDown = zeroLoadNames.length > 0 || adviserNames.length > 0 || unresolvedReasons.length > 0 || Boolean(hgExplanation);

	// One-line summary kept visible while the detailed metric walls stay behind
	// the disclosure. Never invents a number: an unknown authority reads
	// "unknown" rather than 0.
	const summaryLine = model
		? [
			`${isKnown(model.requiredPairs) ? model.requiredPairs.value : 'Unknown number of'} classes`,
			`${isKnown(model.unresolvedPairs) ? model.unresolvedPairs.value : 'unknown'} without a teacher`,
		].join(' · ')
		: 'Not available yet';

	/*
	 * A6 C2: the thirteen metrics are described ONCE, in two ordered groups, and
	 * each group is rendered by whichever layout the caller asked for. Declaring
	 * them as data (rather than as JSX) is what lets the same list be a row of
	 * pills in the header and a stacked definition list in the dialog without a
	 * second copy that can drift — and the ORDER is then a property of the data,
	 * so "every label and value is visible, in the operator's order" is one
	 * assertion rather than thirteen.
	 */
	const unknown: TruthMetric<never> = { state: 'unknown', reason: 'Waiting for authority.' } as unknown as TruthMetric<never>;
	const demandMetrics: MetricSpec[] = [
		{
			label: 'Classes needing a teacher',
			testId: 'teaching-load-truth-required-pairs',
			metric: (model?.requiredPairs ?? unknown) as TruthMetric<unknown>,
			format: ((value: number) => `${value}`) as (value: never) => string,
		},
		{
			label: 'Classes with a teacher',
			testId: 'teaching-load-truth-assigned-pairs',
			tone: model && isKnown(model.assignedPairs) && model.assignedPairs.value.real > 0 ? 'success' : 'neutral',
			metric: (model?.assignedPairs ?? unknown) as TruthMetric<unknown>,
			format: ((value: { real: number; placeholder: number; total: number }) =>
				(value.placeholder > 0 ? `${value.total} (${value.placeholder} temporary)` : `${value.total}`)) as (value: never) => string,
		},
		{
			label: 'Still without a teacher',
			testId: 'teaching-load-truth-unresolved-pairs',
			tone: model && isKnown(model.unresolvedPairs) && model.unresolvedPairs.value > 0 ? 'warning' : 'neutral',
			metric: (model?.unresolvedPairs ?? unknown) as TruthMetric<unknown>,
			format: ((value: number) => `${value}`) as (value: never) => string,
		},
		{
			label: 'Total teaching hours',
			testId: 'teaching-load-truth-actual-hours',
			metric: (model?.actualTeachingMinutes ?? unknown) as TruthMetric<unknown>,
			format: ((value: number) => `${minutesToHours(value)}h`) as (value: never) => string,
		},
	];
	const capacityMetrics: MetricSpec[] = [
		{
			label: 'Standard load',
			testId: 'teaching-load-truth-standard',
			metric: (model?.policyCapacity ?? unknown) as TruthMetric<unknown>,
			format: ((value: { teachingStandardMinutes: number }) => `${minutesToHours(value.teachingStandardMinutes)}h`) as (value: never) => string,
		},
		{
			label: 'School hard cap',
			testId: 'teaching-load-truth-hard-cap',
			metric: (model?.policyCapacity ?? unknown) as TruthMetric<unknown>,
			format: ((value: { hardCapMinutes: number | null }) => (value.hardCapMinutes == null ? 'Not set' : `${minutesToHours(value.hardCapMinutes)}h`)) as (value: never) => string,
		},
		{
			label: 'Above standard',
			testId: 'teaching-load-truth-over-standard',
			tone: model && isKnown(model.overload) && model.overload.value.overStandardCount > 0 ? 'warning' : 'success',
			metric: (model?.overload ?? unknown) as TruthMetric<unknown>,
			format: ((value: { overStandardCount: number; excessMinutes: number }) => `${value.overStandardCount} (+${minutesToHours(value.excessMinutes)}h)`) as (value: never) => string,
		},
		{
			label: 'Above hard cap',
			testId: 'teaching-load-truth-over-hard-cap',
			tone: model && isKnown(model.overload) && model.overload.value.overHardCapCount > 0 ? 'danger' : 'neutral',
			metric: (model?.overload ?? unknown) as TruthMetric<unknown>,
			format: ((value: { overHardCapCount: number }) => `${value.overHardCapCount}`) as (value: never) => string,
		},
		{
			label: 'Hours still available',
			testId: 'teaching-load-truth-remaining',
			metric: (model?.remainingCapacityMinutes ?? unknown) as TruthMetric<unknown>,
			format: ((value: number) => `${minutesToHours(value)}h`) as (value: never) => string,
		},
		{
			label: 'Teachers with no classes',
			testId: 'teaching-load-truth-zero-load',
			tone: model && isKnown(model.zeroLoadFaculty) && model.zeroLoadFaculty.value.count > 0 ? 'warning' : 'success',
			metric: (model?.zeroLoadFaculty ?? unknown) as TruthMetric<unknown>,
			format: ((value: { count: number }) => `${value.count}`) as (value: never) => string,
		},
		{
			label: 'Class advisers',
			testId: 'teaching-load-truth-advisers',
			metric: (model?.adviserStatus ?? unknown) as TruthMetric<unknown>,
			format: ((value: { count: number }) => `${value.count}`) as (value: never) => string,
		},
		{
			label: 'Adviser credit',
			testId: 'teaching-load-truth-advisory-credit',
			metric: (model?.advisoryCreditMinutes ?? unknown) as TruthMetric<unknown>,
			format: ((value: number) => `${minutesToHours(value)}h`) as (value: never) => string,
		},
		{
			label: 'Homeroom Guidance (not counted)',
			testId: 'teaching-load-truth-hg-excluded',
			metric: (model?.excludedHgRows ?? unknown) as TruthMetric<unknown>,
			format: ((value: { count: number }) => `${value.count}`) as (value: never) => string,
		},
	];

	return (
		<section
			data-testid="teaching-load-truth-panel"
			aria-label="Teaching Load summary"
			// A3-C10-S3: `inline` is the same surface as a peer of the other
			// state-line chips, so it claims no box of its own. The card form
			// below is unchanged and remains the default.
			className={inline
				? 'flex min-w-0 shrink items-center'
				: 'rounded-xl border border-border/40 bg-background px-2 py-1.5 shadow-sm'}
		>
			{/*
			 * CLIENT-QUALITY-C01: the truth surface is collapsed by default behind
			 * the shared @/ui Accordion disclosure, with a one-line summary always
			 * visible. The detailed metric rows remain in the DOM (the primitive
			 * collapses with CSS rather than unmounting) so server-render and
			 * existing canonical-truth contract tests keep observing the full
			 * values while the operator sees a single compact line.
			 */}
			<Accordion collapsible defaultValue={expanded ? 'truth' : undefined} className={inline ? 'min-w-0' : 'w-full'}>
				<AccordionItem value="truth" className="border-b-0">
					<AccordionTrigger
						className={cn(
							'items-center gap-1.5 text-left hover:no-underline',
							// A3-C10-S3: inline is a peer of the `h-7` state-line chips,
							// so its collapsed trigger is `h-7` too and the whole panel
							// costs the same 28px as its neighbours.
							inline ? 'h-7 px-1.5' : 'py-1',
						)}
					>
						<span className="flex min-w-0 flex-1 items-center gap-1.5">
							<ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<span className="shrink-0 text-xs font-bold uppercase tracking-widest text-muted-foreground">Teaching Load summary</span>
							<span
								className="min-w-0 truncate text-xs font-semibold text-muted-foreground"
								data-testid="teaching-load-truth-summary-line"
							>
								{summaryLine}
							</span>
						</span>
					</AccordionTrigger>
					<AccordionContent className="px-0 pb-0">
						<div className="flex min-w-0 flex-wrap items-center gap-1.5">
							{loading ? (
								<Badge variant="outline" className="h-6 rounded-full border-sky-200 bg-sky-50 px-2 text-xs font-semibold text-sky-700 shadow-none">
									Checking source
								</Badge>
							) : sourceRevision ? (
								<Tooltip>
									<TooltipTrigger asChild>
										<Badge
											variant="outline"
											className={cn(
												'h-6 cursor-help rounded-full px-2 text-xs font-semibold shadow-none',
												upstreamVerified
													? 'border-slate-200 bg-slate-50 text-slate-700'
													: 'border-warning-border bg-warning-muted text-warning-foreground',
											)}
											data-testid="teaching-load-truth-source-badge"
										>
											{upstreamVerified ? 'Up to date with EnrollPro' : 'Using saved data'}
										</Badge>
									</TooltipTrigger>
									<TooltipContent side="bottom" className="max-w-72 p-3 text-xs font-medium leading-relaxed">
										{upstreamVerified
											? 'These numbers come from the saved Teaching Load and match EnrollPro.'
											: 'EnrollPro could not be reached just now, so these numbers come from the last saved Teaching Load. Recent changes in EnrollPro may be missing.'}
									</TooltipContent>
								</Tooltip>
							) : null}

							{hasDrillDown && (
								<Popover>
									<PopoverTrigger asChild>
										<Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-bold uppercase" data-testid="teaching-load-truth-details">
											<Info className="size-3.5" />
											Details
										</Button>
									</PopoverTrigger>
									<PopoverContent align="start" className="w-[min(24rem,calc(100vw-1.5rem))] space-y-3 p-3">
										<DrillDownList title="Teachers with no classes" values={zeroLoadNames} empty="Every active teacher has classes." />
										<DrillDownList title="Class advisers" values={adviserNames} empty="No class advisers are recorded for this school year." />
										<DrillDownList
											title="Why some classes have no teacher"
											values={unresolvedReasons.map((reason) => reason.message).filter(Boolean)}
											empty="No problems reported."
										/>
										{hgExplanation && (
											<div className="space-y-1">
												<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Not counted</p>
												<p className="text-xs font-medium text-muted-foreground">{hgExplanation}</p>
											</div>
										)}
									</PopoverContent>
								</Popover>
							)}
						</div>

			{/*
			 * A6 C2 (Major 3) — the layout switch, and the whole of the fix.
			 *
			 * The two rows below used to be `flex … flex-nowrap … overflow-x-auto`
			 * pill strips, which is what Lane C measured as two 34px-high
			 * sideways scrollers holding 1,189px and 2,388px of content in a
			 * 451px dialog. In `vertical` mode the same ordered metric list
			 * renders as a `<dl>` that STACKS, with no overflow class anywhere
			 * on the row, so there is nothing to scroll sideways — and the
			 * dialog's bounded body scroll region stays the one scroll
			 * region on the surface.
			 *
			 * The `overflow-x-auto` literal survives ONLY on the default pill
			 * layout, which is the compact inline chip. The vertical-scroller
			 * ban still holds either way.
			 */}
			{vertical ? (
				<>
					<dl className="mt-1.5 flex min-w-0 flex-col border-t border-border/40 pt-1" data-metric-layout="vertical" data-testid="teaching-load-truth-summary">
						{demandMetrics.map((spec) => <MetricRow key={spec.testId} {...spec} />)}
					</dl>
					<dl className="flex min-w-0 flex-col border-t border-border/40 pt-1" data-metric-layout="vertical" data-testid="teaching-load-truth-capacity">
						{capacityMetrics.map((spec) => <MetricRow key={spec.testId} {...spec} />)}
					</dl>
				</>
			) : (
				<>
					{/* Row 1 — demand and assignment truth. */}
					<div className="mt-1.5 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto border-t border-border/40 pt-1.5" data-testid="teaching-load-truth-summary">
						{demandMetrics.map((spec) => <MetricChip key={spec.testId} {...spec} />)}
					</div>

					{/* Row 2 — persisted policy capacity, overload, and exceptions. */}
					<div className="mt-1.5 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto border-t border-border/40 pt-1.5" data-testid="teaching-load-truth-capacity">
						{capacityMetrics.map((spec) => <MetricChip key={spec.testId} {...spec} />)}
					</div>
				</>
			)}

			<p className="sr-only" aria-live="polite" data-testid="teaching-load-truth-summary-text">
				{model
					? `Classes needing a teacher ${isKnown(model.requiredPairs) ? model.requiredPairs.value : 'unknown'}; classes with a teacher ${isKnown(model.assignedPairs) ? model.assignedPairs.value.total : 'unknown'}; still without a teacher ${isKnown(model.unresolvedPairs) ? model.unresolvedPairs.value : 'unknown'}.`
					: 'The Teaching Load summary is not available yet.'}
			</p>

			{/* A typed unknown is an operator-visible condition, not a silent zero. */}
			{model && !isKnown(model.policyCapacity) && (
				<div
					data-testid="teaching-load-truth-policy-unknown"
					role="status"
					className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-warning-border bg-warning-muted px-2 py-1 text-xs font-semibold text-warning-foreground"
				>
					<AlertTriangle className="size-3.5" />
					<span>{model.policyCapacity.reason}</span>
				</div>
			)}

			{model && isKnown(model.requiredPairs) && isKnown(model.unresolvedPairs) && model.unresolvedPairs.value === 0 && (
				<div
					data-testid="teaching-load-truth-complete"
					role="status"
					className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800"
				>
					<BadgeCheck className="size-3.5" />
					<span>Every class has a teacher.</span>
				</div>
			)}

			{model && isKnown(model.zeroLoadFaculty) && model.zeroLoadFaculty.value.count > 0 && (
				<div
					data-testid="teaching-load-truth-zero-load-note"
					className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-warning"
				>
					<Users className="size-3.5" />
					<span>{model.zeroLoadFaculty.value.count} active teacher(s) currently carry no load.</span>
				</div>
			)}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</section>
	);
}
