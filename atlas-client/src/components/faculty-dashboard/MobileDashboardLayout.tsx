import type { ReactNode } from 'react';

import { Card, CardContent } from '@/ui/card';
import type { FacultyRoomPreferenceEntry, FacultyPortalObjectiveState, FacultyTeachingAssignmentIdentity } from '@/types';
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
	const hasDrafts = schedulePreview.some((e) => e.status === 'DRAFT');
	const firstName = facultyName.split(' ')[0] || facultyName;

	return (
		<div className='flex flex-col gap-5'>
			{/* Greeting hero */}
			<section className='rounded-2xl bg-linear-to-br from-primary to-primary/80 px-5 py-5 text-primary-foreground shadow-md'>
				<p className='text-[12px] font-medium uppercase tracking-wider text-primary-foreground/80'>Welcome back</p>
				<h1 className='mt-1 text-2xl font-bold leading-tight'>{firstName}</h1>
				<p className='mt-1 text-[13px] leading-snug text-primary-foreground/85'>{phaseMessage}</p>
			</section>

			{/* D6 — teacher self-service is view-only; the removed portal quick
			    actions are replaced by a read-only request-status summary. */}
			<section className='grid grid-cols-2 gap-3'>
				<Card className='rounded-2xl border-border/70 shadow-sm'>
					<CardContent className='flex flex-col justify-between p-4'>
						<p className='text-[11px] font-medium uppercase tracking-wider text-muted-foreground'>Pending</p>
						<div className='mt-2 flex items-baseline justify-between'>
							<span className='text-2xl font-bold'>{counts.pending}</span>
							<span className='text-[11px] text-muted-foreground'>{counts.approved} approved</span>
						</div>
					</CardContent>
				</Card>
				<Card className='rounded-2xl border-border/70 shadow-sm'>
					<CardContent className='flex flex-col justify-between p-4'>
						<p className='text-[11px] font-medium uppercase tracking-wider text-muted-foreground'>Total tracked</p>
						<div className='mt-2 flex items-baseline justify-between'>
							<span className='text-2xl font-bold'>{counts.total}</span>
							<span className='text-[11px] text-muted-foreground'>classes</span>
						</div>
					</CardContent>
				</Card>
			</section>

			{/* Attention items */}
			<ActionQueue counts={counts} hasDraftRoomRequests={hasDrafts} objectiveState={objectiveState} />

			<FacultyObjectiveStateCard objectiveState={objectiveState} compact />

			{banners && <div className='space-y-3'>{banners}</div>}

			{/* Teaching identity */}
			<TeachingIdentityPanel assignments={teachingAssignments} maxSections={4} compact />

			{/* Upcoming classes */}
			<section className='space-y-2'>
				<div className='flex items-center justify-between px-1'>
					<h2 className='text-[13px] font-semibold text-foreground'>Upcoming classes</h2>
				</div>

				<div className='space-y-2'>
					{schedulePreview.length === 0 ? (
						<div className='rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center'>
							<p className='text-[13px] font-semibold text-foreground'>{objectiveState.title}</p>
							<p className='mt-1 text-[12px] leading-snug text-muted-foreground'>{objectiveState.roomRequestMessage}</p>
						</div>
					) : (
						schedulePreview.slice(0, 5).map((entry) => (
							<Card key={entry.entryId} className='rounded-2xl border-border/60 shadow-sm'>
								<CardContent className='flex items-start justify-between gap-3 p-3.5'>
									<div className='min-w-0'>
										<p className='truncate text-[14px] font-semibold leading-tight text-foreground'>{entry.subjectDisplayLabel ?? entry.subjectCode}</p>
										<p className='mt-0.5 truncate text-[12px] text-muted-foreground'>{entry.sectionName} · {entry.day} {entry.startTime}–{entry.endTime}</p>
										<p className='mt-0.5 truncate text-[12px] text-muted-foreground'>Room {entry.currentRoomName}</p>
									</div>
									<div className='shrink-0'>{renderEntryBadge(entry)}</div>
								</CardContent>
							</Card>
						))
					)}
				</div>
			</section>
		</div>
	);
}
