import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import type { LocalGradeWindow } from './SchedulingPolicyDialogs';
import type { ProgramWindowOption } from './SchedulingPolicyDialogs';

type WindowGroup = {
	key: string;
	gradeLevel: number;
	programType: LocalGradeWindow['programType'];
	indices: number[];
};

export function ShiftSettingsEditor({
	shiftWindows,
	onAddOverride,
	onApplyFullDayPreset,
	onApplyHalfDayPreset,
	onRemove,
	onUpdate,
	gradeLevels,
	programOptions,
	programContextNote,
}: {
	shiftWindows: LocalGradeWindow[];
	onAddOverride: () => void;
	onApplyFullDayPreset: () => void;
	onApplyHalfDayPreset: () => void;
	onRemove: (index: number) => void;
	onUpdate: (index: number, field: 'gradeLevel' | 'programType' | 'startTime' | 'endTime', value: string | number | null) => void;
	gradeLevels: number[];
	programOptions: ProgramWindowOption[];
	programContextNote: string;
}) {
	const groups = new Map<string, WindowGroup>();
	shiftWindows.forEach((window, index) => {
		const key = `${window.gradeLevel}:${window.programType ?? 'ALL'}`;
		const existing = groups.get(key);
		if (existing) existing.indices.push(index);
		else groups.set(key, { key, gradeLevel: window.gradeLevel, programType: window.programType ?? null, indices: [index] });
	});

	return (
		<div className="flex-1 min-h-0 overflow-hidden p-4">
			<div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-background">
				<div className="shrink-0 border-b border-border px-4 py-3">
					<h3 className="text-sm font-semibold leading-none">Morning and afternoon schedules</h3>
				</div>
				<div className="flex-1 min-h-0 overflow-auto">
					<div className="px-4 py-3 space-y-3">
						<div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
							Grades 7–8 use the Morning schedule; Grades 9–10 use the Afternoon schedule. These times guide when each class can be placed.
						</div>
						<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{programContextNote}</div>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs text-muted-foreground">Changes are not saved automatically. Open a grade schedule to review its times.</p>
							<div className="flex flex-wrap items-center gap-2">
								<Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onApplyFullDayPreset}>Use full-day schedule</Button>
								<Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onApplyHalfDayPreset}>Use morning and afternoon schedules</Button>
								<Button type="button" variant="default" size="sm" className="h-8 text-xs" onClick={onAddOverride}>Add schedule window</Button>
							</div>
						</div>
						{shiftWindows.length === 0 ? (
							<p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No grade schedule windows are set up yet.</p>
						) : (
							<Accordion type="single" collapsible className="space-y-2" data-testid="shift-schedule-groups">
								{[...groups.values()].map((group) => {
									const scheduleLabel = group.gradeLevel <= 8 ? 'Morning schedule' : group.gradeLevel <= 10 ? 'Afternoon schedule' : 'School-day schedule';
									const programLabel = programOptions.find((option) => option.value === (group.programType ?? 'ALL'))?.label ?? 'All Programs';
									return (
										<AccordionItem key={group.key} value={group.key} className="rounded-md border border-border px-3">
											<AccordionTrigger className="min-h-12 no-underline hover:no-underline">
												<span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1 pr-2">
													<span className="font-semibold">Grade {group.gradeLevel} · {scheduleLabel}</span>
													<span className="text-muted-foreground">{programLabel} · {group.indices.length} {group.indices.length === 1 ? 'time window' : 'time windows'}</span>
													</span>
											</AccordionTrigger>
											<AccordionContent className="space-y-2 pt-1">
												{group.indices.map((index) => {
													const window = shiftWindows[index];
													if (!window) return null;
													return (
														<div key={`${window.gradeLevel}:${window.programType ?? 'ALL'}:${index}`} className="rounded-md border border-border/70 bg-background p-3 space-y-3">
														<div className="flex items-center justify-between gap-2">
															<div className="text-xs font-medium text-foreground">{programLabel} time window</div>
															<Button type="button" variant="ghost" size="sm" className="min-h-8 px-2 text-xs text-muted-foreground" onClick={() => onRemove(index)}>Remove window</Button>
														</div>
														<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
															<div className="space-y-1.5">
																<Label className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Grade</Label>
																<Select value={String(window.gradeLevel)} onValueChange={(value) => onUpdate(index, 'gradeLevel', Number(value))}>
																	<SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Grade" /></SelectTrigger>
																	<SelectContent>{gradeLevels.map((grade) => <SelectItem key={grade} value={String(grade)}>Grade {grade}</SelectItem>)}</SelectContent>
																</Select>
															</div>
															<div className="space-y-1.5">
																<Label className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Program</Label>
																<Select value={window.programType ?? 'ALL'} onValueChange={(value) => onUpdate(index, 'programType', value === 'ALL' ? null : value)}>
																	<SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Programs" /></SelectTrigger>
																	<SelectContent>{programOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
																</Select>
															</div>
														</div>
														<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
															<div className="space-y-1.5"><Label className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Start time</Label><Input type="time" className="h-9 text-xs" value={window.startTime} onChange={(event) => onUpdate(index, 'startTime', event.target.value)} /></div>
															<div className="space-y-1.5"><Label className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">End time</Label><Input type="time" className="h-9 text-xs" value={window.endTime} onChange={(event) => onUpdate(index, 'endTime', event.target.value)} /></div>
														</div>
													</div>
													);
												})}
											</AccordionContent>
										</AccordionItem>
									);
								})}
							</Accordion>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
