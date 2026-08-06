import { useRef, type RefObject } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Lock, RefreshCw } from 'lucide-react';

import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';
import { formatTime } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { SearchableSelect } from '@/ui/searchable-select';
import { ReviewActionMiniCard, ReviewActionSection, ReviewActionSheet } from './ReviewActionSheet';
import { SoftViolationConfirmDialog } from './SoftViolationConfirmDialog';

type PreviewLike = { hardViolations: unknown[]; softViolations: unknown[] } | null | undefined;

type DraftPlacementSaveState =
	| { key: 'ready'; blocked: false; message: string; tone: 'good' }
	| { key: 'saving'; blocked: true; message: string; tone: 'neutral' }
	| { key: 'checking_conflicts'; blocked: true; message: string; tone: 'neutral' }
	| { key: 'missing_owner'; blocked: true; message: string; tone: 'bad' }
	| { key: 'missing_room'; blocked: true; message: string; tone: 'bad' }
	| { key: 'preview_failed'; blocked: true; message: string; tone: 'bad' }
	| { key: 'blocked_by_conflict'; blocked: true; message: string; tone: 'bad' };

function getDraftPlacementSaveState({
	confirmFacultyId,
	confirmRoomId,
	confirmPreview,
	confirmPreviewLoading,
	confirmPreviewError,
	confirmSaving,
}: {
	confirmFacultyId: string;
	confirmRoomId: string;
	confirmPreview: PreviewLike;
	confirmPreviewLoading: boolean;
	confirmPreviewError: string | null;
	confirmSaving: boolean;
}): DraftPlacementSaveState {
	if (confirmSaving) return { key: 'saving', blocked: true, message: 'Saving draft placement now.', tone: 'neutral' };
	if (!confirmFacultyId) return { key: 'missing_owner', blocked: true, message: 'Fix the Teaching Load owner before saving.', tone: 'bad' };
	if (!confirmRoomId) return { key: 'missing_room', blocked: true, message: 'Choose or repair the room source before saving.', tone: 'bad' };
	if (confirmPreviewLoading) return { key: 'checking_conflicts', blocked: true, message: 'Waiting for the conflict check to finish.', tone: 'neutral' };
	if (confirmPreviewError) return { key: 'preview_failed', blocked: true, message: confirmPreviewError, tone: 'bad' };
	if (!confirmPreview) return { key: 'checking_conflicts', blocked: true, message: 'Waiting for ATLAS to show the placement review.', tone: 'neutral' };
	if (confirmPreview.hardViolations.length > 0) {
		return {
			key: 'blocked_by_conflict',
			blocked: true,
			message: 'Choose another slot or repair the blocker before saving.',
			tone: 'bad',
		};
	}
	return { key: 'ready', blocked: false, message: 'Ready to save. ATLAS will update the draft after you confirm.', tone: 'good' };
}

function FigureCard({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
	const toneClass = tone === 'good'
		? 'border-emerald-200 bg-emerald-50 text-emerald-800'
		: tone === 'warn'
			? 'border-amber-200 bg-amber-50 text-amber-900'
			: tone === 'bad'
				? 'border-red-200 bg-red-50 text-red-800'
				: 'border-border bg-muted/20 text-foreground';
	return (
		<div className={`rounded-md border p-2 text-xs ${toneClass}`}>
			<p className="text-[0.68rem] font-medium uppercase tracking-wide opacity-80">{label}:</p>
			<p className="mt-0.5 text-lg font-bold leading-none">{value}</p>
		</div>
	);
}

function conflictSummary(preview: PreviewLike, label = 'Conflict check') {
	if (!preview) return null;
	const hard = preview.hardViolations.length;
	const soft = preview.softViolations.length;
	return (
		<div className="space-y-1.5">
			<p className="text-xs font-semibold text-foreground">{label}</p>
			<div className="grid grid-cols-2 gap-2">
				<FigureCard label="Blocking" value={hard} tone={hard > 0 ? 'bad' : 'good'} />
				<FigureCard label="Warnings" value={soft} tone={soft > 0 ? 'warn' : 'good'} />
			</div>
		</div>
	);
}

function conflictGuidance() {
	return (
		<div className="space-y-1.5 text-xs" aria-label="Draft placement conflict guidance">
			<p className="font-semibold text-foreground">Conflict check</p>
			<div className="grid grid-cols-2 gap-2">
				<FigureCard label="Blocking" value="—" />
				<FigureCard label="Warnings" value="—" />
			</div>
			<div className="grid grid-cols-2 gap-2">
				<div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700">
					Blocking means ATLAS found a hard conflict that must be fixed before save.
				</div>
				<div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
					Warnings are soft issues to review; they never rely on color alone.
				</div>
			</div>
		</div>
	);
}

function StepPill({ label, state }: { label: string; state: 'done' | 'active' | 'waiting' }) {
	const tone = state === 'done'
		? 'border-emerald-200 bg-emerald-50 text-emerald-700'
		: state === 'active'
			? 'border-primary/25 bg-primary/10 text-primary'
			: 'border-border bg-muted/30 text-muted-foreground';
	return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>;
}

function ReadOnlyField({ label, value, blocker }: { label: string; value: string; blocker?: string }) {
	return (
		<div className={`rounded-md border p-2.5 text-xs ${blocker ? 'border-red-200 bg-red-50 text-red-800' : 'border-border bg-muted/20'}`}>
			<p className="font-semibold">{label}</p>
			<p className="mt-1 text-sm font-medium text-foreground">{value}</p>
			{blocker ? <p className="mt-1 text-xs">{blocker}</p> : null}
		</div>
	);
}

function feedbackClass(tone: 'good' | 'bad' | 'warn' | 'neutral') {
	if (tone === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
	if (tone === 'bad') return 'border-red-200 bg-red-50 text-red-800';
	if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-900';
	return 'border-border bg-muted/30 text-muted-foreground';
}

function draftSwapErrorGuidance(error: string) {
	const normalized = error.toLowerCase();
	if (normalized.includes('noop') || normalized.includes('same') || normalized.includes('different draft')) {
		return 'Choose a different draft class to switch with.';
	}
	if (normalized.includes('version') || normalized.includes('stale') || normalized.includes('changed')) {
		return 'This draft changed. Refresh the draft planner and try again.';
	}
	if (normalized.includes('hard') || normalized.includes('blocked') || normalized.includes('conflict')) {
		return 'This switch is blocked. Choose another slot or fix the blocker first.';
	}
	if (normalized.includes('network') || normalized.includes('connection') || normalized.includes('timeout')) {
		return 'ATLAS could not save the switch. It is safe to retry after checking the connection.';
	}
	return `${error} Choose another slot or cancel without saving.`;
}

function focusCancelButton(ref: RefObject<HTMLButtonElement | null>) {
	return (event: Event) => {
		event.preventDefault();
		window.requestAnimationFrame(() => ref.current?.focus());
	};
}

export function TimetablePlacementDialogs({ context }: { context: ScheduleReviewDialogsContext }) {
	const {
		showPreGenConfirm, setShowPreGenConfirm, setPreGenConfirmCtx, setConfirmPreview, setConfirmRawPreview,
		setConfirmPreviewError, setConfirmAllowSoftOverride, setConfirmAllowDailyOverride, preGenConfirmCtx,
		confirmFacultyId, confirmPreview, confirmRoomId, setConfirmRoomId, facultyMap, roomMap,
		confirmPreviewLoading, confirmPreviewError, confirmDisplacedPlacement, openSwapPrompt,
		confirmAllowDailyOverride, confirmSaving, commitConfirmPlacement,
		showSwapConfirm, setShowSwapConfirm, setSwapAction, swapAction, swapSaving, executeSwapAction, swapPreview,
		regularSwapPending, setRegularSwapPending, regularSwapPreview, regularSwapStrategy, setRegularSwapStrategy, regularSwapSaving, executeRegularSwap,
		showSoftConfirm, setShowSoftConfirm, softConfirmWarnings, commitLoading, formatConstraintMessage,
		setPendingCommitProposal, setPreviewResult, setSoftConfirmWarnings, setDragItem, pendingCommitProposal, commitEdit,
		subjectLabel, sectionLabel, formatFacultyInitials, roomLabelShort,
		showAssignmentPicker, setShowAssignmentPicker, setAssignPickerTarget, assignPickerTarget,
		assignPickerFacultyId, setAssignPickerFacultyId, assignPickerRoomId, setAssignPickerRoomId,
		assignPickerPreview, assignPickerPreviewLoading, assignPickerPreviewError, assignPickerSaving,
		confirmAssignmentPicker, restoreReviewFocus,
	} = context;

	const generatedPlacementCancelRef = useRef<HTMLButtonElement>(null);
	const draftPlacementCancelRef = useRef<HTMLButtonElement>(null);
	const draftSwapCancelRef = useRef<HTMLButtonElement>(null);
	const generatedSwapCancelRef = useRef<HTMLButtonElement>(null);

	const closePlacement = () => {
		setShowPreGenConfirm(false);
		setPreGenConfirmCtx(null);
		setConfirmPreview(null);
		setConfirmRawPreview(null);
		setConfirmPreviewError(null);
		setConfirmAllowSoftOverride(false);
		setConfirmAllowDailyOverride(false);
		restoreReviewFocus();
	};

	const selectedOwner = confirmFacultyId ? facultyMap.get(Number(confirmFacultyId)) : null;
	const ownerLabel = selectedOwner
		? `${selectedOwner.lastName}, ${selectedOwner.firstName}${selectedOwner.department ? ` - ${selectedOwner.department}` : ''}`
		: confirmFacultyId
			? `Teaching Load owner #${confirmFacultyId} (details loading)`
		: 'No Teaching Load owner found';
	const selectedRoom = confirmRoomId ? roomMap.get(Number(confirmRoomId)) : null;
	const roomLabel = selectedRoom
		? `${selectedRoom.name} - ${selectedRoom.buildingShortCode || selectedRoom.buildingName}`
		: confirmRoomId
			? `Room #${confirmRoomId} (details loading)`
		: 'No compatible room found';
	const sourceLabel = preGenConfirmCtx?.source?.type === 'draftQueue'
		? `${preGenConfirmCtx.source.item.subjectCode} - ${preGenConfirmCtx.source.item.sectionName}`
		: preGenConfirmCtx?.source?.placement
			? `${subjectLabel(preGenConfirmCtx.source.placement.subjectId)} - ${sectionLabel(preGenConfirmCtx.source.placement.sectionId)}`
			: 'Selected session';
	const slotLabel = preGenConfirmCtx
		? `${preGenConfirmCtx.day} ${formatTime(preGenConfirmCtx.startTime)}-${formatTime(preGenConfirmCtx.endTime)}`
		: 'No slot selected';
	const draftPlacementSaveState = getDraftPlacementSaveState({
		confirmFacultyId,
		confirmRoomId,
		confirmPreview,
		confirmPreviewLoading,
		confirmPreviewError,
		confirmSaving,
	});
	const generatedPlacementBlocked = assignPickerSaving || assignPickerPreviewLoading || !assignPickerTarget || !assignPickerRoomId || !assignPickerPreview || assignPickerPreview.hardViolations.length > 0;
	const generatedPlacementFeedback = assignPickerSaving
		? { message: 'Saving placement now.', tone: 'neutral' as const }
		: !assignPickerTarget
			? { message: 'Choose an unresolved session first.', tone: 'bad' as const }
			: !assignPickerRoomId
				? { message: 'Choose a room before saving. Teacher ownership stays in Teaching Load.', tone: 'bad' as const }
				: assignPickerPreviewLoading
					? { message: 'Waiting for the conflict check to finish.', tone: 'neutral' as const }
					: assignPickerPreviewError
						? { message: `${assignPickerPreviewError} Try another slot or refresh the timetable, then check again.`, tone: 'bad' as const }
						: !assignPickerPreview
							? { message: 'Waiting for ATLAS to show the placement review.', tone: 'neutral' as const }
							: assignPickerPreview.hardViolations.length > 0
								? { message: 'This slot is blocked. Choose another slot or repair the blocker before saving.', tone: 'bad' as const }
								: { message: 'Ready to save. ATLAS will place this session after you confirm.', tone: 'good' as const };

	const swapSourceLabel = swapAction?.sourceLabel ?? 'Selected session';
	const swapTargetLabel = swapAction
		? `${swapAction.target.day} ${formatTime(swapAction.target.startTime)}-${formatTime(swapAction.target.endTime)}`
		: 'Target slot';
	const displacedLabel = swapAction?.displaced
		? `${subjectLabel(swapAction.displaced.subjectId)} - ${sectionLabel(swapAction.displaced.sectionId)}`
		: 'Occupied session';
	const displacedNextLabel = swapAction?.displacementMode === 'to-source-slot' && swapAction.source?.type === 'draftPlacement'
		? `${swapAction.source.placement.day} ${formatTime(swapAction.source.placement.startTime)}-${formatTime(swapAction.source.placement.endTime)}`
		: 'Returns to draft queue';
	const generatedPlacementOwner = assignPickerTarget?.item.facultyId
		? formatFacultyInitials(assignPickerTarget.item.facultyId)
		: assignPickerFacultyId
			? formatFacultyInitials(Number(assignPickerFacultyId))
			: 'No Teaching Load owner found';
	const generatedPlacementSource = assignPickerTarget
		? `${subjectLabel(assignPickerTarget.item.subjectId)} - ${sectionLabel(assignPickerTarget.item.sectionId)}`
		: 'Selected unassigned session';
	const generatedPlacementSlot = assignPickerTarget
		? `${assignPickerTarget.day} ${formatTime(assignPickerTarget.startTime)}-${formatTime(assignPickerTarget.endTime)}`
		: 'No slot selected';
	const generatedRoomOptions = Array.from(roomMap.values())
		.filter((room) => room.isTeachingSpace)
		.sort((a, b) => {
			const buildingCompare = (a.buildingShortCode || a.buildingName || '').localeCompare(b.buildingShortCode || b.buildingName || '');
			if (buildingCompare !== 0) return buildingCompare;
			return a.name.localeCompare(b.name);
		})
		.map((room) => ({
			value: String(room.id),
			label: `${room.name} - ${room.buildingShortCode || room.buildingName}`,
		}));
	const closeGeneratedPlacement = () => {
		setShowAssignmentPicker(false);
		setAssignPickerTarget(null);
		setAssignPickerFacultyId('');
		setAssignPickerRoomId('');
		setPreviewResult(null);
		setDragItem(null);
		restoreReviewFocus();
	};
	const closeDraftSwap = () => {
		setShowSwapConfirm(false);
		setSwapAction(null);
		restoreReviewFocus();
	};
	const closeGeneratedSwap = () => {
		setRegularSwapPending(null);
		restoreReviewFocus();
	};

	return (
		<>
			<Dialog open={showAssignmentPicker} onOpenChange={(open) => { if (!open) closeGeneratedPlacement(); }}>
				<DialogContent
					className="w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-hidden p-0"
					data-testid="generated-placement-review-dialog"
					onOpenAutoFocus={focusCancelButton(generatedPlacementCancelRef)}
				>
					<DialogHeader className="border-b border-border px-4 py-3">
						<DialogTitle>Review generated placement</DialogTitle>
						<DialogDescription>
							{generatedPlacementSource} - {generatedPlacementSlot}. The teacher is locked from Teaching Load; only the room and slot are reviewed here.
						</DialogDescription>
					</DialogHeader>
					<div role="status" aria-live="polite" data-testid="generated-placement-preview-status" className="sr-only">
						{assignPickerPreviewLoading
							? 'Checking generated placement.'
							: assignPickerPreviewError
								? `Generated placement preview error: ${assignPickerPreviewError}`
								: assignPickerPreview
									? 'Generated placement preview is ready.'
									: 'Generated placement review opened.'}
					</div>
					<div className="px-4 py-3">
						<ReviewActionSheet type="generated-placement">
							<ReviewActionSection title="What changes" description="This unresolved session is placed into the selected timetable slot.">
								<div className="grid gap-2 sm:grid-cols-2">
									<ReviewActionMiniCard label="Teaching Load owner" value={generatedPlacementOwner} />
									<ReviewActionMiniCard label="Target slot" value={generatedPlacementSlot} />
								</div>
							</ReviewActionSection>
							<ReviewActionSection title="Room source" description="Choose only the room for this class. Teacher ownership remains read-only.">
								<SearchableSelect
									items={generatedRoomOptions}
									value={assignPickerRoomId}
									onValueChange={setAssignPickerRoomId}
									placeholder="Select room"
									triggerClassName="h-10 text-xs"
									className="w-80 max-w-full"
								/>
								<p className="mt-2 text-xs text-muted-foreground">
									Use the room that should host this class. This does not change the Teaching Load owner.
								</p>
							</ReviewActionSection>
							<ReviewActionSection title="Blocks" tone={assignPickerPreviewError || (assignPickerPreview?.hardViolations.length ?? 0) > 0 ? 'bad' : assignPickerPreview ? 'good' : 'neutral'}>
								{assignPickerPreviewLoading ? (
									<p className="flex items-center gap-2 text-xs text-muted-foreground">
										<Loader2 className="size-4 animate-spin" />
										Checking placement...
									</p>
								) : null}
								{assignPickerPreviewError ? (
									<p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{assignPickerPreviewError}</p>
								) : null}
								{assignPickerPreview && assignPickerPreview.hardViolations.length === 0 ? (
									<p className="flex items-center gap-2 text-xs text-emerald-800">
										<CheckCircle2 className="size-4 shrink-0" />
										No blocking conflicts for this owner, room, and slot.
									</p>
								) : null}
								{assignPickerPreview ? conflictSummary(assignPickerPreview, 'Generated placement check') : conflictGuidance()}
							</ReviewActionSection>
							<ReviewActionSection title="Warnings" tone={(assignPickerPreview?.softViolations.length ?? 0) > 0 ? 'warn' : 'neutral'}>
								<p className="text-xs text-muted-foreground">
									Warnings are shown before save. Blocking conflicts must be cleared first.
								</p>
							</ReviewActionSection>
							<ReviewActionSection title="After save">
								<p className="text-xs text-muted-foreground">
									ATLAS saves the placement only after this review. If the save fails, this sheet stays open.
								</p>
							</ReviewActionSection>
						</ReviewActionSheet>
					</div>
					<DialogFooter className="flex-col items-stretch gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center">
						<p
							className={`min-w-0 flex-1 rounded-md border px-2.5 py-2 text-xs ${feedbackClass(generatedPlacementFeedback.tone)}`}
							data-testid="generated-placement-feedback"
							role="status"
							aria-live="polite"
						>
							{generatedPlacementFeedback.message}
						</p>
						<Button ref={generatedPlacementCancelRef} variant="outline" onClick={closeGeneratedPlacement}>Cancel</Button>
						<Button
							disabled={generatedPlacementBlocked}
							onClick={() => void confirmAssignmentPicker()}
						>
							{assignPickerSaving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
							Save placement
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showPreGenConfirm} onOpenChange={(open) => { if (!open) closePlacement(); }}>
				<DialogContent
					className="w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-hidden p-0"
					data-testid="draft-placement-review-dialog"
					onOpenAutoFocus={focusCancelButton(draftPlacementCancelRef)}
				>
					<DialogHeader className="border-b border-border px-4 py-3">
						<DialogTitle>Review draft placement</DialogTitle>
						<DialogDescription>
							{sourceLabel} - {slotLabel}. Teaching Load owns class ownership; this step only reviews placement readiness.
						</DialogDescription>
					</DialogHeader>
					<div role="status" aria-live="polite" data-testid="draft-placement-preview-status" className="sr-only">
						{confirmPreviewLoading
							? 'Checking draft placement.'
							: confirmPreviewError
								? `Draft placement preview error: ${confirmPreviewError}`
								: confirmPreview
									? 'Draft placement preview is ready.'
									: 'Draft placement review opened.'}
					</div>
					<div className="px-4 py-3">
						<ReviewActionSheet type="draft-placement">
							<ReviewActionSection title="What changes" description="This draft session is anchored to the selected slot after review.">
						<div className="flex flex-wrap gap-1.5" aria-label="Draft placement steps">
							<StepPill label="1. Owner" state={confirmFacultyId ? 'done' : 'active'} />
							<StepPill label="2. Room source" state={confirmRoomId ? 'done' : confirmFacultyId ? 'active' : 'waiting'} />
							<StepPill label="3. Slot" state={preGenConfirmCtx ? 'done' : 'waiting'} />
							<StepPill label="4. Conflicts" state={confirmPreview ? 'done' : confirmPreviewLoading ? 'active' : 'waiting'} />
							<StepPill label="5. Save" state={draftPlacementSaveState.key === 'ready' ? 'active' : 'waiting'} />
						</div>
						<div className="grid gap-2 sm:grid-cols-2">
							<ReadOnlyField
								label="Teaching Load owner"
								value={ownerLabel}
								blocker={!confirmFacultyId ? 'Fix the owner in Teaching Load before placing this session.' : undefined}
							/>
							<ReadOnlyField
								label="Suggested room"
								value={roomLabel}
								blocker={!confirmRoomId ? 'Fix room setup or room readiness before placing this session.' : undefined}
							/>
						</div>
						{generatedRoomOptions.length > 0 ? (
							<div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs">
								<p className="font-semibold text-foreground">Room source</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Choose only the room for this draft anchor. Teaching Load still owns the teacher.
								</p>
								<SearchableSelect
									items={generatedRoomOptions}
									value={confirmRoomId}
									onValueChange={setConfirmRoomId}
									placeholder="Choose room first"
									triggerClassName="mt-2 h-10 text-xs"
									className="w-80 max-w-full"
								/>
							</div>
						) : null}

						<ReadOnlyField label="Target slot" value={slotLabel} />
							</ReviewActionSection>

						{confirmDisplacedPlacement ? (
							<ReviewActionSection title="Blocks" tone="warn">
							<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
								<p className="font-semibold">This slot is occupied.</p>
								<p className="mt-1">Review the visual switch before replacing anything.</p>
								<Button className="mt-2" size="sm" variant="outline" onClick={() => openSwapPrompt()}>
									Review switch
								</Button>
							</div>
							</ReviewActionSection>
						) : null}
							<ReviewActionSection title="Blocks" tone={confirmPreview && confirmPreview.hardViolations.length > 0 ? 'bad' : confirmPreview ? 'good' : 'neutral'}>
						{confirmPreviewLoading ? (
							<p className="flex items-center gap-2 text-xs text-muted-foreground">
								<Loader2 className="size-4 animate-spin" />
								Checking placement...
							</p>
						) : null}
						{confirmPreviewError ? (
							<p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{confirmPreviewError}</p>
						) : null}
						{confirmPreview && confirmPreview.hardViolations.length === 0 ? (
							<p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
								<CheckCircle2 className="size-4 shrink-0" />
								No blocking conflicts for this owner, room, and slot.
							</p>
						) : null}
						{confirmPreview && confirmPreview.hardViolations.length > 0 ? (
							<p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
								<AlertTriangle className="mt-0.5 size-4 shrink-0" />
								This placement is blocked. Use another slot or repair the source data before saving.
							</p>
						) : null}
						{confirmPreview ? conflictSummary(confirmPreview) : conflictGuidance()}
							</ReviewActionSection>
							<ReviewActionSection title="Warnings" tone={confirmPreview && confirmPreview.softViolations.length > 0 ? 'warn' : 'neutral'}>
						{confirmPreview && confirmPreview.softViolations.length > 0 ? (
							<label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
								<Checkbox checked={confirmAllowDailyOverride} onCheckedChange={(value) => setConfirmAllowDailyOverride(value === true)} />
								<span>I reviewed the workload and schedule warnings.</span>
							</label>
						) : <p className="text-xs text-muted-foreground">No workload warning is active yet.</p>}
							</ReviewActionSection>
							<ReviewActionSection title="After save">
								<p className="text-xs text-muted-foreground">
									ATLAS saves the draft placement only after this review and keeps class ownership in Teaching Load.
								</p>
							</ReviewActionSection>
						</ReviewActionSheet>
					</div>
					<DialogFooter className="flex-col items-stretch gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center">
						<p
							className={`min-w-0 flex-1 rounded-md border px-2.5 py-2 text-xs ${feedbackClass(draftPlacementSaveState.tone)}`}
							data-testid="draft-placement-save-reason"
							role="status"
							aria-live="polite"
						>
							<span data-testid="draft-placement-feedback">{draftPlacementSaveState.message}</span>
						</p>
						<Button ref={draftPlacementCancelRef} variant="outline" onClick={closePlacement}>Cancel</Button>
						<Button
							disabled={draftPlacementSaveState.blocked}
							onClick={() => void commitConfirmPlacement()}
						>
							{confirmSaving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
							Save placement
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showSwapConfirm} onOpenChange={(open) => { if (!open) closeDraftSwap(); }}>
				<DialogContent
					className="w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-hidden p-0"
					data-testid="draft-swap-review-dialog"
					onOpenAutoFocus={focusCancelButton(draftSwapCancelRef)}
				>
					<DialogHeader className="border-b border-border px-4 py-3">
						<DialogTitle>Review visual switch</DialogTitle>
						<DialogDescription>Confirm both outcomes before saving. Ownership stays from Teaching Load.</DialogDescription>
					</DialogHeader>
					<div role="status" aria-live="polite" data-testid="draft-swap-preview-status" className="sr-only">
						{swapPreview?.loading
							? 'Checking draft switch.'
							: swapPreview?.error
								? `Draft switch preview error: ${swapPreview.error}`
								: swapPreview
									? 'Draft switch preview is ready.'
									: 'Draft switch review opened.'}
					</div>
					<div className="px-4 py-3">
						<ReviewActionSheet type="draft-swap">
							<ReviewActionSection title="What changes" description="The selected draft session and occupied slot are resolved as one reviewed switch.">
						{swapPreview?.loading ? <p className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />Checking both placements...</p> : null}
						{swapPreview?.error ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-red-800">{swapPreview.error}</p> : null}
						{swapAction ? (
							<div className="grid gap-2 sm:grid-cols-2">
								<div className="rounded-md border border-primary/20 bg-primary/5 p-3">
									<p className="font-semibold text-foreground">{swapSourceLabel}</p>
									<div className="mt-2 flex items-center gap-2 text-muted-foreground">
										<span>New slot</span>
										<ArrowRight className="size-3.5" />
										<span className="font-medium text-foreground">{swapTargetLabel}</span>
									</div>
									<p className="mt-1 text-muted-foreground">Owner {formatFacultyInitials(swapAction.target.facultyId)} - Room {roomLabelShort(swapAction.target.roomId)}</p>
								</div>
								<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
									<p className="font-semibold">{displacedLabel}</p>
									<div className="mt-2 flex items-center gap-2">
										<span>Next step</span>
										<ArrowRight className="size-3.5" />
										<span className="font-medium">{displacedNextLabel}</span>
									</div>
									<p className="mt-1">No owner selection happens in this switch.</p>
								</div>
							</div>
						) : null}
							</ReviewActionSection>
							<ReviewActionSection title="Blocks" tone={swapPreview?.error ? 'bad' : 'neutral'}>
								{conflictSummary(swapPreview?.sourcePreview, 'Incoming session')}
								{conflictSummary(swapPreview?.displacedPreview, 'Displaced session')}
							</ReviewActionSection>
							<ReviewActionSection title="Warnings" tone={(swapPreview?.sourcePreview?.softViolations.length ?? 0) + (swapPreview?.displacedPreview?.softViolations.length ?? 0) > 0 ? 'warn' : 'neutral'}>
								<p className="text-xs text-muted-foreground">Warnings are reviewed here before saving the switch.</p>
							</ReviewActionSection>
							<ReviewActionSection title="After save">
								<p className="text-xs text-muted-foreground">ATLAS saves the switch only after confirmation. No teacher assignment happens in timetable.</p>
							</ReviewActionSection>
						</ReviewActionSheet>
					</div>
					<DialogFooter className="flex-col items-stretch gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center">
						<p
							className={`min-w-0 flex-1 rounded-md border px-2.5 py-2 text-xs ${feedbackClass(
								swapSaving || swapPreview?.loading ? 'neutral' : swapPreview?.error ? 'bad' : 'good',
							)}`}
							data-testid="swap-review-feedback"
							role="status"
							aria-live="polite"
						>
							{swapSaving
								? 'Saving the switch now.'
								: swapPreview?.loading
									? 'Checking whether the switch is safe.'
									: swapPreview?.error
										? draftSwapErrorGuidance(swapPreview.error)
										: 'Ready to review. ATLAS will switch sessions only after you confirm.'}
						</p>
						<Button ref={draftSwapCancelRef} variant="outline" onClick={closeDraftSwap}>Cancel</Button>
						<Button disabled={swapSaving || Boolean(swapPreview?.loading || swapPreview?.error)} onClick={() => void executeSwapAction()}>
							{swapSaving ? <Loader2 className="size-4 animate-spin" /> : null}
							Swap sessions
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(regularSwapPending)} onOpenChange={(open) => { if (!open) closeGeneratedSwap(); }}>
				<DialogContent
					className="w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-hidden p-0"
					data-testid="generated-swap-review-dialog"
					onOpenAutoFocus={focusCancelButton(generatedSwapCancelRef)}
				>
					<DialogHeader className="border-b border-border px-4 py-3">
						<DialogTitle>Review occupied-slot swap</DialogTitle>
						<DialogDescription>
							{regularSwapPending ? `${subjectLabel(regularSwapPending.entryA.subjectId)} for ${sectionLabel(regularSwapPending.entryA.sectionId)} will exchange times with ${subjectLabel(regularSwapPending.entryB.subjectId)} for ${sectionLabel(regularSwapPending.entryB.sectionId)}.` : ''}
						</DialogDescription>
					</DialogHeader>
					<div role="status" aria-live="polite" data-testid="generated-swap-preview-status" className="sr-only">
						{regularSwapPreview?.loading
							? 'Checking occupied-slot swap options.'
							: regularSwapPreview?.error
								? `Occupied-slot swap preview error: ${regularSwapPreview.error}`
								: regularSwapPreview
									? 'Occupied-slot swap preview is ready.'
									: 'Occupied-slot swap review opened.'}
					</div>
					<div className="px-4 py-3">
						<ReviewActionSheet type="generated-swap">
					{regularSwapPreview?.loading ? (
						<p className="flex items-center gap-2 text-xs"><Loader2 className="size-4 animate-spin" />Checking options...</p>
					) : regularSwapPreview?.error ? (
						<p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{regularSwapPreview.error}</p>
					) : regularSwapPending && regularSwapPreview ? (
						<>
							<ReviewActionSection title="What changes" description="The two occupied sessions exchange slots after the selected safe option is confirmed.">
							<div className="grid gap-2 text-xs sm:grid-cols-2">
								<div className="rounded-md border p-3">
									<p className="font-semibold">{subjectLabel(regularSwapPending.entryA.subjectId)} - {sectionLabel(regularSwapPending.entryA.sectionId)}</p>
									<p className="mt-1 text-muted-foreground">{regularSwapPending.entryA.day} {formatTime(regularSwapPending.entryA.startTime)}-{formatTime(regularSwapPending.entryA.endTime)}</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="font-semibold">{subjectLabel(regularSwapPending.entryB.subjectId)} - {sectionLabel(regularSwapPending.entryB.sectionId)}</p>
									<p className="mt-1 text-muted-foreground">{regularSwapPending.entryB.day} {formatTime(regularSwapPending.entryB.startTime)}-{formatTime(regularSwapPending.entryB.endTime)}</p>
								</div>
							</div>
							</ReviewActionSection>
							<ReviewActionSection title="Swap options" description="Choose the safest option. Advanced repair options stay secondary.">
							<div className="grid gap-2">
								<Button className="h-auto w-full justify-between gap-3 p-3 text-left" variant={regularSwapStrategy === 'DIRECT_SWAP' ? 'default' : 'outline'} disabled={(regularSwapPreview.directPreview?.hardViolations.length ?? 0) > 0} onClick={() => setRegularSwapStrategy('DIRECT_SWAP')}>
									<span>Direct swap</span>
									<span className="text-xs">Blocking {regularSwapPreview.directPreview?.hardViolations.length ?? '-'} - Warnings {regularSwapPreview.directPreview?.softViolations.length ?? '-'}</span>
								</Button>
								<Button className="h-auto w-full justify-between gap-3 p-3 text-left" variant={regularSwapStrategy === 'AUTO_FIX_MOVE_BLOCKING' ? 'default' : 'outline'} disabled={!regularSwapPreview.autoFixBlockingPreview} onClick={() => setRegularSwapStrategy('AUTO_FIX_MOVE_BLOCKING')}>
									<span>Move blocking session</span>
									<span className="text-xs">Blocking {regularSwapPreview.autoFixBlockingPreview?.hardViolations.length ?? '-'} - Warnings {regularSwapPreview.autoFixBlockingPreview?.softViolations.length ?? '-'}</span>
								</Button>
								<Button className="h-auto w-full justify-between gap-3 p-3 text-left" variant={regularSwapStrategy === 'AUTO_FIX_MOVE_SOURCE' ? 'default' : 'outline'} disabled={!regularSwapPreview.autoFixSourcePreview} onClick={() => setRegularSwapStrategy('AUTO_FIX_MOVE_SOURCE')}>
									<span>Move selected session</span>
									<span className="text-xs">Blocking {regularSwapPreview.autoFixSourcePreview?.hardViolations.length ?? '-'} - Warnings {regularSwapPreview.autoFixSourcePreview?.softViolations.length ?? '-'}</span>
								</Button>
							</div>
							</ReviewActionSection>
							<ReviewActionSection title="Blocks" tone={(regularSwapPreview.directPreview?.hardViolations.length ?? 0) > 0 ? 'bad' : 'good'}>
								{conflictSummary(regularSwapPreview.directPreview, 'Direct swap')}
							</ReviewActionSection>
							<ReviewActionSection title="Warnings" tone={(regularSwapPreview.directPreview?.softViolations.length ?? 0) > 0 ? 'warn' : 'neutral'}>
								<p className="text-xs text-muted-foreground">Warnings are shown in each option so schedulers can choose with confidence.</p>
							</ReviewActionSection>
							<ReviewActionSection title="After save">
								<p className="text-xs text-muted-foreground">ATLAS saves only the selected swap option. Teacher ownership remains sourced from Teaching Load.</p>
							</ReviewActionSection>
						</>
					) : null}
						</ReviewActionSheet>
					</div>
					<DialogFooter className="flex-col items-stretch gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center">
						<p
							className={`min-w-0 flex-1 rounded-md border px-2.5 py-2 text-xs ${feedbackClass(
								regularSwapSaving || regularSwapPreview?.loading ? 'neutral' : regularSwapPreview?.error ? 'bad' : regularSwapStrategy ? 'good' : 'warn',
							)}`}
							data-testid="generated-swap-feedback"
							role="status"
							aria-live="polite"
						>
							{regularSwapSaving
								? 'Saving the swap now.'
								: regularSwapPreview?.loading
									? 'Checking swap options.'
									: regularSwapPreview?.error
										? `${regularSwapPreview.error} Choose another class pair or cancel without saving.`
										: regularSwapStrategy
											? 'Ready to swap. ATLAS will save only the selected option.'
											: 'Choose a safe swap option before saving.'}
						</p>
						<Button ref={generatedSwapCancelRef} variant="outline" onClick={closeGeneratedSwap}>Cancel</Button>
						<Button disabled={regularSwapSaving || !regularSwapStrategy} onClick={() => void executeRegularSwap()}>
							{regularSwapSaving ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
							Swap sessions
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<SoftViolationConfirmDialog
				open={showSoftConfirm}
				warnings={softConfirmWarnings}
				commitLoading={commitLoading}
				formatConstraintMessage={formatConstraintMessage}
				onCancel={() => {
					setShowSoftConfirm(false);
					setPendingCommitProposal(null);
					setPreviewResult(null);
					setSoftConfirmWarnings([]);
					setDragItem(null);
				}}
				onConfirm={() => {
					if (pendingCommitProposal) void commitEdit(pendingCommitProposal, true);
				}}
			/>
		</>
	);
}
