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
import { splitSubjectFeatures, subjectFeatureHelp, ownerDepartmentRead } from './subject-feature-presentation';
import { ProgramScopeChips } from './ProgramScopeChips';
import { SUBJECT_ACTION_CELL_Z, SUBJECT_ACTION_COLUMN_WIDTH_CLASS, SUBJECT_NAME_COLUMN_WIDTH_CLASS } from './subject-action-column';
import type { Subject, SubjectCoverageRow } from '@/types';
import type { SubjectCoverageVerdict } from '@/components/subjects/subjects-coverage-truth';

interface SubjectRowProps {
	subject: Subject;
	timeMode: 'minutes' | 'hours';
	coverageRow?: SubjectCoverageRow;
	/**
	 * A6 c10 — the page's shared coverage verdict, when it has resolved one. It
	 * OVERRIDES the server's `status` for the words this row prints, because
	 * `status: FULL` means "every class has an owner" and a to-be-hired record is
	 * an owner. Absent, the row keeps the server's own answer.
	 */
	coverageVerdictBySubjectId?: Map<number, SubjectCoverageVerdict> | null;
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
	coverageVerdictBySubjectId,
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
	const ownerPhrase = ownerDepartmentRead(featureSplit.ownerDepartments);
	const featureHelp = useMemo(
		() => subjectFeatureHelp(featureSplit),
		[featureSplit],
	);

	// Prompt 01A: isSeedable is bootstrap/seed metadata — NOT timetable inclusion.
	// Generation schedules by isActive; the old "Excluded/Available" badges made
	// a false claim about scheduling. Catalog active state is the status shown.
	const coverageStatus = coverageRow?.status ?? null;
	const isFullCoverage = coverageStatus === 'FULL';
	const isPartialCoverage = coverageStatus === 'PARTIAL';
	const isZeroCoverage = coverageStatus === 'ZERO';

	/*
	 * A6 c10 — THE VERDICT, WHEN THE PAGE HAS ONE.
	 *
	 * `isFullCoverage` reads the server's own `status === 'FULL'`, which says a
	 * subject's classes all have an OWNER — and a to-be-hired record is an owner.
	 * That is how `/subjects` printed a green "Full coverage" on every row while
	 * `/teaching-load` said 72 classes still need a real teacher, on the same data
	 * (Codex audit, 2026-09-29, finding 7). `coverageVerdict` is the page's shared
	 * decision, built from the roster's own `isPlaceholder` flag; when it is present
	 * it OVERRIDES the server's `status` for the words this row prints, and when it
	 * is absent (the read has not resolved) the row keeps the server's own answer
	 * rather than inventing one.
	 */
	const coverageVerdict = coverageVerdictBySubjectId?.get(subject.id) ?? null;
	const effectivelyFull = coverageVerdict ? coverageVerdict.fullyCoveredByRealTeachers : isFullCoverage;

	return (
		<tr className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
			{/* Col 1 — Subject: name + one status badge.

				A5 C3 / A2: the subject-CODE chip is GONE from this row, along with its
				`TooltipProvider`/`Tooltip` wrapper, its `tabIndex={0}` and its 40-word
				`aria-label`. That is a subtraction of one chip, one focusable element and
				one affordance from EVERY row of the catalog, in the region where the
				operator is reading names. The code is the identifier curriculum
				requirements and EnrollPro records key on, not one a scheduler decides
				coverage from; it is still on the edit form, where an officer enters it.
				No `title=` attribute replaces it (§8).

				MR-71 (operator, 2026-10-03, subject.docx item 1: "notice the text being
				cut due to the small container. Adjust the container size").

				THE DEFECT. The name was `truncate` inside a flex `min-w-0` cell with no
				width of its own, so the six-column table's own layout squeezed column 1 to
				whatever the other five columns happened to leave, and every long DepEd
				subject name was cut with a "…" on the operator's primary reading surface.

				THE FIX IS THE CONTAINER, NOT THE CLIP — two changes, both about GIVING THE
				NAME ROOM rather than dropping `truncate` and letting a long name push the
				row out of alignment:

				  1. `SUBJECT_NAME_COLUMN_WIDTH_CLASS`, the SAME declared-width mechanism the
				     action column already uses (`SUBJECT_ACTION_COLUMN_WIDTH_CLASS`) and for
				     the same reason (`subject-action-column.ts`): a `w-*` alone is only a
				     PREFERRED size the table's own layout can squeeze, so it is paired with
				     `shrink-0`. The header's `<th>` takes the same constant, so the column's
				     edges line up instead of the header and the cells each deciding
				     independently — the defect the action column already had to fix once.

				  2. `line-clamp-2 … break-words` in place of `truncate`, so the name may use
				     TWO lines and a long word breaks rather than overflowing. That is the
					 repository's own established treatment for a long name in a table cell
				     (`BuildingPanel.tsx` and `SectionRoomPicker.tsx` use exactly this pair),
				     so this row reads like the other tables instead of inventing a second
				     one. Two lines is a BOUND, not a licence to grow: a longer name still
				     clamps, and the Tooltip is what makes it recoverable.

				THE FULL NAME IS ALWAYS AN ACCESSIBLE NAME, AND ONE HOVER AWAY. The `@/ui`
				Tooltip is the pattern `ProgramScopeChips` uses two columns to the right for
				the same problem (J4/R2-5: `Tooltip`, not `HoverCard`, because
				`@radix-ui/react-hover-card` is not a dependency). `tabIndex={0}` keeps it
				reachable by keyboard rather than by hover alone (WCAG 2.1.1), and the
				`aria-label` IS the full name, so assistive tech announces it whether or not a
				bubble is ever opened. Never a raw `title=` (§8).

				NOT the mobile card. `SubjectMobileCard`'s own `truncate` is a DIFFERENT
				surface at a DIFFERENT width, and `subject.docx` is about this table; it is
				left alone rather than swept. */}
			<td className={`px-4 py-3 ${SUBJECT_NAME_COLUMN_WIDTH_CLASS}`}>
				<div className="flex flex-col min-w-0">
					<TooltipProvider delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<span
									data-testid="subject-name"
									tabIndex={0}
									aria-label={subject.name}
									className="font-bold text-foreground leading-tight line-clamp-2 break-words min-w-0"
								>
									{subject.name}
								</span>
							</TooltipTrigger>
							<TooltipContent side="top" className="max-w-72">
								{subject.name}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<div className="mt-1 flex flex-wrap items-center gap-1.5">
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
					{/* A5 C3 / A3: the program line was ONE string — the spelled-out full
					    name for a single scope, `"{n} programs"` for more. It is now one
					    chip per scope, in the operator's own abbreviation, with the full
					    name in the chip's @/ui Tooltip. Same line count, far less text. */}
					<ProgramScopeChips scopes={programScopes} />
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

			{/* Col 4 — Room need. One fact per line; no line is a joined sentence.

				A5 C2B (NOT re-done here) put the department on the PRIMARY line without the
				raw marker; R2-4 says prove that, do not "improve" it. A5 C3 / J7 only drops
				the trailing `department`/`departments` noun and the `and`, so the line reads
				`Owned by AP, MAPEH` — the line already begins `Owned by`, so the noun was
				both redundant and, in the two-department case, ungrammatical
				(`Owned by Araling Panlipunan and MAPEH departments`). */}
			<td className="px-4 py-3">
				<div className="flex flex-col">
					<span className="text-xs font-medium text-foreground">{roomNeedLabel}</span>
					{ownerPhrase && (
						<span className="text-[0.7rem] text-muted-foreground">Owned by {ownerPhrase}</span>
					)}
					{/* A5 C3 / J6: the detail affordance still exists and still explains how
					    ownership is recorded, but it no longer prints the `OWNER_DEPT:`
					    storage prefix. The owning CODES are the diagnostic; the prefix is
					    syntax. The operator's words were "no raw `OWNER_DEPT:<code>` strings
					    anywhere", and this is the last place on `/subjects` that could
					    produce one. */}
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
							{/* `uppercase font-semibold` removed: this is a count, and a
							    shouted `+2 FEATURES` competes with the coverage badge that
							    is the actual answer to the question this page is opened for. */}
							<Button
								type="button"
								variant="link"
								size="sm"
								className="mt-0.5 self-start h-auto p-0 text-[0.7rem] font-medium cursor-help hover:underline"
							>
								+{roomFeatureCount} feature{roomFeatureCount === 1 ? '' : 's'}
							</Button>
						</AccessibleInfo>
					) : null}
				</div>
			</td>

		{/* Col 5 — Teacher coverage. THE BADGE IS PLAIN STATUS TEXT.

			OPERATOR (30 Sep 2026, docx1 S2) reversed A6 c8 / fix 2.17.1. The
			coverage badge must be plain, NON-clickable text again; only the row's
			`Review` action opens coverage.

			Why the reversal is the honest call, not a regression of 2.17.1: a
			scheduler scanning the catalogue reads the badge as STATUS. Making the
			status cell itself a button competed with `Review` — the row's one
			labelled action — for the next click, and it taught people that tapping
			a colour band navigates. The defect 2.17.1 fixed (a dead `AccessibleInfo`
			icon that was focusable and opened nothing) is still fixed: there is no
			dead affordance here, because there is no affordance here at all. A
			status that is simply read is not a control that does nothing.

			So: no `<button>`, no Tooltip wrapper, no `onClick`, no `hover:underline`
			or `focus-visible:ring`, and no `coverageHelp` sentence — the badge is
			mounted directly in the cell. Every state keeps its EXACT words, colour
			classes and its own `aria-label` (`… has partial section coverage`), so
			the status still carries its meaning to assistive tech without pretending
			to be clickable.

			`Review` in the action cell is UNCHANGED and is now the ONLY control that
			calls `onShowCoverage(subject)` on this row. */}
		<td className="px-4 py-3" data-testid={`subject-coverage-cell-${subject.id}`}>
			{isArchived ? (
				<Badge variant="secondary" className="text-xs font-bold">Archived</Badge>
			) : coverageRow ? (
				coverageVerdict && !coverageVerdict.fullyCoveredByRealTeachers ? (
					/*
					 * A6 c10 — THE HONEST CELL. The server's `status` says
					 * "FULL" because every class has an owner, and a to-be-hired
					 * record is an owner; the Codex audit's finding 7 is this cell
					 * reading "Full coverage" over 50 placeholder-held classes. The
					 * row now prints what is actually true, in the shared
					 * verdict's own words, in the SAME amber the partial cell uses
					 * — one warning look on one page.
					 */
					<Badge
						variant="outline"
						className="text-xs font-bold bg-amber-50 text-amber-700 border-amber-200 shadow-none"
						aria-label={`${subject.name}: ${coverageVerdict.openClassCount} of its classes have no real teacher`}
					>
						{coverageVerdict.openClassCount === 1 ? 'No real teacher' : `${coverageVerdict.openClassCount} need a real teacher`}
					</Badge>
				) : isFullCoverage ? (
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
				)
			) : (
				<span className="flex items-center gap-1">
					<Badge variant="outline" className="text-xs font-bold bg-slate-50 text-muted-foreground border-slate-200 shadow-none">
						Checking
					</Badge>
				</span>
			)}
		</td>

		{/* Col 6 — Action: text primary + More menu.

			A5-C2B / demo-walk item 7: at the 1366px supported desktop viewport the
			six-column table overflowed its scroll box, so this cell — the row's
			ONLY action — sat beyond the right edge behind a horizontal scrollbar.

			Two changes, both layout-only:
			  1. `sticky right-0` pins the cell to the right edge of
			     `AdminTableShell`'s `flex-1 min-h-0 overflow-auto` box. The action
			     is therefore in view at EVERY table width, with or without
			     horizontal scroll. The cell carries an opaque background and a
			     left border so scrolled content never shows through it.
			  2. The visible label drops to one word. The accessible name keeps
			     "Review teacher coverage for <subject>", so nothing is lost to a
			     screen reader, and the shorter label is what buys the width back
			     on the desktop table rather than trading the bug for a new one.

			A5 C7 ITEM 44, ADDED. The fixed width comes from
			`SUBJECT_ACTION_COLUMN_WIDTH_CLASS` — the SAME constant the header's
			`<th>` uses, so the column's right-hand edge lines up instead of the
			header and the cells each deciding it independently, which is what let
			the right-hand edges drift. `shrink-0` is part of that constant
			because a `w-*` is only a PREFERRED size: without it the table's own
			layout can squeeze the column and the shared width is decorative.
			`px-4` lives in the constant for the same reason, so the header's
			`Action` label and the row's buttons pad identically and their right
			edges line up too.

			The cell's own `z-10` is UNCHANGED. The header row was raised above it
			rather than these cells being lowered — see `subject-action-column.ts`
			for why the header's own `z-20` could never have fixed the defect it
			was presumably meant to. */}
		<td className={`sticky right-0 ${SUBJECT_ACTION_CELL_Z} border-l border-border/40 bg-white py-3 text-right ${SUBJECT_ACTION_COLUMN_WIDTH_CLASS}`}>
			<div className="flex items-center justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					className="h-8 gap-1.5 px-2.5 text-xs font-bold"
					onClick={() => onShowCoverage(subject)}
					aria-label={`Review teacher coverage for ${subject.name}`}
				>
					<Users className="size-3.5" />
					Review
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
