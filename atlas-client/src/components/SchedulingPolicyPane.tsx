/**
 * SchedulingPolicyPane
 *
 * Inline policy configuration panel rendered in the center pane of ScheduleReview.
 * Three columns, each with an independently scrollable body and a sticky header —
 * so users can scroll one panel without disturbing the others.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronRight, Save, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type { ConstraintOverride, SchedulingPolicy, ViolationCode } from '@/types';

import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { ScrollArea } from '@/ui/scroll-area';
import { Slider } from '@/ui/slider';
import { Switch } from '@/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

/* ─── Defaults ─── */

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

function deepEqual(a: unknown, b: unknown) {
	return JSON.stringify(a) === JSON.stringify(b);
}

/* ─── Micro-components ─── */

function MetricExplain({ label, explanation }: { label: string; explanation: React.ReactNode }) {
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="text-xs font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm text-left transition-colors hover:text-foreground hover:border-foreground/50 pb-0.5"
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
				className="h-8 text-xs"
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
		<div className="flex items-center justify-between gap-3 py-0.5">
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
	label,
	code,
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
		<div
			className={`rounded-md border p-3 space-y-2 transition-opacity ${
				config.enabled ? 'border-border' : 'border-border/40 opacity-55'
			}`}
		>
			<div className="flex items-center justify-between gap-2">
				<MetricExplain label={label} explanation={explanation} />
				<Switch checked={config.enabled} onCheckedChange={onToggleEnabled} aria-label={`Enable ${label}`} />
			</div>

			<AnimatePresence>
				{config.enabled && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.15 }}
						className="overflow-hidden space-y-2"
					>
						<div className="space-y-1">
							<div className="flex items-center justify-between">
								<Label className="text-[0.625rem] text-muted-foreground">Weight</Label>
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
						<div className="flex items-center justify-between gap-2">
							<span className="text-[0.625rem] text-muted-foreground">Treat as Hard</span>
							<div className="flex items-center gap-1.5">
								{config.treatAsHard && (
									<span className="text-[0.5625rem] text-red-600 font-medium">Blocks publish</span>
								)}
								<Switch
									checked={config.treatAsHard}
									onCheckedChange={onToggleTreatAsHard}
									className={config.treatAsHard ? 'data-[state=checked]:bg-red-500' : undefined}
									aria-label={`Treat ${label} as hard`}
								/>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

/* ─── Section Card: sticky title + independent per-column scroll ─── */
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col min-h-0 h-full rounded-lg border border-border bg-card overflow-hidden">
			{/* Sticky non-scrolling section header */}
			<div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/60 bg-card">
				<h3 className="text-[0.6875rem] font-semibold text-foreground uppercase tracking-wider">
					{title}
				</h3>
			</div>
			{/* Each column independently scrollable */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="px-4 py-3 space-y-3">
					{children}
				</div>
			</ScrollArea>
		</div>
	);
}

/* ─── Main export ─── */

export default function SchedulingPolicyPane({
	schoolId,
	schoolYearId,
	onBack,
	onPolicySaved,
}: {
	schoolId: number;
	schoolYearId: number | null;
	onBack: () => void;
	onPolicySaved?: () => void;
}) {
	const [loading, setLoading] = useState(true);
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
		void fetchPolicy();
	}, [fetchPolicy]);

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
		setLocal((prev) => (prev ? { ...prev, [key]: value } : prev));
	}, []);

	const updateConstraint = useCallback((code: string, field: keyof ConstraintOverride, value: unknown) => {
		setLocal((prev) => {
			if (!prev) return prev;
			const config = { ...prev.constraintConfig };
			config[code] = { ...config[code], [field]: value };
			return { ...prev, constraintConfig: config };
		});
	}, []);

	return (
		<div className="flex flex-col min-h-0 h-full bg-muted/30">
			{/* ── Toolbar (non-scrolling) ── */}
			<div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-background/80 backdrop-blur-sm">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" className="h-7 gap-1.5 text-muted-foreground" onClick={onBack}>
								<ArrowLeft className="size-3.5" />
								Back to Timetable
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">Return to the timetable grid view</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<div className="flex items-center gap-1 text-muted-foreground">
					<ChevronRight className="size-3" />
				</div>
				<div className="flex items-center gap-1.5 text-sm font-medium">
					<Shield className="size-3.5 text-primary" />
					Scheduling Policy
				</div>

				<div className="flex-1" />

				{isDirty && (
					<span className="flex items-center gap-1 text-xs text-amber-600">
						<AlertTriangle className="size-3" />
						Unsaved changes
					</span>
				)}
				<Button
					variant="default"
					size="sm"
					disabled={!isDirty || saving}
					onClick={savePolicy}
					className="h-7 gap-1.5"
				>
					<Save className="size-3.5" />
					{saving ? 'Saving…' : 'Save Policy'}
				</Button>
			</div>

			{/* ── Content ── */}
			{loading ? (
				<div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
					Loading policy…
				</div>
			) : !local ? (
				<div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
					No policy data available.
				</div>
			) : (
				/* Outer container does NOT scroll — each column card scrolls independently */
				<div className="flex-1 min-h-0 overflow-hidden p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

					{/* ── COL 1: Core Teaching Limits ── */}
					<SectionCard title="Core Teaching Limits">
						<PolicyNumberField
							label="Max Consecutive Teaching (min)"
							explanation="Maximum minutes a faculty member can teach without a break. Controls the Consecutive Limit check."
							value={local.maxConsecutiveTeachingMinutesBeforeBreak}
							onChange={(v) => update('maxConsecutiveTeachingMinutesBeforeBreak', v)}
							min={30}
							max={600}
						/>
						<PolicyNumberField
							label="Min Break After Block (min)"
							explanation="Minimum break minutes required after a consecutive teaching block before the next class."
							value={local.minBreakMinutesAfterConsecutiveBlock}
							onChange={(v) => update('minBreakMinutesAfterConsecutiveBlock', v)}
							min={5}
							max={120}
						/>
						<PolicyNumberField
							label="Max Teaching Per Day (min)"
							explanation="Daily ceiling on total teaching minutes per faculty. Exceeding this is always a HARD violation."
							value={local.maxTeachingMinutesPerDay}
							onChange={(v) => update('maxTeachingMinutesPerDay', v)}
							min={60}
							max={600}
						/>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<MetricExplain
									label="Earliest Start Time"
									explanation="The earliest timeslot any class may be scheduled."
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
									explanation="The latest time any class may end."
								/>
								<Input
									type="time"
									className="h-8 text-xs"
									value={local.latestEndTime}
									onChange={(e) => update('latestEndTime', e.target.value)}
								/>
							</div>
						</div>
						<PolicySwitch
							label="Enforce Consecutive Break as Hard"
							explanation="When ON, consecutive teaching limit and break violations become HARD constraints that block publish."
							checked={local.enforceConsecutiveBreakAsHard}
							onCheckedChange={(v) => update('enforceConsecutiveBreakAsHard', v)}
							warning
						/>
						{local.enforceConsecutiveBreakAsHard && (
							<div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[0.6875rem] text-amber-700">
								<AlertTriangle className="size-3 mt-0.5 shrink-0" />
								This will block schedule publishing if any faculty exceeds the break limit.
							</div>
						)}
					</SectionCard>

					{/* ── COL 2: Travel & Well-being ── */}
					<SectionCard title="Travel & Well-being">
						<PolicySwitch
							label="Enable Travel/Well-being Checks"
							explanation="Master toggle for all travel distance, building transition, idle gap, and preference soft constraints."
							checked={local.enableTravelWellbeingChecks}
							onCheckedChange={(v) => update('enableTravelWellbeingChecks', v)}
						/>

						{local.enableTravelWellbeingChecks ? (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className="space-y-3 pl-2 border-l-2 border-primary/20"
							>
								<PolicyNumberField
									label="Max Walking Distance/Transition (m)"
									explanation="Maximum Euclidean distance (meters) between buildings per single transition before a soft violation fires."
									value={local.maxWalkingDistanceMetersPerTransition}
									onChange={(v) => update('maxWalkingDistanceMetersPerTransition', v)}
									min={10}
									max={1000}
								/>
								<PolicyNumberField
									label="Max Building Transitions/Day"
									explanation="Maximum number of cross-building moves per faculty member per day."
									value={local.maxBuildingTransitionsPerDay}
									onChange={(v) => update('maxBuildingTransitionsPerDay', v)}
									min={1}
									max={20}
								/>
								<PolicyNumberField
									label="Max Back-to-Back Without Buffer"
									explanation="Maximum consecutive cross-building transitions with ≤5 min gap between classes."
									value={local.maxBackToBackTransitionsWithoutBuffer}
									onChange={(v) => update('maxBackToBackTransitionsWithoutBuffer', v)}
									min={1}
									max={10}
								/>
								<PolicyNumberField
									label="Max Idle Gap/Day (min)"
									explanation="Maximum total idle minutes between a faculty member's first and last class in a single day."
									value={local.maxIdleGapMinutesPerDay}
									onChange={(v) => update('maxIdleGapMinutesPerDay', v)}
									min={10}
									max={300}
								/>
								<PolicySwitch
									label="Avoid Early First Period"
									explanation="Generates a soft violation when faculty are scheduled in the first period (within 15 min of earliest start)."
									checked={local.avoidEarlyFirstPeriod}
									onCheckedChange={(v) => update('avoidEarlyFirstPeriod', v)}
								/>
								<PolicySwitch
									label="Avoid Late Last Period"
									explanation="Generates a soft violation when faculty are scheduled in the last period (within 15 min of latest end)."
									checked={local.avoidLateLastPeriod}
									onCheckedChange={(v) => update('avoidLateLastPeriod', v)}
								/>
							</motion.div>
						) : (
							<p className="text-[0.6875rem] text-muted-foreground/60 italic">
								Enable travel checks to configure thresholds.
							</p>
						)}
					</SectionCard>

					{/* ── COL 3: Per-Constraint Weights ── */}
					<SectionCard title="Per-Constraint Weights">
						<p className="text-[0.6875rem] text-muted-foreground">
							Toggle, weight (1–10), and optionally promote soft constraints to hard.
						</p>
						<div className="space-y-2">
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
					</SectionCard>

				</div>
			)}
		</div>
	);
}
