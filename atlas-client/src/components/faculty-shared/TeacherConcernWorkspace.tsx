import type { ReactNode } from 'react';
import { DoorOpen, Info, Save } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Textarea } from '@/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { FacultyAvailabilityRecord, FacultyConcernReviewDecision, FacultyRoomPreferenceEntry, FacultyRoomPreferenceState, PreviewResult } from '@/types';
import AvailabilityPicker from '@/components/faculty-shared/AvailabilityPicker';
import type { AvailabilityPickerSlot } from '@/components/faculty-shared/teacher-concern-client';
import {
	describeClassPeriod,
	describeRoomPreview,
	type RoomPreviewLine,
} from '@/components/faculty-shared/teacher-concern-helpers';
import { SectionRoomPicker, type RoomOption } from '@/components/sections/SectionRoomPicker';

/**
 * A3 c13 — the ONE form a scheduler fills top to bottom while talking to one
 * teacher.
 *
 * LAYOUT (see the packet's "subtract" rule; nothing here was added without
 * something being removed):
 *
 *   1. Teacher            — the name is the header, and ONE status chip.
 *   2. Availability       — unchanged grid, Preferred / Unavailable.
 *   3. Rooms              — was a free-text box on this page AND a separate
 *                           692-line review queue at `/faculty/room-preferences`.
 *                           It is now a per-class row: the room the generator
 *                           already chose, an optional pick, one reason line, a
 *                           plain-words preview, and one button that moves it.
 *   4. Anything else      — the notes box.
 *   5. Save               — ONE sticky action, at the end of the form, and one
 *                           plain sentence beside it for the ONE case that
 *                           matters: when the page itself is what makes the
 *                           write impossible (A3 p1).
 *
 * REMOVED, and why it is safe to remove:
 *   · the "Reviewer decision" card (heading, sentence, reviewer-notes box,
 *     Approve / Return): the server review PATCH takes `timetable:edit` and
 *     derives the reviewer from the session, so the SAME person who pressed
 *     "Submit for review" pressed "Approve and bind". The ceremony had no
 *     second reader; the three steps behind it now run inside the one Save.
 *   · the second status badge ("Term 2 · v4") and the eyebrow: two chips said
 *     one thing, in vocabulary this page exists to remove.
 *   · the free-text "Room requests" box: it could not move anything. Rooms are
 *     real now. Any text written into it before is still shown, read-only, so
 *     nothing a scheduler already typed is lost — see `legacyRoomNote`.
 *
 * COMPATIBILITY: every prop this component accepted before is still accepted,
 * and the new ones are optional with empty defaults. A committed control
 * (`a3-c6-concerns-truthfulness.test.tsx`) constructs this component with the
 * OLD prop set and asserts the availability prompt, so the old surface is not a
 * breaking change — it is a subset.
 */
export type ConcernRoomDraft = { requestedRoomId: number | null; rationale: string };

type TeacherConcernWorkspaceProps = {
	facultyName: string | null;
	availability: FacultyAvailabilityRecord | null;
	pickerSlots: AvailabilityPickerSlot[];
	onPickerChange: (slots: AvailabilityPickerSlot[]) => void;
	notes: string;
	onNotesChange: (value: string) => void;
	/** Term authority unresolved or a write in flight — every write is disabled. */
	writesDisabled: boolean;
	saving: boolean;
	/** Optional so the committed control that builds the OLD prop set still renders. */
	onSave?: () => void;

	/* ── Rooms (A3 c13) ── */
	schoolId?: number | null;
	/** `null` means no timetable has been built yet; the page says so plainly. */
	roomState?: FacultyRoomPreferenceState | null;
	roomOptions?: RoomOption[];
	roomDrafts?: Record<string, ConcernRoomDraft>;
	onRoomDraftChange?: (entryId: string, patch: Partial<ConcernRoomDraft>) => void;
	roomPreviews?: Record<number, PreviewResult>;
	onApplyRoom?: (entry: FacultyRoomPreferenceEntry) => void;
	previewingEntryId?: string | null;
	applyingEntryId?: string | null;
	roomError?: string | null;
	/** Room free text written before rooms were part of this form. Read-only. */
	legacyRoomNote?: string | null;
	/** The persistent "Saved …" sentence from the last successful save. */
	savedMessage?: string | null;
	/** Set when a save is refused by the server and the reason must be visible. */
	saveFailure?: string | null;
	/**
	 * A3 p1 — WHY Save is off, in one plain sentence, on the SAME row as the
	 * button. Before this the page could disable Save for five different reasons
	 * and explain exactly one of them, so a healthy teacher saw a dead Save with
	 * no sentence anywhere on the page.
	 *
	 * Rendered BESIDE the button, never as a new card, chip or helper line
	 * under it (AGENTS §8 header budget). Optional so the committed control that
	 * builds the OLD prop set still renders.
	 */
	saveDisabledReason?: string | null;

	/* ── Retired ceremony: still accepted, deliberately not rendered ── */
	roomRequests?: string;
	onRoomRequestsChange?: (value: string) => void;
	reviewerNotes?: string;
	onReviewerNotesChange?: (value: string) => void;
	onSaveDraft?: () => void;
	onSubmitForReview?: () => void;
	onReview?: (decision: FacultyConcernReviewDecision) => void;
};

function SectionCard({ title, icon, children, aside }: { title: string; icon: ReactNode; children: ReactNode; aside?: ReactNode }) {
	return (
		<Card className='rounded-2xl border-border/60 shadow-sm'>
			<CardContent className='space-y-3 p-4'>
				<div className='flex flex-wrap items-center justify-between gap-2'>
					<div className='flex min-w-0 items-center gap-1.5'>
						{icon}
						<h2 className='text-sm font-semibold text-foreground'>{title}</h2>
					</div>
					{aside}
				</div>
				{children}
			</CardContent>
		</Card>
	);
}

export default function TeacherConcernWorkspace({
	facultyName,
	availability,
	pickerSlots,
	onPickerChange,
	notes,
	onNotesChange,
	writesDisabled,
	saving,
	onSave,
	schoolId = null,
	roomState = null,
	roomOptions = [],
	roomDrafts = {},
	onRoomDraftChange,
	roomPreviews = {},
	onApplyRoom,
	previewingEntryId = null,
	applyingEntryId = null,
	roomError = null,
	legacyRoomNote = null,
	savedMessage = null,
	saveFailure = null,
	saveDisabledReason = null,
}: TeacherConcernWorkspaceProps) {
	const rooms = roomState?.entries ?? [];
	const roomNeeds = rooms.filter((entry) => {
		const draft = roomDrafts[entry.entryId];
		return draft?.requestedRoomId != null || entry.requestedRoomId != null;
	}).length;
	// The button's own disable condition, minus `saving`: a save in flight is not
	// a REASON, it is the button's normal busy state, and naming it would flicker
	// a sentence on every press. The reason is shown exactly when the page itself
	// is what makes the write impossible.
	const blockedByPage = facultyName == null || writesDisabled;

	return (
		<div className='space-y-4'>
			{/* ── 2. Availability ── */}
			<SectionCard title='When can this teacher teach?' icon={<Info className='size-4 text-primary' aria-hidden='true' />}>
				<p className='text-xs leading-relaxed text-muted-foreground'>
					{facultyName ? `Paint ${facultyName}'s weekly windows.` : 'Paint the teacher\'s weekly windows.'}{' '}
					<strong>Unavailable</strong> is a hard exclusion; <strong>Preferred</strong> is a soft signal.
				</p>
				<AvailabilityPicker slots={pickerSlots} onChange={onPickerChange} disabled={facultyName == null || writesDisabled} />
			</SectionCard>

			{/* ── 3. Rooms ── */}
			<SectionCard
				title='Does this teacher need a room?'
				icon={<DoorOpen className='size-4 text-primary' aria-hidden='true' />}
				aside={roomNeeds > 0 ? (
					<Badge variant='outline' data-testid='concern-room-need-count'>
						{roomNeeds} of {rooms.length} classes
					</Badge>
				) : null}
			>
				{/*
				 * Nothing here is invented. The server keeps a room request against a
				 * real generated class (`FacultyRoomPreference` requires runId +
				 * entryId + currentRoomId), so before a timetable exists there is no
				 * class to move and no honest control to offer. We say that in one
				 * line and point at the box that does work.
				 *
				 * A READ FAILURE is not that case. `roomError` is shown instead, so an
				 * outage is never dressed up as "no timetable yet".
				 */}
				{roomError ? null : roomState == null ? (
					<p className='text-xs leading-relaxed text-muted-foreground' data-testid='concern-rooms-no-draft'>
						There is no timetable built yet, so there is no class to move. Write the room need under
						{` “Anything else” `}and it stays with this teacher until the first timetable exists.
					</p>
				) : rooms.length === 0 ? (
					<p className='text-xs leading-relaxed text-muted-foreground'>
						This teacher has no classes in the current timetable, so there is nothing to move.
					</p>
				) : (
					<ul className='divide-y divide-border/60'>
						{rooms.map((entry) => (
							<RoomNeedRow
								key={entry.entryId}
								entry={entry}
								schoolId={schoolId}
								roomOptions={roomOptions}
								draft={roomDrafts[entry.entryId] ?? { requestedRoomId: null, rationale: '' }}
								preview={entry.requestId != null ? roomPreviews[entry.requestId] : undefined}
								previewing={previewingEntryId === entry.entryId}
								applying={applyingEntryId === entry.entryId}
								disabled={writesDisabled || schoolId == null}
								onDraftChange={onRoomDraftChange}
								onApply={onApplyRoom}
							/>
						))}
					</ul>
				)}

				{legacyRoomNote ? (
					<>
						<Label className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
							Room notes saved earlier
						</Label>
						<TooltipProvider delayDuration={250}>
							<Tooltip>
								<TooltipTrigger asChild>
									<p className='rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground'>
										{legacyRoomNote}
									</p>
								</TooltipTrigger>
								<TooltipContent className='max-w-xs'>
									Typed on this page before rooms could be set here. It is kept as written; the rows above are what
									actually move a class.
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</>
				) : null}

				{roomError ? (
					<p className='rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive'>
						{roomError}
					</p>
				) : null}
			</SectionCard>

			{/* ── 4. Anything else ── */}
			<Card className='rounded-2xl border-border/60 shadow-sm'>
				<CardContent className='space-y-2 p-4'>
					<Label htmlFor='concern-notes' className='text-sm font-semibold text-foreground'>
						Anything else
					</Label>
					<Textarea
						id='concern-notes'
						value={notes}
						onChange={(event) => onNotesChange(event.target.value)}
						placeholder='In their own words: load, wellbeing, anything to remember.'
						className='min-h-20 rounded-xl'
						disabled={facultyName == null || writesDisabled}
					/>
				</CardContent>
			</Card>

			{/* ── 5. One Save, sticky so it never needs a scroll ── */}
			<div className='sticky bottom-0 z-10 flex flex-col gap-2 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-soft backdrop-blur'>
				{savedMessage ? (
					<p role='status' data-testid='concern-saved-message' className='text-xs leading-relaxed text-muted-foreground'>
						{savedMessage}
					</p>
				) : null}
				{saveFailure ? (
					<p role='alert' className='text-xs leading-relaxed text-destructive'>
						{saveFailure}
					</p>
				) : null}
				<div className='flex flex-wrap items-center justify-between gap-2 gap-x-4'>
					{blockedByPage && saveDisabledReason ? (
						<p
							data-testid='concern-save-disabled-reason'
							className='min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground'
						>
							{saveDisabledReason}
						</p>
					) : (
						<span aria-hidden='true' />
					)}
					<Button type='button' onClick={onSave} disabled={blockedByPage || saving} data-testid='concern-save-button'>
						<Save className='size-4' aria-hidden='true' />
						Save
					</Button>
				</div>
			</div>
		</div>
	);
}

/**
 * One class. Deliberately a list row, not a card: a teacher with six classes
 * must read six lines, not six boxes. `divide-y` does the grouping.
 */
function RoomNeedRow({
	entry,
	schoolId,
	roomOptions,
	draft,
	preview,
	previewing,
	applying,
	disabled,
	onDraftChange,
	onApply,
}: {
	entry: FacultyRoomPreferenceEntry;
	schoolId: number | null;
	roomOptions: RoomOption[];
	draft: ConcernRoomDraft;
	preview: PreviewResult | undefined;
	previewing: boolean;
	applying: boolean;
	disabled: boolean;
	onDraftChange?: (entryId: string, patch: Partial<ConcernRoomDraft>) => void;
	onApply?: (entry: FacultyRoomPreferenceEntry) => void;
}) {
	const period = describeClassPeriod(entry.day, entry.startTime, entry.endTime);
	const requestedRoomId = draft.requestedRoomId ?? entry.requestedRoomId ?? null;
	const requestedRoomName = roomOptions.find((room) => room.id === requestedRoomId)?.name ?? entry.requestedRoomName ?? null;
	const applied = entry.decisionStatus === 'APPROVED';
	const unsaved = draft.requestedRoomId != null && draft.requestedRoomId !== entry.requestedRoomId;

	const previewLine: RoomPreviewLine | null = requestedRoomId == null
		? null
		: describeRoomPreview({
			sectionName: entry.sectionName,
			currentRoomName: entry.currentRoomName,
			requestedRoomName,
			period,
			preview,
		});

	return (
		<li className='grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)] md:items-start md:gap-4'>
			<div className='min-w-0'>
				<p className='truncate text-sm font-semibold text-foreground'>
					{entry.sectionName}
					<span className='font-normal text-muted-foreground'> · {entry.subjectName}</span>
				</p>
				<p className='mt-0.5 text-xs text-muted-foreground'>
					{period} · now in {entry.currentRoomName}
					{applied ? ' · moved' : ''}
				</p>
				{previewLine ? (
					<p
						data-testid='concern-room-preview'
						className={`mt-1.5 text-xs leading-relaxed ${previewLine.tone === 'ok' ? 'text-muted-foreground' : 'text-destructive'}`}
					>
						{previewing ? 'Checking the move…' : previewLine.text}
					</p>
				) : null}
			</div>

			<div className='flex flex-col gap-2'>
				<SectionRoomPicker
					sectionId={entry.sectionId}
					sectionName={entry.sectionName}
					value={requestedRoomId}
					options={roomOptions}
					onSelect={(roomId) => onDraftChange?.(entry.entryId, { requestedRoomId: roomId })}
					disabled={disabled || applied}
					isSaving={applying}
					schoolId={schoolId ?? 0}
				/>
				<Input
					value={draft.rationale}
					onChange={(event) => onDraftChange?.(entry.entryId, { rationale: event.target.value })}
					placeholder='Why? (optional)'
					className='h-8 rounded-lg text-xs'
					disabled={disabled || applied}
					aria-label={`Why ${entry.sectionName} needs this room`}
				/>
				{unsaved || entry.requestId == null ? null : (
					<Button
						type='button'
						variant='outline'
						size='sm'
						className='h-8 justify-start text-xs'
						disabled={disabled || applying || previewLine?.tone === 'blocked' || applied}
						onClick={() => onApply?.(entry)}
					>
						{applying ? 'Moving…' : `Move ${entry.sectionName} to ${requestedRoomName ?? 'the chosen room'}`}
					</Button>
				)}
			</div>
		</li>
	);
}
