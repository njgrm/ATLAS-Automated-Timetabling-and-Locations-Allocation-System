import { useState } from 'react';
import { AlertTriangle, BadgeCheck, Building2, ChevronDown, ChevronRight, Users2, Info, Zap, Eye, EyeOff, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/ui/tooltip';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import type { 
	StaffingCrossTrainee, 
	CoverageMode, 
	StaffingTruthBucket, 
	StaffingTruthComparison,
	StaffingReport,
	AutoFillSummaryResult
} from '@/types';

export type { AutoFillSummaryResult, CoverageMode };

export type SpecialProgramApprovalQueueEntry = {
	subjectCode: string;
	subjectName: string;
	facultyId: number;
	facultyName: string;
	department: string | null;
	specialization: string | null;
	currentTotalAssignedPairs: number;
	requiredSpecializationCodes: string[];
	reason: string;
};

type AutoFillSummaryModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	result: AutoFillSummaryResult | null;
	onApplySuggestion?: () => void;
	onReviewManually?: () => void;
	applyingSuggestion?: boolean;
	applyDisabledReason?: string | null;
	reviewWarning?: string | null;
	reviewOnly?: boolean;
};

const ASSIGNMENT_TYPE_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
	KEPT_EXISTING: { label: 'Kept existing', className: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2 },
	REAL_TEACHER: { label: 'Real teacher', className: 'bg-blue-50 text-blue-700 border-blue-100', icon: Users2 },
	TEMPORARY_SUBSTITUTE: { label: 'Temporary substitute', className: 'bg-violet-50 text-violet-700 border-violet-100', icon: AlertCircle },
};

function SuggestedRowsPreviewList({ rows }: { rows: Array<{ subjectCode: string; subjectName: string; sectionName: string; facultyName: string; assignmentType: string; warning?: string | null }> }) {
	const [showAll, setShowAll] = useState(false);
	const visibleRows = showAll ? rows : rows.slice(0, 10);
	const hasMore = rows.length > 10;

	return (
		<div className="space-y-2">
			<TooltipProvider>
				<div className="rounded-xl border border-border/60 bg-background overflow-hidden">
					<div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 bg-muted/50 text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border/40">
						<span>Subject</span>
						<span>Section</span>
						<span>Teacher</span>
						<span className="text-right">Type</span>
					</div>
					{visibleRows.map((row, idx) => {
						const config = ASSIGNMENT_TYPE_CONFIG[row.assignmentType] ?? ASSIGNMENT_TYPE_CONFIG.REAL_TEACHER;
						const TypeIcon = config.icon;
						return (
							<div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 text-xs border-b border-border/20 last:border-b-0 hover:bg-muted/20 transition-colors">
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="font-bold text-foreground truncate">{row.subjectCode}</div>
									</TooltipTrigger>
									<TooltipContent side="top">{row.subjectName}</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="text-muted-foreground truncate">{row.sectionName}</div>
									</TooltipTrigger>
									<TooltipContent side="top">{row.sectionName}</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="text-muted-foreground truncate">{row.facultyName}</div>
									</TooltipTrigger>
									<TooltipContent side="top">{row.facultyName}</TooltipContent>
								</Tooltip>
								<div className={`flex items-center gap-1 shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-bold uppercase ${config.className}`}>
									<TypeIcon className="size-3" />
									<span className="hidden sm:inline">{config.label}</span>
								</div>
								{row.warning && (
									<div className="col-span-4 text-xs text-amber-700 font-semibold mt-0.5">{row.warning}</div>
								)}
							</div>
						);
					})}
				</div>
			</TooltipProvider>
			{hasMore && (
				<Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="h-7 text-xs font-bold">
					{showAll ? <><EyeOff className="size-3 mr-1" /> Hide new assignments</> : <><Eye className="size-3 mr-1" /> View all {rows.length} new assignments</>}
				</Button>
			)}
		</div>
	);
}

function formatHires(value: number): string {
	return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

type EffectiveBreakdown = { existingRows: number; realTeacherRows: number; substituteRows: number; newSuggestedRows: number; previewRowCount: number; unresolvedRows: number };

function buildBreakdownFromSuggestedRows(result: AutoFillSummaryResult): EffectiveBreakdown {
	const rows = result.suggestedRows ?? [];
	let existingRows = 0;
	let realTeacherRows = 0;
	let substituteRows = 0;
	for (const row of rows) {
		if (row.assignmentType === 'KEPT_EXISTING') existingRows++;
		else if (row.assignmentType === 'REAL_TEACHER') realTeacherRows++;
		else if (row.assignmentType === 'TEMPORARY_SUBSTITUTE') substituteRows++;
		else realTeacherRows++;
	}
	const newSuggestedRows = realTeacherRows + substituteRows;
	const previewRowCount = rows.length;
	return { existingRows, realTeacherRows, substituteRows, newSuggestedRows, previewRowCount, unresolvedRows: result.unresolved ?? 0 };
}

function getEffectiveBreakdown(result: AutoFillSummaryResult | null, coverageMode: CoverageMode): EffectiveBreakdown {
	if (!result) return { existingRows: 0, realTeacherRows: 0, substituteRows: 0, newSuggestedRows: 0, previewRowCount: 0, unresolvedRows: 0 };
	if (result.suggestedAssignmentBreakdown) {
		const b = result.suggestedAssignmentBreakdown;
		return {
			existingRows: b.existingRows,
			realTeacherRows: b.realTeacherRows,
			substituteRows: b.substituteRows,
			newSuggestedRows: b.newSuggestedRows,
			previewRowCount: b.previewRowCount,
			unresolvedRows: b.unresolvedRows,
		};
	}
	return buildBreakdownFromSuggestedRows(result);
}

export function AutoFillSummaryModal({
	open,
	onOpenChange,
	result,
	onApplySuggestion,
	onReviewManually,
	applyingSuggestion = false,
	applyDisabledReason,
	reviewWarning,
	reviewOnly = false,
}: AutoFillSummaryModalProps) {
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
	const sectionSource = result?.sectionSource ?? 'enrollpro';
	const coverageModeLabel: Record<CoverageMode, string> = {
		REAL_FACULTY_STANDARD: 'Real teachers first, up to 30h/week',
		REAL_FACULTY_HARD_CAP: 'Maximum allowed hours (40h)',
		REAL_FACULTY_THEN_TEACHER_X: 'Real teachers first, then substitutes',
	};
	const sourceLabelMap: Record<NonNullable<AutoFillSummaryResult['sectionSource']>, string> = {
		enrollpro: 'Live EnrollPro',
		'atlas-mirror': 'ATLAS Mirror',
		'cached-enrollpro': 'ATLAS Cached',
		stub: 'Stub Data',
	};
	const sectionSourceLabel = sourceLabelMap[sectionSource];
	const breakdown = getEffectiveBreakdown(result, coverageMode);
	const suggestedRows = breakdown.realTeacherRows + breakdown.substituteRows;
	const sourceToneClass = sectionSource === 'enrollpro'
		? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
		: sectionSource === 'stub'
			? 'border-amber-200 bg-amber-50/60 text-amber-900'
			: 'border-blue-200 bg-blue-50/60 text-blue-900';

	const title = reviewOnly
		? 'Review saved Teaching Load coverage'
		: !hasResult
			? 'Checking Teaching Load suggestion'
			: hasShortage
				? 'Review suggested Teaching Load draft'
				: 'Suggested Teaching Load covers all rows';
	const description = reviewOnly
		? 'Review the current saved Teaching Load assignments, unassigned pairs, and warnings. Use Suggest Teaching Load draft to prepare new assignments.'
		: !hasResult
			? 'ATLAS is reading the current EnrollPro setup and checking which Teaching Load rows can be suggested. Nothing is being saved.'
			: hasShortage
				? (() => {
					const parts: string[] = [];
					if (breakdown.existingRows > 0) parts.push(`keep ${breakdown.existingRows} existing assignment${breakdown.existingRows === 1 ? '' : 's'}`);
					if (breakdown.realTeacherRows > 0) parts.push(`suggest ${breakdown.realTeacherRows} real-teacher assignment${breakdown.realTeacherRows === 1 ? '' : 's'}`);
					if (breakdown.substituteRows > 0) parts.push(`use ${breakdown.substituteRows} temporary substitute row${breakdown.substituteRows === 1 ? '' : 's'}`);
					const summary = parts.length > 0 ? `ATLAS will ${parts.join(', ')}.` : `ATLAS can suggest ${suggestedRows} assignment row${suggestedRows === 1 ? '' : 's'}.`;
					const unresolvedNote = breakdown.unresolvedRows > 0 ? ` ${breakdown.unresolvedRows} row${breakdown.unresolvedRows === 1 ? '' : 's'} remain${breakdown.unresolvedRows === 1 ? 's' : ''} unresolved.` : ' 0 rows remain unresolved.';
					return `${summary}${unresolvedNote} Dominant shortage bucket: ${dominantDepartment}.`;
				})()
				: (() => {
					const parts: string[] = [];
					if (breakdown.existingRows > 0) parts.push(`keep ${breakdown.existingRows} existing assignment${breakdown.existingRows === 1 ? '' : 's'}`);
					if (breakdown.realTeacherRows > 0) parts.push(`suggest ${breakdown.realTeacherRows} real-teacher assignment${breakdown.realTeacherRows === 1 ? '' : 's'}`);
					if (breakdown.substituteRows > 0) parts.push(`use ${breakdown.substituteRows} temporary substitute row${breakdown.substituteRows === 1 ? '' : 's'}`);
					const summary = parts.length > 0 ? `ATLAS will ${parts.join(', ')}.` : `ATLAS can suggest ${suggestedRows} assignment row${suggestedRows === 1 ? '' : 's'} for review.`;
					const unresolvedNote = breakdown.unresolvedRows > 0 ? ` ${breakdown.unresolvedRows} row${breakdown.unresolvedRows === 1 ? '' : 's'} remain${breakdown.unresolvedRows === 1 ? 's' : ''} unresolved.` : ' 0 rows remain unresolved.';
					return `${summary}${unresolvedNote}`;
				})();
	const specialProgramApprovalQueue = result?.specialProgramApprovalQueue ?? [];

	const toggleDepartment = (department: string) => {
		setExpandedDepartments((current) => ({
			...current,
			[department]: !current[department],
		}));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent data-testid="teaching-load-suggestion-preview" className="max-w-4xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl flex flex-col max-h-[90vh]">
				<DialogHeader className="p-6 bg-primary text-primary-foreground shrink-0 relative overflow-hidden">
					{/* Background decorative elements */}
					<div className="absolute top-0 right-0 p-4 opacity-10">
						<Building2 className="size-32 -mr-6 -mt-6" />
					</div>
					
					<div className="relative z-10 flex flex-col items-start gap-3">
						<div className="bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/20">
							{!hasResult ? <Zap className="size-6 animate-pulse" /> : hasShortage ? <AlertTriangle className="size-6" /> : <BadgeCheck className="size-6" />}
						</div>
						<div className="space-y-1">
							<DialogTitle className="text-2xl font-bold tracking-tight">
								{title}
							</DialogTitle>
							<DialogDescription className="text-primary-foreground/80 max-w-2xl text-sm font-medium leading-relaxed">
								{description}
							</DialogDescription>
							<Badge className="mt-1 bg-white/15 text-primary-foreground border-white/20 shadow-none text-xs font-bold uppercase tracking-widest">
								{coverageModeLabel[coverageMode]}
							</Badge>
						</div>
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto bg-muted/30">
					<div className="p-6">
						{hasResult && result && (
							<div className={`mb-4 rounded-xl border px-3 py-2 ${sourceToneClass}`}>
								<div className="flex items-center justify-between gap-2">
									<p className="text-xs font-bold uppercase tracking-[0.14em]">Section Data Source</p>
									<Badge variant="outline" className="h-4 border-current/30 bg-white/60 px-1.5 text-xs font-bold uppercase">
										{sectionSourceLabel}
									</Badge>
								</div>
							{result.warnings.length > 0 && (
								<p className="mt-1.5 text-[0.7rem] font-semibold leading-snug">{result.warnings[0]}</p>
							)}
						</div>
						)}

						{specialProgramApprovalQueue.length > 0 && (
							<div className="mb-4 rounded-xl border border-amber-300 bg-amber-50/60 px-3 py-2.5 text-amber-950">
								<div className="flex items-center justify-between gap-2">
									<p className="text-xs font-bold uppercase tracking-[0.14em]">Manual Capability Approval Required</p>
									<Badge variant="outline" className="h-4 border-amber-300 bg-white/70 px-1.5 text-xs font-bold uppercase text-amber-800">
										{specialProgramApprovalQueue.length} Candidate{specialProgramApprovalQueue.length === 1 ? '' : 's'}
									</Badge>
								</div>
								<p className="mt-1 text-xs font-semibold leading-snug text-amber-900/90">
									These candidates are plausible for SPA/SPS redistribution but remain blocked until a scheduler grants an explicit capability override.
								</p>
								<div className="mt-2 grid gap-1.5">
									{specialProgramApprovalQueue.slice(0, 6).map((candidate) => (
										<div key={`${candidate.subjectCode}:${candidate.facultyId}`} className="rounded-lg border border-amber-200 bg-white/70 px-2 py-1.5 text-xs font-semibold">
											<div className="flex items-center justify-between gap-2">
												<span className="font-bold text-amber-900">{candidate.subjectCode} * {candidate.facultyName}</span>
												<span className="text-amber-700/90">{candidate.currentTotalAssignedPairs} pairs</span>
											</div>
											<p className="mt-1 text-amber-800/90">Needs: {candidate.requiredSpecializationCodes.join(', ')}</p>
										</div>
									))}
								</div>
							</div>
						)}

						{hasShortage && report && result ? (
							<div className="space-y-6 max-w-3xl mx-auto">
								{/* Dual Truth Headline */}
								<div className="grid gap-4 sm:grid-cols-2">
									<Card className="p-5 border-none shadow-sm flex flex-col gap-1.5 relative overflow-hidden group hover:shadow-md transition-shadow">
										<div className="absolute top-3 right-3 text-emerald-500 opacity-10 group-hover:opacity-20 transition-opacity">
											<BadgeCheck className="size-10" />
										</div>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Unassigned Classes</p>
										<p className="text-3xl font-bold tracking-tight">{report.unassignedSections} <span className="text-sm font-normal text-muted-foreground">Sections</span></p>
										<p className="text-xs font-medium text-foreground/70 mt-1 leading-snug">Individual subject-section rows that still need a teacher assigned.</p>
										<div className="mt-3 flex items-center gap-2">
											<Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 shadow-none font-bold uppercase text-xs tracking-wider px-2">Coverage Target</Badge>
										</div>
									</Card>

									<Card className="p-5 border-none shadow-sm flex flex-col gap-1.5 relative overflow-hidden group hover:shadow-md transition-shadow">
										<div className="absolute top-3 right-3 text-red-500 opacity-10 group-hover:opacity-20 transition-opacity">
											<Users2 className="size-10" />
										</div>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Weekly Teaching Shortage</p>
										<p className="text-3xl font-bold tracking-tight text-red-600">{concurrentHours} <span className="text-sm font-normal text-muted-foreground">Hours</span></p>
										<p className="text-xs font-medium text-foreground/70 mt-1 leading-snug">The true concurrent workload gap after rotation-overlap is removed.</p>
										<div className="mt-3 flex items-center gap-2">
											<Badge className="bg-red-50 text-red-700 border-red-100 shadow-none font-bold uppercase text-xs tracking-wider px-2">Staffing Gap</Badge>
										</div>
									</Card>
								</div>

								{staffingTruth && (
									<div className="rounded-2xl border border-border/60 bg-background p-4 space-y-3">
										<div className="flex items-center justify-between">
											<h4 className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">Coverage Strategy Truth</h4>
											<Badge variant="outline" className="text-xs font-bold uppercase">Rows: {staffingTruth.baseline.totalTeachableRows}</Badge>
										</div>
										<div className="grid gap-3 md:grid-cols-3">
											<div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-1">
												<p className="text-xs font-bold uppercase tracking-widest text-amber-700">Real Only</p>
												<p className="text-lg font-semibold text-amber-900">{staffingTruth.realOnly.shortageRows} rows</p>
												<p className="text-xs font-semibold text-amber-800/80">{staffingTruth.realOnly.shortageConcurrentHoursPerWeek}h shortage</p>
											</div>
											<div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-1">
												<p className="text-xs font-bold uppercase tracking-widest text-blue-700">Maximum 40h</p>
												<p className="text-lg font-semibold text-blue-900">{staffingTruth.hardCap.shortageRows} rows</p>
												<p className="text-xs font-semibold text-blue-800/80">{staffingTruth.hardCap.shortageConcurrentHoursPerWeek}h shortage</p>
											</div>
											<div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-1">
												<p className="text-xs font-bold uppercase tracking-widest text-violet-700">Temporary substitutes</p>
												<p className="text-lg font-semibold text-violet-900">{staffingTruth.teacherX.shortageRows} rows</p>
												<p className="text-xs font-semibold text-violet-800/80">{staffingTruth.teacherX.rowsClosedByTeacherX} rows closed by substitutes</p>
											</div>
										</div>
										<div className="grid gap-2 sm:grid-cols-2 text-xs font-bold text-muted-foreground uppercase tracking-tight">
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
											<Badge variant="outline" className="bg-white/80 border-blue-200 text-blue-700 font-bold text-xs shadow-none uppercase">
												Rotation Benefit
											</Badge>
											<span className="text-xs font-bold text-blue-800">Peak-term crediting reduced total staffing demand by {overlapHours}h/wk.</span>
										</div>
									)}
								</div>

								{/* Detailed Drill-Down */}
								<div className="space-y-3">
									<div className="flex items-center justify-between px-1">
										<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Detailed Shortage Drill-Down</h4>
										<span className="text-xs text-muted-foreground font-bold uppercase">{report.shortages.length} Subjects Affected</span>
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
															<div className="hidden sm:flex items-center gap-3 text-xs font-bold uppercase tracking-tight text-muted-foreground mr-2">
																<span className="flex items-center gap-1"><span className="text-foreground">{shortage.count}</span> Rows</span>
																<span className="opacity-40">|</span>
																<span className="flex items-center gap-1"><span className="text-red-700">{deptConcurrentHours}h</span> Shortage</span>
															</div>
															<Badge className={deptConcurrentHours > 0 ? 'bg-red-50 text-red-700 border-red-100 shadow-none font-bold text-xs' : 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-none font-bold text-xs'}>
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
																			<p className="font-bold text-foreground text-xs truncate leading-tight tracking-tight uppercase">{item.subjectCode}</p>
																			<Badge variant="outline" className="h-4 px-1 text-xs font-bold uppercase opacity-70 border-muted-foreground/20">
																				GR{item.sectionName.match(/\d+/)?.[0] || '?'}
																			</Badge>
																		</div>
																		<p className="text-xs text-muted-foreground truncate font-bold">{item.sectionName}</p>
																		<p className="text-xs text-muted-foreground/60 uppercase tracking-widest mt-1 font-bold">{item.programType}</p>
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
										<p className="text-xs font-bold text-amber-700 uppercase tracking-widest flex items-center gap-2">
											<Users2 className="size-3.5" /> Strategy: Internal Balance
										</p>
										<p className="text-xs text-blue-900/80 leading-relaxed font-bold">
											{report.internalCrossTrainees.length > 0 
												? `Qualified cross-department support can recover ~${recoverableHours}h/wk (${report.recoverableConcurrentRows ?? 0} concurrent rows), led by ${report.internalCrossTrainees.slice(0, 2).map(d => d.department).join(', ')}.`
												: 'No qualified cross-department recovery candidates were found under current rules.'}
										</p>
									</div>
									<div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-1.5">
										<p className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
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
								<div className="grid grid-cols-2 sm:grid-cols-4 w-full gap-3 pt-4 border-t border-border/50">
									<div className="space-y-1 text-center">
										<div className="inline-flex items-center justify-center size-8 rounded-full bg-emerald-100 text-emerald-600 mb-1">
											<CheckCircle2 className="size-4" />
										</div>
										<p className="text-2xl font-bold tracking-tight">{breakdown.existingRows}</p>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Kept Existing</p>
									</div>
									<div className="space-y-1 text-center">
										<div className="inline-flex items-center justify-center size-8 rounded-full bg-blue-100 text-blue-600 mb-1">
											<Users2 className="size-4" />
										</div>
										<p className="text-2xl font-bold tracking-tight">{breakdown.realTeacherRows}</p>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Real-Teacher Suggestions</p>
									</div>
									<div className="space-y-1 text-center">
										<div className="inline-flex items-center justify-center size-8 rounded-full bg-violet-100 text-violet-600 mb-1">
											<AlertCircle className="size-4" />
										</div>
										<p className="text-2xl font-bold tracking-tight">{breakdown.substituteRows}</p>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Temporary Substitute</p>
									</div>
									<div className="space-y-1 text-center">
										<div className="inline-flex items-center justify-center size-8 rounded-full bg-amber-100 text-amber-600 mb-1">
											<XCircle className="size-4" />
										</div>
										<p className="text-2xl font-bold tracking-tight">{breakdown.unresolvedRows}</p>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Still Unresolved</p>
									</div>
								</div>
							</div>
						) : (
							<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
								<Zap className="size-10 opacity-20 mb-4 animate-pulse text-primary" />
								<p className="font-bold text-sm uppercase tracking-widest animate-pulse">Analyzing staffing demand...</p>
							</div>
						)}

						{/* Preview New Assignments — rendered after both shortage and complete-coverage branches */}
						{!reviewOnly && result && breakdown.newSuggestedRows > 0 && result.suggestedRows && result.suggestedRows.length > 0 && (() => {
							const newRows = result.suggestedRows.filter(
								(r) => r.assignmentType === 'REAL_TEACHER' || r.assignmentType === 'TEMPORARY_SUBSTITUTE',
							);
							return newRows.length > 0 ? (
								<div className="max-w-3xl mx-auto space-y-3 pt-4 border-t border-border/40">
									<div className="flex items-center justify-between">
										<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
											<Eye className="size-3.5" /> Preview New Assignments
										</h4>
										<span className="text-xs text-muted-foreground font-bold uppercase">{breakdown.newSuggestedRows} New Assignment{breakdown.newSuggestedRows === 1 ? '' : 's'}</span>
									</div>
									<SuggestedRowsPreviewList rows={newRows} />
								</div>
							) : null;
						})()}
					</div>
				</div>

				<DialogFooter className="p-4 bg-background border-t shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0 space-y-1">
						{reviewOnly ? (
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline" className="bg-blue-50 text-blue-700 font-bold uppercase tracking-widest text-xs h-5 px-1.5 shadow-none border-blue-200">
									Review only
								</Badge>
								<span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Use Suggest Teaching Load draft to prepare assignments.</span>
							</div>
						) : (
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline" className="bg-muted text-muted-foreground font-bold uppercase tracking-widest text-xs h-5 px-1.5 shadow-none border-border/60">
									Preview first
								</Badge>
								<span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">No Teaching Load rows were saved by opening this review.</span>
							</div>
						)}
						{applyDisabledReason && !reviewOnly && (
							<p data-testid="teaching-load-suggestion-feedback" className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800" aria-live="polite">
								{applyDisabledReason}
							</p>
						)}
						{reviewWarning && !applyDisabledReason && (
							<p data-testid="teaching-load-suggestion-warning" className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800" aria-live="polite">
								{reviewWarning}
							</p>
						)}
					</div>
					<div className="flex flex-wrap justify-end gap-2">
						<Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-9 rounded-xl px-4 font-bold">
							Close
						</Button>
						{!reviewOnly && (
							<>
								<Button type="button" variant="outline" onClick={onReviewManually} className="h-9 rounded-xl px-4 font-bold">
									Review manually
								</Button>
								<Button
									type="button"
									onClick={onApplySuggestion}
									disabled={!onApplySuggestion || applyingSuggestion || Boolean(applyDisabledReason)}
									data-testid="teaching-load-apply-suggestion"
									className="h-9 rounded-xl px-4 font-bold"
								>
									{applyingSuggestion ? 'Applying...' : 'Apply suggested Teaching Load'}
								</Button>
							</>
						)}
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
