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
import type { FacultySummary, FacultyAssignmentRecord, ExternalSection } from '@/types';

/** Valid JHS grade levels for Philippine Junior High School. */
const VALID_JHS_GRADES = new Set([7, 8, 9, 10]);

/**
 * Extract the academic grade number from an ExternalSection.
 * Priority: gradeLevelName → displayOrder → gradeLevelId.
 * Returns null if no valid JHS grade (7–10) can be determined.
 */
function getSectionGradeNumber(section: ExternalSection): number | null {
	// 1. Parse gradeLevelName (e.g. "Grade 7", "GR8", "Grade 10")
	const nameMatch = (section.gradeLevelName ?? '').match(/(\d+)/);
	if (nameMatch) {
		const n = Number(nameMatch[1]);
		if (VALID_JHS_GRADES.has(n)) return n;
	}
	// 2. Use displayOrder if it's a valid JHS grade
	if (VALID_JHS_GRADES.has(section.displayOrder)) return section.displayOrder;
	// 3. Use gradeLevelId only if it's directly a valid JHS grade
	if (VALID_JHS_GRADES.has(section.gradeLevelId)) return section.gradeLevelId;
	return null;
}

/** Format a section's grade as "GR7", "GR8", etc. Returns "" for unknown grades. */
function formatSectionGradeLabel(section: ExternalSection): string {
	const n = getSectionGradeNumber(section);
	return n != null ? `GR${n}` : '';
}

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

type SectionInfo = {
	id: number;
	name: string;
	gradeLabel: string;
};

type SubjectSummary = {
	code: string;
	name: string;
	sectionCount: number;
	gradeRange: string;
	sections: SectionInfo[];
};

function buildSubjectSummaries(assignments: FacultyAssignmentRecord[]): SubjectSummary[] {
	return assignments
		.filter((a) => a.sections.length > 0 || (a.subject?.code))
		.map((a) => {
			const sortedSections = [...a.sections].sort((x, y) => (x.displayOrder ?? 0) - (y.displayOrder ?? 0));
			const sectionInfos: SectionInfo[] = sortedSections.map((s) => ({
				id: s.id,
				name: s.name,
				gradeLabel: formatSectionGradeLabel(s),
			}));
			const gradeNums = [...new Set(a.sections.map((s) => getSectionGradeNumber(s)).filter((n): n is number => n != null))].sort((x, y) => x - y);
			const gradeRange = gradeNums.length === 0
				? ''
				: gradeNums.length === 1
				? `GR${gradeNums[0]}`
				: `GR${gradeNums[0]}–GR${gradeNums[gradeNums.length - 1]}`;
			return {
				code: a.subject?.code ?? `SUBJ#${a.subjectId}`,
				name: a.subject?.name ?? '',
				sectionCount: a.sections.length,
				gradeRange,
				sections: sectionInfos,
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

	if (summaries.length === 0) {
		return <span className="text-xs text-muted-foreground">No classes assigned</span>;
	}

	// Single subject: show code + section names
	if (summaries.length === 1) {
		const s = summaries[0];
		const shownSections = s.sections.slice(0, 2);
		const remaining = s.sections.length - shownSections.length;

		return (
			<div className="text-xs text-foreground leading-tight">
				<span className="font-semibold">{s.code}</span>
				{' · '}
				<span className="text-muted-foreground">{s.sectionCount} section{s.sectionCount === 1 ? '' : 's'}</span>
				{s.sections.length > 0 && (
					<div className="mt-0.5 text-muted-foreground">
						{shownSections.map((sec, i) => (
							<span key={sec.id}>
								{i > 0 && <span>, </span>}
								{sec.gradeLabel} {sec.name}
							</span>
						))}
						{remaining > 0 && <span> +{remaining}</span>}
					</div>
				)}
				<AssignmentBreakdownPopover assignments={assignments} />
			</div>
		);
	}

	// Multiple subjects: show up to two + overflow, with first section as discriminator
	const shown = summaries.slice(0, 2);
	const remaining = summaries.length - shown.length;
	const firstSections = summaries[0]?.sections.slice(0, 2) ?? [];
	const firstRemaining = (summaries[0]?.sections.length ?? 0) - firstSections.length;

	return (
		<div className="text-xs text-foreground leading-tight">
			<div>
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
			</div>
			{firstSections.length > 0 && (
				<div className="mt-0.5 text-muted-foreground">
					<span>First: </span>
					{firstSections.map((sec, i) => (
						<span key={sec.id}>
							{i > 0 && <span>, </span>}
							{sec.gradeLabel} {sec.name}
						</span>
					))}
					{firstRemaining > 0 && <span> +{firstRemaining}</span>}
				</div>
			)}
			<AssignmentBreakdownPopover assignments={assignments} />
		</div>
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
				<div className="mt-2 text-xs text-muted-foreground leading-tight">
					{summaries.length === 1
						? <>
							<span><span className="font-semibold text-foreground">{summaries[0].code}</span> · {summaries[0].sectionCount} section{summaries[0].sectionCount === 1 ? '' : 's'}</span>
							{summaries[0].sections.length > 0 && (
								<div className="mt-0.5">
									{summaries[0].sections.slice(0, 2).map((sec, i) => (
										<span key={sec.id} className="text-foreground/70">
											{i > 0 && ', '}
											{sec.gradeLabel} {sec.name}
										</span>
									))}
									{summaries[0].sections.length > 2 && <span> +{summaries[0].sections.length - 2}</span>}
								</div>
							)}
						</>
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
