import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Switch } from '@/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Slider } from '@/ui/slider';
import { ScrollArea } from '@/ui/scroll-area';
import type { ConstraintOverride, ViolationCode } from '@/types';

export const DEFAULT_CONSTRAINT_CONFIG: Record<string, ConstraintOverride> = {
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: { enabled: true, weight: 5, treatAsHard: false },
	FACULTY_BREAK_REQUIREMENT_VIOLATED: { enabled: true, weight: 5, treatAsHard: false },
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: { enabled: true, weight: 4, treatAsHard: false },
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: { enabled: true, weight: 4, treatAsHard: false },
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: { enabled: true, weight: 3, treatAsHard: false },
	FACULTY_EXCESSIVE_IDLE_GAP: { enabled: true, weight: 3, treatAsHard: false },
	FACULTY_EARLY_START_PREFERENCE: { enabled: false, weight: 2, treatAsHard: false },
	FACULTY_LATE_END_PREFERENCE: { enabled: false, weight: 2, treatAsHard: false },
	FACULTY_INSUFFICIENT_DAILY_VACANT: { enabled: false, weight: 3, treatAsHard: false },
	SECTION_OVERCOMPRESSED: { enabled: false, weight: 3, treatAsHard: false },
	SESSION_PATTERN_VIOLATED: { enabled: true, weight: 3, treatAsHard: false },
	ROOM_CAPACITY_EXCEEDED: { enabled: true, weight: 5, treatAsHard: true },
};

export const SOFT_CONSTRAINT_LABELS: Record<string, { label: string; explanation: string }> = {
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
	FACULTY_INSUFFICIENT_DAILY_VACANT: {
		label: 'Insufficient Daily Vacant Time',
		explanation: 'Penalizes when a faculty member has too little vacant time between their first and last class in a day.',
	},
	SECTION_OVERCOMPRESSED: {
		label: 'Section Overcompressed',
		explanation: 'Penalizes when a section has too many consecutive classes without vacant periods or exceeds compressed teaching limits.',
	},
	SESSION_PATTERN_VIOLATED: {
		label: 'Session Pattern Preference',
		explanation: 'Penalizes when a subject is scheduled on a day that violates its preferred MWF or TTH session pattern.',
	},
	ROOM_CAPACITY_EXCEEDED: {
		label: 'Room Capacity Exceeded',
		explanation: 'Flags when a section with more enrolled students than a room can hold is placed in that room.',
	},
};

export function MetricExplain({ label, explanation }: { label: string; explanation: ReactNode }) {
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
				<TooltipContent className="max-w-65 text-xs font-normal leading-relaxed" side="bottom">
					{explanation}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function PolicyNumberField({
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

export function PolicySwitch({
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

export function ConstraintRow({
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

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="flex flex-col min-h-0 h-full rounded-lg border border-border bg-card overflow-hidden">
			<div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/60 bg-card">
				<h3 className="text-[0.6875rem] font-semibold text-foreground uppercase tracking-wider">
					{title}
				</h3>
			</div>
			<ScrollArea className="flex-1 min-h-0">
				<div className="px-4 py-3 space-y-3">
					{children}
				</div>
			</ScrollArea>
		</div>
	);
}
