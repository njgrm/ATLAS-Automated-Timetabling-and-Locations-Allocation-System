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
import { GRADE_COLORS } from '@/lib/grade-labels';
import { cn } from '@/lib/utils';
import { AccessibleInfo } from '@/components/smart/AccessibleInfo';
import { programFullLabel } from '@/lib/deped-glossary';
import { splitSubjectFeatures, subjectFeatureHelp, ownerDepartmentPhrase } from './subject-feature-presentation';
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
		if (explicit.length > 0) return explicit;
		const rank =
			typeof subject.rotationTermRank === 'number' && Number.isInteger(subject.rotationTermRank) && subject.rotationTermRank > 0
				? subject.rotationTermRank
				: null;
		return rank ? `Term ${rank}` : null;
	}, [subject.rotationTermLabel, subject.rotationTermRank]);

	// A3-C9: the grade column used to render ONE uncoloured string — "GR7–GR10"
	// or "GR7, GR8" — so the DepEd grade meaning (G7 green, G8 yellow, G9 red,
	// G10 blue, AGENTS.md §8) was invisible on the biggest catalog screen. It is
	// now one chip per grade.
	//
	// THE TREATMENT IS THE TEACHERS TABLE'S, NOT A SECOND ONE. `FacultyRow`'s
	// `FacultyAssignedGradeChips` is the same badge geometry and the same
	// `GRADE_COLORS` token source, so a scheduler reads grade 9 as red in both
	// tables. `GradeLevelBadge` was deliberately NOT used here: it carries a
	// different map (borders + dark variants) and importing it would put a
	// second palette on this surface, which is the exact defect an earlier pass
	// in this lane had to delete and rebuild. One palette, one look.
	//
	// A grade outside 7-10 has no DepEd colour. It still gets a chip, in the
	// neutral token, because dropping it would quietly delete a grade the
	// catalog says the subject serves.
	const gradeChips = useMemo(() => {
		const unique = new Set<number>();
		for (const grade of subject.gradeLevels) {
			if (Number.isFinite(grade)) unique.add(grade);
		}
		return [...unique].sort((a, b) => a - b);
	}, [subject.gradeLevels]);

	// The range wording is kept as the chips' accessible name, so a range or
	// multi-grade subject still announces every grade it spans. A3-C9 spells the
	// upper bound out ("GR7–GR10", not "GR7–10"): this string used to be the
	// visible cell text, where a bare "10" was readable in context, and it is
	// now heard without one, where it is not.
	const gradeSummary = useMemo(() => {
		if (!gradeChips.length) return null;
		if (gradeChips.length > 2 && gradeChips[gradeChips.length - 1] - gradeChips[0] === gradeChips.length - 1) {
			return `GR${gradeChips[0]}–GR${gradeChips[gradeChips.length - 1]}`;
		}
		return gradeChips.map((g) => `GR${g}`).join(', ');
	}, [gradeChips]);

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

	// A3-C4: `requiredFeatures` mixes real room features with the server's
	// `OWNER_DEPT:<code>` ownership markers. Count and describe only the real
	// room features here, and surface ownership separately as a plain
	// department name — the marker is an enum, not a room requirement.
	const featureSplit = useMemo(
		() => splitSubjectFeatures(subject.requiredFeatures),
		[subject.requiredFeatures],
	);
	const roomFeatureCount = featureSplit.roomFeatures.length;
	const ownerPhrase = ownerDepartmentPhrase(featureSplit.ownerDepartments);
	const featureHelp = useMemo(
		() => subjectFeatureHelp(featureSplit),
		[featureSplit],
	);

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
						{/* A3-C4: the subject code is a real, cross-referenced identifier
							(it is the key curriculum requirements and EnrollPro records use),
							so it stays — but it is demoted to a subordinate, focusable,
							plainly-described chip. It deliberately does NOT repeat the
							subject name, which is already the row's bold title one line
							above. The @/ui Tooltip carries the code and what it is for;
							AGENTS.md §8 forbids a `title` attribute. */}
						<TooltipProvider delayDuration={200}>
							<Tooltip>
								<TooltipTrigger asChild>
									<code
										tabIndex={0}
										aria-label={`Subject code ${subject.code}. Use the subject name above when scheduling; the code is the identifier used in curriculum requirements and EnrollPro records.`}
										className="cursor-help rounded border border-border/40 bg-muted/30 px-1 py-0.5 font-mono text-[0.7rem] tracking-tight text-muted-foreground"
									>
										{subject.code}
									</code>
								</TooltipTrigger>
								<TooltipContent side="top" className="max-w-64 text-xs leading-relaxed">
									<span className="font-semibold">Subject code</span> · {subject.code}. This is the identifier
									curriculum requirements and EnrollPro records use. Use{' '}
									<span className="font-semibold">{subject.name}</span> when scheduling.
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
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
					{gradeChips.length > 0 ? (
						<span
							className="flex flex-wrap items-center gap-1"
							data-testid="subject-grade-chips"
							aria-label={gradeSummary ?? undefined}
						>
							{gradeChips.map((grade) => (
								<span
									key={grade}
									className={cn(
										'inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[0.6rem] font-bold leading-none',
										GRADE_COLORS[String(grade)] ?? 'bg-muted text-muted-foreground',
									)}
								>
									{grade}
								</span>
							))}
						</span>
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
					{/* A3-C4: ownership is a department, not a room feature. The plain
						learning-area name is the primary read; the raw OWNER_DEPT code
						stays reachable in the AccessibleInfo mirror (an @/ui tooltip, not
						a `title` attribute). */}
					{ownerPhrase && (
						<span className="text-[0.7rem] text-muted-foreground">Owned by {ownerPhrase}</span>
					)}
					{featureSplit.ownerDepartments.length > 0 && roomFeatureCount === 0 ? (
						<AccessibleInfo
							label={`Room features and owning department for ${subject.name}`}
							shortHelp={featureHelp}
							size="icon-xs"
						/>
					) : null}
					{roomFeatureCount > 0 ? (
						<AccessibleInfo
							label={`Room features required by ${subject.name}`}
							shortHelp={featureHelp}
						>
							<Button
								type="button"
								variant="link"
								size="sm"
								className="mt-0.5 self-start h-auto p-0 text-[0.7rem] text-amber-600 font-semibold uppercase cursor-help hover:underline"
							>
								+{roomFeatureCount} feature{roomFeatureCount === 1 ? '' : 's'}
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
						<Badge variant="outline" className="text-xs font-bold bg-slate-50 text-muted-foreground border-slate-200 shadow-none">
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
					{/* A3-19 (route-scoped): the shared `DropdownMenuContent` primitive
						ships `min-w-[8rem]` and its items carry no `whitespace-nowrap`,
						so "Archive for new schedules" wrapped and clipped inside the old
						w-44. The primitive is shared with timetable/other routes and is
						NOT changed here; the width and no-wrap are applied at this call
						site only. `w-56` replaces `w-44` (tailwind-merge resolves the two
						width classes in the primitive/base pair last-wins) and
						`min-w-[13rem]` is the load-bearing guard against the primitive's
						own `min-w-[8rem]`. */}
					<DropdownMenuContent align="end" className="min-w-[13rem] w-56">
						<DropdownMenuItem onClick={() => onEdit(subject)} className="whitespace-nowrap">
							<Pencil className="mr-2 size-4" />
							<span>Edit subject</span>
						</DropdownMenuItem>
						{subject.isActive && (
							<DropdownMenuItem onClick={() => onArchive(subject)} className="whitespace-nowrap">
								<Archive className="mr-2 size-4" />
								<span>Archive for new schedules</span>
							</DropdownMenuItem>
						)}
						{!subject.isActive && (
							<DropdownMenuItem onClick={() => onReactivate(subject)} className="whitespace-nowrap">
								<RotateCcw className="mr-2 size-4" />
								<span>Make schedulable again</span>
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => onDelete(subject)}
							className="whitespace-nowrap text-red-600 focus:text-red-600"
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
