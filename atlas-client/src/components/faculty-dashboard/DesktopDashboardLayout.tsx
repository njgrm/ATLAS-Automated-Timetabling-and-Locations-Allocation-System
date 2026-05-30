import { CalendarClock, MapPin, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import type { FacultyRoomPreferenceEntry, FacultyPortalObjectiveState, FacultyTeachingAssignmentIdentity } from '@/types';
import ActionQueue from './ActionQueue';
import FacultyObjectiveStateCard from './FacultyObjectiveStateCard';
import TeachingIdentityPanel from './TeachingIdentityPanel';

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
	teachingAssignments?: FacultyTeachingAssignmentIdentity[];
	objectiveState: FacultyPortalObjectiveState;
};

function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
	return (
		<div className='rounded-xl border border-border/60 bg-card px-4 py-3'>
			<p className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>{label}</p>
			<p className='mt-1 text-2xl font-bold leading-none text-foreground'>{value}</p>
			{hint && <p className='mt-1 text-[11px] text-muted-foreground'>{hint}</p>}
		</div>
	);
}

export default function DesktopDashboardLayout({
	facultyName,
	phaseMessage,
	counts,
	entries,
	renderEntryBadge,
	banners,
	teachingAssignments = [],
	objectiveState,
}: DesktopDashboardLayoutProps) {
	const hasDrafts = entries.some((e) => e.status === 'DRAFT');
	const firstName = facultyName.split(' ')[0] || facultyName;

	return (
		<div className='mx-auto flex h-full w-full max-w-7xl flex-col gap-6'>
			{/* Hero strip */}
			<section className='flex flex-wrap items-end justify-between gap-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm'>
				<div className='min-w-0'>
					<p className='text-[11px] font-semibold uppercase tracking-wider text-primary/80'>Faculty workspace</p>
					<h1 className='mt-1 text-3xl font-bold tracking-tight text-foreground'>Welcome back, {firstName}</h1>
					<p className='mt-1.5 max-w-xl text-sm text-muted-foreground'>{phaseMessage}</p>
				</div>
				<div className='flex flex-wrap items-stretch gap-3'>
					<StatTile label='Teaching load' value={teachingAssignments.length} hint='active assignments' />
					<StatTile label='Pending' value={counts.pending} hint='awaiting decision' />
					<StatTile label='Approved' value={counts.approved} hint='ready in schedule' />
				</div>
			</section>

			{/* 3-col workbench */}
			<div className='grid grid-cols-12 gap-6'>
				<div className='col-span-4 flex flex-col gap-4'>
					<ActionQueue counts={counts} hasDraftRoomRequests={hasDrafts} objectiveState={objectiveState} />
					<FacultyObjectiveStateCard objectiveState={objectiveState} />
					{banners}
					<Button asChild size='lg' className='h-12 w-full rounded-xl text-sm font-semibold'>
						<Link to='/my/room-preferences'>
							<MapPin className='mr-2 size-4' />
							Open room requests
						</Link>
					</Button>
				</div>

				<div className='col-span-8 flex min-h-0 flex-col gap-4'>
					<TeachingIdentityPanel assignments={teachingAssignments} maxSections={6} />

					<Card className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-border/60 shadow-sm'>
						<div className='flex items-center justify-between border-b border-border/60 px-5 py-3'>
							<h2 className='flex items-center gap-2 text-sm font-semibold text-foreground'>
								<CalendarClock className='size-4 text-primary' />
								Your class assignments
							</h2>
							<span className='text-[11px] font-medium text-muted-foreground'>Review phase</span>
						</div>
						<div className='min-h-0 flex-1 overflow-auto'>
							<table className='w-full text-sm'>
								<thead className='sticky top-0 z-10 bg-muted/60 backdrop-blur-sm'>
									<tr className='border-b border-border/60'>
										<th className='px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>Class</th>
										<th className='px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>Schedule</th>
										<th className='px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>Room</th>
										<th className='px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>Status</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-border/40'>
									{entries.length === 0 ? (
										<tr>
											<td colSpan={4} className='px-5 py-14 text-center'>
												<p className='text-sm font-semibold text-foreground'>{objectiveState.title}</p>
												<p className='mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground'>{objectiveState.roomRequestMessage}</p>
											</td>
										</tr>
									) : (
										entries.map((entry) => (
											<tr key={entry.entryId} className='group transition-colors hover:bg-muted/40'>
												<td className='px-5 py-3'>
													<p className='font-semibold text-foreground'>{entry.subjectDisplayLabel ?? entry.subjectCode}</p>
													<p className='text-xs text-muted-foreground'>{entry.sectionName}</p>
												</td>
												<td className='px-5 py-3'>
													<p className='font-medium text-foreground'>{entry.day}</p>
													<p className='text-xs text-muted-foreground'>{entry.startTime} – {entry.endTime}</p>
												</td>
												<td className='px-5 py-3'>
													<p className='font-medium text-foreground'>{entry.currentRoomName}</p>
													{entry.requestedRoomName && (
														<p className='mt-0.5 text-[11px] font-semibold text-primary'>Requested: {entry.requestedRoomName}</p>
													)}
												</td>
												<td className='px-5 py-3'>
													<div className='flex items-center justify-end gap-2'>
														{renderEntryBadge(entry)}
														<Link
															to={`/my/room-preferences?entryId=${entry.entryId}`}
															className='inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[12px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100'
														>
															Request move <ChevronRight className='size-3' />
														</Link>
													</div>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
}
