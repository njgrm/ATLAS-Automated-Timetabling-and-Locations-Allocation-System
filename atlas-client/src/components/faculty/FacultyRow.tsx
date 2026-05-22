import {
	CheckCircle2,
	ClipboardList,
	ExternalLink,
	MoreVertical,
	User,
} from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { FacultyMirror } from '@/types';
import { Link } from 'react-router-dom';

interface FacultyRowProps {
	faculty: FacultyMirror;
	onViewProfile: (faculty: FacultyMirror) => void;
}

export function FacultyRow({
	faculty,
	onViewProfile,
}: FacultyRowProps) {
	const subjectCount = faculty.facultySubjects?.length ?? 0;
	const weeklyMinutes = (faculty.facultySubjects ?? []).reduce(
		(sum, fs) => sum + (fs.subject?.minMinutesPerWeek ?? 0) * fs.gradeLevels.length, 0,
	);
	const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;
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
						<p className="font-semibold text-foreground truncate">
							{faculty.lastName}, {faculty.firstName}
						</p>
						<p className="text-[0.65rem] text-muted-foreground font-mono truncate">
							ID: {faculty.employeeId || 'No ID'}
						</p>
					</div>
				</div>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col gap-0.5">
					{faculty.department ? (
						<span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-bold">
							{faculty.department}
						</span>
					) : null}
					<span className="text-xs font-medium text-foreground truncate">
						{faculty.specialization || (faculty.department ? 'Generalist' : '-')}
					</span>
				</div>
			</td>
			<td className="px-4 py-3">
				<span className="text-xs text-muted-foreground truncate block max-w-40">
					{faculty.contactInfo ?? '-'}
				</span>
			</td>
			<td className="px-4 py-3 text-center">
				{subjectCount > 0 ? (
					<Badge className="bg-blue-100 text-blue-700 text-[0.6rem] hover:bg-blue-100 shadow-none border-none">
						{subjectCount}
					</Badge>
				) : (
					<Badge variant="secondary" className="text-[0.6rem] shadow-none bg-muted/50">0</Badge>
				)}
			</td>
			<td className="px-4 py-3 text-center">
				<div className="flex flex-col items-center">
					<span className={`text-xs font-bold ${loadColor}`}>
						{weeklyHours > 0 ? `${weeklyHours}h` : '-'}
					</span>
					<span className="text-[0.625rem] text-muted-foreground">/ {maxHours}h limit</span>
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
					<Badge variant="secondary" className="text-[0.6rem] shadow-none bg-muted/50">Excluded</Badge>
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

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
								<MoreVertical className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem asChild>
								<Link to={`/assignments?facultyId=${faculty.id}`} className="flex items-center">
									<ClipboardList className="mr-2 size-4" />
									<span>Edit Teaching Load</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onViewProfile(faculty)}>
								<User className="mr-2 size-4" />
								<span>View Full Profile</span>
							</DropdownMenuItem>
							<DropdownMenuItem disabled className="text-muted-foreground/50">
								<ExternalLink className="mr-2 size-4" />
								<span>View in EnrollPro</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</td>
		</tr>
	);
}
