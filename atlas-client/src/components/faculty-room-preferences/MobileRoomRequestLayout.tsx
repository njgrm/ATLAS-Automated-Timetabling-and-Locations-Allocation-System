import type { ReactNode } from 'react';

import { formatTime } from '@/lib/utils';
import type { DayOfWeek, FacultyRoomPreferenceEntry, RoomPreferenceDecisionStatus, RoomPreferenceStatus } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';

type MobileTarget = {
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	targetEntryId: string | null;
	occupiedLabel: string | null;
};

type MobileRoomRequestLayoutProps = {
	mobileStep: 1 | 2 | 3;
	entries: FacultyRoomPreferenceEntry[];
	selectedSourceEntryId: string | null;
	selectedEntry: FacultyRoomPreferenceEntry | null;
	mobileTargets: MobileTarget[];
	onSelectSourceEntry: (entryId: string) => void;
	onSelectTargetSlot: (target: MobileTarget) => void;
	onStepBack: () => void;
	onStepForward: () => void;
	renderStatusBadge: (status: RoomPreferenceStatus | null, decision: RoomPreferenceDecisionStatus | null) => ReactNode;
};

export default function MobileRoomRequestLayout({
	mobileStep,
	entries,
	selectedSourceEntryId,
	selectedEntry,
	mobileTargets,
	onSelectSourceEntry,
	onSelectTargetSlot,
	onStepBack,
	onStepForward,
	renderStatusBadge,
}: MobileRoomRequestLayoutProps) {
	return (
		<>
			<div className='flex-1 min-h-0 overflow-auto px-4 pb-28 lg:hidden'>
				<div className='space-y-4'>
					{mobileStep === 1 && (
						<Card className='rounded-2xl border-border'>
							<CardContent className='space-y-3 p-4'>
								<div className='flex items-center justify-between gap-2'>
									<p className='text-sm font-semibold'>Select Your Class</p>
									<Badge variant='outline' className='text-[11px]'>First action</Badge>
								</div>
								<p className='text-xs text-muted-foreground'>Tap a class card to continue to the next step.</p>
								<div className='space-y-2'>
									{entries.map((entry) => (
										<button
											key={`mobile-source-${entry.entryId}`}
											type='button'
											onClick={() => onSelectSourceEntry(entry.entryId)}
											className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
												selectedSourceEntryId === entry.entryId
													? 'border-primary bg-primary/5'
													: 'border-border hover:border-primary/40 active:bg-muted'
											}`}
										>
											<div className='flex items-start gap-3'>
												<div
													className={`mt-0.5 size-5 shrink-0 rounded-full border-2 ${
														selectedSourceEntryId === entry.entryId ? 'border-primary bg-primary' : 'border-muted-foreground/40'
													}`}
												/>
												<div className='min-w-0 flex-1 space-y-1'>
													<div className='flex flex-wrap items-center gap-2'>
														<Badge variant='outline'>{entry.subjectCode}</Badge>
														{renderStatusBadge(entry.status, entry.decisionStatus)}
													</div>
													<p className='text-sm font-semibold text-foreground'>{entry.sectionName}</p>
													<p className='text-xs text-muted-foreground'>
														{entry.day.slice(0, 3)} {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
													</p>
													<p className='text-xs text-muted-foreground'>Room: {entry.currentRoomName}</p>
												</div>
											</div>
										</button>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{mobileStep === 2 && selectedEntry && (
						<Card className='rounded-2xl border-border'>
							<CardContent className='space-y-3 p-4'>
								<p className='text-sm font-semibold'>Choose Target Slot</p>
								<div className='rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm'>
									<p className='font-medium'>
										{selectedEntry.sectionName} - {selectedEntry.subjectCode}
									</p>
									<p className='mt-0.5 text-xs text-muted-foreground'>
										{selectedEntry.day.slice(0, 3)} {formatTime(selectedEntry.startTime)} - {formatTime(selectedEntry.endTime)} - {selectedEntry.currentRoomName}
									</p>
								</div>
								<p className='text-xs text-muted-foreground'>Free slots = move request. Occupied slots = swap request.</p>
								<div className='space-y-2'>
									{mobileTargets.map((target) => (
										<button
											key={`mobile-target-${target.day}-${target.startTime}-${target.endTime}`}
											type='button'
											onClick={() => onSelectTargetSlot(target)}
											className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
												target.occupiedLabel
													? 'border-amber-200 bg-amber-50/50 hover:border-amber-400 active:bg-amber-100'
													: 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400 active:bg-emerald-100'
											}`}
										>
											<p className='text-sm font-semibold text-foreground'>
												{target.day.slice(0, 3)} {formatTime(target.startTime)} - {formatTime(target.endTime)}
											</p>
											<p className={`mt-0.5 text-xs font-medium ${target.occupiedLabel ? 'text-amber-700' : 'text-emerald-700'}`}>
												{target.occupiedLabel ? `Occupied - ${target.occupiedLabel}` : 'Free - move here'}
											</p>
										</button>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</div>

			<div className='fixed inset-x-0 bottom-0 z-20 flex gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden'>
				{mobileStep > 1 && (
					<Button variant='outline' className='min-h-12 flex-1' onClick={onStepBack}>
						Back
					</Button>
				)}
				{mobileStep === 1 && (
					<Button className='min-h-12 flex-1' disabled={!selectedSourceEntryId} onClick={onStepForward}>
						Choose Target
					</Button>
				)}
			</div>
		</>
	);
}
