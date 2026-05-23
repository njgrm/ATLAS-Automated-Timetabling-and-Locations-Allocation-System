import { useState } from 'react';
import { AlertTriangle, BadgeCheck, Building2, ChevronDown, ChevronRight, Users2, ChartColumn, Info, Zap } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Separator } from '@/ui/separator';
import { cn } from '@/lib/utils';

export type StaffingCrossTrainee = {
	department: string;
	availableTeachers: number;
	totalSpareHours: number;
};

export type StaffingReport = {
	department: string;
	dominantShortageDepartment?: string;
	unassignedSections: number;
	missingHoursPerWeek: number;
	concurrentUnassignedSections?: number;
	concurrentMissingHoursPerWeek?: number;
	recoverableConcurrentRows?: number;
	recoverableConcurrentMissingHoursPerWeek?: number;
	recoverableConcurrentMissingMinutesPerWeek?: number;
	constrainedConcurrentRows?: number;
	constrainedConcurrentMissingHoursPerWeek?: number;
	constrainedConcurrentMissingMinutesPerWeek?: number;
	recommendedNewHires: number;
	internalCrossTrainees: StaffingCrossTrainee[];
	missingMinutesPerWeek: number;
	concurrentMissingMinutesPerWeek?: number;
	rotationAdjustedMinutesPerWeek?: number;
	shortages: Array<{
		department: string;
		count: number;
		missingMinutesPerWeek: number;
		concurrentCount?: number;
		concurrentMissingMinutesPerWeek?: number;
		recoverableConcurrentCount?: number;
		recoverableConcurrentMissingMinutesPerWeek?: number;
		constrainedConcurrentCount?: number;
		constrainedConcurrentMissingMinutesPerWeek?: number;
		rotationAdjustedMinutesPerWeek?: number;
		sections: Array<{
			subjectId: number;
			subjectCode: string;
			subjectName: string;
			sectionId: number;
			sectionName: string;
			programType: string;
		}>;
	}>;
};

export type AutoFillSummaryResult = {
	preserved: number;
	created: number;
	assignmentsCreated: number;
	uniqueTeachersAffected: number;
	unresolved: number;
	warnings: string[];
	staffingReport: StaffingReport;
};

type AutoFillSummaryModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	result: AutoFillSummaryResult | null;
};

function formatHires(value: number): string {
	return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function AutoFillSummaryModal({ open, onOpenChange, result }: AutoFillSummaryModalProps) {
	const [expandedDepartments, setExpandedDepartments] = useState<Record<string, boolean>>({});
	const report = result?.staffingReport ?? null;
	const hasShortage = Boolean(report && report.unassignedSections > 0);
	const hasResult = Boolean(result);
	const rawHours = report?.missingHoursPerWeek ?? 0;
	const concurrentHours = report?.concurrentMissingHoursPerWeek ?? rawHours;
	const concurrentRows = report?.concurrentUnassignedSections ?? report?.unassignedSections ?? 0;
	const recoverableHours = report?.recoverableConcurrentMissingHoursPerWeek ?? 0;
	const constrainedHours = report?.constrainedConcurrentMissingHoursPerWeek ?? Math.max(0, concurrentHours - recoverableHours);
	const dominantDepartment = report?.dominantShortageDepartment ?? report?.department ?? 'GENERAL';
	const overlapHours = Math.round(((report?.rotationAdjustedMinutesPerWeek ?? 0) / 60) * 10) / 10;

	const title = hasShortage ? 'Coverage Incomplete: Review Next Staffing Actions' : 'Schedule Fully Assigned!';
	const description = hasShortage
		? `Some subject rows are still uncovered across multiple departments. Dominant concurrent shortage bucket: ${dominantDepartment}.`
		: 'All classes have been successfully assigned to a teacher. No one has exceeded their maximum allowed teaching hours.';

	const toggleDepartment = (department: string) => {
		setExpandedDepartments((current) => ({
			...current,
			[department]: !current[department],
		}));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[calc(100%-1rem)] max-w-4xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl sm:w-[calc(100%-2rem)]">
				<div className="flex flex-col h-[85svh]">
					<DialogHeader className="p-8 pb-10 bg-primary text-primary-foreground shrink-0 relative overflow-hidden">
						{/* Background decorative elements */}
						<div className="absolute top-0 right-0 p-4 opacity-10">
							<Building2 className="size-48 -mr-12 -mt-12" />
						</div>
						
						<div className="relative z-10 flex flex-col items-start gap-4">
							<div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md border border-white/20">
								{hasShortage ? <AlertTriangle className="size-7" /> : <BadgeCheck className="size-7" />}
							</div>
							<div className="space-y-1.5">
								<DialogTitle className="text-3xl font-bold tracking-tight">
									{title}
								</DialogTitle>
								<DialogDescription className="text-primary-foreground/80 max-w-2xl text-base leading-relaxed">
									{description}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<div className="flex-1 overflow-auto bg-muted/30 p-8">
						{hasShortage && report ? (
							<div className="space-y-8 max-w-3xl mx-auto">
								{/* Dual Truth Headline */}
								<div className="grid gap-4 sm:grid-cols-2">
									<Card className="p-6 border-none shadow-sm flex flex-col gap-1.5 relative overflow-hidden group hover:shadow-md transition-shadow">
										<div className="absolute top-3 right-3 text-emerald-500 opacity-10 group-hover:opacity-20 transition-opacity">
											<BadgeCheck className="size-10" />
										</div>
										<p className="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-[0.15em]">Contract Completeness</p>
										<p className="text-3xl font-bold tracking-tight">{report.unassignedSections} <span className="text-sm font-normal text-muted-foreground">Rows</span></p>
										<p className="text-[0.8rem] font-medium text-foreground/70 mt-1 leading-snug">Raw subject-section pairs currently lacking an assigned teacher.</p>
										<div className="mt-4 flex items-center gap-2">
											<Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 shadow-none font-bold uppercase text-[0.6rem] tracking-wider px-2">Action Required</Badge>
										</div>
									</Card>

									<Card className="p-6 border-none shadow-sm flex flex-col gap-1.5 relative overflow-hidden group hover:shadow-md transition-shadow">
										<div className="absolute top-3 right-3 text-red-500 opacity-10 group-hover:opacity-20 transition-opacity">
											<Users2 className="size-10" />
										</div>
										<p className="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-[0.15em]">Weekly Capacity Gap</p>
										<p className="text-3xl font-bold tracking-tight text-red-600">{concurrentHours} <span className="text-sm font-normal text-muted-foreground">Hours</span></p>
										<p className="text-[0.8rem] font-medium text-foreground/70 mt-1 leading-snug">The true concurrent workload shortage after rotation-overlap is removed.</p>
										<div className="mt-4 flex items-center gap-2">
											<Badge className="bg-red-50 text-red-700 border-red-100 shadow-none font-bold uppercase text-[0.6rem] tracking-wider px-2">Hiring Target</Badge>
										</div>
									</Card>
								</div>

								{/* Math Context Panel */}
								<div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6 space-y-4">
									<div className="flex items-center gap-2 text-blue-900">
										<Info className="size-4 opacity-70" />
										<h4 className="text-sm font-bold uppercase tracking-wider">Staffing Truth Model</h4>
									</div>
									<div className="grid gap-6 md:grid-cols-2 text-xs leading-relaxed text-blue-900/80">
										<p>
											<strong>Raw Uncovered Rows</strong> track every class that needs a teacher. Schedulers must resolve all {report.unassignedSections} rows to complete the schedule.
										</p>
										<p>
											<strong>Concurrent Shortage</strong> is the hiring target. Since rotating subjects share one time-slot, you only need staff for the <strong>{concurrentHours} concurrent hours</strong> per week.
										</p>
									</div>
									{overlapHours > 0 && (
										<div className="pt-3 border-t border-blue-200/40 flex items-center gap-2">
											<Badge variant="outline" className="bg-white/80 border-blue-200 text-blue-700 font-bold text-[0.65rem] shadow-none uppercase">
												Adjustment Found
											</Badge>
											<span className="text-[0.7rem] font-bold text-blue-800">Rotation overlap reduced hire-needs by -{overlapHours}h/wk.</span>
										</div>
									)}
								</div>

								{/* Detailed Drill-Down */}
								<div className="space-y-4">
									<div className="flex items-center justify-between px-1">
										<h4 className="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-[0.2em]">Detailed Shortage Drill-Down</h4>
										<span className="text-[0.65rem] text-muted-foreground font-bold uppercase">{report.shortages.length} Subjects Affected</span>
									</div>
									
									<div className="space-y-2.5">
										{(report.shortages ?? []).map((shortage) => {
											const isOpen = expandedDepartments[shortage.department] ?? false;
											const deptConcurrentHours = Math.round((((shortage.concurrentMissingMinutesPerWeek ?? shortage.missingMinutesPerWeek) / 60) * 10)) / 10;
											const deptRawHours = Math.round((shortage.missingMinutesPerWeek / 60) * 10) / 10;
											
											return (
												<div key={shortage.department} className="rounded-2xl border border-border/60 bg-background overflow-hidden transition-all duration-200 hover:border-border">
													<Button
														type="button"
														variant="ghost"
														onClick={() => toggleDepartment(shortage.department)}
														className={`h-auto w-full justify-between px-5 py-4 hover:bg-muted/30 transition-colors ${isOpen ? 'bg-muted/20 border-b' : ''}`}
													>
														<div className="flex items-center gap-3">
															<div className={`p-1 rounded-md transition-colors ${isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
																{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
															</div>
															<span className="text-sm font-bold text-foreground">
																{shortage.department}
															</span>
														</div>
														<div className="flex items-center gap-3">
															<div className="hidden sm:flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground mr-2">
																<span className="flex items-center gap-1.5"><span className="text-foreground">{shortage.count}</span> Rows</span>
																<span className="opacity-40">|</span>
																<span className="flex items-center gap-1.5"><span className="text-red-700">{deptConcurrentHours}h</span> Shortage</span>
															</div>
															<Badge className={deptConcurrentHours > 0 ? 'bg-red-50 text-red-700 border-red-100 shadow-none font-bold' : 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-none font-bold'}>
																{deptConcurrentHours > 0 ? `${deptConcurrentHours}h Gap` : 'Covered'}
															</Badge>
														</div>
													</Button>
													{isOpen && (
														<div className="p-4 bg-muted/10">
															<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
																{shortage.sections.map((item, idx) => (
																	<div
																		key={idx}
																		className="group p-3 rounded-xl border border-border/40 bg-background shadow-sm hover:border-primary/30 transition-all duration-200"
																	>
																		<div className="flex items-start justify-between gap-2 mb-1.5">
																			<p className="font-bold text-foreground text-xs truncate leading-tight">{item.subjectCode}</p>
																			<Badge variant="outline" className="h-4 px-1 text-[0.55rem] font-bold uppercase opacity-60">G{item.sectionName.match(/\d+/)?.[0] || '?'}</Badge>
																		</div>
																		<p className="text-[0.65rem] text-muted-foreground truncate font-medium">{item.sectionName}</p>
																		<p className="text-[0.6rem] text-muted-foreground/60 uppercase tracking-tighter mt-1">{item.programType}</p>
																	</div>
																))}
															</div>
														</div>
													)}
												</div>
											);
										})}
									</div>
								</div>

								{/* Actionable Strategy Recommendations */}
								<div className="grid gap-4 md:grid-cols-2 pt-4">
									<div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 space-y-2">
										<p className="text-[0.65rem] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-2">
											<Users2 className="size-3.5" /> Strategy: Internal Balance
										</p>
										<p className="text-xs text-amber-900/70 leading-relaxed font-medium">
											{report.internalCrossTrainees.length > 0 
												? `Qualified cross-department support can recover about ${recoverableHours}h/wk (${report.recoverableConcurrentRows ?? 0} concurrent rows), led by ${report.internalCrossTrainees.slice(0, 2).map(d => d.department).join(', ')}.`
												: 'No qualified cross-department recovery candidates were found under current ownership rules.'}
										</p>
									</div>
									<div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 space-y-2">
										<p className="text-[0.65rem] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
											<AlertTriangle className="size-3.5" /> Strategy: Hiring Request
										</p>
										<p className="text-xs text-primary/70 leading-relaxed font-medium">
											Target <span className="font-bold text-primary">~{formatHires(report.recommendedNewHires)} full-time hires</span> to cover the remaining <span className="font-bold text-primary">{constrainedHours}h/wk</span> that is not recoverable with currently qualified active teachers.
										</p>
									</div>
								</div>
							</div>
						) : hasResult && result && !hasShortage ? (
							<div className="flex flex-col items-center justify-center py-16 text-center space-y-6 max-w-sm mx-auto">
								<div className="size-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
									<BadgeCheck className="size-12" />
								</div>
								<div className="space-y-2">
									<h3 className="text-2xl font-bold text-foreground">Complete Coverage</h3>
									<p className="text-muted-foreground text-sm leading-relaxed">
										Every class has been assigned an eligible teacher, and everyone is within their workload capacity.
									</p>
								</div>
								<div className="grid grid-cols-2 w-full gap-4 pt-4 border-t border-border/50">
									<div className="space-y-1">
										<p className="text-2xl font-bold">{result.assignmentsCreated}</p>
										<p className="text-[0.6rem] font-bold text-muted-foreground uppercase tracking-widest">New Placements</p>
									</div>
									<div className="space-y-1 border-l border-border/50">
										<p className="text-2xl font-bold">{result.uniqueTeachersAffected}</p>
										<p className="text-[0.6rem] font-bold text-muted-foreground uppercase tracking-widest">Teachers Updated</p>
									</div>
								</div>
							</div>
						) : (
							<div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
								<p className="animate-pulse font-medium">Analyzing staffing demand...</p>
							</div>
						)}
					</div>

					<DialogFooter className="p-8 bg-background border-t shrink-0 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Badge variant="outline" className="bg-muted text-muted-foreground font-bold uppercase tracking-widest text-[0.6rem] h-5 px-1.5 shadow-none border-border/60">
								Audit-Mode
							</Badge>
							<span className="text-[0.65rem] text-muted-foreground font-medium uppercase tracking-tight">Read-only simulation</span>
						</div>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-11 rounded-2xl px-10 font-bold border-border hover:bg-muted/50 transition-colors shadow-sm">
							Close Staffing Audit
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
}
