import { CheckCircle2, CircleAlert, Clock, Loader2, Send } from 'lucide-react';

import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';
import {
	BUILD_NEW_DRAFT_LABEL,
	PUBLISHED_SCHEDULE_STAYS_IN_USE,
	buildGenerateDialogCopy,
	buildNewDraftDialogTitle,
	plainRoomAppealStatus,
	publishPlacementBlockedSentence,
} from '@/lib/timetable-plain-language';
import type { GenerateDialogTermSource } from '@/lib/timetable-plain-language';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { Skeleton } from '@/ui/skeleton';
import { Textarea } from '@/ui/textarea';
import { PublicationApprovalInbox } from '@/components/timetable/PublicationApprovalInbox';

/**
 * A2-UX-WIRE-C2 (items 1-4) — the generate dialog CONSUMES the copy module's
 * composed sentences instead of typing its own.
 *
 * The dialog was 116-155 words of hard-coded prose: a multi-sentence note
 * explaining why two different numbers appeared, three engineer labels
 * ("Actor school year", "Term authority", "Retained draft anchors: N locked
 * sessions") and a four-paragraph "What this does / What this does not do"
 * block. `buildGenerateDialogCopy()` is 31 words, names each population by its
 * row label, and is measured by a test at <= 45 rendered words.
 *
 * `isPublished` is OPTIONAL and additive. When it is absent the dialog takes the
 * unpublished branch, which is the truthful default: with nothing published,
 * `PUBLISHED_SCHEDULE_STAYS_IN_USE` would be a false claim. The published branch
 * is implemented and tested; feeding it is the caller's one-line wiring
 * (DEPENDENCY: `ScheduleReviewDialogs.tsx` / `useScheduleReviewWorkspaceState.ts`).
 */
export function TimetableWorkflowDialogs({ context, isPublished = false }: { context: ScheduleReviewDialogsContext; isPublished?: boolean }) {
	const {
		showUnassignConfirm, setShowUnassignConfirm, pendingUnassignId, setPendingUnassignId, unassignDraftPlacement,
		showGenerateConfirm, setShowGenerateConfirm, enforceShiftWindows, setEnforceShiftWindows, draftBoardSummary, followUps, confirmGenerate,
		activeSchoolYearLabel, schoolYearSource,
		showResetDraftDialog, setShowResetDraftDialog, openPreGenerationWorkspace,
		showLeavePreGenDialog, setShowLeavePreGenDialog, pendingCenterSwitch, setPendingCenterSwitch,
		requestPreview, requestPreviewLoading, setRequestPreview, setSelectedRequestId, setRequestAppeals, setAppealReason,
		requestPreviewHardConflicts, requestPreviewSoftWarnings, requestAppeals, appealsLoading, isPrivilegedUser,
		updateAppealStatus, appealReason, appealSubmitting, submitAppeal, requestReviewerNotes, setRequestReviewerNotes,
		requestReviewSaving, reviewRoomRequest, generating, generationElapsed,
		showPublishDialog, setShowPublishDialog, publishAcknowledged, setPublishAcknowledged, softCount, publishUnassignedCount, handlePublishConfirm, canRequestPublication,
		canApprovePublication, approvalSchoolId, approvalSchoolYearId, approvalActorId,
	} = context;
	const closeRequest = () => {
		setRequestPreview(null);
		setSelectedRequestId(null);
		setRequestAppeals([]);
		setAppealReason('');
	};

	/* `atlas-persisted` is ATLAS's own saved term setup, which the copy module
	 * spells `atlas` ("Saved in ATLAS"). Passing the raw value through would make
	 * a value ATLAS itself persisted read as "Not confirmed", which is the one
	 * reading it must never get. Every other source value is already in the
	 * module's vocabulary and is passed through unchanged. */
	const termSource: GenerateDialogTermSource = schoolYearSource === 'atlas-persisted' ? 'atlas' : schoolYearSource;

	return <>
		<Dialog open={showUnassignConfirm} onOpenChange={setShowUnassignConfirm}>
			<DialogContent resizable={false} className="sm:max-w-sm">
				{/* NOUN RULE (item 4): the one noun for the unit a scheduler places.
				 * The unassign dialog is the same surface family as the generate
				 * dialog, so it speaks the same noun. */}
				<DialogHeader><DialogTitle>Take this class out of its slot?</DialogTitle><DialogDescription>The class returns to the queue without a time and can be placed again.</DialogDescription></DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => { setShowUnassignConfirm(false); setPendingUnassignId(null); }}>Cancel</Button>
					<Button variant="destructive" onClick={() => { if (pendingUnassignId != null) void unassignDraftPlacement(pendingUnassignId); setShowUnassignConfirm(false); setPendingUnassignId(null); }}>Remove from slot</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>

		<GenerateConfirmDialog
			open={showGenerateConfirm}
			onOpenChange={setShowGenerateConfirm}
			isPublished={isPublished}
			schoolYearLabel={activeSchoolYearLabel ?? null}
			termSource={termSource}
			lockedClassCount={draftBoardSummary?.draft ?? null}
			classesToSchedule={draftBoardSummary?.unscheduled ?? null}
			enforceShiftWindows={enforceShiftWindows}
			setEnforceShiftWindows={setEnforceShiftWindows}
			followUpCount={followUps.size}
			onConfirm={confirmGenerate}
		/>

		<Dialog open={showResetDraftDialog} onOpenChange={setShowResetDraftDialog}>
				<DialogContent resizable={false} className="sm:max-w-sm"><DialogHeader><DialogTitle>Reset the draft schedule?</DialogTitle><DialogDescription>Saved placements return to the queue without a time.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setShowResetDraftDialog(false)}>Cancel</Button><Button variant="destructive" onClick={() => void openPreGenerationWorkspace(true)}>Reset draft</Button></DialogFooter></DialogContent>
		</Dialog>

		<Dialog open={showLeavePreGenDialog} onOpenChange={setShowLeavePreGenDialog}>
			<DialogContent resizable={false} className="sm:max-w-sm"><DialogHeader><DialogTitle>Leave draft review?</DialogTitle><DialogDescription>Your saved anchors remain available when you return.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setShowLeavePreGenDialog(false)}>Stay here</Button><Button onClick={() => { setShowLeavePreGenDialog(false); const action = pendingCenterSwitch; setPendingCenterSwitch(null); action?.(); }}>Continue</Button></DialogFooter></DialogContent>
		</Dialog>

		<Sheet open={Boolean(requestPreview || requestPreviewLoading)} onOpenChange={(open) => { if (!open) closeRequest(); }}>
		<SheetContent className="w-full overflow-auto scrollbar-thin sm:max-w-lg">
				<SheetHeader><SheetTitle>Room request review</SheetTitle><SheetDescription>Check the requested change and its timetable impact.</SheetDescription></SheetHeader>
				<div className="mt-4 space-y-3 text-xs">
					{requestPreviewLoading && !requestPreview ? <><Skeleton className="h-20" /><Skeleton className="h-28" /></> : null}
					{requestPreview && <>
						<div className="rounded-md border p-3"><p className="font-semibold">{requestPreview.request.facultyName}</p><p className="text-muted-foreground">{requestPreview.request.subjectDisplayLabel || requestPreview.request.subjectName || requestPreview.request.subjectCode} · {requestPreview.request.sectionName}</p><p className="mt-2">{requestPreview.request.currentRoomName} → {requestPreview.request.requestedRoomName}</p><p>{requestPreview.request.day} {requestPreview.request.startTime}-{requestPreview.request.endTime}</p></div>
						{requestPreview.request.rationale && <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-900">{requestPreview.request.rationale}</div>}
						<div className="grid grid-cols-2 gap-2"><div className="rounded-md border p-2">Hard conflicts: <strong>{requestPreview.preview.hardViolations.length}</strong></div><div className="rounded-md border p-2">Warnings: <strong>{requestPreview.preview.softViolations.length}</strong></div></div>
						{requestPreviewHardConflicts.map((conflict) => <div key={`${conflict.code}-${conflict.humanTitle}`} className="rounded-md border border-red-200 bg-red-50 p-2 text-red-800"><p className="font-semibold">{conflict.humanTitle}</p><p>{conflict.humanDetail}</p></div>)}
						{requestPreviewSoftWarnings.map((warning) => <div key={`${warning.code}-${warning.humanTitle}`} className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900"><p className="font-semibold">{warning.humanTitle}</p><p>{warning.humanDetail}</p></div>)}
						<div className="rounded-md border p-3"><div className="mb-2 flex items-center justify-between"><p className="font-semibold">Appeals</p><Badge variant="outline" className="text-xs">{requestAppeals.length}</Badge></div>{appealsLoading ? <Skeleton className="h-12" /> : requestAppeals.map((appeal) => <div key={appeal.id} className="mb-2 rounded border p-2"><div className="flex justify-between gap-2"><strong>{appeal.requesterName}</strong>{/* PLAIN-LANGUAGE-J2J3-C01 (J2): was `{appeal.status}`, so the request-preview
								 * dialog printed the raw `OPEN`/`UNDER_REVIEW`/`UPHELD`/`DENIED`
								 * enum on the very row that carries the Review / Uphold / Deny
								 * buttons — an operator comparing an appeal to a button had to
								 * translate the vocabulary. */}
									<Badge variant="outline" className="text-xs">{plainRoomAppealStatus(appeal.status)}</Badge></div><p>{appeal.reason}</p>{isPrivilegedUser && <div className="mt-2 flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => void updateAppealStatus(appeal.id, 'UNDER_REVIEW')}>Review</Button><Button size="sm" variant="outline" onClick={() => void updateAppealStatus(appeal.id, 'UPHELD')}>Uphold</Button><Button size="sm" variant="outline" onClick={() => void updateAppealStatus(appeal.id, 'DENIED')}>Deny</Button></div>}</div>)}</div>
						{!isPrivilegedUser && <div className="space-y-2"><Textarea value={appealReason} onChange={(event) => setAppealReason(event.target.value)} placeholder="Reason for appeal" /><Button variant="outline" disabled={appealSubmitting || !appealReason.trim()} onClick={() => void submitAppeal()}>{appealSubmitting && <Loader2 className="size-4 animate-spin" />}Submit appeal</Button></div>}
						{isPrivilegedUser && <div className="space-y-2"><Textarea value={requestReviewerNotes} onChange={(event) => setRequestReviewerNotes(event.target.value)} placeholder="Decision notes" /><div className="flex gap-2"><Button className="flex-1" disabled={requestReviewSaving || !requestPreview.preview.allowed} onClick={() => void reviewRoomRequest('APPROVED')}><CheckCircle2 className="size-4" />Approve</Button><Button className="flex-1" variant="destructive" disabled={requestReviewSaving} onClick={() => void reviewRoomRequest('REJECTED')}>Reject</Button></div></div>}
					</>}
				</div>
			</SheetContent>
		</Sheet>

		<Dialog open={generating} modal><DialogContent resizable={false} className="sm:max-w-sm" hideClose onPointerDownOutside={(event) => event.preventDefault()}><div className="flex flex-col items-center gap-3 py-4"><Loader2 className="size-10 animate-spin text-primary" /><h3 className="font-semibold">Generating schedule</h3><p className="text-sm text-muted-foreground">Checking placements and scheduling rules.</p><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />Elapsed: {generationElapsed}s</span></div></DialogContent></Dialog>

		<Dialog open={showPublishDialog} onOpenChange={(open) => { setShowPublishDialog(open); if (!open) setPublishAcknowledged(false); }}>
			<DialogContent resizable={false} className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{canRequestPublication ? 'Request schedule publication' : 'Publish schedule'}</DialogTitle>
					<DialogDescription>
						{/* A2-UX-WIRE-C2 (item 4) — the ungrammatical sentence is gone.
						    It read "3 classes this schedule could not place must be
						    placed before this schedule can be published.": two verbs on
						    one clause, the number restated by the modal, and a stacked
						    obligation. `publishPlacementBlockedSentence` states the count
						    once, in the one noun, in the present tense.

						    `publishUnassignedCount` is `summary.unassignedCount` — the
						    SAME source the generation outcome reads, so the two are one
						    number and both name it the same way. */}
						{(publishUnassignedCount ?? 0) > 0
							? publishPlacementBlockedSentence(publishUnassignedCount ?? 0)
							: softCount > 0
								? `${softCount} warning${softCount === 1 ? '' : 's'} must be acknowledged before ${canRequestPublication ? 'requesting approval' : 'publishing'}.`
								: canRequestPublication
									? 'Submit this reviewed schedule for another scheduler to approve. It will not go live until that approval succeeds.'
									: 'The generated schedule has no problems that stop publishing, and every class has a time.'}
					</DialogDescription>
				</DialogHeader>
				{softCount > 0 && <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><Checkbox checked={publishAcknowledged} onCheckedChange={(value) => setPublishAcknowledged(value === true)} /><span>I reviewed the remaining warnings.</span></label>}
				<DialogFooter>
					<Button variant="outline" onClick={() => setShowPublishDialog(false)}>Cancel</Button>
					<Button disabled={(publishUnassignedCount ?? 0) > 0 || (softCount > 0 && !publishAcknowledged)} onClick={handlePublishConfirm}><Send className="size-4" />{canRequestPublication ? 'Request approval' : 'Publish'}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
		<PublicationApprovalInbox schoolId={approvalSchoolId} schoolYearId={approvalSchoolYearId} actorId={approvalActorId} visible={canApprovePublication === true} />
	</>;
}

type GenerateConfirmProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Whether a published schedule is currently in use. Drives the #56 branch. */
	isPublished: boolean;
	schoolYearLabel: string | null;
	termSource: GenerateDialogTermSource;
	/**
	 * Locked pre-generation placements carried into the new draft, or `null` when
	 * the board summary is ABSENT and nothing was counted.
	 *
	 * A2 C5 item 4a: this was `?? 0`, which printed "Locked classes kept: 0" for a
	 * failed read — the identical false zero the headline one line above had
	 * already been corrected for in c2. `null` and `0` are different facts and the
	 * type now says so, exactly as `classesToSchedule` below already does.
	 */
	lockedClassCount: number | null;
	/**
	 * This year's weekly demand with no time yet, or `null` when the board summary
	 * is ABSENT and the count was therefore never measured.
	 *
	 * A2-UX-STATUS-C2 correction B2: this was `?? 0`, which rendered a green
	 * "nothing to do" cue beside "Classes to schedule: 0" for a count that a
	 * failed read had never produced. `null` and `0` are different facts and the
	 * type now says so.
	 */
	classesToSchedule: number | null;
	enforceShiftWindows: boolean;
	setEnforceShiftWindows: (value: boolean) => void;
	followUpCount: number;
	onConfirm: (enforceShiftWindowsOverride: boolean) => void;
};

/**
 * #56 / U3a — the ONE verb. The title and the primary button are the same
 * sentence's two halves, so a scheduler cannot read the dialog as a dated change
 * to the schedule that is already in use.
 *
 * #43 — the density fixes, all three:
 *   1. the duplicate close control is gone. `DialogContent` renders its own
 *      unlabelled `X`; the dialog already had a real, labelled `Cancel`, so
 *      `hideClose` leaves exactly one close affordance instead of two;
 *   2. fourteen 12px items became a headline, three rows and one sentence. The
 *      four-paragraph "What this does / does not do" block is the copy module's
 *      `unavailability` + `publishesNothing`, which say the same two things in
 *      21 words instead of 47;
 *   3. the demand count carries a visible cue, so the one number a scheduler
 *      acts on is not one more grey 12px row.
 */
export function GenerateConfirmDialog({
	open,
	onOpenChange,
	isPublished,
	schoolYearLabel,
	termSource,
	lockedClassCount,
	classesToSchedule,
	enforceShiftWindows,
	setEnforceShiftWindows,
	followUpCount,
	onConfirm,
}: GenerateConfirmProps) {
	const copy = buildGenerateDialogCopy({ schoolYearLabel, termSource, lockedClassCount, classesToSchedule });
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{/* `hideClose`: the DialogContent `X` and `Cancel` were two controls for
			 * one action, and the `X` carried no label. One real close remains. */}
			<DialogContent resizable={false} className="sm:max-w-md" hideClose data-testid="timetable-generate-confirm-dialog">
				<DialogHeader>
					<DialogTitle data-testid="timetable-generate-confirm-title">{buildNewDraftDialogTitle(isPublished)}</DialogTitle>
					<DialogDescription data-testid="timetable-generate-confirm-first-line">
						{isPublished ? PUBLISHED_SCHEDULE_STAYS_IN_USE : copy.publishesNothing}
					</DialogDescription>
				</DialogHeader>
				<GenerateConfirmDialogBody
					copy={copy}
					classesToSchedule={classesToSchedule}
					enforceShiftWindows={enforceShiftWindows}
					setEnforceShiftWindows={setEnforceShiftWindows}
				/>
				{followUpCount > 0 && (
					<p className="text-xs text-amber-700" data-testid="timetable-generate-confirm-followups">
						{followUpCount} flagged item{followUpCount === 1 ? '' : 's'} will remain available for review.
					</p>
				)}
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button onClick={() => onConfirm(enforceShiftWindows)} data-testid="timetable-generate-confirm-submit">
						{BUILD_NEW_DRAFT_LABEL}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * The one colour per demand state.
 *
 * A2-UX-STATUS-C2 correction B2: `unknown` is deliberately `text-muted-foreground`
 * and NOT `text-emerald-600`. Green here means a MEASURED "everything is placed";
 * painting an unmeasured read green told a scheduler the worst thing ATLAS could
 * tell them - that there was nothing left to do - about a number that was never
 * produced. A neutral icon beside an honest headline is the truthful middle.
 */
const DEMAND_CUE_CLASS: Record<'work' | 'none' | 'unknown', string> = {
	work: 'size-5 shrink-0 text-amber-600',
	none: 'size-5 shrink-0 text-emerald-600',
	unknown: 'size-5 shrink-0 text-muted-foreground',
};

/**
 * The dialog's whole body, and therefore the region the 45-word budget governs.
 *
 * It is a separate component for one reason: it is the MEASURED unit. The word
 * count a scheduler reads is the text inside this element, so the c2 regression
 * walks this component's real element tree and budgets the words it will
 * actually show — not the copy module's `plainText` and not a source string.
 *
 * The cue beside the count is `aria-hidden` on purpose. It encodes exactly one
 * real fact — there is work, there is not, or it was never measured — and a fourth
 * colour for "a lot" would be a severity scale ATLAS has no authority for. The
 * visible text beside it already carries the meaning, so the cue adds no words to
 * the budget.
 */
export function GenerateConfirmDialogBody({
	copy,
	classesToSchedule,
	enforceShiftWindows,
	setEnforceShiftWindows,
}: {
	copy: ReturnType<typeof buildGenerateDialogCopy>;
	classesToSchedule: number | null;
	enforceShiftWindows: boolean;
	setEnforceShiftWindows: (value: boolean) => void;
}) {
	// A2-UX-STATUS-C2 correction B2: THREE states, because there are three facts.
	// "work" and "none" are both measured. "unknown" is neither - the board summary
	// read failed, so no count exists - and it must never borrow the green
	// "nothing to do" cue, which is a claim that everything is placed. Colour is
	// never load-bearing alone: the headline beside it says which of the three it is
	// in words, and `data-demand-state` carries the same fact to assistive tech.
	const demandState: 'work' | 'none' | 'unknown' = classesToSchedule == null
		? 'unknown'
		: classesToSchedule > 0
			? 'work'
			: 'none';
	const hasWork = demandState === 'work';
	return (
		<div className="space-y-3 text-sm">
			<div
				className="flex items-center gap-2 rounded-md border bg-muted/20 p-3"
				data-testid="timetable-generate-confirm-summary"
			>
				{/* The visible cue: the demand number is the one figure a scheduler
				 * acts on, and it was one more grey 12px row among fourteen. */}
				<CircleAlert
					aria-hidden="true"
					data-testid="timetable-generate-demand-cue"
					data-has-work={hasWork ? 'true' : 'false'}
					data-demand-state={demandState}
					className={DEMAND_CUE_CLASS[demandState]}
				/>
				<p className="font-semibold text-foreground" data-testid="timetable-generate-confirm-unassigned">{copy.headline}</p>
			</div>
			<div className="grid gap-1.5" data-testid="timetable-generate-confirm-rows">
				{copy.rows.map((row) => (
					<div key={row.label} className="flex items-center justify-between gap-2 text-sm">
						<span className="text-muted-foreground">{row.label}</span>
						{/* A2 C5 item 4a — an UNMEASURED row is styled like the neutral
						 * unknown, not like a measured figure. `font-semibold
						 * text-foreground` is the weight that reads as a count a
						 * scheduler can act on, and the headline's own correction
						 * established that an unmeasured read must never wear that
						 * treatment (see DEMAND_CUE_CLASS). The value text is the
						 * load-bearing part — it contains no digit — and this keeps the
						 * colour agreeing with it. Colour is never load-bearing alone:
						 * `data-known` states the same fact for anything that reads the
						 * DOM. */}
						<span
							className={row.known ? 'font-semibold text-foreground' : 'text-muted-foreground'}
							data-known={row.known ? 'true' : 'false'}
							data-testid="timetable-generate-confirm-row-value"
						>
							{row.value}
						</span>
					</div>
				))}
			</div>
			<p className="text-xs text-muted-foreground" data-testid="timetable-generate-confirm-unavailability">{copy.unavailability}</p>
			<label className="flex items-start gap-2 rounded-md border p-3 text-xs">
				<Checkbox checked={enforceShiftWindows} onCheckedChange={(value) => setEnforceShiftWindows(value === true)} />
				<span>Keep configured grade and program time windows.</span>
			</label>
		</div>
	);
}
