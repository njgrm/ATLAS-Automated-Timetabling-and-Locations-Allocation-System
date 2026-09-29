import {
	BookOpen,
	CalendarDays,
	User,
	Briefcase,
	CheckCircle2,
	AlertTriangle,
	ChevronRight,
	ExternalLink,
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
/*
 * A3 c17 / A6 c10 union (2026-09-29). Both lanes edited this import block on
 * main concurrently, so the merge keeps BOTH sides rather than picking a winner:
 * A6 c10 brought the subject-permission block, A3 c17 brought the placeholder
 * predicate and the grade authority. Neither list may be dropped — the file does
 * not compile without either one.
 */
import { TeacherSubjectPermissions } from '@/components/faculty/TeacherSubjectPermissions';
import { useSubjectPermissions } from '@/hooks/useSubjectPermissions';
import { useSchoolSubjects } from '@/hooks/useSchoolSubjects';
import {
	formatFacultyDisplayName,
	formatFacultyInitials,
	isPlaceholderSentinelName,
} from '@/components/faculty/teacherNameDisplay';
import { resolveSectionGradeNumber } from '@/lib/schedule-review-helpers';
import { countSubjectGroups } from '@/lib/rotation-subject-count';
import { STANDARD_WEEKLY_TEACHING_HOURS } from '@/lib/faculty-assignment-helpers';
import { departmentLabel } from '@/lib/deped-glossary';
import { buildTeacherWorkloadView } from '@/components/faculty/teacherWorkloadProfile';
import { StackedWorkloadBar } from '@/components/faculty-assignments/StackedWorkloadBar';
import type { FacultyRowRepairIntent } from '@/components/faculty/FacultyRowActions';

/**
 * Weekly hours as a NUMBER at one decimal — the precision the per-section badge
 * already used, and the same rounding as before (`Math.round(h * 10) / 10`).
 *
 * A3 c17 row 2, settled by C3-FIX. History, because the wrong turn is the
 * instructive part:
 *
 *   1. The first cut rounded the subject TOTAL from raw minutes while the badge
 *      and the "each" figure rounded PER SECTION — "3 classes · 11.3h a week"
 *      beside "3.8h each", where 3 × 3.8 is 11.4.
 *   2. C3 "fixed" it by deriving the total from the ROUNDED per-section figure.
 *      That made the identity hold on screen and the NUMBER WRONG: 8 sections
 *      of a 225-minute subject is a real load of 1800 minutes = 30.0 hours, and
 *      the card read "30.4h a week" because 3.75 was rounded up to 3.8 eight
 *      times. Worse, the same card's server-fed "Current weekly hours" line said
 *      30h, so the dialog contradicted itself on a row the requester titled
 *      "hours that add up".
 *
 * The settled rule: the TOTAL is always the exact sum of the actual minutes, and
 * the per-section CLAUSE yields — it never states an hours figure that fails to
 * reproduce the total it sits beside. Truth first, and the friendly form only
 * where it is also true.
 */
function toWeeklyHours(minutes: number): number {
	return Math.round((minutes / 60) * 10) / 10;
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
	 * A3 teacher-one (2026-09-30) — the row's repair intent this dialog was
	 * opened with. The footer's `Edit in Teaching Load` link reproduces the exact
	 * `facultyId` + `task=` pair the old row link and the deleted workload modal
	 * both produced, so A6's routing receives the same intent. Null when the
	 * caller supplied none (e.g. the assigned-classes cell opens without one).
	 */
	intent?: FacultyRowRepairIntent | null;
	/**
	 * Fix 25. When this dialog is opened as the in-page "Review teachers"
	 * surface, the primary action is a repair route rather than a second
	 * profile view. `onReviewLoad` is optional so an unmigrated caller keeps
	 * working; when absent, the internal `/teaching-load` Link is rendered.
	 */
	onReviewLoad?: (faculty: FacultySummary) => void;
	/** Label for the primary action. Defaults to "Review teaching load". */
	reviewLabel?: string;
	/**
	 * A6 c10 — the subject-permission handle, owned by the PAGE.
	 *
	 * The page owns it because `Review coverage` on `/subjects` edits the SAME list
	 * (A8 c4 contract §4) and must see a grant the profile just made without a
	 * reload. Passing a handle rather than a teacher id keeps one reader for one
	 * table; the panel itself is presentational.
	 */
	permissions: ReturnType<typeof useSubjectPermissions> | null;
	/** The actor's school. Required for every permission read and write. */
	schoolId?: number | null;
	/** The page's write gate; a read-only workspace offers no permission control. */
	writeBlockedReason?: string | null;
	/** Called after a permission write, so the page re-reads its own roster. */
	onPermissionsChanged?: () => void;
}

export function FacultyProfileSheet({
	faculty,
	open,
	onOpenChange,
	sourceFreshness,
	intent,
	onReviewLoad,
	reviewLabel = 'Review teaching load',
	permissions,
	schoolId,
	writeBlockedReason,
	onPermissionsChanged,
}: FacultyProfileSheetProps) {
	/*
	 * A6 c10 — the permission handle and its subject list, read HERE because the
	 * sheet is the only thing that knows a profile is open. `enabled` is the open
	 * state, so a closed profile reads nothing: the permission route is a read per
	 * (teacher, school) and re-reading it for a dialog nobody is looking at is a
	 * request with no reader.
	 */
	const permissionHandle = useSubjectPermissions({
		facultyId: open && faculty ? faculty.id : null,
		schoolId: schoolId ?? null,
		writeBlockedReason,
		onChanged: onPermissionsChanged,
	});
	const subjectList = useSchoolSubjects({ schoolId: schoolId ?? null, enabled: open && Boolean(faculty) });
	const resolvedPermissions = permissions ?? (open && faculty ? permissionHandle : null);

	if (!faculty) return null;

	/*
	 * A5 (2026-09-30) — the "Subjects" stat is rotation-aware.
	 *
	 * The server scalar `faculty.subjectCount` counts catalogue ROWS, so a teacher
	 * holding the Science rotation (SCI_BIO/SCI_CHEM/SCI_ES) read as three
	 * subjects. The assignment rows carry the subject's `rotationFamily`/
	 * `termGroupId`, so the SAME count rule the Subjects page uses collapses the
	 * family to one. The label and markup are unchanged; only the number moves.
	 */
	const subjectCount = countSubjectGroups((faculty.assignments ?? []).map((assignment) => assignment.subject));
	const sectionCount = faculty.sectionCount ?? 0;

	/**
	 * A3 c17 row 3. Read from the ONE shared predicate in `teacherNameDisplay`,
	 * not from `faculty.isPlaceholder` alone, so the badge and the display name
	 * can never disagree about which record is a to-be-hired one.
	 */
	const isPlaceholder = isPlaceholderSentinelName(faculty);

	const deptColor = getDepartmentColor(faculty.department);

	/*
	 * A3 teacher-one (2026-09-30) — THE REVIEW-LOAD FIGURES, ON TOP.
	 *
	 * These are the SAME numbers the deleted workload modal showed, read
	 * through the same `buildTeacherWorkloadView` projection, so the merged
	 * dialog cannot drift from what the modal used to render. `actualTeachingHours`,
	 * the standard, the adviser/other-duty credit and the remaining room all come
	 * from the roster summary; nothing is recomputed from a second authority.
	 *
	 * When the school year has no persisted workload policy the projection reports
	 * a null standard, and the ONE fallback is the shared 30h policy constant —
	 * never an invented per-teacher number.
	 */
	const workload = buildTeacherWorkloadView(faculty);
	const loadProfile = workload.loadProfile;
	if (!loadProfile) return null;
	const teachingStandardHours = workload.teachingStandardHours ?? STANDARD_WEEKLY_TEACHING_HOURS;
	const loadGuidance =
		loadProfile.status === 'over-cap'
			? `This teacher is above their ${faculty.maxHoursPerWeek}h weekly maximum. Move some of their classes to another teacher before making the schedule.`
			: loadProfile.status === 'overload-allowed'
			? `This teacher is above the ${teachingStandardHours}h standard but within their ${faculty.maxHoursPerWeek}h maximum. Check that the department head has agreed.`
			: loadProfile.status === 'below-standard'
			? `This teacher can take more classes (up to the ${teachingStandardHours}h standard).`
			: 'This teacher is at the standard load. Nothing to do.';
	/**
	 * A3 teacher-one §3. The footer link's ONE form, carrying this teacher and the
	 * intent's `task=` — the exact route the deleted modal's deep link used, and
	 * the exact route the old row link produced. A6 owns this routing.
	 */
	const deepLink = `/teaching-load?facultyId=${faculty.id}${intent ? `&task=${intent.task}` : ''}`;

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
				className="flex h-[70vh] min-h-[min(400px,90vh)] min-w-[min(500px,95vw)] w-[min(42rem,95vw)] max-w-[95vw] max-h-[90vh] flex-col gap-0 overflow-hidden p-0"
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
							<div className="flex flex-wrap items-center gap-2">
								{/* Fix 22 (c10 re-issue): canonical `Last, First`, UPPERCASE for
							    display. The stored name is unchanged. */}
								<DialogTitle className="text-xl font-bold truncate" data-testid="faculty-profile-title">
									{formatFacultyDisplayName(faculty)}
								</DialogTitle>
								{faculty.isClassAdviser && (
									<Star className="size-4 fill-amber-400 text-amber-500 shrink-0" />
								)}
								{/*
								 * A3 c17 row 3 — the identity line says one true thing
								 * about this record and nothing else.
								 *
								 * A to-be-hired record has no employee number to show: it is
								 * not an employee, so `#ID-PENDING` was inventing an identity
								 * AND saying "Active teacher" in the same breath. It now
								 * reads `To be hired` in the roster's own Temporary *look* —
								 * the violet outline pair, copied verbatim from
								 * `FacultyRow.tsx:205` so there is one "not a real person
								 * yet" appearance in the app (AGENTS.md §8). Only the SIZE
								 * differs, because this dialog is held to the 14px floor and
								 * `text-[0.65rem]` is 10.4px; row 6 below raises the rest.
								 *
								 * A REAL teacher with no `employeeId` shows NOTHING in this
								 * slot — not an empty `<code>`, not a dash, not the pending
								 * sentinel. A missing field is not a fact worth a chip.
								 *
								 * IT SITS BESIDE THE NAME, not inside `DialogDescription`.
								 * That is a validity fix as much as a layout one:
								 * `DialogDescription` renders a `<p>`, `Badge` renders a
								 * `<div>`, and a `<div>` inside a `<p>` is invalid HTML that
								 * React reports as a hydration error and that a browser is
								 * entitled to re-parent. It also matches the roster, where the
								 * Temporary chip sits beside the name rather than under it.
								 */}
								{isPlaceholder ? (
									<Badge
										variant="outline"
										className="h-auto shrink-0 px-1.5 py-0.5 text-sm font-bold border-violet-200 bg-violet-50 text-violet-700"
									>
										To be hired
									</Badge>
								) : faculty.employeeId ? (
									<code className="shrink-0 text-xs font-mono bg-muted px-1.5 py-0.5 rounded uppercase tracking-tighter opacity-80">
										#{faculty.employeeId}
									</code>
								) : null}
							</div>
							<DialogDescription className="flex flex-wrap items-center gap-2 mt-1">
								{/*
								 * A to-be-hired record is NOT an "Active teacher" and must not
								 * be described as one. `isActiveForScheduling` is true for
								 * placeholders — the slot is schedulable, the person does not
								 * exist yet — so the old branch printed "Active teacher" under
								 * a name that says "to be hired", and the dialog contradicted
								 * itself in two lines.
								 *
								 * The status line is therefore about a real person's
								 * scheduling eligibility, and a placeholder says nothing
								 * here: the `To be hired` chip beside the name already IS its
								 * status, and a second chip saying the same thing is exactly
								 * the "two chips that say the same thing" AGENTS.md §8
								 * forbids. "Excluded from scheduling" and `sourceFreshness`
								 * are untouched for real teachers.
								 */}
								{!isPlaceholder && (faculty.isActiveForScheduling ? (
									<span className="flex items-center gap-1 text-sm font-semibold text-emerald-700">
										<CheckCircle2 className="size-3" /> Active teacher
									</span>
								) : (
									<span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
										<AlertTriangle className="size-3" /> Excluded from scheduling
									</span>
								))}
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
					{/*
					 * A3 teacher-one §2 — LOAD FIGURES ON TOP (Review load).
					 *
					 * Every figure here comes from the ONE shared projection
					 * (`buildTeacherWorkloadView`), which is the same source the
					 * deleted workload modal rendered, so the merged dialog
					 * and the numbers it replaced cannot disagree. The load bar is
					 * the shared `StackedWorkloadBar`, so this surface and the
					 * Teaching Load inspector draw a load the same way (§8).
					 */}
					<div className="space-y-3 rounded-xl border border-border bg-muted/5 p-4" data-testid="teacher-load-summary">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h4 className="text-sm font-semibold text-muted-foreground">Review load</h4>
							<span className="text-sm font-semibold tabular-nums" data-testid="workload-headline">
								{loadProfile.actualTeachingHours}h a week · {teachingStandardHours}h standard
							</span>
						</div>
						<StackedWorkloadBar
							teachingHours={loadProfile.actualTeachingHours}
							creditHours={loadProfile.equivalentHours}
							maxHours={faculty.maxHoursPerWeek}
							standardHours={teachingStandardHours}
							showLegend={false}
						/>
						{loadProfile.equivalentHours > 0 && (
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Adviser and other duties (credit)</span>
								<span className="font-semibold tabular-nums">+{loadProfile.equivalentHours.toFixed(1)}h</span>
							</div>
						)}
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Room for more classes</span>
							<span className="font-bold tabular-nums text-emerald-600" data-testid="workload-remaining">
								{loadProfile.remainingHours.toFixed(1)}h
							</span>
						</div>
						<p className="text-sm text-muted-foreground" data-testid="workload-guidance">{loadGuidance}</p>
					</div>

					<Separator className="opacity-50" />

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

					{/*
					 * A3 teacher-one §2 — the profile's own "Current weekly hours"
					 * card is GONE. Every figure it carried (the total, the
					 * percentage bar, class instruction, advising, ancillary and the
					 * standard/maximum sentence) is now the compact Review-load
					 * block at the TOP of this dialog, read from the one shared
					 * projection; repeating them beside it would be the §8 duplicate
					 * the packet forbids.
					 *
					 * The Subjects / Sections stat cards STAY: they are a roster
					 * census, not a load figure, and A5-RSC-4 (rotation-aware subject
					 * counting) reads them here.
					 */}
					<div className="grid grid-cols-2 gap-4">
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
								/*
								 * A3 c17 C3-FIX. The TOTAL is the exact sum of the actual
								 * minutes — never a rounded intermediate — and the per-section
								 * CLAUSE yields to it.
								 *
								 * The rule that makes both true at once: the friendly
								 * "3.8h each" is printed ONLY when multiplying it by the
								 * visible count reproduces the visible total at the displayed
								 * one-decimal precision. For 225 minutes (3.75h) it does
								 * not, so the clause is omitted entirely rather than stated
								 * in minutes. For 240 minutes (4h) the two agree and the
								 * friendly hours form stays.
								 *
								 * Truth is never traded for tidiness here: the total is the
								 * teacher's real load, and it is the same number the server's
								 * "Current weekly hours" line above reports.
								 */
								const perSectionMinutes = fs.subject?.minMinutesPerWeek ?? 0;
								const perSectionHours = toWeeklyHours(perSectionMinutes);
								const totalHours = toWeeklyHours(perSectionMinutes * sectionTotal);
								// Does the friendly hours figure actually reproduce the total
								// a scheduler can see? Compared at the DISPLAYED precision,
								// because that is the number on the card.
								const hoursClauseReproducesTotal =
									toWeeklyHours(perSectionHours * sectionTotal) === totalHours;
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
										{/*
										 * A3 c17 C3-FIX, planner arbitration (2026-09-29). The TOTAL is
										 * always the exact sum of the real minutes, and it is the same
										 * number the server's "Current weekly hours" line above reports.
										 *
										 * The per-section CLAUSE is printed only when multiplying it by the
										 * visible count reproduces that total at the displayed precision.
										 * When it would not — 225 minutes is 3.75h, so "3.8h each" x 8 is
										 * 30.4 against a real 30h — the clause is DROPPED rather than
										 * restated in minutes. "225 min each" was tried and rejected: a
										 * second unit on one calm card, next to a "3.8h" badge that answers
										 * the same question, is more confusing than saying less. The
										 * requester wrote "and, IF USEFUL, '3.8h each'", which is permission to
										 * omit it. Subtract first.
										 */}
										{`${sectionTotal} ${sectionTotal === 1 ? 'class' : 'classes'} · ${totalHours}h a week`}
										{sectionTotal > 1 && perSectionMinutes && hoursClauseReproducesTotal
											? ` · ${perSectionHours}h each`
											: ''}
									</p>
										</div>
										{/* THE BADGE IS UNCHANGED AND DELIBERATELY SO. It is the
										    requester's literal ask: `fs.subject.minMinutesPerWeek`
										    rendered as an hours figure ("3.8h"), and a per-section
										    figure in its own right. It is NOT part of the totals
										    arithmetic, so it is not forced to agree with the
										    clause beside it. For a 225-minute subject the badge
										    reads "3.8h" while the clause reads "225 min each".
										    Both are true; they are answers to different questions.
										    Flagged in the handoff for arbitration rather than
										    harmonised silently. */}
										<Badge variant="secondary" className="text-xs font-bold px-1.5 py-0.5 h-5 shrink-0 bg-muted/50">
											{perSectionMinutes ? `${perSectionHours}h` : '-'}
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

					{/*
					 * A6 c10 — THE MISSING FRONT DOOR, and the only place on the
					 * product a scheduler can grant a teacher a subject outside their
					 * own department outside the moment a class needs one.
					 *
					 * Codex audit finding 6 (MAJOR): the profile showed department,
					 * subjects, sections, hours and `CLOSE PROFILE`, and no way to
					 * authorize a cross-department teacher at all. Lane C's own fact:
					 * `CrossDepartmentPermission` was READ by five server consumers and
					 * CREATABLE by nothing. This panel is the missing control, and it
					 * edits the same list `Cover this class` writes through the Allow
					 * prompt, because A8 c4's contract makes them the same table.
					 *
					 * It renders NOTHING when the caller has no handle — an unmounted
					 * caller (the in-page `Review teachers` surface on another route)
					 * simply has no permission surface, which is honest, and is not the
					 * same as a panel claiming a teacher has no permissions.
					 */}
						{resolvedPermissions && (
							<>
								<TeacherSubjectPermissions
									permissions={resolvedPermissions}
									subjects={subjectList.subjects}
									subjectsLoading={subjectList.loading}
									facultyVersion={faculty.version}
									facultyName={formatFacultyDisplayName(faculty)}
								/>
								<Separator className="opacity-50" />
							</>
						)}

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

					{/*
					 * A3 teacher-one §3 — the footer is EXACTLY TWO controls.
					 * `Edit in Teaching Load` is the same deep link the deleted
					 * workload modal carried (same route, same params, same label),
					 * and `Close` replaces the old `Close profile`. The former
					 * full-width primary button is gone: it duplicated this link.
					 * There is no `More detail` control anywhere in this dialog.
					 */}
					<div className="pt-4 pb-8 flex flex-col gap-2">
						<Button asChild variant="outline" className="h-10 gap-2 font-bold uppercase tracking-wide text-xs">
							<Link to={deepLink} data-testid="faculty-profile-deep-link">
								<ExternalLink className="size-4" />
								Edit in Teaching Load
							</Link>
						</Button>
						<Button variant="secondary" className="h-10 text-muted-foreground font-bold uppercase tracking-wide text-xs" onClick={() => onOpenChange(false)}>
							Close
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}