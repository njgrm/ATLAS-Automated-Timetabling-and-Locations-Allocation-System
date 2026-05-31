import {
	MoreVertical,
	Users,
	ClipboardList,
	Home,
	AlertTriangle,
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
	if (pct >= 95) return 'bg-red-600 text-white';
	if (pct >= 85) return 'bg-amber-500 text-white';
	if (pct >= 70) return 'bg-emerald-600 text-white';
	return 'bg-muted text-muted-foreground';
}

/* ─── Types ─── */
export type SectionDetail = {
	mirrorId?:     number;
	id:            number;
	name:          string;
	maxCapacity:   number;
	enrolledCount: number;
	gradeLevelId:  number;
	gradeLevelName: string;
	homeRoomId?:   number | null;
	buildingZoneId?: string | null;
	programType?:    string;
	programCode?:    string;
	programName?:    string;
	isSpecialProgram?: boolean;
};

interface SectionRowProps {
	section: SectionDetail;
	homeRoomOptions: RoomOption[];
	isReadOnly: boolean;
	isSaving: boolean;
	onHomeRoomChange: (section: SectionDetail, value: number | null) => void;
	onShowDetails: (section: SectionDetail) => void;
	schoolId: number;
	roomOccupancy?: Map<number, string>;
}

export function SectionRow({
	section,
	homeRoomOptions,
	isReadOnly,
	isSaving,
	onHomeRoomChange,
	onShowDetails,
	schoolId,
	roomOccupancy,
}: SectionRowProps) {
	const fill = section.maxCapacity > 0 ? Math.round((section.enrolledCount / section.maxCapacity) * 100) : 0;
	const gKey = gradeKey(section.gradeLevelName);
	const gColor = GRADE_COLORS[gKey] ?? 'bg-muted text-muted-foreground';
	const gradeLabel = `G${section.gradeLevelName.replace(/^Grade\s+/i, '')}`;
	const selectedRoom = homeRoomOptions.find((room) => room.id === section.homeRoomId);

	return (
		<tr className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
			<td className="px-4 py-3">
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
						<div className="flex items-center gap-2">
							<span className="font-semibold text-foreground leading-tight truncate">{section.name}</span>
							{section.isSpecialProgram && section.programCode && (
								<Badge
									variant="outline"
									className={`text-[0.6rem] px-1.5 py-0 h-4 font-bold border-opacity-50 ${PROGRAM_BADGE[section.programCode] ?? PROGRAM_BADGE.OTHER}`}
								>
									{section.programCode}
								</Badge>
							)}
						</div>
						<span className="text-[0.65rem] text-muted-foreground uppercase tracking-tight">
							{section.isSpecialProgram ? section.programName : 'Regular Program'}
						</span>
					</div>
				</Button>
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
					<span className="text-[0.65rem] text-muted-foreground uppercase tracking-tighter">Students</span>
				</div>
			</td>

			<td className="px-4 py-3 text-right">
				<div className="flex flex-col items-end">
					<span className="text-sm font-medium tabular-nums text-muted-foreground">{section.maxCapacity}</span>
					<span className="text-[0.65rem] text-muted-foreground uppercase tracking-tighter">Capacity</span>
				</div>
			</td>

			<td className="px-4 py-3 text-right">
				<span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${fillColor(fill)}`}>
					{fill}%
				</span>
			</td>

			<td className="px-4 py-3 min-w-56">
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
					<div className="flex items-start gap-1.5 text-[0.68rem] font-semibold leading-4 text-muted-foreground">
						{selectedRoom ? <Home className="mt-0.5 size-3 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-600" />}
						<span>
							{selectedRoom
								? `${selectedRoom.buildingName} is the current home-room building.`
								: isReadOnly
								? 'Needs a home room. Edits are paused until the source is ready.'
								: 'Needs a home room. Choose a room to make this section schedulable.'}
						</span>
					</div>
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
									onClick={() => onShowDetails(section)}
									aria-label={`View class coverage for ${section.name}`}
								>
									<Users className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>View class coverage and room context</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Link to={`/teaching-load?sectionId=${section.id}`}>
									<Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary" aria-label={`Open teaching load for ${section.name}`}>
										<ClipboardList className="size-4" />
									</Button>
								</Link>
							</TooltipTrigger>
							<TooltipContent>Open teaching load assignments</TooltipContent>
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
