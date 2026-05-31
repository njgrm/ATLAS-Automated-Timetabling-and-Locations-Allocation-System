import {
	ClipboardList,
	User,
	Star
} from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { FacultySummary } from '@/types';
import { Link } from 'react-router-dom';
import { getDepartmentColor } from '@/lib/department-colors';

interface FacultyRowProps {
	faculty: FacultySummary;
	onViewProfile: (faculty: FacultySummary) => void;
}

export function FacultyRow({
	faculty,
	onViewProfile,
}: FacultyRowProps) {
	const subjectCount = faculty.subjectCount ?? 0;
	const weeklyHours = faculty.policyCreditedHours ?? 0;
	const maxHours = faculty.maxHoursPerWeek;
	const loadState = !faculty.isActiveForScheduling
		? 'excluded'
		: weeklyHours === 0 || subjectCount === 0
		? 'no-load'
		: weeklyHours > maxHours || weeklyHours >= maxHours * 0.85
		? 'review'
		: 'within';
	const loadCopy = {
		'excluded': { label: 'Excluded', className: 'border-slate-200 bg-slate-100 text-slate-600', help: 'This teacher is not available for scheduling.' },
		'no-load': { label: 'No teaching load', className: 'border-amber-200 bg-amber-50 text-amber-700', help: 'This active teacher has no load assigned yet.' },
		'review': { label: 'Needs review', className: 'border-amber-200 bg-amber-50 text-amber-700', help: 'This teacher is near or above the weekly load limit.' },
		'within': { label: 'Within load', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', help: 'This teacher has assigned load within the weekly limit.' },
	}[loadState];
	const loadHoursClass =
		loadState === 'no-load' || loadState === 'excluded' ? 'text-muted-foreground'
		: loadState === 'review' ? 'text-amber-600'
		: 'text-emerald-600';

	const deptColor = getDepartmentColor(faculty.department);

	return (
		<tr className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
			<td className="px-4 py-3">
				<Button
					variant="ghost"
					className="h-auto justify-start gap-3 px-0 py-0 text-left hover:bg-transparent"
					onClick={() => onViewProfile(faculty)}
					aria-label={`Open teacher profile for ${faculty.firstName} ${faculty.lastName}`}
				>
					<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary shadow-sm border border-primary/10">
						{faculty.firstName[0]}{faculty.lastName[0]}
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-1.5">
							<p className="font-semibold text-foreground truncate leading-tight">
								{faculty.lastName}, {faculty.firstName}
							</p>
						</div>
						<div className="flex items-center gap-2 mt-0.5">
							{faculty.isClassAdviser && (
								<span className="text-[0.65rem] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 truncate max-w-32">
									<Star className="size-2.5 fill-amber-400 text-amber-500 shrink-0" />
									<span className="truncate">{faculty.advisedSectionName ? `Adviser: ${faculty.advisedSectionName}` : 'Adviser'}</span>
								</span>
							)}
							<p className="text-[0.6rem] text-muted-foreground font-mono truncate uppercase tracking-tighter opacity-70">
								#{faculty.employeeId || 'NO-ID'}
							</p>
						</div>
					</div>
				</Button>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col gap-1">
					<div className="flex items-center">
						<Badge variant="outline" className={`text-[0.65rem] font-semibold py-0 h-5 px-1.5 border-opacity-50 ${deptColor.bg} ${deptColor.text} ${deptColor.border}`}>
							{faculty.department || 'GENERAL'}
						</Badge>
					</div>
					{faculty.specialization && (
						<span className="text-[0.65rem] text-muted-foreground truncate font-medium pl-0.5">
							{faculty.specialization}
						</span>
					)}
				</div>
			</td>
			<td className="px-4 py-3 text-center">
				<div className="flex flex-col items-center gap-1">
					<Badge className={subjectCount > 0 ? 'bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-50 shadow-none border-blue-100' : 'bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-50 shadow-none border-amber-100'}>
						{subjectCount} subject{subjectCount === 1 ? '' : 's'}
					</Badge>
					<span className="text-[0.65rem] text-muted-foreground font-medium">{faculty.sectionCount ?? 0} section{(faculty.sectionCount ?? 0) === 1 ? '' : 's'}</span>
				</div>
			</td>
			<td className="px-4 py-3 text-center">
				<div className="flex flex-col items-center">
					<span className={`text-sm font-semibold tabular-nums ${loadHoursClass}`}>
						{weeklyHours > 0 ? `${weeklyHours}h` : '-'}
					</span>
					<span className="text-[0.7rem] text-muted-foreground font-medium">/ {maxHours}h limit</span>
				</div>
			</td>
			<td className="px-4 py-3 text-center">
				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge variant="outline" className={`cursor-help text-[0.7rem] font-bold shadow-none ${loadCopy.className}`}>{loadCopy.label}</Badge>
						</TooltipTrigger>
						<TooltipContent className="max-w-60 text-xs leading-relaxed">{loadCopy.help}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</td>
			<td className="px-4 py-3 text-right">
				<div className="flex justify-end items-center gap-2">
					<TooltipProvider delayDuration={300}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-8 text-muted-foreground hover:text-primary"
									onClick={() => onViewProfile(faculty)}
									aria-label={`Review roster profile for ${faculty.firstName} ${faculty.lastName}`}
								>
									<User className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Review roster profile</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<Link to={`/teaching-load?facultyId=${faculty.id}`} aria-label={`Review teaching load for ${faculty.firstName} ${faculty.lastName}`}>
						<Button variant="outline" size="sm" className="h-8 gap-2 text-xs font-bold">
							<ClipboardList className="size-3.5" />
							Review teaching load
						</Button>
					</Link>
				</div>
			</td>
		</tr>
	);
}