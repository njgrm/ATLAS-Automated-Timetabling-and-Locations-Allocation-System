import { useMemo, useState, type ReactNode } from 'react';
import {
	AlertTriangle,
	Check,
	ChevronDown,
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
	getProgramBadgeLabel,
	matchesProgramFilter,
} from '@/lib/schedule-review-helpers';
import type { FixSuggestionsResponse, UnassignedItem } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
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

type GeneratedUnassignedPanelProps = {
	context: LeftRailContentContext;
	renderUnassignedReasonBadge: (reason: string) => ReactNode;
};

type StatusFilter = 'all' | 'needs-owner' | 'needs-room' | 'ready' | 'blocked';

function getUnassignedStatus(
	item: UnassignedItem,
	cachedFix: LeftRailContentContext['unassignedFixSuggestions'][string] | undefined,
) {
	if (!item.facultyId) return { key: 'needs-owner' as const, label: 'Needs owner', actionLabel: 'Fix teaching load', className: 'border-amber-200 bg-amber-50 text-amber-800' };
	if (!item.homeRoomId) return { key: 'needs-room' as const, label: 'Needs room', actionLabel: 'Review room source', className: 'border-sky-200 bg-sky-50 text-sky-800' };
	if (cachedFix === null) return { key: 'blocked' as const, label: 'Still blocked', actionLabel: 'Still blocked', className: 'border-red-200 bg-red-50 text-red-800' };
	if (cachedFix?.suggestions?.length) return { key: 'ready' as const, label: 'Ready to place', actionLabel: 'Place session', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
	return { key: 'ready' as const, label: 'Check slot', actionLabel: 'Place session', className: 'border-slate-200 bg-slate-50 text-slate-700' };
}

export function GeneratedUnassignedPanel({ context, renderUnassignedReasonBadge }: GeneratedUnassignedPanelProps) {
	const {
		summary,
		filteredUnassignedItems,
		programKindFilteredUnassignedItems,
		UNASSIGNED_REASON_LABELS,
		unassignedReasonFilter,
		setUnassignedReasonFilter,
		sectionLabel,
		subjectLabel,
		buildUnassignedKey,
		unassignedFixSuggestions,
		GRADE_BADGE,
	} = context;
	const generatedSummary = summary as GeneratedSummary | null;
	const [showDiagnostics, setShowDiagnostics] = useState(false);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
	const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all');

	const grades = useMemo(() => {
		return [...new Set(filteredUnassignedItems.map((item) => item.gradeLevel).filter((grade): grade is number => typeof grade === 'number'))].sort((a, b) => a - b);
	}, [filteredUnassignedItems]);

	const visibleItems = useMemo(() => {
		const normalized = search.trim().toLowerCase();
		return filteredUnassignedItems.filter((item) => {
			const itemKey = buildUnassignedKey(item);
			const status = getUnassignedStatus(item, unassignedFixSuggestions[itemKey]);
			if (statusFilter !== 'all' && status.key !== statusFilter) return false;
			if (gradeFilter !== 'all' && item.gradeLevel !== gradeFilter) return false;
			if (!normalized) return true;
			const haystack = [
				sectionLabel(item.sectionId),
				subjectLabel(item.subjectId),
				item.cohortCode,
				item.reason,
				`session ${item.session}`,
			].filter(Boolean).join(' ').toLowerCase();
			return haystack.includes(normalized);
		});
	}, [buildUnassignedKey, filteredUnassignedItems, gradeFilter, search, sectionLabel, statusFilter, subjectLabel, unassignedFixSuggestions]);

	const clearFilters = () => {
		setSearch('');
		setStatusFilter('all');
		setGradeFilter('all');
		setUnassignedReasonFilter('all');
	};

	return (
		<div id="panel-unassigned" role="tabpanel" aria-labelledby="tab-unassigned" className="flex flex-1 min-h-0 flex-col">
			{generatedSummary ? (
				<>
					<div className="shrink-0 border-b border-border/70 bg-background px-3 py-2 space-y-2" data-testid="generated-unassigned-search-panel">
						<div className="flex flex-wrap items-center gap-1.5 text-xs">
							<Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
								{generatedSummary.unassignedCount} unresolved
							</Badge>
							<Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
								{generatedSummary.assignedCount}/{generatedSummary.classesProcessed} placed
							</Badge>
							{typeof generatedSummary.homeRoomSuccessRate === 'number' && (
								<Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">
									{generatedSummary.homeRoomSuccessRate}% home-room
								</Badge>
							)}
						</div>
						<div className="relative" role="search">
							<Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Find section, subject, or session..."
								aria-label="Search unresolved sessions"
								className="h-9 pl-7 pr-8 text-sm"
								data-testid="generated-unassigned-search"
							/>
							{search && (
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label="Clear unresolved search"
									onClick={() => setSearch('')}
									className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
								>
									<X className="size-3.5" />
								</Button>
							)}
						</div>
						<div className="flex gap-1 overflow-x-auto pb-0.5" aria-label="Unresolved status filters">
							{([
								['all', 'All'],
								['needs-room', 'Needs room'],
								['needs-owner', 'Needs owner'],
								['ready', 'Ready'],
								['blocked', 'Blocked'],
							] as const).map(([value, label]) => (
								<Button
									key={value}
									type="button"
									variant={statusFilter === value ? 'default' : 'secondary'}
									size="sm"
									onClick={() => setStatusFilter(value)}
									className="h-8 shrink-0 rounded-full px-3 text-xs"
								>
									{label}
								</Button>
							))}
						</div>
						<div className="flex gap-1 overflow-x-auto pb-0.5" aria-label="Unresolved grade and reason filters">
							<Button
								type="button"
								variant={gradeFilter === 'all' ? 'default' : 'secondary'}
								size="sm"
								onClick={() => setGradeFilter('all')}
								className="h-7 shrink-0 rounded-full px-2.5 text-xs"
							>
								All grades
							</Button>
							{grades.map((grade) => (
								<Button
									key={grade}
									type="button"
									variant={gradeFilter === grade ? 'default' : 'secondary'}
									size="sm"
									onClick={() => setGradeFilter(grade)}
									className="h-7 shrink-0 rounded-full px-2.5 text-xs"
								>
									G{grade}
								</Button>
							))}
							{(['all', 'NO_QUALIFIED_FACULTY', 'FACULTY_OVERLOADED', 'NO_AVAILABLE_SLOT', 'NO_COMPATIBLE_ROOM'] as const).map((reason) => {
								const label = reason === 'all' ? 'Any reason' : (UNASSIGNED_REASON_LABELS[reason]?.label ?? reason);
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
										className="h-7 shrink-0 rounded-full px-2.5 text-xs"
									>
										{label} ({count})
									</Button>
								);
							})}
						</div>
						<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
							<span data-testid="generated-unassigned-result-count">
								Showing {visibleItems.length} of {filteredUnassignedItems.length}
							</span>
							<div className="flex items-center gap-1">
								{generatedSummary.resourceDiagnostics ? (
									<Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setShowDiagnostics((value) => !value)}>
										<Info className="size-3.5" />
										{showDiagnostics ? 'Hide diagnostics' : 'Show diagnostics'}
										<ChevronDown className={`size-3.5 transition-transform ${showDiagnostics ? '' : '-rotate-90'}`} />
									</Button>
								) : null}
								<Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
									Clear
								</Button>
							</div>
						</div>
						{showDiagnostics && generatedSummary.resourceDiagnostics ? (
							<GeneratedResourceDiagnostics summary={generatedSummary} />
						) : null}
					</div>
					{visibleItems.length > 0 && (
						<VirtualizedRailList
							items={visibleItems}
							getKey={(item, index) => `${buildUnassignedKey(item)}-${index}`}
							estimateRowHeight={() => 156}
							renderItem={(item, index) => (
								<UnassignedRailRow
									context={context}
									item={item}
									index={index}
									renderUnassignedReasonBadge={renderUnassignedReasonBadge}
								/>
							)}
							className="flex-1 min-h-[240px] touch-pan-y overscroll-contain overflow-auto px-3 pb-3 pt-2"
							ariaLabel="Unassigned generated sessions"
							overscan={6}
						/>
					)}
					{generatedSummary.unassignedCount === 0 && (
						<div className="px-3 py-4 text-center text-xs text-muted-foreground">
							<Check className="mx-auto mb-1 size-6 text-emerald-500" />
							All classes assigned successfully
						</div>
					)}
					{generatedSummary.unassignedCount > 0 && visibleItems.length === 0 && (
						<div className="px-3 py-4 text-center text-sm text-muted-foreground">
							No unresolved sessions match your filters.
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
		<div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2 text-xs" data-testid="generated-unassigned-diagnostics">
			<div className="mb-1 font-semibold text-foreground">Diagnostics</div>
			<div className="grid gap-2 sm:grid-cols-2">
				<div className="space-y-1">
					<div className="font-medium text-muted-foreground">Lowest teaching-load coverage</div>
					{summary.resourceDiagnostics.qualifiedFacultyCoverageBySubject.slice(0, 2).map((row) => (
						<div key={`coverage-${row.subjectId}`} className="flex items-center justify-between gap-2">
							<span className="min-w-0 truncate">{row.subjectCode}</span>
							<span className="shrink-0 font-semibold text-amber-700">{row.coveragePercent}%</span>
						</div>
					))}
				</div>
				<div className="space-y-1">
					<div className="font-medium text-muted-foreground">Most saturated times</div>
					{summary.resourceDiagnostics.slotSaturationByInterval.slice(0, 2).map((row, index) => (
						<div key={`sat-${index}-${row.day}-${row.startTime}-${row.endTime}`} className="flex items-center justify-between gap-2">
							<span className="min-w-0 truncate">{row.day.slice(0, 3)} {row.startTime}-{row.endTime}</span>
							<span className="shrink-0 font-semibold text-rose-700">{row.saturationPercent}%</span>
						</div>
					))}
				</div>
			</div>
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
		unassignedFixSuggestions,
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
	const itemKey = buildUnassignedKey(item);
	const isKbSelected = kbSelectedSource?.type === 'unassigned'
		&& kbSelectedSource.item.sectionId === item.sectionId
		&& kbSelectedSource.item.subjectId === item.subjectId
		&& kbSelectedSource.item.session === item.session
		&& (kbSelectedSource.item.cohortCode ?? '') === (item.cohortCode ?? '');
	const isFollowUp = followUps.has(itemKey);
	const cachedFix = unassignedFixSuggestions[itemKey];
	const itemStatus = getUnassignedStatus(item, cachedFix);
	const canOpenPlacement = itemStatus.key !== 'needs-owner' && itemStatus.key !== 'blocked';

	const openPlacementFlow = () => {
		setSelectedEntry(null);
		setSelectedViolation(null);
		setSelectedUnassignedForRepair(null);
		setKbSelectedSource({ type: 'unassigned', item });
		toast.info('Session selected. Click a highlighted grid slot to review the placement.');
	};

	const openTeachingLoadRepair = () => {
		setSelectedEntry(null);
		setSelectedViolation(null);
		setSelectedUnassignedForRepair(item);
		openTacticalSandbox();
		toast.info('Teaching Load repair opened. Fix the owner there, then place the session.');
	};

	return (
		<DraggableUnassignedPin
			key={`${itemKey}-${index}`}
			itemKey={itemKey}
			item={item}
			disabled={false}
			className={`rounded-lg border text-xs transition-colors ${
				isKbSelected
					? 'border-primary bg-primary/10 ring-2 ring-primary'
					: isFollowUp
						? 'border-amber-300 bg-amber-50/80'
						: 'border-border bg-background hover:border-amber-300'
			}`}
		>
			<div
				className="flex h-full min-w-0 flex-col justify-between gap-1.5 p-2"
				data-testid="generated-unassigned-card"
			>
				<div className="min-w-0 overflow-hidden px-1 py-1 text-left">
					<div className="flex w-full min-w-0 items-start gap-1.5">
						<GripVertical className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
						<div className="min-w-0 flex-1 space-y-1">
							<div className="flex min-w-0 flex-wrap items-center gap-1">
								{gradeBadge && (
									<Badge variant="outline" className={`h-5 shrink-0 px-1.5 text-xs ${gradeBadge}`}>
										G{grade}
									</Badge>
								)}
								{item.entryKind === 'COHORT' && item.cohortCode && (
									<Badge variant="outline" className="h-5 shrink-0 border-sky-300 bg-sky-50 px-1.5 text-xs text-sky-700">
										{item.cohortCode}
									</Badge>
								)}
								<span className="min-w-0 flex-1 truncate font-semibold">{sectionLabel(item.sectionId)}</span>
							</div>
							<p className="line-clamp-2 whitespace-normal text-xs leading-snug text-muted-foreground">
								{subjectLabel(item.subjectId)} · Session {item.session}
							</p>
						</div>
					</div>
				</div>
				<div className="flex min-w-0 flex-wrap items-center gap-1">
					<span
						className={`inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${itemStatus.className}`}
						data-unassigned-status={itemStatus.label}
					>
						{itemStatus.key === 'blocked' ? <AlertTriangle className="size-2.5 shrink-0" aria-hidden="true" /> : null}
						<span className="truncate">{itemStatus.label}</span>
					</span>
					{matchesProgramFilter(resolveEntryProgramType(item), 'SPECIAL') && (
						<Badge variant="outline" className="h-5 border-violet-300 bg-violet-50 px-1.5 text-xs text-violet-700">
							{getProgramBadgeLabel(resolveEntryProgramType(item), resolveEntryProgramCode(item))}
						</Badge>
					)}
					{renderUnassignedReasonBadge(item.reason)}
				</div>
				<div className="flex min-w-0 flex-wrap items-center gap-1">
					<Button
						variant="outline"
						size="sm"
						className={`h-8 min-w-0 flex-1 justify-center px-2 text-xs ${
							itemStatus.key === 'needs-owner'
								? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
								: itemStatus.key === 'needs-room'
									? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
									: itemStatus.key === 'blocked'
										? 'border-red-200 bg-red-50 text-red-700'
										: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
						}`}
						disabled={itemStatus.key === 'blocked'}
						onClick={(event) => {
							event.stopPropagation();
							if (itemStatus.key === 'needs-owner') openTeachingLoadRepair();
							else if (canOpenPlacement) openPlacementFlow();
						}}
					>
						<Wand2 className="size-3 shrink-0" />
						<span className="truncate">{itemStatus.actionLabel}</span>
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 px-2 text-xs"
						onClick={(event) => {
							event.stopPropagation();
							setDrawerUnassigned(item);
						}}
					>
						<Lightbulb className="size-3" />
						Details
					</Button>
					<Button
						variant="ghost"
						size="sm"
						aria-label={isFollowUp ? 'Remove follow-up flag' : 'Flag for follow-up'}
						className={`h-8 px-2 text-xs ${isFollowUp ? 'text-amber-600' : ''}`}
						onClick={(event) => {
							event.stopPropagation();
							setFollowUps((prev) => {
								const next = new Set(prev);
								if (next.has(itemKey)) next.delete(itemKey);
								else next.add(itemKey);
								return next;
							});
							toast.info(isFollowUp ? 'Follow-up removed' : 'Marked for follow-up');
						}}
					>
						<Flag className={`size-3 ${isFollowUp ? 'fill-amber-500' : ''}`} />
					</Button>
				</div>
			</div>
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

export { UnassignedFixSuggestions, getUnassignedStatus };
