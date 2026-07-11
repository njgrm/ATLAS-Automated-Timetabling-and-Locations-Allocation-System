import { CheckCircle2, Clock, Loader2, Send } from 'lucide-react';

import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { Skeleton } from '@/ui/skeleton';
import { Textarea } from '@/ui/textarea';

export function TimetableWorkflowDialogs({ context }: { context: ScheduleReviewDialogsContext }) {
	const {
		showUnassignConfirm, setShowUnassignConfirm, pendingUnassignId, setPendingUnassignId, unassignDraftPlacement,
		showGenerateConfirm, setShowGenerateConfirm, enforceShiftWindows, setEnforceShiftWindows, draftBoardSummary, followUps, confirmGenerate,
		showResetDraftDialog, setShowResetDraftDialog, openPreGenerationWorkspace,
		showLeavePreGenDialog, setShowLeavePreGenDialog, pendingCenterSwitch, setPendingCenterSwitch,
		requestPreview, requestPreviewLoading, setRequestPreview, setSelectedRequestId, setRequestAppeals, setAppealReason,
		requestPreviewHardConflicts, requestPreviewSoftWarnings, requestAppeals, appealsLoading, isPrivilegedUser,
		updateAppealStatus, appealReason, appealSubmitting, submitAppeal, requestReviewerNotes, setRequestReviewerNotes,
		requestReviewSaving, reviewRoomRequest, generating, generationElapsed,
		showPublishDialog, setShowPublishDialog, publishAcknowledged, setPublishAcknowledged, softCount, handlePublishConfirm,
	} = context;
	const closeRequest = () => {
		setRequestPreview(null);
		setSelectedRequestId(null);
		setRequestAppeals([]);
		setAppealReason('');
	};

	return <>
		<Dialog open={showUnassignConfirm} onOpenChange={setShowUnassignConfirm}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader><DialogTitle>Unassign this session?</DialogTitle><DialogDescription>The session returns to the unassigned queue and can be placed again.</DialogDescription></DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => { setShowUnassignConfirm(false); setPendingUnassignId(null); }}>Cancel</Button>
					<Button variant="destructive" onClick={() => { if (pendingUnassignId != null) void unassignDraftPlacement(pendingUnassignId); setShowUnassignConfirm(false); setPendingUnassignId(null); }}>Unassign</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>

		<Dialog open={showGenerateConfirm} onOpenChange={setShowGenerateConfirm}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader><DialogTitle>Generate updated schedule?</DialogTitle><DialogDescription>Generation uses the current Teaching Load, setup, and saved draft placements.</DialogDescription></DialogHeader>
				<div className="space-y-3 text-sm">
					{draftBoardSummary && <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-xs"><span>{draftBoardSummary.draft} saved anchors</span><span>{draftBoardSummary.unscheduled} unassigned</span></div>}
					<label className="flex items-start gap-2 rounded-md border p-3 text-xs"><Checkbox checked={enforceShiftWindows} onCheckedChange={(value) => setEnforceShiftWindows(value === true)} /><span>Keep configured grade and program time windows.</span></label>
					{followUps.size > 0 && <p className="text-xs text-amber-700">{followUps.size} flagged item{followUps.size === 1 ? '' : 's'} will remain available for review.</p>}
				</div>
				<DialogFooter><Button variant="outline" onClick={() => setShowGenerateConfirm(false)}>Cancel</Button><Button onClick={() => confirmGenerate(enforceShiftWindows)}>Generate schedule</Button></DialogFooter>
			</DialogContent>
		</Dialog>

		<Dialog open={showResetDraftDialog} onOpenChange={setShowResetDraftDialog}>
			<DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Reset timetable draft?</DialogTitle><DialogDescription>Saved draft placements return to the unassigned queue.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setShowResetDraftDialog(false)}>Cancel</Button><Button variant="destructive" onClick={() => void openPreGenerationWorkspace(true)}>Reset draft</Button></DialogFooter></DialogContent>
		</Dialog>

		<Dialog open={showLeavePreGenDialog} onOpenChange={setShowLeavePreGenDialog}>
			<DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Leave draft review?</DialogTitle><DialogDescription>Your saved anchors remain available when you return.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setShowLeavePreGenDialog(false)}>Stay here</Button><Button onClick={() => { setShowLeavePreGenDialog(false); const action = pendingCenterSwitch; setPendingCenterSwitch(null); action?.(); }}>Continue</Button></DialogFooter></DialogContent>
		</Dialog>

		<Sheet open={Boolean(requestPreview || requestPreviewLoading)} onOpenChange={(open) => { if (!open) closeRequest(); }}>
			<SheetContent className="w-full overflow-auto sm:max-w-lg">
				<SheetHeader><SheetTitle>Room request review</SheetTitle><SheetDescription>Check the requested change and its timetable impact.</SheetDescription></SheetHeader>
				<div className="mt-4 space-y-3 text-xs">
					{requestPreviewLoading && !requestPreview ? <><Skeleton className="h-20" /><Skeleton className="h-28" /></> : null}
					{requestPreview && <>
						<div className="rounded-md border p-3"><p className="font-semibold">{requestPreview.request.facultyName}</p><p className="text-muted-foreground">{requestPreview.request.subjectCode} · {requestPreview.request.sectionName}</p><p className="mt-2">{requestPreview.request.currentRoomName} → {requestPreview.request.requestedRoomName}</p><p>{requestPreview.request.day} {requestPreview.request.startTime}-{requestPreview.request.endTime}</p></div>
						{requestPreview.request.rationale && <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-900">{requestPreview.request.rationale}</div>}
						<div className="grid grid-cols-2 gap-2"><div className="rounded-md border p-2">Hard conflicts: <strong>{requestPreview.preview.hardViolations.length}</strong></div><div className="rounded-md border p-2">Warnings: <strong>{requestPreview.preview.softViolations.length}</strong></div></div>
						{requestPreviewHardConflicts.map((conflict) => <div key={`${conflict.code}-${conflict.humanTitle}`} className="rounded-md border border-red-200 bg-red-50 p-2 text-red-800"><p className="font-semibold">{conflict.humanTitle}</p><p>{conflict.humanDetail}</p></div>)}
						{requestPreviewSoftWarnings.map((warning) => <div key={`${warning.code}-${warning.humanTitle}`} className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900"><p className="font-semibold">{warning.humanTitle}</p><p>{warning.humanDetail}</p></div>)}
						<div className="rounded-md border p-3"><div className="mb-2 flex items-center justify-between"><p className="font-semibold">Appeals</p><Badge variant="outline" className="text-xs">{requestAppeals.length}</Badge></div>{appealsLoading ? <Skeleton className="h-12" /> : requestAppeals.map((appeal) => <div key={appeal.id} className="mb-2 rounded border p-2"><div className="flex justify-between gap-2"><strong>{appeal.requesterName}</strong><Badge variant="outline" className="text-xs">{appeal.status}</Badge></div><p>{appeal.reason}</p>{isPrivilegedUser && <div className="mt-2 flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => void updateAppealStatus(appeal.id, 'UNDER_REVIEW')}>Review</Button><Button size="sm" variant="outline" onClick={() => void updateAppealStatus(appeal.id, 'UPHELD')}>Uphold</Button><Button size="sm" variant="outline" onClick={() => void updateAppealStatus(appeal.id, 'DENIED')}>Deny</Button></div>}</div>)}</div>
						{!isPrivilegedUser && <div className="space-y-2"><Textarea value={appealReason} onChange={(event) => setAppealReason(event.target.value)} placeholder="Reason for appeal" /><Button variant="outline" disabled={appealSubmitting || !appealReason.trim()} onClick={() => void submitAppeal()}>{appealSubmitting && <Loader2 className="size-4 animate-spin" />}Submit appeal</Button></div>}
						{isPrivilegedUser && <div className="space-y-2"><Textarea value={requestReviewerNotes} onChange={(event) => setRequestReviewerNotes(event.target.value)} placeholder="Decision notes" /><div className="flex gap-2"><Button className="flex-1" disabled={requestReviewSaving || !requestPreview.preview.allowed} onClick={() => void reviewRoomRequest('APPROVED')}><CheckCircle2 className="size-4" />Approve</Button><Button className="flex-1" variant="destructive" disabled={requestReviewSaving} onClick={() => void reviewRoomRequest('REJECTED')}>Reject</Button></div></div>}
					</>}
				</div>
			</SheetContent>
		</Sheet>

		<Dialog open={generating} modal><DialogContent className="sm:max-w-sm" hideClose onPointerDownOutside={(event) => event.preventDefault()}><div className="flex flex-col items-center gap-3 py-4"><Loader2 className="size-10 animate-spin text-primary" /><h3 className="font-semibold">Generating schedule</h3><p className="text-sm text-muted-foreground">Checking placements and scheduling rules.</p><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />Elapsed: {generationElapsed}s</span></div></DialogContent></Dialog>

		<Dialog open={showPublishDialog} onOpenChange={(open) => { setShowPublishDialog(open); if (!open) setPublishAcknowledged(false); }}>
			<DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Publish schedule</DialogTitle><DialogDescription>{softCount > 0 ? `${softCount} warning${softCount === 1 ? '' : 's'} must be acknowledged before publish.` : 'The schedule is ready to publish.'}</DialogDescription></DialogHeader>{softCount > 0 && <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><Checkbox checked={publishAcknowledged} onCheckedChange={(value) => setPublishAcknowledged(value === true)} /><span>I reviewed the remaining warnings.</span></label>}<DialogFooter><Button variant="outline" onClick={() => setShowPublishDialog(false)}>Cancel</Button><Button disabled={softCount > 0 && !publishAcknowledged} onClick={handlePublishConfirm}><Send className="size-4" />Publish</Button></DialogFooter></DialogContent>
		</Dialog>
	</>;
}
