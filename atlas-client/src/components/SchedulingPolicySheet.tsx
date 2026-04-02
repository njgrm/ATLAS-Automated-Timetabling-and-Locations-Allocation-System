/**
 * Scheduling Policy Sheet — Right-side overlay for configuring timetabling
 * policy controls and per-constraint severity/weight overrides.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type { ConstraintOverride, SchedulingPolicy, ViolationCode } from '@/types';

import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { ScrollArea } from '@/ui/scroll-area';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/ui/sheet';
import { Slider } from '@/ui/slider';
import { Switch } from '@/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

/* ─── Default constraint config (client-side mirror of server defaults) ─── */

const DEFAULT_CONSTRAINT_CONFIG: Record<string, ConstraintOverride> = {
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: { enabled: true, weight: 5, treatAsHard: false },
	FACULTY_BREAK_REQUIREMENT_VIOLATED: { enabled: true, weight: 5, treatAsHard: false },
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: { enabled: true, weight: 4, treatAsHard: false },
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: { enabled: true, weight: 4, treatAsHard: false },
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: { enabled: true, weight: 3, treatAsHard: false },
	FACULTY_EXCESSIVE_IDLE_GAP: { enabled: true, weight: 3, treatAsHard: false },
	FACULTY_EARLY_START_PREFERENCE: { enabled: false, weight: 2, treatAsHard: false },
	FACULTY_LATE_END_PREFERENCE: { enabled: false, weight: 2, treatAsHard: false },
};

const SOFT_CONSTRAINT_LABELS: Record<string, { label: string; explanation: string }> = {
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: {
		label: 'Consecutive Teaching Limit',
		explanation: 'Penalizes when a faculty member teaches beyond the consecutive-minutes limit without a break.',
	},
	FACULTY_BREAK_REQUIREMENT_VIOLATED: {
		label: 'Break Requirement',
		explanation: 'Penalizes insufficient break time between consecutive teaching blocks.',
	},
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: {
		label: 'Excessive Travel Distance',
		explanation: 'Penalizes transitions between buildings that exceed the max walking distance threshold.',
	},
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: {
		label: 'Building Transitions/Day',
		explanation: 'Penalizes too many cross-building transitions for a faculty member in a single day.',
	},
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: {
		label: 'Transition Buffer',
		explanation: 'Penalizes back-to-back classes in different buildings with little or no gap time.',
	},
	FACULTY_EXCESSIVE_IDLE_GAP: {
		label: 'Excessive Idle Gap',
		explanation: 'Penalizes excessive total idle time between classes for a faculty member in a day.',
	},
	FACULTY_EARLY_START_PREFERENCE: {
		label: 'Avoid Early First Period',
		explanation: 'Soft preference to avoid scheduling faculty in the very first period of the day.',
	},
	FACULTY_LATE_END_PREFERENCE: {
		label: 'Avoid Late Last Period',
		explanation: 'Soft preference to avoid scheduling faculty in the very last period of the day.',
	},
};

/* ─── Helper: MetricExplain (inline tooltip) ─── */

function MetricExplain({ label, explanation }: { label: string; explanation: React.ReactNode }) {
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="text-xs font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm text-left transition-colors hover:text-foreground hover:border-foreground/50 pb-0.5"
					>
						{label}
					</button>
				</TooltipTrigger>
				<TooltipContent className="max-w-[260px] text-xs font-normal leading-relaxed" side="bottom">
					{explanation}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/* ─── Types ─── */

interface LocalPolicy {
	maxConsecutiveTeachingMinutesBeforeBreak: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	enforceConsecutiveBreakAsHard: boolean;
	enableTravelWellbeingChecks: boolean;
	maxWalkingDistanceMetersPerTransition: number;
	maxBuildingTransitionsPerDay: number;
	maxBackToBackTransitionsWithoutBuffer: number;
	maxIdleGapMinutesPerDay: number;
	avoidEarlyFirstPeriod: boolean;
	avoidLateLastPeriod: boolean;
	constraintConfig: Record<string, ConstraintOverride>;
}

function policyToLocal(p: SchedulingPolicy): LocalPolicy {
	return {
		maxConsecutiveTeachingMinutesBeforeBreak: p.maxConsecutiveTeachingMinutesBeforeBreak,
		minBreakMinutesAfterConsecutiveBlock: p.minBreakMinutesAfterConsecutiveBlock,
		maxTeachingMinutesPerDay: p.maxTeachingMinutesPerDay,
		earliestStartTime: p.earliestStartTime,
		latestEndTime: p.latestEndTime,
		enforceConsecutiveBreakAsHard: p.enforceConsecutiveBreakAsHard,
		enableTravelWellbeingChecks: p.enableTravelWellbeingChecks,
		maxWalkingDistanceMetersPerTransition: p.maxWalkingDistanceMetersPerTransition,
		maxBuildingTransitionsPerDay: p.maxBuildingTransitionsPerDay,
		maxBackToBackTransitionsWithoutBuffer: p.maxBackToBackTransitionsWithoutBuffer,
		maxIdleGapMinutesPerDay: p.maxIdleGapMinutesPerDay,
		avoidEarlyFirstPeriod: p.avoidEarlyFirstPeriod,
		avoidLateLastPeriod: p.avoidLateLastPeriod,
		constraintConfig: { ...DEFAULT_CONSTRAINT_CONFIG, ...(p.constraintConfig ?? {}) },
	};
}

function deepEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/* ─── Main Export ─── */

export default function SchedulingPolicySheet({
	schoolId,
	schoolYearId,
	onPolicySaved,
}: {
	schoolId: number;
	schoolYearId: number | null;
	onPolicySaved?: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [persisted, setPersisted] = useState<LocalPolicy | null>(null);
	const [local, setLocal] = useState<LocalPolicy | null>(null);

	const isDirty = useMemo(() => {
		if (!persisted || !local) return false;
		return !deepEqual(persisted, local);
	}, [persisted, local]);

	const fetchPolicy = useCallback(async () => {
		if (!schoolYearId) return;
		setLoading(true);
		try {
			const { data } = await atlasApi.get<{ policy: SchedulingPolicy }>(
				`/policies/scheduling/${schoolId}/${schoolYearId}`,
			);
			const lp = policyToLocal(data.policy);
			setPersisted(lp);
			setLocal(lp);
		} catch {
			toast.error('Failed to load scheduling policy.');
		} finally {
			setLoading(false);
		}
	}, [schoolId, schoolYearId]);

	useEffect(() => {
		if (open) fetchPolicy();
	}, [open, fetchPolicy]);

	const savePolicy = useCallback(async () => {
		if (!schoolYearId || !local) return;
		setSaving(true);
		try {
			const { data } = await atlasApi.put<{ policy: SchedulingPolicy }>(
				`/policies/scheduling/${schoolId}/${schoolYearId}`,
				local,
			);
			const lp = policyToLocal(data.policy);
			setPersisted(lp);
			setLocal(lp);
			toast.success('Scheduling policy saved.');
			onPolicySaved?.();
		} catch {
			toast.error('Failed to save policy. Your changes are preserved.');
		} finally {
			setSaving(false);
		}
	}, [schoolId, schoolYearId, local, onPolicySaved]);

	const update = useCallback(<K extends keyof LocalPolicy>(key: K, value: LocalPolicy[K]) => {
		setLocal((prev) => prev ? { ...prev, [key]: value } : prev);
	}, []);

	const updateConstraint = useCallback((code: string, field: keyof ConstraintOverride, value: unknown) => {
		setLocal((prev) => {
			if (!prev) return prev;
			const config = { ...prev.constraintConfig };
			config[code] = { ...config[code], [field]: value };
			return { ...prev, constraintConfig: config };
		});
	}, []);

	if (!schoolYearId) return null;

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 gap-1.5 relative" onClick={() => setOpen(true)}>
							<Settings2 className="size-3.5" />
							Policy
							{isDirty && (
								<span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-500" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent>Configure scheduling policy and soft constraints</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col p-0">
				<SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
					<SheetTitle className="text-base">Scheduling Policy</SheetTitle>
					<SheetDescription className="text-xs">
						Configure constraints, thresholds, and well-being controls for timetable generation.
					</SheetDescription>
				</SheetHeader>

				{loading ? (
					<div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
						Loading policy…
					</div>
				) : local ? (
					<ScrollArea className="flex-1 min-h-0">
						<div className="px-6 py-4 space-y-6">

							{/* ── Core Teaching Constraints ── */}
							<section className="space-y-4">
								<h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
									Core Teaching Constraints
								</h3>

								{/* Max Consecutive Before Break */}
								<PolicyNumberField
									label="Max Consecutive Teaching (min)"
									explanation="Maximum minutes a faculty member can teach without a break. Controls the FACULTY_CONSECUTIVE_LIMIT_EXCEEDED check."
									value={local.maxConsecutiveTeachingMinutesBeforeBreak}
									onChange={(v) => update('maxConsecutiveTeachingMinutesBeforeBreak', v)}
									min={30} max={600}
								/>

								{/* Min Break After Block */}
								<PolicyNumberField
									label="Min Break After Block (min)"
									explanation="Minimum break minutes required after a consecutive teaching block."
									value={local.minBreakMinutesAfterConsecutiveBlock}
									onChange={(v) => update('minBreakMinutesAfterConsecutiveBlock', v)}
									min={5} max={120}
								/>

								{/* Max Teaching Per Day */}
								<PolicyNumberField
									label="Max Teaching Per Day (min)"
									explanation="Daily limit on total teaching minutes per faculty member. Exceeding this is always a HARD violation."
									value={local.maxTeachingMinutesPerDay}
									onChange={(v) => update('maxTeachingMinutesPerDay', v)}
									min={60} max={600}
								/>

								{/* Earliest Start / Latest End */}
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<MetricExplain
											label="Earliest Start Time"
											explanation="The earliest time a class may be scheduled."
										/>
										<Input
											type="time"
											className="h-8 text-xs"
											value={local.earliestStartTime}
											onChange={(e) => update('earliestStartTime', e.target.value)}
										/>
									</div>
									<div className="space-y-1.5">
										<MetricExplain
											label="Latest End Time"
											explanation="The latest time a class may end."
										/>
										<Input
											type="time"
											className="h-8 text-xs"
											value={local.latestEndTime}
											onChange={(e) => update('latestEndTime', e.target.value)}
										/>
									</div>
								</div>

								{/* Enforce Consecutive Break as Hard */}
								<PolicySwitch
									label="Enforce Consecutive Break as Hard"
									explanation="When ON, consecutive teaching limit and break violations become HARD constraints that block publish."
									checked={local.enforceConsecutiveBreakAsHard}
									onCheckedChange={(v) => update('enforceConsecutiveBreakAsHard', v)}
									warning
								/>
							</section>

							{/* ── Travel & Well-being ── */}
							<section className="space-y-4">
								<h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
									Travel & Well-being
								</h3>

								<PolicySwitch
									label="Enable Travel/Well-being Checks"
									explanation="Master toggle for all travel distance, building transition, idle gap, and schedule preference soft constraints."
									checked={local.enableTravelWellbeingChecks}
									onCheckedChange={(v) => update('enableTravelWellbeingChecks', v)}
								/>

								{local.enableTravelWellbeingChecks && (
									<div className="space-y-4 pl-1 border-l-2 border-primary/20 ml-1">
										<PolicyNumberField
											label="Max Walking Distance/Transition (m)"
											explanation="Maximum Euclidean distance (meters) between buildings for a single transition before triggering a soft violation."
											value={local.maxWalkingDistanceMetersPerTransition}
											onChange={(v) => update('maxWalkingDistanceMetersPerTransition', v)}
											min={10} max={1000}
										/>

										<PolicyNumberField
											label="Max Building Transitions/Day"
											explanation="Maximum number of cross-building moves per faculty member per day."
											value={local.maxBuildingTransitionsPerDay}
											onChange={(v) => update('maxBuildingTransitionsPerDay', v)}
											min={1} max={20}
										/>

										<PolicyNumberField
											label="Max Back-to-Back Without Buffer"
											explanation="Maximum consecutive cross-building transitions with ≤5 min gap."
											value={local.maxBackToBackTransitionsWithoutBuffer}
											onChange={(v) => update('maxBackToBackTransitionsWithoutBuffer', v)}
											min={1} max={10}
										/>

										<PolicyNumberField
											label="Max Idle Gap/Day (min)"
											explanation="Maximum total idle (non-teaching) minutes between a faculty member's first and last class in a day."
											value={local.maxIdleGapMinutesPerDay}
											onChange={(v) => update('maxIdleGapMinutesPerDay', v)}
											min={10} max={300}
										/>

										<PolicySwitch
											label="Avoid Early First Period"
											explanation="When ON, generates a soft violation when faculty are scheduled in the first period (within 15 min of earliest start time)."
											checked={local.avoidEarlyFirstPeriod}
											onCheckedChange={(v) => update('avoidEarlyFirstPeriod', v)}
										/>

										<PolicySwitch
											label="Avoid Late Last Period"
											explanation="When ON, generates a soft violation when faculty are scheduled in the last period (within 15 min of latest end time)."
											checked={local.avoidLateLastPeriod}
											onCheckedChange={(v) => update('avoidLateLastPeriod', v)}
										/>
									</div>
								)}
							</section>

							{/* ── Per-Constraint Severity Controls ── */}
							<section className="space-y-4">
								<h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
									Per-Constraint Controls
								</h3>
								<p className="text-[0.6875rem] text-muted-foreground">
									Toggle, weight, and optionally promote each soft constraint to hard.
								</p>

								<div className="space-y-3">
									{Object.entries(SOFT_CONSTRAINT_LABELS).map(([code, info]) => {
										const cfg = local.constraintConfig[code] ?? DEFAULT_CONSTRAINT_CONFIG[code];
										return (
											<ConstraintRow
												key={code}
												code={code as ViolationCode}
												label={info.label}
												explanation={info.explanation}
												config={cfg}
												onToggleEnabled={(v) => updateConstraint(code, 'enabled', v)}
												onWeightChange={(v) => updateConstraint(code, 'weight', v)}
												onToggleTreatAsHard={(v) => updateConstraint(code, 'treatAsHard', v)}
											/>
										);
									})}
								</div>
							</section>
						</div>
					</ScrollArea>
				) : (
					<div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
						No policy data available.
					</div>
				)}

				<SheetFooter className="shrink-0 px-6 py-4 border-t border-border flex items-center gap-2">
					{isDirty && (
						<span className="text-xs text-amber-600 flex items-center gap-1">
							<AlertTriangle className="size-3" />
							Unsaved changes
						</span>
					)}
					<div className="flex-1" />
					<Button
						variant="default"
						size="sm"
						disabled={!isDirty || saving}
						onClick={savePolicy}
						className="gap-1.5"
					>
						<Save className="size-3.5" />
						{saving ? 'Saving…' : 'Save Policy'}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

/* ─── Sub-components ─── */

function PolicyNumberField({
	label,
	explanation,
	value,
	onChange,
	min,
	max,
}: {
	label: string;
	explanation: string;
	value: number;
	onChange: (v: number) => void;
	min: number;
	max: number;
}) {
	return (
		<div className="space-y-1.5">
			<MetricExplain label={label} explanation={explanation} />
			<Input
				type="number"
				className="h-8 text-xs w-32"
				value={value}
				min={min}
				max={max}
				onChange={(e) => {
					const n = parseInt(e.target.value, 10);
					if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
				}}
			/>
		</div>
	);
}

function PolicySwitch({
	label,
	explanation,
	checked,
	onCheckedChange,
	warning,
}: {
	label: string;
	explanation: string;
	checked: boolean;
	onCheckedChange: (v: boolean) => void;
	warning?: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-3">
			<MetricExplain label={label} explanation={explanation} />
			<Switch
				checked={checked}
				onCheckedChange={onCheckedChange}
				className={warning && checked ? 'data-[state=checked]:bg-amber-500' : undefined}
			/>
		</div>
	);
}

function ConstraintRow({
	code,
	label,
	explanation,
	config,
	onToggleEnabled,
	onWeightChange,
	onToggleTreatAsHard,
}: {
	code: ViolationCode;
	label: string;
	explanation: string;
	config: ConstraintOverride;
	onToggleEnabled: (v: boolean) => void;
	onWeightChange: (v: number) => void;
	onToggleTreatAsHard: (v: boolean) => void;
}) {
	return (
		<div className={`rounded-md border p-3 space-y-2.5 transition-opacity ${config.enabled ? 'border-border' : 'border-border/50 opacity-60'}`}>
			{/* Row 1: Name + enable toggle */}
			<div className="flex items-center justify-between gap-2">
				<MetricExplain label={label} explanation={explanation} />
				<Switch
					checked={config.enabled}
					onCheckedChange={onToggleEnabled}
					aria-label={`Enable ${label}`}
				/>
			</div>

			{config.enabled && (
				<>
					{/* Row 2: Weight slider */}
					<div className="space-y-1">
						<div className="flex items-center justify-between">
							<Label className="text-[0.625rem] text-muted-foreground">
								Weight
							</Label>
							<span className="text-[0.625rem] font-mono text-muted-foreground">{config.weight}/10</span>
						</div>
						<Slider
							value={[config.weight]}
							min={1}
							max={10}
							step={1}
							onValueChange={([v]) => onWeightChange(v)}
							aria-label={`${label} weight`}
						/>
					</div>

					{/* Row 3: Treat as hard */}
					<div className="flex items-center justify-between gap-2">
						<span className="text-[0.625rem] text-muted-foreground">Treat as Hard</span>
						<div className="flex items-center gap-1.5">
							{config.treatAsHard && (
								<span className="text-[0.5625rem] text-amber-600 font-medium">Blocks publish</span>
							)}
							<Switch
								checked={config.treatAsHard}
								onCheckedChange={onToggleTreatAsHard}
								className={config.treatAsHard ? 'data-[state=checked]:bg-red-500' : undefined}
								aria-label={`Treat ${label} as hard constraint`}
							/>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
