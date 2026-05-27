import { AnimatePresence, motion } from 'motion/react';
import {
AlertTriangle,
Check,
ChevronDown,
ChevronRight,
ClipboardList,
Flag,
GripVertical,
Info,
Lightbulb,
Loader2,
Lock,
RefreshCw,
Search,
ShieldAlert,
UserX,
Wand2,
X,
Zap,
} from 'lucide-react';
import atlasApi from '@/lib/api';
import { getDefaultUnassignedReasonDetail, getProgramBadgeLabel, matchesProgramFilter } from '@/lib/schedule-review-helpers';
import { cn } from '@/lib/utils';
import type { FixSuggestionsResponse } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { ViolationGroup } from '@/components/timetable/TimetableShared';
import { DraggablePlacementPin, DraggableQueuePin, DraggableUnassignedPin, PinnedRailDropZone, UnassignDropZone } from '@/components/timetable/DraggablePinWrappers';
import type { LeftRailContentContext } from '@/components/timetable/timetableContexts.types';

type LeftRailContentProps = {
context: LeftRailContentContext;
};

export function LeftRailContent({ context }: LeftRailContentProps) {
const {
leftTab,
isPreGenerationWorkspace,
hardViolationCount,
topBlockers,
violations,
handleViolationSelect,
setSeverityFilter,
VIOLATION_LABELS,
violationSearch,
setViolationSearch,
filteredViolations,
violationsByCode,
selectedViolation,
setDrawerViolation,
formatConstraintMessage,
draftBoard,
isDesktop,
setDragItem,
toast,
summary,
filteredUnassignedItems,
programKindFilteredUnassignedItems,
UNASSIGNED_REASON_LABELS,
unassignedReasonFilter,
setUnassignedReasonFilter,
resolveEntryProgramType,
resolveEntryProgramCode,
sectionLabel,
subjectLabel,
kbSelectedSource,
buildUnassignedKey,
followUps,
expandedUnassigned,
setExpandedUnassigned,
unassignedFixSuggestions,
fixLoading,
schoolYearId,
runs,
selectedRunId,
defaultSchoolId,
setFixLoading,
setUnassignedFixSuggestions,
entryContextLabel,
previewEdit,
setDrawerUnassigned,
setFollowUps,
showSoftConfirm,
unassignDropActive,
setUnassignDropActive,
pinnedRailDropActive,
fetchDraftBoardSummary,
preGenPending,
pinsSearch,
setPinsSearch,
pinsGradeFilter,
setPinsGradeFilter,
pinsSectionFilter,
setPinsSectionFilter,
pinsSubjectFilter,
setPinsSubjectFilter,
getDraggedDraftPlacementId,
dragItem,
setPendingUnassignId,
setShowUnassignConfirm,
pinsQueuePage,
setPinsQueuePage,
preGenKbSource,
setPreGenKbSource,
setKbSelectedSource,
rightPanelRef,
selectedEntry,
setSelectedEntry,
setSelectedViolation,
preGenEntries,
gradeForSection,
formatTime,
DAY_SHORT,
formatFacultyInitials,
roomLabelShort,
GRADE_BADGE,
GRADE_CARD_BG,
roomRequestSummary,
requestSearch,
setRequestSearch,
requestStatusFilter,
setRequestStatusFilter,
requestDecisionFilter,
setRequestDecisionFilter,
roomRequestError,
roomRequestLoading,
filteredRoomRequests,
selectedRequestId,
focusRequestInGrid,
openRequestPreview,
isPrivilegedUser,
focusPinnedPlacement,
} = context;
	const renderUnassignedReasonBadge = (reason: string) => {
		const info = UNASSIGNED_REASON_LABELS[reason] ?? {
			label: reason,
			className: 'border-gray-300 bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700',
		};
		return (
			<Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] ${info.className}`}>
				{info.label}
			</Badge>
		);
	};
	const filteredPreGenQueue = (draftBoard?.queue ?? []).filter((item) => {
		const matchesGrade = pinsGradeFilter === 'all' || item.gradeLevel === pinsGradeFilter;
		const matchesSubject = pinsSubjectFilter === 'all' || item.subjectId === pinsSubjectFilter;
		const matchesSection = pinsSectionFilter === 'all' || item.sectionId === pinsSectionFilter;
		const q = pinsSearch.toLowerCase();
		const matchesSearch = !q
			|| item.subjectCode.toLowerCase().includes(q)
			|| item.subjectName.toLowerCase().includes(q)
			|| item.sectionName.toLowerCase().includes(q)
			|| (item.cohortCode?.toLowerCase().includes(q) ?? false);
		return matchesGrade && matchesSubject && matchesSection && matchesSearch;
	});
	const filteredPinnedPlacements = (draftBoard?.placements ?? []).filter((placement) => {
		if (placement.status !== 'DRAFT') return false;
		const grade = gradeForSection(placement.sectionId);
		const matchesGrade = pinsGradeFilter === 'all' || grade === pinsGradeFilter;
		const matchesSubject = pinsSubjectFilter === 'all' || placement.subjectId === pinsSubjectFilter;
		const matchesSection = pinsSectionFilter === 'all' || placement.sectionId === pinsSectionFilter;
		const q = pinsSearch.toLowerCase();
		const matchesSearch = !q
			|| subjectLabel(placement.subjectId).toLowerCase().includes(q)
			|| sectionLabel(placement.sectionId).toLowerCase().includes(q)
			|| (placement.cohortCode?.toLowerCase().includes(q) ?? false)
			|| `${DAY_SHORT[placement.day] ?? placement.day} ${formatTime(placement.startTime)} ${formatTime(placement.endTime)}`.toLowerCase().includes(q);
		return matchesGrade && matchesSubject && matchesSection && matchesSearch;
	});
	const pinSubjectOptions = Array.from(new Map([
		...(draftBoard?.queue ?? []).map((item): [number, string] => [item.subjectId, item.subjectCode]),
		...(draftBoard?.placements ?? []).filter((placement) => placement.status === 'DRAFT').map((placement): [number, string] => [placement.subjectId, subjectLabel(placement.subjectId)]),
	]).entries());
	const pinSectionOptions = Array.from(new Map([
		...(draftBoard?.queue ?? []).filter((item) => pinsGradeFilter === 'all' || item.gradeLevel === pinsGradeFilter).map((item): [number, string] => [item.sectionId, item.sectionName]),
		...(draftBoard?.placements ?? []).filter((placement) => {
			if (placement.status !== 'DRAFT') return false;
			const grade = gradeForSection(placement.sectionId);
			return pinsGradeFilter === 'all' || grade === pinsGradeFilter;
		}).map((placement): [number, string] => [placement.sectionId, sectionLabel(placement.sectionId)]),
	]).entries());
return (
<>{leftTab === 'violations' && !isPreGenerationWorkspace ? (
						<div id="panel-violations" role="tabpanel" aria-labelledby="tab-violations" className="flex flex-col flex-1 min-h-0">
							{/* Top blockers quick list */}
							{hardViolationCount > 0 && (
								<div className="shrink-0 px-3 py-2 border-b border-red-100 bg-red-50/50">
									<div className="flex items-center gap-1.5 text-[0.625rem] font-semibold text-red-700 mb-1">
										<ShieldAlert className="size-3" />
										Top blockers ({hardViolationCount} hard)
									</div>
									<div className="space-y-0.5">
										{topBlockers.map((v, i) => {
											const count = violations.filter((vv) => vv.code === v.code && vv.severity === 'HARD').length;
											return (
												<button
													key={i}
													type="button"
													onClick={() => {
														handleViolationSelect(v);
														setSeverityFilter('hard');
													}}
													className="flex items-center gap-1.5 w-full text-left text-[0.5625rem] text-red-800 hover:text-red-600 hover:bg-red-100/60 rounded px-1 py-0.5 transition-colors"
												>
													<ChevronRight className="size-2.5 shrink-0" />
													<span className="truncate flex-1">{VIOLATION_LABELS[v.code]}</span>
													<span className="shrink-0 text-red-500 font-medium">×{count}</span>
												</button>
											);
										})}
									</div>
								</div>
							)}
							{hardViolationCount === 0 && violations.length === 0 && (
								<div className="shrink-0 px-3 py-2 border-b border-emerald-100 bg-emerald-50/50">
									<div className="flex items-center gap-1.5 text-[0.625rem] font-medium text-emerald-700">
										<Check className="size-3" />
												No violations — schedule is clean
									</div>
								</div>
							)}
							<div className="shrink-0 px-3 py-2">
								<div className="relative">
									<Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
									<Input
										placeholder="Search violations…"
										value={violationSearch}
										onChange={(e) => setViolationSearch(e.target.value)}
										className="h-7 pl-7 text-xs"
									/>
									{violationSearch && (
										<button
											type="button"
											aria-label="Clear search"
											onClick={() => setViolationSearch('')}
											className="absolute right-2 top-1/2 -translate-y-1/2"
										>
											<X className="size-3 text-muted-foreground" />
										</button>
									)}
								</div>
							</div>
							<ScrollArea className="flex-1 min-h-0">
								<div className="px-3 pb-3 space-y-1">
									{/* Wave 4.5b item 12: info banner in pre-gen mode */}
									{isPreGenerationWorkspace && (
										<div className="mb-2 flex items-start gap-2 rounded border border-primary/20 bg-primary/5 px-2.5 py-2 text-[0.625rem] text-primary">
											<Info className="size-3 shrink-0 mt-0.5" />
											<span>Constraint data shown is from the last generated run. Pre-gen placements are validated individually when saved.</span>
										</div>
									)}
									{filteredViolations.length === 0 ? (
										<div className="py-6 text-center text-xs text-muted-foreground">
											{violations.length === 0 ? 'No violations found' : 'No matching violations'}
										</div>
									) : (
										Array.from(violationsByCode.entries()).map(([code, vList]) => (
											<ViolationGroup
												key={code}
												code={code}
												violations={vList}
												selectedViolation={selectedViolation}
												onSelect={handleViolationSelect}
												onExplain={setDrawerViolation}
												formatConstraintMessage={formatConstraintMessage}
												labels={VIOLATION_LABELS}
											/>
										))
									)}
								</div>
							</ScrollArea>
						</div>
					) : leftTab === 'unassigned' && !isPreGenerationWorkspace ? (
						<ScrollArea id="panel-unassigned" role="tabpanel" aria-labelledby="tab-unassigned" className="flex-1 min-h-0">
							<div className="px-3 py-3 space-y-3">
								{/* Wave 4.5 E: Pre-gen mode shows draftBoard.queue as the demand source */}
								{isPreGenerationWorkspace && draftBoard ? (
									<>
										<div className="flex items-center gap-2 rounded border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[0.625rem] text-primary font-medium">
											<ClipboardList className="size-3 shrink-0" />
											Pre-gen demand (unscheduled sessions)
										</div>
										{!isDesktop && (
											<p className="text-[0.625rem] text-muted-foreground px-0.5">
												Tap a session to open the placement sheet. Drag-and-drop requires a wider screen.
											</p>
										)}
										{draftBoard.queue.length === 0 ? (
											<p className="text-xs text-muted-foreground text-center py-6">All sessions have been anchored.</p>
										) : (
											<div className="space-y-1.5">
												{draftBoard.queue.map((item) => {
													const grade = item.gradeLevel;
													const gradeBadge = grade ? GRADE_BADGE[grade] : undefined;
													return (
														<DraggableQueuePin
															key={item.assignmentKey}
															item={item}
															disabled={!isDesktop}
															className="flex flex-col gap-1 rounded border border-border bg-card px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing hover:border-primary/40 hover:bg-primary/5 transition-colors"
															onClick={() => {
																setDragItem({ type: 'draftQueue', item });
																toast.info('Session selected — now tap an empty slot on the timetable to place it.');
															}}
														>
															<div className="flex items-center gap-1.5 min-w-0">
																<GripVertical className="size-3 text-muted-foreground/50 shrink-0" />
																{gradeBadge && (
																	<Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] shrink-0 ${gradeBadge}`}>
																		G{grade}
																	</Badge>
																)}
																{item.cohortCode && (
																	<Badge variant="outline" className="h-4 px-1 text-[0.5625rem] shrink-0 border-sky-300 bg-sky-50 text-sky-700">
																		{item.cohortCode}
																	</Badge>
																)}
																{item.hasNoTeacher && (
																	<UserX className="size-3 text-amber-500 shrink-0" aria-label="No faculty assigned in teaching load" />
																)}
																<span className="font-medium truncate min-w-0">{item.subjectCode}</span>
															</div>
															<div className="flex items-center gap-1.5 text-[0.5625rem] text-muted-foreground pl-4.5">
																<span className="truncate">{item.sectionName}</span>
																<span>·</span>
																<span>Session {item.sessionNumber}/{item.sessionsPerWeek}</span>
															</div>
														</DraggableQueuePin>
													);
												})}
											</div>
										)}
									</>
								) : summary ? (
									<>
										{/* Dense Inline Stat Block */}
										<div className="flex flex-wrap items-center justify-between gap-1.5 rounded border border-border bg-muted/20 px-3 py-1.5 text-xs">
											<div className="flex items-center gap-1.5">
												<span className="text-muted-foreground font-medium">Processed</span>
												<span className="font-bold">{summary.classesProcessed}</span>
											</div>
											<div className="flex items-center gap-1.5">
												<span className="text-muted-foreground font-medium">Assigned</span>
												<span className="font-bold text-emerald-600">{summary.assignedCount}</span>
											</div>
											<div className="flex items-center gap-1.5">
												<span className="text-muted-foreground font-medium">Unassigned</span>
												<span className={`font-bold ${summary.unassignedCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{summary.unassignedCount}</span>
											</div>
											{typeof summary.homeRoomSuccessRate === 'number' && (
												<div className="flex items-center gap-1.5">
													<span className="text-muted-foreground font-medium">Home-Room</span>
													<span className="font-bold text-sky-700">{summary.homeRoomSuccessRate}%</span>
												</div>
											)}
										</div>
										{summary.resourceDiagnostics && (
											<div className="rounded border border-border/70 bg-background/70 px-2.5 py-2 space-y-2 text-[0.625rem]">
												<div className="font-semibold text-muted-foreground uppercase tracking-wide">Resource Diagnostics</div>
												<div className="space-y-1">
													<div className="font-medium">Lowest teaching-load coverage</div>
													{summary.resourceDiagnostics.qualifiedFacultyCoverageBySubject.slice(0, 3).map((row) => (
														<div key={`coverage-${row.subjectId}`} className="flex items-center justify-between text-muted-foreground">
															<span>{row.subjectCode}</span>
															<span className="font-semibold text-amber-700">{row.coveragePercent}%</span>
														</div>
													))}
												</div>
												<div className="space-y-1">
													<div className="font-medium">Most saturated intervals</div>
													{summary.resourceDiagnostics.slotSaturationByInterval.slice(0, 3).map((row, idx) => (
														<div key={`sat-${idx}-${row.day}-${row.startTime}-${row.endTime}`} className="flex items-center justify-between text-muted-foreground">
															<span>{row.day.slice(0, 3)} {row.startTime}-{row.endTime}</span>
															<span className="font-semibold text-rose-700">{row.saturationPercent}%</span>
														</div>
													))}
												</div>
												<div className="space-y-1">
													<div className="font-medium">Top unassigned clusters</div>
													{summary.resourceDiagnostics.unassignedBySubjectGrade.slice(0, 3).map((row) => (
														<div key={`unassigned-${row.subjectId}-${row.gradeLevel}`} className="flex items-center justify-between text-muted-foreground">
															<span>{row.subjectCode} • G{row.gradeLevel}</span>
															<span className="font-semibold text-amber-700">{row.count}</span>
														</div>
													))}
												</div>
												{summary.resourceDiagnostics.roomAssignmentReasonCounts && (
													<div className="space-y-1">
														<div className="font-medium">Room assignment reasons</div>
														{Object.entries(summary.resourceDiagnostics.roomAssignmentReasonCounts).slice(0, 3).map(([reason, count]) => (
															<div key={`reason-${reason}`} className="flex items-center justify-between text-muted-foreground">
																<span>{reason}</span>
																<span className="font-semibold text-sky-700">{count}</span>
															</div>
														))}
													</div>
												)}
												{summary.resourceDiagnostics.zoneDistributionByTerm?.[0] && (
													<div className="space-y-1">
														<div className="font-medium">Zone distribution (Term {summary.resourceDiagnostics.zoneDistributionByTerm[0].termIndex})</div>
														{Object.entries(summary.resourceDiagnostics.zoneDistributionByTerm[0].byZone).slice(0, 3).map(([zone, data]) => (
															<div key={`zone-${zone}`} className="flex items-center justify-between text-muted-foreground">
																<span>{zone}</span>
																<span className="font-semibold text-rose-700">{data.percent}%</span>
															</div>
														))}
													</div>
												)}
											</div>
										)}
										{/* Unassigned items list */}
										{filteredUnassignedItems.length > 0 && (
											<div className="space-y-2">
												{/* Reason filter chips */}
												<div className="flex flex-wrap gap-1">
													{(['all', 'NO_QUALIFIED_FACULTY', 'FACULTY_OVERLOADED', 'NO_AVAILABLE_SLOT', 'NO_COMPATIBLE_ROOM'] as const).map((r) => {
														const label = r === 'all' ? 'All' : (UNASSIGNED_REASON_LABELS[r]?.label ?? r);
														const count = r === 'all'
															? programKindFilteredUnassignedItems.length
															: programKindFilteredUnassignedItems.filter((it) => it.reason === r).length;
														if (r !== 'all' && count === 0) return null;
														return (
															<button
																key={r}
																onClick={() => setUnassignedReasonFilter(r)}
																className={`rounded-full px-2 py-0.5 text-[0.5625rem] font-medium transition-colors ${
																	unassignedReasonFilter === r
																		? 'bg-primary text-primary-foreground'
																		: 'bg-muted text-muted-foreground hover:bg-muted/80'
																}`}
															>
																{label} ({count})
															</button>
														);
													})}
												</div>
												<span className="text-[0.6875rem] font-medium text-muted-foreground">
														Use recovery tools only when a session stays blocked after generation
													</span>
												{filteredUnassignedItems.map((item, i) => {
													const grade = item.gradeLevel;
													const gradeBadge = grade ? GRADE_BADGE[grade] : undefined;
													const isKbSelected = kbSelectedSource?.type === 'unassigned'
														&& kbSelectedSource.item.sectionId === item.sectionId
														&& kbSelectedSource.item.subjectId === item.subjectId
																										&& kbSelectedSource.item.session === item.session
																										&& (kbSelectedSource.item.cohortCode ?? '') === (item.cohortCode ?? '');
													const itemKey = buildUnassignedKey(item);
													const isFollowUp = followUps.has(itemKey);
													const isExpanded = expandedUnassigned.has(itemKey);
													const cachedFix = unassignedFixSuggestions[itemKey];
													return (
														<DraggableUnassignedPin
															key={`${itemKey}-${i}`}
															itemKey={itemKey}
															item={item}
															disabled={false}
															className={`rounded border text-xs transition-colors ${
																isKbSelected
																	? 'border-primary bg-primary/10 ring-2 ring-primary'
																	: isFollowUp
																		? 'border-amber-300 bg-amber-50/80'
																		: 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
															}`}
														>
															<button
																type="button"
																className="w-full max-w-full overflow-hidden text-left px-2 py-1.5 space-y-1 cursor-grab active:cursor-grabbing"
																onClick={() => {
																	setExpandedUnassigned((prev) => {
																		const next = new Set(prev);
																		if (next.has(itemKey)) next.delete(itemKey);
																		else next.add(itemKey);
																		return next;
																	});
																	setKbSelectedSource(isKbSelected ? null : { type: 'unassigned', item });
																}}
															>
																<div className="flex items-center gap-1.5 min-w-0">
																	<ChevronDown className={`size-3 text-muted-foreground shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
																	<GripVertical className="size-3 text-muted-foreground/50 shrink-0" />
																	{gradeBadge && (
																		<Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] shrink-0 ${gradeBadge}`}>
																			G{grade}
																		</Badge>
																	)}
																	{item.entryKind === 'COHORT' && item.cohortCode && (
																		<Badge variant="outline" className="h-4 px-1 text-[0.5625rem] shrink-0 border-sky-300 bg-sky-50 text-sky-700">
																			{item.cohortCode}
																		</Badge>
																	)}
																	<span className="font-medium truncate min-w-0">{sectionLabel(item.sectionId)}</span>
																	<span className="text-muted-foreground shrink-0">·</span>
																	<span className="truncate min-w-0">{subjectLabel(item.subjectId)}</span>
																</div>
																<div className="flex items-center gap-1.5 text-[0.625rem] text-muted-foreground pl-4.5">
																	{renderUnassignedReasonBadge(item.reason)}
																	{matchesProgramFilter(resolveEntryProgramType(item), 'SPECIAL') && (
																		<Badge variant="outline" className="h-4 px-1 text-[0.5625rem] border-violet-300 bg-violet-50 text-violet-700">
																			{getProgramBadgeLabel(resolveEntryProgramType(item), resolveEntryProgramCode(item))}
																		</Badge>
																	)}
																	<span className="opacity-60 font-medium">Session {item.session}</span>
																	<span className="ml-auto text-red-600/80 font-semibold tracking-wide uppercase text-[0.5rem] flex items-center gap-0.5">
																		<AlertTriangle className="size-2.5" /> Blocker
																	</span>
																</div>
															</button>
															{/* Expanded detail panel */}
															<AnimatePresence>
																{isExpanded && (
																	<motion.div
																		initial={{ height: 0, opacity: 0 }}
																		animate={{ height: 'auto', opacity: 1 }}
																		exit={{ height: 0, opacity: 0 }}
																		transition={{ duration: 0.15 }}
																		className="overflow-hidden"
																	>
																		<div className="px-2 pb-2 pt-1 border-t border-amber-200 space-y-2">
																			{/* Reason explanation */}
																			<div className="rounded border border-red-200 bg-red-50/50 p-2 space-y-1">
																				<div className="flex items-center gap-1.5 text-[0.625rem] text-red-800 font-medium">
																					<AlertTriangle className="size-3" />
																					Why blocked
																				</div>
																				<p className="font-medium text-[0.6875rem] text-red-900 wrap-break-word whitespace-normal leading-snug">
																					{unassignedFixSuggestions[itemKey]
																						? unassignedFixSuggestions[itemKey]!.humanDetail
																						: getDefaultUnassignedReasonDetail(item)
																					}
																				</p>
																			</div>
																			{/* Impact */}
																			<div className="flex items-center gap-1.5 text-[0.625rem]">
																				<ShieldAlert className="size-2.5 text-red-600 shrink-0" />
																				<span className="text-red-700 font-medium">Recovery required</span>
																				<span className="text-muted-foreground">— this session still needs an operator review before publishing</span>
																			</div>
																			{(item.entryKind === 'COHORT' || item.adviserName) && (
																				<div className="rounded border border-border bg-background px-2 py-1.5 text-[0.625rem] text-muted-foreground">
																					{entryContextLabel(item)}
																				</div>
																			)}
																			{/* Fix suggestions (inline) */}
																			{cachedFix === undefined ? (
																				<Button
																					variant="outline"
																					size="sm"
																					className="w-full h-6 text-[0.5625rem] gap-1"
																					disabled={fixLoading === itemKey}
																					onClick={async (e) => {
																						e.stopPropagation();
																						// Resolve run ID - if 'latest', use first run id
																						const resolvedRunId = selectedRunId === 'latest' ? runs[0]?.id : selectedRunId;
																						if (!resolvedRunId) {
																							toast.error('No generation run selected');
																							return;
																						}
																						setFixLoading(itemKey);
																						try {
																							const { data } = await atlasApi.post<FixSuggestionsResponse>(
																								`/generation/${defaultSchoolId}/${schoolYearId}/runs/${resolvedRunId}/fix-suggestions`,
																								{
																									sectionId: item.sectionId,
																									subjectId: item.subjectId,
																									gradeLevel: item.gradeLevel,
																									session: item.session,
																									reason: item.reason,
																									entryKind: item.entryKind,
																									programType: item.programType,
																									programCode: item.programCode,
																									programName: item.programName,
																									cohortCode: item.cohortCode,
																									cohortName: item.cohortName,
																									cohortMemberSectionIds: item.cohortMemberSectionIds,
																									cohortExpectedEnrollment: item.cohortExpectedEnrollment,
																									adviserId: item.adviserId,
																									adviserName: item.adviserName,
																								},
																							);
																							setUnassignedFixSuggestions((prev) => ({
																								...prev,
																								[itemKey]: data.explanation,
																							}));
																						} catch (err: unknown) {
																							// Handle auth/permission errors with user-friendly messages
																							const error = err as { response?: { status?: number; data?: { code?: string } } };
																							const status = error.response?.status;
																							const code = error.response?.data?.code;
																							if (status === 401) {
																								const msg = code === 'TOKEN_EXPIRED' 
																									? 'Session expired. Re-open ATLAS from EnrollPro.'
																									: 'Session missing or invalid. Re-open ATLAS from EnrollPro.';
																								toast.error(msg);
																							} else if (status === 403) {
																								toast.error('You do not have permission to request fix suggestions.');
																							} else if (status === 400) {
																								toast.error('Fix suggestion request is invalid. Please refresh run data and try again.');
																							} else {
																								toast.error('Could not fetch fix suggestions');
																							}
																							setUnassignedFixSuggestions((prev) => ({
																								...prev,
																								[itemKey]: null,
																							}));
																						} finally {
																							setFixLoading(null);
																						}
																					}}
																				>
																					{fixLoading === itemKey ? (
																						<Loader2 className="size-2.5 animate-spin" />
																					) : (
																						<Wand2 className="size-2.5" />
																					)}
																					Load fix suggestions
																				</Button>
																			) : cachedFix === null ? (
																				<div className="text-[0.625rem] text-muted-foreground italic px-1">
																					Could not load suggestions. Try again later.
																				</div>
																			) : (
																				<div className="space-y-1.5">
																					<div className="text-[0.625rem] font-semibold text-foreground flex items-center gap-1">
																						<Wand2 className="size-2.5 text-primary" />
																						Recommended fixes ({cachedFix.suggestions.length})
																					</div>
																					{cachedFix.suggestions.length === 0 ? (
																						<div className="text-[0.625rem] text-muted-foreground italic">
																							No automatic fix available. Manual intervention needed.
																						</div>
																					) : (
																						cachedFix.suggestions.map((sug, si) => (
																							<div key={si} className="rounded border border-border bg-background px-2 py-1.5 space-y-1">
																								<div className="flex items-center gap-1">
																									<span className="text-[0.625rem] font-medium text-foreground">{si + 1}. {sug.label}</span>
																								</div>
																								<p className="text-[0.5625rem] text-muted-foreground leading-relaxed">{sug.description}</p>
																								{sug.proposal && (
																									<Button
																										variant="outline"
																										size="sm"
																										className="h-5 text-[0.5rem] gap-0.5 mt-0.5"
																										onClick={(e) => {
																											e.stopPropagation();
																											if (sug.proposal) {
																												previewEdit(sug.proposal);
																											}
																										}}
																									>
																										<Zap className="size-2" />
																										Preview & Apply
																									</Button>
																								)}
																								{sug.policyHint && (
																									<p className="text-[0.5rem] text-muted-foreground/70 italic">
																										Policy: {sug.policyHint}
																									</p>
																								)}
																							</div>
																						))
																					)}
																				</div>
																			)}
																			{/* Quick action row */}
																			<div className="flex items-center gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
																				<Button
																					variant="ghost"
																					size="sm"
																					className="h-5 px-1.5 text-[0.5625rem] gap-0.5"
																					onClick={() => setDrawerUnassigned(item)}
																				>
																					<Lightbulb className="size-2.5" />
																					Full explanation
																				</Button>
																				<Button
																					variant="ghost"
																					size="sm"
																					className={`h-5 px-1.5 text-[0.5625rem] gap-0.5 ${isFollowUp ? 'text-amber-600' : ''}`}
																					onClick={() => {
																						setFollowUps((prev) => {
																							const next = new Set(prev);
																							if (next.has(itemKey)) next.delete(itemKey);
																							else next.add(itemKey);
																							return next;
																						});
																						toast.info(isFollowUp ? 'Follow-up removed' : 'Marked for follow-up');
																					}}
																				>
																					<Flag className={`size-2.5 ${isFollowUp ? 'fill-amber-500' : ''}`} />
																					{isFollowUp ? 'Unflag' : 'Flag'}
																				</Button>
																			</div>
																		</div>
																	</motion.div>
																)}
															</AnimatePresence>
														</DraggableUnassignedPin>
													);
												})}
											</div>
										)}
										{summary.unassignedCount === 0 && (
											<div className="py-4 text-center text-xs text-muted-foreground">
												<Check className="mx-auto size-6 text-emerald-500 mb-1" />
												All classes assigned successfully
											</div>
										)}
										{summary.unassignedCount > 0 && filteredUnassignedItems.length === 0 && (
											<div className="py-4 text-center text-xs text-muted-foreground">
												No unassigned items match the current program, entry type, and reason filters.
											</div>
										)}
									</>
								) : (
									<div className="py-6 text-center text-xs text-muted-foreground">
										No draft data available
									</div>
								)}
							</div>
						</ScrollArea>
					) : isPreGenerationWorkspace && (leftTab === 'unassigned' || leftTab === 'pinned') ? (
						<div id={leftTab === 'pinned' ? 'panel-pinned' : 'panel-unassigned'} role="tabpanel" aria-labelledby={leftTab === 'pinned' ? 'tab-pinned' : 'tab-unassigned'} className="flex flex-col flex-1 min-h-0">
							<div className="shrink-0 border-b border-border px-3 py-2">
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-1.5">
										<Lock className="size-3.5 text-primary" />
										<span className="text-xs font-semibold">Pre-Generation Draft</span>
									</div>
									<Button
										variant="outline"
										size="sm"
										className="h-7 text-[0.625rem]"
										onClick={() => { if (schoolYearId) void fetchDraftBoardSummary(schoolYearId); }}
									>
										<RefreshCw className="mr-1 size-3" />
										Refresh
									</Button>
								</div>
								<div className="mt-2 flex flex-wrap items-center gap-1.5">
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Badge variant="secondary" className="h-5 px-2 text-[0.625rem] cursor-default">{draftBoard?.counts.unscheduled ?? 0} unassigned</Badge>
											</TooltipTrigger>
											<TooltipContent className="max-w-48 text-xs">Sessions not yet placed in the pre-generation draft grid.</TooltipContent>
										</Tooltip>
									</TooltipProvider>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Badge variant="secondary" className="h-5 px-2 text-[0.625rem] cursor-default">{draftBoard?.counts.draft ?? 0} pinned</Badge>
											</TooltipTrigger>
											<TooltipContent className="max-w-48 text-xs">Sessions placed in the draft grid. These become anchors when schedule generation runs.</TooltipContent>
										</Tooltip>
									</TooltipProvider>
									{preGenPending ? <Badge className="h-5 px-2 text-[0.625rem]">Pending preview</Badge> : null}
								</div>
								{/* Wave 4.5 H: search + grade filter for pins panel */}
								<div className="mt-2 flex items-center gap-1.5">
									<div className="relative flex-1 min-w-0">
										<Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
										<Input
												placeholder="Filter…"
											value={pinsSearch}
											onChange={(e) => setPinsSearch(e.target.value)}
											className="h-7 pl-6 text-[0.625rem]"
										/>
									</div>
									<Select
										value={String(pinsGradeFilter)}
										onValueChange={(v) => { setPinsGradeFilter(v === 'all' ? 'all' : Number(v)); setPinsSectionFilter('all'); }}
									>
										<SelectTrigger className="h-7 w-16 text-[0.625rem]">
											<SelectValue placeholder="Grade" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All</SelectItem>
											<SelectItem value="7">G7</SelectItem>
											<SelectItem value="8">G8</SelectItem>
											<SelectItem value="9">G9</SelectItem>
											<SelectItem value="10">G10</SelectItem>
										</SelectContent>
									</Select>
								</div>
								{/* Wave 4.5b item 6: subject and section filters */}
								<div className="mt-1.5 flex items-center gap-1.5">
									<Select value={String(pinsSubjectFilter)} onValueChange={(v) => setPinsSubjectFilter(v === 'all' ? 'all' : Number(v))}>
										<SelectTrigger className="h-7 flex-1 min-w-0 text-[0.625rem]"><SelectValue placeholder="Subject" /></SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All subjects</SelectItem>
											{pinSubjectOptions.map(([id, code]) => (
												<SelectItem key={id} value={String(id)}>{code}</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select value={String(pinsSectionFilter)} onValueChange={(v) => setPinsSectionFilter(v === 'all' ? 'all' : Number(v))}>
										<SelectTrigger className="h-7 flex-1 min-w-0 text-[0.625rem]"><SelectValue placeholder="Section" /></SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All sections</SelectItem>
											{pinSectionOptions.map(([id, name]) => (
												<SelectItem key={id} value={String(id)}>{name}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							{/* Wave 4.5 I: DnD requires desktop */}
							{!isDesktop && (
								<p className="text-[0.625rem] text-muted-foreground px-3 py-1 border-b border-border bg-muted/30">
									Scheduling drag-and-drop requires a wider screen. Tap to select, then tap a grid slot.
								</p>
							)}
							<ScrollArea className="flex-1 min-h-0">
								<div className="space-y-3 p-3">
									{leftTab === 'unassigned' ? (
										<>
											<div className="space-y-1">
												<p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">Unassigned Sessions</p>
												<p className="text-[0.6875rem] text-muted-foreground">Drag from here into the grid to pin a draft session.</p>
											</div>
											<div className="grid gap-1.5" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))'}}>
											{filteredPreGenQueue
												.slice(0, pinsQueuePage)
												.map((item) => {
											const key = `${item.assignmentKey}-${item.sessionNumber}`;
											const selected = preGenKbSource?.type === 'draftQueue' && preGenKbSource.item.assignmentKey === item.assignmentKey && preGenKbSource.item.sessionNumber === item.sessionNumber;
											return (
												<DraggableQueuePin
													key={key}
													item={item}
													disabled={!isDesktop}
													className={cn(
														'rounded border px-2 py-1.5 text-xs transition-colors',
														GRADE_CARD_BG[item.gradeLevel] ?? 'bg-background border-border',
														selected ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50',
														isDesktop ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
													)}
												>
													<div
														className="min-w-0 flex-1"
														role="button"
														tabIndex={0}
														onClick={() => {
															const source = { type: 'draftQueue' as const, item };
															const nextSelected = !selected;
															setPreGenKbSource(nextSelected ? source : null);
															setKbSelectedSource(nextSelected ? source : null);
															// Selecting a queue item drives the right panel (D spec); deselecting clears it
															if (nextSelected) { setSelectedEntry(null); rightPanelRef.current?.expand(); }
														}}
														onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const source = { type: 'draftQueue' as const, item }; setPreGenKbSource(source); setKbSelectedSource(source); setSelectedEntry(null); } }}
													>
														<div className="flex items-center justify-between gap-1 min-w-0">
																<span className="truncate font-semibold text-[0.625rem]">{item.sectionName}{item.cohortCode ? ` · ${item.cohortCode}` : ''}</span>
															<span className="shrink-0 text-[0.5rem] text-muted-foreground/70 tabular-nums">{item.sessionNumber}/{item.sessionsPerWeek}</span>
														</div>
														<div className="flex items-center gap-1 min-w-0 mt-0.5">
															{item.hasNoTeacher ? (
																<UserX className="size-3 text-amber-500 shrink-0" />
															) : item.facultyOptions[0] ? (
																<span className="shrink-0 text-[0.5625rem] text-primary/80 font-medium">{formatFacultyInitials(item.facultyOptions[0])}</span>
															) : null}
															<span className="truncate text-[0.5625rem] text-muted-foreground">{item.subjectCode}</span>
														</div>
													</div>
												</DraggableQueuePin>
											);
												})}
											</div>
											{filteredPreGenQueue.length > pinsQueuePage && (
											<button type="button" className="mt-1 w-full rounded border border-dashed border-border py-1.5 text-center text-[0.6875rem] text-muted-foreground hover:bg-muted/30 transition-colors" onClick={() => setPinsQueuePage((p) => p + 30)}>
												Load more
											</button>
										)}
											{(draftBoard?.queue.length ?? 0) === 0 ? (
											<p className="rounded border border-dashed border-border px-2 py-3 text-center text-[0.6875rem] text-muted-foreground">No unassigned pre-generation demand remains.</p>
											) : filteredPreGenQueue.length === 0 ? (
											<p className="rounded border border-dashed border-border px-2 py-3 text-center text-[0.6875rem] text-muted-foreground">No unassigned items match the current search and filters.</p>
											) : null}
										</>
									) : (
										<>
											<UnassignDropZone
												className={cn(
													'space-y-1 rounded-md border border-transparent transition-colors',
													unassignDropActive ? 'border-destructive/60 bg-destructive/5' : '',
												)}
											>
												<p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">Unassign Drop Zone</p>
												{unassignDropActive ? (
													<div className="rounded border border-destructive/50 bg-destructive/10 px-2 py-1 text-[0.6875rem] text-destructive">
														Drop here to return the dragged pinned session to the unassigned list.
													</div>
												) : (
													<p className="text-[0.6875rem] text-muted-foreground">Drag a pinned session here when it should leave the grid.</p>
												)}
											</UnassignDropZone>
											<PinnedRailDropZone
												className={cn(
													'space-y-2 rounded-md border border-transparent p-2 transition-colors',
													pinnedRailDropActive ? 'border-primary/60 bg-primary/5' : 'border-border/60 bg-muted/20',
												)}
											>
												<div className="flex items-center justify-between gap-2">
													<div>
														<p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">Pinned Sessions</p>
														<p className="text-[0.6875rem] text-muted-foreground">Pinned sessions already placed in the draft grid. Drop one here to focus it in the rail.</p>
													</div>
													<Badge variant="outline" className="h-5 px-1.5 text-[0.5625rem]">
														{filteredPinnedPlacements.length}
													</Badge>
												</div>
												{pinnedRailDropActive && (
													<div className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[0.6875rem] text-primary">
														Release to focus this pinned session and inspect alternate pivots.
													</div>
												)}
												<div className="space-y-1">
												{filteredPinnedPlacements.map((placement) => {
											const selected = selectedEntry?.entryId === `draft-placement-${placement.id}`;
											const placementGrade = gradeForSection(placement.sectionId);
											const placementGradeBadge = placementGrade ? GRADE_BADGE[placementGrade] : null;
											return (
												<DraggablePlacementPin
													key={placement.id}
													placement={placement}
													disabled={!isDesktop}
													className={cn(
														'rounded border px-2 py-1.5 text-xs transition-colors',
														placementGrade ? (GRADE_CARD_BG[placementGrade] ?? 'bg-muted/30 border-border') : 'bg-muted/30',
														selected ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/40',
														isDesktop ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
													)}
												>
													<div
														role="button"
														tabIndex={0}
														className="w-full text-left"
														onClick={() => { focusPinnedPlacement(placement); }}
														onKeyDown={(event) => {
															if (event.key === 'Enter' || event.key === ' ') {
																event.preventDefault();
																focusPinnedPlacement(placement);
															}
														}}
													>
														<div className="flex items-center gap-1.5 min-w-0">
															<GripVertical className="size-3 shrink-0 text-muted-foreground/60" />
															{placementGradeBadge ? (
																<Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] shrink-0 ${placementGradeBadge}`}>
																	G{placementGrade}
																</Badge>
															) : null}
															<span className="truncate font-semibold text-[0.6875rem]">{subjectLabel(placement.subjectId)}</span>
														</div>
														<p className="mt-0.5 truncate text-[0.625rem] text-muted-foreground pl-4.5">
															{sectionLabel(placement.sectionId)}
														</p>
														<div className="mt-1 pl-4.5 space-y-0.5 text-[0.625rem] text-muted-foreground">
															<p className="truncate">{DAY_SHORT[placement.day] ?? placement.day} {formatTime(placement.startTime)}–{formatTime(placement.endTime)}</p>
															<p className="truncate">{placement.facultyId ? formatFacultyInitials(placement.facultyId) : 'No faculty'} · {placement.roomId ? roomLabelShort(placement.roomId) : 'No room'}</p>
														</div>
														<div className="mt-1 flex flex-wrap gap-1 pl-4.5">
															<Button type="button" variant="outline" size="sm" className="h-5 px-1.5 text-[0.5625rem]" onClick={(event) => { event.stopPropagation(); focusPinnedPlacement(placement, 'room'); }} disabled={!placement.roomId}>
																Room
															</Button>
															<Button type="button" variant="outline" size="sm" className="h-5 px-1.5 text-[0.5625rem]" onClick={(event) => { event.stopPropagation(); focusPinnedPlacement(placement, 'section'); }}>
																Section
															</Button>
															<Button type="button" variant="outline" size="sm" className="h-5 px-1.5 text-[0.5625rem]" onClick={(event) => { event.stopPropagation(); focusPinnedPlacement(placement, 'faculty'); }} disabled={!placement.facultyId}>
																Faculty
															</Button>
														</div>
													</div>
												</DraggablePlacementPin>
											);
												})}
												{(draftBoard?.placements ?? []).filter((placement) => placement.status === 'DRAFT').length === 0 ? (
											<p className="rounded border border-dashed border-border px-2 py-3 text-center text-[0.6875rem] text-muted-foreground">Drop an unassigned source into the center grid to create a pinned draft entry.</p>
												) : filteredPinnedPlacements.length === 0 ? (
													<p className="rounded border border-dashed border-border px-2 py-3 text-center text-[0.6875rem] text-muted-foreground">No pinned sessions match the current search and filters.</p>
												) : null}
												</div>
											</PinnedRailDropZone>
										</>
									)}
								</div>
							</ScrollArea>
						</div>
					) : (
						<ScrollArea id="panel-requests" role="tabpanel" aria-labelledby="tab-requests" className="flex-1 min-h-0">
							<div className="px-3 py-3 space-y-3">
								<div className="flex items-center justify-between gap-2 rounded border border-border bg-muted/30 px-2.5 py-1.5 text-[0.6875rem]">
									<div className="flex items-center gap-1.5">
										<span className="text-muted-foreground">Pending</span>
										<span className="font-semibold text-blue-700">{roomRequestSummary?.counts.pending ?? 0}</span>
									</div>
									<div className="flex items-center gap-1.5">
										<span className="text-muted-foreground">Requests</span>
										<span className="font-semibold">{roomRequestSummary?.requests.length ?? 0}</span>
									</div>
								</div>
								<div className="grid grid-cols-1 gap-2">
									<Input
										placeholder="Search faculty, subject, section, room"
										value={requestSearch}
										onChange={(event) => setRequestSearch(event.target.value)}
										className="h-8 text-xs"
									/>
									<div className="grid grid-cols-2 gap-2">
										<Select value={requestStatusFilter} onValueChange={(value) => setRequestStatusFilter(value as 'ALL' | 'SUBMITTED' | 'DRAFT')}>
											<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
											<SelectContent>
												<SelectItem value="ALL">All statuses</SelectItem>
												<SelectItem value="SUBMITTED">Submitted</SelectItem>
												<SelectItem value="DRAFT">Draft</SelectItem>
											</SelectContent>
										</Select>
										<Select value={requestDecisionFilter} onValueChange={(value) => setRequestDecisionFilter(value as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED')}>
											<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Decision" /></SelectTrigger>
											<SelectContent>
												<SelectItem value="ALL">All decisions</SelectItem>
												<SelectItem value="PENDING">Pending</SelectItem>
												<SelectItem value="APPROVED">Approved</SelectItem>
												<SelectItem value="REJECTED">Rejected</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
								{roomRequestError ? (
									<div className="rounded border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[0.6875rem] text-destructive">
										{roomRequestError}
									</div>
								) : null}
								{roomRequestLoading && !roomRequestSummary ? (
									<div className="space-y-2">
										{Array.from({ length: 3 }).map((_, index) => (
											<Skeleton key={index} className="h-20 w-full rounded-lg" />
										))}
									</div>
								) : filteredRoomRequests.length === 0 ? (
									<div className="rounded border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
										No room requests match the current filters.
									</div>
								) : (
									<div className="space-y-2">
										{filteredRoomRequests.map((request) => (
											<div
												key={request.id}
												className={cn(
													'rounded border px-2.5 py-2 text-xs transition-colors',
													selectedRequestId === request.id ? 'border-primary bg-primary/5' : 'border-border bg-card',
												)}
											>
												<div className="flex items-start justify-between gap-2">
													<div className="min-w-0">
														<p className="font-semibold truncate">{request.facultyName}</p>
														<p className="text-[0.625rem] text-muted-foreground truncate">{request.subjectCode} · {request.sectionName}</p>
														<p className="text-[0.625rem] text-muted-foreground truncate">{request.day} {request.startTime}-{request.endTime} · {request.requestedRoomName}</p>
													</div>
													<div className="flex flex-col items-end gap-1">
														<Badge variant="outline" className="h-4 px-1 text-[0.5625rem] uppercase">{request.decisionStatus}</Badge>
														{request.appealCount > 0 ? (
															<Badge variant="outline" className="h-4 px-1 text-[0.5625rem] uppercase">
																Appeals {request.appealCount}
															</Badge>
														) : null}
														<Button variant="ghost" size="sm" className="h-6 px-1.5 text-[0.625rem]" onClick={() => { void focusRequestInGrid(request.id); }}>
															Focus
														</Button>
													</div>
												</div>
												<Button
													variant="outline"
													size="sm"
													className="mt-2 h-7 w-full text-[0.6875rem]"
													onClick={() => void openRequestPreview(request.id)}
												>
													{isPrivilegedUser ? 'Review request' : 'Open request'}
												</Button>
											</div>
										))}
									</div>
								)}
							</div>
						</ScrollArea>
						)}
</>
);
}
