import { memo, useEffect, useMemo, useReducer, useState } from 'react';
import {
	ArrowRightLeft,
	CalendarClock,
	CheckCircle2,
	ChevronRight,
	ClipboardCheck,
	Flag,
	ListChecks,
	Search,
	Send,
	SkipForward,
	X,
	type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { initialSimplePlacementState, reduceSimplePlacementState } from '@/lib/simple-timetable-state';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { LeftRailContent } from '@/components/timetable/LeftRailContent';
import { getUnassignedStatus } from '@/components/timetable/GeneratedUnassignedPanel';
import { DraggableQueuePin, DraggableUnassignedPin } from '@/components/timetable/DraggablePinWrappers';
import type { LeftRailContentContext } from '@/components/timetable/timetableContexts.types';
import type { TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { DraftQueueItem, UnassignedItem, Violation } from '@/types';
import {
	BlockerGroupCard,
	PublishChecklistContent,
	RepairContextBanner,
	type RepairOrigin,
} from '@/components/timetable/simple/SimpleTaskDrawerHelpers';

export type { RepairOrigin } from '@/components/timetable/simple/SimpleTaskDrawerHelpers';
import {
	draftQueueKey,
	draftStatusRank,
	deriveRowReasonStack,
	getDraftQueueStatus,
	sameDraftQueueItem,
	sameUnassignedItem,
	statusRank,
} from '@/components/timetable/simple/SimpleQueueHelpers';

type TimetableTaskDrawerProps = {
	task: TimetableSimpleTask | null;
	onTaskChange: (task: TimetableSimpleTask | null) => void;
	leftRailContentContext: LeftRailContentContext;
	hardCount: number;
	softCount: number;
	unassignedCount: number;
	assignedCount: number;
	runId: number | null;
	isPreGenerationWorkspace: boolean;
	onPublish: () => void;
	violations?: Violation[];
	sectionLabel?: (id: number) => string;
	subjectLabel?: (id: number) => string;
	facultyLabel?: (id: number) => string;
	repairOrigin?: RepairOrigin | null;
	onBackToBlockerSummary?: () => void;
};

type DrawerCopy = {
	title: string;
	description: string;
	stepOne: string;
	stepTwo: string;
	icon: LucideIcon;
};

const copyByTask: Record<TimetableSimpleTask, DrawerCopy> = {
	'place-unresolved': {
		title: 'Place unresolved sessions',
		description: 'Choose one session from the queue, then choose a green slot on the grid. ATLAS shows a review before saving.',
		stepOne: 'Choose a session',
		stepTwo: 'Choose a green grid slot',
		icon: ClipboardCheck,
	},
	'swap-sessions': {
		title: 'Swap class times',
		description: 'Choose two occupied classes on the grid. ATLAS shows the proposed time change before anything is saved.',
		stepOne: 'Choose first class',
		stepTwo: 'Choose second class',
		icon: ArrowRightLeft,
	},
	'review-issues': {
		title: 'Review issues',
		description: 'Start with hard blockers. Warnings can be reviewed after blockers are clear.',
		stepOne: 'Read top issue',
		stepTwo: 'Choose the suggested fix',
		icon: ListChecks,
	},
	'plan-draft': {
		title: 'Plan before generating',
		description: 'Use the draft queue to anchor sessions before generating. Nothing is saved until the review is confirmed.',
		stepOne: 'Choose draft item',
		stepTwo: 'Choose a grid slot',
		icon: CalendarClock,
	},
	publish: {
		title: 'Publish schedule',
		description: 'Publish only when hard blockers are gone. Teachers and students can then use the final schedule.',
		stepOne: 'Confirm blockers are clear',
		stepTwo: 'Publish the schedule',
		icon: Send,
	},
};

function TimetableTaskDrawerImpl({
	task,
	onTaskChange,
	leftRailContentContext,
	hardCount,
	softCount,
	unassignedCount,
	assignedCount,
	runId,
	isPreGenerationWorkspace,
	onPublish,
	violations = [],
	sectionLabel = (id: number) => `Section #${id}`,
	subjectLabel = (id: number) => `Subject #${id}`,
	facultyLabel = (id: number) => `Teacher #${id}`,
	repairOrigin = null,
	onBackToBlockerSummary,
}: TimetableTaskDrawerProps) {
	if (!task) return null;
	const copy = copyByTask[task];
	const Icon = copy.icon;
	const shouldShowRail = task === 'review-issues';

	return (
		<aside
			className="absolute inset-x-2 bottom-2 z-20 flex max-h-[72%] min-h-72 flex-col overflow-hidden rounded-2xl border border-border bg-background/98 shadow-2xl backdrop-blur md:static md:inset-auto md:z-auto md:h-full md:max-h-none md:w-[24rem] md:rounded-none md:border-y-0 md:border-r-0 md:shadow-none"
			data-testid="timetable-task-drawer"
			aria-label={copy.title}
		>
			<div className="shrink-0 border-b border-border px-3 py-2 [@media(max-height:500px)]:py-1.5">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-start gap-2">
						<div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<Icon className="size-4" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<h2 className="truncate text-sm font-semibold text-foreground">{copy.title}</h2>
							<p className="line-clamp-1 text-xs leading-relaxed text-muted-foreground [@media(max-height:500px)]:hidden">{copy.description}</p>
						</div>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-9 w-9 shrink-0 p-0"
						onClick={() => onTaskChange(null)}
						aria-label="Close task drawer"
					>
						<X className="size-4" aria-hidden="true" />
					</Button>
				</div>
				<div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground [@media(max-height:500px)]:hidden" aria-label="Task steps">
					<span className="font-semibold text-foreground">1.</span>
					<span className="truncate">{copy.stepOne}</span>
					<ChevronRight className="size-3 shrink-0" aria-hidden="true" />
					<span className="font-semibold text-foreground">2.</span>
					<span className="truncate">{copy.stepTwo}</span>
				</div>
				{task === 'place-unresolved' && unassignedCount > 0 ? (
					<p className="mt-1 text-xs font-medium text-amber-700" aria-label="Sessions left to place">
						{unassignedCount} session{unassignedCount === 1 ? '' : 's'} left to place
					</p>
				) : null}
			</div>

			{task === 'place-unresolved' ? (
				<>
					{repairOrigin && (
						<RepairContextBanner
							repairOrigin={repairOrigin}
							onBackToBlockerSummary={onBackToBlockerSummary}
							onClearFilter={() => {
								leftRailContentContext.setUnassignedReasonFilter('all');
							}}
						/>
					)}
					<SimpleGeneratedPlottingTray context={leftRailContentContext} />
				</>
			) : task === 'plan-draft' ? (
				<SimpleDraftPlottingTray context={leftRailContentContext} />
			) : shouldShowRail ? (
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					<LeftRailContent context={leftRailContentContext} />
				</div>
			) : task === 'swap-sessions' ? (
				<div className="flex min-h-0 flex-1 flex-col">
					<ScrollArea className="flex-1">
						<div className="space-y-2 p-3 text-sm">
							<div className="rounded-lg border border-border bg-muted/30 p-3">
								<p className="font-semibold text-foreground">Choose two occupied classes</p>
								<p className="mt-1 text-xs text-muted-foreground">ATLAS will show the proposed time change before anything is saved.</p>
							</div>
							<div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
								<CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
								<span>Teachers stay assigned to their classes.</span>
							</div>
						</div>
					</ScrollArea>
				</div>
			) : (
				<div className="flex min-h-0 flex-1 flex-col">
					<ScrollArea className="flex-1">
						<PublishChecklistContent
							runId={runId}
							assignedCount={assignedCount}
							unassignedCount={unassignedCount}
							hardCount={hardCount}
							softCount={softCount}
							violations={violations}
							sectionLabel={sectionLabel}
							subjectLabel={subjectLabel}
							facultyLabel={facultyLabel}
							onPublish={onPublish}
							onReviewIssues={() => onTaskChange('review-issues')}
							onPlaceUnresolved={() => onTaskChange('place-unresolved')}
						/>
					</ScrollArea>
				</div>
			)}
		</aside>
	);
}

export const TimetableTaskDrawer = memo(TimetableTaskDrawerImpl);


function SimpleDraftPlottingTray({ context }: { context: LeftRailContentContext }) {
	const {
		draftBoard,
		pinsSearch,
		setPinsSearch,
		pinsGradeFilter,
		setPinsGradeFilter,
		setPinsSectionFilter,
		setPinsSubjectFilter,
		preGenKbSource,
		setPreGenKbSource,
		setKbSelectedSource,
		setSelectedEntry,
		setSelectedViolation,
		setSelectedUnassignedForRepair,
		rightPanelRef,
		leftPanelRef,
		isDesktop,
		formatFacultyInitials,
		GRADE_BADGE,
		toast,
		openTacticalSandbox,
		roomMap,
	} = context;
	const [skippedKeys, setSkippedKeys] = useState<Set<string>>(new Set());
	const [activeItem, setActiveItem] = useState<DraftQueueItem | null>(null);
	const [placementState, dispatchPlacement] = useReducer(reduceSimplePlacementState, initialSimplePlacementState);
	const [findOpen, setFindOpen] = useState(false);

	const queue = draftBoard?.queue ?? [];
	const grades = useMemo(() => [...new Set(queue.map((item) => item.gradeLevel))].sort((a, b) => a - b), [queue]);

	const visibleQueue = useMemo(() => {
		const q = pinsSearch.trim().toLowerCase();
		return queue.filter((item) => {
			const matchesGrade = pinsGradeFilter === 'all' || item.gradeLevel === pinsGradeFilter;
			if (!matchesGrade) return false;
			if (!q) return true;
			const haystack = [
				item.sectionName,
				item.subjectCode,
				item.subjectName,
				item.cohortCode,
				`session ${item.sessionNumber}`,
			].filter(Boolean).join(' ').toLowerCase();
			return haystack.includes(q);
		});
	}, [pinsGradeFilter, pinsSearch, queue]);

	const sortedQueue = useMemo(() => {
		return [...visibleQueue].sort((a, b) => {
			const keyA = draftQueueKey(a);
			const keyB = draftQueueKey(b);
			const skippedA = skippedKeys.has(keyA) ? 10 : 0;
			const skippedB = skippedKeys.has(keyB) ? 10 : 0;
			return (draftStatusRank(getDraftQueueStatus(a, roomMap)) + skippedA) - (draftStatusRank(getDraftQueueStatus(b, roomMap)) + skippedB)
				|| a.gradeLevel - b.gradeLevel
				|| a.sectionName.localeCompare(b.sectionName)
				|| a.subjectCode.localeCompare(b.subjectCode)
				|| a.sessionNumber - b.sessionNumber;
		});
	}, [roomMap, skippedKeys, visibleQueue]);

	useEffect(() => {
		if (activeItem && sortedQueue.some((item) => sameDraftQueueItem(item, activeItem))) return;
		const nextItem = sortedQueue[0] ?? null;
		setActiveItem(nextItem);
		dispatchPlacement(nextItem ? { type: 'display', key: draftQueueKey(nextItem) } : { type: 'reset' });
	}, [activeItem, sortedQueue]);

	useEffect(() => {
		if (!placementState.armed) return;
		if (preGenKbSource?.type === 'draftQueue' && draftQueueKey(preGenKbSource.item) === placementState.displayedKey) return;
		dispatchPlacement({ type: 'display', key: placementState.displayedKey });
	}, [placementState.armed, placementState.displayedKey, preGenKbSource]);

	const selectQueueItem = (item: DraftQueueItem) => {
		const status = getDraftQueueStatus(item, roomMap);
		setActiveItem(item);
		if (status.key === 'needs-owner') {
			dispatchPlacement({ type: 'display', key: draftQueueKey(item) });
			setPreGenKbSource(null);
			setKbSelectedSource(null);
			setSelectedEntry(null);
			setSelectedViolation(null);
			setSelectedUnassignedForRepair(null);
			openTacticalSandbox();
			toast.info('Fix the Teaching Load owner first, then return to place this draft session.');
			return;
		}
		const source = { type: 'draftQueue' as const, item };
		dispatchPlacement({ type: 'arm', key: draftQueueKey(item), sectionId: item.sectionId });
		setPreGenKbSource(source);
		setKbSelectedSource(source);
		setSelectedEntry(null);
		setSelectedViolation(null);
		setSelectedUnassignedForRepair(null);
		rightPanelRef.current?.expand();
		if (!isDesktop) leftPanelRef.current?.collapse();
	};

	const skipActive = () => {
		if (!activeItem) return;
		const itemKey = draftQueueKey(activeItem);
		setSkippedKeys((prev) => new Set(prev).add(itemKey));
		const nextItem = sortedQueue.find((item) => draftQueueKey(item) !== itemKey) ?? activeItem;
		setPreGenKbSource(null);
		setKbSelectedSource(null);
		setActiveItem(nextItem);
		dispatchPlacement({ type: 'skip', nextKey: nextItem ? draftQueueKey(nextItem) : null });
		toast.info('Skipped for now. ATLAS moved it behind the next draft sessions.');
	};

	const clearFind = () => {
		setPinsSearch('');
		setPinsGradeFilter('all');
		setPinsSectionFilter('all');
		setPinsSubjectFilter('all');
	};

	const trayItems = useMemo(() => {
		const base = activeItem
			? [activeItem, ...sortedQueue.filter((item) => !sameDraftQueueItem(item, activeItem))]
			: sortedQueue;
		return base.slice(0, findOpen ? 36 : 4);
	}, [activeItem, findOpen, sortedQueue]);

	if (!draftBoard) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<CalendarClock className="size-7 text-primary" aria-hidden="true" />
				<p className="font-semibold text-foreground">Loading draft planner.</p>
				<p>ATLAS is preparing the draft queue.</p>
			</div>
		);
	}

	if (queue.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<CheckCircle2 className="size-7 text-emerald-500" aria-hidden="true" />
				<p className="font-semibold text-foreground">No draft sessions left to place.</p>
				<p>Everything available for this draft is already pinned or filtered out.</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="pregen-plotting-tray">
			<div className="shrink-0 border-b border-border/70 px-3 py-2">
				<div className="flex items-center justify-between gap-2">
					<div className="min-w-0">
						<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Draft plotting queue</p>
						<p className="truncate text-sm font-semibold text-foreground">
							{visibleQueue.length} of {queue.length} session{queue.length === 1 ? '' : 's'} shown
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9 gap-1.5 px-2 text-xs"
							onClick={() => setFindOpen((value) => !value)}
							data-testid="pregen-find-session-drawer"
						>
							<Search className="size-3.5" aria-hidden="true" />
							Find
						</Button>
						<Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5 px-2 text-xs" onClick={skipActive} disabled={!activeItem}>
							<SkipForward className="size-3.5" aria-hidden="true" />
							Skip
						</Button>
					</div>
				</div>
				<p className="mt-1 text-sm text-muted-foreground">
					Next session is shown first. Select it before choosing a highlighted slot.
				</p>
				{findOpen ? (
					<div className="mt-2 space-y-2 rounded-xl border border-border bg-muted/20 p-2">
						<div className="relative" role="search">
							<Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={pinsSearch}
								onChange={(event) => setPinsSearch(event.target.value)}
								placeholder="Find section, subject, or session..."
								aria-label="Find draft session"
								className="h-9 pl-7 pr-8 text-sm"
								data-testid="pregen-plotting-search"
							/>
							{pinsSearch ? (
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label="Clear draft session search"
									onClick={() => setPinsSearch('')}
									className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
								>
									<X className="size-3.5" />
								</Button>
							) : null}
						</div>
						<div className="flex gap-1 overflow-x-auto pb-0.5" aria-label="Draft queue grade filters">
							<Button type="button" variant={pinsGradeFilter === 'all' ? 'default' : 'secondary'} size="sm" onClick={() => { setPinsGradeFilter('all'); setPinsSectionFilter('all'); }} className="h-7 shrink-0 rounded-full px-2.5 text-xs">
								All grades
							</Button>
							{grades.map((grade) => (
								<Button key={grade} type="button" variant={pinsGradeFilter === grade ? 'default' : 'secondary'} size="sm" onClick={() => { setPinsGradeFilter(grade); setPinsSectionFilter('all'); }} className="h-7 shrink-0 rounded-full px-2.5 text-xs">
									GR{grade}
								</Button>
							))}
							<Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 rounded-full px-2.5 text-xs" onClick={clearFind}>
								Clear
							</Button>
						</div>
					</div>
				) : null}
			</div>

			<div
				className="min-h-0 flex-1 overflow-auto touch-pan-y overscroll-contain"
				data-testid="pregen-plotting-scroll"
				role="list"
				aria-label="Pre-generation draft sessions"
				tabIndex={0}
			>
				<div className="grid gap-1.5 p-2" data-testid="pregen-plotting-visible-list">
					{!findOpen && trayItems.length > 0 ? (
						<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Current session</p>
					) : null}
					{trayItems.map((item, index) => (
						<div key={`${draftQueueKey(item)}-${index}`} className="contents">
							{!findOpen && index === 1 ? (
								<p className="mt-1 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Next sessions</p>
							) : null}
							<SimpleDraftQueueRow
								context={context}
								item={item}
								index={index}
								displayed={sameDraftQueueItem(item, activeItem)}
								selected={Boolean(placementState.armed && placementState.displayedKey === draftQueueKey(item))}
								onSelect={selectQueueItem}
								formatFacultyInitials={formatFacultyInitials}
								gradeBadge={item.gradeLevel ? GRADE_BADGE[item.gradeLevel] : undefined}
								roomMap={roomMap}
							/>
						</div>
					))}
					{trayItems.length === 0 ? (
						<div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
							No draft sessions match your filters.
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

function SimpleDraftQueueRow({
	context,
	item,
	index,
	displayed,
	selected,
	onSelect,
	formatFacultyInitials,
	gradeBadge,
	roomMap,
}: {
	context: LeftRailContentContext;
	item: DraftQueueItem;
	index: number;
	displayed: boolean;
	selected: boolean;
	onSelect: (item: DraftQueueItem) => void;
	formatFacultyInitials: (id: number) => string;
	gradeBadge?: string;
	roomMap: LeftRailContentContext['roomMap'];
}) {
	const { isDesktop } = context;
	const status = getDraftQueueStatus(item, roomMap);
	const isCurrent = displayed || index === 0;
	const ownerLabel = item.facultyOptions[0] ? formatFacultyInitials(item.facultyOptions[0]) : 'No owner';
	const content = (
		<div className="grid min-h-[72px] grid-cols-[1fr_auto] gap-2 p-2" data-testid={isCurrent ? 'pregen-current-plotting-item' : 'pregen-next-plotting-item'}>
			<Button
				type="button"
				variant="ghost"
				className="h-auto min-w-0 justify-start p-0 text-left hover:bg-transparent"
				onClick={() => onSelect(item)}
				aria-label={`${status.actionLabel}: ${item.subjectCode} for ${item.sectionName}, session ${item.sessionNumber}`}
				aria-pressed={selected}
			>
				<div className="min-w-0">
					<div className="flex min-w-0 items-center gap-1.5">
						{isCurrent ? <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-xs">{selected ? 'Selected' : 'Next'}</Badge> : null}
								{gradeBadge ? <Badge variant="outline" className={`h-5 shrink-0 px-1.5 text-xs ${gradeBadge}`}>GR{item.gradeLevel}</Badge> : null}
						<span className="truncate font-semibold text-foreground">{item.sectionName}</span>
					</div>
					<p className="mt-0.5 truncate text-xs text-muted-foreground">
						{item.subjectCode} · Session {item.sessionNumber}/{item.sessionsPerWeek} · {ownerLabel}
					</p>
					<p className={cn('mt-1 inline-flex max-w-full rounded-full border px-2 py-0.5 text-xs font-semibold', status.className)}>
						<span className="truncate">{status.label}</span>
					</p>
					{status.key !== 'ready' && (
						<p className="mt-1 text-[0.65rem] leading-tight text-muted-foreground" data-testid="timetable-row-reason-stack">
							<span className="font-medium text-foreground/80">First fix:</span> {status.actionLabel}
							{status.key === 'needs-room' && ' â€” ATLAS cannot test slots until the room is known.'}
							{status.key === 'needs-owner' && ' â€” ATLAS cannot evaluate placement without a teacher owner.'}
						</p>
					)}
				</div>
			</Button>
			<div className="flex min-w-[7.5rem] flex-col justify-center gap-1">
				<Button type="button" size="sm" variant={status.key === 'ready' ? 'default' : 'outline'} className="h-11 px-3 text-sm" disabled={status.key === 'blocked'} onClick={() => onSelect(item)} aria-pressed={selected}>
					<span className="truncate">{selected ? 'Selected' : status.actionLabel}</span>
				</Button>
				<p className="truncate text-center text-xs text-muted-foreground">{String(item.preferredRoomType ?? 'room').replace(/_/g, ' ').toLowerCase()}</p>
			</div>
		</div>
	);

	if (!isDesktop) {
		return (
			<div role="listitem" aria-current={selected ? 'true' : undefined} className={cn('rounded-xl border bg-background text-sm transition-colors', selected ? 'border-primary ring-2 ring-primary/70' : 'border-border hover:border-primary/50')}>
				{content}
			</div>
		);
	}

	return (
		<div role="listitem" aria-current={selected ? 'true' : undefined} data-testid="simple-plotting-session-row">
			<DraggableQueuePin
				item={item}
				disabled={false}
				onClick={() => onSelect(item)}
				onDragStart={() => onSelect(item)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						onSelect(item);
					}
				}}
				className={cn('rounded-xl border bg-background text-sm transition-colors', selected ? 'border-primary ring-2 ring-primary/70' : 'border-border hover:border-primary/50')}
			>
				{content}
			</DraggableQueuePin>
		</div>
	);
}

function SimpleGeneratedPlottingTray({ context }: { context: LeftRailContentContext }) {
	const {
		filteredUnassignedItems,
		unassignedFixSuggestions,
		buildUnassignedKey,
		sectionLabel,
		subjectLabel,
		setSelectedEntry,
		setSelectedViolation,
		setSelectedUnassignedForRepair,
		setKbSelectedSource,
		setDrawerUnassigned,
		setFollowUps,
		followUps,
		toast,
		openTacticalSandbox,
		GRADE_BADGE,
		focusSection,
		unassignedReasonFilter,
		setUnassignedReasonFilter,
	} = context;
	const [skippedKeys, setSkippedKeys] = useState<Set<string>>(new Set());
	const [activeItem, setActiveItem] = useState<UnassignedItem | null>(null);
	const [placementState, dispatchPlacement] = useReducer(reduceSimplePlacementState, initialSimplePlacementState);
	const [findOpen, setFindOpen] = useState(false);
	const [search, setSearch] = useState('');

	const sortedItems = useMemo(() => {
		return [...filteredUnassignedItems].sort((a, b) => {
			const keyA = buildUnassignedKey(a);
			const keyB = buildUnassignedKey(b);
			const statusA = getUnassignedStatus(a, unassignedFixSuggestions[keyA]);
			const statusB = getUnassignedStatus(b, unassignedFixSuggestions[keyB]);
			const skippedA = skippedKeys.has(keyA) ? 10 : 0;
			const skippedB = skippedKeys.has(keyB) ? 10 : 0;
			return (statusRank(statusA) + skippedA) - (statusRank(statusB) + skippedB)
				|| (a.gradeLevel ?? 99) - (b.gradeLevel ?? 99)
				|| sectionLabel(a.sectionId).localeCompare(sectionLabel(b.sectionId))
				|| subjectLabel(a.subjectId).localeCompare(subjectLabel(b.subjectId))
				|| String(a.session).localeCompare(String(b.session));
		});
	}, [buildUnassignedKey, filteredUnassignedItems, sectionLabel, skippedKeys, subjectLabel, unassignedFixSuggestions]);

	useEffect(() => {
		if (activeItem && sortedItems.some((item) => sameUnassignedItem(item, activeItem))) return;
		const nextItem = sortedItems[0] ?? null;
		setActiveItem(nextItem);
		dispatchPlacement(nextItem ? { type: 'display', key: buildUnassignedKey(nextItem) } : { type: 'reset' });
	}, [activeItem, buildUnassignedKey, sortedItems]);

	useEffect(() => {
		if (!placementState.armed) return;
		if (context.kbSelectedSource?.type === 'unassigned' && buildUnassignedKey(context.kbSelectedSource.item) === placementState.displayedKey) return;
		dispatchPlacement({ type: 'display', key: placementState.displayedKey });
	}, [
		buildUnassignedKey,
		context.kbSelectedSource,
		placementState.armed,
		placementState.displayedKey,
	]);

	const selectForPlacement = (item: UnassignedItem) => {
		const itemKey = buildUnassignedKey(item);
		const status = getUnassignedStatus(item, unassignedFixSuggestions[itemKey]);
		setActiveItem(item);
		focusSection(item.sectionId);
		setSelectedEntry(null);
		setSelectedViolation(null);
		if (status.key === 'needs-owner') {
			dispatchPlacement({ type: 'display', key: itemKey });
			setKbSelectedSource(null);
			setSelectedUnassignedForRepair(item);
			openTacticalSandbox();
			toast.info('Teaching Load repair opened. Fix the owner there, then place the session.');
			return;
		}
		if (status.key === 'blocked') {
			dispatchPlacement({ type: 'display', key: itemKey });
			setKbSelectedSource(null);
			setDrawerUnassigned(item);
			toast.info('This session is blocked. Review the details first.');
			return;
		}
		setSelectedUnassignedForRepair(null);
		dispatchPlacement({ type: 'arm', key: itemKey, sectionId: item.sectionId });
		setKbSelectedSource({ type: 'unassigned', item });
	};

	const skipActive = () => {
		if (!activeItem) return;
		const itemKey = buildUnassignedKey(activeItem);
		setSkippedKeys((prev) => new Set(prev).add(itemKey));
		const nextItem = sortedItems.find((item) => buildUnassignedKey(item) !== itemKey) ?? activeItem;
		setKbSelectedSource(null);
		setActiveItem(nextItem);
		dispatchPlacement({ type: 'skip', nextKey: nextItem ? buildUnassignedKey(nextItem) : null });
		toast.info('Skipped for now. ATLAS moved it behind the next sessions.');
	};

	const visibleItems = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return sortedItems;
		return sortedItems.filter((item) => {
			const haystack = [
				sectionLabel(item.sectionId),
				subjectLabel(item.subjectId),
				String(item.session),
				item.cohortCode ?? '',
			].join(' ').toLowerCase();
			return haystack.includes(q);
		});
	}, [search, sectionLabel, sortedItems, subjectLabel]);

	const trayItems = useMemo(() => {
		const base = activeItem
			? [activeItem, ...sortedItems.filter((item) => !sameUnassignedItem(item, activeItem))]
			: sortedItems;
		return base.slice(0, 4);
	}, [activeItem, sortedItems]);

	const nextActionLabel = useMemo(() => {
		if (sortedItems.length === 0) return 'No unresolved sessions';
		const first = sortedItems[0];
		const status = getUnassignedStatus(first, unassignedFixSuggestions[buildUnassignedKey(first)]);
		const remaining = sortedItems.length;
		if (status.key === 'ready') return `Place ${remaining} session${remaining === 1 ? '' : 's'} on the grid`;
		if (status.key === 'needs-room') return `Choose room for ${remaining} session${remaining === 1 ? '' : 's'}`;
		if (status.key === 'needs-owner') return `Assign teacher for ${remaining} session${remaining === 1 ? '' : 's'}`;
		return `Review ${remaining} blocked session${remaining === 1 ? '' : 's'}`;
	}, [sortedItems, unassignedFixSuggestions, buildUnassignedKey]);

	const hasLoadingNames = trayItems.some((item) => {
		const section = sectionLabel(item.sectionId).toLowerCase();
		const subject = subjectLabel(item.subjectId).toLowerCase();
		return section.startsWith('loading') || subject.startsWith('loading');
	});

	if (sortedItems.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
				<CheckCircle2 className="size-7 text-emerald-500" aria-hidden="true" />
				<p className="font-semibold text-foreground">No unresolved generated sessions.</p>
				<p>Everything currently available has been placed or filtered out.</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="simple-plotting-tray">
			<div className="shrink-0 border-b border-border/70 px-3 py-2">
				<div className="flex items-center justify-between gap-2">
					<div className="min-w-0">
						<p className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Next action</p>
						<p className="truncate text-sm font-semibold text-foreground" data-testid="simple-plotting-next-action">
							{nextActionLabel}
						</p>
						<p className="text-sm text-muted-foreground">
							{hasLoadingNames ? 'Loading names…' : 'Current session first. Use Find for the full queue.'}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 px-2 text-xs" onClick={() => setFindOpen((value) => !value)} data-testid="simple-plotting-find-session">
							<Search className="size-3.5" aria-hidden="true" />
							Find
						</Button>
						<Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5 px-2 text-xs" onClick={skipActive} disabled={!activeItem}>
							<SkipForward className="size-3.5" aria-hidden="true" />
							Skip
						</Button>
					</div>
				</div>
				{findOpen ? (
					<div className="mt-2">
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Find section, subject, or session..."
							aria-label="Find unresolved session"
							className="h-9 text-sm"
							data-testid="simple-plotting-search"
						/>
					</div>
				) : null}
			</div>

			{unassignedReasonFilter && unassignedReasonFilter !== 'all' && (
				<div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-1.5" data-testid="simple-plotting-reason-filter">
					<div className="flex items-center justify-between gap-2">
						<p className="text-xs font-medium text-amber-800">
							Showing sessions with {unassignedReasonFilter === 'NO_AVAILABLE_SLOT' ? 'no available slot' : unassignedReasonFilter.replace(/_/g, ' ').toLowerCase()}
						</p>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-6 gap-1 px-1.5 text-xs text-amber-700"
							onClick={() => setUnassignedReasonFilter('all')}
						>
							Clear filter
						</Button>
					</div>
				</div>
			)}

			<div
				className="min-h-0 flex-1 overflow-auto touch-pan-y overscroll-contain"
				data-testid="simple-plotting-scroll"
				data-virtualized-rail="Unassigned generated sessions"
				role="list"
				aria-label="Unassigned generated sessions"
				tabIndex={0}
			>
				<div className="grid gap-1.5 p-2" data-testid="simple-plotting-visible-list">
					{!findOpen && trayItems.length > 0 ? (
						<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Current session</p>
					) : null}
					{(findOpen ? visibleItems : trayItems).map((item, index) => (
						<div key={`${buildUnassignedKey(item)}-${index}`} className="contents">
							{!findOpen && index === 1 ? (
								<p className="mt-1 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Next sessions</p>
							) : null}
							<SimpleUnassignedQueueRow
								context={context}
								item={item}
								index={index}
								displayed={sameUnassignedItem(item, activeItem)}
								selected={Boolean(placementState.armed && placementState.displayedKey === buildUnassignedKey(item))}
								onSelect={selectForPlacement}
							/>
						</div>
					))}
					{findOpen && visibleItems.length === 0 ? (
						<div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
							No unresolved sessions match your search.
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

function SimpleUnassignedQueueRow({
	context,
	item,
	index,
	displayed,
	selected,
	onSelect,
}: {
	context: LeftRailContentContext;
	item: UnassignedItem;
	index: number;
	displayed: boolean;
	selected: boolean;
	onSelect: (item: UnassignedItem) => void;
}) {
	const {
		buildUnassignedKey,
		sectionLabel,
		subjectLabel,
		unassignedFixSuggestions,
		setDrawerUnassigned,
		setFollowUps,
		followUps,
		GRADE_BADGE,
	} = context;
	const itemKey = buildUnassignedKey(item);
	const status = getUnassignedStatus(item, unassignedFixSuggestions[itemKey]);
	const gradeBadge = item.gradeLevel ? GRADE_BADGE[item.gradeLevel] : undefined;
	const followUp = followUps.has(itemKey);
	const isCurrent = displayed || index === 0;
	const actionLabel = status.key === 'ready'
		? 'Place session'
		: status.key === 'needs-room'
			? 'Choose room'
			: status.key === 'needs-owner'
				? 'Fix owner'
				: 'Review blocker';
	const reasonStack = deriveRowReasonStack(status, item.reason);

	return (
		<div role="listitem">
			<DraggableUnassignedPin
				itemKey={itemKey}
				item={item}
				disabled={false}
				onDragStart={() => onSelect(item)}
				className={cn(
					'rounded-xl border bg-background text-xs transition-colors',
					selected ? 'border-primary ring-2 ring-primary/70' : 'border-border hover:border-primary/50',
				)}
			>
				<div
					className="grid min-h-[72px] grid-cols-[1fr_auto] gap-2 p-2"
					data-testid={isCurrent ? 'simple-current-session-card' : 'simple-next-session-card'}
					data-simple-plotting-row="true"
					aria-current={selected ? 'true' : undefined}
				>
					<Button
						type="button"
						variant="ghost"
						className="h-auto min-w-0 justify-start p-0 text-left hover:bg-transparent"
						onClick={() => onSelect(item)}
						aria-pressed={selected}
						aria-label={`${actionLabel}: ${subjectLabel(item.subjectId)} for ${sectionLabel(item.sectionId)}, session ${item.session}`}
					>
						<div className="min-w-0">
							<div className="flex min-w-0 items-center gap-1.5">
								{isCurrent ? <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-xs">{selected ? 'Selected' : 'Next'}</Badge> : null}
								{gradeBadge ? <Badge variant="outline" className={`h-5 shrink-0 px-1.5 text-xs ${gradeBadge}`}>GR{item.gradeLevel}</Badge> : null}
								<span className="truncate font-semibold text-foreground">{sectionLabel(item.sectionId)}</span>
							</div>
							<p className="mt-0.5 truncate text-xs text-muted-foreground">
								{subjectLabel(item.subjectId)} · Session {item.session}
							</p>
							<p className={cn('mt-1 inline-flex max-w-full rounded-full border px-2 py-0.5 text-xs font-semibold', status.className)}>
								<span className="truncate">{status.label}</span>
							</p>
							{isCurrent && reasonStack && reasonStack.mainIssue !== 'Needs attention' && (
								<p className="mt-1 text-xs leading-tight text-muted-foreground" data-testid="timetable-row-reason-stack">
									<span className="font-medium text-foreground/80">Main issue:</span> {reasonStack.mainIssue} · <span className="font-medium text-foreground/80">First fix:</span> {reasonStack.firstFix}
								</p>
							)}
						</div>
					</Button>
					<div className="flex min-w-[7.5rem] flex-col justify-center gap-1">
						<Button type="button" size="sm" variant={status.key === 'ready' ? 'default' : 'outline'} className="h-11 px-3 text-sm" disabled={status.key === 'blocked'} onClick={() => onSelect(item)} aria-pressed={selected}>
							<span className="truncate">{selected ? 'Selected' : actionLabel}</span>
						</Button>
						<div className="grid grid-cols-2 gap-1">
							<Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={() => setDrawerUnassigned(item)}>
								Details
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								aria-label={followUp ? 'Remove follow-up flag' : 'Flag for follow-up'}
								className={cn('h-7 px-1.5 text-xs', followUp ? 'text-amber-600' : '')}
								onClick={() => {
									setFollowUps((prev) => {
										const next = new Set(prev);
										if (next.has(itemKey)) next.delete(itemKey);
										else next.add(itemKey);
										return next;
									});
								}}
							>
								<Flag className={cn('size-3', followUp ? 'fill-amber-500' : '')} aria-hidden="true" />
							</Button>
						</div>
					</div>
				</div>
			</DraggableUnassignedPin>
		</div>
	);
}
