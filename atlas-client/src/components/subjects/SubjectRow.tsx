import { useMemo } from 'react';
import {
	MoreVertical,
	Pencil,
	Trash2,
	Users,
	Archive,
	RotateCcw,
	BookOpen,
} from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { GRADE_COLORS } from '@/lib/grade-labels';
import {
	PROGRAM_SCOPE_BADGE,
	ROOM_TYPE_LABELS,
	SUBJECT_OWNER_BADGE,
	SUBJECT_OWNER_LABELS,
} from '@/lib/subject-constants';
import type { Subject } from '@/types';

interface SubjectRowProps {
	subject: Subject;
	timeMode: 'minutes' | 'hours';
	onEdit: (subject: Subject) => void;
	onDelete: (subject: Subject) => void;
	onArchive: (subject: Subject) => void;
	onReactivate: (subject: Subject) => void;
	onShowCoverage: (subject: Subject) => void;
}

export function SubjectRow({
	subject,
	timeMode,
	onEdit,
	onDelete,
	onArchive,
	onReactivate,
	onShowCoverage,
}: SubjectRowProps) {
	const duration = timeMode === 'minutes' 
		? `${subject.minMinutesPerWeek} min` 
		: `${Math.round((subject.minMinutesPerWeek / 60) * 10) / 10} h`;

	// Consolidate Grade Levels into a stronger signal
	const gradeSummary = useMemo(() => {
		if (!subject.gradeLevels.length) return 'No grades';
		const sorted = [...subject.gradeLevels].sort((a, b) => a - b);
		// Check for range
		if (sorted.length > 2 && sorted[sorted.length - 1] - sorted[0] === sorted.length - 1) {
			return `GR${sorted[0]}–${sorted[sorted.length - 1]}`;
		}
		return sorted.map(g => `GR${g}`).join(', ');
	}, [subject.gradeLevels]);

	return (
		<tr className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
			<td className="px-4 py-3">
				<div className="flex items-center gap-3">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
						<BookOpen className="size-4" />
					</div>
					<div className="flex flex-col min-w-0">
						<span className="font-bold text-foreground leading-tight truncate">{subject.name}</span>
						<code className="text-[0.65rem] font-mono text-muted-foreground uppercase">{subject.code}</code>
					</div>
				</div>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col">
					<span className="text-sm tabular-nums font-bold text-foreground">{duration}</span>
					<span className="text-[0.7rem] text-muted-foreground uppercase tracking-tight">Weekly</span>
				</div>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col">
					<span className="text-xs font-medium text-foreground">
						{ROOM_TYPE_LABELS[subject.preferredRoomType] ?? subject.preferredRoomType}
					</span>
					{subject.requiredFeatures.length > 0 && (
						<span className="text-[0.65rem] text-blue-600 font-bold uppercase">+{subject.requiredFeatures.length} requirements</span>
					)}
				</div>
			</td>
			<td className="px-4 py-3">
				<span className="text-xs font-bold text-foreground bg-muted/60 px-2 py-1 rounded">
					{gradeSummary}
				</span>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col gap-0.5">
					<div className="flex items-center gap-1.5">
						<span className="text-xs font-bold text-foreground truncate">
							{subject.ownerDepartment || 'Unassigned'}
						</span>
					</div>
					<div className="flex flex-wrap gap-1">
						{(subject.programScopes ?? []).map((scope) => (
							<span key={scope} className="text-[0.6rem] text-muted-foreground font-bold uppercase tracking-widest">
								{scope}{subject.programScopes.indexOf(scope) < subject.programScopes.length - 1 ? ' •' : ''}
							</span>
						))}
					</div>
				</div>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col gap-1 items-start">
					{subject.isActive ? (
						<div className="flex items-center gap-1.5 text-emerald-600">
							<div className="size-1.5 rounded-full bg-current" />
							<span className="text-[0.7rem] font-bold uppercase tracking-wider">Active</span>
						</div>
					) : (
						<div className="flex items-center gap-1.5 text-muted-foreground">
							<div className="size-1.5 rounded-full bg-current" />
							<span className="text-[0.7rem] font-bold uppercase tracking-wider">Archived</span>
						</div>
					)}
					{subject.isSeedable && (
						<span className="text-[0.62rem] text-blue-600 font-bold uppercase">Auto-Schedule</span>
					)}
				</div>
			</td>
			<td className="px-4 py-3 text-right">
			<div className="flex justify-end gap-1">
					<TooltipProvider delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-8 text-muted-foreground hover:text-primary"
									onClick={() => onShowCoverage(subject)}
								>
									<Users className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Teacher coverage</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-8 text-muted-foreground hover:text-primary"
									onClick={() => onEdit(subject)}
								>
									<Pencil className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Edit subject</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
								<MoreVertical className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-40">
							{subject.isActive && !subject.isSeedable && (
								<DropdownMenuItem onClick={() => onArchive(subject)}>
									<Archive className="mr-2 size-4" />
									<span>Archive</span>
								</DropdownMenuItem>
							)}
							{!subject.isActive && (
								<DropdownMenuItem onClick={() => onReactivate(subject)}>
									<RotateCcw className="mr-2 size-4" />
									<span>Reactivate</span>
								</DropdownMenuItem>
							)}
							{!subject.isSeedable && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem 
										onClick={() => onDelete(subject)}
										className="text-red-600 focus:text-red-600"
									>
										<Trash2 className="mr-2 size-4" />
										<span>Delete</span>
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</td>
		</tr>
	);
}
