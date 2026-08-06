import { useState } from 'react';
import type { ElementType, ReactNode } from 'react';

import type { Violation, ViolationCode } from '@/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
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
		<Button
			type="button"
			variant="outline"
			size="sm"
			className={`h-6.5 gap-0 px-2.5 py-1 text-xs select-none ${base}`}
			onClick={onClick}
			aria-pressed={active}
			aria-label={`${label}, ${count}`}
		>
			{label}
			<span className="ml-1 opacity-70 font-semibold">{count}</span>
		</Button>
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
					<Button type="button" variant="ghost" size="sm" className="h-auto cursor-help px-0 py-0 text-left align-top outline-none hover:bg-transparent hover:opacity-80 focus-visible:ring-1 focus-visible:ring-primary">
						{content}
					</Button>
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
					<Button type="button" variant="ghost" size="sm" className="h-auto cursor-help rounded-sm border-b border-dotted border-muted-foreground/50 px-0 py-0 pb-0.5 text-left text-xs font-medium text-muted-foreground outline-none hover:border-foreground/50 hover:bg-transparent hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1">
						{label}
					</Button>
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
	renderAction,
	labels,
}: {
	code: ViolationCode;
	violations: Violation[];
	selectedViolation: Violation | null;
	onSelect: (v: Violation) => void;
	onExplain?: (v: Violation) => void;
	formatConstraintMessage?: (msg: string, violation?: Violation) => string;
	renderAction?: (v: Violation) => ReactNode;
	labels: Record<ViolationCode, string>;
}) {
	const isHard = violations[0]?.severity === 'HARD';
	const [visibleCount, setVisibleCount] = useState(5);
	const visibleViolations = violations.slice(0, visibleCount);
	const hiddenCount = Math.max(violations.length - visibleCount, 0);
	const groupLabel = labels[code] ?? String(code);
	const groupSummary = violations.length === 1
		? `1 ${groupLabel.toLowerCase()} item needs review`
		: `${violations.length} ${groupLabel.toLowerCase()} items need review`;

	return (
		<Accordion
			type="single"
			collapsible
			defaultValue={isHard ? String(code) : undefined}
			className="rounded-md border border-border bg-background"
		>
			<AccordionItem value={String(code)} className="border-0">
				<AccordionTrigger className="px-2 py-1.5 hover:no-underline">
					<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
						<Badge
							variant="outline"
							className={`h-4.5 px-1.5 text-xs ${isHard ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
						>
							{isHard ? 'HARD' : 'SOFT'}
						</Badge>
						<span className="truncate text-xs font-semibold">{groupLabel}</span>
						<span className="ml-auto shrink-0 text-xs text-muted-foreground font-semibold">{violations.length}</span>
					</div>
				</AccordionTrigger>
				<AccordionContent className="border-t border-border pb-0">
					<div>
						<p className="min-w-0 break-words border-b border-border/70 px-3 py-2 text-xs font-bold leading-snug text-muted-foreground">
							{groupSummary}
						</p>
						{visibleViolations.map((v, i) => {
							const isSelected = selectedViolation === v;
							const formattedMessage = formatConstraintMessage ? formatConstraintMessage(v.message, v) : v.message;
							const action = renderAction?.(v) ?? null;
							return (
								<div key={i} className={`flex min-w-0 flex-wrap items-stretch gap-1 ${
									isSelected
										? 'bg-primary/10 text-foreground'
										: 'text-muted-foreground hover:bg-muted/50'
								}`}>
									{v.meta && Object.keys(v.meta).length > 0 ? (
										<TooltipProvider delayDuration={200}>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => onSelect(v)}
														className="h-auto min-h-9 min-w-0 flex-[1_1_13rem] justify-start rounded-none px-3 py-2 text-left text-xs leading-tight transition-colors hover:bg-transparent"
													>
														<span className="min-w-0 whitespace-normal break-words text-left underline decoration-dashed decoration-muted-foreground/50 underline-offset-2 line-clamp-2">{formattedMessage}</span>
													</Button>
												</TooltipTrigger>
												<TooltipContent className="max-w-[min(18rem,calc(100vw-2rem))] whitespace-normal break-words text-xs font-normal leading-relaxed space-y-1 py-2 px-3 border-amber-200 bg-amber-50 text-amber-900" side="right">
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
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => onSelect(v)}
											className="h-auto min-h-9 min-w-0 flex-[1_1_13rem] justify-start rounded-none px-3 py-2 text-left text-xs leading-tight transition-colors hover:bg-transparent"
										>
											<span className="min-w-0 whitespace-normal break-words text-left line-clamp-2">{formattedMessage}</span>
										</Button>
									)}
									{onExplain && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={(e) => {
												e.stopPropagation();
												onExplain(v);
											}}
											className="h-auto shrink-0 self-stretch rounded-md px-2 py-1.5 text-xs font-semibold text-primary hover:bg-transparent hover:underline"
										>
											Explain
										</Button>
									)}
									{action ? <div className="min-w-0 shrink-0 overflow-hidden">{action}</div> : null}
								</div>
							);
						})}
						{hiddenCount > 0 ? (
							<div className="border-t border-border/70 p-2.5">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8 w-full text-xs font-semibold"
									onClick={() => setVisibleCount((count) => count + 10)}
								>
									Show more ({hiddenCount} left)
								</Button>
							</div>
						) : null}
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
