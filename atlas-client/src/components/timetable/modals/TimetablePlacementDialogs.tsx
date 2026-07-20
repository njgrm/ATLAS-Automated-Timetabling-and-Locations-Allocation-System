import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Lock, RefreshCw } from 'lucide-react';

import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';
import { formatTime } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { SoftViolationConfirmDialog } from './SoftViolationConfirmDialog';

type PreviewLike = { hardViolations: unknown[]; softViolations: unknown[] } | null | undefined;

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

export function TimetablePlacementDialogs({ context }: { context: ScheduleReviewDialogsContext }) {
	const {
		showPreGenConfirm, setShowPreGenConfirm, setPreGenConfirmCtx, setConfirmPreview, setConfirmRawPreview,
		setConfirmPreviewError, setConfirmAllowSoftOverride, setConfirmAllowDailyOverride, preGenConfirmCtx,
		confirmFacultyId, confirmPreview, confirmRoomId, facultyMap, roomMap,
		confirmPreviewLoading, confirmPreviewError, confirmDisplacedPlacement, openSwapPrompt,
		confirmAllowDailyOverride, confirmSaving, commitConfirmPlacement,
		showSwapConfirm, setShowSwapConfirm, setSwapAction, swapAction, swapSaving, executeSwapAction, swapPreview,
		regularSwapPending, setRegularSwapPending, regularSwapPreview, regularSwapStrategy, setRegularSwapStrategy, regularSwapSaving, executeRegularSwap,
		showSoftConfirm, setShowSoftConfirm, softConfirmWarnings, commitLoading, formatConstraintMessage,
		setPendingCommitProposal, setPreviewResult, setSoftConfirmWarnings, setDragItem, pendingCommitProposal, commitEdit,
		subjectLabel, sectionLabel, formatFacultyInitials, roomLabelShort,
	} = context;

	const closePlacement = () => {
		setShowPreGenConfirm(false);
		setPreGenConfirmCtx(null);
		setConfirmPreview(null);
		setConfirmRawPreview(null);
		setConfirmPreviewError(null);
		setConfirmAllowSoftOverride(false);
		setConfirmAllowDailyOverride(false);
	};

	const selectedOwner = confirmFacultyId ? facultyMap.get(Number(confirmFacultyId)) : null;
	const ownerLabel = selectedOwner
		? `${selectedOwner.lastName}, ${selectedOwner.firstName}${selectedOwner.department ? ` - ${selectedOwner.department}` : ''}`
		: 'No Teaching Load owner found';
	const selectedRoom = confirmRoomId ? roomMap.get(Number(confirmRoomId)) : null;
	const roomLabel = selectedRoom
		? `${selectedRoom.name} - ${selectedRoom.buildingShortCode || selectedRoom.buildingName}`
		: 'No compatible room found';
	const sourceLabel = preGenConfirmCtx?.source?.type === 'draftQueue'
		? `${preGenConfirmCtx.source.item.subjectCode} - ${preGenConfirmCtx.source.item.sectionName}`
		: preGenConfirmCtx?.source?.placement
			? `${subjectLabel(preGenConfirmCtx.source.placement.subjectId)} - ${sectionLabel(preGenConfirmCtx.source.placement.sectionId)}`
			: 'Selected session';
	const slotLabel = preGenConfirmCtx
		? `${preGenConfirmCtx.day} ${formatTime(preGenConfirmCtx.startTime)}-${formatTime(preGenConfirmCtx.endTime)}`
		: 'No slot selected';
	const placementBlocked = !confirmFacultyId || !confirmRoomId || (confirmPreview?.hardViolations.length ?? 0) > 0;

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

	return (
		<>
			<Dialog open={showPreGenConfirm} onOpenChange={(open) => { if (!open) closePlacement(); }}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Review draft placement</DialogTitle>
						<DialogDescription>
							{sourceLabel} - {slotLabel}. Teaching Load owns class ownership; this step only reviews placement readiness.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="flex flex-wrap gap-1.5" aria-label="Draft placement steps">
							<StepPill label="1. Owner" state={confirmFacultyId ? 'done' : 'active'} />
							<StepPill label="2. Room source" state={confirmRoomId ? 'done' : confirmFacultyId ? 'active' : 'waiting'} />
							<StepPill label="3. Slot" state={preGenConfirmCtx ? 'done' : 'waiting'} />
							<StepPill label="4. Conflicts" state={confirmPreview ? 'done' : confirmPreviewLoading ? 'active' : 'waiting'} />
							<StepPill label="5. Save" state={confirmPreview && confirmPreview.hardViolations.length === 0 ? 'active' : 'waiting'} />
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

						<ReadOnlyField label="Target slot" value={slotLabel} />

						{confirmDisplacedPlacement ? (
							<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
								<p className="font-semibold">This slot is occupied.</p>
								<p className="mt-1">Review the visual switch before replacing anything.</p>
								<Button className="mt-2" size="sm" variant="outline" onClick={() => openSwapPrompt()}>
									Review switch
								</Button>
							</div>
						) : null}
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
						{confirmPreview && confirmPreview.softViolations.length > 0 ? (
							<label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
								<Checkbox checked={confirmAllowDailyOverride} onCheckedChange={(value) => setConfirmAllowDailyOverride(value === true)} />
								<span>I reviewed the workload and schedule warnings.</span>
							</label>
						) : null}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closePlacement}>Cancel</Button>
						<Button
							disabled={confirmSaving || placementBlocked || !confirmPreview}
							onClick={() => void commitConfirmPlacement()}
						>
							{confirmSaving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
							Save placement
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showSwapConfirm} onOpenChange={(open) => { if (!open) { setShowSwapConfirm(false); setSwapAction(null); } }}>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle>Review visual switch</DialogTitle>
						<DialogDescription>Confirm both outcomes before saving. Ownership stays from Teaching Load.</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 text-xs">
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
						{conflictSummary(swapPreview?.sourcePreview, 'Incoming session')}
						{conflictSummary(swapPreview?.displacedPreview, 'Displaced session')}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowSwapConfirm(false)}>Cancel</Button>
						<Button disabled={swapSaving || Boolean(swapPreview?.loading || swapPreview?.error)} onClick={() => void executeSwapAction()}>
							{swapSaving ? <Loader2 className="size-4 animate-spin" /> : null}
							Save switch
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(regularSwapPending)} onOpenChange={(open) => { if (!open) setRegularSwapPending(null); }}>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Review occupied-slot swap</DialogTitle>
						<DialogDescription>
							{regularSwapPending ? `${subjectLabel(regularSwapPending.entryA.subjectId)} for ${sectionLabel(regularSwapPending.entryA.sectionId)} will exchange times with ${subjectLabel(regularSwapPending.entryB.subjectId)} for ${sectionLabel(regularSwapPending.entryB.sectionId)}.` : ''}
						</DialogDescription>
					</DialogHeader>
					{regularSwapPreview?.loading ? (
						<p className="flex items-center gap-2 text-xs"><Loader2 className="size-4 animate-spin" />Checking options...</p>
					) : regularSwapPreview?.error ? (
						<p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{regularSwapPreview.error}</p>
					) : regularSwapPending && regularSwapPreview ? (
						<div className="space-y-3">
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
							<p className="text-xs font-semibold">Select a safe swap option</p>
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
						</div>
					) : null}
					<DialogFooter>
						<Button variant="outline" onClick={() => setRegularSwapPending(null)}>Cancel</Button>
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
