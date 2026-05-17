import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import type { LocalGradeWindow } from './SchedulingPolicyDialogs';
import type { ProgramWindowOption } from './SchedulingPolicyDialogs';

export function ShiftSettingsEditor({
	shiftWindows,
	onAddOverride,
	onRemove,
	onUpdate,
	gradeLevels,
	programOptions,
	programContextNote,
}: {
	shiftWindows: LocalGradeWindow[];
	onAddOverride: () => void;
	onRemove: (index: number) => void;
	onUpdate: (index: number, field: 'gradeLevel' | 'programType' | 'startTime' | 'endTime', value: string | number | null) => void;
	gradeLevels: number[];
	programOptions: ProgramWindowOption[];
	programContextNote: string;
}) {
	return (
		<div className="flex-1 min-h-0 overflow-hidden p-4">
			<div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-background">
				<div className="shrink-0 border-b border-border px-4 py-3">
					<h3 className="text-sm font-semibold leading-none">Shift Settings</h3>
				</div>
				<div className="flex-1 min-h-0 overflow-auto">
					<div className="px-4 py-3 space-y-3">
						<div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
							Adjust these windows to control the allowable scheduling boundaries for each grade or program override.
						</div>
						<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
							{programContextNote}
						</div>
						<div className="flex items-center justify-between gap-2">
							<p className="text-[0.6875rem] text-muted-foreground">Base windows are applied when no program override exists.</p>
							<Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAddOverride}>
								Add Override
							</Button>
						</div>
						<div className="space-y-2">
							{shiftWindows.map((window, index) => (
								<div key={`${window.gradeLevel}:${window.programType ?? 'ALL'}:${index}`} className="rounded-md border border-border p-3 space-y-3">
									<div className="flex items-center gap-2 justify-between">
										<div className="text-xs font-medium text-foreground">Override #{index + 1}</div>
										<Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => onRemove(index)}>
											Remove
										</Button>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div className="space-y-1.5">
											<Label className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Grade</Label>
											<Select value={String(window.gradeLevel)} onValueChange={(value) => onUpdate(index, 'gradeLevel', Number(value))}>
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
											<Select value={window.programType ?? 'ALL'} onValueChange={(value) => onUpdate(index, 'programType', value === 'ALL' ? null : value)}>
												<SelectTrigger className="h-8 text-xs">
													<SelectValue placeholder="All Programs" />
												</SelectTrigger>
												<SelectContent>
													{programOptions.map((option) => (
														<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div className="space-y-1.5">
											<Label className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Start Time</Label>
											<Input
												type="time"
												className="h-8 text-xs"
												value={window.startTime}
												onChange={(event) => onUpdate(index, 'startTime', event.target.value)}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">End Time</Label>
											<Input
												type="time"
												className="h-8 text-xs"
												value={window.endTime}
												onChange={(event) => onUpdate(index, 'endTime', event.target.value)}
											/>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
