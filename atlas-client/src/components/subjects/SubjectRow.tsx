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
	SUBJECT_OWNER_LABELS,
} from '@/lib/subject-constants';
import { getDepartmentColor } from '@/lib/department-colors';
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

	const deptColor = getDepartmentColor(subject.ownerDepartment);
	const rotationTermLabel = useMemo(() => {
		const explicit = (subject.rotationTermLabel ?? '').trim();
		if (explicit.length > 0) {
			const rankMatch = explicit.match(/(\d+)/);
			if (rankMatch) {
				const parsed = Number(rankMatch[1]);
				if (Number.isInteger(parsed) && parsed > 0) {
					return `Term ${parsed}`;
				}
			}
			return explicit;
		}
		const rank =
			typeof subject.rotationTermRank === 'number' && Number.isInteger(subject.rotationTermRank) && subject.rotationTermRank > 0
				? subject.rotationTermRank
				: typeof subject.modularOrder === 'number' && Number.isInteger(subject.modularOrder) && subject.modularOrder > 0
				? subject.modularOrder
				: null;
		return rank ? `Term ${rank}` : null;
	}, [subject.modularOrder, subject.rotationTermLabel, subject.rotationTermRank]);

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

	const roomNeedLabel = subject.preferredRoomType === 'CLASSROOM'
		? 'Standard classroom'
		: ROOM_TYPE_LABELS[subject.preferredRoomType] ?? subject.preferredRoomType;

	return (
		<tr className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
			<td className="px-4 py-3">
				<div className="flex items-center gap-3">
					<div className={`flex size-9 shrink-0 items-center justify-center rounded-lg border shadow-sm ${deptColor.accent} ${deptColor.border.replace('border-', 'border-opacity-50 border-')}`}>
						<BookOpen className="size-4" />
					</div>
					<div className="flex flex-col min-w-0">
						<span className="font-bold text-foreground leading-tight truncate">{subject.name}</span>
						<div className="mt-1 flex flex-wrap items-center gap-2">
							<code className="text-[0.65rem] font-mono text-muted-foreground uppercase px-1.5 py-0.5 bg-muted/30 rounded border border-border/40 font-bold tracking-tight">{subject.code}</code>
							{subject.rotationFamily && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Badge variant="outline" className="h-4 px-1 text-[0.55rem] font-black uppercase bg-violet-50 text-violet-700 border-violet-200 cursor-help shadow-none">
											Rotating
										</Badge>
									</TooltipTrigger>
									<TooltipContent side="top" className="text-xs font-bold max-w-[250px] p-3">
										<p className="mb-1 uppercase tracking-widest text-[0.6rem] text-violet-600">Rotating Subject Family</p>
										<p className="text-foreground font-medium leading-relaxed">
											Part of the <span className="font-bold">{subject.rotationFamily}</span> group. 
											One weekly classroom lane is shared across terms.
										</p>
									</TooltipContent>
								</Tooltip>
							)}
							{rotationTermLabel && (
								<Badge variant="outline" className="h-4 px-1 text-[0.55rem] font-black uppercase bg-violet-100 text-violet-900 border-violet-300 shadow-none">
									{rotationTermLabel}
								</Badge>
							)}
						</div>
					</div>
				</div>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col">
					<span className="text-sm tabular-nums font-semibold text-foreground">{duration}</span>
					<span className="text-[0.7rem] text-muted-foreground uppercase tracking-tight">Weekly time</span>
				</div>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col">
					<span className="text-xs font-medium text-foreground">
						{roomNeedLabel}
					</span>
					{subject.requiredFeatures.length > 0 && (
						<span className="text-[0.65rem] text-amber-600 font-semibold uppercase">+{subject.requiredFeatures.length} room feature{subject.requiredFeatures.length === 1 ? '' : 's'}</span>
					)}
				</div>
			</td>
			<td className="px-4 py-3">
				<span className="text-[0.7rem] font-semibold text-foreground bg-muted/60 px-2 py-1 rounded">
					{gradeSummary}
				</span>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center gap-1.5">
						<Badge variant="outline" className={`text-[0.65rem] font-semibold py-0 h-5 px-1.5 border-opacity-50 ${deptColor.bg} ${deptColor.text} ${deptColor.border}`}>
							{subject.ownerDepartment || 'GENERAL'}
						</Badge>
					</div>
					<div className="flex flex-wrap gap-1">
						{(subject.programScopes ?? []).map((scope) => (
							<span key={scope} className={`text-[0.6rem] font-bold uppercase tracking-widest ${PROGRAM_SCOPE_BADGE[scope] || 'text-muted-foreground'}`}>
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
							<span className="text-[0.7rem] font-semibold uppercase tracking-wider">Active</span>
						</div>
					) : (
						<div className="flex items-center gap-1.5 text-muted-foreground">
							<div className="size-1.5 rounded-full bg-current" />
							<span className="text-[0.7rem] font-semibold uppercase tracking-wider">Archived</span>
						</div>
					)}
					{subject.isSeedable && (
						<span className="text-[0.62rem] text-blue-600 font-semibold uppercase">Can be scheduled</span>
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
									aria-label={`Review teacher coverage for ${subject.name}`}
								>
									<Users className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Review teacher coverage</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-8 text-muted-foreground hover:text-primary"
									onClick={() => onEdit(subject)}
									aria-label={`Edit curriculum settings for ${subject.name}`}
								>
									<Pencil className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Edit curriculum settings</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`More subject actions for ${subject.name}`}>
								<MoreVertical className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-40">
							{subject.isActive && (
								<DropdownMenuItem onClick={() => onArchive(subject)}>
									<Archive className="mr-2 size-4" />
									<span>Archive for new schedules</span>
								</DropdownMenuItem>
							)}
							{!subject.isActive && (
								<DropdownMenuItem onClick={() => onReactivate(subject)}>
									<RotateCcw className="mr-2 size-4" />
									<span>Make schedulable again</span>
								</DropdownMenuItem>
							)}
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem 
									onClick={() => onDelete(subject)}
									className="text-red-600 focus:text-red-600"
								>
									<Trash2 className="mr-2 size-4" />
									<span>Delete permanently</span>
								</DropdownMenuItem>
							</>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</td>
		</tr>
	);
}
