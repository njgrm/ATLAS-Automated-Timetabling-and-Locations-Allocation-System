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
import { SectionRoomPicker, type RoomOption } from './SectionRoomPicker';
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
	/** A9 C7: one WRITE control is back on the row, so it needs the page's
	 *  actor-school scope and the occupancy map the picker shows. */
	schoolId: number;
	roomOccupancy?: Map<number, string>;
	isSaving?: boolean;
	onHomeRoomChange: (section: SectionDetail, roomId: number | null) => void;
	onShowDetails: (section: SectionDetail) => void;
	/** A3 C4: opens the existing room map scoped to THIS section. */
	onShowRoomMap: (section: SectionDetail) => void;
}

export function SectionRow({
	section,
	homeRoomOptions,
	isReadOnly,
	schoolId,
	roomOccupancy,
	isSaving = false,
	onHomeRoomChange,
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
				{/* A9 C7 (2026-09-29) — THE ROW PICKER IS BACK, ON LANE C's BINDING ADDENDUM.
				    THE HISTORY, so this cell is not re-litigated a third time. A9 C3
				    (`86665f48`) removed the inline picker from this table and left a plain
				    READ, because the older-user audit had graded the twenty repeated
				    "Choose home room" controls as tedium. That decision was OVERRULED: the
				    operator reported item 46 against the row control she actually uses, and
				    manual assignment is the demo priority. So on 2026-09-29 at 15:55 Lane C
				    issued a binding addendum — packet
				    `docs/prompts/fix-3-2026-09-29.md`, item 46 plus that addendum — and the
				    per-row picker was restored. The guided bulk step
				    (`HomeRoomAutoAssignDialog`) is still the PRIMARY action; this row is the
				    manual override beside it, not a replacement for it, and the two write
				    through the same `onHomeRoomChange`.

				    WHAT DID NOT CHANGE, and is the part that has to stay true:
				    - NO write path was added or removed. The picker calls the page's
				      `handleHomeRoomChange` — the same callback the row's map button
				      reaches through `SectionsHomeRoomMapModals` and the same one the
				      guided dialog reaches. It was already in this file's props before
				      A9 C3 and is being restored, not added.
				    - `resolveHomeRoom` is still the ONE definition of "has a home room"
				      (A3 C4 defect A) for the status line below the control, and the
				      amber icon is the measured `--warning` token, not a raw amber
				      class (a3-c8-warning-token.test.ts).
				    - ONE primitive, THREE surfaces: this row, `SectionMobileCard` and
				      the guided dialog all render the SAME `SectionRoomPicker`, so the
				      control cannot look different per page (AGENTS.md §8). A9 C7's
				      item-46 geometry fix therefore lands on all three at once.
				    - The SHAPE is the mobile card's (`SectionMobileCard.tsx:88-104`): the
				      control in a `space-y-1.5` block with ONE status line under it,
				      minus the card's extra chrome. The status line is a fixed `h-4`
				      one-line row with a `truncate`d span, so assigning a room changes
				      its TEXT and never the row's HEIGHT — a table that jumps when you
				      save is a table you lose your place in. The A9 C3 wording the C4
				      suites assert is kept verbatim (`Needs a home room` / `{room} ·
				      {building}`); the pre-A9-C3 "Needs home room. Choose a room." /
				      "Ready: …" sentences and any read-only sentence are NOT brought
				      back, because the control itself already says what it is. */}
				<div className="space-y-1.5">
					<SectionRoomPicker
						sectionId={section.id}
						sectionName={section.name}
						value={section.homeRoomId ?? null}
						options={homeRoomOptions}
						onSelect={(roomId) => onHomeRoomChange(section, roomId)}
						disabled={isReadOnly}
						isSaving={isSaving}
						schoolId={schoolId}
						roomOccupancy={roomOccupancy}
					/>
					{/* ONE line, ALWAYS h-4, so the row does not change height when a room
						is assigned. The cue icons are the A9 C3 ones. */}
					<div className="flex h-4 items-center gap-1.5 text-xs font-semibold leading-4 text-muted-foreground">
						{selectedRoom
							? <Home className="size-3 shrink-0 text-emerald-600" aria-hidden="true" />
							: <AlertTriangle className="size-3 shrink-0 text-warning" aria-hidden="true" />}
						<span data-testid="section-row-home-room" className="min-w-0 truncate">
							{selectedRoom
								? `${selectedRoom.name} · ${selectedRoom.buildingName}`
								: 'Needs a home room'}
						</span>
					</div>
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
