import { CalendarClock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import type { FacultyRoomPreferenceEntry } from '@/types';
import ActionQueue from './ActionQueue';

type DesktopDashboardLayoutProps = {
	facultyName: string;
	phaseMessage: string;
	counts: {
		total: number;
		pending: number;
		approved: number;
		rejected: number;
		unchanged: number;
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
	const hasDrafts = entries.some(e => e.status === 'DRAFT');

	return (
		<div className='grid grid-cols-12 gap-8 h-full'>
			{/* Left Column: Greeting & Summary */}
			<div className='col-span-4 space-y-6'>
				<div className='space-y-1'>
					<h1 className='text-3xl font-bold tracking-tight'>Welcome, {facultyName}</h1>
					<p className='text-muted-foreground'>{phaseMessage}</p>
				</div>

				<ActionQueue counts={counts} hasDraftRoomRequests={hasDrafts} />

				{banners}

				<div className='grid grid-cols-2 gap-4'>
					<Card className='rounded-2xl border-border/50 bg-muted/10'>
						<CardContent className='p-4'>
							<p className='text-xs font-bold text-muted-foreground uppercase tracking-wider'>Total Classes</p>
							<p className='text-3xl font-bold mt-1'>{counts.total}</p>
						</CardContent>
					</Card>
					<Card className='rounded-2xl border-border/50 bg-blue-50/50'>
						<CardContent className='p-4'>
							<p className='text-xs font-bold text-blue-600 uppercase tracking-wider'>Pending Requests</p>
							<p className='text-3xl font-bold text-blue-700 mt-1'>{counts.pending}</p>
						</CardContent>
					</Card>
				</div>

				<Button asChild size='lg' className='w-full h-14 text-base font-bold rounded-2xl shadow-md'>
					<Link to='/my/room-preferences'>
						<MapPin className='size-5 mr-2' />
						Manage Room Requests
					</Link>
				</Button>
			</div>

			{/* Right Column: Full Schedule Preview Table */}
			<div className='col-span-8 flex flex-col min-h-0'>
				<div className='flex items-center justify-between mb-4'>
					<h2 className='text-lg font-bold flex items-center gap-2'>
						<CalendarClock className='size-5 text-primary' />
						Your Class Assignments
					</h2>
					<span className='text-xs font-bold text-muted-foreground uppercase'>Academic Review Phase</span>
				</div>

				<Card className='flex-1 min-h-0 overflow-hidden rounded-2xl border-border/50 shadow-sm'>
					<div className='h-full overflow-auto'>
						<table className='w-full text-sm'>
							<thead className='sticky top-0 z-10 bg-muted/80 backdrop-blur-sm'>
								<tr className='border-b border-border/50'>
									<th className='px-4 py-3 text-left font-bold text-muted-foreground uppercase text-[10px]'>Class / Section</th>
									<th className='px-4 py-3 text-left font-bold text-muted-foreground uppercase text-[10px]'>Schedule</th>
									<th className='px-4 py-3 text-left font-bold text-muted-foreground uppercase text-[10px]'>Room</th>
									<th className='px-4 py-3 text-right font-bold text-muted-foreground uppercase text-[10px]'>Status</th>
								</tr>
							</thead>
							<tbody className='divide-y divide-border/40'>
								{entries.map((entry) => (
									<tr key={entry.entryId} className='hover:bg-muted/30 transition-colors group'>
										<td className='px-4 py-4'>
											<div>
												<p className='font-bold'>{entry.subjectCode}</p>
												<p className='text-xs text-muted-foreground'>{entry.sectionName}</p>
											</div>
										</td>
										<td className='px-4 py-4'>
											<div className='flex flex-col'>
												<span className='font-medium'>{entry.day}</span>
												<span className='text-xs text-muted-foreground'>{entry.startTime} - {entry.endTime}</span>
											</div>
										</td>
										<td className='px-4 py-4'>
											<div className='flex flex-col'>
												<p className='font-medium'>{entry.currentRoomName}</p>
												{entry.requestedRoomName && (
													<p className='text-[11px] text-blue-600 font-bold'>Requested: {entry.requestedRoomName}</p>
												)}
											</div>
										</td>
										<td className='px-4 py-4 text-right'>
											<div className="flex flex-col items-end gap-1.5">
												{renderEntryBadge(entry)}
												<Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
													<Link to={`/my/room-preferences?entryId=${entry.entryId}`}>Request Move</Link>
												</Button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>
			</div>
		</div>
	);
}
