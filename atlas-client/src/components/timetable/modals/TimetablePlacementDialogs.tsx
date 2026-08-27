import { useRef, type RefObject } from 'react';
import { AlertTriangle, ArrowRight, ArrowRightLeft, CheckCircle2, ExternalLink, Loader2, Lock, RefreshCw, ShieldCheck, ShieldOff, ShieldQuestion } from 'lucide-react';

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
	if (confirmSaving) return { key: 'saving', blocked: true, message: 'Saving...', tone: 'neutral' };
	if (!confirmFacultyId) return { key: 'missing_owner', blocked: true, message: 'Fix owner before saving', tone: 'bad' };
	if (!confirmRoomId) return { key: 'missing_room', blocked: true, message: 'Choose a room', tone: 'bad' };
	if (confirmPreviewLoading) return { key: 'checking_conflicts', blocked: true, message: 'Checking conflicts...', tone: 'neutral' };
	if (confirmPreviewError) return { key: 'preview_failed', blocked: true, message: 'Fix issues before saving', tone: 'bad' };
	if (!confirmPreview) return { key: 'checking_conflicts', blocked: true, message: 'Checking conflicts...', tone: 'neutral' };
	if (confirmPreview.hardViolations.length > 0) {
		return {
			key: 'blocked_by_conflict',
			blocked: true,
			message: 'Blocked: Fix issues',
			tone: 'bad',
		};
	}
	return { key: 'ready', blocked: false, message: 'Ready to save', tone: 'good' };
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

function getSelectedStrategyPreview(
	regularSwapPreview: {
		directPreview: PreviewLike;
		autoFixBlockingPreview: PreviewLike;
		autoFixSourcePreview: PreviewLike;
	} | null,
	strategy: 'DIRECT_SWAP' | 'AUTO_FIX_MOVE_BLOCKING' | 'AUTO_FIX_MOVE_SOURCE' | null,
): { preview: PreviewLike; label: string } | null {
	if (!regularSwapPreview || !strategy) return null;
	if (strategy === 'DIRECT_SWAP') return { preview: regularSwapPreview.directPreview, label: 'Direct swap' };
	if (strategy === 'AUTO_FIX_MOVE_BLOCKING') return { preview: regularSwapPreview.autoFixBlockingPreview, label: 'Move blocking session' };
	if (strategy === 'AUTO_FIX_MOVE_SOURCE') return { preview: regularSwapPreview.autoFixSourcePreview, label: 'Move selected session' };
	return null;
}

function strategyUnavailableReason(
	preview: PreviewLike,
	recommendedStrategy: string | null,
	strategyKey: string,
): string | null {
	if (preview) return null;
	if (recommendedStrategy === 'BLOCKED') return 'No safe swap found';
	return 'Not available for this pair';
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
		? { message: 'Saving...', tone: 'neutral' as const }
		: !assignPickerTarget
			? { message: 'Choose a session', tone: 'bad' as const }
			: !assignPickerRoomId
				? { message: 'Choose a room', tone: 'bad' as const }
				: assignPickerPreviewLoading
					? { message: 'Checking conflicts...', tone: 'neutral' as const }
					: assignPickerPreviewError
						? { message: 'Fix issues before saving', tone: 'bad' as const }
						: !assignPickerPreview
							? { message: 'Checking conflicts...', tone: 'neutral' as const }
							: assignPickerPreview.hardViolations.length > 0
								? { message: 'Blocked: Fix issues', tone: 'bad' as const }
								: { message: 'Ready to save', tone: 'good' as const };

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
					className="w-[calc(100vw-2rem)] max-w-xl flex flex-col gap-0 overflow-hidden p-0 max-h-[90vh]"
					data-testid="draft-placement-review-dialog"
					onOpenAutoFocus={focusCancelButton(draftPlacementCancelRef)}
				>
					<DialogHeader className="border-b border-border px-4 py-3">
						<DialogTitle>Place this class?</DialogTitle>
						<DialogDescription>
							{sourceLabel} at {slotLabel}. Teaching Load owns class ownership; this step only reviews placement readiness.
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
					<div className="flex-1 min-h-0 overflow-auto px-4 py-3">
						<ReviewActionSheet type="draft-placement">
							<ReviewActionSection title="What changes" description="This draft session is anchored to the selected slot after review.">
						<div className="grid gap-2 sm:grid-cols-2">
							<div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
								<ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
								<div>
									<p className="text-sm font-semibold">{sourceLabel}</p>
									<p className="text-xs text-muted-foreground">{slotLabel}</p>
								</div>
							</div>
							<div className="flex items-start gap-2 rounded-md border border-border p-2.5">
								<div className="mt-0.5 size-4 shrink-0" />
								<div>
									<p className="text-xs font-semibold text-muted-foreground">Teaching Load owner</p>
									<p className="text-sm font-medium text-foreground">{ownerLabel}</p>
									{!confirmFacultyId && <p className="mt-1 text-xs text-red-600">Fix the owner in Teaching Load before placing this session.</p>}
								</div>
							</div>
						</div>
						{generatedRoomOptions.length > 0 ? (
							<div className="mt-2 rounded-md border border-border bg-muted/20 p-2.5 text-xs">
								<p className="font-semibold text-foreground">Suggested room</p>
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
								{!confirmRoomId && <p className="mt-1 text-xs text-red-600">Fix room setup or room readiness before placing this session.</p>}
							</div>
						) : null}
							</ReviewActionSection>
							{(() => {
								const hardCount = confirmPreview?.hardViolations.length ?? 0;
								const softCount = confirmPreview?.softViolations.length ?? 0;
								const isBlocked = confirmPreviewError || hardCount > 0;
								const isOccupied = confirmDisplacedPlacement;
								const statusTone = isBlocked ? 'bad' : isOccupied ? 'warn' : confirmPreview ? 'good' : 'neutral';
								return (
									<ReviewActionSection title="Placement status" tone={statusTone}>
										<div className="grid grid-cols-2 gap-2">
											<FigureCard label="Blocking" value={confirmPreviewLoading ? '...' : hardCount} tone={hardCount > 0 ? 'bad' : 'good'} />
											<FigureCard label="Warnings" value={confirmPreviewLoading ? '...' : softCount} tone={softCount > 0 ? 'warn' : 'good'} />
										</div>
										{confirmPreviewLoading && (
											<p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
												<Loader2 className="size-4 animate-spin" />Checking placement...
											</p>
										)}
										{confirmPreviewError && (
											<p className="mt-2 flex items-center gap-2 text-xs text-red-700">
												<AlertTriangle className="size-4 shrink-0" />{confirmPreviewError}
											</p>
										)}
										{!confirmPreviewLoading && !confirmPreviewError && hardCount === 0 && confirmPreview && (
											<p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
												<CheckCircle2 className="size-3.5 shrink-0" />No blocking conflicts for this owner, room, and slot.
											</p>
										)}
										{isOccupied && (
											<div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
												<p className="font-semibold">This slot is occupied.</p>
												<p className="mt-1">Review the visual switch before replacing anything.</p>
												<Button className="mt-2" size="sm" variant="outline" onClick={() => openSwapPrompt()}>
													Review switch
												</Button>
											</div>
										)}
										{confirmPreview && confirmPreview.softViolations.length > 0 && (
											<label className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
												<Checkbox checked={confirmAllowDailyOverride} onCheckedChange={(value) => setConfirmAllowDailyOverride(value === true)} />
												<span>I reviewed the workload and schedule warnings.</span>
											</label>
										)}
									</ReviewActionSection>
								);
							})()}
						</ReviewActionSheet>
					</div>
					<DialogFooter className="shrink-0 flex-col items-stretch gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center">
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
					className="w-[calc(100vw-2rem)] max-w-xl flex flex-col gap-0 overflow-hidden p-0 max-h-[90vh]"
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
					<div className="flex-1 min-h-0 overflow-auto px-4 py-3">
						<ReviewActionSheet type="draft-swap">
							<ReviewActionSection title="What changes" description="The selected draft session and occupied slot are resolved as one reviewed switch.">
						{swapPreview?.loading && (
							<p className="flex items-center gap-2 text-xs text-muted-foreground">
								<Loader2 className="size-4 animate-spin" />Checking both placements...
							</p>
						)}
						{swapPreview?.error && (
							<p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{swapPreview.error}</p>
						)}
						{swapAction && (
							<div className="grid gap-2 sm:grid-cols-2">
								<div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
									<ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
									<div>
										<p className="text-sm font-semibold">{swapSourceLabel}</p>
										<p className="text-xs text-muted-foreground">{swapTargetLabel}</p>
										<p className="text-xs text-muted-foreground">Owner {formatFacultyInitials(swapAction.target.facultyId)} &middot; Room {roomLabelShort(swapAction.target.roomId)}</p>
									</div>
								</div>
								<div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5">
									<ArrowRight className="mt-0.5 size-4 shrink-0 text-amber-600" />
									<div>
										<p className="text-sm font-semibold">{displacedLabel}</p>
										<p className="text-xs text-muted-foreground">{displacedNextLabel}</p>
										<p className="text-xs text-muted-foreground">No owner selection in this switch.</p>
									</div>
								</div>
							</div>
						)}
							</ReviewActionSection>
							{(() => {
								const sourceHard = swapPreview?.sourcePreview?.hardViolations.length ?? 0;
								const sourceSoft = swapPreview?.sourcePreview?.softViolations.length ?? 0;
								const displacedHard = swapPreview?.displacedPreview?.hardViolations.length ?? 0;
								const displacedSoft = swapPreview?.displacedPreview?.softViolations.length ?? 0;
								const totalHard = sourceHard + displacedHard;
								const totalSoft = sourceSoft + displacedSoft;
								const statusTone = swapPreview?.error ? 'bad' : totalHard > 0 ? 'bad' : totalSoft > 0 ? 'warn' : 'good';
								return (
									<ReviewActionSection title="Switch status" tone={statusTone}>
										<div className="grid grid-cols-2 gap-2">
											<FigureCard label="Blocking" value={swapPreview?.loading ? '...' : totalHard} tone={totalHard > 0 ? 'bad' : 'good'} />
											<FigureCard label="Warnings" value={swapPreview?.loading ? '...' : totalSoft} tone={totalSoft > 0 ? 'warn' : 'good'} />
										</div>
										{!swapPreview?.loading && !swapPreview?.error && totalHard === 0 && (
											<p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
												<CheckCircle2 className="size-3.5 shrink-0" />No blocking conflicts for this switch.
											</p>
										)}
									</ReviewActionSection>
								);
							})()}
						</ReviewActionSheet>
					</div>
					<DialogFooter className="shrink-0 flex-col items-stretch gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center">
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
					className="w-[calc(100vw-2rem)] max-w-xl flex flex-col gap-0 overflow-hidden p-0 max-h-[85vh] sm:max-h-[90vh]"
					data-testid="generated-swap-review-dialog"
					onOpenAutoFocus={focusCancelButton(generatedSwapCancelRef)}
				>
					<DialogHeader className="shrink-0 border-b border-border px-4 py-2 sm:px-4 sm:py-3">
						<DialogTitle className="text-sm sm:text-base lg:text-lg">Swap these two classes?</DialogTitle>
						<DialogDescription className="text-xs sm:text-sm">
							{regularSwapPending ? `${subjectLabel(regularSwapPending.entryA.subjectId)} for ${sectionLabel(regularSwapPending.entryA.sectionId)} exchanges times with ${subjectLabel(regularSwapPending.entryB.subjectId)} for ${sectionLabel(regularSwapPending.entryB.sectionId)}.` : ''}
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
					<div className="flex-1 min-h-0 overflow-auto">
						{regularSwapPreview?.loading ? (
							<div className="px-4 py-3"><p className="flex items-center gap-2 text-xs"><Loader2 className="size-4 animate-spin" />Checking options...</p></div>
						) : regularSwapPreview?.error ? (
							<div className="px-4 py-3"><p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{regularSwapPreview.error}</p></div>
						) : regularSwapPending && regularSwapPreview ? (
							<ReviewActionSheet type="generated-swap">
							<div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-0">
								<div className="px-4 py-3 border-b lg:border-b-0 lg:border-r border-border">
									<p className="text-xs font-semibold text-muted-foreground mb-2">What changes</p>
									<div className="space-y-2">
										<div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-2">
											<ArrowRightLeft className="size-4 shrink-0 text-primary" />
											<div>
												<p className="text-sm font-semibold">{subjectLabel(regularSwapPending.entryA.subjectId)}</p>
												<p className="text-xs text-muted-foreground">{sectionLabel(regularSwapPending.entryA.sectionId)} &middot; {regularSwapPending.entryA.day} {formatTime(regularSwapPending.entryA.startTime)}</p>
											</div>
										</div>
										<div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2">
											<ArrowRightLeft className="size-4 shrink-0 text-amber-600" />
											<div>
												<p className="text-sm font-semibold">{subjectLabel(regularSwapPending.entryB.subjectId)}</p>
												<p className="text-xs text-muted-foreground">{sectionLabel(regularSwapPending.entryB.sectionId)} &middot; {regularSwapPending.entryB.day} {formatTime(regularSwapPending.entryB.startTime)}</p>
											</div>
										</div>
									</div>
									<p className="mt-3 text-[0.65rem] text-muted-foreground">Teacher ownership remains sourced from Teaching Load.</p>
								</div>
								<div className="px-4 py-3">
									{regularSwapPreview.recommendedStrategy === 'BLOCKED' ? (
										<div className="space-y-3">
											<p className="text-sm font-medium text-red-800">No safe swap option available.</p>
											<div className="grid grid-cols-2 gap-2">
												<FigureCard label="Blocking" value={regularSwapPreview.directPreview?.hardViolations.length ?? 0} tone="bad" />
												<FigureCard label="Warnings" value={regularSwapPreview.directPreview?.softViolations.length ?? 0} tone="warn" />
											</div>
											<Button size="sm" variant="outline" onClick={closeGeneratedSwap} className="w-full">
												<ArrowRightLeft className="size-3.5" />Close and choose another pair
											</Button>
										</div>
									) : (
										<div className="space-y-3">
											<p className="text-xs font-semibold text-muted-foreground">Choose option</p>
											<div className="grid gap-2">
												{(['DIRECT_SWAP', 'AUTO_FIX_MOVE_BLOCKING', 'AUTO_FIX_MOVE_SOURCE'] as const).map((key) => {
													const isRecommended = regularSwapPreview.recommendedStrategy === key;
													const preview = key === 'DIRECT_SWAP' ? regularSwapPreview.directPreview : key === 'AUTO_FIX_MOVE_BLOCKING' ? regularSwapPreview.autoFixBlockingPreview : regularSwapPreview.autoFixSourcePreview;
													const isDisabled = !preview;
													const hardCount = preview?.hardViolations.length ?? 0;
													const softCount = preview?.softViolations.length ?? 0;
													const label = key === 'DIRECT_SWAP' ? 'Direct swap' : key === 'AUTO_FIX_MOVE_BLOCKING' ? 'Move blocking session' : 'Move selected session';
													const unavailableReason = strategyUnavailableReason(preview, regularSwapPreview.recommendedStrategy, key);
													const isSelected = regularSwapStrategy === key;
													return (
														<Button
															key={key}
															data-testid="generated-swap-strategy-option"
															variant={isSelected ? 'default' : 'outline'}
															className={`h-auto min-h-[44px] w-full justify-between gap-2 p-2.5 text-left text-xs sm:text-sm ${isDisabled ? 'opacity-60' : ''}`}
															disabled={isDisabled}
															onClick={() => setRegularSwapStrategy(key)}
															aria-pressed={isSelected}
														>
															<span className="flex items-center gap-1.5">
																{isRecommended && <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.6rem] sm:text-[0.65rem] font-semibold text-emerald-700"><ShieldCheck className="size-2.5 sm:size-3" />Recommended</span>}
																{isDisabled && <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[0.6rem] sm:text-[0.65rem] font-medium text-slate-500"><ShieldOff className="size-2.5 sm:size-3" />Unavailable</span>}
																<span>{label}</span>
															</span>
															<span className="text-[0.65rem] sm:text-xs text-muted-foreground">
																{isDisabled && unavailableReason ? unavailableReason : `Blocking ${hardCount} \u2022 Warnings ${softCount}`}
															</span>
														</Button>
													);
												})}
											</div>
											{(() => {
												const selected = getSelectedStrategyPreview(regularSwapPreview, regularSwapStrategy);
												if (!selected?.preview) return null;
												const hard = selected.preview.hardViolations.length;
												const soft = selected.preview.softViolations.length;
												return (
													<div
														data-testid="generated-swap-selected-status"
														className={`flex items-center justify-between gap-2 rounded-md border p-2 text-xs sm:text-sm ${hard > 0 ? 'border-red-200 bg-red-50 text-red-800' : soft > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
													>
														<span className="font-semibold">{selected.label}:</span>
														<span>{hard} blockers, {soft} warnings</span>
														{hard === 0 && <CheckCircle2 className="size-3.5 shrink-0" />}
													</div>
												);
											})()}
										</div>
									)}
								</div>
							</div>
							</ReviewActionSheet>
						) : null}
					</div>
					<DialogFooter className="shrink-0 flex-col items-stretch gap-1.5 border-t border-border px-4 py-3 sm:flex-row sm:items-center">
						<p
							className={`min-w-0 flex-1 rounded-md border px-2.5 py-2 text-xs sm:text-sm ${feedbackClass(
								regularSwapSaving || regularSwapPreview?.loading ? 'neutral' : regularSwapPreview?.error ? 'bad' : regularSwapPreview?.recommendedStrategy === 'BLOCKED' ? 'bad' : regularSwapStrategy ? 'good' : 'warn',
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
										: regularSwapPreview?.recommendedStrategy === 'BLOCKED'
											? 'This swap is blocked.'
											: regularSwapStrategy
												? 'Ready to swap. ATLAS will save only the selected option.'
												: 'Choose a safe swap option before saving.'}
						</p>
						<Button ref={generatedSwapCancelRef} variant="outline" className="min-h-[40px] sm:min-h-[44px]" onClick={closeGeneratedSwap}>
							{regularSwapPreview?.recommendedStrategy === 'BLOCKED' ? 'Cancel safely' : 'Cancel'}
						</Button>
						{regularSwapPreview?.recommendedStrategy !== 'BLOCKED' && (
							<Button className="min-h-[40px] sm:min-h-[44px]" disabled={regularSwapSaving || !regularSwapStrategy} onClick={() => void executeRegularSwap()}>
								{regularSwapSaving ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
								Swap sessions
							</Button>
						)}
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
