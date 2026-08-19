import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import {
	AlertTriangle,
	Check,
	ChevronDown,
	ChevronRight,
	Flag,
	GripVertical,
	Info,
	Lightbulb,
	Loader2,
	Search,
	ShieldAlert,
	Wand2,
	X,
	Zap,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import {
	getDefaultUnassignedReasonDetail,
	getProgramBadgeLabel,
	matchesProgramFilter,
} from '@/lib/schedule-review-helpers';
import type { FixSuggestionsResponse, UnassignedItem, Violation, ViolationCode } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { ViolationGroup } from '@/components/timetable/TimetableShared';
import { DraggableUnassignedPin } from '@/components/timetable/DraggablePinWrappers';
import type { LeftRailContentContext } from '@/components/timetable/timetableContexts.types';
import { VirtualizedRailList } from '@/components/timetable/VirtualizedRailList';

type GeneratedSummary = NonNullable<LeftRailContentContext['summary']> & {
	homeRoomSuccessRate?: number;
	resourceDiagnostics?: {
		qualifiedFacultyCoverageBySubject: Array<{ subjectId: number; subjectCode: string; coveragePercent: number }>;
		slotSaturationByInterval: Array<{ day: string; startTime: string; endTime: string; saturationPercent: number }>;
		unassignedBySubjectGrade: Array<{ subjectId: number; subjectCode: string; gradeLevel: number; count: number }>;
		roomAssignmentReasonCounts?: Record<string, number>;
		zoneDistributionByTerm?: Array<{ termIndex: number; byZone: Record<string, { percent?: number }> }>;
	};
};

type GeneratedViolationsPanelProps = {
	context: LeftRailContentContext;
	visibleViolationGroups: Array<[ViolationCode, Violation[]]>;
	violationGroups: Array<[ViolationCode, Violation[]]>;
	hasMoreViolationGroups: boolean;
};

export function GeneratedViolationsPanel({
	context,
	visibleViolationGroups,
	violationGroups,
	hasMoreViolationGroups,
}: GeneratedViolationsPanelProps) {
	const {
		hardViolationCount,
		topBlockers,
		violations,
		handleViolationSelect,
		setSeverityFilter,
		severityFilter,
		VIOLATION_LABELS,
		violationSearch,
		setViolationSearch,
		filteredViolations,
		selectedViolation,
		setDrawerViolation,
		formatConstraintMessage,
		subjectLabel,
		sectionLabel,
		roomLabelShort,
		formatFacultyInitials,
		filteredUnassignedItems,
		setSelectedEntry,
		setSelectedUnassignedForRepair,
		setSelectedViolation,
		openTacticalSandbox,
		toast,
		setViolationsGroupPage,
	} = context;
	const formatRailConstraintMessage = (message: string, violation?: Violation): string => {
		let formatted = formatConstraintMessage(message)
			.replace(/^Entry\s+entry-[^:]+:\s*/i, '')
			.replace(/\bentry-[a-z0-9_-]+\b/gi, 'this class');

		const subjectId = violation?.entities?.subjectId;
		if (typeof subjectId === 'number') {
			formatted = formatted.replace(new RegExp(`\\bsubject\\s+#?${subjectId}\\b`, 'gi'), subjectLabel(subjectId));
		}
		const sectionId = violation?.entities?.sectionId;
		if (typeof sectionId === 'number') {
			formatted = formatted.replace(new RegExp(`\\bsection\\s+#?${sectionId}\\b`, 'gi'), sectionLabel(sectionId));
		}
		const roomId = violation?.entities?.roomId;
		if (typeof roomId === 'number') {
			formatted = formatted.replace(new RegExp(`\\broom\\s+#?${roomId}\\b`, 'gi'), roomLabelShort(roomId));
		}
		const facultyId = violation?.entities?.facultyId;
		if (typeof facultyId === 'number') {
			formatted = formatted.replace(new RegExp(`\\bfaculty\\s+#?${facultyId}\\b`, 'gi'), formatFacultyInitials(facultyId));
		}

		return formatted
			.replace(/\bsubject\s+#?\d+\b/gi, 'this subject')
			.replace(/\bsection\s+#?\d+\b/gi, 'this section')
			.replace(/\broom\s+#?\d+\b/gi, 'this room')
			.replace(/\bfaculty\s+#?\d+\b/gi, 'this teacher');
	};
	const resolveUnassignedForViolation = (violation: Violation): UnassignedItem | null => {
		if (violation.code !== 'UNASSIGNED_SECTION') return null;
		const entities = violation.entities as Record<string, unknown> | undefined;
		const subjectId = typeof entities?.subjectId === 'number' ? entities.subjectId : null;
		const sectionId = typeof entities?.sectionId === 'number' ? entities.sectionId : null;
		const entitySession = typeof entities?.session === 'number' ? entities.session : null;
		const messageSession = entitySession ?? Number(violation.message.match(/\bsession\s+(\d+)\b/i)?.[1] ?? NaN);
		if (!subjectId || !sectionId || !Number.isFinite(messageSession)) return null;
		return filteredUnassignedItems.find((item) => (
			item.subjectId === subjectId
			&& item.sectionId === sectionId
			&& item.session === messageSession
		)) ?? null;
	};
	const renderUnassignedRepairAction = (violation: Violation): ReactNode => {
		const item = resolveUnassignedForViolation(violation);
		if (!item) return null;
		return (
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-auto self-stretch rounded-none border-y-0 border-r-0 px-2 py-1.5 text-xs font-medium"
				onClick={(event) => {
					event.stopPropagation();
					setSelectedEntry(null);
					setSelectedViolation(null);
					setSelectedUnassignedForRepair(item);
					openTacticalSandbox();
					toast.info('Teaching Load repair opened. Fix the owner there, then place the session.');
				}}
			>
				<Wand2 className="mr-1 size-3" />
				Fix teaching load
			</Button>
		);
	};

	return (
		<div id="panel-violations" role="tabpanel" aria-labelledby="tab-violations" className="flex flex-col flex-1 min-h-0">
			{hardViolationCount > 0 && (
				<div className="shrink-0 px-3 py-2.5 border-b border-red-100 bg-red-50/50">
					<div className="flex items-center gap-1.5 text-xs font-bold text-red-700 mb-1.5">
						<ShieldAlert className="size-3.5" />
						Top blockers ({hardViolationCount} hard)
					</div>
					<div className="space-y-0.5">
						{topBlockers.map((violation, index) => {
							const count = violations.filter((item) => item.code === violation.code && item.severity === 'HARD').length;
							return (
								<Button
									key={`${violation.code}-${index}`}
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => {
										handleViolationSelect(violation);
										setSeverityFilter('hard');
									}}
									className="h-6 w-full justify-start gap-1.5 rounded px-1 py-0.5 text-left text-xs font-semibold text-red-800 hover:bg-red-100/60 hover:text-red-600"
								>
									<ChevronRight className="size-3 shrink-0" />
									<span className="truncate flex-1">{VIOLATION_LABELS[violation.code]}</span>
									<span className="shrink-0 text-red-500 font-semibold">x{count}</span>
								</Button>
							);
						})}
					</div>
				</div>
			)}
			{hardViolationCount === 0 && violations.length === 0 && (
				<div className="shrink-0 px-3 py-2.5 border-b border-emerald-100 bg-emerald-50/50">
					<div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
						<Check className="size-3.5" />
						No violations - schedule is clean
					</div>
				</div>
			)}
			<div className="shrink-0 px-3 py-2">
				<div className="relative">
					<Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
					<Input
						placeholder="Search violations..."
						value={violationSearch}
						onChange={(event) => setViolationSearch(event.target.value)}
						className="h-7 pl-7 text-xs"
					/>
					{violationSearch && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label="Clear search"
							onClick={() => setViolationSearch('')}
							className="absolute right-1 top-1/2 size-6 -translate-y-1/2"
						>
							<X className="size-3 text-muted-foreground" />
						</Button>
					)}
				</div>
				<div className="mt-2 flex gap-1 rounded-lg bg-muted/40 p-0.5 border border-border/50">
					{(['all', 'hard', 'soft'] as const).map((filter) => {
						const count = filter === 'all'
							? violations.length
							: filter === 'hard'
								? violations.filter((v) => v.severity === 'HARD').length
								: violations.filter((v) => v.severity === 'SOFT').length;
						const label = filter === 'all' ? 'All' : filter === 'hard' ? 'Hard' : 'Soft';
						const isActive = severityFilter === filter;
						return (
							<Button
								key={filter}
								type="button"
								variant={isActive ? 'default' : 'ghost'}
								size="sm"
								onClick={() => setSeverityFilter(filter)}
								className={`h-6 flex-1 text-xs font-semibold rounded-md transition-all ${
									isActive ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'
								}`}
							>
								{label} ({count})
							</Button>
						);
					})}
				</div>
			</div>
			<ScrollArea className="flex-1 min-h-0">
				<div className="px-3 pb-3 space-y-1">
					{filteredViolations.length === 0 ? (
						<div className="py-6 text-center text-xs text-muted-foreground">
							{violations.length === 0 ? 'No violations found' : 'No matching violations'}
						</div>
					) : (
						visibleViolationGroups.map(([code, violationList]) => (
							<ViolationGroup
								key={code}
								code={code}
								violations={violationList}
								selectedViolation={selectedViolation}
								onSelect={handleViolationSelect}
								onExplain={setDrawerViolation}
								formatConstraintMessage={formatRailConstraintMessage}
								renderAction={renderUnassignedRepairAction}
								labels={VIOLATION_LABELS}
							/>
						))
					)}
					{hasMoreViolationGroups && (
						<div className="pt-1">
							<Button
								variant="outline"
								size="sm"
								className="h-7 w-full text-xs"
								onClick={() => setViolationsGroupPage((prev) => prev + 10)}
							>
								Load more groups ({violationGroups.length - visibleViolationGroups.length} left)
							</Button>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

type GeneratedUnassignedPanelProps = {
	context: LeftRailContentContext;
	renderUnassignedReasonBadge: (reason: string) => ReactNode;
};

export function GeneratedUnassignedPanel({ context, renderUnassignedReasonBadge }: GeneratedUnassignedPanelProps) {
	const {
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
		toast,
		setKbSelectedSource,
		setSelectedEntry,
		setSelectedUnassignedForRepair,
		setSelectedViolation,
		openTacticalSandbox,
		GRADE_BADGE,
	} = context;
	const generatedSummary = summary as GeneratedSummary | null;
	const [showDiagnostics, setShowDiagnostics] = useState(false);

	return (
		<div id="panel-unassigned" role="tabpanel" aria-labelledby="tab-unassigned" className="flex flex-1 min-h-0 flex-col">
			{generatedSummary ? (
				<>
					<div className="hidden shrink-0 border-b border-border/70 bg-background px-3 py-2 space-y-2 xl:block">
						<div className="flex items-center justify-between rounded border border-border bg-muted/20 px-2 py-1 text-xs xl:hidden">
							<span className="font-semibold text-amber-700">{generatedSummary.unassignedCount} unassigned</span>
							<span className="text-muted-foreground">{generatedSummary.assignedCount}/{generatedSummary.classesProcessed} placed</span>
						</div>
						<div className="hidden grid-cols-4 gap-1.5 rounded border border-border bg-muted/20 px-2 py-1.5 text-xs xl:grid">
							<div className="flex items-center gap-1.5">
								<span className="text-muted-foreground font-medium">Processed</span>
								<span className="font-bold">{generatedSummary.classesProcessed}</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="text-muted-foreground font-medium">Assigned</span>
								<span className="font-bold text-emerald-600">{generatedSummary.assignedCount}</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="text-muted-foreground font-medium">Unassigned</span>
								<span className={`font-bold ${generatedSummary.unassignedCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{generatedSummary.unassignedCount}</span>
							</div>
							{typeof generatedSummary.homeRoomSuccessRate === 'number' && (
								<div className="flex items-center gap-1.5">
									<span className="text-muted-foreground font-medium">Home-Room</span>
									<span className="font-bold text-sky-700">{generatedSummary.homeRoomSuccessRate}%</span>
								</div>
							)}
						</div>
						{generatedSummary.resourceDiagnostics ? (
							<div className="hidden rounded border border-border/70 bg-muted/20 xl:block">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 w-full justify-between rounded-none px-2 text-xs"
									aria-expanded={showDiagnostics}
									onClick={() => setShowDiagnostics((value) => !value)}
								>
									<span className="inline-flex items-center gap-1.5">
										<Info className="size-3.5" />
										Resource diagnostics
									</span>
									<ChevronDown className={`size-3.5 transition-transform ${showDiagnostics ? '' : '-rotate-90'}`} />
								</Button>
								{showDiagnostics ? (
									<div className="border-t border-border/70">
										<GeneratedResourceDiagnostics summary={generatedSummary} />
									</div>
								) : null}
							</div>
						) : null}
						{filteredUnassignedItems.length > 0 && (
							<div className="space-y-1.5">
								<div className="flex gap-1 overflow-x-auto pb-0.5">
									{(['all', 'NO_QUALIFIED_FACULTY', 'FACULTY_OVERLOADED', 'NO_AVAILABLE_SLOT', 'NO_COMPATIBLE_ROOM'] as const).map((reason) => {
										const label = reason === 'all' ? 'All' : (UNASSIGNED_REASON_LABELS[reason]?.label ?? reason);
										const count = reason === 'all'
											? programKindFilteredUnassignedItems.length
											: programKindFilteredUnassignedItems.filter((item) => item.reason === reason).length;
										if (reason !== 'all' && count === 0) return null;
										return (
											<Button
												key={reason}
												type="button"
												variant={unassignedReasonFilter === reason ? 'default' : 'secondary'}
												size="sm"
												onClick={() => setUnassignedReasonFilter(reason)}
												className="h-6 rounded-full px-2 py-0.5 text-xs font-medium"
											>
												{label} ({count})
											</Button>
										);
									})}
								</div>
								<span className="hidden text-xs font-medium text-muted-foreground xl:block">
									Choose a session, then place it with teacher, room, and slot guidance.
								</span>
							</div>
						)}
					</div>
					{filteredUnassignedItems.length > 0 && (
						<VirtualizedRailList
							items={filteredUnassignedItems}
							getKey={(item, index) => `${buildUnassignedKey(item)}-${index}`}
							estimateRowHeight={(item) => (expandedUnassigned.has(buildUnassignedKey(item)) ? 520 : 78)}
							renderItem={(item, index) => (
								<UnassignedRailRow
									context={context}
									item={item}
									index={index}
									renderUnassignedReasonBadge={renderUnassignedReasonBadge}
								/>
							)}
							className="flex-1 min-h-[220px] touch-pan-y overscroll-contain overflow-auto px-3 pb-3"
							ariaLabel="Unassigned generated sessions"
							overscan={5}
						/>
					)}
					{generatedSummary.unassignedCount === 0 && (
						<div className="px-3 py-4 text-center text-xs text-muted-foreground">
							<Check className="mx-auto size-6 text-emerald-500 mb-1" />
							All classes assigned successfully
						</div>
					)}
					{generatedSummary.unassignedCount > 0 && filteredUnassignedItems.length === 0 && (
						<div className="px-3 py-4 text-center text-xs text-muted-foreground">
							No unassigned items match the current program, entry type, and reason filters.
						</div>
					)}
				</>
			) : (
				<div className="px-3 py-6 text-center text-xs text-muted-foreground">
					No draft data available
				</div>
			)}
		</div>
	);
}

function GeneratedResourceDiagnostics({ summary }: { summary: GeneratedSummary }) {
	if (!summary.resourceDiagnostics) return null;

	return (
		<div className="rounded border border-border/70 bg-background/70 px-2.5 py-2 space-y-2 text-xs">
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
				{summary.resourceDiagnostics.slotSaturationByInterval.slice(0, 3).map((row, index) => (
					<div key={`sat-${index}-${row.day}-${row.startTime}-${row.endTime}`} className="flex items-center justify-between text-muted-foreground">
						<span>{row.day.slice(0, 3)} {row.startTime}-{row.endTime}</span>
						<span className="font-semibold text-rose-700">{row.saturationPercent}%</span>
					</div>
				))}
			</div>
			<div className="space-y-1">
				<div className="font-medium">Top unassigned clusters</div>
				{summary.resourceDiagnostics.unassignedBySubjectGrade.slice(0, 3).map((row) => (
					<div key={`unassigned-${row.subjectId}-${row.gradeLevel}`} className="flex items-center justify-between text-muted-foreground">
						<span>{row.subjectCode} - GR{row.gradeLevel}</span>
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
	);
}

function UnassignedRailRow({
	context,
	item,
	index,
	renderUnassignedReasonBadge,
}: {
	context: LeftRailContentContext;
	item: UnassignedItem;
	index: number;
	renderUnassignedReasonBadge: (reason: string) => ReactNode;
}) {
	const {
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
		toast,
		setKbSelectedSource,
		GRADE_BADGE,
		setSelectedEntry,
		setSelectedViolation,
		setSelectedUnassignedForRepair,
		openTacticalSandbox,
	} = context;
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
	const itemStatus = !item.facultyId
		? { label: 'Needs owner', className: 'border-amber-200 bg-amber-50 text-amber-800' }
		: !item.homeRoomId
			? { label: 'Pick room', className: 'border-sky-200 bg-sky-50 text-sky-800' }
		: cachedFix === null
			? { label: 'Still blocked', className: 'border-red-200 bg-red-50 text-red-800' }
			: cachedFix?.suggestions?.length
				? { label: 'Ready to place', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
				: { label: 'Check slot', className: 'border-slate-200 bg-slate-50 text-slate-700' };
	const openPlacementFlow = () => {
		setSelectedEntry(null);
		setSelectedViolation(null);
		setSelectedUnassignedForRepair(null);
		setKbSelectedSource({ type: 'unassigned', item });
		toast.info('Session selected. Click a highlighted grid slot to review the placement.');
	};

	return (
		<DraggableUnassignedPin
			key={`${itemKey}-${index}`}
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
			<Button
				type="button"
				variant="ghost"
				data-testid="generated-unassigned-card"
				className="h-auto w-full max-w-full justify-start overflow-hidden px-2 py-1.5 text-left"
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
				<div className="w-full space-y-1">
					<div className="flex items-center gap-1.5 min-w-0">
						<ChevronDown className={`size-3 text-muted-foreground shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
						<GripVertical className="size-3 text-muted-foreground/50 shrink-0" />
						{gradeBadge && (
							<Badge variant="outline" className={`h-4.5 px-1.5 text-xs shrink-0 ${gradeBadge}`}>
								GR{grade}
							</Badge>
						)}
						{item.entryKind === 'COHORT' && item.cohortCode && (
							<Badge variant="outline" className="h-4.5 px-1.5 text-xs shrink-0 border-sky-300 bg-sky-50 text-sky-700">
								{item.cohortCode}
							</Badge>
						)}
						<span className="font-medium truncate min-w-0">{sectionLabel(item.sectionId)}</span>
						<span className="text-muted-foreground shrink-0">-</span>
						<span className="truncate min-w-0">{subjectLabel(item.subjectId)}</span>
					</div>
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-4.5">
						<span className="opacity-60 font-medium">Session {item.session}</span>
						<span
							className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${itemStatus.className}`}
							data-unassigned-status={itemStatus.label}
						>
							{itemStatus.label === 'Still blocked' ? <AlertTriangle className="size-2.5" aria-hidden="true" /> : null}
							{itemStatus.label}
						</span>
					</div>
				</div>
			</Button>
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
							<div className="rounded border border-red-200 bg-red-50/50 p-2.5 space-y-1">
								<div className="flex items-center gap-1.5 text-xs text-red-800 font-bold">
									<AlertTriangle className="size-3" />
									Why blocked
								</div>
								<p className="font-medium text-xs text-red-900 wrap-break-word whitespace-normal leading-snug">
									{unassignedFixSuggestions[itemKey]
										? unassignedFixSuggestions[itemKey]!.humanDetail
										: getDefaultUnassignedReasonDetail(item)}
								</p>
							</div>
							<div className="flex items-center gap-1.5 text-xs">
								<ShieldAlert className="size-3 text-red-600 shrink-0" />
								<span className="text-red-700 font-semibold">Recovery required</span>
								<span className="text-muted-foreground">- this session still needs an operator review before publishing</span>
							</div>
							<div className="flex flex-wrap items-center gap-1.5 text-xs">
								{renderUnassignedReasonBadge(item.reason)}
								{matchesProgramFilter(resolveEntryProgramType(item), 'SPECIAL') && (
									<Badge variant="outline" className="h-4.5 px-1.5 text-xs border-violet-300 bg-violet-50 text-violet-700">
										{getProgramBadgeLabel(resolveEntryProgramType(item), resolveEntryProgramCode(item))}
									</Badge>
								)}
							</div>
							{(item.entryKind === 'COHORT' || item.adviserName) && (
								<div className="rounded border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
									{entryContextLabel(item)}
								</div>
							)}
							<UnassignedFixSuggestions
								item={item}
								itemKey={itemKey}
								cachedFix={cachedFix}
								context={context}
							/>
							<div className="flex items-center gap-1.5 pt-1" onClick={(event) => event.stopPropagation()}>
								{(() => {
									const isTeacherMissing = !item.facultyId;
									const isRoomMissing = Boolean(item.facultyId) && !item.homeRoomId;
									const cachedFix = unassignedFixSuggestions[itemKey];

									if (isTeacherMissing) {
										return (
											<Button
												variant="outline"
												size="sm"
												className="h-10 px-3 text-xs gap-1.5 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
												onClick={() => {
													openPlacementFlow();
												}}
											>
												<Wand2 className="size-3" />
												Fix teaching load
											</Button>
										);
									}

									if (isRoomMissing) {
										return (
											<Button
												variant="outline"
												size="sm"
												className="h-10 px-3 text-xs gap-1.5 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
												onClick={openPlacementFlow}
											>
												<Wand2 className="size-3" />
												Place session
											</Button>
										);
									}

									if (cachedFix !== undefined && cachedFix !== null) {
										const hasSlots = cachedFix.suggestions && cachedFix.suggestions.length > 0;
										if (hasSlots) {
											return (
													<Button
														variant="outline"
														size="sm"
														className="h-10 px-3 text-xs gap-1.5 border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
														onClick={() => {
															openPlacementFlow();
														}}
												>
													<Wand2 className="size-3" />
													Place session
												</Button>
											);
										} else {
											return (
												<Button
													variant="outline"
													size="sm"
													className="h-10 px-3 text-xs gap-1.5 border-red-200 bg-red-50 text-red-700 hover:bg-red-50"
													disabled
												>
													<ShieldAlert className="size-3" />
													Still blocked
												</Button>
											);
										}
									}

									return (
										<Button
											variant="outline"
											size="sm"
											className="h-10 px-3 text-xs gap-1.5"
											onClick={() => {
												openPlacementFlow();
											}}
										>
											<Wand2 className="size-3" />
											Place session
										</Button>
									);
								})()}
								<Button
									variant="ghost"
									size="sm"
									className="h-10 px-3 text-xs gap-1.5"
									onClick={() => setDrawerUnassigned(item)}
								>
									<Lightbulb className="size-3" />
									Full explanation
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className={`h-10 px-3 text-xs gap-1.5 ${isFollowUp ? 'text-amber-600' : ''}`}
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
}

function UnassignedFixSuggestions({
	item,
	itemKey,
	cachedFix,
	context,
}: {
	item: UnassignedItem;
	itemKey: string;
	cachedFix: LeftRailContentContext['unassignedFixSuggestions'][string] | undefined;
	context: LeftRailContentContext;
}) {
	const {
		fixLoading,
		schoolYearId,
		runs,
		selectedRunId,
		defaultSchoolId,
		setFixLoading,
		setUnassignedFixSuggestions,
		previewEdit,
		toast,
	} = context;

	if (cachedFix === undefined) {
		return (
			<Button
				variant="outline"
				size="sm"
				className="h-10 w-full text-xs gap-1.5"
				disabled={fixLoading === itemKey}
				onClick={async (event) => {
					event.stopPropagation();
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
						setUnassignedFixSuggestions((prev) => ({ ...prev, [itemKey]: data.explanation }));
					} catch (errorValue: unknown) {
						const error = errorValue as { response?: { status?: number; data?: { code?: string } } };
						const status = error.response?.status;
						const code = error.response?.data?.code;
						if (status === 401) {
							toast.error(code === 'TOKEN_EXPIRED' ? 'Session expired. Re-open ATLAS from EnrollPro.' : 'Session missing or invalid. Re-open ATLAS from EnrollPro.');
						} else if (status === 403) {
							toast.error('You do not have permission to request fix suggestions.');
						} else if (status === 400) {
							toast.error('Fix suggestion request is invalid. Please refresh run data and try again.');
						} else {
							toast.error('Could not fetch fix suggestions');
						}
						setUnassignedFixSuggestions((prev) => ({ ...prev, [itemKey]: null }));
					} finally {
						setFixLoading(null);
					}
				}}
			>
				{fixLoading === itemKey ? <Loader2 className="size-2.5 animate-spin" /> : <Wand2 className="size-2.5" />}
				Load fix suggestions
			</Button>
		);
	}

	if (cachedFix === null) {
		return <div className="text-xs text-muted-foreground italic px-1">Could not load suggestions. Try again later.</div>;
	}

	return (
		<div className="space-y-1.5">
			<div className="text-xs font-bold text-foreground flex items-center gap-1">
				<Wand2 className="size-3 text-primary" />
				Recommended fixes ({cachedFix.suggestions.length})
			</div>
			{cachedFix.suggestions.length === 0 ? (
				<div className="text-xs text-muted-foreground italic">No automatic fix available. Manual intervention needed.</div>
			) : (
				cachedFix.suggestions.map((suggestion, index) => (
					<div key={index} className="rounded border border-border bg-background px-2.5 py-1.5 space-y-1">
						<div className="flex items-center gap-1">
							<span className="text-xs font-semibold text-foreground">{index + 1}. {suggestion.label}</span>
						</div>
						<p className="text-xs text-muted-foreground leading-relaxed">{suggestion.description}</p>
						{suggestion.proposal && (
							<Button
								variant="outline"
								size="sm"
								className="h-6 text-xs font-semibold gap-0.5 mt-1"
								onClick={(event) => {
									event.stopPropagation();
									if (suggestion.proposal) void previewEdit(suggestion.proposal);
								}}
							>
								<Zap className="size-2.5" />
								Preview & Apply
							</Button>
						)}
						{suggestion.policyHint && (
							<p className="text-xs italic text-muted-foreground/75">Policy: {suggestion.policyHint}</p>
						)}
					</div>
				))
			)}
		</div>
	);
}
