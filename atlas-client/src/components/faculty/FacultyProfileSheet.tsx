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
import type { ExternalSection, FacultySummary } from '@/types';
import { Link } from 'react-router-dom';
import { getDepartmentColor } from '@/lib/department-colors';
import { GradeBadge } from '@/components/faculty-assignments/GradeBadge';
import {
	formatFacultyDisplayName,
	formatFacultyInitials,
	isPlaceholderSentinelName,
} from '@/components/faculty/teacherNameDisplay';
import { resolveSectionGradeNumber } from '@/lib/schedule-review-helpers';
import { deriveLoadStatus, STANDARD_WEEKLY_TEACHING_HOURS } from '@/lib/faculty-assignment-helpers';
import { departmentLabel } from '@/lib/deped-glossary';

/**
 * Weekly minutes as hours at ONE decimal, the precision the per-section badge
 * already used.
 *
 * A3 c17 row 2 makes the per-section badge and the subject TOTAL read from this
 * one function. That is the whole point: when they were two inline expressions a
 * later edit to one would silently disagree with the other, and "3.8h" beside
 * "30h a week" for 8 sections is the kind of arithmetic a scheduler stops
 * trusting.
 */
function formatHoursLabel(minutes: number): string {
	return `${Math.round((minutes / 60) * 10) / 10}h`;
}

/** One grade group inside a subject card. `grade` is null when unresolvable. */
type GradeGroup = {
	/** Stable React key; the unresolved group is the only non-numeric one. */
	key: string;
	grade: number | null;
	sections: ExternalSection[];
};

/**
 * Group a subject's sections by the grade they are REALLY in, ascending, with
 * the unresolvable group last.
 *
 * A3 c17 row 1. The resolver is `resolveSectionGradeNumber` — the one shared
 * authority (A2 c15) the Timetable grid and the canonical readiness diagnostic
 * already use. A section it cannot resolve keeps `grade: null` and is rendered
 * under a neutral "Grade not set" heading with NO `GradeBadge`, because a
 * coloured `GRn` chip is a claim about a grade and an unresolved section does
 * not support one.
 */
function groupSectionsByResolvedGrade(sections: ExternalSection[]): GradeGroup[] {
	const byGrade = new Map<number, ExternalSection[]>();
	const unresolved: ExternalSection[] = [];
	for (const section of sections ?? []) {
		const grade = resolveSectionGradeNumber(section);
		if (grade == null) {
			unresolved.push(section);
			continue;
		}
		const bucket = byGrade.get(grade);
		if (bucket) bucket.push(section);
		else byGrade.set(grade, [section]);
	}
	const groups: GradeGroup[] = [...byGrade.entries()]
		.sort(([a], [b]) => a - b)
		.map(([grade, groupSections]) => ({ key: `grade-${grade}`, grade, sections: groupSections }));
	if (unresolved.length > 0) {
		groups.push({ key: 'grade-unset', grade: null, sections: unresolved });
	}
	return groups;
}

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

	/**
	 * A3 c17 row 3. Read from the ONE shared predicate in `teacherNameDisplay`,
	 * not from `faculty.isPlaceholder` alone, so the badge and the display name
	 * can never disagree about which record is a to-be-hired one.
	 */
	const isPlaceholder = isPlaceholderSentinelName(faculty);

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
				/*
				 * THE TEACHER PROFILE DIALOG (A5 item 23.2, target 2 of 5).
				 *
				 * It was already resizable — but resizable in its own way, with a
				 * page-local Tailwind `resize` class, its own bounds and a browser-drawn
				 * corner grip. It now takes the shared dialog's `resizable` handling,
				 * so the Teacher profile card, the Subject coverage card and the other
				 * three data dialogs all answer "can I widen this?" the same way
				 * (AGENTS.md §8, one look per control). `resize` is gone from the class
				 * list; the shared primitive's two visible drag handles replace the
				 * corner grip.
				 *
				 * What stays here is what is genuinely this surface's own: its
				 * first-paint height, its `min-h-[min(400px,90vh)]` / `min-h-[400px]`
				 * floor, and `overflow-hidden`. The clipping is still load-bearing —
				 * the card clips and the BODY below it scrolls, so this surface keeps
				 * exactly one scroll container and never a global one (§8).
				 *
				 * The `min-*(…,95vw)` guard is the operator's `min-w-[500px]` made
				 * safe: an UNGUARDED `min-w-[500px]` on a 390px viewport is a hard
				 * overflow and a 110px horizontal scrollbar. The same reasoning now
				 * lives in `@/ui/dialog` for every dialog, and this line keeps the
				 * card's own, larger, floor.
				 */
				resizable
				className="flex h-[70vh] min-h-[min(400px,90vh)] min-w-[min(500px,95vw)] w-[min(56rem,95vw)] max-w-[95vw] max-h-[90vh] flex-col gap-0 overflow-hidden p-0"
				data-testid="faculty-profile-dialog"
			>
				<DialogHeader className="px-6 pt-6 pb-6 border-b">
					<div className="flex items-center gap-4">
						<div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary shadow-sm border border-primary/10">
							{/* Fix 22 (c10 re-issue): uppercase avatar initials, same display
						    standard as the name beside them. Stored fields untouched. */}
						{formatFacultyInitials(faculty)}
						</div>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								{/* Fix 22 (c10 re-issue): canonical `Last, First`, UPPERCASE for
							    display. The stored name is unchanged. */}
								<DialogTitle className="text-xl font-bold truncate">
									{formatFacultyDisplayName(faculty)}
								</DialogTitle>
								{faculty.isClassAdviser && (
									<Star className="size-4 fill-amber-400 text-amber-500 shrink-0" />
								)}
							</div>
							<DialogDescription className="flex flex-wrap items-center gap-2 mt-1">
								{/*
								 * A3 c17 row 3 — the identity line says one true thing
								 * about this record and nothing else.
								 *
								 * A to-be-hired record has no employee number to show:
								 * it is not an employee, so `#ID-PENDING` was inventing an
								 * identity AND saying "Active teacher" in the same breath.
								 * It now reads `To be hired` in the roster's own Temporary
								 * *look* — the violet outline pair, copied verbatim from
								 * `FacultyRow.tsx:205` so there is one "not a real person
								 * yet" appearance in the app (AGENTS.md §8). Only the SIZE
								 * differs, because this dialog is held to the 14px floor and
								 * `text-[0.65rem]` is 10.4px; a4-row-6 below raises the rest.
								 *
								 * A REAL teacher with no `employeeId` shows NOTHING in this
								 * slot — not an empty `<code>`, not a dash, not the pending
								 * sentinel. A missing field is not a fact worth a chip.
								 */}
								{isPlaceholder ? (
									<Badge
										variant="outline"
										className="h-auto px-1.5 py-0.5 text-sm font-bold border-violet-200 bg-violet-50 text-violet-700"
									>
										To be hired
									</Badge>
								) : faculty.employeeId ? (
									<code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded uppercase tracking-tighter opacity-80">
										#{faculty.employeeId}
									</code>
								) : null}
								{faculty.isActiveForScheduling ? (
									<span className="flex items-center gap-1 text-sm font-semibold text-emerald-700">
										<CheckCircle2 className="size-3" /> Active teacher
									</span>
								) : (
									<span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
										<AlertTriangle className="size-3" /> Excluded from scheduling
									</span>
								)}
								<span className="text-sm font-semibold text-muted-foreground">{sourceFreshness}</span>
							</DialogDescription>
							{faculty.isClassAdviser && (
								<div className="mt-2">
									<Badge className="bg-amber-50 text-amber-800 hover:bg-amber-100 shadow-none border-amber-200 font-bold text-sm px-2 py-0.5">
										<Star className="size-3 fill-amber-500 text-amber-600 mr-1.5" />
										{faculty.advisedSectionName ? `Adviser: ${faculty.advisedSectionName}` : 'Class Adviser'}
									</Badge>
								</div>
							)}
						</div>
					</div>
				</DialogHeader>

				{/* FIX 23.1: the BODY is the one scroll region. `min-h-0` +
				    `flex-1` let it actually take the leftover height of the
				    flex-column card (without `min-h-0` a flex child refuses to
				    shrink below its content and the card, not the body, would
				    scroll), and `px-6 pt-6` keeps content off the card edge now
				    that the card itself is a clipping box. */}
				<div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 space-y-8">
					{/* Identity Section */}
					<div className="space-y-4">
						<h4 className="text-sm font-semibold text-muted-foreground">Roster identity</h4>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
									<Briefcase className="size-3 opacity-50" /> Department
								</p>
								<Badge variant="outline" className={`text-xs font-semibold py-0.5 h-6 px-2 border-opacity-50 ${deptColor.bg} ${deptColor.text} ${deptColor.border}`}>
									{departmentLabel(faculty.department)}
								</Badge>
							</div>
							<div className="space-y-1.5">
								<p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
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
								<p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
									<BookOpen className="size-3 opacity-50" /> Subjects
								</p>
								<p className="text-2xl font-bold">{subjectCount}</p>
							</div>
							<div className="p-3 rounded-xl border bg-muted/20 flex flex-col gap-1">
								<p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
									<CalendarDays className="size-3 opacity-50" /> Sections
								</p>
								<p className="text-2xl font-bold">{sectionCount}</p>
							</div>
						</div>
					</div>

					<Separator className="opacity-50" />

					{/* Assigned Subjects List */}
					<div className="space-y-4">
						<div className="flex items-center justify-between gap-3">
							<h4 className="text-sm font-semibold text-muted-foreground">Assigned subjects and sections</h4>
						{/* Fix 25: `reviewAction` renders a plain Button when the parent
							handles the review in place, and only falls back to the
							navigating Link when it does not. No nested interactive. */}
						{reviewAction('link', 'h-auto p-0 text-sm font-semibold text-primary hover:no-underline')}
					</div>

					{faculty.assignments && faculty.assignments.length > 0 ? (
						<div className="space-y-3">
							{faculty.assignments.map((fs) => {
								/*
								 * A3 c17 rows 1-2. The card is now SHAPE-FIRST: the
								 * subject name heads it, the sections beneath it are
								 * grouped by the grade they are actually in, and the
								 * hours line states the total so the badge and the
								 * number a scheduler adds up cannot disagree.
								 *
								 * GRADE RESOLUTION IS AUTHORITY, NOT A FIELD. This used
								 * to read `sec.displayOrder` and, before that,
								 * `sec.gradeLevelId`; EnrollPro re-mints `grade_level_id`,
								 * so a Grade 7 section rendered `GR1`. The one resolver
								 * is `resolveSectionGradeNumber` (A2 c15), which reads
								 * `gradeLevelName` first and only then a real
								 * `displayOrder`. A section it cannot resolve is NOT
								 * given an invented number: it lands in a neutral
								 * "Grade not set" group with no `GradeBadge`, because a
								 * badge IS a claim.
								 */
								const gradeGroups = groupSectionsByResolvedGrade(fs.sections);
								const sectionTotal = fs.sections.length;
								return (
								<div key={fs.id} className="p-3 rounded-xl border border-border bg-background shadow-sm space-y-2.5">
									<div className="flex items-start justify-between gap-2 border-b pb-2 mb-2 border-border/40">
										<div className="min-w-0">
										<p className="text-sm font-bold leading-tight">{fs.subject?.name || 'Unknown Subject'}</p>
										{/* Row 2. The subject CODE line is gone: the request is for the
										    name, and one readable label beats a name over a code the
										    scheduler has to decode. What replaces it is the number the
										    card was missing — what this subject costs THIS teacher. */}
										<p className="text-sm text-muted-foreground">
											{`${sectionTotal} ${sectionTotal === 1 ? 'class' : 'classes'} · ${formatHoursLabel((fs.subject?.minMinutesPerWeek ?? 0) * sectionTotal)} a week`}
											{sectionTotal > 1 && fs.subject?.minMinutesPerWeek
												? ` · ${formatHoursLabel(fs.subject.minMinutesPerWeek)} each`
												: ''}
										</p>
										</div>
										<Badge variant="secondary" className="text-xs font-bold px-1.5 py-0.5 h-5 shrink-0 bg-muted/50">
											{fs.subject?.minMinutesPerWeek ? formatHoursLabel(fs.subject.minMinutesPerWeek) : '-'}
										</Badge>
									</div>
									{gradeGroups.length > 0 ? (
										<div className="space-y-2">
											{gradeGroups.map((group) => (
												<div key={group.key} className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
													<div className="flex items-center gap-1.5">
														{/* The DepEd grade colour is the EXISTING
														    `GradeBadge` -> `GradeLevelBadge` pair. No second
														    colour map is introduced here (§8). */}
														{group.grade != null ? <GradeBadge grade={group.grade} /> : null}
														<span className="text-sm font-semibold text-foreground">
															{group.grade != null ? `Grade ${group.grade}` : 'Grade not set'}
														</span>
													</div>
													{/* Side by side and wrapping, rather than one section per
													    line: a Grade 7 with five sections was five lines of
													    the same answer. */}
													<div className="flex flex-wrap gap-1.5">
														{group.sections.map((sec) => (
															<span
																key={sec.id}
																className="rounded-md border border-border bg-background px-2 py-0.5 text-sm font-medium text-foreground"
															>
																{sec.name}
															</span>
														))}
													</div>
												</div>
											))}
										</div>
									) : (
										<span className="text-sm text-muted-foreground italic">No sections explicitly mapped.</span>
									)}
								</div>
								);
							})}
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
						<h4 className="text-sm font-semibold text-muted-foreground">Adviser and source context</h4>
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