import type { ReactNode } from 'react';
import { BookOpen, Star } from 'lucide-react';

import {
	deriveLoadStatus,
	getFacultyLoadSortRank,
	STANDARD_WEEKLY_TEACHING_HOURS,
} from '@/lib/faculty-assignment-helpers';
import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { AccessibleInfo } from '@/components/smart/AccessibleInfo';
import { TEACHER_X_LABEL } from '@/lib/deped-glossary';
import { gradeLabel } from '@/lib/grade-labels';
import type { FacultySummary, FacultyAssignmentRecord } from '@/types';

type LoadPresentation = {
	label: string;
	help: string;
	badgeClassName: string;
	hoursClassName: string;
};

export function getFacultyLoadPresentation(faculty: FacultySummary): LoadPresentation {
	const weeklyHours = faculty.policyCreditedHours ?? 0;
	const maxHours = faculty.maxHoursPerWeek;
	const loadStatus = deriveLoadStatus(weeklyHours);
	const loadRank = getFacultyLoadSortRank(faculty);
	const loadState = loadRank === 5
		? 'excluded'
		: loadRank === 4
		? 'no-load'
		: loadRank === 0
		? 'over-cap'
		: loadRank === 1
		? 'above-standard'
		: loadRank === 3
		? 'below-standard'
		: 'within';

	const copy = {
		excluded: { label: 'Excluded', badgeClassName: 'border-slate-200 bg-slate-100 text-slate-600', help: 'This teacher is not available for scheduling.' },
		'no-load': { label: 'No load', badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700', help: 'This active teacher has no load assigned yet.' },
		'below-standard': { label: 'Below standard', badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700', help: `This teacher is below the ${STANDARD_WEEKLY_TEACHING_HOURS}h standard and can still receive assignments.` },
		'above-standard': { label: 'Near cap', badgeClassName: 'border-orange-200 bg-orange-50 text-orange-700', help: `This teacher is above the ${STANDARD_WEEKLY_TEACHING_HOURS}h standard and still within the ${maxHours}h cap.` },
		'over-cap': { label: 'Over cap', badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700', help: `This teacher exceeds the ${maxHours}h cap. Move classes before generating the timetable.` },
		within: { label: 'Ready', badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700', help: `This teacher is at the ${STANDARD_WEEKLY_TEACHING_HOURS}h standard.` },
	}[loadState];

	const hoursClassName =
		loadState === 'no-load' || loadState === 'excluded' ? 'text-muted-foreground'
		: loadState === 'over-cap' ? 'text-rose-600'
		: loadState === 'above-standard' ? 'text-orange-600'
		: loadState === 'below-standard' ? 'text-amber-600'
		: 'text-emerald-600';

	return { ...copy, hoursClassName };
}

/** Compact load status label for the badge. */
export function getCompactLoadLabel(faculty: FacultySummary): string {
	return getFacultyLoadPresentation(faculty).label;
}

export function FacultyIdentityCell({ faculty }: { faculty: FacultySummary }) {
	const isPlaceholder = faculty.isPlaceholder;
	return (
		<div className="flex min-w-0 items-center gap-3">
			<div className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold shadow-sm ${isPlaceholder ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-primary/10 bg-primary/10 text-primary'}`}>
				{faculty.firstName?.[0] ?? ''}{faculty.lastName?.[0] ?? ''}
			</div>
			<div className="min-w-0">
				<div className="flex min-w-0 items-center gap-2">
					<p className="truncate font-semibold leading-tight text-foreground">{faculty.lastName}, {faculty.firstName}</p>
					{isPlaceholder && (
						<>
							<Badge variant="outline" className="h-4 px-1.5 text-[0.65rem] font-bold border-violet-200 bg-violet-50 text-violet-700">Temporary</Badge>
							<AccessibleInfo
								label={`Temporary teacher ${faculty.lastName}, ${faculty.firstName}`}
								shortHelp={`${TEACHER_X_LABEL}. Replace this temporary record before publishing the timetable.`}
								size="icon-xs"
							/>
						</>
					)}
				</div>
				{faculty.isClassAdviser && (
					<span className="mt-0.5 flex max-w-44 items-center gap-1 truncate text-xs text-muted-foreground">
						<Star className="size-2.5 shrink-0 fill-amber-400 text-amber-500" />
						<span className="truncate">{faculty.advisedSectionName ? `Adviser: ${faculty.advisedSectionName}` : 'Adviser'}</span>
					</span>
				)}
			</div>
		</div>
	);
}

type SubjectSummary = {
	code: string;
	name: string;
	sectionCount: number;
	gradeRange: string;
};

function buildSubjectSummaries(assignments: FacultyAssignmentRecord[]): SubjectSummary[] {
	return assignments
		.filter((a) => a.sections.length > 0 || (a.subject?.code))
		.map((a) => {
			const grades = [...new Set(a.sections.map((s) => s.gradeLevelId))].sort((a, b) => a - b);
			const gradeRange = grades.length === 0
				? ''
				: grades.length === 1
				? gradeLabel(grades[0])
				: `${gradeLabel(grades[0])}–${gradeLabel(grades[grades.length - 1])}`;
			return {
				code: a.subject?.code ?? `SUBJ#${a.subjectId}`,
				name: a.subject?.name ?? '',
				sectionCount: a.sections.length,
				gradeRange,
			};
		})
		.filter((s) => s.sectionCount > 0 || s.code);
}

function AssignmentBreakdownPopover({ assignments }: { assignments: FacultyAssignmentRecord[] }) {
	const summaries = buildSubjectSummaries(assignments);
	if (summaries.length === 0) return null;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors align-middle ml-0.5"
					aria-label="View full class breakdown"
				>
					<BookOpen className="size-3" />
				</button>
			</PopoverTrigger>
			<PopoverContent side="bottom" className="w-72 p-3 text-xs" align="start">
				<p className="mb-2 font-bold uppercase tracking-wider text-muted-foreground">Assigned classes</p>
				<div className="space-y-1.5">
					{summaries.map((s) => (
						<div key={s.code} className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-1.5 min-w-0">
								<Badge variant="outline" className="h-4 shrink-0 px-1 text-[0.6rem] font-bold">{s.code}</Badge>
								{s.gradeRange && <span className="text-muted-foreground">{s.gradeRange}</span>}
							</div>
							<span className="shrink-0 font-semibold tabular-nums">{s.sectionCount} section{s.sectionCount === 1 ? '' : 's'}</span>
						</div>
					))}
				</div>
				{assignments.some((a) => a.sections.length === 0 && a.subject?.code) && (
					<div className="mt-2 border-t border-border/50 pt-2">
						<p className="text-muted-foreground">No sections yet:</p>
						<div className="flex flex-wrap">
							{assignments
								.filter((a) => a.sections.length === 0 && a.subject?.code)
								.map((a) => (
									<Badge key={a.id} variant="outline" className="mr-1 mt-1 h-4 px-1 text-[0.6rem] font-bold">{a.subject.code}</Badge>
								))}
						</div>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}

export function FacultyAssignedClassesCell({ faculty }: { faculty: FacultySummary }) {
	const assignments = faculty.assignments ?? [];
	const summaries = buildSubjectSummaries(assignments);
	const totalSections = summaries.reduce((sum, s) => sum + s.sectionCount, 0);

	if (summaries.length === 0) {
		return <span className="text-xs text-muted-foreground">No classes assigned</span>;
	}

	// Single subject: show code + section count
	if (summaries.length === 1) {
		const s = summaries[0];
		return (
			<span className="text-xs text-foreground tabular-nums">
				<span className="font-semibold">{s.code}</span>
				{' '}\u00B7{' '}
				{s.sectionCount} section{s.sectionCount === 1 ? '' : 's'}
				<AssignmentBreakdownPopover assignments={assignments} />
			</span>
		);
	}

	// Multiple subjects: show up to two + overflow
	const shown = summaries.slice(0, 2);
	const remaining = summaries.length - shown.length;

	return (
		<span className="text-xs text-foreground tabular-nums">
			{shown.map((s, i) => (
				<span key={s.code}>
					{i > 0 && <span className="text-muted-foreground">, </span>}
					<span className="font-semibold">{s.code}</span>
					{' '}{s.sectionCount}
				</span>
			))}
			{remaining > 0 && (
				<span className="text-muted-foreground"> +{remaining} more</span>
			)}
			<AssignmentBreakdownPopover assignments={assignments} />
		</span>
	);
}

export function FacultyWeeklyLoadCell({ faculty }: { faculty: FacultySummary }) {
	const weeklyHours = faculty.policyCreditedHours ?? 0;
	const maxHours = faculty.maxHoursPerWeek;
	const presentation = getFacultyLoadPresentation(faculty);
	const isOver = weeklyHours > maxHours;

	return (
		<TooltipProvider delayDuration={300}>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className={cn('text-sm font-semibold tabular-nums cursor-default', presentation.hoursClassName)}>
						{weeklyHours > 0 ? `${weeklyHours} / ${STANDARD_WEEKLY_TEACHING_HOURS}h` : '\u2014'}
						{isOver && <span className="ml-1 text-[0.65rem] font-bold text-rose-600">over</span>}
					</span>
				</TooltipTrigger>
				<TooltipContent className="max-w-52 text-xs leading-relaxed">
					{weeklyHours > 0
						? `${weeklyHours}h credited / ${STANDARD_WEEKLY_TEACHING_HOURS}h standard (max ${maxHours}h)`
						: `No load assigned. Standard is ${STANDARD_WEEKLY_TEACHING_HOURS}h, max ${maxHours}h.`}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function FacultyLoadStateBadge({ faculty }: { faculty: FacultySummary }) {
	const presentation = getFacultyLoadPresentation(faculty);

	return (
		<TooltipProvider delayDuration={300}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge variant="outline" className={cn('cursor-help text-xs font-bold shadow-none', presentation.badgeClassName)}>
						{presentation.label}
					</Badge>
				</TooltipTrigger>
				<TooltipContent className="max-w-60 text-xs leading-relaxed">{presentation.help}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function FacultyMobileCard({
	faculty,
	primaryAction,
	secondaryActionMenu,
}: {
	faculty: FacultySummary;
	primaryAction?: ReactNode;
	secondaryActionMenu?: ReactNode;
}) {
	const weeklyHours = faculty.policyCreditedHours ?? 0;
	const presentation = getFacultyLoadPresentation(faculty);
	const assignments = faculty.assignments ?? [];
	const summaries = buildSubjectSummaries(assignments);

	return (
		<div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-sm" data-testid="teacher-mobile-card">
			<div className="flex items-start justify-between gap-3">
				<FacultyIdentityCell faculty={faculty} />
				{secondaryActionMenu}
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
				<FacultyLoadStateBadge faculty={faculty} />
				<span className={cn('font-semibold tabular-nums', presentation.hoursClassName)}>
					{weeklyHours > 0 ? `${weeklyHours} / ${STANDARD_WEEKLY_TEACHING_HOURS}h` : '\u2014'}
				</span>
			</div>
			{summaries.length > 0 && (
				<div className="mt-2 text-xs text-muted-foreground">
					{summaries.length === 1
						? <span><span className="font-semibold text-foreground">{summaries[0].code}</span> \u00B7 {summaries[0].sectionCount} section{summaries[0].sectionCount === 1 ? '' : 's'}</span>
						: <span>{summaries.slice(0, 2).map((s) => `${s.code} ${s.sectionCount}`).join(', ')}{summaries.length > 2 ? ` +${summaries.length - 2} more` : ''}</span>
					}
				</div>
			)}
			{primaryAction && <div className="mt-3">{primaryAction}</div>}
		</div>
	);
}

// Keep the old export name for backward compat with any remaining imports.
export { FacultyAssignedClassesCell as FacultyTeachingLoadCell };
