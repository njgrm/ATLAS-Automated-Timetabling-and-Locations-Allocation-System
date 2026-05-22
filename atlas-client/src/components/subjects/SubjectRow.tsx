import {
	MoreVertical,
	Pencil,
	Trash2,
	Users,
	Archive,
	RotateCcw,
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

	return (
		<tr className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
			<td className="px-4 py-3">
				<div className="flex flex-col gap-0.5">
					<span className="font-semibold text-foreground leading-tight">{subject.name}</span>
					<code className="text-[0.65rem] font-mono text-muted-foreground">{subject.code}</code>
				</div>
			</td>
			<td className="px-4 py-3">
				<span className="text-xs tabular-nums font-medium">{duration}</span>
			</td>
			<td className="px-4 py-3">
				<span className="text-xs text-muted-foreground">
					{ROOM_TYPE_LABELS[subject.preferredRoomType] ?? subject.preferredRoomType}
				</span>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-wrap gap-1 max-w-30">
					{subject.gradeLevels.map((g) => (
						<Badge key={g} variant="outline" className={`text-[0.6rem] px-1 py-0 min-w-6 justify-center ${GRADE_COLORS[String(g)] ?? ''}`}>
							G{g}
						</Badge>
					))}
				</div>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col gap-1">
					<div className="flex flex-wrap gap-1">
						{(subject.programScopes ?? []).slice(0, 3).map((scope) => (
							<Badge key={scope} variant="outline" className={`text-[0.55rem] px-1 py-0 ${PROGRAM_SCOPE_BADGE[scope] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
								{scope}
							</Badge>
						))}
						{(subject.programScopes ?? []).length > 3 && (
							<span className="text-[0.6rem] text-muted-foreground">+{(subject.programScopes ?? []).length - 3}</span>
						)}
					</div>
					<div className="flex items-center gap-1">
						{subject.ownerDepartment && (
							<Badge variant="outline" className={`text-[0.55rem] px-1 py-0 ${SUBJECT_OWNER_BADGE[subject.ownerDepartment] ?? 'bg-muted border-border text-foreground'}`}>
								{SUBJECT_OWNER_LABELS[subject.ownerDepartment] ?? subject.ownerDepartment}
							</Badge>
						)}
					</div>
				</div>
			</td>
			<td className="px-4 py-3">
				<div className="flex flex-col gap-1 items-start">
					{subject.isActive ? (
						<Badge className="bg-emerald-100 text-emerald-700 text-[0.6rem] hover:bg-emerald-100 shadow-none border-none">Active</Badge>
					) : (
						<Badge variant="secondary" className="text-[0.6rem] shadow-none">Archived</Badge>
					)}
					{subject.ownerDepartment ? (
						<span className="text-[0.62rem] text-muted-foreground">Dept baseline active</span>
					) : (
						<span className="text-[0.62rem] text-amber-700">Owner department missing</span>
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
