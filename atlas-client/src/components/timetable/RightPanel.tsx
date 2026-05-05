import { AnimatePresence, motion } from 'motion/react';
import {
	Clock,
	Crosshair,
	DoorOpen,
	Flag,
	Loader2,
	PanelRightClose,
	PanelRightOpen,
	Trash2,
	Users,
	UserX,
	X,
} from 'lucide-react';

import { formatTime } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ResizableHandle, ResizablePanel } from '@/ui/resizable';
import { ScrollArea } from '@/ui/scroll-area';
import { Separator } from '@/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

type RightPanelProps = {
	rightPanelRef: any;
	setIsRightCollapsed: (collapsed: boolean) => void;
	isRightCollapsed: boolean;
	isPreGenerationWorkspace: boolean;
	preGenKbSource: any;
	selectedEntry: any;
	setPreGenKbSource: (value: any) => void;
	setKbSelectedSource: (value: any) => void;
	gradeBadge: Record<number, string>;
	initials: (firstName: string | null, lastName: string | null) => string;
	facultyMap: Map<number, any>;
	formatFacultyInitials: (id: number) => string;
	isDesktop: boolean;
	subjectLabel: (id: number) => string;
	toggleFollowUp: (entryId: string) => Promise<void>;
	followUps: Set<string>;
	setSelectedEntry: (entry: any) => void;
	gradeForSection: (sectionId: number) => number | null;
	violationIndex: Map<string, any[]>;
	sectionLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	roomLabel: (id: number) => string;
	roomRequestSummary: any;
	previewResult: any;
	formatConstraintMessage: (message: string) => string;
	violationLabels: Record<string, string>;
	violationExplanations: Record<string, { why: string }>;
	setSelectedViolation: (value: any) => void;
	toast: { error: (message: string) => void; info: (message: string) => void };
	draftBoard: any;
	parseDraftPlacementId: (entryId: string) => number | null;
	deletingPlacementId: number | null;
	setPendingUnassignId: (id: number | null) => void;
	setShowUnassignConfirm: (open: boolean) => void;
	enterManualEditView: (action: 'CHANGE_ROOM' | 'CHANGE_FACULTY') => void;
	dayShort: Record<string, string>;
};

export function RightPanel(props: RightPanelProps) {
	const {
		rightPanelRef,
		setIsRightCollapsed,
		isRightCollapsed,
		isPreGenerationWorkspace,
		preGenKbSource,
		selectedEntry,
		setPreGenKbSource,
		setKbSelectedSource,
		gradeBadge,
		initials,
		facultyMap,
		formatFacultyInitials,
		isDesktop,
		subjectLabel,
		toggleFollowUp,
		followUps,
		setSelectedEntry,
		gradeForSection,
		violationIndex,
		sectionLabel,
		facultyLabel,
		roomLabel,
		roomRequestSummary,
		previewResult,
		formatConstraintMessage,
		violationLabels,
		violationExplanations,
		setSelectedViolation,
		toast,
		draftBoard,
		parseDraftPlacementId,
		deletingPlacementId,
		setPendingUnassignId,
		setShowUnassignConfirm,
		enterManualEditView,
		dayShort,
	} = props;

	return (
		<>
			<ResizableHandle withHandle />
			<ResizablePanel
				ref={rightPanelRef}
				id="right-panel"
				order={3}
				minSize={12}
				maxSize={30}
				defaultSize={20}
				collapsible
				collapsedSize={3}
				onCollapse={() => setIsRightCollapsed(true)}
				onExpand={() => setIsRightCollapsed(false)}
				className="flex flex-col min-h-0 bg-background overflow-hidden border-l border-border"
			>
				{isRightCollapsed ? (
					<div className="flex flex-col items-center gap-2 pt-2 w-full h-full">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => rightPanelRef.current?.expand()} aria-label="Expand right panel">
										<PanelRightOpen className="size-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="left">Expand panel</TooltipContent>
							</Tooltip>
							<Separator />
							<Tooltip>
								<TooltipTrigger asChild>
									<button type="button" className="relative flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors" onClick={() => rightPanelRef.current?.expand()}>
										<Users className="size-4 text-muted-foreground" />
										{selectedEntry && (
											<span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
										)}
									</button>
								</TooltipTrigger>
								<TooltipContent side="left">Entry detail</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
				) : (
					<AnimatePresence mode="wait">
						{isPreGenerationWorkspace && preGenKbSource?.type === 'draftQueue' && !selectedEntry ? (
							<motion.div
								key={`queue-item-${preGenKbSource.item.assignmentKey}-${preGenKbSource.item.sessionNumber}`}
								initial={{ opacity: 0, x: 10 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 10 }}
								transition={{ duration: 0.15 }}
								className="flex flex-col min-h-0 h-full"
							>
								<div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
									<span className="text-xs font-semibold truncate">{preGenKbSource.item.subjectName}</span>
									<div className="flex items-center gap-1 shrink-0">
										<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => rightPanelRef.current?.collapse()} aria-label="Collapse panel">
											<PanelRightClose className="size-3.5" />
										</Button>
										<Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Clear selection"
											onClick={() => { setPreGenKbSource(null); setKbSelectedSource(null); }}
										>
											<X className="size-3.5" />
										</Button>
									</div>
								</div>
								<ScrollArea className="flex-1 min-h-0">
									<div className="px-3 py-2 space-y-2">
										<div className="flex items-center gap-1.5">
											<span className="text-xs font-medium">{preGenKbSource.item.sectionName}{preGenKbSource.item.cohortCode ? ` · ${preGenKbSource.item.cohortCode}` : ''}</span>
											{(() => { const g = preGenKbSource.item.gradeLevel; const bg = gradeBadge[g]; return bg ? <Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] shrink-0 ${bg}`}>G{g}</Badge> : null; })()}
										</div>
										<div className="flex items-center gap-2 rounded border border-border bg-muted/20 px-2 py-1">
											{preGenKbSource.item.hasNoTeacher ? (
												<>
													<UserX className="size-4 shrink-0 text-amber-500" />
													<p className="text-[0.6875rem] text-amber-700">No teacher assigned — place without faculty</p>
												</>
											) : preGenKbSource.item.facultyOptions[0] ? (
												<>
													<div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-[0.625rem] font-semibold text-primary shrink-0">
														{initials(facultyMap.get(preGenKbSource.item.facultyOptions[0])?.firstName ?? null, facultyMap.get(preGenKbSource.item.facultyOptions[0])?.lastName ?? null)}
													</div>
													<div className="min-w-0">
														<p className="truncate text-[0.6875rem] font-medium text-foreground">{formatFacultyInitials(preGenKbSource.item.facultyOptions[0])}</p>
														<p className="truncate text-[0.625rem] text-muted-foreground">{facultyMap.get(preGenKbSource.item.facultyOptions[0])?.department ?? 'No department'}</p>
													</div>
												</>
											) : (
												<p className="text-[0.6875rem] text-muted-foreground">No faculty selected</p>
											)}
										</div>
										<div className="flex items-center justify-between text-[0.6875rem]">
											<span className="text-muted-foreground">Session</span>
											<span className="font-medium tabular-nums">{preGenKbSource.item.sessionNumber} / {preGenKbSource.item.sessionsPerWeek} this week</span>
										</div>
										{preGenKbSource.item.preferredRoomType && (
											<div className="flex items-center justify-between text-[0.6875rem]">
												<span className="text-muted-foreground">Preferred room</span>
												<span className="font-medium">{preGenKbSource.item.preferredRoomType}</span>
											</div>
										)}
										<div className="rounded border border-primary/20 bg-primary/5 px-2.5 py-2 text-[0.625rem] text-primary flex items-start gap-2">
											<Crosshair className="size-3 shrink-0 mt-0.5" />
											<span>{isDesktop ? 'Click or drag onto a time slot in the grid to place this session.' : 'Tap a time slot in the grid to place this session.'}</span>
										</div>
									</div>
								</ScrollArea>
							</motion.div>
						) : selectedEntry ? (
							<motion.div
								key={selectedEntry.entryId}
								initial={{ opacity: 0, x: 10 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 10 }}
								transition={{ duration: 0.15 }}
								className="flex flex-col min-h-0 h-full"
							>
								<div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
									<span className="text-xs font-semibold truncate">{subjectLabel(selectedEntry.subjectId)}</span>
									<div className="flex items-center gap-1 shrink-0">
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant="ghost"
														size="sm"
														className="h-6 w-6 p-0"
														onClick={() => void toggleFollowUp(selectedEntry.entryId)}
														aria-label={followUps.has(selectedEntry.entryId) ? 'Remove follow-up flag' : 'Mark for follow-up'}
													>
														<Flag className={`size-3.5 ${followUps.has(selectedEntry.entryId) ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
													</Button>
												</TooltipTrigger>
												<TooltipContent side="left">{followUps.has(selectedEntry.entryId) ? 'Remove follow-up flag' : 'Mark for follow-up'}</TooltipContent>
											</Tooltip>
										</TooltipProvider>
										<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => rightPanelRef.current?.collapse()} aria-label="Collapse panel">
											<PanelRightClose className="size-3.5" />
										</Button>
										<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedEntry(null)} aria-label="Close">
											<X className="size-3.5" />
										</Button>
									</div>
								</div>

								<ScrollArea className="flex-1 min-h-0">
									<div className="px-3 py-2 space-y-2">
										{(() => {
											const grade = gradeForSection(selectedEntry.sectionId);
											const gradeStyle = grade ? gradeBadge[grade] : undefined;
											const entryViolations = violationIndex.get(selectedEntry.entryId) ?? [];
											const faculty = facultyMap.get(selectedEntry.facultyId);
											const matchingRequest = (roomRequestSummary?.requests ?? []).find((request: any) => request.entryId === selectedEntry.entryId) ?? null;
											const facultyPhotoUrl = faculty?.photoUrl ?? null;
											return (
												<>
													<div className="flex items-center gap-1.5">
														<span className="text-xs font-medium">{sectionLabel(selectedEntry.sectionId)}</span>
														{gradeStyle && <Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] shrink-0 ${gradeStyle}`}>G{grade}</Badge>}
													</div>
													<div className="flex items-center gap-2 rounded border border-border bg-muted/20 px-2 py-1">
														{facultyPhotoUrl ? (
															<img src={facultyPhotoUrl} alt={facultyLabel(selectedEntry.facultyId)} className="size-8 rounded-full object-cover" />
														) : (
															<div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-[0.625rem] font-semibold text-primary">
																{initials(faculty?.firstName ?? null, faculty?.lastName ?? null)}
															</div>
														)}
														<div className="min-w-0">
															<p className="truncate text-[0.6875rem] font-medium text-foreground">{facultyLabel(selectedEntry.facultyId)}</p>
															<p className="truncate text-[0.625rem] text-muted-foreground">
																{faculty?.department ?? 'No department'} · {faculty?.advisedSectionName ?? 'No advisory class'}
															</p>
														</div>
													</div>
													<p className="text-[0.6875rem] text-muted-foreground">{dayShort[selectedEntry.day]} {formatTime(selectedEntry.startTime)}–{formatTime(selectedEntry.endTime)}</p>
													<p className="text-[0.6875rem] text-muted-foreground truncate">{roomLabel(selectedEntry.roomId)}</p>
													<div className="space-y-1 rounded border border-border bg-muted/20 px-2 py-1.5">
														<p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">Room Request</p>
														{matchingRequest ? (
															<>
																<p className="text-[0.6875rem] text-foreground truncate">Requested: {matchingRequest.requestedRoomName}</p>
																<p className="text-[0.625rem] text-muted-foreground">
																	Status: {matchingRequest.decisionStatus} · Reason: {matchingRequest.rationale ?? '—'}
																</p>
																<p className="text-[0.625rem] text-muted-foreground truncate">
																	Reviewer notes: {matchingRequest.reviewerNotes ?? '—'}
																</p>
																{matchingRequest.appealCount > 0 ? (
																	<p className="text-[0.625rem] text-muted-foreground">
																		Appeals: {matchingRequest.appealCount} total ({matchingRequest.openAppealCount} open) · Latest {matchingRequest.latestAppealStatus ?? '—'}
																	</p>
																) : null}
															</>
														) : (
															<p className="text-[0.625rem] text-muted-foreground">No request linked to this session.</p>
														)}
													</div>
													{isPreGenerationWorkspace && previewResult?.softViolations.length ? (
														<div className="space-y-1 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
															<p className="text-[0.625rem] font-semibold uppercase tracking-wide text-amber-800">Latest Move Warnings</p>
															{previewResult.softViolations.slice(0, 3).map((warning: any, idx: number) => (
																<p key={`${warning.code}-${idx}`} className="text-[0.625rem] text-amber-900 leading-snug">
																	{formatConstraintMessage(warning.message)}
																</p>
															))}
															{previewResult.softViolations.length > 3 ? (
																<p className="text-[0.5625rem] text-amber-700">+{previewResult.softViolations.length - 3} more warning(s)</p>
															) : null}
														</div>
													) : null}
													{entryViolations.length > 0 && (
														<div className="space-y-1 pt-1">
															<div className="flex items-center gap-1.5">
																{entryViolations.some((v: any) => v.severity === 'HARD') && (
																	<Badge variant="outline" className="h-4 px-1.5 text-[0.5rem] border-red-300 bg-red-50 text-red-700">
																		{entryViolations.filter((v: any) => v.severity === 'HARD').length} hard
																	</Badge>
																)}
																{entryViolations.some((v: any) => v.severity === 'SOFT') && (
																	<Badge variant="outline" className="h-4 px-1.5 text-[0.5rem] border-amber-300 bg-amber-50 text-amber-700">
																		{entryViolations.filter((v: any) => v.severity === 'SOFT').length} soft
																	</Badge>
																)}
															</div>
															{entryViolations.map((v: any, i: number) => {
																const explanation = violationExplanations[v.code];
																return (
																	<TooltipProvider key={i}>
																		<Tooltip delayDuration={200}>
																			<TooltipTrigger asChild>
																				<div className={`rounded px-2 py-1 text-[0.625rem] leading-snug cursor-help ${v.severity === 'HARD' ? 'border border-red-200 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-800' : 'border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'}`}>
																					{violationLabels[v.code] ?? v.code}
																				</div>
																			</TooltipTrigger>
																			{explanation && (
																				<TooltipContent side="left" className="max-w-62.5 text-xs">
																					<p className="font-medium mb-1">{violationLabels[v.code]}</p>
																					<p className="text-muted-foreground">{explanation.why}</p>
																				</TooltipContent>
																			)}
																		</Tooltip>
																	</TooltipProvider>
																);
															})}
														</div>
													)}
												</>
											);
										})()}
									</div>
								</ScrollArea>

								<div className="shrink-0 border-t border-border px-3 py-2 space-y-1.5 bg-background" data-tutorial="manual-edit-actions">
									{isPreGenerationWorkspace && selectedEntry?.entryId.startsWith('draft-placement-') ? (
										<>
											<p className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">Draft Actions</p>
											<p className="text-[0.625rem] text-muted-foreground">Use draft actions while pre-generation is active. Generated-run manual edit APIs are not used in this mode.</p>
											<Button
												variant="outline"
												size="sm"
												className="w-full h-7 text-xs justify-start"
												onClick={() => {
													const placementId = parseDraftPlacementId(selectedEntry.entryId);
													const placement = placementId != null ? draftBoard?.placements.find((candidate: any) => candidate.id === placementId) : undefined;
													if (!placement) {
														toast.error('Draft placement details are stale. Refresh and try again.');
														return;
													}
													setPreGenKbSource({ type: 'draftPlacement', placement });
													setKbSelectedSource({ type: 'entry', entry: selectedEntry });
													setSelectedEntry(null);
													setSelectedViolation(null);
													toast.info('Select a destination slot in the timetable to move this pinned session.');
												}}
											>
												<Clock className="size-3 mr-1.5" />Move Pinned Session
											</Button>
											{(() => {
												const pid = parseDraftPlacementId(selectedEntry.entryId);
												if (pid == null) return null;
												return (
													<Button
														variant="outline"
														size="sm"
														className="w-full h-7 text-xs justify-start text-destructive border-destructive/40 hover:bg-destructive/5"
														disabled={deletingPlacementId === pid}
														onClick={() => { setPendingUnassignId(pid); setShowUnassignConfirm(true); }}
													>
														{deletingPlacementId === pid
															? <><Loader2 className="size-3 mr-1.5 animate-spin" />Removing...</>
															: <><Trash2 className="size-3 mr-1.5" />Unassign (Return to Queue)</>
														}
													</Button>
												);
											})()}
										</>
									) : (
										<>
											<p className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">Manual Edits</p>
											<Button variant="outline" size="sm" className="w-full h-7 text-xs justify-start" onClick={() => {
												setKbSelectedSource({ type: 'entry', entry: selectedEntry! });
												setSelectedEntry(null);
												setSelectedViolation(null);
												toast.info('Click a target cell in the grid to move this session. Click an occupied cell to swap.');
											}} aria-label="Move timeslot">
												<Clock className="size-3 mr-1.5" />Move Timeslot
											</Button>
											<Button variant="outline" size="sm" className="w-full h-7 text-xs justify-start" onClick={() => enterManualEditView('CHANGE_ROOM')} aria-label="Change room">
												<DoorOpen className="size-3 mr-1.5" />Change Room
											</Button>
											<Button variant="outline" size="sm" className="w-full h-7 text-xs justify-start" onClick={() => enterManualEditView('CHANGE_FACULTY')} aria-label="Reassign faculty">
												<Users className="size-3 mr-1.5" />Reassign Faculty
											</Button>
										</>
									)}
								</div>
							</motion.div>
						) : (
							<motion.div
								key="empty"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								className="flex-1 flex flex-col"
							>
								<div className="shrink-0 flex items-center justify-end px-3 py-2 border-b border-border">
									<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => rightPanelRef.current?.collapse()} aria-label="Collapse panel">
										<PanelRightClose className="size-3.5" />
									</Button>
								</div>
								<div className="flex-1 flex items-center justify-center">
									<div className="text-center space-y-2 px-4">
										<Users className="mx-auto size-8 text-muted-foreground/30" />
										<p className="text-xs text-muted-foreground">Click an entry in the grid to view details and actions</p>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				)}
			</ResizablePanel>
		</>
	);
}
