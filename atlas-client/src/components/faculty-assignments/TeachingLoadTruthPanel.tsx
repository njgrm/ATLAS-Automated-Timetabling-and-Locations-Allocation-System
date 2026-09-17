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
	/** Concise server explanations for unresolved pairs, shown on demand only. */
	unresolvedReasons?: Array<{ code: string; message: string }>;
};

const CHIP_TONE: Record<'neutral' | 'success' | 'warning' | 'danger' | 'unknown', string> = {
	neutral: 'border-border/60 bg-background text-foreground',
	success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
	warning: 'border-amber-200 bg-amber-50 text-amber-800',
	danger: 'border-rose-200 bg-rose-50 text-rose-800',
	unknown: 'border-dashed border-border bg-muted/40 text-muted-foreground',
};

function MetricChip({
	label,
	metric,
	format,
	tone = 'neutral',
	testId,
}: {
	label: string;
	metric: TruthMetric<unknown>;
	format: (value: never) => string;
	tone?: keyof typeof CHIP_TONE;
	testId: string;
}) {
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
export function TeachingLoadTruthPanel({ model, loading = false, sourceRevision = null, unresolvedReasons = [] }: TeachingLoadTruthPanelProps) {
	const zeroLoadNames = model && isKnown(model.zeroLoadFaculty) ? model.zeroLoadFaculty.value.names : [];
	const adviserNames = model && isKnown(model.adviserStatus) ? model.adviserStatus.value.names : [];
	const hgExplanation = model && isKnown(model.excludedHgRows) ? model.excludedHgRows.value.explanation : '';
	const hasDrillDown = zeroLoadNames.length > 0 || adviserNames.length > 0 || unresolvedReasons.length > 0 || Boolean(hgExplanation);

	// One-line summary kept visible while the detailed metric walls stay behind
	// the disclosure. Never invents a number: an unknown authority reads
	// "unknown" rather than 0.
	const summaryLine = model
		? [
			`Required ${isKnown(model.requiredPairs) ? model.requiredPairs.value : 'unknown'}`,
			`Unresolved ${isKnown(model.unresolvedPairs) ? model.unresolvedPairs.value : 'unknown'}`,
		].join(' · ')
		: 'Authority unavailable';

	return (
		<section
			data-testid="teaching-load-truth-panel"
			aria-label="Canonical Teaching Load truth"
			className="rounded-xl border border-border/40 bg-background px-2 py-1.5 shadow-sm"
		>
			{/*
			 * CLIENT-QUALITY-C01: the truth surface is collapsed by default behind
			 * the shared @/ui Accordion disclosure, with a one-line summary always
			 * visible. The detailed metric rows remain in the DOM (the primitive
			 * collapses with CSS rather than unmounting) so server-render and
			 * existing canonical-truth contract tests keep observing the full
			 * values while the operator sees a single compact line.
			 */}
			<Accordion collapsible className="w-full">
				<AccordionItem value="truth" className="border-b-0">
					<AccordionTrigger className="items-center gap-1.5 py-1 text-left hover:no-underline">
						<span className="flex min-w-0 flex-1 items-center gap-1.5">
							<ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<span className="shrink-0 text-xs font-bold uppercase tracking-widest text-muted-foreground">Teaching Load truth</span>
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
										<Badge variant="outline" className="h-6 cursor-help rounded-full border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 shadow-none">
											Source verified
										</Badge>
									</TooltipTrigger>
									<TooltipContent side="bottom" className="max-w-72 p-3 text-xs font-medium leading-relaxed">
										This summary is derived from the canonical read-only Teaching Load authority.
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
										<DrillDownList title="Zero-load active teachers" values={zeroLoadNames} empty="Every active teacher currently carries load." />
										<DrillDownList title="Class advisers" values={adviserNames} empty="No adviser mapping is recorded for this scope." />
										<DrillDownList
											title="Unresolved reasons"
											values={unresolvedReasons.map((reason) => reason.message).filter(Boolean)}
											empty="No unresolved pair reasons were reported."
										/>
										{hgExplanation && (
											<div className="space-y-1">
												<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Excluded rows</p>
												<p className="text-xs font-medium text-muted-foreground">{hgExplanation}</p>
											</div>
										)}
									</PopoverContent>
								</Popover>
							)}
						</div>

			{/* Row 1 — demand and assignment truth. */}
			<div className="mt-1.5 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto border-t border-border/40 pt-1.5" data-testid="teaching-load-truth-summary">
				<MetricChip
					label="Required pairs"
					testId="teaching-load-truth-required-pairs"
					metric={model?.requiredPairs ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: number) => `${value}`}
				/>
				<MetricChip
					label="Assigned pairs"
					testId="teaching-load-truth-assigned-pairs"
					tone={model && isKnown(model.assignedPairs) && model.assignedPairs.value.real > 0 ? 'success' : 'neutral'}
					metric={model?.assignedPairs ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: { real: number; placeholder: number; total: number }) => `${value.total} (${value.real} real, ${value.placeholder} temp)`}
				/>
				<MetricChip
					label="Unresolved pairs"
					testId="teaching-load-truth-unresolved-pairs"
					tone={model && isKnown(model.unresolvedPairs) && model.unresolvedPairs.value > 0 ? 'warning' : 'neutral'}
					metric={model?.unresolvedPairs ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: number) => `${value}`}
				/>
				<MetricChip
					label="Actual teaching"
					testId="teaching-load-truth-actual-hours"
					metric={model?.actualTeachingMinutes ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: number) => `${minutesToHours(value)}h`}
				/>
			</div>

			{/* Row 2 — persisted policy capacity, overload, and exceptions. */}
			<div className="mt-1.5 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto border-t border-border/40 pt-1.5" data-testid="teaching-load-truth-capacity">
				<MetricChip
					label="Standard"
					testId="teaching-load-truth-standard"
					metric={model?.policyCapacity ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: { teachingStandardMinutes: number; hardCapMinutes: number | null }) => `${minutesToHours(value.teachingStandardMinutes)}h`}
				/>
				<MetricChip
					label="Hard cap"
					testId="teaching-load-truth-hard-cap"
					metric={model?.policyCapacity ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: { teachingStandardMinutes: number; hardCapMinutes: number | null }) => (value.hardCapMinutes == null ? 'Not set' : `${minutesToHours(value.hardCapMinutes)}h`)}
				/>
				<MetricChip
					label="Over standard"
					testId="teaching-load-truth-over-standard"
					tone={model && isKnown(model.overload) && model.overload.value.overStandardCount > 0 ? 'warning' : 'success'}
					metric={model?.overload ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: { overStandardCount: number; overHardCapCount: number; excessMinutes: number }) => `${value.overStandardCount} (+${minutesToHours(value.excessMinutes)}h)`}
				/>
				<MetricChip
					label="Over hard cap"
					testId="teaching-load-truth-over-hard-cap"
					tone={model && isKnown(model.overload) && model.overload.value.overHardCapCount > 0 ? 'danger' : 'neutral'}
					metric={model?.overload ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: { overStandardCount: number; overHardCapCount: number; excessMinutes: number }) => `${value.overHardCapCount}`}
				/>
				<MetricChip
					label="Remaining"
					testId="teaching-load-truth-remaining"
					metric={model?.remainingCapacityMinutes ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: number) => `${minutesToHours(value)}h`}
				/>
				<MetricChip
					label="Zero-load"
					testId="teaching-load-truth-zero-load"
					tone={model && isKnown(model.zeroLoadFaculty) && model.zeroLoadFaculty.value.count > 0 ? 'warning' : 'success'}
					metric={model?.zeroLoadFaculty ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: { count: number; names: string[] }) => `${value.count}`}
				/>
				<MetricChip
					label="Advisers"
					testId="teaching-load-truth-advisers"
					metric={model?.adviserStatus ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: { count: number; names: string[] }) => `${value.count}`}
				/>
				<MetricChip
					label="Advisory credit"
					testId="teaching-load-truth-advisory-credit"
					metric={model?.advisoryCreditMinutes ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: number) => `${minutesToHours(value)}h`}
				/>
				<MetricChip
					label="HG excluded"
					testId="teaching-load-truth-hg-excluded"
					metric={model?.excludedHgRows ?? { state: 'unknown', reason: 'Waiting for authority.' }}
					format={(value: { count: number; explanation: string }) => `${value.count}`}
				/>
			</div>

			<p className="sr-only" aria-live="polite" data-testid="teaching-load-truth-summary-text">
				{model
					? `Required pairs ${isKnown(model.requiredPairs) ? model.requiredPairs.value : 'unknown'}; assigned pairs ${isKnown(model.assignedPairs) ? model.assignedPairs.value.total : 'unknown'}; unresolved pairs ${isKnown(model.unresolvedPairs) ? model.unresolvedPairs.value : 'unknown'}.`
					: 'Canonical Teaching Load authority is not available yet.'}
			</p>

			{/* A typed unknown is an operator-visible condition, not a silent zero. */}
			{model && !isKnown(model.policyCapacity) && (
				<div
					data-testid="teaching-load-truth-policy-unknown"
					role="status"
					className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"
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
					<span>Every required subject-section pair has an owner.</span>
				</div>
			)}

			{model && isKnown(model.zeroLoadFaculty) && model.zeroLoadFaculty.value.count > 0 && (
				<div
					data-testid="teaching-load-truth-zero-load-note"
					className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700"
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
