import { Link } from 'react-router-dom';
import { CalendarClock, MapPin, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import type { FacultyRoomPreferenceEntry } from '@/types';
import WeeklyScheduleGrid from '@/components/faculty-shared/WeeklyScheduleGrid';

type DesktopDashboardLayoutProps = {
	facultyName: string;
	phaseMessage: string;
	counts: {
		total: number;
		pending: number;
		approved: number;
	};
	entries: FacultyRoomPreferenceEntry[];
	renderEntryBadge: (entry: FacultyRoomPreferenceEntry) => ReactNode;
	banners?: ReactNode;
};

export default function DesktopDashboardLayout({
	facultyName,
	phaseMessage,
	counts,
	entries,
	renderEntryBadge,
	banners,
}: DesktopDashboardLayoutProps) {
	return (
		<div className='grid grid-cols-[380px_1fr] gap-8 h-full'>
			{/* Left Column: Action and Status Context */}
			<div className='space-y-6 overflow-y-auto pr-2'>
				<div className='space-y-1'>
					<h1 className='text-3xl font-bold tracking-tight'>Hello, {facultyName} 👋</h1>
					<p className='text-muted-foreground'>{phaseMessage}</p>
				</div>

				<div className='grid grid-cols-3 gap-3'>
					<div className='flex flex-col items-center justify-center p-4 rounded-2xl border border-border bg-card'>
						<span className='text-2xl font-bold'>{counts.total}</span>
						<span className='text-[10px] font-bold text-muted-foreground uppercase mt-1'>Classes</span>
					</div>
					<div className='flex flex-col items-center justify-center p-4 rounded-2xl border border-blue-100 bg-blue-50/30'>
						<span className='text-2xl font-bold text-blue-600'>{counts.pending}</span>
						<span className='text-[10px] font-bold text-blue-600 uppercase mt-1'>Pending</span>
					</div>
					<div className='flex flex-col items-center justify-center p-4 rounded-2xl border border-emerald-100 bg-emerald-50/30'>
						<span className='text-2xl font-bold text-emerald-600'>{counts.approved}</span>
						<span className='text-[10px] font-bold text-emerald-600 uppercase mt-1'>Approved</span>
					</div>
				</div>

				<Card className='rounded-2xl border-primary/20 bg-primary/5 shadow-sm'>
					<CardContent className='p-6 space-y-4'>
						<div className='space-y-2'>
							<h3 className='font-bold text-primary flex items-center gap-2'>
								<MapPin className='size-5' />
								Manage Room Requests
							</h3>
							<p className='text-sm text-primary/80 leading-relaxed'>
								Need to change a room or time slot? Submit your requests here and track their status in real-time.
							</p>
						</div>
						<Button asChild className='w-full h-12 rounded-xl font-bold shadow-sm' size='lg'>
							<Link to='/my/room-preferences'>
								Go to Room Requests <ArrowRight className='ml-2 size-4' />
							</Link>
						</Button>
					</CardContent>
				</Card>

				{banners && <div className='space-y-4'>{banners}</div>}
			</div>

			{/* Right Column: Weekly Schedule Grid */}
			<div className='flex flex-col min-h-0 bg-muted/10 rounded-3xl border border-border overflow-hidden'>
				<div className='p-6 border-b border-border bg-card/50 flex items-center justify-between shrink-0'>
					<h2 className='text-lg font-bold flex items-center gap-2'>
						<CalendarClock className='size-5 text-primary' />
						Your Weekly Schedule
					</h2>
					<Badge variant='outline' className='bg-background px-3 py-1'>
						Draft Run Context
					</Badge>
				</div>
				
				<div className='flex-1 min-h-0 overflow-auto p-6'>
					<WeeklyScheduleGrid
						entries={entries}
						renderEntryBadge={renderEntryBadge}
					/>
				</div>
			</div>
		</div>
	);
}
