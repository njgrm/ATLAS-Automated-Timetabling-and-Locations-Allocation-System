import { AlertTriangle, Loader2, Lock, RefreshCw } from 'lucide-react';

import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';
import { formatTime } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { SearchableSelect } from '@/ui/searchable-select';
import { SoftViolationConfirmDialog } from './SoftViolationConfirmDialog';

function conflictSummary(preview: { hardViolations: unknown[]; softViolations: unknown[] } | null | undefined) {
	if (!preview) return null;
	return <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-md border p-2">Blocking: <strong>{preview.hardViolations.length}</strong></div><div className="rounded-md border p-2">Warnings: <strong>{preview.softViolations.length}</strong></div></div>;
}

export function TimetablePlacementDialogs({ context }: { context: ScheduleReviewDialogsContext }) {
	const {
		showPreGenConfirm, setShowPreGenConfirm, setPreGenConfirmCtx, setConfirmPreview, setConfirmRawPreview,
		setConfirmPreviewError, setConfirmAllowSoftOverride, setConfirmAllowDailyOverride, preGenConfirmCtx,
		confirmFacultyId, setConfirmFacultyId, confirmPreview, confirmRoomId, setConfirmRoomId, facultyMap, roomMap,
		confirmPreviewLoading, confirmPreviewError, confirmDisplacedPlacement, openSwapPrompt,
		confirmAllowDailyOverride, confirmSaving, commitConfirmPlacement,
		showSwapConfirm, setShowSwapConfirm, setSwapAction, swapAction, swapSaving, executeSwapAction, swapPreview,
		regularSwapPending, setRegularSwapPending, regularSwapPreview, regularSwapStrategy, setRegularSwapStrategy, regularSwapSaving, executeRegularSwap,
		showSoftConfirm, setShowSoftConfirm, softConfirmWarnings, commitLoading, formatConstraintMessage,
		setPendingCommitProposal, setPreviewResult, setSoftConfirmWarnings, setDragItem, pendingCommitProposal, commitEdit,
		subjectLabel, sectionLabel, DAY_SHORT,
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
	const facultyItems = Array.from(facultyMap.values()).map((faculty) => ({ value: String(faculty.id), label: `${faculty.lastName}, ${faculty.firstName}${faculty.department ? ` · ${faculty.department}` : ''}` }));
	const roomItems = Array.from(roomMap.values()).filter((room) => room.isTeachingSpace).map((room) => ({ value: String(room.id), label: `${room.name} · ${room.buildingShortCode || room.buildingName}` }));
	const sourceLabel = preGenConfirmCtx?.source?.type === 'draftQueue'
		? `${preGenConfirmCtx.source.item.subjectCode} · ${preGenConfirmCtx.source.item.sectionName}`
		: preGenConfirmCtx?.source?.placement ? `Saved placement ${preGenConfirmCtx.source.placement.id}` : 'Selected session';

	return <>
		<Dialog open={showPreGenConfirm} onOpenChange={(open) => { if (!open) closePlacement(); }}>
			<DialogContent className="max-w-lg">
				<DialogHeader><DialogTitle>Confirm placement</DialogTitle><DialogDescription>{sourceLabel}{preGenConfirmCtx ? ` · ${preGenConfirmCtx.day} ${formatTime(preGenConfirmCtx.startTime)}-${formatTime(preGenConfirmCtx.endTime)}` : ''}</DialogDescription></DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1"><label className="text-xs font-medium">Teacher</label><SearchableSelect items={facultyItems} value={confirmFacultyId} onValueChange={(value) => { setConfirmFacultyId(value); setConfirmPreview(null); }} placeholder="Choose teacher" /></div>
					<div className="space-y-1"><label className="text-xs font-medium">Room</label><SearchableSelect items={roomItems} value={confirmRoomId} onValueChange={(value) => { setConfirmRoomId(value); setConfirmPreview(null); }} placeholder="Choose room" /></div>
					{confirmDisplacedPlacement && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-semibold">This slot already has a saved session.</p><p className="mt-1">Review the switch before replacing it.</p><Button className="mt-2" size="sm" variant="outline" onClick={() => openSwapPrompt()}>Review switch</Button></div>}
					{confirmPreviewLoading && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Checking placement...</p>}
					{confirmPreviewError && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{confirmPreviewError}</p>}
					{conflictSummary(confirmPreview)}
					{confirmPreview && confirmPreview.softViolations.length > 0 && <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><Checkbox checked={confirmAllowDailyOverride} onCheckedChange={(value) => setConfirmAllowDailyOverride(value === true)} /><span>I reviewed the workload and schedule warnings.</span></label>}
				</div>
				<DialogFooter><Button variant="outline" onClick={closePlacement}>Cancel</Button><Button disabled={confirmSaving || !confirmFacultyId || !confirmRoomId || !confirmPreview || confirmPreview.hardViolations.length > 0} onClick={() => void commitConfirmPlacement()}>{confirmSaving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}Save anchor</Button></DialogFooter>
			</DialogContent>
		</Dialog>

		<Dialog open={showSwapConfirm} onOpenChange={(open) => { if (!open) { setShowSwapConfirm(false); setSwapAction(null); } }}>
			<DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Review placement switch</DialogTitle><DialogDescription>Confirm where both sessions will be placed before saving.</DialogDescription></DialogHeader><div className="space-y-3 text-xs">{swapPreview?.loading && <p className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />Checking both placements...</p>}{swapPreview?.error && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-red-800">{swapPreview.error}</p>}{swapAction && <div className="rounded-md border p-3"><p className="font-semibold">Two sessions will exchange timetable positions.</p><p className="mt-1 text-muted-foreground">Teacher, room, and time conflicts are checked for both sessions.</p></div>}{conflictSummary(swapPreview?.sourcePreview)}{conflictSummary(swapPreview?.displacedPreview)}</div><DialogFooter><Button variant="outline" onClick={() => setShowSwapConfirm(false)}>Cancel</Button><Button disabled={swapSaving || Boolean(swapPreview?.loading || swapPreview?.error)} onClick={() => void executeSwapAction()}>{swapSaving && <Loader2 className="size-4 animate-spin" />}Save switch</Button></DialogFooter></DialogContent>
		</Dialog>

		<Dialog open={Boolean(regularSwapPending)} onOpenChange={(open) => { if (!open) setRegularSwapPending(null); }}>
			<DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Review occupied-slot swap</DialogTitle><DialogDescription>{regularSwapPending ? `${subjectLabel(regularSwapPending.entryA.subjectId)} for ${sectionLabel(regularSwapPending.entryA.sectionId)} will exchange times with ${subjectLabel(regularSwapPending.entryB.subjectId)} for ${sectionLabel(regularSwapPending.entryB.sectionId)}.` : ''}</DialogDescription></DialogHeader>{regularSwapPreview?.loading ? <p className="flex items-center gap-2 text-xs"><Loader2 className="size-4 animate-spin" />Checking options...</p> : regularSwapPreview?.error ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{regularSwapPreview.error}</p> : regularSwapPreview && <div className="space-y-2"><p className="text-xs font-semibold">Choose a valid repair</p><Button className="w-full" variant={regularSwapStrategy === 'DIRECT_SWAP' ? 'default' : 'outline'} disabled={(regularSwapPreview.directPreview?.hardViolations.length ?? 0) > 0} onClick={() => setRegularSwapStrategy('DIRECT_SWAP')}>Direct swap</Button><Button className="w-full" variant={regularSwapStrategy === 'AUTO_FIX_MOVE_BLOCKING' ? 'default' : 'outline'} disabled={!regularSwapPreview.autoFixBlockingPreview} onClick={() => setRegularSwapStrategy('AUTO_FIX_MOVE_BLOCKING')}>Move blocking session</Button><Button className="w-full" variant={regularSwapStrategy === 'AUTO_FIX_MOVE_SOURCE' ? 'default' : 'outline'} disabled={!regularSwapPreview.autoFixSourcePreview} onClick={() => setRegularSwapStrategy('AUTO_FIX_MOVE_SOURCE')}>Move selected session</Button></div>}<DialogFooter><Button variant="outline" onClick={() => setRegularSwapPending(null)}>Cancel</Button><Button disabled={regularSwapSaving || !regularSwapStrategy} onClick={() => void executeRegularSwap()}>{regularSwapSaving ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Apply repair</Button></DialogFooter></DialogContent>
		</Dialog>

		<SoftViolationConfirmDialog open={showSoftConfirm} warnings={softConfirmWarnings} commitLoading={commitLoading} formatConstraintMessage={formatConstraintMessage} onCancel={() => { setShowSoftConfirm(false); setPendingCommitProposal(null); setPreviewResult(null); setSoftConfirmWarnings([]); setDragItem(null); }} onConfirm={() => { if (pendingCommitProposal) void commitEdit(pendingCommitProposal, true); }} />
	</>;
}
