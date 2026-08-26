import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { SectionRoomPicker, type RoomOption as HomeRoomOption } from '@/components/sections/SectionRoomPicker';
import { cn } from '@/lib/utils';
import { gradeCompact } from '@/lib/deped-glossary';
import type { Room } from '@/types';
import type { SectionDetail } from '@/components/sections/SectionRow';

const GRADE_COLORS: Record<string, string> = {
	'7':  'bg-green-100/80 text-green-700',
	'8':  'bg-yellow-100/80 text-yellow-700',
	'9':  'bg-red-100/80 text-red-700',
	'10': 'bg-blue-100/80 text-blue-700',
};

function gradeKey(name: string) {
	const m = name.match(/\d+/);
	return m ? m[0] : '';
}

type Props = {
	section: SectionDetail;
	homeRoomOptions: HomeRoomOption[];
	isReadOnly: boolean;
	isSaving: boolean;
	schoolId: number;
	roomOccupancy: Map<number, string>;
	onHomeRoomChange: (section: SectionDetail, roomId: number | null) => void;
	onShowDetails: (section: SectionDetail) => void;
};

export function SectionMobileCard({ section, homeRoomOptions, isReadOnly, isSaving, schoolId, roomOccupancy, onHomeRoomChange, onShowDetails }: Props) {
	const fill = section.maxCapacity > 0 ? Math.round((section.enrolledCount / section.maxCapacity) * 100) : 0;
	const gKey = gradeKey(section.gradeLevelName);
	const selectedRoom = homeRoomOptions.find((room) => room.id === section.homeRoomId);
	const fillTone = fill >= 95
		? 'border-slate-800 bg-slate-800 text-white'
		: fill >= 85
		? 'border-amber-500 bg-amber-500 text-white'
		: fill >= 70
		? 'border-emerald-600 bg-emerald-600 text-white'
		: 'border-slate-200 bg-slate-50 text-slate-700';

	return (
		<div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-sm" data-testid="section-mobile-card">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<Badge className={cn('h-6 rounded-full border-0 text-xs font-bold', GRADE_COLORS[gKey] ?? 'bg-muted text-muted-foreground')}>
							{gradeCompact(Number(gKey))}
						</Badge>
						{section.isSpecialProgram && section.programCode && (
							<Badge variant="outline" className="h-6 rounded-full bg-white text-xs font-bold">
								{section.programCode}
							</Badge>
						)}
					</div>
					<h3 className="mt-2 truncate text-base font-bold text-foreground">{section.name}</h3>
					<p className="mt-0.5 text-xs font-medium text-muted-foreground">
						{section.isSpecialProgram ? section.programName : 'Regular Program'}
					</p>
				</div>
				<Badge variant="outline" className={cn('h-7 shrink-0 rounded-full px-2 text-xs font-bold', fillTone)}>
					{fill}% full
				</Badge>
			</div>

			<div className="mt-3 grid grid-cols-2 gap-2 text-xs">
				<div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
					<p className="font-bold uppercase tracking-widest text-muted-foreground">Enrolled</p>
					<p className="mt-1 text-sm font-bold text-foreground">{section.enrolledCount} / {section.maxCapacity}</p>
				</div>
				<div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
					<p className="font-bold uppercase tracking-widest text-muted-foreground">Home room</p>
					<p className={cn('mt-1 truncate text-sm font-bold', selectedRoom ? 'text-emerald-700' : 'text-amber-700')}>
						{selectedRoom ? selectedRoom.name : 'Needs room'}
					</p>
				</div>
			</div>

			<div className="mt-3 space-y-1.5">
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
				<p className={cn('flex items-center gap-1.5 text-xs font-semibold', selectedRoom ? 'text-emerald-700' : 'text-amber-700')}>
					{selectedRoom ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
					{selectedRoom ? `Ready in ${selectedRoom.buildingName}` : isReadOnly ? 'Needs home room. Edits are paused.' : 'Choose a home room first.'}
				</p>
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3">
				<Button type="button" size="sm" variant="outline" className="h-11 flex-1 font-bold" onClick={() => onShowDetails(section)}>
					View details
				</Button>
				<Button asChild size="sm" className="h-11 flex-1 font-bold">
					<Link to={`/teaching-load?sectionId=${section.id}`}>Teaching Load</Link>
				</Button>
			</div>
		</div>
	);
}
