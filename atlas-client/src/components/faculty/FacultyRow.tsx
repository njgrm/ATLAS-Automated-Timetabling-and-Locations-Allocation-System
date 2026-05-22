import {
	CheckCircle2,
	ClipboardList,
	User,
	Star
} from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { FacultySummary } from '@/types';
import { Link } from 'react-router-dom';

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
	const loadColor =
		weeklyHours === 0 ? 'text-muted-foreground'
		: weeklyHours > maxHours ? 'text-red-600'
		: weeklyHours >= maxHours * 0.85 ? 'text-amber-600'
		: 'text-emerald-600';

	return (
		<tr className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
			<td className="px-4 py-3">
				<div 
					className="flex items-center gap-3 cursor-pointer" 
					onClick={() => onViewProfile(faculty)}
				>
					<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
						{faculty.firstName[0]}{faculty.lastName[0]}
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-1.5">
							<p className="font-bold text-foreground truncate leading-tight">
								{faculty.lastName}, {faculty.firstName}
							</p>
						</div>
						<div className="flex items-center gap-2 mt-0.5">
							<p className="text-[0.65rem] text-muted-foreground font-mono truncate">
								ID: {faculty.employeeId || 'No ID'}
							</p>
							{faculty.isClassAdviser && (
								<span className="text-[0.65rem] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 truncate max-w-32">
									<Star className="size-2.5 fill-amber-400 text-amber-500 shrink-0" />
									<span className="truncate">{faculty.advisedSectionName ? `Adviser: ${faculty.advisedSectionName}` : 'Adviser'}</span>
								</span>
							)}
						</div>
					</div>
				</div>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col gap-0.5">
					<span className="text-xs font-bold text-foreground truncate uppercase tracking-wider">
						{faculty.department || 'General'}
					</span>
					{faculty.specialization && (
						<span className="text-[0.65rem] text-muted-foreground truncate font-medium">
							{faculty.specialization}
						</span>
					)}
				</div>
			</td>
			<td className="px-4 py-3 text-center">
				{subjectCount > 0 ? (
					<Badge className="bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-50 shadow-none border-blue-100">
						{subjectCount}
					</Badge>
				) : (
					<Badge variant="secondary" className="text-xs font-bold shadow-none bg-muted/50">0</Badge>
				)}
			</td>
			<td className="px-4 py-3 text-center">
				<div className="flex flex-col items-center">
					<span className={`text-sm font-bold tabular-nums ${loadColor}`}>
						{weeklyHours > 0 ? `${weeklyHours}h` : '-'}
					</span>
					<span className="text-[0.7rem] text-muted-foreground font-medium">/ {maxHours}h limit</span>
				</div>
			</td>
			<td className="px-4 py-3 text-center">
				{faculty.isActiveForScheduling ? (
					<TooltipProvider delayDuration={300}>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex justify-center text-emerald-600">
									<CheckCircle2 className="size-4" />
								</div>
							</TooltipTrigger>
							<TooltipContent>Active for scheduling</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : (
					<TooltipProvider delayDuration={300}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Badge variant="secondary" className="text-[0.7rem] font-bold shadow-none bg-muted/50 cursor-help">Excluded</Badge>
							</TooltipTrigger>
							<TooltipContent>Excluded in EnrollPro. Cannot be scheduled.</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}
			</td>
			<td className="px-4 py-3 text-right">
				<div className="flex justify-end items-center gap-1">
					<TooltipProvider delayDuration={300}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-8 text-muted-foreground hover:text-primary"
									onClick={() => onViewProfile(faculty)}
								>
									<User className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Quick Profile</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Link to={`/teaching-load?facultyId=${faculty.id}`}>
									<Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary">
										<ClipboardList className="size-4" />
									</Button>
								</Link>
							</TooltipTrigger>
							<TooltipContent>Manage Teaching Load</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</td>
		</tr>
	);
}