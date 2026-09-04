import { useMemo } from 'react';
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
import { ROOM_TYPE_LABELS } from '@/lib/subject-constants';
import { AccessibleInfo } from '@/components/smart/AccessibleInfo';
import { programFullLabel } from '@/lib/deped-glossary';
import type { Subject, SubjectCoverageRow } from '@/types';

interface SubjectRowProps {
	subject: Subject;
	timeMode: 'minutes' | 'hours';
	coverageRow?: SubjectCoverageRow;
	onEdit: (subject: Subject) => void;
	onDelete: (subject: Subject) => void;
	onArchive: (subject: Subject) => void;
	onReactivate: (subject: Subject) => void;
	onShowCoverage: (subject: Subject) => void;
}

export function SubjectRow({
	subject,
	timeMode,
	coverageRow,
	onEdit,
	onDelete,
	onArchive,
	onReactivate,
	onShowCoverage,
}: SubjectRowProps) {
	const duration = timeMode === 'minutes'
		? `${subject.minMinutesPerWeek} min`
		: `${Math.round((subject.minMinutesPerWeek / 60) * 10) / 10} h`;

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

	const gradeSummary = useMemo(() => {
		if (!subject.gradeLevels.length) return null;
		const sorted = [...subject.gradeLevels].sort((a, b) => a - b);
		if (sorted.length > 2 && sorted[sorted.length - 1] - sorted[0] === sorted.length - 1) {
			return `GR${sorted[0]}–${sorted[sorted.length - 1]}`;
		}
		return sorted.map(g => `GR${g}`).join(', ');
	}, [subject.gradeLevels]);

	const roomNeedLabel = subject.preferredRoomType === 'CLASSROOM'
		? 'Standard classroom'
		: ROOM_TYPE_LABELS[subject.preferredRoomType] ?? subject.preferredRoomType;

	const programScopes = subject.programScopes ?? [];
	const programText = programScopes.length === 0
		? null
		: programScopes.length === 1
		? programFullLabel(programScopes[0])
		: `${programScopes.length} programs`;

	const isArchived = !subject.isActive;
	// Prompt 01A: isSeedable is bootstrap/seed metadata — NOT timetable inclusion.
	// Generation schedules by isActive; the old "Excluded/Available" badges made
	// a false claim about scheduling. Catalog active state is the status shown.
	const coverageStatus = coverageRow?.status ?? null;
	const hasMissingCoverage = (coverageRow?.uncoveredSectionCount ?? 0) > 0;
	const isFullCoverage = coverageStatus === 'FULL';
	const isPartialCoverage = coverageStatus === 'PARTIAL';
	const isZeroCoverage = coverageStatus === 'ZERO';

	return (
		<tr className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
			{/* Col 1 — Subject: name, code, max 2 status badges */}
			<td className="px-4 py-3">
				<div className="flex flex-col min-w-0">
					<span className="font-bold text-foreground leading-tight truncate">{subject.name}</span>
					<div className="mt-1 flex flex-wrap items-center gap-1.5">
						<code className="text-[0.7rem] font-mono text-muted-foreground uppercase px-1 py-0.5 bg-muted/30 rounded border border-border/40 font-bold tracking-tight">{subject.code}</code>
						{isArchived && (
							<Badge className="h-4 px-1.5 text-[0.65rem] font-bold bg-amber-100 text-amber-700 border border-amber-200 shadow-none">Archived</Badge>
						)}
						{!isArchived && (
							<Badge variant="outline" className="h-4 px-1.5 text-[0.65rem] font-bold bg-emerald-50 text-emerald-700 border-emerald-200 shadow-none">Active</Badge>
						)}
					</div>
				</div>
			</td>

			{/* Col 2 — Grades / program */}
			<td className="px-4 py-3">
				<div className="flex flex-col gap-0.5">
					{gradeSummary ? (
						<span className="text-sm font-semibold text-foreground">{gradeSummary}</span>
					) : (
						<span className="text-sm text-muted-foreground">No grades</span>
					)}
					{programText && (
						<span className="text-xs text-muted-foreground">{programText}</span>
					)}
				</div>
			</td>

			{/* Col 3 — Weekly need */}
			<td className="px-4 py-3">
				<div className="flex flex-col">
					<span className="text-sm tabular-nums font-semibold text-foreground">{duration}</span>
					{rotationTermLabel && (
						<span className="text-[0.7rem] text-muted-foreground uppercase tracking-tight">{rotationTermLabel}</span>
					)}
				</div>
			</td>

			{/* Col 4 — Room need */}
			<td className="px-4 py-3">
				<div className="flex flex-col">
					<span className="text-xs font-medium text-foreground">{roomNeedLabel}</span>
					{subject.requiredFeatures.length > 0 ? (
						<AccessibleInfo
							label={`Room features required by ${subject.name}`}
							shortHelp={`This subject needs ${subject.requiredFeatures.length} special room feature${subject.requiredFeatures.length === 1 ? '' : 's'}: ${subject.requiredFeatures.join(', ')}.`}
						>
							<Button
								type="button"
								variant="link"
								size="sm"
								className="mt-0.5 self-start h-auto p-0 text-[0.7rem] text-amber-600 font-semibold uppercase cursor-help hover:underline"
							>
								+{subject.requiredFeatures.length} feature{subject.requiredFeatures.length === 1 ? '' : 's'}
							</Button>
						</AccessibleInfo>
					) : null}
				</div>
			</td>

			{/* Col 5 — Teacher coverage */}
			<td className="px-4 py-3" data-testid={`subject-coverage-cell-${subject.id}`}>
				{isArchived ? (
					<Badge variant="secondary" className="text-xs font-bold">Archived</Badge>
				) : coverageRow ? (
					<span className="flex items-center gap-1">
						{isFullCoverage ? (
							<Badge variant="outline" className="text-xs font-bold bg-emerald-50 text-emerald-700 border-emerald-200 shadow-none" aria-label={`${subject.name} has full section coverage`}>
								Full coverage
							</Badge>
						) : isPartialCoverage ? (
							<Badge variant="outline" className="text-xs font-bold bg-amber-50 text-amber-700 border-amber-200 shadow-none" aria-label={`${subject.name} has partial section coverage`}>
								{coverageRow.ownedSectionCount}/{coverageRow.relevantSectionCount} covered
							</Badge>
						) : (
							<Badge variant="outline" className="text-xs font-bold bg-red-50 text-red-700 border-red-200 shadow-none" aria-label={`${subject.name} has no section coverage`}>
								No coverage
							</Badge>
						)}
						<AccessibleInfo
							label={`${subject.name} coverage: ${coverageRow.ownedSectionCount}/${coverageRow.relevantSectionCount} sections`}
							shortHelp={hasMissingCoverage ? `${coverageRow.uncoveredSectionCount} section${coverageRow.uncoveredSectionCount === 1 ? '' : 's'} still need a teacher.` : 'All required sections have a teacher assigned.'}
							size="icon-xs"
						/>
					</span>
				) : (
					<span className="flex items-center gap-1">
						<Badge variant="outline" className="text-xs font-bold bg-slate-50 text-slate-500 border-slate-200 shadow-none">
							Checking
						</Badge>
					</span>
				)}
			</td>

			{/* Col 6 — Action: text primary + More menu */}
			<td className="px-4 py-3 text-right">
				<div className="flex items-center justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						className="h-8 gap-1.5 px-2.5 text-xs font-bold"
						onClick={() => onShowCoverage(subject)}
						aria-label={`Review teacher coverage for ${subject.name}`}
					>
						<Users className="size-3.5" />
						Review coverage
					</Button>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`More subject actions for ${subject.name}`}>
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
							<DropdownMenuItem
								onClick={() => onDelete(subject)}
								className="text-red-600 focus:text-red-600"
							>
								<Trash2 className="mr-2 size-4" />
								<span>Delete permanently</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</td>
		</tr>
	);
}
