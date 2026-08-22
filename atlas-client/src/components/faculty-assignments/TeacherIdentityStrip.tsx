import { 
	Star, 
	AlertTriangle, 
	Info, 
	Layers, 
	Undo2, 
	Redo2, 
	Settings2, 
	RotateCcw, 
	Save 
} from 'lucide-react';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/ui/sheet';
import { departmentLabel } from '@/lib/deped-glossary';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { FacultySummary, LoadProfile, RotationFamilyTermBreakdown } from '@/types';
import { StackedWorkloadBar } from './StackedWorkloadBar';

type TeacherIdentityStripProps = {
	selected: FacultySummary;
	advisedSectionMeta: { gradeLevel: number; sectionName: string } | null;
	splitBrainQuarantineRequired: boolean;
	loadProfile: LoadProfile;
	rotationOvercountHours: number;
	rotationSheetOpen: boolean;
	onRotationSheetOpenChange: (open: boolean) => void;
	rotationTermBreakdown: RotationFamilyTermBreakdown[];
	hoveredIncomingMinutes: number;
	previewLoadHours: number;
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	dirty: boolean;
	saving: boolean;
	isReadOnlyMode: boolean;
	dataSource: string;
	onResetAssignments: () => void;
	onDiscardDraft: () => void;
	onSave: () => void;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
	'below-standard': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
	compliant: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
	'overload-allowed': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
	'over-cap': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

export function TeacherIdentityStrip({
	selected,
	advisedSectionMeta,
	splitBrainQuarantineRequired,
	loadProfile,
	rotationOvercountHours,
	rotationSheetOpen,
	onRotationSheetOpenChange,
	rotationTermBreakdown,
	hoveredIncomingMinutes,
	previewLoadHours,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	dirty,
	saving,
	isReadOnlyMode,
	dataSource,
	onResetAssignments,
	onDiscardDraft,
	onSave,
}: TeacherIdentityStripProps) {
	const workloadPercent = Math.round((loadProfile.creditedTotalHours / Math.max(selected.maxHoursPerWeek, 1)) * 100);

	return (
		<div className="shrink-0 flex items-center justify-between gap-4 p-1.5 px-3 bg-card border border-border/50 rounded-xl shadow-sm">
			<div className="flex items-center gap-3 flex-1 min-w-0">
				<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary border border-primary/10">
					{selected.firstName[0]}{selected.lastName[0]}
				</div>
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<p className="truncate text-sm font-bold leading-none uppercase tracking-tight">
							{selected.firstName} {selected.lastName}
						</p>
						{selected.isClassAdviser && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Star className="size-3.5 fill-amber-500 text-amber-600 cursor-help" />
								</TooltipTrigger>
								<TooltipContent className="text-xs font-bold">
									{advisedSectionMeta ? `Adviser: GR${advisedSectionMeta.gradeLevel} - ${advisedSectionMeta.sectionName}` : 'Class Adviser'}
								</TooltipContent>
							</Tooltip>
						)}
					</div>
					<p className="truncate text-[11px] text-muted-foreground font-bold mt-1 uppercase tracking-wider flex items-center gap-1.5 leading-none">
						<span className="text-foreground/70">{departmentLabel(selected.department)}</span>
					</p>
				</div>
			</div>

			<div className="flex items-center gap-3">
				{splitBrainQuarantineRequired ? (
					<div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-1.5 text-xs font-bold uppercase tracking-tight text-rose-800">
						<AlertTriangle className="size-3.5" />
						<span>Load details unavailable until review completes</span>
					</div>
				) : (
					<div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-muted/30 border border-border/40 shadow-inner">
						<div className="flex flex-col items-center">
							<span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mb-1">Credited Weekly Load</span>
							<div className="flex items-center gap-2">
								<span className="text-lg font-semibold tabular-nums leading-none text-foreground">{loadProfile.creditedTotalHours}h</span>
								{loadProfile.statusInstruction ? (
									<Tooltip>
										<TooltipTrigger asChild>
											<Badge className={`${STATUS_COLORS[loadProfile.status].bg} ${STATUS_COLORS[loadProfile.status].text} h-4 border-none text-xs font-bold uppercase px-1.5 shadow-none cursor-help`}>
												{loadProfile.statusLabel}
											</Badge>
										</TooltipTrigger>
										<TooltipContent side="bottom" className="max-w-xs p-3">
											<p className="text-xs font-medium">{loadProfile.statusInstruction}</p>
										</TooltipContent>
									</Tooltip>
								) : (
									<Badge className={`${STATUS_COLORS[loadProfile.status].bg} ${STATUS_COLORS[loadProfile.status].text} h-4 border-none text-xs font-bold uppercase px-1.5 shadow-none`}>
										{loadProfile.statusLabel}
									</Badge>
								)}
							</div>
						</div>

						<div className="h-8 w-px bg-border/40" />

						<div className="flex flex-col items-center">
							<span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mb-1">Concurrent Teaching</span>
							<div className="flex items-center gap-2">
								<span className="text-sm font-semibold tabular-nums leading-none text-foreground">{loadProfile.actualTeachingHours}h</span>
								<Tooltip>
									<TooltipTrigger asChild>
										<Info className="size-3 text-muted-foreground/40 cursor-help" />
									</TooltipTrigger>
									<TooltipContent className="text-xs font-bold max-w-50">
										Active time spent in the classroom during the busiest term.
									</TooltipContent>
								</Tooltip>
							</div>
						</div>

						{rotationOvercountHours > 0 && (
							<div className="h-8 w-px bg-border/40" />
						)}

						{rotationOvercountHours > 0 && (
							<Sheet open={rotationSheetOpen} onOpenChange={onRotationSheetOpenChange}>
								<SheetTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="flex flex-col items-center h-auto py-1 px-2 hover:bg-amber-100/50 border border-transparent hover:border-amber-200/50 rounded-lg transition-all group"
									>
										<span className="text-xs font-bold text-amber-700/60 uppercase tracking-widest leading-none mb-1 group-hover:text-amber-800">Rotation Adjustment</span>
										<div className="flex items-center gap-1">
											<span className="text-xs font-semibold text-amber-600 tabular-nums leading-none">-{rotationOvercountHours}h</span>
											<Layers className="size-3 text-amber-500/40 group-hover:text-amber-500" />
										</div>
									</Button>
								</SheetTrigger>
								<SheetContent side="right" className="w-112.5 sm:w-135 overflow-y-auto">
									<SheetHeader className="pb-6 border-b border-border/50">
										<SheetTitle className="text-xl font-bold flex items-center gap-2 text-sky-900">
											<Layers className="size-5" />
											Rotational Family Breakdown
										</SheetTitle>
										<SheetDescription className="text-sm font-medium text-sky-700/80">
											Science and TLE subjects share weekly classroom slots. 
											<span className="font-bold text-sky-900 block mt-1">Credited load = year-round classes + busiest (peak) term.</span>
										</SheetDescription>
									</SheetHeader>

									<div className="py-6 space-y-6">
										{rotationTermBreakdown.map((family) => (
											<div key={family.family} className="rounded-xl border border-sky-200/70 bg-sky-50/30 p-4 shadow-sm">
												<div className="flex items-center justify-between gap-2 border-b border-sky-100 pb-3 mb-4">
													<div className="flex flex-col gap-0.5 min-w-0">
														<span className="text-xs font-semibold uppercase tracking-widest text-sky-900/40 leading-none">Rotation Group</span>
														<span className="text-sm font-semibold uppercase tracking-tight text-sky-900 truncate">{family.family}</span>
													</div>
													<div className="flex flex-col items-end">
														<span className="text-lg font-semibold text-sky-900 tabular-nums leading-none">
															{(family.peakTermMinutesPerWeek / 60).toFixed(1)}h
														</span>
														<span className="text-xs font-bold text-sky-600/70 uppercase tracking-tighter">Peak Weekly Credit</span>
													</div>
												</div>
												
												<div className="grid gap-2 grid-cols-3">
													{[1, 2, 3].map((term) => {
														const bucket = family.termBuckets.find(b => b.termRank === term);
														const isPeak = bucket?.isPeakTerm ?? false;
														return (
															<div
																key={term}
																className={cn(
																	"rounded-lg border p-2.5 transition-all flex flex-col items-center gap-1",
																	isPeak 
																		? "border-sky-400 bg-white ring-1 ring-sky-400/20 shadow-sm" 
																		: "border-sky-100 bg-sky-50/50 opacity-60"
																)}
															>
																<span className={cn("text-xs font-semibold uppercase tracking-widest", isPeak ? "text-sky-900" : "text-sky-700/60")}>
																	Term {term}
																</span>
																<div className={cn("text-xs font-semibold tabular-nums leading-none", isPeak ? "text-sky-800" : "text-sky-700/60")}>
																	{bucket ? `${(bucket.creditedMinutesPerWeek / 60).toFixed(1)}h` : '0.0h'}
																</div>
																{isPeak && (
																	<Badge variant="outline" className="h-3.5 px-1 text-[10px] font-semibold uppercase border-sky-300 bg-sky-50 text-sky-700 shadow-none">
																		Peak
																	</Badge>
																)}
															</div>
														);
													})}
												</div>

												<div className="mt-4 flex flex-wrap gap-1.5">
													{family.termBuckets.find(b => b.isPeakTerm)?.subjectCodes.map(code => (
														<Badge key={code} variant="secondary" className="h-4 text-xs font-bold bg-sky-100/50 text-sky-800 border-sky-200/50">
															{code}
														</Badge>
													))}
												</div>

												<p className="mt-3 text-xs text-muted-foreground font-medium italic border-t border-sky-100 pt-2">
													{family.peakTermLabel || `Term ${family.peakTermRank}`} is the load-driving term for this group.
												</p>
											</div>
										))}

										<div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
											<h6 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
												<Info className="size-3" />
												Rotation Logic
											</h6>
											<p className="text-xs text-muted-foreground leading-relaxed">
												To prevent artificial load inflation, rotational subjects are grouped by "Family" (e.g., SCIENCE). 
												ATLAS identifies the term with the maximum concurrent minutes and counts only that "Peak" value toward the weekly load.
											</p>
										</div>
									</div>
								</SheetContent>
							</Sheet>
						)}

						<div className="h-8 w-px bg-border/40" />

						<div className="w-28 space-y-1">
							<StackedWorkloadBar
								teachingHours={loadProfile.actualTeachingHours}
								creditHours={loadProfile.equivalentHours}
								maxHours={selected.maxHoursPerWeek}
								compact
								showLegend={false}
							/>
							<div className="flex justify-center text-xs font-semibold uppercase tracking-tighter tabular-nums text-muted-foreground/80">
								<span>{workloadPercent}% of cap</span>
							</div>
						</div>

						<div className="h-8 w-px bg-border/40" />

						<div className="flex flex-col items-center">
							<span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mb-1">Remaining</span>
							<span className={cn('text-xs font-semibold tabular-nums leading-none', loadProfile.remainingHours < 0 ? 'text-rose-600' : 'text-emerald-700')}>
								{loadProfile.remainingHours.toFixed(1)}h
							</span>
						</div>

						{hoveredIncomingMinutes > 0 && (
							<>
								<div className="h-8 w-px bg-border/40" />
								<div className="flex flex-col items-center">
									<span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mb-1">Projected</span>
									<span className={cn('text-xs font-semibold tabular-nums leading-none', previewLoadHours > selected.maxHoursPerWeek ? 'text-rose-600' : 'text-primary')}>
										{previewLoadHours.toFixed(1)}h
									</span>
								</div>
							</>
						)}

						<Popover>
							<PopoverTrigger asChild>
								<Button variant="ghost" size="icon-xs" className="h-7 w-7 rounded-lg hover:bg-primary/5 text-primary ml-1 border border-primary/10">
									<Info className="size-4" />
								</Button>
							</PopoverTrigger>
							<PopoverContent side="bottom" align="end" className="w-96 p-0 overflow-hidden shadow-xl border-border/50">
								<div className="bg-primary p-4 text-white">
									<h5 className="text-xs font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Load Breakdown</h5>
									<div className="flex items-center gap-3">
										<div className="flex flex-col">
											<span className="text-2xl font-bold leading-none">{loadProfile.creditedTotalHours}h</span>
											<span className="text-xs font-medium opacity-70 uppercase tracking-wider">Credited Weekly Load</span>
										</div>
										<div className="h-8 w-px bg-white/20" />
										<div className="text-xs font-medium opacity-90 leading-tight">
											Teaching time and advisory or ancillary <br />
											credits both count toward the standard.
										</div>
									</div>
								</div>
								
								<div className="p-4 space-y-4 bg-card">
									<StackedWorkloadBar
										teachingHours={loadProfile.actualTeachingHours}
										creditHours={loadProfile.equivalentHours}
										maxHours={selected.maxHoursPerWeek}
									/>
									<div className="space-y-3">
										<h6 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Step-by-Step Arithmetic</h6>
										
										<div className="space-y-2">
											<div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30 border border-border/40">
												<div className="flex flex-col">
													<span className="font-bold">Total Weekly Rows</span>
													<span className="text-xs text-muted-foreground uppercase">Sum of all assigned classes</span>
												</div>
												<span className="font-mono font-bold">{(loadProfile?.rawTeachingHours ?? 0).toFixed(1)}h</span>
											</div>

											<div className="flex items-center justify-between text-xs p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-900">
												<div className="flex flex-col">
													<span className="font-bold">Rotation Adjustment</span>
													<span className="text-xs text-amber-700/70 uppercase tracking-tight font-semibold">Shared Science/TLE term lanes</span>
												</div>
												<span className="font-mono font-bold">-{(loadProfile?.rotationOvercountHours ?? 0).toFixed(1)}h</span>
											</div>

											<div className="flex items-center justify-between text-xs p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-900 italic">
												<div className="flex flex-col">
													<span className="font-bold">Active Weekly Teaching</span>
													<span className="text-xs text-blue-700/70 uppercase">Maximum concurrent classroom time</span>
												</div>
												<span className="font-mono font-bold">{((loadProfile?.rawTeachingHours ?? 0) - (loadProfile?.rotationOvercountHours ?? 0)).toFixed(1)}h</span>
											</div>

											<div className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-900">
												<div className="flex flex-col">
													<span className="font-bold">Advisory & Other Credits</span>
													<span className="text-xs text-emerald-700/70 uppercase">Non-teaching responsibilities</span>
												</div>
												<span className="font-mono font-bold">+{(loadProfile?.equivalentHours ?? 0).toFixed(1)}h</span>
											</div>

											<div className="flex items-center justify-between text-sm p-3 rounded-lg bg-primary/5 border border-primary/20 text-primary">
												<span className="font-bold uppercase tracking-tight">Credited Weekly Load</span>
												<span className="font-mono font-semibold">{(loadProfile?.creditedTotalHours ?? 0).toFixed(1)}h</span>
											</div>
										</div>
									</div>

									<div className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-dashed border-border/60">
										<p className="font-bold text-foreground/70 mb-1">How rotation works:</p>
										<p>Rotational subjects share the same weekly slot across different terms. Only the busiest term (Peak) is counted toward the total weekly load.</p>
									</div>

									{rotationTermBreakdown.length > 0 && (
										<div className="border-t border-border/40 pt-4 flex flex-col gap-3">
											<div className="flex items-center justify-between">
												<h6 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rotational Groups</h6>
												<Button
													variant="link"
													size="xs"
													className="h-auto p-0 text-xs font-bold text-sky-700 hover:text-sky-900"
													onClick={() => {
														onRotationSheetOpenChange(true);
													}}
												>
													View Detailed Breakdown
												</Button>
											</div>
											<div className="flex flex-wrap gap-2">
												{rotationTermBreakdown.map(f => (
													<Badge key={f.family} variant="secondary" className="h-5 text-xs font-bold bg-sky-50 text-sky-700 border-sky-100">
												{f.family}: {f.peakTermLabel || (f.peakTermRank != null ? `T${f.peakTermRank}` : 'Peak term')}
													</Badge>
												))}
											</div>
										</div>
									)}
								</div>
							</PopoverContent>
						</Popover>
					</div>
				)}

				<div className="flex items-center gap-2 border-l border-border/50 pl-3">
					<div className="flex items-center bg-background rounded-lg border border-border/60 p-0.5 shadow-inner">
						<Button type="button" variant="ghost" size="icon-xs" onClick={onUndo} disabled={!canUndo || saving || isReadOnlyMode} className="h-6 w-7">
							<Undo2 className="size-3" />
						</Button>
						<Button type="button" variant="ghost" size="icon-xs" onClick={onRedo} disabled={!canRedo || saving || isReadOnlyMode} className="h-6 w-7">
							<Redo2 className="size-3" />
						</Button>
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant={dirty ? 'secondary' : 'outline'} size="xs" className="h-7 font-bold text-xs gap-1.5 shadow-sm uppercase px-2">
								<Settings2 className="size-3" />
								{dirty ? 'Draft' : 'Tools'}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-52">
							<DropdownMenuItem onSelect={onResetAssignments} disabled={saving || !selected.isActiveForScheduling || isReadOnlyMode || dataSource !== 'live'} className="gap-2 cursor-pointer font-bold uppercase text-xs">
								<RotateCcw className="size-3" />
								Reset Teacher Draft
							</DropdownMenuItem>
							{dirty && (
								<DropdownMenuItem onSelect={onDiscardDraft} disabled={saving || isReadOnlyMode} className="gap-2 cursor-pointer text-amber-600 font-bold uppercase text-xs">
									<RotateCcw className="size-3" />
									Discard Changes
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>

					<Button type="button" size="xs" onClick={onSave} disabled={!dirty || saving || !selected.isActiveForScheduling || isReadOnlyMode} className="h-7 font-bold text-xs gap-1.5 shadow-md shadow-primary/10 uppercase px-2">
						<Save className="size-3" />
						{saving ? 'Saving...' : 'Save Draft'}
					</Button>
				</div>
			</div>
		</div>
	);
}
