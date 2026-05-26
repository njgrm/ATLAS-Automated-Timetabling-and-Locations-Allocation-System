import { useState } from 'react';
import { AlertTriangle, BadgeCheck, Building2, ChevronDown, ChevronRight, Users2, Info, Zap } from 'lucide-react';
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

export type StaffingCrossTrainee = {
	department: string;
	availableTeachers: number;
	totalSpareHours: number;
	qualifiedRecoveryHoursPerWeek?: number;
};

export type CoverageMode =
	| 'REAL_FACULTY_STANDARD'
	| 'REAL_FACULTY_HARD_CAP'
	| 'REAL_FACULTY_THEN_TEACHER_X';

export type StaffingTruthBucket = {
	shortageRows: number;
	shortageConcurrentHoursPerWeek: number;
	shortageConcurrentMinutesPerWeek: number;
	rowsClosedByRealFaculty: number;
	rowsClosedByTeacherX: number;
};

export type StaffingTruthComparison = {
	baseline: {
		totalTeachableRows: number;
		realCoveredRows: number;
		syntheticCoveredRows: number;
		unassignedRows: number;
	};
	realOnly: StaffingTruthBucket;
	hardCap: StaffingTruthBucket;
	teacherX: StaffingTruthBucket;
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
	coverageMode?: CoverageMode;
	warnings: string[];
	staffingReport: StaffingReport;
	staffingTruth?: StaffingTruthComparison;
	teacherXResolution?: {
		applied: boolean;
		rowsClosedByTeacherX: number;
		createdPlaceholders: number;
		reusedPlaceholders: number;
		placeholderAssignmentsUpserted: number;
		resolvedSubjectCodes: string[];
		stillUncoveredSubjectCodes: string[];
	};
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
	const staffingTruth = result?.staffingTruth ?? null;
	const hasShortage = Boolean(report && report.unassignedSections > 0);
	const hasResult = Boolean(result);
	const coverageMode = result?.coverageMode ?? 'REAL_FACULTY_STANDARD';
	const rawHours = report?.missingHoursPerWeek ?? 0;
	const concurrentHours = report?.concurrentMissingHoursPerWeek ?? rawHours;
	const recoverableHours = report?.recoverableConcurrentMissingHoursPerWeek ?? 0;
	const constrainedHours = report?.constrainedConcurrentMissingHoursPerWeek ?? Math.max(0, concurrentHours - recoverableHours);
	const dominantDepartment = report?.dominantShortageDepartment ?? report?.department ?? 'GENERAL';
	const overlapHours = Math.round(((report?.rotationAdjustedMinutesPerWeek ?? 0) / 60) * 10) / 10;
	const coverageModeLabel: Record<CoverageMode, string> = {
		REAL_FACULTY_STANDARD: 'Real Faculty Standard (30h)',
		REAL_FACULTY_HARD_CAP: 'Real Faculty Hard Cap (40h)',
		REAL_FACULTY_THEN_TEACHER_X: 'Real Faculty then Teacher X',
	};

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
			<DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl flex flex-col max-h-[90vh]">
				<DialogHeader className="p-6 bg-primary text-primary-foreground shrink-0 relative overflow-hidden">
					{/* Background decorative elements */}
					<div className="absolute top-0 right-0 p-4 opacity-10">
						<Building2 className="size-32 -mr-6 -mt-6" />
					</div>
					
					<div className="relative z-10 flex flex-col items-start gap-3">
						<div className="bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/20">
							{hasShortage ? <AlertTriangle className="size-6" /> : <BadgeCheck className="size-6" />}
						</div>
						<div className="space-y-1">
							<DialogTitle className="text-2xl font-bold tracking-tight">
								{title}
							</DialogTitle>
							<DialogDescription className="text-primary-foreground/80 max-w-2xl text-sm font-medium leading-relaxed">
								{description}
							</DialogDescription>
							<Badge className="mt-1 bg-white/15 text-primary-foreground border-white/20 shadow-none text-[0.6rem] font-bold uppercase tracking-widest">
								{coverageModeLabel[coverageMode]}
							</Badge>
						</div>
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto bg-muted/30">
					<div className="p-6">
						{hasShortage && report ? (
							<div className="space-y-6 max-w-3xl mx-auto">
								{/* Dual Truth Headline */}
								<div className="grid gap-4 sm:grid-cols-2">
									<Card className="p-5 border-none shadow-sm flex flex-col gap-1.5 relative overflow-hidden group hover:shadow-md transition-shadow">
										<div className="absolute top-3 right-3 text-emerald-500 opacity-10 group-hover:opacity-20 transition-opacity">
											<BadgeCheck className="size-10" />
										</div>
										<p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest">Unassigned Classes</p>
										<p className="text-3xl font-bold tracking-tight">{report.unassignedSections} <span className="text-sm font-normal text-muted-foreground">Sections</span></p>
										<p className="text-xs font-medium text-foreground/70 mt-1 leading-snug">Individual subject-section rows that still need a teacher assigned.</p>
										<div className="mt-3 flex items-center gap-2">
											<Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 shadow-none font-bold uppercase text-[0.6rem] tracking-wider px-2">Coverage Target</Badge>
										</div>
									</Card>

									<Card className="p-5 border-none shadow-sm flex flex-col gap-1.5 relative overflow-hidden group hover:shadow-md transition-shadow">
										<div className="absolute top-3 right-3 text-red-500 opacity-10 group-hover:opacity-20 transition-opacity">
											<Users2 className="size-10" />
										</div>
										<p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest">Weekly Teaching Shortage</p>
										<p className="text-3xl font-bold tracking-tight text-red-600">{concurrentHours} <span className="text-sm font-normal text-muted-foreground">Hours</span></p>
										<p className="text-xs font-medium text-foreground/70 mt-1 leading-snug">The true concurrent workload gap after rotation-overlap is removed.</p>
										<div className="mt-3 flex items-center gap-2">
											<Badge className="bg-red-50 text-red-700 border-red-100 shadow-none font-bold uppercase text-[0.6rem] tracking-wider px-2">Staffing Gap</Badge>
										</div>
									</Card>
								</div>

								{staffingTruth && (
									<div className="rounded-2xl border border-border/60 bg-background p-4 space-y-3">
										<div className="flex items-center justify-between">
											<h4 className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">Coverage Strategy Truth</h4>
											<Badge variant="outline" className="text-[0.6rem] font-bold uppercase">Rows: {staffingTruth.baseline.totalTeachableRows}</Badge>
										</div>
										<div className="grid gap-3 md:grid-cols-3">
											<div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-1">
												<p className="text-[0.6rem] font-bold uppercase tracking-widest text-amber-700">Real Only</p>
												<p className="text-lg font-black text-amber-900">{staffingTruth.realOnly.shortageRows} rows</p>
												<p className="text-[0.65rem] font-semibold text-amber-800/80">{staffingTruth.realOnly.shortageConcurrentHoursPerWeek}h shortage</p>
											</div>
											<div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-1">
												<p className="text-[0.6rem] font-bold uppercase tracking-widest text-blue-700">Hard Cap 40h</p>
												<p className="text-lg font-black text-blue-900">{staffingTruth.hardCap.shortageRows} rows</p>
												<p className="text-[0.65rem] font-semibold text-blue-800/80">{staffingTruth.hardCap.shortageConcurrentHoursPerWeek}h shortage</p>
											</div>
											<div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-1">
												<p className="text-[0.6rem] font-bold uppercase tracking-widest text-violet-700">Teacher X Fallback</p>
												<p className="text-lg font-black text-violet-900">{staffingTruth.teacherX.shortageRows} rows</p>
												<p className="text-[0.65rem] font-semibold text-violet-800/80">{staffingTruth.teacherX.rowsClosedByTeacherX} rows closed by Teacher X</p>
											</div>
										</div>
										<div className="grid gap-2 sm:grid-cols-2 text-[0.65rem] font-bold text-muted-foreground uppercase tracking-tight">
											<div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 text-emerald-800">
												Real rows closed: {staffingTruth.hardCap.rowsClosedByRealFaculty}
											</div>
											<div className="rounded-lg border border-violet-200 bg-violet-50/50 p-2 text-violet-800">
												Synthetic rows closed: {staffingTruth.teacherX.rowsClosedByTeacherX}
											</div>
										</div>
									</div>
								)}

								{/* Math Context Panel */}
								<div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-4">
									<div className="flex items-center gap-2 text-blue-900">
										<Info className="size-4 opacity-70" />
										<h4 className="text-[0.7rem] font-bold uppercase tracking-widest">How to read this report</h4>
									</div>
									<div className="grid gap-5 md:grid-cols-2 text-xs leading-relaxed text-blue-900/80">
										<p>
											<span className="font-bold">Unassigned Sections</span> represent every class row that needs a name. Schedulers must resolve all {report.unassignedSections} sections to finish the schedule.
										</p>
										<p>
											<span className="font-bold">Weekly Shortage</span> is the actual hiring or overload target. Rotational subjects are credited by peak term only, so only the busiest Term 1, Term 2, or Term 3 lane per family contributes to the <span className="font-bold">{concurrentHours} concurrent hours</span> per week.
										</p>
									</div>
									{overlapHours > 0 && (
										<div className="pt-3 border-t border-blue-200/40 flex items-center gap-2">
											<Badge variant="outline" className="bg-white/80 border-blue-200 text-blue-700 font-bold text-[0.65rem] shadow-none uppercase">
												Rotation Benefit
											</Badge>
											<span className="text-[0.65rem] font-bold text-blue-800">Peak-term crediting reduced total staffing demand by {overlapHours}h/wk.</span>
										</div>
									)}
								</div>

								{/* Detailed Drill-Down */}
								<div className="space-y-3">
									<div className="flex items-center justify-between px-1">
										<h4 className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest">Detailed Shortage Drill-Down</h4>
										<span className="text-[0.65rem] text-muted-foreground font-bold uppercase">{report.shortages.length} Subjects Affected</span>
									</div>
									
									<div className="space-y-2">
										{(report.shortages ?? []).map((shortage) => {
											const isOpen = expandedDepartments[shortage.department] ?? false;
											const deptConcurrentHours = Math.round((((shortage.concurrentMissingMinutesPerWeek ?? shortage.missingMinutesPerWeek) / 60) * 10)) / 10;
											
											return (
												<div key={shortage.department} className="rounded-xl border border-border/60 bg-background overflow-hidden transition-all duration-200 hover:border-border">
													<Button
														type="button"
														variant="ghost"
														onClick={() => toggleDepartment(shortage.department)}
														className={`h-auto w-full justify-between px-4 py-3 hover:bg-muted/30 transition-colors ${isOpen ? 'bg-muted/20 border-b' : ''}`}
													>
														<div className="flex items-center gap-3">
															<div className={`p-1 rounded-md transition-colors ${isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
																{isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
															</div>
															<span className="text-xs font-bold text-foreground uppercase tracking-tight">
																{shortage.department}
															</span>
														</div>
														<div className="flex items-center gap-3">
															<div className="hidden sm:flex items-center gap-3 text-[0.65rem] font-bold uppercase tracking-tight text-muted-foreground mr-2">
																<span className="flex items-center gap-1"><span className="text-foreground">{shortage.count}</span> Rows</span>
																<span className="opacity-40">|</span>
																<span className="flex items-center gap-1"><span className="text-red-700">{deptConcurrentHours}h</span> Shortage</span>
															</div>
															<Badge className={deptConcurrentHours > 0 ? 'bg-red-50 text-red-700 border-red-100 shadow-none font-bold text-[0.65rem]' : 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-none font-bold text-[0.65rem]'}>
																{deptConcurrentHours > 0 ? `${deptConcurrentHours}h Gap` : 'Covered'}
															</Badge>
														</div>
													</Button>
													{isOpen && (
														<div className="p-3 bg-muted/10">
															<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
																{shortage.sections.map((item, idx) => (
																	<div
																		key={idx}
																		className="group p-2.5 rounded-lg border border-border/40 bg-card shadow-xs hover:border-primary/30 transition-all duration-200"
																	>
																		<div className="flex items-start justify-between gap-2 mb-1">
																			<p className="font-bold text-foreground text-[0.65rem] truncate leading-tight tracking-tight uppercase">{item.subjectCode}</p>
																			<Badge variant="outline" className="h-4 px-1 text-[0.6rem] font-bold uppercase opacity-70 border-muted-foreground/20">
																				GR{item.sectionName.match(/\d+/)?.[0] || '?'}
																			</Badge>
																		</div>
																		<p className="text-[0.65rem] text-muted-foreground truncate font-bold">{item.sectionName}</p>
																		<p className="text-[0.6rem] text-muted-foreground/60 uppercase tracking-widest mt-1 font-bold">{item.programType}</p>
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
								<div className="grid gap-4 md:grid-cols-2 pt-2">
									<div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-1.5">
										<p className="text-[0.65rem] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-2">
											<Users2 className="size-3.5" /> Strategy: Internal Balance
										</p>
										<p className="text-xs text-blue-900/80 leading-relaxed font-bold">
											{report.internalCrossTrainees.length > 0 
												? `Qualified cross-department support can recover ~${recoverableHours}h/wk (${report.recoverableConcurrentRows ?? 0} concurrent rows), led by ${report.internalCrossTrainees.slice(0, 2).map(d => d.department).join(', ')}.`
												: 'No qualified cross-department recovery candidates were found under current rules.'}
										</p>
									</div>
									<div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-1.5">
										<p className="text-[0.65rem] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
											<AlertTriangle className="size-3.5" /> Strategy: Hiring Request
										</p>
										<p className="text-xs text-primary/80 leading-relaxed font-bold">
											Target <span className="font-bold text-primary">~{formatHires(report.recommendedNewHires)} full-time hires</span> to cover the remaining <span className="font-bold text-primary">{constrainedHours}h/wk</span> not recoverable with existing staff.
										</p>
									</div>
								</div>
							</div>
						) : hasResult && result && !hasShortage ? (
							<div className="flex flex-col items-center justify-center py-12 text-center space-y-6 max-w-sm mx-auto">
								<div className="size-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
									<BadgeCheck className="size-10" />
								</div>
								<div className="space-y-1.5">
									<h3 className="text-xl font-bold text-foreground">Complete Coverage</h3>
									<p className="text-muted-foreground text-sm font-medium leading-relaxed">
										Every class has been assigned an eligible teacher, and everyone is within their workload capacity.
									</p>
								</div>
								<div className="grid grid-cols-2 w-full gap-4 pt-4 border-t border-border/50">
									<div className="space-y-1">
										<p className="text-2xl font-bold tracking-tight">{result.assignmentsCreated}</p>
										<p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest">New Placements</p>
									</div>
									<div className="space-y-1 border-l border-border/50 pl-4">
										<p className="text-2xl font-bold tracking-tight">{result.uniqueTeachersAffected}</p>
										<p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest">Teachers Updated</p>
									</div>
								</div>
							</div>
						) : (
							<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
								<Zap className="size-10 opacity-20 mb-4 animate-pulse text-primary" />
								<p className="font-bold text-sm uppercase tracking-widest animate-pulse">Analyzing staffing demand...</p>
							</div>
						)}
					</div>
				</div>

				<DialogFooter className="p-4 bg-background border-t shrink-0 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Badge variant="outline" className="bg-muted text-muted-foreground font-bold uppercase tracking-widest text-[0.6rem] h-5 px-1.5 shadow-none border-border/60">
							Audit-Mode
						</Badge>
						<span className="text-[0.65rem] text-muted-foreground font-bold uppercase tracking-widest">Simulation</span>
					</div>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-9 rounded-xl px-8 font-bold border-border hover:bg-muted/50 transition-colors shadow-sm text-sm uppercase">
						Close Audit
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
