import { Link } from 'react-router-dom';
import { CalendarClock, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import type { FacultyRoomPreferenceEntry } from '@/types';
import type { FacultyPortalObjectiveState } from '@/types';
import type { FacultyTeachingAssignmentIdentity } from '@/types';
import ActionQueue from './ActionQueue';
import FacultyObjectiveStateCard from './FacultyObjectiveStateCard';
import TeachingIdentityPanel from './TeachingIdentityPanel';

type MobileDashboardLayoutProps = {
	facultyName: string;
	phaseMessage: string;
	counts: {
		total: number;
		pending: number;
		approved: number;
		rejected: number;
		unchanged: number;
	};
	schedulePreview: FacultyRoomPreferenceEntry[];
	renderEntryBadge: (entry: FacultyRoomPreferenceEntry) => ReactNode;
	banners?: ReactNode;
	teachingAssignments?: FacultyTeachingAssignmentIdentity[];
	objectiveState: FacultyPortalObjectiveState;
};

export default function MobileDashboardLayout({
	facultyName,
	phaseMessage,
	counts,
	schedulePreview,
	renderEntryBadge,
	banners,
	teachingAssignments = [],
	objectiveState,
}: MobileDashboardLayoutProps) {
	const hasDrafts = schedulePreview.some(e => e.status === 'DRAFT');

	return (
		<div className='flex flex-col gap-6'>
			{/* Compact Greeting & Primary CTA */}
			<div className='space-y-4'>
				<div>
					<h1 className='text-2xl font-bold tracking-tight'>Hello, {facultyName} 👋</h1>
					<p className='text-sm text-muted-foreground mt-1'>{phaseMessage}</p>
				</div>

				<Button asChild size='lg' className='w-full h-14 text-base font-bold rounded-2xl shadow-md'>
					<Link to='/my/room-preferences'>
						<MapPin className='size-5 mr-2' />
						Manage My Room Requests
					</Link>
				</Button>
			</div>

			{/* Phase 3: Action Queue (Attention Center) */}
			<ActionQueue counts={counts} hasDraftRoomRequests={hasDrafts} objectiveState={objectiveState} />

			<FacultyObjectiveStateCard objectiveState={objectiveState} compact />

			{/* Status Banners (Progressive Disclosure) - Optional if redundant with GlobalHeader */}
			{banners && <div className='space-y-3'>{banners}</div>}

			{/* Summary Tiles - Font size fix */}
			<div className='grid grid-cols-3 gap-3'>
				<Card className='rounded-2xl border-border/50 bg-muted/20'>
					<CardContent className='p-3 text-center'>
						<p className='text-xs font-bold text-muted-foreground uppercase'>Teaching Load</p>
						<p className='text-lg font-bold mt-1'>{teachingAssignments.length}</p>
					</CardContent>
				</Card>
				<Card className='rounded-2xl border-border/50 bg-blue-50/50'>
					<CardContent className='p-3 text-center'>
						<p className='text-xs font-bold text-blue-600 uppercase'>Pending</p>
						<p className='text-lg font-bold text-blue-700 mt-1'>{counts.pending}</p>
					</CardContent>
				</Card>
				<Card className='rounded-2xl border-border/50 bg-emerald-50/50'>
					<CardContent className='p-3 text-center'>
						<p className='text-xs font-bold text-emerald-600 uppercase'>Approved</p>
						<p className='text-lg font-bold text-emerald-700 mt-1'>{counts.approved}</p>
					</CardContent>
				</Card>
			</div>

			{/* Short Schedule Preview */}
			<TeachingIdentityPanel assignments={teachingAssignments} maxSections={4} compact />

			{/* Short Schedule Preview */}
			<div className='space-y-3'>
				<div className='flex items-center justify-between'>
					<h2 className='text-sm font-bold flex items-center gap-2'>
						<CalendarClock className='size-4 text-primary' />
						Upcoming Classes
					</h2>
					<Button asChild variant='ghost' size='sm' className='text-xs font-bold h-8'>
						<Link to='/my/room-preferences'>View All</Link>
					</Button>
				</div>

				<div className='space-y-2'>
					{schedulePreview.length === 0 ? (
						<div className='rounded-2xl border-2 border-dashed px-4 py-8 text-center'>
							<p className='text-xs font-bold text-foreground'>{objectiveState.title}</p>
							<p className='mt-1 text-xs leading-relaxed text-muted-foreground'>{objectiveState.roomRequestMessage}</p>
						</div>
					) : (
						schedulePreview.slice(0, 5).map((entry) => (
							<Card key={entry.entryId} className='rounded-xl border-border/50 overflow-hidden shadow-sm'>
								<CardContent className='p-3 flex items-center justify-between gap-3'>
									<div className='min-w-0'>
											<p className='text-xs font-bold truncate'>{entry.subjectDisplayLabel ?? entry.subjectCode} • {entry.sectionName}</p>
										<p className='text-[10px] text-muted-foreground mt-0.5 truncate'>{entry.currentRoomName}</p>
										{/* Quick-Request Link (Phase 4.2) */}
										<Button asChild variant="link" size="sm" className="h-auto p-0 text-[10px] font-bold text-primary">
											<Link to={`/my/room-preferences?entryId=${entry.entryId}`}>Request Move</Link>
										</Button>
									</div>
									<div className='shrink-0'>
										{renderEntryBadge(entry)}
									</div>
								</CardContent>
							</Card>
						))
					)}
				</div>
			</div>
		</div>
	);
}
