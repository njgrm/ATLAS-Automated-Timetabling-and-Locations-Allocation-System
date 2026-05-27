import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { formatTime } from '@/lib/utils';
import type { DayOfWeek, FacultyRoomPreferenceEntry, FacultyTeachingAssignmentIdentity, PreviewResult, RoomPreferenceDecisionStatus, RoomPreferenceStatus, RoomPreferenceSummaryItem } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import ConflictInspector from '@/components/faculty-shared/ConflictInspector';
import type { MobilePreviewSlot } from '@/hooks/useMobileConflictPreview';

type MobileTarget = {
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	targetEntryId: string | null;
	occupiedLabel: string | null;
};

const DAY_OPTIONS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
type TargetFilter = 'FREE' | 'SWAP' | 'ALL';

type MobileRoomRequestLayoutProps = {
	mobileStep: 1 | 2 | 3;
	entries: FacultyRoomPreferenceEntry[];
	teachingAssignments: FacultyTeachingAssignmentIdentity[];
	selectedSourceEntryId: string | null;
	selectedEntry: FacultyRoomPreferenceEntry | null;
	mobileTargets: MobileTarget[];
	recentRequests: RoomPreferenceSummaryItem[];
	showFullScheduleContext: boolean;
	previewSlot: MobilePreviewSlot | null;
	inlinePreview: PreviewResult | null;
	inlinePreviewLoading: boolean;
	onSelectSourceEntry: (entryId: string) => void;
	onSelectTargetSlot: (target: MobileTarget) => void;
	onContinueToReview: () => void;
	onClearPreviewTarget: () => void;
	onStepBack: () => void;
	onStepForward: () => void;
	renderStatusBadge: (status: RoomPreferenceStatus | null, decision: RoomPreferenceDecisionStatus | null) => ReactNode;
};

export default function MobileRoomRequestLayout({
	mobileStep,
	entries,
	teachingAssignments,
	selectedSourceEntryId,
	selectedEntry,
	mobileTargets,
	recentRequests,
	showFullScheduleContext,
	previewSlot,
	inlinePreview,
	inlinePreviewLoading,
	onSelectSourceEntry,
	onSelectTargetSlot,
	onContinueToReview,
	onClearPreviewTarget,
	onStepBack,
	onStepForward,
	renderStatusBadge,
}: MobileRoomRequestLayoutProps) {
	const [selectedDay, setSelectedDay] = useState<DayOfWeek>('MONDAY');
	const [targetFilter, setTargetFilter] = useState<TargetFilter>('FREE');
	const visibleTargets = useMemo(() => {
		return mobileTargets.filter((target) => {
			if (target.day !== selectedDay) return false;
			if (targetFilter === 'FREE') return target.targetEntryId == null;
			if (targetFilter === 'SWAP') return target.targetEntryId != null;
			return true;
		});
	}, [mobileTargets, selectedDay, targetFilter]);

	return (
		<>
			<div className='flex-1 min-h-0 overflow-auto px-4 pb-28 lg:hidden'>
				<div className='space-y-4'>
					{recentRequests.length > 0 && (
						<Card className='rounded-2xl border-primary/20 bg-primary/5'>
							<CardContent className='space-y-2 p-4'>
								<div className='flex items-center justify-between gap-2'>
									<p className='text-sm font-semibold'>Recent scheduler decisions</p>
									<Badge variant='outline' className='text-[11px]'>{recentRequests.length}</Badge>
								</div>
								{recentRequests.slice(0, 3).map((request) => (
									<div key={`recent-${request.id}`} className='rounded-xl border border-border bg-background px-3 py-2 text-xs'>
										<div className='flex items-center justify-between gap-2'>
											<span className='font-semibold text-foreground'>{request.subjectDisplayLabel}</span>
											{renderStatusBadge(request.status, request.decisionStatus)}
										</div>
										<p className='mt-1 text-muted-foreground'>
											{request.sectionName} · {request.requestedRoomName}
											{request.superseded ? ' · previous draft' : ''}
										</p>
										{request.reviewerNotes && <p className='mt-1 text-muted-foreground'>Scheduler note: {request.reviewerNotes}</p>}
									</div>
								))}
							</CardContent>
						</Card>
					)}

					{mobileStep === 1 && (
						<Card className='rounded-2xl border-border' data-tutorial='my-classes-panel'>
							<CardContent className='space-y-3 p-4'>
								<div className='flex items-center justify-between gap-2'>
									<p className='text-sm font-semibold'>Step 1: Pick Your Class</p>
									<Badge variant='outline' className='text-[11px]'>First action</Badge>
								</div>
								<p className='text-xs text-muted-foreground'>Tap the class you want to move, then press Choose Target.</p>
								<div className='space-y-2'>
									{entries.length === 0 ? (
										<div className='rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center'>
											<p className='text-sm font-bold text-foreground'>
												{teachingAssignments.length > 0 ? 'Classes not plotted for requests yet' : 'No teaching load linked yet'}
											</p>
											<p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
												{teachingAssignments.length > 0
													? 'Your teaching load exists, but the review draft has not placed classes for room-request review yet.'
													: 'Ask the scheduling officer to check your teaching load before room requests open.'}
											</p>
										</div>
									) : entries.map((entry) => (
										<Button
											key={`mobile-source-${entry.entryId}`}
											variant='outline'
											onClick={() => onSelectSourceEntry(entry.entryId)}
											className={`h-auto w-full justify-start rounded-xl border-2 p-4 text-left transition-colors ${
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
														<Badge variant='outline'>{entry.subjectDisplayLabel ?? entry.subjectCode}</Badge>
														{renderStatusBadge(entry.status, entry.decisionStatus)}
													</div>
													<p className='text-sm font-semibold text-foreground'>{entry.sectionName}</p>
													<p className='text-xs text-muted-foreground'>
														{entry.day.slice(0, 3)} {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
													</p>
													<p className='text-xs text-muted-foreground'>Room: {entry.currentRoomName}</p>
												</div>
											</div>
										</Button>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{mobileStep === 2 && selectedEntry && (
						<>
							<Card className='rounded-2xl border-border' data-tutorial='target-slot-map'>
								<CardContent className='space-y-3 p-4'>
									<p className='text-sm font-semibold'>Step 2: Choose Target</p>
									<div className='rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm'>
										<p className='font-medium'>
											{selectedEntry.sectionName} - {selectedEntry.subjectDisplayLabel ?? selectedEntry.subjectCode}
										</p>
										<p className='mt-0.5 text-xs text-muted-foreground'>
											{selectedEntry.day.slice(0, 3)} {formatTime(selectedEntry.startTime)} - {formatTime(selectedEntry.endTime)} - {selectedEntry.currentRoomName}
										</p>
									</div>
									<p className='text-xs text-muted-foreground'>Free slots create a move request. Occupied slots create a swap request.</p>
									<div className='flex gap-1 overflow-x-auto pb-1'>
										{DAY_OPTIONS.map((day) => (
											<Button
												key={day}
												variant={selectedDay === day ? 'default' : 'outline'}
												size='sm'
												className='h-9 min-w-14 shrink-0 px-3 text-xs'
												onClick={() => setSelectedDay(day)}
											>
												{day.slice(0, 3)}
											</Button>
										))}
									</div>
									<div className='grid grid-cols-3 gap-1'>
										{([
											['FREE', 'Free slots'],
											['SWAP', 'Swap'],
											['ALL', 'All'],
										] as const).map(([value, label]) => (
											<Button
												key={value}
												variant={targetFilter === value ? 'default' : 'outline'}
												size='sm'
												className='h-9 px-2 text-xs'
												onClick={() => setTargetFilter(value)}
											>
												{label}
											</Button>
										))}
									</div>
									<div className='space-y-2'>
										{visibleTargets.length === 0 ? (
											<div className='rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground'>
												No targets match this day and filter.
											</div>
										) : visibleTargets.map((target) => {
											const isSelected =
												previewSlot?.day === target.day &&
												previewSlot.startTime === target.startTime &&
												previewSlot.endTime === target.endTime;
											return (
												<Button
													key={`mobile-target-${target.day}-${target.startTime}-${target.endTime}`}
													variant='outline'
													onClick={() => onSelectTargetSlot(target)}
													className={`h-auto w-full justify-start rounded-xl border-2 p-4 text-left transition-colors ${
														isSelected
															? 'border-primary bg-primary/5 shadow-sm'
															: target.occupiedLabel
																? 'border-amber-200 bg-amber-50/50 hover:border-amber-400 active:bg-amber-100'
																: 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400 active:bg-emerald-100'
													}`}
												>
													<p className='text-sm font-semibold text-foreground'>
														{target.day.slice(0, 3)} {formatTime(target.startTime)} - {formatTime(target.endTime)}
													</p>
													<p className={`mt-0.5 text-xs font-medium ${
														isSelected
															? 'text-primary'
															: target.occupiedLabel ? 'text-amber-700' : 'text-emerald-700'
													}`}>
														{isSelected
															? 'Selected — see conflict check below'
															: target.occupiedLabel
																? showFullScheduleContext
																			? `Ask to swap - ${target.occupiedLabel}`
																			: 'Ask to swap with another class'
																		: 'Ask to move here'}
													</p>
												</Button>
											);
										})}
									</div>
								</CardContent>
							</Card>

							<AnimatePresence>
								{previewSlot && (
									<motion.div
										key={`${previewSlot.day}-${previewSlot.startTime}`}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: 6 }}
										transition={{ duration: 0.2 }}
										className='rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3'
									>
										<div className='flex items-center justify-between gap-2'>
											<div>
												<p className='text-sm font-semibold'>Conflict check</p>
												<p className='text-xs text-muted-foreground'>
													{previewSlot.day.slice(0, 3)} {'\u00b7'} {formatTime(previewSlot.startTime)}&ndash;{formatTime(previewSlot.endTime)} {'\u00b7'} {previewSlot.targetEntryId ? 'Swap request' : 'Move request'}
												</p>
											</div>
											<Button variant='ghost' size='sm' className='h-8 px-2 text-xs' onClick={onClearPreviewTarget}>
												Change
											</Button>
										</div>
										<ConflictInspector
											previewLoading={inlinePreviewLoading}
											preview={inlinePreview}
											reasonRequired={false}
											reason=''
											onReasonChange={() => {}}
										/>
										<Button className='w-full min-h-12' onClick={onContinueToReview}>
											Review &amp; Submit
										</Button>
									</motion.div>
								)}
							</AnimatePresence>
						</>
					)}
				</div>
			</div>

			<div className='fixed inset-x-0 bottom-0 z-20 flex gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden'>
				{mobileStep > 1 && (
					<Button variant='outline' className='min-h-12 flex-1' onClick={onStepBack}>
						Back
					</Button>
				)}
				{mobileStep === 1 && entries.length > 0 && (
					<Button className='min-h-12 flex-1' disabled={!selectedSourceEntryId} onClick={onStepForward}>
						Choose Target
					</Button>
				)}
				{mobileStep === 2 && previewSlot && !inlinePreviewLoading && (
					<Button className='min-h-12 flex-1' onClick={onContinueToReview}>
						Review &amp; Submit
					</Button>
				)}
			</div>
		</>
	);
}
