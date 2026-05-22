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
					<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
						{faculty.firstName[0]}{faculty.lastName[0]}
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-1.5">
							<p className="font-semibold text-foreground truncate">
								{faculty.lastName}, {faculty.firstName}
							</p>
						</div>
						<div className="flex items-center gap-2 mt-0.5">
							<p className="text-xs text-muted-foreground font-mono truncate">
								ID: {faculty.employeeId || 'No ID'}
							</p>
							{faculty.isClassAdviser && (
								<span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 truncate max-w-32">
									<Star className="size-3 fill-amber-400 text-amber-500 shrink-0" />
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
						<span className="text-xs text-muted-foreground truncate">
							{faculty.specialization}
						</span>
					)}
				</div>
			</td>
			<td className="px-4 py-3 text-center">
				{subjectCount > 0 ? (
					<Badge className="bg-blue-100 text-blue-700 text-xs hover:bg-blue-100 shadow-none border-none">
						{subjectCount}
					</Badge>
				) : (
					<Badge variant="secondary" className="text-xs shadow-none bg-muted/50">0</Badge>
				)}
			</td>
			<td className="px-4 py-3 text-center">
				<div className="flex flex-col items-center">
					<span className={`text-sm font-bold ${loadColor}`}>
						{weeklyHours > 0 ? `${weeklyHours}h` : '-'}
					</span>
					<span className="text-xs text-muted-foreground">/ {maxHours}h limit</span>
				</div>
			</td>
			<td className="px-4 py-3 text-center">
				{faculty.isActiveForScheduling ? (
					<TooltipProvider delayDuration={300}>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex justify-center">
									<CheckCircle2 className="size-4 text-emerald-500" />
								</div>
							</TooltipTrigger>
							<TooltipContent>Active for scheduling</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : (
					<TooltipProvider delayDuration={300}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Badge variant="secondary" className="text-xs shadow-none bg-muted/50 cursor-help">Excluded</Badge>
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
								<Link to={`/assignments?facultyId=${faculty.id}`}>
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