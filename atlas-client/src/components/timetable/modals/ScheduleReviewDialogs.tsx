import {
AlertCircle,
AlertTriangle,
CheckCircle2,
Clock,
Crosshair,
History,
Loader2,
Lock,
Play,
RefreshCw,
Send,
ShieldAlert,
UserX,
Users,
} from 'lucide-react';

import { formatTime } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { Skeleton } from '@/ui/skeleton';
import { Textarea } from '@/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

import { SearchableSelect } from '@/ui/searchable-select';
import { SoftViolationConfirmDialog } from '@/components/timetable/modals/SoftViolationConfirmDialog';
import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';

type ScheduleReviewDialogsProps = {
context: ScheduleReviewDialogsContext;
};

export function ScheduleReviewDialogs({ context }: ScheduleReviewDialogsProps) {
const {
showUnassignConfirm,
setShowUnassignConfirm,
setPendingUnassignId,
pendingUnassignId,
unassignDraftPlacement,
showGenerateConfirm,
setShowGenerateConfirm,
draftBoardSummary,
followUps,
confirmGenerate,
showResetDraftDialog,
setShowResetDraftDialog,
openPreGenerationWorkspace,
showLeavePreGenDialog,
setShowLeavePreGenDialog,
pendingCenterSwitch,
setPendingCenterSwitch,
requestPreview,
requestPreviewLoading,
setRequestPreview,
setSelectedRequestId,
setRequestAppeals,
setAppealReason,
requestPreviewHardConflicts,
requestPreviewSoftWarnings,
requestAppeals,
appealsLoading,
isPrivilegedUser,
updateAppealStatus,
appealReason,
appealSubmitting,
submitAppeal,
requestReviewerNotes,
setRequestReviewerNotes,
requestReviewSaving,
reviewRoomRequest,
generating,
generationElapsed,
showPublishDialog,
setShowPublishDialog,
softCount,
handlePublishConfirm,
showPreGenConfirm,
setShowPreGenConfirm,
setPreGenConfirmCtx,
setConfirmPreview,
setConfirmRawPreview,
setConfirmPreviewError,
setConfirmAllowSoftOverride,
setConfirmAllowDailyOverride,
preGenConfirmCtx,
confirmFacultyId,
setConfirmFacultyId,
confirmPreview,
confirmRoomId,
setConfirmRoomId,
facultyMap,
roomMap,
DAYS,
DAY_SHORT,
confirmPreviewLoading,
confirmPreviewError,
confirmDisplacedPlacement,
toast,
openSwapPrompt,
confirmAllowDailyOverride,
confirmSaving,
commitConfirmPlacement,
showSwapConfirm,
setShowSwapConfirm,
setSwapAction,
swapAction,
formatFacultyInitials,
roomLabelShort,
subjectLabel,
sectionLabel,
swapSaving,
executeSwapAction,
regularSwapPending,
setRegularSwapPending,
regularSwapSaving,
executeRegularSwap,
showSoftConfirm,
setShowSoftConfirm,
softConfirmWarnings,
commitLoading,
formatConstraintMessage,
setPendingCommitProposal,
setPreviewResult,
setSoftConfirmWarnings,
setDragItem,
pendingCommitProposal,
commitEdit,
showAssignmentPicker,
setShowAssignmentPicker,
setAssignPickerTarget,
assignPickerTarget,
assignPickerFacultyId,
setAssignPickerFacultyId,
assignPickerRoomId,
setAssignPickerRoomId,
confirmAssignmentPicker,
showEditHistory,
setShowEditHistory,
editHistory,
} = context;

return (
<>{/* -- Unassign Confirmation Dialog (E) -- */}
			<Dialog open={showUnassignConfirm} onOpenChange={setShowUnassignConfirm}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Unassign this session?</DialogTitle>
						<DialogDescription>
							This will delete the draft placement and return the session to the pre-generation queue. The action cannot be undone without reassigning.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => { setShowUnassignConfirm(false); setPendingUnassignId(null); }}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => {
								setShowUnassignConfirm(false);
								if (pendingUnassignId !== null) void unassignDraftPlacement(pendingUnassignId);
								setPendingUnassignId(null);
							}}
						>
							Unassign
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* -- Generate Confirmation Dialog -- */}			<Dialog open={showGenerateConfirm} onOpenChange={setShowGenerateConfirm}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Generate New Schedule?</DialogTitle>
						<DialogDescription>
							This generation will consume your current pre-generation draft placements
							{draftBoardSummary ? (
								<>
									 {' '}(<span className="font-semibold">{draftBoardSummary.unscheduled}</span> unassigned,
									 <span className="font-semibold">{draftBoardSummary.draft}</span> anchored)
								</>
							) : null}
							 and start a new generated run.
							 {followUps.size > 0 ? (
								<>
									 You currently have <span className="font-semibold text-amber-600">{followUps.size}</span>
									 flagged follow-up{followUps.size !== 1 ? 's' : ''}; they will be reset in the new run.
								</>
							) : null}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => setShowGenerateConfirm(false)}>
							Cancel
						</Button>
						<Button variant="default" size="sm" onClick={confirmGenerate}>
							<Play className="size-3.5 mr-1.5" />
							Generate Anyway
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showResetDraftDialog} onOpenChange={setShowResetDraftDialog}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Reset timetable?</DialogTitle>
						<DialogDescription>
							This will clear the current pre-generation draft placements. Existing generated runs are not changed, but unsaved or pinned pre-generation anchors in this workspace will be removed.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => setShowResetDraftDialog(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => {
								setShowResetDraftDialog(false);
								void openPreGenerationWorkspace(true);
							}}
						>
							Reset Draft
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showLeavePreGenDialog} onOpenChange={setShowLeavePreGenDialog}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Leave Pre-Generation Draft?</DialogTitle>
						<DialogDescription>
							You have pre-generation placements in progress. Saved anchors remain available for generation, but switching workspaces can hide the draft context.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => setShowLeavePreGenDialog(false)}>
							Cancel
						</Button>
						<Button
							variant="default"
							size="sm"
							onClick={() => {
								setShowLeavePreGenDialog(false);
								const action = pendingCenterSwitch;
								setPendingCenterSwitch(null);
								action?.();
							}}
						>
							Proceed
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Sheet
				open={!!requestPreview || requestPreviewLoading}
				onOpenChange={(open) => {
					if (!open) {
						setRequestPreview(null);
						setSelectedRequestId(null);
						setRequestAppeals([]);
						setAppealReason('');
					}
				}}
			>
				<SheetContent className="w-full sm:max-w-lg">
					<SheetHeader>
						<SheetTitle>Room Request Review</SheetTitle>
						<SheetDescription>Review request impact and decide without leaving timetable mode.</SheetDescription>
					</SheetHeader>
					<div className="mt-4 space-y-3">
						{requestPreviewLoading && !requestPreview ? (
							<div className="space-y-2">
								<Skeleton className="h-20 w-full rounded-lg" />
								<Skeleton className="h-28 w-full rounded-lg" />
							</div>
						) : requestPreview ? (
							<>
								<div className="rounded border border-border bg-muted/30 px-3 py-2 text-xs space-y-1">
									<p className="font-semibold">{requestPreview.request.facultyName}</p>
									<p className="text-muted-foreground">{requestPreview.request.subjectCode} � {requestPreview.request.sectionName}</p>
									<p className="text-muted-foreground">{requestPreview.request.day} {requestPreview.request.startTime}-{requestPreview.request.endTime}</p>
									<p className="text-muted-foreground">{requestPreview.request.currentRoomName} to {requestPreview.request.requestedRoomName}</p>
								</div>

								{requestPreview.request.rationale ? (
									<div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
										{requestPreview.request.rationale}
									</div>
								) : null}

								<div className="rounded border border-border px-3 py-2 text-xs space-y-1">
									<p className="font-medium">Preview impact</p>
									<p className="text-muted-foreground">Allowed: {requestPreview.preview.allowed ? 'Yes' : 'No'}</p>
									<p className="text-muted-foreground">Hard conflicts: {requestPreview.preview.hardViolations.length}</p>
									<p className="text-muted-foreground">Soft warnings: {requestPreview.preview.softViolations.length}</p>
								</div>

								{requestPreviewHardConflicts.length > 0 ? (
									<div className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs space-y-2">
										<p className="font-medium text-destructive">Approval blocked</p>
										{requestPreviewHardConflicts.map((conflict, index) => (
											<div key={`${conflict.code}-${conflict.humanTitle}-${index}`} className="space-y-0.5">
												<p className="font-medium text-foreground">{conflict.humanTitle}</p>
												<p className="text-muted-foreground">{conflict.humanDetail}</p>
											</div>
										))}
									</div>
								) : null}

								{requestPreviewSoftWarnings.length > 0 ? (
									<div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs space-y-2 text-amber-950">
										<p className="font-medium">Warnings to review</p>
										{requestPreviewSoftWarnings.map((conflict, index) => (
											<div key={`${conflict.code}-${conflict.humanTitle}-${index}`} className="space-y-0.5">
												<p className="font-medium">{conflict.humanTitle}</p>
												<p>{conflict.humanDetail}</p>
											</div>
										))}
									</div>
								) : null}

								<div className="rounded border border-border px-3 py-2 text-xs space-y-2">
									<div className="flex items-center justify-between">
										<p className="font-medium">Appeals timeline</p>
										<Badge variant="outline" className="h-5 px-1.5 text-[0.625rem] uppercase">
											{requestAppeals.length} total
										</Badge>
									</div>
									{appealsLoading ? (
										<Skeleton className="h-14 w-full rounded" />
									) : requestAppeals.length === 0 ? (
										<p className="text-muted-foreground">No appeals yet.</p>
									) : (
										<div className="max-h-36 space-y-1.5 overflow-auto">
											{requestAppeals.map((appeal) => (
												<div key={appeal.id} className="rounded border border-border bg-muted/20 px-2 py-1.5">
													<div className="flex items-center justify-between gap-2">
														<p className="font-medium truncate">{appeal.requesterName}</p>
														<Badge variant="outline" className="h-4 px-1 text-[0.5625rem] uppercase">{appeal.status}</Badge>
													</div>
													<p className="mt-0.5 text-muted-foreground">{appeal.reason}</p>
													{appeal.history.length > 0 ? (
														<p className="mt-0.5 text-[0.625rem] text-muted-foreground">
															Last update: {new Date(appeal.history[appeal.history.length - 1].createdAt).toLocaleString()}
														</p>
													) : null}
													{isPrivilegedUser ? (
														<div className="mt-1 flex gap-1">
															<Button variant="outline" size="sm" className="h-6 px-1.5 text-[0.625rem]" onClick={() => void updateAppealStatus(appeal.id, 'UNDER_REVIEW')}>Under Review</Button>
															<Button variant="outline" size="sm" className="h-6 px-1.5 text-[0.625rem]" onClick={() => void updateAppealStatus(appeal.id, 'UPHELD')}>Upheld</Button>
															<Button variant="outline" size="sm" className="h-6 px-1.5 text-[0.625rem]" onClick={() => void updateAppealStatus(appeal.id, 'DENIED')}>Denied</Button>
														</div>
													) : null}
												</div>
											))}
										</div>
									)}
									{!isPrivilegedUser ? (
										<div className="space-y-2 pt-1">
											<Textarea
												value={appealReason}
												onChange={(event) => setAppealReason(event.target.value)}
												placeholder="Reason for appeal"
												className="min-h-16 text-xs"
											/>
											<Button
												variant="outline"
												size="sm"
												className="h-7 text-xs"
												disabled={appealSubmitting || !appealReason.trim()}
												onClick={() => void submitAppeal()}
											>
												{appealSubmitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
												Submit appeal
											</Button>
										</div>
									) : null}
								</div>

								{isPrivilegedUser ? (
									<>
										<Textarea
											value={requestReviewerNotes}
											onChange={(event) => setRequestReviewerNotes(event.target.value)}
											placeholder="Decision notes"
											className="min-h-20 text-xs"
										/>

										<div className="flex gap-2">
											<Button
												className="flex-1"
												disabled={requestReviewSaving || !requestPreview.preview.allowed}
												onClick={() => void reviewRoomRequest('APPROVED')}
											>
												<CheckCircle2 className="mr-1.5 size-4" /> Approve
											</Button>
											<Button
												variant="destructive"
												className="flex-1"
												disabled={requestReviewSaving}
												onClick={() => void reviewRoomRequest('REJECTED')}
											>
												Reject
											</Button>
										</div>
									</>
								) : null}
							</>
						) : null}
					</div>
				</SheetContent>
			</Sheet>

			{/* -- Generation Progress Overlay -- */}
			<Dialog open={generating} modal>
				<DialogContent className="sm:max-w-sm" onPointerDownOutside={(e) => e.preventDefault()} hideClose>
					<div className="flex flex-col items-center gap-4 py-4">
						<div className="relative flex items-center justify-center">
							<div className="absolute size-16 rounded-full border-4 border-primary/20" />
							<Loader2 className="size-10 text-primary animate-spin" />
						</div>
						<div className="text-center space-y-1">
							<h3 className="text-base font-semibold">Generating Schedule</h3>
							<p className="text-sm text-muted-foreground">
								Constructing timetable and validating constraints�
							</p>
						</div>
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
							<Clock className="size-3" />
							<span>Elapsed: {generationElapsed}s</span>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* -- Publish Dialog -- */}
			<Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Publish Schedule</DialogTitle>
						<DialogDescription>
							{softCount > 0 ? (
								<>
									This draft has <span className="font-semibold text-amber-600">{softCount}</span> soft
									violation{softCount !== 1 ? 's' : ''} (informational � does not block publish).
								</>
							) : (
								'This draft has no violations. Ready to publish.'
							)}
						</DialogDescription>
					</DialogHeader>

										<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => setShowPublishDialog(false)}>
							Cancel
						</Button>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span>
										<Button
											variant="default"
											size="sm"
																						onClick={handlePublishConfirm}
										>
											<Send className="size-3.5 mr-1.5" />
											Publish
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>Publish API implementation is Phase 5 scope</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* -- Wave 4.5: Pre-Gen Placement Confirm Sheet -- */}
			<Dialog open={showPreGenConfirm} onOpenChange={(open) => {
				if (!open) {
					setShowPreGenConfirm(false);
					setPreGenConfirmCtx(null);
					setConfirmPreview(null);
					setConfirmRawPreview(null);
					setConfirmPreviewError(null);
					setConfirmAllowSoftOverride(false);
					setConfirmAllowDailyOverride(false);
				}
			}}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Crosshair className="size-4 text-primary" />
							Confirm Placement
						</DialogTitle>
						<DialogDescription>
							{preGenConfirmCtx?.source.type === 'draftQueue'
								? `${preGenConfirmCtx.source.item.subjectCode} � ${preGenConfirmCtx.source.item.sectionName} � Session ${preGenConfirmCtx.source.item.sessionNumber}/${preGenConfirmCtx.source.item.sessionsPerWeek}`
								: preGenConfirmCtx
									? `Draft Placement #${preGenConfirmCtx.source.placement.id}`
									: ''}
							{preGenConfirmCtx && ` � ${preGenConfirmCtx.day} ${formatTime(preGenConfirmCtx.startTime)}�${formatTime(preGenConfirmCtx.endTime)}`}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						{/* Faculty Picker */}
						<div className="space-y-1.5">
							<label className="text-xs font-medium">Faculty</label>
							{preGenConfirmCtx?.source.type === 'draftQueue' && preGenConfirmCtx.source.item.hasNoTeacher && (
								<div className="flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[0.6875rem] text-amber-700">
									<UserX className="size-3.5 shrink-0" />
									No faculty is assigned in teaching load for this session. Any available teacher may be selected.
								</div>
							)}
							<Select value={confirmFacultyId} onValueChange={(v) => { setConfirmFacultyId(v); setConfirmPreview(null); }}>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue placeholder="Select faculty�" />
								</SelectTrigger>
								<SelectContent>
									{preGenConfirmCtx?.source.type === 'draftQueue' && preGenConfirmCtx.source.item.facultyOptionsEnriched.length > 0
										? preGenConfirmCtx.source.item.facultyOptionsEnriched.map((f: { id: number; name: string; department: string | null; dailyMinutesByDay: Record<string, number> }) => {
											const dayMins = preGenConfirmCtx ? (f.dailyMinutesByDay[preGenConfirmCtx.day] ?? 0) : 0;
											const dayBand = dayMins > 480 ? 'hard' : dayMins > 360 ? 'soft' : 'ok';
											return (
												<SelectItem key={f.id} value={String(f.id)}>
													<span className="flex items-center gap-2">
														<span className="flex-1 min-w-0 truncate">{f.name}</span>
														{f.department && <span className="text-muted-foreground text-[0.5625rem]">{f.department}</span>}
														<span className={`shrink-0 text-[0.5625rem] font-medium ${dayBand === 'hard' ? 'text-red-600' : dayBand === 'soft' ? 'text-amber-600' : 'text-emerald-600'}`}>
															{Math.round(dayMins / 60 * 10) / 10}h
														</span>
													</span>
												</SelectItem>
											);
										})
										: Array.from(facultyMap.values()).map((f: { id: number; firstName: string; lastName: string }) => (
											<SelectItem key={f.id} value={String(f.id)}>
												{f.lastName}, {f.firstName}
											</SelectItem>
										))}
								</SelectContent>
							</Select>

							{/* Weekly load strip for selected faculty */}
							{confirmFacultyId && (() => {
								const enrichedList = preGenConfirmCtx?.source.type === 'draftQueue'
									? preGenConfirmCtx.source.item.facultyOptionsEnriched
									: [];
								const enriched = enrichedList.find((f: { id: number; dailyMinutesByDay: Record<string, number> }) => String(f.id) === confirmFacultyId);
								if (!enriched && !confirmPreview?.facultyWeeklyMinutes) return null;
								const weeklyMins = confirmPreview?.facultyWeeklyMinutes ?? enriched?.dailyMinutesByDay ?? {};
								return (
									<div className="grid grid-cols-5 gap-1 mt-1">
										{DAYS.map((day) => {
											const mins = weeklyMins[day] ?? 0;
											const band = mins > 480 ? 'hard' : mins > 360 ? 'soft' : 'ok';
											const isTarget = preGenConfirmCtx?.day === day;
											return (
												<div
													key={day}
													className={`flex flex-col items-center gap-0.5 rounded border px-1 py-1 text-center ${
														isTarget ? 'border-primary/40 bg-primary/5' : 'border-border'
													} ${band === 'hard' ? 'bg-red-50' : band === 'soft' ? 'bg-amber-50' : ''}`}
												>
													<span className="text-[0.5rem] text-muted-foreground font-medium">{DAY_SHORT[day]}</span>
													<span className={`text-[0.5625rem] font-semibold ${band === 'hard' ? 'text-red-600' : band === 'soft' ? 'text-amber-600' : 'text-foreground'}`}>
														{Math.round(mins / 60 * 10) / 10}h
													</span>
												</div>
											);
										})}
									</div>
								);
							})()}
						</div>

						{/* Room Picker */}
						<div className="space-y-1.5">
							<label className="text-xs font-medium">Room</label>
							<Select value={confirmRoomId} onValueChange={(v) => { setConfirmRoomId(v); setConfirmPreview(null); }}>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue placeholder="Select room�" />
								</SelectTrigger>
								<SelectContent>
									{Array.from(roomMap.values())
										.filter((r) => r.isTeachingSpace)
										.map((r) => (
											<SelectItem key={r.id} value={String(r.id)}>
												{r.name} {r.buildingName ? `� ${r.buildingName}` : ''}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>

						{/* Wave 4.5b item 11: auto-preview via useEffect debounce � no separate button */}
						{confirmPreviewLoading && (
							<div className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
								<Loader2 className="size-3.5 animate-spin" />
								Previewing constraints�
							</div>
						)}

						{confirmPreviewError && (
							<div className="flex items-start gap-1.5 rounded border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[0.6875rem] text-destructive">
								<AlertCircle className="size-3.5 shrink-0 mt-0.5" />
								{confirmPreviewError}
							</div>
						)}

						{confirmPreview && (
							<div className="space-y-2">
								{confirmPreview.hardViolations.length > 0 && (
									<div className="rounded border border-red-300 bg-red-50 px-2.5 py-2 space-y-1">
										<p className="text-[0.625rem] font-semibold text-red-700 flex items-center gap-1">
											<ShieldAlert className="size-3" /> {confirmPreview.hardViolations.length} Hard Conflict{confirmPreview.hardViolations.length > 1 ? 's' : ''}
										</p>
										{confirmPreview.humanConflicts.filter((c) => c.severity === 'HARD').map((c, idx) => (
											<div key={idx} className="space-y-0.5">
												<p className="text-[0.5625rem] font-medium text-red-800">{c.humanTitle}</p>
												<p className="text-[0.5rem] text-red-600/80 leading-snug">{c.humanDetail}</p>
											</div>
										))}
												{confirmDisplacedPlacement && preGenConfirmCtx && (
													<Button
														variant="outline"
														size="sm"
														className="h-7 text-[0.625rem]"
														onClick={() => {
															const facultyId = Number(confirmFacultyId);
															const roomId = Number(confirmRoomId);
															if (!facultyId || !roomId) {
																toast.error('Select faculty and room before swapping.');
																return;
															}
															openSwapPrompt(
																preGenConfirmCtx.source,
																{
																	day: preGenConfirmCtx.day,
																	startTime: preGenConfirmCtx.startTime,
																	endTime: preGenConfirmCtx.endTime,
																	facultyId,
																	roomId,
																},
																confirmDisplacedPlacement,
																confirmPreview.humanConflicts[0]?.humanTitle ?? 'Selected placement',
															);
															setShowPreGenConfirm(false);
														}}
													>
														Swap by returning conflicting session to queue
													</Button>
												)}
									</div>
								)}
								{confirmPreview.dailyLoadBand === 'hard' && (
									<div className="rounded border border-red-300 bg-red-50 px-2.5 py-2 text-[0.6875rem] text-red-700">
										<p className="font-semibold flex items-center gap-1"><AlertTriangle className="size-3" /> Daily load hard block</p>
										<p className="mt-0.5">This placement would exceed the 8-hour daily limit ({Math.round((confirmPreview.dailyMinutesAfter ?? 0) / 60 * 10) / 10}h). Choose a different slot, day, or faculty.</p>
									</div>
								)}
								{confirmPreview.dailyLoadBand === 'soft' && (
									<div className="space-y-1 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[0.6875rem] text-amber-700">
										<p className="font-semibold flex items-center gap-1"><AlertTriangle className="size-3" /> Daily load soft warning ({Math.round((confirmPreview.dailyMinutesAfter ?? 0) / 60 * 10) / 10}h, standard limit 6h)</p>
										<label className="flex items-center gap-2 cursor-pointer">
											<Checkbox
												checked={confirmAllowDailyOverride}
												onCheckedChange={(checked) => setConfirmAllowDailyOverride(Boolean(checked))}
												className="size-3.5"
											/>
											<span>I acknowledge the extended teaching day</span>
										</label>
									</div>
								)}
								{confirmPreview.softViolations.length > 0 && (
									<div className="space-y-1 rounded border border-amber-200 bg-amber-50/70 px-2.5 py-2 text-[0.6875rem] text-amber-700">
										<p className="font-semibold">{confirmPreview.softViolations.length} soft warning{confirmPreview.softViolations.length > 1 ? 's' : ''}</p>
										{confirmPreview.humanConflicts.filter((c) => c.severity === 'SOFT').map((c, idx) => (
											<div key={idx} className="space-y-0.5">
												<p className="text-[0.5625rem] font-medium text-amber-800">{c.humanTitle}</p>
												<p className="text-[0.5rem] text-amber-600/80 leading-snug">{c.humanDetail}</p>
											</div>
										))}
										</div>
								)}
								{confirmPreview.hardViolations.length === 0 && confirmPreview.dailyLoadBand !== 'hard' && (
									<div className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[0.6875rem] text-emerald-700">
										<CheckCircle2 className="size-3.5" />
										No hard conflicts � safe to save.
									</div>
								)}
							</div>
						)}
					</div>

					<DialogFooter className="gap-2">
						<Button
							variant="outline"
							size="sm"
							className="h-8 text-xs"
							onClick={() => setShowPreGenConfirm(false)}
						>
							Cancel
						</Button>
						<Button
							id="pre-gen-confirm-save-anchor"
							data-testid="pre-gen-confirm-save-anchor"
							size="sm"
							className="h-8 text-xs"
							disabled={
								!confirmFacultyId
								|| !confirmRoomId
								|| confirmSaving
								|| (confirmPreview?.hardViolations.length ?? 0) > 0
								|| confirmPreview?.dailyLoadBand === 'hard'
								|| (confirmPreview?.dailyLoadBand === 'soft' && !confirmAllowDailyOverride)
								
								|| !confirmPreview
							}
							onClick={() => void commitConfirmPlacement()}
						>
							{confirmSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Lock className="mr-1.5 size-3.5" />}
							Save Anchor
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* -- Swap Confirmation Dialog -- */}
			<Dialog open={showSwapConfirm} onOpenChange={(open) => {
				if (!open) {
					setShowSwapConfirm(false);
					setSwapAction(null);
				}
			}}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<RefreshCw className="size-4 text-primary" />
							Swap Placement?
						</DialogTitle>
						<DialogDescription>
							{swapAction
								? `${swapAction.sourceLabel} will be placed on ${DAY_SHORT[swapAction.target.day] ?? swapAction.target.day} ${formatTime(swapAction.target.startTime)}-${formatTime(swapAction.target.endTime)}.`
								: 'Confirm swap action.'}
						</DialogDescription>
					</DialogHeader>
					{swapAction && (
						<div className="space-y-2 text-xs">
							<div className="rounded border border-border bg-muted/20 px-2.5 py-2">
								<p className="font-medium">Destination</p>
								<p className="text-muted-foreground">
									{DAY_SHORT[swapAction.target.day] ?? swapAction.target.day} {formatTime(swapAction.target.startTime)}-{formatTime(swapAction.target.endTime)}
									 {' '}� Faculty {formatFacultyInitials(swapAction.target.facultyId)} � {roomLabelShort(swapAction.target.roomId)}
								</p>
							</div>
							<div className="rounded border border-amber-300 bg-amber-50 px-2.5 py-2 text-amber-900">
								<p className="font-medium">Displaced session outcome</p>
								<p>
									{subjectLabel(swapAction.displaced.subjectId)} � {sectionLabel(swapAction.displaced.sectionId)} will be returned to the Unassigned queue.
								</p>
							</div>
						</div>
					)}
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => { setShowSwapConfirm(false); setSwapAction(null); }}>
							Cancel
						</Button>
						<Button size="sm" disabled={swapSaving || !swapAction} onClick={() => { void executeSwapAction(); }}>
							{swapSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 size-3.5" />}
							Confirm Swap
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* -- Regular Entry Swap Confirmation Dialog -- */}
			<Dialog open={!!regularSwapPending} onOpenChange={(o) => { if (!o) setRegularSwapPending(null); }}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Swap Sessions?</DialogTitle>
						<DialogDescription>
							{regularSwapPending
								? `${subjectLabel(regularSwapPending.entryA.subjectId)} (${sectionLabel(regularSwapPending.entryA.sectionId)}) will move to ${DAY_SHORT[regularSwapPending.entryB.day] ?? regularSwapPending.entryB.day} ${formatTime(regularSwapPending.entryB.startTime)}�${formatTime(regularSwapPending.entryB.endTime)}. ${subjectLabel(regularSwapPending.entryB.subjectId)} (${sectionLabel(regularSwapPending.entryB.sectionId)}) will move to the original slot.`
								: 'Confirm swap action.'}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2">
						<Button variant="outline" size="sm" onClick={() => setRegularSwapPending(null)}>Cancel</Button>
						<Button size="sm" disabled={regularSwapSaving} onClick={() => { void executeRegularSwap(); }}>
							{regularSwapSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 size-3.5" />}
							Confirm Swap
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
					if (pendingCommitProposal) commitEdit(pendingCommitProposal, true);
				}}
			/>

			{/* -- Assignment Picker for Unassigned Placement -- */}
			<Dialog open={showAssignmentPicker} onOpenChange={(open) => {
				if (!open) {
					setShowAssignmentPicker(false);
					setAssignPickerTarget(null);
					setDragItem(null);
				}
			}}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Users className="size-4 text-primary" />
							Assign Faculty &amp; Room
						</DialogTitle>
						<DialogDescription>
							{assignPickerTarget && (
								<>
									Placing <span className="font-medium">{subjectLabel(assignPickerTarget.item.subjectId)}</span>
									{' '}for {sectionLabel(assignPickerTarget.item.sectionId)} on {DAY_SHORT[assignPickerTarget.day]} at {formatTime(assignPickerTarget.startTime)}.
								</>
							)}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div className="space-y-1.5">
							<span className="text-xs font-medium">Faculty</span>
							<SearchableSelect
								value={assignPickerFacultyId}
								onValueChange={setAssignPickerFacultyId}
								groups={Array.from(
									Array.from(facultyMap.values())
										.sort((a, b) => `${a.lastName}`.localeCompare(`${b.lastName}`))
										.reduce((groups, faculty) => {
											const key = faculty.department ?? 'Unassigned Department';
											const items = groups.get(key) ?? [];
											items.push({ value: String(faculty.id), label: `${faculty.lastName}, ${faculty.firstName}` });
											groups.set(key, items);
											return groups;
										}, new Map<string, Array<{ value: string; label: string }>>())
										.entries(),
								).map(([label, items]) => ({ label, items }))}
								placeholder="Select a faculty member�"
								triggerClassName="h-8 text-xs"
							/>
						</div>
						<div className="space-y-1.5">
							<span className="text-xs font-medium">Room</span>
							<SearchableSelect
								value={assignPickerRoomId}
								onValueChange={setAssignPickerRoomId}
								groups={Array.from(
									Array.from(roomMap.values())
										.filter((room) => room.isTeachingSpace)
										.sort((a, b) => {
											const ba = (a.buildingShortCode || a.buildingName).toLowerCase();
											const bb = (b.buildingShortCode || b.buildingName).toLowerCase();
											if (ba !== bb) return ba.localeCompare(bb);
											return a.name.localeCompare(b.name);
										})
										.reduce((groups, room) => {
											const key = room.buildingShortCode || room.buildingName;
											const items = groups.get(key) ?? [];
											items.push({ value: String(room.id), label: room.name });
											groups.set(key, items);
											return groups;
										}, new Map<string, Array<{ value: string; label: string }>>())
										.entries(),
								).map(([label, items]) => ({ label, items }))}
								placeholder="Select a room�"
								triggerClassName="h-8 text-xs"
							/>
						</div>
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => {
							setShowAssignmentPicker(false);
							setAssignPickerTarget(null);
							setDragItem(null);
						}}>
							Cancel
						</Button>
						<Button
							variant="default"
							size="sm"
							disabled={!assignPickerFacultyId || !assignPickerRoomId}
							onClick={confirmAssignmentPicker}
						>
							Preview &amp; Place
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* -- Edit History Dialog -- */}
			<Dialog open={showEditHistory} onOpenChange={setShowEditHistory}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<History className="size-4" />
							Manual Edit History
						</DialogTitle>
						<DialogDescription>
							{editHistory.length === 0
								? 'No manual edits have been made on this run.'
								: `${editHistory.length} edit(s) recorded.`}
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-64 overflow-auto space-y-1.5 py-2">
						{editHistory.map((edit) => (
							<div
								key={edit.id}
								className={`rounded border px-3 py-2 text-xs space-y-0.5 ${
									edit.editType === 'REVERT'
										? 'border-muted bg-muted/30'
										: 'border-border bg-background'
								}`}
							>
								<div className="flex items-center justify-between">
									<Badge variant="outline" className="h-4 px-1 text-[0.5625rem]">
										{edit.editType.replace(/_/g, ' ')}
									</Badge>
									<span className="text-[0.625rem] text-muted-foreground">
										{new Date(edit.createdAt).toLocaleString()}
									</span>
								</div>
								{edit.validationSummary != null ? (() => {
									const vs = edit.validationSummary as Record<string, number>;
									return (
										<div className="text-muted-foreground text-[0.625rem]">
											Hard: {vs.hardCount ?? 0}, Soft: {vs.softCount ?? 0}
										</div>
									);
								})() : null}
							</div>
						))}
					</div>
					<DialogFooter>
						<Button variant="outline" size="sm" onClick={() => setShowEditHistory(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			</>
);
}
