import {
	Archive,
	MoreVertical,
	Pencil,
	RotateCcw,
	Trash2,
	Users,
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
import { gradeLabel } from '@/lib/grade-labels';
import { ROOM_TYPE_LABELS } from '@/lib/subject-constants';
import { ProgramScopeChips } from './ProgramScopeChips';
import type { Subject } from '@/types';

export type SubjectCoverageRow = {
	uncoveredSectionCount: number;
	ownedSectionCount: number;
	relevantSectionCount: number;
};

type SubjectMobileCardProps = {
	subject: Subject;
	coverageRow: SubjectCoverageRow | null;
	onReviewCoverage: (subject: Subject) => void;
	onEdit: (subject: Subject) => void;
	onArchive: (subject: Subject) => void;
	onReactivate: (subject: Subject) => void;
	onDelete: (subject: Subject) => void;
};

export function SubjectMobileCard({
	subject,
	coverageRow,
	onReviewCoverage,
	onEdit,
	onArchive,
	onReactivate,
	onDelete,
}: SubjectMobileCardProps) {
	const roomNeedLabel = subject.preferredRoomType === 'CLASSROOM'
		? 'Standard classroom'
		: ROOM_TYPE_LABELS[subject.preferredRoomType] ?? subject.preferredRoomType;
	const grades = subject.gradeLevels.length > 0
		? [...subject.gradeLevels].sort((a, b) => a - b).map((grade) => gradeLabel(grade)).join(', ')
		: 'No grades';
	const programScopes = subject.programScopes ?? [];
	// Prompt 01A: isSeedable is bootstrap metadata, not timetable inclusion.
	// Generation schedules by isActive — coverage applies to every active subject.
	const needsCoverage = coverageRow != null && subject.isActive && coverageRow.uncoveredSectionCount > 0;
	const isArchived = !subject.isActive;

	return (
		<div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-sm" data-testid="subject-mobile-card">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-1.5">
						{/* A5 C3 / A2: the subject-code chip is gone here too, for the same
						    reason as the desktop row — the name is the title and the code is
						    not what a scheduler decides coverage from. */}
						{isArchived && <Badge className="h-4 px-1.5 text-[0.65rem] font-bold bg-amber-100 text-amber-700 border border-amber-200 shadow-none">Archived</Badge>}
						{!isArchived && <Badge variant="outline" className="h-4 px-1.5 text-[0.65rem] font-bold bg-emerald-50 text-emerald-700 border-emerald-200 shadow-none">Active</Badge>}
					</div>
					<h3 className="mt-1.5 truncate text-base font-bold text-foreground">{subject.name}</h3>
				</div>
			</div>

			<div className="mt-2.5 space-y-1.5 text-xs">
				<div className="flex items-center justify-between gap-2">
					<span className="text-muted-foreground font-medium">Grade level</span>
					<span className="font-semibold text-foreground text-right">{grades}</span>
				</div>
				{/* A5 C3 / A3: programs were welded onto the grade value as
				    `GR7, GR8 · Regular Program` — two different facts on one line, so the
				    value read as a sentence to be decoded. They get their own row and the
				    same chips the desktop row uses, so the two layouts say the same
				    thing in the same words. */}
				{programScopes.length > 0 && (
					<div className="flex items-center justify-between gap-2">
						<span className="text-muted-foreground font-medium">Program</span>
						<ProgramScopeChips scopes={programScopes} />
					</div>
				)}
				<div className="flex items-center justify-between gap-2">
					<span className="text-muted-foreground font-medium">Coverage</span>
					{isArchived ? (
						<span className="text-muted-foreground font-medium">Archived</span>
					) : coverageRow ? (
						<span className={needsCoverage ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>
							{coverageRow.ownedSectionCount}/{coverageRow.relevantSectionCount} covered
						</span>
					) : (
						<span className="text-muted-foreground font-medium">Checking</span>
					)}
				</div>
			</div>

			<div className="mt-3 flex items-center gap-2 border-t border-slate-200/70 pt-3">
				<Button type="button" size="sm" className="h-9 flex-1 gap-1.5 font-bold" onClick={() => onReviewCoverage(subject)}>
					<Users className="size-3.5" />
					Review coverage
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0 text-muted-foreground" aria-label={`More subject actions for ${subject.name}`}>
							<MoreVertical className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-44">
						<DropdownMenuItem onClick={() => onEdit(subject)}>
							<Pencil className="mr-2 size-4" />
							<span>Edit subject</span>
						</DropdownMenuItem>
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
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => onDelete(subject)} className="text-red-600 focus:text-red-600">
							<Trash2 className="mr-2 size-4" />
							<span>Delete permanently</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
