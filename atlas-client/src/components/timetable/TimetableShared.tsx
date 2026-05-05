import type { ElementType, ReactNode } from 'react';

import type { Violation, ViolationCode } from '@/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Badge } from '@/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

export function FilterChip({
	label,
	count,
	active,
	onClick,
	variant,
}: {
	label: string;
	count: number;
	active: boolean;
	onClick: () => void;
	variant?: 'destructive' | 'warning';
}) {
	let base = 'border-border text-muted-foreground hover:bg-muted';
	if (active) {
		if (variant === 'destructive') base = 'border-red-300 bg-red-50 text-red-700';
		else if (variant === 'warning') base = 'border-amber-300 bg-amber-50 text-amber-700';
		else base = 'border-primary/30 bg-primary/5 text-foreground';
	}

	return (
		<Badge
			variant="outline"
			className={`h-6 px-2 text-[0.6875rem] cursor-pointer select-none ${base}`}
			onClick={onClick}
		>
			{label}
			<span className="ml-1 opacity-70">{count}</span>
		</Badge>
	);
}

export function StatItem({
	icon: Icon,
	label,
	value,
	explanation,
	className = '',
}: {
	icon: ElementType;
	label: string;
	value: string;
	explanation?: ReactNode;
	className?: string;
}) {
	const content = (
		<span className={`flex items-center gap-1 ${className}`}>
			<Icon className="size-3 shrink-0" />
			<span className={explanation ? 'opacity-90 border-b border-dotted border-current/50' : 'opacity-70'}>{label}:</span>
			<span className="font-medium text-foreground">{value}</span>
		</span>
	);

	if (!explanation) return content;

	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button type="button" className="cursor-help outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm text-left align-top transition-colors hover:opacity-80">
						{content}
					</button>
				</TooltipTrigger>
				<TooltipContent className="max-w-55 text-xs font-normal leading-relaxed" side="bottom">
					{explanation}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function MetricExplain({ label, explanation }: { label: string; explanation: ReactNode }) {
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button type="button" className="text-xs font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm text-left transition-colors hover:text-foreground hover:border-foreground/50 pb-0.5">
						{label}
					</button>
				</TooltipTrigger>
				<TooltipContent className="max-w-65 text-xs font-normal leading-relaxed" side="bottom">
					{explanation}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function ViolationGroup({
	code,
	violations,
	selectedViolation,
	onSelect,
	onExplain,
	formatConstraintMessage,
	labels,
}: {
	code: ViolationCode;
	violations: Violation[];
	selectedViolation: Violation | null;
	onSelect: (v: Violation) => void;
	onExplain?: (v: Violation) => void;
	formatConstraintMessage?: (msg: string) => string;
	labels: Record<ViolationCode, string>;
}) {
	const isHard = violations[0]?.severity === 'HARD';

	return (
		<Accordion
			type="single"
			collapsible
			defaultValue={isHard ? String(code) : undefined}
			className="rounded-md border border-border bg-background"
		>
			<AccordionItem value={String(code)} className="border-0">
				<AccordionTrigger className="px-2 py-1.5 hover:no-underline">
					<div className="flex min-w-0 flex-1 items-center gap-2 text-left">
						<Badge
							variant="outline"
							className={`h-4 px-1 text-[0.5625rem] ${isHard ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
						>
							{isHard ? 'HARD' : 'SOFT'}
						</Badge>
						<span className="truncate text-xs font-medium">{labels[code]}</span>
						<span className="ml-auto shrink-0 text-[0.6875rem] text-muted-foreground">{violations.length}</span>
					</div>
				</AccordionTrigger>
				<AccordionContent className="border-t border-border pb-0">
					<div>
						{violations.map((v, i) => {
							const isSelected = selectedViolation === v;
							return (
								<div key={i} className={`flex items-center gap-0.5 ${
									isSelected
										? 'bg-primary/10 text-foreground'
										: 'text-muted-foreground hover:bg-muted/50'
								}`}>
									{v.meta && Object.keys(v.meta).length > 0 ? (
										<TooltipProvider delayDuration={200}>
											<Tooltip>
												<TooltipTrigger asChild>
													<button
														onClick={() => onSelect(v)}
														className="flex-1 text-left px-3 py-1.5 text-[0.6875rem] leading-tight transition-colors"
													>
														<span className="line-clamp-2 underline decoration-dashed decoration-muted-foreground/50 underline-offset-2">{formatConstraintMessage ? formatConstraintMessage(v.message) : v.message}</span>
													</button>
												</TooltipTrigger>
												<TooltipContent className="max-w-70 text-[0.625rem] font-normal leading-relaxed space-y-1 py-2 px-3 border-amber-200 bg-amber-50 text-amber-900" side="right">
													<div className="font-semibold text-amber-700 pb-1 mb-1 border-b border-amber-200/60">Constraint Context</div>
													{v.meta.consecutiveMinutes != null && v.meta.maxConsecutive != null && (
														<div>Observed: {String(v.meta.consecutiveMinutes)} min · Limit: {String(v.meta.maxConsecutive)} min · <span className="font-semibold">Δ +{Number(v.meta.consecutiveMinutes) - Number(v.meta.maxConsecutive)} min</span></div>
													)}
													{v.meta.dailyMinutes != null && v.meta.maxTeachingMinutesPerDay != null && (
														<div>Observed: {String(v.meta.dailyMinutes)} min · Limit: {String(v.meta.maxTeachingMinutesPerDay)} min · <span className="font-semibold">Δ +{Number(v.meta.dailyMinutes) - Number(v.meta.maxTeachingMinutesPerDay)} min</span></div>
													)}
													{v.meta.actualGapMinutes != null && v.meta.requiredBreakMinutes != null && (
														<div>Actual break: {String(v.meta.actualGapMinutes)} min · Required: {String(v.meta.requiredBreakMinutes)} min · <span className="font-semibold">Short by {Number(v.meta.requiredBreakMinutes) - Number(v.meta.actualGapMinutes)} min</span></div>
													)}
													{v.meta.totalIdleMinutes != null && v.meta.configuredThresholds != null && (
														<div>Idle: {String(v.meta.totalIdleMinutes)} min · Limit: {String((v.meta.configuredThresholds as Record<string, unknown>).maxIdleGapMinutesPerDay ?? '?')} min</div>
													)}
													{v.meta.estimatedDistanceMeters != null && (
														<div>Distance: ~{String(v.meta.estimatedDistanceMeters)}m{v.meta.configuredThresholds ? ` · Limit: ${String((v.meta.configuredThresholds as Record<string, unknown>).maxWalkingDistanceMetersPerTransition ?? '?')}m` : ''}</div>
													)}
													{v.meta.gapMinutes != null && (
														<div>Gap: {String(v.meta.gapMinutes)} min</div>
													)}
													{v.meta.buildingTransitions != null && (
														<div>Building trans: {String(v.meta.buildingTransitions)}{v.meta.configuredThresholds ? ` · Limit: ${String((v.meta.configuredThresholds as Record<string, unknown>).maxBuildingTransitionsPerDay ?? '?')}` : ''}</div>
													)}
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									) : (
										<button
											onClick={() => onSelect(v)}
											className="flex-1 text-left px-3 py-1.5 text-[0.6875rem] leading-tight transition-colors"
										>
											<span className="line-clamp-2">{formatConstraintMessage ? formatConstraintMessage(v.message) : v.message}</span>
										</button>
									)}
									{onExplain && (
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												onExplain(v);
											}}
											className="px-2 py-1.5 text-[0.625rem] font-medium text-primary hover:underline"
										>
											Explain
										</button>
									)}
								</div>
							);
						})}
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
