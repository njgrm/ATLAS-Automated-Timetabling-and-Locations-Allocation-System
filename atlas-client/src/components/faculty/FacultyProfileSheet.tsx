import {
	BookOpen,
	CalendarDays,
	User,
	Briefcase,
	Clock,
	CheckCircle2,
	AlertTriangle,
	ChevronRight,
	ClipboardList,
	Star
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Separator } from '@/ui/separator';
import type { FacultySummary } from '@/types';
import { Link } from 'react-router-dom';
import { getDepartmentColor } from '@/lib/department-colors';
import { GradeBadge } from '@/components/faculty-assignments/GradeBadge';
import { formatFacultyDisplayName } from '@/components/faculty/teacherNameDisplay';
import { deriveLoadStatus, STANDARD_WEEKLY_TEACHING_HOURS } from '@/lib/faculty-assignment-helpers';
import { departmentLabel } from '@/lib/deped-glossary';

interface FacultyProfileSheetProps {
	faculty: FacultySummary | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sourceFreshness: string;
	/**
	 * Fix 25. When this dialog is opened as the in-page "Review teachers"
	 * surface, the primary action is a repair route rather than a second
	 * profile view. `onReviewLoad` is optional so an unmigrated caller keeps
	 * working; when absent, the internal `/teaching-load` Link is rendered.
	 */
	onReviewLoad?: (faculty: FacultySummary) => void;
	/** Label for the primary action. Defaults to "Review teaching load". */
	reviewLabel?: string;
}

export function FacultyProfileSheet({
	faculty,
	open,
	onOpenChange,
	sourceFreshness,
	onReviewLoad,
	reviewLabel = 'Review teaching load',
}: FacultyProfileSheetProps) {
	if (!faculty) return null;

	const subjectCount = faculty.subjectCount ?? 0;
	const sectionCount = faculty.sectionCount ?? 0;
	
	const weeklyHours = faculty.policyCreditedHours ?? 0;
	const maxHours = faculty.maxHoursPerWeek;
	const loadPercent = Math.round((weeklyHours / Math.max(maxHours, 1)) * 100);
	const loadStatus = deriveLoadStatus(weeklyHours, maxHours);
	
	const loadState = !faculty.isActiveForScheduling
		? 'Excluded'
		: weeklyHours === 0 || subjectCount === 0
		? 'No teaching load'
		: loadStatus.label;
	const loadColor =
		loadState === 'No teaching load' || loadState === 'Excluded' ? 'bg-muted text-muted-foreground'
		: loadStatus.status === 'over-cap' ? 'bg-rose-100 text-rose-700'
		: loadStatus.status === 'overload-allowed' ? 'bg-orange-100 text-orange-700'
		: loadStatus.status === 'below-standard' ? 'bg-amber-100 text-amber-700'
		: 'bg-emerald-100 text-emerald-700';

	const loadProgressColor = 
		loadStatus.status === 'over-cap' ? 'bg-rose-500'
		: loadStatus.status === 'overload-allowed' ? 'bg-orange-500'
		: loadStatus.status === 'below-standard' ? 'bg-amber-500'
		: loadState === 'No teaching load' || loadState === 'Excluded' ? 'bg-slate-300'
		: 'bg-emerald-500';

	const deptColor = getDepartmentColor(faculty.department);

	// Fix 25: when the parent supplies a handler the primary action stays in
	// place (no navigation, so the roster keeps its filters/scroll/selection).
	// Otherwise fall back to the original cross-page Link.
	const reviewAction = (variant: 'link' | 'default' | 'outline', className: string, icon?: ReactNode) => {
		const body = (
			<>
				{icon}
				{reviewLabel}
				<ChevronRight className="size-3 ml-0.5" />
			</>
		);
		if (onReviewLoad) {
			return (
				<Button variant={variant} className={className} onClick={() => onReviewLoad(faculty)}>
					{body}
				</Button>
			);
		}
		return (
			<Link to={`/teaching-load?facultyId=${faculty.id}`} className="contents">
				<Button variant={variant} className={className}>{body}</Button>
			</Link>
		);
	};

	return (
		// Fix 23: a centred Dialog with internal scrolling, matching the
		// Fix 17/23 pattern. Radix Dialog closes on Escape and on an overlay /
		// outside click, and sets `pointer-events: none` on `document.body`
		// while open, which blocks background scroll without any extra code.
		// The former `Sheet` (w-full sm:max-w-md) was a side drawer that could
		// not be centred and did not match the rest of the workspace.
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto"
				data-testid="faculty-profile-dialog"
			>
				<DialogHeader className="pb-6 border-b">
					<div className="flex items-center gap-4">
						<div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary shadow-sm border border-primary/10">
							{faculty.firstName?.[0] ?? ''}{faculty.lastName?.[0] ?? ''}
						</div>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								{/* Fix 22: canonical `Last, First`, stored casing preserved. */}
								<DialogTitle className="text-xl font-bold truncate">
									{formatFacultyDisplayName(faculty)}
								</DialogTitle>
								{faculty.isClassAdviser && (
									<Star className="size-4 fill-amber-400 text-amber-500 shrink-0" />
								)}
							</div>
							<DialogDescription className="flex flex-wrap items-center gap-2 mt-1">
								<code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded uppercase tracking-tighter opacity-80">
									#{faculty.employeeId || 'ID-PENDING'}
								</code>
								{faculty.isActiveForScheduling ? (
									<span className="flex items-center gap-1 text-[0.7rem] font-bold text-emerald-600 uppercase tracking-wider">
										<CheckCircle2 className="size-3" /> Active teacher
									</span>
								) : (
									<span className="flex items-center gap-1 text-[0.7rem] font-bold text-muted-foreground uppercase tracking-wider">
										<AlertTriangle className="size-3" /> Excluded from scheduling
									</span>
								)}
								<span className="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-wider">{sourceFreshness}</span>
							</DialogDescription>
							{faculty.isClassAdviser && (
								<div className="mt-2">
									<Badge className="bg-amber-50 text-amber-800 hover:bg-amber-100 shadow-none border-amber-200 font-bold text-[0.7rem] px-2 py-0.5">
										<Star className="size-3 fill-amber-500 text-amber-600 mr-1.5" />
										{faculty.advisedSectionName ? `Adviser: ${faculty.advisedSectionName}` : 'Class Adviser'}
									</Badge>
								</div>
							)}
						</div>
					</div>
				</DialogHeader>

				<div className="py-6 space-y-8">
					{/* Identity Section */}
					<div className="space-y-4">
						<h4 className="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-widest">Roster identity</h4>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<p className="text-[0.65rem] font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
									<Briefcase className="size-3 opacity-50" /> Department
								</p>
								<Badge variant="outline" className={`text-xs font-semibold py-0.5 h-6 px-2 border-opacity-50 ${deptColor.bg} ${deptColor.text} ${deptColor.border}`}>
									{departmentLabel(faculty.department)}
								</Badge>
							</div>
							<div className="space-y-1.5">
								<p className="text-[0.65rem] font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
									<User className="size-3 opacity-50" /> Status
								</p>
								<p className="text-sm font-semibold pl-0.5">{faculty.employmentStatus || 'Unknown'}</p>
							</div>
						</div>
					</div>

					<Separator className="opacity-50" />

					{/* Workload Section */}
					<div className="space-y-4">
						<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current weekly hours</h4>

						<div className={`p-4 rounded-xl border flex flex-col gap-3 ${loadColor} bg-opacity-30 border-current border-opacity-10 shadow-sm`}>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Clock className="size-4 opacity-70" />
									<span className="text-sm font-bold">Total weekly hours</span>
								</div>
								<span className="text-lg font-bold tracking-tight">{weeklyHours}h <span className="text-xs font-normal opacity-70">/ {maxHours}h max</span></span>
							</div>

							<div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
								<div
									className={`h-full ${loadProgressColor} transition-all`}
									style={{ width: `${Math.min(100, loadPercent)}%` }}
								/>
							</div>

							<div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
								<span>{loadPercent}% of the weekly maximum</span>
								<span>{loadState}</span>
							</div>
							<div className="mt-2 space-y-1.5 border-t border-current/10 pt-3">
								<div className="flex justify-between items-center text-xs font-bold opacity-80 uppercase tracking-wider">
									<span>Class instruction</span>
									<span>{faculty.sectionTeachingHours || 0}h</span>
								</div>
								{faculty.isClassAdviser && faculty.advisoryEquivalentHours > 0 && (
									<div className="flex justify-between items-center text-xs font-bold opacity-80 uppercase tracking-wider">
										<span>Class advising</span>
										<span>{faculty.advisoryEquivalentHours}h</span>
									</div>
								)}
								{faculty.ancillaryMinutesPerWeek > 0 && (
									<div className="flex justify-between items-center text-xs font-bold opacity-80 uppercase tracking-wider">
										<span>Ancillary tasks</span>
										<span>{Math.round(faculty.ancillaryMinutesPerWeek / 6) / 10}h</span>
									</div>
								)}
							</div>
							{/* Phase 3.6: the 40h cap is now described as the absolute
								maximum before ATLAS cannot generate -- plain DepEd
								language instead of the old engineering term. */}
							<p className="text-xs font-bold opacity-70 uppercase tracking-wider">The standard is {STANDARD_WEEKLY_TEACHING_HOURS}h. The {maxHours}h maximum is the absolute limit before ATLAS cannot generate the timetable.</p>
						</div>

						<div className="grid grid-cols-2 gap-4 pt-2">
							<div className="p-3 rounded-xl border bg-muted/20 flex flex-col gap-1">
								<p className="text-[0.65rem] font-bold text-muted-foreground uppercase flex items-center gap-1.5 tracking-wider">
									<BookOpen className="size-3 opacity-50" /> Subjects
								</p>
								<p className="text-2xl font-bold">{subjectCount}</p>
							</div>
							<div className="p-3 rounded-xl border bg-muted/20 flex flex-col gap-1">
								<p className="text-[0.65rem] font-bold text-muted-foreground uppercase flex items-center gap-1.5 tracking-wider">
									<CalendarDays className="size-3 opacity-50" /> Sections
								</p>
								<p className="text-2xl font-bold">{sectionCount}</p>
							</div>
						</div>
					</div>

					<Separator className="opacity-50" />

					{/* Assigned Subjects List */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h4 className="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-widest">Assigned subjects and sections</h4>
						{/* Fix 25: `reviewAction` renders a plain Button when the parent
							handles the review in place, and only falls back to the
							navigating Link when it does not. No nested interactive. */}
						{reviewAction('link', 'h-auto p-0 text-[0.65rem] font-bold uppercase tracking-widest text-primary hover:no-underline')}
					</div>

						{faculty.assignments && faculty.assignments.length > 0 ? (
							<div className="space-y-3">
								{faculty.assignments.map((fs) => (
									<div key={fs.id} className="p-3 rounded-xl border border-border bg-background shadow-sm space-y-2.5">
										<div className="flex items-start justify-between gap-2 border-b pb-2 mb-2 border-border/40">
											<div className="min-w-0">
												<p className="text-sm font-bold truncate leading-tight">{fs.subject?.name || 'Unknown Subject'}</p>
												<code className="text-[0.65rem] text-muted-foreground font-mono uppercase opacity-70">{fs.subject?.code}</code>
											</div>
											<Badge variant="secondary" className="text-xs font-bold px-1.5 py-0.5 h-5 bg-muted/50">
												{fs.subject?.minMinutesPerWeek ? `${Math.round((fs.subject.minMinutesPerWeek / 60) * 10) / 10}h` : '-'}
											</Badge>
										</div>
										<div className="flex flex-col gap-1.5">
											{fs.sections && fs.sections.length > 0 ? (
												fs.sections.map((sec) => (
													<div key={sec.id} className="flex items-center gap-2">
										<GradeBadge grade={sec.displayOrder} ariaSuffix={sec.name} />
														<span className="text-xs text-foreground font-semibold truncate">{sec.name}</span>
													</div>
												))
											) : (
												<span className="text-xs text-muted-foreground italic">No sections explicitly mapped.</span>
											)}
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="space-y-3 rounded-xl border border-dashed bg-muted/5 px-4 py-10 text-center">
								<p className="text-sm font-bold text-foreground">No teaching load assigned yet.</p>
								<p className="text-xs leading-5 text-muted-foreground">Open Teaching Load to assign subjects and sections before generation.</p>
						<div className="flex justify-center">
							{reviewAction('outline', 'gap-2 font-bold')}
						</div>
							</div>
						)}
					</div>

					<Separator className="opacity-50" />

					<div className="space-y-3 rounded-xl border bg-slate-50/70 p-4">
						<h4 className="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-widest">Adviser and source context</h4>
						<p className="text-sm font-semibold text-foreground">
							{faculty.isClassAdviser
								? faculty.advisedSectionName
									? `Class adviser for ${faculty.advisedSectionName}.`
									: 'Class adviser assignment exists, but no section label is available.'
								: 'No adviser section assigned.'}
						</p>
						<p className="text-xs leading-5 text-muted-foreground">Roster source: {sourceFreshness}. Refresh the teacher roster if this does not match the latest EnrollPro record.</p>
					</div>

					{/* Secondary Actions */}
					<div className="pt-4 pb-8 flex flex-col gap-2">
						{reviewAction('default', 'w-full h-10 gap-2 font-bold shadow-md uppercase tracking-wide text-xs', <ClipboardList className="size-4" />)}
						<Button variant="secondary" className="h-10 text-muted-foreground font-bold uppercase tracking-wide text-xs" onClick={() => onOpenChange(false)}>
							Close profile
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}