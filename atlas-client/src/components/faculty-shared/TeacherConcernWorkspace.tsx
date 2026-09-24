import { CheckCircle2, ClipboardList, MessageSquareWarning, Save, Send, Undo2 } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Label } from '@/ui/label';
import { Textarea } from '@/ui/textarea';
import type { FacultyAvailabilityRecord, FacultyConcernReviewDecision } from '@/types';
import AvailabilityPicker from '@/components/faculty-shared/AvailabilityPicker';
import type { AvailabilityPickerSlot } from '@/components/faculty-shared/teacher-concern-client';
import { availabilityStatusLabel, availabilityStatusTone } from '@/components/faculty-shared/teacher-concern-helpers';

type TeacherConcernWorkspaceProps = {
	facultyName: string | null;
	availability: FacultyAvailabilityRecord | null;
	pickerSlots: AvailabilityPickerSlot[];
	onPickerChange: (slots: AvailabilityPickerSlot[]) => void;
	notes: string;
	onNotesChange: (value: string) => void;
	roomRequests: string;
	onRoomRequestsChange: (value: string) => void;
	reviewerNotes: string;
	onReviewerNotesChange: (value: string) => void;
	/** Term authority unresolved or a write in flight — every write is disabled. */
	writesDisabled: boolean;
	saving: boolean;
	onSaveDraft: () => void;
	onSubmitForReview: () => void;
	onReview: (decision: FacultyConcernReviewDecision) => void;
};

export default function TeacherConcernWorkspace({
	facultyName,
	availability,
	pickerSlots,
	onPickerChange,
	notes,
	onNotesChange,
	roomRequests,
	onRoomRequestsChange,
	reviewerNotes,
	onReviewerNotesChange,
	writesDisabled,
	saving,
	onSaveDraft,
	onSubmitForReview,
	onReview,
}: TeacherConcernWorkspaceProps) {
	const status = availability?.status ?? null;
	const canSubmit = !writesDisabled && availability != null && status === 'DRAFT';
	const canReview = !writesDisabled && availability != null && status === 'SUBMITTED';

	return (
		<div className='space-y-4'>
			<Card className='rounded-2xl border-border/60 shadow-sm'>
				<CardContent className='flex flex-wrap items-center justify-between gap-3 p-4'>
					<div className='min-w-0'>
						<p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>Teacher</p>
						<p className='mt-0.5 truncate text-base font-semibold text-foreground'>
							{facultyName ?? 'Select a teacher to record a concern'}
						</p>
					</div>
					<div className='flex flex-wrap items-center gap-2'>
						<Badge variant={availabilityStatusTone(status)}>{availabilityStatusLabel(status)}</Badge>
						{availability && (
							<Badge variant='outline'>
								Term {availability.termIndex} · v{availability.version}
							</Badge>
						)}
					</div>
				</CardContent>
			</Card>

			<Card className='rounded-2xl border-border/60 shadow-sm'>
				<CardContent className='space-y-3 p-4'>
					<div className='flex items-center gap-1.5'>
						<ClipboardList className='size-4 text-primary' aria-hidden='true' />
						<h2 className='text-sm font-semibold text-foreground'>Availability grid</h2>
					</div>
					<p className='text-xs leading-relaxed text-muted-foreground'>
						Paint the teacher&apos;s {facultyName ? `${facultyName}'s ` : ''}weekly windows. <strong>Unavailable</strong> is a
						hard exclusion; <strong>Preferred</strong> is a soft signal. Only a reviewed authority binds generation.
					</p>
					<AvailabilityPicker slots={pickerSlots} onChange={onPickerChange} disabled={facultyName == null} />
				</CardContent>
			</Card>

			<div className='grid gap-4 lg:grid-cols-2'>
				<Card className='rounded-2xl border-border/60 shadow-sm'>
					<CardContent className='space-y-2 p-4'>
						<Label htmlFor='concern-notes' className='text-sm font-semibold text-foreground'>
							Notes for the scheduler
						</Label>
						<Textarea
							id='concern-notes'
							value={notes}
							onChange={(event) => onNotesChange(event.target.value)}
							placeholder='Anything the scheduler should know (load, wellbeing, constraints).'
							className='min-h-24 rounded-xl'
							disabled={facultyName == null}
						/>
					</CardContent>
				</Card>
				<Card className='rounded-2xl border-border/60 shadow-sm'>
					<CardContent className='space-y-2 p-4'>
						<Label htmlFor='concern-room-requests' className='text-sm font-semibold text-foreground'>
							Room requests
						</Label>
						<Textarea
							id='concern-room-requests'
							value={roomRequests}
							onChange={(event) => onRoomRequestsChange(event.target.value)}
							placeholder='Requested room moves or swaps for this teacher, with the class and reason.'
							className='min-h-24 rounded-xl'
							disabled={facultyName == null}
						/>
						<p className='text-xs leading-relaxed text-muted-foreground'>
							Stored inside the frozen availability notes contract; there is no separate room-request write path.
						</p>
					</CardContent>
				</Card>
			</div>

			<div className='flex flex-wrap gap-2'>
				<Button type='button' variant='outline' disabled={facultyName == null || writesDisabled || saving} onClick={onSaveDraft}>
					<Save className='size-4' aria-hidden='true' />
					Save draft
				</Button>
				<Button type='button' disabled={!canSubmit || saving} onClick={onSubmitForReview}>
					<Send className='size-4' aria-hidden='true' />
					Submit for review
				</Button>
			</div>

			<Card className='rounded-2xl border-border/60 shadow-sm'>
				<CardContent className='space-y-3 p-4'>
					<div className='flex items-center gap-1.5'>
						<MessageSquareWarning className='size-4 text-primary' aria-hidden='true' />
						<h2 className='text-sm font-semibold text-foreground'>Reviewer decision</h2>
					</div>
					{status === 'SUBMITTED' ? (
						<>
							<p className='text-xs leading-relaxed text-muted-foreground'>
								Approving binds this authority to generation for the active ordered term. An infeasible authority is
								refused by the server with a typed reason and writes nothing.
							</p>
							<Textarea
								value={reviewerNotes}
								onChange={(event) => onReviewerNotesChange(event.target.value)}
								placeholder='Reviewer note (shown to the scheduler; required context for a return).'
								className='min-h-20 rounded-xl'
								disabled={writesDisabled}
							/>
							<div className='flex flex-wrap gap-2'>
								<Button type='button' disabled={!canReview || saving} onClick={() => onReview('REVIEWED')}>
									<CheckCircle2 className='size-4' aria-hidden='true' />
									Approve and bind
								</Button>
								<Button type='button' variant='outline' disabled={!canReview || saving} onClick={() => onReview('REJECTED')}>
									<Undo2 className='size-4' aria-hidden='true' />
									Return for correction
								</Button>
							</div>
						</>
					) : (
						<p className='text-xs leading-relaxed text-muted-foreground'>
							{status === 'REVIEWED'
								? 'This authority is reviewed and binding for the active ordered term.'
								: status === 'REJECTED'
									? 'This authority was returned. Edit the grid, save a draft, and submit it again.'
									: 'Save a draft and submit it before a reviewer decision is available.'}
						</p>
					)}
					{availability?.reviewerNotes && (
						<p className='rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground'>
							Reviewer note: {availability.reviewerNotes}
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
