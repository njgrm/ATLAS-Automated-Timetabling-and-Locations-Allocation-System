import {
	MoreVertical,
	Users,
	ClipboardList,
	Home,
	AlertTriangle,
	Map as MapIcon,
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
import { Link } from 'react-router-dom';
import type { RoomOption } from './SectionRoomPicker';
import { resolveHomeRoom } from './home-room-readiness';
import { gradeCompact } from '@/lib/deped-glossary';
import type { ExternalSection } from '@/types';

/* ─── Constants (matching Sections.tsx) ─── */
const GRADE_COLORS: Record<string, string> = {
	'7':  'bg-green-100/80 text-green-700',
	'8':  'bg-yellow-100/80 text-yellow-700',
	'9':  'bg-red-100/80 text-red-700',
	'10': 'bg-blue-100/80 text-blue-700',
};

const PROGRAM_BADGE: Record<string, string> = {
	STE:   'bg-emerald-50 text-emerald-700 border-emerald-200',
	SPA:   'bg-purple-50 text-purple-700 border-purple-200',
	SPS:   'bg-orange-50 text-orange-700 border-orange-200',
	SPJ:   'bg-sky-50 text-sky-700 border-sky-200',
	SPFL:  'bg-indigo-50 text-indigo-700 border-indigo-200',
	SPTVE: 'bg-amber-50 text-amber-700 border-amber-200',
	OTHER: 'bg-gray-50 text-gray-600 border-gray-200',
};

function gradeKey(name: string) {
	const m = name.match(/\d+/);
	return m ? m[0] : '';
}

function fillColor(pct: number) {
	// Phase 0C.1: the over-full band uses a neutral dark slate rather than red,
	// reserving red for grade-level meaning (G9) and destructive buttons. The
	// scale progresses muted -> emerald (good) -> amber (high) -> slate (full).
	if (pct >= 95) return 'bg-slate-800 text-white';
	if (pct >= 85) return 'bg-amber-500 text-white';
	if (pct >= 70) return 'bg-emerald-600 text-white';
	return 'bg-muted text-muted-foreground';
}

/* ─── Types ─── */
export type SectionDetail = ExternalSection;

interface SectionRowProps {
	section: SectionDetail;
	homeRoomOptions: RoomOption[];
	isReadOnly: boolean;
	onShowDetails: (section: SectionDetail) => void;
	/** A3 C4: opens the existing room map scoped to THIS section. */
	onShowRoomMap: (section: SectionDetail) => void;
}

export function SectionRow({
	section,
	homeRoomOptions,
	isReadOnly,
	onShowDetails,
	onShowRoomMap,
}: SectionRowProps) {
	const fill = section.maxCapacity > 0 ? Math.round((section.enrolledCount / section.maxCapacity) * 100) : 0;
	const gKey = gradeKey(section.gradeLevelName);
	const gColor = GRADE_COLORS[gKey] ?? 'bg-muted text-muted-foreground';
	// Phase 0C.2 / Decision 5: compact grade label is GR{grade}, never G{grade}.
	const gradeMatch = section.gradeLevelName.match(/\d+/);
	const gradeLabel = gradeMatch ? gradeCompact(Number(gradeMatch[0])) : section.gradeLevelName;
	// A3 C4 (defect A): the one shared definition of "this section has a home
	// room". The page's stat tile counts with the same predicate, so the tile
	// can no longer claim a section is assigned while this row says it needs one.
	// It is `null` both when there is no id and when the id names no room in the
	// current options — the same truth to the operator in either case.
	const selectedRoom = resolveHomeRoom(section, homeRoomOptions);

	return (
		<tr className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
			<td className="px-4 py-3">
				<TooltipProvider delayDuration={200}>
					<Tooltip>
						{/* Phase 1.6: section-name button is the primary "View" entry point; the
							wrapper Tooltip is now the only visible help affordance. */}
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								className="-ml-2 h-auto w-full justify-start gap-3 rounded-xl p-2 text-left hover:bg-primary/5"
								onClick={() => onShowDetails(section)}
								aria-label={`View class coverage and room context for ${section.name}`}
							>
								<div className={`flex size-9 shrink-0 items-center justify-center rounded-lg border shadow-sm font-bold text-sm ${gColor} border-opacity-50`}>
									{gKey || section.name[0]}
								</div>
							<div className="flex flex-col min-w-0">
								{/* FIX 07: the title OWNS the top row by itself. It used to
									share one `flex items-center gap-2` line with the program
									badge, and because `truncate` is `white-space: nowrap` on a
									flex item whose automatic minimum size is its min-content
									width, the title could not shrink — `truncate` never
									ellipsised, the line overflowed the cell, and the badge was
									pushed out into the next cell's grade / occupancy /
									capacity indicator. The badge now sits on the sub-header
									line below, so the title's required track is only its
									longest word at any font scale, and the title wraps to two
									lines (FIX 11) instead of guessing at a truncated one. */}
								<span className="font-semibold text-foreground leading-tight line-clamp-2 min-w-0 break-words">
									{section.name}
								</span>
								<div className="mt-0.5 flex flex-wrap items-center gap-1.5">
									{section.isSpecialProgram && section.programCode && (
										<Badge
											variant="outline"
											className={`shrink-0 text-[0.6875rem] leading-tight font-bold border-opacity-50 ${PROGRAM_BADGE[section.programCode] ?? PROGRAM_BADGE.OTHER}`}
										>
											{section.programCode}
										</Badge>
									)}
									<span className="text-[0.6875rem] text-muted-foreground uppercase tracking-tight">
										{section.isSpecialProgram ? section.programName : 'Regular Program'}
									</span>
								</div>
							</div>
							</Button>
						</TooltipTrigger>
						<TooltipContent>View section details</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</td>

			<td className="px-4 py-3">
				<Badge
					variant="secondary"
					className={`px-2 font-semibold text-[0.6875rem] border-0 ${gColor}`}
				>
					{gradeLabel}
				</Badge>
			</td>

			<td className="px-4 py-3 text-right">
				<div className="flex flex-col items-end">
					<span className="text-sm font-semibold tabular-nums text-foreground">{section.enrolledCount}</span>
					<span className="text-[0.6875rem] text-muted-foreground uppercase tracking-tighter">Students</span>
				</div>
			</td>

			<td className="px-4 py-3 text-right">
				<div className="flex flex-col items-end">
					<span className="text-sm font-medium tabular-nums text-muted-foreground">{section.maxCapacity}</span>
					<span className="text-[0.6875rem] text-muted-foreground uppercase tracking-tighter">Capacity</span>
				</div>
			</td>

			<td className="px-4 py-3 text-right">
				<span
					className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${fillColor(fill)}`}
					aria-label={`${fill}% full${fill >= 95 ? ' (at or over capacity)' : fill >= 85 ? ' (high)' : ''}`}
				>
					{fill}%
				</span>
			</td>

			<td className="px-4 py-3">
				{/* A9 C3 (2026-09-29) — THE INLINE PICKER IS GONE FROM THE TABLE, AND THIS
				    CELL IS WHAT REPLACES IT.

				    THE DEFECT. The older-user audit rejected `/sections` for showing "20 need
				    rooms" beside 20 identical "Choose home room" selectors: the same control
				    twenty times, each one a decision the scheduler had to make by hand before
				    she could do anything else. That is the tedium score (2/5) in the audit's
				    own words, and it is why the page now has ONE guided step
				    (`HomeRoomAutoAssignDialog`) that reads the server's own matching rules.

				    WHAT THIS CELL IS. A plain READ of the current room — no control, one line.
				    It answers "does this section have a room, and which one" at a glance, which
				    is what a scrolling table is for, and it costs the row nothing: the previous
				    version put a 9px-tall control plus a second line of status text in every
				    row, so removing them is where the page got SHORTER.

				    WHY NO CAPABILITY IS LOST — and this is the part that has to be true, so it
				    is worth being exact. A section that needs a room is now changed in the
				    guided review list, which carries this same `SectionRoomPicker` primitive
				    (§8 one look per control: the review row and the old row control are the
				    same component, so the look cannot drift). A section that ALREADY has a
				    room is not in that list at all — the preview runs with
				    `overwriteExisting: false` and reports those sections as
				    `existingPreserved` — so re-pointing one is reached through the row's OWN
				    map button, which is one click away on every row, has always been there,
				    and writes through the very same `onHomeRoomChange` this cell used to call
				    (`SectionsHomeRoomMapModals` passes it straight to `handleHomeRoomChange`).
				    No path to a room assignment was removed; the twenty repeated ways of
				    reaching it were.

				    `resolveHomeRoom` is still the ONE definition of "has a room" (A3 C4 defect
				    A), and the amber icon moved to the measured `--warning` family rather
				    than a raw amber class, which is the direction the c8 ratchet exists to
				    push (a3-c8-warning-token.test.ts). */}
				<div className="flex items-start gap-1.5 text-xs font-semibold leading-4 text-muted-foreground">
					{selectedRoom
						? <Home className="mt-0.5 size-3 shrink-0 text-emerald-600" />
						: <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning" />}
					<span data-testid="section-row-home-room">
						{selectedRoom
							? `${selectedRoom.name} · ${selectedRoom.buildingName}`
							: 'Needs a home room'}
					</span>
				</div>
			</td>

			<td className="px-4 py-3 text-right">
				<div className="flex justify-end gap-1">
					{/* Phase 1.6: removed the redundant Users icon action (the
						section-name button already opens the same details sheet).
						The kebab is the only icon; the section-name button above
						acts as the primary "View" entry point and carries a visible
						Tooltip ("View section details"). */}
					{/* A3 C4 (top-10 #3): the map is now one visible click away instead
						of two clicks deep inside the home-room dropdown. It sits here,
						beside the kebab, deliberately: this cell is `text-right` with
						`items` already 32px tall, so the control adds ZERO vertical
						height to a row on a page graded for density at 1366x768. It is a
						labelled icon button (real aria-label naming the section +
						Tooltip), never a bare icon, and it does not touch the kebab or
						the onHomeRoomChange path.

						A3 C4 review finding N2: this control is deliberately NOT
						`disabled` in read-only mode, while the sibling
						`SectionRoomPicker` IS. Disabling it would remove a legitimate
						READ capability in exactly the degraded state where the operator
						most needs to see where the rooms are, and a `disabled` button is
						not keyboard reachable — it would drop out of the tab order and
						out of the screen reader's list of controls on the row. Instead
						the read-only truth is carried in the Tooltip, which is the
						affordance AGENTS.md §8 requires for this kind of help, so the
						operator learns BEFORE opening that picking is paused. The
						`aria-label` is unchanged: the control's accessible name is its
						purpose, not its current permission, and the tooltip states the
						permission. */}
					<TooltipProvider delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-8 text-muted-foreground"
									aria-label={`View room map for ${section.name}`}
									onClick={() => onShowRoomMap(section)}
								>
									<MapIcon className="size-4" aria-hidden="true" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="left">
								{isReadOnly ? 'View room map (read-only: picking a room is paused)' : 'View room map'}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`More actions for ${section.name}`}>
								<MoreVertical className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem onClick={() => onShowDetails(section)}>
								<Users className="mr-2 size-4" />
								<span>View class coverage</span>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to={`/teaching-load?sectionId=${section.id}`}>
									<ClipboardList className="mr-2 size-4" />
									<span>Open teaching load</span>
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</td>
		</tr>
	);
}
