import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

export type LocalGradeWindow = {
	gradeLevel: number;
	programType?: 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER' | null;
	startTime: string;
	endTime: string;
};

export type EditIntent = 'policy' | 'window' | null;

export type ReconciliationDialogState = {
	title: string;
	description: string;
	details: string[];
	primaryLabel: string;
	onPrimary: () => void;
	secondaryLabel?: string;
	onSecondary?: () => void;
};

const PROGRAM_WINDOW_OPTIONS: Array<{ value: 'ALL' | 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER'; label: string }> = [
	{ value: 'ALL', label: 'All Programs' },
	{ value: 'REGULAR', label: 'Regular' },
	{ value: 'STE', label: 'STE' },
	{ value: 'SPS', label: 'SPS' },
	{ value: 'SPA', label: 'SPA' },
	{ value: 'SPJ', label: 'SPJ' },
	{ value: 'SPFL', label: 'SPFL' },
	{ value: 'SPTVE', label: 'SPTVE' },
	{ value: 'OTHER', label: 'Other' },
];

export function toMinutes(value: string): number {
	const [hours, minutes] = value.split(':').map(Number);
	return (hours * 60) + minutes;
}

export function normalizeProgramForKey(programType?: LocalGradeWindow['programType']): string {
	return (programType ?? 'ALL').toUpperCase();
}

export function sortShiftWindows(windows: LocalGradeWindow[]): LocalGradeWindow[] {
	return [...windows].sort((left, right) => {
		if (left.gradeLevel !== right.gradeLevel) return left.gradeLevel - right.gradeLevel;
		return normalizeProgramForKey(left.programType).localeCompare(normalizeProgramForKey(right.programType));
	});
}

export function clipWindowsToPolicyBounds(
	windows: LocalGradeWindow[],
	policyStart: string,
	policyEnd: string,
): {
	windows: LocalGradeWindow[];
	clipped: Array<{ before: LocalGradeWindow; after: LocalGradeWindow }>;
	removed: LocalGradeWindow[];
} {
	const startMin = toMinutes(policyStart);
	const endMin = toMinutes(policyEnd);
	const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
	const clipped: Array<{ before: LocalGradeWindow; after: LocalGradeWindow }> = [];
	const removed: LocalGradeWindow[] = [];
	const nextWindows: LocalGradeWindow[] = [];

	for (const window of windows) {
		const windowStart = toMinutes(window.startTime);
		const windowEnd = toMinutes(window.endTime);
		const adjustedStart = Math.max(windowStart, startMin);
		const adjustedEnd = Math.min(windowEnd, endMin);
		if (adjustedStart >= adjustedEnd) {
			removed.push(window);
			continue;
		}

		const adjusted: LocalGradeWindow = {
			...window,
			startTime: hhmm(adjustedStart),
			endTime: hhmm(adjustedEnd),
		};

		if (adjusted.startTime !== window.startTime || adjusted.endTime !== window.endTime) {
			clipped.push({ before: window, after: adjusted });
		}

		nextWindows.push(adjusted);
	}

	return {
		windows: sortShiftWindows(nextWindows),
		clipped,
		removed,
	};
}

export function AddOverrideDialog({
	open,
	onOpenChange,
	newOverride,
	onChange,
	onConfirm,
	gradeLevels,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	newOverride: LocalGradeWindow;
	onChange: (value: LocalGradeWindow) => void;
	onConfirm: () => void;
	gradeLevels: number[];
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add Grade/Program Override</DialogTitle>
					<DialogDescription>
						Choose a grade, program scope, and time window before adding the override.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Grade</Label>
							<Select value={String(newOverride.gradeLevel)} onValueChange={(value) => onChange({ ...newOverride, gradeLevel: Number(value) })}>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue placeholder="Select Grade" />
								</SelectTrigger>
								<SelectContent>
									{gradeLevels.map((grade) => (
										<SelectItem key={grade} value={String(grade)}>Grade {grade}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Program</Label>
							<Select value={newOverride.programType ?? 'ALL'} onValueChange={(value) => onChange({ ...newOverride, programType: value === 'ALL' ? null : value as LocalGradeWindow['programType'] })}>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue placeholder="All Programs" />
								</SelectTrigger>
								<SelectContent>
									{PROGRAM_WINDOW_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Start Time</Label>
							<Input type="time" className="h-8 text-xs" value={newOverride.startTime} onChange={(event) => onChange({ ...newOverride, startTime: event.target.value })} />
						</div>
						<div className="space-y-1.5">
							<Label className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">End Time</Label>
							<Input type="time" className="h-8 text-xs" value={newOverride.endTime} onChange={(event) => onChange({ ...newOverride, endTime: event.target.value })} />
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button onClick={onConfirm}>Add Override</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function ReconciliationDialog({
	state,
	onClose,
}: {
	state: ReconciliationDialogState | null;
	onClose: () => void;
}) {
	return (
		<Dialog open={Boolean(state)} onOpenChange={(open) => { if (!open) onClose(); }}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{state?.title}</DialogTitle>
					<DialogDescription>{state?.description}</DialogDescription>
				</DialogHeader>
				<div className="space-y-2 text-sm text-muted-foreground">
					{state?.details.map((detail) => (
						<div key={detail} className="rounded border border-border/60 bg-muted/30 px-2.5 py-1.5">{detail}</div>
					))}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>Review Manually</Button>
					{state?.onSecondary && state.secondaryLabel && (
						<Button variant="secondary" onClick={state.onSecondary}>{state.secondaryLabel}</Button>
					)}
					<Button onClick={state?.onPrimary}>{state?.primaryLabel}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
