import type { ReactNode } from 'react';
import { BookOpen, Star } from 'lucide-react';

import { getDepartmentColor } from '@/lib/department-colors';
import {
	deriveLoadStatus,
	getFacultyLoadSortRank,
	STANDARD_WEEKLY_TEACHING_HOURS,
} from '@/lib/faculty-assignment-helpers';
import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { FacultySummary } from '@/types';

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
		'no-load': { label: 'No teaching load', badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700', help: 'This active teacher has no load assigned yet.' },
		'below-standard': { label: loadStatus.label, badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700', help: `This teacher is below the ${STANDARD_WEEKLY_TEACHING_HOURS}h standard and can still receive assignments.` },
		'above-standard': { label: loadStatus.label, badgeClassName: 'border-orange-200 bg-orange-50 text-orange-700', help: `This teacher is above the ${STANDARD_WEEKLY_TEACHING_HOURS}h standard and still within the ${maxHours}h cap.` },
		'over-cap': { label: loadStatus.label, badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700', help: `This teacher exceeds the ${maxHours}h cap and must be repaired before generation.` },
		within: { label: loadStatus.label, badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700', help: `This teacher is exactly at the ${STANDARD_WEEKLY_TEACHING_HOURS}h standard.` },
	}[loadState];

	const hoursClassName =
		loadState === 'no-load' || loadState === 'excluded' ? 'text-muted-foreground'
		: loadState === 'over-cap' ? 'text-rose-600'
		: loadState === 'above-standard' ? 'text-orange-600'
		: loadState === 'below-standard' ? 'text-amber-600'
		: 'text-emerald-600';

	return { ...copy, hoursClassName };
}

export function FacultyIdentityCell({ faculty }: { faculty: FacultySummary }) {
	return (
		<div className="flex min-w-0 items-center gap-3">
			<div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary/10 text-sm font-bold text-primary shadow-sm">
				{faculty.firstName[0]}{faculty.lastName[0]}
			</div>
			<div className="min-w-0 space-y-1">
				<div className="flex min-w-0 items-center gap-2">
					<p className="truncate font-semibold leading-tight text-foreground">{faculty.lastName}, {faculty.firstName}</p>
					{faculty.isPlaceholder && <Badge variant="outline" className="h-5 border-violet-200 bg-violet-50 text-[0.6rem] font-bold text-violet-700">Teacher X</Badge>}
				</div>
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					{faculty.isClassAdviser && (
						<span className="flex max-w-44 items-center gap-1 truncate rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[0.65rem] font-bold text-amber-700">
							<Star className="size-2.5 shrink-0 fill-amber-400 text-amber-500" />
							<span className="truncate">{faculty.advisedSectionName ? `Adviser: ${faculty.advisedSectionName}` : 'Adviser'}</span>
						</span>
					)}
					<span className="truncate font-mono text-[0.65rem] uppercase tracking-tighter text-muted-foreground/80">#{faculty.employeeId || 'ID pending'}</span>
				</div>
			</div>
		</div>
	);
}

export function FacultyDepartmentCell({ faculty }: { faculty: FacultySummary }) {
	const deptColor = getDepartmentColor(faculty.department);

	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<div className="flex items-center gap-2">
				<Badge variant="outline" className={cn('h-5 border-opacity-50 px-1.5 py-0 text-[0.65rem] font-semibold', deptColor.bg, deptColor.text, deptColor.border)}>
					{faculty.department || 'GENERAL'}
				</Badge>
				<Badge variant="outline" className={cn('h-5 px-1.5 py-0 text-[0.6rem] font-bold', faculty.isActiveForScheduling ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600')}>
					{faculty.isActiveForScheduling ? 'Active' : 'Excluded'}
				</Badge>
			</div>
			<span className="truncate pl-0.5 text-[0.68rem] font-medium text-muted-foreground">{faculty.specialization || 'No specialization listed'}</span>
		</div>
	);
}

export function FacultyTeachingLoadCell({ faculty }: { faculty: FacultySummary }) {
	const subjectCount = faculty.subjectCount ?? 0;
	const sectionCount = faculty.sectionCount ?? 0;

	return (
		<div className="flex flex-col items-center gap-1 text-center">
			<Badge className={cn('text-xs font-bold shadow-none', subjectCount > 0 ? 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50' : 'border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-50')}>
				<BookOpen className="mr-1 size-3" />
				{subjectCount} subject{subjectCount === 1 ? '' : 's'}
			</Badge>
			<span className="text-[0.65rem] font-medium text-muted-foreground">{sectionCount} section{sectionCount === 1 ? '' : 's'}</span>
		</div>
	);
}

export function FacultyWeeklyLoadCell({ faculty }: { faculty: FacultySummary }) {
	const weeklyHours = faculty.policyCreditedHours ?? 0;
	const presentation = getFacultyLoadPresentation(faculty);

	return (
		<div className="flex flex-col items-center text-center">
			<span className={cn('text-sm font-semibold tabular-nums', presentation.hoursClassName)}>{weeklyHours > 0 ? `${weeklyHours}h` : '-'}</span>
			<span className="text-[0.7rem] font-medium text-muted-foreground">/ {faculty.maxHoursPerWeek}h cap</span>
		</div>
	);
}

export function FacultyLoadStateBadge({ faculty }: { faculty: FacultySummary }) {
	const presentation = getFacultyLoadPresentation(faculty);
	const weeklyHours = faculty.policyCreditedHours ?? 0;

	return (
		<TooltipProvider delayDuration={300}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge variant="outline" className={cn('cursor-help text-[0.7rem] font-bold shadow-none', presentation.badgeClassName)}>
						{presentation.label} {weeklyHours > 0 ? `· ${weeklyHours}h` : ''}
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
	return (
		<div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 shadow-sm">
			<div className="flex items-start justify-between gap-3">
				<FacultyIdentityCell faculty={faculty} />
				{secondaryActionMenu}
			</div>
			<div className="mt-4 grid grid-cols-2 gap-3 text-sm">
				<div className="space-y-1">
					<p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Department</p>
					<FacultyDepartmentCell faculty={faculty} />
				</div>
				<div className="space-y-1 text-right">
					<p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Credited workload</p>
					<FacultyWeeklyLoadCell faculty={faculty} />
				</div>
			</div>
			<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3">
				<FacultyTeachingLoadCell faculty={faculty} />
				<FacultyLoadStateBadge faculty={faculty} />
			</div>
			{primaryAction && <div className="mt-4">{primaryAction}</div>}
		</div>
	);
}